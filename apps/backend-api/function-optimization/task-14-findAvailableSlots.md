# Task 14: Optimize findAvailableSlots Function

## Current Issue
- Returns ALL available slots for entire month
- Each slot includes full provider info
- Includes room details, equipment available
- Can return 500+ slots = 10,000+ tokens

## Location
- File: `services/agentServiceV4.js`
- Line: ~17520

## Current Return Structure
```javascript
{
  data: [
    {
      date: '2025-01-15',
      time: '09:00',
      provider: { /* Full provider object */ },
      room: { /* Full room details */ },
      equipment: [...],
      previousAppointments: [...],
      bufferTime: 15,
      preparationNeeded: {...},
      // More details
    }
    // × 500 slots!
  ]
}
```

## Smart Slot Optimization
```javascript
// Return slots grouped by day with counts
const optimizedSlots = {
  summary: {
    totalAvailable: 147,
    firstAvailable: '2025-01-15 09:00',
    daysWithAvailability: 10
  },

  byDay: {
    '2025-01-15': {
      count: 12,
      earliest: '09:00',
      latest: '17:00',
      slots: ['09:00', '09:30', '10:00'] // Just times
    },
    '2025-01-16': {
      count: 8,
      earliest: '10:00',
      latest: '16:00',
      slots: ['10:00', '11:00', '14:00']
    }
  },

  recommended: [
    // Top 3 best slots based on preference
    { date: '2025-01-15', time: '09:00', reason: 'First available' },
    { date: '2025-01-15', time: '14:00', reason: 'After lunch' },
    { date: '2025-01-16', time: '10:00', reason: 'Next day morning' }
  ]
};
```

## Preference-Based Filtering
```javascript
// If user specified preferences
if (params.preferredTime) {
  // Return only slots matching preference
  return slotsNear(preferredTime);
}

if (params.urgency === 'urgent') {
  // Return only next 24 hours
  return {
    urgent: slotsToday,
    tomorrow: slotsTomorrow,
    message: 'Showing urgent availability only'
  };
}

if (params.provider) {
  // Return only that provider's slots
  return {
    provider: providerName,
    available: providerSlots,
    alternative: 'Other providers available'
  };
}
```

## Smart Pagination
```javascript
// Don't return all slots at once
return {
  week1: {
    days: 5,
    totalSlots: 45,
    preview: firstThreePerDay
  },
  week2: {
    days: 5,
    totalSlots: 52,
    available: true // Flag that slots exist
  },
  loadMore: true,
  message: 'Showing next 7 days. More dates available.'
};
```

## Expected Result
- Default: 200 tokens (grouped summary)
- With preferences: 100 tokens (filtered)
- Full month: Never sent (use pagination)
- User experience: Actually improved!