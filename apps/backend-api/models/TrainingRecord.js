const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const trainingRecordSchema = new mongoose.Schema({
  employeeName: {
    type: String,
    required: true
  },
  employeeRole: {
    type: String,
    required: true
  },
  trainingType: {
    type: String,
    enum: ['HIPAA_BASICS', 'PRIVACY_SECURITY', 'INCIDENT_RESPONSE', 'PHI_HANDLING', 'OTHER'],
    required: true
  },
  trainingTitle: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['COMPLETED', 'IN_PROGRESS', 'OVERDUE', 'SCHEDULED'],
    required: true
  },
  completedAt: Date,
  startedAt: Date,
  dueDate: Date,
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  progress: {
    type: Number,
    min: 0,
    max: 100
  },
  certificateId: String,
  practiceId: String
}, {
  timestamps: true
});

module.exports = mongoose.model('TrainingRecord', trainingRecordSchema);