# All Tasks Summary: Cardiology - Acute Coronary Syndrome

**Patient Case**: NSTEMI post-PCI Patient
**Document Analyzed**: Cardiology Acute Coronary Syndrome Admission
**Total Tools**: 14 (7 Critical, 7 Moderate Priority)
**Timeline**: 6-8 weeks
**Last Updated**: October 19, 2025

---

## 🔴 TIER 1: CRITICAL CARDIAC TOOLS (Week 1-4)

### Tool #1: Statin Alternative Finder ⭐ **START HERE**
**File**: `01-statin-alternative-finder.md`
**Priority**: CRITICAL - BLOCKING
**Timeline**: 1-2 days

**Problem**: Atorvastatin allergy, ZERO statin therapy post-ACS

**Functionality**:
- Allergy type classifier (true allergy vs intolerance vs myopathy)
- Alternative statin selector (rosuvastatin, pravastatin, fluvastatin, pitavastatin)
- Non-statin options (ezetimibe, PCSK9 inhibitors, bempedoic acid)
- LDL goal calculator (<70 or <55 mg/dL based on risk)
- Desensitization protocol generator

**Success**: Alternative lipid-lowering therapy prescribed

---

### Tool #2: ICD Eligibility Calculator
**File**: `02-icd-eligibility-calculator.md`
**Priority**: CRITICAL
**Timeline**: 2-3 days

**Problem**: EF 35-40%, no ICD decision, no follow-up echo

**Functionality**:
- EF tracker over time
- 40-day post-MI rule enforcement
- 90-day reassessment scheduler
- ICD shared decision-making template
- LifeVest consideration for high-risk patients
- MADIT-II, SCD-HeFT criteria application

**Success**: ICD eligibility determined, 3-month echo scheduled

---

### Tool #3: DAPT Duration Tracker
**File**: `03-dapt-duration-tracker.md`
**Priority**: CRITICAL
**Timeline**: 2-3 days

**Problem**: DES placed, DAPT duration undefined (needs 12 months minimum)

**Functionality**:
- DAPT calendar (aspirin + P2Y12 inhibitor)
- 12-month countdown timer
- DAPT score calculator (extension vs standard duration)
- PRECISE-DAPT bleeding risk score
- Alerts at 30/60/90 days before cessation
- Ticagrelor vs clopidogrel decision support

**Success**: 12-month DAPT duration documented, calendar alerts active

---

### Tool #4: PCI Need Assessor (Incomplete Revascularization)
**File**: `04-pci-need-assessor.md`
**Priority**: HIGH
**Timeline**: 3-4 days

**Problem**: 70% RCA stenosis untreated, 50% circumflex stenosis, no plan

**Functionality**:
- Residual stenosis tracker
- SYNTAX score calculator (PCI vs CABG decision)
- FFR/iFR recommendation engine
- Staged PCI scheduler (4-6 weeks post-index)
- Heart Team consultation workflow
- Medical management vs revascularization decision tree

**Success**: RCA management plan documented (staged PCI vs medical)

---

### Tool #5: Cardiac Rehab Program Builder
**File**: `05-cardiac-rehab-program.md`
**Priority**: HIGH
**Timeline**: 3-4 days

**Problem**: No cardiac rehab referral despite Class I indication

**Functionality**:
- Automated cardiac rehab referral generator
- Insurance pre-authorization workflow
- 36-session program tracker (3x/week for 12 weeks)
- Exercise prescription calculator (target heart rate, METs)
- Phase II → Phase III transition planner
- Outcome tracking (functional capacity, QoL, weight, BP)

**Success**: Cardiac rehab enrolled, first session scheduled

---

### Tool #6: Medication Reconciliation Tool
**File**: `06-medication-reconciliation.md`
**Priority**: HIGH
**Timeline**: 2-3 days

**Problem**: Pre-MI vs post-MI meds unclear, poor lisinopril compliance

**Functionality**:
- Pre-admission vs post-discharge med comparison
- Medication additions/deletions/changes highlighting
- Dosing optimization (once-daily regimens preferred)
- Drug interaction checking
- Compliance barrier assessment (cost, side effects, complexity)
- Pillbox recommendations

**Success**: Medication reconciliation complete, compliance plan created

---

### Tool #7: GRACE Score Calculator
**File**: `07-grace-score-calculator.md`
**Priority**: HIGH
**Timeline**: 2 days

**Problem**: No formal MI risk stratification

