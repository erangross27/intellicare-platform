const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

// Chat Message Schema - stores individual messages within chat sessions
const chatMessageSchema = new mongoose.Schema({
  // Session reference
  sessionId: {
    type: String,
    required: true,
    index: true // Index for fast session-based queries
  },
  
  // User identification (doctor who owns this message)
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // Message identification
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Message type: 'user' or 'agent'
  type: {
    type: String,
    enum: ['user', 'agent'],
    required: true
  },
  
  // Message content (can be Hebrew or English, encrypted or plain)
  content: {
    type: mongoose.Schema.Types.Mixed, // Changed to Mixed to support encrypted objects
    required: true
  },
  
  // Language of the message
  language: {
    type: String,
    enum: ['en', 'he', 'none'], // Added 'none' for MongoDB text index compatibility
    default: 'en'
  },
  
  // Agent-specific fields
  actionTaken: {
    type: String,
    default: null // e.g., "update_patient", "add_patient", etc.
  },
  
  actionResult: {
    type: mongoose.Schema.Types.Mixed,
    default: null // Store the result of the action
  },

  // Display data for grids and structured views
  displayData: {
    type: mongoose.Schema.Types.Mixed,
    default: null // Store grid data or other structured display data
  },

  displayType: {
    type: String,
    default: null // e.g., "grid", "medicalGrid", "patientList", "multiCategoryGrid"
  },

  // Multi-category grids for medical data display
  categoryGrids: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  // Message metadata
  isError: {
    type: Boolean,
    default: false
  },
  
  // Processing time for agent responses
  processingTime: {
    type: Number,
    default: null // in milliseconds
  },
  
  // Message sequence number within session
  sequenceNumber: {
    type: Number,
    required: true
  },
  
  // Voice-related fields (for future implementation)
  hasVoiceInput: {
    type: Boolean,
    default: false
  },
  
  hasVoiceOutput: {
    type: Boolean,
    default: false
  },
  
  voiceMetadata: {
    inputDuration: Number, // seconds
    outputDuration: Number, // seconds
    voiceLanguage: String // 'he' or 'en'
  },

  // File attachments metadata
  attachments: [{
    fileName: {
      type: String,
      required: true
    },
    uploadId: String, // The UPLOAD_ID reference
    documentId: String, // MongoDB document ID if saved to documents collection
    mimeType: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'chat_messages'
});

// Indexes for performance
chatMessageSchema.index({ sessionId: 1, sequenceNumber: 1 }); // Sort messages within session
chatMessageSchema.index({ userId: 1, createdAt: -1 }); // User's recent messages
chatMessageSchema.index({ sessionId: 1, content: 'text' }, {
  default_language: 'none',  // Disable language-specific text search
  language_override: 'none'  // Don't use language field for text search
}); // Text search within session

// Instance methods
chatMessageSchema.methods.markAsError = async function(errorMessage) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const serviceAccountManager = require('../services/serviceAccountManager');
  
  // Authenticate the service to get API key
  const auth = await serviceAccountManager.authenticate('chat-message-model');
  
  this.isError = true;
  this.content = errorMessage;
  
  const context = {
    serviceId: 'chat-message-model',
    operation: 'markAsError',
    practiceId: 'global',
    apiKey: auth.apiKey || auth.sessionToken
  };
  
  return SecureDataAccess.update('chat_messages', { _id: this._id }, this, context);
};

// Static methods
chatMessageSchema.statics.findBySession = async function(sessionId, limit = 100) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const serviceAccountManager = require('../services/serviceAccountManager');
  
  // Authenticate the service to get API key
  const auth = await serviceAccountManager.authenticate('chat-message-model');
  
  const context = {
    serviceId: 'chat-message-model',
    operation: 'findBySession',
    practiceId: 'global',
    apiKey: auth.apiKey || auth.sessionToken // Include the API key for authentication
  };
  return SecureDataAccess.query('chat_messages', { sessionId }, {
    sort: { sequenceNumber: 1 },
    limit: limit,
    projection: 'messageId type content language actionTaken actionResult isError createdAt sequenceNumber'
  }, context);
};

chatMessageSchema.statics.searchInSession = async function(sessionId, query, limit = 20) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const serviceAccountManager = require('../services/serviceAccountManager');
  
  // Authenticate the service to get API key
  const auth = await serviceAccountManager.authenticate('chat-message-model');
  
  const context = {
    serviceId: 'chat-message-model',
    operation: 'searchInSession',
    practiceId: 'global',
    apiKey: auth.apiKey || auth.sessionToken // Include the API key for authentication
  };
  return SecureDataAccess.query('chat_messages', {
    sessionId,
    content: { $regex: query, $options: 'i' }
  }, {
    sort: { sequenceNumber: 1 },
    limit: limit,
    projection: 'messageId type content language sequenceNumber createdAt'
  }, context);
};

chatMessageSchema.statics.getLastSequenceNumber = async function(sessionId) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const serviceAccountManager = require('../services/serviceAccountManager');
  
  // Authenticate the service to get API key
  const auth = await serviceAccountManager.authenticate('chat-message-model');
  
  const context = {
    serviceId: 'chat-message-model',
    operation: 'getLastSequenceNumber',
    practiceId: 'global',
    apiKey: auth.apiKey || auth.sessionToken // Include the API key for authentication
  };
  const messages = await SecureDataAccess.query('chat_messages', { sessionId }, {
    sort: { sequenceNumber: -1 },
    limit: 1,
    projection: 'sequenceNumber'
  }, context);
  const lastMessage = messages[0];
  
  return lastMessage ? lastMessage.sequenceNumber : 0;
};

chatMessageSchema.statics.searchUserMessages = async function(userId, query, limit = 50) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const serviceAccountManager = require('../services/serviceAccountManager');
  
  // Authenticate the service to get API key
  const auth = await serviceAccountManager.authenticate('chat-message-model');
  
  const context = {
    serviceId: 'chat-message-model',
    operation: 'searchUserMessages',
    practiceId: 'global',
    apiKey: auth.apiKey || auth.sessionToken // Include the API key for authentication
  };
  return SecureDataAccess.query('chat_messages', {
    userId,
    content: { $regex: query, $options: 'i' }
  }, {
    sort: { createdAt: -1 },
    limit: limit,
    projection: 'sessionId messageId type content language createdAt',
    populate: { path: 'sessionId', select: 'title' }
  }, context);
};

// ChatMessage model factory for practice-specific databases
function createChatMessageModel(practiceDatabase) {
  // Check if model already exists on this connection
  if (practiceDatabase.models.ChatMessage) {
    return practiceDatabase.models.ChatMessage;
  }

  // Create ChatMessage model on practice-specific database connection
  return practiceDatabase.model('ChatMessage', chatMessageSchema);
}

// Export factory and utilities
module.exports = {
  schema: chatMessageSchema,
  createModel: createChatMessageModel,

  // Default model for backward compatibility (uses default mongoose connection)
  model: mongoose.model('ChatMessage', chatMessageSchema)
};
