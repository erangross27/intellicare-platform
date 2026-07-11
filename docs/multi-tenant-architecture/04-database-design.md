# Database Design

## Multi-Tenant Database Strategy

### Approach: Separate Database Per Practice (UPDATED)
**Rationale**: Ultimate security and complete data isolation
- **Complete Isolation**: Each practice has its own dedicated database
- **Zero Cross-Tenant Risk**: Impossible to access other practice's data by design
- **Perfect HIPAA Compliance**: Total data sovereignty per practice
- **Easy Management**: Drop entire database to remove practice
- **Performance**: No tenant filtering needed, pure practice-specific queries

### Database Architecture

#### Global Platform Database
```
intellicare_global
├── practices (practice registry and metadata)
└── platform_settings (global configuration)
```

#### Per-Practice Databases
```
intellicare_practice_{practiceId}
├── users (practice staff and administrators)
├── patients (all patient records)
├── documents (medical documents and files)
├── auditlogs (compliance and security logs)
├── appointments (scheduling data)
├── billing (financial records)
├── settings (practice-specific configuration)
└── sessions (user session management)
```

#### Database Naming Convention
- **Global**: `intellicare_global`
- **Practice**: `intellicare_practice_{subdomain}` (e.g., `intellicare_practice_downtown`)

## Core Data Models

### Practice (Tenant)
```javascript
{
  _id: ObjectId,
  name: String,                    // "Downtown Medical Center"
  subdomain: String,               // "downtown-medical" (unique)
  status: String,                  // "active", "suspended", "trial"
  subscription: {
    plan: String,                  // "basic", "professional", "enterprise"
    maxUsers: Number,              // User limit for this plan
    maxPatients: Number,           // Patient limit for this plan
    features: [String],            // Enabled features
    billingCycle: String,          // "monthly", "annual"
    nextBillingDate: Date,
    isActive: Boolean
  },
  settings: {
    timezone: String,              // "America/New_York"
    language: String,              // "en", "he"
    dateFormat: String,            // "MM/DD/YYYY", "DD/MM/YYYY"
    currency: String,              // "USD", "ILS"
    workingHours: {
      start: String,               // "08:00"
      end: String,                 // "18:00"
      days: [String]               // ["monday", "tuesday", ...]
    },
    security: {
      sessionTimeout: Number,      // Minutes
      passwordPolicy: Object,
      mfaRequired: Boolean,
      ipWhitelist: [String]
    }
  },
  contact: {
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    },
    phone: String,
    email: String,
    website: String
  },
  billing: {
    companyName: String,
    taxId: String,
    billingAddress: Object,
    paymentMethod: Object
  },
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId,
  isDeleted: Boolean,
  deletedAt: Date
}
```

### User (Multi-Practice Support)
```javascript
{
  _id: ObjectId,
  email: String,                   // Unique across platform
  passwordHash: String,
  profile: {
    firstName: String,
    lastName: String,
    title: String,                 // "Dr.", "RN", "LPN"
    phone: String,
    avatar: String,                // URL to profile image
    language: String,              // Preferred language
    timezone: String
  },
  practices: [{
    practiceId: ObjectId,            // Reference to practice
    roles: [String],               // ["doctor", "admin"]
    permissions: [String],         // Specific permissions
    status: String,                // "active", "inactive", "pending"
    joinedAt: Date,
    invitedBy: ObjectId,
    department: String,            // "cardiology", "pediatrics"
    licenseNumber: String,         // Medical license
    specializations: [String]
  }],
  security: {
    mfaEnabled: Boolean,
    mfaSecret: String,
    backupCodes: [String],
    lastLogin: Date,
    loginAttempts: Number,
    lockedUntil: Date,
    passwordResetToken: String,
    passwordResetExpires: Date
  },
  preferences: {
    notifications: Object,
    dashboard: Object,
    accessibility: Object
  },
  createdAt: Date,
  updatedAt: Date,
  isDeleted: Boolean,
  deletedAt: Date
}
```

