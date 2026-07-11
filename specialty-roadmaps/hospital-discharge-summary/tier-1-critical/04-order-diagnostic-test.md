# Task 04: orderPulmonaryFunctionTest() Tool

**Priority**: CRITICAL
**Timeline**: 3-4 days
**Complexity**: Medium
**Dependencies**: test_orders collection (may need creation), lab integration

## Problem Statement

Hospital discharge summaries frequently include diagnostic test orders for outpatient follow-up (e.g., "PFT in 1 month"). Currently, IntelliCare extracts these as text but does not create trackable test orders, leading to incomplete diagnostic follow-through and care quality gaps.

**Example from David Wilson**:
- "Pulmonary Function Test (PFT) in 1 month"
- No test order created in system
- Manual ordering required
- No tracking of pending tests
- Risk of test not being completed

**Current Gap**: No automated diagnostic test ordering from discharge instructions

## Tool Specification

### Function Name
`orderPulmonaryFunctionTest()` (and generic `orderDiagnosticTest()`)

### Parameters
```javascript
{
  patientId: string,              // Required
  testType: string,               // "PFT" | "spirometry" | "chest_xray" | "CT_chest" | etc.
  testName: string,               // Full test name (e.g., "Pulmonary Function Test with DLCO")
  timeframe: string,              // "1 month" | "3 months" | ISO date
  urgency: string,                // "routine" | "urgent" | "stat"
  clinicalIndication: string,     // Reason for test (e.g., "COPD monitoring post-discharge")
  orderingProvider: string,       // Provider ID or name
  preferredFacility: string,      // Lab/imaging facility (optional)
  specialInstructions: string,    // Test-specific instructions (optional)
  icd10Codes: [string],           // Diagnosis codes for billing (optional)
  source: string,                 // "discharge_summary" | "clinic_visit" | "manual"
  dischargeDate: string           // Reference date for timeframe calculation (optional)
}
```

### Return Value
```javascript
{
  success: boolean,
  testOrderId: string,
  scheduledDate: string,          // Calculated target date
  status: string,                 // "pending" | "scheduled" | "completed" | "resulted"
  message: string,
  actions: [                      // Next steps for staff
    {
      task: string,
      assignedTo: string,
      dueDate: string
    }
  ]
}
```

## Implementation Checklist

### Step 1: Schema Definition
**File**: `apps/backend-api/services/collectionSchemas.js`

