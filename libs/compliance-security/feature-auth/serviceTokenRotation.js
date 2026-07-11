const crypto = require('crypto');
const AuditLog = require('../../../backend/models/AuditLog');

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class ServiceTokenRotation {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.tokenRotationInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.rotationSchedule = new Map();
    this.activeRotations = new Set();
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('service-token-rotation');
      this.initialized = true;
      return this;
    } catch (error) {
      console.error('Failed to initialize ServiceTokenRotation:', error);
      throw error;
    }
  }

  async scheduleTokenRotation(serviceId, interval = null) {
    await this.initialize();
    
    const rotationInterval = interval || this.tokenRotationInterval;
    const nextRotation = Date.now() + rotationInterval;
    
    this.rotationSchedule.set(serviceId, {
      serviceId,
      nextRotation,
      interval: rotationInterval,
      scheduledAt: new Date()
    });

    console.log(`🔐 Scheduled token rotation for ${serviceId} at ${new Date(nextRotation).toISOString()}`);
    
    return {
      success: true,
      serviceId,
      nextRotation: new Date(nextRotation),
      interval: rotationInterval
    };
  }

  async rotateServiceToken(serviceId, options = {}) {
    await this.initialize();
    
    if (this.activeRotations.has(serviceId)) {
      return {
        success: false,
        error: 'Token rotation already in progress',
        serviceId
      };
    }

    this.activeRotations.add(serviceId);

    try {
      console.log(`🔄 Rotating token for service: ${serviceId}`);
      
      // Generate new token
      const newToken = this.generateSecureToken();
      
      // Get current token for backup
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      const currentAccount = await serviceAccountManager.getServiceAccount(serviceId);
      const oldTokenId = currentAccount?.apiKey?.substring(0, 8) || 'unknown';
      
      // Update service account with new token
      const updateResult = await serviceAccountManager.updateCredentials(serviceId, {
        apiKey: newToken,
        rotatedAt: new Date(),
        rotationType: options.rotationType || 'scheduled'
      });

      if (!updateResult.success) {
        throw new Error(`Failed to update service token: ${updateResult.error}`);
      }

      // Log the rotation
      await AuditLog.create({
        action: 'SERVICE_TOKEN_ROTATION',
        resourceType: 'service_token',
        resourceId: serviceId,
        details: {
          oldTokenId: oldTokenId + '...',
          newTokenId: newToken.substring(0, 8) + '...',
          rotationType: options.rotationType || 'scheduled'
        },
        userId: 'system',
        practiceId: 'global',
        timestamp: new Date()
      });

      // Update rotation schedule
      if (this.rotationSchedule.has(serviceId)) {
        const schedule = this.rotationSchedule.get(serviceId);
        schedule.nextRotation = Date.now() + schedule.interval;
        schedule.lastRotation = new Date();
      }

      console.log(`✅ Successfully rotated token for ${serviceId}`);
      
      return {
        success: true,
        serviceId,
        newTokenId: newToken.substring(0, 8) + '...',
        rotatedAt: new Date(),
        nextRotation: this.rotationSchedule.get(serviceId)?.nextRotation
      };

    } catch (error) {
      console.error(`❌ Failed to rotate token for ${serviceId}:`, error);
      
      await AuditLog.create({
        action: 'SERVICE_TOKEN_ROTATION_FAILED',
        resourceType: 'service_token',
        resourceId: serviceId,
        details: {
          error: error.message,
          rotationType: options.rotationType || 'scheduled'
        },
        userId: 'system',
        practiceId: 'global',
        timestamp: new Date()
      });

      return {
        success: false,
        serviceId,
        error: error.message
      };
    } finally {
      this.activeRotations.delete(serviceId);
    }
  }

  generateSecureToken() {
    // Generate a cryptographically secure token
    return crypto.randomBytes(32).toString('hex');
  }

  async rotateAllTokens(force = false) {
    await this.initialize();
    
    console.log('🔄 Starting bulk token rotation...');
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    const services = await serviceAccountManager.listServiceAccounts();
    const results = {
      total: services.length,
      success: 0,
      failed: 0,
      errors: []
    };

    for (const service of services) {
      try {
        if (!force) {
          // Check if rotation is due
          const schedule = this.rotationSchedule.get(service.serviceId);
          if (schedule && schedule.nextRotation > Date.now()) {
            continue; // Skip - not due for rotation
          }
        }

        const result = await this.rotateServiceToken(service.serviceId, {
          rotationType: force ? 'manual_bulk' : 'scheduled_bulk'
        });

        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            serviceId: service.serviceId,
            error: result.error
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          serviceId: service.serviceId,
          error: error.message
        });
      }
    }

    console.log(`🔐 Bulk token rotation completed: ${results.success}/${results.total} successful`);
    
    return results;
  }

  async checkRotationSchedules() {
    await this.initialize();
    
    const now = Date.now();
    const dueRotations = [];

    for (const [serviceId, schedule] of this.rotationSchedule) {
      if (schedule.nextRotation <= now) {
        dueRotations.push(serviceId);
      }
    }

    return {
      totalScheduled: this.rotationSchedule.size,
      dueForRotation: dueRotations.length,
      dueServices: dueRotations
    };
  }

  async performScheduledRotations() {
    await this.initialize();
    
    const { dueServices } = await this.checkRotationSchedules();
    
    if (dueServices.length === 0) {
      return {
        success: true,
        message: 'No rotations due',
        rotated: 0
      };
    }

    console.log(`🔄 Performing ${dueServices.length} scheduled token rotations`);
    
    const results = {
      total: dueServices.length,
      success: 0,
      failed: 0,
      errors: []
    };

    for (const serviceId of dueServices) {
      try {
        const result = await this.rotateServiceToken(serviceId, {
          rotationType: 'scheduled'
        });

        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            serviceId,
            error: result.error
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          serviceId,
          error: error.message
        });
      }
    }

    return results;
  }

  getRotationStatus() {
    const status = {
      totalScheduled: this.rotationSchedule.size,
      activeRotations: this.activeRotations.size,
      schedules: {},
      rotationInterval: this.tokenRotationInterval
    };

    for (const [serviceId, schedule] of this.rotationSchedule) {
      status.schedules[serviceId] = {
        nextRotation: new Date(schedule.nextRotation).toISOString(),
        interval: schedule.interval,
        lastRotation: schedule.lastRotation?.toISOString() || null
      };
    }

    return status;
  }

  async unscheduleRotation(serviceId) {
    await this.initialize();
    
    const removed = this.rotationSchedule.delete(serviceId);
    
    return {
      success: removed,
      serviceId,
      message: removed ? 'Rotation unscheduled' : 'No rotation scheduled'
    };
  }
}

module.exports = new ServiceTokenRotation();