### Patient (Practice-Scoped)
```javascript
{
  _id: ObjectId,
  practiceId: ObjectId,              // CRITICAL: Tenant isolation
  patientId: String,               // Practice-specific patient ID
  personalInfo: {
    firstName: String,
    lastName: String,
    dateOfBirth: Date,
    gender: String,                // "male", "female", "other"
    ssn: String,                   // Encrypted
    nationalId: String,            // Country-specific ID
    nationality: String,
    language: String,              // Preferred language
    maritalStatus: String
  },
  contact: {
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    },
    phone: String,
    email: String,
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
      email: String
    }
  },
  insurance: {
    provider: String,
    policyNumber: String,
    groupNumber: String,
    subscriberId: String,
    effectiveDate: Date,
    expirationDate: Date
  },
  medicalInfo: {
    bloodType: String,
    allergies: [String],
    chronicConditions: [String],
    currentMedications: [String],
    familyHistory: [String],
    socialHistory: {
      smoking: String,             // "never", "former", "current"
      alcohol: String,
      drugs: String,
      occupation: String
    }
  },
  assignedProviders: [{
    userId: ObjectId,              // Doctor/nurse assigned
    role: String,                  // "primary", "specialist", "nurse"
    assignedAt: Date,
    assignedBy: ObjectId
  }],
  medicalHistory: [{
    _id: ObjectId,
    date: Date,
    type: String,                  // "visit", "procedure", "test", "medication"
    diagnosis: String,
    symptoms: String,
    treatment: String,
    notes: String,
    provider: ObjectId,            // Who created this entry
    followUpDate: Date,
    status: String,                // "active", "resolved", "ongoing"
    confidentiality: String,       // "normal", "restricted", "confidential"
    createdAt: Date,
    updatedAt: Date,
    isDeleted: Boolean,
    deletedAt: Date,
    deletedBy: ObjectId
  }],
  documents: [{
    _id: ObjectId,
    fileName: String,
    originalName: String,
    fileType: String,
    mimeType: String,
    fileSize: Number,
    category: String,              // "lab", "imaging", "prescription"
    encryptedContent: Buffer,      // Encrypted file content
    encryptionKey: String,         // Encrypted with practice key
    uploadedBy: ObjectId,
    uploadedAt: Date,
    tags: [String],
    isDeleted: Boolean,
    deletedAt: Date
  }],
  visits: [{
    _id: ObjectId,
    date: Date,
    type: String,                  // "routine", "urgent", "follow-up"
    provider: ObjectId,
    chiefComplaint: String,
    vitalSigns: {
      temperature: Number,
      bloodPressure: String,
      heartRate: Number,
      respiratoryRate: Number,
      oxygenSaturation: Number,
      weight: Number,
      height: Number,
      bmi: Number
    },
    assessment: String,
    plan: String,
    duration: Number,              // Minutes
    status: String,                // "scheduled", "in-progress", "completed", "cancelled"
    createdAt: Date,
    updatedAt: Date
  }],
  consent: {
    treatmentConsent: Boolean,
    dataProcessingConsent: Boolean,
    marketingConsent: Boolean,
    researchConsent: Boolean,
    consentDate: Date,
    consentVersion: String,
    withdrawalDate: Date
  },
  audit: {
    createdAt: Date,
    createdBy: ObjectId,
    updatedAt: Date,
    updatedBy: ObjectId,
    lastAccessedAt: Date,
    lastAccessedBy: ObjectId,
    accessCount: Number
  },
  isDeleted: Boolean,
  deletedAt: Date,
  deletedBy: ObjectId,
  deletionReason: String
}
```

