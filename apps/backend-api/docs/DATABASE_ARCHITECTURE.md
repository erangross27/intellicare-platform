# IntelliCare Database Architecture and Medical Collections System
## Comprehensive Overview

---

## 1. MULTI-TENANT DATABASE ARCHITECTURE

### 1.1 Global vs Practice-Specific Databases

IntelliCare uses a **multi-tenant architecture** with strict database isolation:

```
┌─────────────────────────────────────────────────────────────────┐
│         GLOBAL DATABASE (intellicare_practice_global)           │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Platform-wide data management and multi-tenant control │
│                                                                 │
│ Collections:                                                    │
│ • Practices          → Clinic registry and configuration        │
│ • ServiceAccount     → API keys, service permissions, auth      │
│ • Users (admins)     → Platform administrators                  │
│ • Billing            → Cross-practice billing data              │
│ • Webhooks           → Event subscriptions                      │
│ • AuditLogs          → Security and compliance logging          │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│  PRACTICE DATABASES (intellicare_practice_{subdomain})          │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Isolated patient and medical data per practice         │
│ Example: intellicare_practice_yale                              │
│                                                                 │
│ Collections:                                                    │
│ • Users              → Practice staff (doctors, nurses)         │
│ • Patients           → Patient demographics                     │
│ • 190+ Medical       → Granular collections (medications,       │
│   Collections          diagnoses, labs, imaging, etc.)          │
│ • unified_           → Complete documents for viewing           │
│   medical_documents                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Database Naming Convention

- **Global Database**: `intellicare_practice_global`
- **Practice Databases**: `intellicare_practice_{subdomain}`
  - Example: `intellicare_practice_yale` (subdomain = "yale")
  - **CRITICAL**: Use `practiceSubdomain` NOT `practiceId` for database routing
  - Prevents accidental use of MongoDB ObjectId as database name

### 1.3 Connection Management

**DatabaseConnectionProvider** (`databaseConnectionProvider.js`):
- Singleton pattern manages all database connections
- Connection pooling with metadata tracking
- Reuses connections per database to reduce overhead
- Tracks service usage for monitoring and debugging
- Cleans up idle connections after 5 minutes

**ConnectionPoolManager**:
- Acquires connections from MongoDB driver pool
- Maintains per-database connection lifecycle
- Integrates with DatabaseConnectionProvider for unified access

---

## 2. TWO-PATH ARCHITECTURE: UNIFIED DOCS + GRANULAR COLLECTIONS

### 2.1 The Problem

MongoDB has a **16MB document size limit**. Large medical documents exceed this:
- Complete patient records with all medical history: 40-50KB each
- Images, scans, PDFs embedded in documents
- Years of medical history per patient
- Multiple documents per patient over time

### 2.2 The Solution: Dual-Path Architecture

Every extracted medical document is saved in **TWO WAYS**:

```
                    ┌─────────────────────────────────────────┐
                    │ Claude Batch API Document Analysis      │
                    │ (1M token context for long documents)   │
                    └──────────────┬──────────────────────────┘
                                   │
                    ┌──────────────┴──────────────────┐
                    │                                 │
        ┌───────────▼─────────────┐     ┌───────────▼──────────────┐
        │  PATH 1: UNIFIED DOCS   │     │ PATH 2: GRANULAR COLLS   │
        ├─────────────────────────┤     ├────────────────────────┤
        │ Collection:             │     │ Collections:           │
        │ unified_medical_        │     │ • medications          │
        │ documents (ONE per      │     │ • diagnoses            │
        │ analysis)               │     │ • lab_results          │
        │                         │     │ • imaging_reports      │
        │ Purpose: Doctor Review  │     │ • allergies            │
        │ • Complete context      │     │ • vital_signs          │
        │ • All medical history   │     │ • prescriptions        │
        │ • Original AI insights  │     │ • clinical_scores      │
        │ • 40-50KB each          │     │ ... (190+ total)       │
        │ • Full narrative text   │     │                        │
        │                         │     │ Purpose: Fast Queries  │
        │ Usage: Artifact Panel   │     │ • One query = one      │
        │ (Claude.ai style split  │     │   medical item type    │
        │ screen for viewing)     │     │ • Normalized fields    │
        │                         │     │ • O(1) lookups         │
        │                         │     │ • Embedded in patient  │
        │                         │     │   medicalData metadata  │
        │                         │     │                        │
        │                         │     │ Usage: Quick searches  │
        │                         │     │ (medication list, labs)│
        └─────────────────────────┘     └────────────────────────┘
