# Medication Adherence Tracking

## Purpose
Monitor whether patients are taking medications as prescribed. Critical for complex regimens (Helen Cox: 8 daily medications) and expensive biologics.

---

## Clinical Background

### Why Track Adherence?
- **Treatment Failure Prevention:** 50% of asthma exacerbations due to non-adherence
- **Cost Savings:** Don't waste $3,000/month biologics if patient not taking them
- **Safety:** Identify patients skipping important medications
- **Intervention Targeting:** Focus resources on high-risk patients

### Adherence Thresholds
- **Good:** ≥80% of doses taken
- **Suboptimal:** 50-79% of doses taken
- **Poor:** <50% of doses taken

---

## Data Model

### Collection: `medication_adherence`

#### Schema
```
{
  patientId: ObjectId (required),
  medicationId: ObjectId (required),
  trackingPeriod: {
    startDate: Date (required),
    endDate: Date (required)
  },
  dosesExpected: Number (required),
  dosesTaken: Number (required),
  adherenceRate: Number (0-100, required),  // Calculated percentage
  adherenceLevel: String (enum: ['good', 'suboptimal', 'poor']),

  trackingMethod: String (enum: [
    'refill-tracking',           // Pharmacy refill dates
    'pill-count',                // Physical count at visit
    'patient-reported',          // Self-report
    'smart-inhaler',             // Connected device
    'electronic-monitoring'      // Cap sensors
  ]),

  missedDoses: [{
    date: Date,
    reason: String (enum: [
      'forgot',
      'side-effects',
      'felt-better',
      'cost',
      'access',
      'complexity',
      'other'
    ]),
    notes: String
  }],

  barriers: [{
    type: String (enum: [
      'cost',
      'side-effects',
      'complexity',
      'forgetfulness',
      'health-beliefs',
      'access'
    ]),
    severity: String (enum: ['mild', 'moderate', 'severe']),
    intervention: String
  }],

  interventions: [{
    date: Date,
    type: String (enum: [
      'education',
      'simplification',
      'reminder-system',
      'cost-assistance',
      'side-effect-management'
    ]),
    outcome: String
  }],

  metadata: {
    recordedBy: ObjectId,
    recordedDate: Date,
    confidence: String (enum: ['high', 'medium', 'low']),
    notes: String
  },

  createdAt: Date,
  updatedAt: Date
}
```

---

## Functions Needed

### Core Functions
```javascript
recordAdherence(patientId, medicationId, dosesTaken, dosesExpected, method)
// Returns: { success, adherenceRate, level, alerts }

getAdherenceHistory(patientId, medicationId, dateRange)
// Returns: Array of adherence records with trends

identifyAdherenceBarriers(patientId, medicationId)
// Returns: List of barriers and suggested interventions

recordAdherenceIntervention(patientId, medicationId, interventionType)
// Returns: { success, interventionId, followUpDate }

calculateRefillAdherence(patientId, medicationId, refillHistory)
// Returns: Proportion of Days Covered (PDC)
```

### Analytics Functions
```javascript
getPatientsWithPoorAdherence(practiceId, threshold)
// Returns: Patients below adherence threshold

predictAdherenceRisk(patientId)
// Returns: Risk score based on complexity, cost, anxiety, etc.

getMedicationAdherenceReport(patientId)
// Returns: All medications with adherence rates

identifyHighRiskPatients(practiceId)
// Returns: Patients with poor adherence + high-risk conditions
```

---

## Tracking Methods

### 1. Refill-Based Tracking (Most Common)
**How:** Calculate Proportion of Days Covered (PDC) from pharmacy refills
**Formula:** `PDC = Days with medication / Days in period`
**Pros:** Objective, passive data collection
**Cons:** Assumes filled = taken

### 2. Pill Counts
**How:** Count remaining pills at visit
**Formula:** `(Dispensed - Remaining) / Expected doses`
**Pros:** Direct measurement
**Cons:** Labor-intensive, patient can discard pills

### 3. Patient Self-Report
**How:** Ask patient to estimate adherence
**Tools:** Visual analog scale, diary
**Pros:** Easy, identifies reasons for non-adherence
**Cons:** Over-reporting bias

### 4. Smart Inhalers
**How:** Bluetooth-connected devices track each puff
**Examples:** Propeller, Adherium
**Pros:** Precise, real-time
**Cons:** Requires device, cost

### 5. Electronic Monitoring
**How:** Medication cap sensors record openings
**Examples:** Medication Event Monitoring System (MEMS)
**Pros:** Precise timing data
**Cons:** Expensive, not all medications

