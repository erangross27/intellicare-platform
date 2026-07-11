/**
 * Context-Aware Semantic Function Selector
 * Enhances semantic search with conversation history and executed function tracking
 * Enables accurate multi-turn conversation support without multiple API calls
 */

const fs = require('fs');
const path = require('path');

class ContextAwareSemanticSelector {
  constructor() {
    this.enhancedSelector = null;
    this.nativeVectorSearch = null;
    this.conversationPatterns = null;
    this.initialized = false;

    // Track conversation state
    this.conversationCache = new Map(); // sessionId -> conversation state

    // Common conversation flow patterns
    this.flowPatterns = {
      // Patient flows
      'listAllPatients → details': 'getPatientDetails',
      'listAllPatients → more about': 'getPatientDetails',
      'listAllPatients → information': 'getPatientDetails',
      'findPatient → details': 'getPatientDetails',
      'findPatient → appointments': 'getPatientAppointments',
      'findPatient → medications': 'getPatientMedications',
      'getPatientDetails → appointments': 'getPatientAppointments',
      'getPatientDetails → medications': 'getPatientMedications',
      'getPatientDetails → allergies': 'getPatientAllergies',
      'getPatientDetails → history': 'getPatientHistory',
      'getPatientDetails → documents': 'getPatientDocuments',
      'getPatientDetails → add allergy': 'addAllergy',
      'getPatientDetails → schedule': 'scheduleAppointment',

      // Appointment flows
      'getPatientAppointments → cancel': 'cancelAppointment',
      'getPatientAppointments → reschedule': 'rescheduleAppointment',
      'scheduleAppointment → confirm': 'confirmAppointment',
      'scheduleAppointment → available slots': 'getAvailableSlots',

      // Document flows
      'uploadDocument → analyze': 'analyzeDocument',
      'getPatientDocuments → analyze': 'analyzeDocument',
      'analyzeDocument → extract': 'extractDocumentData',

      // Medication flows
      'getPatientMedications → refill': 'refillPrescription',
      'getPatientMedications → add': 'addMedication',
      'getPatientMedications → discontinue': 'discontinueMedication'
    };
  }

  async initialize() {
    if (this.initialized) return;

    try {
      console.log('🎯 Initializing Context-Aware Semantic Selector...');

      // Load the enhanced selector
      const EnhancedSemanticSelector = require('./enhancedSemanticSelector');
      if (typeof EnhancedSemanticSelector === 'function') {
        this.enhancedSelector = new EnhancedSemanticSelector();
      } else {
        this.enhancedSelector = EnhancedSemanticSelector;
      }

      // Native vector search disabled - using two-stage Claude selector instead
      // Commented out to avoid loading 1413 function embeddings
      /*
      try {
        this.nativeVectorSearch = require('./nativeVectorSearch');
      } catch (e) {
        console.log('⚠️ Native vector search not available, using enhanced selector only');
      }
      */

      // Load conversation patterns if they exist
      const patternsPath = path.join(__dirname, '..', 'data', 'conversation-patterns.json');
      if (fs.existsSync(patternsPath)) {
        this.conversationPatterns = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
        console.log('✅ Loaded conversation patterns');
      }

      // Initialize the underlying selector
      if (this.enhancedSelector && this.enhancedSelector.initialize) {
        await this.enhancedSelector.initialize();
      }

      // Native vector search initialization disabled
      /*
      if (this.nativeVectorSearch && this.nativeVectorSearch.initialize) {
        await this.nativeVectorSearch.initialize();
      }
      */

      this.initialized = true;
      console.log('✅ Context-Aware Selector ready for multi-turn conversations');

    } catch (error) {
      console.error('❌ Failed to initialize Context-Aware Selector:', error);
      throw error;
    }
  }

  /**
   * Extract the current patient/entity from conversation
   */
  extractCurrentEntity(conversation) {
    const entities = {
      patient: null,
      doctor: null,
      appointment: null
    };

    // Look through recent messages for entity mentions
    for (let i = conversation.length - 1; i >= Math.max(0, conversation.length - 6); i--) {
      const msg = conversation[i];

      // Check for patient names
      const patientMatch = msg.content?.match(/(?:patient|Patient)?\s*(?:named?|called?)?\s*([A-Z][a-z]+ [A-Z][a-z]+)/);
      if (patientMatch && !entities.patient) {
        entities.patient = patientMatch[1];
      }

      // Check if listing patients
      if (msg.executedFunction === 'listAllPatients' && msg.content) {
        // Extract first patient mentioned
        const listMatch = msg.content.match(/(?:\d+\.\s+)?([A-Z][a-z]+ [A-Z][a-z]+)/);
        if (listMatch) {
          entities.patient = listMatch[1];
        }
      }

      // Check executed functions for context
      if (msg.executedFunction?.includes('Patient')) {
        entities.context = 'patient';
      }
    }

    return entities;
  }

