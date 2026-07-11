# TIER 1 - CRITICAL TOOLS

**All 8 tools are Tier 1 (Critical)** - No secondary/tertiary tiers for this roadmap

---

## PHASE 1 OVERVIEW

This directory contains detailed implementation specifications for all 8 critical tools needed for comprehensive cardiovascular/diabetes management.

**Patient Scenario**: Andrew Peterson (67M)
- HFrEF (EF 30%), CAD s/p CABG (2018), DM2 (A1c 8.2%), HTN, CKD Stage 3a
- Requires multi-specialty coordination (cardiology, endocrinology, nephrology)
- High readmission risk (2 HF hospitalizations in past year)

---

## 🎯 RECOMMENDED IMPLEMENTATION SEQUENCE

### **START HERE** → Tool #8: Vaccine Registry (Fastest Win)

**Why Tool #8 first?**
- **Simplest implementation** (3-4 days) - Basic CRUD operations
- **No external dependencies** - No API integrations, device pairing, ML models
- **Immediate patient safety impact** - Flu season approaching, preventable hospitalizations
- **Builds confidence** - Quick win before tackling complex tools
- **Reusable infrastructure** - `vaccine_records` collection used by other workflows

**Then continue in this order**:

1. **Week 1**:
   - Tool #8 (Vaccine Registry) - 3-4 days
   - Tool #3 (Medication Adherence) - 4-5 days

2. **Week 2**:
   - Tool #1 (Cardiac Rehab) - 5-6 days
   - Tool #5 (Patient Portal) - 5-6 days

3. **Week 3**:
   - Tool #2 (RPM Platform) - 6-8 days
   - Tool #7 (Risk Stratification) - 6-7 days

4. **Week 4**:
   - Tool #4 (Care Coordination) - 7-9 days
   - Tool #6 (Clinical Pathways) - 8-10 days

**Total**: 12-15 days with 4 developers in parallel

---

## 📁 TOOL DOCUMENTS

Each tool document contains:
- ✅ Clinical background & evidence-based guidelines
- ✅ Decision logic & algorithms
- ✅ Data models & MongoDB collections (complete schemas)
- ✅ Function specifications (parameters, returns, logic)
- ✅ UI mockups (Artifact Panel format)
- ✅ Success criteria (measurable outcomes)
- ✅ Testing strategy (step-by-step verification)
- ✅ 6-step implementation checklist

---

## TOOL LIST

### **01-cardiac-rehab-management.md**
**Purpose**: Post-CABG/HF exercise program enrollment, session tracking, functional testing
**Collections**: `cardiac_rehab_programs`, `cardiac_rehab_sessions`
**Functions**: `enrollPatientInCardiacRehab()`, `logCardiacRehabSession()`, `getCardiacRehabProgress()`
**Evidence**: 26% ↓ mortality with CR participation (ACC/AHA 2021)
**Timeline**: 5-6 days

### **02-remote-patient-monitoring.md**
**Purpose**: Home vitals (BP/glucose/weight) with automated alerts for decompensation
**Collections**: `rpm_devices`, `rpm_vitals`, `rpm_alert_thresholds`
**Functions**: `enrollPatientInRPM()`, `receiveRPMVitals()`, `getRPMDashboard()`
**Evidence**: 38% ↓ HF hospitalizations with RPM (JAMA 2024)
**Timeline**: 6-8 days

### **03-medication-adherence.md**
**Purpose**: Pharmacy refill monitoring, PDC score calculation, non-adherence alerts
**Collections**: `medication_adherence`, `pharmacy_fill_data`
**Functions**: `calculateMedicationAdherence()`, `trackPharmacyRefills()`, `getMedicationAdherenceReport()`
**Evidence**: 50% adherence to HF meds at 6 months (JAMA 2023)
**Timeline**: 4-5 days

