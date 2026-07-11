const mongoose = require('mongoose');

const patientVisitSchema = new mongoose.Schema({
  // Identity
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  practiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Practice',
    required: true,
    index: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  chatSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession'
  },

  // Visit metadata
  visitDate: { type: Date, default: Date.now },
  visitType: {
    type: String,
    enum: ['in-person', 'telehealth', 'phone'],
    default: 'in-person'
  },
  duration: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['recording', 'transcribing', 'reviewing', 'approved', 'amended'],
    default: 'recording'
  },

  // Encrypted audio recording (AES-256-GCM, same pattern as MedicalImage)
  audioRecording: {
    encryptedContent: { type: Buffer },
    contentIv: { type: String },
    contentTag: { type: String },
    format: { type: String, default: 'webm/opus' },
    sampleRate: { type: Number, default: 16000 },
    fileSize: { type: Number },
    duration: { type: Number },
  },

  // Full verbatim transcript
  transcript: {
    fullText: { type: String, default: '' },
    language: { type: String, default: 'en' },
    segments: [{
      text: { type: String },
      start: { type: Number },
      end: { type: Number },
      confidence: { type: Number },
      speaker: { type: String, enum: ['doctor', 'patient', 'unknown'], default: 'unknown' }
    }],
  },

  // AI-generated structured SOAP note
  aiSummary: {
    chiefComplaint: { type: String },
    historyOfPresentIllness: { type: String },
    reviewOfSystems: { type: String },
    physicalExamination: { type: String },
    assessment: { type: String },
    plan: { type: String },
    medications: { type: String },
    followUp: { type: String },
    modelUsed: { type: String, default: 'claude-sonnet-5' },
    generatedAt: { type: Date },
  },

  // Doctor review tracking
  doctorEdits: {
    editedFields: [{ type: String }],
    editedAt: { type: Date },
  },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // HIPAA consent
  consentObtained: { type: Boolean, default: false },
  consentMethod: {
    type: String,
    enum: ['verbal', 'written', 'pre-visit-form'],
  },

  // Audit fields
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, {
  timestamps: true,
  collection: 'patient_visits',
});

// Compound indexes
patientVisitSchema.index({ patientId: 1, practiceId: 1 });
patientVisitSchema.index({ patientId: 1, visitDate: -1 });
patientVisitSchema.index({ practiceId: 1, createdAt: -1 });
patientVisitSchema.index({ status: 1 });
patientVisitSchema.index({ doctorId: 1, visitDate: -1 });

module.exports = mongoose.model('PatientVisit', patientVisitSchema);
