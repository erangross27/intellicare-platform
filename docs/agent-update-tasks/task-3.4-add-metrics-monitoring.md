# Task 3.4: Add Metrics and Monitoring

## 📋 **Task Overview**
**Phase:** 3 (Utilities, Monitoring & Resilience)  
**Time Estimate:** 20 minutes  
**Risk Level:** LOW  
**Priority:** MEDIUM  

Add comprehensive performance metrics and monitoring to track system health, performance, and usage patterns.

## 🎯 **Objective**
Implement monitoring system that:
- Tracks performance metrics for all operations
- Monitors system health and resource usage
- Provides insights into usage patterns
- Enables proactive issue detection

## 🚨 **Monitoring Risk**
**LOW:** Without monitoring, performance issues and system problems go undetected until they cause outages.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add comprehensive metrics and monitoring**

## 🔍 **Current Monitoring Gaps**

### **Gap 1: No Performance Tracking**
```javascript
// CURRENT - NO PERFORMANCE METRICS
router.post('/chat', async (req, res) => {
  const result = await agent.processChatMessage(...);
  // ❌ No timing, no performance tracking
  res.json(result);
});
```

### **Gap 2: No System Health Monitoring**
```javascript
// CURRENT - NO HEALTH CHECKS
// ❌ No memory usage tracking
// ❌ No database connection monitoring
// ❌ No error rate tracking
```

### **Gap 3: No Usage Analytics**
```javascript
// CURRENT - NO USAGE TRACKING
// ❌ No user activity metrics
// ❌ No feature usage statistics
// ❌ No performance bottleneck identification
```

## ✅ **Comprehensive Metrics System**

### **1. Metrics Collection Framework**
```javascript
// ADD at top of file after imports:
const EventEmitter = require('events');

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
```

### **2. Request Monitoring Middleware**
```javascript
// ADD: Request monitoring middleware
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
      console.log(`🐌 Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// Apply to all routes
router.use(requestMonitoring);
```

### **3. AI Operation Monitoring**
```javascript
// ADD: AI operation monitoring wrapper
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

// Wrap AI operations
const monitoredProcessChatMessage = monitorAIOperation(
  agent.processChatMessage.bind(agent), 
  500 // Estimated tokens for chat
);
```

### **4. Database Operation Monitoring**
```javascript
// ADD: Database monitoring wrapper
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

// Wrap database operations
const monitoredDbOperation = monitorDatabaseOperation(dbOperation);
```

### **5. Metrics Endpoints**
```javascript
// ADD: Metrics and health endpoints
router.get('/metrics',
  practiceAuth,
  requireAuth,
  (req, res) => {
    try {
      const metricsData = metrics.getMetrics();
      
      res.json({
        success: true,
        data: metricsData
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve metrics'
      });
    }
  }
);

router.get('/health',
  (req, res) => {
    try {
      const health = metrics.getHealthStatus();
      
      const statusCode = health.status === 'critical' ? 503 : 
                        health.status === 'warning' ? 200 : 200;
      
      res.status(statusCode).json({
        success: true,
        data: health
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Health check failed'
      });
    }
  }
);

