# 🏥 IntelliCare - Complete Platform Documentation

**Last Updated**: October 13, 2025
**Version**: 4.5 (Post-Phase 4 Implementation)

---

## 📚 Table of Contents

1. [Platform Overview](#platform-overview)
2. [Architecture](#architecture)
3. [SecureDataAccess API](#securedataaccess-api)
4. [Database Structure](#database-structure)
5. [Security & Authentication](#security--authentication)
6. [Medical Data Processing](#medical-data-processing)
7. [AI Integration](#ai-integration)
8. [Development Guide](#development-guide)
9. [Deployment](#deployment)
10. [API Reference](#api-reference)

---

## 🎯 Platform Overview

IntelliCare is an intelligent medical AI assistant platform that provides:

- 🤖 **AI-Powered Medical Document Analysis** via Claude Batch API
- 📊 **Comprehensive Medical Data Management** (190+ collection types)
- 🔒 **Multi-Tenant Architecture** with practice-level isolation
- 💬 **Conversational AI Interface** for healthcare professionals
- 📱 **Artifact Panel System** for clinical data visualization
- 🔐 **HIPAA-Compliant Security** with role-based access control

### Key Statistics
- **190+ Medical Collections** covering all specialties
- **1,400+ AI Functions** for medical operations
- **~40 Medical Categories** (medications, labs, procedures, etc.)
- **Multi-Database Architecture** (global + practice-specific)

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  - Artifact Panel (Claude.ai-style split screen)       │
│  - Document Viewer with 3-level navigation             │
│  - Conversational Chat Interface                        │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────┐
│              Backend API (Node.js/Express)              │
│  ┌──────────────────────────────────────────────────┐  │
│  │         SecureDataAccess Layer                   │  │
│  │  - Multi-tenant isolation                        │  │
│  │  - Security validation                           │  │
│  │  - Encryption at rest                            │  │
│  │  - Audit logging                                 │  │
│  └──────────────────┬───────────────────────────────┘  │
└─────────────────────┼──────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
┌────────▼──────────┐   ┌─────────▼──────────┐
│  Global Database  │   │  Practice Database │
│  - Practices      │   │  - Users           │
│  - ServiceAccounts│   │  - Patients        │
│  - Sessions (NEW) │   │  - Documents       │
│  - OTP Codes (NEW)│   │  - Medical Data    │
└───────────────────┘   └────────────────────┘
```

### Multi-Tenant Model
- **Global Database**: `intellicare_practice_global`
  - Stores practices, service accounts, sessions, OTP codes
- **Practice Databases**: `intellicare_practice_{subdomain}`
  - Each practice has isolated database
  - Users, patients, and medical data are practice-specific

---

## 🔐 SecureDataAccess API

**Location**: `/apps/backend-api/services/secureDataAccess.js`

The SecureDataAccess layer is the **ONLY** way to interact with the database. It provides automatic:
- Multi-tenant isolation
- Security validation
- Field encryption
- Audit logging
- MongoDB injection protection

### Available Operations

#### 1. **query()** - Read Data
```javascript
const results = await SecureDataAccess.query(
  'patients',              // collection name
  { status: 'active' },    // filter (MongoDB query)
  { limit: 10, sort: { lastName: 1 } }, // options
  {                        // security context (REQUIRED)
    serviceId: 'patient-service',
    apiKey: serviceToken,
    practiceId: 'yale',    // Use subdomain!
    operation: 'getPatients'
  }
);
```

**Options**:
- `limit`: Number of results to return
- `sort`: Sort order (e.g., `{ createdAt: -1 }`)
- `skip`: Number of documents to skip
- `projection`: Fields to include/exclude

**Returns**: Array of documents (decrypted sensitive fields)

---

#### 2. **insert()** - Create Data
```javascript
const result = await SecureDataAccess.insert(
  'patients',
  {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    ssn: '123-45-6789'     // Will be auto-encrypted
  },
  {
    serviceId: 'patient-service',
    apiKey: serviceToken,
    practiceId: 'yale',
    operation: 'createPatient'
  }
);
```

**Returns**: `{ insertedId: ObjectId, acknowledged: true }`

**Auto-Encryption**: Fields marked as sensitive in security policies are automatically encrypted

---

#### 3. **update()** - Modify Data
```javascript
const result = await SecureDataAccess.update(
  'patients',
  { _id: patientId },      // filter
  {
    $set: {
      status: 'inactive',
      lastModified: new Date()
    }
  },                        // update operations
  {
    serviceId: 'patient-service',
    apiKey: serviceToken,
    practiceId: 'yale',
    operation: 'updatePatient'
  }
);
```

**Supports**: `$set`, `$inc`, `$push`, `$pull`, `$addToSet`, `$unset`

**Returns**: `{ modifiedCount: 1, matchedCount: 1 }`

---

#### 4. **delete()** - Remove Data
```javascript
const result = await SecureDataAccess.delete(
  'patients',
  { _id: patientId },
  {
    serviceId: 'patient-service',
    apiKey: serviceToken,
    practiceId: 'yale',
    operation: 'deletePatient'
  },
  { allowHardDelete: true }  // optional safety flag
);
```

**Returns**: `{ deletedCount: 1 }`

**Safety**: Requires explicit `allowHardDelete` flag for permanent deletion

---

#### 5. **aggregate()** - Complex Queries
```javascript
const results = await SecureDataAccess.aggregate(
  'medications',
  [
    { $match: { patientId: patientObjectId } },
    { $group: {
        _id: '$drugName',
        count: { $sum: 1 },
        totalDosage: { $sum: '$dosage' }
      }
    },
    { $sort: { count: -1 } }
  ],
  {
    serviceId: 'medication-service',
    apiKey: serviceToken,
    practiceId: 'yale',
    operation: 'aggregateMedications'
  }
);
```

**Use Cases**: Complex analytics, grouping, joining collections

---

#### 6. **upsert()** - Atomic Insert or Update (NEW - Oct 2025)
```javascript
const result = await SecureDataAccess.upsert(
  'sessions',
  {
    userId: userObjectId,
    practiceId: practiceObjectId
  },                           // filter (match condition)
  {
    token: sessionToken,
    userId: userObjectId,
    practiceId: practiceObjectId,
    csrfToken: csrfToken,
    expiresAt: expiresAt,
    isActive: true
  },                           // document (full replacement)
  {
    serviceId: 'session-manager',
    apiKey: serviceToken,
    practiceId: 'global',
    operation: 'createSession'
  }
);
```

**How it Works**:
1. Finds document matching `filter`
2. If found: Replaces entire document with new data
3. If not found: Inserts new document
4. **Atomic**: No race conditions, happens in single database operation

**When to Use**:
- ✅ Sessions (one active session per user)
- ✅ OTP codes (one valid code per email)
- ✅ Tokens (one valid token per user)
- ✅ User preferences/settings
- ❌ Medical records (time-series data)
- ❌ Audit logs (append-only)

**Returns**: Full document with `_id`

**Benefits**:
- Prevents duplicate records from concurrent requests
- Enforces "one record per key" business rules
- ~60% faster than query → delete → insert pattern

---

### Security Context (Required for ALL operations)

```javascript
const context = {
  serviceId: 'your-service-name',     // For audit logging
  apiKey: serviceToken,                // Service authentication token
  practiceId: 'subdomain',             // Practice subdomain (NOT ObjectId!)
  operation: 'operationName',          // For audit trail
  practiceSubdomain: 'subdomain'       // Optional: explicit subdomain
};
```

**CRITICAL**:
- `practiceId` MUST be the practice **subdomain** (e.g., 'yale'), NOT the ObjectId
- Use `'global'` for global database operations (practices, sessions, OTP codes)
- `apiKey` must be obtained via `serviceAccountManager.authenticate()`

---

### Field Encryption

SecureDataAccess automatically encrypts sensitive fields based on security policies:

**Automatically Encrypted**:
- `ssn` (Social Security Number)
- `password` (User passwords)
- `apiKey` (API keys)
- `token` (Authentication tokens)
- Custom fields marked in `config/securityManifests/`

**Encryption**: AES-256-GCM with practice-specific keys

---

### Audit Logging

Every database operation is logged to `audit_logs` collection:

```javascript
{
  action: 'QUERY',
  serviceId: 'patient-service',
  collection: 'patients',
  practiceId: 'yale',
  userId: '...',
  timestamp: new Date(),
  metadata: {
    operation: 'getPatients',
    documentCount: 10
  }
}
```

---

### Error Handling

```javascript
try {
  const results = await SecureDataAccess.query(...);
} catch (error) {
  if (error.message.includes('SECURITY')) {
    // Authorization failure
  } else if (error.message.includes('INJECTION')) {
    // MongoDB injection attempt detected
  } else if (error.message.includes('Client must be connected')) {
    // Database connection issue
  }
}
```

---

### Best Practices

1. **Always use SecureDataAccess** - Never access MongoDB directly
2. **Use subdomain for practiceId** - Not ObjectId
3. **Handle buffer ObjectIds** - SecureDataAccess sanitizes to prevent leaks
4. **Use upsert for idempotent operations** - Prevents race conditions
5. **Validate inputs** - SecureDataAccess checks, but validate first
6. **Check permissions** - Service accounts have limited collection access

---

### Migration from Direct MongoDB

**Before** (Direct MongoDB - NEVER DO THIS):
```javascript
const patients = await db.collection('patients').find({ status: 'active' }).toArray();
```

**After** (SecureDataAccess - CORRECT):
```javascript
const patients = await SecureDataAccess.query(
  'patients',
  { status: 'active' },
  {},
  {
    serviceId: 'patient-service',
    apiKey: serviceToken,
    practiceId: req.practice.subdomain,
    operation: 'getActivePatients'
  }
);
```

---

## 💾 Database Structure

### Global Database Collections
- `practices` - Practice/clinic information
- `serviceaccounts` - Service authentication credentials
- `sessions` - User session tokens (centralized)
- `otpcodes` - One-time password codes for auth
- `emailverifications` - Email verification tokens
- `logintokens` - Magic link login tokens
- `audit_logs` - System-wide audit trail

### Practice Database Collections

#### Core Collections
- `users` - Practice staff and admin users
- `patients` - Patient demographic information
- `documents` - Uploaded medical documents metadata
- `chats` - Conversational AI chat sessions
- `messages` - Chat message history

#### Medical Data Collections (~190 collections)
**Categories**:
- Medications (medications, prescriptions, medication_reconciliation)
- Lab Results (lab_results, pathology_reports, genetic_test_results)
- Vital Signs (vital_signs, blood_pressure_readings, temperature_readings)
- Procedures (procedures, surgeries, diagnostic_procedures)
- Diagnoses (diagnoses, diagnosis_codes, differential_diagnoses)
- Imaging (imaging_reports, radiology_results, ct_scans, mri_scans)
- AI-Generated (clinical_decision_support, intelligent_recommendations)
- And 30+ more medical categories...

#### Special Collections
- `unified_medical_documents` - Complete PDF analysis results (~40-50KB each)
- `active_batch_jobs` - Claude Batch API job tracking
- `prognosis_records` - Patient outcome predictions

---

## 🔒 Security & Authentication

### Authentication Flow (OTP-Based)

1. **Request OTP Code**:
   ```
   POST /api/passwordless-auth/send-otp
   { "email": "user@example.com" }
   ```
   - Generates 6-digit code
   - Uses **atomic upsert** to prevent duplicate codes
   - Rate limiting: 60 seconds between requests

2. **Verify OTP**:
   ```
   POST /api/passwordless-auth/verify-otp
   { "email": "user@example.com", "code": "123456" }
   ```
   - Validates code
   - Creates session via **atomic upsert** (one session per user)
   - Returns session token + CSRF token

3. **Session Management**:
   - Sessions stored in global database
   - httpOnly cookies for security
   - 30-day expiration (configurable)
   - **Atomic upsert ensures one active session per user+practice**

### Service Account Authentication

```javascript
const serviceAccountManager = require('./serviceAccountManager');

// Authenticate service
const token = await serviceAccountManager.authenticate('patient-service');

// Use token in SecureDataAccess
const context = {
  serviceId: 'patient-service',
  apiKey: token,
  practiceId: 'yale',
  operation: 'getPatients'
};
```

### RBAC (Role-Based Access Control)

**Roles**:
- `admin` - Full system access
- `medical_director` - Medical data + user management
- `doctor` - Patient care + medical records
- `nurse` - Patient care (limited)
- `staff` - Administrative tasks
- `user` - Basic access

**Permissions** (90+ permissions):
- `read_patients`, `write_patients`, `delete_patients`
- `read_documents`, `write_documents`, `export_documents`
- `manage_users`, `assign_roles`, `view_audit_logs`
- And 80+ more granular permissions...

---

## 🏥 Medical Data Processing

### Document Analysis Flow

```
PDF Upload → Preprocessing → Claude Batch API → medicalFieldMappingService
                                                            ↓
                                    ┌───────────────────────┴─────────────────────┐
                                    ↓                                             ↓
                    saveUnifiedDocument()                    Save to Granular Collections
              (unified_medical_documents)                   (medications, labs, procedures...)
                   ~40-50KB per PDF                                  190+ collections
```

### Data Extraction (6-Step Checklist)

**Step 1**: Define schema in `claudeBatchProcessor.js:getDocumentAnalysisTools()`
**Step 2**: Add to collection schema in `collectionSchemas.js`
**Step 3**: Add handler in `medicalFieldMappingService.js` (if special processing needed)
**Step 4**: Register in `medicalCollectionsService.js:allCollections`
**Step 5**: Add to `universalFieldsToExclude` (if universal field)
**Step 6**: Add to required array (if AI-generated field only)

### Medical Categories

- **Extracted from PDF**: medications, allergies, lab_results, vital_signs, procedures, diagnoses
- **AI-Generated**: clinicalDecisionSupport, intelligentRecommendations, trending_analysis, drug_interactions, red_flags

---

## 🤖 AI Integration

### Claude Batch API
- **Model**: Claude Sonnet 4.5
- **Purpose**: Medical document analysis
- **Processing**: Batch uploads for efficiency
- **Cost**: ~$0.01-0.03 per document

### Function Execution
- **Model**: Claude Haiku 3.5
- **Purpose**: Conversational AI + function calling
- **Functions**: 1,400+ medical operations
- **Optimization**: Semantic function selection (99.6% token reduction)

### Function Registry
**Location**: `apps/backend-api/services/utils/aiHelpers.js`

```javascript
// Get all available functions
const functions = getAllPlatformFunctions();

// Add custom function
function addCustomFunction(name, description, parameters, handler) {
  // Register in function registry...
}
```

---

## 🛠️ Development Guide

### Project Structure
```
apps/backend-api/
├── config/              # Configuration files
│   └── securityManifests/  # Security policies
├── middleware/          # Express middleware
│   ├── practiceAuth.js     # Practice authentication
│   └── practiceContext.js  # Multi-tenant context
├── models/              # MongoDB schemas
├── routes/              # API endpoints
│   ├── agent.js            # Conversational AI routes
│   ├── passwordlessAuth.js # OTP authentication
│   └── ...
├── services/            # Business logic
│   ├── secureDataAccess.js        # Database layer
│   ├── secureSessionManager.js    # Session management
│   ├── otpService.js              # OTP code generation
│   ├── medicalFieldMappingService.js  # Data extraction
│   ├── claudeBatchProcessor.js    # Batch document processing
│   └── ...
├── scripts/             # Utility scripts
│   ├── verifyUpsertImplementation.sh  # Test atomic upserts
│   └── ...
└── server.js            # Application entry point
```

### Adding New Medical Collection

1. **Define Schema** (`services/collectionSchemas.js`):
```javascript
medication_history: {
  patientId: 'ObjectId',
  drugName: 'string',
  dosage: 'string',
  startDate: 'date',
  endDate: 'date'
}
```

2. **Register Collection** (`services/medicalCollectionsService.js`):
```javascript
const allCollections = [
  // ...existing collections
  'medication_history'
];
```

3. **Add Extraction** (`services/claudeBatchProcessor.js`):
```javascript
{
  type: 'function',
  function: {
    name: 'store_medication_history',
    description: 'Store patient medication history',
    parameters: {
      // ... field definitions
    }
  }
}
```

4. **Create Frontend Renderer** (if needed):
   - Add to `AIDocumentRenderer.jsx`
   - Add to `DocumentDetailView.jsx:AI_COLLECTIONS`
   - Add to `ArtifactPanel.jsx:DOCUMENT_VIEW_COLLECTIONS`
   - Add to `routes/agent.js:generateDocumentPreview()`
   - Add to `collectionDisplayConfig.js:DOCUMENT_MODE_COLLECTIONS`

### Running the Platform

```bash
# Backend (Port 5000)
cd apps/backend-api
npm run dev

# Frontend (Port 3000)
cd apps/frontend-vite
npm run dev
```

### Testing

```bash
# Verify upsert implementation
./scripts/verifyUpsertImplementation.sh

# Check database collections
MONGO_URI=$(cat .kms/MONGODB_ADMIN_URI)
mongosh "$MONGO_URI" --eval "db.getSiblingDB('intellicare_practice_yale').getCollectionNames()"

# Test OTP flow (no email required in dev)
# Uses dev-login bypass for testing
```

---

## 🚀 Deployment

### Environment Variables

```bash
# Backend (.kms/ directory - 600 permissions)
MONGODB_ADMIN_URI=mongodb://user:<DB_PASSWORD>@localhost:27017/admin
ANTHROPIC_API_KEY=sk-ant-...
SENDGRID_API_KEY=SG....  # Optional
TWILIO_*                  # Optional

# Config
NODE_ENV=production
PORT=5000
```

### MongoDB Setup

```bash
# Install MongoDB 7.0
sudo apt install mongodb-org

# Configure
sudo nano /etc/mongod.conf
# Set:
# - bindIp: 127.0.0.1,localhost
# - security.authorization: enabled
# - replication.replSetName: rs0

# Start service
sudo systemctl start mongod
sudo systemctl enable mongod

# Initialize replica set (required for transactions)
mongosh --eval "rs.initiate()"
```

### Production Checklist

- [ ] Set NODE_ENV=production
- [ ] Configure MongoDB authentication
- [ ] Set secure JWT_SECRET
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Set up backup cron jobs
- [ ] Enable audit logging
- [ ] Configure rate limiting
- [ ] Set session TTL appropriately
- [ ] Test OTP email delivery

---

## 📡 API Reference

### Authentication

```
POST /api/passwordless-auth/send-otp
POST /api/passwordless-auth/verify-otp
POST /api/passwordless-auth/request-login       # Magic link (deprecated)
POST /api/passwordless-auth/create-practice
```

### Conversational AI

```
POST /api/agent/message                          # Send chat message
GET  /api/agent/patient/:id/categories           # Get medical categories
GET  /api/agent/patient/:id/category/:cat/documents/all  # Get documents
```

### Patient Management

```
POST /api/patients                               # Create patient
GET  /api/patients                               # List patients
GET  /api/patients/:id                           # Get patient details
PUT  /api/patients/:id                           # Update patient
DELETE /api/patients/:id                         # Soft delete patient
```

### Document Analysis

```
POST /api/batch-documents/analyze                # Upload for batch analysis
GET  /api/batch-documents/status/:jobId          # Check processing status
GET  /api/batch-documents/results/:jobId         # Get analysis results
```

---

## 🔧 Troubleshooting

### Common Issues

**1. "Client must be connected" Error**
- MongoDB not running: `sudo systemctl start mongod`
- Connection string wrong: Check `.kms/MONGODB_ADMIN_URI`

**2. Duplicate Sessions/OTP Codes**
- Old code (pre-Oct 2025): Update to use atomic upsert
- Run: `./scripts/verifyUpsertImplementation.sh`

**3. "SECURITY: Operation not allowed"**
- Service account lacks permissions
- Check `config/securityManifests/` for collection access

**4. Wrong Practice Database**
- Using ObjectId instead of subdomain for `practiceId`
- Should be: `practiceId: 'yale'` NOT `practiceId: ObjectId(...)`

**5. OTP Not Working**
- SendGrid DNS not configured (use dev-login bypass)
- Check rate limiting (60 second delay)

---

## 📊 Performance Metrics

- **Function Selection**: 99.6% token reduction (1,352 → 10 functions)
- **Batch Processing**: ~$0.01-0.03 per document
- **Session Validation**: ~500ms (cached), ~50ms (cache hit)
- **Database Queries**: <100ms average with indexes
- **Upsert Operations**: ~60% faster than query+delete+insert

---

## 📝 Version History

### October 2025 - Version 4.5
- ✅ **Atomic Upsert Implementation** for sessions and OTP codes
- ✅ Eliminated race conditions in authentication flow
- ✅ Enforces "one session per user" security policy
- ✅ Added verification script for database integrity

### September 2025 - Version 4.0 (Phase 4)
- ✅ Function routing optimization (22 refactored services)
- ✅ Universal caching system (~95% performance boost)
- ✅ 920 auto-generated medical CRUD functions
- ✅ Semantic function selection

### August 2025 - Version 3.5
- ✅ Artifact Panel system (Claude.ai-style split screen)
- ✅ 8 AI-generated collections
- ✅ Fuzzy patient search ($0.0003/search)
- ✅ Anesthesia document templates

---

## 🤝 Contributing

See project-specific guides:
- `CLAUDE.md` - Claude Code assistant instructions
- `VISION.md` - Platform vision and roadmap
- `SECURITY-AUDIT-REPORT.md` - Security guidelines
- `/docs/IntelliCare-A+Features/` - A+ feature implementation plan

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🆘 Support

For issues or questions:
1. Check `CLAUDE.md` for development context
2. Review `DEBUGGING_TOOLKIT.md` for troubleshooting
3. Run verification scripts in `/scripts/`
4. Check audit logs: `db.audit_logs.find().sort({timestamp:-1}).limit(10)`

---

**Built with ❤️ for healthcare professionals worldwide**
