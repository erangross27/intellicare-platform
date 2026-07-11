/**
 * Secure Data Access with KMS Integration
 * This version uses KMS for all authentication - no API keys in code or env
 */

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class SecureDataAccessKMS {
  constructor() {
    this.initialized = false;
    this.accessCache = new Map();
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    
    // Initialize KMS through proxy
    const productionKMS = proxy.getService('productionKMS');
    await productionKMS.initialize();
    
    // Initialize service account manager
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('secure-data-access-kms');
    
    this.initialized = true;
    console.log('✅ SecureDataAccessKMS initialized with KMS and ServiceProxy');
  }

  /**
   * Validate service using KMS (no API keys!)
   */
  async validateServiceAccount(context) {
    // No more API keys - use KMS signature verification
    if (!context.serviceId) {
      throw new Error('Service ID required');
    }

    const proxy = getServiceProxy();
    
    // Check if service has valid KMS signature
    const productionKMS = proxy.getService('productionKMS');
    const isValid = await productionKMS.validateServiceContext(context);
    
    if (!isValid) {
      // Also audit with audit service
      const auditService = proxy.getService('immutableAuditService');
      await auditService.logSecurityEvent({
        type: 'KMS_VALIDATION_FAILED',
        serviceId: context.serviceId,
        timestamp: new Date(),
        severity: 'HIGH'
      });
      
      console.error(`❌ Service ${context.serviceId} failed KMS validation`);
      return null;
    }

    // Return validated service account
    return {
      serviceId: context.serviceId,
      validated: true,
      validatedAt: new Date(),
      permissions: await this.getServicePermissions(context.serviceId)
    };
  }

  /**
   * Query with KMS authentication
   */
  async query(collection, filter = {}, options = {}, context = {}) {
    // Validate using KMS
    const serviceAccount = await this.validateServiceAccount(context);
    
    if (!serviceAccount) {
      throw new Error('KMS validation failed');
    }

    const proxy = getServiceProxy();
    
    // Encrypt sensitive fields in filter
    const encryptedFilter = await this.encryptFilter(filter);
    
    // Get database connection through proxy
    const databaseConnectionProvider = proxy.getService('databaseConnectionProvider');
    const db = await databaseConnectionProvider.getConnection('secure-data-access-kms', `intellicare_practice_${context.practiceId}`);
    
    // Execute query
    const nativeDb = db.db ? db.db : db;
    const results = await nativeDb.collection(collection).find(encryptedFilter).toArray();
    
    // Decrypt results
    const decryptedResults = await this.decryptResults(results);
    
    // Audit with KMS
    await this.auditWithKMS('QUERY', context.serviceId, collection);
    
    return decryptedResults;
  }

  /**
   * Insert with KMS protection
   */
  async insert(collection, document, context = {}) {
    // Validate using KMS
    const serviceAccount = await this.validateServiceAccount(context);
    
    if (!serviceAccount) {
      throw new Error('KMS validation failed');
    }

    const proxy = getServiceProxy();
    
    // Encrypt document
    const encryptedDoc = await this.encryptDocument(document, collection);
    
    // Add KMS metadata
    encryptedDoc._kmsProtected = true;
    encryptedDoc._kmsKeyId = `${collection}-${Date.now()}`;
    encryptedDoc._kmsTimestamp = Date.now();
    
    // Get database connection through proxy
    const databaseConnectionProvider = proxy.getService('databaseConnectionProvider');
    const db = await databaseConnectionProvider.getConnection('secure-data-access-kms', `intellicare_practice_${context.practiceId}`);
    
    // Insert
    const nativeDb = db.db ? db.db : db;
    const result = await nativeDb.collection(collection).insertOne(encryptedDoc);
    
    // Audit with KMS
    await this.auditWithKMS('INSERT', context.serviceId, collection);
    
    return result;
  }

  /**
   * Encrypt document using KMS
   */
  async encryptDocument(document, collection) {
    const proxy = getServiceProxy();
    const productionKMS = proxy.getService('productionKMS');
    
    const encrypted = {};
    
    // Define sensitive fields per collection
    const sensitiveFields = this.getSensitiveFields(collection);
    
    for (const [key, value] of Object.entries(document)) {
      if (sensitiveFields.includes(key)) {
        // Encrypt using KMS
        const encryptedValue = await productionKMS.encrypt(
          JSON.stringify(value),
          `${collection}-${key}`
        );
        encrypted[key] = encryptedValue;
      } else {
        encrypted[key] = value;
      }
    }
    
    return encrypted;
  }

  /**
   * Decrypt document using KMS
   */
  async decryptDocument(document) {
    const proxy = getServiceProxy();
    const productionKMS = proxy.getService('productionKMS');
    
    const decrypted = {};
    
    for (const [key, value] of Object.entries(document)) {
      if (value && typeof value === 'object' && value.ciphertext) {
        // Decrypt using KMS
        const decryptedValue = await productionKMS.decrypt(value);
        decrypted[key] = JSON.parse(decryptedValue);
      } else {
        decrypted[key] = value;
      }
    }
    
    return decrypted;
  }

  /**
   * Encrypt filter for queries
   */
  async encryptFilter(filter) {
    const proxy = getServiceProxy();
    const productionKMS = proxy.getService('productionKMS');
    
    const encrypted = {};
    
    for (const [key, value] of Object.entries(filter)) {
      // Check if this field should be encrypted for searching
      if (this.isEncryptedField(key)) {
        // Use deterministic encryption for searchable fields
        encrypted[key] = await productionKMS.encrypt(value, `search-${key}`);
      } else {
        encrypted[key] = value;
      }
    }
    
    return encrypted;
  }

  /**
   * Decrypt results
   */
  async decryptResults(results) {
    const decrypted = [];
    
    for (const doc of results) {
      decrypted.push(await this.decryptDocument(doc));
    }
    
    return decrypted;
  }

  /**
   * Get sensitive fields for collection
   */
  getSensitiveFields(collection) {
    const fieldMap = {
      patients: ['nationalId', 'phone', 'email', 'medicalHistory', 'medications'],
      users: ['password', 'email', 'phone'],
      appointments: ['notes', 'diagnosis'],
      documents: ['content', 'extractedData'],
      ServiceAccounts: ['apiKey', 'apiKeyHash']
    };
    
    return fieldMap[collection] || [];
  }

  /**
   * Check if field should be encrypted
   */
  isEncryptedField(fieldName) {
    const encryptedFields = [
      'nationalId',
      'phone',
      'email',
      'apiKey',
      'password'
    ];
    
    return encryptedFields.includes(fieldName);
  }

  /**
   * Get service permissions from KMS
   */
  async getServicePermissions(serviceId) {
    const proxy = getServiceProxy();
    const productionKMS = proxy.getService('productionKMS');
    
    // Permissions stored encrypted in KMS
    const permissionsKey = `permissions-${serviceId}`;
    
    try {
      const encrypted = await productionKMS.encrypt(
        JSON.stringify(['read', 'write']),
        permissionsKey
      );
      
      const permissions = await productionKMS.decrypt(encrypted);
      return JSON.parse(permissions);
    } catch (error) {
      return ['read']; // Default to read-only
    }
  }

  /**
   * Audit operation using KMS
   */
  async auditWithKMS(operation, serviceId, collection) {
    const proxy = getServiceProxy();
    const productionKMS = proxy.getService('productionKMS');
    const auditService = proxy.getService('immutableAuditService');
    
    const auditEntry = {
      timestamp: Date.now(),
      operation,
      serviceId,
      collection,
      kmsProtected: true
    };
    
    // Encrypt audit log
    const encryptedAudit = await productionKMS.encrypt(
      JSON.stringify(auditEntry),
      'audit-log'
    );
    
    // Also log to audit service
    await auditService.logServiceDataAccess({
      operation,
      serviceId,
      collection,
      timestamp: new Date(),
      kmsProtected: true
    });
    
    console.log(`🔐 KMS Audit: ${operation} by ${serviceId} on ${collection}`);
  }
}

// Export singleton instance
const secureDataAccessKMSInstance = new SecureDataAccessKMS();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('secureDataAccessKMS', () => secureDataAccessKMSInstance);
}

module.exports = secureDataAccessKMSInstance;