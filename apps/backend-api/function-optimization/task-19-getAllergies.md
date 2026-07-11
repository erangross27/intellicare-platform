# Task 19: Optimize getAllergies Function

## Current Issue
- Returns detailed allergy information
- Includes reaction history
- Contains treatment protocols
- Cross-references with medications
- Each allergy can be 200+ tokens

## Location
- File: `services/agentServiceV4.js`
- Line: ~25764

## Current Return Structure
```javascript
{
  data: [
    {
      _id, allergen, type, category,
      severity: 'severe',
      reactions: [
        {
          date: '2024-01-15',
          description: "Patient experienced...",
          treatment: "Administered epinephrine...",
          outcome: "Resolved after..."
        }
      ],
      symptoms: ["hives", "swelling", "difficulty breathing"],
      diagnosis: {
        method: "skin test",
        date: "2023-06-01",
        confirmedBy: "Dr. Smith"
      },
      crossReactivity: ["related allergen 1", "related allergen 2"],
      avoidanceNotes: "Detailed avoidance instructions...",
      emergencyProtocol: "In case of exposure...",
      medications: {
        daily: ["antihistamine"],
        emergency: ["epinephrine auto-injector"]
      }
    }
  ]
}
```

## Critical Allergy Summary
```javascript
// Safety-first view
const allergySummary = {
  critical: {
    count: criticalAllergies.length,
    list: criticalAllergies.map(a => ({
      allergen: a.allergen,
      type: a.type, // 'drug', 'food', 'environmental'
      severity: a.severity,
      reaction: a.primaryReaction // Just main reaction
    }))
  },

  drugAllergies: medications
    .filter(a => a.type === 'drug')
    .map(a => a.allergen), // Just names for safety

  alerts: {
    hasEpiPen: hasEpinephrinePresecribed,
    lastReaction: mostRecentReaction?.date,
    crossCheck: medicationConflicts.length
  }
};
```

## Context-Specific Views
```javascript
// For prescribing (CRITICAL)
if (context.includes('prescribe') || context.includes('medication')) {
  return {
    drugAllergies: drugAllergies.map(a => ({
      drug: a.allergen,
      class: a.drugClass,
      severity: a.severity,
      alternatives: a.safeAlternatives
    })),
    crossReactivity: getCrossReactiveDrugs(),
    safeList: getConfirmedSafeMedications()
  };
}

// For emergency
if (params.emergency) {
  return {
    lifeThreatening: allergies
      .filter(a => a.severity === 'anaphylaxis')
      .map(a => ({
        allergen: a.allergen,
        lastReaction: a.lastReaction,
        treatment: a.emergencyProtocol
      })),
    carry: ['EpiPen', 'Benadryl'],
    emergencyContact: patient.emergencyContact
  };
}
```

## Compact List View
```javascript
// Simple list for overview
const compactView = {
  summary: `${allergies.length} known allergies`,

  byCategory: {
    drugs: drugAllergies.map(a => a.allergen),
    foods: foodAllergies.map(a => a.allergen),
    environmental: envAllergies.map(a => a.allergen),
    other: otherAllergies.map(a => a.allergen)
  },

  verification: {
    lastUpdated: lastUpdateDate,
    confirmedBy: lastConfirmedBy,
    needsReview: checkIfReviewNeeded()
  }
};
```

## Expected Result
- Safety summary: 150 tokens
- Drug check view: 200 tokens
- Emergency view: 100 tokens
- Full details: Only when specifically needed