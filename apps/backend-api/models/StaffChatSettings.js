const mongoose = require('mongoose');

const staffChatSettingsSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },

  // Availability status
  availability: {
    type: String,
    enum: ['online', 'busy', 'away', 'appear_offline'],
    default: 'online'
  },

  // Custom status text (max 100 chars)
  statusText: {
    type: String,
    default: '',
    maxlength: 100
  },

  // Last seen timestamp
  lastSeen: {
    type: Date,
    default: null
  },

  // Preferences
  readReceiptsEnabled: {
    type: Boolean,
    default: true
  },

  notificationSound: {
    type: Boolean,
    default: true
  },

  desktopNotifications: {
    type: Boolean,
    default: true
  },

  theme: {
    type: String,
    enum: ['dark', 'darker', 'midnight'],
    default: 'dark'
  },

  // Profile image as base64 data URI (max ~500KB)
  profileImage: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  collection: 'staff_chat_settings'
});

// Unique index on userId per practice database
staffChatSettingsSchema.index({ userId: 1 }, { unique: true });

// Model factory for practice-specific databases
function createStaffChatSettingsModel(practiceDatabase) {
  if (practiceDatabase.models.StaffChatSettings) {
    return practiceDatabase.models.StaffChatSettings;
  }
  return practiceDatabase.model('StaffChatSettings', staffChatSettingsSchema);
}

module.exports = {
  schema: staffChatSettingsSchema,
  createModel: createStaffChatSettingsModel,
  model: mongoose.model('StaffChatSettings', staffChatSettingsSchema)
};
