const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const emailVerificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  // OTP-specific fields for email verification
  otpCode: {
    type: String,
    required: false,  // Optional - not all verifications use OTP
    index: true       // Index for fast lookups
  },
  otpExpiry: {
    type: Date,
    required: false  // Set when OTP is generated (10 minutes) - TTL index defined below
  },
  practiceSubdomain: {
    type: String,
    required: false   // For redirect after verification
  },
  used: {
    type: Boolean,    // Additional flag for OTP verification
    default: false
  },
  verifiedAt: {
    type: Date        // Track when verification occurred
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-delete expired tokens (for email verification tokens - 24 hours)
emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Auto-delete expired OTPs (for OTP codes - 10 minutes)
emailVerificationSchema.index({ otpExpiry: 1 }, { expireAfterSeconds: 0 });

// Compound index for efficient OTP lookups
emailVerificationSchema.index({ email: 1, otpCode: 1, used: 1 });

// Note: token uniqueness is already ensured by 'unique: true' in schema definition

// Factory for practice-specific databases
function createEmailVerificationModel(practiceDatabase) {
  // Check if model already exists on this connection
  if (practiceDatabase.models.EmailVerification) {
    return practiceDatabase.models.EmailVerification;
  }
  
  // Create model on practice-specific database connection
  return practiceDatabase.model('EmailVerification', emailVerificationSchema);
}

module.exports = {
  schema: emailVerificationSchema,
  createModel: createEmailVerificationModel,
  
  // Default model for backward compatibility
  model: mongoose.model('EmailVerification', emailVerificationSchema)
};
