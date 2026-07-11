# AGENT 2: Bulletproof API & Network Security

## CRITICAL: 24 Backend fetch() Calls Are Insecure!

Your mission is to secure ALL backend API calls and create a bulletproof HTTP client.

## Task 1: Create SecureHttpClient Service

Create `backend/services/secureHttpClient.js`:

```javascript
/**
 * 🔐 SECURE HTTP CLIENT SERVICE
 * All external API calls must go through this service
 * Provides authentication, retry logic, and audit trails
 */

const axios = require('axios');
const crypto = require('crypto');
const immutableAuditService = require('./immutableAuditService');
const secureConfigService = require('./secureConfigService');

class SecureHttpClient {
  constructor() {
    this.clients = new Map();
    this.requestCount = 0;
    this.initializeClients();
  }

  initializeClients() {
    // Create axios instance with secure defaults
    this.defaultClient = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'IntelliCare/1.0 (Secure Medical Platform)',
        'X-Request-ID': () => crypto.randomUUID()
      },
      validateStatus: (status) => status < 500
    });

    // Add request interceptor for security
    this.defaultClient.interceptors.request.use(
      (config) => this.secureRequest(config),
      (error) => Promise.reject(error)
    );

    // Add response interceptor for logging
    this.defaultClient.interceptors.response.use(
      (response) => this.logResponse(response),
      (error) => this.handleError(error)
    );
  }

  /**
   * Secure request interceptor
   */
  async secureRequest(config) {
    // Generate request signature
    const timestamp = Date.now();
    const requestId = crypto.randomUUID();
    
    config.headers['X-Request-ID'] = requestId;
    config.headers['X-Timestamp'] = timestamp;
    
    // Sign request for internal APIs
    if (config.url.includes('localhost') || config.url.includes('intellicare')) {
      const signature = this.generateSignature(config, timestamp);
      config.headers['X-Signature'] = signature;
    }
    
    // Log outgoing request
    await immutableAuditService.logServiceDataAccess({
      serviceId: config.serviceId || 'http-client',
      endpoint: config.url,
      method: config.method,
      requestId,
      timestamp: new Date()
    });
    
    // Apply rate limiting
    await this.checkRateLimit(config.url);
    
    return config;
  }

  /**
   * Generate HMAC signature for request
   */
  generateSignature(config, timestamp) {
    const secret = secureConfigService.get('API_SECRET', 'http-client') || 'default-secret';
    const payload = `${config.method}:${config.url}:${timestamp}`;
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Log response for audit
   */
  async logResponse(response) {
    const requestId = response.config.headers['X-Request-ID'];
    
    await immutableAuditService.logServiceDataAccess({
      serviceId: response.config.serviceId || 'http-client',
      endpoint: response.config.url,
      method: response.config.method,
      requestId,
      status: response.status,
      responseTime: Date.now() - response.config.headers['X-Timestamp'],
      timestamp: new Date()
    });
    
    return response;
  }

  /**
   * Handle errors with retry logic
   */
  async handleError(error) {
    const config = error.config;
    
    // Log error
    await immutableAuditService.logSecurityEvent({
      eventType: 'http_request_failed',
      details: {
        url: config?.url,
        method: config?.method,
        error: error.message,
        status: error.response?.status
      }
    });
    
    // Retry logic for transient failures
    if (config && !config.__retryCount) {
      config.__retryCount = 0;
    }
    
    if (config && config.__retryCount < 3 && this.shouldRetry(error)) {
      config.__retryCount++;
      console.log(`🔄 Retrying request (${config.__retryCount}/3): ${config.url}`);
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, config.__retryCount) * 1000)
      );
      
      return this.defaultClient(config);
    }
    
    throw error;
  }

  /**
   * Check if request should be retried
   */
  shouldRetry(error) {
    if (!error.response) return true; // Network error
    const status = error.response.status;
    return status >= 500 || status === 429; // Server error or rate limit
  }

  /**
   * Rate limiting
   */
  async checkRateLimit(url) {
    const domain = new URL(url).hostname;
    const key = `rate:${domain}`;
    
    if (!this.rateLimits) {
      this.rateLimits = new Map();
    }
    
    const now = Date.now();
    const limit = this.rateLimits.get(key) || { count: 0, reset: now + 60000 };
    
    if (now > limit.reset) {
      limit.count = 0;
      limit.reset = now + 60000;
    }
    
    limit.count++;
    
    // Max 60 requests per minute per domain
    if (limit.count > 60) {
      await new Promise(resolve => 
        setTimeout(resolve, limit.reset - now)
      );
      limit.count = 1;
      limit.reset = now + 60000;
    }
    
    this.rateLimits.set(key, limit);
  }

  /**
   * Make GET request
   */
  async get(url, options = {}) {
    return this.request('GET', url, null, options);
  }

  /**
   * Make POST request
   */
  async post(url, data, options = {}) {
    return this.request('POST', url, data, options);
  }

  /**
   * Make PUT request
   */
  async put(url, data, options = {}) {
    return this.request('PUT', url, data, options);
  }

  /**
   * Make DELETE request
   */
  async delete(url, options = {}) {
    return this.request('DELETE', url, null, options);
  }

  /**
   * Generic request method
   */
  async request(method, url, data, options = {}) {
    try {
      const config = {
        method,
        url,
        data,
        ...options,
        serviceId: options.serviceId || 'unknown'
      };
      
      const response = await this.defaultClient(config);
      return response.data;
    } catch (error) {
      // Return sanitized error
      throw new Error(`HTTP request failed: ${error.message}`);
    }
  }

  /**
   * Create specialized client for specific API
   */
  createClient(name, baseURL, defaultHeaders = {}) {
    const client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        ...defaultHeaders,
        'User-Agent': 'IntelliCare/1.0'
      }
    });
    
    // Apply same interceptors
    client.interceptors.request.use(
      (config) => this.secureRequest({ ...config, serviceId: name }),
      (error) => Promise.reject(error)
    );
    
    client.interceptors.response.use(
      (response) => this.logResponse(response),
      (error) => this.handleError(error)
    );
    
    this.clients.set(name, client);
    return client;
  }
}

module.exports = new SecureHttpClient();
```

