/**
 * 🛡️ DATA ACCESS POLICY MODEL
 * 
 * Defines granular access policies for data collections.
 * These policies determine what data can be accessed, by whom, and how.
 * 
 * SECURITY: Implements row-level and field-level security policies
 * that are enforced by the SecureDataAccess service.
 */

const mongoose = require('mongoose');

const dataAccessPolicySchema = new mongoose.Schema({
  // Policy Identification
  policyId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    description: 'Unique identifier for this policy'
  },
  
  policyName: {
    type: String,
    required: true,
    description: 'Human-readable name for the policy'
  },
  
  description: {
    type: String,
    description: 'Detailed description of what this policy controls'
  },
  
  // Scope
  serviceId: {
    type: String,
    required: true,
    index: true,
    description: 'Service this policy applies to, "*" for all services'
  },
  
  targetCollection: {
    type: String,
    required: true,
    index: true,
    description: 'Collection this policy applies to'
  },
  
  practiceId: {
    type: String,
    index: true,
    description: 'Specific practice this policy applies to, null for all'
  },
  
  // Status
  active: {
    type: Boolean,
    default: true,
    index: true,
    description: 'Whether this policy is currently active'
  },
  
  priority: {
    type: Number,
    default: 100,
    description: 'Policy priority (lower number = higher priority)'
  },
  
  // Row-Level Security
  rowLevelSecurity: {
    enabled: {
      type: Boolean,
      default: true,
      description: 'Enable row-level security'
    },
    
    userField: {
      type: String,
      description: 'Field that contains user ID for filtering'
    },
    
    departmentField: {
      type: String,
      description: 'Field that contains department for filtering'
    },
    
    visibilityField: {
      type: String,
      description: 'Field that determines record visibility'
    },
    
    customRules: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      description: 'Custom MongoDB query filters to apply'
    },
    
    conditions: [{
      field: String,
      operator: {
        type: String,
        enum: ['equals', 'notEquals', 'contains', 'startsWith', 'endsWith', 
               'greaterThan', 'lessThan', 'in', 'notIn', 'exists', 'notExists']
      },
      value: mongoose.Schema.Types.Mixed,
      action: {
        type: String,
        enum: ['allow', 'deny', 'mask', 'audit']
      }
    }],
    
    timeBasedAccess: {
      enabled: { type: Boolean, default: false },
      expiryField: String,
      gracePeriodDays: Number
    }
  },
  
  // Field-Level Security
  allowedFields: [{
    type: String,
    description: 'Fields that can be accessed, "*" for all'
  }],
  
  deniedFields: [{
    type: String,
    description: 'Fields that cannot be accessed (overrides allowed)'
  }],
  
  conditionalFields: [{
    field: String,
    condition: {
      type: String,
      enum: ['always', 'owner', 'department', 'role', 'custom']
    },
    customCondition: mongoose.Schema.Types.Mixed
  }],
  
  // Field Masking
  fieldMasking: {
    type: Map,
    of: {
      type: String,
      enum: ['full', 'partial', 'hash', 'email', 'phone', 'ssn', 'creditCard', 'custom']
    },
    description: 'Fields to mask and their masking type'
  },
  
  customMaskingRules: [{
    field: String,
    pattern: String, // Regex pattern
    replacement: String,
    preserveLength: { type: Boolean, default: false }
  }],
  
  // Sensitive Fields
  sensitiveFields: [{
    type: String,
    description: 'Fields that require encryption at rest'
  }],
  
  piiFields: [{
    type: String,
    description: 'Fields containing personally identifiable information'
  }],
  
  phiFields: [{
    type: String,
    description: 'Fields containing protected health information'
  }],
  
  // Required Fields for Operations
  requiredFields: {
    create: [String],
    update: [String],
    read: [String]
  },
  
  // Validation Rules
  validationRules: [{
    field: String,
    rule: {
      type: String,
      enum: ['required', 'email', 'phone', 'date', 'number', 'regex', 'length', 'range']
    },
    params: mongoose.Schema.Types.Mixed,
    errorMessage: String
  }],
  
  // Data Transformation
  transformations: [{
    field: String,
    operation: {
      type: String,
      enum: ['uppercase', 'lowercase', 'trim', 'hash', 'encrypt', 'truncate', 'round']
    },
    params: mongoose.Schema.Types.Mixed,
    applyOn: {
      type: String,
      enum: ['read', 'write', 'both'],
      default: 'read'
    }
  }],
  
  // Access Control
  accessControl: {
    defaultAccessLevel: {
      type: String,
      enum: ['public', 'internal', 'confidential', 'restricted', 'top-secret'],
      default: 'internal'
    },
    
    minimumClearanceLevel: {
      type: Number,
      default: 1,
      min: 1,
      max: 10
    },
    
    requiredRoles: [String],
    
    requiredPermissions: [String],
    
    deniedRoles: [String],
    
    ipRestrictions: {
      whitelist: [String],
      blacklist: [String]
    },
    
    geoRestrictions: {
      allowedCountries: [String],
      allowedRegions: [String],
      blockedCountries: [String],
      blockedRegions: [String]
    },
    
    timeRestrictions: [{
      startTime: String, // HH:MM format
      endTime: String,   // HH:MM format
      timezone: String,
      daysOfWeek: [Number] // 0-6
    }]
  },
  
  // Audit Configuration
  auditConfig: {
    auditReads: {
      type: Boolean,
      default: true,
      description: 'Audit all read operations'
    },
    
    auditWrites: {
      type: Boolean,
      default: true,
      description: 'Audit all write operations'
    },
    
    auditFailures: {
      type: Boolean,
      default: true,
      description: 'Audit access failures'
    },
    
    detailLevel: {
      type: String,
      enum: ['minimal', 'basic', 'detailed', 'full'],
      default: 'detailed'
    },
    
    includedFields: [String],
    
    excludedFields: [String],
    
    retentionDays: {
      type: Number,
      default: 365,
      description: 'How long to retain audit logs'
    },
    
    alertOnViolation: {
      type: Boolean,
      default: true,
      description: 'Send alerts on policy violations'
    },
    
    alertChannels: [{
      type: String,
      enum: ['email', 'sms', 'webhook', 'slack', 'teams']
    }],
    
    alertRecipients: [String]
  },
  
  // Data Quality Rules
  dataQuality: {
    enforceUniqueness: [{
      field: String,
      scope: {
        type: String,
        enum: ['global', 'practice', 'user', 'department']
      }
    }],
    
    enforceReferentialIntegrity: [{
      field: String,
      referencedCollection: String,
      referencedField: String,
      onDelete: {
        type: String,
        enum: ['restrict', 'cascade', 'setNull']
      }
    }],
    
    dataTypeValidation: [{
      field: String,
      expectedType: String,
      coerceType: { type: Boolean, default: false }
    }],
    
    rangeValidation: [{
      field: String,
      min: mongoose.Schema.Types.Mixed,
      max: mongoose.Schema.Types.Mixed,
      inclusive: { type: Boolean, default: true }
    }]
  },
  
  // Performance Optimization
  performanceHints: {
    suggestedIndexes: [String],
    
    cacheable: {
      type: Boolean,
      default: false,
      description: 'Whether results can be cached'
    },
    
    cacheTTL: {
      type: Number,
      default: 300,
      description: 'Cache time-to-live in seconds'
    },
    
    maxBatchSize: {
      type: Number,
      default: 100,
      description: 'Maximum batch size for bulk operations'
    },
    
    queryTimeout: {
      type: Number,
      default: 30000,
      description: 'Query timeout in milliseconds'
    }
  },
  
  // Compliance Settings
  compliance: {
    hipaaCompliant: {
      type: Boolean,
      default: true,
      description: 'Enforce HIPAA compliance'
    },
    
    gdprCompliant: {
      type: Boolean,
      default: true,
      description: 'Enforce GDPR compliance'
    },
    
    dataResidency: {
      type: String,
      description: 'Required data residency location'
    },
    
    encryptionRequired: {
      type: Boolean,
      default: true,
      description: 'Require encryption for this data'
    },
    
    encryptionAlgorithm: {
      type: String,
      default: 'AES-256-GCM',
      description: 'Encryption algorithm to use'
    },
    
    retentionPolicy: {
      minDays: Number,
      maxDays: Number,
      autoDelete: { type: Boolean, default: false }
    },
    
    rightToErasure: {
      type: Boolean,
      default: true,
      description: 'Support GDPR right to erasure'
    },
    
    dataPortability: {
      type: Boolean,
      default: true,
      description: 'Support data portability requirements'
    }
  },
  
  // Metadata
  createdBy: {
    type: String,
    required: true,
    description: 'Who created this policy'
  },
  
  approvedBy: {
    type: String,
    description: 'Who approved this policy'
  },
  
  approvalDate: {
    type: Date,
    description: 'When the policy was approved'
  },
  
  effectiveDate: {
    type: Date,
    default: Date.now,
    description: 'When this policy becomes effective'
  },
  
  expiryDate: {
    type: Date,
    description: 'When this policy expires'
  },
  
  version: {
    type: Number,
    default: 1,
    description: 'Policy version number'
  },
  
  previousVersionId: {
    type: String,
    description: 'ID of the previous version of this policy'
  },
  
  tags: [String],
  
  notes: String
}, {
  timestamps: true,
  collection: 'dataAccessPolicies'
});

