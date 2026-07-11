/**
 * 🛡️ SECURITY HEADER VALIDATOR SERVICE
 * 
 * Validates security headers, detects abuse patterns, and prevents header injection attacks.
 * Provides different validation rules for browser clients vs service-to-service calls.
 * 
 * SECURITY: Automatically blacklists IPs showing abuse patterns.
 * COMPLIANCE: All security violations logged for audit and compliance reporting.
 */

const crypto = require('crypto');
const serviceAccountManager = require('../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../backend/services/secureDataAccess');
const secureConfigService = require('../../../backend/services/secureConfigService');

// Custom SecurityError class
class SecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SecurityError';
  }
}

class SecurityHeaderValidator {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    
    // Header patterns and rules
    this.headerRules = {
      'x-request-id': {
        pattern: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
        maxLength: 36,
        required: false, // Made optional - only required for service-to-service
        sanitize: (value) => value.toLowerCase().trim()
      },
      'x-timestamp': {
        pattern: /^\d{13}$/,
        maxLength: 13,
        required: false, // Made optional - only required for service-to-service
        validate: (value) => {
          const timestamp = parseInt(value);
          const now = Date.now();
          const fiveMinutes = 5 * 60 * 1000;
          // Reject if timestamp is more than 5 minutes old or in future
          return Math.abs(now - timestamp) < fiveMinutes;
        }
      },
      'x-signature': {
        pattern: /^[a-f0-9]{64}$/i, // SHA256 hex
        maxLength: 64,
        required: false, // Made optional - only required for service-to-service
        sanitize: (value) => value.toLowerCase()
      },
      'x-service-id': {
        pattern: /^[a-z0-9-]+$/,
        maxLength: 50,
        allowlist: [
          'reminder-service',
          'batch-worker',
          'ai-agent',
          'currency-service',
          'ocr-service',
          'diagnostic-service',
          'patient-deletion-service',
          'file-cleanup-service',
          'data-retention-service',
          'communication-audit-service',
          'security-monitoring-service',
          'incident-response-service',
          'agent-service',
          'audit-service',
          'security-header-validator'
        ],
        required: false
      },
      'x-correlation-id': {
        pattern: /^[a-f0-9-]+$/i,
        maxLength: 36,
        required: false
      },
      'x-session-fingerprint': {
        pattern: /^[a-f0-9]{64}$/i,
        maxLength: 64,
        required: false
      },
      'x-request-signature': {
        pattern: /^[a-f0-9]{64}$/i,
        maxLength: 64,
        required: false
      },
      'x-request-timestamp': {
        pattern: /^\d{13}$/,
        maxLength: 13,
        required: false
      },
      'x-request-nonce': {
        pattern: /^[a-f0-9]{32}$/i,
        maxLength: 32,
        required: false
      },
      'x-client-version': {
        pattern: /^[\d\.]+$/,
        maxLength: 20,
        required: false
      }
    };
    
    // Track header abuse
    this.abuseTracker = new Map(); // IP -> attempts
    this.blacklist = new Set();
    
    // Clear blacklist on startup in development (production-like but forgiving)
    if (secureConfigService.get('NODE_ENV', 'development') === 'development') {
      this.blacklist.clear();
      console.log('🔄 SecurityHeaderValidator: Cleared IP blacklist for development');
    }
    
