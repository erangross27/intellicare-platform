/**
 * Patient Demographics Update Module
 * Handles updating patient demographic information with validation and audit trail
 */

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientDemographicsUpdate {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-demographics-update');
    this.initialized = true;
    console.log('✅ [PatientDemographicsUpdate] Service initialized');
  }

  /**
   * Update patient demographics with audit trail
   * @param {string} patientId - Patient ID
   * @param {Object} updateData - Data to update
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Update result
   */
  async updatePatientDemographics(patientId, updateData, practiceContext, session) {
    console.log('🔍 [PatientDemographicsUpdate] Updating patient demographics:', patientId);

    try {
      // Get current data for audit trail
      const currentData = await this.getCurrentDemographics(patientId, practiceContext);
      if (!currentData.success) {
        return currentData;
      }

      // Validate update data
      const validation = this.validateUpdateData(updateData, currentData.demographics);
      if (!validation.success) {
        return validation;
      }

      // Perform update
      const updateResult = await this.performUpdate(patientId, validation.processedData, practiceContext);
      if (!updateResult.success) {
        return updateResult;
      }

      // Create audit trail
      await this.createAuditTrail(patientId, currentData.demographics, validation.processedData, session, practiceContext);

      return {
        success: true,
        updatedFields: Object.keys(validation.processedData),
        message: 'Patient demographics updated successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDemographicsUpdate] Update failed:', error);
      return {
        success: false,
        error: 'UPDATE_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Get current demographics for comparison
   */
  async getCurrentDemographics(patientId, practiceContext) {
    const context = {
      serviceId: 'patient-demographics-update',
      operation: 'get-current',
      practiceId: practiceContext.practiceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };

    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    const results = await secureDataAccess.query('patients', { _id: patientId }, { limit: 1 }, context);
    
    if (!results || results.length === 0) {
      return {
        success: false,
        error: 'PATIENT_NOT_FOUND',
        message: 'Patient not found'
      };
    }

    return {
      success: true,
      demographics: results[0]
    };
  }

  /**
   * Validate update data
   */
  validateUpdateData(updateData, currentData) {
    const errors = [];
    const processedData = {};

    // Only allow specific fields to be updated
    const allowedFields = [
      'firstName', 'lastName', 'dateOfBirth', 'gender', 'email', 'phone',
      'street', 'city', 'state', 'zipCode', 'maritalStatus', 'emergencyContact',
      'preferredLanguage', 'preferredContactMethod'
    ];

    for (const [field, value] of Object.entries(updateData)) {
      if (allowedFields.includes(field)) {
        processedData[field] = value;
      } else {
        errors.push(`Field '${field}' is not allowed to be updated`);
      }
    }

    processedData.updatedAt = new Date();

    return {
      success: errors.length === 0,
      errors,
      processedData
    };
  }

  /**
   * Perform the actual update
   */
  async performUpdate(patientId, updateData, practiceContext) {
    const context = {
      serviceId: 'patient-demographics-update',
      operation: 'perform-update',
      practiceId: practiceContext.practiceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };

    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    const result = await secureDataAccess.update(
      'patients',
      { _id: patientId },
      updateData,
      context
    );

    return {
      success: result.matchedCount > 0,
      result
    };
  }

  /**
   * Create audit trail for the update
   */
  async createAuditTrail(patientId, oldData, newData, session, practiceContext) {
    const changes = {};
    
    for (const [field, newValue] of Object.entries(newData)) {
      if (field !== 'updatedAt' && oldData[field] !== newValue) {
        changes[field] = {
          oldValue: oldData[field],
          newValue: newValue
        };
      }
    }

    const auditRecord = {
      action: 'PATIENT_DEMOGRAPHICS_UPDATE',
      patientId,
      changes,
      updatedBy: session?.userId || 'system',
      timestamp: new Date(),
      practiceId: practiceContext.practiceId
    };

    console.log('📝 [PatientDemographicsUpdate] Audit trail created:', auditRecord);
  }
}

const patientDemographicsUpdate = new PatientDemographicsUpdate();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientDemographicsUpdate', () => patientDemographicsUpdate);
}

module.exports = patientDemographicsUpdate;