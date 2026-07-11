// Content Security Policy (CSP) Routes
// Handles CSP violation reporting and policy management

const express = require('express');
const router = express.Router();
const cspService = require('../services/cspService');
const { fullClinicAuth } = require('../middleware/practiceAuth');
const asyncHandler = require('../utils/asyncHandler');

// CSP Violation Report Endpoint (PUBLIC - no auth required for browser reporting)
router.post('/report', asyncHandler(async (req, res) => {
  try {
    // CSP reports come in a specific format
    const report = req.body['csp-report'] || req.body;
    
    // Process the violation
    const violation = await cspService.processViolation(report, req);
    
    console.log(`🔒 CSP Violation: ${violation.violatedDirective} from ${req.ip}`);
    
    // Log to audit system using SecureDataAccess
    if (req.models?.AuditLog) {
      const auditContext = {
        serviceId: 'csp-service',
        apiKey: req.headers['x-api-key'] || 'internal-service',
        practiceId: req.practice?.id || 'global'
      };
      
      await SecureDataAccess.insert('audit_logs', {
        userId: req.user?._id || 'anonymous',
        userDetails: {
          email: req.user?.email || 'anonymous',
          fullName: req.user?.profile?.fullName || 'Anonymous',
          roles: req.user?.roles || []
        },
        action: 'CSP_VIOLATION',
        resourceType: 'SECURITY',
        resourceId: violation.id,
        resourceDetails: {
          documentUri: violation.documentUri,
          blockedUri: violation.blockedUri,
          violatedDirective: violation.violatedDirective,
          effectiveDirective: violation.effectiveDirective,
          scriptSample: violation.scriptSample
        },
        request: {
          method: req.method,
          url: req.originalUrl,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          sessionId: req.sessionID
        },
        response: {
          statusCode: 204,
          success: true
        },
        timestamp: new Date(),
        severity: cspService.getSeverity(violation)
      }, auditContext);
    }
    
    // Return 204 No Content (standard for CSP reports)
    res.status(204).end();
    
  } catch (error) {
    console.error('❌ CSP report processing error:', error);
    // Still return 204 to prevent browser retries
    res.status(204).end();
  }
}));

// Get CSP Statistics (Protected - Admin Only)
router.get('/statistics', fullClinicAuth, asyncHandler(async (req, res) => {
  // Check admin permissions
  if (!req.user.roles?.includes('admin') && !req.user.permissions?.includes('view_security_stats')) {
    return res.status(403).json({
      success: false,
      message: {
        en: 'Access denied. Admin privileges required.',
        he: 'גישה נדחתה. נדרשות הרשאות מנהל.'
      }
    });
  }
  
  const stats = cspService.getStatistics();
  
  res.json({
    success: true,
    statistics: stats,
    timestamp: new Date()
  });
}));

// Get Recent CSP Violations (Protected - Admin Only)
router.get('/violations', fullClinicAuth, asyncHandler(async (req, res) => {
  // Check admin permissions
  if (!req.user.roles?.includes('admin') && !req.user.permissions?.includes('view_security_logs')) {
    return res.status(403).json({
      success: false,
      message: {
        en: 'Access denied. Admin privileges required.',
        he: 'גישה נדחתה. נדרשות הרשאות מנהל.'
      }
    });
  }
  
  const { timeWindow = 3600000 } = req.query; // Default 1 hour
  const violations = cspService.getRecentViolations(parseInt(timeWindow));
  
  res.json({
    success: true,
    violations: violations,
    count: violations.length,
    timeWindow: parseInt(timeWindow),
    timestamp: new Date()
  });
}));

// Update CSP Policy (Protected - Admin Only)
router.put('/policy', fullClinicAuth, asyncHandler(async (req, res) => {
  // Check admin permissions
  if (!req.user.roles?.includes('admin') && !req.user.permissions?.includes('manage_security')) {
    return res.status(403).json({
      success: false,
      message: {
        en: 'Access denied. Admin privileges required.',
        he: 'גישה נדחתה. נדרשות הרשאות מנהל.'
      }
    });
  }
  
  const { environment, directive, sources } = req.body;
  
  if (!environment || !directive || !sources) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: environment, directive, sources'
    });
  }
  
  cspService.updatePolicy(environment, directive, sources);
  
  // Log policy change using SecureDataAccess
  const auditContext = {
    serviceId: 'csp-service',
    apiKey: req.headers['x-api-key'] || 'internal-service',
    practiceId: req.practice?.id || 'global'
  };
  
  await SecureDataAccess.insert('audit_logs', {
    userId: req.user._id,
    userDetails: {
      email: req.user.email,
      fullName: req.user.profile?.fullName,
      roles: req.user.roles
    },
    action: 'CSP_POLICY_UPDATE',
    resourceType: 'SECURITY',
    resourceId: 'CSP_POLICY',
    resourceDetails: {
      environment,
      directive,
      sources,
      updatedBy: req.user.email
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID
    },
    response: {
      statusCode: 200,
      success: true
    },
    timestamp: new Date(),
    severity: 'high'
  });
  
  res.json({
    success: true,
    message: 'CSP policy updated successfully',
    policy: {
      environment,
      directive,
      sources
    }
  });
}));

// Add Trusted Source to CSP (Protected - Admin Only)
router.post('/trusted-source', fullClinicAuth, asyncHandler(async (req, res) => {
  // Check admin permissions
  if (!req.user.roles?.includes('admin') && !req.user.permissions?.includes('manage_security')) {
    return res.status(403).json({
      success: false,
      message: {
        en: 'Access denied. Admin privileges required.',
        he: 'גישה נדחתה. נדרשות הרשאות מנהל.'
      }
    });
  }
  
  const { environment, directive, source } = req.body;
  
  if (!environment || !directive || !source) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: environment, directive, source'
    });
  }
  
  cspService.addTrustedSource(environment, directive, source);
  
  // Log source addition using SecureDataAccess
  const auditContext = {
    serviceId: 'csp-service',
    apiKey: req.headers['x-api-key'] || 'internal-service',
    practiceId: req.practice?.id || 'global'
  };
  
  await SecureDataAccess.insert('audit_logs', {
    userId: req.user._id,
    userDetails: {
      email: req.user.email,
      fullName: req.user.profile?.fullName,
      roles: req.user.roles
    },
    action: 'CSP_SOURCE_ADDED',
    resourceType: 'SECURITY',
    resourceId: 'CSP_POLICY',
    resourceDetails: {
      environment,
      directive,
      source,
      addedBy: req.user.email
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID
    },
    response: {
      statusCode: 200,
      success: true
    },
    timestamp: new Date(),
    severity: 'medium'
  });
  
  res.json({
    success: true,
    message: 'Trusted source added successfully',
    source: {
      environment,
      directive,
      source
    }
  });
}));

// Get Current CSP Policy (Protected)
router.get('/policy/:environment', fullClinicAuth, asyncHandler(async (req, res) => {
  const { environment } = req.params;
  const policy = cspService.policies[environment];
  
  if (!policy) {
    return res.status(404).json({
      success: false,
      message: `No policy found for environment: ${environment}`
    });
  }
  
  res.json({
    success: true,
    environment,
    policy,
    timestamp: new Date()
  });
}));

module.exports = router;