```

### 2.3 Data Flow Example

```
INPUT: Patient admitted with diabetes, on metformin, glucose 250

           ↓ Claude Batch extracts & maps

UNIFIED DOC STORAGE (unified_medical_documents):
{
  _id: ObjectId,
  patientId: ObjectId,
  documentId: "doc_123",
  category: "hospital_admission_notes",
  documentData: {
    chiefComplaint: "Elevated blood glucose",
    vitalSigns: { bloodPressure: "140/90", ... },
    labResults: [
      { test: "Glucose", value: 250, unit: "mg/dL", severity: "high" }
    ],
    medications: [
      { name: "Metformin", dosage: "500mg", frequency: "twice daily" }
    ],
    diagnoses: [
      { diagnosis: "Type 2 Diabetes", type: "primary" }
    ],
    ... (ALL 35 clinical sections for doctor review)
  }
}

GRANULAR COLLECTION STORAGE (3 separate collections):

medications collection:
{
  _id: ObjectId,
  patientId: ObjectId,
  documentId: "doc_123",
  name: "Metformin",
  dosage: "500mg",
  frequency: "twice daily",
  active: true
}

lab_results collection:
{
  _id: ObjectId,
  patientId: ObjectId,
  documentId: "doc_123",
  test: "Glucose",
  value: 250,
  unit: "mg/dL",
  status: "abnormal",
  severity: "high"
}

diagnoses collection:
{
  _id: ObjectId,
  patientId: ObjectId,
  documentId: "doc_123",
  diagnosis: "Type 2 Diabetes",
  type: "primary",
  status: "active"
}
```

### 2.4 Why Both Paths?

| Feature | Unified Docs | Granular Collections |
|---------|-------------|---------------------|
| Use Case | Doctor reviewing complete patient context | Fast queries for specific data |
| Query Speed | Slower (one large doc) | Fast (specific collection only) |
| Serialization | Once per document | Once per field type |
| Artifact Panel | Shows complete document view | Shows grid or list view |
| Size | 40-50KB per document | 1-5KB per record |
| Queries | 1 read = full context | Multiple reads for different types |

---

## 3. MEDICAL COLLECTIONS: 190+ SPECIALIZED COLLECTIONS

### 3.1 Collection Organization

Collections are organized by clinical domain:

```
CORE MEDICAL RECORDS:
├── unified_medical_documents  ← Complete documents (Artifact Panel)
├── abnormal_results
├── admission_assessments
├── allergies
├── appointments
├── consultation_notes
├── diagnoses
├── discharge_summaries
├── imaging_reports
├── lab_results
├── medical_alerts
├── medical_procedures
├── medications
├── prescriptions
├── referrals
├── vital_signs
└── vaccination_records

HOSPITAL & EMERGENCY:
├── emergency_discharge_summaries
├── hospital_admission_notes
├── hospital_discharge_summaries
├── icu_flow_sheets
├── nursing_notes
├── treatment_courses

SPECIALTY DEPARTMENTS:
├── Cardiology (5): cardiology_consultations, ecg_reports, echo_reports, stress_test_reports
├── Neurology (4): neurology_consultations, eeg_reports, emg_reports, neuropsychological_assessments
├── Psychiatry (5): psychiatric_evaluations, psychiatric_progress_notes, therapy_session_notes
├── Pediatrics (7): pediatric_visits, pediatric_growth_charts, developmental_assessments
├── OB/GYN (9): prenatal_visits, labor_delivery_records, postpartum_notes, ultrasound_ob_reports
├── Oncology (8): chemotherapy_records, radiation_therapy_records, tumor_board_notes
├── Nephrology (12): dialysis_records, kidney_function_reports, transplant_evaluations
├── Pulmonology (8): pulmonary_function_tests, asthma_assessments, sleep_study_reports
├── Allergy/Immunology (6): allergy_assessments, allergy_skin_testing, challenge_tests
├── Gastroenterology (11): colonoscopy_reports, endoscopy_reports, inflammatory_bowel_reports
├── Plus 10+ more specialties...
└── Total: 190+ collections

