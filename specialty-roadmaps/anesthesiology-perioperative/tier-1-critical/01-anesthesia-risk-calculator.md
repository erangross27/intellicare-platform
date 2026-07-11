# Tool #1: Anesthesia Risk Assessment Calculator

**Priority**: HIGH
**Timeline**: 4-5 days
**Complexity**: Medium-High
**Dependencies**: Vital signs, diagnoses, medications

---

## Problem Statement

Richard Phillips needs anesthesia risk stratification before elective knee replacement surgery. Currently:

1. **No ASA Classification**: Physical status not calculated
2. **No Mallampati Score**: Difficult airway risk unknown
3. **No Previous Anesthesia History**: Past complications not tracked
4. **Incomplete Risk Profile**: Multiple comorbidities not aggregated

**ASA Classification Purpose:**
- Standardized anesthesia risk assessment (ASA 1-6)
- Required for informed consent
- Guides anesthesia technique selection
- Predicts perioperative complications
- Affects monitoring requirements

**Current Gap:** Cannot proceed with anesthesia planning without risk assessment

---

## Clinical Background

### ASA Physical Status Classification

**Definitions:**
- **ASA 1**: Healthy patient, no systemic disease
- **ASA 2**: Mild systemic disease (controlled HTN, social drinker)
- **ASA 3**: Severe systemic disease (poorly controlled DM, COPD, morbid obesity)
- **ASA 4**: Severe disease that is constant threat to life (recent MI, CVA)
- **ASA 5**: Moribund, not expected to survive without surgery
- **ASA 6**: Brain-dead organ donor

**Modifiers:**
- **E** suffix = Emergency surgery (e.g., ASA 3E)

**Why It Matters:**
- ASA 1-2: Low risk, standard monitoring
- ASA 3: Moderate risk, enhanced monitoring
- ASA 4-5: High risk, ICU-level care, possible cancellation

### Mallampati Score

**Assessment:** View of oropharynx with mouth open, tongue out

**Classes:**
- **Class I**: Full visibility of soft palate, uvula, pillars
- **Class II**: Soft palate and uvula visible
- **Class III**: Only base of uvula visible
- **Class IV**: Only hard palate visible

**Predicts:**
- Difficult mask ventilation
- Difficult intubation
- Class III-IV → May need fiber-optic intubation or awake intubation

### Difficult Airway Predictors
```
LEMON Assessment:
- L: Look externally (facial trauma, beard, obesity)
- E: Evaluate 3-3-2 rule (mouth opening, jaw mobility)
- M: Mallampati score
- O: Obstruction (tumor, abscess, epiglottitis)
- N: Neck mobility (cervical spine disease, arthritis)

High Risk = Any positive findings
```

---

## Tool Specification

### Function Name
`calculateASAScore()`

### Purpose
Determine ASA physical status classification, Mallampati score, and difficult airway risk.

### Parameters
```
{
  patientId: string (required),
  assessment: {
    // Auto-populated from patient record:
    age: number,
    diagnoses: [string],        // Active diagnoses
    medications: [string],      // Current medications
    vitalSigns: object,         // Latest BP, HR, SpO2

    // Provider assessment:
    mallampatiClass: number,    // 1-4
    mouthOpening: number,       // cm (3-3-2 rule)
    thyroMentalDistance: number, // cm
    neckMobility: string,       // 'full' | 'limited' | 'severely limited'
    dentures: boolean,
    facialHair: boolean,
    oralPathology: string,

    // Previous anesthesia:
    priorAnesthesia: boolean,
    priorDifficulties: [string],
    priorComplications: [string]
  },
  surgeryType: string,          // 'elective' | 'urgent' | 'emergency'
  proposedAnesthesia: string    // 'general' | 'spinal' | 'regional' | 'MAC'
}
```

### Return Value
```
{
  success: boolean,
  asaClass: number,             // 1-6
  asaModifier: string,          // 'E' for emergency, or null
  asaJustification: string,     // Reason for ASA classification
  mallampatiScore: number,      // 1-4
  difficultAirwayRisk: 'low' | 'moderate' | 'high' | 'very-high',
  airwayPredictors: [string],   // LEMON findings
  anesthesiaRecommendations: {
    preferredTechnique: string,
    alternatives: [string],
    specialEquipment: [string],
    consultRequired: boolean
  },
  monitoringRequirements: {
    standardASA: boolean,
    arterialLine: boolean,
    centralLine: boolean,
    pacCatheter: boolean,
    tee: boolean                // Transesophageal echo
  },
  riskFactors: [
    {
      category: string,
      description: string,
      severity: string
    }
  ],
  message: string
}
```

