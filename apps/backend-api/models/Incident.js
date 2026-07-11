const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const incidentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['UNAUTHORIZED_ACCESS', 'DATA_BREACH', 'LOST_DEVICE', 'PHISHING_ATTEMPT', 'SYSTEM_VULNERABILITY', 'OTHER'],
    required: true
  },
  severity: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    required: true
  },
  status: {
    type: String,
    enum: ['INVESTIGATING', 'RESOLVED', 'CLOSED'],
    required: true
  },
  reportedBy: {
    type: String,
    required: true
  },
  affectedSystems: [{
    type: String
  }],
  investigation: {
    findings: String,
    rootCause: String,
    mitigationSteps: [String]
  },
  reportedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: Date,
  practiceId: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Incident', incidentSchema);