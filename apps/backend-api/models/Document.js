const mongoose = require('mongoose');
const crypto = require('crypto');
const secureConfigService = require('../services/secureConfigService');
const SecureDataAccess = require('../services/secureDataAccess');

const documentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  fileName: {
    type: String,
    required: true,
    index: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true,
    enum: [
      // Basic file types
      'image', 'pdf', 'document', 'spreadsheet', 'medical_imaging', 'other',
      // Medical document categories
      'lab_results',
      'prescriptions',
      'discharge_summary',
      'imaging_reports',
      'consultation_notes',
      'vaccination_records',
      'referrals',
      'medical_certificate',
      'medical_procedures'
    ],
    index: true
  },
  mimeType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  filePath: {
    type: String,
    required: false // Made optional for encrypted storage
  },
  // Encrypted content storage (HIPAA compliant)
  encryptedContent: {
    type: Buffer,
    required: false // Will be required when migrating from file storage
  },
  contentIv: {
    type: String,
    required: false // Initialization vector for encryption
  },
  contentTag: {
    type: String,
    required: false // Authentication tag for encryption
  },
  organizedFolder: {
    type: String,
    required: true,
    index: true
  },
  aiClassification: {
    documentType: {
      type: String,
      enum: [
        'lab_results',
        'prescriptions',
        'discharge_summary',
        'imaging_reports',
        'consultation_notes',
        'vaccination_records',
        'referrals',
        'medical_certificate',
        'medical_procedures',
        'medical_history',
        'medical_imaging/mri',
        'medical_imaging/ct',
        'medical_imaging/xray',
        'medical_imaging/ultrasound',
        'insurance_documents',
        'consent_forms',
        'general_images',
        'documents/pdf',
        'documents/text',
        'documents/spreadsheet',
        'miscellaneous'
      ],
      index: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    extractedText: String,
    medicalEntities: [{
      entity: String,
      type: {
        type: String,
        enum: ['condition', 'medication', 'procedure', 'symptom', 'body_part', 'test_result']
      },
      confidence: Number
    }],
    analyzedAt: Date
  },
  analysisResults: {
    extractedText: String,
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    medicalData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    analyzedAt: {
      type: Date,
      default: Date.now
    }
  },
  metadata: {
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false // Made optional for public uploads
    },
    uploadDate: {
      type: Date,
      default: Date.now,
      index: true
    },
    lastModified: {
      type: Date,
      default: Date.now
    },
    tags: [String],
    description: String,
    isPrivate: {
      type: Boolean,
      default: false
    }
  },
  searchableContent: {
    type: String,
    index: 'text' // Full-text search index
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  processingResults: {
    ocrText: String,
    medicalInsights: String,
    recommendations: [String],
    relatedDocuments: [{
      documentId: mongoose.Schema.Types.ObjectId,
      relationship: String,
      confidence: Number
    }],
    // Progress tracking fields
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    progressStatus: String,
    stage: String,
    // AI confidence from analysis
    aiConfidence: {
      type: Number,
      min: 0,
      max: 1
    },
    aiConfidencePercentage: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  // Soft delete fields for HIPAA compliance
  deletedAt: {
    type: Date,
    default: null,
    index: true
  },
  deletedBy: {
    type: String,
    default: null
  },
  deletedByRole: {
    type: String,
    default: null
  },
  deletionReason: {
    type: String,
    default: null
  },
  // Restoration fields
  restoredAt: {
    type: Date,
    default: null
  },
  restoredBy: {
    type: String,
    default: null
  },
  restorationReason: {
    type: String,
    default: null
  },
  // Practice association for multi-tenant support
  practiceId: {
    type: String,
    required: false,
    index: true
  },
  // Additional metadata for tracking
  uploadedBy: {
    type: String,
    default: 'System'
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
documentSchema.index({ patientId: 1, fileType: 1 });
documentSchema.index({ patientId: 1, organizedFolder: 1 });
documentSchema.index({ patientId: 1, uploadDate: -1 });
documentSchema.index({ 'aiClassification.documentType': 1, patientId: 1 });
documentSchema.index({ 'metadata.uploadDate': -1, patientId: 1 });

// Pre-save middleware to update searchable content
documentSchema.pre('save', function(next) {
  this.searchableContent = [
    this.originalName,
    this.organizedFolder,
    this.aiClassification?.extractedText || '',
    this.metadata?.description || '',
    this.metadata?.tags?.join(' ') || '',
    this.processingResults?.ocrText || ''
  ].join(' ').toLowerCase();
  
  this.metadata.lastModified = new Date();
  next();
});

// Virtual fields for progress tracking
documentSchema.virtual('processingProgress').get(function() {
  return this.processingResults?.progress || null;
});

documentSchema.virtual('processingProgressStatus').get(function() {
  // If AI analysis is complete and we have confidence, show confidence status
  if (this.processingStatus === 'completed' && this.processingResults?.aiConfidencePercentage) {
    return `AI Confidence: ${this.processingResults.aiConfidencePercentage}%`;
  }
  return this.processingResults?.progressStatus || null;
});

documentSchema.virtual('aiConfidenceDisplay').get(function() {
  return this.processingResults?.aiConfidencePercentage || null;
});

// Ensure virtual fields are included in JSON output
documentSchema.set('toJSON', { virtuals: true });
documentSchema.set('toObject', { virtuals: true });

// Instance methods
documentSchema.methods.updateProcessingStatus = function(status, results = {}) {
  this.processingStatus = status;
  if (Object.keys(results).length > 0) {
    this.processingResults = { ...this.processingResults, ...results };
  }
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

documentSchema.methods.addMedicalInsight = function(insight) {
  if (!this.processingResults.medicalInsights) {
    this.processingResults.medicalInsights = insight;
  } else {
    this.processingResults.medicalInsights += '\n' + insight;
  }
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

// Static methods for complex queries
documentSchema.statics.findByPatientAndType = async function(patientId, documentType) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'document-model',
    operation: 'findByPatientAndType',
    practiceId: 'global'
  };
  return SecureDataAccess.query('documents', {
    patientId,
    'aiClassification.documentType': documentType
  }, {
    sort: { 'metadata.uploadDate': -1 }
  }, context);
};

documentSchema.statics.searchDocuments = async function(patientId, searchTerm) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'document-model',
    operation: 'searchDocuments',
    practiceId: 'global'
  };
  return SecureDataAccess.query('documents', {
    patientId,
    $text: { $search: searchTerm }
  }, {
    projection: { score: { $meta: 'textScore' } },
    sort: { score: { $meta: 'textScore' } }
  }, context);
};

documentSchema.statics.getDocumentsByFolder = async function(patientId, folder) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'document-model',
    operation: 'getDocumentsByFolder',
    practiceId: 'global'
  };
  return SecureDataAccess.query('documents', {
    patientId,
    organizedFolder: new RegExp(folder, 'i')
  }, {
    sort: { 'metadata.uploadDate': -1 }
  }, context);
};

