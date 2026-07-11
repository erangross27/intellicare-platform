# Task 3.7: Enhanced Health Checks

## 📋 **Task Overview**
**Phase:** 3 (Utilities, Monitoring & Resilience)  
**Time Estimate:** 20 minutes  
**Risk Level:** LOW  
**Priority:** MEDIUM  

Add comprehensive health checks that verify all critical system dependencies and provide detailed system status information.

## 🎯 **Objective**
Implement enhanced health checks that:
- Verify database connectivity and performance
- Check AI service availability and response times
- Monitor file storage accessibility
- Validate cache/Redis connectivity
- Provide detailed dependency status

## 🚨 **Monitoring Risk**
**LOW:** Without comprehensive health checks, dependency failures may go undetected until they cause user-facing issues.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add comprehensive health check system**

## 🔍 **Current Health Check Limitations**

### **Issue 1: Basic Health Check Only**
```javascript
// CURRENT - BASIC HEALTH CHECK
router.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
  // ❌ No dependency verification
  // ❌ No performance metrics
  // ❌ No detailed status information
});
```

### **Issue 2: No Dependency Verification**
```javascript
// CURRENT - NO DEPENDENCY CHECKS
// ❌ No database connectivity check
// ❌ No AI service availability check
// ❌ No file storage verification
// ❌ No cache connectivity test
```

### **Issue 3: No Performance Metrics**
```javascript
// CURRENT - NO PERFORMANCE DATA
// ❌ No response time measurements
// ❌ No throughput metrics
// ❌ No resource utilization data
```

## ✅ **Enhanced Health Check System**

