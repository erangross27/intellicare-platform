/**
 * Medical Data Service
 * Handles storage and retrieval of medical data from separate collections
 * Prevents MongoDB 16MB document limit by distributing data across collections
 */

const { ObjectId } = require('mongodb');
const serviceProxyManager = require('./serviceProxyManager');
const medicalCollectionsService = require('./medicalCollectionsService');

class MedicalDataService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this._secureDataAccess = null;
    this._serviceAccountManager = null;
    this.existingCollections = new Set(); // Cache of collections that exist
    
    // Add method binding to ensure 'this' context is preserved
    this.storeMedicalData = this.storeMedicalData.bind(this);
    this.getMedicalData = this.getMedicalData.bind(this);
    this.listPatientMedicalCategories = this.listPatientMedicalCategories.bind(this);
    this.getAIClinicalInsights = this.getAIClinicalInsights.bind(this);
    this.storeExtractedMedicalData = this.storeExtractedMedicalData.bind(this);
    this.deleteMedicalData = this.deleteMedicalData.bind(this);
    
    // Build collection map from the single source of truth
    // This ensures consistency across all services and prevents duplicates
    this.collectionMap = {};
    
    // Generate collection map from medicalCollectionsService
    const allCollections = medicalCollectionsService.getAllCollections();
    allCollections.forEach(collection => {
      // Convert collection name to camelCase for count field
      // e.g., "discharge_summaries" -> "dischargeSummariesCount"
      const camelCase = collection
        .split('_')
        .map((word, i) => i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
      const countField = camelCase + 'Count';
      
      this.collectionMap[collection] = {
        collection: collection,
        countField: countField
      };
    });
    
    console.log(`✅ MedicalDataService initialized with ${Object.keys(this.collectionMap).length} unique collections`);
    
    // OLD COLLECTION MAP REMOVED - Using dynamic generation from medicalCollectionsService
    // This prevents duplicates and ensures consistency
    /*
      'consultation_notes': { 
        collection: 'consultation_notes',
        countField: 'consultationnotesCount'
      },
      'prescriptions': { 
        collection: 'prescriptions',
        countField: 'prescriptionsCount'
      },
      'lab_results': { 
        collection: 'lab_results',
        countField: 'labresultsCount'
      },
      'imaging_reports': { 
        collection: 'imaging_reports',
        countField: 'imagingreportsCount'
      },
      'discharge_summaries': { 
        collection: 'discharge_summaries',
        countField: 'dischargesummariesCount'
      },
      'vaccination_records': { 
        collection: 'vaccination_records',
        countField: 'vaccinationrecordsCount'
      },
      'referrals': { 
        collection: 'referrals',
        countField: 'referralCount'
      },
      'medical_certificate': { 
        collection: 'medical_certificates',
        countField: 'certificateCount'
      },
      'medical_procedures': { 
        collection: 'medical_procedures',
        countField: 'procedureCount'
      },
      'allergies': { 
        collection: 'allergies',
        countField: 'allergiesCount'
      },
      'medications': { 
        collection: 'medications',
        countField: 'medicationsCount'
      },
      'diagnoses': {
        collection: 'diagnoses',
        countField: 'diagnosesCount'
      },
      'vital_signs': {
        collection: 'vital_signs',
        countField: 'vitalSignsCount'
      },
      'abnormal_results': {
        collection: 'abnormal_results',
        countField: 'abnormalResultsCount'
      },
      'recommendations': {
        collection: 'recommendations',
        countField: 'recommendationsCount'
      },
      'follow_ups': {
        collection: 'follow_up_appointments',
        countField: 'followUpsCount'
      },
      'medical_alerts': {
        collection: 'medical_alerts',
        countField: 'medicalAlertsCount'
      },
      'appointments': { 
        collection: 'appointments',
        countField: 'appointmentsCount'
      },
      'referrals': { 
        collection: 'referrals',
        countField: 'referralsCount'
      },
      'medical_certificates': { 
        collection: 'medical_certificates',
        countField: 'medicalcertificatesCount'
      },
      'medical_procedures': { 
        collection: 'medical_procedures',
        countField: 'medicalproceduresCount'
      },
      'emergency_reports': { 
        collection: 'emergency_reports',
        countField: 'emergencyreportsCount'
      },
      'emergency_discharge_summaries': { 
        collection: 'emergency_discharge_summaries',
        countField: 'emergencydischargesummariesCount'
      },
      'hospital_admission_notes': { 
        collection: 'hospital_admission_notes',
        countField: 'hospitaladmissionnotesCount'
      },
      'hospital_discharge_summaries': { 
        collection: 'hospital_discharge_summaries',
        countField: 'hospitaldischargesummariesCount'
      },
      'hospital_transfer_notes': { 
        collection: 'hospital_transfer_notes',
        countField: 'hospitaltransfernotesCount'
      },
      'operative_reports': { 
        collection: 'operative_reports',
        countField: 'operativereportsCount'
      },
      'pre_operative_assessments': { 
        collection: 'pre_operative_assessments',
        countField: 'preoperativeassessmentsCount'
      },
      'post_operative_reports': { 
        collection: 'post_operative_reports',
        countField: 'postoperativereportsCount'
      },
      'anesthesia_records': { 
        collection: 'anesthesia_records',
        countField: 'anesthesiarecordsCount'
      },
      'surgical_consent_forms': { 
        collection: 'surgical_consent_forms',
        countField: 'surgicalconsentformsCount'
      },
      'cardiology_consultations': { 
        collection: 'cardiology_consultations',
        countField: 'cardiologyconsultationsCount'
      },
      'cardiology_followup_reports': { 
        collection: 'cardiology_followup_reports',
        countField: 'cardiologyfollowupreportsCount'
      },
      'cardiology_admission_notes': { 
        collection: 'cardiology_admission_notes',
        countField: 'cardiologyadmissionnotesCount'
      },
      'ecg_reports': { 
        collection: 'ecg_reports',
        countField: 'ecgreportsCount'
      },
      'echo_reports': { 
        collection: 'echo_reports',
        countField: 'echoreportsCount'
      },
      'cardiac_catheterization_reports': { 
        collection: 'cardiac_catheterization_reports',
        countField: 'cardiaccatheterizationreportsCount'
      },
      'stress_test_reports': { 
        collection: 'stress_test_reports',
        countField: 'stresstestreportsCount'
      },
      'neurology_consultations': { 
        collection: 'neurology_consultations',
        countField: 'neurologyconsultationsCount'
      },
      'neurology_progress_notes': { 
        collection: 'neurology_progress_notes',
        countField: 'neurologyprogressnotesCount'
      },
      'eeg_reports': { 
        collection: 'eeg_reports',
        countField: 'eegreportsCount'
      },
      'emg_reports': { 
        collection: 'emg_reports',
        countField: 'emgreportsCount'
      },
      'neuropsychological_assessments': { 
        collection: 'neuropsychological_assessments',
        countField: 'neuropsychologicalassessmentsCount'
      },
      'psychiatric_evaluations': { 
        collection: 'psychiatric_evaluations',
        countField: 'psychiatricevaluationsCount'
      },
      'psychiatric_progress_notes': { 
        collection: 'psychiatric_progress_notes',
        countField: 'psychiatricprogressnotesCount'
      },
      'psychiatric_discharge_summaries': { 
        collection: 'psychiatric_discharge_summaries',
        countField: 'psychiatricdischargesummariesCount'
      },
      'therapy_session_notes': { 
        collection: 'therapy_session_notes',
        countField: 'therapysessionnotesCount'
      },
      'mental_health_assessments': { 
        collection: 'mental_health_assessments',
        countField: 'mentalhealthassessmentsCount'
      },
      'pediatric_visits': { 
        collection: 'pediatric_visits',
        countField: 'pediatricvisitsCount'
      },
      'well_child_examinations': { 
        collection: 'well_child_examinations',
        countField: 'wellchildexaminationsCount'
      },
      'pediatric_growth_charts': { 
        collection: 'pediatric_growth_charts',
        countField: 'pediatricgrowthchartsCount'
      },
      'developmental_assessments': { 
        collection: 'developmental_assessments',
        countField: 'developmentalassessmentsCount'
      },
      'pediatric_vaccination_records': { 
        collection: 'pediatric_vaccination_records',
        countField: 'pediatricvaccinationrecordsCount'
      },
      'prenatal_visits': { 
        collection: 'prenatal_visits',
        countField: 'prenatalvisitsCount'
      },
      'labor_delivery_records': { 
        collection: 'labor_delivery_records',
        countField: 'labordeliveryrecordsCount'
      },
      'postpartum_notes': { 
        collection: 'postpartum_notes',
        countField: 'postpartumnotesCount'
      },
      'gynecology_consultations': { 
        collection: 'gynecology_consultations',
        countField: 'gynecologyconsultationsCount'
      },
      'maternal_fetal_reports': { 
        collection: 'maternal_fetal_reports',
        countField: 'maternalfetalreportsCount'
      },
      'ultrasound_ob_reports': { 
        collection: 'ultrasound_ob_reports',
        countField: 'ultrasoundobreportsCount'
      },
      'oncology_consultations': { 
        collection: 'oncology_consultations',
        countField: 'oncologyconsultationsCount'
      },
      'oncology_treatment_plans': { 
        collection: 'oncology_treatment_plans',
        countField: 'oncologytreatmentplansCount'
      },
      'chemotherapy_records': { 
        collection: 'chemotherapy_records',
        countField: 'chemotherapyrecordsCount'
      },
      'radiation_therapy_records': { 
        collection: 'radiation_therapy_records',
        countField: 'radiationtherapyrecordsCount'
      },
      'tumor_board_notes': { 
        collection: 'tumor_board_notes',
        countField: 'tumorboardnotesCount'
      },
      'oncology_followup_reports': { 
        collection: 'oncology_followup_reports',
        countField: 'oncologyfollowupreportsCount'
      },
      'endocrinology_consultations': { 
        collection: 'endocrinology_consultations',
        countField: 'endocrinologyconsultationsCount'
      },
      'diabetes_management_notes': { 
        collection: 'diabetes_management_notes',
        countField: 'diabetesmanagementnotesCount'
      },
      'thyroid_evaluations': { 
        collection: 'thyroid_evaluations',
        countField: 'thyroidevaluationsCount'
      },
      'hormone_therapy_records': { 
        collection: 'hormone_therapy_records',
        countField: 'hormonetherapyrecordsCount'
      },
      'gastroenterology_consultations': { 
        collection: 'gastroenterology_consultations',
        countField: 'gastroenterologyconsultationsCount'
      },
      'endoscopy_reports': { 
        collection: 'endoscopy_reports',
        countField: 'endoscopyreportsCount'
      },
      'colonoscopy_reports': { 
        collection: 'colonoscopy_reports',
        countField: 'colonoscopyreportsCount'
      },
      'liver_function_assessments': { 
        collection: 'liver_function_assessments',
        countField: 'liverfunctionassessmentsCount'
      },
      'inflammatory_bowel_reports': { 
        collection: 'inflammatory_bowel_reports',
        countField: 'inflammatorybowelreportsCount'
      },
      'pulmonology_consultations': { 
        collection: 'pulmonology_consultations',
        countField: 'pulmonologyconsultationsCount'
      },
      'pulmonary_function_tests': { 
        collection: 'pulmonary_function_tests',
        countField: 'pulmonaryfunctiontestsCount'
      },
      'sleep_study_reports': { 
        collection: 'sleep_study_reports',
        countField: 'sleepstudyreportsCount'
      },
      'asthma_management_notes': { 
        collection: 'asthma_management_notes',
        countField: 'asthmamanagementnotesCount'
      },
      'copd_assessments': { 
        collection: 'copd_assessments',
        countField: 'copdassessmentsCount'
      },
      'nephrology_consultations': { 
        collection: 'nephrology_consultations',
        countField: 'nephrologyconsultationsCount'
      },
      'dialysis_records': { 
        collection: 'dialysis_records',
        countField: 'dialysisrecordsCount'
      },
      'kidney_function_reports': { 
        collection: 'kidney_function_reports',
        countField: 'kidneyfunctionreportsCount'
      },
      'transplant_evaluations': { 
        collection: 'transplant_evaluations',
        countField: 'transplantevaluationsCount'
      },
      'rheumatology_consultations': { 
        collection: 'rheumatology_consultations',
        countField: 'rheumatologyconsultationsCount'
      },
      'arthritis_assessments': { 
        collection: 'arthritis_assessments',
        countField: 'arthritisassessmentsCount'
      },
      'autoimmune_evaluations': { 
        collection: 'autoimmune_evaluations',
        countField: 'autoimmuneevaluationsCount'
      },
      'hematology_consultations': { 
        collection: 'hematology_consultations',
        countField: 'hematologyconsultationsCount'
      },
      'blood_disorder_reports': { 
        collection: 'blood_disorder_reports',
        countField: 'blooddisorderreportsCount'
      },
      'coagulation_studies': { 
        collection: 'coagulation_studies',
        countField: 'coagulationstudiesCount'
      },
      'bone_marrow_reports': { 
        collection: 'bone_marrow_reports',
        countField: 'bonemarrowreportsCount'
      },
      'orthopedic_consultations': { 
        collection: 'orthopedic_consultations',
        countField: 'orthopedicconsultationsCount'
      },
      'orthopedic_operative_reports': { 
        collection: 'orthopedic_operative_reports',
        countField: 'orthopedicoperativereportsCount'
      },
      'orthopedic_followup_notes': { 
        collection: 'orthopedic_followup_notes',
        countField: 'orthopedicfollowupnotesCount'
      },
      'physical_therapy_notes': { 
        collection: 'physical_therapy_notes',
        countField: 'physicaltherapynotesCount'
      },
      'rehabilitation_progress_notes': { 
        collection: 'rehabilitation_progress_notes',
        countField: 'rehabilitationprogressnotesCount'
      },
      'ophthalmology_examinations': { 
        collection: 'ophthalmology_examinations',
        countField: 'ophthalmologyexaminationsCount'
      },
      'visual_acuity_reports': { 
        collection: 'visual_acuity_reports',
        countField: 'visualacuityreportsCount'
      },
      'retinal_examinations': { 
        collection: 'retinal_examinations',
        countField: 'retinalexaminationsCount'
      },
      'glaucoma_assessments': { 
        collection: 'glaucoma_assessments',
        countField: 'glaucomaassessmentsCount'
      },
      'ent_consultations': { 
        collection: 'ent_consultations',
        countField: 'entconsultationsCount'
      },
      'audiometry_reports': { 
        collection: 'audiometry_reports',
        countField: 'audiometryreportsCount'
      },
      'laryngoscopy_reports': { 
        collection: 'laryngoscopy_reports',
        countField: 'laryngoscopyreportsCount'
      },
      'dermatology_consultations': { 
        collection: 'dermatology_consultations',
        countField: 'dermatologyconsultationsCount'
      },
      'skin_biopsy_reports': { 
        collection: 'skin_biopsy_reports',
        countField: 'skinbiopsyreportsCount'
      },
      'dermatology_procedure_notes': { 
        collection: 'dermatology_procedure_notes',
        countField: 'dermatologyprocedurenotesCount'
      },
      'urology_consultations': { 
        collection: 'urology_consultations',
        countField: 'urologyconsultationsCount'
      },
      'urodynamic_studies': { 
        collection: 'urodynamic_studies',
        countField: 'urodynamicstudiesCount'
      },
      'cystoscopy_reports': { 
        collection: 'cystoscopy_reports',
        countField: 'cystoscopyreportsCount'
      },
      'geriatric_assessments': { 
        collection: 'geriatric_assessments',
        countField: 'geriatricassessmentsCount'
      },
      'cognitive_evaluations': { 
        collection: 'cognitive_evaluations',
        countField: 'cognitiveevaluationsCount'
      },
      'fall_risk_assessments': { 
        collection: 'fall_risk_assessments',
        countField: 'fallriskassessmentsCount'
      },
      'polypharmacy_reviews': { 
        collection: 'polypharmacy_reviews',
        countField: 'polypharmacyreviewsCount'
      },
      'pathology_reports': { 
        collection: 'pathology_reports',
        countField: 'pathologyreportsCount'
      },
      'biopsy_reports': { 
        collection: 'biopsy_reports',
        countField: 'biopsyreportsCount'
      },
      'cytology_reports': { 
        collection: 'cytology_reports',
        countField: 'cytologyreportsCount'
      },
      'autopsy_reports': { 
        collection: 'autopsy_reports',
        countField: 'autopsyreportsCount'
      },
      'radiology_reports': { 
        collection: 'radiology_reports',
        countField: 'radiologyreportsCount'
      },
      'interventional_radiology_notes': { 
        collection: 'interventional_radiology_notes',
        countField: 'interventionalradiologynotesCount'
      },
      'mri_reports': { 
        collection: 'mri_reports',
        countField: 'mrireportsCount'
      },
      'mammography_reports': { 
        collection: 'mammography_reports',
        countField: 'mammographyreportsCount'
      },
      'pet_scan_reports': { 
        collection: 'pet_scan_reports',
        countField: 'petscanreportsCount'
      },
      'bone_scan_reports': { 
        collection: 'bone_scan_reports',
        countField: 'bonescanreportsCount'
      },
      'dexa_scan_reports': { 
        collection: 'dexa_scan_reports',
        countField: 'dexascanreportsCount'
      },
      'progress_notes': { 
        collection: 'progress_notes',
        countField: 'progressnotesCount'
      },
      'nursing_notes': { 
        collection: 'nursing_notes',
        countField: 'nursingnotesCount'
      },
      'therapy_progress_notes': { 
        collection: 'therapy_progress_notes',
        countField: 'therapyprogressnotesCount'
      },
      'monitoring_reports': { 
        collection: 'monitoring_reports',
        countField: 'monitoringreportsCount'
      },
      'vital_signs_logs': { 
        collection: 'vital_signs_logs',
        countField: 'vitalsignslogsCount'
      },
      'icu_flow_sheets': { 
        collection: 'icu_flow_sheets',
        countField: 'icuflowsheetsCount'
      },
      'medication_administration_records': { 
        collection: 'medication_administration_records',
        countField: 'medicationadministrationrecordsCount'
      },
      'dialysis_run_sheets': { 
        collection: 'dialysis_run_sheets',
        countField: 'dialysisrunsheetsCount'
      },
      'blood_glucose_logs': { 
        collection: 'blood_glucose_logs',
        countField: 'bloodglucoselogsCount'
      },
      'intake_output_records': { 
        collection: 'intake_output_records',
        countField: 'intakeoutputrecordsCount'
      },
      'wound_care_documentation': { 
        collection: 'wound_care_documentation',
        countField: 'woundcaredocumentationCount'
      },
      'pain_assessment_forms': { 
        collection: 'pain_assessment_forms',
        countField: 'painassessmentformsCount'
      },
      'insurance_forms': { 
        collection: 'insurance_forms',
        countField: 'insuranceformsCount'
      },
      'disability_evaluations': { 
        collection: 'disability_evaluations',
        countField: 'disabilityevaluationsCount'
      },
      'workers_comp_evaluations': { 
        collection: 'workers_comp_evaluations',
        countField: 'workerscompevaluationsCount'
      },
      'fitness_for_duty_evaluations': { 
        collection: 'fitness_for_duty_evaluations',
        countField: 'fitnessfordutyevaluationsCount'
      },
      'school_health_forms': { 
        collection: 'school_health_forms',
        countField: 'schoolhealthformsCount'
      },
      'travel_health_certificates': { 
        collection: 'travel_health_certificates',
        countField: 'travelhealthcertificatesCount'
      },
      'prior_authorization_forms': { 
        collection: 'prior_authorization_forms',
        countField: 'priorauthorizationformsCount'
      },
      'medical_power_of_attorney': { 
        collection: 'medical_power_of_attorney',
        countField: 'medicalpowerofattorneyCount'
      },
      'dnr_orders': { 
        collection: 'dnr_orders',
        countField: 'dnrordersCount'
      },
      'goals_of_care_discussions': { 
        collection: 'goals_of_care_discussions',
        countField: 'advanceddirectivesCount'
      },
      'transfer_summaries': { 
        collection: 'transfer_summaries',
        countField: 'transfersummariesCount'
      },
      'genetic_testing_reports': { 
        collection: 'genetic_testing_reports',
        countField: 'genetictestingreportsCount'
      },
      'tumor_marker_panels': { 
        collection: 'tumor_marker_panels',
        countField: 'tumormarkerpanelsCount'
      },
      'hormone_panels': { 
        collection: 'hormone_panels',
        countField: 'hormonepanelsCount'
      },
      'autoimmune_panels': { 
        collection: 'autoimmune_panels',
        countField: 'autoimmunepanelsCount'
      },
      'toxicology_reports': { 
        collection: 'toxicology_reports',
        countField: 'toxicologyreportsCount'
      },
      'microbiology_culture_reports': { 
        collection: 'microbiology_culture_reports',
        countField: 'microbiologyculturereportsCount'
      },
      'antibiogram_reports': { 
        collection: 'antibiogram_reports',
        countField: 'antibiogramreportsCount'
      },
      'flow_cytometry_reports': { 
        collection: 'flow_cytometry_reports',
        countField: 'flowcytometryreportsCount'
      },
      'dental_examination_reports': { 
        collection: 'dental_examination_reports',
        countField: 'dentalexaminationreportsCount'
      },
      'periodontal_charts': { 
        collection: 'periodontal_charts',
        countField: 'periodontalchartsCount'
      },
      'orthodontic_treatment_plans': { 
        collection: 'orthodontic_treatment_plans',
        countField: 'orthodontictreatmentplansCount'
      },
      'oral_surgery_reports': { 
        collection: 'oral_surgery_reports',
        countField: 'oralsurgeryreportsCount'
      },
      'physical_therapy_evaluations': { 
        collection: 'physical_therapy_evaluations',
        countField: 'physicaltherapyevaluationsCount'
      },
      'occupational_therapy_reports': { 
        collection: 'occupational_therapy_reports',
        countField: 'occupationaltherapyreportsCount'
      },
      'speech_therapy_assessments': { 
        collection: 'speech_therapy_assessments',
        countField: 'speechtherapyassessmentsCount'
      },
      'cardiac_rehabilitation_reports': { 
        collection: 'cardiac_rehabilitation_reports',
        countField: 'cardiacrehabilitationreportsCount'
      },
      'pulmonary_rehabilitation_notes': { 
        collection: 'pulmonary_rehabilitation_notes',
        countField: 'pulmonaryrehabilitationnotesCount'
      },
      'cognitive_rehabilitation_reports': { 
        collection: 'cognitive_rehabilitation_reports',
        countField: 'cognitiverehabilitationreportsCount'
      },
      'soap_notes': { 
        collection: 'soap_notes',
        countField: 'soapnotesCount'
      },
      'nursing_assessments': { 
        collection: 'nursing_assessments',
        countField: 'nursingassessmentsCount'
      },
      'admission_assessments': { 
        collection: 'admission_assessments',
        countField: 'admissionassessmentsCount'
      },
      'shift_handoff_notes': { 
        collection: 'shift_handoff_notes',
        countField: 'shifthandoffnotesCount'
      },
      'ems_run_reports': { 
        collection: 'ems_run_reports',
        countField: 'emsrunreportsCount'
      },
      'trauma_flow_sheets': { 
        collection: 'trauma_flow_sheets',
        countField: 'traumaflowsheetsCount'
      },
      'code_blue_summaries': { 
        collection: 'code_blue_summaries',
        countField: 'codebluesummariesCount'
      },
      'poison_control_reports': { 
        collection: 'poison_control_reports',
        countField: 'poisoncontrolreportsCount'
      },
      'rapid_response_summaries': { 
        collection: 'rapid_response_summaries',
        countField: 'rapidresponsesummariesCount'
      },
      'obstetric_ultrasound_reports': { 
        collection: 'obstetric_ultrasound_reports',
        countField: 'obstetricultrasoundreportsCount'
      },
      'prenatal_testing_reports': { 
        collection: 'prenatal_testing_reports',
        countField: 'prenataltestingreportsCount'
      },
      'amniocentesis_reports': { 
        collection: 'amniocentesis_reports',
        countField: 'amniocentesisreportsCount'
      },
      'newborn_screening_results': { 
        collection: 'newborn_screening_results',
        countField: 'newbornscreeningresultsCount'
      },
      'apgar_scores': { 
        collection: 'apgar_scores',
        countField: 'apgarscoresCount'
      },
      'nicu_progress_notes': { 
        collection: 'nicu_progress_notes',
        countField: 'nicuprogressnotesCount'
      },
      'case_summaries': { 
        collection: 'case_summaries',
        countField: 'casesummariesCount'
      },
      'second_opinion_reports': { 
        collection: 'second_opinion_reports',
        countField: 'secondopinionreportsCount'
      },
      'telemedicine_encounters': { 
        collection: 'telemedicine_encounters',
        countField: 'telemedicineencountersCount'
      },
      'home_health_notes': { 
        collection: 'home_health_notes',
        countField: 'homehealthnotesCount'
      },
      'hospice_notes': { 
        collection: 'hospice_notes',
        countField: 'hospicenotesCount'
      },
      'wound_care_notes': { 
        collection: 'wound_care_notes',
        countField: 'woundcarenotesCount'
      },
      'pain_management_notes': {
        collection: 'pain_management_notes',
        countField: 'painmanagementnotesCount'
      },
      'malnutrition_risk_assessment': {
        collection: 'malnutrition_risk_assessment',
        countField: 'malnutritionriskassessmentCount'
      },
      'social_work_notes': { 
        collection: 'social_work_notes',
        countField: 'socialworknotesCount'
      },
      'care_coordination_notes': { 
        collection: 'care_coordination_notes',
        countField: 'carecoordinationnotesCount'
      },
      'medical_reconciliation_forms': { 
        collection: 'medical_reconciliation_forms',
        countField: 'medicalreconciliationformsCount'
      },
      'patient_education_records': { 
        collection: 'patient_education_records',
        countField: 'patienteducationrecordsCount'
      },
      'clinical_trial_documents': { 
        collection: 'clinical_trial_documents',
        countField: 'clinicaltrialdocumentsCount'
      },
      'research_consent_forms': { 
        collection: 'research_consent_forms',
        countField: 'researchconsentformsCount'
      }
    };
    */
  }

  async initialize(context) {
    // Check if we need to reinitialize for a different context
    const contextKey = context ? JSON.stringify({
      practiceId: context.practiceId,
      practiceSubdomain: context.practiceSubdomain
    }) : 'global';

    if (this.initialized && this.lastInitContext === contextKey) {
      console.log('✅ Medical Data Service already initialized for this context');
      return;
    }

    console.log('🔄 Starting Medical Data Service initialization...');

    try {
      // Get services through proxy manager
      console.log('   Getting SecureDataAccess from serviceProxyManager...');
      this._secureDataAccess = serviceProxyManager.get('secureDataAccess');
      if (!this._secureDataAccess) {
        throw new Error('SecureDataAccess not available from serviceProxyManager');
      }
      console.log('   ✓ SecureDataAccess obtained');

      console.log('   Getting serviceAccountManager from serviceProxyManager...');
      this._serviceAccountManager = serviceProxyManager.get('serviceAccountManager');
      if (!this._serviceAccountManager) {
        throw new Error('serviceAccountManager not available from serviceProxyManager');
      }
      console.log('   ✓ serviceAccountManager obtained');

      // Get service API key from KMS
      console.log('   Getting service API key from KMS...');
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_MEDICAL_DATA_SERVICE_KEY');
      if (!this.serviceToken) {
        throw new Error('Could not get API key for medical-data-service from KMS');
      }
      console.log('   ✓ Service API key obtained');

      // Get list of existing collections with the provided context
      console.log('   Updating list of existing collections...');
      await this.updateExistingCollections(context);

      this.initialized = true;
      this.lastInitContext = contextKey;
      console.log(`✅ Medical Data Service initialized successfully with ${this.existingCollections.size} existing collections`);
    } catch (error) {
      console.error('❌ Failed to initialize Medical Data Service:', error.message);
      console.error('   Full error:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Update the list of existing collections in the database
   * This helps avoid querying non-existent collections
   * @param {Object} context - Security context with practiceId/practiceSubdomain
   */
  async updateExistingCollections(context) {
    try {
      const { MongoClient } = require('mongodb');
      const productionKMS = require('./productionKMS');

      // Get admin credentials
      await productionKMS.initialize();
      const adminPassword = await productionKMS.getInternalKey('MONGODB_ADMIN_PASSWORD');

      if (!adminPassword) {
        console.warn('⚠️ Could not get admin password for collection check');
        return;
      }

      // Determine database name from context
      let dbName;
      if (!context || !context.practiceId || context.practiceId === 'global') {
        dbName = 'intellicare_practice_global';
      } else {
        // Use practiceSubdomain if available, otherwise use practiceId
        const practiceIdentifier = context.practiceSubdomain || context.practiceId;
        // Check if it's an ObjectId (24 hex characters)
        if (/^[a-f0-9]{24}$/i.test(practiceIdentifier)) {
          // This is an ObjectId - we need to lookup the subdomain from practices collection
          try {
            const client = new MongoClient(`mongodb://intellicare_admin:${adminPassword}@localhost:27017/admin?authSource=admin`);
            await client.connect();
            const globalDb = client.db('intellicare_practice_global');
            const { ObjectId } = require('mongodb');
            const practice = await globalDb.collection('practices').findOne({ _id: new ObjectId(practiceIdentifier) });
            await client.close();

            if (practice && practice.subdomain) {
              dbName = `intellicare_practice_${practice.subdomain}`;
              console.log(`✅ Resolved practice ${practiceIdentifier} to database ${dbName}`);
            } else {
              // Cannot determine practice database - skip collection check
              console.log('⚠️ Cannot resolve practice database, will check collections at query time');
              return;
            }
          } catch (err) {
            console.error('⚠️ Error looking up practice:', err.message);
            return; // Skip collection check if we can't determine the database
          }
        } else {
          // It's a subdomain
          dbName = `intellicare_practice_${practiceIdentifier}`;
        }
      }

      // Connect to MongoDB
      const client = new MongoClient(`mongodb://intellicare_admin:${adminPassword}@localhost:27017/admin?authSource=admin`);
      await client.connect();

      const db = client.db(dbName);

      // Get all collections
      const collections = await db.listCollections().toArray();

      // Get all medical collection names from our service
      const medicalCollectionNames = new Set(medicalCollectionsService.getAllCollections());

      // Update our set of existing collections - ONLY store medical collections
      this.existingCollections.clear();
      collections.forEach(c => {
        // Only add to cache if it's a medical collection
        if (medicalCollectionNames.has(c.name)) {
          this.existingCollections.add(c.name);
        }
      });

      await client.close();

      console.log(`📋 Found ${this.existingCollections.size} existing collections in ${dbName}`);
    } catch (error) {
      console.error('⚠️ Could not update existing collections list:', error.message);
      // Don't throw - we can still work without this optimization
    }
  }

  /**
   * Store medical data in the appropriate collection
   * @param {String} category - Category of medical data (e.g., 'consultation_notes', 'lab_results')
   * @param {Object} data - The medical data to store
   * @param {Object} context - Security context
   */
  async storeMedicalData(category, data, context) {
    if (!this.initialized) {
      throw new Error('MedicalDataService not initialized. Service should be initialized at startup.');
    }

    const collectionInfo = this.collectionMap[category];
    if (!collectionInfo) {
      throw new Error(`Unknown medical data category: ${category}`);
    }

    const { collection, countField } = collectionInfo;

    // Ensure patientId and documentId are present
    if (!data.patientId) {
      throw new Error('patientId is required for medical data');
    }

    // Ensure patientId is stored as ObjectId for proper querying and indexing
    const { ObjectId } = require('mongodb');
    if (typeof data.patientId === 'string') {
      data.patientId = new ObjectId(data.patientId);
    } else if (!(data.patientId instanceof ObjectId)) {
      throw new Error(`Invalid patientId type: ${typeof data.patientId}`);
    }
    
    try {
      // Auto-grant permissions for this collection to admin users (non-blocking)
      const permissionSyncService = require('./permissionSyncService');
      permissionSyncService.ensureCollectionPermissions(collection, context).catch(err => {
        console.error(`⚠️ Permission sync failed for ${collection}:`, err.message);
      });

      // Ensure patientId index exists on this collection (non-blocking)
      this.ensurePatientIdIndex(collection, context).catch(err => {
        console.error(`⚠️ Index creation failed for ${collection}:`, err.message);
      });

      // Store the medical data
      const result = await this._secureDataAccess.insert(collection, data, context);
      console.log(`✅ Stored ${category} for patient ${data.patientId} in ${collection} collection`);
      
      // Update the count in the patient record AND track in medicalData
      if (countField) {
        const updateObj = {};
        updateObj[`$inc`] = {};
        updateObj[`$inc`][countField] = 1;

        // Cache removed Feb 2026 - no longer tracking document IDs in patient.medicalData.collections
        // All collection queries now go directly to DB

        // Also update last consultation/lab result if applicable
        if (category === 'consultation_notes' && data.diagnosis) {
          updateObj[`$set`][`lastConsultation.date`] = data.date || new Date();
          updateObj[`$set`][`lastConsultation.diagnosis`] = data.diagnosis;
          updateObj[`$set`][`lastConsultation.doctor`] = data.doctorName;
        } else if (category === 'lab_results' && data.testType) {
          updateObj[`$set`][`lastLabResult.date`] = data.date || new Date();
          updateObj[`$set`][`lastLabResult.type`] = data.testType;
          updateObj[`$set`][`lastLabResult.criticalValues`] = data.criticalValues || false;
        }

        // For patient updates, patientId is already an ObjectId
        const { ObjectId } = require('mongodb');
        const patientFilter = { _id: data.patientId };

        await this._secureDataAccess.update('patients',
          patientFilter,
          updateObj,
          context
        );

        console.log(`✅ Updated patient medicalData tracking for ${collection}`);
      }
      
      return result;
    } catch (error) {
      console.error(`Error storing ${category} data:`, error);
      throw error;
    }
  }

  /**
   * Retrieve medical data for a patient from a specific collection
   * @param {String} category - Category of medical data
   * @param {ObjectId} patientId - Patient ID
   * @param {Object} options - Query options (limit, sort, etc.)
   * @param {Object} context - Security context
   */
  async getMedicalData(category, patientId, options = {}, context) {
    if (!this.initialized) {
      throw new Error('MedicalDataService not initialized. Service should be initialized at startup.');
    }

    const collectionInfo = this.collectionMap[category];
    if (!collectionInfo) {
      throw new Error(`Unknown medical data category: ${category}`);
    }

    const { collection } = collectionInfo;

    // Don't skip based on cache - let MongoDB handle non-existent collections
    // The cache might be incomplete or from the wrong database
    // MongoDB will return an error if the collection doesn't exist, which we handle gracefully

    // Ensure patientId is an ObjectId for proper querying
    const { ObjectId } = require('mongodb');
    const patientIdObj = typeof patientId === 'string' ? new ObjectId(patientId) : patientId;

    // Default options
    const queryOptions = {
      limit: options.limit || 100,
      sort: options.sort || { date: -1 }, // Most recent first
      ...options
    };

    try {
      // Use SecureDataAccess for all database operations
      const SecureDataAccess = require('./secureDataAccess');

      // Use medical-data-service's own authentication
      const queryContext = {
        serviceId: 'medical-data-service',
        apiKey: this.serviceToken,
        practiceId: context.practiceId,
        practiceSubdomain: context.practiceSubdomain,
        operation: 'getMedicalData'
      };

      // Debug: Check if token is set
      if (!this.serviceToken) {
        console.error('❌ Service token not set for medical-data-service!');
      } else {
        console.log(`🔑 Using API key for ${category}: ${this.serviceToken.substring(0, 10)}...`);
      }

      // SMART PRUNING: Add projection for essential fields only if not specified
      // TEMPORARILY DISABLED for debugging - return ALL fields
      if (!queryOptions.projection && false) {
        queryOptions.projection = {
          _id: 1,
          patientId: 1,
          date: 1,
          createdAt: 1,
          recordedAt: 1,
          type: 1,
          category: 1,
          // Include text fields but they'll be truncated after retrieval
          notes: 1,
          diagnosis: 1,  // For diagnoses collection
          condition: 1,  // Alternative field name for diagnosis
          description: 1,
          details: 1,
          // Essential medical data
          medicationName: 1,
          dosage: 1,
          frequency: 1,
          testName: 1,
          result: 1,
          referenceRange: 1,
          condition: 1,
          severity: 1,
          provider: 1,
          providerName: 1,
          title: 1,
          name: 1,
          // Risk factors and recommendations
          factors: 1,
          recommendations: 1,
          // Vital signs
          bloodPressure: 1,
          heartRate: 1,
          temperature: 1,
          oxygenSaturation: 1,
          respiratoryRate: 1,
          weight: 1,
          height: 1,
          // Follow-up appointments
          specialty: 1,
          timing: 1,
          reason: 1,
          appointmentDate: 1,
          // Allergies
          allergen: 1,
          reaction: 1,
          allergyType: 1,
          // Additional fields
          value: 1,
          unit: 1,
          status: 1,
          assessedBy: 1,
          source: 1,
          // ICD codes and diagnosis fields
          icd10Code: 1,
          icdCode: 1,
          diagnosedBy: 1,
          // Physical examinations
          findings: 1,
          systems: 1,
          // Chief complaints
          complaint: 1,
          duration: 1,
          // Assessment plans
          assessment: 1,
          plan: 1,
          goals: 1
        };
        console.log(`🎯 [getMedicalData] Using smart pruning projection for ${category}`);
      }

      // Use SecureDataAccess - Redis caching handled by claudeResponseCache
      console.log(`🔍 [getMedicalData] Querying ${collection} for patient ${patientIdObj.toString()}`);
      console.log(`🔍 [getMedicalData] Database context - practiceId: ${queryContext.practiceId}, practiceSubdomain: ${queryContext.practiceSubdomain}`);
      const results = await SecureDataAccess.query(
        collection,
        { patientId: patientIdObj }, // Use ObjectId patientId
        queryOptions,
        queryContext
      );

      console.log(`📊 [getMedicalData] ${category}: received ${results ? results.length : 0} results`);

      // DEBUG: Log actual fields returned for problematic categories
      if (['clinical_scores', 'prognosis', 'patient_provider', 'patient_education_records'].includes(category) && results && results.length > 0) {
        console.log(`🔍 [getMedicalData] ${category} RAW RESULT FIELDS:`, Object.keys(results[0]));
        console.log(`🔍 [getMedicalData] ${category} RAW RESULT DATA:`, JSON.stringify(results[0], null, 2));
      }

      if (!results) {
        console.log(`⚠️ [getMedicalData] No results returned for ${category} - query may have failed`);
        return [];
      }

      if (results.length === 0) {
        console.log(`⚠️ [getMedicalData] ${category}: Query succeeded but returned empty array`);
      }

      // SMART PRUNING: Post-process to truncate large text fields
      const prunedResults = results.map(record => {
        const pruned = { ...record };

        // Truncate large text fields to prevent token explosion
        if (pruned.notes && pruned.notes.length > 200) {
          pruned.notes = pruned.notes.substring(0, 200) + '...';
          pruned.hasFullNotes = true;
        }
        if (pruned.diagnosis && pruned.diagnosis.length > 100) {
          pruned.diagnosis = pruned.diagnosis.substring(0, 100) + '...';
          pruned.hasFullDiagnosis = true;
        }
        if (pruned.description && pruned.description.length > 150) {
          pruned.description = pruned.description.substring(0, 150) + '...';
          pruned.hasFullDescription = true;
        }

        return pruned;
      });

      console.log(`📋 [getMedicalData] Retrieved ${prunedResults.length} ${category} records (pruned) for patient ${patientIdObj.toString()}`);

      // Debug: Log actual fields for first record
      if (prunedResults.length > 0 && category === 'diagnoses') {
        console.log(`🔍 DEBUG - First diagnosis record fields:`, Object.keys(prunedResults[0]));
        console.log(`🔍 DEBUG - First diagnosis data:`, JSON.stringify(prunedResults[0], null, 2).substring(0, 500));
      }
      return prunedResults;
    } catch (error) {
      // If collection doesn't exist, return empty array instead of throwing
      if (error && error.message && error.message.includes('does not exist')) {
        console.log(`⚠️ Collection ${collection} does not exist, returning empty array`);
        return [];
      }
      console.error(`❌ Error retrieving ${category} data:`, error ? error.message : 'Unknown error');
      console.error(`   Collection: ${collection}, PatientId: ${patientIdObj.toString()}`);
      if (error && error.stack) {
        console.error(`   Stack trace:`, error.stack.split('\n')[0]);
      }
      // Return empty array for non-critical errors
      return [];
    }
  }

  /**
   * Get medical data by category and open artifact panel
   * This is called by Claude when user requests to view a specific category
   * @param {Object} args - Arguments with patientId and category
   * @param {Object} context - Security context
   * @returns {Object} Response with displayType and artifactPanel data
   */
  /**
   * Utility function to check if a collection has data for a patient
   * This is used to optimize queries across the system
   * @param {String} patientId - Patient ID
   * @param {String} collectionName - Collection to check
   * @param {Object} context - Security context
   * @returns {Boolean} - True if collection has data
   */
  async checkCollectionHasData(patientId, collectionName, context) {
    try {
      const { ObjectId } = require('mongodb');
      const patientIdStr = typeof patientId === 'object' && patientId.toString ? patientId.toString() : String(patientId);
      const patientFilter = patientIdStr.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: new ObjectId(patientIdStr) }
        : { _id: patientIdStr };

      const patient = await this._secureDataAccess.query('patients',
        patientFilter,
        { projection: { [`medicalData.collections.${collectionName}`]: 1 } },
        context
      );

      return patient?.[0]?.medicalData?.collections?.[collectionName]?.length > 0;
    } catch (error) {
      // If error, assume data might exist (safer to check)
      return true;
    }
  }

  /**
   * Get collections with data for a patient (optimized)
   * @param {String} patientId - Patient ID
   * @param {Object} context - Security context
   * @returns {Array} - List of collection names with data
   */
  async getCollectionsWithData(patientId, context) {
    try {
      const { ObjectId } = require('mongodb');
      const patientIdStr = typeof patientId === 'object' && patientId.toString ? patientId.toString() : String(patientId);
      const patientFilter = patientIdStr.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: new ObjectId(patientIdStr) }
        : { _id: patientIdStr };

      const secureContext = {
        serviceId: 'medical-data-service',
        apiKey: this.serviceToken,
        practiceId: context.practiceId,
        practiceSubdomain: context.practiceSubdomain,
        operation: 'getCollectionsWithData'
      };

      if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 [getCollectionsWithData] Context received:`, JSON.stringify({ practiceId: context.practiceId, practiceSubdomain: context.practiceSubdomain }));
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 [getCollectionsWithData] Querying patient with filter:`, JSON.stringify(patientFilter));
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 [getCollectionsWithData] Filter._id type:`, typeof patientFilter._id, patientFilter._id.constructor.name);

      const patient = await this._secureDataAccess.query('patients',
        patientFilter,
        { projection: { 'medicalData.collections': 1 } },
        secureContext
      );

      if (process.env.QUIET_LOGS !== 'true') console.log(`📊 [getCollectionsWithData] Query returned:`, patient?.length || 0, 'records');
      if (patient && patient.length === 0) {
        if (process.env.QUIET_LOGS !== 'true') console.log(`⚠️ [getCollectionsWithData] Query returned empty - possible ObjectId serialization issue`);
      }

      if (patient?.[0]?.medicalData?.collections) {
        const collections = Object.keys(patient[0].medicalData.collections);
        if (process.env.QUIET_LOGS !== 'true') console.log(`✅ [getCollectionsWithData] Found ${collections.length} collections:`, collections.join(', '));
        return collections;
      }
      if (process.env.QUIET_LOGS !== 'true') console.log(`⚠️ [getCollectionsWithData] No medicalData.collections found in patient record`);
      return [];
    } catch (error) {
      console.log(`❌ [getCollectionsWithData] Error: ${error.message}`);
      return [];
    }
  }

  /**
   * Helper function to find which categories a collection belongs to
   * @private
   */
  _findCategoriesForCollection(collectionName) {
    const categories = [];

    // Map collections to their logical categories for optimization
    const categoryMap = {
      'lab_results': ['laboratory', 'diagnostics'],
      'lab_orders': ['laboratory'],
      'lab_history': ['laboratory'],
      'lab_panels': ['laboratory'],
      'lab_trends': ['laboratory'],
      'medications': ['medications', 'pharmacy'],
      'medication_history': ['medications'],
      'prescriptions': ['medications', 'pharmacy'],
      'medication_allergies': ['medications', 'allergies'],
      'diagnoses': ['diagnoses', 'problems'],
      'diagnosis_history': ['diagnoses'],
      'problem_list': ['diagnoses', 'problems'],
      'vital_signs': ['vitals'],
      'vital_history': ['vitals'],
      'allergies': ['allergies'],
      'allergy_history': ['allergies'],
      'imaging_studies': ['imaging', 'radiology'],
      'radiology_reports': ['imaging', 'radiology'],
      'ct_scans': ['imaging', 'radiology'],
      'mri_studies': ['imaging', 'radiology'],
      'procedures': ['procedures', 'surgery'],
      'surgical_procedures': ['procedures', 'surgery'],
      'immunizations': ['immunizations', 'vaccines'],
      'vaccine_history': ['immunizations', 'vaccines'],
      'documents': ['documents', 'records'],
      'medical_records': ['documents', 'records'],
      'discharge_summaries': ['documents', 'hospital'],
      'hospital_discharge_summaries': ['hospital', 'documents'],
      'consultation_notes': ['consultations'],
      'additional_notes': ['documents', 'notes'],
      // Specialty collections
      'cardiology_consultations': ['cardiology', 'consultations'],
      'echocardiograms': ['cardiology', 'imaging'],
      'ekg_results': ['cardiology', 'diagnostics'],
      'neurology_consultations': ['neurology', 'consultations'],
      'eeg_studies': ['neurology', 'diagnostics'],
      'psychiatric_consultations': ['psychiatry', 'consultations'],
      'mental_health_assessments': ['psychiatry', 'assessments'],
      'oncology_consultations': ['oncology', 'consultations'],
      'cancer_staging': ['oncology', 'diagnostics']
    };

    return categoryMap[collectionName] || [collectionName];
  }

  /**
   * List all medical categories with data for a patient (for scrollable grid display)
   * Returns just category names in a clean format
   * @param {ObjectId|string} patientId - Patient ID (must be ObjectId, not patient name)
   * @param {Object} context - Security context
   * @returns {Object} - { categories: [{name, displayName}], totalCategories }
   */
  async listPatientMedicalCategories(params, context) {
    if (!this.initialized) {
      throw new Error('MedicalDataService not initialized. Service should be initialized at startup.');
    }

    // Handle both old API (patientId string) and new API (params object)
    let patientId;
    let patientName = null;  // CRITICAL: Declare outside the if block so we can use it in the return

    if (typeof params === 'string') {
      patientId = params;
    } else if (typeof params === 'object') {
      // Extract from params object - handle ssn, nationalId, patientName, patientId
      patientId = params.patientId || params.ssn || params.nationalId || params.patientName;

      // If SSN/nationalId/name provided, we need to resolve to patientId
      if ((params.ssn || params.nationalId || params.patientName) && !params.patientId) {
        const patientService = require('./patientService');
        const identifier = params.ssn || params.nationalId || params.patientName;
        const identifierType = params.ssn ? 'SSN' : (params.nationalId ? 'National ID' : 'Name');

        console.log(`🔍 Resolving patient by ${identifierType}: ${identifier}`);
        const searchResult = await patientService.searchPatients({ query: identifier }, { subdomain: context.practiceId }, null, context);

        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          const patient = searchResult.data[0];
          // Extract patientId - could be in patientId or _id field
          const rawId = patient.patientId || patient._id;
          patientId = rawId && typeof rawId === 'object' && rawId.toString
            ? rawId.toString()
            : rawId;

          patientName = patient.name || `${patient.firstName} ${patient.lastName}`.trim();
          console.log(`✅ Resolved to patient: ${patientName} (ID: ${patientId})`);
        } else {
          throw new Error(`No patient found with ${identifierType} ${identifier}`);
        }
      }
    }

    if (!patientId) {
      throw new Error('Patient ID or identifier required');
    }

    const { ObjectId } = require('mongodb');
    const patientIdObj = typeof patientId === 'string' ? new ObjectId(patientId) : patientId;

    if (process.env.QUIET_LOGS !== 'true') console.log(`📋 [listPatientMedicalCategories] Listing available medical data categories for patient ${patientIdObj.toString()}`);

    // Query granular collections to find which ones have data
    try {
      // ALWAYS query all collections directly (bypassing patient.medicalData.collections cache)
      // This ensures newly added collections like lab_orders and imaging_orders are discovered
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 [listPatientMedicalCategories] Querying all collections directly (cache bypassed)`);

      // Get all medical collections from service
      const medicalCollectionsService = require('./medicalCollectionsService');
      const allCollections = medicalCollectionsService.getAllCollections();

      // Check each collection for data
      let collectionsWithData = [];
      for (const collectionName of allCollections) {
        try {
          const count = await this._secureDataAccess.query(
            collectionName,
            { patientId: patientIdObj },
            { count: true },
            {
              serviceId: 'medical-data-service',
              apiKey: this.serviceToken,
              practiceId: context.practiceId,
              practiceSubdomain: context.practiceSubdomain,
              operation: 'listPatientMedicalCategories'
            }
          );
          if (count > 0) {
            collectionsWithData.push(collectionName);
          }
        } catch (err) {
          // Skip collections that error - LOG WHICH ONE
          if (process.env.QUIET_LOGS !== 'true') console.error(`⚠️  [listPatientMedicalCategories] Failed to count ${collectionName}:`, err.message);
          continue;
        }
      }
      if (process.env.QUIET_LOGS !== 'true') console.log(`📊 [listPatientMedicalCategories] Found ${collectionsWithData.length} collections with data`);


      if (!collectionsWithData || collectionsWithData.length === 0) {
        console.log(`⚠️ No medical data collections found for patient ${patientIdObj.toString()}`);
        return {
          success: true,
          categories: [],
          totalCategories: 0,
          patientId: patientIdObj.toString(),
          patientName: patientName || 'Unknown'
        };
      }

      if (process.env.QUIET_LOGS !== 'true') console.log(`✅ Found ${collectionsWithData.length} collections with data: ${collectionsWithData.join(', ')}`);

      // CRITICAL: Filter out AI-generated collections AND unified documents from available data list
      // AI collections: These are AI insights generated by Claude - not raw patient data
      // Unified documents: Large aggregated reports (58KB+) accessed via getFullMedicalReport
      // User can still access them directly but they won't appear in the "what data do we have" list
      const AI_GENERATED_COLLECTIONS = new Set([
        'clinical_decision_support',
        'intelligent_recommendations',
        'trending_analysis',
        'patient_specific_care_plan',
        'medication_optimization',
        'follow_up_intelligence',
        'patient_education_context',
        'guideline_compliance',
        'quality_metrics',
        'care_gaps',
        'outcomes_prediction'
      ]);

      // Filter out AI collections from the list
      const patientDataCollections = collectionsWithData.filter(c => !AI_GENERATED_COLLECTIONS.has(c));
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 Filtered to ${patientDataCollections.length} patient data collections (removed ${collectionsWithData.length - patientDataCollections.length} AI-generated)`);

      // Import WRAP_ALL_RECORDS_COLLECTIONS to determine display mode
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

      // Get counts for each collection in parallel (using filtered patient data collections)
      const categoryPromises = patientDataCollections.map(async (collectionName) => {
        try {
          const count = await this._secureDataAccess.query(
            collectionName,
            { patientId: patientIdObj },
            { count: true },
            {
              serviceId: 'medical-data-service',
              apiKey: this.serviceToken,
              practiceId: context.practiceId,
              practiceSubdomain: context.practiceSubdomain,
              operation: 'listPatientMedicalCategories'
            }
          );

          // Convert snake_case to Title Case for display
          const displayName = collectionName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          // Determine display mode: 'document' for merged collections, 'grid' for list collections
          const displayMode = WRAP_ALL_RECORDS_COLLECTIONS.has(collectionName) ? 'document' : 'grid';

          return {
            name: collectionName,
            displayName: displayName,
            count: count || 0,
            displayMode: displayMode
          };
        } catch (error) {
          console.error(`❌ Error getting count for ${collectionName}:`, error.message);
          return null;
        }
      });

      const categoryResults = await Promise.all(categoryPromises);
      const categories = categoryResults.filter(c => c !== null && c.count > 0);

      // Sort by display name
      categories.sort((a, b) => a.displayName.localeCompare(b.displayName));

      console.log(`✅ Returning ${categories.length} categories with data`);

      return {
        success: true,
        categories: categories,
        totalCategories: categories.length,
        totalDocuments: categories.reduce((sum, cat) => sum + cat.count, 0),
        patientId: patientIdObj.toString(),
        patientName: patientName || 'Unknown'
      };
    } catch (error) {
      console.error('❌ Error listing medical data categories:', error);
      return {
        success: false,
        message: `Error: ${error.message}`,
        categories: [],
        totalCategories: 0,
        patientId: patientIdObj.toString(),
        patientName: patientName || 'Unknown'
      };
    }
  }

  /**
   * Get AI clinical insights for a patient (8 AI analysis collections)
   * @param {ObjectId} patientId - Patient ID
   * @param {Object} context - Security context
   */
  async getAIClinicalInsights(patientId, context) {
    if (!this.initialized) {
      throw new Error('MedicalDataService not initialized. Service should be initialized at startup.');
    }

    // Ensure patientId is an ObjectId for proper querying
    const { ObjectId } = require('mongodb');
    const patientIdObj = typeof patientId === 'string' ? new ObjectId(patientId) : patientId;

    const medicalHistory = {};
    let totalRecords = 0;
    let collectionsChecked = 0;
    let collectionsWithData = 0;

    console.log(`🔍 [getAllMedicalHistory] Searching for medical history for patient ${patientIdObj.toString()}`);
    console.log(`📍 [getAllMedicalHistory] Practice context:`, {
      practiceId: context?.practiceId,
      practiceSubdomain: context?.practiceSubdomain
    });

    // OPTIMIZATION: First check patient.medicalData to know which collections have data
    let collectionsToCheck = [];
    let usingMedicalDataOptimization = false;

    try {
      const patientFilter = { _id: patientIdObj };

      const patient = await this._secureDataAccess.query('patients',
        patientFilter,
        { projection: { medicalData: 1 } },
        context
      );

      if (patient?.[0]?.medicalData?.collections) {
        // FAST PATH: Use medicalData to query only collections with data
        const collectionsWithData = Object.keys(patient[0].medicalData.collections);

        if (collectionsWithData.length > 0) {
          console.log(`⚡ OPTIMIZED: Found ${collectionsWithData.length} collections with data in patient.medicalData`);
          console.log(`   Collections: ${collectionsWithData.join(', ')}`);

          for (const collection of collectionsWithData) {
            let info = this.collectionMap[collection];
            if (!info) {
              // Collection not in map - add it dynamically
              console.log(`⚠️ Collection ${collection} not in collectionMap - adding dynamically`);
              const camelCase = collection
                .split('_')
                .map((word, i) => i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
                .join('');
              info = {
                collection: collection,
                countField: camelCase + 'Count'
              };
              this.collectionMap[collection] = info;
            }
            collectionsToCheck.push([collection, info]);
          }
          usingMedicalDataOptimization = true;
        }
      }
    } catch (error) {
      console.log(`⚠️ Could not check patient.medicalData, falling back to standard approach: ${error.message}`);
    }

    // Fallback to priority collections if medicalData not available
    if (collectionsToCheck.length === 0) {
      console.log(`📊 Using fallback: Checking priority medical collections (medicalData not available)`);

      const highPriorityCollections = [
        'lab_results', 'medications', 'diagnoses', 'vital_signs', 'allergies',
        'consultation_notes', 'prescriptions', 'past_medical_history', 'chief_complaints',
        'recommendations', 'diabetes_management_notes', 'documents',
        'additional_notes', 'history_present_illness', 'physical_examinations',
        'assessment_plans', 'surgical_history', 'family_history', 'social_history',
        'risk_factors', 'follow_up_appointments', 'hospital_discharge_summaries'
      ];

      for (const [collection, info] of Object.entries(this.collectionMap)) {
        if (highPriorityCollections.includes(collection)) {
          collectionsToCheck.push([collection, info]);
        }
      }
    }

    console.log(`📊 ${usingMedicalDataOptimization ? 'OPTIMIZED' : 'FALLBACK'}: Checking ${collectionsToCheck.length} collections`);

    // Process in smaller batches for better performance
    const batchSize = 5; // Small batches for faster response
    const batches = [];
    for (let i = 0; i < collectionsToCheck.length; i += batchSize) {
      batches.push(collectionsToCheck.slice(i, i + batchSize));
    }

    console.log(`   Processing ${collectionsToCheck.length} collections in FULL PARALLEL mode (optimized)`);

    // OPTIMIZED: Process ALL collections in parallel, not in sequential batches
    const allQueries = collectionsToCheck.map(async ([category, info]) => {
      try {
        const data = await this.getMedicalData(category, patientIdObj, { limit: 5 }, context);  // Only get 5 records per category for speed
        if (data && data.length > 0) {
          return { category, data, success: true };
        }
        return { category, data: [], success: true };
      } catch (error) {
        // Log but continue - don't let one error stop everything
        if (!error.message?.includes('does not exist') && !error.message?.includes('timeout')) {
          console.log(`⚠️ Could not fetch ${category}: ${error.message}`);
        }
        return { category, data: [], success: false, error: error.message };
      }
    });

    // Execute ALL queries in parallel using Promise.allSettled for fault tolerance
    console.log(`⚡ Executing ${allQueries.length} MongoDB queries in parallel...`);
    const startTime = Date.now();
    const results = await Promise.allSettled(allQueries);
    console.log(`✅ All queries completed in ${Date.now() - startTime}ms`);

    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { category, data, success } = result.value;
        collectionsChecked++;
        if (success && data && data.length > 0) {
          medicalHistory[category] = data;
          totalRecords += data.length;
          collectionsWithData++;
          console.log(`  ✅ ${category}: ${data.length} records`);
        } else {
          console.log(`  ⚠️ ${category}: 0 records (success: ${success})`);
        }
      } else {
        console.log(`  ❌ ${result.reason}`);
      }
    }

    console.log(`✅ Medical history search complete:`);
    console.log(`   - Checked ${collectionsChecked} collections`);
    console.log(`   - Found data in ${collectionsWithData} collections`);
    console.log(`   - Total records: ${totalRecords}`);

    return medicalHistory;
  }

  /**
   * Store extracted medical data from document analysis
   * @param {Object} extractedData - Data extracted from document analysis
   * @param {ObjectId} patientId - Patient ID
   * @param {ObjectId} documentId - Document ID
   * @param {Object} context - Security context
   */
  async storeExtractedMedicalData(extractedData, patientId, documentId, context) {
    if (!this.initialized) {
      throw new Error('MedicalDataService not initialized. Service should be initialized at startup.');
    }
    
    const results = {
      stored: [],
      failed: []
    };
    
    // Store diagnoses as consultation notes
    if (extractedData.diagnoses && extractedData.diagnoses.length > 0) {
      for (const diagnosis of extractedData.diagnoses) {
        try {
          await this.storeMedicalData('consultation_notes', {
            patientId,
            documentId,
            date: extractedData.documentDate || new Date(),
            diagnosis: diagnosis.description || diagnosis.code,
            symptoms: diagnosis.symptoms,
            treatment: diagnosis.treatment,
            doctorName: extractedData.provider,
            practiceName: extractedData.facility,
            notes: diagnosis.notes,
            aiProcessed: true,
            confidence: extractedData.confidence || 0.8,
            source: 'document_extraction'
          }, context);
          results.stored.push({ type: 'consultation', diagnosis: diagnosis.description });
        } catch (error) {
          results.failed.push({ type: 'consultation', error: error.message });
        }
      }
    }
    
    // Store medications as prescriptions
    if (extractedData.medications && extractedData.medications.length > 0) {
      try {
        await this.storeMedicalData('prescriptions', {
          patientId,
          documentId,
          date: extractedData.documentDate || new Date(),
          medications: extractedData.medications.map(med => ({
            name: med.name,
            dosage: med.dosage,
            frequency: med.frequency,
            duration: med.duration,
            instructions: med.instructions,
            route: med.route || 'Oral'
          })),
          prescribingDoctor: extractedData.provider,
          aiProcessed: true,
          source: 'document_extraction'
        }, context);
        results.stored.push({ type: 'prescription', count: extractedData.medications.length });
      } catch (error) {
        results.failed.push({ type: 'prescription', error: error.message });
      }
    }
    
    // Store current medications
    if (extractedData.currentMedications && extractedData.currentMedications.length > 0) {
      for (const med of extractedData.currentMedications) {
        try {
          await this.storeMedicalData('medications', {
            patientId,
            documentId,
            name: med.name,
            dosage: med.dosage,
            frequency: med.frequency,
            route: med.route || 'Oral',
            startDate: med.startDate || new Date(),
            prescribedBy: extractedData.provider,
            active: true,
            source: 'document_extraction'
          }, context);
          results.stored.push({ type: 'medication', name: med.name });
        } catch (error) {
          results.failed.push({ type: 'medication', error: error.message });
        }
      }
    }
    
    // Store allergies
    if (extractedData.allergies && extractedData.allergies.length > 0) {
      for (const allergy of extractedData.allergies) {
        try {
          // Check if allergy already exists
          const existing = await this._secureDataAccess.query('allergies', 
            { patientId, allergen: allergy.allergen, status: 'active' },
            { limit: 1 },
            context
          );
          
          if (existing.length === 0) {
            await this.storeMedicalData('allergies', {
              patientId,
              documentId,
              allergen: allergy.allergen,
              reaction: allergy.reaction,
              severity: allergy.severity || 'moderate',
              dateIdentified: extractedData.documentDate || new Date(),
              status: 'active',
              source: 'document_extraction'
            }, context);
            results.stored.push({ type: 'allergy', allergen: allergy.allergen });
          }
        } catch (error) {
          results.failed.push({ type: 'allergy', error: error.message });
        }
      }
    }
    
    // Store lab results
    if (extractedData.labResults && extractedData.labResults.length > 0) {
      try {
        await this.storeMedicalData('lab_results', {
          patientId,
          documentId,
          date: extractedData.documentDate || new Date(),
          testType: extractedData.testType || 'General Lab Panel',
          results: extractedData.labResults.map(result => ({
            parameter: result.testName || result.parameter,
            value: result.value,
            unit: result.unit,
            referenceRange: result.referenceRange,
            flag: result.flag || 'normal'
          })),
          labName: extractedData.facility,
          orderedBy: extractedData.provider,
          aiProcessed: true,
          source: 'document_extraction'
        }, context);
        results.stored.push({ type: 'lab_results', count: extractedData.labResults.length });
      } catch (error) {
        results.failed.push({ type: 'lab_results', error: error.message });
      }
    }
    
    // Store procedures
    if (extractedData.procedures && extractedData.procedures.length > 0) {
      for (const procedure of extractedData.procedures) {
        try {
          await this.storeMedicalData('medical_procedures', {
            patientId,
            documentId,
            date: procedure.date || extractedData.documentDate || new Date(),
            procedure: procedure.name,
            surgeon: procedure.provider || extractedData.provider,
            findings: procedure.findings,
            outcome: procedure.outcome,
            complications: procedure.complications,
            facility: extractedData.facility,
            aiProcessed: true,
            source: 'document_extraction'
          }, context);
          results.stored.push({ type: 'procedure', name: procedure.name });
        } catch (error) {
          results.failed.push({ type: 'procedure', error: error.message });
        }
      }
    }
    
    console.log(`✅ Stored medical data: ${results.stored.length} items, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Delete medical data for a patient (for cleanup or GDPR compliance)
   * @param {ObjectId} patientId - Patient ID
   * @param {String} category - Optional specific category to delete
   * @param {Object} context - Security context
   */
  async deleteMedicalData(patientId, category = null, context) {
    if (!this.initialized) {
      throw new Error('MedicalDataService not initialized. Service should be initialized at startup.');
    }

    // Ensure patientId is a string for queries
    const patientIdStr = typeof patientId === 'object' && patientId.toString ? patientId.toString() : String(patientId);

    const results = {
      deleted: {},
      failed: []
    };

    const categoriesToDelete = category ? [category] : Object.keys(this.collectionMap);

    for (const cat of categoriesToDelete) {
      const collectionInfo = this.collectionMap[cat];
      if (!collectionInfo) continue;

      // Skip non-existent collections
      if (this.existingCollections.size > 0 && !this.existingCollections.has(collectionInfo.collection)) {
        continue;
      }

      try {
        const deleteResult = await this._secureDataAccess.delete(
          collectionInfo.collection,
          { patientId: patientIdStr },
          context,
          { multi: true }
        );
        
        results.deleted[cat] = deleteResult.deletedCount || 0;
        
        // Update count in patient record
        if (collectionInfo.countField) {
          const updateObj = {};
          updateObj[collectionInfo.countField] = 0;
          await this._secureDataAccess.update('patients', 
            { _id: new ObjectId(patientId) }, 
            { $set: updateObj },
            context
          );
        }
      } catch (error) {
        results.failed.push({ category: cat, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Ensure patientId index exists on a medical collection
   * Creates index if it doesn't exist (non-blocking, cached)
   * @param {String} collectionName - Collection to index
   * @param {Object} context - Security context
   */
  async ensurePatientIdIndex(collectionName, context) {
    // Cache to avoid checking the same collection multiple times
    if (!this.indexedCollections) {
      this.indexedCollections = new Set();
    }

    // Skip if we already created/checked this index
    if (this.indexedCollections.has(collectionName)) {
      return;
    }

    try {
      // Get database connection
      const dbName = context.practiceSubdomain
        ? `intellicare_practice_${context.practiceSubdomain}`
        : 'intellicare_practice_global';

      // Use SecureDataAccess to get the collection
      const db = await this._secureDataAccess.getDatabase(dbName, context);
      const collection = db.collection(collectionName);

      // Check if patientId index exists
      const indexes = await collection.indexes();
      const hasPatientIdIndex = indexes.some(idx => idx.key.patientId !== undefined);

      if (!hasPatientIdIndex) {
        // Create index in background (non-blocking)
        await collection.createIndex(
          { patientId: 1 },
          {
            name: 'patientId_1',
            background: true  // Don't block other operations
          }
        );
        console.log(`✅ Created patientId index on ${collectionName}`);
      }

      // Mark as indexed
      this.indexedCollections.add(collectionName);
    } catch (error) {
      // Log but don't fail - indexing is a performance optimization
      console.error(`⚠️ Failed to ensure index on ${collectionName}:`, error.message);
    }
  }
}

// Export singleton instance
module.exports = new MedicalDataService();// Trigger restart
