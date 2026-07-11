/**
 * 🔐 SERVICE ACCOUNT MODEL
 * 
 * Defines service accounts with granular permissions for database access.
 * Each service/component must have a service account to access data.
 * 
 * SECURITY: This is the foundation of zero-trust database access.
 * No service can access data without proper credentials and permissions.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
// Removed circular dependency - SecureDataAccess should not be imported in models

const serviceAccountSchema = new mongoose.Schema({
  // Service identification
  serviceId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    description: 'Unique identifier for the service (e.g., "reminder-service", "ai-agent")'
  },
  
  serviceName: {
    type: String,
    required: true,
    description: 'Human-readable name of the service'
  },
  
  description: {
    type: String,
    description: 'Description of what this service does'
  },
  
  // Authentication
  apiKey: {
    type: String,
    required: false, // Made optional as we're moving to apiKeyHash
    unique: true,
    sparse: true, // Allow null values for unique index
    index: true,
    description: 'DEPRECATED - API key (being replaced by apiKeyHash)'
  },
  
  apiKeyHash: {
    type: String,
    required: false, // Made optional for backward compatibility
    description: 'Bcrypt hash of the API key (secure storage)'
  },
  
  apiKeyPrefix: {
    type: String,
    required: true,
    description: 'First 8 characters of API key for identification'
  },
  
  // Status
  active: {
    type: Boolean,
    default: true,
    index: true,
    description: 'Whether this service account is active'
  },
  
  suspended: {
    type: Boolean,
    default: false,
    description: 'Temporarily suspended (for security violations)'
  },
  
  suspensionReason: {
    type: String,
    description: 'Reason for suspension if suspended'
  },
  
  // Permissions - Practice Level
  allowedClinics: [{
    type: String,
    description: 'List of practice IDs this service can access, "*" for all'
  }],
  
  clinicRestrictions: {
    type: Map,
    of: {
      maxRecords: Number,
      allowedOperations: [String],
      dataRetentionDays: Number
    },
    description: 'Per-practice specific restrictions'
  },
  
  // Permissions - Collection Level
  allowedCollections: [{
    type: String,
    description: 'Collections this service can access, "*" for all'
  }],
  
  collectionPermissions: {
    type: Map,
    of: {
      read: { type: Boolean, default: false },
      write: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      aggregate: { type: Boolean, default: false }
    },
    description: 'Granular permissions per collection'
  },
  
  // Permissions - Operation Level
  allowedOperations: {
    type: Map,
    of: [String],
    description: 'Map of collection to allowed operations'
  },
  
  // Permissions - Field Level
  allowedFields: {
    type: Map,
    of: [String],
    description: 'Map of collection to allowed fields, "*" for all'
  },
  
  deniedFields: {
    type: Map,
    of: [String],
    description: 'Fields explicitly denied (overrides allowedFields)'
  },
  
  // Rate Limiting
  rateLimits: {
    queriesPerMinute: {
      type: Number,
      default: 100,
      description: 'Max queries per minute'
    },
    
    queriesPerHour: {
      type: Number,
      default: 5000,
      description: 'Max queries per hour'
    },
    
    maxRecordsPerQuery: {
      type: Number,
      default: 1000,
      description: 'Maximum records returned per query'
    },
    
    maxConcurrentQueries: {
      type: Number,
      default: 10,
      description: 'Maximum concurrent queries'
    },
    
    burstAllowance: {
      type: Number,
      default: 20,
      description: 'Burst allowance for rate limiting'
    }
  },
  
  // Security Settings
  securitySettings: {
    requireEncryption: {
      type: Boolean,
      default: true,
      description: 'Require encrypted connections'
    },
    
    ipWhitelist: [{
      type: String,
      description: 'Allowed IP addresses or CIDR ranges'
    }],
    
    ipBlacklist: [{
      type: String,
      description: 'Blocked IP addresses or CIDR ranges'
    }],
    
    requireMFA: {
      type: Boolean,
      default: false,
      description: 'Require multi-factor authentication'
    },
    
    allowedTimeWindows: [{
      dayOfWeek: Number, // 0-6
      startHour: Number,  // 0-23
      endHour: Number     // 0-23
    }],
    
    geoRestrictions: {
      allowedCountries: [String],
      blockedCountries: [String]
    }
  },
  
  // Data Governance
  dataGovernance: {
    dataClassification: {
      type: String,
      enum: ['public', 'internal', 'confidential', 'restricted'],
      default: 'internal',
      description: 'Maximum data classification level this service can access'
    },
    
    piiAccess: {
      type: Boolean,
      default: false,
      description: 'Can access personally identifiable information'
    },
    
    phiAccess: {
      type: Boolean,
      default: false,
      description: 'Can access protected health information'
    },
    
    financialDataAccess: {
      type: Boolean,
      default: false,
      description: 'Can access financial data'
    },
    
    auditLevel: {
      type: String,
      enum: ['none', 'basic', 'detailed', 'full'],
      default: 'detailed',
      description: 'Level of audit logging for this service'
    },
    
    dataRetentionDays: {
      type: Number,
      default: 90,
      description: 'How long this service can retain data'
    }
  },
  
  // Integration Settings
  integrationSettings: {
    webhookUrl: {
      type: String,
      description: 'Webhook for security notifications'
    },
    
    callbackUrl: {
      type: String,
      description: 'Callback URL for async operations'
    },
    
    apiVersion: {
      type: String,
      default: 'v1',
      description: 'API version this service uses'
    },
    
    sdkVersion: {
      type: String,
      description: 'SDK version if applicable'
    }
  },
  
  // Usage Tracking
  usage: {
    totalQueries: {
      type: Number,
      default: 0,
      description: 'Total queries made by this service'
    },
    
    totalRecordsAccessed: {
      type: Number,
      default: 0,
      description: 'Total records accessed'
    },
    
    lastAccessTime: {
      type: Date,
      description: 'Last time this service accessed data'
    },
    
    violationCount: {
      type: Number,
      default: 0,
      description: 'Number of security violations'
    },
    
    lastViolation: {
      type: Date,
      description: 'Last security violation timestamp'
    }
  },
  
  // Metadata
  createdBy: {
    type: String,
    required: true,
    description: 'Who created this service account'
  },
  
  owner: {
    type: String,
    required: true,
    description: 'Team or person responsible for this service'
  },
  
  contactEmail: {
    type: String,
    required: true,
    description: 'Contact email for security issues'
  },
  
  expiresAt: {
    type: Date,
    description: 'When this service account expires'
  },
  
  rotateKeyAt: {
    type: Date,
    description: 'When the API key should be rotated'
  },
  
  lastRotated: {
    type: Date,
    description: 'When the API key was last rotated'
  },
  
  tags: [{
    type: String,
    description: 'Tags for categorization'
  }],
  
  notes: {
    type: String,
    description: 'Additional notes about this service'
  }
}, {
  timestamps: true,
  collection: 'ServiceAccount'
});

// Indexes for performance
serviceAccountSchema.index({ active: 1, serviceId: 1 });
serviceAccountSchema.index({ apiKey: 1, active: 1 });
serviceAccountSchema.index({ 'usage.lastAccessTime': -1 });
serviceAccountSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance methods
serviceAccountSchema.methods = {
  /**
   * Generate a new API key for this service
   */
  generateApiKey() {
    const rawKey = crypto.randomBytes(32).toString('hex');
    const fullKey = `sa_${this.serviceId}_${rawKey}`;
    
    // Store hashed version
    this.apiKey = crypto.createHash('sha256').update(fullKey).digest('hex');
    this.apiKeyPrefix = fullKey.substring(0, 8);
    
    // Return the full key (only shown once)
    return fullKey;
  },
  
  /**
   * Verify an API key against the stored hash
   */
  verifyApiKey(apiKey) {
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    return this.apiKey === hashedKey;
  },
  
  /**
   * Check if service can access a specific practice
   */
  canAccessClinic(practiceId) {
    if (!this.active || this.suspended) return false;
    if (this.allowedClinics.includes('*')) return true;
    return this.allowedClinics.includes(practiceId);
  },
  
  /**
   * Check if service can access a specific collection
   */
  canAccessCollection(collection) {
    if (!this.active || this.suspended) return false;
    if (this.allowedCollections.includes('*')) return true;
    return this.allowedCollections.includes(collection);
  },
  
  /**
   * Check if service can perform an operation
   */
  canPerformOperation(collection, operation) {
    if (!this.active || this.suspended) return false;
    
    const collectionOps = this.allowedOperations.get(collection);
    const globalOps = this.allowedOperations.get('*');
    
    if (globalOps && (globalOps.includes('*') || globalOps.includes(operation))) {
      return true;
    }
    
    if (collectionOps && (collectionOps.includes('*') || collectionOps.includes(operation))) {
      return true;
    }
    
    return false;
  },
  
  /**
   * Get allowed fields for a collection
   */
  getAllowedFields(collection) {
    const collectionFields = this.allowedFields.get(collection);
    const globalFields = this.allowedFields.get('*');
    const deniedFields = this.deniedFields.get(collection) || [];
    
    let fields = [];
    
    if (globalFields) {
      fields = [...globalFields];
    }
    
    if (collectionFields) {
      fields = [...fields, ...collectionFields];
    }
    
    // Remove denied fields
    fields = fields.filter(field => !deniedFields.includes(field));
    
    return fields.length > 0 ? fields : null;
  },
  
  /**
   * Record a security violation
   */
  recordViolation(reason) {
    this.usage.violationCount++;
    this.usage.lastViolation = new Date();
    
    // Auto-suspend after 5 violations
    if (this.usage.violationCount >= 5) {
      this.suspended = true;
      this.suspensionReason = `Auto-suspended after ${this.usage.violationCount} violations. Last: ${reason}`;
    }
    
    return SecureDataAccess.update('collection', { _id: this._id }, this, context);
  },
  
  /**
   * Update usage statistics
   */
  updateUsage(recordCount = 1) {
    this.usage.totalQueries++;
    this.usage.totalRecordsAccessed += recordCount;
    this.usage.lastAccessTime = new Date();
    
    // Don't wait for save to complete
    SecureDataAccess.update('collection', { _id: this._id }, this, context).catch(console.error);
  },
  
  /**
   * Check if service account is expired
   */
  isExpired() {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  },
  
  /**
   * Check if API key needs rotation
   */
  needsKeyRotation() {
    if (!this.rotateKeyAt) return false;
    return new Date() > this.rotateKeyAt;
  },
  
  /**
   * Check if access is allowed at current time
   */
  isTimeWindowAllowed() {
    if (!this.securitySettings.allowedTimeWindows || 
        this.securitySettings.allowedTimeWindows.length === 0) {
      return true; // No time restrictions
    }
    
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    
    return this.securitySettings.allowedTimeWindows.some(window => 
      window.dayOfWeek === dayOfWeek && 
      hour >= window.startHour && 
      hour < window.endHour
    );
  }
};

