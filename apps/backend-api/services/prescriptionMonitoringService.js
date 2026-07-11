/**
 * Prescription Monitoring Service
 *
 * Domain: prescription monitoring + medication expiration
 * Purpose:
 * - Monitor pending prescriptions and automatically activate them when startDate arrives
 * - Monitor active medications and automatically mark them as expired when endDate arrives
 *
 * Architecture:
 * - Uses GLOBAL DATABASE for metadata (NO PHI): which prescriptions/medications are ready to process
 * - Uses PRACTICE DATABASES for operations: updates prescription/medication status
 * - Runs on interval (hourly by default)
 * - Secure multi-tenant design: No cross-practice data access
 *
 * Dual Storage Pattern:
 * 1. Global Database (NO PHI)
 *    a) prescriptionActivationMetadata
 *       - prescriptionId, practiceId, patientId, startDate, status, lastCheckedAt
 *       - NO patient names, NO medication details, NO PHI
 *       - Used to identify which prescriptions need activation
 *    b) medicationExpirationMetadata
 *       - medicationId, practiceId, patientId, endDate, status
 *       - NO patient names, NO medication names, NO PHI
 *       - Used to identify which medications need expiration
 *
 * 2. Practice Database (Full PHI records)
 *    a) prescriptions
 *       - Full prescription record with PHI
 *       - Updated when status changes
 *       - Synced to medications collection
 *    b) medications
 *       - Full medication record with PHI
 *       - Updated to active=false when expired
 */

const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const cron = require('node-cron');

class PrescriptionMonitoringService {
  constructor() {
    this.serviceName = 'prescriptionMonitoringService';
    this.serviceAuth = null;
    this.initialized = false;
    this.monitoringActive = false;
    this.cronJob = null;

    console.log('💊 PrescriptionMonitoringService created');
  }

  /**
   * Initialize service with authentication
   */
  async initialize() {
    if (this.initialized) return;

    this.serviceAuth = await serviceAccountManager.authenticate(this.serviceName);

    if (!this.serviceAuth) {
      throw new Error('Failed to authenticate prescriptionMonitoringService');
    }

    this.initialized = true;
    console.log('✅ PrescriptionMonitoringService authenticated');
  }

  /**
   * Create secure context for database operations
   * @param {string} practiceId - Practice ID (use 'global' for global database)
   * @param {string} operation - Operation name
   * @returns {Object} Security context
   */
  createSecureContext(practiceId, operation) {
    return {
      serviceId: this.serviceName,
      operation: operation,
      practiceId: practiceId || 'global',
      apiKey: this.serviceAuth?.apiKey
    };
  }

  /**
   * Start monitoring for prescription activations
   * Runs hourly by default
   *
   * Schedule: 0 * * * * (at the top of every hour)
   */
  async start() {
    if (this.monitoringActive) {
      console.log('⚠️ PrescriptionMonitoringService already running');
      return;
    }

    if (!this.initialized) {
      await this.initialize();
    }

    this.monitoringActive = true;

    // Run monitoring immediately on startup
    console.log('🚀 Starting PrescriptionMonitoringService (first run immediate)');
    await this.runMonitoringCycle();

    // Then schedule hourly
    this.cronJob = cron.schedule('0 * * * *', async () => {
      try {
        await this.runMonitoringCycle();
      } catch (error) {
        console.error('❌ Error in prescription monitoring cycle:', error);
      }
    });

    console.log('✅ PrescriptionMonitoringService monitoring active (hourly)');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    this.monitoringActive = false;
    console.log('⏹️ PrescriptionMonitoringService stopped');
  }

