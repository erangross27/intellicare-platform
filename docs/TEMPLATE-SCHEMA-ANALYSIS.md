# Medical Template vs Extraction Schema Analysis
**Generated:** October 22, 2025
**Location:** IntelliCare/TEMPLATE-SCHEMA-ANALYSIS.md

## Executive Summary

**Total PDF Templates:** 90 medical document templates
**Coverage:** 72/90 templates have extraction schemas (80%)
**Missing Schemas:** 18 templates need specialized extraction schemas (20%)

## 📊 Coverage Breakdown

### ✅ Templates WITH Extraction Schemas: 72 (80%)

These templates will be properly extracted when analyzed via Claude Batch API:

#### Surgical Specialties (14 templates)
1. **bariatric_surgery_preop_gastric_bypass** → `operative_reports`
2. **burn_surgery_admission_house_fire** → `operative_reports`
3. **cardiothoracic_surgery_post_cabg** → `operative_reports`, `post_operative_reports`
4. **colorectal_surgery_betty_bailey** → `operative_reports`
5. **hand_surgery_carpal_tunnel_release** → `operative_reports`
6. **neurosurgery_awake_craniotomy_planning** → `operative_reports`, `neurology_consultations`
7. **neurosurgery_steven_rivera** → `operative_reports`, `neurology_consultations`
8. **oral_maxillofacial_surgery_wisdom_teeth** → `operative_reports`
9. **Operative Report** → `operative_reports`
10. **Orthopedic Surgery Post-Operative Report** → `orthopedic_consultations`, `orthopedic_operative_reports`
11. **plastic_surgery_susan_reed** → `operative_reports`
12. **thoracic_surgery_donald_cook** → `operative_reports`
13. **transplant_surgery_kidney_evaluation** → `operative_reports`, `transplant_evaluations`
14. **trauma_surgery_polytrauma_mva** → `operative_reports`

#### Cardiology (4 templates)
15. **Cardiology Acute Coronary Syndrome Admission** → `cardiology_admission_notes`, `cardiology_consultations`
16. **Cardiology Consultation** → `cardiology_consultations`
17. **cardiology_consultation_andrew_peterson** → `cardiology_consultations`
18. **Cardiology Follow-up Report** → `cardiology_followup_reports`

#### Emergency Medicine (4 templates)
19. **emergency_department_brandon_mitchell_hayes** → `emergency_discharge_summaries`, `emergency_reports`
20. **emergency_department_christopher_james_lee** → `emergency_discharge_summaries`, `emergency_reports`
21. **Emergency Department Discharge Summary** → `emergency_discharge_summaries`, `emergency_reports`
22. **emergency_medicine_report_thomas_roberts** → `emergency_discharge_summaries`, `emergency_reports`

#### Endocrinology (2 templates)
23. **Endocrinology Diabetes Management Visit** → `diabetes_management_notes`, `endocrinology_consultations`
24. **endocrinology_report_barbara_mitchell** → `endocrinology_consultations`

#### Neurology (2 templates)
25. **Neurology Clinic Progress Note** → `neurology_consultations`, `neuropsychological_assessments`
26. **neurosurgery_steven_rivera** → `neurology_consultations`

#### Nephrology (1 template)
27. **Nephrology Chronic Kidney Disease Consultation** → `nephrology_consultations`, `dialysis_records`

#### Pulmonology (3 templates)
28. **pulmonology_asthma_action_plan** → `pulmonology_consultations`, `pulmonary_function_tests`
29. **Pulmonology Asthma Management Consultation** → `pulmonology_consultations`
30. **Pulmonology Consultation Report** → `pulmonology_consultations`

#### Psychiatry (2 templates)
31. **Psychiatric Evaluation** → `psychiatric_evaluations`, `psychiatric_progress_notes`
32. **Psychiatric Evaluation and Treatment Plan** → `psychiatric_evaluations`

#### Pediatrics (2 templates)
33. **Pediatric Well-Child Examination** → `pediatric_visits`, `well_child_examinations`
34. **Pediatric Well-Child Visit** → `pediatric_visits`, `well_child_examinations`

