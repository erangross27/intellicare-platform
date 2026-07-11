# Two-Path Architecture Implementation Checkpoint

**Date Started:** October 9, 2025
**Goal:** Replace category collections with single `unified_medical_documents` collection

---

## Architecture Overview

### Path 1: Unified Medical Documents (NEW)
**Collection:** `unified_medical_documents`
- **Purpose:** Complete self-contained documents for doctor review
- **Contains:** Patient demographics + ALL extracted data + ALL AI insights
- **Size:** ~40-50KB per document (0.3% of 16MB limit)
- **Key:** Each extraction = ONE new document (never append)

### Path 2: Granular Collections (KEEP ALL ~190)
**Collections:** medications, allergies, lab_results, vital_signs, procedures, diagnoses, clinical_decision_support, intelligent_recommendations, care_gaps, etc.
- **Purpose:** Fast specific searches ("show me all medications for patient X")
- **Already working:** Handlers exist in medicalFieldMappingService.js

### What Gets REMOVED
- ❌ Category collections: cardiology_admission_notes, neurology_consultations, anesthesia_records, etc.
- ❌ additionalData field logic
- **Reason:** Replaced by unified_medical_documents

---

## Implementation Plan (10 Steps)

### ✅ Step 0: Remove exclusion list (COMPLETED)
**File:** `apps/backend-api/services/collectionSchemas.js` (lines 57-59)
- Removed: chiefComplaint, historyOfPresentIllness, physicalExamination from exclusion list
- **Result:** These fields now stay in extracted data → will go to unified document

### ✅ Step 1: Create unified_medical_documents Schema
**File:** `apps/backend-api/services/collectionSchemas.js` (line 638-650)

**Status:** COMPLETED

**Add schema:**
```javascript
'unified_medical_documents': {
  ...this.baseFields,
  patientId: { type: 'ObjectId', required: true },
  category: { type: 'string', required: true },
  documentDate: { type: 'Date', required: true },
  documentData: { type: 'object', required: true },
  source: { type: 'string', default: 'document_analysis' },
  aiProcessed: { type: 'boolean', default: true }
}
```

**Document structure example:**
```javascript
{
  _id: ObjectId("..."),
  patientId: ObjectId("68d6f5c5981efc2c18a80b47"),
  category: "cardiology_admission_notes",
  documentDate: Date("2025-01-15"),
  documentData: {
    // Patient demographics (from Patients collection)
    patientName: "Helen Cox",
    dateOfBirth: Date("1957-08-15"),
    age: "67",
    gender: "Female",
    race: "Caucasian",
    mrn: "MR-2024-001234",

    // Complete clinical document
    chiefComplaint: "Chest pain",
    historyOfPresentIllness: "...",
    physicalExamination: {
      vitalSigns: {...},
      cardiovascular: {
        findings: "S4 gallop, PMI laterally displaced",
        killipClass: "Killip Class II"
      },
      respiratory: {...}
    },

    // All medical data
    medications: [...],
    allergies: [...],
    labResults: [...],

    // Category-specific
    cardiologyAssessment: {...},

    // AI insights
    clinicalDecisionSupport: [...],
    intelligentRecommendations: [...],
    careGaps: [...],

    // Everything else
    // ...
  },
  source: "document_analysis",
  aiProcessed: true,
  createdAt: Date("2025-01-15T10:30:00Z"),
  updatedAt: Date("2025-01-15T10:30:00Z")
}
```

---

### ✅ Step 2: Add saveUnifiedDocument() Handler
**File:** `apps/backend-api/services/medicalFieldMappingService.js` (lines 1686-1735)

**Status:** COMPLETED

**Add method:**
```javascript
/**
 * Save complete unified document with patient demographics + all extracted data
 * This creates ONE self-contained document for doctor review
 */
async saveUnifiedDocument(extractedData, patientId, documentId, context) {
  try {
    // 1. Fetch patient demographics from Patients collection
    const patient = await SecureDataAccess.query(
      'Patients',
      { _id: new ObjectId(patientId) },
      { limit: 1 },
      context
    );

    const patientInfo = patient[0] || {};

    // 2. Build complete unified document
    const unifiedDocument = {
      patientId: new ObjectId(patientId),
      category: extractedData.category,
      documentDate: extractedData.date || extractedData.documentDate || new Date(),

      // documentData contains EVERYTHING (no exclusions)
      documentData: {
        // Patient demographics (from Patients collection)
        patientName: patientInfo.name || extractedData.patientName,
        dateOfBirth: patientInfo.dateOfBirth,
        age: extractedData.age || patientInfo.age,
        gender: patientInfo.gender || extractedData.gender,
        race: patientInfo.race || extractedData.race,
        ethnicity: patientInfo.ethnicity || extractedData.ethnicity,
        mrn: patientInfo.mrn || extractedData.mrn,

        // Complete extracted data (ALL fields, NO exclusions)
        ...extractedData
      },

      source: 'document_analysis',
      aiProcessed: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 3. Save to unified_medical_documents collection
    await SecureDataAccess.insert('unified_medical_documents', unifiedDocument, context);

    console.log(`✅ Saved unified document: ${extractedData.category} for patient ${patientId}`);
    return { success: true };

  } catch (error) {
    console.error('❌ Error saving unified document:', error);
    return { success: false, error: error.message };
  }
}
```