AI-GENERATED INTELLIGENCE:
├── clinical_decision_support
├── intelligent_recommendations
├── medication_optimization
├── follow_up_intelligence
├── trending_analysis
├── patient_specific_care_plan
├── care_gaps
├── guideline_compliance
└── outcomes_prediction
```

### 3.2 Collection Schemas

**File**: `services/collectionSchemas.js` (267 collections defined)

Each collection has:
```javascript
{
  // Base fields (universal to all collections)
  _id: ObjectId,
  patientId: ObjectId,
  documentId: string,
  createdAt: Date,
  updatedAt: Date,
  source: string,
  aiProcessed: boolean,

  // Collection-specific fields
  // Example: medications collection
  name: string (required),
  genericName: string,
  dosage: string,
  frequency: string,
  route: string,
  startDate: Date,
  endDate: Date,
  prescriber: string,
  indication: string,
  drugInteractions: object,
  safetyWarning: string,
  active: boolean
}
```

### 3.3 Universal Fields (Excluded from Specific Collections)

**File**: `collectionSchemas.js:17-72`

These fields are ALWAYS handled by separate collections:
- **Patient Demographics**: patientName, dateOfBirth, age, gender, race
- **Core Medical Data**: medications, allergies, diagnoses, labResults, imaging, procedures
- **AI Intelligence**: clinicalDecisionSupport, recommendations, medicationOptimizations, careGaps
- **Clinical Data**: clinicalScores, pathologyFindings, treatmentCourse, patientEducation
- **New Fields (Oct 2025)**: treatmentPlans, monitoringPlans, referrals, pulmonaryFunctionTests

Example: If `medications` field appears in extracted data, it goes to **medications collection**, NOT stored in the primary document.

---

## 4. SECURE DATA ACCESS SYSTEM

### 4.1 SecureDataAccess: Single Authorized Data Gateway

**File**: `services/secureDataAccess.js` (1200+ lines)

**CRITICAL RULE**: Direct MongoDB access is **PROHIBITED**. All access must go through SecureDataAccess.

```javascript
// ✅ CORRECT - Using SecureDataAccess
const SecureDataAccess = require('./services/secureDataAccess');
const data = await SecureDataAccess.query('medications', { patientId }, { context });

// ❌ WRONG - Direct Mongoose access (blocked)
const meds = await db.collection('medications').find({}).toArray();  // SECURITY VIOLATION!
```

### 4.2 Five Core Methods

| Method | Purpose | Usage |
|--------|---------|-------|
| `query()` | Read data | Retrieve any patient data |
| `insert()` | Create records | Save extracted medical data |
| `update()` | Modify records | Update patient information |
| `delete()` | Remove records | Delete records (rare) |
| `aggregate()` | Complex queries | Analytics, grouping, trending |

### 4.3 Security Validation Pipeline

Every query passes through 10 security checks:

```
1. Service Authentication
   ↓ Validate API key/token via ServiceAccount
   ↓
2. Check Service Blocking
   ↓ Is this service blacklisted?
   ↓
3. Collection Authorization
   ↓ Does service have permission for this collection?
   ↓
4. Mongoose Object Detection
   ↓ Reject if query contains Mongoose metadata
   ↓
5. Prototype Pollution Check
   ↓ Prevent __proto__ and constructor attacks
   ↓
6. Aggregation Pipeline Validation
   ↓ Check if $match, $project, $group operators are safe
   ↓
7. SQL/NoSQL Injection Prevention
   ↓ Validate ID patterns, block SQL keywords, check regex safety
   ↓
8. Access Policy Application
   ↓ Apply row-level security filters
   ↓
9. Field Masking
   ↓ Hide sensitive fields based on service permissions
   ↓
10. Audit Logging
    ↓ Log all data access for compliance
```

### 4.4 Service Context Pattern

Every SecureDataAccess call requires a context object:

```javascript
const context = {
  serviceId: 'my-service',           // Service identifier
  apiKey: this.serviceToken,         // API key from KMS
  operation: 'mapAndSaveData',       // Operation name
  practiceId: practiceSubdomain,    // Use SUBDOMAIN not ObjectId
  practiceSubdomain: practiceSubdomain
};

const result = await SecureDataAccess.insert('medications', data, context);
```

---

## 5. DATA EXTRACTION FLOW: DOCUMENT ANALYSIS

### 5.1 Complete Data Flow

```
┌──────────────────────────────┐
│  PDF/Document Upload         │
│  (Medical record)            │
└────────────┬─────────────────┘
             │
             ↓
