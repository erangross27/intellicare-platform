// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class ServiceAutoLoader {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.loadedServices = new Map();
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('service-auto-loader');
      this.initialized = true;
      return this;
    } catch (error) {
      console.error('Failed to initialize ServiceAutoLoader:', error);
      throw error;
    }
  }

  async autoLoadServices(pattern = '**/*Service.js') {
    await this.initialize();
    
    console.log('🔄 Auto-loading services...');
    
    // Simulate service loading
    const services = [
      'policyManagementService',
      'prescriptionGenerator', 
      'providerDirectoryService'
    ];

    for (const serviceName of services) {
      try {
        this.loadedServices.set(serviceName, {
          name: serviceName,
          loadedAt: new Date(),
          status: 'active'
        });
      } catch (error) {
        console.error(`Failed to load ${serviceName}:`, error);
      }
    }

    return {
      success: true,
      loaded: this.loadedServices.size,
      services: Array.from(this.loadedServices.keys())
    };
  }

  getLoadedServices() {
    return Array.from(this.loadedServices.values());
  }

  isServiceLoaded(serviceName) {
    return this.loadedServices.has(serviceName);
  }
}

module.exports = new ServiceAutoLoader();