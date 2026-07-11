# Task 05: addVaccination() Tool

**Priority**: CRITICAL
**Timeline**: 2-3 days
**Complexity**: Low-Medium
**Dependencies**: vaccinations collection schema

## Problem Statement

Hospital discharge summaries often document vaccinations administered during hospitalization (e.g., "Pneumococcal vaccine administered"). Currently, IntelliCare extracts these as text but does not record them in the vaccinations collection, leading to incomplete immunization histories and potential duplicate vaccinations.

**Example from David Wilson**:
- "Pneumococcal vaccine administered during hospitalization"
- Vaccine NOT recorded in vaccinations collection
- Immunization history incomplete
- Risk of duplicate vaccination
- CDC reporting impossible

**Current Gap**: No structured immunization recording from discharge documentation

## Tool Specification

### Function Name
`addVaccination()`

### Parameters
```javascript
{
  patientId: string,              // Required
  vaccineName: string,            // Required (e.g., "Pneumococcal polysaccharide (PPSV23)")
  vaccineCode: string,            // CVX code (optional, e.g., "33" for PPSV23)
  administrationDate: string,     // ISO date (required)
  lotNumber: string,              // Vaccine lot number (optional)
  manufacturer: string,           // Vaccine manufacturer (optional)
  expirationDate: string,         // Vaccine expiration date (optional)
  site: string,                   // Administration site (e.g., "left deltoid")
  route: string,                  // Administration route (e.g., "intramuscular")
  doseNumber: number,             // Dose in series (e.g., 1, 2, 3)
  seriesTotal: number,            // Total doses in series (optional)
  administeredBy: string,         // Provider/nurse ID or name
  location: string,               // "hospital" | "clinic" | "pharmacy" | "home"
  notes: string,                  // Additional notes (optional)
  source: string,                 // "discharge_summary" | "clinic_visit" | "manual"
  reactions: [                    // Adverse reactions (optional)
    {
      reaction: string,
      severity: string,
      onset: string
    }
  ]
}
```

### Return Value
```javascript
{
  success: boolean,
  vaccinationId: string,
  message: string,
  nextDose: {                     // If part of series
    dueDate: string,
    vaccineName: string
  }
}
```

## Implementation Checklist

### Step 1: Schema Definition
**File**: `apps/backend-api/services/collectionSchemas.js`

- [ ] Verify vaccinations collection schema exists
- [ ] Add fields: vaccineName, vaccineCode (CVX), lotNumber, manufacturer, site, route, doseNumber
- [ ] Add series tracking: doseNumber, seriesTotal, nextDoseDate
- [ ] Add adverse reactions array
- [ ] Add indexes: patientId, vaccineName, administrationDate

Example schema:
```javascript
vaccinations: {
  patientId: { type: 'string', required: true },
  vaccineName: { type: 'string', required: true },
  vaccineCode: { type: 'string' },  // CVX code
  administrationDate: { type: 'date', required: true },
  lotNumber: { type: 'string' },
  manufacturer: { type: 'string' },
  expirationDate: { type: 'date' },
  site: { type: 'string' },
  route: { type: 'string' },
  doseNumber: { type: 'number' },
  seriesTotal: { type: 'number' },
  administeredBy: { type: 'string' },
  location: { type: 'string' },
  notes: { type: 'string' },
  source: { type: 'string' },
  reactions: [{
    reaction: { type: 'string' },
    severity: { type: 'string' },
    onset: { type: 'string' }
  }],
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' }
}
```

### Step 2: Collection Registration
**File**: `apps/backend-api/services/medicalCollectionsService.js`

- [ ] Verify vaccinations in allCollections array

