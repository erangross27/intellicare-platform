/**
 * Universal Conversation Context Manager
 * Handles multi-turn conversations for ALL 1500+ functions
 */

class UniversalConversationContext {
  constructor() {
    // Track ALL entity types dynamically
    this.entities = new Map();

    // Track function execution history
    this.functionHistory = [];

    // Track all function results
    this.functionResults = new Map();

    // Entity type patterns for automatic detection
    this.entityPatterns = {
      patient: /patient|מטופל/i,
      appointment: /appointment|meeting|visit|פגישה/i,
      document: /document|file|pdf|image|מסמך/i,
      prescription: /prescription|medication|rx|מרשם/i,
      diagnosis: /diagnosis|condition|disease|אבחנה/i,
      labResult: /lab|test|result|בדיקה/i,
      referral: /referral|refer|הפניה/i,
      procedure: /procedure|surgery|operation|ניתוח/i,
      insurance: /insurance|claim|coverage|ביטוח/i,
      provider: /doctor|physician|provider|רופא/i,
      practice: /clinic|practice|hospital|מרפאה/i,
      user: /user|staff|employee|משתמש/i
    };

    // Reference words that need resolution
    this.referencePatterns = {
      singular: /\b(it|this|that|the same|another)\b/i,
      plural: /\b(them|these|those|all of them)\b/i,
      possessive: /\b(its|their|his|her)\b/i,
      ordinal: /\b(first|second|third|last|previous|next)\b/i,
      numbered: /^#?\d+$|^\d+\./,
      relative: /\b(above|below|earlier|later|previous|following)\b/i
    };
  }

  /**
   * Track function execution and results
   */
  trackFunctionCall(functionName, params, result) {
    // Add to history
    this.functionHistory.push({
      function: functionName,
      params,
      result,
      timestamp: Date.now()
    });

    // Keep only last 20 for memory efficiency
    if (this.functionHistory.length > 20) {
      this.functionHistory.shift();
    }

    // Store result by function type
    this.functionResults.set(functionName, result);

    // Auto-extract entities from result
    this.extractEntitiesFromResult(functionName, result);
  }

  /**
   * Automatically extract entities from ANY function result
   */
  extractEntitiesFromResult(functionName, result) {
    // Handle list functions (listAllPatients, listAppointments, etc.)
    if (functionName.startsWith('list') || functionName.includes('getAll')) {
      const entityType = this.inferEntityType(functionName);
      if (Array.isArray(result)) {
        this.entities.set(`${entityType}_list`, result);
        this.entities.set(`last_list_type`, entityType);
        this.entities.set(`last_list_count`, result.length);
      }
    }

    // Handle get/create/update functions (single entity results)
    if (functionName.match(/^(get|create|update|add|schedule|upload)/)) {
      const entityType = this.inferEntityType(functionName);
      if (result && typeof result === 'object') {
        this.entities.set(`last_${entityType}`, result);
        this.entities.set('last_entity_type', entityType);

        // Track by ID if available
        if (result.id || result._id) {
          const id = result.id || result._id;
          this.entities.set(`${entityType}_${id}`, result);
        }
      }
    }

    // Handle search functions
    if (functionName.includes('search') || functionName.includes('find')) {
      const entityType = this.inferEntityType(functionName);
      this.entities.set(`search_results_${entityType}`, result);
      this.entities.set('last_search_type', entityType);
    }
  }

  /**
   * Infer entity type from function name
   */
  inferEntityType(functionName) {
    const lowerName = functionName.toLowerCase();

    // Check against known patterns
    for (const [type, pattern] of Object.entries(this.entityPatterns)) {
      if (pattern.test(lowerName)) {
        return type;
      }
    }

    // Extract from function name pattern
    // Examples: getPatientDetails -> patient, scheduleAppointment -> appointment
    const patterns = [
      /get(.+?)(?:Details|Info|Data|s)?$/i,
      /list(?:All)?(.+?)s?$/i,
      /create(.+?)$/i,
      /update(.+?)$/i,
      /delete(.+?)$/i,
      /search(.+?)(?:s|ByName|ById)?$/i,
      /schedule(.+?)$/i,
      /upload(.+?)$/i,
      /analyze(.+?)$/i
    ];

    for (const pattern of patterns) {
      const match = functionName.match(pattern);
      if (match) {
        return match[1].toLowerCase();
      }
    }

    return 'entity'; // Generic fallback
  }

