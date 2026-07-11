# Task 03: schedulePulmonologyFollowup() Tool

**Priority**: CRITICAL
**Timeline**: 3-4 days
**Complexity**: Medium
**Dependencies**: appointments collection, providers collection

## Problem Statement

Hospital discharge summaries frequently include specialist follow-up orders (e.g., "Follow-up with Pulmonology in 2 weeks"). Currently, IntelliCare extracts these as text but does not create scheduled appointments, leading to care coordination gaps and missed follow-ups.

**Example from David Wilson**:
- "Follow-up with Pulmonology in 2 weeks"
- No appointment auto-created
- Manual scheduling required
- High risk of patient falling through cracks

**Current Gap**: No automated appointment creation from discharge orders

## Tool Specification

### Function Name
`schedulePulmonologyFollowup()` (and generic `scheduleSpecialistFollowup()`)

### Parameters
```javascript
{
  patientId: string,              // Required
  specialty: string,              // "pulmonology" | "cardiology" | "neurology" | etc.
  timeframe: string,              // "2 weeks" | "1 month" | "3 months" | ISO date
  reason: string,                 // Visit reason (e.g., "COPD follow-up post-discharge")
  urgency: string,                // "routine" | "urgent" | "semi-urgent"
  preferredProvider: string,      // Provider ID or name (optional)
  appointmentType: string,        // "in-person" | "telehealth" | "either"
  notes: string,                  // Additional scheduling notes (optional)
  source: string,                 // "discharge_summary" | "clinic_visit" | "manual"
  dischargeDate: string           // Reference date for timeframe calculation (optional)
}
```

### Return Value
```javascript
{
  success: boolean,
  appointmentId: string,
  scheduledDate: string,          // Calculated appointment date
  status: string,                 // "pending" | "scheduled" | "confirmed"
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

- [ ] Verify appointments collection schema exists
- [ ] Add fields: specialty, timeframe, reason, urgency, source, status
- [ ] Add scheduling workflow fields (pending, scheduled, confirmed, completed, cancelled)
- [ ] Add indexes: patientId, specialty, scheduledDate, status

### Step 2: Collection Registration
**File**: `apps/backend-api/services/medicalCollectionsService.js`

- [ ] Verify appointments in allCollections array

### Step 3: Service Implementation
**File**: `apps/backend-api/services/appointmentService.js` (may already exist, extend it)

```javascript
async scheduleSpecialistFollowup(params, practiceContext) {
  const context = {
    serviceId: 'appointment-service',
    operation: 'schedule-specialist',
    practiceId: practiceContext.subdomain
  };

  // Calculate target appointment date from timeframe
  const scheduledDate = this.calculateTargetDate(
    params.timeframe,
    params.dischargeDate
  );

  // Find available specialist providers
  const providers = await this.findSpecialistProviders(
    params.specialty,
    params.preferredProvider,
    context
  );

  if (providers.length === 0) {
    console.warn(`⚠️ No ${params.specialty} providers found in practice`);
  }

  // Create appointment record
  const appointment = {
    patientId: params.patientId,
    specialty: params.specialty,
    appointmentType: params.appointmentType || 'in-person',
    scheduledDate: scheduledDate,
    reason: params.reason,
    urgency: params.urgency || 'routine',
    status: 'pending',              // Requires staff to finalize scheduling
    source: params.source || 'discharge_summary',
    notes: params.notes,
    preferredProvider: params.preferredProvider,
    availableProviders: providers.map(p => p._id),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await SecureDataAccess.insert(
    'appointments',
    appointment,
    context
  );

  // Create task for scheduling staff
  const actions = [{
    task: `Schedule ${params.specialty} follow-up appointment`,
    assignedTo: 'scheduling_staff',
    dueDate: scheduledDate,
    priority: params.urgency === 'urgent' ? 'high' : 'normal'
  }];

  return {
    success: true,
    appointmentId: result._id,
    scheduledDate: scheduledDate,
    status: 'pending',
    message: practiceContext.language === 'he'
      ? `תור ${params.specialty} נוצר בהצלחה - ממתין לאישור צוות`
      : `${params.specialty} follow-up created - pending staff confirmation`,
    actions: actions
  };
}

calculateTargetDate(timeframe, referenceDate = null) {
  const baseDate = referenceDate ? new Date(referenceDate) : new Date();

  // Parse timeframe (e.g., "2 weeks", "1 month", "3 months")
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

async findSpecialistProviders(specialty, preferredProvider, context) {
  // Query providers collection for specialists
  const providers = await SecureDataAccess.query(
    'providers',
    {
      specialty: specialty,
      status: 'active'
    },
    {},
    context
  );

  // Prioritize preferred provider if specified
  if (preferredProvider) {
    providers.sort((a, b) => {
      const aMatch = a.name === preferredProvider || a._id === preferredProvider;
      const bMatch = b.name === preferredProvider || b._id === preferredProvider;
      return bMatch - aMatch;
    });
  }

  return providers;
}
```

### Step 4: Function Registration
**File**: `apps/backend-api/services/utils/aiHelpers.js`

- [ ] Add scheduleSpecialistFollowup to getAllPlatformFunctions()
- [ ] Add specialty-specific convenience functions:
  - schedulePulmonologyFollowup
  - scheduleCardiologyFollowup
  - scheduleNeurologyFollowup
- [ ] Include clear description for Claude

Example:
```javascript
{
  name: "schedulePulmonologyFollowup",
  description: "Schedule pulmonology specialist follow-up appointment - USE THIS when discharge summary mentions 'follow-up with pulmonology'",
  parameters: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID" },
      timeframe: { type: "string", description: "When to schedule (e.g., '2 weeks', '1 month')" },
      reason: { type: "string", description: "Visit reason (e.g., 'COPD follow-up')" },
      urgency: { type: "string", enum: ["routine", "urgent", "semi-urgent"] }
    },
    required: ["patientId", "timeframe", "reason"]
  }
}
```

### Step 5: Agent System Prompt
**File**: `apps/backend-api/services/agentSystemPrompt.js`

- [ ] Add scheduleSpecialistFollowup (and specialty variants) to ALL_FUNCTION_NAMES
- [ ] Add usage instructions:
```javascript
STEP 4: SPECIALIST FOLLOW-UP SCHEDULING
   When discharge summary includes "Follow-up with [specialty] in [timeframe]":
   - Call appropriate specialty function (e.g., schedulePulmonologyFollowup)
   - Extract timeframe from text ("2 weeks" → timeframe: "2 weeks")
   - Provide clinical reason from discharge context
