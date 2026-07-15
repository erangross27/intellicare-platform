/**
 * PDF Template Router
 *
 * Maps collection names to their dedicated PDF templates
 * Each template knows exactly how to render its specific medical data
 */

import AllergyAssessmentTemplate from './AllergyAssessmentTemplate';
import AllergyImmunologyAssessmentTemplate from './AllergyImmunologyAssessmentPDFTemplate';
import BiopsyReportsTemplate from './BiopsyReportsTemplate';
import CaseSummariesTemplate from './CaseSummariesTemplate';
// Single source of truth: route to the same audited template the Document export button imports.
import SecondOpinionReportsTemplate from './SecondOpinionReportsDocumentPDFTemplate';
import PrognosisTemplate from './PrognosisDocumentPDFTemplate';
import CareCoordinationNotesTemplate from './CareCoordinationNotesTemplate';
import AssessmentPlansTemplate from './AssessmentPlansPDFTemplate';
import TreatmentCoursesTemplate from './TreatmentCoursesTemplate';
import CareCoordinationTemplate from './CareCoordinationTemplate';
import MonitoringPlanTemplate from './MonitoringPlanTemplate';
import PatientEducationRecordsTemplate from './PatientEducationRecordsTemplate';
// Single source of truth: route to the same box-free template the Document's Export button imports
// (the legacy ./ClinicalDecisionSupportTemplate diverged — boxed, small fonts, no numbering).
import ClinicalDecisionSupportTemplate from './ClinicalDecisionSupportPDFTemplate';
import IntelligentRecommendationsTemplate from './IntelligentRecommendationsTemplate';
import TrendingAnalysisTemplate from './TrendingAnalysisTemplate';
import PatientSpecificCarePlanTemplate from './PatientSpecificCarePlanTemplate';
import MedicationOptimizationTemplate from './MedicationOptimizationTemplate';
import FollowUpIntelligenceTemplate from './FollowUpIntelligenceTemplate';
import FollowUpAppointmentsTemplate from './FollowUpAppointmentsTemplate';
import PatientEducationContextTemplate from './PatientEducationContextTemplate';
import CareGapsTemplate from './CareGapsTemplate';
import OutcomesPredictionTemplate from './OutcomesPredictionTemplate';
// Single source of truth: route to the same box-free template the Document's Export button imports
// (the legacy ./GuidelineComplianceTemplate diverged — boxed, small fonts, side-by-side labels, no numbering).
import GuidelineComplianceTemplate from './GuidelineComplianceDocumentPDFTemplate';
import QualityMetricsTemplate from './QualityMetricsDocumentPDFTemplate';
import RadiationTherapyRecordsDocumentPDFTemplate from './RadiationTherapyRecordsDocumentPDFTemplate';
import RadiologyFindingsDocumentPDFTemplate from './RadiologyFindingsDocumentPDFTemplate';
import RadiologyReportsDocumentPDFTemplate from './RadiologyReportsDocumentPDFTemplate';
import RapidResponseSummariesDocumentPDFTemplate from './RapidResponseSummariesDocumentPDFTemplate';
import ReadmissionRiskAssessmentDocumentPDFTemplate from './ReadmissionRiskAssessmentDocumentPDFTemplate';
import ReasonForReferralDocumentPDFTemplate from './ReasonForReferralDocumentPDFTemplate';
import ReferralsDocumentPDFTemplate from './ReferralsDocumentPDFTemplate';
import ConsultationNotesTemplate from './ConsultationNotesTemplate';
// Single source of truth: route to the same box-free template the Document's Export button imports
// (the legacy ./ProgressNotesPDFTemplate was renamed to the standard ...DocumentPDFTemplate).
import ProgressNotesTemplate from './ProgressNotesDocumentPDFTemplate';
import DischargeSummariesTemplate from './DischargeSummariesTemplate';
import HospitalDischargeSummariesTemplate from './HospitalDischargeSummariesDocumentPDFTemplate';
import EmergencyDischargeSummariesTemplate from './EmergencyDischargeSummariesDocumentPDFTemplate';
import EmergencyReportsTemplate from './EmergencyReportsDocumentPDFTemplate';
import AdmissionRecommendationsTemplate from './AdmissionRecommendationsDocumentPDFTemplate';
import TriageDataTemplate from './TriageDataDocumentPDFTemplate';
import EdCourseTemplate from './EdCourseDocumentPDFTemplate';
import EdDispositionTemplate from './EdDispositionDocumentPDFTemplate';
import OperativeReportsTemplate from './OperativeReportsTemplate';
import AdmissionAssessmentsTemplate from './AdmissionAssessmentsTemplate';
import HospitalAdmissionNotesTemplate from './HospitalAdmissionNotesTemplate';
import HistoryPresentIllnessTemplate from './HistoryPresentIllnessTemplate';
import PathologyReportsTemplate from './PathologyReportsTemplate';
import DoctorsMedicationsRecommendationsOptimizationsTemplate from './DoctorsMedicationsRecommendationsOptimizationsTemplate';
import CurrentMedicationsTemplate from './CurrentMedicationsTemplate';
// Single source of truth: the box-free dual-schema PDF the Document's Export button imports.
import DoctorsMedicationsRecommendationsTemplate from './DoctorsMedicationRecommendationsDocumentPDFTemplate';
import MedicationsOptimizationsTemplate from './MedicationsOptimizationsTemplate';
import MedicationsDocumentPDFTemplate from './MedicationsDocumentPDFTemplate';
import PsychiatricEvaluationsDocumentPDFTemplate from './PsychiatricEvaluationsDocumentPDFTemplate';
import NeuropsychologicalAssessmentsTemplate from './NeuropsychologicalAssessmentsTemplate';
import GeriatricAssessmentsTemplate from './GeriatricAssessmentsTemplate';
import FunctionalAssessmentTemplate from './FunctionalAssessmentTemplate';
import PhysicalExaminationsDocumentPDFTemplate from './PhysicalExaminationsDocumentPDFTemplate';
import DiagnosesTemplate from './DiagnosesDocumentPDFTemplate';
import AnesthesiaRecordsTemplate from './AnesthesiaRecordsDocumentPDFTemplate';
import RecommendationsTemplate from './RecommendationsTemplate';
// Single source of truth: route to the same box-free template the Document's Export button imports
// (the legacy ./ClinicalScoresTemplate diverged — boxed, small fonts, no numbering).
import ClinicalScoresTemplate from './ClinicalScoresDocumentPDFTemplate';
import AdministrativeDataTemplate from './AdministrativeDataTemplate';
import MedicalProceduresTemplate from './MedicalProceduresTemplate';
import LabResultsTemplate from './LabResultsTemplate';
import AdditionalDataPDFTemplate from './AdditionalDataPDFTemplate';
import IntraoperativeMonitoringDocumentPDFTemplate from './IntraoperativeMonitoringDocumentPDFTemplate';
import ImagingReportsPDFTemplate from './ImagingReportsPDFTemplate';
import AirwayManagementPDFTemplate from './AirwayManagementPDFTemplate';
import RegionalAnesthesiaDocumentPDFTemplate from './RegionalAnesthesiaDocumentPDFTemplate';
import RehabilitationGoalsDocumentPDFTemplate from './RehabilitationGoalsDocumentPDFTemplate';
import RehabilitationProgressNotesDocumentPDFTemplate from './RehabilitationProgressNotesDocumentPDFTemplate';
import RehabilitationProtocolDocumentPDFTemplate from './RehabilitationProtocolDocumentPDFTemplate';
import RenalAnemiaDocumentPDFTemplate from './RenalAnemiaDocumentPDFTemplate';
import RenalNutritionDocumentPDFTemplate from './RenalNutritionDocumentPDFTemplate';
import RenalProtectionPlanDocumentPDFTemplate from './RenalProtectionPlanDocumentPDFTemplate';
import ChronicPainAssessmentPDFTemplate from './ChronicPainAssessmentPDFTemplate';
import AsthmaAssessmentsPDFTemplate from './AsthmaAssessmentsPDFTemplate';
import PastMedicalHistoryPDFTemplate from './PastMedicalHistoryDocumentPDFTemplate';
import AcmgGuidelinesReferencePDFTemplate from './AcmgGuidelinesReferenceDocumentPDFTemplate';
import StagingSummaryDocumentPDFTemplate from './StagingSummaryDocumentPDFTemplate';
import StemCellTransplantAssessmentDocumentPDFTemplate from './StemCellTransplantAssessmentDocumentPDFTemplate';
import StiScreeningPanelDocumentPDFTemplate from './StiScreeningPanelDocumentPDFTemplate';
import StressManagementReferralsDocumentPDFTemplate from './StressManagementReferralsDocumentPDFTemplate';
import StressTestReportsDocumentPDFTemplate from './StressTestReportsDocumentPDFTemplate';
import StrokeAssessmentDocumentPDFTemplate from './StrokeAssessmentDocumentPDFTemplate';
import SubstanceUseAssessmentDocumentPDFTemplate from './SubstanceUseAssessmentDocumentPDFTemplate';
import SuicideRiskAssessmentDocumentPDFTemplate from './SuicideRiskAssessmentDocumentPDFTemplate';
import SupplementationPlansDocumentPDFTemplate from './SupplementationPlansDocumentPDFTemplate';
import SupportiveCareDocumentPDFTemplate from './SupportiveCareDocumentPDFTemplate';
import SurgicalApproachDocumentPDFTemplate from './SurgicalApproachDocumentPDFTemplate';
import SurgicalConsentFormsDocumentPDFTemplate from './SurgicalConsentFormsDocumentPDFTemplate';
import SurgicalHistoryDocumentPDFTemplate from './SurgicalHistoryDocumentPDFTemplate';

