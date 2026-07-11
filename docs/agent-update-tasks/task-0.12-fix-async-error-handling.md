# Task 0.12: Fix Async Error Handling

## 🚨 **CRITICAL STABILITY TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 20 minutes  
**Risk Level:** CRITICAL  
**Priority:** URGENT  

Fix unhandled promise rejections and async errors that can crash the Node.js server and cause service outages.

## 🎯 **Objective**
Implement comprehensive async error handling that:
- Prevents unhandled promise rejections
- Catches all async errors in middleware and routes
- Provides graceful error recovery
- Ensures server stability under error conditions

## 🚨 **Stability Risk**
**CRITICAL:** Unhandled promise rejections crash Node.js servers and cause service outages.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add comprehensive async error handling**

## 🔍 **Current Async Error Issues**

### **Issue 1: Unhandled Promise Rejections**
```javascript
// CURRENT - CRASH RISK
router.post('/process-pending-upload', async (req, res) => {
  // ❌ DANGEROUS: Any await can throw and crash server
  const patient = await Patient.findOne({...}); // Can throw
  const document = new Document({...});
  await document.save(); // Can throw
  // No try-catch = unhandled rejection = server crash
});
```

### **Issue 2: Missing Error Boundaries**
```javascript
// CURRENT - NO ERROR BOUNDARIES
router.post('/chat', async (req, res) => {
  // ❌ Multiple async operations without error handling
  const result = await agent.processChatMessage(...); // Can throw
  const audit = await auditLog(...); // Can throw
  res.json(result); // Can fail if headers already sent
});
```

### **Issue 3: Middleware Error Propagation**
```javascript
// CURRENT - MIDDLEWARE ERRORS NOT CAUGHT
const someMiddleware = async (req, res, next) => {
  await someAsyncOperation(); // ❌ Can throw and crash
  next(); // ❌ next() not called if error occurs
};
```

## ✅ **Comprehensive Async Error Handling System**

### **1. Global Error Handlers**
```javascript
// ADD at top of file after imports:

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
  if (process.env.NODE_ENV === 'production') {
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
```

### **2. Async Route Wrapper**
```javascript
// ADD: Async route wrapper to catch all errors
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
```

### **3. Enhanced Error Handling Middleware**
```javascript
// ADD: Comprehensive error handling middleware
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

// Apply error handler to router
router.use(errorHandler);
```

### **4. Database Operation Error Handling**
```javascript
// ADD: Database operation wrapper
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

// Usage example:
const findPatient = async (req, query) => {
  return await dbOperation(
    () => req.models.Patient.findOne(query),
    {
      req: req,
      operationName: 'findPatient',
      collection: 'patients',
      query: query
    }
  );
};
```

