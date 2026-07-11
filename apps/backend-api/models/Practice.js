const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const practiceSchema = new mongoose.Schema({
  // Basic practice information
  name: {
    type: String,
    required: [true, 'Practice name is required'],
    trim: true,
    minlength: [2, 'Practice name must be at least 2 characters'],
    maxlength: [100, 'Practice name cannot exceed 100 characters']
  },
  
  subdomain: {
    type: String,
    required: [true, 'Subdomain is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens'],
    minlength: [3, 'Subdomain must be at least 3 characters'],
    maxlength: [50, 'Subdomain cannot exceed 50 characters']
  },
  
  status: {
    type: String,
    enum: {
      values: ['active', 'suspended', 'trial', 'inactive'],
      message: 'Status must be active, suspended, trial, or inactive'
    },
    default: 'trial'
  },
  
  // Subscription and billing
  subscription: {
    plan: {
      type: String,
      enum: ['basic', 'professional', 'enterprise'],
      default: 'basic'
    },
    maxUsers: {
      type: Number,
      default: 5,
      min: [1, 'Must allow at least 1 user']
    },
    maxPatients: {
      type: Number,
      default: 100,
      min: [1, 'Must allow at least 1 patient']
    },
    features: [{
      type: String,
      enum: ['ai_analysis', 'document_upload', 'multi_user', 'api_access', 'advanced_reporting']
    }],
    billingCycle: {
      type: String,
      enum: ['monthly', 'annual'],
      default: 'monthly'
    },
    nextBillingDate: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  
  // Practice settings
  settings: {
    timezone: {
      type: String,
      default: 'UTC',
      // IANA timezone identifiers (e.g., 'Asia/Jerusalem', 'America/New_York', 'Europe/London')
      // Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
      validate: {
        validator: function(tz) {
          // Accept UTC or valid IANA timezone format (Continent/City)
          return tz === 'UTC' || /^[A-Z][a-z]+\/[A-Z][a-z_]+$/.test(tz);
        },
        message: 'Timezone must be UTC or a valid IANA timezone (e.g., Asia/Jerusalem, America/New_York)'
      }
    },
    language: {
      type: String,
      enum: ['en', 'he'],
      default: 'en'
    },
    dateFormat: {
      type: String,
      enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
      default: 'MM/DD/YYYY'
    },
    currency: {
      type: String,
      enum: ['USD', 'ILS', 'EUR'],
      default: 'USD'
    },
    workingHours: {
      start: {
        type: String,
        default: '08:00',
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
      },
      end: {
        type: String,
        default: '18:00',
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
      },
      days: [{
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      }]
    },
    security: {
      sessionTimeout: {
        type: Number,
        default: 480, // 8 hours in minutes
        min: [30, 'Session timeout must be at least 30 minutes'],
        max: [1440, 'Session timeout cannot exceed 24 hours']
      },
      passwordPolicy: {
        minLength: {
          type: Number,
          default: 8,
          min: [6, 'Minimum password length must be at least 6']
        },
        requireUppercase: {
          type: Boolean,
          default: true
        },
        requireLowercase: {
          type: Boolean,
          default: true
        },
        requireNumbers: {
          type: Boolean,
          default: true
        },
        requireSpecialChars: {
          type: Boolean,
          default: true
        }
      },
      mfaRequired: {
        type: Boolean,
        default: false
      },
      ipWhitelist: [{
        type: String,
        validate: {
          validator: function(ip) {
            // Basic IP validation (IPv4)
            return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
          },
          message: 'Invalid IP address format'
        }
      }]
    }
  },
  
  // Contact information
  contact: {
    address: {
      street: String,
      city: String,
      state: String,
      country: {
        type: String
        // No default - must be explicitly set from Google Places or user input
      },
      postalCode: String
    },
    phone: {
      type: String,
      match: [/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format']
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format']
    },
    website: {
      type: String,
      match: [/^https?:\/\/.+/, 'Website must be a valid URL']
    }
  },
  
  // Billing information
  billing: {
    companyName: String,
    taxId: String,
    billingAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'bank_transfer', 'paypal'],
      default: 'credit_card'
    }
  },
  
  // Audit fields
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
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
practiceSchema.index({ status: 1 });
practiceSchema.index({ 'subscription.plan': 1 });
practiceSchema.index({ createdAt: -1 });
practiceSchema.index({ isDeleted: 1, status: 1 });

// Virtual for active user count (to be populated when needed)
practiceSchema.virtual('activeUserCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'practices.practiceId',
  count: true,
  match: { 'practices.status': 'active' }
});

// Virtual for patient count (to be populated when needed)
practiceSchema.virtual('patientCount', {
  ref: 'Patient',
  localField: '_id',
  foreignField: 'practiceId',
  count: true,
  match: { isDeleted: false }
});

// Timezone mapping from country to IANA timezone
const countryToTimezone = {
  'Israel': 'Asia/Jerusalem',
  'USA': 'America/New_York',
  'United States': 'America/New_York',
  'UK': 'Europe/London',
  'United Kingdom': 'Europe/London',
  'Canada': 'America/Toronto',
  'Australia': 'Australia/Sydney',
  'Germany': 'Europe/Berlin',
  'France': 'Europe/Paris',
  'Spain': 'Europe/Madrid',
  'Italy': 'Europe/Rome',
  'Japan': 'Asia/Tokyo',
  'China': 'Asia/Shanghai',
  'India': 'Asia/Kolkata',
  'Brazil': 'America/Sao_Paulo',
  'Mexico': 'America/Mexico_City',
  'Argentina': 'America/Argentina/Buenos_Aires',
  'South Africa': 'Africa/Johannesburg'
};

// Pre-save middleware
practiceSchema.pre('save', function(next) {
  // Update the updatedAt field
  this.updatedAt = new Date();

  // Validate subdomain format
  if (this.isModified('subdomain')) {
    if (!/^[a-z0-9-]+$/.test(this.subdomain)) {
      return next(new Error('Subdomain can only contain lowercase letters, numbers, and hyphens'));
    }
  }

  // Automatically set timezone from country on creation
  if (this.isNew || this.isModified('contact.address.country')) {
    const country = this.contact?.address?.country;
    if (country && countryToTimezone[country]) {
      this.settings.timezone = countryToTimezone[country];
    } else if (country) {
      // Default to UTC if country not in mapping
      console.log(`⚠️  Unknown country timezone: ${country}, defaulting to UTC`);
      this.settings.timezone = 'UTC';
    }
  }

  // Set default working days if not provided
  if (this.isNew && (!this.settings.workingHours.days || this.settings.workingHours.days.length === 0)) {
    this.settings.workingHours.days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  }

  next();
});

// Instance methods
practiceSchema.methods.isActive = function() {
  return this.status === 'active' && this.subscription.isActive;
};

practiceSchema.methods.canAddUser = function(currentUserCount) {
  return currentUserCount < this.subscription.maxUsers;
};

practiceSchema.methods.canAddPatient = function(currentPatientCount) {
  return currentPatientCount < this.subscription.maxPatients;
};

practiceSchema.methods.hasFeature = function(feature) {
  return this.subscription.features.includes(feature);
};

// Static methods
practiceSchema.statics.findBySubdomain = async function(subdomain) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'practice-model',
    operation: 'findBySubdomain',
    practiceId: 'global' // Practices are in global database
  };
  
  const results = await SecureDataAccess.query('practices', {
    subdomain: subdomain.toLowerCase(),
    isDeleted: false
  }, { limit: 1 }, context);
  
  return results && results.length > 0 ? results[0] : null;
};

practiceSchema.statics.findActive = async function() {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'practice-model',
    operation: 'findActive',
    practiceId: 'global' // Practices are in global database
  };
  
  return SecureDataAccess.query('practices', {
    status: 'active',
    isDeleted: false
  }, {}, context);
};

// Export schema for use with database factory
module.exports = {
  schema: practiceSchema,

  // Factory function to create Practice model with specific connection
  createModel: (connection) => {
    return connection.model('Practice', practiceSchema);
  },

  // Default model for backward compatibility (uses default mongoose connection)
  model: mongoose.model('Practice', practiceSchema)
};