### Step 3: Service Implementation
**File**: `apps/backend-api/services/vaccinationService.js` (create if doesn't exist)

```javascript
const SecureDataAccess = require('./secureDataAccess');

class VaccinationService {
  async addVaccination(params, practiceContext) {
    const context = {
      serviceId: 'vaccination-service',
      operation: 'add',
      practiceId: practiceContext.subdomain
    };

    // Validate vaccine name
    if (!params.vaccineName) {
      throw new Error(practiceContext.language === 'he'
        ? 'שם החיסון נדרש'
        : 'Vaccine name is required');
    }

    // Check for duplicate vaccination (same vaccine within 30 days)
    const duplicateCheck = await this.checkDuplicate(
      params.patientId,
      params.vaccineName,
      params.administrationDate,
      context
    );

    if (duplicateCheck) {
      console.warn(`⚠️ [Vaccination] Possible duplicate vaccination detected for ${params.patientId}: ${params.vaccineName}`);
      return {
        success: true,
        vaccinationId: duplicateCheck._id,
        message: practiceContext.language === 'he'
          ? 'חיסון זה כבר קיים ברשומות'
          : 'This vaccination is already recorded'
      };
    }

    // Normalize vaccine name to CVX code if possible
    const cvxCode = this.getCVXCode(params.vaccineName);
    if (cvxCode && !params.vaccineCode) {
      params.vaccineCode = cvxCode;
    }

    // Create vaccination record
    const vaccination = {
      ...params,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await SecureDataAccess.insert(
      'vaccinations',
      vaccination,
      context
    );

    // Calculate next dose if part of series
    let nextDose = null;
    if (params.doseNumber && params.seriesTotal && params.doseNumber < params.seriesTotal) {
      nextDose = this.calculateNextDose(
        params.vaccineName,
        params.doseNumber,
        params.administrationDate
      );
    }

    if (process.env.QUIET_LOGS !== 'true') {
      console.log(`✅ [Vaccination] Recorded ${params.vaccineName} for patient ${params.patientId}`);
    }

    return {
      success: true,
      vaccinationId: result._id,
      message: practiceContext.language === 'he'
        ? 'החיסון נרשם בהצלחה'
        : 'Vaccination recorded successfully',
      nextDose: nextDose
    };
  }

  async checkDuplicate(patientId, vaccineName, administrationDate, context) {
    // Check for same vaccine within 30 days
    const checkDate = new Date(administrationDate);
    const beforeDate = new Date(checkDate);
    beforeDate.setDate(beforeDate.getDate() - 30);
    const afterDate = new Date(checkDate);
    afterDate.setDate(afterDate.getDate() + 30);

    const existing = await SecureDataAccess.query(
      'vaccinations',
      {
        patientId: patientId,
        vaccineName: vaccineName,
        administrationDate: {
          $gte: beforeDate.toISOString(),
          $lte: afterDate.toISOString()
        }
      },
      {},
      context
    );

    return existing.length > 0 ? existing[0] : null;
  }

  getCVXCode(vaccineName) {
    // CDC CVX vaccine codes
    const cvxMap = {
      'pneumococcal polysaccharide': '33',
      'ppsv23': '33',
      'pneumococcal conjugate': '133',
      'pcv13': '133',
      'influenza': '141',
      'flu': '141',
      'covid-19': '208',
      'hepatitis b': '08',
      'tdap': '115',
      'shingles': '121',
      'mmr': '03'
    };

    const lowerName = vaccineName.toLowerCase();
    for (const [key, code] of Object.entries(cvxMap)) {
      if (lowerName.includes(key)) {
        return code;
      }
    }
    return null;
  }

  calculateNextDose(vaccineName, currentDose, lastDoseDate) {
    // Vaccine series schedules
    const schedules = {
      'hepatitis b': [0, 28, 168],      // Days: 0, 1 month, 6 months
      'covid-19': [0, 21],               // Days: 0, 3 weeks
      'shingles': [0, 60],               // Days: 0, 2 months
      'pneumococcal conjugate': [0, 60, 120, 365]  // Days: 0, 2mo, 4mo, 12mo
    };

    const lowerName = vaccineName.toLowerCase();
    for (const [key, schedule] of Object.entries(schedules)) {
      if (lowerName.includes(key)) {
        if (currentDose < schedule.length) {
          const daysUntilNext = schedule[currentDose];
          const nextDate = new Date(lastDoseDate);
          nextDate.setDate(nextDate.getDate() + daysUntilNext);

          return {
            dueDate: nextDate.toISOString(),
            vaccineName: vaccineName,
            doseNumber: currentDose + 1
          };
        }
      }
    }

    return null;
  }
}

module.exports = new VaccinationService();
```

### Step 4: Function Registration
**File**: `apps/backend-api/services/utils/aiHelpers.js`

- [ ] Add addVaccination to getAllPlatformFunctions() (lines 1000-1300)
- [ ] Include clear description for Claude

Example:
```javascript
{
  name: "addVaccination",
  description: "Record vaccination/immunization - USE THIS when discharge summary mentions 'vaccine administered' or 'immunization given'",
  parameters: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID" },
      vaccineName: { type: "string", description: "Vaccine name (e.g., 'Pneumococcal polysaccharide')" },
      administrationDate: { type: "string", description: "ISO date when administered" },
      site: { type: "string", description: "Administration site (e.g., 'left deltoid')" },
      route: { type: "string", description: "Route (e.g., 'intramuscular')" },
      administeredBy: { type: "string", description: "Who administered" },
      location: { type: "string", description: "Where administered (hospital, clinic, etc.)" }
    },
    required: ["patientId", "vaccineName", "administrationDate"]
  }
}
```

### Step 5: Agent System Prompt
**File**: `apps/backend-api/services/agentSystemPrompt.js`

- [ ] Add addVaccination to ALL_FUNCTION_NAMES array
- [ ] Add usage instructions:
```javascript
STEP 6: VACCINATION RECORDING
   When discharge summary mentions vaccines/immunizations administered:
   - Call addVaccination() for each vaccine
   - Extract administration date, site, route from context
   - Include location as "hospital" for inpatient vaccinations
```

### Step 6: Route Integration
**File**: `apps/backend-api/routes/agent.js`

- [ ] Verify function executes through agentServiceV4.executeFunction()

## Testing Strategy

### Unit Tests
```javascript
// Test 1: Add pneumococcal vaccine
await addVaccination({
  patientId: 'david_wilson',
  vaccineName: 'Pneumococcal polysaccharide (PPSV23)',
  administrationDate: '2025-10-15',
  site: 'left deltoid',
  route: 'intramuscular',
  administeredBy: 'Nurse Johnson',
  location: 'hospital',
  source: 'discharge_summary'
});

// Test 2: Duplicate detection
// Add same vaccine twice within 30 days - should detect duplicate

// Test 3: CVX code auto-population
// Should auto-add CVX code "33" for PPSV23

// Test 4: Series tracking
await addVaccination({
  vaccineName: 'Hepatitis B',
  doseNumber: 1,
  seriesTotal: 3
});
// Should return nextDose with dueDate

// Test 5: Multi-tenant isolation
// Practice A cannot see Practice B vaccinations
```

### Integration Test
```javascript
// Process David Wilson discharge summary
// Verify vaccination recorded:
// - vaccineName: Pneumococcal polysaccharide
// - administrationDate: during hospitalization
// - location: hospital
// - source: discharge_summary
```

## CDC CVX Vaccine Codes (Common)

| Vaccine | CVX Code |
|---------|----------|
| Pneumococcal polysaccharide (PPSV23) | 33 |
| Pneumococcal conjugate (PCV13) | 133 |
| Influenza | 141 |
| COVID-19 | 208 |
| Hepatitis B | 08 |
| Tdap | 115 |
| Shingles | 121 |
| MMR | 03 |
| Varicella | 21 |

## Success Criteria

- ✅ Tool records vaccinations in vaccinations collection
- ✅ All parameters supported (vaccine name, date, site, route, lot, etc.)
- ✅ Duplicate detection prevents redundant entries
- ✅ CVX code auto-population working
- ✅ Series tracking implemented (next dose calculation)
- ✅ Multi-tenant isolation maintained
- ✅ Claude successfully calls function during discharge summary processing
- ✅ David Wilson's pneumococcal vaccine recorded correctly

## Future Enhancements

- CDC immunization registry integration (IIS)
- Vaccine contraindication checking
- Adverse event reporting (VAERS)
- Immunization schedule recommendations
- Patient portal access to immunization history
- QR code generation for vaccine cards

## Related Tasks

- Task 01: createDiagnosis() - Link vaccinations to diagnoses (e.g., COPD → pneumococcal vaccine)
- Task 06: createCarePlan() - Include vaccination schedule in care plans

## References

- **CDC CVX Codes**: https://www2.cdc.gov/vaccines/iis/iisstandards/vaccines.asp
- **Immunization Schedules**: https://www.cdc.gov/vaccines/schedules/index.html
- **IntelliCare Security**: CLAUDE.md lines 71-100
- **6-Step Checklist**: CLAUDE.md lines 21-69
