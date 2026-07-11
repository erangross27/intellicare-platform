/**
 * Category to Collection Mapper Service
 *
 * Maps document categories to their appropriate MongoDB collections
 * Handles all 267 medical collection types with intelligent routing
 *
 * This service ensures that extracted medical data is saved to the correct
 * specialized collections based on document type and content.
 */

const medicalCollectionsService = require('./medicalCollectionsService');

class CategoryCollectionMapper {
  constructor() {
    // Get all valid collections
    this.validCollections = medicalCollectionsService.getAllCollections();

    // Build comprehensive category mappings
    this.categoryMappings = this.buildCategoryMappings();

    // Build reverse mappings for validation
    this.collectionToCategory = this.buildReverseMappings();

    console.log(`✅ CategoryCollectionMapper initialized with ${Object.keys(this.categoryMappings).length} category mappings`);
  }

  /**
   * Build comprehensive mappings from document categories to collections
   * Handles variations in naming and multiple collection targets
   */
  buildCategoryMappings() {
    return {
      // ============= CORE MEDICAL RECORDS =============
      'consultation_notes': ['consultation_notes'],
      'consultation_note': ['consultation_notes'],
      'clinical_consultation': ['consultation_notes'],
      'medical_consultation': ['consultation_notes'],

      'discharge_summaries': ['discharge_summaries'],
      'discharge_summary': ['discharge_summaries'],
      'hospital_discharge': ['hospital_discharge_summaries', 'vital_signs_logs', 'treatment_courses', 'patient_education_records', 'administrative_data'],
      'hospital_discharge_summaries': ['hospital_discharge_summaries', 'vital_signs_logs', 'treatment_courses', 'patient_education_records', 'administrative_data', 'recommendations', 'history_present_illness'],
      'emergency_discharge': ['emergency_discharge_summaries'],
      'emergency_discharge_summaries': ['emergency_discharge_summaries', 'triage_data', 'ed_course', 'consultation_timeline', 'preoperative_preparation', 'ed_disposition', 'pain_management'],
      'emergency_reports': ['emergency_reports', 'injury_details', 'orthopedic_assessments', 'procedural_sedation', 'orthopedic_procedures', 'work_restrictions'],

      'lab_results': ['lab_results'],
      'lab_report': ['lab_results'],
      'blood_work': ['lab_results'],
      'blood_tests': ['lab_results'],

      'imaging_reports': ['imaging_reports'],
      'imaging_report': ['imaging_reports'],
      'radiology_report': ['radiology_reports'],
      'radiology_reports': ['radiology_reports'],

      'vital_signs': ['vital_signs'],
      'vitals': ['vital_signs'],
      'vital_signs_log': ['vital_signs_logs'],
      'vital_signs_logs': ['vital_signs_logs'],

      'medications': ['medications'],
      'medication_list': ['medications'],
      'current_medications': ['medications'],
      'medication_administration': ['medication_administration_records'],

      'diagnoses': ['diagnoses'],
      'diagnosis': ['diagnoses'],
      'diagnostic_report': ['diagnoses'],

      'allergies': ['allergies'],
      'allergy_list': ['allergies'],
      'allergy_record': ['allergies'],

      'prescriptions': ['prescriptions'],
      'prescription': ['prescriptions'],
      'rx': ['prescriptions'],

      'vaccinations': ['vaccination_records'],
      'vaccination_record': ['vaccination_records'],
      'immunizations': ['vaccination_records'],
      'vaccine_record': ['vaccination_records'],

      'medical_procedures': ['medical_procedures'],
      'procedures': ['medical_procedures'],
      'procedure_report': ['medical_procedures'],

      // ============= HOSPITAL & EMERGENCY =============
      'emergency_report': ['emergency_reports'],
      'emergency_reports': ['emergency_reports'],
      'er_report': ['emergency_reports'],
      'ed_report': ['emergency_reports'],
      'emergency_room': ['emergency_reports'],

      'hospital_admission': ['hospital_admission_notes'],
      'admission_note': ['hospital_admission_notes'],
      'admission_notes': ['hospital_admission_notes'],

      'icu_flow_sheets': ['icu_flow_sheets'],
      'icu_flow_sheets': ['icu_flow_sheets'],
      'icu_flowsheet': ['icu_flow_sheets'],
      'critical_care_flowsheet': ['icu_flow_sheets'],

      'transfer_summary': ['transfer_summaries'],
      'transfer_note': ['hospital_transfer_notes'],
      'hospital_transfer': ['hospital_transfer_notes'],

      // ============= SURGICAL & OPERATIVE =============
      'operative_report': ['operative_reports', 'surgical_teams', 'operative_details', 'anesthesia_records', 'surgical_approaches', 'intraoperative_findings', 'operative_techniques', 'intraoperative_imaging', 'surgical_specimens', 'estimated_blood_loss', 'surgical_complications', 'postoperative_orders', 'surgical_discharge_planning'],
      'operative_reports': ['operative_reports', 'surgical_teams', 'operative_details', 'anesthesia_records', 'surgical_approaches', 'intraoperative_findings', 'operative_techniques', 'intraoperative_imaging', 'surgical_specimens', 'estimated_blood_loss', 'surgical_complications', 'postoperative_orders', 'surgical_discharge_planning'],
      'surgery_report': ['operative_reports', 'surgical_teams', 'operative_details', 'anesthesia_records', 'surgical_approaches', 'intraoperative_findings', 'operative_techniques', 'intraoperative_imaging', 'surgical_specimens', 'estimated_blood_loss', 'surgical_complications', 'postoperative_orders', 'surgical_discharge_planning'],
      'surgical_report': ['operative_reports', 'surgical_teams', 'operative_details', 'anesthesia_records', 'surgical_approaches', 'intraoperative_findings', 'operative_techniques', 'intraoperative_imaging', 'surgical_specimens', 'estimated_blood_loss', 'surgical_complications', 'postoperative_orders', 'surgical_discharge_planning'],
      'operation_note': ['operative_reports', 'surgical_teams', 'operative_details', 'anesthesia_records', 'surgical_approaches', 'intraoperative_findings', 'operative_techniques', 'intraoperative_imaging', 'surgical_specimens', 'estimated_blood_loss', 'surgical_complications', 'postoperative_orders', 'surgical_discharge_planning'],

      'anesthesia_records': ['anesthesia_records', 'intraoperative_records'],
      'anesthesia_records': ['anesthesia_records', 'intraoperative_records'],
      'anesthesia_report': ['anesthesia_records', 'intraoperative_records'],
      'anesthesia_preop': ['preoperative_assessments'],
      'preop_anesthesia': ['preoperative_assessments'],
      'asa_classification': ['preoperative_assessments'],
      'intraoperative_anesthesia': ['intraoperative_records'],
      'anesthesia_intraop': ['intraoperative_records'],
      'pacu_record': ['pacu_records'],
      'recovery_room': ['pacu_records'],
      'post_anesthesia': ['pacu_records'],
      'pain_management_anesthesia': ['pain_management'],
      'chronic_pain_eval': ['pain_management'],
      'regional_block': ['regional_anesthesia_records'],
      'nerve_block': ['regional_anesthesia_records'],
      'epidural': ['regional_anesthesia_records'],
      'spinal_anesthesia': ['regional_anesthesia_records'],
      'anesthesia_consultation': ['anesthesia_consultations'],
      'anesthesia_consult': ['anesthesia_consultations'],

      'pre_operative': ['pre_operative_assessments'],
      'preop_assessment': ['pre_operative_assessments'],
      'pre_op': ['pre_operative_assessments'],

      'post_operative': ['post_operative_reports'],
      'postop_report': ['post_operative_reports'],
      'post_op': ['post_operative_reports'],

      // ============= CARDIOLOGY =============
      'cardiology_consultation': ['cardiology_consultations', 'consultation_notes', 'clinical_scores', 'echocardiograms', 'electrocardiograms', 'cardiac_catheterizations', 'stress_tests', 'arrhythmia_monitoring', 'coronary_imaging'],
      'cardiology_consultation_notes': ['cardiology_consultations'],
      'cardiology_consult': ['cardiology_consultations', 'consultation_notes', 'clinical_scores', 'echocardiograms', 'electrocardiograms'],
      'cardiac_consultation': ['cardiology_consultations', 'consultation_notes', 'clinical_scores'],
      'cardiology_consultations': ['cardiology_consultations', 'consultation_notes', 'clinical_scores'],

      'cardiology_followup': ['cardiology_followup_reports', 'home_monitoring', 'medication_reconciliation', 'trend_analysis'],
      'cardiology_follow_up': ['cardiology_followup_reports', 'home_monitoring', 'medication_reconciliation', 'trend_analysis'],
      'cardiac_followup': ['cardiology_followup_reports', 'home_monitoring', 'medication_reconciliation', 'trend_analysis'],
      'hypertension_followup': ['cardiology_followup_reports', 'home_monitoring', 'medication_reconciliation', 'trend_analysis'],

      'cardiology_admission': ['cardiology_admission_notes'],
      'cardiology_admission_notes': ['cardiology_admission_notes'],
      'cardiac_admission': ['cardiology_admission_notes'],
      'cardiac_admission_notes': ['cardiology_admission_notes'],

      'ecg': ['ecg_reports', 'electrocardiograms'],
      'ekg': ['ecg_reports', 'electrocardiograms'],
      'electrocardiogram': ['ecg_reports', 'electrocardiograms'],
      'ecg_report': ['ecg_reports', 'electrocardiograms'],

      'echo': ['echo_reports', 'echocardiograms'],
      'echocardiogram': ['echo_reports', 'echocardiograms'],
      'echo_report': ['echo_reports', 'echocardiograms'],
      'cardiac_echo': ['echo_reports', 'echocardiograms'],

      'stress_test': ['stress_test_reports', 'stress_tests'],
      'cardiac_stress_test': ['stress_test_reports', 'stress_tests'],
      'treadmill_test': ['stress_test_reports', 'stress_tests'],

      'cardiac_cath': ['cardiac_catheterization_reports', 'cardiac_catheterizations'],
      'catheterization': ['cardiac_catheterization_reports', 'cardiac_catheterizations'],
      'angiogram': ['cardiac_catheterization_reports', 'cardiac_catheterizations'],
      'coronary_angiography': ['cardiac_catheterizations', 'coronary_imaging'],

      'cardiac_rehab': ['cardiac_rehabilitation_reports'],
      'cardiac_rehabilitation': ['cardiac_rehabilitation_reports'],

      'arrhythmia': ['arrhythmia_monitoring'],
      'holter_monitor': ['arrhythmia_monitoring'],
      'event_monitor': ['arrhythmia_monitoring'],

      'coronary_ct': ['coronary_imaging'],
      'cardiac_mri': ['coronary_imaging'],
      'calcium_score': ['coronary_imaging'],

      // ============= NEUROLOGY =============
      'neurology_consultation': ['neurology_consultations', 'neurological_exams'],
      'neurology_consult': ['neurology_consultations', 'neurological_exams'],
      'neuro_consultation': ['neurology_consultations', 'neurological_exams'],

      'neurology_progress': ['neurology_progress_notes', 'neurological_exams'],
      'neuro_progress_note': ['neurology_progress_notes', 'neurological_exams'],
      'neurology_follow_up': ['neurology_progress_notes', 'neurological_exams'],

      // Movement Disorders
      'movement_disorder': ['movement_disorder_assessments', 'parkinsonian_features', 'gait_analyses', 'motor_complications', 'non_motor_symptoms', 'parkinson_medications', 'deep_brain_stimulation'],
      'parkinson': ['movement_disorder_assessments', 'parkinsonian_features', 'gait_analyses', 'motor_complications', 'non_motor_symptoms', 'parkinson_medications', 'deep_brain_stimulation'],
      'parkinsons': ['movement_disorder_assessments', 'parkinsonian_features', 'gait_analyses', 'motor_complications', 'non_motor_symptoms', 'parkinson_medications', 'deep_brain_stimulation'],
      'parkinson_disease': ['movement_disorder_assessments', 'parkinsonian_features', 'gait_analyses', 'motor_complications', 'non_motor_symptoms', 'parkinson_medications', 'deep_brain_stimulation'],
      'pd_assessment': ['movement_disorder_assessments', 'parkinsonian_features', 'gait_analyses', 'motor_complications', 'non_motor_symptoms', 'parkinson_medications'],
      'essential_tremor': ['movement_disorder_assessments', 'neurological_exams'],
      'dystonia': ['movement_disorder_assessments', 'neurological_exams'],
      'huntington': ['movement_disorder_assessments', 'neurological_exams'],

      // Epilepsy
      'epilepsy': ['epilepsy_assessments', 'neurological_exams'],
      'epilepsy_consultation': ['epilepsy_assessments', 'neurological_exams'],
      'seizure_disorder': ['epilepsy_assessments', 'neurological_exams'],

      // Headache
      'headache': ['headache_assessments', 'neurological_exams'],
      'headache_consultation': ['headache_assessments', 'neurological_exams'],
      'migraine': ['headache_assessments', 'neurological_exams'],

      // Multiple Sclerosis
      'multiple_sclerosis': ['multiple_sclerosis_assessments', 'neurological_exams'],
      'ms_consultation': ['multiple_sclerosis_assessments', 'neurological_exams'],
      'ms_follow_up': ['multiple_sclerosis_assessments', 'neurological_exams'],

      // Stroke
      'stroke': ['stroke_assessments', 'neurological_exams'],
      'stroke_consultation': ['stroke_assessments', 'neurological_exams'],
      'cva': ['stroke_assessments', 'neurological_exams'],
      'tia': ['stroke_assessments', 'neurological_exams'],

      // Dementia
      'dementia': ['dementia_assessments', 'neurological_exams'],
      'dementia_evaluation': ['dementia_assessments', 'neurological_exams'],
      'alzheimer': ['dementia_assessments', 'neurological_exams'],
      'memory_disorder': ['dementia_assessments', 'neurological_exams'],

      // Neuropathy
      'neuropathy': ['peripheral_neuropathy', 'neurological_exams'],
      'peripheral_neuropathy': ['peripheral_neuropathy', 'neurological_exams'],
      'diabetic_neuropathy': ['peripheral_neuropathy', 'neurological_exams'],

      // Neuromuscular
      'neuromuscular': ['neuromuscular_disorders', 'neurological_exams'],
      'als': ['neuromuscular_disorders', 'neurological_exams'],
      'myasthenia_gravis': ['neuromuscular_disorders', 'neurological_exams'],
      'muscular_dystrophy': ['neuromuscular_disorders', 'neurological_exams'],

      'eeg': ['eeg_reports'],
      'eeg_report': ['eeg_reports'],
      'electroencephalogram': ['eeg_reports'],

      'emg': ['emg_reports'],
      'emg_report': ['emg_reports'],
      'electromyography': ['emg_reports'],
      'nerve_conduction': ['emg_reports'],

      'neuropsych': ['neuropsychological_assessments'],
      'neuropsychological': ['neuropsychological_assessments'],
      'cognitive_assessment': ['cognitive_evaluations'],

      // ============= PSYCHIATRY & MENTAL HEALTH =============
      'psychiatric_evaluation': ['psychiatric_evaluations', 'psychiatric_histories', 'mental_status_exams', 'suicide_risk_assessments', 'psychiatric_assessment_scales', 'substance_use_assessments', 'psychotropic_medications', 'psychiatric_treatment_plans', 'psychosocial_assessments', 'homicide_risk_assessments', 'biopsychosocial_formulations', 'diagnostic_impressions', 'treatment_goals', 'care_coordination', 'psychiatric_reviews', 'functional_assessments'],
      'psych_eval': ['psychiatric_evaluations', 'psychiatric_histories', 'mental_status_exams', 'suicide_risk_assessments', 'psychiatric_assessment_scales', 'substance_use_assessments', 'psychotropic_medications', 'psychiatric_treatment_plans', 'psychosocial_assessments', 'homicide_risk_assessments', 'biopsychosocial_formulations', 'diagnostic_impressions', 'treatment_goals', 'care_coordination', 'psychiatric_reviews', 'functional_assessments'],
      'mental_health_evaluation': ['psychiatric_evaluations', 'psychiatric_histories', 'mental_status_exams', 'suicide_risk_assessments', 'psychiatric_assessment_scales', 'substance_use_assessments', 'psychotropic_medications', 'psychiatric_treatment_plans', 'psychosocial_assessments', 'homicide_risk_assessments', 'biopsychosocial_formulations', 'diagnostic_impressions', 'treatment_goals', 'care_coordination', 'psychiatric_reviews', 'functional_assessments'],

      'psychiatric_progress': ['psychiatric_progress_notes', 'mental_status_exams', 'psychiatric_assessment_scales', 'psychotropic_medications', 'psychiatric_reviews', 'functional_assessments', 'treatment_goals'],
      'psych_progress_note': ['psychiatric_progress_notes', 'mental_status_exams', 'psychiatric_assessment_scales', 'psychotropic_medications', 'psychiatric_reviews', 'functional_assessments', 'treatment_goals'],

      'therapy_note': ['therapy_session_notes'],
      'therapy_session': ['therapy_session_notes'],
      'psychotherapy_note': ['therapy_session_notes'],

      'mental_health_assessment': ['mental_health_assessments'],
      'psychological_assessment': ['mental_health_assessments'],

      'psychiatric_discharge': ['psychiatric_discharge_summaries'],
      'psych_discharge': ['psychiatric_discharge_summaries'],

      // ============= PEDIATRICS =============
      'pediatric_visit': ['pediatric_visits', 'growth_parameters', 'developmental_milestones', 'pediatric_screenings', 'immunization_records', 'pediatric_behavioral_assessments'],
      'pediatric_visits': ['pediatric_visits', 'growth_parameters', 'developmental_milestones', 'pediatric_screenings', 'immunization_records', 'pediatric_behavioral_assessments'],
      'pediatric_note': ['pediatric_visits', 'growth_parameters', 'developmental_milestones', 'pediatric_screenings', 'immunization_records', 'pediatric_behavioral_assessments'],
      'peds_visit': ['pediatric_visits', 'growth_parameters', 'developmental_milestones', 'pediatric_screenings', 'immunization_records', 'pediatric_behavioral_assessments'],

      'well_child': ['well_child_examinations', 'birth_histories', 'growth_parameters', 'developmental_milestones', 'pediatric_screenings', 'immunization_records', 'school_performance', 'pediatric_nutrition', 'anticipatory_guidance', 'pediatric_behavioral_assessments', 'parental_concerns', 'well_child_summaries', 'early_childhood_development', 'adhd_assessments'],
      'well_child_exam': ['well_child_examinations', 'birth_histories', 'growth_parameters', 'developmental_milestones', 'pediatric_screenings', 'immunization_records', 'school_performance', 'pediatric_nutrition', 'anticipatory_guidance', 'pediatric_behavioral_assessments', 'parental_concerns', 'well_child_summaries', 'early_childhood_development', 'adhd_assessments'],
      'well_baby': ['well_child_examinations', 'birth_histories', 'growth_parameters', 'developmental_milestones', 'pediatric_screenings', 'immunization_records', 'pediatric_nutrition', 'anticipatory_guidance', 'parental_concerns', 'well_child_summaries', 'early_childhood_development'],

      'newborn_screening': ['newborn_screening_results'],
      'newborn_screen': ['newborn_screening_results'],

      'growth_chart': ['pediatric_growth_charts'],
      'growth_charts': ['pediatric_growth_charts'],
      'pediatric_growth': ['pediatric_growth_charts'],

      'developmental_assessment': ['developmental_assessments'],
      'developmental_milestone': ['developmental_assessments'],

      'apgar': ['apgar_scores'],
      'apgar_score': ['apgar_scores'],

      'pediatric_vaccination': ['pediatric_vaccination_records'],
      'childhood_immunization': ['pediatric_vaccination_records'],

      // ============= OBSTETRICS & GYNECOLOGY =============
      'prenatal_visits': ['prenatal_visits', 'maternal_weight_monitoring', 'fetal_assessments', 'pregnancy_symptoms', 'prenatal_education', 'pregnancy_risk_assessments', 'psychosocial_assessments', 'pregnancy_immunizations'],
      'prenatal_visits': ['prenatal_visits', 'maternal_weight_monitoring', 'fetal_assessments', 'pregnancy_symptoms', 'prenatal_education', 'pregnancy_risk_assessments', 'psychosocial_assessments', 'pregnancy_immunizations'],
      'prenatal_care': ['prenatal_visits', 'maternal_weight_monitoring', 'fetal_assessments', 'pregnancy_symptoms', 'prenatal_education', 'pregnancy_risk_assessments', 'psychosocial_assessments', 'pregnancy_immunizations'],
      'antenatal': ['prenatal_visits', 'maternal_weight_monitoring', 'fetal_assessments', 'pregnancy_symptoms', 'prenatal_education', 'pregnancy_risk_assessments', 'psychosocial_assessments', 'pregnancy_immunizations'],
      'routine_prenatal': ['prenatal_visits', 'maternal_weight_monitoring', 'fetal_assessments', 'pregnancy_symptoms', 'prenatal_education', 'pregnancy_immunizations'],
      'ob_visit': ['prenatal_visits', 'maternal_weight_monitoring', 'fetal_assessments', 'pregnancy_symptoms', 'prenatal_education'],
      'obstetric_visit': ['prenatal_visits', 'maternal_weight_monitoring', 'fetal_assessments', 'pregnancy_symptoms', 'prenatal_education'],

      'labor_delivery': ['labor_delivery_records', 'contraction_monitoring', 'cervical_assessments'],
      'delivery_record': ['labor_delivery_records', 'birth_plans'],
      'birth_record': ['labor_delivery_records', 'birth_plans'],
      'delivery_note': ['labor_delivery_records', 'birth_plans'],
      'labor_and_delivery': ['labor_delivery_records', 'contraction_monitoring', 'cervical_assessments'],

      'postpartum': ['postpartum_notes', 'postpartum_planning'],
      'postpartum_note': ['postpartum_notes', 'postpartum_planning'],
      'postnatal': ['postpartum_notes', 'postpartum_planning'],
      'postpartum_visit': ['postpartum_notes', 'postpartum_planning', 'psychosocial_assessments'],

      'ob_ultrasound': ['obstetric_ultrasound_reports', 'fetal_assessments'],
      'prenatal_ultrasound': ['obstetric_ultrasound_reports', 'fetal_assessments'],
      'fetal_ultrasound': ['ultrasound_ob_reports', 'fetal_assessments'],

      'amniocentesis': ['amniocentesis_reports'],
      'amnio': ['amniocentesis_reports'],

      'gynecology': ['gynecology_consultations'],
      'gyn_consultation': ['gynecology_consultations'],
      'gynecology_consultation': ['gynecology_consultations'],

      'maternal_fetal': ['maternal_fetal_reports', 'pregnancy_risk_assessments'],
      'high_risk_ob': ['maternal_fetal_reports', 'pregnancy_risk_assessments'],
      'high_risk_pregnancy': ['maternal_fetal_reports', 'pregnancy_risk_assessments', 'prenatal_visits'],

      'prenatal_testing': ['prenatal_testing_reports'],
      'prenatal_test': ['prenatal_testing_reports'],

      'obstetric_history': ['obstetric_histories', 'current_pregnancies'],
      'pregnancy_history': ['obstetric_histories', 'current_pregnancies'],

      'birth_plan': ['birth_plans'],
      'birth_preferences': ['birth_plans'],

      'pregnancy_complications': ['pregnancy_risk_assessments', 'maternal_fetal_reports'],

      // ============= ONCOLOGY =============
      'oncology_consultation': ['oncology_consultations'],
      'oncology_consult': ['oncology_consultations'],
      'cancer_consultation': ['oncology_consultations'],

      'oncology_followup': ['oncology_followup_reports'],
      'oncology_follow_up': ['oncology_followup_reports'],

      'chemotherapy': ['chemotherapy_records', 'chemotherapy_regimens'],
      'chemo': ['chemotherapy_records', 'chemotherapy_regimens'],
      'chemotherapy_record': ['chemotherapy_records', 'chemotherapy_regimens'],

      'radiation_therapy': ['radiation_therapy_records', 'radiation_oncology'],
      'radiation': ['radiation_therapy_records', 'radiation_oncology'],
      'radiotherapy': ['radiation_therapy_records', 'radiation_oncology'],

      'tumor_board': ['tumor_board_notes'],
      'tumor_board_note': ['tumor_board_notes'],

      'tumor_markers': ['tumor_marker_panels', 'tumor_markers'],
      'tumor_marker': ['tumor_marker_panels', 'tumor_markers'],
      'cancer_markers': ['tumor_marker_panels', 'tumor_markers'],

      'oncology_treatment': ['oncology_treatment_plans', 'treatment_summaries', 'surgical_oncology', 'radiation_oncology', 'endocrine_therapy', 'chemotherapy_regimens'],
      'cancer_treatment_plan': ['oncology_treatment_plans', 'treatment_summaries', 'surgical_oncology', 'radiation_oncology', 'endocrine_therapy', 'chemotherapy_regimens'],

      'oncology_treatment_summary': ['treatment_summaries', 'surgical_oncology', 'radiation_oncology', 'endocrine_therapy', 'survivorship_care_plans', 'cancer_related_side_effects', 'prognostic_factors', 'integrative_oncology'],
      'cancer_survivorship': ['survivorship_care_plans', 'cancer_related_side_effects', 'psychosocial_oncology', 'integrative_oncology'],
      'palliative_oncology': ['palliative_care', 'psychosocial_oncology'],
      'oncologic_emergency': ['oncologic_emergencies'],
      'genetic_cancer': ['genetic_oncology'],
      'cancer_genetics': ['genetic_oncology'],
      'cancer_diagnosis': ['cancer_diagnoses'],

      // ============= ENDOCRINOLOGY =============
      'endocrinology_consultation': ['endocrinology_consultations', 'thyroid_function_tests', 'adrenal_function_tests', 'pituitary_function_tests', 'metabolic_panels', 'diabetes_management', 'osteoporosis_assessments'],
      'endocrine_consult': ['endocrinology_consultations', 'thyroid_function_tests', 'adrenal_function_tests'],
      'endo_consultation': ['endocrinology_consultations'],

      'diabetes_management': ['diabetes_management_notes', 'diabetes_management'],
      'diabetes_note': ['diabetes_management_notes', 'diabetes_management'],
      'diabetic_management': ['diabetes_management_notes', 'diabetes_management'],
      'diabetes_management_notes': ['diabetes_management', 'insulin_pump_settings', 'cgm_data', 'insulin_regimens', 'diabetes_education', 'hypoglycemia_management', 'endocrine_lab_results', 'preconception_counseling', 'diabetes_quality_metrics'],

      'hormone_panel': ['hormone_panels', 'adrenal_function_tests', 'pituitary_function_tests'],
      'hormone_test': ['hormone_panels'],
      'endocrine_panel': ['hormone_panels', 'metabolic_panels'],

      'thyroid_evaluation': ['thyroid_evaluations', 'thyroid_function_tests'],
      'thyroid_test': ['thyroid_evaluations', 'thyroid_function_tests'],
      'thyroid_function': ['thyroid_evaluations', 'thyroid_function_tests'],
      'thyroid_ultrasound': ['thyroid_function_tests'],

      'hormone_therapy': ['hormone_therapy_records'],
      'hrt': ['hormone_therapy_records'],

      'adrenal_test': ['adrenal_function_tests'],
      'cortisol_test': ['adrenal_function_tests'],
      'dexamethasone_suppression': ['adrenal_function_tests'],

      'pituitary_assessment': ['pituitary_function_tests'],
      'growth_hormone': ['pituitary_function_tests'],
      'prolactin_test': ['pituitary_function_tests'],

      'metabolic_syndrome': ['metabolic_panels'],
      'lipid_panel': ['metabolic_panels'],
      'glucose_tolerance': ['metabolic_panels'],

      'bone_density': ['osteoporosis_assessments'],
      'dexa_endocrine': ['osteoporosis_assessments'],
      'frax_score': ['osteoporosis_assessments'],

      // ============= GASTROENTEROLOGY =============
      'gastroenterology_consultation': ['gastroenterology_consultations'],
      'gi_consultation': ['gastroenterology_consultations'],
      'gi_consult': ['gastroenterology_consultations'],

      'colonoscopy': ['colonoscopy_reports'],
      'colonoscopy_report': ['colonoscopy_reports'],

      'endoscopy': ['endoscopy_reports'],
      'upper_endoscopy': ['endoscopy_reports'],
      'egd': ['endoscopy_reports'],

      'liver_function': ['liver_function_assessments'],
      'hepatic_panel': ['liver_function_assessments'],

      'inflammatory_bowel': ['inflammatory_bowel_reports'],
      'ibd': ['inflammatory_bowel_reports'],
      'crohns': ['inflammatory_bowel_reports'],
      'ulcerative_colitis': ['inflammatory_bowel_reports'],
      'inflammatory_bowel_reports': ['ibd_assessments', 'disease_activity_scores', 'endoscopy_findings', 'ibd_biomarkers', 'biologic_therapy', 'extraintestinal_manifestations', 'nutritional_assessments', 'ibd_surgical_planning', 'flare_management', 'cancer_surveillance'],

      // ============= PULMONOLOGY =============
      'pulmonology_consultation': ['pulmonology_consultations', 'pulmonary_function_tests', 'asthma_assessments', 'asthma_action_plans', 'respiratory_medications', 'allergy_assessments', 'environmental_exposures', 'copd_assessments', 'sleep_studies', 'pulmonary_imaging', 'respiratory_infections', 'pulmonary_rehabilitation', 'respiratory_devices'],
      'pulm_consultation': ['pulmonology_consultations', 'pulmonary_function_tests', 'asthma_assessments', 'asthma_action_plans', 'respiratory_medications', 'allergy_assessments', 'environmental_exposures', 'copd_assessments', 'sleep_studies', 'pulmonary_imaging', 'respiratory_infections', 'pulmonary_rehabilitation', 'respiratory_devices'],
      'lung_consultation': ['pulmonology_consultations', 'pulmonary_function_tests', 'asthma_assessments', 'asthma_action_plans', 'respiratory_medications', 'allergy_assessments', 'environmental_exposures', 'copd_assessments', 'sleep_studies', 'pulmonary_imaging', 'respiratory_infections', 'pulmonary_rehabilitation', 'respiratory_devices'],
      'respiratory_consultation': ['pulmonology_consultations', 'pulmonary_function_tests', 'asthma_assessments', 'asthma_action_plans', 'respiratory_medications', 'allergy_assessments', 'environmental_exposures', 'copd_assessments', 'sleep_studies', 'pulmonary_imaging', 'respiratory_infections', 'pulmonary_rehabilitation', 'respiratory_devices'],

      'pulmonary_function': ['pulmonary_function_tests'],
      'pft': ['pulmonary_function_tests'],
      'spirometry': ['pulmonary_function_tests'],

      'sleep_study': ['sleep_study_reports', 'sleep_studies'],
      'polysomnography': ['sleep_study_reports', 'sleep_studies'],
      'sleep_test': ['sleep_study_reports', 'sleep_studies'],

      'asthma_management': ['asthma_management_notes', 'asthma_assessments', 'asthma_action_plans', 'respiratory_medications', 'allergy_assessments', 'environmental_exposures'],
      'asthma_note': ['asthma_management_notes', 'asthma_assessments', 'asthma_action_plans', 'respiratory_medications', 'allergy_assessments', 'environmental_exposures'],
      'asthma_followup': ['asthma_management_notes', 'asthma_assessments', 'asthma_action_plans', 'respiratory_medications', 'allergy_assessments', 'environmental_exposures', 'pulmonary_function_tests'],

      'copd_assessments': ['copd_assessments', 'pulmonary_function_tests', 'respiratory_medications', 'pulmonary_rehabilitation'],
      'copd': ['copd_assessments', 'pulmonary_function_tests', 'respiratory_medications', 'pulmonary_rehabilitation'],
      'copd_management': ['copd_assessments', 'pulmonary_function_tests', 'respiratory_medications', 'pulmonary_rehabilitation', 'respiratory_devices'],

      'pulmonary_rehab': ['pulmonary_rehabilitation_notes', 'pulmonary_rehabilitation'],
      'pulmonary_rehabilitation': ['pulmonary_rehabilitation_notes', 'pulmonary_rehabilitation'],

      // ============= NEPHROLOGY =============
      'nephrology_consultation': ['nephrology_consultations', 'ckd_assessments', 'proteinuria_assessments', 'dialysis_planning', 'transplant_evaluations', 'mineral_bone_disease', 'renal_anemia', 'fluid_electrolyte_management', 'renal_nutrition', 'medication_renal_dosing'],
      'nephro_consultation': ['nephrology_consultations', 'ckd_assessments', 'proteinuria_assessments', 'dialysis_planning', 'transplant_evaluations', 'mineral_bone_disease', 'renal_anemia', 'fluid_electrolyte_management', 'renal_nutrition', 'medication_renal_dosing'],
      'renal_consultation': ['nephrology_consultations', 'ckd_assessments', 'proteinuria_assessments', 'dialysis_planning', 'transplant_evaluations', 'mineral_bone_disease', 'renal_anemia', 'fluid_electrolyte_management', 'renal_nutrition', 'medication_renal_dosing'],
      'ckd_consultation': ['nephrology_consultations', 'ckd_assessments', 'proteinuria_assessments', 'dialysis_planning', 'transplant_evaluations', 'mineral_bone_disease', 'renal_anemia', 'fluid_electrolyte_management', 'renal_nutrition', 'medication_renal_dosing'],
      'chronic_kidney_disease': ['nephrology_consultations', 'ckd_assessments', 'proteinuria_assessments', 'dialysis_planning', 'transplant_evaluations', 'mineral_bone_disease', 'renal_anemia', 'fluid_electrolyte_management', 'renal_nutrition', 'medication_renal_dosing'],

      'dialysis': ['dialysis_records', 'current_dialysis'],
      'dialysis_record': ['dialysis_records', 'current_dialysis'],
      'hemodialysis': ['dialysis_records', 'current_dialysis'],
      'peritoneal_dialysis': ['dialysis_records', 'current_dialysis'],

      'dialysis_run': ['dialysis_run_sheets'],
      'dialysis_flowsheet': ['dialysis_run_sheets'],

      'glomerulonephritis': ['glomerular_disease', 'nephrology_consultations'],
      'glomerular_disease': ['glomerular_disease', 'nephrology_consultations'],

      'aki': ['acute_kidney_injury', 'nephrology_consultations'],
      'acute_kidney_injury': ['acute_kidney_injury', 'nephrology_consultations'],
      'acute_renal_failure': ['acute_kidney_injury', 'nephrology_consultations'],

      'pkd': ['polycystic_kidney_disease', 'nephrology_consultations'],
      'polycystic_kidney': ['polycystic_kidney_disease', 'nephrology_consultations'],

      'diabetic_nephropathy': ['diabetic_nephropathy', 'nephrology_consultations'],
      'diabetic_kidney_disease': ['diabetic_nephropathy', 'nephrology_consultations'],

      'hypertensive_nephropathy': ['hypertensive_nephropathy', 'nephrology_consultations'],
      'hypertensive_kidney_disease': ['hypertensive_nephropathy', 'nephrology_consultations'],

      'kidney_function': ['kidney_function_reports'],
      'renal_function': ['kidney_function_reports'],
      'kidney_panel': ['kidney_function_reports'],

      'transplant_evaluations': ['transplant_evaluations'],
      'transplant_eval': ['transplant_evaluations'],

      // ============= RHEUMATOLOGY =============
      'rheumatology_consultation': ['rheumatology_consultations', 'rheumatologic_assessments', 'autoantibody_profiles', 'inflammatory_markers', 'connective_tissue_diseases', 'lupus_assessments', 'rheumatoid_arthritis_assessments', 'vasculitis_assessments', 'spondyloarthritis_assessments', 'myositis_assessments', 'sjogrens_syndrome_assessments', 'scleroderma_assessments', 'gout_assessments', 'rheumatologic_treatments', 'rheumatologic_monitoring'],
      'rheum_consultation': ['rheumatology_consultations', 'rheumatologic_assessments', 'autoantibody_profiles', 'inflammatory_markers', 'connective_tissue_diseases', 'lupus_assessments', 'rheumatoid_arthritis_assessments', 'vasculitis_assessments', 'spondyloarthritis_assessments', 'myositis_assessments', 'sjogrens_syndrome_assessments', 'scleroderma_assessments', 'gout_assessments', 'rheumatologic_treatments', 'rheumatologic_monitoring'],
      'rheumatology_followup': ['rheumatology_consultations', 'rheumatologic_assessments', 'autoantibody_profiles', 'inflammatory_markers', 'rheumatologic_treatments', 'rheumatologic_monitoring'],

      'arthritis_assessment': ['arthritis_assessments', 'rheumatoid_arthritis_assessments', 'gout_assessments', 'spondyloarthritis_assessments'],
      'arthritis': ['arthritis_assessments', 'rheumatoid_arthritis_assessments', 'gout_assessments', 'spondyloarthritis_assessments'],
      'rheumatoid_arthritis': ['rheumatoid_arthritis_assessments', 'autoantibody_profiles', 'inflammatory_markers', 'rheumatologic_treatments'],
      'ra_assessment': ['rheumatoid_arthritis_assessments', 'autoantibody_profiles', 'inflammatory_markers', 'rheumatologic_treatments'],

      'lupus_evaluation': ['lupus_assessments', 'autoantibody_profiles', 'inflammatory_markers', 'connective_tissue_diseases', 'rheumatologic_treatments'],
      'sle_assessment': ['lupus_assessments', 'autoantibody_profiles', 'inflammatory_markers', 'connective_tissue_diseases', 'rheumatologic_treatments'],
      'systemic_lupus': ['lupus_assessments', 'autoantibody_profiles', 'inflammatory_markers', 'connective_tissue_diseases', 'rheumatologic_treatments'],

      'autoimmune_evaluation': ['autoimmune_evaluations', 'autoantibody_profiles', 'inflammatory_markers', 'connective_tissue_diseases'],
      'autoimmune_panel': ['autoimmune_panels', 'autoantibody_profiles'],
      'autoimmune': ['autoimmune_evaluations', 'autoantibody_profiles', 'inflammatory_markers', 'connective_tissue_diseases'],

      'vasculitis_evaluation': ['vasculitis_assessments', 'autoantibody_profiles', 'inflammatory_markers'],
      'sjogrens_evaluation': ['sjogrens_syndrome_assessments', 'autoantibody_profiles'],
      'scleroderma_evaluation': ['scleroderma_assessments', 'autoantibody_profiles'],
      'myositis_evaluation': ['myositis_assessments', 'autoantibody_profiles', 'inflammatory_markers'],
      'gout_assessment': ['gout_assessments'],
      'spondyloarthritis': ['spondyloarthritis_assessments'],

      // ============= HEMATOLOGY =============
      'hematology_consultation': ['hematology_consultations'],
      'heme_consultation': ['hematology_consultations'],
      'blood_disorder': ['blood_disorder_reports'],

      'bone_marrow': ['bone_marrow_reports'],
      'bone_marrow_biopsy': ['bone_marrow_reports'],

      'coagulation': ['coagulation_studies'],
      'coagulation_study': ['coagulation_studies'],
      'bleeding_time': ['coagulation_studies'],

      // ============= ORTHOPEDICS =============
      'orthopedic_consultation': ['orthopedic_consultations'],
      'ortho_consultation': ['orthopedic_consultations'],
      'orthopedics': ['orthopedic_consultations'],

      'orthopedic_followup': ['orthopedic_followup_notes'],
      'ortho_followup': ['orthopedic_followup_notes'],

      'orthopedic_operative': ['orthopedic_operative_reports', 'injury_mechanisms', 'orthopedic_imaging', 'ligament_reconstructions', 'meniscus_repairs', 'articular_cartilage', 'tourniquet_data', 'post_op_testing', 'rehabilitation_protocols', 'return_to_sport', 'dvt_prophylaxis', 'neurovascular_exams', 'athlete_data'],
      'ortho_surgery': ['orthopedic_operative_reports', 'injury_mechanisms', 'orthopedic_imaging', 'ligament_reconstructions', 'meniscus_repairs', 'articular_cartilage', 'tourniquet_data', 'post_op_testing', 'rehabilitation_protocols', 'return_to_sport', 'dvt_prophylaxis', 'neurovascular_exams', 'athlete_data'],
      'orthopedic_post_op': ['orthopedic_operative_reports', 'injury_mechanisms', 'orthopedic_imaging', 'ligament_reconstructions', 'meniscus_repairs', 'articular_cartilage', 'tourniquet_data', 'post_op_testing', 'rehabilitation_protocols', 'return_to_sport', 'dvt_prophylaxis', 'neurovascular_exams', 'athlete_data'],
      'sports_medicine': ['injury_mechanisms', 'ligament_reconstructions', 'meniscus_repairs', 'articular_cartilage', 'rehabilitation_protocols', 'return_to_sport', 'athlete_data'],
      'acl_reconstruction': ['ligament_reconstructions', 'meniscus_repairs', 'rehabilitation_protocols', 'return_to_sport'],

      // ============= OPHTHALMOLOGY =============
      'ophthalmology': ['ophthalmology_examinations'],
      'eye_exam': ['ophthalmology_examinations'],
      'ophthalmology_exam': ['ophthalmology_examinations'],

      'visual_acuity': ['visual_acuity_reports'],
      'vision_test': ['visual_acuity_reports'],

      'retinal_exam': ['retinal_examinations'],
      'retina': ['retinal_examinations'],

      'glaucoma': ['glaucoma_assessments'],
      'glaucoma_assessment': ['glaucoma_assessments'],

      // ============= ENT =============
      'ent_consultation': ['ent_consultations'],
      'ent': ['ent_consultations'],
      'otolaryngology': ['ent_consultations'],

      'audiometry': ['audiometry_reports'],
      'hearing_test': ['audiometry_reports'],
      'audiogram': ['audiometry_reports'],

      'laryngoscopy': ['laryngoscopy_reports'],
      'throat_exam': ['laryngoscopy_reports'],

      // ============= DERMATOLOGY =============
      'dermatology_consultation': ['dermatology_consultations'],
      'derm_consultation': ['dermatology_consultations'],
      'dermatology': ['dermatology_consultations'],

      'skin_biopsy': ['skin_biopsy_reports'],
      'skin_lesion': ['skin_biopsy_reports'],

      'dermatology_procedure': ['dermatology_procedure_notes'],
      'skin_procedure': ['dermatology_procedure_notes'],

      // ============= UROLOGY =============
      'urology_consultation': ['urology_consultations'],
      'uro_consultation': ['urology_consultations'],
      'urology': ['urology_consultations'],

      'cystoscopy': ['cystoscopy_reports'],
      'bladder_exam': ['cystoscopy_reports'],

      'urodynamic': ['urodynamic_studies'],
      'urodynamics': ['urodynamic_studies'],

      // ============= GERIATRICS =============
      'geriatric_assessment': ['geriatric_assessments'],
      'geriatric': ['geriatric_assessments'],
      'elderly_assessment': ['geriatric_assessments'],
      'geriatric_assessments': ['functional_status', 'geriatric_cognitive_assessments', 'falls_risk_assessments', 'polypharmacy_reviews', 'geriatric_nutritional_assessments', 'mood_psychological_assessments', 'social_functional_assessments', 'frailty_assessments', 'geriatric_care_planning', 'caregiver_assessments'],

      'fall_risk': ['fall_risk_assessments'],
      'fall_assessment': ['fall_risk_assessments'],

      'cognitive_evaluation': ['cognitive_evaluations'],
      'dementia_assessment': ['cognitive_evaluations'],
      'memory_assessment': ['cognitive_evaluations'],

      'polypharmacy': ['polypharmacy'],
      'medication_review': ['polypharmacy_reviews'],

      // ============= PATHOLOGY =============
      'pathology_reports': ['pathology_reports'],
      'pathology': ['pathology_reports'],
      'path_report': ['pathology_reports'],

      'biopsy': ['biopsy_reports'],
      'biopsy_report': ['biopsy_reports'],

      'cytology': ['cytology_reports'],
      'cytology_report': ['cytology_reports'],
      'cytopathology': ['cytology_reports'],

      'autopsy': ['autopsy_reports'],
      'autopsy_report': ['autopsy_reports'],

      // ============= RADIOLOGY & IMAGING =============
      'mri': ['mri_reports'],
      'mri_report': ['mri_reports'],
      'magnetic_resonance': ['mri_reports'],

      'ct': ['imaging_reports', 'radiology_reports'],
      'ct_scan': ['imaging_reports', 'radiology_reports'],
      'cat_scan': ['imaging_reports', 'radiology_reports'],

      'xray': ['imaging_reports', 'radiology_reports'],
      'x-ray': ['imaging_reports', 'radiology_reports'],
      'radiograph': ['imaging_reports', 'radiology_reports'],

      'ultrasound': ['imaging_reports'],
      'sonography': ['imaging_reports'],
      'us': ['imaging_reports'],

      'mammogram': ['mammography_reports'],
      'mammography': ['mammography_reports'],

      'dexa': ['dexa_scan_reports'],
      'dexa_scan': ['dexa_scan_reports'],
      'bone_density': ['dexa_scan_reports'],

      'pet_scan': ['pet_scan_reports'],
      'pet': ['pet_scan_reports'],

      'bone_scan': ['bone_scan_reports'],
      'skeletal_survey': ['bone_scan_reports'],

      'interventional_radiology': ['interventional_radiology_notes'],
      'ir_procedure': ['interventional_radiology_notes'],

      // ============= LABORATORY & SPECIALIZED TESTS =============
      'microbiology': ['microbiology_culture_reports'],
      'culture': ['microbiology_culture_reports'],
      'culture_report': ['microbiology_culture_reports'],

      'genetic_testing': ['genetic_testing_reports'],
      'genetic_test': ['genetic_testing_reports'],
      'genomic': ['genetic_testing_reports'],

      'flow_cytometry': ['flow_cytometry_reports'],
      'flow_study': ['flow_cytometry_reports'],

      'toxicology': ['toxicology_reports'],
      'tox_screen': ['toxicology_reports'],
      'drug_screen': ['toxicology_reports'],

      'antibiogram': ['antibiogram_reports'],
      'susceptibility': ['antibiogram_reports'],

      'glucose_log': ['blood_glucose_logs'],
      'blood_sugar_log': ['blood_glucose_logs'],
      'glucose_diary': ['blood_glucose_logs'],

      // ============= DENTAL =============
      'dental_exam': ['dental_examination_reports'],
      'dental': ['dental_examination_reports'],
      'dental_examination': ['dental_examination_reports'],

      'oral_surgery': ['oral_surgery_reports'],
      'oral_surgeon': ['oral_surgery_reports'],

      'orthodontic': ['orthodontic_treatment_plans'],
      'orthodontics': ['orthodontic_treatment_plans'],

      'periodontal': ['periodontal_charts'],
      'perio_chart': ['periodontal_charts'],

      // ============= REHABILITATION =============
      'physical_therapy': ['physical_therapy_evaluations', 'physical_therapy_notes'],
      'pt_evaluation': ['physical_therapy_evaluations'],
      'pt_note': ['physical_therapy_notes'],

      'occupational_therapy': ['occupational_therapy_reports'],
      'ot_evaluation': ['occupational_therapy_reports'],
      'ot_note': ['occupational_therapy_reports'],

      'speech_therapy': ['speech_therapy_assessments'],
      'st_evaluation': ['speech_therapy_assessments'],
      'speech_assessment': ['speech_therapy_assessments'],

      'rehabilitation_progress': ['rehabilitation_progress_notes'],
      'rehab_progress': ['rehabilitation_progress_notes'],

      'cognitive_rehabilitation': ['cognitive_rehabilitation_reports'],
      'cognitive_rehab': ['cognitive_rehabilitation_reports'],

      // ============= NURSING & CLINICAL NOTES =============
      'nursing_assessment': ['nursing_assessments'],
      'nursing_note': ['nursing_notes'],
      'nurse_note': ['nursing_notes'],

      'progress_note': ['progress_notes'],
      'progress_notes': ['progress_notes'],
      'clinical_note': ['progress_notes'],

      'soap_note': ['soap_notes'],
      'soap': ['soap_notes'],

      'intake_output': ['intake_output_records'],
      'io_record': ['intake_output_records'],
      'fluid_balance': ['intake_output_records'],

      'medication_administration': ['medication_administration_records'],
      'mar': ['medication_administration_records'],

      'pain_assessment': ['pain_assessment_forms'],
      'pain_scale': ['pain_assessment_forms'],

      'wound_care': ['wound_care_documentation', 'wound_care_notes'],
      'wound_assessment': ['wound_care_documentation'],
      'wound_note': ['wound_care_notes'],

      'shift_handoff': ['shift_handoff_notes'],
      'handoff_note': ['shift_handoff_notes'],

      'nicu': ['nicu_progress_notes'],
      'nicu_note': ['nicu_progress_notes'],

      'monitoring': ['monitoring_reports'],
      'telemetry': ['monitoring_reports'],

      'therapy_progress': ['therapy_progress_notes'],

      // ============= EMERGENCY & CRITICAL CARE =============
      'code_blue': ['code_blue_summaries'],
      'resuscitation': ['code_blue_summaries'],

      'rapid_response': ['rapid_response_summaries'],
      'rrt': ['rapid_response_summaries'],

      'ems': ['ems_run_reports'],
      'ems_report': ['ems_run_reports'],
      'ambulance': ['ems_run_reports'],

      'trauma': ['trauma_flow_sheets'],
      'trauma_flowsheet': ['trauma_flow_sheets'],

      'poison_control': ['poison_control_reports'],
      'poisoning': ['poison_control_reports'],

      // ============= ADMINISTRATIVE & LEGAL =============
      'insurance_form': ['insurance_forms'],
      'insurance': ['insurance_forms'],

      'disability': ['disability_evaluations'],
      'disability_evaluation': ['disability_evaluations'],

      'workers_comp': ['workers_comp_evaluations'],
      'work_injury': ['workers_comp_evaluations'],

      'fitness_for_duty': ['fitness_for_duty_evaluations'],
      'fit_for_duty': ['fitness_for_duty_evaluations'],

      'dnr': ['dnr_orders'],
      'dnr_order': ['dnr_orders'],
      'do_not_resuscitate': ['dnr_orders'],

      'advance_directive': ['goals_of_care_discussions'],
      'advanced_directive': ['goals_of_care_discussions'],

      'medical_power_of_attorney': ['medical_power_of_attorney'],
      'mpoa': ['medical_power_of_attorney'],

      'prior_authorization': ['prior_authorization_forms'],
      'prior_auth': ['prior_authorization_forms'],

      'school_health': ['school_health_forms'],
      'school_form': ['school_health_forms'],

      'travel_health': ['travel_health_certificates'],
      'travel_certificate': ['travel_health_certificates'],

      'medical_certificate': ['medical_certificates'],
      'sick_note': ['medical_certificates'],

      'medical_reconciliation': ['medical_reconciliation_forms'],
      'med_rec': ['medical_reconciliation_forms'],

      // ============= PATIENT EDUCATION & SOCIAL =============
      'patient_education': ['patient_education_records'],
      'education_record': ['patient_education_records'],

      'care_coordination': ['care_coordination_notes'],
      'case_management': ['case_management'],

      'social_work': ['social_work_notes'],
      'social_work_note': ['social_work_notes'],
      'sw_note': ['social_work_notes'],

      'nutrition_assessment': ['nutritional_assessment'],
      'dietary_assessment': ['nutritional_assessment'],
      'nutrition': ['nutritional_assessment'],

      'pain_management': ['pain_management_notes'],
      'pain_clinic': ['pain_management_notes'],

      'malnutrition_risk': ['malnutrition_risk_assessment'],
      'malnutrition_screening': ['malnutrition_risk_assessment'],

      'home_health': ['home_health_notes'],
      'home_care': ['home_health_notes'],

      'hospice': ['hospice_notes'],
      'hospice_note': ['hospice_notes'],
      'palliative': ['hospice_notes'],

      // ============= TELEMEDICINE & SECOND OPINIONS =============
      'telemedicine': ['telemedicine_encounters'],
      'telehealth': ['telemedicine_encounters'],
      'virtual_visit': ['telemedicine_encounters'],

      'second_opinion': ['second_opinion_reports'],
      'expert_opinion': ['second_opinion_reports'],

      'case_summary': ['case_summaries'],
      'case_presentation': ['case_summaries'],

      // ============= RESEARCH & CLINICAL TRIALS =============
      'clinical_trial': ['clinical_trial_documents'],
      'research_study': ['clinical_trial_documents'],

      'research_consent': ['research_consent_forms'],
      'study_consent': ['research_consent_forms'],

      // ============= ADDITIONAL CORE MEDICAL (AI Extraction Fields) =============
      'medical_history': ['past_medical_history'],  // Deprecated - use past_medical_history
      'past_medical_history': ['past_medical_history'],
      'pmh': ['past_medical_history'],

      'surgical_history': ['surgical_history'],
      'past_surgical_history': ['surgical_history'],
      'psh': ['surgical_history'],

      'family_history': ['family_history'],
      'fh': ['family_history'],
      'family_medical_history': ['family_history'],

      'social_history': ['social_history'],
      'sh': ['social_history'],
      'lifestyle': ['social_history'],

      'chief_complaint': ['chief_complaints'],
      'chief_complaints': ['chief_complaints'],
      'cc': ['chief_complaints'],
      'presenting_complaint': ['chief_complaints'],

      'history_present_illness': ['history_present_illness'],
      'hpi': ['history_present_illness'],
      'present_illness': ['history_present_illness'],

      'physical_examinations': ['physical_examinations'],
      'physical_exam': ['physical_examinations'],
      'pe': ['physical_examinations'],

      'assessment_plan': ['assessment_plans'],
      'assessment_and_plan': ['assessment_plans'],
      'a&p': ['assessment_plans'],
      'ap': ['assessment_plans'],

      'additional_notes': ['additional_notes'],
      'clinical_notes': ['additional_notes'],
      'notes': ['additional_notes'],

      'risk_factors': ['risk_factors'],
      'risk_assessment': ['risk_factors'],

      'follow_up': ['follow_up_appointments'],
      'followup': ['follow_up_appointments'],
      'follow_up_appointment': ['follow_up_appointments'],
      'return_visit': ['follow_up_appointments'],

      'recommendations': ['recommendations'],
      'clinical_recommendations': ['recommendations'],
      'treatment_recommendations': ['recommendations'],

      'referral': ['referrals'],
      'referrals': ['referrals'],
      'specialty_referral': ['referrals'],

      'medical_alert': ['medical_alerts'],
      'alerts': ['medical_alerts'],
      'clinical_alert': ['medical_alerts'],

      'appointment': ['appointments'],
      'appointments': ['appointments'],
      'scheduled_visit': ['appointments'],

      'abnormal_result': ['abnormal_results'],
      'critical_result': ['abnormal_results'],
      'abnormal_finding': ['abnormal_results'],

      'admission_assessment': ['admission_assessments'],
      'intake_assessment': ['admission_assessments'],

      // ============= GENERIC FALLBACKS =============
      'report': ['additional_notes'],
      'note': ['additional_notes'],
      'record': ['additional_notes'],
      'form': ['additional_notes'],
      'document': ['additional_notes'],

      // ============= NEW SPECIALTIES (2025) =============

      // Family Medicine
      'family_medicine': ['family_medicine_visits', 'preventive_screenings', 'immunization_records', 'chronic_disease_management', 'mental_health_screenings', 'social_determinants_health'],
      'family_medicine_visit': ['family_medicine_visits', 'preventive_screenings', 'immunization_records', 'chronic_disease_management', 'mental_health_screenings', 'social_determinants_health'],
      'primary_care': ['family_medicine_visits', 'preventive_screenings', 'immunization_records', 'chronic_disease_management'],
      'preventive_screening': ['preventive_screenings', 'screening_compliance'],
      'immunization_status': ['immunization_records'],
      'chronic_disease': ['chronic_disease_management'],
      'social_determinants': ['social_determinants_health'],

      // Physical Medicine & Rehabilitation (PMR)
      'pmr': ['pmr_evaluations', 'functional_assessments', 'gait_analyses', 'spasticity_assessments', 'emg_studies', 'orthotic_prescriptions'],
      'pmr_evaluation': ['pmr_evaluations', 'functional_assessments', 'gait_analyses'],
      'physical_medicine': ['pmr_evaluations', 'functional_assessments', 'gait_analyses'],
      'rehabilitation_medicine': ['pmr_evaluations', 'functional_assessments'],
      'functional_assessments': ['functional_assessments'],
      'gait_analysis': ['gait_analyses'],
      'spasticity': ['spasticity_assessments'],
      'emg_study': ['emg_studies'],
      'orthotic': ['orthotic_prescriptions'],

      // Nuclear Medicine
      'nuclear_medicine': ['nuclear_medicine_reports', 'pet_scans', 'bone_scans', 'thyroid_scans', 'cardiac_perfusion_scans', 'vq_scans'],
      'nuclear_medicine_report': ['nuclear_medicine_reports'],
      'pet_scan': ['pet_scans'],
      'pet': ['pet_scans'],
      'bone_scan': ['bone_scans'],
      'thyroid_scan': ['thyroid_scans'],
      'cardiac_perfusion': ['cardiac_perfusion_scans'],
      'myocardial_perfusion': ['cardiac_perfusion_scans'],
      'ventilation_perfusion': ['vq_scans'],
      'vq_scan': ['vq_scans'],

      // Plastic Surgery
      'plastic_surgery': ['plastic_surgery_consultations', 'preoperative_photography', 'skin_analyses', 'flap_assessments', 'implant_registry', 'aesthetic_goals'],
      'plastic_surgery_consultation': ['plastic_surgery_consultations', 'preoperative_photography', 'aesthetic_goals'],
      'cosmetic_surgery': ['plastic_surgery_consultations', 'preoperative_photography', 'aesthetic_goals'],
      'reconstructive_surgery': ['plastic_surgery_consultations', 'flap_assessments'],
      'preoperative_photography': ['preoperative_photography'],
      'skin_analysis': ['skin_analyses'],
      'flap_assessment': ['flap_assessments'],
      'implant_data': ['implant_registry'],
      'aesthetic_goal': ['aesthetic_goals'],

      // Thoracic Surgery
      'thoracic_surgery': ['thoracic_surgery_consultations', 'thoracic_pulmonary_function', 'thoracic_tumor_staging', 'mediastinoscopies', 'thoracic_bronchoscopies', 'vats_assessments'],
      'thoracic_surgery_consultation': ['thoracic_surgery_consultations', 'thoracic_pulmonary_function', 'thoracic_tumor_staging'],
      'lung_surgery': ['thoracic_surgery_consultations', 'thoracic_pulmonary_function'],
      'chest_surgery': ['thoracic_surgery_consultations'],
      'tumor_staging': ['thoracic_tumor_staging'],
      'mediastinoscopy': ['mediastinoscopies'],
      'thoracic_bronchoscopy': ['thoracic_bronchoscopies'],
      'vats': ['vats_assessments'],
      'vats_assessment': ['vats_assessments'],

      // Colorectal Surgery
      'colorectal_surgery': ['colorectal_surgery_consultations', 'colorectal_colonoscopies', 'anorectal_manometry', 'defecography_studies', 'stoma_assessments', 'colorectal_oncologic_markers'],
      'colorectal_surgery_consultation': ['colorectal_surgery_consultations', 'colorectal_colonoscopies'],
      'colorectal': ['colorectal_surgery_consultations'],
      'colon_surgery': ['colorectal_surgery_consultations'],
      'rectal_surgery': ['colorectal_surgery_consultations'],
      'anorectal_manometry': ['anorectal_manometry'],
      'defecography': ['defecography_studies'],
      'stoma_assessment': ['stoma_assessments'],
      'colorectal_markers': ['colorectal_oncologic_markers'],

      // Neurosurgery
      'neurosurgery': ['neurosurgery_consultations', 'functional_mri_studies', 'tractography_studies', 'intraoperative_monitoring', 'brain_tumor_characteristics', 'ventriculostomy_management'],
      'neurosurgery_consultation': ['neurosurgery_consultations', 'functional_mri_studies', 'tractography_studies'],
      'brain_surgery': ['neurosurgery_consultations', 'functional_mri_studies', 'intraoperative_monitoring'],
      'spine_surgery': ['neurosurgery_consultations', 'intraoperative_monitoring'],
      'functional_mri': ['functional_mri_studies'],
      'fmri': ['functional_mri_studies'],
      'tractography': ['tractography_studies'],
      'intraoperative_monitoring': ['intraoperative_monitoring'],
      'brain_tumor': ['brain_tumor_characteristics'],
      'ventriculostomy': ['ventriculostomy_management'],

      // Preventive Medicine
      'preventive_medicine': ['preventive_medicine_assessments', 'risk_calculators', 'screening_compliance', 'lifestyle_assessments', 'preventive_biomarkers', 'genomic_risk_assessment'],
      'preventive_medicine_assessments': ['preventive_medicine_assessments', 'risk_calculators', 'screening_compliance'],
      'preventive_care': ['preventive_medicine_assessments', 'screening_compliance'],
      'wellness_assessment': ['preventive_medicine_assessments', 'lifestyle_assessments'],
      'risk_calculator': ['risk_calculators'],
      'screening_compliance': ['screening_compliance'],
      'lifestyle_assessment': ['lifestyle_assessments'],
      'preventive_biomarkers': ['preventive_biomarkers'],
      'genomic_risk': ['genomic_risk_assessment'],

      // Medical Genetics
      'medical_genetics': ['genetics_consultations', 'pedigree_analyses', 'chromosomal_analyses', 'molecular_genetic_tests', 'variant_classifications', 'genetic_counseling_notes'],
      'genetics_consultation': ['genetics_consultations', 'pedigree_analyses'],
      'genetic_consultation': ['genetics_consultations', 'pedigree_analyses'],
      'genetic_testing': ['molecular_genetic_tests', 'variant_classifications'],
      'pedigree_analysis': ['pedigree_analyses'],
      'chromosomal_analysis': ['chromosomal_analyses'],
      'karyotype': ['chromosomal_analyses'],
      'molecular_testing': ['molecular_genetic_tests'],
      'variant_classification': ['variant_classifications'],
      'genetic_counseling': ['genetic_counseling_notes'],

      // Allergy & Immunology
      'allergy_immunology': ['allergy_skin_testing', 'specific_ige_tests', 'component_allergen_testing', 'immune_function_tests', 'challenge_tests'],
      'allergy_consultation': ['allergy_skin_testing'],
      'immunology_consultation': ['immune_function_tests'],
      'allergy_testing': ['allergy_skin_testing', 'specific_ige_tests', 'component_allergen_testing'],
      'skin_testing': ['allergy_skin_testing'],
      'specific_ige': ['specific_ige_tests'],
      'component_testing': ['component_allergen_testing'],
      'immune_function': ['immune_function_tests'],
      'challenge_test': ['challenge_tests'],
      'food_challenge': ['challenge_tests'],

      // Hematology
      'hematology': ['hematology_consultations', 'blood_smears', 'hemoglobinopathy_studies', 'coagulation_studies', 'bone_marrow_studies', 'transfusion_records'],
      'hematology_consultation': ['hematology_consultations', 'blood_smears', 'coagulation_studies'],
      'blood_disorder': ['hematology_consultations', 'blood_smears'],
      'blood_smear': ['blood_smears'],
      'hemoglobinopathy': ['hemoglobinopathy_studies'],
      'sickle_cell': ['hemoglobinopathy_studies'],
      'thalassemia': ['hemoglobinopathy_studies'],
      'coagulation_study': ['coagulation_studies'],
      'bone_marrow': ['bone_marrow_studies'],
      'bone_marrow_biopsy': ['bone_marrow_studies'],
      'transfusion': ['transfusion_records'],
      'blood_transfusion': ['transfusion_records']
    };
  }

