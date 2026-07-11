# Task 06: createCarePlan() Tool

**Priority**: CRITICAL
**Timeline**: 4-5 days
**Complexity**: Medium-High
**Dependencies**: care_plans collection schema

## Problem Statement

Hospital discharge summaries often include structured care plans (e.g., "COPD Action Plan" with green/yellow/red zones). Currently, IntelliCare extracts these as unstructured text, preventing:
- Patient access to digital, actionable care plans
- Self-management support
- Automated monitoring against plan criteria
- Care coordination across providers
- Outcomes tracking

**Example from David Wilson**:
- COPD Action Plan with symptom-based zones
- Green Zone: Stable (continue current medications)
- Yellow Zone: Worsening (increase inhaler use, contact provider)
- Red Zone: Emergency (call 911, go to ER)

**Current Gap**: No structured care plan storage or patient engagement tools

## Tool Specification

### Function Name
`createCarePlan()`

### Parameters
```javascript
{
  patientId: string,              // Required
  planType: string,               // Required (e.g., "COPD Action Plan", "Diabetes Management", "Asthma Action Plan")
  diagnosis: string,              // Related diagnosis (e.g., "COPD exacerbation")
  icd10Code: string,              // Related ICD-10 code (optional)
  goals: [                        // Care plan goals
    {
      goal: string,               // Goal description
      targetDate: string,         // ISO date (optional)
      status: string,             // "active" | "achieved" | "modified" | "abandoned"
      measurableOutcome: string   // How to measure success (optional)
    }
  ],
  interventions: [                // Care plan interventions
    {
      intervention: string,       // Intervention description
      frequency: string,          // How often (e.g., "daily", "as needed")
      provider: string,           // Who performs (patient, nurse, physician)
      status: string              // "active" | "completed" | "discontinued"
    }
  ],
  actionPlan: {                   // Condition-specific action zones (optional)
    greenZone: {
      criteria: string,           // What qualifies as green
      actions: [string]           // What to do in green zone
    },
    yellowZone: {
      criteria: string,
      actions: [string]
    },
    redZone: {
      criteria: string,
      actions: [string]
    }
  },
  medications: [                  // Related medications (optional)
    {
      medicationName: string,
      purpose: string,
      instructions: string
    }
  ],
  appointments: [                 // Related appointments (optional)
    {
      appointmentType: string,
      frequency: string,
      provider: string
    }
  ],
  educationProvided: [string],    // Patient education topics
  barriers: [string],             // Identified barriers to plan adherence
  createdBy: string,              // Provider who created plan
  createdDate: string,            // ISO date
  reviewDate: string,             // When plan should be reviewed
  status: string,                 // "active" | "completed" | "suspended" | "cancelled"
  source: string                  // "discharge_summary" | "clinic_visit" | "manual"
}
```

### Return Value
```javascript
{
  success: boolean,
  carePlanId: string,
  message: string,
  patientAccessUrl: string        // URL for patient to view care plan
}
```

## Implementation Checklist

### Step 1: Schema Definition
**File**: `apps/backend-api/services/collectionSchemas.js`

