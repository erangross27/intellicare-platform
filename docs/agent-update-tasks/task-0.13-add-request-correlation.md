# Task 0.13: Add Request Correlation

## 🚨 **CRITICAL DEBUGGING TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 15 minutes  
**Risk Level:** MEDIUM  
**Priority:** HIGH  

Add request correlation IDs to enable proper debugging, tracing, and support across all operations.

## 🎯 **Objective**
Implement request correlation that:
- Assigns unique ID to every request
- Includes request ID in all logs and audit entries
- Enables end-to-end request tracing
- Improves debugging and support capabilities

## 🚨 **Support Risk**
**MEDIUM:** Without request correlation, debugging production issues and providing user support becomes extremely difficult.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add request correlation middleware and tracking**

## 🔍 **Current Correlation Issues**

### **Issue 1: No Request Tracking**
```javascript
// CURRENT - NO REQUEST CORRELATION
router.post('/chat', async (req, res) => {
  // ❌ No way to correlate logs across the request
  // ❌ No unique identifier for debugging
  // ❌ No tracing across async operations
});
```

### **Issue 2: Disconnected Logs**
```javascript
// CURRENT - DISCONNECTED LOGGING
console.log('Processing chat message');
await auditLog(req, 'CHAT_REQUEST', {...});
console.log('Chat processing complete');
// ❌ No way to connect these log entries
```

### **Issue 3: No Error Correlation**
```javascript
// CURRENT - NO ERROR CORRELATION
try {
  await someOperation();
} catch (error) {
  console.error('Operation failed:', error);
  // ❌ No request context in error logs
}
```

## ✅ **Request Correlation System**

### **1. Request ID Middleware**
```javascript
// ADD at top of file after imports:
const { v4: uuidv4 } = require('uuid');

// Request correlation middleware
const addRequestCorrelation = (req, res, next) => {
  // Generate unique request ID
  req.requestId = uuidv4();
  
  // Add to response headers for client tracking
  res.setHeader('X-Request-ID', req.requestId);
  
  // Add request start time for performance tracking
  req.startTime = Date.now();
  
  // Create request context
  req.context = {
    requestId: req.requestId,
    startTime: req.startTime,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    practiceSubdomain: req.practiceSubdomain,
    userId: null, // Will be set after authentication
    sessionId: null // Will be set if available
  };
  
  console.log(`🔍 [${req.requestId}] ${req.method} ${req.path} - Request started`);
  
  // Override res.end to log request completion
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - req.startTime;
    const statusCode = res.statusCode;
    
    console.log(`✅ [${req.requestId}] ${req.method} ${req.path} - ${statusCode} (${duration}ms)`);
    
    // Record request metrics with correlation
    if (global.metrics) {
      global.metrics.recordRequest(req, res, duration, statusCode < 400);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// Apply request correlation to all routes
router.use(addRequestCorrelation);
```

### **2. Enhanced Logging Functions**
```javascript
// ADD: Correlated logging functions
const createLogger = (req) => {
  const requestId = req.requestId || 'unknown';
  const context = req.context || {};
  
  return {
    info: (message, data = {}) => {
      console.log(`ℹ️ [${requestId}] ${message}`, {
        ...data,
        requestId: requestId,
        context: context
      });
    },
    
    warn: (message, data = {}) => {
      console.warn(`⚠️ [${requestId}] ${message}`, {
        ...data,
        requestId: requestId,
        context: context
      });
    },
    
    error: (message, error = null, data = {}) => {
      console.error(`❌ [${requestId}] ${message}`, {
        error: error?.message,
        stack: error?.stack,
        ...data,
        requestId: requestId,
        context: context
      });
    },
    
    debug: (message, data = {}) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🐛 [${requestId}] ${message}`, {
          ...data,
          requestId: requestId,
          context: context
        });
      }
    }
  };
};

