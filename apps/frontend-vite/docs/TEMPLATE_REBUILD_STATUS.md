# Template Rebuild Status - December 2025 Patterns

**Last Updated:** 2025-12-24
**Purpose:** Track which templates have been rebuilt to December 2025 standards

---

## Quick Verification Checklist (5 Points)

Before rebuilding any template, check if it's already compliant:

1. [ ] Comment says "December 2025" at top of file?
2. [ ] Uses `({ document, data })` + `templateData = document || data` pattern?
3. [ ] Has own `useState('')` for searchTerm (not prop)?
4. [ ] Uses `PDFDownloadLink` import (not `onExportPDF` prop)?
5. [ ] CSS has `.copied { background: #2563eb }` (blue, not green)?

**If all 5 pass** → Template is December 2025 compliant, **no rebuild needed**.

---

## Completed Templates (December 2025 Compliant)

| # | Collection Name | Template File | Rebuild Date | Notes |
|---|-----------------|---------------|--------------|-------|
| 1 | `medications` | MedicationsDocument.jsx | 2025-12-21 | Verified compliant |
| 2 | `lab_results` | LabResultsDocument.jsx | 2025-12-21 | - |
| 3 | `diagnoses` | DiagnosesDocument.jsx | 2025-12-21 | - |
| 4 | `imaging_reports` | ImagingReportsDocument.jsx | 2025-12-21 | - |
| 5 | `medical_procedures` | MedicalProceduresDocument.jsx | 2025-12-21 | - |
| 6 | `prescriptions` | PrescriptionsDocument.jsx | 2025-12-21 | - |
| 7 | `vital_signs` | VitalSignsDocument.jsx | 2025-12-21 | - |
| 8 | `hospital_discharge_summaries` | HospitalDischargeSummariesDocument.jsx | 2025-12-21 | - |
| 9 | `hospital_course` | HospitalCourseDocument.jsx | 2025-12-21 | - |
| 10 | `arterial_blood_gases` | ArterialBloodGasesDocument.jsx | 2025-12-21 | - |
| 11 | `cardiology_consultations` | CardiologyConsultationsDocument.jsx | 2025-12-21 | - |
| 12 | `echo_reports` | EchoReportsDocument.jsx | 2025-12-21 | - |
| 13 | `chronic_disease_management` | ChronicDiseaseManagementDocument.jsx | 2025-12-21 | - |
| 14 | `copd_assessments` | CopdAssessmentsDocument.jsx | 2025-12-21 | - |
| 15 | `pulmonology_consultations` | PulmonologyConsultationsDocument.jsx | 2025-12-21 | - |
| 16 | `administrative_data` | AdministrativeDataDocument.jsx | 2025-12-21 | - |
| 17 | `patient_education_records` | PatientEducationRecordsDocument.jsx | 2025-12-21 | - |
| 18 | `social_history` | SocialHistoryDocument.jsx | 2025-12-21 | - |
| 19 | `chief_complaints` | ChiefComplaintsDocument.jsx | 2025-12-21 | - |
| 20 | `history_present_illness` | HistoryPresentIllnessDocument.jsx | 2025-12-21 | - |
| 21 | `assessment_plans` | AssessmentPlansDocument.jsx | 2025-12-21 | - |
| 22 | `follow_up_appointments` | FollowUpAppointmentsDocument.jsx | 2025-12-21 | - |
| 23 | `diabetes_management` | DiabetesManagementDocument.jsx | 2025-12-21 | - |
| 24 | `discharge_planning` | DischargePlanningDocument.jsx | 2025-12-21 | - |
| 25 | `patient_provider` | PatientProviderDocument.jsx | 2025-12-21 | - |
| 26 | `lifestyle_counseling` | LifestyleCounselingDocument.jsx | 2025-12-21 | - |
| 27 | `patient_instructions` | PatientInstructionsDocument.jsx | 2025-12-21 | - |
| 28 | `allergies` | AllergiesDocument.jsx | 2025-12-21 | Individual sections (Allergy 1/2/3), colored severity badges, rec-mini-card fields |
| 29 | `consultation_notes` | ConsultationNotesDocument.jsx | 2025-12-22 | Fixed search filtering, improved copy/PDF formatting with numbered items |
| 30 | `medication_recommendations` | MedicationRecommendationsDocument.jsx | 2025-12-22 | 8 sections, splitBySentence for admin instructions, blue theme |
| 31 | `addiction_medicine_consultations` | AddictionMedicineConsultationsDocument.jsx | 2025-12-22 | 12 sections, COWS bar chart visualization, searchable symptoms, nested subtitles, PDF wrap={false} for chart |
| 32 | `case_management` | CaseManagementDocument.jsx | 2025-12-22 | 6 sections, urgency badges (right-aligned in nested-subtitle), services/barriers arrays, splitBySentence for Findings, parseFindingsWithLabels + groupRecommendationsByParent for Recommendations (parent-child visual grouping with purple outer container, blue inner cards), PDFDownloadLink, no bar chart |
| 33 | `hepatitis_c_management` | HepatitisCManagementDocument.jsx | 2025-12-22 | 10 sections, splitBySentence for text fields, 4-level search with section title bypass (searching section title shows all content within) |
| 34 | `hepatitis_c_history` | HepatitisCHistoryDocument.jsx | 2025-12-22 | 8 sections (Record Info, HCV Details, Liver Assessment, Treatment History, Findings, Assessment, Plan, Notes), 4-level search with section title bypass, splitBySentence for text fields |
| 35 | `mental_health_assessments` | MentalHealthAssessmentsDocument.jsx | 2025-12-22 | 10 sections, Provisional Diagnosis split by semicolon, Functioning Level split by comma (preserves parens), risk badges right-aligned, PHQ-9/GAD-7 searchable, PDF fonts increased (14pt min), bar chart visualization |
| 36 | `psychiatric_evaluations` | PsychiatricEvaluationsDocument.jsx | 2025-12-22 | 10 sections (Record Info, Chief Complaint, HPI, Psychiatric History with suicideAttempts 3-level nesting, Substance Use History, MSE 11 fields, Risk Assessment with badges, Diagnosis, Treatment Plan, Current Medications), risk badges right-aligned, splitBySentence for HPI, Date/Method field labels searchable in Suicide Attempts, 'Risk' word removed from parent match (bidirectional too broad), PDF black/white with wrap={false} on all sections |
| 37 | `depression_screening` | DepressionScreeningDocument.jsx | 2025-12-22 | 4 sections (Assessment Scores with 9 bar charts, Clinical Assessment 6 fields, Current Symptoms 6 fields, History & Comorbidities 4 fields), comprehensive 4-level search with exact displayed labels (e.g., "Anxiety Symptom Severity", "Energy / Fatigue Level"), section-title-only matching for showing all rows, individual field filtering, severity badges, PHQ-9/PHQ-2/GAD-7/Beck/Hamilton/Montgomery-Asberg/Edinburgh/Geriatric/Columbia score visualizations, PDF black/white |
| 38 | `surgical_history` | SurgicalHistoryDocument.jsx | 2025-12-22 | 4 sections (Record Info, Procedure Details, Outcomes, Notes), splitBySentence for notes, 4-level search with section-title-only matching (searching "Record Info" shows ALL rows in section), procedure badge in header-top-row next to date, PDF black/white with Helvetica 14pt |
| 39 | `family_history` | FamilyHistoryDocument.jsx | 2025-12-22 | 4 sections (Record Info, Immediate Family, Medical Conditions by Category, Additional Information), 11 condition arrays via conditionFieldsConfig, 3-level nested cards with parseFamilyMember() for "Member: Condition" patterns, subsection-title-only matching (searching "Maternal History" shows ALL children), boolean badges for consanguinity/pedigreeAvailable, PDF black/white with Helvetica 14pt |
| 40 | `review_of_systems` | ReviewOfSystemsDocument.jsx | 2025-12-22 | 15 body system sections (Constitutional through Sleep Symptoms), genitourinary/psychiatric as object fields, PHQ-9/GAD-7 bar chart visualizations with severity badges, parseNotesWithLabels for embedded labels, splitByCommaIgnoreParentheses, 4-level search with section-title-only matching, PDF black/white with Helvetica 14pt |
| 41 | `physical_examinations` | PhysicalExaminationsDocument.jsx | 2025-12-22 | 14 sections (Vital Signs bar chart, Clinical Scales with BMI/GCS/Pain/NYHA, Cardiovascular/Pulmonary/Abdominal/Neurological/Mental Status/Skin/Musculoskeletal/Lymph Node/HEENT/Edema/Nutritional/Peripheral Pulses examinations, General Appearance, Notes), parseVitalSigns() for BP/HR/SpO2/RR/Temp with all labels/values/interpretations/references searchable, parseEmbeddedLabels() for neuro/MSE/HEENT, Additional Findings field labels (Edema/Nutritional Status/Peripheral Pulses) searchable, 4-level search with section-title-only matching, PDF black/white with grayscale bar chart |
| 42 | `risk_factors` | RiskFactorsDocument.jsx | 2025-12-22 | 7 sections (Risk Factor Details with factor/category/severity/status/date/provider/facility, Findings with parseFindingsWithLabel, Assessment, Plan, Recommendations grouped by date with nested-subtitle headers, Results object fields, Notes), severity badges (HIGH=red/MEDIUM=yellow/LOW=green), 4-level search with section-title-only matching including "Risk Factor Details" in searchableText, recommendations array grouped by date, PDF black/white with Helvetica 14pt and correct wrap={false} pattern (small sections keep title+content together, large sections group title+first item) |
| 43 | `pain_management_plan` | PainManagementPlanDocument.jsx | 2025-12-22 | 10 sections (Record Info, Current Analgesics array, Consultations with parseItemWithLabel for "Label: item1, item2" → nested-subtitle + comma-split rows, Supportive Devices/Therapies with standalone items + rec-mini-card, Interventional Procedures array, Radiation Therapy, Findings/Assessment/Plan with splitBySentence, Recommendations array, Notes with parseNotesWithLabels for "Avoid:" embedded labels), 4-level search with section-title-only matching, PDF black/white with Helvetica 14pt |
| 44 | `prognosis` | PrognosisDocument.jsx | 2025-12-22 | 10 sections (Record Info, Short-Term Prognosis, Long-Term Prognosis, Risk Factors array with red badges, Protective Factors array with green badges, Motivation Factors with parseNumberedItems for "(1) text (2) text" patterns, Previous Treatment Response with parseChildLabels, Insight Level, Assessment with parseChildLabels, Notes with parseNotesWithLabels for "Factors Favoring/Against Success:" embedded labels), hierarchical parent/child label parsing, smart comma splitting (only lists not sentences), 4-level search with section-title-only matching (searching parent label shows only that parent with children), copy formatting with splitIntoSentences for long text, PDF black/white with Helvetica 14pt |
| 45 | `pain_management` | PainManagementDocument.jsx | 2025-12-22 | 10 sections (Record Info, Pain Details with bar chart visualization, Pain Modifiers, Functional Impact, Treatment History, Current Treatment with OME, Procedures & Imaging, Monitoring, Psychological Assessment with PHQ-9/GAD-7 parsing, Follow-Up & Referrals), pain intensity bar chart with color coding (green/yellow/red), parsePsychologicalScreening() for embedded labels, 4-level search with section-title-only matching, Copy Section buttons on ALL subsections, PDF black/white with Helvetica 14pt |
| 46 | `psychiatric_history` | PsychiatricHistoryDocument.jsx | 2025-12-23 | 12 sections (Record Info, Previous Episodes 3-level nesting, Hospitalizations, Suicide Attempts 3-level nesting with hospitalization badges, Substance Abuse nested object, Previous Psychotherapy, Family Psychiatric History 3-level nesting, Findings, Assessment, Plan, Recommendations, Notes), parseNestedLabel() for "Label: comma-items" patterns (Outcome, Assessment, Withdrawal), 4-level search with dynamic subtitle matching ("Attempt 1", "Episode 1", "Family Member 1" searchable via dynamicTitleMatch in IIFEs), status badges for hospitalization/substance status, PDF black/white only (#000000, #666666) for print-friendly output |
| 47 | `psychiatric_treatment_plan` | PsychiatricTreatmentPlanDocument.jsx | 2025-12-24 | 10 sections (Plan Information, Diagnoses 3-level nesting with ICD Code/Specifiers, Assessment, Pharmacological Interventions 3-level nesting with Rationale/Monitoring, Psychotherapy with Type/Frequency/Goals, Support Groups, Lifestyle Modifications, Safety Plan with 5 subsections, Follow-Up Plan, Plan, Notes), 4-level search with field-specific filtering (showAll pattern replaces sectionMatches to prevent unrelated fields showing), PDF black/white with Helvetica 14pt |
| 48 | `psychotropic_medications` | PsychotropicMedicationsDocument.jsx | 2025-12-24 | 11 sections (Medication Information, Prescription Details, Indication, Instructions, Current Medications, Past Medications, Medication Changes 3-level nesting with action/medication/dose/reason, Side Effects, Drug Interactions, Allergies & Adverse Reactions, Safety Warning), 4-level search with IIFE sectionTitleMatches pattern on ALL sections, field-specific filtering for Medication Changes (action shows medication, but not dose/reason), PDF black/white with Helvetica 14pt |
| 49 | `substance_use_assessment` | SubstanceUseAssessmentDocument.jsx | 2025-12-24 | 10 sections (Record Info, Current Substance Use 3-level nesting with substance/frequency/amount/lastUse/route, Past Substance Use 3-level nesting with substance/ageStarted/duration, Withdrawal Symptoms array, Treatment History 3-level nesting with type/facility/dates/outcome, Screening with DUID/CAGE badges, Findings, Assessment, Plan, Notes), 4-level search with IIFE sectionTitleMatches pattern, splitBySentence for text fields, status badges for DUID/CAGE, PDF black/white with Helvetica 14pt, PDF Pattern 2 (Title + First Item Together) for all variable-length sections |
| 50 | `suicide_risk_assessment` | SuicideRiskAssessmentDocument.jsx | 2025-12-24 | 11 sections (Record Info, Risk Level badge, Ideation object with current/passive/active/frequency/duration, Plan object with hasPlan/method/means/timeline, Intent, History with previousAttempts/psychiatricHospitalizations, Risk Factors array with red accent, Protective Factors array with green accent, Interventions array, Columbia Scale, Assessment with parseFindingsWithLabels for embedded "Suicide Risk:" labels with inline orange badge, Notes), boolean badges for ideation.passive/active/plan.hasPlan/previousAttempts, Risk Level colored badge (low=green/moderate=orange/high=red/acute=dark red) in header-top-row next to date, Assessment section extracts risk level as inline badge on nested-subtitle row, 4-level search with IIFE sectionTitleMatches pattern, PDF black/white with Helvetica 14pt |
| 51 | `follow_up_plan` | FollowUpPlanDocument.jsx | 2025-12-24 | 10 sections (Record Info, Follow-Up Schedule with parseItemWithLabel for "Week 1:" embedded labels, Follow-Up Reasons comma-split, Monitoring Parameters array, Medication Changes with parseItemWithLabel, Required Tests & Studies with labs/imaging subsections, Referrals & Services with referrals/home health subsections, Symptom Red Flags array with red accent, Patient Education array, Compliance Barriers array with orange accent), 4-level search with IIFE sectionTitleMatches pattern on ALL sections, subsection-level filtering (search "Lab Tests" hides Imaging, search "Specialty Referrals" hides Home Health), special section styling for red flags and barriers, PDF black/white with Helvetica 14pt and Pattern 2 wrap strategy |
| 52 | `treatment_plans` | TreatmentPlansDocument.jsx | 2025-12-24 | 6 sections (Record Info, Short-Term Goals, Long-Term Goals, Immediate Interventions object with Buprenorphine Induction/Adjunct Medications/Naloxone nested fields, Pending Procedures, Rehabilitation Referrals), parseDayLabels() for "Day 1:/Day 2:/Day 3:" patterns in buprenorphine induction, subsection Copy Section buttons on all nested fields within Immediate Interventions, 4-level search with IIFE sectionTitleMatches pattern, addiction medicine treatment plan data structure, PDF black/white with Helvetica 14pt and Pattern 2 wrap strategy |
| 53 | `medical_history` | MedicalHistoryDocument.jsx | 2025-12-24 | 14 sections (Provider Information with rec-mini-cards for Provider/Facility, Chief Complaint, Chronic Conditions, Past Medical History, Past Surgeries, Allergies, Current Medications, Family History, Social History object with 6 sub-fields as rec-mini-cards, Hospitalizations with parseHospitalization() for Year:Event nested-subtitle pattern, Mental Health History, Functional Status, Blood Type, Immunization History), complete 4-level search with IIFE sectionTitleMatches pattern on ALL 11 array/object sections (searching section title shows ALL items), showAll OR logic for proper section-title-bypass, PDF black/white with Helvetica 14pt |
| 54 | `operative_report_details` | OperativeReportDetailsDocument.jsx | 2025-12-24 | 7 sections (Procedure Information, Diagnosis, Procedure Details with parseWithLabel for "Label: comma-items" patterns, Findings with parseWithLabel, Complications, Blood Loss & Specimens, Notes with parseWithLabel), stripLeadingNumber() for JSX display (numbers in Copy/PDF only), 4-level search with subsection-level filtering (search "Posterior margin" shows ONLY that subsection, hides siblings like "Safe Resection Boundaries"), all standalone rows wrapped in rec-mini-card for consistent styling, PDF black/white with Pattern 2 wrap={false} (title + first item together, rest flows naturally) |
| 55 | `pre_operative_assessments` | PreOperativeAssessmentsDocument.jsx | 2025-12-24 | 12 sections (Assessment Information, Score Overview bar chart, Medical History, Surgical History, Current Medications, Allergies, Pre-Op Testing, Risk Stratification, Renal/Hepatic Function, Coagulation Status, Anesthesia/NPO/Clearance, Special Considerations, Recommendations with nested-subtitle for "Label: Value" patterns), splitByCommaIgnoreParentheses() for preserving parenthetical content (e.g., "Structural MRI (T1 MPRAGE, T2 FLAIR)"), splitByPeriod for Special Considerations with numbering in Copy All and PDF, 4-level search with phrase matching (not word matching), all 12 section titles in searchableText with 3 case variations, bar chart visualization for ASA/Goldman/RCRI scores |
| 56 | `surgical_consent_forms` | SurgicalConsentFormsDocument.jsx | 2025-12-24 | 14 sections (Consent Information, Planned Procedure, Indication, Risks Discussed, Benefits Discussed, Alternatives Discussed, Specific Risks with parseEmbeddedLabels for CRITICAL/WARNING/CAUTION/NOTE/HIGH RISK/NO-GO/IMPORTANT/ALERT patterns, Anesthesia Risks, Blood Transfusion, Patient Questions, Patient Understanding, Consent Process, Signatures, Recommendations grouped by date), parseEmbeddedLabels() splits content by labels and then by sentences for granular display, 4-level search with section-title-only matching (searching "Specific Risks" or "Recommendations" shows all rows), PDF groups recommendations by date, PDF template in templates folder with lazy loading |
| 57 | `intraoperative_monitoring` | IntraoperativeMonitoringDocument.jsx | 2025-12-24 | 7 sections (Procedure Information, Timing with Date field, Neuromonitoring Modalities array, Anesthesia Management with anestheticAgents array, Fluid/Blood Management with EBL/transfusion, Medications with analgesicRegimen/antiemetics/reversalAgents subsections, Adverse Events array), 4-level search with IIFE sectionTitleMatches pattern on ALL sections (searching "Timing" or "Fluid / Blood Management" shows all rows), Date row added to Timing section for proper display when other timing fields empty, PDF black/white with Helvetica 14pt |
| 58 | `functional_mri_studies` | FunctionalMriStudiesDocument.jsx | 2025-12-24 | 5 sections (Report Information, Clinical Indication with splitBySentence, Findings with parseFindingsWithLabels for Motor Cortex Mapping/Language Mapping - Expressive/Language Mapping - Receptive embedded labels, Follow Up, Recommendations with splitBySentence), splitByCommaIgnoreParentheses for grouped items, **4-level search fix**: sectionTitleMatches only checks "Findings" (not subtitles), groupLabelMatches checks nested subtitles separately, showAllGroupItems pattern for proper subtitle-level filtering, per-record Copy All removed (header only), PDF black/white with Helvetica 14pt |
| 59 | `neuro_imaging` | NeuroImagingDocument.jsx | 2025-12-24 | 9 sections (Study Information, Indication, Technique, Contrast, Findings with parseFindingsWithLabels for Motor cortex/Language/Corticospinal tract/Arcuate fasciculus/SLF/Corpus callosum embedded labels, Impression, Comparison, Recommendations, Notes with parseNotesWithLabels for Intraoperative real-time overlay/Limitations labels), complete December 2025 rebuild with 4-level search, PDFDownloadLink, per-record Copy All removed (header only), PDF black/white with Helvetica 14pt |

---

## Pending Templates (Need Rebuild)

*All templates have been rebuilt to December 2025 standards!*

| # | Collection Name | Category | Status |
|---|-----------------|----------|--------|
| - | - | - | All Complete |

---

## Workflow

1. **When checking a new patient:** Compare their collections against the "Completed" list above
2. **For any collection NOT in the list:** Add to "Pending" section
3. **User will request rebuilds one by one** - do NOT batch rebuild
4. **After each rebuild:** Move from Pending to Completed, update date

---

## December 2025 Pattern Requirements

### JSX Template
- Component signature: `({ document, data })`
- First line: `const templateData = document || data;`
- Own `useState('')` for searchTerm
- `PDFDownloadLink` import from `@react-pdf/renderer`
- Header: 3 rows (Title, Actions, Search)
- Mini-card pattern: `mini-cards-container` → `rec-mini-card` → `nested-subtitle` → `numbered-row`
- Section-header INSIDE `mini-cards-container`
- 4-level search with IIFE pattern
- No row numbers in JSX display (only in copy/PDF)

### CSS
- Font hierarchy: section-title 19px > nested-subtitle 17px > content-value 16px
- `.copied` state: `background: #2563eb` (solid blue, NOT green)
- `numbered-row` background: `#0d1929`
- `nested-subtitle` color: `#93c5fd`

### PDF Template
- Helvetica font only
- 14pt minimum body text
- Black and white only (#000000, #666666, #ffffff)
- `safeString()` for Unicode handling

---

## Statistics

- **Total Completed:** 59
- **Total Pending:** 0
- **Last Patient Checked:** Tiffany Young (68f7ba1eb32620f225572723)
- **Project Completed:** 2025-12-24
