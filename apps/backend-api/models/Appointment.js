const mongoose = require('mongoose');
const crypto = require('crypto');
const secureConfigService = require('../services/secureConfigService');
const SecureDataAccess = require('../services/secureDataAccess');

// Encryption helper functions
const algorithm = 'aes-256-gcm';
const getEncryptionKey = () => {
  const key = secureConfigService.get('APPOINTMENT_ENCRYPTION_KEY') || secureConfigService.get('DOCUMENT_ENCRYPTION_KEY') || secureConfigService.get('ENCRYPTION_KEY');
  if (!key) {
    console.warn('⚠️ No encryption key found, using default (NOT SECURE FOR PRODUCTION)');
    return crypto.scryptSync('default-key-change-in-production', 'salt', 32);
  }
  return Buffer.from(key, 'hex');
};

const encrypt = (text) => {
  if (!text) return null;
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, getEncryptionKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
};

const decrypt = (encryptedData) => {
  if (!encryptedData || !encryptedData.encrypted) return null;
  
  try {
    const decipher = crypto.createDecipheriv(
      algorithm,
      getEncryptionKey(),
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
};

const appointmentSchema = new mongoose.Schema({
  // Patient Information
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  patientName: {
    type: String,
    required: true
  },
  // Encrypted sensitive patient data
  patientPhone: {
    type: Object, // Will store {encrypted, iv, authTag}
    set: function(value) {
      if (typeof value === 'string') {
        return encrypt(value);
      }
      return value;
    },
    get: function(value) {
      if (value && value.encrypted) {
        return decrypt(value);
      }
      return value;
    }
  },
  patientEmail: {
    type: Object, // Will store {encrypted, iv, authTag}
    set: function(value) {
      if (typeof value === 'string') {
        return encrypt(value);
      }
      return value;
    },
    get: function(value) {
      if (value && value.encrypted) {
        return decrypt(value);
      }
      return value;
    }
  },

  // Appointment Details
  appointmentNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  appointmentType: {
    type: String,
    required: true,
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
  },
  appointmentReason: {
    type: Object, // Encrypted for privacy
    required: true,
    set: function(value) {
      if (typeof value === 'string') {
        return encrypt(value);
      }
      return value;
    },
    get: function(value) {
      if (value && value.encrypted) {
        return decrypt(value);
      }
      return value;
    }
  },
  notes: {
    type: Object, // Encrypted clinical notes
    set: function(value) {
      if (typeof value === 'string') {
        return encrypt(value);
      }
      return value;
    },
    get: function(value) {
      if (value && value.encrypted) {
        return decrypt(value);
      }
      return value;
    }
  },

  // Scheduling
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledTime: {
    type: String,
    required: true
  },
  duration: {
    type: Number, // in minutes
    default: 30
  },
  timezone: {
    type: String,
    default: 'Asia/Jerusalem'
  },

  // Provider Information
  providerId: {
    type: String
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
  department: {
    type: String
  },
  room: {
    type: String
  },

  // Status and Priority
  status: {
    type: String,
    enum: [
      'scheduled', 
      'confirmed', 
      'checked-in', 
      'in-progress', 
      'completed', 
      'cancelled', 
      'no-show', 
      'rescheduled'
    ],
    default: 'scheduled'
  },
  priority: {
    type: String,
    enum: ['routine', 'urgent', 'stat'],
    default: 'routine'
  },
  cancellationReason: {
    type: String
  },

  // Check-in Information
  checkedInAt: {
    type: Date
  },
  checkedInBy: {
    type: String
  },
  actualStartTime: {
    type: Date
  },
  actualEndTime: {
    type: Date
  },
  actualDuration: {
    type: Number // in minutes
  },

  // Reminder and Communication
  remindersSent: [{
    type: {
      type: String,
      enum: ['sms', 'email', 'phone', 'push']
    },
    sentDate: Date,
    sentBy: String,
    delivered: {
      type: Boolean,
      default: false
    }
  }],
  confirmationRequired: {
    type: Boolean,
    default: true
  },
  confirmedAt: {
    type: Date
  },
  confirmedBy: {
    type: String
  },

  // Billing and Insurance
  insuranceRequired: {
    type: Boolean,
    default: false
  },
  insuranceVerified: {
    type: Boolean,
    default: false
  },
  copayAmount: {
    type: Number
  },
  estimatedCost: {
    type: Number
  },
  cptCode: {
    type: String
  },

  // Visit Information - Encrypted medical data
  chiefComplaint: {
    type: Object, // Encrypted
    set: function(value) {
      if (typeof value === 'string') {
        return encrypt(value);
      }
      return value;
    },
    get: function(value) {
      if (value && value.encrypted) {
        return decrypt(value);
      }
      return value;
    }
  },
  vitals: {
    type: Object, // Entire vitals object encrypted
    set: function(value) {
      if (value && typeof value === 'object' && !value.encrypted) {
        return encrypt(JSON.stringify(value));
      }
      return value;
    },
    get: function(value) {
      if (value && value.encrypted) {
        const decrypted = decrypt(value);
        try {
          return JSON.parse(decrypted);
        } catch {
          return decrypted;
        }
      }
      return value;
    }
  },
  diagnosisCodes: [String],
  procedureCodes: [String],
  visitSummary: {
    type: Object, // Encrypted
    set: function(value) {
      if (typeof value === 'string') {
        return encrypt(value);
      }
      return value;
    },
    get: function(value) {
      if (value && value.encrypted) {
        return decrypt(value);
      }
      return value;
    }
  },
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date
  },
  followUpInstructions: {
    type: String
  },

  // Practice Information
  practiceId: {
    type: String,
    required: true,
    index: true
  },
  practiceName: {
    type: String
  },
  clinicLocation: {
    type: String
  },

  // Metadata
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
  updatedBy: {
    type: String
  },

  // Additional Fields
  specialInstructions: {
    type: String
  },
  attachments: [{
    filename: String,
    fileType: String,
    uploadDate: Date,
    uploadedBy: String
  }],
  tags: [String],

  // Recurring Appointments
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly']
  },
  recurringEndDate: {
    type: Date
  },
  parentAppointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Optimized compound indexes for high-performance availability queries
// CRITICAL: These indexes are ordered specifically for our query patterns

// Primary availability query index (most important)
// Used for: Finding provider's appointments on a specific date with status
appointmentSchema.index({ 
  providerId: 1, 
  scheduledDate: 1, 
  status: 1, 
  scheduledTime: 1 
}, { name: 'availability_primary' });

// Conflict detection index
// Used for: Checking exact time slot conflicts
appointmentSchema.index({ 
  providerId: 1, 
  scheduledDate: 1, 
  scheduledTime: 1, 
  status: 1 
}, { name: 'conflict_check' });

// Patient history index
appointmentSchema.index({ 
  patientId: 1, 
  practiceId: 1, 
  scheduledDate: -1 
}, { name: 'patient_history' });

// Practice daily view index
appointmentSchema.index({ 
  practiceId: 1, 
  scheduledDate: 1, 
  status: 1 
}, { name: 'practice_daily' });

// Provider daily schedule index
appointmentSchema.index({ 
  providerId: 1, 
  scheduledDate: 1, 
  scheduledTime: 1 
}, { name: 'provider_schedule' });

// Status tracking index
appointmentSchema.index({ 
  status: 1, 
  scheduledDate: 1 
}, { name: 'status_tracking' });

// Appointment lookup index
appointmentSchema.index({ 
  appointmentNumber: 1 
}, { 
  unique: true, 
  name: 'appointment_lookup' 
});

// Virtual for checking if appointment is today
appointmentSchema.virtual('isToday').get(function() {
  const today = new Date();
  const appointmentDate = new Date(this.scheduledDate);
  return today.toDateString() === appointmentDate.toDateString();
});

// Virtual for checking if appointment is overdue
appointmentSchema.virtual('isOverdue').get(function() {
  const now = new Date();
  const appointmentDateTime = new Date(this.scheduledDate);
  return now > appointmentDateTime && this.status === 'scheduled';
});

// Virtual for time until appointment
appointmentSchema.virtual('timeUntilAppointment').get(function() {
  const now = new Date();
  const appointmentDateTime = new Date(this.scheduledDate);
  const diffMs = appointmentDateTime - now;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  return diffHours;
});

// Virtual for appointment datetime
appointmentSchema.virtual('appointmentDateTime').get(function() {
  const date = new Date(this.scheduledDate);
  const time = this.scheduledTime;
  const [hours, minutes] = time.split(':');
  date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return date;
});

// Methods
appointmentSchema.methods.updateStatus = function(status, reason, userId) {
  const validStatuses = [
    'scheduled', 'confirmed', 'checked-in', 'in-progress', 
    'completed', 'cancelled', 'no-show', 'rescheduled'
  ];
  
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Valid options: ${validStatuses.join(', ')}`);
  }
  
  this.status = status;
  if (reason && status === 'cancelled') {
    this.cancellationReason = reason;
  }
  this.updatedBy = userId;
  this.lastUpdated = new Date();
  
  // Set specific timestamps based on status
  if (status === 'confirmed') {
    this.confirmedAt = new Date();
    this.confirmedBy = userId;
  } else if (status === 'checked-in') {
    this.checkedInAt = new Date();
    this.checkedInBy = userId;
  } else if (status === 'in-progress') {
    this.actualStartTime = new Date();
  } else if (status === 'completed') {
    this.actualEndTime = new Date();
    if (this.actualStartTime) {
      this.actualDuration = Math.floor((this.actualEndTime - this.actualStartTime) / (1000 * 60));
    }
  }
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

appointmentSchema.methods.reschedule = function(newDate, newTime, userId, reason) {
  this.scheduledDate = new Date(newDate);
  this.scheduledTime = newTime;
  this.status = 'rescheduled';
  this.updatedBy = userId;
  this.lastUpdated = new Date();
  this.notes = this.notes ? `${this.notes}\nRescheduled: ${reason}` : `Rescheduled: ${reason}`;
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

appointmentSchema.methods.addReminder = function(type, sentBy) {
  this.remindersSent.push({
    type: type,
    sentDate: new Date(),
    sentBy: sentBy,
    delivered: false
  });
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

appointmentSchema.methods.recordVitals = function(vitalsData, userId) {
  this.vitals = {
    ...this.vitals,
    ...vitalsData
  };
  
  // Calculate BMI if height and weight are provided
  if (vitalsData.height && vitalsData.weight) {
    const heightInMeters = vitalsData.height / 100;
    this.vitals.bmi = Math.round((vitalsData.weight / (heightInMeters * heightInMeters)) * 10) / 10;
  }
  
  this.updatedBy = userId;
  this.lastUpdated = new Date();
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

// Static methods
appointmentSchema.statics.findByPatient = async function(patientId, practiceId, options = {}) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const query = { patientId, practiceId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.dateFrom || options.dateTo) {
    query.scheduledDate = {};
    if (options.dateFrom) query.scheduledDate.$gte = new Date(options.dateFrom);
    if (options.dateTo) query.scheduledDate.$lte = new Date(options.dateTo);
  }
  
  const context = {
    serviceId: 'appointment-model',
    operation: 'findByPatient',
    practiceId: practiceId
  };
  
  return SecureDataAccess.query('appointments', query, {
    sort: { scheduledDate: -1 },
    limit: options.limit || 50
  }, context);
};

appointmentSchema.statics.findByProvider = async function(providerId, practiceId, options = {}) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const query = { providerId, practiceId };
  
  if (options.date) {
    const startDate = new Date(options.date);
    const endDate = new Date(options.date);
    endDate.setDate(endDate.getDate() + 1);
    query.scheduledDate = { $gte: startDate, $lt: endDate };
  }
  
  const context = {
    serviceId: 'appointment-model',
    operation: 'findByProvider',
    practiceId: practiceId
  };
  
  return SecureDataAccess.query('appointments', query, {
    sort: { scheduledDate: 1, scheduledTime: 1 },
    limit: options.limit || 100
  }, context);
};

appointmentSchema.statics.findTodaysAppointments = async function(practiceId, options = {}) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  
  const query = {
    practiceId,
    scheduledDate: { $gte: startOfDay, $lt: endOfDay }
  };
  
  if (options.providerId) {
    query.providerId = options.providerId;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  const context = {
    serviceId: 'appointment-model',
    operation: 'findTodaysAppointments',
    practiceId: practiceId
  };
  
  return SecureDataAccess.query('appointments', query, {
    sort: { scheduledTime: 1 },
    limit: options.limit || 200
  }, context);
};

appointmentSchema.statics.findOverdue = async function(practiceId) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const now = new Date();
  
  const context = {
    serviceId: 'appointment-model',
    operation: 'findOverdue',
    practiceId: practiceId
  };
  
  return SecureDataAccess.query('appointments', {
    practiceId,
    scheduledDate: { $lt: now },
    status: { $in: ['scheduled', 'confirmed'] }
  }, {
    sort: { scheduledDate: 1 }
  }, context);
};

// Export the schema, not the model
module.exports = appointmentSchema;