  /**
   * Run one monitoring cycle
   * 1. Find all pending prescriptions where startDate <= now
   * 2. For each prescription, activate it in its practice database
   * 3. Sync to medications collection
   * 4. Update global metadata
   * 5. Find all expired medications where endDate <= now AND active = true
   * 6. Mark expired medications as inactive in practice databases
   * 7. Update global medication expiration metadata
   */
  async runMonitoringCycle() {
    console.log('⏰ [PrescriptionMonitoring] Running monitoring cycle...');

    const now = new Date();
    const startTime = Date.now();

    try {
      // ===== PART 1: PRESCRIPTION ACTIVATION =====
      // 1. Query GLOBAL database for pending prescriptions ready to activate
      const globalContext = this.createSecureContext('global', 'findPendingPrescriptions');

      const pendingPrescriptions = await SecureDataAccess.query(
        'prescriptionActivationMetadata',
        {
          status: 'pending',
          monitoringActive: true,
          startDate: { $lte: now }  // startDate <= now
        },
        {},
        globalContext
      );

      console.log(`📊 [PrescriptionMonitoring] Found ${pendingPrescriptions.length} prescription(s) ready for activation`);

      // 2. For each pending prescription, activate it
      let activatedCount = 0;
      let failedCount = 0;

      for (const metadata of pendingPrescriptions) {
        try {
          const result = await this.activatePrescription(metadata);

          if (result.success) {
            activatedCount++;
          } else {
            failedCount++;
            console.warn(`⚠️ [PrescriptionMonitoring] Failed to activate prescription ${metadata.prescriptionId}: ${result.reason}`);
          }
        } catch (error) {
          failedCount++;
          console.error(`❌ [PrescriptionMonitoring] Error activating prescription ${metadata.prescriptionId}:`, error.message);
        }
      }

      console.log(`✅ [PrescriptionMonitoring] Prescription activation complete: ${activatedCount} activated, ${failedCount} failed`);

      // ===== PART 2: MEDICATION EXPIRATION =====
      // 3. Query GLOBAL database for medications ready to expire
      const expirationContext = this.createSecureContext('global', 'findExpiringMedications');

      const expiringMedications = await SecureDataAccess.query(
        'medicationExpirationMetadata',
        {
          status: 'active',
          monitoringActive: true,
          endDate: { $lte: now }  // endDate <= now
        },
        {},
        expirationContext
      );

      console.log(`📊 [MedicationExpiration] Found ${expiringMedications.length} medication(s) ready to expire`);

      // 4. For each expiring medication, mark it as inactive
      let expiredCount = 0;
      let expireFailedCount = 0;

      for (const metadata of expiringMedications) {
        try {
          const result = await this.expireMedication(metadata);

          if (result.success) {
            expiredCount++;
          } else {
            expireFailedCount++;
            console.warn(`⚠️ [MedicationExpiration] Failed to expire medication ${metadata.medicationId}: ${result.reason}`);
          }
        } catch (error) {
          expireFailedCount++;
          console.error(`❌ [MedicationExpiration] Error expiring medication ${metadata.medicationId}:`, error.message);
        }
      }

      console.log(`✅ [MedicationExpiration] Medication expiration complete: ${expiredCount} expired, ${expireFailedCount} failed`);

      const duration = Date.now() - startTime;
      console.log(`✅ [Monitoring Cycle] Total: ${activatedCount} prescriptions activated, ${expiredCount} medications expired (${duration}ms)`);

    } catch (error) {
      console.error('❌ [PrescriptionMonitoring] Error in monitoring cycle:', error);
      console.error('   Stack:', error.stack);
    }
  }