### **1. Comprehensive Health Check Manager**
```javascript
// ADD at top of file after imports:
const mongoose = require('mongoose');

class HealthCheckManager {
  constructor() {
    this.checks = new Map();
    this.lastResults = new Map();
    this.setupDefaultChecks();
    
    console.log('🏥 Health check manager initialized');
  }
  
  setupDefaultChecks() {
    // Database connectivity check
    this.addCheck('database', {
      name: 'Database Connectivity',
      timeout: 5000,
      critical: true,
      check: this.checkDatabase.bind(this)
    });
    
    // AI service availability check
    this.addCheck('ai_service', {
      name: 'AI Service Availability',
      timeout: 10000,
      critical: false,
      check: this.checkAIService.bind(this)
    });
    
    // File storage check
    this.addCheck('file_storage', {
      name: 'File Storage Access',
      timeout: 3000,
      critical: true,
      check: this.checkFileStorage.bind(this)
    });
    
    // Memory usage check
    this.addCheck('memory', {
      name: 'Memory Usage',
      timeout: 1000,
      critical: false,
      check: this.checkMemoryUsage.bind(this)
    });
    
    // Circuit breaker status check
    this.addCheck('circuit_breakers', {
      name: 'Circuit Breaker Status',
      timeout: 1000,
      critical: false,
      check: this.checkCircuitBreakers.bind(this)
    });
    
    // File cleanup status check
    this.addCheck('file_cleanup', {
      name: 'File Cleanup Status',
      timeout: 1000,
      critical: false,
      check: this.checkFileCleanup.bind(this)
    });
  }
  
  addCheck(id, config) {
    this.checks.set(id, {
      id: id,
      ...config,
      lastRun: null,
      consecutiveFailures: 0,
      totalRuns: 0,
      totalFailures: 0
    });
  }
  
  async runCheck(checkId) {
    const check = this.checks.get(checkId);
    if (!check) {
      throw new Error(`Health check '${checkId}' not found`);
    }
    
    const startTime = Date.now();
    check.totalRuns++;
    
    try {
      // Run check with timeout
      const result = await Promise.race([
        check.check(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), check.timeout)
        )
      ]);
      
      const duration = Date.now() - startTime;
      
      const checkResult = {
        id: checkId,
        name: check.name,
        status: 'healthy',
        duration: duration,
        timestamp: new Date(),
        details: result,
        critical: check.critical
      };
      
      // Reset consecutive failures on success
      check.consecutiveFailures = 0;
      check.lastRun = new Date();
      
      this.lastResults.set(checkId, checkResult);
      return checkResult;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      check.consecutiveFailures++;
      check.totalFailures++;
      check.lastRun = new Date();
      
      const checkResult = {
        id: checkId,
        name: check.name,
        status: 'unhealthy',
        duration: duration,
        timestamp: new Date(),
        error: error.message,
        critical: check.critical,
        consecutiveFailures: check.consecutiveFailures
      };
      
      this.lastResults.set(checkId, checkResult);
      return checkResult;
    }
  }
  
  async runAllChecks() {
    const results = [];
    const startTime = Date.now();
    
    // Run all checks in parallel
    const checkPromises = Array.from(this.checks.keys()).map(async (checkId) => {
      try {
        return await this.runCheck(checkId);
      } catch (error) {
        return {
          id: checkId,
          name: this.checks.get(checkId).name,
          status: 'error',
          error: error.message,
          critical: this.checks.get(checkId).critical
        };
      }
    });
    
    const checkResults = await Promise.all(checkPromises);
    results.push(...checkResults);
    
    const totalDuration = Date.now() - startTime;
    
    // Determine overall health status
    const criticalFailures = results.filter(r => r.critical && r.status !== 'healthy');
    const anyFailures = results.filter(r => r.status !== 'healthy');
    
    let overallStatus = 'healthy';
    if (criticalFailures.length > 0) {
      overallStatus = 'critical';
    } else if (anyFailures.length > 0) {
      overallStatus = 'degraded';
    }
    
    return {
      status: overallStatus,
      timestamp: new Date(),
      duration: totalDuration,
      checks: results,
      summary: {
        total: results.length,
        healthy: results.filter(r => r.status === 'healthy').length,
        unhealthy: results.filter(r => r.status === 'unhealthy').length,
        critical_failures: criticalFailures.length
      }
    };
  }
  
  // Database connectivity check
  async checkDatabase() {
    try {
      const startTime = Date.now();
      
      // Test basic connectivity
      const state = mongoose.connection.readyState;
      if (state !== 1) {
        throw new Error(`Database not connected (state: ${state})`);
      }
      
      // Test query performance
      const testQuery = mongoose.connection.db.admin().ping();
      await testQuery;
      
      const queryTime = Date.now() - startTime;
      
      // Get connection info
      const dbName = mongoose.connection.name;
      const host = mongoose.connection.host;
      const port = mongoose.connection.port;
      
      return {
        connected: true,
        database: dbName,
        host: host,
        port: port,
        query_time_ms: queryTime,
        connection_state: state
      };
      
    } catch (error) {
      throw new Error(`Database check failed: ${error.message}`);
    }
  }
  
  // AI service availability check
  async checkAIService() {
    try {
      // Check circuit breaker status
      const chatBreaker = global.circuitBreakers?.breakers?.get('ai_chat');
      
      if (chatBreaker && chatBreaker.state === 'OPEN') {
        return {
          available: false,
          reason: 'Circuit breaker is OPEN',
          circuit_breaker_state: chatBreaker.state,
          failure_count: chatBreaker.failureCount
        };
      }
      
      // Test AI service with a simple request
      const startTime = Date.now();
      
      // This would be a lightweight test call to your AI service
      // For now, we'll simulate it
      const testResult = {
        available: true,
        response_time_ms: Date.now() - startTime,
        circuit_breaker_state: chatBreaker?.state || 'CLOSED',
        last_failure: chatBreaker?.lastFailureTime
      };
      
      return testResult;
      
    } catch (error) {
      throw new Error(`AI service check failed: ${error.message}`);
    }
  }
  
  // File storage accessibility check
  async checkFileStorage() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const tempDir = path.join(__dirname, '../temp');
      const testFile = path.join(tempDir, 'health-check-test.txt');
      const testContent = `Health check test - ${Date.now()}`;
      
      const startTime = Date.now();
      
      // Test write
      await fs.writeFile(testFile, testContent);
      
      // Test read
      const readContent = await fs.readFile(testFile, 'utf8');
      
      // Test delete
      await fs.unlink(testFile);
      
      const operationTime = Date.now() - startTime;
      
      if (readContent !== testContent) {
        throw new Error('File content mismatch');
      }
      
      return {
        accessible: true,
        operation_time_ms: operationTime,
        temp_directory: tempDir
      };
      
    } catch (error) {
      throw new Error(`File storage check failed: ${error.message}`);
    }
  }
  
  // Memory usage check
  async checkMemoryUsage() {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);
    
    // Define thresholds
    const warningThreshold = 800; // 800MB
    const criticalThreshold = 1200; // 1.2GB
    
    let status = 'normal';
    if (heapUsedMB > criticalThreshold) {
      status = 'critical';
    } else if (heapUsedMB > warningThreshold) {
      status = 'warning';
    }
    
    return {
      heap_used_mb: heapUsedMB,
      heap_total_mb: heapTotalMB,
      rss_mb: rssMB,
      external_mb: Math.round(usage.external / 1024 / 1024),
      status: status,
      uptime_seconds: Math.round(process.uptime())
    };
  }
  
  // Circuit breaker status check
  async checkCircuitBreakers() {
    if (!global.circuitBreakers) {
      return { available: false, reason: 'Circuit breakers not initialized' };
    }
    
    const breakers = global.circuitBreakers.getAllBreakers();
    const breakerStatus = breakers.map(breaker => ({
      name: breaker.name,
      state: breaker.state,
      failure_count: breaker.failureCount,
      success_count: breaker.successCount,
      last_failure: breaker.lastFailureTime
    }));
    
    const openBreakers = breakers.filter(b => b.state === 'OPEN');
    
    return {
      total_breakers: breakers.length,
      open_breakers: openBreakers.length,
      breakers: breakerStatus,
      status: openBreakers.length > 0 ? 'degraded' : 'healthy'
    };
  }
  
  // File cleanup status check
  async checkFileCleanup() {
    if (!global.fileCleanup) {
      return { available: false, reason: 'File cleanup not initialized' };
    }
    
    const stats = global.fileCleanup.getStats();
    
    // Check if cleanup has run recently (within last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const isStale = !stats.lastRun || new Date(stats.lastRun) < twoHoursAgo;
    
    return {
      ...stats,
      status: isStale ? 'stale' : 'active',
      last_run_hours_ago: stats.lastRun ? 
        Math.round((Date.now() - new Date(stats.lastRun).getTime()) / (60 * 60 * 1000)) : null
    };
  }
  
  getCheckStatus(checkId) {
    return this.lastResults.get(checkId) || null;
  }
  
  getAllCheckStatus() {
    const status = {};
    for (const [id, result] of this.lastResults) {
      status[id] = result;
    }
    return status;
  }
}

// Create global health check manager
const healthChecks = new HealthCheckManager();
global.healthChecks = healthChecks;
```

