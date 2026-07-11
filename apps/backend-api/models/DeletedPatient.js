const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const DeletedPatientSchema = new mongoose.Schema({
  originalPatientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  patientData: {
    type: Object,
    required: true
  },
  deletedAt: {
    type: Date,
    default: Date.now
  },
  deletedBy: {
    type: String,
    default: 'system'
  },
  deleteReason: {
    type: String,
    default: 'User requested deletion'
  },
  restoredAt: {
    type: Date,
    default: null
  },
  restoredBy: {
    type: String,
    default: null
  },
  isRestored: {
    type: Boolean,
    default: false
  },
  relatedDocuments: [{
    documentId: mongoose.Schema.Types.ObjectId,
    documentPath: String,
    documentName: String
  }]
});

// Index for faster queries
DeletedPatientSchema.index({ originalPatientId: 1 });
DeletedPatientSchema.index({ deletedAt: 1 });
DeletedPatientSchema.index({ isRestored: 1 });

// Factory for practice-specific model instances
function createDeletedPatientModel(practiceDatabase) {
  if (practiceDatabase.models.DeletedPatient) {
    return practiceDatabase.models.DeletedPatient;
  }
  return practiceDatabase.model('DeletedPatient', DeletedPatientSchema);
}

// Export factory and default model for backward compatibility
module.exports = {
  schema: DeletedPatientSchema,
  createModel: createDeletedPatientModel,
  // Default model on the default mongoose connection
  model: mongoose.model('DeletedPatient', DeletedPatientSchema)
};