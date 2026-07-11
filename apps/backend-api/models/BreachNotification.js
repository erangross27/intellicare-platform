const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const breachNotificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  discoveredDate: {
    type: Date,
    required: true
  },
  breachDate: {
    type: Date,
    required: true
  },
  affectedCount: {
    type: Number,
    required: true
  },
  dataTypesAffected: [{
    type: String
  }],
  breachType: {
    type: String,
    enum: ['HACKING', 'LOSS', 'THEFT', 'UNAUTHORIZED_ACCESS', 'DISPOSAL_ERROR', 'OTHER'],
    required: true
  },
  riskAssessment: {
    level: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW']
    },
    likelihood: {
      type: String,
      enum: ['PROBABLE', 'POSSIBLE', 'UNLIKELY']
    },
    impact: {
      type: String,
      enum: ['SIGNIFICANT', 'MODERATE', 'MINOR']
    },
    factors: [String]
  },
  notifications: {
    patientsNotified: {
      type: Boolean,
      default: false
    },
    patientsNotifiedDate: Date,
    authoritiesNotified: {
      type: Boolean,
      default: false
    },
    authoritiesNotifiedDate: Date,
    mediaNotified: {
      type: Boolean,
      default: false
    },
    mediaNotifiedDate: Date
  },
  investigation: {
    status: {
      type: String,
      enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'RESOLVED']
    },
    leadInvestigator: String,
    findings: String,
    rootCause: String,
    timeline: String
  },
  mitigation: {
    immediateActions: [String],
    longTermActions: [String],
    preventiveMeasures: [String]
  },
  practiceId: String
}, {
  timestamps: true
});

module.exports = mongoose.model('BreachNotification', breachNotificationSchema);