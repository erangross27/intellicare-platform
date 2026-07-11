// Security Monitoring Middleware
// Integrates security monitoring with application events

const securityMonitoringService = require('../services/securityMonitoringService');

/**
 * Track authentication attempts
 */
const trackAuthAttempt = (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  
  res.json = function(data) {
    // Check if this is an auth response
    if (req.path.includes('/auth') || req.path.includes('/login')) {
      const eventType = data.success 
        ? securityMonitoringService.eventTypes.AUTH_SUCCESS
        : securityMonitoringService.eventTypes.AUTH_FAILURE;
      
      const level = data.success
        ? securityMonitoringService.alertLevels.INFO
        : securityMonitoringService.alertLevels.WARNING;
      
      securityMonitoringService.emitSecurityEvent(eventType, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        username: req.body.username || req.body.email || 'unknown',
        practice: req.practice || req.headers['x-practice-subdomain'],
        path: req.path,
        method: req.method
      }, level);
    }
    
    // Call original method
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Track rate limit violations
 */
const trackRateLimit = (req, res, next) => {
  // Check if rate limit was hit
  if (res.statusCode === 429) {
    securityMonitoringService.emitSecurityEvent(
      securityMonitoringService.eventTypes.RATE_LIMIT_EXCEEDED,
      {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
        practice: req.practice || req.headers['x-practice-subdomain']
      },
      securityMonitoringService.alertLevels.WARNING
    );
  }
  next();
};

/**
 * Track unauthorized access attempts
 */
const trackUnauthorizedAccess = (req, res, next) => {
  // Skip tracking for public endpoints that don't require auth
  const publicEndpoints = [
    '/api/auth-ai/chat',
    '/api/auth-ai/session',
    '/api/passwordless-auth',
    '/api/practice-auth/check-subdomain',
    '/api/practice-auth/session-check',  // Session check is expected to return 401 when no session exists
    '/health',
    '/api/health'
  ];
  
  // Check if this is a public endpoint
  const isPublicEndpoint = publicEndpoints.some(endpoint => 
    req.path.startsWith(endpoint)
  );
  
  // Store original status method
  const originalStatus = res.status;
  
  res.status = function(code) {
    // Only track 401/403 for non-public endpoints
    if ((code === 401 || code === 403) && !isPublicEndpoint) {
      securityMonitoringService.emitSecurityEvent(
        securityMonitoringService.eventTypes.UNAUTHORIZED_ACCESS,
        {
          ip: req.ip,
          path: req.path,
          method: req.method,
          statusCode: code,
          userAgent: req.headers['user-agent'],
          practice: req.practice || req.headers['x-practice-subdomain']
        },
        securityMonitoringService.alertLevels.WARNING
      );
    }
    
    // Call original method
    return originalStatus.call(this, code);
  };
  
  next();
};

/**
 * Track suspicious activity
 */
const trackSuspiciousActivity = (req, res, next) => {
  const suspiciousPatterns = [
    /(\.\.|\/\/|\\\\)/,  // Path traversal
    /<script|javascript:|onerror=/i,  // XSS attempts
    /union.*select|drop.*table|delete.*from/i,  // SQL injection
    /\$\{|`.*`|\$\(/  // Command injection
  ];
  
  // Check request path
  let isSuspicious = false;
  let reason = '';
  
  // Check URL for suspicious patterns
  if (suspiciousPatterns.some(pattern => pattern.test(req.url))) {
    isSuspicious = true;
    reason = 'Suspicious URL pattern';
  }
  
  // Check body for suspicious patterns
  if (req.body && typeof req.body === 'object') {
    const bodyStr = JSON.stringify(req.body);
    if (suspiciousPatterns.some(pattern => pattern.test(bodyStr))) {
      isSuspicious = true;
      reason = 'Suspicious request body';
    }
  }
  
  // Check for blacklisted IP
  if (securityMonitoringService.isIPBlacklisted(req.ip)) {
    isSuspicious = true;
    reason = 'Blacklisted IP';
  }
  
  if (isSuspicious) {
    securityMonitoringService.emitSecurityEvent(
      securityMonitoringService.eventTypes.SUSPICIOUS_ACTIVITY,
      {
        ip: req.ip,
        path: req.path,
        method: req.method,
        reason,
        userAgent: req.headers['user-agent'],
        practice: req.practice || req.headers['x-practice-subdomain']
      },
      securityMonitoringService.alertLevels.WARNING
    );
    
    // Optionally block the request
    if (reason === 'Blacklisted IP') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
  }
  
  next();
};

/**
 * Track data breach attempts
 */
const trackDataBreachAttempt = (req, res, next) => {
  // Monitor bulk data requests
  const bulkPaths = ['/export', '/bulk', '/download-all', '/backup'];
  
  if (bulkPaths.some(path => req.path.includes(path))) {
    securityMonitoringService.emitSecurityEvent(
      securityMonitoringService.eventTypes.DATA_BREACH_ATTEMPT,
      {
        ip: req.ip,
        path: req.path,
        method: req.method,
        user: req.user?._id || 'anonymous',
        userAgent: req.headers['user-agent'],
        practice: req.practice || req.headers['x-practice-subdomain']
      },
      securityMonitoringService.alertLevels.INFO
    );
  }
  
  next();
};

/**
 * Track performance issues
 */
const trackPerformance = (req, res, next) => {
  const startTime = Date.now();
  
  // Override end method to measure response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    // Alert on slow responses
    if (duration > 5000) { // 5 seconds
      securityMonitoringService.emitSecurityEvent(
        securityMonitoringService.eventTypes.PERFORMANCE_ALERT,
        {
          path: req.path,
          method: req.method,
          duration,
          statusCode: res.statusCode
        },
        securityMonitoringService.alertLevels.WARNING
      );
    }
    
    // Call original method
    return originalEnd.apply(this, args);
  };
  
  next();
};

/**
 * Combined security monitoring middleware
 */
const securityMonitoring = [
  trackSuspiciousActivity,
  trackAuthAttempt,
  trackUnauthorizedAccess,
  trackDataBreachAttempt,
  trackPerformance
];

module.exports = {
  trackAuthAttempt,
  trackRateLimit,
  trackUnauthorizedAccess,
  trackSuspiciousActivity,
  trackDataBreachAttempt,
  trackPerformance,
  securityMonitoring
};