---

### ✅ Step 3: Update saveComprehensiveData() Flow
**File:** `apps/backend-api/services/medicalFieldMappingService.js` (lines 71-80)

**Status:** COMPLETED

**Change:**
1. Add saveUnifiedDocument() as FIRST call
2. Keep all existing granular handlers
3. Remove category collection saves

**New structure:**
```javascript
async saveComprehensiveData(extractedData, patientId, documentId, context) {
  const savedCollections = [];
  const errors = [];

  // === NEW: Save complete unified document FIRST ===
  const unifiedResult = await this.saveUnifiedDocument(extractedData, patientId, documentId, context);
  if (unifiedResult.success) {
    savedCollections.push('unified_medical_documents');
  } else {
    errors.push(unifiedResult.error);
  }

  // === EXISTING: Save to granular collections ===

  if (extractedData.medications) {
    const result = await this.saveMedications(...);
    if (result.success) savedCollections.push('medications');
    else errors.push(result.error);
  }

  if (extractedData.allergies) {
    const result = await this.saveAllergies(...);
    if (result.success) savedCollections.push('allergies');
    else errors.push(result.error);
  }

  // ... all other granular handlers ...

  // === REMOVE: Category collection saves ===
  // DELETE any transformData() calls
  // DELETE any saves to cardiology_admission_notes, etc.

  return {
    success: errors.length === 0,
    savedCollections,
    errors
  };
}
```

---

### ✅ Step 4: Remove Category Collection Logic
**File:** `apps/backend-api/services/medicalFieldMappingService.js` (lines 409-412)

**Status:** COMPLETED

**Removed:** Entire STEP 2 section that saved to category collections (cardiology_admission_notes, etc.)
**Replaced with:** Comment explaining deprecation and replacement by unified_medical_documents

**Search and DELETE:**
- Any references to cardiology_admission_notes
- Any references to neurology_consultations
- Any references to anesthesia_records
- Any transformData() calls for category collections
- Any additionalData saving logic

---

### ✅ Step 5: Update Backend Routes
**File:** `apps/backend-api/routes/agent.js`

**Status:** COMPLETED

**Changes made:**

1. **GET /patient/:patientId/categories** (lines 6899-6930)
   - Changed from querying patient.medicalData index to aggregating unified_medical_documents by category
   - Uses MongoDB aggregation to group documents by category and count them
   - Returns lastUpdated date from aggregation

2. **GET /patient/:patientId/category/:categoryName** (lines 7013-7033)
   - Changed from querying category collection to querying unified_medical_documents where category matches
   - Uses `documentDate` field for sorting
   - Passes `documentData` to title/preview generators

3. **GET /patient/:patientId/category/:categoryName/document/:documentId** (lines 7109-7150)
   - Changed from querying category collection to querying unified_medical_documents
   - Returns `unifiedDoc.documentData` which contains complete patient demographics + all extracted fields
   - Added category validation in query for additional security

---

### ✅ Step 6: Update Artifact Panel Components
**Files:** `apps/frontend-vite/src/components/artifact/`

**Status:** COMPLETED - NO CHANGES NEEDED

**Analysis:**
- CategoryListView.jsx - ✅ No changes needed (backend returns same data structure)
- DocumentListView.jsx - ✅ No changes needed (backend returns same data structure)
- DocumentDetailView.jsx - ✅ No changes needed (receives document.data which now contains documentData with ALL fields including patient demographics)

**Reason:** Backend routes were updated to maintain API compatibility. The response structure is identical, only the data source changed from category collections to unified_medical_documents.

---

### ✅ Step 7: Register Collection
**File:** `apps/backend-api/services/medicalCollectionsService.js` (line 20)

**Status:** COMPLETED

**Added:** `"unified_medical_documents"` to allCollections array under Core Medical Records section

---

### ✅ Step 8: Verify Extraction Schemas
**File:** `apps/backend-api/services/claudeBatchProcessor.js` (lines 2611-15500)

**Status:** COMPLETED

**Verification Results:**

All required fields already exist in extraction schema:
- ✅ chiefComplaint (line 3720) - object with complaint and duration
- ✅ historyOfPresentIllness (line 3734) - string
- ✅ physicalExamination (line 3739-3857) - comprehensive object with all body systems
- ✅ riskFactors (line 3685) - array at top level
- ✅ socialHistory (line 3558) - inside medicalHistory object
- ✅ familyHistory (line 3531) - inside medicalHistory object
- ✅ medications (line 3033) - covers currentMedications requirement
- ✅ surgicalHistory (line 3509) - inside medicalHistory object

