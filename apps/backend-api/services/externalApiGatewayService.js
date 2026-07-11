/**
 * External API Gateway Service
 * Unified gateway for all external healthcare API integrations providing secure,
 * rate-limited, and cached access to FDA, CMS, NIH, NCBI, and commercial APIs.
 * 
 * Features:
 * - Centralized API key management with KMS integration
 * - Intelligent rate limiting per API provider
 * - Response caching with TTL-based invalidation
 * - Circuit breaker pattern for fault tolerance
 * - Request/response transformation and validation
 * - Comprehensive audit logging
 * - HIPAA-compliant data handling
 * - Multi-provider failover support
 */

const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const NodeCache = require('node-cache');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const productionKMS = require('./productionKMS');
const encryptionService = require('./encryptionService');

// Force IPv4 for external API requests (fixes timeout issues with IPv6)
const httpsAgent = new https.Agent({
  family: 4,  // Force IPv4
  keepAlive: true,
  maxSockets: 50
});

class ExternalApiGatewayService {
  constructor() {
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
          drugEnforcement: '/drug/enforcement.json',
          drugNdc: '/drug/ndc.json',
          drugShortages: '/drug/shortages.json',
          deviceEvents: '/device/event.json',
          deviceEnforcement: '/device/enforcement.json'
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
          plans: '/provider-directory/v1/plans',
          formulary: '/provider-directory/v1/formulary'
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
          locations: '/locations',
          sponsors: '/sponsors'
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
          fetch: '/efetch.fcgi',
          summary: '/esummary.fcgi'
        }
      },
      
      betterDoctor: {
        name: 'BetterDoctor API',
        baseUrl: 'https://api.betterdoctor.com/2016-05-02',
        rateLimit: { requests: 100, window: 60000 }, // 100 req/min
        requiresKey: true,
        keyParam: 'user_key',
        cacheTTL: 3600, // 1 hour
        endpoints: {
          doctors: '/doctors',
          specialties: '/specialties',
          insurances: '/insurances',
          practices: '/practices'
        }
      },
      
      googleHealthcare: {
        name: 'Google Cloud Healthcare API',
        baseUrl: 'https://healthcare.googleapis.com/v1',
        rateLimit: { requests: 100, window: 60000 }, // 100 req/min
        requiresKey: true,
        keyParam: 'key',
        cacheTTL: 1800, // 30 minutes
        endpoints: {
          fhir: '/projects/{projectId}/locations/{locationId}/datasets/{datasetId}/fhirStores/{fhirStoreId}/fhir'
        }
      },

      // FDA iRES (Internet Recall Enterprise System) - December 2025
      // Real-time recall data - source system for openFDA recalls
      // Docs: https://www.accessdata.fda.gov/scripts/ires/apidocs/
      fdaIRES: {
        name: 'FDA iRES Enforcement Reports API',
        baseUrl: 'https://www.accessdata.fda.gov/rest',
        rateLimit: { requests: 60, window: 60000 }, // 60 req/min
        requiresKey: true,
        authType: 'fdaHeaders', // Special auth type for FDA APIs
        cacheTTL: 300, // 5 minutes (real-time data)
        endpoints: {
          recalls: '/iresapi/recalls/'
        }
      },

      // FDA Data Dashboard API (DDAPI) - December 2025
      // Inspections, citations, compliance actions, and import refusals
      // Docs: https://datadashboard.fda.gov/oii/api/index.htm
      fdaDDAPI: {
        name: 'FDA Data Dashboard API',
        baseUrl: 'https://api-datadashboard.fda.gov/v1',
        rateLimit: { requests: 60, window: 60000 }, // 60 req/min
        requiresKey: true,
        authType: 'fdaHeaders',
        cacheTTL: 3600, // 1 hour
        endpoints: {
          inspections: '/inspections_classifications',
          citations: '/inspections_citations',        // FDA 483 observations
          complianceActions: '/compliance_actions',   // Warning letters, injunctions
          importRefusals: '/import_refusals'          // Import refusal data
        }
      },

      // FDA Product Code Builder API (PCB) - December 2025
      // Product classification codes
      // Docs: https://www.accessdata.fda.gov/scripts/ora/pcb/apidocs/
      fdaPCB: {
        name: 'FDA Product Code Builder API',
        baseUrl: 'https://www.accessdata.fda.gov/rest',
        rateLimit: { requests: 60, window: 60000 }, // 60 req/min
        requiresKey: true,
        authType: 'fdaHeaders',
        cacheTTL: 86400, // 24 hours (static reference data)
        endpoints: {
          productByName: '/pcbapi/v1/product/name/'
        }
      },

      // FDA Establishment Identifier API (FEI) - December 2025
      // Facility/manufacturer registration lookup
      // Docs: https://www.accessdata.fda.gov/scripts/feiportal/apidocs/
      fdaFEI: {
        name: 'FDA Establishment Identifier API',
        baseUrl: 'https://www.accessdata.fda.gov/rest',
        rateLimit: { requests: 60, window: 60000 }, // 60 req/min
        requiresKey: true,
        authType: 'fdaHeaders',
        cacheTTL: 3600, // 1 hour
        endpoints: {
          firmByFei: '/feiapi/v1/fei/',           // Lookup by FEI number
          firmByName: '/feiapi/v1/firm/name/',    // Search by firm name
          firmByState: '/feiapi/v1/firm/state/'   // Search by state
        }
      },

      // NLM RxNorm/RxNav API - Drug Nomenclature (February 2026)
      // Standardized drug names, RxCUI codes, brand/generic mappings, interactions
      // Docs: https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
      rxnorm: {
        name: 'NLM RxNorm API',
        baseUrl: 'https://rxnav.nlm.nih.gov/REST',
        rateLimit: { requests: 1200, window: 60000 }, // 20 req/sec = 1200/min
        requiresKey: false,
        cacheTTL: 86400, // 24 hours (drug data changes infrequently)
        endpoints: {
          rxcui: '/rxcui.json',                            // Get RxCUI by drug name
          drugs: '/drugs.json',                            // Search drugs
          approximateTerm: '/approximateTerm.json',        // Fuzzy search
          allRelated: '/rxcui/{rxcui}/allrelated.json',    // All related concepts
          related: '/rxcui/{rxcui}/related.json',          // Related by type (BN, IN, SCD)
          interactions: '/interaction/list.json',           // Drug-drug interactions
          drugClasses: '/rxclass/class/byDrugName.json',   // Drug classifications
          spelling: '/spellingsuggestions.json'             // Spelling suggestions
        }
      },

      // NLM DailyMed API - FDA Drug Labeling (February 2026)
      // Official prescribing info: boxed warnings, dosage, contraindications, interactions, pregnancy
      // Docs: https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm
      dailymed: {
        name: 'NLM DailyMed API',
        baseUrl: 'https://dailymed.nlm.nih.gov/dailymed/services/v2',
        rateLimit: { requests: 600, window: 60000 }, // 10 req/sec (respectful, no published limit)
        requiresKey: false,
        cacheTTL: 604800, // 7 days (labels change very infrequently)
        endpoints: {
          spls: '/spls.json',                    // Search drug labels by name
          splById: '/spls/{setId}.json',         // Get full label by Set ID
          splMedia: '/spls/{setId}/media.json',  // Get drug images
          splPackaging: '/spls/{setId}/packaging.json', // NDC codes and packaging
          drugnames: '/drugnames.json',          // Autocomplete drug names
          ndcLookup: '/ndc/{ndc}.json'           // Look up by NDC code
        }
      },

      // CMS Medicaid Data API - DKAN 2 (February 2026)
      // Enrollment, CHIP, Drug Utilization data from data.medicaid.gov
      // Docs: https://data.medicaid.gov/about/api
      medicaidData: {
        name: 'CMS Medicaid Data API (DKAN)',
        baseUrl: 'https://data.medicaid.gov/api/1/datastore/query',
        rateLimit: { requests: 1000, window: 3600000 }, // ~1000 req/hour (unauthenticated)
        requiresKey: false,
        cacheTTL: 3600, // 1 hour (data is monthly/quarterly)
        endpoints: {
          enrollment: '/6165f45b-ca93-5bb5-9d06-db29c692a360/0',
          sdud2020: '/cc318bfb-a9b2-55f3-a924-d47376b32ea3/0',
          sdud2019: '/daba7980-e219-5996-9bec-90358fd156f1/0'
        }
      }
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('external-api-gateway-service');
      
      // Load API keys from KMS
      await this.loadApiKeys();
      
      // Initialize rate limiters
      this.initializeRateLimiters();
      
      // Initialize circuit breakers
      this.initializeCircuitBreakers();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.initialized = true;
      console.log('✅ External API Gateway Service initialized');
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
      'GOOGLE_HEALTHCARE_API_KEY',
      // FDA Data Dashboard & Enforcement APIs (December 2025)
      'FDA_IRES_USER',
      'FDA_IRES_KEY',
      'FDA_DDAPI_USER',
      'FDA_DDAPI_KEY',
      'FDA_PCB_USER',
      'FDA_PCB_KEY',
      'FDA_FEI_USER',
      'FDA_FEI_KEY'
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
    
    // Check daily rate limit if applicable
    if (limiter.dailyConfig) {
      const dailyKey = `daily_${key}`;
      const dailyRequests = limiter.dailyRequests.get(dailyKey) || [];
      const todayRequests = dailyRequests.filter(time => now - time < limiter.dailyConfig.window);
      
      if (todayRequests.length >= limiter.dailyConfig.requests) {
        throw new Error(`Daily rate limit exceeded for ${providerId}: ${limiter.dailyConfig.requests} requests per day`);
      }
      
      todayRequests.push(now);
      limiter.dailyRequests.set(dailyKey, todayRequests);
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
          // Only log warning once per provider
          if (!this.warnedProviders) this.warnedProviders = new Set();
          if (!this.warnedProviders.has(providerId)) {
            console.warn(`⚠️ No API key found for ${providerId} - using lower rate limits`);
            this.warnedProviders.add(providerId);
          }
        }
      }
      
      // Make HTTP request (using IPv4 agent to avoid IPv6 timeout issues)
      const response = await axios.get(url, {
        params: requestParams,
        timeout: options.timeout || 30000,
        httpsAgent: httpsAgent,
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

      // Extract meaningful error message from axios error
      const errorMessage = error.response?.data?.error?.message
        || error.response?.data?.message
        || error.message
        || error.code
        || 'Unknown error';
      const statusCode = error.response?.status || error.code || 500;

      // Log failed request
      await this.logApiRequest(providerId, endpoint, params, statusCode, options.userId, errorMessage);

      console.error(`❌ API request failed for ${providerId}/${endpoint}:`, errorMessage, `(Status: ${statusCode})`);
      throw new Error(`External API request failed: ${errorMessage}`);
    }
  }

  /**
   * Make POST request to FDA APIs that use header-based authentication
   * (iRES, DDAPI, PCB - December 2025)
   *
   * @param {string} providerId - One of: fdaIRES, fdaDDAPI, fdaPCB, fdaFEI
   * @param {string} endpoint - API endpoint path
   * @param {object} payload - Request payload (varies by API)
   * @param {object} options - Additional options (userId, skipCache, timeout)
   * @returns {Promise<object>} API response data
   */
  async makeFdaPostRequest(providerId, endpoint, payload = {}, options = {}) {
    await this.initialize();

    const provider = this.providers[providerId];
    if (!provider) {
      throw new Error(`Unknown API provider: ${providerId}`);
    }

    if (provider.authType !== 'fdaHeaders') {
      throw new Error(`Provider ${providerId} does not use FDA header authentication. Use makeRequest() instead.`);
    }

    // Check rate limits
    await this.checkRateLimit(providerId, options.userId);

    // Check circuit breaker
    this.checkCircuitBreaker(providerId);

    // Check cache first
    const cacheKey = this.generateCacheKey(providerId, endpoint, payload);
    const cached = this.cache.get(cacheKey);
    if (cached && !options.skipCache) {
      console.log(`📋 Cache hit for ${providerId}/${endpoint}`);
      return cached;
    }

    try {
      // Get FDA credentials for this provider
      const credentialsMap = {
        fdaIRES: { user: 'FDA_IRES_USER', key: 'FDA_IRES_KEY' },
        fdaDDAPI: { user: 'FDA_DDAPI_USER', key: 'FDA_DDAPI_KEY' },
        fdaPCB: { user: 'FDA_PCB_USER', key: 'FDA_PCB_KEY' },
        fdaFEI: { user: 'FDA_FEI_USER', key: 'FDA_FEI_KEY' }
      };

      const creds = credentialsMap[providerId];
      const authUser = this.apiConfigs.get(creds.user);
      const authKey = this.apiConfigs.get(creds.key);

      if (!authUser || !authKey) {
        throw new Error(`Missing credentials for ${providerId}. Ensure ${creds.user} and ${creds.key} are stored in KMS.`);
      }

      // Build request URL
      // NOTE: DDAPI does NOT accept query parameters - they cause 404 "Invalid request endpoint"
      // Only iRES and PCB use signature query parameter for cache-busting
      let url = `${provider.baseUrl}${endpoint}`;
      if (providerId !== 'fdaDDAPI') {
        const signature = Date.now().toString();
        url += `?signature=${signature}`;
      }

      // Prepare request headers (FDA-specific authentication)
      const headers = {
        'Content-Type': providerId === 'fdaDDAPI' ? 'application/json' : 'application/x-www-form-urlencoded',
        'Authorization-User': authUser,
        'Authorization-Key': authKey,
        'User-Agent': 'IntelliCare/1.0 (Healthcare Management System)',
        ...options.headers
      };

      // Prepare request body (format varies by API)
      let requestBody;
      if (providerId === 'fdaDDAPI') {
        // DDAPI uses JSON body
        requestBody = payload;
      } else {
        // iRES and PCB use URL-encoded payload parameter
        requestBody = `payload=${typeof payload === 'string' ? payload : JSON.stringify(payload)}`;
      }

      // Debug logging for FDA API troubleshooting
      console.log(`🔍 [FDA API] POST ${url}`);
      console.log(`🔍 [FDA API] Headers:`, JSON.stringify({ ...headers, 'Authorization-Key': '***' }));
      console.log(`🔍 [FDA API] Body:`, typeof requestBody === 'string' ? requestBody.substring(0, 200) : JSON.stringify(requestBody));

      // Make HTTP POST request
      const response = await axios.post(url, requestBody, {
        headers,
        timeout: options.timeout || 30000,
        httpsAgent: httpsAgent
      });

      console.log(`✅ [FDA API] Response status: ${response.status}`);
      console.log(`✅ [FDA API] Response data:`, JSON.stringify(response.data).substring(0, 500));

      // Record success
      this.recordSuccess(providerId);

      // FDA APIs return STATUSCODE/statuscode 400 for success (non-standard!)
      // DDAPI returns: { statuscode: 400, message: "Success.", resultcount: N, result: [...] }
      const responseData = response.data;
      const isSuccess = responseData.STATUSCODE === 400
        || responseData.statuscode === 400
        || responseData.MESSAGE === 'success'
        || responseData.message === 'Success.';

      if (isSuccess) {
        // Success - cache and return
        this.cache.set(cacheKey, responseData, provider.cacheTTL || 300);
        await this.logApiRequest(providerId, endpoint, payload, response.status, options.userId);
        return responseData;
      }

      // Check for actual errors
      if (responseData.STATUSCODE >= 401 || responseData.statuscode >= 401) {
        throw new Error(`FDA API error: ${responseData.MESSAGE || responseData.message || 'Unknown error'}`);
      }

      // Cache and return
      this.cache.set(cacheKey, responseData, provider.cacheTTL || 300);
      await this.logApiRequest(providerId, endpoint, payload, response.status, options.userId);
      return responseData;

    } catch (error) {
      // Record failure
      this.recordFailure(providerId);

      // Debug logging for FDA API errors
      console.error(`❌ [FDA API] Error response status:`, error.response?.status);
      console.error(`❌ [FDA API] Error response data:`, JSON.stringify(error.response?.data || {}).substring(0, 500));
      console.error(`❌ [FDA API] Error message:`, error.message);

      // Extract meaningful error message
      const errorMessage = error.response?.data?.MESSAGE
        || error.response?.data?.message
        || error.message
        || 'Unknown error';
      const statusCode = error.response?.status || 500;

      // Log failed request
      await this.logApiRequest(providerId, endpoint, payload, statusCode, options.userId, errorMessage);

      console.error(`❌ FDA API request failed for ${providerId}/${endpoint}:`, errorMessage);
      throw new Error(`FDA API request failed: ${errorMessage}`);
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
        serviceId: 'external-api-gateway-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global'
      };
      
      await SecureDataAccess.insert('audit_logs', {
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
    const limiter = this.rateLimits.get(providerId);
    
    return {
      providerId: providerId,
      name: provider.name,
      status: breaker?.state || 'UNKNOWN',
      failures: breaker?.failures || 0,
      lastFailure: breaker?.lastFailure,
      rateLimit: {
        requests: provider.rateLimit?.requests || 0,
        window: provider.rateLimit?.window || 0,
        dailyLimit: provider.dailyLimit?.requests || 0
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
      // Use a simple endpoint for testing
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
}

module.exports = new ExternalApiGatewayService();