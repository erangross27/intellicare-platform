// AI Security Wrapper for IntelliCare
// Provides comprehensive security controls for AI service interactions
// Migrated to DDD NX architecture - Compliance Security Context - Auth Feature

const crypto = require('crypto');

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class AISecurityWrapper {
  constructor() {
    this.serviceId = 'ai-security-wrapper';
    this.serviceToken = null;
    this.initialized = false;
    
    this.config = {
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000,
      sensitiveDataPatterns: [
        /\b\d{3}-\d{2}-\d{4}\b/, // SSN
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Email
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit Card
        /\b\d{3}-\d{3}-\d{4}\b/, // Phone
        /\b\d{1,2}\/\d{1,2}\/\d{4}\b/ // DOB
      ],
      blockedTerms: [
        'hack', 'exploit', 'vulnerability', 'inject', 'bypass',
        'admin password', 'database dump', 'system override'
      ],
      auditAllRequests: true,
      encryptSensitiveData: true
    };
    
    // Rate limiting tracking
    this.rateLimits = new Map();
    this.blockedUsers = new Set();
    this.suspiciousActivity = new Map();
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Start cleanup timer for rate limits
      this.startCleanupTimer();
      
      this.initialized = true;
      console.log('✅ AI Security Wrapper initialized');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize AISecurityWrapper:', error);
      throw error;
    }
  }

  async secureExecute(operation, params, context) {
    if (!this.initialized) await this.initialize();

    const securityContext = {
      userId: context.userId,
      practiceId: context.practiceId,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      operationType: typeof operation === 'string' ? operation : 'function'
    };

    try {
      // 1. Rate limiting check
      await this.checkRateLimit(securityContext);
      
      // 2. User authorization check
      await this.checkUserAuthorization(securityContext);
      
      // 3. Input validation and sanitization
      const sanitizedParams = await this.sanitizeInput(params, securityContext);
      
      // 4. Content security scanning
      await this.scanForSecurityThreats(sanitizedParams, securityContext);
      
      // 5. Audit logging (pre-execution)
      await this.logSecurityEvent('EXECUTION_ATTEMPT', securityContext, { params: sanitizedParams });
      
      // 6. Execute the operation
      let result;
      if (typeof operation === 'function') {
        result = await operation(sanitizedParams, context);
      } else {
        result = await this.executeByName(operation, sanitizedParams, context);
      }
      
      // 7. Output filtering and sanitization
      const secureResult = await this.sanitizeOutput(result, securityContext);
      
      // 8. Audit logging (post-execution)
      await this.logSecurityEvent('EXECUTION_SUCCESS', securityContext, { 
        inputSize: JSON.stringify(sanitizedParams).length,
        outputSize: JSON.stringify(secureResult).length
      });
      
      return secureResult;
    } catch (error) {
      // Security error handling
      await this.handleSecurityError(error, securityContext);
      throw error;
    }
  }

  async checkRateLimit(securityContext) {
    const { userId, practiceId, ipAddress } = securityContext;
    const now = Date.now();
    
    // Check if user is blocked
    if (this.blockedUsers.has(userId)) {
      throw new Error('User access temporarily blocked due to security violations');
    }
    
    // Track by user and IP
    const rateLimitKey = `${userId}:${ipAddress}`;
    const userLimits = this.rateLimits.get(rateLimitKey) || {
      minuteRequests: [],
      hourRequests: []
    };
    
    // Clean old requests
    userLimits.minuteRequests = userLimits.minuteRequests.filter(time => now - time < 60000);
    userLimits.hourRequests = userLimits.hourRequests.filter(time => now - time < 3600000);
    
    // Check limits
    if (userLimits.minuteRequests.length >= this.config.maxRequestsPerMinute) {
      await this.logSecurityEvent('RATE_LIMIT_EXCEEDED', securityContext, { 
        limit: 'per-minute',
        count: userLimits.minuteRequests.length 
      });
      throw new Error('Rate limit exceeded: too many requests per minute');
    }
    
    if (userLimits.hourRequests.length >= this.config.maxRequestsPerHour) {
      await this.logSecurityEvent('RATE_LIMIT_EXCEEDED', securityContext, { 
        limit: 'per-hour',
        count: userLimits.hourRequests.length 
      });
      throw new Error('Rate limit exceeded: too many requests per hour');
    }
    
    // Record this request
    userLimits.minuteRequests.push(now);
    userLimits.hourRequests.push(now);
    this.rateLimits.set(rateLimitKey, userLimits);
  }

  async checkUserAuthorization(securityContext) {
    const { userId, practiceId } = securityContext;
    
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'check-user-authorization',
        practiceId: practiceId || 'global'
      };
      
      // Check if user exists and is active
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const users = await secureDataAccess.query('users', { 
        _id: userId, 
        status: 'active' 
      }, { limit: 1 }, context);
      
      if (users.length === 0) {
        await this.logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', securityContext, {
          reason: 'User not found or inactive'
        });
        throw new Error('User not authorized');
      }
      
      const user = users[0];
      
      // Check practice access
      if (practiceId && user.practiceId !== practiceId) {
        await this.logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', securityContext, {
          reason: 'Practice access denied',
          userClinic: user.practiceId,
          requestedClinic: practiceId
        });
        throw new Error('Access denied for this practice');
      }
      
      // Additional security checks can be added here
      return true;
    } catch (error) {
      console.error('Authorization check failed:', error);
      throw error;
    }
  }

  async sanitizeInput(params, securityContext) {
    if (!params || typeof params !== 'object') {
      return params;
    }
    
    const sanitized = { ...params };
    let foundSensitiveData = false;
    
    // Scan for sensitive data patterns
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string') {
        // Check for sensitive data patterns
        for (const pattern of this.config.sensitiveDataPatterns) {
          if (pattern.test(value)) {
            foundSensitiveData = true;
            
            if (this.config.encryptSensitiveData) {
              // Encrypt sensitive data
              sanitized[key] = this.encryptSensitiveValue(value);
            } else {
              // Mask sensitive data
              sanitized[key] = this.maskSensitiveValue(value);
            }
            
            await this.logSecurityEvent('SENSITIVE_DATA_DETECTED', securityContext, {
              field: key,
              pattern: pattern.toString()
            });
            break;
          }
        }
        
        // Remove any blocked terms
        for (const term of this.config.blockedTerms) {
          if (value.toLowerCase().includes(term.toLowerCase())) {
            await this.logSecurityEvent('BLOCKED_TERM_DETECTED', securityContext, {
              term,
              field: key
            });
            throw new Error(`Input contains blocked content: ${term}`);
          }
        }
      }
    }
    
    if (foundSensitiveData) {
      await this.logSecurityEvent('INPUT_SANITIZED', securityContext, {
        fieldsProcessed: Object.keys(sanitized).length
      });
    }
    
    return sanitized;
  }

  encryptSensitiveValue(value) {
    const key = crypto.createHash('sha256').update(this.serviceToken).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `encrypted:${iv.toString('hex')}:${encrypted}`;
  }

  maskSensitiveValue(value) {
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    
    const visibleChars = 2;
    const maskedSection = '*'.repeat(value.length - (visibleChars * 2));
    return value.substring(0, visibleChars) + maskedSection + value.substring(value.length - visibleChars);
  }

  async scanForSecurityThreats(params, securityContext) {
    const threats = [];
    
    // Convert params to string for scanning
    const content = JSON.stringify(params).toLowerCase();
    
    // Check for SQL injection patterns
    const sqlPatterns = [
      /union\s+select/i,
      /or\s+1\s*=\s*1/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /insert\s+into/i,
      /update\s+set/i
    ];
    
    for (const pattern of sqlPatterns) {
      if (pattern.test(content)) {
        threats.push({ type: 'SQL_INJECTION', pattern: pattern.toString() });
      }
    }
    
    // Check for XSS patterns
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i
    ];
    
    for (const pattern of xssPatterns) {
      if (pattern.test(content)) {
        threats.push({ type: 'XSS_ATTEMPT', pattern: pattern.toString() });
      }
    }
    
    // Check for command injection
    const commandPatterns = [
      /;\s*rm\s+-rf/i,
      /\|\s*nc\s+/i,
      /&&\s*curl\s+/i,
      /`[^`]+`/,
      /\$\([^)]+\)/
    ];
    
    for (const pattern of commandPatterns) {
      if (pattern.test(content)) {
        threats.push({ type: 'COMMAND_INJECTION', pattern: pattern.toString() });
      }
    }
    
    if (threats.length > 0) {
      await this.logSecurityEvent('SECURITY_THREAT_DETECTED', securityContext, { threats });
      
      // Track suspicious activity
      const userId = securityContext.userId;
      const suspiciousCount = (this.suspiciousActivity.get(userId) || 0) + 1;
      this.suspiciousActivity.set(userId, suspiciousCount);
      
      // Block user after multiple threats
      if (suspiciousCount >= 3) {
        this.blockedUsers.add(userId);
        await this.logSecurityEvent('USER_BLOCKED', securityContext, { 
          reason: 'Multiple security threats detected',
          threatCount: suspiciousCount 
        });
      }
      
      throw new Error(`Security threat detected: ${threats.map(t => t.type).join(', ')}`);
    }
  }

  async sanitizeOutput(result, securityContext) {
    if (!result || typeof result !== 'object') {
      return result;
    }
    
    // Remove any internal system information from output
    const sanitized = { ...result };
    
    // Remove potentially sensitive fields
    delete sanitized.systemInfo;
    delete sanitized.internalId;
    delete sanitized.debugInfo;
    delete sanitized.serviceToken;
    delete sanitized.apiKey;
    
    return sanitized;
  }

  async executeByName(operationName, params, context) {
    // This would integrate with the main agent service
    // For now, return a security-wrapped placeholder
    return {
      success: false,
      error: `Operation ${operationName} not available through security wrapper`,
      securityNote: 'All AI operations must be executed through the security wrapper'
    };
  }

  async handleSecurityError(error, securityContext) {
    await this.logSecurityEvent('SECURITY_ERROR', securityContext, {
      error: error.message,
      stack: error.stack?.substring(0, 1000) // Limit stack trace size
    });
    
    // Additional error handling logic can be added here
    console.error('Security error in AI operation:', error);
  }

  async logSecurityEvent(eventType, securityContext, details = {}) {
    if (!this.config.auditAllRequests) return;
    
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'log-security-event',
        practiceId: securityContext.practiceId || 'global'
      };
      
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      await secureDataAccess.create('security_audit_logs', {
        eventType,
        userId: securityContext.userId,
        practiceId: securityContext.practiceId,
        sessionId: securityContext.sessionId,
        ipAddress: securityContext.ipAddress,
        userAgent: securityContext.userAgent,
        operationType: securityContext.operationType,
        details,
        timestamp: new Date(),
        severity: this.getEventSeverity(eventType)
      }, context);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  getEventSeverity(eventType) {
    const highSeverityEvents = [
      'SECURITY_THREAT_DETECTED', 
      'UNAUTHORIZED_ACCESS_ATTEMPT', 
      'USER_BLOCKED',
      'BLOCKED_TERM_DETECTED'
    ];
    
    const mediumSeverityEvents = [
      'RATE_LIMIT_EXCEEDED',
      'SENSITIVE_DATA_DETECTED',
      'SECURITY_ERROR'
    ];
    
    if (highSeverityEvents.includes(eventType)) return 'HIGH';
    if (mediumSeverityEvents.includes(eventType)) return 'MEDIUM';
    return 'LOW';
  }

  startCleanupTimer() {
    // Clean up rate limits every 5 minutes
    setInterval(() => {
      this.cleanupRateLimits();
      this.cleanupSuspiciousActivity();
    }, 300000);
  }

  cleanupRateLimits() {
    const now = Date.now();
    
    for (const [key, limits] of this.rateLimits) {
      limits.minuteRequests = limits.minuteRequests.filter(time => now - time < 60000);
      limits.hourRequests = limits.hourRequests.filter(time => now - time < 3600000);
      
      // Remove if no recent activity
      if (limits.minuteRequests.length === 0 && limits.hourRequests.length === 0) {
        this.rateLimits.delete(key);
      }
    }
  }

  cleanupSuspiciousActivity() {
    // Reset suspicious activity counters after 1 hour
    const cutoffTime = Date.now() - 3600000;
    
    for (const [userId, timestamp] of this.suspiciousActivity) {
      if (timestamp < cutoffTime) {
        this.suspiciousActivity.delete(userId);
        this.blockedUsers.delete(userId); // Unblock users after cooldown
      }
    }
  }

  async getSecurityStats() {
    if (!this.initialized) await this.initialize();

    return {
      activeRateLimits: this.rateLimits.size,
      blockedUsers: this.blockedUsers.size,
      suspiciousUsers: this.suspiciousActivity.size,
      config: this.config
    };
  }

  unblockUser(userId) {
    this.blockedUsers.delete(userId);
    this.suspiciousActivity.delete(userId);
    console.log(`🔓 Unblocked user: ${userId}`);
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Security configuration updated');
  }
}

// Create and export singleton
const aiSecurityWrapper = new AISecurityWrapper();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('aiSecurityWrapper', () => aiSecurityWrapper);
}

module.exports = aiSecurityWrapper;