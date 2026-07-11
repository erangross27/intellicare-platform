# Task 3.11: Add Backup AI Provider

## 📋 **Task Overview**
**Phase:** 3 (Utilities, Monitoring & Resilience)  
**Time Estimate:** 15 minutes  
**Risk Level:** LOW  
**Priority:** LOW  

Add backup AI provider support to automatically fallback to alternative AI services when the primary service is unavailable.

## 🎯 **Objective**
Implement backup AI provider that:
- Automatically switches to backup when primary AI fails
- Supports multiple AI providers (OpenAI, Anthropic, Google)
- Maintains consistent response format across providers
- Provides seamless failover for users

## 🚨 **Availability Risk**
**LOW:** Without backup AI providers, service outages from primary AI provider affect all users.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add backup AI provider support**

## 🔍 **Current AI Provider Limitations**

### **Issue 1: Single AI Provider Dependency**
```javascript
// CURRENT - SINGLE POINT OF FAILURE
const result = await agent.processChatMessage(...);
// If Claude/Gemini is down, entire service fails
```

### **Issue 2: No Automatic Failover**
```javascript
// CURRENT - NO FAILOVER
try {
  const result = await primaryAI.call();
} catch (error) {
  // Service fails, no backup attempted
  throw error;
}
```

### **Issue 3: No Provider Diversity**
```javascript
// CURRENT - NO PROVIDER OPTIONS
// Only one AI service configured
// No redundancy for critical operations
```

## ✅ **Backup AI Provider System**

