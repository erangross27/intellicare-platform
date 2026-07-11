# IntelliCare Architecture - Visual Diagrams

## 1. Multi-Tenant Database Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                    INTELLICARE PLATFORM                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ GLOBAL DATABASE: intellicare_practice_global              │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                            │  │
│  │ ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │ │  Practices  │  │ ServiceAccts │  │ Users (Admins)   │  │  │
│  │ └─────────────┘  └──────────────┘  └──────────────────┘  │  │
│  │ ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │  │
│  │ │ Billing  │  │Webhooks  │  │  Audit   │  │ Compliance│  │  │
│  │ └──────────┘  └──────────┘  └──────────┘  └───────────┘  │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                    ┌─────────┴──────────┬──────────┐              │
│                    │                    │          │              │
│  ┌─────────────────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Practice: yale          │  │ Practice:    │  │ Practice:  │  │
│  │ intellicare_practice_   │  │ oxford       │  │ stanford   │  │
│  │ yale                    │  │              │  │            │  │
│  ├─────────────────────────┤  ├──────────────┤  ├────────────┤  │
│  │ • Users                 │  │ • Users      │  │ • Users    │  │
│  │ • Patients              │  │ • Patients   │  │ • Patients │  │
│  │ • 190+ Collections:     │  │ • 190+       │  │ • 190+     │  │
│  │   - medications          │  │   Collections│  │  Collections│ │
│  │   - diagnoses            │  │              │  │            │  │
│  │   - lab_results          │  │              │  │            │  │
│  │   - allergies            │  │              │  │            │  │
│  │   - imaging_reports      │  │              │  │            │  │
│  │   - vital_signs          │  │              │  │            │  │
│  │   - unified_medical_     │  │              │  │            │  │
│  │     documents            │  │              │  │            │  │
│  │   ... 183 more           │  │              │  │            │  │
│  │                         │  │              │  │            │  │
│  │ Patient Count: 50       │  │              │  │            │  │
│  │ Medical Collections: 33 │  │              │  │            │  │
│  │ with data              │  │              │  │            │  │
│  └─────────────────────────┘  └──────────────┘  └────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## 2. Two-Path Architecture (Dual-Path Data Storage)

```
                    DOCUMENT UPLOAD & ANALYSIS
                              │
                              ↓
                 ┌────────────────────────┐
                 │  Claude Batch API      │
                 │  (1M token context)    │
                 │  Extracts medical data │
                 └────────────┬───────────┘
                              │
                    ┌─────────┴──────────┐
                    │                    │
        ┌───────────▼──────────┐  ┌─────▼──────────────┐
        │   PATH 1: UNIFIED    │  │  PATH 2: GRANULAR  │
        │   DOCUMENTS          │  │  COLLECTIONS       │
        ├──────────────────────┤  ├────────────────────┤
        │ Collection:          │  │ Collections:       │
        │ unified_medical_     │  │ • medications (1)  │
        │ documents            │  │ • diagnoses (1)    │
        │                      │  │ • lab_results (1)  │
        │ ONE doc per          │  │ • allergies (1)    │
        │ analysis             │  │ • imaging (1)      │
        │                      │  │ • vital_signs (1)  │
        │ Purpose:             │  │ ... N collections  │
        │ • Complete context   │  │                    │
        │ • Doctor review      │  │ Purpose:           │
        │ • Full narrative     │  │ • Fast queries     │
        │ • All medical data   │  │ • One type = 1 sec │
        │ • 40-50KB size       │  │ • Normalized data  │
        │                      │  │ • Easy filtering   │
        │ Usage:               │  │                    │
        │ Artifact Panel       │  │ Usage:             │
        │ (Document View)      │  │ Frontend queries   │
        │                      │  │ (medication list)  │
        │                      │  │                    │
        └──────────┬───────────┘  └────────┬──────────┘
                   │                       │
                   └───────────┬───────────┘
                               │
                               ↓
                    ┌────────────────────┐
                    │ Patient.medicalData│
                    │ Cache/Metadata     │
                    │ (collection counts)│
                    └────────────────────┘
```

