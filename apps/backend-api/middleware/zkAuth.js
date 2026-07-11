// Zero-Knowledge Authentication Middleware
// Provides enhanced authentication with MFA and session fingerprinting

const zeroKnowledgeAuthService = require('../services/zeroKnowledgeAuthService');

/**
 * Require MFA for sensitive operations
 */
const requireMFA = async (req, res, next) => {
  // Check if user has MFA enabled
  const userId = req.user?._id?.toString();
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  const mfaData = zeroKnowledgeAuthService.mfaSecrets.get(userId);
  
  if (!mfaData || !mfaData.verified) {
    // MFA not enabled, allow but warn
    console.warn(`⚠️ User ${userId} accessing sensitive operation without MFA`);
    req.mfaVerified = false;
    return next();
  }
  
  // Check for MFA token in header or body
  const mfaToken = req.headers['x-mfa-token'] || req.body.mfaToken;
  
  if (!mfaToken) {
    return res.status(403).json({
      success: false,
      message: 'MFA verification required',
      requireMFA: true
    });
  }
  
  try {
    const verified = zeroKnowledgeAuthService.verifyMFAToken(userId, mfaToken);
    
    if (!verified) {
      return res.status(403).json({
        success: false,
        message: 'Invalid MFA token',
        requireMFA: true
      });
    }
    
    req.mfaVerified = true;
    next();
  } catch (error) {
    console.error('MFA verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'MFA verification failed'
    });
  }
};

/**
 * Verify session fingerprint
 */
const verifySessionFingerprint = (req, res, next) => {
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  
  if (!sessionId) {
    // No session, allow but flag
    req.sessionVerified = false;
    return next();
  }
  
  const verification = zeroKnowledgeAuthService.verifySessionFingerprint(sessionId, req);
  
  if (!verification.valid) {
    console.warn(`⚠️ Session fingerprint mismatch: ${verification.reason}`);
    
    // Add warning header
    res.setHeader('X-Session-Warning', 'fingerprint-mismatch');
    
    // For high-security operations, might block
    if (req.path.includes('/admin') || req.path.includes('/export')) {
      return res.status(403).json({
        success: false,
        message: 'Session verification failed',
        reason: verification.reason,
        requireReauth: true
      });
    }
  }
  
  req.sessionVerified = verification.valid;
  req.sessionMatchScore = verification.matchScore;
  next();
};

/**
 * Enforce password policy on password changes
 */
const enforcePasswordPolicy = (req, res, next) => {
  const { password, newPassword } = req.body;
  const passwordField = password || newPassword;
  
  if (!passwordField) {
    return next();
  }
  
  const username = req.body.username || req.user?.username || '';
  const validation = zeroKnowledgeAuthService.validatePasswordStrength(passwordField, username);
  
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: 'Password does not meet security requirements',
      errors: validation.errors,
      policy: zeroKnowledgeAuthService.passwordPolicy,
      strength: {
        score: validation.score,
        entropy: validation.entropy
      }
    });
  }
  
  req.passwordValidation = validation;
  next();
};

/**
 * Add security strength to response
 */
const addSecurityStrength = (req, res, next) => {
  if (req.user) {
    const userId = req.user._id?.toString();
    if (userId) {
      const strength = zeroKnowledgeAuthService.getAuthenticationStrength(userId);
      res.setHeader('X-Auth-Strength', strength.level);
      res.setHeader('X-Auth-Score', strength.score.toString());
    }
  }
  next();
};

/**
 * Rate limit authentication attempts
 */
const authRateLimit = (() => {
  const attempts = new Map();
  const maxAttempts = 5;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  
  return (req, res, next) => {
    const key = `${req.ip}_${req.body.username || 'unknown'}`;
    const now = Date.now();
    
    // Get attempts for this key
    let userAttempts = attempts.get(key) || { count: 0, resetTime: now + windowMs };
    
    // Reset if window expired
    if (now > userAttempts.resetTime) {
      userAttempts = { count: 0, resetTime: now + windowMs };
    }
    
    // Increment attempts
    userAttempts.count++;
    attempts.set(key, userAttempts);
    
    // Check if exceeded
    if (userAttempts.count > maxAttempts) {
      const retryAfter = Math.ceil((userAttempts.resetTime - now) / 1000);
      
      res.setHeader('Retry-After', retryAfter.toString());
      
      return res.status(429).json({
        success: false,
        message: 'Too many authentication attempts',
        retryAfter
      });
    }
    
    // Clean old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      for (const [k, v] of attempts) {
        if (now > v.resetTime) {
          attempts.delete(k);
        }
      }
    }
    
    next();
  };
})();

/**
 * Log authentication events
 */
const logAuthEvent = (eventType) => {
  return async (req, res, next) => {
    const userId = req.user?._id || req.body.username || 'unknown';
    const ip = req.ip;
    
    console.log(`🔐 Auth Event [${eventType}] - User: ${userId}, IP: ${ip}`);
    
    // Log to audit system if available
    if (req.auditLog) {
      await req.auditLog(`AUTH_${eventType.toUpperCase()}`, {
        userId,
        ip,
        userAgent: req.headers['user-agent'],
        mfaUsed: req.mfaVerified || false,
        sessionVerified: req.sessionVerified || false
      });
    }
    
    next();
  };
};

/**
 * Require strong authentication for sensitive operations
 */
const requireStrongAuth = async (req, res, next) => {
  // Check multiple factors
  const factors = {
    authenticated: !!req.user,
    mfaVerified: req.mfaVerified || false,
    sessionVerified: req.sessionVerified !== false,
    recentAuth: false // Would check if authenticated recently
  };
  
  // Calculate authentication strength
  const strength = Object.values(factors).filter(f => f).length;
  
  if (strength < 3) {
    return res.status(403).json({
      success: false,
      message: 'Strong authentication required',
      factors,
      required: ['authenticated', 'mfaVerified', 'sessionVerified']
    });
  }
  
  req.authStrength = strength;
  next();
};

module.exports = {
  requireMFA,
  verifySessionFingerprint,
  enforcePasswordPolicy,
  addSecurityStrength,
  authRateLimit,
  logAuthEvent,
  requireStrongAuth
};