```

### Step 6: Route Integration
**File**: `apps/backend-api/routes/agent.js`

- [ ] Verify function executes through agentServiceV4.executeFunction()

## Testing Strategy

### Unit Tests
```javascript
// Test 1: Schedule routine pulmonology follow-up
await schedulePulmonologyFollowup({
  patientId: 'david_wilson',
  timeframe: '2 weeks',
  reason: 'COPD follow-up post-discharge',
  urgency: 'routine',
  source: 'discharge_summary',
  dischargeDate: '2025-10-15'
});
// Expected: scheduledDate = 2025-10-29

// Test 2: Calculate target date from various timeframes
calculateTargetDate('2 weeks', '2025-10-15')  // → 2025-10-29
calculateTargetDate('1 month', '2025-10-15')  // → 2025-11-15
calculateTargetDate('3 months', '2025-10-15') // → 2026-01-15

// Test 3: Find specialist providers
findSpecialistProviders('pulmonology', 'Dr. Adams')
// Should prioritize Dr. Adams if available

// Test 4: Urgent appointment priority
await scheduleSpecialistFollowup({
  urgency: 'urgent',
  timeframe: '1 week'
});
// Should create high-priority task
```

### Integration Test
```javascript
// Process David Wilson discharge summary
// Verify appointment created:
// - specialty: pulmonology
// - timeframe: 2 weeks from discharge
// - reason: COPD follow-up
// - status: pending
// - task created for scheduling staff
```

## Workflow Integration

### Status Progression
1. **pending** - Auto-created from discharge summary, awaiting staff action
2. **scheduled** - Staff confirmed date/time with specific provider
3. **confirmed** - Patient confirmed attendance
4. **completed** - Appointment occurred
5. **cancelled** - Appointment cancelled
6. **no-show** - Patient did not attend

### Staff Dashboard Integration
- Pending specialist appointments appear in "Scheduling Queue"
- Sorted by urgency (urgent → routine)
- One-click to open patient chart
- Calendar integration for available slots

### Patient Portal Integration
- Patient sees pending appointment request
- Can view available time slots
- Can confirm preferred time
- Receives reminders

## Success Criteria

- ✅ Tool creates appointments in appointments collection
- ✅ Target date calculated from timeframe
- ✅ Specialty providers identified
- ✅ Status workflow implemented (pending → scheduled → confirmed)
- ✅ Staff tasks created for follow-up
- ✅ Multi-tenant isolation maintained
- ✅ Claude successfully calls function during discharge summary processing
- ✅ David Wilson's pulmonology follow-up auto-scheduled

## Future Enhancements

- Smart scheduling (auto-book if slot available)
- Provider workload balancing
- Patient preference learning (time of day, telehealth vs in-person)
- Integration with external specialist networks
- Automated reminder system

## Related Tasks

- Task 04: orderPulmonaryFunctionTest() - Coordinate with specialist appointments
- Task 06: createCarePlan() - Include follow-up appointments in care plan

## References

- **Appointment Scheduling Best Practices**: https://www.ahrq.gov/cahps/quality-improvement/improvement-guide/6-strategies-for-improving/access/strategy6a-scheduling.html
- **IntelliCare Security**: CLAUDE.md lines 71-100
- **6-Step Checklist**: CLAUDE.md lines 21-69
