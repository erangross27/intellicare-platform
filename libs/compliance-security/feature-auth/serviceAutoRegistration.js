const crypto = require('crypto');

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class ServiceAutoRegistration {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('service-auto-registration');
      this.initialized = true;
      return this;
    } catch (error) {
      console.error('Failed to initialize ServiceAutoRegistration:', error);
      throw error;
    }
  }

  async registerService(serviceConfig) {
    await this.initialize();
    
    const {
      serviceId,
      serviceName,
      allowedCollections = ['*'],
      description = 'Auto-registered service'
    } = serviceConfig;

    // Generate API key
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    // Register with service account manager
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    const result = await serviceAccountManager.registerService({
      serviceId,
      serviceName,
      apiKey,
      allowedCollections,
      description,
      registeredAt: new Date()
    });

    return {
      success: true,
      serviceId,
      registered: true,
      ...result
    };
  }

  async getRegistrationStatus(serviceId) {
    await this.initialize();
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      const account = await serviceAccountManager.getServiceAccount(serviceId);
      return {
        registered: !!account,
        serviceId,
        status: account?.active ? 'active' : 'inactive'
      };
    } catch (error) {
      return {
        registered: false,
        serviceId,
        error: error.message
      };
    }
  }

  async bulkRegisterServices(services) {
    await this.initialize();
    
    const results = [];
    
    for (const serviceConfig of services) {
      try {
        const result = await this.registerService(serviceConfig);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          serviceId: serviceConfig.serviceId,
          error: error.message
        });
      }
    }

    return {
      success: true,
      total: services.length,
      results
    };
  }
}

module.exports = new ServiceAutoRegistration();