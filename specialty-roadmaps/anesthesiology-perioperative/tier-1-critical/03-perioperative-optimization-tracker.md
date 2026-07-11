# Tool #3: Perioperative Optimization Tracker

**Priority**: HIGH
**Timeline**: 5-6 days
**Complexity**: High
**Dependencies**: Labs, vital signs, appointments

---

## Problem Statement

Richard Phillips needs surgical clearance for elective knee replacement. Currently:

1. **No Optimization Checklist**: Missing structured preop checklist
2. **No HbA1c Trend Tracking**: Diabetes control over time not visualized
3. **No BMI Tracking**: Weight optimization not monitored
4. **Fragmented Timeline**: 7 pending referrals uncoordinated
5. **No Clearance Status**: Unknown if patient ready for surgery

**Perioperative Optimization Goals:**
- HbA1c <7% (ideally <7% for elective surgery)
- BMI tracking for bariatric referral consideration
- All specialist clearances obtained
- Medication optimization complete
- Modifiable risk factors addressed

**Current Gap:** Cannot determine surgical readiness without optimization tracker

---

## Clinical Background

### What is Perioperative Optimization?

**Definition:** Systematic improvement of modifiable risk factors before elective surgery to reduce complications and improve outcomes.

**Key Components:**
1. **Glycemic Control** - HbA1c <7-8% target
2. **Cardiovascular Optimization** - BP control, cardiac clearance
3. **Pulmonary Function** - Smoking cessation, COPD treatment
4. **Nutrition** - BMI optimization, albumin levels
5. **Functional Status** - Exercise tolerance, frailty assessment
6. **Medication Management** - Stop/continue/adjust medications
7. **Specialist Clearances** - Cardiology, pulmonology, etc.

### Why It Matters

**Evidence:**
- HbA1c >8% → 3x higher infection risk
- Uncontrolled HTN → Increased bleeding, MI risk
- Smoking → 6x higher wound complications
- Poor nutrition → Delayed healing
- Frailty → Increased mortality

**Elective Surgery Standards:**
- Can postpone to optimize
- Target 4-6 weeks optimization period
- Document clearance for informed consent

---

## Tool Specification

### Function Name
`trackPerioperativeOptimization()`

### Purpose
Create structured checklist, track optimization metrics over time, coordinate specialist clearances, determine surgical readiness.

### Parameters
```
{
  patientId: string (required),
  surgeryType: string,
  surgeryDate: string,
  optimizationPlan: {
    hba1cTarget: number,        // Default 7.0
    bmiTarget: number,           // Optional weight loss goal
    bpTarget: string,            // "140/90" or "<130/80"
    smokingCessation: boolean,
    nutritionGoals: object,
    exerciseGoals: object
  },
  checklistItems: [
    {
      category: string,          // 'labs', 'imaging', 'clearances', 'medications'
      item: string,
      required: boolean,
      targetDate: string,
      assignedTo: string
    }
  ]
}
```

### Return Value
```
{
  success: boolean,
  optimizationStatus: 'not-started' | 'in-progress' | 'optimized' | 'suboptimal',
  surgicalReadiness: 'ready' | 'not-ready' | 'conditional',
  checklist: [
    {
      item: string,
      status: 'pending' | 'in-progress' | 'complete' | 'overdue',
      dueDate: string,
      completedDate: string,
      result: string
    }
  ],
  metrics: {
    hba1c: {
      current: number,
      target: number,
      trend: 'improving' | 'stable' | 'worsening',
      onTrack: boolean
    },
    bmi: {
      current: number,
      baseline: number,
      change: number,
      trend: string
    },
    bloodPressure: {
      current: string,
      controlled: boolean,
      target: string
    }
  },
  timeline: {
    daysUntilSurgery: number,
    optimizationWeeksRemaining: number,
    milestones: [object]
  },
  blockers: [
    {
      category: string,
      description: string,
      severity: 'minor' | 'moderate' | 'major' | 'blocking'
    }
  ],
  recommendations: [string],
  message: string
}
```

---

## Data Model

