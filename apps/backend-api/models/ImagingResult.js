const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const imageFileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  size: {
    type: Number
  },
  mimetype: {
    type: String
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  uploadedBy: {
    type: String
  }
});

const imagingResultSchema = new mongoose.Schema({
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

  // Study Identification
  studyNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  studyInstanceUID: {
    type: String // DICOM Study Instance UID
  },
  accessionNumber: {
    type: String,
    index: true
  },

  // Study Details
  studyType: {
    type: String,
    required: true,
    enum: [
      'x-ray',
      'ct-scan',
      'mri',
      'ultrasound',
      'mammography',
      'nuclear-medicine',
      'pet-scan',
      'fluoroscopy',
      'angiography',
      'bone-densitometry',
      'other'
    ]
  },
  bodyPart: {
    type: String,
    enum: [
      'head',
      'neck',
      'chest',
      'abdomen',
      'pelvis',
      'spine',
      'extremities',
      'cardiac',
      'vascular',
      'whole-body',
      'other'
    ]
  },
  studyDescription: {
    type: String
  },

  // Timing
  studyDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  studyTime: {
    type: String
  },
  reportDate: {
    type: Date
  },
  finalizedDate: {
    type: Date
  },

  // Clinical Information
  clinicalIndication: {
    type: String
  },
  clinicalHistory: {
    type: String
  },
  contrast: {
    type: String,
    enum: ['none', 'oral', 'iv', 'both'],
    default: 'none'
  },
  contrastAgent: {
    type: String
  },

  // Technical Parameters
  technique: {
    type: String
  },
  kvp: {
    type: Number
  },
  mas: {
    type: Number
  },
  sliceThickness: {
    type: Number
  },

  // Results
  findings: {
    type: String
  },
  impression: {
    type: String
  },
  recommendations: {
    type: String
  },
  comparison: {
    type: String
  },

  // Critical Results
  criticalResult: {
    type: Boolean,
    default: false
  },
  criticalNotificationSent: {
    type: Boolean,
    default: false
  },
  criticalNotificationDate: {
    type: Date
  },

  // Staff Information
  technician: {
    type: String
  },
  radiologist: {
    type: String
  },
  reportedBy: {
    type: String
  },
  reportedById: {
    type: String
  },
  
  // Quality Assurance
  qualityReviewed: {
    type: Boolean,
    default: false
  },
  qualityReviewer: {
    type: String
  },
  qualityScore: {
    type: Number,
    min: 1,
    max: 5
  },

  // Status and Priority
  status: {
    type: String,
    enum: ['pending', 'preliminary', 'final', 'amended', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['routine', 'urgent', 'stat'],
    default: 'routine'
  },

  // Images and Files
  images: [imageFileSchema],
  dicomFiles: [{
    filename: String,
    path: String,
    seriesDescription: String,
    numberOfImages: Number
  }],

  // Practice Information
  practiceId: {
    type: String,
    required: true,
    index: true
  },
  practiceName: {
    type: String
  },
  department: {
    type: String,
    default: 'radiology'
  },

  // Equipment Information
  equipment: {
    manufacturer: String,
    model: String,
    softwareVersion: String,
    stationName: String
  },

  // Billing and Insurance
  cptCode: {
    type: String
  },
  insuranceAuthorization: {
    type: String
  },

  // Communication
  reportSent: {
    type: Boolean,
    default: false
  },
  reportSentDate: {
    type: Date
  },
  recipientList: [String],

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

  // AI Analysis Tracking
  analysisSource: {
    type: String,
    enum: ['manual', 'gemini', 'claude'],
    default: 'manual'
  },
  aiModelVersion: {
    type: String
  },

  // Additional Fields
  notes: {
    type: String
  },
  tags: [String],
  
  // Follow-up
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date
  },
  followUpInstructions: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for better performance
imagingResultSchema.index({ patientId: 1, practiceId: 1 });
imagingResultSchema.index({ studyDate: -1 });
imagingResultSchema.index({ status: 1 });
imagingResultSchema.index({ priority: 1 });
imagingResultSchema.index({ studyType: 1 });
imagingResultSchema.index({ bodyPart: 1 });
imagingResultSchema.index({ criticalResult: 1 });

// Virtual for days since study
imagingResultSchema.virtual('daysSinceStudy').get(function() {
  return Math.floor((new Date() - this.studyDate) / (1000 * 60 * 60 * 24));
});

// Virtual for image count
imagingResultSchema.virtual('imageCount').get(function() {
  return this.images ? this.images.length : 0;
});

// Virtual for status indicators
imagingResultSchema.virtual('isFinal').get(function() {
  return this.status === 'final';
});

imagingResultSchema.virtual('isPending').get(function() {
  return this.status === 'pending' || this.status === 'preliminary';
});

imagingResultSchema.virtual('hasCriticalFindings').get(function() {
  return this.criticalResult || 
         (this.findings && this.findings.toLowerCase().includes('urgent')) ||
         (this.impression && this.impression.toLowerCase().includes('critical'));
});

// Methods
imagingResultSchema.methods.updateStatus = function(status, userId) {
  const validStatuses = ['pending', 'preliminary', 'final', 'amended', 'cancelled'];
  
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Valid options: ${validStatuses.join(', ')}`);
  }
  
  this.status = status;
  this.updatedBy = userId;
  this.lastUpdated = new Date();
  
  if (status === 'final') {
    this.finalizedDate = new Date();
  }
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

imagingResultSchema.methods.addImage = function(imageData) {
  this.images.push({
    filename: imageData.filename,
    originalName: imageData.originalName,
    path: imageData.path,
    size: imageData.size,
    mimetype: imageData.mimetype,
    uploadDate: new Date(),
    uploadedBy: imageData.uploadedBy
  });
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

imagingResultSchema.methods.markCritical = function(userId) {
  this.criticalResult = true;
  this.criticalNotificationDate = new Date();
  this.updatedBy = userId;
  this.lastUpdated = new Date();
  
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

// Static methods
imagingResultSchema.statics.findByPatient = async function(patientId, practiceId, options = {}) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const query = { patientId, practiceId };
  
  if (options.studyType) {
    query.studyType = options.studyType;
  }
  
  if (options.dateFrom || options.dateTo) {
    query.studyDate = {};
    if (options.dateFrom) query.studyDate.$gte = new Date(options.dateFrom);
    if (options.dateTo) query.studyDate.$lte = new Date(options.dateTo);
  }
  
  const context = {
    serviceId: 'imaging-result-model',
    operation: 'findByPatient',
    practiceId: practiceId
  };
  
  return SecureDataAccess.query('imagingresults', query, {
    sort: { studyDate: -1 },
    limit: options.limit || 50
  }, context);
};

imagingResultSchema.statics.findPending = async function(practiceId, options = {}) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const query = { 
    practiceId,
    status: { $in: ['pending', 'preliminary'] }
  };
  
  if (options.priority) {
    query.priority = options.priority;
  }
  
  if (options.studyType) {
    query.studyType = options.studyType;
  }
  
  const context = {
    serviceId: 'imaging-result-model',
    operation: 'findPending',
    practiceId: practiceId
  };
  
  return SecureDataAccess.query('imagingresults', query, {
    sort: { priority: -1, studyDate: 1 },
    limit: options.limit || 100
  }, context);
};

imagingResultSchema.statics.findCritical = async function(practiceId) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'imaging-result-model',
    operation: 'findCritical',
    practiceId: practiceId
  };
  
  return SecureDataAccess.query('imagingresults', {
    practiceId,
    criticalResult: true,
    criticalNotificationSent: { $ne: true }
  }, {
    sort: { studyDate: -1 }
  }, context);
};

module.exports = mongoose.model('ImagingResult', imagingResultSchema);