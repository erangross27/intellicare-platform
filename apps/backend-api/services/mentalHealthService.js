/**
 * Mental Health Service
 *
 * Domain: mental_health
 * Functions: 4 (get, create, update, delete)
 *
 * Purpose: Handle psychosocial assessments and mental health records
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

class MentalHealthService {
  constructor() {
    this.serviceName = 'mentalHealthService';
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
  // SERVICE FUNCTIONS - PSYCHOSOCIAL ASSESSMENTS
  // ============================================================================

  /**
   * Get Psychosocial Assessments
   * Fetch all psychosocial assessments for a patient
   */
  async getPsychosocialAssessments(params, practiceContext, session) {
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
      const context = this.createSecureContext(practiceContext, 'get_psychosocial_assessments');

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

      // Add assessment type filter if provided
      if (params.assessmentType) {
        filter.assessmentType = params.assessmentType;
      }

      // Query options
      const options = {
        sort: { date: -1 },
        limit: params.limit || 100
      };

      // Query database
      const data = await SecureDataAccess.query(
        'psychosocial_assessments',
        filter,
        options,
        context
      );

      console.log(`✅ Found ${data?.length || 0} psychosocial assessments for patient ${patientId}`);

      if (!data || data.length === 0) {
        return {
          success: true,
          data: practiceContext.language === 'he'
            ? 'לא נמצאו הערכות פסיכוסוציאליות'
            : 'No psychosocial assessments found for this patient.',
          count: 0
        };
      }

      // Format with formatter
      const formatter = formatters['psychosocial_assessments'];
      if (formatter) {
        const formattedDocs = data.map(doc => formatter(doc));
        const formattedText = formattedDocs.join('\n\n' + '='.repeat(80) + '\n\n');

        return {
          success: true,
          data: formattedText,  // For Claude
          rawData: data,        // For UI
          count: data.length,
          message: practiceContext.language === 'he'
            ? `נמצאו ${data.length} הערכות פסיכוסוציאליות`
            : `Found ${data.length} psychosocial assessments`
        };
      }

      // Fallback: raw JSON
      return {
        success: true,
        data: JSON.stringify(data, null, 2),
        count: data.length
      };

    } catch (error) {
      console.error('Error getting psychosocial assessments:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בטעינת הערכות פסיכוסוציאליות: ${error.message}`
          : `Error loading psychosocial assessments: ${error.message}`
      };
    }
  }

  /**
   * Create Psychosocial Assessment
   * Add a new psychosocial assessment
   */
  async createPsychosocialAssessment(params, practiceContext, session) {
    try {
      // Initialize if needed
      if (!this.serviceAuth) {
        await this.initialize();
      }

      // Extract patientId
      let { patientId, ...assessmentData } = params;

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
      if (!params.assessmentType) {
        throw new Error(practiceContext.language === 'he'
          ? 'סוג ההערכה חסר'
          : 'Assessment type is required');
      }

      // Build security context
      const context = this.createSecureContext(practiceContext, 'create_psychosocial_assessments');

      // Build assessment record
      const assessment = {
        patientId: typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
          ? new ObjectId(patientId)
          : patientId,
        date: assessmentData.date ? new Date(assessmentData.date) : new Date(),
        assessmentType: assessmentData.assessmentType,
        assessor: assessmentData.assessor || practiceContext.userId,

        // Mental Status
        mentalStatus: assessmentData.mentalStatus,
        mood: assessmentData.mood,
        affect: assessmentData.affect,
        thoughtProcess: assessmentData.thoughtProcess,
        thoughtContent: assessmentData.thoughtContent,

        // Behavioral Observations
        appearance: assessmentData.appearance,
        behavior: assessmentData.behavior,
        insight: assessmentData.insight,
        judgment: assessmentData.judgment,

        // Social History
        livingArrangement: assessmentData.livingArrangement,
        socialSupport: assessmentData.socialSupport,
        occupationalStatus: assessmentData.occupationalStatus,
        substanceUse: assessmentData.substanceUse,

        // Risk Assessment
        suicidalIdeation: assessmentData.suicidalIdeation,
        homicidalIdeation: assessmentData.homicidalIdeation,
        riskLevel: assessmentData.riskLevel,
        safetyPlan: assessmentData.safetyPlan,

        // Recommendations
        recommendations: assessmentData.recommendations,
        followUpNeeded: assessmentData.followUpNeeded,
        notes: assessmentData.notes,

        createdAt: new Date(),
        createdBy: practiceContext.userId || 'agent',
        source: 'agent_service'
      };

      // Insert into database
      const result = await SecureDataAccess.insert(
        'psychosocial_assessments',
        assessment,
        context
      );

      return {
        success: true,
        data: result,
        message: practiceContext.language === 'he'
          ? 'הערכה פסיכוסוציאלית נוספה בהצלחה'
          : 'Psychosocial assessment added successfully'
      };

    } catch (error) {
      console.error('Error creating psychosocial assessment:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בהוספת הערכה פסיכוסוציאלית: ${error.message}`
          : `Error creating psychosocial assessment: ${error.message}`
      };
    }
  }

  /**
   * Update Psychosocial Assessment
   * Update an existing psychosocial assessment
   */
  async updatePsychosocialAssessment(params, practiceContext, session) {
    try {
      // Initialize if needed
      if (!this.serviceAuth) {
        await this.initialize();
      }

      const { assessmentId, ...updates } = params;

      if (!assessmentId) {
        throw new Error(practiceContext.language === 'he'
          ? 'מזהה הערכה חסר'
          : 'Assessment ID is required');
      }

      // Build security context
      const context = this.createSecureContext(practiceContext, 'update_psychosocial_assessments');

      // Add update metadata
      updates.updatedAt = new Date();
      updates.updatedBy = practiceContext.userId || 'agent';

      // Update in database
      const result = await SecureDataAccess.update(
        'psychosocial_assessments',
        { _id: typeof assessmentId === 'string' && assessmentId.match(/^[0-9a-fA-F]{24}$/)
            ? new ObjectId(assessmentId)
            : assessmentId
        },
        updates,
        context
      );

      return {
        success: true,
        data: result,
        message: practiceContext.language === 'he'
          ? 'הערכה פסיכוסוציאלית עודכנה בהצלחה'
          : 'Psychosocial assessment updated successfully'
      };

    } catch (error) {
      console.error('Error updating psychosocial assessment:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בעדכון הערכה פסיכוסוציאלית: ${error.message}`
          : `Error updating psychosocial assessment: ${error.message}`
      };
    }
  }

  /**
   * Delete Psychosocial Assessment
   * Delete a psychosocial assessment
   */
  async deletePsychosocialAssessment(params, practiceContext, session) {
    try {
      // Initialize if needed
      if (!this.serviceAuth) {
        await this.initialize();
      }

      const { assessmentId } = params;

      if (!assessmentId) {
        throw new Error(practiceContext.language === 'he'
          ? 'מזהה הערכה חסר'
          : 'Assessment ID is required');
      }

      // Build security context
      const context = this.createSecureContext(practiceContext, 'delete_psychosocial_assessments');

      // Delete from database
      const result = await SecureDataAccess.delete(
        'psychosocial_assessments',
        { _id: typeof assessmentId === 'string' && assessmentId.match(/^[0-9a-fA-F]{24}$/)
            ? new ObjectId(assessmentId)
            : assessmentId
        },
        context
      );

      return {
        success: true,
        data: result,
        message: practiceContext.language === 'he'
          ? 'הערכה פסיכוסוציאלית נמחקה בהצלחה'
          : 'Psychosocial assessment deleted successfully'
      };

    } catch (error) {
      console.error('Error deleting psychosocial assessment:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה במחיקת הערכה פסיכוסוציאלית: ${error.message}`
          : `Error deleting psychosocial assessment: ${error.message}`
      };
    }
  }

  /**
   * Get Single Psychosocial Assessment by ID
   * Fetch a specific assessment by its ID
   */
  async getPsychosocialAssessmentById(assessmentId, practiceContext) {
    try {
      if (!this.serviceAuth) {
        await this.initialize();
      }

      if (!assessmentId) {
        throw new Error('Assessment ID is required');
      }

      const context = this.createSecureContext(practiceContext, 'get_psychosocial_assessment_by_id');
      
      const filter = {
        _id: typeof assessmentId === 'string' && assessmentId.match(/^[0-9a-fA-F]{24}$/)
          ? new ObjectId(assessmentId)
          : assessmentId
      };

      const result = await SecureDataAccess.query('psychosocial_assessments', filter, { limit: 1 }, context);

      if (!result || result.length === 0) {
        return { 
          success: false, 
          message: practiceContext.language === 'he' ? 'הערכה לא נמצאה' : 'Assessment not found' 
        };
      }

      return { success: true, data: result[0] };
    } catch (error) {
      console.error('Error getting psychosocial assessment by ID:', error);
      return { 
        success: false, 
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בטעינת הערכה: ${error.message}` 
          : `Error loading assessment: ${error.message}`
      };
    }
  }

  /**
   * Search Psychosocial Assessments
   * Search assessments by text content (notes, recommendations, type)
   */
  async searchPsychosocialAssessments(params, practiceContext) {
    try {
      if (!this.serviceAuth) {
        await this.initialize();
      }

      const { query, patientId } = params;
      
      if (!query) {
        throw new Error('Search query is required');
      }

      const context = this.createSecureContext(practiceContext, 'search_psychosocial_assessments');

      const filter = {
        $or: [
          { notes: { $regex: query, $options: 'i' } },
          { assessmentType: { $regex: query, $options: 'i' } },
          { recommendations: { $regex: query, $options: 'i' } },
          { mentalStatus: { $regex: query, $options: 'i' } }
        ]
      };

      if (patientId) {
        filter.patientId = typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
          ? new ObjectId(patientId)
          : patientId;
      }

      const results = await SecureDataAccess.query('psychosocial_assessments', filter, { limit: 50, sort: { date: -1 } }, context);

      return { 
        success: true, 
        data: results, 
        count: results.length,
        message: practiceContext.language === 'he'
          ? `נמצאו ${results.length} תוצאות עבור "${query}"`
          : `Found ${results.length} results for "${query}"`
      };
    } catch (error) {
      console.error('Error searching psychosocial assessments:', error);
      return { 
        success: false, 
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בחיפוש: ${error.message}`
          : `Error searching: ${error.message}`
      };
    }
  }
}

module.exports = new MentalHealthService();