  /**
   * Resolve pronouns based on conversation context
   */
  resolvePronouns(query, conversation) {
    const entities = this.extractCurrentEntity(conversation);
    let resolvedQuery = query;

    // Resolve pronouns to actual entities
    if (entities.patient && /\b(him|her|his|hers?|they|them|their|this patient)\b/i.test(query)) {
      // Replace pronouns with the patient name
      resolvedQuery = query
        .replace(/\b(him|her|them|this patient)\b/gi, entities.patient)
        .replace(/\b(his|her|their)\b/gi, `${entities.patient}'s`)
        .replace(/\bhers?\b/gi, `${entities.patient}'s`);

      console.log(`🔄 Pronoun resolution: "${query}" → "${resolvedQuery}"`);
    }

    return resolvedQuery;
  }

  /**
   * Get the last executed function from conversation
   */
  getLastExecutedFunction(conversation) {
    for (let i = conversation.length - 1; i >= 0; i--) {
      if (conversation[i].executedFunction) {
        return conversation[i].executedFunction;
      }
    }
    return null;
  }

  /**
   * Apply conversation flow patterns
   */
  applyFlowPatterns(query, lastFunction) {
    if (!lastFunction) return null;

    const queryLower = query.toLowerCase();

    // Check each pattern
    for (const [pattern, targetFunction] of Object.entries(this.flowPatterns)) {
      const [prevFunc, queryPattern] = pattern.split(' → ');

      if (lastFunction === prevFunc) {
        // Check if current query matches the pattern
        if (queryLower.includes(queryPattern)) {
          console.log(`🎯 Flow pattern matched: ${pattern} → ${targetFunction}`);
          return targetFunction;
        }
      }
    }

    return null;
  }

  /**
   * Build context string from conversation history
   */
  buildContextString(conversation) {
    const relevantHistory = conversation.slice(-6); // Last 3 exchanges

    return relevantHistory.map(msg => {
      if (msg.executedFunction) {
        return `[EXECUTED: ${msg.executedFunction}]`;
      }
      if (msg.role === 'user') {
        return `USER: ${msg.content}`;
      }
      if (msg.role === 'assistant' && msg.content) {
        // Truncate long assistant responses
        const truncated = msg.content.substring(0, 200);
        return `ASSISTANT: ${truncated}${msg.content.length > 200 ? '...' : ''}`;
      }
      return '';
    }).filter(Boolean).join('\n');
  }

  /**
   * Main function selection with context awareness
   */
  async selectFunctions(query, maxFunctions = 10, conversation = []) {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log('🧠 Context-Aware Selection for:', query);

    // Step 1: Check for direct pattern match
    const lastFunction = this.getLastExecutedFunction(conversation);
    if (lastFunction) {
      console.log(`📍 Last function executed: ${lastFunction}`);

      const patternMatch = this.applyFlowPatterns(query, lastFunction);
      if (patternMatch) {
        console.log(`✅ Direct pattern match: ${patternMatch}`);
        return [patternMatch];
      }
    }

    // Step 2: Resolve pronouns
    const resolvedQuery = this.resolvePronouns(query, conversation);

    // Step 3: Build enriched query with context
    const contextString = this.buildContextString(conversation);
    const enrichedQuery = contextString ?
      `${contextString}\n\nCURRENT QUERY: ${resolvedQuery}` :
      resolvedQuery;

    console.log('📝 Enriched query with context:', enrichedQuery.substring(0, 200) + '...');

    // Step 4: Try native vector search first if available
    if (this.nativeVectorSearch && this.nativeVectorSearch.search) {
      try {
        const results = await this.nativeVectorSearch.search(enrichedQuery, maxFunctions);
        if (results && results.length > 0) {
          // Apply context boosting
          const boostedResults = this.applyContextBoosting(results, lastFunction, resolvedQuery);
          const functionNames = boostedResults.map(r => r.name || r);
          console.log(`🎯 Native search with context returned: ${functionNames.slice(0, 3).join(', ')}`);
          return functionNames;
        }
      } catch (error) {
        console.log('⚠️ Native search failed, falling back to enhanced selector');
      }
    }

    // Step 5: Fall back to enhanced selector
    if (this.enhancedSelector) {
      const results = await this.enhancedSelector.selectFunction(enrichedQuery, { maxFunctions });

      // Convert results to array of function names
      let functionNames;
      if (results && typeof results === 'object' && !Array.isArray(results)) {
        // If it's an object with function names as keys
        functionNames = Object.keys(results);
      } else if (Array.isArray(results)) {
        // If it's an array, extract names
        functionNames = results.map(r => {
          if (typeof r === 'string') return r;
          if (r && typeof r === 'object' && r.name) return r.name;
          return null;
        }).filter(Boolean);
      } else {
        functionNames = [];
      }

      // Apply context boosting
      const boostedResults = this.applyContextBoosting(functionNames, lastFunction, resolvedQuery);

      console.log(`🎯 Enhanced selector with context returned: ${boostedResults.slice(0, 3).join(', ')}`);
      return boostedResults;
    }

    console.error('❌ No selector available');
    return [];
  }

