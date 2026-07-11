/**
 * Request Signing Middleware
 * Validates request signatures for internal service-to-service communication
 * Ensures requests haven't been tampered with and are from authorized services
 */

const crypto = require('crypto');
const { simpleAuditLog } = require('./auditLog');
const serviceAccountManager = require('../services/serviceAccountManager');
const securityMonitoringService = require('../services/securityMonitoringService');

/**
 * Validate request signature
 */
function validateSignature(req, signingKey) {
  const signature = req.headers['x-request-signature'];
  const timestamp = req.headers['x-request-timestamp'];
  const nonce = req.headers['x-request-nonce'];
  
  if (!signature || !timestamp || !nonce) {
    return false;
  }
  
  // Check timestamp is within acceptable window (5 minutes)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return false;
  }
  
  // Build signature base
  const method = req.method.toUpperCase();
  const url = req.originalUrl || req.url;
  const body = req.body ? JSON.stringify(req.body) : '';
  
  const signatureBase = [
    method,
    url,
    timestamp,
    nonce,
    body
  ].join('\n');
  
  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', signingKey)
    .update(signatureBase)
    .digest('hex');
  
  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Track nonces to prevent replay attacks
 */
class NonceTracker {
  constructor() {
    this.usedNonces = new Set();
    this.cleanupInterval = 5 * 60 * 1000; // 5 minutes
    
    // Clean up old nonces periodically
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }
  
  isUsed(nonce) {
    return this.usedNonces.has(nonce);
  }
  
  markUsed(nonce) {
    this.usedNonces.add(nonce);
    
    // Store timestamp with nonce for cleanup
    setTimeout(() => {
      this.usedNonces.delete(nonce);
    }, this.cleanupInterval);
  }
  
  cleanup() {
    // In production, this would clean based on timestamps
    if (this.usedNonces.size > 10000) {
      this.usedNonces.clear();
    }
  }
}

const nonceTracker = new NonceTracker();

/**
 * Request signing validation middleware
 */
async function validateRequestSignature(req, res, next) {
  // Skip validation for public endpoints
  const publicPaths = [
    '/health',
    '/api/auth/login',
    '/api/auth/signup',
    '/api/passwordless-auth',
    '/api/public'
  ];
  
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // Skip validation for non-internal requests (from users)
  if (!req.headers['x-internal-request']) {
    return next();
  }
  
  try {
    const serviceId = req.headers['x-service-id'];
    const serviceToken = req.headers['x-service-token'];
    const signature = req.headers['x-request-signature'];
    const nonce = req.headers['x-request-nonce'];
    
    // Validate service authentication
    if (!serviceId || !serviceToken) {
      await simpleAuditLog(req, 'REQUEST_SIGNATURE_MISSING_AUTH', {
        serviceId: serviceId || 'unknown',
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: 'Service authentication required'
      });
    }
    
    // Check nonce for replay attack prevention
    if (nonce && nonceTracker.isUsed(nonce)) {
      await simpleAuditLog(req, 'REQUEST_REPLAY_ATTACK', {
        serviceId,
        nonce,
        path: req.path,
        method: req.method
      });
      
      await securityMonitoringService.logSecurityEvent({
        type: 'REPLAY_ATTACK_DETECTED',
        severity: 'critical',
        serviceId,
        details: {
          path: req.path,
          nonce,
          ip: req.ip
        }
      });
      
      return res.status(403).json({
        success: false,
        error: 'Request replay detected'
      });
    }
    
    // Validate service token
    const serviceAccount = await serviceAccountManager.validateToken(serviceId, serviceToken);
    if (!serviceAccount) {
      await simpleAuditLog(req, 'REQUEST_SIGNATURE_INVALID_TOKEN', {
        serviceId,
        path: req.path,
        method: req.method
      });
      
      return res.status(401).json({
        success: false,
        error: 'Invalid service token'
      });
    }
    
    // Validate request signature if present
    if (signature) {
      const signingKey = serviceAccount.apiKey;
      const isValid = validateSignature(req, signingKey);
      
      if (!isValid) {
        await simpleAuditLog(req, 'REQUEST_SIGNATURE_INVALID', {
          serviceId,
          path: req.path,
          method: req.method,
          signature: signature.substring(0, 10) + '...'
        });
        
        await securityMonitoringService.logSecurityEvent({
          type: 'INVALID_REQUEST_SIGNATURE',
          severity: 'high',
          serviceId,
          details: {
            path: req.path,
            method: req.method,
            ip: req.ip
          }
        });
        
        return res.status(403).json({
          success: false,
          error: 'Invalid request signature'
        });
      }
      
      // Mark nonce as used
      if (nonce) {
        nonceTracker.markUsed(nonce);
      }
    }
    
    // Attach service info to request
    req.serviceAccount = serviceAccount;
    req.isInternalRequest = true;
    
    // Log successful validation
    await simpleAuditLog(req, 'REQUEST_SIGNATURE_VALID', {
      serviceId,
      path: req.path,
      method: req.method
    });
    
    next();
  } catch (error) {
    console.error('Request signature validation error:', error);
    
    await simpleAuditLog(req, 'REQUEST_SIGNATURE_ERROR', {
      error: error.message,
      path: req.path,
      method: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Request validation failed'
    });
  }
}

