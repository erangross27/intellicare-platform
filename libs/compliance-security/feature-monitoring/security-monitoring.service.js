/**
 * 📊 REAL-TIME SECURITY MONITORING SERVICE
 * 
 * Provides WebSocket-based security monitoring, alerting, and real-time threat detection.
 * Monitors security events, tracks violations, and provides automated blocking capabilities.
 * 
 * SECURITY: Real-time monitoring with automated threat response.
 * COMPLIANCE: All security events logged for audit and compliance reporting.
 */

const path = require('path');
const { Server } = require(path.resolve(__dirname, '../../../backend/node_modules/socket.io'));
const crypto = require('crypto');
const EventEmitter = require('events');

// Add service proxy getter
let simpleServiceProxy = null;
function getServiceProxy() {
    if (!simpleServiceProxy) {
        simpleServiceProxy = require('../../../backend/services/simpleServiceProxy');
    }
    return simpleServiceProxy;
}

class SecurityMonitoringService extends EventEmitter {
  constructor() {
    super();
    
    this.serviceToken = null;
    this.initialized = false;
    
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
      activeConnections: 0,
      blockedEntities: 0,
      suspendedServices: 0
    };
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('security-monitoring-service');
      this.initialized = true;
      console.log('✅ Security Monitoring Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Security Monitoring Service:', error);
      throw error;
    }
  }

  /**
   * Initialize WebSocket server
   */
  async initializeWebSocket(httpServer) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      this.io = new Server(httpServer, {
        cors: {
          origin: process.env.FRONTEND_URL || "http://localhost:3000",
          methods: ["GET", "POST"]
        }
      });

      this.io.on('connection', (socket) => {
        this.handleConnection(socket);
      });

      console.log('📡 Security Monitoring WebSocket server initialized');
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Handle new client connection
   */
  async handleConnection(socket) {
    try {
      const clientId = crypto.randomUUID();
      this.clients.set(clientId, {
        socket,
        connectedAt: new Date(),
        subscriptions: new Set()
      });

      this.metrics.activeConnections++;
      
      socket.on('subscribe', (eventType) => {
        this.handleSubscription(clientId, eventType);
      });

      socket.on('disconnect', () => {
        this.handleDisconnection(clientId);
      });

      console.log(`📱 Client connected: ${clientId}`);
    } catch (error) {
      console.error('Failed to handle connection:', error);
    }
  }

  /**
   * Handle client subscription
   */
  handleSubscription(clientId, eventType) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.add(eventType);
      console.log(`📻 Client ${clientId} subscribed to ${eventType}`);
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(clientId) {
    this.clients.delete(clientId);
    this.metrics.activeConnections--;
    console.log(`📱 Client disconnected: ${clientId}`);
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const securityEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: event.type,
        level: event.level || this.alertLevels.INFO,
        source: event.source,
        details: event.details || {},
        clientIp: event.clientIp,
        userAgent: event.userAgent,
        sessionId: event.sessionId,
        userId: event.userId
      };

      // Store in database
      const context = {
        serviceId: 'security-monitoring-service',
        operation: 'log-security-event',
        practiceId: 'global'
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      await SecureDataAccess.create('security_monitoring_events', securityEvent, context);

      // Update metrics
      this.metrics.totalEvents++;
      const currentCount = this.metrics.eventsByType.get(event.type) || 0;
      this.metrics.eventsByType.set(event.type, currentCount + 1);

      // Check for violation patterns
      await this.checkViolationPatterns(securityEvent);

      // Broadcast to subscribers
      this.broadcastEvent(securityEvent);

      console.log(`🔍 Security event logged: ${event.type} [${event.level}]`);
      return securityEvent.id;
    } catch (error) {
      console.error('Failed to log security event:', error);
      throw error;
    }
  }

  /**
   * Check for violation patterns and auto-blocking
   */
  async checkViolationPatterns(event) {
    const entityKey = event.clientIp || event.userId || event.source;
    if (!entityKey) return;

    const violations = this.violationTracking.get(entityKey) || {
      count: 0,
      firstViolation: new Date(),
      lastViolation: new Date(),
      types: new Set()
    };

    violations.count++;
    violations.lastViolation = new Date();
    violations.types.add(event.type);

    this.violationTracking.set(entityKey, violations);

    // Check for auto-blocking threshold
    const blockingThreshold = 10; // Configurable
    if (violations.count >= blockingThreshold) {
      await this.blockEntity(entityKey, 'Auto-blocked for repeated violations');
    }
  }

  /**
   * Block an entity
   */
  async blockEntity(entityKey, reason) {
    try {
      this.blockedEntities.add(entityKey);
      this.metrics.blockedEntities++;

      const blockEvent = {
        entityKey,
        reason,
        timestamp: new Date(),
        blockedBy: 'system-auto'
      };

      const context = {
        serviceId: 'security-monitoring-service',
        operation: 'block-entity',
        practiceId: 'global'
      };

      const SecureDataAccess = proxy.getService('secureDataAccess');
      await SecureDataAccess.create('security_blocked_entities', blockEvent, context);

      console.log(`🚫 Entity blocked: ${entityKey} (${reason})`);
      
      // Emit blocking event
      this.emit('entityBlocked', blockEvent);
    } catch (error) {
      console.error('Failed to block entity:', error);
    }
  }

  /**
   * Broadcast event to subscribers
   */
  broadcastEvent(event) {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.subscriptions.has(event.type) || client.subscriptions.has('*')) {
        client.socket.emit('securityEvent', event);
      }
    }
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats() {
    return {
      ...this.metrics,
      eventsByType: Object.fromEntries(this.metrics.eventsByType),
      connectedClients: this.clients.size,
      violationTracking: this.violationTracking.size,
      blockedEntities: Array.from(this.blockedEntities),
      suspendedServices: Array.from(this.suspendedServices),
      initialized: this.initialized
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      webSocketActive: !!this.io,
      activeConnections: this.metrics.activeConnections,
      totalEvents: this.metrics.totalEvents,
      blockedEntities: this.metrics.blockedEntities,
      initialized: this.initialized,
      timestamp: new Date()
    };
  }
}

// Export singleton instance
const securityMonitoringServiceInstance = new SecurityMonitoringService();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('securityMonitoringService', () => securityMonitoringServiceInstance);
}

module.exports = securityMonitoringServiceInstance;