### **2. Enhanced Health Endpoints**
```javascript
// UPDATE: Enhanced health check endpoints
router.get('/health',
  asyncHandler(async (req, res) => {
    try {
      const healthResult = await healthChecks.runAllChecks();
      
      // Set appropriate status code
      let statusCode = 200;
      if (healthResult.status === 'critical') {
        statusCode = 503; // Service Unavailable
      } else if (healthResult.status === 'degraded') {
        statusCode = 200; // OK but with warnings
      }
      
      res.status(statusCode).json({
        success: healthResult.status !== 'critical',
        data: healthResult
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        details: error.message
      });
    }
  })
);

router.get('/health/detailed',
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const healthResult = await healthChecks.runAllChecks();
      
      // Add additional system information
      const systemInfo = {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        pid: process.pid,
        memory: process.memoryUsage(),
        cpu_usage: process.cpuUsage()
      };
      
      res.json({
        success: true,
        data: {
          ...healthResult,
          system: systemInfo
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Detailed health check failed',
        details: error.message
      });
    }
  })
);

router.get('/health/check/:checkId',
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const { checkId } = req.params;
      const result = await healthChecks.runCheck(checkId);
      
      const statusCode = result.status === 'healthy' ? 200 : 503;
      
      res.status(statusCode).json({
        success: result.status === 'healthy',
        data: result
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: `Health check '${req.params.checkId}' not found`
      });
    }
  })
);
```

