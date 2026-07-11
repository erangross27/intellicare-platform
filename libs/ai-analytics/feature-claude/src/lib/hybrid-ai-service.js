/**
 * Hybrid AI Service - DDD/NX Modular Version
 * Uses Claude Code for development, API for production
 * This saves money during development by routing test requests through Claude Code
 * Migrated from legacy backend/services structure to DDD/NX architecture
 */

const Anthropic = require('@anthropic-ai/sdk');

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class HybridAIService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.isDevelopment = false; // Will be set in initialize()
    this.useClaudeCode = false; // Disabled for security
    this.anthropic = null;
  }

  async initialize() {
    if (this.initialized) return this;
    
    const proxy = getServiceProxy();
    const secureConfigService = proxy.getService('secureConfigService');
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    
    // Initialize secure config
    await secureConfigService.initialize();
    
    // Authenticate service
    this.serviceToken = await serviceAccountManager.authenticate('hybrid-ai-service');
    
    // Set development mode from secure config
    this.isDevelopment = secureConfigService.get('NODE_ENV') === 'development';
    
    // Initialize Anthropic client if API key available
    const claudeApiKey = secureConfigService.get('CLAUDE_API_KEY');
    if (claudeApiKey) {
      this.anthropic = new Anthropic({
        apiKey: claudeApiKey
      });
    }
    
    this.initialized = true;
    return this;
  }

  async processMessage(message, functions = []) {
    // In development with Claude Code enabled
    if (this.isDevelopment && this.useClaudeCode) {
      return this.processViaClaudeCode(message);
    }
    
    // In production or when using API
    return this.processViaAPI(message, functions);
  }

  async processViaClaudeCode(message) {
    // This is a concept - Claude Code doesn't actually support this
    // But shows what we WISH we could do
    return {
      success: false,
      message: "Claude Code integration not available - use API mode",
      fallback: true
    };
  }

  async processViaAPI(message, functions) {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-5',
        messages: [{ role: 'user', content: message }],
        tools: functions ? this.formatFunctions(functions) : undefined,
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' }
      });

      return {
        success: true,
        message: response.content[0].text,
        functionCalls: response.tool_calls || []
      };
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  formatFunctions(functions) {
    // Convert your function format to Claude's expected format
    return functions.map(fn => ({
      name: fn.name,
      description: fn.description,
      input_schema: fn.parameters
    }));
  }

  /**
   * Process message with context logging
   */
  async processMessageWithContext(message, functions = [], context = {}) {
    // Log the interaction for analytics
    const interactionStart = Date.now();
    
    try {
      // Add service authentication context
      const enrichedContext = {
        ...context,
        serviceId: 'hybrid-ai-service',
        operation: 'process-message',
        practiceId: context.practiceId || 'global'
      };

      // Process the message
      const result = await this.processMessage(message, functions);
      
      // Log successful interaction
      await this.logInteraction({
        message,
        functions: functions.length,
        result: result.success,
        duration: Date.now() - interactionStart,
        model: 'claude-sonnet-5',
        context: enrichedContext
      });

      return result;
    } catch (error) {
      // Log failed interaction
      await this.logInteraction({
        message,
        functions: functions.length,
        result: false,
        error: error.message,
        duration: Date.now() - interactionStart,
        context: context
      });

      throw error;
    }
  }

  /**
   * Log AI interaction for analytics
   */
  async logInteraction(interactionData) {
    try {
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      
      await secureDataAccess.create(
        'ai_interactions',
        {
          timestamp: new Date(),
          service: 'hybrid-ai-service',
          messageLength: interactionData.message.length,
          functionCount: interactionData.functions,
          success: interactionData.result,
          duration: interactionData.duration,
          model: interactionData.model,
          error: interactionData.error,
          practiceId: interactionData.context?.practiceId || 'global'
        },
        {
          serviceId: 'hybrid-ai-service',
          operation: 'log-interaction',
          practiceId: interactionData.context?.practiceId || 'global'
        }
      );
    } catch (error) {
      console.error('Failed to log AI interaction:', error.message);
      // Don't fail the request if logging fails
    }
  }

  /**
   * Get AI usage analytics
   */
  async getUsageAnalytics(practiceId = 'global', days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');

    const interactions = await secureDataAccess.query(
      'ai_interactions',
      {
        practiceId,
        timestamp: { $gte: startDate }
      },
      { sort: { timestamp: -1 } },
      {
        serviceId: 'hybrid-ai-service',
        operation: 'get-usage-analytics',
        practiceId
      }
    );

    const analytics = {
      totalInteractions: interactions.length,
      successfulInteractions: interactions.filter(i => i.success).length,
      failedInteractions: interactions.filter(i => !i.success).length,
      averageDuration: interactions.length > 0 
        ? interactions.reduce((sum, i) => sum + (i.duration || 0), 0) / interactions.length
        : 0,
      totalFunctionCalls: interactions.reduce((sum, i) => sum + (i.functionCount || 0), 0),
      modelsUsed: [...new Set(interactions.map(i => i.model).filter(Boolean))],
      dailyUsage: this.calculateDailyUsage(interactions),
      errorRates: this.calculateErrorRates(interactions)
    };

    return analytics;
  }

  /**
   * Calculate daily usage patterns
   */
  calculateDailyUsage(interactions) {
    const dailyUsage = {};
    
    interactions.forEach(interaction => {
      const date = interaction.timestamp.toISOString().split('T')[0];
      if (!dailyUsage[date]) {
        dailyUsage[date] = {
          total: 0,
          successful: 0,
          failed: 0,
          duration: 0
        };
      }
      
      dailyUsage[date].total++;
      if (interaction.success) {
        dailyUsage[date].successful++;
      } else {
        dailyUsage[date].failed++;
      }
      dailyUsage[date].duration += interaction.duration || 0;
    });

    return dailyUsage;
  }

  /**
   * Calculate error rates by type
   */
  calculateErrorRates(interactions) {
    const errorTypes = {};
    const failedInteractions = interactions.filter(i => !i.success);
    
    failedInteractions.forEach(interaction => {
      const errorType = interaction.error || 'Unknown Error';
      if (!errorTypes[errorType]) {
        errorTypes[errorType] = 0;
      }
      errorTypes[errorType]++;
    });

    return {
      totalErrors: failedInteractions.length,
      errorTypes,
      errorRate: interactions.length > 0 
        ? (failedInteractions.length / interactions.length * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Health check for hybrid AI service
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      initialized: this.initialized,
      development: this.isDevelopment,
      anthropicAvailable: !!this.anthropic,
      claudeCodeEnabled: this.useClaudeCode,
      timestamp: new Date()
    };

    // Test API connectivity if available
    if (this.anthropic) {
      try {
        // Simple test message
        const testResponse = await this.anthropic.messages.create({
          model: 'claude-sonnet-5',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 10,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'high' }
        });
        
        health.apiTest = {
          success: true,
          responseTime: Date.now() - Date.now() // This would be measured properly
        };
      } catch (error) {
        health.apiTest = {
          success: false,
          error: error.message
        };
        health.status = 'degraded';
      }
    }

    return health;
  }

  /**
   * Configure AI service settings
   */
  configureService(settings = {}) {
    if (settings.useClaudeCode !== undefined) {
      this.useClaudeCode = settings.useClaudeCode;
    }
    
    // Return current configuration
    return {
      isDevelopment: this.isDevelopment,
      useClaudeCode: this.useClaudeCode,
      anthropicAvailable: !!this.anthropic,
      initialized: this.initialized
    };
  }
}

// Create and export singleton instance
const hybridAIService = new HybridAIService();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('hybridAIService', () => hybridAIService);
}

module.exports = hybridAIService;