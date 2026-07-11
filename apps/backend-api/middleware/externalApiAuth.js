/**
 * External API Authentication Middleware
 * Specialized authentication and authorization for external integration endpoints
 * with service-to-service authentication, API key validation, and rate limiting.
 * 
 * Features:
 * - Service account API key validation
 * - Request signing and timestamp verification
 * - IP whitelisting and blacklisting
 * - Enhanced audit logging for external calls
 * - Multi-tenant isolation enforcement
 */

const crypto = require('crypto');
const SecureConfigService = require('../services/secureConfigService');
const serviceAccountManager = require('../services/serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const SecureDataAccess = require('../services/secureDataAccess');

// Cache for validated API keys to reduce database hits
const apiKeyCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Service-to-Service Authentication Middleware
 * Validates API keys for internal service communications
 */
async function validateServiceAuth(req, res, next) {
  try {
    const apiKey = req.get('X-API-Key');
    const serviceId = req.get('X-Service-ID');
    const timestamp = req.get('X-Timestamp');
    const signature = req.get('X-Signature');

    // Check for required headers
    if (!apiKey || !serviceId) {
      return res.status(401).json({
        error: {
          en: 'Service authentication required',
          he: 'נדרש אימות שירות'
        },
        code: 'MISSING_AUTH_HEADERS'
      });
    }

    // Validate timestamp (prevent replay attacks)
    if (timestamp) {
      const requestTime = parseInt(timestamp);
      const currentTime = Date.now();
      const timeDiff = Math.abs(currentTime - requestTime);
      
      // Reject requests older than 5 minutes
      if (timeDiff > 5 * 60 * 1000) {
        return res.status(401).json({
          error: {
            en: 'Request timestamp too old',
            he: 'חותמת זמן של הבקשה ישנה מדי'
          },
          code: 'TIMESTAMP_EXPIRED'
        });
      }
    }

    // Check cache first
    const cacheKey = `${serviceId}:${apiKey}`;
    const cached = apiKeyCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      req.serviceAccount = cached.account;
      req.serviceId = serviceId;
      return next();
    }

    // Validate service account
    const serviceAccount = await serviceAccountManager.validateServiceAuth(serviceId, apiKey);
    if (!serviceAccount) {
      // Log failed authentication attempt
      const context = {
        serviceId: 'external-api-auth',
        operation: 'logAuthFailure',
        practiceId: 'global'
      };
      await SecureDataAccess.insert('audit_logs', {
        action: 'SERVICE_AUTH_FAILED',
        details: {
          serviceId,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        },
        timestamp: new Date(),
        severity: 'HIGH'
      }, context);

      return res.status(401).json({
        error: {
          en: 'Invalid service credentials',
          he: 'אישורי שירות לא תקינים'
        },
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Validate signature if provided
    if (signature && timestamp) {
      const expectedSignature = crypto
        .createHmac('sha256', serviceAccount.secretKey)
        .update(`${serviceId}${timestamp}${req.method}${req.originalUrl}`)
        .digest('hex');

      if (!crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )) {
        return res.status(401).json({
          error: {
            en: 'Invalid request signature',
            he: 'חתימת בקשה לא תקינה'
          },
          code: 'INVALID_SIGNATURE'
        });
      }
    }

    // Cache the validated service account
    apiKeyCache.set(cacheKey, {
      account: serviceAccount,
      timestamp: Date.now()
    });

    // Set request context
    req.serviceAccount = serviceAccount;
    req.serviceId = serviceId;
    req.isServiceRequest = true;

    // Log successful service authentication
    const context = {
      serviceId: 'external-api-auth',
      operation: 'logAuthSuccess',
      practiceId: 'global'
    };
    await SecureDataAccess.insert('audit_logs', {
      action: 'SERVICE_AUTH_SUCCESS',
      serviceId,
      details: {
        permissions: serviceAccount.permissions,
        ip: req.ip
      },
      timestamp: new Date()
    }, context);

    next();

  } catch (error) {
    console.error('Service authentication error:', error);
    res.status(500).json({
      error: {
        en: 'Authentication service unavailable',
        he: 'שירות האימות לא זמין'
      },
      code: 'AUTH_SERVICE_ERROR'
    });
  }
}

/**
 * External API Permission Validation
 * Checks if service has permission to access specific external APIs
 */
function validateExternalApiPermission(requiredPermission) {
  return (req, res, next) => {
    try {
      const { serviceAccount } = req;

      if (!serviceAccount || !serviceAccount.permissions) {
        return res.status(403).json({
          error: {
            en: 'No permissions configured for service',
            he: 'לא מוגדרות הרשאות עבור השירות'
          },
          code: 'NO_PERMISSIONS'
        });
      }

      // Check if service has the required permission
      const hasPermission = serviceAccount.permissions.external_apis && 
                           serviceAccount.permissions.external_apis.includes(requiredPermission);

      if (!hasPermission) {
        // Log unauthorized access attempt
        const context = {
          serviceId: 'external-api-auth',
          operation: 'logAccessDenied',
          practiceId: 'global'
        };
        SecureDataAccess.insert('audit_logs', {
          action: 'EXTERNAL_API_ACCESS_DENIED',
          serviceId: req.serviceId,
          details: {
            requiredPermission,
            userPermissions: serviceAccount.permissions.external_apis,
            endpoint: req.originalUrl
          },
          timestamp: new Date(),
          severity: 'MEDIUM'
        }, context);

        return res.status(403).json({
          error: {
            en: `Permission denied for ${requiredPermission}`,
            he: `הרשאה נדחתה עבור ${requiredPermission}`
          },
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      next();

    } catch (error) {
      console.error('Permission validation error:', error);
      res.status(500).json({
        error: {
          en: 'Permission validation failed',
          he: 'אימות הרשאות נכשל'
        },
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
}

/**
 * IP Whitelisting Middleware
 * Restricts access based on IP address for sensitive external APIs
 */
async function validateIPWhitelist(req, res, next) {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    const forwardedIP = req.get('X-Forwarded-For');
    
    // Get IP whitelist from secure config
    const whitelist = await SecureConfigService.get('EXTERNAL_API_IP_WHITELIST');
    if (!whitelist) {
      // No whitelist configured, allow all
      return next();
    }

    const allowedIPs = whitelist.split(',').map(ip => ip.trim());
    const isAllowed = allowedIPs.some(allowedIP => {
      if (allowedIP.includes('/')) {
        // CIDR notation support (simplified)
        return clientIP.startsWith(allowedIP.split('/')[0]);
      }
      return clientIP === allowedIP || forwardedIP === allowedIP;
    });

    if (!isAllowed) {
      // Log blocked IP access attempt
      const context = {
        serviceId: 'external-api-auth',
        operation: 'logIPBlocked',
        practiceId: 'global'
      };
      await SecureDataAccess.insert('audit_logs', {
        action: 'IP_BLOCKED_EXTERNAL_API',
        details: {
          clientIP,
          forwardedIP,
          endpoint: req.originalUrl,
          serviceId: req.serviceId
        },
        timestamp: new Date(),
        severity: 'HIGH'
      }, context);

      return res.status(403).json({
        error: {
          en: 'Access denied from this IP address',
          he: 'גישה נדחתה מכתובת IP זו'
        },
        code: 'IP_NOT_WHITELISTED'
      });
    }

    next();

  } catch (error) {
    console.error('IP whitelist validation error:', error);
    // In case of error, fail secure (deny access)
    res.status(500).json({
      error: {
        en: 'IP validation failed',
        he: 'אימות IP נכשל'
      },
      code: 'IP_VALIDATION_ERROR'
    });
  }
}

/**
 * Enhanced Audit Logging for External APIs
 * Logs all external API access attempts with detailed context
 */
function auditExternalApiAccess(apiProvider) {
  return async (req, res, next) => {
    try {
      const startTime = Date.now();

      // Log request
      const context = {
        serviceId: 'external-api-auth',
        operation: 'logExternalRequest',
        practiceId: req.practice?.id || 'global'
      };
      await SecureDataAccess.insert('audit_logs', {
        action: 'EXTERNAL_API_REQUEST',
        serviceId: req.serviceId,
        userId: req.user?.id,
        practiceId: req.practice?.id,
        details: {
          provider: apiProvider,
          endpoint: req.originalUrl,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          parameters: {
            query: req.query,
            body: req.method !== 'GET' ? '[REDACTED]' : undefined
          }
        },
        timestamp: new Date()
      }, context);

      // Intercept response to log completion
      const originalSend = res.send;
      res.send = function(data) {
        const endTime = Date.now();
        
        // Log response (async, don't wait)
        const context = {
          serviceId: 'external-api-auth',
          operation: 'logExternalResponse',
          practiceId: req.practice?.id || 'global'
        };
        SecureDataAccess.insert('audit_logs', {
          action: 'EXTERNAL_API_RESPONSE',
          serviceId: req.serviceId,
          userId: req.user?.id,
          practiceId: req.practice?.id,
          details: {
            provider: apiProvider,
            endpoint: req.originalUrl,
            statusCode: res.statusCode,
            responseTime: endTime - startTime,
            success: res.statusCode < 400
          },
          timestamp: new Date()
        }, context).catch(err => console.error('Audit log error:', err));

        originalSend.call(this, data);
      };

      next();

    } catch (error) {
      console.error('External API audit logging error:', error);
      // Don't block request on audit failure
      next();
    }
  };
}

/**
 * Rate Limiting by Service Account
 * Custom rate limits based on service tier and API provider
 */
function createServiceRateLimit(provider) {
  const rateLimits = new Map();
  
  return async (req, res, next) => {
    try {
      const { serviceAccount } = req;
      
      if (!serviceAccount) {
        return next();
      }

      const serviceId = serviceAccount.serviceId;
      const now = Date.now();
      const windowMs = 60000; // 1 minute window
      
      // Get rate limit for this service tier
      const maxRequests = serviceAccount.rateLimits?.[provider] || 100; // Default limit
      
      // Clean old entries
      const cutoff = now - windowMs;
      if (!rateLimits.has(serviceId)) {
        rateLimits.set(serviceId, []);
      }
      
      const requests = rateLimits.get(serviceId).filter(time => time > cutoff);
      
      if (requests.length >= maxRequests) {
        return res.status(429).json({
          error: {
            en: 'Service rate limit exceeded',
            he: 'חרגת ממגבלת קצב השירות'
          },
          code: 'SERVICE_RATE_LIMIT_EXCEEDED',
          resetTime: cutoff + windowMs
        });
      }

      // Add current request
      requests.push(now);
      rateLimits.set(serviceId, requests);
      
      next();

    } catch (error) {
      console.error('Service rate limiting error:', error);
      next(); // Don't block on rate limit errors
    }
  };
}

/**
 * Request Size Validation
 * Limits request payload size for external API endpoints
 */
function validateRequestSize(maxSize = 10 * 1024 * 1024) { // 10MB default
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        error: {
          en: 'Request payload too large',
          he: 'גודל הבקשה גדול מדי'
        },
        code: 'PAYLOAD_TOO_LARGE',
        maxSize
      });
    }

    next();
  };
}

// Clean cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of apiKeyCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      apiKeyCache.delete(key);
    }
  }
}, 60000); // Clean every minute

module.exports = {
  validateServiceAuth,
  validateExternalApiPermission,
  validateIPWhitelist,
  auditExternalApiAccess,
  createServiceRateLimit,
  validateRequestSize
};