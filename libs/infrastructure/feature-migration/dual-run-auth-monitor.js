/**
 * Dual-Run Authentication Monitor
 * Monitors and manages dual authentication system during zero-downtime migration
 */

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class DualRunAuthMonitor {
  constructor() {
    this.serviceId = 'dual-run-auth-monitor-service';
    this.serviceToken = null;
    this.initialized = false;
    this.monitoringInterval = null;
    
    // Migration schedule configuration
    this.migrationSchedule = [
      { phase: 'old-system', trafficSplit: 0, duration: 0 },
      { phase: 'traffic-split', trafficSplit: 10, duration: 6 * 60 * 60 * 1000 }, // 6 hours
      { phase: 'traffic-split', trafficSplit: 25, duration: 6 * 60 * 60 * 1000 }, // 6 hours
      { phase: 'traffic-split', trafficSplit: 50, duration: 12 * 60 * 60 * 1000 }, // 12 hours
      { phase: 'new-primary', trafficSplit: 75, duration: 24 * 60 * 60 * 1000 }, // 24 hours
      { phase: 'new-system', trafficSplit: 100, duration: 0 } // Final phase
    ];
    
    this.currentScheduleIndex = 0;
    this.migrationStartTime = null;
    this.autoMigrationEnabled = false;
    
    // Health monitoring thresholds
    this.healthThresholds = {
      maxErrorRate: 0.02, // 2% max error rate (stricter than bridge default)
      maxResponseTime: 1500, // 1.5 seconds max response time
      minSuccessRate: 0.97, // 97% min success rate
      maxFallbackRate: 0.05, // 5% max fallback rate
      continuousFailureLimit: 5, // Max consecutive failures before rollback
      healthCheckInterval: 30000 // 30 seconds
    };
    
    this.metrics = {
      migrationEvents: [],
      healthSnapshots: [],
      rollbackEvents: [],
      performanceMetrics: new Map(),
      alerts: []
    };
    
    this.continuousFailures = 0;
    this.lastHealthCheck = null;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Authenticate service account through proxy
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Initialize dependencies through proxy
      const authenticationBridge = proxy.getService('authenticationBridge');
      const sessionMonitoringService = proxy.getService('sessionMonitoringService');
      await authenticationBridge.initialize();
      await sessionMonitoringService.initialize();
      
      // Start monitoring
      await this.startMonitoring();
      
      this.initialized = true;
      console.log('✅ Dual-Run Authentication Monitor initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Dual-Run Auth Monitor:', error);
      throw error;
    }
  }

  async startMonitoring() {
    // Monitor every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthCheck();
      await this.checkMigrationSchedule();
      await this.updateMetrics();
    }, this.healthThresholds.healthCheckInterval);

    console.log('👁️ Dual-run authentication monitoring started (30-second intervals)');
  }

  async performHealthCheck() {
    try {
      const timestamp = new Date();
      
      // Get authentication bridge health through proxy
      const proxy = getServiceProxy();
      const authenticationBridge = proxy.getService('authenticationBridge');
      const sessionMonitoringService = proxy.getService('sessionMonitoringService');
      const authHealth = authenticationBridge.getHealthStatus();
      
      // Get session monitoring health
      const sessionHealth = await sessionMonitoringService.getLatestHealthStatus();
      
      // Calculate overall health metrics
      const healthSnapshot = {
        timestamp,
        authenticationBridge: authHealth,
        sessionHealth,
        overallHealth: this.calculateOverallHealth(authHealth, sessionHealth)
      };
      
      // Store health snapshot
      this.metrics.healthSnapshots.push(healthSnapshot);
      
      // Keep only last 200 snapshots
      if (this.metrics.healthSnapshots.length > 200) {
        this.metrics.healthSnapshots.shift();
      }
      
      // Check for health issues
      await this.checkHealthAlerts(healthSnapshot);
      
      this.lastHealthCheck = healthSnapshot;
      
      return healthSnapshot;
      
    } catch (error) {
      console.error('❌ Dual-run auth health check error:', error);
      this.continuousFailures++;
      
      if (this.continuousFailures >= this.healthThresholds.continuousFailureLimit) {
        await this.triggerEmergencyRollback('continuous-health-check-failures');
      }
    }
  }

  calculateOverallHealth(authHealth, sessionHealth) {
    const overall = {
      status: 'healthy',
      issues: [],
      recommendations: []
    };
    
    // Check authentication system health
    if (authHealth.metrics.newSystem.errorRate > this.healthThresholds.maxErrorRate) {
      overall.status = 'degraded';
      overall.issues.push(`New auth system error rate: ${(authHealth.metrics.newSystem.errorRate * 100).toFixed(2)}%`);
    }
    
    if (authHealth.metrics.newSystem.avgResponseTime > this.healthThresholds.maxResponseTime) {
      overall.status = 'degraded';
      overall.issues.push(`New auth system response time: ${authHealth.metrics.newSystem.avgResponseTime}ms`);
    }
    
    if (authHealth.metrics.overall.fallbackRate > this.healthThresholds.maxFallbackRate) {
      overall.status = 'warning';
      overall.issues.push(`High fallback rate: ${(authHealth.metrics.overall.fallbackRate * 100).toFixed(2)}%`);
    }
    
    // Check session system health
    if (sessionHealth && sessionHealth.overall !== 'healthy') {
      overall.status = sessionHealth.overall === 'unhealthy' ? 'degraded' : 'warning';
      overall.issues.push(`Session system: ${sessionHealth.overall}`);
    }
    
    // Generate recommendations
    if (overall.status === 'healthy' && authHealth.bridge.trafficSplit < 100) {
      if (authHealth.metrics.newSystem.successRate > 0.99 && 
          authHealth.metrics.newSystem.avgResponseTime < 1000) {
        overall.recommendations.push('CONSIDER_INCREASING_TRAFFIC');
      }
    }
    
    if (overall.issues.length === 0) {
      overall.status = 'healthy';
    } else if (overall.issues.some(issue => issue.includes('error rate') || issue.includes('unhealthy'))) {
      overall.status = 'degraded';
    }
    
    return overall;
  }

  async checkHealthAlerts(healthSnapshot) {
    const { overallHealth, authenticationBridge } = healthSnapshot;
    
    // Reset continuous failures if health is good
    if (overallHealth.status === 'healthy') {
      this.continuousFailures = 0;
    } else {
      this.continuousFailures++;
    }
    
    // Check for critical issues requiring rollback
    const criticalIssues = overallHealth.issues.filter(issue => 
      issue.includes('error rate') || issue.includes('response time') || issue.includes('unhealthy')
    );
    
    if (criticalIssues.length > 0) {
      const alert = {
        type: 'critical',
        timestamp: new Date(),
        issues: criticalIssues,
        phase: authenticationBridge.bridge.phase,
        trafficSplit: authenticationBridge.bridge.trafficSplit,
        action: 'monitoring'
      };
      
      this.metrics.alerts.push(alert);
      console.log('🚨 Dual-run Auth Alert [CRITICAL]:', criticalIssues.join(', '));
      
      // Trigger rollback if continuous failures
      if (this.continuousFailures >= this.healthThresholds.continuousFailureLimit) {
        await this.triggerRollback('health-degradation', criticalIssues);
      }
    }
    
    // Check for warnings
    if (overallHealth.status === 'warning') {
      const alert = {
        type: 'warning',
        timestamp: new Date(),
        issues: overallHealth.issues,
        phase: authenticationBridge.bridge.phase,
        trafficSplit: authenticationBridge.bridge.trafficSplit
      };
      
      this.metrics.alerts.push(alert);
      console.log('⚠️ Dual-run Auth Alert [WARNING]:', overallHealth.issues.join(', '));
    }
    
    // Keep only last 500 alerts
    if (this.metrics.alerts.length > 500) {
      this.metrics.alerts = this.metrics.alerts.slice(-500);
    }
  }

  async checkMigrationSchedule() {
    if (!this.autoMigrationEnabled || !this.migrationStartTime) {
      return;
    }
    
    const currentTime = Date.now();
    const elapsedTime = currentTime - this.migrationStartTime;
    
    // Calculate which phase we should be in based on schedule
    let targetScheduleIndex = 0;
    let cumulativeTime = 0;
    
    for (let i = 0; i < this.migrationSchedule.length; i++) {
      if (elapsedTime >= cumulativeTime && 
          (i === this.migrationSchedule.length - 1 || elapsedTime < cumulativeTime + this.migrationSchedule[i].duration)) {
        targetScheduleIndex = i;
        break;
      }
      cumulativeTime += this.migrationSchedule[i].duration;
    }
    
    // If we need to advance to next phase
    if (targetScheduleIndex > this.currentScheduleIndex) {
      const targetPhase = this.migrationSchedule[targetScheduleIndex];
      
      // Check if system is healthy enough to advance
      if (this.lastHealthCheck && this.lastHealthCheck.overallHealth.status === 'healthy') {
        await this.advanceToPhase(targetPhase.phase, targetPhase.trafficSplit);
        this.currentScheduleIndex = targetScheduleIndex;
      } else {
        console.log(`⏸️ Delaying migration advance due to health issues: ${this.lastHealthCheck?.overallHealth.status}`);
      }
    }
  }

  async advanceToPhase(phase, trafficSplit) {
    try {
      console.log(`🚀 Advancing to phase: ${phase} (Traffic: ${trafficSplit}%)`);
      
      const proxy = getServiceProxy();
      const authenticationBridge = proxy.getService('authenticationBridge');
      const success = authenticationBridge.setMigrationPhase(phase);
      if (success) {
        authenticationBridge.setTrafficSplit(trafficSplit);
        
        const event = {
          timestamp: new Date(),
          action: 'phase_advance',
          fromPhase: this.migrationSchedule[this.currentScheduleIndex]?.phase || 'unknown',
          toPhase: phase,
          trafficSplit: trafficSplit,
          triggeredBy: 'auto-schedule',
          healthStatus: this.lastHealthCheck?.overallHealth.status || 'unknown'
        };
        
        this.metrics.migrationEvents.push(event);
        console.log(`✅ Successfully advanced to ${phase} with ${trafficSplit}% traffic split`);
      } else {
        console.error(`❌ Failed to advance to phase: ${phase}`);
      }
      
    } catch (error) {
      console.error('❌ Error advancing migration phase:', error);
    }
  }

  async triggerRollback(reason, details = []) {
    try {
      console.log(`🔄 TRIGGERING ROLLBACK: ${reason}`);
      
      const proxy = getServiceProxy();
      const authenticationBridge = proxy.getService('authenticationBridge');
      const rollbackResult = authenticationBridge.triggerRollback(reason);
      
      const rollbackEvent = {
        timestamp: new Date(),
        reason,
        details,
        previousPhase: rollbackResult.previousPhase,
        currentPhase: rollbackResult.currentPhase,
        trafficSplit: rollbackResult.trafficSplit,
        healthStatus: this.lastHealthCheck?.overallHealth.status || 'unknown',
        continuousFailures: this.continuousFailures
      };
      
      this.metrics.rollbackEvents.push(rollbackEvent);
      
      // Update current schedule index to match rollback
      const rollbackPhase = rollbackResult.currentPhase;
      const matchingSchedule = this.migrationSchedule.findIndex(s => s.phase === rollbackPhase);
      if (matchingSchedule !== -1) {
        this.currentScheduleIndex = matchingSchedule;
      }
      
      // Reset continuous failures after rollback
      this.continuousFailures = 0;
      
      console.log(`✅ Rollback completed: ${rollbackResult.previousPhase} → ${rollbackResult.currentPhase}`);
      
      return rollbackEvent;
      
    } catch (error) {
      console.error('❌ Error during rollback:', error);
      throw error;
    }
  }

  async triggerEmergencyRollback(reason) {
    console.log(`🚨 EMERGENCY ROLLBACK TRIGGERED: ${reason}`);
    
    // Force to old-system immediately
    authenticationBridge.setMigrationPhase('old-system');
    authenticationBridge.setTrafficSplit(0);
    
    const emergencyEvent = {
      timestamp: new Date(),
      type: 'emergency_rollback',
      reason,
      action: 'forced_to_old_system',
      continuousFailures: this.continuousFailures,
      healthStatus: this.lastHealthCheck?.overallHealth.status || 'unknown'
    };
    
    this.metrics.rollbackEvents.push(emergencyEvent);
    this.currentScheduleIndex = 0; // Reset to first phase
    
    // Disable auto-migration after emergency rollback
    this.autoMigrationEnabled = false;
    
    console.log('🚨 EMERGENCY ROLLBACK COMPLETED - Auto-migration disabled');
  }

  async updateMetrics() {
    try {
      const timestamp = Date.now();
      
      // Get current performance metrics
      const authHealth = authenticationBridge.getHealthStatus();
      
      const performanceSnapshot = {
        timestamp: new Date(),
        oldSystem: {
          requests: authHealth.metrics.oldSystem.requests,
          successRate: authHealth.metrics.oldSystem.successRate,
          avgResponseTime: authHealth.metrics.oldSystem.avgResponseTime,
          errorRate: authHealth.metrics.oldSystem.errorRate
        },
        newSystem: {
          requests: authHealth.metrics.newSystem.requests,
          successRate: authHealth.metrics.newSystem.successRate,
          avgResponseTime: authHealth.metrics.newSystem.avgResponseTime,
          errorRate: authHealth.metrics.newSystem.errorRate
        },
        overall: {
          totalRequests: authHealth.metrics.overall.totalRequests,
          fallbackRate: authHealth.metrics.overall.fallbackRate,
          overallSuccessRate: authHealth.metrics.overall.overallSuccessRate
        },
        bridge: {
          phase: authHealth.bridge.phase,
          trafficSplit: authHealth.bridge.trafficSplit
        }
      };
      
      this.metrics.performanceMetrics.set(timestamp, performanceSnapshot);
      
      // Keep only last 1000 metrics (about 8 hours at 30-second intervals)
      if (this.metrics.performanceMetrics.size > 1000) {
        const oldestKey = this.metrics.performanceMetrics.keys().next().value;
        this.metrics.performanceMetrics.delete(oldestKey);
      }
      
    } catch (error) {
      console.error('❌ Error updating dual-run auth metrics:', error);
    }
  }

  // Manual control methods
  startAutoMigration() {
    this.autoMigrationEnabled = true;
    this.migrationStartTime = Date.now();
    this.currentScheduleIndex = 0;
    
    console.log('🚀 Auto-migration started with schedule:', this.migrationSchedule);
    
    return {
      success: true,
      startTime: new Date(this.migrationStartTime),
      schedule: this.migrationSchedule,
      message: 'Auto-migration started'
    };
  }

  pauseAutoMigration() {
    this.autoMigrationEnabled = false;
    
    console.log('⏸️ Auto-migration paused');
    
    return {
      success: true,
      message: 'Auto-migration paused',
      currentPhase: authenticationBridge.migrationPhase
    };
  }

  resumeAutoMigration() {
    this.autoMigrationEnabled = true;
    
    console.log('▶️ Auto-migration resumed');
    
    return {
      success: true,
      message: 'Auto-migration resumed',
      currentPhase: authenticationBridge.migrationPhase
    };
  }

  async manualPhaseAdvance(phase, trafficSplit) {
    if (!['old-system', 'traffic-split', 'new-primary', 'new-system'].includes(phase)) {
      return {
        success: false,
        message: 'Invalid phase'
      };
    }
    
    if (trafficSplit < 0 || trafficSplit > 100) {
      return {
        success: false,
        message: 'Traffic split must be between 0 and 100'
      };
    }
    
    await this.advanceToPhase(phase, trafficSplit);
    
    return {
      success: true,
      message: `Advanced to ${phase} with ${trafficSplit}% traffic split`
    };
  }

  // Reporting methods
  getMigrationStatus() {
    const authHealth = authenticationBridge.getHealthStatus();
    const elapsedTime = this.migrationStartTime ? Date.now() - this.migrationStartTime : 0;
    
    return {
      autoMigrationEnabled: this.autoMigrationEnabled,
      migrationStartTime: this.migrationStartTime ? new Date(this.migrationStartTime) : null,
      elapsedTime: elapsedTime,
      currentPhase: authHealth.bridge.phase,
      trafficSplit: authHealth.bridge.trafficSplit,
      scheduleIndex: this.currentScheduleIndex,
      nextScheduledPhase: this.migrationSchedule[this.currentScheduleIndex + 1] || null,
      overallHealth: this.lastHealthCheck?.overallHealth || null,
      continuousFailures: this.continuousFailures
    };
  }

  getDashboard() {
    const migrationStatus = this.getMigrationStatus();
    const authHealth = authenticationBridge.getHealthStatus();
    
    // Get recent alerts (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAlerts = this.metrics.alerts.filter(alert => alert.timestamp > oneDayAgo);
    
    // Get performance trends (last hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentMetrics = Array.from(this.metrics.performanceMetrics.entries())
      .filter(([timestamp]) => timestamp > oneHourAgo)
      .map(([timestamp, metrics]) => ({ timestamp: new Date(timestamp), ...metrics }));
    
    return {
      status: migrationStatus,
      currentHealth: authHealth,
      recentAlerts: recentAlerts,
      performanceTrends: recentMetrics,
      migrationEvents: this.metrics.migrationEvents.slice(-10), // Last 10 events
      rollbackEvents: this.metrics.rollbackEvents,
      recommendations: this.generateRecommendations()
    };
  }

  generateRecommendations() {
    const recommendations = [];
    const authHealth = authenticationBridge.getHealthStatus();
    
    if (this.lastHealthCheck) {
      const health = this.lastHealthCheck.overallHealth;
      
      if (health.status === 'healthy' && authHealth.bridge.trafficSplit < 100) {
        if (authHealth.metrics.newSystem.successRate > 0.99) {
          recommendations.push({
            type: 'optimization',
            priority: 'medium',
            message: 'New system performing excellently. Consider increasing traffic split.',
            action: 'INCREASE_TRAFFIC'
          });
        }
      }
      
      if (health.issues.length > 0) {
        recommendations.push({
          type: 'warning',
          priority: 'high',
          message: `Health issues detected: ${health.issues.join(', ')}`,
          action: 'MONITOR_CLOSELY'
        });
      }
      
      if (this.continuousFailures > 2) {
        recommendations.push({
          type: 'alert',
          priority: 'critical',
          message: `${this.continuousFailures} continuous failures detected. Consider manual rollback.`,
          action: 'CONSIDER_ROLLBACK'
        });
      }
    }
    
    if (authHealth.metrics.overall.fallbackRate > 0.1) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'High fallback rate indicates new system instability.',
        action: 'INVESTIGATE_NEW_SYSTEM'
      });
    }
    
    return recommendations;
  }

  async stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.autoMigrationEnabled = false;
    console.log('👁️ Dual-Run Authentication Monitor stopped');
  }
}

// Create and export singleton
const dualRunAuthMonitor = new DualRunAuthMonitor();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('dualRunAuthMonitor', () => dualRunAuthMonitor);
}

module.exports = dualRunAuthMonitor;