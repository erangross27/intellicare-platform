const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const ZeroTrustSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userInfo: {
    email: String,
    fullName: String,
    roles: [String],
    permissions: [String],
    mfaEnabled: Boolean,
    mfaVerified: Boolean
  },
  clientInfo: {
    ip: String,
    userAgent: String,
    acceptLanguage: String,
    acceptEncoding: String
  },
  sessionToken: {
    type: String,
    required: true
  },
  riskScore: {
    type: Number,
    default: 0.1,
    min: 0,
    max: 1
  },
  deviceFingerprint: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  lastTokenRefresh: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient cleanup of expired sessions
ZeroTrustSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for finding active sessions by user
ZeroTrustSessionSchema.index({ userId: 1, isActive: 1 });

// Index for session cleanup
ZeroTrustSessionSchema.index({ lastActivity: 1, isActive: 1 });

// Methods
ZeroTrustSessionSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

ZeroTrustSessionSchema.methods.refreshToken = function(newToken) {
  this.sessionToken = newToken;
  this.lastTokenRefresh = new Date();
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

ZeroTrustSessionSchema.methods.updateRiskScore = function(newScore) {
  this.riskScore = Math.min(Math.max(newScore, 0), 1); // Clamp between 0 and 1
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

ZeroTrustSessionSchema.methods.deactivate = function() {
  this.isActive = false;
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

// Static methods
ZeroTrustSessionSchema.statics.findActiveBySessionId = async function(sessionId) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'zerotrustsession-model',
    operation: 'findActiveBySessionId',
    practiceId: 'global' // Zero trust sessions are typically global
  };
  
  const results = await SecureDataAccess.query('zerotrustsessions', { 
    sessionId, 
    isActive: true,
    expiresAt: { $gt: new Date() }
  }, { limit: 1 }, context);
  
  return results && results.length > 0 ? results[0] : null;
};

ZeroTrustSessionSchema.statics.findActiveByUserId = async function(userId) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'zerotrustsession-model',
    operation: 'findActiveByUserId',
    practiceId: 'global' // Zero trust sessions are typically global
  };
  
  return SecureDataAccess.query('zerotrustsessions', { 
    userId, 
    isActive: true,
    expiresAt: { $gt: new Date() }
  }, {}, context);
};

ZeroTrustSessionSchema.statics.cleanupExpiredSessions = async function() {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'zerotrustsession-model',
    operation: 'cleanupExpiredSessions',
    practiceId: 'global' // Zero trust sessions are typically global
  };
  
  return SecureDataAccess.update('zerotrustsessions', 
    { 
      $or: [
        { expiresAt: { $lt: new Date() } },
        { lastActivity: { $lt: new Date(Date.now() - 8 * 60 * 60 * 1000) } } // 8 hours
      ]
    },
    { isActive: false },
    context
  );
};

ZeroTrustSessionSchema.statics.deactivateUserSessions = async function(userId) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'zerotrustsession-model',
    operation: 'deactivateUserSessions',
    practiceId: 'global' // Zero trust sessions are typically global
  };
  
  return SecureDataAccess.update('zerotrustsessions',
    { userId, isActive: true },
    { isActive: false },
    context
  );
};

// Export schema only - models will be created per practice database
module.exports = ZeroTrustSessionSchema;