### Collection: perioperative_optimization_plans
```
{
  patientId: ObjectId,
  surgeryType: String,
  surgeryDate: Date,
  createdDate: Date,
  status: String,              // 'planning', 'optimizing', 'ready', 'cancelled'

  // Optimization Goals
  targets: {
    hba1c: {
      baseline: Number,
      target: Number,
      current: Number,
      history: [
        {
          date: Date,
          value: Number,
          monthsBeforeSurgery: Number
        }
      ]
    },
    bmi: {
      baseline: Number,
      target: Number,
      current: Number,
      weightLossGoal: Number    // kg
    },
    bloodPressure: {
      target: String,
      controlled: Boolean
    },
    smoking: {
      currentSmoker: Boolean,
      cessationDate: Date,
      weeksSmokeFree: Number
    },
    nutrition: {
      albuminTarget: Number,
      prealbumin: Number,
      nutritionistConsult: Boolean
    },
    functionalStatus: {
      mets: Number,             // Metabolic equivalents
      exerciseTolerance: String,
      frailtyScore: Number
    }
  },

  // Checklist
  checklist: [
    {
      category: String,         // 'labs', 'imaging', 'clearance', 'medication', 'lifestyle'
      item: String,
      description: String,
      required: Boolean,
      dueDate: Date,
      completedDate: Date,
      status: String,           // 'pending', 'in-progress', 'complete', 'not-applicable'
      result: String,
      notes: String,
      assignedTo: ObjectId
    }
  ],

  // Specialist Clearances
  clearances: [
    {
      specialty: String,        // 'cardiology', 'pulmonology', 'endocrinology'
      required: Boolean,
      referralDate: Date,
      appointmentDate: Date,
      clearedDate: Date,
      status: String,           // 'pending', 'scheduled', 'cleared', 'declined'
      provider: String,
      clearanceType: String,    // 'full', 'conditional', 'declined'
      conditions: [String],     // If conditional clearance
      notes: String
    }
  ],

  // Medication Optimization
  medications: {
    toStop: [
      {
        medication: String,
        stopDate: Date,
        reason: String
      }
    ],
    toContinue: [String],
    toAdd: [
      {
        medication: String,
        reason: String,
        started: Boolean
      }
    ]
  },

  // Timeline Milestones
  milestones: [
    {
      date: Date,
      description: String,
      status: String,
      critical: Boolean
    }
  ],

  // Blockers
  blockers: [
    {
      identified: Date,
      category: String,
      description: String,
      severity: String,
      resolved: Boolean,
      resolution: String,
      resolutionDate: Date
    }
  ],

  // Overall Assessment
  readiness: {
    surgical: String,          // 'ready', 'not-ready', 'conditional'
    anesthesia: String,
    lastAssessment: Date,
    assessedBy: ObjectId
  },

  createdBy: ObjectId,
  updatedAt: Date,
  createdAt: Date
}
```

---

## Checklist Categories

### 1. Laboratory Tests
```
Required (all patients):
- CBC (within 30 days)
- BMP (within 30 days)
- Coagulation studies (PT/INR, PTT)

Diabetes patients:
- HbA1c (within 3 months, target <7-8%)
- Fasting glucose

Cardiac risk patients:
- Troponin (if symptomatic)
- BNP (if heart failure)

Kidney disease:
- Creatinine, eGFR
- Urinalysis

Liver disease:
- LFTs, albumin

Anticoagulation:
- INR if on warfarin
- Anti-Xa if on LMWH
```

### 2. Imaging Studies
```
Cardiac:
- EKG (all patients >50 or cardiac history)
- Echocardiogram (if valve disease, heart failure)
- Stress test (if symptoms, high risk)

Pulmonary:
- Chest X-ray (if pulmonary symptoms)
- PFTs (if COPD, asthma)

Other:
- Surgical site imaging (pre-op knee X-rays for knee replacement)
```

### 3. Specialist Clearances
```
Cardiology:
- If recent MI, unstable angina, severe valve disease
- If poor functional status (<4 METs)
- If multiple cardiac risk factors

Pulmonology:
- If severe COPD, oxygen-dependent
- If recent pneumonia
- If pulmonary hypertension

Endocrinology:
- If HbA1c >8%
- If poorly controlled thyroid
- If adrenal insufficiency

Hematology:
- If coagulopathy
- If on anticoagulation requiring bridging

Nephrology:
- If ESRD on dialysis
- If severe CKD (eGFR <30)
```

