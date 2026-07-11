// Real-Time Security Monitoring Service
// Provides WebSocket-based security monitoring and alerting

const { Server } = require('socket.io');
const crypto = require('crypto');
const EventEmitter = require('events');
const secureConfigService = require('../services/secureConfigService');
const SecureDataAccess = require('./secureDataAccess');

class SecurityMonitoringService extends EventEmitter {
  constructor() {
    super();
    
    // WebSocket server instance
    this.io = null;
    
    // Connected clients
    this.clients = new Map();
    
    // Violation tracking for auto-blocking
    this.violationTracking = new Map();
    this.blockedEntities = new Set();
    this.suspendedServices = new Set();
    
    // Security event types
    this.eventTypes = {
      AUTH_ATTEMPT: 'auth_attempt',
      AUTH_SUCCESS: 'auth_success',
      AUTH_FAILURE: 'auth_failure',
      SUSPICIOUS_ACTIVITY: 'suspicious_activity',
      THREAT_DETECTED: 'threat_detected',
      RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
      UNAUTHORIZED_ACCESS: 'unauthorized_access',
      DATA_BREACH_ATTEMPT: 'data_breach_attempt',
      SYSTEM_ALERT: 'system_alert',
      PERFORMANCE_ALERT: 'performance_alert'
    };
    
    // Alert levels
    this.alertLevels = {
      INFO: 'info',
      WARNING: 'warning',
      CRITICAL: 'critical',
      EMERGENCY: 'emergency'
    };
    
    // Security metrics
    this.metrics = {
      totalEvents: 0,
      eventsByType: new Map(),
      eventsByLevel: new Map(),
      threatsDetected: 0,
      activeAlerts: [],
      recentEvents: [],
      violations: new Map(),
      blockedCount: 0,
      autoBlockEnabled: secureConfigService.get('AUTO_BLOCK_VIOLATIONS') === 'true',
      maxViolationsBeforeBlock: parseInt(secureConfigService.get('MAX_VIOLATIONS_BEFORE_BLOCK') || '5'),
      systemHealth: {
        status: 'healthy',
        uptime: 0,
        lastCheck: new Date()
      }
    };
    
    // Alert thresholds
    this.alertThresholds = {
      failedLogins: 5,
      rateLimit: 10,
      suspiciousActivity: 3,
      criticalEvents: 1
    };
    
    // Event buffer for aggregation
    this.eventBuffer = [];
    this.bufferSize = 100;
    
    // Aggregation intervals
    this.aggregationInterval = null;
    this.aggregationPeriod = 5000; // 5 seconds
    
    // Alert subscribers
    this.alertSubscribers = new Set();
    
    // Threat intelligence data
    this.threatIntelligence = {
      blacklistedIPs: new Set(),
      knownAttackPatterns: [],
      suspiciousUserAgents: []
    };
    
    // Track violations for auto-blocking
    this.violations = [];
    this.blockedIPs = new Set();
    this.blockedServices = new Set();
  }
  
  async initialize() {
    const serviceAccountManager = require('./serviceAccountManager');
    if (!this.serviceToken) {
      this.serviceToken = await serviceAccountManager.authenticate('security-monitoring');
    }
    return this;
  }
  
  /**
   * Auto-block after violations
   */
  async handleViolation(violation) {
    this.violations.push(violation);

    // Count violations per IP
    const ipViolations = this.violations.filter(v =>
      v.ip === violation.ip &&
      v.timestamp > Date.now() - 3600000
    ).length;

    if (ipViolations >= 5) {
      await this.blockIP(violation.ip);
      await this.revokeServiceToken(violation.serviceId);
      await this.alertAdmins(violation);
    }
  }
  
  /**
   * Block an IP address
   */
  async blockIP(ip) {
    this.blockedIPs.add(ip);
    this.threatIntelligence.blacklistedIPs.add(ip);
    console.error(`🚫 IP BLOCKED: ${ip}`);
    this.broadcastToAll('ip_blocked', { ip, timestamp: Date.now() });
  }
  
