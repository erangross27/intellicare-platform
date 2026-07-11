# Cardiology - Acute Coronary Syndrome Tools

**Patient Case**: Patient with NSTEMI post-PCI
**Document Analyzed**: Cardiology Acute Coronary Syndrome Admission
**Total Tools**: 14 (7 Critical, 7 Moderate Priority)
**Timeline**: 6-8 weeks
**Last Updated**: October 19, 2025

---

## Clinical Context

**Patient Scenario:**
- NSTEMI with PCI to LAD (drug-eluting stent)
- Residual 70% RCA stenosis, 50% circumflex stenosis (multivessel CAD)
- Reduced EF 35-40% (needs ICD evaluation)
- Atorvastatin allergy - currently on NO statin therapy
- Poor medication compliance (lisinopril)
- Prediabetes (HbA1c 6.2%)
- Rising creatinine (0.9 → 1.1 mg/dL)

**Critical Gaps:**
1. **NO STATIN THERAPY** despite ACS (allergic to atorvastatin, no alternative prescribed)
2. **ICD ELIGIBILITY** undefined (EF 35-40% borderline, needs repeat echo in 3 months)
3. **INCOMPLETE REVASCULARIZATION** (70% RCA stenosis untreated)
4. **NO CARDIAC REHAB** enrollment
5. **MEDICATION NON-COMPLIANCE** not addressed
6. **PREDIABETES** unmanaged (HbA1c 6.2%)
7. **RENAL FUNCTION DECLINE** not monitored

---

## 🔴 TIER 1: CRITICAL CARDIAC TOOLS (Week 1-4)

### Tool #1: Statin Alternative Finder ⭐ **START HERE**
**Priority**: CRITICAL - BLOCKING
**Timeline**: 1-2 days
**Problem**: Atorvastatin allergy, NO current statin therapy post-ACS

### Tool #2: ICD Eligibility Calculator
**Priority**: CRITICAL
**Timeline**: 2-3 days
**Problem**: EF 35-40%, unclear if ICD needed, no follow-up echo scheduled

### Tool #3: DAPT Duration Tracker
**Priority**: CRITICAL
**Timeline**: 2-3 days
**Problem**: Dual antiplatelet therapy duration undefined (12 months minimum post-DES)

### Tool #4: PCI Need Assessor (Incomplete Revascularization)
**Priority**: HIGH
**Timeline**: 3-4 days
**Problem**: 70% RCA stenosis untreated, no plan for staged PCI vs medical management

### Tool #5: Cardiac Rehab Program Builder
**Priority**: HIGH
**Timeline**: 3-4 days
**Problem**: No cardiac rehab enrollment despite ACS indication

### Tool #6: Medication Reconciliation Tool
**Priority**: HIGH
**Timeline**: 2-3 days
**Problem**: Pre-MI vs post-MI medication comparison missing, compliance issues

### Tool #7: GRACE Score Calculator
**Priority**: HIGH
**Timeline**: 2 days
**Problem**: No formal MI risk stratification documented

---

## 🟡 TIER 2: MONITORING & OPTIMIZATION (Week 5-8)

### Tool #8: Serial Troponin Tracker
**Priority**: MODERATE
**Problem**: Peak troponin pending, trend analysis not automated

### Tool #9: Lipid Panel Scheduler
**Priority**: MODERATE
**Problem**: No 4-6 week post-statin lipid check scheduled

### Tool #10: Kidney Function Monitor
**Priority**: MODERATE
**Problem**: Creatinine rising (0.9 → 1.1), no ACE inhibitor dose adjustment

### Tool #11: Prediabetes Risk Manager
**Priority**: MODERATE
**Problem**: HbA1c 6.2% indicates prediabetes, no lifestyle intervention

### Tool #12: Echocardiogram Scheduler
**Priority**: MODERATE
**Problem**: No 3-month repeat echo for ICD re-evaluation

### Tool #13: Multivessel CAD Treatment Planner
**Priority**: MODERATE
**Problem**: 3-vessel disease strategy undefined (staged PCI vs CABG vs medical)