### 4. Medication Management
```
Stop before surgery:
- Anticoagulants (timing varies)
- Antiplatelet agents (timing varies)
- Metformin (day of surgery)
- ACE inhibitors (controversial, case by case)
- Herbal supplements (2 weeks prior)

Continue:
- Beta blockers
- Statins
- Thyroid medications
- Antihypertensives (except ACE-I)
- Antiepileptics

Adjust:
- Insulin (sliding scale periop)
- Oral hypoglycemics (hold day of)
- Steroids (stress dose if chronic use)
```

### 5. Lifestyle Modifications
```
Smoking cessation:
- Target: 4-8 weeks smoke-free
- Nicotine replacement therapy
- Track weeks smoke-free

Weight optimization:
- BMI >40 → Consider bariatric referral
- Target: Any reduction helpful
- Nutritionist referral

Exercise:
- Prehabilitation program
- Improve functional capacity
- Track exercise tolerance (METs)

Nutrition:
- Optimize protein intake
- Correct deficiencies (iron, B12, vitamin D)
- Albumin >3.5 g/dL
```

---

## HbA1c Trend Tracking

### Visualization Requirements

**Line Graph:**
- X-axis: Months before surgery (0 = surgery date)
- Y-axis: HbA1c percentage
- Plot historical HbA1c values
- Show target line (7.0% or provider-specified)
- Color coding: Green (<7%), Yellow (7-8%), Red (>8%)
- Trend arrow (↑ improving, → stable, ↓ worsening)

**Data Points:**
```
Example for Richard Phillips:
- 6 months before: 8.2% (Red)
- 3 months before: 7.8% (Yellow)
- Current (6 weeks before): 7.2% (Yellow)
- Target: 7.0% (Green line)
- Trend: ↑ Improving
- Projection: On track to reach <7.5% by surgery
```

### Decision Logic
```
HbA1c Interpretation:
- <7%: Optimal - proceed with surgery
- 7-8%: Acceptable - proceed with caution
- 8-9%: Suboptimal - consider postponing 4-6 weeks
- >9%: High risk - postpone, intensive management

Emergency surgery:
- Proceed regardless, manage glucose perioperatively

Elective surgery:
- Can postpone to optimize
```

---

## BMI Tracking

### Weight Loss Goals
```
BMI >40 (Class III Obesity):
- Consider bariatric surgery referral
- Even 5-10% weight loss reduces risk
- Nutritionist referral
- 3-6 month preop weight loss program

BMI 35-40 (Class II Obesity):
- Weight loss encouraged but not required
- Nutritionist consultation
- Prehabilitation program

BMI 30-35 (Class I Obesity):
- General health improvement
- No delay for weight loss alone
```

### Tracking Metrics
```
Baseline: BMI at initial assessment
Current: Latest BMI
Change: Kg lost or gained
Trend: Weekly change rate
Target: Optional goal BMI
Time to surgery: Weeks remaining
```

---

## Surgical Clearance Timeline

### Standard Timeline (6-8 weeks before surgery)
```
Week -8:
☐ Initial surgical consultation
☐ Create optimization plan
☐ Order baseline labs (HbA1c, CBC, BMP)
☐ Identify needed clearances

Week -6:
☐ Complete all lab work
☐ Specialty referrals sent
☐ Medication review complete
☐ Lifestyle modifications started

Week -4:
☐ Specialty appointments completed
☐ Clearances obtained or pending
☐ Repeat HbA1c if initially elevated
☐ Smoking cessation >4 weeks

Week -2:
☐ Final lab check
☐ Pre-anesthesia assessment
☐ All clearances documented
☐ Patient education complete
☐ FINAL GO/NO-GO decision

Week -1:
☐ Confirm NPO instructions
☐ Medication adjustments (stop anticoagulants)
☐ Pre-op phone call
☐ Confirm ride, post-op plan

Day of surgery:
☐ Final checklist review
☐ Consent signed
☐ All clearances in chart
```

---

## Functions Needed

