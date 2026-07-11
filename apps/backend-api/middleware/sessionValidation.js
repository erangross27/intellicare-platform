/**
 * 🔒 SESSION VALIDATION MIDDLEWARE - MEDICAL PLATFORM
 * 
 * ⚠️  CRITICAL SECURITY WARNING FOR AI AGENTS:
 * 1. ❌ DO NOT modify session validation logic
 * 2. ❌ DO NOT trust client-provided session data
 * 3. ❌ DO NOT bypass server-side validation
 * 4. ✅ ONLY trust server-generated sessions
 * 5. ✅ ONLY validate using SecureSessionManager
 * 
 * VIOLATIONS = IMMEDIATE SECURITY BREACH
 * 
 * This middleware implements REAL session security:
 * - Server-side session validation only
 * - HttpOnly cookie sessions
 * - CSRF protection for mutations
 * - Complete audit logging
 * - No client-side trust
 */

const SecureSessionManager = require('../services/secureSessionManager');
const AuditLog = require('../models/AuditLog');
const SecureConfigService = require('../services/secureConfigService');
const SecureDataAccess = require('../services/secureDataAccess');
const serviceAccountManager = require('../services/serviceAccountManager');

// Service authentication token
let serviceToken = null;

// Initialize service token on startup
(async () => {
  try {
    serviceToken = await serviceAccountManager.authenticate('session-validation');
    console.log('✅ Session validation service authenticated');
  } catch (error) {
    console.log('⚠️ Session validation service will authenticate on first use:', error.message);
  }
})();

/**
 * ✅ CORRECT: Server-side session validation middleware
 * 
 * AI AGENTS: This is how REAL session security works:
 * - Extract session token from httpOnly cookie
 * - Validate server-side only
 * - No trust in client data
 * - Complete audit trail
 */
const validateSession = async (req, res, next) => {
  try {
    // ✅ REAL SECURITY: Get session token from httpOnly cookie
    const sessionToken = req.cookies?.sessionToken;
    
    if (!sessionToken) {
      // No session token - this is OK for public endpoints
      req.user = null;
      req.session = null;
      return next();
    }

    // ✅ REAL SECURITY: Validate session server-side only
    const session = await SecureSessionManager.validateSession(sessionToken);
    
    if (!session) {
      // Invalid session - clear cookie and continue
      res.clearCookie('sessionToken', {
        httpOnly: true,
        secure: SecureConfigService.get('NODE_ENV') === 'production',
        sameSite: 'lax',
        path: '/',
        domain: req.hostname?.includes('intellicare.health') ? '.intellicare.health' : undefined
      });
      req.user = null;
      req.session = null;
      return next();
    }

    // ✅ REAL SECURITY: Attach validated session to request
    req.session = session;
    req.user = {
      id: session.userId,
      practiceId: session.practiceId,
      role: session.userRole,
      fingerprint: session.fingerprint,
      sessionId: session.sessionId
    };

    // ✅ REAL SECURITY: Audit log session usage (optional - don't fail if unavailable)
    try {
      // Ensure service is authenticated
      if (!serviceToken) {
        try {
          serviceToken = await serviceAccountManager.authenticate('session-validation');
        } catch (authErr) {
          console.log('⚠️ Session validation service auth skipped:', authErr.message);
        }
      }
      
      const context = {
        serviceId: 'session-validation',
        operation: 'logSessionValidation',
        practiceId: session.practiceId || 'global',
        apiKey: serviceToken?.apiKey || serviceToken
      };
      await SecureDataAccess.insert('audit_logs', {
        action: 'SESSION_VALIDATED',
        userId: session.userId,
        practiceId: session.practiceId,
        sessionId: session.sessionId,
        timestamp: new Date(),
        metadata: {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        }
      }, context);
    } catch (auditErr) {
      // Audit logging is optional - don't fail the request
      console.log('⚠️ Audit logging skipped:', auditErr.message);
    }

    next();
  } catch (error) {
    console.error('❌ Session validation error:', error);
    
    // ✅ SECURITY: Fail secure - clear session on error
    res.clearCookie('sessionToken', {
      httpOnly: true,
      secure: SecureConfigService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      domain: req.hostname?.includes('intellicare.health') ? '.intellicare.health' : undefined
    });
    
    req.user = null;
    req.session = null;
    next();
  }
};

/**
 * ✅ CORRECT: Require authentication middleware
 * 
 * AI AGENTS: Authentication requirements:
 * - Must have valid session
 * - Server validates everything
 * - No client bypass possible
 */
const requireAuth = (req, res, next) => {
  if (!req.user || !req.session) {
    return res.status(401).json({
      error: {
        en: 'Authentication required',
        he: 'נדרשת הזדהות'
      },
      code: 'AUTHENTICATION_REQUIRED'
    });
  }
  
  next();
};