- [ ] Create care_plans collection schema (if doesn't exist)
- [ ] Add fields: planType, diagnosis, goals array, interventions array, actionPlan object
- [ ] Add patient engagement fields: patientViewed, lastAccessDate, adherenceScore
- [ ] Add review tracking: reviewDate, lastReviewDate, reviewedBy
- [ ] Add indexes: patientId, planType, status, createdDate

Example schema:
```javascript
care_plans: {
  patientId: { type: 'string', required: true },
  planType: { type: 'string', required: true },
  diagnosis: { type: 'string' },
  icd10Code: { type: 'string' },
  goals: [{
    goal: { type: 'string' },
    targetDate: { type: 'date' },
    status: { type: 'string' },
    measurableOutcome: { type: 'string' }
  }],
  interventions: [{
    intervention: { type: 'string' },
    frequency: { type: 'string' },
    provider: { type: 'string' },
    status: { type: 'string' }
  }],
  actionPlan: {
    greenZone: {
      criteria: { type: 'string' },
      actions: [{ type: 'string' }]
    },
    yellowZone: {
      criteria: { type: 'string' },
      actions: [{ type: 'string' }]
    },
    redZone: {
      criteria: { type: 'string' },
      actions: [{ type: 'string' }]
    }
  },
  medications: [{
    medicationName: { type: 'string' },
    purpose: { type: 'string' },
    instructions: { type: 'string' }
  }],
  appointments: [{
    appointmentType: { type: 'string' },
    frequency: { type: 'string' },
    provider: { type: 'string' }
  }],
  educationProvided: [{ type: 'string' }],
  barriers: [{ type: 'string' }],
  createdBy: { type: 'string' },
  createdDate: { type: 'date' },
  reviewDate: { type: 'date' },
  lastReviewDate: { type: 'date' },
  reviewedBy: { type: 'string' },
  status: { type: 'string', enum: ['active', 'completed', 'suspended', 'cancelled'] },
  source: { type: 'string' },
  patientViewed: { type: 'boolean', default: false },
  lastAccessDate: { type: 'date' },
  adherenceScore: { type: 'number' },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' }
}
```

### Step 2: Collection Registration
**File**: `apps/backend-api/services/medicalCollectionsService.js`

- [ ] Add care_plans to allCollections array
- [ ] Set display name: "Care Plans"
- [ ] Set category: "care_coordination"

### Step 3: Service Implementation
**File**: `apps/backend-api/services/carePlanService.js` (create new)

```javascript
const SecureDataAccess = require('./secureDataAccess');

class CarePlanService {
  async createCarePlan(params, practiceContext) {
    const context = {
      serviceId: 'care-plan-service',
      operation: 'create',
      practiceId: practiceContext.subdomain
    };

    // Validate required fields
    if (!params.planType) {
      throw new Error(practiceContext.language === 'he'
        ? 'סוג תוכנית הטיפול נדרש'
        : 'Care plan type is required');
    }

    // Check for existing active care plan of same type
    const existing = await SecureDataAccess.query(
      'care_plans',
      {
        patientId: params.patientId,
        planType: params.planType,
        status: 'active'
      },
      {},
      context
    );

    // If existing plan found, consider updating or creating new version
    if (existing.length > 0) {
      console.warn(`⚠️ [Care Plan] Active ${params.planType} already exists for patient ${params.patientId}`);
      // Could auto-version or suspend old plan here
    }

    // Create care plan
    const carePlan = {
      ...params,
      status: params.status || 'active',
      patientViewed: false,
      createdDate: params.createdDate || new Date().toISOString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await SecureDataAccess.insert(
      'care_plans',
      carePlan,
      context
    );

    // Generate patient access URL
    const patientAccessUrl = this.generatePatientAccessUrl(
      result._id,
      practiceContext.subdomain
    );

    if (process.env.QUIET_LOGS !== 'true') {
      console.log(`✅ [Care Plan] Created ${params.planType} for patient ${params.patientId}`);
    }

    return {
      success: true,
      carePlanId: result._id,
      message: practiceContext.language === 'he'
        ? 'תוכנית הטיפול נוצרה בהצלחה'
        : 'Care plan created successfully',
      patientAccessUrl: patientAccessUrl
    };
  }

  generatePatientAccessUrl(carePlanId, practiceSubdomain) {
    // Generate URL for patient portal access
    return `https://${practiceSubdomain}.intellicare.health/patient/care-plan/${carePlanId}`;
  }

  async getActiveCarePlans(patientId, practiceContext) {
    const context = {
      serviceId: 'care-plan-service',
      operation: 'get-active',
      practiceId: practiceContext.subdomain
    };

    const plans = await SecureDataAccess.query(
      'care_plans',
      {
        patientId: patientId,
        status: 'active'
      },
      { sort: { createdDate: -1 } },
      context
    );

    return plans;
  }

  async updateCarePlanStatus(carePlanId, newStatus, practiceContext) {
    const context = {
      serviceId: 'care-plan-service',
      operation: 'update-status',
      practiceId: practiceContext.subdomain
    };

    const result = await SecureDataAccess.update(
      'care_plans',
      { _id: carePlanId },
      {
        status: newStatus,
        updatedAt: new Date()
      },
      context
    );

    return result;
  }
}

