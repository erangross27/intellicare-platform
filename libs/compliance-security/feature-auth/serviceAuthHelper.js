/**
 * Helper for services to build authenticated context for SecureDataAccess
 * This ensures all services pass their API keys correctly
 */

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class ServiceAuthHelper {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('service-auth-helper');
      this.initialized = true;
      return this;
    } catch (error) {
      console.error('Failed to initialize ServiceAuthHelper:', error);
      throw error;
    }
  }

  /**
   * Build a properly authenticated context for SecureDataAccess
   * @param {string} serviceId - The service identifier
   * @param {Object} serviceToken - The token from serviceAccountManager.authenticate()
   * @param {string} operation - What operation is being performed
   * @param {string} practiceId - The practice ID (defaults to 'global')
   * @returns {Object} Context object with authentication
   */
  static buildContext(serviceId, serviceToken, operation, practiceId = 'global') {
    // Extract API key from serviceToken
    let apiKey = null;
    
    if (serviceToken) {
      if (typeof serviceToken === 'string') {
        // If serviceToken is a string, it IS the API key
        apiKey = serviceToken;
      } else if (typeof serviceToken === 'object') {
        // If it's an object, get the apiKey property
        apiKey = serviceToken.apiKey || serviceToken.token || serviceToken.sessionToken;
      }
    }
    
    if (!apiKey) {
      console.warn(`⚠️ No API key found for service ${serviceId} - authentication may fail`);
    }
    
    return {
      serviceId: serviceId,
      apiKey: apiKey,
      operation: operation || 'general-operation',
      practiceId: practiceId || 'global'
    };
  }

  /**
   * Build context for a specific service instance
   */
  async buildOwnContext(operation, practiceId = 'global') {
    await this.initialize();
    
    return ServiceAuthHelper.buildContext(
      'service-auth-helper',
      this.serviceToken,
      operation,
      practiceId
    );
  }

  /**
   * Validate that a context has the required fields for SecureDataAccess
   */
  static validateContext(context) {
    const required = ['serviceId', 'operation', 'practiceId'];
    const missing = required.filter(field => !context[field]);
    
    if (missing.length > 0) {
      console.warn(`⚠️ Context missing required fields: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }

  /**
   * Create a minimal context for emergency situations
   */
  static createEmergencyContext(serviceId, operation = 'emergency-operation') {
    return {
      serviceId: serviceId || 'unknown-service',
      operation: operation,
      practiceId: 'global',
      emergency: true
    };
  }

  /**
   * Merge additional properties into an existing context
   */
  static extendContext(baseContext, additionalProps = {}) {
    return {
      ...baseContext,
      ...additionalProps
    };
  }
}

module.exports = new ServiceAuthHelper();