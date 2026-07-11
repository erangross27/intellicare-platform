# CRITICAL GAPS - Cardiology ACS Care

**Patient**: NSTEMI post-PCI Patient
**Document**: Cardiology Acute Coronary Syndrome Admission
**Date**: October 2025

---

## 🚨 TIER 1: LIFE-THREATENING GAPS (Fix First)

### GAP #1: NO STATIN THERAPY POST-ACS ⚠️ **MOST CRITICAL**
**Current State:**
- Atorvastatin allergy documented
- **ZERO** statin therapy currently
- LDL-C unknown (needs baseline)
- Post-ACS patient = Class I indication for high-intensity statin

**Why This Kills Patients:**
- Statins reduce mortality by 25-30% post-ACS
- LDL reduction is THE most important secondary prevention
- Untreated = massively increased recurrent MI risk

**What's Missing:**
- Statin alternative finder (rosuvastatin, pravastatin, ezetimibe, PCSK9i)
- Allergy type assessment (true allergy vs intolerance)
- LDL goal setting (<70 mg/dL or <55 mg/dL for very high risk)

**Tool Needed:** **Statin Alternative Finder**

---

### GAP #2: ICD ELIGIBILITY UNDEFINED
**Current State:**
- EF 35-40% (borderline for ICD)
- No repeat echo scheduled
- No ICD decision documented
- No 40-day or 3-month reassessment plan

**Why This Matters:**
- EF ≤35% = ICD for sudden cardiac death prevention
- 40-day rule: Wait 40 days post-MI to see if EF improves
- If EF remains ≤35% at 3 months → ICD indicated

**What's Missing:**
- Automated EF tracking
- 40-day + 90-day echo scheduling
- ICD shared decision-making documentation
- LifeVest consideration if high risk

**Tool Needed:** **ICD Eligibility Calculator**

---

### GAP #3: INCOMPLETE REVASCULARIZATION
**Current State:**
- LAD stented ✓
- **70% RCA stenosis - UNTREATED**
- 50% circumflex stenosis - UNTREATED
- No plan for staged PCI documented

**Why This Matters:**
- Multivessel CAD with significant stenoses
- Complete revascularization improves outcomes
- RCA 70% may need intervention
- Need Heart Team discussion (PCI vs CABG vs medical)

**What's Missing:**
- Staged PCI scheduler
- SYNTAX score calculation
- Heart Team consultation workflow
- FFR/iFR decision support

**Tool Needed:** **PCI Need Assessor**

---

## 🟠 TIER 2: HIGH-RISK GAPS (Fix Within 2 Weeks)

### GAP #4: NO CARDIAC REHAB ENROLLMENT
**Current State:**
- Class I indication for cardiac rehab post-ACS
- No referral documented
- No insurance pre-authorization
- No patient education about benefits

**Impact:**
- 30% mortality reduction with cardiac rehab
- Improved quality of life
- Better medication compliance
- Structured exercise prescription

**What's Missing:**
- Automated cardiac rehab referral
- 36-session program tracking
- Insurance authorization workflow
- Phase II → Phase III transition

**Tool Needed:** **Cardiac Rehab Program Builder**

---

### GAP #5: MEDICATION NON-COMPLIANCE
**Current State:**
- Patient admits "sometimes forgetting" lisinopril
- No compliance intervention
- No medication reconciliation
- Pre-MI vs post-MI comparison missing

**Why This Matters:**
- ACE inhibitor critical for EF 35-40%
- Non-compliance = hospital readmission risk
- Need to identify barriers (cost, side effects, complexity)

**What's Missing:**
- Compliance tracking
- Medication simplification (once-daily dosing)
- Pillbox recommendations
- Pharmacy coordination

**Tool Needed:** **Medication Reconciliation + Compliance Tracker**

---

### GAP #6: DAPT DURATION UNDEFINED
**Current State:**
- Drug-eluting stent placed
- Aspirin + P2Y12 inhibitor (ticagrelor or clopidogrel)
- **No documented duration** (should be 12 months minimum)
- No DAPT score assessment

**Why This Matters:**
- Premature DAPT cessation = stent thrombosis risk
- Late stent thrombosis = often fatal
- Need 12 months minimum post-DES in ACS

**What's Missing:**
- DAPT calendar (12-month countdown)
- Bleeding risk assessment (PRECISE-DAPT score)
- Ticagrelor vs clopidogrel decision
- Alerts before DAPT stop date

**Tool Needed:** **DAPT Duration Tracker**

---