---

## ASA Classification Logic

### Decision Tree
```
ASA 1 (Healthy):
- No systemic disease
- Non-smoker or minimal tobacco
- Minimal alcohol
- No medications except vitamins
- BMI <30

ASA 2 (Mild disease):
- Controlled hypertension
- Controlled diabetes (HbA1c <7%)
- BMI 30-40
- Social drinker
- Pregnancy
- Well-controlled asthma
- Current smoker

ASA 3 (Severe disease):
- Poorly controlled HTN (>160/100)
- Poorly controlled DM (HbA1c >7%)
- BMI >40
- Active hepatitis
- COPD with dyspnea
- History of MI >6 months ago
- Chronic kidney disease (Cr >2)
- Pacemaker/AICD
- Moderate alcohol use
- Chronic pain on opioids

ASA 4 (Life-threatening):
- Recent MI (<6 months)
- Recent CVA (<6 months)
- Ongoing cardiac ischemia
- Severe valve disease
- Sepsis
- DIC
- ARDS
- ESRD on dialysis

ASA 5 (Moribund):
- Ruptured AAA
- Massive trauma
- Intracranial bleed with mass effect
- Not expected to survive without surgery

ASA 6 (Brain dead):
- Organ donor
```

### Richard Phillips Example
```
Conditions:
- Type 2 Diabetes → Check HbA1c
  - If HbA1c <7% → ASA 2 feature
  - If HbA1c ≥7% → ASA 3 feature
- Hypertension → Check BP control
  - If controlled → ASA 2 feature
  - If >160/100 → ASA 3 feature
- BMI 38 (morbid obesity) → ASA 3 feature
- Chronic opioid use (140 MME) → ASA 3 feature
- Sleep apnea on CPAP → ASA 3 feature
- Chronic pain affecting function → ASA 3 feature

Result: **ASA 3** (multiple severe systemic diseases)
If emergency: **ASA 3E**
```

---

## Data Model

### Collection: anesthesia_risk_assessments
```
{
  patientId: ObjectId,
  assessmentDate: Date,
  assessmentType: String,       // 'preoperative' | 'pre-procedure'
  surgeryType: String,          // 'elective' | 'urgent' | 'emergency'
  proposedProcedure: String,

  // ASA Classification
  asaClass: Number,             // 1-6
  asaModifier: String,          // 'E' or null
  asaJustification: String,
  asaRiskFactors: [
    {
      condition: String,
      severity: String,
      contribution: String      // How it affects ASA class
    }
  ],

  // Airway Assessment
  mallampatiClass: Number,      // 1-4
  thyroMentalDistance: Number,  // cm
  mouthOpening: Number,         // cm (should be ≥4cm)
  neckMobility: String,
  dentures: Boolean,
  facialHair: Boolean,
  lemonAssessment: {
    look: String,
    evaluate: Object,           // 3-3-2 measurements
    mallampati: Number,
    obstruction: String,
    neckMobility: String,
    overallRisk: String
  },
  difficultAirwayRisk: String,

  // Previous Anesthesia History
  priorAnesthesia: [
    {
      date: Date,
      procedure: String,
      anesthesiaType: String,
      difficulties: [String],
      complications: [String],
      notes: String
    }
  ],

  // Anesthesia Plan
  preferredTechnique: String,   // 'general', 'spinal', 'regional', 'MAC'
  alternatives: [String],
  specialEquipment: [String],   // 'fiberoptic scope', 'video laryngoscope', 'LMA'
  consultRequired: Boolean,
  consultReason: String,

  // Monitoring
  monitoring: {
    standardASA: Boolean,
    arterialLine: Boolean,
    centralLine: Boolean,
    pacCatheter: Boolean,
    tee: Boolean,
    neuromuscularMonitoring: Boolean
  },

  // Risk Summary
  overallRisk: String,          // 'low', 'moderate', 'high', 'very-high'
  recommendations: [String],
  precautions: [String],

  assessedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Functions Needed

### Core Functions
```
calculateASAScore(patientId)
// Returns: ASA class + justification