## 3. Data Flow: Document Analysis to Artifact Panel

```
PHASE 1: DOCUMENT UPLOAD & EXTRACTION
═════════════════════════════════════

Doctor uploads PDF document
         │
         ↓
┌─────────────────────────────────────┐
│ claudeBatchProcessor.js             │
│ • Reads PDF                         │
│ • Creates batch job request         │
│ • Defines 67-field extraction schema│
│ • Sets 1M token limit               │
└────────────┬────────────────────────┘
             │
             ↓
    ┌────────────────────┐
    │ Claude Batch Job   │
    │ (queued/processing)│
    └────────────┬───────┘
                 │
                 ↓
         ┌──────────────┐
         │ Extract Data │
         │ (1M context) │
         └────────┬─────┘
                  │
                  ↓
         ┌──────────────────────┐
         │ Structured JSON      │
         │ (all 67 fields)      │
         └────────┬─────────────┘


PHASE 2: DATA MAPPING & STORAGE
════════════════════════════════

         ┌──────────────────────┐
         │ medicalFieldMapping  │
         │ Service.saveCompre   │
         │ hensiveData()        │
         └──────────┬───────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ↓                       ↓
   ┌─────────┐          ┌──────────┐
   │ Unified │          │ Granular │
   │ Save    │          │ Save     │
   └────┬────┘          └────┬─────┘
        │                    │
        ↓                    ↓
   unified_medical_    → medications
   documents          → diagnoses
        ↓             → lab_results
        │             → allergies
        │             → imaging_reports
        │             → vital_signs
        │             → 184+ more
        │                    │
        └────────┬───────────┘
                 │
                 ↓
         ┌──────────────────┐
         │ Update Patient   │
         │ medicalData      │
         │ Cache            │
         └──────────────────┘


PHASE 3: FRONTEND RETRIEVAL & DISPLAY
══════════════════════════════════════

Patient navigates to Artifact Panel
         │
         ↓
┌──────────────────────────────────┐
│ DocumentDetailView.jsx           │
│ Shows medical categories list    │
│ (medications, allergies, etc.)   │
└────────────┬─────────────────────┘
             │ User clicks "Medications"
             ↓
┌──────────────────────────────────┐
│ API: GET /api/patient/:id/       │
│      medications                 │
└────────────┬─────────────────────┘
             │
             ↓
┌──────────────────────────────────────┐
│ Backend: optimizedMedicalFunctions   │
│                                      │
│ 1. Check functionCollectionMap       │
│    getMedications → 'medications'    │
│                                      │
│ 2. Query medications collection      │
│    patientId = :id                  │
│                                      │
│ 3. Check WRAP_ALL_RECORDS            │
│    'medications' = YES               │
│                                      │
│ 4. Wrap results:                     │
│    { medications: [...] }            │
└────────────┬─────────────────────────┘
             │
             ↓
┌──────────────────────────────────────┐
│ Response:                            │
│ {                                    │
│   collection: 'medications',         │
│   displayMode: 'document',           │
│   data: {                            │
│     medications: [...]               │
│   }                                  │
│ }                                    │
└────────────┬─────────────────────────┘
             │
             ↓
┌──────────────────────────────────────┐
│ Frontend: ArtifactPanel.jsx          │
│                                      │
│ 1. Receives displayMode='document'   │
│                                      │
│ 2. Routes to CollectionDocumentView  │
│                                      │
│ 3. Renders MedicationsDocument.jsx   │
│    template                          │
└────────────┬─────────────────────────┘
             │
             ↓
┌──────────────────────────────────────┐
│ DISPLAYED TO DOCTOR:                 │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ MEDICATIONS                      │ │
│ ├──────────────────────────────────┤ │
│ │ [Search box]                     │ │
│ │                                  │ │
│ │ ┌────────────────────────┐       │ │
│ │ │ Metformin 500mg        │[Copy]│ │
│ │ │ Twice daily, PO        │      │ │
│ │ │ Active since 2023      │      │ │
│ │ └────────────────────────┘       │ │
│ │                                  │ │
│ │ ┌────────────────────────┐       │ │
│ │ │ Lisinopril 10mg        │[Copy]│ │
│ │ │ Once daily, PO         │      │ │
│ │ │ Active since 2022      │      │ │
│ │ └────────────────────────┘       │ │
│ │                                  │ │
│ │ [Copy All] [Export PDF]          │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

## 4. SecureDataAccess Security Validation Pipeline

```
APPLICATION REQUEST
        │
        ↓
