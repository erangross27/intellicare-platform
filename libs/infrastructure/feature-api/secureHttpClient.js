/**
 * SecureHttpClient - Bulletproof HTTP client with security features
 * 
 * Features:
 * - Request signing with HMAC-SHA256
 * - Automatic retry with exponential backoff
 * - Rate limiting protection
 * - Request/response encryption
 * - Audit logging
 * - Timeout protection
 * - Certificate pinning for production
 * - Request deduplication
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const SecureDataAccess = require('../../compliance-security/feature-data-access/secureDataAccess');
const securityMonitoringService = require('./securityMonitoringService');
const config = require('../config/default.json');
const secureConfigService = require('../services/secureConfigService');
const serviceAccountManager = require('./serviceAccountManager');

class SecureHttpClient {
  constructor(options = {}) {
    this.serviceId = options.serviceId || 'unknown-service';
    this.apiKey = options.apiKey || secureConfigService.get('INTERNAL_API_KEY');
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 30000; // 30 seconds default
    this.retryDelay = options.retryDelay || 1000; // 1 second initial delay
    this.enableEncryption = options.enableEncryption !== false;
    this.enableSigning = options.enableSigning !== false;
    this.enableAudit = options.enableAudit !== false;
  }

  async initialize() {
    if (!this.serviceToken) {
      this.serviceToken = await serviceAccountManager.authenticate('secure-http-client');
    }
    return this;
  }

  /**
   * Get service context for SecureDataAccess operations
   */
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'secureHttpClient',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: practiceId
    };
  }

  setupClient() {
    // Certificate pinning for production
    this.certificatePins = options.certificatePins || config.security?.certificatePins || [];
    
    // Request deduplication cache
    this.requestCache = new Map();
    this.cacheTimeout = options.cacheTimeout || 60000; // 1 minute
    
    // Rate limiting
    this.requestCount = 0;
    this.requestWindow = [];
    this.maxRequestsPerMinute = options.maxRequestsPerMinute || 100;
    
    // Initialize signing key
    this.signingKey = this.apiKey || crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate request signature
   */
  generateSignature(method, url, body, timestamp, nonce) {
    const signatureBase = [
      method.toUpperCase(),
      url,
      timestamp,
      nonce,
      body ? JSON.stringify(body) : ''
    ].join('\n');
    
    return crypto
      .createHmac('sha256', this.signingKey)
      .update(signatureBase)
      .digest('hex');
  }

  /**
   * Verify response signature
   */
  verifySignature(signature, method, url, body, timestamp, nonce) {
    const expectedSignature = this.generateSignature(method, url, body, timestamp, nonce);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Check rate limiting
   */
  checkRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old requests
    this.requestWindow = this.requestWindow.filter(time => time > oneMinuteAgo);
    
    // Check limit
    if (this.requestWindow.length >= this.maxRequestsPerMinute) {
      throw new Error('Rate limit exceeded');
    }
    
    // Add current request
    this.requestWindow.push(now);
  }

  /**
   * Generate request ID for deduplication
   */
  generateRequestId(method, url, body) {
    const hash = crypto.createHash('sha256');
    hash.update(`${method}:${url}:${JSON.stringify(body || {})}`);
    return hash.digest('hex');
  }

  /**
   * Check request cache for deduplication
   */
  checkCache(requestId) {
    const cached = this.requestCache.get(requestId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.response;
    }
    return null;
  }

  /**
   * Save response to cache
   */
  saveToCache(requestId, response) {
    this.requestCache.set(requestId, {
      response,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    setTimeout(() => {
      this.requestCache.delete(requestId);
    }, this.cacheTimeout);
  }

  /**
   * Encrypt request body
   */
  encryptBody(body) {
    if (!this.enableEncryption || !body) return body;
    
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.signingKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(body), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: true,
      data: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt response body
   */
  decryptBody(encryptedData) {
    if (!encryptedData.encrypted) return encryptedData;
    
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.signingKey, 'salt', 32);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  /**
   * Make HTTP request with retries
   */
  async request(options) {
    const startTime = Date.now();
    const { method = 'GET', url, body, headers = {}, skipCache = false } = options;
    
    // Check rate limiting
    this.checkRateLimit();
    
    // Check cache for idempotent requests
    if (!skipCache && ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
      const requestId = this.generateRequestId(method, url, body);
      const cached = this.checkCache(requestId);
      if (cached) {
        if (this.enableAudit) {
          await this.auditRequest(method, url, 'CACHE_HIT', startTime);
        }
        return cached;
      }
    }
    
    let lastError;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(method, url, body, headers, attempt);
        
        // Cache successful responses
        if (!skipCache && ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
          const requestId = this.generateRequestId(method, url, body);
          this.saveToCache(requestId, response);
        }
        
        // Audit successful request
        if (this.enableAudit) {
          await this.auditRequest(method, url, 'SUCCESS', startTime, response.status);
        }
        
        return response;
      } catch (error) {
        lastError = error;
        
        // Log retry attempt
        console.log(`Request attempt ${attempt + 1} failed:`, error.message);
        
        // Audit failed attempt
        if (this.enableAudit) {
          await this.auditRequest(method, url, `RETRY_${attempt + 1}`, startTime, null, error.message);
        }
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          break;
        }
        
        // Exponential backoff
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }
    
    // Audit final failure
    if (this.enableAudit) {
      await this.auditRequest(method, url, 'FAILED', startTime, null, lastError.message);
    }
    
    // Alert on persistent failures
    await this.alertOnFailure(method, url, lastError);
    
    throw lastError;
  }

  /**
   * Make single HTTP request
   */
  makeRequest(method, url, body, headers, attempt) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;
      
      // Generate security headers
      const timestamp = Date.now().toString();
      const nonce = crypto.randomBytes(16).toString('hex');
      
      // Encrypt body if enabled
      const requestBody = this.encryptBody(body);
      
      // Generate signature
      const signature = this.enableSigning ? 
        this.generateSignature(method, url, requestBody, timestamp, nonce) : null;
      
      // Build headers
      const requestHeaders = {
        ...headers,
        'Content-Type': 'application/json',
        'X-Service-ID': this.serviceId,
        'X-Request-ID': crypto.randomBytes(16).toString('hex'),
        'X-Request-Timestamp': timestamp,
        'X-Request-Nonce': nonce,
        'X-Retry-Attempt': attempt.toString(),
        'User-Agent': `SecureHttpClient/${this.serviceId}`
      };
      
      if (this.enableSigning) {
        requestHeaders['X-Request-Signature'] = signature;
      }
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: method.toUpperCase(),
        headers: requestHeaders,
        timeout: this.timeout
      };
      
      // Certificate pinning for HTTPS
      if (isHttps && this.certificatePins.length > 0) {
        options.checkServerIdentity = (hostname, cert) => {
          const fingerprint = crypto
            .createHash('sha256')
            .update(cert.raw)
            .digest('hex');
          
          if (!this.certificatePins.includes(fingerprint)) {
            const error = new Error('Certificate pin validation failed');
            error.code = 'CERT_PIN_FAILED';
            return error;
          }
          
          return undefined;
        };
      }
      
      const req = lib.request(options, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            // Parse response
            let responseData = data;
            if (res.headers['content-type']?.includes('application/json')) {
              responseData = JSON.parse(data);
              
              // Decrypt if encrypted
              if (responseData.encrypted && this.enableEncryption) {
                responseData = this.decryptBody(responseData);
              }
            }
            
            // Verify response signature if present
            if (this.enableSigning && res.headers['x-response-signature']) {
              const valid = this.verifySignature(
                res.headers['x-response-signature'],
                method,
                url,
                responseData,
                res.headers['x-response-timestamp'],
                res.headers['x-response-nonce']
              );
              
              if (!valid) {
                throw new Error('Response signature verification failed');
              }
            }
            
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: responseData
            });
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.timeout}ms`));
      });
      
      // Send request body
      if (requestBody) {
        req.write(JSON.stringify(requestBody));
      }
      
      req.end();
    });
  }

  /**
   * Check if error is non-retryable
   */
  isNonRetryableError(error) {
    const nonRetryableCodes = [
      'CERT_PIN_FAILED',
      'INVALID_SIGNATURE',
      'RATE_LIMIT_EXCEEDED',
      'UNAUTHORIZED',
      'FORBIDDEN'
    ];
    
    return nonRetryableCodes.includes(error.code) ||
           (error.response && error.response.status >= 400 && error.response.status < 500);
  }

  /**
   * Audit request
   */
  async auditRequest(method, url, status, startTime, statusCode = null, error = null) {
    if (!this.enableAudit) return;
    
    try {
      const duration = Date.now() - startTime;
      const context = this.getServiceContext();
      
      await SecureDataAccess.insert('audit_logs', {
        action: 'SECURE_HTTP_REQUEST',
        serviceId: this.serviceId,
        method,
        url: this.sanitizeUrl(url),
        status,
        statusCode,
        duration,
        error: error ? this.sanitizeError(error) : null,
        timestamp: new Date().toISOString()
      }, context);
    } catch (auditError) {
      console.error('Audit logging failed:', auditError);
    }
  }

  /**
   * Alert on persistent failures
   */
  async alertOnFailure(method, url, error) {
    try {
      await securityMonitoringService.logSecurityEvent({
        type: 'HTTP_REQUEST_FAILURE',
        severity: 'high',
        serviceId: this.serviceId,
        details: {
          method,
          url: this.sanitizeUrl(url),
          error: this.sanitizeError(error.message),
          timestamp: new Date().toISOString()
        }
      });
    } catch (alertError) {
      console.error('Security alert failed:', alertError);
    }
  }

  /**
   * Sanitize URL for logging
   */
  sanitizeUrl(url) {
    try {
      const parsed = new URL(url);
      // Remove sensitive query parameters
      const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth'];
      sensitiveParams.forEach(param => {
        if (parsed.searchParams.has(param)) {
          parsed.searchParams.set(param, '[REDACTED]');
        }
      });
      return parsed.toString();
    } catch {
      return '[INVALID_URL]';
    }
  }

  /**
   * Sanitize error for logging
   */
  sanitizeError(error) {
    if (typeof error === 'string') {
      // Remove sensitive patterns
      return error
        .replace(/Bearer\s+[\w-]+/gi, 'Bearer [REDACTED]')
        .replace(/\b[\w-]+@[\w-]+\.[\w]+\b/g, '[EMAIL]')
        .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]');
    }
    return error;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convenience methods
   */
  async get(url, options = {}) {
    return this.request({ ...options, method: 'GET', url });
  }

  async post(url, body, options = {}) {
    return this.request({ ...options, method: 'POST', url, body });
  }

  async put(url, body, options = {}) {
    return this.request({ ...options, method: 'PUT', url, body });
  }

  async patch(url, body, options = {}) {
    return this.request({ ...options, method: 'PATCH', url, body });
  }

  async delete(url, options = {}) {
    return this.request({ ...options, method: 'DELETE', url });
  }
}

// Singleton instance for general use
let defaultClient;

function getDefaultClient() {
  if (!defaultClient) {
    defaultClient = new SecureHttpClient({
      serviceId: 'default-http-client'
    });
  }
  return defaultClient;
}

module.exports = {
  SecureHttpClient,
  getDefaultClient
};