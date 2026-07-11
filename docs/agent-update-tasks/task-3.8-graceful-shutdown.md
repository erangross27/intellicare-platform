# Task 3.8: Graceful Shutdown

## 📋 **Task Overview**
**Phase:** 3 (Utilities, Monitoring & Resilience)  
**Time Estimate:** 15 minutes  
**Risk Level:** MEDIUM  
**Priority:** HIGH  

Implement comprehensive graceful shutdown handling to ensure clean resource cleanup and prevent data corruption during server restarts or deployments.

## 🎯 **Objective**
Implement graceful shutdown that:
- Handles SIGTERM and SIGINT signals properly
- Completes pending operations before shutdown
- Cleans up all resources and connections
- Prevents data corruption during shutdown
- Provides proper shutdown logging and monitoring

## 🚨 **Stability Risk**
**MEDIUM:** Without graceful shutdown, server restarts can cause data corruption, connection leaks, and incomplete operations.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add comprehensive graceful shutdown system**

## 🔍 **Current Shutdown Issues**

### **Issue 1: No Graceful Shutdown Handling**
```javascript
// CURRENT - NO SHUTDOWN HANDLING
// ❌ No SIGTERM/SIGINT handlers
// ❌ Abrupt shutdown can corrupt data
// ❌ No cleanup of resources
// ❌ Connections left open
```

### **Issue 2: No Pending Operation Handling**
```javascript
// CURRENT - NO OPERATION COMPLETION
// ❌ File uploads interrupted mid-process
// ❌ Database transactions left incomplete
// ❌ AI operations terminated abruptly
```

### **Issue 3: No Resource Cleanup**
```javascript
// CURRENT - NO RESOURCE CLEANUP
// ❌ Database connections not closed
// ❌ File handles left open
// ❌ Memory not freed
// ❌ Timers and intervals not cleared
```

## ✅ **Comprehensive Graceful Shutdown System**

