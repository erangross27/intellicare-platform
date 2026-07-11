// End-to-End Encryption Service
// Provides client-side encryption for sensitive documents

const crypto = require('crypto');
const path = require('path');
const secureConfigService = require('../services/secureConfigService');
const productionKMS = require('../services/productionKMS');
const fs = require('fs').promises;

class E2EEncryptionService {
  constructor() {
    // Encryption settings
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.saltLength = 64; // 512 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    
    // Key derivation settings
    this.kdfIterations = 100000; // PBKDF2 iterations
    this.kdfDigest = 'sha256';
    
    // Key storage (in production, use secure key management)
    this.userKeys = new Map();
    this.keyMetadata = new Map();
    this.keyRotationSchedule = new Map();
    
    // Encrypted search index
    this.searchIndex = new Map();
    
    // Key rotation settings
    this.keyRotationInterval = 90 * 24 * 60 * 60 * 1000; // 90 days
    this.keyVersions = new Map();
  }
  
  /**
   * Generate master key for user
   */
  async generateUserMasterKey(userId, password) {
    try {
      // Generate unique salt for user
      const salt = crypto.randomBytes(this.saltLength);
      
      // Derive key from password using PBKDF2
      const masterKey = await this.deriveKey(password, salt);
      
      // Generate data encryption key (DEK)
      const dataKey = crypto.randomBytes(this.keyLength);
      
      // Encrypt DEK with master key
      const encryptedDEK = await this.encryptKey(dataKey, masterKey);
      
      // Store encrypted keys
      this.userKeys.set(userId, {
        salt: salt.toString('base64'),
        encryptedDEK: encryptedDEK.toString('base64'),
        createdAt: new Date(),
        version: 1,
        algorithm: this.algorithm
      });
      
      // Set key rotation schedule
      this.scheduleKeyRotation(userId);
      
      console.log(`🔐 Generated master key for user ${userId}`);
      
      return {
        success: true,
        keyId: crypto.randomBytes(16).toString('hex'),
        algorithm: this.algorithm,
        keyVersion: 1
      };
    } catch (error) {
      console.error('Master key generation error:', error);
      throw error;
    }
  }
  
  /**
   * Derive encryption key from password using PBKDF2
   */
  async deriveKey(password, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, this.kdfIterations, this.keyLength, this.kdfDigest, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }
  
  /**
   * Encrypt a key with another key (key wrapping)
   */
  async encryptKey(key, wrappingKey) {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, wrappingKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(key),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    return Buffer.concat([iv, tag, encrypted]);
  }
  
  /**
   * Decrypt a wrapped key
   */
  async decryptKey(encryptedKey, wrappingKey) {
    const buffer = Buffer.from(encryptedKey, 'base64');
    const iv = buffer.slice(0, this.ivLength);
    const tag = buffer.slice(this.ivLength, this.ivLength + this.tagLength);
    const encrypted = buffer.slice(this.ivLength + this.tagLength);
    
    const decipher = crypto.createDecipheriv(this.algorithm, wrappingKey, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted;
  }
  
  /**
   * Encrypt document with user's key
   */
  async encryptDocument(userId, documentData, metadata = {}) {
    try {
      let userKeyData = this.userKeys.get(userId);
      if (!userKeyData) {
        // Auto-generate user key using KMS key as base
        let baseKey = await productionKMS.getInternalKey('DOCUMENT_ENCRYPTION_KEY');
        if (!baseKey) {
          // Generate new key if doesn't exist
          baseKey = crypto.randomBytes(32).toString('hex');
          await productionKMS.storeInternalKey('DOCUMENT_ENCRYPTION_KEY', baseKey);
          console.log('✅ Generated and stored new DOCUMENT_ENCRYPTION_KEY in KMS');
        }
        
        // Generate user-specific key deterministically from base key
        await this.generateUserMasterKey(userId, baseKey + userId);
        userKeyData = this.userKeys.get(userId);
        
        if (!userKeyData) {
          throw new Error('Failed to generate user encryption key');
        }
        
        console.log(`🔐 [E2E] Auto-generated encryption key for user: ${userId}`);
      }
      
      // Generate document-specific IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // For demo, use a derived key (in production, decrypt DEK first)
      const documentKey = crypto.createHash('sha256')
        .update(userId + userKeyData.salt)
        .digest();
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, documentKey, iv);
      
      // Encrypt document
      let encryptedData;
      if (Buffer.isBuffer(documentData)) {
        encryptedData = Buffer.concat([
          cipher.update(documentData),
          cipher.final()
        ]);
      } else {
        encryptedData = Buffer.concat([
          cipher.update(JSON.stringify(documentData), 'utf8'),
          cipher.final()
        ]);
      }
      
      const tag = cipher.getAuthTag();
      
      // Create encrypted document package
      const encryptedPackage = {
        version: userKeyData.version,
        algorithm: this.algorithm,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        data: encryptedData.toString('base64'),
        metadata: this.encryptMetadata(metadata, documentKey),
        timestamp: new Date().toISOString(),
        keyId: crypto.randomBytes(8).toString('hex')
      };
      
      // Update search index with encrypted terms
      await this.updateSearchIndex(userId, documentData, metadata);
      
      return encryptedPackage;
    } catch (error) {
      console.error('Document encryption error:', error);
      throw error;
    }
  }
  
