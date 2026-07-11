# Tool #4: Sleep Apnea Management System

**Priority**: CRITICAL
**Timeline**: 3-4 days
**Complexity**: Medium
**Dependencies**: None

---

## Problem Statement

Richard Phillips is a **CPAP user** (confirmed sleep apnea) undergoing elective knee replacement. Currently:

1. **No STOP-Bang Score**: Sleep apnea severity not quantified
2. **No CPAP Compliance Data**: Unknown if patient actually uses CPAP
3. **No Postoperative Protocol**: Enhanced monitoring plan undefined
4. **Anesthesia Risk**: Sleep apnea + opioids + surgery = high respiratory risk

**Perioperative Implications:**
- Increased risk of postoperative respiratory depression
- May need extended PACU monitoring
- May require ICU-level care first 24 hours
- Opioid analgesia limited by respiratory risk
- Home oxygen may be needed

**Gap:** Cannot safely plan anesthesia without sleep apnea assessment

---

## Clinical Background

### What is STOP-Bang?
Validated screening questionnaire for obstructive sleep apnea (OSA)

**8 Yes/No Questions:**
- **S**noring (loud snoring?)
- **T**ired (daytime fatigue?)
- **O**bserved apnea (witnessed breathing pauses?)
- **P**ressure (high blood pressure?)
- **B**MI >35
- **A**ge >50
- **N**eck circumference >40cm (16 inches)
- **G**ender (male)

**Scoring:**
- 0-2: Low risk
- 3-4: Moderate risk (refer for sleep study)
- 5-8: High risk (likely OSA, urgent sleep study)

### Why It Matters Perioperatively

**Anesthesia Risks:**
- Difficult intubation (obesity, large neck)
- Postoperative airway obstruction
- Opioid sensitivity (respiratory depression)
- Hypoxemia episodes

**Postoperative Complications:**
- 2-3x higher risk of respiratory events
- Longer PACU stays
- More ICU admissions
- Cardiovascular complications

**Mitigation Strategies:**
- Regional anesthesia preferred
- Minimize opioids (multimodal analgesia)
- Continuous pulse oximetry 24-48 hours
- Bring home CPAP to hospital
- Non-supine positioning

---

## Tool Specification

### Function Name
`assessSleepApnea()`

### Purpose
Calculate STOP-Bang score, track CPAP compliance, generate perioperative monitoring protocols.

### Parameters
```
{
  patientId: string (required),
  stopBangResponses: {
    snoring: boolean,
    tired: boolean,
    observedApnea: boolean,
    pressure: boolean,        // Hypertension
    bmi: number,              // Auto-calculated if weight/height available
    age: number,              // Auto-populated from patient record
    neckCircumference: number, // cm
    gender: string            // 'male' or 'female'
  },
  cpapCompliance: {
    prescribed: boolean,
    hoursPerNight: number,    // Average usage
    nightsPerWeek: number,
    machineData: object       // Optional: actual CPAP download
  },
  sleepStudy: {
    performed: boolean,
    date: string,
    ahi: number,              // Apnea-Hypopnea Index
    severity: string          // 'mild', 'moderate', 'severe'
  }
}
```

### Return Value
```
{
  success: boolean,
  stopBangScore: number,      // 0-8
  riskLevel: 'low' | 'moderate' | 'high',
  diagnosis: {
    hasOSA: boolean,
    severity: string,         // From sleep study
    cpapCompliant: boolean
  },
  perioperativeRisk: {
    respiratoryRisk: 'low' | 'moderate' | 'high' | 'very-high',
    requiredMonitoring: string,
    anesthesiaRecommendations: [string]
  },
  monitoringProtocol: {
    pacuDuration: number,     // Hours in PACU
    continuousOximetry: boolean,
    icuRequired: boolean,
    cpapInHospital: boolean,
    regionalPreferred: boolean
  },
  message: string
}
```

---

## Data Model

