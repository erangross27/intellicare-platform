const secureConfigService = require('../services/secureConfigService');

// Request Correlation Middleware
// Adds unique request IDs for tracking and debugging across microservices

const { v4: uuidv4 } = require('uuid');
const { toIsraelISOString } = require('../utils/timezoneHelper');

/**
 * Middleware to add unique request ID for correlation
 * This helps track requests across logs, services, and error reports
 */
const requestIdMiddleware = (req, res, next) => {
  // Check if request already has an ID (from upstream service)
  const existingRequestId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  
  // Generate or use existing request ID
  req.id = existingRequestId || uuidv4();
  req.correlationId = req.id; // Alias for compatibility
  
  // Add request ID to response headers
  res.setHeader('X-Request-Id', req.id);
  res.setHeader('X-Correlation-Id', req.id);
  
  // Add request ID to locals for logging
  res.locals.requestId = req.id;
  
  // Log request start
  if (secureConfigService.get('NODE_ENV') !== 'test') {
    console.log(`[${req.id}] ${req.method} ${req.path} - Request started`);
  }
  
  // Track request timing
  req.startTime = Date.now();
  
  // Log request completion on response finish
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const statusCode = res.statusCode;
    const statusEmoji = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';
    
    if (secureConfigService.get('NODE_ENV') !== 'test') {
      console.log(`[${req.id}] ${statusEmoji} ${req.method} ${req.path} - ${statusCode} (${duration}ms)`);
    }
    
    // Log slow requests
    if (duration > 3000) {
      console.warn(`[${req.id}] ⏰ Slow request detected: ${duration}ms`);
    }
  });
  
  next();
};

/**
 * Express error handler that includes request ID
 */
const errorHandlerWithRequestId = (err, req, res, next) => {
  const requestId = req.id || 'NO_REQUEST_ID';
  
  // Log error with request ID
  console.error(`[${requestId}] Error:`, err);
  
  // Include request ID in error response
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      requestId: requestId,
      timestamp: toIsraelISOString(),
      path: req.path,
      method: req.method
    });
  }
};

/**
 * Helper to get request ID from various sources
 */
const getRequestId = (req) => {
  return req.id || req.correlationId || req.headers['x-request-id'] || req.headers['x-correlation-id'] || 'UNKNOWN';
};

/**
 * Middleware to inject request ID into all log messages
 */
const injectRequestIdIntoLogs = (req, res, next) => {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const requestId = req.id;
  
  // Override console methods to include request ID
  console.log = (...args) => {
    originalLog(`[${requestId}]`, ...args);
  };
  
  console.error = (...args) => {
    originalError(`[${requestId}]`, ...args);
  };
  
  console.warn = (...args) => {
    originalWarn(`[${requestId}]`, ...args);
  };
  
  // Restore original console methods after response
  res.on('finish', () => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  });
  
  next();
};

module.exports = {
  requestIdMiddleware,
  errorHandlerWithRequestId,
  getRequestId,
  injectRequestIdIntoLogs
};