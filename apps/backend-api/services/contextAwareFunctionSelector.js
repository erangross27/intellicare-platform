/**
 * Context-Aware Function Selector Service
 * Uses two-stage Claude API calls to maintain conversation context
 * Solves multi-turn conversation problems where semantic search fails
 */

const Anthropic = require('@anthropic-ai/sdk');

class ContextAwareFunctionSelector {
  constructor() {
    // Anthropic client will be initialized asynchronously
    this.anthropic = null;

    // Cache for function names (loaded once)
    this.functionNames = null;
    this.functionDescriptions = null;

    // Conversation context cache (per session)
    this.sessionContexts = new Map();

    // Performance metrics
    this.metrics = {
      stage1Calls: 0,
      stage2Calls: 0,
      totalCost: 0,
      cacheHits: 0,
      averageLatency: 0
    };

    console.log('🧠 Context-Aware Function Selector initialized');
  }

  /**
   * Initialize Claude client with API key from KMS
   */
  async initializeAnthropicClient() {
    if (this.anthropic) return; // Already initialized

    console.log('[ContextAwareSelector] INIT: Initializing Anthropic client with KMS key...');
    
    // Get API key from KMS
    const productionKMS = require('./productionKMS');
    if (!productionKMS.initialized) {
      await productionKMS.initialize();
    }
    
    const apiKey = await productionKMS.getInternalKey('CLAUDE_API_KEY') || 
                   await productionKMS.getInternalKey('ANTHROPIC_API_KEY');
    
    if (!apiKey) {
      throw new Error('No Claude/Anthropic API key found in KMS. Please store CLAUDE_API_KEY or ANTHROPIC_API_KEY.');
    }
    
    this.anthropic = new Anthropic({
      apiKey: apiKey
    });
    console.log('[ContextAwareSelector] INIT: ✅ Anthropic client initialized');
  }

  /**
   * Initialize function list (call once at startup)
   */
  async initialize() {
    // Initialize Anthropic client first
    try {
      await this.initializeAnthropicClient();
    } catch (error) {
      console.error('[ContextAwareSelector] INIT: ❌ Failed to initialize Anthropic client:', error.message);
      throw error;
    }
    try {
      const fs = require('fs');
      const path = require('path');

      // Load all function names and descriptions
      const functionsPath = path.join(__dirname, '..', 'all-functions-master-list.json');
      const allFunctions = JSON.parse(fs.readFileSync(functionsPath, 'utf8'));

      // Create optimized list with names and brief descriptions
      this.functionNames = Object.keys(allFunctions);
      this.functionDescriptions = {};

      for (const [name, data] of Object.entries(allFunctions)) {
        // Store name with brief description for context
        this.functionDescriptions[name] = {
          name: name,
          description: data.description || '',
          category: data.category || 'general'
        };
      }

      console.log(`✅ Loaded ${this.functionNames.length} functions for context-aware selection`);

      // Calculate token estimate
      const namesJson = JSON.stringify(this.functionNames);
      const descriptionsJson = JSON.stringify(this.functionDescriptions);
      console.log(`📊 Function names size: ${Math.ceil(namesJson.length / 4)} tokens`);
      console.log(`📊 With descriptions: ${Math.ceil(descriptionsJson.length / 4)} tokens`);

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize context-aware selector:', error);
      return false;
    }
  }

  /**
   * Get or create session context
   */
  getSessionContext(sessionId) {
    if (!this.sessionContexts.has(sessionId)) {
      this.sessionContexts.set(sessionId, {
        conversationHistory: [],
        lastSelectedFunctions: [],
        contextData: {}
      });
    }
    return this.sessionContexts.get(sessionId);
  }

  /**
   * Stage 1: Select appropriate functions based on context
   */
  async selectFunctions(query, sessionId, options = {}) {
    const startTime = Date.now();

    if (!this.functionNames) {
      await this.initialize();
    }

    const context = this.getSessionContext(sessionId);

    try {
      console.log('🎯 Stage 1: Context-aware function selection');
      console.log(`   Session: ${sessionId}`);
      console.log(`   Query: "${query}"`);
      console.log(`   History: ${context.conversationHistory.length} turns`);

      // Build conversation context
      const conversationContext = this.buildConversationContext(context, query);

      // Create system prompt for function selection
      const systemPrompt = `You are a medical platform function selector. Given the conversation history and current query, select the most appropriate function(s) from the available list.

IMPORTANT RULES:
1. Consider the full conversation context when selecting functions
2. Understand pronouns (he, she, it, that) from context
3. Remember entities mentioned in previous turns (patients, medications, etc.)
4. Select only functions that are directly needed for the current query
5. Return function names as a JSON array

Available functions: ${JSON.stringify(this.functionNames)}

Respond with ONLY a JSON array of function names, nothing else.`;

      // Build messages with conversation history
      const messages = [
        { role: 'system', content: systemPrompt }
      ];

      // Add conversation history
      if (conversationContext.history.length > 0) {
        messages.push({
          role: 'user',
          content: `Previous conversation:\n${conversationContext.history.join('\n\n')}`
        });
      }

      // Add current query
      messages.push({
        role: 'user',
        content: `Current query: ${query}`
      });

      // Call Claude for function selection
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-5',  // Claude Sonnet 5
        max_tokens: 500,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        messages: messages
      });

