/**
 * Patient Medication History Module
 * Handles medication history tracking including prescriptions, dosages, and drug interactions
 */

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientMedicationHistory {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-medication-history');
    this.initialized = true;
    console.log('✅ [PatientMedicationHistory] Service initialized');
  }

  /**
   * Add medication history entry for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} medicationData - Medication history data
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Addition result
   */
  async addMedicationHistoryEntry(patientId, medicationData, practiceContext, session) {
    console.log('💊 [PatientMedicationHistory] Adding medication history entry:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      const validation = this.validateMedicationData(medicationData);
      if (!validation.success) {
        return validation;
      }

      // Check for drug interactions
      const interactionCheck = await this.checkDrugInteractions(patientId, medicationData.medicationName, practiceContext);

      const medicationEntry = {
        patientId,
        ...validation.processedData,
        interactions: interactionCheck.interactions || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: session?.userId || 'system',
        practiceId: practiceContext.practiceId
      };

      const context = {
        serviceId: 'patient-medication-history',
        operation: 'add-medication-history',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.create('medication_history', medicationEntry, context);

      // Create audit trail
      await this.createAuditTrail(patientId, 'ADD_MEDICATION_HISTORY', medicationData, session, practiceContext);

      return {
        success: true,
        medicationEntry: result,
        interactionWarnings: interactionCheck.interactions || [],
        message: 'Medication history entry added successfully'
      };

    } catch (error) {
      console.error('❌ [PatientMedicationHistory] Add entry failed:', error);
      return {
        success: false,
        error: 'ADD_MEDICATION_HISTORY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Get medication history for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} practiceContext - Practice context
   * @param {Object} options - Query options
   * @returns {Object} Medication history
   */
  async getMedicationHistory(patientId, practiceContext, options = {}) {
    console.log('💊 [PatientMedicationHistory] Getting medication history:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      const context = {
        serviceId: 'patient-medication-history',
        operation: 'get-medication-history',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const queryOptions = {
        sort: { startDate: -1, createdAt: -1 },
        limit: options.limit || 100,
        skip: options.skip || 0
      };

      const query = { patientId };
      
      // Filter by medication name if specified
      if (options.medicationName) {
        query.medicationName = { $regex: options.medicationName, $options: 'i' };
      }
      
      // Filter by status if specified
      if (options.status) {
        query.status = options.status;
      }

      // Filter by date range if specified
      if (options.dateFrom || options.dateTo) {
        query.startDate = {};
        if (options.dateFrom) query.startDate.$gte = new Date(options.dateFrom);
        if (options.dateTo) query.startDate.$lte = new Date(options.dateTo);
      }

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const results = await SecureDataAccess.query('medication_history', query, queryOptions, context);

      // Get current active medications
      const activeMedications = results.filter(med => med.status === 'active');
      
      // Calculate medication adherence profile
      const adherenceProfile = this.calculateAdherenceProfile(results);

      return {
        success: true,
        medicationHistory: results,
        activeMedications,
        adherenceProfile,
        totalCount: results.length,
        message: 'Medication history retrieved successfully'
      };

    } catch (error) {
      console.error('❌ [PatientMedicationHistory] Get medication history failed:', error);
      return {
        success: false,
        error: 'GET_MEDICATION_HISTORY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Update medication history entry
   * @param {string} entryId - Medication history entry ID
   * @param {Object} updateData - Data to update
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Update result
   */
  async updateMedicationHistoryEntry(entryId, updateData, practiceContext, session) {
    console.log('💊 [PatientMedicationHistory] Updating medication history entry:', entryId);

    try {
      const validation = this.validateMedicationData(updateData, true);
      if (!validation.success) {
        return validation;
      }

      const updateRecord = {
        ...validation.processedData,
        updatedAt: new Date(),
        updatedBy: session?.userId || 'system'
      };

      const context = {
        serviceId: 'patient-medication-history',
        operation: 'update-medication-history',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.update(
        'medication_history',
        { _id: entryId },
        updateRecord,
        context
      );

      if (!result || result.matchedCount === 0) {
        return {
          success: false,
          error: 'ENTRY_NOT_FOUND',
          message: 'Medication history entry not found'
        };
      }

      return {
        success: true,
        updatedCount: result.modifiedCount,
        message: 'Medication history entry updated successfully'
      };

    } catch (error) {
      console.error('❌ [PatientMedicationHistory] Update entry failed:', error);
      return {
        success: false,
        error: 'UPDATE_MEDICATION_HISTORY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Check for drug interactions
   */
  async checkDrugInteractions(patientId, newMedication, practiceContext) {
    try {
      const currentMedications = await this.getMedicationHistory(patientId, practiceContext, { status: 'active' });
      
      if (!currentMedications.success) {
        return { interactions: [] };
      }

      const interactions = [];
      
      // Simple interaction checking (in real implementation, would use drug database)
      const knownInteractions = {
        'warfarin': ['aspirin', 'ibuprofen', 'amoxicillin'],
        'metformin': ['alcohol', 'furosemide'],
        'simvastatin': ['amlodipine', 'clarithromycin'],
        'lisinopril': ['potassium', 'spironolactone']
      };

      const newMedLower = newMedication.toLowerCase();
      
      currentMedications.activeMedications.forEach(med => {
        const currentMedLower = med.medicationName.toLowerCase();
        
        // Check if new med interacts with current med
        if (knownInteractions[newMedLower] && knownInteractions[newMedLower].includes(currentMedLower)) {
          interactions.push({
            medication1: newMedication,
            medication2: med.medicationName,
            severity: 'moderate',
            description: `Potential interaction between ${newMedication} and ${med.medicationName}`
          });
        }
        
        // Check if current med interacts with new med
        if (knownInteractions[currentMedLower] && knownInteractions[currentMedLower].includes(newMedLower)) {
          interactions.push({
            medication1: med.medicationName,
            medication2: newMedication,
            severity: 'moderate',
            description: `Potential interaction between ${med.medicationName} and ${newMedication}`
          });
        }
      });

      return { interactions };

    } catch (error) {
      console.error('❌ [PatientMedicationHistory] Interaction check failed:', error);
      return { interactions: [] };
    }
  }

  /**
   * Validate medication data
   */
  validateMedicationData(data, isUpdate = false) {
    const errors = [];
    const processedData = {};

    // Required fields for new entries
    if (!isUpdate) {
      if (!data.medicationName) {
        errors.push('Medication name is required');
      }
      if (!data.startDate) {
        errors.push('Start date is required');
      }
    }

    // Validate medication name
    if (data.medicationName) {
      processedData.medicationName = data.medicationName.trim();
    }

    // Validate dates
    if (data.startDate) {
      const startDate = new Date(data.startDate);
      if (isNaN(startDate.getTime())) {
        errors.push('Invalid start date format');
      } else {
        processedData.startDate = startDate;
      }
    }

    if (data.endDate) {
      const endDate = new Date(data.endDate);
      if (isNaN(endDate.getTime())) {
        errors.push('Invalid end date format');
      } else if (data.startDate && endDate < new Date(data.startDate)) {
        errors.push('End date cannot be before start date');
      } else {
        processedData.endDate = endDate;
      }
    }

    // Validate status
    if (data.status) {
      const validStatuses = ['active', 'discontinued', 'completed', 'on_hold'];
      if (validStatuses.includes(data.status)) {
        processedData.status = data.status;
      } else {
        errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
    }

    // Validate frequency
    if (data.frequency) {
      const validFrequencies = ['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'as_needed', 'weekly', 'monthly'];
      if (validFrequencies.includes(data.frequency)) {
        processedData.frequency = data.frequency;
      } else {
        errors.push(`Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`);
      }
    }

    // Validate route
    if (data.route) {
      const validRoutes = ['oral', 'iv', 'im', 'subcutaneous', 'topical', 'inhalation', 'rectal', 'sublingual'];
      if (validRoutes.includes(data.route)) {
        processedData.route = data.route;
      } else {
        errors.push(`Invalid route. Must be one of: ${validRoutes.join(', ')}`);
      }
    }

    // Optional text fields
    ['dosage', 'strength', 'prescribedBy', 'pharmacy', 'indication', 'notes', 'ndcCode', 'rxNumber'].forEach(field => {
      if (data[field]) {
        processedData[field] = data[field].toString().trim();
      }
    });

    // Numeric fields
    if (data.quantityPrescribed) {
      const quantity = parseFloat(data.quantityPrescribed);
      if (!isNaN(quantity) && quantity > 0) {
        processedData.quantityPrescribed = quantity;
      }
    }

    if (data.refillsRemaining) {
      const refills = parseInt(data.refillsRemaining);
      if (!isNaN(refills) && refills >= 0) {
        processedData.refillsRemaining = refills;
      }
    }

    return {
      success: errors.length === 0,
      errors,
      processedData,
      message: errors.length === 0 ? 'Validation passed' : 'Validation failed'
    };
  }

  /**
   * Calculate medication adherence profile
   */
  calculateAdherenceProfile(medicationHistory) {
    const profile = {
      totalMedications: medicationHistory.length,
      activeMedications: 0,
      discontinuedMedications: 0,
      completedMedications: 0,
      adherenceScore: 0,
      commonMedications: {}
    };

    let adherenceSum = 0;
    let adherenceCount = 0;

    medicationHistory.forEach(med => {
      // Count by status
      if (med.status === 'active') profile.activeMedications++;
      else if (med.status === 'discontinued') profile.discontinuedMedications++;
      else if (med.status === 'completed') profile.completedMedications++;

      // Track common medications
      const medName = med.medicationName || 'Unknown';
      profile.commonMedications[medName] = (profile.commonMedications[medName] || 0) + 1;

      // Calculate adherence (simplified)
      if (med.adherenceScore && typeof med.adherenceScore === 'number') {
        adherenceSum += med.adherenceScore;
        adherenceCount++;
      }
    });

    // Calculate average adherence score
    if (adherenceCount > 0) {
      profile.adherenceScore = (adherenceSum / adherenceCount).toFixed(1);
    }

    return profile;
  }

  /**
   * Create audit trail for medication history operations
   */
  async createAuditTrail(patientId, action, data, session, practiceContext) {
    const auditRecord = {
      action,
      patientId,
      data: { 
        medicationName: data.medicationName, 
        dosage: data.dosage,
        startDate: data.startDate 
      },
      userId: session?.userId || 'system',
      timestamp: new Date(),
      practiceId: practiceContext.practiceId
    };

    console.log('📝 [PatientMedicationHistory] Audit trail created:', auditRecord);
  }
}

// Create singleton instance
const patientMedicationHistory = new PatientMedicationHistory();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientMedicationHistory', () => patientMedicationHistory);
}

module.exports = patientMedicationHistory;