**Functionality**:
- GRACE 2.0 calculator (8 variables)
- 6-month and 3-year mortality prediction
- Risk categorization (low/intermediate/high)
- Angiography timing recommendation
- Intensity of antiplatelet therapy decision
- Discharge risk stratification

**Success**: GRACE score calculated, risk category documented

---

## 🟡 TIER 2: MONITORING & OPTIMIZATION TOOLS (Week 5-8)

### Tool #8: Serial Troponin Tracker
**Priority**: MODERATE
**Functionality**: Track peak troponin, trend analysis, prognostic implications

---

### Tool #9: Lipid Panel Scheduler
**Priority**: MODERATE
**Functionality**: 4-6 week post-statin lipid check, LDL goal tracking (<70 or <55 mg/dL)

---

### Tool #10: Kidney Function Monitor
**Priority**: MODERATE
**Functionality**: Creatinine trend, ACE inhibitor dose adjustment, contrast nephropathy risk

---

### Tool #11: Prediabetes Risk Manager
**Priority**: MODERATE
**Functionality**: HbA1c 6.2% management, lifestyle intervention, diabetes prevention program referral

---

### Tool #12: Echocardiogram Scheduler
**Priority**: MODERATE
**Functionality**: 3-month repeat echo for ICD re-evaluation, EF trend tracking

---

### Tool #13: Multivessel CAD Treatment Planner
**Priority**: MODERATE
**Functionality**: 3-vessel disease strategy (staged PCI vs CABG vs medical), SYNTAX score-guided

---

### Tool #14: Prescription Compliance Tracker
**Priority**: MODERATE
**Functionality**: Medication adherence monitoring, barrier identification, intervention tracking

---

## 📊 IMPLEMENTATION ROADMAP

### Phase 1: Critical Cardiac Safety (Week 1-2)
```
Day 1-2:   Tool #1 (Statin Alternative)
Day 3-5:   Tool #2 (ICD Eligibility)
Day 6-8:   Tool #3 (DAPT Tracker)
Day 9-10:  Tool #7 (GRACE Score)
```

### Phase 2: Revascularization & Rehab (Week 3-4)
```
Day 11-14: Tool #4 (PCI Need Assessment)
Day 15-18: Tool #5 (Cardiac Rehab)
Day 19-21: Tool #6 (Medication Reconciliation)
```

### Phase 3: Monitoring & Long-term (Week 5-8)
```
Week 5: Tools #8, #9, #10 (Labs & Monitoring)
Week 6: Tools #11, #12 (Diabetes, Echo)
Week 7-8: Tools #13, #14 (CAD Strategy, Compliance)
```

---

## 🎯 SUCCESS METRICS

### Week 2 (After Phase 1)
- ✅ Statin alternative prescribed (or ezetimibe/PCSK9i started)
- ✅ Baseline LDL measured
- ✅ ICD eligibility assessed, 3-month echo scheduled
- ✅ DAPT duration = 12 months (aspirin + ticagrelor/clopidogrel)
- ✅ GRACE score calculated, risk stratified

### Week 4 (After Phase 2)
- ✅ RCA stenosis plan documented
- ✅ Cardiac rehab referral sent, first session booked
- ✅ Medication reconciliation complete
- ✅ Compliance barriers identified

### Week 8 (All Tools Complete)
- ✅ All 14 tools deployed
- ✅ Complete post-ACS optimization
- ✅ LDL at goal (<70 or <55 mg/dL)
- ✅ EF re-assessed at 3 months
- ✅ Long-term monitoring protocols active
- ✅ **PATIENT SAFE FOR LONG-TERM**

---

## ⚠️ CRITICAL DEPENDENCIES

### Tool Dependencies
```
Tool #1 (Statin Alternative) → BLOCKS Tool #9 (Lipid Panel Scheduler)
Tool #2 (ICD Eligibility) → REQUIRES Tool #12 (Echo Scheduler)
Tool #6 (Medication Reconciliation) → FEEDS Tool #14 (Compliance Tracker)
```

### Data Dependencies
```
All tools require:
- SecureDataAccess framework ✓ (exists)
- Multi-tenant isolation ✓ (exists)
- Patient record ✓ (exists)
- Lab results collection ✓ (exists)
- Medications collection ✓ (exists)
- Vital signs collection ✓ (exists)

New collections needed:
- statin_alternatives (Tool #1)
- icd_eligibility_assessments (Tool #2)
- dapt_tracking (Tool #3)
- pci_need_assessments (Tool #4)
- cardiac_rehab_programs (Tool #5)
- medication_reconciliations (Tool #6)
- grace_scores (Tool #7)
```