  /**
   * Enhance query with context for ANY function type
   */
  enhanceQuery(query, lastFunctionName = null) {
    let enhanced = query;
    const queryLower = query.toLowerCase();

    // 1. Handle numbered selections from ANY list
    if (this.referencePatterns.numbered.test(query)) {
      const lastListType = this.entities.get('last_list_type');
      const list = this.entities.get(`${lastListType}_list`);

      if (list && Array.isArray(list)) {
        const num = parseInt(query.match(/\d+/)[0]);
        if (num > 0 && num <= list.length) {
          const item = list[num - 1];
          const name = item.name || item.title || item.id || `item ${num}`;
          enhanced = `get ${lastListType} details for ${name}`;
          console.log(`🔢 Resolved #${num} to ${lastListType}: ${name}`);
        }
      }
    }

    // 2. Handle reference words (it, that, them, etc.)
    for (const [type, pattern] of Object.entries(this.referencePatterns)) {
      if (pattern.test(queryLower)) {
        const lastEntityType = this.entities.get('last_entity_type');
        const lastEntity = this.entities.get(`last_${lastEntityType}`);

        if (lastEntity) {
          const identifier = lastEntity.name || lastEntity.title || lastEntity.id;
          enhanced = enhanced.replace(pattern, identifier);
          console.log(`🔄 Resolved "${query}" → "${enhanced}" (${lastEntityType})`);
        }
      }
    }

    // 3. Handle "another" or "more" (repeat last action with variation)
    if (queryLower.includes('another') || queryLower.includes('more')) {
      const lastFunction = this.functionHistory[this.functionHistory.length - 1];
      if (lastFunction) {
        enhanced = `${lastFunction.function} ${query}`;
        console.log(`🔁 Repeat context: ${lastFunction.function}`);
      }
    }

    // 4. Handle incomplete queries based on last function
    if (queryLower.match(/^(show|get|display|list|cancel|update|delete)$/)) {
      const lastEntityType = this.entities.get('last_entity_type');
      if (lastEntityType) {
        enhanced = `${query} ${lastEntityType}`;
        console.log(`📝 Auto-completed: "${query}" → "${enhanced}"`);
      }
    }

    // 5. Handle possessive references based on context
    if (this.referencePatterns.possessive.test(queryLower)) {
      const lastPatient = this.entities.get('last_patient');
      if (lastPatient && queryLower.includes('their')) {
        enhanced = enhanced.replace(/\btheir\b/gi, `${lastPatient.name}'s`);
      }
    }

    return enhanced;
  }

  /**
   * Get relevant context for function selection
   */
  getRelevantContext(query) {
    const context = {
      lastFunction: null,
      relevantEntities: [],
      suggestedFunctions: []
    };

    // Get last function
    if (this.functionHistory.length > 0) {
      context.lastFunction = this.functionHistory[this.functionHistory.length - 1].function;
    }

    // Find relevant entities based on query
    const queryLower = query.toLowerCase();
    for (const [key, value] of this.entities.entries()) {
      if (key.includes('last_') || key.includes('_list')) {
        context.relevantEntities.push({ key, value });
      }
    }

    // Suggest follow-up functions based on last action
    if (context.lastFunction) {
      context.suggestedFunctions = this.getSuggestedFollowUps(context.lastFunction);
    }

    return context;
  }

  /**
   * Suggest logical follow-up functions
   */
  getSuggestedFollowUps(lastFunction) {
    const followUpMap = {
      // Patient flow
      'listAllPatients': ['getPatientDetails', 'searchPatientsByName', 'addPatient'],
      'getPatientDetails': ['updatePatient', 'scheduleAppointment', 'createPrescription', 'addDiagnosis'],
      'addPatient': ['getPatientDetails', 'scheduleAppointment', 'addMedicalHistory'],

      // Appointment flow
      'scheduleAppointment': ['getAppointmentDetails', 'updateAppointment', 'sendAppointmentReminder'],
      'listAppointments': ['getAppointmentDetails', 'updateAppointment', 'cancelAppointment'],

      // Document flow
      'uploadDocument': ['analyzeDocument', 'assignDocumentToPatient', 'extractDataFromDocument'],
      'listDocuments': ['viewDocument', 'analyzeDocument', 'deleteDocument'],

      // Prescription flow
      'createPrescription': ['getPrescriptionDetails', 'sendPrescription', 'refillPrescription'],
      'listPrescriptions': ['getPrescriptionDetails', 'refillPrescription', 'cancelPrescription'],

      // Diagnosis flow
      'addDiagnosis': ['getDiagnosisDetails', 'updateDiagnosis', 'createTreatmentPlan'],
      'listDiagnoses': ['getDiagnosisDetails', 'updateDiagnosis', 'addTreatmentNote']
    };

    return followUpMap[lastFunction] || [];
  }

  /**
   * Clear context (for new conversation)
   */
  clear() {
    this.entities.clear();
    this.functionHistory = [];
    this.functionResults.clear();
  }

  /**
   * Export context for debugging
   */
  exportContext() {
    return {
      entities: Array.from(this.entities.entries()),
      functionHistory: this.functionHistory,
      functionResults: Array.from(this.functionResults.entries())
    };
  }
}

module.exports = UniversalConversationContext;