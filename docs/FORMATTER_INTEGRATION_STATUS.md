# Formatter Integration Status
**Date:** October 10, 2025
**Purpose:** Map all 32 collections to their current routing status and formatter integration

## Critical Finding: NO FORMATTERS ARE CURRENTLY USED! ❌

After examining labService.js, medicationService.js, and agentServiceV4.js routing, **NONE of the existing services call the formatters we created**.

## Current Status by Collection

### ✅ Collections WITH Routes (5/32 = 16%)

| # | Collection | Documents | Route Name | Service | Formatter Exists? | Uses Formatter? |
|---|------------|-----------|------------|---------|-------------------|-----------------|
| 1 | labresults | 14 | getLabResults | labService | ✅ lab_results.js | ❌ NO |
| 2 | medications | 8 | getMedications | medicationService | ✅ medications.js | ❌ NO |
| 3 | vitalsigns | 12 | getVitalSigns | labService | ✅ vital_signs.js | ❌ NO |
| 4 | medicalhistory | 12 | getMedicalHistory | medicalDataService | ✅ medicalhistory.js | ❌ NO |
| 5 | reminders | 5 | ? | ? | ✅ reminders.js | ❌ NO |

**Documents Covered:** 51/232 (22%)

### ❌ Collections MISSING Routes (27/32 = 84%)

**HIGH PRIORITY (92 documents - 40% of all data):**

| # | Collection | Documents | Need Route | Formatter Exists |
|---|------------|-----------|------------|------------------|
| 1 | riskfactors | 66 | getRiskFactors | ✅ riskfactors.js |
| 2 | medication_optimization | 17 | getMedicationOptimization | ✅ medication_optimization.js |
| 3 | consultationnotes | 14 | getConsultationNotes | ✅ consultationnotes.js |

**MEDIUM PRIORITY (45 documents):**

| # | Collection | Documents | Need Route | Formatter Exists |
|---|------------|-----------|------------|------------------|
| 4 | imagingreports | 29 | getImagingReports | ✅ imagingreports.js |
| 5 | medicalprocedures | 16 | getMedicalProcedures | ✅ medicalprocedures.js |

**AI COLLECTIONS (8 documents):**

| # | Collection | Documents | Need Route | Formatter Exists |
|---|------------|-----------|------------|------------------|
| 6 | intraoperative_records | 6 | getIntraoperativeRecords | ✅ intraoperative_records.js |
| 7 | psychosocial_assessments | 6 | getPsychosocialAssessments | ✅ psychosocial_assessments.js |
| 8 | clinical_decision_support | 1 | getClinicalDecisionSupport | ✅ clinical_decision_support.js |
| 9 | intelligent_recommendations | 1 | getIntelligentRecommendations | ✅ intelligent_recommendations.js |
| 10 | trending_analysis | 1 | getTrendingAnalysis | ✅ trending_analysis.js |
| 11 | patient_specific_care_plan | 1 | getPatientCarePlan | ✅ patient_specific_care_plan.js |
| 12 | follow_up_intelligence | 1 | getFollowUpIntelligence | ✅ follow_up_intelligence.js |

**LOW PRIORITY (36 documents):**

| # | Collection | Documents | Need Route | Formatter Exists |
|---|------------|-----------|------------|------------------|
| 13 | diagnoses | 5 | getDiagnoses | ✅ diagnoses.js |
| 14 | follow_up_appointments | 3 | getFollowUpAppointments | ✅ follow_up_appointments.js |
| 15 | dischargesummaries | 2 | getDischargeSummaries | ✅ dischargesummaries.js |
| 16 | pendinguploads | 1 | getPendingUploads | ✅ pendinguploads.js |
| 17 | quality_metrics | 1 | getQualityMetrics | ✅ quality_metrics.js |
| 18 | history_present_illness | 1 | getHistoryPresentIllness | ✅ history_present_illness.js |
| 19 | outcomes_prediction | 1 | getOutcomesPredictions | ✅ outcomes_prediction.js |
| 20 | treatment_courses | 1 | getTreatmentCourses | ✅ treatment_courses.js |
| 21 | emergency_information | 1 | getEmergencyInformation | ✅ emergency_information.js |
| 22 | care_gaps | 1 | getCareGaps | ✅ care_gaps.js |
| 23 | patient_education_context | 1 | getPatientEducation | ✅ patient_education_context.js |
| 24 | test_vectors | 1 | getTestVectors | ✅ test_vectors.js |
| 25 | costtrackings | 1 | getCostTracking | ✅ costtrackings.js |
| 26 | administrative_data | 1 | getAdministrativeData | ✅ administrative_data.js |
| 27 | guideline_compliance | 1 | getGuidelineCompliance | ✅ guideline_compliance.js |

**Documents NOT Covered:** 181/232 (78%)

## What Needs to Happen

### Phase 1: Fix Existing Functions (5 functions)
**Update existing services to USE formatters:**

1. **labService.getLabResults()** - Add formatter call using `lab_results.js`
2. **medicationService.getMedications()** - Add formatter call using `medications.js`
3. **labService.getVitalSigns()** - Add formatter call using `vital_signs.js`
4. **medicalDataService.listPatientMedicalCategories()** - Add formatter call using `medicalhistory.js`
5. **Find reminders route** - Add formatter call using `reminders.js`

