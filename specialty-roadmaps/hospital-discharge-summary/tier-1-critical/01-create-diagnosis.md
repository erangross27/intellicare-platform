# Task 01: createDiagnosis() Tool

**Priority**: CRITICAL
**Timeline**: 3-4 days
**Complexity**: Medium
**Dependencies**: diagnoses collection schema

## Problem Statement

Hospital discharge summaries contain multiple diagnoses with ICD-10 codes, categorization (primary, secondary, comorbidities), and clinical context. Currently, IntelliCare extracts diagnoses as unstructured text, losing critical coding and categorization data.

**Example from David Wilson**:
- Primary: COPD exacerbation (J44.1)
- Secondary: Type 2 Diabetes Mellitus (E11.9)
- Comorbidity: Hypertension (I10)

**Current Gap**: No structured storage, no ICD-10 codes, no diagnosis categorization

## Tool Specification

### Function Name
`createDiagnosis()`

### Parameters
```javascript
{
  patientId: string,          // Required
  diagnosisCode: string,       // ICD-10 code (e.g., "J44.1")
  diagnosisName: string,       // Human-readable name (e.g., "COPD exacerbation")
  category: string,            // "primary" | "secondary" | "comorbidity" | "rule_out"
  status: string,              // "active" | "resolved" | "chronic" | "rule_out"
  onsetDate: string,           // ISO date or "unknown"
  diagnosedDate: string,       // ISO date (when diagnosis was made)
  diagnosedBy: string,         // Provider ID or name
  severity: string,            // "mild" | "moderate" | "severe" | "critical" (optional)
  notes: string,               // Clinical notes (optional)
  source: string               // "discharge_summary" | "clinic_visit" | "hospital_admission"
}
```

### Return Value
```javascript
{
  success: boolean,
  diagnosisId: string,
  message: string
}
```

## Implementation Checklist

### Step 1: Schema Definition
**File**: `apps/backend-api/services/collectionSchemas.js`

- [ ] Verify diagnoses collection schema exists
- [ ] Add fields: diagnosisCode, category, status, onsetDate, diagnosedBy, severity, source
- [ ] Ensure ICD-10 code validation
- [ ] Add indexes: patientId, diagnosisCode, category, status

### Step 2: Collection Registration
**File**: `apps/backend-api/services/medicalCollectionsService.js`

- [ ] Verify diagnoses in allCollections array
- [ ] Confirm collection display name and category

### Step 3: Service Implementation
**File**: `apps/backend-api/services/diagnosisService.js` (create if doesn't exist)

```javascript
async createDiagnosis(params, practiceContext) {
  const context = {
    serviceId: 'diagnosis-service',
    operation: 'create',
    practiceId: practiceContext.subdomain
  };

  // Validate ICD-10 code format
  if (!this.validateICD10(params.diagnosisCode)) {
    throw new Error('Invalid ICD-10 code format');
  }

  // Check for duplicates
  const existing = await SecureDataAccess.query(
    'diagnoses',
    {
      patientId: params.patientId,
      diagnosisCode: params.diagnosisCode,
      status: 'active'
    },
    {},
    context
  );

  if (existing.length > 0) {
    return {
      success: true,
      diagnosisId: existing[0]._id,
      message: 'Diagnosis already exists'
    };
  }

  // Create diagnosis
  const diagnosis = {
    ...params,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await SecureDataAccess.insert(
    'diagnoses',
    diagnosis,
    context
  );

  return {
    success: true,
    diagnosisId: result._id,
    message: practiceContext.language === 'he'
      ? 'אבחנה נוצרה בהצלחה'
      : 'Diagnosis created successfully'
  };
}
```

### Step 4: Function Registration
**File**: `apps/backend-api/services/utils/aiHelpers.js`

- [ ] Add createDiagnosis to getAllPlatformFunctions() (lines 1000-1300)
- [ ] Include clear description for Claude
- [ ] Define parameter schema with required fields

### Step 5: Agent System Prompt
**File**: `apps/backend-api/services/agentSystemPrompt.js`

- [ ] Add createDiagnosis to ALL_FUNCTION_NAMES array
- [ ] Add usage instructions if needed (e.g., "Use when processing discharge summary diagnoses")

### Step 6: Route Integration (if needed)
**File**: `apps/backend-api/routes/agent.js`

- [ ] Verify function executes through agentServiceV4.executeFunction()
- [ ] Test function selection by Claude

## Testing Strategy

### Unit Tests
```javascript
// Test 1: Create new diagnosis
await createDiagnosis({
  patientId: 'helen_cox',
  diagnosisCode: 'J44.1',
  diagnosisName: 'COPD exacerbation',
  category: 'primary',
  status: 'active',
  diagnosedDate: '2025-10-15',
  diagnosedBy: 'Dr. Smith',
  source: 'discharge_summary'
});

// Test 2: Duplicate detection
// Should return existing diagnosis, not create duplicate

// Test 3: Invalid ICD-10 code
// Should throw validation error

// Test 4: Multi-tenant isolation
// Practice A cannot see Practice B diagnoses
```

### Integration Test
```javascript
// Process David Wilson discharge summary
// Verify all diagnoses extracted:
// - J44.1 (COPD exacerbation) - primary
// - E11.9 (Type 2 DM) - secondary
// - I10 (Hypertension) - comorbidity
```

## ICD-10 Code Validation

### Basic Validation Pattern
```javascript
validateICD10(code) {
  // Basic format: A00.0 to Z99.9
  const pattern = /^[A-Z]\d{2}(\.\d{1,2})?$/;
  return pattern.test(code);
}
```

### Enhanced Validation (Future)
- Full ICD-10 code library lookup
- Code description auto-population
- Billable vs non-billable codes
- HCC risk adjustment codes

## Success Criteria

- ✅ Tool creates diagnoses in diagnoses collection
- ✅ ICD-10 codes validated and stored
- ✅ Diagnoses categorized (primary, secondary, comorbidity)
- ✅ Duplicate detection prevents redundant entries
- ✅ Multi-tenant isolation maintained
- ✅ Claude successfully calls function during discharge summary processing
- ✅ David Wilson's 3 diagnoses extracted and stored correctly

## Related Tasks

- Task 02: addVitalSigns() - Complementary clinical data
- Task 06: createCarePlan() - References diagnoses in care planning

## References

- **ICD-10 Format**: https://www.cdc.gov/nchs/icd/icd-10-cm.htm
- **IntelliCare Security**: CLAUDE.md lines 71-100
- **6-Step Checklist**: CLAUDE.md lines 21-69