### Core Functions
```
createOptimizationPlan(patientId, surgeryType, surgeryDate)
// Returns: Checklist + goals + timeline

trackHbA1cTrend(patientId)
// Returns: Historical HbA1c with trend analysis + graph data

trackBMI(patientId)
// Returns: Weight history + BMI trend

updateChecklistItem(planId, itemId, status, result)
// Returns: Updated checklist + overall status

assessSurgicalReadiness(patientId)
// Returns: Ready/not-ready + blockers + recommendations

generateClearanceLetter(patientId)
// Returns: Printable clearance document for surgeon
```

### Analytics Functions
```
getUpcomingSurgeries(practiceId, daysAhead)
// Returns: Patients with surgery <30 days + optimization status

getPatientsNeedingOptimization(practiceId)
// Returns: Upcoming surgeries without optimization plan

getBlockedSurgeries(practiceId)
// Returns: Patients not cleared due to optimization issues
```

---

## User Interface

### Provider Dashboard
**Location:** Surgical planning section

**Components:**

1. **Optimization Status Widget**
```
┌───────────────────────────────┐
│ Surgery Readiness: ⚠️ PENDING │
│ Days to Surgery: 42          │
│ Checklist: 12/20 Complete    │
│ Blockers: 2                  │
│ [View Plan] [Update]         │
└───────────────────────────────┘
```

2. **HbA1c Trend Graph**
```
HbA1c Trend (Target <7.0%):

9% ┤
8% ┤ ●
7% ┤ ┄●┄┄●┄ ← Target
6% ┤
   └────────────────
    -6mo  -3mo  Now

Current: 7.2% (Yellow)
Trend: ↑ Improving
Projection: On track
```

3. **Optimization Checklist**
```
Perioperative Optimization Checklist:

LABORATORY (5/7 Complete):
✓ CBC - 10/10/2025 - Normal
✓ BMP - 10/10/2025 - Normal
✓ HbA1c - 10/15/2025 - 7.2%
⚠️ Repeat HbA1c - Due 11/15/2025
⚠️ Albumin - Pending
✓ Coags - 10/10/2025 - Normal
✓ EKG - 10/12/2025 - LVH noted

CLEARANCES (1/3 Complete):
✓ Cardiology - 10/18/2025 - Cleared with conditions
⚠️ Pulmonology - Scheduled 11/5/2025
❌ Endocrinology - Not yet scheduled

MEDICATIONS (2/4 Complete):
✓ Aspirin stop date set (7 days before)
✓ Metformin hold protocol documented
⚠️ Insulin sliding scale - Pending endo input
❌ Controlled substance taper - Not started

LIFESTYLE (1/3 Complete):
❌ Smoking cessation - Still smoking
⚠️ Weight loss - Lost 2kg, goal 5kg
✓ Prehabilitation - Started PT

Overall Status: 60% Complete
Blockers: 2 major (smoking, endo clearance)
```

4. **Blocker Alert Panel**
```
⛔ BLOCKERS PREVENTING SURGERY:

1. MAJOR - Smoking Cessation
   - Patient still smoking (1 pack/day)
   - Need 4 weeks smoke-free
   - Referral: Smoking cessation clinic
   - Impact: High wound complication risk
   [Refer to Cessation Clinic]

2. MAJOR - Endocrinology Clearance
   - HbA1c 7.2% (target <7%)
   - No endo appointment scheduled
   - Insulin adjustment needed
   - Impact: Surgical delay if not addressed
   [Schedule Endocrinology]
```

5. **Clearance Summary**
```
Specialist Clearances:

Cardiology - Dr. Smith
✓ CLEARED (Conditional)
   Date: 10/18/2025
   Conditions:
   - Continue beta blocker through surgery
   - Cardiac monitoring 24h postop
   - Hold ACE inhibitor day of surgery

Pulmonology - Dr. Jones
⏳ SCHEDULED
   Date: 11/5/2025 (3 weeks before surgery)
   Reason: COPD, sleep apnea
   Expected: Likely cleared with enhanced monitoring

Endocrinology - Pending
❌ NOT SCHEDULED
   Reason: HbA1c optimization, insulin adjustment
   Urgency: HIGH - Schedule within 2 weeks
   [Send Referral Now]
```

---

## Integration Points

