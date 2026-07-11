const SecureDataAccess = require('../services/secureDataAccess');
// IntelliCare AI Agent API Routes
// Provides REST endpoints for voice-controlled medical assistant

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const cors = require('cors');
const secureConfigService = require('../services/secureConfigService');
const productionKMS = require('../services/productionKMS');
const agent = require('../services/agentServiceWrapper'); // Using wrapper for V1/V2 compatibility
const { analyzeDocumentWithAI } = require('../services/documentAnalysisService');
const encryptionService = require('../services/encryptionService');
// Models are accessed via req.models for multi-tenancy
// const Document = require('../models/Document'); // REMOVED - Use req.models.Document
// const Patient = require('../models/Patient'); // REMOVED - Use req.models.Patient
// const PendingUpload = require('../models/PendingUpload'); // REMOVED - Use req.models.PendingUpload
const { practiceContext, practiceModels, auditLogger } = require('../middleware/practiceContext');
const { practiceAuth } = require('../middleware/practiceAuth');
const { validateSession, requireAuth: sessionRequireAuth, validateCSRF } = require('../middleware/sessionValidation');
const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');
const { requestIdMiddleware, injectRequestIdIntoLogs } = require('../middleware/requestId');
const { fileCleanupService } = require('../services/fileCleanup');
const { cspMiddleware, cspNonceMiddleware } = require('../middleware/csp');
const e2eEncryptionService = require('../services/e2eEncryptionService');
const selfImprovingMemory = require('../services/selfImprovingMemory');
// Natural language query service removed
const sessionCache = require('../services/sessionCache');
const {
  threatDetectionMiddleware,
  ipBlacklistMiddleware,
  geographicRestrictionMiddleware,
  attackPatternMiddleware,
  anomalyDetectionMiddleware
} = require('../middleware/threatDetection');
const router = express.Router();

// ========================================
// ASYNC ERROR HANDLING SYSTEM
// ========================================

// Global unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 CRITICAL: Unhandled Promise Rejection:', reason);
  console.error('Promise:', promise);
  
  // Log to audit system if available
  if (global.auditLogger) {
    global.auditLogger.log({
      level: 'CRITICAL',
      event: 'UNHANDLED_PROMISE_REJECTION',
      reason: reason.toString(),
      stack: reason.stack,
      timestamp: new Date()
    });
  }
  
  // In production, gracefully shutdown
  if (secureConfigService.get('NODE_ENV') === 'production') {
    console.error('🚨 Server will shutdown due to unhandled rejection');
    process.exit(1);
  }
});

// Global uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('🚨 CRITICAL: Uncaught Exception:', error);
  
  // Log to audit system if available
  if (global.auditLogger) {
    global.auditLogger.log({
      level: 'CRITICAL',
      event: 'UNCAUGHT_EXCEPTION',
      error: error.toString(),
      stack: error.stack,
      timestamp: new Date()
    });
  }
  
  // Always shutdown on uncaught exception
  console.error('🚨 Server will shutdown due to uncaught exception');
  process.exit(1);
});

// Async route wrapper to catch all errors
const asyncHandler = (fn) => {
  return (req, res, next) => {
    // Wrap the async function and catch any errors
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error(`❌ Async error in ${req.method} ${req.path}:`, error);
      
      // Log error for monitoring
      if (req.auditLog) {
        req.auditLog('ASYNC_ROUTE_ERROR', {
          method: req.method,
          path: req.path,
          error: error.message,
          stack: error.stack,
          userId: req.user?._id,
          practiceId: req.practice?._id
        });
      }
      
      // Pass error to error handling middleware
      next(error);
    });
  };
};

// Async middleware wrapper
const asyncMiddleware = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error(`❌ Async middleware error:`, error);
      next(error);
    });
  };
};

// Database operation wrapper
const dbOperation = async (operation, context = {}) => {
  try {
    return await operation();
  } catch (error) {
    console.error('❌ Database operation failed:', error);
    
    // Log database error
    if (context.req && context.req.auditLog) {
      context.req.auditLog('DATABASE_OPERATION_ERROR', {
        operation: context.operationName || 'unknown',
        error: error.message,
        collection: context.collection,
        query: context.query
      });
    }
    
    // Throw with more context
    const dbError = new Error(`Database operation failed: ${error.message}`);
    dbError.name = 'DatabaseError';
    dbError.originalError = error;
    dbError.context = context;
    throw dbError;
  }
};

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  console.log(`🛑 Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new connections
  if (global.server) {
    global.server.close(() => {
      console.log('✅ HTTP server closed');
      
      // Close database connections
      if (global.mongoose && global.mongoose.connection) {
        global.mongoose.connection.close(() => {
          console.log('✅ Database connection closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('🚨 Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ========================================
// PERFORMANCE METRICS AND MONITORING SYSTEM
// ========================================

const EventEmitter = require('events');
const crypto = require('crypto');

class MetricsCollector extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byRoute: {},
        byMethod: {},
        byClinic: {}
      },
      performance: {
        responseTime: {
          total: 0,
          count: 0,
          average: 0,
          min: Infinity,
          max: 0,
          p95: 0,
          p99: 0
        },
        responseTimes: [], // Keep last 1000 for percentile calculation
        byRoute: {}
      },
      ai: {
        requests: 0,
        totalTokens: 0,
        averageTokens: 0,
        totalCost: 0,
        averageCost: 0,
        byOperation: {}
      },
      database: {
        queries: 0,
        totalTime: 0,
        averageTime: 0,
        errors: 0,
        connections: 0
      },
      system: {
        memory: {
          rss: 0,
          heapUsed: 0,
          heapTotal: 0,
          external: 0
        },
        cpu: 0,
        uptime: 0
      },
      errors: {
        total: 0,
        byType: {},
        byRoute: {},
        recent: [] // Keep last 100 errors
      }
    };
    
    this.startTime = Date.now();
    this.startSystemMonitoring();
  }
  
  // Record request metrics
  recordRequest(req, res, duration, success = true) {
    this.metrics.requests.total++;
    
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }
    
    // Track by route
    const route = req.route?.path || req.path;
    if (!this.metrics.requests.byRoute[route]) {
      this.metrics.requests.byRoute[route] = { total: 0, successful: 0, failed: 0 };
    }
    this.metrics.requests.byRoute[route].total++;
    if (success) {
      this.metrics.requests.byRoute[route].successful++;
    } else {
      this.metrics.requests.byRoute[route].failed++;
    }
    
    // Track by method
    const method = req.method;
    if (!this.metrics.requests.byMethod[method]) {
      this.metrics.requests.byMethod[method] = 0;
    }
    this.metrics.requests.byMethod[method]++;
    
    // Track by practice
    const practice = req.practiceSubdomain || 'unknown';
    if (!this.metrics.requests.byClinic[practice]) {
      this.metrics.requests.byClinic[practice] = 0;
    }
    this.metrics.requests.byClinic[practice]++;
    
    // Record performance
    this.recordPerformance(route, duration);
    
    this.emit('request', { req, res, duration, success });
  }
  
  // Record performance metrics
  recordPerformance(route, duration) {
    const perf = this.metrics.performance;
    
    // Overall performance
    perf.total += duration;
    perf.count++;
    perf.average = perf.total / perf.count;
    perf.min = Math.min(perf.min, duration);
    perf.max = Math.max(perf.max, duration);
    
    // Keep response times for percentile calculation
    perf.responseTimes.push(duration);
    if (perf.responseTimes.length > 1000) {
      perf.responseTimes.shift(); // Keep only last 1000
    }
    
    // Calculate percentiles
    if (perf.responseTimes.length > 10) {
      const sorted = [...perf.responseTimes].sort((a, b) => a - b);
      perf.p95 = sorted[Math.floor(sorted.length * 0.95)];
      perf.p99 = sorted[Math.floor(sorted.length * 0.99)];
    }
    
    // Track by route
    if (!perf.byRoute[route]) {
      perf.byRoute[route] = {
        total: 0,
        count: 0,
        average: 0,
        min: Infinity,
        max: 0
      };
    }
    
    const routePerf = perf.byRoute[route];
    routePerf.total += duration;
    routePerf.count++;
    routePerf.average = routePerf.total / routePerf.count;
    routePerf.min = Math.min(routePerf.min, duration);
    routePerf.max = Math.max(routePerf.max, duration);
  }
  
  // Record AI operation metrics
  recordAIOperation(operation, tokens = 0, cost = 0) {
    this.metrics.ai.requests++;
    this.metrics.ai.totalTokens += tokens;
    this.metrics.ai.averageTokens = this.metrics.ai.totalTokens / this.metrics.ai.requests;
    this.metrics.ai.totalCost += cost;
    this.metrics.ai.averageCost = this.metrics.ai.totalCost / this.metrics.ai.requests;
    
    if (!this.metrics.ai.byOperation[operation]) {
      this.metrics.ai.byOperation[operation] = {
        requests: 0,
        totalTokens: 0,
        averageTokens: 0,
        totalCost: 0,
        averageCost: 0
      };
    }
    
    const opMetrics = this.metrics.ai.byOperation[operation];
    opMetrics.requests++;
    opMetrics.totalTokens += tokens;
    opMetrics.averageTokens = opMetrics.totalTokens / opMetrics.requests;
    opMetrics.totalCost += cost;
    opMetrics.averageCost = opMetrics.totalCost / opMetrics.requests;
    
    this.emit('ai_operation', { operation, tokens, cost });
  }
  
  // Record database operation metrics
  recordDatabaseOperation(duration, success = true) {
    this.metrics.database.queries++;
    this.metrics.database.totalTime += duration;
    this.metrics.database.averageTime = this.metrics.database.totalTime / this.metrics.database.queries;
    
    if (!success) {
      this.metrics.database.errors++;
    }
    
    this.emit('database_operation', { duration, success });
  }
  
  // Record error metrics
  recordError(error, req = null) {
    this.metrics.errors.total++;
    
    const errorType = error.name || 'Unknown';
    if (!this.metrics.errors.byType[errorType]) {
      this.metrics.errors.byType[errorType] = 0;
    }
    this.metrics.errors.byType[errorType]++;
    
    if (req) {
      const route = req.route?.path || req.path;
      if (!this.metrics.errors.byRoute[route]) {
        this.metrics.errors.byRoute[route] = 0;
      }
      this.metrics.errors.byRoute[route]++;
    }
    
    // Keep recent errors
    this.metrics.errors.recent.push({
      timestamp: new Date(),
      type: errorType,
      message: error.message,
      route: req?.path,
      practice: req?.practiceSubdomain
    });
    
    if (this.metrics.errors.recent.length > 100) {
      this.metrics.errors.recent.shift();
    }
    
    this.emit('error', { error, req });
  }
  
  // Start system monitoring
  startSystemMonitoring() {
    setInterval(() => {
      const usage = process.memoryUsage();
      this.metrics.system.memory = {
        rss: Math.round(usage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024) // MB
      };
      
      this.metrics.system.uptime = Math.round((Date.now() - this.startTime) / 1000); // seconds
      
      this.emit('system_metrics', this.metrics.system);
    }, 30000); // Every 30 seconds
  }
  
  // Get current metrics
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date(),
      uptime: Math.round((Date.now() - this.startTime) / 1000)
    };
  }
  
  // Get health status
  getHealthStatus() {
    const metrics = this.getMetrics();
    const health = {
      status: 'healthy',
      checks: {},
      timestamp: new Date()
    };
    
    // Memory check
    if (metrics.system.memory.heapUsed > 1000) { // > 1GB
      health.checks.memory = { status: 'warning', value: metrics.system.memory.heapUsed };
      health.status = 'warning';
    } else {
      health.checks.memory = { status: 'healthy', value: metrics.system.memory.heapUsed };
    }
    
    // Error rate check
    const errorRate = metrics.requests.total > 0 ? 
      (metrics.requests.failed / metrics.requests.total) * 100 : 0;
    
    if (errorRate > 10) { // > 10% error rate
      health.checks.errorRate = { status: 'critical', value: errorRate };
      health.status = 'critical';
    } else if (errorRate > 5) { // > 5% error rate
      health.checks.errorRate = { status: 'warning', value: errorRate };
      if (health.status === 'healthy') health.status = 'warning';
    } else {
      health.checks.errorRate = { status: 'healthy', value: errorRate };
    }
    
    // Response time check
    if (metrics.performance.average > 5000) { // > 5 seconds
      health.checks.responseTime = { status: 'critical', value: metrics.performance.average };
      health.status = 'critical';
    } else if (metrics.performance.average > 2000) { // > 2 seconds
      health.checks.responseTime = { status: 'warning', value: metrics.performance.average };
      if (health.status === 'healthy') health.status = 'warning';
    } else {
      health.checks.responseTime = { status: 'healthy', value: metrics.performance.average };
    }
    
    return health;
  }
}

// Create global metrics collector
const metrics = new MetricsCollector();
global.metrics = metrics;

// Request monitoring middleware
const requestMonitoring = (req, res, next) => {
  const startTime = Date.now();
  
  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    // Record request metrics
    metrics.recordRequest(req, res, duration, success);
    
    // Log slow requests
    if (duration > 2000) { // > 2 seconds
      if (process.env.QUIET_LOGS !== 'true') console.log(`🐌 Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// AI operation monitoring wrapper
const monitorAIOperation = (operation, estimatedTokens = 100) => {
  return async (...args) => {
    const startTime = Date.now();
    
    try {
      const result = await operation(...args);
      const duration = Date.now() - startTime;
      
      // Estimate cost (rough calculation)
      const estimatedCost = estimatedTokens * 0.00002; // $0.00002 per token (example)
      
      metrics.recordAIOperation(operation.name, estimatedTokens, estimatedCost);
      
      console.log(`🤖 AI operation ${operation.name}: ${duration}ms, ~${estimatedTokens} tokens`);
      
      return result;
    } catch (error) {
      metrics.recordError(error);
      throw error;
    }
  };
};

// Database operation monitoring wrapper
const monitorDatabaseOperation = (operation) => {
  return async (...args) => {
    const startTime = Date.now();
    
    try {
      const result = await operation(...args);
      const duration = Date.now() - startTime;
      
      metrics.recordDatabaseOperation(duration, true);
      
      if (duration > 1000) { // > 1 second
        console.log(`🐌 Slow database operation: ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      metrics.recordDatabaseOperation(duration, false);
      metrics.recordError(error);
      throw error;
    }
  };
};

// Apply request monitoring to all routes
router.use(requestMonitoring);

// ========================================
// CORS CONFIGURATION
// ========================================
// CORS is handled globally in server.js - removed duplicate CORS configuration
// The global CORS in securityHeaders.js supports wildcard patterns for all
// subdomains of intellicare.health, localhost, and lvh.me

// ========================================
// INPUT VALIDATION SYSTEM
// ========================================

// Input validation schemas
const VALIDATION_SCHEMAS = {
  chat: {
    message: {
      required: true,
      type: 'string',
      maxLength: 5000,
      minLength: 1,
      sanitize: true
    },
    sessionId: {
      required: false,
      type: 'string',
      maxLength: 100,
      pattern: /^[a-zA-Z0-9_-]+$/,
      default: 'default'
    },
    language: {
      required: false,
      type: 'string',
      enum: ['he', 'en'],
      default: 'he'
    },
    pinnedContext: {
      required: false,
      type: 'array',
      maxItems: 10,  // Max 10 pinned items
      sanitize: false  // Don't sanitize - it's JSON data
    }
  },
  
  voiceCommand: {
    audioData: {
      required: false,
      type: 'string',
      maxLength: 10000000, // 10MB base64
      minLength: 100
    },
    sessionId: {
      required: false,
      type: 'string',
      maxLength: 100,
      pattern: /^[a-zA-Z0-9_-]+$/,
      default: 'default'
    },
    language: {
      required: false,
      type: 'string',
      enum: ['he', 'en'],
      default: 'he'
    }
  },
  
  uploadDocument: {
    files: {
      required: true,
      type: 'array',
      maxItems: 10,
      minItems: 1
    }
  },
  
  analyzeDocument: {
    documentText: {
      required: false,
      type: 'string',
      maxLength: 500000,
      sanitize: true
    },
    documentId: {
      required: false,
      type: 'string',
      pattern: /^[0-9a-fA-F]{24}$/
    },
    patientId: {
      required: false,
      type: 'string',
      pattern: /^[0-9a-fA-F]{24}$/
    },
    language: {
      required: false,
      type: 'string',
      enum: ['he', 'en'],
      default: 'he'
    }
  },
  
  processUpload: {
    uploadId: {
      required: true,
      type: 'string',
      maxLength: 100,
      pattern: /^[a-zA-Z0-9_-]+$/
    },
    patientName: {
      required: true,
      type: 'string',
      maxLength: 200,
      minLength: 2,
      sanitize: true,
      pattern: /^[a-zA-Zא-ת\s\-'\.]+$/
    }
  },
  
  textToSpeech: {
    text: {
      required: true,
      type: 'string',
      maxLength: 5000,
      minLength: 1,
      sanitize: true
    },
    language: {
      required: false,
      type: 'string',
      enum: ['he-IL', 'en-US'],
      default: 'he-IL'
    }
  },
  
  processText: {
    text: {
      required: true,
      type: 'string',
      maxLength: 5000,
      minLength: 1,
      sanitize: true
    },
    sessionId: {
      required: true,
      type: 'string',
      maxLength: 100,
      pattern: /^[a-zA-Z0-9_-]+$/
    },
    language: {
      required: false,
      type: 'string',
      enum: ['he', 'en'],
      default: 'he'
    }
  }
};

// Validation helper functions
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  
  // Remove potential XSS
  let sanitized = DOMPurify.sanitize(str, { ALLOWED_TAGS: [] });
  
  // Remove potential NoSQL injection patterns
  sanitized = sanitized.replace(/[\$\{\}]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
};

const validateMongoId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// ========================================
// COMPREHENSIVE SANITIZATION SYSTEM
// ========================================

// Filename sanitization functions
const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed_file';
  }
  
  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\./g, '');
  
  // Remove path separators
  sanitized = sanitized.replace(/[\/\\]/g, '_');
  
  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, '');
  
  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '_');
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext);
    sanitized = name.substring(0, 255 - ext.length) + ext;
  }
  
  // Ensure not empty
  if (!sanitized || sanitized.trim() === '') {
    sanitized = 'unnamed_file';
  }
  
  return sanitized;
};

const validateFileExtension = (filename, allowedExtensions = []) => {
  const ext = path.extname(filename).toLowerCase();
  
  const defaultAllowed = [
    '.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif',
    '.txt', '.doc', '.docx', '.rtf'
  ];
  
  const allowed = allowedExtensions.length > 0 ? allowedExtensions : defaultAllowed;
  
  return allowed.includes(ext);
};

const sanitizeAndValidateFilename = (filename, allowedExtensions = []) => {
  const sanitized = sanitizeFilename(filename);
  const isValidExtension = validateFileExtension(sanitized, allowedExtensions);
  
  return {
    sanitized: sanitized,
    isValid: isValidExtension,
    originalExtension: path.extname(filename).toLowerCase(),
    sanitizedExtension: path.extname(sanitized).toLowerCase()
  };
};

// Text input sanitization functions
const sanitizeTextInput = (input, options = {}) => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  let sanitized = input;
  
  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Remove potential script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove potential SQL injection patterns
  sanitized = sanitized.replace(/['";\\]/g, '');
  
  // Remove potential NoSQL injection patterns
  sanitized = sanitized.replace(/[\$\{\}]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length if specified
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }
  
  // Validate against pattern if specified
  if (options.pattern && !options.pattern.test(sanitized)) {
    throw new Error(`Input does not match required pattern: ${options.pattern}`);
  }
  
  return sanitized;
};

const sanitizePatientName = (name) => {
  return sanitizeTextInput(name, {
    maxLength: 200,
    pattern: /^[a-zA-Zא-ת\s\-'\.]+$/
  });
};

const sanitizeUploadId = (uploadId) => {
  return sanitizeTextInput(uploadId, {
    maxLength: 100,
    pattern: /^[a-zA-Z0-9_-]+$/
  });
};

const sanitizeSessionId = (sessionId) => {
  return sanitizeTextInput(sessionId, {
    maxLength: 100,
    pattern: /^[a-zA-Z0-9_-]+$/
  });
};

const validateInput = (data, schema) => {
  const errors = [];
  const sanitized = {};
  
  // Check required fields
  Object.keys(schema).forEach(field => {
    const rules = schema[field];
    const value = data[field];
    
    // Check required
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: field,
        message: `${field} is required`,
        code: 'REQUIRED_FIELD_MISSING'
      });
      return;
    }
    
    // Use default if not provided
    if (value === undefined && rules.default !== undefined) {
      sanitized[field] = rules.default;
      return;
    }
    
    // Skip validation if not provided and not required
    if (value === undefined || value === null) {
      return;
    }
    
    // Type validation
    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push({
        field: field,
        message: `${field} must be a string`,
        code: 'INVALID_TYPE'
      });
      return;
    }
    
    if (rules.type === 'array' && !Array.isArray(value)) {
      errors.push({
        field: field,
        message: `${field} must be an array`,
        code: 'INVALID_TYPE'
      });
      return;
    }
    
    // String validations
    if (rules.type === 'string') {
      // Length validation
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({
          field: field,
          message: `${field} must be at most ${rules.maxLength} characters`,
          code: 'TOO_LONG'
        });
        return;
      }
      
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({
          field: field,
          message: `${field} must be at least ${rules.minLength} characters`,
          code: 'TOO_SHORT'
        });
        return;
      }
      
      // Pattern validation
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push({
          field: field,
          message: `${field} has invalid format`,
          code: 'INVALID_FORMAT'
        });
        return;
      }
      
      // Enum validation
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({
          field: field,
          message: `${field} must be one of: ${rules.enum.join(', ')}`,
          code: 'INVALID_VALUE'
        });
        return;
      }
      
      // Sanitize if required
      sanitized[field] = rules.sanitize ? sanitizeString(value) : value;
    }
    
    // Array validations
    if (rules.type === 'array') {
      if (rules.maxItems && value.length > rules.maxItems) {
        errors.push({
          field: field,
          message: `${field} must have at most ${rules.maxItems} items`,
          code: 'TOO_MANY_ITEMS'
        });
        return;
      }

      if (rules.minItems && value.length < rules.minItems) {
        errors.push({
          field: field,
          message: `${field} must have at least ${rules.minItems} items`,
          code: 'TOO_FEW_ITEMS'
        });
        return;
      }

      // Validate array items
      if (rules.itemType === 'mongoId') {
        const invalidIds = value.filter(id => !validateMongoId(id));
        if (invalidIds.length > 0) {
          errors.push({
            field: field,
            message: `${field} contains invalid IDs`,
            code: 'INVALID_ID_FORMAT',
            invalidIds: invalidIds
          });
          return;
        }
      }

      sanitized[field] = value;
    }
  });
  
  // Pass through any fields not in schema
  Object.keys(data).forEach(field => {
    if (!schema[field] && sanitized[field] === undefined) {
      sanitized[field] = data[field];
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    sanitized: sanitized
  };
};

// Route-specific validation middleware
const validateChatInput = (req, res, next) => {
  const validation = validateInput(req.body, VALIDATION_SCHEMAS.chat);

  if (!validation.isValid) {
    const errorMessages = validation.errors.map(err => err.message);
    return sendLocalizedError(res, req.country, 'INVALID_FORMAT', {
      field: errorMessages.join(', ')
    }, 400);
  }

  // Replace body with sanitized data
  req.body = { ...req.body, ...validation.sanitized };
  next();
};

const validateVoiceInput = (req, res, next) => {
  const validation = validateInput(req.body, VALIDATION_SCHEMAS.voiceCommand);
  
  if (!validation.isValid) {
    const errorMessages = validation.errors.map(err => err.message);
    return sendLocalizedError(res, req.country, 'INVALID_FORMAT', {
      field: errorMessages.join(', ')
    }, 400);
  }
  
  req.body = { ...req.body, ...validation.sanitized };
  next();
};

const validateUploadInput = (req, res, next) => {
  // For file uploads, validate req.files instead of req.body.files
  if (!req.files || req.files.length === 0) {
    return sendLocalizedError(res, req.country, 'NO_FILES_UPLOADED', {}, 400);
  }
  
  // Additional file validation
  const files = req.files;
  const fileErrors = [];
  
  files.forEach((file, index) => {
    // Validate file size (max 50MB)
    if (file.size && file.size > 50 * 1024 * 1024) {
      fileErrors.push(`File ${index + 1} is too large (max 50MB)`);
    }
    
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'text/plain',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (file.mimetype && !allowedTypes.includes(file.mimetype)) {
      fileErrors.push(`File ${index + 1} has unsupported type: ${file.mimetype}`);
    }
    
    // Validate filename (allow Hebrew characters, spaces, and common special chars)
    if (file.originalname && !/^[a-zA-Z0-9\s\-_\.()א-ת&',]+$/.test(file.originalname)) {
      fileErrors.push(`File ${index + 1} has invalid filename`);
    }
  });
  
  if (fileErrors.length > 0) {
    return sendLocalizedError(res, req.country, 'INVALID_FILE_TYPE', {
      details: fileErrors.join(', ')
    }, 400);
  }
  
  next();
};

const validateAnalysisInput = (req, res, next) => {
  const validation = validateInput(req.body, VALIDATION_SCHEMAS.analyzeDocument);
  
  if (!validation.isValid) {
    const errorMessages = validation.errors.map(err => err.message);
    return sendLocalizedError(res, req.country, 'INVALID_FORMAT', {
      field: errorMessages.join(', ')
    }, 400);
  }
  
  req.body = { ...req.body, ...validation.sanitized };
  next();
};

const validateProcessUploadInput = (req, res, next) => {
  const validation = validateInput(req.body, VALIDATION_SCHEMAS.processUpload);
  
  if (!validation.isValid) {
    const errorMessages = validation.errors.map(err => err.message);
    return sendLocalizedError(res, req.country, 'INVALID_FORMAT', {
      field: errorMessages.join(', ')
    }, 400);
  }
  
  req.body = { ...req.body, ...validation.sanitized };
  next();
};

const validateTextToSpeechInput = (req, res, next) => {
  const validation = validateInput(req.body, VALIDATION_SCHEMAS.textToSpeech);
  
  if (!validation.isValid) {
    const errorMessages = validation.errors.map(err => err.message);
    return sendLocalizedError(res, req.country, 'INVALID_FORMAT', {
      field: errorMessages.join(', ')
    }, 400);
  }
  
  req.body = { ...req.body, ...validation.sanitized };
  next();
};

const validateProcessTextInput = (req, res, next) => {
  const validation = validateInput(req.body, VALIDATION_SCHEMAS.processText);
  
  if (!validation.isValid) {
    const errorMessages = validation.errors.map(err => err.message);
    return sendLocalizedError(res, req.country, 'INVALID_FORMAT', {
      field: errorMessages.join(', ')
    }, 400);
  }
  
  req.body = { ...req.body, ...validation.sanitized };
  next();
};

// Comprehensive security headers middleware
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection (legacy but still useful)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Allow inline scripts for React
    "style-src 'self' 'unsafe-inline'",  // Allow inline styles
    "img-src 'self' data: https:",       // Allow images from self, data URLs, and HTTPS
    "font-src 'self' https:",            // Allow fonts from self and HTTPS
    "connect-src 'self' https:",         // Allow connections to self and HTTPS
    "media-src 'self'",                  // Allow media from self only
    "object-src 'none'",                 // Block objects (Flash, etc.)
    "base-uri 'self'",                   // Restrict base URI
    "form-action 'self'",                // Restrict form actions
    "frame-ancestors 'none'"             // Prevent framing (same as X-Frame-Options)
  ];
  
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  
  // Strict Transport Security (HTTPS only)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Permissions Policy (formerly Feature Policy)
  const permissionsPolicy = [
    'camera=self',
    'microphone=self',
    'geolocation=self',
    'payment=none',
    'usb=none',
    'magnetometer=none',
    'gyroscope=none',
    'accelerometer=none'
  ];
  
  res.setHeader('Permissions-Policy', permissionsPolicy.join(', '));
  
  // Cross-Origin Policies
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  
  next();
};

// Enhanced origin validation middleware
const validateOrigin = async (req, res, next) => {
  const origin = req.headers.origin || req.headers.referer;
  // Use global CORS patterns from securityHeaders.js
  
  // Skip validation for non-browser requests
  if (!origin) {
    return next();
  }
  
  // Extract origin from referer if needed
  let requestOrigin = origin;
  if (origin.includes('/')) {
    try {
      const url = new URL(origin);
      requestOrigin = `${url.protocol}//${url.host}`;
    } catch (error) {
      console.error('❌ Invalid origin/referer:', origin);
      return sendLocalizedError(res, req.country, 'INVALID_ORIGIN', {}, 400);
    }
  }
  
  // Check if origin is allowed using global CORS patterns
  const trimmedOrigin = requestOrigin.trim();
  
  const isAllowed = 
    // Allow any subdomain of localhost (with any port)
    /^http:\/\/[a-z0-9-]+\.localhost(:\d+)?$/.test(trimmedOrigin) ||
    // Allow any subdomain of intellicare.health (HTTP with any port)
    /^http:\/\/[a-z0-9-]+\.intellicare\.health(:\d+)?$/.test(trimmedOrigin) ||
    // Allow any subdomain of intellicare.health (HTTPS with any port)
    /^https:\/\/[a-z0-9-]+\.intellicare\.health(:\d+)?$/.test(trimmedOrigin) ||
    // Allow any subdomain of lvh.me (with any port)
    /^http:\/\/[a-z0-9-]+\.lvh\.me(:\d+)?$/.test(trimmedOrigin) ||
    // Check static allowed origins
    trimmedOrigin === 'http://localhost:3000' ||
    trimmedOrigin === 'http://localhost:3001' ||
    trimmedOrigin === 'http://localhost:5000' ||
    trimmedOrigin === 'http://127.0.0.1:3000' ||
    trimmedOrigin === 'http://127.0.0.1:3001' ||
    trimmedOrigin === 'http://127.0.0.1:5000' ||
    trimmedOrigin === 'http://intellicare.health:3000' ||
    trimmedOrigin === 'http://intellicare.health:5000' ||
    trimmedOrigin === 'http://developer.intellicare.health:3000';
  
  if (!isAllowed) {
    await auditLog(req, 'ORIGIN_VALIDATION_FAILED', {
      origin: trimmedOrigin,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    
    return sendLocalizedError(res, req.country, 'ORIGIN_NOT_ALLOWED', {
      origin: trimmedOrigin
    }, 403);
  }
  
  // Log successful validation for monitoring
  if (secureConfigService.get('NODE_ENV') === 'development') {
    if (process.env.QUIET_LOGS !== 'true') console.log(`✅ Origin validated: ${requestOrigin}`);
  }
  
  next();
};

// Check if rate limiting should be disabled for testing
const DISABLE_RATE_LIMITS = secureConfigService.get('DISABLE_RATE_LIMITS') === 'true';

if (DISABLE_RATE_LIMITS) {
  // Rate limiting disabled for testing
}

// Origin-based rate limiting
const originRateLimit = DISABLE_RATE_LIMITS ? 
  (req, res, next) => next() : // Bypass if disabled
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per 15 minutes per origin
    keyGenerator: (req) => {
      const origin = req.headers.origin;
      if (origin) return `origin_${origin}_${ipKeyGenerator(req)}`;
      // Use ipKeyGenerator for proper IPv6/IPv4 support
      return ipKeyGenerator(req);
    },
    message: (req) => createErrorResponse(
      req.country || 'United States',
    'TOO_MANY_REQUESTS_FROM_ORIGIN'
  ).response,
  standardHeaders: true,
  legacyHeaders: false
});

// CORS error handling middleware
const handleCorsError = async (err, req, res, next) => {
  if (err.message && err.message.includes('CORS policy violation')) {
    // Log CORS violation
    await auditLog(req, 'CORS_VIOLATION', {
      origin: req.headers.origin,
      referer: req.headers.referer,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      error: err.message
    });
    
    return sendLocalizedError(res, req.country, 'CORS_VIOLATION', {
      origin: req.headers.origin
    }, 403);
  }
  
  next(err);
};

// Security headers monitoring
const monitorSecurityHeaders = (req, res, next) => {
  const originalSetHeader = res.setHeader;
  const securityHeadersSet = new Set();
  
  res.setHeader = function(name, value) {
    const securityHeadersList = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'content-security-policy',
      'strict-transport-security',
      'referrer-policy'
    ];
    
    if (securityHeadersList.includes(name.toLowerCase())) {
      securityHeadersSet.add(name.toLowerCase());
    }
    
    return originalSetHeader.call(this, name, value);
  };
  
  const originalEnd = res.end;
  res.end = function(...args) {
    // Log missing security headers
    const expectedHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'content-security-policy'
    ];
    
    const missingHeaders = expectedHeaders.filter(header => 
      !securityHeadersSet.has(header)
    );
    
    if (missingHeaders.length > 0) {
      console.log(`⚠️ Missing security headers for ${req.path}:`, missingHeaders);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// Environment-specific security configuration
const getSecurityConfig = () => {
  const config = {
    production: {
      strictCSP: true,
      allowInsecureOrigins: false,
      logSecurityViolations: true,
      enforceHTTPS: true
    },
    development: {
      strictCSP: false,
      allowInsecureOrigins: true,
      logSecurityViolations: true,
      enforceHTTPS: false
    },
    test: {
      strictCSP: false,
      allowInsecureOrigins: true,
      logSecurityViolations: false,
      enforceHTTPS: false
    }
  };
  
  return config[secureConfigService.get('NODE_ENV')] || config.production;
};

// ========================================
// SANITIZATION MIDDLEWARE SYSTEM
// ========================================

// File upload sanitization middleware
const sanitizeFileUploads = (req, res, next) => {
  try {
    if (!req.body.files || !Array.isArray(req.body.files)) {
      return next();
    }
    
    const sanitizedFiles = [];
    const errors = [];
    
    req.body.files.forEach((file, index) => {
      try {
        // Sanitize filename
        const filenameResult = sanitizeAndValidateFilename(file.originalName);
        
        if (!filenameResult.isValid) {
          errors.push(`File ${index + 1}: Invalid file type (${filenameResult.originalExtension})`);
          return;
        }
        
        // Validate file size (max 50MB)
        if (file.size > 50 * 1024 * 1024) {
          errors.push(`File ${index + 1}: File too large (max 50MB)`);
          return;
        }
        
        // Validate MIME type
        const allowedMimeTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/tiff',
          'text/plain',
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (!allowedMimeTypes.includes(file.type)) {
          errors.push(`File ${index + 1}: Invalid MIME type (${file.type})`);
          return;
        }
        
        // Create sanitized file object
        const sanitizedFile = {
          ...file,
          originalName: filenameResult.sanitized,
          sanitizedName: filenameResult.sanitized,
          isNameSanitized: file.originalName !== filenameResult.sanitized
        };
        
        sanitizedFiles.push(sanitizedFile);
        
        // Log sanitization if filename was changed
        if (sanitizedFile.isNameSanitized) {
          auditLog(req, 'FILENAME_SANITIZED', {
            originalName: file.originalName,
            sanitizedName: filenameResult.sanitized,
            fileIndex: index
          });
        }
        
      } catch (error) {
        errors.push(`File ${index + 1}: Sanitization error - ${error.message}`);
      }
    });
    
    if (errors.length > 0) {
      return sendLocalizedError(res, req.country, 'INVALID_FILE_TYPE', {
        details: errors.join(', ')
      }, 400);
    }
    
    // Replace files with sanitized versions
    req.body.files = sanitizedFiles;
    
    // Log successful sanitization
    if (req.auditLogger) {
      auditLog(req, 'FILES_SANITIZED', {
        fileCount: sanitizedFiles.length,
        sanitizedCount: sanitizedFiles.filter(f => f.isNameSanitized).length
      });
    }
    
    next();
  } catch (error) {
    console.error('❌ File sanitization error:', error);
    return sendLocalizedError(res, req.country, 'SYSTEM_ERROR', {
      details: 'File sanitization failed'
    }, 500);
  }
};

// Request body sanitization middleware
const sanitizeRequestBody = (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }
    
    const sanitizedBody = { ...req.body };
    const sanitizationLog = [];
    
    // Sanitize common fields
    if (sanitizedBody.patientName) {
      const original = sanitizedBody.patientName;
      try {
        sanitizedBody.patientName = sanitizePatientName(original);
        
        if (original !== sanitizedBody.patientName) {
          sanitizationLog.push({
            field: 'patientName',
            original: original,
            sanitized: sanitizedBody.patientName
          });
        }
      } catch (error) {
        return sendLocalizedError(res, req.country, 'INVALID_FORMAT', {
          field: 'patientName'
        }, 400);
      }
    }
    
    if (sanitizedBody.uploadId) {
      const original = sanitizedBody.uploadId;
      try {
        sanitizedBody.uploadId = sanitizeUploadId(original);
        
        if (original !== sanitizedBody.uploadId) {
          sanitizationLog.push({
            field: 'uploadId',
            original: original,
            sanitized: sanitizedBody.uploadId
          });
        }
      } catch (error) {
        return sendLocalizedError(res, req.country, 'INVALID_FORMAT', {
          field: 'uploadId'
        }, 400);
      }
    }
    
    if (sanitizedBody.sessionId) {
      const original = sanitizedBody.sessionId;
      try {
        sanitizedBody.sessionId = sanitizeSessionId(original);
        
        if (original !== sanitizedBody.sessionId) {
          sanitizationLog.push({
            field: 'sessionId',
            original: original,
            sanitized: sanitizedBody.sessionId
          });
        }
      } catch (error) {
        return sendLocalizedError(res, req.country, 'INVALID_FORMAT', {
          field: 'sessionId'
        }, 400);
      }
    }
    
    if (sanitizedBody.message) {
      const original = sanitizedBody.message;
      sanitizedBody.message = sanitizeTextInput(original, { maxLength: 5000 });
      
      if (original !== sanitizedBody.message) {
        sanitizationLog.push({
          field: 'message',
          original: original.substring(0, 100) + '...',
          sanitized: sanitizedBody.message.substring(0, 100) + '...'
        });
      }
    }
    
    // Log sanitization if any occurred
    if (sanitizationLog.length > 0 && req.auditLogger) {
      auditLog(req, 'REQUEST_BODY_SANITIZED', {
        sanitizedFields: sanitizationLog.map(s => s.field),
        sanitizationCount: sanitizationLog.length
      });
    }
    
    // Replace request body with sanitized version
    req.body = sanitizedBody;
    req.sanitizationLog = sanitizationLog;
    
    next();
  } catch (error) {
    console.error('❌ Request body sanitization error:', error);
    return sendLocalizedError(res, req.country, 'SYSTEM_ERROR', {
      details: 'Request sanitization failed'
    }, 500);
  }
};

// Header sanitization middleware
const sanitizeHeaders = (req, res, next) => {
  try {
    // Sanitize session ID from headers
    if (req.headers['x-session-id']) {
      const original = req.headers['x-session-id'];
      const sanitized = sanitizeSessionId(original);
      
      if (original !== sanitized) {
        if (req.auditLogger) {
          auditLog(req, 'HEADER_SANITIZED', {
            header: 'x-session-id',
            original: original,
            sanitized: sanitized
          });
        }
        
        req.headers['x-session-id'] = sanitized;
      }
    }
    
    // Sanitize other custom headers if needed
    const customHeaders = ['x-upload-id', 'x-patient-id'];
    
    customHeaders.forEach(headerName => {
      if (req.headers[headerName]) {
        const original = req.headers[headerName];
        const sanitized = sanitizeTextInput(original, { maxLength: 100 });
        
        if (original !== sanitized) {
          if (req.auditLogger) {
            auditLog(req, 'HEADER_SANITIZED', {
              header: headerName,
              original: original,
              sanitized: sanitized
            });
          }
          
          req.headers[headerName] = sanitized;
        }
      }
    });
    
    next();
  } catch (error) {
    console.error('❌ Header sanitization error:', error);
    return sendLocalizedError(res, req.country, 'SYSTEM_ERROR', {
      details: 'Header sanitization failed'
    }, 500);
  }
};

// Sanitization monitoring function
const logSanitizationStats = (req, res, next) => {
  const originalEnd = res.end;
  
  res.end = function(...args) {
    // Log sanitization statistics
    if (req.sanitizationLog && req.sanitizationLog.length > 0) {
      console.log(`🧹 Sanitization applied to ${req.sanitizationLog.length} fields for ${req.path}`);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// ========================================
// ERROR LOCALIZATION SYSTEM
// ========================================

const ERROR_MESSAGES = {
  'Israel': {
    // Authentication & Authorization
    AUTH_REQUIRED: 'נדרשת הזדהות למערכת',
    CLINIC_CONTEXT_REQUIRED: 'נדרש הקשר מרפאה',
    ACCESS_DENIED: 'הגישה נדחתה',
    INVALID_CLINIC_CONTEXT: 'הקשר מרפאה לא תקין',
    
    // Rate Limiting
    TOO_MANY_REQUESTS: 'יותר מדי בקשות. אנא המתן לפני ניסיון נוסף',
    TOO_MANY_AI_REQUESTS: 'יותר מדי בקשות AI. אנא המתן דקה לפני ניסיון נוסף',
    TOO_MANY_UPLOADS: 'יותר מדי העלאות קבצים. אנא המתן לפני העלאה נוספת',
    
    // Patient Operations
    PATIENT_NOT_FOUND: 'המטופל לא נמצא במערכת',
    PATIENT_ACCESS_DENIED: 'הגישה למטופל נדחתה - שייך למרפאה אחרת',
    PATIENT_LOOKUP_FAILED: 'חיפוש המטופל נכשל',
    INVALID_PATIENT_DATA: 'נתוני המטופל לא תקינים',
    
    // Document Operations
    UPLOAD_NOT_FOUND: 'העלאת הקובץ לא נמצאה או פגה תוקפה',
    UPLOAD_EXPIRED: 'תוקף העלאת הקובץ פג',
    UPLOAD_ACCESS_DENIED: 'הגישה להעלאת הקובץ נדחתה',
    DUPLICATE_FILE: 'קובץ בשם "{filename}" כבר קיים עבור המטופל',
    UPLOAD_FAILED: 'העלאת הקובץ נכשלה',
    FILE_TOO_LARGE: 'הקובץ גדול מדי',
    INVALID_FILE_TYPE: 'סוג קובץ לא נתמך',
    NO_FILES_UPLOADED: 'לא הועלו קבצים',
    UPLOAD_ID_REQUIRED: 'נדרש מזהה העלאה ושם מטופל',
    
    // AI Operations
    AI_REQUEST_FAILED: 'בקשת AI נכשלה',
    VOICE_PROCESSING_FAILED: 'עיבוד הקול נכשל',
    DOCUMENT_ANALYSIS_FAILED: 'ניתוח המסמך נכשל',
    CHAT_PROCESSING_FAILED: 'עיבוד הצ\'אט נכשל',
    MESSAGE_REQUIRED: 'נדרשת הודעה',
    AUDIO_FILE_REQUIRED: 'נדרש קובץ אודיו',
    SESSION_ID_REQUIRED: 'נדרש מזהה הפעלה',
    TEXT_REQUIRED: 'נדרש טקסט',
    
    // Validation Errors
    REQUIRED_FIELD_MISSING: 'שדה נדרש חסר: {field}',
    INVALID_FORMAT: 'פורמט לא תקין: {field}',
    INVALID_DATE: 'תאריך לא תקין',
    INVALID_EMAIL: 'כתובת מייל לא תקינה',
    INVALID_PHONE: 'מספר טלפון לא תקין',
    INVALID_ID: 'תעודת זהות לא תקינה',
    
    // CORS & Origin Errors
    INVALID_ORIGIN: 'מקור לא תקין בבקשה',
    ORIGIN_NOT_ALLOWED: 'המקור {origin} אינו מורשה לגשת למערכת',
    CORS_VIOLATION: 'הפרת מדיניות CORS מהמקור {origin}',
    TOO_MANY_REQUESTS_FROM_ORIGIN: 'יותר מדי בקשות מהמקור הזה',
    
    // System Errors
    SYSTEM_ERROR: 'שגיאת מערכת',
    DATABASE_ERROR: 'שגיאת מסד נתונים',
    NETWORK_ERROR: 'שגיאת רשת',
    TIMEOUT_ERROR: 'תם הזמן הקצוב לפעולה',
    UNKNOWN_ERROR: 'שגיאה לא ידועה',
    INTERNAL_SERVER_ERROR: 'שגיאת שרת פנימית',
    SERVICE_UNAVAILABLE: 'השירות אינו זמין כרגע',
    VALIDATION_ERROR: 'שגיאת אימות נתונים'
  },
  
  'United States': {
    // Authentication & Authorization
    AUTH_REQUIRED: 'Authentication required',
    CLINIC_CONTEXT_REQUIRED: 'Practice context required',
    ACCESS_DENIED: 'Access denied',
    INVALID_CLINIC_CONTEXT: 'Invalid practice context',
    
    // Rate Limiting
    TOO_MANY_REQUESTS: 'Too many requests. Please wait before trying again',
    TOO_MANY_AI_REQUESTS: 'Too many AI requests. Please wait a minute before trying again',
    TOO_MANY_UPLOADS: 'Too many file uploads. Please wait before uploading more files',
    
    // Patient Operations
    PATIENT_NOT_FOUND: 'Patient not found in system',
    PATIENT_ACCESS_DENIED: 'Patient access denied - belongs to different practice',
    PATIENT_LOOKUP_FAILED: 'Patient lookup failed',
    INVALID_PATIENT_DATA: 'Invalid patient data',
    
    // Document Operations
    UPLOAD_NOT_FOUND: 'Upload not found or has expired',
    UPLOAD_EXPIRED: 'Upload has expired',
    UPLOAD_ACCESS_DENIED: 'Upload access denied',
    DUPLICATE_FILE: 'File named "{filename}" already exists for this patient',
    UPLOAD_FAILED: 'File upload failed',
    FILE_TOO_LARGE: 'File is too large',
    INVALID_FILE_TYPE: 'File type not supported',
    NO_FILES_UPLOADED: 'No files uploaded',
    UPLOAD_ID_REQUIRED: 'Upload ID and patient name are required',
    
    // AI Operations
    AI_REQUEST_FAILED: 'AI request failed',
    VOICE_PROCESSING_FAILED: 'Voice processing failed',
    DOCUMENT_ANALYSIS_FAILED: 'Document analysis failed',
    CHAT_PROCESSING_FAILED: 'Chat processing failed',
    MESSAGE_REQUIRED: 'Message is required',
    AUDIO_FILE_REQUIRED: 'Audio file is required',
    SESSION_ID_REQUIRED: 'Session ID is required',
    TEXT_REQUIRED: 'Text is required',
    
    // Validation Errors
    REQUIRED_FIELD_MISSING: 'Required field missing: {field}',
    INVALID_FORMAT: 'Invalid format: {field}',
    INVALID_DATE: 'Invalid date',
    INVALID_EMAIL: 'Invalid email address',
    INVALID_PHONE: 'Invalid phone number',
    INVALID_ID: 'Invalid Social Security Number',
    
    // CORS & Origin Errors
    INVALID_ORIGIN: 'Invalid request origin',
    ORIGIN_NOT_ALLOWED: 'Origin {origin} is not allowed to access the system',
    CORS_VIOLATION: 'CORS policy violation from origin {origin}',
    TOO_MANY_REQUESTS_FROM_ORIGIN: 'Too many requests from this origin',
    
    // System Errors
    SYSTEM_ERROR: 'System error',
    DATABASE_ERROR: 'Database error',
    NETWORK_ERROR: 'Network error',
    TIMEOUT_ERROR: 'Operation timed out',
    UNKNOWN_ERROR: 'Unknown error',
    INTERNAL_SERVER_ERROR: 'Internal server error',
    SERVICE_UNAVAILABLE: 'Service is currently unavailable',
    VALIDATION_ERROR: 'Data validation error'
  }
};

const SUCCESS_MESSAGES = {
  'Israel': {
    UPLOAD_COMPLETED: 'העלאת הקבצים הושלמה בהצלחה',
    PATIENT_FOUND: 'המטופל נמצא',
    ANALYSIS_COMPLETED: 'הניתוח הושלם בהצלחה',
    SESSION_CLEARED: 'ההפעלה נוקתה בהצלחה'
  },
  'United States': {
    UPLOAD_COMPLETED: 'File upload completed successfully',
    PATIENT_FOUND: 'Patient found',
    ANALYSIS_COMPLETED: 'Analysis completed successfully',
    SESSION_CLEARED: 'Session cleared successfully'
  }
};

// Error localization helper functions
const getLocalizedError = (country, errorKey, params = {}) => {
  try {
    const countryMessages = ERROR_MESSAGES[country] || ERROR_MESSAGES['United States'];
    let message = countryMessages[errorKey] || countryMessages['UNKNOWN_ERROR'];
    
    // Replace parameters in message
    Object.keys(params).forEach(param => {
      const placeholder = `{${param}}`;
      message = message.replace(new RegExp(placeholder, 'g'), params[param]);
    });
    
    return message;
  } catch (error) {
    console.error('❌ Error localization failed:', error);
    return errorKey; // Fallback to error key
  }
};

const getLocalizedSuccess = (country, messageKey, params = {}) => {
  try {
    const countryMessages = SUCCESS_MESSAGES[country] || SUCCESS_MESSAGES['United States'];
    let message = countryMessages[messageKey] || messageKey;
    
    Object.keys(params).forEach(param => {
      const placeholder = `{${param}}`;
      message = message.replace(new RegExp(placeholder, 'g'), params[param]);
    });
    
    return message;
  } catch (error) {
    console.error('❌ Success localization failed:', error);
    return messageKey;
  }
};

const createErrorResponse = (country, errorKey, params = {}, statusCode = 400) => {
  return {
    statusCode: statusCode,
    response: {
      success: false,
      error: getLocalizedError(country, errorKey, params),
      errorCode: errorKey,
      timestamp: new Date().toISOString()
    }
  };
};

const sendLocalizedError = (res, country, errorKey, params = {}, statusCode = 400, requestId = null) => {
  const errorResponse = createErrorResponse(country, errorKey, params, statusCode);
  // Add request ID to error response if available
  if (requestId || res.locals?.requestId) {
    errorResponse.response.requestId = requestId || res.locals.requestId;
  }
  res.status(errorResponse.statusCode).json(errorResponse.response);
};

// Global error handler for routes
const handleRouteError = async (req, res, error, operation) => {
  console.error(`❌ ${operation} error:`, error);
  
  // Log error for monitoring
  await auditLog(req, 'SYSTEM_ERROR', {
    operation: operation,
    error: error.message,
    stack: error.stack
  });
  
  // Determine error type and send appropriate response
  let errorKey = 'SYSTEM_ERROR';
  let statusCode = 500;
  
  if (error.name === 'ValidationError') {
    errorKey = 'INVALID_PATIENT_DATA';
    statusCode = 400;
  } else if (error.name === 'MongoError' || error.name === 'MongooseError') {
    errorKey = 'DATABASE_ERROR';
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    errorKey = 'NETWORK_ERROR';
  }
  
  return sendLocalizedError(res, req.country || 'United States', errorKey, {
    details: error.message
  }, statusCode);
};

// ========================================
// AUDIT LOGGING HELPER FUNCTIONS
// ========================================

const auditLog = async (req, action, details = {}) => {
  try {
    if (req.auditLogger) {
      await req.auditLogger.log({
        timestamp: new Date(),
        requestId: req.id || 'NO_REQUEST_ID',
        action: action,
        userId: req.user?._id,
        userEmail: req.user?.email,
        practiceId: req.practice?._id,
        practiceSubdomain: req.practiceSubdomain,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        sessionId: req.sessionID,
        details: details
      });
    } else {
      // Fallback logging if auditLogger not available
      console.log(`📋 AUDIT: ${action}`, {
        user: req.user?.email,
        practice: req.practiceSubdomain,
        details
      });
    }
  } catch (error) {
    console.error('❌ Audit logging error:', error);
    // Don't fail the request if audit logging fails
  }
};

const auditPatientAccess = async (req, patient, action) => {
  await auditLog(req, `PATIENT_${action}`, {
    patientId: patient._id,
    patientName: patient.firstName ? `${patient.firstName} ${patient.lastName}` : patient.fullName,
    patientIdentifier: patient.nationalId || patient.socialSecurityNumber
  });
};

const auditDocumentOperation = async (req, operation, details) => {
  await auditLog(req, `DOCUMENT_${operation}`, details);
};

const auditAIUsage = async (req, operation, details) => {
  await auditLog(req, `AI_${operation}`, details);
};

// Security event logging functions
const logAuthFailure = async (req, reason) => {
  await auditLog(req, 'AUTH_FAILURE', {
    reason: reason,
    attemptedPath: req.path,
    method: req.method
  });
};

const logRateLimitViolation = async (req, limitType) => {
  await auditLog(req, 'RATE_LIMIT_VIOLATION', {
    limitType: limitType,
    path: req.path,
    method: req.method
  });
};

const logSuspiciousActivity = async (req, activity, details) => {
  await auditLog(req, 'SUSPICIOUS_ACTIVITY', {
    activity: activity,
    details: details,
    path: req.path
  });
};

// ========================================
// SECURITY MIDDLEWARE CONFIGURATIONS
// ========================================

// AI Rate Limiting (strict) - 10 requests per minute
const aiRateLimit = DISABLE_RATE_LIMITS ?
  (req, res, next) => next() : // Bypass if disabled
  rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // 10 AI requests per minute per practice - reasonable for production
  keyGenerator: (req) => {
    // Use ipKeyGenerator for proper IPv6/IPv4 support
    return `ai_${req.practiceSubdomain}_${req.user?._id || ipKeyGenerator(req)}`;
  },
  message: (req) => createErrorResponse(
    req.country || 'United States', 
    'TOO_MANY_AI_REQUESTS'
  ).response,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for system health checks
    return req.path === '/health';
  },
  handler: async (req, res, next, options) => {
    await logRateLimitViolation(req, 'AI_RATE_LIMIT');
    res.status(429).json(options.message(req));
  }
});

// General API Rate Limiting (more lenient) - 100 requests per minute
const generalRateLimit = DISABLE_RATE_LIMITS ?
  (req, res, next) => next() : // Bypass if disabled
  rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per minute per practice - production ready
  keyGenerator: (req) => {
    // Use ipKeyGenerator for proper IPv6/IPv4 support
    return `general_${req.practiceSubdomain}_${req.user?._id || ipKeyGenerator(req)}`;
  },
  message: (req) => createErrorResponse(
    req.country || 'United States', 
    'TOO_MANY_REQUESTS'
  ).response,
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res, next, options) => {
    await logRateLimitViolation(req, 'GENERAL_RATE_LIMIT');
    res.status(429).json(options.message(req));
  }
});

// Document Upload Rate Limiting (very strict) - 5 uploads per minute
const uploadRateLimit = DISABLE_RATE_LIMITS ?
  (req, res, next) => next() : // Bypass if disabled
  rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // 5 uploads per minute per practice
  keyGenerator: (req) => {
    // Use ipKeyGenerator for proper IPv6/IPv4 support
    return `upload_${req.practiceSubdomain}_${req.user?._id || ipKeyGenerator(req)}`;
  },
  message: (req) => createErrorResponse(
    req.country || 'United States', 
    'TOO_MANY_UPLOADS'
  ).response,
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res, next, options) => {
    await logRateLimitViolation(req, 'UPLOAD_RATE_LIMIT');
    res.status(429).json(options.message(req));
  }
});

// Country Detection Middleware
const detectCountry = async (req, res, next) => {
  try {
    // Priority order for country detection:
    // 1. Explicit header
    // 2. User profile
    // 3. Practice settings from database
    
    let country = req.headers['x-country'] || 
                  req.user?.country || 
                  req.practice?.contact?.address?.country ||
                  req.practice?.settings?.country;
    
    // If no country found and we have a practice, load it from database
    if (!country && req.practiceSubdomain) {
      try {
        const SecureDataAccess = require('../services/secureDataAccess');
        const context = {
          serviceId: 'agent-service',
          operation: 'getClinicCountry',
          practiceId: 'global'
        };
        
        const practices = await SecureDataAccess.query('practices', 
          { subdomain: req.practiceSubdomain }, 
          { limit: 1 }, 
          context
        );
        
        if (practices && practices.length > 0) {
          country = practices[0].contact?.address?.country;
          // Update req.practice with full data if not already populated
          if (!req.practice || !req.practice.contact?.address?.country) {
            req.practice = practices[0];
          }
        }
      } catch (dbError) {
        console.error('❌ Failed to load practice country from database:', dbError);
      }
    }
    
    // Map country values to supported format
    if (country === 'USA' || country === 'US' || country === 'United States') {
      country = 'United States';
    } else if (country === 'IL' || country === 'Israel') {
      country = 'Israel';
    }
    
    // Validate country - if not supported, don't default, just log warning
    const supportedCountries = ['Israel', 'United States'];
    if (country && !supportedCountries.includes(country)) {
      console.warn(`⚠️ Unsupported country detected: ${country} for practice: ${req.practiceSubdomain}`);
      // Don't override with a default - let the system handle it appropriately
    }
    
    req.country = country; // No default - must be explicitly set
    
    console.log(`🌍 Country detected: ${req.country} for practice: ${req.practiceSubdomain}`);
    next();
  } catch (error) {
    console.error('❌ Country detection error:', error);
    // Don't default to a specific country on error - let system handle missing country
    req.country = undefined;
    next();
  }
};

// Enhanced Authentication Middleware
const requireAuth = async (req, res, next) => {
  console.log(`[${req.requestId}] 🔍 requireAuth check - User: ${req.user?.email}, Practice: ${req.practiceSubdomain}`);
  
  if (!req.user) {
    console.log(`[${req.requestId}] ❌ requireAuth failed: NO_USER`);
    await logAuthFailure(req, 'NO_USER');
    return sendLocalizedError(res, req.country || 'United States', 'AUTH_REQUIRED', {}, 401);
  }
  
  if (!req.practice) {
    console.log(`[${req.requestId}] ❌ requireAuth failed: NO_CLINIC`);
    await logAuthFailure(req, 'NO_CLINIC');
    return sendLocalizedError(res, req.country || 'United States', 'CLINIC_CONTEXT_REQUIRED', {}, 400);
  }
  
  if (!req.practiceSubdomain) {
    console.log(`[${req.requestId}] ❌ requireAuth failed: NO_CLINIC_SUBDOMAIN`);
    await logAuthFailure(req, 'NO_CLINIC_SUBDOMAIN');
    return sendLocalizedError(res, req.country || 'United States', 'INVALID_CLINIC_CONTEXT', {}, 400);
  }
  
  console.log(`[${req.requestId}] ✅ requireAuth passed`);
  next();
};

// Request Validation Middleware
const validateRequest = (req, res, next) => {
  // Validate practice models are available
  if (!req.models || !req.models.Patient) {
    return sendLocalizedError(res, req.country || 'United States', 'SYSTEM_ERROR', {
      details: 'Practice models not initialized'
    }, 500);
  }
  
  // Add practice context to all requests
  const practiceTimezone = req.practice?.settings?.timezone || 'UTC';
  console.log(`⏰ [Agent] Practice timezone: ${practiceTimezone} (from req.practice.settings.timezone: ${req.practice?.settings?.timezone})`);

  req.practiceContext = {
    practice: req.practice,
    practiceId: req.practiceId,  // Add practiceId for API calls
    practiceDb: req.practiceDb,  // Add database connection for HIPAA services
    user: req.user,
    authToken: req.headers['x-auth-token'],
    token: req.headers['x-auth-token'],  // Add token field for agent service
    practiceSubdomain: req.practiceSubdomain,
    country: req.country,
    timezone: practiceTimezone,  // Add practice timezone for agent awareness
    models: req.models,
    auditLogger: req.auditLogger,
    req: req  // Add request object for fallback token access
  };
  
  next();
};

// ========================================
// MEMORY MONITORING FUNCTIONS
// ========================================

// Memory monitoring functions
const getMemoryUsage = () => {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
    arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024) // MB
  };
};

const logMemoryUsage = (operation, req) => {
  const usage = getMemoryUsage();
  console.log(`💾 Memory usage for ${operation}:`, usage);
  
  // Log to audit if memory usage is high
  if (usage.heapUsed > 500 && req.auditLogger) { // > 500MB
    auditLog(req, 'HIGH_MEMORY_USAGE', {
      operation: operation,
      memoryUsage: usage,
      warning: 'High memory usage detected'
    });
  }
  
  return usage;
};

const checkMemoryLimit = (req, res, next) => {
  const usage = getMemoryUsage();
  const memoryLimitMB = 1000; // 1GB limit
  
  if (usage.heapUsed > memoryLimitMB) {
    if (req.auditLogger) {
      auditLog(req, 'MEMORY_LIMIT_EXCEEDED', {
        currentUsage: usage,
        limit: memoryLimitMB
      });
    }
    
    return sendLocalizedError(res, req.country, 'SYSTEM_ERROR', {
      details: 'Server memory limit exceeded. Please try again later.'
    }, 503);
  }
  
  next();
};

// Memory monitoring middleware
const memoryMonitoringMiddleware = (req, res, next) => {
  const startUsage = getMemoryUsage();
  const startTime = Date.now();
  
  const originalEnd = res.end;
  res.end = function(...args) {
    const endUsage = getMemoryUsage();
    const duration = Date.now() - startTime;
    
    const memoryDelta = {
      rss: endUsage.rss - startUsage.rss,
      heapUsed: endUsage.heapUsed - startUsage.heapUsed,
      heapTotal: endUsage.heapTotal - startUsage.heapTotal
    };
    
    // Log if significant memory increase
    if (memoryDelta.heapUsed > 50) { // > 50MB increase
      console.log(`⚠️ High memory delta for ${req.method} ${req.path}:`, {
        delta: memoryDelta,
        duration: duration,
        finalUsage: endUsage
      });
      
      if (req.auditLogger) {
        auditLog(req, 'HIGH_MEMORY_DELTA', {
          path: req.path,
          method: req.method,
          memoryDelta: memoryDelta,
          duration: duration
        });
      }
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// Garbage collection optimization
const forceGarbageCollection = () => {
  if (global.gc) {
    global.gc();
    console.log('🗑️ Forced garbage collection');
  } else {
    console.log('⚠️ Garbage collection not available (run with --expose-gc)');
  }
};

const scheduleGarbageCollection = () => {
  setInterval(() => {
    const usage = getMemoryUsage();
    if (usage.heapUsed > 500) { // > 500MB
      forceGarbageCollection();
    }
  }, 10 * 60 * 1000); // 10 minutes
};

// Start GC scheduling
scheduleGarbageCollection();

// ========================================
// APPLY BASE MIDDLEWARE TO ALL ROUTES
// ========================================

// Apply request correlation first
router.use(requestIdMiddleware);
// Note: injectRequestIdIntoLogs causes excessive request ID chains - REMOVED

// CORS is handled globally in server.js - no need for router-specific CORS

// Apply threat detection early in pipeline
router.use(ipBlacklistMiddleware); // Block blacklisted IPs immediately
router.use(attackPatternMiddleware); // Detect attack patterns
router.use(geographicRestrictionMiddleware(['IL', 'US'])); // Allow Israel and US

// Apply CSP headers and nonce generation
router.use(cspNonceMiddleware);
router.use(cspMiddleware({
  environment: secureConfigService.get('NODE_ENV') || 'production',
  reportOnly: secureConfigService.get('CSP_REPORT_ONLY') === 'true' // Start in report-only mode for testing
}));

// Apply monitoring in development (must be before security headers)
if (secureConfigService.get('NODE_ENV') === 'development') {
  router.use(monitorSecurityHeaders);
}

// Apply security headers to all routes
router.use(securityHeaders);

// Apply origin validation to sensitive routes
router.use(validateOrigin);

// Apply origin-based rate limiting
router.use(originRateLimit);

// Apply practice context and models middleware to all routes
router.use(practiceContext);
router.use(practiceModels);

// ========================================
// PUBLIC ROUTES (NO AUTHENTICATION REQUIRED)
// ========================================
// These routes must be defined BEFORE practiceAuth middleware
// to remain publicly accessible and allow proper request ID handling

// @route   GET /api/agent/health
// @desc    Health check for agent service
// @access  Public
router.get('/health', generalRateLimit, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'IntelliCare AI Agent service is running',
      timestamp: new Date().toISOString(),
      services: {
        claude: !!secureConfigService.get('CLAUDE_API_KEY'),
        googleCloud: !!secureConfigService.get('GOOGLE_CLOUD_PROJECT_ID'),
        speechToText: 'Google Cloud Speech-to-Text v2',
        textToSpeech: 'Google Cloud Text-to-Speech v1',
        aiModel: 'Claude Opus 4 (2024)'
      }
    });
  } catch (error) {
    return sendLocalizedError(res, req.country || 'United States', 'SYSTEM_ERROR', {
      details: error.message
    }, 500);
  }
});

// @route   GET /api/agent/tools
// @desc    Get available tools for the agent
// @access  Public
router.get('/tools', async (req, res) => {
  try {
    // Get all function definitions from the agent
    const tools = [
      { name: 'addPatient', description: 'Add a new patient to the system' },
      { name: 'getPatient', description: 'Search for and retrieve patient information' },
      { name: 'listPatients', description: 'List all patients in the practice' },
      { name: 'getHistory', description: 'Get medical history for a patient' },
      { name: 'updateHistory', description: 'Update patient medical history' },
      { name: 'getDiagnosis', description: 'Generate medical diagnosis' },
      { name: 'analyzeDocument', description: 'Analyze medical documents' },
      { name: 'uploadDocument', description: 'Upload documents to patient record' },
      { name: 'getDocuments', description: 'Retrieve patient documents' }
    ];
    
    res.json({
      success: true,
      data: {
        tools: tools,
        count: tools.length
      }
    });
  } catch (error) {
    return sendLocalizedError(res, req.country || 'United States', 'SYSTEM_ERROR', {
      details: error.message
    }, 500);
  }
});

// ========================================
// AUTHENTICATION MIDDLEWARE
// ========================================
// All routes defined AFTER this point require authentication

router.use(practiceAuth); // Add authentication to all subsequent agent routes
router.use(threatDetectionMiddleware); // Full threat analysis after auth
router.use(anomalyDetectionMiddleware); // Behavioral anomaly detection
router.use(logSanitizationStats); // Add sanitization monitoring
router.use(memoryMonitoringMiddleware); // Add memory monitoring

// CORS error handling removed - CORS is handled globally in server.js

// ========================================
// MEMORY MANAGEMENT SYSTEM
// ========================================

const stream = require('stream');
// SecureDataAccess already imported at the top
// crypto already imported at the top
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);

// Create temporary directory for uploads
const tempDir = path.join(__dirname, '../temp/uploads');
try {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
} catch (error) {
  console.error('Failed to create temp directory:', error);
}

// Temporary file cleanup functions
const cleanupTempFile = async (filePath) => {
  try {
    // Use fileCleanupService for consistent cleanup
    const result = await fileCleanupService.cleanFile(filePath);
    if (result) {
      console.log(`🗑️ Cleaned up temp file: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Failed to cleanup temp file ${filePath}:`, error);
  }
};

const cleanupTempFiles = async (filePaths) => {
  const cleanupPromises = filePaths.map(filePath => cleanupTempFile(filePath));
  await Promise.allSettled(cleanupPromises);
};

const scheduleFileCleanup = (filePaths, delayMs = 60000) => {
  // Schedule cleanup after delay (default 1 minute)
  setTimeout(async () => {
    if (Array.isArray(filePaths)) {
      await cleanupTempFiles(filePaths);
    } else {
      await cleanupTempFile(filePaths);
    }
  }, delayMs);
};

const cleanupExpiredTempFiles = async () => {
  try {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    
    const cleanupDirectory = async (dirPath) => {
      if (!fs.existsSync(dirPath)) return;
      
      const files = await fsPromises.readdir(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fsPromises.stat(filePath);
        
        if (stats.isFile() && (now - stats.mtime.getTime()) > maxAge) {
          await cleanupTempFile(filePath);
        }
      }
    };
    
    // Cleanup main temp directory and subdirectories
    await cleanupDirectory(tempDir);
    
    const subdirs = await fsPromises.readdir(tempDir);
    for (const subdir of subdirs) {
      const subdirPath = path.join(tempDir, subdir);
      const stats = await fsPromises.stat(subdirPath);
      if (stats.isDirectory()) {
        await cleanupDirectory(subdirPath);
      }
    }
    
    console.log('🧹 Completed expired temp file cleanup');
  } catch (error) {
    console.error('❌ Temp file cleanup error:', error);
  }
};

// Schedule periodic cleanup every hour
setInterval(cleanupExpiredTempFiles, 60 * 60 * 1000);

// Streaming file processing functions
const processFileStream = async (filePath, outputPath) => {
  try {
    const readStream = fs.createReadStream(filePath);
    const writeStream = fs.createWriteStream(outputPath);
    
    await pipeline(readStream, writeStream);
    return true;
  } catch (error) {
    console.error('❌ File streaming error:', error);
    throw error;
  }
};

const encryptFileStream = async (inputPath, outputPath, encryptionKey) => {
  try {
    const readStream = fs.createReadStream(inputPath);
    const writeStream = fs.createWriteStream(outputPath);
    const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
    
    await pipeline(readStream, cipher, writeStream);
    return true;
  } catch (error) {
    console.error('❌ File encryption streaming error:', error);
    throw error;
  }
};

// Configure multer for audio file uploads
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Middleware to fix UTF-8 filename encoding for agent uploads
const fixAgentFilenameEncoding = (req, res, next) => {
  if (req.files && req.files.length > 0) {
    req.files.forEach(file => {
      if (file.originalname) {
        try {
          // Fix UTF-8 encoding issue with Hebrew filenames
          const originalEncoding = file.originalname;

          // First, check if the filename is already properly encoded
          const isAlreadyProperlyEncoded = /[\u0590-\u05FF]/.test(file.originalname) &&
                                          !file.originalname.includes('×') &&
                                          !file.originalname.includes('׳') &&
                                          !file.originalname.includes('�');

          if (isAlreadyProperlyEncoded) {
            console.log(`✅ [AGENT] Filename already properly encoded: ${file.originalname}`);
            return; // Skip processing for already correct filenames
          }

          // Only try to fix if there are corruption indicators
          const hasCorruption = file.originalname.includes('×') ||
                               file.originalname.includes('׳') ||
                               file.originalname.includes('�') ||
                               /[\u00C0-\u00FF]/.test(file.originalname); // Latin-1 supplement range

          if (!hasCorruption) {
            return; // Skip processing for clean ASCII filenames
          }

          // Try multiple encoding approaches for corrupted filenames
          const decodingMethods = [
            // Method 1: Pattern-based corruption replacement (try first)
            () => {
              if (file.originalname.includes('×') || file.originalname.includes('׳')) {
                return file.originalname
                  .replace(/×¡×××× ×××§××¨/g, 'סיכום ביקור')
                  .replace(/×××©××¨ ×ª×¨××¤××ª/g, 'מרשם תרופות')
                  .replace(/×ª××¦×××ª ××××§××ª/g, 'תוצאות בדיקות')
                  .replace(/×××©××¨ ×××¡×× ××/g, 'מכתב מסכם')
                  .replace(/×ª×©×××ª ×××¢×¥/g, 'תשובת יועץ')
                  .replace(/××¤× ××/g, 'מפנה')
                  .replace(/׳/g, '')
                  .replace(/×/g, '');
              }
              return null;
            },
            () => Buffer.from(file.originalname, 'latin1').toString('utf8'),
            () => {
              try {
                return decodeURIComponent(escape(file.originalname));
              } catch {
                return null;
              }
            },
            () => {
              const bytes = [];
              for (let i = 0; i < file.originalname.length; i++) {
                bytes.push(file.originalname.charCodeAt(i) & 0xFF);
              }
              return Buffer.from(bytes).toString('utf8');
            }
          ];

          let bestResult = originalEncoding;
          let bestScore = 0;

          for (const method of decodingMethods) {
            try {
              const result = method();
              if (result && result !== originalEncoding) {
                let score = 0;
                if (/[\u0590-\u05FF]/.test(result)) score += 10;
                if (!result.includes('�')) score += 5;
                if (!result.includes('×')) score += 3;
                if (!result.includes('׳')) score += 3;
                if (result.length > 0) score += 1;

                if (score > bestScore) {
                  bestScore = score;
                  bestResult = result;
                }
              }
            } catch (methodErr) {
              // Continue to next method
            }
          }

          if (bestResult !== originalEncoding && bestScore > 5) { // Only apply if significant improvement
            file.originalname = bestResult;
            console.log(`🔧 [AGENT] Fixed filename encoding: ${originalEncoding} -> ${bestResult} (score: ${bestScore})`);
          }
        } catch (err) {
          console.warn(`⚠️ [AGENT] Could not fix filename encoding for: ${file.originalname}`, err.message);
        }
      }
    });
  }
  next();
};

// 🔒 SECURE: Configure multer for E2E encrypted document uploads
// CRITICAL: Using memory storage for E2E encryption - files never touch disk unencrypted
const memoryStorage = multer.memoryStorage();

const documentUpload = multer({
  storage: memoryStorage, // Use memory storage for E2E encryption - no unencrypted disk storage
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for documents
    files: 100, // Maximum 100 files per upload - increased for bulk processing
    fieldSize: 1024 * 1024, // 1MB for text fields
    headerPairs: 2000
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp',
      'application/dicom',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',  // Added CSV support for bulk patient import
      'application/csv',  // Some browsers send this MIME type for CSV
      'application/comma-separated-values',  // Alternative CSV MIME type
      'text/comma-separated-values'  // Another alternative CSV MIME type
    ];

    // Debug log to see what MIME type is being sent
    console.log(`[Upload] File: ${file.originalname}, MIME type: ${file.mimetype}`);

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
  }
});

// @route   POST /api/agent/voice-command
// @desc    Process voice command with full pipeline (STT -> Claude -> TTS)
// @access  Private (requires authentication + practice context)
router.post('/voice-command', 
  generalRateLimit,
  aiRateLimit,
  requireAuth,
  detectCountry,
  validateRequest,
  audioUpload.single('audio'),
  sanitizeHeaders,
  sanitizeRequestBody,
  validateVoiceInput,
  asyncHandler(async (req, res) => {
  try {
    const { sessionId, language = 'he-IL' } = req.body;
    
    if (!req.file) {
      return sendLocalizedError(res, req.country, 'AUDIO_FILE_REQUIRED', {}, 400);
    }

    if (!sessionId) {
      return sendLocalizedError(res, req.country, 'SESSION_ID_REQUIRED', {}, 400);
    }

    // Log voice command request
    await auditAIUsage(req, 'VOICE_COMMAND_REQUEST', {
      sessionId: sessionId,
      language: language,
      audioFileSize: req.file.size,
      audioFileName: req.file.originalname
    });

    // Namespace session ID by practice
    // Check if sessionId already contains the practice prefix to avoid double-prefixing
    const practicePrefix = `${req.practiceSubdomain}_`;
    // Use includes() instead of startsWith() because session format is "session_yale_..."
    const practiceSessionId = sessionId.includes(practicePrefix)
      ? sessionId
      : `${practicePrefix}${sessionId}`;

    console.log(`🎤 Processing voice command for session: ${practiceSessionId}`);
    console.log(`📁 Audio file: ${req.file.originalname}, Size: ${req.file.size} bytes`);
    console.log(`🏥 Practice context: ${req.practiceSubdomain}`);
    console.log(`🌍 Country: ${req.country}`);

    // Use pre-built practice context from middleware
    const result = await agent.processVoiceCommand(req.file.buffer, practiceSessionId, language, req.practiceContext);

    // Log voice command response
    await auditAIUsage(req, 'VOICE_COMMAND_RESPONSE', {
      sessionId: sessionId,
      success: result.success,
      transcription: result.data?.transcription?.substring(0, 100),
      action: result.data?.aiResponse?.action
    });

    if (result.success) {
      res.json({
        success: true,
        data: {
          transcript: result.transcript,
          response: result.response,
          audioResponse: result.audioResponse, // Base64 encoded MP3
          confidence: result.confidence,
          toolUsed: result.toolUsed,
          toolResult: result.toolResult,
          sessionId
        }
      });
    } else {
      await auditAIUsage(req, 'VOICE_COMMAND_ERROR', {
        sessionId: sessionId,
        error: result.error
      });
      return sendLocalizedError(res, req.country, 'VOICE_PROCESSING_FAILED', {
        details: result.error
      }, 500);
    }

  } catch (error) {
    console.error('Voice command processing error:', error);
    await auditAIUsage(req, 'VOICE_COMMAND_ERROR', {
      sessionId: sessionId,
      error: error.message
    });
    return sendLocalizedError(res, req.country, 'VOICE_PROCESSING_FAILED', {
      details: error.message
    }, 500);
  }
}));

// @route   POST /api/agent/chat
// @desc    Process chat message and execute actions
// @access  Private (requires authentication + practice context)
router.post('/chat', 
  generalRateLimit,
  aiRateLimit,
  validateSession,  // Validate session from httpOnly cookie
  practiceContext,    // Set practice context
  practiceAuth,       // Load full user details including roles
  practiceModels,     // Load practice models
  requireAuth,      // Require authenticated user
  validateCSRF,     // Validate CSRF token for mutations
  detectCountry,
  validateRequest,
  sanitizeHeaders,
  sanitizeRequestBody,
  validateChatInput,
  asyncHandler(async (req, res) => {
    // --- Streaming Setup ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // For Nginx
    res.flushHeaders();

    // CRITICAL: Set TCP_NODELAY ONCE on connection start to disable Nagle's algorithm
    // This forces packets to send immediately instead of waiting
    if (res.socket && typeof res.socket.setNoDelay === 'function') {
      res.socket.setNoDelay(true);
      console.log('🚀 [STREAMING] TCP_NODELAY enabled for IMMEDIATE transmission');
    }

    // SIMPLE: Send chunks immediately without any queue/buffering
    const sendChunk = (chunk) => {
      if (!res.writableEnded) {
        const data = `data: ${JSON.stringify(chunk)}\n\n`;
        res.write(data);

        // Force immediate flush after each write
        if (typeof res.flush === 'function') {
          res.flush();
        }
      }
    };

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(':heartbeat\n\n');
      } else {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      console.log('SSE client disconnected from /chat');
      res.end();
    });

    try {
      // --- Original Logic (Preserved) ---
      const clinicLanguage = req.practice?.settings?.language || req.practice?.language || 'he';
      const { message, sessionId = 'default', language = clinicLanguage, fileUpload, batchFiles, uploadInfo, pinnedContext, artifactContext } = req.body;

      if (!message) {
        sendChunk({ type: 'error', error: 'Message is required' });
        return res.end();
      }

      let messageText = message;
      if (typeof message === 'object' && message !== null) {
        messageText = message.text || message.content || message.message || JSON.stringify(message);
      }

      let enhancedMessage = messageText;
      if (uploadInfo && uploadInfo.uploadId) {
        enhancedMessage = `${messageText}\n[UPLOAD_ID:${uploadInfo.uploadId}]`;
        req.uploadContext = uploadInfo;

        // 🔄 CSV DETECTION: Inject CSV type into message for automatic import routing
        if (uploadInfo.csvType) {
          if (uploadInfo.csvType === 'patients') {
            enhancedMessage += `\n[CSV_TYPE:PATIENTS] - Automatically import patients using importPatientsFromCSV("${uploadInfo.uploadId}")`;
          } else if (uploadInfo.csvType === 'users') {
            enhancedMessage += `\n[CSV_TYPE:USERS] - Automatically import users using importUsersFromCSV("${uploadInfo.uploadId}")`;
          } else if (uploadInfo.csvType === 'error') {
            enhancedMessage += `\n[CSV_ERROR] - ${uploadInfo.csvError?.message || 'CSV format error'}`;
          }
        }
      }

      const practicePrefix = `${req.practiceSubdomain}_`;
      const practiceSessionId = sessionId.includes(practicePrefix) ? sessionId : `${practicePrefix}${sessionId}`;
      const enhancedContext = { ...req.practiceContext, batchFiles, uploadInfo, pinnedContext, artifactContext, currentUser: req.user };

      const agentStartTime = Date.now();

      // --- Call the streaming-capable function ---
      const result = await agent.processChatMessage(enhancedMessage, practiceSessionId, language, enhancedContext, sendChunk);

      // --- Original Post-Processing & DB Saving Logic (Preserved) ---
      const processingTime = Date.now() - agentStartTime;
      const ChatMessage = req.models.ChatMessage;

      const saveMessagesAsync = async () => {
        try {
          const messageContext = { serviceId: 'agent-service', operation: 'saveMessage', practiceId: req.practice?._id || 'global' };
          const userMessageData = {
            sessionId: practiceSessionId,
            userId: req.user.id || req.user._id,
            messageId: `msg_${Date.now()}_user`,
            type: 'user',
            content: await encryptionService.encrypt(messageText, 'phi'),
            language: language,
            createdAt: new Date(),
          };
          const agentMessageData = {
            sessionId: practiceSessionId,
            userId: req.user.id || req.user._id,
            messageId: `msg_${Date.now()}_agent`,
            type: 'agent',
            content: await encryptionService.encrypt(result.message || 'No response', 'phi'),
            language: language,
            actionTaken: result.actionTaken,
            actionResult: result.actionResult ? JSON.stringify(result.actionResult) : null,
            processingTime: processingTime,
            // CRITICAL: Save artifact panel, display type, and display data for frontend rendering
            artifactPanel: result.artifactPanel ? JSON.stringify(result.artifactPanel) : null,
            displayType: result.displayType || null,
            displayData: result.displayData ? JSON.stringify(result.displayData) : null,
            // CRITICAL: Save batch processing metadata for persistence across page refreshes
            backgroundProcessing: result.backgroundProcessing || null,
            batchId: result.batchId || null,
            createdAt: new Date(),
          };
          await Promise.all([
            SecureDataAccess.insert('chat_messages', userMessageData, messageContext),
            SecureDataAccess.insert('chat_messages', agentMessageData, messageContext)
          ]);
          console.log(`💾 Saved conversation to database asynchronously${result.backgroundProcessing ? ' (batch processing message)' : ''}.`);
        } catch (error) {
          console.error('Failed to save messages (non-blocking):', error.message);
        }
      };

      saveMessagesAsync().catch(console.error);

      // --- Finalize Stream ---
      // CRITICAL: Send 'complete' event with full result (includes artifactPanel for frontend)
      sendChunk({ type: 'complete', data: result });
      // Also send 'done' event to signal stream completion (for promise resolution)
      sendChunk({ type: 'done' });

    } catch (error) {
      console.error('❌ Streaming chat error:', error);
      sendChunk({ type: 'error', error: { message: error.message } });
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  })
);

// @route   GET /api/agent/batch-progress-stream
// @desc    Stream batch processing progress via Server-Sent Events (SSE)
// @access  Private (requires authentication + practice context)
router.get('/batch-progress-stream',
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    // Get batchProgressCache from service proxy manager
    const serviceProxyManager = require('../services/serviceProxyManager');
    const batchProgressCache = serviceProxyManager.get('batchProgressCache');
    if (!batchProgressCache) {
      return res.status(503).json({ success: false, message: 'Batch progress service not available' });
    }
    const { batchId = '*' } = req.query; // Default to all batches

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable Nginx buffering
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`);

    // Register this client for updates
    batchProgressCache.registerSSEClient(batchId, res);

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(`:heartbeat\n\n`);
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      batchProgressCache.unregisterSSEClient(batchId, res);
      console.log('📡 SSE client disconnected');
    });
  })
);

// @route   GET /api/agent/batch-progress
// @desc    Get batch processing progress (uses in-memory cache first)
// @access  Private (requires authentication + practice context)
router.get('/batch-progress',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      // Get batchProgressCache from service proxy manager
      const serviceProxyManager = require('../services/serviceProxyManager');
      const batchProgressCache = serviceProxyManager.get('batchProgressCache');
      if (!batchProgressCache) {
        console.log('⚠️ BatchProgressCache service not available');
        // Fall through to database query
      }

      // First try to get from cache if available
      const cachedProgress = batchProgressCache ? batchProgressCache.getAllActiveProgress() : null;

      if (cachedProgress && cachedProgress.length > 0) {
        console.log('📊 Returning cached batch progress');
        return res.json({
          success: true,
          data: cachedProgress,
          hasActiveBatches: true,
          source: 'cache'
        });
      }

      // Fallback to database if cache is empty
      const SecureDataAccess = require('../services/secureDataAccess');
      const progressRecords = await SecureDataAccess.query(
        'batch_progress',
        {
          status: { $in: ['preparing', 'processing', 'in_progress'] },
          updatedAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
        },
        {
          sort: { updatedAt: -1 },
          limit: 10
        },
        {
          serviceId: 'agent-service',
          operation: 'getBatchProgress',
          practiceId: req.practice?.id || 'global'
        }
      );

      res.json({
        success: true,
        data: progressRecords || [],
        hasActiveBatches: progressRecords && progressRecords.length > 0,
        source: 'database'
      });
    } catch (error) {
      // Instead of returning 500, return empty array with flag
      console.warn('Batch progress query failed (likely no service auth):', error.message);
      res.json({
        success: true,
        data: [],
        hasActiveBatches: false,
        warning: 'No active batches or service not authorized'
      });
    }
  })
);

// @route   GET /api/agent/chat-stream
// @desc    Stream chat responses using Server-Sent Events
// @access  Private (requires authentication + practice context)
router.get('/chat-stream',
  generalRateLimit,
  aiRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  practiceModels,
  requireAuth,
  detectCountry,
  async (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // CRITICAL: Set TCP_NODELAY ONCE on connection start to disable Nagle's algorithm
  // This forces packets to send immediately instead of waiting
  if (res.socket && typeof res.socket.setNoDelay === 'function') {
    res.socket.setNoDelay(true);
    console.log('🚀 [STREAMING] TCP_NODELAY enabled for IMMEDIATE transmission');
  }

  // SIMPLE: Send chunks immediately without any queue/buffering
  const sendChunk = (chunk) => {
    if (!res.writableEnded) {
      const data = `data: ${JSON.stringify(chunk)}\n\n`;
      res.write(data);

      // Force immediate flush after each write
      if (typeof res.flush === 'function') {
        res.flush();
      }
    }
  };

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(':heartbeat\n\n');
    } else {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    console.log('SSE client disconnected from /chat-stream');
    res.end();
  });

  try {
    const clinicLanguage = req.practice?.settings?.language || req.practice?.language || 'he';
    const { message, sessionId = 'default', language = clinicLanguage } = req.query;

    if (!message) {
      sendChunk({ type: 'error', error: 'Message is required' });
      return res.end();
    }

    const practicePrefix = `${req.practiceSubdomain}_`;
    const practiceSessionId = sessionId.includes(practicePrefix) ? sessionId : `${practicePrefix}${sessionId}`;
    // models: req.models — the /chat POST path gets this via validateRequest, but
    // /chat-stream has no validateRequest, so model-dependent service methods
    // (e.g. updateMedicalHistory/deleteMedicalHistory which check
    // practiceContext.models?.Patient) would otherwise fail here. req.models is
    // populated by the practiceModels middleware on this route.
    const enhancedContext = { ...req.practiceContext, models: req.models, currentUser: req.user };

    // Use the new streaming function from the agent wrapper
    const agentWrapper = require('../services/agentServiceWrapper');
    await agentWrapper.processChatMessageAndStream(message, practiceSessionId, language, enhancedContext, sendChunk);

    sendChunk({ type: 'done' });

  } catch (error) {
    console.error('❌ [Agent Stream] Error:', error);
    sendChunk({ type: 'error', error: { message: error.message } });
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
});

// @route   POST /api/agent/analyze-document
// @desc    Analyze medical document via agent
// @access  Private (requires authentication + practice context)
router.post('/analyze-document', 
  generalRateLimit,
  aiRateLimit,
  requireAuth,
  detectCountry,
  validateRequest,
  sanitizeHeaders,
  sanitizeRequestBody,
  validateAnalysisInput,
  asyncHandler(async (req, res) => {
  try {
    const { documentText, documentId, patientId, language = 'he' } = req.body;

    if (!documentText && !documentId) {
      return sendLocalizedError(res, req.country, 'TEXT_REQUIRED', {}, 400);
    }

    console.log('📄 Processing document analysis request');

    // Process document analysis through the agent
    const result = await agent.analyzeDocument({
      documentText,
      documentId,
      patientId,
      language
    });

    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      return sendLocalizedError(res, req.country, 'DOCUMENT_ANALYSIS_FAILED', {
        details: result.error
      }, 500);
    }

  } catch (error) {
    console.error('❌ Document analysis error:', error);
    await auditAIUsage(req, 'DOCUMENT_ANALYSIS_ERROR', {
      error: error.message
    });
    return sendLocalizedError(res, req.country, 'DOCUMENT_ANALYSIS_FAILED', {
      details: error.message
    }, 500);
  }
}));

// @route   POST /api/agent/speech-to-text
// @desc    Convert speech to text only
// @access  Private (requires authentication + practice context)
router.post('/speech-to-text', 
  generalRateLimit,
  requireAuth,
  detectCountry,
  validateRequest,
  audioUpload.single('audio'), 
  asyncHandler(async (req, res) => {
  try {
    const { language = 'he-IL' } = req.body;
    
    if (!req.file) {
      return sendLocalizedError(res, req.country, 'AUDIO_FILE_REQUIRED', {}, 400);
    }

    console.log(`🎤 Converting speech to text, Language: ${language}`);

    const result = await agent.speechToText(req.file.buffer, language);

    if (result.success) {
      res.json({
        success: true,
        data: {
          transcript: result.transcript,
          confidence: result.confidence,
          language: result.language,
          words: result.words
        }
      });
    } else {
      return sendLocalizedError(res, req.country, 'VOICE_PROCESSING_FAILED', {
        details: result.error
      }, 500);
    }

  } catch (error) {
    console.error('Speech-to-text error:', error);
    return sendLocalizedError(res, req.country, 'VOICE_PROCESSING_FAILED', {
      details: error.message
    }, 500);
  }
}));

// @route   POST /api/agent/text-to-speech
// @desc    Convert text to speech only
// @access  Private (requires authentication + practice context)
router.post('/text-to-speech', 
  generalRateLimit,
  requireAuth,
  detectCountry,
  validateRequest,
  sanitizeHeaders,
  sanitizeRequestBody,
  validateTextToSpeechInput,
  asyncHandler(async (req, res) => {
  try {
    const { text, language = 'he-IL' } = req.body;
    
    if (!text) {
      return sendLocalizedError(res, req.country, 'TEXT_REQUIRED', {}, 400);
    }

    console.log(`🔊 Converting text to speech, Language: ${language}`);

    const result = await agent.textToSpeech(text, language);

    if (result.success) {
      res.json({
        success: true,
        data: {
          audioContent: result.audioContent, // Base64 encoded MP3
          language: result.language
        }
      });
    } else {
      return sendLocalizedError(res, req.country, 'VOICE_PROCESSING_FAILED', {
        details: result.error
      }, 500);
    }

  } catch (error) {
    console.error('Text-to-speech error:', error);
    return sendLocalizedError(res, req.country, 'VOICE_PROCESSING_FAILED', {
      details: error.message
    }, 500);
  }
}));

// @route   POST /api/agent/process-text
// @desc    Process text with Claude AI only (no speech)
// @access  Private (requires authentication + practice context)
router.post('/process-text', 
  generalRateLimit,
  aiRateLimit,
  requireAuth,
  detectCountry,
  validateRequest,
  sanitizeHeaders,
  sanitizeRequestBody,
  validateProcessTextInput,
  asyncHandler(async (req, res) => {
  try {
    const { text, sessionId, language = 'he' } = req.body;
    
    if (!text) {
      return sendLocalizedError(res, req.country, 'TEXT_REQUIRED', {}, 400);
    }

    if (!sessionId) {
      return sendLocalizedError(res, req.country, 'SESSION_ID_REQUIRED', {}, 400);
    }

    console.log(`🤖 Processing text with Claude AI for session: ${sessionId}`);

    const result = await agent.processWithClaude(text, sessionId, language);

    if (result.success) {
      res.json({
        success: true,
        data: {
          response: result.response,
          toolUsed: result.toolUsed,
          toolResult: result.toolResult,
          sessionId
        }
      });
    } else {
      return sendLocalizedError(res, req.country, 'AI_REQUEST_FAILED', {
        details: result.error
      }, 500);
    }

  } catch (error) {
    console.error('Text processing error:', error);
    return sendLocalizedError(res, req.country, 'AI_REQUEST_FAILED', {
      details: error.message
    }, 500);
  }
}));

// @route   DELETE /api/agent/session/:sessionId
// @desc    Clear conversation history for a session
// @access  Private (requires authentication + practice context)
router.delete('/session/:sessionId', 
  generalRateLimit,
  requireAuth,
  detectCountry,
  validateRequest,
  sanitizeHeaders,
  asyncHandler(async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Sanitize URL parameter
    const sanitizedSessionId = sanitizeSessionId(sessionId);
    
    // Namespace session ID by practice
    // Check if sessionId already contains the practice prefix to avoid double-prefixing
    const practicePrefix = `${req.practiceSubdomain}_`;
    const practiceSessionId = sanitizedSessionId.startsWith(practicePrefix)
      ? sanitizedSessionId
      : `${practicePrefix}${sanitizedSessionId}`;
    
    console.log(`🗑️ Clearing session: ${practiceSessionId} for practice: ${req.practiceSubdomain}`);
    
    agent.clearSession(practiceSessionId);
    
    res.json({
      success: true,
      message: getLocalizedSuccess(req.country, 'SESSION_CLEARED')
    });

  } catch (error) {
    console.error('Session clear error:', error);
    return sendLocalizedError(res, req.country, 'SYSTEM_ERROR', {
      details: error.message
    }, 500);
  }
}));

// Helper function to handle multer errors in agent route
const handleAgentMulterError = (err, req, res, next) => {
  if (err) {
    console.error('🔴 Agent upload error:', err);
    
    // Handle specific multer errors with bilingual messages
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: {
          en: 'One or more files exceed the 50MB size limit',
          he: 'קובץ אחד או יותר חורגים ממגבלת הגודל של 50MB'
        },
        details: `Maximum file size allowed: 50MB`
      });
    }
    
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        message: {
          en: 'Maximum 100 files allowed per upload. Please select fewer files and try again.',
          he: 'מותר להעלות עד 100 קבצים בכל פעם. אנא בחר פחות קבצים ונסה שוב.'
        },
        details: {
          maxFiles: 100,
          attempted: req.files ? req.files.length : 'unknown'
        }
      });
    }
    
    if (err.message && err.message.includes('File type not allowed')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type',
        message: {
          en: err.message,
          he: 'סוג קובץ לא מורשה'
        }
      });
    }
    
    // Generic multer error
    return res.status(400).json({
      success: false,
      error: 'Upload error',
      message: {
        en: 'File upload failed. Please try again.',
        he: 'העלאת הקובץ נכשלה. אנא נסה שוב.'
      },
      details: err.message
    });
  }
  next();
};

// @route   POST /api/agent/upload-document
// @desc    Upload documents and ask for patient assignment through chat interface
// @access  Private (requires authentication + practice context)
router.post('/upload-document', 
  generalRateLimit,
  uploadRateLimit,
  requireAuth,
  detectCountry,
  practiceContext,
  practiceModels,
  validateRequest,
  checkMemoryLimit,
  documentUpload.array('files', 100),
  handleAgentMulterError,  // Add multer error handler
  fixAgentFilenameEncoding,
  sanitizeHeaders,
  sanitizeRequestBody,
  sanitizeFileUploads,
  validateUploadInput,
  asyncHandler(async (req, res) => {
  // 🔒 E2E ENCRYPTION: No temp files, process in memory only
  
  try {
    logMemoryUsage('upload-start', req);
    
    // Get encryption key from KMS
    let ENCRYPTION_KEY;
    try {
      ENCRYPTION_KEY = await productionKMS.getInternalKey('DOCUMENT_ENCRYPTION_KEY');
      if (!ENCRYPTION_KEY) {
        // Generate new key if doesn't exist
        ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');
        await productionKMS.storeInternalKey('DOCUMENT_ENCRYPTION_KEY', ENCRYPTION_KEY);
        console.log('✅ Generated and stored new DOCUMENT_ENCRYPTION_KEY in KMS');
      }
    } catch (kmsError) {
      console.error('❌ CRITICAL: Failed to get DOCUMENT_ENCRYPTION_KEY from KMS:', kmsError.message);
      return sendLocalizedError(res, req.country, 'SYSTEM_ERROR', {
        details: 'Encryption configuration required for medical data security'
      }, 500);
    }
    
    const userId = req.headers['user-id'] || 'default-doctor-user';
    const files = req.files;
    
    // Get sessionId from request body for cost tracking
    const sessionId = req.body.sessionId || req.body.session_id || null;
    
    // Check if patient was selected in GUI
    let selectedPatientId = req.body.patientId || req.body.patient_id;
    let selectedPatientName = req.body.patientName || req.body.patient_name;
    
    // If we have ID but no name, look up the patient name
    if (selectedPatientId && !selectedPatientName) {
      try {
        console.log(`🔍 [AGENT] Looking up patient name for ID: ${selectedPatientId}`);
        const PatientModel = req.models.Patient;
        const patientResults = await SecureDataAccess.query('patientmodels', { _id: selectedPatientId }, { limit: 1 }, context);

        const patient = patientResults[0];
        
        // Debug: log patient structure
        if (patient) {
          console.log(`🔍 [AGENT] Patient found - structure:`, {
            id: patient._id,
            firstName: patient.firstName,
            lastName: patient.lastName,
            hasFirstName: !!patient.firstName,
            hasLastName: !!patient.lastName,
            allFields: Object.keys(patient.toObject()).slice(0, 10) // First 10 fields
          });
        }
        if (patient && patient.firstName && patient.lastName) {
          selectedPatientName = `${patient.firstName} ${patient.lastName}`.trim();
          console.log(`✅ [AGENT] Found patient: ${selectedPatientName}`);
        } else if (patient) {
          // Fallback if firstName/lastName are missing
          selectedPatientName = patient.firstName || patient.lastName || `Patient ${selectedPatientId.slice(-6)}`;
          console.log(`⚠️ [AGENT] Found patient with partial name: ${selectedPatientName}`);
        } else {
          console.log(`❌ [AGENT] Patient not found for ID: ${selectedPatientId}`);
          selectedPatientId = null; // Reset ID if patient not found
        }
      } catch (lookupError) {
        console.error('❌ [AGENT] Error looking up patient:', lookupError);
        console.error('Error details:', {
          patientId: selectedPatientId,
          errorMessage: lookupError.message,
          stack: lookupError.stack?.split('\n')[0]
        });
        selectedPatientId = null; // Reset on error
      }
    }
    
    console.log('📋 [AGENT] Upload request details:');
    console.log('  Files:', files?.length || 0);
    console.log('  Body:', req.body);
    console.log('  Selected Patient ID:', selectedPatientId);
    console.log('  Selected Patient Name:', selectedPatientName);

    if (!files || files.length === 0) {
      return sendLocalizedError(res, req.country, 'NO_FILES_UPLOADED', {}, 400);
    }

    // 🔒 E2E: Files are in memory (req.files[].buffer), no temp files to track
    console.log(`🔒 [E2E] Received ${files.length} document(s) in memory for secure encryption`);

    // Helper function to determine file type
    const getFileType = (mimetype, filename) => {
      const fileName = filename.toLowerCase();
      
      // Enhanced medical document classification with Hebrew support
      // Check for Hebrew keywords first
      if (fileName.includes('תוצאות') || fileName.includes('מעבדה') || 
          fileName.includes('blood') || fileName.includes('lab') || 
          fileName.includes('בדיקה') || fileName.includes('בדיקות')) {
        return 'lab_results';
      } else if (fileName.includes('מרשם') || fileName.includes('תרופ') || 
                 fileName.includes('prescription') || fileName.includes('medication')) {
        return 'prescriptions';
      } else if (fileName.includes('הדמיה') || fileName.includes('mri') || 
                 fileName.includes('ct') || fileName.includes('xray') || 
                 fileName.includes('x-ray') || fileName.includes('ultrasound') || 
                 fileName.includes('echo') || fileName.includes('scan')) {
        return 'imaging_reports';
      } else if (fileName.includes('ביקור') || fileName.includes('יעוץ') || 
                 fileName.includes('consultation') || fileName.includes('visit') || 
                 fileName.includes('סיכום')) {
        return 'consultation_notes';
      } else if (fileName.includes('שחרור') || fileName.includes('discharge') || 
                 fileName.includes('summary')) {
        return 'discharge_summary';
      } else if (fileName.includes('חיסון') || fileName.includes('vaccination') || 
                 fileName.includes('vaccine')) {
        return 'vaccination_records';
      } else if (fileName.includes('הפניה') || fileName.includes('referral')) {
        return 'referrals';
      } else if (fileName.includes('אישור') || fileName.includes('certificate') || 
                 fileName.includes('medical')) {
        return 'medical_certificate';
      } else if (fileName.includes('פרוצדורה') || fileName.includes('procedure') || 
                 fileName.includes('surgery')) {
        return 'medical_procedures';
      }
      
      // Default to consultation_notes for PDFs and documents
      if (mimetype === 'application/pdf' || mimetype.includes('document')) {
        return 'consultation_notes';
      }
      
      // Default to imaging_reports for images
      if (mimetype.startsWith('image/')) {
        return 'imaging_reports';
      }
      
      return 'consultation_notes'; // Default category
    };

    // Helper function to fix Hebrew filename encoding (same as manual upload)
    const fixHebrewFilename = (filename) => {
      try {
        // If filename contains corrupted characters, try to decode it properly
        if (filename.includes('×') || filename.includes('�')) {
          console.log(`🔧 [AGENT] Attempting to fix corrupted Hebrew filename: ${filename}`);

          // Try different encoding approaches
          const approaches = [
            // Try UTF-8 decoding
            () => Buffer.from(filename, 'latin1').toString('utf8'),
            // Try URL decoding
            () => decodeURIComponent(filename),
            // Try replacing common corruption patterns
            () => filename.replace(/×/g, '').replace(/�/g, ''),
          ];

          for (const approach of approaches) {
            try {
              const fixed = approach();
              if (fixed !== filename && !fixed.includes('×') && !fixed.includes('�')) {
                console.log(`✅ [AGENT] Fixed filename: ${filename} -> ${fixed}`);
                return fixed;
              }
            } catch (e) {
              // Continue to next approach
            }
          }
        }

        return filename;
      } catch (error) {
        console.error('❌ [AGENT] Error fixing Hebrew filename:', error);
        return filename;
      }
    };

    // Get practice-specific PendingUpload model
    const PendingUploadModel = req.models.PendingUpload;
    
    if (!PendingUploadModel) {
      console.error('❌ [AGENT] PendingUpload model not available in req.models');
      console.error('Available models:', Object.keys(req.models || {}));
      return sendLocalizedError(res, req.country, 'SYSTEM_ERROR', {
        details: 'Database models not initialized'
      }, 500);
    }

    // Create context for SecureDataAccess operations
    const context = {
      serviceId: 'agent-service',
      operation: 'uploadDocuments',
      practiceId: req.practice?.subdomain || req.practiceSubdomain
    };
    
    // Check if we should use batch processing (more than 100 files or request specifies batch mode)
    const useBatchProcessing = files.length > 100 || req.body.batchMode === 'true';
    
    // Skip the batch processing block entirely since geminiBatchService doesn't exist
    if (false && useBatchProcessing && files.length > 1) {
      console.log(`🚀 [AGENT] Using BATCH PROCESSING for ${files.length} files with Gemini Files API`);
      
      // Create pending upload record for batch processing
      const uploadId = crypto.randomBytes(16).toString('hex');
      
      // Encrypt all files first
      const encryptedFiles = [];
      for (const file of files) {
        const fixedOriginalName = fixHebrewFilename(file.originalname);
        console.log(`🔒 [AGENT] Encrypting file for batch: ${fixedOriginalName}`);
        
        const fileBuffer = file.buffer;
        if (!fileBuffer) {
          throw new Error('File buffer not available - E2E encryption requires memory storage');
        }
        
        // Encrypt using SERVICE key (allows recovery) instead of user key
        const encrypted = await e2eEncryptionService.encryptWithServiceKey(fileBuffer, {
          fileName: fixedOriginalName,
          mimeType: file.mimetype
        });
        
        encryptedFiles.push({
          originalName: fixedOriginalName,
          encryptedContent: encrypted.data,  // The encrypted data is in the 'data' field
          contentIv: encrypted.iv,           // IV is in the 'iv' field  
          contentTag: encrypted.tag,         // Tag is in the 'tag' field
          mimetype: file.mimetype,
          size: file.size,
          fileType: getFileType(file.mimetype, fixedOriginalName)
        });
      }
      
      // Create PendingUpload record
      const pendingUpload = {
        uploadId,
        userId,
        practiceId: req.practiceSubdomain, // Store with practiceId for consistency
        practiceSubdomain: req.practiceSubdomain,
        files: encryptedFiles,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000) // 1 hour
      };
      
      await SecureDataAccess.insert('pendinguploads', pendingUpload, context);
      console.log(`✅ [AGENT] Created pending upload batch: ${uploadId}`);
      
      // Create a message for the AI to process this batch
      const language = req.headers['accept-language']?.includes('he') || req.body.language === 'he' ? 'he' : 'en';
      
      // Generate a message that will trigger the AI to analyze the batch
      const chatMessage = language === 'he' 
        ? `✅ העלו ${encryptedFiles.length} מסמכים רפואיים לניתוח. מזהה אצווה: ${uploadId}. אשתמש בעיבוד אצווה כדי לחסוך 50% בעלויות.`
        : `✅ ${encryptedFiles.length} medical documents uploaded for analysis. Batch ID: ${uploadId}. I'll use batch processing to save 50% on costs.`;
      
      console.log(`📦 [AGENT] Created batch upload: ${uploadId} with ${encryptedFiles.length} files`);
      console.log(`📦 [AGENT] Frontend will trigger AI analysis via: "analyze batch ${uploadId}"`);
      
      return res.json({
        success: true,
        message: chatMessage,
        chatMessage: chatMessage,  // Add formatted message for display
        uploadId,
        batchMode: true,
        totalDocuments: encryptedFiles.length,
        sessionId,
        // Add uploadContext for frontend to detect upload status
        uploadContext: {
          processed: false,  // Will be processed by AI agent
          uploadId: uploadId,
          fileCount: encryptedFiles.length
        }
      });
    }
    
    // Original sequential processing for single files or when batch mode is disabled
    console.log(`📄 [AGENT] Using sequential processing for ${files.length} file(s)`);
    
    // Process and encrypt each file
    const encryptedFiles = [];
    for (const file of files) {
      try {
        // Use the filename (already fixed by middleware if needed)
        const fixedOriginalName = file.originalname;
        console.log(`🔒 [AGENT] Processing file: ${fixedOriginalName}`);

        // 🔒 E2E ENCRYPTION: File is already in memory from multer memoryStorage
        const fileBuffer = file.buffer; // File buffer from memory storage
        
        if (!fileBuffer) {
          throw new Error('File buffer not available - E2E encryption requires memory storage');
        }

        // 🔒 SERVICE-LEVEL ENCRYPTION: For PendingUploads, use service key (allows recovery)
        // Unlike E2E encryption, this allows backend to decrypt for job recovery
        const userId = req.user?._id?.toString() || req.headers['x-user-id'] || 'default-doctor-user';
        const metadata = {
          id: crypto.randomBytes(16).toString('hex'),
          title: fixedOriginalName,
          originalName: fixedOriginalName,
          mimeType: file.mimetype,
          size: file.size,
          fileType: getFileType(file.mimetype, file.originalname),
          practiceSubdomain: req.practiceSubdomain
        };

        // Encrypt using SERVICE key (stored in KMS) - allows recovery without user session
        const encryptedPackage = await e2eEncryptionService.encryptWithServiceKey(
          fileBuffer,
          metadata
        );
        
        // 🔒 CRITICAL: Immediately clear the unencrypted buffer from memory
        file.buffer.fill(0);  // Zero out the original buffer for security

        encryptedFiles.push({
          originalName: fixedOriginalName, // Use fixed Hebrew filename
          encryptedPackage: encryptedPackage, // Complete encrypted package
          encryptedContent: Buffer.from(encryptedPackage.data, 'base64'), // Convert to Buffer for PendingUpload model
          contentIv: encryptedPackage.iv,  // Keep as base64 from E2E service
          contentTag: encryptedPackage.tag, // Keep as base64 from E2E service
          mimetype: file.mimetype,
          size: file.size,
          fileType: getFileType(file.mimetype, file.originalname)
        });

        console.log(`🔒 [AGENT] Encrypted from memory: ${fixedOriginalName} (${fileBuffer.length} bytes)`);

      } catch (error) {
        console.error(`❌ [AGENT] Error processing file ${file.originalname}:`, error);
        throw error;
      }
    }

    // Create batch or single upload record based on file count
    const isBatch = files.length > 1;
    const uploadId = isBatch 
      ? `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      : `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const pendingUploadData = {
      uploadId,
      userId,
      practiceSubdomain: req.practiceSubdomain, // Add practice context
      files: encryptedFiles,
      status: 'pending',
      isBatch: isBatch,
      fileCount: files.length,
      sessionId: sessionId || null,
      createdAt: new Date()
    };

    // Create context for SecureDataAccess - CRITICAL: Use practice subdomain, NEVER global
    if (!req.practice || !req.practice.subdomain) {
      console.error('❌ [SECURITY] Attempted file upload without practice context - REJECTED');
      return res.status(403).json({ 
        error: {
          he: 'העלאת קבצים דורשת הזדהות למרפאה',
          en: 'File upload requires practice authentication'
        }
      });
    }

    // Save to database using SecureDataAccess
    await SecureDataAccess.insert('pendinguploads', pendingUploadData, context);
    console.log(`📋 [AGENT] Stored ${files.length} encrypted files in database with ID: ${uploadId}`);

    // Create file list for user - use original names directly (already fixed by fixHebrewFilename)
    const fileNames = encryptedFiles.map(f => f.originalName);
    const fileNamesDisplay = fileNames.join(', '); // For display only

    console.log(`✅ [AGENT] Files stored successfully. Frontend should now send chat message.`);

    // 🔒 E2E: No temp files to clean up - all processing done in memory

    logMemoryUsage('upload-complete', req);

    // 🔍 Detect CSV type by inspecting content (not filename!) - ONLY for CSV files
    let csvType = null;
    let csvError = null;
    const hasCSV = files.some(f => f.mimetype === 'text/csv' || f.originalname?.toLowerCase().endsWith('.csv'));

    if (hasCSV && files.length === 1) {
      // Only run CSV detection for single CSV file uploads
      console.log(`🔍 [CSV Detection] Detected CSV file, analyzing headers...`);
      const { detectCSVType } = require('../services/csvTypeDetector');
      const encryptedFile = encryptedFiles[0];
      const detectionResult = await detectCSVType(encryptedFile.encryptedPackage, e2eEncryptionService, userId);

      // Check if result is an error object or a simple type string
      if (typeof detectionResult === 'object' && detectionResult.type === 'error') {
        csvType = 'error';
        csvError = {
          error: detectionResult.error,
          message: detectionResult.message
        };
        console.log(`❌ [CSV Detection] Error: ${detectionResult.error} - ${detectionResult.message}`);
      } else if (typeof detectionResult === 'object') {
        csvType = detectionResult.type;
        console.log(`🔍 [CSV Detection] File: ${encryptedFile.originalName}, Type: ${csvType}`);
      } else {
        // Legacy string response
        csvType = detectionResult;
        console.log(`🔍 [CSV Detection] File: ${encryptedFile.originalName}, Type: ${csvType}`);
      }
    }

    // Prepare response - don't send chatMessage to avoid duplication
    // The agent will handle the message generation
    let uploadContext = {
      type: 'document_upload',
      uploadId: uploadId,
      fileNames: fileNames,  // CRITICAL: Store as array for patient CSV detection
      csvType: csvType,  // 'patients', 'users', 'error', or null for non-CSV
      csvError: csvError  // Error details if csvType === 'error'
    };
    
    if (selectedPatientId && selectedPatientName) {
      // Patient was selected - auto-assign documents immediately
      try {
        console.log(`🔄 [AGENT] Auto-assigning documents to patient: ${selectedPatientName}`);
        console.log(`📦 [AGENT] Processing ${encryptedFiles.length} files for auto-assignment`);
        
        // Process the upload immediately (same logic as /process-pending-upload)
        const DocumentModel = req.models.Document;
        if (!DocumentModel) {
          console.error('❌ [AGENT] Document model not available');
          throw new Error('Document model not initialized');
        }
        const results = [];
        
        for (const file of encryptedFiles) {
          try {
            // Create document record with encrypted content (keep it encrypted for security)
            const document = new DocumentModel({
              fileName: file.originalName,
              originalName: file.originalName, // Required field
              fileSize: file.size,
              mimeType: file.mimetype,
              fileType: file.fileType,
              organizedFolder: file.fileType, // Use fileType as folder (lab_results, etc.)
              patientId: selectedPatientId,
              practiceSubdomain: req.practiceSubdomain,
              // Keep content encrypted for security
              encryptedContent: file.encryptedContent,
              contentIv: file.contentIv,
              contentTag: file.contentTag,
              uploadDate: new Date(),
              uploadedBy: userId,
              // Add metadata
              metadata: {
                uploadSource: 'agent_chat',
                patientName: selectedPatientName,
                originalUploadId: uploadId
              }
            });
            
            // Save the document to the database
            const savedDoc = await document.save();
            console.log(`✅ [AGENT] Document saved: ${file.originalName} with ID: ${savedDoc._id}`);
            console.log(`📍 [AGENT] Document details: patientId=${savedDoc.patientId}, practiceSubdomain=${savedDoc.practiceSubdomain}`);
            
            // Verify document was saved
            const savedDocResults = await SecureDataAccess.query('documents', { _id: savedDoc._id }, { limit: 1 }, context);

            const verifiedDoc = savedDocResults[0];
            if (verifiedDoc) {
              console.log(`✅ [AGENT] Document verified in database: ${verifiedDoc._id}`);
            } else {
              console.log(`❌ [AGENT] Document NOT found in database after save!`);
            }
            
            // Real AI analysis
            console.log(`🤖 [AGENT] Running REAL AI analysis for: ${file.originalName}`);
            
            let insights = {
              extractedText: `${file.originalName} - Awaiting AI Analysis`,
              confidence: 0,
              medicalData: {}
            };
            
            try {
              // Get the document analysis service
              const documentAnalysisService = require('../services/documentAnalysisService');
              
              // Decrypt the document content for analysis
              console.log(`🔍 [AGENT] Decrypting and analyzing document content with AI...`);
              let decryptedBuffer;
              
              if (file.encryptedContent && file.contentIv && file.contentTag) {
                try {
                  // Use the Document model's static method to decrypt
                  decryptedBuffer = DocumentModel.decryptContent(
                    file.encryptedContent,
                    file.contentIv,
                    file.contentTag
                  );
                  console.log(`✅ [AGENT] Document decrypted successfully, size: ${decryptedBuffer.length} bytes`);
                } catch (decryptErr) {
                  console.error(`❌ [AGENT] Failed to decrypt document:`, decryptErr.message);
                  decryptedBuffer = Buffer.from(''); // Empty buffer as fallback
                }
              } else {
                console.log(`⚠️ [AGENT] No encrypted content available for analysis`);
                decryptedBuffer = Buffer.from(''); // Empty buffer
              }
              
              // Analyze the actual document content with all required parameters
              const analysisResult = await documentAnalysisService.analyzeDocument(
                decryptedBuffer,
                file.originalName,  // fileName parameter
                file.mimetype || 'application/pdf',  // mimeType
                'he',  // language (Hebrew default)
                sessionId  // sessionId for cost tracking (may be null)
              );
              
              if (analysisResult.success) {
                console.log(`✅ [AGENT] AI analysis successful!`);
                insights = {
                  extractedText: analysisResult.extractedData?.diagnosis || 
                                analysisResult.extractedData?.notes || 
                                `Document analyzed: ${file.originalName}`,
                  confidence: analysisResult.confidence || 0.85,
                  medicalData: analysisResult.extractedData || {}
                };
              } else {
                console.log(`⚠️ [AGENT] AI analysis failed, using minimal data`);
                // If analysis fails, just mark it as uploaded without fake data
                insights = {
                  extractedText: `${file.originalName} - Analysis pending`,
                  confidence: 0,
                  medicalData: {
                    note: 'Document uploaded successfully. Analysis will be performed later.',
                    uploadDate: new Date(),
                    category: file.fileType
                  }
                };
              }
            } catch (analysisError) {
              console.error(`❌ [AGENT] Error during AI analysis:`, analysisError.message);
              // On error, just mark as uploaded without fake data
              insights = {
                extractedText: `${file.originalName} - Analysis error`,
                confidence: 0,
                medicalData: {
                  error: 'Could not analyze document',
                  uploadDate: new Date(),
                  category: file.fileType
                }
              };
            }
            
            // Update document with AI insights
            await SecureDataAccess.update('documents', { _id: savedDoc._id }, {
              analysisResults: insights,
              aiClassification: {
                documentType: file.fileType,
                confidence: insights.confidence,
                analyzedAt: new Date()
              }
            }, context);
            console.log(`✅ [AGENT] AI insights saved for: ${file.originalName}`);
            
            // Save medical data to patient's medicalHistory array
            if (insights.medicalData && Object.keys(insights.medicalData).length > 0 && selectedPatientId) {
              try {
                const visitDate = insights.medicalData.visitDate || insights.medicalData.date || new Date();
                
                // Map the file type to the correct category enum value
                const categoryMap = {
                  'lab_results': 'lab_results',
                  'prescriptions': 'prescriptions',
                  'discharge_summary': 'discharge_summary',
                  'imaging_reports': 'imaging_reports',
                  'consultation_notes': 'consultation_notes',
                  'vaccination_records': 'vaccination_records',
                  'referrals': 'referrals',
                  'medical_certificate': 'medical_certificate',
                  'medical_procedures': 'medical_procedures'
                };
                
                const category = categoryMap[insights.medicalData.category] || 'consultation_notes';
                
                // Build the medical history entry based on category
                const medicalHistoryEntry = {
                  date: visitDate,
                  category: category,
                  documentId: savedDoc._id,
                  uploadId: uploadId,
                  source: file.originalName,
                  createdBy: userId || 'system',
                  createdAt: new Date()
                };
                
                // Add category-specific fields
                if (category === 'consultation_notes') {
                  medicalHistoryEntry.diagnosis = insights.medicalData.diagnosis || '';
                  medicalHistoryEntry.symptoms = insights.medicalData.symptoms || '';
                  medicalHistoryEntry.treatment = insights.medicalData.treatment || '';
                  medicalHistoryEntry.notes = insights.medicalData.notes || insights.extractedText || '';
                  medicalHistoryEntry.prescribingDoctor = insights.medicalData.doctorName || insights.medicalData.provider || 'AI Analysis';
                } else if (category === 'prescriptions') {
                  medicalHistoryEntry.medications = insights.medicalData.medications || [];
                  medicalHistoryEntry.prescribingDoctor = insights.medicalData.doctorName || insights.medicalData.provider || '';
                  medicalHistoryEntry.diagnosis = insights.medicalData.diagnosis || '';
                  medicalHistoryEntry.notes = insights.medicalData.notes || '';
                } else if (category === 'lab_results') {
                  // Extract lab test results
                  const labTests = insights.medicalData.tests || [];
                  medicalHistoryEntry.testType = 'comprehensive';
                  medicalHistoryEntry.results = labTests.map(test => ({
                    parameter: test.name || '',
                    value: test.value || '',
                    unit: test.unit || '',
                    referenceRange: test.referenceRange || '',
                    status: test.status || 'normal'
                  }));
                  medicalHistoryEntry.labName = insights.medicalData.labName || '';
                  medicalHistoryEntry.notes = insights.medicalData.notes || '';
                } else if (category === 'imaging_reports') {
                  medicalHistoryEntry.imagingType = insights.medicalData.studyType || 'other';
                  medicalHistoryEntry.bodyPart = insights.medicalData.bodyPart || '';
                  medicalHistoryEntry.findings = insights.medicalData.findings || '';
                  medicalHistoryEntry.impression = insights.medicalData.impression || '';
                  medicalHistoryEntry.radiologist = insights.medicalData.radiologist || '';
                } else if (category === 'vaccination_records') {
                  medicalHistoryEntry.vaccinations = insights.medicalData.vaccinations || [];
                  medicalHistoryEntry.notes = insights.medicalData.notes || '';
                  medicalHistoryEntry.nextDueDate = insights.medicalData.nextDueDate || null;
                }
                
                // Update patient's medicalHistory array
                await SecureDataAccess.update('patients', 
                  { _id: selectedPatientId },
                  { $push: { medicalHistory: medicalHistoryEntry } },
                  context
                );
                
                console.log(`📋 [AGENT] Medical history saved to patient ${selectedPatientName}'s record`);

                // NOTE: Removed DUAL WRITE to patient.currentMedications (November 2025)
                // Medications from document imports are handled by batch processing
                // which stores them in the 'medications' collection directly.
                // getMedications() queries by patientId - no embedded data needed.
                // This follows proper MongoDB document model (reference pattern).

                // Update allergies if present
                if (insights.medicalData.allergies) {
                  const allergies = Array.isArray(insights.medicalData.allergies)
                    ? insights.medicalData.allergies
                    : [insights.medicalData.allergies];
                  
                  // Prepare allergies for update
                  const allergiesToAdd = allergies.map(allergy => ({
                    allergen: typeof allergy === 'string' ? allergy : allergy.allergen,
                    reaction: typeof allergy === 'object' ? (allergy.reaction || '') : '',
                    severity: typeof allergy === 'object' ? (allergy.severity || 'Unknown') : 'Unknown',
                    dateIdentified: visitDate,
                    source: file.originalName
                  }));
                  
                  // Update patient's allergies
                  await SecureDataAccess.update('patients', 
                    { _id: selectedPatientId }, 
                    { 
                      $addToSet: { 
                        allergies: { $each: allergiesToAdd }
                      }
                    }, 
                    context
                  );
                  console.log(`🚨 [AGENT] Updated allergies for patient ${selectedPatientName}`);
                }
              } catch (medError) {
                console.error(`⚠️ [AGENT] Failed to save medical history:`, medError.message);
                // Don't fail the whole process if medical record save fails
              }
            }
            
            results.push({ 
              success: true, 
              fileName: file.originalName, 
              documentId: document._id,
              aiAnalysis: insights 
            });
            
          } catch (fileError) {
            console.error(`❌ [AGENT] Error processing file ${file.originalName}:`, fileError);
            results.push({ success: false, fileName: file.originalName, error: fileError.message });
          }
        }
        
        // Clean up pending upload using SecureDataAccess - Use subdomain for proper routing
        const deleteContext = {
          serviceId: 'agent-service',
          operation: 'cleanupPendingUpload',
          practiceId: req.practice?.subdomain || req.practiceSubdomain  // Use subdomain, no global fallback
        };
        await SecureDataAccess.delete('pendinguploads', { uploadId }, deleteContext);
        
        const successCount = results.filter(r => r.success).length;
        
        // Don't send message - agent will handle it
        // chatMessage will be handled by agent
          
        uploadContext.selectedPatient = {
          id: selectedPatientId,
          name: selectedPatientName
        };
        uploadContext.autoAssign = true;
        uploadContext.processed = true;
        uploadContext.results = results;
        
      } catch (autoAssignError) {
        console.error('❌ [AGENT] Auto-assignment failed:', autoAssignError);
        // Don't send message - agent will handle it
        // Let agent ask for patient assignment
        
        uploadContext.autoAssign = false;
        uploadContext.error = autoAssignError.message;
      }
    } else {
      // No patient selected - let agent ask user to choose
      // Don't send duplicate message
      
      uploadContext.autoAssign = false;
    }

    // Format the response message based on what happened
    const language = req.headers['accept-language']?.includes('he') || req.body.language === 'he' ? 'he' : 'en';
    let chatMessage = '';
    
    if (uploadContext.processed && uploadContext.results) {
      // Documents were processed
      const successCount = uploadContext.results.filter(r => r.success).length;
      const failedCount = uploadContext.results.filter(r => !r.success).length;
      
      if (language === 'he') {
        chatMessage = `✅ קיבלתי ${files.length} מסמכים רפואיים.\n`;
        if (uploadContext.selectedPatient) {
          chatMessage += `שייכתי את המסמכים ל${uploadContext.selectedPatient.name}.\n`;
        }
        if (successCount > 0) {
          chatMessage += `\n📋 מסמכים שעובדו בהצלחה:\n`;
          uploadContext.results.filter(r => r.success).forEach(r => {
            chatMessage += `• ${r.fileName}\n`;
          });
        }
        if (failedCount > 0) {
          chatMessage += `\n⚠️ ${failedCount} מסמכים נכשלו בעיבוד.`;
        }
      } else {
        chatMessage = `✅ Received ${files.length} medical documents.\n`;
        if (uploadContext.selectedPatient) {
          chatMessage += `Assigned documents to ${uploadContext.selectedPatient.name}.\n`;
        }
        if (successCount > 0) {
          chatMessage += `\n📋 Successfully processed documents:\n`;
          uploadContext.results.filter(r => r.success).forEach(r => {
            chatMessage += `• ${r.fileName}\n`;
          });
        }
        if (failedCount > 0) {
          chatMessage += `\n⚠️ ${failedCount} documents failed to process.`;
        }
      }
    } else {
      // Documents uploaded but need patient assignment
      if (language === 'he') {
        chatMessage = `✅ קיבלתי ${files.length} מסמכים רפואיים.\n\n`;
        chatMessage += `📋 המסמכים שהועלו:\n`;
        files.forEach(f => {
          chatMessage += `• ${f.originalname}\n`;
        });
        chatMessage += `\nלמי לשייך את המסמכים? נא לציין שם או תעודת זהות של המטופל.`;
      } else {
        chatMessage = `✅ Received ${files.length} medical documents.\n\n`;
        chatMessage += `📋 Uploaded documents:\n`;
        files.forEach(f => {
          chatMessage += `• ${f.originalname}\n`;
        });
        chatMessage += `\nWhich patient should these documents be assigned to? Please provide a name or ID.`;
      }
    }
    
    // Return success response with formatted message
    res.json({
      success: true,
      uploadId,
      fileCount: files.length,
      files: encryptedFiles.map(f => ({
        name: f.originalName,
        size: f.size,
        type: f.fileType
      })),
      storageType: 'encrypted_database',
      chatMessage: chatMessage,  // Add formatted message for display
      uploadContext: uploadContext
    });

  } catch (error) {
    console.error('❌ [AGENT] Document upload error:', error);
    
    // 🔒 E2E: No temp files to clean up - all processing done in memory
    // Memory buffers already zeroed out for security
    
    await auditDocumentOperation(req, 'UPLOAD_FAILED', {
      error: error.message
    });
    return sendLocalizedError(res, req.country, 'UPLOAD_FAILED', {
      details: error.message
    }, 500);
  }
}));

// @route   POST /api/agent/process-pending-upload
// @desc    Process pending upload after patient assignment
// @access  Private (requires authentication + practice context)
router.post('/process-pending-upload', 
  generalRateLimit,
  uploadRateLimit,
  requireAuth,
  detectCountry,
  validateRequest,
  sanitizeHeaders,
  sanitizeRequestBody,
  validateProcessUploadInput,
  asyncHandler(async (req, res) => {
  try {
    const { uploadId, patientName } = req.body;

    if (!uploadId || !patientName) {
      return sendLocalizedError(res, req.country, 'UPLOAD_ID_REQUIRED', {}, 400);
    }

    // Get pending upload from database using practice-specific database
    const pendingUploadResults = await SecureDataAccess.query('pendinguploads', {
      uploadId, 
      status: 'pending'
    , limit: 1 }, {}, context);

    const pendingUpload = pendingUploadResults[0];

    if (!pendingUpload) {
      return sendLocalizedError(res, req.country, 'UPLOAD_NOT_FOUND', {}, 404);
    }

    console.log(`🔍 [AGENT] Processing upload ${uploadId} for patient: ${patientName}`);

    // Find patient by name using practice-specific database
    const patientResults = await SecureDataAccess.query('patients', {
      $or: [
        { fullName: new RegExp(patientName, 'i') },
        { 'personalInfo.fullName': new RegExp(patientName, 'i') }
      ]
    }, { limit: 1 }, context);

    const patient = patientResults[0];

    if (!patient) {
      // Log failed patient lookup
      await auditLog(req, 'PATIENT_LOOKUP_FAILED', {
        searchTerm: patientName,
        uploadId: uploadId
      });
      
      return sendLocalizedError(res, req.country, 'PATIENT_NOT_FOUND', {}, 404);
    }

    // Log patient access
    await auditPatientAccess(req, patient, 'ACCESSED_FOR_UPLOAD');
    
    console.log(`👤 [AGENT] Found patient: ${patient.fullName || patient.personalInfo?.fullName}`);

    // Check for duplicate documents BEFORE processing (same as manual upload)
    const DocumentModel = req.models.Document;
    const duplicateErrors = [];
    for (const fileInfo of pendingUpload.files) {
      try {
        const existingDocResults = await SecureDataAccess.query('documentmodels', {
          patientId: patient._id, 
          originalName: fileInfo.originalName
        , limit: 1 }, {}, context);

        const existingDoc = existingDocResults[0];

        if (existingDoc) {
          // Log duplicate detection
          await auditDocumentOperation(req, 'DUPLICATE_DETECTED', {
            fileName: fileInfo.originalName,
            patientId: patient._id,
            existingDocId: existingDoc._id,
            uploadId: uploadId
          });
          
          console.log(`🔄 [AGENT] Duplicate detected: ${fileInfo.originalName} for patient ${patient.name || patient.fullName}`);
          duplicateErrors.push({
            filename: fileInfo.originalName,
            error: 'Duplicate file detected',
            message: getLocalizedError(req.country, 'DUPLICATE_FILE', {
              filename: fileInfo.originalName
            }),
            existingFileId: existingDoc._id,
            existingFileDate: existingDoc.metadata?.uploadDate || existingDoc.createdAt,
            existingFileSize: existingDoc.fileSize
          });
        }
      } catch (checkError) {
        console.error(`❌ [AGENT] Error checking duplicate for ${fileInfo.originalName}:`, checkError);
      }
    }

    // If duplicates found, return error and don't process
    if (duplicateErrors.length > 0) {
      console.log(`❌ [AGENT] Found ${duplicateErrors.length} duplicate file(s), aborting upload`);

      // Update pending upload status to expired (closest valid status for failed)
      pendingUpload.status = 'expired';
      await SecureDataAccess.update('collection', { _id: pendingUpload._id }, pendingUpload, context);

      const message = req.country === 'Israel'
        ? `העלאה נכשלה: זוהו ${duplicateErrors.length} קבצים כפולים. אנא מחק את הקבצים הקיימים תחילה או שנה את שמות הקבצים.`
        : `Upload failed: ${duplicateErrors.length} duplicate file(s) detected. Please delete existing files first or rename your files.`;
      
      return res.status(409).json({
        success: false,
        error: message,
        errorCode: 'DUPLICATE_FILES',
        duplicateErrors: duplicateErrors,
        duplicateCount: duplicateErrors.length,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`✅ [AGENT] No duplicates found, proceeding with processing ${pendingUpload.files.length} file(s)`);

    // Update pending upload status
    pendingUpload.status = 'processing';
    await SecureDataAccess.update('collection', { _id: pendingUpload._id }, pendingUpload, context);

    // Process each encrypted file for the patient
    const results = [];
    for (let i = 0; i < pendingUpload.files.length; i++) {
      const fileInfo = pendingUpload.files[i];
      try {
        // AI-powered file organization
        const organizeFileWithAI = async (filename, mimetype) => {
          const fileName = filename.toLowerCase();
          if (fileName.includes('lab') || fileName.includes('blood')) return 'lab_results';
          else if (fileName.includes('prescription')) return 'prescriptions';
          else if (fileName.includes('discharge')) return 'discharge_summary';
          else if (mimetype === 'application/pdf') return 'documents/pdf';
          return 'miscellaneous';
        };

        const organizedFolder = await organizeFileWithAI(fileInfo.originalName, fileInfo.mimetype);

        // Create document record with encrypted content
        const document = new Document({
          patientId: patient._id,
          fileName: `encrypted_${Date.now()}_${fileInfo.originalName}`,
          originalName: fileInfo.originalName,
          fileType: fileInfo.fileType,
          mimeType: fileInfo.mimetype,
          fileSize: fileInfo.size,
          // Store encrypted content in database
          encryptedContent: fileInfo.encryptedContent,
          contentIv: fileInfo.contentIv,
          contentTag: fileInfo.contentTag,
          organizedFolder: organizedFolder,
          aiClassification: {
            documentType: organizedFolder,
            confidence: 0.8,
            analyzedAt: new Date()
          },
          metadata: {
            uploadedBy: null,
            uploadDate: new Date(),
            uploadSource: 'chat_interface'
          }
        });

        await SecureDataAccess.update('collection', { _id: document._id }, document, context);
        console.log(`💾 [AGENT] Document saved with encrypted content: ${document._id}`);

        // Log successful upload
        await auditDocumentOperation(req, 'UPLOADED', {
          documentId: document._id,
          fileName: fileInfo.originalName,
          fileType: fileInfo.fileType,
          fileSize: fileInfo.size,
          patientId: patient._id,
          uploadId: uploadId,
          encryptionUsed: true
        });

        // Analyze document with AI (will decrypt temporarily for analysis)
        // Pass practice context for practice-specific analysis
        const analysisResults = await analyzeDocumentWithAI(document._id, req.practice?._id || req.session?.practiceId);

        results.push({
          filename: fileInfo.originalName,
          documentId: document._id,
          analysis: analysisResults,
          success: true,
          storageType: 'encrypted_database'
        });

        console.log(`✅ [AGENT] Processed encrypted document: ${fileInfo.originalName}`);

      } catch (error) {
        // Log upload failure
        await auditDocumentOperation(req, 'UPLOAD_FAILED', {
          fileName: fileInfo.originalName,
          patientId: patient._id,
          uploadId: uploadId,
          error: error.message
        });
        
        console.error(`❌ [AGENT] Error processing ${fileInfo.originalName}:`, error);
        results.push({
          filename: fileInfo.originalName,
          error: error.message,
          success: false
        });
      }
    }

    // Clean up pending upload from database
    pendingUpload.status = 'completed';
    await SecureDataAccess.update('collection', { _id: pendingUpload._id }, pendingUpload, context);

    // Delete the pending upload record using SecureDataAccess (files are now in Document collection)
    const finalDeleteContext = {
      serviceId: 'agent-service',
      operation: 'deletePendingUpload',
      practiceId: req.practice?._id || 'global'
    };
    await SecureDataAccess.delete('pendinguploads', { 
      uploadId,
      practiceSubdomain: req.practiceSubdomain // Ensure we only delete from correct practice
    }, finalDeleteContext);

    const successCount = results.filter(r => r.success).length;
    
    // Log upload summary
    await auditDocumentOperation(req, 'UPLOAD_COMPLETED', {
      uploadId: uploadId,
      patientId: patient._id,
      totalFiles: pendingUpload.files.length,
      successfulUploads: successCount,
      failedUploads: pendingUpload.files.length - successCount
    });
    const message = successCount === pendingUpload.files.length
      ? `✅ Successfully processed ${successCount} document(s) for ${patient.fullName || patient.personalInfo?.fullName}`
      : `⚠️ Processed ${successCount}/${pendingUpload.files.length} documents for ${patient.fullName || patient.personalInfo?.fullName}`;

    res.json({
      success: successCount > 0,
      message,
      patientName: patient.fullName || patient.personalInfo?.fullName,
      processedCount: successCount,
      results
    });

  } catch (error) {
    console.error('❌ [AGENT] Process pending upload error:', error);
    await auditDocumentOperation(req, 'UPLOAD_PROCESSING_FAILED', {
      uploadId: uploadId,
      error: error.message
    });
    return sendLocalizedError(res, req.country, 'UPLOAD_FAILED', {
      details: error.message
    }, 500);
  }
}));

// @route   POST /api/agent/cancel-skills-job
// @desc    Cancel a running Skills analysis job
// @access  Private (requires authentication + practice context)
router.post('/cancel-skills-job',
  generalRateLimit,
  requireAuth,
  detectCountry,
  validateRequest,
  sanitizeHeaders,
  sanitizeRequestBody,
  asyncHandler(async (req, res) => {
    try {
      const { jobId } = req.body;

      if (!jobId) {
        return sendLocalizedError(res, req.country, 'JOB_ID_REQUIRED', {}, 400);
      }

      console.log(`🛑 [AGENT] Cancelling Skills job: ${jobId}`);

      // Build context
      const practiceSubdomain = req.headers['x-practice-subdomain'] ||
                               req.headers['x-practice-id'] ||
                               req.practice?.subdomain;

      const context = {
        userId: req.user?._id?.toString(),
        practiceId: practiceSubdomain,
        practiceSubdomain: practiceSubdomain,
        sessionId: req.headers['x-session-id'] || req.body.sessionId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id
      };

      // DEPRECATED: Skills API removed - now using Batch API
      // const skillsJobTracker = require('../services/skillsJobTracker');
      // await skillsJobTracker.markManuallyStopped(jobId);

      // Log the cancellation
      await auditLog(req, 'BATCH_JOB_CANCELLED', {
        jobId: jobId,
        userId: context.userId,
        practice: practiceSubdomain
      });

      return res.json({
        success: true,
        message: req.country === 'Israel'
          ? 'העבודה בוטלה בהצלחה'
          : 'Job cancelled successfully',
        jobId: jobId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ [AGENT] Error cancelling Skills job:', error);
      await auditLog(req, 'SKILLS_JOB_CANCEL_FAILED', {
        error: error.message
      });
      return sendLocalizedError(res, req.country, 'CANCEL_FAILED', {
        details: error.message
      }, 500);
    }
  })
);

// ========================================
// COMPREHENSIVE ERROR HANDLING MIDDLEWARE
// ========================================

// Error handler middleware - must be last
const errorHandler = (error, req, res, next) => {
  console.error('❌ Error handler caught:', error);
  
  // Prevent multiple error responses
  if (res.headersSent) {
    console.error('⚠️ Headers already sent, delegating to default Express error handler');
    return next(error);
  }
  
  // Default error response
  let statusCode = 500;
  let errorKey = 'SYSTEM_ERROR';
  let details = error.message;
  
  // Categorize error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorKey = 'VALIDATION_ERROR';
    details = Object.values(error.errors).map(e => e.message).join(', ');
  } else if (error.name === 'CastError') {
    statusCode = 400;
    errorKey = 'INVALID_ID';
    details = 'Invalid ID format';
  } else if (error.name === 'MongoError' || error.name === 'MongooseError') {
    statusCode = 500;
    errorKey = 'DATABASE_ERROR';
    details = 'Database operation failed';
  } else if (error.name === 'DatabaseError') {
    statusCode = 500;
    errorKey = 'DATABASE_ERROR';
    details = error.message;
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    statusCode = 503;
    errorKey = 'SERVICE_UNAVAILABLE';
    details = 'External service unavailable';
  } else if (error.message && error.message.includes('CORS')) {
    statusCode = 403;
    errorKey = 'CORS_VIOLATION';
  } else if (error.status) {
    statusCode = error.status;
  }
  
  // Log error for monitoring
  const errorLog = {
    timestamp: new Date(),
    method: req.method,
    path: req.path,
    statusCode: statusCode,
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
    userId: req.user?._id,
    practiceId: req.practice?._id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };
  
  // Audit log the error
  if (req.auditLog) {
    req.auditLog('ROUTE_ERROR', errorLog);
  }
  
  // Send localized error response
  const country = req.country || 'United States';
  const errorResponse = createErrorResponse(country, errorKey, { details }, statusCode);
  
  res.status(errorResponse.statusCode).json(errorResponse.response);
};

// @route   POST /api/agent/feedback
// @desc    Collect user feedback on AI responses for self-improvement
// @access  Private (requires authentication + practice context)
router.post('/feedback',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceModels,
  practiceAuth,
  requireAuth,
  validateCSRF,
  asyncHandler(async (req, res) => {
    try {
      const { messageId, sessionId, rating, feedback, improvementSuggestion } = req.body;
      
      if (!messageId || !sessionId) {
        return sendLocalizedError(res, req.country, 'FEEDBACK_PARAMS_REQUIRED', {}, 400);
      }
      
      // Validate rating if provided
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        return sendLocalizedError(res, req.country, 'INVALID_RATING', {}, 400);
      }
      
      // Get the original message to link feedback
      const messageContext = {
        serviceId: 'agent-service',
        operation: 'get-message-for-feedback',
        practiceId: req.practice?._id || 'global'
      };
      
      const messages = await SecureDataAccess.query('chat_messages', {
        messageId: messageId,
        sessionId: sessionId
      }, { limit: 1 }, messageContext);
      
      if (!messages || messages.length === 0) {
        return sendLocalizedError(res, req.country, 'MESSAGE_NOT_FOUND', {}, 404);
      }
      
      const originalMessage = messages[0];
      
      // Determine user role from roles array (same comprehensive mapping)
      const getRoleForLearning = (roles) => {
        if (!roles || !Array.isArray(roles) || roles.length === 0) return 'doctor';
        
        // Priority mapping - check for most specific role first
        // Admin/Management roles → 'admin' learning profile
        if (roles.includes('admin') || 
            roles.includes('medical_director') || 
            roles.includes('compliance_officer')) {
          return 'admin';
        }
        
        // Nursing roles → 'nurse' learning profile
        if (roles.includes('nurse') || 
            roles.includes('nurse_rn') || 
            roles.includes('nurse_lpn')) {
          return 'nurse';
        }
        
        // Administrative/Support roles → 'secretary' learning profile
        if (roles.includes('secretary') || 
            roles.includes('receptionist') || 
            roles.includes('billing') || 
            roles.includes('staff')) {
          return 'secretary';
        }
        
        // Medical/Clinical roles → 'doctor' learning profile
        if (roles.includes('doctor') || 
            roles.includes('doctor_specialist') || 
            roles.includes('physician') || 
            roles.includes('provider') ||
            roles.includes('lab_tech') ||
            roles.includes('technician')) {
          return 'doctor';
        }
        
        // Default to doctor for any unrecognized roles
        return 'doctor';
      };
      
      const userRole = getRoleForLearning(req.user.roles);
      
      // Collect feedback through self-improving memory
      await selfImprovingMemory.collectFeedback({
        userId: req.user.id || req.user._id,
        userRole: userRole,
        practiceId: req.practice?._id || 'global',
        sessionId: sessionId,
        messageId: messageId,
        originalQuery: originalMessage.type === 'agent' ? 'N/A' : originalMessage.content,
        originalResponse: originalMessage.type === 'agent' ? originalMessage.content : 'N/A',
        rating: rating || null,
        feedback: feedback || null,
        improvementSuggestion: improvementSuggestion || null,
        timestamp: new Date()
      });
      
      // Log feedback collection
      if (req.auditLog) {
        req.auditLog('AI_FEEDBACK_COLLECTED', {
          messageId: messageId,
          sessionId: sessionId,
          rating: rating,
          hasFeedback: !!feedback,
          hasSuggestion: !!improvementSuggestion,
          userId: req.user._id,
          userRole: userRole
        });
      }
      
      console.log(`📝 Feedback collected for message ${messageId} (user: ${req.user.id}, role: ${userRole})`);
      
      res.json({
        success: true,
        message: req.country === 'IL' || req.practice?.language === 'he' 
          ? 'תודה על המשוב. זה יעזור לנו להשתפר!'
          : 'Thank you for your feedback. It helps us improve!'
      });
      
    } catch (error) {
      console.error('❌ Error collecting feedback:', error);
      return await handleRouteError(req, res, error, 'FEEDBACK_COLLECTION');
    }
  })
);

// ========================================
// NATURAL LANGUAGE QUERY ENDPOINT
// ========================================

/**
 * Natural Language Query - DISABLED
 * Vector search functionality removed
 */
/* DISABLED - Natural language query route removed
router.post('/natural-query',
  validateCSRF,
  sessionRequireAuth,
  practiceAuth,
  practiceContext,
  rateLimit({
    windowMs: 60 * 1000,
    max: 30, // 30 queries per minute
    keyGenerator: ipKeyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many natural language queries. Try again later.'
  }),
  asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      const { query } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Query parameter is required'
        });
      }

      console.log(`🎯 Natural Language Query: "${query}" (Practice: ${req.practice?.id})`);

      // Execute natural language query
      const result = await naturalLanguageQuery.executeQuery(query, {
        practiceId: req.practice?.id || 'global',
        userId: req.user?.id,
        serviceId: 'agent-route-natural-query'
      });

      const executionTime = Date.now() - startTime;

      if (result.success) {
        console.log(`✅ Natural Language Query completed in ${executionTime}ms`);

        res.json({
          success: true,
          response: result.message,
          data: result.data,
          executionTime,
          queryInfo: result.queryInfo,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log(`❌ Natural Language Query failed: ${result.error}`);

        res.status(400).json({
          success: false,
          error: result.userMessage || result.error,
          executionTime,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('❌ Natural Language Query endpoint error:', error);
      return await handleRouteError(req, res, error, 'NATURAL_LANGUAGE_QUERY');
    }
  })
);
*/ // END DISABLED natural-query route

// ========================================
// VECTOR SEARCH ENDPOINTS
// ========================================

// Vector search service removed

// @route   POST /api/agent/vector-search
// @desc    Perform vector similarity search
// @access  Private (requires authentication + practice context)
router.post('/vector-search',
  generalRateLimit,
  requireAuth,
  practiceContext,
  practiceModels,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { collection, query, limit = 10 } = req.body;

    if (!collection || !query) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'Collection name and query are required'
      });
    }

    const service = new WorkingVectorSearchService();

    try {
      await service.initialize();

      // Ensure test data exists
      await service.ensureTestData(collection);

      // For testing, use a simple embedding (in production, generate real embeddings from query)
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

      const results = await service.vectorSearch(
        collection,
        mockEmbedding,
        limit
      );

      console.log(`🔍 Vector search performed on ${collection} for query: "${query}"`);
      console.log(`   Method: ${results.method}, Results: ${results.count}`);

      res.json({
        success: results.success,
        results: results.results || [],
        count: results.count || 0,
        method: results.method,
        totalDocuments: results.totalDocuments,
        query: query,
        error: results.error
      });

    } catch (error) {
      console.error('❌ Vector search error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Vector search failed',
        message: error.message
      });
    } finally {
      await service.close();
    }
  })
);

// @route   POST /api/agent/vector-index
// @desc    Create a vector search index
// @access  Private (requires authentication + practice context)
router.post('/vector-index',
  generalRateLimit,
  requireAuth,
  practiceContext,
  practiceModels,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { collection, field = 'embedding', dimensions = 1536, similarity = 'cosine' } = req.body;

    if (!collection) {
      return res.status(400).json({
        success: false,
        error: 'Missing collection name'
      });
    }

    const service = new WorkingVectorSearchService();

    try {
      await service.initialize();

      const indexName = `${collection}_vector`;
      const result = await service.createVectorIndex(
        collection,
        indexName,
        field,
        dimensions,
        similarity
      );

      console.log(`📝 Vector index creation attempted for ${collection}:`, result.success);

      res.json({
        success: result.success,
        indexName: indexName,
        result: result.result,
        error: result.primaryError || result.error,
        troubleshooting: result.troubleshooting
      });

    } catch (error) {
      console.error('❌ Vector index creation error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to create vector index',
        message: error.message
      });
    } finally {
      await service.close();
    }
  })
);

// @route   GET /api/agent/vector-indexes/:collection
// @desc    List vector search indexes for a collection
// @access  Private (requires authentication + practice context)
router.get('/vector-indexes/:collection',
  generalRateLimit,
  requireAuth,
  practiceContext,
  practiceModels,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { collection } = req.params;

    if (!collection) {
      return res.status(400).json({
        success: false,
        error: 'Missing collection name'
      });
    }

    const service = new WorkingVectorSearchService();

    try {
      await service.initialize();

      const result = await service.listSearchIndexes(collection);

      console.log(`📋 Listed vector indexes for ${collection}:`, result.success);

      res.json({
        success: result.success,
        collection: collection,
        indexes: result.indexes || [],
        error: result.error
      });

    } catch (error) {
      console.error('❌ List vector indexes error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to list vector indexes',
        message: error.message
      });
    } finally {
      await service.close();
    }
  })
);

// @route   GET /api/agent/vector-status
// @desc    Get vector search service status
// @access  Private (requires authentication + practice context)
router.get('/vector-status',
  generalRateLimit,
  requireAuth,
  practiceContext,
  practiceModels,
  validateRequest,
  asyncHandler(async (req, res) => {
    const service = new WorkingVectorSearchService();

    try {
      await service.initialize();
      const status = await service.getStatus();

      console.log('📊 Vector search service status checked');

      res.json({
        success: status.success,
        status: status.status,
        troubleshooting: status.troubleshooting,
        error: status.error
      });

    } catch (error) {
      console.error('❌ Vector status check error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to check vector service status',
        message: error.message
      });
    } finally {
      await service.close();
    }
  })
);

// ========================================
// PERMISSION CHECK MIDDLEWARE
// ========================================

/**
 * Middleware to check if user has specific permission
 * @param {string} permission - Permission to check (e.g., 'read:vital_signs')
 * @returns {Function} Express middleware function
 */
const checkPermission = (permission) => {
  return (req, res, next) => {
    const userPermissions = req.user?.permissions || [];

    // system_admin bypasses all checks
    if (!userPermissions.includes('system_admin') && !userPermissions.includes(permission)) {
      if (req.auditLog) {
        req.auditLog('PERMISSION_DENIED', {
          permission,
          user: req.user?.email || req.session?.user?.email,
          granted: false
        });
      }
      return res.status(403).json({
        success: false,
        error: `Permission denied: '${permission}' required`
      });
    }

    // Log successful permission check for audit trail
    if (req.auditLog) {
      req.auditLog('PERMISSION_GRANTED', {
        permission,
        user: req.user?.email || req.session?.user?.email,
        granted: true
      });
    }

    next();
  };
};

// ========================================
// INDIVIDUAL MEDICAL DATA ROUTES (SECURE)
// Each route has specific permission check for HIPAA compliance
// ========================================

// Helper function for medical data routes
const createMedicalDataRoute = (category, functionName, permission) => {
  return asyncHandler(async (req, res) => {
    try {
      const { patientId } = req.params;
      const queryParams = req.query || {};

      console.log(`🏥 [${category}] Fetching for patient ${patientId}`);
      console.log(`🔍 [${category}] Full URL: ${req.originalUrl}`);
      console.log(`🔍 [${category}] req.params:`, req.params);

      // Import services
      const agentServiceV4 = require('../services/agentServiceV4');
      const medicalDataService = require('../services/medicalDataService');
      const gridLoader = require('../services/gridMappings/gridLoader');
      const { ObjectId } = require('mongodb');

      // Build security context
      const context = {
        serviceId: 'agent-routes',
        operation: category,
        practiceId: req.practice?.id || 'global',
        practiceSubdomain: req.practice?.subdomain || req.practiceContext?.subdomain,
        sessionId: req.sessionID
      };

      // If specialized function exists and is using SecureDataAccess, call it
      // Otherwise use generic medical data service
      let result;

      if (functionName && agentServiceV4[functionName]) {
        // Call specialized function
        result = await agentServiceV4[functionName](
          { patientId, ...queryParams },
          req.practiceContext,
          req.session
        );

        // Format result with grid loader if data exists
        if (result.success && result.data && result.data.length > 0) {
          // Initialize medicalDataService if needed (for API key)
          if (!medicalDataService.initialized) {
            await medicalDataService.initialize(context);
          }

          // Build context with API key for grid mapper (specialized function path)
          const gridContext = {
            ...context,
            serviceId: 'medical-data-service',
            apiKey: medicalDataService.serviceToken || context.apiKey
          };

          const gridConfig = await gridLoader.getGridConfig(category, result.data, gridContext);
          if (gridConfig) {
            result = {
              ...result,
              ...gridConfig
            };
          }
        }
      } else {
        // Use generic medical data service
        const patientIdObj = typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
          ? new ObjectId(patientId)
          : patientId;

        // Initialize medicalDataService if needed
        if (!medicalDataService.initialized) {
          await medicalDataService.initialize(context);
        }

        // Get data from collection
        const data = await medicalDataService.getMedicalData(category, patientIdObj, {}, context);

        if (!data || data.length === 0) {
          return res.json({
            success: true,
            data: [],
            count: 0,
            message: `No ${category} data found`
          });
        }

        // Build context with API key for grid mapper
        const gridContext = {
          ...context,
          serviceId: 'medical-data-service',
          apiKey: medicalDataService.serviceToken
        };

        // Format with grid loader
        const gridConfig = await gridLoader.getGridConfig(category, data, gridContext);

        if (!gridConfig) {
          return res.status(500).json({
            success: false,
            error: `No grid configuration found for category: ${category}`
          });
        }

        result = {
          success: true,
          ...gridConfig,
          count: data.length
        };
      }

      console.log(`✅ [${category}] Returning ${result.data?.length || 0} records`);
      return res.json(result);

    } catch (error) {
      console.error(`❌ [${category}] Error:`, error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
};

// Helper function for document data routes (returns raw nested data, NO grid formatting)
const createDocumentDataRoute = (category, permission) => {
  return asyncHandler(async (req, res) => {
    try {
      const { patientId } = req.params;

      console.log(`📄 [${category}] Fetching DOCUMENT data for patient ${patientId}`);

      // Import services
      const medicalDataService = require('../services/medicalDataService');
      const { ObjectId } = require('mongodb');

      // Build security context
      const context = {
        serviceId: 'agent-routes',
        operation: category,
        practiceId: req.practice?.id || 'global',
        practiceSubdomain: req.practice?.subdomain || req.practiceContext?.subdomain,
        sessionId: req.sessionID
      };

      // Convert patientId to ObjectId if needed
      const patientIdObj = typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
        ? new ObjectId(patientId)
        : patientId;

      // Initialize medicalDataService if needed
      if (!medicalDataService.initialized) {
        await medicalDataService.initialize(context);
      }

      // Get RAW data from collection (NO grid formatting)
      const data = await medicalDataService.getMedicalData(category, patientIdObj, {}, context);

      if (!data || data.length === 0) {
        return res.json({
          success: true,
          data: [],
          count: 0,
          message: `No ${category} data found`
        });
      }

      // Return raw nested data WITHOUT any grid formatting
      console.log(`✅ [${category}] Returning ${data.length} raw document records`);
      return res.json({
        success: true,
        data: data,
        count: data.length
      });

    } catch (error) {
      console.error(`❌ [${category}] Document route error:`, error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
};

// Administrative Data
router.get('/administrative-data/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:administrative_data'),
  createMedicalDataRoute('administrative_data', null, 'read:administrative_data')
);

// Allergies
router.get('/allergies/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:allergies'),
  createMedicalDataRoute('allergies', 'getAllergies', 'read:allergies')
);

// Diagnoses
router.get('/diagnoses/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:diagnoses'),
  createMedicalDataRoute('diagnoses', null, 'read:diagnoses')
);

// Medications (DOCUMENT MODE - for Artifact Panel template)
router.get('/medications/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medications'),
  asyncHandler(async (req, res) => {
    try {
      const { patientId } = req.params;
      console.log(`💊 [medications] Fetching for patient ${patientId} (DOCUMENT MODE)`);

      // Import services
      const medicalDataService = require('../services/medicalDataService');
      const { ObjectId } = require('mongodb');

      // Build security context
      const context = {
        serviceId: 'agent-routes',
        operation: 'medications',
        practiceId: req.practice?.id || 'global',
        practiceSubdomain: req.practice?.subdomain || req.practiceContext?.subdomain,
        sessionId: req.sessionID
      };

      // Convert patientId to ObjectId
      const patientIdObj = typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
        ? new ObjectId(patientId)
        : patientId;

      // Initialize medicalDataService if needed
      if (!medicalDataService.initialized) {
        await medicalDataService.initialize(context);
      }

      // Get raw data from medications collection
      const medications = await medicalDataService.getMedicalData('medications', patientIdObj, {}, context);

      if (!medications || medications.length === 0) {
        return res.json({
          success: true,
          data: { medications: [] },
          count: 0,
          message: 'No medications found'
        });
      }

      // Wrap in document format for Artifact Panel template
      console.log(`✅ [medications] Returning ${medications.length} medications in document format`);
      return res.json({
        success: true,
        data: {
          medications: medications
        },
        count: medications.length
      });

    } catch (error) {
      console.error('❌ [medications] Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  })
);

// Lab Results
router.get('/lab-results/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:lab_results'),
  createMedicalDataRoute('lab_results', 'getLabResults', 'read:lab_results')
);

// Vital Signs
router.get('/vital-signs/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:vital_signs'),
  createMedicalDataRoute('vital_signs', 'getVitalSigns', 'read:vital_signs')
);

// Chief Complaints
router.get('/chief-complaints/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:chief_complaints'),
  createMedicalDataRoute('chief_complaints', null, 'read:chief_complaints')
);

// Physical Examinations
router.get('/physical-examinations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:physical_examinations'),
  createMedicalDataRoute('physical_examinations', null, 'read:physical_examinations')
);

// Social History
router.get('/social-history/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:social_history'),
  createMedicalDataRoute('social_history', null, 'read:social_history')
);

// ========================================
// DOCUMENT MODE ROUTES (Raw nested data for AI collections)
// ========================================

// Clinical Decision Support - DOCUMENT MODE
router.get('/documents/clinical-decision-support/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:clinical_decision_support'),
  createDocumentDataRoute('clinical_decision_support', 'read:clinical_decision_support')
);

// Intelligent Recommendations - DOCUMENT MODE
router.get('/documents/intelligent-recommendations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:intelligent_recommendations'),
  createDocumentDataRoute('intelligent_recommendations', 'read:intelligent_recommendations')
);

// Trending Analysis - DOCUMENT MODE
router.get('/documents/trending-analysis/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:trending_analysis'),
  createDocumentDataRoute('trending_analysis', 'read:trending_analysis')
);

// Patient Specific Care Plan - DOCUMENT MODE
router.get('/documents/patient-specific-care-plan/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_specific_care_plan'),
  createDocumentDataRoute('patient_specific_care_plan', 'read:patient_specific_care_plan')
);

// Medication Optimization - DOCUMENT MODE
router.get('/documents/medication-optimization/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medications_optimizations'),
  createDocumentDataRoute('medications_optimizations', 'read:medications_optimizations')
);

// Follow-up Intelligence - DOCUMENT MODE
router.get('/documents/follow-up-intelligence/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:follow_up_intelligence'),
  createDocumentDataRoute('follow_up_intelligence', 'read:follow_up_intelligence')
);

// Patient Education Context - DOCUMENT MODE
router.get('/documents/patient-education-context/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_education_context'),
  createDocumentDataRoute('patient_education_context', 'read:patient_education_context')
);

// Guideline Compliance/Quality Metrics - DOCUMENT MODE
router.get('/documents/guideline-compliance/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:guideline_compliance'),
  createDocumentDataRoute('guideline_compliance', 'read:guideline_compliance')
);

// Allergy Assessment - DOCUMENT MODE
router.get('/documents/allergy-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:allergy_assessment'),
  createDocumentDataRoute('allergy_assessment', 'read:allergy_assessment')
);

// Allergy Immunology Assessment - DOCUMENT MODE
router.get('/documents/allergy-immunology-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:allergy_immunology_assessment'),
  createDocumentDataRoute('allergy_immunology_assessment', 'read:allergy_immunology_assessment')
);

// ========================================
// GRID MODE ROUTES (Grid-formatted data for tables)
// ========================================

// Clinical Decision Support (AI Generated)
router.get('/clinical-decision-support/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:clinical_decision_support'),
  createMedicalDataRoute('clinical_decision_support', null, 'read:clinical_decision_support')
);

// Intelligent Recommendations (AI Generated)
router.get('/intelligent-recommendations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:intelligent_recommendations'),
  createMedicalDataRoute('intelligent_recommendations', null, 'read:intelligent_recommendations')
);

// Trending Analysis (AI Generated)
router.get('/trending-analysis/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:trending_analysis'),
  createMedicalDataRoute('trending_analysis', null, 'read:trending_analysis')
);

// Patient Specific Care Plan (AI Generated)
router.get('/patient-specific-care-plan/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_specific_care_plan'),
  createMedicalDataRoute('patient_specific_care_plan', null, 'read:patient_specific_care_plan')
);

// Medication Optimization (AI Generated)
router.get('/medication-optimization/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medications_optimizations'),
  createMedicalDataRoute('medications_optimizations', null, 'read:medications_optimizations')
);

// Doctor's Medications Recommendations
router.get('/doctors-medications-recommendations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:doctors_medications_recommendations'),
  createMedicalDataRoute('doctors_medications_recommendations', null, 'read:doctors_medications_recommendations')
);

// Allergy Assessment
router.get('/allergy-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:allergy_assessment'),
  createMedicalDataRoute('allergy_assessment', null, 'read:allergy_assessment')
);

// Doctor's Medications Recommendations Optimizations (AI Generated)
router.get('/doctors-medications-recommendations-optimizations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:doctors_medications_recommendations_optimizations'),
  createMedicalDataRoute('doctors_medications_recommendations_optimizations', null, 'read:doctors_medications_recommendations_optimizations')
);

// Follow-up Intelligence (AI Generated)
router.get('/follow-up-intelligence/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:follow_up_intelligence'),
  createMedicalDataRoute('follow_up_intelligence', null, 'read:follow_up_intelligence')
);

// Patient Education Context (AI Generated)
router.get('/patient-education-context/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_education_context'),
  createMedicalDataRoute('patient_education_context', null, 'read:patient_education_context')
);

// Guideline Compliance (AI Generated)
router.get('/guideline-compliance/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:guideline_compliance'),
  createMedicalDataRoute('guideline_compliance', null, 'read:guideline_compliance')
);

// Care Gaps & Screening (AI Generated)
router.get('/care-gaps/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:care_gaps'),
  createMedicalDataRoute('care_gaps', null, 'read:care_gaps')
);

// Outcomes Prediction (AI Generated)
router.get('/outcomes-prediction/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:outcomes_prediction'),
  createMedicalDataRoute('outcomes_prediction', null, 'read:outcomes_prediction')
);

// Additional medical data categories (continuing...)

// Medical Procedures
router.get('/medical-procedures/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medical_procedures'),
  createMedicalDataRoute('medical_procedures', null, 'read:medical_procedures')
);

// Hospital Course
router.get('/hospital-course/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hospital_course'),
  createMedicalDataRoute('hospital_course', null, 'read:hospital_course')
);

// Discharge Planning
router.get('/discharge-planning/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:discharge_planning'),
  createMedicalDataRoute('discharge_planning', null, 'read:discharge_planning')
);

// Patient Education Records
router.get('/patient-education-records/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_education_records'),
  createMedicalDataRoute('patient_education_records', null, 'read:patient_education_records')
);

// Follow-up Appointments
router.get('/follow-up-appointments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:follow_up_appointments'),
  createMedicalDataRoute('follow_up_appointments', null, 'read:follow_up_appointments')
);

// Imaging Results
router.get('/imaging-results/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:imaging_results'),
  createMedicalDataRoute('imaging_results', 'getImagingResults', 'read:imaging_results')
);

// Prescriptions
router.get('/prescriptions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:prescriptions'),
  createMedicalDataRoute('prescriptions', 'getPrescriptions', 'read:prescriptions')
);

// Vaccinations
router.get('/vaccinations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:vaccinations'),
  createMedicalDataRoute('vaccinations', 'getVaccinations', 'read:vaccinations')
);

// Referrals
router.get('/referrals/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:referrals'),
  createMedicalDataRoute('referrals', 'getReferrals', 'read:referrals')
);

// Documents (Medical Documents)
router.get('/documents/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:documents'),
  createMedicalDataRoute('documents', 'getDocuments', 'read:documents')
);

// Additional categories from medical data extraction...

// Home Monitoring
router.get('/home-monitoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:home_monitoring'),
  createMedicalDataRoute('home_monitoring', null, 'read:home_monitoring')
);

// Trend Analysis
router.get('/trend-analysis/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:trend_analysis'),
  createMedicalDataRoute('trend_analysis', null, 'read:trend_analysis')
);

// Providers
router.get('/providers/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:providers'),
  createMedicalDataRoute('providers', null, 'read:providers')
);

// Vital Signs Table
router.get('/vital-signs-table/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:vital_signs_table'),
  createMedicalDataRoute('vital_signs_table', null, 'read:vital_signs_table')
);

// @route   POST /api/agent/medical-category-data
// @desc    DEPRECATED - Use individual routes above for security
// @access  Private (requires authentication + practice context)
router.post('/medical-category-data',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const { category, patientId, patientName } = req.body;

      if (!category) {
        return res.status(400).json({
          success: false,
          error: 'Category is required'
        });
      }

      console.log(`🏥 [medical-category-data] Fetching ${category} for patient ${patientName || patientId}`);

      // Import services
      const agentServiceV4 = require('../services/agentServiceV4');
      const medicalDataService = require('../services/medicalDataService');
      const gridLoader = require('../services/gridMappings/gridLoader');
      const { ObjectId } = require('mongodb');

      // Build security context
      const context = {
        serviceId: 'agent-routes',
        operation: 'medical-category-data',
        practiceId: req.practice?.id || 'global',
        practiceSubdomain: req.practice?.subdomain || req.practiceContext?.subdomain,
        sessionId: req.sessionID
      };

      // Resolve patient ID if needed (for both specialized and generic paths)
      let resolvedPatientId = patientId;
      if (!resolvedPatientId && patientName) {
        const searchResult = await agentServiceV4.searchPatients(
          { query: patientName },
          req.practiceContext,
          req.session
        );
        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          resolvedPatientId = searchResult.data[0].patientId;
        }
      }

      if (!resolvedPatientId) {
        return res.status(400).json({
          success: false,
          error: 'Patient not found'
        });
      }

      // Use generic medical data service + grid loader for all categories
      console.log(`📋 Using generic query for: ${category}`);

      // Convert to ObjectId if needed
      console.log(`🔍 [DEBUG] resolvedPatientId type: ${typeof resolvedPatientId}, value: ${resolvedPatientId}`);
      const patientIdObj = typeof resolvedPatientId === 'string' && resolvedPatientId.match(/^[0-9a-fA-F]{24}$/)
        ? new ObjectId(resolvedPatientId)
        : resolvedPatientId;
      console.log(`🔍 [DEBUG] patientIdObj type: ${typeof patientIdObj}, value: ${patientIdObj}, isObjectId: ${patientIdObj instanceof ObjectId}`);

      // Initialize medicalDataService if needed
      if (!medicalDataService.initialized) {
        await medicalDataService.initialize(context);
      }

      // Get data from collection
      const data = await medicalDataService.getMedicalData(category, patientIdObj, {}, context);

      if (!data || data.length === 0) {
        return res.json({
          success: true,
          data: [],
          count: 0,
          message: `No ${category} data found`,
          gridFormat: true
        });
      }

      // Build context with API key for grid mapper
      const gridContext = {
        ...context,
        serviceId: 'medical-data-service',
        apiKey: medicalDataService.serviceToken
      };

      // Format with grid loader
      const gridConfig = await gridLoader.getGridConfig(category, data, gridContext);

      if (!gridConfig) {
        return res.status(500).json({
          success: false,
          error: `No grid configuration found for category: ${category}`
        });
      }

      const result = {
        success: true,
        ...gridConfig,
        count: data.length
      };

      console.log(`✅ [medical-category-data] Returning ${result.data?.length || 0} records for ${category}`);
      return res.json(result);

    } catch (error) {
      console.error('❌ [medical-category-data] Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  })
);

// ========================================
// ARTIFACT PANEL ENDPOINTS
// New endpoints for artifact-style document viewer
// ========================================

/**
 * Get available medical data categories for a patient
 * Returns list of categories with document counts
 *
 * GET /api/agent/patient/:patientId/categories
 */
router.get('/patient/:patientId/categories',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_data'),
  async (req, res) => {
    try {
      const { patientId } = req.params;

      console.log(`📋 [artifact-categories] Getting categories for patient ${patientId}`);

      // Validate patientId before processing
      if (!patientId || patientId === 'null' || patientId === 'undefined') {
        console.error(`❌ [artifact-categories] Invalid patientId: ${patientId}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid patient ID - patientId is required'
        });
      }

      // Validate ObjectId format
      const { ObjectId } = require('mongodb');
      const mongoose = require('mongoose');

      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        console.error(`❌ [artifact-categories] Invalid ObjectId format: ${patientId}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid patient ID format'
        });
      }

      // CRITICAL: Convert to MongoDB ObjectId (not Mongoose ObjectId)
      // SecureDataAccess requires native MongoDB ObjectIds for queries
      const patientObjectId = new ObjectId(patientId);

      const context = {
        serviceId: 'agent-route',
        operation: 'get_categories',
        // CRITICAL: Use practiceSubdomain as practiceId for database routing
        // SecureDataAccess uses practiceId to determine which database to query
        practiceId: req.practice?.subdomain || req.practiceContext?.subdomain || 'global',
        practiceSubdomain: req.practice?.subdomain || req.practiceContext?.subdomain,
        sessionId: req.sessionID
      };

      // NEW: Query unified_medical_documents collection grouped by category
      // This replaces the old approach of querying 190+ individual collections
      console.log(`⚡ [artifact-categories] Querying unified_medical_documents for patient ${patientObjectId}`);
      console.log(`⚡ [artifact-categories] PatientId type: ${typeof patientObjectId}, value: ${patientObjectId}`);
      console.log(`⚡ [artifact-categories] Is ObjectId instance: ${patientObjectId.constructor.name}`);
      console.log(`⚡ [artifact-categories] Context being passed to SecureDataAccess:`, JSON.stringify(context, null, 2));

      const categoryCounts = await SecureDataAccess.aggregate(
        'unified_medical_documents',
        [
          // patientId is stored as a string in unified_medical_documents in some
          // imports and as an ObjectId in others — match both (additive, safe).
          { $match: { patientId: { $in: [patientObjectId, patientId] } } },
          { $group: {
              _id: '$category',
              count: { $sum: 1 },
              lastUpdated: { $max: '$documentDate' }
            }
          },
          { $project: {
              name: '$_id',
              count: 1,
              lastUpdated: 1,
              _id: 0
            }
          }
        ],
        context
      );

      console.log(`⚡ [artifact-categories] SecureDataAccess.aggregate() completed`);

      console.log(`⚡ [artifact-categories] Aggregation returned ${categoryCounts ? categoryCounts.length : 0} results`);

      if (!categoryCounts || categoryCounts.length === 0) {
        console.log('ℹ️ [artifact-categories] No medical documents found for patient');
        return res.json({
          success: true,
          patientId,
          categories: [],
          total: 0
        });
      }

      console.log(`✅ [artifact-categories] Found ${categoryCounts.length} categories from unified_medical_documents`);


      // Format categories with metadata
      const { getDisplayMode } = require('../services/gridMappings/collectionDisplayConfig');

      const categories = categoryCounts.map(({ name, count, lastUpdated }) => {
        const metadata = getCategoryMetadata(name);
        return {
          name,
          displayName: metadata.displayName,
          description: metadata.description,
          icon: metadata.icon,
          count,
          displayMode: getDisplayMode(name),  // 'grid' or 'document'
          lastUpdated: lastUpdated || null
        };
      }).sort((a, b) => {
        // Sort alphabetically by display name
        return a.displayName.localeCompare(b.displayName);
      });

      console.log(`✅ [artifact-categories] Found ${categories.length} categories with data`);

      res.json({
        success: true,
        patientId,
        categories,
        total: categories.length
      });

    } catch (error) {
      // Safe error logging - prevent crashes in error handling
      try {
        console.error('❌ [artifact-categories] Error:', error.message || error);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
      } catch (logError) {
        console.error('Error in error logging:', logError);
      }

      // Return user-friendly error message
      res.status(500).json({
        success: false,
        error: req.language === 'he'
          ? 'אירעה שגיאה בטעינת הקטגוריות. אנא נסה שוב.'
          : 'An error occurred loading categories. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * Get list of documents in a specific category for a patient
 * Returns documents sorted by date (newest first)
 *
 * GET /api/agent/patient/:patientId/category/:categoryName
 */
router.get('/patient/:patientId/category/:categoryName',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_data'),
  async (req, res) => {
    try {
      const { patientId, categoryName } = req.params;

      console.log(`📄 [artifact-documents] Getting documents for patient ${patientId}, category ${categoryName}`);

      const mongoose = require('mongoose');
      const { ObjectId } = require('mongodb');

      const context = {
        serviceId: 'agent-route',
        operation: 'get_documents',
        // CRITICAL: Use practiceSubdomain as practiceId for database routing
        practiceId: req.practice?.subdomain || req.practiceContext?.subdomain || 'global',
        practiceSubdomain: req.practice?.subdomain || req.practiceContext?.subdomain,
        sessionId: req.sessionID
      };

      // Resolve patientId - could be ObjectId, SSN, nationalId, or name
      let patientObjectId;

      // Check if it's already a valid 24-char hex ObjectId
      if (patientId.match(/^[0-9a-fA-F]{24}$/)) {
        patientObjectId = new mongoose.Types.ObjectId(patientId);
      } else {
        // Not an ObjectId - need to search for patient by identifier
        console.log(`🔍 [artifact-documents] Resolving patient identifier: ${patientId}`);

        const patientQuery = {};

        // Check if it's SSN format (US - contains dashes or 9 digits)
        if (patientId.match(/^\d{3}-\d{2}-\d{4}$/) || patientId.match(/^\d{9}$/)) {
          patientQuery.ssn = patientId;
        }
        // Check if it's Israeli national ID (9 digits, no dashes)
        else if (patientId.match(/^\d{9}$/)) {
          patientQuery.nationalId = patientId;
        }
        // Otherwise treat as name
        else {
          patientQuery.$or = [
            { firstName: { $regex: patientId, $options: 'i' } },
            { lastName: { $regex: patientId, $options: 'i' } }
          ];
        }

        const patients = await SecureDataAccess.query('patients', patientQuery, { limit: 1 }, context);

        if (!patients || patients.length === 0) {
          return res.status(404).json({
            success: false,
            error: `Patient not found with identifier: ${patientId}`
          });
        }

        patientObjectId = patients[0]._id;
        console.log(`✅ [artifact-documents] Resolved to patient ObjectId: ${patientObjectId}`);
      }

      // SPECIAL CASE: "full_report" - show ALL unified documents for this patient
      if (categoryName === 'full_report') {
        console.log(`📋 [artifact-documents] Fetching ALL unified documents (full report) for patient ${patientObjectId}`);

        const documents = await SecureDataAccess.query(
          'unified_medical_documents',
          {
            patientId: patientObjectId
          },
          {
            sort: { documentDate: -1 },  // Newest first
            limit: 100
          },
          context
        );

        // Format documents for list view
        const formattedDocs = documents.map((doc, index) => ({
          _id: doc._id.toString(),
          date: doc.documentDate || doc.createdAt || new Date(),
          category: doc.category,  // Include category for filtering
          title: generateDocumentTitle(doc.documentData || doc, doc.category),
          preview: generateDocumentPreview(doc.documentData || doc, doc.category),
          isLatest: index === 0  // First doc is latest
        }));

        console.log(`✅ [artifact-documents] Found ${formattedDocs.length} total documents (full report)`);

        return res.json({
          success: true,
          patientId,
          category: 'full_report',
          categoryDisplay: 'Full Report (All Data)',
          total: formattedDocs.length,
          documents: formattedDocs
        });
      }

      // Validate category exists (singleton instance)
      const medicalCollectionsService = require('../services/medicalCollectionsService');

      // Skip validation for unified_medical_documents categories (they're dynamic based on PDF type)
      // These categories come from the actual 'category' field in unified_medical_documents
      if (!medicalCollectionsService.allCollections.includes(categoryName)) {
        console.log(`⚠️ [artifact-documents] Category "${categoryName}" not in collections service - checking if it's a unified document category`);

        // Check if this category exists in unified_medical_documents
        const unifiedDocsCount = await SecureDataAccess.query(
          'unified_medical_documents',
          {
            patientId: patientObjectId,
            category: categoryName
          },
          {
            limit: 1
          },
          context
        );

        if (!unifiedDocsCount || unifiedDocsCount.length === 0) {
          return res.status(400).json({
            success: false,
            error: `Invalid category: ${categoryName}`
          });
        }

        console.log(`✅ [artifact-documents] Category "${categoryName}" found in unified_medical_documents - proceeding`);
      }

      // GRANULAR COLLECTIONS: Special handling for medications, allergies, etc.
      // These collections don't have "documents" - they're live data views
      const GRANULAR_COLLECTIONS = ['medications', 'allergies', 'lab_results', 'vital_signs', 'medical_procedures'];

      if (GRANULAR_COLLECTIONS.includes(categoryName)) {
        console.log(`💊 [artifact-documents] Handling granular collection: ${categoryName}`);

        // Check if patient has any records in this collection
        const medicalDataService = require('../services/medicalDataService');

        // Initialize if needed
        if (!medicalDataService.initialized) {
          await medicalDataService.initialize(context);
        }

        // Get count of records
        const records = await medicalDataService.getMedicalData(categoryName, patientObjectId, {}, context);
        const count = records ? records.length : 0;

        console.log(`✅ [artifact-documents] Found ${count} ${categoryName} records`);

        // Return single synthetic "document" representing the live collection view
        const metadata = getCategoryMetadata(categoryName);
        const syntheticDoc = {
          _id: 'synthetic-' + patientId + '-' + categoryName,  // Synthetic ID
          date: new Date(),  // Use current date as these are "live" views
          title: `${metadata.displayName} (${count})`,
          preview: `${count} ${categoryName.replace(/_/g, ' ')} on file`,
          isLatest: true  // Always latest since it's a live view
        };

        return res.json({
          success: true,
          patientId,
          category: categoryName,
          categoryDisplay: metadata.displayName,
          total: 1,  // Always 1 "document" for granular collections
          documents: [syntheticDoc]
        });
      }

      // UNIFIED DOCUMENTS: Normal path for documents from unified_medical_documents
      const documents = await SecureDataAccess.query(
        'unified_medical_documents',
        {
          patientId: patientObjectId,
          category: categoryName
        },
        {
          sort: { documentDate: -1 },  // Newest first
          limit: 100
        },
        context
      );

      // Format documents for list view
      const formattedDocs = documents.map((doc, index) => ({
        _id: doc._id.toString(),
        date: doc.documentDate || doc.createdAt || new Date(),
        title: generateDocumentTitle(doc.documentData || doc, categoryName),
        preview: generateDocumentPreview(doc.documentData || doc, categoryName),
        isLatest: index === 0  // First doc is latest
      }));

      const metadata = getCategoryMetadata(categoryName);

      console.log(`✅ [artifact-documents] Found ${formattedDocs.length} documents in ${categoryName}`);

      res.json({
        success: true,
        patientId,
        category: categoryName,
        categoryDisplay: metadata.displayName,
        total: formattedDocs.length,
        documents: formattedDocs
      });

    } catch (error) {
      // Safe error logging - prevent crashes in error handling
      try {
        console.error('❌ [artifact-documents] Error:', error.message || error);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
      } catch (logError) {
        console.error('Error in error logging:', logError);
      }

      // Return user-friendly error message
      res.status(500).json({
        success: false,
        error: req.language === 'he'
          ? 'אירעה שגיאה בטעינת המסמכים. אנא נסה שוב.'
          : 'An error occurred loading documents. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * Get full document detail for a specific document
 * Returns complete document data for rendering
 *
 * GET /api/agent/patient/:patientId/category/:categoryName/document/:documentId
 */
router.get('/patient/:patientId/category/:categoryName/document/:documentId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_data'),
  async (req, res) => {
    try {
      const { patientId, categoryName, documentId } = req.params;

      console.log(`📑 [artifact-detail] Getting document ${documentId} for patient ${patientId}, category ${categoryName}`);

      const context = {
        serviceId: 'agent-route',
        operation: 'get_document',
        // CRITICAL: Use practiceSubdomain as practiceId for database routing
        practiceId: req.practice?.subdomain || req.practiceContext?.subdomain || 'global',
        practiceSubdomain: req.practice?.subdomain || req.practiceContext?.subdomain,
        sessionId: req.sessionID
      };

      // Validate category exists (singleton instance)
      const medicalCollectionsService = require('../services/medicalCollectionsService');

      if (!medicalCollectionsService.allCollections.includes(categoryName)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category: ${categoryName}`
        });
      }

      // Import ObjectId and mongoose
      const { ObjectId } = require('mongodb');
      const mongoose = require('mongoose');

      // Check if this is a synthetic document ID for granular collections
      const isSyntheticId = documentId.startsWith('synthetic-');

      // Validate documentId format (skip for synthetic IDs)
      if (!isSyntheticId && !ObjectId.isValid(documentId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid document ID format'
        });
      }

      // Validate patientId format before converting to ObjectId
      if (!ObjectId.isValid(patientId)) {
        console.error(`❌ [artifact-detail] Invalid patientId format: ${patientId}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid patient ID format'
        });
      }

      // Convert patientId string to ObjectId
      const patientObjectId = new mongoose.Types.ObjectId(patientId);

      // GRANULAR COLLECTIONS: Special handling for medications, allergies, etc.
      // These are stored as individual records, not unified documents
      const GRANULAR_COLLECTIONS_LOCAL = ['medications', 'allergies', 'lab_results', 'vital_signs', 'medical_procedures'];

      if (GRANULAR_COLLECTIONS_LOCAL.includes(categoryName)) {
        console.log(`💊 [artifact-detail] Handling granular collection: ${categoryName}`);

        // Fetch all records for this patient from the granular collection
        const medicalDataService = require('../services/medicalDataService');

        // Initialize if needed
        if (!medicalDataService.initialized) {
          await medicalDataService.initialize(context);
        }

        // Get all records for this category
        const records = await medicalDataService.getMedicalData(categoryName, patientObjectId, {}, context);

        if (!records || records.length === 0) {
          return res.status(404).json({
            success: false,
            error: `No ${categoryName} found for this patient`
          });
        }

        console.log(`✅ [artifact-detail] Retrieved ${records.length} ${categoryName} records`);

        // Return synthetic document structure
        return res.json({
          success: true,
          patientId,
          category: categoryName,
          document: {
            _id: 'synthetic-' + patientId + '-' + categoryName,  // Synthetic ID for granular collections
            patientId: patientId,
            date: new Date(),  // Use current date as these are "live" views
            source: 'granular_collection',
            // Data structure expected by MedicationsListDocument template
            [categoryName]: records  // medications: [...], allergies: [...], etc.
          }
        });
      }

      // GRANULAR COLLECTIONS: Check if this is a synthetic ID (for medications, medical_procedures, etc.)
      const GRANULAR_COLLECTIONS_CHECK = ['medications', 'allergies', 'lab_results', 'vital_signs', 'medical_procedures'];
      const syntheticIdPattern = /^synthetic-[a-f0-9]{24}-/;

      if (syntheticIdPattern.test(documentId) && GRANULAR_COLLECTIONS_CHECK.includes(categoryName)) {
        console.log(`💊 [artifact-detail] Handling granular collection with synthetic ID: ${categoryName}`);

        // For granular collections, return all documents as a single "document"
        const records = await SecureDataAccess.query(
          categoryName,
          { patientId: patientObjectId },
          {
            sort: { date: -1, procedureDate: -1, createdAt: -1 },
            limit: 100
          },
          context
        );

        console.log(`✅ [artifact-detail] Retrieved ${records.length} ${categoryName} records`);

        return res.json({
          success: true,
          patientId,
          category: categoryName,
          document: {
            _id: documentId,  // Keep the synthetic ID
            patientId: patientId,
            date: new Date(),
            source: 'medical_records',
            data: records,  // Return all records as the data
            documentData: records  // Also as documentData for compatibility
          }
        });
      }

      // Try unified_medical_documents first for real document IDs
      let documents = [];

      // Only try ObjectId conversion for non-synthetic IDs
      if (!syntheticIdPattern.test(documentId)) {
        try {
          documents = await SecureDataAccess.query(
            'unified_medical_documents',
            {
              _id: new ObjectId(documentId),
              patientId: patientObjectId,
              category: categoryName
            },
            {},
            context
          );
        } catch (objectIdError) {
          console.log(`⚠️ [artifact-detail] Not a valid ObjectId, might be a special document type`);
        }
      }

      // If no unified document found and it's a valid granular collection, fetch all records
      if (documents.length === 0 && GRANULAR_COLLECTIONS_CHECK.includes(categoryName)) {
        console.log(`🔍 [artifact-detail] No unified document found, fetching all ${categoryName} records`);

        const records = await SecureDataAccess.query(
          categoryName,
          { patientId: patientObjectId },
          {
            sort: { date: -1, procedureDate: -1, createdAt: -1 },
            limit: 100
          },
          context
        );

        if (records.length > 0) {
          console.log(`✅ [artifact-detail] Found ${records.length} ${categoryName} records`);
          return res.json({
            success: true,
            patientId,
            category: categoryName,
            document: {
              _id: documentId,
              patientId: patientId,
              date: new Date(),
              source: 'medical_records',
              data: records,
              documentData: records
            }
          });
        }
      }

      // UNIFIED DOCUMENTS: If we still have no documents, return 404
      if (documents.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      const unifiedDoc = documents[0];

      // Verify patient ownership (extra security layer)
      if (unifiedDoc.patientId.toString() !== patientId) {
        console.error(`🚨 [artifact-detail] SECURITY: Document ${documentId} does not belong to patient ${patientId}`);
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      console.log(`✅ [artifact-detail] Retrieved unified document from ${categoryName}`);

      res.json({
        success: true,
        patientId,
        category: categoryName,
        document: {
          _id: unifiedDoc._id.toString(),
          patientId: unifiedDoc.patientId.toString(),
          date: unifiedDoc.documentDate || unifiedDoc.createdAt,
          source: unifiedDoc.source,
          data: unifiedDoc.documentData  // Complete document data with patient demographics + all extracted fields
        }
      });

    } catch (error) {
      // Safe error logging - prevent crashes in error handling
      try {
        console.error('❌ [artifact-detail] Error:', error.message || error);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
      } catch (logError) {
        console.error('Error in error logging:', logError);
      }

      // Return user-friendly error message
      res.status(500).json({
        success: false,
        error: req.language === 'he'
          ? 'אירעה שגיאה בטעינת המסמך. אנא נסה שוב.'
          : 'An error occurred loading document. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * Get ALL full documents for a category (for CollectionDocumentView)
 * Returns complete document data, not just summaries
 *
 * GET /api/agent/patient/:patientId/category/:categoryName/documents/all
 */
router.get('/patient/:patientId/category/:categoryName/documents/all',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_data'),
  async (req, res) => {
    try {
      const { patientId, categoryName } = req.params;

      console.log(`📚 [artifact-all-documents] Getting ALL full documents for patient ${patientId}, category ${categoryName}`);

      // Validate patientId
      if (!patientId || patientId === 'null' || patientId === 'undefined') {
        console.error(`❌ [artifact-all-documents] Invalid patientId: ${patientId}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid patient ID'
        });
      }

      const mongoose = require('mongoose');
      const { ObjectId } = require('mongodb');

      const context = {
        serviceId: 'agent-route',
        operation: 'get_all_documents',
        // CRITICAL: Use practiceSubdomain as practiceId for database routing
        practiceId: req.practice?.subdomain || req.practiceContext?.subdomain || 'global',
        practiceSubdomain: req.practice?.subdomain || req.practiceContext?.subdomain,
        sessionId: req.sessionID
      };

      // Resolve patientId - could be ObjectId, SSN, nationalId, or name
      let patientObjectId;

      // Check if it's already a valid 24-char hex ObjectId
      if (patientId.match(/^[0-9a-fA-F]{24}$/)) {
        patientObjectId = new mongoose.Types.ObjectId(patientId);
      } else {
        // Not an ObjectId - need to search for patient by identifier
        console.log(`🔍 [artifact-all-documents] Resolving patient identifier: ${patientId}`);

        const patientQuery = {};

        // Check if it's SSN format (US - contains dashes or 9 digits)
        if (patientId.match(/^\d{3}-\d{2}-\d{4}$/) || patientId.match(/^\d{9}$/)) {
          patientQuery.ssn = patientId;
        }
        // Check if it's Israeli national ID (9 digits, no dashes)
        else if (patientId.match(/^\d{9}$/)) {
          patientQuery.nationalId = patientId;
        }
        // Otherwise treat as name
        else {
          patientQuery.$or = [
            { firstName: { $regex: patientId, $options: 'i' } },
            { lastName: { $regex: patientId, $options: 'i' } }
          ];
        }

        const patients = await SecureDataAccess.query('patients', patientQuery, { limit: 1 }, context);

        if (!patients || patients.length === 0) {
          return res.status(404).json({
            success: false,
            error: `Patient not found with identifier: ${patientId}`
          });
        }

        patientObjectId = patients[0]._id;
        console.log(`✅ [artifact-all-documents] Resolved to patient ObjectId: ${patientObjectId}`);
      }

      // Validate category exists (singleton instance)
      const medicalCollectionsService = require('../services/medicalCollectionsService');

      if (!medicalCollectionsService.allCollections.includes(categoryName)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category: ${categoryName}`
        });
      }

      // CRITICAL: Try unified_medical_documents first, fallback to granular collection
      let documents = await SecureDataAccess.query(
        'unified_medical_documents',
        {
          patientId: patientObjectId,
          category: categoryName
        },
        {
          sort: { documentDate: -1 },  // Newest first
          limit: 100
        },
        context
      );

      console.log(`📊 [artifact-all-documents] Found ${documents.length} unified documents in ${categoryName}`);

      // If no unified documents, try granular collection
      if (documents.length === 0) {
        console.log(`🔍 [artifact-all-documents] No unified documents, trying granular collection: ${categoryName}`);

        const granularDocuments = await SecureDataAccess.query(
          categoryName,
          { patientId: patientObjectId },
          {
            sort: { date: -1, createdAt: -1 },  // Newest first
            limit: 100
          },
          context
        );

        console.log(`✅ [artifact-all-documents] Found ${granularDocuments.length} granular documents in ${categoryName}`);
        documents = granularDocuments;
      }

      // Return FULL documents (not summaries)
      res.json({
        success: true,
        patientId,
        category: categoryName,
        data: documents,  // Full document data
        count: documents.length
      });

    } catch (error) {
      // Safe error logging - prevent crashes in error handling
      try {
        console.error('❌ [artifact-all-documents] Error:', error.message || error);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
      } catch (logError) {
        console.error('Error in error logging:', logError);
      }

      // Return user-friendly error message
      res.status(500).json({
        success: false,
        error: req.language === 'he'
          ? 'אירעה שגיאה בטעינת המסמכים. אנא נסה שוב.'
          : 'An error occurred loading documents. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * Helper function to generate document title
 */
function generateDocumentTitle(document, categoryName) {
  switch (categoryName) {
    case 'medications':
      const medCount = document.medications?.length || 0;
      return medCount === 1 ? 'Medication change' : `Current medications`;

    case 'lab_results':
      const testCount = document.results?.reduce((sum, cat) => sum + (cat.tests?.length || 0), 0) || 0;
      return `Lab results (${testCount} tests)`;

    case 'vital_signs':
      return 'Vital signs';

    case 'diagnoses':
      return 'Diagnosis list';

    case 'intelligent_recommendations':
      return 'AI Recommendations';

    case 'clinical_decision_support':
      return 'Clinical Decision Support';

    case 'guideline_compliance':
      return 'Guideline Compliance';

    case 'history_present_illness':
      return 'History of Present Illness';

    case 'discharge_summaries':
      // Use principal diagnosis or admitting diagnosis as title
      const dischargeDx = document.principalDiagnosis || document.admittingDiagnosis || 'Discharge Summary';
      // Truncate long diagnoses to ~60 chars for title
      return dischargeDx.length > 60 ? dischargeDx.substring(0, 57) + '...' : dischargeDx;

    case 'hospital_discharge_summaries':
      // Use primary diagnosis from hospital discharge
      const hospitalDx = document.diagnosis || document.principalDiagnosis || 'Hospital Discharge';
      return hospitalDx.length > 60 ? hospitalDx.substring(0, 57) + '...' : hospitalDx;

    case 'hospital_course':
      // Use admitting diagnosis from hospital course
      const hospitalCourseDx = document.admittingDiagnosis || 'Hospital Course';
      return hospitalCourseDx.length > 60 ? hospitalCourseDx.substring(0, 57) + '...' : hospitalCourseDx;

    default:
      return categoryName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

/**
 * Helper function to generate document preview
 */
function generateDocumentPreview(document, categoryName) {
  try {
    switch (categoryName) {
      case 'patient_details':
        // Patient demographics preview
        const patientName = document.patientName || `${document.firstName || ''} ${document.lastName || ''}`.trim();
        const age = document.dateOfBirth ? Math.floor((new Date() - new Date(document.dateOfBirth)) / 31557600000) : '?';
        const gender = document.gender || '?';
        const status = document.status || 'Unknown';
        return `${patientName}, ${age}y ${gender} - ${status}`;

      case 'medications':
        const meds = document.medications || [];
        const activeMeds = meds.filter(m => m.status === 'active');
        const medNames = activeMeds.slice(0, 3).map(m => m.name).join(', ');
        const more = activeMeds.length > 3 ? ` and ${activeMeds.length - 3} more` : '';
        return `${activeMeds.length} active medications${medNames ? ' including ' + medNames : ''}${more}`;

      case 'prescriptions':
        const rxs = document.prescriptions || [];
        const activeRx = rxs.filter(rx => (rx.status === 'active' || !rx.status || (new Date(rx.expirationDate) > new Date())));
        const rxNames = activeRx.slice(0, 3).map(rx => rx.prescriptionName || rx.medicationName).join(', ');
        const moreRx = activeRx.length > 3 ? ` and ${activeRx.length - 3} more` : '';
        return `${activeRx.length} active prescription(s)${rxNames ? ' including ' + rxNames : ''}${moreRx}`;

      case 'lab_results':
        // Find abnormal results
        const abnormal = [];
        if (document.results) {
          for (const category of document.results) {
            if (category.tests) {
              for (const test of category.tests) {
                if (test.status === 'high' || test.status === 'low' || test.status === 'critical') {
                  abnormal.push(test.name);
                }
              }
            }
          }
        }
        return abnormal.length > 0
          ? `Key findings: ${abnormal.slice(0, 2).join(', ')}`
          : 'All results within normal range';

      case 'lab_orders':
        // Show pending/ordered lab tests
        const orders = document.orders || [];
        const pending = orders.filter(o => o.status === 'pending' || o.status === 'ordered');
        const urgent = orders.filter(o => (o.urgency || o.priority || '').toLowerCase().includes('urgent') || (o.urgency || o.priority || '').toLowerCase().includes('stat'));

        if (orders.length === 0) {
          return 'No lab orders';
        }

        const orderNames = orders.slice(0, 2).map(o => o.testType || o.testName || 'Lab test').join(', ');
        const urgentNote = urgent.length > 0 ? ` (${urgent.length} urgent)` : '';
        const moreOrders = orders.length > 2 ? ` and ${orders.length - 2} more` : '';

        return `${orders.length} lab order(s)${urgentNote}: ${orderNames}${moreOrders}`;

      case 'vital_signs':
        const vitals = document.vitals || {};
        const bp = vitals.bloodPressure;
        return `BP ${bp?.systolic || '?'}/${bp?.diastolic || '?'}, HR ${vitals.heartRate || '?'}, Temp ${vitals.temperature || '?'}°F`;

      case 'intelligent_recommendations':
      case 'recommendations':
        const immediate = document.recommendations?.immediate || [];
        return immediate.length > 0
          ? `${immediate.length} immediate recommendation(s)`
          : 'No immediate actions needed';

      case 'patient_specific_care_plan': {
        const interventionsCount = document.tailoredInterventions?.length || 0;
        const lifestyleCountPlan = document.lifestyleModifications?.length || 0;
        const hasComorbidity = !!document.comorbidityManagement;
        const parts = [];
        if (interventionsCount > 0) parts.push(`${interventionsCount} intervention(s)`);
        if (lifestyleCountPlan > 0) parts.push(`${lifestyleCountPlan} lifestyle modification(s)`);
        if (hasComorbidity) parts.push('Comorbidity management');
        return parts.length > 0 ? parts.join(' • ') : 'Care plan available';
      }

      case 'anesthesia_records':
        const asa = document.anesthesiologyAssessment?.asaClassification || document.asaClassification;
        const procedure = document.operativeDetails?.proceduresPerformed?.[0] || 'procedure';
        const technique = document.anesthesiologyAssessment?.anesthesiaPlan?.technique || document.anesthesiaPlan?.technique || document.anesthesiaType;
        return `ASA ${asa || '?'} - ${procedure} - ${technique || 'Anesthesia plan'}`;

      case 'allergy_immunology_assessment':
        const allergiesCount = document.allergies?.length || 0;
        const severeAllergies = document.allergies?.filter(a => a.severity === 'severe')?.length || 0;
        const asthmaStatus = document.asthmaAssessment?.control || document.asthmaAssessment?.severity || '';
        const allergyParts = [];
        if (severeAllergies > 0) allergyParts.push(`${severeAllergies} severe allerg${severeAllergies === 1 ? 'y' : 'ies'}`);
        if (allergiesCount > severeAllergies) allergyParts.push(`${allergiesCount - severeAllergies} other allerg${(allergiesCount - severeAllergies) === 1 ? 'y' : 'ies'}`);
        if (asthmaStatus) allergyParts.push(`Asthma: ${asthmaStatus}`);
        return allergyParts.length > 0 ? allergyParts.join(' • ') : 'Allergy & Immunology Assessment';

      case 'cardiology_admission_notes':
        const admitDx = document.additionalData?.administrativeData?.admittingDiagnosis || 'Cardiac admission';
        const killip = document.additionalData?.cardiologyAssessment?.killipClass || '';
        const ef = document.additionalData?.cardiologyAssessment?.echoFindings?.ef || '';
        const doorToBalloon = document.additionalData?.cardiologyAssessment?.doorToBalloonTime || '';

        const cardioParts = [admitDx];
        if (doorToBalloon) cardioParts.push(`Door-to-balloon: ${doorToBalloon}`);
        if (ef) cardioParts.push(`EF ${ef}`);
        if (killip) cardioParts.push(killip);

        return cardioParts.join(' • ');

      case 'echo_reports':
        const echoEF = document.ejectionFraction || '';
        const echoConclusion = document.conclusion || '';
        const cardiologist = document.cardiologist || '';

        const echoParts = [];
        if (echoEF) echoParts.push(`EF ${echoEF}`);
        if (echoConclusion && echoConclusion.length > 0) {
          // Truncate conclusion if too long
          const shortConclusion = echoConclusion.length > 50 ? echoConclusion.substring(0, 50) + '...' : echoConclusion;
          echoParts.push(shortConclusion);
        }
        if (cardiologist) echoParts.push(`Dr. ${cardiologist}`);

        return echoParts.length > 0 ? echoParts.join(' • ') : 'Echocardiogram report';

      case 'hospital_discharge_summaries':
        const admitDate = document.administrativeData?.admissionDate;
        const dischargeDate = document.administrativeData?.dischargeDate;
        const lengthOfStay = document.administrativeData?.lengthOfStay || 'Unknown stay';
        const admittingDx = document.administrativeData?.admittingDiagnosis || 'Hospital admission';
        const disposition = document.administrativeData?.disposition || '';
        const condition = document.administrativeData?.conditionAtDischarge || '';

        const dischargeParts = [admittingDx];
        if (lengthOfStay && lengthOfStay !== 'Unknown stay') dischargeParts.push(lengthOfStay);
        if (condition) dischargeParts.push(condition);
        if (disposition && disposition.toLowerCase() !== 'home') dischargeParts.push(`→ ${disposition}`);

        return dischargeParts.join(' • ');

      case 'hospital_course':
        // Hospital course timeline
        const courseAdmitDate = document.admissionDate;
        const courseDischargeDate = document.dischargeDate;
        const courseLOS = document.lengthOfStay || 'Unknown stay';
        const courseAdmittingDx = document.admittingDiagnosis || 'Hospital course';
        const courseDisposition = document.disposition || '';
        const courseCondition = document.condition || '';

        const courseParts = [courseAdmittingDx];
        if (courseLOS && courseLOS !== 'Unknown stay') courseParts.push(`${courseLOS}d`);
        if (courseCondition) courseParts.push(courseCondition);
        if (courseDisposition && courseDisposition.toLowerCase() !== 'home') courseParts.push(`→ ${courseDisposition}`);

        return courseParts.join(' • ');

      case 'discharge_summaries':
        // For getDischargeSummaries() function - flat structure with fields directly on document
        const dsLengthOfStay = document.lengthOfStay || 'Unknown stay';
        const dsAdmittingDx = document.admittingDiagnosis || document.principalDiagnosis || 'Hospital admission';
        const dsDisposition = document.dischargeDisposition || '';
        const dsCondition = document.dischargeCondition || '';

        const dsDischargeParts = [dsAdmittingDx];
        if (dsLengthOfStay && dsLengthOfStay !== 'Unknown stay') dsDischargeParts.push(dsLengthOfStay);
        if (dsCondition) dsDischargeParts.push(dsCondition);
        if (dsDisposition && dsDisposition.toLowerCase() !== 'home') dsDischargeParts.push(`→ ${dsDisposition}`);

        return dsDischargeParts.join(' • ');

      case 'care_gaps':
        const screenings = document.screenings || [];
        if (screenings.length === 0) {
          return 'No care gaps identified - All screenings up to date';
        }
        const highPriority = screenings.filter(s => s.priority?.toLowerCase() === 'high').length;
        const missing = screenings.filter(s => s.status?.toLowerCase() === 'missing').length;
        const overdue = screenings.filter(s => s.status?.toLowerCase() === 'overdue').length;

        if (highPriority > 0 || missing > 0 || overdue > 0) {
          const parts = [];
          if (highPriority > 0) parts.push(`${highPriority} high priority`);
          if (missing > 0) parts.push(`${missing} missing`);
          if (overdue > 0) parts.push(`${overdue} overdue`);
          return `${screenings.length} care gap(s): ${parts.join(', ')}`;
        }
        return `${screenings.length} screening(s) due soon`;

      case 'clinical_scores':
        const scores = document.scores || {};
        const scoreNames = Object.keys(scores);
        if (scoreNames.length === 0) {
          return 'No clinical scores documented';
        }

        // Find high-risk scores
        const highRiskScores = [];
        for (const [name, data] of Object.entries(scores)) {
          const interpretation = data.interpretation?.toLowerCase() || data.risk?.toLowerCase() || '';
          if (interpretation.includes('high') || interpretation.includes('severe')) {
            highRiskScores.push(name);
          }
        }

        if (highRiskScores.length > 0) {
          return `${scoreNames.length} score(s) - ${highRiskScores.join(', ')} elevated`;
        }
        return `${scoreNames.length} clinical score(s): ${scoreNames.slice(0, 3).join(', ')}${scoreNames.length > 3 ? '...' : ''}`;

      case 'consultation_notes':
        const specialty = document.consultingSpecialty || 'Consultation';
        const reason = document.reasonForConsult || 'Consultation note';
        const urgencyBadge = document.urgency === 'urgent' || document.urgency === 'stat' ? ' (URGENT)' : '';
        // Truncate reason if too long
        const shortReason = reason.length > 60 ? reason.substring(0, 60) + '...' : reason;
        return `${specialty}${urgencyBadge}: ${shortReason}`;

      case 'diagnoses':
        const diagnosisText = document.diagnosis || 'Diagnosis';
        const icdBadge = document.icdCode && document.icdCode.trim() ? ` (ICD-10: ${document.icdCode})` : '';
        const statusBadge = document.status ? ` [${document.status.toUpperCase()}]` : '';
        // Truncate diagnosis if too long
        const shortDiagnosis = diagnosisText.length > 50 ? diagnosisText.substring(0, 50) + '...' : diagnosisText;
        return `${shortDiagnosis}${icdBadge}${statusBadge}`;

      case 'guideline_compliance':
        const guidelines = document.guidelines || [];
        const totalGuidelines = guidelines.length;
        const compliant = guidelines.filter(g => g.compliance?.toLowerCase() === 'compliant').length;
        const partial = guidelines.filter(g => g.compliance?.toLowerCase() === 'partial').length;
        const nonCompliant = guidelines.filter(g => g.compliance?.toLowerCase() === 'non-compliant').length;
        const highPriorityGuidelines = guidelines.filter(g => g.priority?.toLowerCase() === 'high').length;

        if (highPriorityGuidelines > 0 || nonCompliant > 0 || partial > 0) {
          return `${totalGuidelines} guideline(s): ${compliant} compliant, ${partial} partial, ${nonCompliant} non-compliant${highPriorityGuidelines > 0 ? ` (${highPriorityGuidelines} high priority)` : ''}`;
        }
        return `${totalGuidelines} guideline(s) - all compliant`;

      case 'history_present_illness':
        const historyText = document.history || 'History of present illness';
        // Extract first sentence or first 80 characters
        const firstSentence = historyText.split(/\.\s+/)[0];
        const preview = firstSentence.length > 80 ? firstSentence.substring(0, 80) + '...' : firstSentence;
        return preview + (firstSentence.endsWith('.') ? '' : '...');

      case 'medications':
        const medName = document.name || 'Medication';
        const dosageInfo = document.dosage ? ` ${document.dosage}` : '';
        const frequencyInfo = document.frequency ? ` ${document.frequency}` : '';
        const activeStatus = document.active !== false ? '' : ' (Inactive)';
        return `${medName}${dosageInfo}${frequencyInfo}${activeStatus}`;

      case 'medication_optimization':
        const costAnalysis = document.costAnalysis || [];
        const adherenceRisk = document.adherenceRisk?.riskLevel || '';
        const simplificationOpp = document.simplificationOpportunities?.length || 0;

        const optimizationParts = [];
        if (costAnalysis.length > 0) optimizationParts.push(`${costAnalysis.length} medication(s) analyzed`);
        if (adherenceRisk) optimizationParts.push(`${adherenceRisk} adherence risk`);
        if (simplificationOpp > 0) optimizationParts.push(`${simplificationOpp} simplification opportunity/opportunities`);

        return optimizationParts.length > 0
          ? optimizationParts.join(' • ')
          : 'Medication optimization analysis';

      case 'outcomes_prediction':
        const prognosisText = document.prognosis || 'Outcomes prediction';
        const priorityBadge = document.priority ? ` [${document.priority.toUpperCase()} PRIORITY]` : '';
        const modifiableCount = document.modifiableFactors?.length || 0;
        const firstLine = prognosisText.split(/\.\s+/)[0];
        const shortPrognosis = firstLine.length > 70 ? firstLine.substring(0, 70) + '...' : firstLine;
        return `${shortPrognosis}${priorityBadge}${modifiableCount > 0 ? ` - ${modifiableCount} modifiable factors` : ''}`;

      case 'imaging_reports':
        const modalityType = document.imagingType || 'Imaging';
        const bodyPartImaged = document.bodyPart || '';
        const impressionText = document.impression || document.findings || 'Imaging report';
        const radiologistName = document.radiologist || '';

        const imagingParts = [modalityType.toUpperCase()];
        if (bodyPartImaged) imagingParts.push(bodyPartImaged);

        // Truncate impression for preview
        const shortImpression = impressionText.length > 60
          ? impressionText.substring(0, 60) + '...'
          : impressionText;
        imagingParts.push(shortImpression);

        if (radiologistName) imagingParts.push(`(${radiologistName})`);

        return imagingParts.join(' • ');

      case 'imaging_orders':
        const orderType = document.imagingType || 'Imaging Order';
        const orderBodyPart = document.bodyPart || '';
        const orderStatus = document.status || 'Ordered';
        const orderUrgency = document.urgency || '';
        const orderIndication = document.indication || '';
        const orderProvider = document.orderingProvider || '';

        const orderParts = [orderType.toUpperCase()];
        if (orderBodyPart) orderParts.push(orderBodyPart);

        // Add status badge
        const orderStatusBadge = orderStatus ? `[${orderStatus.toUpperCase()}]` : '';
        if (orderStatusBadge) orderParts.push(orderStatusBadge);

        // Add urgency if present
        const orderUrgencyBadge = orderUrgency?.toLowerCase() === 'stat' || orderUrgency?.toLowerCase() === 'urgent'
          ? `(${orderUrgency.toUpperCase()})`
          : '';
        if (orderUrgencyBadge) orderParts.push(orderUrgencyBadge);

        // Truncate indication for preview
        if (orderIndication) {
          const shortIndication = orderIndication.length > 40
            ? orderIndication.substring(0, 40) + '...'
            : orderIndication;
          orderParts.push(shortIndication);
        }

        if (orderProvider) orderParts.push(`by ${orderProvider}`);

        return orderParts.join(' • ');

      case 'additional_data':
        const dataCategory = document.category || 'Additional Data';
        const fieldCount = Object.keys(document).filter(key => !key.startsWith('_') && key !== 'category').length;
        return `${dataCategory} • ${fieldCount} field(s)`;

      case 'intraoperative_monitoring':
        const intraopParts = [];
        if (document.ssep) intraopParts.push('SSEP');
        if (document.mep) intraopParts.push('MEP');
        if (document.directStimulation) intraopParts.push('Mapping');
        if (document.eeg) intraopParts.push('EEG');
        if (document.emg) intraopParts.push('EMG');
        const alertCount = document.alerts?.length || 0;
        const intraopText = intraopParts.length > 0 ? intraopParts.join(', ') : 'Monitoring';
        return `${intraopText}${alertCount > 0 ? ` • ${alertCount} alert(s)` : ''}`;

      case 'treatment_courses':
        const treatmentParts = [];

        // Count IV medications
        if (document.ivMedications && document.ivMedications.length > 0) {
          treatmentParts.push(`${document.ivMedications.length} IV med(s)`);
        }

        // Add oxygen therapy
        if (document.oxygenTherapy && (document.oxygenTherapy.method || document.oxygenTherapy.targetSaturation)) {
          treatmentParts.push('O2 therapy');
        }

        // Count nebulizers
        if (document.nebulizers && document.nebulizers.length > 0) {
          treatmentParts.push(`${document.nebulizers.length} nebulizer(s)`);
        }

        // Add therapies if present
        const therapies = [];
        if (document.physicalTherapy) therapies.push('PT');
        if (document.occupationalTherapy) therapies.push('OT');
        if (document.speechTherapy) therapies.push('Speech');
        if (document.respiratoryTherapy) therapies.push('RT');
        if (therapies.length > 0) {
          treatmentParts.push(therapies.join('/'));
        }

        // Add dialysis
        if (document.dialysis) treatmentParts.push('Dialysis');

        // Count transfusions and procedures
        if (document.transfusions && document.transfusions.length > 0) {
          treatmentParts.push(`${document.transfusions.length} transfusion(s)`);
        }
        if (document.procedures && document.procedures.length > 0) {
          treatmentParts.push(`${document.procedures.length} procedure(s)`);
        }

        return treatmentParts.length > 0
          ? treatmentParts.join(' • ')
          : 'Treatment course';

      case 'gi_risk_assessment':
        const overallRisk = document.overallRiskLevel || 'Unknown';
        const riskIcon = overallRisk.toLowerCase() === 'critical' ? '🚨' :
                        overallRisk.toLowerCase() === 'high' ? '⚠️' :
                        overallRisk.toLowerCase() === 'moderate' ? '⚡' : '✅';

        // Count risk categories present
        const riskCategories = [];
        if (document.bleedingRisk) riskCategories.push('Bleeding');
        if (document.aspirationRisk) riskCategories.push('Aspiration');
        if (document.hepaticRisk) riskCategories.push('Hepatic');
        if (document.pancreatitisRisk) riskCategories.push('Pancreatitis');
        if (document.cDiffRisk) riskCategories.push('C.diff');
        if (document.obstructionRisk) riskCategories.push('Obstruction');
        if (document.malabsorptionRisk) riskCategories.push('Malabsorption');

        const categoriesText = riskCategories.length > 0
          ? ` - ${riskCategories.slice(0, 2).join(', ')}${riskCategories.length > 2 ? ` +${riskCategories.length - 2} more` : ''}`
          : '';

        return `${riskIcon} ${overallRisk.toUpperCase()} Risk${categoriesText}`;

      case 'risk_factors':
        // Count risk factors and show highest severity
        const factors = Array.isArray(document) ? document : [document];
        const severities = factors.map(f => f.severity?.toLowerCase() || '');
        const hasHigh = severities.some(s => s.includes('high') || s.includes('critical'));
        const hasModerate = severities.some(s => s.includes('moderate'));
        const categories = [...new Set(factors.map(f => f.category).filter(Boolean))];

        const severityIcon = hasHigh ? '🚨' : hasModerate ? '⚠️' : '✅';
        const categoriesPreview = categories.slice(0, 2).join(', ') +
          (categories.length > 2 ? ` +${categories.length - 2} more` : '');

        return `${severityIcon} ${factors.length} risk factor(s) - ${categoriesPreview || 'Various categories'}`;

      case 'recommendations':
        // Show count and types of recommendations
        const recs = Array.isArray(document) ? document : [document];
        const recTypes = [...new Set(recs.map(r => r.type).filter(Boolean))];
        const hasMedication = recTypes.some(t => t.toLowerCase().includes('medication'));
        const hasProcedure = recTypes.some(t => t.toLowerCase().includes('procedure'));

        const recIcon = hasMedication ? '💊' : hasProcedure ? '🏥' : '📋';
        const typesPreview = recTypes.slice(0, 2).map(t => t.replace(/_/g, ' ')).join(', ') +
          (recTypes.length > 2 ? ` +${recTypes.length - 2} more` : '');

        return `${recIcon} ${recs.length} recommendation(s) - ${typesPreview || 'Various types'}`;

      case 'referrals':
        // Show count and specialty types
        const refs = Array.isArray(document) ? document : [document];
        const specialties = [...new Set(refs.map(r => r.specialty).filter(Boolean))];
        const statuses = refs.map(r => r.status?.toLowerCase() || '');
        const hasPending = statuses.some(s => s.includes('pending'));
        const hasScheduled = statuses.some(s => s.includes('scheduled'));

        const refIcon = hasPending ? '⏳' : hasScheduled ? '📅' : '📤';
        const specialtiesPreview = specialties.slice(0, 2).join(', ') +
          (specialties.length > 2 ? ` +${specialties.length - 2} more` : '');

        return `${refIcon} ${refs.length} referral(s) - ${specialtiesPreview || 'Various specialties'}`;

      case 'medical_history':
        // Show counts of different history types
        const conditionsCount = document.conditions?.length || 0;
        const surgeriesCount = document.surgicalHistory?.length || 0;
        const familyCount = document.familyHistory?.conditions?.length || 0;

        const historyParts = [];
        if (conditionsCount > 0) historyParts.push(`${conditionsCount} condition(s)`);
        if (surgeriesCount > 0) historyParts.push(`${surgeriesCount} surgery(ies)`);
        if (familyCount > 0) historyParts.push(`${familyCount} family history item(s)`);

        return `🏥 ${historyParts.length > 0 ? historyParts.join(' • ') : 'Medical history available'}`;

      case 'vital_signs':
        // Show key vitals with alerts
        const vitalsPreview = [];

        if (document.bloodPressure) {
          const bpMatch = document.bloodPressure.match(/(\d+)\/\d+/);
          const systolic = bpMatch ? parseInt(bpMatch[1]) : 0;
          const bpIcon = systolic >= 140 ? '🔴' : systolic >= 130 ? '🟡' : '✅';
          vitalsPreview.push(`${bpIcon} BP: ${document.bloodPressure}`);
        }

        if (document.heartRate) {
          vitalsPreview.push(`HR: ${document.heartRate}`);
        }

        if (document.temperature) {
          const tempMatch = document.temperature.match(/([\d.]+)/);
          const temp = tempMatch ? parseFloat(tempMatch[1]) : 0;
          const tempIcon = temp > 100.4 ? '🔴' : '✅';
          vitalsPreview.push(`${tempIcon} Temp: ${document.temperature}`);
        }

        return vitalsPreview.length > 0 ? vitalsPreview.slice(0, 2).join(' • ') : '📊 Vital signs recorded';

      case 'treatment_plans':
        const planParts = [];
        const procCount = document.pendingProcedures?.length || 0;
        const rehabCount = document.rehabilitationReferrals?.length || 0;

        if (procCount > 0) planParts.push(`${procCount} procedure(s)`);
        if (rehabCount > 0) planParts.push(`${rehabCount} rehab referral(s)`);
        if (document.immediateInterventions) planParts.push('⚠️ Immediate interventions');

        return `📋 ${planParts.length > 0 ? planParts.join(' • ') : 'Treatment plan available'}`;

      case 'prognosis_records':
        const prognosisParts = [];

        if (document.diagnosis) {
          const diagnosisShort = document.diagnosis.length > 30 ? document.diagnosis.substring(0, 30) + '...' : document.diagnosis;
          prognosisParts.push(diagnosisShort);
        }

        if (document.mortality) {
          const mortalityLower = document.mortality.toLowerCase();
          const mortalityIcon = mortalityLower.includes('high') ? '🔴' : mortalityLower.includes('moderate') ? '🟡' : '🟢';
          prognosisParts.push(`${mortalityIcon} Mortality risk`);
        }

        const riskCount = document.riskFactors?.length || 0;
        if (riskCount > 0) {
          prognosisParts.push(`${riskCount} risk factor(s)`);
        }

        return `🔮 ${prognosisParts.length > 0 ? prognosisParts.join(' • ') : 'Prognosis available'}`;

      case 'monitoring_plans':
        const monitoringParts = [];

        if (document.laboratory) {
          monitoringParts.push('Lab monitoring');
        }

        if (document.imaging) {
          monitoringParts.push('Imaging monitoring');
        }

        if (document.clinicalAssessments) {
          monitoringParts.push('Clinical assessments');
        }

        const paramCount = document.parameters?.length || 0;
        if (paramCount > 0) {
          monitoringParts.push(`${paramCount} parameter(s)`);
        }

        if (document.frequency) {
          monitoringParts.push(`Frequency: ${document.frequency}`);
        }

        return `📊 ${monitoringParts.length > 0 ? monitoringParts.slice(0, 3).join(' • ') : 'Monitoring plan available'}`;

      case 'clinical_scores':
        const scoresParts = [];

        if (document.scores) {
          const scoreNames = [];
          Object.entries(document.scores).forEach(([key, value]) => {
            if (key === 'other' && typeof value === 'object') {
              scoreNames.push(...Object.keys(value));
            } else {
              scoreNames.push(key);
            }
          });

          if (scoreNames.length > 0) {
            scoresParts.push(`${scoreNames.length} score(s): ${scoreNames.slice(0, 2).join(', ')}`);
            if (scoreNames.length > 2) scoresParts[0] += '...';
          }
        }

        if (document.diagnosis) {
          const diagShort = document.diagnosis.length > 25 ? document.diagnosis.substring(0, 25) + '...' : document.diagnosis;
          scoresParts.push(diagShort);
        }

        return `📈 ${scoresParts.length > 0 ? scoresParts.join(' • ') : 'Clinical scores available'}`;

      case 'family_meeting_notes':
        const meetingParts = [];

        const attendeeCount = document.attendees?.length || 0;
        if (attendeeCount > 0) {
          meetingParts.push(`${attendeeCount} attendee(s)`);
        }

        const discussionCount = document.discussionPoints?.length || 0;
        if (discussionCount > 0) {
          meetingParts.push(`${discussionCount} discussion point(s)`);
        }

        const decisionCount = document.decisions?.length || 0;
        if (decisionCount > 0) {
          meetingParts.push(`${decisionCount} decision(s)`);
        }

        if (document.facilitator) {
          meetingParts.push(`Facilitator: ${document.facilitator}`);
        }

        return `👨‍👩‍👧‍👦 ${meetingParts.length > 0 ? meetingParts.slice(0, 3).join(' • ') : 'Family meeting documented'}`;

      case 'functional_assessments':
        const functionalParts = [];

        if (document.adlScore) {
          functionalParts.push(`ADL: ${document.adlScore}`);
        }

        if (document.iadlScore) {
          functionalParts.push(`IADL: ${document.iadlScore}`);
        }

        const adlCount = document.adlItems ? Object.keys(document.adlItems).length : 0;
        const iadlCount = document.iadlItems ? Object.keys(document.iadlItems).length : 0;

        if (adlCount > 0 || iadlCount > 0) {
          functionalParts.push(`${adlCount + iadlCount} assessments`);
        }

        return `🏃 ${functionalParts.length > 0 ? functionalParts.slice(0, 3).join(' • ') : 'Functional assessment available'}`;

      case 'lifestyle_assessments':
        const lifestyleParts = [];

        if (document.exerciseMinutes) {
          lifestyleParts.push(`Exercise: ${document.exerciseMinutes} min/week`);
        }

        if (document.dietPattern) {
          const dietShort = document.dietPattern.length > 20
            ? document.dietPattern.substring(0, 20) + '...'
            : document.dietPattern;
          lifestyleParts.push(`Diet: ${dietShort}`);
        }

        if (document.sleepQuality) {
          lifestyleParts.push(`Sleep: ${document.sleepQuality}`);
        }

        if (document.stressLevel) {
          lifestyleParts.push(`Stress: ${document.stressLevel}`);
        }

        return `🌟 ${lifestyleParts.length > 0 ? lifestyleParts.slice(0, 3).join(' • ') : 'Lifestyle assessment available'}`;

      case 'risk_calculators':
        const calcParts = [];

        if (document.ascvd) {
          calcParts.push(`ASCVD: ${document.ascvd}`);
        }

        if (document.chadsVasc) {
          calcParts.push(`CHA2DS2-VASc: ${document.chadsVasc}`);
        }

        if (document.meld) {
          calcParts.push(`MELD: ${document.meld}`);
        }

        if (document.frax) {
          calcParts.push(`FRAX: ${document.frax}`);
        }

        if (document.gail) {
          calcParts.push(`Gail: ${document.gail}`);
        }

        return `📊 ${calcParts.length > 0 ? calcParts.slice(0, 2).join(' • ') : 'Risk calculators available'}`;

      case 'preventive_biomarkers':
        const biomarkerParts = [];

        if (document.hscrp) {
          biomarkerParts.push(`hsCRP: ${document.hscrp}`);
        }

        if (document.vitaminD) {
          biomarkerParts.push(`Vitamin D: ${document.vitaminD}`);
        }

        if (document.apoB) {
          biomarkerParts.push(`ApoB: ${document.apoB}`);
        }

        if (document.omega3Index) {
          biomarkerParts.push(`Omega-3: ${document.omega3Index}`);
        }

        return `🧪 ${biomarkerParts.length > 0 ? biomarkerParts.slice(0, 2).join(' • ') : 'Biomarker results available'}`;

      case 'preventive_medicine_assessments':
        const prevMedParts = [];

        if (document.assessmentType) {
          prevMedParts.push(document.assessmentType);
        }

        const screeningCount = document.screeningSchedule?.length || 0;
        if (screeningCount > 0) {
          prevMedParts.push(`${screeningCount} screening(s)`);
        }

        const interventionCount = (document.lifestyleInterventions?.length || 0) + (document.pharmacologicInterventions?.length || 0);
        if (interventionCount > 0) {
          prevMedParts.push(`${interventionCount} intervention(s)`);
        }

        return `🏥 ${prevMedParts.length > 0 ? prevMedParts.slice(0, 3).join(' • ') : 'Preventive assessment available'}`;

      case 'screening_compliance':
        const screeningParts = [];

        if (document.complianceRate) {
          screeningParts.push(document.complianceRate);
        }

        const overdueCount = document.overdue?.length || 0;
        if (overdueCount > 0) {
          screeningParts.push(`${overdueCount} overdue`);
        } else {
          screeningParts.push('Up to date');
        }

        return `📋 ${screeningParts.join(' • ')}`;

      case 'mental_status_exams':
        const mseParts = [];

        if (document.overallImpression) {
          const impressionShort = document.overallImpression.length > 40
            ? document.overallImpression.substring(0, 40) + '...'
            : document.overallImpression;
          mseParts.push(impressionShort);
        }

        if (document.mood) {
          mseParts.push(`Mood: ${document.mood}`);
        }

        if (document.affect?.quality) {
          mseParts.push(`Affect: ${document.affect.quality}`);
        }

        if (document.insight) {
          mseParts.push(`Insight: ${document.insight}`);
        }

        return `🧠 ${mseParts.length > 0 ? mseParts.slice(0, 3).join(' • ') : 'Mental status exam available'}`;

      case 'vaccination_records':
        const vaccinationParts = [];

        if (document.vaccine) {
          vaccinationParts.push(document.vaccine);
        }

        if (document.status) {
          const statusIcon = document.status.toLowerCase().includes('given') ? '✅' : document.status.toLowerCase().includes('due') ? '📅' : '⚠️';
          vaccinationParts.push(`${statusIcon} ${document.status}`);
        }

        if (document.date) {
          vaccinationParts.push(new Date(document.date).toLocaleDateString());
        }

        if (document.reactions && Array.isArray(document.reactions) && document.reactions.length > 0) {
          vaccinationParts.push(`⚠️ ${document.reactions.length} reaction(s)`);
        }

        return `💉 ${vaccinationParts.length > 0 ? vaccinationParts.slice(0, 3).join(' • ') : 'Vaccination record'}`;

      case 'home_monitoring':
        const homeMonitoringParts = [];

        const monitoringTypes = [];
        if (document.bloodPressure && (document.bloodPressure.frequency || document.bloodPressure.morning || document.bloodPressure.evening)) {
          monitoringTypes.push('BP');
        }
        if (document.bloodGlucose && (document.bloodGlucose.frequency || document.bloodGlucose.target)) {
          monitoringTypes.push('Glucose');
        }
        if (document.weight && (document.weight.frequency || document.weight.readings)) {
          monitoringTypes.push('Weight');
        }
        if (document.peakFlow && (document.peakFlow.frequency || document.peakFlow.baseline)) {
          monitoringTypes.push('Peak Flow');
        }
        if (document.oxygenSaturation && (document.oxygenSaturation.frequency || document.oxygenSaturation.target)) {
          monitoringTypes.push('O2 Sat');
        }

        if (monitoringTypes.length > 0) {
          homeMonitoringParts.push(monitoringTypes.join(', '));
        }

        if (document.date) {
          homeMonitoringParts.push(new Date(document.date).toLocaleDateString());
        }

        return `📊 ${homeMonitoringParts.length > 0 ? homeMonitoringParts.slice(0, 2).join(' • ') : 'Home monitoring'}`;

      case 'doctors_medication_recommendations':
        const docMedParts = [];

        if (document.medication) {
          docMedParts.push(document.medication);
        }

        if (document.dosage) {
          docMedParts.push(document.dosage);
        }

        if (document.frequency) {
          docMedParts.push(document.frequency);
        }

        if (document.priority) {
          const priorityIcon = document.priority.toLowerCase().includes('urgent') || document.priority.toLowerCase().includes('stat') ? '⚠️' : '';
          docMedParts.push(`${priorityIcon}${document.priority}`.trim());
        }

        if (document.provider) {
          docMedParts.push(`by ${document.provider}`);
        }

        return `💊 ${docMedParts.length > 0 ? docMedParts.slice(0, 3).join(' • ') : 'Medication recommendation'}`;

      case 'colorectal_colonoscopies':
        const colonoscopyParts = [];

        if (document.procedureDate) {
          const procDate = new Date(document.procedureDate);
          colonoscopyParts.push(procDate.toLocaleDateString('en-US'));
        }

        if (document.polyps && document.polyps.length > 0) {
          colonoscopyParts.push(`${document.polyps.length} polyp${document.polyps.length > 1 ? 's' : ''}`);
        }

        if (document.lesions && document.lesions.length > 0) {
          colonoscopyParts.push(`${document.lesions.length} lesion${document.lesions.length > 1 ? 's' : ''}`);
        }

        if (document.completeness) {
          colonoscopyParts.push(document.completeness);
        }

        return `🔬 ${colonoscopyParts.length > 0 ? colonoscopyParts.join(' • ') : 'Colonoscopy report'}`;

      case 'colorectal_surgery_consultations':
        const surgeryParts = [];

        if (document.consultationDate) {
          const consultDate = new Date(document.consultationDate);
          surgeryParts.push(consultDate.toLocaleDateString('en-US'));
        }

        if (document.proposedProcedure) {
          surgeryParts.push(document.proposedProcedure.substring(0, 30) + (document.proposedProcedure.length > 30 ? '...' : ''));
        }

        if (document.stagingTNM) {
          surgeryParts.push(document.stagingTNM);
        }

        if (document.surgicalApproach && document.surgicalApproach.technique) {
          surgeryParts.push(document.surgicalApproach.technique.substring(0, 25));
        }

        return `🏥 ${surgeryParts.length > 0 ? surgeryParts.slice(0, 2).join(' • ') : 'Surgery consultation'}`;

      case 'hematology_consultations':
        const hematologyParts = [];

        if (document.consultationDate) {
          const hematDate = new Date(document.consultationDate);
          hematologyParts.push(hematDate.toLocaleDateString('en-US'));
        }

        if (document.bloodDisorder) {
          hematologyParts.push(document.bloodDisorder.substring(0, 35) + (document.bloodDisorder.length > 35 ? '...' : ''));
        }

        if (document.chemotherapy && document.chemotherapy.length > 0) {
          hematologyParts.push(`${document.chemotherapy.length} regimen${document.chemotherapy.length > 1 ? 's' : ''}`);
        }

        return `🩸 ${hematologyParts.length > 0 ? hematologyParts.slice(0, 2).join(' • ') : 'Hematology consultation'}`;

      case 'blood_smears':
        const smearParts = [];

        if (document.testDate) {
          const smearDate = new Date(document.testDate);
          smearParts.push(smearDate.toLocaleDateString('en-US'));
        }

        if (document.rbcMorphology) {
          const morphology = document.rbcMorphology.substring(0, 40) + (document.rbcMorphology.length > 40 ? '...' : '');
          smearParts.push(morphology);
        }

        if (document.inclusions && document.inclusions.length > 0) {
          smearParts.push(`${document.inclusions.length} inclusion${document.inclusions.length > 1 ? 's' : ''}`);
        }

        return `🔬 ${smearParts.length > 0 ? smearParts.slice(0, 2).join(' • ') : 'Blood smear'}`;

      case 'pulmonary_function_tests':
        const pftParts = [];

        if (document.testDate) {
          const pftDate = new Date(document.testDate);
          pftParts.push(pftDate.toLocaleDateString('en-US'));
        }

        // Check for key test values
        const fev1 = document.fev1Percent || document.fev1percent;
        const fvc = document.fvcPercent || document.fvcpercent;

        if (fev1) {
          pftParts.push(`FEV1: ${fev1}%`);
        }
        if (fvc) {
          pftParts.push(`FVC: ${fvc}%`);
        }

        if (document.severity) {
          pftParts.push(document.severity);
        }

        return `🫁 ${pftParts.length > 0 ? pftParts.slice(0, 2).join(' • ') : 'PFT'}`;

      case 'neurosurgery_consultations':
        const neuroParts = [];

        if (document.consultationDate) {
          neuroParts.push(new Date(document.consultationDate).toLocaleDateString('en-US'));
        }

        if (document.diagnosis && document.diagnosis.length > 0) {
          neuroParts.push(document.diagnosis[0].substring(0, 30));
        }

        if (document.proposedProcedure) {
          neuroParts.push(document.proposedProcedure.substring(0, 30));
        }

        return `🧠 ${neuroParts.length > 0 ? neuroParts.slice(0, 2).join(' • ') : 'Neurosurgery'}`;

      case 'brain_tumor_characteristics':
        const tumorParts = [];

        if (document.whoGrade) {
          tumorParts.push(document.whoGrade);
        }

        if (document.idh1Status) {
          tumorParts.push(`IDH1: ${document.idh1Status}`);
        }

        if (document.location) {
          tumorParts.push(document.location.substring(0, 25));
        }

        return `🧬 ${tumorParts.length > 0 ? tumorParts.slice(0, 2).join(' • ') : 'Tumor'}`;

      case 'tractography_studies':
        const tractParts = [];

        if (document.studyDate) {
          tractParts.push(new Date(document.studyDate).toLocaleDateString('en-US'));
        }

        // Check for tract findings
        const tracts = [];
        if (document.corticospinalTract) tracts.push('CST');
        if (document.arcuateFasciculus) tracts.push('AF');
        if (document.opticRadiation) tracts.push('OR');

        if (tracts.length > 0) {
          tractParts.push(tracts.join(', '));
        }

        return `🧠 ${tractParts.length > 0 ? tractParts.join(' • ') : 'Tractography'}`;

      case 'functional_mri_studies':
        const fmriParts = [];

        if (document.scanDate) {
          fmriParts.push(new Date(document.scanDate).toLocaleDateString('en-US'));
        }

        if (document.languageLateralization) {
          fmriParts.push(document.languageLateralization.substring(0, 20));
        }

        if (document.eloquentAreas && document.eloquentAreas.length > 0) {
          fmriParts.push(`${document.eloquentAreas.length} areas`);
        }

        return `🧠 ${fmriParts.length > 0 ? fmriParts.slice(0, 2).join(' • ') : 'fMRI'}`;

      case 'bone_marrow_studies':
        const marrowParts = [];

        if (document.procedureDate) {
          marrowParts.push(new Date(document.procedureDate).toLocaleDateString('en-US'));
        }

        if (document.cellularity) {
          marrowParts.push(document.cellularity.substring(0, 20));
        }

        if (document.cytogenetics && document.cytogenetics.karyotype) {
          marrowParts.push(document.cytogenetics.karyotype.substring(0, 25));
        }

        return `🔬 ${marrowParts.length > 0 ? marrowParts.slice(0, 2).join(' • ') : 'Marrow'}`;

      case 'plastic_surgery_consultations':
        const plasticParts = [];

        if (document.consultationDate) {
          plasticParts.push(new Date(document.consultationDate).toLocaleDateString('en-US'));
        }

        if (document.procedureType) {
          plasticParts.push(document.procedureType.substring(0, 30));
        } else if (document.chiefComplaint && document.chiefComplaint.complaint) {
          plasticParts.push(document.chiefComplaint.complaint.substring(0, 30));
        }

        return `🏥 ${plasticParts.length > 0 ? plasticParts.join(' • ') : 'Plastic Surgery'}`;

      case 'clinical_decision_support':
        const riskLevel = document.riskAssessment?.overallRisk || 'Unknown';
        const redFlagsCount = document.redFlags?.length || 0;
        const drugInteractionsCount = document.drugInteractions?.length || 0;
        const contraindicationsCount = document.contraindications?.length || 0;

        const cdsParts = [`Risk: ${riskLevel}`];
        if (redFlagsCount > 0) cdsParts.push(`${redFlagsCount} red flag(s)`);
        if (drugInteractionsCount > 0) cdsParts.push(`${drugInteractionsCount} interaction(s)`);
        if (contraindicationsCount > 0) cdsParts.push(`${contraindicationsCount} contraindication(s)`);

        return cdsParts.join(' • ');

      case 'administrative_data':
        const mrnPreview = document.mrn || 'N/A';
        const insurance = document.insurance || '';
        const admissionInfo = document.admissionDate
          ? `Admitted: ${new Date(document.admissionDate).toLocaleDateString()}`
          : '';
        const codeStatus = document.codeStatus || '';

        const adminParts = [`MRN: ${mrnPreview}`];
        if (insurance) adminParts.push(insurance);
        if (admissionInfo) adminParts.push(admissionInfo);
        if (codeStatus) adminParts.push(`Code: ${codeStatus}`);

        return adminParts.slice(0, 3).join(' • ');

      case 'patient_education_context':
        const educationParts = [];

        // Count different types of education materials
        const diagnosisCount = document.diagnosisEducation?.length || 0;
        const medicationCount = document.medicationEducation?.length || 0;
        const procedureCount = document.procedureEducation?.length || 0;
        const lifestyleCount = document.lifestyleRecommendations?.length || 0;

        if (diagnosisCount > 0) educationParts.push(`${diagnosisCount} diagnosis guide(s)`);
        if (medicationCount > 0) educationParts.push(`${medicationCount} medication guide(s)`);
        if (procedureCount > 0) educationParts.push(`${procedureCount} procedure guide(s)`);
        if (lifestyleCount > 0) educationParts.push(`${lifestyleCount} lifestyle tip(s)`);

        return educationParts.length > 0
          ? educationParts.join(' • ')
          : 'Patient education materials';

      case 'reminders':
        // Reminders preview - show count and status summary
        const remindersArray = document.reminders || [];
        const reminderCount = remindersArray.length;
        const scheduledCount = remindersArray.filter(r => r.status === 'scheduled').length;
        const completedCount = remindersArray.filter(r => r.status === 'completed').length;

        const reminderParts = [`${reminderCount} reminder${reminderCount === 1 ? '' : 's'}`];
        if (scheduledCount > 0) reminderParts.push(`${scheduledCount} scheduled`);
        if (completedCount > 0) reminderParts.push(`${completedCount} completed`);

        return reminderParts.join(' • ');

      case 'allergies': {
        // Allergies list preview - show count and severity summary
        const allergyArray = Array.isArray(document) ? document : (document.allergies || []);
        if (allergyArray.length === 0) {
          return 'No documented allergies';
        }

        const severeCount = allergyArray.filter(a => a.severity === 'severe' || a.severity === 'critical').length;
        const moderateCount = allergyArray.filter(a => a.severity === 'moderate').length;
        const mildCount = allergyArray.filter(a => a.severity === 'mild').length;

        const allergyParts = [];
        if (severeCount > 0) allergyParts.push(`${severeCount} severe`);
        if (moderateCount > 0) allergyParts.push(`${moderateCount} moderate`);
        if (mildCount > 0) allergyParts.push(`${mildCount} mild`);

        return allergyArray.length === 1
          ? `${allergyArray[0].allergen || 'Allergy'} (${allergyArray[0].severity || 'Unknown severity'})`
          : `${allergyArray.length} allergies: ${allergyParts.join(', ')}`;
      }

      case 'allergies_assessments': {
        // Allergies assessments preview - show count and assessment types
        const assessmentArray = Array.isArray(document) ? document : (document.allergies_assessments || []);
        if (assessmentArray.length === 0) {
          return 'No allergy assessments';
        }

        const withTestResults = assessmentArray.filter(a => a.testResults && a.testResults.length > 0).length;
        const withRecommendations = assessmentArray.filter(a => a.recommendations && a.recommendations.length > 0).length;

        const assessmentParts = [];
        if (withTestResults > 0) assessmentParts.push(`${withTestResults} with test results`);
        if (withRecommendations > 0) assessmentParts.push(`${withRecommendations} with recommendations`);

        return assessmentArray.length === 1
          ? `${assessmentArray[0].allergen || 'Allergy'} assessment`
          : `${assessmentArray.length} allergy assessments${assessmentParts.length > 0 ? ': ' + assessmentParts.join(', ') : ''}`;
      }

      case 'asthma_assessments': {
        // Asthma Assessments preview
        const assessmentArray = Array.isArray(document) ? document : (document.asthma_assessments || []);
        if (assessmentArray.length === 0) return 'No asthma assessments';

        const assessmentParts = [];
        const severities = assessmentArray.map(a => a.severity?.toLowerCase()).filter(Boolean);
        const controls = assessmentArray.map(a => a.control?.toLowerCase()).filter(Boolean);
        const exacerbations = assessmentArray.filter(a => a.exacerbationHistory?.length > 0).length;

        if (severities.length > 0) {
          const uniqueSeverities = [...new Set(severities)];
          assessmentParts.push(uniqueSeverities.join('/'));
        }
        if (controls.length > 0) {
          const uniqueControls = [...new Set(controls)];
          assessmentParts.push(uniqueControls.join('/'));
        }
        if (exacerbations > 0) {
          assessmentParts.push(`${exacerbations} with recent exacerbations`);
        }

        return assessmentArray.length === 1
          ? 'Asthma assessment' + (assessmentParts.length > 0 ? ' - ' + assessmentParts.join(' • ') : '')
          : `${assessmentArray.length} asthma assessments${assessmentParts.length > 0 ? ': ' + assessmentParts.join(' • ') : ''}`;
      }

      case 'component_allergen_testing': {
        // Component Allergen Testing (Component-Resolved Diagnostics) preview
        const allergens = document.allergens || [];
        if (allergens.length === 0) return 'No component testing results';

        const highRisk = allergens.filter(a =>
          a.interpretation?.toLowerCase().includes('high risk') ||
          a.interpretation?.toLowerCase().includes('anaphylaxis')
        );

        const components = allergens.slice(0, 2).map(a => a.component).join(', ');
        const more = allergens.length > 2 ? ` and ${allergens.length - 2} more` : '';

        const parts = [`${allergens.length} component(s) tested`];
        if (highRisk.length > 0) parts.push(`${highRisk.length} high risk`);
        if (components) parts.push(components);

        return parts.join(' • ') + more;
      }

      case 'airway_management_records':
        const intubationMethod = document.intubationMethod || 'Airway';
        const tubeSize = document.endotrachealTubeSize ? `Tube: ${document.endotrachealTubeSize}` : '';
        const cormackGrade = document.cormackLehaneGrade ? `Grade: ${document.cormackLehaneGrade}` : '';
        const attempts = document.intubationAttempts ? `${document.intubationAttempts} attempt(s)` : '';
        const airwayComp = document.complicationsDuringIntubation?.length || 0;
        const airwayCompText = airwayComp > 0 ? ` • ${airwayComp} complication(s)` : '';
        return `🫁 ${intubationMethod}${tubeSize ? ' • ' + tubeSize : ''}${cormackGrade ? ' • ' + cormackGrade : ''}${attempts ? ' • ' + attempts : ''}${airwayCompText}`;

      case 'regional_anesthesia_records':
        const raBlockType = document.blockType || 'Block';
        const raLocation = document.anatomicalLocation || '';
        const raTechnique = document.approachTechnique || '';
        const raAnesthesiologist = document.performingAnesthesiologist ? `by ${document.performingAnesthesiologist}` : '';
        const raComplications = document.complicationsDuringProcedure?.length || 0;
        const raCompText = raComplications > 0 ? ` • ${raComplications} complication(s)` : '';
        return `💉 ${raBlockType}${raLocation ? ' • ' + raLocation : ''}${raTechnique ? ' • ' + raTechnique : ''}${raAnesthesiologist ? ' • ' + raAnesthesiologist : ''}${raCompText}`;

      case 'chronic_pain_assessment':
        const cpLocation = document.painLocation || 'Pain Assessment';
        const cpIntensity = document.painIntensityScore !== undefined ? `Intensity: ${document.painIntensityScore}/10` : '';
        const cpDuration = document.painDurationMonths ? `${document.painDurationMonths} months` : '';
        const cpNeuropathic = document.neuropathicPainPresent ? 'Neuropathic' : '';
        const cpOpioid = document.opioidTherapyActive ? 'Opioid therapy' : '';
        return `📊 ${cpLocation}${cpIntensity ? ' • ' + cpIntensity : ''}${cpDuration ? ' • ' + cpDuration : ''}${cpNeuropathic ? ' • ' + cpNeuropathic : ''}${cpOpioid ? ' • ' + cpOpioid : ''}`;

      default:
        // Generic preview: extract first meaningful text
        const text = JSON.stringify(document).substring(0, 100).replace(/[{}"]/g, '');
        return text + '...';
    }
  } catch (error) {
    return 'Medical data';
  }
}

/**
 * Helper function to get category metadata
 */
function getCategoryMetadata(collectionName) {
  // Use iconLoader service to get icon from icon files
  const iconLoader = require('../services/gridMappings/iconLoader');
  const { getCollectionDescription } = require('../services/gridMappings/collectionDescriptions');

  // Generate displayName from collection name
  const displayName = collectionName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  // Get icon from iconLoader (uses icon files in services/gridMappings/icons/)
  const icon = iconLoader.getIcon(collectionName);

  // Get description from collectionDescriptions service
  const description = getCollectionDescription(collectionName);

  return {
    displayName,
    icon,
    description
  };
}

// Apply error handler to router - must be LAST middleware
router.use(errorHandler);


// ============================================
// AUTO-GENERATED ROUTES FOR MISSING COLLECTIONS
// Generated by scripts/generateMissingRoutes.js
// ============================================

// Abnormal Results
router.get('/abnormal-results/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:abnormal_results'),
  createMedicalDataRoute('abnormal_results', null, 'read:abnormal_results')
);

// Admission Assessments
router.get('/admission-assessments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:admission_assessments'),
  createMedicalDataRoute('admission_assessments', null, 'read:admission_assessments')
);

// Advanced Directives
router.get('/advanced-directives/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:goals_of_care_discussions'),
  createMedicalDataRoute('goals_of_care_discussions', null, 'read:goals_of_care_discussions')
);

// Appointments
router.get('/appointments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:appointments'),
  createMedicalDataRoute('appointments', null, 'read:appointments')
);

// Consultation Notes
router.get('/consultation-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:consultation_notes'),
  createMedicalDataRoute('consultation_notes', null, 'read:consultation_notes')
);

// Discharge Summaries
router.get('/discharge-summaries/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:discharge_summaries'),
  createMedicalDataRoute('discharge_summaries', null, 'read:discharge_summaries')
);

// Follow Ups
router.get('/follow-ups/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:follow_ups'),
  createMedicalDataRoute('follow_ups', null, 'read:follow_ups')
);

// Imaging Reports
router.get('/imaging-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:imaging_reports'),
  createMedicalDataRoute('imaging_reports', null, 'read:imaging_reports')
);

// Medical Alerts
router.get('/medical-alerts/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medical_alerts'),
  createMedicalDataRoute('medical_alerts', null, 'read:medical_alerts')
);

// Medical Certificates
router.get('/medical-certificates/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medical_certificates'),
  createMedicalDataRoute('medical_certificates', null, 'read:medical_certificates')
);

// Medication Recommendations
router.get('/medication-recommendations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medication_recommendations'),
  createMedicalDataRoute('medication_recommendations', null, 'read:medication_recommendations')
);

// Medication Safety
router.get('/medication-safety/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medication_safety'),
  createMedicalDataRoute('medication_safety', null, 'read:medication_safety')
);

// Medication Safety Alerts
router.get('/medication-safety-alerts/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medication_safety_alerts'),
  createMedicalDataRoute('medication_safety_alerts', null, 'read:medication_safety_alerts')
);

// Recommendations
router.get('/recommendations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:recommendations'),
  createMedicalDataRoute('recommendations', null, 'read:recommendations')
);

// Vaccination Records
router.get('/vaccination-records/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:vaccination_records'),
  createMedicalDataRoute('vaccination_records', null, 'read:vaccination_records')
);

// Emergency Discharge Summaries
router.get('/emergency-discharge-summaries/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:emergency_discharge_summaries'),
  createMedicalDataRoute('emergency_discharge_summaries', null, 'read:emergency_discharge_summaries')
);

// Emergency Reports
router.get('/emergency-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:emergency_reports'),
  createMedicalDataRoute('emergency_reports', null, 'read:emergency_reports')
);

// Hospital Admission Notes
router.get('/hospital-admission-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hospital_admission_notes'),
  createMedicalDataRoute('hospital_admission_notes', null, 'read:hospital_admission_notes')
);

// Hospital Discharge Summaries
router.get('/hospital-discharge-summaries/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hospital_discharge_summaries'),
  createMedicalDataRoute('hospital_discharge_summaries', null, 'read:hospital_discharge_summaries')
);

// Hospital Transfer Notes
router.get('/hospital-transfer-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hospital_transfer_notes'),
  createMedicalDataRoute('hospital_transfer_notes', null, 'read:hospital_transfer_notes')
);

// Icu Flow Sheets
router.get('/icu-flow-sheets/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:icu_flow_sheets'),
  createMedicalDataRoute('icu_flow_sheets', null, 'read:icu_flow_sheets')
);

// Icu Flow Sheet
router.get('/icu-flow-sheet/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:icu_flow_sheet'),
  createMedicalDataRoute('icu_flow_sheet', null, 'read:icu_flow_sheet')
);

// Hourly Vital Signs
router.get('/hourly-vital-signs/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hourly_vital_signs'),
  createMedicalDataRoute('hourly_vital_signs', null, 'read:hourly_vital_signs')
);

// Arterial Blood Gases
router.get('/arterial-blood-gases/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:arterial_blood_gases'),
  createMedicalDataRoute('arterial_blood_gases', null, 'read:arterial_blood_gases')
);

// Continuous Infusions
router.get('/continuous-infusions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:continuous_infusions'),
  createMedicalDataRoute('continuous_infusions', null, 'read:continuous_infusions')
);

// Neurological Assessment
router.get('/neurological-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:neurological_assessment'),
  createMedicalDataRoute('neurological_assessment', null, 'read:neurological_assessment')
);

// Glasgow Coma Scale
router.get('/glasgow-coma-scale/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:glasgow_coma_scale'),
  createMedicalDataRoute('glasgow_coma_scale', null, 'read:glasgow_coma_scale')
);

// Cam Icu
router.get('/cam-icu/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cam_icu'),
  createMedicalDataRoute('cam_icu', null, 'read:cam_icu')
);

// Procedures Interventions
router.get('/procedures-interventions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:procedures_interventions'),
  createMedicalDataRoute('procedures_interventions', null, 'read:procedures_interventions')
);

// Nursing Notes
router.get('/nursing-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:nursing_notes'),
  createMedicalDataRoute('nursing_notes', null, 'read:nursing_notes')
);

// Transfer Summaries
router.get('/transfer-summaries/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:transfer_summaries'),
  createMedicalDataRoute('transfer_summaries', null, 'read:transfer_summaries')
);

// Treatment Courses
router.get('/treatment-courses/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:treatment_courses'),
  createMedicalDataRoute('treatment_courses', null, 'read:treatment_courses')
);

// Admission Recommendations
router.get('/admission-recommendations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:admission_recommendations'),
  createMedicalDataRoute('admission_recommendations', null, 'read:admission_recommendations')
);

// Case Management
router.get('/case-management/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:case_management'),
  createMedicalDataRoute('case_management', null, 'read:case_management')
);

// Proposed Art Switch
router.get('/proposed-art-switch/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:proposed_art_switch'),
  createMedicalDataRoute('proposed_art_switch', null, 'read:proposed_art_switch')
);

// Hiv History
router.get('/hiv-history/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hiv_history'),
  createMedicalDataRoute('hiv_history', null, 'read:hiv_history')
);

// Current Opportunistic Infections
router.get('/current-opportunistic-infections/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:current_opportunistic_infections'),
  createMedicalDataRoute('current_opportunistic_infections', null, 'read:current_opportunistic_infections')
);

// Food Insecurity
router.get('/food-insecurity/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:food_insecurity'),
  createMedicalDataRoute('food_insecurity', null, 'read:food_insecurity')
);

// Smoking Cessation Program
router.get('/smoking-cessation-program/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:smoking_cessation_program'),
  createMedicalDataRoute('smoking_cessation_program', null, 'read:smoking_cessation_program')
);

// Harm Reduction Counseling
router.get('/harm-reduction-counseling/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:harm_reduction_counseling'),
  createMedicalDataRoute('harm_reduction_counseling', null, 'read:harm_reduction_counseling')
);

// Cognitive Behavioral Therapy
router.get('/cognitive-behavioral-therapy/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cognitive_behavioral_therapy'),
  createMedicalDataRoute('cognitive_behavioral_therapy', null, 'read:cognitive_behavioral_therapy')
);

// Support Groups
router.get('/support-groups/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:support_groups'),
  createMedicalDataRoute('support_groups', null, 'read:support_groups')
);

// Food Assistance Programs
router.get('/food-assistance-programs/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:food_assistance_programs'),
  createMedicalDataRoute('food_assistance_programs', null, 'read:food_assistance_programs')
);

// Appetite Stimulants
router.get('/appetite-stimulants/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:appetite_stimulants'),
  createMedicalDataRoute('appetite_stimulants', null, 'read:appetite_stimulants')
);

// Social Services Programs
router.get('/social-services-programs/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:social_services_programs'),
  createMedicalDataRoute('social_services_programs', null, 'read:social_services_programs')
);

// Immune Reconstitution Planning
router.get('/immune-reconstitution-planning/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:immune_reconstitution_planning'),
  createMedicalDataRoute('immune_reconstitution_planning', null, 'read:immune_reconstitution_planning')
);

// Primary Prophylaxis
router.get('/primary-prophylaxis/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:primary_prophylaxis'),
  createMedicalDataRoute('primary_prophylaxis', null, 'read:primary_prophylaxis')
);

// Secondary Prophylaxis
router.get('/secondary-prophylaxis/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:secondary_prophylaxis'),
  createMedicalDataRoute('secondary_prophylaxis', null, 'read:secondary_prophylaxis')
);

// Cmv Monitoring Plan
router.get('/cmv-monitoring-plan/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cmv_monitoring_plan'),
  createMedicalDataRoute('cmv_monitoring_plan', null, 'read:cmv_monitoring_plan')
);

// Anesthesia Records
router.get('/anesthesia-records/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:anesthesia_records'),
  createMedicalDataRoute('anesthesia_records', null, 'read:anesthesia_records')
);

// Operative Reports
router.get('/operative-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:operative_reports'),
  createMedicalDataRoute('operative_reports', null, 'read:operative_reports')
);

// Operative Report Details
router.get('/operative-report-details/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:operative_report_details'),
  createMedicalDataRoute('operative_report_details', null, 'read:operative_report_details')
);

// Patient Positioning
router.get('/patient-positioning/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_positioning'),
  createMedicalDataRoute('patient_positioning', null, 'read:patient_positioning')
);

// Prep And Drape
router.get('/prep-and-drape/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:prep_and_drape'),
  createMedicalDataRoute('prep_and_drape', null, 'read:prep_and_drape')
);

// Pneumoperitoneum
router.get('/pneumoperitoneum/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pneumoperitoneum'),
  createMedicalDataRoute('pneumoperitoneum', null, 'read:pneumoperitoneum')
);

// Port Placement
router.get('/port-placement/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:port_placement'),
  createMedicalDataRoute('port_placement', null, 'read:port_placement')
);

// Critical View Of Safety
router.get('/critical-view-of-safety/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:critical_view_of_safety'),
  createMedicalDataRoute('critical_view_of_safety', null, 'read:critical_view_of_safety')
);

// Intraoperative Cholangiography
router.get('/intraoperative-cholangiography/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:intraoperative_cholangiography'),
  createMedicalDataRoute('intraoperative_cholangiography', null, 'read:intraoperative_cholangiography')
);

// Surgical Steps
router.get('/surgical-steps/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:surgical_steps'),
  createMedicalDataRoute('surgical_steps', null, 'read:surgical_steps')
);

// Pathology Gross Description
router.get('/pathology-gross-description/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pathology_gross_description'),
  createMedicalDataRoute('pathology_gross_description', null, 'read:pathology_gross_description')
);

// Closure Technique
router.get('/closure-technique/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:closure_technique'),
  createMedicalDataRoute('closure_technique', null, 'read:closure_technique')
);

// Sponge Instrument Counts
router.get('/sponge-instrument-counts/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:sponge_instrument_counts'),
  createMedicalDataRoute('sponge_instrument_counts', null, 'read:sponge_instrument_counts')
);

// Operative Time
router.get('/operative-time/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:operative_time'),
  createMedicalDataRoute('operative_time', null, 'read:operative_time')
);

// Post Operative Reports
router.get('/post-operative-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:post_operative_reports'),
  createMedicalDataRoute('post_operative_reports', null, 'read:post_operative_reports')
);

// Pre Operative Assessments
router.get('/pre-operative-assessments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pre_operative_assessments'),
  createMedicalDataRoute('pre_operative_assessments', null, 'read:pre_operative_assessments')
);

// Surgical Consent Forms
router.get('/surgical-consent-forms/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:surgical_consent_forms'),
  createMedicalDataRoute('surgical_consent_forms', null, 'read:surgical_consent_forms')
);

// Cardiac Catheterization Reports
router.get('/cardiac-catheterization-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cardiac_catheterization_reports'),
  createMedicalDataRoute('cardiac_catheterization_reports', null, 'read:cardiac_catheterization_reports')
);

// Cardiac Rehabilitation Reports
router.get('/cardiac-rehabilitation-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cardiac_rehabilitation_reports'),
  createMedicalDataRoute('cardiac_rehabilitation_reports', null, 'read:cardiac_rehabilitation_reports')
);

// Cardiology Admission Notes
router.get('/cardiology-admission-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cardiology_admission_notes'),
  createMedicalDataRoute('cardiology_admission_notes', null, 'read:cardiology_admission_notes')
);

// Cardiology Consultations
router.get('/cardiology-consultations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cardiology_consultations'),
  createMedicalDataRoute('cardiology_consultations', null, 'read:cardiology_consultations')
);

// Cardiology Followup Reports
router.get('/cardiology-followup-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cardiology_followup_reports'),
  createMedicalDataRoute('cardiology_followup_reports', null, 'read:cardiology_followup_reports')
);

// Ecg Reports
router.get('/ecg-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ecg_reports'),
  createMedicalDataRoute('ecg_reports', null, 'read:ecg_reports')
);

// Echo Reports
router.get('/echo-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:echo_reports'),
  createMedicalDataRoute('echo_reports', null, 'read:echo_reports')
);

// Stress Test Reports
router.get('/stress-test-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:stress_test_reports'),
  createMedicalDataRoute('stress_test_reports', null, 'read:stress_test_reports')
);

// Diagnostic Studies
router.get('/diagnostic-studies/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:diagnostic_studies'),
  createMedicalDataRoute('diagnostic_studies', null, 'read:diagnostic_studies')
);

// Eeg Reports
router.get('/eeg-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:eeg_reports'),
  createMedicalDataRoute('eeg_reports', null, 'read:eeg_reports')
);

// Emg Reports
router.get('/emg-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:emg_reports'),
  createMedicalDataRoute('emg_reports', null, 'read:emg_reports')
);

// Interval History
router.get('/interval-history/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:interval_history'),
  createMedicalDataRoute('interval_history', null, 'read:interval_history')
);

// Neurology Consultations
router.get('/neurology-consultations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:neurology_consultations'),
  createMedicalDataRoute('neurology_consultations', null, 'read:neurology_consultations')
);

// Neurology Progress Notes
router.get('/neurology-progress-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:neurology_progress_notes'),
  createMedicalDataRoute('neurology_progress_notes', null, 'read:neurology_progress_notes')
);

// Neuropsychological Assessments
router.get('/neuropsychological-assessments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:neuropsychological_assessments'),
  createMedicalDataRoute('neuropsychological_assessments', null, 'read:neuropsychological_assessments')
);

// Mental Health Assessments
router.get('/mental-health-assessments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:mental_health_assessments'),
  createMedicalDataRoute('mental_health_assessments', null, 'read:mental_health_assessments')
);

// Psychiatric Discharge Summaries
router.get('/psychiatric-discharge-summaries/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:psychiatric_discharge_summaries'),
  createMedicalDataRoute('psychiatric_discharge_summaries', null, 'read:psychiatric_discharge_summaries')
);

// Psychiatric Evaluations
router.get('/psychiatric-evaluations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:psychiatric_evaluations'),
  createMedicalDataRoute('psychiatric_evaluations', null, 'read:psychiatric_evaluations')
);

// Psychiatric Progress Notes
router.get('/psychiatric-progress-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:psychiatric_progress_notes'),
  createMedicalDataRoute('psychiatric_progress_notes', null, 'read:psychiatric_progress_notes')
);

// Therapy Session Notes
router.get('/therapy-session-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:therapy_session_notes'),
  createMedicalDataRoute('therapy_session_notes', null, 'read:therapy_session_notes')
);

// Apgar Scores
router.get('/apgar-scores/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:apgar_scores'),
  createMedicalDataRoute('apgar_scores', null, 'read:apgar_scores')
);

// Developmental Assessments
router.get('/developmental-assessments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:developmental_assessments'),
  createMedicalDataRoute('developmental_assessments', null, 'read:developmental_assessments')
);

// Newborn Screening Results
router.get('/newborn-screening-results/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:newborn_screening_results'),
  createMedicalDataRoute('newborn_screening_results', null, 'read:newborn_screening_results')
);

// Pediatric Growth Charts
router.get('/pediatric-growth-charts/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pediatric_growth_charts'),
  createMedicalDataRoute('pediatric_growth_charts', null, 'read:pediatric_growth_charts')
);

// Pediatric Vaccination Records
router.get('/pediatric-vaccination-records/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pediatric_vaccination_records'),
  createMedicalDataRoute('pediatric_vaccination_records', null, 'read:pediatric_vaccination_records')
);

// Pediatric Visits
router.get('/pediatric-visits/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pediatric_visits'),
  createMedicalDataRoute('pediatric_visits', null, 'read:pediatric_visits')
);

// Well Child Examinations
router.get('/well-child-examinations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:well_child_examinations'),
  createMedicalDataRoute('well_child_examinations', null, 'read:well_child_examinations')
);

// Amniocentesis Reports
router.get('/amniocentesis-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:amniocentesis_reports'),
  createMedicalDataRoute('amniocentesis_reports', null, 'read:amniocentesis_reports')
);

// Gynecology Consultations
router.get('/gynecology-consultations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:gynecology_consultations'),
  createMedicalDataRoute('gynecology_consultations', null, 'read:gynecology_consultations')
);

// Labor Delivery Records
router.get('/labor-delivery-records/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:labor_delivery_records'),
  createMedicalDataRoute('labor_delivery_records', null, 'read:labor_delivery_records')
);

// Maternal Fetal Reports
router.get('/maternal-fetal-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:maternal_fetal_reports'),
  createMedicalDataRoute('maternal_fetal_reports', null, 'read:maternal_fetal_reports')
);

// Obstetric Ultrasound Reports
router.get('/obstetric-ultrasound-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:obstetric_ultrasound_reports'),
  createMedicalDataRoute('obstetric_ultrasound_reports', null, 'read:obstetric_ultrasound_reports')
);

// Postpartum Notes
router.get('/postpartum-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:postpartum_notes'),
  createMedicalDataRoute('postpartum_notes', null, 'read:postpartum_notes')
);

// Prenatal Testing Reports
router.get('/prenatal-testing-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:prenatal_testing_reports'),
  createMedicalDataRoute('prenatal_testing_reports', null, 'read:prenatal_testing_reports')
);

// Prenatal Visits
router.get('/prenatal-visits/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:prenatal_visits'),
  createMedicalDataRoute('prenatal_visits', null, 'read:prenatal_visits')
);

// Ultrasound Ob Reports
router.get('/ultrasound-ob-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ultrasound_ob_reports'),
  createMedicalDataRoute('ultrasound_ob_reports', null, 'read:ultrasound_ob_reports')
);

// Chemotherapy Records
router.get('/chemotherapy-records/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:chemotherapy_records'),
  createMedicalDataRoute('chemotherapy_records', null, 'read:chemotherapy_records')
);

// Oncology Consultations
router.get('/oncology-consultations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:oncology_consultations'),
  createMedicalDataRoute('oncology_consultations', null, 'read:oncology_consultations')
);

// Oncology Followup Reports
router.get('/oncology-followup-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:oncology_followup_reports'),
  createMedicalDataRoute('oncology_followup_reports', null, 'read:oncology_followup_reports')
);

// Oncology Treatment Plans
router.get('/oncology-treatment-plans/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:oncology_treatment_plans'),
  createMedicalDataRoute('oncology_treatment_plans', null, 'read:oncology_treatment_plans')
);

// Radiation Therapy Records
router.get('/radiation-therapy-records/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:radiation_therapy_records'),
  createMedicalDataRoute('radiation_therapy_records', null, 'read:radiation_therapy_records')
);

// Tumor Board Notes
router.get('/tumor-board-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:tumor_board_notes'),
  createMedicalDataRoute('tumor_board_notes', null, 'read:tumor_board_notes')
);

// Tumor Marker Panels
router.get('/tumor-marker-panels/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:tumor_marker_panels'),
  createMedicalDataRoute('tumor_marker_panels', null, 'read:tumor_marker_panels')
);

// Diabetes Management Notes
router.get('/diabetes-management-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:diabetes_management_notes'),
  createMedicalDataRoute('diabetes_management_notes', null, 'read:diabetes_management_notes')
);

// Endocrinology Consultations
router.get('/endocrinology-consultations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:endocrinology_consultations'),
  createMedicalDataRoute('endocrinology_consultations', null, 'read:endocrinology_consultations')
);

// Hormone Panels
router.get('/hormone-panels/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hormone_panels'),
  createMedicalDataRoute('hormone_panels', null, 'read:hormone_panels')
);

// Hormone Therapy Records
router.get('/hormone-therapy-records/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hormone_therapy_records'),
  createMedicalDataRoute('hormone_therapy_records', null, 'read:hormone_therapy_records')
);

// Thyroid Evaluations
router.get('/thyroid-evaluations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:thyroid_evaluations'),
  createMedicalDataRoute('thyroid_evaluations', null, 'read:thyroid_evaluations')
);

// Colonoscopy Reports
router.get('/colonoscopy-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:colonoscopy_reports'),
  createMedicalDataRoute('colonoscopy_reports', null, 'read:colonoscopy_reports')
);

// Endoscopy Reports
router.get('/endoscopy-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:endoscopy_reports'),
  createMedicalDataRoute('endoscopy_reports', null, 'read:endoscopy_reports')
);

// Gastroenterology Consultations
router.get('/gastroenterology-consultations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:gastroenterology_consultations'),
  createMedicalDataRoute('gastroenterology_consultations', null, 'read:gastroenterology_consultations')
);

// Ibd Consultation Details
router.get('/ibd-consultation-details/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ibd_consultation_details'),
  createMedicalDataRoute('ibd_consultation_details', null, 'read:ibd_consultation_details')
);

// Mayo Score
router.get('/mayo-score/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:mayo_score'),
  createMedicalDataRoute('mayo_score', null, 'read:mayo_score')
);

// Symptom Progression Timeline
router.get('/symptom-progression-timeline/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:symptom_progression_timeline'),
  createMedicalDataRoute('symptom_progression_timeline', null, 'read:symptom_progression_timeline')
);

// Infliximab Drug Monitoring
router.get('/infliximab-drug-monitoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:infliximab_drug_monitoring'),
  createMedicalDataRoute('infliximab_drug_monitoring', null, 'read:infliximab_drug_monitoring')
);

// Fecal Calprotectin
router.get('/fecal-calprotectin/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fecal_calprotectin'),
  createMedicalDataRoute('fecal_calprotectin', null, 'read:fecal_calprotectin')
);

// Rescue Therapy Options
router.get('/rescue-therapy-options/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:rescue_therapy_options'),
  createMedicalDataRoute('rescue_therapy_options', null, 'read:rescue_therapy_options')
);

// Ibd Care Team
router.get('/ibd-care-team/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ibd_care_team'),
  createMedicalDataRoute('ibd_care_team', null, 'read:ibd_care_team')
);

// Barriers Psychosocial Issues
router.get('/barriers-psychosocial-issues/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:barriers_psychosocial_issues'),
  createMedicalDataRoute('barriers_psychosocial_issues', null, 'read:barriers_psychosocial_issues')
);

// Inflammatory Bowel Reports
router.get('/inflammatory-bowel-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:inflammatory_bowel_reports'),
  createMedicalDataRoute('inflammatory_bowel_reports', null, 'read:inflammatory_bowel_reports')
);

// Liver Function Assessments
router.get('/liver-function-assessments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:liver_function_assessments'),
  createMedicalDataRoute('liver_function_assessments', null, 'read:liver_function_assessments')
);

// Asthma Management Notes
router.get('/asthma-management-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:asthma_management_notes'),
  createMedicalDataRoute('asthma_management_notes', null, 'read:asthma_management_notes')
);

// Copd Assessments
router.get('/copd-assessments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:copd_assessments'),
  createMedicalDataRoute('copd_assessments', null, 'read:copd_assessments')
);

// Pulmonary Function Tests
router.get('/pulmonary-function-tests/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pulmonary_function_tests'),
  createMedicalDataRoute('pulmonary_function_tests', null, 'read:pulmonary_function_tests')
);

// Pulmonary Rehabilitation Notes
router.get('/pulmonary-rehabilitation-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pulmonary_rehabilitation_notes'),
  createMedicalDataRoute('pulmonary_rehabilitation_notes', null, 'read:pulmonary_rehabilitation_notes')
);

// Pulmonology Consultations
router.get('/pulmonology-consultations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pulmonology_consultations'),
  createMedicalDataRoute('pulmonology_consultations', null, 'read:pulmonology_consultations')
);

// Sleep Study Reports
router.get('/sleep-study-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:sleep_study_reports'),
  createMedicalDataRoute('sleep_study_reports', null, 'read:sleep_study_reports')
);

// Dialysis Records
router.get('/dialysis-records/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dialysis_records'),
  createMedicalDataRoute('dialysis_records', null, 'read:dialysis_records')
);

// Dialysis Run Sheets
router.get('/dialysis-run-sheets/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dialysis_run_sheets'),
  createMedicalDataRoute('dialysis_run_sheets', null, 'read:dialysis_run_sheets')
);

// Dialysis Run Sheet
router.get('/dialysis-run-sheet/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dialysis_run_sheet'),
  createMedicalDataRoute('dialysis_run_sheet', null, 'read:dialysis_run_sheet')
);

// Pre Dialysis Assessment
router.get('/pre-dialysis-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pre_dialysis_assessment'),
  createMedicalDataRoute('pre_dialysis_assessment', null, 'read:pre_dialysis_assessment')
);

// Dialysis Prescription
router.get('/dialysis-prescription/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dialysis_prescription'),
  createMedicalDataRoute('dialysis_prescription', null, 'read:dialysis_prescription')
);

// Dialyzer
router.get('/dialyzer/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dialyzer'),
  createMedicalDataRoute('dialyzer', null, 'read:dialyzer')
);

// Dialysate Composition
router.get('/dialysate-composition/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dialysate_composition'),
  createMedicalDataRoute('dialysate_composition', null, 'read:dialysate_composition')
);

// Intradialytic Monitoring
router.get('/intradialytic-monitoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:intradialytic_monitoring'),
  createMedicalDataRoute('intradialytic_monitoring', null, 'read:intradialytic_monitoring')
);

// Medications Administered
router.get('/medications-administered/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medications_administered'),
  createMedicalDataRoute('medications_administered', null, 'read:medications_administered')
);

// Post Dialysis Assessment
router.get('/post-dialysis-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:post_dialysis_assessment'),
  createMedicalDataRoute('post_dialysis_assessment', null, 'read:post_dialysis_assessment')
);

// Kidney Function Reports
router.get('/kidney-function-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:kidney_function_reports'),
  createMedicalDataRoute('kidney_function_reports', null, 'read:kidney_function_reports')
);

// Nephrology Consultations
router.get('/nephrology-consultations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:nephrology_consultations'),
  createMedicalDataRoute('nephrology_consultations', null, 'read:nephrology_consultations')
);

// Nephrology Consultation Details
router.get('/nephrology-consultation-details/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:nephrology_consultation_details'),
  createMedicalDataRoute('nephrology_consultation_details', null, 'read:nephrology_consultation_details')
);

// Kidney Disease Progression Timeline
router.get('/kidney-disease-progression-timeline/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:kidney_disease_progression_timeline'),
  createMedicalDataRoute('kidney_disease_progression_timeline', null, 'read:kidney_disease_progression_timeline')
);

// Estimated Time To Dialysis
router.get('/estimated-time-to-dialysis/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:estimated_time_to_dialysis'),
  createMedicalDataRoute('estimated_time_to_dialysis', null, 'read:estimated_time_to_dialysis')
);

// Education Initiated
router.get('/education-initiated/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:education_initiated'),
  createMedicalDataRoute('education_initiated', null, 'read:education_initiated')
);

// Access Planning
router.get('/access-planning/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:access_planning'),
  createMedicalDataRoute('access_planning', null, 'read:access_planning')
);

// Depression Screening
router.get('/depression-screening/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:depression_screening'),
  createMedicalDataRoute('depression_screening', null, 'read:depression_screening')
);

// Advance Directive Discussion
router.get('/advance-directive-discussion/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:advance_directive_discussion'),
  createMedicalDataRoute('advance_directive_discussion', null, 'read:advance_directive_discussion')
);

// Prognosis Discussion
router.get('/prognosis-discussion/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:prognosis_discussion'),
  createMedicalDataRoute('prognosis_discussion', null, 'read:prognosis_discussion')
);

// Transplant Evaluations
router.get('/transplant-evaluations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:transplant_evaluations'),
  createMedicalDataRoute('transplant_evaluations', null, 'read:transplant_evaluations')
);

// Arthritis Assessments
router.get('/arthritis-assessments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:arthritis_assessments'),
  createMedicalDataRoute('arthritis_assessments', null, 'read:arthritis_assessments')
);

// Autoimmune Evaluations
router.get('/autoimmune-evaluations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:autoimmune_evaluations'),
  createMedicalDataRoute('autoimmune_evaluations', null, 'read:autoimmune_evaluations')
);

// Autoimmune Panels
router.get('/autoimmune-panels/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:autoimmune_panels'),
  createMedicalDataRoute('autoimmune_panels', null, 'read:autoimmune_panels')
);

// Rheumatology Consultations
router.get('/rheumatology-consultations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:rheumatology_consultations'),
  createMedicalDataRoute('rheumatology_consultations', null, 'read:rheumatology_consultations')
);

// Blood Disorder Reports
router.get('/blood-disorder-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:blood_disorder_reports'),
  createMedicalDataRoute('blood_disorder_reports', null, 'read:blood_disorder_reports')
);

// Bone Marrow Reports
router.get('/bone-marrow-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:bone_marrow_reports'),
  createMedicalDataRoute('bone_marrow_reports', null, 'read:bone_marrow_reports')
);

// Coagulation Studies
router.get('/coagulation-studies/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:coagulation_studies'),
  createMedicalDataRoute('coagulation_studies', null, 'read:coagulation_studies')
);

// Hematology Consultations
router.get('/hematology-consultations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hematology_consultations'),
  createMedicalDataRoute('hematology_consultations', null, 'read:hematology_consultations')
);

// Orthopedic Consultations
router.get('/orthopedic-consultations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:orthopedic_consultations'),
  createMedicalDataRoute('orthopedic_consultations', null, 'read:orthopedic_consultations')
);

// Orthopedic Followup Notes
router.get('/orthopedic-followup-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:orthopedic_followup_notes'),
  createMedicalDataRoute('orthopedic_followup_notes', null, 'read:orthopedic_followup_notes')
);

// Orthopedic Operative Reports
router.get('/orthopedic-operative-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:orthopedic_operative_reports'),
  createMedicalDataRoute('orthopedic_operative_reports', null, 'read:orthopedic_operative_reports')
);

// Glaucoma Assessments
router.get('/glaucoma-assessments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:glaucoma_assessments'),
  createMedicalDataRoute('glaucoma_assessments', null, 'read:glaucoma_assessments')
);

// Ophthalmology Examinations
router.get('/ophthalmology-examinations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ophthalmology_examinations'),
  createMedicalDataRoute('ophthalmology_examinations', null, 'read:ophthalmology_examinations')
);

// Retinal Examinations
router.get('/retinal-examinations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:retinal_examinations'),
  createMedicalDataRoute('retinal_examinations', null, 'read:retinal_examinations')
);

// Visual Acuity Reports
router.get('/visual-acuity-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:visual_acuity_reports'),
  createMedicalDataRoute('visual_acuity_reports', null, 'read:visual_acuity_reports')
);

// Audiometry Reports
router.get('/audiometry-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:audiometry_reports'),
  createMedicalDataRoute('audiometry_reports', null, 'read:audiometry_reports')
);

// Ent Consultations
router.get('/ent-consultations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ent_consultations'),
  createMedicalDataRoute('ent_consultations', null, 'read:ent_consultations')
);

// Laryngoscopy Reports
router.get('/laryngoscopy-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:laryngoscopy_reports'),
  createMedicalDataRoute('laryngoscopy_reports', null, 'read:laryngoscopy_reports')
);

// Dermatology Consultations
router.get('/dermatology-consultations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dermatology_consultations'),
  createMedicalDataRoute('dermatology_consultations', null, 'read:dermatology_consultations')
);

// Dermatology Procedure Notes
router.get('/dermatology-procedure-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dermatology_procedure_notes'),
  createMedicalDataRoute('dermatology_procedure_notes', null, 'read:dermatology_procedure_notes')
);

// Skin Biopsy Reports
router.get('/skin-biopsy-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:skin_biopsy_reports'),
  createMedicalDataRoute('skin_biopsy_reports', null, 'read:skin_biopsy_reports')
);

// Cystoscopy Reports
router.get('/cystoscopy-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cystoscopy_reports'),
  createMedicalDataRoute('cystoscopy_reports', null, 'read:cystoscopy_reports')
);

// Urodynamic Studies
router.get('/urodynamic-studies/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:urodynamic_studies'),
  createMedicalDataRoute('urodynamic_studies', null, 'read:urodynamic_studies')
);

// Urology Consultations
router.get('/urology-consultations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:urology_consultations'),
  createMedicalDataRoute('urology_consultations', null, 'read:urology_consultations')
);

// Cognitive Evaluations
router.get('/cognitive-evaluations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cognitive_evaluations'),
  createMedicalDataRoute('cognitive_evaluations', null, 'read:cognitive_evaluations')
);

// Fall Risk Assessments
router.get('/fall-risk-assessments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fall_risk_assessments'),
  createMedicalDataRoute('fall_risk_assessments', null, 'read:fall_risk_assessments')
);

// Geriatric Assessments
router.get('/geriatric-assessments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:geriatric_assessments'),
  createMedicalDataRoute('geriatric_assessments', null, 'read:geriatric_assessments')
);

// Polypharmacy Reviews
router.get('/polypharmacy-reviews/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:polypharmacy_reviews'),
  createMedicalDataRoute('polypharmacy_reviews', null, 'read:polypharmacy_reviews')
);

// Autopsy Reports
router.get('/autopsy-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:autopsy_reports'),
  createMedicalDataRoute('autopsy_reports', null, 'read:autopsy_reports')
);

// Biopsy Reports
router.get('/biopsy-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:biopsy_reports'),
  createMedicalDataRoute('biopsy_reports', null, 'read:biopsy_reports')
);

// Oral Pathology Biopsy
router.get('/oral-pathology-biopsy/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:oral_pathology_biopsy'),
  createMedicalDataRoute('oral_pathology_biopsy', null, 'read:oral_pathology_biopsy')
);

// Cytology Reports
router.get('/cytology-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cytology_reports'),
  createMedicalDataRoute('cytology_reports', null, 'read:cytology_reports')
);

// Pathology Reports
router.get('/pathology-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pathology_reports'),
  createMedicalDataRoute('pathology_reports', null, 'read:pathology_reports')
);

// Bone Scan Reports
router.get('/bone-scan-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:bone_scan_reports'),
  createMedicalDataRoute('bone_scan_reports', null, 'read:bone_scan_reports')
);

// Dexa Scan Reports
router.get('/dexa-scan-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dexa_scan_reports'),
  createMedicalDataRoute('dexa_scan_reports', null, 'read:dexa_scan_reports')
);

// Interventional Radiology Notes
router.get('/interventional-radiology-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:interventional_radiology_notes'),
  createMedicalDataRoute('interventional_radiology_notes', null, 'read:interventional_radiology_notes')
);

// Mammography Reports
router.get('/mammography-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:mammography_reports'),
  createMedicalDataRoute('mammography_reports', null, 'read:mammography_reports')
);

// Mri Reports
router.get('/mri-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:mri_reports'),
  createMedicalDataRoute('mri_reports', null, 'read:mri_reports')
);

// Pet Scan Reports
router.get('/pet-scan-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pet_scan_reports'),
  createMedicalDataRoute('pet_scan_reports', null, 'read:pet_scan_reports')
);

// Radiology Reports
router.get('/radiology-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:radiology_reports'),
  createMedicalDataRoute('radiology_reports', null, 'read:radiology_reports')
);

// Antibiogram Reports
router.get('/antibiogram-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:antibiogram_reports'),
  createMedicalDataRoute('antibiogram_reports', null, 'read:antibiogram_reports')
);

// Blood Glucose Logs
router.get('/blood-glucose-logs/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:blood_glucose_logs'),
  createMedicalDataRoute('blood_glucose_logs', null, 'read:blood_glucose_logs')
);

// Flow Cytometry Reports
router.get('/flow-cytometry-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:flow_cytometry_reports'),
  createMedicalDataRoute('flow_cytometry_reports', null, 'read:flow_cytometry_reports')
);

// Genetic Testing Reports
router.get('/genetic-testing-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:genetic_testing_reports'),
  createMedicalDataRoute('genetic_testing_reports', null, 'read:genetic_testing_reports')
);

// Microbiology Culture Reports
router.get('/microbiology-culture-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:microbiology_culture_reports'),
  createMedicalDataRoute('microbiology_culture_reports', null, 'read:microbiology_culture_reports')
);

// Toxicology Reports
router.get('/toxicology-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:toxicology_reports'),
  createMedicalDataRoute('toxicology_reports', null, 'read:toxicology_reports')
);

// Dental Examination Reports
router.get('/dental-examination-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dental_examination_reports'),
  createMedicalDataRoute('dental_examination_reports', null, 'read:dental_examination_reports')
);

// Oral Surgery Reports
router.get('/oral-surgery-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:oral_surgery_reports'),
  createMedicalDataRoute('oral_surgery_reports', null, 'read:oral_surgery_reports')
);

// Orthodontic Treatment Plans
router.get('/orthodontic-treatment-plans/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:orthodontic_treatment_plans'),
  createMedicalDataRoute('orthodontic_treatment_plans', null, 'read:orthodontic_treatment_plans')
);

// Periodontal Charts
router.get('/periodontal-charts/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:periodontal_charts'),
  createMedicalDataRoute('periodontal_charts', null, 'read:periodontal_charts')
);

// Cognitive Rehabilitation Reports
router.get('/cognitive-rehabilitation-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cognitive_rehabilitation_reports'),
  createMedicalDataRoute('cognitive_rehabilitation_reports', null, 'read:cognitive_rehabilitation_reports')
);

// Occupational Therapy Reports
router.get('/occupational-therapy-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:occupational_therapy_reports'),
  createMedicalDataRoute('occupational_therapy_reports', null, 'read:occupational_therapy_reports')
);

// Physical Therapy Evaluations
router.get('/physical-therapy-evaluations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:physical_therapy_evaluations'),
  createMedicalDataRoute('physical_therapy_evaluations', null, 'read:physical_therapy_evaluations')
);

// Physical Therapy Notes
router.get('/physical-therapy-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:physical_therapy_notes'),
  createMedicalDataRoute('physical_therapy_notes', null, 'read:physical_therapy_notes')
);

// Rehabilitation Progress Notes
router.get('/rehabilitation-progress-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:rehabilitation_progress_notes'),
  createMedicalDataRoute('rehabilitation_progress_notes', null, 'read:rehabilitation_progress_notes')
);

// Speech Therapy Assessments
router.get('/speech-therapy-assessments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:speech_therapy_assessments'),
  createMedicalDataRoute('speech_therapy_assessments', null, 'read:speech_therapy_assessments')
);

// Intake Output Records
router.get('/intake-output-records/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:intake_output_records'),
  createMedicalDataRoute('intake_output_records', null, 'read:intake_output_records')
);

// Medication Administration Records
router.get('/medication-administration-records/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medication_administration_records'),
  createMedicalDataRoute('medication_administration_records', null, 'read:medication_administration_records')
);

// Medication Administration Record
router.get('/medication-administration-record/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medication_administration_record'),
  createMedicalDataRoute('medication_administration_record', null, 'read:medication_administration_record')
);

// Scheduled Medications
router.get('/scheduled-medications/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:scheduled_medications'),
  createMedicalDataRoute('scheduled_medications', null, 'read:scheduled_medications')
);

// Prn Medications
router.get('/prn-medications/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:prn_medications'),
  createMedicalDataRoute('prn_medications', null, 'read:prn_medications')
);

// Iv Infusions
router.get('/iv-infusions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:iv_infusions'),
  createMedicalDataRoute('iv_infusions', null, 'read:iv_infusions')
);

// Blood Glucose Monitoring
router.get('/blood-glucose-monitoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:blood_glucose_monitoring'),
  createMedicalDataRoute('blood_glucose_monitoring', null, 'read:blood_glucose_monitoring')
);

// Omissions Refusals
router.get('/omissions-refusals/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:omissions_refusals'),
  createMedicalDataRoute('omissions_refusals', null, 'read:omissions_refusals')
);

// Nurse Signatures
router.get('/nurse-signatures/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:nurse_signatures'),
  createMedicalDataRoute('nurse_signatures', null, 'read:nurse_signatures')
);

// Pharmacy Review
router.get('/pharmacy-review/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pharmacy_review'),
  createMedicalDataRoute('pharmacy_review', null, 'read:pharmacy_review')
);

// Monitoring Reports
router.get('/monitoring-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:monitoring_reports'),
  createMedicalDataRoute('monitoring_reports', null, 'read:monitoring_reports')
);

// Nicu Progress Notes
router.get('/nicu-progress-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:nicu_progress_notes'),
  createMedicalDataRoute('nicu_progress_notes', null, 'read:nicu_progress_notes')
);

// Nursing Assessments
router.get('/nursing-assessments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:nursing_assessments'),
  createMedicalDataRoute('nursing_assessments', null, 'read:nursing_assessments')
);

// Pain Assessment Forms
router.get('/pain-assessment-forms/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pain_assessment_forms'),
  createMedicalDataRoute('pain_assessment_forms', null, 'read:pain_assessment_forms')
);

// Progress Notes
router.get('/progress-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:progress_notes'),
  createMedicalDataRoute('progress_notes', null, 'read:progress_notes')
);

// Shift Handoff Notes
router.get('/shift-handoff-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:shift_handoff_notes'),
  createMedicalDataRoute('shift_handoff_notes', null, 'read:shift_handoff_notes')
);

// Soap Notes
router.get('/soap-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:soap_notes'),
  createMedicalDataRoute('soap_notes', null, 'read:soap_notes')
);

// Therapy Progress Notes
router.get('/therapy-progress-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:therapy_progress_notes'),
  createMedicalDataRoute('therapy_progress_notes', null, 'read:therapy_progress_notes')
);

// Vital Signs Logs
router.get('/vital-signs-logs/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:vital_signs_logs'),
  createMedicalDataRoute('vital_signs_logs', null, 'read:vital_signs_logs')
);

// Wound Care Documentation
router.get('/wound-care-documentation/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:wound_care_documentation'),
  createMedicalDataRoute('wound_care_documentation', null, 'read:wound_care_documentation')
);

// Wound Care Notes
router.get('/wound-care-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:wound_care_notes'),
  createMedicalDataRoute('wound_care_notes', null, 'read:wound_care_notes')
);

// Code Blue Summaries
router.get('/code-blue-summaries/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:code_blue_summaries'),
  createMedicalDataRoute('code_blue_summaries', null, 'read:code_blue_summaries')
);

// Ems Run Reports
router.get('/ems-run-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ems_run_reports'),
  createMedicalDataRoute('ems_run_reports', null, 'read:ems_run_reports')
);

// Poison Control Reports
router.get('/poison-control-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:poison_control_reports'),
  createMedicalDataRoute('poison_control_reports', null, 'read:poison_control_reports')
);

// Rapid Response Summaries
router.get('/rapid-response-summaries/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:rapid_response_summaries'),
  createMedicalDataRoute('rapid_response_summaries', null, 'read:rapid_response_summaries')
);

// Trauma Flow Sheets
router.get('/trauma-flow-sheets/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:trauma_flow_sheets'),
  createMedicalDataRoute('trauma_flow_sheets', null, 'read:trauma_flow_sheets')
);

// Contact Information
router.get('/contact-information/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:contact_information'),
  createMedicalDataRoute('contact_information', null, 'read:contact_information')
);

// Disability Evaluations
router.get('/disability-evaluations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:disability_evaluations'),
  createMedicalDataRoute('disability_evaluations', null, 'read:disability_evaluations')
);

// Dnr Orders
router.get('/dnr-orders/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dnr_orders'),
  createMedicalDataRoute('dnr_orders', null, 'read:dnr_orders')
);

// Fitness For Duty Evaluations
router.get('/fitness-for-duty-evaluations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fitness_for_duty_evaluations'),
  createMedicalDataRoute('fitness_for_duty_evaluations', null, 'read:fitness_for_duty_evaluations')
);

// Insurance Forms
router.get('/insurance-forms/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:insurance_forms'),
  createMedicalDataRoute('insurance_forms', null, 'read:insurance_forms')
);

// Medical Power Of Attorney
router.get('/medical-power-of-attorney/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medical_power_of_attorney'),
  createMedicalDataRoute('medical_power_of_attorney', null, 'read:medical_power_of_attorney')
);

// Medical Reconciliation Forms
router.get('/medical-reconciliation-forms/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medical_reconciliation_forms'),
  createMedicalDataRoute('medical_reconciliation_forms', null, 'read:medical_reconciliation_forms')
);

// Prior Authorization Forms
router.get('/prior-authorization-forms/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:prior_authorization_forms'),
  createMedicalDataRoute('prior_authorization_forms', null, 'read:prior_authorization_forms')
);

// School Health Forms
router.get('/school-health-forms/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:school_health_forms'),
  createMedicalDataRoute('school_health_forms', null, 'read:school_health_forms')
);

// Travel Health Certificates
router.get('/travel-health-certificates/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:travel_health_certificates'),
  createMedicalDataRoute('travel_health_certificates', null, 'read:travel_health_certificates')
);

// Workers Comp Evaluations
router.get('/workers-comp-evaluations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:workers_comp_evaluations'),
  createMedicalDataRoute('workers_comp_evaluations', null, 'read:workers_comp_evaluations')
);

// Document Metadata
router.get('/document-metadata/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:document_metadata'),
  createMedicalDataRoute('document_metadata', null, 'read:document_metadata')
);

// Workplace Accommodations
router.get('/workplace-accommodations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:workplace_accommodations'),
  createMedicalDataRoute('workplace_accommodations', null, 'read:workplace_accommodations')
);

// Employment Counseling
router.get('/employment-counseling/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:employment_counseling'),
  createMedicalDataRoute('employment_counseling', null, 'read:employment_counseling')
);

// Insurance Authorizations
router.get('/insurance-authorizations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:insurance_authorizations'),
  createMedicalDataRoute('insurance_authorizations', null, 'read:insurance_authorizations')
);

// Care Coordination Notes
router.get('/care-coordination-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:care_coordination_notes'),
  createMedicalDataRoute('care_coordination_notes', null, 'read:care_coordination_notes')
);

// Home Health Notes
router.get('/home-health-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:home_health_notes'),
  createMedicalDataRoute('home_health_notes', null, 'read:home_health_notes')
);

// Hospice Notes
router.get('/hospice-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hospice_notes'),
  createMedicalDataRoute('hospice_notes', null, 'read:hospice_notes')
);

// NOTE: nutrition_assessments route REMOVED - use nutritional_assessment instead (per unified schema)

// Pain Management Notes
router.get('/pain-management-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pain_management_notes'),
  createMedicalDataRoute('pain_management_notes', null, 'read:pain_management_notes')
);

// Medication Dosing Recommendation
router.get('/medication-dosing-recommendation/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medication_dosing_recommendation'),
  createMedicalDataRoute('medication_dosing_recommendation', null, 'read:medication_dosing_recommendation')
);

// Malnutrition Risk Assessment
router.get('/malnutrition-risk-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:malnutrition_risk_assessment'),
  createMedicalDataRoute('malnutrition_risk_assessment', null, 'read:malnutrition_risk_assessment')
);

// Social Work Notes
router.get('/social-work-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:social_work_notes'),
  createMedicalDataRoute('social_work_notes', null, 'read:social_work_notes')
);

// Mental Health Resources
router.get('/mental-health-resources/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:mental_health_resources'),
  createMedicalDataRoute('mental_health_resources', null, 'read:mental_health_resources')
);

// Stress Management Referrals
router.get('/stress-management-referrals/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:stress_management_referrals'),
  createMedicalDataRoute('stress_management_referrals', null, 'read:stress_management_referrals')
);

// Exercise Recommendations
router.get('/exercise-recommendations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:exercise_recommendations'),
  createMedicalDataRoute('exercise_recommendations', null, 'read:exercise_recommendations')
);

// Communication Preferences
router.get('/communication-preferences/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:communication_preferences'),
  createMedicalDataRoute('communication_preferences', null, 'read:communication_preferences')
);

// Data Management Instructions
router.get('/data-management-instructions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:data_management_instructions'),
  createMedicalDataRoute('data_management_instructions', null, 'read:data_management_instructions')
);

// Case Summaries
router.get('/case-summaries/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:case_summaries'),
  createMedicalDataRoute('case_summaries', null, 'read:case_summaries')
);

// Second Opinion Reports
router.get('/second-opinion-reports/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:second_opinion_reports'),
  createMedicalDataRoute('second_opinion_reports', null, 'read:second_opinion_reports')
);

// Telemedicine Encounters
router.get('/telemedicine-encounters/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:telemedicine_encounters'),
  createMedicalDataRoute('telemedicine_encounters', null, 'read:telemedicine_encounters')
);

// Clinical Trial Documents
router.get('/clinical-trial-documents/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:clinical_trial_documents'),
  createMedicalDataRoute('clinical_trial_documents', null, 'read:clinical_trial_documents')
);

// Research Consent Forms
router.get('/research-consent-forms/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:research_consent_forms'),
  createMedicalDataRoute('research_consent_forms', null, 'read:research_consent_forms')
);

// Specialty Fields
router.get('/specialty-fields/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:specialty_fields'),
  createMedicalDataRoute('specialty_fields', null, 'read:specialty_fields')
);

// Flexible Data
router.get('/flexible-data/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:flexible_data'),
  createMedicalDataRoute('flexible_data', null, 'read:flexible_data')
);

// Medical History
router.get('/medical-history/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medical_history'),
  createMedicalDataRoute('medical_history', null, 'read:medical_history')
);

// Surgical History
router.get('/surgical-history/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:surgical_history'),
  createMedicalDataRoute('surgical_history', null, 'read:surgical_history')
);

// Family History
router.get('/family-history/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:family_history'),
  createMedicalDataRoute('family_history', null, 'read:family_history')
);

// History Present Illness
router.get('/history-present-illness/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:history_present_illness'),
  createMedicalDataRoute('history_present_illness', null, 'read:history_present_illness')
);

// Review Of Systems
router.get('/review-of-systems/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:review_of_systems'),
  createMedicalDataRoute('review_of_systems', null, 'read:review_of_systems')
);

// Assessment Plans
router.get('/assessment-plans/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:assessment_plans'),
  createMedicalDataRoute('assessment_plans', null, 'read:assessment_plans')
);

// Additional Notes
router.get('/additional-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:additional_notes'),
  createMedicalDataRoute('additional_notes', null, 'read:additional_notes')
);

// Risk Factors
router.get('/risk-factors/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:risk_factors'),
  createMedicalDataRoute('risk_factors', null, 'read:risk_factors')
);

// Follow Up Enhanced
router.get('/follow-up-enhanced/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:follow_up_enhanced'),
  createMedicalDataRoute('follow_up_enhanced', null, 'read:follow_up_enhanced')
);

// Disease Severity
router.get('/disease-severity/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:disease_severity'),
  createMedicalDataRoute('disease_severity', null, 'read:disease_severity')
);

// Urgent Call Criteria
router.get('/urgent-call-criteria/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:urgent_call_criteria'),
  createMedicalDataRoute('urgent_call_criteria', null, 'read:urgent_call_criteria')
);

// Data Upload Instructions
router.get('/data-upload-instructions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:data_upload_instructions'),
  createMedicalDataRoute('data_upload_instructions', null, 'read:data_upload_instructions')
);

// Twenty Four Seven Support
router.get('/twenty-four-seven-support/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:twenty_four_seven_support'),
  createMedicalDataRoute('twenty_four_seven_support', null, 'read:twenty_four_seven_support')
);

// Emergency Information
router.get('/emergency-information/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:emergency_information'),
  createMedicalDataRoute('emergency_information', null, 'read:emergency_information')
);

// Triage Data
router.get('/triage-data/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:triage_data'),
  createMedicalDataRoute('triage_data', null, 'read:triage_data')
);

// Ed Course
router.get('/ed-course/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ed_course'),
  createMedicalDataRoute('ed_course', null, 'read:ed_course')
);

// Consultation Timeline
router.get('/consultation-timeline/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:consultation_timeline'),
  createMedicalDataRoute('consultation_timeline', null, 'read:consultation_timeline')
);

// Preoperative Preparation
router.get('/preoperative-preparation/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:preoperative_preparation'),
  createMedicalDataRoute('preoperative_preparation', null, 'read:preoperative_preparation')
);

// Pre Operative Preparation
router.get('/pre-operative-preparation/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pre_operative_preparation'),
  createMedicalDataRoute('pre_operative_preparation', null, 'read:pre_operative_preparation')
);

// Blood Products Ordered
router.get('/blood-products-ordered/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:blood_products_ordered'),
  createMedicalDataRoute('blood_products_ordered', null, 'read:blood_products_ordered')
);

// Ed Disposition
router.get('/ed-disposition/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ed_disposition'),
  createMedicalDataRoute('ed_disposition', null, 'read:ed_disposition')
);

// Injury Details
router.get('/injury-details/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:injury_details'),
  createMedicalDataRoute('injury_details', null, 'read:injury_details')
);

// Procedural Sedation
router.get('/procedural-sedation/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:procedural_sedation'),
  createMedicalDataRoute('procedural_sedation', null, 'read:procedural_sedation')
);

// Work Restrictions
router.get('/work-restrictions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:work_restrictions'),
  createMedicalDataRoute('work_restrictions', null, 'read:work_restrictions')
);

// Diabetes Management
router.get('/diabetes-management/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:diabetes_management'),
  createMedicalDataRoute('diabetes_management', null, 'read:diabetes_management')
);

// Insulin Pump Settings
router.get('/insulin-pump-settings/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:insulin_pump_settings'),
  createMedicalDataRoute('insulin_pump_settings', null, 'read:insulin_pump_settings')
);

// Cgm Data
router.get('/cgm-data/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cgm_data'),
  createMedicalDataRoute('cgm_data', null, 'read:cgm_data')
);

// Insulin Regimen
router.get('/insulin-regimen/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:insulin_regimen'),
  createMedicalDataRoute('insulin_regimen', null, 'read:insulin_regimen')
);

// Diabetes Education
router.get('/diabetes-education/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:diabetes_education'),
  createMedicalDataRoute('diabetes_education', null, 'read:diabetes_education')
);

// Diabetes Educator
router.get('/diabetes-educator/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:diabetes_educator'),
  createMedicalDataRoute('diabetes_educator', null, 'read:diabetes_educator')
);

// Hypoglycemia Management
router.get('/hypoglycemia-management/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hypoglycemia_management'),
  createMedicalDataRoute('hypoglycemia_management', null, 'read:hypoglycemia_management')
);

// Endocrine Lab Results
router.get('/endocrine-lab-results/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:endocrine_lab_results'),
  createMedicalDataRoute('endocrine_lab_results', null, 'read:endocrine_lab_results')
);

// Preconception Counseling
router.get('/preconception-counseling/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:preconception_counseling'),
  createMedicalDataRoute('preconception_counseling', null, 'read:preconception_counseling')
);

// Diabetes Quality Metrics
router.get('/diabetes-quality-metrics/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:diabetes_quality_metrics'),
  createMedicalDataRoute('diabetes_quality_metrics', null, 'read:diabetes_quality_metrics')
);

// Pump Download Analysis
router.get('/pump-download-analysis/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pump_download_analysis'),
  createMedicalDataRoute('pump_download_analysis', null, 'read:pump_download_analysis')
);

// Foot Exam
router.get('/foot-exam/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:foot_exam'),
  createMedicalDataRoute('foot_exam', null, 'read:foot_exam')
);

// Diabetes Supplies
router.get('/diabetes-supplies/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:diabetes_supplies'),
  createMedicalDataRoute('diabetes_supplies', null, 'read:diabetes_supplies')
);

// Fertility Tracking
router.get('/fertility-tracking/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fertility_tracking'),
  createMedicalDataRoute('fertility_tracking', null, 'read:fertility_tracking')
);

// Pump Advanced Settings
router.get('/pump-advanced-settings/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pump_advanced_settings'),
  createMedicalDataRoute('pump_advanced_settings', null, 'read:pump_advanced_settings')
);

// Insulin Timing Instructions
router.get('/insulin-timing-instructions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:insulin_timing_instructions'),
  createMedicalDataRoute('insulin_timing_instructions', null, 'read:insulin_timing_instructions')
);

// Hypoglycemia Protocol
router.get('/hypoglycemia-protocol/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hypoglycemia_protocol'),
  createMedicalDataRoute('hypoglycemia_protocol', null, 'read:hypoglycemia_protocol')
);

// Basal Rate Adjustments
router.get('/basal-rate-adjustments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:basal_rate_adjustments'),
  createMedicalDataRoute('basal_rate_adjustments', null, 'read:basal_rate_adjustments')
);

// Bolus Adjustments
router.get('/bolus-adjustments/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:bolus_adjustments'),
  createMedicalDataRoute('bolus_adjustments', null, 'read:bolus_adjustments')
);

// Ibd Assessment
router.get('/ibd-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ibd_assessment'),
  createMedicalDataRoute('ibd_assessment', null, 'read:ibd_assessment')
);

// Disease Activity Scores
router.get('/disease-activity-scores/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:disease_activity_scores'),
  createMedicalDataRoute('disease_activity_scores', null, 'read:disease_activity_scores')
);

// Endoscopy Findings
router.get('/endoscopy-findings/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:endoscopy_findings'),
  createMedicalDataRoute('endoscopy_findings', null, 'read:endoscopy_findings')
);

// Ibd Biomarkers
router.get('/ibd-biomarkers/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ibd_biomarkers'),
  createMedicalDataRoute('ibd_biomarkers', null, 'read:ibd_biomarkers')
);

// Biologic Therapy
router.get('/biologic-therapy/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:biologic_therapy'),
  createMedicalDataRoute('biologic_therapy', null, 'read:biologic_therapy')
);

// Extraintestinal Manifestations
router.get('/extraintestinal-manifestations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:extraintestinal_manifestations'),
  createMedicalDataRoute('extraintestinal_manifestations', null, 'read:extraintestinal_manifestations')
);

// Ibd Surgical Planning
router.get('/ibd-surgical-planning/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ibd_surgical_planning'),
  createMedicalDataRoute('ibd_surgical_planning', null, 'read:ibd_surgical_planning')
);

// Flare Management
router.get('/flare-management/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:flare_management'),
  createMedicalDataRoute('flare_management', null, 'read:flare_management')
);

// Cancer Surveillance
router.get('/cancer-surveillance/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cancer_surveillance'),
  createMedicalDataRoute('cancer_surveillance', null, 'read:cancer_surveillance')
);

// Functional Status
router.get('/functional-status/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:functional_status'),
  createMedicalDataRoute('functional_status', null, 'read:functional_status')
);

// Geriatric Cognitive Assessment
router.get('/geriatric-cognitive-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:geriatric_cognitive_assessment'),
  createMedicalDataRoute('geriatric_cognitive_assessment', null, 'read:geriatric_cognitive_assessment')
);

// Falls Prevention Program Assessment
router.get('/falls-prevention-program-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:falls_prevention_program_assessment'),
  createMedicalDataRoute('falls_prevention_program_assessment', null, 'read:falls_prevention_program_assessment')
);

// Polypharmacy Review
router.get('/polypharmacy-review/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:polypharmacy_review'),
  createMedicalDataRoute('polypharmacy_review', null, 'read:polypharmacy_review')
);

// Quality Assurance
router.get('/quality-assurance/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:quality_assurance'),
  createMedicalDataRoute('quality_assurance', null, 'read:quality_assurance')
);

// Lymph Node Cytomorphology
router.get('/lymph-node-cytomorphology/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:lymph_node_cytomorphology'),
  createMedicalDataRoute('lymph_node_cytomorphology', null, 'read:lymph_node_cytomorphology')
);

// Cytogenetics
router.get('/cytogenetics/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cytogenetics'),
  createMedicalDataRoute('cytogenetics', null, 'read:cytogenetics')
);

// Staging Summary
router.get('/staging-summary/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:staging_summary'),
  createMedicalDataRoute('staging_summary', null, 'read:staging_summary')
);

// Geriatric Nutritional Assessment
router.get('/geriatric-nutritional-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:geriatric_nutritional_assessment'),
  createMedicalDataRoute('geriatric_nutritional_assessment', null, 'read:geriatric_nutritional_assessment')
);

// Mood Psychological Assessment
router.get('/mood-psychological-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:mood_psychological_assessment'),
  createMedicalDataRoute('mood_psychological_assessment', null, 'read:mood_psychological_assessment')
);

// Social Functional Assessment
router.get('/social-functional-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:social_functional_assessment'),
  createMedicalDataRoute('social_functional_assessment', null, 'read:social_functional_assessment')
);

// Frailty Assessment
router.get('/frailty-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:frailty_assessment'),
  createMedicalDataRoute('frailty_assessment', null, 'read:frailty_assessment')
);

// Advanced Care Planning
router.get('/advanced-care-planning/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:geriatric_care_planning'),
  createMedicalDataRoute('geriatric_care_planning', null, 'read:geriatric_care_planning')
);

// Caregiver Assessment
router.get('/caregiver-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:caregiver_assessment'),
  createMedicalDataRoute('caregiver_assessment', null, 'read:caregiver_assessment')
);

// Cancer Diagnosis
router.get('/cancer-diagnosis/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cancer_diagnosis'),
  createMedicalDataRoute('cancer_diagnosis', null, 'read:cancer_diagnosis')
);

// Cancer Staging
router.get('/cancer-staging/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cancer_staging'),
  createMedicalDataRoute('cancer_staging', null, 'read:cancer_staging')
);

// Myeloma Specific Data
router.get('/myeloma-specific-data/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:myeloma_specific_data'),
  createMedicalDataRoute('myeloma_specific_data', null, 'read:myeloma_specific_data')
);

// Chemotherapy Regimen
router.get('/chemotherapy-regimen/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:chemotherapy_regimen'),
  createMedicalDataRoute('chemotherapy_regimen', null, 'read:chemotherapy_regimen')
);

// Radiation Therapy
router.get('/radiation-therapy/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:radiation_therapy'),
  createMedicalDataRoute('radiation_therapy', null, 'read:radiation_therapy')
);

// Transplant Assessment
router.get('/transplant-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:transplant_assessment'),
  createMedicalDataRoute('transplant_assessment', null, 'read:transplant_assessment')
);

// Performance Status
router.get('/performance-status/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:performance_status'),
  createMedicalDataRoute('performance_status', null, 'read:performance_status')
);

// Tumor Markers
router.get('/tumor-markers/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:tumor_markers'),
  createMedicalDataRoute('tumor_markers', null, 'read:tumor_markers')
);

// Clinical Trials
router.get('/clinical-trials/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:clinical_trials'),
  createMedicalDataRoute('clinical_trials', null, 'read:clinical_trials')
);

// Response Assessment
router.get('/response-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:response_assessment'),
  createMedicalDataRoute('response_assessment', null, 'read:response_assessment')
);

// Toxicity Assessment
router.get('/toxicity-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:toxicity_assessment'),
  createMedicalDataRoute('toxicity_assessment', null, 'read:toxicity_assessment')
);

// Palliative Care Needs
router.get('/palliative-care-needs/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:palliative_care_needs'),
  createMedicalDataRoute('palliative_care_needs', null, 'read:palliative_care_needs')
);

// Treatment Summary
router.get('/treatment-summary/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:treatment_summary'),
  createMedicalDataRoute('treatment_summary', null, 'read:treatment_summary')
);

// Surgical Oncology
router.get('/surgical-oncology/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:surgical_oncology'),
  createMedicalDataRoute('surgical_oncology', null, 'read:surgical_oncology')
);

// Radiation Oncology
router.get('/radiation-oncology/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:radiation_oncology'),
  createMedicalDataRoute('radiation_oncology', null, 'read:radiation_oncology')
);

// Endocrine Therapy
router.get('/endocrine-therapy/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:endocrine_therapy'),
  createMedicalDataRoute('endocrine_therapy', null, 'read:endocrine_therapy')
);

// Bone Health
router.get('/bone-health/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:bone_health'),
  createMedicalDataRoute('bone_health', null, 'read:bone_health')
);

// Survivorship Care Plan
router.get('/survivorship-care-plan/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:survivorship_care_plan'),
  createMedicalDataRoute('survivorship_care_plan', null, 'read:survivorship_care_plan')
);

// Cancer Related Side Effects
router.get('/cancer-related-side-effects/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cancer_related_side_effects'),
  createMedicalDataRoute('cancer_related_side_effects', null, 'read:cancer_related_side_effects')
);

// Oncologic Emergencies
router.get('/oncologic-emergencies/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:oncologic_emergencies'),
  createMedicalDataRoute('oncologic_emergencies', null, 'read:oncologic_emergencies')
);

// Psychosocial Oncology
router.get('/psychosocial-oncology/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:psychosocial_oncology'),
  createMedicalDataRoute('psychosocial_oncology', null, 'read:psychosocial_oncology')
);

// Genetic Oncology
router.get('/genetic-oncology/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:genetic_oncology'),
  createMedicalDataRoute('genetic_oncology', null, 'read:genetic_oncology')
);

// Prognostic Factors
router.get('/prognostic-factors/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:prognostic_factors'),
  createMedicalDataRoute('prognostic_factors', null, 'read:prognostic_factors')
);

// Integrative Oncology
router.get('/integrative-oncology/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:integrative_oncology'),
  createMedicalDataRoute('integrative_oncology', null, 'read:integrative_oncology')
);

// Prophylactic Medications
router.get('/prophylactic-medications/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:prophylactic_medications'),
  createMedicalDataRoute('prophylactic_medications', null, 'read:prophylactic_medications')
);

// Pre Chemotherapy Workup
router.get('/pre-chemotherapy-workup/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pre_chemotherapy_workup'),
  createMedicalDataRoute('pre_chemotherapy_workup', null, 'read:pre_chemotherapy_workup')
);

// Renal Protection Plan
router.get('/renal-protection-plan/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:renal_protection_plan'),
  createMedicalDataRoute('renal_protection_plan', null, 'read:renal_protection_plan')
);

// Pain Management Plan
router.get('/pain-management-plan/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pain_management_plan'),
  createMedicalDataRoute('pain_management_plan', null, 'read:pain_management_plan')
);

// Supportive Care
router.get('/supportive-care/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:supportive_care'),
  createMedicalDataRoute('supportive_care', null, 'read:supportive_care')
);

// Insurance Authorization
router.get('/insurance-authorization/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:insurance_authorization'),
  createMedicalDataRoute('insurance_authorization', null, 'read:insurance_authorization')
);

// Oncology Team
router.get('/oncology-team/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:oncology_team'),
  createMedicalDataRoute('oncology_team', null, 'read:oncology_team')
);

// Obstetric History
router.get('/obstetric-history/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:obstetric_history'),
  createMedicalDataRoute('obstetric_history', null, 'read:obstetric_history')
);

// Current Pregnancy
router.get('/current-pregnancy/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:current_pregnancy'),
  createMedicalDataRoute('current_pregnancy', null, 'read:current_pregnancy')
);

// Reproductive History
router.get('/reproductive-history/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:reproductive_history'),
  createMedicalDataRoute('reproductive_history', null, 'read:reproductive_history')
);

// Prenatal Screening
router.get('/prenatal-screening/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:prenatal_screening'),
  createMedicalDataRoute('prenatal_screening', null, 'read:prenatal_screening')
);

// Nt Scan Result
router.get('/nt-scan-result/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:nt_scan_result'),
  createMedicalDataRoute('nt_scan_result', null, 'read:nt_scan_result')
);

// Cell Free Dna Result
router.get('/cell-free-dna-result/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cell_free_dna_result'),
  createMedicalDataRoute('cell_free_dna_result', null, 'read:cell_free_dna_result')
);

// First Trimester Screen Result
router.get('/first-trimester-screen-result/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:first_trimester_screen_result'),
  createMedicalDataRoute('first_trimester_screen_result', null, 'read:first_trimester_screen_result')
);

// Anatomy Scan Result
router.get('/anatomy-scan-result/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:anatomy_scan_result'),
  createMedicalDataRoute('anatomy_scan_result', null, 'read:anatomy_scan_result')
);

// Cervical Length Measurement
router.get('/cervical-length-measurement/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cervical_length_measurement'),
  createMedicalDataRoute('cervical_length_measurement', null, 'read:cervical_length_measurement')
);

// Fetal Echo Result
router.get('/fetal-echo-result/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fetal_echo_result'),
  createMedicalDataRoute('fetal_echo_result', null, 'read:fetal_echo_result')
);

// Perinatal Mental Health Referral
router.get('/perinatal-mental-health-referral/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:perinatal_mental_health_referral'),
  createMedicalDataRoute('perinatal_mental_health_referral', null, 'read:perinatal_mental_health_referral')
);

// Fetal Ultrasound
router.get('/fetal-ultrasound/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fetal_ultrasound'),
  createMedicalDataRoute('fetal_ultrasound', null, 'read:fetal_ultrasound')
);

// Gestational Diabetes
router.get('/gestational-diabetes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:gestational_diabetes'),
  createMedicalDataRoute('gestational_diabetes', null, 'read:gestational_diabetes')
);

// Fetal Surveillance
router.get('/fetal-surveillance/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fetal_surveillance'),
  createMedicalDataRoute('fetal_surveillance', null, 'read:fetal_surveillance')
);

// Pregnancy Complications
router.get('/pregnancy-complications/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pregnancy_complications'),
  createMedicalDataRoute('pregnancy_complications', null, 'read:pregnancy_complications')
);

// Delivery Planning
router.get('/delivery-planning/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:delivery_planning'),
  createMedicalDataRoute('delivery_planning', null, 'read:delivery_planning')
);

// Maternal Labs
router.get('/maternal-labs/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:maternal_labs'),
  createMedicalDataRoute('maternal_labs', null, 'read:maternal_labs')
);

// Prenatal Visit
router.get('/prenatal-visit/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:prenatal_visit'),
  createMedicalDataRoute('prenatal_visit', null, 'read:prenatal_visit')
);

// Maternal Weight Monitoring
router.get('/maternal-weight-monitoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:maternal_weight_monitoring'),
  createMedicalDataRoute('maternal_weight_monitoring', null, 'read:maternal_weight_monitoring')
);

// Fetal Assessment
router.get('/fetal-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fetal_assessment'),
  createMedicalDataRoute('fetal_assessment', null, 'read:fetal_assessment')
);

// Contraction Monitoring
router.get('/contraction-monitoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:contraction_monitoring'),
  createMedicalDataRoute('contraction_monitoring', null, 'read:contraction_monitoring')
);

// Pregnancy Symptoms
router.get('/pregnancy-symptoms/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pregnancy_symptoms'),
  createMedicalDataRoute('pregnancy_symptoms', null, 'read:pregnancy_symptoms')
);

// Prenatal Education
router.get('/prenatal-education/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:prenatal_education'),
  createMedicalDataRoute('prenatal_education', null, 'read:prenatal_education')
);

// Birth Plan
router.get('/birth-plan/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:birth_plan'),
  createMedicalDataRoute('birth_plan', null, 'read:birth_plan')
);

// Postpartum Planning
router.get('/postpartum-planning/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:postpartum_planning'),
  createMedicalDataRoute('postpartum_planning', null, 'read:postpartum_planning')
);

// Pregnancy Risk Assessment
router.get('/pregnancy-risk-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pregnancy_risk_assessment'),
  createMedicalDataRoute('pregnancy_risk_assessment', null, 'read:pregnancy_risk_assessment')
);

// Pregnancy Course
router.get('/pregnancy-course/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pregnancy_course'),
  createMedicalDataRoute('pregnancy_course', null, 'read:pregnancy_course')
);

// Risk Counseling
router.get('/risk-counseling/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:risk_counseling'),
  createMedicalDataRoute('risk_counseling', null, 'read:risk_counseling')
);

// Ketone Monitoring Instructions
router.get('/ketone-monitoring-instructions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ketone_monitoring_instructions'),
  createMedicalDataRoute('ketone_monitoring_instructions', null, 'read:ketone_monitoring_instructions')
);

// Glucometer Download Schedule
router.get('/glucometer-download-schedule/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:glucometer_download_schedule'),
  createMedicalDataRoute('glucometer_download_schedule', null, 'read:glucometer_download_schedule')
);

// Carbohydrate Counting Education
router.get('/carbohydrate-counting-education/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:carbohydrate_counting_education'),
  createMedicalDataRoute('carbohydrate_counting_education', null, 'read:carbohydrate_counting_education')
);

// Amniotic Fluid Index Current
router.get('/amniotic-fluid-index-current/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:amniotic_fluid_index_current'),
  createMedicalDataRoute('amniotic_fluid_index_current', null, 'read:amniotic_fluid_index_current')
);

// Breastfeeding Recommendation
router.get('/breastfeeding-recommendation/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:breastfeeding_recommendation'),
  createMedicalDataRoute('breastfeeding_recommendation', null, 'read:breastfeeding_recommendation')
);

// Partner Involvement
router.get('/partner-involvement/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:partner_involvement'),
  createMedicalDataRoute('partner_involvement', null, 'read:partner_involvement')
);

// Diabetes Management Plan
router.get('/diabetes-management-plan/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:diabetes_management_plan'),
  createMedicalDataRoute('diabetes_management_plan', null, 'read:diabetes_management_plan')
);

// Single Embryo Transfer Details
router.get('/single-embryo-transfer-details/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:single_embryo_transfer_details'),
  createMedicalDataRoute('single_embryo_transfer_details', null, 'read:single_embryo_transfer_details')
);

// Single Embryo Transfer
router.get('/single-embryo-transfer/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:single_embryo_transfer'),
  createMedicalDataRoute('single_embryo_transfer', null, 'read:single_embryo_transfer')
);

// Preeclampsia Monitoring
router.get('/preeclampsia-monitoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:preeclampsia_monitoring'),
  createMedicalDataRoute('preeclampsia_monitoring', null, 'read:preeclampsia_monitoring')
);

// Infection Risk Monitoring
router.get('/infection-risk-monitoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:infection_risk_monitoring'),
  createMedicalDataRoute('infection_risk_monitoring', null, 'read:infection_risk_monitoring')
);

// Partner Involvement Diabetes Management
router.get('/partner-involvement-diabetes-management/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:partner_involvement_diabetes_management'),
  createMedicalDataRoute('partner_involvement_diabetes_management', null, 'read:partner_involvement_diabetes_management')
);

// Excessive Glucose Monitoring
router.get('/excessive-glucose-monitoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:excessive_glucose_monitoring'),
  createMedicalDataRoute('excessive_glucose_monitoring', null, 'read:excessive_glucose_monitoring')
);

// Macrosomia Threshold
router.get('/macrosomia-threshold/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:macrosomia_threshold'),
  createMedicalDataRoute('macrosomia_threshold', null, 'read:macrosomia_threshold')
);

// Postpartum Diabetes Risk
router.get('/postpartum-diabetes-risk/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:postpartum_diabetes_risk'),
  createMedicalDataRoute('postpartum_diabetes_risk', null, 'read:postpartum_diabetes_risk')
);

// Gdm Recurrence Risk
router.get('/gdm-recurrence-risk/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:gdm_recurrence_risk'),
  createMedicalDataRoute('gdm_recurrence_risk', null, 'read:gdm_recurrence_risk')
);

// Cervical Assessment
router.get('/cervical-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cervical_assessment'),
  createMedicalDataRoute('cervical_assessment', null, 'read:cervical_assessment')
);

// Ckd Assessment
router.get('/ckd-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ckd_assessment'),
  createMedicalDataRoute('ckd_assessment', null, 'read:ckd_assessment')
);

// Proteinuria Assessment
router.get('/proteinuria-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:proteinuria_assessment'),
  createMedicalDataRoute('proteinuria_assessment', null, 'read:proteinuria_assessment')
);

// Dialysis Planning
router.get('/dialysis-planning/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dialysis_planning'),
  createMedicalDataRoute('dialysis_planning', null, 'read:dialysis_planning')
);

// Current Dialysis
router.get('/current-dialysis/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:current_dialysis'),
  createMedicalDataRoute('current_dialysis', null, 'read:current_dialysis')
);

// Transplant Evaluation
router.get('/transplant-evaluation/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:transplant_evaluation'),
  createMedicalDataRoute('transplant_evaluation', null, 'read:transplant_evaluation')
);

// Mineral Bone Disease
router.get('/mineral-bone-disease/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:mineral_bone_disease'),
  createMedicalDataRoute('mineral_bone_disease', null, 'read:mineral_bone_disease')
);

// Renal Anemia
router.get('/renal-anemia/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:renal_anemia'),
  createMedicalDataRoute('renal_anemia', null, 'read:renal_anemia')
);

// Fluid Electrolyte Management
router.get('/fluid-electrolyte-management/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fluid_electrolyte_management'),
  createMedicalDataRoute('fluid_electrolyte_management', null, 'read:fluid_electrolyte_management')
);

// Renal Nutrition
router.get('/renal-nutrition/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:renal_nutrition'),
  createMedicalDataRoute('renal_nutrition', null, 'read:renal_nutrition')
);

// Medication Renal Dosing
router.get('/medication-renal-dosing/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medication_renal_dosing'),
  createMedicalDataRoute('medication_renal_dosing', null, 'read:medication_renal_dosing')
);

// Glomerular Disease
router.get('/glomerular-disease/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:glomerular_disease'),
  createMedicalDataRoute('glomerular_disease', null, 'read:glomerular_disease')
);

// Acute Kidney Injury
router.get('/acute-kidney-injury/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:acute_kidney_injury'),
  createMedicalDataRoute('acute_kidney_injury', null, 'read:acute_kidney_injury')
);

// Polycystic Kidney Disease
router.get('/polycystic-kidney-disease/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:polycystic_kidney_disease'),
  createMedicalDataRoute('polycystic_kidney_disease', null, 'read:polycystic_kidney_disease')
);

// Diabetic Nephropathy
router.get('/diabetic-nephropathy/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:diabetic_nephropathy'),
  createMedicalDataRoute('diabetic_nephropathy', null, 'read:diabetic_nephropathy')
);

// Hypertensive Nephropathy
router.get('/hypertensive-nephropathy/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hypertensive_nephropathy'),
  createMedicalDataRoute('hypertensive_nephropathy', null, 'read:hypertensive_nephropathy')
);

// Movement Disorder Assessment
router.get('/movement-disorder-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:movement_disorder_assessment'),
  createMedicalDataRoute('movement_disorder_assessment', null, 'read:movement_disorder_assessment')
);

// Parkinsonian Features
router.get('/parkinsonian-features/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:parkinsonian_features'),
  createMedicalDataRoute('parkinsonian_features', null, 'read:parkinsonian_features')
);

// Gait Analysis
router.get('/gait-analysis/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:gait_analysis'),
  createMedicalDataRoute('gait_analysis', null, 'read:gait_analysis')
);

// Motor Complications
router.get('/motor-complications/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:motor_complications'),
  createMedicalDataRoute('motor_complications', null, 'read:motor_complications')
);

// Non Motor Symptoms
router.get('/non-motor-symptoms/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:non_motor_symptoms'),
  createMedicalDataRoute('non_motor_symptoms', null, 'read:non_motor_symptoms')
);

// Neurological Exam
router.get('/neurological-exam/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:neurological_exam'),
  createMedicalDataRoute('neurological_exam', null, 'read:neurological_exam')
);

// Parkinson Medications
router.get('/parkinson-medications/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:parkinson_medications'),
  createMedicalDataRoute('parkinson_medications', null, 'read:parkinson_medications')
);

// Deep Brain Stimulation
router.get('/deep-brain-stimulation/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:deep_brain_stimulation'),
  createMedicalDataRoute('deep_brain_stimulation', null, 'read:deep_brain_stimulation')
);

// Epilepsy Assessment
router.get('/epilepsy-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:epilepsy_assessment'),
  createMedicalDataRoute('epilepsy_assessment', null, 'read:epilepsy_assessment')
);

// Headache Assessment
router.get('/headache-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:headache_assessment'),
  createMedicalDataRoute('headache_assessment', null, 'read:headache_assessment')
);

// Multiple Sclerosis Assessment
router.get('/multiple-sclerosis-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:multiple_sclerosis_assessment'),
  createMedicalDataRoute('multiple_sclerosis_assessment', null, 'read:multiple_sclerosis_assessment')
);

// Stroke Assessment
router.get('/stroke-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:stroke_assessment'),
  createMedicalDataRoute('stroke_assessment', null, 'read:stroke_assessment')
);

// Dementia Assessment
router.get('/dementia-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dementia_assessment'),
  createMedicalDataRoute('dementia_assessment', null, 'read:dementia_assessment')
);

// Peripheral Neuropathy
router.get('/peripheral-neuropathy/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:peripheral_neuropathy'),
  createMedicalDataRoute('peripheral_neuropathy', null, 'read:peripheral_neuropathy')
);

// Neuromuscular Disorder
router.get('/neuromuscular-disorder/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:neuromuscular_disorder'),
  createMedicalDataRoute('neuromuscular_disorder', null, 'read:neuromuscular_disorder')
);

// Surgical Team
router.get('/surgical-team/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:surgical_team'),
  createMedicalDataRoute('surgical_team', null, 'read:surgical_team')
);

// Operative Details
router.get('/operative-details/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:operative_details'),
  createMedicalDataRoute('operative_details', null, 'read:operative_details')
);

// Anesthesia Record
router.get('/anesthesia-record/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:anesthesia_record'),
  createMedicalDataRoute('anesthesia_record', null, 'read:anesthesia_record')
);

// Surgical Approach
router.get('/surgical-approach/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:surgical_approach'),
  createMedicalDataRoute('surgical_approach', null, 'read:surgical_approach')
);

// Intraoperative Findings
router.get('/intraoperative-findings/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:intraoperative_findings'),
  createMedicalDataRoute('intraoperative_findings', null, 'read:intraoperative_findings')
);

// Operative Technique
router.get('/operative-technique/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:operative_technique'),
  createMedicalDataRoute('operative_technique', null, 'read:operative_technique')
);

// Intraoperative Imaging
router.get('/intraoperative-imaging/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:intraoperative_imaging'),
  createMedicalDataRoute('intraoperative_imaging', null, 'read:intraoperative_imaging')
);

// Specimens
router.get('/specimens/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:specimens'),
  createMedicalDataRoute('specimens', null, 'read:specimens')
);

// Estimated Blood Loss
router.get('/estimated-blood-loss/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:estimated_blood_loss'),
  createMedicalDataRoute('estimated_blood_loss', null, 'read:estimated_blood_loss')
);

// Complications
router.get('/complications/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:complications'),
  createMedicalDataRoute('complications', null, 'read:complications')
);

// Postoperative Orders
router.get('/postoperative-orders/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:postoperative_orders'),
  createMedicalDataRoute('postoperative_orders', null, 'read:postoperative_orders')
);

// Postoperative Condition
router.get('/postoperative-condition/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:postoperative_condition'),
  createMedicalDataRoute('postoperative_condition', null, 'read:postoperative_condition')
);

// Mechanism Of Injury
router.get('/mechanism-of-injury/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:mechanism_of_injury'),
  createMedicalDataRoute('mechanism_of_injury', null, 'read:mechanism_of_injury')
);

// Orthopedic Imaging
router.get('/orthopedic-imaging/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:orthopedic_imaging'),
  createMedicalDataRoute('orthopedic_imaging', null, 'read:orthopedic_imaging')
);

// Orthopedic Assessment
router.get('/orthopedic-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:orthopedic_assessment'),
  createMedicalDataRoute('orthopedic_assessment', null, 'read:orthopedic_assessment')
);

// Orthopedic Procedures
router.get('/orthopedic-procedures/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:orthopedic_procedures'),
  createMedicalDataRoute('orthopedic_procedures', null, 'read:orthopedic_procedures')
);

// Ligament Reconstruction
router.get('/ligament-reconstruction/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ligament_reconstruction'),
  createMedicalDataRoute('ligament_reconstruction', null, 'read:ligament_reconstruction')
);

// Meniscus Repair
router.get('/meniscus-repair/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:meniscus_repair'),
  createMedicalDataRoute('meniscus_repair', null, 'read:meniscus_repair')
);

// Articular Cartilage
router.get('/articular-cartilage/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:articular_cartilage'),
  createMedicalDataRoute('articular_cartilage', null, 'read:articular_cartilage')
);

// Tourniquet Data
router.get('/tourniquet-data/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:tourniquet_data'),
  createMedicalDataRoute('tourniquet_data', null, 'read:tourniquet_data')
);

// Postop Testing
router.get('/postop-testing/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:postop_testing'),
  createMedicalDataRoute('postop_testing', null, 'read:postop_testing')
);

// Rehabilitation Protocol
router.get('/rehabilitation-protocol/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:rehabilitation_protocol'),
  createMedicalDataRoute('rehabilitation_protocol', null, 'read:rehabilitation_protocol')
);

// Return To Sport
router.get('/return-to-sport/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:return_to_sport'),
  createMedicalDataRoute('return_to_sport', null, 'read:return_to_sport')
);

// Dvt Prophylaxis
router.get('/dvt-prophylaxis/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dvt_prophylaxis'),
  createMedicalDataRoute('dvt_prophylaxis', null, 'read:dvt_prophylaxis')
);

// Venous Thromboembolism Risk
router.get('/venous-thromboembolism-risk/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:venous_thromboembolism_risk'),
  createMedicalDataRoute('venous_thromboembolism_risk', null, 'read:venous_thromboembolism_risk')
);

// Performance Assessment
router.get('/performance-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:performance_assessment'),
  createMedicalDataRoute('performance_assessment', null, 'read:performance_assessment')
);

// Document Type (document classification + coding)
router.get('/document-type/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:document_type'),
  createMedicalDataRoute('document_type', null, 'read:document_type')
);

// Neurovascular Exam
router.get('/neurovascular-exam/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:neurovascular_exam'),
  createMedicalDataRoute('neurovascular_exam', null, 'read:neurovascular_exam')
);

// Athlete Specific Data
router.get('/athlete-specific-data/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:athlete_specific_data'),
  createMedicalDataRoute('athlete_specific_data', null, 'read:athlete_specific_data')
);

// Birth History
router.get('/birth-history/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:birth_history'),
  createMedicalDataRoute('birth_history', null, 'read:birth_history')
);

// Growth Parameters
router.get('/growth-parameters/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:growth_parameters'),
  createMedicalDataRoute('growth_parameters', null, 'read:growth_parameters')
);

// Developmental Milestones
router.get('/developmental-milestones/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:developmental_milestones'),
  createMedicalDataRoute('developmental_milestones', null, 'read:developmental_milestones')
);

// Pediatric Screening
router.get('/pediatric-screening/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pediatric_screening'),
  createMedicalDataRoute('pediatric_screening', null, 'read:pediatric_screening')
);

// School Performance
router.get('/school-performance/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:school_performance'),
  createMedicalDataRoute('school_performance', null, 'read:school_performance')
);

// Anticipatory Guidance
router.get('/anticipatory-guidance/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:anticipatory_guidance'),
  createMedicalDataRoute('anticipatory_guidance', null, 'read:anticipatory_guidance')
);

// Behavioral Assessment
router.get('/behavioral-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:behavioral_assessment'),
  createMedicalDataRoute('behavioral_assessment', null, 'read:behavioral_assessment')
);

// Adhd Assessment
router.get('/adhd-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:adhd_assessment'),
  createMedicalDataRoute('adhd_assessment', null, 'read:adhd_assessment')
);

// Parental Concerns
router.get('/parental-concerns/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:parental_concerns'),
  createMedicalDataRoute('parental_concerns', null, 'read:parental_concerns')
);

// Well Child Summary
router.get('/well-child-summary/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:well_child_summary'),
  createMedicalDataRoute('well_child_summary', null, 'read:well_child_summary')
);

// Early Childhood Development
router.get('/early-childhood-development/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:early_childhood_development'),
  createMedicalDataRoute('early_childhood_development', null, 'read:early_childhood_development')
);

// Clinical Scores
router.get('/clinical-scores/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:clinical_scores'),
  createMedicalDataRoute('clinical_scores', null, 'read:clinical_scores')
);

// Functional Assessment
router.get('/functional-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:functional_assessment'),
  createMedicalDataRoute('functional_assessment', null, 'read:functional_assessment')
);

// Consultation Details
router.get('/consultation-details/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:consultation_details'),
  createMedicalDataRoute('consultation_details', null, 'read:consultation_details')
);

// Medication Reconciliation
router.get('/medication-reconciliation/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medication_reconciliation'),
  createMedicalDataRoute('medication_reconciliation', null, 'read:medication_reconciliation')
);

// Supplementation Plans
router.get('/supplementation-plans/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:supplementation_plans'),
  createMedicalDataRoute('supplementation_plans', null, 'read:supplementation_plans')
);

// Care Coordination
router.get('/care-coordination/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:care_coordination'),
  createMedicalDataRoute('care_coordination', null, 'read:care_coordination')
);

// Prognosis
router.get('/prognosis/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:prognosis'),
  createMedicalDataRoute('prognosis', null, 'read:prognosis')
);

// Age
router.get('/age/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:age'),
  createMedicalDataRoute('age', null, 'read:age')
);

// Allergy Immunology Assessment
router.get('/allergy-immunology-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:allergy_immunology_assessment'),
  createMedicalDataRoute('allergy_immunology_assessment', null, 'read:allergy_immunology_assessment')
);

// Anesthesiology Assessment
router.get('/anesthesiology-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:anesthesiology_assessment'),
  createMedicalDataRoute('anesthesiology_assessment', null, 'read:anesthesiology_assessment')
);

// Asthma Action Plan
router.get('/asthma-action-plan/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:asthma_action_plan'),
  createMedicalDataRoute('asthma_action_plan', null, 'read:asthma_action_plan')
);

// Asthma Assessment
router.get('/asthma-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:asthma_assessment'),
  createMedicalDataRoute('asthma_assessment', null, 'read:asthma_assessment')
);

// Autoantibody Profile
router.get('/autoantibody-profile/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:autoantibody_profile'),
  createMedicalDataRoute('autoantibody_profile', null, 'read:autoantibody_profile')
);

// Biopsychosocial Formulation
router.get('/biopsychosocial-formulation/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:biopsychosocial_formulation'),
  createMedicalDataRoute('biopsychosocial_formulation', null, 'read:biopsychosocial_formulation')
);

// Cardiology Assessment
router.get('/cardiology-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cardiology_assessment'),
  createMedicalDataRoute('cardiology_assessment', null, 'read:cardiology_assessment')
);

// Colorectal Surgery Assessment
router.get('/colorectal-surgery-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:colorectal_surgery_assessment'),
  createMedicalDataRoute('colorectal_surgery_assessment', null, 'read:colorectal_surgery_assessment')
);

// Connective Tissue Disease Assessment
router.get('/connective-tissue-disease-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:connective_tissue_disease_assessment'),
  createMedicalDataRoute('connective_tissue_disease_assessment', null, 'read:connective_tissue_disease_assessment')
);

// Copd Assessment
router.get('/copd-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:copd_assessment'),
  createMedicalDataRoute('copd_assessment', null, 'read:copd_assessment')
);

// Date
router.get('/date/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:date'),
  createMedicalDataRoute('date', null, 'read:date')
);

// Department
router.get('/department/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:department'),
  createMedicalDataRoute('department', null, 'read:department')
);

// Dermatology Assessment
router.get('/dermatology-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dermatology_assessment'),
  createMedicalDataRoute('dermatology_assessment', null, 'read:dermatology_assessment')
);

// Diagnostic Impression
router.get('/diagnostic-impression/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:diagnostic_impression'),
  createMedicalDataRoute('diagnostic_impression', null, 'read:diagnostic_impression')
);

// Document Type
router.get('/document-type/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:document_type'),
  createMedicalDataRoute('document_type', null, 'read:document_type')
);

// Emergency Assessment
router.get('/emergency-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:emergency_assessment'),
  createMedicalDataRoute('emergency_assessment', null, 'read:emergency_assessment')
);

// Endocrinology Assessment
router.get('/endocrinology-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:endocrinology_assessment'),
  createMedicalDataRoute('endocrinology_assessment', null, 'read:endocrinology_assessment')
);

// Ent Assessment
router.get('/ent-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ent_assessment'),
  createMedicalDataRoute('ent_assessment', null, 'read:ent_assessment')
);

// Environmental Exposures
router.get('/environmental-exposures/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:environmental_exposures'),
  createMedicalDataRoute('environmental_exposures', null, 'read:environmental_exposures')
);

// Facility
router.get('/facility/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:facility'),
  createMedicalDataRoute('facility', null, 'read:facility')
);

// Family Meeting Notes
router.get('/family-meeting-notes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:family_meeting_notes'),
  createMedicalDataRoute('family_meeting_notes', null, 'read:family_meeting_notes')
);

// Gender
router.get('/gender/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:gender'),
  createMedicalDataRoute('gender', null, 'read:gender')
);

// Gout Assessment
router.get('/gout-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:gout_assessment'),
  createMedicalDataRoute('gout_assessment', null, 'read:gout_assessment')
);

// Headers
router.get('/headers/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:headers'),
  createMedicalDataRoute('headers', null, 'read:headers')
);

// Homicide Risk Assessment
router.get('/homicide-risk-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:homicide_risk_assessment'),
  createMedicalDataRoute('homicide_risk_assessment', null, 'read:homicide_risk_assessment')
);

// Imaging
router.get('/imaging/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:imaging'),
  createMedicalDataRoute('imaging', null, 'read:imaging')
);

// Immunization Record
router.get('/immunization-record/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:immunization_record'),
  createMedicalDataRoute('immunization_record', null, 'read:immunization_record')
);

// Immunization Status
router.get('/immunization-status/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:immunization_status'),
  createMedicalDataRoute('immunization_status', null, 'read:immunization_status')
);

// Infectious Disease Assessment
router.get('/infectious-disease-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:infectious_disease_assessment'),
  createMedicalDataRoute('infectious_disease_assessment', null, 'read:infectious_disease_assessment')
);

// Inflammatory Markers
router.get('/inflammatory-markers/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:inflammatory_markers'),
  createMedicalDataRoute('inflammatory_markers', null, 'read:inflammatory_markers')
);

// Lupus Assessment
router.get('/lupus-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:lupus_assessment'),
  createMedicalDataRoute('lupus_assessment', null, 'read:lupus_assessment')
);

// Fetal Echo
router.get('/fetal-echo/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fetal_echo'),
  createMedicalDataRoute('fetal_echo', null, 'read:fetal_echo')
);

// Umbilical Artery Doppler
router.get('/umbilical-artery-doppler/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:umbilical_artery_doppler'),
  createMedicalDataRoute('umbilical_artery_doppler', null, 'read:umbilical_artery_doppler')
);

// Insulin Adjustment Protocol
router.get('/insulin-adjustment-protocol/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:insulin_adjustment_protocol'),
  createMedicalDataRoute('insulin_adjustment_protocol', null, 'read:insulin_adjustment_protocol')
);

// Postpartum Glucose Monitoring
router.get('/postpartum-glucose-monitoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:postpartum_glucose_monitoring'),
  createMedicalDataRoute('postpartum_glucose_monitoring', null, 'read:postpartum_glucose_monitoring')
);

// Amniotic Fluid Assessment
router.get('/amniotic-fluid-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:amniotic_fluid_assessment'),
  createMedicalDataRoute('amniotic_fluid_assessment', null, 'read:amniotic_fluid_assessment')
);

// Continuous Glucose Monitor
router.get('/continuous-glucose-monitor/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:continuous_glucose_monitor'),
  createMedicalDataRoute('continuous_glucose_monitor', null, 'read:continuous_glucose_monitor')
);

// Weekly Virtual Check Ins
router.get('/weekly-virtual-check-ins/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:weekly_virtual_check_ins'),
  createMedicalDataRoute('weekly_virtual_check_ins', null, 'read:weekly_virtual_check_ins')
);

// South Asian Nutritionist
router.get('/south-asian-nutritionist/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:south_asian_nutritionist'),
  createMedicalDataRoute('south_asian_nutritionist', null, 'read:south_asian_nutritionist')
);

// Indian Diet Exchange Lists
router.get('/indian-diet-exchange-lists/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:indian_diet_exchange_lists'),
  createMedicalDataRoute('indian_diet_exchange_lists', null, 'read:indian_diet_exchange_lists')
);

// Cultural Considerations
router.get('/cultural-considerations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cultural_considerations'),
  createMedicalDataRoute('cultural_considerations', null, 'read:cultural_considerations')
);

// Thyroid Management
router.get('/thyroid-management/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:thyroid_management'),
  createMedicalDataRoute('thyroid_management', null, 'read:thyroid_management')
);

// Total Weight Gain
router.get('/total-weight-gain/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:total_weight_gain'),
  createMedicalDataRoute('total_weight_gain', null, 'read:total_weight_gain')
);

// Pre Pregnancy Weight
router.get('/pre-pregnancy-weight/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pre_pregnancy_weight'),
  createMedicalDataRoute('pre_pregnancy_weight', null, 'read:pre_pregnancy_weight')
);

// Fetal Echo Results
router.get('/fetal-echo-results/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fetal_echo_results'),
  createMedicalDataRoute('fetal_echo_results', null, 'read:fetal_echo_results')
);

// Diabetes Educator Training
router.get('/diabetes-educator-training/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:diabetes_educator_training'),
  createMedicalDataRoute('diabetes_educator_training', null, 'read:diabetes_educator_training')
);

// Exercise Program
router.get('/exercise-program/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:exercise_program'),
  createMedicalDataRoute('exercise_program', null, 'read:exercise_program')
);

// Early Maternity Leave
router.get('/early-maternity-leave/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:early_maternity_leave'),
  createMedicalDataRoute('early_maternity_leave', null, 'read:early_maternity_leave')
);

// Download Glucometer
router.get('/download-glucometer/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:download_glucometer'),
  createMedicalDataRoute('download_glucometer', null, 'read:download_glucometer')
);

// Estimated Delivery Date
router.get('/estimated-delivery-date/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:estimated_delivery_date'),
  createMedicalDataRoute('estimated_delivery_date', null, 'read:estimated_delivery_date')
);

// First Trimester Bleeding
router.get('/first-trimester-bleeding/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:first_trimester_bleeding'),
  createMedicalDataRoute('first_trimester_bleeding', null, 'read:first_trimester_bleeding')
);

// Support Group Referral
router.get('/support-group-referral/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:support_group_referral'),
  createMedicalDataRoute('support_group_referral', null, 'read:support_group_referral')
);

// Continuous Glucose Monitor Discussion
router.get('/continuous-glucose-monitor-discussion/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:continuous_glucose_monitor_discussion'),
  createMedicalDataRoute('continuous_glucose_monitor_discussion', null, 'read:continuous_glucose_monitor_discussion')
);

// Glucose Monitoring Goals
router.get('/glucose-monitoring-goals/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:glucose_monitoring_goals'),
  createMedicalDataRoute('glucose_monitoring_goals', null, 'read:glucose_monitoring_goals')
);

// Insulin Storage Instructions
router.get('/insulin-storage-instructions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:insulin_storage_instructions'),
  createMedicalDataRoute('insulin_storage_instructions', null, 'read:insulin_storage_instructions')
);

// Cesarean Threshold
router.get('/cesarean-threshold/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cesarean_threshold'),
  createMedicalDataRoute('cesarean_threshold', null, 'read:cesarean_threshold')
);

// Glucose Testing Weeks
router.get('/glucose-testing-weeks/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:glucose_testing_weeks'),
  createMedicalDataRoute('glucose_testing_weeks', null, 'read:glucose_testing_weeks')
);

// Point Of Care Ultrasound Heart Rate
router.get('/point-of-care-ultrasound-heart-rate/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:point_of_care_ultrasound_heart_rate'),
  createMedicalDataRoute('point_of_care_ultrasound_heart_rate', null, 'read:point_of_care_ultrasound_heart_rate')
);

// Lab Schedule
router.get('/lab-schedule/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:lab_schedule'),
  createMedicalDataRoute('lab_schedule', null, 'read:lab_schedule')
);

// Growth Ultrasound Schedule
router.get('/growth-ultrasound-schedule/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:growth_ultrasound_schedule'),
  createMedicalDataRoute('growth_ultrasound_schedule', null, 'read:growth_ultrasound_schedule')
);

// Inter Pregnancy Weight Management
router.get('/inter-pregnancy-weight-management/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:inter_pregnancy_weight_management'),
  createMedicalDataRoute('inter_pregnancy_weight_management', null, 'read:inter_pregnancy_weight_management')
);

// Glucose Monitoring Frequency
router.get('/glucose-monitoring-frequency/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:glucose_monitoring_frequency'),
  createMedicalDataRoute('glucose_monitoring_frequency', null, 'read:glucose_monitoring_frequency')
);

// Sleep Disturbances
router.get('/sleep-disturbances/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:sleep_disturbances'),
  createMedicalDataRoute('sleep_disturbances', null, 'read:sleep_disturbances')
);

// Work Accommodations
router.get('/work-accommodations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:work_accommodations'),
  createMedicalDataRoute('work_accommodations', null, 'read:work_accommodations')
);

// Patient Emotional Response
router.get('/patient-emotional-response/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_emotional_response'),
  createMedicalDataRoute('patient_emotional_response', null, 'read:patient_emotional_response')
);

// Comprehensive Cardiomyopathy Panel
router.get('/comprehensive-cardiomyopathy-panel/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:comprehensive_cardiomyopathy_panel'),
  createMedicalDataRoute('comprehensive_cardiomyopathy_panel', null, 'read:comprehensive_cardiomyopathy_panel')
);

// Detailed Family Pedigree
router.get('/detailed-family-pedigree/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:detailed_family_pedigree'),
  createMedicalDataRoute('detailed_family_pedigree', null, 'read:detailed_family_pedigree')
);

// Acmg Guidelines Reference
router.get('/acmg-guidelines-reference/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:acmg_guidelines_reference'),
  createMedicalDataRoute('acmg_guidelines_reference', null, 'read:acmg_guidelines_reference')
);

// Inheritance Pattern Details
router.get('/inheritance-pattern-details/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:inheritance_pattern_details'),
  createMedicalDataRoute('inheritance_pattern_details', null, 'read:inheritance_pattern_details')
);

// Children Specific Risk
router.get('/children-specific-risk/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:children_specific_risk'),
  createMedicalDataRoute('children_specific_risk', null, 'read:children_specific_risk')
);

// Cascade Testing Protocol
router.get('/cascade-testing-protocol/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cascade_testing_protocol'),
  createMedicalDataRoute('cascade_testing_protocol', null, 'read:cascade_testing_protocol')
);

// Potential Testing Outcomes
router.get('/potential-testing-outcomes/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:potential_testing_outcomes'),
  createMedicalDataRoute('potential_testing_outcomes', null, 'read:potential_testing_outcomes')
);

// Psychosocial Support Services
router.get('/psychosocial-support-services/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:psychosocial_support_services'),
  createMedicalDataRoute('psychosocial_support_services', null, 'read:psychosocial_support_services')
);

// Reason For Referral
router.get('/reason-for-referral/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:reason_for_referral'),
  createMedicalDataRoute('reason_for_referral', null, 'read:reason_for_referral')
);

// Medical Geneticist
router.get('/medical-geneticist/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medical_geneticist'),
  createMedicalDataRoute('medical_geneticist', null, 'read:medical_geneticist')
);

// Extended Family History
router.get('/extended-family-history/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:extended_family_history'),
  createMedicalDataRoute('extended_family_history', null, 'read:extended_family_history')
);

// Genetics Psychosocial Assessment
router.get('/genetics-psychosocial-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:genetics_psychosocial_assessment'),
  createMedicalDataRoute('genetics_psychosocial_assessment', null, 'read:genetics_psychosocial_assessment')
);

// Immediate Recommendations
router.get('/immediate-recommendations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:immediate_recommendations'),
  createMedicalDataRoute('immediate_recommendations', null, 'read:immediate_recommendations')
);

// Variant Interpretation Guidelines
router.get('/variant-interpretation-guidelines/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:variant_interpretation_guidelines'),
  createMedicalDataRoute('variant_interpretation_guidelines', null, 'read:variant_interpretation_guidelines')
);

// Prior Authorization Status
router.get('/prior-authorization-status/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:prior_authorization_status'),
  createMedicalDataRoute('prior_authorization_status', null, 'read:prior_authorization_status')
);

// Blood Sample Collection Status
router.get('/blood-sample-collection-status/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:blood_sample_collection_status'),
  createMedicalDataRoute('blood_sample_collection_status', null, 'read:blood_sample_collection_status')
);

// Fmla Documentation Note
router.get('/fmla-documentation-note/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fmla_documentation_note'),
  createMedicalDataRoute('fmla_documentation_note', null, 'read:fmla_documentation_note')
);

// Mental Status Exam
router.get('/mental-status-exam/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:mental_status_exam'),
  createMedicalDataRoute('mental_status_exam', null, 'read:mental_status_exam')
);

// Myositis Assessment
router.get('/myositis-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:myositis_assessment'),
  createMedicalDataRoute('myositis_assessment', null, 'read:myositis_assessment')
);

// Neurosurgery Assessment
router.get('/neurosurgery-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:neurosurgery_assessment'),
  createMedicalDataRoute('neurosurgery_assessment', null, 'read:neurosurgery_assessment')
);

// Nuclear Medicine Assessment
router.get('/nuclear-medicine-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:nuclear_medicine_assessment'),
  createMedicalDataRoute('nuclear_medicine_assessment', null, 'read:nuclear_medicine_assessment')
);

// Nutritional Assessment
router.get('/nutritional-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:nutritional_assessment'),
  createMedicalDataRoute('nutritional_assessment', null, 'read:nutritional_assessment')
);

// Past Ocular History
router.get('/past-ocular-history/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:past_ocular_history'),
  createMedicalDataRoute('past_ocular_history', null, 'read:past_ocular_history')
);

// Ophthalmology Exam
router.get('/ophthalmology-exam/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ophthalmology_exam'),
  createMedicalDataRoute('ophthalmology_exam', null, 'read:ophthalmology_exam')
);

// Glaucoma Management
router.get('/glaucoma-management/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:glaucoma_management'),
  createMedicalDataRoute('glaucoma_management', null, 'read:glaucoma_management')
);

// Post Op Testing
router.get('/post-op-testing/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:post_op_testing'),
  createMedicalDataRoute('post_op_testing', null, 'read:post_op_testing')
);

// Pain Management
router.get('/pain-management/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pain_management'),
  createMedicalDataRoute('pain_management', null, 'read:pain_management')
);

// Pathology Report
router.get('/pathology-report/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pathology_report'),
  createMedicalDataRoute('pathology_report', null, 'read:pathology_report')
);

// Patient Id
router.get('/patient-id/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_id'),
  createMedicalDataRoute('patient_id', null, 'read:patient_id')
);

// Patient Name
router.get('/patient-name/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_name'),
  createMedicalDataRoute('patient_name', null, 'read:patient_name')
);

// Physical Examination
router.get('/physical-examination/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:physical_examination'),
  createMedicalDataRoute('physical_examination', null, 'read:physical_examination')
);

// Plastic Surgery Assessment
router.get('/plastic-surgery-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:plastic_surgery_assessment'),
  createMedicalDataRoute('plastic_surgery_assessment', null, 'read:plastic_surgery_assessment')
);

// Pmr Assessment
router.get('/pmr-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pmr_assessment'),
  createMedicalDataRoute('pmr_assessment', null, 'read:pmr_assessment')
);

// Preventive Medicine Assessment
router.get('/preventive-medicine-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:preventive_medicine_assessment'),
  createMedicalDataRoute('preventive_medicine_assessment', null, 'read:preventive_medicine_assessment')
);

// Procedures
router.get('/procedures/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:procedures'),
  createMedicalDataRoute('procedures', null, 'read:procedures')
);

// Provider License
router.get('/provider-license/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:provider_license'),
  createMedicalDataRoute('provider_license', null, 'read:provider_license')
);

// Provider Board Certification
router.get('/provider-board-certification/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:provider_board_certification'),
  createMedicalDataRoute('provider_board_certification', null, 'read:provider_board_certification')
);

// Provider Info
router.get('/provider-info/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:provider_info'),
  createMedicalDataRoute('provider_info', null, 'read:provider_info')
);

// Provider Signature
router.get('/provider-signature/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:provider_signature'),
  createMedicalDataRoute('provider_signature', null, 'read:provider_signature')
);

// Psychiatric Assessment Scales
router.get('/psychiatric-assessment-scales/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:psychiatric_assessment_scales'),
  createMedicalDataRoute('psychiatric_assessment_scales', null, 'read:psychiatric_assessment_scales')
);

// Psychiatric History
router.get('/psychiatric-history/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:psychiatric_history'),
  createMedicalDataRoute('psychiatric_history', null, 'read:psychiatric_history')
);

// Psychiatric Review
router.get('/psychiatric-review/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:psychiatric_review'),
  createMedicalDataRoute('psychiatric_review', null, 'read:psychiatric_review')
);

// Psychiatric Treatment Plan
router.get('/psychiatric-treatment-plan/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:psychiatric_treatment_plan'),
  createMedicalDataRoute('psychiatric_treatment_plan', null, 'read:psychiatric_treatment_plan')
);

router.post('/psychiatric-treatment-plan/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('write:psychiatric_treatment_plan'),
  createMedicalDataRoute('psychiatric_treatment_plan', null, 'write:psychiatric_treatment_plan')
);

router.put('/psychiatric-treatment-plan/:patientId/:documentId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('write:psychiatric_treatment_plan'),
  createMedicalDataRoute('psychiatric_treatment_plan', null, 'write:psychiatric_treatment_plan')
);

router.delete('/psychiatric-treatment-plan/:patientId/:documentId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('delete:psychiatric_treatment_plan'),
  createMedicalDataRoute('psychiatric_treatment_plan', null, 'delete:psychiatric_treatment_plan')
);

// Psychosocial Assessment
router.get('/psychosocial-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:psychosocial_assessments'),
  createMedicalDataRoute('psychosocial_assessments', null, 'read:psychosocial_assessments')
);

// Psychotropic Medications
router.get('/psychotropic-medications/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:psychotropic_medications'),
  createMedicalDataRoute('psychotropic_medications', null, 'read:psychotropic_medications')
);

router.post('/psychotropic-medications/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('write:psychotropic_medications'),
  createMedicalDataRoute('psychotropic_medications', null, 'write:psychotropic_medications')
);

router.put('/psychotropic-medications/:patientId/:documentId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('write:psychotropic_medications'),
  createMedicalDataRoute('psychotropic_medications', null, 'write:psychotropic_medications')
);

router.delete('/psychotropic-medications/:patientId/:documentId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('delete:psychotropic_medications'),
  createMedicalDataRoute('psychotropic_medications', null, 'delete:psychotropic_medications')
);

// Pulmonary Imaging
router.get('/pulmonary-imaging/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pulmonary_imaging'),
  createMedicalDataRoute('pulmonary_imaging', null, 'read:pulmonary_imaging')
);

// Pulmonary Rehabilitation
router.get('/pulmonary-rehabilitation/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pulmonary_rehabilitation'),
  createMedicalDataRoute('pulmonary_rehabilitation', null, 'read:pulmonary_rehabilitation')
);

// Radiology Findings
router.get('/radiology-findings/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:radiology_findings'),
  createMedicalDataRoute('radiology_findings', null, 'read:radiology_findings')
);

// Raw Text
router.get('/raw-text/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:raw_text'),
  createMedicalDataRoute('raw_text', null, 'read:raw_text')
);

// Respiratory Devices
router.get('/respiratory-devices/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:respiratory_devices'),
  createMedicalDataRoute('respiratory_devices', null, 'read:respiratory_devices')
);

// Respiratory Infections
router.get('/respiratory-infections/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:respiratory_infections'),
  createMedicalDataRoute('respiratory_infections', null, 'read:respiratory_infections')
);

// Respiratory Medications
router.get('/respiratory-medications/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:respiratory_medications'),
  createMedicalDataRoute('respiratory_medications', null, 'read:respiratory_medications')
);

// Rheumatoid Arthritis Assessment
router.get('/rheumatoid-arthritis-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:rheumatoid_arthritis_assessment'),
  createMedicalDataRoute('rheumatoid_arthritis_assessment', null, 'read:rheumatoid_arthritis_assessment')
);

// Rheumatologic Assessment
router.get('/rheumatologic-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:rheumatologic_assessment'),
  createMedicalDataRoute('rheumatologic_assessment', null, 'read:rheumatologic_assessment')
);

// Rheumatologic Monitoring
router.get('/rheumatologic-monitoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:rheumatologic_monitoring'),
  createMedicalDataRoute('rheumatologic_monitoring', null, 'read:rheumatologic_monitoring')
);

// Rheumatologic Treatment
router.get('/rheumatologic-treatment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:rheumatologic_treatment'),
  createMedicalDataRoute('rheumatologic_treatment', null, 'read:rheumatologic_treatment')
);

// Scleroderma Assessment
router.get('/scleroderma-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:scleroderma_assessment'),
  createMedicalDataRoute('scleroderma_assessment', null, 'read:scleroderma_assessment')
);

// Sjogrens Syndrome Assessment
router.get('/sjogrens-syndrome-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:sjogrens_syndrome_assessment'),
  createMedicalDataRoute('sjogrens_syndrome_assessment', null, 'read:sjogrens_syndrome_assessment')
);

// Source
router.get('/source/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:source'),
  createMedicalDataRoute('source', null, 'read:source')
);

// Spondyloarthritis Assessment
router.get('/spondyloarthritis-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:spondyloarthritis_assessment'),
  createMedicalDataRoute('spondyloarthritis_assessment', null, 'read:spondyloarthritis_assessment')
);

// Substance Use Assessment
router.get('/substance-use-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:substance_use_assessment'),
  createMedicalDataRoute('substance_use_assessment', null, 'read:substance_use_assessment')
);

// Suicide Risk Assessment
router.get('/suicide-risk-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:suicide_risk_assessment'),
  createMedicalDataRoute('suicide_risk_assessment', null, 'read:suicide_risk_assessment')
);

// Thoracic Surgery Assessment
router.get('/thoracic-surgery-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:thoracic_surgery_assessment'),
  createMedicalDataRoute('thoracic_surgery_assessment', null, 'read:thoracic_surgery_assessment')
);

// Treatment Course
router.get('/treatment-course/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:treatment_course'),
  createMedicalDataRoute('treatment_course', null, 'read:treatment_course')
);

// Treatment Goals
router.get('/treatment-goals/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:treatment_goals'),
  createMedicalDataRoute('treatment_goals', null, 'read:treatment_goals')
);

// Treatment Plan
router.get('/treatment-plan/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:treatment_plan'),
  createMedicalDataRoute('treatment_plan', null, 'read:treatment_plan')
);

// Urology Assessment
router.get('/urology-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:urology_assessment'),
  createMedicalDataRoute('urology_assessment', null, 'read:urology_assessment')
);

// Vasculitis Assessment
router.get('/vasculitis-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:vasculitis_assessment'),
  createMedicalDataRoute('vasculitis_assessment', null, 'read:vasculitis_assessment')
);

// Vascular Surgery Assessment
router.get('/vascular-surgery-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:vascular_surgery_assessment'),
  createMedicalDataRoute('vascular_surgery_assessment', null, 'read:vascular_surgery_assessment')
);

// Job Hazard Analysis
router.get('/job-hazard-analysis/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:job_hazard_analysis'),
  createMedicalDataRoute('job_hazard_analysis', null, 'read:job_hazard_analysis')
);

// Vascular Bypass Surgery
router.get('/vascular-bypass-surgery/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:vascular_bypass_surgery'),
  createMedicalDataRoute('vascular_bypass_surgery', null, 'read:vascular_bypass_surgery')
);

// Venous Insufficiency Assessment
router.get('/venous-insufficiency-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:venous_insufficiency_assessment'),
  createMedicalDataRoute('venous_insufficiency_assessment', null, 'read:venous_insufficiency_assessment')
);

// Aortic Aneurysm Surveillance
router.get('/aortic-aneurysm-surveillance/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:aortic_aneurysm_surveillance'),
  createMedicalDataRoute('aortic_aneurysm_surveillance', null, 'read:aortic_aneurysm_surveillance')
);

// Trauma Assessment
router.get('/trauma-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:trauma_assessment'),
  createMedicalDataRoute('trauma_assessment', null, 'read:trauma_assessment')
);

// Trauma Scoring
router.get('/trauma-scoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:trauma_scoring'),
  createMedicalDataRoute('trauma_scoring', null, 'read:trauma_scoring')
);

// Emergency Procedures
router.get('/emergency-procedures/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:emergency_procedures'),
  createMedicalDataRoute('emergency_procedures', null, 'read:emergency_procedures')
);

// Immunization Schedule
router.get('/immunization-schedule/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:immunization_schedule'),
  createMedicalDataRoute('immunization_schedule', null, 'read:immunization_schedule')
);

// Travel Vaccination Records
router.get('/travel-vaccination-records/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:travel_vaccination_records'),
  createMedicalDataRoute('travel_vaccination_records', null, 'read:travel_vaccination_records')
);

// Facial Trauma Assessment
router.get('/facial-trauma-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:facial_trauma_assessment'),
  createMedicalDataRoute('facial_trauma_assessment', null, 'read:facial_trauma_assessment')
);

// Insomnia Assessment
router.get('/insomnia-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:insomnia_assessment'),
  createMedicalDataRoute('insomnia_assessment', null, 'read:insomnia_assessment')
);

// Narcolepsy Assessment
router.get('/narcolepsy-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:narcolepsy_assessment'),
  createMedicalDataRoute('narcolepsy_assessment', null, 'read:narcolepsy_assessment')
);

// Fluid Intake
router.get('/fluid-intake/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fluid_intake'),
  createMedicalDataRoute('fluid_intake', null, 'read:fluid_intake')
);

// Fluid Output
router.get('/fluid-output/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fluid_output'),
  createMedicalDataRoute('fluid_output', null, 'read:fluid_output')
);

// Pressure Injury
router.get('/pressure-injury/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:pressure_injury'),
  createMedicalDataRoute('pressure_injury', null, 'read:pressure_injury')
);

// Blood Products
router.get('/blood-products/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:blood_products'),
  createMedicalDataRoute('blood_products', null, 'read:blood_products')
);

// Ventilator Settings
router.get('/ventilator-settings/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ventilator_settings'),
  createMedicalDataRoute('ventilator_settings', null, 'read:ventilator_settings')
);

// Lifestyle Counseling
router.get('/lifestyle-counseling/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:lifestyle_counseling'),
  createMedicalDataRoute('lifestyle_counseling', null, 'read:lifestyle_counseling')
);

// Health Maintenance
router.get('/health-maintenance/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:health_maintenance'),
  createMedicalDataRoute('health_maintenance', null, 'read:health_maintenance')
);

// Patient Instructions
router.get('/patient-instructions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_instructions'),
  createMedicalDataRoute('patient_instructions', null, 'read:patient_instructions')
);

// Referrals Placed
router.get('/referrals-placed/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:referrals_placed'),
  createMedicalDataRoute('referrals_placed', null, 'read:referrals_placed')
);

// Preventive Care
router.get('/preventive-care/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:preventive_care'),
  createMedicalDataRoute('preventive_care', null, 'read:preventive_care')
);

// Family Medicine Assessment
router.get('/family-medicine-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:family_medicine_assessment'),
  createMedicalDataRoute('family_medicine_assessment', null, 'read:family_medicine_assessment')
);

// Family Medicine Visits
router.get('/family-medicine-visits/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:family_medicine_visits'),
  createMedicalDataRoute('family_medicine_visits', null, 'read:family_medicine_visits')
);

// Symptom Progression
router.get('/symptom-progression/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:symptom_progression'),
  createMedicalDataRoute('symptom_progression', null, 'read:symptom_progression')
);

// Monitoring Plan
router.get('/monitoring-plan/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:monitoring_plan'),
  createMedicalDataRoute('monitoring_plan', null, 'read:monitoring_plan')
);

// Nutritional Support
router.get('/nutritional-support/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:nutritional_support'),
  createMedicalDataRoute('nutritional_support', null, 'read:nutritional_support')
);

// Social Work
router.get('/social-work/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:social_work'),
  createMedicalDataRoute('social_work', null, 'read:social_work')
);

// Peer Support
router.get('/peer-support/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:peer_support'),
  createMedicalDataRoute('peer_support', null, 'read:peer_support')
);

// Psychosocial Factors
router.get('/psychosocial-factors/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:psychosocial_factors'),
  createMedicalDataRoute('psychosocial_factors', null, 'read:psychosocial_factors')
);

// Psc Management
router.get('/psc-management/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:psc_management'),
  createMedicalDataRoute('psc_management', null, 'read:psc_management')
);

// Infusion Therapy
router.get('/infusion-therapy/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:infusion_therapy'),
  createMedicalDataRoute('infusion_therapy', null, 'read:infusion_therapy')
);

// Admission Decisions
router.get('/admission-decisions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:admission_decisions'),
  createMedicalDataRoute('admission_decisions', null, 'read:admission_decisions')
);

// Care Team
router.get('/care-team/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:care_team'),
  createMedicalDataRoute('care_team', null, 'read:care_team')
);

// Advance Care Planning
router.get('/advance-care-planning/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:advance_care_planning'),
  createMedicalDataRoute('advance_care_planning', null, 'read:advance_care_planning')
);

// Medication Changes New
router.get('/medication-changes-new/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medication_changes_new'),
  createMedicalDataRoute('medication_changes_new', null, 'read:medication_changes_new')
);

// Medication Changes Dose
router.get('/medication-changes-dose/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medication_changes_dose'),
  createMedicalDataRoute('medication_changes_dose', null, 'read:medication_changes_dose')
);

// Medication Changes Discontinued
router.get('/medication-changes-discontinued/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medication_changes_discontinued'),
  createMedicalDataRoute('medication_changes_discontinued', null, 'read:medication_changes_discontinued')
);

// Insurance Barriers
router.get('/insurance-barriers/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:insurance_barriers'),
  createMedicalDataRoute('insurance_barriers', null, 'read:insurance_barriers')
);

// Incontinence Tracking
router.get('/incontinence-tracking/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:incontinence_tracking'),
  createMedicalDataRoute('incontinence_tracking', null, 'read:incontinence_tracking')
);

// Body Image Concerns
router.get('/body-image-concerns/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:body_image_concerns'),
  createMedicalDataRoute('body_image_concerns', null, 'read:body_image_concerns')
);

// Genetic Counseling
router.get('/genetic-counseling/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:genetic_counseling'),
  createMedicalDataRoute('genetic_counseling', null, 'read:genetic_counseling')
);

// Family Counseling
router.get('/family-counseling/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:family_counseling'),
  createMedicalDataRoute('family_counseling', null, 'read:family_counseling')
);

// Caregiver Burden
router.get('/caregiver-burden/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:caregiver_burden'),
  createMedicalDataRoute('caregiver_burden', null, 'read:caregiver_burden')
);

// Social Support
router.get('/social-support/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:social_support'),
  createMedicalDataRoute('social_support', null, 'read:social_support')
);

// Geriatric Medications
router.get('/geriatric-medications/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:geriatric_medications'),
  createMedicalDataRoute('geriatric_medications', null, 'read:geriatric_medications')
);

// Polypharmacy
router.get('/polypharmacy/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:polypharmacy'),
  createMedicalDataRoute('polypharmacy', null, 'read:polypharmacy')
);

// Advance Directives
router.get('/advance-directives/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:advance_directives'),
  createMedicalDataRoute('advance_directives', null, 'read:advance_directives')
);

// Nutritional Status
router.get('/nutritional-status/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:nutritional_status'),
  createMedicalDataRoute('nutritional_status', null, 'read:nutritional_status')
);

// Home Safety
router.get('/home-safety/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:home_safety'),
  createMedicalDataRoute('home_safety', null, 'read:home_safety')
);

// Assistive Devices
router.get('/assistive-devices/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:assistive_devices'),
  createMedicalDataRoute('assistive_devices', null, 'read:assistive_devices')
);

// Palliative Care
router.get('/palliative-care/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:palliative_care'),
  createMedicalDataRoute('palliative_care', null, 'read:palliative_care')
);

// Compression Therapy
router.get('/compression-therapy/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:compression_therapy'),
  createMedicalDataRoute('compression_therapy', null, 'read:compression_therapy')
);

// Medication Deprescribing
router.get('/medication-deprescribing/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medication_deprescribing'),
  createMedicalDataRoute('medication_deprescribing', null, 'read:medication_deprescribing')
);

// Cardiac Monitoring
router.get('/cardiac-monitoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cardiac_monitoring'),
  createMedicalDataRoute('cardiac_monitoring', null, 'read:cardiac_monitoring')
);

// Vital Signs Monitoring
router.get('/vital-signs-monitoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:vital_signs_monitoring'),
  createMedicalDataRoute('vital_signs_monitoring', null, 'read:vital_signs_monitoring')
);

// Dietary Interventions
router.get('/dietary-interventions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dietary_interventions'),
  createMedicalDataRoute('dietary_interventions', null, 'read:dietary_interventions')
);

// Respite Care
router.get('/respite-care/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:respite_care'),
  createMedicalDataRoute('respite_care', null, 'read:respite_care')
);

// Day Programs
router.get('/day-programs/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:day_programs'),
  createMedicalDataRoute('day_programs', null, 'read:day_programs')
);

// Caregiver Support Groups
router.get('/caregiver-support-groups/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:caregiver_support_groups'),
  createMedicalDataRoute('caregiver_support_groups', null, 'read:caregiver_support_groups')
);

// Neuropsych Testing
router.get('/neuropsych-testing/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:neuropsych_testing'),
  createMedicalDataRoute('neuropsych_testing', null, 'read:neuropsych_testing')
);

// Dementia Education
router.get('/dementia-education/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:dementia_education'),
  createMedicalDataRoute('dementia_education', null, 'read:dementia_education')
);

// Safety Planning
router.get('/safety-planning/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:safety_planning'),
  createMedicalDataRoute('safety_planning', null, 'read:safety_planning')
);

// Fall Prevention Education
router.get('/fall-prevention-education/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:fall_prevention_education'),
  createMedicalDataRoute('fall_prevention_education', null, 'read:fall_prevention_education')
);

// Hydration Management
router.get('/hydration-management/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hydration_management'),
  createMedicalDataRoute('hydration_management', null, 'read:hydration_management')
);

// Weight Monitoring
router.get('/weight-monitoring/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:weight_monitoring'),
  createMedicalDataRoute('weight_monitoring', null, 'read:weight_monitoring')
);

// Anticoagulation Management
router.get('/anticoagulation-management/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:anticoagulation_management'),
  createMedicalDataRoute('anticoagulation_management', null, 'read:anticoagulation_management')
);

// Neurological Findings
router.get('/neurological-findings/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:neurological_findings'),
  createMedicalDataRoute('neurological_findings', null, 'read:neurological_findings')
);

// Living Situation
router.get('/living-situation/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:living_situation'),
  createMedicalDataRoute('living_situation', null, 'read:living_situation')
);

// Adult Day Program Info
router.get('/adult-day-program-info/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:adult_day_program_info'),
  createMedicalDataRoute('adult_day_program_info', null, 'read:adult_day_program_info')
);

// Weight Measurements
router.get('/weight-measurements/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:weight_measurements'),
  createMedicalDataRoute('weight_measurements', null, 'read:weight_measurements')
);

// Blood Pressure Readings
router.get('/blood-pressure-readings/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:blood_pressure_readings'),
  createMedicalDataRoute('blood_pressure_readings', null, 'read:blood_pressure_readings')
);

// Neurological Examination
router.get('/neurological-examination/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:neurological_examination'),
  createMedicalDataRoute('neurological_examination', null, 'read:neurological_examination')
);

// Family Meeting Decisions
router.get('/family-meeting-decisions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:family_meeting_decisions'),
  createMedicalDataRoute('family_meeting_decisions', null, 'read:family_meeting_decisions')
);

// Care Team Info
router.get('/care-team-info/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:care_team_info'),
  createMedicalDataRoute('care_team_info', null, 'read:care_team_info')
);

// Height Measurements
router.get('/height-measurements/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:height_measurements'),
  createMedicalDataRoute('height_measurements', null, 'read:height_measurements')
);

// Nutritional Supplementation
router.get('/nutritional-supplementation/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:nutritional_supplementation'),
  createMedicalDataRoute('nutritional_supplementation', null, 'read:nutritional_supplementation')
);

// Psa Screening
router.get('/psa-screening/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:psa_screening'),
  createMedicalDataRoute('psa_screening', null, 'read:psa_screening')
);

// Caregiver Support
router.get('/caregiver-support/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:caregiver_support'),
  createMedicalDataRoute('caregiver_support', null, 'read:caregiver_support')
);

// Hematology Assessment
router.get('/hematology-assessment/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:hematology_assessment'),
  createMedicalDataRoute('hematology_assessment', null, 'read:hematology_assessment')
);

// Follow Up Plan
router.get('/follow-up-plan/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:follow_up_plan'),
  createMedicalDataRoute('follow_up_plan', null, 'read:follow_up_plan')
);

// Immediate Interventions
router.get('/immediate-interventions/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:immediate_interventions'),
  createMedicalDataRoute('immediate_interventions', null, 'read:immediate_interventions')
);

// Ckd Management
router.get('/ckd-management/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:ckd_management'),
  createMedicalDataRoute('ckd_management', null, 'read:ckd_management')
);

// Cardiovascular Risk Reduction
router.get('/cardiovascular-risk-reduction/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:cardiovascular_risk_reduction'),
  createMedicalDataRoute('cardiovascular_risk_reduction', null, 'read:cardiovascular_risk_reduction')
);

// Medications Optimizations
router.get('/medications-optimizations/:patientId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:medications_optimizations'),
  createMedicalDataRoute('medications_optimizations', null, 'read:medications_optimizations')
);

// ========================================
// PUPPETEER PDF EXPORT
// ========================================

/**
 * Export Allergy Immunology Assessment as PDF using Puppeteer
 * @route POST /api/agent/pdf/allergy-immunology-assessment/:patientId
 * @description Generates PDF from React component HTML using headless browser
 */

// ========================================
// CLAUDE AGENT SDK - AGENTIC TOOL EXECUTION
// ========================================

/**
 * New Agent SDK Endpoint - True Agentic Tool Execution
 * @route POST /api/agent/agent-sdk/chat
 * @description Uses Claude Agent SDK for live streaming tool execution
 * - Claude dynamically selects which tools to use (not uploading all at once)
 * - Each tool execution is streamed live to frontend
 * - Real-time progress updates
 *
 * Benefits over current approach:
 * - Tools only sent as Claude needs them
 * - Live execution progress (no batching)
 * - Automatic agentic loop
 * - Better user experience
 */
router.post('/agent-sdk/chat', practiceContext, sessionRequireAuth, validateCSRF, async (req, res) => {
  try {
    const userId = req.user?.userId || req.session?.user?.id;
    const { message, language = 'en', sessionId, uploadInfo } = req.body;
    // Patient from the open artifact panel (frontend sends this). Used to auto-load per-patient
    // memory on the FIRST turn of a new conversation, before the agent has searched the patient.
    // IDOR guard: only trust this client-supplied id if the caller is actually authorized for it;
    // otherwise ignore it (the agent-resolved patient path still works). Prevents cross-patient
    // memory disclosure via a forged patientId in the request body.
    let bodyPatientId = (req.body && req.body.patientId) || null;
    if (bodyPatientId && !(await assertPatientAccess(req, bodyPatientId, null, false))) {
      console.warn(`⚠️ [Agent SDK] Ignoring unauthorized client-supplied patientId for memory recall`);
      bodyPatientId = null;
    }

    // DEBUG: Log sessionId and request details
    console.log(`🔍 [Agent Route] Received /agent-sdk/chat request - sessionId: ${sessionId ? sessionId.substring(0, 20) + '...' : 'NULL'}, messageLen: ${message?.length || 0}`);
    console.log(`🔍 [Agent Route] req.body keys:`, Object.keys(req.body));
    console.log(`🔍 [Agent Route] uploadInfo from req.body:`, uploadInfo ? JSON.stringify(uploadInfo) : 'undefined/null');

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Enhance message with uploadId if present (same as old agent)
    let enhancedMessage = message;
    if (uploadInfo && uploadInfo.uploadId) {
      enhancedMessage = `${message}\n[UPLOAD_ID:${uploadInfo.uploadId}]`;

      // 🔄 AUTO-PROCESSING: Add explicit instruction for document analysis
      // If no CSV type, it's a PDF/document that needs batch processing
      if (!uploadInfo.csvType || uploadInfo.csvType === null) {
        enhancedMessage += `\n\nIMPORTANT: A medical document was just uploaded. IMMEDIATELY call analyzeUploadedDocuments("${uploadInfo.uploadId}") to start batch processing and extract all medical data from the PDF.`;
        console.log(`📄 [Agent SDK] Added PDF analysis instruction for uploadId: ${uploadInfo.uploadId}`);
      }

      if (process.env.QUIET_LOGS !== 'true') console.log(`📎 [Agent SDK] Appended uploadId to message: ${uploadInfo.uploadId}`);
      console.log(`📝 [Agent SDK] Full enhanced message:\n${enhancedMessage}`);
    }

    // Set up SSE headers for streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true'
    });

    // TCP_NODELAY to force immediate transmission
    if (typeof res.socket !== 'undefined') {
      res.socket.setNoDelay(true);
    }

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(':heartbeat\n\n');
      } else {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      console.log('SSE client disconnected from /agent-sdk/chat');
      res.end();
    });

    // Streaming callback for Agent SDK
    const sendChunk = (chunk) => {
      if (!res.writableEnded) {
        const data = `data: ${JSON.stringify(chunk)}\n\n`;
        res.write(data);

        // Force immediate flush
        if (typeof res.flush === 'function') {
          res.flush();
        }
      }
    };

    // Use Agent SDK for agentic processing
    const agentSDKService = require('../services/agentSDKService');
    const practiceId = req.practice?.subdomain || 'global';

    // Enrich practiceContext with full user data for RBAC and permission requests
    const effectiveUserId = userId || req.user?.id;
    if (effectiveUserId && !req.practiceContext?.currentUser?.email) {
      try {
        const SecureDataAccess = require('../services/secureDataAccess');
        const { ObjectId } = require('mongodb');
        const userLookupCtx = { serviceId: 'agent-route', operation: 'user_lookup', practiceId };
        const userDoc = await SecureDataAccess.query(
          'users',
          { _id: new ObjectId(effectiveUserId) },
          { limit: 1, projection: { email: 1, firstName: 1, lastName: 1, roles: 1, permissions: 1, specialties: 1, isProvider: 1 } },
          userLookupCtx
        );
        if (userDoc && userDoc.length > 0) {
          const u = userDoc[0];
          req.practiceContext.currentUser = {
            id: effectiveUserId,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            fullName: [u.firstName, u.lastName].filter(Boolean).join(' '),
            roles: u.roles || [],
            permissions: u.permissions || [],
            specialties: u.specialties || [],
            isProvider: u.isProvider || false
          };
          console.log(`👤 [Agent SDK] Enriched practiceContext with user: ${u.email}`);
        }
      } catch (e) {
        console.warn(`⚠️ [Agent SDK] Failed to enrich user context: ${e.message}`);
      }
    }

    if (process.env.QUIET_LOGS !== 'true') console.log(`🤖 [Agent SDK] Processing message from user: ${userId}`);
    if (process.env.QUIET_LOGS !== 'true') console.log(`📝 Message: ${message.substring(0, 100)}...`);

    // CRITICAL: Load chat history from database if sessionId provided
    // This gives the agent context from previous messages in the conversation
    let conversationHistory = [];
    let conversationSummary = ''; // Phase 2: rolling compaction summary injected into the system prompt
    if (process.env.QUIET_LOGS !== 'true') console.log(`📚 [Agent Route] Chat history loading - sessionId provided: ${!!sessionId}`);
    if (sessionId) {
      try {
        const SecureDataAccess = require('../services/secureDataAccess');
        const secureContext = {
          serviceId: 'agent-route',
          operation: 'load_chat_history',
          practiceId: practiceId
        };

        // Load messages from database, sorted by creation time (oldest first)
        // Use _id for sorting as it's insertion-order stable (ObjectId timestamp)
        // Some older messages may not have createdAt field
        const dbMessages = await SecureDataAccess.query(
          'chat_messages',
          { sessionId },
          { sort: { _id: 1 } },  // Use _id which preserves insertion order
          secureContext
        );

        if (process.env.QUIET_LOGS !== 'true') console.log(`📚 [Agent SDK] Loaded ${dbMessages.length} messages from chat history`);

        // Debug: Show message types
        if (process.env.QUIET_LOGS !== 'true') console.log(`📚 [Debug] Message types in history:`, dbMessages.map(m => ({ type: m.type, isThinking: m.isThinking, sender: m.sender })));

        // CRITICAL: Decrypt encrypted message content before using in conversation history
        const encryptionService = require('../services/encryptionService');
        const decryptedMessages = await Promise.all(dbMessages.map(async (msg) => {
          try {
            // Check if content is encrypted (has encryption metadata)
            if (msg.content && typeof msg.content === 'object' && (msg.content.encrypted || msg.content.iv)) {
              const decrypted = await encryptionService.decrypt(msg.content);
              return { ...msg, content: decrypted };
            }
            return msg;
          } catch (decryptError) {
            console.warn(`⚠️ [Agent SDK] Failed to decrypt message:`, decryptError.message);
            // Return message with placeholder if decryption fails
            return { ...msg, content: '[Encrypted content - decryption failed]' };
          }
        }));

        if (process.env.QUIET_LOGS !== 'true') console.log(`📚 [Agent SDK] Decrypted ${decryptedMessages.length} messages successfully`);

        // CONVERSATION COMPACTION (Phase 2): fold older turns into a rolling summary and keep a
        // verbatim recent tail. The service NEVER throws into the chat path; on any failure we
        // fall back to the full decrypted history. The summary is injected into the (cached)
        // system prompt by agentSDKService; only the tail is sent as verbatim messages.
        let historyMessages = decryptedMessages;
        try {
          const conversationCompactionService = require('../services/conversationCompactionService');
          const prepared = await conversationCompactionService.prepareHistory({
            sessionId,
            messages: decryptedMessages,
            secureContext,
            practiceId,
            onEvent: sendChunk
          });
          conversationSummary = prepared.summaryText || '';
          historyMessages = prepared.tailMessages || decryptedMessages;
          if (process.env.QUIET_LOGS !== 'true') console.log(`🗜️  [Agent SDK] Compaction: summary ${conversationSummary ? 'present' : 'none'}, tail ${historyMessages.length}/${decryptedMessages.length} msgs`);
        } catch (compactionError) {
          console.error(`⚠️ [Agent SDK] Compaction skipped: ${compactionError.message}`);
        }

        // Convert database messages to Claude format (user/assistant)
        // CRITICAL: Include ALL messages (user, agent responses, AND tool results)
        // Tool results contain important context like patient IDs that Claude needs for follow-up questions
        conversationHistory = historyMessages
          .filter(msg => {
            // Keep user messages
            if (msg.type === 'user') return true;
            // Keep agent messages (both final responses and tool results)
            if (msg.type === 'agent') return true;
            // Exclude other types
            return false;
          })
          .map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
          }));

        if (process.env.QUIET_LOGS !== 'true') console.log(`📚 [Agent SDK] Converted to ${conversationHistory.length} conversation turns for Claude`);
        if (conversationHistory.length > 0) {
          if (process.env.QUIET_LOGS !== 'true') console.log(`📚 [Agent SDK] Last message in history: ${conversationHistory[conversationHistory.length - 1].role}`);
          if (process.env.QUIET_LOGS !== 'true') console.log(`📚 [Agent SDK] History roles: ${conversationHistory.map(m => m.role).join(' → ')}`);
          // DEBUG: Show content preview of each message to verify decryption worked
          conversationHistory.forEach((msg, idx) => {
            const preview = typeof msg.content === 'string' ? msg.content.substring(0, 100) : JSON.stringify(msg.content).substring(0, 100);
            if (process.env.QUIET_LOGS !== 'true') console.log(`📚 [Agent SDK] Turn ${idx}: ${msg.role} - "${preview}${msg.content && msg.content.length > 100 ? '...' : ''}"`);
          });
        }
      } catch (error) {
        console.error(`⚠️ [Agent SDK] Failed to load chat history: ${error.message}`);
        // Continue without history if load fails
        conversationHistory = [];
      }
    }

    console.log(`📚 [Agent Route] About to call agentSDKService with conversationHistory.length=${conversationHistory.length}`);
    console.log(`📚 [Agent Route] Passing uploadInfo to agentSDKService:`, uploadInfo ? JSON.stringify(uploadInfo) : 'null');

    const result = await agentSDKService.processChatMessageWithAgent(
      enhancedMessage,  // Use enhanced message with uploadId if present
      practiceId,
      language,
      sendChunk,
      req.practiceContext,  // Pass full practice context for SecureDataAccess
      conversationHistory,  // Pass chat history for multi-turn conversations
      uploadInfo,  // CRITICAL: Pass uploadInfo for patient CSV detection (PDFs still work via else block)
      sessionId,  // CRITICAL: Pass sessionId for patient context persistence
      conversationSummary,  // Phase 2: rolling compaction summary (empty until first compaction)
      bodyPatientId  // Phase 5: patient from open artifact panel — enables turn-1 memory recall
    );

    // Send final result
    if (!res.writableEnded) {
      const completeChunk = {
        type: 'complete',
        success: result.success,
        data: result.message || result.response
      };

      // CRITICAL: Pass through artifact panel data if present
      if (result.displayType) {
        completeChunk.displayType = result.displayType;
      }
      if (result.artifactPanel) {
        completeChunk.artifactPanel = result.artifactPanel;
        if (process.env.QUIET_LOGS !== 'true') console.log(`📊 [Agent Route] Forwarding artifact panel data for ${result.artifactPanel.category} to frontend`);
      }

      sendChunk(completeChunk);
      res.end();
    }

    // DISABLED: Redundant save - frontend streaming completion handler already saves messages
    // This was creating duplicate messages (one from frontend, one from backend)
    // Frontend save: ChatContainer.js:1197 via POST /api/chat/sessions/:sessionId/messages
    // Root cause: Both saves happening within ~50ms, creating two documents with different IDs
    // Fix date: 2025-11-07
    /*
    if (process.env.QUIET_LOGS !== 'true') console.log(`💾 [Agent Route] Saving response - success:${result.success}, hasMessage:${!!result.message}, messageLen:${result.message?.length || 0}, hasResponse:${!!result.response}, sessionId:${sessionId}`);
    if (result.success && (result.message || result.response) && sessionId) {
      try {
        const secureContext = {
          serviceId: 'agent-route',
          operation: 'save_agent_response',
          practiceId: req.practice?.subdomain || 'global'
        };

        const SecureDataAccess = require('../services/secureDataAccess');
        const agentMessage = {
          messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sender: 'agent',
          type: 'agent',
          content: result.message || result.response,
          language: language,
          actionTaken: 'agent_response',
          actionResult: result.actionResult || { success: true },
          timestamp: new Date(),
          sessionId: sessionId
        };

        const insertResult = await SecureDataAccess.insert('chat_messages', agentMessage, secureContext);
        if (process.env.QUIET_LOGS !== 'true') console.log(`✅ [Agent] Successfully saved agent response to database for session: ${sessionId}, insertedId: ${insertResult.insertedId}`);
      } catch (dbError) {
        console.error(`❌ [Agent] Failed to save agent response to database:`, dbError.message);
        console.error(`❌ [Agent] Stack:`, dbError.stack);
        // Don't throw - this is non-critical, response already sent to user
      }
    }
    */

    clearInterval(heartbeat);
  } catch (error) {
    console.error('❌ [Agent SDK] Error:', error);

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`);
      res.end();
    }
  }
});

// ============================================================================
// CROSS-CONVERSATION MEMORY + COMPACTION endpoints (Phases 3 & 6)
// See CONVERSATION_MEMORY_AND_COMPACTION_PLAN.md
// ============================================================================

/**
 * Build an authenticated SecureDataAccess context for patient-memory / compaction ops.
 * Reuses the 'agentSDKService' service account (the same credential that reads/writes patient
 * medical data), so inserts/updates on patient_agent_memory & chat_sessions reliably persist.
 */
function buildMemoryApiContext(req, operation) {
  const practiceId = req.practice?.subdomain || 'global';
  // 'agent-route' is a registered system service (allowedCollections ['*']) → guaranteed DB access.
  // NOTE: this is a SERVICE context used ONLY to run the internal lookups below; user authorization
  // is enforced explicitly by the assert* helpers (the context is scoped to the caller's practiceId,
  // so cross-tenant is impossible).
  return { serviceId: 'agent-route', operation, practiceId, practiceSubdomain: practiceId };
}

function getReqUserId(req) {
  const u = req.user || {};
  return (u._id && u._id.toString ? u._id.toString() : u._id) || u.userId || u.id || null;
}

/**
 * IDOR guard for patient-scoped memory. Returns true only if the caller may access `patientId`:
 *  1) the patient must exist IN THE CALLER'S PRACTICE DB (blocks cross-tenant + forged ids), and
 *  2) if the user has an EXPLICIT patient-scope restriction (patientGroupAccess), it is enforced.
 * Unrestricted users are never blocked (matches the agent's practice-level access model). Fail-closed.
 */
// Load the caller's patient-scope restriction (assigned/department). Prefer req.user (if the auth
// layer ever populates patientGroupAccess), else load it from the users collection. FAIL-OPEN: any
// lookup issue → treated as unrestricted, so a lookup problem can NEVER block a legitimate user
// (this matches the agent's own practice-level access; it only ever ADDS restriction for a
// genuinely-restricted account, never removes access from a normal one).
async function getUserPatientScope(req) {
  try {
    let pga = req.user?.patientGroupAccess || req.practiceContext?.currentUser?.patientGroupAccess;
    if (!pga) {
      const uid = getReqUserId(req);
      if (!uid) return { restricted: false };
      const SecureDataAccess = require('../services/secureDataAccess');
      const { ObjectId } = require('mongodb');
      let q; try { q = { _id: new ObjectId(String(uid)) }; } catch (_) { q = { _id: uid }; }
      const gctx = { serviceId: 'agent-route', operation: 'load_user_rbac', practiceId: 'global', practiceSubdomain: 'global' };
      const rows = await SecureDataAccess.query('users', q, { limit: 1, projection: { patientGroupAccess: 1, role: 1 } }, gctx);
      pga = rows && rows[0] && rows[0].patientGroupAccess;
    }
    if (pga && (pga.accessLevel === 'assigned' || pga.accessLevel === 'department')) {
      return { restricted: true, level: pga.accessLevel, assignedPatients: (pga.assignedPatients || []).map(String), departments: pga.departments || [] };
    }
    return { restricted: false };
  } catch (_) {
    return { restricted: false }; // fail-open — never block a legit user on a lookup problem
  }
}

/**
 * @param enforceRbac when true (REST endpoints) also enforce the caller's assigned/department scope;
 *   false on the hot chat path (bodyPatientId is the panel patient the user already opened) to avoid
 *   a per-turn users lookup. Tenant + forged-id checks always run. Fail-closed on error.
 */
async function assertPatientAccess(req, patientId, ctx, enforceRbac = true) {
  try {
    const SecureDataAccess = require('../services/secureDataAccess');
    const { ObjectId } = require('mongodb');
    if (!/^[0-9a-fA-F]{24}$/.test(String(patientId))) return false;
    const context = ctx || buildMemoryApiContext(req, 'patient_access_check');
    const rows = await SecureDataAccess.query('patients', { _id: new ObjectId(String(patientId)) }, { limit: 1, projection: { _id: 1, department: 1 } }, context);
    const patient = rows && rows[0];
    if (!patient) return false; // not in caller's practice (blocks cross-tenant + forged/nonexistent ids)
    if (enforceRbac) {
      const scope = await getUserPatientScope(req);
      if (scope.restricted) {
        if (scope.level === 'assigned' && !scope.assignedPatients.includes(String(patientId))) return false;
        if (scope.level === 'department' && patient.department && scope.departments.length && !scope.departments.includes(patient.department)) return false;
      }
    }
    return true;
  } catch (e) {
    console.error('[MemoryAPI] patient access check failed:', e.message);
    return false; // fail closed
  }
}

/** IDOR guard: chat sessions are user-owned; only the owner may operate on them. Fail-closed. */
async function assertSessionOwner(req, sessionId, ctx) {
  try {
    const SecureDataAccess = require('../services/secureDataAccess');
    const context = ctx || buildMemoryApiContext(req, 'session_owner_check');
    const rows = await SecureDataAccess.query('chat_sessions', { sessionId }, { limit: 1, projection: { sessionId: 1, userId: 1 } }, context);
    const session = rows && rows[0];
    if (!session) return { ok: false, code: 404, message: 'Session not found' };
    if (String(session.userId) !== String(getReqUserId(req))) return { ok: false, code: 403, message: 'Not authorized for this session' };
    return { ok: true };
  } catch (e) {
    console.error('[MemoryAPI] session owner check failed:', e.message);
    return { ok: false, code: 500, message: 'Authorization check failed' };
  }
}

/** IDOR guard for a memory doc by id: resolve its patientId, then apply assertPatientAccess. Fail-closed. */
async function assertMemoryAccess(req, memoryId, ctx) {
  try {
    const SecureDataAccess = require('../services/secureDataAccess');
    const { ObjectId } = require('mongodb');
    if (!/^[0-9a-fA-F]{24}$/.test(String(memoryId))) return { ok: false, code: 400, message: 'Invalid memory id' };
    const context = ctx || buildMemoryApiContext(req, 'memory_access_check');
    const rows = await SecureDataAccess.query('patient_agent_memory', { _id: new ObjectId(String(memoryId)) }, { limit: 1, projection: { _id: 1, patientId: 1 } }, context);
    const mem = rows && rows[0];
    if (!mem) return { ok: false, code: 404, message: 'Memory not found' };
    if (!(await assertPatientAccess(req, mem.patientId, context))) return { ok: false, code: 403, message: 'Not authorized for this patient' };
    return { ok: true };
  } catch (e) {
    console.error('[MemoryAPI] memory access check failed:', e.message);
    return { ok: false, code: 500, message: 'Authorization check failed' };
  }
}

// GET active (or all) memories for a patient — powers the "What I remember" panel.
router.get('/agent-sdk/patient-memory', sessionRequireAuth, async (req, res) => {
  try {
    const patientId = req.query.patientId;
    if (!patientId || !/^[0-9a-fA-F]{24}$/.test(String(patientId))) {
      return res.status(400).json({ success: false, message: 'Valid patientId is required' });
    }
    // IDOR guard: caller must be authorized for this patient.
    if (!(await assertPatientAccess(req, patientId))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this patient' });
    }
    const patientMemoryService = require('../services/patientMemoryService');
    const context = await buildMemoryApiContext(req, 'list_patient_memory');
    const includeDismissed = String(req.query.includeDismissed || '') === 'true';
    // Resolve the patient's display name for the panel header (practice-scoped lookup → no cross-tenant leak).
    let patientName = null;
    try {
      const SecureDataAccess = require('../services/secureDataAccess');
      const { ObjectId } = require('mongodb');
      const prows = await SecureDataAccess.query('patients', { _id: new ObjectId(String(patientId)) }, { limit: 1, projection: { firstName: 1, lastName: 1, name: 1 } }, context);
      const p = prows && prows[0];
      if (p) patientName = (p.name || `${p.firstName || ''} ${p.lastName || ''}`).trim() || null;
    } catch (_) { /* name is optional */ }
    const items = await patientMemoryService.list({ context, patientId, includeDismissed, limit: 200 });
    const memories = items.map(m => ({
      id: String(m._id), type: m.type, text: m.text, status: m.status,
      confidence: m.confidence, createdAt: m.createdAt, sourceSessionId: m.sourceSessionId
    }));
    return res.json({ success: true, patientName, memories });
  } catch (e) {
    console.error('[MemoryAPI] GET /patient-memory failed:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// PATCH a memory: edit its text and/or change status (active/dismissed).
router.patch('/agent-sdk/patient-memory/:id', sessionRequireAuth, validateCSRF, async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-fA-F]{24}$/.test(String(id))) return res.status(400).json({ success: false, message: 'Invalid memory id' });
    const { text, status } = req.body || {};
    const context = await buildMemoryApiContext(req, 'update_patient_memory');
    // IDOR guard: resolve the memory's patient and verify the caller may access it.
    const memAccess = await assertMemoryAccess(req, id, context);
    if (!memAccess.ok) return res.status(memAccess.code).json({ success: false, message: memAccess.message });
    const patientMemoryService = require('../services/patientMemoryService');
    if (typeof text === 'string' && text.trim()) {
      await patientMemoryService.updateText({ context, memoryId: id, text: text.trim() });
    }
    if (status && ['active', 'dismissed'].includes(status)) {
      await patientMemoryService.setStatus({ context, memoryId: id, status });
    }
    return res.json({ success: true });
  } catch (e) {
    console.error('[MemoryAPI] PATCH /patient-memory failed:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// DELETE a memory — SOFT delete (mark dismissed) to preserve the audit trail.
router.delete('/agent-sdk/patient-memory/:id', sessionRequireAuth, validateCSRF, async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-fA-F]{24}$/.test(String(id))) return res.status(400).json({ success: false, message: 'Invalid memory id' });
    const context = await buildMemoryApiContext(req, 'dismiss_patient_memory');
    // IDOR guard: resolve the memory's patient and verify the caller may access it.
    const memAccess = await assertMemoryAccess(req, id, context);
    if (!memAccess.ok) return res.status(memAccess.code).json({ success: false, message: memAccess.message });
    const patientMemoryService = require('../services/patientMemoryService');
    await patientMemoryService.dismiss({ context, memoryId: id });
    return res.json({ success: true });
  } catch (e) {
    console.error('[MemoryAPI] DELETE /patient-memory failed:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// POST manual "Compact now" for a session.
router.post('/agent-sdk/session/:sessionId/compact', sessionRequireAuth, validateCSRF, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId is required' });
    const context = await buildMemoryApiContext(req, 'manual_compact');
    // IDOR guard: only the session owner may compact it.
    const own = await assertSessionOwner(req, sessionId, context);
    if (!own.ok) return res.status(own.code).json({ success: false, message: own.message });
    const conversationCompactionService = require('../services/conversationCompactionService');
    const result = await conversationCompactionService.compactNow({ sessionId, secureContext: context, practiceId: context.practiceId });
    return res.json({ success: true, ...result });
  } catch (e) {
    console.error('[CompactionAPI] POST compact failed:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
