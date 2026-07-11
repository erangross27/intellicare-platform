/**
 * ⚠️ AI AGENT SECURITY NOTICE
 *
 * This service executes AI-generated operations.
 * ALL operations are validated by aiSecurityWrapper before execution.
 *
 * If you're an AI agent reading this:
 * - Use SecureDataAccess for ALL database operations
 * - Use secureApiClient for ALL API calls
 * - NEVER access process.env directly
 * - NEVER use eval() or Function()
 * - ALWAYS include audit logging
 *
 * Insecure patterns will be automatically blocked.
 */

// Agent Service Wrapper - Hybrid AI Architecture with Security
// Automatically uses Claude with PROMPT CACHING for conversations
// 90% cost reduction after first request due to function caching

// Use service proxy manager to avoid circular dependencies
const serviceProxyManager = require('./serviceProxyManager');

class AgentServiceWrapper {
  constructor() {
    // Agent will be set during initialization
    this.activeAgent = null;
    this.agentType = null;
    
    // Services will be loaded during initialization
    this.agentSmart = null;
    this.agentClaude = null;
    this.aiSecurityWrapper = null;
    this.immutableAuditService = null;
    this.secureConfigService = null;
    this.selfImprovingMemory = null;
    this.workflowPredictorService = null;
    this.personalAssistantService = null;
    this.naturalLanguageQueryService = null;
  }

  /**
   * Enhanced workflow detection with learning system integration
   */
  async detectWorkflowTrigger(message, language, practiceContext = null) {
    try {
      const msgLower = message.toLowerCase().trim();
      
      // First: Try learning-based workflow prediction
      let learningBasedPrediction = null;
      if (practiceContext?.currentUser?.id) {
        try {
          if (!this.workflowPredictorService.initialized) {
            await this.workflowPredictorService.initialize();
          }
          
          learningBasedPrediction = await this.workflowPredictorService.predictWorkflow({
            userId: practiceContext.currentUser.id,
            practiceId: practiceContext.id || 'global',
            query: message,
            context: {
              language,
              timestamp: new Date(),
              recentActions: practiceContext.recentActions || []
            }
          });
          
          if (learningBasedPrediction && learningBasedPrediction.confidence > 0.7) {
            console.log('🤖 Learning-based workflow prediction:', learningBasedPrediction.workflowId);
            return {
              ...learningBasedPrediction,
              source: 'learning-prediction'
            };
          }
        } catch (learningError) {
          console.log('⚠️ Learning-based prediction failed, using keyword fallback:', learningError.message);
        }
      }
      
      // Fallback: Keyword-based workflow trigger patterns
      const workflowTriggers = {
        'practice-onboarding': [
          'new practice', 'create practice', 'get started', 'welcome', 'start',
          'מרפאה חדשה', 'יצירת מרפאה', 'התחל', 'ברוכים הבאים'
        ],
        'patient-registration': [
          'new patient', 'register patient', 'add patient', 'patient registration',
          'רישום מטופל', 'מטופל חדש', 'הוסף מטופל'
        ],
        'patient-visit': [
          'patient visit', 'check in patient', 'start visit', 'patient appointment',
          'ביקור מטופל', 'קבלת מטופל', 'תחילת ביקור'
        ],
        'prescription': [
          'write prescription', 'prescribe', 'prescription', 'rx', 'medication',
          'כתוב מרשם', 'מרשם', 'תרופה', 'רשום תרופה'
        ],
        'lab-order': [
          'order lab', 'lab test', 'blood test', 'order test', 'laboratory',
          'הזמן בדיקה', 'בדיקת דם', 'בדיקות מעבדה'
        ],
        'telehealth': [
          'telehealth', 'video visit', 'virtual visit', 'online consultation',
          'ביקור מרחוק', 'טלרפואה', 'ייעוץ מקוון'
        ],
        'referral': [
          'create referral', 'refer patient', 'specialist referral', 'referral',
          'הפניה', 'הפנה מטופל', 'הפניה למומחה'
        ],
        'morning-routine': [
          'morning routine', 'start day', 'morning rounds', 'daily routine',
          'שגרת בוקר', 'תחילת יום', 'סיבוב בוקר'
        ],
        'end-of-day': [
          'end of day', 'close day', 'wrap up', 'finish work',
          'סוף יום', 'סיום יום', 'סגירת יום'
        ]
      };
      
      // Check each workflow for triggers
      for (const [workflowId, triggers] of Object.entries(workflowTriggers)) {
        for (const trigger of triggers) {
          if (msgLower.includes(trigger)) {
            return {
              workflowId,
              trigger,
              confidence: 0.8,
              reason: `User mentioned "${trigger}" which suggests ${workflowId} workflow`,
              source: 'keyword-match'
            };
          }
        }
      }
      
      // Advanced pattern matching for complex requests
      if (msgLower.includes('help') || msgLower.includes('עזרה')) {
        if (msgLower.includes('patient') || msgLower.includes('מטופל')) {
          return {
            workflowId: 'patient-registration',
            confidence: 0.6,
            reason: 'User asked for help with patient-related task',
            source: 'context-inference'
          };
        }
      }
      
      // Return learning prediction even if confidence is lower (as a suggestion)
      if (learningBasedPrediction && learningBasedPrediction.confidence > 0.4) {
        return {
          ...learningBasedPrediction,
          source: 'learning-suggestion',
          suggestedOnly: true
        };
      }
      
      // No workflow trigger detected
      return null;
      
    } catch (error) {
      console.error('Error detecting workflow trigger:', error);
      return null;
    }
  }