assessAirway(patientId, physicalExam)
// Returns: Mallampati + difficult airway risk + LEMON score

recordPriorAnesthesia(patientId, anesthesiaHistory)
// Returns: Success + flags for difficult airway/complications

generateAnesthesiaPlan(patientId, surgeryType)
// Returns: Recommended technique + alternatives + equipment

assessMonitoringNeeds(patientId, asaClass)
// Returns: Monitoring requirements based on risk
```

### Analytics Functions
```
getHighRiskSurgicalPatients(practiceId)
// Returns: Patients ASA 4-5 with upcoming surgery

getPatientsNeedingAnesthesiaConsult(practiceId)
// Returns: Difficult airway or ASA 4+ patients

getSurgicalRiskProfile(practiceId)
// Returns: ASA distribution across practice
```

---

## User Interface

### Provider Dashboard
**Location:** Preoperative assessment section

**Components:**

1. **ASA Classification Widget**
```
┌─────────────────────────┐
│ ASA Class: 3           │
│ Risk: Moderate-High    │
│ Updated: Today         │
│ [Reassess] [View Plan] │
└─────────────────────────┘
```

2. **ASA Calculator Interface**
```
ASA Classification Calculator:

Patient: Richard Phillips, 58 yo Male

Active Conditions:
☑ Diabetes (HbA1c 7.2%) - Poorly controlled
☑ Hypertension (BP 145/92) - Borderline controlled
☑ Morbid obesity (BMI 38)
☑ Obstructive sleep apnea (CPAP user)
☑ Chronic opioid use (140 MME/day)
☑ Chronic pain syndrome

Functional Status:
☐ Fully independent
☑ Requires assistance with ADLs
☐ Bedridden

Calculated ASA Class: 3
Justification: Multiple severe systemic diseases including poorly controlled diabetes, morbid obesity, OSA, and functional impairment

Surgery Type: ☑ Elective  ☐ Urgent  ☐ Emergency

Final Classification: ASA 3

[Save Assessment] [Generate Anesthesia Plan]
```

3. **Airway Assessment Form**
```
Airway Evaluation:

Physical Examination:
- Mallampati Class: [1] [2] [3] [4]
- Mouth Opening: ___ cm (≥4cm normal)
- Thyromental Distance: ___ cm (≥6cm normal)
- Neck Extension: Full / Limited / Severely Limited
- Dentures: Yes / No
- Facial Hair: Yes / No
- Oral Pathology: _______________

LEMON Assessment:
L - Look: Normal / Abnormal - _______
E - Evaluate 3-3-2:
    - 3 fingers mouth opening: Yes / No
    - 3 fingers hyoid-mental: Yes / No
    - 2 fingers thyroid-hyoid: Yes / No
M - Mallampati: [Score from above]
O - Obstruction: None / _______
N - Neck: Full mobility / Limited

Difficult Airway Risk: Low / Moderate / High / Very High

Predicted Difficulty:
☐ Mask ventilation
☐ Laryngoscopy
☐ Intubation
☐ Supraglottic airway

[Calculate Risk] [Generate Airway Plan]
```

4. **Anesthesia Plan Output**
```
Anesthesia Plan for Richard Phillips:

CLASSIFICATION:
- ASA Class: 3
- Overall Risk: Moderate-High

AIRWAY ASSESSMENT:
- Mallampati: Class II
- Difficult Airway Risk: Moderate
- Predictors: Obesity, limited neck extension, OSA

RECOMMENDED TECHNIQUE:
Primary: Spinal anesthesia (preferred for knee replacement)
Alternative: General anesthesia with ETT

SPECIAL CONSIDERATIONS:
⚠️ Obstructive sleep apnea - minimize opioids
⚠️ High-dose chronic opioids - multimodal analgesia
⚠️ Obesity - positioning challenges
⚠️ Diabetes - perioperative glucose control

EQUIPMENT NEEDED:
- Ramped positioning
- Video laryngoscope (backup if GA needed)
- Short-handle laryngoscope
- CPAP machine for recovery

MONITORING:
✓ Standard ASA monitors
✓ Continuous pulse oximetry 48 hours postop
✓ Consider arterial line if GA required
✓ Capnography if moderate sedation