// Template registry - add new templates here
const templateRegistry = {
  'acmg_guidelines_reference': AcmgGuidelinesReferencePDFTemplate,
  'allergy_assessment': AllergyAssessmentTemplate,
  'allergy_immunology_assessment': AllergyImmunologyAssessmentTemplate,
  'asthma_assessments': AsthmaAssessmentsPDFTemplate,
  'past_medical_history': PastMedicalHistoryPDFTemplate,
  'biopsy_reports': BiopsyReportsTemplate,
  'case_summaries': CaseSummariesTemplate,
  'second_opinion_reports': SecondOpinionReportsTemplate,
  'prognosis': PrognosisTemplate,
  'care_coordination_notes': CareCoordinationNotesTemplate,
  'assessment_plans': AssessmentPlansTemplate,
  'treatment_courses': TreatmentCoursesTemplate,
  'care_coordination': CareCoordinationTemplate,
  'monitoring_plan': MonitoringPlanTemplate,
  'patient_education_records': PatientEducationRecordsTemplate,
  'clinical_decision_support': ClinicalDecisionSupportTemplate,
  'intelligent_recommendations': IntelligentRecommendationsTemplate,
  'trending_analysis': TrendingAnalysisTemplate,
  'patient_specific_care_plan': PatientSpecificCarePlanTemplate,
  'medication_optimization': MedicationOptimizationTemplate,
  'follow_up_intelligence': FollowUpIntelligenceTemplate,
  'follow_up_appointments': FollowUpAppointmentsTemplate,
  'patient_education_context': PatientEducationContextTemplate,
  'care_gaps': CareGapsTemplate,
  'outcomes_prediction': OutcomesPredictionTemplate,
  'guideline_compliance': GuidelineComplianceTemplate,
  'quality_metrics': QualityMetricsTemplate,
  'radiation_therapy_records': RadiationTherapyRecordsDocumentPDFTemplate,
  'radiology_findings': RadiologyFindingsDocumentPDFTemplate,
  'radiology_reports': RadiologyReportsDocumentPDFTemplate,
  'rapid_response_summaries': RapidResponseSummariesDocumentPDFTemplate,
  'readmission_risk_assessment': ReadmissionRiskAssessmentDocumentPDFTemplate,
  'reason_for_referral': ReasonForReferralDocumentPDFTemplate,
  'referrals': ReferralsDocumentPDFTemplate,
  'consultation_notes': ConsultationNotesTemplate,
  'progress_notes': ProgressNotesTemplate,
  'discharge_summaries': DischargeSummariesTemplate,
  'hospital_discharge_summaries': HospitalDischargeSummariesTemplate,
  'emergency_discharge_summaries': EmergencyDischargeSummariesTemplate,
  'emergency_reports': EmergencyReportsTemplate,
  'admission_recommendations': AdmissionRecommendationsTemplate,
  'triage_data': TriageDataTemplate,
  'ed_course': EdCourseTemplate,
  'ed_disposition': EdDispositionTemplate,
  'operative_reports': OperativeReportsTemplate,
  'admission_assessments': AdmissionAssessmentsTemplate,
  'hospital_admission_notes': HospitalAdmissionNotesTemplate,
  'history_present_illness': HistoryPresentIllnessTemplate,
  'pathology_reports': PathologyReportsTemplate,
  'doctors_medications_recommendations_optimizations': DoctorsMedicationsRecommendationsOptimizationsTemplate,
  'current_medications': CurrentMedicationsTemplate,
  'doctors_medications_recommendations': DoctorsMedicationsRecommendationsTemplate,
  'doctors_medication_recommendations': DoctorsMedicationsRecommendationsTemplate, // singular legacy flat schema — same box-free dual-schema PDF
  'medications_optimizations': MedicationsOptimizationsTemplate,
  'medications': MedicationsDocumentPDFTemplate,
  'psychiatric_evaluations': PsychiatricEvaluationsDocumentPDFTemplate,
  'neuropsychological_assessments': NeuropsychologicalAssessmentsTemplate,
  'geriatric_assessments': GeriatricAssessmentsTemplate,
  'functional_assessment': FunctionalAssessmentTemplate,
  'physical_examinations': PhysicalExaminationsDocumentPDFTemplate,
  'diagnoses': DiagnosesTemplate,
  'anesthesia_records': AnesthesiaRecordsTemplate,
  'recommendations': RecommendationsTemplate,
  'clinical_scores': ClinicalScoresTemplate,
  'administrative_data': AdministrativeDataTemplate,
  'medical_procedures': MedicalProceduresTemplate,
  'lab_results': LabResultsTemplate,
  'additional_data': AdditionalDataPDFTemplate,
  'intraoperative_monitoring': IntraoperativeMonitoringDocumentPDFTemplate,
  'imaging_reports': ImagingReportsPDFTemplate,
  'airway_management_records': AirwayManagementPDFTemplate,
  'regional_anesthesia_records': RegionalAnesthesiaDocumentPDFTemplate,
  'rehabilitation_goals': RehabilitationGoalsDocumentPDFTemplate,
  'rehabilitation_progress_notes': RehabilitationProgressNotesDocumentPDFTemplate,
  'rehabilitation_protocol': RehabilitationProtocolDocumentPDFTemplate,
  'renal_anemia': RenalAnemiaDocumentPDFTemplate,
  'renal_nutrition': RenalNutritionDocumentPDFTemplate,
  'renal_protection_plan': RenalProtectionPlanDocumentPDFTemplate,
  'chronic_pain_assessment': ChronicPainAssessmentPDFTemplate,
  'staging_summary': StagingSummaryDocumentPDFTemplate,
  'stem_cell_transplant_assessment': StemCellTransplantAssessmentDocumentPDFTemplate,
  'sti_screening_panel': StiScreeningPanelDocumentPDFTemplate,
  'stress_management_referrals': StressManagementReferralsDocumentPDFTemplate,
  'stress_test_reports': StressTestReportsDocumentPDFTemplate,
  'stroke_assessment': StrokeAssessmentDocumentPDFTemplate,
  'substance_use_assessment': SubstanceUseAssessmentDocumentPDFTemplate,
  'suicide_risk_assessment': SuicideRiskAssessmentDocumentPDFTemplate,
  'supplementation_plans': SupplementationPlansDocumentPDFTemplate,
  'supportive_care': SupportiveCareDocumentPDFTemplate,
  'surgical_approach': SurgicalApproachDocumentPDFTemplate,
  'surgical_consent_forms': SurgicalConsentFormsDocumentPDFTemplate,
  'surgical_history': SurgicalHistoryDocumentPDFTemplate,
};

/**
 * Get the appropriate template component for a collection
 * @param {string} category - Collection name (e.g., 'asthma_assessment')
 * @returns {Component|null} - Template component or null if not found
 */
export const getTemplateForCollection = (category) => {
  const template = templateRegistry[category] || null;
  return template;
};

/**
 * Check if a collection has a dedicated template
 * @param {string} category - Collection name
 * @returns {boolean}
 */
export const hasTemplate = (category) => {
  return category in templateRegistry;
};

export default templateRegistry;
