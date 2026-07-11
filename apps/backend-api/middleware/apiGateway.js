/**
 * 🚪 API GATEWAY - First Line of Defense
 *
 * ALL requests pass through here. No exceptions.
 * This gateway validates, sanitizes, and authorizes every request.
 *
 * SECURITY: Even if an attacker bypasses frontend, they cannot bypass this.
 *
 * Future developers: Add new endpoint validations here, not in individual routes.
 */

const crypto = require('crypto');
const validator = require('validator');
const secureConfigService = require('../services/secureConfigService');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { validateSignature } = require('./requestSigning');

// Request validation schemas for each endpoint
const endpointSchemas = {
  '/api/patients': {
    GET: { params: ['id', 'search'], maxLength: 100 },
    POST: { 
      required: ['firstName', 'lastName', 'dateOfBirth'],
      optional: ['email', 'phone', 'address'],
      validation: {
        email: (v) => !v || validator.isEmail(v),
        phone: (v) => !v || validator.isMobilePhone(v, 'any'),
        dateOfBirth: (v) => validator.isDate(v)
      }
    },
    PUT: { required: ['id'], maxLength: 500 },
    DELETE: { required: ['id'] }
  },
  '/api/agent/chat': {
    POST: { 
      required: ['message', 'sessionId'],
      maxLength: 5000,
      validation: {
        message: (v) => v && v.length > 0 && v.length <= 5000,
        sessionId: (v) => validator.isUUID(v, 4)
      }
    }
  },
  '/api/diagnosis': {
    POST: {
      required: ['symptoms', 'patientId'],
      maxLength: 10000,
      validation: {
        symptoms: (v) => Array.isArray(v) || typeof v === 'string',
        patientId: (v) => validator.isMongoId(v)
      }
    }
  },
  '/api/documents': {
    POST: {
      required: ['type', 'content'],
      optional: ['patientId', 'metadata'],
      maxSize: 10 * 1024 * 1024, // 10MB max
      validation: {
        type: (v) => ['medical', 'lab', 'imaging', 'prescription'].includes(v)
      }
    }
  }
};

// Rate limiters per endpoint
const rateLimiters = new Map();

// Initialize rate limiters for each endpoint
function initializeRateLimiters() {
  const defaultLimits = {
    '/api/auth/login': { points: 5, duration: 900 }, // 5 attempts per 15 min
    '/api/patients': { points: 100, duration: 60 }, // 100 requests per minute
    '/api/agent/chat': { points: 30, duration: 60 }, // 30 messages per minute
    '/api/diagnosis': { points: 10, duration: 60 }, // 10 diagnoses per minute
    '/api/documents': { points: 20, duration: 60 }, // 20 uploads per minute
    'default': { points: 200, duration: 60 } // Default: 200 req/min
  };

  for (const [endpoint, config] of Object.entries(defaultLimits)) {
    rateLimiters.set(endpoint, new RateLimiterMemory(config));
  }
}

// Validate request signature
async function validateRequestSignature(req) {
  // Only validate signatures for internal service requests
  if (!req.headers['x-internal-request']) {
    return { valid: true }; // Regular user requests don't need signatures
  }
  
  const signature = req.headers['x-request-signature'];
  const timestamp = req.headers['x-request-timestamp'];
  const nonce = req.headers['x-request-nonce'];
  const serviceId = req.headers['x-service-id'];
  
  if (!signature || !timestamp || !nonce || !serviceId) {
    return { valid: false, error: 'Missing security headers for internal request' };
  }

  // Check timestamp is within 5 minutes
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return { valid: false, error: 'Request expired' };
  }

  // Get service account and validate signature
  try {
    const serviceAccountManager = require('../services/serviceAccountManager');
    const serviceAccount = await serviceAccountManager.getServiceAccount(serviceId);
    
    if (!serviceAccount || !serviceAccount.apiKey) {
      return { valid: false, error: 'Unknown service' };
    }
    
    // Use the validateSignature function from requestSigning middleware
    const { validateSignature: validateSig } = require('./requestSigning');
    const isValid = validateSig(req, serviceAccount.apiKey);
    
    return { valid: isValid, error: isValid ? null : 'Invalid signature' };
  } catch (error) {
    console.error('Signature validation error:', error);
    return { valid: false, error: 'Signature validation failed' };
  }
}

// Validate request against schema
function validateRequestSchema(req) {
  const path = req.path.replace(/\/\d+$/, ''); // Normalize paths with IDs
  const method = req.method;
  const schema = endpointSchemas[path]?.[method];

  if (!schema) {
    // No schema defined, allow but log
    console.warn(`No schema defined for ${method} ${path}`);
    return { valid: true };
  }

  const data = method === 'GET' ? req.query : req.body;

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!data[field]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }
  }

  // Check field validations
  if (schema.validation) {
    for (const [field, validator] of Object.entries(schema.validation)) {
      if (data[field] && !validator(data[field])) {
        return { valid: false, error: `Invalid field: ${field}` };
      }
    }
  }

  // Check max length
  if (schema.maxLength) {
    const dataStr = JSON.stringify(data);
    if (dataStr.length > schema.maxLength) {
      return { valid: false, error: 'Request too large' };
    }
  }

  // Sanitize input
  sanitizeInput(data);

  return { valid: true };
}