┌──────────────────────────────────────────────┐
│ claudeBatchProcessor.js                      │
│ • Prepares batch request with 1M token limit │
│ • Defines extraction schema (67 fields)      │
│ • Creates Claude Batch job                   │
└────────────┬──────────────────────────────────┘
             │
             ↓
┌──────────────────────────────────────────────┐
│ Claude Batch API (1M tokens)                 │
│ • Analyzes document with extended context    │
│ • Extracts medical data to schema            │
│ • Returns structured JSON                    │
└────────────┬──────────────────────────────────┘
             │
             ↓
┌──────────────────────────────────────────────┐
│ medicalFieldMappingService.js:saveComprehensiveData()
│ TWO-PATH EXTRACTION:                         │
└────────────┬──────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ↓                 ↓
PATH 1:           PATH 2:
Unified Doc       Granular Collections
    │                 │
    ↓                 ↓
unified_medical_  medications (if meds extracted)
documents         diagnoses (if diagnoses extracted)
    │             lab_results (if labs extracted)
    │             allergies (if allergies found)
    │             imaging_reports (if imaging data)
    │             vital_signs (if vitals present)
    │             ... 190+ collections
    │                 │
    └────────────┬────┘
                 │
                 ↓
        ┌─────────────────────┐
        │ Patient medicalData │
        │ Cache/Metadata      │
        │ (updated with       │
        │  collection counts) │
        └─────────────────────┘
                 │
                 ↓
        ┌────────────────────────┐
        │ Frontend API Call      │
        │ GET /api/patient/data  │
        │ Lists all available    │
        │ medical collections    │
        └────────────────────────┘
                 │
                 ↓
        ┌────────────────────────┐
        │ Artifact Panel         │
        │ (React component)      │
        │ Renders documents or   │
        │ grids based on         │
        │ collection type        │
        └────────────────────────┘
```

### 5.2 medicalFieldMappingService Data Routing

**File**: `services/medicalFieldMappingService.js:94-250`

The service has 22 specialty-specific field mapping services:

```javascript
// Original 10 specialties
ibdFieldMappingService
geriatricFieldMappingService
nephrologyFieldMappingService
neurologyFieldMappingService
obstetricFieldMappingService
oncologyFieldMappingService
surgicalFieldMappingService
orthopedicFieldMappingService
pediatricFieldMappingService
psychiatricFieldMappingService

// Additional 12 specialties (2025)
cardiologyFieldMappingService
endocrinologyFieldMappingService
emergencyMedicineFieldMappingService
dermatologyFieldMappingService
urologyFieldMappingService
familyMedicineFieldMappingService
... and 6 more
```

Each specialty service handles:
1. Field transformation (normalize units, dates, formats)
2. Data validation (check ranges, required fields)
3. Specialized collection routing
4. Cross-collection linking (e.g., medications → drug interactions)

---

## 6. ARTIFACT PANEL: DOCUMENT VIEWING SYSTEM

### 6.1 The Problem & Solution

**Problem**: Medical data comes in two forms:
1. **Grid view**: Medications, labs, allergies (lists of individual items)
2. **Document view**: Complete assessments, discharge summaries (narrative format)

Traditional approach: Show everything in grids → **Loses medical context!**

**Solution**: **WRAP_ALL_RECORDS_COLLECTIONS** → Render complete documents, not grids

### 6.2 WRAP_ALL_RECORDS_COLLECTIONS Configuration

**File**: `services/optimizedMedicalFunctions.js:116-187`

Collections that display as **document view** (not grid):

```javascript
const WRAP_ALL_RECORDS_COLLECTIONS = new Set([
  // Core medical documents
  'medications',
  'diagnoses',
  'allergies',
  'vital_signs',
  'lab_results',
  'imaging_reports',
  
  // Assessments and plans
  'clinical_decision_support',
  'medication_optimization',
  'patient_specific_care_plan',
  'treatment_plans',
  'monitoring_plans',
  
  // Discharge and summaries
  'discharge_summaries',
  'hospital_discharge_summaries',
  'consultation_notes',
  
  // Risk and predictive
  'risk_factors',
  'care_gaps',
  'outcomes_prediction',
  'intelligent_recommendations',
  
  // Specialty-specific
  'allergy_assessments',
  'asthma_assessments',
  'challenge_tests',
  'clinical_scores',
  'pulmonary_function_tests',
  
  // ... total 65+ collections
]);
```

### 6.3 Template Creation Workflow

When adding a collection to Artifact Panel, complete the **6-file checklist**:

1. **AIDocumentRenderer.jsx** - Add renderer function + routing if-statement
2. **DocumentDetailView.jsx:AI_COLLECTIONS** - Add collection name
3. **ArtifactPanel.jsx:DOCUMENT_VIEW_COLLECTIONS** - Add collection name
4. **routes/agent.js:generateDocumentPreview()** - Add case statement
5. **optimizedMedicalFunctions.js** - Add to `functionCollectionMap` + `WRAP_ALL_RECORDS_COLLECTIONS`
6. **Create template files**:
   - `templates/CollectionDocument.jsx` (React component)
   - `templates/CollectionDocument.css` (styling)
   - `pdf-templates/CollectionPDFTemplate.jsx` (PDF export)

### 6.4 Data Flow: From Collection to Artifact Panel

```
Patient clicks on "Medications" category

         ↓
