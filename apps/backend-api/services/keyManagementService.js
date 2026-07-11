/**
 * 🔐 ENCRYPTION KEY MANAGEMENT SERVICE
 * Secure key storage, rotation, and management for HIPAA compliance
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class KeyManagementService {
  constructor() {
    // Use 7 days instead of 30 to avoid 32-bit integer overflow
    this.keyRotationInterval = 7 * 24 * 60 * 60 * 1000; // 7 days (604,800,000 ms)
    this.keyHistory = new Map();
    this.currentKeyId = null;
    this.keyDerivationSalt = null;
    this.initialized = false;
    this.rotationScheduled = false; // Prevent multiple scheduling
  }

  // Initialize key management system
  async initialize() {
    try {
      await this.loadOrCreateMasterKey();
      await this.loadKeyHistory();

      // Only schedule rotation if not already scheduled
      if (!this.rotationScheduled) {
        this.scheduleKeyRotation();
        this.rotationScheduled = true;
      }

      this.initialized = true;
      // Key Management Service initialized
    } catch (error) {
      console.error('❌ Failed to initialize Key Management Service:', error);
      throw error;
    }
  }

  // Load or create master encryption key
  async loadOrCreateMasterKey() {
    const keyPath = path.join(__dirname, '../config/master.key');
    const saltPath = path.join(__dirname, '../config/master.salt');
    
    try {
      // Try to load existing key
      const keyData = await fs.readFile(keyPath);
      const saltData = await fs.readFile(saltPath);
      
      this.currentKeyId = keyData.toString('hex').substring(0, 16);
      this.keyDerivationSalt = saltData;
      
      // Loaded existing master key
    } catch (error) {
      // Create new master key
      console.log('🔑 Creating new master key...');
      
      const masterKey = crypto.randomBytes(32); // 256-bit key
      const salt = crypto.randomBytes(32); // 256-bit salt
      
      // Ensure config directory exists
      await fs.mkdir(path.dirname(keyPath), { recursive: true });
      
      // Save key and salt securely
      await fs.writeFile(keyPath, masterKey, { mode: 0o600 });
      await fs.writeFile(saltPath, salt, { mode: 0o600 });
      
      this.currentKeyId = masterKey.toString('hex').substring(0, 16);
      this.keyDerivationSalt = salt;
      
      // Created new master key
    }
  }

  // Load key rotation history
  async loadKeyHistory() {
    const historyPath = path.join(__dirname, '../config/key.history');
    
    try {
      const historyData = await fs.readFile(historyPath, 'utf8');
      const history = JSON.parse(historyData);
      
      for (const [keyId, keyInfo] of Object.entries(history)) {
        this.keyHistory.set(keyId, {
          ...keyInfo,
          createdAt: new Date(keyInfo.createdAt),
          expiresAt: keyInfo.expiresAt ? new Date(keyInfo.expiresAt) : null
        });
      }
      
      // Loaded key history
    } catch (error) {
      // Create new history
      // Creating new key history
      await this.saveKeyHistory();
    }
  }

  // Save key history
  async saveKeyHistory() {
    const historyPath = path.join(__dirname, '../config/key.history');
    
    const historyObj = {};
    for (const [keyId, keyInfo] of this.keyHistory.entries()) {
      historyObj[keyId] = {
        ...keyInfo,
        createdAt: keyInfo.createdAt.toISOString(),
        expiresAt: keyInfo.expiresAt ? keyInfo.expiresAt.toISOString() : null
      };
    }
    
    await fs.writeFile(historyPath, JSON.stringify(historyObj, null, 2), { mode: 0o600 });
  }

  // Derive encryption key from master key
  deriveEncryptionKey(keyId = this.currentKeyId, purpose = 'document') {
    if (!this.initialized) {
      throw new Error('Key Management Service not initialized');
    }

    const keyInfo = this.keyHistory.get(keyId) || {
      createdAt: new Date(),
      purpose: purpose,
      algorithm: 'aes-256-gcm'
    };

    // Derive key using PBKDF2
    const derivedKey = crypto.pbkdf2Sync(
      keyId + purpose,
      this.keyDerivationSalt,
      100000, // 100k iterations
      32, // 256-bit key
      'sha256'
    );

    return {
      key: derivedKey,
      keyId: keyId,
      algorithm: keyInfo.algorithm || 'aes-256-gcm',
      createdAt: keyInfo.createdAt
    };
  }

  // Rotate encryption keys
  async rotateKeys() {
    console.log('🔄 Starting key rotation...');
    
    try {
      // Mark current key as expired
      if (this.currentKeyId && this.keyHistory.has(this.currentKeyId)) {
        const currentKey = this.keyHistory.get(this.currentKeyId);
        currentKey.expiresAt = new Date();
        this.keyHistory.set(this.currentKeyId, currentKey);
      }

      // Generate new key ID
      const newKeyId = crypto.randomBytes(8).toString('hex');
      
      // Add new key to history
      this.keyHistory.set(newKeyId, {
        createdAt: new Date(),
        purpose: 'document',
        algorithm: 'aes-256-gcm',
        rotationReason: 'scheduled'
      });

      // Update current key
      this.currentKeyId = newKeyId;
      
      // Save history
      await this.saveKeyHistory();
      
      console.log(`🔄 Key rotation completed: ${newKeyId}`);
      
      // Clean up old keys (keep last 5 for decryption)
      await this.cleanupOldKeys();
      
    } catch (error) {
      console.error('❌ Key rotation failed:', error);
      throw error;
    }
  }

  // Clean up old keys
  async cleanupOldKeys() {
    const sortedKeys = Array.from(this.keyHistory.entries())
      .sort(([,a], [,b]) => b.createdAt - a.createdAt);
    
    // Keep only the 5 most recent keys
    const keysToRemove = sortedKeys.slice(5);
    
    for (const [keyId] of keysToRemove) {
      this.keyHistory.delete(keyId);
      console.log(`🗑️ Removed old key: ${keyId}`);
    }
    
    if (keysToRemove.length > 0) {
      await this.saveKeyHistory();
    }
  }

  // Schedule automatic key rotation
  scheduleKeyRotation() {
    // Check every hour if key rotation is needed (avoids 32-bit integer overflow)
    const checkInterval = 60 * 60 * 1000; // 1 hour

    setInterval(async () => {
      try {
        if (this.shouldRotateKey()) {
          await this.rotateKeys();
        }
      } catch (error) {
        console.error('❌ Scheduled key rotation check failed:', error);
      }
    }, checkInterval);

    // Key rotation scheduled - checking hourly
  }

  // Check if key rotation is needed
  shouldRotateKey() {
    if (!this.currentKeyId || !this.keyHistory.has(this.currentKeyId)) {
      return true; // No current key, need to rotate
    }

    const keyInfo = this.keyHistory.get(this.currentKeyId);
    const keyAge = Date.now() - keyInfo.createdAt.getTime();

    return keyAge >= this.keyRotationInterval;
  }

  // Get key for decryption (supports old keys)
  getDecryptionKey(keyId) {
    if (!this.keyHistory.has(keyId)) {
      throw new Error(`Key not found: ${keyId}`);
    }

    return this.deriveEncryptionKey(keyId);
  }

  // Get current encryption key
  getCurrentEncryptionKey() {
    return this.deriveEncryptionKey(this.currentKeyId);
  }

  // Validate key health
  validateKeyHealth() {
    const issues = [];
    
    // Check if current key exists
    if (!this.currentKeyId) {
      issues.push('No current encryption key');
    }

    // Check key age
    if (this.currentKeyId && this.keyHistory.has(this.currentKeyId)) {
      const keyInfo = this.keyHistory.get(this.currentKeyId);
      const keyAge = Date.now() - keyInfo.createdAt.getTime();
      
      if (keyAge > this.keyRotationInterval * 1.1) { // 10% grace period
        issues.push(`Current key is overdue for rotation (${Math.floor(keyAge / (24 * 60 * 60 * 1000))} days old)`);
      }
    }

    // Check key history size
    if (this.keyHistory.size < 2) {
      issues.push('Insufficient key history for secure rotation');
    }

    return {
      healthy: issues.length === 0,
      issues: issues,
      currentKeyId: this.currentKeyId,
      keyCount: this.keyHistory.size,
      lastRotation: this.keyHistory.get(this.currentKeyId)?.createdAt
    };
  }

  // Emergency key rotation (in case of compromise)
  async emergencyKeyRotation(reason = 'security_incident') {
    console.warn(`🚨 Emergency key rotation triggered: ${reason}`);
    
    // Mark all existing keys as compromised
    for (const [keyId, keyInfo] of this.keyHistory.entries()) {
      keyInfo.compromised = true;
      keyInfo.compromisedAt = new Date();
      keyInfo.compromiseReason = reason;
    }

    // Generate new key immediately
    await this.rotateKeys();
    
    console.warn(`🚨 Emergency key rotation completed`);
  }

  // Get key management status
  getStatus() {
    const health = this.validateKeyHealth();
    
    return {
      initialized: this.initialized,
      currentKeyId: this.currentKeyId,
      keyCount: this.keyHistory.size,
      health: health,
      rotationInterval: this.keyRotationInterval,
      nextRotation: this.keyHistory.get(this.currentKeyId)?.createdAt 
        ? new Date(this.keyHistory.get(this.currentKeyId).createdAt.getTime() + this.keyRotationInterval)
        : null
    };
  }
}

// Singleton instance
const keyManagementService = new KeyManagementService();

module.exports = keyManagementService;