### Audit Log (Cross-Practice)
```javascript
{
  _id: ObjectId,
  practiceId: ObjectId,              // Which practice this action relates to
  userId: ObjectId,                // Who performed the action
  action: String,                  // "create", "read", "update", "delete"
  resource: String,                // "patient", "user", "document"
  resourceId: ObjectId,            // ID of the affected resource
  details: {
    before: Object,                // State before change
    after: Object,                 // State after change
    fields: [String],              // Which fields were modified
    reason: String,                // Reason for change
    ipAddress: String,
    userAgent: String,
    sessionId: String
  },
  metadata: {
    severity: String,              // "low", "medium", "high", "critical"
    category: String,              // "security", "privacy", "clinical", "administrative"
    compliance: [String],          // ["HIPAA", "GDPR"]
    automated: Boolean             // Was this an automated action?
  },
  timestamp: Date,
  processed: Boolean,              // Has this been processed by compliance systems?
  processedAt: Date
}
```

## Indexing Strategy

### Tenant Isolation Indexes
```javascript
// Critical: Every collection must have practiceId index
db.patients.createIndex({ "practiceId": 1 })
db.users.createIndex({ "practices.practiceId": 1 })
db.documents.createIndex({ "practiceId": 1 })
db.auditLogs.createIndex({ "practiceId": 1 })

// Compound indexes for common queries
db.patients.createIndex({ "practiceId": 1, "personalInfo.lastName": 1 })
db.patients.createIndex({ "practiceId": 1, "patientId": 1 }, { unique: true })
db.auditLogs.createIndex({ "practiceId": 1, "timestamp": -1 })
```

### Performance Indexes
```javascript
// User authentication
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "security.passwordResetToken": 1 })

// Patient search
db.patients.createIndex({ 
  "practiceId": 1, 
  "personalInfo.firstName": "text", 
  "personalInfo.lastName": "text" 
})

// Medical history queries
db.patients.createIndex({ "practiceId": 1, "medicalHistory.date": -1 })
db.patients.createIndex({ "practiceId": 1, "assignedProviders.userId": 1 })

// Document management
db.patients.createIndex({ "practiceId": 1, "documents.category": 1 })
db.patients.createIndex({ "practiceId": 1, "documents.uploadedAt": -1 })
```

## Data Encryption

### Field-Level Encryption
**Sensitive fields encrypted at application level**
```javascript
// Encrypted fields
patient.personalInfo.ssn = encrypt(ssn, clinicKey)
patient.personalInfo.nationalId = encrypt(nationalId, clinicKey)
patient.contact.phone = encrypt(phone, clinicKey)
patient.insurance.policyNumber = encrypt(policyNumber, clinicKey)
```

### Document Encryption
**All uploaded documents encrypted**
```javascript
// Document encryption process
const encryptedContent = encrypt(fileBuffer, documentKey)
const encryptedKey = encrypt(documentKey, clinicMasterKey)

document.encryptedContent = encryptedContent
document.encryptionKey = encryptedKey
```

### Key Management
- **Practice Master Keys**: Stored in Hardware Security Module (HSM)
- **Document Keys**: Generated per document, encrypted with practice key
- **Key Rotation**: Automated quarterly rotation
- **Key Escrow**: Secure backup for disaster recovery

## Backup and Recovery

### Backup Strategy
- **Full Backups**: Daily full database backups
- **Incremental Backups**: Hourly incremental backups
- **Point-in-Time Recovery**: Binary log replication
- **Cross-Region Replication**: Geographic distribution

### Tenant-Specific Recovery
```javascript
// Restore specific practice data
db.patients.find({ "practiceId": ObjectId("clinic123") })
db.users.find({ "practices.practiceId": ObjectId("clinic123") })
db.auditLogs.find({ "practiceId": ObjectId("clinic123") })
```

### Data Retention Policies
- **Active Data**: Retained indefinitely while practice is active
- **Deleted Data**: Soft delete with 90-day retention
- **Audit Logs**: 7-year retention for compliance
- **Backup Data**: 1-year retention for disaster recovery
