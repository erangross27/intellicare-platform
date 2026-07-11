/**
 * 🔍 SECURITY AUDIT & MONITORING SERVICE
 * Real-time security monitoring, anomaly detection, and audit logging
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const serviceAccountManager = require('./serviceAccountManager');

class SecurityAuditService {
  constructor() {
    this.auditLog = [];
    this.securityMetrics = {
      uploadAttempts: 0,
      failedUploads: 0,
      maliciousFiles: 0,
      memoryAlerts: 0,
      rateLimitHits: 0,
      authFailures: 0
    };
    this.anomalyThresholds = {
      maxFailureRate: 0.1, // 10% failure rate
      maxMemoryUsage: 0.8, // 80% memory usage
      maxConcurrentUploads: 5,
      suspiciousFilePatterns: 10 // per hour
    };
    this.alertCallbacks = [];
  }

  async initialize() {
    if (!this.serviceToken) {
      this.serviceToken = await serviceAccountManager.authenticate('security-audit-service');
    }
    return this;
  }

  // Log security event
  logSecurityEvent(event) {
    const auditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: event.type,
      severity: event.severity || 'info',
      userId: event.userId,
      uploadId: event.uploadId,
      clientIp: event.clientIp,
      userAgent: event.userAgent,
      details: event.details,
      metadata: event.metadata || {}
    };

    this.auditLog.push(auditEntry);
    
    // Keep only last 1000 entries in memory
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }

    // Update metrics
    this.updateMetrics(event.type);

    // Check for anomalies
    this.checkAnomalies(auditEntry);

    // Log to console with appropriate level
    const logLevel = this.getLogLevel(event.severity);
    console[logLevel](`🔍 SECURITY: [${event.type}] ${event.details}`, {
      userId: event.userId,
      uploadId: event.uploadId,
      timestamp: auditEntry.timestamp
    });

    return auditEntry.id;
  }

  // Update security metrics
  updateMetrics(eventType) {
    switch (eventType) {
      case 'upload_attempt':
        this.securityMetrics.uploadAttempts++;
        break;
      case 'upload_failed':
        this.securityMetrics.failedUploads++;
        break;
      case 'malicious_file':
        this.securityMetrics.maliciousFiles++;
        break;
      case 'memory_alert':
        this.securityMetrics.memoryAlerts++;
        break;
      case 'rate_limit_hit':
        this.securityMetrics.rateLimitHits++;
        break;
      case 'auth_failure':
        this.securityMetrics.authFailures++;
        break;
    }
  }

  // Check for security anomalies
  checkAnomalies(auditEntry) {
    const recentEvents = this.getRecentEvents(60 * 60 * 1000); // Last hour
    
    // Check failure rate
    const uploadAttempts = recentEvents.filter(e => e.type === 'upload_attempt').length;
    const failedUploads = recentEvents.filter(e => e.type === 'upload_failed').length;
    const failureRate = uploadAttempts > 0 ? failedUploads / uploadAttempts : 0;
    
    if (failureRate > this.anomalyThresholds.maxFailureRate && uploadAttempts > 10) {
      this.triggerAlert({
        type: 'high_failure_rate',
        severity: 'warning',
        details: `High upload failure rate detected: ${(failureRate * 100).toFixed(1)}%`,
        metrics: { failureRate, uploadAttempts, failedUploads }
      });
    }

    // Check for suspicious file patterns
    const maliciousFiles = recentEvents.filter(e => e.type === 'malicious_file').length;
    if (maliciousFiles > this.anomalyThresholds.suspiciousFilePatterns) {
      this.triggerAlert({
        type: 'suspicious_file_pattern',
        severity: 'critical',
        details: `Multiple malicious files detected: ${maliciousFiles} in last hour`,
        metrics: { maliciousFiles }
      });
    }

    // Check for repeated auth failures from same IP
    const authFailures = recentEvents.filter(e => 
      e.type === 'auth_failure' && e.clientIp === auditEntry.clientIp
    ).length;
    
    if (authFailures > 5) {
      this.triggerAlert({
        type: 'brute_force_attempt',
        severity: 'critical',
        details: `Multiple auth failures from IP: ${auditEntry.clientIp}`,
        metrics: { authFailures, clientIp: auditEntry.clientIp }
      });
    }
  }

  // Get recent events
  getRecentEvents(timeWindowMs) {
    const cutoff = new Date(Date.now() - timeWindowMs);
    return this.auditLog.filter(entry => new Date(entry.timestamp) > cutoff);
  }

  // Trigger security alert
  triggerAlert(alert) {
    const alertEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...alert
    };

    console.error(`🚨 SECURITY ALERT: [${alert.type}] ${alert.details}`, alert.metrics);

    // Call registered alert callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alertEntry);
      } catch (error) {
        console.error('Alert callback failed:', error);
      }
    });

    // Log alert as security event
    this.logSecurityEvent({
      type: 'security_alert',
      severity: alert.severity,
      details: `Alert triggered: ${alert.type}`,
      metadata: alert
    });
  }

  // Register alert callback
  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  // Get log level for severity
  getLogLevel(severity) {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warn';
      case 'info': return 'info';
      default: return 'log';
    }
  }

  // Generate security report
  generateSecurityReport(timeWindowMs = 24 * 60 * 60 * 1000) { // 24 hours
    const recentEvents = this.getRecentEvents(timeWindowMs);
    
    const eventsByType = {};
    const eventsBySeverity = {};
    const userActivity = {};
    
    recentEvents.forEach(event => {
      // Count by type
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      
      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      
      // Track user activity
      if (event.userId) {
        if (!userActivity[event.userId]) {
          userActivity[event.userId] = { uploads: 0, failures: 0 };
        }
        if (event.type === 'upload_attempt') userActivity[event.userId].uploads++;
        if (event.type === 'upload_failed') userActivity[event.userId].failures++;
      }
    });

    return {
      timeWindow: `${timeWindowMs / (60 * 60 * 1000)} hours`,
      totalEvents: recentEvents.length,
      metrics: this.securityMetrics,
      eventsByType,
      eventsBySeverity,
      userActivity,
      topRisks: this.identifyTopRisks(recentEvents),
      recommendations: this.generateRecommendations(recentEvents)
    };
  }

  // Identify top security risks
  identifyTopRisks(events) {
    const risks = [];
    
    // High failure rate
    const uploadAttempts = events.filter(e => e.type === 'upload_attempt').length;
    const failedUploads = events.filter(e => e.type === 'upload_failed').length;
    const failureRate = uploadAttempts > 0 ? failedUploads / uploadAttempts : 0;
    
    if (failureRate > 0.05) {
      risks.push({
        type: 'high_failure_rate',
        severity: failureRate > 0.1 ? 'high' : 'medium',
        description: `Upload failure rate: ${(failureRate * 100).toFixed(1)}%`,
        impact: 'Service availability and user experience'
      });
    }

    // Malicious file attempts
    const maliciousFiles = events.filter(e => e.type === 'malicious_file').length;
    if (maliciousFiles > 0) {
      risks.push({
        type: 'malicious_files',
        severity: maliciousFiles > 5 ? 'high' : 'medium',
        description: `${maliciousFiles} malicious file(s) detected`,
        impact: 'System security and data integrity'
      });
    }

    // Memory pressure
    const memoryAlerts = events.filter(e => e.type === 'memory_alert').length;
    if (memoryAlerts > 0) {
      risks.push({
        type: 'memory_pressure',
        severity: memoryAlerts > 10 ? 'high' : 'medium',
        description: `${memoryAlerts} memory alert(s)`,
        impact: 'System stability and performance'
      });
    }

    return risks.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  // Generate security recommendations
  generateRecommendations(events) {
    const recommendations = [];
    
    const maliciousFiles = events.filter(e => e.type === 'malicious_file').length;
    if (maliciousFiles > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Review and strengthen file validation rules',
        reason: `${maliciousFiles} malicious files detected`
      });
    }

    const memoryAlerts = events.filter(e => e.type === 'memory_alert').length;
    if (memoryAlerts > 5) {
      recommendations.push({
        priority: 'medium',
        action: 'Consider increasing server memory or optimizing upload processing',
        reason: `Frequent memory pressure alerts: ${memoryAlerts}`
      });
    }

    const rateLimitHits = events.filter(e => e.type === 'rate_limit_hit').length;
    if (rateLimitHits > 10) {
      recommendations.push({
        priority: 'low',
        action: 'Review rate limiting thresholds for legitimate users',
        reason: `High rate limit hits: ${rateLimitHits}`
      });
    }

    return recommendations;
  }

  // Save audit log to file
  async saveAuditLog() {
    try {
      const logPath = path.join(__dirname, '../logs/security-audit.log');
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      
      const logData = this.auditLog.map(entry => JSON.stringify(entry)).join('\n');
      await fs.appendFile(logPath, logData + '\n');
      
      console.log(`📝 Security audit log saved: ${this.auditLog.length} entries`);
    } catch (error) {
      console.error('Failed to save audit log:', error);
    }
  }

  // Get current security status
  getSecurityStatus() {
    const recentEvents = this.getRecentEvents(60 * 60 * 1000); // Last hour
    const risks = this.identifyTopRisks(recentEvents);
    const highRisks = risks.filter(r => r.severity === 'high').length;
    
    return {
      status: highRisks > 0 ? 'at_risk' : 'secure',
      riskLevel: highRisks > 2 ? 'high' : highRisks > 0 ? 'medium' : 'low',
      activeAlerts: risks.length,
      recentEvents: recentEvents.length,
      metrics: this.securityMetrics,
      lastUpdate: new Date().toISOString()
    };
  }
}

// Singleton instance
const securityAuditService = new SecurityAuditService();

// Auto-save audit log every hour
setInterval(() => {
  securityAuditService.saveAuditLog();
}, 60 * 60 * 1000);

module.exports = securityAuditService;