#### OB/GYN (2 templates)
35. **Maternal-Fetal Medicine High-Risk Pregnancy Consultation** → `maternal_fetal_reports`
36. **Obstetric Prenatal Visit Note** → `prenatal_visits`, `obstetric_ultrasound_reports`

#### Hematology/Oncology (2 templates)
37. **hematology_nancy_ward** → `hematology_consultations`, `bone_marrow_reports`
38. **Hematology-Oncology New Diagnosis Consultation** → `hematology_consultations`, `oncology_consultations`

#### Other Specialties (18 templates)
39. **allergy_immunology_helen_cox** → `allergy_immunology_consultations`, `allergy_skin_testing`
40. **anesthesiology_preop_richard_phillips** → `anesthesia_records`, `pre_operative_assessments`
41. **critical_care_icu_septic_shock** → `icu_flow_sheets`
42. **dermatology_consultation_jessica_turner** → `dermatology_consultations`
43. **ent_consultation_charles_edwards** → `ent_consultations`
44. **family_medicine_matthew_stewart** → `consultation_notes`
45. **genetic_testing_brca_counseling** → `genetic_testing_reports`
46. **geriatric_primary_care_robert_henderson** → `geriatric_assessments`, `cognitive_evaluations`
47. **gynecology_annual_exam_pap_smear** → `gynecology_consultations`
48. **infectious_disease_paul_howard** → `microbiology_culture_reports`
49. **Internal Medicine Consultation Report** → `consultation_notes`
50. **ophthalmology_exam_catherine_evans** → `ophthalmology_examinations`
51. **palliative_care_hospice_consultation** → `advance_directives`
52. **pathology_report_george_parker** → `pathology_reports`, `biopsy_reports`
53. **pmr_evaluation_linda_morris** → `physical_therapy_evaluations`
54. **preventive_medicine_margaret_cooper** → `consultation_notes`
55. **radiology_report_patricia_campbell** → `imaging_reports`
56. **Rheumatology Consultation Report** → `rheumatology_consultations`
57. **sleep_medicine_polysomnography_sarah_anderson** → `sleep_study_reports`
58. **urology_consultation_dorothy_collins** → `urology_consultations`

#### General Documents (14 templates)
59. **2Hospital Discharge Summary** → `discharge_summaries`
60. **anticoagulation_management_afib_doac** → Generic consultation schema
61. **cardiac_rehabilitation_enrollment** → Generic consultation schema
62. **clinical_trial_enrollment_idh_inhibitor** → Generic consultation schema
63. **environmental_modifications_mold_remediation** → Generic consultation schema
64. **functional_status_karnofsky_assessment** → Generic consultation schema
65. **Gastroenterology Inflammatory Bowel Disease Consultation** → `gastroenterology_consultations`
66. **Geriatric Comprehensive Assessment** → Generic assessment schema
67. **interventional_radiology_liver_biopsy** → `interventional_radiology_notes`
68. **Medical Document - Emily Wilson** → Generic unified schema
69. **medical_genetics_brian_richardson** → `genetic_testing_reports`
70. **medication_access_patient_assistance** → Generic consultation schema
71. **Oncology Treatment Summary and Follow-up Plan** → `oncology_treatment_plans`
72. **pain_management_chronic_low_back_pain** → `pain_assessment_forms`

---

## ❌ Templates MISSING Extraction Schemas: 18 (20%)

These templates need specialized extraction schemas to be added:

### High Priority (Clinical Data)

#### 1. **addiction_medicine_opioid_use_disorder**
- **Why Missing:** No dedicated addiction medicine collection
- **Impact:** OUD treatment data, MAT protocols, COWS scores, relapse prevention plans
- **Recommended Action:** Create `addiction_medicine_consultations` collection
- **Fields Needed:**
  - Substance use history (type, duration, route, frequency)
  - Withdrawal symptoms and COWS/CIWA scores
  - Medication-Assisted Treatment (buprenorphine, methadone, naltrexone)
  - Relapse prevention planning
  - Social support and recovery programs
  - Harm reduction counseling

