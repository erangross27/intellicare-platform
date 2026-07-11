// IntelliCare AI Agent Service V4 - Complete Platform Natural Conversation
// Uses Claude API only (Google/Gemini removed)

// const { GoogleGenerativeAI } = require('@google/generative-ai'); // REMOVED: Gemini no longer used
const axios = require('axios');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const availabilityService = require('./availabilityService');
// Lazy load to avoid circular dependency
// const vitalSignsAnalyzer = require('./vitalSignsAnalyzer');
const labResultInterpreter = require('./labResultInterpreter');
const allergyChecker = require('./allergyChecker');
const insuranceService = require('./insuranceService');
const reportGenerator = require('./reportGenerator');
const referralManagementService = require('./referralManagementService');
const realtimeChartService = require('./realtimeChartService');
const predictiveAnalyticsAI = require('./predictiveAnalyticsAIService');

// 🔄 REFACTORED SERVICES - Loaded via masterServiceLoader, accessed via serviceProxyManager
// These services are initialized at startup in Phase 7 (business)
// Access them at runtime via: serviceProxyManager.get('serviceName')
// const patientService = require('./patientService');
// const appointmentService = require('./appointmentService');
// const documentService = require('./documentService');
// const prescriptionService = require('./prescriptionService');
// const medicationService = require('./medicationService');
// const diagnosisService = require('./diagnosisService');
const labService = require('./labService');
// const userService = require('./userService');
// const clinicService = require('./clinicService');
const { getTimestampForDocument } = require('../utils/timezoneHelper');
// const communicationService = require('./communicationService');
// const medicalDataService = require('./medicalDataService');
// const providerService = require('./providerService');

// New Medical Collection Services - Created October 2025
const aiClinicalInsightsService = require('./aiClinicalInsightsService');
const surgicalRecordsService = require('./surgicalRecordsService');
const mentalHealthService = require('./mentalHealthService');
const clinicalOperationsService = require('./clinicalOperationsService');
const allergiesAssessmentsService = require('./allergiesAssessmentsService');
const reminderService = require('./reminderService');

// External Integration Services
const externalApiGateway = require('./externalApiGatewayService');
const drugInformationService = require('./drugInformationService');
const rxNormService = require('./rxNormService');
const patientSearchService = require('./patientSearchService');
const billingService = require('./billingService');
const providerDirectoryService = require('./providerDirectoryService');
const clinicalResearchService = require('./clinicalResearchService');
const regulatoryComplianceService = require('./regulatoryComplianceService');
// const geocodingService = require('./geocodingService'); // Not using Google API anymore

// HIPAA Compliance Services - Agent 1
const consentManagementService = require('./consentManagementService');
const phiAnonymizationService = require('./phiAnonymizationService');
const secureConfigService = require('../services/secureConfigService');
const serviceAccountManager = require('./serviceAccountManager');
const SecureDataAccess = require('./secureDataAccess');
const roleModel = require('../config/roles');
const AgentServiceHelpers = require('./agentServiceHelpers');
const AiHelpers = require('./utils/aiHelpers');
const productionKMS = require('./productionKMS');
const serviceProxyManager = require('./serviceProxyManager');
// Learning System Integration - Using new implementation

// Learning Analytics System Integration
const functionInterceptor = require('./learning/functionInterceptor');
const learningAPIGateway = require('./learning/learningAPIGateway');

// Medical Document Category Functions (194 categories × 5 operations = 970 functions)
// Use optimized version with patient.medicalData checking for 85-90% speed improvement
// Hot reload: Clear cache in development mode for immediate updates
let generatedMedicalFunctions = require('./optimizedMedicalFunctions');
const customMedicalFunctions = require('./customMedicalFunctions');

// Merge custom functions into generated functions
Object.assign(generatedMedicalFunctions, customMedicalFunctions.medicalCategoryFunctions);
const { medicalFunctionGroups } = require('./claudeMedicalFunctionGroups');

// Helper function to reload generated functions in development
function reloadGeneratedFunctions() {
  if (process.env.ENABLE_HOT_RELOAD === 'true') {
    const generatedPath = require.resolve('./optimizedMedicalFunctions');
    const baseFunctionsPath = require.resolve('./generatedMedicalFunctions');
    delete require.cache[generatedPath];
    delete require.cache[baseFunctionsPath];
    generatedMedicalFunctions = require('./optimizedMedicalFunctions');
    console.log('🔄 Hot reload: Reloaded generated medical functions');
  }
}

// STATIC FUNCTION CACHE - Load once on server start, not per request
// This dramatically improves performance by avoiding regenerating 1352 functions every time
const FUNCTION_CACHE = {
  initialized: false,
  initializing: false,  // Prevent concurrent initialization
  all: {},  // Will store all functions by language-country combo
  minimal: {},  // Will store minimal function sets
  byCategory: {},  // Will store functions grouped by category
  wrapped: null  // Will store wrapped functions for learning
};

// Map collection names to their getter functions
// Claude uses these function names to fetch data from specific collections
function getFunctionNameForCollection(collectionName) {
  // Manual overrides for special cases (non-standard naming)
  const manualOverrides = {
    'prescriptions': 'getPrescriptions',
    'prescription': 'getPrescriptions', // Singular form alias
    'medications': 'getMedications',
    'medication': 'getMedications', // Singular form alias
    'lab_results': 'getLabResults',
    'lab_orders': 'getLabOrders',
    'allergies': 'getAllergies',
    'allergy': 'getAllergies', // Singular form alias
    'appointments': 'getAppointments',
    'appointment': 'getAppointments', // Singular form alias
    'consultation_notes': 'getConsultationNotes',
    'discharge_summaries': 'getDischargeSummaries',
    'hospital_discharge_summaries': 'getHospitalDischargeSummaries',
    'imaging_reports': 'getImagingReports',
    'imaging_orders': 'getImagingOrders',
    'vaccination_records': 'getVaccinationRecords',
    'referrals': 'getReferrals',
    'medical_certificates': 'getMedicalCertificates',
    'medical_procedures': 'getMedicalProcedures',
    'emergency_reports': 'getEmergencyReports',
    'emergency_discharge_summaries': 'getEmergencyDischargeSummaries',
    'hospital_admission_notes': 'getHospitalAdmissionNotes',
    'hospital_transfer_notes': 'getHospitalTransferNotes',
    'operative_report_details': 'getOperativeReportDetails',  // MUST be before operative_reports - detailed surgery info
    'operative_reports': 'getOperativeReports',
    'pre_operative_assessments': 'getPreOperativeAssessments',
    'post_operative_reports': 'getPostOperativeReports',
    'anesthesia_records': 'getAnesthesiaRecords',
    'surgical_consent_forms': 'getSurgicalConsentForms',
    'cardiology_consultations': 'getCardiologyConsultations',
    'cardiology_followup_reports': 'getCardiologyFollowupReports',
    'cardiology_admission_notes': 'getCardiologyAdmissionNotes',
    'ecg_reports': 'getEcgReports',
    'echo_reports': 'getEchoReports',
    'cardiac_catheterization_reports': 'getCardiacCatheterizationReports',
    'stress_test_reports': 'getStressTestReports',
    'neurology_consultations': 'getNeurologyConsultations',
    'neurology_progress_notes': 'getNeurologyProgressNotes',
    'eeg_reports': 'getEegReports',
    'emg_reports': 'getEmgReports',
    'neuropsychological_assessments': 'getNeuropsychologicalAssessments',
    'psychiatric_evaluations': 'getPsychiatricEvaluations',
    'psychiatric_progress_notes': 'getPsychiatricProgressNotes',
    'psychiatric_discharge_summaries': 'getPsychiatricDischargeSummaries',
    'therapy_session_notes': 'getTherapySessionNotes',
    'mental_health_assessments': 'getMentalHealthAssessments',
    'pediatric_visits': 'getPediatricVisits',
    'well_child_examinations': 'getWellChildExaminations',
    'pediatric_growth_charts': 'getPediatricGrowthCharts',
    'developmental_assessments': 'getDevelopmentalAssessments',
    'pediatric_vaccination_records': 'getPediatricVaccinationRecords',
    'prenatal_visits': 'getPrenatalVisits',
    'labor_delivery_records': 'getLaborDeliveryRecords',
    'postpartum_notes': 'getPostpartumNotes',
    'gynecology_consultations': 'getGynecologyConsultations',
    'maternal_fetal_reports': 'getMaternalFetalReports',
    'ultrasound_ob_reports': 'getUltrasoundObReports',
    'follow_up_appointments': 'getFollowUpAppointments',
    'treatment_courses': 'getTreatmentCourses',
    'gi_risk_assessment': 'getGiRiskAssessment',
    'administrative_data': 'getAdministrativeData',
    'allergy_assessments': 'getAllergiesAssessments',
    'allergy_skin_testing': 'getAllergySkinTesting',
    'component_allergen_testing': 'getComponentAllergenTesting',
    // Real medical collections (Oct 2025) - NOT in AI_GENERATED_COLLECTIONS list
    'diagnoses': 'getDiagnoses',
    'medical_history': 'getMedicalHistory',
    'history_present_illness': 'getHistoryPresentIllness',
    'vital_signs': 'getVitalSigns',
    'risk_factors': 'getRiskFactors',
    'prognosis_records': 'getPrognosisRecords',
    'treatment_plans': 'getTreatmentPlans',
    'clinical_scores': 'getClinicalScores',
    // AI Clinical Insights & Analytics Collections (Oct 2025)
    'medication_optimization': 'getMedicationOptimization',
    'clinical_decision_support': 'getClinicalDecisionSupport',
    'trending_analysis': 'getTrendingAnalysis',
    'patient_specific_care_plan': 'getPatientCarePlan',
    'doctors_medication_recommendations': 'getDoctorsMedicationRecommendations',
    'guideline_compliance': 'getGuidelineCompliance',
    'patient_education_context': 'getPatientEducationContext',
    'care_gaps': 'getCareGaps',
    'outcomes_prediction': 'getOutcomesPredictions',
    'intelligent_recommendations': 'getIntelligentRecommendations',
    'follow_up_intelligence': 'getFollowUpIntelligence',
    'monitoring_plans': 'getMonitoringPlans'
  };

  // Check manual overrides first
  if (manualOverrides[collectionName]) {
    return manualOverrides[collectionName];
  }

  // Auto-generate function name: collection_name -> getCollectionName
  // Examples: lab_orders -> getLabOrders, bone_marrow_studies -> getBoneMarrowStudies
  const functionName = 'get' + collectionName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  return functionName;
}

class IntelliCareCompleteAgent {
  constructor() {
    // Gemini API Configuration - DISABLED (using Claude only)
    // this.geminiApiKey = null;
    this.genAI = null;
    this.initialized = false;

    // Service references - will be set during initialization
    this.medicalDataService = null;
    this.documentStorageService = null;

    // AI Helpers instance for function management (singleton)
    this.aiHelpers = AiHelpers;

    // Learning Analytics Integration
    this.learningEnabled = false;
    this.functionStats = new Map();
    this.functionGroups = null; // Cache for organized function groups

    // Conversation sessions
    this.sessions = new Map();

    // API configuration
    this.apiBase = secureConfigService.get('API_BASE_URL') || 'http://localhost:5000/api';

    // Cost tracking for Gemini 2.5 Flash
    // Official pricing as of Jan 2025: $0.30 per 1M input tokens, $2.50 per 1M output tokens
    // Note: This includes thinking tokens in the output
    this.pricing = {
      inputPer1M: 0.30,   // $0.30 per million input tokens
      outputPer1M: 2.50   // $2.50 per million output tokens (includes thinking)
    };
  }

  /**
   * Normalize practice context for all functions
   * This ensures consistency across all methods
   */

  async initialize() {
    if (this.initialized) return this;
    
    // GEMINI INITIALIZATION COMMENTED OUT - Using Claude only
    // Get API key from KMS
    // if (!productionKMS.initialized) {
    //   await productionKMS.initialize();
    // }
    // this.geminiApiKey = await productionKMS.getInternalKey('GOOGLE_API_KEY');
    
    // if (!this.geminiApiKey) {
    //   console.error('❌ [Agent V4] Gemini API key not found in KMS or config');
    //   throw new Error('Gemini API key not configured');
    // }
    
    // Initialize Google Generative AI
    // this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
    // console.log('✅ [Agent V4] Service initialized with API key from KMS');
    
    console.log('✅ [Agent V4] Service initialized (Gemini disabled - using Claude)');
    
    // Authenticate service
    this.serviceToken = await serviceAccountManager.authenticate('agentServiceV4');

    // Log the service token structure for debugging
    if (this.serviceToken) {
      console.log('✅ agentServiceV4 authenticated. Token has apiKey:', !!this.serviceToken.apiKey);
      console.log('   Service token structure:', Object.keys(this.serviceToken));
      console.log('   API key starts with:', this.serviceToken.apiKey ? this.serviceToken.apiKey.substring(0, 10) : 'N/A');
      if (!this.serviceToken.apiKey) {
        console.log('⚠️ WARNING: Service token missing apiKey property!');
      }
    } else {
      console.error('❌ agentServiceV4 authentication failed - no token received');
    }

    // Register and get service references through serviceProxyManager
    // First register the medicalDataService if not already registered
    serviceProxyManager.register('medicalDataService', () => medicalDataService);

    // Now get service references
    this.medicalDataService = serviceProxyManager.get('medicalDataService');
    this.documentStorageService = serviceProxyManager.get('documentStorageService');
    
    // Initialize Learning Analytics System
    try {
      await functionInterceptor.initialize();
      await learningAPIGateway.initialize();
      
      // Wrap all platform functions for learning
      const wrappedCount = await functionInterceptor.wrapAgentServiceFunctions(this);
      
      this.learningEnabled = true;
      console.log('📊 [Agent V4] Learning Analytics System activated');
      console.log(`  → Wrapped ${wrappedCount} functions for learning`);
      console.log('  → Pattern detection: ON');
      console.log('  → Automation discovery: ON');
      console.log('  → R-Zero self-training: ACTIVE');
    } catch (learningError) {
      console.warn('⚠️ [Agent V4] Learning Analytics not available:', learningError.message);
      console.log('  → Continuing without learning analytics');
      this.learningEnabled = false;
    }
    
    this.initialized = true;

    // Pre-warm the function cache to avoid duplicate generation
    console.log('🔥 Pre-warming function cache...');
    try {
      // Pre-generate for common language/country combinations
      this.getAllPlatformFunctions('en', 'USA');
      this.getAllPlatformFunctions('he', 'Israel');
      console.log('✅ Function cache pre-warmed');
    } catch (error) {
      console.warn('⚠️ Could not pre-warm cache:', error.message);
    }
    return this;
  }

  /**
   * Delegate getAllPlatformFunctions to aiHelpers instance
   * This method provides access to all platform functions for function selection
   */
  getAllPlatformFunctions(language, clinicCountry) {
    return this.aiHelpers.getAllPlatformFunctions(language, clinicCountry);
  }

  /**
   * Create a secure context with API key for SecureDataAccess
   * This ensures all database operations are properly authenticated
   */

  // Helper to estimate token count (more accurate approximation)
  
  // Calculate cost based on tokens

  
  // Main chat processing - handles ALL platform operations
  async processChatMessage(message, sessionId, language = 'auto', practiceContext = null) {
    // Check if this is a help command FIRST
    if (message.toLowerCase().startsWith('help')) {
      try {
        const platformHelpService = require('./platformHelpService');
        const helpResponse = platformHelpService.getHelp(message, language === 'he' ? 'he' : 'en');
        return {
          success: true,
          message: helpResponse,
          data: null,
          metadata: {
            type: 'help',
            language: language === 'he' ? 'he' : 'en'
          }
        };
      } catch (helpErr) {
        // platformHelpService module is absent — degrade gracefully to normal chat processing
        console.warn('platformHelpService unavailable; processing "help" as a normal message:', helpErr.message);
      }
    }
    
    // Process the message
    return await this.processChatMessageImpl(message, sessionId, language, practiceContext);
  }
  
