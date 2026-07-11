/**
 * Patient Medical History Module
 * Handles comprehensive medical history management including conditions, treatments, and outcomes
 */

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientMedicalHistory {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-medical-history');
    this.initialized = true;
    console.log('✅ [PatientMedicalHistory] Service initialized');
  }

  /**
   * Add medical history entry for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} historyData - Medical history data
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Addition result
   */
  async addMedicalHistoryEntry(patientId, historyData, practiceContext, session) {
    console.log('📋 [PatientMedicalHistory] Adding medical history entry:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      const validation = this.validateMedicalHistoryData(historyData);
      if (!validation.success) {
        return validation;
      }

      const historyEntry = {
        patientId,
        ...validation.processedData,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: session?.userId || 'system',
        practiceId: practiceContext.practiceId
      };

      const context = {
        serviceId: 'patient-medical-history',
        operation: 'add-history-entry',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.create('medical_history', historyEntry, context);

      // Create audit trail
      await this.createAuditTrail(patientId, 'ADD_MEDICAL_HISTORY', historyData, session, practiceContext);

      return {
        success: true,
        historyEntry: result,
        message: 'Medical history entry added successfully'
      };

    } catch (error) {
      console.error('❌ [PatientMedicalHistory] Add entry failed:', error);
      return {
        success: false,
        error: 'ADD_ENTRY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Get complete medical history for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} practiceContext - Practice context
   * @param {Object} options - Query options
   * @returns {Object} Medical history
   */
  async getMedicalHistory(patientId, practiceContext, options = {}) {
    console.log('📋 [PatientMedicalHistory] Getting medical history:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      const context = {
        serviceId: 'patient-medical-history',
        operation: 'get-medical-history',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const queryOptions = {
        sort: { dateRecorded: -1, createdAt: -1 },
        limit: options.limit || 100,
        skip: options.skip || 0
      };

      const query = { patientId };
      
      // Filter by category if specified
      if (options.category) {
        query.category = options.category;
      }
      
      // Filter by date range if specified
      if (options.dateFrom || options.dateTo) {
        query.dateRecorded = {};
        if (options.dateFrom) query.dateRecorded.$gte = new Date(options.dateFrom);
        if (options.dateTo) query.dateRecorded.$lte = new Date(options.dateTo);
      }

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const results = await SecureDataAccess.query('medical_history', query, queryOptions, context);

      return {
        success: true,
        medicalHistory: results,
        totalCount: results.length,
        message: 'Medical history retrieved successfully'
      };

    } catch (error) {
      console.error('❌ [PatientMedicalHistory] Get history failed:', error);
      return {
        success: false,
        error: 'GET_HISTORY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Update medical history entry
   * @param {string} entryId - History entry ID
   * @param {Object} updateData - Data to update
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Update result
   */
  async updateMedicalHistoryEntry(entryId, updateData, practiceContext, session) {
    console.log('📋 [PatientMedicalHistory] Updating medical history entry:', entryId);

    try {
      const validation = this.validateMedicalHistoryData(updateData, true);
      if (!validation.success) {
        return validation;
      }

      const updateRecord = {
        ...validation.processedData,
        updatedAt: new Date(),
        updatedBy: session?.userId || 'system'
      };

      const context = {
        serviceId: 'patient-medical-history',
        operation: 'update-history-entry',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.update(
        'medical_history',
        { _id: entryId },
        updateRecord,
        context
      );

      if (!result || result.matchedCount === 0) {
        return {
          success: false,
          error: 'ENTRY_NOT_FOUND',
          message: 'Medical history entry not found'
        };
      }

      return {
        success: true,
        updatedCount: result.modifiedCount,
        message: 'Medical history entry updated successfully'
      };

    } catch (error) {
      console.error('❌ [PatientMedicalHistory] Update entry failed:', error);
      return {
        success: false,
        error: 'UPDATE_ENTRY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Validate medical history data
   */
  validateMedicalHistoryData(data, isUpdate = false) {
    const errors = [];
    const processedData = {};

    // Required fields for new entries
    if (!isUpdate) {
      if (!data.condition && !data.diagnosis) {
        errors.push('Either condition or diagnosis is required');
      }
      if (!data.dateRecorded) {
        errors.push('Date recorded is required');
      }
    }

    // Validate specific fields if provided
    if (data.condition) {
      processedData.condition = data.condition.trim();
    }

    if (data.diagnosis) {
      processedData.diagnosis = data.diagnosis.trim();
    }

    if (data.dateRecorded) {
      const recordedDate = new Date(data.dateRecorded);
      if (isNaN(recordedDate.getTime())) {
        errors.push('Invalid date recorded format');
      } else if (recordedDate > new Date()) {
        errors.push('Date recorded cannot be in the future');
      } else {
        processedData.dateRecorded = recordedDate;
      }
    }

    if (data.category) {
      const validCategories = [
        'chronic_condition', 'acute_condition', 'surgical_history', 'hospitalization',
        'diagnosis', 'treatment', 'medication', 'allergy', 'family_history', 'other'
      ];
      if (validCategories.includes(data.category)) {
        processedData.category = data.category;
      } else {
        errors.push(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
      }
    }

    if (data.severity) {
      const validSeverities = ['mild', 'moderate', 'severe', 'critical'];
      if (validSeverities.includes(data.severity)) {
        processedData.severity = data.severity;
      } else {
        errors.push(`Invalid severity. Must be one of: ${validSeverities.join(', ')}`);
      }
    }

    if (data.status) {
      const validStatuses = ['active', 'resolved', 'chronic', 'in_remission', 'monitoring'];
      if (validStatuses.includes(data.status)) {
        processedData.status = data.status;
      } else {
        errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
    }

    // Optional fields
    ['notes', 'treatment', 'provider', 'icdCode', 'snomedCode'].forEach(field => {
      if (data[field]) {
        processedData[field] = data[field].toString().trim();
      }
    });

    return {
      success: errors.length === 0,
      errors,
      processedData,
      message: errors.length === 0 ? 'Validation passed' : 'Validation failed'
    };
  }

  /**
   * Create audit trail for medical history operations
   */
  async createAuditTrail(patientId, action, data, session, practiceContext) {
    const auditRecord = {
      action,
      patientId,
      data: { condition: data.condition, diagnosis: data.diagnosis },
      userId: session?.userId || 'system',
      timestamp: new Date(),
      practiceId: practiceContext.practiceId
    };

    console.log('📝 [PatientMedicalHistory] Audit trail created:', auditRecord);
  }
}

// Create singleton instance
const patientMedicalHistory = new PatientMedicalHistory();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientMedicalHistory', () => patientMedicalHistory);
}

module.exports = patientMedicalHistory;