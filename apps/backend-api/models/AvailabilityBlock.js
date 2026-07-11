const mongoose = require('mongoose');

const availabilityBlockSchema = new mongoose.Schema({
  providerId: {
    type: String,
    required: true,
    index: true
  },
  providerName: {
    type: String
  },
  blockType: {
    type: String,
    enum: ['lunch', 'meeting', 'personal', 'vacation', 'sick', 'other'],
    default: 'other'
  },
  reason: {
    type: String
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true
  },
  startTime: {
    type: String, // Format: "HH:MM"
    required: true
  },
  endTime: {
    type: String, // Format: "HH:MM"
    required: true
  },
  recurring: {
    type: Boolean,
    default: false
  },
  recurringDays: [{
    type: Number, // 0 = Sunday, 1 = Monday, etc.
    min: 0,
    max: 6
  }],
  recurringEndDate: {
    type: Date // When recurring blocks should stop
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'cancelled'],
    default: 'active'
  },
  practiceId: {
    type: String,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
availabilityBlockSchema.index({ providerId: 1, startDate: 1, status: 1 });
availabilityBlockSchema.index({ practiceId: 1, startDate: 1 });

// Method to check if a block is active on a specific date/time
availabilityBlockSchema.methods.isActiveAt = function(date, time) {
  if (this.status !== 'active') return false;
  
  const checkDate = new Date(date);
  const blockStart = new Date(this.startDate);
  const blockEnd = new Date(this.endDate);
  
  // Check if date is within block range
  if (checkDate < blockStart || checkDate > blockEnd) return false;
  
  // Check if it's a recurring block
  if (this.recurring) {
    const dayOfWeek = checkDate.getDay();
    if (!this.recurringDays.includes(dayOfWeek)) return false;
    
    // Check if we've passed the recurring end date
    if (this.recurringEndDate && checkDate > this.recurringEndDate) return false;
  }
  
  // Check time
  if (time >= this.startTime && time < this.endTime) return true;
  
  return false;
};

module.exports = availabilityBlockSchema;