  /**
   * Activate a single prescription
   *
   * @param {Object} metadata - Prescription metadata from global database
   * @param {string} metadata.prescriptionId - Prescription ID
   * @param {string} metadata.practiceId - Practice ID
   * @param {string} metadata.patientId - Patient ID
   * @param {Date} metadata.startDate - Prescription start date
   * @returns {Promise<Object>} {success: boolean, reason?: string}
   */
  async activatePrescription(metadata) {
    const { prescriptionId, practiceId, patientId } = metadata;

    console.log(`💊 [PrescriptionMonitoring] Activating prescription ${prescriptionId} for practice ${practiceId}`);

    try {
      // 1. Query PRACTICE database for the prescription
      const practiceContext = this.createSecureContext(practiceId, 'activatePrescription');

      // Convert prescriptionId string to ObjectId for MongoDB query
      const { ObjectId } = require('mongodb');
      const prescriptionObjectId = ObjectId.isValid(prescriptionId) ? new ObjectId(prescriptionId) : prescriptionId;

      const prescriptions = await SecureDataAccess.query(
        'prescriptions',
        { _id: prescriptionObjectId },
        { limit: 1 },
        practiceContext
      );

      if (!prescriptions || prescriptions.length === 0) {
        return { success: false, reason: 'prescription_not_found' };
      }

      const prescription = prescriptions[0];

      // 2. Update prescription status to 'active'
      const updateContext = this.createSecureContext(practiceId, 'updatePrescriptionStatus');

      await SecureDataAccess.update(
        'prescriptions',
        { _id: prescriptionObjectId },
        {
          $set: {
            status: 'active',
            updatedAt: new Date(),
            activatedAt: new Date(),
            '_securityMetadata.lastModifiedAt': new Date(),
            '_securityMetadata.lastModifiedBy': this.serviceName
          }
        },
        updateContext
      );

      console.log(`✅ [PrescriptionMonitoring] Updated prescription ${prescriptionId} to 'active' status`);

      // 3. Sync to medications collection
      try {
        const medicationService = require('./medicationService');
        await medicationService.initialize();

        const syncResult = await medicationService.syncActivePrescriptionToMedication(
          prescription._id,
          prescription,
          { subdomain: practiceId, practiceId: practiceId, userId: 'prescriptionMonitoringService' }
        );

        if (syncResult.success) {
          console.log(`✅ [PrescriptionMonitoring] Synced prescription ${prescriptionId} to medications collection`);
        } else {
          console.warn(`⚠️ [PrescriptionMonitoring] Failed to sync prescription to medications: ${syncResult.reason}`);
          // Don't fail the activation if sync fails
        }
      } catch (error) {
        console.error(`❌ [PrescriptionMonitoring] Error syncing to medications:`, error.message);
        // Don't fail the activation if sync fails
      }

      // 4. Update GLOBAL metadata to mark as activated
      const globalContext = this.createSecureContext('global', 'markPrescriptionActivated');

      await SecureDataAccess.update(
        'prescriptionActivationMetadata',
        { prescriptionId: prescriptionObjectId },
        {
          $set: {
            status: 'activated',
            monitoringActive: false,
            activatedAt: new Date(),
            updatedAt: new Date(),
            '_securityMetadata.lastModifiedAt': new Date(),
            '_securityMetadata.lastModifiedBy': this.serviceName
          }
        },
        globalContext
      );

      console.log(`✅ [PrescriptionMonitoring] Marked metadata for prescription ${prescriptionId} as activated`);

      return { success: true };

    } catch (error) {
      console.error(`❌ [PrescriptionMonitoring] Error activating prescription ${prescriptionId}:`, error.message);
      return { success: false, reason: error.message };
    }
  }

  /**
   * Expire a single medication
   *
   * @param {Object} metadata - Medication metadata from global database
   * @param {string} metadata.medicationId - Medication ID
   * @param {string} metadata.practiceId - Practice ID
   * @param {string} metadata.patientId - Patient ID
   * @param {Date} metadata.endDate - Medication end date
   * @returns {Promise<Object>} {success: boolean, reason?: string}
   */
  async expireMedication(metadata) {
    const { medicationId, practiceId, patientId } = metadata;

    console.log(`💊 [MedicationExpiration] Expiring medication ${medicationId} for practice ${practiceId}`);

    try {
      // 1. Query PRACTICE database for the medication
      const practiceContext = this.createSecureContext(practiceId, 'expireMedication');

      // Convert medicationId string to ObjectId for MongoDB query
      const { ObjectId } = require('mongodb');
      const medicationObjectId = ObjectId.isValid(medicationId) ? new ObjectId(medicationId) : medicationId;

      const medications = await SecureDataAccess.query(
        'medications',
        { _id: medicationObjectId },
        { limit: 1 },
        practiceContext
      );

      if (!medications || medications.length === 0) {
        return { success: false, reason: 'medication_not_found' };
      }

      const medication = medications[0];

      // 2. Update medication to mark as inactive (expired)
      const updateContext = this.createSecureContext(practiceId, 'updateMedicationStatus');

      await SecureDataAccess.update(
        'medications',
        { _id: medicationObjectId },
        {
          $set: {
            active: false,
            status: 'completed',
            discontinuedDate: new Date(),
            discontinuedReason: 'Automatically expired',
            updatedAt: new Date(),
            '_securityMetadata.lastModifiedAt': new Date(),
            '_securityMetadata.lastModifiedBy': this.serviceName
          }
        },
        updateContext
      );

      console.log(`✅ [MedicationExpiration] Marked medication ${medicationId} as expired (active: false, status: completed)`);

      // 3. Update GLOBAL metadata to mark as expired
      const globalContext = this.createSecureContext('global', 'markMedicationExpired');

      await SecureDataAccess.update(
        'medicationExpirationMetadata',
        { medicationId: medicationObjectId },
        {
          $set: {
            status: 'expired',
            monitoringActive: false,
            expiredAt: new Date(),
            updatedAt: new Date(),
            '_securityMetadata.lastModifiedAt': new Date(),
            '_securityMetadata.lastModifiedBy': this.serviceName
          }
        },
        globalContext
      );

      console.log(`✅ [MedicationExpiration] Updated global metadata for medication ${medicationId}`);

      return { success: true };

    } catch (error) {
      console.error(`❌ [MedicationExpiration] Error expiring medication ${medicationId}:`, error.message);
      return { success: false, reason: error.message };
    }
  }

