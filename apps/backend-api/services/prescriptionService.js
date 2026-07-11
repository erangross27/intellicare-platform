/**
 * PrescriptionService
 *
 * Domain: prescription
 * Extracted from: agentServiceV4.js
 * Functions: 8
 *
 * Purpose: Handle all prescription-related operations including creation, refills, and validation
 *
 * Architecture:
 * - Uses SecureDataAccess for all database operations (no HTTP calls)
 * - Practice-aware multi-tenant isolation
 * - Proper error handling and logging
 * - Service authentication via ServiceAccountManager
 */

const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const { ObjectId } = require('mongodb');

class PrescriptionService {
  constructor() {
    this.serviceName = 'prescriptionService';
    this.serviceAuth = null;
  }

  /**
   * Initialize service with authentication
   */
  async initialize() {
    if (!this.serviceAuth) {
      this.serviceAuth = await serviceAccountManager.authenticate(this.serviceName);
      console.log(`✅ ${this.serviceName} authenticated successfully`);
    }
    return this.serviceAuth;
  }

  /**
   * Create secure context for database operations
   * @param {Object} practiceContext - Practice context from request
   * @param {string} operation - Operation name
   * @returns {Object} Security context
   */
  createSecureContext(practiceContext, operation) {
    return {
      serviceId: this.serviceName,
      operation: operation,
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId || practiceContext?.id || 'global',
      apiKey: this.serviceAuth?.apiKey || this.serviceAuth
    };
  }

  /**
   * Normalize practice context to ensure consistent format
   * @param {Object} practiceContext - Raw practice context
   * @returns {Object} Normalized practice context
   */
  normalizePracticeContext(practiceContext) {
    if (!practiceContext) {
      return { id: 'global', subdomain: 'global' };
    }

    return {
      id: practiceContext.practiceId || practiceContext.id || 'global',
      subdomain: practiceContext.subdomain || practiceContext.practiceSubdomain || 'global',
      name: practiceContext.name || practiceContext.practiceName,
      language: practiceContext.language || 'en'
    };
  }

  // ============================================================================
  // SERVICE FUNCTIONS - EXTRACTED FROM agentServiceV4.js
  // ============================================================================

async createPrescription(params, practiceContext) {
    // CRITICAL FIX: Convert patientId to ObjectId for proper database storage
    let patientId = params.patientId;
    if (typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)) {
      patientId = new ObjectId(patientId);
    }

    // BACKWARD COMPATIBILITY FIX: Handle both medications array AND individual medication fields
    // If params.medications doesn't exist but individual fields do, build the medications array
    let medications = params.medications;
    if (!medications && (params.medicationName || params.name)) {
      console.log('[createPrescription] Building medications array from individual fields (backward compatibility)');
      medications = [{
        medicationName: params.medicationName || params.name,
        genericName: params.genericName,
        dosage: params.dosage,
        strength: params.strength,
        unit: params.unit,
        frequency: params.frequency,
        route: params.route,
        duration: params.duration,
        indication: params.indication,
        instructions: params.instructions,
        prescriber: params.prescriber || params.prescribedBy,
        drugInteractions: params.drugInteractions,
        safetyWarning: params.safetyWarning,
        documentId: params.documentId
      }];
      // Remove undefined fields
      medications = medications.map(med => {
        const cleanMed = {};
        Object.keys(med).forEach(key => {
          if (med[key] !== undefined) cleanMed[key] = med[key];
        });
        return cleanMed;
      });
    }