### Tool #14: Prescription Compliance Tracker
**Priority**: MODERATE
**Problem**: Patient admits poor lisinopril compliance, no intervention

---

## Implementation Priority

### Phase 1: Immediate Cardiac Safety (Week 1-2)
```
Days 1-2:  Tool #1 (Statin Alternative)
Days 3-5:  Tool #2 (ICD Eligibility)
Days 6-8:  Tool #3 (DAPT Tracker)
Days 9-10: Tool #7 (GRACE Score)
```

### Phase 2: Revascularization & Rehab (Week 3-4)
```
Days 11-14: Tool #4 (PCI Need Assessment)
Days 15-18: Tool #5 (Cardiac Rehab)
Days 19-21: Tool #6 (Medication Reconciliation)
```

### Phase 3: Monitoring & Long-term (Week 5-8)
```
Week 5: Tools #8, #9, #10 (Labs & Monitoring)
Week 6: Tools #11, #12 (Diabetes, Echo)
Week 7-8: Tools #13, #14 (CAD Strategy, Compliance)
```

---

## Success Metrics

### Week 2 (After Phase 1)
- ✅ Statin alternative prescribed (rosuvastatin, pravastatin, or ezetimibe)
- ✅ ICD eligibility assessed, 3-month echo scheduled
- ✅ DAPT duration set (12 months aspirin + ticagrelor/clopidogrel)
- ✅ GRACE score calculated, risk stratified

### Week 4 (After Phase 2)
- ✅ RCA stenosis plan documented (staged PCI vs medical management)
- ✅ Cardiac rehab referral sent (36 sessions)
- ✅ Medication reconciliation complete
- ✅ Compliance intervention started

### Week 8 (All Tools Complete)
- ✅ All 14 tools deployed
- ✅ Complete post-ACS optimization
- ✅ Long-term monitoring protocols active
- ✅ Secondary prevention maximized

---

## Clinical Guidelines Referenced

- **ACC/AHA NSTEMI Guidelines 2023**
- **ESC Acute Coronary Syndromes Guidelines 2023**
- **GRACE Risk Score (2.0)**
- **ACC/AHA Cholesterol Guidelines 2018** (statin therapy post-ACS)
- **HRS/ACC/AHA ICD Guidelines 2017** (primary prevention ICD)
- **ACC/AHA Cardiac Rehab Guidelines**
- **DAPT Study** (dual antiplatelet duration)

---

## What We Already Have

**Existing IntelliCare Tools:**
- ✅ Basic medication list
- ✅ Lab result tracking
- ✅ Imaging report storage
- ✅ Vital signs monitoring
- ✅ Appointment scheduling

**Infrastructure Ready:**
- ✅ SecureDataAccess framework
- ✅ Multi-tenant MongoDB
- ✅ Agent function execution
- ✅ Claude integration

---

## What We're Building

**NEW cardiac-specific tools** to bridge gaps in:
1. Statin allergy management
2. ICD eligibility assessment
3. Dual antiplatelet therapy tracking
4. Incomplete revascularization planning
5. Cardiac rehab enrollment
6. Medication reconciliation post-ACS
7. GRACE risk stratification
8. Serial biomarker monitoring
9. Lipid goal tracking
10. Kidney function monitoring post-ACE inhibitor
11. Prediabetes intervention
12. Echocardiogram scheduling
13. Multivessel CAD strategy
14. Medication compliance tracking

---

## Getting Started

**For Developers:**
1. Start with `tier-1-critical/README.md`
2. Read Tool #1 first (Statin Alternative Finder)
3. Follow 6-step implementation checklist (from CLAUDE.md)
4. Test with real cardiology case
5. Move to next tool

**For Clinicians:**
1. Review each tool's clinical background
2. Validate decision algorithms (GRACE, ICD eligibility)
3. Approve statin alternative logic
4. Test with actual ACS patients

---

**REMEMBER**: NO CODE in these files - just frameworks and specifications!

**START WITH**: Tool #1 (Statin Alternative Finder) - Patient is on NO statin post-ACS!
