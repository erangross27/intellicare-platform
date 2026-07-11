const validator = require('../services/securityHeaderValidator');
const secureConfigService = require('../services/secureConfigService');

const headerValidationMiddleware = (options = {}) => {
  const { 
    enforceSignature = true,
    blockOnFailure = true,
    logViolations = true,
    skipPaths = ['/health', '/public', '/api/passwordless-auth/magic-login'],
    mode = 'strict' // strict, moderate, monitoring
  } = options;
  
  return async (req, res, next) => {
    try {
      // Skip validation for health checks and public routes
      const shouldSkip = skipPaths.some(path => {
        if (path.endsWith('*')) {
          return req.path.startsWith(path.slice(0, -1));
        }
        return req.path === path;
      });
      
      if (shouldSkip) {
        return next();
      }
      
      // Skip OPTIONS requests (preflight)
      if (req.method === 'OPTIONS') {
        return next();
      }
      
      // Validate headers
      const validation = validator.validateHeaders(req);
      
      if (!validation.valid || validation.warnings.length > 0) {
        if (logViolations) {
          try {
            const immutableAuditService = require('../services/immutableAuditService');
            await immutableAuditService.logSecurityEvent({
              type: 'INVALID_SECURITY_HEADERS',
              path: req.path,
              method: req.method,
              ip: validation.clientIp,
              errors: validation.errors,
              warnings: validation.warnings,
              headers: Object.keys(req.headers).filter(h => h.startsWith('x-')),
              timestamp: new Date().toISOString(),
              mode,
              blocked: blockOnFailure && !validation.valid
            });
          } catch (err) {
            console.error('Failed to log header validation event:', err);
          }
        }
        
        if (!validation.valid && blockOnFailure) {
          // Determine appropriate status code
          const statusCode = validation.errors.some(e => 
            e.includes('signature') || 
            e.includes('timestamp')
          ) ? 401 : 400;
          
          return res.status(statusCode).json({
            error: 'Security header validation failed',
            code: 'SECURITY_HEADER_VALIDATION_FAILED',
            details: secureConfigService.get('NODE_ENV', 'development') === 'development' ? {
              errors: validation.errors,
              warnings: validation.warnings
            } : undefined
          });
        }
      }
      
      // Verify signature if required
      if (enforceSignature && (req.headers['x-signature'] || req.headers['x-request-signature'])) {
        const signatureResult = validator.verifySignature(req);
        
        if (!signatureResult.valid) {
          if (logViolations) {
            try {
              const immutableAuditService = require('../services/immutableAuditService');
              await immutableAuditService.logSecurityEvent({
                type: 'INVALID_REQUEST_SIGNATURE',
                path: req.path,
                method: req.method,
                ip: validation.clientIp,
                reason: signatureResult.reason,
                timestamp: new Date().toISOString(),
                mode,
                blocked: blockOnFailure
              });
            } catch (err) {
              console.error('Failed to log signature validation event:', err);
            }
          }
          
          if (blockOnFailure) {
            return res.status(401).json({
              error: 'Invalid request signature',
              code: 'SIGNATURE_VERIFICATION_FAILED',
              details: secureConfigService.get('NODE_ENV', 'development') === 'development' ? {
                reason: signatureResult.reason
              } : undefined
            });
          }
        }
      }
      
      // Add validated headers to request
      req.securityHeaders = {
        requestId: req.headers['x-request-id'],
        timestamp: req.headers['x-timestamp'] || req.headers['x-request-timestamp'],
        signature: req.headers['x-signature'] || req.headers['x-request-signature'],
        serviceId: req.headers['x-service-id'],
        correlationId: req.headers['x-correlation-id'],
        sessionFingerprint: req.headers['x-session-fingerprint'],
        nonce: req.headers['x-request-nonce'],
        clientVersion: req.headers['x-client-version'],
        validated: true,
        validationMode: mode
      };
      
      // Add security context to request
      req.securityContext = {
        clientIp: validation.clientIp,
        validatedAt: Date.now(),
        mode,
        hasSignature: !!(req.headers['x-signature'] || req.headers['x-request-signature']),
        warnings: validation.warnings
      };
      
      next();
    } catch (error) {
      console.error('Header validation error:', error);
      
      // Handle SecurityError (blacklisted IP)
      if (error.name === 'SecurityError') {
        // Log the blocked request
        if (logViolations) {
          try {
            const immutableAuditService = require('../services/immutableAuditService');
            await immutableAuditService.logSecurityEvent({
              type: 'BLACKLISTED_IP_BLOCKED',
              path: req.path,
              method: req.method,
              ip: req.ip || req.connection?.remoteAddress,
              error: error.message,
              timestamp: new Date().toISOString()
            });
          } catch (err) {
            console.error('Failed to log blacklist event:', err);
          }
        }
        
        return res.status(403).json({
          error: 'Access denied',
          code: 'SECURITY_BLOCKED'
        });
      }
      
      // Don't expose internal errors in production
      if (secureConfigService.get('NODE_ENV') === 'production') {
        res.status(500).json({
          error: 'Internal server error',
          code: 'HEADER_VALIDATION_ERROR'
        });
      } else {
        res.status(500).json({
          error: 'Header validation error',
          code: 'HEADER_VALIDATION_ERROR',
          details: error.message
        });
      }
    }
  };
};

// Export different enforcement levels
module.exports = {
  // Strict mode: enforce all security headers and signatures
  strict: headerValidationMiddleware({ 
    enforceSignature: true, 
    blockOnFailure: true,
    mode: 'strict'
  }),
  
  // Moderate mode: validate headers but don't require signatures
  moderate: headerValidationMiddleware({ 
    enforceSignature: false, 
    blockOnFailure: true,
    mode: 'moderate'
  }),
  
  // Monitoring mode: log violations but don't block
  monitoring: headerValidationMiddleware({ 
    enforceSignature: false, 
    blockOnFailure: false,
    logViolations: true,
    mode: 'monitoring'
  }),
  
  // Development mode: lenient for local development
  development: headerValidationMiddleware({
    enforceSignature: false,
    blockOnFailure: false,
    logViolations: true,
    mode: 'development',
    skipPaths: [
      '/health',
      '/public*',
      '/api/passwordless-auth*',
      '/api/auth*',
      '/api/practice-auth*',
      '/api/chat*',  // Allow chat endpoints for browser access
      '/api/auth-ai*' // Allow AI auth endpoints
    ]
  }),
  
  // Custom configuration
  custom: headerValidationMiddleware
};

// Utility function to check if headers are validated
module.exports.requireValidatedHeaders = (req, res, next) => {
  if (!req.securityHeaders?.validated) {
    return res.status(400).json({ 
      error: 'Security headers not validated',
      code: 'HEADERS_NOT_VALIDATED'
    });
  }
  next();
};

// Utility function to get validation stats
module.exports.getValidationStats = () => {
  return validator.getAbuseStats();
};

// Admin functions for IP management
module.exports.blacklistIP = (ip) => {
  return validator.blacklistIP(ip);
};

module.exports.unblacklistIP = (ip) => {
  return validator.unblacklistIP(ip);
};

module.exports.isBlacklisted = (ip) => {
  return validator.isBlacklisted(ip);
};