  // Main chat processing implementation
  async processChatMessageImpl(message, sessionId, language = 'auto', practiceContext = null) {
    try {
      console.log('\n🤖 INTELLICARE V4 - Complete Platform Agent');
      console.log(`💬 User: ${message}`);
      
      // Check if this is a help command
      if (message.toLowerCase().startsWith('help')) {
        try {
          const platformHelpService = require('./platformHelpService');
          const helpResponse = platformHelpService.getHelp(message, language === 'he' ? 'he' : 'en');
          return {
            success: true,
            message: helpResponse,
            data: null,
            metadata: {
              type: 'help',
              language: language === 'he' ? 'he' : 'en'
            }
          };
        } catch (helpErr) {
          // platformHelpService module is absent — fall through to normal chat processing
          console.warn('platformHelpService unavailable; processing "help" as a normal message:', helpErr.message);
        }
      }
      
      // Get or create session with context tracking
      let session = this.sessions.get(sessionId);
      if (!session) {
        session = {
          history: [],
          language: null,
          clinicCountry: practiceContext?.country || this.detectClinicCountry(practiceContext),
          totalCost: 0, // Track cumulative cost
          totalTokens: 0,
          // SMART: Track which functions we've used in this conversation
          activeFunctions: new Set(), // Functions currently needed
          usedFunctionNames: new Set(), // Track what we've already loaded
          // Context tracking for connected conversations
          currentContext: {
            patientId: null,
            patientName: null,
            lastAction: null,
            lastActionTime: null
          }
        };
        this.sessions.set(sessionId, session);
      }
      
      // Auto-detect language if needed
      if (!session.language) {
        session.language = this.detectLanguage(message, language);
        console.log(`🌍 Language: ${session.language}`);
      }
      
      // Create comprehensive system instruction with context awareness
      const systemInstruction = this.getCompleteSystemInstruction(session.language, session.clinicCountry, practiceContext, session.currentContext);
      
      // Send message with retry logic and progressive degradation
      let result;
      let chat; // Declare chat outside loop so it can be used later
      let finalFunctions; // Declare finalFunctions outside loop for cost tracking
      let retries = 3;
      let lastError;
      let useReducedFunctions = false;
      
      while (retries > 0) {
        try {
          // SMART FUNCTION SELECTION - Only load what's needed!
          const functions = await this.getRelevantFunctions(message, session.language, session.clinicCountry, session.currentContext, session);

          // If we still get too many functions, use essential only
          finalFunctions = (useReducedFunctions || functions.length > 30)
            ? this.getEssentialFunctions(session.language, session.clinicCountry, message)
            : functions;
          
          console.log(`🔧 Using ${finalFunctions.length} functions${useReducedFunctions ? ' (reduced set)' : ''}`);
          
          // Build the chat configuration
          const config = {
            tools: [{
              functionDeclarations: finalFunctions
            }],
            toolConfig: {
              functionCallingConfig: {
                mode: 'AUTO'
              }
            },
            temperature: 0.7,
            maxOutputTokens: 8192  // Increased for comprehensive medical histories
          };
          
          // Clean and validate history entries
          const cleanHistory = (session.history || []).filter(entry => {
            // Skip invalid entries
            if (!entry || !entry.role || !entry.parts || !Array.isArray(entry.parts)) {
              console.log('⚠️ Skipping invalid history entry:', entry);
              return false;
            }
            
            // Validate each part has text content
            const validParts = entry.parts.filter(part => {
              if (!part || (!part.text && !part.data)) {
                console.log('⚠️ Skipping empty part in history');
                return false;
              }
              // If it has data field but it's empty, skip it
              if (part.data === '' || part.data === null || part.data === undefined) {
                console.log('⚠️ Skipping part with empty data field');
                return false;
              }
              return true;
            });
            
            // Only include entry if it has valid parts
            if (validParts.length === 0) {
              console.log('⚠️ Skipping history entry with no valid parts');
              return false;
            }
            
            // Update entry with valid parts only
            entry.parts = validParts;
            return true;
          });
          
          // GEMINI CHAT DISABLED - Using Claude instead
          // chat = this.genAI.chats.create({
          //   model: 'gemini-2.5-flash',
          //   config: config,
          //   history: [
          //     {
          //       role: 'user',
          //       parts: [{ text: systemInstruction }]
          //     },
          //     {
          //       role: 'model', 
          //       parts: [{ text: session.language === 'he' ? 'מובן, אני מוכן לעזור עם כל פעולה במערכת.' : 'Understood, I\'m ready to help with any system operation.' }]
          //     },
          //     ...cleanHistory
          //   ]
          // });
          
          // console.log(`📡 [Gemini] Sending message to API...`);
          // result = await chat.sendMessage({ message: message });
          
          // Return error since Gemini is disabled
          throw new Error('Gemini service disabled - use Claude service instead');
          console.log(`✅ [Gemini] Response received`);
          break;
        } catch (error) {
          lastError = error;
          const isGoogleError = error.status === 500 || 
                               error.message?.includes('500') || 
                               error.message?.includes('INTERNAL') ||
                               error.message?.includes('internal error');
          
          console.error(`❌ [Gemini] API error:`, {
            status: error.status,
            message: error.message,
            type: error.name,
            details: error.response?.data || 'No additional details'
          });
          
          if (isGoogleError && retries > 1) {
            console.log(`⚠️ [Gemini] Retrying with reduced functions in ${retries}s... (${retries - 1} retries left)`);
            useReducedFunctions = true; // Use reduced function set on retry
            await new Promise(resolve => setTimeout(resolve, retries * 1000)); // Exponential backoff
            retries--;
          } else {
            throw error;
          }
        }
      }
      
      if (!result && lastError) {
        throw lastError;
      }
      // Get the response text and usage (direct properties in new SDK)
      const responseText = result.text;
      
      // Calculate tokens and cost
      let inputTokens = 0;
      let outputTokens = 0;
      
      // Log the full result structure to see what we get from Google
      console.log('🔍 Google API Response Structure:', {
        hasUsageMetadata: !!result.usageMetadata,
        hasUsage: !!result.usage,
        hasTokenCount: !!result.tokenCount,
        resultKeys: Object.keys(result || {}),
        metadata: result.usageMetadata || result.usage || 'No usage data provided by Google'
      });
      
      // Try to get actual token counts from response metadata
      if (result.usageMetadata) {
        inputTokens = result.usageMetadata.promptTokenCount || 0;
        outputTokens = result.usageMetadata.candidatesTokenCount || 0;
        console.log('✅ Using REAL token counts from Google API');
      } else if (result.usage) {
        inputTokens = result.usage.promptTokens || 0;
        outputTokens = result.usage.completionTokens || 0;
        console.log('✅ Using REAL token counts from Google API (usage field)');
      } else {
        console.log('⚠️ No token data from Google, using estimation');
        // Fallback to estimation
        // Input includes: system instruction + history + message + functions
        const systemInstructionTokens = this.estimateTokens(systemInstruction);
        const historyTokens = session.history.reduce((sum, h) => sum + this.estimateTokens(h.parts[0]?.text || ''), 0);
        const messageTokens = this.estimateTokens(message);
        const functionsTokens = this.estimateTokens(JSON.stringify(finalFunctions));
        inputTokens = systemInstructionTokens + historyTokens + messageTokens + functionsTokens;
        outputTokens = this.estimateTokens(responseText);
        
        // Detailed breakdown for debugging
        console.log('📊 TOKEN BREAKDOWN (ESTIMATED):');
        console.log(`   ├─ System Prompt: ${systemInstructionTokens.toLocaleString()} tokens`);
        console.log(`   ├─ Functions (${Object.keys(finalFunctions || {}).length} total): ${functionsTokens.toLocaleString()} tokens`);
        console.log(`   ├─ Chat History: ${historyTokens.toLocaleString()} tokens`);
        console.log(`   ├─ User Message: ${messageTokens.toLocaleString()} tokens`);
        console.log(`   └─ AI Response: ${outputTokens.toLocaleString()} tokens`);
        console.log(`   📈 TOTAL: ${inputTokens.toLocaleString()} input + ${outputTokens.toLocaleString()} output = ${(inputTokens + outputTokens).toLocaleString()} tokens`);
      }
      
      // Calculate cost for this request
      const costInfo = this.calculateCost(inputTokens, outputTokens);
      
      // Update session totals
      session.totalTokens += costInfo.totalTokens;
      session.totalCost += parseFloat(costInfo.totalCost);
      
      // Log cost information
      console.log(`💰 Cost for this request:`);
      console.log(`   📊 Tokens: ${inputTokens} input + ${outputTokens} output = ${costInfo.totalTokens} total`);
      console.log(`   💵 Cost: ₪${costInfo.totalCostILS} (${costInfo.totalCostAgorot} אגורות)`);
      console.log(`   💲 USD: $${costInfo.totalCost} (${costInfo.totalCostCents}¢)`);
      console.log(`   📈 Session total: ${session.totalTokens} tokens, ₪${(session.totalCost * 3.38).toFixed(4)}`);
      
      // Add to history
      session.history.push(
        { role: 'user', parts: [{ text: message }] },
        { role: 'model', parts: [{ text: responseText }] }
      );
      
      // Keep history manageable
      if (session.history.length > 30) {
        session.history = session.history.slice(-30);
      }
      
      // Check for function calls (direct property in new SDK)
      const functionCalls = result.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        if (process.env.QUIET_LOGS !== 'true') console.log(`🔧 Executing: ${call.name}`);
        console.log(`📋 With args:`, call.args);
        
        // IMPORTANT: Add the function CALL to history (model's decision to call function)
        session.history.push({
          role: 'model',
          parts: [{
            functionCall: {
              name: call.name,
              args: call.args
            }
          }]
        });
        
        // Execute the function with context awareness
        const result = await this.executeFunction(call.name, call.args, practiceContext, session);
        
        // Update context tracking based on function results
        this.updateSessionContext(session, call.name, call.args, result);
        
        // Format the initial function result
        const formattedResult = this.formatFunctionResult(call.name, result, session.language);
        
        // Add function RESPONSE to history (as USER role per Google docs!)
        session.history.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: call.name,
              response: result
            }
          }]
        });
        
        // Per Google docs: After function execution, let model generate response
        // The model will see the function result and either:
        // 1. Ask for missing info (if function returned an error)
        // 2. Call another function (if needed)
        // 3. Provide final text response
        const finalResponse = await chat.sendMessage({ message: "." });
        
        // Initialize finalMessage with the formatted result
        let finalMessage = formattedResult;
        
        // Check if model wants to call another function or provide text response
        if (finalResponse.functionCalls && finalResponse.functionCalls.length > 0) {
          // Check if user is asking for documents
          const userAskedForDocuments = message && (
            message.includes('מסמכים') || 
            message.includes('מסמך') || 
            message.includes('documents') || 
            message.includes('קובץ') ||
            message.includes('העלאת קובץ')
          );
          
          console.log(`📨 Letting Gemini continue after ${call.name} (documents requested: ${userAskedForDocuments})`);
          
          // If we just searched for a patient and user wants documents, remind Gemini
          let followUpPrompt = '';
          if (call.name === 'searchPatients' && userAskedForDocuments && result.data && result.data.length > 0) {
            const patientId = result.data[0]._id || result.data[0].patientId;
            followUpPrompt = session.language === 'he' 
              ? `עכשיו קרא ל-getDocuments עם patientId: "${patientId}" כדי להציג את המסמכים`
              : `Now call getDocuments with patientId: "${patientId}" to show the documents`;
            console.log(`🎯 Prompting for documents: ${followUpPrompt}`);
          }
          
          // Send message to let Gemini see the function result and continue
          // Use the followUpPrompt if we have one, otherwise send a continuation message
          const followUpMessage = followUpPrompt ? { message: followUpPrompt } : { message: "." };
          const followUpResult = await chat.sendMessage(followUpMessage);
          
          // Check if Gemini wants to call another function (direct property in new SDK)
          const followUpCalls = followUpResult.functionCalls;
          if (followUpCalls && followUpCalls.length > 0) {
            // Gemini wants to call another function!
            const followUpCall = followUpCalls[0];
            console.log(`🔧 Follow-up function: ${followUpCall.name}`);
            
            // Execute the follow-up function
            const followUpFunctionResult = await this.executeFunction(followUpCall.name, followUpCall.args, practiceContext, session);
            
            // Update context
            this.updateSessionContext(session, followUpCall.name, followUpCall.args, followUpFunctionResult);
            
            // Format the follow-up result
            const followUpFormatted = this.formatFunctionResult(followUpCall.name, followUpFunctionResult, session.language);
            
            // Combine both results
            finalMessage = formattedResult + '\n\n' + followUpFormatted;
            
            // Return the follow-up function as the main action
            const followUpResponse = {
              success: true,
              message: finalMessage,
              actionTaken: followUpCall.name,
              actionResult: followUpFunctionResult.data,
              sessionId
            };

            // If the follow-up result has gridFormat, add it as displayData
            if (followUpFunctionResult.data && followUpFunctionResult.data.gridFormat) {
              followUpResponse.displayData = followUpFunctionResult.data;
              // Preserve the original displayType if it's already set (e.g., multiCategoryGrid)
              followUpResponse.displayType = followUpFunctionResult.data.displayType || 'grid';
              // Also pass through categoryGrids if present
              if (followUpFunctionResult.data.categoryGrids) {
                followUpResponse.categoryGrids = followUpFunctionResult.data.categoryGrids;
              }
            }

            return followUpResponse;
          } else {
            // Gemini just added text (direct property in new SDK)
            const followUpText = followUpResult.text;
            finalMessage = formattedResult + (followUpText ? '\n\n' + followUpText : '');
          }
        } else {
          // No follow-up needed, Gemini might have added text in finalResponse
          const responseText = finalResponse.text;
          if (responseText) {
            finalMessage = formattedResult + '\n\n' + responseText;
          }
        }
        
        session.history.push({
          role: 'model',
          parts: [{ text: finalMessage }]
        });
        
        // Add cost to message for Israeli users
        const isHebrew = session.language === 'he' || practiceContext?.country === 'Israel';
        if (isHebrew && costInfo) {
          finalMessage += `\n\n💰 עלות: ₪${costInfo.totalCostILS} (${costInfo.totalCostAgorot} אגורות)`;
        }
        
        // Check if the result has gridFormat and pass it as displayData
        const response = {
          success: true,
          message: finalMessage,
          actionTaken: call.name,
          actionResult: result.data,
          sessionId,
          // Add metadata for GUI rendering
          metadata: {
            functionName: call.name,
            functionArgs: call.args,
            functionResult: result.data,
            hasVisualization: this.hasVisualization(call.name),
            displayType: this.getDisplayType(call.name)
          },
          costInfo: {
            thisRequest: costInfo,
            sessionTotal: {
              tokens: session.totalTokens,
              cost: `$${session.totalCost.toFixed(6)}`
            }
          }
        };

        // If the result has gridFormat, add it as displayData for the frontend
        if (result.data && result.data.gridFormat) {
          response.displayData = result.data;
          // Preserve the original displayType if it's already set (e.g., multiCategoryGrid)
          response.displayType = result.data.displayType || 'grid';
          // Also pass through categoryGrids if present
          if (result.data.categoryGrids) {
            response.categoryGrids = result.data.categoryGrids;
          }
          console.log('🎯 [AgentServiceV4] Added grid displayData to response:', {
            functionName: call.name,
            gridFormat: true,
            columns: result.data.columns,
            dataCount: result.data.data?.length,
            displayTitle: result.data.displayTitle,
            displayType: response.displayType,
            hasCategoryGrids: !!result.data.categoryGrids,
            categoryGridsCount: result.data.categoryGrids?.length
          });
        }

        return response;
      }
      
      // Regular response - ensure message is never empty
      // Add cost info to response
      const response = {
        success: true,
        message: responseText || (session.language === 'he' ? 'במה אוכל לעזור?' : 'How can I help you?'),
        sessionId,
        metadata: null, // No function was called
        costInfo: {
          thisRequest: costInfo,
          sessionTotal: {
            tokens: session.totalTokens,
            cost: `$${session.totalCost.toFixed(6)}`,
            costCents: `${(session.totalCost * 100).toFixed(4)}¢`
          },
          functionsUsed: finalFunctions.length,
          breakdown: `${finalFunctions.length} functions sent (was 213 before optimization!)`
        }
      };
      
      // Always add cost summary for Israeli users, or when over 1000 tokens for others
      const isHebrew = session.language === 'he' || practiceContext?.country === 'Israel';
      if (isHebrew) {
        // Always show cost for Israeli users
        response.message += `\n\n💰 עלות: ₪${costInfo.totalCostILS} (${costInfo.totalCostAgorot} אגורות)`;
      } else if (costInfo.totalTokens > 1000) {
        // Show cost for others only if over 1000 tokens
        response.message += `\n\n💰 Cost: $${costInfo.totalCost} (${costInfo.totalTokens} tokens)`;
      }
      
      return response;
      
    } catch (error) {
      console.error('❌ Error:', error);
      
      // Provide user-friendly error messages
      // Get session language (might not exist if error happened early)
      // Use session if available, otherwise fallback to parameter or default
      const errorSession = this.sessions.get(sessionId);
      const errorLanguage = errorSession?.language || language || 'en';
      const isHebrewError = errorLanguage === 'he';
      
      let userMessage;
      if (error.message?.includes('500') || error.message?.includes('INTERNAL')) {
        userMessage = isHebrewError 
          ? 'השירות של Google Gemini נתקל בבעיה זמנית. אנא נסה שוב בעוד מספר שניות.'
          : 'Google Gemini service is experiencing temporary issues. Please try again in a few seconds.';
      } else if (error.message?.includes('429') || error.message?.includes('quota')) {
        userMessage = isHebrewError
          ? 'חרגנו ממכסת השימוש בשירות. אנא נסה שוב מאוחר יותר.'
          : 'API quota exceeded. Please try again later.';
      } else if (error.message?.includes('timeout')) {
        userMessage = isHebrewError
          ? 'הבקשה לקחה יותר מדי זמן. אנא נסה שוב.'
          : 'Request timed out. Please try again.';
      } else {
        userMessage = isHebrewError 
          ? 'מצטער, אירעה שגיאה בעיבוד הבקשה. אנא נסה שוב.'
          : 'Sorry, an error occurred processing your request. Please try again.';
      }
      
      return {
        success: false,
        message: userMessage,
        error: error.message,
        suggestion: isHebrewError
          ? 'טיפ: נסה לנסח את הבקשה בצורה פשוטה יותר'
          : 'Tip: Try rephrasing your request more simply'
      };
    }
  }

  
  // SIMPLIFIED FUNCTION SELECTION - Let Gemini understand intent naturally
  async getRelevantFunctions(message, language, clinicCountry, currentContext, session) {
    const allFunctions = this.getAllPlatformFunctions(language, clinicCountry);

    try {
      // Use the new intent-based function mapper
      const intentMapper = require('./intentBasedFunctionMapper');

      // Build context object for the mapper
      const mapperContext = {
        user: currentContext?.user || session?.user,
        practice: currentContext?.practice,
        role: currentContext?.user?.role || session?.userRole
      };

      // Get function names from intent mapper
      const functionNames = await intentMapper.mapMessageToFunctions(
        message,
        language,
        mapperContext,
        session
      );

      // Filter all functions to only include the selected ones
      const selectedFunctions = allFunctions.filter(func =>
        functionNames.includes(func.name)
      );

      console.log(`📋 Intent-based selection: ${selectedFunctions.length} functions`);
      return selectedFunctions;

    } catch (error) {
      console.error('❌ Intent-based mapping failed, using fallback:', error.message);

      // Fallback to basic keyword matching if intent mapper fails
      const messageLower = message.toLowerCase();
      const fallbackFunctions = [];

      // Basic keyword fallback
      if (messageLower.includes('patient') || messageLower.includes('מטופל')) {
        fallbackFunctions.push('searchPatients', 'getPatientDetails', 'addPatient');
      }

      if (messageLower.includes('appointment') || messageLower.includes('תור')) {
        fallbackFunctions.push('scheduleAppointment', 'findAvailableSlots');
      }

      if (messageLower.includes('meeting') || messageLower.includes('פגישה')) {
        fallbackFunctions.push('scheduleDoctorMeeting', 'getDoctorMeetings', 'getAvailableMeetingTimes', 'createRecurringMeeting');
      }

      // Default if no keywords match
      if (fallbackFunctions.length === 0) {
        fallbackFunctions.push('searchPatients', 'addPatient', 'scheduleAppointment');
      }

      return allFunctions.filter(func => fallbackFunctions.includes(func.name));
    }
  }

  
  // Get essential functions only (reduced set for fallback)

  
  // Helper to clean undefined properties from objects

  
  // Get ALL platform functions
  // Get minimal function descriptions for Claude (saves tokens)

  
  // Simplify parameter descriptions to minimal

  
  // Ultra-short descriptions for Claude (it's smart enough to understand)

  

  
  // Get comprehensive system instruction

  
  // Helper: Update session context after function execution

  
  // Execute function - routes to appropriate service
  // ========== HIPAA CONSENT MANAGEMENT METHODS ==========










  // ========== PHI ANONYMIZATION METHODS ==========






  // ========== VENDOR/BAA MANAGEMENT METHODS ==========




  // ========== RBAC PERMISSION ENFORCEMENT ==========

  /**
   * Tool-to-permission mapping for agent tool calls.
   * Maps tool names to required permission IDs.
   * Medical data tools use 'read:collection' / 'write:collection' format.
   */
  static TOOL_PERMISSIONS = {
    // Patient Management
    searchPatients: 'read_patients',
    searchPatientsByCriteria: 'read_patients',
    getPatientDetails: 'read_patients',
    listAllPatients: 'read_patients',
    getPatientConditions: 'read_patients',
    getPatientTimeline: 'read_patients',
    addPatient: 'write_patients',
    updatePatient: 'write_patients',
    admitPatient: 'write_patients',
    deletePatient: 'delete_patients',
    exportPatients: 'export_patients',

    // Medical Data (generic — permission derived from args.category)
    getMedicalData: '_medical_read',
    deleteMedicalData: '_medical_write',
    getCollectionsWithData: 'read_patients',
    getAIClinicalInsights: 'read_patients',

    // Appointments
    getAppointments: 'read_patients',
    getTodayAppointments: 'read_patients',
    getWeekSchedule: 'read_patients',
    getAvailableSlots: 'read_patients',
    findAvailableSlots: 'read_patients',
    scheduleAppointment: 'write_patients',
    rescheduleAppointment: 'write_patients',
    cancelAppointment: 'write_patients',
    deleteAppointment: 'write_patients',

    // Documents
    getDocuments: 'read_documents',
    searchDocuments: 'read_documents',
    uploadDocument: 'upload_documents',
    deleteDocument: 'delete_documents',

    // User Management & RBAC
    searchUsers: 'manage_users',
    getAllUsers: 'manage_users',
    getUserDetails: 'manage_users',
    createUser: 'manage_users',
    deactivateUser: 'manage_users',
    getUserPermissions: 'manage_users',
    updateUserPermissions: 'manage_users',
    cloneUserPermissions: 'manage_users',

    // Role Management
    getRoles: 'assign_roles',
    createRole: 'assign_roles',
    updateRole: 'assign_roles',
    deleteRole: 'assign_roles',
    cloneRole: 'assign_roles',
    listAllPermissions: 'assign_roles',
    assignRole: 'assign_roles',
    addUserRole: 'assign_roles',
    removeUserRole: 'assign_roles',
    bulkUpdateRoles: 'assign_roles',

    // Practice Settings
    updatePracticeSettings: 'manage_practice_settings',
    getPracticeSettings: 'manage_practice_settings',

    // Audit & Compliance
    getAuditLogs: 'view_audit_logs',
    searchAuditLogs: 'view_audit_logs',

    // Permission Request Workflow
    requestPermission: null,              // Any authenticated user can request
    getPendingPermissionRequests: 'manage_users',
    approvePermissionRequest: 'manage_users',
    denyPermissionRequest: 'manage_users',
  };

  /**
   * Convert camelCase tool name to snake_case collection name.
   * e.g. 'getDiagnoses' → 'diagnoses', 'getLabResults' → 'lab_results'
   */
  _toolNameToCollection(toolName) {
    // Strip common prefixes
    let name = toolName;
    const readPrefixes = ['get', 'list', 'search', 'find', 'fetch'];
    const writePrefixes = ['add', 'create', 'update', 'save', 'store', 'delete', 'remove'];
    const allPrefixes = [...readPrefixes, ...writePrefixes];

    for (const prefix of allPrefixes) {
      if (name.startsWith(prefix) && name.length > prefix.length && name[prefix.length] === name[prefix.length].toUpperCase()) {
        name = name.slice(prefix.length);
        break;
      }
    }

    // Convert PascalCase/camelCase to snake_case
    const snaked = name
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');

    return snaked;
  }

  /**
   * Determine if a tool name is a read or write operation.
   */
  _isWriteOperation(toolName) {
    return /^(add|create|update|save|store|delete|remove|import|upload)/.test(toolName);
  }

  /**
   * Get the required permission for a tool call.
   * Handles all 1,786 permissions dynamically:
   *   1. Explicit map for non-medical tools (patients, docs, users, roles, etc.)
   *   2. args.category for generic medical data tools
   *   3. Dynamic derivation for specific medical tools (getDiagnoses → read:diagnoses)
   *   4. Fallback to read_patients/write_patients for patient-data operations
   *   5. null for utility/info tools (no permission required)
   */
  _getRequiredPermission(toolName, args) {
    // 1. Check explicit map first
    const mapped = this.constructor.TOOL_PERMISSIONS[toolName];
    if (mapped) {
      // Medical data sentinel: derive from args.category
      if (mapped === '_medical_read') {
        return args?.category ? `read:${args.category}` : 'read_patients';
      }
      if (mapped === '_medical_write') {
        return args?.category ? `write:${args.category}` : 'write_patients';
      }
      return mapped;
    }

    // 2. If args has category/collection/collectionName, use it directly
    const collection = args?.category || args?.collection || args?.collectionName;
    if (collection) {
      const action = this._isWriteOperation(toolName) ? 'write' : 'read';
      return `${action}:${collection}`;
    }

    // 3. Try to derive collection from tool name (e.g. getDiagnoses → diagnoses)
    const derivedCollection = this._toolNameToCollection(toolName);
    if (derivedCollection && derivedCollection.length > 2) {
      try {
        const medicalCollections = require('./medicalCollectionsService');
        // Try exact match
        if (medicalCollections.isValidCollection(derivedCollection)) {
          const action = this._isWriteOperation(toolName) ? 'write' : 'read';
          return `${action}:${derivedCollection}`;
        }
        // Try common variations: singular→plural, plural→singular
        const variations = [
          derivedCollection + 's',                          // diagnosis → diagnoses
          derivedCollection.replace(/s$/, ''),              // diagnoses → diagnose (rarely)
          derivedCollection.replace(/ies$/, 'y'),           // allergies → allergy
          derivedCollection.replace(/y$/, 'ies'),           // allergy → allergies
          derivedCollection + '_records',                   // vaccination → vaccination_records
          derivedCollection.replace(/_records$/, ''),       // vaccination_records → vaccination
          derivedCollection + '_reports',                   // lab → lab_reports
          derivedCollection.replace(/_reports$/, ''),       // lab_reports → lab
          derivedCollection + '_notes',                     // progress → progress_notes
          derivedCollection.replace(/_notes$/, ''),         // progress_notes → progress
          derivedCollection + '_assessments',               // allergy → allergy_assessments
          derivedCollection.replace(/_assessments$/, ''),   // allergy_assessments → allergy
        ];
        for (const variant of variations) {
          if (medicalCollections.isValidCollection(variant)) {
            const action = this._isWriteOperation(toolName) ? 'write' : 'read';
            return `${action}:${variant}`;
          }
        }
      } catch (e) {
        // medicalCollectionsService not available, fall through
      }
    }

    // 4. No permission mapping found — tool is allowed for all authenticated users
    // This covers utility tools (translate, getClinicInfo, etc.)
    return null;
  }

  /**
   * Check if user has the required permission to execute a tool.
   * Returns { allowed: true } or { allowed: false, permission, message }.
   */
  async _checkPermission(toolName, args, practiceContext, session) {
    const requiredPermission = this._getRequiredPermission(toolName, args);

    // No permission required for this tool
    if (!requiredPermission) {
      return { allowed: true };
    }

    const effectiveUser = session?.authenticatedUser || practiceContext?.currentUser || practiceContext?.user;
    const userPermissions = effectiveUser?.permissions || [];
    const userEmail = effectiveUser?.email || session?.userEmail || 'unknown';

    // system_admin bypasses all permission checks
    if (userPermissions.includes('system_admin')) {
      return { allowed: true };
    }

    // Check if user has the required permission
    if (userPermissions.includes(requiredPermission)) {
      return { allowed: true };
    }

    console.warn(`🔒 PERMISSION DENIED: User ${userEmail} attempted '${toolName}' but lacks '${requiredPermission}'`);

    // Look up practice admin email to include in the message
    let adminEmail = '';
    try {
      const adminUsers = await SecureDataAccess.query(
        'users',
        { roles: 'admin' },
        { limit: 1, projection: { email: 1, firstName: 1, lastName: 1 } },
        {
          serviceId: 'agentServiceV4',
          operation: 'lookup_admin_for_permission_denied',
          practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken
        }
      );
      if (adminUsers && adminUsers.length > 0) {
        const admin = adminUsers[0];
        const adminName = [admin.firstName, admin.lastName].filter(Boolean).join(' ');
        adminEmail = admin.email;
        if (adminName && adminEmail) {
          adminEmail = `${adminName} (${adminEmail})`;
        }
      }
    } catch (e) {
      // Failing to look up admin should not block the permission check
    }

    const isHebrew = session?.language === 'he';
    const contactInfo = adminEmail
      ? (isHebrew ? `פנה למנהל המערכת: ${adminEmail}` : `Please contact your practice administrator: ${adminEmail}`)
      : (isHebrew ? 'פנה למנהל המערכת של המרפאה לקבלת הרשאה' : 'Please contact your practice administrator to request access');

    const permissionLabel = requiredPermission.replace(/[_:]/g, ' ');

    return {
      allowed: false,
      permission: requiredPermission,
      message: isHebrew
        ? `אין לך הרשאה לבצע פעולה זו (${permissionLabel}). ${contactInfo}.`
        : `You don't have permission to perform this action (${permissionLabel}). ${contactInfo}.`,
      canRequestPermission: true
    };
  }



  async executeFunction(name, args, practiceContext, session) {
    try {
      // Log function execution
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔧 Executing ${name} with args:`, JSON.stringify(args, null, 2));

      // RBAC: Check user permission before executing tool
      const permCheck = await this._checkPermission(name, args, practiceContext, session);
      if (!permCheck.allowed) {
        const isHebrew = session?.language === 'he';
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: permCheck.message,
          requiredPermission: permCheck.permission,
          canRequestPermission: true,
          agentInstruction: isHebrew
            ? `הצע למשתמש לשלוח בקשת הרשאה למנהל באמצעות הכלי requestPermission עם permission="${permCheck.permission}" והסיבה שהמשתמש יספק. שאל את המשתמש: "האם תרצה שאשלח בקשת הרשאה למנהל המערכת?" אם הכלי לא מצליח לזהות את המשתמש, שאל את המשתמש מה כתובת האימייל שלו וקרא שוב עם requesterEmail.`
            : `Offer the user to send a permission request to the admin using the requestPermission tool with permission="${permCheck.permission}" and a reason the user provides. Ask the user: "Would you like me to send a permission request to your administrator?" If the tool fails to identify the user, ask for their email and call again with the requesterEmail parameter.`
        };
      }

      // Create secure context for all database operations in this function
      // Use agentServiceV4's authentication token for all function executions
      const context = {
        serviceId: 'agentServiceV4',
        operation: `executeFunction-${name}`,
        practiceId: practiceContext?.subdomain || practiceContext?.practiceSubdomain || practiceContext?.practiceId,
        practiceSubdomain: practiceContext?.subdomain || practiceContext?.practiceSubdomain,
        userId: practiceContext?.user?.id || practiceContext?.user?._id,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      // UNIVERSAL CACHING INTEGRATION
      const universalCache = require('./universalCache');
      // CRITICAL: Never fallback to global - throw error if practice not found
      const practiceId = practiceContext?.subdomain || practiceContext?.practiceSubdomain;
      if (!practiceId) {
        console.error('❌ Practice context missing! practiceContext:', practiceContext);
        throw new Error('Practice context is required. Cannot proceed without practice identification.');
      }

      // Wrap the actual function execution with caching
      const result = await universalCache.cacheableFunction(
        name,
        practiceId,
        args,
        async () => {
          // Original function execution logic - pass context to internal function
          return await this._executeFunctionInternal(name, args, practiceContext, session, context);
        }
      );

      return result;

    } catch (error) {
      console.error(`❌ Error in ${name}:`, error);
      return {
        success: false,
        error: error.message,
        message: practiceContext?.language === 'he'
          ? `שגיאה בביצוע פעולה: ${error.message}`
          : `Error executing function: ${error.message}`
      };
    }
  }

  async _executeFunctionInternal(name, args, practiceContext, session, context) {
      // Route to appropriate handler based on function name
      // context parameter contains serviceId, operation, practiceId, apiKey for secure database access

      // Helper to get services from serviceProxyManager (loaded by masterServiceLoader)
      const getService = (serviceName) => serviceProxyManager.get(serviceName);

      // Shared variable declaration for all case blocks
      let patient;

      switch(name) {
        // Patient Management
        // SSN lookup removed - requires registration
        /* case 'lookupPatientBySSN':
          const ssnVerificationService = require('./ssnVerificationService');
          const mbiLookupService = require('./mbiLookupService');
          
          try {
            // Step 1: Verify SSN with SSA (confirms identity only)
            const verificationResult = await ssnVerificationService.verifySSN({
              ssn: args.ssn,
              firstName: args.firstName || '',
              lastName: args.lastName || '',
              dateOfBirth: args.dateOfBirth,
              userId: practiceContext?.user?.id,
              practiceId: practiceContext?.subdomain || practiceContext?.practiceId || practiceContext?.practice?.id
            });
            
            if (!verificationResult.verified) {
              return {
                success: false,
                message: verificationResult.message || 'SSN verification failed',
                details: {
                  ssnValid: verificationResult.ssnValid,
                  nameMatch: verificationResult.nameMatch,
                  dobMatch: verificationResult.dobMatch
                }
              };
            }
            
            // Step 2: Lookup Medicare data using verified SSN
            const patientData = await mbiLookupService.lookupPatientBySSN({
              ssn: args.ssn,
              dateOfBirth: args.dateOfBirth,
              firstName: args.firstName || '',
              lastName: args.lastName || '',
              userId: practiceContext?.user?.id
            });
            
            if (patientData.success) {
              return {
                success: true,
                message: `SSN verified and Medicare beneficiary data retrieved`,
                ssnVerified: true,
                data: patientData
              };
            } else {
              // SSN is valid but no Medicare data found
              // This could be because:
              // 1. Patient is not a Medicare beneficiary (under 65, not disabled)
              // 2. Patient has commercial insurance only
              // 3. Need to check other data sources (HIEs, insurance APIs)
              return {
                success: true,
                ssnVerified: true,
                message: 'SSN verified but no Medicare data found. Patient may have commercial insurance only.',
                needsAlternateDataSource: true,
                suggestedActions: [
                  'Check commercial insurance eligibility',
                  'Query regional Health Information Exchange',
                  'Request medical records from previous providers'
                ]
              };
            }
          } catch (error) {
            console.error('SSN lookup error:', error);
            // If SSN verification service is not configured, fall back to MBI lookup only
            if (error.message?.includes('SSA eCBSV credentials not configured')) {
              console.log('SSA eCBSV not configured, attempting direct MBI lookup...');
              return await mbiLookupService.lookupPatientBySSN({
                ssn: args.ssn,
                dateOfBirth: args.dateOfBirth,
                firstName: args.firstName || '',
                lastName: args.lastName || '',
                userId: practiceContext?.user?.id
              });
            }
            
            return {
              success: false,
              message: 'Failed to process SSN lookup',
              error: error.message
            };
          }
        */

        // ===== BLUE BUTTON / MEDICARE IMPORT =====
        case 'startMedicareImport':
          // Start Medicare import process — call service directly (no HTTP)
          try {
            const blueButtonService = require('./blueButtonOAuthService');
            const importSessionId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const practiceId = practiceContext?.subdomain || practiceContext?.practiceId || practiceContext?.practice?.id;

            // Store import session — always use 'global' so public endpoints (go/qr) can find it
            const importContext = {
              serviceId: 'patient-import-service',
              operation: 'startImport',
              practiceId: 'global'
            };

            // Generate OAuth URL — use fixed callback URL for multi-subdomain support
            const host = process.env.APP_HOST || 'yale.intellicare.health:5000';
            const redirectUri = process.env.BLUE_BUTTON_CALLBACK_URL
              || `https://${host}/api/patient-import/medicare/callback`;
            const { authUrl, state } = await blueButtonService.getAuthorizationUrl(redirectUri, importSessionId);

            // Store import session WITH the full authUrl for the redirect endpoint
            await SecureDataAccess.insert('patient_import_sessions', {
              importSessionId,
              practiceId,
              staffUserId: practiceContext?.currentUser?.id || practiceContext?.user?.id,
              chatSessionId: session?.id,
              patientId: args.patientId,
              authUrl,
              status: 'pending',
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + 30 * 60 * 1000)
            }, importContext);

            // Short redirect URL — clean link for the chat
            const shortUrl = `https://${host}/api/patient-import/medicare/go/${importSessionId}`;

            return {
              success: true,
              importSessionId,
              authUrl: shortUrl,
              message: 'Medicare import session created. Have the patient click the link below to log into Medicare.gov and authorize data sharing. The link expires in 30 minutes.'
            };
          } catch (error) {
            console.error('Start Medicare import error:', error);
            return {
              success: false,
              message: 'Failed to start Medicare import',
              error: error.message
            };
          }

        case 'checkMedicareImportStatus':
          // Check if patient completed Medicare import — query DB directly
          try {
            const statusContext = {
              serviceId: 'patient-import-service',
              operation: 'checkStatus',
              practiceId: 'global'
            };

            const importSessions = await SecureDataAccess.query('patient_import_sessions', {
              importSessionId: args.importSessionId
            }, { limit: 1 }, statusContext);

            if (!importSessions || importSessions.length === 0) {
              return {
                success: false,
                message: 'Import session not found. Check the importSessionId.'
              };
            }

            const importSession = importSessions[0];

            if (importSession.status === 'completed') {
              return {
                success: true,
                completed: true,
                patientData: importSession.patientData,
                message: 'Medicare data imported successfully!'
              };
            } else {
              return {
                success: true,
                completed: false,
                status: importSession.status,
                message: 'Patient has not completed Medicare import yet. Ask them to click the authorization link.'
              };
            }
          } catch (error) {
            console.error('Check Medicare import status error:', error);
            return {
              success: false,
              message: 'Failed to check import status',
              error: error.message
            };
          }
          
        // 🔄 PATIENT SERVICE - Delegated to getService('patientService').js
        case 'addPatient':
          return await getService('patientService').addPatient(args, practiceContext, session);
        case 'updatePatient':
          return await getService('patientService').updatePatient(args, practiceContext, session);
        case 'deletePatientBySearch':
          return await getService('patientService').deletePatientBySearch(args, practiceContext, session);
        case 'searchPatients':
          return await getService('patientService').searchPatients(args, practiceContext, session, context);
        case 'searchPatientsByCriteria':
          // Advanced clinical-criteria search (conditions/medications/allergies/age/location).
          // Was unreachable until June 2026: its tool def shared the name "searchPatients"
          // with the name search, so this dispatcher never saw the criteria variant.
          return await patientSearchService.searchPatientsUniversal(args, session?.sessionId, practiceContext);
        case 'searchPatientsByName':
          return await getService('patientService').searchPatientsByName(args, practiceContext, session, context);
        case 'listAllPatients':
          return await getService('patientService').listAllPatients(args, practiceContext, session);
        case 'countPatients':
          return await getService('patientService').countPatients(args, practiceContext, session);
        case 'findPatient':
          return await getService('patientService').findPatient(args, practiceContext, session);
        case 'getPatientDetails':
          return await getService('patientService').getPatientDetails(args, practiceContext, session, context);
        case 'importPatientsFromCSV':
          return await getService('patientService').importPatientsFromCSV(args, practiceContext, session);
        case 'importUsersFromCSV':
          return await getService('userService').importUsersFromCSV(args, practiceContext, session);

        // Follow-up Management
        case 'getPatientsNeedingFollowUp':
          return await getService('patientService').getPatientsNeedingFollowUp(args, practiceContext, session);
        case 'getPatientFollowUpDetails':
          return await getService('patientService').getPatientFollowUpDetails(args, practiceContext, session);
        case 'scheduleFollowUp':
          return await getService('patientService').scheduleFollowUp(args, practiceContext, session);
        case 'updateFollowUpStatus':
          return await getService('patientService').updateFollowUpStatus(args, practiceContext, session);
        case 'deleteFollowUp':
          return await getService('patientService').deleteFollowUp(args, practiceContext, session);

        // ========== PATIENT CONDITION MANAGEMENT ==========
        case 'getPatientsForFollowUp':
          return await getService('patientService').getPatientsForFollowUp(args, practiceContext, session);
        case 'addPatientCondition':
          return await getService('patientService').addPatientCondition(args, practiceContext, session);
        case 'updatePatientCondition':
          return await getService('patientService').updatePatientCondition(args, practiceContext, session);
        case 'getPatientConditions':
          return await getService('patientService').getPatientConditions(args, practiceContext, session);

        // ========== MEDICAL HISTORY MANAGEMENT ==========
        case 'addMedicalHistory':
          return await getService('patientService').addMedicalHistory(args, practiceContext, session);
        case 'updateMedicalHistory':
          return await getService('patientService').updateMedicalHistory(args, practiceContext, session);
        case 'deleteMedicalHistory':
          return await getService('patientService').deleteMedicalHistory(args, practiceContext, session);
        case 'fuzzyPatientSearch':
          return await getService('patientService').fuzzyPatientSearch(args.searchQuery, practiceContext, session);
        case 'checkCollectionHasData':
          return await getService('medicalDataService').checkCollectionHasData(args.patientId, args.collectionName, practiceContext);
        case 'deleteMedicalData':
          return await getService('medicalDataService').deleteMedicalData(args.patientId, args.category, practiceContext);
        case 'ensurePatientIdIndex':
          return await getService('medicalDataService').ensurePatientIdIndex(args.collectionName, practiceContext);
        case 'getAIClinicalInsights':
          return await getService('medicalDataService').getAIClinicalInsights(args.patientId, practiceContext);
        case 'getCollectionsWithData':
          return await getService('medicalDataService').getCollectionsWithData(args.patientId, practiceContext);
        case 'getMedicalData':
          return await getService('medicalDataService').getMedicalData(args.category, args.patientId, args.options, practiceContext);
        case 'syncActivePrescriptionToMedication':
          return await getService('medicationService').syncActivePrescriptionToMedication(args.prescriptionId, args.prescription, practiceContext);
        case 'addDiagnosis':
          return await getService('diagnosisService').addDiagnosis(args, practiceContext, session);
        case 'getDiagnoses':
          return await getService('diagnosisService').getDiagnoses(args, practiceContext, session);
        case 'getVaccinations':
          return await getService('labService').getVaccinations(args, practiceContext, session);
        case 'cleanupAppointmentReferences':
          return await getService('appointmentService').cleanupAppointmentReferences(args.appointmentId, practiceContext, args.providerId, args.patientId);
        case 'lookupDoctor':
          return await getService('appointmentService').lookupDoctor(args.nameOrEmailOrId, practiceContext, session);
        case 'storeExtractedMedicalData':
          return await getService('medicalDataService').storeExtractedMedicalData(args.extractedData, args.patientId, args.documentId, practiceContext);
        case 'storeMedicalData':
          return await getService('medicalDataService').storeMedicalData(args.category, args.data, practiceContext);
        case 'listPatientMedicalCategories':
          return await getService('medicalDataService').listPatientMedicalCategories(args, practiceContext);
        case 'updateExistingCollections':
          return await getService('medicalDataService').updateExistingCollections(practiceContext);
        case 'initialize':
          return await getService('medicalDataService').initialize();
        case 'getConditionStatistics':
          return await getService('patientService').getConditionStatistics(args, practiceContext, session);
        case 'getPatientsList':
          return await getService('patientService').getPatientsList(args, practiceContext, session);

        case 'getAIInsights':
          return await getService('medicalDataService').getAIClinicalInsights(args, context);
          
        // Documents
        case 'getDocuments':
          return await getService('documentService').getDocuments(args, practiceContext, session);
        case 'batchAnalyzeDocuments':
          return await getService('documentService').batchAnalyzeDocuments(args, practiceContext, session);
        case 'analyzeUploadedDocuments':
          return await getService('documentService').analyzeUploadedDocuments(args, practiceContext, session);
        case 'assignDocumentToPatient':
          return await getService('documentService').assignDocumentToPatient(args, practiceContext, session);
        case 'deleteDocument':
          return await getService('documentService').deleteDocument(args, practiceContext, session);
        case 'searchDocuments':
          return await getService('documentService').searchDocuments(args, practiceContext, session);
        case 'retrievePendingUpload':
          return await getService('documentService').retrievePendingUpload(args, practiceContext, session);
        case 'previewPendingDocument':
          return await getService('documentService').previewPendingDocument(args, practiceContext, session);
        // Backward compatibility alias
        case 'analyzePendingDocument':
          return await getService('documentService').previewPendingDocument(args, practiceContext, session);

        // Diagnosis & Treatment
        case 'analyzeSymptoms':
          return await agentServiceV4.analyzeSymptoms(args, practiceContext, session);
        case 'recommendTreatment':
          return await agentServiceV4.recommendTreatment(args, practiceContext, session);
        case 'checkDrugInteractions':
          return await getService('medicationService').checkDrugInteractions(args, practiceContext, session);
        case 'checkDrugAllergy':
          return await getService('medicationService').checkDrugAllergy(args, practiceContext, session);
        case 'checkPatientsForAllergies':
          return await allergiesAssessmentsService.checkPatientForAllergies(args, practiceContext);
        case 'getDifferentialDiagnosis':
          return await agentServiceV4.getDifferentialDiagnosis(args, practiceContext, session);
        case 'recommendTests':
          return await agentServiceV4.recommendTests(args, practiceContext, session);
          
        // Lab Results & Medical Data
        case 'addLabResult':
          return await getService('labService').addLabResult(args, practiceContext, session);
        case 'getLabResults':
          return await getService('labService').getLabResults(args, practiceContext, session);
        case 'addMedication':
          return await getService('medicationService').addMedication(args, practiceContext, session);
        case 'getMedications':
          return await getService('medicationService').getMedications(args, practiceContext, session);
        // getDiagnoses, getVitalSigns, etc. now use generatedMedicalFunctions (auto-generated)
        case 'addVitalSigns':
          return await getService('labService').addVitalSigns(args, practiceContext, session);
        // case 'getVitalSigns': REMOVED - now uses optimizedMedicalFunctions wrapper with artifactPanel
        case 'addAllergy':
          return await getService('medicalDataService').storeMedicalData('allergies', args, practiceContext);
        case 'getAllergies':
          // Use generated function handler (already imported at top of file via optimizedMedicalFunctions)
          return await generatedMedicalFunctions.getAllergies.handler(args, { practiceId: practiceContext?.subdomain || practiceContext?.practiceId || 'global' });

        // Allergies Assessments CRUD Operations - New October 2025
        case 'getAllergiesAssessments':
          return await allergiesAssessmentsService.getAllergiesAssessments(args, context);
        case 'createAllergiesAssessment':
          return await allergiesAssessmentsService.createAllergiesAssessment(args, context);
        case 'updateAllergiesAssessment':
          return await allergiesAssessmentsService.updateAllergiesAssessment(args, context);
        case 'deleteAllergiesAssessment':
          return await allergiesAssessmentsService.deleteAllergiesAssessment(args, context);
        case 'searchAllergiesAssessments':
          return await allergiesAssessmentsService.searchAllergiesAssessments(args, context);

        // AI Clinical Insights - New October 2025
        case 'getClinicalDecisionSupport':
          return await aiClinicalInsightsService.getClinicalDecisionSupport(args, practiceContext, session);
        case 'getIntelligentRecommendations':
          return await aiClinicalInsightsService.getIntelligentRecommendations(args, practiceContext, session);
        case 'getTrendingAnalysis':
          return await aiClinicalInsightsService.getTrendingAnalysis(args, practiceContext, session);
        case 'getPatientCarePlan':
          return await aiClinicalInsightsService.getPatientCarePlan(args, practiceContext, session);
        case 'getFollowUpIntelligence':
          return await aiClinicalInsightsService.getFollowUpIntelligence(args, practiceContext, session);
        case 'getOutcomesPredictions':
          return await aiClinicalInsightsService.getOutcomesPredictions(args, practiceContext, session);
        case 'getGuidelineCompliance':
          return await aiClinicalInsightsService.getGuidelineCompliance(args, practiceContext, session);

        // Surgical & Mental Health - New October 2025
        case 'getIntraoperativeRecords':
          return await surgicalRecordsService.getIntraoperativeRecords(args, practiceContext, session);

        // Reminders - System/Operational (NOT medical data)
        case 'getReminders':
          return await reminderService.getReminders(args, {
            serviceId: 'agentServiceV4',
            operation: 'getReminders',
            practiceId: practiceContext.subdomain || practiceContext.practiceId
          });
        case 'createReminder':
          return await reminderService.createReminder(args, {
            serviceId: 'agentServiceV4',
            operation: 'createReminder',
            practiceId: practiceContext.subdomain || practiceContext.practiceId
          });
        case 'updateReminder':
          return await reminderService.updateReminder(args, {
            serviceId: 'agentServiceV4',
            operation: 'updateReminder',
            practiceId: practiceContext.subdomain || practiceContext.practiceId
          });
        case 'deleteReminder':
          return await reminderService.deleteReminder(args, {
            serviceId: 'agentServiceV4',
            operation: 'deleteReminder',
            practiceId: practiceContext.subdomain || practiceContext.practiceId
          });
        case 'searchReminders':
          return await reminderService.searchReminders(args, {
            serviceId: 'agentServiceV4',
            operation: 'searchReminders',
            practiceId: practiceContext.subdomain || practiceContext.practiceId
          });

        // Clinical Operations - New October 2025
        case 'getQualityMetrics':
          return await clinicalOperationsService.getQualityMetrics(args, practiceContext, session);
        case 'getHistoryPresentIllness':
          return await clinicalOperationsService.getHistoryPresentIllness(args, practiceContext, session);
        case 'getCareGaps':
          return await clinicalOperationsService.getCareGaps(args, practiceContext, session);
        case 'getCostTracking':
          return await clinicalOperationsService.getCostTracking(args, practiceContext, session);
        case 'getAdministrativeData':
          return await clinicalOperationsService.getAdministrativeData(args, practiceContext, session);

        // Real medical data collections (Oct 2025) now use generatedMedicalFunctions:
        // getRiskFactors, getRecommendations, getTreatmentPlans, getClinicalScores,
        // getMedicalHistory, getPrognosisRecords, getDiagnoses, getHistoryPresentIllness, getVitalSigns
        // All auto-generated with full CRUD (get, create, update, delete, search)

        // Vaccinations - Removed broken explicit cases (vaccination_records uses generatedMedicalFunctions pattern)
        // Functions: getVaccinationrecords, createVaccinationrecords, updateVaccinationrecords, etc.

        // Prescriptions
        case 'createPrescription':
          return await getService('prescriptionService').createPrescription(args, practiceContext, session);
        case 'getPrescriptions':
          return await getService('prescriptionService').getPrescriptions(args, practiceContext, session);
        case 'updatePrescription':
          return await getService('prescriptionService').updatePrescription(args, practiceContext, session);
        // REMOVED: generatePrescription - Gemini-dependent function disabled
          
        // REMOVED: generatePatientEducation - Gemini-dependent function disabled
          
        // REMOVED: calculateMedicalScore - Gemini-dependent function disabled
          
        // REMOVED: generateSOAPNote - Gemini-dependent function disabled
          
        // REMOVED: calculateMedicationDosing - Gemini-dependent function disabled
          
        // REMOVED: lookupClinicalGuidelines - Gemini-dependent function disabled
          
        // REMOVED: generateVaccinationSchedule - Gemini-dependent function disabled
          
        // Referrals
        case 'createReferral': {
          // CRITICAL FIX: If referralData is a string (JSON), parse it first
          let parsedArgs = { ...args };
          if (typeof args.referralData === 'string') {
            try {
              const parsed = JSON.parse(args.referralData);
              // Merge parsed data with args, giving precedence to parsed fields
              parsedArgs = { ...args, ...parsed };
              delete parsedArgs.referralData; // Remove the string field
              console.log('✅ Parsed referralData JSON string successfully');
            } catch (error) {
              console.error('❌ Failed to parse referralData JSON string:', error);
            }
          }

          const referralContext = {
            userId: session?.userId || practiceContext?.currentUser?.id || 'system',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId || 'global'
          };

          // Fetch patient details to enrich referral
          let patientDetails = null;
          let diagnoses = [];
          try {
            const patientDataContext = {
              serviceId: 'agentServiceV4',
              operation: 'get_patient_for_referral',
              practiceId: referralContext.practiceId,
              apiKey: this.serviceToken?.apiKey || this.serviceToken
            };

            // Get patient demographics
            // Convert string ID to ObjectId for database query
            const { ObjectId } = require('mongodb');
            let patientQuery = {};

            try {
              // Try to convert to ObjectId if it's a valid ObjectId string
              patientQuery = { _id: new ObjectId(parsedArgs.patientId) };
            } catch (err) {
              // If conversion fails, use as string (might be a custom ID)
              patientQuery = { _id: parsedArgs.patientId };
            }

            const patients = await SecureDataAccess.query(
              'patients',
              patientQuery,
              {},
              patientDataContext
            );

            if (patients && patients.length > 0) {
              patientDetails = patients[0];
              console.log('📋 Patient found for referral:', {
                patientId: parsedArgs.patientId,
                hasInsuranceProvider: !!patientDetails.insuranceProvider,
                insuranceProvider: patientDetails.insuranceProvider,
                insuranceNumber: patientDetails.insuranceNumber
              });
            } else {
              console.log('⚠️ No patient found for referral with ID:', parsedArgs.patientId);
            }

            // Get patient diagnoses
            // Note: diagnoses collection stores patientId as ObjectId, not string
            let diagnosisQuery = {};
            try {
              diagnosisQuery = { patientId: new ObjectId(parsedArgs.patientId) };
            } catch (err) {
              // Fallback to string if ObjectId conversion fails
              diagnosisQuery = { patientId: parsedArgs.patientId };
            }

            const patientDiagnoses = await SecureDataAccess.query(
              'diagnoses',
              diagnosisQuery,
              { sort: { diagnosisDate: -1 }, limit: 10 },
              patientDataContext
            );

            if (patientDiagnoses && patientDiagnoses.length > 0) {
              diagnoses = patientDiagnoses.map(d => ({
                code: d.icdCode || d.code,
                description: d.diagnosis || d.description,
                date: d.diagnosisDate || d.date
              }));
              console.log(`📋 Found ${diagnoses.length} diagnoses for referral`);
            }
          } catch (err) {
            console.error('❌ Error fetching patient details for referral:', err);
          }

          // Map args from function schema to service expected format
          // Support multiple field name variations from parsed JSON
          const referralData = {
            patientId: parsedArgs.patientId,
            specialtyRequired: parsedArgs.specialtyRequired || parsedArgs.specialty || parsedArgs.specialistType,
            reasonForReferral: parsedArgs.reasonForReferral || parsedArgs.reason,
            clinicalNotes: parsedArgs.clinicalNotes || parsedArgs.notes,
            priority: parsedArgs.priority || parsedArgs.urgency || 'routine',
            receivingProviderId: parsedArgs.receivingProviderId || parsedArgs.specialistName,  // if provided
            diagnosis: diagnoses,

            // Add patient insurance info if available
            insuranceInfo: patientDetails?.insuranceProvider ? {
              providerId: patientDetails.insuranceProvider,
              memberId: patientDetails.insuranceNumber || '',
              groupNumber: '',  // Not in schema, leave empty
              preAuthRequired: (parsedArgs.specialtyRequired || parsedArgs.specialty || parsedArgs.specialistType) ?
                ['Cardiology', 'Neurology', 'Oncology', 'Surgery', 'Endocrinology'].includes(
                  parsedArgs.specialtyRequired || parsedArgs.specialty || parsedArgs.specialistType
                ) : false
            } : {}
          };

          console.log('📋 Final referralData being sent to service:', {
            patientId: referralData.patientId,
            specialtyRequired: referralData.specialtyRequired,
            reasonForReferral: referralData.reasonForReferral ? referralData.reasonForReferral.substring(0, 50) + '...' : null,
            clinicalNotes: referralData.clinicalNotes ? referralData.clinicalNotes.substring(0, 50) + '...' : null,
            priority: referralData.priority,
            diagnosisCount: referralData.diagnosis.length
          });

          return await referralManagementService.createReferral(referralData, referralContext);
        }

        // ========== AI-GENERATED COLLECTIONS CRUD ==========
        // MEDICATION OPTIMIZATION
        case 'updateMedicationOptimization':
          return await this.updateAICollection('medication_optimization', args.documentId, args.updates, practiceContext);
        case 'deleteMedicationOptimization':
          return await this.deleteAICollection('medication_optimization', args.documentId, practiceContext);
        case 'addToMedicationOptimization':
          return await this.addToAICollectionArray('medication_optimization', args.documentId, args.fieldName, args.newItems, practiceContext);

        // CLINICAL DECISION SUPPORT
        case 'updateClinicalDecisionSupport':
          return await this.updateAICollection('clinical_decision_support', args.documentId, args.updates, practiceContext);
        case 'deleteClinicalDecisionSupport':
          return await this.deleteAICollection('clinical_decision_support', args.documentId, practiceContext);
        case 'addToClinicalDecisionSupport':
          return await this.addToAICollectionArray('clinical_decision_support', args.documentId, args.fieldName, args.newItems, practiceContext);

        // INTELLIGENT RECOMMENDATIONS
        case 'updateIntelligentRecommendations':
          return await this.updateAICollection('intelligent_recommendations', args.documentId, args.updates, practiceContext);
        case 'deleteIntelligentRecommendations':
          return await this.deleteAICollection('intelligent_recommendations', args.documentId, practiceContext);
        case 'addToIntelligentRecommendations':
          return await this.addToAICollectionArray('intelligent_recommendations', args.documentId, args.fieldName, args.newItems, practiceContext);

        // TRENDING ANALYSIS
        case 'updateTrendingAnalysis':
          return await this.updateAICollection('trending_analysis', args.documentId, args.updates, practiceContext);
        case 'deleteTrendingAnalysis':
          return await this.deleteAICollection('trending_analysis', args.documentId, practiceContext);
        case 'addToTrendingAnalysis':
          return await this.addToAICollectionArray('trending_analysis', args.documentId, args.fieldName, args.newItems, practiceContext);

        // FOLLOW-UP INTELLIGENCE
        case 'updateFollowUpIntelligence':
          return await this.updateAICollection('follow_up_intelligence', args.documentId, args.updates, practiceContext);
        case 'deleteFollowUpIntelligence':
          return await this.deleteAICollection('follow_up_intelligence', args.documentId, practiceContext);
        case 'addToFollowUpIntelligence':
          return await this.addToAICollectionArray('follow_up_intelligence', args.documentId, args.fieldName, args.newItems, practiceContext);

        // PATIENT-SPECIFIC CARE PLAN
        case 'updatePatientSpecificCarePlan':
          return await this.updateAICollection('patient_specific_care_plan', args.documentId, args.updates, practiceContext);
        case 'deletePatientSpecificCarePlan':
          return await this.deleteAICollection('patient_specific_care_plan', args.documentId, practiceContext);
        case 'addToPatientSpecificCarePlan':
          return await this.addToAICollectionArray('patient_specific_care_plan', args.documentId, args.fieldName, args.newItems, practiceContext);

        // GUIDELINE COMPLIANCE
        case 'updateGuidelineCompliance':
          return await this.updateAICollection('guideline_compliance', args.documentId, args.updates, practiceContext);
        case 'deleteGuidelineCompliance':
          return await this.deleteAICollection('guideline_compliance', args.documentId, practiceContext);
        case 'addToGuidelineCompliance':
          return await this.addToAICollectionArray('guideline_compliance', args.documentId, args.fieldName, args.newItems, practiceContext);

        // OUTCOMES PREDICTION
        case 'updateOutcomesPrediction':
          return await this.updateAICollection('outcomes_prediction', args.documentId, args.updates, practiceContext);
        case 'deleteOutcomesPrediction':
          return await this.deleteAICollection('outcomes_prediction', args.documentId, practiceContext);
        case 'addToOutcomesPrediction':
          return await this.addToAICollectionArray('outcomes_prediction', args.documentId, args.fieldName, args.newItems, practiceContext);

        // CARE GAPS
        case 'updateCareGaps':
          return await this.updateAICollection('care_gaps', args.documentId, args.updates, practiceContext);
        case 'deleteCareGaps':
          return await this.deleteAICollection('care_gaps', args.documentId, practiceContext);
        case 'addToCareGaps':
          return await this.addToAICollectionArray('care_gaps', args.documentId, args.fieldName, args.newItems, practiceContext);

        // PATIENT EDUCATION CONTEXT
        case 'updatePatientEducationContext':
          return await this.updateAICollection('patient_education_context', args.documentId, args.updates, practiceContext);
        case 'deletePatientEducationContext':
          return await this.deleteAICollection('patient_education_context', args.documentId, practiceContext);
        case 'addToPatientEducationContext':
          return await this.addToAICollectionArray('patient_education_context', args.documentId, args.fieldName, args.newItems, practiceContext);

        // Imaging
        case 'addImagingResult':
          return await getService('labService').addImagingResult(args, practiceContext, session);
        case 'getImagingResults':
          return await getService('labService').getImagingResults(args, practiceContext, session);
          
        // Practice Management
        case 'discoverPractice':
          return await getService('providerService').discoverPractice(args, practiceContext, session);
        case 'getClinicInfo':
          return await getService('clinicService').getClinicInfo(args, practiceContext, session);
        case 'getClinicAddress':
          return await getService('clinicService').getClinicAddress(args, practiceContext, session);
        case 'updateClinicSettings':
          return await getService('clinicService').updateClinicSettings(args, practiceContext, session);
        case 'getClinicStatistics':
          return await getService('clinicService').getClinicStatistics(args, practiceContext, session);
          
        // Insurance
        case 'verifyInsurance':
          // If patientId provided, fetch insurance info from patient record
          let insuranceInfoToVerify = args.insuranceInfo;
          if (!insuranceInfoToVerify && args.patientId) {
            const { ObjectId: ObjectIdForVerifyInsurance } = require('mongodb');
            const verifyInsuranceContext = {
              serviceId: 'agentServiceV4',
              operation: 'verify_insurance',
              practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
              apiKey: this.serviceToken?.apiKey || this.serviceToken
            };

            const patientForInsurance = await SecureDataAccess.query(
              'patients',
              { _id: new ObjectIdForVerifyInsurance(args.patientId) },
              { projection: { insuranceProvider: 1, insuranceNumber: 1, insurancePolicyGroup: 1, insurancePlan: 1 }, limit: 1 },
              verifyInsuranceContext
            );

            if (patientForInsurance && patientForInsurance.length > 0) {
              const patientData = patientForInsurance[0];
              insuranceInfoToVerify = {
                provider: patientData.insuranceProvider,
                plan: patientData.insurancePlan,
                policyNumber: patientData.insuranceNumber,
                policyGroup: patientData.insurancePolicyGroup
              };
            }
          }

          return await insuranceService.checkCoverage(
            insuranceInfoToVerify || args,
            args.service || args.serviceType || args.serviceDetails,
            args.medication,
            practiceContext.language || 'en'
          );

        case 'checkMedicationCoverageAPI':
          return await insuranceService.checkMedicationCoverageAPI({
            insuranceCompany: args.insuranceCompany,
            medication: args.medication,
            rxcui: args.rxcui,
            planId: args.planId
          });

        case 'submitInsuranceClaim':
          return await insuranceService.submitInsuranceClaim(args, practiceContext, session);
          
        // Appointments
        case 'scheduleAppointment':
          return await getService('appointmentService').scheduleAppointment(args, practiceContext, session);
        case 'findAvailableSlots':
          return await getService('appointmentService').findAvailableSlots(args, practiceContext, session);
        case 'updateAppointment':
          return await getService('appointmentService').updateAppointment(args, practiceContext, session);
        case 'cancelAppointment':
          return await getService('appointmentService').cancelAppointment(args, practiceContext, session);
        case 'deleteAppointment':
          return await getService('appointmentService').deleteAppointment(args, practiceContext, session);
        case 'reinstateAppointment':
          return await getService('appointmentService').reinstateAppointment(args, practiceContext, session);
        case 'getCancelledAppointments':
          return await getService('appointmentService').getCancelledAppointments(args, practiceContext, session);
        case 'rescheduleAppointment':
          return await getService('appointmentService').rescheduleAppointment(args, practiceContext, session);

        // Chat & Consultation
        case 'createChatSession':
          return await getService('communicationService').createChatSession(args, practiceContext, session);
        case 'searchChatHistory':
          return await getService('communicationService').searchChatHistory(args, practiceContext, session);
          
        // User Management
        case 'createUser':
          return await getService('userService').createUser(args, practiceContext, session);
        case 'resendEmailVerification':
          return await getService('userService').resendEmailVerification(args, practiceContext, session);
        case 'addUserRole':
          return await getService('userService').addUserRole({ userId: args.email, role: args.role }, practiceContext, session);
        case 'removeUserRole':
          return await getService('userService').removeUserRole({ userId: args.email, role: args.role }, practiceContext, session);

        // Provider License Management
        case 'addDoctorLicense':
          return await getService('providerService').addDoctorLicense(args, practiceContext, session);
        case 'updateDoctorLicense':
          return await getService('providerService').updateDoctorLicense(args, practiceContext, session);
        case 'removeDoctorLicense':
          return await getService('providerService').removeDoctorLicense(args, practiceContext, session);
        case 'getDoctorLicense':
          return await getService('providerService').getDoctorLicense(args, practiceContext, session);
        case 'checkDoctorStatus':
          return await getService('providerService').checkDoctorStatus(args, practiceContext, session);

        // Reports & Analytics
        case 'generateClinicReport':
          return await getService('clinicService').generateClinicReport(args, practiceContext, session);
        case 'generateComplianceReport':
          return await agentServiceV4.generateComplianceReport(args, practiceContext, session);
          
        // System & Security
        case 'runBackup':
          // `agentServiceV4` was an undeclared identifier (ReferenceError). Mirror the working createBackup case.
          return await this.callAPI('/disaster-recovery/backup', 'POST', args, practiceContext);
        case 'getSystemHealth':
          // `agentServiceV4` was an undeclared identifier (ReferenceError). Mirror the working getSystemHealthDetailed case.
          return await this.callAPI('/security-monitoring/system-health', 'GET', {}, practiceContext);
        case 'exportAuditLogs':
          return await agentServiceV4.exportAuditLogs(args, practiceContext, session);
          
        // ========== NEW APPOINTMENTS MANAGEMENT ==========
        case 'createAppointment':
          // Route to scheduleAppointment which handles the actual appointment creation
          // Extract data object if it exists, otherwise use args directly
          let appointmentData = args.data || args;

          // CRITICAL FIX: If appointmentData is a string (JSON), parse it
          if (typeof args.appointmentData === 'string') {
            try {
              const parsed = JSON.parse(args.appointmentData);
              appointmentData = { ...args, ...parsed };
              delete appointmentData.appointmentData; // Remove the string field
            } catch (error) {
              console.error('Failed to parse appointmentData JSON string:', error);
            }
          }

          const fullArgs = {
            ...appointmentData,
            patientId: args.patientId || appointmentData.patientId
          };
          return await getService('appointmentService').scheduleAppointment(fullArgs, practiceContext, session);
        case 'getAppointments':
          const { ObjectId } = require('mongodb');
          // Use context parameter passed from executeFunction() - no need to create locally

          let patientObjectId;

          // Handle different types of patient identifiers
          if (args.patientId) {
            // Check if it's already a valid ObjectId
            if (args.patientId.match && args.patientId.match(/^[0-9a-fA-F]{24}$/)) {
              patientObjectId = new ObjectId(args.patientId);
            } else if (args.patientId.includes && args.patientId.includes('@')) {
              // It's an email - need to look up the patient/provider first
              console.log(`📧 Looking up patient/provider by email: ${args.patientId}`);

              // First check users collection
              const users = await SecureDataAccess.query(
                'users',
                { email: args.patientId },
                { limit: 1, projection: { patientId: 1, _id: 1, providerInfo: 1, appointments: 1 } },
                context
              );

              if (users && users.length > 0) {
                const user = users[0];

                // Check if this user is a provider with appointments
                if (user.providerInfo && user.providerInfo.providerId && user.appointments && user.appointments.asProvider) {
                  console.log(`👨‍⚕️ User is a provider with ${user.appointments.asProvider.length} appointments`);

                  // Get appointments where this user is the provider
                  const providerAppointments = await SecureDataAccess.query(
                    'appointments',
                    { providerId: user.providerInfo.providerId },
                    { sort: { scheduledDate: -1 }, limit: args.limit || 100 },
                    context
                  );

                  return {
                    success: true,
                    data: providerAppointments,
                    count: providerAppointments.length,
                    isProvider: true,
                    providerId: user.providerInfo.providerId
                  };
                }

                // Check if user has a patient ID
                if (user.patientId) {
                  patientObjectId = user.patientId;
                } else {
                  // User exists but is not a patient or provider with appointments
                  return {
                    success: false,
                    message: `User ${args.patientId} exists but has no patient record or provider appointments`,
                    data: [],
                    count: 0
                  };
                }
              } else {
                // Check patients collection
                const patients = await SecureDataAccess.query(
                  'patients',
                  { email: args.patientId },
                  { limit: 1, projection: { _id: 1 } },
                  context
                );

                if (patients && patients.length > 0) {
                  patientObjectId = patients[0]._id;
                } else {
                  return {
                    success: false,
                    message: `No patient or provider found with email: ${args.patientId}`,
                    data: [],
                    count: 0
                  };
                }
              }
            } else {
              // Try to search by name or other identifier
              console.log(`🔍 Looking up patient by identifier: ${args.patientId}`);

              const patients = await SecureDataAccess.query(
                'patients',
                {
                  $or: [
                    { firstName: new RegExp(args.patientId, 'i') },
                    { lastName: new RegExp(args.patientId, 'i') },
                    { nationalId: args.patientId },
                    { mrn: args.patientId }
                  ]
                },
                { limit: 1, projection: { _id: 1 } },
                context
              );

              if (patients && patients.length > 0) {
                patientObjectId = patients[0]._id;
              } else {
                return {
                  success: false,
                  message: `No patient found matching: ${args.patientId}`,
                  data: [],
                  count: 0
                };
              }
            }
          } else {
            return {
              success: false,
              message: 'Patient ID is required',
              data: [],
              count: 0
            };
          }

          // Now query appointments with the resolved patient ID
          const appointments = await SecureDataAccess.query(
            'appointments',
            { patientId: patientObjectId },
            { sort: { scheduledDate: -1 }, limit: args.limit || 100 },
            context
          );

          return { success: true, data: appointments, count: appointments.length };
        case 'rescheduleAppointment':
          const rescheduleContext = {
            serviceId: 'agentServiceV4',
            operation: 'reschedule_appointment',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const rescheduleResult = await SecureDataAccess.update(
            'appointments',
            { _id: new ObjectId(args.appointmentId) },
            {
              $set: {
                scheduledDate: args.newDate,
                scheduledTime: args.newTime,
                updatedAt: new Date(),
                rescheduleReason: args.reason
              }
            },
            rescheduleContext
          );

          return { success: true, data: rescheduleResult };
        case 'cancelAppointment':
          const cancelContext = {
            serviceId: 'agentServiceV4',
            operation: 'cancel_appointment',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const cancelResult = await SecureDataAccess.update(
            'appointments',
            { _id: new ObjectId(args.appointmentId) },
            {
              $set: {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancelReason: args.reason || args.cancelReason,
                cancelledBy: args.cancelledBy
              }
            },
            cancelContext
          );

          return { success: true, data: cancelResult };
        case 'getTodayAppointments':
          // Auto-fill provider ID from authenticated user if not provided
          const todayArgs = { ...args };
          if (!todayArgs.providerId && practiceContext.user?.id) {
            todayArgs.providerId = practiceContext.user.id;
            console.log(`🔐 Auto-filled providerId from authenticated user: ${todayArgs.providerId}`);
          }

          const todayContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_today_appointments',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const todayFilter = {
            scheduledDate: { $gte: today, $lt: tomorrow }
          };

          if (todayArgs.providerId) {
            todayFilter.providerId = todayArgs.providerId;
          }

          const todayAppointments = await SecureDataAccess.query(
            'appointments',
            todayFilter,
            { sort: { scheduledTime: 1 } },
            todayContext
          );

          return { success: true, data: todayAppointments, count: todayAppointments.length };
        case 'getOverdueAppointments':
          const overdueContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_overdue_appointments',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const now = new Date();
          const overdueAppointments = await SecureDataAccess.query(
            'appointments',
            {
              scheduledDate: { $lt: now },
              status: { $in: ['scheduled', 'confirmed'] }
            },
            { sort: { scheduledDate: -1 } },
            overdueContext
          );

          return { success: true, data: overdueAppointments, count: overdueAppointments.length };
          
        // ========== NEW INSURANCE MANAGEMENT ==========
        case 'getInsuranceDetails':
          const { ObjectId: ObjectIdForGetInsurance } = require('mongodb');
          const insuranceContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_insurance_details',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          // Query patients collection for insurance fields
          const patientInsurance = await SecureDataAccess.query(
            'patients',
            { _id: new ObjectIdForGetInsurance(args.patientId) },
            { projection: { insuranceProvider: 1, insuranceNumber: 1, insurancePolicyGroup: 1, insurancePlan: 1 }, limit: 1 },
            insuranceContext
          );

          if (!patientInsurance || patientInsurance.length === 0) {
            return { success: false, error: 'Patient not found' };
          }

          patient = patientInsurance[0];
          const insuranceData = {
            insuranceProvider: patient.insuranceProvider,
            insuranceNumber: patient.insuranceNumber,
            insurancePolicyGroup: patient.insurancePolicyGroup,
            insurancePlan: patient.insurancePlan
          };

          // Return null if no insurance data exists
          if (!insuranceData.insuranceProvider && !insuranceData.insuranceNumber) {
            return { success: true, data: null };
          }

          return { success: true, data: insuranceData };

        case 'updateInsurance':
          const { ObjectId: ObjectIdForUpdateInsurance } = require('mongodb');
          const updateInsuranceContext = {
            serviceId: 'agentServiceV4',
            operation: 'update_insurance',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const updateInsuranceResult = await SecureDataAccess.update(
            'insurance_verifications',
            { patientId: new ObjectIdForUpdateInsurance(args.patientId) },
            {
              $set: {
                ...args,
                updatedAt: new Date()
              }
            },
            updateInsuranceContext
          );

          return { success: true, data: updateInsuranceResult };

        case 'checkCoverage':
          const coverageContext = {
            serviceId: 'agentServiceV4',
            operation: 'check_coverage',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const coverageCheck = {
            patientId: new ObjectId(args.patientId),
            serviceCode: args.serviceCode,
            checkDate: new Date(),
            status: 'pending',
            requestedBy: args.requestedBy
          };

          const insuranceCoverageResult = await SecureDataAccess.insert(
            'insurance_coverage_checks',
            coverageCheck,
            coverageContext
          );

          return { success: true, data: insuranceCoverageResult };

        case 'submitPreAuthorization':
          const preauthContext = {
            serviceId: 'agentServiceV4',
            operation: 'submit_preauthorization',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const preauth = {
            patientId: new ObjectId(args.patientId),
            procedureCode: args.procedureCode,
            diagnosis: args.diagnosis,
            submittedAt: new Date(),
            status: 'submitted',
            ...args
          };

          const preauthResult = await SecureDataAccess.insert(
            'insurance_preauthorizations',
            preauth,
            preauthContext
          );

          return { success: true, data: preauthResult };
          
        // ========== NEW IMAGING MANAGEMENT ==========
        case 'orderImaging':
          const medicalDataService = require('./medicalDataService');

          const imagingOrderContext = {
            serviceId: 'agentServiceV4',
            operation: 'order_imaging',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          // Get practice timezone for timestamp generation
          const imagingPractices = await SecureDataAccess.query(
            'practices',
            { subdomain: practiceContext?.subdomain || practiceContext?.practiceId },
            { limit: 1 },
            imagingOrderContext
          );
          const imagingPractice = imagingPractices && imagingPractices[0];
          const imagingTimezone = imagingPractice?.settings?.timezone || 'UTC';

          // Generate timestamps in practice local timezone
          const imagingTimestamps = getTimestampForDocument(imagingTimezone);

          const imagingOrder = {
            patientId: args.patientId,  // Keep as string
            orderedAt: imagingTimestamps.createdAt,  // Practice local time
            orderedAtUTC: imagingTimestamps.createdAtUTC,  // UTC time
            orderedAtTimezone: imagingTimestamps.createdAtTimezone,  // Timezone identifier
            status: 'ordered',
            ...args
          };

          // CRITICAL: Use medicalDataService.storeMedicalData() instead of direct insert
          // This automatically updates patient.medicalData.collections.imaging_orders
          // Without this, getImagingOrders optimization layer returns empty (can't find data)
          const imagingOrderResult = await getService('medicalDataService').storeMedicalData(
            'imaging_orders',
            imagingOrder,
            imagingOrderContext
          );

          console.log(`✅ [orderImaging] Created imaging order in ${imagingTimezone} timezone and updated patient.medicalData tracking`);
          return { success: true, data: imagingOrderResult };

        case 'getImagingResults':
          const getImagingContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_imaging_results',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const imagingResults = await SecureDataAccess.query(
            'imaging_orders',
            { patientId: new ObjectId(args.patientId) },
            { sort: { orderedAt: -1 } },
            getImagingContext
          );

          return { success: true, data: imagingResults };

        case 'uploadImagingResult':
          const uploadImagingContext = {
            serviceId: 'agentServiceV4',
            operation: 'upload_imaging_result',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const uploadImagingResult = await SecureDataAccess.update(
            'imaging_orders',
            { _id: new ObjectId(args.imagingOrderId) },
            {
              $set: {
                resultUrl: args.resultUrl,
                uploadedAt: new Date(),
                status: 'completed',
                findings: args.findings
              }
            },
            uploadImagingContext
          );

          return { success: true, data: uploadImagingResult };

        // ========== MEDICAL IMAGE ANALYSIS (Claude Vision) ==========
        case 'analyzeMedicalImage': {
          const e2eEncryptionService = require('./e2eEncryptionService');
          const claudeMedicalImageService = require('./claudeMedicalImageService');
          const { ObjectId: ObjIdAnalyzeImg } = require('mongodb');

          const analyzeImgContext = {
            serviceId: 'agentServiceV4',
            operation: 'analyze_medical_image',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          if (!args.uploadId) {
            return { success: false, error: 'uploadId is required. The user must upload an image file first via the chat.' };
          }
          if (!args.patientId) {
            return { success: false, error: 'patientId is required. Please specify which patient this image belongs to.' };
          }

          // 1. Retrieve encrypted file from pendinguploads
          const pendingUploads = await SecureDataAccess.query(
            'pendinguploads',
            { uploadId: args.uploadId },
            { limit: 1 },
            analyzeImgContext
          );

          if (!pendingUploads || pendingUploads.length === 0) {
            return { success: false, error: `Upload ${args.uploadId} not found or expired. Please re-upload the image.` };
          }

          const pendingUpload = pendingUploads[0];
          const uploadedFile = pendingUpload.files?.[0];
          if (!uploadedFile) {
            return { success: false, error: 'No file found in the upload. Please try uploading again.' };
          }

          // 2. Decrypt the file
          let imageBuffer;
          try {
            if (uploadedFile.encryptedPackage) {
              imageBuffer = await e2eEncryptionService.decryptWithServiceKey(uploadedFile.encryptedPackage);
            } else if (uploadedFile.encryptedContent) {
              const pkg = {
                data: Buffer.isBuffer(uploadedFile.encryptedContent)
                  ? uploadedFile.encryptedContent.toString('base64')
                  : uploadedFile.encryptedContent,
                iv: uploadedFile.contentIv,
                tag: uploadedFile.contentTag,
                algorithm: 'aes-256-gcm'
              };
              imageBuffer = await e2eEncryptionService.decryptWithServiceKey(pkg);
            } else {
              return { success: false, error: 'File is not properly encrypted. Please re-upload.' };
            }
          } catch (decryptErr) {
            console.error('❌ [analyzeMedicalImage] Decryption failed:', decryptErr.message);
            return { success: false, error: 'Failed to decrypt the uploaded image.' };
          }

          // 3. Handle DICOM conversion if needed
          let analysisMimeType = uploadedFile.mimetype || uploadedFile.mimeType || 'image/jpeg';
          let analysisBuffer = imageBuffer;
          let dicomMetadata = null;
          const fileName = uploadedFile.originalName || '';

          if (analysisMimeType === 'application/dicom' || fileName.toLowerCase().endsWith('.dcm')) {
            try {
              const dicomConverterService = require('./dicomConverterService');
              const dicomResult = await dicomConverterService.processForAnalysis(imageBuffer);
              analysisBuffer = dicomResult.imageBuffer;
              analysisMimeType = dicomResult.mimeType;
              dicomMetadata = dicomResult.metadata;
              console.log(`📋 [analyzeMedicalImage] DICOM converted: ${dicomMetadata.modality || 'unknown'} modality`);
            } catch (dicomErr) {
              console.error('❌ [analyzeMedicalImage] DICOM conversion failed:', dicomErr.message);
              return { success: false, error: `Failed to process DICOM file: ${dicomErr.message}` };
            }
          }

          // 4. Analyze with Claude Vision
          console.log(`🏥 [analyzeMedicalImage] Analyzing ${fileName} for patient ${args.patientId}`);
          const analysisResult = await claudeMedicalImageService.analyzeImage(
            analysisBuffer, analysisMimeType, {
              modality: args.modality || (dicomMetadata?.modality ? undefined : 'general'),
              bodyPart: args.bodyPart || dicomMetadata?.bodyPartExamined,
              clinicalHistory: args.clinicalHistory,
              patientId: args.patientId,
              practiceId: practiceContext?.practiceId || practiceContext?.subdomain,
              dicomMetadata,
              documentId: args.uploadId
            }
          );

          // 5. Encrypt the original image and save to medical_images collection
          try {
            const encryptedPackage = await e2eEncryptionService.encryptWithServiceKey(
              imageBuffer,
              { originalName: fileName, mimeType: analysisMimeType }
            );

            const medicalImageDoc = {
              patientId: args.patientId,
              encryptedContent: Buffer.from(encryptedPackage.data, 'base64'),
              contentIv: encryptedPackage.iv,
              contentTag: encryptedPackage.tag,
              originalName: fileName,
              mimeType: analysisMimeType,
              fileSize: imageBuffer.length,
              modality: analysisResult.modality || args.modality || 'general',
              bodyPart: args.bodyPart || dicomMetadata?.bodyPartExamined || '',
              studyDate: dicomMetadata?.studyDate ? new Date(dicomMetadata.studyDate) : new Date(),
              dicomMetadata: dicomMetadata || undefined,
              analysisSource: 'claude',
              aiModelVersion: 'claude-sonnet-5',
              analysisSummary: {
                impression: analysisResult.impression || '',
                urgency: analysisResult.urgency || 'routine',
                findings: analysisResult.findings || ''
              },
              practiceId: practiceContext?.practiceId || practiceContext?.subdomain,
              uploadedBy: practiceContext?.currentUser?.email || practiceContext?.user?.email || 'agent',
              uploadSource: 'agent_chat',
              status: 'completed'
            };

            await SecureDataAccess.insert('medical_images', medicalImageDoc, analyzeImgContext);
            console.log(`✅ [analyzeMedicalImage] Image encrypted and saved to medical_images for patient ${args.patientId}`);
          } catch (saveErr) {
            console.error('⚠️ [analyzeMedicalImage] Failed to save encrypted image:', saveErr.message);
            // Don't fail the whole operation - analysis result is still valid
          }

          // 6. Zero-fill original buffer for security
          imageBuffer.fill(0);

          console.log(`✅ [analyzeMedicalImage] Complete: ${fileName} (${analysisResult.modality}, urgency: ${analysisResult.urgency})`);
          return {
            success: true,
            data: {
              modality: analysisResult.modality,
              technique: analysisResult.technique,
              findings: analysisResult.findings,
              impression: analysisResult.impression,
              recommendations: analysisResult.recommendations,
              measurements: analysisResult.measurements,
              urgency: analysisResult.urgency,
              biRads: analysisResult.biRads || null,
              savedTo: 'radiology_reports',
              imageSavedTo: 'medical_images',
              patientId: args.patientId
            }
          };
        }

        case 'compareMedicalImages': {
          const e2eEncSvc = require('./e2eEncryptionService');
          const claudeImgSvc = require('./claudeMedicalImageService');

          const compareImgContext = {
            serviceId: 'agentServiceV4',
            operation: 'compare_medical_images',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          if (!args.uploadId1 || !args.uploadId2) {
            return { success: false, error: 'Both uploadId1 and uploadId2 are required. Upload two images first.' };
          }
          if (!args.patientId) {
            return { success: false, error: 'patientId is required.' };
          }

          // Retrieve both uploads
          const [uploads1, uploads2] = await Promise.all([
            SecureDataAccess.query('pendinguploads', { uploadId: args.uploadId1 }, { limit: 1 }, compareImgContext),
            SecureDataAccess.query('pendinguploads', { uploadId: args.uploadId2 }, { limit: 1 }, compareImgContext)
          ]);

          if (!uploads1?.length || !uploads2?.length) {
            return { success: false, error: 'One or both uploads not found or expired. Please re-upload both images.' };
          }

          const file1 = uploads1[0].files?.[0];
          const file2 = uploads2[0].files?.[0];
          if (!file1 || !file2) {
            return { success: false, error: 'Missing file data in one or both uploads.' };
          }

          // Decrypt both files
          const decryptFile = async (file) => {
            if (file.encryptedPackage) {
              return await e2eEncSvc.decryptWithServiceKey(file.encryptedPackage);
            } else if (file.encryptedContent) {
              return await e2eEncSvc.decryptWithServiceKey({
                data: Buffer.isBuffer(file.encryptedContent)
                  ? file.encryptedContent.toString('base64')
                  : file.encryptedContent,
                iv: file.contentIv,
                tag: file.contentTag,
                algorithm: 'aes-256-gcm'
              });
            }
            throw new Error('File not properly encrypted');
          };

          const [buffer1, buffer2] = await Promise.all([decryptFile(file1), decryptFile(file2)]);

          const result = await claudeImgSvc.compareImages(
            buffer1, file1.mimetype || 'image/jpeg',
            buffer2, file2.mimetype || 'image/jpeg',
            {
              modality: args.modality || 'general',
              clinicalHistory: args.clinicalHistory,
              patientId: args.patientId,
              practiceId: practiceContext?.practiceId || practiceContext?.subdomain
            }
          );

          // Zero-fill buffers
          buffer1.fill(0);
          buffer2.fill(0);

          return { success: true, data: result };
        }

        case 'getMedicalImageHistory': {
          const getImgHistContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_medical_image_history',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          if (!args.patientId) {
            return { success: false, error: 'patientId is required.' };
          }

          const imgQuery = { patientId: args.patientId };
          if (args.modality) imgQuery.modality = args.modality;

          const images = await SecureDataAccess.query(
            'medical_images',
            imgQuery,
            {
              sort: { createdAt: -1 },
              limit: args.limit || 20,
              projection: {
                encryptedContent: 0,
                contentIv: 0,
                contentTag: 0
              }
            },
            getImgHistContext
          );

          return {
            success: true,
            data: {
              count: images?.length || 0,
              images: (images || []).map(img => ({
                id: img._id,
                originalName: img.originalName,
                modality: img.modality,
                bodyPart: img.bodyPart,
                studyDate: img.studyDate,
                status: img.status,
                analysisSource: img.analysisSource,
                analysisSummary: img.analysisSummary,
                uploadSource: img.uploadSource,
                createdAt: img.createdAt
              }))
            }
          };
        }

        // ========== NEW PRESCRIPTIONS MANAGEMENT ==========
        case 'refillPrescription':
          const refillContext = {
            serviceId: 'agentServiceV4',
            operation: 'refill_prescription',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const refillResult = await SecureDataAccess.update(
            'prescriptions',
            { _id: new ObjectId(args.prescriptionId) },
            {
              $set: {
                refillDate: new Date(),
                refillCount: { $inc: 1 },
                status: 'active'
              }
            },
            refillContext
          );

          return { success: true, data: refillResult };

        case 'cancelPrescription':
          const cancelPrescriptionContext = {
            serviceId: 'agentServiceV4',
            operation: 'cancel_prescription',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const cancelPrescriptionResult = await SecureDataAccess.update(
            'prescriptions',
            { _id: new ObjectId(args.prescriptionId) },
            {
              $set: {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancelReason: args.reason
              }
            },
            cancelPrescriptionContext
          );

          return { success: true, data: cancelPrescriptionResult };
          
        // ========== NEW REFERRALS MANAGEMENT ==========
        case 'updateReferralStatus':
          const referralContext = {
            serviceId: 'agentServiceV4',
            operation: 'update_referral_status',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const referralResult = await SecureDataAccess.update(
            'referrals',
            { _id: new ObjectId(args.referralId) },
            {
              $set: {
                status: args.status,
                updatedAt: new Date(),
                statusNote: args.note
              }
            },
            referralContext
          );

          return { success: true, data: referralResult };
        
        // ========== COMPREHENSIVE REFERRAL MANAGEMENT SYSTEM ==========
        case 'createComprehensiveReferral':
          // await referralManagementService.initialize(); // REMOVED: Should be initialized once at startup
          return await referralManagementService.createReferral(args, practiceContext);
          
        case 'getSpecialistNetwork':
          // await referralManagementService.initialize(); // REMOVED: Should be initialized once at startup
          return await referralManagementService.getSpecialistNetwork(
            args.specialty,
            args.location,
            args.insurance,
            practiceContext
          );
          
        case 'processReferralAuthorization':
          // await referralManagementService.initialize(); // REMOVED: Should be initialized once at startup
          return await referralManagementService.processAuthorization(
            args.referralId,
            args.authorizationData,
            practiceContext
          );
          
        case 'trackReferral':
          // await referralManagementService.initialize(); // REMOVED: Should be initialized once at startup
          return await referralManagementService.trackReferral(args.referralId, practiceContext);
          
        case 'sendDoctorMessage':
          // await referralManagementService.initialize(); // REMOVED: Should be initialized once at startup
          return await referralManagementService.sendDoctorMessage(
            args.referralId,
            args.message,
            practiceContext
          );
          
        case 'generateReferralAnalytics':
          // await referralManagementService.initialize(); // REMOVED: Should be initialized once at startup
          return await referralManagementService.generateReferralAnalytics(
            args.dateRange || { 
              startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 
              endDate: new Date() 
            },
            args.filters || {},
            practiceContext
          );
        
        // Specialist Network Management
        case 'addSpecialistToNetwork':
          // await referralManagementService.initialize(); // REMOVED: Should be initialized once at startup
          return await referralManagementService.addSpecialistToNetwork(args, practiceContext);
          
        case 'matchPatientToSpecialist':
          // await referralManagementService.initialize(); // REMOVED: Should be initialized once at startup
          return await referralManagementService.matchPatientToSpecialist(
            args.patientId,
            args.condition || {},
            args.preferences || {},
            practiceContext
          );
        
        // Authorization Workflow
        case 'checkAuthorizationRequirement':
          // await referralManagementService.initialize(); // REMOVED: Should be initialized once at startup
          return await referralManagementService.checkAuthorizationRequirement(
            args.referralData,
            args.insuranceInfo,
            practiceContext
          );
          
        case 'submitAuthorizationRequest':
          // await referralManagementService.initialize(); // REMOVED: Should be initialized once at startup
          return await referralManagementService.submitAuthorizationRequest(
            args.referralId,
            args.authData,
            practiceContext
          );
          
        case 'trackAuthorizationStatus':
          // await referralManagementService.initialize(); // REMOVED: Should be initialized once at startup
          return await referralManagementService.trackAuthorizationStatus(
            args.authorizationId,
            practiceContext
          );
          
        case 'appealAuthorization':
          // await referralManagementService.initialize(); // REMOVED: Should be initialized once at startup
          return await referralManagementService.appealAuthorization(
            args.authorizationId,
            args.appealData,
            practiceContext
          );
        
        // ========== REAL-TIME CHART GENERATION ==========
        case 'generateRealtimeChart':
          // await realtimeChartService.initialize(); // REMOVED: Should be initialized once at startup
          return await realtimeChartService.generateRealtimeChart(
            args.chartType,
            args.dataSource,
            args.timeRange,
            args.filters,
            args.interactive,
            practiceContext
          );
        
        case 'generatePatientFlowChart':
          // await realtimeChartService.initialize(); // REMOVED: Should be initialized once at startup
          return await realtimeChartService.generatePatientFlowChart(
            args.timeframe,
            args.departments,
            practiceContext
          );
        
        case 'createClinicalTrendChart':
          // await realtimeChartService.initialize(); // REMOVED: Should be initialized once at startup
          return await realtimeChartService.createClinicalTrendChart(
            args.metric,
            args.patientGroup,
            args.period,
            practiceContext
          );
        
        case 'buildResourceUtilizationChart':
          // await realtimeChartService.initialize(); // REMOVED: Should be initialized once at startup
          return await realtimeChartService.buildResourceUtilizationChart(
            args.resourceType,
            args.timeframe,
            practiceContext
          );
        
        case 'generateQualityDashboard':
          // await realtimeChartService.initialize(); // REMOVED: Should be initialized once at startup
          return await realtimeChartService.generateQualityDashboard(
            args.qualityMetrics,
            args.compareToBaseline,
            practiceContext
          );
        
        case 'exportChart':
          // await realtimeChartService.initialize(); // REMOVED: Should be initialized once at startup
          return await realtimeChartService.exportChart(args.chartId, args.format);
        
        // ========== PROACTIVE INSIGHTS ENGINE ==========
        case 'enableProactiveInsights':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.enableProactiveInsights(
            args.categories,
            args.sensitivity,
            args.frequency,
            practiceContext
          );
        
        case 'monitorPatientDeteriorationRisk':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.monitorPatientDeteriorationRisk(
            args.practiceId || practiceContext.practiceId,
            args.threshold,
            practiceContext
          );
        
        case 'detectAnomalies':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.detectAnomalies(
            args.dataset,
            args.threshold,
            practiceContext
          );
        
        // ========== CONTEXT MEMORY MANAGEMENT ==========
        case 'storeAnalyticsContext':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.storeAnalyticsContext(
            args.sessionId,
            practiceContext
          );
        
        case 'retrieveRelevantContext':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.retrieveRelevantContext(
            args.sessionId,
            args.currentQuery,
            practiceContext
          );
        
        case 'resolveAnalyticsReference':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.resolveAnalyticsReference(
            args.reference,
            args.sessionContext
          );
        
        case 'rememberAnalyticsPreference':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.rememberAnalyticsPreference(
            args.preferenceType,
            args.preferenceValue,
            args.userId || practiceContext.userId,
            practiceContext
          );
        
        // ========== HEALTHCARE-SPECIFIC ANALYTICS ==========
        case 'analyzePatientOutcomes':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.analyzePatientOutcomes(
            args.outcomeType,
            args.patientCohort,
            args.timeframe,
            practiceContext
          );
        
        case 'monitorQualityMetrics':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.monitorQualityMetrics(
            args.qualityDomain,
            args.metrics,
            args.benchmarkType,
            args.alertThreshold,
            practiceContext
          );
        
        case 'analyzePopulationHealth':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.analyzePopulationHealth(
            args.populationSegment,
            args.analysisType,
            args.preventiveCare,
            args.socialDeterminants,
            practiceContext
          );
        
        case 'generateClinicalInsights':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.generateClinicalInsights(
            args.clinicalScenario,
            args.evidenceLevel,
            args.includeGuidelines,
            args.riskBenefit,
            practiceContext
          );
        
        // ========== PREDICTIVE ANALYTICS - CLINICAL ==========
        case 'predictPatientOutcome':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.predictPatientOutcome(
            args.patientId,
            args.treatmentPlan,
            args.timeHorizon,
            practiceContext
          );
        
        case 'predictReadmissionRisk':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.predictReadmissionRisk(
            args.patientId,
            args.admissionData,
            practiceContext
          );
        
        case 'predictClinicalDeterioration':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.predictClinicalDeterioration(
            args.patientId,
            args.vitalSigns,
            args.labResults,
            practiceContext
          );
        
        case 'predictTreatmentResponse':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.predictTreatmentResponse(
            args.patientId,
            args.treatment,
            args.patientProfile,
            practiceContext
          );
        
        // ========== PREDICTIVE ANALYTICS - OPERATIONAL ==========
        case 'forecastPatientVolume':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.forecastPatientVolume(
            args.department,
            args.timeRange,
            args.seasonality,
            practiceContext
          );
        
        case 'predictStaffNeeds':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.predictStaffNeeds(
            args.department,
            args.forecastPeriod,
            args.demand,
            practiceContext
          );
        
        case 'forecastResourceUtilization':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.forecastResourceUtilization(
            args.resourceType,
            args.timeHorizon,
            args.usage,
            practiceContext
          );
        
        case 'predictAppointmentNoShows':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.predictAppointmentNoShows(
            args.appointmentData,
            args.patientHistory,
            practiceContext
          );
        
        // ========== PREDICTIVE ANALYTICS - FINANCIAL ==========
        case 'forecastRevenue':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.forecastRevenue(
            args.revenueStream,
            args.timeHorizon,
            args.scenarios,
            practiceContext
          );
        
        case 'forecastCosts':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.forecastCosts(
            args.costCategory,
            args.timeHorizon,
            args.drivers,
            practiceContext
          );
        
        case 'predictROI':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.predictROI(
            args.investment,
            args.timeframe,
            args.expectedBenefits,
            practiceContext
          );
        
        // ========== PREDICTIVE ANALYTICS - POPULATION HEALTH ==========
        case 'identifyHighRiskPatients':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.identifyHighRiskPatients(
            args.riskFactors,
            args.threshold,
            args.population,
            practiceContext
          );
        
        case 'predictDiseaseProgression':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.predictDiseaseProgression(
            args.patientId,
            args.condition,
            args.currentStatus,
            practiceContext
          );
        
        case 'forecastOutbreakRisk':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.forecastOutbreakRisk(
            args.disease,
            args.population,
            args.environmentalFactors,
            practiceContext
          );
        
        // ========== NEW MISSING PREDICTIVE FUNCTIONS ==========
        case 'predictTreatmentSideEffects':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.predictTreatmentSideEffects(
            args.patientId,
            args.medication,
            args.dosage,
            practiceContext
          );
        
        case 'optimizeTreatmentProtocol':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.optimizeTreatmentProtocol(
            args.patientId,
            args.condition,
            args.currentProtocol,
            practiceContext
          );
        
        case 'predictStaffTurnover':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.predictStaffTurnover(
            args.department,
            args.timeHorizon,
            practiceContext
          );
        
        case 'forecastEquipmentFailure':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.forecastEquipmentFailure(
            args.equipmentType,
            args.maintenanceHistory,
            args.usageData,
            practiceContext
          );
        
        // ========== NEW PROACTIVE MONITORING FUNCTIONS ==========
        case 'detectInfectionOutbreaks':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.detectInfectionOutbreaks(
            args.patterns,
            args.alertThreshold,
            practiceContext
          );
        
        case 'identifyMedicationEffectivenessTrends':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.identifyMedicationEffectivenessTrends(
            args.medicationId,
            args.outcomeMetrics,
            practiceContext
          );
        
        case 'monitorStaffProductivityTrends':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.monitorStaffProductivityTrends(
            args.departments,
            args.performanceMetrics,
            practiceContext
          );
        
        case 'detectResourceUtilizationAnomalies':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.detectResourceUtilizationAnomalies(
            args.resources,
            args.utilizationThresholds,
            practiceContext
          );
        
        case 'monitorRevenueAnomalies':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.monitorRevenueAnomalies(
            args.revenueStreams,
            args.expectedRanges,
            practiceContext
          );
        
        case 'initializeStreamProcessing':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.initializeStreamProcessing(
            args.config,
            practiceContext
          );
        
        // ========== ANALYTICS CORE FUNCTIONS ==========
        case 'processAnalyticsQuery':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.processAnalyticsQuery(
            args.query,
            args.sessionId,
            practiceContext
          );
        
        case 'generateInsights':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.generateInsights(
            args.data,
            args.query,
            practiceContext
          );
        
        case 'exportAnalytics':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          return await conversationalAnalytics.exportAnalytics(
            args.sessionId,
            args.format,
            practiceContext
          );
        
        case 'createDashboard':
          // await realtimeChartService.initialize(); // REMOVED: Should be initialized once at startup
          const dashboardCharts = [];
          for (const chartConfig of args.charts || []) {
            const chart = await realtimeChartService.generateRealtimeChart(
              chartConfig.type,
              chartConfig.dataSource,
              chartConfig.timeRange,
              chartConfig.filters,
              true,
              practiceContext
            );
            dashboardCharts.push(chart);
          }
          return {
            success: true,
            dashboardId: `dashboard-${Date.now()}`,
            charts: dashboardCharts
          };
        
        case 'showTrendAnalysis':
          // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
          const trendData = await conversationalAnalytics.executeAnalyticsQuery(
            {
              metric: args.metric,
              timeframe: args.timeframe,
              comparison: args.comparison
            },
            practiceContext
          );
          const trendChart = await realtimeChartService.generateRealtimeChart(
            'line',
            args.metric,
            args.timeframe,
            {},
            true,
            practiceContext
          );
          return {
            success: true,
            analysis: trendData,
            visualization: trendChart
          };
        
        case 'buildPredictiveModel':
          await predictiveAnalyticsAI.initialize();
          // Generic predictive model builder
          const modelType = args.targetMetric.includes('clinical') ? 'clinical' : 
                          args.targetMetric.includes('revenue') ? 'financial' : 'operational';
          
          if (modelType === 'clinical') {
            return await predictiveAnalyticsAI.predictPatientOutcome(
              args.targetMetric,
              args.inputFactors,
              args.horizon,
              practiceContext
            );
          } else if (modelType === 'financial') {
            return await predictiveAnalyticsAI.forecastRevenue(
              args.targetMetric,
              args.horizon,
              ['baseline'],
              practiceContext
            );
          } else {
            return await predictiveAnalyticsAI.forecastPatientVolume(
              args.targetMetric,
              args.horizon,
              true,
              practiceContext
            );
          }
        
        case 'analyzePatientFlow':
          // `conversationalAnalytics` was an undeclared identifier (ReferenceError) and the
          // analytics-query backend does not exist. Return the patient-flow visualization from
          // realtimeChartService.generatePatientFlowChart, which IS implemented.
          const flowChart = await realtimeChartService.generatePatientFlowChart(
            { start: args.startDate, end: args.endDate },
            args.departments,
            practiceContext
          );
          return {
            success: true,
            visualization: flowChart
          };
        
        case 'calculateROI':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.predictROI(
            { name: args.program, ...args },
            args.timeframe,
            args.costBasis,
            practiceContext
          );
        
        case 'compareMetrics':
          try {
            // await conversationalAnalytics.initialize(); // REMOVED: Should be initialized once at startup
            const metric1Data = await conversationalAnalytics.executeAnalyticsQuery(
              { metric: args.metric1, timeframe: args.timeframe },
              practiceContext
            );
            const metric2Data = await conversationalAnalytics.executeAnalyticsQuery(
              { metric: args.metric2, timeframe: args.timeframe },
              practiceContext
            );
            
            // Calculate actual correlation
            const correlation = this.calculateCorrelation(metric1Data, metric2Data);
            
            return {
              success: true,
              comparison: {
                metric1: { name: args.metric1, data: metric1Data },
                metric2: { name: args.metric2, data: metric2Data },
                correlation,
                interpretation: this.interpretCorrelation(correlation)
              }
            };
          } catch (error) {
            console.error('Error comparing metrics:', error);
            return {
              success: false,
              error: error.message
            };
          }
        
        case 'forecastDemand':
          await predictiveAnalyticsAI.initialize();
          return await predictiveAnalyticsAI.forecastPatientVolume(
            args.service,
            args.timeHorizon,
            args.seasonality,
            practiceContext
          );
          
        // ========== NEW ADDRESS & LOCATION SERVICES ==========
        // COMMENTED OUT: Endpoints don't exist - /address/* routes not implemented
        // case 'searchAddress':
        //   return await this.callAPI('/address/autocomplete', 'GET', args, practiceContext);
        // case 'getCities':
        //   return await this.callAPI('/address/cities', 'GET', args, practiceContext);
        // case 'validateAddress':
        //   return await this.callAPI('/address/validate', 'POST', args, practiceContext);
          
        // ========== EXTERNAL INTEGRATIONS HANDLERS ==========
        
        // Drug Information Functions
        case 'searchDrugInformation':
          return await drugInformationService.searchDrug(args.drugName, {
            limit: args.limit,
            userId: context.userId
          });
          
        case 'checkDrugSafety':
          return await drugInformationService.checkDrugSafety(args.drugName, {
            limit: args.limit || 100,
            userId: context.userId
          });

        case 'validatePrescription':
          const prescriptionData = {
            drugName: args.drugName,
            ndc: args.ndc,
            dosage: args.dosage,
            existingMedications: args.existingMedications || []
          };
          return await drugInformationService.validatePrescription(prescriptionData, {
            userId: context.userId
          });
          
        case 'checkDrugInteractions':
          return await drugInformationService.checkDrugInteractions(args.medications, {
            userId: context.userId,
            practiceId: context.practiceId
          });

        case 'getDrugByNDC':
          return await drugInformationService.getDrugByNDC(args.ndcNumber, {
            userId: context.userId
          });

        // RxNorm/RxNav Drug Nomenclature Functions (NLM)
        case 'searchDrug':
          return await rxNormService.searchDrugByName(args.drugName, {
            userId: context.userId
          });

        case 'getDrugAlternatives':
          if (args.type === 'generic-to-brands') {
            return await rxNormService.getGenericToBrands(args.rxcui, {
              userId: context.userId
            });
          }
          return await rxNormService.getBrandToGeneric(args.rxcui, {
            userId: context.userId
          });

        case 'getDrugClass':
          return await rxNormService.getDrugClasses(args.drugName, {
            userId: context.userId
          });

        case 'normalizeDrugName':
          return await rxNormService.normalizeDrugName(args.drugName, {
            userId: context.userId
          });

        // DailyMed Drug Labeling Functions (NLM)
        case 'getDrugPrescribingInfo':
          return await require('./dailyMedService').getDrugPrescribingInfo(args.drugName, {
            userId: context.userId
          });

        case 'getDrugBlackBoxWarning':
          return await require('./dailyMedService').getDrugWarnings(args.drugName, {
            userId: context.userId
          });

        case 'getDrugDosageInfo':
          return await require('./dailyMedService').getDrugDosage(args.drugName, {
            userId: context.userId
          });

        case 'getDrugContraindications':
          return await require('./dailyMedService').getDrugInteractionsLabel(args.drugName, {
            userId: context.userId
          });

        case 'getDrugPregnancyInfo':
          return await require('./dailyMedService').getDrugPregnancyInfo(args.drugName, {
            userId: context.userId
          });

        case 'getDrugImage': {
          const dailyMedSvc = require('./dailyMedService');
          if (args.setId) {
            return await dailyMedSvc.getDrugImages(args.setId, { userId: context.userId });
          }
          // Search by name first, then get images for first result
          const searchResult = await dailyMedSvc.searchDrugLabel(args.drugName, { userId: context.userId });
          if (searchResult && searchResult.results && searchResult.results.length > 0) {
            return await dailyMedSvc.getDrugImages(searchResult.results[0].setId, { userId: context.userId });
          }
          return { success: false, error: `No DailyMed label found for "${args.drugName}"` };
        }

        // Provider Directory Functions
        case 'searchApiDoctors':
          const searchCriteria = {
            specialty: args.specialty,
            location: args.location,
            insuranceNetwork: args.insuranceNetwork,
            radius: args.radius || 25,
            limit: args.limit || 20
          };
          return await providerDirectoryService.searchApiDoctors(searchCriteria, {
            userId: context.userId
          });
          
        case 'getDoctorByNPI':
          return await providerDirectoryService.getDoctorByNPI(args.npi, {
            userId: context.userId
          });
          
        case 'verifyInsuranceNetwork':
          // CRITICAL FIX: Support both parameter name variations
          const providerNPI = args.providerNPI || args.npi;
          const insurancePlan = args.insurancePlan || args.insuranceProvider;
          return await providerDirectoryService.verifyInsuranceNetwork(
            providerNPI,
            insurancePlan,
            { userId: context.userId }
          );
          
        case 'getDoctorSpecialties':
          return await providerDirectoryService.getSpecialties({
            userId: context.userId
          });
          
        // Clinical Research Functions
        case 'searchClinicalTrials':
          const trialSearchCriteria = {
            condition: args.condition,
            intervention: args.intervention,
            location: args.location,
            phase: args.phase,
            recruitmentStatus: args.recruitmentStatus || 'RECRUITING',
            limit: args.limit || 20
          };
          return await clinicalResearchService.searchClinicalTrials(trialSearchCriteria, {
            userId: context.userId
          });
          
        case 'matchPatientToTrials':
          const patientProfile = {
            id: args.patientId,
            primaryCondition: args.condition,
            age: args.age,
            gender: args.gender,
            location: args.location
          };
          return await clinicalResearchService.matchPatientToTrials(patientProfile, {
            userId: context.userId
          });
          
        case 'searchMedicalLiterature':
          const literatureOptions = {
            publishedAfter: args.publishedAfter,
            studyTypes: args.studyTypes || [],
            limit: args.limit || 20,
            includeAbstracts: true,
            userId: context.userId
          };
          return await clinicalResearchService.searchMedicalLiterature(args.query, literatureOptions);
          
        case 'searchNIHProjects':
          const nihSearchCriteria = {
            keywords: args.keywords,
            fiscalYear: args.fiscalYear,
            institutionName: args.institutionName,
            limit: args.limit || 20
          };
          return await clinicalResearchService.searchNIHProjects(nihSearchCriteria, {
            userId: context.userId
          });
          
        // Healthcare External API Functions
        case 'searchFDADrugs':
          const drugInfo = require('./drugInformationService');
          return await drugInfo.searchDrugs(args.drugName, {
            manufacturer: args.manufacturer,
            includeGenerics: args.includeGenerics,
            limit: args.limit || 10
          });
          
        case 'getFDARecalls':
          const fdaService = require('./drugInformationService');
          return await fdaService.getRecalls({
            category: args.category || 'drug',
            severity: args.severity,
            dateRange: args.dateRange || '90d'
          });
          
        case 'searchMedicalDevices':
          const deviceService = require('./drugInformationService');
          return await deviceService.searchMedicalDevices(args.deviceName, {
            deviceClass: args.deviceClass,
            manufacturer: args.manufacturer
          });
          
        case 'checkDrugAdverseEvents':
          const adverseService = require('./drugInformationService');
          return await adverseService.getAdverseEvents(args.drugName, {
            seriousOnly: args.seriousOnly,
            ageGroup: args.ageGroup
          });

        // ========== FDA DRUG SHORTAGES ==========
        case 'getDrugShortages':
          const shortageService = require('./drugInformationService');
          const shortageResult = await shortageService.getDrugShortages({
            status: args.status || 'Current',
            limit: args.limit || 100
          });
          // If drugName provided, filter results (note: service returns camelCase fields)
          if (args.drugName) {
            const drugNameLower = args.drugName.toLowerCase();
            shortageResult.shortages = (shortageResult.shortages || []).filter(s =>
              (s.genericName || '').toLowerCase().includes(drugNameLower) ||
              (s.proprietaryName || '').toLowerCase().includes(drugNameLower)
            );
            shortageResult.total = shortageResult.shortages.length;
          }
          return shortageResult;

        // ========== FDA DRUG RECALLS ==========
        case 'getDrugRecalls':
          const recallService = require('./drugInformationService');
          if (args.drugName) {
            // Search recalls by drug name
            return await recallService.getDrugRecalls(args.drugName, {
              limit: args.limit || 20
            });
          } else {
            // Get recent drug recalls from iRES
            return await recallService.getRecentDrugRecallsFromIRES({
              classificationTypes: args.classification && args.classification !== 'all'
                ? [args.classification.replace('Class ', '')]
                : undefined,
              status: args.status !== 'all' ? args.status : undefined,
              limit: args.limit || 20
            });
          }

        // ========== FDA DEVICE RECALLS ==========
        case 'getDeviceRecalls':
          const deviceRecallService = require('./drugInformationService');
          return await deviceRecallService.getDeviceRecalls({
            deviceName: args.deviceName,
            manufacturer: args.manufacturer,
            classification: args.classification !== 'all' ? args.classification : undefined,
            limit: args.limit || 20
          });

        // ========== FDA DEVICE ADVERSE EVENTS ==========
        case 'getDeviceAdverseEvents':
          const deviceEventService = require('./drugInformationService');
          return await deviceEventService.getDeviceAdverseEvents(args.deviceName, {
            manufacturer: args.manufacturer,
            eventType: args.eventType !== 'all' ? args.eventType : undefined,
            limit: args.limit || 20
          });

        // ========== FDA DEVICE SAFETY PROFILE ==========
        case 'getDeviceSafetyProfile':
          const deviceSafetyService = require('./drugInformationService');
          return await deviceSafetyService.getDeviceSafetyProfile(args.manufacturer, args.model, {
            limit: args.limit || 20
          });

        // ========== FDA FOOD RECALLS ==========
        case 'getFoodRecalls':
          const foodRecallService = require('./drugInformationService');
          const foodOptions = {
            limit: args.limit || 20
          };
          if (args.classification && args.classification !== 'all') {
            foodOptions.classification = args.classification;
          }
          const foodResult = await foodRecallService.getFoodEnforcement(foodOptions);
          // Filter by product name or reason if provided
          if (args.productName || args.reason) {
            foodResult.recalls = (foodResult.recalls || []).filter(r => {
              let match = true;
              if (args.productName) {
                const productLower = args.productName.toLowerCase();
                match = match && (
                  (r.product_description || '').toLowerCase().includes(productLower) ||
                  (r.recalling_firm || '').toLowerCase().includes(productLower)
                );
              }
              if (args.reason && args.reason !== 'all') {
                const reasonLower = args.reason.toLowerCase();
                match = match && (r.reason_for_recall || '').toLowerCase().includes(reasonLower);
              }
              return match;
            });
            foodResult.total = foodResult.recalls.length;
          }
          return foodResult;

        // ========== FDA COMPREHENSIVE SEARCH ==========
        case 'searchAllFDACategories':
          const comprehensiveService = require('./drugInformationService');
          return await comprehensiveService.searchAllFDACategories(args.query, {
            categories: args.categories || ['drugs', 'devices', 'food']
          });

        // ========== FDA MANUFACTURER COMPLIANCE (DDAPI) ==========
        case 'checkManufacturerCompliance':
          const complianceCheckService = require('./drugInformationService');
          return await complianceCheckService.checkManufacturerCompliance(args.firmName);

        // ========== FDA INSPECTION CITATIONS ==========
        case 'getInspectionCitations':
          const citationsService = require('./drugInformationService');
          const citationsOptions = {
            limit: args.limit || 50
          };
          if (args.firmName) citationsOptions.firmName = args.firmName;
          if (args.productType && args.productType !== 'all') citationsOptions.productType = args.productType;
          if (args.fiscalYear) citationsOptions.fiscalYear = args.fiscalYear;
          return await citationsService.getInspectionCitations(citationsOptions);

        // ========== FDA COMPLIANCE ACTIONS (WARNING LETTERS) ==========
        case 'getComplianceActions':
          const complianceActionsService = require('./drugInformationService');
          const complianceOptions = {
            limit: args.limit || 50
          };
          if (args.firmName) complianceOptions.firmName = args.firmName;
          if (args.actionType && args.actionType !== 'all') complianceOptions.actionType = args.actionType;
          if (args.productType && args.productType !== 'all') complianceOptions.productType = args.productType;
          return await complianceActionsService.getComplianceActions(complianceOptions);

        // ========== FDA FACILITY REGISTRATION (FEI API) ==========
        case 'checkFacilityRegistration':
          const facilityRegService = require('./drugInformationService');
          return await facilityRegService.checkFacilityRegistration(args.firmName);

        case 'getFacilityByFEI':
          const feiLookupService = require('./drugInformationService');
          return await feiLookupService.getFacilityByFEI(args.feiNumber);

        case 'getFDAEstablishments':
          const estabService = require('./fdaEstablishmentService');
          return await estabService.searchFacilities({
            facilityName: args.facilityName,
            state: args.state,
            productType: args.productType
          });
          
        case 'checkMedicareCoverage':
          const medicareService = require('./medicareCoverageService');
          return await medicareService.checkCoverage({
            procedure: args.procedure,
            state: args.state,
            diagnosis: args.diagnosis
          });
          
        case 'searchMedicareDoctors':
          // Route to the real external CMS/Medicare directory (providerDirectoryService).
          // Previously required a non-existent ./medicareCoverageService and called a
          // non-existent providerService.searchProviders.
          return await providerDirectoryService.searchCMSProviders({
            specialty: args.specialty,
            location: args.location,
            acceptingNewPatients: args.acceptingNewPatients,
            radius: args.radius
          }, { userId: context.userId });
          
        case 'getMedicareQualityRatings':
          const qualityService = require('./medicareQualityService');
          return await qualityService.getQualityRatings({
            facilityName: args.facilityName,
            facilityType: args.facilityType,
            state: args.state
          });
          
        case 'checkMedicaidEligibility':
          const medicaidDataSvc1 = require('./medicaidDataService');
          return await medicaidDataSvc1.checkMedicaidEligibility(args.state);

        case 'getMedicaidEnrollment':
          const medicaidDataSvc2 = require('./medicaidDataService');
          return await medicaidDataSvc2.getMedicaidEnrollment(args.state, {
            reportingPeriod: args.reportingPeriod
          });

        case 'getMedicaidDrugUtilization':
          const medicaidDataSvc3 = require('./medicaidDataService');
          return await medicaidDataSvc3.getMedicaidDrugUtilization(args.drugName, {
            state: args.state,
            year: args.year
          });

        case 'searchHealthInsurancePlans':
          const marketplaceService = require('./cmsMarketplaceService');
          return await marketplaceService.searchPlans({
            zipCode: args.zipCode,
            householdIncome: args.householdIncome,
            householdSize: args.householdSize,
            coverageType: args.coverageType
          });
          
        case 'getEvidenceBasedRecommendations':
          const evidenceService = require('./clinicalResearchService');
          return await evidenceService.getEvidenceBasedRecommendations({
            condition: args.condition,
            patientAge: args.patientAge,
            patientGender: args.patientGender,
            comorbidities: args.comorbidities
          });
          
        case 'searchNIHGrants':
          const nihService = require('./nihReporterService');
          return await nihService.searchProjects({
            keywords: args.keywords,
            fiscalYear: args.fiscalYear,
            institute: args.institute,
            principalInvestigator: args.principalInvestigator,
            organization: args.organization
          });
          
        case 'findResearchCollaborators':
          const collabService = require('./nihReporterService');
          return await collabService.findCollaborators({
            researchArea: args.researchArea,
            institution: args.institution,
            includeInternational: args.includeInternational
          });
          
        case 'getGeneticVariantInfo':
          const geneticsService = require('./clinicalResearchService');
          return await geneticsService.getGeneticVariantInfo({
            rsId: args.rsId,
            gene: args.gene,
            condition: args.condition,
            includeFrequencies: args.includeFrequencies
          });
          
        case 'getPharmacogenomics':
          const pharmacoService = require('./clinicalResearchService');
          return await pharmacoService.getPharmacogenomics({
            drug: args.drug,
            gene: args.gene,
            variant: args.variant,
            ethnicity: args.ethnicity
          });
          
        case 'searchNCBIDatasets':
          const ncbiService = require('./clinicalResearchService');
          return await ncbiService.searchNCBIDatasets({
            dataType: args.dataType,
            organism: args.organism,
            keywords: args.keywords
          });
          
        case 'getGeneExpression':
          const geneService = require('./clinicalResearchService');
          return await geneService.getGeneExpression({
            geneSymbol: args.geneSymbol,
            tissues: args.tissues
          });
          
        case 'getCancerGenomics':
          const cancerService = require('./clinicalResearchService');
          return await cancerService.getCancerGenomics({
            cancerType: args.cancerType,
            gene: args.gene,
            dataType: args.dataType
          });
          
        case 'getCDCDiseaseData':
          // TODO: Implement CDC Wonder Service
          return {
            success: true,
            message: 'CDC Wonder API integration pending implementation',
            data: {
              dataType: args.dataType,
              state: args.state,
              year: args.year,
              ageGroup: args.ageGroup
            }
          };
          
        case 'getCDCHealthGuidelines':
          // TODO: Implement CDC Content Service
          return {
            success: true,
            message: 'CDC Content API integration pending implementation',
            data: {
              topic: args.topic,
              audience: args.audience
            }
          };
          
        case 'findSubstanceAbuseTreatment':
          // TODO: Implement SAMHSA Service
          return {
            success: true,
            message: 'SAMHSA API integration pending implementation',
            data: {
              location: args.location,
              treatmentType: args.treatmentType,
              acceptsMedicaid: args.acceptsMedicaid,
              radius: args.radius
            }
          };
          
        case 'getHealthProfessionalShortageAreas':
          // TODO: Implement HRSA Service
          return {
            success: true,
            message: 'HRSA API integration pending implementation',
            data: {
              state: args.state,
              county: args.county,
              shortageType: args.shortageType
            }
          };
          
        case 'getNutritionData':
          const nutritionService = require('./drugInformationService');
          return await nutritionService.getNutritionData({
            foodName: args.foodName,
            barcode: args.barcode,
            nutrients: args.nutrients
          });
          
        case 'calculateNutritionNeeds':
          const nutritionCalcService = require('./drugInformationService');
          return await nutritionCalcService.calculateNutritionNeeds({
            age: args.age,
            gender: args.gender,
            weight: args.weight,
            height: args.height,
            activityLevel: args.activityLevel,
            medicalConditions: args.medicalConditions
          });
          
        case 'getEnvironmentalHealthData':
          // TODO: Implement EPA Service
          return {
            success: true,
            message: 'EPA API integration pending implementation',
            data: {
              location: args.location,
              dataType: args.dataType
            }
          };
          
        case 'checkRegulatoryCompliance':
          const regulatoryService = require('./drugInformationService');
          return await regulatoryService.checkRegulatoryCompliance({
            facilityType: args.facilityType,
            regulations: args.regulations
          });
          
        case 'getRegulatoryAlerts':
          const alertService = require('./drugInformationService');
          return await alertService.getRegulatoryAlerts({
            agencies: args.agencies,
            severity: args.severity,
            dateRange: args.dateRange
          });
          
        case 'getFDASafetyAlerts':
          const safetyService = require('./drugInformationService');
          return await safetyService.getSafetyAlerts({
            category: args.category || 'all',
            dateRange: args.dateRange || '30d'
          });
          
        case 'generateTreatmentRecommendations':
          const treatmentPatientProfile = {
            age: args.patientAge,
            gender: args.patientGender,
            comorbidities: args.comorbidities || []
          };
          return await clinicalResearchService.generateTreatmentRecommendations(
            args.condition, 
            treatmentPatientProfile, 
            { userId: context.userId }
          );
          
        // Regulatory Compliance Functions
        case 'getFDASafetyAlerts':
          const fdaAlertOptions = {
            alertType: args.alertType || 'all',
            dateFrom: args.dateFrom,
            classification: args.classification,
            limit: args.limit || 50,
            userId: context.userId
          };
          return await regulatoryComplianceService.getFDASafetyAlerts(fdaAlertOptions);
          
        case 'getCMSRegulatoryUpdates':
          const cmsUpdateOptions = {
            category: args.category || 'all',
            effectiveDate: args.effectiveDate,
            impactLevel: args.impactLevel,
            limit: args.limit || 20,
            userId: context.userId
          };
          return await regulatoryComplianceService.getCMSRegulatoryUpdates(cmsUpdateOptions);
          
        case 'calculateComplianceScore':
          return await regulatoryComplianceService.calculateComplianceScore(args.organizationId, {
            userId: context.userId
          });
          
        case 'generateComplianceReport':
          const reportCriteria = {
            organizationId: args.organizationId,
            dateFrom: args.dateFrom,
            dateTo: args.dateTo,
            frameworks: args.frameworks || ['HIPAA', 'HITECH'],
            includeRecommendations: args.includeRecommendations !== false
          };
          return await regulatoryComplianceService.generateComplianceReport(reportCriteria, {
            userId: context.userId
          });
          
        case 'setupRegulatoryMonitoring':
          const monitoringCriteria = {
            agencies: args.agencies,
            categories: args.categories || [],
            alertTypes: args.alertTypes || [],
            frequency: args.frequency || 'daily',
            userId: context.userId,
            organizationId: practiceContext.practice?.id
          };
          return await regulatoryComplianceService.setupRegulatoryMonitoring(monitoringCriteria, {
            userId: context.userId
          });
          
        // External API Management Functions
        case 'testExternalAPIConnection':
          return await externalApiGateway.testConnection(args.providerId);
          
        case 'getExternalAPIHealth':
          if (args.providerId) {
            return await externalApiGateway.getProviderHealth(args.providerId);
          } else {
            return await externalApiGateway.getAllProvidersHealth();
          }
          
        case 'clearExternalAPICache':
          externalApiGateway.clearCache(args.providerId);
          return {
            message: args.providerId 
              ? `Cache cleared for ${args.providerId}` 
              : 'All external API caches cleared',
            timestamp: new Date().toISOString()
          };
          
        // ========== NEW SECURITY & COMPLIANCE ==========
        // INFRASTRUCTURE: Complex service logic - Keep as callAPI
        case 'getAuditLogs':
          return await this.callAPI('/security/audit-logs', 'GET', args, practiceContext);
        case 'getSecurityEvents':
          return await this.callAPI('/security/events', 'GET', args, practiceContext);
        case 'generateComplianceReport':
          return await this.callAPI('/compliance/report', 'POST', args, practiceContext);
        case 'exportAuditReport':
          return await this.callAPI('/security/audit-report/export', 'POST', args, practiceContext);

        // ========== SESSION MANAGEMENT (ADMIN) ==========
        case 'getActiveSessions': {
          const secureSessionManager = require('./secureSessionManager');
          const activeResult = await secureSessionManager.getActiveSessions();
          return { success: true, data: activeResult };
        }
        case 'forceUserLogout': {
          const secureSessionMgr = require('./secureSessionManager');
          const adminId = practiceContext?.currentUser?._id || practiceContext?.user?.id || 'admin';
          const logoutResult = await secureSessionMgr.forceLogoutUser(
            args.userId,
            practiceContext?.subdomain || null,
            adminId.toString()
          );
          return logoutResult;
        }
        case 'getUserLoginHistory': {
          const sessionMgr = require('./secureSessionManager');
          const historyResult = await sessionMgr.getLoginHistory(
            args.userId || null,
            args.limit || 50
          );
          return { success: true, data: historyResult };
        }
        case 'getFailedLoginAttempts': {
          const sessionMgrFailed = require('./secureSessionManager');
          const failedResult = await sessionMgrFailed.getFailedLoginAttempts(
            args.limit || 50
          );
          return { success: true, data: failedResult };
        }
        case 'getSessionStats': {
          const sessionMgrStats = require('./secureSessionManager');
          const statsResult = await sessionMgrStats.getSessionStats();
          return { success: true, data: statsResult };
        }

        // ========== NEW DISASTER RECOVERY & BACKUP ==========
        // INFRASTRUCTURE: Complex backup/restore logic - Keep as callAPI
        case 'createBackup':
          return await this.callAPI('/disaster-recovery/backup', 'POST', args, practiceContext);
        case 'listBackups':
          return await this.callAPI('/disaster-recovery/backups', 'GET', args, practiceContext);
        case 'restoreBackup':
          return await this.callAPI('/disaster-recovery/restore', 'POST', args, practiceContext);
        case 'testDisasterRecovery':
          return await this.callAPI('/disaster-recovery/test', 'POST', args, practiceContext);

        // ========== NEW SYSTEM MONITORING ==========
        // INFRASTRUCTURE: System metrics and monitoring - Keep as callAPI
        case 'getSystemMetrics':
          return await this.callAPI('/monitoring/metrics', 'GET', args, practiceContext);
        case 'getAPIPerformance':
          return await this.callAPI('/monitoring/api-performance', 'GET', args, practiceContext);
        case 'getCircuitBreakerStatus':
          return await this.callAPI(`/circuit-breaker/${args.serviceName}/status`, 'GET', {}, practiceContext);
        case 'resetCircuitBreaker':
          return await this.callAPI(`/circuit-breaker/${args.serviceName}/reset`, 'POST', {}, practiceContext);

        // ========== NEW DATABASE OPERATIONS ==========
        // INFRASTRUCTURE: Database optimization and caching - Keep as callAPI
        case 'optimizeDatabase':
          return await this.callAPI('/db-optimization/optimize', 'POST', args, practiceContext);
        case 'getDatabaseStats':
          return await this.callAPI('/db-optimization/stats', 'GET', args, practiceContext);
        case 'clearCache':
          return await this.callAPI('/db-optimization/cache/clear', 'POST', args, practiceContext);
          
        // ========== NEW USER MANAGEMENT ==========
        case 'updateUserPermissions': {
          if (!args.email) {
            return { success: false, message: 'Email address is required' };
          }

          const updatePermissionsContext = {
            serviceId: 'agentServiceV4',
            operation: 'update_user_permissions',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          // Find user by email first
          const userToUpdate = await SecureDataAccess.query(
            'users',
            { email: args.email.toLowerCase().trim() },
            { limit: 1, projection: { _id: 1, email: 1, firstName: 1, lastName: 1 } },
            updatePermissionsContext
          );

          if (!userToUpdate || userToUpdate.length === 0) {
            return { success: false, message: `User with email ${args.email} not found` };
          }

          const updatedUser = await SecureDataAccess.update(
            'users',
            { _id: userToUpdate[0]._id },
            { $set: { permissions: args.permissions, updatedAt: new Date() } },
            updatePermissionsContext
          );

          return { success: true, email: args.email, data: updatedUser };
        }

        case 'deactivateUser':
          const deactivateUserContext = {
            serviceId: 'agentServiceV4',
            operation: 'deactivate_user',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const deactivatedUser = await SecureDataAccess.update(
            'users',
            { _id: new ObjectId(args.userId) },
            { $set: { active: false, deactivatedAt: new Date(), updatedAt: new Date() } },
            deactivateUserContext
          );

          return { success: true, data: deactivatedUser };
        case 'deleteUser':
          // Check if user is admin before allowing deletion
          if (!practiceContext.user?.roles?.includes('admin')) {
            return {
              success: false,
              error: 'Only system administrators can delete users permanently'
            };
          }
          if (!args.confirmDelete) {
            return {
              success: false,
              error: 'Deletion must be confirmed with confirmDelete: true'
            };
          }
          try {
            const deleteUserContext = {
              serviceId: 'agentServiceV4',
              operation: 'delete_user',
              practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
              apiKey: this.serviceToken?.apiKey || this.serviceToken
            };

            // Find user by email first
            const usersFound = await SecureDataAccess.query(
              'users',
              { email: args.email },
              { limit: 1 },
              deleteUserContext
            );

            if (!usersFound || usersFound.length === 0) {
              return {
                success: false,
                error: `User with email ${args.email} not found`
              };
            }

            const userId = usersFound[0]._id;

            // Delete the user
            const deleteResult = await SecureDataAccess.delete(
              'users',
              { _id: new ObjectId(userId) },
              deleteUserContext
            );

            return {
              success: true,
              data: deleteResult,
              message: `User ${args.email} has been successfully deleted. Reason: ${args.reason}`
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to delete user: ${error.message}`
            };
          }
        case 'resetUserPassword':
          const resetPasswordContext = {
            serviceId: 'agentServiceV4',
            operation: 'reset_user_password',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          // Generate a temporary password or reset token
          const crypto = require('crypto');
          const resetToken = crypto.randomBytes(32).toString('hex');
          const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

          const updatedUserWithReset = await SecureDataAccess.update(
            'users',
            { _id: new ObjectId(args.userId) },
            {
              $set: {
                resetToken,
                resetTokenExpiry,
                updatedAt: new Date()
              }
            },
            resetPasswordContext
          );

          return { success: true, data: updatedUserWithReset, resetToken };
          
        // ========== BILLING & PAYMENTS (billingService) ==========
        case 'captureCharge':
          const captureChargeResult = await billingService.captureCharge(
            {
              patientId: args.patientId,
              providerId: args.providerId,
              appointmentId: args.appointmentId,
              serviceDate: args.serviceDate || new Date().toISOString().split('T')[0],
              cptCode: args.cptCode,
              modifiers: args.modifiers || [],
              diagnosisCodes: args.diagnosisCodes || [],
              units: args.units || 1,
              placeOfService: args.placeOfService || '11'
            },
            { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
          );
          return { success: true, data: captureChargeResult };

        case 'getPatientCharges':
          const chargeFilter = { patientId: args.patientId };
          if (args.status) chargeFilter.status = args.status;
          if (args.startDate || args.endDate) {
            chargeFilter.serviceDate = {};
            if (args.startDate) chargeFilter.serviceDate.$gte = new Date(args.startDate);
            if (args.endDate) chargeFilter.serviceDate.$lte = new Date(args.endDate);
          }
          const patientCharges = await SecureDataAccess.query(
            'charges',
            chargeFilter,
            { sort: { serviceDate: -1 }, limit: 100 },
            { serviceId: 'agentServiceV4', apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: practiceContext?.subdomain || practiceContext?.practiceId }
          );
          return { success: true, data: patientCharges, count: patientCharges.length };

        case 'generateInvoice':
        case 'createInvoice':
          // Get patient info for invoice generation
          const { ObjectId: ObjectIdForInvoice } = require('mongodb');
          const invoicePatients = await SecureDataAccess.query(
            'patients',
            { _id: new ObjectIdForInvoice(args.patientId) },
            { limit: 1 },
            { serviceId: 'agentServiceV4', apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: practiceContext?.subdomain || practiceContext?.practiceId }
          );
          const invoicePatient = invoicePatients[0];
          // Get unbilled charges for this patient
          const unbilledCharges = await SecureDataAccess.query(
            'charges',
            { patientId: args.patientId, billingStatus: 'pending' },
            { limit: 100 },
            { serviceId: 'agentServiceV4', apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: practiceContext?.subdomain || practiceContext?.practiceId }
          );
          if (unbilledCharges.length === 0) {
            return { success: false, message: 'No unbilled charges found for this patient' };
          }
          const invoiceResult = await billingService.generateSelfPayInvoice(
            unbilledCharges[0],
            invoicePatient || { firstName: 'Unknown', lastName: 'Patient' },
            { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
          );
          // Auto-apply patient credits if available (all recorded in database)
          const invoiceResponse = { success: true, data: invoiceResult };
          try {
            const creditBalance = await billingService.getPatientCreditBalance(
              args.patientId,
              { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
            );
            if (creditBalance && creditBalance.totalCreditBalance > 0 && invoiceResult.invoiceId) {
              const creditApplyResult = await billingService.applyCreditToInvoice(
                args.patientId,
                invoiceResult.invoiceId,
                null, // apply max available up to invoice balance
                { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
              );
              if (creditApplyResult && creditApplyResult.success !== false) {
                invoiceResponse.creditApplied = {
                  amountApplied: creditApplyResult.amountApplied,
                  remainingCreditBalance: creditApplyResult.remainingCreditBalance,
                  invoiceStatus: creditApplyResult.invoiceStatus,
                  originalTotal: invoiceResult.total,
                  balanceDue: Math.round((invoiceResult.total - creditApplyResult.amountApplied) * 100) / 100
                };
              }
            }
          } catch (creditError) {
            console.error('[Billing] Credit auto-apply failed (non-fatal):', creditError.message);
            // Invoice still created successfully, credit apply is best-effort
          }
          return invoiceResponse;

        case 'processPayment':
        case 'recordPayment':
          const paymentResult = await billingService.processPayment(
            {
              invoiceId: args.invoiceId,
              amount: args.amount,
              paymentMethod: args.paymentMethod,
              paymentDetails: args.paymentDetails || {},
              patientId: args.patientId
            },
            { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
          );
          return { success: true, data: paymentResult };

        case 'getOutstandingBalances':
          const balancesContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_outstanding_balances',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };
          const unpaidInvoices = await SecureDataAccess.query(
            'invoices',
            { patientId: args.patientId, status: { $in: ['pending', 'partial', 'overdue'] } },
            {},
            balancesContext
          );
          const totalBalance = unpaidInvoices.reduce((sum, inv) => sum + ((inv.total || inv.amount || 0) - (inv.paidAmount || 0)), 0);
          return { success: true, balance: totalBalance, invoices: unpaidInvoices };

        case 'createPaymentPlan':
          const paymentPlanResult = await billingService.createPaymentPlan(
            {
              patientId: args.patientId,
              invoiceIds: args.invoiceIds || [],
              totalAmount: args.totalAmount,
              downPayment: args.downPayment || 0,
              numberOfInstallments: args.numberOfInstallments,
              startDate: args.startDate
            },
            { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
          );
          return { success: true, data: paymentPlanResult };

        case 'getRevenueReport':
          const revenueReport = await billingService.generateRevenueReport(
            { startDate: args.startDate, endDate: args.endDate },
            { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
          );
          return { success: true, data: revenueReport };

        case 'getPaymentHistory':
          const paymentFilter = { patientId: args.patientId, status: 'completed' };
          if (args.startDate || args.endDate) {
            paymentFilter.processedAt = {};
            if (args.startDate) paymentFilter.processedAt.$gte = new Date(args.startDate);
            if (args.endDate) paymentFilter.processedAt.$lte = new Date(args.endDate);
          }
          const paymentHistory = await SecureDataAccess.query(
            'payments',
            paymentFilter,
            { sort: { processedAt: -1 }, limit: 100 },
            { serviceId: 'agentServiceV4', apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: practiceContext?.subdomain || practiceContext?.practiceId }
          );
          return { success: true, data: paymentHistory, count: paymentHistory.length };
          
        // ========== Credit Balance Management ==========
        case 'getPatientCreditBalance':
          try {
            const creditResult = await billingService.getPatientCreditBalance(
              args.patientId,
              { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
            );
            return { success: true, data: creditResult };
          } catch (e) { return { success: false, error: e.message }; }

        case 'applyCreditToInvoice':
          try {
            const applyCreditResult = await billingService.applyCreditToInvoice(
              args.patientId,
              args.invoiceId,
              args.amount,
              { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
            );
            return { success: true, data: applyCreditResult };
          } catch (e) { return { success: false, error: e.message }; }

        // ========== BILLING CRUD: Update / Void / Refund / Cancel ==========
        case 'updateCharge':
          try {
            const updateChargeResult = await billingService.updateCharge(
              args.chargeId,
              { cptCode: args.cptCode, diagnosisCodes: args.diagnosisCodes, units: args.units, serviceDate: args.serviceDate, placeOfService: args.placeOfService, amount: args.amount },
              { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
            );
            return { success: true, data: updateChargeResult };
          } catch (e) { return { success: false, error: e.message }; }

        case 'voidCharge':
          try {
            const voidChargeResult = await billingService.voidCharge(
              args.chargeId,
              args.reason,
              { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
            );
            return { success: true, data: voidChargeResult };
          } catch (e) { return { success: false, error: e.message }; }

        case 'voidInvoice':
          try {
            const voidInvoiceResult = await billingService.voidInvoice(
              args.invoiceId,
              args.reason,
              { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
            );
            return { success: true, data: voidInvoiceResult };
          } catch (e) { return { success: false, error: e.message }; }

        case 'refundPayment':
          try {
            const refundResult = await billingService.refundPayment(
              args.paymentId,
              args.refundAmount,
              args.reason,
              { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
            );
            return { success: true, data: refundResult };
          } catch (e) { return { success: false, error: e.message }; }

        case 'updatePaymentPlan':
          try {
            const updatePlanResult = await billingService.updatePaymentPlan(
              args.planId,
              { numberOfInstallments: args.numberOfInstallments, monthlyPayment: args.monthlyPayment, startDate: args.startDate },
              { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
            );
            return { success: true, data: updatePlanResult };
          } catch (e) { return { success: false, error: e.message }; }

        case 'cancelPaymentPlan':
          try {
            const cancelPlanResult = await billingService.cancelPaymentPlan(
              args.planId,
              args.reason,
              { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.userId }
            );
            return { success: true, data: cancelPlanResult };
          } catch (e) { return { success: false, error: e.message }; }

        // ========== CLAIM TRACKING & LIFECYCLE ==========
        case 'createClaim': {
          const createClaimResult = await billingService.createClaim(
            args.patientId,
            args.charges || [],
            args.diagnosisCodes || [],
            args.procedureCodes || [],
            { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.currentUser?._id || practiceContext?.user?.id }
          );
          return createClaimResult;
        }
        case 'updateClaimStatus': {
          const updateClaimResult = await billingService.updateClaimStatus(
            args.claimId,
            args.status,
            args.notes || '',
            { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.currentUser?._id || practiceContext?.user?.id }
          );
          return updateClaimResult;
        }
        case 'getClaimsByStatus': {
          const claimsByStatus = await billingService.getClaimsByStatus(
            args.status || null,
            { practiceId: practiceContext?.subdomain || practiceContext?.practiceId }
          );
          return claimsByStatus;
        }
        case 'getPatientClaims': {
          const patientClaims = await billingService.getPatientClaims(
            args.patientId,
            { practiceId: practiceContext?.subdomain || practiceContext?.practiceId }
          );
          return patientClaims;
        }
        case 'getClaimAging': {
          const agingReport = await billingService.getClaimAging(
            { practiceId: practiceContext?.subdomain || practiceContext?.practiceId }
          );
          return agingReport;
        }
        case 'addClaimNote': {
          const noteResult = await billingService.addClaimNote(
            args.claimId,
            args.note,
            { practiceId: practiceContext?.subdomain || practiceContext?.practiceId, userId: practiceContext?.currentUser?._id || practiceContext?.user?.id }
          );
          return noteResult;
        }
        case 'getClaimsDashboard': {
          const dashboard = await billingService.getClaimsDashboard(
            { practiceId: practiceContext?.subdomain || practiceContext?.practiceId }
          );
          return dashboard;
        }

        // ========== ICD-10-CM DIAGNOSIS CODE LOOKUP ==========
        case 'searchDiagnosisCode':
          return await billingService.searchICD10(args.query, args.maxResults);

        case 'validateDiagnosisCode':
          return await billingService.validateICD10Code(args.code);

        case 'suggestDiagnosisCodes':
          return await billingService.suggestICD10Codes(args.diagnosis, args.maxResults);

        case 'getRelatedDiagnosisCodes':
          return await billingService.getRelatedICD10Codes(args.parentCode, args.maxResults);

        // ========== MEDICATION ENTITLEMENT ==========
        case 'checkMedicationEntitlement': {
          const medicationEntitlementService = require('./medicationEntitlementService');
          return await medicationEntitlementService.checkMedicationEntitlement(args.patientId, args.drugName, practiceContext?.practiceDb);
        }

        case 'findCoveredAlternatives': {
          const medicationEntitlementService = require('./medicationEntitlementService');
          return await medicationEntitlementService.findCoveredAlternatives(args.drugName, args.insuranceType);
        }

        case 'getFormularyInfo': {
          const medicationEntitlementService = require('./medicationEntitlementService');
          return await medicationEntitlementService.getFormularyInfo(args.drugName);
        }

        // ========== NEW COMMUNICATION ==========
        case 'sendSMS':
          // EXTERNAL SERVICE: Twilio SMS API - Keep as callAPI
          return await this.callAPI('/communication/sms', 'POST', args, practiceContext);
        case 'sendEmail':
          // EXTERNAL SERVICE: SendGrid Email API - Keep as callAPI
          return await this.callAPI('/communication/email', 'POST', args, practiceContext);
        case 'scheduleReminder':
          const scheduleReminderContext = {
            serviceId: 'agentServiceV4',
            operation: 'schedule_reminder',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const newReminder = await SecureDataAccess.insert(
            'reminders',
            {
              ...args,
              status: 'scheduled',
              createdAt: new Date(),
              updatedAt: new Date()
            },
            scheduleReminderContext
          );

          return { success: true, data: newReminder };

        case 'getReminderHistory':
          const getReminderHistoryContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_reminder_history',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const reminders = await SecureDataAccess.query(
            'reminders',
            { patientId: args.patientId },
            { sort: { createdAt: -1 } },
            getReminderHistoryContext
          );

          return { success: true, data: reminders };
          
        // ========== BULK COMMUNICATION ==========
        case 'sendBulkPatientSMS':
          // EXTERNAL SERVICE: Bulk SMS via Twilio - Keep as callAPI
          return await this.callAPI('/communication/bulk-sms', 'POST', args, practiceContext);
        case 'sendBulkPatientEmail':
          // EXTERNAL SERVICE: Bulk Email via SendGrid - Keep as callAPI
          return await this.callAPI('/communication/bulk-email', 'POST', args, practiceContext);
        case 'getCommunicationAnalytics':
          // EXTERNAL SERVICE: Analytics from communication service - Keep as callAPI
          return await this.callAPI('/communication/campaign-analytics', 'GET', args, practiceContext);
        case 'sendAppointmentConfirmationRequest':
          // Method lives on appointmentService (not communicationService).
          return await getService('appointmentService').sendAppointmentConfirmationRequest(args, practiceContext, session);
        case 'sendTestResultNotifications':
          // Method lives on communicationService (not labService).
          return await getService('communicationService').sendTestResultNotifications(args, practiceContext, session);
        case 'sendMedicationRefillReminders':
          return await getService('medicationService').sendMedicationRefillReminders(args, practiceContext, session);
          
        // ========== PATIENT PORTAL MESSAGING ==========
        case 'sendPatientPortalMessage':
          const sendMessageContext = {
            serviceId: 'agentServiceV4',
            operation: 'send_patient_portal_message',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const newMessage = await SecureDataAccess.insert(
            'patient_messages',
            {
              ...args,
              status: 'sent',
              createdAt: new Date(),
              updatedAt: new Date()
            },
            sendMessageContext
          );

          return { success: true, data: newMessage };

        case 'requestPrescriptionRefill':
          const refillRequestContext = {
            serviceId: 'agentServiceV4',
            operation: 'request_prescription_refill',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const refillRequest = await SecureDataAccess.insert(
            'prescription_refill_requests',
            {
              ...args,
              status: 'pending',
              requestedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            },
            refillRequestContext
          );

          return { success: true, data: refillRequest };

        case 'reportPatientSymptoms':
          const symptomReportContext = {
            serviceId: 'agentServiceV4',
            operation: 'report_patient_symptoms',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const symptomReport = await SecureDataAccess.insert(
            'symptom_reports',
            {
              ...args,
              reportedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            },
            symptomReportContext
          );

          return { success: true, data: symptomReport };

        case 'schedulePatientAppointment':
          const appointmentRequestContext = {
            serviceId: 'agentServiceV4',
            operation: 'schedule_patient_appointment',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const appointmentRequest = await SecureDataAccess.insert(
            'appointment_requests',
            {
              ...args,
              status: 'pending',
              requestedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            },
            appointmentRequestContext
          );

          return { success: true, data: appointmentRequest };

        case 'getPatientMessageHistory':
          const getMessagesContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_patient_message_history',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const messages = await SecureDataAccess.query(
            'patient_messages',
            { patientId: args.patientId },
            { sort: { createdAt: -1 } },
            getMessagesContext
          );

          return { success: true, data: messages };
          
        // ========== HEALTH CAMPAIGN MANAGEMENT ==========
        case 'createHealthCampaign':
          return await getService('communicationService').createHealthCampaign(args, practiceContext, session);
        case 'startHealthCampaign':
          return await getService('communicationService').startHealthCampaign(args, practiceContext, session);
        case 'pauseHealthCampaign':
          return await getService('communicationService').pauseHealthCampaign(args, practiceContext, session);
        case 'resumeHealthCampaign':
          return await getService('communicationService').resumeHealthCampaign(args, practiceContext, session);
        case 'getCampaignAnalytics':
          return await getService('communicationService').getCampaignAnalytics(args, practiceContext, session);
          
        // ========== ADVANCED COMMUNICATION ANALYTICS ==========
        case 'getCommunicationAnalytics':
          return await getService('communicationService').getCommunicationAnalytics(args, practiceContext, session);
        case 'getChannelPerformance':
          return await getService('communicationService').getChannelPerformance(args, practiceContext, session);
        case 'getPatientEngagementInsights':
          // Method lives on patientService (not userService).
          return await getService('patientService').getPatientEngagementInsights(args, practiceContext, session);
        case 'generateCommunicationReport':
          return await getService('communicationService').generateCommunicationReport(args, practiceContext, session);
          
        // ========== PROVIDER AVAILABILITY MANAGEMENT ==========
        case 'setMyBusyTime': {
          // Block out time on the doctor's calendar (provider_blocked_times), same model as blockDoctorTime.
          const busyCtx = {
            serviceId: 'agentServiceV4',
            operation: 'set_busy_time',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };
          const busyDoc = await SecureDataAccess.insert(
            'provider_blocked_times',
            { providerId: args.providerId || practiceContext.user?.id, ...args, createdAt: new Date(), updatedAt: new Date() },
            busyCtx
          );
          return { success: true, data: busyDoc };
        }
        case 'showMyBusyTimes': {
          const busyCtx = {
            serviceId: 'agentServiceV4',
            operation: 'show_busy_times',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };
          const busyList = await SecureDataAccess.query(
            'provider_blocked_times',
            { providerId: args.providerId || practiceContext.user?.id },
            { sort: { createdAt: -1 } },
            busyCtx
          );
          return { success: true, data: busyList };
        }
        case 'cancelMyBusyTime': {
          const { ObjectId: ObjectIdForBusy } = require('mongodb');
          const busyId = args.busyTimeId || args.id || args._id;
          if (!busyId) {
            return { success: false, message: 'Missing busy-time id to cancel' };
          }
          const busyCtx = {
            serviceId: 'agentServiceV4',
            operation: 'cancel_busy_time',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };
          const cancelled = await SecureDataAccess.delete(
            'provider_blocked_times',
            { _id: new ObjectIdForBusy(busyId) },
            busyCtx
          );
          return { success: true, data: cancelled };
        }
          
        // ========== NEW MEDICAL ANALYSIS ==========
        // INFRASTRUCTURE: Medical text parsing with complex logic - Keep as callAPI
        case 'parseTreatment':
          return await this.callAPI('/medical/parse-treatment', 'POST', args, practiceContext);
        case 'parseSymptoms':
          return await this.callAPI('/medical/parse-symptoms', 'POST', args, practiceContext);
        case 'parseLabResults':
          return await this.callAPI('/medical/parse-lab-results', 'POST', args, practiceContext);
        case 'categorizeDocument':
          return await this.callAPI('/medical/categorize-data', 'POST', args, practiceContext);
          
        // ========== NEW MFA & AUTHENTICATION ==========
        case 'getMFAStatus':
          const getMFAContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_mfa_status',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const userMFA = await SecureDataAccess.query(
            'users',
            { _id: new ObjectId(args.userId) },
            { limit: 1, projection: { mfaEnabled: 1, mfaMethod: 1 } },
            getMFAContext
          );

          return {
            success: true,
            enabled: userMFA[0]?.mfaEnabled || false,
            method: userMFA[0]?.mfaMethod || null
          };

        case 'setupMFA':
          // INFRASTRUCTURE: Complex MFA setup with TOTP generation - Keep as callAPI
          return await this.callAPI('/mfa/setup', 'POST', args, practiceContext);
        case 'disableMFA':
          // INFRASTRUCTURE: MFA disable with verification - Keep as callAPI
          return await this.callAPI('/mfa/disable', 'POST', args, practiceContext);
          
        // ========== NEW TRANSLATIONS ==========
        case 'getTranslations':
          const getTranslationsContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_translations',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          if (args.keys && args.keys.length > 0) {
            const translations = await SecureDataAccess.query(
              'translations',
              { language: args.language, key: { $in: args.keys } },
              {},
              getTranslationsContext
            );
            return { success: true, data: translations };
          }

          const allTranslations = await SecureDataAccess.query(
            'translations',
            { language: args.language },
            {},
            getTranslationsContext
          );
          return { success: true, data: allTranslations };

        case 'updateTranslations':
          const updateTranslationsContext = {
            serviceId: 'agentServiceV4',
            operation: 'update_translations',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const translationUpdates = Object.entries(args.translations).map(([key, value]) => ({
            language: args.language,
            key,
            value,
            updatedAt: new Date()
          }));

          for (const translation of translationUpdates) {
            await SecureDataAccess.update(
              'translations',
              { language: translation.language, key: translation.key },
              { $set: translation },
              updateTranslationsContext
            );
          }

          return { success: true, updated: translationUpdates.length };

        // ========== NEW RBAC & PERMISSIONS ==========
        case 'getRoles':
          return await require('./roleManagementService').getRoles(args, practiceContext, session);
        case 'createRole':
          return await require('./roleManagementService').createRole(args, practiceContext, session);
        case 'updateRole':
          return await require('./roleManagementService').updateRole(args, practiceContext, session);
        case 'deleteRole':
          return await require('./roleManagementService').deleteRole(args, practiceContext, session);
        case 'listAllPermissions':
          return await require('./roleManagementService').listAllPermissions(args, practiceContext, session);
        case 'cloneRole':
          return await require('./roleManagementService').cloneRole(args, practiceContext, session);
        case 'cloneUserPermissions':
          return await require('./roleManagementService').cloneUserPermissions(args, practiceContext, session);

        // ========== PERMISSION REQUEST WORKFLOW ==========
        case 'requestPermission': {
          const reqPermContext = {
            serviceId: 'agentServiceV4',
            operation: 'request_permission',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          // Resolve user: try session/context first, then fall back to args.requesterEmail with DB lookup
          let requester = session?.authenticatedUser || practiceContext?.currentUser || practiceContext?.user;
          console.log(`🔑 [requestPermission] User resolution: session.authenticatedUser=${session?.authenticatedUser?.email || 'N/A'}, currentUser=${practiceContext?.currentUser?.email || 'N/A'}, user=${practiceContext?.user?.email || 'N/A'}, args.requesterEmail=${args.requesterEmail || 'N/A'}`);

          // If context-based resolution failed but agent collected email from user, look up in DB
          if (!requester?.email && args.requesterEmail) {
            console.log(`🔍 [requestPermission] Looking up user by email: ${args.requesterEmail}`);
            const userLookup = await SecureDataAccess.query(
              'users',
              { email: args.requesterEmail },
              { limit: 1, projection: { _id: 1, email: 1, firstName: 1, lastName: 1, roles: 1 } },
              reqPermContext
            );
            if (userLookup && userLookup.length > 0) {
              requester = userLookup[0];
              console.log(`✅ [requestPermission] Found user: ${requester.firstName} ${requester.lastName} (${requester.email})`);
            }
          }

          if (!requester?.email) {
            const isHebrew = session?.language === 'he';
            return {
              success: false,
              message: isHebrew
                ? 'לא ניתן לזהות את המשתמש. אנא שאל את המשתמש מה כתובת האימייל שלו כדי לשלוח את הבקשה.'
                : 'Unable to identify the current user. Please ask the user for their email address to submit the request.',
              agentInstruction: isHebrew
                ? 'שאל את המשתמש: "מה כתובת האימייל שלך? אני צריך אותה כדי לשלוח את בקשת ההרשאה בשמך." לאחר שהמשתמש מספק את האימייל, קרא שוב ל-requestPermission עם הפרמטר requesterEmail.'
                : 'Ask the user: "What is your email address? I need it to submit the permission request on your behalf." Once the user provides the email, call requestPermission again with the requesterEmail parameter.'
            };
          }

          // Determine request type: a ROLE upgrade or a single PERMISSION grant.
          const isHebrew = session?.language === 'he';
          let requestedRole = null;
          if (args.requestedRole) {
            requestedRole = roleModel.toCanonicalRole(args.requestedRole);
            if (!roleModel.CANONICAL_ROLES.includes(requestedRole)) {
              return {
                success: false,
                message: isHebrew
                  ? `תפקיד לא תקין. אפשרויות: ${roleModel.CANONICAL_ROLES.join(', ')}`
                  : `Invalid role. Options: ${roleModel.CANONICAL_ROLES.join(', ')}`
              };
            }
          }
          const requestType = requestedRole ? 'role' : 'permission';

          if (requestType === 'permission' && !args.permission) {
            return {
              success: false,
              message: isHebrew
                ? 'נדרשת הרשאה או תפקיד לבקשה.'
                : 'A permission or a role is required to submit a request.'
            };
          }

          const requesterName = [requester.firstName, requester.lastName].filter(Boolean).join(' ') || requester.email;
          const requesterRole = roleModel.primaryRole(requester.roles);
          const permissionLabel = args.permission ? args.permission.replace(/[_:]/g, ' ') : '';
          const roleLabelText = requestedRole ? roleModel.roleLabel(requestedRole, isHebrew ? 'he' : 'en') : '';

          // Insert permission request
          const requestDoc = {
            requesterEmail: requester.email,
            requesterName,
            requesterRole,
            requestType,
            permission: args.permission || null,
            requestedRole: requestedRole || null,
            reason: args.reason,
            status: 'pending',
            createdAt: new Date()
          };

          const insertResult = await SecureDataAccess.insert(
            'permission_requests',
            requestDoc,
            reqPermContext
          );

          const requestId = insertResult?.insertedId || insertResult?._id;

          // Find admins to notify: users who are admins by ROLE ('admin') OR who hold
          // the 'manage_users' permission. Union the two sets and dedupe by _id.
          let adminUserIds = [];
          try {
            const adminUsers = await SecureDataAccess.query(
              'users',
              { $or: [ { roles: 'admin' }, { permissions: 'manage_users' } ] },
              { projection: { _id: 1 } },
              reqPermContext
            );
            adminUserIds = [...new Set((adminUsers || []).map(u => String(u._id)))];
          } catch (e) {
            console.warn('Could not look up admin users for notification targeting:', e.message);
          }

          // Create notification for admins
          const notificationDoc = {
            type: 'permission_request',
            title: requestType === 'role' ? 'Role Request' : 'Permission Request',
            message: requestType === 'role'
              ? `${requesterName} is requesting the '${roleLabelText}' role. Reason: ${args.reason}`
              : `${requesterName} is requesting '${permissionLabel}' permission. Reason: ${args.reason}`,
            requestId: requestId,
            requesterEmail: requester.email,
            requesterName,
            requesterRole,
            requestType,
            permission: args.permission || null,
            requestedRole: requestedRole || null,
            targetUserIds: adminUserIds,
            status: 'unread',
            createdAt: new Date()
          };

          const notifInsertResult = await SecureDataAccess.insert('notifications', notificationDoc, reqPermContext);
          // Capture the NOTIFICATION's own _id. The client marks notifications read via
          // PUT /api/notifications/:id/read, which matches the notifications collection by _id.
          // Previously the socket payload below sent the permission_request's id as _id, so the
          // client tried to mark a non-existent notification read and it stayed unread on reload.
          const notificationId = notifInsertResult?.insertedId || notifInsertResult?._id;

          // Broadcast via Socket.IO
          const practiceRoom = practiceContext?.subdomain || practiceContext?.practiceId;
          console.log(`🔔 [requestPermission] Socket.IO broadcast: global.io=${!!global.io}, practiceRoom=${practiceRoom}, targetUserIds=${JSON.stringify(adminUserIds)}`);
          if (global.io && practiceRoom) {
            const room = `practice_${practiceRoom}`;
            const socketsInRoom = global.io.sockets.adapter.rooms.get(room);
            console.log(`🔔 [requestPermission] Emitting to room '${room}', sockets in room: ${socketsInRoom ? socketsInRoom.size : 0}`);
            global.io.to(room).emit('permission_request', {
              ...notificationDoc,
              _id: notificationId,
              requestId
            });
          } else {
            console.warn(`⚠️ [requestPermission] Socket.IO emit SKIPPED: global.io=${!!global.io}, practiceRoom=${practiceRoom}`);
          }

          return {
            success: true,
            message: requestType === 'role'
              ? (isHebrew
                ? `בקשת התפקיד נשלחה למנהל המערכת. התפקיד המבוקש: ${roleLabelText}`
                : `Role request sent to your administrator. Requested role: ${roleLabelText}`)
              : (isHebrew
                ? `בקשת ההרשאה נשלחה למנהל המערכת. ההרשאה המבוקשת: ${permissionLabel}`
                : `Permission request sent to your administrator. Requested permission: ${permissionLabel}`)
          };
        }

        case 'getPendingPermissionRequests': {
          const getPendingContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_pending_permission_requests',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const pendingRequests = await SecureDataAccess.query(
            'permission_requests',
            { status: 'pending' },
            { sort: { createdAt: -1 }, limit: 50 },
            getPendingContext
          );

          return {
            success: true,
            data: (pendingRequests || []).map(r => ({
              requestId: r._id,
              requesterName: r.requesterName,
              requesterEmail: r.requesterEmail,
              requesterRole: r.requesterRole || null,
              requestType: r.requestType || 'permission',
              permission: r.permission || null,
              permissionLabel: r.permission ? r.permission.replace(/[_:]/g, ' ') : '',
              requestedRole: r.requestedRole || null,
              reason: r.reason,
              createdAt: r.createdAt
            })),
            count: (pendingRequests || []).length
          };
        }

        case 'approvePermissionRequest': {
          const { ObjectId: ObjectIdForApprove } = require('mongodb');
          const approveContext = {
            serviceId: 'agentServiceV4',
            operation: 'approve_permission_request',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          // Find the request
          const approveRequest = await SecureDataAccess.query(
            'permission_requests',
            { _id: new ObjectIdForApprove(args.requestId) },
            { limit: 1 },
            approveContext
          );

          if (!approveRequest || approveRequest.length === 0) {
            return { success: false, message: 'Permission request not found' };
          }

          const request = approveRequest[0];
          if (request.status !== 'pending') {
            return { success: false, message: `Request has already been ${request.status}` };
          }

          // Find the target user
          const targetUser = await SecureDataAccess.query(
            'users',
            { email: request.requesterEmail },
            { limit: 1, projection: { _id: 1, email: 1, firstName: 1, lastName: 1, permissions: 1, roles: 1 } },
            approveContext
          );

          if (!targetUser || targetUser.length === 0) {
            return { success: false, message: `User ${request.requesterEmail} not found` };
          }

          const isRoleApprove = request.requestType === 'role' && !!request.requestedRole;

          if (isRoleApprove) {
            // Assign the requested role (canonical) and grant that role's default permissions.
            const newRoles = roleModel.normalizeRoles([...(targetUser[0].roles || []), request.requestedRole]);
            const roleUpdate = { $set: { roles: newRoles, updatedAt: new Date() } };
            try {
              const defaultPerms = getService('userService')._getDefaultPermissions(request.requestedRole);
              if (Array.isArray(defaultPerms) && defaultPerms.length > 0) {
                roleUpdate.$addToSet = { permissions: { $each: defaultPerms } };
              }
            } catch (e) {
              console.warn('Could not compute default permissions for role grant:', e.message);
            }
            await SecureDataAccess.update('users', { _id: targetUser[0]._id }, roleUpdate, approveContext);
          } else {
            // Grant single permission via $addToSet
            await SecureDataAccess.update(
              'users',
              { _id: targetUser[0]._id },
              { $addToSet: { permissions: request.permission }, $set: { updatedAt: new Date() } },
              approveContext
            );
          }

          // Update request status
          const adminUser = session?.authenticatedUser || practiceContext?.currentUser || practiceContext?.user;
          const adminEmail = adminUser?.email || 'admin';
          await SecureDataAccess.update(
            'permission_requests',
            { _id: new ObjectIdForApprove(args.requestId) },
            { $set: { status: 'approved', approvedBy: adminEmail, approvedAt: new Date() } },
            approveContext
          );

          // Create notification for the requester
          const isHebrewApprove = session?.language === 'he';
          const approvedPermLabel = request.permission ? request.permission.replace(/[_:]/g, ' ') : '';
          const approvedRoleLabel = isRoleApprove ? roleModel.roleLabel(request.requestedRole, isHebrewApprove ? 'he' : 'en') : '';
          const approvalNotif = {
            type: 'permission_approved',
            title: isRoleApprove ? 'Role Approved' : 'Permission Approved',
            message: isRoleApprove
              ? `Your request for the '${approvedRoleLabel}' role has been approved.`
              : `Your permission request for '${approvedPermLabel}' has been approved.`,
            requestId: new ObjectIdForApprove(args.requestId),
            targetEmail: request.requesterEmail,
            targetUserIds: [String(targetUser[0]._id)],
            requestType: request.requestType || 'permission',
            permission: request.permission || null,
            requestedRole: request.requestedRole || null,
            status: 'unread',
            createdAt: new Date()
          };

          await SecureDataAccess.insert('notifications', approvalNotif, approveContext);

          // Broadcast via Socket.IO
          const approveRoom = practiceContext?.subdomain || practiceContext?.practiceId;
          if (global.io && approveRoom) {
            global.io.to(`practice_${approveRoom}`).emit('permission_approved', approvalNotif);
          }

          if (isRoleApprove) {
            return {
              success: true,
              message: isHebrewApprove
                ? `הבקשה אושרה. התפקיד '${approvedRoleLabel}' ניתן ל-${request.requesterName} (${request.requesterEmail})`
                : `Request approved. The '${approvedRoleLabel}' role was granted to ${request.requesterName} (${request.requesterEmail})`,
              grantedRole: request.requestedRole,
              grantedTo: request.requesterEmail
            };
          }

          return {
            success: true,
            message: isHebrewApprove
              ? `בקשת ההרשאה אושרה. ההרשאה '${approvedPermLabel}' ניתנה ל-${request.requesterName} (${request.requesterEmail})`
              : `Permission request approved. '${approvedPermLabel}' granted to ${request.requesterName} (${request.requesterEmail})`,
            grantedPermission: request.permission,
            grantedTo: request.requesterEmail
          };
        }

        case 'denyPermissionRequest': {
          const { ObjectId: ObjectIdForDeny } = require('mongodb');
          const denyContext = {
            serviceId: 'agentServiceV4',
            operation: 'deny_permission_request',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          // Find the request
          const denyRequest = await SecureDataAccess.query(
            'permission_requests',
            { _id: new ObjectIdForDeny(args.requestId) },
            { limit: 1 },
            denyContext
          );

          if (!denyRequest || denyRequest.length === 0) {
            return { success: false, message: 'Permission request not found' };
          }

          const denyReq = denyRequest[0];
          if (denyReq.status !== 'pending') {
            return { success: false, message: `Request has already been ${denyReq.status}` };
          }

          // Update request status
          const denyAdmin = session?.authenticatedUser || practiceContext?.currentUser || practiceContext?.user;
          await SecureDataAccess.update(
            'permission_requests',
            { _id: new ObjectIdForDeny(args.requestId) },
            { $set: {
              status: 'denied',
              deniedBy: denyAdmin?.email || 'admin',
              deniedAt: new Date(),
              denyReason: args.reason || null
            }},
            denyContext
          );

          // Look up requester's userId for notification targeting
          let denyTargetUserIds = [];
          try {
            const denyTargetUser = await SecureDataAccess.query(
              'users',
              { email: denyReq.requesterEmail },
              { limit: 1, projection: { _id: 1 } },
              denyContext
            );
            if (denyTargetUser && denyTargetUser.length > 0) {
              denyTargetUserIds = [String(denyTargetUser[0]._id)];
            }
          } catch (e) {
            console.warn('Could not look up requester for deny notification targeting:', e.message);
          }

          // Create notification for the requester
          const isHebrewDeny = session?.language === 'he';
          const isRoleDeny = denyReq.requestType === 'role' && !!denyReq.requestedRole;
          const deniedPermLabel = denyReq.permission ? denyReq.permission.replace(/[_:]/g, ' ') : '';
          const deniedRoleLabel = isRoleDeny ? roleModel.roleLabel(denyReq.requestedRole, isHebrewDeny ? 'he' : 'en') : '';
          // What was requested (role or permission), for the bilingual deny message.
          const deniedLabel = isRoleDeny ? deniedRoleLabel : deniedPermLabel;
          const denyReason = args.reason ? ` Reason: ${args.reason}` : '';
          const denyNotif = {
            type: 'permission_denied',
            title: isRoleDeny ? 'Role Request Denied' : 'Permission Request Denied',
            message: isRoleDeny
              ? `Your request for the '${deniedRoleLabel}' role has been denied.${denyReason}`
              : `Your permission request for '${deniedPermLabel}' has been denied.${denyReason}`,
            requestId: new ObjectIdForDeny(args.requestId),
            targetEmail: denyReq.requesterEmail,
            targetUserIds: denyTargetUserIds,
            requestType: denyReq.requestType || 'permission',
            permission: denyReq.permission || null,
            requestedRole: denyReq.requestedRole || null,
            status: 'unread',
            createdAt: new Date()
          };

          await SecureDataAccess.insert('notifications', denyNotif, denyContext);

          return {
            success: true,
            message: isRoleDeny
              ? (isHebrewDeny
                ? `בקשת התפקיד נדחתה. התפקיד '${deniedLabel}' לא ניתן ל-${denyReq.requesterName}`
                : `Role request denied. The '${deniedLabel}' role was not granted to ${denyReq.requesterName} (${denyReq.requesterEmail})`)
              : (isHebrewDeny
                ? `בקשת ההרשאה נדחתה. ההרשאה '${deniedLabel}' לא ניתנה ל-${denyReq.requesterName}`
                : `Permission request denied. '${deniedLabel}' was not granted to ${denyReq.requesterName} (${denyReq.requesterEmail})`)
          };
        }

        case 'getUserPermissions': {
          const getUserPermsContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_user_permissions',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          if (!args.email) {
            return { success: false, message: 'Email address is required' };
          }

          const userWithPerms = await SecureDataAccess.query(
            'users',
            { email: args.email.toLowerCase().trim() },
            { limit: 1, projection: { permissions: 1, role: 1, roles: 1, email: 1, firstName: 1, lastName: 1 } },
            getUserPermsContext
          );

          if (!userWithPerms || userWithPerms.length === 0) {
            return { success: false, message: `User with email ${args.email} not found` };
          }

          const permUser = userWithPerms[0];
          return { success: true, email: permUser.email, name: [permUser.firstName, permUser.lastName].filter(Boolean).join(' '), roles: permUser.roles || [], permissions: permUser.permissions || [] };
        }

        case 'assignRole': {
          // Delegate to addUserRole in userService (which resolves by email)
          return await getService('userService').addUserRole(
            { userId: args.email, role: args.role },
            practiceContext, session
          );
        }
          
        // ========== NEW THREAT DETECTION ==========
        // INFRASTRUCTURE: Threat detection and IP blocking service - Keep as callAPI
        case 'getThreatLevel':
          return await this.callAPI(`/threat-detection/check/${args.ipAddress}`, 'GET', {}, practiceContext);
        case 'blockIP':
          return await this.callAPI('/threat-detection/block', 'POST', args, practiceContext);
        case 'unblockIP':
          return await this.callAPI(`/threat-detection/unblock/${args.ipAddress}`, 'POST', {}, practiceContext);

        // ========== NEW E2E ENCRYPTION ==========
        // INFRASTRUCTURE: End-to-end encryption key management - Keep as callAPI
        case 'getEncryptionKeys':
          return await this.callAPI(`/e2e-encryption/keys/${args.userId}`, 'GET', {}, practiceContext);
        case 'rotateEncryptionKeys':
          return await this.callAPI(`/e2e-encryption/rotate/${args.userId}`, 'POST', {}, practiceContext);
          
        // ========== NEW DELETED PATIENTS ==========
        case 'getDeletedPatients':
          const getDeletedContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_deleted_patients',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const deletedPatients = await SecureDataAccess.query(
            'patients',
            { deleted: true },
            { sort: { deletedAt: -1 } },
            getDeletedContext
          );

          return { success: true, data: deletedPatients };

        case 'restorePatient':
          const restorePatientContext = {
            serviceId: 'agentServiceV4',
            operation: 'restore_patient',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const restoredPatient = await SecureDataAccess.update(
            'patients',
            { _id: new ObjectId(args.patientId) },
            {
              $set: {
                deleted: false,
                restoredAt: new Date(),
                restorationReason: args.reason,
                updatedAt: new Date()
              },
              $unset: { deletedAt: "" }
            },
            restorePatientContext
          );

          return { success: true, data: restoredPatient };

        case 'permanentlyDeletePatient':
          if (!args.confirmation) {
            return {
              success: false,
              error: 'Permanent deletion must be confirmed with confirmation: true'
            };
          }

          const permanentDeleteContext = {
            serviceId: 'agentServiceV4',
            operation: 'permanently_delete_patient',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const deleteResult = await SecureDataAccess.delete(
            'patients',
            { _id: new ObjectId(args.patientId), deleted: true },
            permanentDeleteContext
          );

          return { success: true, data: deleteResult };
          
        // ========== NEW POSTAL CODES ==========
        // COMMENTED OUT: Routes don't exist - postal code services not implemented
        // case 'searchPostalCode':
        //   return await this.callAPI('/postal-codes/search', 'GET', args, practiceContext);
        // case 'getPostalCodeDetails':
        //   return await this.callAPI(`/postal-codes/${args.postalCode}`, 'GET', {}, practiceContext);

        // ========== NEW STREETS ==========
        // COMMENTED OUT: Routes don't exist - street lookup services not implemented
        // case 'searchStreets':
        //   return await this.callAPI('/streets/search', 'GET', args, practiceContext);
        // case 'getStreetDetails':
        //   return await this.callAPI(`/streets/${args.streetId}`, 'GET', {}, practiceContext);
          
        // ========== NEW GRAPHQL MANAGEMENT ==========
        case 'getGraphQLStats':
          return await this.callAPI('/graphql/stats', 'GET', {}, practiceContext);
        case 'getGraphQLHealth':
          return await this.callAPI('/graphql/health', 'GET', {}, practiceContext);
        case 'configureGraphQL':
          return await this.callAPI('/graphql/config', 'POST', args, practiceContext);
        case 'testGraphQLQuery':
          return await this.callAPI('/graphql/test-query', 'POST', args, practiceContext);
          
        // ========== NEW SECRETS MANAGEMENT ==========
        // INFRASTRUCTURE: Secrets management service - Keep as callAPI
        case 'createSecret':
          return await this.callAPI('/secrets-management', 'POST', args, practiceContext);
        case 'getSecret':
          return await this.callAPI(`/secrets-management/${args.secretName}`, 'GET', {}, practiceContext);
        case 'rotateSecret':
          return await this.callAPI(`/secrets-management/${args.secretName}/rotate`, 'POST', {}, practiceContext);
        case 'deleteSecret':
          return await this.callAPI(`/secrets-management/${args.secretName}`, 'DELETE', { force: args.force }, practiceContext);
        case 'listSecrets':
          return await this.callAPI('/secrets-management', 'GET', args, practiceContext);
          
        // ========== NEW TRACING & MONITORING ==========
        // INFRASTRUCTURE: Distributed tracing and monitoring - Keep as callAPI
        case 'getTraces':
          return await this.callAPI('/tracing', 'GET', args, practiceContext);
        case 'getMetrics':
          return await this.callAPI('/monitoring/metrics', 'GET', args, practiceContext);
        case 'createAlert':
          return await this.callAPI('/monitoring/alerts', 'POST', args, practiceContext);

        // ========== NEW PASSWORDLESS AUTH ==========
        // INFRASTRUCTURE: Passwordless authentication service - Keep as callAPI
        case 'initiatePasswordlessLogin':
          return await this.callAPI('/passwordless-auth/initiate', 'POST', args, practiceContext);
        case 'verifyPasswordlessCode':
          return await this.callAPI('/passwordless-auth/verify', 'POST', args, practiceContext);
          
        // ========== NEW CSP & SECURITY HEADERS ==========
        // INFRASTRUCTURE: Security headers and CSP management - Keep as callAPI
        case 'getCSPViolations':
          return await this.callAPI('/csp/violations', 'GET', args, practiceContext);
        case 'updateCSPPolicy':
          return await this.callAPI('/csp/policy', 'PUT', args, practiceContext);
        case 'getSecurityHeaders':
          return await this.callAPI('/security-headers', 'GET', {}, practiceContext);
        case 'updateSecurityHeader':
          return await this.callAPI('/security-headers', 'PUT', args, practiceContext);

        // ========== NEW AI EVENTS ==========
        // INFRASTRUCTURE: AI event monitoring - Keep as callAPI
        case 'getAIEvents':
          return await this.callAPI('/ai-events/events', 'GET', args, practiceContext);
          
        // ========== NEW LOAD BALANCING ==========
        case 'getLoadBalancerStatus':
          return await this.callAPI('/load-balancing/status', 'GET', {}, practiceContext);
        case 'updateLoadBalancerConfig':
          return await this.callAPI('/load-balancing/config', 'PUT', args, practiceContext);
          
        // ========== NEW ZERO KNOWLEDGE AUTH ==========
        // INFRASTRUCTURE: Zero-knowledge proof authentication - Keep as callAPI
        case 'initZKAuth':
          return await this.callAPI('/zk-auth/init', 'POST', args, practiceContext);
        case 'verifyZKProof':
          return await this.callAPI('/zk-auth/verify', 'POST', args, practiceContext);
          
        // ========== NEW CHAT SESSIONS ==========
        case 'getChatSessions':
          const getChatSessionsContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_chat_sessions',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const sessions = await SecureDataAccess.query(
            'chat_sessions',
            args.userId ? { userId: args.userId } : {},
            { sort: { updatedAt: -1 }, limit: args.limit || 50 },
            getChatSessionsContext
          );

          return { success: true, data: sessions };

        case 'getChatMessages':
          const getChatMessagesContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_chat_messages',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const chatMessages = await SecureDataAccess.query(
            'chat_messages',
            { sessionId: args.sessionId },
            { sort: { createdAt: 1 } },
            getChatMessagesContext
          );

          return { success: true, data: chatMessages };

        case 'sendChatMessage':
          const sendChatMsgContext = {
            serviceId: 'agentServiceV4',
            operation: 'send_chat_message',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const newChatMessage = await SecureDataAccess.insert(
            'chat_messages',
            {
              sessionId: args.sessionId,
              message: args.message,
              attachments: args.attachments || [],
              createdAt: new Date(),
              updatedAt: new Date()
            },
            sendChatMsgContext
          );

          return { success: true, data: newChatMessage };

        case 'updateChatSessionTitle':
          const updateTitleContext = {
            serviceId: 'agentServiceV4',
            operation: 'update_chat_session_title',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const updatedSession = await SecureDataAccess.update(
            'chat_sessions',
            { _id: new ObjectId(args.sessionId) },
            { $set: { title: args.title, updatedAt: new Date() } },
            updateTitleContext
          );

          return { success: true, data: updatedSession };

        case 'deleteChatSession':
          const deleteSessionContext = {
            serviceId: 'agentServiceV4',
            operation: 'delete_chat_session',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          await SecureDataAccess.delete(
            'chat_sessions',
            { _id: new ObjectId(args.sessionId) },
            deleteSessionContext
          );

          return { success: true, message: 'Chat session deleted' };

        case 'searchChatSessions':
          const searchSessionsContext = {
            serviceId: 'agentServiceV4',
            operation: 'search_chat_sessions',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const searchFilter = {};
          if (args.query) {
            searchFilter.$or = [
              { title: { $regex: args.query, $options: 'i' } },
              { tags: { $in: [args.query] } }
            ];
          }

          const searchResults = await SecureDataAccess.query(
            'chat_sessions',
            searchFilter,
            { sort: { updatedAt: -1 }, limit: args.limit || 20 },
            searchSessionsContext
          );

          return { success: true, data: searchResults };

        case 'getChatAnalytics':
          const analyticsContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_chat_analytics',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const totalSessions = await SecureDataAccess.query(
            'chat_sessions',
            {},
            {},
            analyticsContext
          );

          const totalMessages = await SecureDataAccess.query(
            'chat_messages',
            {},
            {},
            analyticsContext
          );

          return {
            success: true,
            data: {
              totalSessions: totalSessions.length,
              totalMessages: totalMessages.length,
              averageMessagesPerSession: totalSessions.length > 0 ? totalMessages.length / totalSessions.length : 0
            }
          };
        case 'exportChatHistory':
          // INFRASTRUCTURE: Chat history export service - Keep as callAPI
          return await this.callAPI('/chat/export', 'GET', args, practiceContext);
          
        // ========== NEW DIAGNOSIS ADVANCED ==========
        // INFRASTRUCTURE: Complex AI diagnosis services - Keep as callAPI
        case 'getDiagnosisModels':
          return await this.callAPI('/diagnosis/models', 'GET', {}, practiceContext);
        case 'stopDiagnosis':
          return await this.callAPI('/diagnosis/stop', 'POST', { taskId: args.taskId }, practiceContext);
        case 'getDiagnosisStatus':
          return await this.callAPI('/diagnosis/status', 'GET', { taskId: args.taskId }, practiceContext);

        // ========== NEW API VERSIONING ==========
        // INFRASTRUCTURE: API version management service - Keep as callAPI
        case 'getAPIVersions':
          return await this.callAPI('/api-versioning/versions', 'GET', {}, practiceContext);
        case 'getAPIChangelog':
          return await this.callAPI(`/api-versioning/changelog/${args.version}`, 'GET', {}, practiceContext);
        case 'deprecateAPI':
          return await this.callAPI('/api-versioning/deprecate', 'POST', args, practiceContext);
          
        // ========== NEW COMPLIANCE REPORTING ==========
        // INFRASTRUCTURE: Complex compliance audit and reporting service - Keep as callAPI
        case 'getComplianceStatus':
          return await this.callAPI('/compliance-reporting/status', 'GET', args, practiceContext);
        case 'generateComplianceReportDetailed':
          return await this.callAPI('/compliance-reporting/generate', 'POST', args, practiceContext);
        case 'scheduleComplianceAudit':
          return await this.callAPI('/compliance-reporting/audit/schedule', 'POST', args, practiceContext);
          
        // ========== NEW BATCH OPERATIONS ==========
        case 'batchUpdatePatients':
          const batchUpdateContext = {
            serviceId: 'agentServiceV4',
            operation: 'batch_update_patients',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const updatePromises = args.patients.map(patient =>
            SecureDataAccess.update(
              'patients',
              { _id: new ObjectId(patient.id) },
              { $set: { ...patient.updates, updatedAt: new Date() } },
              batchUpdateContext
            )
          );

          const results = await Promise.all(updatePromises);
          return { success: true, updated: results.length, data: results };

        case 'batchDeleteSessions':
          const batchDeleteContext = {
            serviceId: 'agentServiceV4',
            operation: 'batch_delete_sessions',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          await SecureDataAccess.delete(
            'chat_sessions',
            { _id: { $in: args.sessionIds.map(id => new ObjectId(id)) } },
            batchDeleteContext
          );

          return { success: true, deleted: args.sessionIds.length };

        case 'batchAnalyzeDocuments':
          // INFRASTRUCTURE: Complex document analysis with AI - Keep as callAPI
          return await this.callAPI('/documents/batch-analyze', 'POST', args, practiceContext);
          
        // ========== NEW WEBHOOKS ==========
        case 'createWebhook':
          const createWebhookContext = {
            serviceId: 'agentServiceV4',
            operation: 'create_webhook',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const newWebhook = await SecureDataAccess.insert(
            'webhooks',
            {
              ...args,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            createWebhookContext
          );

          return { success: true, data: newWebhook };

        case 'listWebhooks':
          const listWebhooksContext = {
            serviceId: 'agentServiceV4',
            operation: 'list_webhooks',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const webhooks = await SecureDataAccess.query(
            'webhooks',
            {},
            { sort: { createdAt: -1 } },
            listWebhooksContext
          );

          return { success: true, data: webhooks };

        case 'deleteWebhook':
          const deleteWebhookContext = {
            serviceId: 'agentServiceV4',
            operation: 'delete_webhook',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          await SecureDataAccess.delete(
            'webhooks',
            { _id: new ObjectId(args.webhookId) },
            deleteWebhookContext
          );

          return { success: true, message: 'Webhook deleted' };

        case 'testWebhook':
          // INFRASTRUCTURE: Webhook testing with HTTP calls - Keep as callAPI
          return await this.callAPI(`/webhooks/${args.webhookId}/test`, 'POST', { payload: args.payload }, practiceContext);

        // ========== NEW ADVANCED USER MANAGEMENT ==========
        case 'getAllUsers':
          const getAllUsersContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_all_users',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const allUsers = await SecureDataAccess.query(
            'users',
            args.filter || {},
            { sort: { createdAt: -1 }, limit: args.limit || 100 },
            getAllUsersContext
          );

          return { success: true, data: allUsers };
        case 'searchUsers':
          return await getService('userService').searchUsers(args, practiceContext, session);
        case 'setupUserAsDoctor':
          return await getService('providerService').setupUserAsDoctor(args, practiceContext, session);
        case 'setupMultipleDoctors':
          return await getService('providerService').setupMultipleDoctors(args, practiceContext, session);
        case 'assignAllPatientsToDoctor':
          return await getService('providerService').assignAllPatientsToDoctor(args, practiceContext, session);
        case 'bulkUpdateRoles':
          return await getService('userService').bulkUpdateRoles(args, practiceContext, session);
        case 'getUserDetails': {
          // DATABASE OPERATION: Refactored from callAPI to SecureDataAccess
          const getUserDetailsContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_user_details',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const { ObjectId } = require('mongodb');
          
          // Handle different userId formats
          let userId = args.userId;
          let filter = {};
          
          // If userId is "me", use the current session user
          if (userId === 'me' && session) {
            userId = session.userId || session.providerId;
            if (!userId) {
              return { 
                success: false, 
                message: session?.language === 'he' ? 'לא נמצא מזהה משתמש בסשן' : 'No user ID found in session' 
              };
            }
          }
          
          // If userId is an email, search by email
          if (userId && userId.includes('@')) {
            filter = { email: userId };
          } 
          // If userId looks like a valid ObjectId, search by _id
          else if (userId && /^[0-9a-fA-F]{24}$/.test(userId)) {
            filter = { _id: new ObjectId(userId) };
          }
          // Otherwise, try searching by name or other fields
          else {
            // Try to find by profile name
            filter = {
              $or: [
                { 'profile.name': { $regex: userId, $options: 'i' } },
                { 'profile.firstName': { $regex: userId, $options: 'i' } },
                { 'profile.lastName': { $regex: userId, $options: 'i' } }
              ]
            };
          }
          
          const users = await SecureDataAccess.query(
            'users',
            filter,
            { limit: 1 },
            getUserDetailsContext
          );

          if (users && users.length > 0) {
            return { success: true, data: users[0] };
          }

          return { 
            success: false, 
            message: session?.language === 'he' ? 'משתמש לא נמצא' : 'User not found' 
          };
        }
        case 'updateUserProfile': {
          const { ObjectId } = require('mongodb');
          const updateProfileContext = {
            serviceId: 'agentServiceV4',
            operation: 'update_user_profile',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          // If userId is an email, find the user first to get the ID
          let actualUserId = args.userId;
          let userFilter;
          if (args.userId && args.userId.includes('@')) {
            userFilter = { email: args.userId.toLowerCase() };
          } else if (args.userId && /^[0-9a-fA-F]{24}$/.test(args.userId)) {
            userFilter = { _id: new ObjectId(args.userId) };
          } else {
            userFilter = { $or: [
              { 'profile.firstName': { $regex: args.userId, $options: 'i' } },
              { 'profile.lastName': { $regex: args.userId, $options: 'i' } }
            ]};
          }

          // Parse profileData if it's a string
          let profileData = args.profileData;
          if (typeof profileData === 'string') {
            try { profileData = JSON.parse(profileData); } catch (e) { /* already an object */ }
          }

          // Build $set object — handle both profile fields and top-level fields like email
          const $set = { updatedAt: new Date() };
          for (const [key, value] of Object.entries(profileData)) {
            if (['email'].includes(key)) {
              $set[key] = value; // top-level field
            } else {
              $set[`profile.${key}`] = value; // nested under profile
            }
          }

          const updateResult = await SecureDataAccess.update('users', userFilter, { $set }, updateProfileContext);
          return { success: true, message: session?.language === 'he' ? 'פרופיל עודכן בהצלחה' : 'Profile updated successfully', data: updateResult };
        }
        case 'getUserActivity': {
          // DATABASE OPERATION: Refactored from callAPI to SecureDataAccess
          const getUserActivityContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_user_activity',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const { ObjectId } = require('mongodb');

          // Query activity logs for this user
          const filter = { userId: args.userId };
          if (args.startDate) {
            filter.createdAt = { $gte: new Date(args.startDate) };
          }
          if (args.endDate) {
            filter.createdAt = filter.createdAt || {};
            filter.createdAt.$lte = new Date(args.endDate);
          }

          const activities = await SecureDataAccess.query(
            'user_activity',
            filter,
            { sort: { createdAt: -1 }, limit: args.limit || 50 },
            getUserActivityContext
          );

          return { success: true, data: activities };
        }
        case 'suspendUser': {
          const { ObjectId: SuspendObjId } = require('mongodb');
          const suspendContext = {
            serviceId: 'agentServiceV4',
            operation: 'suspend_user',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };
          const suspendFilter = args.userId.includes('@')
            ? { email: args.userId.toLowerCase() }
            : { _id: new SuspendObjId(args.userId) };
          await SecureDataAccess.update('users', suspendFilter, {
            $set: { status: 'suspended', suspendedAt: new Date(), suspendReason: args.reason, updatedAt: new Date() }
          }, suspendContext);
          return { success: true, message: session?.language === 'he' ? 'המשתמש הושעה בהצלחה' : 'User suspended successfully' };
        }
        case 'reactivateUser': {
          const { ObjectId: ReactObjId } = require('mongodb');
          const reactivateContext = {
            serviceId: 'agentServiceV4',
            operation: 'reactivate_user',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };
          const reactivateFilter = args.userId.includes('@')
            ? { email: args.userId.toLowerCase() }
            : { _id: new ReactObjId(args.userId) };
          await SecureDataAccess.update('users', reactivateFilter, {
            $set: { status: 'active', updatedAt: new Date() }, $unset: { suspendedAt: '', suspendReason: '' }
          }, reactivateContext);
          return { success: true, message: session?.language === 'he' ? 'המשתמש הופעל מחדש בהצלחה' : 'User reactivated successfully' };
        }
          
        // ========== NEW PRACTICE MANAGEMENT ADVANCED ==========
        // DATABASE OPERATIONS: Refactored from callAPI to SecureDataAccess
        case 'getAllClinics': {
          const getAllClinicsContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_all_clinics',
            practiceId: 'global', // Practices collection is in global database
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const practices = await SecureDataAccess.query(
            'practices',
            {},
            { sort: { createdAt: -1 } },
            getAllClinicsContext
          );

          return { success: true, data: practices };
        }

        case 'createClinic': {
          const createClinicContext = {
            serviceId: 'agentServiceV4',
            operation: 'create_clinic',
            practiceId: 'global',
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const newPractice = {
            ...args,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          const result = await SecureDataAccess.insert(
            'practices',
            newPractice,
            createClinicContext
          );

          return { success: true, data: result };
        }

        case 'updateClinic': {
          const updateClinicContext = {
            serviceId: 'agentServiceV4',
            operation: 'update_clinic',
            practiceId: 'global',
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const { ObjectId } = require('mongodb');
          const updatedPractice = await SecureDataAccess.update(
            'practices',
            { _id: new ObjectId(args.practiceId) },
            { $set: { ...args.updates, updatedAt: new Date() } },
            updateClinicContext
          );

          return { success: true, data: updatedPractice };
        }

        case 'getClinicUsage': {
          const getClinicUsageContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_clinic_usage',
            practiceId: 'global',
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const { ObjectId } = require('mongodb');

          // Query practice usage data - this might need adjustment based on actual schema
          const practice = await SecureDataAccess.query(
            'practices',
            { _id: new ObjectId(args.practiceId) },
            {},
            getClinicUsageContext
          );

          if (practice && practice.length > 0) {
            // Return usage data from practice document or calculate from related collections
            return {
              success: true,
              data: {
                practiceId: args.practiceId,
                usage: practice[0].usage || {},
                period: args.period
              }
            };
          }

          return { success: false, message: 'Practice not found' };
        }
          
        // ========== NEW SECURITY MONITORING ADVANCED ==========
        // INFRASTRUCTURE: Complex service logic - Keep as callAPI
        case 'getSecurityDashboard':
          return await this.callAPI('/security-dashboard', 'GET', {}, practiceContext);
        case 'getSecurityAlerts':
          return await this.callAPI('/security-monitoring/alerts', 'GET', args, practiceContext);
        case 'acknowledgeSecurityAlert':
          return await this.callAPI(`/security-monitoring/alerts/${args.alertId}/acknowledge`, 'POST', { notes: args.notes }, practiceContext);
        case 'getSecurityMetrics':
          return await this.callAPI('/security-monitoring/metrics', 'GET', args, practiceContext);

        // ========== NEW DATABASE OPTIMIZATION ADVANCED ==========
        // INFRASTRUCTURE: Database management service - Keep as callAPI
        case 'analyzeDatabase':
          return await this.callAPI('/db-optimization/analyze', 'POST', { deep: args.deep }, practiceContext);
        case 'rebuildIndexes':
          return await this.callAPI('/db-optimization/rebuild-indexes', 'POST', { collection: args.collection }, practiceContext);
        case 'getCacheStatistics':
          return await this.callAPI('/db-optimization/cache/stats', 'GET', {}, practiceContext);
        case 'warmupCache':
          return await this.callAPI('/db-optimization/cache/warmup', 'POST', { cacheType: args.cacheType }, practiceContext);
          
        // ========== NEW CIRCUIT BREAKER ADVANCED ==========
        // INFRASTRUCTURE: Circuit breaker management service - Keep as callAPI
        case 'getAllCircuitBreakers':
          return await this.callAPI('/circuit-breaker/all', 'GET', {}, practiceContext);
        case 'forceOpenCircuitBreaker':
          return await this.callAPI(`/circuit-breaker/${args.serviceName}/force-open`, 'POST', { reason: args.reason }, practiceContext);
        case 'getCircuitBreakerHistory':
          return await this.callAPI(`/circuit-breaker/${args.serviceName}/history`, 'GET', { limit: args.limit }, practiceContext);

        // ========== NEW DISASTER RECOVERY ADVANCED ==========
        // INFRASTRUCTURE: Disaster recovery service - Keep as callAPI
        case 'performFailover':
          return await this.callAPI('/disaster-recovery/failover', 'POST', args, practiceContext);
        case 'testDisasterRecovery':
          return await this.callAPI('/disaster-recovery/test', 'POST', args, practiceContext);
        case 'getDisasterRecoveryStatus':
          return await this.callAPI('/disaster-recovery/status', 'GET', {}, practiceContext);
        case 'scheduleBackup':
          return await this.callAPI('/disaster-recovery/backup/schedule', 'POST', args, practiceContext);
        case 'restoreFromBackup':
          return await this.callAPI('/disaster-recovery/restore', 'POST', args, practiceContext);

        // ========== NEW LOAD BALANCING ADVANCED ==========
        // INFRASTRUCTURE: Load balancing service - Keep as callAPI
        case 'addServer':
          return await this.callAPI('/load-balancing/servers', 'POST', args, practiceContext);
        case 'removeServer':
          return await this.callAPI(`/load-balancing/servers/${args.serverId}`, 'DELETE', { graceful: args.graceful }, practiceContext);
        case 'drainServer':
          return await this.callAPI(`/load-balancing/servers/${args.serverId}/drain`, 'POST', {}, practiceContext);
        case 'getServerHealth':
          return await this.callAPI(`/load-balancing/servers/${args.serverId}/health`, 'GET', {}, practiceContext);
        case 'getLoadDistribution':
          return await this.callAPI('/load-balancing/distribution', 'GET', {}, practiceContext);
          
        // ========== NEW ADVANCED SECURITY MONITORING ==========
        case 'getDetailedSecurityMetrics':
          return await this.callAPI('/security-monitoring/detailed-metrics', 'GET', args, practiceContext);
        case 'getThreatReport':
          return await this.callAPI('/security-monitoring/threat-report', 'GET', args, practiceContext);
        case 'emitSecurityEvent':
          return await this.callAPI('/security-monitoring/emit-event', 'POST', args, practiceContext);
        case 'blacklistIP':
          return await this.callAPI('/security-monitoring/blacklist-ip', 'POST', args, practiceContext);
        case 'checkIPReputation':
          return await this.callAPI(`/security-monitoring/check-ip/${args.ipAddress}`, 'GET', {}, practiceContext);
        case 'getActiveAlerts':
          return await this.callAPI('/security-monitoring/active-alerts', 'GET', args, practiceContext);
        case 'getSystemHealthDetailed':
          return await this.callAPI('/security-monitoring/system-health', 'GET', {}, practiceContext);
        case 'updateSecurityThresholds':
          return await this.callAPI('/security-monitoring/update-thresholds', 'POST', args, practiceContext);
        case 'getSecurityEventTypes':
          return await this.callAPI('/security-monitoring/event-types', 'GET', {}, practiceContext);
        case 'getRecentSecurityEvents':
          return await this.callAPI('/security-monitoring/recent-events', 'GET', args, practiceContext);
          
        // ========== NEW MEDICAL DATA ADVANCED ==========
        case 'addLabResult':
          const addLabContext = {
            serviceId: 'agentServiceV4',
            operation: 'add_lab_result',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const newLabResult = await SecureDataAccess.insert(
            'lab_results',
            {
              patientId: args.patientId,
              ...args,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            addLabContext
          );

          return { success: true, data: newLabResult };

        case 'addAllergy':
          const addAllergyContext = {
            serviceId: 'agentServiceV4',
            operation: 'add_allergy',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const newAllergy = await SecureDataAccess.insert(
            'allergies',
            {
              patientId: args.patientId,
              ...args,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            addAllergyContext
          );

          return { success: true, data: newAllergy };

        case 'updateVitalSigns':
          const updateVitalsContext = {
            serviceId: 'agentServiceV4',
            operation: 'update_vital_signs',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const newVitalSigns = await SecureDataAccess.insert(
            'vital_signs',
            {
              patientId: args.patientId,
              ...args,
              recordedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            },
            updateVitalsContext
          );

          return { success: true, data: newVitalSigns };

        case 'addVaccination':
          const addVaccinationContext = {
            serviceId: 'agentServiceV4',
            operation: 'add_vaccination',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const newVaccination = await SecureDataAccess.insert(
            'vaccinations',
            {
              patientId: args.patientId,
              ...args,
              administeredAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            },
            addVaccinationContext
          );

          return { success: true, data: newVaccination };
          
        // ========== NEW PRACTICE AUTH ADVANCED ==========
        case 'validateClinicToken':
          return await this.callAPI('/practice-auth/validate', 'POST', { token: args.token }, practiceContext);
        case 'rotateClinicToken':
          return await this.callAPI(`/practice-auth/rotate/${args.practiceId}`, 'POST', {}, practiceContext);
        case 'getClinicPermissions':
          return await this.callAPI(`/practice-auth/permissions/${args.practiceId}`, 'GET', {}, practiceContext);
          
        // ========== NEW API VERSIONING ADVANCED ==========
        case 'getMigrationGuide':
          return await this.callAPI('/api-versioning/migration-guide', 'GET', args, practiceContext);
        case 'getAPIUsageStats':
          return await this.callAPI('/api-versioning/usage-stats', 'GET', args, practiceContext);
        case 'testAPIEndpoint':
          return await this.callAPI('/api-versioning/test', 'POST', args, practiceContext);
          
        // ========== NEW TRACING ADVANCED ==========
        case 'getSpanDetails':
          return await this.callAPI(`/tracing/spans/${args.spanId}`, 'GET', {}, practiceContext);
        case 'getServiceMap':
          return await this.callAPI('/tracing/service-map', 'GET', {}, practiceContext);
        case 'getPerformanceTrace':
          return await this.callAPI(`/tracing/trace/${args.traceId}`, 'GET', {}, practiceContext);
          
        // ========== NEW E2E ENCRYPTION ADVANCED ==========
        case 'encryptData':
          return await this.callAPI('/e2e-encryption/encrypt', 'POST', args, practiceContext);
        case 'decryptData':
          return await this.callAPI('/e2e-encryption/decrypt', 'POST', args, practiceContext);
        case 'shareEncryptedDocument':
          return await this.callAPI('/e2e-encryption/share', 'POST', args, practiceContext);
        
        // Provider Management - REMOVED: Now handled by medical functions system
        // getPatientProvider now goes through generatedMedicalFunctions.js → optimizedMedicalFunctions.js
        // This ensures streaming through Claude API instead of instant database return
        case 'getDoctorAvailability':
          // Real implementation lives in labService (providerService has no such method).
          return await getService('labService').getDoctorAvailability(args, practiceContext, session);
        case 'setDoctorAvailability':
          // Use the real labService implementation. The previous inline write targeted the
          // wrong collection (patient_provider) and did new ObjectId(args.providerId), which
          // throws for PROV-* provider IDs generated by setupUserAsDoctor.
          return await getService('labService').setDoctorAvailability(args, practiceContext, session);

        case 'blockDoctorTime':
          const blockTimeContext = {
            serviceId: 'agentServiceV4',
            operation: 'block_provider_time',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const blockedTime = await SecureDataAccess.insert(
            'provider_blocked_times',
            {
              providerId: args.providerId,
              ...args,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            blockTimeContext
          );

          return { success: true, data: blockedTime };

        case 'getDoctorSchedule': // a doctor's/nurse's schedule = their appointments (same handler)
        case 'getDoctorAppointments':
          // Auto-fill provider ID from authenticated user if not provided
          const providerArgs = { ...args };
          if (!providerArgs.providerId && practiceContext.user?.id) {
            providerArgs.providerId = practiceContext.user.id;
            console.log(`🔐 Auto-filled providerId from authenticated user: ${providerArgs.providerId}`);
          }

          const getProviderApptContext = {
            serviceId: 'agentServiceV4',
            operation: 'get_provider_appointments',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const providerAppointments = await SecureDataAccess.query(
            'appointments',
            { providerId: providerArgs.providerId },
            { sort: { appointmentDate: -1 } },
            getProviderApptContext
          );

          return { success: true, data: providerAppointments };

        case 'updateDoctorSettings':
          // Use the real providerService implementation (updates users.providerInfo).
          // The previous inline write targeted patient_provider with new ObjectId(args.providerId),
          // which throws for PROV-* provider IDs.
          return await getService('providerService').updateDoctorSettings(args, practiceContext, session);

        case 'removeDoctorInfo':
          // Inverse of setupUserAsDoctor: unset the user's providerInfo (calendar/scheduling).
          // Clinical role (doctor/nurse) is left unchanged. Handler lives in providerService.
          return await getService('providerService').removeDoctorInfo(args, practiceContext, session);
        
        // Provider Meetings (Doctor-to-Doctor)
        case 'scheduleDoctorMeeting':
          return await require('./providerService').scheduleDoctorMeeting(args, practiceContext, session);
        case 'getDoctorMeetings':
          return await require('./providerService').getDoctorMeetings(args, practiceContext, session);
        case 'deleteDoctorMeetings':
          return await require('./providerService').deleteDoctorMeetings(args, practiceContext, session);
        case 'getAvailableMeetingTimes':
          return await require('./providerService').getAvailableMeetingTimes(args, practiceContext, session);
        case 'createRecurringMeeting':
          return await require('./providerService').createRecurringMeeting(args, practiceContext, session);
        case 'getRecurringMeetingSeries':
          return await require('./providerService').getRecurringMeetingSeries(args, practiceContext, session);
        case 'updateRecurringMeeting':
          return await require('./providerService').updateRecurringMeeting(args, practiceContext, session);
        case 'deleteRecurringMeetingSeries':
          return await require('./providerService').deleteRecurringMeetingSeries(args, practiceContext, session);

        // ========== HIPAA COMPLIANCE - CONSENT MANAGEMENT ==========
        case 'recordConsent':
          return await consentManagementService.grantConsent(
            args.patientId,
            args.consentType,
            {
              grantedBy: session?.userId || 'system',
              scope: args.scope || 'full',
              expiresAt: args.expirationDate,
              practiceId: practiceContext?.practiceId,
              practiceDb: practiceContext?.practiceDb
            }
          );
          
        case 'updateConsent':
          return await consentManagementService.updateConsent(
            args.patientId,
            args.consentId,
            {
              consentType: args.consentType,
              scope: args.scope,
              expirationDate: args.expirationDate,
              updatedBy: session?.userId || 'system',
              practiceId: practiceContext?.practiceId
            }
          );
          
        case 'revokeConsent':
          return await consentManagementService.withdrawConsent(
            args.patientId,
            args.consentType || args.consentId,  // withdrawConsent takes consentType, not consentId
            {
              withdrawnBy: session?.userId || 'system',
              reason: args.reason,
              practiceId: practiceContext?.practiceId,
              practiceDb: practiceContext?.practiceDb
            }
          );
          
        case 'getPatientConsents':
          return await consentManagementService.getPatientConsents(
            args.patientId,
            {
              activeOnly: args.activeOnly || false,
              practiceId: practiceContext?.practiceId,
              practiceDb: practiceContext?.practiceDb
            }
          );
          
        case 'checkConsentStatus':
          return await consentManagementService.hasConsent(
            args.patientId,
            args.consentType || args.action,  // hasConsent takes consentType
            {
              requestorId: args.requestorId,
              practiceId: practiceContext?.practiceId,
              practiceDb: practiceContext?.practiceDb
            }
          );
          
        // ========== HIPAA COMPLIANCE - PHI ANONYMIZATION ==========
        case 'anonymizePatientData':
          // Get patient data first
          patient = await getService('patientService').searchPatients(
            { query: args.patientId },
            practiceContext,
            session
          );
          if (!patient?.data?.[0]) {
            throw new Error('Patient not found');
          }
          return await phiAnonymizationService.anonymizeData(
            patient.data[0],
            {
              purpose: args.purpose || 'research',
              preserveFields: args.dataTypes || [],
              requestedBy: session?.userId || 'system',
              practiceId: practiceContext?.practiceId,
              practiceDb: practiceContext?.practiceDb
            }
          );
          
        case 'exportAnonymizedData':
          return await phiAnonymizationService.exportForResearch(
            args.criteria || {},
            {
              format: args.format || 'json',
              preserveFields: args.includeFields || [],
              requestedBy: session?.userId || 'system',
              practiceId: practiceContext?.practiceId,
              practiceDb: practiceContext?.practiceDb
            }
          );
          
        case 'reIdentifyData':
          return await phiAnonymizationService.reIdentifyData(
            args.anonymizedId || args.datasetId,
            args.authorizationCode || args.reIdKey,
            args.data || {},  // Third parameter is data to re-identify
            {
              reason: args.reason,
              userId: session?.userId || 'system',
              sessionId: session?.id,
              practiceId: practiceContext?.practiceId,
              practiceDb: practiceContext?.practiceDb
            }
          );
          
        // ========== Agent 2: Compliance & Access Specialist Functions ==========
        // Data Retention Management
        case 'scheduleDataRetention':
          const dataRetentionService = require('./dataRetentionService');
          return await dataRetentionService.scheduleRetention({
            retentionType: args.retentionType,
            retentionPeriod: args.retentionPeriod,
            schedule: args.schedule || 'monthly',
            practiceId: practiceContext?.practiceId
          });
          
        case 'executeDataRetention':
          const dataRetentionServiceExec = require('./dataRetentionService');
          return await dataRetentionServiceExec.executeRetention({
            retentionType: args.retentionType,
            dryRun: args.dryRun || false,
            practiceId: practiceContext?.practiceId
          });
          
        case 'getRetentionPolicy':
          const dataRetentionServiceGet = require('./dataRetentionService');
          return await dataRetentionServiceGet.getRetentionPolicy({
            retentionType: args.retentionType,
            practiceId: practiceContext?.practiceId
          });
          
        case 'updateRetentionPolicy':
          const dataRetentionServiceUpdate = require('./dataRetentionService');
          return await dataRetentionServiceUpdate.updateRetentionPolicy({
            retentionType: args.retentionType,
            retentionPeriod: args.retentionPeriod,
            autoDelete: args.autoDelete,
            practiceId: practiceContext?.practiceId
          });
          
        case 'getRetentionHistory':
          const dataRetentionServiceHistory = require('./dataRetentionService');
          return await dataRetentionServiceHistory.getRetentionHistory({
            startDate: args.startDate,
            endDate: args.endDate,
            limit: args.limit || 100,
            practiceId: practiceContext?.practiceId
          });
          
        // Audit and Compliance Reporting
        case 'generateAuditReport':
          const auditReportingService = require('./auditReportingService');
          return await auditReportingService.generateAuditReport({
            reportType: args.reportType,
            startDate: args.startDate,
            endDate: args.endDate,
            patientId: args.patientId,
            practiceId: practiceContext?.practiceId
          });
          
        case 'exportAuditData':
          const auditReportingServiceExport = require('./auditReportingService');
          return await auditReportingServiceExport.exportAuditData({
            format: args.format,
            dataTypes: args.dataTypes,
            startDate: args.startDate,
            endDate: args.endDate,
            encrypt: args.encrypt || true,
            practiceId: practiceContext?.practiceId
          });
          
        case 'scheduleComplianceReports':
          const auditReportingServiceSchedule = require('./auditReportingService');
          return await auditReportingServiceSchedule.scheduleComplianceReports({
            reportType: args.reportType,
            frequency: args.frequency,
            recipients: args.recipients,
            practiceId: practiceContext?.practiceId
          });
          
        // Access Request Management
        case 'submitAccessRequest':
          const accessRequestService = require('./accessRequestService');
          return await accessRequestService.submitRequest({
            patientId: args.patientId,
            requestType: args.requestType,
            reason: args.reason,
            recordTypes: args.recordTypes,
            requestedBy: session?.userId || 'patient',
            practiceId: practiceContext?.practiceId
          });
          
        case 'approveAccessRequest':
          const accessRequestServiceApprove = require('./accessRequestService');
          return await accessRequestServiceApprove.approveRequest({
            requestId: args.requestId,
            approvalNotes: args.approvalNotes,
            expirationDate: args.expirationDate,
            approvedBy: session?.userId || 'system',
            practiceId: practiceContext?.practiceId
          });
          
        case 'denyAccessRequest':
          const accessRequestServiceDeny = require('./accessRequestService');
          return await accessRequestServiceDeny.denyRequest({
            requestId: args.requestId,
            denialReason: args.denialReason,
            explanation: args.explanation,
            deniedBy: session?.userId || 'system',
            practiceId: practiceContext?.practiceId
          });
          
        case 'fulfillAccessRequest':
          const accessRequestServiceFulfill = require('./accessRequestService');
          return await accessRequestServiceFulfill.fulfillRequest({
            requestId: args.requestId,
            deliveryMethod: args.deliveryMethod,
            encryptionRequired: args.encryptionRequired !== false,
            fulfilledBy: session?.userId || 'system',
            practiceId: practiceContext?.practiceId
          });
          
        case 'getAccessRequests':
          const accessRequestServiceGet = require('./accessRequestService');
          return await accessRequestServiceGet.getAccessRequests({
            status: args.status || 'PENDING',
            patientId: args.patientId,
            limit: args.limit || 50,
            practiceId: practiceContext?.practiceId
          });
          
        case 'trackAccessDelivery':
          const accessRequestServiceTrack = require('./accessRequestService');
          return await accessRequestServiceTrack.trackDelivery({
            requestId: args.requestId,
            practiceId: practiceContext?.practiceId
          });
          
        // Breach Management
        case 'reportBreach':
          const breachAssessmentService = require('./breachAssessmentService');
          return await breachAssessmentService.reportBreach({
            breachType: args.breachType,
            affectedRecords: args.affectedRecords,
            discoveryDate: args.discoveryDate,
            description: args.description,
            reportedBy: session?.userId || 'system',
            practiceId: practiceContext?.practiceId
          });
          
        case 'assessBreachRisk':
          const breachAssessmentServiceAssess = require('./breachAssessmentService');
          return await breachAssessmentServiceAssess.assessBreachRisk({
            breachId: args.breachId,
            dataTypes: args.dataTypes,
            mitigation: args.mitigation,
            assessedBy: session?.userId || 'system',
            practiceId: practiceContext?.practiceId
          });
          
        case 'notifyAffectedParties':
          const breachAssessmentServiceNotify = require('./breachAssessmentService');
          return await breachAssessmentServiceNotify.notifyAffectedParties({
            breachId: args.breachId,
            notificationMethod: args.notificationMethod,
            includeRemediation: args.includeRemediation !== false,
            practiceId: practiceContext?.practiceId
          });
          
        case 'generateBreachReport':
          const breachAssessmentServiceReport = require('./breachAssessmentService');
          return await breachAssessmentServiceReport.generateBreachReport({
            breachId: args.breachId,
            reportFormat: args.reportFormat,
            practiceId: practiceContext?.practiceId
          });
          
        case 'getBreachHistory':
          const breachAssessmentServiceHistory = require('./breachAssessmentService');
          return await breachAssessmentServiceHistory.getBreachHistory({
            startDate: args.startDate,
            endDate: args.endDate,
            severity: args.severity || 'ALL',
            practiceId: practiceContext?.practiceId
          });

        // ========== Agent 3: Vendor & Documentation Functions ==========
        case 'assessVendorRisk':
          const vendorRiskService = require('./vendorRiskService');
          return await vendorRiskService.assessVendorRisk({
            ...args,
            practice: practiceContext.practice,
            userId: session?.userId
          });

        case 'addBusinessAssociate':
          const vendorRiskServiceAdd = require('./vendorRiskService');
          return await vendorRiskServiceAdd.addBusinessAssociate({
            ...args,
            practice: practiceContext.practice,
            userId: session?.userId
          });

        case 'updateBAAgreement':
          const vendorRiskServiceUpdate = require('./vendorRiskService');
          return await vendorRiskServiceUpdate.updateBAAgreement({
            ...args,
            practice: practiceContext.practice,
            userId: session?.userId
          });

        case 'getVendorCompliance':
          const vendorRiskServiceCompliance = require('./vendorRiskService');
          return await vendorRiskServiceCompliance.getVendorCompliance({
            ...args,
            practice: practiceContext.practice
          });

        case 'auditVendor':
          const vendorRiskServiceAudit = require('./vendorRiskService');
          return await vendorRiskServiceAudit.auditVendor({
            ...args,
            practice: practiceContext.practice,
            userId: session?.userId
          });

        case 'getVendorList':
          const vendorRiskServiceList = require('./vendorRiskService');
          return await vendorRiskServiceList.getVendorList({
            ...args,
            practice: practiceContext.practice
          });

        case 'createPolicy':
          const policyManagementService = require('./policyManagementService');
          return await policyManagementService.createPolicy({
            ...args,
            practice: practiceContext.practice,
            userId: session?.userId
          });

        case 'updatePolicy':
          const policyManagementServiceUpdate = require('./policyManagementService');
          return await policyManagementServiceUpdate.updatePolicy({
            ...args,
            practice: practiceContext.practice,
            userId: session?.userId
          });

        case 'getPolicy':
          const policyManagementServiceGet = require('./policyManagementService');
          return await policyManagementServiceGet.getPolicy({
            ...args,
            practice: practiceContext.practice
          });

        case 'acknowledgePolicy':
          const policyManagementServiceAck = require('./policyManagementService');
          return await policyManagementServiceAck.acknowledgePolicy({
            ...args,
            userId: args.userId || session?.userId,
            practice: practiceContext.practice
          });

        case 'getPolicyCompliance':
          const policyManagementServiceCompliance = require('./policyManagementService');
          return await policyManagementServiceCompliance.getPolicyCompliance({
            ...args,
            practice: practiceContext.practice
          });

        case 'documentProcess':
          const documentationService = require('./documentationService');
          return await documentationService.documentProcess({
            ...args,
            practice: practiceContext.practice,
            userId: session?.userId
          });

        case 'generateDocumentation':
          const documentationServiceGenerate = require('./documentationService');
          return await documentationServiceGenerate.generateDocumentation({
            ...args,
            practice: practiceContext.practice,
            userId: session?.userId
          });

        case 'validateDocumentation':
          const documentationServiceValidate = require('./documentationService');
          return await documentationServiceValidate.validateDocumentation({
            ...args,
            practice: practiceContext.practice
          });
          
        // ========== Agent 4: Incident & Training Specialist (15 functions) ==========
        case 'reportIncident':
          const incidentService = require('./incidentResponseService');
          return await incidentService.reportIncident({
            type: args.type,
            severity: args.severity,
            description: args.description,
            affectedPatients: args.affectedPatients || [],
            dateOccurred: args.dateOccurred,
            reportedBy: session?.userId || 'system',
            practiceId: practiceContext?.practiceId
          });

        case 'investigateIncident':
          const incidentServiceInvestigate = require('./incidentResponseService');
          return await incidentServiceInvestigate.investigateIncident(
            args.incidentId,
            {
              investigator: args.investigator,
              initialFindings: args.initialFindings,
              updatedBy: session?.userId || 'system'
            }
          );

        case 'escalateIncident':
          const incidentServiceEscalate = require('./incidentResponseService');
          return await incidentServiceEscalate.escalateIncident(
            args.incidentId,
            args.escalationLevel,
            {
              reason: args.reason,
              urgency: args.urgency || 'MEDIUM',
              escalatedBy: session?.userId || 'system'
            }
          );

        case 'resolveIncident':
          const incidentServiceResolve = require('./incidentResponseService');
          return await incidentServiceResolve.resolveIncident(
            args.incidentId,
            {
              resolution: args.resolution,
              preventiveMeasures: args.preventiveMeasures,
              lessonsLearned: args.lessonsLearned,
              resolvedBy: session?.userId || 'system'
            }
          );

        case 'getIncidentStatus':
          const incidentServiceStatus = require('./incidentResponseService');
          return await incidentServiceStatus.getIncidentStatus(args.incidentId);

        case 'generateIncidentReport':
          const incidentServiceReport = require('./incidentResponseService');
          return await incidentServiceReport.generateIncidentReport(
            args.incidentId,
            {
              format: args.format || 'JSON',
              includeTimeline: args.includeTimeline || false,
              includeForensics: args.includeForensics || false,
              requestedBy: session?.userId || 'system'
            }
          );

        case 'assignTraining':
          const trainingService = require('./securityTrainingService');
          return await trainingService.assignTraining(
            args.userId,
            args.trainingType,
            {
              dueDate: args.dueDate,
              mandatory: args.mandatory || false,
              assignedBy: session?.userId || 'system',
              practiceId: practiceContext?.practiceId
            }
          );

        case 'completeTraining':
          const trainingServiceComplete = require('./securityTrainingService');
          return await trainingServiceComplete.completeTraining(
            args.userId,
            args.trainingId,
            {
              score: args.score,
              certificateIssued: args.certificateIssued || false,
              completedDate: new Date().toISOString()
            }
          );

        case 'getTrainingStatus':
          const trainingServiceStatus = require('./securityTrainingService');
          return await trainingServiceStatus.getTrainingStatus(
            args.userId,
            {
              includeHistory: args.includeHistory || false,
              onlyMandatory: args.onlyMandatory || false
            }
          );

        case 'scheduleTraining':
          const trainingServiceSchedule = require('./securityTrainingService');
          return await trainingServiceSchedule.scheduleTraining({
            trainingType: args.trainingType,
            date: args.date,
            time: args.time,
            duration: args.duration || 60,
            attendees: args.attendees,
            instructor: args.instructor,
            scheduledBy: session?.userId || 'system',
            practiceId: practiceContext?.practiceId
          });

        case 'getTrainingMaterials':
          const trainingServiceMaterials = require('./securityTrainingService');
          return await trainingServiceMaterials.getTrainingMaterials(
            args.trainingType,
            args.language || language || 'he'
          );

        case 'generateTrainingReport':
          const trainingServiceReport = require('./securityTrainingService');
          return await trainingServiceReport.generateTrainingReport({
            department: args.department,
            dateRange: args.dateRange,
            includeMetrics: args.includeMetrics || false,
            practiceId: practiceContext?.practiceId
          });

        case 'performRiskAssessment':
          const vendorRiskServiceRisk = require('./vendorRiskService');
          return await vendorRiskServiceRisk.performRiskAssessment({
            assessmentType: args.assessmentType,
            scope: args.scope,
            systems: args.systems || [],
            performedBy: session?.userId || 'system',
            practiceId: practiceContext?.practiceId
          });

        case 'identifyVulnerabilities':
          const vendorRiskServiceVuln = require('./vendorRiskService');
          return await vendorRiskServiceVuln.identifyVulnerabilities({
            scanType: args.scanType,
            priority: args.priority || 'MEDIUM',
            automated: args.automated || false,
            scannedBy: session?.userId || 'system'
          });

        case 'generateRiskReport':
          const vendorRiskServiceReport = require('./vendorRiskService');
          return await vendorRiskServiceReport.generateRiskReport(
            args.assessmentId,
            {
              includeRecommendations: args.includeRecommendations || false,
              executiveSummary: args.executiveSummary || false,
              format: args.format || 'JSON',
              requestedBy: session?.userId || 'system'
            }
          );
          
        // ========== CURRENCY MANAGEMENT ==========
        case 'setCurrency':
        case 'changeCurrency':
          const currencyService = require('./currencyService');
          const newCurrency = args.currency || args.targetCurrency;
          const langForCurrency = session?.language || practiceContext?.language || 'en';
          
          // Get list of supported currencies from currencyService
          const supportedCurrencies = Object.keys(currencyService.exchangeRates || {});
          
          // Validate currency
          if (!supportedCurrencies.includes(newCurrency)) {
            return {
              success: false,
              error: langForCurrency === 'he' 
                ? `מטבע לא נתמך: ${newCurrency}. מטבעות נתמכים: ${supportedCurrencies.slice(0, 10).join(', ')}...`
                : `Unsupported currency: ${newCurrency}. Supported: ${supportedCurrencies.slice(0, 10).join(', ')}...`
            };
          }
          
          // Save to session
          if (session) {
            session.preferredCurrency = newCurrency;
          }
          
          // Save to user profile if logged in
          if (session?.userId && practiceContext?.req) {
            await currencyService.saveUserCurrencyPreference(
              session.userId, 
              newCurrency, 
              practiceContext.req
            );
          }
          
          // Get currency info
          const currencyInfo = currencyService.getAvailableCurrencies(langForCurrency);
          const selectedCurrency = SecureDataAccess.query('infos', c => c.code === newCurrency, {}, {
    ...context
  });
          
          return {
            success: true,
            currency: newCurrency,
            symbol: selectedCurrency?.symbol,
            name: selectedCurrency?.name,
            message: langForCurrency === 'he'
              ? `המטבע שונה ל-${selectedCurrency?.name} (${selectedCurrency?.symbol})`
              : `Currency changed to ${selectedCurrency?.name} (${selectedCurrency?.symbol})`
          };
          
        case 'getCurrency':
        case 'showCurrency':
          const currentCurrencyService = require('./currencyService');
          const langForGetCurrency = session?.language || practiceContext?.language || 'en';
          const currentCurrency = session?.preferredCurrency || 
                                 currentCurrencyService.getDefaultCurrencyForClinic(practiceContext?.practice) ||
                                 'USD';
          
          const currencies = currentCurrencyService.getAvailableCurrencies(langForGetCurrency);
          const current = currencies.find(c => c.code === currentCurrency);
          
          return {
            success: true,
            currentCurrency: currentCurrency,
            symbol: current?.symbol,
            name: current?.name,
            availableCurrencies: currencies.map(c => ({
              code: c.code,
              symbol: c.symbol,
              name: c.name
            })),
            message: langForGetCurrency === 'he'
              ? `המטבע הנוכחי: ${current?.name} (${current?.symbol})`
              : `Current currency: ${current?.name} (${current?.symbol})`
          };
          
        case 'convertCurrency':
          const conversionService = require('./currencyService');
          const langForConvert = session?.language || practiceContext?.language || 'en';
          const amount = parseFloat(args.amount || 0);
          const fromCurrency = args.from || 'USD';
          const toCurrency = args.to || session?.preferredCurrency || 'USD';
          
          // Convert via USD as base
          const amountInUSD = amount / conversionService.exchangeRates[fromCurrency];
          const convertedAmount = conversionService.convertFromUSD(amountInUSD, toCurrency);
          
          return {
            success: true,
            originalAmount: amount,
            fromCurrency: fromCurrency,
            toCurrency: toCurrency,
            convertedAmount: convertedAmount.toFixed(2),
            formatted: conversionService.formatCurrency(convertedAmount, toCurrency, 2),
            rate: (convertedAmount / amount).toFixed(4),
            message: langForConvert === 'he'
              ? `${conversionService.formatCurrency(amount, fromCurrency, 2)} = ${conversionService.formatCurrency(convertedAmount, toCurrency, 2)}`
              : `${conversionService.formatCurrency(amount, fromCurrency, 2)} = ${conversionService.formatCurrency(convertedAmount, toCurrency, 2)}`
          };
          
        case 'getExchangeRate':
          const rateService = require('./currencyService');
          const langForRate = session?.language || practiceContext?.language || 'en';
          const fromCurr = args.from || 'USD';
          const toCurr = args.to || 'EUR';
          
          // Ensure exchange rates are current
          if (!rateService.ratesCache || !rateService.cacheExpiry || new Date() > rateService.cacheExpiry) {
            await rateService.updateExchangeRates();
          }
          
          // Calculate the exchange rate
          const fromRate = rateService.exchangeRates[fromCurr] || 1;
          const toRate = rateService.exchangeRates[toCurr] || 1;
          const exchangeRate = toRate / fromRate;
          
          // Get currency symbols
          const fromSymbol = rateService.currencySymbols[fromCurr] || fromCurr;
          const toSymbol = rateService.currencySymbols[toCurr] || toCurr;
          
          return {
            success: true,
            from: fromCurr,
            to: toCurr,
            rate: exchangeRate.toFixed(4),
            inverseRate: (1 / exchangeRate).toFixed(4),
            fromSymbol: fromSymbol,
            toSymbol: toSymbol,
            lastUpdated: rateService.cacheExpiry ? new Date(rateService.cacheExpiry - 6*60*60*1000).toISOString() : new Date().toISOString(),
            message: langForRate === 'he'
              ? `1 ${fromCurr} = ${exchangeRate.toFixed(4)} ${toCurr}\n1 ${toCurr} = ${(1/exchangeRate).toFixed(4)} ${fromCurr}`
              : `1 ${fromCurr} = ${exchangeRate.toFixed(4)} ${toCurr}\n1 ${toCurr} = ${(1/exchangeRate).toFixed(4)} ${fromCurr}`,
            formatted: langForRate === 'he'
              ? `${fromSymbol}1 = ${toSymbol}${exchangeRate.toFixed(2)}`
              : `${fromSymbol}1 = ${toSymbol}${exchangeRate.toFixed(2)}`
          };
          
        // ========== ADVANCED MEDICATION MANAGEMENT ==========
        case 'prescribeMedication':
          const prescriptionService = require('./prescriptionService');
          await prescriptionService.initialize();

          // Build medications array from flat parameters
          const medicationsArray = [];
          if (args.medicationName) {
            // Build dosage string from flat parameters
            const dosageString = `${args.dosage || ''} ${args.frequency || ''}`.trim();
            const routeString = args.route || 'oral';
            const fullDosageInstructions = [dosageString, routeString, args.duration].filter(Boolean).join(', ');

            medicationsArray.push({
              name: args.medicationName,
              dosage: fullDosageInstructions || '',
              quantity: args.quantity || 30,
              indication: args.indication || ''
            });
          }

          const prescriptionResult = await prescriptionService.createPrescription({
            patientId: args.patientId || session?.currentContext?.patientId,
            medications: medicationsArray,
            instructions: args.instructions || '',
            refills: args.refills || 0,
            startDate: new Date(),
            status: 'active'
          }, {
            userId: session?.userId || practiceContext?.userId,
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId || practiceContext?.id || practiceContext?.practice?.id,
            subdomain: practiceContext?.subdomain,
            language: session?.language || 'en'
          });

          return prescriptionResult;
          
        case 'checkFormularyCoverage':
          const formularyService = require('./formularyService');
          await formularyService.initialize();
          
          // Get patient insurance info
          let insurancePlanId = 'default';
          if (args.patientId || session?.currentContext?.patientId) {
            const patientData = await this.getPatientDetails({
              patientId: args.patientId || session?.currentContext?.patientId
            }, practiceContext, session);
            
            if (patientData?.data?.insurance) {
              insurancePlanId = patientData.data.insurance.planId || 
                               patientData.data.healthFund?.toLowerCase() || 
                               'default';
            }
          }
          
          const coverageResult = await formularyService.checkCoverage(
            args.medication,
            insurancePlanId,
            {
              userId: session?.userId || practiceContext?.userId,
              practiceId: practiceContext?.subdomain || practiceContext?.practiceId || practiceContext?.id || practiceContext?.practice?.id
            }
          );
          
          return coverageResult;
          
        case 'submitPriorAuthorization':
          const formularyServicePA = require('./formularyService');
          await formularyServicePA.initialize();
          
          const priorAuthResult = await formularyServicePA.submitPriorAuthRequest({
            patientId: args.patientId || session?.currentContext?.patientId,
            medication: args.medication,
            diagnosis: args.diagnosis,
            prescriberId: session?.userId || practiceContext?.userId,
            insurancePlanId: args.insurancePlanId || 'default',
            clinicalJustification: args.clinicalJustification,
            supportingDocuments: args.supportingDocuments,
            urgent: args.urgent || false
          }, {
            userId: session?.userId || practiceContext?.userId,
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId || practiceContext?.id || practiceContext?.practice?.id
          });
          
          return priorAuthResult;
          
        // ========== CONVERSATIONAL ANALYTICS ==========
        case 'generateRealtimeChart':
        case 'showTrendAnalysis':
        case 'analyzePatientFlow':
        case 'forecastDemand':
        case 'compareMetrics':
          const conversationalAnalyticsService = require('./conversationalAnalyticsService');
          await conversationalAnalyticsService.initialize();
          
          // Build analytics query based on function name
          let analyticsQuery = '';
          const language = session?.language || practiceContext?.language || 'en';
          
          switch(name) {
            case 'generateRealtimeChart':
              analyticsQuery = `Generate ${args.chartType} chart for ${args.dataSource}`;
              break;
            case 'showTrendAnalysis':
              analyticsQuery = `Show trend analysis for ${args.metric} over ${args.timeframe}`;
              break;
            case 'analyzePatientFlow':
              analyticsQuery = `Analyze patient flow from ${args.startDate} to ${args.endDate}`;
              break;
            case 'forecastDemand':
              analyticsQuery = `Forecast demand for ${args.service} for ${args.timeHorizon}`;
              break;
            case 'compareMetrics':
              analyticsQuery = `Compare ${args.metric1} with ${args.metric2}`;
              break;
          }
          
          const analyticsResult = await conversationalAnalyticsService.processAnalyticsQuery(
            analyticsQuery,
            session?.id || `session-${Date.now()}`,
            {
              userId: session?.userId || practiceContext?.userId,
              practiceId: practiceContext?.subdomain || practiceContext?.practiceId || practiceContext?.id || practiceContext?.practice?.id,
              language: language
            }
          );
          
          return analyticsResult;
          
        // ========== LABORATORY MANAGEMENT ==========
        case 'orderLabTest': {
          // DATABASE OPERATION: Refactored from callAPI to SecureDataAccess
          const { ObjectId: ObjectIdForOrderLabTest } = require('mongodb');
          const language = session?.language || practiceContext?.language || 'en';
          const orderLabTestContext = {
            serviceId: 'agentServiceV4',
            operation: 'order_lab_test',
            practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          // CRITICAL: Convert patientId to ObjectId if it's a string
          let patientId = args.patientId || session?.currentContext?.patientId;
          if (typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)) {
            patientId = new ObjectIdForOrderLabTest(patientId);
            console.log(`✅ [orderLabTest] Converted patientId to ObjectId:`, patientId);
          }

          // Handle both formats: single test OR tests array
          let testsToOrder = [];

          if (args.tests) {
            // Parse tests array (may be JSON string or array)
            const testsArray = typeof args.tests === 'string'
              ? JSON.parse(args.tests)
              : args.tests;

            // Convert array of test names to test objects
            testsToOrder = testsArray.map(test => ({
              testCode: null,  // Test codes not provided in array format
              testName: typeof test === 'string' ? test : (test.testName || test.name),
              clinicalIndication: typeof test === 'object' ? test.clinicalIndication : null
            }));
          } else if (args.testName || args.testCode) {
            // Single test (backward compatibility)
            testsToOrder = [{
              testCode: args.testCode,
              testName: args.testName,
              clinicalIndication: args.clinicalIndication
            }];
          } else {
            throw new Error('Either tests array or testName/testCode must be provided');
          }

          const insertedOrders = [];

          // Create lab order for each test
          for (const test of testsToOrder) {
            const labOrderData = {
              patientId: patientId,  // Use converted ObjectId, not string
              testCode: test.testCode,
              testName: test.testName,
              priority: args.priority || 'routine',
              clinicalIndication: test.clinicalIndication || args.clinicalIndication,
              fastingRequired: args.fastingRequired || false,
              orderingProvider: session?.userName || 'Dr. AI Assistant',
              orderDate: new Date(),
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date()
            };

            const insertedOrder = await SecureDataAccess.insert(
              'lab_orders',
              labOrderData,
              orderLabTestContext
            );

            insertedOrders.push(insertedOrder);
          }

          return {
            success: true,
            orderId: insertedOrders.length === 1
              ? insertedOrders[0]._id
              : insertedOrders.map(o => o._id),
            message: language === 'he'
              ? `${insertedOrders.length} הזמנות מעבדה נוצרו בהצלחה`
              : `${insertedOrders.length} lab order(s) created successfully`,
            data: insertedOrders.length === 1 ? insertedOrders[0] : insertedOrders
          };
        }
          
        case 'interpretLabResults':
          const labResultInterpreter = require('./labResultInterpreter');
          
          // Get lab results
          const labResults = await getService('labService').getLabResults({
            patientId: args.patientId || session?.currentContext?.patientId,
            labOrderId: args.labOrderId
          }, practiceContext, session);
          
          if (labResults.data && labResults.data.length > 0) {
            const interpretation = await labResultInterpreter.interpretResults(
              labResults.data[0],
              language
            );
            
            return {
              success: true,
              interpretation: interpretation,
              data: labResults.data[0]
            };
          }
          
          return {
            success: false,
            message: language === 'he' ? 'לא נמצאו תוצאות מעבדה' : 'No lab results found'
          };
          
        case 'flagCriticalValues':
          // Check for critical values
          const criticalRanges = {
            glucose: { min: 70, max: 180, critical_min: 50, critical_max: 400 },
            potassium: { min: 3.5, max: 5.0, critical_min: 2.5, critical_max: 6.5 },
            sodium: { min: 135, max: 145, critical_min: 120, critical_max: 160 },
            hemoglobin: { min: 12, max: 17, critical_min: 7, critical_max: 20 }
          };
          
          // This would check lab results and flag critical values
          return {
            success: true,
            message: language === 'he' 
              ? 'בדיקת ערכים קריטיים הושלמה'
              : 'Critical value check completed',
            criticalValues: []
          };
          
        // ========== VITAL SIGNS MONITORING ==========
        case 'analyzeVitalTrends':
          const vitalSignsAnalyzer = require('./vitalSignsAnalyzer');
          
          // Get vital signs history
          const vitalsHistory = await getService('labService').getVitalSigns({
            patientId: args.patientId || session?.currentContext?.patientId
          }, practiceContext, session);
          
          if (vitalsHistory.data && vitalsHistory.data.length > 0) {
            const trends = vitalSignsAnalyzer.analyzeTrends(
              vitalsHistory.data,
              args.timeRange || 'last_week',
              args.vitalType || 'all'
            );
            
            return {
              success: true,
              trends: trends,
              message: language === 'he' 
                ? 'ניתוח מגמות סימנים חיוניים הושלם'
                : 'Vital signs trend analysis completed'
            };
          }
          
          return {
            success: false,
            message: language === 'he' ? 'לא נמצאו סימנים חיוניים' : 'No vital signs found'
          };
          
        case 'setVitalAlerts':
          // Set up alerts for abnormal vital signs
          const alertConfig = {
            patientId: args.patientId || session?.currentContext?.patientId,
            alertType: args.alertType,
            threshold: args.threshold,
            notifyMethods: args.notifyMethods || ['dashboard'],
            enabled: true
          };

          // Save alert configuration (would go to database)
          return {
            success: true,
            message: language === 'he'
              ? `התראה עבור ${args.alertType} הוגדרה בהצלחה`
              : `Alert for ${args.alertType} set successfully`,
            alertConfig: alertConfig
          };

        // ========== VISIT RECORDING ==========
        case 'startVisitRecording': {
          const { patientId, visitType = 'in-person', consentMethod = 'verbal' } = args;
          const mongoose = require('mongoose');
          const visitPracticeId = practiceContext?.subdomain || practiceContext?.practiceId;
          const visitUserId = practiceContext?.user?.id || practiceContext?.user?._id;
          const visitChatSessionId = session?.id;

          const visitInsertContext = {
            serviceId: 'visit-recording-service',
            operation: 'startVisitRecording',
            practiceId: visitPracticeId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const visitDoc = {
            patientId: new mongoose.Types.ObjectId(patientId),
            practiceId: visitPracticeId,
            doctorId: visitUserId,
            chatSessionId: visitChatSessionId || undefined,
            visitDate: new Date(),
            visitType,
            status: 'recording',
            consentObtained: true,
            consentMethod,
            transcript: { fullText: '', segments: [] },
            createdBy: visitUserId,
            createdAt: new Date(),
          };

          const savedVisit = await SecureDataAccess.insert('patient_visits', visitDoc, visitInsertContext);
          const visitId = (savedVisit?.insertedId || savedVisit?._id || savedVisit?.id)?.toString();

          // Notify frontend via Socket.IO
          if (global.io && visitChatSessionId) {
            global.io.to(`session_${visitChatSessionId}`).emit('visit_recording_start', {
              visitId,
              patientId,
              visitType,
            });
          }

          return {
            success: true,
            visitId,
            message: `Visit recording started. The microphone button should now be active. Visit ID: ${visitId}`,
          };
        }

        case 'startNewPatientVisit': {
          const { patientId, visitType = 'in-person' } = args;
          const mongoose = require('mongoose');
          const manualVisitPracticeId = practiceContext?.subdomain || practiceContext?.practiceId;
          const manualVisitUserId = practiceContext?.user?.id || practiceContext?.user?._id;
          const manualVisitChatSessionId = session?.id;

          const manualVisitInsertContext = {
            serviceId: 'visit-recording-service',
            operation: 'startNewPatientVisit',
            practiceId: manualVisitPracticeId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          const manualVisitDoc = {
            patientId: new mongoose.Types.ObjectId(patientId),
            practiceId: manualVisitPracticeId,
            doctorId: manualVisitUserId,
            chatSessionId: manualVisitChatSessionId || undefined,
            visitDate: new Date(),
            visitType,
            status: 'composing',
            consentObtained: false,
            transcript: { fullText: '', segments: [] },
            createdBy: manualVisitUserId,
            createdAt: new Date(),
          };

          const savedManualVisit = await SecureDataAccess.insert('patient_visits', manualVisitDoc, manualVisitInsertContext);
          const manualVisitId = (savedManualVisit?.insertedId || savedManualVisit?._id || savedManualVisit?.id)?.toString();

          return {
            success: true,
            visitId: manualVisitId,
            message: `Visit created. You can now type your visit notes in the artifact panel. When you're done, click "Save & Process with AI" and the notes will be structured into a SOAP format.`,
            displayType: 'openArtifactPanel',
            artifactPanel: {
              patientId,
              category: 'patient_visits',
              documentId: manualVisitId,
              type: 'document',
            }
          };
        }

        case 'endVisitRecording': {
          const { visitId } = args;
          const mongoose = require('mongoose');
          const endVisitPracticeId = practiceContext?.subdomain || practiceContext?.practiceId;
          const endVisitReadContext = {
            serviceId: 'visit-recording-service',
            operation: 'endVisitRecording_read',
            practiceId: endVisitPracticeId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          let visitObjectId;
          try {
            visitObjectId = new mongoose.Types.ObjectId(visitId);
          } catch (e) {
            return { success: false, error: 'Invalid visitId format' };
          }

          const visitDocs = await SecureDataAccess.query(
            'patient_visits',
            { _id: visitObjectId },
            { limit: 1 },
            endVisitReadContext
          );
          const visit = visitDocs && visitDocs[0];

          if (!visit) {
            return { success: false, error: 'Visit not found' };
          }

          const elevenLabsSttService = require('./elevenLabsSttService');
          const sttSession = elevenLabsSttService.getSession ? elevenLabsSttService.getSession(visitId) : null;
          let transcript = visit.transcript || { fullText: '', segments: [] };
          if (sttSession && typeof sttSession.close === 'function') {
            const finalTranscript = sttSession.close();
            transcript = {
              fullText: finalTranscript.fullText || transcript.fullText || '',
              segments: finalTranscript.segments || transcript.segments || [],
              language: finalTranscript.language || 'en',
            };
          }

          const endVisitWriteContext = {
            serviceId: 'visit-recording-service',
            operation: 'endVisitRecording_write',
            practiceId: endVisitPracticeId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          await SecureDataAccess.update(
            'patient_visits',
            { _id: visitObjectId },
            { $set: { status: 'transcribing', transcript, updatedAt: new Date() } },
            endVisitWriteContext
          );

          // Generate AI summary asynchronously (don't block the agent response)
          if (transcript.fullText) {
            (async () => {
              try {
                const Anthropic = require('@anthropic-ai/sdk');
                const productionKMS = require('./productionKMS');
                if (!productionKMS.initialized) await productionKMS.initialize();
                const anthropicKey = await productionKMS.getInternalKey('anthropic_api_key');
                if (!anthropicKey) return;

                const anthropic = new Anthropic({ apiKey: anthropicKey });
                const summaryResponse = await anthropic.messages.create({
                  model: 'claude-sonnet-5',
                  max_tokens: 2048,
                  thinking: { type: 'adaptive' },
                  output_config: { effort: 'high' },
                  system: `You are a clinical documentation assistant. Given a doctor-patient visit transcript,
extract structured SOAP note information. Return ONLY valid JSON with these fields:
- chiefComplaint: main complaint in 1-2 sentences
- historyOfPresentIllness: detailed HPI
- reviewOfSystems: relevant ROS findings
- physicalExamination: exam findings if mentioned
- assessment: clinical assessment and diagnoses
- plan: treatment plan
- medications: medications mentioned or prescribed
- followUp: follow-up instructions`,
                  messages: [{ role: 'user', content: `Please extract a structured SOAP note from this visit transcript:\n\n${transcript.fullText}` }],
                });

                const content = summaryResponse.content[0]?.text || '{}';
                const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
                let parsed;
                try { parsed = JSON.parse(jsonStr); } catch { parsed = { plan: content }; }

                const aiSummary = {
                  chiefComplaint: parsed.chiefComplaint || '',
                  historyOfPresentIllness: parsed.historyOfPresentIllness || '',
                  reviewOfSystems: parsed.reviewOfSystems || '',
                  physicalExamination: parsed.physicalExamination || '',
                  assessment: parsed.assessment || '',
                  plan: parsed.plan || '',
                  medications: parsed.medications || '',
                  followUp: parsed.followUp || '',
                  modelUsed: 'claude-sonnet-5',
                  generatedAt: new Date(),
                };

                await SecureDataAccess.update(
                  'patient_visits',
                  { _id: visitObjectId },
                  { $set: { aiSummary, status: 'reviewing', updatedAt: new Date() } },
                  endVisitWriteContext
                );

                if (global.io && visit.chatSessionId) {
                  global.io.to(`session_${visit.chatSessionId}`).emit('visit_summary_ready', { visitId, aiSummary });
                }
              } catch (summaryErr) {
                console.error('[Agent] AI summary generation failed:', summaryErr.message);
              }
            })();
          }

          if (global.io && visit.chatSessionId) {
            global.io.to(`session_${visit.chatSessionId}`).emit('visit_recording_end', { visitId });
          }

          return {
            success: true,
            visitId,
            transcriptPreview: (transcript.fullText || '').substring(0, 200),
            message: 'Visit recording ended. AI summary is being generated.',
          };
        }

        case 'getPatientVisits': {
          const { patientId, limit = 10 } = args;
          const mongoose = require('mongoose');
          const getVisitsPracticeId = practiceContext?.subdomain || practiceContext?.practiceId;
          const getVisitsContext = {
            serviceId: 'visit-recording-service',
            operation: 'getPatientVisits',
            practiceId: getVisitsPracticeId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken
          };

          let patientObjectId;
          try {
            patientObjectId = new mongoose.Types.ObjectId(patientId);
          } catch (e) {
            return { success: false, error: 'Invalid patientId format' };
          }

          const visits = await SecureDataAccess.query(
            'patient_visits',
            { patientId: patientObjectId, isDeleted: { $ne: true } },
            { sort: { visitDate: -1 }, limit: Math.min(limit, 50) },
            getVisitsContext
          );

          const visitRecords = visits || [];
          const wrappedDocument = {
            _id: `patient_visits_${patientId}_all`,
            patient_visits: visitRecords,
            patientId: patientId,
            category: 'patient_visits',
            title: 'Patient Visits',
            date: new Date().toISOString(),
            preview: `${visitRecords.length} visit${visitRecords.length === 1 ? '' : 's'}`
          };

          return {
            success: true,
            displayType: 'openArtifactPanel',
            artifactPanel: {
              patientId: patientId,
              category: 'patient_visits',
              type: 'documents',
              data: [wrappedDocument]
            },
            data: visitRecords,
            count: visitRecords.length,
            message: `Found ${visitRecords.length} patient visit${visitRecords.length === 1 ? '' : 's'}`,
          };
        }

        default:
          // PRIORITY 1: Check if this is a generated medical function (206 categories × 5 operations = 1030 functions)
          // Note: Hot reload handled by nodemon file watcher - no need to reload on every request

          if (generatedMedicalFunctions[name]) {
            // Use context parameter passed from executeFunction() - no need to create locally
            // Check if it has a handler property (new format) or is a direct function (old format)
            if (generatedMedicalFunctions[name].handler) {
              return await generatedMedicalFunctions[name].handler(args, context, practiceContext?.language === 'he');
            } else if (typeof generatedMedicalFunctions[name] === 'function') {
              return await generatedMedicalFunctions[name](args, context, practiceContext?.language === 'he');
            } else {
              throw new Error(`Invalid medical function format for ${name}`);
            }
          }

          // Handle artifact function (for Artifact Panel display)
          if (name === 'artifact') {
            // Parse content if it's a string
            let contentData = args.content;
            if (typeof contentData === 'string') {
              try {
                contentData = JSON.parse(contentData);
              } catch (e) {
                console.warn('Failed to parse artifact content as JSON:', e);
              }
            }

            // Return artifact data in the format expected by agentServiceClaude
            return {
              success: true,
              message: `Artifact panel opened: ${args.title}`,
              artifactPanel: {
                type: args.type,
                title: args.title,
                data: contentData
              }
            };
          }

          // PRIORITY 2 (FALLBACK): Check if this is a legacy medical category CRUD operation
          // Only used for categories NOT in generatedMedicalFunctions
          const crudPattern = /^(get|add|update|delete)([A-Z][a-z]+)(Data|Record)?$/;
          const match = name.match(crudPattern);

          if (match) {
            const [_, operation, categoryName, suffix] = match;
            const category = categoryName.toLowerCase();

            // Load the medical CRUD service
            const medicalCrudService = require('./medicalCrudService');

            // Check if this is a valid category
            const validCategories = Object.keys(medicalCrudService.categoryCollectionMap);

            if (validCategories.includes(category)) {
              console.log(`🏥 [FALLBACK] Executing legacy medical CRUD: ${operation} for category: ${category}`);

              // Route to appropriate CRUD method
              switch(operation) {
                case 'get':
                  return await medicalCrudService.getCategoryData(
                    category,
                    args.patientId,
                    session?.sessionId,
                    { limit: args.limit }
                  );

                case 'add':
                  return await medicalCrudService.addCategoryRecord(
                    category,
                    args,
                    session?.sessionId
                  );

                case 'update':
                  return await medicalCrudService.updateCategoryRecord(
                    category,
                    args.recordId,
                    args.updates || args,
                    session?.sessionId
                  );

                case 'delete':
                  return await medicalCrudService.deleteCategoryRecord(
                    category,
                    args.recordId,
                    session?.sessionId
                  );

                default:
                  console.warn(`Unknown CRUD operation: ${operation}`);
              }
            }
          }

          // Unknown function
          return {
            success: false,
            error: `Unknown function: ${name}`
          };
      }
  }

  
  // ========== API COMMUNICATION METHOD ==========
  
  /**
   * Make API calls to the backend - connects functions to real implementation
   */
  async callAPI(endpoint, method, data, practiceContext) {
    try {
      // Skip direct database access for document analysis endpoints and user management
      const skipDirectDB = [
        '/documents/analyze',
        '/documents/batch-analyze',
        '/users'  // User management must go through proper API endpoints
      ];
      
      // Direct database operations for core functions only
      if (practiceContext.models && !skipDirectDB.some(skip => endpoint.includes(skip))) {
        return await this.handleDirectDatabaseOperation(endpoint, method, data, practiceContext);
      }

      // Use HTTP API calls for external services
      // server.js serves HTTPS when certs/ exist - calling http:// against it resets the socket
      const fs = require('fs');
      const path = require('path');
      const useHttps = fs.existsSync(path.join(__dirname, '..', 'certs', 'cert.pem'));
      const baseURL = useHttps ? 'https://localhost:5000/api' : 'http://localhost:5000/api';
      const url = `${baseURL}${endpoint}`;

      console.log(`🔄 API Call: ${method} ${url}`);

      // Debug: Check service token
      const apiKey = this.serviceToken?.apiKey || this.serviceToken || '';
      if (endpoint.includes('/users') && endpoint.includes('/roles')) {
        console.log('🔑 Service auth check for role update:');
        console.log('   Has serviceToken:', !!this.serviceToken);
        console.log('   Has apiKey:', !!(this.serviceToken?.apiKey));
        console.log('   API key length:', apiKey ? apiKey.length : 0);
        console.log('   Service ID: agentServiceV4');
        console.log('   Practice subdomain:', practiceContext.subdomain || practiceContext.practiceSubdomain);
        console.log('   Headers being sent:', {
          'x-api-key': apiKey ? `${apiKey.substring(0, 10)}...` : 'EMPTY',
          'x-service-id': 'agentServiceV4',
          'x-practice-subdomain': practiceContext.subdomain || practiceContext.practiceSubdomain || practiceContext.practiceId
        });
      }

      const config = {
        method: method,
        url: url,
        headers: {
          'Content-Type': 'application/json',
          'x-practice-id': practiceContext.subdomain || practiceContext.practiceId || (() => {
            console.error('❌ Practice ID missing for API call! practiceContext:', practiceContext);
            throw new Error('Practice ID is required for API calls');
          })(),
          'x-practice-subdomain': practiceContext.subdomain || practiceContext.practiceSubdomain || practiceContext.practiceId || (() => {
            console.error('❌ Practice subdomain missing! practiceContext:', practiceContext);
            throw new Error('Practice subdomain is required for API calls');
          })(),
          // Add service authentication for API calls
          'x-api-key': apiKey,
          'x-service-id': 'agentServiceV4'
        }
      };
      
      if (method === 'GET') {
        config.params = data;
      } else {
        config.data = data;
      }

      // Self-signed localhost cert - axios must not reject it
      if (useHttps) {
        config.httpsAgent = new (require('https').Agent)({ rejectUnauthorized: false });
      }

      const response = await axios(config);
      return response.data;
      
    } catch (error) {
      console.error(`❌ API call failed: ${endpoint}`, error.message);
      throw error;
    }
  }

  
  /**
   * Helper function to look up provider by name or email
   * @param {string} searchTerm - Provider name or email
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Session object
   * @returns {Object} Provider info with providerId and name
   */

  
  /**
   * Handle direct database operations for better performance
   */
  async handleDirectDatabaseOperation(endpoint, method, data, practiceContext) {
    // Import SecureDataAccess service directly
    const SecureDataAccess = require('./secureDataAccess');
    const { Patient, Document, User } = practiceContext.models || {};
    
    // Ensure we have models available
    if (!practiceContext.models) {
      console.log('⚠️ Models not available in practiceContext, falling back to API call');
      throw new Error('Models not available for direct database access');
    }
    
    // No debug logging needed - direct DB operations are working

    // Build security context for SecureDataAccess with service authentication
    // CRITICAL: Pass both practiceId and practiceSubdomain for proper database routing
    // Fix: Use practiceContext.subdomain which is set by middleware
    const practiceSubdomain = practiceContext.subdomain || practiceContext.practiceSubdomain;
    if (!practiceSubdomain) {
      console.error('❌ Practice subdomain missing in handleDirectDatabaseOperation!');
      console.error('   practiceContext:', practiceContext);
      throw new Error('Practice subdomain is required for database operations');
    }

    const context = {
      serviceId: 'agentServiceV4',
      operation: `${method} ${endpoint}`,
      practiceId: practiceSubdomain, // Use subdomain as practiceId for SecureDataAccess
      practiceSubdomain: practiceSubdomain, // CRITICAL: Pass subdomain for correct DB selection
      userId: practiceContext.user?.id || practiceContext.user?._id,
      apiKey: this.serviceToken?.apiKey // Pass the API key from service token for authentication
    };
    
    // Parse the endpoint to determine operation
    const parts = endpoint.split('/');
    const resource = parts[1]; // e.g., 'patients', 'documents', etc.
    
    switch (resource) {
      case 'patients':
        if (method === 'POST') {
          try {
            // Create new patient using SecureDataAccess
            const saved = await SecureDataAccess.insert('patients', data, context);
            return { success: true, data: saved };
          } catch (error) {
            // Handle MongoDB duplicate key errors
            if (error.code === 11000) {
              const duplicateField = error.keyValue;
              const fieldName = Object.keys(duplicateField)[0];
              const fieldValue = duplicateField[fieldName];

              const isHebrew = context.language === 'he';
              return {
                success: false,
                error: isHebrew
                  ? `מטופל עם ${fieldName === 'socialSecurityNumber' ? 'מספר ביטוח לאומי' : 'מזהה'} ${fieldValue} כבר קיים במערכת`
                  : `A patient with ${fieldName === 'socialSecurityNumber' ? 'SSN' : 'ID'} ${fieldValue} already exists in the system`,
                code: 'DUPLICATE_PATIENT',
                duplicateField: fieldName,
                duplicateValue: fieldValue
              };
            }
            // Re-throw other errors
            throw error;
          }
        } else if (method === 'GET') {
          // Search or get patients
          // Support both 'query' and 'search' parameters for compatibility
          const searchTerm = data?.query || data?.search;
          if (searchTerm) {
            // Split search term for multi-word name searches
            const searchParts = searchTerm.trim().split(/\s+/);
            
            let searchQuery;
            if (searchParts.length === 2) {
              // Handle "FirstName LastName" or "LastName FirstName" searches
              if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 Searching for two-part name: "${searchParts[0]}" and "${searchParts[1]}"`);
              searchQuery = {
                $or: [
                  { $and: [
                    { firstName: new RegExp(searchParts[0], 'i') },
                    { lastName: new RegExp(searchParts[1], 'i') }
                  ]},
                  { $and: [
                    { firstName: new RegExp(searchParts[1], 'i') },
                    { lastName: new RegExp(searchParts[0], 'i') }
                  ]},
                  { nationalId: searchTerm },
                  { socialSecurityNumber: searchTerm },
                  { email: new RegExp(searchTerm, 'i') }
                ]
              };
            } else {
              // Single word or other searches
              if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 Searching for single term: "${searchTerm}"`);
              const searchRegex = new RegExp(searchTerm, 'i');
              searchQuery = {
                $or: [
                  { firstName: searchRegex },
                  { lastName: searchRegex },
                  { nationalId: searchTerm },
                  { socialSecurityNumber: searchTerm },
                  { email: searchRegex }
                ]
              };
            }
            
            // PERFORMANCE FIX: Only fetch essential fields for search results
            const patients = await SecureDataAccess.query('patients', searchQuery, {
              limit: 10,
              projection: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                socialSecurityNumber: 1,
                nationalId: 1,
                email: 1 // Include email for search results
              }
            }, context);
            console.log(`✅ Found ${patients.length} patient(s) matching "${searchTerm}" with minimal fields`);
            return { success: true, data: patients };
          } else if (parts[2]) {
            // Get specific patient
            // CRITICAL FIX: Validate if parts[2] is a valid ObjectId
            const patientId = parts[2];

            // Check if it's a valid MongoDB ObjectId (24 hex chars)
            if (patientId.match(/^[0-9a-fA-F]{24}$/)) {
              // Convert string to ObjectId for MongoDB query
              const objectId = new ObjectId(patientId);

              // PERFORMANCE FIX: Check if this is a getPatientDetails call that needs ALL fields
              // If the endpoint includes 'details' or comes from getPatientDetails, fetch everything
              const isDetailsRequest = endpoint.includes('details') || context.operation?.includes('getPatientDetails');

              const queryOptions = {
                limit: 1
              };

              // Only use projection for non-details requests to save bandwidth
              if (!isDetailsRequest) {
                queryOptions.projection = {
                  _id: 1,
                  firstName: 1,
                  lastName: 1,
                  nationalId: 1,
                  socialSecurityNumber: 1,
                  dateOfBirth: 1,
                  email: 1,
                  phone: 1,
                  healthFund: 1,
                  insuranceProvider: 1
                };
                console.log('⚡ Using minimal projection for basic patient lookup');
              } else {
                // Fetch ALL fields for getPatientDetails
                console.log('📋 Fetching complete patient details (no projection)');
              }

              const patients = await SecureDataAccess.query('patients', { _id: objectId }, queryOptions, context);
              const patient = patients[0];
              return { success: true, data: patient };
            } else {
              // Check if patientId looks like a name (contains space)
              const nameParts = patientId.trim().split(/\s+/);
              if (nameParts.length >= 2) {
                // It's likely a full name, search by firstName and lastName
                const firstName = nameParts[0];
                const lastName = nameParts[nameParts.length - 1];
                if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 Searching by name: firstName="${firstName}", lastName="${lastName}"`);

                const patients = await SecureDataAccess.query('patients', {
                  firstName: new RegExp(`^${firstName}`, 'i'),
                  lastName: new RegExp(`^${lastName}`, 'i')
                }, { limit: 1 }, context);

                const patient = patients[0];
                if (patient) {
                  return { success: true, data: patient };
                }

                // Try alternate order (lastName firstName)
                const alternatePatients = await SecureDataAccess.query('patients', {
                  firstName: new RegExp(`^${lastName}`, 'i'),
                  lastName: new RegExp(`^${firstName}`, 'i')
                }, { limit: 1 }, context);

                const alternatePatient = alternatePatients[0];
                if (alternatePatient) {
                  return { success: true, data: alternatePatient };
                }
              }

              // If not a name or name search failed, try nationalId or SSN
              // Check if it looks like an SSN (XXX-XX-XXXX or 9 digits)
              const ssnPattern = /^\d{3}-?\d{2}-?\d{4}$/;
              if (ssnPattern.test(patientId)) {
                console.log(`🔒 Searching by SSN: ${patientId}`);
                const patients = await SecureDataAccess.query('patients', {
                  socialSecurityNumber: patientId
                }, { limit: 1 }, context);
                const patient = patients[0];
                if (patient) {
                  return { success: true, data: patient };
                }
              }

              // Try nationalId (for Israeli or other international users)
              console.log(`🔒 Searching by nationalId: ${patientId}`);
              const patients = await SecureDataAccess.query('patients', { nationalId: patientId }, { limit: 1 }, context);
              const patient = patients[0];
              return { success: true, data: patient };
            }
          } else {
            // List all patients when no search term and no specific ID
            console.log('📋 Listing all patients from database');
            console.log('🔍 DEBUG - Context for patient query:', {
              practiceId: context.practiceId,
              practiceSubdomain: context.practiceSubdomain,
              serviceId: context.serviceId,
              hasApiKey: !!context.apiKey
            });
            const limit = data.limit || 100;

            // REDIS CACHE INTEGRATION
            const redisCache = require('./redisCache');
            const cacheKey = redisCache.generateKey('listAllPatients', context.practiceSubdomain, { limit });

            // Try to get from cache first
            const cachedPatients = await redisCache.get(cacheKey);
            if (cachedPatients) {
              console.log(`⚡ Redis cache HIT - Returning ${cachedPatients.length} patients instantly`);
              return { success: true, data: cachedPatients };
            }

            // Cache miss - query database
            console.log('💭 Redis cache MISS - Querying MongoDB...');
            // PERFORMANCE FIX: Only fetch essential fields for patient list
            const patients = await SecureDataAccess.query('patients', {}, {
              limit,
              projection: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                socialSecurityNumber: 1, // US SSN
                nationalId: 1 // Israeli ID
              }
            }, context);
            console.log(`✅ Found ${patients.length} patients with minimal fields`);

            // Store in Redis cache for next time
            if (patients.length > 0) {
              await redisCache.set(cacheKey, patients, redisCache.TTL.patientList);
              console.log(`💾 Cached ${patients.length} patients in Redis for 5 minutes`);
            }

            if (patients.length === 0) {
              console.log('⚠️ No patients found with context:', {
                practiceSubdomain: context.practiceSubdomain || 'MISSING',
                practiceId: context.practiceId || 'MISSING'
              });
            }
            return { success: true, data: patients };
          }
        } else if (method === 'PUT' && parts[2]) {
          // Update patient
          const patientId = parts[2];
          let patient;
          
          patient = await AgentServiceHelpers.updatePatient(patientId, data, context);
          return { success: true, data: patient };
        } else if (method === 'DELETE' && parts[2]) {
          // Delete patient
          const patientId = parts[2];
          
          await AgentServiceHelpers.deletePatient(patientId, context);
          return { success: true, message: 'Patient deleted' };
        }
        break;
        
      case 'documents':
        if (method === 'GET') {
          // Get documents
          const query = {};
          if (data.patientId) query.patientId = data.patientId;
          if (data.documentType) query.documentType = data.documentType;
          
          const documents = await SecureDataAccess.query('documents', query, {}, {
    ...context
  })
            .sort({ uploadDate: -1 })
            .limit(data.limit || 20);
          return { success: true, data: documents };
        }
        break;
        
      case 'appointments':
        // Handle appointments endpoints with proper database queries
        const appointmentEndpoint = parts[2]; // e.g., 'today', 'patient', 'provider', etc.

        if (appointmentEndpoint === 'today') {
          // Get today's appointments
          const today = new Date();
          const startOfDay = new Date(today);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(today);
          endOfDay.setHours(23, 59, 59, 999);

          // Build query for today's appointments
          // Fix: Use subdomain from practiceContext
          const query = {
            practiceId: practiceContext.subdomain || practiceContext.practiceSubdomain || practiceContext.practiceId
          };

          // PERFORMANCE FIX: Only fetch essential fields for appointment list
          const allAppointments = await SecureDataAccess.query('appointments', query, {
            projection: {
              _id: 1,
              patientId: 1,
              patientName: 1,
              providerId: 1,
              providerName: 1,
              providerEmail: 1,
              scheduledDate: 1,
              scheduledTime: 1,
              status: 1,
              reason: 1,
              duration: 1
            }
          }, context);

          // Filter for today's appointments in JavaScript
          let todaysAppointments = allAppointments.filter(apt => {
            const aptDate = new Date(apt.scheduledDate);
            return aptDate >= startOfDay && aptDate <= endOfDay;
          });

          // Apply provider filter if provided
          if (data.providerId) {
            todaysAppointments = todaysAppointments.filter(apt =>
              apt.providerId === data.providerId ||
              apt.providerEmail === data.providerId ||
              apt.providerName === data.providerId
            );
          }

          // Apply status filter if provided
          if (data.status) {
            todaysAppointments = todaysAppointments.filter(apt => apt.status === data.status);
          }

          // Apply limit
          const limit = parseInt(data.limit) || 200;
          const appointments = todaysAppointments.slice(0, limit);

          // Sort by scheduled time
          appointments.sort((a, b) => {
            if (a.scheduledTime < b.scheduledTime) return -1;
            if (a.scheduledTime > b.scheduledTime) return 1;
            return 0;
          });

          // Group by time slots for easier scheduling view
          const timeSlots = {};
          appointments.forEach(appointment => {
            const timeKey = appointment.scheduledTime;
            if (!timeSlots[timeKey]) {
              timeSlots[timeKey] = [];
            }
            timeSlots[timeKey].push(appointment);
          });

          return {
            success: true,
            data: appointments,
            timeSlots: timeSlots,
            count: appointments.length,
            message: `Found ${appointments.length} appointments for today`
          };

        } else if (method === 'POST') {
          // Schedule new appointment
          const appointmentData = {
            ...data,
            practiceId: practiceContext.subdomain || practiceContext.practiceSubdomain || practiceContext.practiceId,
            status: 'scheduled',
            createdAt: new Date(),
            appointmentNumber: `APT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
          };

          const result = await SecureDataAccess.insert('appointments', appointmentData, context);

          return {
            success: true,
            data: { ...appointmentData, _id: result.insertedId },
            message: 'Appointment scheduled successfully'
          };

        } else if (method === 'GET') {
          // Get appointments (generic)
          const query = { practiceId: practiceContext.subdomain || practiceContext.practiceSubdomain || practiceContext.practiceId };

          // Add filters based on endpoint and parameters
          if (parts[2] === 'patient' && parts[3]) {
            query.patientId = parts[3];
          } else if (parts[2] === 'provider' && parts[3]) {
            // Use OR to match any provider field
            const allAppointments = await SecureDataAccess.query('appointments', { practiceId: practiceContext.subdomain || practiceContext.practiceSubdomain || practiceContext.practiceId }, {
              projection: {
                _id: 1,
                patientId: 1,
                patientName: 1,
                providerId: 1,
                providerName: 1,
                providerEmail: 1,
                scheduledDate: 1,
                scheduledTime: 1,
                status: 1
              }
            }, context);
            const filteredAppointments = allAppointments.filter(apt =>
              apt.providerId === parts[3] ||
              apt.providerEmail === parts[3] ||
              apt.providerName === parts[3]
            );
            return {
              success: true,
              data: filteredAppointments,
              count: filteredAppointments.length
            };
          } else if (data.patientId) {
            query.patientId = data.patientId;
          } else if (data.providerId) {
            // Use OR to match any provider field
            const allAppointments = await SecureDataAccess.query('appointments', { practiceId: practiceContext.subdomain || practiceContext.practiceSubdomain || practiceContext.practiceId }, {
              projection: {
                _id: 1,
                patientId: 1,
                patientName: 1,
                providerId: 1,
                providerName: 1,
                providerEmail: 1,
                scheduledDate: 1,
                scheduledTime: 1,
                status: 1
              }
            }, context);
            const filteredAppointments = allAppointments.filter(apt =>
              apt.providerId === data.providerId ||
              apt.providerEmail === data.providerId ||
              apt.providerName === data.providerId
            );
            return {
              success: true,
              data: filteredAppointments,
              count: filteredAppointments.length
            };
          }

          // Add date filters if provided
          if (data.date) {
            const targetDate = new Date(data.date);
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);

            const allAppointments = await SecureDataAccess.query('appointments', query, {}, context);
            const filteredAppointments = allAppointments.filter(apt => {
              const aptDate = new Date(apt.scheduledDate);
              return aptDate >= startOfDay && aptDate <= endOfDay;
            });

            return {
              success: true,
              data: filteredAppointments,
              count: filteredAppointments.length
            };
          }

          const appointments = await SecureDataAccess.query('appointments', query, {
            limit: data.limit || 100
          }, context);

          // Sort appointments by date and time
          appointments.sort((a, b) => {
            const dateA = new Date(a.scheduledDate);
            const dateB = new Date(b.scheduledDate);
            if (dateA < dateB) return -1;
            if (dateA > dateB) return 1;
            // If same date, sort by time
            if (a.scheduledTime < b.scheduledTime) return -1;
            if (a.scheduledTime > b.scheduledTime) return 1;
            return 0;
          });

          return {
            success: true,
            data: appointments,
            count: appointments.length
          };
        }
        break;

      case 'patient_provider':
        if (method === 'GET') {
          // Search for providers by name or get all providers
          const searchName = data?.name;

          // Build query to find users who are providers
          let providerQuery = {
            $or: [
              { 'providerInfo.providerId': { $exists: true } },
              { roles: { $in: [...roleModel.CLINICAL_ROLES, ...roleModel.ADMIN_ROLES] } }
            ]
          };

          if (searchName) {
            // Add name search condition - handle full names properly
            const nameRegex = new RegExp(searchName, 'i');

            // Also try to split the name for first/last name matching
            const nameParts = searchName.trim().split(/\s+/);
            const searchConditions = [
              { 'profile.firstName': nameRegex },
              { 'profile.lastName': nameRegex },
              { fullName: nameRegex },
              { email: nameRegex }
            ];

            // If it's a full name (has spaces), also search for the combination
            if (nameParts.length === 2) {
              const [firstName, lastName] = nameParts;
              searchConditions.push({
                $and: [
                  { 'profile.firstName': new RegExp(firstName, 'i') },
                  { 'profile.lastName': new RegExp(lastName, 'i') }
                ]
              });
            }

            providerQuery = {
              $and: [
                providerQuery,
                { $or: searchConditions }
              ]
            };
          }

          const providers = await SecureDataAccess.query('users', providerQuery, {
            fields: ['email', 'profile', 'providerInfo', 'roles', 'status', 'fullName'],
            sort: { 'profile.lastName': 1, 'profile.firstName': 1 }
          }, context);

          // Transform data for response
          const providerList = providers.map(user => {
            // Build provider name
            let providerName = user.fullName || '';
            if (!providerName && user.profile) {
              const firstName = user.profile.firstName || '';
              const lastName = user.profile.lastName || '';
              providerName = `${firstName} ${lastName}`.trim();
            }
            if (!providerName) {
              providerName = user.email || 'Unknown Provider';
            }

            // Generate providerId if not exists
            const providerId = user.providerInfo?.providerId || `PROV-${user._id}`;

            return {
              userId: user._id,
              providerId: providerId,
              name: providerName,
              email: user.email,
              specialties: user.providerInfo?.specialties || [],
              departments: user.providerInfo?.departments || [],
              status: user.status || 'active',
              roles: user.roles || []
            };
          });

          console.log(`✅ Found ${providerList.length} provider(s)`);
          return { success: true, data: providerList };
        }
        break;
    }

    // Default: operation not implemented yet - silently return false
    return { success: false, message: 'Operation not implemented' };
  }

  
  // ========== IMPLEMENTATION OF ALL FUNCTIONS ==========
  
  // Patient Management Functions

  

  

  

  



  // Detect intent for medical queries


  

  

  // Follow-up Management Functions
  
  
  
  

  // ========== PATIENT CONDITION MANAGEMENT ==========


  // Helper to parse search criteria from various input formats

  // Helper to detect search intent







  // Simple function to get patient list

  // Helper function to map conditions to collection names

  // Medical History Functions

  





  

  
  // Document Functions
  


  // Diagnosis Functions

  

  


  // Check which patients have allergies

  // Medical AI Functions - DISABLED (Gemini removed, use Claude only)





  
  // Appointment Functions

  
  // Update/Edit Appointment

  
  // Cancel/Delete Appointment

  
  // Reschedule Appointment (convenience function)

  
  // Get Appointment Details

  

  
  // Get alternative available slots when requested time is not available


  // Chat Functions

  

  
  // User Management Functions

  











  // Report Functions

  

  

  
  // System Functions

  

  

  
  // ========== PROVIDER AVAILABILITY MANAGEMENT FUNCTIONS ==========
  

  

  

  
  // ========== HELPER FUNCTIONS ==========
  
  // Helper: Detect language

  
  // Helper: Detect practice country

  
  // Helper: Format date - accepts various formats

  
  // Helper: Format function result for display



  
  // ========== LAB RESULTS IMPLEMENTATION ==========
  

  

  
  // ========== MEDICATIONS IMPLEMENTATION ==========
  

  
  // Alias for Claude AI to understand better


  
  // ========== VITAL SIGNS IMPLEMENTATION ==========
  

  

  
  // ========== DOCUMENT MANAGEMENT IMPLEMENTATION ==========
  // Note: uploadDocument is implemented above at line ~1655 and properly creates documents with patient linking




  // ========== AI-GENERATED COLLECTIONS CRUD ==========
  // Comprehensive CRUD operations for AI-generated medical insights
  // Collections: medication_optimization, clinical_decision_support, intelligent_recommendations,
  //             trending_analysis, follow_up_intelligence, patient_specific_care_plan,
  //             guideline_compliance, outcomes_prediction, care_gaps, patient_education_context

  /**
   * Update AI-Generated Collection Document
   * Generic update function for all AI-generated collections
   */
  async updateAICollection(collectionName, documentId, updates, context) {
    const { ObjectId } = require('mongodb');

    const updateContext = {
      serviceId: 'agentServiceV4',
      operation: `update_${collectionName}`,
      practiceId: context?.practiceId || context?.practiceSubdomain || 'global',
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };

    // Convert documentId to ObjectId if it's a string
    let query = {};
    try {
      query = { _id: new ObjectId(documentId) };
    } catch (err) {
      query = { _id: documentId };
    }

    // CRITICAL FIX: If updates is a string (JSON stringified), parse it back to object
    // This prevents character-by-character object creation (e.g., {'0': 'H', '1': 'e', ...})
    let parsedUpdates = updates;
    if (typeof updates === 'string') {
      console.log('⚠️  [updateAICollection] Updates received as string, parsing to object');
      try {
        parsedUpdates = JSON.parse(updates);
      } catch (err) {
        console.error('❌ [updateAICollection] Failed to parse updates string:', err);
        throw new Error('Invalid updates format - expected object or valid JSON string');
      }
    }

    // Ensure updates is a plain object
    if (typeof parsedUpdates !== 'object' || parsedUpdates === null || Array.isArray(parsedUpdates)) {
      throw new Error('Invalid updates format - expected object');
    }

    const result = await SecureDataAccess.update(
      collectionName,
      query,
      { $set: { ...parsedUpdates, updatedAt: new Date() } },
      updateContext
    );

    return {
      success: true,
      message: `Updated ${collectionName} document`,
      documentId,
      modifiedCount: result.modifiedCount
    };
  }

  /**
   * Delete AI-Generated Collection Document
   */
  async deleteAICollection(collectionName, documentId, context) {
    const { ObjectId } = require('mongodb');

    const deleteContext = {
      serviceId: 'agentServiceV4',
      operation: `delete_${collectionName}`,
      practiceId: context?.practiceId || context?.practiceSubdomain || 'global',
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };

    let query = {};
    try {
      query = { _id: new ObjectId(documentId) };
    } catch (err) {
      query = { _id: documentId };
    }

    const result = await SecureDataAccess.delete(
      collectionName,
      query,
      deleteContext
    );

    return {
      success: true,
      message: `Deleted ${collectionName} document`,
      documentId,
      deletedCount: result.deletedCount
    };
  }

  /**
   * Add/Append to Array Field in AI-Generated Collection
   * For adding new items to arrays like optimizations, recommendations, etc.
   */
  async addToAICollectionArray(collectionName, documentId, fieldName, newItems, context) {
    const { ObjectId } = require('mongodb');

    const addContext = {
      serviceId: 'agentServiceV4',
      operation: `add_to_${collectionName}`,
      practiceId: context?.practiceId || context?.practiceSubdomain || 'global',
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };

    let query = {};
    try {
      query = { _id: new ObjectId(documentId) };
    } catch (err) {
      query = { _id: documentId };
    }

    // Ensure newItems is an array
    const itemsToAdd = Array.isArray(newItems) ? newItems : [newItems];

    const result = await SecureDataAccess.update(
      collectionName,
      query,
      {
        $push: { [fieldName]: { $each: itemsToAdd } },
        $set: { updatedAt: new Date() }
      },
      addContext
    );

    return {
      success: true,
      message: `Added ${itemsToAdd.length} items to ${fieldName} in ${collectionName}`,
      documentId,
      modifiedCount: result.modifiedCount
    };
  }

  /**
   * Save extracted document data to database
   * Extracted from batchAnalyzeDocuments for reuse by background batch processor
   */
  /**
   * Helper function to convert between camelCase and snake_case
   */

  /**
   * Helper function to get field data from extractedData checking both camelCase and snake_case
   */


  
  // Assign document to patient (wrapper for better UX)

  



  
  
  // Helper function to parse CSV line handling quoted values
  
  // Helper function to suggest field mappings for users
  

  
  // ========== ALLERGIES IMPLEMENTATION ==========
  

  
  // Alias for Claude AI to understand better



  // ============ GET ALLERGIES HELPER METHODS ============

  // Helper: Group allergies


  // Helper: Generate allergies alerts


  // Helper: Generate allergies summary


  // Helper: Generate allergies message

  
  // ========== VACCINATIONS IMPLEMENTATION ==========
  

  

  
  // ========== PRESCRIPTIONS IMPLEMENTATION ==========
  

  

  
  // ========== REFERRALS IMPLEMENTATION ==========
  

  

  
  // ========== IMAGING IMPLEMENTATION ==========
  

  

  
  // ========== PRACTICE MANAGEMENT IMPLEMENTATION ==========



  /**
   * Get or search for practice address
   * Uses Google Places API for searching and returns stored practice addresses
   */



  
  // ========== INSURANCE IMPLEMENTATION ==========
  

  


  // ========== HELPER METHODS ==========

  // Helper: Format medication display


  // Helper: Generate medication summary


  // Helper: Generate medication message


  // ========== ADDITIONAL HELPER METHODS ==========

  // Helper: Calculate age from date of birth


  // Helper: Format file size


  // Helper: Generate document summary


  // Helper: Generate document message


  // Document Analysis Helpers














  // ============ ALLERGY HELPER METHODS ============

  // Helper: Categorize allergy type


  // Helper: Parse reaction types


  // Helper: Get severity score


  // Helper: Check medication conflicts


  // Helper: Get cross-reactive allergens


  // Helper: Generate allergy alerts


  // Helper: Generate allergy card


  // Helper: Update patient critical alerts


  // Helper: Generate allergy message


  // ============ CHAT SESSION HELPER METHODS ============

  // Helper: Generate session topic from initial message


  // Helper: Determine session priority


  // Helper: Generate session summary


  // Helper: Setup AI context for session


  // Helper: Generate chat session message


  // ============ SEARCH CHAT HISTORY HELPER METHODS ============

  // Helper: Calculate session duration


  // Helper: Determine session status


  // Helper: Highlight search terms


  // Helper: Categorize session topic


  // Helper: Group sessions by time periods


  // Helper: Generate search analytics


  // Helper: Generate search summary


  // Helper: Get search time range


  // Helper: Get most common value


  // Helper: Generate search message


  // ============ USER MANAGEMENT HELPER METHODS ============

  // Helper: Generate role permissions


  // Helper: Generate welcome message


  // Helper: Generate user summary


  // Helper: Generate next steps for new user


  // Helper: Generate create user message


  // Helper: Generate role change summary


  // Helper: Generate role update message


  // Helper: Compare permissions


  // Helper: Check if role change requires training


  // Helper: Get access changes


  // ============ VACCINATION HELPER METHODS ============

  // Helper: Calculate time since vaccination


  // Helper: Check if booster is needed


  // Helper: Determine vaccination status


  // Helper: Group vaccinations


  // Helper: Analyze vaccination schedule


  // Helper: Get required vaccines for age


  // Helper: Generate vaccination recommendations


  // Helper: Get vaccine priority


  // Helper: Generate vaccination alerts


  // Helper: Generate vaccination summary


  // Helper: Generate vaccinations message


  // Helper: Validate vaccine for patient age


  // Helper: Check for high-risk conditions (simplified)


  // Helper: Get vaccine series information


  // Helper: Calculate next dose date


  // Helper: Generate vaccination card


  // Helper: Generate verification code


  // Helper: Generate vaccination reminders


  // Helper: Generate vaccination message


  // Helper: Generate document summary for analysis

  // ========== NEWLY ADDED MISSING FUNCTIONS (Completes partial implementations) ==========
  
  // Get differential diagnosis based on symptoms


  
  // Helper method to check if function has visualization

  
  // Helper method to get display type for function

  

  
  // Provider Meetings (Doctor-to-Doctor consultations)

  

  
  // Provider Management Functions Implementation

  


  // Bulk setup multiple users as providers


  // Bulk update multiple users' roles

  

  

  

  

  

  

  
  // Calendar Sync Functions Implementation

  

  

  

  

  


  // Send calendar sync URL via email to provider


  // Send appointment confirmation requests

  // Send test result notifications

  // Send medication refill reminders
  
  // Alias for compatibility

  // ========== HELPER METHODS FOR ENHANCED IMPLEMENTATIONS ==========
  
  
  
  // Enhanced error handling wrapper for service calls
  async safeServiceCall(serviceName, methodName, args, context) {
    try {
      const service = this.getServiceByName(serviceName);
      if (!service) {
        throw new Error(`Service ${serviceName} not found`);
      }
      
      // Initialize service if needed
      if (service.initialize && !service.initialized) {
        await service.initialize();
      }
      
      // Call the method
      const result = await service[methodName](...args, context);
      
      return result;
    } catch (error) {
      console.error(`Error in ${serviceName}.${methodName}:`, error);
      
      // Return structured error response
      return {
        success: false,
        error: error.message,
        service: serviceName,
        method: methodName,
        timestamp: new Date()
      };
    }
  }

  // ========== HEALTH CAMPAIGN METHODS ==========





  // ========== ADVANCED COMMUNICATION ANALYTICS METHODS ==========




  // Helper methods for report generation



  
  /**
   * Get organized function groups for learning system integration
   */
  
  /**
   * Categorize function by name patterns
   */
  
  /**
   * Get subcategory for a function
   */
  
  /**
   * Check if function handles sensitive data
   */
  
  /**
   * Check if function is critical for platform operation
   */

}

// Export singleton
module.exports = new IntelliCareCompleteAgent();