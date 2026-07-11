# Final Missing Functions Analysis
**Date:** October 10, 2025
**Source:** generatedMedicalFunctions.js (37,494 lines, 921 functions)

## Summary

After searching generatedMedicalFunctions.js properly, here's what we found:

### ✅ Collections WITH Functions (19/32 = 59%)

| Collection | Function Found | Operations |
|------------|----------------|------------|
| riskfactors | getFallRiskAssessments | get, create, update, delete, search |
| imagingreports | getImagingReports | get, create, update, delete, search |
| medication_optimization | getMedications | get, create, update, delete, search |
| medicalprocedures | getMedicalProcedures | get, create, update, delete, search |
| labresults | getLabResults | get, create, update, delete, search |
| consultationnotes | getConsultationNotes | get, create, update, delete, search |
| medicalhistory | getMedicalCertificate | get, create, update, delete |
| vitalsigns | getVitalSignsLogs | get, create, delete, search |
| medications | getMedications | get, create, update, delete, search |
| diagnoses | (found references) | need to verify |
| follow_up_appointments | getAppointments | get, create, delete |
| dischargesummaries | getDischargeSummaries | get, create, delete |
| patient_education_context | getPatientEducationRecords | get, create, delete, search |
| treatment_courses | getOncologyTreatmentPlans | get, create, delete |
| emergency_information | getEmergencyReports | get, create, delete |

### ❌ Collections MISSING Functions (13/32 = 41%)

**CRITICAL - AI Collections (7):**
1. **clinical_decision_support** - NO FUNCTIONS
2. **intelligent_recommendations** - NO FUNCTIONS
3. **trending_analysis** - NO FUNCTIONS
4. **patient_specific_care_plan** - NO FUNCTIONS (has getPatientEducationRecords but not care plan)
5. **follow_up_intelligence** - NO FUNCTIONS
6. **outcomes_prediction** - NO FUNCTIONS
7. **guideline_compliance** - NO FUNCTIONS

**HIGH PRIORITY (1):**
8. **intraoperative_records** (6 docs) - NO FUNCTIONS

**MEDIUM PRIORITY (1):**
9. **psychosocial_assessments** (6 docs) - NO FUNCTIONS

**LOW PRIORITY (4):**
10. **reminders** (5 docs) - NO FUNCTIONS
11. **quality_metrics** (1 doc) - NO FUNCTIONS
12. **history_present_illness** (1 doc) - NO FUNCTIONS
13. **care_gaps** (1 doc) - NO FUNCTIONS
14. **costtrackings** (1 doc) - NO FUNCTIONS
15. **administrative_data** (1 doc) - NO FUNCTIONS

**Documents NOT Covered:** ~100/232 (43%)

## What Needs To Be Created

### Option 1: Add to generatedMedicalFunctions.js (NOT RECOMMENDED)
- File is already 37,494 lines
- Adding more would make it unmaintainable
- You correctly suggested separate service files

### Option 2: Create Dedicated Service Files (RECOMMENDED ✅)

Create **NEW SERVICE FILES** for the 13 missing collections:

#### 1. AI Clinical Services (NEW FILE: `aiClinicalInsightsService.js`)
**Purpose:** Handle all AI-generated clinical insights collections

Functions to include:
- `getClinicalDecisionSupport(patientId, options)` → clinical_decision_support collection
- `getIntelligentRecommendations(patientId, options)` → intelligent_recommendations collection
- `getTrendingAnalysis(patientId, options)` → trending_analysis collection
- `getPatientCarePlan(patientId, options)` → patient_specific_care_plan collection
- `getFollowUpIntelligence(patientId, options)` → follow_up_intelligence collection
- `getOutcomesPredictions(patientId, options)` → outcomes_prediction collection
- `getGuidelineCompliance(patientId, options)` → guideline_compliance collection

Each function:
- Queries SecureDataAccess
- Calls corresponding formatter from `collectionFormatters/`
- Returns formatted text for Claude

#### 2. Surgical Records Service (NEW FILE: `surgicalRecordsService.js`)
**Purpose:** Handle surgical and intraoperative records

Functions:
- `getIntraoperativeRecords(patientId, options)` → intraoperative_records collection
- `createIntraoperativeRecord(data)`
- `updateIntraoperativeRecord(id, data)`
- `deleteIntraoperativeRecord(id)`

#### 3. Mental Health Service (NEW FILE: `mentalHealthService.js`)
**Purpose:** Handle psychosocial assessments

Functions:
- `getPsychosocialAssessments(patientId, options)` → psychosocial_assessments collection
- `createPsychosocialAssessment(data)`
- `updatePsychosocialAssessment(id, data)`
- `deletePsychosocialAssessment(id)`

#### 4. Clinical Operations Service (NEW FILE: `clinicalOperationsService.js`)
**Purpose:** Handle reminders, quality metrics, care gaps

