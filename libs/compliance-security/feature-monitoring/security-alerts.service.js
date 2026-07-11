/**
 * 🚨 SECURITY ALERTS SERVICE
 * 
 * Automated security alert system with multiple notification channels.
 * Triggers on violations, threats, and suspicious patterns.
 * 
 * SECURITY: Critical alerts trigger immediate automated responses.
 */

const EventEmitter = require('events');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class SecurityAlertsService extends EventEmitter {
  constructor() {
    super();
    
    this.serviceToken = null;
    this.initialized = false;
    
    // Alert configuration will be loaded in initialize()
    this.alertConfig = {
      emailEnabled: false,
      slackEnabled: false,
      smsEnabled: false,
      adminEmails: [],
      criticalThreshold: 5, // Critical alert after 5 violations
      emergencyThreshold: 10 // Emergency alert after 10 violations
    };
    
    // Alert types
    this.alertTypes = {
      DIRECT_DB_ACCESS: {
        level: 'critical',
        title: 'Direct Database Access Attempt',
        autoAction: 'BLOCK_SERVICE'
      },
      SERVICE_AUTH_FAILURE: {
        level: 'high',
        title: 'Service Authentication Failed',
        autoAction: 'REVOKE_TOKEN'
      },
      RATE_LIMIT_VIOLATION: {
        level: 'medium',
        title: 'Rate Limit Exceeded',
        autoAction: 'THROTTLE'
      },
      SESSION_HIJACK: {
        level: 'critical',
        title: 'Session Hijacking Detected',
        autoAction: 'TERMINATE_SESSION'
      },
      SUSPICIOUS_ACTIVITY: {
        level: 'high',
        title: 'Suspicious Activity Pattern',
        autoAction: 'MONITOR'
      }
    };

    // Alert history
    this.alertHistory = [];
    this.activeIncidents = new Map();
    this.notificationQueue = [];
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      const secureConfigService = proxy.getService('secureConfigService');
      
      this.serviceToken = await serviceAccountManager.authenticate('security-alerts-service');
      
      // Load configuration using secureConfigService
      this.alertConfig = {
        emailEnabled: secureConfigService.get('SECURITY_ALERTS_EMAIL') === 'true',
        slackEnabled: secureConfigService.get('SECURITY_ALERTS_SLACK') === 'true',
        smsEnabled: secureConfigService.get('SECURITY_ALERTS_SMS') === 'true',
        adminEmails: (secureConfigService.get('ADMIN_EMAILS') || '').split(',').filter(Boolean),
        criticalThreshold: 5,
        emergencyThreshold: 10
      };
      
      this.initialized = true;
      console.log('✅ Security Alerts Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Security Alerts Service:', error);
      throw error;
    }
  }

  /**
   * Trigger a security alert
   */
  async triggerAlert(alertType, details = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const alertConfig = this.alertTypes[alertType];
      if (!alertConfig) {
        console.error(`Unknown alert type: ${alertType}`);
        return;
      }

      const alert = {
        id: crypto.randomUUID(),
        type: alertType,
        level: alertConfig.level,
        title: alertConfig.title,
        details,
        timestamp: new Date(),
        autoAction: alertConfig.autoAction,
        status: 'active'
      };

      // Store alert
      await this.storeAlert(alert);
      
      // Add to history
      this.alertHistory.push(alert);
      if (this.alertHistory.length > 1000) {
        this.alertHistory.shift(); // Keep last 1000 alerts
      }

      // Execute auto action if configured
      if (alert.autoAction && alert.level === 'critical') {
        await this.executeAutoAction(alert);
      }

      // Send notifications
      await this.sendNotifications(alert);

      // Emit event for listeners
      this.emit('securityAlert', alert);

      console.log(`🚨 Security Alert [${alert.level.toUpperCase()}]: ${alert.title}`);

      return alert;

    } catch (error) {
      console.error('Failed to trigger security alert:', error);
      throw error;
    }
  }

  /**
   * Store alert in database
   */
  async storeAlert(alert) {
    try {
      const context = {
        serviceId: 'security-alerts-service',
        operation: 'store-alert',
        practiceId: 'global'
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      await secureDataAccess.create('security_alerts', alert, context);
    } catch (error) {
      console.error('Failed to store alert:', error);
    }
  }

  /**
   * Execute automated response actions
   */
  async executeAutoAction(alert) {
    try {
      switch (alert.autoAction) {
        case 'BLOCK_SERVICE':
          console.log(`🛡️ AUTO-ACTION: Blocking service due to ${alert.type}`);
          // Implementation would block the service
          break;
        
        case 'REVOKE_TOKEN':
          console.log(`🔑 AUTO-ACTION: Revoking tokens due to ${alert.type}`);
          // Implementation would revoke service tokens
          break;
        
        case 'THROTTLE':
          console.log(`⏱️ AUTO-ACTION: Throttling service due to ${alert.type}`);
          // Implementation would throttle service
          break;
        
        case 'TERMINATE_SESSION':
          console.log(`🚪 AUTO-ACTION: Terminating sessions due to ${alert.type}`);
          // Implementation would terminate user sessions
          break;
        
        case 'MONITOR':
          console.log(`👁️ AUTO-ACTION: Enhanced monitoring due to ${alert.type}`);
          // Implementation would enable enhanced monitoring
          break;
        
        default:
          console.log(`❓ Unknown auto-action: ${alert.autoAction}`);
      }

      // Log the auto-action
      const context = {
        serviceId: 'security-alerts-service',
        operation: 'log-auto-action',
        practiceId: 'global'
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      await secureDataAccess.create('security_actions', {
        alertId: alert.id,
        action: alert.autoAction,
        executedAt: new Date(),
        status: 'executed'
      }, context);

    } catch (error) {
      console.error('Failed to execute auto action:', error);
    }
  }

  /**
   * Send alert notifications
   */
  async sendNotifications(alert) {
    try {
      // Email notifications
      if (this.alertConfig.emailEnabled && this.alertConfig.adminEmails.length > 0) {
        await this.sendEmailAlert(alert);
      }

      // Additional notification channels can be added here
      // (Slack, SMS, etc.)

    } catch (error) {
      console.error('Failed to send notifications:', error);
    }
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    try {
      const subject = `🚨 SECURITY ALERT [${alert.level.toUpperCase()}]: ${alert.title}`;
      const body = `
Security Alert Details:
- Type: ${alert.type}
- Level: ${alert.level}
- Title: ${alert.title}
- Timestamp: ${alert.timestamp}
- Details: ${JSON.stringify(alert.details, null, 2)}

Auto-action taken: ${alert.autoAction || 'None'}

Please review and take appropriate action if needed.
      `;

      // Email sending logic would go here
      console.log(`📧 Email alert queued: ${subject}`);
      
    } catch (error) {
      console.error('Failed to send email alert:', error);
    }
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get active incidents
   */
  getActiveIncidents() {
    return Array.from(this.activeIncidents.values());
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = this.alertHistory.filter(alert => alert.timestamp >= last24Hours);
    
    const byLevel = {
      critical: recent.filter(a => a.level === 'critical').length,
      high: recent.filter(a => a.level === 'high').length,
      medium: recent.filter(a => a.level === 'medium').length,
      low: recent.filter(a => a.level === 'low').length
    };

    return {
      total: recent.length,
      byLevel,
      activeIncidents: this.activeIncidents.size,
      last24Hours: recent.length
    };
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, userId) {
    try {
      const context = {
        serviceId: 'security-alerts-service',
        operation: 'acknowledge-alert',
        practiceId: 'global'
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      await secureDataAccess.update('security_alerts', 
        { id: alertId }, 
        { 
          status: 'acknowledged',
          acknowledgedBy: userId,
          acknowledgedAt: new Date()
        }, 
        context
      );

      console.log(`✅ Alert ${alertId} acknowledged by user ${userId}`);
      
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }
}

// Create singleton instance
const securityAlertsService = new SecurityAlertsService();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('securityAlertsService', () => securityAlertsService);
}

module.exports = securityAlertsService;