const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const loginTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-delete expired tokens
loginTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Note: token uniqueness is already ensured by 'unique: true' in schema definition

// Factory for practice-specific databases
function createLoginTokenModel(practiceDatabase) {
  // Check if model already exists on this connection
  if (practiceDatabase.models.LoginToken) {
    return practiceDatabase.models.LoginToken;
  }
  
  // Create model on practice-specific database connection
  return practiceDatabase.model('LoginToken', loginTokenSchema);
}

module.exports = {
  schema: loginTokenSchema,
  createModel: createLoginTokenModel,
  
  // Default model for backward compatibility
  model: mongoose.model('LoginToken', loginTokenSchema)
};
