// IntelliCare Agent Service V4 - Guided Experience Extension
// This module adds progressive disclosure and intelligent guidance to the existing agent
// Migrated to DDD NX architecture - AI Analytics Context - Claude Feature

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class GuidedAgentService {
  constructor() {
    this.serviceId = 'agent-service-v4-guided';
    this.serviceToken = null;
    this.initialized = false;
    this.userSessions = new Map();
    this.functionCategories = this.initializeFunctionCategories();
    this.workflows = this.initializeWorkflows();
    this.contextualSuggestions = this.initializeContextualSuggestions();
    this.serviceCache = {};
  }

  getService(name) {
    if (!this.serviceCache[name]) {
      const proxy = getServiceProxy();
      this.serviceCache[name] = proxy.getService(name);
    }
    return this.serviceCache[name];
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const serviceAccountManager = this.getService('serviceAccountManager');
      
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      this.initialized = true;
      console.log('✅ GuidedAgentService initialized with authentication');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize GuidedAgentService:', error);
      throw error;
    }
  }

  // ============= FUNCTION CATEGORIZATION =============
  initializeFunctionCategories() {
    return {
      // Level 1: Day 1 Essentials (11 functions)
      essentials: {
        name: 'Essential Functions',
        description: 'Core functions for daily use',
        icon: '📋',
        functions: [
          'addPatient',
          'searchPatients', 
          'getPatientDetails',
          'addQuickNote',
          'getTodayAppointments',
          'sendPatientMessage',
          'viewMessages',
          'sendQuickReminder',
          'getTodaySchedule',
          'getPendingTasks',
          'getQuickStats'
        ]
      },

      // Level 2: Common Clinical Tasks (33 functions)
      clinical: {
        name: 'Clinical Management',
        description: 'Medical records and clinical tools',
        icon: '🏥',
        functions: [
          'addMedicalHistory',
          'getMedicalHistory',
          'updateMedicalHistory',
          'createPrescription',
          'getPrescriptions',
          'refillPrescription',
          'addLabResult',
          'getLabResults',
          'interpretLabResults',
          'addVitalSigns',
          'getVitalSigns',
          'analyzeVitalSigns',
          'addDiagnosis',
          'getDiagnoses',
          'generateDiagnosis',
          'addTreatmentPlan',
          'getTreatmentPlans',
          'recommendTreatment',
          'createReferral',
          'getReferrals',
          'updateReferralStatus',
          'addAllergy',
          'getAllergies',
          'checkDrugAllergy',
          'addVaccination',
          'getVaccinations',
          'generateVaccinationSchedule',
          'addProgressNote',
          'getProgressNotes',
          'generateSOAPNote',
          'checkDrugInteractions',
          'calculateMedicationDosing',
          'lookupClinicalGuidelines'
        ]
      },

      // Level 3: Document Management (12 functions)
      documents: {
        name: 'Documents & Records',
        description: 'Document management and analysis',
        icon: '📄',
        functions: [
          'uploadDocument',
          'getDocuments',
          'analyzeDocument',
          'deleteDocument',
          'searchDocuments',
          'generatePatientReport',
          'exportMedicalRecords',
          'createDocumentTemplate',
          'getConsentForms',
          'uploadConsentForm',
          'getInsuranceForms',
          'submitInsuranceForm'
        ]
      },

      // Level 4: Scheduling & Appointments (15 functions)
      scheduling: {
        name: 'Scheduling',
        description: 'Appointment and calendar management',
        icon: '🗓️',
        functions: [
          'createAppointment',
          'getAppointments',
          'updateAppointment',
          'cancelAppointment',
          'rescheduleAppointment',
          'findAvailableSlots',
          'getProviderSchedule',
          'setRecurringAppointment',
          'manageWaitlist',
          'sendAppointmentReminder',
          'syncCalendar',
          'blockTimeSlot',
          'getOverdueAppointments',
          'getUpcomingAppointments',
          'checkDoubleBooking'
        ]
      },

      // Level 5: AI & Analytics (45 functions)
      aiAssistance: {
        name: 'AI Assistant',
        description: 'AI-powered medical tools',
        icon: '🤖',
        functions: [
          'analyzeSymptoms',
          'generateDiagnosis',
          'recommendTreatment',
          'checkDrugInteractions',
          'searchMedicalLiterature',
          'getClinicalGuidelines',
          'predictPatientRisk',
          'analyzePatientTrends',
          'generateClinicalInsights',
          'suggestDifferentialDiagnosis',
          'reviewTreatmentPlan',
          'optimizeMedicationRegimen',
          'assessSymptomSeverity',
          'detectEmergencyProtocol',
          'generatePatientEducation'
          // ... 30 more AI functions
        ]
      },

      // Level 6: Administration (50+ functions)
      administration: {
        name: 'Administration',
        description: 'Practice and user management',
        icon: '⚙️',
        functions: [
          'createUser',
          'updateUserRole',
          'getClinicSettings',
          'updateClinicSettings',
          'manageBilling',
          'getFinancialReports',
          'manageInsurance',
          'auditCompliance'
          // ... 40+ more admin functions
        ]
      },

      // Level 7: Integrations (100+ functions)
      integrations: {
        name: 'External Integrations',
        description: 'Third-party services and APIs',
        icon: '🌐',
        functions: [
          'searchProviders',
          'verifyInsurance',
          'submitClaim',
          'checkFormulary',
          'orderLabTests',
          'retrieveExternalRecords'
          // ... 90+ more integration functions
        ]
      }
    };
  }

  // ============= WORKFLOW TEMPLATES =============
  initializeWorkflows() {
    return {
      newPatientIntake: {
        name: 'New Patient Intake',
        icon: '👤',
        steps: [
          { id: 'basic_info', name: 'Basic Information', function: 'addPatient', required: true },
          { id: 'insurance', name: 'Insurance Details', function: 'verifyInsurance', required: true },
          { id: 'medical_history', name: 'Medical History', function: 'addMedicalHistory', required: false },
          { id: 'allergies', name: 'Allergies', function: 'addAllergy', required: true },
          { id: 'medications', name: 'Current Medications', function: 'addMedication', required: false },
          { id: 'schedule', name: 'Schedule First Visit', function: 'createAppointment', required: false }
        ]
      },

      patientVisit: {
        name: 'Patient Visit',
        icon: '🏥',
        steps: [
          { id: 'checkin', name: 'Check In', function: 'checkInPatient', required: true },
          { id: 'vitals', name: 'Record Vitals', function: 'addVitalSigns', required: true },
          { id: 'chief_complaint', name: 'Chief Complaint', function: 'addChiefComplaint', required: true },
          { id: 'examination', name: 'Examination', function: 'addExaminationNotes', required: true },
          { id: 'diagnosis', name: 'Diagnosis', function: 'addDiagnosis', required: true },
          { id: 'treatment', name: 'Treatment Plan', function: 'addTreatmentPlan', required: true },
          { id: 'prescriptions', name: 'Prescriptions', function: 'createPrescription', required: false },
          { id: 'followup', name: 'Schedule Follow-up', function: 'createAppointment', required: false },
          { id: 'summary', name: 'Visit Summary', function: 'generateVisitSummary', required: true }
        ]
      },

      dailyRoutine: {
        name: 'Daily Routine',
        icon: '📅',
        steps: [
          { id: 'schedule', name: 'Review Schedule', function: 'getTodaySchedule', required: true },
          { id: 'pending', name: 'Pending Tasks', function: 'getPendingTasks', required: true },
          { id: 'messages', name: 'Check Messages', function: 'viewMessages', required: false },
          { id: 'labs', name: 'Review Lab Results', function: 'getPendingLabResults', required: false },
          { id: 'refills', name: 'Process Refills', function: 'getPendingRefills', required: false }
        ]
      },

      endOfDay: {
        name: 'End of Day',
        icon: '🌙',
        steps: [
          { id: 'notes', name: 'Complete Notes', function: 'getPendingNotes', required: true },
          { id: 'callbacks', name: 'Patient Callbacks', function: 'getPendingCallbacks', required: false },
          { id: 'refills', name: 'Refill Requests', function: 'processPendingRefills', required: false },
          { id: 'tomorrow', name: 'Tomorrow Prep', function: 'getTomorrowSchedule', required: false },
          { id: 'summary', name: 'Day Summary', function: 'generateDaySummary', required: false }
        ]
      }
    };
  }

  // ============= CONTEXTUAL SUGGESTIONS =============
  initializeContextualSuggestions() {
    return {
      afterPatientAdd: [
        { text: 'Schedule appointment', command: 'schedule appointment for this patient', icon: '📅' },
        { text: 'Add medical history', command: 'add medical history', icon: '📋' },
        { text: 'Upload documents', command: 'upload patient documents', icon: '📄' },
        { text: 'Set reminders', command: 'set patient reminder', icon: '🔔' }
      ],

      afterLabResults: [
        { text: 'Add interpretation', command: 'interpret these lab results', icon: '🔬' },
        { text: 'Compare previous', command: 'compare with previous labs', icon: '📊' },
        { text: 'Notify patient', command: 'send results to patient', icon: '💬' },
        { text: 'Order follow-up', command: 'order follow-up tests', icon: '🧪' }
      ],

      afterDiagnosis: [
        { text: 'Treatment plan', command: 'create treatment plan', icon: '💊' },
        { text: 'Patient education', command: 'generate patient education', icon: '📚' },
        { text: 'Prescribe medication', command: 'prescribe medication', icon: '💉' },
        { text: 'Schedule follow-up', command: 'schedule follow-up', icon: '📅' }
      ],

      afterAppointment: [
        { text: 'Send reminder', command: 'send appointment reminder', icon: '🔔' },
        { text: 'Add to calendar', command: 'add to calendar', icon: '📅' },
        { text: 'Prepare notes', command: 'create appointment notes', icon: '📝' },
        { text: 'Check insurance', command: 'verify insurance coverage', icon: '🏥' }
      ]
    };
  }

  // ============= USER LEVEL TRACKING =============
  async getUserLevel(userId) {
    if (!this.initialized) await this.initialize();

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'get-user-level',
        practiceId: 'global'
      };

      const SecureDataAccess = this.getService('secureDataAccess');
      const session = await SecureDataAccess.query('user_sessions', { userId }, {}, context);
      if (!session || session.length === 0) return 'beginner';
      
      const userSession = session[0];
      const functionsUsed = userSession.functionsUsed ? new Set(userSession.functionsUsed) : new Set();
      const daysActive = userSession.daysActive || 0;
      
      if (functionsUsed.size < 5 && daysActive < 3) return 'beginner';
      if (functionsUsed.size < 20 && daysActive < 14) return 'intermediate';
      if (functionsUsed.size < 50 && daysActive < 30) return 'advanced';
      return 'expert';
    } catch (error) {
      console.error('Error getting user level:', error);
      return 'beginner';
    }
  }

  // ============= INTELLIGENT FUNCTION SELECTION =============
  async getRelevantFunctions(message, userId, context) {
    const userLevel = await this.getUserLevel(userId);
    const baseCategories = this.getBaseCategoriesForLevel(userLevel);
    const contextualFunctions = this.getContextualFunctions(context);
    const messageFunctions = this.detectNeededFunctions(message);
    
    // Combine and deduplicate
    const allFunctions = new Set([
      ...this.getFunctionsFromCategories(baseCategories),
      ...contextualFunctions,
      ...messageFunctions
    ]);
    
    // Limit based on user level
    const maxFunctions = this.getMaxFunctionsForLevel(userLevel);
    return Array.from(allFunctions).slice(0, maxFunctions);
  }

  getBaseCategoriesForLevel(level) {
    switch(level) {
      case 'beginner':
        return ['essentials'];
      case 'intermediate':
        return ['essentials', 'clinical', 'documents'];
      case 'advanced':
        return ['essentials', 'clinical', 'documents', 'scheduling', 'aiAssistance'];
      case 'expert':
        return Object.keys(this.functionCategories);
      default:
        return ['essentials'];
    }
  }

  getContextualFunctions(context) {
    // Return contextual functions based on current context
    return [];
  }

  detectNeededFunctions(message) {
    // Analyze message to detect needed functions
    return [];
  }

  getFunctionsFromCategories(categories) {
    return categories.flatMap(cat => this.functionCategories[cat]?.functions || []);
  }

  getMaxFunctionsForLevel(level) {
    switch(level) {
      case 'beginner': return 15;
      case 'intermediate': return 30;
      case 'advanced': return 60;
      case 'expert': return 150;
      default: return 15;
    }
  }

  // ============= SMART WELCOME MESSAGES =============
  async getWelcomeMessage(userId, language = 'en') {
    const userLevel = await this.getUserLevel(userId);
    const isHebrew = language === 'he';
    
    if (userLevel === 'beginner') {
      return isHebrew ? 
        `👋 ברוך הבא ל-IntelliCare! אני העוזר הרפואי שלך.
        
        איך אוכל לעזור לך היום?
        🔹 הוסף מטופל חדש
        🔹 חפש מטופל קיים
        🔹 צפה בלוח הזמנים של היום
        🔹 עזרה והדרכה
        
        פשוט תגיד לי מה אתה צריך!` :
        `👋 Welcome to IntelliCare! I'm your medical AI assistant.
        
        How can I help you today?
        🔹 Add a new patient
        🔹 Search existing patients
        🔹 View today's schedule
        🔹 Help & guidance
        
        Just tell me what you need!`;
    }
    
    // For returning users
    return isHebrew ?
      `👋 ברוך שובך! הנה הפעולות המהירות שלך:
      📋 צפה במטופלים של היום (12 מתוזמנים)
      ➕ הוסף מטופל חדש
      🔍 חפש מטופלים
      📊 לוח בקרה של המרפאה
      
      או פשוט תגיד לי מה אתה צריך!` :
      `👋 Welcome back! Here are your quick actions:
      📋 View today's patients (12 scheduled)
      ➕ Add new patient
      🔍 Search patients
      📊 Practice dashboard
      
      Or just tell me what you need!`;
  }

  // ============= GUIDED RESPONSES =============
  formatGuidedResponse(response, context, userId) {
    const suggestions = this.getContextualSuggestionsForResponse(response, context);
    
    // Add progress indicator for workflows
    let progress = null;
    if (context.activeWorkflow) {
      progress = this.getWorkflowProgress(context.activeWorkflow, context.currentStep);
    }
    
    return {
      text: response,
      suggestions: suggestions,
      progress: progress,
      uiElements: {
        showQuickActions: suggestions.length > 0,
        showProgress: progress !== null
      }
    };
  }

  getContextualSuggestionsForResponse(response, context) {
    // Detect what action was just completed
    if (response.includes('added successfully') || response.includes('הוספה בהצלחה')) {
      if (context.lastFunction === 'addPatient') {
        return this.contextualSuggestions.afterPatientAdd;
      }
    }
    
    if (response.includes('lab results') || response.includes('תוצאות מעבדה')) {
      return this.contextualSuggestions.afterLabResults;
    }
    
    if (response.includes('diagnosis') || response.includes('אבחנה')) {
      return this.contextualSuggestions.afterDiagnosis;
    }
    
    if (response.includes('appointment') || response.includes('תור')) {
      return this.contextualSuggestions.afterAppointment;
    }
    
    return [];
  }

  // ============= WORKFLOW MANAGEMENT =============
  async startWorkflow(workflowId, userId) {
    if (!this.initialized) await this.initialize();

    const workflow = this.workflows[workflowId];
    if (!workflow) return null;
    
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'start-workflow',
        practiceId: 'global'
      };

      const activeWorkflow = {
        id: workflowId,
        name: workflow.name,
        steps: workflow.steps,
        currentStep: 0,
        completedSteps: [],
        startedAt: new Date()
      };

      // Store workflow in database
      const SecureDataAccess = this.getService('secureDataAccess');
      await SecureDataAccess.create('user_workflows', {
        userId,
        workflowId,
        activeWorkflow,
        status: 'active'
      }, context);

      return {
        message: `Starting ${workflow.name} workflow. Let's begin with ${workflow.steps[0].name}.`,
        workflow: activeWorkflow,
        nextStep: workflow.steps[0]
      };
    } catch (error) {
      console.error('Error starting workflow:', error);
      return null;
    }
  }

  getWorkflowProgress(workflow, currentStep) {
    const totalSteps = workflow.steps.length;
    const percentComplete = Math.round((currentStep / totalSteps) * 100);
    
    return {
      current: currentStep + 1,
      total: totalSteps,
      percent: percentComplete,
      steps: workflow.steps.map((step, index) => ({
        name: step.name,
        status: index < currentStep ? 'completed' : index === currentStep ? 'current' : 'pending',
        icon: index < currentStep ? '✅' : index === currentStep ? '🔵' : '⭕'
      }))
    };
  }

  // ============= HELPFUL TIPS =============
  getRandomTip(context) {
    const tips = [
      { text: "Pro tip: You can say 'show today' to see all appointments", icon: '💡' },
      { text: "Did you know? Type 'stats' for a quick practice overview", icon: '💡' },
      { text: "Shortcut: Say 'last patient' to return to previous patient", icon: '💡' },
      { text: "Quick action: Type 'pending' to see all pending tasks", icon: '💡' },
      { text: "Time saver: Say 'template' to use document templates", icon: '💡' }
    ];
    
    return tips[Math.floor(Math.random() * tips.length)];
  }

  // ============= LEARNING & ADAPTATION =============
  async trackUserAction(userId, functionName, success = true) {
    if (!this.initialized) await this.initialize();

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'track-user-action',
        practiceId: 'global'
      };

      // Get or create user session
      const SecureDataAccess = this.getService('secureDataAccess');
      let sessions = await SecureDataAccess.query('user_sessions', { userId }, {}, context);
      let session = sessions.length > 0 ? sessions[0] : {
        userId,
        functionsUsed: [],
        functionCounts: {},
        lastActive: new Date(),
        daysActive: 1,
        preferences: {}
      };

      // Update session data
      if (!session.functionsUsed.includes(functionName)) {
        session.functionsUsed.push(functionName);
      }
      session.functionCounts[functionName] = (session.functionCounts[functionName] || 0) + 1;
      session.lastActive = new Date();

      // Track frequently used functions for quick access
      if (session.functionCounts[functionName] > 5) {
        session.preferences.frequentFunctions = session.preferences.frequentFunctions || [];
        if (!session.preferences.frequentFunctions.includes(functionName)) {
          session.preferences.frequentFunctions.push(functionName);
        }
      }

      // Save updated session
      if (sessions.length > 0) {
        await SecureDataAccess.update('user_sessions', { userId }, session, context);
      } else {
        await SecureDataAccess.create('user_sessions', session, context);
      }
    } catch (error) {
      console.error('Error tracking user action:', error);
    }
  }

  // ============= EXPORT FOR USE IN MAIN AGENT =============
  async enhanceAgentResponse(originalResponse, message, userId, context) {
    if (!this.initialized) await this.initialize();

    // Track the action
    if (context.lastFunction) {
      await this.trackUserAction(userId, context.lastFunction);
    }
    
    // Enhance the response with guidance
    return this.formatGuidedResponse(originalResponse, context, userId);
  }
}

// Create and export singleton
const guidedAgentService = new GuidedAgentService();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('guidedAgentService', () => guidedAgentService);
}

module.exports = guidedAgentService;