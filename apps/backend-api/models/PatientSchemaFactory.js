const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

// Base fields common to all countries (medical data, timestamps, etc.)
const basePatientFields = {
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  email: { type: String },
  phone: { type: String },
  street: { type: String },  // Full street address including building number
  city: { type: String },
  zipCode: { type: String },
  
  // Demographic and medical information
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    index: true
  },
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    index: true
  },
  // Reference counts for medical data stored in separate collections
  // Actual data is stored in separate collections to avoid 16MB limit
  allergyCount: {
    type: Number,
    default: 0
  },
  medicationCount: {
    type: Number,
    default: 0
  },
  
  // Emergency contact information
  emergencyContact: {
    type: String  // Name of emergency contact
  },
  emergencyContactPhone: {
    type: String  // Phone number of emergency contact
  },
  
  // Language preference
  preferredLanguage: {
    type: String,
    default: 'English',
    index: true
  },
  
  // Medical fields (same for all countries)
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Pending', 'Archived'],  // Updated to match CSV format
    default: 'Active',
    index: true
  },
  doctorSummary: {
    type: String,
    index: 'text'
  },
  // Documents are linked via documentId in Document collection
  documentCount: {
    type: Number,
    default: 0
  },
  lastDocumentUpload: {
    type: Date
  },
  
  // Appointments are stored in separate appointments collection
  appointmentCount: {
    type: Number,
    default: 0
  },
  nextAppointment: {
    date: Date,
    provider: String,
    type: String
  },
  // Track pending batch analysis jobs
  pendingBatchAnalysis: [{
    batchId: String,
    createdAt: { type: Date, default: Date.now },
    documentCount: Number,
    documents: [{
      id: String,
      fileName: String
    }]
  }],
  // Store batch analysis history
  batchAnalysisHistory: [{
    date: { type: Date, default: Date.now },
    batchId: String,
    description: String,
    documents: [String],
    analysisResults: {
      successful: Number,
      failed: Number,
      total: Number
    }
  }],
  // Medical history data stored in separate collections
  // Count fields for quick reference
  consultationCount: {
    type: Number,
    default: 0
  },
  prescriptionCount: {
    type: Number,
    default: 0
  },
  labResultCount: {
    type: Number,
    default: 0
  },
  imagingReportCount: {
    type: Number,
    default: 0
  },
  procedureCount: {
    type: Number,
    default: 0
  },
  
  // Latest medical data for quick access (denormalized for performance)
  lastConsultation: {
    date: Date,
    diagnosis: String,
    doctor: String
  },
  lastLabResult: {
    date: Date,
    type: String,
    criticalValues: Boolean
  },
  
  // Medical history has been moved to separate collections to avoid 16MB limit
  // See MedicalCollections.js for the separate collections structure

  // Medical conditions tracking (denormalized for quick access)
  medicalConditions: [{
    condition: {
      type: String,
      required: true,
      index: true
    },
    icdCode: {
      type: String
    },
    diagnosisDate: {
      type: Date,
      default: Date.now
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe', 'critical'],
      default: 'moderate'
    },
    status: {
      type: String,
      enum: ['active', 'chronic', 'resolved', 'remission'],
      default: 'active',
      index: true
    },
    followUpRequired: {
      type: Boolean,
      default: false,
      index: true
    },
    nextFollowUp: {
      type: Date,
      index: true
    },
    lastVisit: {
      type: Date
    },
    managingProvider: {
      type: String
    },
    notes: {
      type: String
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],

  date: {
    type: Date,
    default: Date.now
  }
};

// Country-specific identification and healthcare fields
const countrySpecificFields = {
  'Israel': {
    nationalId: { type: String, sparse: true, unique: true, index: true },
    country: { type: String, default: 'Israel' },
    healthFund: { 
      type: String, 
      enum: ['מכבי', 'כללית', 'מאוחדת', 'לאומית'], 
      required: true,
      index: true 
    }
  },
  'United States': {
    socialSecurityNumber: { type: String, sparse: true, unique: true, index: true },
    country: { type: String, default: 'United States' },
    state: { type: String, required: true },  // US state (CA, NY, TX, etc.)
    insuranceProvider: { type: String },
    insuranceNumber: { type: String }  // Insurance policy number
  },
  'Canada': {
    healthCardNumber: { type: String, sparse: true, unique: true, index: true },
    country: { type: String, default: 'Canada' },
    province: { type: String, required: true }
  },
  'United Kingdom': {
    nhsNumber: { type: String, sparse: true, unique: true, index: true },
    country: { type: String, default: 'United Kingdom' }
  },
  'Germany': {
    healthInsuranceNumber: { type: String, sparse: true, unique: true, index: true },
    country: { type: String, default: 'Germany' },
    insuranceProvider: { type: String }
  },
  'France': {
    socialSecurityNumber: { type: String, sparse: true, unique: true, index: true },
    country: { type: String, default: 'France' },
    vitaleCardNumber: { type: String }
  },
  'Spain': {
    healthCardNumber: { type: String, sparse: true, unique: true, index: true },
    country: { type: String, default: 'Spain' },
    autonomousCommunity: { type: String }
  },
  'Brazil': {
    cpfNumber: { type: String, sparse: true, unique: true, index: true },
    country: { type: String, default: 'Brazil' },
    susNumber: { type: String },
    state: { type: String }
  },
  'Argentina': {
    nationalIdNumber: { type: String, sparse: true, unique: true, index: true },
    country: { type: String, default: 'Argentina' },
    healthInsuranceProvider: { type: String },
    province: { type: String }
  },
  'Japan': {
    healthInsuranceNumber: { type: String, sparse: true, unique: true, index: true },
    country: { type: String, default: 'Japan' },
    prefecture: { type: String },
    insuranceType: { type: String }
  },
  'South Korea': {
    residentRegistrationNumber: { type: String, sparse: true, unique: true, index: true },
    country: { type: String, default: 'South Korea' },
    nationalHealthInsuranceNumber: { type: String }
  },
  'Australia': {
    medicareNumber: { type: String, sparse: true, unique: true, index: true },
    country: { type: String, default: 'Australia' },
    state: { type: String },
    indigenousStatus: { type: String }
  },
  'New Zealand': {
    nationalHealthIndexNumber: { type: String, sparse: true, unique: true, index: true },
    country: { type: String, default: 'New Zealand' },
    ethnicity: { type: String }
  }
};

/**
 * Create a country-specific patient schema
 * @param {string} country - The country name
 * @returns {mongoose.Schema} - The patient schema for the specified country
 */
function createPatientSchema(country) {
  const countryFields = countrySpecificFields[country];
  if (!countryFields) {
    throw new Error(`Unsupported country: ${country}. Supported countries: ${Object.keys(countrySpecificFields).join(', ')}`);
  }

  // Combine base fields with country-specific fields
  const schemaFields = { ...basePatientFields, ...countryFields };

  // Create the schema
  const PatientSchema = new mongoose.Schema(schemaFields, {
    timestamps: true
  });

  // Add indexes for better search performance
  PatientSchema.index({ firstName: 'text', lastName: 'text', doctorSummary: 'text' });
  PatientSchema.index({ createdAt: -1 });
  PatientSchema.index({ lastDocumentUpload: -1 });

  // Virtual for getting documents
  PatientSchema.virtual('documentsPopulated', {
    ref: 'Document',
    localField: '_id',
    foreignField: 'patientId'
  });

  // Instance methods
  PatientSchema.methods.addDocument = function(documentId) {
    this.documents.push(documentId);
    this.documentCount = this.documents.length;
    this.lastDocumentUpload = new Date();
    return SecureDataAccess.update('collection', { _id: this._id }, this, context);
  };

  PatientSchema.methods.removeDocument = function(documentId) {
    this.documents = this.documents.filter(id => !id.equals(documentId));
    this.documentCount = this.documents.length;
    return SecureDataAccess.update('collection', { _id: this._id }, this, context);
  };

  // Medical history management methods
  PatientSchema.methods.addMedicalHistory = function(historyEntry) {
    this.medicalHistory.push(historyEntry);
    return SecureDataAccess.update('collection', { _id: this._id }, this, context);
  };

  PatientSchema.methods.removeMedicalHistoryByDocument = function(documentId) {
    this.medicalHistory = this.medicalHistory.filter(entry =>
      !entry.documentId || !entry.documentId.equals(documentId)
    );
    return SecureDataAccess.update('collection', { _id: this._id }, this, context);
  };

  PatientSchema.methods.updateMedicalHistoryByDocument = function(documentId, updates) {
    const entry = this.medicalSecureDataAccess.query('historys', entry =>
      entry.documentId && entry.documentId.equals(documentId, {}, context)
    );
    if (entry) {
      Object.assign(entry, updates);
      return SecureDataAccess.update('collection', { _id: this._id }, this, context);
    }
    return Promise.resolve(this);
  };

  return PatientSchema;
}

/**
 * Patient model factory for practice-specific databases
 * @param {mongoose.Connection} practiceDatabase - The practice's database connection
 * @param {string} country - The practice's country
 * @returns {mongoose.Model} - The Patient model for the practice
 */
function createPatientModel(practiceDatabase, country = 'Israel') {
  // Use single 'Patient' collection for all countries
  const modelName = 'Patient';

  // Check if model already exists on this connection
  if (practiceDatabase.models[modelName]) {
    return practiceDatabase.models[modelName];
  }

  // Normalize country name for schema selection
  let schemaCountry = country;
  if (country === 'USA' || country === 'US') {
    schemaCountry = 'United States';
  } else if (country === 'UK') {
    schemaCountry = 'United Kingdom';
  }
  
  // If country not supported, default to Israel
  if (!countrySpecificFields[schemaCountry]) {
    console.log(`⚠️ Country '${country}' not supported, defaulting to Israel schema`);
    schemaCountry = 'Israel';
  }

  // Create country-specific schema
  const PatientSchema = createPatientSchema(schemaCountry);
  if (process.env.QUIET_LOGS !== 'true') console.log(`✅ Created ${schemaCountry} patient schema for practice database`);

  // Create single Patient model on practice-specific database connection
  const PatientModel = practiceDatabase.model(modelName, PatientSchema);

  return PatientModel;
}

/**
 * Generate practice-specific patient ID
 * @param {string} practiceSubdomain - The practice's subdomain
 * @returns {string} - Generated patient ID
 */
function generatePatientId(practiceSubdomain) {
  const prefix = practiceSubdomain.toUpperCase().substring(0, 3);
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Get supported countries
 * @returns {string[]} - Array of supported country names
 */
function getSupportedCountries() {
  return Object.keys(countrySpecificFields);
}

/**
 * Get country-specific field names for a given country
 * @param {string} country - The country name
 * @returns {object} - Object containing field names and their descriptions
 */
function getCountryFields(country) {
  const fields = countrySpecificFields[country];
  if (!fields) {
    throw new Error(`Unsupported country: ${country}`);
  }
  return fields;
}

// Export factory and utilities
module.exports = {
  createPatientSchema,
  createPatientModel,
  generatePatientId,
  getSupportedCountries,
  getCountryFields,

  // For backward compatibility
  schema: createPatientSchema('Israel'), // Default to Israeli schema
  model: null // Will be set by individual practice databases
};