    // DUPLICATE DETECTION: Check for existing active prescriptions with same medication
    // Extract medication names from params to check for duplicates
    const incomingMedications = Array.isArray(medications) ? medications : [];
    if (incomingMedications.length > 0) {
      const duplicateCheckContext = {
        serviceId: this.serviceName,
        operation: 'check_duplicate_prescription',
        practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      // Get all active prescriptions for this patient
      const existingPrescriptions = await SecureDataAccess.query(
        'prescriptions',
        {
          patientId: patientId,
          status: { $in: ['active', 'pending'] }  // Check both active and pending
        },
        { limit: 100 },
        duplicateCheckContext
      );

      // Check for duplicates by medication name
      for (const existingRx of existingPrescriptions) {
        let existingMeds = existingRx.medications;
        if (typeof existingMeds === 'string') {
          try { existingMeds = JSON.parse(existingMeds); } catch(e) { existingMeds = []; }
        }

        if (Array.isArray(existingMeds)) {
          for (const existingMed of existingMeds) {
            // Extract medication name (handle both string and object formats)
            let existingName = existingMed.name || existingMed.medicationName;
            if (typeof existingName === 'object') {
              existingName = existingName.genericName || existingName.name;
            }

            // Check against incoming medications
            for (const incomingMed of incomingMedications) {
              let incomingName = incomingMed.name || incomingMed.medicationName;
              if (typeof incomingName === 'object') {
                incomingName = incomingName.genericName || incomingName.name;
              }

              if (existingName && incomingName && existingName.toLowerCase() === incomingName.toLowerCase()) {
                console.warn(`⚠️ [createPrescription] Duplicate prescription detected: ${incomingName} already exists for patient ${patientId}`);
                return {
                  success: false,
                  error: 'duplicate_prescription',
                  message: practiceContext.language === 'he'
                    ? `המרשם עבור ${incomingName} כבר קיים למטופל זה`
                    : `Prescription for ${incomingName} already exists for this patient`,
                  existingPrescriptionId: existingRx._id
                };
              }
            }
          }
        }
      }
    }

    // CRITICAL FIX: Determine prescription status based on startDate
    // If startDate is in the future, prescription should be 'pending'
    // If startDate is now or in the past, prescription should be 'active'
    let prescriptionStatus = params.status || 'active';
    const startDate = params.startDate ? new Date(params.startDate) : new Date();
    const now = new Date();

    // Only auto-determine status if not explicitly provided
    if (!params.status) {
      if (startDate > now) {
        console.log(`[createPrescription] startDate is in future (${startDate}), setting status to 'pending'`);
        prescriptionStatus = 'pending';
      } else {
        console.log(`[createPrescription] startDate is now or past (${startDate}), setting status to 'active'`);
        prescriptionStatus = 'active';
      }
    }

    const prescriptionData = {
      patientId: patientId,  // Now stored as ObjectId, not string
      medications: medications,  // UPDATED: Use normalized medications array (supports both formats)
      instructions: params.instructions,
      startDate: startDate.toISOString(), // When patient should start taking medication
      validUntil: params.validUntil || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // Default 90 days
      refills: params.refills || 0,
      prescribedBy: practiceContext.userId || 'agent',
      // ✅ Removed prescribedDate - SecureDataAccess will add createdAt in practice local time
      status: prescriptionStatus // CRITICAL: Auto-set based on startDate if not provided
    };

    const createPrescriptionContext = {
      serviceId: this.serviceName,
      operation: 'create_prescription',
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
      apiKey: this.serviceAuth?.apiKey || this.serviceToken
    };

    const newPrescription = await SecureDataAccess.insert(
      'prescriptions',
      prescriptionData,  // ✅ Removed manual createdAt/updatedAt - SecureDataAccess handles timestamps automatically
      createPrescriptionContext
    );

    // NOTE: Removed DUAL WRITE to patient.prescriptions array (November 2025)
    // Prescriptions are stored in the 'prescriptions' collection only.
    // getPrescriptions() queries by patientId - no embedded data needed.
    // This follows proper MongoDB document model (reference pattern).

    // CRITICAL FIX: Sync active prescription to medications collection
    // When prescription is created with status='active', automatically create corresponding medication entry
    if (prescriptionData.status === 'active') {
      try {
        const medicationService = require('./medicationService');
        await medicationService.initialize();

        const syncResult = await medicationService.syncActivePrescriptionToMedication(
          newPrescription._id,
          newPrescription,
          practiceContext
        );

        if (syncResult.success) {
          console.log(`✅ [createPrescription] Synced prescription ${newPrescription._id} to medications collection`);
        } else {
          console.warn(`⚠️ [createPrescription] Failed to sync prescription to medications: ${syncResult.reason || syncResult.error}`);
        }
      } catch (error) {
        console.error('Error syncing prescription to medications:', error);
        // Don't fail the prescription creation if sync fails
      }
    }

    // CRITICAL FIX: Register pending prescriptions for monitoring
    // If prescription is pending (startDate in future), register it for automatic activation
    if (prescriptionData.status === 'pending') {
      try {
        const prescriptionMonitoringService = require('./prescriptionMonitoringService');
        await prescriptionMonitoringService.initialize();

        const metadata = await prescriptionMonitoringService.registerPrescription(
          newPrescription,
          practiceContext?.subdomain || practiceContext?.practiceId
        );

        if (metadata) {
          console.log(`✅ [createPrescription] Registered pending prescription ${newPrescription._id} for monitoring`);
        }
      } catch (error) {
        console.error('Error registering prescription for monitoring:', error);
        // Don't fail the prescription creation if registration fails
      }
    }

    return {
      success: true,
      data: newPrescription,
      prescriptionId: newPrescription._id || newPrescription.prescriptionId,
      message: practiceContext.language === 'he'
        ? `המרשם נוצר בהצלחה`
        : `Prescription created successfully`
    };
  }

async getPrescriptions(params, practiceContext, session) {
    let { patientId, nationalId, status = 'active' } = params;

    // Priority: Use nationalId if provided (more user-friendly)
    if (nationalId && !patientId) {
      console.log(`🔍 Looking up patient by National ID for prescriptions: ${nationalId}`);

      // Get patientService via serviceProxyManager
      const serviceProxyManager = require('./serviceProxyManager');
      const patientService = serviceProxyManager.get('patientService');

      if (!patientService) {
        throw new Error('patientService not available');
      }

      const searchResult = await patientService.searchPatients({
        query: nationalId
      }, practiceContext, session);

      if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
        // Use _id field from search result
        patientId = searchResult.data[0]._id;
        const patientName = `${searchResult.data[0].firstName || ''} ${searchResult.data[0].lastName || ''}`.trim() || searchResult.data[0].name || 'Unknown';
        console.log(`✅ Found patient for prescriptions: ${patientName} (${patientId})`);
      } else {
        throw new Error(practiceContext.language === 'he'
          ? `לא נמצא מטופל עם תעודת זהות ${nationalId}`
          : `No patient found with National ID ${nationalId}`);
      }
    }

