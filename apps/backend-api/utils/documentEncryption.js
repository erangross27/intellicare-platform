// Document Encryption/Decryption Utilities for HIPAA Compliance
const crypto = require('crypto');
const productionKMS = require('../services/productionKMS');

class DocumentEncryption {
  constructor() {
    this.initialized = false;
    this.masterKey = null;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize KMS if not already initialized
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }
      
      // Get master key from KMS
      let keyValue = await productionKMS.getKey('DOCUMENT_ENCRYPTION_KEY');
      
      if (!keyValue) {
        // Generate new key if doesn't exist
        keyValue = crypto.randomBytes(32).toString('hex');
        await productionKMS.storeInternalKey('DOCUMENT_ENCRYPTION_KEY', keyValue);
      }
      
      this.masterKey = keyValue;
      
      // Validate key length (should be at least 32 chars for AES-256)
      if (this.masterKey.length < 32) {
        throw new Error('DOCUMENT_ENCRYPTION_KEY must be at least 32 characters');
      }
      
      // If key is longer than 32 bytes, hash it to get consistent 32-byte key
      if (this.masterKey.length > 32) {
        this.masterKey = crypto.createHash('sha256')
          .update(this.masterKey)
          .digest();
      } else {
        // Ensure it's a buffer
        this.masterKey = Buffer.from(this.masterKey);
      }
      
      this.initialized = true;
      // Document encryption initialized
    } catch (error) {
      console.error('Failed to initialize DocumentEncryption:', error);
      throw error;
    }
  }
  
  /**
   * Encrypt a document buffer
   * @param {Buffer} documentBuffer - The document to encrypt
   * @returns {Object} Encrypted data with salt and IV
   */
  async encryptDocument(documentBuffer) {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Generate unique salt for this document
      const salt = crypto.randomBytes(32);
      
      // Derive document-specific key from master key
      const derivedKey = crypto.pbkdf2Sync(this.masterKey, salt, 100000, 32, 'sha256');
      
      // Generate initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
      
      // Encrypt the document
      const encryptedBuffer = Buffer.concat([
        cipher.update(documentBuffer),
        cipher.final()
      ]);
      
      return {
        encryptedContent: encryptedBuffer,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        method: 'aes-256-cbc-pbkdf2',
        keyDerivation: {
          iterations: 100000,
          hash: 'sha256'
        }
      };
    } catch (error) {
      console.error('❌ Encryption error:', error);
      throw new Error('Failed to encrypt document');
    }
  }
  
  /**
   * Decrypt a document
   * @param {Buffer} encryptedBuffer - The encrypted document
   * @param {String} saltHex - The salt used for key derivation (hex string)
   * @param {String} ivHex - The initialization vector (hex string)
   * @returns {Buffer} Decrypted document
   */
  async decryptDocument(encryptedBuffer, saltHex, ivHex) {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Validate inputs
      if (!encryptedBuffer) {
        throw new Error('Encrypted buffer is required');
      }
      if (!saltHex) {
        throw new Error('Salt is required for decryption');
      }
      if (!ivHex) {
        throw new Error('IV is required for decryption');
      }
      
      // Convert hex strings back to buffers
      const salt = Buffer.from(saltHex, 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      
      // Derive the same key using the salt
      const derivedKey = crypto.pbkdf2Sync(this.masterKey, salt, 100000, 32, 'sha256');
      
      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
      
      // Decrypt the document
      const decryptedBuffer = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final()
      ]);
      
      return decryptedBuffer;
    } catch (error) {
      console.error('❌ Decryption error:', error);
      throw new Error('Failed to decrypt document');
    }
  }
  
  /**
   * Generate a secure document ID
   * @returns {String} Hex string document ID
   */
  generateDocumentId() {
    return crypto.randomBytes(16).toString('hex');
  }
  
  /**
   * Hash sensitive data for storage (one-way)
   * @param {String} data - Data to hash
   * @returns {String} SHA-256 hash
   */
  hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Verify file integrity using hash
   * @param {Buffer} documentBuffer - Document to verify
   * @param {String} expectedHash - Expected SHA-256 hash
   * @returns {Boolean} True if hash matches
   */
  verifyIntegrity(documentBuffer, expectedHash) {
    const actualHash = crypto.createHash('sha256')
      .update(documentBuffer)
      .digest('hex');
    return actualHash === expectedHash;
  }
}

// Export singleton instance
module.exports = new DocumentEncryption();