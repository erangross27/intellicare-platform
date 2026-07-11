# Phase 3: Document Templates

## Overview
Create 15 reusable document templates with beautiful formatting.

**Duration**: 5-6 days
**Tasks**: 15 total
**Dependencies**: Phase 2 (Frontend Core)

---

## Template Design Principles

### Typography
- **Headers**: Serif font (Georgia, "Times New Roman")
- **Body**: Sans-serif (Arial, Helvetica)
- **Data/Code**: Monospace (Courier, Monaco)

### Visual Elements
- ✅ Success / Normal / Completed
- ❌ Failed / Abnormal / Contraindicated
- ⚠️ Warning / Caution / Borderline
- 🔴 Critical / Immediate
- 🟡 Important / Soon
- 🟢 Good / Optimal
- ⭐ Featured / Latest

### Spacing
- Section spacing: 2rem
- Paragraph spacing: 1rem
- Line height: 1.6
- Margins: 2rem

---

## Task 3.1: Create Medication Document Template ⏱️ 4-5 hours

### Goal
Beautiful template for displaying medications.

### File to Create
`apps/frontend-vite/src/components/artifact/templates/MedicationDocument.jsx`

### Data Structure Expected
```javascript
{
  medications: [
    {
      name: "Dupilumab",
      genericName: "dupilumab",
      brandName: "Dupixent",
      dose: "300mg",
      route: "subcutaneous",
      frequency: "Every 2 weeks",
      startDate: "2025-01-15",
      indication: "Severe persistent asthma",
      prescriber: "Dr. Cohen",
      status: "active",
      notes: "Patient tolerating well",
      response: "Excellent",
      sideEffects: [],
      interactions: []
    }
  ]
}
```

### Template Layout
```
═══════════════════════════════════════
         MEDICATION LIST
═══════════════════════════════════════
Date: January 20, 2025

CURRENT MEDICATIONS (Active)

1. Dupilumab (Dupixent)
   ├─ Dose: 300mg subcutaneous
   ├─ Frequency: Every 2 weeks
   ├─ Started: January 15, 2025
   ├─ Indication: Severe persistent asthma
   ├─ Prescriber: Dr. Cohen
   └─ Status: Active ✅

   Clinical Notes:
   • Patient tolerating well
   • Exacerbations reduced by 70%
   • FEV1 improved from 65% to 82%

   Safety Checks: ✅ All clear
   • No drug interactions
   • No contraindications

───────────────────────────────────────

2. [Next medication...]
```

### Component Structure
```jsx
const MedicationDocument = ({ data }) => {
  const { medications } = data;

  const activeMeds = medications.filter(m => m.status === 'active');
  const inactiveMeds = medications.filter(m => m.status !== 'active');

  return (
    <div className="medication-document">
      <header>
        <h1>💊 MEDICATION LIST</h1>
        <div className="date">Date: {formatDate(new Date())}</div>
      </header>

      {activeMeds.length > 0 && (
        <section>
          <h2>CURRENT MEDICATIONS (Active)</h2>
          {activeMeds.map((med, index) => (
            <MedicationItem key={index} medication={med} number={index + 1} />
          ))}
        </section>
      )}

      {inactiveMeds.length > 0 && (
        <section>
          <h2>DISCONTINUED MEDICATIONS</h2>
          {inactiveMeds.map((med, index) => (
            <MedicationItem key={index} medication={med} isDiscontinued />
          ))}
        </section>
      )}
    </div>
  );
};
```

### What to Build
1. Header with title and date
2. Separate active/discontinued sections
3. Medication cards with all details
4. Visual indicators (✅ ❌ ⚠️)
5. Nested bullet points for details
6. Safety check section
7. Print-friendly styling

### Testing
- Renders all medication data
- Active/discontinued separated
- Visual hierarchy clear
- Print looks good

---

## Task 3.2: Create Lab Results Document Template ⏱️ 4-5 hours

### Goal
Template for laboratory test results with tables.

### File to Create
`apps/frontend-vite/src/components/artifact/templates/LabResultsDocument.jsx`

