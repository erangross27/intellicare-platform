const mongoose = require('mongoose');

const staffConversationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'group'],
    required: true
  },

  // Group-only fields
  name: {
    type: String,
    default: null
  },
  groupAdmin: {
    type: String,
    default: null
  },

  // Participants
  participants: [{
    userId: { type: String, required: true },
    displayName: { type: String, required: true },
    role: { type: String, default: 'staff' }
  }],

  // Fast lookup for direct chats (sorted IDs joined by '_')
  participantKey: {
    type: String,
    default: null
  },

  // Last message preview (encrypted)
  lastMessage: {
    content: { type: mongoose.Schema.Types.Mixed, default: null },
    senderId: { type: String, default: null },
    senderName: { type: String, default: null },
    createdAt: { type: Date, default: null }
  },

  // Per-participant unread counts: { 'userId1': 0, 'userId2': 3 }
  unreadCounts: {
    type: Map,
    of: Number,
    default: {}
  },

  // Per-user pinned: { 'userId1': Date, 'userId2': Date }
  pinnedBy: {
    type: Map,
    of: Date,
    default: {}
  },

  // Per-user mute: { 'userId1': { until: Date|null, mutedAt: Date } }
  mutedBy: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },

  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'staff_conversations'
});

// Indexes
staffConversationSchema.index({ 'participants.userId': 1, updatedAt: -1 });
staffConversationSchema.index({ participantKey: 1 }, { unique: true, sparse: true });

// Model factory for practice-specific databases
function createStaffConversationModel(practiceDatabase) {
  if (practiceDatabase.models.StaffConversation) {
    return practiceDatabase.models.StaffConversation;
  }
  return practiceDatabase.model('StaffConversation', staffConversationSchema);
}

module.exports = {
  schema: staffConversationSchema,
  createModel: createStaffConversationModel,
  model: mongoose.model('StaffConversation', staffConversationSchema)
};
