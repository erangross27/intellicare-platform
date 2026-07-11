// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class ServiceRegistry {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.services = new Map();
    this.serviceInstances = new Map();
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('service-registry');
      this.initialized = true;
      return this;
    } catch (error) {
      console.error('Failed to initialize ServiceRegistry:', error);
      throw error;
    }
  }

  async registerService(serviceConfig) {
    await this.initialize();
    
    const {
      serviceName,
      serviceId = serviceName,
      version = '1.0.0',
      endpoint,
      healthCheckPath = '/health',
      metadata = {}
    } = serviceConfig;

    const service = {
      serviceName,
      serviceId,
      version,
      endpoint,
      healthCheckPath,
      metadata,
      registeredAt: new Date(),
      status: 'active',
      instances: []
    };

    this.services.set(serviceId, service);

    console.log(`📋 Registered service: ${serviceId}`);
    
    return {
      success: true,
      serviceId,
      service
    };
  }

  async unregisterService(serviceId) {
    await this.initialize();
    
    const removed = this.services.delete(serviceId);
    
    // Remove all instances
    for (const [instanceId, instance] of this.serviceInstances) {
      if (instance.serviceId === serviceId) {
        this.serviceInstances.delete(instanceId);
      }
    }

    console.log(`📋 Unregistered service: ${serviceId}`);
    
    return {
      success: removed,
      serviceId
    };
  }

  async registerServiceInstance(instanceConfig) {
    await this.initialize();
    
    const {
      serviceId,
      instanceId,
      host,
      port,
      endpoint,
      metadata = {}
    } = instanceConfig;

    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found in registry`);
    }

    const instance = {
      instanceId,
      serviceId,
      host,
      port,
      endpoint: endpoint || `http://${host}:${port}`,
      metadata,
      registeredAt: new Date(),
      status: 'healthy',
      lastHeartbeat: new Date()
    };

    this.serviceInstances.set(instanceId, instance);
    service.instances.push(instanceId);

    console.log(`📋 Registered instance: ${instanceId} for service: ${serviceId}`);
    
    return {
      success: true,
      instanceId,
      instance
    };
  }

  async unregisterServiceInstance(instanceId) {
    await this.initialize();
    
    const instance = this.serviceInstances.get(instanceId);
    if (!instance) {
      return { success: false, error: 'Instance not found' };
    }

    const serviceId = instance.serviceId;
    const service = this.services.get(serviceId);
    if (service) {
      const index = service.instances.indexOf(instanceId);
      if (index > -1) {
        service.instances.splice(index, 1);
      }
    }

    this.serviceInstances.delete(instanceId);

    console.log(`📋 Unregistered instance: ${instanceId}`);
    
    return {
      success: true,
      instanceId
    };
  }

  async discoverServices(criteria = {}) {
    await this.initialize();
    
    let services = Array.from(this.services.values());

    // Apply filters
    if (criteria.serviceName) {
      services = services.filter(s => s.serviceName === criteria.serviceName);
    }

    if (criteria.version) {
      services = services.filter(s => s.version === criteria.version);
    }

    if (criteria.status) {
      services = services.filter(s => s.status === criteria.status);
    }

    // Include instance information
    const servicesWithInstances = services.map(service => ({
      ...service,
      instances: service.instances.map(instanceId => 
        this.serviceInstances.get(instanceId)
      ).filter(Boolean)
    }));

    return {
      success: true,
      count: servicesWithInstances.length,
      services: servicesWithInstances
    };
  }

  async getService(serviceId) {
    await this.initialize();
    
    const service = this.services.get(serviceId);
    if (!service) {
      return { success: false, error: 'Service not found' };
    }

    const instances = service.instances.map(instanceId => 
      this.serviceInstances.get(instanceId)
    ).filter(Boolean);

    return {
      success: true,
      service: {
        ...service,
        instances
      }
    };
  }

  async updateServiceHeartbeat(instanceId) {
    await this.initialize();
    
    const instance = this.serviceInstances.get(instanceId);
    if (!instance) {
      return { success: false, error: 'Instance not found' };
    }

    instance.lastHeartbeat = new Date();
    instance.status = 'healthy';

    return {
      success: true,
      instanceId,
      lastHeartbeat: instance.lastHeartbeat
    };
  }

  async getRegistryStatus() {
    await this.initialize();
    
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    let healthyInstances = 0;
    let staleInstances = 0;

    for (const instance of this.serviceInstances.values()) {
      const timeSinceHeartbeat = now - instance.lastHeartbeat;
      if (timeSinceHeartbeat > staleThreshold) {
        staleInstances++;
        instance.status = 'stale';
      } else {
        healthyInstances++;
      }
    }

    return {
      totalServices: this.services.size,
      totalInstances: this.serviceInstances.size,
      healthyInstances,
      staleInstances,
      lastUpdated: new Date()
    };
  }

  async cleanupStaleInstances() {
    await this.initialize();
    
    const now = new Date();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    const staleInstances = [];

    for (const [instanceId, instance] of this.serviceInstances) {
      const timeSinceHeartbeat = now - instance.lastHeartbeat;
      if (timeSinceHeartbeat > staleThreshold) {
        staleInstances.push(instanceId);
      }
    }

    for (const instanceId of staleInstances) {
      await this.unregisterServiceInstance(instanceId);
    }

    return {
      success: true,
      cleanedUp: staleInstances.length,
      instances: staleInstances
    };
  }
}

module.exports = new ServiceRegistry();