### Data Structure Expected
```javascript
{
  testDate: "2025-01-20",
  orderingProvider: "Dr. Cohen",
  lab: "Quest Diagnostics",
  results: [
    {
      category: "Hematology",
      tests: [
        {
          name: "WBC",
          value: 8.2,
          unit: "K/μL",
          normalRange: "4.0-11.0",
          status: "normal"
        },
        {
          name: "Eosinophils",
          value: 985,
          unit: "cells/μL",
          normalRange: "<500",
          status: "high"
        }
      ]
    }
  ]
}
```

### Template Layout
```
═══════════════════════════════════════
      LABORATORY RESULTS
      Date: January 20, 2025
═══════════════════════════════════════

Ordering Provider: Dr. Cohen
Laboratory: Quest Diagnostics

HEMATOLOGY
┌─────────────────┬────────┬──────────┬────────┐
│ Test            │ Result │ Normal   │ Status │
├─────────────────┼────────┼──────────┼────────┤
│ WBC             │ 8.2    │ 4.0-11.0 │   ✅   │
│ Hemoglobin      │ 14.5   │ 12.0-16.0│   ✅   │
│ Eosinophils     │ 985 ⚠️ │ <500     │   🔴   │
└─────────────────┴────────┴──────────┴────────┘

⚠️ CRITICAL FINDINGS:
• Eosinophils elevated at 985 cells/μL
  Clinical significance: Type 2 inflammation
  Action: Continue biologic therapy

───────────────────────────────────────
```

### What to Build
1. Header with date and provider
2. Results grouped by category
3. HTML table for clean layout
4. Status indicators (✅ 🔴 ⚠️)
5. Critical findings section
6. Trending info (if available)
7. Print-friendly table styling

### Testing
- Tables render correctly
- Abnormal values highlighted
- Critical findings separate
- Print formatting good

---

## Task 3.3: Create Vital Signs Document Template ⏱️ 3-4 hours

### Goal
Template for vital signs with trending.

### File to Create
`apps/frontend-vite/src/components/artifact/templates/VitalSignsDocument.jsx`

### Data Structure Expected
```javascript
{
  date: "2025-01-20T10:30:00Z",
  vitals: {
    bloodPressure: { systolic: 120, diastolic: 80 },
    heartRate: 72,
    temperature: 98.6,
    respiratoryRate: 16,
    oxygenSaturation: 98,
    weight: 180,
    height: 70,
    bmi: 25.8
  },
  trending: {
    bloodPressure: "stable",
    weight: "increasing"
  }
}
```

### Template Layout
```
═══════════════════════════════════════
         VITAL SIGNS
         January 20, 2025 10:30 AM
═══════════════════════════════════════

CURRENT VITALS

Blood Pressure:    120/80 mmHg      ✅ Normal
Heart Rate:        72 bpm           ✅ Normal
Temperature:       98.6°F           ✅ Normal
Respiratory Rate:  16 /min          ✅ Normal
O₂ Saturation:     98%              ✅ Normal

MEASUREMENTS

Weight:            180 lbs          ↗️ Trending up
Height:            70 inches
BMI:               25.8             ⚠️ Overweight

───────────────────────────────────────
```

### What to Build
1. Vital signs with values and units
2. Status indicators
3. Trending arrows (↗️ ↘️ →)
4. BMI calculation and classification
5. Normal ranges implied
6. Print styling

### Testing
- All vitals displayed
- Status indicators correct
- Trending shows properly
- BMI calculated correctly

---

## Task 3.4: Create AI Insights Document Template ⏱️ 4-5 hours

### Goal
Template for AI-generated recommendations and insights.

### File to Create
`apps/frontend-vite/src/components/artifact/templates/AIInsightsDocument.jsx`

### Data Structure Expected
```javascript
{
  generatedDate: "2025-01-20",
  recommendations: {
    immediate: [
      {
        priority: "high",
        action: "Repeat eosinophil count",
        rationale: "Rising trend may indicate inadequate control",
        timeframe: "Within 24 hours"
      }
    ],
    shortTerm: [...],
    longTerm: [...]
  }
}
```