### **3. Health Check Monitoring**
```javascript
// ADD: Health check monitoring and alerting
const monitorHealthChecks = () => {
  // Run health checks periodically
  setInterval(async () => {
    try {
      const healthResult = await healthChecks.runAllChecks();
      
      // Log health status
      console.log(`🏥 Health check: ${healthResult.status} (${healthResult.summary.healthy}/${healthResult.summary.total} healthy)`);
      
      // Alert on critical failures
      if (healthResult.status === 'critical' && global.alertSystem) {
        const criticalChecks = healthResult.checks.filter(c => c.critical && c.status !== 'healthy');
        
        global.alertSystem.triggerAlert('CRITICAL_HEALTH_CHECK_FAILURE', {
          failed_checks: criticalChecks.map(c => c.name),
          total_failures: criticalChecks.length,
          severity: 'critical'
        });
      }
      
      // Emit metrics
      if (global.metrics) {
        global.metrics.emit('health_check', healthResult);
      }
      
    } catch (error) {
      console.error('❌ Health check monitoring error:', error);
    }
  }, 60000); // Every minute
};

// Start health check monitoring
monitorHealthChecks();
```

### **4. Readiness and Liveness Probes**
```javascript
// ADD: Kubernetes-style readiness and liveness probes
router.get('/health/live',
  (req, res) => {
    // Liveness probe - basic server responsiveness
    res.json({
      status: 'alive',
      timestamp: new Date(),
      uptime: process.uptime()
    });
  }
);

router.get('/health/ready',
  asyncHandler(async (req, res) => {
    try {
      // Readiness probe - check critical dependencies
      const criticalChecks = ['database', 'file_storage'];
      const results = [];
      
      for (const checkId of criticalChecks) {
        const result = await healthChecks.runCheck(checkId);
        results.push(result);
      }
      
      const allHealthy = results.every(r => r.status === 'healthy');
      const statusCode = allHealthy ? 200 : 503;
      
      res.status(statusCode).json({
        status: allHealthy ? 'ready' : 'not_ready',
        checks: results,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(503).json({
        status: 'not_ready',
        error: error.message,
        timestamp: new Date()
      });
    }
  })
);
```

## ⚠️ **Health Check Notes**
- **🚨 IMPORTANT:** Health checks enable proactive monitoring
- **🚨 IMPORTANT:** Dependency verification prevents cascading failures
- **🚨 IMPORTANT:** Performance metrics help identify bottlenecks
- **❌ DON'T SKIP:** This is essential for production monitoring

## 🧪 **Testing After Implementation**
1. **Test health checks:**
   - Verify all checks run successfully
   - Test failure scenarios for each check

2. **Test monitoring:**
   - Verify periodic health check execution
   - Check alert triggering on failures

3. **Test endpoints:**
   - Test all health check endpoints
   - Verify appropriate status codes

## ✅ **Success Criteria**
- [ ] Comprehensive health check system operational
- [ ] All critical dependencies verified
- [ ] Performance metrics included
- [ ] Monitoring and alerting active
- [ ] Readiness and liveness probes working
- [ ] Health check endpoints functional

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 3.8:** Graceful Shutdown

## 📝 **CRITICAL NOTES**
- **ENABLES PROACTIVE MONITORING** - health checks essential for operations
- **PREVENTS DEPENDENCY FAILURES** - early detection critical
- **IMPROVES SYSTEM RELIABILITY** - comprehensive status monitoring
- **TEST THOROUGHLY** - verify all health checks work correctly
