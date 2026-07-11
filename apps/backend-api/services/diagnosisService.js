/**
 * DiagnosisService
 *
 * Domain: diagnosis
 * Purpose: Handle all diagnosis-related operations
 *
 * Architecture:
 * - Uses SecureDataAccess for all database operations
 * - Practice-aware multi-tenant isolation
 * - Proper error handling and logging
 * - Service authentication via ServiceAccountManager
 */

const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AgentServiceHelpers = require('./agentServiceHelpers');
const { ObjectId } = require('mongodb');

class DiagnosisService {
  constructor() {
    this.serviceName = 'diagnosisService';
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
   */
  createSecureContext(practiceContext, operation) {
    return {
      serviceId: this.serviceName,
      operation: operation,
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
      apiKey: this.serviceAuth?.apiKey || this.serviceAuth
    };
  }

  /**
   * Get diagnoses for a patient
   */
  async getDiagnoses(params, practiceContext, session) {
    try {
      // Initialize service authentication if needed
      if (!this.serviceAuth) {
        await this.initialize();
      }

      let { patientId, ...queryOptions } = params;

      // Check context if no patientId provided
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
      }

      // Validate patient ID
      if (!patientId) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה'
          : 'Patient ID required. Please search for a patient first');
      }

      // Build security context
      const context = this.createSecureContext(practiceContext, 'get_diagnoses');