#### 2. **brain_tumor_molecular_idh_mgmt**
- **Why Missing:** Molecular profiling not in standard oncology schema
- **Impact:** IDH mutation status, MGMT methylation, treatment selection
- **Recommended Action:** Extend `oncology_consultations` to include molecular markers
- **Fields Needed:**
  - IDH1/IDH2 mutation status
  - MGMT promoter methylation status
  - 1p/19q codeletion status
  - Ki-67 proliferation index
  - Tumor molecular classification
  - Targeted therapy eligibility

#### 3. **biologic_therapy_dupilumab**
- **Why Missing:** Biologic therapy tracking not in standard medication schema
- **Impact:** Biologic administration, monitoring, side effects, insurance approval
- **Recommended Action:** Create `biologic_therapy_records` collection
- **Fields Needed:**
  - Biologic agent name and indication
  - Prior failed therapies
  - Baseline disease severity scores (EASI, IGA, etc.)
  - Administration schedule and route
  - Response assessment (% improvement)
  - Adverse events monitoring
  - Insurance authorization tracking

#### 4. **wound_care_diabetic_foot_ulcer**
- **Why Missing:** No wound care-specific collection
- **Impact:** Wound staging, measurements, healing progress, infection management
- **Recommended Action:** Create `wound_care_assessments` collection
- **Fields Needed:**
  - Wound location, size (length × width × depth)
  - Wagner grade or University of Texas classification
  - Wound bed characteristics (granulation, slough, necrotic tissue)
  - Exudate amount and type
  - Surrounding skin condition (erythema, maceration, callus)
  - Vascular assessment (pulses, ABI, TcPO2)
  - Infection signs and cultures
  - Debridement performed
  - Dressing regimen
  - Off-loading devices
  - Healing progress (% reduction in size)

#### 5. **podiatry_diabetic_foot_exam**
- **Why Missing:** No podiatry-specific collection
- **Impact:** Diabetic foot risk stratification, neuropathy assessment, amputation prevention
- **Recommended Action:** Create `podiatry_examinations` collection
- **Fields Needed:**
  - Monofilament test (10g)
  - Vibration sense (128 Hz tuning fork)
  - Ankle reflexes
  - Foot deformities (hammer toes, Charcot, bunions)
  - Skin condition (dry, fissures, calluses)
  - Nail condition (onychomycosis, ingrown)
  - Vascular assessment (pedal pulses, capillary refill)
  - Risk stratification (IWGDF 0-3)
  - Footwear assessment
  - Patient education provided

#### 6. **neuropsychological_testing_post_surgery**
- **Why Missing:** Detailed neuropsych testing not in standard neuro schema
- **Impact:** Cognitive domains (memory, attention, executive function), surgical outcomes
- **Recommended Action:** Extend `neuropsychological_assessments` with detailed test scores
- **Fields Needed:**
  - Test battery administered
  - Domain-specific scores (memory, attention, language, visuospatial, executive)
  - Percentile rankings
  - Comparison to normative data
  - Pre/post-operative comparison
  - Functional implications
  - Recommendations for cognitive rehabilitation

### Medium Priority (Specialized Testing)

#### 7. **advanced_imaging_fmri_dti_tractography**
- **Why Missing:** Advanced neuroimaging not in standard radiology schema
- **Impact:** Functional connectivity, white matter tracts, surgical planning
- **Recommended Action:** Extend `imaging_reports` with advanced neuro modalities
- **Fields Needed:**
  - fMRI activation maps (motor, language, memory)
  - Eloquent cortex localization
  - DTI tractography findings
  - Fiber tract integrity (FA, MD values)
  - Tumor-tract relationships
  - Surgical risk assessment
  - Navigation data exported

#### 8. **pulmonary_function_test_comprehensive**
- **Why Missing:** Full PFT parameters not extracted (only basic spirometry)
- **Impact:** Lung volumes, DLCO, bronchodilator response, flow-volume loops
- **Recommended Action:** Extend `pulmonary_function_tests` schema
- **Fields Needed:**
  - Complete spirometry (FEV1, FVC, FEV1/FVC, FEF25-75)
  - Lung volumes (TLC, RV, RV/TLC ratio)
  - DLCO (corrected for hemoglobin and alveolar volume)
  - Pre/post-bronchodilator values
  - Percent predicted for age/sex/height/ethnicity
  - Flow-volume loop patterns
  - Interpretation (obstructive/restrictive/mixed/normal)

