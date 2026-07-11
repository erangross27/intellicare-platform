const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const medicationSchema = new mongoose.Schema({
  medicationName: {
    type: String,
    required: true
  },
  dosage: {
    type: String,
    required: true
  },
  frequency: {
    type: String,
    required: true
  },
  duration: {
    type: String
  },
  instructions: {
    type: String
  },
  quantity: {
    type: Number
  },
  unit: {
    type: String,
    default: 'tablets'
  }
});

const refillHistorySchema = new mongoose.Schema({
  filledDate: {
    type: Date,
    required: true
  },
  filledBy: {
    type: String,
    required: true
  },
  pharmacistNotes: {
    type: String
  }
});

const prescriptionSchema = new mongoose.Schema({
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

  // Prescription Details
  prescriptionNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  medications: [medicationSchema],
  instructions: {
    type: String
  },

  // Validity and Refills
  prescribedDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  refills: {
    type: Number,
    default: 0
  },
  refillsRemaining: {
    type: Number,
    default: 0
  },
  refillHistory: [refillHistorySchema],

  // Prescriber Information
  prescribedBy: {
    type: String,
    required: true
  },
  prescriberName: {
    type: String
  },
  prescriberLicense: {
    type: String
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'filled', 'expired', 'cancelled', 'discontinued'],
    default: 'active'
  },
  statusReason: {
    type: String
  },

  // Clinical Information
  diagnosis: {
    type: String
  },
  indication: {
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
  priority: {
    type: String,
    enum: ['routine', 'urgent', 'stat'],
    default: 'routine'
  },
  
  // E-prescription fields
  electronicSignature: {
    type: String
  },
  transmissionMethod: {
    type: String,
    enum: ['electronic', 'printed', 'faxed'],
    default: 'electronic'
  }
}, {
  timestamps: true
});

// Indexes for better performance
prescriptionSchema.index({ patientId: 1, practiceId: 1 });
prescriptionSchema.index({ prescribedDate: -1 });
prescriptionSchema.index({ validUntil: 1 });
prescriptionSchema.index({ status: 1 });

// Virtual for checking if expired
prescriptionSchema.virtual('isExpired').get(function() {
  return new Date() > this.validUntil;
});

// Virtual for days remaining
prescriptionSchema.virtual('daysRemaining').get(function() {
  const days = Math.ceil((this.validUntil - new Date()) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
});

// Methods
prescriptionSchema.methods.processRefill = function(userId, notes) {
  if (this.refillsRemaining <= 0) {
    throw new Error('No refills remaining');
  }
  
  if (this.isExpired) {
    throw new Error('Prescription has expired');
  }
  
  this.refillsRemaining -= 1;
  this.refillHistory.push({
    filledDate: new Date(),
    filledBy: userId,
    pharmacistNotes: notes
  });
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

prescriptionSchema.methods.updateStatus = function(status, reason, userId) {
  const validStatuses = ['active', 'filled', 'expired', 'cancelled', 'discontinued'];
  
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Valid options: ${validStatuses.join(', ')}`);
  }
  
  this.status = status;
  this.statusReason = reason;
  this.updatedBy = userId;
  this.lastUpdated = new Date();
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

// Static methods
prescriptionSchema.statics.findByPatient = async function(patientId, practiceId, options = {}) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const query = { patientId, practiceId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  const context = {
    serviceId: 'prescription-model',
    operation: 'findByPatient',
    practiceId: practiceId
  };
  
  return SecureDataAccess.query('prescriptions', query, {
    sort: { prescribedDate: -1 },
    limit: options.limit || 50
  }, context);
};

prescriptionSchema.statics.findExpiring = async function(practiceId, days = 7) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  const context = {
    serviceId: 'prescription-model',
    operation: 'findExpiring',
    practiceId: practiceId
  };
  
  return SecureDataAccess.query('prescriptions', {
    practiceId,
    status: 'active',
    validUntil: { $lte: futureDate, $gte: new Date() }
  }, {
    sort: { validUntil: 1 }
  }, context);
};

module.exports = mongoose.model('Prescription', prescriptionSchema);