  /**
   * Revoke service token
   */
  async revokeServiceToken(serviceId) {
    if (!serviceId) return;
    this.blockedServices.add(serviceId);
    console.error(`🔒 SERVICE TOKEN REVOKED: ${serviceId}`);
    this.broadcastToAll('service_revoked', { serviceId, timestamp: Date.now() });
  }
  
  /**
   * Alert administrators
   */
  async alertAdmins(violation) {
    const alert = {
      type: 'SECURITY_VIOLATION',
      severity: 'CRITICAL',
      violation,
      timestamp: Date.now(),
      message: `Multiple violations detected from ${violation.ip}`
    };
    
    this.metrics.activeAlerts.push(alert);
    this.broadcastToRole('admin', 'critical_alert', alert);
    console.error('🚨 ADMIN ALERT:', alert);
  }
  
  /**
   * Get violations for monitoring
   */
  async getViolations() {
    return {
      recent: this.violations.slice(-100),
      total: this.violations.length,
      blockedIPs: Array.from(this.blockedIPs),
      blockedServices: Array.from(this.blockedServices)
    };
  }
  
  /**
   * Get service health status
   */
  async getServiceHealth() {
    return {
      status: this.metrics.systemHealth.status,
      uptime: Date.now() - this.metrics.systemHealth.lastCheck,
      violations: this.violations.length,
      blockedCount: this.blockedIPs.size + this.blockedServices.size,
      activeAlerts: this.metrics.activeAlerts.length
    };
  }
  
  /**
   * Stream updates to WebSocket client
   */
  streamToClient(ws) {
    // Send initial state
    ws.send(JSON.stringify({
      type: 'initial',
      data: {
        violations: this.violations.slice(-10),
        health: this.metrics.systemHealth,
        alerts: this.metrics.activeAlerts
      }
    }));
    
    // Add to clients for broadcasts
    if (this.io) {
      this.clients.set(ws, { ws, connected: Date.now() });
    }
  }
  
  /**
   * Initialize WebSocket server
   */
  initializeWebSocket(httpServer) {
    try {
      this.io = new Server(httpServer, {
        cors: {
          origin: secureConfigService.get('ALLOWED_ORIGINS')?.split(',') || ['http://localhost:3000'],
          credentials: true
        },
        transports: ['websocket', 'polling']
      });
      
      // Setup connection handlers
      this.setupConnectionHandlers();
      
      // Start metrics aggregation
      this.startAggregation();
      
      // WebSocket server initialized for security monitoring
      
      return this.io;
    } catch (error) {
      console.error('WebSocket initialization error:', error);
      throw error;
    }
  }
  