module.exports = new CarePlanService();
```

### Step 4: Function Registration
**File**: `apps/backend-api/services/utils/aiHelpers.js`

- [ ] Add createCarePlan to getAllPlatformFunctions() (lines 1000-1300)
- [ ] Include clear description for Claude

Example:
```javascript
{
  name: "createCarePlan",
  description: "Create structured care plan - USE THIS when discharge summary includes action plans (COPD Action Plan, Diabetes Management Plan, etc.)",
  parameters: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID" },
      planType: { type: "string", description: "Plan type (e.g., 'COPD Action Plan')" },
      diagnosis: { type: "string", description: "Related diagnosis" },
      goals: {
        type: "array",
        description: "Care plan goals",
        items: {
          type: "object",
          properties: {
            goal: { type: "string" },
            status: { type: "string" }
          }
        }
      },
      actionPlan: {
        type: "object",
        description: "Condition-specific action zones (green/yellow/red)",
        properties: {
          greenZone: {
            type: "object",
            properties: {
              criteria: { type: "string" },
              actions: { type: "array", items: { type: "string" } }
            }
          },
          yellowZone: {
            type: "object",
            properties: {
              criteria: { type: "string" },
              actions: { type: "array", items: { type: "string" } }
            }
          },
          redZone: {
            type: "object",
            properties: {
              criteria: { type: "string" },
              actions: { type: "array", items: { type: "string" } }
            }
          }
        }
      }
    },
    required: ["patientId", "planType"]
  }
}
```

### Step 5: Agent System Prompt
**File**: `apps/backend-api/services/agentSystemPrompt.js`

- [ ] Add createCarePlan to ALL_FUNCTION_NAMES array
- [ ] Add usage instructions:
```javascript
STEP 7: CARE PLAN CREATION
   When discharge summary includes structured care plans (Action Plans):
   - Call createCarePlan() with full plan details
   - Extract goals, interventions, and action zones
   - Include medications and appointments in plan
   - Provide patient education topics
```

### Step 6: Frontend Integration (Optional but Recommended)
**File**: Create patient portal care plan viewer

- [ ] Create care plan detail page
- [ ] Display action zones with color coding (green/yellow/red)
- [ ] Print-friendly format
- [ ] Track patient access (set patientViewed flag)

## Testing Strategy

### Unit Tests
```javascript
// Test 1: Create COPD Action Plan
await createCarePlan({
  patientId: 'david_wilson',
  planType: 'COPD Action Plan',
  diagnosis: 'COPD exacerbation',
  goals: [
    { goal: 'Maintain stable breathing', status: 'active' }
  ],
  actionPlan: {
    greenZone: {
      criteria: 'No shortness of breath, cough controlled',
      actions: ['Continue current medications', 'Daily activity as tolerated']
    },
    yellowZone: {
      criteria: 'Increased shortness of breath, more cough',
      actions: ['Increase rescue inhaler use', 'Contact provider within 24 hours']
    },
    redZone: {
      criteria: 'Severe shortness of breath, chest pain',
      actions: ['Call 911', 'Go to emergency room immediately']
    }
  },
  createdBy: 'Dr. Johnson',
  source: 'discharge_summary'
});

// Test 2: Duplicate active plan detection
// Should warn if active plan already exists

// Test 3: Patient access URL generation
// Should generate proper URL with practice subdomain

// Test 4: Multi-tenant isolation
// Practice A cannot see Practice B care plans
```

### Integration Test
```javascript
// Process David Wilson discharge summary
// Verify care plan created:
// - planType: COPD Action Plan
// - All 3 zones (green/yellow/red) populated
// - Medications linked
// - Patient education included
// - status: active
```

## Success Criteria

- ✅ Tool creates care plans in care_plans collection
- ✅ Action plan zones supported (green/yellow/red)
- ✅ Goals and interventions structured
- ✅ Patient access URL generated
- ✅ Multi-tenant isolation maintained
- ✅ Claude successfully calls function during discharge summary processing
- ✅ David Wilson's COPD Action Plan created with all zones

## Future Enhancements

### Patient Portal Features
- Interactive care plan viewer
- Progress tracking against goals
- Zone self-assessment tool
- Medication reminders tied to plan
- Appointment scheduling from plan

### Provider Features
- Care plan templates library
- Adherence monitoring dashboard
- Outcomes tracking
- Care plan version history
- Collaborative care planning (multi-provider)

### Analytics
- Plan effectiveness analysis
- Adherence correlation with outcomes
- Population health insights
- Quality metrics reporting

## Related Tasks

- Task 01: createDiagnosis() - Link care plans to diagnoses
- Task 02: addVitalSigns() - Include vital sign targets in plans
- Task 03: scheduleSpecialistFollowup() - Include appointments in plans
- Task 04: orderDiagnosticTest() - Include test orders in plans
- Task 05: addVaccination() - Include vaccination schedule in plans

## References

- **Care Planning Standards**: https://www.ahrq.gov/patient-safety/reports/engage/interventions/care-plans.html
- **COPD Action Plans**: https://www.lung.org/lung-health-diseases/lung-disease-lookup/copd/living-with-copd/copd-management-plan
- **IntelliCare Security**: CLAUDE.md lines 71-100
- **6-Step Checklist**: CLAUDE.md lines 21-69