### **5. Update Routes with Async Handling**
```javascript
// BEFORE - Unsafe async route:
router.post('/process-pending-upload', async (req, res) => {
  const patient = await Patient.findOne({...});
  const document = new Document({...});
  await document.save();
  res.json({success: true});
});

// AFTER - Safe async route:
router.post('/process-pending-upload',
  generalRateLimit,
  uploadRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  asyncHandler(async (req, res) => {
    try {
      const { uploadId, patientName } = req.body;
      
      // Safe database operations with error handling
      const pendingUpload = await dbOperation(
        () => req.models.PendingUpload.findOne({
          uploadId,
          practiceId: req.practice._id,
          status: 'pending'
        }),
        {
          req: req,
          operationName: 'findPendingUpload',
          collection: 'pendingUploads'
        }
      );
      
      if (!pendingUpload) {
        return sendLocalizedError(res, req.country, 'UPLOAD_NOT_FOUND', {}, 404);
      }
      
      const patient = await dbOperation(
        () => req.models.Patient.findOne({
          $or: [
            { firstName: new RegExp(patientName.split(' ')[0], 'i') },
            { lastName: new RegExp(patientName.split(' ').slice(1).join(' '), 'i') }
          ]
        }),
        {
          req: req,
          operationName: 'findPatient',
          collection: 'patients'
        }
      );
      
      if (!patient) {
        return sendLocalizedError(res, req.country, 'PATIENT_NOT_FOUND', {}, 404);
      }
      
      // Process files with error handling
      const results = [];
      for (const fileInfo of pendingUpload.files) {
        try {
          const document = new req.models.Document({
            patientId: patient._id,
            originalName: fileInfo.originalName,
            fileType: fileInfo.fileType,
            fileSize: fileInfo.size,
            encryptedData: fileInfo.encryptedData,
            metadata: {
              uploadDate: new Date(),
              uploadedBy: req.user._id,
              uploadId: uploadId
            }
          });
          
          await dbOperation(
            () => document.save(),
            {
              req: req,
              operationName: 'saveDocument',
              collection: 'documents'
            }
          );
          
          results.push({
            success: true,
            filename: fileInfo.originalName,
            documentId: document._id
          });
          
        } catch (error) {
          console.error(`❌ Error processing file ${fileInfo.originalName}:`, error);
          results.push({
            success: false,
            filename: fileInfo.originalName,
            error: error.message
          });
        }
      }
      
      // Update pending upload status
      await dbOperation(
        () => req.models.PendingUpload.updateOne(
          { uploadId },
          { 
            status: 'completed',
            completedAt: new Date(),
            results: results
          }
        ),
        {
          req: req,
          operationName: 'updatePendingUpload',
          collection: 'pendingUploads'
        }
      );
      
      // Audit log success
      await auditLog(req, 'UPLOAD_PROCESSED', {
        uploadId: uploadId,
        patientId: patient._id,
        fileCount: results.length,
        successCount: results.filter(r => r.success).length
      });
      
      res.json({
        success: true,
        message: getLocalizedSuccess(req.country, 'UPLOAD_COMPLETED'),
        data: {
          uploadId: uploadId,
          results: results,
          successCount: results.filter(r => r.success).length,
          totalCount: results.length
        }
      });
      
    } catch (error) {
      // This will be caught by asyncHandler and passed to error middleware
      throw error;
    }
  })
);
```

### **6. Middleware Error Handling**
```javascript
// BEFORE - Unsafe middleware:
const someMiddleware = async (req, res, next) => {
  await someAsyncOperation();
  next();
};

// AFTER - Safe middleware:
const someMiddleware = asyncMiddleware(async (req, res, next) => {
  try {
    await someAsyncOperation();
    next();
  } catch (error) {
    // Error will be caught by asyncMiddleware wrapper
    throw error;
  }
});

// Update existing middleware to be safe:
const detectCountry = asyncMiddleware(async (req, res, next) => {
  try {
    req.country = req.headers['x-country'] || 
                  req.user?.country || 
                  req.practice?.contact?.address?.country ||
                  'Israel';
    next();
  } catch (error) {
    console.error('❌ Country detection error:', error);
    req.country = 'Israel'; // Safe fallback
    next(); // Continue despite error
  }
});
```

### **7. Graceful Shutdown Handler**
```javascript
// ADD: Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`🛑 Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new connections
  if (global.server) {
    global.server.close(() => {
      console.log('✅ HTTP server closed');
      
      // Close database connections
      if (global.mongoose) {
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
```

## ⚠️ **Stability Notes**
- **🚨 CRITICAL:** Async error handling prevents server crashes
- **🚨 CRITICAL:** Global handlers catch unhandled rejections
- **🚨 CRITICAL:** Graceful shutdown prevents data corruption
- **❌ DON'T SKIP:** This is essential for production stability

## 🧪 **Stability Testing After Implementation**
1. **Test error handling:**
   - Trigger database errors → should be caught gracefully
   - Cause async errors → should not crash server

2. **Test unhandled rejections:**
   - Create promise rejection → should be logged and handled
   - Verify server doesn't crash

3. **Test graceful shutdown:**
   - Send SIGTERM signal → should shutdown gracefully
   - Verify connections are closed properly

## ✅ **Success Criteria**
- [ ] All async routes wrapped with error handling
- [ ] Global error handlers implemented
- [ ] Database operations safely wrapped
- [ ] Middleware errors caught and handled
- [ ] Graceful shutdown working
- [ ] No unhandled promise rejections

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 1.1:** Update addPatientFunction Schema (Phase 1)

## 📝 **CRITICAL NOTES**
- **PREVENTS SERVER CRASHES** - async error handling essential
- **ENABLES GRACEFUL RECOVERY** - proper error boundaries critical
- **MAINTAINS SERVICE AVAILABILITY** - stability under errors important
- **TEST THOROUGHLY** - verify all error scenarios are handled
