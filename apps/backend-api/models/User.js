const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { CLINICAL_ROLES } = require('../config/roles');
// Removed circular dependency - Models should not import services

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format']
  },
  password: {
    type: String,
    required: function() {
      // Password is only required if not a passwordless account
      return !this.isPasswordless;
    },
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default for security
  },
  isPasswordless: {
    type: Boolean,
    default: false,
    description: 'True if user uses passwordless authentication (magic links only)'
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  profile: {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true
    },
    title: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      match: [/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format']
    },
    // Emergency contact - essential for ALL practices (safety/liability)
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String
    }
  },
  // Roles are now practice-specific (no need for practice array with separate databases)
  roles: [{
    type: String,
    // Canonical roles only — see config/roles.js
    enum: ['admin', 'doctor', 'nurse', 'user']
  }],
  permissions: [{
    type: String,
    enum: [
      // Patient
      'read_patients', 'write_patients', 'delete_patients', 'export_patients',
      // Documents
      'read_documents', 'write_documents', 'delete_documents', 'export_documents',
      // Users and Admin
      'manage_users', 'assign_roles', 'view_reports', 'system_admin',
      // Practice Config
      'manage_practice_settings', 'manage_billing', 'view_audit_logs',
      // Orders/Lab Tests
      'orders_create', 'orders_manage_results'
    ]
  }],
  // Patient group access (for department-based permissions)
  patientGroupAccess: {
    accessLevel: {
      type: String,
      enum: ['all', 'department', 'assigned', 'none'],
      default: 'all'
    },
    departments: [String], // Which departments can they access patients from
    assignedPatients: [{ // Specific patients assigned to this user
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient'
    }]
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'suspended'],
    default: 'active'
  },
  preferredLanguage: {
    type: String,
    default: 'en',
    enum: ['en', 'he']
  },
  // TTS voice preferences (persisted across browser sessions)
  ttsPreferences: {
    enabled: { type: Boolean, default: true },
    voiceId: { type: String, default: '' },
    modelId: { type: String, default: '' }
  },
  // Timezone for scheduling and display
  timezone: {
    type: String,
    default: 'UTC'
  },
  // Notification preferences - essential for communication
  notificationPreferences: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
    appointmentReminders: { type: Boolean, default: true },
    systemAlerts: { type: Boolean, default: true },
    marketingMessages: { type: Boolean, default: false }
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  // Security settings for MFA and authentication
  security: {
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: String,
    backupCodes: [String],
    mfaEnabledAt: Date,
    mfaLastUsed: Date,
    mfaDisabledAt: Date,
    backupCodesRegeneratedAt: Date
  },
  // Temporary MFA fields during setup
  tempMfaSecret: String,
  tempBackupCodes: [String],
  
  // Provider-specific fields (for doctors, nurses, specialists)
  providerInfo: {
    // Unique provider ID for this doctor/nurse
    providerId: {
      type: String,
      sparse: true, // Allow null but ensure uniqueness when set
      index: true
    },
    // Medical license information
    licenseNumber: String,
    licenseState: String,
    licenseExpiry: Date,
    // Professional credentials and certifications
    credentials: [{
      type: {
        type: String,
        enum: ['license', 'certification', 'degree', 'training', 'other']
      },
      name: String, // e.g., "MD", "RN", "CPR Certified"
      issuingBody: String, // e.g., "State Medical Board"
      issueDate: Date,
      expiryDate: Date,
      credentialNumber: String,
      verified: { type: Boolean, default: false }
    }],
    // Digital signature for prescriptions/documents
    digitalSignature: {
      imageUrl: String, // URL to signature image
      stampUrl: String, // URL to professional stamp/seal
      signatureData: String, // Base64 encoded signature
      lastUpdated: Date
    },
    // Specializations - Comprehensive list of 40+ medical specialties
    specialties: [{
      type: String,
      enum: [
        // Primary Care
        'family_medicine',
        'internal_medicine',
        'pediatrics',
        'geriatric_medicine',

        // Medical Specialties
        'allergy_immunology',
        'cardiology',
        'dermatology',
        'endocrinology',
        'gastroenterology',
        'hematology',
        'hematology_oncology',
        'infectious_disease',
        'nephrology',
        'neurology',
        'oncology',
        'pulmonology',
        'rheumatology',

        // Surgical Specialties
        'general_surgery',
        'cardiothoracic_surgery',
        'colon_rectal_surgery',
        'neurological_surgery',
        'obstetrics_gynecology',
        'ophthalmology',
        'orthopedic_surgery',
        'otolaryngology', // ENT
        'plastic_surgery',
        'transplant_surgery',
        'trauma_surgery',
        'urology',
        'vascular_surgery',

        // Diagnostic & Support
        'anesthesiology',
        'pathology',
        'radiology',
        'radiation_oncology',
        'interventional_radiology',
        'nuclear_medicine',

        // Emergency & Critical Care
        'emergency_medicine',
        'critical_care_medicine',

        // Mental Health
        'psychiatry',
        'child_adolescent_psychiatry',
        'perinatal_mental_health',

        // Specialized Medicine
        'sports_medicine',
        'pain_management',
        'palliative_medicine',
        'preventive_medicine',
        'occupational_medicine',
        'aerospace_medicine',
        'medical_genetics',
        'physical_medicine_rehabilitation',

        // Subspecialties
        'maternal_fetal_medicine',
        'neonatology',
        'reproductive_endocrinology',
        'cardiac_rehabilitation',
        'hospice_care',

        'other'
      ]
    }],
    // Departments they work in
    departments: [String],
    // Default appointment settings
    appointmentSettings: {
      defaultDuration: { type: Number, default: 30 }, // minutes
      bufferTime: { type: Number, default: 0 }, // minutes between appointments
      maxDailyAppointments: { type: Number, default: 30 },
      allowDoubleBooking: { type: Boolean, default: false },
      allowVideoConsults: { type: Boolean, default: false },
      consultationTypes: [{
        type: String,
        enum: [
          'consultation', 'follow-up', 'routine-checkup', 'urgent-care',
          'procedure', 'lab-work', 'imaging', 'vaccination', 'physical-exam',
          'telehealth', 'surgery', 'therapy', 'other'
        ]
      }]
    },
    // Link to availability schedule
    availabilityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProviderAvailability'
    },
    // Statistics and tracking
    stats: {
      totalAppointments: { type: Number, default: 0 },
      completedAppointments: { type: Number, default: 0 },
      cancelledAppointments: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      totalRatings: { type: Number, default: 0 }
    },
    // Billing information
    billing: {
      baseRate: Number, // Base consultation rate
      specialRates: [{
        appointmentType: String,
        rate: Number
      }]
    }
  },
  
  // Appointment tracking for all users (including patients who book)
  appointments: {
    // For providers: appointments where they are the provider
    asProvider: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    }],
    // For all users: appointments they've created/booked
    created: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    }],
    // Last appointment interaction
    lastAppointmentDate: Date,
    // Favorite providers (for quick booking)
    favoriteProviders: [{
      providerId: String,
      providerName: String,
      addedAt: { type: Date, default: Date.now }
    }]
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
UserSchema.index({ status: 1 });
UserSchema.index({ roles: 1 });
UserSchema.index({ createdAt: -1 });