      // Parse selected functions
      let selectedFunctions = [];
      try {
        const content = response.content[0].text;
        selectedFunctions = JSON.parse(content);
      } catch (parseError) {
        console.error('⚠️ Failed to parse function selection:', parseError);
        // Fallback to finding function names in response
        const content = response.content[0].text;
        selectedFunctions = this.functionNames.filter(name =>
          content.includes(name)
        );
      }

      // Update context
      context.lastSelectedFunctions = selectedFunctions;
      context.conversationHistory.push({
        query: query,
        selectedFunctions: selectedFunctions,
        timestamp: new Date().toISOString()
      });

      // Track metrics
      this.metrics.stage1Calls++;
      const latency = Date.now() - startTime;
      this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2;

      // Calculate cost (approximate)
      const inputTokens = response.usage?.input_tokens || 9000;
      const outputTokens = response.usage?.output_tokens || 50;
      const cost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;
      this.metrics.totalCost += cost;

      console.log(`✅ Stage 1 complete in ${latency}ms`);
      console.log(`   Selected: ${selectedFunctions.join(', ')}`);
      console.log(`   Tokens: ${inputTokens} in, ${outputTokens} out`);
      console.log(`   Cost: $${cost.toFixed(4)}`);

      return {
        functions: selectedFunctions,
        context: conversationContext,
        metrics: {
          latency,
          inputTokens,
          outputTokens,
          cost
        }
      };

    } catch (error) {
      // ========================================
      // COMPREHENSIVE ANTHROPIC SDK ERROR HANDLING
      // ========================================

      // Check for network connectivity errors (no internet connection)
      const networkErrorCodes = ['EAI_AGAIN', 'ENOTFOUND', 'ETIMEDOUT', 'ENETUNREACH', 'ECONNREFUSED', 'ECONNRESET'];
      const isNetworkError =
        networkErrorCodes.includes(error.code) ||
        networkErrorCodes.includes(error.cause?.code) ||
        error.message?.includes('fetch failed') ||
        error.message?.includes('getaddrinfo') ||
        error.constructor?.name === 'APIConnectionError' ||
        error.constructor?.name === 'APIConnectionTimeoutError';

      if (isNetworkError) {
        const errorCode = error.cause?.code || error.code || 'UNKNOWN';
        const errorMsg = error.cause?.message || error.message || 'Unknown network error';

        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ NETWORK CONNECTION ERROR');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('   Stage: Context-aware function selection');
        console.error('   Service: Anthropic API (api.anthropic.com)');
        console.error(`   Error Code: ${errorCode}`);
        console.error(`   Error Type: ${error.constructor?.name || 'Error'}`);
        console.error(`   Details: ${errorMsg}`);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Throw a user-friendly error that will be caught by the route handler
        const networkError = new Error('Unable to process request: No internet connection available. Please check your network connection and try again.');
        networkError.code = 'NO_INTERNET_CONNECTION';
        networkError.isNetworkError = true;
        networkError.originalError = errorCode;
        throw networkError;
      }

      // Check for Anthropic API-specific errors
      const errorType = error.constructor?.name;

      if (errorType === 'AuthenticationError') {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ AUTHENTICATION ERROR (401)');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('   Stage: Context-aware function selection');
        console.error('   Status: Invalid or missing API key');
        console.error(`   Request ID: ${error.requestID || 'N/A'}`);
        console.error(`   Message: ${error.message}`);
        console.error('   Action: Check ANTHROPIC_API_KEY environment variable');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const authError = new Error('Unable to process request: API authentication failed. Please contact system administrator.');
        authError.code = 'AUTHENTICATION_ERROR';
        authError.status = 401;
        throw authError;
      }

      if (errorType === 'RateLimitError') {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ RATE LIMIT ERROR (429)');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('   Stage: Context-aware function selection');
        console.error('   Status: Too many requests to Anthropic API');
        console.error(`   Request ID: ${error.requestID || 'N/A'}`);
        console.error(`   Message: ${error.message}`);
        console.error('   Action: Wait a moment and try again');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const rateLimitError = new Error('Service is currently busy. Please wait a moment and try again.');
        rateLimitError.code = 'RATE_LIMIT_ERROR';
        rateLimitError.status = 429;
        throw rateLimitError;
      }

      if (errorType === 'InternalServerError') {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ ANTHROPIC API SERVER ERROR (500+)');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('   Stage: Context-aware function selection');
        console.error(`   Status: ${error.status || '500'}`);
        console.error(`   Request ID: ${error.requestID || 'N/A'}`);
        console.error(`   Message: ${error.message}`);
        console.error('   Action: Anthropic API is experiencing issues');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const serverError = new Error('AI service is temporarily unavailable. Please try again in a few moments.');
        serverError.code = 'API_SERVER_ERROR';
        serverError.status = error.status;
        throw serverError;
      }

      // For all other errors, fallback to semantic search
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ CONTEXT-AWARE SELECTION FAILED');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error(`   Error Type: ${errorType || error.constructor?.name || 'Unknown'}`);
      console.error(`   Message: ${error.message || 'Unknown error'}`);
      console.error(`   Status: ${error.status || 'N/A'}`);
      console.error(`   Request ID: ${error.requestID || 'N/A'}`);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚠️ Falling back to semantic search');

      const enhancedSemanticSelector = require('./enhancedSemanticSelector');
      const fallbackResults = await enhancedSemanticSelector.selectFunctions(query, 10);
      return {
        functions: fallbackResults,
        context: context,
        fallback: true
      };
    }
  }

  /**
   * Build conversation context for Claude
   */
  buildConversationContext(context, currentQuery) {
    const history = [];

    // Include last 5-10 turns for context
    const recentHistory = context.conversationHistory.slice(-10);

    for (const turn of recentHistory) {
      history.push(`User: ${turn.query}`);
      if (turn.response) {
        // Include brief summary of response if available
        const summary = this.summarizeResponse(turn.response);
        history.push(`Assistant: ${summary}`);
      }
      if (turn.selectedFunctions && turn.selectedFunctions.length > 0) {
        history.push(`[Functions used: ${turn.selectedFunctions.join(', ')}]`);
      }
    }

    return {
      history,
      currentQuery,
      entities: this.extractEntities(context),
      lastFunctions: context.lastSelectedFunctions
    };
  }

  /**
   * Extract entities from conversation (patients, medications, etc.)
   */
  extractEntities(context) {
    const entities = {
      patients: new Set(),
      medications: new Set(),
      conditions: new Set(),
      dates: new Set()
    };

    for (const turn of context.conversationHistory) {
      // Extract patient names (simple pattern matching)
      const patientPattern = /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g;
      const matches = turn.query.match(patientPattern);
      if (matches) {
        matches.forEach(name => entities.patients.add(name));
      }

      // Store in context data for reference
      if (turn.contextData) {
        if (turn.contextData.patientName) {
          entities.patients.add(turn.contextData.patientName);
        }
        if (turn.contextData.medication) {
          entities.medications.add(turn.contextData.medication);
        }
      }
    }

    return {
      patients: Array.from(entities.patients),
      medications: Array.from(entities.medications),
      conditions: Array.from(entities.conditions)
    };
  }

  /**
   * Summarize response for context (keep it brief)
   */
  summarizeResponse(response) {
    if (!response) return '';

    // If response is short, use as-is
    if (response.length < 100) return response;

    // Otherwise, extract key information
    if (response.includes('patient')) {
      return 'Showed patient information';
    } else if (response.includes('medication')) {
      return 'Provided medication details';
    } else if (response.includes('appointment')) {
      return 'Handled appointment request';
    }

    return 'Provided requested information';
  }

  /**
   * Update conversation context after execution
   */
  updateContext(sessionId, query, response, executedFunctions) {
    const context = this.getSessionContext(sessionId);

    // Find the turn and update it
    const lastTurn = context.conversationHistory[context.conversationHistory.length - 1];
    if (lastTurn && lastTurn.query === query) {
      lastTurn.response = response;
      lastTurn.executedFunctions = executedFunctions;
    }

    // Clean up old sessions (keep last 100)
    if (this.sessionContexts.size > 100) {
      const oldestKey = this.sessionContexts.keys().next().value;
      this.sessionContexts.delete(oldestKey);
    }
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeSessions: this.sessionContexts.size,
      functionsLoaded: this.functionNames?.length || 0
    };
  }

  /**
   * Clear session context (for privacy/cleanup)
   */
  clearSession(sessionId) {
    this.sessionContexts.delete(sessionId);
    console.log(`🗑️ Cleared context for session ${sessionId}`);
  }
}

// Export singleton
const contextAwareSelector = new ContextAwareFunctionSelector();
module.exports = contextAwareSelector;