const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

// Audit Log Schema for HIPAA compliance and security tracking
const auditLogSchema = new mongoose.Schema({
  // User who performed the action
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // User details at time of action (for historical accuracy)
  userDetails: {
    email: String,
    fullName: String,
    roles: [String]
  },
  
  // Action performed
  action: {
    type: String,
    required: true,
    enum: [
      // Patient actions
      'patient_created', 'patient_updated', 'patient_deleted', 'patient_viewed', 'patients_list_accessed',
      'patients_bulk_deleted', 'patients_bulk_updated', 'patient_statistics_accessed', 'patients_exported',
      // Document actions
      'document_uploaded', 'document_viewed', 'document_downloaded', 'document_deleted',
      'documents_bulk_updated', 'documents_bulk_deleted', 'SECURE_UPLOAD', 'DOCUMENT_ACCESS', 
      'UPLOAD', 'DOCUMENT', 'DELETE', 'BULK_UPDATE', 'BULK_DELETE',
      // User actions
      'user_login', 'user_logout', 'user_created', 'user_updated', 'user_deleted', 'users_list_accessed', 'user_roles_updated', 'user_status_updated',
      'user_details_accessed', 'user_self_registered', 'user_password_reset', 'user_email_changed',
      // Chat actions
      'chat_session_created', 'chat_session_deleted', 'chat_sessions_bulk_updated', 'chat_sessions_bulk_deleted',
      // System actions
      'system_backup', 'system_restore', 'database_migration',
      // Practice actions
      'practice_created', 'practice_updated', 'practice_deleted',
      // Security actions
      'failed_login', 'password_changed', 'permission_changed',
      'SESSION_END_BROWSER_CLOSE_ATTEMPT', 'SESSION_END_PAGEHIDE', 'BROWSER_CLOSE_PREVENTED',
      'AUTO_LOGOUT_INACTIVITY_FORCE_CLOSE', 'AUTO_LOGOUT_INACTIVITY_TIMEOUT', 'AUTO_LOGOUT_TOKEN_EXPIRED',
      // AI actions
      'ai_analysis_requested', 'ai_analysis_completed', 'ai_analysis_failed'
    ],
    index: true
  },
  
  // Resource affected (patient, document, user, etc.)
  resourceType: {
    type: String,
    required: true,
    enum: ['patient', 'document', 'user', 'system', 'practice', 'chat_session', 'chat_message', 'SECURITY'],
    index: true
  },
  
  // ID of the affected resource
  resourceId: {
    type: String,
    required: false, // Some actions may not have a specific resource
    index: true
  },
  
  // Additional details about the resource
  resourceDetails: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  
  // Request details
  request: {
    method: String, // GET, POST, PUT, DELETE
    url: String,
    userAgent: String,
    ipAddress: {
      type: String,
      required: true,
      index: true
    },
    sessionId: String
  },
  
  // Response details
  response: {
    statusCode: Number,
    success: Boolean,
    errorMessage: String
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  
  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  
  // Severity level for security monitoring
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
    index: true
  },
  
  // Tags for categorization
  tags: [{
    type: String,
    index: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance and compliance queries
auditLogSchema.index({ timestamp: -1 }); // Most recent first
auditLogSchema.index({ userId: 1, timestamp: -1 }); // User activity timeline
auditLogSchema.index({ action: 1, timestamp: -1 }); // Action-based queries
auditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 }); // Resource history
auditLogSchema.index({ 'request.ipAddress': 1, timestamp: -1 }); // IP-based tracking
auditLogSchema.index({ severity: 1, timestamp: -1 }); // Security monitoring
auditLogSchema.index({ tags: 1, timestamp: -1 }); // Tag-based filtering

// Virtual for formatted timestamp
auditLogSchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// Virtual for action description
auditLogSchema.virtual('actionDescription').get(function() {
  const descriptions = {
    'patient_created': 'Created new patient record',
    'patient_updated': 'Updated patient information',
    'patient_deleted': 'Deleted patient record',
    'patient_viewed': 'Viewed patient record',
    'document_uploaded': 'Uploaded medical document',
    'document_viewed': 'Viewed medical document',
    'document_downloaded': 'Downloaded medical document',
    'document_deleted': 'Deleted medical document',
    'user_login': 'User logged in',
    'user_logout': 'User logged out',
    'user_created': 'Created new user account',
    'user_updated': 'Updated user account',
    'user_deleted': 'Deleted user account',
    'failed_login': 'Failed login attempt',
    'password_changed': 'Changed password',
    'permission_changed': 'Changed user permissions',
    'SESSION_END_BROWSER_CLOSE_ATTEMPT': 'Browser close attempt detected',
    'SESSION_END_PAGEHIDE': 'Page hide event detected',
    'BROWSER_CLOSE_PREVENTED': 'Browser close prevented',
    'AUTO_LOGOUT_INACTIVITY_FORCE_CLOSE': 'Auto logout due to inactivity (forced)',
    'AUTO_LOGOUT_INACTIVITY_TIMEOUT': 'Auto logout due to inactivity timeout',
    'AUTO_LOGOUT_TOKEN_EXPIRED': 'Auto logout due to token expiration',
    'ai_analysis_requested': 'Requested AI document analysis',
    'ai_analysis_completed': 'Completed AI document analysis',
    'ai_analysis_failed': 'AI document analysis failed'
  };
  
  return descriptions[this.action] || this.action;
});

// Static methods for common audit operations
auditLogSchema.statics.getSystemUserId = function() {
  // Create a consistent ObjectId for system actions
  // Using a fixed string to generate the same ObjectId every time
  return new mongoose.Types.ObjectId('000000000000000000000000');
};

auditLogSchema.statics.logAction = async function(auditData) {
  try {
    // Handle system user case
    if (auditData.userId === 'system') {
      auditData.userId = this.getSystemUserId();
      auditData.userDetails = auditData.userDetails || {
        email: 'system',
        fullName: 'System',
        roles: ['system']
      };
    }

    // Ensure required fields are present
    if (!auditData.request) {
      auditData.request = {};
    }
    if (!auditData.request.ipAddress) {
      auditData.request.ipAddress = '127.0.0.1';
    }

    const auditLog = new this(auditData);
    
    // Create proper security context for audit logging
    const securityContext = {
      serviceId: 'audit-log-service', // Approved system service
      practiceId: auditData.practiceId || auditData.practice?.id || 'global',
      operation: 'audit-logging',
      requestSource: 'audit-log-model'
    };
    
    // Use proper MongoDB update syntax with $set operator
    const updateData = auditLog.toObject ? auditLog.toObject() : auditLog;
    await SecureDataAccess.update('auditLogs', { _id: auditLog._id }, { $set: updateData }, securityContext);
    return auditLog;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to avoid breaking main operations
    return null;
  }
};

auditLogSchema.statics.getUserActivity = async function(userId, startDate, endDate, limit = 100) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const query = { userId };
  
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  
  const context = {
    serviceId: 'auditlog-model',
    operation: 'getUserActivity',
    practiceId: 'global' // Audit logs can be global
  };
  
  return SecureDataAccess.query('audit_logs', query, {
    sort: { timestamp: -1 },
    limit: limit,
    populate: { path: 'userId', select: 'profile.firstName profile.lastName email' }
  }, context);
};

auditLogSchema.statics.getResourceHistory = async function(resourceType, resourceId, limit = 50) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'auditlog-model',
    operation: 'getResourceHistory',
    practiceId: 'global' // Audit logs can be global
  };
  
  return SecureDataAccess.query('audit_logs', { resourceType, resourceId }, {
    sort: { timestamp: -1 },
    limit: limit,
    populate: { path: 'userId', select: 'profile.firstName profile.lastName email' }
  }, context);
};