### **1. AI Provider Manager**
```javascript
// ADD at top of file after imports:

class AIProviderManager {
  constructor() {
    this.providers = new Map();
    this.primaryProvider = null;
    this.providerStats = new Map();
    
    this.setupProviders();
    console.log('🤖 AI Provider manager initialized');
  }
  
  setupProviders() {
    // ✅ PRIMARY: Gemini (current working provider)
    this.addProvider('gemini', {
      name: 'Google Gemini',
      type: 'primary',
      priority: 1,
      enabled: true,
      callFunction: this.callGemini.bind(this),
      healthCheck: this.checkGeminiHealth.bind(this)
    });
    
    // ✅ BACKUP: OpenAI GPT-4
    this.addProvider('openai', {
      name: 'OpenAI GPT-4',
      type: 'backup',
      priority: 2,
      enabled: !!process.env.OPENAI_API_KEY,
      callFunction: this.callOpenAI.bind(this),
      healthCheck: this.checkOpenAIHealth.bind(this)
    });
    
    // ✅ BACKUP: Anthropic Claude
    this.addProvider('anthropic', {
      name: 'Anthropic Claude',
      type: 'backup',
      priority: 3,
      enabled: !!process.env.ANTHROPIC_API_KEY,
      callFunction: this.callAnthropic.bind(this),
      healthCheck: this.checkAnthropicHealth.bind(this)
    });
    
    // Set primary provider
    this.primaryProvider = 'gemini';
  }
  
  addProvider(id, config) {
    this.providers.set(id, {
      id: id,
      ...config,
      lastUsed: null,
      successCount: 0,
      errorCount: 0,
      lastError: null,
      averageResponseTime: 0,
      totalResponseTime: 0
    });
    
    this.providerStats.set(id, {
      requests: 0,
      successes: 0,
      failures: 0,
      totalCost: 0,
      totalTokens: 0
    });
  }
  
  async callWithFallback(operation, context = {}) {
    const availableProviders = this.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      throw new Error('No AI providers available');
    }
    
    let lastError = null;
    
    for (const provider of availableProviders) {
      try {
        console.log(`🤖 Attempting AI call with provider: ${provider.name}`);
        
        const startTime = Date.now();
        const result = await this.callProvider(provider, operation, context);
        const responseTime = Date.now() - startTime;
        
        // Update provider stats
        this.updateProviderStats(provider.id, true, responseTime);
        
        // Add provider info to result
        result.aiProvider = {
          id: provider.id,
          name: provider.name,
          responseTime: responseTime,
          isPrimary: provider.id === this.primaryProvider
        };
        
        console.log(`✅ AI call successful with ${provider.name} (${responseTime}ms)`);
        
        return result;
        
      } catch (error) {
        lastError = error;
        console.log(`❌ AI call failed with ${provider.name}: ${error.message}`);
        
        // Update provider stats
        this.updateProviderStats(provider.id, false);
        
        // Update provider error info
        provider.lastError = error.message;
        provider.errorCount++;
        
        // Continue to next provider
        continue;
      }
    }
    
    // All providers failed
    throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
  }
  
  async callProvider(provider, operation, context) {
    const stats = this.providerStats.get(provider.id);
    stats.requests++;
    
    provider.lastUsed = new Date();
    
    // Call the provider-specific function
    const result = await provider.callFunction(operation, context);
    
    stats.successes++;
    
    return result;
  }
  
  updateProviderStats(providerId, success, responseTime = 0) {
    const provider = this.providers.get(providerId);
    const stats = this.providerStats.get(providerId);
    
    if (success) {
      provider.successCount++;
      provider.totalResponseTime += responseTime;
      provider.averageResponseTime = provider.totalResponseTime / provider.successCount;
    } else {
      provider.errorCount++;
      stats.failures++;
    }
  }
  
  getAvailableProviders() {
    return Array.from(this.providers.values())
      .filter(provider => provider.enabled)
      .sort((a, b) => a.priority - b.priority);
  }
  
  // ✅ GEMINI: Primary provider (existing implementation)
  async callGemini(operation, context) {
    // Use existing Gemini implementation
    return await agent[operation.method](...operation.args);
  }
  
  async checkGeminiHealth() {
    try {
      // Simple health check call
      const testResult = await agent.processChatMessage(
        'Hello', 
        'health-check', 
        'en', 
        { healthCheck: true }
      );
      
      return { healthy: true, responseTime: 100 };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
  
  // ✅ OPENAI: Backup provider
  async callOpenAI(operation, context) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }
    
    const { OpenAI } = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    if (operation.method === 'processChatMessage') {
      const [message, sessionId, language, practiceContext] = operation.args;
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a medical AI assistant. Respond in ${language === 'he' ? 'Hebrew' : 'English'}.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });
      
      return {
        success: true,
        action: 'chat_only',
        message: completion.choices[0].message.content,
        provider: 'openai',
        usage: completion.usage
      };
    }
    
    throw new Error(`OpenAI provider does not support method: ${operation.method}`);
  }
  
  async checkOpenAIHealth() {
    if (!process.env.OPENAI_API_KEY) {
      return { healthy: false, error: 'API key not configured' };
    }
    
    try {
      const { OpenAI } = require('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      
      const startTime = Date.now();
      await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      });
      
      const responseTime = Date.now() - startTime;
      return { healthy: true, responseTime: responseTime };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
  
  // ✅ ANTHROPIC: Backup provider
  async callAnthropic(operation, context) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }
    
    const { Anthropic } = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    if (operation.method === 'processChatMessage') {
      const [message, sessionId, language, practiceContext] = operation.args;
      
      const completion = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `You are a medical AI assistant. Respond in ${language === 'he' ? 'Hebrew' : 'English'}.\n\nUser: ${message}`
          }
        ]
      });
      
      return {
        success: true,
        action: 'chat_only',
        message: completion.content[0].text,
        provider: 'anthropic',
        usage: completion.usage
      };
    }
    
    throw new Error(`Anthropic provider does not support method: ${operation.method}`);
  }
  
  async checkAnthropicHealth() {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { healthy: false, error: 'API key not configured' };
    }
    
    try {
      const { Anthropic } = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
      
      const startTime = Date.now();
      await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }]
      });
      
      const responseTime = Date.now() - startTime;
      return { healthy: true, responseTime: responseTime };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
  
  getProviderStats() {
    const stats = {};
    
    for (const [id, provider] of this.providers) {
      const providerStats = this.providerStats.get(id);
      
      stats[id] = {
        name: provider.name,
        type: provider.type,
        enabled: provider.enabled,
        priority: provider.priority,
        lastUsed: provider.lastUsed,
        successCount: provider.successCount,
        errorCount: provider.errorCount,
        lastError: provider.lastError,
        averageResponseTime: provider.averageResponseTime,
        requests: providerStats.requests,
        successes: providerStats.successes,
        failures: providerStats.failures,
        successRate: providerStats.requests > 0 ? 
          (providerStats.successes / providerStats.requests) * 100 : 0
      };
    }
    
    return stats;
  }
  
  async checkAllProvidersHealth() {
    const healthResults = {};
    
    for (const [id, provider] of this.providers) {
      if (provider.enabled) {
        try {
          healthResults[id] = await provider.healthCheck();
        } catch (error) {
          healthResults[id] = { healthy: false, error: error.message };
        }
      } else {
        healthResults[id] = { healthy: false, error: 'Provider disabled' };
      }
    }
    
    return healthResults;
  }
}

// Create global AI provider manager
const aiProviders = new AIProviderManager();
global.aiProviders = aiProviders;
```