// Enhanced audit logging with correlation
const correlatedAuditLog = async (req, action, details = {}) => {
  const enhancedDetails = {
    ...details,
    requestId: req.requestId,
    requestContext: req.context,
    timestamp: new Date(),
    duration: req.startTime ? Date.now() - req.startTime : null
  };
  
  // Use existing audit log function with enhanced details
  return await auditLog(req, action, enhancedDetails);
};
```

### **3. Context Enhancement Middleware**
```javascript
// ADD: Context enhancement middleware (after authentication)
const enhanceRequestContext = (req, res, next) => {
  if (req.context) {
    // Add user information after authentication
    if (req.user) {
      req.context.userId = req.user._id;
      req.context.userEmail = req.user.email;
      req.context.userRole = req.user.role;
    }
    
    // Add practice information
    if (req.practice) {
      req.context.practiceId = req.practice._id;
      req.context.practiceName = req.practice.name;
    }
    
    // Add session information
    if (req.body.sessionId || req.headers['x-session-id']) {
      req.context.sessionId = req.body.sessionId || req.headers['x-session-id'];
    }
    
    // Add country information
    if (req.country) {
      req.context.country = req.country;
    }
  }
  
  next();
};

// Apply after authentication middleware
router.use(enhanceRequestContext);
```

### **4. Update Route Handlers with Correlation**
```javascript
// BEFORE - No correlation:
router.post('/chat', async (req, res) => {
  console.log('Processing chat message');
  const result = await agent.processChatMessage(...);
  res.json(result);
});

// AFTER - With correlation:
router.post('/chat',
  // ... middleware ...
  asyncHandler(async (req, res) => {
    const logger = createLogger(req);
    
    try {
      const { message, sessionId = 'default', language = 'he' } = req.body;
      
      logger.info('Processing chat message', {
        messageLength: message.length,
        sessionId: sessionId,
        language: language
      });
      
      const clinicSessionId = createClinicSessionId(req.practiceSubdomain, sessionId);
      
      // Add request ID to practice context
      const enhancedContext = {
        ...req.practiceContext,
        requestId: req.requestId,
        logger: logger
      };
      
      const result = await aiCircuitBreakers.chat.execute(
        async () => {
          return await agent.processChatMessage(
            message, 
            clinicSessionId, 
            language, 
            enhancedContext
          );
        },
        aiFallbacks.chat
      );
      
      // Log with correlation
      if (result.fallback) {
        logger.warn('AI fallback used', {
          circuitBreakerState: aiCircuitBreakers.chat.state
        });
        
        await correlatedAuditLog(req, 'AI_FALLBACK_USED', {
          service: 'chat',
          circuitBreakerState: aiCircuitBreakers.chat.state
        });
      } else {
        logger.info('Chat processing completed successfully', {
          action: result.action,
          responseLength: result.message?.length || 0
        });
      }
      
      // Add request ID to response
      result.requestId = req.requestId;
      
      res.json(result);
      
    } catch (error) {
      const logger = createLogger(req);
      logger.error('Chat processing failed', error, {
        message: req.body.message?.substring(0, 100)
      });
      throw error;
    }
  })
);
```

### **5. Error Handling with Correlation**
```javascript
// UPDATE: Error handling middleware with correlation
const correlatedErrorHandler = (error, req, res, next) => {
  const logger = createLogger(req);
  
  logger.error('Request error occurred', error, {
    method: req.method,
    path: req.path,
    statusCode: error.status || 500,
    errorName: error.name
  });
  
  // Prevent multiple error responses
  if (res.headersSent) {
    logger.warn('Headers already sent, delegating to default error handler');
    return next(error);
  }
  
  // Enhanced error response with correlation
  const errorResponse = {
    success: false,
    error: getLocalizedError(req.country, 'SYSTEM_ERROR'),
    errorCode: 'SYSTEM_ERROR',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  };
  
  // Add debug info in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.debug = {
      message: error.message,
      stack: error.stack
    };
  }
  
  // Log correlated audit entry
  correlatedAuditLog(req, 'REQUEST_ERROR', {
    errorName: error.name,
    errorMessage: error.message,
    statusCode: error.status || 500
  });
  
  res.status(error.status || 500).json(errorResponse);
};

