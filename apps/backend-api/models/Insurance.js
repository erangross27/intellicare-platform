const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const coverageSchema = new mongoose.Schema({
  serviceType: {
    type: String,
    required: true,
    enum: [
      'office-visit',
      'specialist-visit',
      'emergency-room',
      'urgent-care',
      'preventive-care',
      'diagnostic-tests',
      'lab-work',
      'imaging',
      'surgery',
      'prescription-drugs',
      'mental-health',
      'physical-therapy',
      'durable-medical-equipment',
      'home-health',
      'hospice',
      'other'
    ]
  },
  covered: {
    type: Boolean,
    default: true
  },
  copayAmount: {
    type: Number
  },
  coinsurancePercentage: {
    type: Number
  },
  deductibleApplies: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String
  }
});

const authorizationSchema = new mongoose.Schema({
  authorizationNumber: {
    type: String,
    required: true,
    unique: true
  },
  serviceRequested: {
    type: String,
    required: true
  },
  providerName: {
    type: String
  },
  dateRequested: {
    type: Date,
    default: Date.now
  },
  dateApproved: {
    type: Date
  },
  validFrom: {
    type: Date
  },
  validUntil: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'expired'],
    default: 'pending'
  },
  approvedUnits: {
    type: Number
  },
  usedUnits: {
    type: Number,
    default: 0
  },
  denialReason: {
    type: String
  },
  notes: {
    type: String
  }
});

const claimSchema = new mongoose.Schema({
  claimNumber: {
    type: String,
    required: true,
    unique: true
  },
  serviceDate: {
    type: Date,
    required: true
  },
  dateSubmitted: {
    type: Date,
    default: Date.now
  },
  providerName: {
    type: String,
    required: true
  },
  serviceDescription: {
    type: String,
    required: true
  },
  cptCodes: [String],
  diagnosisCodes: [String],
  chargedAmount: {
    type: Number,
    required: true
  },
  allowedAmount: {
    type: Number
  },
  paidAmount: {
    type: Number
  },
  patientResponsibility: {
    type: Number
  },
  status: {
    type: String,
    enum: ['submitted', 'processing', 'paid', 'denied', 'appealed'],
    default: 'submitted'
  },
  denialReason: {
    type: String
  },
  paymentDate: {
    type: Date
  },
  explanationOfBenefits: {
    type: String
  }
});

const insuranceSchema = new mongoose.Schema({
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

  // Insurance Company Information
  insuranceCompany: {
    type: String,
    required: true
  },
  planName: {
    type: String,
    required: true
  },
  planType: {
    type: String,
    enum: ['HMO', 'PPO', 'EPO', 'POS', 'HDHP', 'Medicare', 'Medicaid', 'Other'],
    required: true
  },
  groupNumber: {
    type: String
  },
  memberId: {
    type: String,
    required: true
  },
  subscriberName: {
    type: String
  },
  relationshipToSubscriber: {
    type: String,
    enum: ['self', 'spouse', 'child', 'other'],
    default: 'self'
  },

  // Policy Details
  policyNumber: {
    type: String
  },
  effectiveDate: {
    type: Date,
    required: true
  },
  expirationDate: {
    type: Date
  },
  isPrimary: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 1
  },

  // Benefits Information
  deductible: {
    individual: {
      type: Number,
      default: 0
    },
    family: {
      type: Number,
      default: 0
    },
    met: {
      type: Number,
      default: 0
    },
    remaining: {
      type: Number,
      default: 0
    }
  },
  outOfPocketMax: {
    individual: {
      type: Number,
      default: 0
    },
    family: {
      type: Number,
      default: 0
    },
    met: {
      type: Number,
      default: 0
    },
    remaining: {
      type: Number,
      default: 0
    }
  },
  
  // Coverage Details
  coverage: [coverageSchema],
  
  // Network Information
  networkType: {
    type: String,
    enum: ['in-network', 'out-of-network', 'both']
  },
  preferredProviders: [String],
  
  // Contact Information
  customerServicePhone: {
    type: String
  },
  customerServiceWebsite: {
    type: String
  },
  
  // Prior Authorizations
  authorizations: [authorizationSchema],
  
  // Claims History
  claims: [claimSchema],
  
  // Verification
  lastVerified: {
    type: Date
  },
  verifiedBy: {
    type: String
  },
  verificationStatus: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'terminated'],
    default: 'pending'
  },
  verificationNotes: {
    type: String
  },
  eligibilityResponse: {
    type: String // Raw response from eligibility check
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
insuranceSchema.index({ patientId: 1, practiceId: 1 });
insuranceSchema.index({ memberId: 1 });
insuranceSchema.index({ insuranceCompany: 1 });
insuranceSchema.index({ verificationStatus: 1 });
insuranceSchema.index({ effectiveDate: 1 });
insuranceSchema.index({ expirationDate: 1 });

// Virtual for checking if insurance is active
insuranceSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.verificationStatus === 'active' && 
         this.effectiveDate <= now && 
         (!this.expirationDate || this.expirationDate >= now);
});