POSTOPERATIVE:
- Extended PACU stay (≥2 hours)
- OSA monitoring protocol
- Multimodal analgesia (minimize opioids)
- CPAP first postop night

[Print Plan] [Share with Team] [Add to Chart]
```

---

## Integration Points

### Data Sources
```
Read from:
- patients (age, weight, height)
- diagnoses (all active conditions)
- medications (chronic opioids, cardiac meds, etc.)
- vital_signs (BP, HR, SpO2, BMI)
- lab_results (HbA1c, creatinine, cardiac markers)
- sleep_apnea_assessments (OSA risk)
- opioid_risk_assessments (MME)
- surgical_history (prior anesthesia complications)

Write to:
- anesthesia_risk_assessments
- care_plans (anesthesia plan)
- alerts (high-risk notifications)
```

### Clinical Tools Integration
```
Connects with:
- Sleep Apnea Assessment (Tool #4) - OSA affects ASA class
- Opioid MME Dashboard (Tool #2) - Chronic opioids affect risk
- Perioperative Optimization (Tool #3) - Overall clearance
- Vital Signs - BMI, BP auto-population
```

---

## Success Criteria

### Immediate (Week 1)
- ✅ ASA calculator functional
- ✅ Richard Phillips classified as ASA 3
- ✅ Airway assessment documented

### Short-term (Week 2-3)
- ✅ Anesthesia plan generated
- ✅ Special equipment ordered
- ✅ Team briefed on high-risk features

### Long-term (Week 4-6)
- ✅ All surgical patients have ASA score
- ✅ High-risk patients flagged pre-op
- ✅ Reduced anesthesia complications
- ✅ Improved informed consent documentation

---

## Implementation Checklist

### Step 1: ASA Classification Logic
- [ ] Create diagnosis-to-severity mapping
- [ ] Implement ASA decision tree
- [ ] Auto-populate from patient record
- [ ] Generate justification text
- [ ] Handle edge cases (multiple severe conditions)

### Step 2: Airway Assessment
- [ ] Create Mallampati interface
- [ ] Implement LEMON assessment
- [ ] Calculate difficult airway risk
- [ ] Link to prior anesthesia history

### Step 3: Anesthesia Planning
- [ ] Match ASA class to monitoring needs
- [ ] Recommend anesthesia technique
- [ ] Suggest special equipment
- [ ] Flag for anesthesia consult if high-risk

### Step 4: Data Integration
- [ ] Pull diagnoses automatically
- [ ] Pull medications automatically
- [ ] Pull vitals/labs automatically
- [ ] Link to OSA and opioid assessments

### Step 5: Function Registration
- [ ] Add to aiHelpers.js
- [ ] Add to agentSystemPrompt.js
- [ ] Register in agentServiceV4.js
- [ ] Test Claude integration

---

## Testing Strategy

### Test Case 1: Richard Phillips (ASA 3)
```
Input:
- Age: 58
- Diagnoses: DM (HbA1c 7.2%), HTN, Obesity, OSA, Chronic pain
- BMI: 38
- Opioids: 140 MME/day
- Functional status: Requires assistance

Expected ASA: 3
Justification: Multiple severe systemic diseases
Risk: Moderate-High
Preferred: Spinal anesthesia
Monitoring: Standard + extended postop
```

### Test Case 2: Healthy Patient (ASA 1)
```
Input:
- Age: 25
- No diagnoses
- No medications
- BMI: 22
- Fully functional

Expected ASA: 1
Risk: Low
Any anesthesia technique appropriate
```

### Test Case 3: Emergency Surgery (ASA 3E)
```
Input:
- Same as Richard Phillips
- Surgery: Emergency (fracture)

Expected ASA: 3E (emergency modifier)
Risk: Higher than elective ASA 3
Expedited assessment
```

---

## Related Tools

- **Tool #2**: Opioid MME - Chronic opioid use raises ASA class
- **Tool #3**: Perioperative Optimization - Overall surgical clearance
- **Tool #4**: Sleep Apnea - OSA affects ASA class and airway
- Vital Signs - Auto-populates BMI, BP, HR

---

## References

- ASA Physical Status Classification System
- ASA Practice Guidelines for Management of Difficult Airway
- LEMON Assessment (Manual)
- Mallampati Classification

---

**PRIORITY**: Essential for informed consent and anesthesia planning.
