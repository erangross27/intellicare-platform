/**
 * Secure Configuration Service
 * 
 * Provides secure access to configuration values without exposing process.env
 * Implements encryption for sensitive values and audit logging for access
 * 
 * SECURITY: This is the ONLY service allowed to access process.env directly
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Use service proxy manager to avoid circular dependency
const serviceProxyManager = require('./serviceProxyManager');

class SecureConfigService {
  constructor() {
    this.configCache = new Map();
    this.sensitiveKeys = new Set([
      'JWT_SECRET',
      'MONGODB_URI',
      'MONGODB_PASSWORD','OPENAI_API_KEY',
      'AWS_SECRET_ACCESS_KEY',
      'GOOGLE_KMS_KEY',
      'ENCRYPTION_KEY',
      'SESSION_SECRET',
      'TWILIO_AUTH_TOKEN',
      'SENDGRID_API_KEY',
      'SMTP_PASSWORD',
      'REDIS_PASSWORD'
    ]);
    
    this.accessLog = [];
    this.encryptionKey = this.deriveEncryptionKey();
    this.initialized = false;
  }

  /**
   * Initialize the service and load configuration
   */
  async initialize() {
    if (this.initialized) return;
    
    // Secure Configuration Service initialization
    
    // Load configuration from environment
    this.loadEnvironmentConfig();
    
    // Load configuration from files
    await this.loadFileConfig();
    
    // Load internal keys from KMS
    await this.loadKMSConfig();
    
    // Validate required configuration
    this.validateConfig();
    
    this.initialized = true;
    // Secure Configuration Service initialized
  }

  /**
   * Load configuration from environment variables
   * SECURITY: This is the ONLY place process.env should be accessed
   */
  loadEnvironmentConfig() {
    const env = process.env;
    
    // Store all environment variables securely
    Object.keys(env).forEach(key => {
      const value = env[key];
      
      if (this.sensitiveKeys.has(key)) {
        // Encrypt sensitive values
        this.configCache.set(key, this.encryptValue(value));
      } else {
        // Store non-sensitive values as-is
        this.configCache.set(key, value);
      }
    });
  }

  /**
   * Load configuration from config files
   */
  async loadFileConfig() {
    try {
      // Load default config
      const defaultConfigPath = path.join(__dirname, '../config/default.json');
      if (fs.existsSync(defaultConfigPath)) {
        const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf-8'));
        this.mergeConfig(defaultConfig);
      }
      
      // Load environment-specific config
      const env = this.get('NODE_ENV', 'development');
      const envConfigPath = path.join(__dirname, `../config/${env}.json`);
      if (fs.existsSync(envConfigPath)) {
        const envConfig = JSON.parse(fs.readFileSync(envConfigPath, 'utf-8'));
        this.mergeConfig(envConfig);
      }
      
      // Load local config (not in git)
      const localConfigPath = path.join(__dirname, '../config/local.json');
      if (fs.existsSync(localConfigPath)) {
        const localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf-8'));
        this.mergeConfig(localConfig);
      }
    } catch (error) {
      console.error('⚠️ Error loading config files:', error.message);
    }
  }
  
  /**
   * Load internal keys from KMS
   */
  async loadKMSConfig() {
    try {
      const kms = this.getProductionKMS();
      if (!kms) {
        // KMS not available yet, skip for now
        console.log('⏳ KMS not available yet, will load keys later');
        return;
      }
      await kms.initialize();
      
      // Load critical internal keys from KMS
      const internalKeys = [
        'JWT_SECRET',
        'SESSION_SECRET',
        'MONGODB_ENCRYPTION_KEY',
        'CSRF_SECRET',
        'COOKIE_SECRET',
        'DOCUMENT_ENCRYPTION_KEY',  // Added for document upload encryption
        'CLAUDE_API_KEY','ANTHROPIC_API_KEY',
        'GOOGLE_API_KEY',
        'SENDGRID_API_KEY'
      ];
      
      for (const key of internalKeys) {
        const kms = this.getProductionKMS();
        const value = await kms.getKey(key);
        if (value) {
          // Store as sensitive value
          this.configCache.set(key, this.encryptValue(value));
          this.sensitiveKeys.add(key);
        }
      }
      
      // Loaded internal keys from KMS
    } catch (error) {
      console.error('⚠️ Error loading KMS config:', error.message);
    }
  }

  /**
   * Merge configuration object into cache
   */
  mergeConfig(config, prefix = '') {
    Object.keys(config).forEach(key => {
      const fullKey = prefix ? `${prefix}_${key}` : key;
      const value = config[key];
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        // Recursively merge nested objects
        this.mergeConfig(value, fullKey.toUpperCase());
      } else {
        // Store the value
        const envKey = fullKey.toUpperCase().replace(/\./g, '_');
        if (!this.configCache.has(envKey)) {
          if (this.sensitiveKeys.has(envKey)) {
            this.configCache.set(envKey, this.encryptValue(String(value)));
          } else {
            this.configCache.set(envKey, String(value));
          }
        }
      }
    });
  }

  /**
   * Validate required configuration
   */
  validateConfig() {
    const required = [
      'PORT',
      'NODE_ENV',
      'MONGODB_URI',
      'JWT_SECRET'
    ];
    
    const missing = required.filter(key => !this.configCache.has(key));
    
    if (missing.length > 0) {
      // In development, just warn
      if (this.configCache.get('NODE_ENV') === 'development' || !this.configCache.has('NODE_ENV')) {
        console.warn('⚠️ Missing configuration (will use defaults):', missing.join(', '));
        // Set defaults for missing values
        if (!this.configCache.has('PORT')) this.configCache.set('PORT', '5000');
        if (!this.configCache.has('NODE_ENV')) this.configCache.set('NODE_ENV', 'development');
        if (!this.configCache.has('MONGODB_URI')) this.configCache.set('MONGODB_URI', 'mongodb://localhost:27017');
        if (!this.configCache.has('JWT_SECRET')) this.configCache.set('JWT_SECRET', 'development-secret-key');
      } else {
        // In production, fail
        console.error('❌ Missing required configuration:', missing.join(', '));
        throw new Error(`Missing required configuration: ${missing.join(', ')}`);
      }
    }
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if key not found
   * @param {object} context - Security context for audit logging
   */
  get(key, defaultValue = null, context = {}) {
    // Log access attempt
    this.logAccess(key, context);
    
    if (!this.configCache.has(key)) {
      return defaultValue;
    }
    
    const value = this.configCache.get(key);
    
    // Decrypt sensitive values
    if (this.sensitiveKeys.has(key)) {
      return this.decryptValue(value);
    }
    
    return value;
  }

  /**
   * Get multiple configuration values
   * @param {string[]} keys - Array of configuration keys
   * @param {object} context - Security context
   */
  getMultiple(keys, context = {}) {
    const result = {};
    
    keys.forEach(key => {
      result[key] = this.get(key, null, context);
    });
    
    return result;
  }

  /**
   * Check if configuration key exists
   */
  has(key) {
    return this.configCache.has(key);
  }

  /**
   * Get all configuration keys (not values)
   */
  getKeys() {
    return Array.from(this.configCache.keys());
  }

  /**
   * Get non-sensitive configuration as object
   */
  getNonSensitiveConfig() {
    const config = {};
    
    this.configCache.forEach((value, key) => {
      if (!this.sensitiveKeys.has(key)) {
        config[key] = value;
      }
    });
    
    return config;
  }

  /**
   * Derive encryption key from system
   */
  /**
   * Get productionKMS through service proxy manager
   */
  getProductionKMS() {
    return serviceProxyManager.get('productionKMS');
  }

  deriveEncryptionKey() {
    // Use a combination of factors to derive key
    const factors = [
      'IntelliCare',
      'SecureConfig',
      '2024',
      // Add hostname if available
      require('os').hostname() || 'default'
    ];
    
    return crypto
      .createHash('sha256')
      .update(factors.join(':'))
      .digest();
  }

  /**
   * Encrypt sensitive value
   */
  encryptValue(value) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
      
      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('⚠️ Encryption error:', error.message);
      return value; // Return original if encryption fails
    }
  }

  /**
   * Decrypt sensitive value
   */
  decryptValue(encryptedValue) {
    try {
      const parts = encryptedValue.split(':');
      if (parts.length !== 2) {
        return encryptedValue; // Not encrypted
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('⚠️ Decryption error:', error.message);
      return encryptedValue; // Return original if decryption fails
    }
  }

  /**
   * Log configuration access for audit
   */
  logAccess(key, context) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      key: key,
      serviceId: context.serviceId || 'unknown',
      userId: context.userId || 'system',
      practiceId: context.practiceId || 'global',
      sensitive: this.sensitiveKeys.has(key)
    };
    
    this.accessLog.push(logEntry);
    
    // Keep only last 1000 entries in memory
    if (this.accessLog.length > 1000) {
      this.accessLog.shift();
    }
    
    // Log sensitive access attempts only in debug mode
    if (logEntry.sensitive && process.env.DEBUG_CONFIG_ACCESS === 'true') {
      console.log(`🔐 Sensitive config accessed: ${key} by ${logEntry.serviceId}`);
    }
  }

  /**
   * Get access audit log
   */
  getAuditLog(filter = {}) {
    let logs = [...this.accessLog];
    
    if (filter.serviceId) {
      logs = logs.filter(l => l.serviceId === filter.serviceId);
    }
    
    if (filter.sensitive !== undefined) {
      logs = logs.filter(l => l.sensitive === filter.sensitive);
    }
    
    if (filter.since) {
      const sinceDate = new Date(filter.since);
      logs = logs.filter(l => new Date(l.timestamp) >= sinceDate);
    }
    
    return logs;
  }

  /**
   * Clear cached configuration (for testing)
   */
  clearCache() {
    this.configCache.clear();
    this.accessLog = [];
    this.initialized = false;
  }

  /**
   * Reload configuration
   */
  async reload() {
    this.clearCache();
    await this.initialize();
  }
}

// Export singleton instance
module.exports = new SecureConfigService();
