/**
 * Clinical Operations Service
 *
 * Domain: clinical_ops
 * Functions: 6 (reminders, quality metrics, care gaps, etc.)
 *
 * Purpose: Handle operational clinical data - reminders, quality metrics, care gaps, cost tracking, administrative data
 *
 * Architecture:
 * - Uses SecureDataAccess for all database operations
 * - Practice-aware multi-tenant isolation
 * - Integrates with collectionFormatters for Claude-readable output
 * - Service authentication via ServiceAccountManager
 */

const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const formatters = require('./utils/collectionFormatters');
const { ObjectId } = require('mongodb');

class ClinicalOperationsService {
  constructor() {
    this.serviceName = 'clinicalOperationsService';
    this.serviceAuth = null;
  }

  /**
   * Initialize service with authentication
   */
  async initialize() {
    if (!this.serviceAuth) {
      this.serviceAuth = await serviceAccountManager.authenticate(this.serviceName);
      console.log(`✅ ${this.serviceName} authenticated successfully`);
    }
    return this.serviceAuth;
  }

  /**
   * Create secure context for database operations
   * @param {Object} practiceContext - Practice context from request
   * @param {string} operation - Operation name
   * @returns {Object} Security context
   */
  createSecureContext(practiceContext, operation) {
    return {
      serviceId: this.serviceName,
      operation: operation,
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId || 'global',
      apiKey: this.serviceAuth?.apiKey || this.serviceAuth
    };
  }

