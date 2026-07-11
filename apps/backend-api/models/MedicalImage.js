const mongoose = require('mongoose');

const medicalImageSchema = new mongoose.Schema({
  // Patient link
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },

  // Encrypted image storage (AES-256-GCM via e2eEncryptionService)
  encryptedContent: {
    type: Buffer,
    required: true
  },
  contentIv: {
    type: String,
    required: true
  },
  contentTag: {
    type: String,
    required: true
  },

  // File metadata
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },

  // Imaging details
  modality: {
    type: String,
    enum: ['xray', 'ct', 'mri', 'ultrasound', 'mammogram', 'pet', 'general'],
    default: 'general'
  },
  bodyPart: {
    type: String
  },
  studyDate: {
    type: Date,
    default: Date.now
  },

  // DICOM metadata (if from DICOM file)
  dicomMetadata: {
    studyInstanceUID: String,
    seriesInstanceUID: String,
    sopInstanceUID: String,
    accessionNumber: String,
    studyDescription: String,
    seriesDescription: String,
    bodyPartExamined: String,
    institution: String,
    manufacturer: String,
    patientName: String,
    patientSex: String
  },

  // AI analysis reference
  analysisResultId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImagingResult'
  },
  analysisSource: {
    type: String,
    enum: ['manual', 'gemini', 'claude'],
    default: 'claude'
  },
  aiModelVersion: {
    type: String
  },

  // Analysis summary (stored alongside for quick access without joining)
  analysisSummary: {
    impression: String,
    urgency: {
      type: String,
      enum: ['routine', 'urgent', 'critical'],
      default: 'routine'
    },
    findings: String
  },

  // Practice multi-tenant
  practiceId: {
    type: String,
    required: true,
    index: true
  },

  // Upload tracking
  uploadedBy: {
    type: String
  },
  uploadSource: {
    type: String,
    enum: ['agent_chat', 'api_endpoint', 'document_upload'],
    default: 'agent_chat'
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'analyzing', 'completed', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Compound indexes
medicalImageSchema.index({ patientId: 1, practiceId: 1 });
medicalImageSchema.index({ patientId: 1, modality: 1 });
medicalImageSchema.index({ practiceId: 1, createdAt: -1 });
medicalImageSchema.index({ status: 1 });

module.exports = mongoose.model('MedicalImage', medicalImageSchema);
