// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class ServiceInitializer {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.initializationOrder = [];
    this.initializedServices = new Set();
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('service-initializer');
      this.initialized = true;
      return this;
    } catch (error) {
      console.error('Failed to initialize ServiceInitializer:', error);
      throw error;
    }
  }

  async initializeServices(services = []) {
    await this.initialize();
    
    console.log('🚀 Initializing services in order...');
    
    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const serviceName of services) {
      try {
        if (this.initializedServices.has(serviceName)) {
          results.skipped.push(serviceName);
          continue;
        }

        await this.initializeService(serviceName);
        this.initializedServices.add(serviceName);
        results.success.push(serviceName);
        
        console.log(`✅ ${serviceName} initialized`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${serviceName}:`, error);
        results.failed.push({
          service: serviceName,
          error: error.message
        });
      }
    }

    return {
      total: services.length,
      ...results
    };
  }

  async initializeService(serviceName) {
    // Simulate service initialization
    console.log(`🔄 Initializing ${serviceName}...`);
    
    // Check if service exists
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    const account = await serviceAccountManager.getServiceAccount(serviceName);
    if (!account) {
      throw new Error(`Service account not found: ${serviceName}`);
    }

    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      serviceName,
      initialized: true,
      timestamp: new Date()
    };
  }

  async shutdownServices(services = []) {
    await this.initialize();
    
    console.log('🛑 Shutting down services...');
    
    const results = {
      success: [],
      failed: []
    };

    // Shutdown in reverse order
    const shutdownOrder = services.reverse();
    
    for (const serviceName of shutdownOrder) {
      try {
        await this.shutdownService(serviceName);
        this.initializedServices.delete(serviceName);
        results.success.push(serviceName);
        
        console.log(`🛑 ${serviceName} shut down`);
      } catch (error) {
        console.error(`❌ Failed to shutdown ${serviceName}:`, error);
        results.failed.push({
          service: serviceName,
          error: error.message
        });
      }
    }

    return results;
  }

  async shutdownService(serviceName) {
    console.log(`🛑 Shutting down ${serviceName}...`);
    
    // Simulate shutdown process
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      serviceName,
      shutdown: true,
      timestamp: new Date()
    };
  }

  getInitializationStatus() {
    return {
      totalInitialized: this.initializedServices.size,
      initializedServices: Array.from(this.initializedServices),
      initializationOrder: [...this.initializationOrder]
    };
  }

  isServiceInitialized(serviceName) {
    return this.initializedServices.has(serviceName);
  }

  async restartService(serviceName) {
    await this.initialize();
    
    console.log(`🔄 Restarting ${serviceName}...`);
    
    try {
      // Shutdown first
      if (this.initializedServices.has(serviceName)) {
        await this.shutdownService(serviceName);
        this.initializedServices.delete(serviceName);
      }
      
      // Then initialize
      await this.initializeService(serviceName);
      this.initializedServices.add(serviceName);
      
      return {
        success: true,
        serviceName,
        restarted: true,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to restart ${serviceName}: ${error.message}`);
    }
  }
}

module.exports = new ServiceInitializer();