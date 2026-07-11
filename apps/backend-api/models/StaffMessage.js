const mongoose = require('mongoose');

const staffMessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  senderId: {
    type: String,
    required: true
  },

  senderName: {
    type: String,
    required: true
  },

  // Encrypted content (AES-256-GCM via encryptionService)
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Read receipts: { userId: readAt }
  readBy: {
    type: Map,
    of: Date,
    default: {}
  },

  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },

  // Reply to another message
  replyTo: {
    messageId: { type: mongoose.Schema.Types.ObjectId, default: null },
    senderId: { type: String, default: null },
    senderName: { type: String, default: null },
    content: { type: mongoose.Schema.Types.Mixed, default: null }, // encrypted snapshot, first 200 chars
    messageType: { type: String, default: null }
  },

  // Emoji reactions: { '👍': ['userId1', 'userId2'], '❤️': ['userId3'] }
  reactions: {
    type: Map,
    of: [String],
    default: {}
  },

  // Soft delete per user
  deletedFor: {
    type: [String],
    default: []
  },

  // Delete for everyone (sender only, 15-min window)
  deletedForEveryone: {
    type: Boolean,
    default: false
  },

  deletedForEveryoneAt: {
    type: Date,
    default: null
  },

  deletedForEveryoneBy: {
    type: String,
    default: null
  },

  // Forwarded message metadata
  forwardedFrom: {
    originalSenderId: { type: String, default: null },
    originalSenderName: { type: String, default: null },
    originalConversationId: { type: mongoose.Schema.Types.ObjectId, default: null }
  },

  // File attachments (future)
  attachment: {
    fileName: String,
    fileSize: Number,
    mimeType: String,
    url: String
  }
}, {
  timestamps: true,
  collection: 'staff_messages'
});

// Indexes
staffMessageSchema.index({ conversationId: 1, createdAt: 1 });
staffMessageSchema.index({ conversationId: 1, createdAt: -1 });

// Model factory for practice-specific databases
function createStaffMessageModel(practiceDatabase) {
  if (practiceDatabase.models.StaffMessage) {
    return practiceDatabase.models.StaffMessage;
  }
  return practiceDatabase.model('StaffMessage', staffMessageSchema);
}

module.exports = {
  schema: staffMessageSchema,
  createModel: createStaffMessageModel,
  model: mongoose.model('StaffMessage', staffMessageSchema)
};