#### 9. **nuclear_medicine_kenneth_rogers**
- **Why Missing:** Nuclear medicine studies not in standard radiology schema
- **Impact:** PET/CT, bone scans, thyroid scans, cardiac SPECT
- **Recommended Action:** Create `nuclear_medicine_studies` collection
- **Fields Needed:**
  - Study type (PET-CT, SPECT, planar)
  - Radiotracer used (FDG, Tc-99m, I-131, etc.)
  - Indication
  - Findings with SUV values (PET)
  - Areas of uptake/photopenia
  - Comparison to prior studies
  - Impression

#### 10. **implantable_cardiac_device_icd_evaluation**
- **Why Missing:** Device interrogation data not extracted
- **Impact:** ICD/pacemaker settings, arrhythmia detection, battery life
- **Recommended Action:** Create `cardiac_device_interrogations` collection
- **Fields Needed:**
  - Device type (ICD, CRT-D, pacemaker)
  - Manufacturer and model
  - Lead impedances
  - Battery voltage and longevity
  - Pacing parameters (mode, rate, thresholds)
  - Sensing parameters
  - Arrhythmia episodes detected
  - Therapies delivered (ATP, shocks)
  - Programming changes made

### Lower Priority (Administrative/Care Coordination)

#### 11. **barriers_to_care_housing_financial**
- **Why Missing:** Social determinants of health not systematically captured
- **Impact:** Housing insecurity, financial barriers, transportation, food insecurity
- **Recommended Action:** Create `social_determinants_of_health` collection
- **Fields Needed:**
  - Housing status (stable, unstable, homeless)
  - Food security (screening tool results)
  - Financial barriers to medications/care
  - Transportation access
  - Social support network
  - Referrals made (case management, social services)

#### 12. **discharge_planning_post_cardiac_surgery**
- **Why Missing:** Detailed discharge planning not in standard discharge summary
- **Impact:** Post-discharge care coordination, DME orders, home health
- **Recommended Action:** Extend `discharge_summaries` with planning details
- **Fields Needed:**
  - DME ordered (oxygen, walker, shower chair, etc.)
  - Home health services arranged
  - Cardiac rehab referral
  - Dietary restrictions
  - Activity restrictions and timeline
  - Wound care instructions
  - Follow-up appointments scheduled
  - Patient understanding documented

#### 13. **medication_access_patient_assistance**
- **Why Missing:** Medication access programs not tracked
- **Impact:** Patient assistance programs, copay cards, pharmacy navigation
- **Recommended Action:** Create `medication_access_programs` collection
- **Fields Needed:**
  - Medication requiring assistance
  - Program enrolled (manufacturer PAP, foundation, etc.)
  - Application status
  - Approval/denial and reason
  - Coverage amount and duration
  - Renewal date
  - Pharmacy coordination notes

#### 14. **cardiac_biomarker_troponin_trending**
- **Why Missing:** Serial biomarker trending not captured
- **Impact:** Troponin trends in ACS, NT-proBNP trends in HF
- **Recommended Action:** Extend `lab_results` with trending analysis
- **Fields Needed:**
  - Biomarker type
  - Serial values with timestamps
  - Peak value
  - Trend direction (rising/falling/plateau)
  - Time to peak
  - Clinical significance (e.g., "Troponin trending down, consistent with resolved MI")

#### 15. **cardiac_catheterization_stemi_protocol**
- **Why Missing:** STEMI-specific metrics not in standard cath report
- **Impact:** Door-to-balloon time, TIMI flow, myocardial blush grade
- **Recommended Action:** Extend `cardiac_catheterization_reports` with STEMI metrics
- **Fields Needed:**
  - Door-to-balloon time
  - Symptom-to-balloon time
  - Pre-PCI TIMI flow
  - Post-PCI TIMI flow
  - Myocardial blush grade
  - Thrombus aspiration performed
  - Stent type and size
  - IABP/Impella used