### **2. Update Chat Route with Backup Support**
```javascript
// UPDATE: Chat route with backup AI providers
router.post('/chat',
  // ... middleware ...
  asyncHandler(async (req, res) => {
    const logger = createLogger(req);
    
    try {
      const { message, sessionId = 'default', language = 'he' } = req.body;
      const clinicSessionId = createClinicSessionId(req.practiceSubdomain, sessionId);
      
      logger.info('Processing chat message with AI fallback', {
        messageLength: message.length,
        sessionId: sessionId,
        language: language
      });
      
      // ✅ USE: AI provider manager with automatic fallback
      const result = await aiProviders.callWithFallback({
        method: 'processChatMessage',
        args: [message, clinicSessionId, language, req.practiceContext]
      }, {
        requestId: req.requestId,
        practiceContext: req.practiceContext
      });
      
      // ✅ LOG: Provider used
      logger.info('Chat processing completed', {
        provider: result.aiProvider.name,
        isPrimary: result.aiProvider.isPrimary,
        responseTime: result.aiProvider.responseTime
      });
      
      // ✅ AUDIT: AI provider usage
      await correlatedAuditLog(req, 'AI_PROVIDER_USED', {
        provider: result.aiProvider.id,
        providerName: result.aiProvider.name,
        isPrimary: result.aiProvider.isPrimary,
        responseTime: result.aiProvider.responseTime,
        operation: 'chat'
      });
      
      result.requestId = req.requestId;
      res.json(result);
      
    } catch (error) {
      const logger = createLogger(req);
      logger.error('All AI providers failed for chat', error);
      
      await correlatedAuditLog(req, 'ALL_AI_PROVIDERS_FAILED', {
        operation: 'chat',
        error: error.message
      });
      
      throw error;
    }
  })
);
```

### **3. AI Provider Management Endpoints**
```javascript
// ADD: AI provider management endpoints
router.get('/ai-providers/status',
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const stats = aiProviders.getProviderStats();
      const health = await aiProviders.checkAllProvidersHealth();
      
      res.json({
        success: true,
        data: {
          providers: stats,
          health: health,
          primaryProvider: aiProviders.primaryProvider
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get AI provider status'
      });
    }
  })
);

router.post('/ai-providers/:providerId/enable',
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      // Only allow admin users
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }
      
      const { providerId } = req.params;
      const provider = aiProviders.providers.get(providerId);
      
      if (!provider) {
        return res.status(404).json({
          success: false,
          error: 'Provider not found'
        });
      }
      
      provider.enabled = true;
      
      await correlatedAuditLog(req, 'AI_PROVIDER_ENABLED', {
        providerId: providerId,
        providerName: provider.name,
        enabledBy: req.user._id
      });
      
      res.json({
        success: true,
        message: `Provider ${provider.name} enabled`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  })
);

router.post('/ai-providers/:providerId/disable',
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      // Only allow admin users
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }
      
      const { providerId } = req.params;
      const provider = aiProviders.providers.get(providerId);
      
      if (!provider) {
        return res.status(404).json({
          success: false,
          error: 'Provider not found'
        });
      }
      
      // Don't allow disabling primary provider if it's the only one
      if (providerId === aiProviders.primaryProvider) {
        const enabledProviders = aiProviders.getAvailableProviders();
        if (enabledProviders.length <= 1) {
          return res.status(400).json({
            success: false,
            error: 'Cannot disable the only available provider'
          });
        }
      }
      
      provider.enabled = false;
      
      await correlatedAuditLog(req, 'AI_PROVIDER_DISABLED', {
        providerId: providerId,
        providerName: provider.name,
        disabledBy: req.user._id
      });
      
      res.json({
        success: true,
        message: `Provider ${provider.name} disabled`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  })
);
```

