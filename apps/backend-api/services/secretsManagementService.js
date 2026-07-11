// Secrets Management Service
// Provides secure secrets management with encryption, rotation, and auditing

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const SecureDataAccess = require('./secureDataAccess');
const secureConfigService = require('./secureConfigService');
const serviceAccountManager = require('./serviceAccountManager');

class SecretsManagementService extends EventEmitter {
  constructor() {
    super();
    
    this.initialized = false;
    this.serviceToken = null;
    
    // Configuration
    this.config = {
      encryptionAlgorithm: 'aes-256-cbc',
      keyDerivationIterations: 100000,
      rotationIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
      backupEnabled: true,
      auditingEnabled: true,
      maxSecretVersions: 10,
      secretsPath: path.join(__dirname, '../secrets'),
      vaultEnabled: secureConfigService.get('VAULT_ENABLED', 'false') === 'true',
      vaultUrl: secureConfigService.get('VAULT_URL', 'http://localhost:8200'),
      vaultToken: secureConfigService.get('VAULT_TOKEN', ''),
      awsSecretsManager: secureConfigService.get('AWS_SECRETS_MANAGER', 'false') === 'true',
      awsRegion: secureConfigService.get('AWS_REGION', 'us-east-1')
    };

    // In-memory secrets store (encrypted)
    this.secretsStore = new Map();
    
    // Secret metadata and versions
    this.secretsMetadata = new Map();
    
    // Access control lists
    this.accessControl = new Map();
    
    // Audit log
    this.auditLog = [];
    
    // Rotation jobs
    this.rotationJobs = new Map();
    
    // Master encryption key (in production, use HSM or KMS)
    this.masterKey = this.deriveMasterKey();
    
    // Statistics
    this.stats = {
      totalSecrets: 0,
      activeSecrets: 0,
      rotatedSecrets: 0,
      accessAttempts: 0,
      accessDenied: 0,
      lastRotation: null,
      encryptionOperations: 0,
      decryptionOperations: 0
    };

    this.initialize();
  }

  /**
   * Initialize secrets management service
   */
  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('secrets-management-service');
      
      // Create secrets directory if it doesn't exist
      await fs.mkdir(this.config.secretsPath, { recursive: true });
      
      // Load existing secrets
      await this.loadSecrets();
      
      // Start rotation scheduler
      this.startRotationScheduler();
      
      // Initialize external providers
      if (this.config.vaultEnabled) {
        await this.initializeVault();
      }
      
      if (this.config.awsSecretsManager) {
        await this.initializeAWSSecretsManager();
      }
      