// Virtual for checking if verification is needed
insuranceSchema.virtual('needsVerification').get(function() {
  if (!this.lastVerified) return true;
  const daysSinceVerification = Math.floor((new Date() - this.lastVerified) / (1000 * 60 * 60 * 24));
  return daysSinceVerification > 30; // Verify every 30 days
});

// Virtual for deductible progress
insuranceSchema.virtual('deductibleProgress').get(function() {
  if (!this.deductible.individual || this.deductible.individual === 0) return 100;
  return Math.round((this.deductible.met / this.deductible.individual) * 100);
});

// Virtual for out-of-pocket progress
insuranceSchema.virtual('outOfPocketProgress').get(function() {
  if (!this.outOfPocketMax.individual || this.outOfPocketMax.individual === 0) return 0;
  return Math.round((this.outOfPocketMax.met / this.outOfPocketMax.individual) * 100);
});

// Methods
insuranceSchema.methods.verify = function(status, response, userId) {
  this.verificationStatus = status;
  this.lastVerified = new Date();
  this.verifiedBy = userId;
  this.updatedBy = userId;
  this.lastUpdated = new Date();
  
  if (response) {
    this.eligibilityResponse = response;
  }
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

insuranceSchema.methods.addAuthorization = function(authData) {
  const authorization = {
    authorizationNumber: authData.authorizationNumber,
    serviceRequested: authData.serviceRequested,
    providerName: authData.providerName,
    dateRequested: authData.dateRequested || new Date(),
    validFrom: authData.validFrom,
    validUntil: authData.validUntil,
    status: authData.status || 'pending',
    approvedUnits: authData.approvedUnits,
    notes: authData.notes
  };
  
  this.authorizations.push(authorization);
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

insuranceSchema.methods.updateAuthorization = function(authNumber, updateData) {
  const auth = this.authorizations.find(a => a.authorizationNumber === authNumber);
  if (!auth) {
    throw new Error('Authorization not found');
  }
  
  Object.keys(updateData).forEach(key => {
    if (key in auth) {
      auth[key] = updateData[key];
    }
  });
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

insuranceSchema.methods.addClaim = function(claimData) {
  const claim = {
    claimNumber: claimData.claimNumber,
    serviceDate: claimData.serviceDate,
    providerName: claimData.providerName,
    serviceDescription: claimData.serviceDescription,
    cptCodes: claimData.cptCodes || [],
    diagnosisCodes: claimData.diagnosisCodes || [],
    chargedAmount: claimData.chargedAmount,
    status: claimData.status || 'submitted'
  };
  
  this.claims.push(claim);
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

insuranceSchema.methods.updateClaim = function(claimNumber, updateData) {
  const claim = this.claims.find(c => c.claimNumber === claimNumber);
  if (!claim) {
    throw new Error('Claim not found');
  }
  
  Object.keys(updateData).forEach(key => {
    if (key in claim) {
      claim[key] = updateData[key];
    }
  });
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

insuranceSchema.methods.getCopayForService = function(serviceType) {
  const coverage = this.coverage.find(c => c.serviceType === serviceType);
  return coverage ? coverage.copayAmount : null;
};

insuranceSchema.methods.isServiceCovered = function(serviceType) {
  const coverage = this.coverage.find(c => c.serviceType === serviceType);
  return coverage ? coverage.covered : false;
};

// Static methods
insuranceSchema.statics.findByPatient = async function(patientId, practiceId) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'insurance-model',
    operation: 'findByPatient',
    practiceId: practiceId
  };
  return SecureDataAccess.query('insurances', { patientId, practiceId }, {
    sort: { priority: 1, isPrimary: -1 }
  }, context);
};

insuranceSchema.statics.findActive = async function(practiceId) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const now = new Date();
  const context = {
    serviceId: 'insurance-model',
    operation: 'findActive',
    practiceId: practiceId
  };
  return SecureDataAccess.query('insurances', {
    practiceId,
    verificationStatus: 'active',
    effectiveDate: { $lte: now },
    $or: [
      { expirationDate: { $exists: false } },
      { expirationDate: { $gte: now } }
    ]
  }, {}, context);
};

insuranceSchema.statics.findNeedingVerification = async function(practiceId) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const context = {
    serviceId: 'insurance-model',
    operation: 'findNeedingVerification',
    practiceId: practiceId
  };
  return SecureDataAccess.query('insurances', {
    practiceId,
    $or: [
      { lastVerified: { $exists: false } },
      { lastVerified: { $lt: thirtyDaysAgo } }
    ]
  }, {}, context);
};

insuranceSchema.statics.findExpiring = async function(practiceId, days = 30) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  const context = {
    serviceId: 'insurance-model',
    operation: 'findExpiring',
    practiceId: practiceId
  };
  return SecureDataAccess.query('insurances', {
    practiceId,
    expirationDate: { $lte: futureDate, $gte: new Date() }
  }, {
    sort: { expirationDate: 1 }
  }, context);
};

module.exports = mongoose.model('Insurance', insuranceSchema);