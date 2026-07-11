/**
 * Claude Agent Service - Direct API Implementation
 *
 * Implements true agentic behavior using Claude Sonnet directly:
 * - Full agentic loop: Claude selects tools → Backend executes → Claude sees results → Decides next action
 * - Tools execute via direct function calls (not Claude Code subprocess)
 * - Live streaming of tool execution and thinking
 * - Multi-step workflows: search patient → get data → generate recommendations
 *
 * How it works:
 * 1. User: "Show Helen Cox's lab results and recommendations"
 * 2. Claude: "I need to search for Helen Cox" → calls searchPatientsByName()
 * 3. Backend executes search immediately, returns patient ID
 * 4. Claude: "Now get her lab results" → calls getLabResults(patientId)
 * 5. Backend executes, returns results
 * 6. Claude: "Now get recommendations" → calls getIntelligentRecommendations(patientId)
 * 7. Backend executes, returns recommendations
 * 8. Claude generates final response with all data
 */

const Anthropic = require('@anthropic-ai/sdk');
const BaseService = require('./baseService');
const { isDisplayableThinking } = require('./utils/sanitizeThinking');
const serviceAccountManager = require('./serviceAccountManager');
const { getPracticeLocalTime, formatDateInTimezone } = require('../utils/timezoneHelper');

/**
 * Claude Agent Service with Direct API and Tool Execution
 * Handles agentic queries with automatic tool execution
 * Extends BaseService for proper service registration and lifecycle management
 */
class AgentSDKService extends BaseService {
  constructor() {
    super('agentSDKService');
    console.log('[Agent] ========== AgentSDKService Constructor Starting ==========');

    console.log('[Agent] INIT: Scheduling service authentication at startup...');
    this.authenticated = false;
    this.practiceId = null;
    this.context = null;
    this.anthropic = null; // Will be initialized asynchronously

    // Schedule authentication during server startup (non-blocking)
    this.authenticateAtStartup();

    console.log(`[Agent] INIT: ✅ Service initialized with direct API agentic loop`);
    console.log('[Agent] ========== AgentSDKService Constructor Complete ==========');

    // Cache tools to avoid rebuilding on every request
    this.toolsCache = null;
  }

  /**
   * Initialize the Anthropic client with API key from KMS
   * Must be called before using the client
   */
  async initializeAnthropicClient() {
    if (this.anthropic) return; // Already initialized

    console.log('[Agent] INIT: Initializing Anthropic client with KMS key...');
    
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
    console.log('[Agent] INIT: ✅ Anthropic client initialized (Claude Sonnet 5, 1M context)');
  }

  /**
   * Authenticate this service with the global ServiceAccount database
   * This is called at startup to register service permissions
   */
  async authenticateAtStartup() {
    try {
      console.log('[Agent] AUTH: Authenticating agentSDKService with ServiceAccountManager...');

      // Initialize serviceAccountManager if needed
      if (!serviceAccountManager.initialized) {
        console.log('[Agent] AUTH: Initializing ServiceAccountManager...');
        await serviceAccountManager.initialize();
      }

      // Authenticate this service (auto-registers if not found)
      const authResult = await serviceAccountManager.authenticate('agentSDKService');

      if (authResult) {
        this.authenticated = true;
        this.serviceAuth = authResult; // Store auth result with API key
        console.log('[Agent] AUTH: ✅ Successfully authenticated agentSDKService');
        console.log('[Agent] AUTH: Service is now registered in global ServiceAccount database');
      } else {
        console.warn('[Agent] AUTH: ⚠️ Authentication returned null result');
      }
    } catch (error) {
      console.error('[Agent] AUTH: ❌ Authentication failed:', error.message);
      console.error('[Agent] AUTH: Error details:', error.stack?.split('\n').slice(0, 3).join('\n'));
      // Continue anyway - service can still function
    }
  }