- [ ] Create test_orders collection schema (if doesn't exist)
- [ ] Add fields: testType, testName, timeframe, scheduledDate, urgency, clinicalIndication, status
- [ ] Add result fields: resultDate, resultFile, interpretedBy
- [ ] Add workflow fields: pending, scheduled, completed, resulted, cancelled
- [ ] Add indexes: patientId, testType, scheduledDate, status

Example schema:
```javascript
test_orders: {
  patientId: { type: 'string', required: true },
  testType: { type: 'string', required: true },
  testName: { type: 'string', required: true },
  timeframe: { type: 'string' },
  scheduledDate: { type: 'date' },
  urgency: { type: 'string', enum: ['routine', 'urgent', 'stat'] },
  clinicalIndication: { type: 'string' },
  orderingProvider: { type: 'string' },
  preferredFacility: { type: 'string' },
  specialInstructions: { type: 'string' },
  icd10Codes: [{ type: 'string' }],
  status: { type: 'string', enum: ['pending', 'scheduled', 'completed', 'resulted', 'cancelled'] },
  source: { type: 'string' },
  resultDate: { type: 'date' },
  resultFile: { type: 'string' },
  interpretedBy: { type: 'string' },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' }
}
```

### Step 2: Collection Registration
**File**: `apps/backend-api/services/medicalCollectionsService.js`

- [ ] Add test_orders to allCollections array
- [ ] Set display name: "Diagnostic Test Orders"
- [ ] Set category: "diagnostic"

### Step 3: Service Implementation
**File**: `apps/backend-api/services/diagnosticTestService.js` (create new)

```javascript
const SecureDataAccess = require('./secureDataAccess');

class DiagnosticTestService {
  async orderDiagnosticTest(params, practiceContext) {
    const context = {
      serviceId: 'diagnostic-test-service',
      operation: 'order-test',
      practiceId: practiceContext.subdomain
    };

    // Calculate target test date from timeframe
    const scheduledDate = this.calculateTargetDate(
      params.timeframe,
      params.dischargeDate
    );

    // Validate test type
    if (!this.isValidTestType(params.testType)) {
      throw new Error(`Invalid test type: ${params.testType}`);
    }

    // Create test order
    const testOrder = {
      patientId: params.patientId,
      testType: params.testType,
      testName: params.testName,
      timeframe: params.timeframe,
      scheduledDate: scheduledDate,
      urgency: params.urgency || 'routine',
      clinicalIndication: params.clinicalIndication,
      orderingProvider: params.orderingProvider,
      preferredFacility: params.preferredFacility,
      specialInstructions: params.specialInstructions,
      icd10Codes: params.icd10Codes || [],
      status: 'pending',              // Requires staff to schedule
      source: params.source || 'discharge_summary',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await SecureDataAccess.insert(
      'test_orders',
      testOrder,
      context
    );

    // Create task for lab scheduling staff
    const actions = [{
      task: `Schedule ${params.testName}`,
      assignedTo: 'lab_scheduling_staff',
      dueDate: scheduledDate,
      priority: params.urgency === 'urgent' || params.urgency === 'stat' ? 'high' : 'normal'
    }];

    if (process.env.QUIET_LOGS !== 'true') {
      console.log(`✅ [Diagnostic Test] Created ${params.testType} order for patient ${params.patientId}`);
    }

    return {
      success: true,
      testOrderId: result._id,
      scheduledDate: scheduledDate,
      status: 'pending',
      message: practiceContext.language === 'he'
        ? `הזמנת ${params.testName} נוצרה בהצלחה - ממתינה לתזמון`
        : `${params.testName} order created - pending scheduling`,
      actions: actions
    };
  }

  calculateTargetDate(timeframe, referenceDate = null) {
    const baseDate = referenceDate ? new Date(referenceDate) : new Date();

    // Parse timeframe (e.g., "1 month", "3 months", "6 weeks")
    const match = timeframe.match(/(\d+)\s*(day|week|month|year)s?/i);
    if (!match) {
      // If timeframe is ISO date, use it directly
      return new Date(timeframe);
    }

    const [, amount, unit] = match;
    const targetDate = new Date(baseDate);

    switch (unit.toLowerCase()) {
      case 'day':
        targetDate.setDate(targetDate.getDate() + parseInt(amount));
        break;
      case 'week':
        targetDate.setDate(targetDate.getDate() + (parseInt(amount) * 7));
        break;
      case 'month':
        targetDate.setMonth(targetDate.getMonth() + parseInt(amount));
        break;
      case 'year':
        targetDate.setFullYear(targetDate.getFullYear() + parseInt(amount));
        break;
    }

    return targetDate.toISOString();
  }

  isValidTestType(testType) {
    const validTypes = [
      'PFT', 'spirometry', 'chest_xray', 'CT_chest', 'CT_scan',
      'MRI', 'ultrasound', 'ECG', 'echocardiogram', 'stress_test',
      'blood_work', 'allergy_test', 'skin_prick_test'
    ];
    return validTypes.includes(testType);
  }

  // Convenience method for PFT specifically
  async orderPulmonaryFunctionTest(params, practiceContext) {
    return this.orderDiagnosticTest({
      ...params,
      testType: 'PFT',
      testName: params.testName || 'Pulmonary Function Test'
    }, practiceContext);
  }
}

module.exports = new DiagnosticTestService();
```

### Step 4: Function Registration
**File**: `apps/backend-api/services/utils/aiHelpers.js`

- [ ] Add orderDiagnosticTest to getAllPlatformFunctions()
- [ ] Add test-specific convenience functions:
  - orderPulmonaryFunctionTest
  - orderChestXray
  - orderCTChest
- [ ] Include clear description for Claude

Example:
```javascript
{
  name: "orderPulmonaryFunctionTest",
  description: "Order Pulmonary Function Test (PFT) - USE THIS when discharge summary mentions 'PFT in [timeframe]' or 'pulmonary function test'",
  parameters: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID" },
      timeframe: { type: "string", description: "When to schedule (e.g., '1 month', '3 months')" },
      clinicalIndication: { type: "string", description: "Reason for test (e.g., 'COPD monitoring')" },
      urgency: { type: "string", enum: ["routine", "urgent", "stat"] }
    },
    required: ["patientId", "timeframe", "clinicalIndication"]
  }
}
```

### Step 5: Agent System Prompt
**File**: `apps/backend-api/services/agentSystemPrompt.js`

- [ ] Add orderDiagnosticTest (and test variants) to ALL_FUNCTION_NAMES
- [ ] Add usage instructions:
```javascript
STEP 5: DIAGNOSTIC TEST ORDERING
   When discharge summary includes test orders (e.g., "PFT in 1 month"):
   - Call appropriate test function (e.g., orderPulmonaryFunctionTest)
   - Extract timeframe from text ("1 month" → timeframe: "1 month")
   - Provide clinical indication from discharge context
```

### Step 6: Route Integration
**File**: `apps/backend-api/routes/agent.js`

- [ ] Add explicit case for orderDiagnosticTest (if needed)
- [ ] Or verify function executes through agentServiceV4.executeFunction()

## Testing Strategy

### Unit Tests
```javascript
// Test 1: Order routine PFT
await orderPulmonaryFunctionTest({
  patientId: 'david_wilson',
  timeframe: '1 month',
  clinicalIndication: 'COPD monitoring post-discharge',
  urgency: 'routine',
  orderingProvider: 'Dr. Johnson',
  source: 'discharge_summary',
  dischargeDate: '2025-10-15'
});
// Expected: scheduledDate = 2025-11-15

// Test 2: Calculate target date
calculateTargetDate('1 month', '2025-10-15')  // → 2025-11-15
calculateTargetDate('3 months', '2025-10-15') // → 2026-01-15

// Test 3: Urgent test priority
await orderDiagnosticTest({
  testType: 'CT_chest',
  urgency: 'urgent',
  timeframe: '1 week'
});
// Should create high-priority task

// Test 4: Invalid test type
await orderDiagnosticTest({ testType: 'invalid_test' });
// Should throw validation error
```

### Integration Test
```javascript
// Process David Wilson discharge summary
// Verify test order created:
// - testType: PFT
// - timeframe: 1 month from discharge
// - clinicalIndication: COPD monitoring
// - status: pending
// - task created for lab scheduling staff
```

## Workflow Integration

### Status Progression
1. **pending** - Auto-created from discharge summary, awaiting scheduling
2. **scheduled** - Staff confirmed date/time at specific facility
3. **completed** - Test performed, awaiting results
4. **resulted** - Results available, needs interpretation
5. **cancelled** - Test cancelled

### Staff Dashboard Integration
- Pending test orders appear in "Lab Scheduling Queue"
- Sorted by urgency and target date
- One-click to open patient chart
- Facility integration for available slots

### Results Integration
- When test completed, update status to "resulted"
- Attach result file (PDF, image, etc.)
- Notify ordering provider
- Extract structured data if possible (e.g., PFT values)

## Success Criteria

- ✅ Tool creates test orders in test_orders collection
- ✅ Target date calculated from timeframe
- ✅ Status workflow implemented (pending → scheduled → completed → resulted)
- ✅ Staff tasks created for follow-up
- ✅ Multi-tenant isolation maintained
- ✅ Claude successfully calls function during discharge summary processing
- ✅ David Wilson's PFT order auto-created

## Future Enhancements

- Integration with lab/imaging facility APIs
- Auto-scheduling if facility slots available
- Result auto-import and parsing
- Trending analysis (compare to previous tests)
- Critical result alerting
- Patient portal access to results

## Related Tasks

- Task 03: scheduleSpecialistFollowup() - Coordinate tests with specialist appointments
- Task 06: createCarePlan() - Include test orders in care plan

## References

- **Diagnostic Test Management**: https://www.ahrq.gov/patient-safety/reports/engage/interventions/tests.html
- **IntelliCare Security**: CLAUDE.md lines 71-100
- **6-Step Checklist**: CLAUDE.md lines 21-69