### Data Sources
```
Read from:
- lab_results (HbA1c, CBC, BMP, etc.)
- vital_signs (BMI, BP trends)
- diagnoses (comorbidities)
- medications (current med list)
- appointments (specialist visits)
- sleep_apnea_assessments
- opioid_risk_assessments
- anesthesia_risk_assessments

Write to:
- perioperative_optimization_plans
- care_plans (optimization instructions)
- appointments (schedule clearances)
- alerts (blocker notifications)
```

### Clinical Tools Integration
```
Connects with:
- Anesthesia Risk (Tool #1) - ASA class affects optimization needs
- Opioid MME (Tool #2) - Tapering timeline
- Sleep Apnea (Tool #4) - CPAP optimization
- Prescription Generator (Tool #5) - Medication adjustments
- Multi-Specialty Coordinator (Tool #6) - Referral management
```

---

## Success Criteria

### Immediate (Week 1)
- ✅ Optimization plan created for Richard Phillips
- ✅ HbA1c trend displayed
- ✅ Checklist populated
- ✅ Blockers identified

### Short-term (Week 2-3)
- ✅ All clearances scheduled
- ✅ Medication optimization underway
- ✅ HbA1c improving
- ✅ Timeline on track

### Long-term (Week 4-6)
- ✅ All checklist items complete
- ✅ HbA1c <7.5%
- ✅ All clearances obtained
- ✅ Patient cleared for surgery

---

## Implementation Checklist

### Step 1: Schema Design
- [ ] Create perioperative_optimization_plans collection
- [ ] Define checklist structure
- [ ] Define metrics tracking (HbA1c, BMI, BP)
- [ ] Define clearance tracking
- [ ] Index on patientId + surgeryDate

### Step 2: Checklist Logic
- [ ] Create default checklist templates by surgery type
- [ ] Auto-populate from patient conditions
- [ ] Track item status (pending → complete)
- [ ] Calculate completion percentage
- [ ] Identify blockers

### Step 3: Trend Tracking
- [ ] Query lab_results for HbA1c history
- [ ] Calculate trend (improving/stable/worsening)
- [ ] Generate graph data points
- [ ] Project future values
- [ ] Same for BMI from vital_signs

### Step 4: Readiness Assessment
- [ ] Evaluate all checklist items
- [ ] Check for blockers
- [ ] Assess time remaining
- [ ] Determine ready/not-ready
- [ ] Generate recommendations

### Step 5: Timeline Management
- [ ] Calculate milestones based on surgery date
- [ ] Track overdue items
- [ ] Send reminders
- [ ] Update status as milestones pass

### Step 6: Function Registration
- [ ] Add to aiHelpers.js
- [ ] Add to agentSystemPrompt.js
- [ ] Register in agentServiceV4.js
- [ ] Test Claude integration

---

## Testing Strategy

### Test Case 1: Richard Phillips (Complex)
```
Input:
- Surgery: Knee replacement in 6 weeks
- HbA1c: 7.2% (was 8.2% 6 months ago)
- BMI: 38 (baseline 40)
- Still smoking
- 7 pending specialist referrals

Expected:
- Checklist: 20+ items
- Blockers: Smoking cessation, endo clearance
- HbA1c trend: Improving
- BMI trend: Improving
- Readiness: NOT READY (blockers present)
- Recommendations: Stop smoking, schedule endo
```

### Test Case 2: Simple Case (Healthy)
```
Input:
- Surgery: Simple procedure in 4 weeks
- No diabetes
- BMI: 24
- Non-smoker
- No major comorbidities

Expected:
- Checklist: 8-10 items (basic labs, EKG)
- No blockers
- Readiness: READY
- Minimal clearances needed
```

---

## Related Tools

- **Tool #1**: Anesthesia Risk - Drives optimization needs
- **Tool #2**: Opioid MME - Tapering included in optimization
- **Tool #4**: Sleep Apnea - CPAP optimization
- **Tool #6**: Specialist Coordinator - Manages clearances
- Lab Results - HbA1c trend data
- Vital Signs - BMI trend data

---

## References

- ACC/AHA Perioperative Guidelines
- Diabetes perioperative management
- Surgical optimization protocols
- Enhanced Recovery After Surgery (ERAS) protocols

---

**PRIORITY**: Essential for determining surgical readiness and optimizing outcomes.