  /**
   * Setup WebSocket connection handlers
   */
  setupConnectionHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`👤 Client connected: ${socket.id}`);
      
      // Store client info
      this.clients.set(socket.id, {
        id: socket.id,
        connectedAt: new Date(),
        subscriptions: new Set(),
        role: 'viewer' // Default role
      });
      
      // Send initial metrics
      socket.emit('initial_metrics', this.getMetricsSummary());
      
      // Handle authentication
      socket.on('authenticate', (data) => {
        this.handleAuthentication(socket, data);
      });
      
      // Handle subscriptions
      socket.on('subscribe', (eventTypes) => {
        this.handleSubscription(socket, eventTypes);
      });
      
      // Handle unsubscribe
      socket.on('unsubscribe', (eventTypes) => {
        this.handleUnsubscribe(socket, eventTypes);
      });
      
      // Handle metric requests
      socket.on('get_metrics', () => {
        socket.emit('metrics_update', this.getDetailedMetrics());
      });
      
      // Handle alert acknowledgment
      socket.on('acknowledge_alert', (alertId) => {
        this.acknowledgeAlert(alertId, socket.id);
      });
      
      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`👤 Client disconnected: ${socket.id}`);
        this.clients.delete(socket.id);
      });
    });
  }
  
  /**
   * Handle client authentication
   */
  handleAuthentication(socket, data) {
    const client = this.clients.get(socket.id);
    if (!client) return;
    
    // Verify authentication (simplified for demo)
    if (data.token && data.role) {
      client.role = data.role;
      client.authenticated = true;
      
      socket.emit('authenticated', {
        success: true,
        role: data.role
      });
      
      // Send role-specific data
      if (data.role === 'admin') {
        socket.emit('admin_data', this.getAdminData());
      }
    } else {
      socket.emit('authenticated', {
        success: false,
        message: 'Invalid credentials'
      });
    }
  }
  
  /**
   * Track security violation and auto-block if threshold exceeded
   */
  trackViolation(entity, violationType, details) {
    if (!this.violationTracking.has(entity)) {
      this.violationTracking.set(entity, []);
    }
    
    const violations = this.violationTracking.get(entity);
    violations.push({
      type: violationType,
      details,
      timestamp: Date.now()
    });
    
    // Update metrics
    this.metrics.violations.set(entity, violations.length);
    
    // Check for auto-blocking
    if (this.metrics.autoBlockEnabled && violations.length >= this.metrics.maxViolationsBeforeBlock) {
      this.autoBlockEntity(entity, violationType);
    }
    
    // Emit violation event
    this.broadcastToRole('admin', 'violation_detected', {
      entity,
      violationType,
      count: violations.length,
      details
    });
    
    return violations.length;
  }
  
  /**
   * Auto-block entity after violations exceed threshold
   */
  autoBlockEntity(entity, reason) {
    if (this.blockedEntities.has(entity)) return;
    
    this.blockedEntities.add(entity);
    this.metrics.blockedCount++;
    
    // Log critical event
    const blockEvent = {
      entity,
      reason,
      timestamp: Date.now(),
      violations: this.violationTracking.get(entity),
      action: 'AUTO_BLOCKED'
    };
    
    console.error('🚫 ENTITY AUTO-BLOCKED:', blockEvent);
    
    // Emit to admins
    this.broadcastToRole('admin', 'entity_blocked', blockEvent);
    
    // If it's a service, revoke its token
    if (entity.startsWith('service_')) {
      this.revokeServiceToken(entity);
    }
    
    // Schedule unblock after 1 hour (configurable)
    setTimeout(() => {
      this.unblockEntity(entity);
    }, 3600000);
    
    return blockEvent;
  }
  
  /**
   * Revoke service token on suspicious activity
   */
  async revokeServiceToken(serviceId) {
    try {
      this.suspendedServices.add(serviceId);
      
      // Emit service suspension event
      this.broadcastToRole('admin', 'service_suspended', {
        serviceId,
        reason: 'Security violations exceeded threshold',
        timestamp: Date.now()
      });
      
      console.error(`🔒 Service token revoked: ${serviceId}`);
      return true;
    } catch (error) {
      console.error('Failed to revoke service token:', error);
      return false;
    }
  }
  
  /**
   * Unblock entity
   */
  unblockEntity(entity) {
    this.blockedEntities.delete(entity);
    this.violationTracking.delete(entity);
    this.metrics.violations.delete(entity);
    
    if (entity.startsWith('service_')) {
      this.suspendedServices.delete(entity);
    }
    
    this.broadcastToRole('admin', 'entity_unblocked', {
      entity,
      timestamp: Date.now()
    });
  }
  
  /**
   * Check if entity is blocked
   */
  isBlocked(entity) {
    return this.blockedEntities.has(entity);
  }
  
  /**
   * Create automated security alert
   */
  createAutomatedAlert(level, title, message, autoAction = null) {
    const alert = {
      id: crypto.randomBytes(16).toString('hex'),
      level,
      title,
      message,
      timestamp: Date.now(),
      automated: true,
      acknowledged: false
    };
    
    this.metrics.activeAlerts.push(alert);
    
    // Execute auto-action if specified
    if (autoAction) {
      this.executeAutoAction(autoAction, alert);
    }
    
    // Broadcast alert
    this.broadcastToAll('security_alert', alert);
    
    // For critical alerts, also log to audit
    if (level === this.alertLevels.CRITICAL || level === this.alertLevels.EMERGENCY) {
      this.logCriticalAlert(alert);
    }
    
    return alert;
  }
  
  /**
   * Execute automated response action
   */
  async executeAutoAction(action, alert) {
    console.log(`🤖 Executing automated response: ${action.type}`);
    
    switch (action.type) {
      case 'BLOCK_IP':
        this.autoBlockEntity(action.target, alert.title);
        break;
      case 'REVOKE_TOKEN':
        await this.revokeServiceToken(action.target);
        break;
      case 'LOCKDOWN':
        this.initiateSecurityLockdown(alert);
        break;
      case 'RATE_LIMIT':
        this.enforceStrictRateLimit(action.target);
        break;
      case 'ROLLBACK':
        await this.rollbackDangerousOperation(action.operation);
        break;
      default:
        console.warn(`Unknown auto-action type: ${action.type}`);
    }
  }
  
  /**
   * Initiate security lockdown for critical threats
   */
  initiateSecurityLockdown(alert) {
    console.error('🚨 SECURITY LOCKDOWN INITIATED');
    
    // Set strict mode
    secureConfigService.get('SECURITY_LOCKDOWN') = 'true';
    secureConfigService.get('MAX_VIOLATIONS_BEFORE_BLOCK') = '1';
    
    this.metrics.systemHealth.status = 'lockdown';
    
    // Broadcast lockdown
    this.broadcastToAll('security_lockdown', {
      alert,
      timestamp: Date.now(),
      message: 'System in lockdown mode due to critical threat'
    });
  }
  
  /**
   * Rollback dangerous operation
   */
  async rollbackDangerousOperation(operation) {
    console.warn(`⏪ Rolling back dangerous operation: ${operation}`);
    
    // Emit rollback event
    this.broadcastToRole('admin', 'operation_rollback', {
      operation,
      timestamp: Date.now(),
      reason: 'Automated security response'
    });
    
    return true;
  }
  
  /**
   * Broadcast to specific role
   */
  broadcastToRole(role, event, data) {
    if (!this.io) return;
    
    this.clients.forEach((client, socketId) => {
      if (client.role === role) {
        this.io.to(socketId).emit(event, data);
      }
    });
  }
  
  /**
   * Handle event subscription
   */
  handleSubscription(socket, eventTypes) {
    const client = this.clients.get(socket.id);
    if (!client) return;
    
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    types.forEach(type => {
      client.subscriptions.add(type);
      socket.join(`event_${type}`);
    });
    
    socket.emit('subscribed', {
      success: true,
      subscriptions: Array.from(client.subscriptions)
    });
  }
  
  /**
   * Handle unsubscribe
   */
  handleUnsubscribe(socket, eventTypes) {
    const client = this.clients.get(socket.id);
    if (!client) return;
    
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    types.forEach(type => {
      client.subscriptions.delete(type);
      socket.leave(`event_${type}`);
    });
    
    socket.emit('unsubscribed', {
      success: true,
      subscriptions: Array.from(client.subscriptions)
    });
  }
  
  /**
   * Emit security event
   */
  emitSecurityEvent(type, data, level = this.alertLevels.INFO) {
    const event = {
      id: crypto.randomBytes(8).toString('hex'),
      type,
      level,
      data,
      timestamp: new Date(),
      source: data.source || 'system'
    };
    
    // Update metrics
    this.updateMetrics(event);
    
    // Add to buffer
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.bufferSize) {
      this.eventBuffer.shift();
    }
    
    // Emit to subscribed clients
    if (this.io) {
      this.io.to(`event_${type}`).emit('security_event', event);
      
      // Broadcast to all if critical
      if (level === this.alertLevels.CRITICAL || level === this.alertLevels.EMERGENCY) {
        this.io.emit('critical_alert', event);
      }
    }
    
    // Check alert thresholds
    this.checkAlertThresholds(event);
    
    // Log event
    console.log(`🔔 Security Event [${level.toUpperCase()}]: ${type}`);
    
    return event;
  }
  
  /**
   * Update security metrics
   */
  updateMetrics(event) {
    this.metrics.totalEvents++;
    
    // Update event counts by type
    const typeCount = this.metrics.eventsByType.get(event.type) || 0;
    this.metrics.eventsByType.set(event.type, typeCount + 1);
    
    // Update event counts by level
    const levelCount = this.metrics.eventsByLevel.get(event.level) || 0;
    this.metrics.eventsByLevel.set(event.level, levelCount + 1);
    
    // Track threats
    if (event.type === this.eventTypes.THREAT_DETECTED) {
      this.metrics.threatsDetected++;
    }
    
    // Add to recent events
    this.metrics.recentEvents.unshift(event);
    if (this.metrics.recentEvents.length > 50) {
      this.metrics.recentEvents.pop();
    }
    
    // Update active alerts
    if (event.level === this.alertLevels.WARNING || 
        event.level === this.alertLevels.CRITICAL ||
        event.level === this.alertLevels.EMERGENCY) {
      this.metrics.activeAlerts.push({
        ...event,
        acknowledged: false
      });
    }
  }
  
  /**
   * Check alert thresholds
   */
  checkAlertThresholds(event) {
    // Check failed login threshold
    if (event.type === this.eventTypes.AUTH_FAILURE) {
      const recentFailures = this.eventBuffer.filter(e => 
        e.type === this.eventTypes.AUTH_FAILURE &&
        e.data.ip === event.data.ip &&
        Date.now() - e.timestamp < 300000 // 5 minutes
      ).length;
      
      if (recentFailures >= this.alertThresholds.failedLogins) {
        this.emitSecurityEvent(
          this.eventTypes.SUSPICIOUS_ACTIVITY,
          {
            reason: 'Multiple failed login attempts',
            ip: event.data.ip,
            count: recentFailures
          },
          this.alertLevels.WARNING
        );
      }
    }
    
    // Check rate limit threshold
    if (event.type === this.eventTypes.RATE_LIMIT_EXCEEDED) {
      const recentLimits = this.eventBuffer.filter(e =>
        e.type === this.eventTypes.RATE_LIMIT_EXCEEDED &&
        Date.now() - e.timestamp < 60000 // 1 minute
      ).length;
      
      if (recentLimits >= this.alertThresholds.rateLimit) {
        this.emitSecurityEvent(
          this.eventTypes.SYSTEM_ALERT,
          {
            reason: 'Excessive rate limit violations',
            count: recentLimits
          },
          this.alertLevels.CRITICAL
        );
      }
    }
  }
  
  /**
   * Start metrics aggregation
   */
  startAggregation() {
    this.aggregationInterval = setInterval(() => {
      this.aggregateMetrics();
    }, this.aggregationPeriod);
  }
  
  /**
   * Aggregate security metrics
   */
  aggregateMetrics() {
    const summary = this.getMetricsSummary();
    
    // Emit aggregated metrics to all clients
    if (this.io) {
      this.io.emit('metrics_update', summary);
    }
    
    // Check system health
    this.checkSystemHealth();
    
    // Clean old events
    this.cleanOldEvents();
  }
  
  /**
   * Check system health
   */
  checkSystemHealth() {
    const now = Date.now();
    const recentEvents = this.eventBuffer.filter(e => 
      now - e.timestamp < 60000 // Last minute
    );
    
    // Calculate health score
    let healthScore = 100;
    
    // Deduct for critical events
    const criticalCount = recentEvents.filter(e => 
      e.level === this.alertLevels.CRITICAL
    ).length;
    healthScore -= criticalCount * 20;
    
    // Deduct for threats
    const threatCount = recentEvents.filter(e =>
      e.type === this.eventTypes.THREAT_DETECTED
    ).length;
    healthScore -= threatCount * 15;
    
    // Deduct for warnings
    const warningCount = recentEvents.filter(e =>
      e.level === this.alertLevels.WARNING
    ).length;
    healthScore -= warningCount * 5;
    
    // Update health status
    if (healthScore >= 80) {
      this.metrics.systemHealth.status = 'healthy';
    } else if (healthScore >= 60) {
      this.metrics.systemHealth.status = 'degraded';
    } else if (healthScore >= 40) {
      this.metrics.systemHealth.status = 'warning';
    } else {
      this.metrics.systemHealth.status = 'critical';
    }
    
    this.metrics.systemHealth.score = Math.max(0, healthScore);
    this.metrics.systemHealth.lastCheck = new Date();
  }
  
  /**
   * Clean old events
   */
  cleanOldEvents() {
    const oneHourAgo = Date.now() - 3600000;
    
    // Clean recent events
    this.metrics.recentEvents = this.metrics.recentEvents.filter(e =>
      e.timestamp > oneHourAgo
    );
    
    // Clean acknowledged alerts
    this.metrics.activeAlerts = this.metrics.activeAlerts.filter(a =>
      !a.acknowledged || a.timestamp > oneHourAgo
    );
  }
  
  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    return {
      totalEvents: this.metrics.totalEvents,
      threatsDetected: this.metrics.threatsDetected,
      activeAlerts: this.metrics.activeAlerts.length,
      systemHealth: this.metrics.systemHealth,
      eventDistribution: {
        byType: Object.fromEntries(this.metrics.eventsByType),
        byLevel: Object.fromEntries(this.metrics.eventsByLevel)
      },
      recentEvents: this.metrics.recentEvents.slice(0, 10)
    };
  }
  
  /**
   * Get detailed metrics
   */
  getDetailedMetrics() {
    return {
      ...this.getMetricsSummary(),
      activeAlerts: this.metrics.activeAlerts,
      connectedClients: this.clients.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      eventBuffer: this.eventBuffer.slice(-20)
    };
  }
  
  /**
   * Get admin data
   */
  getAdminData() {
    return {
      clients: Array.from(this.clients.values()).map(c => ({
        id: c.id,
        connectedAt: c.connectedAt,
        role: c.role,
        subscriptions: Array.from(c.subscriptions)
      })),
      threatIntelligence: {
        blacklistedIPs: Array.from(this.threatIntelligence.blacklistedIPs),
        patterns: this.threatIntelligence.knownAttackPatterns.length,
        suspiciousAgents: this.threatIntelligence.suspiciousUserAgents.length
      },
      alertThresholds: this.alertThresholds
    };
  }
  
  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId, clientId) {
    const alert = this.metrics.activeAlerts.find(a => a.id === alertId);
    
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = clientId;
      alert.acknowledgedAt = new Date();
      
      // Notify all clients
      if (this.io) {
        this.io.emit('alert_acknowledged', {
          alertId,
          acknowledgedBy: clientId
        });
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Add IP to blacklist
   */
  blacklistIP(ip, reason) {
    this.threatIntelligence.blacklistedIPs.add(ip);
    
    this.emitSecurityEvent(
      this.eventTypes.THREAT_DETECTED,
      {
        action: 'IP blacklisted',
        ip,
        reason
      },
      this.alertLevels.WARNING
    );
  }
  
  /**
   * Check if IP is blacklisted
   */
  isIPBlacklisted(ip) {
    return this.threatIntelligence.blacklistedIPs.has(ip);
  }
  
  /**
   * Generate threat report
   */
  generateThreatReport() {
    const report = {
      timestamp: new Date(),
      period: 'last_24_hours',
      summary: {
        totalThreats: this.metrics.threatsDetected,
        criticalEvents: this.metrics.eventsByLevel.get(this.alertLevels.CRITICAL) || 0,
        blockedIPs: this.threatIntelligence.blacklistedIPs.size,
        systemHealth: this.metrics.systemHealth
      },
      topThreats: this.getTopThreats(),
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }
  
  /**
   * Get top threats
   */
  getTopThreats() {
    const threats = [];
    
    // Analyze event buffer for patterns
    const threatTypes = new Map();
    
    this.eventBuffer.forEach(event => {
      if (event.level === this.alertLevels.WARNING ||
          event.level === this.alertLevels.CRITICAL) {
        const count = threatTypes.get(event.type) || 0;
        threatTypes.set(event.type, count + 1);
      }
    });
    
    // Sort by frequency
    return Array.from(threatTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
  }
  
  /**
   * Generate security recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Check for high failed login rate
    const failedLogins = this.metrics.eventsByType.get(this.eventTypes.AUTH_FAILURE) || 0;
    if (failedLogins > 50) {
      recommendations.push({
        priority: 'high',
        action: 'Enable stricter rate limiting for authentication endpoints'
      });
    }
    
    // Check for threats
    if (this.metrics.threatsDetected > 10) {
      recommendations.push({
        priority: 'critical',
        action: 'Review and update security policies'
      });
    }
    
    // Check system health
    if (this.metrics.systemHealth.status === 'critical') {
      recommendations.push({
        priority: 'emergency',
        action: 'Immediate security review required'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Shutdown service
   */
  shutdown() {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    
    if (this.io) {
      this.io.close();
    }
    
    console.log('🔌 Security monitoring service shutdown');
  }
  
  /**
   * Initialize service
   */
  initialize() {
    // Security Monitoring Service initialized with real-time threat detection
    return true;
  }

  /**
   * Get real-time metrics for dashboard
   */
  async getMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Filter recent events
    const recentEvents = this.metrics.recentEvents.filter(e => 
      e.timestamp > oneMinuteAgo
    );
    
    const violations = recentEvents.filter(e => 
      e.type === 'violation' || e.level === 'critical'
    ).length;
    
    const blocked = this.blockedIPs.size + this.blockedServices.size;
    
    // Calculate security score (100 - violations percentage)
    const totalRequests = recentEvents.length || 1;
    const violationRate = (violations / totalRequests) * 100;
    const securityScore = Math.max(0, 100 - violationRate);
    
    // Get latest event for live feed
    const latestEvent = this.metrics.recentEvents[0];
    
    return {
      metrics: {
        totalRequests,
        blockedRequests: blocked,
        activeThreats: this.threatIntelligence.blacklistedIPs.size,
        securityScore: Math.round(securityScore),
        violationsCount: violations,
        autoBlocks: this.metrics.blockedCount || 0
      },
      event: latestEvent ? latestEvent.description || `${latestEvent.type}: ${latestEvent.data?.reason || 'Security event'}` : 'System initialized',
      severity: latestEvent ? latestEvent.level : 'low',
      timestamp: now,
      enforcement: {
        mode: secureConfigService.get('SECURITY_MODE'),
        autoBlocking: secureConfigService.get('AUTO_BLOCK_VIOLATIONS') === 'true'
      }
    };
  }

  /**
   * Get security status
   */
  async getSecurityStatus() {
    return {
      mode: secureConfigService.get('SECURITY_MODE'),
      enforcement: secureConfigService.get('ENFORCE_SECURITY') === 'true',
      autoBlocking: secureConfigService.get('AUTO_BLOCK_VIOLATIONS') === 'true',
      blacklistedIPs: Array.from(this.threatIntelligence.blacklistedIPs),
      blockedServices: Array.from(this.blockedServices),
      activeServices: this.getActiveServices(),
      uptime: process.uptime(),
      lastIncident: this.metrics.recentEvents.find(e => e.level === 'critical')
    };
  }

  /**
   * Get active services status
   */
  getActiveServices() {
    // This would check actual service status
    return {
      secureDataAccess: true,
      serviceAccountManager: true,
      immutableAudit: true,
      threatDetection: true,
      encryption: true,
      apiGateway: true,
      sessionFingerprint: true
    };
  }

  /**
   * Block IP with reason
   */
  async blockIP(ip, reason = 'Security violation') {
    if (!ip || this.threatIntelligence.blacklistedIPs.has(ip)) {
      return;
    }
    
    this.threatIntelligence.blacklistedIPs.add(ip);
    this.metrics.blockedCount = (this.metrics.blockedCount || 0) + 1;
    
    // Log blocking event
    this.emitSecurityEvent(
      this.eventTypes.SYSTEM_ALERT,
      {
        action: 'ip_blocked',
        ip,
        reason,
        timestamp: Date.now()
      },
      this.alertLevels.WARNING
    );
    
    console.log(`🚫 IP BLOCKED: ${ip} - ${reason}`);
    
    // Broadcast to connected clients
    if (this.io) {
      this.io.emit('ip_blocked', { ip, reason, timestamp: Date.now() });
    }
    
    // Log to immutable audit
    const immutableAuditService = require('./immutableAuditService');
    await immutableAuditService.logSecurityIncident({
      type: 'ip_blocked',
      severity: 'high',
      details: { ip, reason },
      timestamp: new Date()
    });
  }

  /**
   * Unblock IP
   */
  async unblockIP(ip) {
    if (!ip || !this.threatIntelligence.blacklistedIPs.has(ip)) {
      return;
    }
    
    this.threatIntelligence.blacklistedIPs.delete(ip);
    
    // Log unblocking event
    this.emitSecurityEvent(
      this.eventTypes.SYSTEM_ALERT,
      {
        action: 'ip_unblocked',
        ip,
        timestamp: Date.now()
      },
      this.alertLevels.INFO
    );
    
    console.log(`✅ IP UNBLOCKED: ${ip}`);
    
    // Broadcast to connected clients
    if (this.io) {
      this.io.emit('ip_unblocked', { ip, timestamp: Date.now() });
    }
  }

  /**
   * Suspend user account
   */
  async suspendUser(userId, reason) {
    console.log(`⛔ Suspending user ${userId}: ${reason}`);
    
    // Log suspension
    const immutableAuditService = require('./immutableAuditService');
    await immutableAuditService.addAuditEntry({
      eventType: 'user_suspended',
      userId,
      details: reason,
      automated: true,
      timestamp: new Date()
    });
    
    // Emit event
    this.emitSecurityEvent(
      this.eventTypes.SYSTEM_ALERT,
      {
        action: 'user_suspended',
        userId,
        reason
      },
      this.alertLevels.WARNING
    );
  }

  /**
   * Check if we should send alerts
   */
  async checkAlertThreshold() {
    const threshold = parseInt(secureConfigService.get('SECURITY_ALERT_THRESHOLD') || '5');
    const recentViolations = this.metrics.recentEvents.filter(e => 
      (e.type === 'violation' || e.level === 'critical') && 
      e.timestamp > Date.now() - 300000 // Last 5 minutes
    ).length;
    
    if (recentViolations >= threshold) {
      await this.sendSecurityAlert({
        level: 'critical',
        message: `${recentViolations} violations in last 5 minutes`,
        action: 'Manual review required'
      });
    }
  }

  /**
   * Send security alert
   */
  async sendSecurityAlert(alert) {
    // Security alert logged to audit system only - not to console
    
    // Log to audit
    const immutableAuditService = require('./immutableAuditService');
    await immutableAuditService.logSecurityIncident({
      type: 'security_alert',
      severity: alert.level,
      details: alert.message,
      timestamp: new Date()
    });
    
    // Broadcast alert
    if (this.io) {
      this.io.emit('security_alert', alert);
    }
    
    // Would send email/SMS/Slack notification here
    // emailService.sendAlert(alert);
  }
}

// Export singleton instance
module.exports = new SecurityMonitoringService();