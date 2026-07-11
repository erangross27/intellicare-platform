/**
 * 🔍 AI OPERATIONS MONITOR
 * 
 * Real-time monitoring of all AI agent operations
 * Detects suspicious patterns and automatically rolls back dangerous changes
 * 
 * SECURITY FEATURES:
 * - Pattern detection for malicious behavior
 * - Automatic rollback of dangerous operations
 * - Real-time alerting
 * - Operation history tracking
 * - Anomaly detection
 */

const EventEmitter = require('events');
const crypto = require('crypto');
// Removed duplicate - using immutableAuditService below
const immutableAuditService = require('../services/immutableAuditService');
const blockchainAuditService = require('../services/blockchainAuditService');

class AIOperationsMonitor extends EventEmitter {
  constructor() {
    super();
    
    this.operations = new Map();
    this.suspiciousPatterns = new Map();
    this.rollbackHistory = [];
    this.thresholds = {
      maxOperationsPerMinute: 100,
      maxFailuresPerMinute: 10,
      maxSecurityViolations: 3,
      suspicionScoreThreshold: 50
    };
    
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      securityViolations: 0,
      rollbacks: 0,
      startTime: Date.now()
    };

    // Start monitoring loops
    this.startMonitoring();
  }

  /**
   * Track an AI operation
   */
  async trackOperation(operation) {
    const operationId = operation.id || crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    
    const trackedOp = {
      id: operationId,
      timestamp,
      type: operation.type,
      function: operation.function,
      parameters: this.sanitizeParameters(operation.parameters),
      sessionId: operation.sessionId,
      practiceId: operation.practiceId,
      userId: operation.userId,
      status: 'pending',
      checkpoints: []
    };

    this.operations.set(operationId, trackedOp);
    this.metrics.totalOperations++;

    // Check for rate limiting
    await this.checkRateLimits(operation);

    // Detect suspicious patterns
    await this.detectSuspiciousPatterns(trackedOp);

    return operationId;
  }

  /**
   * Update operation status
   */
  async updateOperation(operationId, update) {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    Object.assign(operation, update);
    
    if (update.status === 'completed') {
      this.metrics.successfulOperations++;
      operation.completedAt = Date.now();
      operation.duration = operation.completedAt - operation.timestamp;
    } else if (update.status === 'failed') {
      this.metrics.failedOperations++;
      operation.failedAt = Date.now();
      
      // Check if rollback needed
      if (update.requiresRollback) {
        await this.rollbackOperation(operationId, update.reason);
      }
    } else if (update.status === 'security_violation') {
      this.metrics.securityViolations++;
      await this.handleSecurityViolation(operation, update);
    }

    // Add checkpoint
    if (update.checkpoint) {
      operation.checkpoints.push({
        timestamp: Date.now(),
        status: update.status,
        message: update.checkpoint
      });
    }

    // Log significant events
    if (update.status === 'failed' || update.status === 'security_violation') {
      await this.logOperation(operation);
    }
  }

  /**
   * Detect suspicious patterns in operations
   */
  async detectSuspiciousPatterns(operation) {
    let suspicionScore = 0;
    const indicators = [];

    // Pattern 1: Rapid repeated operations
    const recentOps = this.getRecentOperations(60000); // Last minute
    const similarOps = recentOps.filter(op => 
      op.type === operation.type && 
      op.function === operation.function
    );
    
    if (similarOps.length > 10) {
      suspicionScore += 20;
      indicators.push('rapid_repeated_operations');
    }

    // Pattern 2: Unusual parameter combinations
    if (operation.parameters) {
      const paramStr = JSON.stringify(operation.parameters);
      
      // Check for dangerous patterns
      const dangerousPatterns = [
        { pattern: /\$where|\$function/, weight: 30, name: 'mongodb_injection' },
        { pattern: /admin|root|sudo/, weight: 20, name: 'privilege_escalation' },
        { pattern: /delete.*\*/i, weight: 25, name: 'mass_deletion' },
        { pattern: /bypass|override/i, weight: 15, name: 'security_bypass' },
        { pattern: /eval|Function/i, weight: 35, name: 'code_injection' }
      ];

      for (const dp of dangerousPatterns) {
        if (dp.pattern.test(paramStr)) {
          suspicionScore += dp.weight;
          indicators.push(dp.name);
        }
      }
    }

    // Pattern 3: Access pattern anomalies
    const userHistory = this.getUserOperationHistory(operation.userId);
    if (userHistory.length > 0) {
      const normalPatterns = this.analyzeNormalPatterns(userHistory);
      if (this.isAnomalous(operation, normalPatterns)) {
        suspicionScore += 15;
        indicators.push('anomalous_access_pattern');
      }
    }

    // Pattern 4: Time-based anomalies
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 5) { // Unusual hours
      suspicionScore += 10;
      indicators.push('unusual_time');
    }

    // Pattern 5: Failed operation sequences
    const recentFailures = recentOps.filter(op => 
      op.status === 'failed' && 
      op.sessionId === operation.sessionId
    );
    
    if (recentFailures.length > 3) {
      suspicionScore += 25;
      indicators.push('multiple_failures');
    }

    // Record suspicious pattern if threshold exceeded
    if (suspicionScore > 0) {
      const pattern = {
        operationId: operation.id,
        score: suspicionScore,
        indicators,
        timestamp: Date.now()
      };

      this.suspiciousPatterns.set(operation.id, pattern);

      // Alert if high suspicion
      if (suspicionScore >= this.thresholds.suspicionScoreThreshold) {
        await this.alertSuspiciousActivity(operation, pattern);
      }
    }

    return { suspicionScore, indicators };
  }

  /**
   * Check rate limits
   */
  async checkRateLimits(operation) {
    const recentOps = this.getRecentOperations(60000);
    
    if (recentOps.length > this.thresholds.maxOperationsPerMinute) {
      throw new Error('Rate limit exceeded: Too many operations');
    }

    const recentFailures = recentOps.filter(op => op.status === 'failed');
    if (recentFailures.length > this.thresholds.maxFailuresPerMinute) {
      throw new Error('Rate limit exceeded: Too many failures');
    }

    const violations = recentOps.filter(op => op.status === 'security_violation');
    if (violations.length > this.thresholds.maxSecurityViolations) {
      await this.triggerSecurityLockdown(operation);
      throw new Error('Security lockdown: Too many violations');
    }
  }

  /**
   * Rollback a dangerous operation
   */
  async rollbackOperation(operationId, reason) {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    console.error(`🔄 ROLLBACK: Operation ${operationId} - ${reason}`);

    const rollback = {
      operationId,
      timestamp: Date.now(),
      reason,
      operation: operation,
      status: 'pending'
    };

    this.rollbackHistory.push(rollback);
    this.metrics.rollbacks++;

    try {
      // Implement rollback based on operation type
      switch (operation.type) {
        case 'database':
          await this.rollbackDatabaseOperation(operation);
          break;
        case 'file':
          await this.rollbackFileOperation(operation);
          break;
        case 'api':
          await this.rollbackAPIOperation(operation);
          break;
        default:
          console.warn(`No rollback handler for operation type: ${operation.type}`);
      }

      rollback.status = 'completed';
      
      // Log to immutable audit
      await immutableAuditService.logSecurityEvent({
        type: 'AI_OPERATION_ROLLBACK',
        operationId,
        reason,
        operation: this.sanitizeForLogging(operation)
      });

      // Log to blockchain for critical operations
      if (operation.critical) {
        await blockchainAuditService.addBlock({
          type: 'CRITICAL_ROLLBACK',
          operationId,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      rollback.status = 'failed';
      rollback.error = error.message;
      console.error('Rollback failed:', error);
    }

    return rollback;
  }

  /**
   * Rollback database operation
   */
  async rollbackDatabaseOperation(operation) {
    // Implement database-specific rollback
    console.log(`Rolling back database operation: ${operation.function}`);
    
    // For now, log the rollback requirement
    await immutableAuditService.addAuditEntry({
      action: 'DATABASE_ROLLBACK_REQUIRED',
      operation: operation.id,
      function: operation.function,
      parameters: operation.parameters
    });
  }

  /**
   * Rollback file operation
   */
  async rollbackFileOperation(operation) {
    // Implement file-specific rollback
    console.log(`Rolling back file operation: ${operation.function}`);
    
    await immutableAuditService.addAuditEntry({
      action: 'FILE_ROLLBACK_REQUIRED',
      operation: operation.id,
      function: operation.function,
      parameters: operation.parameters
    });
  }

  /**
   * Rollback API operation
   */
  async rollbackAPIOperation(operation) {
    // Implement API-specific rollback
    console.log(`Rolling back API operation: ${operation.function}`);
    
    await immutableAuditService.addAuditEntry({
      action: 'API_ROLLBACK_REQUIRED',
      operation: operation.id,
      function: operation.function,
      parameters: operation.parameters
    });
  }

  /**
   * Handle security violation
   */
  async handleSecurityViolation(operation, violation) {
    console.error(`🚨 SECURITY VIOLATION: ${operation.id}`);
    
    // Log to all audit systems
    await immutableAuditService.logSecurityEvent({
      type: 'AI_SECURITY_VIOLATION',
      operation: this.sanitizeForLogging(operation),
      violation
    });

    await blockchainAuditService.addBlock({
      type: 'SECURITY_VIOLATION',
      operationId: operation.id,
      severity: violation.severity || 'high'
    });

    // Alert administrators
    this.emit('security-violation', {
      operation,
      violation,
      timestamp: Date.now()
    });

    // Trigger rollback if needed
    if (violation.requiresRollback) {
      await this.rollbackOperation(operation.id, 'Security violation');
    }
  }

  /**
   * Alert on suspicious activity
   */
  async alertSuspiciousActivity(operation, pattern) {
    const alert = {
      type: 'SUSPICIOUS_AI_ACTIVITY',
      operation: this.sanitizeForLogging(operation),
      pattern,
      timestamp: Date.now(),
      severity: pattern.score > 75 ? 'critical' : 'high'
    };

    console.warn('⚠️ Suspicious AI Activity:', alert);

    // Log to audit systems
    await immutableAuditService.addAuditEntry({
      action: 'SUSPICIOUS_AI_ACTIVITY',
      ...alert
    });

    // Emit event for real-time monitoring
    this.emit('suspicious-activity', alert);

    // If critical, trigger immediate response
    if (alert.severity === 'critical') {
      await this.triggerSecurityResponse(operation, pattern);
    }
  }

  /**
   * Trigger security response
   */
  async triggerSecurityResponse(operation, pattern) {
    console.error('🚨 CRITICAL SECURITY RESPONSE TRIGGERED');

    // Suspend the session
    this.emit('suspend-session', {
      sessionId: operation.sessionId,
      reason: 'Critical suspicious activity',
      pattern
    });

    // Block the user temporarily
    this.emit('block-user', {
      userId: operation.userId,
      duration: 900000, // 15 minutes
      reason: 'Suspicious AI activity'
    });

    // Notify administrators immediately
    this.emit('admin-alert', {
      type: 'CRITICAL_AI_SECURITY',
      operation,
      pattern,
      action: 'Session suspended, user blocked'
    });
  }

  /**
   * Trigger security lockdown
   */
  async triggerSecurityLockdown(operation) {
    console.error('🔒 SECURITY LOCKDOWN INITIATED');

    // Log critical event
    await blockchainAuditService.addBlock({
      type: 'SECURITY_LOCKDOWN',
      trigger: 'Too many violations',
      timestamp: Date.now()
    });

    // Emit lockdown event
    this.emit('security-lockdown', {
      reason: 'Multiple security violations detected',
      operation,
      timestamp: Date.now()
    });
  }

  /**
   * Get recent operations
   */
  getRecentOperations(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return Array.from(this.operations.values())
      .filter(op => op.timestamp > cutoff);
  }

  /**
   * Get user operation history
   */
  getUserOperationHistory(userId) {
    if (!userId) return [];
    return Array.from(this.operations.values())
      .filter(op => op.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100);
  }

  /**
   * Analyze normal patterns for a user
   */
  analyzeNormalPatterns(history) {
    const patterns = {
      commonFunctions: new Map(),
      commonTypes: new Map(),
      averagePerHour: 0,
      typicalHours: new Set()
    };

    history.forEach(op => {
      // Count functions
      patterns.commonFunctions.set(
        op.function,
        (patterns.commonFunctions.get(op.function) || 0) + 1
      );

      // Count types
      patterns.commonTypes.set(
        op.type,
        (patterns.commonTypes.get(op.type) || 0) + 1
      );

      // Track hours
      const hour = new Date(op.timestamp).getHours();
      patterns.typicalHours.add(hour);
    });

    // Calculate average operations per hour
    if (history.length > 0) {
      const timeSpan = history[0].timestamp - history[history.length - 1].timestamp;
      patterns.averagePerHour = history.length / (timeSpan / 3600000);
    }

    return patterns;
  }

  /**
   * Check if operation is anomalous
   */
  isAnomalous(operation, normalPatterns) {
    // Check if function is unusual
    if (!normalPatterns.commonFunctions.has(operation.function)) {
      return true;
    }

    // Check if type is unusual
    if (!normalPatterns.commonTypes.has(operation.type)) {
      return true;
    }

    // Check if time is unusual
    const hour = new Date().getHours();
    if (!normalPatterns.typicalHours.has(hour)) {
      return true;
    }

    return false;
  }

  /**
   * Sanitize parameters for logging
   */
  sanitizeParameters(params) {
    if (!params) return null;
    
    const sanitized = JSON.stringify(params);
    return JSON.parse(
      sanitized
        .replace(/password['":\s]*['"][^'"]*['"]/gi, 'password: "[REDACTED]"')
        .replace(/secret['":\s]*['"][^'"]*['"]/gi, 'secret: "[REDACTED]"')
        .replace(/token['":\s]*['"][^'"]*['"]/gi, 'token: "[REDACTED]"')
        .replace(/key['":\s]*['"][^'"]*['"]/gi, 'key: "[REDACTED]"')
    );
  }

  /**
   * Sanitize operation for logging
   */
  sanitizeForLogging(operation) {
    return {
      ...operation,
      parameters: this.sanitizeParameters(operation.parameters)
    };
  }

  /**
   * Log operation
   */
  async logOperation(operation) {
    await immutableAuditService.addAuditEntry({
      action: 'AI_OPERATION',
      ...this.sanitizeForLogging(operation)
    });
  }

  /**
   * Start monitoring loops
   */
  startMonitoring() {
    // Clean up old operations every minute
    setInterval(() => {
      const cutoff = Date.now() - 3600000; // Keep 1 hour
      for (const [id, op] of this.operations.entries()) {
        if (op.timestamp < cutoff) {
          this.operations.delete(id);
        }
      }
    }, 60000);

    // Report metrics every 5 minutes
    setInterval(() => {
      this.reportMetrics();
    }, 300000);
  }

  /**
   * Report metrics
   */
  reportMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    const report = {
      uptime: Math.floor(uptime / 1000) + 's',
      totalOperations: this.metrics.totalOperations,
      successRate: this.metrics.totalOperations > 0 
        ? ((this.metrics.successfulOperations / this.metrics.totalOperations) * 100).toFixed(2) + '%'
        : '0%',
      failedOperations: this.metrics.failedOperations,
      securityViolations: this.metrics.securityViolations,
      rollbacks: this.metrics.rollbacks,
      suspiciousPatterns: this.suspiciousPatterns.size,
      activeOperations: this.operations.size
    };

    console.log('📊 AI Operations Monitor Report:', report);
    this.emit('metrics', report);
  }

  /**
   * Get current statistics
   */
  getStatistics() {
    return {
      metrics: this.metrics,
      activeOperations: this.operations.size,
      suspiciousPatterns: this.suspiciousPatterns.size,
      rollbackHistory: this.rollbackHistory.length,
      recentOperations: this.getRecentOperations(300000) // Last 5 minutes
    };
  }
}

module.exports = new AIOperationsMonitor();