**Pattern to add to each service:**
```javascript
// At top of file
const formatters = require('./utils/collectionFormatters');

// In the function, after fetching data:
const formatter = formatters['collection_name'];
if (formatter && data && data.length > 0) {
  const formattedDocs = data.map(doc => formatter(doc));
  const formattedText = formattedDocs.join('\n\n' + '='.repeat(80) + '\n\n');

  return {
    success: true,
    data: formattedText,  // Return formatted text for Claude
    rawData: data,        // Keep raw data for UI
    count: data.length
  };
}
```

### Phase 2: Create New Routes (27 functions)
**For each missing collection:**

1. **Add case to agentServiceV4.js** (line ~1150+):
```javascript
case 'getRiskFactors':
  return await medicalDataService.getFormattedCollectionData('riskfactors', args, context);
```

2. **Create generic method in medicalDataService.js**:
```javascript
async getFormattedCollectionData(collectionName, args, context) {
  const formatters = require('./utils/collectionFormatters');

  // Fetch data using existing getMedicalData
  const data = await this.getMedicalData(
    collectionName,
    args.patientId,
    { dateFrom: args.dateFrom, dateTo: args.dateTo, limit: args.limit || 100 },
    context
  );

  if (!data || data.length === 0) {
    return {
      success: true,
      data: `No ${collectionName} found for this patient.`,
      count: 0
    };
  }

  // Format using collection-specific formatter
  const formatter = formatters[collectionName];
  if (formatter) {
    const formattedDocs = data.map(doc => formatter(doc));
    const formattedText = formattedDocs.join('\n\n' + '='.repeat(80) + '\n\n');

    return {
      success: true,
      data: formattedText,
      rawData: data,
      count: data.length
    };
  }

  // Fallback: raw JSON
  return {
    success: true,
    data: JSON.stringify(data, null, 2),
    count: data.length
  };
}
```

3. **Add function definition to aiHelpers.js** (line ~1500+):
```javascript
{
  name: "getRiskFactors",
  description: isHebrew
    ? "קבל הערכות גורמי סיכון של מטופל"
    : "Get all risk factor assessments for a patient",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: isHebrew ? "מזהה מטופל" : "Patient ID"
      },
      dateFrom: {
        type: "string",
        description: isHebrew ? "מתאריך (YYYY-MM-DD)" : "From date (YYYY-MM-DD)"
      },
      dateTo: {
        type: "string",
        description: isHebrew ? "עד תאריך (YYYY-MM-DD)" : "To date (YYYY-MM-DD)"
      },
      limit: {
        type: "number",
        description: isHebrew ? "מקסימום רשומות" : "Maximum records"
      }
    },
    required: ["patientId"]
  }
}
```

## Priority Order

### IMMEDIATE (Phase 1 - Fix existing 5 functions):
1. labService.getLabResults → use lab_results.js formatter
2. medicationService.getMedications → use medications.js formatter
3. labService.getVitalSigns → use vital_signs.js formatter
4. medicalDataService.listPatientMedicalCategories → use medicalhistory.js formatter
5. Find and fix reminders route → use reminders.js formatter

### HIGH PRIORITY (Phase 2 - 3 new functions, 92 documents):
1. getRiskFactors - 66 docs
2. getMedicationOptimization - 17 docs
3. getConsultationNotes - 14 docs

### MEDIUM PRIORITY (Phase 2 - 2 new functions, 45 documents):
4. getImagingReports - 29 docs
5. getMedicalProcedures - 16 docs

### AI COLLECTIONS (Phase 2 - 7 new functions, 8 documents):
6. getIntraoperativeRecords - 6 docs
7. getPsychosocialAssessments - 6 docs
8. getClinicalDecisionSupport - 1 doc
9. getIntelligentRecommendations - 1 doc
10. getTrendingAnalysis - 1 doc
11. getPatientCarePlan - 1 doc
12. getFollowUpIntelligence - 1 doc

### LOW PRIORITY (Phase 2 - 15 new functions, 36 documents):
13-27. All 1-2 document collections

## Files to Modify

### Phase 1 (Fix Existing):
1. `labService.js` - Update getLabResults() and getVitalSigns()
2. `medicationService.js` - Update getMedications()
3. `medicalDataService.js` - Update listPatientMedicalCategories()

### Phase 2 (Add New):
1. `medicalDataService.js` - Add getFormattedCollectionData() method
2. `agentServiceV4.js` - Add 27 case statements (lines ~1150-1200)
3. `aiHelpers.js` - Add 27 function definitions (lines ~1500+)

## Success Criteria

- [ ] All 5 existing functions call formatters
- [ ] All 27 new functions created with routes
- [ ] All 32 functions return formatted text for Claude
- [ ] Claude can ask "show me X for patient Y" for ANY collection
- [ ] Functions return both formattedText (for Claude) and rawData (for UI)

## Current Coverage

- **Formatters**: 34/34 (100%) ✅
- **Routes**: 5/32 (16%) ❌
- **Formatter Integration**: 0/32 (0%) ❌
- **Documents Covered**: 51/232 (22%) ❌

## Target Coverage After Completion

- **Formatters**: 34/34 (100%) ✅
- **Routes**: 32/32 (100%) ✅
- **Formatter Integration**: 32/32 (100%) ✅
- **Documents Covered**: 232/232 (100%) ✅
