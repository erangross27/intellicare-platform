/**
 * 🚨 EMERGENCY RESPONSE SYSTEM
 * 
 * Critical security component that provides kill switches and lockdown capabilities.
 * When security threats are detected, this system can immediately terminate services
 * and protect the system from further damage.
 */

const immutableAuditService = require('./immutableAuditService');
const securityAlerts = require('./securityAlerts');
const serviceAccountManager = require('./serviceAccountManager');

class EmergencyResponseSystem {
  constructor() {
    this.killSwitches = new Map();
    this.lockdownMode = false;
    this.emergencyContacts = [];
    this.incidentHistory = [];
    this.responseThresholds = {
      violations: 10,      // Number of violations to trigger response
      timeWindow: 300000,  // 5 minutes
      criticalViolations: 3 // Critical violations trigger immediate lockdown
    };
    this.violationTracker = new Map();
  }

  async initialize() {
    if (!this.serviceToken) {
      this.serviceToken = await serviceAccountManager.authenticate('emergency-response');
    }
    return this;
  }

  /**
   * Activate kill switch for a specific service
   */
  async activateKillSwitch(serviceName, reason = 'Security threat detected') {
    console.log(`🚨 KILL SWITCH ACTIVATED: ${serviceName}`);
    console.log(`   Reason: ${reason}`);
    
    this.killSwitches.set(serviceName, {
      activated: true,
      timestamp: Date.now(),
      reason
    });

    // Immediately terminate service if it exists globally
    if (global[serviceName]) {
      try {
        if (typeof global[serviceName].shutdown === 'function') {
          await global[serviceName].shutdown();
        }
        global[serviceName] = null;
      } catch (error) {
        console.error(`Error shutting down ${serviceName}:`, error);
      }
    }

    // Block all future requests to this service
    try {
      const SecureDataAccess = require('./secureDataAccess');
      if (SecureDataAccess.blockService) {
        SecureDataAccess.blockService(serviceName);
      }
    } catch (e) {
      // SecureDataAccess might not have blockService yet
    }

    // Log critical event
    try {
      await immutableAuditService.logCriticalEvent({
        type: 'KILL_SWITCH_ACTIVATED',
        service: serviceName,
        reason,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('Failed to log kill switch activation:', e);
    }

    // Alert administrators
    this.alertAdministrators({
      type: 'KILL_SWITCH',
      service: serviceName,
      reason,
      severity: 'CRITICAL'
    });

    return true;
  }

  /**
   * Initiate system-wide lockdown
   */
  async systemLockdown(reason = 'Multiple security violations detected') {
    if (this.lockdownMode) {
      return { status: 'ALREADY_IN_LOCKDOWN' };
    }

    this.lockdownMode = true;
    console.log('🔒 SYSTEM LOCKDOWN INITIATED');
    console.log(`   Reason: ${reason}`);

    // Stop all non-essential services
    const nonEssentialServices = [
      'reminderService',
      'batchWorker',
      'aiAgent',
      'documentAnalysis',
      'appointmentScheduler',
      'notificationService'
    ];

    const terminatedServices = [];
    for (const service of nonEssentialServices) {
      try {
        await this.activateKillSwitch(service, 'System lockdown');
        terminatedServices.push(service);
      } catch (error) {
        console.error(`Failed to kill ${service}:`, error);
      }
    }

    // Set system to read-only mode
    try {
      const SecureDataAccess = require('./secureDataAccess');
      if (SecureDataAccess.setReadOnlyMode) {
        SecureDataAccess.setReadOnlyMode(true);
      }
    } catch (e) {
      console.error('Failed to set read-only mode:', e);
    }

    // Record incident
    this.incidentHistory.push({
      type: 'SYSTEM_LOCKDOWN',
      timestamp: Date.now(),
      reason,
      servicesTerminated: terminatedServices
    });

    // Alert all administrators
    this.alertAdministrators({
      type: 'SYSTEM_LOCKDOWN',
      reason,
      servicesTerminated: terminatedServices,
      severity: 'CRITICAL'
    });

    return { 
      status: 'LOCKDOWN_ACTIVE', 
      services_terminated: terminatedServices.length,
      reason 
    };
  }

  /**
   * Check if a service is blocked
   */
  isServiceBlocked(serviceName) {
    if (this.lockdownMode) return true;
    
    const killSwitch = this.killSwitches.get(serviceName);
    return killSwitch && killSwitch.activated;
  }

  /**
   * Track security violations and trigger responses
   */
  async trackViolation(violation) {
    const { type, severity, source, details } = violation;
    const now = Date.now();

    // Initialize tracker for this source
    if (!this.violationTracker.has(source)) {
      this.violationTracker.set(source, []);
    }

    const violations = this.violationTracker.get(source);
    violations.push({
      type,
      severity,
      timestamp: now,
      details
    });

    // Remove old violations outside time window
    const cutoff = now - this.responseThresholds.timeWindow;
    const recentViolations = violations.filter(v => v.timestamp > cutoff);
    this.violationTracker.set(source, recentViolations);

    // Check for critical violations
    const criticalCount = recentViolations.filter(v => v.severity === 'critical').length;
    if (criticalCount >= this.responseThresholds.criticalViolations) {
      console.log(`🚨 CRITICAL THRESHOLD REACHED: ${source}`);
      await this.systemLockdown(`Critical violations from ${source}`);
      return 'LOCKDOWN';
    }

    // Check for total violations
    if (recentViolations.length >= this.responseThresholds.violations) {
      console.log(`⚠️ VIOLATION THRESHOLD REACHED: ${source}`);
      await this.activateKillSwitch(source, 'Too many violations');
      return 'KILL_SWITCH';
    }

    return 'MONITORED';
  }

  /**
   * Handle mass deletion attempts
   */
  async handleMassDeletion(details) {
    console.log('🚨 MASS DELETION ATTEMPT DETECTED');
    
    // Immediate lockdown for mass deletion
    await this.systemLockdown('Mass deletion attempt detected');
    
    // Log the attempt
    await immutableAuditService.logCriticalEvent({
      type: 'MASS_DELETION_BLOCKED',
      details,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Handle rapid violation accumulation
   */
  async handleRapidViolations(source, count) {
    console.log(`🚨 RAPID VIOLATIONS DETECTED: ${count} from ${source}`);
    
    if (count > 20) {
      // System lockdown for extreme violation rate
      await this.systemLockdown(`Rapid violations (${count}) from ${source}`);
      return 'LOCKDOWN';
    } else if (count > 10) {
      // Kill the offending service
      await this.activateKillSwitch(source, `Rapid violations (${count})`);
      return 'KILL_SWITCH';
    }
    
    return 'ALERT';
  }

  /**
   * Handle critical service attacks
   */
  async handleCriticalServiceAttack(service, attackType) {
    console.log(`🚨 CRITICAL SERVICE ATTACK: ${service} - ${attackType}`);
    
    // Immediate response for critical services
    const criticalServices = ['authenticationService', 'secureDataAccess', 'auditService'];
    
    if (criticalServices.includes(service)) {
      // System-wide lockdown for critical service attacks
      await this.systemLockdown(`Attack on critical service: ${service}`);
      return 'IMMEDIATE_LOCKDOWN';
    } else {
      // Kill the targeted service
      await this.activateKillSwitch(service, `Under attack: ${attackType}`);
      return 'SERVICE_TERMINATED';
    }
  }

  /**
   * Alert administrators
   */
  alertAdministrators(alert) {
    console.error('🚨 ADMIN ALERT:', alert);
    
    // In production, this would:
    // 1. Send SMS/email to admins
    // 2. Trigger pager duty
    // 3. Post to security channel
    // 4. Create incident ticket
    
    // Store alert
    securityAlerts.createAlert({
      ...alert,
      timestamp: Date.now(),
      acknowledged: false
    });
  }

  /**
   * Release lockdown (admin only)
   */
  async releaseLockdown(adminToken, reason) {
    // Verify admin token
    if (!this.verifyAdminToken(adminToken)) {
      throw new Error('Unauthorized lockdown release attempt');
    }

    console.log('🔓 RELEASING SYSTEM LOCKDOWN');
    this.lockdownMode = false;

    // Clear kill switches
    this.killSwitches.clear();

    // Restore write mode
    try {
      const SecureDataAccess = require('./secureDataAccess');
      if (SecureDataAccess.setReadOnlyMode) {
        SecureDataAccess.setReadOnlyMode(false);
      }
    } catch (e) {
      console.error('Failed to restore write mode:', e);
    }

    // Log the release
    await immutableAuditService.logCriticalEvent({
      type: 'LOCKDOWN_RELEASED',
      reason,
      timestamp: Date.now()
    });

    return { status: 'LOCKDOWN_RELEASED' };
  }

  /**
   * Verify admin token (simplified)
   */
  verifyAdminToken(token) {
    // In production, verify against secure admin token store
    return token && token.startsWith('admin_');
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      lockdownMode: this.lockdownMode,
      activeKillSwitches: Array.from(this.killSwitches.keys()),
      recentIncidents: this.incidentHistory.slice(-10),
      violationCounts: Array.from(this.violationTracker.entries()).map(([source, violations]) => ({
        source,
        count: violations.length,
        critical: violations.filter(v => v.severity === 'critical').length
      }))
    };
  }
}

module.exports = new EmergencyResponseSystem();