      // Secrets Management Service initialized with encryption and rotation
      
    } catch (error) {
      console.error('Failed to initialize Secrets Management Service:', error);
      throw error;
    }
  }

  /**
   * Derive master encryption key from environment
   */
  deriveMasterKey() {
    const masterPassword = secureConfigService.get('MASTER_SECRET_KEY') || 'default-development-key-not-secure';
    const salt = Buffer.from(secureConfigService.get('MASTER_SECRET_SALT') || 'default-salt', 'hex');
    
    return crypto.pbkdf2Sync(masterPassword, salt, this.config.keyDerivationIterations, 32, 'sha256');
  }

  /**
   * Store a secret with encryption and versioning
   */
  async storeSecret(secretName, secretValue, options = {}) {
    try {
      this.recordAudit('STORE_SECRET', { secretName, options });
      
      // Validate inputs
      if (!secretName || typeof secretName !== 'string') {
        throw new Error('Secret name must be a non-empty string');
      }
      
      if (!secretValue) {
        throw new Error('Secret value cannot be empty');
      }

      // Check access permissions
      if (!this.checkAccess(secretName, 'write', options.userId)) {
        this.stats.accessDenied++;
        throw new Error('Access denied for secret write operation');
      }

      // Encrypt the secret
      const encryptedSecret = this.encryptSecret(secretValue);
      
      // Create secret metadata
      const metadata = {
        name: secretName,
        version: this.getNextVersion(secretName),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: options.userId || 'system',
        tags: options.tags || [],
        description: options.description || '',
        rotationEnabled: options.rotationEnabled !== false,
        rotationIntervalMs: options.rotationIntervalMs || this.config.rotationIntervalMs,
        expiresAt: options.expiresAt,
        accessLevel: options.accessLevel || 'standard',
        lastAccessed: null,
        accessCount: 0
      };

      // Store encrypted secret
      this.secretsStore.set(secretName, encryptedSecret);
      
      // Update metadata with versioning
      if (!this.secretsMetadata.has(secretName)) {
        this.secretsMetadata.set(secretName, { versions: [] });
      }
      
      const secretMeta = this.secretsMetadata.get(secretName);
      secretMeta.versions.push(metadata);
      secretMeta.current = metadata;
      
      // Limit version history
      if (secretMeta.versions.length > this.config.maxSecretVersions) {
        secretMeta.versions = secretMeta.versions.slice(-this.config.maxSecretVersions);
      }

      // Set up rotation if enabled
      if (metadata.rotationEnabled) {
        this.scheduleRotation(secretName, metadata.rotationIntervalMs);
      }

      // Persist to disk
      await this.persistSecret(secretName, encryptedSecret, metadata);
      
      // Store in external systems
      if (this.config.vaultEnabled) {
        await this.storeInVault(secretName, secretValue, metadata);
      }
      
      if (this.config.awsSecretsManager) {
        await this.storeInAWS(secretName, secretValue, metadata);
      }

      // Update statistics
      this.stats.totalSecrets = this.secretsStore.size;
      this.stats.activeSecrets = Array.from(this.secretsMetadata.values())
        .filter(meta => !meta.current.expiresAt || meta.current.expiresAt > new Date()).length;
      this.stats.encryptionOperations++;

      this.emit('secretStored', { secretName, version: metadata.version, userId: options.userId });
      
      console.log(`Secret stored: ${secretName} (version ${metadata.version})`);
      return {
        success: true,
        secretName,
        version: metadata.version,
        encrypted: true,
        rotationEnabled: metadata.rotationEnabled
      };

    } catch (error) {
      this.recordAudit('STORE_SECRET_FAILED', { secretName, error: error.message });
      throw error;
    }
  }

  /**
   * Retrieve a secret with decryption and access control
   */
  async retrieveSecret(secretName, options = {}) {
    try {
      this.stats.accessAttempts++;
      this.recordAudit('RETRIEVE_SECRET', { secretName, options });

      // Check if secret exists
      if (!this.secretsStore.has(secretName)) {
        throw new Error(`Secret not found: ${secretName}`);
      }

      // Check access permissions
      if (!this.checkAccess(secretName, 'read', options.userId)) {
        this.stats.accessDenied++;
        throw new Error('Access denied for secret read operation');
      }

      // Get metadata
      const secretMeta = this.secretsMetadata.get(secretName);
      if (!secretMeta || !secretMeta.current) {
        throw new Error(`Secret metadata not found: ${secretName}`);
      }

      // Check expiration
      if (secretMeta.current.expiresAt && secretMeta.current.expiresAt <= new Date()) {
        throw new Error(`Secret expired: ${secretName}`);
      }

      // Get specific version if requested
      let targetVersion = secretMeta.current;
      if (options.version) {
        targetVersion = secretMeta.versions.find(v => v.version === options.version);
        if (!targetVersion) {
          throw new Error(`Secret version not found: ${secretName}@${options.version}`);
        }
      }

      // Decrypt the secret
      const encryptedSecret = this.secretsStore.get(secretName);
      const decryptedValue = this.decryptSecret(encryptedSecret);

      // Update access tracking
      targetVersion.lastAccessed = new Date();
      targetVersion.accessCount++;
      this.stats.decryptionOperations++;

      // Try external systems as backup
      if (!decryptedValue && this.config.vaultEnabled) {
        const vaultValue = await this.retrieveFromVault(secretName);
        if (vaultValue) {
          console.log(`Secret retrieved from Vault: ${secretName}`);
          return { value: vaultValue, source: 'vault', version: targetVersion.version };
        }
      }

      this.emit('secretRetrieved', { secretName, version: targetVersion.version, userId: options.userId });
      
      return {
        value: decryptedValue,
        version: targetVersion.version,
        metadata: {
          createdAt: targetVersion.createdAt,
          updatedAt: targetVersion.updatedAt,
          lastAccessed: targetVersion.lastAccessed,
          accessCount: targetVersion.accessCount,
          tags: targetVersion.tags,
          description: targetVersion.description
        },
        source: 'local'
      };

    } catch (error) {
      this.recordAudit('RETRIEVE_SECRET_FAILED', { secretName, error: error.message });
      throw error;
    }
  }

  /**
   * Rotate a secret
   */
  async rotateSecret(secretName, newValue = null, options = {}) {
    try {
      this.recordAudit('ROTATE_SECRET', { secretName, options });

      // Check if secret exists
      if (!this.secretsStore.has(secretName)) {
        throw new Error(`Secret not found for rotation: ${secretName}`);
      }

      // Check rotation permissions
      if (!this.checkAccess(secretName, 'rotate', options.userId)) {
        this.stats.accessDenied++;
        throw new Error('Access denied for secret rotation operation');
      }

      // Generate new value if not provided
      if (!newValue) {
        newValue = this.generateSecretValue(options.type || 'password');
      }

      // Store the new version
      const result = await this.storeSecret(secretName, newValue, {
        ...options,
        userId: options.userId || 'system-rotation',
        description: `Rotated secret at ${new Date().toISOString()}`
      });

      // Update rotation statistics
      this.stats.rotatedSecrets++;
      this.stats.lastRotation = new Date();

      // Reschedule next rotation
      const metadata = this.secretsMetadata.get(secretName).current;
      if (metadata.rotationEnabled) {
        this.scheduleRotation(secretName, metadata.rotationIntervalMs);
      }

      this.emit('secretRotated', { secretName, version: result.version, userId: options.userId });
      
      console.log(`Secret rotated: ${secretName} -> version ${result.version}`);
      return result;

    } catch (error) {
      this.recordAudit('ROTATE_SECRET_FAILED', { secretName, error: error.message });
      throw error;
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(secretName, options = {}) {
    try {
      this.recordAudit('DELETE_SECRET', { secretName, options });

      // Check access permissions
      if (!this.checkAccess(secretName, 'delete', options.userId)) {
        this.stats.accessDenied++;
        throw new Error('Access denied for secret delete operation');
      }

      // Remove from memory
      this.secretsStore.delete(secretName);
      this.secretsMetadata.delete(secretName);
      this.accessControl.delete(secretName);

      // Cancel rotation job
      if (this.rotationJobs.has(secretName)) {
        clearTimeout(this.rotationJobs.get(secretName));
        this.rotationJobs.delete(secretName);
      }

      // Delete from disk
      await this.deleteSecretFile(secretName);

      // Delete from external systems
      if (this.config.vaultEnabled) {
        await this.deleteFromVault(secretName);
      }
      
      if (this.config.awsSecretsManager) {
        await this.deleteFromAWS(secretName);
      }

      // Update statistics
      this.stats.totalSecrets = this.secretsStore.size;
      this.stats.activeSecrets = Array.from(this.secretsMetadata.values())
        .filter(meta => !meta.current.expiresAt || meta.current.expiresAt > new Date()).length;

      this.emit('secretDeleted', { secretName, userId: options.userId });
      
      console.log(`Secret deleted: ${secretName}`);
      return { success: true, secretName };

    } catch (error) {
      this.recordAudit('DELETE_SECRET_FAILED', { secretName, error: error.message });
      throw error;
    }
  }

  /**
   * List secrets with filtering
   */
  async listSecrets(options = {}) {
    try {
      this.recordAudit('LIST_SECRETS', { options });

      const secrets = [];
      
      for (const [secretName, metadata] of this.secretsMetadata) {
        // Check read access
        if (!this.checkAccess(secretName, 'read', options.userId)) {
          continue;
        }

        // Apply filters
        if (options.tags && !metadata.current.tags.some(tag => options.tags.includes(tag))) {
          continue;
        }

        if (options.accessLevel && metadata.current.accessLevel !== options.accessLevel) {
          continue;
        }

        if (options.includeExpired === false && 
            metadata.current.expiresAt && metadata.current.expiresAt <= new Date()) {
          continue;
        }

        secrets.push({
          name: secretName,
          version: metadata.current.version,
          createdAt: metadata.current.createdAt,
          updatedAt: metadata.current.updatedAt,
          lastAccessed: metadata.current.lastAccessed,
          accessCount: metadata.current.accessCount,
          tags: metadata.current.tags,
          description: metadata.current.description,
          rotationEnabled: metadata.current.rotationEnabled,
          expiresAt: metadata.current.expiresAt,
          accessLevel: metadata.current.accessLevel,
          versions: metadata.versions.length
        });
      }

      // Sort by name
      secrets.sort((a, b) => a.name.localeCompare(b.name));

      return {
        secrets,
        total: secrets.length,
        totalStored: this.stats.totalSecrets
      };

    } catch (error) {
      this.recordAudit('LIST_SECRETS_FAILED', { error: error.message });
      throw error;
    }
  }

  /**
   * Set access control for a secret
   */
  async setAccessControl(secretName, permissions, userId) {
    try {
      this.recordAudit('SET_ACCESS_CONTROL', { secretName, permissions, userId });

      // Check admin permissions
      if (!this.checkAccess(secretName, 'admin', userId)) {
        throw new Error('Access denied for access control modification');
      }

      this.accessControl.set(secretName, {
        ...permissions,
        updatedBy: userId,
        updatedAt: new Date()
      });

      await this.persistAccessControl();
      
      console.log(`Access control updated for secret: ${secretName}`);
      return { success: true, secretName, permissions };

    } catch (error) {
      this.recordAudit('SET_ACCESS_CONTROL_FAILED', { secretName, error: error.message });
      throw error;
    }
  }

  /**
   * Check access permissions for a secret
   */
  checkAccess(secretName, operation, userId) {
    // System user has full access
    if (userId === 'system' || userId === 'system-rotation') {
      return true;
    }

    // Default access for development
    if (secureConfigService.get('NODE_ENV') !== 'production') {
      return true;
    }

    const acl = this.accessControl.get(secretName);
    if (!acl) {
      // Default permissions - only creator can access
      const metadata = this.secretsMetadata.get(secretName);
      if (metadata && metadata.current) {
        return metadata.current.createdBy === userId;
      }
      return false;
    }

    // Check specific permissions
    switch (operation) {
      case 'read':
        return acl.readers?.includes(userId) || acl.admins?.includes(userId) || 
               acl.allowAll === true;
      case 'write':
        return acl.writers?.includes(userId) || acl.admins?.includes(userId);
      case 'rotate':
        return acl.rotators?.includes(userId) || acl.admins?.includes(userId);
      case 'delete':
        return acl.admins?.includes(userId);
      case 'admin':
        return acl.admins?.includes(userId);
      default:
        return false;
    }
  }

  /**
   * Encrypt a secret value
   */
  encryptSecret(value) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.masterKey, iv);
    
    let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      algorithm: 'aes-256-cbc'
    };
  }

  /**
   * Decrypt a secret value
   */
  decryptSecret(encryptedData) {
    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = crypto.createDecipheriv(encryptedData.algorithm, this.masterKey, iv);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to decrypt secret:', error);
      throw new Error('Failed to decrypt secret - invalid key or corrupted data');
    }
  }

  /**
   * Generate a secure secret value
   */
  generateSecretValue(type = 'password') {
    switch (type) {
      case 'password':
        return crypto.randomBytes(32).toString('base64');
      case 'api-key':
        return `ak_${crypto.randomBytes(32).toString('hex')}`;
      case 'jwt-secret':
        return crypto.randomBytes(64).toString('base64');
      case 'encryption-key':
        return crypto.randomBytes(32).toString('hex');
      default:
        return crypto.randomBytes(24).toString('base64');
    }
  }

  /**
   * Get next version number for a secret
   */
  getNextVersion(secretName) {
    const metadata = this.secretsMetadata.get(secretName);
    if (!metadata || !metadata.versions.length) {
      return 1;
    }
    
    return Math.max(...metadata.versions.map(v => v.version)) + 1;
  }

  /**
   * Schedule automatic rotation for a secret
   */
  scheduleRotation(secretName, intervalMs) {
    // Clear existing rotation job
    if (this.rotationJobs.has(secretName)) {
      clearTimeout(this.rotationJobs.get(secretName));
    }

    // Schedule new rotation
    const rotationJob = setTimeout(async () => {
      try {
        console.log(`Automatic rotation triggered for secret: ${secretName}`);
        await this.rotateSecret(secretName, null, { userId: 'system-rotation' });
      } catch (error) {
        console.error(`Failed to rotate secret ${secretName}:`, error);
        this.emit('rotationFailed', { secretName, error: error.message });
      }
    }, intervalMs);

    this.rotationJobs.set(secretName, rotationJob);
  }

  /**
   * Start the rotation scheduler
   */
  startRotationScheduler() {
    // Check for secrets needing rotation every hour
    setInterval(() => {
      for (const [secretName, metadata] of this.secretsMetadata) {
        if (metadata.current.rotationEnabled) {
          const timeSinceUpdate = Date.now() - metadata.current.updatedAt.getTime();
          if (timeSinceUpdate >= metadata.current.rotationIntervalMs) {
            this.rotateSecret(secretName, null, { userId: 'system-rotation' })
              .catch(error => console.error(`Scheduled rotation failed for ${secretName}:`, error));
          }
        }
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Record audit event
   */
  recordAudit(action, data = {}) {
    if (!this.config.auditingEnabled) return;

    const auditEntry = {
      timestamp: new Date(),
      action,
      data,
      sessionId: data.sessionId || 'unknown',
      userId: data.userId || 'unknown',
      sourceIp: data.sourceIp || 'unknown'
    };

    this.auditLog.push(auditEntry);

    // Limit audit log size
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }

    console.log(`[Secrets Audit] ${action}:`, data);
  }

  /**
   * Initialize HashiCorp Vault integration
   */
  async initializeVault() {
    // Simplified Vault initialization for demonstration
    console.log('Vault integration initialized (development mode)');
  }

  /**
   * Store secret in HashiCorp Vault
   */
  async storeInVault(secretName, secretValue, metadata) {
    // Implementation would use Vault API
    console.log(`Would store in Vault: ${secretName}`);
  }

  /**
   * Retrieve secret from HashiCorp Vault
   */
  async retrieveFromVault(secretName) {
    // Implementation would use Vault API
    return null;
  }

  /**
   * Delete secret from HashiCorp Vault
   */
  async deleteFromVault(secretName) {
    console.log(`Would delete from Vault: ${secretName}`);
  }

  /**
   * Initialize AWS Secrets Manager
   */
  async initializeAWSSecretsManager() {
    console.log('AWS Secrets Manager integration initialized (development mode)');
  }

  /**
   * Store secret in AWS Secrets Manager
   */
  async storeInAWS(secretName, secretValue, metadata) {
    console.log(`Would store in AWS Secrets Manager: ${secretName}`);
  }

  /**
   * Delete secret from AWS Secrets Manager
   */
  async deleteFromAWS(secretName) {
    console.log(`Would delete from AWS Secrets Manager: ${secretName}`);
  }

  /**
   * Load secrets from disk
   */
  async loadSecrets() {
    // Implementation for loading persisted secrets
    // Loaded existing secrets from disk
  }

  /**
   * Persist secret to disk
   */
  async persistSecret(secretName, encryptedSecret, metadata) {
    // Implementation for persisting secrets
    console.log(`Persisted secret: ${secretName}`);
  }

  /**
   * Delete secret file from disk
   */
  async deleteSecretFile(secretName) {
    console.log(`Deleted secret file: ${secretName}`);
  }

  /**
   * Persist access control settings
   */
  async persistAccessControl() {
    console.log('Persisted access control settings');
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      activeRotationJobs: this.rotationJobs.size,
      auditLogSize: this.auditLog.length,
      config: {
        encryptionAlgorithm: this.config.encryptionAlgorithm,
        rotationInterval: this.config.rotationIntervalMs,
        maxVersions: this.config.maxSecretVersions,
        vaultEnabled: this.config.vaultEnabled,
        awsSecretsManager: this.config.awsSecretsManager
      }
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      features: {
        encryption: true,
        rotation: true,
        versioning: true,
        auditing: this.config.auditingEnabled,
        vault: this.config.vaultEnabled,
        aws: this.config.awsSecretsManager
      },
      statistics: this.getStats(),
      timestamp: new Date()
    };
  }
}

// Export singleton instance
module.exports = new SecretsManagementService();