### **1. Shutdown Manager**
```javascript
// ADD at top of file after imports:

class GracefulShutdownManager {
  constructor() {
    this.isShuttingDown = false;
    this.pendingOperations = new Set();
    this.cleanupTasks = new Map();
    this.shutdownTimeout = 30000; // 30 seconds
    this.forceShutdownTimeout = 45000; // 45 seconds
    
    this.setupSignalHandlers();
    console.log('🛑 Graceful shutdown manager initialized');
  }
  
  setupSignalHandlers() {
    // Handle SIGTERM (Docker, Kubernetes, systemd)
    process.on('SIGTERM', () => {
      console.log('🛑 Received SIGTERM signal');
      this.initiateShutdown('SIGTERM');
    });
    
    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      console.log('🛑 Received SIGINT signal');
      this.initiateShutdown('SIGINT');
    });
    
    // Handle uncaught exceptions during shutdown
    process.on('uncaughtException', (error) => {
      console.error('🚨 Uncaught exception during shutdown:', error);
      if (this.isShuttingDown) {
        console.error('🚨 Force exiting due to exception during shutdown');
        process.exit(1);
      }
    });
  }
  
  async initiateShutdown(signal) {
    if (this.isShuttingDown) {
      console.log('⚠️ Shutdown already in progress, ignoring signal');
      return;
    }
    
    this.isShuttingDown = true;
    const startTime = Date.now();
    
    console.log(`🛑 Starting graceful shutdown (signal: ${signal})...`);
    
    try {
      // Set force shutdown timeout
      const forceShutdownTimer = setTimeout(() => {
        console.error('🚨 Force shutdown timeout reached, exiting immediately');
        process.exit(1);
      }, this.forceShutdownTimeout);
      
      // Step 1: Stop accepting new requests
      await this.stopAcceptingRequests();
      
      // Step 2: Wait for pending operations to complete
      await this.waitForPendingOperations();
      
      // Step 3: Run cleanup tasks
      await this.runCleanupTasks();
      
      // Step 4: Close connections and resources
      await this.closeConnections();
      
      const duration = Date.now() - startTime;
      console.log(`✅ Graceful shutdown completed in ${duration}ms`);
      
      clearTimeout(forceShutdownTimer);
      process.exit(0);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Graceful shutdown failed after ${duration}ms:`, error);
      process.exit(1);
    }
  }
  
  async stopAcceptingRequests() {
    console.log('🚪 Stopping acceptance of new requests...');
    
    // Close HTTP server
    if (global.server) {
      return new Promise((resolve, reject) => {
        global.server.close((error) => {
          if (error) {
            console.error('❌ Error closing HTTP server:', error);
            reject(error);
          } else {
            console.log('✅ HTTP server closed');
            resolve();
          }
        });
      });
    }
  }
  
  async waitForPendingOperations() {
    if (this.pendingOperations.size === 0) {
      console.log('✅ No pending operations to wait for');
      return;
    }
    
    console.log(`⏳ Waiting for ${this.pendingOperations.size} pending operations...`);
    
    const waitStart = Date.now();
    const maxWait = this.shutdownTimeout - 5000; // Leave 5s for cleanup
    
    while (this.pendingOperations.size > 0 && (Date.now() - waitStart) < maxWait) {
      console.log(`⏳ Still waiting for ${this.pendingOperations.size} operations...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (this.pendingOperations.size > 0) {
      console.warn(`⚠️ ${this.pendingOperations.size} operations still pending, proceeding with shutdown`);
    } else {
      console.log('✅ All pending operations completed');
    }
  }
  
  async runCleanupTasks() {
    console.log('🧹 Running cleanup tasks...');
    
    const cleanupPromises = [];
    
    for (const [name, task] of this.cleanupTasks) {
      cleanupPromises.push(
        this.runCleanupTask(name, task).catch(error => {
          console.error(`❌ Cleanup task '${name}' failed:`, error);
        })
      );
    }
    
    await Promise.allSettled(cleanupPromises);
    console.log('✅ Cleanup tasks completed');
  }
  
  async runCleanupTask(name, task) {
    console.log(`🧹 Running cleanup task: ${name}`);
    
    const timeout = task.timeout || 5000;
    
    return Promise.race([
      task.cleanup(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Cleanup task '${name}' timeout`)), timeout)
      )
    ]);
  }
  
  async closeConnections() {
    console.log('🔌 Closing connections...');
    
    const closeTasks = [];
    
    // Close database connections
    if (global.mongoose) {
      closeTasks.push(
        global.mongoose.connection.close().then(() => {
          console.log('✅ Database connection closed');
        }).catch(error => {
          console.error('❌ Error closing database connection:', error);
        })
      );
    }
    
    // Close Redis connections if available
    if (global.redis) {
      closeTasks.push(
        global.redis.quit().then(() => {
          console.log('✅ Redis connection closed');
        }).catch(error => {
          console.error('❌ Error closing Redis connection:', error);
        })
      );
    }
    
    await Promise.allSettled(closeTasks);
    console.log('✅ Connections closed');
  }
  
  // Register a pending operation
  registerOperation(operationId, description = 'Unknown operation') {
    if (this.isShuttingDown) {
      throw new Error('Server is shutting down, cannot start new operations');
    }
    
    const operation = {
      id: operationId,
      description: description,
      startTime: Date.now()
    };
    
    this.pendingOperations.add(operation);
    console.log(`📝 Registered operation: ${operationId} (${description})`);
    
    return operation;
  }
  
  // Unregister a completed operation
  unregisterOperation(operationId) {
    const operation = Array.from(this.pendingOperations).find(op => op.id === operationId);
    
    if (operation) {
      this.pendingOperations.delete(operation);
      const duration = Date.now() - operation.startTime;
      console.log(`✅ Completed operation: ${operationId} (${duration}ms)`);
    }
  }
  
  // Add a cleanup task
  addCleanupTask(name, cleanupFunction, timeout = 5000) {
    this.cleanupTasks.set(name, {
      cleanup: cleanupFunction,
      timeout: timeout
    });
    
    console.log(`📋 Added cleanup task: ${name}`);
  }
  
  // Check if server is shutting down
  isShuttingDownNow() {
    return this.isShuttingDown;
  }
  
  getStatus() {
    return {
      isShuttingDown: this.isShuttingDown,
      pendingOperations: this.pendingOperations.size,
      cleanupTasks: this.cleanupTasks.size,
      operations: Array.from(this.pendingOperations).map(op => ({
        id: op.id,
        description: op.description,
        duration: Date.now() - op.startTime
      }))
    };
  }
}

