/**
 * Patient Demographics CRUD Module
 * Handles Create, Read, Update, Delete operations for patient demographic data
 */

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientDemographicsCRUD {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Authenticate service
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-demographics-crud');
    this.initialized = true;
    console.log('✅ [PatientDemographicsCRUD] Service initialized');
  }

  /**
   * Create new patient demographics record
   * @param {Object} demographicsData - Demographics data
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Creation result
   */
  async createPatientDemographics(demographicsData, practiceContext) {
    console.log('🔍 [PatientDemographicsCRUD] Creating patient demographics');

    try {
      const validationResult = this.validateDemographicsData(demographicsData, practiceContext);
      if (!validationResult.success) {
        return validationResult;
      }

      const demographicsRecord = {
        ...demographicsData,
        createdAt: new Date(),
        updatedAt: new Date(),
        practiceId: practiceContext.practiceId
      };

      const context = {
        serviceId: 'patient-demographics-crud',
        operation: 'create-demographics',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const result = await secureDataAccess.create('patient_demographics', demographicsRecord, context);

      return {
        success: true,
        demographics: result,
        message: 'Patient demographics created successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDemographicsCRUD] Creation failed:', error);
      return {
        success: false,
        error: 'CREATION_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Read patient demographics by patient ID
   * @param {string} patientId - Patient ID
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Read result
   */
  async readPatientDemographics(patientId, practiceContext) {
    console.log('🔍 [PatientDemographicsCRUD] Reading patient demographics:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      const context = {
        serviceId: 'patient-demographics-crud',
        operation: 'read-demographics',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const results = await secureDataAccess.query(
        'patient_demographics',
        { patientId: patientId },
        { limit: 1 },
        context
      );

      if (!results || results.length === 0) {
        return {
          success: false,
          error: 'DEMOGRAPHICS_NOT_FOUND',
          message: 'Patient demographics not found'
        };
      }

      return {
        success: true,
        demographics: results[0],
        message: 'Patient demographics retrieved successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDemographicsCRUD] Read failed:', error);
      return {
        success: false,
        error: 'READ_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Update patient demographics
   * @param {string} patientId - Patient ID
   * @param {Object} updateData - Data to update
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Update result
   */
  async updatePatientDemographics(patientId, updateData, practiceContext) {
    console.log('🔍 [PatientDemographicsCRUD] Updating patient demographics:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      // Validate update data
      const validationResult = this.validateDemographicsData(updateData, practiceContext, true);
      if (!validationResult.success) {
        return validationResult;
      }

      // Add update timestamp
      const updateRecord = {
        ...updateData,
        updatedAt: new Date()
      };

      const context = {
        serviceId: 'patient-demographics-crud',
        operation: 'update-demographics',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const result = await secureDataAccess.update(
        'patient_demographics',
        { patientId: patientId },
        updateRecord,
        context
      );

      if (!result || result.matchedCount === 0) {
        return {
          success: false,
          error: 'DEMOGRAPHICS_NOT_FOUND',
          message: 'Patient demographics not found for update'
        };
      }

      return {
        success: true,
        updatedCount: result.modifiedCount,
        message: 'Patient demographics updated successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDemographicsCRUD] Update failed:', error);
      return {
        success: false,
        error: 'UPDATE_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Delete patient demographics
   * @param {string} patientId - Patient ID
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Deletion result
   */
  async deletePatientDemographics(patientId, practiceContext) {
    console.log('🔍 [PatientDemographicsCRUD] Deleting patient demographics:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      const context = {
        serviceId: 'patient-demographics-crud',
        operation: 'delete-demographics',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const result = await secureDataAccess.delete(
        'patient_demographics',
        { patientId: patientId },
        context
      );

      if (!result || result.deletedCount === 0) {
        return {
          success: false,
          error: 'DEMOGRAPHICS_NOT_FOUND',
          message: 'Patient demographics not found for deletion'
        };
      }

      return {
        success: true,
        deletedCount: result.deletedCount,
        message: 'Patient demographics deleted successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDemographicsCRUD] Deletion failed:', error);
      return {
        success: false,
        error: 'DELETE_FAILED',
        message: error.message
      };
    }
  }

  /**
   * List all demographics for a practice with pagination
   * @param {Object} options - Query options
   * @param {Object} practiceContext - Practice context
   * @returns {Object} List result
   */
  async listPatientDemographics(options = {}, practiceContext) {
    console.log('🔍 [PatientDemographicsCRUD] Listing patient demographics');

    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'updatedAt',
        sortOrder = -1,
        filters = {}
      } = options;

      const skip = (page - 1) * limit;
      const queryFilter = {
        ...filters,
        practiceId: practiceContext.practiceId
      };

      const context = {
        serviceId: 'patient-demographics-crud',
        operation: 'list-demographics',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const queryOptions = {
        skip,
        limit,
        sort: { [sortBy]: sortOrder }
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const results = await secureDataAccess.query(
        'patient_demographics',
        queryFilter,
        queryOptions,
        context
      );

      // Get total count
      const totalCount = await secureDataAccess.count(
        'patient_demographics',
        queryFilter,
        context
      );

      return {
        success: true,
        demographics: results,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        },
        message: 'Patient demographics list retrieved successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDemographicsCRUD] List failed:', error);
      return {
        success: false,
        error: 'LIST_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Validate demographics data
   * @param {Object} data - Demographics data to validate
   * @param {Object} practiceContext - Practice context
   * @param {boolean} isUpdate - Whether this is an update operation
   * @returns {Object} Validation result
   */
  validateDemographicsData(data, practiceContext, isUpdate = false) {
    const errors = [];

    // Required fields for creation
    if (!isUpdate) {
      if (!data.patientId) {
        errors.push('Patient ID is required');
      }
    }

    // Validate specific fields if provided
    if (data.dateOfBirth) {
      const birthDate = new Date(data.dateOfBirth);
      if (isNaN(birthDate.getTime())) {
        errors.push('Invalid date of birth format');
      } else if (birthDate > new Date()) {
        errors.push('Date of birth cannot be in the future');
      }
    }

    if (data.gender && !['male', 'female', 'other', 'prefer_not_to_say'].includes(data.gender)) {
      errors.push('Invalid gender value');
    }

    if (data.maritalStatus && !['single', 'married', 'divorced', 'widowed', 'separated'].includes(data.maritalStatus)) {
      errors.push('Invalid marital status');
    }

    if (data.email) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(data.email)) {
        errors.push('Invalid email format');
      }
    }

    if (data.phone) {
      const cleanPhone = data.phone.replace(/[\s\-\(\)]/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        errors.push('Phone number must be between 10-15 digits');
      }
    }

    if (data.ethnicity && typeof data.ethnicity !== 'string') {
      errors.push('Ethnicity must be a string');
    }

    if (data.race && typeof data.race !== 'string') {
      errors.push('Race must be a string');
    }

    if (data.preferredLanguage && typeof data.preferredLanguage !== 'string') {
      errors.push('Preferred language must be a string');
    }

    return {
      success: errors.length === 0,
      errors,
      message: errors.length === 0 ? 'Validation passed' : 'Validation failed'
    };
  }

  /**
   * Get demographics statistics for a practice
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Statistics result
   */
  async getDemographicsStatistics(practiceContext) {
    console.log('📊 [PatientDemographicsCRUD] Getting demographics statistics');

    try {
      const context = {
        serviceId: 'patient-demographics-crud',
        operation: 'get-statistics',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const totalCount = await secureDataAccess.count(
        'patient_demographics',
        { practiceId: practiceContext.practiceId },
        context
      );

      // This would typically use aggregation for more detailed stats
      // For now, returning basic statistics
      const statistics = {
        totalPatients: totalCount,
        lastUpdated: new Date(),
        breakdowns: {
          gender: {
            male: 0,
            female: 0,
            other: 0,
            unknown: 0
          },
          ageGroups: {
            pediatric: 0,  // 0-17
            adult: 0,      // 18-64
            senior: 0      // 65+
          },
          hasEmail: 0,
          hasPhone: 0
        }
      };

      return {
        success: true,
        statistics,
        message: 'Demographics statistics retrieved successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDemographicsCRUD] Statistics failed:', error);
      return {
        success: false,
        error: 'STATISTICS_FAILED',
        message: error.message
      };
    }
  }
}

const patientDemographicsCRUD = new PatientDemographicsCRUD();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientDemographicsCRUD', () => patientDemographicsCRUD);
}

module.exports = patientDemographicsCRUD;