      // Get patient record to include patient name
      // Convert patientId to ObjectId if it's a valid hex string
      let patientObjectId = patientId;
      if (typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)) {
        patientObjectId = new ObjectId(patientId);
      } else if (typeof patientId === 'string') {
        // If string but not ObjectId format, might be nationalId - use filter
        patientObjectId = patientId; // Let SecureDataAccess handle it
      }

      const patients = await SecureDataAccess.query('patients',
        { _id: patientObjectId },
        { limit: 1 },
        context
      );

      if (!patients || patients.length === 0) {
        throw new Error(practiceContext.language === 'he'
          ? 'מטופל לא נמצא'
          : 'Patient not found');
      }

      const patient = patients[0];
      const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown';

      // Build filter for diagnoses query
      const diagnosisFilter = { patientId: patient._id };

      // Add status filter if provided
      const status = params.status || 'active'; // Default to 'active' per schema
      if (status === 'active') {
        // Include both explicit 'active' status AND missing status field (legacy)
        diagnosisFilter.$or = [
          { status: 'active' },
          { status: { $exists: false } }
        ];
      } else if (status === 'resolved') {
        diagnosisFilter.status = 'resolved';
      } else if (status !== 'all') {
        // For any other specific status value
        diagnosisFilter.status = status;
      }
      // If status === 'all', don't add status filter (returns everything)

      // Query diagnoses from the diagnoses collection
      const diagnoses = await SecureDataAccess.query('diagnoses',
        diagnosisFilter,
        {
          sort: { date: -1 }, // Most recent first
          limit: params.limit || 50 // Changed from 100 to 50 to match schema
        },
        context
      );

      console.log(`✅ Found ${diagnoses.length} diagnoses for patient ${patient._id}`);

      if (diagnoses.length === 0) {
        return {
          success: true,
          data: [],
          count: 0,
          message: practiceContext.language === 'he'
            ? 'לא נמצאו אבחנות'
            : 'No diagnoses found'
        };
      }

      // Group diagnoses by status
      const activeDiagnoses = diagnoses.filter(d => d.status === 'active' || !d.status);
      const resolvedDiagnoses = diagnoses.filter(d => d.status === 'resolved');
      const ruledOutDiagnoses = diagnoses.filter(d => d.status === 'ruled_out');

      // Wrap diagnoses into a single document for the template
      const wrappedDocument = {
        _id: `diagnoses_${patientId}_all`,
        diagnoses: diagnoses,
        patientId: patientId,
        patientName: patientName,
        category: 'diagnoses',
        title: `Diagnoses`,
        date: new Date().toISOString(),
        preview: `${diagnoses.length} diagnosis${diagnoses.length === 1 ? '' : 'es'}`
      };

      // Return artifact panel trigger with wrapped document data
      return {
        success: true,
        displayType: 'openArtifactPanel',
        artifactPanel: {
          patientId: patientId,
          category: 'diagnoses',
          type: 'documents',
          data: [wrappedDocument]
        },
        data: diagnoses,
        count: {
          active: activeDiagnoses.length,
          resolved: resolvedDiagnoses.length,
          ruledOut: ruledOutDiagnoses.length,
          total: diagnoses.length
        },
        message: practiceContext.language === 'he'
          ? `נמצאו ${diagnoses.length} אבחנות`
          : `Found ${diagnoses.length} diagnosis${diagnoses.length === 1 ? '' : 'es'}`,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting diagnoses:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בטעינת אבחנות: ${error.message}`
          : `Error loading diagnoses: ${error.message}`
      };
    }
  }

  /**
   * Add a new diagnosis
   */
  async addDiagnosis(params, practiceContext, session) {
    try {
      let { patientId, ...diagnosisData } = params;

      // Check context if no patientId provided
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
      }

      // Validate required fields
      if (!patientId) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה'
          : 'Patient ID required. Please search for a patient first');
      }

      if (!params.diagnosis) {
        throw new Error(practiceContext.language === 'he'
          ? 'שם האבחנה חסר'
          : 'Diagnosis name is required');
      }

      // Build security context
      const context = this.createSecureContext(practiceContext, 'add_diagnosis');

      // Convert patientId to ObjectId for storage
      let patientObjectId = patientId;
      if (typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)) {
        patientObjectId = new ObjectId(patientId);
      }

      // Structure diagnosis data
      const diagnosisEntry = {
        patientId: patientObjectId,
        diagnosis: params.diagnosis,
        icdCode: params.icdCode || '',
        type: params.type || 'primary', // primary, secondary, differential
        date: params.date ? new Date(params.date) : new Date(),
        status: params.status || 'active', // active, resolved, ruled_out
        provider: params.provider || practiceContext.userName || 'AI Agent',
        facility: params.facility || '',
        notes: params.notes || '',
        source: 'Agent Service',
        aiProcessed: false,
        createdAt: new Date()
      };

      // Insert into diagnoses collection
      const result = await SecureDataAccess.insert('diagnoses', diagnosisEntry, context);

      if (!result) {
        throw new Error('Failed to add diagnosis');
      }

      return {
        success: true,
        data: diagnosisEntry,
        message: practiceContext.language === 'he'
          ? `האבחנה ${params.diagnosis} נוספה בהצלחה`
          : `Diagnosis ${params.diagnosis} added successfully`,
        summary: {
          diagnosis: params.diagnosis,
          icdCode: params.icdCode || 'Not specified',
          type: params.type || 'primary',
          status: params.status || 'active'
        }
      };

    } catch (error) {
      console.error('Error adding diagnosis:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בהוספת אבחנה: ${error.message}`
          : `Error adding diagnosis: ${error.message}`
      };
    }
  }

  /**
   * Update a diagnosis
   */
  async updateDiagnosis(params, practiceContext, session) {
    try {
      const { diagnosisId, ...updates } = params;

      if (!diagnosisId) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרש מזהה אבחנה'
          : 'Diagnosis ID required');
      }

      // Build security context
      const context = this.createSecureContext(practiceContext, 'update_diagnosis');

      // Update diagnosis
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      // Convert diagnosisId to ObjectId
      let diagnosisObjectId = diagnosisId;
      if (typeof diagnosisId === 'string' && diagnosisId.match(/^[0-9a-fA-F]{24}$/)) {
        diagnosisObjectId = new ObjectId(diagnosisId);
      }

      const result = await SecureDataAccess.update(
        'diagnoses',
        { _id: diagnosisObjectId },
        updateData,
        context
      );

      if (!result || result.modifiedCount === 0) {
        throw new Error('Diagnosis not found or no changes made');
      }

      return {
        success: true,
        message: practiceContext.language === 'he'
          ? 'האבחנה עודכנה בהצלחה'
          : 'Diagnosis updated successfully',
        data: updateData
      };

    } catch (error) {
      console.error('Error updating diagnosis:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בעדכון אבחנה: ${error.message}`
          : `Error updating diagnosis: ${error.message}`
      };
    }
  }

  /**
   * Delete a diagnosis
   */
  async deleteDiagnosis(params, practiceContext, session) {
    try {
      const { diagnosisId } = params;

      if (!diagnosisId) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרש מזהה אבחנה'
          : 'Diagnosis ID required');
      }

      // Build security context
      const context = this.createSecureContext(practiceContext, 'delete_diagnosis');

      // Convert diagnosisId to ObjectId
      let diagnosisObjectId = diagnosisId;
      if (typeof diagnosisId === 'string' && diagnosisId.match(/^[0-9a-fA-F]{24}$/)) {
        diagnosisObjectId = new ObjectId(diagnosisId);
      }

      // Delete diagnosis
      const result = await SecureDataAccess.delete(
        'diagnoses',
        { _id: diagnosisObjectId },
        context
      );

      if (!result || result.deletedCount === 0) {
        throw new Error('Diagnosis not found');
      }

      return {
        success: true,
        message: practiceContext.language === 'he'
          ? 'האבחנה נמחקה בהצלחה'
          : 'Diagnosis deleted successfully'
      };

    } catch (error) {
      console.error('Error deleting diagnosis:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה במחיקת אבחנה: ${error.message}`
          : `Error deleting diagnosis: ${error.message}`
      };
    }
  }
}

module.exports = new DiagnosisService();
