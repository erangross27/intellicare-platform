/**
 * Generator for Medical Category Functions with Schema Introspection
 * Creates individual functions for all 758 medical document categories
 *
 * UPDATED November 2025: Now uses unifiedMedicalSchemas.js as single source of truth
 * Uses getAgentSchema() to get only agent-visible fields for CRUD tool schemas
 */

const fs = require('fs').promises;
const path = require('path');

// UPDATED: Import unified schema system instead of collectionSchemas
const unifiedSchemas = require('../services/unifiedMedicalSchemas');

// All 800 categories (720 original + 80 new added December 2025)
const categories = [
  'abnormal_results',
  'access_planning',
  'acmg_guidelines_reference',
  'acute_kidney_injury',
  'addiction_medicine_consultations',
  'adhd_assessment',
  'administrative_data',
  'admission_assessments',
  'admission_decisions',
  'admission_recommendations',
  'adult_day_program_info',
  'advance_care_planning',
  'advance_directive_discussion',
  'advance_directives',
  'geriatric_care_planning',
  'goals_of_care_discussions',
  'allergies',
  'allergies_assessments',
  'allergy_assessments',
  'allergy_immunology_assessment',
  'allergy_skin_testing',
  'amniocentesis_reports',
  'amniotic_fluid_assessment',
  'amniotic_fluid_index_current',
  'anatomy_scan_result',
  'anesthesia_records',
  'anesthesiology_assessment',
  'antibiogram_reports',
  'anticipatory_guidance',
  'anticoagulation_management',
  'apgar_scores',
  'appetite_stimulants',
  'appointments',
  'arterial_blood_gases',
  'arthritis_assessments',
  'articular_cartilage',
  'assessment_plans',
  'assistive_devices',
  'asthma_action_plan',
  'asthma_assessments',
  'asthma_management_notes',
  'athlete_specific_data',
  'audiometry_reports',
  'autoantibody_profile',
  'autoimmune_evaluations',
  'autoimmune_panels',
  'autopsy_reports',
  'barriers_psychosocial_issues',
  'basal_rate_adjustments',
  'behavioral_assessment',
  'biologic_therapy',
  'biologic_therapy_records',
  'biopsy_reports',
  'biopsychosocial_formulation',
  'birth_history',
  'birth_plan',
  'blood_disorder_reports',
  'blood_glucose_logs',
  'blood_glucose_monitoring',
  'blood_pressure_readings',
  'blood_products',
  'blood_products_ordered',
  'blood_sample_collection_status',
  'blood_smears',
  'bolus_adjustments',
  'bone_health',
  'bone_marrow_reports',
  'bone_marrow_studies',
  'bone_scan_reports',
  'brain_tumor_characteristics',
  'brain_tumor_molecular_markers',
  'breastfeeding_recommendation',
  'cam_icu',
  'cancer_diagnosis',
  'cancer_related_side_effects',
  'cancer_staging',
  'cancer_surveillance',
  'carbohydrate_counting_education',
  'cardiac_catheterization_reports',
  'cardiac_device_interrogations',
  'cardiac_monitoring',
  'cardiac_rehabilitation_reports',
  'cardiology_admission_notes',
  'cardiology_assessment',
  'cardiology_consultations',
  'cardiology_followup_reports',
  'cardiovascular_risk_reduction',
  'care_coordination',
  'care_coordination_notes',
  'care_gaps',
  'care_team',
  'care_team_info',
  'caregiver_assessment',
  'caregiver_support',
  'caregiver_support_groups',
  'cascade_testing_protocol',
  'case_management',
  'case_summaries',
  'cell_free_dna_result',
  'cervical_assessment',
  'cervical_length_measurement',
  'cesarean_threshold',
  'cgm_data',
  'challenge_tests',
  'chemotherapy_records',
  'chemotherapy_regimen',
  'chief_complaints',
  'children_specific_risk',
  'chronic_disease_management',
  'ckd_assessment',
  'ckd_management',
  'clinical_decision_support',
  'clinical_risk_scores',
  'clinical_scores',
  'clinical_trial_documents',
  'clinical_trials',
  'closure_technique',
  'cmv_monitoring_plan',
  'coagulation_studies',
  'code_blue_summaries',
  'cognitive_evaluations',
  'cognitive_rehabilitation_reports',
  'colonoscopy_reports',
  'colorectal_colonoscopies',
  'colorectal_surgery_assessment',
  'colorectal_surgery_consultations',
  'communication_preferences',
  'complications',
  'component_allergen_testing',
  'comprehensive_cardiomyopathy_panel',
  'compression_therapy',
  'connective_tissue_disease_assessment',
  'consultation_details',
  'consultation_notes',
  'consultation_timeline',
  'continuous_glucose_monitor',
  'continuous_glucose_monitor_discussion',
  'continuous_infusions',
  'contraction_monitoring',
  'copd_assessments',
  'critical_view_of_safety',
  'cultural_considerations',
  'current_dialysis',
  'current_pregnancy',
  'cystoscopy_reports',
  'cytogenetics',
  'cytology_reports',
  'data_management_instructions',
  'day_programs',
  'deep_brain_stimulation',
  'delivery_planning',
  'dementia_assessment',
  'dementia_education',
  'dental_examination_reports',
  'department',
  'depression_screening',
  'dermatology_assessment',
  'dermatology_consultations',
  'dermatology_procedure_notes',
  'detailed_family_pedigree',
  'developmental_assessments',
  'developmental_milestones',
  'dexa_scan_reports',
  'diabetes_education',
  'diabetes_educator',
  'diabetes_educator_training',
  'diabetes_management',
  'diabetes_management_notes',
  'diabetes_management_plan',
  'diabetes_quality_metrics',
  'diabetes_supplies',
  'diabetic_nephropathy',
  'diagnoses',
  'diagnostic_impression',
  'diagnostic_studies',
  'dialysate_composition',
  'dialysis_planning',
  'dialysis_prescription',
  'dialysis_records',
  'dialysis_run_sheets',
  'dialyzer',
  'dietary_interventions',
  'disability_evaluations',
  'discharge_planning',
  'discharge_summaries',
  'disease_activity_scores',
  'disease_severity',
  'dnr_orders',
  'doctors_medication_recommendations',
  'doctors_medications_recommendations',
  'doctors_medications_recommendations_optimizations',
  'document_metadata',
  'document_type',
  'download_glucometer',
  'dvt_prophylaxis',
  'early_childhood_development',
  'early_maternity_leave',
  'ecg_reports',
  'echo_reports',
  'ed_course',
  'ed_disposition',
  'education_initiated',
  'eeg_reports',
  'emergency_assessment',
  'emergency_discharge_summaries',
  'emergency_information',
  'emergency_reports',
  'emg_reports',
  'employment_counseling',
  'ems_run_reports',
  'endocrine_lab_results',
  'endocrine_therapy',
  'endocrinology_assessment',
  'endocrinology_consultations',
  'endoscopy_findings',
  'endoscopy_reports',
  'ent_assessment',
  'ent_consultations',
  'environmental_exposures',
  'epilepsy_assessment',
  'estimated_blood_loss',
  'estimated_delivery_date',
  'estimated_time_to_dialysis',
  'excessive_glucose_monitoring',
  'exercise_program',
  'exercise_recommendations',
  'extended_family_history',
  'extraintestinal_manifestations',
  'facility',
  'fall_prevention_education',
  'fall_risk_assessments',
  'falls_prevention_program_assessment',
  'family_history',
  'family_medicine_assessment',
  'family_meeting_decisions',
  'family_meeting_notes',
  'fecal_calprotectin',
  'fertility_tracking',
  'fetal_assessment',
  'fetal_echo',
  'fetal_echo_results',
  'fetal_surveillance',
  'fetal_ultrasound',
  'first_trimester_bleeding',
  'first_trimester_screen_result',
  'fitness_for_duty_evaluations',
  'flare_management',
  'flow_cytometry_reports',
  'fluid_electrolyte_management',
  'fluid_intake',
  'fluid_output',
  'fmla_documentation_note',
  'follow_up_appointments',
  'follow_up_enhanced',
  'follow_up_intelligence',
  'follow_up_plan',
  'follow_ups',
  'food_insecurity',
  'foot_exam',
  'frailty_assessment',
  'functional_assessments',
  'functional_mri_studies',
  'functional_status',
  'gait_analysis',
  'gastroenterology_consultations',
  'gdm_recurrence_risk',
  'genetic_oncology',
  'genetic_testing_reports',
  'genetics_psychosocial_assessment',
  'geriatric_assessments',
  'geriatric_cognitive_assessment',
  'geriatric_medications',
  'geriatric_nutritional_assessment',
  'gestational_diabetes',
  'gi_risk_assessment',
  'glasgow_coma_scale',
  'glaucoma_assessments',
  'glaucoma_management',
  'glomerular_disease',
  'glucometer_download_schedule',
  'glucose_monitoring_frequency',
  'glucose_monitoring_goals',
  'glucose_testing_weeks',
  'gout_assessment',
  'growth_parameters',
  'growth_ultrasound_schedule',
  'guideline_compliance',
  'gynecology_consultations',
  'headache_assessment',
  'headers',
  'health_maintenance',
  'height_measurements',
  'hematology_assessment',
  'hematology_consultations',
  'hepatitis_c_history',
  'hepatitis_c_management',
  'history_present_illness',
  'hiv_history',
  'home_health_notes',
  'home_monitoring',
  'home_safety',
  'homicide_risk_assessment',
  'hormone_panels',
  'hormone_therapy_records',
  'hospice_notes',
  'hospital_admission_notes',
  'hospital_course',
  'hospital_discharge_summaries',
  'hospital_transfer_notes',
  'hourly_vital_signs',
  'hydration_management',
  'hypertensive_nephropathy',
  'hypoglycemia_management',
  'hypoglycemia_protocol',
  'ibd_assessment',
  'ibd_biomarkers',
  'ibd_consultation_details',
  'ibd_surgical_planning',
  'icu_flow_sheets',
  'imaging_orders',
  'imaging_reports',
  'immediate_interventions',
  'immediate_recommendations',
  'immune_function_tests',
  'immune_reconstitution_planning',
  'immunization_record',
  'immunization_status',
  'indian_diet_exchange_lists',
  'infection_risk_monitoring',
  'infectious_disease_assessment',
  'inflammatory_bowel_reports',
  'inflammatory_markers',
  'infliximab_drug_monitoring',
  'infusion_therapy',
  'inheritance_pattern_details',
  'injury_details',
  'insulin_adjustment_protocol',
  'insulin_pump_settings',
  'insulin_regimen',
  'insulin_storage_instructions',
  'insulin_timing_instructions',
  'insurance_authorizations',
  'insurance_forms',
  'intake_output_records',
  'integrative_oncology',
  'intelligent_recommendations',
  'inter_pregnancy_weight_management',
  'interval_history',
  'interventional_radiology_notes',
  'intradialytic_monitoring',
  'intraoperative_cholangiography',
  'intraoperative_findings',
  'intraoperative_imaging',
  'iv_infusions',
  'ketone_monitoring_instructions',
  'kidney_disease_progression_timeline',
  'kidney_function_reports',
  'lab_orders',
  'lab_results',
  'lab_schedule',
  'labor_delivery_records',
  'laryngoscopy_reports',
  'lifestyle_assessments',
  'lifestyle_counseling',
  'ligament_reconstruction',
  'liver_function_assessments',
  'lupus_assessment',
  'lymph_node_cytomorphology',
  'macrosomia_threshold',
  'mammography_reports',
  'maternal_fetal_reports',
  'maternal_labs',
  'maternal_weight_monitoring',
  'mayo_score',
  'mechanism_of_injury',
  'medical_alerts',
  'medical_certificates',
  'medical_geneticist',
  'medical_history',
  'medical_power_of_attorney',
  'medical_procedures',
  'medical_reconciliation_forms',
  'medication_access_programs',
  'medication_administration_records',
  'medication_changes_discontinued',
  'medication_changes_dose',
  'medication_changes_new',
  'medication_deprescribing',
  'medication_optimization',
  'medication_recommendations',
  'medication_reconciliation',
  'medication_renal_dosing',
  'medication_safety',
  'medication_safety_alerts',
  'medications',
  'medications_administered',
  'meniscus_repair',
  'mental_health_assessments',
  'mental_health_resources',
  'mental_status_exams',
  'microbiology_culture_reports',
  'mineral_bone_disease',
  'monitoring_plans',
  'monitoring_reports',
  'mood_psychological_assessment',
  'motor_complications',
  'movement_disorder_assessment',
  'mri_reports',
  'multiple_sclerosis_assessment',
  'myeloma_specific_data',
  'myositis_assessment',
  'nephrology_consultation_details',
  'nephrology_consultations',
  'neuro_imaging',
  'neurological_assessment',
  'neurological_exam',
  'neurological_examination',
  'neurological_findings',
  'neurology_consultations',
  'neurology_progress_notes',
  'neuromuscular_disorder',
  'neuropsych_testing',
  'neuropsychological_assessments',
  'neurosurgery_assessment',
  'neurosurgery_consultations',
  'neurovascular_exam',
  'newborn_screening_results',
  'nicu_progress_notes',
  'non_motor_symptoms',
  'nt_scan_result',
  'nuclear_medicine_assessment',
  'nuclear_medicine_studies',
  'nurse_signatures',
  'nursing_assessments',
  'nursing_notes',
  'nutritional_assessment',
  'nutritional_status',
  'nutritional_supplementation',
  'nutritional_support',
  'obstetric_history',
  'obstetric_ultrasound_reports',
  'occupational_medicine_evaluations',
  'occupational_therapy_reports',
  'omissions_refusals',
  'oncologic_emergencies',
  'oncology_consultations',
  'oncology_followup_reports',
  'oncology_team',
  'oncology_treatment_plans',
  'operative_details',
  'operative_report_details',
  'operative_reports',
  'operative_technique',
  'operative_time',
  'ophthalmology_exam',
  'ophthalmology_examinations',
  'optimization_stats',
  'oral_surgery_reports',
  'orthodontic_treatment_plans',
  'orthopedic_assessment',
  'orthopedic_consultations',
  'orthopedic_followup_notes',
  'orthopedic_imaging',
  'orthopedic_operative_reports',
  'orthopedic_procedures',
  'outcomes_prediction',
  'pain_assessment_forms',
  'pain_management',
  'pain_management_notes',
  'pain_management_plan',
  'palliative_care',
  'palliative_care_needs',
  'parental_concerns',
  'parkinson_medications',
  'parkinsonian_features',
  'partner_involvement',
  'partner_involvement_diabetes_management',
  'past_ocular_history',
  'pathology_gross_description',
  'pathology_reports',
  'patient_education_context',
  'patient_education_records',
  'patient_emotional_response',
  'patient_instructions',
  'patient_positioning',
  'patient_provider',
  'patient_specific_care_plan',
  'pediatric_growth_charts',
  'pediatric_screening',
  'pediatric_vaccination_records',
  'pediatric_visits',
  'performance_status',
  'perinatal_mental_health_referral',
  'periodontal_charts',
  'peripheral_neuropathy',
  'pet_scan_reports',
  'pharmacy_review',
  'physical_examinations',
  'physical_therapy_evaluations',
  'physical_therapy_notes',
  'plastic_surgery_assessment',
  'plastic_surgery_consultations',
  'pmr_assessment',
  'pneumoperitoneum',
  'podiatry_examinations',
  'point_of_care_ultrasound_heart_rate',
  'poison_control_reports',
  'polycystic_kidney_disease',
  'polypharmacy',
  'polypharmacy_reviews',
  'port_placement',
  'post_dialysis_assessment',
  'post_op_testing',
  'post_operative_reports',
  'postop_testing',
  'postoperative_condition',
  'postoperative_orders',
  'postpartum_diabetes_risk',
  'postpartum_glucose_monitoring',
  'postpartum_notes',
  'postpartum_planning',
  'potential_testing_outcomes',
  'pre_chemotherapy_workup',
  'pre_dialysis_assessment',
  'pre_operative_assessments',
  'pre_operative_preparation',
  'pre_pregnancy_weight',
  'preconception_counseling',
  'preeclampsia_monitoring',
  'pregnancy_complications',
  'pregnancy_course',
  'pregnancy_risk_assessment',
  'pregnancy_symptoms',
  'prenatal_education',
  'prenatal_screening',
  'prenatal_testing_reports',
  'prenatal_visits',
  'preoperative_preparation',
  'prep_and_drape',
  'prescriptions',
  'pressure_injury',
  'preventive_biomarkers',
  'preventive_care',
  'preventive_medicine_assessments',
  'primary_prophylaxis',
  'prior_authorization_forms',
  'prior_authorization_status',
  'prn_medications',
  'procedural_sedation',
  'procedures_interventions',
  'prognosis',
  'prognosis_discussion',
  'prognosis_records',
  'prognostic_factors',
  'progress_notes',
  'prophylactic_medications',
  'proposed_art_switch',
  'proteinuria_assessment',
  'provider_info',
  'psc_management',
  'psychiatric_assessment_scales',
  'psychiatric_discharge_summaries',
  'psychiatric_evaluations',
  'psychiatric_history',
  'psychiatric_progress_notes',
  'psychiatric_review',
  'psychiatric_treatment_plan',
  'psychosocial_assessments',
  'psychosocial_factors',
  'psychosocial_oncology',
  'psychosocial_support_services',
  'psychotropic_medications',
  'pulmonary_function_tests',
  'pulmonary_imaging',
  'pulmonary_rehabilitation',
  'pulmonary_rehabilitation_notes',
  'pulmonology_consultations',
  'pump_advanced_settings',
  'pump_download_analysis',
  'quality_assurance',
  'quality_metrics',
  'radiation_oncology',
  'radiation_therapy',
  'radiation_therapy_records',
  'radiology_findings',
  'radiology_reports',
  'rapid_response_summaries',
  'reason_for_referral',
  'referrals',
  'referrals_placed',
  'rehabilitation_progress_notes',
  'rehabilitation_protocol',
  'renal_anemia',
  'renal_nutrition',
  'renal_protection_plan',
  'reproductive_history',
  'rescue_therapy_options',
  'research_consent_forms',
  'respiratory_devices',
  'respiratory_infections',
  'respiratory_medications',
  'respite_care',
  'response_assessment',
  'retinal_examinations',
  'return_to_sport',
  'review_of_systems',
  'rheumatoid_arthritis_assessment',
  'rheumatologic_assessment',
  'rheumatologic_monitoring',
  'rheumatologic_treatment',
  'rheumatology_consultations',
  'risk_calculators',
  'risk_counseling',
  'risk_factors',
  'safety_planning',
  'scheduled_medications',
  'school_health_forms',
  'school_performance',
  'scleroderma_assessment',
  'screening_compliance',
  'second_opinion_reports',
  'secondary_prophylaxis',
  'shift_handoff_notes',
  'single_embryo_transfer',
  'single_embryo_transfer_details',
  'sjogrens_syndrome_assessment',
  'skin_biopsy_reports',
  'sleep_disturbances',
  'sleep_study_reports',
  'smoking_cessation_program',
  'soap_notes',
  'social_determinants_of_health',
  'social_functional_assessment',
  'social_history',
  'social_support',
  'social_work',
  'social_work_notes',
  'source',
  'south_asian_nutritionist',
  'specialty_fields',
  'specific_ige_tests',
  'specimens',
  'speech_therapy_assessments',
  'spondyloarthritis_assessment',
  'sponge_instrument_counts',
  'sports_medicine_evaluations',
  'staging_summary',
  'stress_management_referrals',
  'stress_test_reports',
  'stroke_assessment',
  'substance_use_assessment',
  'suicide_risk_assessment',
  'supplementation_plans',
  'support_group_referral',
  'supportive_care',
  'surgical_approach',
  'surgical_consent_forms',
  'surgical_history',
  'surgical_oncology',
  'surgical_steps',
  'surgical_team',
  'survivorship_care_plan',
  'symptom_progression',
  'symptom_progression_timeline',
  'telemedicine_encounters',
  'therapy_progress_notes',
  'therapy_session_notes',
  'thoracic_surgery_assessment',
  'thyroid_evaluations',
  'thyroid_management',
  'total_weight_gain',
  'tourniquet_data',
  'toxicity_assessment',
  'toxicology_reports',
  'tractography_studies',
  'transfer_summaries',
  'transplant_assessment',
  'transplant_evaluations',
  'trauma_flow_sheets',
  'travel_health_certificates',
  'treatment_courses',
  'treatment_goals',
  'treatment_plans',
  'treatment_summary',
  'trend_analysis',
  'trending_analysis',
  'triage_data',
  'tumor_board_notes',
  'tumor_marker_panels',
  'tumor_markers',
  'ultrasound_ob_reports',
  'umbilical_artery_doppler',
  'urodynamic_studies',
  'urology_assessment',
  'urology_consultations',
  'vaccination_records',
  'variant_interpretation_guidelines',
  'vasculitis_assessment',
  'vascular_surgery_assessment',
  'ventilator_settings',
  'visual_acuity_reports',
  'vital_signs',
  'vital_signs_logs',
  'vital_signs_monitoring',
  'vital_signs_table',
  'weekly_virtual_check_ins',
  'weight_measurements',
  'weight_monitoring',
  'well_child_examinations',
  'well_child_summary',
  'work_accommodations',
  'work_restrictions',
  'workers_comp_evaluations',
  'workplace_accommodations',
  'wound_care_assessments',
  'wound_care_documentation',
  'wound_care_notes',
  // 80 New Collections Added December 2025
  // Emergency Medicine (8)
  'ed_triage_assessment',
  'trauma_assessment',
  'trauma_scoring',
  'emergency_airway_management',
  'resuscitation_records',
  'emergency_procedures',
  'emergency_disposition',
  'emergency_observation_unit',
  // Infectious Disease (9)
  'antibiotic_stewardship',
  'infection_control_records',
  'sepsis_management',
  'opportunistic_infections',
  'antimicrobial_susceptibility',
  'isolation_precautions',
  'infection_surveillance',
  'travel_medicine_assessment',
  'tropical_disease_assessment',
  // Anesthesiology (8)
  'preoperative_evaluation',
  'anesthesia_consent',
  'intraoperative_monitoring',
  'postoperative_pain_management',
  'regional_anesthesia_records',
  'airway_management_records',
  'sedation_records',
  'anesthesia_complications',
  // Pain Management (6)
  'chronic_pain_assessment',
  'opioid_risk_assessment',
  'interventional_pain_procedures',
  'pain_medication_agreements',
  'pain_functional_assessment',
  'multimodal_pain_therapy',
  // Occupational Medicine (8)
  'occupational_health_assessment',
  'workers_compensation_evaluation',
  'workplace_injury_report',
  'occupational_exposure_records',
  'return_to_work_plan',
  'job_hazard_analysis',
  // Vascular Surgery additions (3) - June 2026
  'vascular_bypass_surgery',
  'venous_insufficiency_assessment',
  'aortic_aneurysm_surveillance',
  // Facial Trauma (1) - June 2026
  'facial_trauma_assessment',
  'ergonomic_assessment',
  'pre_employment_physical',
  // Geriatric Medicine (3)
  'cognitive_screening',
  'elder_abuse_screening',
  'goals_of_care_discussion',
  // Sleep Medicine (7)
  'cpap_management',
  'sleep_disorder_assessment',
  'insomnia_assessment',
  'narcolepsy_assessment',
  'sleep_apnea_management',
  'sleep_hygiene_education',
  'daytime_sleepiness_assessment',
  // Sports Medicine (8)
  'sports_physical_examination',
  'concussion_assessment',
  'return_to_play_protocol',
  'athletic_injury_assessment',
  'exercise_prescription',
  'performance_assessment',
  'sports_nutrition_plan',
  'overtraining_assessment',
  // Preventive Medicine (8)
  'cancer_screening_records',
  'cardiovascular_risk_screening',
  'lifestyle_risk_assessment',
  'health_coaching_notes',
  'wellness_visit_documentation',
  'immunization_schedule',
  'travel_vaccination_records',
  'annual_physical_examination',
  // FHIR Risk Assessments (6)
  'pressure_ulcer_risk',
  'venous_thromboembolism_risk',
  'readmission_risk_assessment',
  'mortality_risk_assessment',
  'malnutrition_risk_assessment',
  'bleeding_risk_assessment',
  // FHIR Care Goals (4)
  'patient_care_goals',
  'rehabilitation_goals',
  'behavioral_health_goals',
  'chronic_disease_goals',
  // FHIR Service Requests (5)
  'consultation_requests',
  'procedure_requests',
  'therapy_requests',
  'home_health_orders',
  'durable_medical_equipment_orders'
];

