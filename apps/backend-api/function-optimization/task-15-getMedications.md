# Task 15: Optimize getMedications Function

## Current Issue
- Returns complete medication history
- Includes full prescribing notes
- Contains detailed instructions
- Historical medications included
- Each medication can be 500+ tokens

## Location
- File: `services/agentServiceV4.js`
- Line: ~19299

## Current Return Structure
```javascript
{
  data: [
    {
      _id, medicationName, genericName,
      dosage: "500mg",
      instructions: "Take 1 tablet by mouth twice daily with food...",
      prescribedDate, prescribedBy,
      pharmacy: { /* Full pharmacy details */ },
      refills: 3,
      refillHistory: [...],
      sideEffects: "May cause drowsiness, nausea...",
      interactions: [...],
      prescribingNotes: "Patient counseled on...",
      adherenceTracking: {...},
      // More fields
    }
  ]
}
```

## Smart Medication List
```javascript
// Active medications only by default
const activeMeds = medications.filter(m => m.status === 'active');

const optimizedMeds = activeMeds.map(med => ({
  _id: med._id,
  name: med.medicationName,
  dosage: med.dosage,
  frequency: extractFrequency(med.instructions), // "Twice daily"
  since: med.prescribedDate,
  refillsLeft: med.refills,
  nextRefill: calculateNextRefill(med)
}));

return {
  active: optimizedMeds,
  count: {
    active: activeMeds.length,
    discontinued: medications.filter(m => m.status === 'discontinued').length,
    total: medications.length
  },
  alerts: getImportantAlerts(activeMeds) // Refills needed, interactions
};
```

## Context-Based Details
```javascript
// If asking about specific medication
if (params.medicationName) {
  return getFullMedicationDetails(medicationName);
}

// If checking interactions
if (context.includes('interaction') || context.includes('conflict')) {
  return {
    medications: medNames,
    interactions: checkAllInteractions(),
    severity: assessSeverity()
  };
}

// If reviewing history
if (params.includeHistory) {
  return {
    current: activeMeds,
    past: {
      count: pastMeds.length,
      recent: pastMeds.slice(0, 5) // Last 5 only
    }
  };
}
```

## Refill Management View
```javascript
// Smart refill summary
return {
  needRefillNow: meds.filter(m => m.refillsLeft === 0),
  needRefillSoon: meds.filter(m => m.refillsLeft === 1),
  medications: meds.map(m => ({
    name: m.name,
    refillsLeft: m.refillsLeft,
    lastFilled: m.lastFillDate,
    pharmacy: m.pharmacy.name // Just name, not full details
  }))
};
```

## Safety Information
```javascript
// Only include critical safety info
const safetyInfo = {
  allergies: patient.drugAllergies,
  interactions: criticalInteractions.map(i => ({
    drugs: i.drugs,
    severity: i.severity,
    action: i.recommendedAction
  })),
  warnings: activeMeds
    .filter(m => m.hasWarning)
    .map(m => ({ drug: m.name, warning: m.warningType }))
};
```

## Expected Result
- Active meds list: 200 tokens (from 3,000)
- With history: 400 tokens
- Specific medication: 300 tokens
- Safety check: 150 tokens