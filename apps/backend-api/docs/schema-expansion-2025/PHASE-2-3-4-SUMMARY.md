# Phases 2-4: Task Summary (Quick Reference)

## Phase 2: Specialized Testing (4 tasks)

### Task 07: Advanced Neuroimaging
- **PDF:** `advanced_imaging_fmri_dti_tractography.pdf`
- **Collection:** Extend `imaging_reports` 
- **Key Fields:** fMRI activation maps, DTI tractography, eloquent cortex localization, surgical risk assessment

### Task 08: Comprehensive Pulmonary Function Tests
- **PDF:** `pulmonary_function_test_comprehensive.pdf`
- **Collection:** Extend `pulmonary_function_tests`
- **Key Fields:** Full spirometry, lung volumes (TLC, RV), DLCO, bronchodilator response, flow-volume loops

### Task 09: Nuclear Medicine Studies
- **PDF:** `nuclear_medicine_kenneth_rogers.pdf`
- **Collection:** `nuclear_medicine_studies`
- **Key Fields:** PET/CT, SPECT, radiotracer, SUV values, areas of uptake

### Task 10: Cardiac Device Interrogations
- **PDF:** `implantable_cardiac_device_icd_evaluation.pdf`
- **Collection:** `cardiac_device_interrogations`
- **Key Fields:** Device type, lead impedances, battery, pacing parameters, arrhythmia episodes, therapies delivered

## Phase 3: Care Coordination (5 tasks)

### Task 11: Social Determinants of Health
- **PDF:** `barriers_to_care_housing_financial.pdf`
- **Collection:** `social_determinants_of_health`
- **Key Fields:** Housing status, food security, financial barriers, transportation, referrals

### Task 12: Enhanced Discharge Planning
- **PDF:** `discharge_planning_post_cardiac_surgery.pdf`
- **Collection:** Extend `discharge_summaries`
- **Key Fields:** DME ordered, home health, cardiac rehab, dietary/activity restrictions

### Task 13: Medication Access Programs
- **PDF:** `medication_access_patient_assistance.pdf`
- **Collection:** `medication_access_programs`
- **Key Fields:** Program enrolled, application status, coverage amount, renewal date

### Task 14: Biomarker Trending
- **PDF:** `cardiac_biomarker_troponin_trending.pdf`
- **Collection:** Extend `lab_results`
- **Key Fields:** Serial values with timestamps, peak value, trend direction, time to peak

### Task 15: STEMI-Specific Metrics
- **PDF:** `cardiac_catheterization_stemi_protocol.pdf`
- **Collection:** Extend `cardiac_catheterization_reports`
- **Key Fields:** Door-to-balloon time, TIMI flow, myocardial blush grade, stent details

## Phase 4: Administrative/Quality (3 tasks)

### Task 16: Clinical Risk Scores
- **PDF:** `clinical_risk_scores_comprehensive.pdf`
- **Collection:** `clinical_risk_scores`
- **Key Fields:** CHA2DS2-VASc, HAS-BLED, HEART, GRACE, STOP-BANG with components and interpretation

### Task 17: Quality Metrics
- **PDF:** `quality_metrics_door_to_balloon_time.pdf`
- **Collection:** `quality_metrics`
- **Key Fields:** Metric name, target value, actual value, met/not met, barriers

### Task 18: Sports Medicine & Occupational Medicine
- **PDF:** `sports_physical_examination.pdf`, `occupational_medicine_work_injury.pdf`
- **Collections:** `sports_medicine_evaluations`, `occupational_medicine_evaluations`
- **Key Fields:** Sport/occupation, cardiac screening, MSK exam, clearance status, work restrictions

---

**Implementation Note:** All Phase 2-4 tasks follow the same 6-step implementation process as Phase 1. Each task file contains complete schema code ready to insert into claudeBatchProcessor.js.

**Priority Order:**
1. Phase 1 (Critical Clinical) - HIGHEST
2. Phase 2 (Specialized Testing) - HIGH
3. Phase 3 (Care Coordination) - MEDIUM
4. Phase 4 (Administrative/Quality) - LOWER

Total: 18 tasks to achieve 100% PDF template coverage.