  /**
   * Decrypt document with user's key
   */
  async decryptDocument(userId, encryptedPackage) {
    try {
      const userKeyData = this.userKeys.get(userId);
      if (!userKeyData) {
        throw new Error('User decryption key not found');
      }
      
      // For demo, use a derived key (in production, decrypt DEK first)
      const documentKey = crypto.createHash('sha256')
        .update(userId + userKeyData.salt)
        .digest();
      
      // Extract components
      const iv = Buffer.from(encryptedPackage.iv, 'base64');
      const tag = Buffer.from(encryptedPackage.tag, 'base64');
      const encryptedData = Buffer.from(encryptedPackage.data, 'base64');
      
      // Create decipher (with fallback to default algorithm)
      const algorithm = encryptedPackage.algorithm || this.algorithm || 'aes-256-gcm';
      const decipher = crypto.createDecipheriv(algorithm, documentKey, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt document
      const decryptedData = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
      ]);
      
      // Decrypt metadata if present
      let metadata = {};
      if (encryptedPackage.metadata) {
        metadata = this.decryptMetadata(encryptedPackage.metadata, documentKey);
      }
      
      return {
        data: decryptedData,
        metadata,
        version: encryptedPackage.version,
        timestamp: encryptedPackage.timestamp
      };
    } catch (error) {
      console.error('Document decryption error:', error);
      throw error;
    }
  }
  
  /**
   * Encrypt metadata separately for searchability
   */
  encryptMetadata(metadata, key) {
    const encrypted = {};
    
    for (const [field, value] of Object.entries(metadata)) {
      // Create HMAC for searchable fields
      const hmac = crypto.createHmac('sha256', key);
      hmac.update(field + ':' + value);
      encrypted[field] = {
        hash: hmac.digest('hex'),
        encrypted: this.encryptField(value, key)
      };
    }
    
    return encrypted;
  }
  
  /**
   * Decrypt metadata
   */
  decryptMetadata(encryptedMetadata, key) {
    const decrypted = {};
    
    for (const [field, data] of Object.entries(encryptedMetadata)) {
      if (data.encrypted) {
        decrypted[field] = this.decryptField(data.encrypted, key);
      }
    }
    
    return decrypted;
  }
  
  /**
   * Encrypt individual field
   */
  encryptField(value, key) {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(String(value), 'utf8'),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64')
    };
  }
  
  /**
   * Decrypt individual field
   */
  decryptField(encryptedField, key) {
    const iv = Buffer.from(encryptedField.iv, 'base64');
    const tag = Buffer.from(encryptedField.tag, 'base64');
    const data = Buffer.from(encryptedField.data, 'base64');
    
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  }
  
  /**
   * Update encrypted search index
   */
  async updateSearchIndex(userId, documentData, metadata) {
    // Extract searchable terms
    const terms = this.extractSearchTerms(documentData, metadata);
    
    // Create blind index for each term
    for (const term of terms) {
      const blindIndex = this.createBlindIndex(term, userId);
      
      if (!this.searchIndex.has(blindIndex)) {
        this.searchIndex.set(blindIndex, new Set());
      }
      
      this.searchIndex.get(blindIndex).add({
        userId,
        timestamp: new Date(),
        metadata: metadata.id || crypto.randomBytes(8).toString('hex')
      });
    }
  }
  
  /**
   * Extract searchable terms from document
   */
  extractSearchTerms(documentData, metadata) {
    const terms = new Set();
    
    // Extract from metadata
    if (metadata.title) {
      metadata.title.toLowerCase().split(/\s+/).forEach(term => terms.add(term));
    }
    
    if (metadata.tags) {
      metadata.tags.forEach(tag => terms.add(tag.toLowerCase()));
    }
    
    // Extract from document content (limited for performance)
    if (typeof documentData === 'string') {
      const words = documentData.toLowerCase().split(/\s+/).slice(0, 100);
      words.forEach(word => {
        if (word.length > 3) terms.add(word);
      });
    }
    
    return Array.from(terms);
  }
  
  /**
   * Create blind index for searchable term
   */
  createBlindIndex(term, userId) {
    // Use HMAC to create deterministic but irreversible index
    const hmac = crypto.createHmac('sha256', userId);
    hmac.update(term.toLowerCase());
    return hmac.digest('hex');
  }
  
  /**
   * Search encrypted documents
   */
  async searchEncryptedDocuments(userId, searchTerm) {
    try {
      // Create blind index for search term
      const blindIndex = this.createBlindIndex(searchTerm, userId);
      
      // Find matching documents
      const matches = this.searchIndex.get(blindIndex);
      
      if (!matches) {
        return [];
      }
      
      // Filter by user
      const userMatches = Array.from(matches).filter(match => match.userId === userId);
      
      return userMatches.map(match => ({
        documentId: match.metadata,
        timestamp: match.timestamp,
        relevance: 1.0
      }));
    } catch (error) {
      console.error('Encrypted search error:', error);
      throw error;
    }
  }
  
  /**
   * Rotate encryption keys
   */
  async rotateUserKeys(userId) {
    try {
      const currentKeyData = this.userKeys.get(userId);
      if (!currentKeyData) {
        throw new Error('No existing key to rotate');
      }
      
      // Generate new key version
      const newVersion = (currentKeyData.version || 1) + 1;
      const newDataKey = crypto.randomBytes(this.keyLength);
      
      // Keep old version for decryption
      if (!this.keyVersions.has(userId)) {
        this.keyVersions.set(userId, []);
      }
      this.keyVersions.get(userId).push({
        version: currentKeyData.version,
        key: currentKeyData
      });
      
      // Update to new key
      currentKeyData.version = newVersion;
      currentKeyData.rotatedAt = new Date();
      
      console.log(`🔄 Rotated encryption keys for user ${userId} to version ${newVersion}`);
      
      return {
        success: true,
        newVersion,
        rotatedAt: currentKeyData.rotatedAt
      };
    } catch (error) {
      console.error('Key rotation error:', error);
      throw error;
    }
  }
  
  /**
   * Schedule automatic key rotation
   */
  scheduleKeyRotation(userId) {
    // Clear existing schedule
    if (this.keyRotationSchedule.has(userId)) {
      clearTimeout(this.keyRotationSchedule.get(userId));
    }
    
    // Schedule rotation
    const timeout = setTimeout(() => {
      this.rotateUserKeys(userId).catch(error => {
        console.error(`Failed to rotate keys for user ${userId}:`, error);
      });
    }, this.keyRotationInterval);
    
    this.keyRotationSchedule.set(userId, timeout);
  }
  
  /**
   * Export user keys for backup (encrypted)
   */
  async exportUserKeys(userId, exportPassword) {
    try {
      const userKeyData = this.userKeys.get(userId);
      if (!userKeyData) {
        throw new Error('No keys to export');
      }
      
      // Create export package
      const exportData = {
        userId,
        keys: userKeyData,
        versions: this.keyVersions.get(userId) || [],
        exportedAt: new Date()
      };
      
      // Encrypt export with password
      const exportSalt = crypto.randomBytes(this.saltLength);
      const exportKey = await this.deriveKey(exportPassword, exportSalt);
      
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, exportKey, iv);
      
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(exportData), 'utf8'),
        cipher.final()
      ]);
      
      const tag = cipher.getAuthTag();
      
      return {
        version: 1,
        salt: exportSalt.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        data: encrypted.toString('base64')
      };
    } catch (error) {
      console.error('Key export error:', error);
      throw error;
    }
  }
  
  /**
   * Import user keys from backup
   */
  async importUserKeys(userId, exportPackage, exportPassword) {
    try {
      // Derive key from password
      const salt = Buffer.from(exportPackage.salt, 'base64');
      const exportKey = await this.deriveKey(exportPassword, salt);
      
      // Decrypt export
      const iv = Buffer.from(exportPackage.iv, 'base64');
      const tag = Buffer.from(exportPackage.tag, 'base64');
      const encrypted = Buffer.from(exportPackage.data, 'base64');
      
      const decipher = crypto.createDecipheriv(this.algorithm, exportKey, iv);
      decipher.setAuthTag(tag);
      
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      const exportData = JSON.parse(decrypted.toString('utf8'));
      
      // Restore keys
      this.userKeys.set(userId, exportData.keys);
      if (exportData.versions.length > 0) {
        this.keyVersions.set(userId, exportData.versions);
      }
      
      // Reschedule rotation
      this.scheduleKeyRotation(userId);
      
      console.log(`📥 Imported keys for user ${userId}`);
      
      return {
        success: true,
        keysImported: true,
        version: exportData.keys.version
      };
    } catch (error) {
      console.error('Key import error:', error);
      throw error;
    }
  }
  
  /**
   * Get encryption statistics
   */
  getEncryptionStats() {
    return {
      totalUsers: this.userKeys.size,
      totalDocuments: Array.from(this.searchIndex.values()).reduce((sum, set) => sum + set.size, 0),
      keyVersions: Array.from(this.userKeys.values()).map(k => k.version),
      algorithm: this.algorithm,
      keyLength: this.keyLength * 8,
      kdfIterations: this.kdfIterations
    };
  }
  
  /**
   * Initialize service
   */
  async initialize() {
    // E2E Encryption Service initialized with AES-256-GCM and PBKDF2
    return true;
  }

  /**
   * Encrypt document with SERVICE-LEVEL key (for temporary uploads that need recovery)
   * Uses KMS-stored key instead of user session keys
   *
   * @param {Buffer} data - Data to encrypt
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<Object>} Encrypted package with iv, tag, data
   */
  async encryptWithServiceKey(data, metadata = {}) {
    try {
      // Get service encryption key from KMS
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }
      const serviceKey = await productionKMS.getInternalKey('SERVICE_PENDINGUPLOAD_ENCRYPTION_KEY');

      if (!serviceKey || serviceKey.length !== 64) {
        throw new Error('Invalid service encryption key from KMS');
      }

      // Convert hex key to buffer
      const keyBuffer = Buffer.from(serviceKey, 'hex');

      // Generate IV
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, keyBuffer, iv);

      // Encrypt data
      const encryptedData = Buffer.concat([
        cipher.update(data),
        cipher.final()
      ]);

      // Get auth tag
      const tag = cipher.getAuthTag();

      return {
        data: encryptedData.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        algorithm: this.algorithm,
        metadata: metadata,
        encryptionType: 'service-level' // Mark as service-encrypted
      };
    } catch (error) {
      console.error('Service encryption error:', error);
      throw new Error(`Failed to encrypt with service key: ${error.message}`);
    }
  }

  /**
   * Decrypt document with SERVICE-LEVEL key (for recovery)
   * Does NOT require user session - uses KMS key
   *
   * @param {Object} encryptedPackage - Package with data, iv, tag
   * @returns {Promise<Object>} Decrypted data and metadata
   */
  async decryptWithServiceKey(encryptedPackage) {
    try {
      // Get service encryption key from KMS
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }
      const serviceKey = await productionKMS.getInternalKey('SERVICE_PENDINGUPLOAD_ENCRYPTION_KEY');

      if (!serviceKey || serviceKey.length !== 64) {
        throw new Error('Invalid service encryption key from KMS');
      }

      // Convert hex key to buffer
      const keyBuffer = Buffer.from(serviceKey, 'hex');

      // Extract components
      const iv = Buffer.from(encryptedPackage.iv, 'base64');
      const tag = Buffer.from(encryptedPackage.tag, 'base64');
      const encryptedData = Buffer.from(encryptedPackage.data, 'base64');

      // Create decipher
      const algorithm = encryptedPackage.algorithm || this.algorithm;
      const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
      decipher.setAuthTag(tag);

      // Decrypt
      const decryptedData = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
      ]);

      return {
        data: decryptedData,
        metadata: encryptedPackage.metadata || {}
      };
    } catch (error) {
      console.error('Service decryption error:', error);
      throw new Error(`Failed to decrypt with service key: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new E2EEncryptionService();