// Static methods
serviceAccountSchema.statics = {
  /**
   * Find active service account by API key
   */
  async findByApiKey(apiKey) {
    const SecureDataAccess = require('../services/secureDataAccess');
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    const context = {
      serviceId: 'serviceaccount-model',
      operation: 'findByApiKey',
      practiceId: 'global' // ServiceAccounts are in global database
    };
    
    const results = await SecureDataAccess.query('ServiceAccount', {
      apiKey: hashedKey,
      active: true,
      suspended: false
    }, { limit: 1 }, context);
    
    return results && results.length > 0 ? results[0] : null;
  },
  
  /**
   * Create a new service account with secure defaults
   */
  async createServiceAccount(data) {
    const account = new this({
      ...data,
      active: true,
      suspended: false,
      usage: {
        totalQueries: 0,
        totalRecordsAccessed: 0,
        violationCount: 0
      }
    });
    
    // Generate API key
    const apiKey = account.generateApiKey();
    
    // Set key rotation date (90 days by default)
    account.rotateKeyAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    
    await SecureDataAccess.update('collection', { _id: account._id }, account, context);
    
    // Return account with the API key (only time it's shown)
    return {
      account,
      apiKey
    };
  },
  
  /**
   * Get service accounts that need key rotation
   */
  async getAccountsNeedingRotation() {
    const SecureDataAccess = require('../services/secureDataAccess');
    const context = {
      serviceId: 'serviceaccount-model',
      operation: 'getAccountsNeedingRotation',
      practiceId: 'global' // ServiceAccounts are in global database
    };
    
    return SecureDataAccess.query('ServiceAccount', {
      active: true,
      rotateKeyAt: { $lte: new Date() }
    }, {}, context);
  },
  
  /**
   * Get suspended accounts
   */
  async getSuspendedAccounts() {
    const SecureDataAccess = require('../services/secureDataAccess');
    const context = {
      serviceId: 'serviceaccount-model',
      operation: 'getSuspendedAccounts',
      practiceId: 'global' // ServiceAccounts are in global database
    };
    
    return SecureDataAccess.query('ServiceAccount', {
      suspended: true
    }, {
      sort: { 'usage.lastViolation': -1 }
    }, context);
  }
};

// Export schema for use by GlobalModelLoader
module.exports.schema = serviceAccountSchema;

// Only create model if not already defined
// NOTE: In production, use GlobalModelLoader.getServiceAccountModel() instead
if (!mongoose.models.ServiceAccount) {
  const ServiceAccount = mongoose.model('ServiceAccount', serviceAccountSchema);
  module.exports = ServiceAccount;
} else {
  module.exports = mongoose.models.ServiceAccount;
}