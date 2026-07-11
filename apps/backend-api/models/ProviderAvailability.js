const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const providerAvailabilitySchema = new mongoose.Schema({
  // Provider Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  providerId: {
    type: String,
    required: true,
    index: true
  },
  providerName: {
    type: String,
    required: true
  },
  providerType: {
    type: String,
    enum: ['doctor', 'nurse', 'specialist', 'technician', 'therapist'],
    default: 'doctor'
  },
  
  // Regular Schedule (Weekly Pattern)
  regularSchedule: [{
    dayOfWeek: {
      type: Number, // 0 = Sunday, 6 = Saturday
      required: true,
      min: 0,
      max: 6
    },
    slots: [{
      startTime: {
        type: String, // Format: "HH:MM"
        required: true
      },
      endTime: {
        type: String, // Format: "HH:MM"
        required: true
      },
      slotDuration: {
        type: Number, // in minutes
        default: 30
      },
      maxAppointments: {
        type: Number,
        default: 1 // Some slots might allow double-booking
      },
      appointmentTypes: [{
        type: String,
        enum: [
          'consultation',
          'follow-up',
          'routine-checkup',
          'urgent-care',
          'procedure',
          'lab-work',
          'imaging',
          'vaccination',
          'physical-exam',
          'telehealth',
          'surgery',
          'therapy',
          'other'
        ]
      }]
    }]
  }],
  
  // Special Availability (Overrides regular schedule)
  specialAvailability: [{
    date: {
      type: Date,
      required: true
    },
    available: {
      type: Boolean,
      default: true
    },
    slots: [{
      startTime: String,
      endTime: String,
      slotDuration: Number,
      maxAppointments: Number,
      reason: String // "Extra practice hours", "Holiday coverage", etc.
    }]
  }],
  
  // Blocked Times (Vacations, Conferences, etc.)
  blockedTimes: [{
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      enum: ['vacation', 'conference', 'sick', 'personal', 'training', 'other'],
      default: 'other'
    },
    description: String,
    createdBy: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Break Times (Lunch, etc.)
  breakTimes: [{
    dayOfWeek: Number,
    startTime: String,
    endTime: String,
    description: String
  }],
  
  // Location Information
  defaultLocation: {
    practiceId: String,
    practiceName: String,
    department: String,
    room: String,
    address: String
  },
  
  // Availability Settings
  settings: {
    bufferTimeBetweenAppointments: {
      type: Number, // in minutes
      default: 0
    },
    maxDailyAppointments: {
      type: Number,
      default: 30
    },
    advanceBookingDays: {
      type: Number, // How many days in advance can appointments be booked
      default: 90
    },
    minimumNoticeHours: {
      type: Number, // Minimum hours notice required for booking
      default: 24
    },
    allowDoubleBooking: {
      type: Boolean,
      default: false
    },
    allowOverbooking: {
      type: Boolean,
      default: false
    },
    overbookingLimit: {
      type: Number,
      default: 2
    }
  },
  
  // Practice Information
  practiceId: {
    type: String,
    required: true,
    index: true
  },
  
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  effectiveTo: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: String,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: String
}, {
  timestamps: true
});

// Indexes
providerAvailabilitySchema.index({ providerId: 1, practiceId: 1 });
providerAvailabilitySchema.index({ 'specialAvailability.date': 1 });
providerAvailabilitySchema.index({ 'blockedTimes.startDate': 1, 'blockedTimes.endDate': 1 });

// Methods
providerAvailabilitySchema.methods.getAvailabilityForDate = function(date) {
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay();
  
  // Check if date is blocked
  const isBlocked = this.blockedTimes.some(block => {
    return targetDate >= new Date(block.startDate) && targetDate <= new Date(block.endDate);
  });
  
  if (isBlocked) {
    return { available: false, reason: 'Provider unavailable' };
  }
  
  // Check for special availability (overrides regular schedule)
  const specialDay = this.specialSecureDataAccess.query('availabilitys', special => {
    const specialDate = new Date(special.date, {}, context);
    return specialDate.toDateString() === targetDate.toDateString();
  });
  
  if (specialDay) {
    return {
      available: specialDay.available,
      slots: specialDay.slots || []
    };
  }
  
  // Get regular schedule for this day
  const regularDay = this.regularSecureDataAccess.query('schedules', schedule => schedule.dayOfWeek === dayOfWeek, {}, context);
  
  if (!regularDay) {
    return { available: false, reason: 'No regular hours on this day' };
  }
  
  // Filter out break times
  const availableSlots = regularDay.slots.filter(slot => {
    const breakTime = this.breakTimes.find(breakT => 
      breakT.dayOfWeek === dayOfWeek &&
      breakT.startTime <= slot.startTime &&
      breakT.endTime >= slot.endTime
    );
    return !breakTime;
  });
  
  return {
    available: true,
    slots: availableSlots
  };
};

// Static methods
providerAvailabilitySchema.statics.findByProvider = async function(providerId, practiceId) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'provider-availability-model',
    operation: 'findByProvider',
    practiceId: practiceId
  };
  const results = await SecureDataAccess.query('provideravailabilities', {
    providerId,
    practiceId,
    isActive: true,
    $or: [
      { effectiveTo: { $exists: false } },
      { effectiveTo: { $gte: new Date() } }
    ]
  }, { limit: 1 }, context);
  return results[0];
};

providerAvailabilitySchema.statics.findAvailableProviders = async function(practiceId, date, appointmentType) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay();
  
  const context = {
    serviceId: 'provider-availability-model',
    operation: 'findAvailableProviders',
    practiceId: practiceId
  };
  
  return SecureDataAccess.query('provideravailabilities', {
    practiceId,
    isActive: true,
    $or: [
      { effectiveTo: { $exists: false } },
      { effectiveTo: { $gte: targetDate } }
    ],
    effectiveFrom: { $lte: targetDate },
    // Has regular schedule on this day
    'regularSchedule.dayOfWeek': dayOfWeek,
    // Not blocked on this date
    $nor: [
      {
        blockedTimes: {
          $elemMatch: {
            startDate: { $lte: targetDate },
            endDate: { $gte: targetDate }
          }
        }
      }
    ]
  }, {}, context);
};

// Export the schema
module.exports = providerAvailabilitySchema;