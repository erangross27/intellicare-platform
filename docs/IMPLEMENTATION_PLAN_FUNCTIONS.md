# Implementation Plan: Wire Functions to Formatters
**Date:** October 10, 2025
**Goal:** Create 23 new Claude-callable functions for missing collections

## Architecture Understanding

```
┌─────────────────┐
│ aiHelpers.js    │ ← Function DEFINITIONS (for Claude API)
│ (Line ~285)     │   - name, description, parameters
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ agentServiceV4  │ ← ROUTING (switch/case statements)
│ (executeFunction│   - Routes function name → service method
│  Line ~880)     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Services        │ ← IMPLEMENTATION
│ - labService    │   - Fetches data from MongoDB
│ - medication    │   - Calls formatters
│ - medicalData   │   - Returns formatted text
└─────────────────┘
```

## Existing Generic Services

We have TWO generic services that can fetch ANY collection:

### 1. medicalDataService.getMedicalData()
```javascript
async getMedicalData(category, patientId, options = {}, context)
```

### 2. medicalCrudService.getCategoryData()
```javascript
async getCategoryData(category, patientId, sessionId, options = {})
```

**KEY INSIGHT:** We DON'T need to create 23 new service methods! We can use these generic methods + our formatters!

## What We Have

### ✅ Complete (34/34)
**Formatters** in `collectionFormatters/`:
- riskfactors.js
- consultationnotes.js
- medicalhistory.js
- ... (all 34 created)

### ✅ Partial (5/32)
**Existing Functions with Routes**:
1. labresults → labService.getLabResults()
2. medications → medicationService.getMedications()
3. vitalsigns → labService.getVitalSigns()
4. medicalhistory → medicalDataService.listPatientMedicalCategories()
5. reminders → (has route, need to verify)

### ❌ Missing (27/32)
**Need to Create**:
- riskfactors (66 docs)
- imagingreports (29 docs)
- medication_optimization (17 docs)
- consultationnotes (14 docs)
- medicalprocedures (16 docs)
- ... (22 more)

## Implementation Strategy

### Option 1: Generic Wrapper Pattern (RECOMMENDED)
Create ONE generic function that handles all collections:

```javascript
// In agentServiceV4.js
async getCollectionData(collectionName, args, context) {
  const medicalDataService = require('./medicalDataService');
  const formatters = require('./utils/collectionFormatters');

  // Fetch data
  const data = await medicalDataService.getMedicalData(
    collectionName,
    args.patientId,
    { dateFrom: args.dateFrom, dateTo: args.dateTo },
    context
  );

  // Format for Claude
  if (formatters[collectionName]) {
    const formatted = data.map(doc => formatters[collectionName](doc)).join('\n\n');
    return { success: true, data: formatted, count: data.length };
  }

  // Fallback to raw data
  return { success: true, data, count: data.length };
}
```

Then route each collection:
```javascript
case 'getRiskFactors':
  return await this.getCollectionData('riskfactors', args, context);
case 'getConsultationNotes':
  return await this.getCollectionData('consultationnotes', args, context);
// ... etc
```

### Option 2: Individual Functions (More Explicit)
Create 23 separate functions, each calling the generic service:

```javascript
async getRiskFactors(args, context) {
  const medicalDataService = require('./medicalDataService');
  const formatters = require('./utils/collectionFormatters');

  const data = await medicalDataService.getMedicalData('riskfactors', args.patientId, {}, context);
  const formatted = data.map(doc => formatters['riskfactors'](doc)).join('\n\n');

  return { success: true, data: formatted, count: data.length };
}
```

**RECOMMENDATION:** Use Option 1 (generic wrapper) for faster implementation.

## Step-by-Step Implementation

### Phase 1: Create Generic Wrapper (1 function)
**File:** `agentServiceV4.js`
**Location:** After existing functions (around line 6000)

```javascript
async getFormattedCollectionData(collectionName, args, context) {
  const medicalDataService = require('./medicalDataService');
  const formatters = require('./utils/collectionFormatters');

  try {
    // Fetch data using generic service
    const data = await medicalDataService.getMedicalData(
      collectionName,
      args.patientId,
      {
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
        limit: args.limit || 100
      },
      context
    );

    if (!data || data.length === 0) {
      return {
        success: true,
        data: `No ${collectionName} found for this patient.`,
        count: 0
      };
    }

    // Format each document using collection-specific formatter
    const formatter = formatters[collectionName];
    if (formatter) {
      const formattedDocs = data.map(doc => formatter(doc));
      const formatted = formattedDocs.join('\n\n' + '='.repeat(80) + '\n\n');

      return {
        success: true,
        data: formatted,
        count: data.length
      };
    }

    // Fallback: return raw JSON if no formatter exists
    return {
      success: true,
      data: JSON.stringify(data, null, 2),
      count: data.length
    };

  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### Phase 2: Add Routes (23 case statements)
**File:** `agentServiceV4.js`
**Location:** In _executeFunctionInternal switch statement (around line 1200)

```javascript
// Risk Factors
case 'getRiskFactors':
  return await this.getFormattedCollectionData('riskfactors', args, context);

// Consultation Notes
case 'getConsultationNotes':
  return await this.getFormattedCollectionData('consultationnotes', args, context);

// Medication Optimization
case 'getMedicationOptimization':
  return await this.getFormattedCollectionData('medication_optimization', args, context);

// ... (add 20 more cases)
```

### Phase 3: Add Function Definitions (23 definitions)
**File:** `aiHelpers.js`
**Location:** In getAllPlatformFunctions() around line 1500

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
},
```

## Priority Order

### HIGH Priority (3 functions - 92 documents)
1. **getRiskFactors** - 66 docs
2. **getMedicationOptimization** - 17 docs
3. **getConsultationNotes** - 14 docs

### MEDIUM Priority (2 functions - 12 documents)
4. **getIntraoperativeRecords** - 6 docs
5. **getPsychosocialAssessments** - 6 docs

### AI Collections (8 functions - 8 documents)
6. **getClinicalDecisionSupport**
7. **getIntelligentRecommendations**
8. **getTrendingAnalysis**
9. **getPatientCarePlan**
10. **getFollowUpIntelligence**
11. **getPatientEducation**
12. **getOutcomesPredictions**
13. **getGuidelineCompliance**

### LOW Priority (10 functions - 10 documents)
14-23. (Various 1-document collections)

## Testing Plan

### Test Each Function:
```javascript
// In Claude chat:
"Show me risk factors for patient John Doe"
// Should call: getRiskFactors
// Should return: Formatted risk factor data using riskfactors.js formatter

"Show me consultation notes for Jane Smith"
// Should call: getConsultationNotes
// Should return: Formatted consultation data using consultationnotes.js formatter
```

## Files to Modify

1. **agentServiceV4.js** (2 changes):
   - Add `getFormattedCollectionData()` method (~50 lines)
   - Add 23 case statements (~23 lines)

2. **aiHelpers.js** (1 change):
   - Add 23 function definitions (~600 lines)

**Total Lines to Add:** ~673 lines across 2 files

## Success Criteria

- [ ] All 32 collections have Claude-callable functions
- [ ] All functions use formatters to return readable text
- [ ] Claude can ask "show me X for patient Y" for ANY collection
- [ ] Functions return formatted text, not raw JSON
- [ ] Error handling for missing data

## Current Status

- ✅ Formatters: 34/34 (100%)
- ⏳ Routes: 5/32 (16%)
- ⏳ Definitions: ~9/32 (28%)
- ❌ Generic Wrapper: 0/1 (0%)

**Next Action:** Create the generic wrapper function in agentServiceV4.js