    // Validate patientId exists
    if (!patientId) {
      throw new Error(practiceContext.language === 'he'
        ? 'נדרש מזהה מטופל או תעודת זהות'
        : 'Patient ID or National ID required');
    }

    // Convert patientId to ObjectId if it's a valid hex string
    let patientObjId = patientId;
    if (typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)) {
      patientObjId = new ObjectId(patientId);
    }

    const getPrescriptionsContext = {
      serviceId: this.serviceName,
      operation: 'get_prescriptions',
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
      apiKey: this.serviceAuth?.apiKey || this.serviceToken
    };

    // Build filter - now prescriptions are stored with ObjectId patientId
    const filter = { patientId: patientObjId };

    // Add status filter
    if (status && status !== 'all' && status !== 'active') {
      // Only filter by status if it's something specific like 'expired' or 'cancelled'
      filter.status = status;
    } else if (status === 'active') {
      // For 'active' status, include BOTH status='active' AND missing status field
      filter.$or = [
        { status: 'active' },
        { status: { $exists: false } }  // Include prescriptions without status field (legacy)
      ];
    }

    const prescriptions = await SecureDataAccess.query(
      'prescriptions',
      filter,
      { sort: { prescribedDate: -1 } },
      getPrescriptionsContext
    );

    return {
      success: true,
      data: prescriptions,
      count: prescriptions.length,
      message: practiceContext.language === 'he'
        ? `נמצאו ${prescriptions.length} מרשמים`
        : `Found ${prescriptions.length} prescriptions`,
      displayType: 'openArtifactPanel',
      artifactPanel: {
        patientId: patientObjId.toString(),
        category: 'prescriptions',
        type: 'documents',
        data: prescriptions
      }
    };
  }