Frontend: GET /api/patient/medications

         ↓
Backend: optimizedMedicalFunctions.js
• Checks functionCollectionMap['getMedications']
  → Returns 'medications' collection name
• Queries database: medications collection, patientId filter
• Checks WRAP_ALL_RECORDS_COLLECTIONS.has('medications')
  → TRUE: wrap all records

         ↓
Response:
{
  collection: 'medications',
  displayMode: 'document',  ← Document view, not grid
  data: {
    medications: [
      { name: "Metformin", dosage: "500mg", ... },
      { name: "Lisinopril", dosage: "10mg", ... },
      ...
    ]
  }
}

         ↓
Frontend: ArtifactPanel.jsx
• Receives data
• Routes to CollectionDocumentView.jsx
• Renders MedicationsDocument.jsx template
• Shows complete document with search, copy, export features
```

---

## 7. CONNECTION POOL MANAGEMENT

### 7.1 Connection Lifecycle

```
SERVICE REQUEST
      │
      ↓
DatabaseConnectionProvider.getConnection(serviceName, dbName)
      │
      ├─ Is connection cached?
      │  YES → Verify health (readyState === 1)
      │        YES → Update metadata, REUSE
      │        NO  → Create new connection
      │  NO  → Acquire from ConnectionPoolManager
      │
      ↓
connectionPoolManager.acquireConnection(dbName)
      │
      ├─ Get from pool (or create if needed)
      │
      ↓
Database operation (query, insert, update, etc.)
      │
      ↓
Connection cached for reuse
(No immediate release - persistent pool)
      │
      ├─ Idle cleanup runs every 5 minutes
      │  Remove connections idle > 5 minutes
      │
      ↓
Release back to pool or close connection
```

### 7.2 Connection Metadata Tracking

Each connection maintains:
```javascript
{
  dbName: 'intellicare_practice_yale',
  createdAt: 1666700000000,
  lastUsed: 1666700005000,
  usageCount: 42,
  usedBy: Set(['medicalFieldMappingService', 'medicalDataService']),
  idle: false,
  idleSince: null,
  readyState: 1  // 0=disconnected, 1=connected, 2=connecting
}
```

### 7.3 Performance: Connection Reuse Benefit

| Scenario | Connections Used | Time |
|----------|-----------------|------|
| First request to practice_yale | 1 (create) | 150-300ms |
| Next 10 requests to practice_yale | 1 (reuse) | 5-10ms each |
| Same request to practice_oxford | 1 (new db) | 150-300ms |
| Idle for 5+ mins, then request | 1 (reconnect) | 150-300ms |

**Result**: 95% faster subsequent requests to same practice

---

## 8. MULTI-TENANCY PATTERNS

### 8.1 Database Isolation

```
User Login: practice subdomain = "yale"

         ↓
Request context.practiceSubdomain = "yale"

         ↓
Database name: intellicare_practice_yale

         ↓
SecureDataAccess routes to yale database ONLY

         ↓
Query filtered by: { patientId: ObjectId }
(Can only see patients in yale practice)
```

### 8.2 Critical: Use practiceSubdomain, NOT practiceId

```javascript
// ✅ CORRECT - Using subdomain string
const dbIdentifier = context.practiceSubdomain;  // "yale"
const dbName = `intellicare_practice_${dbIdentifier}`;

