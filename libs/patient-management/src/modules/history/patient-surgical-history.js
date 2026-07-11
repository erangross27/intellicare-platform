/**
 * Patient Surgical History Module
 * Handles surgical procedures, operations, and post-operative care tracking
 */

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientSurgicalHistory {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-surgical-history');
    this.initialized = true;
    console.log('✅ [PatientSurgicalHistory] Service initialized');
  }

  /**
   * Add surgical history entry for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} surgicalData - Surgical history data
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Addition result
   */
  async addSurgicalHistoryEntry(patientId, surgicalData, practiceContext, session) {
    console.log('🏥 [PatientSurgicalHistory] Adding surgical history entry:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      const validation = this.validateSurgicalData(surgicalData);
      if (!validation.success) {
        return validation;
      }

      const surgicalEntry = {
        patientId,
        ...validation.processedData,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: session?.userId || 'system',
        practiceId: practiceContext.practiceId
      };

      const context = {
        serviceId: 'patient-surgical-history',
        operation: 'add-surgical-history',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.create('surgical_history', surgicalEntry, context);

      // Create audit trail
      await this.createAuditTrail(patientId, 'ADD_SURGICAL_HISTORY', surgicalData, session, practiceContext);

      return {
        success: true,
        surgicalEntry: result,
        message: 'Surgical history entry added successfully'
      };

    } catch (error) {
      console.error('❌ [PatientSurgicalHistory] Add entry failed:', error);
      return {
        success: false,
        error: 'ADD_SURGICAL_HISTORY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Get surgical history for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} practiceContext - Practice context
   * @param {Object} options - Query options
   * @returns {Object} Surgical history
   */
  async getSurgicalHistory(patientId, practiceContext, options = {}) {
    console.log('🏥 [PatientSurgicalHistory] Getting surgical history:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      const context = {
        serviceId: 'patient-surgical-history',
        operation: 'get-surgical-history',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const queryOptions = {
        sort: { surgeryDate: -1, createdAt: -1 },
        limit: options.limit || 100,
        skip: options.skip || 0
      };

      const query = { patientId };
      
      // Filter by procedure type if specified
      if (options.procedureType) {
        query.procedureType = options.procedureType;
      }
      
      // Filter by date range if specified
      if (options.dateFrom || options.dateTo) {
        query.surgeryDate = {};
        if (options.dateFrom) query.surgeryDate.$gte = new Date(options.dateFrom);
        if (options.dateTo) query.surgeryDate.$lte = new Date(options.dateTo);
      }

      // Filter by surgeon if specified
      if (options.surgeon) {
        query.surgeon = { $regex: options.surgeon, $options: 'i' };
      }

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const results = await SecureDataAccess.query('surgical_history', query, queryOptions, context);

      // Calculate surgical risk profile
      const riskProfile = this.calculateSurgicalRiskProfile(results);

      return {
        success: true,
        surgicalHistory: results,
        riskProfile,
        totalCount: results.length,
        message: 'Surgical history retrieved successfully'
      };

    } catch (error) {
      console.error('❌ [PatientSurgicalHistory] Get surgical history failed:', error);
      return {
        success: false,
        error: 'GET_SURGICAL_HISTORY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Update surgical history entry
   * @param {string} entryId - Surgical history entry ID
   * @param {Object} updateData - Data to update
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Update result
   */
  async updateSurgicalHistoryEntry(entryId, updateData, practiceContext, session) {
    console.log('🏥 [PatientSurgicalHistory] Updating surgical history entry:', entryId);

    try {
      const validation = this.validateSurgicalData(updateData, true);
      if (!validation.success) {
        return validation;
      }

      const updateRecord = {
        ...validation.processedData,
        updatedAt: new Date(),
        updatedBy: session?.userId || 'system'
      };

      const context = {
        serviceId: 'patient-surgical-history',
        operation: 'update-surgical-history',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.update(
        'surgical_history',
        { _id: entryId },
        updateRecord,
        context
      );

      if (!result || result.matchedCount === 0) {
        return {
          success: false,
          error: 'ENTRY_NOT_FOUND',
          message: 'Surgical history entry not found'
        };
      }

      return {
        success: true,
        updatedCount: result.modifiedCount,
        message: 'Surgical history entry updated successfully'
      };

    } catch (error) {
      console.error('❌ [PatientSurgicalHistory] Update entry failed:', error);
      return {
        success: false,
        error: 'UPDATE_SURGICAL_HISTORY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Validate surgical history data
   */
  validateSurgicalData(data, isUpdate = false) {
    const errors = [];
    const processedData = {};

    // Required fields for new entries
    if (!isUpdate) {
      if (!data.procedureName) {
        errors.push('Procedure name is required');
      }
      if (!data.surgeryDate) {
        errors.push('Surgery date is required');
      }
    }

    // Validate procedure name
    if (data.procedureName) {
      processedData.procedureName = data.procedureName.trim();
    }

    // Validate surgery date
    if (data.surgeryDate) {
      const surgeryDate = new Date(data.surgeryDate);
      if (isNaN(surgeryDate.getTime())) {
        errors.push('Invalid surgery date format');
      } else if (surgeryDate > new Date()) {
        errors.push('Surgery date cannot be in the future');
      } else {
        processedData.surgeryDate = surgeryDate;
      }
    }

    // Validate procedure type
    if (data.procedureType) {
      const validTypes = [
        'cardiac', 'orthopedic', 'neurological', 'general', 'gynecological',
        'urological', 'plastic', 'vascular', 'thoracic', 'ophthalmic', 'ent', 'other'
      ];
      if (validTypes.includes(data.procedureType)) {
        processedData.procedureType = data.procedureType;
      } else {
        errors.push(`Invalid procedure type. Must be one of: ${validTypes.join(', ')}`);
      }
    }

    // Validate urgency level
    if (data.urgencyLevel) {
      const validUrgencies = ['emergency', 'urgent', 'semi_urgent', 'elective'];
      if (validUrgencies.includes(data.urgencyLevel)) {
        processedData.urgencyLevel = data.urgencyLevel;
      } else {
        errors.push(`Invalid urgency level. Must be one of: ${validUrgencies.join(', ')}`);
      }
    }

    // Validate outcome
    if (data.outcome) {
      const validOutcomes = ['successful', 'complicated', 'partial_success', 'failed'];
      if (validOutcomes.includes(data.outcome)) {
        processedData.outcome = data.outcome;
      } else {
        errors.push(`Invalid outcome. Must be one of: ${validOutcomes.join(', ')}`);
      }
    }

    // Validate anesthesia type
    if (data.anesthesiaType) {
      const validTypes = ['general', 'regional', 'local', 'sedation', 'none'];
      if (validTypes.includes(data.anesthesiaType)) {
        processedData.anesthesiaType = data.anesthesiaType;
      } else {
        errors.push(`Invalid anesthesia type. Must be one of: ${validTypes.join(', ')}`);
      }
    }

    // Validate duration (in minutes)
    if (data.durationMinutes) {
      const duration = parseInt(data.durationMinutes);
      if (isNaN(duration) || duration < 1 || duration > 1440) { // Max 24 hours
        errors.push('Duration must be a valid number between 1 and 1440 minutes');
      } else {
        processedData.durationMinutes = duration;
      }
    }

    // Optional text fields
    ['surgeon', 'hospital', 'indication', 'technique', 'complications', 'notes', 'cptCode', 'icdCode'].forEach(field => {
      if (data[field]) {
        processedData[field] = data[field].toString().trim();
      }
    });

    // Boolean fields
    ['hadComplications', 'requiresFollowup'].forEach(field => {
      if (typeof data[field] !== 'undefined') {
        processedData[field] = Boolean(data[field]);
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
   * Calculate surgical risk profile based on history
   */
  calculateSurgicalRiskProfile(surgicalHistory) {
    const profile = {
      totalSurgeries: surgicalHistory.length,
      complicationRate: 0,
      anesthesiaExposure: {},
      procedureTypes: {},
      riskFactors: []
    };

    let complicationsCount = 0;
    
    surgicalHistory.forEach(surgery => {
      // Count complications
      if (surgery.hadComplications) {
        complicationsCount++;
      }

      // Track anesthesia exposure
      const anesthesia = surgery.anesthesiaType || 'unknown';
      profile.anesthesiaExposure[anesthesia] = (profile.anesthesiaExposure[anesthesia] || 0) + 1;

      // Track procedure types
      const procType = surgery.procedureType || 'other';
      profile.procedureTypes[procType] = (profile.procedureTypes[procType] || 0) + 1;
    });

    // Calculate complication rate
    if (profile.totalSurgeries > 0) {
      profile.complicationRate = (complicationsCount / profile.totalSurgeries * 100).toFixed(1);
    }

    // Identify risk factors
    if (profile.complicationRate > 20) {
      profile.riskFactors.push('High complication rate');
    }
    if (profile.totalSurgeries > 10) {
      profile.riskFactors.push('Multiple previous surgeries');
    }
    if (profile.anesthesiaExposure.general > 5) {
      profile.riskFactors.push('High general anesthesia exposure');
    }

    return profile;
  }

  /**
   * Create audit trail for surgical history operations
   */
  async createAuditTrail(patientId, action, data, session, practiceContext) {
    const auditRecord = {
      action,
      patientId,
      data: { 
        procedureName: data.procedureName, 
        surgeryDate: data.surgeryDate,
        surgeon: data.surgeon 
      },
      userId: session?.userId || 'system',
      timestamp: new Date(),
      practiceId: practiceContext.practiceId
    };

    console.log('📝 [PatientSurgicalHistory] Audit trail created:', auditRecord);
  }
}

// Create singleton instance
const patientSurgicalHistory = new PatientSurgicalHistory();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientSurgicalHistory', () => patientSurgicalHistory);
}

module.exports = patientSurgicalHistory;