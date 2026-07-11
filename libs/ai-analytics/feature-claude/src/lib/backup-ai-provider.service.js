// Backup AI Provider Service for IntelliCare
// Multi-provider fallback system with intelligent routing and cost optimization

const EventEmitter = require('events');
const axios = require('axios');

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class BackupAIProviderService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Provider priorities (lower number = higher priority)
      providers: {
        'gemini': {
          name: 'Google Gemini',
          priority: 1,
          enabled: true,
          costPerToken: 0.00002,
          rateLimit: 60, // requests per minute
          timeout: 30000,
          maxTokens: 32768,
          supportedOperations: ['diagnosis', 'chat', 'analysis', 'translation'],
          reliability: 0.95
        },
        'openai': {
          name: 'OpenAI GPT',
          priority: 2,
          enabled: false, // Disabled by default - requires API key
          costPerToken: 0.00003,
          rateLimit: 50,
          timeout: 30000,
          maxTokens: 16384,
          supportedOperations: ['diagnosis', 'chat', 'analysis', 'translation'],
          reliability: 0.92
        },
        'anthropic': {
          name: 'Anthropic Claude',
          priority: 3,
          enabled: false, // Disabled by default - requires API key
          costPerToken: 0.000025,
          rateLimit: 40,
          timeout: 30000,
          maxTokens: 8192,
          supportedOperations: ['diagnosis', 'chat', 'analysis'],
          reliability: 0.90
        },
        'local_model': {
          name: 'Local Medical Model',
          priority: 4,
          enabled: false, // Disabled by default - requires local setup
          costPerToken: 0.00001,
          rateLimit: 20,
          timeout: 60000,
          maxTokens: 4096,
          supportedOperations: ['diagnosis', 'basic_chat'],
          reliability: 0.80
        },
        'fallback_responses': {
          name: 'Predefined Fallback Responses',
          priority: 10,
          enabled: true,
          costPerToken: 0,
          rateLimit: 1000,
          timeout: 100,
          maxTokens: 1024,
          supportedOperations: ['diagnosis', 'chat', 'analysis'],
          reliability: 1.0
        }
      },
      
      // Fallback strategy
      maxRetries: 3,
      retryDelay: 1000, // Base delay in ms
      useExponentialBackoff: true,
      
      // Load balancing
      enableLoadBalancing: true,
      loadBalancingStrategy: 'weighted_round_robin', // round_robin, weighted_round_robin, least_connections
      
      // Cost optimization
      enableCostOptimization: true,
      costThreshold: 1.0, // Switch to cheaper provider if cost exceeds this per request
      
      // Health monitoring
      healthCheckInterval: 60000, // 1 minute
      enableHealthChecks: true,
      
      // Circuit breaker integration
      enableCircuitBreaker: true,
      
      // Caching integration
      enableCaching: true
    };
    
    // Provider states
    this.providerStates = new Map();
    this.providerMetrics = new Map();
    this.lastUsedProvider = new Map(); // Track last used provider per operation
    
    // Load balancing state
    this.roundRobinIndex = 0;
    this.connectionCounts = new Map();
    
    // Health check state
    this.healthCheckTimer = null;
    this.serviceToken = null;
  }
  
  async initialize() {
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('backup-ai-provider');
    
    // Initialize provider states
    for (const [providerId, config] of Object.entries(this.config.providers)) {
      this.providerStates.set(providerId, {
        enabled: config.enabled,
        healthy: true,
        lastHealthCheck: null,
        consecutiveFailures: 0,
        lastFailure: null,
        circuitBreakerOpen: false
      });
      
      this.providerMetrics.set(providerId, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalCost: 0,
        averageResponseTime: 0,
        responseTimes: [],
        lastUsed: null
      });
      
      this.connectionCounts.set(providerId, 0);
    }
    
    // Start health checks
    if (this.config.enableHealthChecks) {
      this.startHealthChecks();
    }
    
    console.log('🔄 Backup AI Provider Service initialized');
    console.log(`📊 Available providers: ${Object.keys(this.config.providers).join(', ')}`);
    
    return this;
  }
  
  // Execute AI operation with provider fallback
  async executeWithFallback(operation, params, options = {}) {
    const startTime = Date.now();
    let lastError = null;
    let attemptCount = 0;
    const maxAttempts = Math.min(this.config.maxRetries + 1, this.getEnabledProviders().length);
    
    console.log(`🤖 Executing ${operation} with fallback support`);
    
    while (attemptCount < maxAttempts) {
      attemptCount++;
      
      try {
        // Select best provider for this attempt
        const provider = this.selectProvider(operation, attemptCount);
        if (!provider) {
          throw new Error('No available AI providers');
        }
        
        console.log(`🔄 Attempt ${attemptCount}: Using ${provider.name}`);
        
        // Execute with selected provider
        const result = await this.executeWithProvider(provider.id, operation, params, options);
        
        const duration = Date.now() - startTime;
        console.log(`✅ ${operation} completed with ${provider.name} in ${duration}ms`);
        
        // Record success
        this.recordProviderSuccess(provider.id, duration, result);
        
        this.emit('operation_success', {
          operation: operation,
          provider: provider.id,
          attempt: attemptCount,
          duration: duration,
          timestamp: new Date()
        });
        
        return {
          result: result,
          provider: provider.id,
          attempt: attemptCount,
          duration: duration,
          success: true
        };
        
      } catch (error) {
        lastError = error;
        
        console.error(`❌ Attempt ${attemptCount} failed:`, error.message);
        
        // Record failure for the provider that was attempted
        const attemptedProvider = this.selectProvider(operation, attemptCount);
        if (attemptedProvider) {
          this.recordProviderFailure(attemptedProvider.id, error);
        }
        
        // Wait before retry if not last attempt
        if (attemptCount < maxAttempts) {
          const delay = this.calculateRetryDelay(attemptCount);
          console.log(`⏳ Waiting ${delay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All attempts failed
    const duration = Date.now() - startTime;
    console.error(`❌ All fallback attempts failed for ${operation}`);
    
    this.emit('operation_failed', {
      operation: operation,
      attempts: attemptCount,
      duration: duration,
      lastError: lastError?.message,
      timestamp: new Date()
    });
    
    // Return fallback response if available
    const fallbackResponse = await this.generateFallbackResponse(operation, params, lastError);
    
    return {
      result: fallbackResponse,
      provider: 'fallback',
      attempt: attemptCount,
      duration: duration,
      success: false,
      error: lastError?.message
    };
  }
  
  // Select the best provider for an operation
  selectProvider(operation, attemptNumber = 1) {
    const enabledProviders = this.getEnabledProvidersForOperation(operation);
    
    if (enabledProviders.length === 0) {
      return null;
    }
    
    // For first attempt, use primary selection strategy
    if (attemptNumber === 1) {
      return this.selectPrimaryProvider(operation, enabledProviders);
    }
    
    // For retries, exclude previously failed providers
    const availableProviders = enabledProviders.filter(provider => {
      const state = this.providerStates.get(provider.id);
      return state.healthy && !state.circuitBreakerOpen;
    });
    
    if (availableProviders.length === 0) {
      // All providers failed, try fallback
      return enabledProviders.find(p => p.id === 'fallback_responses') || enabledProviders[0];
    }
    
    // Select based on priority and health
    return availableProviders.sort((a, b) => {
      const configA = this.config.providers[a.id];
      const configB = this.config.providers[b.id];
      return configA.priority - configB.priority;
    })[0];
  }
  
  // Select primary provider using configured strategy
  selectPrimaryProvider(operation, providers) {
    if (!this.config.enableLoadBalancing || providers.length === 1) {
      return providers[0];
    }
    
    switch (this.config.loadBalancingStrategy) {
      case 'round_robin':
        return this.selectRoundRobin(providers);
      
      case 'weighted_round_robin':
        return this.selectWeightedRoundRobin(providers);
      
      case 'least_connections':
        return this.selectLeastConnections(providers);
      
      default:
        return providers[0];
    }
  }
  
  // Round robin selection
  selectRoundRobin(providers) {
    const provider = providers[this.roundRobinIndex % providers.length];
    this.roundRobinIndex++;
    return provider;
  }
  
  // Weighted round robin based on reliability and cost
  selectWeightedRoundRobin(providers) {
    const weights = providers.map(provider => {
      const config = this.config.providers[provider.id];
      const metrics = this.providerMetrics.get(provider.id);
      
      // Calculate weight based on reliability, cost, and recent performance
      let weight = config.reliability * 100;
      
      // Adjust for cost (lower cost = higher weight)
      weight += (1 / (config.costPerToken || 0.00001)) * 10;
      
      // Adjust for recent performance
      if (metrics.successfulRequests > 0) {
        const successRate = metrics.successfulRequests / metrics.totalRequests;
        weight *= successRate;
      }
      
      return Math.max(1, weight);
    });
    
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < providers.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return providers[i];
      }
    }
    
    return providers[0];
  }
  
  // Select provider with least active connections
  selectLeastConnections(providers) {
    return providers.reduce((best, provider) => {
      const bestConnections = this.connectionCounts.get(best.id) || 0;
      const providerConnections = this.connectionCounts.get(provider.id) || 0;
      
      return providerConnections < bestConnections ? provider : best;
    });
  }
  
  // Execute operation with specific provider
  async executeWithProvider(providerId, operation, params, options = {}) {
    const config = this.config.providers[providerId];
    const startTime = Date.now();
    
    // Increment connection count
    this.connectionCounts.set(providerId, (this.connectionCounts.get(providerId) || 0) + 1);
    
    try {
      let result;
      
      switch (providerId) {
        case 'gemini':
          result = await this.executeGemini(operation, params, options);
          break;
        
        case 'openai':
          result = await this.executeOpenAI(operation, params, options);
          break;
        
        case 'anthropic':
          result = await this.executeAnthropic(operation, params, options);
          break;
        
        case 'local_model':
          result = await this.executeLocalModel(operation, params, options);
          break;
        
        case 'fallback_responses':
          result = await this.executeFallbackResponses(operation, params, options);
          break;
        
        default:
          throw new Error(`Unknown provider: ${providerId}`);
      }
      
      // Calculate cost
      const tokens = this.estimateTokens(params, result);
      const cost = tokens * (config.costPerToken || 0);
      
      return {
        ...result,
        metadata: {
          provider: providerId,
          tokens: tokens,
          cost: cost,
          responseTime: Date.now() - startTime
        }
      };
      
    } finally {
      // Decrement connection count
      this.connectionCounts.set(providerId, Math.max(0, (this.connectionCounts.get(providerId) || 0) - 1));
    }
  }
  
  // Execute with Google Gemini
  async executeGemini(operation, params, options) {
    const proxy = getServiceProxy();
    const secureConfigService = proxy.getService('secureConfigService');
    
    if (!secureConfigService.get('GEMINI_API_KEY')) {
      throw new Error('Gemini API key not configured');
    }
    
    const { GoogleGenAI } = require('@google/genai');
    const genAI = new GoogleGenAI(secureConfigService.get('GEMINI_API_KEY'));
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = this.buildPrompt(operation, params);
    
    const response = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Gemini timeout')), this.config.providers.gemini.timeout)
      )
    ]);
    
    const text = response.response.text();
    return this.parseResponse(operation, text);
  }
  
  // Execute with OpenAI
  async executeOpenAI(operation, params, options) {
    const proxy = getServiceProxy();
    const secureConfigService = proxy.getService('secureConfigService');
    
    if (!secureConfigService.get('OPENAI_API_KEY')) {
      throw new Error('OpenAI API key not configured');
    }
    
    const prompt = this.buildPrompt(operation, params);
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a medical AI assistant.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: Math.min(params.maxTokens || 1000, this.config.providers.openai.maxTokens),
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${secureConfigService.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      timeout: this.config.providers.openai.timeout
    });
    
    const text = response.data.choices[0]?.message?.content || '';
    return this.parseResponse(operation, text);
  }
  
  // Execute with Anthropic Claude
  async executeAnthropic(operation, params, options) {
    const proxy = getServiceProxy();
    const secureConfigService = proxy.getService('secureConfigService');
    
    if (!secureConfigService.get('ANTHROPIC_API_KEY')) {
      throw new Error('Anthropic API key not configured');
    }
    
    const prompt = this.buildPrompt(operation, params);
    
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: Math.min(params.maxTokens || 1000, this.config.providers.anthropic.maxTokens),
      messages: [
        { role: 'user', content: prompt }
      ],
      system: 'You are a medical AI assistant.',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' }
    }, {
      headers: {
        'Authorization': `Bearer ${secureConfigService.get('ANTHROPIC_API_KEY')}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: this.config.providers.anthropic.timeout
    });
    
    const text = response.data.content[0]?.text || '';
    return this.parseResponse(operation, text);
  }
  
  // Execute with local model
  async executeLocalModel(operation, params, options) {
    // This would connect to a local AI model endpoint
    // For now, simulate a local model response
    
    const prompt = this.buildPrompt(operation, params);
    
    // Simulate API call to local model
    const response = await axios.post('http://localhost:8000/generate', {
      prompt: prompt,
      max_tokens: Math.min(params.maxTokens || 500, this.config.providers.local_model.maxTokens)
    }, {
      timeout: this.config.providers.local_model.timeout
    });
    
    return this.parseResponse(operation, response.data.text);
  }
  
  // Execute with fallback responses
  async executeFallbackResponses(operation, params, options) {
    const fallbackResponses = {
      diagnosis: {
        success: true,
        message: 'I apologize, but our AI diagnostic system is temporarily unavailable. Please consult with a healthcare professional for medical diagnosis.',
        data: {
          primaryDiagnosis: 'Unable to diagnose - system unavailable',
          confidence: 0,
          recommendations: [
            'Consult with a healthcare professional',
            'Monitor symptoms carefully',
            'Seek emergency care if symptoms worsen'
          ]
        }
      },
      
      chat: {
        success: true,
        message: 'I apologize, but our AI chat system is temporarily experiencing issues. Please try again later or consult with a healthcare professional.',
        data: {
          response: 'System temporarily unavailable',
          language: params.language || 'en'
        }
      },
      
      analysis: {
        success: true,
        message: 'Document analysis service is temporarily unavailable. Please try again later.',
        data: {
          analysisResult: 'Analysis unavailable',
          confidence: 0,
          category: 'unknown'
        }
      }
    };
    
    return fallbackResponses[operation] || {
      success: false,
      message: 'Service temporarily unavailable',
      data: null
    };
  }
  
  // Build prompt for AI providers
  buildPrompt(operation, params) {
    const language = params.language === 'he' ? 'Hebrew' : 'English';
    
    switch (operation) {
      case 'diagnosis':
        return `Please analyze these medical symptoms and provide a diagnosis in ${language}:
Symptoms: ${params.symptoms || ''}
Age: ${params.age || 'Not specified'}
Gender: ${params.gender || 'Not specified'}

Please provide:
1. Primary diagnosis
2. Confidence level (0-100%)
3. Differential diagnoses if applicable
4. Recommended next steps

Respond in ${language}.`;
      
      case 'chat':
        return `As a medical AI assistant, please respond to this message in ${language}:
${params.message || params.query}

Provide helpful, accurate medical information while recommending professional consultation when appropriate.`;
      
      case 'analysis':
        return `Please analyze this medical document content in ${language}:
${params.content || params.text}

Provide:
1. Document type identification
2. Key medical information extraction
3. Relevance assessment
4. Any concerns or red flags`;
      
      default:
        return `Please help with this medical query in ${language}: ${params.query || params.message}`;
    }
  }
  
  // Parse AI response
  parseResponse(operation, text) {
    // Basic response parsing - in production, this would be more sophisticated
    return {
      success: true,
      message: text,
      data: {
        rawResponse: text,
        operation: operation,
        timestamp: new Date()
      }
    };
  }
  
  // Estimate token usage
  estimateTokens(params, result) {
    const inputText = JSON.stringify(params);
    const outputText = JSON.stringify(result);
    
    // Rough estimation: ~4 characters per token
    return Math.ceil((inputText.length + outputText.length) / 4);
  }
  
  // Generate fallback response when all providers fail
  async generateFallbackResponse(operation, params, error) {
    const fallbackProvider = this.config.providers.fallback_responses;
    
    if (fallbackProvider.enabled) {
      return await this.executeFallbackResponses(operation, params);
    }
    
    // Ultimate fallback
    return {
      success: false,
      message: 'All AI services are temporarily unavailable. Please try again later.',
      error: error?.message || 'Service unavailable',
      data: null
    };
  }
  
  // Get enabled providers
  getEnabledProviders() {
    return Object.entries(this.config.providers)
      .filter(([id, config]) => {
        const state = this.providerStates.get(id);
        return config.enabled && state.enabled && state.healthy && !state.circuitBreakerOpen;
      })
      .map(([id, config]) => ({ id, ...config }))
      .sort((a, b) => a.priority - b.priority);
  }
  
  // Get enabled providers for specific operation
  getEnabledProvidersForOperation(operation) {
    return this.getEnabledProviders()
      .filter(provider => provider.supportedOperations.includes(operation));
  }
  
  // Calculate retry delay
  calculateRetryDelay(attemptNumber) {
    if (!this.config.useExponentialBackoff) {
      return this.config.retryDelay;
    }
    
    const baseDelay = this.config.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attemptNumber - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
    
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }
  
  // Record provider success
  recordProviderSuccess(providerId, responseTime, result) {
    const metrics = this.providerMetrics.get(providerId);
    const state = this.providerStates.get(providerId);
    
    if (metrics) {
      metrics.totalRequests++;
      metrics.successfulRequests++;
      metrics.responseTimes.push(responseTime);
      metrics.lastUsed = Date.now();
      
      // Keep only last 100 response times
      if (metrics.responseTimes.length > 100) {
        metrics.responseTimes.shift();
      }
      
      // Update average response time
      const sum = metrics.responseTimes.reduce((a, b) => a + b, 0);
      metrics.averageResponseTime = sum / metrics.responseTimes.length;
      
      // Estimate cost
      const tokens = this.estimateTokens({}, result);
      const cost = tokens * (this.config.providers[providerId].costPerToken || 0);
      metrics.totalCost += cost;
    }
    
    if (state) {
      state.healthy = true;
      state.consecutiveFailures = 0;
      state.lastFailure = null;
      state.circuitBreakerOpen = false;
    }
  }
  
  // Record provider failure
  recordProviderFailure(providerId, error) {
    const metrics = this.providerMetrics.get(providerId);
    const state = this.providerStates.get(providerId);
    
    if (metrics) {
      metrics.totalRequests++;
      metrics.failedRequests++;
    }
    
    if (state) {
      state.consecutiveFailures++;
      state.lastFailure = {
        error: error.message,
        timestamp: Date.now()
      };
      
      // Open circuit breaker after 3 consecutive failures
      if (state.consecutiveFailures >= 3) {
        state.circuitBreakerOpen = true;
        state.healthy = false;
        
        console.warn(`🚫 Circuit breaker opened for provider ${providerId}`);
        
        // Schedule circuit breaker reset
        setTimeout(() => {
          if (state.circuitBreakerOpen) {
            state.circuitBreakerOpen = false;
            console.log(`🔄 Circuit breaker reset for provider ${providerId}`);
          }
        }, 60000); // Reset after 1 minute
      }
    }
  }
  
  // Start health checks
  startHealthChecks() {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }
  
  // Perform health checks on all providers
  async performHealthChecks() {
    console.log('🔍 Performing provider health checks...');
    
    const healthCheckPromises = Object.keys(this.config.providers).map(providerId => 
      this.checkProviderHealth(providerId)
    );
    
    await Promise.allSettled(healthCheckPromises);
  }
  
  // Check individual provider health
  async checkProviderHealth(providerId) {
    const config = this.config.providers[providerId];
    const state = this.providerStates.get(providerId);
    
    if (!config.enabled || providerId === 'fallback_responses') {
      return; // Skip disabled providers and fallback
    }
    
    try {
      // Perform a simple test request
      const testParams = {
        message: 'Health check test',
        language: 'en'
      };
      
      await this.executeWithProvider(providerId, 'chat', testParams, { timeout: 10000 });
      
      // Health check passed
      state.healthy = true;
      state.lastHealthCheck = Date.now();
      
      // Reset circuit breaker if it was open
      if (state.circuitBreakerOpen && state.consecutiveFailures < 3) {
        state.circuitBreakerOpen = false;
      }
      
    } catch (error) {
      console.warn(`⚠️ Health check failed for ${providerId}:`, error.message);
      
      state.healthy = false;
      state.lastHealthCheck = Date.now();
      state.consecutiveFailures++;
    }
  }
  
  // Get provider statistics
  getProviderStats() {
    const stats = {};
    
    for (const [providerId, metrics] of this.providerMetrics.entries()) {
      const state = this.providerStates.get(providerId);
      const config = this.config.providers[providerId];
      
      stats[providerId] = {
        name: config.name,
        enabled: state.enabled,
        healthy: state.healthy,
        circuitBreakerOpen: state.circuitBreakerOpen,
        metrics: {
          ...metrics,
          successRate: metrics.totalRequests > 0 ? 
            Math.round((metrics.successfulRequests / metrics.totalRequests) * 100) : 0
        },
        config: {
          priority: config.priority,
          costPerToken: config.costPerToken,
          supportedOperations: config.supportedOperations
        }
      };
    }
    
    return stats;
  }
  
  // Get service status
  getStatus() {
    const enabledProviders = this.getEnabledProviders();
    const healthyProviders = enabledProviders.filter(p => {
      const state = this.providerStates.get(p.id);
      return state.healthy && !state.circuitBreakerOpen;
    });
    
    return {
      healthy: healthyProviders.length > 0,
      totalProviders: Object.keys(this.config.providers).length,
      enabledProviders: enabledProviders.length,
      healthyProviders: healthyProviders.length,
      providerStats: this.getProviderStats(),
      lastHealthCheck: Math.max(...Array.from(this.providerStates.values()).map(s => s.lastHealthCheck || 0)),
      timestamp: new Date()
    };
  }
  
  // Enable/disable provider
  setProviderEnabled(providerId, enabled) {
    const state = this.providerStates.get(providerId);
    if (state) {
      state.enabled = enabled;
      console.log(`${enabled ? '✅' : '❌'} Provider ${providerId} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }
  
  // Reset provider circuit breaker
  resetCircuitBreaker(providerId) {
    const state = this.providerStates.get(providerId);
    if (state) {
      state.circuitBreakerOpen = false;
      state.consecutiveFailures = 0;
      state.healthy = true;
      console.log(`🔄 Circuit breaker reset for ${providerId}`);
    }
  }
  
  // Handle message for IntelliCare chat interface
  async handleMessage(message, sessionId, language, practiceContext) {
    try {
      // Use Gemini as the primary backup provider
      const geminiService = require('../../../../../backend/services/geminiService');
      
      // Prepare the request for Gemini
      const prompt = {
        message: message,
        language: language,
        context: {
          practice: practiceContext.name || 'IntelliCare',
          country: practiceContext.country || (language === 'he' ? 'Israel' : 'US'),
          sessionId: sessionId
        }
      };
      
      // Call Gemini service
      const response = await geminiService.generateResponse(prompt);
      
      return {
        success: true,
        message: response.text || response.message || response,
        sessionId: sessionId,
        provider: 'gemini'
      };
      
    } catch (error) {
      console.error('Backup AI provider error:', error);
      
      // Return a helpful fallback message
      return {
        success: false,
        message: language === 'he'
          ? 'מצטערים, כל שירותי ה-AI אינם זמינים כרגע. אנא נסה שוב מאוחר יותר או פנה לתמיכה.'
          : 'Sorry, all AI services are currently unavailable. Please try again later or contact support.',
        error: error.message
      };
    }
  }
  
  async shutdown() {
    console.log('🛑 Shutting down Backup AI Provider Service...');
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    const stats = this.getStatus();
    console.log(`📊 Final provider stats: ${stats.healthyProviders}/${stats.totalProviders} providers healthy`);
    
    console.log('✅ Backup AI Provider Service shutdown complete');
  }
}

// Create and export singleton instance
let backupAIProviderService = null;

function createBackupAIProviderService() {
  if (!backupAIProviderService) {
    const proxy = getServiceProxy();
    const secureConfigService = proxy.getService('secureConfigService');
    
    backupAIProviderService = new BackupAIProviderService({
      maxRetries: parseInt(secureConfigService.get('AI_FALLBACK_MAX_RETRIES')) || 3,
      enableLoadBalancing: secureConfigService.get('AI_FALLBACK_ENABLE_LOAD_BALANCING') !== 'false',
      enableCostOptimization: secureConfigService.get('AI_FALLBACK_ENABLE_COST_OPTIMIZATION') !== 'false',
      enableHealthChecks: secureConfigService.get('AI_FALLBACK_ENABLE_HEALTH_CHECKS') !== 'false'
    });
  }
  return backupAIProviderService;
}

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('backupAIProviderService', () => createBackupAIProviderService());
}

module.exports = {
  BackupAIProviderService,
  get backupAIProviderService() {
    return createBackupAIProviderService();
  }
};