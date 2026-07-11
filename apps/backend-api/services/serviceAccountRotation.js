/**
 * Automatic Service Account Key Rotation
 * Bulletproof security through automatic credential rotation
 */

const crypto = require('crypto');
const serviceAccountManager = require('./serviceAccountManager');
const immutableAuditService = require('./immutableAuditService');

class ServiceAccountRotation {
  constructor() {
    this.rotationInterval = 30 * 24 * 60 * 60 * 1000; // 30 days default
    this.emergencyRotationInterval = 60 * 60 * 1000; // 1 hour for emergency
    this.rotationSchedule = new Map();
    this.rotationHistory = new Map();
    this.isRotating = false;
    this.rotationCheckInterval = null;
  }

  async initialize() {
    if (!this.serviceToken) {
      this.serviceToken = await serviceAccountManager.authenticate('service-account-rotation');
    }
    
    // Initialize rotation schedules for existing services
    await this.initializeRotationSchedules();
    
    return this;
  }

  /**
   * Initialize rotation schedules for all registered services
   */
  async initializeRotationSchedules() {
    try {
      const accounts = await serviceAccountManager.listServiceAccounts();
      const now = Date.now();
      
      for (const account of accounts) {
        // Only initialize if not already set
        if (!this.rotationSchedule.has(account.serviceId)) {
          // If service has been authenticated, use that time as basis
          if (account.lastAccess) {
            const authTime = new Date(account.lastAccess).getTime();
            this.rotationSchedule.set(account.serviceId, authTime);
          } else {
            // New service - set current time to prevent immediate rotation
            this.rotationSchedule.set(account.serviceId, now);
          }
        }
      }
    } catch (error) {
      console.error('Error initializing rotation schedules:', error);
    }
  }

  /**
   * Start automatic rotation
   */
  startRotation() {
    // Service account rotation schedule started
    
    // Check every hour for accounts needing rotation
    this.rotationCheckInterval = setInterval(() => {
      this.checkRotations();
    }, 60 * 60 * 1000); // Every hour
    
    // Initial check
    this.checkRotations();
  }

  /**
   * Stop rotation schedule
   */
  stopRotation() {
    if (this.rotationCheckInterval) {
      clearInterval(this.rotationCheckInterval);
      this.rotationCheckInterval = null;
      console.log('🛑 Service account rotation stopped');
    }
  }

  /**
   * Check which accounts need rotation
   */
  async checkRotations() {
    if (this.isRotating) {
      console.log('⏳ Rotation already in progress, skipping check');
      return;
    }

    this.isRotating = true;
    // Checking service accounts for rotation

    try {
      const accounts = await serviceAccountManager.listServiceAccounts();
      
      if (!accounts || accounts.length === 0) {
        console.log('📭 No service accounts found for rotation');
        return;
      }

      let rotationCount = 0;
      const now = Date.now();

      for (const account of accounts) {
        // Skip rotation for services that have never been authenticated
        if (!account.lastAccess) {
          // Silently skip - service hasn't been used yet
          continue;
        }

        // Skip revoked services
        if (account.revoked) {
          // Silently skip revoked services
          continue;
        }

        const lastRotation = this.getLastRotation(account.serviceId);
        const timeSinceRotation = now - lastRotation;
        const rotationDue = timeSinceRotation > this.getRotationInterval(account);

        if (rotationDue) {
          console.log(`🔄 Rotation due for ${account.serviceId} (last: ${new Date(lastRotation).toISOString()})`);
          await this.rotateAccount(account);
          rotationCount++;
        }
        // Service is up to date - no need to log
      }

      if (rotationCount > 0) {
        console.log(`✅ Rotated ${rotationCount} service account(s)`);
      }
      // Silent when nothing to rotate
    } catch (error) {
      console.error('❌ Error checking rotations:', error);
      await this.logRotationError('check_rotations', error);
    } finally {
      this.isRotating = false;
    }
  }

  /**
   * Get rotation interval for account
   */
  getRotationInterval(account) {
    // Critical services rotate more frequently
    if (account.criticality === 'critical') {
      return 7 * 24 * 60 * 60 * 1000; // 7 days
    }
    if (account.criticality === 'high') {
      return 14 * 24 * 60 * 60 * 1000; // 14 days
    }
    return this.rotationInterval; // Default 30 days
  }