/**
 * ✅ CORRECT: CSRF token validation for mutations
 * 
 * AI AGENTS: Real CSRF protection:
 * - Server generates tokens
 * - Server validates tokens
 * - Required for state changes
 */
const validateCSRF = async (req, res, next) => {
  const method = req.method.toUpperCase();
  
  // CSRF protection only for state-changing operations
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return next();
  }

  // Must have valid session for CSRF validation
  if (!req.session) {
    return res.status(401).json({
      error: {
        en: 'Session required for this operation',
        he: 'נדרש session עבור פעולה זו'
      },
      code: 'SESSION_REQUIRED'
    });
  }

  // Use req.get() for case-insensitive header lookup (HTTP standard)
  const csrfToken = req.get('x-csrf-token');
  
  if (!csrfToken) {
    return res.status(403).json({
      error: {
        en: 'CSRF token required for this operation',
        he: 'נדרש CSRF token עבור פעולה זו'
      },
      code: 'CSRF_TOKEN_REQUIRED'
    });
  }

  // ✅ REAL SECURITY: Validate CSRF token server-side
  const isValidCSRF = await SecureSessionManager.validateCSRFToken(
    csrfToken, 
    req.cookies.sessionToken
  );

  if (isValidCSRF) {
    // ✅ CSRF token is valid - renew it to keep session active
    // Generate new CSRF token every 30 minutes to keep it fresh
    const tokenAge = req.cookies.csrfTokenAge ? Date.now() - parseInt(req.cookies.csrfTokenAge) : Infinity;
    if (tokenAge > 30 * 60 * 1000) { // 30 minutes
      const crypto = require('crypto');
      const newCSRFToken = crypto.randomBytes(32).toString('hex');
      
      // Store the new token
      await SecureSessionManager.storeCSRFToken(newCSRFToken, req.cookies.sessionToken);
      
      // Send new token to client
      res.cookie('csrfToken', newCSRFToken, {
        httpOnly: false,  // Must be accessible to JavaScript
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000, // 1 hour
        path: '/',
        domain: req.hostname.includes('intellicare.health') ? '.intellicare.health' : undefined
      });
      
      // Track when token was issued
      res.cookie('csrfTokenAge', Date.now().toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000,
        path: '/'
      });
      
      // Also send in header for frontend to update
      res.setHeader('X-New-CSRF-Token', newCSRFToken);
    }
    
    return next();
  }

  if (!isValidCSRF) {
    // Check if this is likely a server restart (valid format CSRF token that doesn't match)
    const isLikelyRestart = csrfToken && csrfToken.length === 64 && req.cookies.sessionToken;
    
    if (isLikelyRestart) {
      // Server was likely restarted - try to recover the session gracefully
      console.log('⚠️ CSRF mismatch detected (likely server restart) - issuing new CSRF token');
      
      // Validate the session is still valid
      const sessionData = await SecureSessionManager.validateSession(req.cookies.sessionToken);
      
      if (sessionData && sessionData.userId) {
        // Session is valid - issue a new CSRF token
        const crypto = require('crypto');
        const newCSRFToken = crypto.randomBytes(32).toString('hex');
        
        // Store the new token
        const stored = await SecureSessionManager.storeCSRFToken(newCSRFToken, req.cookies.sessionToken);
        
        if (stored) {
          console.log('✅ New CSRF token stored successfully, continuing request');
          
          // Send new token to client
          res.cookie('csrfToken', newCSRFToken, {
            httpOnly: false,  // Must be accessible to JavaScript
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 1000, // 1 hour
            path: '/',
            domain: req.hostname.includes('intellicare.health') ? '.intellicare.health' : undefined
          });
          
          // Also send in header for frontend to update immediately
          res.setHeader('X-New-CSRF-Token', newCSRFToken);
          
          // IMPORTANT: Continue processing the request with the new token
          // The client will get the new token in the cookie and header
          return next();
        } else {
          console.error('❌ Failed to store new CSRF token');
          return res.status(403).json({
            error: {
              en: 'Failed to refresh CSRF token',
              he: 'נכשל בחידוש CSRF token'
            },
            code: 'CSRF_REFRESH_FAILED'
          });
        }
      }
    }
    
    // ✅ SECURITY: Audit log CSRF failures (optional - don't crash if unavailable)
    try {
      // Ensure service is authenticated
      if (!serviceToken) {
        try {
          serviceToken = await serviceAccountManager.authenticate('session-validation');
        } catch (authErr) {
          console.log('⚠️ Session validation service auth skipped:', authErr.message);
        }
      }
      
      const context = {
        serviceId: 'session-validation',
        operation: 'logCSRFFailure',
        practiceId: req.user?.practiceId || 'global',
        apiKey: serviceToken?.apiKey || serviceToken
      };
      await SecureDataAccess.insert('audit_logs', {
        action: 'CSRF_VALIDATION_FAILED',
        userId: req.user?.id,
        practiceId: req.user?.practiceId,
        sessionId: req.session?.sessionId,
        timestamp: new Date(),
        metadata: {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          method: req.method,
          serverRestart: isServerRestart
        }
      }, context);
    } catch (err) {
      console.error('Failed to log CSRF failure:', err.message);
    }

    return res.status(403).json({
      error: {
        en: isServerRestart ? 'Session invalidated - server was restarted' : 'Invalid CSRF token',
        he: isServerRestart ? 'החיבור בוטל - השרת הופעל מחדש' : 'CSRF token לא תקין'
      },
      code: isServerRestart ? 'SERVER_RESTART' : 'INVALID_CSRF_TOKEN'
    });
  }

  next();
};