### **4. AI Provider Health Monitoring**
```javascript
// ADD: AI provider health monitoring
const monitorAIProviders = () => {
  // Check provider health every 5 minutes
  setInterval(async () => {
    try {
      const health = await aiProviders.checkAllProvidersHealth();
      
      for (const [providerId, healthInfo] of Object.entries(health)) {
        const provider = aiProviders.providers.get(providerId);
        
        if (!healthInfo.healthy && provider.enabled) {
          console.log(`⚠️ AI provider ${provider.name} is unhealthy: ${healthInfo.error}`);
          
          if (global.alertSystem) {
            global.alertSystem.triggerAlert('AI_PROVIDER_UNHEALTHY', {
              providerId: providerId,
              providerName: provider.name,
              error: healthInfo.error,
              severity: providerId === aiProviders.primaryProvider ? 'critical' : 'warning'
            });
          }
        }
      }
      
      // Emit metrics
      if (global.metrics) {
        global.metrics.emit('ai_provider_health', health);
      }
      
    } catch (error) {
      console.error('❌ AI provider health check error:', error);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
};

// Start AI provider monitoring
monitorAIProviders();

// Add AI provider health to health checks
if (global.healthChecks) {
  global.healthChecks.addCheck('ai_providers', {
    name: 'AI Providers',
    timeout: 10000,
    critical: true,
    check: async () => {
      const health = await aiProviders.checkAllProvidersHealth();
      const stats = aiProviders.getProviderStats();
      
      const healthyProviders = Object.values(health).filter(h => h.healthy).length;
      const totalProviders = Object.keys(health).length;
      
      return {
        healthy_providers: healthyProviders,
        total_providers: totalProviders,
        primary_provider: aiProviders.primaryProvider,
        provider_health: health,
        provider_stats: stats,
        status: healthyProviders > 0 ? 'healthy' : 'critical'
      };
    }
  });
}
```

## ⚠️ **AI Provider Notes**
- **🚨 IMPORTANT:** Backup providers improve service availability
- **🚨 IMPORTANT:** Provider health monitoring prevents failures
- **🚨 IMPORTANT:** Automatic failover maintains user experience
- **❌ DON'T SKIP:** This provides critical service redundancy

## 🧪 **Testing After Implementation**
1. **Test provider failover:**
   - Disable primary provider and verify backup works
   - Test automatic failover during provider outages

2. **Test provider health:**
   - Verify health checks work for all providers
   - Test health monitoring and alerting

3. **Test provider management:**
   - Test enabling/disabling providers
   - Verify admin access controls

## ✅ **Success Criteria**
- [ ] AI provider manager operational
- [ ] Automatic failover working
- [ ] Provider health monitoring active
- [ ] Provider management endpoints functional
- [ ] Multiple AI providers configured
- [ ] Seamless user experience during failover

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 4.1:** Test Israeli Functions (Phase 4)

## 📝 **CRITICAL NOTES**
- **IMPROVES SERVICE AVAILABILITY** - backup providers essential for uptime
- **REDUCES SINGLE POINT OF FAILURE** - multiple AI services provide redundancy
- **MAINTAINS USER EXPERIENCE** - seamless failover prevents service interruption
- **TEST THOROUGHLY** - verify all providers work correctly and failover is smooth