// Create global shutdown manager
const shutdownManager = new GracefulShutdownManager();
global.shutdownManager = shutdownManager;
```

### **2. Operation Tracking Middleware**
```javascript
// ADD: Operation tracking middleware
const trackOperation = (operationName) => {
  return (req, res, next) => {
    // Check if server is shutting down
    if (shutdownManager.isShuttingDownNow()) {
      return res.status(503).json({
        success: false,
        error: 'Server is shutting down',
        message: 'Please try again later'
      });
    }
    
    // Register operation
    const operationId = req.requestId || crypto.randomBytes(8).toString('hex');
    const operation = shutdownManager.registerOperation(operationId, operationName);
    
    req.operation = operation;
    
    // Unregister operation when response ends
    const originalEnd = res.end;
    res.end = function(...args) {
      shutdownManager.unregisterOperation(operationId);
      originalEnd.apply(this, args);
    };
    
    next();
  };
};

// Apply operation tracking to critical routes
router.post('/upload-document',
  // ... other middleware ...
  trackOperation('document_upload'),
  asyncHandler(async (req, res) => {
    // ... upload logic ...
  })
);

router.post('/process-pending-upload',
  // ... other middleware ...
  trackOperation('process_upload'),
  asyncHandler(async (req, res) => {
    // ... processing logic ...
  })
);

router.post('/chat',
  // ... other middleware ...
  trackOperation('chat_request'),
  asyncHandler(async (req, res) => {
    // ... chat logic ...
  })
);
```

### **3. Cleanup Task Registration**
```javascript
// ADD: Register cleanup tasks for various components

// File cleanup task
shutdownManager.addCleanupTask('file_cleanup', async () => {
  if (global.fileCleanup) {
    console.log('🧹 Running final file cleanup...');
    await global.fileCleanup.cleanupOrphanedFiles();
  }
}, 10000);

// Data retention cleanup task
shutdownManager.addCleanupTask('data_retention', async () => {
  if (global.dataRetention) {
    console.log('🗑️ Stopping data retention manager...');
    global.dataRetention.stopScheduledCleanup();
  }
}, 5000);

// Circuit breaker cleanup task
shutdownManager.addCleanupTask('circuit_breakers', async () => {
  if (global.circuitBreakers) {
    console.log('🔌 Resetting circuit breakers...');
    const breakers = global.circuitBreakers.getAllBreakers();
    breakers.forEach(breaker => {
      if (breaker.state === 'HALF_OPEN') {
        breaker.forceState('CLOSED');
      }
    });
  }
}, 3000);

// Metrics cleanup task
shutdownManager.addCleanupTask('metrics', async () => {
  if (global.metrics) {
    console.log('📊 Flushing final metrics...');
    // Emit final metrics
    global.metrics.emit('server_shutdown', {
      timestamp: new Date(),
      uptime: process.uptime(),
      pendingOperations: shutdownManager.getStatus().pendingOperations
    });
  }
}, 3000);

// Memory cleanup task
shutdownManager.addCleanupTask('memory', async () => {
  console.log('🧠 Clearing memory buffers...');
  
  // Clear large buffers
  if (global.largeBuffers) {
    global.largeBuffers.clear();
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}, 2000);

// Audit log flush task
shutdownManager.addCleanupTask('audit_logs', async () => {
  console.log('📝 Flushing audit logs...');
  
  // If you have a log buffer, flush it here
  if (global.auditLogger && global.auditLogger.flush) {
    await global.auditLogger.flush();
  }
}, 5000);
```

### **4. Shutdown Status Endpoints**
```javascript
// ADD: Shutdown status endpoints
router.get('/shutdown/status',
  practiceAuth,
  requireAuth,
  (req, res) => {
    const status = shutdownManager.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  }
);

router.post('/shutdown/initiate',
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    // Only allow admin users to initiate shutdown
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can initiate shutdown'
      });
    }
    
    const logger = createLogger(req);
    
    logger.warn('Manual shutdown initiated', {
      initiatedBy: req.user._id,
      userEmail: req.user.email
    });
    
    await correlatedAuditLog(req, 'MANUAL_SHUTDOWN_INITIATED', {
      initiatedBy: req.user._id,
      userEmail: req.user.email
    });
    
    res.json({
      success: true,
      message: 'Shutdown initiated'
    });
    
    // Initiate shutdown after response is sent
    setTimeout(() => {
      shutdownManager.initiateShutdown('MANUAL');
    }, 1000);
  })
);
```

### **5. Health Check Integration**
```javascript
// UPDATE: Health check to include shutdown status
const originalCheckMemoryUsage = healthChecks.checkMemoryUsage;