### Collection: sleep_apnea_assessments
```
{
  patientId: ObjectId,
  assessmentDate: Date,
  assessmentType: String,     // 'preoperative' | 'routine' | 'screening'
  stopBang: {
    snoring: Boolean,
    tired: Boolean,
    observedApnea: Boolean,
    pressure: Boolean,
    bmi: Number,
    bmiScore: Number,         // ≥35 = 1 point
    age: Number,
    ageScore: Number,         // >50 = 1 point
    neckCircumference: Number,
    neckScore: Number,        // >40cm = 1 point
    gender: String,
    genderScore: Number,      // male = 1 point
    totalScore: Number        // 0-8
  },
  riskLevel: String,          // 'low', 'moderate', 'high'
  cpapCompliance: {
    prescribed: Boolean,
    machineType: String,
    pressure: Number,         // cmH2O
    hoursPerNight: Number,
    nightsPerWeek: Number,
    compliant: Boolean,       // ≥4 hours/night, ≥70% nights
    lastDownload: Date,
    machineSerialNumber: String
  },
  sleepStudy: {
    performed: Boolean,
    studyDate: Date,
    studyType: String,        // 'in-lab' | 'home'
    ahi: Number,              // Apnea-Hypopnea Index
    severity: String,         // 'mild', 'moderate', 'severe'
    lowO2Sat: Number,         // Lowest oxygen saturation
    diagnoses: [String]       // 'OSA', 'central apnea', 'mixed'
  },
  perioperativeRisk: {
    calculatedRisk: String,
    combinedFactors: [String], // 'OSA', 'opioids', 'obesity', 'cardiac'
    monitoring: {
      pacuHours: Number,
      continuousOximetry: Boolean,
      icuLevel: Boolean,
      telemetry: Boolean
    },
    anesthesia: {
      regionalPreferred: Boolean,
      opioidRestriction: Boolean,
      specialEquipment: [String]
    }
  },
  relatedConditions: {
    obesity: Boolean,
    hypertension: Boolean,
    cardiovascular: Boolean,
    pulmonary: Boolean
  },
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Business Logic

### STOP-Bang Scoring
```
Calculate score (0-8):
1. Snoring? +1 if yes
2. Tired? +1 if yes
3. Observed apnea? +1 if yes
4. Pressure (HTN)? +1 if yes
5. BMI >35? +1 if yes
6. Age >50? +1 if yes
7. Neck >40cm? +1 if yes
8. Gender male? +1 if yes

Risk Stratification:
- 0-2: Low risk (<15% OSA prevalence)
- 3-4: Moderate risk (~35% OSA prevalence)
- 5-8: High risk (>65% OSA prevalence)
```

### CPAP Compliance Definition
```
Medicare Standard:
- ≥4 hours per night
- ≥70% of nights
- Over 30-day period

Compliant = hoursPerNight ≥4 AND (nightsPerWeek/7) ≥0.70

Non-compliant = higher perioperative risk
```

### Perioperative Risk Calculation
```
Base risk = STOP-Bang score

Additional Risk Factors (+1 each):
- Non-compliant CPAP
- BMI >40
- Chronic opioid use (>90 MME)
- Age >65
- ASA class ≥3
- Cardiac/pulmonary comorbidities

Combined Risk Score:
- 0-2: Low risk → standard monitoring
- 3-5: Moderate risk → extended PACU, continuous oximetry
- 6-8: High risk → ICU-level monitoring first 24h
- >8: Very high risk → consider ICU admission
```

### Monitoring Protocol Decision Tree
```
IF STOP-Bang ≥5 OR sleep study severe OSA:
  - Extended PACU stay (≥2 hours)
  - Continuous pulse oximetry 24-48 hours
  - Avoid PCA opioids
  - Regional anesthesia preferred
  - CPAP in hospital first night
  - Non-supine positioning

IF also on chronic opioids (>90 MME):
  - Consider ICU-level monitoring
  - Minimize additional opioids
  - Multimodal analgesia mandatory

IF non-compliant CPAP:
  - Optimize CPAP before surgery (reschedule if needed)
  - Respiratory therapy consult
```

---

## Functions Needed

### Core Functions
```
assessSleepApnea(patientId, responses)
// Returns: STOP-Bang score + risk level + monitoring plan

recordCPAPCompliance(patientId, complianceData)
// Returns: Compliance status + trends

generatePerioperativeProtocol(patientId, surgeryType)
// Returns: Detailed monitoring plan for surgery

calculateRespiratoryRisk(patientId)
// Returns: Combined risk from OSA + opioids + comorbidities