┌─────────────────────────────────────┐
│ SecureDataAccess.query()            │
│ (or insert/update/delete/aggregate) │
└────────────────┬────────────────────┘
                 │
        ┌────────┴────────────┐
        │                     │
        ↓                     ↓
   SECURITY              DATA
   CHECKS                FILTERS


SECURITY CHECKS (10 layers):
════════════════════════════

┌─ 1. SERVICE AUTHENTICATION
│   └─ Validate API key via ServiceAccount (3 minutes cache)
│
├─ 2. SERVICE BLOCKING
│   └─ Is service in blockedServices set?
│
├─ 3. COLLECTION AUTHORIZATION
│   └─ Does service have permission for this collection?
│
├─ 4. MONGOOSE OBJECT DETECTION
│   └─ Reject if query contains Mongoose metadata
│
├─ 5. PROTOTYPE POLLUTION CHECK
│   └─ Prevent __proto__ and constructor attacks
│
├─ 6. AGGREGATION PIPELINE VALIDATION
│   └─ Check if operators ($match, $project, etc.) are safe
│
├─ 7. SQL/NOSQL INJECTION PREVENTION
│   └─ Validate ID patterns, block SQL keywords
│
├─ 8. MONGODB OPERATOR VALIDATION
│   └─ Allowed: $eq, $ne, $gt, $in, $and, $or, etc.
│   └─ Restricted: $regex (with safety checks), $text
│   └─ Blocked: $where, $function, $accumulator
│
├─ 9. FIELD MASKING
│   └─ Hide sensitive fields based on service permissions
│
└─ 10. AUDIT LOGGING
    └─ Log all data access for HIPAA compliance


DATA FILTERS:
══════════════

┌─ PRACTICE ISOLATION
│  └─ Only return data from service's practice database
│     (multi-clinic queries supported)
│
├─ ROW-LEVEL SECURITY
│  └─ Apply additional filter based on service policy
│     (e.g., only view data for assigned patients)
│
└─ FIELD PROJECTION
   └─ Only return allowed fields based on service role
      (e.g., nurse can see vitals, not financial data)


RESULT:
═══════

        ↓
   MASKED & FILTERED DATA
   (safe, authorized, audited)
```

## 5. Connection Pool Lifecycle

```
SERVICE REQUEST FOR 'yale' DATABASE
        │
        ↓