// Password hashing middleware
UserSchema.pre('save', async function() {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return;

  // Hash password with cost of 12 (an async pre-hook rejects the save if this throws)
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Password comparison method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    console.warn('⚠️ User has no password field:', this.email);
    return false;
  }

  return bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  if (!this.profile) return 'Unknown User';
  const firstName = this.profile.firstName || 'Unknown';
  const lastName = this.profile.lastName || 'User';
  return `${firstName} ${lastName}`;
});

// Virtual for display name with title
UserSchema.virtual('displayName').get(function() {
  if (!this.profile) return 'Unknown User';
  const title = this.profile.title ? `${this.profile.title} ` : '';
  const firstName = this.profile.firstName || 'Unknown';
  const lastName = this.profile.lastName || 'User';
  return `${title}${firstName} ${lastName}`;
});

// Pre-save middleware
UserSchema.pre('save', function() {
  this.updatedAt = new Date();
});

// Instance methods
UserSchema.methods.hasRole = function(role) {
  return this.roles.includes(role);
};

UserSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission);
};

UserSchema.methods.isActive = function() {
  return this.status === 'active';
};

// Provider-specific methods
UserSchema.methods.isProvider = function() {
  return this.roles.some(role => CLINICAL_ROLES.includes(role));
};

UserSchema.methods.canTakeAppointments = function() {
  return this.isProvider() && this.isActive() && this.providerInfo?.providerId;
};

UserSchema.methods.getProviderId = function() {
  // Use custom provider ID if set, otherwise use user ID
  return this.providerInfo?.providerId || this._id.toString();
};

UserSchema.methods.getProviderName = function() {
  if (this.profile?.title) {
    return `${this.profile.title} ${this.fullName}`;
  }
  return this.fullName;
};

// Update appointment statistics
UserSchema.methods.updateAppointmentStats = async function(type) {
  if (!this.providerInfo) return;
  
  switch(type) {
    case 'completed':
      this.providerInfo.stats.totalAppointments++;
      this.providerInfo.stats.completedAppointments++;
      break;
    case 'cancelled':
      this.providerInfo.stats.cancelledAppointments++;
      break;
    case 'scheduled':
      this.providerInfo.stats.totalAppointments++;
      break;
  }
  
  this.appointments.lastAppointmentDate = new Date();
  return SecureDataAccess.update('collection', { _id: this._id }, this, context);
};

// User model factory for practice-specific databases
function createUserModel(practiceDatabase) {
  // Check if model already exists on this connection
  if (practiceDatabase.models.User) {
    return practiceDatabase.models.User;
  }

  // Create User model on practice-specific database connection
  return practiceDatabase.model('User', UserSchema);
}

// Export factory and utilities
module.exports = {
  schema: UserSchema,
  createModel: createUserModel,

  // Default model for backward compatibility (uses default mongoose connection)
  model: mongoose.model('User', UserSchema)
};