  /**
   * Build reverse mappings for validation
   */
  buildReverseMappings() {
    const reverse = {};
    for (const [category, collections] of Object.entries(this.categoryMappings)) {
      for (const collection of collections) {
        if (!reverse[collection]) {
          reverse[collection] = [];
        }
        reverse[collection].push(category);
      }
    }
    return reverse;
  }

  /**
   * Map a document category to its appropriate collection(s)
   * @param {string} category - The document category
   * @returns {string[]} Array of target collection names
   */
  mapCategoryToCollections(category) {
    if (!category) {
      console.warn('No category provided, using default collection');
      return ['additional_notes'];
    }

    // Normalize category name
    const normalized = this.normalizeCategory(category);

    // Direct mapping
    if (this.categoryMappings[normalized]) {
      return this.categoryMappings[normalized];
    }

    // Try fuzzy matching
    const fuzzyMatch = this.fuzzyMatchCategory(normalized);
    if (fuzzyMatch) {
      return this.categoryMappings[fuzzyMatch];
    }

    // Try extracting collection name from category
    const extractedCollection = this.extractCollectionFromCategory(normalized);
    if (extractedCollection && this.validCollections.includes(extractedCollection)) {
      return [extractedCollection];
    }

    // Default fallback
    console.warn(`No mapping found for category: ${category}, using additional_notes`);
    return ['additional_notes'];
  }

