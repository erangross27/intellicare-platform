const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

// Chat Session Schema - stores chat sessions per doctor user
const chatSessionSchema = new mongoose.Schema({
  // User identification (doctor who owns this chat session)
  userId: {
    type: String,
    required: true,
    index: true // Index for fast user-based queries
  },
  
  // Session identification
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Session title (can be Hebrew or English)
  title: {
    type: String,
    required: true,
    default: function() {
      // Auto-generate title based on creation time
      const now = new Date();
      return `Chat ${now.toLocaleDateString('en-US')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
  },
  
  // Language of the session (for proper RTL/LTR handling)
  language: {
    type: String,
    enum: ['en', 'he'],
    default: 'en'
  },
  
  // Session metadata
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Message count for quick reference
  messageCount: {
    type: Number,
    default: 0
  },
  
  // Last message timestamp for sorting
  lastMessageAt: {
    type: Date,
    default: Date.now
  },

  // Context for maintaining conversation state
  context: {
    type: Object,
    default: {},
    // Store pending actions, uploads, etc.
    // Example: { type: 'pending_document_upload', uploadId: 'upload_123', awaitingPatientName: true }
  },
  
  // Session summary for search (auto-generated from first few messages)
  summary: {
    type: String,
    default: ''
  },

  // Artifact panel state (persists panel state per conversation)
  artifactState: {
    type: Object,
    default: null,
    // Stores: { artifactPanelOpen, artifactPatientId, artifactCategory, artifactDocumentId, artifactLevel, artifactGridData, artifactPatientName }
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'chat_sessions'
});

// Indexes for performance
chatSessionSchema.index({ userId: 1, lastMessageAt: -1 }); // Sort user sessions by recent activity

// Note: Text search index removed to avoid MongoDB language override issues with Hebrew
// Using regex search in static methods instead for title/summary search

// Instance methods
chatSessionSchema.methods.updateLastActivity = async function(context) {
  this.lastMessageAt = new Date();
  
  // If SecureDataAccess context is provided, use it
  if (context && context.serviceId) {
    try {
      return await SecureDataAccess.update('chatSessions', 
        { sessionId: this.sessionId }, 
        { $set: { lastMessageAt: this.lastMessageAt } }, 
        context
      );
    } catch (error) {
      console.error('SecureDataAccess update failed, falling back to direct update:', error.message);
      // Fallback to direct update if SecureDataAccess fails
      this.lastMessageAt = new Date();
      return await this.save();
    }
  } else {
    // Direct update if no context provided (backward compatibility)
    this.lastMessageAt = new Date();
    return await this.save();
  }
};

chatSessionSchema.methods.incrementMessageCount = async function(context) {
  this.messageCount += 1;
  this.lastMessageAt = new Date();
  
  // If SecureDataAccess context is provided, use it
  if (context && context.serviceId) {
    try {
      return await SecureDataAccess.update('chatSessions', 
        { sessionId: this.sessionId }, 
        { $set: { 
          messageCount: this.messageCount,
          lastMessageAt: this.lastMessageAt 
        }}, 
        context
      );
    } catch (error) {
      console.error('SecureDataAccess update failed, falling back to direct update:', error.message);
      // Fallback to direct update if SecureDataAccess fails
      return await this.save();
    }
  } else {
    // Direct update if no context provided (backward compatibility)
    return await this.save();
  }
};

// Static methods
chatSessionSchema.statics.findByUser = async function(userId, limit = 50) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'chatsession-model',
    operation: 'findByUser',
    practiceId: 'global' // Chat sessions are typically global
  };
  
  return SecureDataAccess.query('chat_sessions', {
    userId,
    isActive: true  // Only return explicitly active sessions
  }, {
    sort: { lastMessageAt: -1 },
    limit: limit,
    select: 'sessionId title language messageCount lastMessageAt createdAt isActive'
  }, context);
};

chatSessionSchema.statics.findByUserAndLanguage = async function(userId, language, limit = 50) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'chatsession-model',
    operation: 'findByUserAndLanguage',
    practiceId: 'global' // Chat sessions are typically global
  };
  
  return SecureDataAccess.query('chat_sessions', { 
    userId, 
    language, 
    isActive: true 
  }, {
    sort: { lastMessageAt: -1 },
    limit: limit,
    select: 'sessionId title language messageCount lastMessageAt createdAt'
  }, context);
};

chatSessionSchema.statics.searchByUser = async function(userId, query, limit = 20) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'chatsession-model',
    operation: 'searchByUser',
    practiceId: 'global' // Chat sessions are typically global
  };
  
  return SecureDataAccess.query('chat_sessions', {
    userId,
    isActive: true,
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { summary: { $regex: query, $options: 'i' } }
    ]
  }, {
    sort: { lastMessageAt: -1 },
    limit: limit,
    select: 'sessionId title language messageCount lastMessageAt createdAt'
  }, context);
};

chatSessionSchema.statics.updateTitle = async function(sessionId, newTitle) {
  try {
    const result = await this.updateOne(
      { sessionId: sessionId },
      { $set: { title: newTitle } }
    );
    return result.modifiedCount > 0;
  } catch (error) {
    console.error('Error updating session title:', error);
    return false;
  }
};

// ChatSession model factory for practice-specific databases
function createChatSessionModel(practiceDatabase) {
  // Check if model already exists on this connection
  if (practiceDatabase.models.ChatSession) {
    return practiceDatabase.models.ChatSession;
  }

  // Create ChatSession model on practice-specific database connection
  return practiceDatabase.model('ChatSession', chatSessionSchema);
}

// Export factory and utilities
module.exports = {
  schema: chatSessionSchema,
  createModel: createChatSessionModel,

  // Default model for backward compatibility (uses default mongoose connection)
  model: mongoose.model('ChatSession', chatSessionSchema)
};