#### 16. **clinical_risk_scores_comprehensive**
- **Why Missing:** Clinical risk scores scattered across schemas
- **Impact:** CHA2DS2-VASc, HAS-BLED, HEART score, GRACE score, STOP-BANG
- **Recommended Action:** Create `clinical_risk_scores` collection
- **Fields Needed:**
  - Score name
  - Individual components with points
  - Total score
  - Risk category (low/moderate/high)
  - Clinical interpretation
  - Treatment implications

#### 17. **quality_metrics_door_to_balloon_time**
- **Why Missing:** Quality metrics not systematically extracted
- **Impact:** Core measures, bundle compliance, performance tracking
- **Recommended Action:** Create `quality_metrics` collection
- **Fields Needed:**
  - Metric name (door-to-balloon, sepsis bundle, VTE prophylaxis, etc.)
  - Target value
  - Actual value
  - Met/not met
  - Barriers if not met
  - Improvement opportunities

#### 18. **sports_physical_examination**
- **Why Missing:** Sports medicine exams not in standard physical exam schema
- **Impact:** Preparticipation screening, cardiac risk assessment, MSK evaluation
- **Recommended Action:** Create `sports_medicine_evaluations` collection
- **Fields Needed:**
  - Sport(s) and level (recreational, competitive, professional)
  - Cardiac screening (family history, symptoms, ECG if performed)
  - Musculoskeletal exam by joint
  - Prior injuries and rehabilitation status
  - Concussion history
  - Clearance status (full, restricted, withheld)
  - Restrictions or recommendations

#### 19. **occupational_medicine_work_injury**
- **Why Missing:** Occupational medicine not captured
- **Impact:** Work-related injuries, return-to-work plans, disability assessments
- **Recommended Action:** Create `occupational_medicine_evaluations` collection
- **Fields Needed:**
  - Employer and occupation
  - Injury mechanism and date
  - Body parts affected
  - Work status (full duty, modified duty, off work)
  - Restrictions (lifting, standing, bending, etc.)
  - Return-to-work plan
  - Workers' compensation case number
  - Disability rating if applicable

---

## Implementation Priority Matrix

### Phase 1: Critical Clinical Data (Do First) - 6 schemas
High clinical impact, frequently used, rich data:
1. `addiction_medicine_consultations` - OUD treatment tracking
2. `brain_tumor_molecular_markers` - Precision oncology
3. `biologic_therapy_records` - Specialty medication management
4. `wound_care_assessments` - Diabetic limb salvage
5. `podiatry_examinations` - Diabetic foot screening
6. Extend `neuropsychological_assessments` - Detailed cognitive testing

### Phase 2: Specialized Testing (Do Second) - 4 schemas
Moderate clinical impact, specialized use cases:
7. Extend `imaging_reports` with advanced neuro (fMRI, DTI)
8. Extend `pulmonary_function_tests` - Full PFT parameters
9. `nuclear_medicine_studies` - PET/SPECT imaging
10. `cardiac_device_interrogations` - ICD/pacemaker data

### Phase 3: Care Coordination (Do Third) - 5 schemas
Important for care quality, lower clinical urgency:
11. `social_determinants_of_health` - SDOH barriers
12. Extend `discharge_summaries` - Discharge planning details
13. `medication_access_programs` - Patient assistance tracking
14. Extend `lab_results` - Biomarker trending
15. Extend `cardiac_catheterization_reports` - STEMI metrics

### Phase 4: Administrative/Quality (Do Last) - 3 schemas
Quality improvement, reporting, niche use cases:
16. `clinical_risk_scores` - Centralized risk scoring
17. `quality_metrics` - Performance tracking
18. `sports_medicine_evaluations` - Sports physicals
19. `occupational_medicine_evaluations` - Work injury tracking

---

## How to Add Missing Schemas

For each missing template, follow the **6-step Medical Data Extraction Checklist**:

### Step 1: Define Schema in `claudeBatchProcessor.js` (lines 1700-9100)

Add extraction function to `getDocumentAnalysisTools()`:

```javascript
{
  name: "saveAddictionMedicineData",
  description: "Extract addiction medicine consultation data including OUD treatment",
  input_schema: {
    type: "object",
    properties: {
      substanceUseHistory: {
        type: "array",
        items: {
          type: "object",
          properties: {
            substance: { type: "string" },
            duration: { type: "string" },
            route: { type: "string" },
            frequency: { type: "string" },
            lastUse: { type: "string" }
          }
        }
      },
      withdrawalSymptoms: { type: "string" },
      cowsScore: { type: "number" },
      medicationAssistedTreatment: {
        type: "object",
        properties: {
          medication: { type: "string" },
          dose: { type: "string" },
          frequency: { type: "string" },
          startDate: { type: "string" }
        }
      },
      // ... more fields
    }
  }
}
```

### Step 2: Add Collection Schema in `collectionSchemas.js`

```javascript
addiction_medicine_consultations: {
  fields: {
    substanceUseHistory: { type: 'array', required: true },
    withdrawalSymptoms: { type: 'string' },
    cowsScore: { type: 'number' },
    medicationAssistedTreatment: { type: 'object' },
    // ... more fields
  }
}
```

### Step 3: Add Handler (if needed) in `medicalFieldMappingService.js`

Only if custom logic needed (e.g., risk scoring, date calculations):

```javascript
// In saveComprehensiveData() function
if (extractedData.addiction_medicine_consultations) {
  // Custom processing logic here
}
```

### Step 4: Register in `medicalCollectionsService.js`

Add to `allCollections` array:

```javascript
'addiction_medicine_consultations'
```

### Step 5: Exclude Universal Fields (if applicable)

In `collectionSchemas.js:17`, add to `universalFieldsToExclude` if this collection should NOT receive universal fields like medications, diagnoses, etc.

### Step 6: Add to Required Array (AI-generated fields only)

In `claudeBatchProcessor.js:14789`, add to `REQUIRED_FUNCTIONS_FOR_DOCUMENT` if this collection contains AI-generated recommendations (not just extracted data):

```javascript
'intelligent_recommendations',
'clinical_decision_support',
'follow_up_intelligence',
// Do NOT add addiction_medicine_consultations - it's extracted data
```

---

## Testing After Adding Schema

1. **Add PDF to test directory:**
   ```bash
   cp "/home/erangross/Documents/English medical termplates/addiction_medicine_opioid_use_disorder.pdf" \
      apps/backend-api/sample-medical-records/
   ```

2. **Run extraction test:**
   ```bash
   cd apps/backend-api
   node scripts/verifyDataExtractionAutoWithCache.js --no-cache
   ```

3. **Verify data in MongoDB:**
   ```bash
   MONGO_URI=$(cat .kms/MONGODB_ADMIN_URI)
   mongosh "$MONGO_URI" --quiet --eval "
     db = db.getSiblingDB('intellicare_practice_yale');
     printjson(db.addiction_medicine_consultations.findOne());
   "
   ```

4. **Check unified document:**
   ```bash
   mongosh "$MONGO_URI" --quiet --eval "
     db = db.getSiblingDB('intellicare_practice_yale');
     const doc = db.unified_medical_documents.findOne(
       {},
       {addictionMedicine: 1}
     );
     printjson(doc.addictionMedicine);
   "
   ```

---

## Conclusion

**Current Status:** 80% of your medical templates have extraction schemas
**Action Required:** Add 18 specialized schemas for remaining 20% of templates
**Estimated Effort:** 1-2 weeks (4 phases × 2-3 days each)

**Next Steps:**
1. Review this analysis with clinical team
2. Prioritize based on clinical workflow needs
3. Implement Phase 1 schemas (critical clinical data)
4. Test with sample PDFs
5. Deploy and monitor data quality
6. Iterate to Phase 2-4

---

## Quick Reference: Schema Locations

- **Extraction Schemas:** `apps/backend-api/services/claudeBatchProcessor.js` (lines 1700-9100)
- **Collection Schemas:** `apps/backend-api/services/models/collectionSchemas.js`
- **Collection Registry:** `apps/backend-api/services/medicalCollectionsService.js`
- **Field Mapping Handlers:** `apps/backend-api/services/medicalFieldMappingService.js` (lines 100-400)
- **Required Functions Array:** `apps/backend-api/services/claudeBatchProcessor.js` (line 14789)
- **Universal Fields Exclude:** `apps/backend-api/services/models/collectionSchemas.js` (line 17)