---

## User Interface

### Provider View
**Location:** Patient medications list

**Components:**
1. **Adherence Dashboard**
   - Each medication with color-coded adherence rate
   - Trend indicators (improving/worsening)
   - High-risk patients highlighted
   - "Record Adherence" button

2. **Adherence Detail View**
   - Historical graph by medication
   - Barriers identified
   - Interventions tried
   - Outcome tracking

3. **Adherence Entry Form**
   - Select medication
   - Choose tracking method
   - Enter doses taken/expected
   - Identify barriers
   - Plan intervention

### Patient Portal View
**Location:** My Medications section

**Components:**
1. **Medication Tracker**
   - Daily checklist for each medication
   - Streak counter (consecutive days)
   - Achievement badges
   - Reminder settings

2. **Why This Matters**
   - Personalized explanation per medication
   - Visual impact of adherence on outcomes
   - Cost of wasted medication if not taken

---

## Business Logic

### Adherence Calculation (PDC Method)
```
Refill 1: 2025-01-01 (30-day supply)
Refill 2: 2025-01-28 (30-day supply)
Refill 3: 2025-02-25 (30-day supply)

Period: 2025-01-01 to 2025-03-27 (86 days)
Total days covered: 30 + 30 + 30 = 90 days
PDC = 90 / 86 = 100% (capped at 100%)

If Refill 2 was late (2025-02-10):
Gap: 10 days without medication
Days covered: 30 + 30 + 30 = 90 days
Actual coverage: 90 - 10 = 80 days
PDC = 80 / 86 = 93%
```

### Alert Triggers
```
Red Alerts (immediate intervention):
- Adherence <50% on critical medication (biologic, controller)
- 2+ weeks gap in refills for daily medication
- Patient reports stopping medication without notifying provider

Yellow Alerts (monitor):
- Adherence 50-79%
- Missed 1 refill
- Patient reports occasional missed doses

Green (no action):
- Adherence ≥80%
- Consistent refill pattern
```

---

## Integration Points

### Connected Systems
1. **Pharmacy Integration**
   - Import refill history
   - Calculate PDC automatically
   - Alert on missed refills

2. **Medication List**
   - Link adherence to active medications
   - Flag high-risk medications (biologics, controllers)
   - Display adherence rate next to medication name

3. **Treatment Outcomes**
   - Correlate adherence with ACT scores
   - Correlate with exacerbation rates
   - Identify adherence impact on control

4. **Cost Analysis**
   - Calculate wasted medication cost
   - ROI of adherence interventions
   - Justify prior authorization renewals

---

## Interventions by Barrier Type

### Cost Barriers
- Patient assistance programs
- Generic alternatives
- Manufacturer coupons
- Insurance appeal support

### Complexity Barriers
- Medication simplification
- Combination products
- Once-daily dosing when possible
- Pill organizers

### Forgetfulness Barriers
- Smartphone reminders
- Pill box systems
- Link to daily routine (meals, bedtime)
- Family support engagement

### Side Effect Barriers
- Timing adjustments
- Dosage modifications
- Symptomatic treatment
- Medication switch

### Health Belief Barriers
- Patient education
- Shared decision-making
- Visual aids (before/after lungs)
- Peer testimonials

---

## Quality Measures

### Asthma Medication Ratio (AMR)
- Controller medication PDC ≥50%
- HEDIS measure for quality rating

### Medication Possession Ratio (MPR)
- Total days supply / Days in period
- Similar to PDC but allows >100%

### Medicare Star Ratings
- Multiple adherence measures
- Impact on reimbursement

---

## Success Criteria

### Adoption
- ✅ 100% of patients on biologics have adherence tracking
- ✅ 80% of patients on controller meds have adherence tracking
- ✅ 50% of patients use portal medication tracker

### Clinical Impact
- ✅ Average adherence rate increases from 60% to 75%
- ✅ 80% of non-adherent patients receive intervention within 30 days
- ✅ 50% of poor adherers improve to suboptimal/good after intervention

### Financial Impact
- ✅ Reduce wasted biologic cost by $50,000/year
- ✅ Reduce exacerbations by 30% through improved adherence
- ✅ Increase quality measure performance → higher reimbursement

---

## Timeline
**Week 1:** Database schema + refill tracking
**Week 2:** Provider UI + entry forms
**Week 3:** Patient portal tracker
**Week 4:** Analytics + interventions

**Total Effort:** 50 hours