### **04-care-coordination.md**
**Purpose**: Multi-specialty team workspace with shared care plans, conflict detection
**Collections**: `care_teams`, `shared_care_plans`, `care_team_communications`
**Functions**: `createCareTeam()`, `updateSharedCarePlan()`, `sendCareTeamMessage()`, `getCareTeamDashboard()`
**Evidence**: 28% ↓ readmissions with care coordination (NEJM Catalyst 2023)
**Timeline**: 7-9 days

### **05-patient-portal-integration.md**
**Purpose**: HF/DM-specific education, symptom tracking (KCCQ, dyspnea), action plans
**Collections**: `patient_education_modules`, `symptom_pros`, `patient_action_plans`
**Functions**: `sendEducationModule()`, `collectSymptomPRO()`, `getPatientActionPlan()`
**Evidence**: 22% ↓ HF readmissions with portal engagement (Circulation 2024)
**Timeline**: 5-6 days

### **06-clinical-pathways-engine.md**
**Purpose**: Automated GDMT protocols, dose titration suggestions, contraindication checking
**Collections**: `clinical_pathways`, `pathway_steps`, `pathway_execution_log`
**Functions**: `initiateGDMTPathway()`, `evaluatePathwayStep()`, `getPathwayProgress()`
**Evidence**: Rapid GDMT titration = 34% ↓ readmission (STRONG-HF Trial 2022)
**Timeline**: 8-10 days

### **07-risk-stratification.md**
**Purpose**: HF readmission & MACE prediction with risk-based care pathways
**Collections**: `risk_scores`, `risk_stratification_log`
**Functions**: `calculateLACEScore()`, `calculateMAGGICScore()`, `getRiskStratifiedCarePlan()`
**Evidence**: LACE ≥10 = 40% readmission vs. 15% if <10 (JACC HF 2023)
**Timeline**: 6-7 days

### **08-vaccine-registry.md** ⭐ **START HERE**
**Purpose**: Centralized vaccine tracking with gap identification and automated reminders
**Collections**: `vaccine_records`, `vaccine_schedules`, `vaccine_reminders`
**Functions**: `recordVaccine()`, `identifyVaccineGaps()`, `sendVaccineReminder()`
**Evidence**: Flu vaccine = 18% ↓ CV events in HF patients (AHA 2022)
**Timeline**: 3-4 days

---

## PATTERN CONSISTENCY

Each tool follows the **same NO CODE framework** used in:
- ✅ Hospital Discharge Summary (9 tools)
- ✅ Allergy & Immunology (10 tools)
- ✅ Anesthesiology/Perioperative (10 tools)
- ✅ Cardiology ACS (14 tools)
- ✅ Cardiology AF (5 tools)
- ✅ **Cardiology Comprehensive Management (8 tools)** ← YOU ARE HERE

**Document Structure** (consistent across all tools):
1. **Clinical Background** - Problem statement, current workaround, patient safety impact
2. **Evidence Base** - Guidelines, trials, quality metrics
3. **Decision Logic** - Pseudocode algorithms
4. **Data Models** - Complete MongoDB schemas
5. **Function Specifications** - Parameters, returns, logic for each function
6. **UI Mockups** - Artifact Panel format (matches existing templates)
7. **Success Criteria** - Measurable outcomes (readmission rates, adherence %, etc.)
8. **Testing Strategy** - Step-by-step verification plan
9. **6-Step Implementation Checklist** - Schema → Handler → Register → Routes → aiHelpers → Frontend

---

## NEXT STEPS

1. **Read `08-vaccine-registry.md`** (fastest win, build confidence)
2. **Implement 6-step checklist**:
   - Step 1: Schema in `collectionSchemas.js`
   - Step 2: Handler in `vaccineService.js`
   - Step 3: Register in `medicalCollectionsService.js`
   - Step 4: Routes in `routes/agent.js`
   - Step 5: Functions in `aiHelpers.js`
   - Step 6: Frontend `VaccineRegistryDocument.jsx`
3. **Test with sample patient**: HFrEF + DM + CKD, missing flu vaccine
4. **Move to Tool #3**: Medication Adherence (4-5 days)

---

**Generated**: October 20, 2025
**Last Updated**: October 20, 2025
🤖 Generated with Claude Code