DatabaseConnectionProvider.getConnection('medicalService', 'intellicare_practice_yale')
        │
        ├─ Is 'intellicare_practice_yale' cached?
        │
        ├─ YES → Check health (readyState === 1)
        │  ├─ HEALTHY → Update metadata, REUSE
        │  │   ├─ usageCount++
        │  │   ├─ lastUsed = now
        │  │   └─ usedBy.add('medicalService')
        │  │   └─ Return connection (5-10ms)
        │  │
        │  └─ UNHEALTHY → Delete & create new
        │
        └─ NO → Acquire from ConnectionPoolManager
                ├─ Create new Mongoose connection
                ├─ Set max listeners = 50
                ├─ Wait for 'connected' event
                ├─ Store metadata
                └─ Return connection (150-300ms first time)
                      │
                      ↓
        ┌────────────────────────────────────┐
        │ METADATA TRACKED:                  │
        │ • dbName                           │
        │ • createdAt                        │
        │ • lastUsed (updates on each use)   │
        │ • usageCount                       │
        │ • usedBy = Set of service names    │
        │ • readyState                       │
        │ • idle/idleSince                   │
        └────────────────────────────────────┘
                      │
                      ↓
        ┌────────────────────────────────────┐
        │ DATABASE OPERATION                 │
        │ (query, insert, update, etc.)      │
        └────────────────┬───────────────────┘
                         │
                         ↓
        CONNECTION REMAINS CACHED
        (available for reuse by ANY service)
                         │
                         ↓
        ┌─────────────────────────────────────────┐
        │ IDLE CLEANUP (runs every 5 minutes)    │
        ├─────────────────────────────────────────┤
        │ For each cached connection:             │
        │ • Check idle time (now - lastUsed)      │
        │ • If idle > 5 minutes:                  │
        │   - Mark metadata.idle = true           │
        │   - Next cleanup removes & releases     │
        │ • Otherwise: keep alive                 │
        └─────────────────────────────────────────┘
                         │
                         ↓
        EITHER: Connection reused (95% faster)
        OR:     Connection removed & reopened
```

## 6. Collection Organization Hierarchy

```
UNIFIED_MEDICAL_DOCUMENTS
└─ Complete documents (40-50KB each)
   └─ Doctor review in Artifact Panel


GRANULAR COLLECTIONS (190+)
├─ CORE MEDICAL (20)
│  ├─ medications
│  ├─ diagnoses
│  ├─ allergies
│  ├─ lab_results
│  ├─ imaging_reports
│  ├─ vital_signs
│  ├─ prescriptions
│  ├─ consultation_notes
│  ├─ discharge_summaries
│  └─ ... 10 more
│
├─ HOSPITAL & EMERGENCY (6)
│  ├─ hospital_admission_notes
│  ├─ emergency_discharge_summaries
│  ├─ icu_flow_sheets
│  ├─ nursing_notes
│  ├─ treatment_courses
│  └─ transfer_summaries
│
├─ SPECIALTY DEPARTMENTS (130+)
│  ├─ CARDIOLOGY (5)
│  │  ├─ cardiology_consultations
│  │  ├─ ecg_reports
│  │  ├─ echo_reports
│  │  ├─ stress_test_reports
│  │  └─ cardiac_catheterization_reports
│  │
│  ├─ NEUROLOGY (4)
│  │  ├─ neurology_consultations
│  │  ├─ eeg_reports
│  │  ├─ emg_reports
│  │  └─ neuropsychological_assessments
│  │
│  ├─ PSYCHIATRY (5)
│  ├─ PEDIATRICS (7)
│  ├─ OB/GYN (9)
│  ├─ ONCOLOGY (8)
│  ├─ NEPHROLOGY (12)
│  ├─ PULMONOLOGY (8)
│  ├─ ALLERGY/IMMUNOLOGY (6)
│  ├─ GASTROENTEROLOGY (11)
│  └─ ... 10+ more specialties
│
└─ AI INTELLIGENCE (10)
   ├─ clinical_decision_support
   ├─ intelligent_recommendations
   ├─ medication_optimization
   ├─ care_gaps
   ├─ outcomes_prediction
   ├─ patient_specific_care_plan
   ├─ treatment_plans
   ├─ monitoring_plans
   ├─ trending_analysis
   └─ guideline_compliance
```

## 7. Artifact Panel: Document vs Grid Display

```
COLLECTION QUERY RESULT
        │
        ↓
