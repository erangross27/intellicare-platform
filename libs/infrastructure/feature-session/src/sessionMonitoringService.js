/**
 * Session Monitoring Service
 * Monitors session health, migration progress, and provides analytics for zero-downtime migration
 */

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class SessionMonitoringService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.monitoringInterval = null;
    this.alertThresholds = {
      maxFailureRate: 5, // 5% max failure rate
      maxResponseTime: 1000, // 1 second max response
      minSuccessRate: 95, // 95% min success rate
      maxActiveSessionDrift: 100 // Max difference between stores
    };
    this.metrics = {
      sessionOperations: new Map(),
      migrationProgress: new Map(),
      healthChecks: [],
      alerts: []
    };
    this.migrationStats = {
      totalSessions: 0,
      migratedSessions: 0,
      failedMigrations: 0,
      migrationStartTime: null,
      lastMigrationBatch: null
    };
  }

  async initialize() {
    if (!this.initialized) {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('session-monitoring-service');
      await this.startMonitoring();
      this.initialized = true;
      console.log('✅ SessionMonitoringService initialized with ServiceProxy');
    }
  }

  /**
   * Get service context for database operations
   */
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'session-monitoring-service',
      operation: 'database-access',
      practiceId: practiceId
    };
  }

  async startMonitoring() {
    // Monitor every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
      await this.updateMigrationMetrics();
      await this.checkAlerts();
    }, 30000);

    console.log('👁️ Session monitoring started (30-second intervals)');
  }

  async performHealthChecks() {
    const healthCheck = {
      timestamp: new Date(),
      sessionBridge: null,
      mongodb: null,
      redis: null,
      overall: 'healthy'
    };

    try {
      // Check session bridge health
      const proxy = getServiceProxy();
      const sessionBridge = proxy.getService('sessionBridge');
      const bridgeHealth = await sessionBridge.getHealthStatus();
      healthCheck.sessionBridge = {
        healthy: bridgeHealth.bridge.initialized,
        phase: bridgeHealth.bridge.phase,
        readPreference: bridgeHealth.bridge.readPreference,
        mongodb: bridgeHealth.mongodb,
        redis: bridgeHealth.redis
      };

      // Detailed MongoDB health
      try {
        const secureSessionManager = proxy.getService('secureSessionManager');
        const mongoStats = await secureSessionManager.getSessionStats();
        healthCheck.mongodb = {
          healthy: true,
          activeSessions: mongoStats?.activeSessions || 0,
          recentActivity: mongoStats?.recentActivity || 0,
          responseTime: await this.measureMongoResponseTime()
        };
      } catch (mongoError) {
        healthCheck.mongodb = {
          healthy: false,
          error: mongoError.message,
          activeSessions: 0
        };
        healthCheck.overall = 'degraded';
      }

      // Detailed Redis health
      if (bridgeHealth.bridge.phase !== 'mongo-only') {
        try {
          const redisSessionStore = proxy.getService('redisSessionStore');
          const redisHealth = await redisSessionStore.healthCheck();
          const redisSessionCount = await redisSessionStore.getActiveSessionsCount();
          
          healthCheck.redis = {
            healthy: redisHealth.healthy,
            activeSessions: redisSessionCount,
            responseTime: await this.measureRedisResponseTime(),
            message: redisHealth.message
          };

          if (!redisHealth.healthy) {
            healthCheck.overall = 'degraded';
          }
        } catch (redisError) {
          healthCheck.redis = {
            healthy: false,
            error: redisError.message,
            activeSessions: 0
          };
          healthCheck.overall = 'degraded';
        }
      }

      // Check for session drift between stores
      if (healthCheck.mongodb?.activeSessions && healthCheck.redis?.activeSessions) {
        const drift = Math.abs(healthCheck.mongodb.activeSessions - healthCheck.redis.activeSessions);
        if (drift > this.alertThresholds.maxActiveSessionDrift) {
          healthCheck.overall = 'warning';
          healthCheck.sessionDrift = drift;
        }
      }

      // Store health check
      this.metrics.healthChecks.push(healthCheck);
      
      // Keep only last 100 health checks
      if (this.metrics.healthChecks.length > 100) {
        this.metrics.healthChecks.shift();
      }

      return healthCheck;

    } catch (error) {
      console.error('❌ Session health check error:', error);
      healthCheck.overall = 'unhealthy';
      healthCheck.error = error.message;
      return healthCheck;
    }
  }

  async measureMongoResponseTime() {
    const startTime = Date.now();
    try {
      // Test MongoDB response time with a dummy validation
      const proxy = getServiceProxy();
      const secureSessionManager = proxy.getService('secureSessionManager');
      await secureSessionManager.validateSession('dummy-token-for-timing-test');
      return Date.now() - startTime;
    } catch (error) {
      return Date.now() - startTime; // Still return timing even if validation fails
    }
  }

  async measureRedisResponseTime() {
    const startTime = Date.now();
    try {
      // Test Redis response time
      const proxy = getServiceProxy();
      const redisSessionStore = proxy.getService('redisSessionStore');
      await redisSessionStore.getSession('dummy-token-for-timing-test');
      return Date.now() - startTime;
    } catch (error) {
      return Date.now() - startTime;
    }
  }

  async updateMigrationMetrics() {
    try {
      const proxy = getServiceProxy();
      const sessionBridge = proxy.getService('sessionBridge');
      const bridgeHealth = await sessionBridge.getHealthStatus();
      const currentPhase = bridgeHealth.bridge.phase;

      // Update migration progress based on current phase
      const migrationMetrics = {
        timestamp: new Date(),
        phase: currentPhase,
        mongoSessions: bridgeHealth.mongodb.activeSessions || 0,
        redisSessions: bridgeHealth.redis.activeSessions || 0,
        totalSessions: Math.max(
          bridgeHealth.mongodb.activeSessions || 0,
          bridgeHealth.redis.activeSessions || 0
        )
      };

      // Calculate migration percentage based on phase
      switch (currentPhase) {
        case 'mongo-only':
          migrationMetrics.migrationPercentage = 0;
          break;
        case 'dual-write':
          migrationMetrics.migrationPercentage = 25;
          break;
        case 'redis-primary':
          migrationMetrics.migrationPercentage = 75;
          break;
        case 'redis-only':
          migrationMetrics.migrationPercentage = 100;
          break;
      }

      // Store migration metrics
      this.metrics.migrationProgress.set(Date.now(), migrationMetrics);

      // Keep only last 1000 metrics
      if (this.metrics.migrationProgress.size > 1000) {
        const oldestKey = this.metrics.migrationProgress.keys().next().value;
        this.metrics.migrationProgress.delete(oldestKey);
      }

      return migrationMetrics;

    } catch (error) {
      console.error('❌ Migration metrics update error:', error);
      return null;
    }
  }

  async checkAlerts() {
    const latestHealthCheck = this.metrics.healthChecks[this.metrics.healthChecks.length - 1];
    if (!latestHealthCheck) return;

    const alerts = [];

    // Check overall system health
    if (latestHealthCheck.overall === 'unhealthy') {
      alerts.push({
        type: 'critical',
        message: 'Session system is unhealthy',
        details: latestHealthCheck.error,
        timestamp: new Date()
      });
    }

    // Check MongoDB response time
    if (latestHealthCheck.mongodb?.responseTime > this.alertThresholds.maxResponseTime) {
      alerts.push({
        type: 'warning',
        message: `MongoDB response time too high: ${latestHealthCheck.mongodb.responseTime}ms`,
        threshold: this.alertThresholds.maxResponseTime,
        timestamp: new Date()
      });
    }

    // Check Redis response time
    if (latestHealthCheck.redis?.responseTime > this.alertThresholds.maxResponseTime) {
      alerts.push({
        type: 'warning',
        message: `Redis response time too high: ${latestHealthCheck.redis.responseTime}ms`,
        threshold: this.alertThresholds.maxResponseTime,
        timestamp: new Date()
      });
    }

    // Check session drift
    if (latestHealthCheck.sessionDrift > this.alertThresholds.maxActiveSessionDrift) {
      alerts.push({
        type: 'warning',
        message: `Session count drift between stores: ${latestHealthCheck.sessionDrift}`,
        threshold: this.alertThresholds.maxActiveSessionDrift,
        timestamp: new Date()
      });
    }

    // Check Redis health during migration phases
    const bridgePhase = latestHealthCheck.sessionBridge?.phase;
    if (bridgePhase !== 'mongo-only' && !latestHealthCheck.redis?.healthy) {
      alerts.push({
        type: 'critical',
        message: `Redis unhealthy during migration phase: ${bridgePhase}`,
        details: latestHealthCheck.redis?.error,
        timestamp: new Date()
      });
    }

    // Store alerts
    for (const alert of alerts) {
      this.metrics.alerts.push(alert);
      console.log(`🚨 Session Alert [${alert.type.toUpperCase()}]: ${alert.message}`);
    }

    // Keep only last 500 alerts
    if (this.metrics.alerts.length > 500) {
      this.metrics.alerts = this.metrics.alerts.slice(-500);
    }

    return alerts;
  }

  async recordSessionOperation(operation, success, responseTime, details = {}) {
    const timestamp = Date.now();
    const operationRecord = {
      operation,
      success,
      responseTime,
      details,
      timestamp: new Date(timestamp)
    };

    // Store operation metrics
    if (!this.metrics.sessionOperations.has(operation)) {
      this.metrics.sessionOperations.set(operation, []);
    }

    const operations = this.metrics.sessionOperations.get(operation);
    operations.push(operationRecord);

    // Keep only last 1000 operations per type
    if (operations.length > 1000) {
      operations.shift();
    }

    return operationRecord;
  }

  async getSessionMetrics(timeRangeMinutes = 60) {
    const cutoffTime = new Date(Date.now() - (timeRangeMinutes * 60 * 1000));
    
    const metrics = {
      timeRange: `${timeRangeMinutes} minutes`,
      generatedAt: new Date(),
      healthStatus: this.getLatestHealthStatus(),
      migrationStatus: this.getMigrationStatus(),
      operationStats: this.getOperationStats(cutoffTime),
      alerts: this.getRecentAlerts(cutoffTime)
    };

    return metrics;
  }

  getLatestHealthStatus() {
    const latestHealth = this.metrics.healthChecks[this.metrics.healthChecks.length - 1];
    if (!latestHealth) return null;

    return {
      overall: latestHealth.overall,
      timestamp: latestHealth.timestamp,
      mongodb: latestHealth.mongodb,
      redis: latestHealth.redis,
      sessionDrift: latestHealth.sessionDrift
    };
  }

  getMigrationStatus() {
    const latestMetrics = Array.from(this.metrics.migrationProgress.values()).pop();
    if (!latestMetrics) return null;

    return {
      phase: latestMetrics.phase,
      migrationPercentage: latestMetrics.migrationPercentage,
      mongoSessions: latestMetrics.mongoSessions,
      redisSessions: latestMetrics.redisSessions,
      totalSessions: latestMetrics.totalSessions,
      timestamp: latestMetrics.timestamp
    };
  }

  getOperationStats(cutoffTime) {
    const stats = {};

    for (const [operation, operations] of this.metrics.sessionOperations) {
      const recentOperations = operations.filter(op => op.timestamp > cutoffTime);
      
      if (recentOperations.length > 0) {
        const successCount = recentOperations.filter(op => op.success).length;
        const totalResponseTime = recentOperations.reduce((sum, op) => sum + op.responseTime, 0);

        stats[operation] = {
          totalOperations: recentOperations.length,
          successCount,
          failureCount: recentOperations.length - successCount,
          successRate: (successCount / recentOperations.length * 100).toFixed(2),
          averageResponseTime: Math.round(totalResponseTime / recentOperations.length),
          maxResponseTime: Math.max(...recentOperations.map(op => op.responseTime)),
          minResponseTime: Math.min(...recentOperations.map(op => op.responseTime))
        };
      }
    }

    return stats;
  }

  getRecentAlerts(cutoffTime) {
    return this.metrics.alerts.filter(alert => alert.timestamp > cutoffTime);
  }

  async startMigrationTracking() {
    this.migrationStats.migrationStartTime = new Date();
    this.migrationStats.totalSessions = 0;
    this.migrationStats.migratedSessions = 0;
    this.migrationStats.failedMigrations = 0;

    console.log('📊 Migration tracking started');
  }

  async recordMigrationBatch(batchSize, migratedCount, failedCount) {
    this.migrationStats.totalSessions += batchSize;
    this.migrationStats.migratedSessions += migratedCount;
    this.migrationStats.failedMigrations += failedCount;
    this.migrationStats.lastMigrationBatch = {
      timestamp: new Date(),
      batchSize,
      migratedCount,
      failedCount,
      successRate: ((migratedCount / batchSize) * 100).toFixed(2)
    };

    console.log(`📊 Migration batch completed: ${migratedCount}/${batchSize} sessions migrated`);
  }

  async getMigrationReport() {
    if (!this.migrationStats.migrationStartTime) {
      return { error: 'Migration tracking not started' };
    }

    const currentTime = new Date();
    const migrationDuration = currentTime - this.migrationStats.migrationStartTime;

    return {
      startTime: this.migrationStats.migrationStartTime,
      currentTime,
      duration: {
        milliseconds: migrationDuration,
        seconds: Math.round(migrationDuration / 1000),
        minutes: Math.round(migrationDuration / 60000)
      },
      totals: {
        totalSessions: this.migrationStats.totalSessions,
        migratedSessions: this.migrationStats.migratedSessions,
        failedMigrations: this.migrationStats.failedMigrations,
        successRate: this.migrationStats.totalSessions > 0 ? 
          ((this.migrationStats.migratedSessions / this.migrationStats.totalSessions) * 100).toFixed(2) : 0
      },
      performance: {
        sessionsPerSecond: migrationDuration > 0 ? 
          ((this.migrationStats.migratedSessions / (migrationDuration / 1000)).toFixed(2)) : 0,
        lastBatch: this.migrationStats.lastMigrationBatch
      }
    };
  }

  async validateSessionConsistency(sessionToken) {
    try {
      const proxy = getServiceProxy();
      const secureSessionManager = proxy.getService('secureSessionManager');
      const redisSessionStore = proxy.getService('redisSessionStore');
      const mongoSession = await secureSessionManager.validateSession(sessionToken);
      const redisSession = await redisSessionStore.getSession(sessionToken);

      const consistency = {
        sessionToken,
        timestamp: new Date(),
        existsInMongo: !!mongoSession,
        existsInRedis: !!redisSession,
        consistent: true,
        differences: []
      };

      if (mongoSession && redisSession) {
        // Check for data consistency
        const mongoData = {
          userId: mongoSession.userId,
          practiceId: mongoSession.practiceId,
          userRole: mongoSession.userRole
        };

        const redisData = {
          userId: redisSession.userId,
          practiceId: redisSession.practiceId,
          userRole: redisSession.userRole
        };

        for (const [key, value] of Object.entries(mongoData)) {
          if (redisData[key] !== value) {
            consistency.consistent = false;
            consistency.differences.push({
              field: key,
              mongoValue: value,
              redisValue: redisData[key]
            });
          }
        }
      } else if (mongoSession && !redisSession) {
        consistency.consistent = false;
        consistency.differences.push('Session exists in MongoDB but not in Redis');
      } else if (!mongoSession && redisSession) {
        consistency.consistent = false;
        consistency.differences.push('Session exists in Redis but not in MongoDB');
      }

      return consistency;

    } catch (error) {
      return {
        sessionToken,
        timestamp: new Date(),
        error: error.message,
        consistent: false
      };
    }
  }

  async generateHealthReport() {
    const report = {
      generatedAt: new Date(),
      summary: await this.getSessionMetrics(60),
      recentAlerts: this.getRecentAlerts(new Date(Date.now() - 24 * 60 * 60 * 1000)), // Last 24 hours
      migrationReport: await this.getMigrationReport(),
      systemRecommendations: []
    };

    // Add recommendations based on current health
    const latestHealth = this.getLatestHealthStatus();
    
    if (latestHealth?.mongodb?.responseTime > 500) {
      report.systemRecommendations.push({
        type: 'performance',
        message: 'MongoDB response times are elevated. Consider optimizing database queries.',
        priority: 'medium'
      });
    }

    if (latestHealth?.redis?.responseTime > 200) {
      report.systemRecommendations.push({
        type: 'performance',
        message: 'Redis response times are elevated. Check Redis server resources.',
        priority: 'medium'
      });
    }

    if (latestHealth?.sessionDrift > 50) {
      report.systemRecommendations.push({
        type: 'consistency',
        message: 'Session count drift detected between stores. Review migration process.',
        priority: 'high'
      });
    }

    return report;
  }

  async stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('👁️ Session Monitoring Service stopped');
  }
}

// Export singleton instance
const sessionMonitoringServiceInstance = new SessionMonitoringService();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('sessionMonitoringService', () => sessionMonitoringServiceInstance);
}

module.exports = sessionMonitoringServiceInstance;