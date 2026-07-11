// IntelliCare Agent Service V4 - Orchestrator
// Migrated to DDD NX architecture - AI Analytics Context - Claude Feature
// This service orchestrates all agent services and manages execution flow

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class AgentServiceV4Orchestrator {
  constructor() {
    this.serviceId = 'agent-service-v4-orchestrator';
    this.serviceToken = null;
    this.initialized = false;
    this.services = new Map();
    this.executionQueue = [];
    this.isProcessing = false;
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Initialize service registry
      await this.initializeServices();
      
      this.initialized = true;
      console.log('✅ AgentServiceV4Orchestrator initialized');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize AgentServiceV4Orchestrator:', error);
      throw error;
    }
  }

  async initializeServices() {
    // Load main agent service
    this.services.set('main', {
      instance: require('./agentServiceV4'),
      priority: 1,
      status: 'available'
    });
    
    // Load modular service
    this.services.set('modular', {
      instance: require('./agentServiceV4Modular'),
      priority: 2,
      status: 'available'
    });
    
    // Load guided service
    this.services.set('guided', {
      instance: require('./agentServiceV4-guided'),
      priority: 3,
      status: 'available'
    });
    
    // Load additions service
    this.services.set('additions', {
      instance: require('./agentServiceV4-additions'),
      priority: 4,
      status: 'available'
    });
    
    // Initialize all services
    for (const [name, service] of this.services) {
      try {
        if (service.instance.initialize) {
          await service.instance.initialize();
          console.log(`✅ Initialized service: ${name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize service ${name}:`, error);
        service.status = 'error';
      }
    }
  }

  async orchestrateRequest(request) {
    if (!this.initialized) await this.initialize();

    const { functionName, params, practiceContext, session } = request;
    
    try {
      // Add request to execution queue
      const requestId = this.generateRequestId();
      const queuedRequest = {
        id: requestId,
        functionName,
        params,
        practiceContext,
        session,
        timestamp: new Date(),
        status: 'queued'
      };
      
      this.executionQueue.push(queuedRequest);
      
      // Process immediately if not already processing
      if (!this.isProcessing) {
        return await this.processQueue();
      }
      
      // Wait for processing to complete
      return await this.waitForRequest(requestId);
    } catch (error) {
      console.error('Error orchestrating request:', error);
      return {
        success: false,
        error: session?.language === 'he' 
          ? 'שגיאה בתזמור הבקשה' 
          : 'Error orchestrating request'
      };
    }
  }

  async processQueue() {
    if (this.isProcessing || this.executionQueue.length === 0) {
      return null;
    }

    this.isProcessing = true;
    
    try {
      while (this.executionQueue.length > 0) {
        const request = this.executionQueue.shift();
        request.status = 'processing';
        request.startTime = new Date();
        
        // Execute request
        const result = await this.executeRequest(request);
        request.result = result;
        request.status = 'completed';
        request.endTime = new Date();
        
        // Log execution
        await this.logExecution(request);
        
        // Return result for first request (synchronous call)
        if (this.executionQueue.length === 0) {
          this.isProcessing = false;
          return result;
        }
      }
    } catch (error) {
      console.error('Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
    
    return null;
  }

  async executeRequest(request) {
    const { functionName, params, practiceContext, session } = request;
    
    try {
      // Determine which service should handle this request
      const targetService = await this.findTargetService(functionName);
      
      if (!targetService) {
        return {
          success: false,
          error: session?.language === 'he' 
            ? `פונקציה לא נמצאה: ${functionName}` 
            : `Function not found: ${functionName}`
        };
      }
      
      // Execute on target service
      let result;
      if (targetService.name === 'main' && targetService.instance.processRequest) {
        result = await targetService.instance.processRequest(functionName, params, practiceContext, session);
      } else if (targetService.name === 'modular' && targetService.instance.executeFunction) {
        result = await targetService.instance.executeFunction(functionName, params, practiceContext, session);
      } else if (targetService.instance[functionName]) {
        result = await targetService.instance[functionName](params, practiceContext, session);
      } else {
        result = {
          success: false,
          error: session?.language === 'he' 
            ? 'שירות לא זמין' 
            : 'Service unavailable'
        };
      }
      
      // Add orchestration metadata
      return {
        ...result,
        orchestration: {
          service: targetService.name,
          requestId: request.id,
          executedAt: new Date(),
          executionTime: Date.now() - request.startTime.getTime()
        }
      };
    } catch (error) {
      console.error(`Error executing request ${request.id}:`, error);
      return {
        success: false,
        error: session?.language === 'he' 
          ? 'שגיאה בביצוע הבקשה' 
          : 'Error executing request'
      };
    }
  }

  async findTargetService(functionName) {
    // Check main service first
    const mainService = this.services.get('main');
    if (mainService && mainService.status === 'available') {
      const functions = mainService.instance.getAllFunctions ? mainService.instance.getAllFunctions() : [];
      if (functions.includes(functionName)) {
        return { name: 'main', ...mainService };
      }
    }
    
    // Check modular service
    const modularService = this.services.get('modular');
    if (modularService && modularService.status === 'available') {
      const moduleForFunction = modularService.instance.findModuleForFunction ? 
        modularService.instance.findModuleForFunction(functionName) : null;
      if (moduleForFunction) {
        return { name: 'modular', ...modularService };
      }
    }
    
    // Check additions service
    const additionsService = this.services.get('additions');
    if (additionsService && additionsService.status === 'available' && 
        additionsService.instance[functionName]) {
      return { name: 'additions', ...additionsService };
    }
    
    return null;
  }

  async logExecution(request) {
    if (!this.initialized) return;

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'log-execution',
        practiceId: request.practiceContext?.practiceId || 'global'
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      await SecureDataAccess.create('agent_execution_logs', {
        requestId: request.id,
        functionName: request.functionName,
        status: request.status,
        executionTime: request.endTime - request.startTime,
        success: request.result?.success || false,
        timestamp: new Date(),
        practiceId: request.practiceContext?.practiceId,
        userId: request.session?.userId
      }, context);
    } catch (error) {
      console.error('Error logging execution:', error);
    }
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async waitForRequest(requestId) {
    // For now, return immediately as we process synchronously
    // In a real implementation, this would wait for async completion
    return {
      success: false,
      error: 'Request queued for async processing'
    };
  }

  async getServiceStatus() {
    if (!this.initialized) await this.initialize();

    const status = {
      orchestrator: {
        initialized: this.initialized,
        processing: this.isProcessing,
        queueLength: this.executionQueue.length
      },
      services: {}
    };

    for (const [name, service] of this.services) {
      status.services[name] = {
        status: service.status,
        priority: service.priority,
        hasInstance: !!service.instance
      };
    }

    return status;
  }

  async resetQueue() {
    this.executionQueue = [];
    this.isProcessing = false;
    console.log('🔄 Execution queue reset');
  }

  async restartService(serviceName) {
    const service = this.services.get(serviceName);
    if (service && service.instance && service.instance.initialize) {
      try {
        await service.instance.initialize();
        service.status = 'available';
        console.log(`🔄 Restarted service: ${serviceName}`);
        return true;
      } catch (error) {
        console.error(`❌ Failed to restart service ${serviceName}:`, error);
        service.status = 'error';
        return false;
      }
    }
    return false;
  }
}

// Create and export singleton
const agentServiceV4Orchestrator = new AgentServiceV4Orchestrator();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('agentServiceV4Orchestrator', () => agentServiceV4Orchestrator);
}

module.exports = agentServiceV4Orchestrator;