WRAP_ALL_RECORDS_COLLECTIONS.has(collectionName)?
        │
        ├─ YES (medications, diagnoses, etc.)
        │  │
        │  ├─ Wrap all records in single document:
        │  │  { medications: [record1, record2, ...] }
        │  │
        │  ├─ Set displayMode = 'document'
        │  │
        │  └─ Render with TEMPLATE FILE:
        │     ├─ MedicationsDocument.jsx
        │     ├─ DiagnosesDocument.jsx
        │     ├─ etc.
        │     │
        │     └─ Template displays:
        │        ├─ Search bar
        │        ├─ All records in scrollable list
        │        ├─ Copy button per record
        │        ├─ Copy All button
        │        └─ Export PDF
        │
        └─ NO (other collections)
           │
           ├─ Return array of individual records
           │
           ├─ Set displayMode = 'grid'
           │
           └─ Render in TABLE format:
              ├─ Columns for each field
              ├─ Rows for each record
              ├─ Filter & sort options
              └─ No custom template needed


TEMPLATE FILES (6 per collection):
═══════════════════════════════════

1. AIDocumentRenderer.jsx
   └─ Add if-statement routing to template

2. DocumentDetailView.jsx
   └─ Add to AI_COLLECTIONS array

3. ArtifactPanel.jsx
   └─ Add to DOCUMENT_VIEW_COLLECTIONS array

4. routes/agent.js
   └─ Add case to generateDocumentPreview()

5. optimizedMedicalFunctions.js
   └─ Add to functionCollectionMap + WRAP_ALL_RECORDS

6. Template files:
   ├─ templates/CollectionDocument.jsx
   ├─ templates/CollectionDocument.css
   └─ pdf-templates/CollectionPDFTemplate.jsx
```

## 8. Service Account Permission Levels

```
SERVICE AUTHENTICATION FLOW:
════════════════════════════

API Request with "Bearer service_abc123..."
        │
        ↓
SecureDataAccess.validateServiceAccount(context)
        │
        ├─ Extract API key from context
        │
        ├─ Check cache (5-minute TTL)
        │
        ├─ If not cached:
        │  └─ Query intellicare_practice_global.ServiceAccount
        │     └─ Find document with matching apiKeyPrefix
        │     └─ Compare full key via bcrypt.compare()
        │
        ├─ Retrieved ServiceAccount document:
        │  ├─ serviceId
        │  ├─ apiKeyHash (bcrypt)
        │  ├─ apiKeyPrefix
        │  ├─ active (boolean)
        │  ├─ allowedCollections ([] or '*')
        │  ├─ allowedOperations (default for FieldMappers)
        │  └─ createdAt/updatedAt
        │
        ├─ Cache result (5 minutes)
        │
        └─ Return ServiceAccount or null


PERMISSION MODELS:
══════════════════

FIELDMAPPER SERVICES (auto-grant on first use):
├─ allowedCollections: ['*']  ← All 190+ collections
├─ allowedOperations: {
│  '*': ['insert', 'update', 'query']  ← Trusted services
│  }
└─ Reason: Medical data extraction needs broad access


REGULAR SERVICES (manual configuration):
├─ allowedCollections: ['medications', 'lab_results']
├─ allowedOperations: {
│  'medications': ['query'],           ← Read-only
│  'lab_results': ['query', 'update']  ← Read & update
│  }
└─ Reason: Principle of least privilege


MONITORING/ADMIN SERVICES:
├─ allowedCollections: ['*']  ← All collections
├─ allowedOperations: {
│  '*': ['query', 'aggregate']  ← Read & analytics only
│  }
└─ Reason: Need broad visibility but no write permissions
```

---

## Performance Metrics Summary

```
QUERY PERFORMANCE:
═══════════════════

Single patient, one collection:
  └─ <10ms  (indexed by patientId)

Single patient, all collections:
  └─ <2s    (parallel queries with Promise.all)

Multiple patients, one collection:
  └─ <50ms  (batch query with index)

Aggregation (trending):
  └─ <100ms (using $match → $sort → $group)

Text search:
  └─ <200ms (using $text index)


CONNECTION REUSE:
═════════════════

First request to practice:
  └─ 150-300ms (new connection, authentication)

Next 10 requests (cached):
  └─ 5-10ms each  (reused connection)

After 5+ minutes idle:
  └─ 150-300ms (reconnect)

RESULT: 95% FASTER SUBSEQUENT REQUESTS
```