// Convert snake_case to camelCase
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

// Convert snake_case to Title Case
function toTitleCase(str) {
  return str.replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

// Generate function name
function getFunctionName(category, operation) {
  const camelCategory = toCamelCase(category);

  // Use plural naming for ALL operations to match collection names
  switch(operation) {
    case 'get':
      return `get${camelCategory.charAt(0).toUpperCase() + camelCategory.slice(1)}`;
    case 'create':
      return `create${camelCategory.charAt(0).toUpperCase() + camelCategory.slice(1)}`;
    case 'update':
      return `update${camelCategory.charAt(0).toUpperCase() + camelCategory.slice(1)}`;
    case 'delete':
      return `delete${camelCategory.charAt(0).toUpperCase() + camelCategory.slice(1)}`;
    case 'search':
      return `search${camelCategory.charAt(0).toUpperCase() + camelCategory.slice(1)}`;
    default:
      return `${operation}${camelCategory.charAt(0).toUpperCase() + camelCategory.slice(1)}`;
  }
}

// Get schema for collection (agent-visible fields only)
// UPDATED: Now uses unifiedSchemas.getAgentSchema() instead of collectionSchemas.getSchema()
function getCollectionSchema(category) {
  return unifiedSchemas.getAgentSchema(category) || {};
}

// Convert schema to parameter definition
function schemaToParameters(schema, operation) {
  const params = {};

  Object.entries(schema).forEach(([field, def]) => {
    // Skip base fields and auto fields
    if (field === '_id' || field === 'createdAt' || field === 'updatedAt' || def.auto) return;
    if (operation === 'update' && field === 'patientId') return; // Don't allow updating patientId

    params[field] = {
      type: def.type,
      description: def.description || `${field} value`
    };

    if (def.required && operation === 'create') {
      params[field].required = true;
    }
  });

  return params;
}

// Generate parameters string for function
function generateParameters(category, operation, schema) {
  const titleCase = toTitleCase(category);
  const singular = titleCase.replace(/s$/, '');

  switch(operation) {
    case 'get':
      return `{
            patientId: { type: "string", required: true, description: "Patient ID" },
            dateFrom: { type: "string", description: "Start date (YYYY-MM-DD)" },
            dateTo: { type: "string", description: "End date (YYYY-MM-DD)" },
            limit: { type: "number", description: "Maximum number of records" },
            sortBy: { type: "string", enum: ["date", "provider", "urgency"], description: "Sort field" },
            sortOrder: { type: "string", enum: ["asc", "desc"], description: "Sort order" }
          }`;

    case 'create':
      const createParams = schemaToParameters(schema, 'create');
      return `{
            patientId: { type: "string", required: true, description: "Patient ID" },
            data: {
              type: "object",
              required: true,
              description: "${singular} data",
              properties: ${JSON.stringify(createParams, null, 14).replace(/\n/g, '\n            ')}
            },
            documentId: { type: "string", description: "Associated document ID" }
          }`;

    case 'update':
      const updateParams = schemaToParameters(schema, 'update');
      // Use medicationId for medications, recordId for others
      const idField = category === 'medications' ? 'medicationId' : 'recordId';
      const idDesc = category === 'medications' ? 'Medication ID (the _id field)' : 'Record ID to update';

      return `{
            ${idField}: { type: "string", required: true, description: "${idDesc}" },
            updates: {
              type: "object",
              required: true,
              description: "Fields to update",
              properties: ${JSON.stringify(updateParams, null, 14).replace(/\n/g, '\n              ')}
            }
          }`;

    case 'delete':
      const deleteIdField = category === 'medications' ? 'medicationId' : 'recordId';
      const deleteIdDesc = category === 'medications' ? 'Medication ID to delete (the _id field)' : 'Record ID to delete';
      return `{
            ${deleteIdField}: { type: "string", required: true, description: "${deleteIdDesc}" }
          }`;

    case 'search':
      return `{
            patientId: { type: "string", required: true, description: "Patient ID" },
            searchText: { type: "string", required: true, description: "Text to search for" },
            limit: { type: "number", description: "Maximum number of results (default: 50)" }
          }`;
  }
}

// Generate a single function
function generateFunction(category, operation) {
  const functionName = getFunctionName(category, operation);
  const titleCase = toTitleCase(category);
  const singular = titleCase.replace(/s$/, '');
  const schema = getCollectionSchema(category);

  let description;

  switch(operation) {
    case 'get':
      description = `Retrieve ${titleCase.toLowerCase()} records for a patient. Use this function when user asks to see, show, display, or retrieve ${titleCase.toLowerCase()} data.`;
      break;
    case 'create':
      description = `Create a new ${singular.toLowerCase()} record`;
      break;
    case 'update':
      description = category === 'medications'
        ? `Update an existing medication record. To discontinue a medication, set active:false and provide discontinuedDate and discontinuedReason.`
        : `Update an existing ${singular.toLowerCase()} record`;
      break;
    case 'delete':
      description = `Delete a ${singular.toLowerCase()} record`;
      break;
    case 'search':
      description = `Search ${titleCase.toLowerCase()} records by text (searches across all text fields using regex)`;
      break;
  }

  const parameters = generateParameters(category, operation, schema);
  const idField = (operation === 'update' || operation === 'delete') && category === 'medications' ? 'medicationId' : 'recordId';

  return `
      ${functionName}: {
        description: "${description}",
        parameters: ${parameters},
        handler: async (args, context) => {
          const SecureDataAccess = require('../services/secureDataAccess');
          const { ObjectId } = require('mongodb');
          const secureContext = {
            serviceId: 'agentServiceV4',
            operation: '${functionName}',
            practiceId: context.practiceId
          };

          ${operation === 'get' ? `
          // Validate and convert patientId to ObjectId if it's a valid hex string
          let patientId = args.patientId;
          console.log(\`🔍 [${functionName}] Received patientId:\`, patientId, \`(type: \${typeof patientId})\`);

          if (typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)) {
            patientId = new ObjectId(patientId);
            console.log(\`✅ [${functionName}] Converted to ObjectId:\`, patientId);
          } else {
            console.log(\`⚠️  [${functionName}] PatientId NOT converted (not 24-hex format)\`);
          }

          const filter = { patientId: patientId };
          if (args.dateFrom || args.dateTo) {
            filter.date = {};
            if (args.dateFrom) filter.date.$gte = new Date(args.dateFrom);
            if (args.dateTo) filter.date.$lte = new Date(args.dateTo);
          }

          const options = {
            limit: args.limit || 100,
            sort: args.sortBy ? { [args.sortBy]: args.sortOrder === 'desc' ? -1 : 1 } : { date: -1 }
          };

          console.log(\`🔎 [${functionName}] Querying '${category}' with filter:\`, JSON.stringify(filter));
          const result = await SecureDataAccess.query('${category}', filter, options, secureContext);
          console.log(\`📊 [${functionName}] Query returned \${result?.length || 0} records\`);

          return result;` : ''}

          ${operation === 'create' ? `
          // Validate and convert patientId to ObjectId if it's a valid hex string
          let patientId = args.patientId;
          if (typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)) {
            patientId = new ObjectId(patientId);
          }

          // CRITICAL: Remove patientId from data object if it exists (agent may include it)
          const { patientId: _, ...dataWithoutPatientId } = args.data || {};

          const record = {
            ...dataWithoutPatientId,
            patientId: patientId,  // Use converted ObjectId, not string from data
            documentId: args.documentId,
            createdAt: new Date(),
            source: 'agent'
          };

          return await SecureDataAccess.insert('${category}', record, secureContext);` : ''}

          ${operation === 'update' ? `
          const filter = { _id: new ObjectId(args.${idField}) };
          const updates = {
            ...args.updates,
            updatedAt: new Date()
          };

          return await SecureDataAccess.update('${category}', filter, updates, secureContext);` : ''}

          ${operation === 'delete' ? `
          return await SecureDataAccess.delete('${category}', { _id: new ObjectId(args.${idField}) }, secureContext);` : ''}

          ${operation === 'search' ? `
          // Validate and convert patientId to ObjectId if it's a valid hex string
          let patientId = args.patientId;
          if (typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)) {
            patientId = new ObjectId(patientId);
          }

          // Use regex search instead of text index (which may not exist)
          // Search across common text fields
          const searchRegex = new RegExp(args.searchText, 'i'); // case-insensitive
          const filter = {
            patientId: patientId,
            $or: [
              { diagnosis: searchRegex },
              { symptoms: searchRegex },
              { notes: searchRegex },
              { description: searchRegex },
              { findings: searchRegex },
              { comments: searchRegex },
              { impression: searchRegex },
              { assessment: searchRegex },
              { plan: searchRegex }
            ]
          };

          const options = {
            limit: args.limit || 50,
            sort: { date: -1 } // Most recent first
          };

          return await SecureDataAccess.query('${category}', filter, options, secureContext);` : ''}
        }
      }`;
}

// Generate all functions
async function generateAllFunctions() {
  console.log(`🚀 Generating functions for ${categories.length} categories using collectionSchemas.js...`);

  // UPDATED November 27, 2025: Removed 'search' - now only 4 CRUD operations
  // Search functions were removed because get functions through optimizedMedicalFunctions
  // wrapper already handle queries AND return artifact panels
  const operations = ['get', 'create', 'update', 'delete'];
  let allFunctions = [];

  for (const category of categories) {
    for (const operation of operations) {
      const func = generateFunction(category, operation);
      allFunctions.push(func);
    }
  }

  // Create the output file
  const output = `/**
 * Auto-generated Medical Category Functions (Schema-Based)
 * Total: ${categories.length * operations.length} functions (${categories.length} categories × ${operations.length} operations)
 * Generated: ${new Date().toISOString()}
 * Source: collectionSchemas.js
 */

module.exports = {
  medicalCategoryFunctions: {
${allFunctions.join(',\n')}
  }
};`;

  // Write to file
  const outputPath = path.join(__dirname, '..', 'services', 'generatedMedicalFunctions.js');
  await fs.writeFile(outputPath, output);

  console.log(`✅ Generated ${categories.length * operations.length} functions with schema-based parameters`);
  console.log(`📄 Output: ${outputPath}`);

  // Also generate a summary
  const summary = `
Total Functions Generated: ${categories.length * operations.length}
Categories: ${categories.length}
Operations per category: ${operations.length}
Schema Source: collectionSchemas.js

Functions include:
${categories.map(cat => {
    return operations.map(op => `- ${getFunctionName(cat, op)}`).join('\n');
  }).join('\n')}
`;

  const summaryPath = path.join(__dirname, '..', 'services', 'generatedMedicalFunctions.summary.txt');
  await fs.writeFile(summaryPath, summary);
  console.log(`📋 Summary: ${summaryPath}`);
}

// Run the generator
generateAllFunctions().catch(console.error);