// Indexes
dataAccessPolicySchema.index({ serviceId: 1, targetCollection: 1, active: 1 });
dataAccessPolicySchema.index({ priority: 1, active: 1 });
dataAccessPolicySchema.index({ effectiveDate: 1, expiryDate: 1 });
dataAccessPolicySchema.index({ 'compliance.hipaaCompliant': 1, 'compliance.gdprCompliant': 1 });

// Instance methods
dataAccessPolicySchema.methods = {
  /**
   * Check if policy is currently effective
   */
  isEffective() {
    const now = new Date();
    
    if (!this.active) return false;
    if (this.effectiveDate && now < this.effectiveDate) return false;
    if (this.expiryDate && now > this.expiryDate) return false;
    
    return true;
  },
  
  /**
   * Apply row-level security filter
   */
  applyRowFilter(baseFilter = {}, context = {}) {
    if (!this.rowLevelSecurity.enabled) return baseFilter;
    
    const filter = { ...baseFilter };
    
    // Apply user field filter
    if (this.rowLevelSecurity.userField && context.userId) {
      filter[this.rowLevelSecurity.userField] = context.userId;
    }
    
    // Apply department filter
    if (this.rowLevelSecurity.departmentField && context.department) {
      filter[this.rowLevelSecurity.departmentField] = context.department;
    }
    
    // Apply custom rules
    if (this.rowLevelSecurity.customRules) {
      for (const [key, value] of this.rowLevelSecurity.customRules) {
        filter[key] = value;
      }
    }
    
    // Apply conditions
    if (this.rowLevelSecurity.conditions) {
      for (const condition of this.rowLevelSecurity.conditions) {
        if (condition.action === 'deny') {
          filter[condition.field] = { $ne: condition.value };
        } else if (condition.action === 'allow') {
          filter[condition.field] = condition.value;
        }
      }
    }
    
    return filter;
  },
  
  /**
   * Get fields that need masking
   */
  getFieldsToMask() {
    if (!this.fieldMasking) return [];
    return Array.from(this.fieldMasking.keys());
  },
  
  /**
   * Check if a field is sensitive
   */
  isFieldSensitive(field) {
    return this.sensitiveFields.includes(field) ||
           this.piiFields.includes(field) ||
           this.phiFields.includes(field);
  },
  
  /**
   * Validate required fields
   */
  validateRequiredFields(data, operation) {
    const required = this.requiredFields[operation] || [];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      return {
        valid: false,
        missing
      };
    }
    
    return { valid: true };
  },
  
  /**
   * Apply field transformations
   */
  applyTransformations(data, direction = 'read') {
    if (!this.transformations || this.transformations.length === 0) {
      return data;
    }
    
    const transformed = { ...data };
    
    for (const transformation of this.transformations) {
      if (transformation.applyOn === direction || transformation.applyOn === 'both') {
        if (transformed[transformation.field]) {
          transformed[transformation.field] = this.transform(
            transformed[transformation.field],
            transformation.operation,
            transformation.params
          );
        }
      }
    }
    
    return transformed;
  },
  
  /**
   * Transform a value
   */
  transform(value, operation, params) {
    switch (operation) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'trim':
        return String(value).trim();
      case 'truncate':
        return String(value).substring(0, params.length || 50);
      case 'round':
        return Math.round(Number(value) * (params.precision || 1)) / (params.precision || 1);
      default:
        return value;
    }
  },
  
  /**
   * Check access control
   */
  checkAccess(context = {}) {
    const ac = this.accessControl;
    
    // Check roles
    if (ac.requiredRoles && ac.requiredRoles.length > 0) {
      if (!context.roles || !ac.requiredRoles.some(role => context.roles.includes(role))) {
        return { allowed: false, reason: 'Missing required role' };
      }
    }
    
    // Check denied roles
    if (ac.deniedRoles && context.roles) {
      if (ac.deniedRoles.some(role => context.roles.includes(role))) {
        return { allowed: false, reason: 'Role is denied access' };
      }
    }
    
    // Check clearance level
    if (context.clearanceLevel && context.clearanceLevel < ac.minimumClearanceLevel) {
      return { allowed: false, reason: 'Insufficient clearance level' };
    }
    
    // Check IP restrictions
    if (context.ip) {
      if (ac.ipRestrictions.blacklist.includes(context.ip)) {
        return { allowed: false, reason: 'IP address is blacklisted' };
      }
      
      if (ac.ipRestrictions.whitelist.length > 0 && 
          !ac.ipRestrictions.whitelist.includes(context.ip)) {
        return { allowed: false, reason: 'IP address not whitelisted' };
      }
    }
    
    return { allowed: true };
  }
};

