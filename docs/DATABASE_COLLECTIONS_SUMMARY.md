# IntelliCare Database Collections Summary
**Date:** October 10, 2025
**Database:** intellicare_practice_yale

## Overview

**Total Medical Collections:** 32 collections with data
**Total Medical Documents:** 232 documents
**Backend Formatters:** 19 formatters (50% coverage)

## Collections by Category

### ✅ Collections WITH Backend Formatters (16/32 - 50%)

| Collection Name | Documents | Formatter | Status |
|----------------|-----------|-----------|--------|
| imagingreports | 29 | imaging_reports.js | ✅ |
| medication_optimization | 17 | medication_optimization.js | ✅ |
| medicalprocedures | 16 | procedures.js | ✅ |
| labresults | 14 | lab_results.js | ✅ |
| vitalsigns | 12 | vital_signs.js | ✅ |
| medications | 8 | medications.js | ✅ |
| diagnoses | 5 | diagnoses.js | ✅ |
| dischargesummaries | 2 | hospital_discharge_summaries.js | ✅ |
| outcomes_prediction | 1 | outcomes_prediction.js | ✅ |
| trending_analysis | 1 | trending_analysis.js | ✅ |
| patient_specific_care_plan | 1 | patient_specific_care_plan.js | ✅ |
| intelligent_recommendations | 1 | intelligent_recommendations.js | ✅ |
| follow_up_intelligence | 1 | follow_up_intelligence.js | ✅ |
| patient_education_context | 1 | patient_education_context.js | ✅ |
| clinical_decision_support | 1 | clinical_decision_support.js | ✅ |
| guideline_compliance | 1 | guideline_compliance.js | ✅ |

**Subtotal:** 110 documents covered by formatters

### ❌ Collections MISSING Backend Formatters (16/32 - 50%)

| Collection Name | Documents | Priority | Notes |
|----------------|-----------|----------|-------|
| **riskfactors** | **66** | **HIGH** | Most documents, no formatter |
| **consultationnotes** | **14** | **HIGH** | Many documents |
| **medicalhistory** | **12** | **HIGH** | Important data |
| **intraoperative_records** | **6** | **MEDIUM** | Surgical data |
| **psychosocial_assessments** | **6** | **MEDIUM** | Mental health |
| **reminders** | 5 | MEDIUM | Follow-up tracking |
| **follow_up_appointments** | 3 | LOW | Scheduling data |
| pendinguploads | 1 | LOW | Temporary |
| quality_metrics | 1 | LOW | Analytics |
| history_present_illness | 1 | LOW | Clinical notes |
| treatment_courses | 1 | LOW | Treatment plans |
| emergency_information | 1 | LOW | Emergency contacts |
| care_gaps | 1 | LOW | Quality measure |
| test_vectors | 1 | LOW | Testing data |
| costtrackings | 1 | LOW | Billing |
| administrative_data | 1 | LOW | Admin records |

**Subtotal:** 122 documents WITHOUT formatters

### 📋 Formatters WITHOUT Data (3/19 - 16%)

These formatters exist but have no matching data in the database yet:

1. **allergies.js** - 0 documents (but important for future)
2. **anesthesia_records.js** - 0 documents (intraoperative_records exists instead)
3. **cardiology_admission_notes.js** - 0 documents (future cardiology docs)

## Top Collections by Document Count

1. **riskfactors** - 66 documents ❌ NO FORMATTER
2. **imagingreports** - 29 documents ✅ HAS FORMATTER
3. **medication_optimization** - 17 documents ✅ HAS FORMATTER
4. **medicalprocedures** - 16 documents ✅ HAS FORMATTER
5. **labresults** - 14 documents ✅ HAS FORMATTER
6. **consultationnotes** - 14 documents ❌ NO FORMATTER
7. **medicalhistory** - 12 documents ❌ NO FORMATTER
8. **vitalsigns** - 12 documents ✅ HAS FORMATTER
9. **medications** - 8 documents ✅ HAS FORMATTER
10. **intraoperative_records** - 6 documents ❌ NO FORMATTER

## Priority: Missing Formatters to Create

### HIGH Priority (92 documents uncovered)
1. **riskfactors.js** - 66 documents
2. **consultationnotes.js** (or consultation_notes.js) - 14 documents
3. **medicalhistory.js** (or medical_history.js) - 12 documents

### MEDIUM Priority (12 documents)
4. **intraoperative_records.js** - 6 documents (surgical procedures)
5. **psychosocial_assessments.js** - 6 documents (mental health)

### LOW Priority (10 documents)
6. **reminders.js** - 5 documents
7. **follow_up_appointments.js** - 3 documents
8. **history_present_illness.js** - 1 document
9. **treatment_courses.js** - 1 document
10. **emergency_information.js** - 1 document

**Note:** Collections with 1 document are likely from single patient data and may not need dedicated formatters.

## Recommendations

### Immediate Actions
1. **Create riskfactors.js formatter** - Covers 66 documents (28% of all medical data)
2. **Create consultationnotes.js formatter** - Covers 14 documents (6% of medical data)
3. **Create medicalhistory.js formatter** - Covers 12 documents (5% of medical data)

These 3 formatters would increase coverage from 50% → **89%** (207/232 documents)

### Consider Renaming
- `intraoperative_records` might be covered by existing `anesthesia_records.js` (check schema overlap)
- `dischargesummaries` → `hospital_discharge_summaries` (already have formatter)

### Frontend Priority
Focus frontend renderers on collections with MOST data:
1. **RiskFactorsRenderer.jsx** - 66 documents
2. **ImagingReportsRenderer.jsx** - 29 documents
3. **MedicationOptimizationRenderer.jsx** - 17 documents
4. **ProceduresRenderer.jsx** - 16 documents
5. **LabResultsRenderer.jsx** - 14 documents
6. **ConsultationNotesRenderer.jsx** - 14 documents (need backend formatter first)

## Current Architecture

### Three-Layer System
```
Layer 1: medicalDataService.getMedicalData()     ✅ EXISTS
         ↓
Layer 2: Backend formatters (19 files)           ✅ 50% coverage
         ↓
Layer 3: Frontend renderers (React)              ⏳ 6% complete (1/16)
```

### Coverage Gap
- **110 documents** (47%) have formatters ✅
- **122 documents** (53%) have NO formatters ❌
- **Creating 3 high-priority formatters** would cover 89% of documents

## Database Stats

```bash
Database: intellicare_practice_yale
Collections: 32 (medical only, excludes system/admin)
Documents: 232 total medical records
Patients: 50
Users: 1
```

## Next Steps

1. ✅ **Backend formatters complete** for targeted collections (19 formatters)
2. ⏳ **Create 3 high-priority formatters** (riskfactors, consultationnotes, medicalhistory)
3. ⏳ **Complete frontend renderers** (15 more React components)
4. ⏳ **Test with real data** via WebGUI

## Files

- **Backend Formatters:** `apps/backend-api/services/utils/collectionFormatters/`
- **Frontend Renderers:** `apps/frontend-vite/src/components/collections/renderers/`
- **Documentation:** `/home/erangross/Development/IntelliCare/COLLECTION_RENDERING_*.md`