**Changes Made:**
- ✅ Added killipClass to physicalExamination.cardiovascular (line 3774)
- ✅ Added findings field to physicalExamination.cardiovascular (line 3775)
- ✅ Kept killipClass in specialtyFields.cardiology.killipClass (line 4588) for backward compatibility

**Note:** Fields like complicationsMonitoring, dischargeInstructions, and codeStatus exist in specialty-specific sections and will be included in unified documents automatically via the spread operator (...extractedData) in saveUnifiedDocument()

---

### ✅ Step 9: Test Complete Flow
**Status:** COMPLETED

**Testing Results:**
1. ✅ Re-analyzed cardiology PDF via WebGUI
2. ✅ Verified with MongoDB MCP:
   - ✅ unified_medical_documents has ONE complete document (ID: 68e771cb35aad79c76930d5c)
     - Patient: Michael Chen (ID: 68d6f5c5981efc2c18a80b47)
     - Category: cardiology_admission_notes
     - 53 top-level fields, 1,011 total data points
   - ✅ Granular collections populated (27 collections with data)
3. ✅ Document size: ~104KB (0.65% of 16MB limit - SAFE!)
4. ✅ Artifact panel rendering works with CardiologyAdmissionDocument.jsx

---

### ✅ Step 10: Update getMedicalHistory Function
**File:** `apps/backend-api/services/medicalDataService.js` (lines 1393-1509)

**Status:** COMPLETED

**Change:** Modified `listPatientMedicalCategories()` to query ONLY unified_medical_documents

**Before:**
- Queried `patient.medicalData.collections` to get ALL 190+ granular collections
- Returned categories like "medications", "lab_results", "diagnoses", "vital_signs", etc.
- Doctors would scroll through individual collection data

**After:**
- Queries ONLY `unified_medical_documents` collection using MongoDB aggregation
- Groups by `category` field and counts documents per category
- Returns categories like "Cardiology Admission Notes", "Neurology Consultations", etc.
- Each category represents a complete unified document for doctor review

**Implementation:**
```javascript
const categoryCounts = await this._secureDataAccess.aggregate(
  'unified_medical_documents',
  [
    { $match: { patientId: patientIdObj } },
    { $group: {
        _id: '$category',
        count: { $sum: 1 },
        lastUpdated: { $max: '$documentDate' }
      }
    },
    { $project: {
        name: '$_id',
        displayName: {
          $reduce: {
            input: { $split: ['$_id', '_'] },
            initialValue: '',
            in: {
              $concat: [
                '$$value',
                { $cond: [{ $eq: ['$$value', ''] }, '', ' '] },
                { $toUpper: { $substrCP: ['$$this', 0, 1] } },
                { $substrCP: ['$$this', 1, { $strLenCP: '$$this' }] }
              ]
            }
          }
        },
        count: 1,
        lastUpdated: 1,
        _id: 0
      }
    },
    { $sort: { displayName: 1 } }
  ],
  context
);
```

**Result:**
- ✅ `getMedicalHistory` now shows ONLY unified documents
- ✅ No more scrolling through 190+ collections
- ✅ Doctors see beautiful, complete medical documents in artifact panel
- ✅ Granular collections still work for specific queries ("show me all vital signs")

---

## Progress Tracking

**Completed Steps:** 10/10 (100% Complete! 🎉)
**Current Status:** Two-Path Architecture FULLY IMPLEMENTED AND TESTED
**Last Step Completed:** Step 10 - getMedicalHistory function updated + All 4 artifact routes fixed

**Critical Fix Applied (October 9, 2025):**
- Fixed practiceId context bug in all 4 artifact panel routes
- Was passing `practiceId: 'global'` instead of `practiceId: 'yale'`
- SecureDataAccess was querying wrong database (global instead of yale)
- Now correctly passes practiceSubdomain as practiceId for database routing

**Routes Fixed:**
1. GET /patient/:patientId/categories (line 6892)
2. GET /patient/:patientId/category/:categoryName (line 7007)
3. GET /patient/:patientId/category/:categoryName/document/:documentId (line 7091)
4. GET /patient/:patientId/category/:categoryName/documents/all (line 7203, 7220)

**Testing Status:** ✅ VERIFIED - Artifact panel now displays unified medical documents correctly

**Remaining:** Build additional document renderers for other medical categories (neurology, anesthesia, surgery, etc.)

---

## Document Size Analysis

**Current:** ~10KB (incomplete data)
**Estimated Complete:** ~40-50KB
- Patient demographics: ~500 bytes
- Clinical sections: ~5KB
- Medical data: ~10KB
- Cardiology assessment: ~5KB
- AI insights: ~10KB
- Metadata: ~3KB

**Result:** ✅ SAFE - 0.3% of 16MB limit

---

## Benefits

✅ Complete document for doctor (100% of data + patient info)
✅ No 16MB risk (each doc separate)
✅ Fast searches still work (granular collections)
✅ Simpler architecture (2 paths instead of 3)
✅ Patient-centric queries easy

---

**Last Updated:** October 9, 2025 - Started implementation