  /**
   * Generic method to fetch and format operational collection data
   * @param {string} collectionName - Database collection name
   * @param {string} formatterName - Formatter key name
   * @param {Object} params - Query parameters
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Session context
   * @returns {Object} Formatted response
   */
  async getOperationalData(collectionName, formatterName, params, practiceContext, session) {
    try {
      // Initialize if needed
      if (!this.serviceAuth) {
        await this.initialize();
      }

      // Extract patientId
      let { patientId, ...queryOptions } = params;

      // Check context if no patientId
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
      }

      if (!patientId) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרש מזהה מטופל'
          : 'Patient ID required');
      }

      // Build security context
      const context = this.createSecureContext(practiceContext, `get_${collectionName}`);

      // Build filter
      const filter = {
        patientId: typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
          ? new ObjectId(patientId)
          : patientId
      };

      // Add date filters if provided
      if (params.dateFrom || params.dateTo) {
        filter.date = {};
        if (params.dateFrom) filter.date.$gte = new Date(params.dateFrom);
        if (params.dateTo) filter.date.$lte = new Date(params.dateTo);
      }

      // Add status filter if provided
      if (params.status) {
        filter.status = params.status;
      }

      // Query options
      const options = {
        sort: { date: -1 },
        limit: params.limit || 100
      };

      // Query database
      const data = await SecureDataAccess.query(
        collectionName,
        filter,
        options,
        context
      );

      console.log(`✅ Found ${data?.length || 0} ${collectionName} records for patient ${patientId}`);

      if (!data || data.length === 0) {
        return {
          success: true,
          data: practiceContext.language === 'he'
            ? `לא נמצאו נתונים עבור ${collectionName}`
            : `No ${collectionName} data found for this patient.`,
          count: 0,
          displayType: 'openArtifactPanel',
          artifactPanel: {
            patientId: patientId,
            category: collectionName,
            type: 'documents',
            data: []
          }
        };
      }

      // Collections that should wrap all records into single document (like medications, imaging_reports, etc.)
      const WRAP_ALL_RECORDS_COLLECTIONS = new Set([
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
        'family_medicine_visits',
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
        'malnutrition_risk_assessment',
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
        'soap_notes',
        'social_determinants_of_health',
        'social_functional_assessment',
        'social_history',
    'burn_fluid_resuscitation',
    'burn_rehabilitation',
    'skin_grafting_evaluation',
    'burn_wound_care',
    'burn_assessment',
    'decompression_sickness_treatment',
    'wound_healing_hyperbaric',
    'hyperbaric_oxygen_therapy',
    'pharmacist_consultation',
    'medication_action_plan',
    'comprehensive_medication_review',
    'medication_therapy_management',
    'vision_therapy_assessment',
    'low_vision_evaluation',
    'contact_lens_fitting',
    'optometry_examination',
    'chiropractic_treatment_plan',
    'chiropractic_x_ray_review',
    'spinal_manipulation_record',
    'chiropractic_consultation',
    'cpap_bipap_management',
    'bronchial_hygiene_therapy',
    'airway_clearance_therapy',
    'ventilator_weaning_protocol',
    'oxygen_titration_protocol',
    'respiratory_therapy_assessment',
    'nutrition_lab_monitoring',
    'parenteral_nutrition_monitoring',
    'tube_feeding_order',
    'nutrition_support_consultation',
    'enteral_feeding_assessment',
    'tpn_management',
    'medication_dosing_recommendation',
    'drug_gene_interaction_report',
    'cyp450_panel_results',
    'pharmacogenomic_testing',
    'syphilis_treatment_follow_up',
    'partner_notification',
    'sexual_health_counseling',
    'hiv_prep_management',
    'hiv_pep_prophylaxis',
    'sti_screening_panel',
    'fertility_preservation',
    'surrogacy_evaluation',
    'donor_egg_cycle',
    'intrauterine_insemination',
    'fertility_medication_management',
    'ovarian_stimulation_protocol',
    'sperm_analysis',
    'embryo_transfer_procedure',
    'egg_retrieval_procedure',
    'ivf_cycle_monitoring',
    'oral_pathology_biopsy',
    'dental_implant_surgery',
    'orthognathic_surgery_evaluation',
    'jaw_reconstruction',
    'facial_trauma_assessment',
    'tmj_assessment',
    'foot_orthotics_assessment',
    'plantar_fasciitis_management',
    'ingrown_toenail_treatment',
    'heel_pain_assessment',
    'foot_reconstruction',
    'bunion_surgery_evaluation',
    'diabetic_foot_assessment',
    'podiatry_consultations',
    'stem_cell_transplant_assessment',
    'bone_marrow_transplant_follow_up',
    'bone_marrow_transplant_evaluation',
    'pancreas_transplant_follow_up',
    'pancreas_transplant_evaluation',
    'kidney_transplant_follow_up',
    'lung_transplant_follow_up',
    'lung_transplant_evaluation',
    'heart_transplant_follow_up',
    'heart_transplant_evaluation',
    'liver_transplant_follow_up',
    'varicose_vein_treatment',
    'peripheral_artery_disease',
    'aortic_aneurysm_surveillance',
    'venous_insufficiency_assessment',
    'vascular_bypass_surgery',
    'liver_transplant_evaluation',
    'vascular_surgery_assessment',
    'job_hazard_analysis',
    'trauma_assessment',
    'trauma_scoring',
    'emergency_procedures',
    'immunization_schedule',
    'travel_vaccination_records',
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
        'smoking_cessation_program',
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
        'wound_care_notes'
      ]);

      // Wrap records if this is a document-view collection
      let dataToReturn = data;
      if (WRAP_ALL_RECORDS_COLLECTIONS.has(collectionName)) {
        dataToReturn = [{
          _id: `${collectionName}_${patientId}_all`,
          [collectionName]: data,  // All records in array under collection name key
          patientId: patientId,
          category: collectionName,
          title: `Current ${collectionName.replace(/_/g, ' ')}`,
          date: new Date().toISOString(),
          preview: `${data.length} ${collectionName.replace(/_/g, ' ').slice(0, -1)}${data.length === 1 ? '' : 's'}`
        }];
      }

      // Format with formatter for Claude's text output
      const formatter = formatters[formatterName];
      let formattedText = '';
      if (formatter) {
        const formattedDocs = data.map(doc => formatter(doc));
        formattedText = formattedDocs.join('\n\n' + '='.repeat(80) + '\n\n');
      } else {
        formattedText = JSON.stringify(data, null, 2);
      }

      // Return with artifact panel structure
      return {
        success: true,
        data: formattedText,  // For Claude
        rawData: data,        // For UI
        count: data.length,
        message: practiceContext.language === 'he'
          ? `נמצאו ${data.length} רשומות`
          : `Found ${data.length} records`,
        displayType: 'openArtifactPanel',
        artifactPanel: {
          patientId: patientId,
          category: collectionName,
          type: WRAP_ALL_RECORDS_COLLECTIONS.has(collectionName) ? 'documents' : 'grid',
          data: dataToReturn
        }
      };

    } catch (error) {
      console.error(`Error getting ${collectionName}:`, error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בטעינת ${collectionName}: ${error.message}`
          : `Error loading ${collectionName}: ${error.message}`
      };
    }
  }

  // ============================================================================
  // SERVICE FUNCTIONS - OPERATIONAL DATA
  // ============================================================================

  /**
   * Get Quality Metrics
   * Fetch quality metrics for a patient
   */
  async getQualityMetrics(params, practiceContext, session) {
    return await this.getOperationalData(
      'quality_metrics',
      'quality_metrics',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get History of Present Illness
   * Fetch history of present illness records
   */
  async getHistoryPresentIllness(params, practiceContext, session) {
    return await this.getOperationalData(
      'history_present_illness',
      'history_present_illness',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Care Gaps
   * Fetch identified care gaps for a patient
   */
  async getCareGaps(params, practiceContext, session) {
    return await this.getOperationalData(
      'care_gaps',
      'care_gaps',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Cost Tracking
   * Fetch cost tracking data for a patient
   */
  async getCostTracking(params, practiceContext, session) {
    return await this.getOperationalData(
      'costtrackings',
      'costtrackings',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Administrative Data
   * Fetch administrative data for a patient
   */
  async getAdministrativeData(params, practiceContext, session) {
    return await this.getOperationalData(
      'administrative_data',
      'administrative_data',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Risk Factors
   * Fetch risk factors for a patient
   */
  async getRiskFactors(params, practiceContext, session) {
    return await this.getOperationalData(
      'risk_factors',
      'risk_factors',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Treatment Plans
   * Fetch treatment plans for a patient
   */
  async getTreatmentPlans(params, practiceContext, session) {
    return await this.getOperationalData(
      'treatment_plans',
      'treatment_plans',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Clinical Scores
   * Fetch clinical scores for a patient
   */
  async getClinicalScores(params, practiceContext, session) {
    return await this.getOperationalData(
      'clinical_scores',
      'clinical_scores',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Medical History
   * Fetch medical history for a patient
   */
  async getMedicalHistory(params, practiceContext, session) {
    return await this.getOperationalData(
      'medical_history',
      'medical_history',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Prognosis Records
   * Fetch prognosis records for a patient
   */
  async getPrognosisRecords(params, practiceContext, session) {
    return await this.getOperationalData(
      'prognosis_records',
      'prognosis_records',
      params,
      practiceContext,
      session
    );
  }

  /**
   * Get Medication Reconciliation
   * Fetch medication reconciliation records for a patient
   */
  async getMedicationReconciliation(params, practiceContext, session) {
    return await this.getOperationalData(
      'medication_reconciliation',
      'medication_reconciliation',
      params,
      practiceContext,
      session
    );
  }
}

module.exports = new ClinicalOperationsService();