  /**
   * Normalize category name for matching
   */
  normalizeCategory(category) {
    return category
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Fuzzy match category to find best match
   */
  fuzzyMatchCategory(normalized) {
    // Check for partial matches
    for (const mappedCategory of Object.keys(this.categoryMappings)) {
      if (normalized.includes(mappedCategory) || mappedCategory.includes(normalized)) {
        return mappedCategory;
      }
    }

    // Check for word matches
    const words = normalized.split('_');
    for (const mappedCategory of Object.keys(this.categoryMappings)) {
      const mappedWords = mappedCategory.split('_');
      const commonWords = words.filter(w => mappedWords.includes(w));
      if (commonWords.length >= Math.min(2, Math.min(words.length, mappedWords.length))) {
        return mappedCategory;
      }
    }

    return null;
  }

  /**
   * Extract collection name from category
   */
  extractCollectionFromCategory(category) {
    // Try direct collection name match
    if (this.validCollections.includes(category)) {
      return category;
    }

    // Try pluralizing
    const plural = category + 's';
    if (this.validCollections.includes(plural)) {
      return plural;
    }

    // Try singularizing
    const singular = category.replace(/s$/, '');
    if (this.validCollections.includes(singular)) {
      return singular;
    }

    // Try adding common suffixes
    const suffixes = ['_reports', '_records', '_notes', '_results', '_forms'];
    for (const suffix of suffixes) {
      const withSuffix = category + suffix;
      if (this.validCollections.includes(withSuffix)) {
        return withSuffix;
      }
    }

    return null;
  }

  /**
   * Get all categories that map to a specific collection
   */
  getCategoriesForCollection(collectionName) {
    return this.collectionToCategory[collectionName] || [];
  }

  /**
   * Validate if a collection name is valid
   */
  isValidCollection(collectionName) {
    return this.validCollections.includes(collectionName);
  }

  /**
   * Get statistics about mappings
   */
  getMappingStats() {
    const stats = {
      totalCategories: Object.keys(this.categoryMappings).length,
      totalCollections: this.validCollections.length,
      mappedCollections: new Set(),
      unmappedCollections: []
    };

    // Find all mapped collections
    for (const collections of Object.values(this.categoryMappings)) {
      for (const collection of collections) {
        stats.mappedCollections.add(collection);
      }
    }

    // Find unmapped collections
    for (const collection of this.validCollections) {
      if (!stats.mappedCollections.has(collection)) {
        stats.unmappedCollections.push(collection);
      }
    }

    stats.mappedCollections = stats.mappedCollections.size;

    return stats;
  }
}

// Export singleton instance
module.exports = new CategoryCollectionMapper();