### Template Layout
```
═══════════════════════════════════════
    INTELLIGENT RECOMMENDATIONS
    Generated: January 20, 2025
═══════════════════════════════════════

🔴 IMMEDIATE (Within 24 hours)
────────────────────────────────────────
1. Repeat eosinophil count

   Rationale: Rising trend (750→985) may
   indicate inadequate control

   Recommended Action: Repeat CBC in 24hrs

   Clinical Context: Patient on Dupilumab
   for severe asthma. Eosinophils should
   be suppressed but trending upward.

───────────────────────────────────────

🟡 SHORT-TERM (Within 1 week)
────────────────────────────────────────
1. [Recommendation...]

───────────────────────────────────────
```

### What to Build
1. Priority sections (Immediate/Short/Long)
2. Numbered recommendations
3. Rationale explanations
4. Timeframes
5. Clinical context
6. Visual priority indicators

### Testing
- Priorities separated clearly
- All details shown
- Readable narrative format
- Good visual hierarchy

---

## Task 3.5: Create Diagnosis Document Template ⏱️ 3 hours

### Goal
Template for patient diagnoses.

### File to Create
`apps/frontend-vite/src/components/artifact/templates/DiagnosisDocument.jsx`

### Template Layout
```
═══════════════════════════════════════
         DIAGNOSIS LIST
═══════════════════════════════════════

PRIMARY DIAGNOSIS

Severe Persistent Asthma (J45.50)
├─ Onset: 2010
├─ Status: Active, controlled
├─ Severity: Severe
└─ Notes: Type 2 inflammation, eosinophilic

SECONDARY DIAGNOSES

1. Atopic Dermatitis (L20.9)
   Status: Active

2. Chronic Rhinosinusitis (J32.9)
   Status: Active

3. Allergic Rhinitis (J30.1)
   Status: Active
```

### What to Build
1. Primary diagnosis prominent
2. Secondary diagnoses list
3. ICD codes
4. Status indicators
5. Onset dates
6. Clinical notes

---

## Tasks 3.6-3.15: Additional Templates ⏱️ 3-4 hours each

**Similar structure for:**

**Task 3.6**: ProcedureDocument - Medical procedures
**Task 3.7**: TimelineDocument - Hospital course timeline
**Task 3.8**: TrendingDocument - Trending analysis with charts
**Task 3.9**: QualityMetricsDocument - Quality scores
**Task 3.10**: AllergyDocument - Allergy list
**Task 3.11**: ImagingDocument - Imaging reports
**Task 3.12**: ComparisonDocument - Medication optimization
**Task 3.13**: TableDocument - Generic table (fallback)
**Task 3.14**: NarrativeDocument - Generic narrative (fallback)
**Task 3.15**: SummaryDocument - Generic summary (fallback)

Each follows same pattern:
1. Define data structure
2. Create layout design
3. Build React component
4. Add styling
5. Test rendering

---

## Shared Styles to Create

### File to Create
`apps/frontend-vite/src/components/artifact/templates/DocumentStyles.css`

### Base Styles
```css
/* Document Container */
.medical-document {
  font-family: Arial, Helvetica, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  line-height: 1.6;
  color: #333;
}

/* Headers */
.medical-document h1 {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.8rem;
  text-align: center;
  border-bottom: 2px solid #333;
  padding-bottom: 1rem;
  margin-bottom: 2rem;
}

.medical-document h2 {
  font-size: 1.3rem;
  margin: 2rem 0 1rem;
  color: #0066CC;
}

/* Tables */
.medical-document table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.medical-document th,
.medical-document td {
  padding: 0.75rem;
  border: 1px solid #ddd;
  text-align: left;
}

/* Status Indicators */
.status-normal { color: #28A745; }
.status-high { color: #DC3545; }
.status-low { color: #FFA500; }

/* Print Styles */
@media print {
  .medical-document {
    max-width: 100%;
    font-size: 12pt;
  }

  .medical-document h1 {
    page-break-after: avoid;
  }

  .medical-document section {
    page-break-inside: avoid;
  }
}
```

---

## Completion Checklist

After completing all tasks:
- [ ] All 15 templates created
- [ ] Shared styles defined
- [ ] All data structures handled
- [ ] Print styles working
- [ ] Visual hierarchy clear
- [ ] Tested with real data
- [ ] Ready for integration

---

**Total Time**: 5-6 days
**Dependencies**: Phase 2 (Frontend Core)
**Next Phase**: Integration
