/**
 * External API Gateway Service - Modular Version
 * Unified gateway for all external healthcare API integrations providing secure,
 * rate-limited, and cached access to FDA, CMS, NIH, NCBI, and commercial APIs.
 */

const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const NodeCache = require(path.resolve(__dirname, '../../../backend/node_modules/node-cache'));
const serviceAccountManager = require(path.resolve(__dirname, '../../../backend/services/serviceAccountManager'));
const SecureDataAccess = require(path.resolve(__dirname, '../../../backend/services/secureDataAccess'));
const productionKMS = require(path.resolve(__dirname, '../../../backend/services/productionKMS'));

class ExternalApiGatewayService {
  constructor() {
    this.serviceId = 'external-api-gateway-service';
    this.serviceToken = null;
    this.initialized = false;
    this.apiConfigs = new Map();
    this.rateLimits = new Map();
    this.circuitBreakers = new Map();
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5 min default TTL
    
    // API Provider Configurations
    this.providers = {
      openFDA: {
        name: 'FDA OpenFDA API',
        baseUrl: 'https://api.fda.gov',
        rateLimit: { requests: 240, window: 60000 }, // 240 req/min
        dailyLimit: { requests: 120000, window: 86400000 }, // 120K/day
        requiresKey: true,
        keyParam: 'api_key',
        cacheTTL: 3600, // 1 hour
        endpoints: {
          drugEvents: '/drug/event.json',
          drugLabels: '/drug/label.json',
          drugEnforcement: '/drug/enforcement.json'
        }
      },
      
      cms: {
        name: 'CMS Provider Directory',
        baseUrl: 'https://api.cms.gov',
        rateLimit: { requests: 100, window: 60000 }, // 100 req/min
        requiresKey: false,
        cacheTTL: 7200, // 2 hours
        endpoints: {
          providers: '/provider-directory/v1/providers',
          plans: '/provider-directory/v1/plans'
        }
      },
      
      clinicalTrials: {
        name: 'ClinicalTrials.gov API',
        baseUrl: 'https://www.clinicaltrials.gov/api/v2',
        rateLimit: { requests: 60, window: 60000 }, // 60 req/min
        requiresKey: false,
        cacheTTL: 1800, // 30 minutes
        endpoints: {
          studies: '/studies',
          locations: '/locations'
        }
      },
      
      nihReporter: {
        name: 'NIH RePORTER API',
        baseUrl: 'https://api.reporter.nih.gov/v2',
        rateLimit: { requests: 60, window: 60000 }, // 60 req/min
        requiresKey: false,
        cacheTTL: 3600, // 1 hour
        endpoints: {
          projects: '/projects/search',
          publications: '/publications/search'
        }
      },
      
      pubmed: {
        name: 'PubMed E-utilities',
        baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
        rateLimit: { requests: 10, window: 1000 }, // 10 req/sec without key
        requiresKey: true,
        keyParam: 'api_key',
        cacheTTL: 7200, // 2 hours
        endpoints: {
          search: '/esearch.fcgi',
          fetch: '/efetch.fcgi'
        }
      }
    };
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Load API keys from KMS
      await this.loadApiKeys();
      
      // Initialize rate limiters
      this.initializeRateLimiters();
      
      // Initialize circuit breakers
      this.initializeCircuitBreakers();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.initialized = true;
      
      // Log initialization using SecureDataAccess
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      };
      