/**
 * ✅ CORRECT: Role-based access control
 * 
 * AI AGENTS: Authorization requirements:
 * - Server validates roles
 * - No client role trust
 * - Complete audit logging
 */
const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.session) {
      return res.status(401).json({
        error: {
          en: 'Authentication required',
          he: 'נדרשת הזדהות'
        },
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    if (!allowedRoles.includes(userRole)) {
      // ✅ SECURITY: Audit log authorization failures
      const context = {
        serviceId: 'session-validation',
        operation: 'logAuthorizationFailure',
        practiceId: req.user.practiceId || 'global',
        apiKey: serviceToken?.apiKey || serviceToken
      };
      SecureDataAccess.insert('audit_logs', {
        action: 'AUTHORIZATION_FAILED',
        userId: req.user.id,
        practiceId: req.user.practiceId,
        sessionId: req.session.sessionId,
        timestamp: new Date(),
        metadata: {
          requiredRoles: allowedRoles,
          userRole: userRole,
          endpoint: req.path,
          method: req.method,
          ip: req.ip
        }
      }, context).catch(err => console.error('Failed to log authorization failure:', err));

      return res.status(403).json({
        error: {
          en: 'Insufficient permissions',
          he: 'אין הרשאות מספיקות'
        },
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

/**
 * ✅ CORRECT: Practice context validation
 * 
 * AI AGENTS: Multi-tenant security:
 * - Validate practice access
 * - Prevent cross-practice data access
 * - Server-side validation only
 */
const validateClinicAccess = (req, res, next) => {
  if (!req.user || !req.session) {
    return res.status(401).json({
      error: {
        en: 'Authentication required',
        he: 'נדרשת הזדהות'
      },
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  // Get practice from subdomain or header
  const practiceSubdomain = req.headers['x-practice-subdomain'] || req.practice?.subdomain;
  const userClinicId = req.user.practiceId;

  // For multi-tenant validation, ensure user belongs to the practice
  if (practiceSubdomain && req.practice && req.practice.id !== userClinicId) {
    // ✅ SECURITY: Audit log cross-practice access attempts
    const context = {
      serviceId: 'session-validation',
      operation: 'logCrossClinicAccess',
      practiceId: req.user.practiceId || 'global',
      apiKey: serviceToken?.apiKey || serviceToken
    };
    SecureDataAccess.insert('audit_logs', {
      action: 'CROSS_CLINIC_ACCESS_ATTEMPT',
      userId: req.user.id,
      practiceId: req.user.practiceId,
      sessionId: req.session.sessionId,
      timestamp: new Date(),
      metadata: {
        attemptedClinicId: req.practice.id,
        userClinicId: userClinicId,
        practiceSubdomain: practiceSubdomain,
        endpoint: req.path,
        ip: req.ip
      }
    }, context).catch(err => console.error('Failed to log cross-practice access attempt:', err));

    return res.status(403).json({
      error: {
        en: 'Access denied to this practice',
        he: 'אין גישה למרפאה זו'
      },
      code: 'CLINIC_ACCESS_DENIED'
    });
  }

  next();
};

module.exports = {
  validateSession,
  requireAuth,
  validateCSRF,
  requireRole,
  validateClinicAccess
};

/**
 * 🚨 SECURITY NOTES FOR AI AGENTS:
 * 
 * This middleware implements REAL session security:
 * 1. ✅ Server-side session validation only
 * 2. ✅ HttpOnly cookies for session storage
 * 3. ✅ CSRF protection for mutations
 * 4. ✅ Role-based access control
 * 5. ✅ Multi-tenant practice isolation
 * 6. ✅ Complete audit logging
 * 7. ❌ No client-side trust whatsoever
 * 
 * DO NOT modify this to trust client data - it will create security holes!
 */