auditLogSchema.statics.getSecurityEvents = async function(severity = 'medium', limit = 100) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const severityLevels = ['low', 'medium', 'high', 'critical'];
  const minSeverityIndex = severityLevels.indexOf(severity);
  const allowedSeverities = severityLevels.slice(minSeverityIndex);
  
  const context = {
    serviceId: 'auditlog-model',
    operation: 'getSecurityEvents',
    practiceId: 'global' // Audit logs can be global
  };
  
  return SecureDataAccess.query('audit_logs', { severity: { $in: allowedSeverities } }, {
    sort: { timestamp: -1 },
    limit: limit,
    populate: { path: 'userId', select: 'profile.firstName profile.lastName email' }
  }, context);
};

// Pre-save middleware
auditLogSchema.pre('save', function(next) {
  // Set severity based on action
  if (!this.severity || this.severity === 'low') {
    const highSeverityActions = ['user_deleted', 'patient_deleted', 'document_deleted', 'permission_changed'];
    const mediumSeverityActions = ['failed_login', 'user_created', 'password_changed'];
    
    if (highSeverityActions.includes(this.action)) {
      this.severity = 'high';
    } else if (mediumSeverityActions.includes(this.action)) {
      this.severity = 'medium';
    }
  }
  
  // Add automatic tags
  if (!this.tags) {
    this.tags = [];
  }
  
  if (this.action.includes('patient')) {
    this.tags.push('patient_data');
  }
  if (this.action.includes('document')) {
    this.tags.push('medical_document');
  }
  if (this.action.includes('user')) {
    this.tags.push('user_management');
  }
  if (this.action.includes('failed') || this.severity === 'high') {
    this.tags.push('security');
  }
  
  next();
});

// AuditLog model factory for practice-specific databases
function createAuditLogModel(practiceDatabase) {
  // Check if model already exists on this connection
  if (practiceDatabase.models.AuditLog) {
    return practiceDatabase.models.AuditLog;
  }

  // Create AuditLog model on practice-specific database connection
  return practiceDatabase.model('AuditLog', auditLogSchema);
}

// Export factory and utilities
module.exports = {
  schema: auditLogSchema,
  createModel: createAuditLogModel,
  
  // Default model for backward compatibility (uses default mongoose connection)
  model: mongoose.model('AuditLog', auditLogSchema)
};