      await SecureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'external-api-gateway-service',
        timestamp: new Date()
      }, context);
      
      console.log('✅ External API Gateway Service initialized');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize External API Gateway Service:', error);
      throw error;
    }
  }

  /**
   * Load API keys from KMS for providers that require authentication
   */
  async loadApiKeys() {
    const requiredKeys = [
      'OPENFDA_API_KEY',
      'PUBMED_API_KEY', 
      'BETTERDOCTOR_API_KEY',
      'GOOGLE_HEALTHCARE_API_KEY'
    ];
    
    for (const keyName of requiredKeys) {
      try {
        const key = await productionKMS.getInternalKey(keyName);
        if (key) {
          this.apiConfigs.set(keyName, key);
          console.log(`✅ Loaded API key: ${keyName}`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not load API key ${keyName}:`, error.message);
      }
    }
  }

  /**
   * Initialize rate limiters for each API provider
   */
  initializeRateLimiters() {
    for (const [providerId, config] of Object.entries(this.providers)) {
      this.rateLimits.set(providerId, {
        requests: new Map(),
        dailyRequests: new Map(),
        config: config.rateLimit,
        dailyConfig: config.dailyLimit
      });
    }
  }

  /**
   * Initialize circuit breakers for fault tolerance
   */
  initializeCircuitBreakers() {
    for (const providerId of Object.keys(this.providers)) {
      this.circuitBreakers.set(providerId, {
        failures: 0,
        lastFailure: null,
        state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
        threshold: 5,
        timeout: 30000 // 30 seconds
      });
    }
  }

  /**
   * Check if request is within rate limits
   */
  async checkRateLimit(providerId, userId = 'system') {
    const limiter = this.rateLimits.get(providerId);
    if (!limiter) return true;
    
    const now = Date.now();
    const key = `${providerId}_${userId}`;
    
    // Check per-minute rate limit
    if (limiter.config) {
      const requests = limiter.requests.get(key) || [];
      const recentRequests = requests.filter(time => now - time < limiter.config.window);
      
      if (recentRequests.length >= limiter.config.requests) {
        throw new Error(`Rate limit exceeded for ${providerId}: ${limiter.config.requests} requests per ${limiter.config.window/1000} seconds`);
      }
      
      recentRequests.push(now);
      limiter.requests.set(key, recentRequests);
    }
    
    return true;
  }

  /**
   * Check circuit breaker state
   */
  checkCircuitBreaker(providerId) {
    const breaker = this.circuitBreakers.get(providerId);
    if (!breaker) return true;
    
    const now = Date.now();
    
    if (breaker.state === 'OPEN') {
      if (now - breaker.lastFailure > breaker.timeout) {
        breaker.state = 'HALF_OPEN';
        console.log(`🔄 Circuit breaker for ${providerId} moving to HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker OPEN for ${providerId}. Service temporarily unavailable.`);
      }
    }
    
    return true;
  }

  /**
   * Record circuit breaker success
   */
  recordSuccess(providerId) {
    const breaker = this.circuitBreakers.get(providerId);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'CLOSED';
    }
  }

  /**
   * Record circuit breaker failure
   */
  recordFailure(providerId) {
    const breaker = this.circuitBreakers.get(providerId);
    if (breaker) {
      breaker.failures++;
      breaker.lastFailure = Date.now();
      
      if (breaker.failures >= breaker.threshold) {
        breaker.state = 'OPEN';
        console.warn(`🚨 Circuit breaker OPEN for ${providerId} after ${breaker.failures} failures`);
      }
    }
  }

  /**
   * Generate cache key for request
   */
  generateCacheKey(providerId, endpoint, params) {
    const paramString = JSON.stringify(params || {});
    return crypto.createHash('sha256')
      .update(`${providerId}_${endpoint}_${paramString}`)
      .digest('hex');
  }

  /**
   * Make API request through the gateway
   */
  async makeRequest(providerId, endpoint, params = {}, options = {}) {
    await this.initialize();
    
    const provider = this.providers[providerId];
    if (!provider) {
      throw new Error(`Unknown API provider: ${providerId}`);
    }
    
    // Check rate limits
    await this.checkRateLimit(providerId, options.userId);
    
    // Check circuit breaker
    this.checkCircuitBreaker(providerId);
    
    // Check cache first
    const cacheKey = this.generateCacheKey(providerId, endpoint, params);
    const cached = this.cache.get(cacheKey);
    if (cached && !options.skipCache) {
      console.log(`📋 Cache hit for ${providerId}/${endpoint}`);
      return cached;
    }
    
    try {
      // Build request URL
      const url = `${provider.baseUrl}${endpoint}`;
      const requestParams = { ...params };
      
      // Add API key if required
      if (provider.requiresKey) {
        const keyName = this.getApiKeyName(providerId);
        const apiKey = this.apiConfigs.get(keyName);
        if (apiKey) {
          requestParams[provider.keyParam] = apiKey;
        } else {
          console.warn(`⚠️ No API key found for ${providerId}`);
        }
      }
      
      // Make HTTP request
      const response = await axios.get(url, {
        params: requestParams,
        timeout: options.timeout || 30000,
        headers: {
          'User-Agent': 'IntelliCare/1.0 (Healthcare Management System)',
          'Accept': 'application/json',
          ...options.headers
        }
      });
      
      // Record success
      this.recordSuccess(providerId);
      
      // Cache response
      this.cache.set(cacheKey, response.data, provider.cacheTTL || 300);
      
      // Log successful request
      await this.logApiRequest(providerId, endpoint, params, response.status, options.userId);
      
      return response.data;
      
    } catch (error) {
      // Record failure
      this.recordFailure(providerId);
      
      // Log failed request
      await this.logApiRequest(providerId, endpoint, params, error.response?.status || 500, options.userId, error.message);
      
      console.error(`❌ API request failed for ${providerId}/${endpoint}:`, error.message);
      throw new Error(`External API request failed: ${error.message}`);
    }
  }

  /**
   * Get API key name for provider
   */
  getApiKeyName(providerId) {
    const keyMap = {
      openFDA: 'OPENFDA_API_KEY',
      pubmed: 'PUBMED_API_KEY',
      betterDoctor: 'BETTERDOCTOR_API_KEY',
      googleHealthcare: 'GOOGLE_HEALTHCARE_API_KEY'
    };
    return keyMap[providerId];
  }

  /**
   * Log API request for audit trail
   */
  async logApiRequest(providerId, endpoint, params, statusCode, userId, error = null) {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'log_api_request',
        practiceId: 'global'
      };
      
      await SecureDataAccess.create('audit_logs', {
        action: 'EXTERNAL_API_REQUEST',
        resourceType: 'api_gateway',
        resourceId: `${providerId}_${endpoint}`,
        userId: userId || 'system',
        details: {
          provider: providerId,
          endpoint: endpoint,
          statusCode: statusCode,
          paramCount: Object.keys(params || {}).length,
          error: error,
          timestamp: new Date()
        },
        severity: error ? 'MEDIUM' : 'LOW',
        timestamp: new Date()
      }, context);
    } catch (logError) {
      console.error('Failed to log API request:', logError);
    }
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(providerId) {
    const provider = this.providers[providerId];
    if (!provider) return null;
    
    const breaker = this.circuitBreakers.get(providerId);
    
    return {
      providerId: providerId,
      name: provider.name,
      status: breaker?.state || 'UNKNOWN',
      failures: breaker?.failures || 0,
      lastFailure: breaker?.lastFailure,
      rateLimit: {
        requests: provider.rateLimit?.requests || 0,
        window: provider.rateLimit?.window || 0
      },
      cacheTTL: provider.cacheTTL,
      requiresKey: provider.requiresKey,
      hasKey: provider.requiresKey ? this.apiConfigs.has(this.getApiKeyName(providerId)) : true
    };
  }

  /**
   * Get all providers health status
   */
  async getAllProvidersHealth() {
    const healthData = {};
    for (const providerId of Object.keys(this.providers)) {
      healthData[providerId] = await this.getProviderHealth(providerId);
    }
    return healthData;
  }

  /**
   * Clear cache for specific provider or all cache
   */
  clearCache(providerId = null) {
    if (providerId) {
      // Clear cache entries for specific provider
      const keys = this.cache.keys();
      for (const key of keys) {
        if (key.startsWith(providerId)) {
          this.cache.del(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.flushAll();
    }
  }

  /**
   * Start health monitoring for all providers
   */
  startHealthMonitoring() {
    setInterval(async () => {
      try {
        const health = await this.getAllProvidersHealth();
        const unhealthyProviders = Object.entries(health)
          .filter(([id, data]) => data.status === 'OPEN')
          .map(([id, data]) => id);
        
        if (unhealthyProviders.length > 0) {
          console.warn(`⚠️ Unhealthy API providers: ${unhealthyProviders.join(', ')}`);
        }
      } catch (error) {
        console.error('Health monitoring error:', error);
      }
    }, 60000); // Check every minute
  }

  /**
   * Test connection to a specific provider
   */
  async testConnection(providerId) {
    const provider = this.providers[providerId];
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }
    
    try {
      let testEndpoint;
      let testParams = {};
      
      switch (providerId) {
        case 'openFDA':
          testEndpoint = provider.endpoints.drugLabels;
          testParams = { limit: 1 };
          break;
        case 'clinicalTrials':
          testEndpoint = provider.endpoints.studies;
          testParams = { 'query.cond': 'diabetes', 'countTotal': true, 'pageSize': 1 };
          break;
        case 'pubmed':
          testEndpoint = provider.endpoints.search;
          testParams = { db: 'pubmed', term: 'covid', retmax: 1 };
          break;
        default:
          testEndpoint = Object.values(provider.endpoints)[0];
      }
      
      const result = await this.makeRequest(providerId, testEndpoint, testParams, { skipCache: true });
      
      return {
        success: true,
        provider: provider.name,
        endpoint: testEndpoint,
        responseSize: JSON.stringify(result).length,
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        success: false,
        provider: provider.name,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.serviceId,
      initialized: this.initialized,
      providersCount: Object.keys(this.providers).length,
      rateLimitersCount: this.rateLimits.size,
      circuitBreakersCount: this.circuitBreakers.size,
      cachedItemsCount: this.cache.keys().length,
      apiKeysLoaded: this.apiConfigs.size
    };
  }
}

module.exports = new ExternalApiGatewayService();