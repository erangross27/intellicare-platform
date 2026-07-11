# Task 03: Optimize getTodaysAppointments Function

## Current Issue
- Returns complete appointment objects with all fields
- Includes full patient data, provider data, notes
- Causes token explosion for daily schedules

## Location
- File: `services/agentServiceV4.js`
- Route: `/api/appointments/today`
- High-frequency function (called multiple times daily)

## Current Return Structure
```javascript
{
  success: true,
  data: [/* Full appointment objects */],
  timeSlots: { /* Grouped by time */ },
  stats: { /* Various statistics */ }
}
```

## Required Optimization
Return schedule essentials only:
```javascript
{
  _id: apt._id,
  time: apt.scheduledTime,
  patientName: apt.patientName,
  type: apt.appointmentType,
  status: apt.status,
  provider: apt.providerName,
  duration: apt.duration
}
```

## Implementation Steps
1. Create minimal appointment mapper
2. Preserve time slot grouping
3. Keep stats but simplify
4. Add "fullDetails" flag for when needed

## Expected Result
- Token count: <1,000 for full day
- Response time: <500ms
- Maintains scheduling functionality