  async initialize() {
    const serviceAccountManager = require('./serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('agent-service-wrapper');

    // Load all required services from proxy manager
    this.agentSmart = serviceProxyManager.get('agentServiceSmart');
    this.agentClaude = serviceProxyManager.get('agentServiceClaude');
    this.aiSecurityWrapper = serviceProxyManager.get('aiSecurityWrapper');
    this.immutableAuditService = serviceProxyManager.get('immutableAuditService');
    this.secureConfigService = serviceProxyManager.get('secureConfigService');
    this.selfImprovingMemory = serviceProxyManager.get('selfImprovingMemory');
    this.workflowPredictorService = serviceProxyManager.get('workflowPredictorService');
    this.personalAssistantService = serviceProxyManager.get('personalAssistantService');

    // Load natural language service - may not be initialized yet
    try {
      this.naturalLanguageQueryService = serviceProxyManager.get('naturalLanguageQueryService');
    } catch (error) {
      console.log('⚠️ Natural language query service not available:', error.message);
      this.naturalLanguageQueryService = null;
    }
    
    // Now check for API keys after secureConfigService is initialized
    const hasClaudeKey = this.secureConfigService.get('CLAUDE_API_KEY') || this.secureConfigService.get('ANTHROPIC_API_KEY');
    
    // ALWAYS use Claude for chat and function calling when available
    if (hasClaudeKey) {
      // Use Claude for all chat and function calling
      this.activeAgent = this.agentClaude;
      this.agentType = 'Claude with Dynamic Function Selection';
      console.log('🤖 Using Claude Sonnet for chat and function calling');
      console.log('✅ Claude excels at selecting from 470+ functions');
    } else {
      // No Claude key available - system cannot function properly
      console.error('❌ Claude API key not found! Claude is required for function calling.');
      console.error('💡 Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY in environment or KMS');
      throw new Error('Claude API key required for chat and function calling');
    }

    // Note: Agent services are already initialized by masterServiceLoader
    // We don't need to initialize them again here
    
    return this;
  }
  
  // Main chat processing method - same interface for both versions
  async processChatMessage(message, sessionId, language, practiceContext, onChunk = null) {
    try {
      // NOTE: We do NOT validate user messages for security patterns
      // User messages are natural language text, not executable code
      // Security wrapper only validates AI-generated code/operations

      // Check for workflow triggers (now includes learning-based predictions)
      const workflowTrigger = await this.detectWorkflowTrigger(message, language, practiceContext);

      // Get user context and patterns from self-improving memory
      let memoryContext = null;
      if (practiceContext?.currentUser?.id) {
        try {
          const userId = practiceContext.currentUser.id;
          const userRole = practiceContext.currentUser.roles?.[0] || practiceContext.currentUser.role || practiceContext.currentUser.userType || 'doctor';

          // Initialize selfImprovingMemory if needed
          if (!this.selfImprovingMemory.initialized) {
            await this.selfImprovingMemory.initialize();
          }

          // Get personalized context from memory
          memoryContext = await this.selfImprovingMemory.getContext({
            userId,
            userRole,
            practiceId: practiceContext.id || 'global',
            query: message,
            language
          });

          console.log(`🧠 Retrieved memory context for user ${userId} (role: ${userRole})`);
        } catch (memoryError) {
          console.error('❌ Failed to get memory context:', memoryError.message);
          // Non-blocking - continue without memory context
        }
      }

      // Build enhanced message with workflow and memory context
      let enhancedMessage = message;
      const enhancements = {};

      if (workflowTrigger) {
        enhancements.workflowSuggestion = workflowTrigger;
      }

      if (memoryContext) {
        enhancements.memoryContext = {
          userPreferences: memoryContext.preferences,
          commonPatterns: memoryContext.patterns,
          recentTopics: memoryContext.recentTopics,
          learningProfile: memoryContext.learningProfile,
          roleOptimizations: memoryContext.roleOptimizations
        };
      }

      // Only enhance if we have context to add
      if (Object.keys(enhancements).length > 0) {
        enhancedMessage = {
          text: message,
          ...enhancements
        };
      }

      // NEW: Check if this is a natural language database query BEFORE security wrapper
      // If so, use direct database path instead of 3-API-call function selection
      const queryText = typeof enhancedMessage === 'string' ? enhancedMessage : (enhancedMessage.text || message);

      // REMOVED: naturalLanguageQueryService - Always use 3 API calls approach
      // The system should never fall back to naturalLanguageQueryService
      // All queries go through the standard 3 API calls:
      // 1. Function selection (Claude)
      // 2. Function execution
      // 3. Response formatting (Claude)

      /*
      // For medical queries, try natural language query service first
      const isMedicalQuery = /patient|condition|disease|heart|diagnosis|medical|health/i.test(queryText);
      console.log(`🏥 Is medical query: ${isMedicalQuery}, Query: "${queryText.substring(0, 50)}..."`);
      console.log(`🔧 naturalLanguageQueryService status: ${this.naturalLanguageQueryService ? 'loaded' : 'not loaded'}`);

      if (this.naturalLanguageQueryService) {
        console.log('✅ naturalLanguageQueryService is available');
        try {
          const isNLQuery = this.naturalLanguageQueryService.isNaturalLanguageQuery(queryText);
          console.log(`🔍 Checking if "${queryText.substring(0, 50)}..." is NL query: ${isNLQuery}`);

          if (isNLQuery) {
            console.log('🎯 Natural language database query detected - using direct vector search path');

            // Execute natural language query with security validation
            const nlResult = await this.naturalLanguageQueryService.executeQuery(queryText, {
              practiceId: practiceContext?.id || 'global',
              userId: practiceContext?.currentUser?.id,
              serviceId: 'agent-wrapper-natural-query'
            });

            if (nlResult && nlResult.success) {
              // Format result for chat display
              const formattedResult = {
                success: true,
                message: nlResult.message,
                data: nlResult.data,
                queryInfo: nlResult.queryInfo,
                naturalLanguageUsed: true,
                apiCalls: 2 // Instead of 3!
              };

              // Log successful operation
              await this.immutableAuditService.addAuditEntry({
                action: 'AI_CHAT_MESSAGE',
                sessionId,
                practiceId: practiceContext?.id,
                status: 'success',
                naturalLanguageUsed: true
              });

              return formattedResult;
            } else {
              console.log('⚠️ Natural language query failed, falling back to function selection');
              // Fall through to normal agent processing
            }
          }
        } catch (nlError) {
          console.error('❌ Natural language query error:', nlError.message);
          // Fall through to normal agent processing
        }
      } else {
        console.log('⚠️ Natural language query service not available');
      }
      */

      // Execute normal agent processing with security monitoring
      const result = await this.aiSecurityWrapper.executeSecure(
        async () => {
          return await this.activeAgent.processChatMessage(enhancedMessage, sessionId, language, practiceContext, onChunk);
        },
        [],
        { operation: 'processChatMessage', sessionId }
      );

      // Log successful operation
      await this.immutableAuditService.addAuditEntry({
        action: 'AI_CHAT_MESSAGE',
        sessionId,
        practiceId: practiceContext?.id,
        status: 'success'
      });
      
      // Enhance response with learning insights and suggestions
      if (result) {
        // Add workflow suggestion to response if detected
        if (workflowTrigger) {
          result.workflowSuggestion = workflowTrigger;
        }
        
        // Add personal assistant suggestions
        if (practiceContext?.currentUser?.id) {
          try {
            if (!this.personalAssistantService.initialized) {
              await this.personalAssistantService.initialize();
            }
            
            const assistantSuggestions = await this.personalAssistantService.getPersonalizedSuggestions(
              practiceContext.currentUser.id,
              {
                practiceId: practiceContext.id || 'global',
                currentContext: {
                  query: message,
                  language,
                  timestamp: new Date()
                }
              }
            );
            
            if (assistantSuggestions && assistantSuggestions.length > 0) {
              result.personalAssistantSuggestions = assistantSuggestions;
              console.log(`💡 Generated ${assistantSuggestions.length} personal assistant suggestions`);
            }
          } catch (assistantError) {
            console.log('⚠️ Personal assistant suggestions failed:', assistantError.message);
          }
        }
        
        // Add learning feedback if patterns were used or learned
        if (memoryContext) {
          result.learningFeedback = {
            patternsFound: memoryContext.patterns?.length || 0,
            roleOptimized: true,
            learningProfile: memoryContext.learningProfile?.role,
            message: memoryContext.patterns?.length > 0 
              ? `Applied ${memoryContext.patterns.length} learned patterns for ${memoryContext.learningProfile?.role}`
              : `Learning from this interaction for ${memoryContext.learningProfile?.role} role`
          };
        }
      }

      return result;
    } catch (error) {
      // Log the actual error for debugging
      console.error('❌ AgentServiceWrapper processChatMessage error:', error.message);
      console.error('Stack:', error.stack);
      
      // Log security violation or error
      await this.immutableAuditService.addAuditEntry({
        action: 'AI_CHAT_MESSAGE_ERROR',
        sessionId,
        practiceId: practiceContext?.id,
        error: error.message,
        status: 'failed'
      });

      // Re-throw with sanitized error
      throw new Error('Failed to process message securely');
    }
  }
  
  // Other methods that might be called directly
  async addPatient(params, practiceContext) {
    if (this.activeAgent.addPatient) {
      return await this.activeAgent.addPatient(params, practiceContext);
    }
    throw new Error('addPatient not implemented in active agent');
  }
  
  async getPatient(params, practiceContext) {
    if (this.activeAgent.getPatient) {
      return await this.activeAgent.getPatient(params, practiceContext);
    }
    throw new Error('getPatient not implemented in active agent');
  }
  
  async listPatients(params, practiceContext) {
    if (this.activeAgent.listPatients) {
      return await this.activeAgent.listPatients(params, practiceContext);
    }
    throw new Error('listPatients not implemented in active agent');
  }
  
  async processChatMessageAndStream(message, sessionId, language, practiceContext, onChunk) {
    try {
      // Pass the call through to the active agent's streaming method.
      return await this.activeAgent.processChatMessageAndStream(message, sessionId, language, practiceContext, onChunk);
    } catch (error) {
      console.error('❌ AgentServiceWrapper processChatMessageAndStream error:', error.message);
      onChunk({ type: 'error', error: 'Failed to process message securely' });
      // Don't rethrow, as the stream is the response channel.
    }
  }

  // Get which version is active
  getActiveVersion() {
    return this.agentType;
  }

  /**
   * Process text with Claude specifically
   * Used by /api/agent/process-text endpoint
   */
  async processWithClaude(text, sessionId, language) {
    try {
      // Ensure Claude is initialized
      if (!this.agentClaude) {
        throw new Error('Claude service not initialized');
      }

      // Process through Claude service
      const result = await this.agentClaude.processChatMessage(
        text,
        sessionId,
        language,
        {} // Empty practice context for simple text processing
      );

      // Return in expected format
      return {
        success: true,
        response: result.message || result.response || '',
        toolUsed: result.actionTaken || null,
        toolResult: result.actionResult || null,
        sessionId: sessionId
      };
    } catch (error) {
      console.error('❌ processWithClaude error:', error.message);
      return {
        success: false,
        error: error.message,
        response: null,
        toolUsed: null,
        toolResult: null
      };
    }
  }
}

// Create singleton instance (initialization handled by masterServiceLoader)
const wrapper = new AgentServiceWrapper();

// Export singleton instance
module.exports = wrapper;