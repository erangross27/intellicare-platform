# Task 20: Optimize getPrescriptions Function

## Current Issue
- Returns full prescription details
- Includes prescribing notes
- Contains pharmacy information
- Insurance details included
- Each prescription 300+ tokens

## Location
- File: `services/agentServiceV4.js`
- Line: ~26346

## Current Return Structure
```javascript
{
  data: [
    {
      _id, rxNumber,
      medication: {
        name: "Medication Name",
        genericName: "Generic Name",
        strength: "500mg",
        form: "tablet"
      },
      sig: "Take 1 tablet by mouth twice daily with food for 10 days",
      quantity: 20,
      refills: 2,
      prescribedDate: "2025-01-01",
      prescriber: {
        name: "Dr. Smith",
        npi: "1234567890",
        dea: "BS1234567"
      },
      pharmacy: {
        name: "CVS Pharmacy",
        address: "123 Main St",
        phone: "555-1234",
        fax: "555-5678"
      },
      insurance: {
        copay: 10,
        covered: true,
        priorAuth: false
      },
      dispensing: {
        lastFilled: "2025-01-05",
        nextRefillDate: "2025-02-01"
      },
      notes: "Patient counseled on..."
    }
  ]
}
```

## Prescription Summary View
```javascript
// Active prescriptions focus
const rxSummary = {
  active: prescriptions
    .filter(rx => rx.status === 'active')
    .map(rx => ({
      medication: rx.medication.name,
      dose: extractSimpleDose(rx.sig), // "500mg twice daily"
      quantity: rx.quantity,
      refills: rx.refills,
      prescriber: rx.prescriber.name,
      lastFilled: rx.dispensing.lastFilled
    })),

  stats: {
    total: prescriptions.length,
    active: activeCount,
    needRefill: needRefillCount,
    expiringSoon: expiringSoonCount
  }
};
```

## Refill Management View
```javascript
// For refill requests
if (params.refillView) {
  return {
    needRefillNow: prescriptions
      .filter(rx => needsRefill(rx))
      .map(rx => ({
        medication: rx.medication.name,
        lastFilled: rx.dispensing.lastFilled,
        pharmacy: rx.pharmacy.name,
        prescriber: rx.prescriber.name,
        action: 'Request Refill'
      })),

    upcomingRefills: getUpcomingRefills(7) // Next 7 days
      .map(rx => ({
        medication: rx.medication.name,
        refillDate: rx.nextRefillDate
      }))
  };
}
```

## Insurance View
```javascript
// For billing/insurance
if (params.insurance) {
  return {
    covered: prescriptions
      .filter(rx => rx.insurance.covered)
      .map(rx => ({
        medication: rx.medication.name,
        copay: rx.insurance.copay
      })),

    notCovered: prescriptions
      .filter(rx => !rx.insurance.covered)
      .map(rx => ({
        medication: rx.medication.name,
        cashPrice: rx.cashPrice,
        alternative: rx.coveredAlternative
      })),

    priorAuth: prescriptions
      .filter(rx => rx.insurance.priorAuth)
      .map(rx => rx.medication.name)
  };
}
```

## Compliance Tracking
```javascript
// Medication adherence view
const complianceView = {
  adherence: {
    overall: '85%',
    byMedication: prescriptions.map(rx => ({
      medication: rx.medication.name,
      adherence: calculateAdherence(rx),
      missedDoses: rx.missedDoses || 0
    }))
  },

  alerts: {
    notFilled: prescriptions.filter(rx => !rx.dispensing.lastFilled),
    overdue: prescriptions.filter(rx => isOverdue(rx))
  }
};
```

## Expected Result
- Active list: 200 tokens (from 2,000)
- Refill view: 150 tokens
- Insurance view: 200 tokens
- Full details: Only for specific prescription