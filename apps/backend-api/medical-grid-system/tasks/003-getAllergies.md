# Task 003: getAllergies Grid Implementation

## Function Details
- **Function Name**: getAllergies
- **Category**: Core Medical Records
- **Collection**: allergies
- **Priority**: CRITICAL (Patient safety)

## Grid Column Configuration

### Primary Columns
| Column ID | Display Name | Data Type | Width | Sortable | Filterable | Format |
|-----------|-------------|-----------|--------|----------|------------|---------|
| allergen | Allergen | string | 250px | ✅ | ✅ | Bold Text |
| category | Category | enum | 150px | ✅ | ✅ | Category Badge |
| severity | Severity | enum | 120px | ✅ | ✅ | Color-coded |
| reaction | Reaction | string | 300px | ❌ | ✅ | Multi-line |
| onsetDate | Onset Date | date | 120px | ✅ | ✅ | MM/DD/YYYY |
| verificationStatus | Verified | enum | 120px | ✅ | ✅ | Icon+Text |
| reportedBy | Reported By | string | 150px | ✅ | ✅ | Name/Role |
| lastReaction | Last Reaction | date | 120px | ✅ | ❌ | Relative Time |

### Hidden Columns
- allergyId (ObjectId)
- patientId (ObjectId)
- clinicalStatus (active/inactive)
- verifiedBy (ObjectId)

### Severity Levels & Colors
- Severe/Life-threatening: 🔴 Red (#DC2626)
- Moderate: 🟠 Orange (#EA580C)
- Mild: 🟡 Yellow (#EAB308)
- Unknown: ⚪ Gray (#9CA3AF)

### Category Types
- Drug/Medication
- Food
- Environmental
- Biological
- Chemical
- Physical
- Other

## Data Formatting Rules

### Visual Indicators
```javascript
formatters: {
  severity: (value) => {
    // Add warning icons for severe
    // ⚠️ Severe - Life Threatening
    // ⚡ Moderate
    // ℹ️ Mild
  },
  allergen: (value, row) => {
    // Bold text for severe allergies
    // Red text for life-threatening
    // Include generic/brand for medications
  },
  reaction: (value) => {
    // Multi-line display
    // Highlight keywords (anaphylaxis, swelling, etc.)
  }
}
```

### Verification Status Icons
- ✅ Verified by provider
- ⏳ Pending verification
- 📝 Self-reported
- ❓ Unverified

## Special Alert Features

### Critical Allergy Banner
- Display red banner for life-threatening allergies
- Always visible at top of grid
- Include emergency protocol link

### Cross-Reference Alerts
- Check against current medications
- Check against planned procedures
- Food service integration
- Pharmacy alerts

## Filter Options

### Quick Filters
- Life-Threatening Only
- Verified Allergies
- Drug Allergies
- Food Allergies
- Active Only
- Recently Added

### Advanced Filters
- Severity Level
- Category
- Verification Status
- Date Range
- Reaction Type

## Row Actions
- View Details
- Edit Allergy
- Verify Allergy
- Mark Inactive
- View Reaction History
- Print Allergy Card
- Add Note
- Link to Medical Record

## Bulk Actions
- Export Allergy List
- Print Allergy Bands
- Send to Pharmacy
- Update Verification Status

## Safety Features
- Auto-alert on medication ordering
- Integration with CPOE
- Alert fatigue prevention
- Override documentation required
- Audit trail for changes

## Performance Considerations
- Immediate load (no pagination)
- Cache for quick access
- Real-time sync across systems
- Indexed by severity + allergen

## Integration Points
- Medication ordering system
- Pharmacy system
- Dietary/Food service
- Emergency department
- Anesthesia records
- Drug database for cross-reference

## Test Scenarios
1. Display multiple allergies
2. Severity color coding
3. Cross-reference with medications
4. Emergency allergy display
5. Verification workflow
6. Export for patient cards
7. Mobile emergency view

## API Response Structure
```javascript
{
  success: true,
  data: [
    {
      allergyId: "ObjectId",
      allergen: "Penicillin",
      category: "Drug",
      severity: "Severe",
      reaction: "Anaphylaxis, hives, difficulty breathing",
      onsetDate: "2020-03-15",
      verificationStatus: "Verified",
      verifiedBy: "Dr. Smith",
      reportedBy: "Patient",
      lastReaction: "2023-06-20",
      clinicalStatus: "active",
      notes: "Requires epinephrine",
      crossReferences: ["Amoxicillin", "Ampicillin"]
    }
  ],
  criticalAllergies: 2,
  metadata: {
    gridType: "allergies",
    hasLifeThreatening: true,
    lastUpdated: "2025-01-26T10:30:00Z"
  }
}
```

## Mobile Emergency View
- Large, clear display
- Red banner for critical
- One-tap to view all
- Share via QR code
- Offline capability

## Compliance Requirements
- FHIR AllergyIntolerance resource
- HL7 allergen coding
- SNOMED CT terminology
- ICD-10 mapping where applicable

## Estimated Time
- Backend: 4 hours
- Frontend: 5 hours
- Testing: 3 hours
- Integration: 2 hours
- Total: 14 hours

## Critical Safety Notes
- NEVER hide or minimize severe allergies
- Always show in patient banner
- Require double confirmation for changes
- Alert all integrated systems on updates
- Maintain complete audit trail