// Replace existing error handler
router.use(correlatedErrorHandler);
```

### **6. Database Operations with Correlation**
```javascript
// UPDATE: Database operations with correlation
const correlatedDbOperation = async (operation, context = {}) => {
  const requestId = context.requestId || 'unknown';
  const logger = context.logger || console;
  
  try {
    const startTime = Date.now();
    
    logger.debug('Database operation started', {
      operation: context.operationName || 'unknown',
      collection: context.collection
    });
    
    const result = await operation();
    const duration = Date.now() - startTime;
    
    logger.debug('Database operation completed', {
      operation: context.operationName || 'unknown',
      duration: duration
    });
    
    // Record metrics with correlation
    if (global.metrics) {
      global.metrics.recordDatabaseOperation(duration, true);
    }
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - (context.startTime || Date.now());
    
    logger.error('Database operation failed', error, {
      operation: context.operationName || 'unknown',
      collection: context.collection,
      duration: duration
    });
    
    // Record metrics with correlation
    if (global.metrics) {
      global.metrics.recordDatabaseOperation(duration, false);
    }
    
    throw error;
  }
};
```

### **7. Request Correlation Endpoints**
```javascript
// ADD: Request correlation debugging endpoints
router.get('/request/:requestId/trace',
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const { requestId } = req.params;
      
      // This would query your logging system for all entries with this request ID
      // Implementation depends on your logging infrastructure
      
      const trace = {
        requestId: requestId,
        message: 'Request tracing requires centralized logging system',
        suggestion: 'Implement with ELK stack, Splunk, or similar'
      };
      
      res.json({
        success: true,
        data: trace
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve request trace'
      });
    }
  })
);

router.get('/health/correlation',
  (req, res) => {
    // Test correlation system
    const logger = createLogger(req);
    
    logger.info('Health check for correlation system');
    
    res.json({
      success: true,
      requestId: req.requestId,
      context: req.context,
      timestamp: new Date()
    });
  }
);
```

### **8. Client-Side Correlation Support**
```javascript
// ADD: Client correlation helpers
const addClientCorrelationSupport = (req, res, next) => {
  // Accept client-provided request ID if available
  const clientRequestId = req.headers['x-client-request-id'];
  
  if (clientRequestId && /^[a-f0-9-]{36}$/.test(clientRequestId)) {
    // Use client request ID if it's a valid UUID
    req.requestId = clientRequestId;
    req.context.clientProvided = true;
  }
  
  // Always return request ID to client
  res.setHeader('X-Request-ID', req.requestId);
  
  next();
};

// Apply before other correlation middleware
router.use(addClientCorrelationSupport);
```

## ⚠️ **Correlation Notes**
- **🚨 IMPORTANT:** Request correlation enables effective debugging
- **🚨 IMPORTANT:** Consistent logging improves support capabilities
- **🚨 IMPORTANT:** Error correlation helps identify root causes
- **❌ DON'T SKIP:** This is essential for production support

## 🧪 **Testing After Implementation**
1. **Test request correlation:**
   - Make requests and verify unique IDs are generated
   - Check that request ID appears in all logs

2. **Test error correlation:**
   - Trigger errors and verify correlation in logs
   - Check error responses include request ID

3. **Test performance impact:**
   - Verify correlation doesn't significantly impact performance
   - Check memory usage with correlation enabled

## ✅ **Success Criteria**
- [ ] Unique request ID generated for every request
- [ ] Request ID included in all logs and audit entries
- [ ] Error responses include correlation information
- [ ] Client can provide and receive request IDs
- [ ] Performance impact is minimal
- [ ] Debugging capabilities improved

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 0.14:** Implement File Cleanup

## 📝 **CRITICAL NOTES**
- **ENABLES EFFECTIVE DEBUGGING** - correlation essential for support
- **IMPROVES ERROR TRACKING** - helps identify root causes
- **ENHANCES MONITORING** - better observability into system behavior
- **TEST THOROUGHLY** - verify correlation works across all operations