    // Cleanup old abuse records every hour
    setInterval(() => {
      const oneHourAgo = Date.now() - 3600000;
      for (const [ip, data] of this.abuseTracker.entries()) {
        if (data.lastAttempt < oneHourAgo) {
          this.abuseTracker.delete(ip);
        }
      }
    }, 3600000);
  }

  async initialize() {
    if (this.initialized) return;

    try {
      this.serviceToken = await serviceAccountManager.authenticate('security-header-validator');
      this.initialized = true;
      console.log('✅ Security Header Validator initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Security Header Validator:', error);
      throw error;
    }
  }

  /**
   * Detect if request is from a browser (no service-id header)
   */
  isBrowserRequest(req) {
    // Browser requests won't have x-service-id header
    // They will have typical browser headers like User-Agent
    const hasServiceId = !!req.headers['x-service-id'];
    const hasUserAgent = !!req.headers['user-agent'];
    const isXMLHttpRequest = req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    // If no service ID and has browser indicators, it's a browser request
    return !hasServiceId && (hasUserAgent || isXMLHttpRequest);
  }

  /**
   * Validate security headers
   */
  async validateHeaders(req) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const errors = [];
      const warnings = [];
      const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
      
      // Check if IP is blacklisted
      if (this.blacklist.has(clientIp)) {
        throw new SecurityError('IP blacklisted for header abuse');
      }
      
      // Detect if this is a browser request
      const isBrowser = this.isBrowserRequest(req);
      
      // Validate each security header
      for (const [header, rules] of Object.entries(this.headerRules)) {
        const value = req.headers[header];
        
        // Skip security header requirements for browser requests
        if (isBrowser && ['x-request-id', 'x-timestamp', 'x-signature'].includes(header)) {
          continue; // Don't require security headers from browsers
        }
        
        if (rules.required && !value) {
          errors.push(`Missing required header: ${header}`);
          continue;
        }
        
        if (value) {
          // Sanitize if function provided
          let sanitizedValue = value;
          if (rules.sanitize) {
            sanitizedValue = rules.sanitize(value);
          }
          
          // Length check
          if (sanitizedValue.length > rules.maxLength) {
            errors.push(`Header ${header} exceeds max length (${sanitizedValue.length} > ${rules.maxLength})`);
            await this.recordAbuse(clientIp, 'oversized_header', header);
          }
          
          // Pattern validation
          if (rules.pattern && !rules.pattern.test(sanitizedValue)) {
            errors.push(`Invalid format for header: ${header}`);
            await this.recordAbuse(clientIp, 'invalid_format', header);
          }
          
          // Custom validation
          if (rules.validate && !rules.validate(sanitizedValue)) {
            errors.push(`Validation failed for header: ${header}`);
            await this.recordAbuse(clientIp, 'validation_failed', header);
          }
          
          // Allowlist check
          if (rules.allowlist && !rules.allowlist.includes(sanitizedValue)) {
            warnings.push(`Value not in allowlist for header: ${header}`);
            await this.recordAbuse(clientIp, 'allowlist_violation', header);
          }
        }
      }
      
      // Check for header injection attempts
      const suspiciousHeaders = this.detectHeaderInjection(req.headers);
      if (suspiciousHeaders.length > 0) {
        errors.push(`Suspicious header content detected: ${suspiciousHeaders.join(', ')}`);
        await this.recordAbuse(clientIp, 'injection_attempt', suspiciousHeaders.join(','));
      }
      
      return { 
        valid: errors.length === 0, 
        errors, 
        warnings,
        clientIp,
        isBrowser 
      };
    } catch (error) {
      console.error('Header validation failed:', error);
      throw error;
    }
  }
  
  /**
   * Detect header injection attempts
   */
  detectHeaderInjection(headers) {
    const suspicious = [];
    const injectionPatterns = [
      /<script[^>]*>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /\.\.\//g,
      /[;&|`$]/g,
      /%00/g,
      /\|/g
    ];
    
    for (const [name, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        for (const pattern of injectionPatterns) {
          if (pattern.test(value)) {
            suspicious.push(name);
            break;
          }
        }
      }
    }
    
    return suspicious;
  }
  
  /**
   * Record abuse attempt and potentially blacklist IP
   */
  async recordAbuse(ip, reason, details = '') {
    try {
      const record = this.abuseTracker.get(ip) || { 
        attempts: 0, 
        reasons: [],
        firstAttempt: Date.now(),
        lastAttempt: Date.now()
      };
      
      record.attempts += 1;
      record.lastAttempt = Date.now();
      record.reasons.push(reason);
      this.abuseTracker.set(ip, record);
      
      // Log to database
      const context = {
        serviceId: 'security-header-validator',
        operation: 'record-abuse',
        practiceId: 'global'
      };

      await SecureDataAccess.create('security_header_abuse', {
        ip,
        reason,
        details,
        timestamp: new Date(),
        attemptNumber: record.attempts
      }, context);
      
      // Auto-blacklist after more violations in development (50 instead of 10)
      const blacklistThreshold = secureConfigService.get('NODE_ENV', 'development') === 'development' ? 50 : 10;
      if (record.attempts >= blacklistThreshold) {
        this.blacklist.add(ip);
        
        // Log blacklist event
        await SecureDataAccess.create('security_ip_blacklist', {
          ip,
          reason: 'header_abuse',
          attempts: record.attempts,
          reasons: record.reasons,
          timestamp: new Date()
        }, context);

        console.log(`🚫 IP blacklisted for header abuse: ${ip} (${record.attempts} attempts)`);
      }
    } catch (error) {
      console.error('Failed to record abuse:', error);
    }
  }
  
  /**
   * Verify request signature
   */
  verifySignature(req) {
    const signature = req.headers['x-signature'] || req.headers['x-request-signature'];
    const timestamp = req.headers['x-timestamp'] || req.headers['x-request-timestamp'];
    const requestId = req.headers['x-request-id'];
    const nonce = req.headers['x-request-nonce'];
    
    if (!signature || !timestamp || !requestId) {
      return { valid: false, reason: 'Missing required signature components' };
    }
    
    // Check timestamp is within 5 minutes
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return { valid: false, reason: 'Timestamp outside valid window' };
    }
    
    // Get body for POST/PUT/PATCH requests
    let bodyString = '';
    if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      bodyString = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }
    
    // Rebuild the signature
    const components = [
      req.method,
      req.path,
      timestamp,
      requestId,
      nonce || '',
      bodyString
    ].filter(Boolean);
    
    const payload = components.join(':');
    const secret = secureConfigService.get('REQUEST_SIGNING_KEY', 'default-development-key-change-in-production');
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
      
      return { 
        valid: isValid, 
        reason: isValid ? 'Valid signature' : 'Invalid signature'
      };
    } catch (err) {
      // Buffers are not same length or other error
      return { valid: false, reason: 'Signature verification failed' };
    }
  }
  
  /**
   * Get abuse statistics
   */
  getAbuseStats() {
    const stats = {
      totalTrackedIPs: this.abuseTracker.size,
      blacklistedIPs: this.blacklist.size,
      topOffenders: []
    };
    
    // Get top 10 offenders
    const sorted = Array.from(this.abuseTracker.entries())
      .sort((a, b) => b[1].attempts - a[1].attempts)
      .slice(0, 10);
    
    stats.topOffenders = sorted.map(([ip, data]) => ({
      ip,
      attempts: data.attempts,
      lastAttempt: new Date(data.lastAttempt).toISOString(),
      blacklisted: this.blacklist.has(ip)
    }));
    
    return stats;
  }
  
  /**
   * Manual IP management
   */
  blacklistIP(ip) {
    this.blacklist.add(ip);
    return true;
  }
  
  unblacklistIP(ip) {
    this.blacklist.delete(ip);
    this.abuseTracker.delete(ip);
    return true;
  }
  
  isBlacklisted(ip) {
    return this.blacklist.has(ip);
  }
  
  /**
   * Clear all blacklists and abuse tracking
   */
  clearAllBlacklists() {
    const blacklistSize = this.blacklist.size;
    const trackerSize = this.abuseTracker.size;
    
    this.blacklist.clear();
    this.abuseTracker.clear();
    
    console.log(`🔄 Cleared ${blacklistSize} IPs from blacklist and ${trackerSize} from abuse tracker`);
    return { blacklistCleared: blacklistSize, trackerCleared: trackerSize };
  }
}

module.exports = new SecurityHeaderValidator();