  /**
   * Process chat message using agentic loop with direct tool execution
   *
   * The agentic loop works automatically:
   * 1. Claude sees user request + available tools
   * 2. Claude decides which tools to call
   * 3. Backend executes tools directly (no subprocess needed)
   * 4. Claude sees results and decides next action
   * 5. Repeat until Claude generates final response
   *
   * PATIENT CONTEXT PERSISTENCE:
   * - When searchPatientsByName succeeds, patient ID is stored in session.context.currentPatient
   * - On subsequent requests, patient context is retrieved from session and injected into system prompt
   * - Claude doesn't need to re-search for patient, just uses the stored patient ID
   *
   * For example: "Show Helen Cox's lab results and recommendations"
   * - Claude: calls searchPatientsByName("Helen Cox")
   * - Backend: executes immediately, returns patientId, stores in session
   * - User: "show me her medications"
   * - Backend: retrieves patient ID from session, injects into system prompt
   * - Claude: calls getMedications(patientId) without re-searching
   * - Backend: executes immediately, returns labs
   * - Claude: calls getIntelligentRecommendations(patientId)
   * - Backend: executes immediately, returns recommendations
   * - Claude: generates final response with all data
   *
   * @param {string} userMessage - Current user message
   * @param {string} practiceId - Practice ID for data isolation
   * @param {string} language - Language for responses
   * @param {function} onChunk - Callback for streaming updates
   * @param {object} practiceContext - Practice context for SecureDataAccess
   * @param {array} conversationHistory - Previous messages in format [{role: 'user'|'assistant', content: string}]
   * @param {string} sessionId - Chat session ID for patient context persistence
   */
  async processChatMessageWithAgent(userMessage, practiceId, language, onChunk, practiceContext = {}, conversationHistory = [], uploadInfo = null, sessionId = null, conversationSummary = '', requestPatientId = null) {
    if (process.env.QUIET_LOGS !== 'true') console.log('[Agent] ========== STARTING AGENTIC LOOP SESSION ==========');
    if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] User Message: "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}"`);
    if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] Practice: ${practiceId}, Language: ${language}, SessionID: ${sessionId}`);

    // CRITICAL: Ensure authentication completes before processing request
    if (!this.authenticated || !this.serviceAuth) {
      console.log('[Agent] AUTH: ⏳ Waiting for authentication to complete...');
      // Wait up to 5 seconds for authentication
      for (let i = 0; i < 50; i++) {
        if (this.authenticated && this.serviceAuth) {
          console.log('[Agent] AUTH: ✅ Authentication complete, proceeding with request');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // If still not authenticated, try one more time synchronously
      if (!this.authenticated || !this.serviceAuth) {
        console.log('[Agent] AUTH: ⚠️ Authentication not complete, attempting synchronous auth...');
        await this.authenticateAtStartup();
      }

      // Final check
      if (!this.authenticated || !this.serviceAuth) {
        throw new Error('Service authentication failed - cannot process request');
      }
    }

    // CRITICAL: Initialize Anthropic client if not already done
    if (!this.anthropic) {
      try {
        await this.initializeAnthropicClient();
      } catch (error) {
        console.error('[Agent] INIT: ❌ Failed to initialize Anthropic client:', error.message);
        throw new Error('Failed to initialize AI client: ' + error.message);
      }
    }

    // Store practice context for executeTool
    this.practiceId = practiceId;
    // Per-request context built as a LOCAL const and threaded explicitly (to executeTool + the
    // session I/O below). agentSDKService is a process-wide singleton, so storing request state on
    // `this` is race-prone under concurrency: a request for a DIFFERENT practice can overwrite
    // this.context between awaits, and tool execution / patient-context I/O would then run under the
    // wrong practiceId. `requestContext` is immune. this.context is retained only as a back-compat fallback.
    const requestContext = {
      serviceId: 'agentSDKService',
      operation: 'agent-function-call',
      apiKey: this.serviceAuth?.sessionToken || this.serviceAuth?.apiKey || this.serviceAuth?.token,
      practiceId: practiceId,
      practiceSubdomain: practiceId,
      // Propagate user data from route's practiceContext for RBAC and permission requests
      currentUser: practiceContext?.currentUser || null,
      user: practiceContext?.user || null
    };
    this.context = requestContext;

    // Dedicated context for patient-memory recall/write. Captured NOW (this.context lives on a
    // process-wide singleton; a concurrent request can overwrite it during the awaits below).
    // Uses 'agent-route' — a registered system service — so patient_agent_memory access is
    // guaranteed without a ServiceAccount migration.
    const memServiceContext = {
      serviceId: 'agent-route',
      operation: 'patient-memory',
      practiceId: practiceId,
      practiceSubdomain: practiceId,
    };

    try {
      // Send initial thinking message
      // REMOVED: onChunk before Stage 1 - it corrupts the JSON response
      // Stage 1 must execute silently and return clean JSON array
      // Streaming status messages should only happen during Stage 2 execution

      // if (onChunk) {
      //   onChunk({
      //     type: 'thinking',
      //     content: language === 'he'
      //       ? '🧠 מנתח את בקשתך...'
      //       : '🧠 Analyzing your request...'
      //   });
      // }

      /**
       * Extract action context from last assistant message
       * Looks for "I CAN:" or action list patterns and extracts action items
       * This helps Stage 1 understand what "do it all" means
       */
      const extractActionContext = (conversationHistory) => {
        if (!conversationHistory || conversationHistory.length === 0) return null;

        // Get last assistant message
        const lastAssistant = [...conversationHistory]
          .reverse()
          .find(msg => msg.role === 'assistant');

        if (!lastAssistant) return null;

        // Extract text content from message (handle both string and array formats)
        let content = '';
        if (typeof lastAssistant.content === 'string') {
          content = lastAssistant.content;
        } else if (Array.isArray(lastAssistant.content)) {
          // Concatenate all text blocks (skip tool_use blocks)
          content = lastAssistant.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');
        }

        if (!content) return null;

        // Look for action lists (numbered, bulleted, or "I CAN:" format)
        const actions = [];

        // Pattern 1: "I CAN:" followed by list items
        const iCanMatch = content.match(/I (?:CAN|can help you|can):\s*\n([\s\S]*?)(?:\n\n|$)/i);
        if (iCanMatch) {
          const listText = iCanMatch[1];
          const lines = listText.split('\n')
            .map(line => line.replace(/^[•\-\d]+[\.\)]\s*/, '').trim())
            .filter(line => line.length > 0);
          actions.push(...lines);
        }

        // Pattern 2: Numbered or bulleted lists
        if (actions.length === 0) {
          const listPattern = /^[\s\t]*[•\-\d]+[\.\)]\s+(.+)$/gm;
          let match;
          while ((match = listPattern.exec(content)) !== null) {
            actions.push(match[1].trim());
          }
        }

        return actions.length > 0 ? actions : null;
      };

      // ========================================================================
      // TOOL SELECTION: Tool Search (Native Anthropic) OR Two-Stage Selector
      // ========================================================================
      // Tool Search (November 2025): Native Anthropic feature for dynamic tool discovery
      // - All tools sent to Claude with defer_loading: true (except CORE_TOOLS)
      // - Claude uses regex to search and discover tools on-demand
      // - Scales to 10,000+ tools without consuming context window
      // - See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
      //
      // Two-Stage Selector (Legacy): Custom implementation
      // - Stage 1: Send function names to Claude for selection
      // - Stage 2: Send full definitions of selected functions only
      // ========================================================================

      const functionRegistry = require('./functionRegistry');
      if (!functionRegistry.initialized) {
        await functionRegistry.initialize();
      }

      const useToolSearch = functionRegistry.isToolSearchEnabled();
      if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] ========== TOOL SELECTION: ${useToolSearch ? 'TOOL SEARCH (Native)' : 'TWO-STAGE SELECTOR'} ==========`);

      // ========================================================================
      // LEGACY: Two-Stage Selector (commented out, preserved for rollback)
      // ========================================================================
      // const claudeTwoStageSelector = require('./claudeTwoStageSelector');

      // Extract action context from conversation history (used by both methods)
      const previousActions = extractActionContext(conversationHistory);
      if (previousActions && previousActions.length > 0) {
        console.log(`[Agent] 📋 Extracted ${previousActions.length} previous actions for context:`, previousActions);
      }

      // Variable to hold selected tools (populated by either Tool Search or Two-Stage Selector)
      let selectedTools = [];

      // Variables for CSV upload handling (used by both Tool Search and Two-Stage Selector)
      // Moved outside the if/else block so they're accessible for CSV history clearing logic
      let csvType = null;
      let csvError = null;
      let extractedUploadId = null;
      let uploadFileNames = [];

      // Extract uploadId from message if present
      const uploadIdMatchStage1 = userMessage.match(/\[UPLOAD_ID:([^\]]+)\]/);
      if (uploadIdMatchStage1) {
        extractedUploadId = uploadIdMatchStage1[1];
      }

      // Get file names AND csvType from uploadInfo (current request) or conversation history
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 [Agent] uploadInfo received:`, uploadInfo ? JSON.stringify(uploadInfo) : 'null');

      if (uploadInfo && uploadInfo.fileNames) {
        // Use uploadInfo from current request (most reliable)
        uploadFileNames = Array.isArray(uploadInfo.fileNames) ? uploadInfo.fileNames : [uploadInfo.fileNames];
        csvType = uploadInfo.csvType || null;  // Get csvType from uploadInfo
        csvError = uploadInfo.csvError || null;  // Get csvError if present
        if (process.env.QUIET_LOGS !== 'true') console.log(`📎 [Agent] Using uploadInfo fileNames: ${uploadFileNames.join(', ')}, csvType: ${csvType}`);
        if (csvError) {
          console.log(`❌ [Agent] CSV Error: ${csvError.error} - ${csvError.message}`);
        }
      } else if (Array.isArray(conversationHistory)) {
        // Fallback: Extract file names from conversation history metadata
        const recentMessages = conversationHistory.slice(-5);
        for (const msg of recentMessages) {
          if (msg.metadata?.uploadContext?.uploadId === extractedUploadId) {
            uploadFileNames = msg.metadata.uploadContext.fileNames || [];
            csvType = msg.metadata.uploadContext.csvType || null;
            csvError = msg.metadata.uploadContext.csvError || null;
            if (process.env.QUIET_LOGS !== 'true') console.log(`📎 [Agent] Using conversation history fileNames: ${uploadFileNames.join(', ')}, csvType: ${csvType}`);
            break;
          }
        }
      }

      if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 [Agent] Final uploadFileNames:`, uploadFileNames, `csvType:`, csvType);

      if (useToolSearch) {
        // ========================================================================
        // TOOL SEARCH IMPLEMENTATION (November 2025)
        // ========================================================================
        // Native Anthropic feature - Claude discovers tools dynamically via regex search
        // All tools are sent with defer_loading: true (except CORE_TOOLS)
        // Claude searches for relevant tools when needed, dramatically reducing token usage
        // See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
        // ========================================================================

        console.log(`[Agent] 🔍 TOOL SEARCH MODE: Loading ALL tools with defer_loading`);

        // Get ALL tools from registry (they already have defer_loading: true set in convertToClaudeFormat)
        const allTools = functionRegistry.getAllFunctions('claude');
        console.log(`[Agent] 📦 Loaded ${allTools.length} total tools (${functionRegistry.getStats().coreFunctionsCount} core + ${functionRegistry.getStats().functionsWithDeferLoading} deferred)`);

        // Add the Tool Search tool FIRST (it must NOT have defer_loading)
        const toolSearchTool = functionRegistry.getToolSearchTool();
        console.log(`[Agent] 🔎 Adding ${toolSearchTool.type} (${toolSearchTool.name}) for dynamic tool discovery`);

        // NOTE: code_execution is NOT added in Tool Search mode because:
        // 1. allowed_callers is incompatible with defer_loading/tool_search (see functionRegistry.js)
        // 2. Without allowed_callers, code_execution has no programmatic calling benefit
        // 3. Combining tool_search + code_execution triggers Anthropic API bug
        //    (use_web_search_purpose extra input error on configurations)
        // code_execution IS still used in the non-tool-search path below where allowed_callers is set.

        // Build final tools array: tool_search + all medical tools
        selectedTools = [toolSearchTool, ...allTools];

        // NOTE: Do NOT add cache_control to tools when using Tool Search!
        // Tools with defer_loading: true CANNOT have cache_control set.
        // Anthropic error: "Tool 'X' cannot have both defer_loading=true and cache_control set"
        // Prompt caching is still enabled on the system message (line 923).

        console.log(`[Agent] ✅ Tool Search ready with ${selectedTools.length} tools (most deferred until discovered)`);

      } else {
        // ========================================================================
        // TWO-STAGE SELECTOR (Legacy - preserved for rollback)
        // ========================================================================
        // Custom implementation: Stage 1 selects function names, Stage 2 gets full definitions
        // ========================================================================

        console.log(`[Agent] 📋 TWO-STAGE SELECTOR MODE: Using legacy function selection`);

        const claudeTwoStageSelector = require('./claudeTwoStageSelector');

        // Build messages array for selector (filter out assistant messages to avoid confusion)
        // CRITICAL: Assistant messages contain conversational responses that make Claude think
        // it should continue conversing instead of selecting functions. Only include user messages
        // for context (to understand references like "them", "those", "the patient").
        const selectorMessages = [
          ...(conversationHistory || [])
            .filter(msg => msg.role === 'user')  // Only user messages for context
            .slice(-3),  // Last 3 user messages to avoid token bloat
          { role: 'user', content: userMessage }
        ];

        // NOTE: csvType, csvError, extractedUploadId, uploadFileNames are now declared
        // OUTSIDE the if/else block (lines 273-312) so they're accessible to both
        // Tool Search and Two-Stage Selector paths, and for CSV history clearing logic

        // Fast-path: Detect "do all" pattern with previous actions
        // If user says "do it all" and we have previous action context, we can optimize
        let fastPathDetected = false;
        if (previousActions && previousActions.length > 0) {
          const doAllPattern = /^(do|execute|apply|perform|run)\s+(it|them|these|those|that|everything)\s+(all)?/i;
          if (doAllPattern.test(userMessage.trim())) {
            console.log(`[Agent] 🚀 Fast path: "do all" pattern detected with ${previousActions.length} previous actions`);
            console.log(`[Agent] Previous actions:`, previousActions.join(', '));
            fastPathDetected = true;
            // Note: We still call Stage 1 but it now has the context to map actions to functions
          }
        }

        const selectionResult = await claudeTwoStageSelector.selectFunctions(
          selectorMessages,
          {
            language,
            practiceContext,
            uploadId: extractedUploadId,
            fileNames: uploadFileNames,
            csvType: csvType,
            csvError: csvError,
            previousActions,  // Pass action context for "do it all" handling
            fastPathDetected  // Signal that this is a "do all" request
          }
        );

        // CRITICAL: Check if Stage 1 returned a conversational response (not function selection)
        if (selectionResult && typeof selectionResult === 'object' && selectionResult.isConversational) {
          console.log(`[Agent] 💬 CONVERSATIONAL MODE: Using Stage 1 response directly (no Stage 2 needed)`);
          const conversationalAnswer = selectionResult.conversationalResponse;

          // Send the response directly to user
          if (onChunk) {
            onChunk({
              type: 'chunk',
              content: conversationalAnswer
            });
            onChunk({
              type: 'done',
              data: {
                success: true,
                message: conversationalAnswer
              }
            });
          }

          return {
            success: true,
            message: conversationalAnswer,
            response: conversationalAnswer
          };
        }

        // selectionResult is the array of selected tool definitions (already complete)
        selectedTools = Array.isArray(selectionResult) ? selectionResult : [];
        const selectedFunctionNames = selectedTools.map(tool => tool.name);
        console.log(`[Agent] 🎯 Stage 1 selected ${selectedFunctionNames.length} functions: ${selectedFunctionNames.join(', ')}`);
        console.log(`[Agent] 🔍 Tool names that will be available in Stage 2:`, selectedFunctionNames);

        // If no tools selected, use fallback
        if (selectedTools.length === 0) {
          console.warn(`[Agent] ⚠️ No functions selected, defaulting to basic set`);
          selectedTools = functionRegistry.getFunctions(['searchPatientsByName', 'getPatientDetails', 'getMedications'], 'claude');
        }

        // Add cache_control to last tool for prompt caching
        if (selectedTools.length > 0) {
          selectedTools[selectedTools.length - 1].cache_control = { type: 'ephemeral' };
        }

        // ADD CODE_EXECUTION TOOL for Programmatic Tool Calling (November 2025)
        // This enables Claude to write Python code that calls tools - forces execution, prevents hallucination
        // All medical tools have allowed_callers: ["code_execution_20260120"] so they MUST be called from code
        // Claude writes: result = await getMedications(patientId="...") - cannot skip
        // See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling
        const codeExecutionTool = {
          type: "code_execution_20260120",
          name: "code_execution"
        };

        // Prepend code_execution tool to the tools array (must be first for proper execution)
        selectedTools = [codeExecutionTool, ...selectedTools];
        console.log(`[Agent] 🐍 Added code_execution tool for programmatic calling (${selectedTools.length} total tools)`);
      }

      if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] ✅ Using ${selectedTools.length} tool definitions for execution`);

      // Initialize conversation messages with history (if provided)
      // CRITICAL: Start with previous conversation context so Claude understands multi-turn conversations
      if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] DEBUG: conversationHistory param type: ${typeof conversationHistory}, length: ${conversationHistory?.length || 0}`);
      if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] DEBUG: conversationHistory is array? ${Array.isArray(conversationHistory)}`);
      if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] DEBUG: conversationHistory value: ${JSON.stringify(conversationHistory).substring(0, 200)}`);

      // CONVERSATION HISTORY WINDOWING (replaces the legacy 20-message cap).
      // The old `slice(-20)` was a 200K-context-era safeguard. We are now on the 1M-token
      // context window, so window by ESTIMATED TOKENS instead of a fixed message count:
      // keep as many of the MOST-RECENT messages as fit under HISTORY_INPUT_BUDGET_TOKENS,
      // leaving headroom for tools + the model's response + (Phase 2) a compaction summary.
      // If the whole conversation fits, we send all of it (the 1M-context win). If it does not,
      // we keep the most-recent window that fits; Phase 2 (conversationCompactionService) will
      // summarize the deferred older turns instead of dropping them.
      const HISTORY_INPUT_BUDGET_TOKENS = parseInt(process.env.HISTORY_INPUT_BUDGET_TOKENS, 10) || 500000;
      const estimateHistoryTokens = (val) => Math.ceil(JSON.stringify(val ?? '').length / 4);

      let limitedHistory = Array.isArray(conversationHistory) ? conversationHistory : [];
      if (limitedHistory.length > 0) {
        let runningTokens = 0;
        const windowed = [];
        // Walk newest → oldest, accumulating tokens until the budget is reached.
        // The `windowed.length > 0` guard guarantees we always keep at least the most-recent
        // message, even if it alone exceeds the budget (the per-loop 980K guard is the final net).
        for (let i = limitedHistory.length - 1; i >= 0; i--) {
          const msgTokens = estimateHistoryTokens(limitedHistory[i]);
          if (windowed.length > 0 && runningTokens + msgTokens > HISTORY_INPUT_BUDGET_TOKENS) {
            const deferred = i + 1;
            console.log(`⚠️  Conversation history windowed by tokens: kept ${windowed.length} most-recent messages (~${runningTokens.toLocaleString()} tok), deferred ${deferred} older messages (Phase 2 compaction will summarize these)`);
            break;
          }
          runningTokens += msgTokens;
          windowed.unshift(limitedHistory[i]);
        }
        limitedHistory = windowed;
        if (process.env.QUIET_LOGS !== 'true') {
          console.log(`[Agent] History window: ${limitedHistory.length}/${(conversationHistory || []).length} messages, ~${runningTokens.toLocaleString()} est. tokens (budget ${HISTORY_INPUT_BUDGET_TOKENS.toLocaleString()})`);
        }
      }

      // CRITICAL: Filter conversation history to remove tool_use/tool_result blocks for tools NOT in selectedTools
      // This prevents Claude from hallucinating calls to tools that aren't available in current context
      const selectedToolNames = selectedTools.map(t => t.name);
      const filteredHistory = limitedHistory.map(msg => {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          // Filter out tool_use blocks that aren't in selectedTools
          // Also filter out server_tool_use blocks (tool search) - they should not be in history
          const filteredContent = msg.content.filter(block => {
            if (block.type === 'tool_use') {
              return selectedToolNames.includes(block.name);
            }
            // CRITICAL FIX (December 2025): Filter out server_tool_use blocks (tool search)
            // These are server-side tools that should not be replayed in conversation history
            if (block.type === 'server_tool_use') {
              return false;
            }
            return true; // Keep text and thinking blocks
          });
          return { ...msg, content: filteredContent };
        } else if (msg.role === 'user' && Array.isArray(msg.content)) {
          // Filter out tool_result blocks that aren't in selectedTools
          // CRITICAL FIX (December 2025): Also sanitize tool_search_tool_result blocks
          // The API rejects error_message field in tool_search_tool_result_error content
          const filteredContent = msg.content.filter(block => {
            // CRITICAL FIX (December 7, 2025): Filter out tool_search_tool_result blocks entirely
            // These are the RESPONSE blocks from Tool Search - they have type 'tool_search_tool_result'
            // The API rejects error_message field inside RequestToolSearchToolResultError content
            // Error path: tool_search_tool_result.content.RequestToolSearchToolResultError.error_message
            if (block.type === 'tool_search_tool_result') {
              return false; // Remove ALL tool search result blocks from history
            }
            if (block.type === 'tool_result') {
              // Check if this is a tool_search result - filter it out entirely
              // Tool search results contain tool_reference blocks that can cause issues when replayed
              if (block.content && Array.isArray(block.content)) {
                const hasToolReference = block.content.some(c => c.type === 'tool_reference');
                if (hasToolReference) {
                  return false; // Remove tool_reference results from history
                }
              }
              // Check if content is a tool_search_tool_result_error object
              if (block.content && typeof block.content === 'object' && !Array.isArray(block.content)) {
                if (block.content.type === 'tool_search_tool_result_error') {
                  return false; // Remove tool search errors from history
                }
              }
              // Check if this tool_result corresponds to a tool in selectedTools
              // We need to check the tool name from the previous assistant message
              // For now, keep all tool_results but this could be refined
              return true;
            }
            return true; // Keep text blocks
          });
          return { ...msg, content: filteredContent };
        }
        return msg;
      }).filter(msg => {
        // Remove messages with empty content arrays
        if (Array.isArray(msg.content) && msg.content.length === 0) {
          return false;
        }
        return true;
      });

      // PATIENT CONTEXT RETRIEVAL: Retrieve patient context from chat session (NEW APPROACH)
      // This is more reliable than parsing conversation history strings
      let currentPatient = null;

      // STEP 1: Try to retrieve patient context from session database
      if (sessionId) {
        try {
          const SecureDataAccess = require('./secureDataAccess');
          const sessions = await SecureDataAccess.query(
            'chat_sessions',
            { sessionId: sessionId },
            { limit: 1 },
            requestContext  // request-local context (race-safe on the singleton)
          );

          if (sessions && sessions.length > 0 && sessions[0].context?.currentPatient) {
            currentPatient = sessions[0].context.currentPatient;
            console.log(`✅ [PATIENT CONTEXT] Retrieved from session: ${currentPatient.name} (${currentPatient.patientId})`);
          } else {
            console.log(`⚠️  [PATIENT CONTEXT] No patient context found in session ${sessionId}`);
          }
        } catch (error) {
          console.error(`❌ [PATIENT CONTEXT] Failed to retrieve session:`, error.message);
        }
      }

      // STEP 2: FALLBACK - Try to extract from conversation history if session retrieval failed
      if (!currentPatient) {
        console.log(`🔍 [Agent] DEBUG: Fallback - Searching for patient context in ${limitedHistory.length} history messages`);

      // Search backwards through conversation history for most recent patient context
      // NOTE: Conversation history comes as STRING content (flattened from database), not structured arrays
      for (let i = limitedHistory.length - 1; i >= 0; i--) {
        const msg = limitedHistory[i];

        // Skip if no content
        if (!msg.content) continue;

        // Content is a string - parse it to look for patient data
        const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

        // Look for patient ID patterns in the content (MongoDB ObjectId = 24 hex chars)
        // Pattern 1: Explicit patient search result with patient details
        const patientMatch = contentStr.match(/"patientId"\s*:\s*"([0-9a-f]{24})"/i) ||
                            contentStr.match(/"_id"\s*:\s*"([0-9a-f]{24})"/i);

        if (patientMatch) {
          const patientId = patientMatch[1];

          // Try to extract patient name from same content
          const firstNameMatch = contentStr.match(/"firstName"\s*:\s*"([^"]+)"/i);
          const lastNameMatch = contentStr.match(/"lastName"\s*:\s*"([^"]+)"/i);

          if (firstNameMatch || lastNameMatch) {
            const firstName = firstNameMatch ? firstNameMatch[1] : '';
            const lastName = lastNameMatch ? lastNameMatch[1] : '';
            const fullName = `${firstName} ${lastName}`.trim();

            if (fullName) {
              currentPatient = {
                patientId: patientId,
                name: fullName
              };
              console.log(`🔍 [Agent] PATIENT CONTEXT FOUND: ${currentPatient.name} (${currentPatient.patientId})`);
              break; // Found most recent patient context
            }
          }

          // If we found a patient ID but no name, still use it
          if (!currentPatient) {
            currentPatient = {
              patientId: patientId,
              name: 'Unknown Patient'
            };
            console.log(`🔍 [Agent] PATIENT CONTEXT FOUND: Patient ID ${currentPatient.patientId}`);
            break;
          }
        }
      }

        if (!currentPatient) {
          console.log(`⚠️  [Agent] No patient context found in conversation history (fallback failed)`);
        }
      } // End of fallback block

      // Resolve which patient to recall/write memory for: prefer the session-resolved patient,
      // else the patientId the frontend sent (open artifact panel) so memory loads on TURN 1 of a
      // brand-new conversation — before the agent has run searchPatientsByName.
      const isHex24 = (v) => typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v);
      const memoryPatientId = currentPatient?.patientId || (isHex24(requestPatientId) ? requestPatientId : null);

      // PATIENT MEMORY RECALL (Phase 5): auto-load durable cross-conversation memory for this
      // patient and inject it into the (cached) system prompt. Soft context only — the block's
      // guardrail tells the model to re-fetch clinical values via tools. Never breaks the chat.
      let patientMemoryBlock = '';
      let midTurnMemoryDone = false; // guard: turn-0 mid-turn recall (after searchPatientsByName) runs at most once
      if (memoryPatientId) {
        try {
          const patientMemoryService = require('./patientMemoryService');
          const { items, block } = await patientMemoryService.recallBlock({
            context: memServiceContext,
            patientId: memoryPatientId,
            patientName: currentPatient?.name
          });
          patientMemoryBlock = block;
          if (items.length > 0) console.log(`🧠 [PatientMemory] Recalled ${items.length} memory item(s) for ${currentPatient?.name || memoryPatientId}`);
        } catch (memErr) {
          console.error(`⚠️ [PatientMemory] Recall skipped: ${memErr.message}`);
        }
      }

      // CRITICAL: For CSV imports, CLEAR ALL HISTORY to prevent tool hallucination
      // Claude was calling analyzeUploadedDocuments even when only importPatientsFromCSV was available
      // because conversation history mentioned batch processing
      let messages = [];

      if (csvType === 'patients' || csvType === 'users') {
        console.log(`🗑️  [Agent] CLEARING conversation history for CSV import (csvType: ${csvType})`);
        console.log(`🗑️  [Agent] This prevents Claude from hallucinating analyzeUploadedDocuments calls`);
        // Start fresh - no history
        messages = [];
      } else {
        // Use filtered history for non-CSV uploads
        messages = [...filteredHistory];

        // Log conversation history being used
        if (limitedHistory.length > 0) {
          if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] Using ${limitedHistory.length} messages from chat history`);
          if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] History includes: ${limitedHistory.map((m, i) => `${i+1}.${m.role}`).join(' → ')}`);
        }
      }

      // Add current user message
      messages.push({
        role: 'user',
        content: userMessage
      });

      if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] Total messages for Claude: ${messages.length} (${conversationHistory.length} history + 1 current)`);

      let finalResponse = '';
      let loopCount = 0;
      const maxLoops = 15; // Can handle more loops now that AI collections are skipped (saves ~34K tokens)
      let hasCalledTools = false; // Track if ANY tool has been called in this session
      const toolsExecuted = []; // Track which tools were executed
      const toolResultsForResponse = []; // Track tool results to append to final response for multi-turn context
      let artifactPanelData = []; // Track artifact panel data to pass to frontend (array to accumulate multiple)
      console.log('🔄 [ARTIFACT PANEL] Starting new agentic loop - artifactPanelData reset to empty array');

      // TOKEN BUDGET ENFORCEMENT
      // Reserve tokens for: system (10K) + tools (3K) + response (4K) + buffer (3K) = 20K overhead
      // 1M context window (GA - no beta header required)
      const MAX_CONVERSATION_TOKENS = 980000; // Leave 20K buffer for overhead + Claude response (1M total)
      const OVERHEAD_TOKENS = 20000;

      // Load static system prompt with ALL function names
      const { SYSTEM_PROMPT } = require('./agentSystemPrompt');

      // REMOVED: uploadIdContext logic - claudeTwoStageSelector already handles CSV vs PDF detection
      // and selects the correct function (importPatientsFromCSV vs analyzeUploadedDocuments)
      // Adding instructions here creates conflicts and overrides the two-stage selector's decisions

      // Build system prompt with patient context if available
      let patientContextBlock = '';
      if (currentPatient) {
        patientContextBlock = `

🔍 CURRENT PATIENT CONTEXT (from previous conversation):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Patient Name: ${currentPatient.name}
Patient ID: ${currentPatient.patientId}
${currentPatient.dob ? `DOB: ${currentPatient.dob}` : ''}
${currentPatient.mrn ? `MRN: ${currentPatient.mrn}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL INSTRUCTIONS FOR THIS PATIENT:
1. You are CURRENTLY working with ${currentPatient.name}
2. Their patient ID is: ${currentPatient.patientId}
3. When the user says "${currentPatient.name}" or "this patient" or "their", they mean patient ID ${currentPatient.patientId}
4. DO NOT call searchPatientsByName again unless the user asks about a DIFFERENT patient
5. USE THIS PATIENT ID: ${currentPatient.patientId} for all medical data queries
6. When user asks "show vital signs" or "get medications", use patientId: "${currentPatient.patientId}"

THINKING PROCESS FOR PATIENT-SPECIFIC REQUESTS:
- User says: "Show me vital signs" → Use getVitalSigns(patientId: "${currentPatient.patientId}")
- User says: "Get medications" → Use getMedications(patientId: "${currentPatient.patientId}")
- User says: "Show lab results" → Use getLabResults(patientId: "${currentPatient.patientId}")
- User refers to "${currentPatient.name}" → Always use patientId: "${currentPatient.patientId}"

`;
      }

      // Add current date/time to system prompt in practice's local timezone
      // Get practice timezone from context (defaults to UTC if not available)
      const practiceTimezone = practiceContext?.timezone || 'UTC';
      console.log(`⏰ [AgentSDK] Using practice timezone: ${practiceTimezone} (from practiceContext.timezone: ${practiceContext?.timezone})`);

      // Get current UTC time and format it in practice timezone
      const now = new Date(); // UTC time

      // Format UTC time in practice timezone for display (precise). NOTE: this block is injected
      // AFTER the cache_control breakpoint (as a separate, uncached system block — see apiPayload),
      // per Anthropic's prompt-caching guidance: keep the static prefix cacheable and place the
      // per-request timestamp after the breakpoint so it does not bust the cache.
      const dateString = formatDateInTimezone(now, practiceTimezone, 'date'); // e.g., "11/01/2025"
      const timeString = formatDateInTimezone(now, practiceTimezone, 'time'); // e.g., "06:30:29 AM"
      const fullDateTime = formatDateInTimezone(now, practiceTimezone, 'full'); // e.g., "November 1, 2025 at 06:30:29 AM"

      const currentDateBlock = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ CURRENT DATE & TIME (Practice Local Time)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRACTICE TIMEZONE: ${practiceTimezone}
TODAY'S DATE: ${dateString}
CURRENT TIME: ${timeString}
FULL DATE/TIME: ${fullDateTime}

IMPORTANT: When scheduling appointments, creating follow-ups, or analyzing time-sensitive data:
- Use ${dateString} as reference for "today" (this is the practice's local date)
- This is ${practiceTimezone} timezone - all times shown to staff are in this timezone
- When user says "schedule for next week", add 7 days to ${dateString}
- When analyzing "recent" data, compare against ${dateString}
- When displaying times to staff, they expect to see ${practiceTimezone} timezone

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      // CONVERSATION SUMMARY (Phase 2 compaction): when older turns were folded into a
      // rolling summary, inject it here as background continuity context. The verbatim
      // `messages` array only contains the RECENT tail. This block lives inside the cached
      // system prompt (same slot as patientContextBlock), so its marginal cost is minimal.
      let conversationSummaryBlock = '';
      if (conversationSummary && conversationSummary.trim()) {
        conversationSummaryBlock = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗜️ EARLIER CONVERSATION SUMMARY (older turns were compacted to save context)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The message list below contains only the MOST RECENT turns of this conversation. Earlier
turns were summarized to stay within the context window. Use this summary as background
context for continuity.

⚠️ This is a SUMMARY, not verbatim data. If you need EXACT prior values (labs, medications,
vitals, doses, IDs), re-fetch them with the appropriate tool rather than relying on this text.

${conversationSummary.trim()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
      }

      const systemPrompt = SYSTEM_PROMPT + patientContextBlock + patientMemoryBlock + conversationSummaryBlock +

`

⛔⛔⛔ CRITICAL OUTPUT FORMATTING RULES ⛔⛔⛔
NEVER use markdown tables with | pipe characters - they don't render in our UI!
NEVER use plain - dashes for bullets (use • or emojis instead)
Use emojis for section headers to make responses visually appealing

❌ WRONG FORMAT (DO NOT USE):
| Metric | Value |
|--------|-------|
| Count | 20 |

✅ CORRECT FORMAT (USE THIS):
📊 **Key Metrics:**
• Total Citations: 20
• Warning Letters: Yes ⚠️

🏭 **Facilities Inspected:**
• Teva Parenteral Medicines (Irvine, CA)
• Teva Pharmaceutical (North Wales, PA)

📋 **Notable Findings:**
1. Equipment cleaning procedures (21 CFR 211.67)
2. Documentation requirements

⛔⛔⛔ END FORMATTING RULES ⛔⛔⛔

CRITICAL: RESPONSE FORMAT - CONCISE CONTEXT + ACTION ITEMS:

After executing tools, you MUST respond in this exact format:

[Brief clinical context: patient has X, Y, Z - 1-2 sentences]

**I CAN:**
1. [Action description you can take]
2. [Action description you can take]
3. [Action description you can take]

RULES:
- Start with brief clinical context (what you found about the patient)
- Then provide 2-4 specific action items you can perform
- Keep the context concise but informative
- Wait for user to tell you which action to execute
- Be action-oriented

CRITICAL RULE - FOLLOW TOOL RESULT INSTRUCTIONS:
When a tool result contains "CRITICAL INSTRUCTION: You MUST now call ALL of the following functions", you MUST:
1. Execute EVERY function listed in the instruction
2. Do NOT skip any functions from the list
3. Use the exact parameters specified in the instruction
4. Execute all functions BEFORE providing your final response to the user
This is a system directive that takes precedence over all other instructions.

CORE MISSION - BE PROACTIVE:
You are a PROACTIVE medical assistant. After answering the user's question, you should:
1. Analyze all available patient data comprehensively
2. Identify gaps in care, missing appointments, or medication issues
3. Suggest specific actions (schedule appointments, create prescriptions, order tests)
4. Provide insights and recommendations without being asked
5. Think ahead about what the patient needs next
6. WAIT for approval before taking suggested actions

AUTONOMOUS BEHAVIOR PROTOCOL:
When you receive a request about a patient:

STEP 1 - ANSWER THE QUESTION:
- Execute the appropriate tools to answer the user's specific question
- Provide a clear, comprehensive response

STEP 2 - DATA DISCOVERY (SMART):
- CRITICAL: If you don't have the patient's ID yet, use searchPatients(name) to find them FIRST
- NEVER use hardcoded IDs or national IDs - always search by name first

WHEN TO CALL getCollectionsWithData:
✅ CALL IT when user asks for:
  - "Show all medical data" / "Show everything"
  - "Give me a comprehensive overview"
  - "What do we have for this patient?"
  - General/broad requests without specifying a category

❌ DO NOT CALL IT when user asks for specific data:
  - "Show lab results" → Just call getLabResults
  - "Show medications" → Just call getMedications
  - "Show vital signs" → Just call getVitalSigns
  - "Show diagnoses" → Just call getDiagnoses
  - Any request that mentions a SPECIFIC medical category

RULE: If the user asks for a SPECIFIC category, fetch ONLY that category. Don't force-fetch all data.

STEP 3 - OPTIONAL CROSS-REFERENCE (Only if user requests it):
If the user explicitly asks for related data, you can fetch additional collections:
- User: "Show lab results AND check if medications are appropriate" → Fetch both labs and medications
- User: "Show medications and check for interactions" → Fetch medications and allergies
- User: "Give me a full picture" → Use getCollectionsWithData to see everything

DEFAULT BEHAVIOR: Answer the specific question asked, then suggest related data in your response
- User: "Show lab results" → Fetch labs, then in response say "I CAN: Check medications for treatment effectiveness, Check if follow-up is scheduled"
- User: "Show medications" → Fetch medications, then suggest "I CAN: Check for drug interactions, Verify prescriptions are current"

RULE: Don't automatically fetch extra data. Let the user choose what they want to see next.

STEP 4 - ANALYZE & IDENTIFY ISSUES:
- Critical findings in lab results → Check if appointment scheduled
- Active medications → Verify prescriptions exist and are current, check for drug interactions
- Diagnoses → Check if proper follow-up care is scheduled, medications match diagnoses
- Missing data → Identify what tests or information are needed
- Data inconsistencies → Flag mismatches between collections (e.g., diagnosis without medication)

STEP 5 - TAKE PROACTIVE ACTIONS:
- If critical lab findings + no follow-up appointment → Suggest scheduling
- If medication needed + no active prescription → Consider creating prescription
- If test results abnormal + no specialist referral → Recommend referral
- If gaps in care identified → Provide specific action items
- If data conflicts found → Alert user and suggest resolution

STEP 6 - COMPREHENSIVE INSIGHTS:
- Synthesize data from MULTIPLE collections into actionable recommendations
- Highlight priorities (urgent vs routine)
- Show connections between different data sources (e.g., "Lab results show high A1C, but no diabetes medication found")
- Provide a care coordination summary
- Suggest next steps for the care team

KEY PROACTIVE FUNCTIONS (use these frequently):
- getCollectionsWithData(patientId) - See ALL data categories available
- getAppointments(patientId) - Check scheduled appointments
- createAppointment(patientId, ...) - Schedule new appointment
- getPrescriptions(patientId) - Review active prescriptions
- createPrescription(patientId, ...) - Write new prescription
- getMedications(patientId) - See current medications
- getIntelligentRecommendations(patientId) - Get AI-generated care recommendations
- getClinicalDecisionSupport(patientId) - Get clinical alerts and decision support

THINKING OUT LOUD:
Share your reasoning process with the user. After each tool execution, explain:
- What you found
- What it means clinically
- What you're checking next
- Why you're taking specific actions

EXAMPLE WORKFLOW FOR SPECIFIC REQUEST:
User: "Show [patient name]'s lab results"

Your thinking process (visible to user):
1. "Let me find this patient in the system..." [Execute searchPatients with name="patient name"]
2. "Found patient (ID: abc123...). Now retrieving lab results..." [Execute getLabResults with patientId]
3. STOP HERE - User asked for lab results only, so don't fetch other data

Your response (concise format):
Russell Hall's November 2025 labs show elevated A1C (8.2%) indicating uncontrolled diabetes, with borderline high cholesterol (LDL 135).

**I CAN:**
1. Check current diabetes medications and prescriptions
2. Verify if follow-up appointment is scheduled
3. Review full medical history for treatment context
4. Get AI-generated clinical decision support

[Wait for user to tell you which action to take]

EXAMPLE WORKFLOW FOR COMPREHENSIVE REQUEST:
User: "Show me everything for [patient name]" OR "Give me complete overview"

Your thinking process:
1. "Let me find this patient..." [Execute searchPatients]
2. "Now checking what data is available..." [Execute getCollectionsWithData with patientId]
3. "I see 10 categories with data. Fetching all..." [Execute all functions listed in getCollectionsWithData result]
2. Schedule follow-up appointment for diabetes management
3. Order additional tests (lipid panel, kidney function)
4. Review complete medication list for potential interactions

**DETAILS:** (only if user requests)

CRITICAL REMINDER: ALWAYS search for patient by name FIRST to get their patientId before calling other functions!

Remember: You are autonomous and proactive. Don't wait to be asked - take initiative to provide complete, actionable medical insights.`;

      // STAGE 2: Tool Execution
      if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] ========== STAGE 2: Tool Execution ==========`);

      // TOKEN TRACKING - Track cumulative tokens across agentic loop
      let cumulativeToolResultTokens = 0;
      const toolResultsByLoop = [];

      // PROGRAMMATIC TOOL CALLING - Container tracking (November 2025)
      // When Claude uses code_execution, Anthropic returns a container.id
      // This container ID MUST be passed in subsequent API calls while code is running
      // See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling
      let containerId = null;

      // Agentic loop
      while (loopCount < maxLoops) {
        loopCount++;

        // TOKEN BUDGET CHECK - Calculate current message token usage
        const messagesJson = JSON.stringify(messages);
        const currentMessageTokens = Math.ceil(messagesJson.length / 4);
        const estimatedTotalTokens = currentMessageTokens + OVERHEAD_TOKENS;

        if (estimatedTotalTokens > MAX_CONVERSATION_TOKENS) {
          console.error(`\n${'='.repeat(70)}`);
          console.error(`⚠️  TOKEN BUDGET EXCEEDED - Stopping agentic loop`);
          console.error(`   Current messages: ${currentMessageTokens.toLocaleString()} tokens`);
          console.error(`   + Overhead: ${OVERHEAD_TOKENS.toLocaleString()} tokens`);
          console.error(`   = Total: ${estimatedTotalTokens.toLocaleString()} tokens`);
          console.error(`   Limit: ${MAX_CONVERSATION_TOKENS.toLocaleString()} tokens`);
          console.error(`   Tools executed so far: ${toolsExecuted.length}`);
          console.error(`${'='.repeat(70)}\n`);
          break;
        }

        // Removed verbose loop logging for clean output
        // console.log(`[Agent] ─────────────────────────────────────`);
        // console.log(`[Agent] Loop #${loopCount}: Calling Claude...`);

        // Build API payload with cache_control on system block
        // System should be an array of blocks, with cache_control on the cacheable block
        const apiPayload = {
          model: 'claude-sonnet-5',  // Sonnet 5 for conversation; supports forced tool use (tool_choice: any) needed for loop 1
          max_tokens: 20000,  // Increased from 4096 to allow longer responses
          // Extended thinking AND high reasoning effort are BOTH incompatible with forced tool_choice (API constraint).
          // Loop 1 forces tools (tool_choice: any) → omit thinking AND output_config so the model reliably executes a tool.
          // Loop 2+ (auto) → adaptive thinking + XHIGH effort for quality medical reasoning (tool-search loop 1 stays unaffected).
          ...(hasCalledTools
            ? { thinking: { type: 'adaptive', display: 'summarized' }, output_config: { effort: 'xhigh' } }
            : {}),
          messages: messages,
          system: [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' }  // Cache breakpoint at END of the static/per-conversation prefix
            },
            {
              // Per-request date/time lives AFTER the cache breakpoint (no cache_control) so its
              // per-second change does NOT invalidate the cached system prefix. Per Anthropic prompt-
              // caching guidance: place variable content after the last breakpoint. Time stays precise.
              type: 'text',
              text: currentDateBlock
            }
          ],
          tools: selectedTools,  // Pass ONLY selected tools (3-8 functions)
          // ANTI-HALLUCINATION: Force tool use on first iteration to prevent fabricated results
          // Once tools have been called, switch to 'auto' so Claude can provide text responses
          tool_choice: hasCalledTools ? { type: 'auto' } : { type: 'any' },  // Loop 1: MUST call tools | Loop 2+: can respond
          // All features now GA (March 2026): tool search, defer_loading, code execution, 1M context
          // No beta headers required
        };

        // CONTAINER ID - Required for multi-turn code execution
        // If we have a container ID from a previous response, include it
        if (containerId) {
          apiPayload.container = containerId;
          console.log(`[Agent] 🐍 Using container ID for code execution continuation: ${containerId}`);
        }

        // Debug logging for tool availability (tool count only, not full list)
        if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] Loop #${loopCount}: Sending ${selectedTools.length} tools to Claude`);

        // Streaming API for tool use and code execution (GA - no beta required)
        // RETRY LOGIC: Retry on transient errors (overloaded, api_error, rate_limit) from Anthropic
        // Covers BOTH stream creation AND stream iteration (overloaded can occur during either phase)
        // overloaded_error: retries INDEFINITELY every 30s (Anthropic will recover eventually)
        // api_error/rate_limit_error: retries up to 10 times with exponential backoff then 30s intervals
        const MAX_API_RETRIES = 10; // Only applies to non-overloaded errors
        const RETRYABLE_ERROR_TYPES = ['api_error', 'overloaded_error', 'rate_limit_error'];
        let stream = null;
        let apiRetryCount = 0;

        // Variables to track current content blocks
        let currentThinkingBlock = '';
        let currentTextBlock = '';
        let response = null; // Will hold the final complete response
        // Track text streamed before a retry so we don't duplicate on retry
        let textStreamedBeforeRetry = '';

        while (true) { // Exit via break (success) or throw (non-retryable/max retries)
          try {
            stream = await this.anthropic.messages.stream(apiPayload);

            // Reset accumulators for each attempt
            currentThinkingBlock = '';
            currentTextBlock = '';
            response = null;
            textStreamedBeforeRetry = finalResponse; // snapshot before streaming

            // Process stream events in real-time
            for await (const event of stream) {
              if (event.type === 'content_block_start') {
                // New content block starting
                if (event.content_block?.type === 'thinking') {
                  currentThinkingBlock = '';
                } else if (event.content_block?.type === 'text') {
                  currentTextBlock = '';
                }
              } else if (event.type === 'content_block_delta') {
                // Incremental content within a block
                if (event.delta?.type === 'thinking_delta') {
                  // Accumulate thinking
                  currentThinkingBlock += event.delta.thinking;
                } else if (event.delta?.type === 'text_delta') {
                  // Stream text token-by-token
                  const textChunk = event.delta.text;
                  currentTextBlock += textChunk;
                  finalResponse += textChunk;

                  // Send text chunk immediately to frontend
                  if (onChunk) {
                    onChunk({
                      type: 'chunk',
                      content: textChunk
                    });
                  }
                }
              } else if (event.type === 'content_block_stop') {
                // Content block complete - send full thinking blocks.
                // display:'summarized' routes reasoning through Anthropic's summarizer, which
                // occasionally leaks its own meta-commentary on trivial chunks - drop those
                // (and degenerate fragments) before showing the user. See utils/sanitizeThinking.js.
                if (currentThinkingBlock && onChunk && isDisplayableThinking(currentThinkingBlock)) {
                  onChunk({
                    type: 'thinking',
                    content: currentThinkingBlock
                  });
                }
                // Reset accumulators
                currentThinkingBlock = '';
                currentTextBlock = '';
              } else if (event.type === 'message_stop') {
                // Message complete - get final response
                response = await stream.finalMessage();
              }
            }

            break; // Success - exit retry loop
          } catch (apiError) {
            apiRetryCount++;

            // Rollback any partial text streamed during this failed attempt
            if (finalResponse !== textStreamedBeforeRetry) {
              finalResponse = textStreamedBeforeRetry;
            }

            // Check if it's a retryable error type
            let isRetryableError = false;
            let errorType = 'unknown';
            try {
              // Strip HTTP status code prefix if present (e.g., "400 {...}" → "{...}")
              const jsonStr = apiError.message?.replace(/^\d{3}\s+/, '') || '';
              const errorJson = JSON.parse(jsonStr);
              errorType = errorJson?.error?.type || 'unknown';
              isRetryableError = RETRYABLE_ERROR_TYPES.includes(errorType);
            } catch (e) {
              // Check if error message contains any retryable error type
              isRetryableError = RETRYABLE_ERROR_TYPES.some(type => apiError.message?.includes(type))
                || apiError.message?.includes('500')
                || apiError.message?.includes('overloaded')
                || apiError.message?.includes('Overloaded');
              if (isRetryableError) {
                errorType = apiError.message?.includes('overloaded') || apiError.message?.includes('Overloaded')
                  ? 'overloaded_error'
                  : 'api_error';
              }
            }

            // overloaded_error: retry indefinitely every 30s (Anthropic will recover)
            // other retryable errors: retry up to MAX_API_RETRIES times
            const isOverloaded = errorType === 'overloaded_error';
            const withinRetryLimit = isOverloaded || apiRetryCount < MAX_API_RETRIES;

            if (isRetryableError && withinRetryLimit) {
              // overloaded: always 30s. Others: exponential backoff then 30s.
              const backoffMs = isOverloaded
                ? 30000
                : (apiRetryCount <= 3 ? Math.min(2000 * Math.pow(2, apiRetryCount - 1), 8000) : 30000);
              const limitLabel = isOverloaded ? '∞' : MAX_API_RETRIES;
              console.log(`🔄 [Agent] ${errorType} (attempt ${apiRetryCount}/${limitLabel}) - retrying in ${backoffMs / 1000}s...`);
              if (onChunk) {
                onChunk({ type: 'chunk', content: `\n\n⏳ Service temporarily busy, retrying (attempt ${apiRetryCount})...\n\n` });
              }
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              continue;
            } else {
              // Not a retryable error or max retries reached for non-overloaded errors
              if (apiRetryCount >= MAX_API_RETRIES) {
                console.error(`❌ [Agent] Max API retries (${MAX_API_RETRIES}) reached for ${errorType} - giving up`);
              }
              throw apiError;
            }
          }
        }

        // CONTAINER ID EXTRACTION - For programmatic tool calling
        // When Claude uses code_execution, response includes container.id
        // This MUST be passed in subsequent calls for code execution to continue
        if (response.container?.id) {
          containerId = response.container.id;
          console.log(`[Agent] 🐍 Container ID extracted: ${containerId} (expires: ${response.container.expires_at})`);
        }

        // Log cache usage for this call (commented out for clean logs)
        // const usage = response.usage || {};
        // console.log(`[Agent] Loop #${loopCount}: Claude responded with stop_reason=${response.stop_reason}`);
        // console.log(`[Agent] Loop #${loopCount}: Token usage - Input: ${usage.input_tokens}, Cache Read: ${usage.cache_read_input_tokens || 0}, Cache Write: ${usage.cache_creation_input_tokens || 0}`);

        // Note: Text was already streamed above, but we still need to check for tool_use blocks
        // Process response.content to find tool_use blocks
        for (let i = 0; i < response.content.length; i++) {
          const block = response.content[i];

          if (block.type === 'tool_use') {
            // Removed verbose tool call logs for clean output (function list shown before execution)
            // console.log(`[Agent]   → Tool call: ${block.name}(${JSON.stringify(block.input).substring(0, 60)})`);
          }
        }

        // Check if Claude wants to use tools
        if (response.stop_reason === 'tool_use') {
          // Removed verbose loop logging for clean output
          // console.log(`[Agent] Loop #${loopCount}: Claude wants to use tools, executing...`);

          // Strip cache_control and parsed/parsed_output from response content to prevent API errors
          // Anthropic API returns these fields in response.content blocks but rejects them on input:
          // - cache_control: accumulates across loops → "maximum 4 blocks with cache_control" error
          // - parsed/parsed_output: added by SDK → "text.parsed: Extra inputs are not permitted" error
          // NOTE: Use Object.keys iteration instead of destructuring to avoid triggering deprecation warnings
          const contentWithoutCache = response.content.map(block => {
            const cleanBlock = {};
            for (const key of Object.keys(block)) {
              if (key !== 'cache_control' && key !== 'parsed' && key !== 'parsed_output') {
                cleanBlock[key] = block[key];
              }
            }
            return cleanBlock;
          });

          // Add Claude's response to messages (with all content blocks)
          messages.push({
            role: 'assistant',
            content: contentWithoutCache
          });

          // Execute tools and collect results
          const toolResults = [];

          // ANSI color codes for beautiful terminal output
          const colors = {
            reset: '\x1b[0m',
            bright: '\x1b[1m',
            dim: '\x1b[2m',
            cyan: '\x1b[36m',
            yellow: '\x1b[33m',
            green: '\x1b[32m',
            red: '\x1b[31m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            gray: '\x1b[90m',
            white: '\x1b[37m'
          };

          // IMPORTANT: Log which tools Claude selected BEFORE execution
          const toolsToExecute = response.content.filter(b => b.type === 'tool_use');
          if (toolsToExecute.length > 0 && process.env.QUIET_LOGS !== 'true') {
            console.log(`\n${colors.bright}${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
            console.log(`${colors.bright}${colors.cyan}🔧 Claude selected ${toolsToExecute.length} function(s) to execute:${colors.reset}`);
            toolsToExecute.forEach((tool, idx) => {
              const args = JSON.stringify(tool.input).substring(0, 80);
              console.log(`${colors.bright}${colors.yellow}   ${idx + 1}. ${colors.magenta}${tool.name}${colors.reset} ${colors.cyan}(${args}${args.length >= 80 ? '...' : ''})${colors.reset}`);
            });
            console.log(`${colors.bright}${colors.cyan}${'═'.repeat(70)}${colors.reset}\n`);
          }

          // Text blocks have already been streamed token-by-token above (lines 850-858)
          // NO need to send them again here - that causes duplication
          // The streaming loop already sent text as it arrived in real-time

          // PROGRAMMATIC TOOL CALLING (November 2025)
          // Handle server_tool_use blocks. In Tool Search mode these are
          // tool_search_tool_bm25 invocations (the request contains no
          // code_execution tool); in Two-Stage mode they are programmatic
          // tool calling (allowed_callers: ["code_execution_20260120"]).
          // Logging them distinctly matters: tool searches were previously
          // mislabeled as "CODE EXECUTION", which hid the search activity
          // during debugging (June 12, 2026).
          // See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling
          for (const block of response.content) {
            if (block.type === 'server_tool_use') {
              if (block.name === 'tool_search_tool_bm25' || (block.name || '').startsWith('tool_search')) {
                const query = block.input?.query || JSON.stringify(block.input || {}).substring(0, 120);
                console.log(`\n${colors.bright}${colors.cyan}🔎 TOOL SEARCH:${colors.reset} Claude is searching for tools — query: ${query}`);
              } else {
                // Claude wrote Python code to call tools (Two-Stage mode)
                console.log(`\n${colors.bright}${colors.yellow}🐍 CODE EXECUTION:${colors.reset} Claude is using programmatic tool calling`);
                if (block.input?.code) {
                  console.log(`${colors.dim}${block.input.code.substring(0, 200)}${block.input.code.length > 200 ? '...' : ''}${colors.reset}`);
                }
              }
              // Note: We don't execute these ourselves - Anthropic runs them server-side
              // Code-execution tool_use blocks that follow have caller.type === 'code_execution_20260120'
            }
          }

          for (const block of response.content) {
            if (block.type === 'tool_use') {
              // Log if this tool call came from code execution
              if (block.caller?.type === 'code_execution_20260120') {
                console.log(`${colors.dim}   (Called programmatically from code execution)${colors.reset}`);
              }
              try {
                // Track tool execution
                toolsExecuted.push(block.name);

                // Send thinking message about what we're doing
                // Format tool name for display (e.g., getDrugShortages -> "checking drug shortages")
                const toolDisplayName = block.name
                  .replace(/^get/, 'fetching ')
                  .replace(/^check/, 'checking ')
                  .replace(/^search/, 'searching ')
                  .replace(/([A-Z])/g, ' $1')
                  .toLowerCase()
                  .trim();
                const thinkingMsg = `🔍 ${toolDisplayName.charAt(0).toUpperCase() + toolDisplayName.slice(1)}...`;
                if (process.env.QUIET_LOGS !== 'true') {
                  const args = JSON.stringify(block.input).substring(0, 150);
                  console.log(`\n${colors.bright}${colors.blue}▶️  EXECUTING:${colors.reset} ${colors.bright}${colors.magenta}${block.name}${colors.reset}`);
                  console.log(`${colors.cyan}    Args: ${args}${args.length >= 150 ? '...' : ''}${colors.reset}`);
                }
                if (onChunk) {
                  onChunk({
                    type: 'thinking',
                    content: thinkingMsg
                  });
                }

                const result = await this.executeTool(block.name, block.input, requestContext);

                // CRITICAL: Store patient context in session after successful patient search
                // This ensures Claude remembers the patient ID for subsequent queries without re-searching
                if (block.name === 'searchPatientsByName' && result?.data?.[0]?.patientId) {
                  console.log(`🔍 [PATIENT CONTEXT] searchPatientsByName returned patientId: ${result.data[0].patientId}`);
                  console.log(`🔍 [PATIENT CONTEXT] Patient name: ${result.data[0].name}`);

                  // Store patient context in chat session using SecureDataAccess
                  try {
                    const SecureDataAccess = require('./secureDataAccess');
                    await SecureDataAccess.update(
                      'chat_sessions',
                      { sessionId: sessionId },
                      {
                        $set: {
                          'context.currentPatient': {
                            patientId: result.data[0].patientId,
                            name: result.data[0].name,
                            firstName: result.data[0].firstName,
                            lastName: result.data[0].lastName,
                            lastUpdated: new Date()
                          }
                        }
                      },
                      requestContext  // request-local context (race-safe on the singleton)
                    );
                    console.log(`✅ [PATIENT CONTEXT] Stored patient context in session ${sessionId}`);
                  } catch (error) {
                    console.error(`❌ [PATIENT CONTEXT] Failed to store patient context:`, error.message);
                  }

                  // TURN-0 CROSS-REFERENCE FIX: on a cold conversation the patient is only identified
                  // now (mid-turn) — AFTER the request-start recall already ran empty (memoryPatientId
                  // was null). Recall the patient's remembered notes here and attach them to THIS tool
                  // result so the agent cross-references prior context in the SAME turn, instead of only
                  // ever writing memory. Skipped when memory was already loaded at request start (turn 2+
                  // or patient panel open). Fail-safe: never breaks the search on a recall hiccup.
                  if (!patientMemoryBlock && !midTurnMemoryDone) {
                    midTurnMemoryDone = true;
                    try {
                      const patientMemoryService = require('./patientMemoryService');
                      const { items, block } = await patientMemoryService.recallBlock({
                        context: memServiceContext,
                        patientId: result.data[0].patientId,
                        patientName: result.data[0].name
                      });
                      if (block) {
                        result.rememberedContext = block;
                        console.log(`🧠 [PatientMemory] Recalled ${items.length} memory item(s) mid-turn for ${result.data[0].name} (turn-0 cross-reference)`);
                      }
                    } catch (memErr) {
                      console.error(`⚠️ [PatientMemory] Mid-turn recall skipped: ${memErr.message}`);
                    }
                  }
                }

                // CRITICAL: Skip AI-generated collections - Claude doesn't need to read its own analysis!
                // DISABLED: AI collection skip logic (user requested all collections be sent to Claude)
                // Previously skipped AI-generated collections to save tokens
                // Now sending ALL collections including AI insights
                /*
                const AI_GENERATED_COLLECTIONS = [
                  'clinical_decision_support',
                  'intelligent_recommendations',
                  'trending_analysis',
                  'patient_specific_care_plan',
                  'medication_optimization',
                  'follow_up_intelligence',
                  'patient_education_context',
                  'guideline_compliance',
                  'quality_metrics',
                  'care_gaps',
                  'outcomes_prediction'
                ];

                const isAICollection = result && typeof result === 'object' &&
                  result.artifactPanel &&
                  AI_GENERATED_COLLECTIONS.includes(result.artifactPanel.category);

                if (isAICollection) {
                  console.log(`${colors.bright}${colors.magenta}🤖 AI COLLECTION SKIP: ${block.name} (${result.artifactPanel.category})${colors.reset}`);
                  console.log(`${colors.dim}   Reason: AI-generated insight - Claude will regenerate fresh analysis from patient data${colors.reset}`);
                  console.log(`${colors.cyan}   Sending to artifact panel for user, NOT sending to Claude${colors.reset}\n`);

                  if (result.displayType === 'openArtifactPanel' && result.artifactPanel) {
                    // artifactPanelData is an ARRAY - assigning an object here broke the
                    // final .length check and the panel was never sent to the frontend
                    const panelEntry = {
                      displayType: result.displayType,
                      artifactPanel: result.artifactPanel
                    };
                    const panelIdx = artifactPanelData.findIndex(p => p.artifactPanel.category === result.artifactPanel.category);
                    if (panelIdx >= 0) {
                      artifactPanelData[panelIdx] = panelEntry;
                    } else {
                      artifactPanelData.push(panelEntry);
                    }
                  }

                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: JSON.stringify({
                      success: true,
                      message: `${result.artifactPanel.category} retrieved and displayed to user. This is AI-generated analysis - you should analyze the patient's raw medical data instead.`
                    })
                  });

                  console.log(`${colors.dim}   Token savings: ${Math.ceil(JSON.stringify(result).length / 4).toLocaleString()} tokens not sent to Claude${colors.reset}\n`);
                  continue;
                }
                */

                // CRITICAL: Handle background processing (batch API) - return immediately
                if (result && typeof result === 'object' && result.backgroundProcessing === true) {
                  console.log(`${colors.bright}${colors.cyan}📦 BATCH PROCESSING: Returning batch message immediately${colors.reset}`);
                  console.log(`${colors.cyan}📦 Batch ID: ${result.batchId}${colors.reset}`);
                  console.log(`${colors.cyan}📦 Message to user:${colors.reset}\n${result.message}\n`);

                  // Send the batch processing message immediately
                  if (onChunk) {
                    onChunk({
                      type: 'done',
                      data: {
                        success: true,
                        message: result.message,
                        backgroundProcessing: true,
                        clearChat: result.clearChat,
                        batchId: result.batchId,
                        data: result.data
                      }
                    });
                  }

                  // Return immediately - don't continue agentic loop
                  return {
                    success: true,
                    message: result.message,
                    backgroundProcessing: true,
                    clearChat: result.clearChat,
                    batchId: result.batchId,
                    data: result.data
                  };
                }

                // CRITICAL: Handle directReturn flag (e.g., getFullMedicalReport with 40-60KB data)
                // Functions with directReturn=true send data directly to frontend, NOT to Claude
                // This prevents massive unified documents from consuming tokens
                if (result && typeof result === 'object' && result.directReturn === true) {
                  if (process.env.QUIET_LOGS !== 'true') {
                    console.log(`${colors.bright}${colors.cyan}🚀 DIRECT RETURN: Skipping ${block.name} result (not sending to Claude)${colors.reset}`);
                    console.log(`${colors.cyan}   Reason: Large dataset - bypassing Claude to save tokens${colors.reset}`);
                  }

                  // Capture artifact panel data for frontend
                  if (result.displayType === 'openArtifactPanel' && result.artifactPanel) {
                    // artifactPanelData is an ARRAY - assigning an object here broke the
                    // final .length check and the panel was never sent to the frontend
                    const panelEntry = {
                      displayType: result.displayType,
                      artifactPanel: result.artifactPanel
                    };
                    const panelIdx = artifactPanelData.findIndex(p => p.artifactPanel.category === result.artifactPanel.category);
                    if (panelIdx >= 0) {
                      artifactPanelData[panelIdx] = panelEntry;
                    } else {
                      artifactPanelData.push(panelEntry);
                    }
                    if (process.env.QUIET_LOGS !== 'true') console.log(`${colors.bright}${colors.cyan}📊  ARTIFACT PANEL: Captured ${result.artifactPanel.category}${colors.reset}`);
                  }

                  // Send summary to Claude (not full data, to save tokens)
                  // But include enough info for Claude to know what data is available
                  const summaryResult = {
                    success: true,
                    message: result.message || 'Data retrieved successfully',
                    // Include category names so Claude knows what functions to call next
                    categories: result.categories ? result.categories.map(c => c.name || c.displayName).filter(Boolean) : undefined,
                    totalCategories: result.totalCategories,
                    patientName: result.patientName,
                    patientId: result.patientId
                  };

                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: JSON.stringify(summaryResult)
                  });

                  // CRITICAL: Continue to next tool (don't return, don't break loop)
                  continue;
                }

                // CRITICAL: Capture artifact panel data if function returns it
                // Functions can return { success, data, displayType: 'openArtifactPanel', artifactPanel: {...} }
                console.log('[DEBUG] Checking result for artifact panel:', {
                  hasResult: !!result,
                  resultType: typeof result,
                  hasDisplayType: result?.displayType,
                  hasArtifactPanel: !!result?.artifactPanel,
                  artifactPanelCategory: result?.artifactPanel?.category
                });

                if (result && typeof result === 'object' && result.displayType === 'openArtifactPanel' && result.artifactPanel) {
                  // MULTI-COLLECTION SUPPORT: Accumulate artifact panels instead of replacing
                  // Check if we already have this category to avoid duplicates
                  const existingIndex = artifactPanelData.findIndex(p => p.artifactPanel.category === result.artifactPanel.category);
                  if (existingIndex >= 0) {
                    // Replace existing panel for same category (update data)
                    artifactPanelData[existingIndex] = {
                      displayType: result.displayType,
                      artifactPanel: result.artifactPanel
                    };
                    console.log(`🔄 ARTIFACT PANEL UPDATED: ${result.artifactPanel.category} (same category, updated data)`);
                  } else {
                    // Add new panel to array
                    artifactPanelData.push({
                      displayType: result.displayType,
                      artifactPanel: result.artifactPanel
                    });
                    console.log(`📊  ARTIFACT PANEL ADDED: ${result.artifactPanel.category} (${artifactPanelData.length} total panels)`);
                  }
                } else {
                  console.log('[DEBUG] No artifact panel in result');
                }

                // Better result logging
                const resultPreview = typeof result === 'string'
                  ? result.substring(0, 150)
                  : JSON.stringify(result).substring(0, 150);
                console.log(`${colors.bright}${colors.green}✅  COMPLETED:${colors.reset} ${colors.bright}${colors.magenta}${block.name}${colors.reset}`);
                console.log(`${colors.cyan}    Result: ${resultPreview}${resultPreview.length >= 150 ? '...' : ''}${colors.reset}\n`);

                // Send thinking about what we found - skip the redundant "got result" message
                // The actual result will be shown in Claude's response
                // Only show a brief completion indicator if there's useful info
                if (onChunk && result) {
                  // Only show result message for tools that have a meaningful message property
                  if (result.message && typeof result.message === 'string' && result.message.length > 10) {
                    onChunk({
                      type: 'thinking',
                      content: `✓ ${result.message.substring(0, 100)}`
                    });
                  }
                  // Otherwise skip the "got result" noise - Claude will explain the results
                }

                // Send FULL result to Claude - no condensing for medical safety
                // Medical data requires ALL details - "small details can kill you or save you"
                // Let Claude API handle token limits naturally - will error if exceeds 200K
                const resultContent = typeof result === 'string' ? result : JSON.stringify(result);
                const resultTokens = Math.ceil(resultContent.length / 4); // Rough token estimate
                cumulativeToolResultTokens += resultTokens;

                // Token tracking for investigation
                if (process.env.QUIET_LOGS !== 'true') {
                  console.log(`${colors.bright}${colors.yellow}📊 TOKEN ANALYSIS: ${block.name}${colors.reset}`);
                  console.log(`${colors.cyan}   Result size: ${resultTokens.toLocaleString()} tokens (${resultContent.length.toLocaleString()} chars)${colors.reset}`);
                  console.log(`${colors.bright}${colors.white}   📈 Cumulative tool results: ${cumulativeToolResultTokens.toLocaleString()} tokens${colors.reset}\n`);
                }

                toolResultsForResponse.push(`${block.name}: ${resultContent.substring(0, 500)}`);

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: resultContent
                });
              } catch (error) {
                // Enhanced error logging for debugging
                console.error(`\n${colors.red}❌  FUNCTION ERROR:${colors.reset} ${colors.bright}${colors.white}${block.name}${colors.reset}`);
                console.error(`${colors.red}    Error: ${error.message}${colors.reset}`);
                console.error(`${colors.dim}    Stack: ${error.stack?.substring(0, 300) || 'No stack trace'}${colors.reset}`);
                console.error(`${colors.dim}    Args: ${JSON.stringify(block.input).substring(0, 150)}${colors.reset}\n`);

                // Send thinking about error
                if (onChunk) {
                  onChunk({
                    type: 'thinking',
                    content: `Error in ${block.name}: ${error.message}`
                  });
                }

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify({ error: error.message, success: false }),
                  is_error: true
                });
              }
            }
          }

          // Add tool results to messages
          messages.push({
            role: 'user',
            content: toolResults
          });

          // PARAGRAPH BREAK: After tool execution, send a paragraph separator
          // This ensures Claude's response after tool use starts on a new paragraph
          // Without this, text before/after tool use gets concatenated without breaks
          if (onChunk) {
            onChunk({
              type: 'chunk',
              content: '\n\n'
            });
            finalResponse += '\n\n';
          }

          // Mark that tools have been called - subsequent loops use tool_choice: 'auto'
          hasCalledTools = true;

          // Track this loop's tokens
          const loopTokens = toolResults.reduce((sum, r) => sum + Math.ceil(r.content.length / 4), 0);
          toolResultsByLoop.push({
            loop: loopCount,
            tools: toolResults.length,
            tokens: loopTokens
          });

          // Log loop summary with token budget status
          if (process.env.QUIET_LOGS !== 'true') {
            const messagesTokenEstimate = Math.ceil(JSON.stringify(messages).length / 4);
            const budgetUsed = Math.round((messagesTokenEstimate + OVERHEAD_TOKENS) / MAX_CONVERSATION_TOKENS * 100);

            console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`);
            console.log(`${colors.bright}${colors.white}📊 LOOP #${loopCount} SUMMARY${colors.reset}`);
            console.log(`${colors.cyan}   Tools executed this loop: ${toolResults.length}${colors.reset}`);
            console.log(`${colors.cyan}   Tokens added this loop: ${loopTokens.toLocaleString()}${colors.reset}`);
            console.log(`${colors.bright}${colors.yellow}   Cumulative tool results: ${cumulativeToolResultTokens.toLocaleString()} tokens${colors.reset}`);
            console.log(`${colors.bright}${colors.white}   Messages array size: ${messagesTokenEstimate.toLocaleString()} tokens${colors.reset}`);
            console.log(`${colors.bright}${budgetUsed > 80 ? colors.red : budgetUsed > 60 ? colors.yellow : colors.green}   Token budget: ${budgetUsed}% used (${messagesTokenEstimate.toLocaleString()}/${MAX_CONVERSATION_TOKENS.toLocaleString()})${colors.reset}`);
            console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);
          }
        } else {
          // Claude finished (stop_reason is 'end_turn' or other)
          console.log(`[Agent] 🛑 Loop #${loopCount}: Claude finished (stop_reason=${response.stop_reason})`);
          console.log(`[Agent] 📝 Final response length: ${finalResponse.length} chars`);
          break;
        }
      }

      if (loopCount >= maxLoops) {
        console.warn(`[Agent] ⚠️  Reached max loops (${maxLoops}), stopping agentic loop`);
      }

      // Send completion with detailed summary (simplified for clean output)
      console.log(`\n[Agent] ═════════════════════════════════════════`);
      console.log(`[Agent] ✅ SESSION COMPLETE`);
      console.log(`[Agent] ═════════════════════════════════════════\n`);

      // Note: Batch processing (analyzeUploadedDocuments) returns early (line 530-558)
      // with just the message field, NOT raw JSON. No need to append tool results here.

      if (onChunk) {
        const doneData = {
          success: true,
          message: finalResponse,
          actionTaken: 'retrieved_data',
          actionResult: { success: true }
        };

        // CRITICAL: Include artifact panel data in done event if we have it
        // MULTI-COLLECTION SUPPORT: artifactPanelData is now an array
        if (artifactPanelData && artifactPanelData.length > 0) {
          if (artifactPanelData.length === 1) {
            // Single collection - send as before for backward compatibility
            doneData.displayType = artifactPanelData[0].displayType;
            doneData.artifactPanel = artifactPanelData[0].artifactPanel;
            if (process.env.QUIET_LOGS !== 'true') {
              console.log('📊 [ARTIFACT PANEL] Sending SINGLE collection to frontend:');
              console.log('   Category:', artifactPanelData[0].artifactPanel.category);
            }
          } else {
            // Multiple collections - send array with special displayType
            doneData.displayType = 'openArtifactPanelMultiple';
            doneData.artifactPanels = artifactPanelData.map(p => p.artifactPanel);
            if (process.env.QUIET_LOGS !== 'true') {
              console.log('📊 [ARTIFACT PANEL] Sending MULTIPLE collections to frontend:');
              console.log('   Collections:', artifactPanelData.map(p => p.artifactPanel.category).join(', '));
              console.log('   Total:', artifactPanelData.length);
            }
          }
        } else {
          if (process.env.QUIET_LOGS !== 'true') {
            console.log('[ARTIFACT PANEL] No artifact panel data to send (array is empty)');
          }
        }

        onChunk({
          type: 'done',
          data: doneData
        });
      }

      // Build final response with artifact panel data (if any function returned it)
      const finalResult = {
        success: true,
        message: finalResponse,
        response: finalResponse
      };

      // CRITICAL: Include artifact panel data if captured from function results
      // MULTI-COLLECTION SUPPORT: artifactPanelData is now an array
      if (artifactPanelData && artifactPanelData.length > 0) {
        if (artifactPanelData.length === 1) {
          // Single collection - send as before for backward compatibility
          finalResult.displayType = artifactPanelData[0].displayType;
          finalResult.artifactPanel = artifactPanelData[0].artifactPanel;
          if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] ✅ Returning response WITH SINGLE artifact panel for ${artifactPanelData[0].artifactPanel.category}`);
        } else {
          // Multiple collections - send array with special displayType
          finalResult.displayType = 'openArtifactPanelMultiple';
          finalResult.artifactPanels = artifactPanelData.map(p => p.artifactPanel);
          if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] ✅ Returning response WITH MULTIPLE artifact panels: ${artifactPanelData.map(p => p.artifactPanel.category).join(', ')}`);
        }
      }

      // PATIENT MEMORY WRITE (Phase 4): debounced, fire-and-forget extraction of durable memory
      // from this exchange. Runs AFTER the response is built → zero user-facing latency, and never
      // affects the returned result. Debounce + all error handling live in patientMemoryService.
      // Gate on having a response, and SKIP bulk CSV imports (patients/users): those turns are not
      // a clinical conversation about the session's patient and could mis-attribute notes to a stale
      // patient. The write service re-resolves the patient from the freshly-updated session (so a
      // patient the agent found DURING this turn is captured); it safely no-ops if no patient.
      const isBulkImport = (csvType === 'patients' || csvType === 'users');
      if (finalResponse && finalResponse.trim() && !isBulkImport) {
        try {
          const patientMemoryService = require('./patientMemoryService');
          const memAuthorId = practiceContext?.currentUser?.userId || practiceContext?.currentUser?.id || practiceContext?.user?.id || null;
          const recentTurns = [
            ...(Array.isArray(limitedHistory) ? limitedHistory.slice(-12) : []),
            { role: 'user', content: userMessage },
            { role: 'assistant', content: finalResponse }
          ];
          patientMemoryService.maybeExtractAndWrite({
            context: memServiceContext,
            patientId: memoryPatientId,   // pre-loop hint; service prefers the session's resolved patient
            patientName: currentPatient?.name,
            userId: memAuthorId,
            sessionId,
            recentTurns
          }).catch(() => {}); // fire-and-forget: do NOT await
        } catch (memErr) {
          console.error(`⚠️ [PatientMemory] Write scheduling skipped: ${memErr.message}`);
        }
      }

      return finalResult;
    } catch (error) {
      console.error('❌ [Agent] ERROR IN SESSION');
      console.error('❌ [Agent] Error message:', error.message);
      console.error('❌ [Agent] Stack:', error.stack?.split('\n')[0]);
      if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] ========== SESSION ERROR ==========\n`);

      // Parse API error if it's a JSON string (from Anthropic SDK)
      // Error message format can be: "400 {...json...}" or just "{...json...}"
      let errorType = null;
      let userMessage = null;

      try {
        // Strip HTTP status code prefix if present (e.g., "400 {...}" → "{...}")
        const jsonStr = error.message?.replace(/^\d{3}\s+/, '') || '';
        const errorJson = JSON.parse(jsonStr);
        errorType = errorJson?.error?.type;

        // Handle specific error types gracefully
        if (errorType === 'overloaded_error') {
          console.log('⏳ [Agent] API overloaded - returning graceful failure');
          userMessage = language === 'he'
            ? '⏳ השירות עמוס כרגע. אנא נסה שוב בעוד מספר שניות.'
            : '⏳ The AI service is currently overloaded. Please try again in a few seconds.';
        } else if (errorType === 'api_error') {
          console.log('⚠️ [Agent] API internal error - returning graceful failure');
          userMessage = language === 'he'
            ? '⚠️ אירעה שגיאה זמנית בשירות הבינה המלאכותית. אנא נסה שוב.'
            : '⚠️ A temporary error occurred with the AI service. Please try again.';
        } else if (errorType === 'rate_limit_error') {
          console.log('⏳ [Agent] Rate limited - returning graceful failure');
          userMessage = language === 'he'
            ? '⏳ מספר הבקשות חרג מהמכסה. אנא המתן מספר שניות ונסה שוב.'
            : '⏳ Request limit exceeded. Please wait a few seconds and try again.';
        } else if (errorType === 'invalid_request_error') {
          const errorMsg = errorJson?.error?.message || '';
          console.error('⚠️ [Agent] Invalid request error - returning graceful failure:', errorMsg);
          userMessage = language === 'he'
            ? '⚠️ אירעה שגיאה זמנית בשירות הבינה המלאכותית. אנא נסה שוב.'
            : '⚠️ A temporary configuration error occurred with the AI service. Please try again.';
        }
      } catch (parseErr) {
        // Not a JSON error, continue with generic handling
      }

      // If we identified a known error type, return graceful failure
      if (userMessage) {
        if (onChunk) {
          onChunk({
            type: 'text',
            text: userMessage
          });
          onChunk({ type: 'done' });
        }

        return {
          success: true, // Return success so frontend doesn't show error UI
          response: userMessage,
          actionTaken: errorType,
          costInfo: { totalTokens: 0, totalCostInCurrency: 0 }
        };
      }

      // For unknown errors, return the original error behavior
      if (onChunk) {
        onChunk({
          type: 'error',
          error: error.message
        });
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get tools in Claude tool_use format - cached for performance
   */
  getToolsForClaude() {
    // ALWAYS rebuild - don't use cache (exclusion list may have changed)
    // if (this.toolsCache && this.toolsCache.length > 0) {
    //   console.log(`[Agent] Using cached tools: ${this.toolsCache.length}`);
    //   return this.toolsCache;
    // }

    const aiHelpers = require('./utils/aiHelpers');
    const allFunctions = aiHelpers.getAllPlatformFunctions('en', 'USA');
    const tools = [];
    const seenNames = new Set();

    // Functions to exclude from Claude's tool list
    const excludedFunctions = new Set([
      'analyzeSymptoms',           // Keep this internal only
      'getMedicalDataByCategory'   // Function removed - was deprecated
    ]);

    console.log(`[Agent] Building tools from ${allFunctions.length} functions...`);
    let skippedCount = 0;

    // Convert all medical functions to Claude tools - deduplicate by name
    for (const func of allFunctions) {
      try {
        // Skip excluded functions
        if (excludedFunctions.has(func.name)) {
          skippedCount++;
          console.log(`[Agent] ⛔ EXCLUDING: ${func.name}`);
          continue;
        }

        // Skip duplicate tool names
        if (seenNames.has(func.name)) {
          console.log(`[Agent] Skipping duplicate tool: ${func.name}`);
          continue;
        }

        seenNames.add(func.name);
        tools.push({
          name: func.name,
          description: func.description || `Execute ${func.name}`,
          input_schema: {
            type: 'object',
            properties: (func.parameters?.properties) || {},
            required: (func.parameters?.required) || []
          }
        });
      } catch (error) {
        console.error(`[Agent] Failed to create tool definition for ${func.name}:`, error.message);
      }
    }

    // Cache the tools
    this.toolsCache = tools;
    console.log(`[Agent] ✅ Created and cached ${tools.length} unique tool definitions (skipped ${skippedCount} excluded)`);
    return tools;
  }

  /**
   * Get ONLY the selected tools - do NOT load all tools!
   * This is used in Stage 2 after function selection
   * Only builds tool definitions for the selected function names
   */
  getToolsForSelectedFunctions(selectedFunctionNames) {
    // CACHE BUSTING: Clear the aiHelpers module cache to pick up newly added functions
    // This ensures Stage 2 sees functions added via add-single-collection.js
    const aiHelpersPath = require.resolve('./utils/aiHelpers');
    delete require.cache[aiHelpersPath];

    const aiHelpers = require('./utils/aiHelpers');
    const allFunctions = aiHelpers.getAllPlatformFunctions('en', 'USA');
    const selectedSet = new Set(selectedFunctionNames);
    const tools = [];
    const toolNamesAdded = new Set(); // Track which tool names we've added to prevent duplicates

    // Only process selected functions from the full list
    for (const func of allFunctions) {
      if (selectedSet.has(func.name) && !toolNamesAdded.has(func.name)) {
        try {
          tools.push({
            name: func.name,
            description: func.description || `Execute ${func.name}`,
            input_schema: {
              type: 'object',
              properties: (func.parameters?.properties) || {},
              required: (func.parameters?.required) || []
            }
          });
          toolNamesAdded.add(func.name); // Mark as added
        } catch (error) {
          console.error(`[Agent] Failed to create tool for ${func.name}:`, error.message);
        }
      }
    }

    if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] Built ${tools.length} tools from ${selectedFunctionNames.length} selected functions (deduplicated)`);
    return tools;
  }

  /**
   * Convert Zod schema to JSON schema for Claude
   */
  zodToJsonSchema(schema) {
    // Extract basic properties from Zod schema
    // For complex schemas, return a flexible structure
    if (schema._def?.shape) {
      const properties = {};
      const required = [];
      for (const [key, field] of Object.entries(schema._def.shape)) {
        properties[key] = { type: 'string' }; // Simplified
        if (!field._def?.optional) {
          required.push(key);
        }
      }
      return { properties, required };
    }

    // Fallback for simpler schemas
    return {
      properties: {
        query: { type: 'string' },
        patientId: { type: 'string' },
        limit: { type: 'number' }
      },
      required: ['patientId']
    };
  }

  /**
   * Execute a tool by name with arguments using actual platform functions
   */
  async executeTool(toolName, args, context = null) {
    console.log(`\n🔧 [Agent] EXECUTING TOOL: ${toolName}`);
    console.log(`[Agent] Tool args:`, JSON.stringify(args).substring(0, 200));

    try {
      // Get the actual function implementation
      const aiHelpers = require('./utils/aiHelpers');
      const allFunctions = aiHelpers.getAllPlatformFunctions('en', 'USA');

      // Find the function definition
      const funcDef = allFunctions.find(f => f.name === toolName);
      if (!funcDef) {
        throw new Error(`Function not found: ${toolName}`);
      }

      // Get the actual function handler
      const { generatedMedicalFunctions } = require('./generatedMedicalFunctions');
      const agentServiceV4 = require('./agentServiceV4');

      if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] ✅ Found tool definition for: ${toolName}`);
      if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] Calling agentServiceV4.executeFunction()...`);

      // Execute through agentServiceV4 which handles all security + database access.
      // Prefer the request-local context passed by the agentic loop (race-safe on the singleton);
      // fall back to this.context for any legacy caller.
      const result = await agentServiceV4.executeFunction(
        toolName,
        args,
        context || this.context
      );

      if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] ✅ Tool completed: ${toolName}`);
      if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] Result type: ${typeof result}`);
      if (process.env.QUIET_LOGS !== 'true') console.log(`[Agent] Result preview:`, typeof result === 'string' ? result.substring(0, 150) : JSON.stringify(result).substring(0, 150));
      return result;
    } catch (error) {
      console.error(`\n❌ [Agent] TOOL EXECUTION FAILED: ${toolName}`);
      console.error(`[Agent] Error: ${error.message}`);
      console.error(`[Agent] Stack:`, error.stack?.split('\n').slice(0, 3).join('\n'));
      throw error;
    }
  }
}

// Singleton instance
let instance = null;

module.exports = {
  /**
   * Get AgentSDKService instance
   */
  getInstance() {
    if (!instance) {
      instance = new AgentSDKService();
    }
    return instance;
  },

  /**
   * Process chat message with agent
   */
  async processChatMessageWithAgent(userMessage, practiceId, language, onChunk, practiceContext = {}, conversationHistory = [], uploadInfo = null, sessionId = null, conversationSummary = '', requestPatientId = null) {
    const service = this.getInstance();
    return service.processChatMessageWithAgent(userMessage, practiceId, language, onChunk, practiceContext, conversationHistory, uploadInfo, sessionId, conversationSummary, requestPatientId);
  }
};
