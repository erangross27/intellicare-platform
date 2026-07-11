# Tier 1: Critical Cardiac Tools

**Phase**: Critical Cardiac Safety
**Timeline**: Week 1-4
**Tools**: 7 critical tools
**Patient Impact**: Immediate cardiac death prevention

---

## Overview

These 7 tools address **IMMEDIATELY LIFE-THREATENING** gaps in post-ACS care:

1. **No statin therapy** despite ACS (25-30% mortality increase)
2. **Undefined ICD eligibility** (sudden cardiac death risk)
3. **DAPT duration unclear** (stent thrombosis risk)
4. **Incomplete revascularization** (recurrent MI risk)
5. **No cardiac rehab** (30% mortality increase)
6. **Medication non-compliance** (hospital readmission)
7. **No GRACE risk stratification** (inappropriate care intensity)

---

## Tool Priority Order

### Days 1-2: Tool #1 - Statin Alternative Finder ⭐ START HERE
**Why First:**
- Patient on ZERO statin post-ACS
- Atorvastatin allergy requires immediate alternative
- Every day without statin = increased MI/death risk
- **BLOCKS** downstream lipid management

**Deliverable:** Alternative lipid therapy prescribed

---

### Days 3-5: Tool #2 - ICD Eligibility Calculator
**Why Second:**
- EF 35-40% (borderline for ICD)
- Sudden cardiac death prevention critical
- Need 3-month reassessment plan NOW

**Deliverable:** ICD decision pathway documented

---

### Days 6-8: Tool #3 - DAPT Duration Tracker
**Why Third:**
- Drug-eluting stent placed
- Premature DAPT stop = stent thrombosis (often fatal)
- Need 12-month calendar TODAY

**Deliverable:** DAPT tracked, alerts active

---

### Days 9-10: Tool #7 - GRACE Score Calculator
**Why Fourth:**
- Quick implementation (2 days)
- Validates all other decisions
- Risk stratification guides therapy intensity

**Deliverable:** GRACE score calculated, risk category set

---

### Days 11-14: Tool #4 - PCI Need Assessor
**Why Fifth:**
- 70% RCA stenosis decision complex
- Requires SYNTAX score, FFR consideration
- Heart Team discussion needed

**Deliverable:** RCA management plan (staged PCI vs medical)

---

### Days 15-18: Tool #5 - Cardiac Rehab Program
**Why Sixth:**
- 30% mortality reduction
- Enrollment window time-sensitive (best within 4 weeks)
- Insurance authorization takes time

**Deliverable:** Cardiac rehab enrolled, session #1 scheduled

---

### Days 19-21: Tool #6 - Medication Reconciliation
**Why Last in Phase 1:**
- Comprehensive tool requiring all above completed
- Integrates statin alternative, DAPT, ACE inhibitor decisions
- Foundation for compliance tracking (Tier 2)

**Deliverable:** Complete med reconciliation, compliance plan

---

## Success Criteria

### Week 2 Checkpoint:
- ✅ Tool #1: Alternative statin prescribed
- ✅ Tool #2: ICD pathway clear
- ✅ Tool #3: DAPT calendar active
- ✅ Tool #7: GRACE score documented

**Decision Point:** If all 4 complete → Proceed to Tools #4-6
**If blocked:** Escalate immediately

---

### Week 4 Checkpoint:
- ✅ Tool #4: RCA plan documented
- ✅ Tool #5: Cardiac rehab enrolled
- ✅ Tool #6: Medication reconciliation complete

**Decision Point:** Patient safe for long-term monitoring (move to Tier 2)

---

## Critical Dependencies

**TOOL #1 BLOCKS:**
- Lipid Panel Scheduler (Tier 2, Tool #9)
- LDL goal tracking

**TOOL #2 REQUIRES:**
- Echocardiogram Scheduler (Tier 2, Tool #12)

**TOOL #6 INTEGRATES:**
- All medication decisions from Tools #1, #3
- Feeds Compliance Tracker (Tier 2, Tool #14)

---

## Patient Safety Gates

**CANNOT PROCEED TO TIER 2 UNTIL:**
1. ✅ Statin alternative prescribed
2. ✅ ICD decision documented
3. ✅ DAPT duration = 12 months
4. ✅ GRACE score calculated
5. ✅ RCA management plan clear
6. ✅ Cardiac rehab enrolled
7. ✅ Medication reconciliation complete

**If any gate fails:** STOP and fix immediately

---

## Implementation Notes

### For Developers:
- **Start with Tool #1** (most critical)
- Each tool = 1-4 days (average 2.5 days)
- Total Phase 1 = 21 days (3 weeks)
- Test each tool before moving to next
- Use real ACS patient data for testing

### For Clinicians:
- Review algorithms BEFORE development starts
- Validate decision logic matches ACC/AHA guidelines
- Test with actual patient cases
- Provide feedback within 24 hours

---

## Tools in This Phase

1. [Statin Alternative Finder](./01-statin-alternative-finder.md) - **START HERE**
2. [ICD Eligibility Calculator](./02-icd-eligibility-calculator.md)
3. [DAPT Duration Tracker](./03-dapt-duration-tracker.md)
4. [PCI Need Assessor](./04-pci-need-assessor.md)
5. [Cardiac Rehab Program Builder](./05-cardiac-rehab-program.md)
6. [Medication Reconciliation Tool](./06-medication-reconciliation.md)
7. [GRACE Score Calculator](./07-grace-score-calculator.md)

---

**NEXT STEP**: Read `01-statin-alternative-finder.md`