  /**
   * Get last rotation time
   */
  getLastRotation(accountId) {
    const history = this.rotationHistory.get(accountId);
    if (history && history.length > 0) {
      return history[history.length - 1].timestamp;
    }
    
    // Check if we have a schedule entry (service was initialized)
    const scheduledTime = this.rotationSchedule.get(accountId);
    if (scheduledTime) {
      return scheduledTime;
    }
    
    // For new services without history, initialize them as "recently rotated"
    // This prevents immediate rotation warnings for newly loaded services
    const now = Date.now();
    this.rotationSchedule.set(accountId, now);
    return now;
  }

  /**
   * Rotate service account credentials
   */
  async rotateAccount(account) {
    console.log(`🔄 Rotating credentials for ${account.serviceId}`);
    
    try {
      // Generate new credentials
      const newCredentials = this.generateNewCredentials();
      
      // Store old credentials for rollback
      const oldCredentials = await this.backupCredentials(account.serviceId);
      
      // Update account with new credentials
      const updateResult = await serviceAccountManager.updateCredentials(
        account.serviceId, 
        newCredentials
      );

      if (!updateResult.success) {
        throw new Error(`Failed to update credentials: ${updateResult.error}`);
      }
      
      // Log rotation in immutable audit
      try {
        if (immutableAuditService && typeof immutableAuditService.logServiceOperation === 'function') {
          await immutableAuditService.logServiceOperation({
            serviceId: 'rotation-service',
            operation: 'rotate_credentials',
            practiceId: 'global',
            accountId: account.serviceId,
            success: true,
            metadata: {
              oldKeyId: oldCredentials?.apiKey?.substring(0, 8) + '...',
              newKeyId: newCredentials.apiKey.substring(0, 8) + '...',
              rotationType: 'scheduled'
            }
          });
        }
      } catch (auditError) {
        console.error('Warning: Failed to log service operation:', auditError.message);
      }
      
      // Update rotation tracking
      const rotationTimestamp = Date.now();
      this.updateRotationHistory(account.serviceId, {
        timestamp: rotationTimestamp,
        oldKeyId: oldCredentials?.apiKey?.substring(0, 8),
        newKeyId: newCredentials.apiKey.substring(0, 8),
        success: true,
        rotationType: 'scheduled'
      });
      
      // Update schedule with successful rotation time
      this.rotationSchedule.set(account.serviceId, rotationTimestamp);
      
      console.log(`📅 Updated rotation schedule for ${account.serviceId} to ${new Date(rotationTimestamp).toISOString()}`);
      
      // Notify service (would trigger re-authentication)
      await this.notifyService(account.serviceId, newCredentials);
      
      console.log(`✅ Successfully rotated ${account.serviceId}`);
      
    } catch (error) {
      console.error(`❌ Failed to rotate ${account.serviceId}:`, error);
      
      // Log failure
      try {
        if (immutableAuditService && typeof immutableAuditService.logSecurityIncident === 'function') {
          await immutableAuditService.logSecurityIncident({
            type: 'rotation_failed',
            severity: 'medium',
            details: {
              accountId: account.serviceId,
              error: error.message,
              timestamp: new Date()
            }
          });
        }
      } catch (auditError) {
        console.error('Warning: Failed to log security incident:', auditError.message);
      }

      // Update history with failure
      this.updateRotationHistory(account.serviceId, {
        timestamp: Date.now(),
        success: false,
        error: error.message,
        rotationType: 'scheduled'
      });
      
      // Don't update schedule on failure - will retry next time
      
      throw error;
    }
  }