Functions:
- `getReminders(patientId, options)` → reminders collection
- `getQualityMetrics(patientId, options)` → quality_metrics collection
- `getHistoryPresentIllness(patientId, options)` → history_present_illness collection
- `getCareGaps(patientId, options)` → care_gaps collection
- `getCostTracking(patientId, options)` → costtrackings collection
- `getAdministrativeData(patientId, options)` → administrative_data collection

## Implementation Pattern for New Services

```javascript
/**
 * AI Clinical Insights Service
 * Handles all AI-generated clinical collections
 */

const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const formatters = require('./utils/collectionFormatters');
const { ObjectId } = require('mongodb');

class AiClinicalInsightsService {
  constructor() {
    this.serviceName = 'aiClinicalInsightsService';
    this.serviceAuth = null;
  }

  async initialize() {
    if (!this.serviceAuth) {
      this.serviceAuth = await serviceAccountManager.authenticate(this.serviceName);
      console.log(`✅ ${this.serviceName} authenticated successfully`);
    }
    return this.serviceAuth;
  }

  createSecureContext(practiceContext, operation) {
    return {
      serviceId: this.serviceName,
      operation: operation,
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId || 'global',
      apiKey: this.serviceAuth?.apiKey || this.serviceAuth
    };
  }

  async getClinicalDecisionSupport(params, practiceContext, session) {
    try {
      // Initialize if needed
      if (!this.serviceAuth) {
        await this.initialize();
      }

      // Extract patientId
      let { patientId, ...queryOptions } = params;

      // Check context if no patientId
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
      }

      if (!patientId) {
        throw new Error('Patient ID required');
      }

      // Build security context
      const context = this.createSecureContext(practiceContext, 'get_clinical_decision_support');

      // Build filter
      const filter = {
        patientId: typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
          ? new ObjectId(patientId)
          : patientId
      };

      // Add date filters if provided
      if (params.dateFrom || params.dateTo) {
        filter.date = {};
        if (params.dateFrom) filter.date.$gte = new Date(params.dateFrom);
        if (params.dateTo) filter.date.$lte = new Date(params.dateTo);
      }

      // Query options
      const options = {
        sort: { date: -1 },
        limit: params.limit || 100
      };

      // Query database
      const data = await SecureDataAccess.query(
        'clinical_decision_support',
        filter,
        options,
        context
      );

      if (!data || data.length === 0) {
        return {
          success: true,
          data: 'No clinical decision support data found for this patient.',
          count: 0
        };
      }

      // Format with formatter
      const formatter = formatters['clinical_decision_support'];
      if (formatter) {
        const formattedDocs = data.map(doc => formatter(doc));
        const formattedText = formattedDocs.join('\n\n' + '='.repeat(80) + '\n\n');

        return {
          success: true,
          data: formattedText,  // For Claude
          rawData: data,        // For UI
          count: data.length
        };
      }

      // Fallback: raw JSON
      return {
        success: true,
        data: JSON.stringify(data, null, 2),
        count: data.length
      };

    } catch (error) {
      console.error('Error getting clinical decision support:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Repeat pattern for other 6 AI collections...
}

module.exports = new AiClinicalInsightsService();
```

## Next Steps

1. **Create 4 new service files:**
   - `aiClinicalInsightsService.js` (7 functions)
   - `surgicalRecordsService.js` (4 functions)
   - `mentalHealthService.js` (4 functions)
   - `clinicalOperationsService.js` (6 functions)

2. **Register services** in `serviceProxyManager.js`

3. **Add routes** to `agentServiceV4.js`:
```javascript
// AI Clinical Insights
case 'getClinicalDecisionSupport':
  return await aiClinicalInsightsService.getClinicalDecisionSupport(args, practiceContext, session);
case 'getIntelligentRecommendations':
  return await aiClinicalInsightsService.getIntelligentRecommendations(args, practiceContext, session);
// ... etc for all 13 functions
```

4. **Add function definitions** to `aiHelpers.js` so Claude knows they exist

5. **Test** each function via chat interface

## Files to Create/Modify

### NEW FILES (4):
1. `apps/backend-api/services/aiClinicalInsightsService.js`
2. `apps/backend-api/services/surgicalRecordsService.js`
3. `apps/backend-api/services/mentalHealthService.js`
4. `apps/backend-api/services/clinicalOperationsService.js`

### MODIFY (2):
1. `apps/backend-api/services/agentServiceV4.js` - Add 13 case statements
2. `apps/backend-api/services/utils/aiHelpers.js` - Add 13 function definitions

## Success Criteria

- [ ] 4 new service files created
- [ ] 13 new functions implemented with formatters
- [ ] All routes added to agentServiceV4.js
- [ ] All functions registered in aiHelpers.js
- [ ] Claude can access all 32 collections via chat
- [ ] 100% coverage: 232/232 documents accessible