healthChecks.checkMemoryUsage = async function() {
  const memoryResult = await originalCheckMemoryUsage.call(this);
  
  // Add shutdown status to memory check
  const shutdownStatus = shutdownManager.getStatus();
  
  return {
    ...memoryResult,
    shutdown_status: {
      is_shutting_down: shutdownStatus.isShuttingDown,
      pending_operations: shutdownStatus.pendingOperations
    }
  };
};

// Add shutdown-specific health check
healthChecks.addCheck('shutdown_manager', {
  name: 'Shutdown Manager Status',
  timeout: 1000,
  critical: false,
  check: async () => {
    const status = shutdownManager.getStatus();
    
    return {
      is_shutting_down: status.isShuttingDown,
      pending_operations: status.pendingOperations,
      cleanup_tasks: status.cleanupTasks,
      status: status.isShuttingDown ? 'shutting_down' : 'operational'
    };
  }
});
```

### **6. Deployment Integration**
```javascript
// ADD: Deployment-friendly shutdown handling
const handleDeploymentShutdown = () => {
  // For Docker/Kubernetes deployments
  if (process.env.NODE_ENV === 'production') {
    // Increase shutdown timeout for production
    shutdownManager.shutdownTimeout = 60000; // 60 seconds
    shutdownManager.forceShutdownTimeout = 90000; // 90 seconds
    
    console.log('🚀 Production shutdown timeouts configured');
  }
  
  // Handle PM2 shutdown signals
  if (process.env.PM2_HOME) {
    process.on('message', (msg) => {
      if (msg === 'shutdown') {
        console.log('🛑 Received PM2 shutdown message');
        shutdownManager.initiateShutdown('PM2');
      }
    });
  }
};

// Initialize deployment shutdown handling
handleDeploymentShutdown();
```

### **7. Shutdown Monitoring**
```javascript
// ADD: Shutdown monitoring and logging
const monitorShutdown = () => {
  // Log shutdown progress
  const originalInitiateShutdown = shutdownManager.initiateShutdown;
  
  shutdownManager.initiateShutdown = async function(signal) {
    // Log shutdown initiation
    if (global.metrics) {
      global.metrics.emit('shutdown_initiated', {
        signal: signal,
        timestamp: new Date(),
        uptime: process.uptime(),
        pendingOperations: this.pendingOperations.size
      });
    }
    
    return originalInitiateShutdown.call(this, signal);
  };
};

// Start shutdown monitoring
monitorShutdown();
```

## ⚠️ **Graceful Shutdown Notes**
- **🚨 CRITICAL:** Graceful shutdown prevents data corruption
- **🚨 CRITICAL:** Operation tracking ensures completion
- **🚨 CRITICAL:** Resource cleanup prevents leaks
- **❌ DON'T SKIP:** This is essential for production deployments

## 🧪 **Testing After Implementation**
1. **Test graceful shutdown:**
   - Send SIGTERM signal and verify clean shutdown
   - Test with pending operations

2. **Test operation tracking:**
   - Verify operations are tracked and completed
   - Test shutdown rejection during shutdown

3. **Test cleanup tasks:**
   - Verify all cleanup tasks execute
   - Test timeout handling

## ✅ **Success Criteria**
- [ ] Graceful shutdown manager operational
- [ ] Signal handlers working correctly
- [ ] Operation tracking functional
- [ ] Cleanup tasks executing properly
- [ ] Resource cleanup working
- [ ] Shutdown monitoring active

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 4.1:** Test Israeli Functions (Phase 4)

## 📝 **CRITICAL NOTES**
- **PREVENTS DATA CORRUPTION** - graceful shutdown essential
- **ENSURES CLEAN DEPLOYMENTS** - proper shutdown critical for production
- **MAINTAINS SYSTEM INTEGRITY** - resource cleanup important
- **TEST THOROUGHLY** - verify shutdown works in all scenarios
