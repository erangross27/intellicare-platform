/**
 * Admin Functions Module for Agent Service
 * Contains administrative and management functions
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class AdminFunctions {
    constructor() {
        this.initialized = false;
        this.serviceToken = null;
    }

    async initialize() {
        if (this.initialized) return;
        
        // Authenticate service
        try {
            const proxy = getServiceProxy();
            const serviceAccountManager = proxy.getService('serviceAccountManager');
            this.serviceToken = await serviceAccountManager.authenticate('agent-service-admin-functions');
            console.log('✅ AdminFunctions authenticated');
        } catch (error) {
            console.error('❌ AdminFunctions authentication failed:', error.message);
            throw error;
        }
        
        this.initialized = true;
    }

    // Practice management
    async createClinic(params) {
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.create('practices', params, {
            serviceId: 'agent-service-admin-functions',
            operation: 'createClinic',
            practiceId: 'global'
        });
    }

    async updateClinic(params) {
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.update('practices',
            { _id: params.practiceId },
            params.updates,
            {
                serviceId: 'agent-service-admin-functions',
                operation: 'updateClinic',
                practiceId: params.practiceId
            }
        );
    }

    async getClinicSettings(params) {
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.query('practices',
            { _id: params.practiceId },
            {},
            {
                serviceId: 'agent-service-admin-functions',
                operation: 'getClinicSettings',
                practiceId: params.practiceId
            }
        );
    }

    // User role management
    async assignRole(params) {
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.update('users',
            { _id: params.userId },
            { roles: [...new Set([...(params.existingRoles || []), params.role])] },
            {
                serviceId: 'agent-service-admin-functions',
                operation: 'assignRole',
                practiceId: params.practiceId
            }
        );
    }

    async removeRole(params) {
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        const updatedRoles = (params.existingRoles || []).filter(role => role !== params.role);
        return secureDataAccess.update('users',
            { _id: params.userId },
            { roles: updatedRoles },
            {
                serviceId: 'agent-service-admin-functions',
                operation: 'removeRole',
                practiceId: params.practiceId
            }
        );
    }

    // Audit and compliance
    async getAuditLogs(params) {
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        const filter = {
            practiceId: params.practiceId
        };
        
        if (params.startDate) {
            filter.timestamp = { $gte: new Date(params.startDate) };
        }
        if (params.endDate) {
            filter.timestamp = filter.timestamp || {};
            filter.timestamp.$lte = new Date(params.endDate);
        }

        return secureDataAccess.query('auditLogs',
            filter,
            { 
                sort: { timestamp: -1 },
                limit: params.limit || 100
            },
            {
                serviceId: 'agent-service-admin-functions',
                operation: 'getAuditLogs',
                practiceId: params.practiceId
            }
        );
    }

    async generateComplianceReport(params) {
        const proxy = getServiceProxy();
        const reportGenerator = proxy.getService('reportGenerator');
        if (reportGenerator && reportGenerator.generateComplianceReport) {
            return reportGenerator.generateComplianceReport(params);
        }
        
        return {
            status: 'pending',
            message: 'Report generator service not available'
        };
    }

    // Backup and restore
    async createBackup(params) {
        return {
            status: 'initiated',
            backupId: `backup-${Date.now()}`,
            message: 'Backup creation initiated'
        };
    }

    async restoreBackup(params) {
        return {
            status: 'initiated',
            message: 'Restore process initiated for backup: ' + params.backupId
        };
    }

    // System configuration
    async updateSystemConfig(params) {
        const proxy = getServiceProxy();
        const secureConfigService = proxy.getService('secureConfigService');
        if (secureConfigService && secureConfigService.setConfig) {
            return secureConfigService.setConfig(params.key, params.value);
        }
        
        return {
            status: 'error',
            message: 'Config service not available'
        };
    }

    async getSystemConfig(params) {
        const proxy = getServiceProxy();
        const secureConfigService = proxy.getService('secureConfigService');
        if (secureConfigService && secureConfigService.getConfig) {
            return secureConfigService.getConfig(params.key);
        }
        
        return {
            status: 'error',
            message: 'Config service not available'
        };
    }

    // Service management
    async restartService(params) {
        return {
            status: 'restarting',
            service: params.serviceName,
            message: `Service ${params.serviceName} restart initiated`
        };
    }

    async getServiceStatus(params) {
        const proxy = getServiceProxy();
        const healthMonitor = proxy.getService('serviceHealthMonitor');
        const report = healthMonitor.getInitializationReport();
        const service = report.services[params.serviceName];
        
        return service || {
            status: 'unknown',
            message: `Service ${params.serviceName} not found`
        };
    }

    // Export admin functions list
    getFunctionList() {
        return [
            'createClinic',
            'updateClinic',
            'getClinicSettings',
            'assignRole',
            'removeRole',
            'getAuditLogs',
            'generateComplianceReport',
            'createBackup',
            'restoreBackup',
            'updateSystemConfig',
            'getSystemConfig',
            'restartService',
            'getServiceStatus'
        ];
    }
}

// Create instance
const adminFunctions = new AdminFunctions();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('adminFunctions', () => adminFunctions);
}

module.exports = adminFunctions;