---

## 📋 PATIENT CASE STUDY

**Current State:**
- NSTEMI post-PCI ✓
- Atorvastatin allergy, NO statin ❌
- EF 35-40%, no ICD plan ❌
- 70% RCA stenosis untreated ❌
- No cardiac rehab ❌
- Poor medication compliance ❌
- HbA1c 6.2% (prediabetes) ⚠️
- Creatinine rising (0.9 → 1.1) ⚠️

**After All Tools Deployed:**
- Statin alternative prescribed (rosuvastatin or ezetimibe) ✅
- ICD eligibility determined, 3-month echo scheduled ✅
- DAPT tracked for 12 months ✅
- RCA management plan documented ✅
- Cardiac rehab enrolled ✅
- Medication reconciliation complete, compliance improved ✅
- Prediabetes managed with lifestyle intervention ✅
- Kidney function monitored, ACE dose adjusted ✅
- **READY FOR LONG-TERM SUCCESS** ✅

---

## 🔧 TECHNICAL IMPLEMENTATION

### Common Patterns (All Tools)
```
Security:
- Use SecureDataAccess for all queries
- Practice-level data isolation
- Service-based authentication
- Audit logging

Function Registration:
- Add to generatedMedicalFunctions.js (CRUD handlers)
- Add to aiHelpers.js (function definitions)
- Test with Claude integration

Data Validation:
- Required field checking
- Range validation (EF 0-100%, GRACE score 0-300)
- Date validation
- Multi-tenant verification
```

### Integration Points
```
Shared Data:
- Patient demographics
- Medications
- Lab results (troponin, lipids, creatinine, HbA1c)
- Imaging (echocardiograms)
- Vital signs (BP, HR)
- Procedures (PCI records)

Cross-Tool Communication:
- Statin Alternative → Lipid Panel Scheduler
- ICD Eligibility → Echo Scheduler
- DAPT Tracker → Prescription Compliance
- All assessments feed Medication Reconciliation
```

---

## 📚 REFERENCE DOCUMENTS

### Clinical Guidelines
- ACC/AHA NSTEMI Guidelines 2023
- ESC Acute Coronary Syndromes Guidelines 2023
- GRACE Risk Score 2.0
- ACC/AHA Cholesterol Guidelines 2018
- HRS/ACC/AHA ICD Guidelines 2017
- ACC/AHA Cardiac Rehab Scientific Statement
- DAPT Study, PEGASUS-TIMI 54

### IntelliCare Documentation
- CLAUDE.md: 6-Step Implementation Checklist
- Security Framework: SecureDataAccess patterns
- Collection Schemas: Medical data models
- Agent System: Function registration process

---

## ✅ WHAT WE ALREADY HAVE (Don't Need to Build)

**Existing Tools:**
- ✅ Basic medication list
- ✅ Lab result tracking
- ✅ Imaging report storage
- ✅ Vital signs monitoring
- ✅ Appointment scheduling (basic)
- ✅ Allergy documentation
- ✅ Drug interaction checker

**Infrastructure:**
- ✅ SecureDataAccess framework
- ✅ Multi-tenant architecture
- ✅ MongoDB collections
- ✅ Agent function execution
- ✅ Claude integration

---

## 🚀 GETTING STARTED

**For Developers:**
1. Start with `tier-1-critical/README.md`
2. Read Tool #1 first (Statin Alternative Finder)
3. Follow 6-step implementation checklist
4. Test with ACS patient case
5. Move to next tool

**For Project Managers:**
1. Review `CRITICAL-GAPS.md` for patient safety issues
2. Prioritize Tool #1 (patient on NO statin post-ACS!)
3. Allocate 1-2 weeks per tool (2 developers)
4. Track progress with checklist completion
5. Test each tool before proceeding

**For Cardiologists:**
1. Review each tool's clinical algorithms
2. Validate GRACE score, ICD criteria, DAPT duration logic
3. Approve statin alternative decision tree
4. Test with actual ACS patients
5. Provide feedback on workflows

---

**REMEMBER**: NO CODE in these files - just frameworks, requirements, and specifications!

**START WITH**: Tool #1 (Statin Alternative Finder) - Patient on NO statin = IMMEDIATE DANGER!
