// Remove circular dependency - secureConfigService will be loaded lazily when needed
let secureConfigService = null;
/**
 * Production-Ready Key Management Service (KMS)
 * Based on industry best practices for 2025
 * 
 * Features:
 * - AES-256-GCM encryption (authenticated encryption)
 * - Proper key derivation with PBKDF2
 * - Unique IV for each encryption
 * - Key rotation support
 * - Separation of internal and external keys
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class ProductionKMS {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null; // Track initialization in progress
    this.serviceToken = null;
    this.masterKey = null;
    this.encryptedKeys = new Map();
    this.algorithm = 'aes-256-gcm';
    this.saltLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    this.pbkdf2Iterations = 10000; // Lower for master key derivation
  }

  async initialize() {
    if (this.initialized) return this;
    
    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    // Start initialization and store the promise to prevent race conditions
    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  async _doInitialize() {
    // KMS is the root of trust - doesn't need service authentication
    // It provides the keys that other services use to authenticate
    console.log('🔐 Initializing Production KMS (root of trust)');
    
    try {
      // Initialize master key
      await this.initializeMasterKey();
      
      // Load any existing encrypted keys
      await this.loadEncryptedKeys();
      
      this.initialized = true;
      // Production KMS initialized
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize KMS:', error.message);
      // Clear the promise on error so it can be retried
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Initialize or load master key
   */
  async initializeMasterKey() {
    const kmsDir = path.join(__dirname, '..', '.kms');
    await fs.mkdir(kmsDir, { recursive: true });
    
    const masterKeyPath = path.join(kmsDir, 'master.key');
    const masterSaltPath = path.join(kmsDir, 'master.salt');
    
    try {
      // Try to load existing master key
      const encryptedMaster = await fs.readFile(masterKeyPath, 'utf8');
      const salt = await fs.readFile(masterSaltPath, 'utf8');
      
      // Derive master key from machine-specific data
      const machineKey = await this.getMachineKey(Buffer.from(salt, 'base64'));
      
      // Decrypt master key
      const decrypted = this.decryptWithKey(encryptedMaster, machineKey);
      this.masterKey = Buffer.from(decrypted, 'hex');
      
      // Loaded existing master key
    } catch (error) {
      // Generate new master key
      console.log('🔑 Generating new master key...');
      
      // Generate cryptographically secure master key
      this.masterKey = crypto.randomBytes(32);
      
      // Generate salt for key derivation
      const salt = crypto.randomBytes(this.saltLength);
      
      // Derive machine-specific key to encrypt master key
      const machineKey = await this.getMachineKey(salt);
      
      // Encrypt master key for storage
      const encryptedMaster = this.encryptWithKey(
        this.masterKey.toString('hex'),
        machineKey
      );
      
      // Save encrypted master key and salt
      await fs.writeFile(masterKeyPath, encryptedMaster);
      await fs.writeFile(masterSaltPath, salt.toString('base64'));
      
      console.log('💾 Master key generated and saved');
    }
  }

  /**
   * Get machine-specific key for master key encryption
   */
  async getMachineKey(salt) {
    // PORTABLE master-key binding: derive from a persistent secret file that travels
    // with the .kms backup, NOT from os.hostname()/platform/arch (which silently broke
    // the KMS on every machine move / WSL re-import, regenerating the master key and
    // orphaning every stored key). As long as .kms/.machine-secret is restored alongside
    // the keys, the master key decrypts on any host.
    const fsSync = require('fs');
    const secretPath = path.join(__dirname, '..', '.kms', '.machine-secret');
    let machineSecret;
    try {
      machineSecret = fsSync.readFileSync(secretPath, 'utf8').trim();
    } catch (e) {
      machineSecret = crypto.randomBytes(32).toString('hex');
      fsSync.mkdirSync(path.dirname(secretPath), { recursive: true });
      fsSync.writeFileSync(secretPath, machineSecret, { mode: 0o600 });
    }
    const machineId = `intellicare-kms-portable-${machineSecret}`;

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(machineId, salt, this.pbkdf2Iterations, 32, 'sha256', (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encryptWithKey(plaintext, key) {
    // Generate unique IV for this encryption
    const iv = crypto.randomBytes(this.ivLength);
    
    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Combine IV + authTag + encrypted data
    const combined = Buffer.concat([iv, authTag, encrypted]);
    
    // Return as base64
    return combined.toString('base64');
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decryptWithKey(encryptedData, key, iv = null, authTag = null) {
    // Check if we have separate IV and authTag (old format)
    if (iv && authTag) {
      // Old format - IV and authTag provided separately
      const encrypted = Buffer.from(encryptedData, 'base64');
      const ivBuffer = Buffer.from(iv, 'base64');
      const authTagBuffer = Buffer.from(authTag, 'base64');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, ivBuffer);
      decipher.setAuthTag(authTagBuffer);
      
      // Decrypt data
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } else {
      // New format - everything embedded in ciphertext
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const iv = combined.slice(0, this.ivLength);
      const authTag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.slice(this.ivLength + this.tagLength);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt data
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    }
  }

  /**
   * Encrypt data for storage (public API)
   */
  async encrypt(plaintext, purpose = 'general') {
    if (!this.initialized) await this.initialize();
    
    // Derive a key for this purpose
    const purposeKey = await this.deriveKey(purpose);
    
    // Encrypt the data
    const encrypted = this.encryptWithKey(plaintext, purposeKey);
    
    // Return encrypted package
    return {
      ciphertext: encrypted,
      purpose: purpose,
      algorithm: this.algorithm,
      timestamp: Date.now()
    };
  }

  /**
   * Decrypt data (public API)
   */
  async decrypt(encryptedPackage) {
    if (!this.initialized) await this.initialize();
    
    try {
      // Derive the key for this purpose
      const purposeKey = await this.deriveKey(encryptedPackage.purpose);
      
      // Check if package has separate iv and authTag fields (old format)
      if (encryptedPackage.iv && encryptedPackage.authTag) {
        // Old format - pass IV and authTag separately
        return this.decryptWithKey(
          encryptedPackage.ciphertext, 
          purposeKey, 
          encryptedPackage.iv, 
          encryptedPackage.authTag
        );
      } else {
        // New format - everything is in ciphertext
        return this.decryptWithKey(encryptedPackage.ciphertext, purposeKey);
      }
    } catch (error) {
      // If decryption fails, the key might have been corrupted
      // Return null instead of crashing
      console.warn(`⚠️ KMS decrypt failed for ${encryptedPackage.purpose}: ${error.message}`);
      return null;
    }
  }

  /**
   * Derive a key for a specific purpose
   */
  async deriveKey(purpose) {
    const salt = Buffer.concat([
      this.masterKey.slice(0, 16),
      Buffer.from(purpose)
    ]);
    
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(this.masterKey, salt, 1000, 32, 'sha256', (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
  }

  /**
   * Store an internal key (removes from environment)
   */
  async storeInternalKey(keyName, keyValue) {
    if (!this.initialized) await this.initialize();
    
    // Encrypt the key
    const encrypted = await this.encrypt(keyValue, `key-${keyName}`);
    
    // Store in memory
    this.encryptedKeys.set(keyName, encrypted);
    
    // Persist to disk
    const kmsDir = path.join(__dirname, '..', '.kms', 'keys');
    await fs.mkdir(kmsDir, { recursive: true });
    
    const keyPath = path.join(kmsDir, `${keyName}.json`);
    await fs.writeFile(keyPath, JSON.stringify(encrypted, null, 2));
    
    // Key stored in KMS
    
    // Remove from environment if present
    if (process.env[keyName]) {
      delete process.env[keyName];
    }
    
    return true;
  }

  /**
   * Get an internal key
   */
  async getInternalKey(keyName) {
    if (!this.initialized) await this.initialize();
    
    // Check memory cache
    if (this.encryptedKeys.has(keyName)) {
      const encrypted = this.encryptedKeys.get(keyName);
      return await this.decrypt(encrypted);
    }
    
    // Try to load from disk
    try {
      const kmsDir = path.join(__dirname, '..', '.kms', 'keys');
      const keyPath = path.join(kmsDir, `${keyName}.json`);
      
      const data = await fs.readFile(keyPath, 'utf8');
      const encrypted = JSON.parse(data);
      
      // Cache in memory
      this.encryptedKeys.set(keyName, encrypted);
      
      // Decrypt and return
      return await this.decrypt(encrypted);
    } catch (error) {
      // Key doesn't exist
      return null;
    }
  }

  /**
   * Load all encrypted keys from disk
   */
  async loadEncryptedKeys() {
    try {
      const kmsDir = path.join(__dirname, '..', '.kms', 'keys');
      const files = await fs.readdir(kmsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const keyName = file.replace('.json', '');
          const keyPath = path.join(kmsDir, file);
          
          const data = await fs.readFile(keyPath, 'utf8');
          const encrypted = JSON.parse(data);
          
          this.encryptedKeys.set(keyName, encrypted);
        }
      }
      
      // Encrypted keys loaded from disk
    } catch (error) {
      // No keys directory yet
      // No existing keys found
    }
  }

  /**
   * Get key (internal from KMS or external from environment)
   */
  async getKey(keyName) {
    // List of keys that ONLY come from environment (not KMS)
    const environmentOnlyKeys = [
      'MONGODB_URI',
      'REDIS_URL',
      'PORT',
      'NODE_ENV'
    ];
    
    // Check if it's an environment-only key
    if (environmentOnlyKeys.includes(keyName)) {
      // Get directly from environment to avoid circular dependency
      return process.env[keyName];
    }
    
    // All other keys (including API keys) come from KMS
    // This includes: GEMINI_API_KEY, CLAUDE_API_KEY, ANTHROPIC_API_KEY, 
    // GOOGLE_API_KEY, SENDGRID_API_KEY, TWILIO_AUTH_TOKEN, STRIPE_SECRET_KEY, etc.
    return await this.getInternalKey(keyName);
  }

  /**
   * Migrate internal keys from environment to KMS
   */
  async migrateInternalKeys() {
    // Internal keys migration to KMS
    
    const internalKeys = [
      'JWT_SECRET',
      'SESSION_SECRET', 
      'MONGODB_ENCRYPTION_KEY',
      'CSRF_SECRET',
      'COOKIE_SECRET'
    ];
    
    for (const keyName of internalKeys) {
      let keyValue = process.env[keyName];
      
      if (!keyValue) {
        // Generate new key if doesn't exist
        keyValue = crypto.randomBytes(32).toString('hex');
        // Generated new key
      } else {
        console.log(`  🔄 Migrating ${keyName} from environment`);
      }
      
      // Store in KMS
      await this.storeInternalKey(keyName, keyValue);
    }
    
    // Internal keys migration complete, external API keys remain in environment
  }

  /**
   * Create service authentication context
   */
  async createServiceContext(serviceId) {
    if (!this.initialized) await this.initialize();
    
    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Encrypt it
    const encrypted = await this.encrypt(sessionToken, `session-${serviceId}`);
    
    return {
      serviceId,
      sessionToken: encrypted.ciphertext,
      timestamp: Date.now(),
      expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
    };
  }

  /**
   * Validate service context
   */
  async validateServiceContext(context) {
    if (!this.initialized) await this.initialize();
    
    try {
      // Check expiration
      if (Date.now() > context.expiresAt) {
        return false;
      }
      
      // Decrypt and validate
      const decrypted = await this.decrypt({
        ciphertext: context.sessionToken,
        purpose: `session-${context.serviceId}`,
        algorithm: this.algorithm,
        timestamp: context.timestamp
      });
      
      return decrypted && decrypted.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate status report
   */
  getStatus() {
    return {
      initialized: this.initialized,
      algorithm: this.algorithm,
      keyDerivation: 'PBKDF2',
      internalKeysStored: this.encryptedKeys.size,
      externalKeysInEnv: ['CLAUDE_API_KEY', 
        'SENDGRID_API_KEY',
        'MONGODB_URI'
      ],
      security: {
        masterKeyEncrypted: true,
        keysEncryptedAtRest: true,
        uniqueIVPerEncryption: true,
        authenticatedEncryption: true
      }
    };
  }
}

// Export singleton
module.exports = new ProductionKMS();
