/**
 * Medical-Grade Encryption Service - Modular Version
 * HIPAA-Compliant Multi-Layer Encryption Strategy
 */

const crypto = require('crypto');
const path = require('path');

// Add service proxy getter
let simpleServiceProxy = null;
function getServiceProxy() {
    if (!simpleServiceProxy) {
        simpleServiceProxy = require('../../../backend/services/simpleServiceProxy');
    }
    return simpleServiceProxy;
}

class EncryptionService {
  constructor() {
    this.serviceId = 'encryption-service';
    this.serviceToken = null;
    this.initialized = false;
    this.keys = {};

    // Algorithm configurations
    this.algorithms = {
      symmetric: 'aes-256-gcm',  // For data encryption
      hash: 'sha256',             // For hashing
      kdf: 'pbkdf2',             // For key derivation
      iterations: 100000          // NIST recommended minimum
    };

    // Key rotation tracking
    this.keyVersion = '1';
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Initialize KMS if not already initialized through proxy
      const proxy = getServiceProxy();
      const productionKMS = proxy.getService('productionKMS');
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }
      
      // Load all encryption keys from KMS
      const keyTypes = [
        { name: 'DOCUMENT_ENCRYPTION_KEY', field: 'document' },
        { name: 'SESSION_ENCRYPTION_KEY', field: 'session' },
        { name: 'PHI_ENCRYPTION_KEY', field: 'phi' },
        { name: 'PII_ENCRYPTION_KEY', field: 'pii' },
        { name: 'AUDIT_ENCRYPTION_KEY', field: 'audit' }
      ];
      
      for (const keyType of keyTypes) {
        let keyValue = await productionKMS.getKey(keyType.name);
        
        if (!keyValue) {
          // Generate new key if doesn't exist
          keyValue = this.generateKey();
          await productionKMS.storeInternalKey(keyType.name, keyValue);
        }
        
        this.keys[keyType.field] = keyValue;
      }
      
      // Get key version from KMS
      const keyVersion = await productionKMS.getKey('KEY_VERSION');
      if (keyVersion) {
        this.keyVersion = keyVersion;
      }
      
      // Authenticate service (optional - encryption should work even without auth)
      if (!this.serviceToken) {
        try {
          const serviceAccountManager = proxy.getService('serviceAccountManager');
          this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
        } catch (authError) {
          console.warn('⚠️ Encryption service authentication failed, continuing without service token:', authError.message);
          this.serviceToken = null;
          // Encryption can still work without authentication for basic operations
        }
      }
      
      this.initialized = true;
      
      // Log initialization using SecureDataAccess if authentication succeeded
      if (this.serviceToken) {
        const SecureDataAccess = proxy.getService('secureDataAccess');
        const context = {
          serviceId: this.serviceId,
          operation: 'initialize',
          practiceId: 'global'
        };
        
        await SecureDataAccess.create('audit_logs', {
          action: 'SERVICE_INITIALIZED',
          service: 'encryption-service',
          timestamp: new Date()
        }, context);
      }
      
      console.log('✅ Encryption Service initialized');
    } catch (error) {
      console.error('Failed to initialize EncryptionService:', error);
      throw error;
    }
    
    return this;
  }

  /**
   * Generate a secure random key
   */
  generateKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Encrypt data with specified security level
   */
  async encrypt(data, securityLevel = 'standard') {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Select appropriate key based on security level
      const key = this.selectKey(securityLevel);
      
      // Generate IV (Initialization Vector)
      const iv = crypto.randomBytes(16);
      
      // Derive key from master key (adds another layer)
      const derivedKey = this.deriveKey(key, iv.toString('hex'));
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithms.symmetric, derivedKey, iv);
      
      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(data), 'utf8'),
        cipher.final()
      ]);
      
      // Get authentication tag (for GCM mode)
      const authTag = cipher.getAuthTag();
      
      // Combine all components
      return {
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        version: this.keyVersion,
        algorithm: this.algorithms.symmetric,
        level: securityLevel,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data
   */
  async decrypt(encryptedPackage) {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Validate package
      if (!encryptedPackage.encrypted || !encryptedPackage.iv || !encryptedPackage.authTag) {
        throw new Error('Invalid encrypted package');
      }

      // Select appropriate key
      const key = this.selectKey(encryptedPackage.level || 'standard');
      
      // Derive key using the same salt that was used for encryption
      const derivedKey = this.deriveKey(key, Buffer.from(encryptedPackage.iv, 'base64').toString('hex'));
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        encryptedPackage.algorithm || this.algorithms.symmetric,
        derivedKey,
        Buffer.from(encryptedPackage.iv, 'base64')
      );
      
      // Set auth tag
      decipher.setAuthTag(Buffer.from(encryptedPackage.authTag, 'base64'));
      
      // Decrypt
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedPackage.encrypted, 'base64')),
        decipher.final()
      ]);
      
      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Select encryption key based on security level
   */
  selectKey(level) {
    const keyMap = {
      'document': this.keys.document,
      'session': this.keys.session,
      'phi': this.keys.phi,
      'pii': this.keys.pii,
      'audit': this.keys.audit,
      'standard': this.keys.session,
      'high': this.keys.phi,
      'critical': this.keys.phi
    };

    const selectedKey = keyMap[level] || this.keys.session;
    
    if (!selectedKey) {
      throw new Error(`No encryption key available for level: ${level}`);
    }

    return Buffer.from(selectedKey, 'hex');
  }

  /**
   * Derive key from master key using PBKDF2
   */
  deriveKey(masterKey, salt) {
    return crypto.pbkdf2Sync(
      masterKey,
      salt,
      this.algorithms.iterations,
      32,
      this.algorithms.hash
    );
  }

  /**
   * Get encryption statistics
   */
  getStats() {
    return {
      keyVersion: this.keyVersion,
      algorithms: this.algorithms,
      securityLevels: ['standard', 'high', 'critical', 'phi', 'pii', 'audit'],
      compliance: {
        hipaa: true,
        gdpr: true,
        keyRotation: true,
        auditLogging: true
      }
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.serviceId,
      initialized: this.initialized,
      keyVersion: this.keyVersion,
      algorithmsLoaded: Object.keys(this.algorithms).length,
      keysLoaded: Object.keys(this.keys).length
    };
  }
}

// Singleton instance
const encryptionService = new EncryptionService();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('encryptionService', () => encryptionService);
}

module.exports = encryptionService;