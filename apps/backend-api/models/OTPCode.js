const mongoose = require('mongoose');

/**
 * OTP Code Schema for passwordless authentication
 * Stores 6-digit verification codes sent via email
 */
const otpCodeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  code: {
    type: String,
    required: true,
    length: 6
  },
  
  practiceSubdomain: {
    type: String,
    default: null,
    index: true
  },
  
  attempts: {
    type: Number,
    default: 0,
    max: 3
  },
  
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  isUsed: {
    type: Boolean,
    default: false,
    index: true
  },
  
  verifiedAt: {
    type: Date,
    default: null
  },
  
  // For security tracking
  ipAddress: {
    type: String,
    default: null
  },
  
  userAgent: {
    type: String,
    default: null
  },
  
  // For rate limiting
  requestCount: {
    type: Number,
    default: 1
  },
  
  lastRequestAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false, // We manage createdAt manually
  collection: 'otpcodes'
});

// Compound indexes for efficient queries
otpCodeSchema.index({ email: 1, code: 1, isUsed: 1 });
otpCodeSchema.index({ email: 1, createdAt: -1 });
otpCodeSchema.index({ expiresAt: 1, isUsed: 1 }); // For cleanup

// TTL index to automatically delete expired codes after 1 hour
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

// Instance method to check if code is valid
otpCodeSchema.methods.isValid = function() {
  return !this.isUsed && 
         this.attempts < 3 && 
         this.expiresAt > new Date();
};

// Instance method to check if can resend
otpCodeSchema.methods.canResend = function() {
  const now = new Date();
  const secondsSinceCreation = (now - this.createdAt) / 1000;
  return secondsSinceCreation >= 60; // 60 second minimum between resends
};

// Static method to find valid OTP
otpCodeSchema.statics.findValidOTP = async function(email, code) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'otp-model',
    operation: 'findValidOTP',
    practiceId: 'global' // OTP codes are global
  };
  
  const results = await SecureDataAccess.query('otpcodes', {
    email: email.toLowerCase(),
    code: code,
    isUsed: false,
    expiresAt: { $gt: new Date() },
    attempts: { $lt: 3 }
  }, { limit: 1 }, context);
  
  return results && results.length > 0 ? results[0] : null;
};

// Static method to cleanup old codes
otpCodeSchema.statics.cleanup = async function() {
  const SecureDataAccess = require('../services/secureDataAccess');
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const context = {
    serviceId: 'otp-model',
    operation: 'cleanup',
    practiceId: 'global' // OTP codes are global
  };
  
  return SecureDataAccess.delete('otpcodes', {
    $or: [
      { expiresAt: { $lt: oneHourAgo } },
      { isUsed: true, verifiedAt: { $lt: oneHourAgo } }
    ]
  }, context);
};

// Pre-save middleware to ensure code is 6 digits
otpCodeSchema.pre('save', function(next) {
  if (this.code && this.code.length !== 6) {
    return next(new Error('OTP code must be exactly 6 digits'));
  }
  
  // Ensure code is string
  if (typeof this.code === 'number') {
    this.code = this.code.toString().padStart(6, '0');
  }
  
  next();
});

// Virtual for time remaining
otpCodeSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const remaining = this.expiresAt - now;
  return Math.max(0, Math.floor(remaining / 1000)); // seconds
});

// Virtual for formatted time remaining
otpCodeSchema.virtual('formattedTimeRemaining').get(function() {
  const seconds = this.timeRemaining;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
});

// Export function to create model with practice-specific connection
module.exports.createModel = function(connection) {
  return connection.model('OTPCode', otpCodeSchema);
};

// Export schema for reference
module.exports.schema = otpCodeSchema;