// Sanitize user input
function sanitizeInput(data) {
  if (typeof data === 'object' && data !== null) {
    for (const key in data) {
      if (typeof data[key] === 'string') {
        // Remove any script tags or dangerous HTML
        data[key] = validator.escape(data[key]);
        // Trim whitespace
        data[key] = data[key].trim();
      } else if (typeof data[key] === 'object') {
        sanitizeInput(data[key]);
      }
    }
  }
  return data;
}

// Check for suspicious patterns
function detectSuspiciousPatterns(req) {
  const suspicious = [];
  
  // Check for SQL injection attempts
  const sqlPatterns = /(\bselect\b|\bunion\b|\bdrop\b|\binsert\b|\bupdate\b|\bdelete\b|\bexec\b|\bscript\b)/gi;
  const requestData = JSON.stringify(req.body) + JSON.stringify(req.query);
  
  if (sqlPatterns.test(requestData)) {
    suspicious.push('Potential SQL injection');
  }

  // Check for NoSQL injection
  if (requestData.includes('$where') || requestData.includes('$regex')) {
    suspicious.push('Potential NoSQL injection');
  }

  // Check for path traversal
  if (requestData.includes('../') || requestData.includes('..\\')) {
    suspicious.push('Potential path traversal');
  }

  // Check for excessive nested objects (DoS attack)
  function checkNesting(obj, depth = 0) {
    if (depth > 10) return true;
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (checkNesting(obj[key], depth + 1)) return true;
      }
    }
    return false;
  }

  if (checkNesting(req.body)) {
    suspicious.push('Excessive object nesting');
  }

  return suspicious;
}

// Main gateway middleware
async function apiGateway(req, res, next) {
  try {
    // Skip gateway for health checks
    if (req.path === '/health' || req.path === '/api/health') {
      return next();
    }

    // 1. Rate limiting
    const endpoint = req.path.replace(/\/\d+$/, '');
    const rateLimiter = rateLimiters.get(endpoint) || rateLimiters.get('default');
    const rateLimitKey = `${req.ip}_${req.user?.id || 'anonymous'}`;

    try {
      await rateLimiter.consume(rateLimitKey);
    } catch (rateLimitError) {
      return res.status(429).json({
        error: {
          he: 'יותר מדי בקשות. נסה שוב מאוחר יותר',
          en: 'Too many requests. Please try again later'
        }
      });
    }

    // 2. Validate request signature (skip in development for now)
    if (secureConfigService.get('NODE_ENV') === 'production') {
      const signatureValidation = await validateRequestSignature(req);
      if (!signatureValidation.valid) {
        return res.status(401).json({
          error: {
            he: 'חתימת הבקשה לא תקינה',
            en: signatureValidation.error
          }
        });
      }
    }

    // 3. Validate request schema
    const schemaValidation = validateRequestSchema(req);
    if (!schemaValidation.valid) {
      return res.status(400).json({
        error: {
          he: 'נתוני הבקשה לא תקינים',
          en: schemaValidation.error
        }
      });
    }

    // 4. Detect suspicious patterns
    const suspiciousPatterns = detectSuspiciousPatterns(req);
    if (suspiciousPatterns.length > 0) {
      console.error('Suspicious request detected:', {
        ip: req.ip,
        user: req.user?.id,
        patterns: suspiciousPatterns,
        path: req.path,
        method: req.method
      });

      // Log to audit system
      if (req.auditLog) {
        await req.auditLog({
          action: 'SUSPICIOUS_REQUEST_BLOCKED',
          details: {
            patterns: suspiciousPatterns,
            requestData: {
              path: req.path,
              method: req.method,
              ip: req.ip
            }
          },
          severity: 'HIGH'
        });
      }

      return res.status(403).json({
        error: {
          he: 'הבקשה נחסמה מסיבות אבטחה',
          en: 'Request blocked for security reasons'
        }
      });
    }

    // 5. Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // 6. Add request metadata for logging
    req.gatewayMetadata = {
      validated: true,
      timestamp: Date.now(),
      endpoint: endpoint,
      method: req.method,
      clientIp: req.ip
    };

    next();
  } catch (error) {
    console.error('API Gateway error:', error);
    res.status(500).json({
      error: {
        he: 'שגיאת מערכת',
        en: 'System error'
      }
    });
  }
}

// Initialize on module load
initializeRateLimiters();

// Export middleware and utilities
module.exports = {
  apiGateway,
  validateRequestSchema,
  sanitizeInput,
  detectSuspiciousPatterns,
  initializeRateLimiters
};