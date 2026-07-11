/**
 * IntelliCare Claude Agent Service - DDD Architecture
 * Using Claude for better function calling and natural language understanding
 * Location: libs/ai-analytics/feature-claude/agent-service-claude.js
 */

const path = require('path');

// Adjusted paths for new location (../../../backend/)
const Anthropic = require('@anthropic-ai/sdk');

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class IntelliCareClaudeAgentService {
  constructor() {
    this.anthropic = null;
    this.initialized = false;
    this.serviceName = 'claude-agent-service';
    this.serviceToken = null;
    
    // Pricing for Claude Sonnet 4 (same as 3.5)
    this.pricing = {
      inputPer1M: 3.00,   // $3 per 1M input tokens
      outputPer1M: 15.00  // $15 per 1M output tokens
    };
    
    // Store sessions
    this.sessions = new Map();
    
    // 🔒 SECURITY CONSTRAINTS - Critical for AI agent safety
    this.securityConstraints = {
      // Role-based function access control
      roleBasedAccess: {
        'user': ['searchPatients', 'searchPatientsByName', 'findPatient', 'listAllPatients', 'getPatientHistory', 'addMedicalNote', 'scheduleAppointment'],
        'doctor': ['searchPatients', 'searchPatientsByName', 'findPatient', 'listAllPatients', 'getPatientHistory', 'addMedicalNote', 'scheduleAppointment', 'prescribeMedication', 'uploadDocument'],
        'nurse': ['searchPatients', 'searchPatientsByName', 'findPatient', 'listAllPatients', 'getPatientHistory', 'addMedicalNote', 'scheduleAppointment', 'updateVitalSigns'],
        'admin': ['*'], // Admins have access to all functions
        'medical_director': ['*'], // Medical directors have access to all functions including user management
        'secretary': ['searchPatients', 'searchPatientsByName', 'findPatient', 'listAllPatients', 'scheduleAppointment', 'updatePatientInfo']
      },
      
      // Dangerous operations that require elevated privileges
      dangerousOperations: [
        'deletePatient', 'deleteAllPatients', 'dropCollection', 
        'updateUserRoles', 'deleteUser', 'modifySystemSettings',
        'accessCrossClinic', 'bulkDelete', 'exportAllData'
      ],
      
      // Cross-practice access prevention
      strictClinicIsolation: true,
      
      // Prompt injection patterns to block
      promptInjectionPatterns: [
        /ignore.*(previous|all).*(instructions|rules|constraints)/i,
        /forget.*(rules|constraints|system)/i,
        /you are now/i,
        /new instructions/i,
        /override.*(security|safety)/i,
        /act as.*admin/i,
        /pretend.*you.*(are|can)/i,
        /system.*prompt.*is/i
      ]
    };
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Initialize secure config service first
      const proxy = getServiceProxy();
      const secureConfigService = proxy.getService('secureConfigService');
      await secureConfigService.initialize();
      
      // Get API key directly from KMS (to avoid double encryption issue)
      const productionKMS = proxy.getService('productionKMS');
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }
      
      const apiKey = await productionKMS.getInternalKey('CLAUDE_API_KEY') || 
                     await productionKMS.getInternalKey('ANTHROPIC_API_KEY');
      if (!apiKey) {
        throw new Error('No Claude/Anthropic API key found in KMS. Please store CLAUDE_API_KEY or ANTHROPIC_API_KEY.');
      }
      
      // Initialize Anthropic client with API key from KMS
      this.anthropic = new Anthropic({
        apiKey: apiKey
      });
      
      // Authenticate service account with unique service name
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceName);
      
      // Initialize Claude Memory System
      try {
        const claudeMemoryService = proxy.getService('claudeMemoryService');
        await claudeMemoryService.initialize();
        this.memoryEnabled = true;
        console.log('🧠 Claude Memory System activated - Learning enabled');
      } catch (error) {
        console.warn('⚠️ Claude Memory not available:', error.message);
        this.memoryEnabled = false;
      }
      
      // Initialize security audit service
      try {
        this.securityAudit = proxy.getService('immutableAuditService');
      } catch (error) {
        console.warn('⚠️ Security audit service not available:', error.message);
        this.securityAudit = null;
      }
      
      this.initialized = true;
      console.log('✅ [Claude Agent Service] Initialized successfully');
    } catch (error) {
      console.error('❌ [Claude Agent Service] Failed to initialize:', error.message);
      throw error;
    }
    
    return this;
  }

  // 🔒 SECURITY CONSTRAINT METHODS - Critical for AI safety
  
  /**
   * Filter functions based on user context and role
   * This prevents users from accessing functions they shouldn't have
   */
  filterFunctionsByContext(userContext, availableFunctions) {
    // Add null check for availableFunctions - THIS FIXES THE MAIN ERROR
    if (!availableFunctions || !Array.isArray(availableFunctions)) {
      console.warn('⚠️ No available functions provided - returning empty array');
      return [];
    }

    if (!userContext || !userContext.role) {
      console.warn('⚠️ No user role provided - applying minimal access');
      return availableFunctions.filter(f => f.name === 'searchPatients');
    }

    const userRole = userContext.role.toLowerCase();
    const allowedFunctionNames = this.securityConstraints.roleBasedAccess[userRole] || [];
    
    // Admin role gets all functions
    if (allowedFunctionNames.includes('*')) {
      return availableFunctions;
    }
    
    // Filter functions based on role
    const filteredFunctions = availableFunctions.filter(func => 
      allowedFunctionNames.includes(func.name)
    );
    
    console.log(`🔒 Filtered ${availableFunctions.length} → ${filteredFunctions.length} functions for role: ${userRole}`);
    
    // Log security event
    if (this.securityAudit) {
      this.securityAudit.logSecurityEvent({
        type: 'FUNCTION_FILTERING',
        userRole,
        totalFunctions: availableFunctions.length,
        allowedFunctions: filteredFunctions.length,
        practiceId: userContext.practiceId,
        timestamp: new Date()
      }).catch(e => console.warn('Failed to log security event:', e));
    }
    
    return filteredFunctions;
  }
  
  /**
   * Validate if an operation is allowed for the given context
   */
  validateOperation(operation, userContext) {
    // Check dangerous operations
    if (this.securityConstraints.dangerousOperations.includes(operation)) {
      if (!userContext.role || userContext.role.toLowerCase() !== 'admin') {
        if (this.securityAudit) {
          this.securityAudit.logSecurityEvent({
            type: 'BLOCKED_DANGEROUS_OPERATION',
            operation,
            userRole: userContext.role,
            practiceId: userContext.practiceId,
            timestamp: new Date()
          }).catch(e => console.warn('Failed to log security event:', e));
        }
        
        throw new Error(`Operation '${operation}' requires administrator privileges`);
      }
    }
    
    // Check cross-practice access
    if (this.securityConstraints.strictClinicIsolation) {
      // Implementation would check if operation tries to access different practice
      // This is a placeholder for more detailed cross-practice validation
    }
    
    return true;
  }
  
  /**
   * Check for prompt injection attempts
   */
  detectPromptInjection(message) {
    for (const pattern of this.securityConstraints.promptInjectionPatterns) {
      if (pattern.test(message)) {
        return {
          detected: true,
          pattern: pattern.source,
          message: 'Potential prompt injection detected'
        };
      }
    }
    return { detected: false };
  }
  
  /**
   * Validate user message for security threats
   */
  validateUserMessage(message, userContext) {
    // Check for prompt injection
    const injectionCheck = this.detectPromptInjection(message);
    if (injectionCheck.detected) {
      if (this.securityAudit) {
        this.securityAudit.logSecurityEvent({
          type: 'BLOCKED_PROMPT_INJECTION',
          pattern: injectionCheck.pattern,
          userRole: userContext.role,
          practiceId: userContext.practiceId,
          timestamp: new Date()
        }).catch(e => console.warn('Failed to log security event:', e));
      }
      
      throw new Error('Message contains potentially harmful content and has been blocked');
    }
    
    return true;
  }
  
  // Accurate token counting using Anthropic's count_tokens endpoint
  async countTokens(messages, model = 'claude-sonnet-5', system = null, tools = null) {
    await this.initialize();
    
    // Handle edge case: if no messages and only system prompt, create a minimal message
    if ((!messages || messages.length === 0) && !system) {
      return 0; // No content to count
    }
    
    // Anthropic requires at least one message with non-empty content
    const messagesToCount = (!messages || messages.length === 0) 
      ? [{ role: 'user', content: '.' }] // Minimal non-empty content
      : messages;
    
    const params = {
      model: model,
      messages: messagesToCount
    };
    
    // Add system prompt if provided
    if (system) {
      params.system = system;
    }
    
    // Add tools if provided
    if (tools) {
      params.tools = tools;
    }
    
    try {
      // Call the count_tokens endpoint
      const response = await this.anthropic.messages.countTokens(params);
      
      // Return the token count
      return response.input_tokens || 0;
    } catch (error) {
      console.error('Token counting error:', error.message);
      return 0;
    }
  }
  
  // Helper method to call Claude API with retry logic
  async callClaudeWithRetry(params, language = 'he') {
    await this.initialize();
    
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount <= maxRetries) {
      try {
        const response = await this.anthropic.messages.create(params);
        return response;
      } catch (error) {
        // Check for credit exhaustion error
        if (error.status === 400 && error.message && 
            (error.message.includes('credit balance') || error.message.includes('purchase credits'))) {
          console.error('❌ Claude credits exhausted during API call');
          // Re-throw with custom error for better handling
          const customError = new Error('CREDITS_EXHAUSTED');
          customError.status = 400;
          customError.originalError = error;
          throw customError;
        }
        
        // Check for 529 Overloaded error
        if (error.status === 529 || error.code === 529) {
          retryCount++;
          if (retryCount > maxRetries) {
            console.error(`❌ Claude API overloaded after ${maxRetries} retries`);
            throw new Error(language === 'he' 
              ? 'השירות עמוס כרגע. אנא נסה שוב בעוד מספר שניות.'
              : 'The service is currently overloaded. Please try again in a few seconds.');
          }
          
          // Exponential backoff: 1s, 2s, 4s
          const waitTime = Math.pow(2, retryCount - 1) * 1000;
          console.log(`⏳ Claude API overloaded (529). Retry ${retryCount}/${maxRetries} after ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // Other errors - don't retry
          throw error;
        }
      }
    }
  }

  // Process chat message with Claude
  async processChatMessage(message, sessionId, language, practiceContext) {
    await this.initialize();
    
    try {
      // Track functions selected by keywords (for tooltip display)
      let selectedFunctionNames = [];
      
      // Handle both string and object message formats
      let messageText = message;
      if (typeof message === 'object' && message !== null) {
        // If message is an object, try to extract the text
        messageText = message.text || message.content || message.message || JSON.stringify(message);
        console.log(`⚠️ Message received as object, extracted text: "${messageText?.substring(0, 50)}..."`);
      }
      
      // Check if there's an upload context that needs to be handled
      if (practiceContext?.uploadInfo) {
        const { type, uploadId, fileNames } = practiceContext.uploadInfo;
        if (type === 'document_upload' && uploadId) {
          console.log(`📎 Document upload detected - uploadId: ${uploadId}, files: ${fileNames}`);
          // Append upload context to the message so the AI knows to process it
          messageText = `${messageText}\n[Upload Context: uploadId=${uploadId}, files=${fileNames}]`;
        }
      }
      
      // 🚨 CRITICAL DEBUG: Confirm Claude service is handling this request
      console.log(`\n🎯 CLAUDE SERVICE PROCESSING MESSAGE`);
      console.log(`├─ Message: "${messageText?.substring(0, 50)}..."`);
      console.log(`├─ SessionID: ${sessionId}`);
      console.log(`└─ Service: ${this.serviceName}`);
      
      // Ensure messageText is a string
      if (typeof messageText !== 'string') {
        console.error('⚠️ Invalid messageText type:', typeof messageText, 'Value:', messageText);
        messageText = String(messageText || '');
      }
      
      // Check if this is a help command - use our comprehensive help system
      if (messageText && messageText.toLowerCase().startsWith('help')) {
        try {
          const proxy = getServiceProxy();
          const platformHelpService = proxy.getService('platformHelpService');
          if (!platformHelpService.categories) {
            platformHelpService.initialize();
          }
          const helpResponse = platformHelpService.getHelp(messageText, language === 'he' ? 'he' : 'en');
          return {
            success: true,
            message: helpResponse,
            data: null,
            metadata: {
              type: 'help',
              language: language === 'he' ? 'he' : 'en',
              functions: 424  // We have 424+ functions documented
            }
          };
        } catch (helpError) {
          console.warn('Help service not available:', helpError.message);
        }
      }
      
      // 🔒 SECURITY VALIDATION - Always validate before processing
      const userContext = {
        role: practiceContext?.currentUser?.roles?.[0] || practiceContext?.user?.role || practiceContext?.user?.roles?.[0] || 'user',
        practiceId: practiceContext?.practice?.id || practiceContext?.practiceId,
        userId: practiceContext?.currentUser?.id || practiceContext?.user?.id || practiceContext?.userId
      };
      
      console.log(`🔒 Security validation for role: ${userContext.role}`);
      
      // Build security context for SecureDataAccess
      const proxy = getServiceProxy();
      const AgentServiceHelpers = proxy.getService('agentServiceHelpers');
      const context = AgentServiceHelpers.buildSecurityContext(
        this.serviceName,
        this.serviceToken,
        practiceContext
      );
      
      // Validate user message for security threats
      try {
        this.validateUserMessage(messageText, userContext);
      } catch (securityError) {
        console.error(`🚨 SECURITY BLOCKED: ${securityError.message}`);
        return {
          success: false,
          message: {
            he: 'הודעה נחסמה מטעמי אבטחה. אנא נסח מחדש את בקשתך.',
            en: 'Message blocked for security reasons. Please rephrase your request.'
          },
          securityBlocked: true
        };
      }
      
      // Get or create session with proper initialization
      if (!this.sessions.has(sessionId)) {
        // Get default currency for this practice
        let defaultCurrency = 'USD';
        try {
          const proxy = getServiceProxy();
          const currencyService = proxy.getService('currencyService');
          defaultCurrency = currencyService.getDefaultCurrencyForClinic(practiceContext?.practice) || 'USD';
        } catch (error) {
          console.warn('Currency service not available:', error.message);
        }
        
        this.sessions.set(sessionId, { 
          messages: [],
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0,
          totalCost: 0,
          messageCount: 0,
          preferredCurrency: defaultCurrency,
          language: language
        });
      }
      const session = this.sessions.get(sessionId);
      
      console.log('🤖 INTELLICARE CLAUDE AGENT');
      console.log(`💬 User message: ${messageText}`);
      console.log(`🌍 Language: ${language}`);
      console.log(`🏥 Practice Country: ${practiceContext?.country || 'Not set'}`);
      
      // For now, return a basic response indicating the service is active
      // This would be where the full Claude integration logic would go
      const response = {
        success: true,
        message: language === 'he' 
          ? 'שירות Claude זמין. הודעתך התקבלה בהצלחה.'
          : 'Claude service is available. Your message has been received successfully.',
        data: {
          serviceInfo: this.getServiceInfo(),
          sessionId: sessionId,
          messageProcessed: true
        },
        metadata: {
          type: 'claude_response',
          language: language,
          serviceId: this.serviceName,
          tokenUsage: {
            input: 0,
            output: 0,
            total: 0
          },
          cost: 0
        }
      };
      
      // Update session statistics
      session.messageCount++;
      
      return response;
      
    } catch (error) {
      console.error('❌ Claude service error:', error.message);
      return {
        success: false,
        message: {
          he: 'אירעה שגיאה בעיבוד ההודעה. אנא נסה שוב.',
          en: 'An error occurred processing the message. Please try again.'
        },
        error: error.message,
        serviceId: this.serviceName
      };
    }
  }

  // Get session information
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  // Clear session
  clearSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  // Get all active sessions
  getActiveSessions() {
    return Array.from(this.sessions.keys());
  }

  // Service metadata
  getServiceInfo() {
    return {
      serviceName: this.serviceName,
      version: '2.0.0',
      architecture: 'DDD',
      location: 'libs/ai-analytics/feature-claude/agent-service-claude.js',
      initialized: this.initialized,
      anthropicClient: !!this.anthropic,
      memoryEnabled: this.memoryEnabled,
      activeSessions: this.sessions.size,
      pricing: this.pricing,
      securityConstraints: {
        roleBasedAccess: Object.keys(this.securityConstraints.roleBasedAccess).length,
        dangerousOperations: this.securityConstraints.dangerousOperations.length,
        promptInjectionPatterns: this.securityConstraints.promptInjectionPatterns.length
      }
    };
  }

  // Health check
  async healthCheck() {
    await this.initialize();
    
    return {
      status: 'healthy',
      service: this.serviceName,
      initialized: this.initialized,
      anthropicClient: !!this.anthropic,
      serviceToken: !!this.serviceToken,
      activeSessions: this.sessions.size,
      timestamp: new Date()
    };
  }

  // Cleanup resources
  async cleanup() {
    console.log(`🧹 Cleaning up ${this.serviceName}...`);
    
    // Clear all sessions
    this.sessions.clear();
    
    // Reset initialization
    this.initialized = false;
    this.anthropic = null;
    this.serviceToken = null;
    
    console.log(`✅ ${this.serviceName} cleanup completed`);
  }
}

// Export singleton instance
const instance = new IntelliCareClaudeAgentService();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('agentServiceClaude', () => instance);
}

module.exports = instance;