const mongoose = require('mongoose');

const pendingUploadSchema = new mongoose.Schema({
  uploadId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  practiceSubdomain: {
    type: String,
    required: true,
    index: true
  },
  files: [{
    originalName: {
      type: String,
      required: true
    },
    encryptedContent: {
      type: Buffer,
      required: false  // Made optional to support E2E format
    },
    encryptedPackage: {
      type: mongoose.Schema.Types.Mixed,  // E2E encrypted package
      required: false  // Optional - for E2E encrypted files
    },
    contentIv: {
      type: String,
      required: false  // Made optional to support E2E format
    },
    contentTag: {
      type: String,
      required: false  // Made optional to support E2E format
    },
    encryptionVersion: {
      type: String,
      enum: ['legacy', 'e2e-v1'],
      default: 'legacy'  // Default to legacy for backward compatibility
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    fileType: {
      type: String,
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
      required: true
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 3600000), // 1 hour from now
    expires: 0 // MongoDB TTL index - auto-delete when expiresAt is reached
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'expired'],
    default: 'pending',
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
pendingUploadSchema.index({ practiceSubdomain: 1, userId: 1, status: 1 });
pendingUploadSchema.index({ practiceSubdomain: 1, uploadId: 1 });
pendingUploadSchema.index({ practiceSubdomain: 1, createdAt: -1, status: 1 });

// NOTE: Encryption/decryption is now handled by E2E encryption service
// These methods are deprecated but kept for backward compatibility
// All new code should use e2eEncryptionService.encryptDocument() and decryptDocument()

// Static method stub for backward compatibility
pendingUploadSchema.statics.encryptDocument = function(buffer) {
  console.warn('⚠️ PendingUpload.encryptDocument is deprecated. Use e2eEncryptionService.encryptDocument() instead');
  throw new Error('Please use e2eEncryptionService.encryptDocument() for encryption');
};

// Static method stub for backward compatibility
pendingUploadSchema.statics.decryptDocument = function(encryptedContent, iv, tag) {
  console.warn('⚠️ PendingUpload.decryptDocument is deprecated. Use e2eEncryptionService.decryptDocument() instead');
  throw new Error('Please use e2eEncryptionService.decryptDocument() for decryption');
};

// Instance method stub for backward compatibility
pendingUploadSchema.methods.decryptFile = function(fileIndex) {
  console.warn('⚠️ pendingUpload.decryptFile is deprecated. Use e2eEncryptionService.decryptDocument() instead');
  throw new Error('Please use e2eEncryptionService.decryptDocument() for decryption');
};

// Instance method to get file info without content
pendingUploadSchema.methods.getFileInfo = function() {
  return this.files.map(file => ({
    originalName: file.originalName,
    mimetype: file.mimetype,
    size: file.size,
    fileType: file.fileType
  }));
};

// Clean up expired uploads (called by cron job)
pendingUploadSchema.statics.cleanupExpired = async function() {
  try {
    const SecureDataAccess = require('../services/secureDataAccess');

    // Use SecureDataAccess to avoid MongoDB buffering timeouts
    // Use 'batch-results-worker' service (already registered)
    const context = {
      serviceId: 'batch-results-worker',
      operation: 'cleanupExpired',
      practiceId: 'global'
    };

    const result = await SecureDataAccess.delete(
      'pendinguploads',
      {
        $or: [
          { expiresAt: { $lt: new Date() } },
          { status: 'expired' }
        ]
      },
      context,
      { hardDelete: true } // Hard delete expired uploads
    );

    console.log(`🧹 Cleaned up ${result.deletedCount} expired pending uploads`);
    return result.deletedCount;
  } catch (error) {
    console.error('❌ Error cleaning up expired uploads:', error);
    throw error;
  }
};

// Pre-save middleware to update status
pendingUploadSchema.pre('save', function(next) {
  // Check if upload has expired
  if (this.expiresAt && this.expiresAt < new Date() && this.status === 'pending') {
    this.status = 'expired';
  }
  next();
});

// Virtual field for time remaining
pendingUploadSchema.virtual('timeRemaining').get(function() {
  if (!this.expiresAt) return null;
  
  const now = new Date();
  const remaining = this.expiresAt.getTime() - now.getTime();
  
  if (remaining <= 0) return 0;
  
  return Math.floor(remaining / 1000); // Return seconds remaining
});

// Ensure virtual fields are included in JSON output
pendingUploadSchema.set('toJSON', { virtuals: true });
pendingUploadSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PendingUpload', pendingUploadSchema);
