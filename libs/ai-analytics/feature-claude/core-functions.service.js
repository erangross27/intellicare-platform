/**
 * Core Functions Service for Agent Service - DDD Architecture
 * Contains essential platform functions
 * Location: libs/ai-analytics/feature-claude/core-functions.service.js
 */

const path = require('path');

// Service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class CoreFunctionsService {
    constructor() {
        this.initialized = false;
        this.serviceToken = null;
        this.serviceName = 'core-functions-service';
    }

    async initialize() {
        if (this.initialized) return;
        
        // Authenticate service with unique service name
        try {
            const proxy = getServiceProxy();
            const serviceAccountManager = proxy.getService('serviceAccountManager');
            this.serviceToken = await serviceAccountManager.authenticate(this.serviceName);
            console.log('✅ CoreFunctionsService authenticated successfully');
        } catch (error) {
            console.error('❌ CoreFunctionsService authentication failed:', error.message);
            throw error;
        }
        
        this.initialized = true;
    }

    // Core user management functions
    async createUser(params) {
        await this.initialize();
        const secureDataAccess = serviceProxyManager.get('secureDataAccess');
        return secureDataAccess.create('users', params, {
            serviceId: this.serviceName,
            operation: 'createUser',
            practiceId: params.practiceId || 'global',
            apiKey: this.serviceToken?.apiKey
        });
    }

    async updateUser(params) {
        await this.initialize();
        const secureDataAccess = serviceProxyManager.get('secureDataAccess');
        return secureDataAccess.update('users', 
            { _id: params.userId }, 
            params.updates, 
            {
                serviceId: this.serviceName,
                operation: 'updateUser',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    async deleteUser(params) {
        await this.initialize();
        const secureDataAccess = serviceProxyManager.get('secureDataAccess');
        return secureDataAccess.delete('users', 
            { _id: params.userId }, 
            {
                serviceId: this.serviceName,
                operation: 'deleteUser',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    async getUser(params) {
        await this.initialize();
        const secureDataAccess = serviceProxyManager.get('secureDataAccess');
        return secureDataAccess.query('users', 
            { _id: params.userId }, 
            {},
            {
                serviceId: this.serviceName,
                operation: 'getUser',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    // Core system functions
    async getSystemStatus() {
        await this.initialize();
        return {
            status: 'operational',
            timestamp: new Date(),
            services: serviceProxyManager.getLoadedServices(),
            serviceId: this.serviceName
        };
    }

    async getSystemHealth() {
        await this.initialize();
        try {
            const healthMonitor = serviceProxyManager.get('serviceHealthMonitor');
            return healthMonitor.getHealthStatus();
        } catch (error) {
            console.error('Health monitor not available:', error.message);
            return {
                status: 'unknown',
                error: 'Health monitor service not available',
                timestamp: new Date()
            };
        }
    }

    // Session management
    async createSession(params) {
        await this.initialize();
        const secureDataAccess = serviceProxyManager.get('secureDataAccess');
        return secureDataAccess.create('sessions', params, {
            serviceId: this.serviceName,
            operation: 'createSession',
            practiceId: params.practiceId || 'global'
        });
    }

    async endSession(params) {
        await this.initialize();
        const secureDataAccess = serviceProxyManager.get('secureDataAccess');
        return secureDataAccess.update('sessions',
            { _id: params.sessionId },
            { endedAt: new Date(), active: false },
            {
                serviceId: this.serviceName,
                operation: 'endSession',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    // Additional core functions for comprehensive service
    async getUsers(params = {}) {
        await this.initialize();
        const secureDataAccess = serviceProxyManager.get('secureDataAccess');
        return secureDataAccess.query('users', params.filter || {}, {
            limit: params.limit || 100,
            sort: params.sort || { createdAt: -1 }
        }, {
            serviceId: this.serviceName,
            operation: 'getUsers',
            practiceId: params.practiceId || 'global'
        });
    }

    async getUserSessions(params) {
        await this.initialize();
        const secureDataAccess = serviceProxyManager.get('secureDataAccess');
        return secureDataAccess.query('sessions', 
            { userId: params.userId, active: true }, 
            {},
            {
                serviceId: this.serviceName,
                operation: 'getUserSessions',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    // Export core functions list
    getFunctionList() {
        return [
            'createUser',
            'updateUser',
            'deleteUser',
            'getUser',
            'getUsers',
            'getSystemStatus',
            'getSystemHealth',
            'createSession',
            'endSession',
            'getUserSessions'
        ];
    }

    // Service metadata
    getServiceInfo() {
        return {
            serviceName: this.serviceName,
            version: '2.0.0',
            architecture: 'DDD',
            location: 'libs/ai-analytics/feature-claude/core-functions.service.js',
            initialized: this.initialized,
            functionCount: this.getFunctionList().length
        };
    }
}

// Create instance
const coreFunctionsService = new CoreFunctionsService();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('coreFunctionsService', () => coreFunctionsService);
}

module.exports = coreFunctionsService;