### GAP #7: NO GRACE RISK STRATIFICATION
**Current State:**
- NSTEMI patient
- No GRACE score calculated
- Risk category unknown (low/intermediate/high)
- Timing of angiography decision missing

**Why This Matters:**
- GRACE score guides:
  - Timing of angiography (immediate vs early vs delayed)
  - Intensity of antiplatelet therapy
  - Long-term prognosis
- Validates treatment decisions

**What's Missing:**
- Automated GRACE 2.0 calculator
- 6-month and 3-year mortality risk
- Risk-stratified discharge plan

**Tool Needed:** **GRACE Score Calculator**

---

## 🟡 TIER 3: IMPORTANT MONITORING GAPS (Fix Within 4 Weeks)

### GAP #8: PREDIABETES UNMANAGED
**Current State:**
- HbA1c 6.2% (prediabetes)
- Fasting glucose 142 mg/dL (impaired)
- No lifestyle intervention
- No diabetes prevention program referral

**Impact:**
- Diabetes = major ACS risk factor
- Prediabetes is REVERSIBLE with intervention
- Missed prevention opportunity

**Tool Needed:** **Prediabetes Risk Manager**

---

### GAP #9: RENAL FUNCTION DECLINE
**Current State:**
- Creatinine: 0.9 → 1.1 mg/dL (22% rise)
- On lisinopril (ACE inhibitor)
- No dose adjustment
- No trend analysis

**Why This Matters:**
- ACE inhibitors can worsen renal function
- Need to balance cardiac benefit vs renal risk
- May need nephrology consult if progressive

**Tool Needed:** **Kidney Function Monitor**

---

### GAP #10: LIPID GOAL TRACKING MISSING
**Current State:**
- No baseline LDL (patient on no statin)
- No LDL goal set (<70 or <55 mg/dL)
- No 4-6 week follow-up lipid panel scheduled
- Ezetimibe consideration if statin alone insufficient

**Tool Needed:** **Lipid Panel Scheduler**

---

## Prioritization Matrix

| Gap | Severity | Urgency | Impact | Priority |
|-----|----------|---------|--------|----------|
| #1 No Statin | Critical | Immediate | Death | P0 |
| #2 ICD Undefined | Critical | Days | Sudden death | P0 |
| #3 Incomplete Revasc | High | Weeks | MI risk | P1 |
| #4 No Rehab | High | Weeks | 30% mortality | P1 |
| #5 Non-compliance | High | Weeks | Readmission | P1 |
| #6 DAPT Duration | High | Weeks | Stent thrombosis | P1 |
| #7 No GRACE Score | High | Weeks | Risk stratification | P1 |
| #8 Prediabetes | Moderate | Months | Diabetes prevention | P2 |
| #9 Renal Decline | Moderate | Weeks | Kidney injury | P2 |
| #10 Lipid Tracking | Moderate | Weeks | LDL goal | P2 |

---

## Implementation Order

**Week 1-2 (CRITICAL):**
1. Statin Alternative Finder ← **START HERE**
2. ICD Eligibility Calculator
3. DAPT Duration Tracker
4. GRACE Score Calculator

**Week 3-4 (HIGH):**
5. PCI Need Assessor
6. Cardiac Rehab Program Builder
7. Medication Reconciliation

**Week 5-8 (MODERATE):**
8. Serial Troponin Tracker
9. Lipid Panel Scheduler
10. Kidney Function Monitor
11. Prediabetes Risk Manager
12. Echocardiogram Scheduler
13. Multivessel CAD Planner
14. Prescription Compliance Tracker

---

## Dependencies

**Tool #1 (Statin Alternative) BLOCKS:**
- Lipid Panel Scheduler (need statin first)
- LDL goal tracking

**Tool #2 (ICD Eligibility) REQUIRES:**
- Echocardiogram Scheduler (repeat echo needed)

**Tool #6 (Medication Reconciliation) FEEDS:**
- Compliance Tracker

---

## Patient Safety Impact

**Without These Tools:**
- ❌ No statin = 25-30% increased mortality
- ❌ No ICD evaluation = sudden cardiac death risk
- ❌ No cardiac rehab = 30% increased mortality
- ❌ DAPT stopped early = stent thrombosis (20-30% mortality)
- ❌ RCA stenosis ignored = recurrent MI

**With These Tools:**
- ✅ Statin therapy optimized
- ✅ ICD decision documented
- ✅ Cardiac rehab enrolled
- ✅ DAPT calendar tracked
- ✅ Complete revascularization planned
- ✅ **LIVES SAVED**

---

**START IMMEDIATELY WITH TOOL #1: STATIN ALTERNATIVE FINDER**
