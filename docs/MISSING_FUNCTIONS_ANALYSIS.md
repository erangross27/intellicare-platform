# Missing Functions Analysis - Medical Collections
**Date:** October 10, 2025
**Goal:** Identify which of our 32 medical collections need new functions created

## Architecture Understanding ✅

```
Frontend → /api/agent → agentServiceV4._executeFunctionInternal()
                             ↓
                    Switch/Case Routing
                             ↓
           ┌─────────────────┼─────────────────┐
           ↓                 ↓                  ↓
    Explicit Routes    Generated Routes    Default Handler
    (case statements)  (920 functions)     (fallback)
           ↓                 ↓                  ↓
    Service.function()  generatedMedicalFunctions[name].handler()
           ↓                 ↓
         SecureDataAccess.query()
           ↓
        Database
```

## Current Function Coverage

### ✅ Collections WITH Functions (8/32 = 25%)

**Explicit Routes in agentServiceV4.js:**
1. **labresults** → getLabResults (labService)
2. **medicalhistory** → getMedicalHistory (medicalDataService)
3. **vitalsigns** → getVitalSigns (labService)
4. **medications** → getMedications (medicationService)

**Generated Functions (generatedMedicalFunctions.js):**
5. **imagingreports** → getImagingReports ✅
6. **medicalprocedures** → getMedicalProcedures ✅
7. **consultationnotes** → getConsultationNotes ✅
8. **dischargesummaries** → getDischargeSummaries ✅

**Documents Covered:** ~70/232 (30%)

### ❌ Collections MISSING Functions (24/32 = 75%)

**HIGH PRIORITY (83 documents):**

| # | Collection | Docs | Function Name | Has Formatter | Status |
|---|------------|------|---------------|---------------|--------|
| 1 | riskfactors | 66 | getRiskFactors | ✅ | **NEED TO CREATE** |
| 2 | medication_optimization | 17 | getMedicationOptimization | ✅ | **NEED TO CREATE** |

**MEDIUM PRIORITY (12 documents):**

| # | Collection | Docs | Function Name | Has Formatter | Status |
|---|------------|------|---------------|---------------|--------|
| 3 | intraoperative_records | 6 | getIntraoperativeRecords | ✅ | **NEED TO CREATE** |
| 4 | psychosocial_assessments | 6 | getPsychosocialAssessments | ✅ | **NEED TO CREATE** |

**AI COLLECTIONS (7 documents):**

| # | Collection | Docs | Function Name | Has Formatter | Status |
|---|------------|------|---------------|---------------|--------|
| 5 | clinical_decision_support | 1 | getClinicalDecisionSupport | ✅ | **NEED TO CREATE** |
| 6 | intelligent_recommendations | 1 | getIntelligentRecommendations | ✅ | **NEED TO CREATE** |
| 7 | trending_analysis | 1 | getTrendingAnalysis | ✅ | **NEED TO CREATE** |
| 8 | patient_specific_care_plan | 1 | getPatientCarePlan | ✅ | **NEED TO CREATE** |
| 9 | follow_up_intelligence | 1 | getFollowUpIntelligence | ✅ | **NEED TO CREATE** |
| 10 | patient_education_context | 1 | getPatientEducation | ✅ | **NEED TO CREATE** |
| 11 | outcomes_prediction | 1 | getOutcomesPredictions | ✅ | **NEED TO CREATE** |

**LOW PRIORITY (60 documents):**

| # | Collection | Docs | Function Name | Has Formatter | Status |
|---|------------|------|---------------|---------------|--------|
| 12 | diagnoses | 5 | getDiagnoses | ✅ | **NEED TO CREATE** |
| 13 | reminders | 5 | getReminders | ✅ | **NEED TO CREATE** |
| 14 | follow_up_appointments | 3 | getFollowUpAppointments | ✅ | **NEED TO CREATE** |
| 15 | guideline_compliance | 1 | getGuidelineCompliance | ✅ | **NEED TO CREATE** |
| 16 | quality_metrics | 1 | getQualityMetrics | ✅ | **NEED TO CREATE** |
| 17 | history_present_illness | 1 | getHistoryPresentIllness | ✅ | **NEED TO CREATE** |
| 18 | treatment_courses | 1 | getTreatmentCourses | ✅ | **NEED TO CREATE** |
| 19 | emergency_information | 1 | getEmergencyInformation | ✅ | **NEED TO CREATE** |
| 20 | care_gaps | 1 | getCareGaps | ✅ | **NEED TO CREATE** |
| 21 | costtrackings | 1 | getCostTracking | ✅ | **NEED TO CREATE** |
| 22 | administrative_data | 1 | getAdministrativeData | ✅ | **NEED TO CREATE** |
| 23 | pendinguploads | 1 | getPendingUploads | ✅ | **NEED TO CREATE** |
| 24 | test_vectors | 1 | getTestVectors | ✅ | **NEED TO CREATE** |

**Documents NOT Covered:** 162/232 (70%)

## Implementation Strategy

### Option 1: Add to generatedMedicalFunctions.js (RECOMMENDED)
**WHY:** Functions will auto-route via line 5623-5633 fallback handler