// Static methods
dataAccessPolicySchema.statics = {
  /**
   * Find the most specific policy for a service and collection
   */
  async findBestMatch(serviceId, targetCollection, practiceId = null) {
    const SecureDataAccess = require('../services/secureDataAccess');
    const context = {
      serviceId: 'dataaccesspolicy-model',
      operation: 'findBestMatch',
      practiceId: 'global' // DataAccessPolicy is in global database
    };
    
    // Try to find specific policy first
    let results = await SecureDataAccess.query('DataAccessPolicy', {
      serviceId,
      targetCollection,
      practiceId,
      active: true
    }, { sort: { priority: 1 }, limit: 1 }, context);
    
    let policy = results && results.length > 0 ? results[0] : null;
    
    // Try service-specific policy for all practices
    if (!policy) {
      results = await SecureDataAccess.query('DataAccessPolicy', {
        serviceId,
        targetCollection,
        practiceId: null,
        active: true
      }, { sort: { priority: 1 }, limit: 1 }, context);
      
      policy = results && results.length > 0 ? results[0] : null;
    }
    
    // Try wildcard service policy
    if (!policy) {
      results = await SecureDataAccess.query('DataAccessPolicy', {
        serviceId: '*',
        targetCollection,
        active: true
      }, { sort: { priority: 1 }, limit: 1 }, context);
      
      policy = results && results.length > 0 ? results[0] : null;
    }
    
    return policy;
  },
  
  /**
   * Get all effective policies
   */
  async getEffectivePolicies() {
    const SecureDataAccess = require('../services/secureDataAccess');
    const now = new Date();
    
    const context = {
      serviceId: 'dataaccesspolicy-model',
      operation: 'getEffectivePolicies',
      practiceId: 'global' // DataAccessPolicy is in global database
    };
    
    return SecureDataAccess.query('DataAccessPolicy', {
      active: true,
      $or: [
        { effectiveDate: { $lte: now }, expiryDate: { $gte: now } },
        { effectiveDate: { $lte: now }, expiryDate: null },
        { effectiveDate: null }
      ]
    }, { sort: { priority: 1 } }, context);
  },
  
  /**
   * Create default policy for a collection
   */
  createDefaultPolicy(targetCollection) {
    return new this({
      policyId: `default-${targetCollection}`,
      policyName: `Default Policy for ${targetCollection}`,
      serviceId: '*',
      targetCollection,
      rowLevelSecurity: {
        enabled: true,
        customRules: new Map([['_deleted', { $ne: true }]])
      },
      allowedFields: ['*'],
      deniedFields: ['_securityMetadata'],
      fieldMasking: new Map(),
      sensitiveFields: [],
      accessControl: {
        defaultAccessLevel: 'internal'
      },
      auditConfig: {
        auditReads: true,
        auditWrites: true,
        detailLevel: 'basic'
      },
      compliance: {
        hipaaCompliant: true,
        gdprCompliant: true,
        encryptionRequired: true
      },
      createdBy: 'system'
    });
  }
};

// Export schema for use by GlobalModelLoader
module.exports.schema = dataAccessPolicySchema;

// Only create model if not already defined
// NOTE: In production, use GlobalModelLoader.getDataAccessPolicyModel() instead
if (!mongoose.models.DataAccessPolicy) {
  const DataAccessPolicy = mongoose.model('DataAccessPolicy', dataAccessPolicySchema);
  module.exports = DataAccessPolicy;
} else {
  module.exports = mongoose.models.DataAccessPolicy;
}