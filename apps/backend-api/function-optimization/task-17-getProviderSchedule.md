# Task 17: Optimize getProviderSchedule Function

## Current Issue
- Returns ENTIRE schedule with all appointment details
- Includes patient info for each slot
- Contains room assignments, equipment
- Week schedule can be 5,000+ tokens

## Location
- File: `services/agentServiceV4.js`
- Lines: ~30109 and ~31691 (duplicate function!)

## Current Return Structure
```javascript
{
  data: {
    provider: { /* Full provider profile */ },
    schedule: {
      monday: [
        {
          time: '09:00',
          patient: { /* Full patient object */ },
          type: 'consultation',
          room: { /* Room details */ },
          notes: "Detailed appointment notes...",
          // More fields
        }
        // × 20 appointments
      ],
      // × 5 days
    },
    statistics: {...},
    availability: {...}
  }
}
```

## Smart Schedule View
```javascript
// Compact schedule grid
const scheduleGrid = {
  provider: {
    id: provider._id,
    name: provider.name,
    specialty: provider.specialty
  },

  week: {
    monday: {
      booked: 12,
      available: 4,
      hours: '09:00-17:00',
      blocks: [
        { time: '09:00-10:00', status: 'booked' },
        { time: '10:00-11:00', status: 'booked' },
        { time: '11:00-12:00', status: 'available' },
        // Simplified blocks
      ]
    },
    // Other days similar
  },

  summary: {
    totalBooked: 47,
    totalAvailable: 13,
    utilizationRate: '78%',
    busiestDay: 'Tuesday',
    nextAvailable: '2025-01-15 11:00'
  }
};
```

## View-Specific Optimization
```javascript
// For scheduling view
if (params.view === 'scheduling') {
  return {
    available: getOnlyAvailableSlots(),
    nextThree: getNextThreeAvailable()
  };
}

// For provider's own view
if (params.view === 'provider') {
  return {
    today: getTodaySchedule(),
    tomorrow: getTomorrowSchedule(),
    alerts: getScheduleAlerts() // Conflicts, overtime
  };
}

// For admin view
if (params.view === 'admin') {
  return {
    utilization: calculateUtilization(),
    patterns: getBookingPatterns(),
    recommendations: getScheduleOptimizations()
  };
}
```

## Daily Detail Mode
```javascript
// If specific day requested
if (params.date) {
  return {
    date: params.date,
    appointments: appointments.map(apt => ({
      time: apt.time,
      duration: apt.duration,
      type: apt.type,
      patientInitials: getInitials(apt.patientName),
      status: apt.status
    })),
    breaks: extractBreaks(appointments),
    overtime: calculateOvertime(appointments)
  };
}
```

## Expected Result
- Week view: 400 tokens (from 5,000)
- Day view: 200 tokens
- Available slots: 100 tokens
- Full details: Only when drilling down