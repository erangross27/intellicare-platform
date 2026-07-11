/**
 * Simple KMS Service
 * A simplified, working KMS for internal key management
 * Keeps external API keys (Google, Anthropic) in environment
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class SimpleKMS {
  constructor() {
    this.initialized = false;
    this.masterKey = null;
    this.keys = new Map();
    this.serviceToken = null;
  }

  async initialize() {
    if (this.initialized) return;
    
    console.log('🔐 Initializing Simple KMS...');
    
    // Authenticate service
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('simpleKMS');
    
    // Generate or load master key
    await this.initializeMasterKey();
    
    this.initialized = true;
    console.log('✅ Simple KMS initialized');
  }

  /**
   * Get service context for database operations
   */
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'simpleKMS',
      operation: 'database-access',
      practiceId: practiceId
    };
  }

  async initializeMasterKey() {
    const kmsDir = path.join(__dirname, '../../../../backend/.kms');
    const masterKeyPath = path.join(kmsDir, 'master.key');
    
    try {
      // Try to load existing master key
      await fs.mkdir(kmsDir, { recursive: true });
      const encrypted = await fs.readFile(masterKeyPath, 'utf8');
      this.masterKey = Buffer.from(encrypted, 'base64');
      // Loaded existing master key
    } catch (error) {
      // Generate new master key
      console.log('🔑 Generating new master key...');
      this.masterKey = crypto.randomBytes(32);
      
      // Save it
      await fs.mkdir(kmsDir, { recursive: true });
      await fs.writeFile(masterKeyPath, this.masterKey.toString('base64'));
      console.log('💾 Master key saved');
    }
  }

  /**
   * Simple encrypt function that works
   */
  encrypt(plaintext, purpose = 'general') {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.masterKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Return as simple object
    return {
      encrypted: encrypted,
      iv: iv.toString('base64'),
      purpose: purpose
    };
  }

  /**
   * Simple decrypt function that works
   */
  decrypt(encryptedData) {
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.masterKey, iv);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Store an internal key
   */
  async storeInternalKey(keyName, keyValue) {
    const encrypted = this.encrypt(keyValue, keyName);
    this.keys.set(keyName, encrypted);
    
    // Persist to file
    const kmsDir = path.join(__dirname, '../../../../backend/.kms');
    const keyPath = path.join(kmsDir, `${keyName}.key`);
    await fs.writeFile(keyPath, JSON.stringify(encrypted));
    
    return true;
  }

  /**
   * Get an internal key
   */
  async getInternalKey(keyName) {
    // Check memory cache
    if (this.keys.has(keyName)) {
      const encrypted = this.keys.get(keyName);
      return this.decrypt(encrypted);
    }
    
    // Try to load from file
    try {
      const kmsDir = path.join(__dirname, '../../../../backend/.kms');
      const keyPath = path.join(kmsDir, `${keyName}.key`);
      const data = await fs.readFile(keyPath, 'utf8');
      const encrypted = JSON.parse(data);
      
      // Cache it
      this.keys.set(keyName, encrypted);
      
      return this.decrypt(encrypted);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get key (internal from KMS or external from env)
   */
  async getKey(keyName) {
    // External keys - keep in environment
    const externalKeys = [
      'GEMINI_API_KEY',
      'GOOGLE_API_KEY',
      'CLAUDE_API_KEY',
      'ANTHROPIC_API_KEY',
      'SENDGRID_API_KEY',
      'MONGODB_URI'
    ];
    
    if (externalKeys.includes(keyName)) {
      return process.env[keyName];
    }
    
    // Internal keys - from KMS
    return await this.getInternalKey(keyName);
  }

  /**
   * Migrate internal keys from environment to KMS
   */
  async migrateInternalKeys() {
    console.log('🔄 Migrating internal keys to KMS...');
    
    const internalKeys = [
      'JWT_SECRET',
      'SESSION_SECRET',
      'MONGODB_ENCRYPTION_KEY'
    ];
    
    for (const keyName of internalKeys) {
      let keyValue = process.env[keyName];
      
      if (!keyValue) {
        // Generate new key if doesn't exist
        keyValue = crypto.randomBytes(32).toString('hex');
        console.log(`  📝 Generated new ${keyName}`);
      }
      
      // Store in KMS
      await this.storeInternalKey(keyName, keyValue);
      console.log(`  ✅ Migrated ${keyName} to KMS`);
      
      // Remove from environment
      delete process.env[keyName];
    }
    
    console.log('✅ Internal keys migrated to KMS');
  }

  /**
   * Create context for service authentication
   */
  async createServiceContext(serviceId) {
    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Encrypt it
    const encrypted = this.encrypt(sessionToken, `session-${serviceId}`);
    
    return {
      serviceId,
      sessionToken: encrypted,
      timestamp: Date.now()
    };
  }

  /**
   * Validate service context
   */
  async validateServiceContext(context) {
    try {
      // Decrypt and validate
      const sessionToken = this.decrypt(context.sessionToken);
      return sessionToken && sessionToken.length > 0;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton
const simpleKMS = new SimpleKMS();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('simpleKMS', () => simpleKMS);
}

module.exports = simpleKMS;