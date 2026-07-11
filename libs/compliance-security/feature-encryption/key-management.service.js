/**
 * Key Management Service
 * Handles encryption key lifecycle and secure key operations
 */

const crypto = require('crypto');

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class KeyManagementService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.keyRotationSchedule = new Map();
    this.activeKeys = new Map();
  }

  async initialize() {
    if (this.initialized) {
      return;
    }
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('key-management-service');
    this.initialized = true;
    console.log('✅ Key Management Service initialized with ServiceProxy');
  }

  async generateKey(keyType = 'AES-256-GCM') {
    if (!this.initialized) await this.initialize();
    
    const context = {
      serviceId: 'key-management-service',
      operation: 'generate-key',
      practiceId: 'global'
    };
    
    const key = crypto.randomBytes(32);
    const keyId = crypto.randomBytes(16).toString('hex');
    
    // Store key metadata through proxy
    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    await SecureDataAccess.create('encryption_keys', {
      keyId,
      keyType,
      createdAt: new Date(),
      status: 'active'
    }, context);
    
    return { keyId, key: key.toString('hex') };
  }

  async rotateKey(keyId) {
    if (!this.initialized) await this.initialize();
    
    const context = {
      serviceId: 'key-management-service',
      operation: 'rotate-key',
      practiceId: 'global'
    };
    
    // Key rotation implementation
    const newKey = await this.generateKey();
    
    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    await SecureDataAccess.update('encryption_keys', 
      { keyId }, 
      { status: 'rotated', rotatedAt: new Date() }, 
      context
    );
    
    return newKey;
  }

  async revokeKey(keyId) {
    if (!this.initialized) await this.initialize();
    
    const context = {
      serviceId: 'key-management-service',
      operation: 'revoke-key',
      practiceId: 'global'
    };
    
    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    await SecureDataAccess.update('encryption_keys', 
      { keyId }, 
      { status: 'revoked', revokedAt: new Date() }, 
      context
    );
    
    return true;
  }
}

// Export singleton instance
const keyManagementServiceInstance = new KeyManagementService();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('keyManagementService', () => keyManagementServiceInstance);
}

module.exports = keyManagementServiceInstance;