// Encryption utility class (same as PendingUpload)
class DocumentEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    this.cachedKey = null;
    
    // Try to load key from KMS at startup
    this.loadKeyFromKMS();
  }
  
  async loadKeyFromKMS() {
    try {
      const productionKMS = require('../services/productionKMS');
      const key = await productionKMS.getInternalKey('DOCUMENT_ENCRYPTION_KEY');
      if (key) {
        this.cachedKey = key;
        console.log('✅ Document encryption key loaded from KMS');
      }
    } catch (error) {
      console.warn('⚠️ Could not load key from KMS, will fallback to config:', error.message);
    }
  }

  getEncryptionKey() {
    // First try cached KMS key
    if (this.cachedKey) {
      if (this.cachedKey.length < 32) {
        return crypto.createHash('sha256').update(this.cachedKey).digest();
      }
      return Buffer.from(this.cachedKey.substring(0, 32));
    }
    
    // Fallback to config service
    const key = secureConfigService.get('DOCUMENT_ENCRYPTION_KEY');
    if (!key) {
      // Try one more time to load from KMS synchronously if possible
      try {
        const productionKMS = require('../services/productionKMS');
        // Note: This is not ideal but provides backward compatibility
        console.warn('⚠️ Document encryption key not cached, attempting sync load (not recommended)');
        throw new Error('DOCUMENT_ENCRYPTION_KEY not available - should be loaded from KMS at startup');
      } catch (e) {
        throw new Error('DOCUMENT_ENCRYPTION_KEY not available from KMS or config');
      }
    }

    if (key.length < 32) {
      return crypto.createHash('sha256').update(key).digest();
    }
    return Buffer.from(key.substring(0, 32));
  }

  encrypt(buffer) {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      const encrypted = Buffer.concat([
        cipher.update(buffer),
        cipher.final()
      ]);

      const tag = cipher.getAuthTag();

      return {
        encryptedContent: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      console.error('❌ Document encryption error:', error);
      throw new Error('Failed to encrypt document content');
    }
  }

  decrypt(encryptedContent, iv, tag) {
    try {
      const key = this.getEncryptionKey();
      const decipher = crypto.createDecipheriv(this.algorithm, key, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      const decrypted = Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final()
      ]);

      return decrypted;
    } catch (error) {
      console.error('❌ Document decryption error:', error);
      throw new Error('Failed to decrypt document content');
    }
  }
}

// Static methods for encryption operations
documentSchema.statics.encryptContent = function(buffer) {
  const encryption = new DocumentEncryption();
  return encryption.encrypt(buffer);
};

documentSchema.statics.decryptContent = function(encryptedContent, iv, tag) {
  const encryption = new DocumentEncryption();
  return encryption.decrypt(encryptedContent, iv, tag);
};

// Instance method to decrypt document content
documentSchema.methods.getDecryptedContent = function() {
  if (!this.encryptedContent || !this.contentIv || !this.contentTag) {
    throw new Error('Document content is not encrypted or missing encryption data');
  }

  const encryption = new DocumentEncryption();
  return encryption.decrypt(this.encryptedContent, this.contentIv, this.contentTag);
};

// Instance method to check if document has encrypted content
documentSchema.methods.hasEncryptedContent = function() {
  return !!(this.encryptedContent && this.contentIv && this.contentTag);
};

// Virtual field to indicate storage type
documentSchema.virtual('storageType').get(function() {
  if (this.hasEncryptedContent()) {
    return 'encrypted_database';
  } else if (this.filePath) {
    return 'file_system';
  }
  return 'unknown';
});

// Document model factory for practice-specific databases
function createDocumentModel(practiceDatabase) {
  // Check if model already exists on this connection
  if (practiceDatabase.models.Document) {
    return practiceDatabase.models.Document;
  }

  // Create Document model on practice-specific database connection
  return practiceDatabase.model('Document', documentSchema);
}

// Export factory and utilities
module.exports = {
  schema: documentSchema,
  createModel: createDocumentModel,

  // Default model for backward compatibility (uses default mongoose connection)
  model: mongoose.model('Document', documentSchema)
};