  /**
   * Register a medication for expiration monitoring
   * Called when a medication is created with an endDate
   *
   * @param {Object} medication - Medication object
   * @param {string} practiceId - Practice ID
   * @returns {Promise<Object>} Created metadata record
   */
  async registerMedication(medication, practiceId) {
    console.log(`📝 [MedicationExpiration] Registering medication ${medication._id} for expiration monitoring`);

    if (!this.initialized) {
      await this.initialize();
    }

    // Only register if medication has an endDate
    if (!medication.endDate) {
      console.log(`⚠️ [MedicationExpiration] Medication ${medication._id} has no endDate, skipping registration`);
      return null;
    }

    // Store metadata in GLOBAL database (NO PHI)
    const metadata = {
      medicationId: medication._id,
      practiceId: practiceId,
      patientId: medication.patientId,
      endDate: new Date(medication.endDate),
      status: 'active',
      monitoringActive: true,
      registeredAt: new Date(),
      expiredAt: null,
      updatedAt: new Date(),

      // Security metadata
      _securityMetadata: {
        createdAt: new Date(),
        createdBy: this.serviceName,
        lastModifiedAt: new Date(),
        lastModifiedBy: this.serviceName,
        practiceId: 'global'
      }
    };

    const globalContext = this.createSecureContext('global', 'registerMedication');

    await SecureDataAccess.insert(
      'medicationExpirationMetadata',
      metadata,
      globalContext
    );

    console.log(`✅ [MedicationExpiration] Registered medication ${medication._id} in global metadata (endDate: ${medication.endDate})`);

    return metadata;
  }

  /**
   * Register a pending prescription for monitoring
   * Called when a new prescription is created with pending status or future startDate
   *
   * @param {Object} prescription - Prescription object
   * @param {string} practiceId - Practice ID
   * @returns {Promise<Object>} Created metadata record
   */
  async registerPrescription(prescription, practiceId) {
    console.log(`📝 [PrescriptionMonitoring] Registering prescription ${prescription._id} for monitoring`);

    if (!this.initialized) {
      await this.initialize();
    }

    // Store metadata in GLOBAL database (NO PHI)
    const metadata = {
      prescriptionId: prescription._id,
      practiceId: practiceId,
      patientId: prescription.patientId,
      startDate: new Date(prescription.startDate),
      status: 'pending',
      monitoringActive: true,
      registeredAt: new Date(),
      activatedAt: null,
      updatedAt: new Date(),

      // Security metadata
      _securityMetadata: {
        createdAt: new Date(),
        createdBy: this.serviceName,
        lastModifiedAt: new Date(),
        lastModifiedBy: this.serviceName,
        practiceId: 'global'
      }
    };

    const globalContext = this.createSecureContext('global', 'registerPrescription');

    await SecureDataAccess.insert(
      'prescriptionActivationMetadata',
      metadata,
      globalContext
    );

    console.log(`✅ [PrescriptionMonitoring] Registered prescription ${prescription._id} in global metadata`);

    return metadata;
  }

  /**
   * Get monitoring statistics
   *
   * @returns {Promise<Object>} Monitoring statistics
   */
  async getStats() {
    if (!this.initialized) {
      await this.initialize();
    }

    const globalContext = this.createSecureContext('global', 'getStats');

    // Query global metadata for stats
    const allMetadata = await SecureDataAccess.query(
      'prescriptionActivationMetadata',
      {},
      {},
      globalContext
    );

    const stats = {
      total: allMetadata.length,
      pending: allMetadata.filter(m => m.status === 'pending').length,
      activated: allMetadata.filter(m => m.status === 'activated').length,
      monitoringActive: allMetadata.filter(m => m.monitoringActive).length
    };

    return stats;
  }

  /**
   * Stop monitoring and clean up (for testing)
   */
  async destroy() {
    this.stop();
    this.initialized = false;
    this.serviceAuth = null;
  }
}

// Export singleton instance
module.exports = new PrescriptionMonitoringService();