**Steps:**
1. Add 24 new function definitions to `generatedMedicalFunctions.js`
2. Each function follows this pattern:

```javascript
getRiskFactors: {
  description: "Get all risk factor assessments for a patient",
  parameters: {
    patientId: { type: "string", required: true, description: "Patient ID" },
    dateFrom: { type: "string", description: "Start date (YYYY-MM-DD)" },
    dateTo: { type: "string", description: "End date (YYYY-MM-DD)" },
    limit: { type: "number", description: "Maximum number of records" }
  },
  handler: async (args, context) => {
    const SecureDataAccess = require('../services/secureDataAccess');
    const formatters = require('./utils/collectionFormatters');

    const secureContext = {
      serviceId: 'agent-service-v4',
      operation: 'getRiskFactors',
      practiceId: context.practiceId
    };

    // Convert patientId to ObjectId if needed
    let patientIdToUse = args.patientId;
    if (typeof args.patientId === 'string' && /^[0-9a-fA-F]{24}$/.test(args.patientId)) {
      patientIdToUse = new ObjectId(args.patientId);
    }

    // Build filter
    const filter = { patientId: patientIdToUse };
    if (args.dateFrom || args.dateTo) {
      filter.date = {};
      if (args.dateFrom) filter.date.$gte = new Date(args.dateFrom);
      if (args.dateTo) filter.date.$lte = new Date(args.dateTo);
    }

    // Query options
    const options = {
      limit: args.limit || 100,
      sort: { date: -1 }
    };

    // Fetch data
    const data = await SecureDataAccess.query('riskfactors', filter, options, secureContext);

    if (!data || data.length === 0) {
      return {
        success: true,
        data: 'No risk factor assessments found for this patient.',
        count: 0
      };
    }

    // Format with formatter
    const formatter = formatters['riskfactors'];
    if (formatter) {
      const formattedDocs = data.map(doc => formatter(doc));
      const formattedText = formattedDocs.join('\n\n' + '='.repeat(80) + '\n\n');

      return {
        success: true,
        data: formattedText,  // Formatted text for Claude
        rawData: data,        // Raw data for UI
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
}
```

3. No changes needed to agentServiceV4.js (auto-routes via line 5623)
4. Add function definitions to aiHelpers.js for Claude to discover them

### Option 2: Create Explicit Routes in agentServiceV4.js
**WHY:** More control, but requires changes to routing switch statement

**Steps:**
1. Create 24 case statements in agentServiceV4.js (around line 1160)
2. Create service methods in appropriate services
3. Add function definitions to aiHelpers.js

**NOT RECOMMENDED** - More work, same result

## Next Steps

### Step 1: Add Functions to generatedMedicalFunctions.js
**File:** `apps/backend-api/services/generatedMedicalFunctions.js`
**Location:** After existing functions (line ~920+)

Add 24 new functions following the pattern above. Each function:
- Queries SecureDataAccess with collection name
- Calls the corresponding formatter from `collectionFormatters/`
- Returns formatted text for Claude + raw data for UI

### Step 2: Add Function Definitions to aiHelpers.js
**File:** `apps/backend-api/services/utils/aiHelpers.js`
**Location:** In getAllPlatformFunctions() around line 1500

Add 24 function definitions so Claude knows they exist:

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

### Step 3: Test Each Function
Test via chat interface:
- "Show me risk factors for patient John Doe"
- Should call getRiskFactors
- Should return formatted text using riskfactors.js formatter

## Priority Order for Implementation

1. **HIGH** (2 functions, 83 docs):
   - getRiskFactors (66 docs)
   - getMedicationOptimization (17 docs)

2. **MEDIUM** (2 functions, 12 docs):
   - getIntraoperativeRecords (6 docs)
   - getPsychosocialAssessments (6 docs)

3. **AI COLLECTIONS** (7 functions, 7 docs):
   - getClinicalDecisionSupport
   - getIntelligentRecommendations
   - getTrendingAnalysis
   - getPatientCarePlan
   - getFollowUpIntelligence
   - getPatientEducation
   - getOutcomesPredictions

4. **LOW** (13 functions, 60 docs):
   - getDiagnoses, getReminders, etc.

## Files to Modify

1. **generatedMedicalFunctions.js** - Add 24 new function handlers
2. **aiHelpers.js** - Add 24 function definitions
3. **NO CHANGES** to agentServiceV4.js (auto-routes!)

## Success Criteria

- [ ] All 32 collections have callable functions
- [ ] All functions use formatters to return readable text
- [ ] Claude can ask "show me X for patient Y" for ANY collection
- [ ] Functions return formatted text for Claude + raw data for UI
- [ ] 100% coverage: 232/232 documents accessible

## Current vs Target Coverage

**Current:**
- Functions: 8/32 (25%)
- Documents: 70/232 (30%)
- Formatter Integration: 4/8 existing functions need formatters added

**Target:**
- Functions: 32/32 (100%) ✅
- Documents: 232/232 (100%) ✅
- Formatter Integration: 32/32 (100%) ✅
