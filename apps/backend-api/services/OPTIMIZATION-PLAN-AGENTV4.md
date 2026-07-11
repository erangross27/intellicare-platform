# AgentServiceV4 Optimization Plan

## Current State
- **508 functions** in agentServiceV4.js
- Functions return 100% of data fields (735 chars per patient)
- Claude receives 34,095 tokens causing 20-30 second delays
- Cost: $0.126 per query

## Target State
- Return only essential fields per function
- Reduce to <500 tokens per response
- Response time: 1-2 seconds
- Cost: ~$0.002 per query

## Critical Functions to Fix First (Day 1)

### Patient Functions (HIGHEST PRIORITY)
1. ✅ `listAllPatients` - FIXED (returns: _id, firstName, lastName, SSN/nationalId)
2. ✅ `searchPatients` - FIXED (returns: _id, firstName, lastName, SSN/nationalId, email)
3. `getPatientDetails` - Need full details (this one stays as is)
4. `findPatient` - Optimize search results
5. `countPatients` - Return only count
6. `searchPatientsByName` - Minimal fields
7. `getPatientsNeedingFollowUp` - Only _id, name, followUpDate
8. `searchPatientsByCondition` - Only _id, name, condition

### Appointment Functions (HIGH PRIORITY)
9. ✅ `getTodaysAppointments` - PARTIALLY FIXED (need to fix other queries)
10. `getUpcomingAppointments` - Minimal fields
11. `getPatientAppointments` - Patient's appointments only
12. `getDoctorAppointments` - Provider's appointments only
13. `searchAppointments` - Search results minimal
14. `getAppointmentsByDateRange` - Date range minimal

### Document Functions (MEDIUM PRIORITY)
15. `listDocuments` - Only metadata, not content
16. `searchDocuments` - Search results minimal
17. `getDocumentsByPatient` - Patient docs metadata only
18. `getRecentDocuments` - Recent docs metadata

### User/Provider Functions
19. `listProviders` - Only _id, name, specialty
20. `searchUsers` - Minimal user fields
21. `getProviders` - Provider list minimal

## Implementation Strategy

### Phase 1: Direct Database Optimization (Current Approach)
Location: `handleDirectDatabaseOperation` function (line 12465)

For each database query:
1. Add `projection` parameter to SecureDataAccess.query()
2. Only fetch fields needed for that specific function
3. Test each function after optimization

### Pattern to Apply:
```javascript
// BEFORE - Fetches ALL fields
const patients = await SecureDataAccess.query('patients', {}, { limit }, context);

// AFTER - Fetches ONLY needed fields
const patients = await SecureDataAccess.query('patients', {}, {
  limit,
  projection: {
    _id: 1,
    firstName: 1,
    lastName: 1,
    socialSecurityNumber: 1,
    nationalId: 1
  }
}, context);
```

### Phase 2: Function-Specific Optimizations

Each function type needs different fields:

#### List Functions (minimal fields)
- Patients: _id, firstName, lastName, SSN/nationalId
- Appointments: _id, patientName, providerName, scheduledDate, status
- Documents: _id, title, type, uploadDate
- Users: _id, name, role

#### Search Functions (slightly more fields)
- Include fields being searched + basic display fields
- Add email for patient search
- Add reason for appointment search

#### Detail Functions (keep full data)
- getPatientDetails
- getAppointmentDetails
- getDocumentContent
- These need full information

### Phase 3: Testing Each Fix

After each function fix:
1. Check token count reduction
2. Test with actual Claude query
3. Verify UI still works
4. Monitor response time

## Priority Order

### Day 1 - Critical Functions (8 hours)
- Morning: Patient list/search functions (1-8)
- Afternoon: Appointment functions (9-14)

### Day 2 - Document & User Functions (8 hours)
- Morning: Document functions (15-18)
- Afternoon: User/Provider functions (19-21)

### Day 3 - Remaining Functions
- Review all 508 functions
- Apply same patterns to remaining functions
- Create reusable projection templates

## Measurement

### Before Each Fix:
```javascript
console.log(`BEFORE: ${JSON.stringify(result).length} chars`);
```

### After Each Fix:
```javascript
console.log(`AFTER: ${JSON.stringify(result).length} chars`);
console.log(`REDUCTION: ${(1 - after/before) * 100}%`);
```

## Expected Results

### Per Function Type:
- List functions: 90% reduction (735 → 73 chars per item)
- Search functions: 85% reduction
- Count functions: 99% reduction (return only number)
- Detail functions: 0% reduction (need full data)

### Overall Impact:
- Token reduction: 95% (34,095 → 1,700)
- Response time: 95% faster (20s → 1s)
- Cost reduction: 98% ($0.126 → $0.002)

## Notes

- Don't break existing functionality
- Keep function signatures the same
- Only optimize data fetching, not logic
- Test after each change
- Keep original code commented for rollback