// ❌ WRONG - Using ObjectId (broken!)
const dbIdentifier = context.practiceId;  // ObjectId("...") 
const dbName = `intellicare_practice_${dbIdentifier}`;
// Result: Database name is "intellicare_practice_ObjectId(...)"
//         → MongoDB tries to find non-existent database
```

### 8.3 Service Account Permissions (Auto-Grant for FieldMappers)

**File**: `secureDataAccess.js:553-566`

FieldMapper services automatically receive:
```javascript
{
  serviceId: 'MyServiceFieldMapper',
  apiKeyHash: 'bcrypt_hash...',
  apiKeyPrefix: 'service_...',
  active: true,
  // ON FIRST USE:
  allowedCollections: ['*'],  // All 190+ collections
  allowedOperations: {
    '*': ['insert', 'update', 'query']  // Trusted medical service
  }
}
```

**Why?** FieldMappers are trusted medical data services that need broad access.

---

## 9. KEY FILES & THEIR ROLES

| File | Lines | Purpose |
|------|-------|---------|
| `databaseConnectionProvider.js` | 174 | Singleton connection cache, reuse management |
| `secureDataAccess.js` | 1200+ | Authorization gateway, injection prevention |
| `collectionSchemas.js` | 2500+ | Schema definitions for 267 medical collections |
| `medicalCollectionsService.js` | 700+ | Master list of all 190 medical collections |
| `medicalFieldMappingService.js` | 1800+ | Routes extracted data to 190+ collections |
| `medicalDataService.js` | 800+ | Storage/retrieval interface for medical data |
| `optimizedMedicalFunctions.js` | 400+ | Function registry, WRAP_ALL_RECORDS config |
| `claudeBatchProcessor.js` | 9100+ | Document analysis schema, batch job creation |
| `generatedMedicalFunctions.js` | 8500+ | Auto-generated getters for each collection |
| `databaseFactory.js` | 400+ | Multi-tenant connection factory |

---

## 10. DATA SCHEMA EXAMPLE: MEDICATIONS

### 10.1 Extraction (Claude Input Schema)

```javascript
// From claudeBatchProcessor.js
medications: {
  type: "array",
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "Medication name" },
      genericName: { type: "string" },
      dosage: { type: "string" },
      frequency: { type: "string" },
      route: { type: "string", enum: ["oral", "IV", "topical", ...] },
      startDate: { type: "string", format: "date" },
      endDate: { type: "string", format: "date" },
      prescriber: { type: "string" },
      indication: { type: "string" },
      active: { type: "boolean" }
    }
  }
}
```

### 10.2 Storage (Collection Schema)

```javascript
// From collectionSchemas.js
'medications': {
  _id: { type: 'ObjectId', auto: true },
  patientId: { type: 'ObjectId', required: true },
  documentId: { type: 'string', required: false },
  createdAt: { type: 'Date', auto: true },
  updatedAt: { type: 'Date', auto: true },
  source: { type: 'string', default: 'document_analysis' },
  
  // Medication-specific fields
  name: { type: 'string', required: true },
  genericName: { type: 'string', required: false },
  dosage: { type: 'string', required: false },
  frequency: { type: 'string', required: false },
  route: { type: 'string', default: 'oral' },
  startDate: { type: 'Date', required: false },
  endDate: { type: 'Date', required: false },
  prescriber: { type: 'string', required: false },
  indication: { type: 'string', required: false },
  drugInteractions: { type: 'object', required: false },
  safetyWarning: { type: 'string', required: false },
  active: { type: 'boolean', default: true }
}
```

### 10.3 Query Example

```javascript
// GET /api/patient/:patientId/medications

const context = {
  serviceId: 'medical-data-service',
  apiKey: this.serviceToken,
  operation: 'getMedications',
  practiceSubdomain: 'yale',
  practiceId: practiceId
};

const medications = await SecureDataAccess.query(
  'medications',
  { patientId: new ObjectId(patientId) },
  { sort: { startDate: -1 } },
  context
);

