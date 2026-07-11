# Tool #2: Opioid MME Dashboard

**Priority**: CRITICAL
**Timeline**: 4-5 days
**Complexity**: High
**Dependencies**: Prescription Generator (Tool #5)

---

## Problem Statement

Richard Phillips is on **140mg morphine milligram equivalent (MME) per day** - significantly above the CDC's 90mg/day high-dose threshold. Currently:

1. **No MME Calculation**: Total daily opioid dose unknown
2. **No Risk Assessment**: SOAPP-R, ORT scores not tracked
3. **No Weaning Protocol**: No tapering plan documented
4. **Perioperative Risk**: High-dose opioids increase surgical complications

**Current Opioid Regimen:**
- Oxycodone 20mg TID = 90mg/day × 1.5 conversion = **135 MME**
- Tramadol 50mg PRN (occasional) = ~**5 MME**
- **Total: 140 MME/day** → High-risk patient

**Impact:** Cannot proceed with surgery without opioid management plan

---

## Clinical Background

### What is MME?
- Morphine Milligram Equivalent = standardized measure of opioid potency
- Allows comparison across different opioids (oxycodone ≠ morphine ≠ fentanyl)
- CDC guideline: >90 MME/day = high-dose, requires special monitoring

### Why Track MME?
- **Surgical Risk**: High-dose opioids increase respiratory depression, PONV
- **Perioperative Planning**: Need multimodal analgesia plan
- **Tapering**: Safe reduction protocols require baseline MME
- **Compliance**: State regulations require MME documentation

### Conversion Factors (CDC)
```
Morphine = 1.0 (reference)
Oxycodone = 1.5
Hydrocodone = 1.0
Hydromorphone = 4.0
Fentanyl patch (mcg/hr) = 2.4
Tramadol = 0.1
Codeine = 0.15
```

---

## Tool Specification

### Function Name
`calculateOpioidMME()`

### Purpose
Calculate total daily morphine milligram equivalent from all active opioid prescriptions/medications.

### Parameters
```
{
  patientId: string (required),
  includeAsNeeded: boolean (default: false),  // Include PRN opioids
  usePrescriptions: boolean (default: true),  // Use Rx vs medication list
  effectiveDate: string (default: today)
}
```

### Return Value
```
{
  success: boolean,
  totalMME: number,
  riskLevel: 'low' | 'moderate' | 'high' | 'very-high',
  opioidBreakdown: [
    {
      medicationName: string,
      doseMg: number,
      frequency: string,
      dailyDose: number,
      conversionFactor: number,
      mme: number
    }
  ],
  riskAssessment: {
    cdcThreshold: string,           // "<50", "50-90", ">90"
    requiresTapering: boolean,
    requiresNaloxone: boolean,
    surgicalRisk: string
  },
  recommendations: [string],
  warnings: [string]
}
```

---

## Business Logic

### MME Calculation Formula
```
For each opioid:
1. Daily dose (mg) = dose × frequency
   Example: Oxycodone 20mg TID = 20 × 3 = 60mg/day

2. MME = daily dose × conversion factor
   Example: 60mg × 1.5 = 90 MME

3. Total MME = sum of all opioid MMEs
```

### Risk Stratification
```
CDC Thresholds:
- <50 MME: Low risk
- 50-90 MME: Moderate risk (careful monitoring)
- 90-200 MME: High risk (taper recommended)
- >200 MME: Very high risk (urgent taper)

Additional Factors:
- Sleep apnea (+1 risk level)
- Benzodiazepine coprescription (+1 risk level)
- Age >65 (+1 risk level)
```

### Perioperative Adjustments
```
Surgery Impact on MME:
- Elective surgery: Attempt taper 4-6 weeks pre-op
- Target <90 MME if possible
- If unable to taper: Enhanced monitoring
- Multimodal analgesia plan mandatory

Postoperative Considerations:
- Baseline MME + acute pain = higher doses needed
- Plan for gradual return to baseline
- Avoid opioid-free protocols in chronic users
```

---

## Data Model

### Collection: opioid_risk_assessments
```
{
  patientId: ObjectId,
  assessmentDate: Date,
  totalMME: Number,
  riskLevel: String,
  opioids: [
    {
      medicationId: ObjectId,
      name: String,
      doseMg: Number,
      frequency: String,
      dailyDose: Number,
      conversionFactor: Number,
      mme: Number
    }
  ],
  riskFactors: {
    sleepApnea: Boolean,
    benzodiazepineUse: Boolean,
    ageOver65: Boolean,
    renalImpairment: Boolean,
    hepaticImpairment: Boolean
  },
  scores: {
    soappR: Number,              // Screener and Opioid Assessment for Patients with Pain
    ort: Number,                 // Opioid Risk Tool
    comm: Number                 // Current Opioid Misuse Measure
  },
  recommendations: [String],
  naloxonePrescribed: Boolean,
  patientAgreementSigned: Boolean,
  pdmpChecked: Boolean,
  pdmpLastCheck: Date,
  weaningPlan: {
    active: Boolean,
    startDate: Date,
    targetMME: Number,
    reductionRate: String,       // "10% per week"
    nextReviewDate: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

## Functions Needed

### Core Functions
```
calculateOpioidMME(patientId)
// Returns: Total MME + breakdown

assessOpioidRisk(patientId, mme)
// Returns: Risk level + recommendations

createWeaningProtocol(patientId, targetMME, timeframe)
// Returns: Step-by-step tapering plan

recordSOAPPR(patientId, responses)
// Returns: SOAPP-R score (0-24, ≥8 = high risk)

recordORT(patientId, responses)
// Returns: ORT score (low/moderate/high risk)

checkPDMP(patientId, state)
// Returns: Prescription history from state monitoring program
```

### Analytics Functions
```
identifyHighRiskPatients(practiceId)
// Returns: Patients >90 MME or with risk factors

getPatientsNeedingNaloxone(practiceId)
// Returns: Patients >50 MME without naloxone prescription

getPreopOpioidPatients(practiceId)
// Returns: Surgical patients on chronic opioids
```

---

## User Interface

### Provider Dashboard
**Location:** Patient summary, pain management section

**Components:**

1. **MME Widget**
```
┌─────────────────────────┐
│ Opioid MME: 140 mg/day │
│ Risk: ⚠️ HIGH           │
│ Last Updated: Today     │
│ [Recalculate] [Taper]  │
└─────────────────────────┘
```

2. **Opioid Breakdown Table**
```
Medication      | Dose    | Freq | Daily | Factor | MME
─────────────────────────────────────────────────────
Oxycodone       | 20mg    | TID  | 60mg  | 1.5    | 90
Tramadol (PRN)  | 50mg    | PRN  | 50mg  | 0.1    | 5
─────────────────────────────────────────────────────
TOTAL MME: 140 mg/day (HIGH RISK)
```

3. **Risk Assessment Panel**
```
CDC Risk Level: HIGH (>90 MME)
Additional Risk Factors:
- ✓ Sleep apnea (CPAP user)
- ✓ Pending surgery
- ✗ Benzodiazepine coprescription

Recommendations:
1. Prescribe naloxone rescue kit
2. Initiate tapering protocol
3. Multimodal analgesia plan
4. Enhanced postoperative monitoring
```

4. **Weaning Protocol Generator**
```
Current MME: 140 mg/day
Target MME: <90 mg/day
Timeline: 6 weeks (10% reduction per week)

Week 1-2: Reduce to 126 MME (Oxy 18mg TID)
Week 3-4: Reduce to 113 MME (Oxy 15mg TID)
Week 5-6: Reduce to 101 MME (Oxy 15mg TID, stop tramadol)
Week 7-8: Reduce to 90 MME (Oxy 15mg BID)

[Generate Full Protocol] [Print for Patient]
```

### Alerts & Notifications
```
When MME >90:
⚠️ High-dose opioid alert
- Naloxone prescription recommended
- PDMP check required
- Patient agreement review
- Consider taper or multimodal alternatives

When surgery scheduled:
⚠️ Perioperative opioid risk
- Baseline MME: 140
- Taper recommended before surgery
- Enhanced monitoring required
- Anesthesia team notified
```

---

## Integration Points

### Data Sources
```
Read from:
- medications (current opioid list)
- prescriptions (Rx doses and frequencies)
- appointments (upcoming surgeries)
- allergies (opioid allergies/intolerances)
- vital_signs (respiratory rate baseline)

Write to:
- opioid_risk_assessments (MME calculations)
- care_plans (tapering protocols)
- prescriptions (naloxone, taper adjustments)
- alerts (high-risk notifications)
```

### Clinical Tools Integration
```
Connects with:
- Prescription Generator (Tool #5) - Source data
- Sleep Apnea Assessment (Tool #4) - Combined risk
- Pain Assessment (Tool #8) - Functional outcomes
- Anesthesia Risk Calculator (Tool #1) - Perioperative planning
```

### External APIs (Future)
```
- State PDMP integration (prescription monitoring)
- CDC opioid guideline API
- Drug interaction checking
- Insurance prior authorization
```

---

## Weaning Protocol Logic

### Safe Tapering Principles
```
1. Rate: 10% of original dose per week (slow taper)
2. Alternative: 5-10% per month (very slow for long-term users)
3. Never >25% reduction at once
4. Pause if withdrawal symptoms
5. Multimodal alternatives added during taper
```

### Tapering Schedule Generator
```
Input:
- Current MME: 140
- Target MME: 90
- Timeframe: 6 weeks

Calculate:
- Total reduction: 50 MME (36%)
- Weekly reduction: 8.3 MME
- Convert back to medication dose adjustments

Week 1: 140 → 132 MME
Week 2: 132 → 124 MME
Week 3: 124 → 116 MME
Week 4: 116 → 108 MME
Week 5: 108 → 99 MME
Week 6: 99 → 90 MME

Adjust actual medication:
- Reduce oxycodone from 20mg TID to 15mg TID (90 MME)
- Discontinue tramadol (avoid PRN confusion)
```

### Multimodal Alternatives
```
Add during taper:
- Acetaminophen 1000mg QID (baseline)
- NSAIDs (if no contraindication)
- Gabapentin/pregabalin (neuropathic component)
- Topical analgesics
- Physical therapy
- Interventional procedures (joint injections, nerve blocks)
```

---

## Risk Assessment Tools

### SOAPP-R (Screener and Opioid Assessment for Patients with Pain - Revised)
```
24-question validated screening tool
Score 0-24 points
≥8 = High risk for opioid misuse

Questions assess:
- Medication use patterns
- Substance abuse history
- Psychological distress
- Social support
```

### ORT (Opioid Risk Tool)
```
5-question assessment
Stratifies: Low / Moderate / High risk

Factors:
- Age
- Family history of substance abuse
- Personal history of substance abuse
- History of depression
- History of ADHD
```

### Implementation
```
Administer:
- Before starting chronic opioids
- Annually for existing patients
- Before surgery in chronic users
- When MME increases

Store scores in opioid_risk_assessments
Track over time
Adjust monitoring based on risk
```

---

## Success Criteria

### Immediate (Week 1)
- ✅ MME calculation working for all patients
- ✅ Richard Phillips MME = 140 documented
- ✅ High-risk flag triggers alerts

### Short-term (Week 2-3)
- ✅ Weaning protocol generated for Richard Phillips
- ✅ Naloxone prescription created
- ✅ SOAPP-R and ORT scores recorded
- ✅ PDMP checked

### Long-term (Week 4-6)
- ✅ MME reduced to <90 before surgery
- ✅ Multimodal analgesia plan in place
- ✅ Enhanced monitoring protocols activated
- ✅ All high-dose patients identified and monitored

---

## Implementation Checklist

### Step 1: Conversion Factor Library
- [ ] Create opioid conversion table (medication name → factor)
- [ ] Handle brand/generic names
- [ ] Include all common formulations (IR, ER, patches)
- [ ] Validate against CDC guidelines

### Step 2: Dose Parsing
- [ ] Parse frequency strings (QD, BID, TID, QID, Q4H, Q6H, Q8H, PRN)
- [ ] Calculate daily dose from prescription
- [ ] Handle range doses ("1-2 tablets")
- [ ] Handle PRN separately

### Step 3: MME Calculation Service
**File**: `apps/backend-api/services/opioidService.js`
- [ ] Implement calculateMME() function
- [ ] Query medications/prescriptions
- [ ] Apply conversion factors
- [ ] Sum total MME
- [ ] Determine risk level

### Step 4: Risk Stratification
- [ ] Apply CDC thresholds
- [ ] Check additional risk factors (sleep apnea, benzos, age)
- [ ] Generate recommendations
- [ ] Create alerts if high-risk

### Step 5: Weaning Protocol Generator
- [ ] Create tapering calculator
- [ ] Generate week-by-week reduction schedule
- [ ] Convert MME back to medication doses
- [ ] Include multimodal alternatives

### Step 6: Assessment Tools Integration
- [ ] Create SOAPP-R questionnaire
- [ ] Create ORT questionnaire
- [ ] Score calculation
- [ ] Store in opioid_risk_assessments

### Step 7: Function Registration
- [ ] Add to aiHelpers.js
- [ ] Add to agentSystemPrompt.js
- [ ] Register in agentServiceV4.js
- [ ] Test Claude integration

---

## Testing Strategy

### Test Case 1: Richard Phillips
```
Input:
- Oxycodone 20mg TID
- Tramadol 50mg PRN (assume 1x/day)

Expected:
- Oxycodone MME: 90 (60mg × 1.5)
- Tramadol MME: 5 (50mg × 0.1)
- Total: 95 MME (if PRN included) or 90 MME (scheduled only)
- Risk: HIGH (>90 MME)
- Additional risk: Sleep apnea
- Recommendation: Taper + naloxone + multimodal
```

### Test Case 2: Low-Dose Patient
```
Input:
- Tramadol 50mg BID

Expected:
- Tramadol MME: 10 (100mg × 0.1)
- Risk: LOW (<50 MME)
- Recommendation: Standard monitoring
```

### Test Case 3: Very High-Dose
```
Input:
- Oxycodone 30mg QID
- Morphine ER 60mg BID

Expected:
- Oxycodone MME: 180 (120mg × 1.5)
- Morphine MME: 120 (120mg × 1.0)
- Total: 300 MME
- Risk: VERY HIGH (>200 MME)
- Recommendation: URGENT taper + naloxone + specialist referral
```

---

## Related Tools

- **Tool #5**: Prescription Generator - Provides opioid prescription data
- **Tool #4**: Sleep Apnea - Combined respiratory depression risk
- **Tool #8**: Pain Assessment - Monitor pain control during taper
- **Tool #1**: Anesthesia Risk - Perioperative opioid risk

---

## References

- CDC Opioid Prescribing Guideline 2022
- Morphine Milligram Equivalent Conversion Factors
- SOAPP-R Validation Studies
- Opioid Risk Tool (ORT)
- State PDMP programs

---

**CRITICAL**: Must complete after Tool #5 (Prescription Generator) to have data source.
