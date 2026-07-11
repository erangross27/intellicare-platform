/**
 * HIPAA Breach Notification Service
 * Handles breach detection, notification, and reporting per HIPAA requirements
 * 24-hour internal notification, 60-day patient notification, HHS reporting
 * SECURITY: All database access through SecureDataAccess
 */

const EventEmitter = require('events');
const crypto = require('crypto');

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class BreachNotificationService extends EventEmitter {
  constructor() {
    super();
    
    this.serviceToken = null;
    this.breachThresholds = {
      minRecordsForMajorBreach: 500,
      suspiciousAccessPatterns: 10,
      failedAuthAttempts: 5,
      dataExportVolume: 1000
    };

    this.notificationTimelines = {
      internal: 24 * 60 * 60 * 1000,
      businessAssociate: 60 * 24 * 60 * 60 * 1000,
      affected: 60 * 24 * 60 * 60 * 1000,
      media: 60 * 24 * 60 * 60 * 1000,
      hhs: 60 * 24 * 60 * 60 * 1000
    };

    this.breachCategories = {
      UNAUTHORIZED_ACCESS: 'unauthorized_access',
      LOST_DEVICE: 'lost_device',
      STOLEN_DEVICE: 'stolen_device',
      IMPROPER_DISPOSAL: 'improper_disposal',
      HACKING_INCIDENT: 'hacking_incident',
      EMPLOYEE_ERROR: 'employee_error',
      THIRD_PARTY_BREACH: 'third_party_breach',
      RANSOMWARE: 'ransomware'
    };

    this.severityLevels = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4
    };
  }

  async initialize() {
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('breach-notification-service');
    this.startBreachMonitoring();
    console.log('🚨 Breach Notification Service initialized with authentication');
    return this;
  }

  getServiceContext(practiceId = 'global', operation = 'breach-notification') {
    return {
      serviceId: 'breach-notification-service',
      operation,
      practiceId
    };
  }

  /**
   * Report a potential breach incident
   */
  async reportBreach(breachData) {
    if (!this.serviceToken) {
      await this.initialize();
    }

    const breach = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      reportedBy: breachData.reportedBy,
      category: breachData.category || this.breachCategories.UNAUTHORIZED_ACCESS,
      description: breachData.description,
      affectedRecords: breachData.affectedRecords || [],
      numberOfAffected: breachData.affectedRecords?.length || 0,
      dataTypes: breachData.dataTypes || [],
      severity: this.calculateSeverity(breachData),
      practiceId: breachData.practiceId,
      status: 'reported',
      notifications: {
        internal: { sent: false, timestamp: null },
        affected: { sent: false, timestamp: null },
        businessAssociate: { sent: false, timestamp: null },
        media: { sent: false, timestamp: null },
        hhs: { sent: false, timestamp: null }
      },
      investigation: {
        started: new Date(),
        completed: null,
        findings: [],
        rootCause: null,
        remediation: []
      }
    };

    // Store breach report
    await this.storeBreach(breach);

    // Start notification cascade
    await this.initiateNotificationProcess(breach);

    // Log to immutable audit
    await this.logToAudit(breach);

    return breach;
  }

  /**
   * Calculate breach severity based on multiple factors
   */
  calculateSeverity(breachData) {
    const { affectedRecords = [], dataTypes = [] } = breachData;
    const count = affectedRecords.length;

    // Critical if > 500 records
    if (count >= this.breachThresholds.minRecordsForMajorBreach) {
      return this.severityLevels.CRITICAL;
    }

    // Check for sensitive data types
    const hasSensitiveData = dataTypes.some(type => 
      ['ssn', 'financial', 'diagnosis', 'mental_health', 'substance_abuse']
        .includes(type.toLowerCase())
    );

    if (hasSensitiveData) {
      if (count > 100) return this.severityLevels.CRITICAL;
      if (count > 10) return this.severityLevels.HIGH;
      return this.severityLevels.MEDIUM;
    }

    // Standard PHI breach
    if (count > 100) return this.severityLevels.HIGH;
    if (count > 10) return this.severityLevels.MEDIUM;
    return this.severityLevels.LOW;
  }

  /**
   * Initiate the notification cascade per HIPAA requirements
   */
  async initiateNotificationProcess(breach) {
    // IMMEDIATE: Internal notification (24-hour rule)
    if (breach.severity >= this.severityLevels.MEDIUM) {
      await this.sendInternalNotification(breach);
    }

    // Schedule other notifications based on investigation
    this.scheduleNotifications(breach);

    return {
      breachId: breach.id,
      notificationPlan: this.getNotificationPlan(breach)
    };
  }

  /**
   * Send immediate internal notification
   */
  async sendInternalNotification(breach) {
    const recipients = await this.getInternalRecipients(breach.practiceId);
    
    const notification = {
      to: recipients,
      subject: `🚨 URGENT: Data Breach Incident - ${breach.id}`,
      priority: 'high',
      body: this.formatInternalNotification(breach),
      timestamp: new Date()
    };

    try {
      // Create notification record
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      await secureDataAccess.create('breach_notifications', {
        breachId: breach.id,
        type: 'internal',
        recipients: recipients,
        content: notification.body,
        sentAt: new Date(),
        status: 'sent'
      }, this.getServiceContext(breach.practiceId, 'send-internal-notification'));

      // Update breach record
      breach.notifications.internal = {
        sent: true,
        timestamp: new Date(),
        recipients: recipients.length
      };

      await this.updateBreach(breach);

      console.log(`✅ Internal breach notification sent for ${breach.id}`);
    } catch (error) {
      console.error('❌ Failed to send internal notification:', error);
      this.emit('notification_failed', { breach, type: 'internal', error });
    }
  }

  formatInternalNotification(breach) {
    return `
URGENT: Data Breach Incident Report

Breach ID: ${breach.id}
Time: ${breach.timestamp.toISOString()}
Severity: ${Object.keys(this.severityLevels)[breach.severity - 1]}
Category: ${breach.category}

Affected Records: ${breach.numberOfAffected}
Data Types: ${breach.dataTypes.join(', ')}

Description: ${breach.description}

Immediate Actions Required:
1. Begin investigation within 24 hours
2. Preserve all logs and evidence
3. Document all findings
4. Prepare for potential notifications

This is an automated HIPAA breach notification.
`;
  }

  /**
   * Store breach in secure database
   */
  async storeBreach(breach) {
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    await secureDataAccess.create('breach_incidents', breach, 
      this.getServiceContext(breach.practiceId, 'store-breach'));
  }

  /**
   * Update breach record
   */
  async updateBreach(breach) {
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    await secureDataAccess.update('breach_incidents', 
      { id: breach.id }, 
      { $set: breach },
      {},
      this.getServiceContext(breach.practiceId, 'update-breach'));
  }

  /**
   * Log to audit trail
   */
  async logToAudit(breach) {
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    await secureDataAccess.create('audit_logs', {
      action: 'BREACH_REPORTED',
      category: 'security',
      metadata: {
        breachId: breach.id,
        severity: breach.severity,
        numberOfAffected: breach.numberOfAffected
      },
      timestamp: new Date(),
      practiceId: breach.practiceId
    }, this.getServiceContext(breach.practiceId, 'log-breach-audit'));
  }

  /**
   * Get internal notification recipients
   */
  async getInternalRecipients(practiceId) {
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    const securityOfficers = await secureDataAccess.query('users', {
      practiceId,
      roles: { $in: ['security_officer', 'hipaa_officer', 'admin'] },
      active: true
    }, {}, this.getServiceContext(practiceId, 'get-internal-recipients'));

    return securityOfficers.map(user => user.email).filter(Boolean);
  }

  /**
   * Get notification plan for breach
   */
  getNotificationPlan(breach) {
    const plan = [];

    if (breach.severity >= this.severityLevels.MEDIUM) {
      plan.push({ type: 'internal', deadline: 'immediate', required: true });
    }

    if (breach.numberOfAffected > 0) {
      plan.push({ type: 'affected_individuals', deadline: '60_days', required: true });
    }

    if (breach.numberOfAffected >= this.breachThresholds.minRecordsForMajorBreach) {
      plan.push({ type: 'media', deadline: '60_days', required: true });
      plan.push({ type: 'hhs', deadline: '60_days', required: true });
    }

    return plan;
  }

  /**
   * Schedule future notifications
   */
  scheduleNotifications(breach) {
    // Implementation would schedule notifications based on timelines
    // This is a placeholder for the notification scheduling logic
    console.log(`Scheduling notifications for breach ${breach.id}`);
  }

  /**
   * Start monitoring for potential breaches
   */
  startBreachMonitoring() {
    // Implementation would set up monitoring systems
    // This is a placeholder for breach detection logic
    console.log('Breach monitoring started');
  }
}

// Create singleton instance
const breachNotificationService = new BreachNotificationService();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('breachNotificationService', () => breachNotificationService);
}

module.exports = breachNotificationService;