trackCPAPUsage(patientId, machineData)
// Returns: Usage trends + compliance alerts
```

### Analytics Functions
```
identifyHighRiskOSAPatients(practiceId)
// Returns: Patients with high STOP-Bang + pending surgery

getNonCompliantCPAPUsers(practiceId)
// Returns: Patients prescribed CPAP but not using

getSurgicalPatientsWithOSA(practiceId)
// Returns: Upcoming surgeries in OSA patients + risk levels
```

---

## User Interface

### Provider Dashboard
**Location:** Patient summary, respiratory section

**Components:**

1. **Sleep Apnea Risk Widget**
```
┌────────────────────────────┐
│ OSA Risk: HIGH             │
│ STOP-Bang: 6/8            │
│ CPAP: Compliant ✓         │
│ [Assess] [View Protocol]  │
└────────────────────────────┘
```

2. **STOP-Bang Questionnaire**
```
Sleep Apnea Screening (STOP-Bang):

☑ Snoring (loud enough to be heard through door?)
☑ Tired (daytime sleepiness interfering with activities?)
☑ Observed apnea (has someone seen you stop breathing?)
☑ Pressure (hypertension diagnosis or treatment?)

BMI: 38 → ☑ (>35)
Age: 58 → ☑ (>50)
Neck: 42cm → ☑ (>40cm)
Gender: Male → ☑

TOTAL SCORE: 8/8 - HIGH RISK
Recommendation: Sleep study if not already performed
```

3. **CPAP Compliance Tracker**
```
CPAP Compliance (Last 30 Days):

Hours/Night: 6.2 hours ✓ (≥4 required)
Nights/Week: 6.5 days ✓ (≥70% required)
Compliance Status: COMPLIANT ✓

Machine: ResMed AirSense 10
Pressure: 12 cmH2O
Mask Fit: Good
Last Download: 10/15/2025

[Download Data] [Adjust Settings] [Order Supplies]
```

4. **Perioperative Protocol**
```
Perioperative OSA Protocol:

Risk Level: VERY HIGH
- STOP-Bang: 8/8
- Severe OSA (AHI 45)
- Chronic opioids (140 MME)
- BMI 38

ANESTHESIA RECOMMENDATIONS:
✓ Regional anesthesia preferred (spinal for knee)
✓ Minimize opioids (use multimodal analgesia)
✓ Difficult airway equipment available

MONITORING REQUIREMENTS:
✓ Extended PACU stay (minimum 3 hours)
✓ Continuous pulse oximetry 48 hours
✓ Telemetry monitoring
✓ Consider ICU-level care first 24h

EQUIPMENT:
✓ Bring home CPAP to hospital
✓ Set up CPAP first postoperative night
✓ Non-rebreather mask at bedside
✓ HOB elevated 30-45 degrees

[Print Protocol] [Share with Anesthesia] [Order Equipment]
```

---

## Integration Points

### Data Sources
```
Read from:
- patients (age, gender for STOP-Bang)
- vital_signs (BMI, neck circumference)
- diagnoses (hypertension, cardiac/pulmonary conditions)
- medications (opioids, sedatives)
- opioid_risk_assessments (MME for combined risk)
- appointments (upcoming surgeries)

