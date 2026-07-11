const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const referralSchema = new mongoose.Schema({
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
  patientDateOfBirth: {
    type: Date
  },

  // Referral Details
  referralNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  specialtyType: {
    type: String,
    required: true,
    enum: [
      'cardiology',
      'dermatology',
      'endocrinology',
      'gastroenterology',
      'neurology',
      'oncology',
      'orthopedics',
      'psychiatry',
      'radiology',
      'surgery',
      'urology',
      'ophthalmology',
      'otolaryngology',
      'pulmonology',
      'rheumatology',
      'other'
    ]
  },
  reason: {
    type: String,
    required: true
  },
  clinicalNotes: {
    type: String
  },

  // Urgency and Priority
  urgency: {
    type: String,
    enum: ['routine', 'urgent', 'stat'],
    default: 'routine'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },

  // Provider Information
  preferredProvider: {
    type: String
  },
  assignedProvider: {
    type: String
  },
  providerContact: {
    phone: String,
    email: String,
    address: String
  },
  
  // Referring Physician
  referringPhysician: {
    type: String,
    required: true
  },
  referringPhysicianId: {
    type: String,
    required: true
  },
  referringPhysicianLicense: {
    type: String
  },

  // Dates
  referralDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  appointmentDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  validUntil: {
    type: Date,
    required: true
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'completed', 'cancelled', 'no-show', 'expired'],
    default: 'pending'
  },
  statusNotes: {
    type: String
  },

  // Clinical Information
  diagnosis: {
    type: String
  },
  expectedDuration: {
    type: String
  },
  followUpRequired: {
    type: Boolean,
    default: false
  },
  
  // Insurance and Authorization
  insuranceApprovalRequired: {
    type: Boolean,
    default: false
  },
  authorizationNumber: {
    type: String
  },
  insuranceStatus: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'not-required'],
    default: 'not-required'
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

  // Communication
  patientNotified: {
    type: Boolean,
    default: false
  },
  providerNotified: {
    type: Boolean,
    default: false
  },
  communicationLog: [{
    date: Date,
    method: {
      type: String,
      enum: ['phone', 'email', 'fax', 'mail', 'portal']
    },
    recipient: String,
    notes: String
  }],

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
  notes: {
    type: String
  },
  attachments: [{
    filename: String,
    fileType: String,
    uploadDate: Date,
    uploadedBy: String
  }]
}, {
  timestamps: true
});

// Indexes for better performance
referralSchema.index({ patientId: 1, practiceId: 1 });
referralSchema.index({ referralDate: -1 });
referralSchema.index({ status: 1 });
referralSchema.index({ urgency: 1 });
referralSchema.index({ specialtyType: 1 });
referralSchema.index({ validUntil: 1 });

// Virtual for checking if expired
referralSchema.virtual('isExpired').get(function() {
  return new Date() > this.validUntil;
});

// Virtual for days remaining
referralSchema.virtual('daysRemaining').get(function() {
  const days = Math.ceil((this.validUntil - new Date()) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
});

// Virtual for urgency level
referralSchema.virtual('isUrgent').get(function() {
  return this.urgency === 'urgent' || this.urgency === 'stat';
});

// Methods
referralSchema.methods.updateStatus = function(status, notes, userId) {
  const validStatuses = ['pending', 'scheduled', 'completed', 'cancelled', 'no-show', 'expired'];
  
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Valid options: ${validStatuses.join(', ')}`);
  }
  
  this.status = status;
  if (notes) this.statusNotes = notes;
  this.updatedBy = userId;
  this.lastUpdated = new Date();
  
  if (status === 'completed') {
    this.completedDate = new Date();
  }
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

referralSchema.methods.scheduleAppointment = function(appointmentDate, providerName, userId) {
  this.status = 'scheduled';
  this.appointmentDate = new Date(appointmentDate);
  if (providerName) this.assignedProvider = providerName;
  this.updatedBy = userId;
  this.lastUpdated = new Date();
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

referralSchema.methods.addCommunicationLog = function(method, recipient, notes) {
  this.communicationLog.push({
    date: new Date(),
    method: method,
    recipient: recipient,
    notes: notes
  });
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

// Static methods
referralSchema.statics.findByPatient = async function(patientId, practiceId, options = {}) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const query = { patientId, practiceId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.specialtyType) {
    query.specialtyType = options.specialtyType;
  }
  
  const context = {
    serviceId: 'referral-model',
    operation: 'findByPatient',
    practiceId: practiceId
  };
  
  return SecureDataAccess.query('referrals', query, {
    sort: { referralDate: -1 },
    limit: options.limit || 50
  }, context);
};

referralSchema.statics.findPending = async function(practiceId, options = {}) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const query = { 
    practiceId,
    status: 'pending'
  };
  
  if (options.urgency) {
    query.urgency = options.urgency;
  }
  
  if (options.specialtyType) {
    query.specialtyType = options.specialtyType;
  }
  
  const context = {
    serviceId: 'referral-model',
    operation: 'findPending',
    practiceId: practiceId
  };
  
  return SecureDataAccess.query('referrals', query, {
    sort: { urgency: -1, referralDate: 1 },
    limit: options.limit || 100
  }, context);
};

referralSchema.statics.findExpiring = async function(practiceId, days = 7) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  const context = {
    serviceId: 'referral-model',
    operation: 'findExpiring',
    practiceId: practiceId
  };
  
  return SecureDataAccess.query('referrals', {
    practiceId,
    status: { $in: ['pending', 'scheduled'] },
    validUntil: { $lte: futureDate, $gte: new Date() }
  }, {
    sort: { validUntil: 1 }
  }, context);
};

module.exports = mongoose.model('Referral', referralSchema);