/**
 * Generate response signature for internal requests
 */
function signResponse(req, res, next) {
  // Only sign responses for internal requests
  if (!req.isInternalRequest) {
    return next();
  }
  
  // Store original send
  const originalSend = res.send;
  
  res.send = function(data) {
    // Generate response signature
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Get signing key from service account
    const signingKey = req.serviceAccount?.apiKey;
    if (signingKey) {
      const method = req.method.toUpperCase();
      const url = req.originalUrl || req.url;
      const body = typeof data === 'object' ? JSON.stringify(data) : data;
      
      const signatureBase = [
        method,
        url,
        timestamp,
        nonce,
        body
      ].join('\n');
      
      const signature = crypto
        .createHmac('sha256', signingKey)
        .update(signatureBase)
        .digest('hex');
      
      // Add signature headers
      res.set({
        'X-Response-Signature': signature,
        'X-Response-Timestamp': timestamp,
        'X-Response-Nonce': nonce
      });
    }
    
    // Call original send
    return originalSend.call(this, data);
  };
  
  next();
}

/**
 * Rate limiting for internal services
 */
class ServiceRateLimiter {
  constructor() {
    this.limits = new Map();
    this.windowMs = 60 * 1000; // 1 minute
    this.defaultLimit = 100; // requests per minute
    
    // Clean up old entries
    setInterval(() => {
      this.cleanup();
    }, this.windowMs);
  }
  
  checkLimit(serviceId, limit = this.defaultLimit) {
    const now = Date.now();
    const key = `${serviceId}:${Math.floor(now / this.windowMs)}`;
    
    const current = this.limits.get(key) || 0;
    if (current >= limit) {
      return false;
    }
    
    this.limits.set(key, current + 1);
    return true;
  }
  
  cleanup() {
    const now = Date.now();
    const currentWindow = Math.floor(now / this.windowMs);
    
    for (const [key] of this.limits) {
      const window = parseInt(key.split(':')[1]);
      if (window < currentWindow) {
        this.limits.delete(key);
      }
    }
  }
}

const serviceRateLimiter = new ServiceRateLimiter();

/**
 * Rate limiting middleware for internal services
 */
async function rateLimitInternalServices(req, res, next) {
  if (!req.isInternalRequest) {
    return next();
  }
  
  const serviceId = req.headers['x-service-id'];
  const limit = req.serviceAccount?.rateLimit || 100;
  
  if (!serviceRateLimiter.checkLimit(serviceId, limit)) {
    await simpleAuditLog(req, 'SERVICE_RATE_LIMIT_EXCEEDED', {
      serviceId,
      path: req.path,
      method: req.method
    });
    
    return res.status(429).json({
      success: false,
      error: 'Service rate limit exceeded'
    });
  }
  
  next();
}

module.exports = {
  validateRequestSignature,
  signResponse,
  rateLimitInternalServices,
  validateSignature,
  NonceTracker
};