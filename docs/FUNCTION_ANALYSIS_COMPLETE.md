# Function Analysis - aiHelpers.js vs Database Collections
**Date:** October 10, 2025
**Database:** intellicare_practice_yale (32 collections, 232 documents)

## Summary

Analysis of which collections have Claude-callable functions in `aiHelpers.js` and which need to be created.

## Existing Functions in aiHelpers.js

### ✅ Collections WITH Functions (9/32 - 41% of documents)

| Collection | Documents | Function Name | Line # |
|------------|-----------|---------------|--------|
| medicalhistory | 12 | `getMedicalHistory` | 934 |
| labresults | 14 | `getLabResults` | 1963 |
| medications | 8 | `getMedications` | 2022 |
| vitalsigns | 12 | `getVitalSigns` | 2078 |
| imagingreports | 29 | `getImagingResults` | 2300 |
| **ASSUMED** consultationnotes | 14 | ? | ? |
| **ASSUMED** medicalprocedures | 16 | ? | ? |
| **ASSUMED** diagnoses | 5 | ? | ? |
| **ASSUMED** dischargesummaries | 2 | ? | ? |

**Documents Covered:** ~95/232 (41%)

### ❌ Collections MISSING Functions (23/32 - 59% of documents)

**HIGH PRIORITY** (92 documents - 40% of all data):
1. **riskfactors** - 66 docs - BIGGEST GAP!
2. **medication_optimization** - 17 docs - AI collection
3. **medicalhistory** - 12 docs - ✅ HAS FUNCTION

**MEDIUM PRIORITY** (12 documents):
4. **intraoperative_records** - 6 docs
5. **psychosocial_assessments** - 6 docs

**LOW PRIORITY** (35 documents):
6. reminders - 5 docs
7. follow_up_appointments - 3 docs
8. pendinguploads - 1 doc
9. quality_metrics - 1 doc
10. history_present_illness - 1 doc
11. outcomes_prediction - 1 doc
12. trending_analysis - 1 doc
13. treatment_courses - 1 doc
14. patient_specific_care_plan - 1 doc
15. intelligent_recommendations - 1 doc
16. follow_up_intelligence - 1 doc
17. emergency_information - 1 doc
18. care_gaps - 1 doc
19. patient_education_context - 1 doc
20. test_vectors - 1 doc
21. costtrackings - 1 doc
22. administrative_data - 1 doc
23. clinical_decision_support - 1 doc
24. guideline_compliance - 1 doc

**Documents NOT Covered:** ~137/232 (59%)

## Next Steps - What We Need to Do

### TASK 1: Verify Assumed Functions
Check if these actually exist in aiHelpers.js:
- [ ] getConsultationNotes
- [ ] getMedicalProcedures
- [ ] getDiagnoses
- [ ] getDischargeSummaries

### TASK 2: Create Missing Functions (23 new functions)
For each collection, create a function in `aiHelpers.js` like this pattern:

```javascript
{
  name: "getRiskFactors",
  description: "Get all risk factor assessments for a patient",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        required: true,
        description: "Patient ID"
      },
      dateFrom: {
        type: "string",
        description: "Start date (YYYY-MM-DD)"
      },
      dateTo: {
        type: "string",
        description: "End date (YYYY-MM-DD)"
      }
    },
    required: ["patientId"]
  },
  handler: async (args, context) => {
    const medicalDataService = require('../medicalDataService');
    const formatters = require('./collectionFormatters');

    // Fetch data
    const data = await medicalDataService.getMedicalData(
      'riskfactors',
      args.patientId,
      { dateFrom: args.dateFrom, dateTo: args.dateTo },
      context
    );

    // Format for Claude
    const formatted = data.map(doc => formatters['riskfactors'](doc)).join('\n\n');

    return {
      success: true,
      data: formatted,
      count: data.length
    };
  }
}
```

### TASK 3: Wire ALL Functions to Formatters
Even existing functions need to call formatters! Check if they do:
- [ ] getMedicalHistory → medicalhistory.js formatter
- [ ] getLabResults → lab_results.js formatter
- [ ] getMedications → medications.js formatter
- [ ] getVitalSigns → vital_signs.js formatter
- [ ] getImagingResults → imaging_reports.js formatter

### TASK 4: Priority Order for Creating Functions

**Phase 1 - HIGH Priority (3 functions)**:
1. `getRiskFactors` - 66 documents
2. `getMedicationOptimization` - 17 documents
3. Already have `getMedicalHistory` ✅

**Phase 2 - MEDIUM Priority (2 functions)**:
4. `getIntraoperativeRecords` - 6 documents
5. `getPsychosocialAssessments` - 6 documents

**Phase 3 - AI Collections (8 functions)**:
6. `getClinicalDecisionSupport`
7. `getIntelligentRecommendations`
8. `getTrendingAnalysis`
9. `getPatientCarePlan`
10. `getFollowUpIntelligence`
11. `getPatientEducation`
12. `getOutcomesPredictions`
13. `getGuidelineCompliance`

**Phase 4 - LOW Priority (10 functions)**:
14. `getReminders`
15. `getFollowUpAppointments`
16. `getHistoryPresentIllness`
17. `getTreatmentCourses`
18. `getEmergencyInformation`
19. `getCareGaps`
20. `getQualityMetrics`
21. `getCostTracking`
22. `getAdministrativeData`
23. `getPendingUploads`

## File Locations

### Functions
`apps/backend-api/services/utils/aiHelpers.js` - Line ~285-8500

### Formatters (ALL COMPLETE ✅)
`apps/backend-api/services/utils/collectionFormatters/` - 34 formatters

### Data Service
`apps/backend-api/services/medicalDataService.js` - `getMedicalData(category, patientId, options, context)`

## Pattern to Follow

Every new function needs:
1. **Name** - Descriptive (e.g., `getRiskFactors`)
2. **Description** - What it does
3. **Parameters** - patientId (required), dateFrom/dateTo (optional)
4. **Handler** - Fetch data + Format with formatter + Return

## Coverage Goal

- **Current**: 9/32 collections (28%), 95/232 documents (41%)
- **After Phase 1-2**: 14/32 collections (44%), 132/232 documents (57%)
- **After Phase 3**: 22/32 collections (69%), 140/232 documents (60%)
- **After Phase 4**: 32/32 collections (100%), 232/232 documents (100%) ✅

## Documentation

- **This File**: Complete function analysis
- **Formatters**: `/home/erangross/Development/IntelliCare/ALL_FORMATTERS_COMPLETE.md`
- **Database**: `/home/erangross/Development/IntelliCare/DATABASE_COLLECTIONS_SUMMARY.md`
