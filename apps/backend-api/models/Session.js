const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  practiceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  practiceSubdomain: {
    type: String,
    required: true
  },
  csrfToken: {
    type: String,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
});

// Auto-delete expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);