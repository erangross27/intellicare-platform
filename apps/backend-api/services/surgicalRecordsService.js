/**
 * Surgical Records Service
 *
 * Domain: surgical
 * Functions: 4 (get, create, update, delete)
 *
 * Purpose: Handle intraoperative records and surgical documentation
 *
 * Architecture:
 * - Uses SecureDataAccess for all database operations
 * - Practice-aware multi-tenant isolation
 * - Integrates with collectionFormatters for Claude-readable output
 * - Service authentication via ServiceAccountManager
 */

const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const formatters = require('./utils/collectionFormatters');
const { ObjectId } = require('mongodb');

class SurgicalRecordsService {
  constructor() {
    this.serviceName = 'surgicalRecordsService';
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
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId || 'global',
      apiKey: this.serviceAuth?.apiKey || this.serviceAuth
    };
  }

  // ============================================================================
  // SERVICE FUNCTIONS - INTRAOPERATIVE RECORDS
  // ============================================================================

  /**
   * Get Intraoperative Records
   * Fetch all intraoperative/surgical records for a patient
   */
  async getIntraoperativeRecords(params, practiceContext, session) {
    try {
      // Initialize if needed
      if (!this.serviceAuth) {
        await this.initialize();
      }

      // Extract patientId
      let { patientId, ...queryOptions } = params;

      // Check context if no patientId
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
      }

      if (!patientId) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרש מזהה מטופל'
          : 'Patient ID required');
      }

      // Build security context
      const context = this.createSecureContext(practiceContext, 'get_intraoperative_records');

      // Build filter
      const filter = {
        patientId: typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
          ? new ObjectId(patientId)
          : patientId
      };

      // Add date filters if provided
      if (params.dateFrom || params.dateTo) {
        filter.date = {};
        if (params.dateFrom) filter.date.$gte = new Date(params.dateFrom);
        if (params.dateTo) filter.date.$lte = new Date(params.dateTo);
      }

      // Add procedure type filter if provided
      if (params.procedureType) {
        filter.procedureType = params.procedureType;
      }

      // Query options
      const options = {
        sort: { date: -1 },
        limit: params.limit || 100
      };

      // Query database
      const data = await SecureDataAccess.query(
        'intraoperative_records',
        filter,
        options,
        context
      );

      console.log(`✅ Found ${data?.length || 0} intraoperative records for patient ${patientId}`);

      if (!data || data.length === 0) {
        return {
          success: true,
          data: practiceContext.language === 'he'
            ? 'לא נמצאו רשומות תוך-ניתוחיות'
            : 'No intraoperative records found for this patient.',
          count: 0
        };
      }

      // Format with formatter
      const formatter = formatters['intraoperative_records'];
      if (formatter) {
        const formattedDocs = data.map(doc => formatter(doc));
        const formattedText = formattedDocs.join('\n\n' + '='.repeat(80) + '\n\n');

        return {
          success: true,
          data: formattedText,  // For Claude
          rawData: data,        // For UI
          count: data.length,
          message: practiceContext.language === 'he'
            ? `נמצאו ${data.length} רשומות תוך-ניתוחיות`
            : `Found ${data.length} intraoperative records`
        };
      }

      // Fallback: raw JSON
      return {
        success: true,
        data: JSON.stringify(data, null, 2),
        count: data.length
      };

    } catch (error) {
      console.error('Error getting intraoperative records:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בטעינת רשומות תוך-ניתוחיות: ${error.message}`
          : `Error loading intraoperative records: ${error.message}`
      };
    }
  }

  /**
   * Create Intraoperative Record
   * Add a new intraoperative/surgical record
   */
  async createIntraoperativeRecord(params, practiceContext, session) {
    try {
      // Initialize if needed
      if (!this.serviceAuth) {
        await this.initialize();
      }

      // Extract patientId
      let { patientId, ...recordData } = params;

      // Check context if no patientId
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
      }

      if (!patientId) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרש מזהה מטופל'
          : 'Patient ID required');
      }

      // Validate required fields
      if (!params.procedureType) {
        throw new Error(practiceContext.language === 'he'
          ? 'סוג הניתוח חסר'
          : 'Procedure type is required');
      }

      // Build security context
      const context = this.createSecureContext(practiceContext, 'create_intraoperative_record');

      // Build record
      const record = {
        patientId: typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
          ? new ObjectId(patientId)
          : patientId,
        date: recordData.date ? new Date(recordData.date) : new Date(),
        procedureType: recordData.procedureType,
        surgeon: recordData.surgeon || practiceContext.userId,
        anesthesiaType: recordData.anesthesiaType,
        duration: recordData.duration,
        findings: recordData.findings,
        complications: recordData.complications,
        estimatedBloodLoss: recordData.estimatedBloodLoss,
        notes: recordData.notes,
        createdAt: new Date(),
        createdBy: practiceContext.userId || 'agent',
        source: 'agent_service'
      };

      // Insert into database
      const result = await SecureDataAccess.insert(
        'intraoperative_records',
        record,
        context
      );

      return {
        success: true,
        data: result,
        message: practiceContext.language === 'he'
          ? 'רשומה תוך-ניתוחית נוספה בהצלחה'
          : 'Intraoperative record added successfully'
      };

    } catch (error) {
      console.error('Error creating intraoperative record:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בהוספת רשומה תוך-ניתוחית: ${error.message}`
          : `Error creating intraoperative record: ${error.message}`
      };
    }
  }

  /**
   * Update Intraoperative Record
   * Update an existing intraoperative record
   */
  async updateIntraoperativeRecord(params, practiceContext, session) {
    try {
      // Initialize if needed
      if (!this.serviceAuth) {
        await this.initialize();
      }

      const { recordId, ...updates } = params;

      if (!recordId) {
        throw new Error(practiceContext.language === 'he'
          ? 'מזהה רשומה חסר'
          : 'Record ID is required');
      }

      // Build security context
      const context = this.createSecureContext(practiceContext, 'update_intraoperative_record');

      // Add update metadata
      updates.updatedAt = new Date();
      updates.updatedBy = practiceContext.userId || 'agent';

      // Update in database
      const result = await SecureDataAccess.update(
        'intraoperative_records',
        { _id: typeof recordId === 'string' && recordId.match(/^[0-9a-fA-F]{24}$/)
            ? new ObjectId(recordId)
            : recordId
        },
        updates,
        context
      );

      return {
        success: true,
        data: result,
        message: practiceContext.language === 'he'
          ? 'רשומה תוך-ניתוחית עודכנה בהצלחה'
          : 'Intraoperative record updated successfully'
      };

    } catch (error) {
      console.error('Error updating intraoperative record:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בעדכון רשומה תוך-ניתוחית: ${error.message}`
          : `Error updating intraoperative record: ${error.message}`
      };
    }
  }

  /**
   * Delete Intraoperative Record
   * Delete an intraoperative record
   */
  async deleteIntraoperativeRecord(params, practiceContext, session) {
    try {
      // Initialize if needed
      if (!this.serviceAuth) {
        await this.initialize();
      }

      const { recordId } = params;

      if (!recordId) {
        throw new Error(practiceContext.language === 'he'
          ? 'מזהה רשומה חסר'
          : 'Record ID is required');
      }

      // Build security context
      const context = this.createSecureContext(practiceContext, 'delete_intraoperative_record');

      // Delete from database
      const result = await SecureDataAccess.delete(
        'intraoperative_records',
        { _id: typeof recordId === 'string' && recordId.match(/^[0-9a-fA-F]{24}$/)
            ? new ObjectId(recordId)
            : recordId
        },
        context
      );

      return {
        success: true,
        data: result,
        message: practiceContext.language === 'he'
          ? 'רשומה תוך-ניתוחית נמחקה בהצלחה'
          : 'Intraoperative record deleted successfully'
      };

    } catch (error) {
      console.error('Error deleting intraoperative record:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה במחיקת רשומה תוך-ניתוחית: ${error.message}`
          : `Error deleting intraoperative record: ${error.message}`
      };
    }
  }
}

module.exports = new SurgicalRecordsService();