async updatePrescription(params, practiceContext) {
    const { recordId, patientId, medicationName, updates } = params;

    const updatePrescriptionContext = {
      serviceId: this.serviceName,
      operation: 'update_prescription',
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
      apiKey: this.serviceAuth?.apiKey || this.serviceToken
    };

    // Determine which prescription to update
    let filter;

    if (recordId) {
      // Option 1: Direct update by prescription _id
      if (!ObjectId.isValid(recordId)) {
        return {
          success: false,
          error: 'Invalid prescription ID format.',
          message: practiceContext.language === 'he'
            ? `פורמט מזהה מרשם לא תקין.`
            : `Invalid prescription ID format.`
        };
      }
      filter = { _id: new ObjectId(recordId) };

    } else if (patientId) {
      // Option 2: Find prescription by patientId (and optionally medication name)
      filter = {
        $or: [
          { patientId: patientId },  // String format
          { patientId: new ObjectId(patientId) }  // ObjectId format
        ]
      };

      // If medication name provided, filter by that too
      if (medicationName) {
        filter['medications.name'] = { $regex: new RegExp(medicationName, 'i') };
      }

    } else {
      return {
        success: false,
        error: 'Must provide either recordId or patientId',
        message: practiceContext.language === 'he'
          ? `חובה לספק recordId או patientId`
          : `Must provide either recordId (prescription ID) or patientId (patient ID)`
      };
    }

    // Add updatedAt timestamp
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };

    const result = await SecureDataAccess.update(
      'prescriptions',
      filter,
      { $set: updateData },
      updatePrescriptionContext
    );

    // Fetch the updated prescription to get full details for further processing
    let updatedPrescription = null;
    try {
      const updatedPrescriptions = await SecureDataAccess.query(
        'prescriptions',
        filter,
        { limit: 1 },
        updatePrescriptionContext
      );
      if (updatedPrescriptions && updatedPrescriptions.length > 0) {
        updatedPrescription = updatedPrescriptions[0];
      }
    } catch (error) {
      console.error('[updatePrescription] Error fetching updated prescription:', error);
    }

    // CRITICAL FIX: If status changed to 'active', sync to medications collection
    if (updates.status === 'active' && updatedPrescription) {
      try {
        const medicationService = require('./medicationService');
        await medicationService.initialize();

        const syncResult = await medicationService.syncActivePrescriptionToMedication(
          updatedPrescription._id,
          updatedPrescription,
          practiceContext
        );

        if (syncResult.success) {
          console.log(`✅ [updatePrescription] Synced prescription ${updatedPrescription._id} to medications collection (status changed to active)`);
        } else {
          console.warn(`⚠️ [updatePrescription] Failed to sync prescription to medications: ${syncResult.reason || syncResult.error}`);
        }
      } catch (error) {
        console.error('[updatePrescription] Error syncing prescription to medications:', error);
        // Don't fail the prescription update if sync fails
      }
    }

    // CRITICAL FIX: If status changed to 'pending', register for monitoring
    if (updates.status === 'pending' && updatedPrescription) {
      try {
        const prescriptionMonitoringService = require('./prescriptionMonitoringService');
        await prescriptionMonitoringService.initialize();

        const metadata = await prescriptionMonitoringService.registerPrescription(
          updatedPrescription,
          practiceContext?.subdomain || practiceContext?.practiceId
        );

        if (metadata) {
          console.log(`✅ [updatePrescription] Registered prescription ${updatedPrescription._id} for monitoring (status changed to pending)`);
        }
      } catch (error) {
        console.error('[updatePrescription] Error registering prescription for monitoring:', error);
        // Don't fail the prescription update if registration fails
      }
    }

    return {
      success: true,
      data: result,
      message: practiceContext.language === 'he'
        ? `המרשם עודכן בהצלחה`
        : `Prescription updated successfully`
    };
  }

}

module.exports = new PrescriptionService();
