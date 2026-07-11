/**
 * AI Clinical Insights Service
 *
 * Domain: ai_clinical
 * Functions: 7
 *
 * Purpose: Handle all AI-generated clinical insights collections
 * - Clinical Decision Support
 * - Intelligent Recommendations
 * - Trending Analysis
 * - Patient Care Plans
 * - Follow-up Intelligence
 * - Outcomes Predictions
 * - Guideline Compliance
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

class AiClinicalInsightsService {
  constructor() {
    this.serviceName = 'aiClinicalInsightsService';
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

  /**
   * Generic method to fetch and format AI collection data
   * @param {string} collectionName - Database collection name
   * @param {string} formatterName - Formatter key name
   * @param {Object} params - Query parameters
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Session context
   * @returns {Object} Formatted response
   */
  async getAICollectionData(collectionName, formatterName, params, practiceContext, session) {
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
      const context = this.createSecureContext(practiceContext, `get_${collectionName}`);

      // Validate and convert patientId
      let validatedPatientId;
      if (typeof patientId === 'string') {
        if (patientId.match(/^[0-9a-fA-F]{24}$/)) {
          // Valid ObjectId string - convert to ObjectId
          validatedPatientId = new ObjectId(patientId);
        } else {
          // Invalid format
          throw new Error(practiceContext.language === 'he'
            ? 'מזהה מטופל לא תקין'
            : 'Invalid patient ID format');
        }
      } else if (patientId && typeof patientId === 'object' && patientId._bsontype === 'ObjectId') {
        // Already an ObjectId
        validatedPatientId = patientId;
      } else {
        throw new Error(practiceContext.language === 'he'
          ? 'מזהה מטופל לא תקין'
          : 'Invalid patient ID format');
      }

      // Build filter
      const filter = {
        patientId: validatedPatientId
      };

      // Add date filters if provided
      if (params.dateFrom || params.dateTo) {
        filter.date = {};
        if (params.dateFrom) filter.date.$gte = new Date(params.dateFrom);
        if (params.dateTo) filter.date.$lte = new Date(params.dateTo);
      }

      // Query options
      const options = {
        sort: { date: -1 },
        limit: params.limit || 100
      };

      // Query database
      const data = await SecureDataAccess.query(
        collectionName,
        filter,
        options,
        context
      );

      console.log(`✅ Found ${data?.length || 0} ${collectionName} records for patient ${patientId}`);

      if (!data || data.length === 0) {
        return {
          success: true,
          data: practiceContext.language === 'he'
            ? `לא נמצאו נתונים עבור ${collectionName}`
            : `No ${collectionName} data found for this patient.`,
          count: 0,
          displayType: 'openArtifactPanel',
          artifactPanel: {
            patientId: patientId.toString(),
            category: collectionName,
            type: 'documents',
            data: []
          }
        };
      }

      // Wrap data into single document for artifact panel display
      const wrappedDocument = {
        _id: `${collectionName}_${patientId}_all`,
        [collectionName]: data,  // All records under collection name key
        patientId: patientId,
        category: collectionName,
        title: `${collectionName.replace(/_/g, ' ')}`,
        date: new Date().toISOString(),
        preview: `${data.length} record${data.length === 1 ? '' : 's'}`
      };

      // Format with formatter for Claude's text response
      const formatter = formatters[formatterName];
      let formattedText = '';
      if (formatter) {
        const formattedDocs = data.map(doc => formatter(doc));
        formattedText = formattedDocs.join('\n\n' + '='.repeat(80) + '\n\n');
      }

      return {
        success: true,
        data: formattedText || JSON.stringify(data, null, 2),  // For Claude
        rawData: data,        // For UI (backward compatibility)
        count: data.length,
        message: practiceContext.language === 'he'
          ? `נמצאו ${data.length} רשומות`
          : `Found ${data.length} records`,
        displayType: 'openArtifactPanel',
        artifactPanel: {
          patientId: patientId.toString(),
          category: collectionName,
          type: 'documents',
          data: [wrappedDocument]  // Single wrapped document
        }
      };

    } catch (error) {
      console.error(`Error getting ${collectionName}:`, error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בטעינת ${collectionName}: ${error.message}`
          : `Error loading ${collectionName}: ${error.message}`
      };
    }
  }

  // ============================================================================
  // SERVICE FUNCTIONS - AI CLINICAL INSIGHTS
  // ============================================================================

  /**
   * Get Clinical Decision Support data
   * AI-generated clinical decision support recommendations
   */
  async getClinicalDecisionSupport(params, practiceContext, session) {
    return await this.getAICollectionData(
      'clinical_decision_support',
      'clinical_decision_support',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Intelligent Recommendations
   * AI-generated intelligent recommendations for patient care
   */
  async getIntelligentRecommendations(params, practiceContext, session) {
    return await this.getAICollectionData(
      'intelligent_recommendations',
      'intelligent_recommendations',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Trending Analysis
   * AI-generated trending analysis of patient data
   */
  async getTrendingAnalysis(params, practiceContext, session) {
    return await this.getAICollectionData(
      'trending_analysis',
      'trending_analysis',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Patient Care Plan
   * AI-generated patient-specific care plans
   */
  async getPatientCarePlan(params, practiceContext, session) {
    return await this.getAICollectionData(
      'patient_specific_care_plan',
      'patient_specific_care_plan',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Follow-up Intelligence
   * AI-generated follow-up intelligence and recommendations
   */
  async getFollowUpIntelligence(params, practiceContext, session) {
    return await this.getAICollectionData(
      'follow_up_intelligence',
      'follow_up_intelligence',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Outcomes Predictions
   * AI-generated outcomes predictions based on patient data
   */
  async getOutcomesPredictions(params, practiceContext, session) {
    return await this.getAICollectionData(
      'outcomes_prediction',
      'outcomes_prediction',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Guideline Compliance
   * AI-generated guideline compliance assessments
   */
  async getGuidelineCompliance(params, practiceContext, session) {
    return await this.getAICollectionData(
      'guideline_compliance',
      'guideline_compliance',
      params,
      practiceContext,
      session
    );
  }
}

module.exports = new AiClinicalInsightsService();