  /**
   * Apply context-based score boosting
   */
  applyContextBoosting(results, lastFunction, query) {
    if (!lastFunction || !results || results.length === 0) return results;

    // Create a copy of results to avoid mutation
    let boostedResults = [...results];
    const queryLower = query.toLowerCase();

    // Boost functions that commonly follow the last function
    const boostMap = {
      'listAllPatients': {
        'getPatientDetails': 2.0,
        'findPatient': 1.5
      },
      'findPatient': {
        'getPatientDetails': 2.0,
        'getPatientAppointments': 1.5,
        'getPatientMedications': 1.5
      },
      'getPatientDetails': {
        'getPatientAppointments': 1.5,
        'getPatientMedications': 1.5,
        'getPatientAllergies': 1.5,
        'addAllergy': 1.3,
        'scheduleAppointment': 1.3
      }
    };

    const boosts = boostMap[lastFunction];
    if (boosts) {
      // Sort results based on boost values
      const boostedFunctions = [];
      const normalFunctions = [];

      boostedResults.forEach(funcName => {
        if (boosts[funcName]) {
          console.log(`⬆️ Boosting ${funcName} by ${boosts[funcName]}x due to context`);
          boostedFunctions.push({ name: funcName, boost: boosts[funcName] });
        } else {
          normalFunctions.push(funcName);
        }
      });

      // Sort boosted functions by boost value
      boostedFunctions.sort((a, b) => b.boost - a.boost);

      // Reconstruct the array with boosted functions first
      boostedResults = [
        ...boostedFunctions.map(f => f.name),
        ...normalFunctions
      ];
    }

    return boostedResults;
  }

  /**
   * Update conversation state for a session
   */
  updateConversationState(sessionId, executedFunction, result) {
    if (!this.conversationCache.has(sessionId)) {
      this.conversationCache.set(sessionId, {
        functions: [],
        entities: {},
        lastUpdate: Date.now()
      });
    }

    const state = this.conversationCache.get(sessionId);
    state.functions.push(executedFunction);
    state.lastUpdate = Date.now();

    // Extract entities from result if available
    if (result && typeof result === 'object') {
      if (result.patient) state.entities.patient = result.patient;
      if (result.doctor) state.entities.doctor = result.doctor;
    }

    // Clean up old sessions (older than 1 hour)
    const oneHourAgo = Date.now() - 3600000;
    for (const [sid, sstate] of this.conversationCache.entries()) {
      if (sstate.lastUpdate < oneHourAgo) {
        this.conversationCache.delete(sid);
      }
    }
  }

  /**
   * Learn from successful function selections
   */
  async learnPattern(previousFunction, query, selectedFunction) {
    // Create pattern key
    const queryKey = query.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(' ')
      .slice(0, 3)
      .join(' ');

    const pattern = `${previousFunction} → ${queryKey}`;

    // Add to flow patterns if not exists
    if (!this.flowPatterns[pattern]) {
      this.flowPatterns[pattern] = selectedFunction;
      console.log(`📚 Learned new pattern: ${pattern} → ${selectedFunction}`);

      // Optionally save to file
      try {
        const patternsPath = path.join(__dirname, '..', 'data', 'learned-patterns.json');
        const existing = fs.existsSync(patternsPath) ?
          JSON.parse(fs.readFileSync(patternsPath, 'utf8')) : {};
        existing[pattern] = selectedFunction;
        fs.writeFileSync(patternsPath, JSON.stringify(existing, null, 2));
      } catch (e) {
        // Silent fail for learning
      }
    }
  }
}

// Export singleton instance
const contextAwareSelector = new ContextAwareSemanticSelector();
module.exports = contextAwareSelector;