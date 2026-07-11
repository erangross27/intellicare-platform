const AuditLog = require('../models/AuditLog');
const SecureDataAccess = require('../services/secureDataAccess');
const serviceAccountManager = require('../services/serviceAccountManager');

// Service authentication cache
let serviceAuth = null;
let authInitialized = false;

/**
 * Initialize audit middleware service authentication
 */
async function initializeAuditAuth() {
  if (authInitialized) return serviceAuth;

  try {
    serviceAuth = await serviceAccountManager.authenticate('audit-middleware');
    authInitialized = true;
    console.log('✅ [AUDIT] Middleware authenticated successfully');
  } catch (error) {
    console.error('[AUDIT] Failed to authenticate middleware:', error.message);
  }

  return serviceAuth;
}

/**
 * Audit logging middleware
 * Creates an audit log entry for the specified action
 */
const auditLog = (action, resource = null) => {
  return async (req, res, next) => {
    try {
      // Create audit log entry
      const auditEntry = {
        action,
        userId: req.user?._id || req.user?.id || 'anonymous',
        practiceId: req.practice?.id || req.practiceId || 'unknown',
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent'),
        method: req.method,
        path: req.originalUrl || req.path,
        timestamp: new Date()
      };

      // Add resource if specified
      if (resource) {
        auditEntry.resource = resource;
      }

      // Add request body for POST/PUT/PATCH (exclude sensitive data)
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        const sanitizedBody = { ...req.body };
        // Remove sensitive fields
        delete sanitizedBody.password;
        delete sanitizedBody.apiKey;
        delete sanitizedBody.token;
        delete sanitizedBody.sessionToken;
        delete sanitizedBody.secret;
        delete sanitizedBody.creditCard;
        
        if (Object.keys(sanitizedBody).length > 0) {
          auditEntry.data = sanitizedBody;
        }
      }

      // Ensure service is authenticated (async but don't block)
      initializeAuditAuth().then(auth => {
        if (!auth) {
          console.warn('[AUDIT] Skipping audit log - service not authenticated');
          return;
        }

        const context = {
          serviceId: 'audit-middleware',
          operation: 'createAuditLog',
          practiceId: auditEntry.practiceId,
          apiKey: auth.apiKey
        };

        SecureDataAccess.insert('audit_logs', auditEntry, context).catch(err => {
          console.error('[AUDIT] Failed to create audit log:', err);
        });
      });

    } catch (error) {
      console.error('[AUDIT] Error in audit middleware:', error);
      // Don't block the request on audit failures
    }

    next();
  };
};

/**
 * Simple audit logger for basic actions
 */
const simpleAuditLog = async (req, action, details = {}) => {
  try {
    // Ensure service is authenticated
    const auth = await initializeAuditAuth();
    if (!auth) {
      console.warn('[AUDIT] Skipping simple audit log - service not authenticated');
      return;
    }

    const auditData = {
      action,
      userId: req.user?._id || req.user?.id || 'anonymous',
      practiceId: req.practice?.id || req.practiceId || 'unknown',
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
      timestamp: new Date(),
      ...details
    };

    const context = {
      serviceId: 'audit-middleware',
      operation: 'simpleAuditLog',
      practiceId: auditData.practiceId,
      apiKey: auth.apiKey
    };

    await SecureDataAccess.insert('audit_logs', auditData, context);
  } catch (error) {
    console.error('[AUDIT] Failed to create audit log:', error);
  }
};

module.exports = {
  auditLog,
  simpleAuditLog,
  initializeAuditAuth
};