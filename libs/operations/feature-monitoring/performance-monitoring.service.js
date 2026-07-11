const os = require('os');
const process = require('process');
const SecureDataAccess = require('../../../backend/services/secureDataAccess');
const serviceAccountManager = require('../../../backend/services/serviceAccountManager');

/**
 * Performance Monitoring Service
 * Comprehensive monitoring for migration validation and system health
 */
class PerformanceMonitoringService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.metrics = new Map();
    this.alerts = [];
    this.baselineMetrics = {};
    this.monitoringInterval = null;
    
    // Performance thresholds
    this.thresholds = {
      responseTime: 2000,
      errorRate: 0.05,
      memoryUsage: 0.80,
      cpuUsage: 0.75,
      diskUsage: 0.85,
      dbQueryTime: 1000,
      serviceFailures: 3
    };

    // Baseline metrics
    this.baselines = {
      buildTime: 15 * 60 * 1000,
      testTime: 20 * 60 * 1000,
      deployTime: 30 * 60 * 1000,
      apiResponseTime: 500,
      memoryUsage: os.totalmem() * 0.3,
      cpuUsage: 0.15
    };

    // SLA targets
    this.slaTargets = {
      uptime: 0.999,
      responseTime: 500,
      errorRate: 0.01,
      availability: 0.9999
    };
  }

  async initialize() {
    if (this.initialized) return;

    try {
      this.serviceToken = await serviceAccountManager.authenticate('performance-monitoring-service');
      await this.establishBaseline();
      this.startMonitoring();
      this.initialized = true;
      console.log('✅ Performance Monitoring Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Performance Monitoring Service:', error);
      throw error;
    }
  }

  async establishBaseline() {
    try {
      const baseline = {
        timestamp: new Date(),
        system: await this.getSystemMetrics(),
        application: await this.getApplicationMetrics(),
        database: await this.getDatabaseMetrics()
      };

      this.baselineMetrics = baseline;
      
      const context = {
        serviceId: 'performance-monitoring-service',
        operation: 'store-baseline',
        practiceId: 'global'
      };

      await SecureDataAccess.create('performance_baselines', baseline, context);
      console.log('📊 Performance baseline established');
    } catch (error) {
      console.error('❌ Failed to establish baseline:', error);
    }
  }

  startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.checkAlerts();
      } catch (error) {
        console.error('❌ Monitoring cycle error:', error);
      }
    }, 30000);

    console.log('🔍 Continuous monitoring started (30s intervals)');
  }

  async collectMetrics() {
    const timestamp = new Date();
    const metrics = {
      timestamp,
      system: await this.getSystemMetrics(),
      application: await this.getApplicationMetrics(),
      database: await this.getDatabaseMetrics()
    };

    this.metrics.set(timestamp.getTime(), metrics);

    if (this.metrics.size > 1000) {
      const oldest = Math.min(...this.metrics.keys());
      this.metrics.delete(oldest);
    }

    if (Math.floor(timestamp.getTime() / 1000) % 300 === 0) {
      await this.persistMetrics(metrics);
    }

    return metrics;
  }

  async getSystemMetrics() {
    const loadAverage = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      cpu: {
        loadAverage: loadAverage,
        usage: process.cpuUsage(),
        count: os.cpus().length
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        percentage: usedMem / totalMem,
        heap: process.memoryUsage()
      },
      uptime: {
        system: os.uptime(),
        process: process.uptime()
      }
    };
  }

  async getApplicationMetrics() {
    return {
      nodejs: {
        version: process.version,
        pid: process.pid,
        activeHandles: process._getActiveHandles().length,
        activeRequests: process._getActiveRequests().length
      },
      eventLoop: {
        delay: await this.measureEventLoopDelay(),
        lag: await this.measureEventLoopLag()
      }
    };
  }

  async getDatabaseMetrics() {
    try {
      const context = {
        serviceId: 'performance-monitoring-service',
        operation: 'get-db-metrics',
        practiceId: 'global'
      };

      const startTime = Date.now();
      const testQuery = await SecureDataAccess.query('audit_logs', {}, { limit: 1 }, context);
      const queryTime = Date.now() - startTime;

      return {
        connectivity: true,
        queryTime,
        status: 'healthy'
      };
    } catch (error) {
      return {
        connectivity: false,
        queryTime: null,
        status: 'error',
        error: error.message
      };
    }
  }

  async measureEventLoopDelay() {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000;
        resolve(delay);
      });
    });
  }

  async measureEventLoopLag() {
    return new Promise((resolve) => {
      const start = Date.now();
      setTimeout(() => {
        const lag = Date.now() - start - 1;
        resolve(Math.max(0, lag));
      }, 1);
    });
  }

  async checkAlerts() {
    const latestMetrics = Array.from(this.metrics.values()).pop();
    if (!latestMetrics) return;

    const alerts = [];

    if (latestMetrics.database.queryTime > this.thresholds.dbQueryTime) {
      alerts.push({
        type: 'DATABASE_SLOW',
        severity: 'WARNING',
        message: `Database query time ${latestMetrics.database.queryTime}ms exceeds threshold ${this.thresholds.dbQueryTime}ms`,
        value: latestMetrics.database.queryTime,
        threshold: this.thresholds.dbQueryTime,
        timestamp: new Date()
      });
    }

    if (latestMetrics.system.memory.percentage > this.thresholds.memoryUsage) {
      alerts.push({
        type: 'HIGH_MEMORY_USAGE',
        severity: 'CRITICAL',
        message: `Memory usage ${(latestMetrics.system.memory.percentage * 100).toFixed(1)}% exceeds threshold ${(this.thresholds.memoryUsage * 100).toFixed(1)}%`,
        value: latestMetrics.system.memory.percentage,
        threshold: this.thresholds.memoryUsage,
        timestamp: new Date()
      });
    }

    for (const alert of alerts) {
      this.alerts.push(alert);
      await this.persistAlert(alert);
      console.warn(`🚨 PERFORMANCE ALERT: ${alert.message}`);
    }

    const oneDayAgo = Date.now() - 86400000;
    this.alerts = this.alerts.filter(alert => alert.timestamp.getTime() > oneDayAgo);
  }

  async persistMetrics(metrics) {
    try {
      const context = {
        serviceId: 'performance-monitoring-service',
        operation: 'persist-metrics',
        practiceId: 'global'
      };

      await SecureDataAccess.create('performance_metrics', metrics, context);
    } catch (error) {
      console.error('❌ Failed to persist metrics:', error);
    }
  }

  async persistAlert(alert) {
    try {
      const context = {
        serviceId: 'performance-monitoring-service',
        operation: 'persist-alert',
        practiceId: 'global'
      };

      await SecureDataAccess.create('performance_alerts', alert, context);
    } catch (error) {
      console.error('❌ Failed to persist alert:', error);
    }
  }

  async getHealthCheck() {
    const latestMetrics = Array.from(this.metrics.values()).pop();
    
    return {
      service: 'PerformanceMonitoringService',
      status: this.initialized ? 'healthy' : 'initializing',
      initialized: this.initialized,
      metricsCollected: this.metrics.size,
      activeAlerts: this.alerts.filter(a => a.severity === 'CRITICAL').length,
      lastCollection: latestMetrics?.timestamp || null,
      uptime: process.uptime(),
      version: '1.0.0',
      checks: {
        database: latestMetrics?.database.connectivity || false,
        memory: latestMetrics?.system.memory.percentage < this.thresholds.memoryUsage,
        eventLoop: latestMetrics?.application.eventLoop.lag < 100
      }
    };
  }

  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('🛑 Performance monitoring stopped');
    }
  }
}

module.exports = new PerformanceMonitoringService();