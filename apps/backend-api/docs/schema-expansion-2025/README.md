# Schema Expansion Tasks - October 2025

## Overview

This folder contains tasks for adding 18 missing medical extraction schemas to support all PDF templates in `/home/erangross/Documents/English medical termplates/`.

**Current Coverage:** 72/90 templates (80%)
**Target:** 90/90 templates (100%)

## Implementation Phases

### Phase 1: Critical Clinical Data (PRIORITY)
High clinical impact, frequently used, rich medical data:

1. ✅ **Task 01** - Addiction Medicine Consultations (OUD treatment)
2. ✅ **Task 02** - Brain Tumor Molecular Markers (precision oncology)
3. ✅ **Task 03** - Biologic Therapy Records (specialty medications)
4. ✅ **Task 04** - Wound Care Assessments (diabetic limb salvage)
5. ✅ **Task 05** - Podiatry Examinations (diabetic foot screening)
6. ✅ **Task 06** - Enhanced Neuropsychological Assessments

### Phase 2: Specialized Testing
Moderate clinical impact, specialized use cases:

7. ⏳ **Task 07** - Advanced Neuroimaging (fMRI, DTI tractography)
8. ⏳ **Task 08** - Comprehensive Pulmonary Function Tests
9. ⏳ **Task 09** - Nuclear Medicine Studies
10. ⏳ **Task 10** - Cardiac Device Interrogations

### Phase 3: Care Coordination
Important for care quality, lower clinical urgency:

11. ⏳ **Task 11** - Social Determinants of Health
12. ⏳ **Task 12** - Enhanced Discharge Planning
13. ⏳ **Task 13** - Medication Access Programs
14. ⏳ **Task 14** - Biomarker Trending Analysis
15. ⏳ **Task 15** - STEMI-Specific Metrics

### Phase 4: Administrative/Quality
Quality improvement, reporting, niche use cases:

16. ⏳ **Task 16** - Clinical Risk Scores
17. ⏳ **Task 17** - Quality Metrics Tracking
18. ⏳ **Task 18** - Sports Medicine & Occupational Medicine

## Task File Format

Each task file (`task-XX-name.md`) contains:

- **Clinical Context** - Why this data matters
- **Schema Definition** - Exact JSON schema for claudeBatchProcessor.js
- **Collection Schema** - Fields for collectionSchemas.js
- **Registration Steps** - How to register the new collection
- **Testing Instructions** - How to verify extraction works
- **Safety Checks** - How to avoid breaking existing schemas

## Implementation Workflow

For each task:

1. **Read task file thoroughly**
2. **Back up files before changes:**
   ```bash
   cp apps/backend-api/services/claudeBatchProcessor.js apps/backend-api/services/claudeBatchProcessor.js.backup
   cp apps/backend-api/services/models/collectionSchemas.js apps/backend-api/services/models/collectionSchemas.js.backup
   ```

3. **Make changes incrementally** (one schema at a time)

4. **Test after each change:**
   ```bash
   # Syntax check
   node -c apps/backend-api/services/claudeBatchProcessor.js

   # Schema validation
   node apps/backend-api/scripts/verifyDataExtractionAutoWithCache.js --no-cache
   ```

5. **Verify MongoDB data:**
   ```bash
   MONGO_URI=$(cat apps/backend-api/.kms/MONGODB_ADMIN_URI)
   mongosh "$MONGO_URI" --quiet --eval "
     db = db.getSiblingDB('intellicare_practice_yale');
     print('New collection count: ' + db.NEW_COLLECTION_NAME.countDocuments());
   "
   ```

6. **Mark task complete** and move to next

## Critical Safety Rules

### ⚠️ DO NOT:
- Modify existing extraction functions (saveMedicationsData, saveDiagnosesData, etc.)
- Change existing collection names
- Remove any existing fields from schemas
- Modify line numbers outside your target range
- Make multiple schema changes simultaneously

### ✅ DO:
- Add new extraction functions at the end of getDocumentAnalysisTools()
- Use unique collection names
- Test each schema independently
- Keep backups of original files
- Follow 6-step checklist for each task

## 6-Step Implementation Checklist

For each new schema:

1. **Schema Definition** (`claudeBatchProcessor.js` lines 1700-9100)
   - Add new extraction function to getDocumentAnalysisTools()
   - Define input_schema with all fields

2. **Collection Schema** (`collectionSchemas.js`)
   - Add collection with field definitions

3. **Handler (if needed)** (`medicalFieldMappingService.js` lines 100-400)
   - Only if custom processing required (risk scoring, calculations)

4. **Registration** (`medicalCollectionsService.js`)
   - Add to allCollections array

5. **Universal Fields Exclusion** (if applicable)
   - Add to universalFieldsToExclude if collection shouldn't inherit meds/diagnoses

6. **Required Array** (AI-generated fields ONLY)
   - Add to REQUIRED_FUNCTIONS_FOR_DOCUMENT (line 14789) if AI-generated, NOT extracted

## File Locations

- **Extraction Schemas:** `apps/backend-api/services/claudeBatchProcessor.js`
- **Collection Schemas:** `apps/backend-api/services/models/collectionSchemas.js`
- **Field Mapping:** `apps/backend-api/services/medicalFieldMappingService.js`
- **Collection Registry:** `apps/backend-api/services/medicalCollectionsService.js`
- **Sample PDFs:** `/home/erangross/Documents/English medical termplates/`

## Testing Strategy

1. **Incremental Testing** - Test after EACH schema addition
2. **Isolation** - Only test the NEW collection, don't re-test all 191 collections
3. **Specific PDF** - Use the corresponding PDF template for that schema
4. **Quick Validation:**
   ```bash
   # Check collection exists
   mongosh "$MONGO_URI" --eval "db = db.getSiblingDB('intellicare_practice_yale'); db.getCollectionNames().filter(c => c.includes('NEW_COLLECTION'))"

   # Check document count
   mongosh "$MONGO_URI" --eval "db = db.getSiblingDB('intellicare_practice_yale'); db.NEW_COLLECTION.countDocuments()"

   # Check sample document
   mongosh "$MONGO_URI" --eval "db = db.getSiblingDB('intellicare_practice_yale'); printjson(db.NEW_COLLECTION.findOne())"
   ```

## Progress Tracking

**Phase 1:** 0/6 complete (0%)
**Phase 2:** 0/4 complete (0%)
**Phase 3:** 0/5 complete (0%)
**Phase 4:** 0/3 complete (0%)

**Overall:** 0/18 complete (0%)

Update this section as tasks are completed.

## Success Criteria

✅ All 18 schemas implemented
✅ All 90 PDF templates have extraction coverage
✅ No existing schemas broken
✅ MongoDB collections created successfully
✅ Sample extractions validated for each new schema
✅ Unified documents include new sections
✅ No errors in claudeBatchProcessor.js syntax
✅ All tests pass

## Questions?

See main analysis: `/home/erangross/Development/IntelliCare/TEMPLATE-SCHEMA-ANALYSIS.md`
See CLAUDE.md: `/home/erangross/Development/IntelliCare/CLAUDE.md`