  /**
   * Generate new credentials
   */
  generateNewCredentials() {
    return {
      apiKey: crypto.randomBytes(32).toString('hex'),
      secret: crypto.randomBytes(64).toString('hex'),
      rotatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.rotationInterval).toISOString()
    };
  }

  /**
   * Backup current credentials before rotation
   */
  async backupCredentials(accountId) {
    try {
      const account = await serviceAccountManager.getServiceAccount(accountId);
      if (account && account.credentials) {
        // Store encrypted backup
        return {
          apiKey: account.credentials.apiKey,
          backedUpAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error(`Warning: Could not backup credentials for ${accountId}`);
    }
    return null;
  }

  /**
   * Update rotation history
   */
  updateRotationHistory(accountId, entry) {
    if (!this.rotationHistory.has(accountId)) {
      this.rotationHistory.set(accountId, []);
    }
    
    const history = this.rotationHistory.get(accountId);
    history.push(entry);
    
    // Keep only last 10 entries
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * Notify service of new credentials
   */
  async notifyService(serviceId, newCredentials) {
    // In production, this would:
    // 1. Send secure notification to service
    // 2. Use message queue for reliability
    // 3. Track acknowledgment
    
    console.log(`📧 Notifying ${serviceId} of credential rotation`);
    
    // Emit event for any listeners
    const securityMonitoringService = require('./securityMonitoringService');
    securityMonitoringService.emitSecurityEvent(
      'SERVICE_ROTATION',
      {
        serviceId,
        action: 'credentials_rotated',
        timestamp: Date.now()
      },
      'info'
    );
  }

  /**
   * Emergency rotation for all accounts
   */
  async emergencyRotation(reason = 'Security incident') {
    console.log('🚨 EMERGENCY ROTATION INITIATED');
    console.log(`   Reason: ${reason}`);
    
    try {
      const accounts = await serviceAccountManager.listServiceAccounts();
      const results = {
        total: accounts.length,
        success: 0,
        failed: 0,
        errors: []
      };

      // Log emergency rotation start
      try {
        if (immutableAuditService && typeof immutableAuditService.logSecurityIncident === 'function') {
          await immutableAuditService.logSecurityIncident({
            type: 'emergency_rotation_started',
            severity: 'critical',
            details: {
              reason,
              accountCount: accounts.length,
              timestamp: new Date()
            }
          });
        }
      } catch (auditError) {
        console.error('Warning: Failed to log emergency rotation start:', auditError.message);
      }

      // Rotate all accounts
      for (const account of accounts) {
        try {
          await this.rotateAccount(account);
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            accountId: account.serviceId,
            error: error.message
          });
        }
      }

      // Log completion
      try {
        if (immutableAuditService && typeof immutableAuditService.logSecurityIncident === 'function') {
          await immutableAuditService.logSecurityIncident({
            type: 'emergency_rotation_completed',
            severity: 'high',
            details: {
              reason,
              results,
              timestamp: new Date()
            }
          });
        }
      } catch (auditError) {
        console.error('Warning: Failed to log emergency rotation completion:', auditError.message);
      }

      console.log(`🔒 Emergency rotation complete: ${results.success}/${results.total} successful`);
      
      return results;
    } catch (error) {
      console.error('❌ Emergency rotation failed:', error);
      throw error;
    }
  }

  /**
   * Force rotation for specific account
   */
  async forceRotation(accountId, reason = 'Manual rotation') {
    console.log(`🔄 Force rotating ${accountId}: ${reason}`);
    
    try {
      const account = await serviceAccountManager.getServiceAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      await this.rotateAccount(account);
      
      // Log forced rotation
      try {
        if (immutableAuditService && typeof immutableAuditService.addAuditEntry === 'function') {
          await immutableAuditService.addAuditEntry({
            eventType: 'forced_rotation',
            userId: 'system',
            details: {
              accountId,
              reason
            },
            timestamp: new Date()
          });
        }
      } catch (auditError) {
        console.error('Warning: Failed to log forced rotation:', auditError.message);
      }

      return { success: true, accountId };
    } catch (error) {
      console.error(`Failed to force rotate ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get rotation status
   */
  getRotationStatus() {
    const status = {
      active: this.rotationCheckInterval !== null,
      isRotating: this.isRotating,
      interval: this.rotationInterval,
      emergencyInterval: this.emergencyRotationInterval,
      schedule: {},
      history: {}
    };

    // Add schedule info
    for (const [accountId, lastRotation] of this.rotationSchedule) {
      status.schedule[accountId] = {
        lastRotation: new Date(lastRotation).toISOString(),
        nextRotation: new Date(lastRotation + this.rotationInterval).toISOString()
      };
    }

    // Add recent history
    for (const [accountId, history] of this.rotationHistory) {
      if (history.length > 0) {
        const recent = history[history.length - 1];
        status.history[accountId] = {
          lastRotation: new Date(recent.timestamp).toISOString(),
          success: recent.success,
          rotationCount: history.length
        };
      }
    }

    return status;
  }

  /**
   * Log rotation error
   */
  async logRotationError(operation, error) {
    try {
      if (immutableAuditService && typeof immutableAuditService.logSecurityIncident === 'function') {
        await immutableAuditService.logSecurityIncident({
          type: 'rotation_error',
          severity: 'medium',
          details: {
            operation,
            error: error.message,
            stack: error.stack,
            timestamp: new Date()
          }
        });
      }
    } catch (auditError) {
      console.error('Warning: Failed to log rotation error:', auditError.message);
    }
  }
}

// Export singleton instance
module.exports = new ServiceAccountRotation();