Write to:
- sleep_apnea_assessments
- perioperative_protocols
- care_plans (monitoring instructions)
- alerts (high-risk notifications)
```

### Clinical Tools Integration
```
Connects with:
- Opioid MME Dashboard (Tool #2) - Combined respiratory risk
- Anesthesia Risk Calculator (Tool #1) - ASA score adjustment
- Perioperative Optimization (Tool #3) - Surgical clearance
- Vital Signs tracking - BMI auto-calculation
```

### External Devices (Future)
```
- CPAP machine downloads (ResMed, Philips Respironics)
- Home sleep study devices
- Continuous pulse oximeters
- Telemetry systems
```

---

## Alerts & Notifications

### Preoperative Alerts
```
When surgery scheduled + STOP-Bang ≥5:
⚠️ High-risk OSA patient scheduled for surgery
- STOP-Bang score: 6/8
- Anesthesia team notified
- Enhanced monitoring protocol activated
- Consider sleep study if not done

When non-compliant CPAP + surgery:
⚠️ CPAP non-compliance before surgery
- Optimize CPAP before proceeding
- Respiratory therapy consult
- May need to reschedule if <4 weeks to surgery
```

### Postoperative Alerts
```
Real-time monitoring:
🔴 Oxygen saturation <90% → Alert respiratory therapy
🔴 Respiratory rate <10 → Alert nursing/anesthesia
🔴 Apnea event detected → Check patient
```

---

## Success Criteria

### Immediate (Week 1)
- ✅ STOP-Bang calculation working
- ✅ Richard Phillips assessed (score 6-8 expected)
- ✅ Perioperative protocol generated

### Short-term (Week 2-3)
- ✅ CPAP compliance tracked
- ✅ Anesthesia team receives protocol
- ✅ Enhanced monitoring equipment ordered
- ✅ Patient educated on postop expectations

### Long-term (Week 4-6)
- ✅ All surgical patients screened for OSA
- ✅ High-risk patients identified pre-op
- ✅ Reduce respiratory complications by 30%
- ✅ CPAP compliance improves via tracking

---

## Implementation Checklist

### Step 1: Schema Creation
- [ ] Create sleep_apnea_assessments collection
- [ ] Define STOP-Bang fields
- [ ] Add CPAP compliance tracking
- [ ] Add perioperative protocol fields
- [ ] Index on patientId + assessmentDate

### Step 2: Scoring Logic
- [ ] Implement STOP-Bang calculator
- [ ] Auto-populate age, gender, BMI from patient record
- [ ] Manual entry for snoring, tired, observed apnea, neck
- [ ] Calculate total score
- [ ] Determine risk level

### Step 3: CPAP Compliance
- [ ] Track hours/night and nights/week
- [ ] Calculate compliance status
- [ ] Store machine data if available
- [ ] Trend analysis over time

### Step 4: Risk Stratification
- [ ] Combine STOP-Bang + compliance + opioid use
- [ ] Generate perioperative risk score
- [ ] Create monitoring protocol based on risk
- [ ] Flag for anesthesia team review

### Step 5: Protocol Generation
- [ ] Define monitoring requirements by risk level
- [ ] Include anesthesia recommendations
- [ ] List required equipment
- [ ] Generate patient education materials

### Step 6: Function Registration
- [ ] Add to aiHelpers.js
- [ ] Add to agentSystemPrompt.js
- [ ] Register in agentServiceV4.js
- [ ] Test Claude integration

---

## Testing Strategy

### Test Case 1: Richard Phillips (High Risk)
```
Input:
- Snoring: Yes
- Tired: Yes
- Observed apnea: Yes (CPAP user)
- Pressure: Yes (hypertension)
- BMI: 38 (>35) = Yes
- Age: 58 (>50) = Yes
- Neck: Unknown (assume >40 for obese male)
- Gender: Male = Yes

Expected STOP-Bang: 7-8/8
Risk Level: HIGH
CPAP Compliant: Yes (assume)
Perioperative Risk: VERY HIGH (OSA + opioids)
Monitoring: Extended PACU + continuous oximetry + ICU consideration
```

### Test Case 2: Low Risk Patient
```
Input:
- No snoring, not tired, no apnea, no HTN
- BMI 24, Age 35, Neck 36cm, Female

Expected STOP-Bang: 0/8
Risk Level: LOW
Monitoring: Standard postop care
```

### Test Case 3: Non-Compliant CPAP
```
Input:
- STOP-Bang: 6/8
- CPAP prescribed
- Usage: 2 hours/night, 3 nights/week

Expected:
- Compliance: NON-COMPLIANT
- Alert: Optimize CPAP before surgery
- Recommendation: Respiratory therapy consult
- May postpone surgery if <4 weeks out
```

---

## Related Tools

- **Tool #2**: Opioid MME Dashboard - Combined respiratory depression risk
- **Tool #1**: Anesthesia Risk Calculator - ASA score includes OSA
- **Tool #3**: Perioperative Optimization - Surgical clearance includes OSA management
- Vital Signs - BMI auto-calculation

---

## References

- STOP-Bang Questionnaire (University of Toronto)
- ASA Practice Guidelines for OSA
- SAMBA (Society for Ambulatory Anesthesia) OSA Guidelines
- Medicare CPAP Compliance Requirements

---

**CRITICAL**: Essential for surgical safety in OSA patients on opioids.
