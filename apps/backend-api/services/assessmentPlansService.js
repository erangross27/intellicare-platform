const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class AssessmentPlansService {
  constructor() {
    this.serviceContext = {
      serviceId: 'assessment-plans-service',
      apiKey: 'system',
      practiceId: 'global'
    };
  }

  /**
   * Get Assessment Plans - Query patient assessment plans
   * @param {Object} params - Query parameters
   * @param {string} params.patientId - Patient ID (required)
   * @param {string} params.dateFrom - Start date filter (optional)
   * @param {string} params.dateTo - End date filter (optional)
   * @param {number} params.limit - Max results (default: 50)
   * @param {string} params.sortBy - Sort field (default: 'date')
   * @param {string} params.sortOrder - Sort order asc/desc (default: 'desc')
   * @param {Object} context - Security context
   * @returns {Promise<Array>} Assessment plan records
   */
  async getAssessmentPlans(params, context) {
    try {
      // Convert patientId to ObjectId if needed
      let patientId = params.patientId;
      if (typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)) {
        patientId = new ObjectId(patientId);
      }

      // Build filter
      const filter = { patientId };

      // Add date filters
      if (params.dateFrom || params.dateTo) {
        filter.date = {};
        if (params.dateFrom) filter.date.$gte = new Date(params.dateFrom);
        if (params.dateTo) filter.date.$lte = new Date(params.dateTo);
      }

      // Query options - Sort by date DESC (newest on top)
      const options = {
        limit: params.limit || 50,
        sort: params.sortBy ? { [params.sortBy]: params.sortOrder === 'asc' ? 1 : -1 } : { date: -1 }
      };

      console.log(`🔎 [getAssessmentPlans] Querying assessment_plans with filter:`, JSON.stringify(filter));
      const result = await SecureDataAccess.query('assessment_plans', filter, options, context);
      console.log(`📊 [getAssessmentPlans] Query returned ${result?.length || 0} records`);

      // Fetch patient name to include in wrapped document
      let patientName = 'Unknown Patient';
      try {
        const patient = await SecureDataAccess.query('patients',
          { _id: patientId },
          { limit: 1, projection: { firstName: 1, lastName: 1 } },
          { serviceId: 'assessment-plans-service', operation: 'get-patient-name', practiceId: context.practiceId }
        );
        if (patient && patient[0]) {
          patientName = `${patient[0].lastName}, ${patient[0].firstName}`;
        }
      } catch (error) {
        console.warn(`⚠️ Could not fetch patient name for ${patientId}:`, error.message);
      }

      // Wrap all assessment plans into single document for document view
      const wrappedDocument = {
        _id: `assessment_plans_${patientId}_all`,
        assessment_plans: result,  // All records in array (sorted newest first)
        patientId: patientId,
        patientName: patientName,
        category: 'assessment_plans',
        title: 'Assessment Plans',
        date: new Date().toISOString(),
        preview: `${result.length} assessment plan${result.length === 1 ? '' : 's'}`
      };

      // Return with artifact panel metadata for frontend
      return {
        success: true,
        data: [wrappedDocument],
        count: result.length,
        displayType: 'openArtifactPanel',
        artifactPanel: {
          patientId: patientId,
          category: 'assessment_plans',
          type: 'documents',
          data: [wrappedDocument]
        }
      };
    } catch (error) {
      console.error('❌ Error getting assessment plans:', error);
      throw error;
    }
  }

  /**
   * Create Assessment Plan - Create new assessment plan record
   * @param {Object} params - Creation parameters
   * @param {string} params.patientId - Patient ID (required)
   * @param {Object} params.data - Assessment plan data (required)
   * @param {string} params.documentId - Associated document ID (optional)
   * @param {Object} context - Security context
   * @returns {Promise<Object>} Created assessment plan record
   */
  async createAssessmentPlan(params, context) {
    try {
      // Convert patientId to ObjectId if needed
      let patientId = params.patientId;
      if (typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)) {
        patientId = new ObjectId(patientId);
      }

      // Build record with timestamp metadata
      const record = {
        ...params.data,
        patientId,
        documentId: params.documentId,
        createdAt: new Date(),
        createdAtUTC: new Date(),
        createdAtTimezone: 'America/New_York',
        updatedAt: new Date(),
        updatedAtUTC: new Date(),
        updatedAtTimezone: 'America/New_York',
        source: params.data.source || 'agent',
        aiProcessed: params.data.aiProcessed !== undefined ? params.data.aiProcessed : true,
        _securityMetadata: {
          createdBy: context.userId || context.serviceId || 'system',
          createdAt: new Date(),
          createdAtUTC: new Date(),
          createdAtTimezone: 'America/New_York',
          encryptionVersion: 'v2',
          accessLevel: 'restricted'
        }
      };

      console.log(`✏️ [createAssessmentPlan] Creating assessment plan for patient ${patientId}`);
      const result = await SecureDataAccess.insert('assessment_plans', record, context);
      console.log(`✅ [createAssessmentPlan] Created assessment plan with ID ${result._id || result.insertedId}`);

      return result;
    } catch (error) {
      console.error('❌ Error creating assessment plan:', error);
      throw error;
    }
  }

  /**
   * Update Assessment Plan - Update existing assessment plan record
   * @param {Object} params - Update parameters
   * @param {string} params.recordId - Assessment plan ID to update (required)
   * @param {Object} params.updates - Fields to update (required)
   * @param {Object} context - Security context
   * @returns {Promise<Object>} Update result
   */
  async updateAssessmentPlan(params, context) {
    try {
      // Convert recordId to ObjectId if needed
      let recordId = params.recordId;
      if (typeof recordId === 'string' && recordId.match(/^[0-9a-fA-F]{24}$/)) {
        recordId = new ObjectId(recordId);
      }

      const filter = { _id: recordId };
      const updates = {
        ...params.updates,
        updatedAt: new Date(),
        updatedAtUTC: new Date(),
        updatedAtTimezone: 'America/New_York'
      };

      console.log(`🔄 [updateAssessmentPlan] Updating assessment plan ${recordId}`);
      const result = await SecureDataAccess.update('assessment_plans', filter, updates, context);
      console.log(`✅ [updateAssessmentPlan] Updated assessment plan`);

      return result;
    } catch (error) {
      console.error('❌ Error updating assessment plan:', error);
      throw error;
    }
  }

  /**
   * Delete Assessment Plan - Delete assessment plan record
   * @param {Object} params - Delete parameters
   * @param {string} params.recordId - Assessment plan ID to delete (required)
   * @param {Object} context - Security context
   * @returns {Promise<Object>} Delete result
   */
  async deleteAssessmentPlan(params, context) {
    try {
      // Convert recordId to ObjectId if needed
      let recordId = params.recordId;
      if (typeof recordId === 'string' && recordId.match(/^[0-9a-fA-F]{24}$/)) {
        recordId = new ObjectId(recordId);
      }

      console.log(`🗑️ [deleteAssessmentPlan] Deleting assessment plan ${recordId}`);
      const result = await SecureDataAccess.delete('assessment_plans', { _id: recordId }, context);
      console.log(`✅ [deleteAssessmentPlan] Deleted assessment plan`);

      return result;
    } catch (error) {
      console.error('❌ Error deleting assessment plan:', error);
      throw error;
    }
  }

  /**
   * Search Assessment Plans - Text search across assessment plan fields
   * @param {Object} params - Search parameters
   * @param {string} params.patientId - Patient ID (required)
   * @param {string} params.searchText - Text to search for (required)
   * @param {number} params.limit - Max results (default: 50)
   * @param {Object} context - Security context
   * @returns {Promise<Array>} Matching assessment plan records
   */
  async searchAssessmentPlans(params, context) {
    try {
      // Convert patientId to ObjectId if needed
      let patientId = params.patientId;
      if (typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)) {
        patientId = new ObjectId(patientId);
      }

      // Build regex search
      const searchRegex = new RegExp(params.searchText, 'i');
      const filter = {
        patientId,
        $or: [
          { chiefComplaint: searchRegex },
          { assessment: searchRegex },
          { plan: searchRegex },
          { provider: searchRegex },
          { facility: searchRegex },
          { notes: searchRegex },
          { patientEducation: searchRegex },
          { followUp: searchRegex },
          { 'diagnoses.description': searchRegex },
          { 'medications.name': searchRegex }
        ]
      };

      const options = {
        limit: params.limit || 50,
        sort: { date: -1 }
      };

      console.log(`🔍 [searchAssessmentPlans] Searching assessment plans for patient ${patientId} with text: "${params.searchText}"`);
      const result = await SecureDataAccess.query('assessment_plans', filter, options, context);
      console.log(`📊 [searchAssessmentPlans] Found ${result?.length || 0} matching records`);

      return result;
    } catch (error) {
      console.error('❌ Error searching assessment plans:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AssessmentPlansService();