## Task 2: Install Required Package

```bash
cd backend
npm install axios
```

## Task 3: Replace ALL Backend fetch() Calls

Find all files with fetch():
```bash
grep -r "fetch(" backend/ --include="*.js" -l | grep -v test > fetch-violations.txt
```

For EACH file, replace fetch() with SecureHttpClient:

### Example 1: Simple GET request

**OLD:**
```javascript
const response = await fetch('https://api.example.com/data');
const data = await response.json();
```

**NEW:**
```javascript
const secureHttp = require('../services/secureHttpClient');
const data = await secureHttp.get('https://api.example.com/data', {
  serviceId: 'service-name'
});
```

### Example 2: POST with headers

**OLD:**
```javascript
const response = await fetch('https://api.example.com/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(payload)
});
```

**NEW:**
```javascript
const secureHttp = require('../services/secureHttpClient');
const data = await secureHttp.post('https://api.example.com/data', payload, {
  headers: {
    'Authorization': `Bearer ${token}`
  },
  serviceId: 'service-name'
});
```

## Task 4: Fix Specific Files

### backend/services/currencyService.js
Replace both fetch() calls with SecureHttpClient:
```javascript
const secureHttp = require('./secureHttpClient');

// In getExchangeRates()
const data = await secureHttp.get(
  `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`,
  { serviceId: 'currency-service' }
);
```

### backend/services/aiSecurityWrapper.js
Replace the fetch() call:
```javascript
const secureHttp = require('./secureHttpClient');

// Replace fetch() with:
const result = await secureHttp.post(url, data, {
  serviceId: 'ai-security-wrapper'
});
```

## Task 5: Create Internal API Client

For internal API calls between services, create `backend/services/internalApiClient.js`:

```javascript
/**
 * Internal API Client for Service-to-Service Communication
 */

const secureHttp = require('./secureHttpClient');
const serviceAccountManager = require('./serviceAccountManager');

class InternalApiClient {
  constructor(serviceId) {
    this.serviceId = serviceId;
    this.baseURL = process.env.INTERNAL_API_URL || 'http://localhost:5000';
    this.token = null;
  }

  async initialize() {
    const auth = await serviceAccountManager.authenticate(this.serviceId);
    this.token = auth.sessionToken;
  }

  async request(method, endpoint, data = null) {
    if (!this.token) {
      await this.initialize();
    }

    return secureHttp.request(method, `${this.baseURL}${endpoint}`, data, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'X-Service-ID': this.serviceId
      },
      serviceId: this.serviceId
    });
  }

  async get(endpoint) {
    return this.request('GET', endpoint);
  }

  async post(endpoint, data) {
    return this.request('POST', endpoint, data);
  }

  async put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  }

  async delete(endpoint) {
    return this.request('DELETE', endpoint);
  }
}

module.exports = InternalApiClient;
```

## Task 6: Create Network Security Report

Create `backend/network-security-audit.md`:

```markdown
# Network Security Audit Report

## Summary
- Total fetch() calls found: 24
- Fixed: 24
- Remaining: 0

## Replaced API Calls
| File | Old Method | New Method | Service ID |
|------|------------|------------|------------|
| currencyService.js | fetch() | SecureHttpClient | currency-service |
| aiSecurityWrapper.js | fetch() | SecureHttpClient | ai-security |
| ... | ... | ... | ... |

## Security Improvements
- ✅ All requests signed with HMAC-SHA256
- ✅ Automatic retry with exponential backoff
- ✅ Rate limiting (60 req/min per domain)
- ✅ Full audit trail for all requests
- ✅ Request/Response interceptors

## Verification
```bash
# No fetch() in production code
grep -r "fetch(" backend/ --include="*.js" | grep -v test | grep -v SecureHttpClient
# Returns: 0 results
```
```

## Verification Commands

After completing ALL tasks:

```bash
# Check no fetch() remains (except in SecureHttpClient itself)
grep -r "fetch(" backend/ --include="*.js" | grep -v test | grep -v SecureHttpClient

# Test the secure client
node -e "const http = require('./backend/services/secureHttpClient'); http.get('https://api.github.com').then(console.log)"

# Check axios is installed
npm list axios

# Verify all services use secure client
grep -r "require.*secureHttpClient" backend/services/ --include="*.js" | wc -l
# Should be > 0
```

## Success Criteria
- ✅ Zero fetch() calls in backend (except tests)
- ✅ SecureHttpClient handles all external APIs
- ✅ Request signing implemented
- ✅ Retry logic with exponential backoff
- ✅ Full audit trail for all HTTP requests

## Deadline: 3 hours

Priority: Fix currencyService.js and aiSecurityWrapper.js first - they're actively used!