// ServiceProxyManager should not have direct service dependencies
// All services will be loaded lazily through this manager

class ServiceProxyManager {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.proxies = new Map();
    this.routingTable = new Map();
    this.services = new Map(); // Registered services
    this.serviceCache = new Map(); // Cached service instances
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      // ServiceProxyManager bootstraps first, authentication comes later
      this.initialized = true;
      console.log('✅ ServiceProxyManager initialized (bootstrap mode)');
      return this;
    } catch (error) {
      console.error('Failed to initialize ServiceProxyManager:', error);
      throw error;
    }
  }

  async createProxy(serviceName, config = {}) {
    await this.initialize();
    
    const proxy = {
      serviceName,
      targetPath: config.targetPath || `./services/${serviceName}`,
      loadBalancing: config.loadBalancing || 'round-robin',
      circuitBreaker: config.circuitBreaker !== false,
      retryPolicy: config.retryPolicy || { maxRetries: 3, backoff: 'exponential' },
      healthCheck: config.healthCheck !== false,
      createdAt: new Date()
    };

    this.proxies.set(serviceName, proxy);
    this.routingTable.set(serviceName, {
      instances: config.instances || [`${serviceName}-1`],
      currentIndex: 0
    });

    return proxy;
  }

  async removeProxy(serviceName) {
    await this.initialize();
    
    const removed = this.proxies.delete(serviceName);
    this.routingTable.delete(serviceName);
    
    return { removed, serviceName };
  }

  async routeRequest(serviceName, method, ...args) {
    await this.initialize();
    
    const proxy = this.proxies.get(serviceName);
    if (!proxy) {
      throw new Error(`No proxy found for service: ${serviceName}`);
    }

    const routing = this.routingTable.get(serviceName);
    const instanceId = this.selectInstance(routing);

    try {
      // Simulate service call routing
      console.log(`📡 Routing ${method} to ${serviceName} via ${instanceId}`);
      
      // In a real proxy, this would make the actual service call
      return {
        success: true,
        serviceName,
        instanceId,
        method,
        args,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Failed to route request to ${serviceName}:`, error);
      throw error;
    }
  }

  selectInstance(routing) {
    // Round-robin load balancing
    const instances = routing.instances;
    const instance = instances[routing.currentIndex];
    routing.currentIndex = (routing.currentIndex + 1) % instances.length;
    return instance;
  }

  async addServiceInstance(serviceName, instanceId) {
    await this.initialize();
    
    const routing = this.routingTable.get(serviceName);
    if (!routing) {
      throw new Error(`No routing table found for service: ${serviceName}`);
    }

    if (!routing.instances.includes(instanceId)) {
      routing.instances.push(instanceId);
    }

    return {
      success: true,
      serviceName,
      instanceId,
      totalInstances: routing.instances.length
    };
  }

  async removeServiceInstance(serviceName, instanceId) {
    await this.initialize();
    
    const routing = this.routingTable.get(serviceName);
    if (!routing) {
      throw new Error(`No routing table found for service: ${serviceName}`);
    }

    const index = routing.instances.indexOf(instanceId);
    if (index > -1) {
      routing.instances.splice(index, 1);
      
      // Reset current index if it's now invalid
      if (routing.currentIndex >= routing.instances.length) {
        routing.currentIndex = 0;
      }
    }

    return {
      success: true,
      serviceName,
      instanceId,
      totalInstances: routing.instances.length
    };
  }

  getProxyStatus() {
    const status = {
      totalProxies: this.proxies.size,
      proxies: {},
      routing: {}
    };

    for (const [serviceName, proxy] of this.proxies) {
      status.proxies[serviceName] = {
        ...proxy,
        status: 'active'
      };
    }

    for (const [serviceName, routing] of this.routingTable) {
      status.routing[serviceName] = {
        instances: routing.instances.length,
        currentInstance: routing.instances[routing.currentIndex] || null
      };
    }

    return status;
  }

  async healthCheckAll() {
    await this.initialize();
    
    const results = {};
    
    for (const [serviceName] of this.proxies) {
      try {
        const health = await this.healthCheckService(serviceName);
        results[serviceName] = health;
      } catch (error) {
        results[serviceName] = {
          healthy: false,
          error: error.message
        };
      }
    }

    return results;
  }

  async healthCheckService(serviceName) {
    const routing = this.routingTable.get(serviceName);
    if (!routing) {
      throw new Error(`No routing found for ${serviceName}`);
    }

    // Simulate health check
    const healthy = Math.random() > 0.1; // 90% success rate
    
    return {
      serviceName,
      healthy,
      instances: routing.instances,
      lastChecked: new Date()
    };
  }

  // Service registration and lazy loading methods
  registerService(serviceName, serviceFactory) {
    this.services.set(serviceName, serviceFactory);
  }

  getService(serviceName) {
    // Check cache first
    if (this.serviceCache.has(serviceName)) {
      return this.serviceCache.get(serviceName);
    }

    // Check if service is registered
    if (this.services.has(serviceName)) {
      const factory = this.services.get(serviceName);
      const service = typeof factory === 'function' ? factory() : factory;
      this.serviceCache.set(serviceName, service);
      return service;
    }

    // Try to require the service directly (fallback for backend services)
    try {
      const servicePath = this.getServicePath(serviceName);
      const service = require(servicePath);
      this.serviceCache.set(serviceName, service);
      return service;
    } catch (error) {
      throw new Error(`Service '${serviceName}' not found and could not be loaded: ${error.message}`);
    }
  }

  getServicePath(serviceName) {
    // Map service names to their file paths
    const serviceMap = {
      'secureDataAccess': '../../../backend/services/secureDataAccess',
      'encryptionService': '../../../backend/services/encryptionService', 
      'auditService': '../../../backend/services/auditService',
      'phiDetectionService': '../../../backend/services/phiDetectionService',
      'clinicDatabaseManager': '../../../backend/services/clinicDatabaseManager',
      'notificationService': '../../../backend/services/notificationService',
      'taskManagementService': '../../../backend/services/taskManagementService',
      'socketIOService': '../../../backend/services/socketIOService',
      'hl7Service': '../../../backend/services/hl7Service',
      'fhirService': '../../../backend/services/fhirService',
      'serviceAccountManager': '../../../backend/services/serviceAccountManager',
      'databaseFactory': '../../../backend/utils/databaseFactory',
      'connectionPoolManager': '../../../backend/services/connectionPoolManager'
    };

    return serviceMap[serviceName] || `../../../backend/services/${serviceName}`;
  }

  clearServiceCache() {
    this.serviceCache.clear();
  }

  getRegisteredServices() {
    return Array.from(this.services.keys());
  }
}

module.exports = new ServiceProxyManager();