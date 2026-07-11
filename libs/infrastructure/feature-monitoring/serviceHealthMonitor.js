// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class ServiceHealthMonitor {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.healthChecks = new Map();
    this.monitoringInterval = null;
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('service-health-monitor');
      this.initialized = true;
      return this;
    } catch (error) {
      console.error('Failed to initialize ServiceHealthMonitor:', error);
      throw error;
    }
  }

  async startMonitoring(interval = 60000) {
    await this.initialize();
    
    if (this.monitoringInterval) {
      console.log('Health monitoring already running');
      return;
    }

    console.log('🩺 Starting service health monitoring');
    
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, interval);

    // Initial health check
    await this.performHealthChecks();
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('🛑 Service health monitoring stopped');
    }
  }

  async performHealthChecks() {
    await this.initialize();
    
    const services = await serviceAccountManager.listServiceAccounts();
    const healthStatus = new Map();

    for (const service of services) {
      try {
        const health = await this.checkServiceHealth(service.serviceId);
        healthStatus.set(service.serviceId, health);
        this.healthChecks.set(service.serviceId, {
          ...health,
          lastChecked: new Date()
        });
      } catch (error) {
        healthStatus.set(service.serviceId, {
          status: 'unhealthy',
          error: error.message,
          lastChecked: new Date()
        });
      }
    }

    return healthStatus;
  }

  async checkServiceHealth(serviceId) {
    // Basic health check - in production would ping actual service
    const account = await serviceAccountManager.getServiceAccount(serviceId);
    
    if (!account) {
      return {
        status: 'not_found',
        message: 'Service account not found'
      };
    }

    if (!account.active) {
      return {
        status: 'inactive',
        message: 'Service account inactive'
      };
    }

    // Simulate health check
    const isHealthy = Math.random() > 0.1; // 90% healthy
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      message: isHealthy ? 'Service operating normally' : 'Service experiencing issues',
      lastAccess: account.lastAccess,
      responseTime: Math.floor(Math.random() * 100) + 10
    };
  }

  getHealthSummary() {
    const summary = {
      totalServices: this.healthChecks.size,
      healthy: 0,
      unhealthy: 0,
      degraded: 0,
      unknown: 0,
      lastUpdated: new Date()
    };

    for (const [serviceId, health] of this.healthChecks) {
      switch (health.status) {
        case 'healthy':
          summary.healthy++;
          break;
        case 'unhealthy':
        case 'not_found':
        case 'inactive':
          summary.unhealthy++;
          break;
        case 'degraded':
          summary.degraded++;
          break;
        default:
          summary.unknown++;
      }
    }

    return summary;
  }

  getServiceHealth(serviceId) {
    return this.healthChecks.get(serviceId) || null;
  }

  getAllHealthChecks() {
    return Object.fromEntries(this.healthChecks);
  }
}

// Create and export singleton
const serviceHealthMonitor = new ServiceHealthMonitor();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('serviceHealthMonitor', () => serviceHealthMonitor);
}

module.exports = serviceHealthMonitor;