// Returns: Array of medication documents
[
  {
    _id: ObjectId("..."),
    patientId: ObjectId("..."),
    name: "Metformin",
    dosage: "500mg",
    frequency: "twice daily",
    active: true,
    createdAt: Date,
    ...
  },
  ...
]
```

---

## 11. CRITICAL RULES & PATTERNS

### 11.1 Database Access Rules

1. **ALWAYS use SecureDataAccess** - Never direct Mongoose/MongoDB access
2. **Use practiceSubdomain, NOT practiceId** - For database routing
3. **Pass context object** - Required for authentication/authorization
4. **Validate input** - Even though SecureDataAccess validates, be defensive

### 11.2 Service Registration Rules

1. **Create KMS key** - `SERVICE_MY_SERVICE_KEY` (with underscores)
2. **Create ServiceAccount** - In `intellicare_practice_global` database
3. **For FieldMappers** - Permissions auto-grant on first use
4. **For other services** - Manually configure `allowedCollections` and `allowedOperations`

### 11.3 Field Extraction Rules

1. **Check universalFieldsToExclude** - Don't duplicate cross-cutting data
2. **Create specialized handler** - If data needs transformation
3. **Register in medicalFieldMappingService** - Add to saveComprehensiveData()
4. **Update collectionSchemas.js** - Add field definitions
5. **Register collection** - Add to medicalCollectionsService.allCollections

### 11.4 Artifact Panel Rules

1. **Add to functionCollectionMap** - Maps function name → collection
2. **Add to WRAP_ALL_RECORDS_COLLECTIONS** - For document view (not grid)
3. **Create 6 template files** - React, CSS, PDF
4. **Add to AI_COLLECTIONS** - In DocumentDetailView.jsx
5. **Add to DOCUMENT_VIEW_COLLECTIONS** - In ArtifactPanel.jsx
6. **Add case in generateDocumentPreview()** - In routes/agent.js

---

## 12. PERFORMANCE CHARACTERISTICS

### 12.1 Query Performance

| Query Type | Collections | Speed | Notes |
|-----------|------------|-------|-------|
| Single patient, one collection | medications | <10ms | Indexed by patientId |
| Single patient, all collections | 190 | <2s | Parallel queries with Promise.all |
| Multiple patients, one collection | medications | <50ms | Indexed by patientId + batch query |
| Aggregation (trending) | lab_results | <100ms | Using $match → $sort → $group |
| Text search | consultation_notes | <200ms | Using $text index |

### 12.2 Caching Strategy

1. **Connection pooling**: 95% faster subsequent requests
2. **Service account cache**: 5-minute TTL
3. **Collection metadata**: Cached in patient.medicalData
4. **Function registry**: In-memory, loaded at startup

---

## 13. SUMMARY: THE COMPLETE PICTURE

```
LAYER 1: GLOBAL INFRASTRUCTURE
└─ Database: intellicare_practice_global
   └─ Practices, ServiceAccounts, Users, Billing, Webhooks

LAYER 2: MULTI-TENANT PRACTICE DATABASES
├─ Database: intellicare_practice_{subdomain}
├─ Collections:
│  ├─ Users (practice staff)
│  ├─ Patients (demographics)
│  └─ 190+ Medical Collections
│     ├─ unified_medical_documents (complete docs for Artifact Panel)
│     └─ Granular collections (fast queries)

LAYER 3: SECURE DATA ACCESS
├─ SecureDataAccess gateway (all access through here)
├─ Connection pooling (reuse for performance)
├─ Authorization checks (API keys, permissions)
└─ Audit logging (compliance)

LAYER 4: MEDICAL DATA EXTRACTION
├─ Claude Batch API (1M token analysis)
├─ Field mapping services (22 specialties)
└─ Dual-path storage:
   ├─ Unified documents (doctor review)
   └─ Granular collections (fast queries)

LAYER 5: FRONTEND ARTIFACT PANEL
├─ Document rendering (templates, CSS, PDF)
├─ Collection-aware display (document vs grid)
└─ Search, copy, export functionality
```

---

## QUICK REFERENCE

**Want to...**

Add a new medical collection?
→ See section 5.2, Step 4: Register in medicalCollectionsService.js

Query patient medications?
→ See section 10.3: Use SecureDataAccess.query()

Create an Artifact Panel template?
→ See section 6.3: 6-file checklist

Debug database issues?
→ Check DatabaseConnectionProvider logs, verify practiceSubdomain, validate ServiceAccount

Add a new specialty field mapper?
→ Create subclass of MedicalFieldMappingService, register in medicalFieldMappingService.js line 28-52

Understand multi-tenancy?
→ See section 8: practiceSubdomain is key to isolation

---

**Last Updated**: October 2025
**Total Collections**: 190+ (67+ templates, 34+ task files, developing)
**Database Strategy**: Two-path (unified + granular) for completeness + performance
**Security**: 10-layer validation, all access through SecureDataAccess