router.get('/metrics/performance',
  practiceAuth,
  requireAuth,
  (req, res) => {
    try {
      const metricsData = metrics.getMetrics();
      
      res.json({
        success: true,
        data: {
          performance: metricsData.performance,
          requests: metricsData.requests,
          timestamp: metricsData.timestamp
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve performance metrics'
      });
    }
  }
);

router.get('/metrics/ai',
  practiceAuth,
  requireAuth,
  (req, res) => {
    try {
      const metricsData = metrics.getMetrics();
      
      res.json({
        success: true,
        data: {
          ai: metricsData.ai,
          timestamp: metricsData.timestamp
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve AI metrics'
      });
    }
  }
);
```

### **6. Alert System**
```javascript
// ADD: Alert system for critical metrics
class AlertSystem {
  constructor(metricsCollector) {
    this.metrics = metricsCollector;
    this.alerts = [];
    this.thresholds = {
      errorRate: 10, // 10%
      responseTime: 5000, // 5 seconds
      memoryUsage: 1000, // 1GB
      diskSpace: 90 // 90%
    };
    
    this.setupAlerts();
  }
  
  setupAlerts() {
    // Check metrics every minute
    setInterval(() => {
      this.checkAlerts();
    }, 60000);
    
    // Listen to metrics events
    this.metrics.on('error', (data) => {
      this.handleErrorAlert(data);
    });
    
    this.metrics.on('system_metrics', (data) => {
      this.checkSystemAlerts(data);
    });
  }
  
  checkAlerts() {
    const metricsData = this.metrics.getMetrics();
    
    // Check error rate
    const errorRate = metricsData.requests.total > 0 ? 
      (metricsData.requests.failed / metricsData.requests.total) * 100 : 0;
    
    if (errorRate > this.thresholds.errorRate) {
      this.triggerAlert('HIGH_ERROR_RATE', {
        current: errorRate,
        threshold: this.thresholds.errorRate,
        severity: 'critical'
      });
    }
    
    // Check response time
    if (metricsData.performance.average > this.thresholds.responseTime) {
      this.triggerAlert('SLOW_RESPONSE_TIME', {
        current: metricsData.performance.average,
        threshold: this.thresholds.responseTime,
        severity: 'warning'
      });
    }
  }
  
  checkSystemAlerts(systemMetrics) {
    // Check memory usage
    if (systemMetrics.memory.heapUsed > this.thresholds.memoryUsage) {
      this.triggerAlert('HIGH_MEMORY_USAGE', {
        current: systemMetrics.memory.heapUsed,
        threshold: this.thresholds.memoryUsage,
        severity: 'warning'
      });
    }
  }
  
  handleErrorAlert(data) {
    // Trigger alert for critical errors
    if (data.error.name === 'DatabaseError' || data.error.name === 'SystemError') {
      this.triggerAlert('CRITICAL_ERROR', {
        error: data.error.message,
        type: data.error.name,
        route: data.req?.path,
        severity: 'critical'
      });
    }
  }
  
  triggerAlert(type, data) {
    const alert = {
      id: crypto.randomBytes(8).toString('hex'),
      type: type,
      data: data,
      timestamp: new Date(),
      acknowledged: false
    };
    
    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
    
    console.log(`🚨 ALERT [${data.severity.toUpperCase()}]: ${type}`, data);
    
    // Here you could integrate with external alerting systems
    // like Slack, PagerDuty, email, etc.
    
    return alert;
  }
  
  getAlerts() {
    return this.alerts;
  }
  
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date();
    }
    return alert;
  }
}

// Create alert system
const alertSystem = new AlertSystem(metrics);

// Add alerts endpoint
router.get('/alerts',
  practiceAuth,
  requireAuth,
  (req, res) => {
    res.json({
      success: true,
      data: alertSystem.getAlerts()
    });
  }
);

router.post('/alerts/:alertId/acknowledge',
  practiceAuth,
  requireAuth,
  (req, res) => {
    const alert = alertSystem.acknowledgeAlert(req.params.alertId);
    
    if (alert) {
      res.json({
        success: true,
        data: alert
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
  }
);
```

## ⚠️ **Monitoring Notes**
- **🚨 IMPORTANT:** Metrics help identify performance issues
- **🚨 IMPORTANT:** Health checks enable proactive monitoring
- **🚨 IMPORTANT:** Alerts prevent issues from becoming outages
- **❌ DON'T SKIP:** Monitoring is essential for production systems

## 🧪 **Testing After Implementation**
1. **Test metrics collection:**
   - Make various requests and verify metrics are recorded
   - Check performance tracking accuracy

2. **Test health checks:**
   - Verify health endpoint returns correct status
   - Test alert triggering

3. **Test monitoring endpoints:**
   - Verify all metrics endpoints work
   - Check data accuracy and completeness

## ✅ **Success Criteria**
- [ ] Comprehensive metrics collection working
- [ ] Performance monitoring active
- [ ] Health checks functional
- [ ] Alert system operational
- [ ] Monitoring endpoints accessible
- [ ] System resource tracking working

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 3.5:** Add Circuit Breaker

## 📝 **CRITICAL NOTES**
- **ENABLES PROACTIVE MONITORING** - metrics essential for operations
- **PREVENTS OUTAGES** - alerts help catch issues early
- **IMPROVES PERFORMANCE** - monitoring identifies bottlenecks
- **TEST THOROUGHLY** - verify all metrics are accurate
