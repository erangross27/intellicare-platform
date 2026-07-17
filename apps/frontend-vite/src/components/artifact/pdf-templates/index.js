/**
 * PDF Template Router
 *
 * Maps collection names to their dedicated PDF templates
 * Each template knows exactly how to render its specific medical data
 */

import AbnormalResultsDocumentPDFTemplate from './AbnormalResultsDocumentPDFTemplate';
import AccessPlanningDocumentPDFTemplate from './AccessPlanningDocumentPDFTemplate';
import AllergyAssessmentTemplate from './AllergyAssessmentTemplate';
import AllergyImmunologyAssessmentDocumentPDFTemplate from './AllergyImmunologyAssessmentDocumentPDFTemplate';
import AllergySkinTestingDocumentPDFTemplate from './AllergySkinTestingDocumentPDFTemplate';
import AmniocentesisReportsDocumentPDFTemplate from './AmniocentesisReportsDocumentPDFTemplate';
import AmnioticFluidAssessmentDocumentPDFTemplate from './AmnioticFluidAssessmentDocumentPDFTemplate';
import AmnioticFluidIndexCurrentDocumentPDFTemplate from './AmnioticFluidIndexCurrentDocumentPDFTemplate';
import AnatomyScanResultDocumentPDFTemplate from './AnatomyScanResultDocumentPDFTemplate';
import AnesthesiaConsentDocumentPDFTemplate from './AnesthesiaConsentDocumentPDFTemplate';
import ArterialBloodGasesDocumentPDFTemplate from './ArterialBloodGasesDocumentPDFTemplate';
import ArthritisAssessmentsDocumentPDFTemplate from './ArthritisAssessmentsDocumentPDFTemplate';
import ArticularCartilageDocumentPDFTemplate from './ArticularCartilageDocumentPDFTemplate';
import AllergiesDocumentPDFTemplate from './AllergiesDocumentPDFTemplate';
import AllergiesAssessmentDocumentPDFTemplate from './AllergiesAssessmentDocumentPDFTemplate';
import AllergyAssessmentsDocumentPDFTemplate from './AllergyAssessmentsDocumentPDFTemplate';
import BiopsyReportsTemplate from './BiopsyReportsTemplate';
import CaseSummariesTemplate from './CaseSummariesTemplate';
// Single source of truth: route to the same audited template the Document export button imports.
import SecondOpinionReportsTemplate from './SecondOpinionReportsDocumentPDFTemplate';
import PrognosisTemplate from './PrognosisDocumentPDFTemplate';
import CareCoordinationNotesTemplate from './CareCoordinationNotesTemplate';
import AssessmentPlansDocumentPDFTemplate from './AssessmentPlansDocumentPDFTemplate';
import AssistiveDevicesDocumentPDFTemplate from './AssistiveDevicesDocumentPDFTemplate';
import TreatmentCoursesDocumentPDFTemplate from './TreatmentCoursesDocumentPDFTemplate';
import TreatmentGoalsDocumentPDFTemplate from './TreatmentGoalsDocumentPDFTemplate';
import TreatmentPlansDocumentPDFTemplate from './TreatmentPlansDocumentPDFTemplate';
import TreatmentSummaryDocumentPDFTemplate from './TreatmentSummaryDocumentPDFTemplate';
import TrendAnalysisDocumentPDFTemplate from './TrendAnalysisDocumentPDFTemplate';
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
import AdmissionRecommendationsDocumentPDFTemplate from './AdmissionRecommendationsDocumentPDFTemplate';
import AdultDayProgramInfoDocumentPDFTemplate from './AdultDayProgramInfoDocumentPDFTemplate';
import AdvanceCarePlanningDocumentPDFTemplate from './AdvanceCarePlanningDocumentPDFTemplate';
import AdvanceDirectiveDiscussionDocumentPDFTemplate from './AdvanceDirectiveDiscussionDocumentPDFTemplate';
import AdvanceDirectivesDocumentPDFTemplate from './AdvanceDirectivesDocumentPDFTemplate';
import AirwayClearanceTherapyDocumentPDFTemplate from './AirwayClearanceTherapyDocumentPDFTemplate';
import TriageDataTemplate from './TriageDataDocumentPDFTemplate';
import EdCourseTemplate from './EdCourseDocumentPDFTemplate';
import EdDispositionTemplate from './EdDispositionDocumentPDFTemplate';
import OperativeReportsTemplate from './OperativeReportsTemplate';
import AdmissionAssessmentsDocumentPDFTemplate from './AdmissionAssessmentsDocumentPDFTemplate';
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
import AnesthesiaRecordsDocumentPDFTemplate from './AnesthesiaRecordsDocumentPDFTemplate';
import AnesthesiologyAssessmentDocumentPDFTemplate from './AnesthesiologyAssessmentDocumentPDFTemplate';
import AnnualPhysicalExaminationDocumentPDFTemplate from './AnnualPhysicalExaminationDocumentPDFTemplate';
import AntibiogramReportsDocumentPDFTemplate from './AntibiogramReportsDocumentPDFTemplate';
import AntibioticStewardshipDocumentPDFTemplate from './AntibioticStewardshipDocumentPDFTemplate';
import AnticipatoryGuidanceDocumentPDFTemplate from './AnticipatoryGuidanceDocumentPDFTemplate';
import AnticoagulationManagementDocumentPDFTemplate from './AnticoagulationManagementDocumentPDFTemplate';
import AntimicrobialSusceptibilityDocumentPDFTemplate from './AntimicrobialSusceptibilityDocumentPDFTemplate';
import AorticAneurysmSurveillanceDocumentPDFTemplate from './AorticAneurysmSurveillanceDocumentPDFTemplate';
import ApgarScoresDocumentPDFTemplate from './ApgarScoresDocumentPDFTemplate';
import AppetiteStimulantsDocumentPDFTemplate from './AppetiteStimulantsDocumentPDFTemplate';
import RecommendationsTemplate from './RecommendationsTemplate';
// Single source of truth: route to the same box-free template the Document's Export button imports
// (the legacy ./ClinicalScoresTemplate diverged — boxed, small fonts, no numbering).
import ClinicalScoresTemplate from './ClinicalScoresDocumentPDFTemplate';
import AdministrativeDataDocumentPDFTemplate from './AdministrativeDataDocumentPDFTemplate';
import MedicalProceduresTemplate from './MedicalProceduresTemplate';
import LabResultsTemplate from './LabResultsTemplate';
import AdditionalDataPDFTemplate from './AdditionalDataPDFTemplate';
import IntraoperativeMonitoringDocumentPDFTemplate from './IntraoperativeMonitoringDocumentPDFTemplate';
import ImagingReportsPDFTemplate from './ImagingReportsPDFTemplate';
import AirwayManagementDocumentPDFTemplate from './AirwayManagementDocumentPDFTemplate';
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
import AcmgGuidelinesReferenceDocumentPDFTemplate from './AcmgGuidelinesReferenceDocumentPDFTemplate';
import AcuteKidneyInjuryDocumentPDFTemplate from './AcuteKidneyInjuryDocumentPDFTemplate';
import AddictionMedicineConsultationsDocumentPDFTemplate from './AddictionMedicineConsultationsDocumentPDFTemplate';
import ADHDAssessmentDocumentPDFTemplate from './ADHDAssessmentDocumentPDFTemplate';
import StagingSummaryDocumentPDFTemplate from './StagingSummaryDocumentPDFTemplate';
import StemCellTransplantAssessmentDocumentPDFTemplate from './StemCellTransplantAssessmentDocumentPDFTemplate';
import TransplantAssessmentDocumentPDFTemplate from './TransplantAssessmentDocumentPDFTemplate';
import TransplantEvaluationsDocumentPDFTemplate from './TransplantEvaluationsDocumentPDFTemplate';
import TraumaAssessmentDocumentPDFTemplate from './TraumaAssessmentDocumentPDFTemplate';
import TraumaFlowSheetsDocumentPDFTemplate from './TraumaFlowSheetsDocumentPDFTemplate';
import TraumaScoringDocumentPDFTemplate from './TraumaScoringDocumentPDFTemplate';
import TravelHealthCertificatesDocumentPDFTemplate from './TravelHealthCertificatesDocumentPDFTemplate';
import TravelMedicineAssessmentDocumentPDFTemplate from './TravelMedicineAssessmentDocumentPDFTemplate';
import TravelVaccinationRecordsDocumentPDFTemplate from './TravelVaccinationRecordsDocumentPDFTemplate';
import TropicalDiseaseAssessmentDocumentPDFTemplate from './TropicalDiseaseAssessmentDocumentPDFTemplate';
import TubeFeedingOrderDocumentPDFTemplate from './TubeFeedingOrderDocumentPDFTemplate';
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
import SurgicalOncologyDocumentPDFTemplate from './SurgicalOncologyDocumentPDFTemplate';
import SurgicalStepsDocumentPDFTemplate from './SurgicalStepsDocumentPDFTemplate';
import SurgicalTeamDocumentPDFTemplate from './SurgicalTeamDocumentPDFTemplate';
import SurrogacyEvaluationDocumentPDFTemplate from './SurrogacyEvaluationDocumentPDFTemplate';
import SurvivorshipCarePlanDocumentPDFTemplate from './SurvivorshipCarePlanDocumentPDFTemplate';
import SymptomProgressionDocumentPDFTemplate from './SymptomProgressionDocumentPDFTemplate';
import SymptomProgressionTimelineDocumentPDFTemplate from './SymptomProgressionTimelineDocumentPDFTemplate';
import SyphilisTreatmentFollowUpDocumentPDFTemplate from './SyphilisTreatmentFollowUpDocumentPDFTemplate';
import TelemedicineEncountersDocumentPDFTemplate from './TelemedicineEncountersDocumentPDFTemplate';
import TherapyProgressNotesDocumentPDFTemplate from './TherapyProgressNotesDocumentPDFTemplate';
import TherapyRequestsDocumentPDFTemplate from './TherapyRequestsDocumentPDFTemplate';
import TherapySessionNotesDocumentPDFTemplate from './TherapySessionNotesDocumentPDFTemplate';
import ThoracicSurgeryAssessmentDocumentPDFTemplate from './ThoracicSurgeryAssessmentDocumentPDFTemplate';
import TumorMarkersDocumentPDFTemplate from './TumorMarkersDocumentPDFTemplate';
import UltrasoundObReportsDocumentPDFTemplate from './UltrasoundObReportsDocumentPDFTemplate';
import UmbilicalArteryDopplerDocumentPDFTemplate from './UmbilicalArteryDopplerDocumentPDFTemplate';
import UrodynamicStudiesDocumentPDFTemplate from './UrodynamicStudiesDocumentPDFTemplate';
import UrologyAssessmentDocumentPDFTemplate from './UrologyAssessmentDocumentPDFTemplate';
import UrologyConsultationsDocumentPDFTemplate from './UrologyConsultationsDocumentPDFTemplate';
import VaccinationRecordsDocumentPDFTemplate from './VaccinationRecordsDocumentPDFTemplate';
import VariantInterpretationGuidelinesDocumentPDFTemplate from './VariantInterpretationGuidelinesDocumentPDFTemplate';
import VascularBypassSurgeryDocumentPDFTemplate from './VascularBypassSurgeryDocumentPDFTemplate';
import VascularSurgeryAssessmentDocumentPDFTemplate from './VascularSurgeryAssessmentDocumentPDFTemplate';
import VasculitisAssessmentDocumentPDFTemplate from './VasculitisAssessmentDocumentPDFTemplate';
import VenousInsufficiencyAssessmentDocumentPDFTemplate from './VenousInsufficiencyAssessmentDocumentPDFTemplate';
import VenousThromboembolismRiskDocumentPDFTemplate from './VenousThromboembolismRiskDocumentPDFTemplate';
import VentilatorSettingsDocumentPDFTemplate from './VentilatorSettingsDocumentPDFTemplate';
import VentilatorWeaningProtocolDocumentPDFTemplate from './VentilatorWeaningProtocolDocumentPDFTemplate';
import VisionTherapyAssessmentDocumentPDFTemplate from './VisionTherapyAssessmentDocumentPDFTemplate';
import VisualAcuityReportsDocumentPDFTemplate from './VisualAcuityReportsDocumentPDFTemplate';
import VitalSignsDocumentPDFTemplate from './VitalSignsDocumentPDFTemplate';
import VitalSignsMonitoringDocumentPDFTemplate from './VitalSignsMonitoringDocumentPDFTemplate';
import VitalSignsTableDocumentPDFTemplate from './VitalSignsTableDocumentPDFTemplate';
import WeeklyVirtualCheckInsDocumentPDFTemplate from './WeeklyVirtualCheckInsDocumentPDFTemplate';
import WeightMeasurementsDocumentPDFTemplate from './WeightMeasurementsDocumentPDFTemplate';
import WeightMonitoringDocumentPDFTemplate from './WeightMonitoringDocumentPDFTemplate';
import WellChildExaminationsDocumentPDFTemplate from './WellChildExaminationsDocumentPDFTemplate';
import WellChildSummaryDocumentPDFTemplate from './WellChildSummaryDocumentPDFTemplate';
import WellnessVisitDocumentationDocumentPDFTemplate from './WellnessVisitDocumentationDocumentPDFTemplate';
import WorkAccommodationsDocumentPDFTemplate from './WorkAccommodationsDocumentPDFTemplate';
import WorkRestrictionsDocumentPDFTemplate from './WorkRestrictionsDocumentPDFTemplate';
import WorkersCompEvaluationsDocumentPDFTemplate from './WorkersCompEvaluationsDocumentPDFTemplate';
import WorkersCompensationEvaluationDocumentPDFTemplate from './WorkersCompensationEvaluationDocumentPDFTemplate';
import WorkplaceAccommodationsDocumentPDFTemplate from './WorkplaceAccommodationsDocumentPDFTemplate';
import WorkplaceInjuryReportDocumentPDFTemplate from './WorkplaceInjuryReportDocumentPDFTemplate';
import WoundCareAssessmentsDocumentPDFTemplate from './WoundCareAssessmentsDocumentPDFTemplate';
import WoundCareDocumentationDocumentPDFTemplate from './WoundCareDocumentationDocumentPDFTemplate';
import WoundCareNotesDocumentPDFTemplate from './WoundCareNotesDocumentPDFTemplate';
import WoundHealingHyperbaricDocumentPDFTemplate from './WoundHealingHyperbaricDocumentPDFTemplate';

// Template registry - add new templates here
const templateRegistry = {
  'abnormal_results': AbnormalResultsDocumentPDFTemplate,
  'access_planning': AccessPlanningDocumentPDFTemplate,
  'acmg_guidelines_reference': AcmgGuidelinesReferenceDocumentPDFTemplate,
  'acute_kidney_injury': AcuteKidneyInjuryDocumentPDFTemplate,
  'addiction_medicine_consultations': AddictionMedicineConsultationsDocumentPDFTemplate,
  'adhd_assessment': ADHDAssessmentDocumentPDFTemplate,
  'allergy_assessment': AllergyAssessmentTemplate,
  'allergy_immunology_assessment': AllergyImmunologyAssessmentDocumentPDFTemplate,
  'allergy_skin_testing': AllergySkinTestingDocumentPDFTemplate,
  'amniocentesis_reports': AmniocentesisReportsDocumentPDFTemplate,
  'amniotic_fluid_assessment': AmnioticFluidAssessmentDocumentPDFTemplate,
  'amniotic_fluid_index_current': AmnioticFluidIndexCurrentDocumentPDFTemplate,
  'anatomy_scan_result': AnatomyScanResultDocumentPDFTemplate,
  'anesthesia_consent': AnesthesiaConsentDocumentPDFTemplate,
  'asthma_assessments': AsthmaAssessmentsPDFTemplate,
  'past_medical_history': PastMedicalHistoryPDFTemplate,
  'biopsy_reports': BiopsyReportsTemplate,
  'case_summaries': CaseSummariesTemplate,
  'second_opinion_reports': SecondOpinionReportsTemplate,
  'prognosis': PrognosisTemplate,
  'care_coordination_notes': CareCoordinationNotesTemplate,
  'assessment_plans': AssessmentPlansDocumentPDFTemplate,
  'assistive_devices': AssistiveDevicesDocumentPDFTemplate,
  'treatment_courses': TreatmentCoursesDocumentPDFTemplate,
  'treatment_goals': TreatmentGoalsDocumentPDFTemplate,
  'treatment_plans': TreatmentPlansDocumentPDFTemplate,
  'treatment_summary': TreatmentSummaryDocumentPDFTemplate,
  'trend_analysis': TrendAnalysisDocumentPDFTemplate,
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
  'admission_recommendations': AdmissionRecommendationsDocumentPDFTemplate,
  'adult_day_program_info': AdultDayProgramInfoDocumentPDFTemplate,
  'advance_care_planning': AdvanceCarePlanningDocumentPDFTemplate,
  'advance_directive_discussion': AdvanceDirectiveDiscussionDocumentPDFTemplate,
  'advance_directives': AdvanceDirectivesDocumentPDFTemplate,
  'airway_clearance_therapy': AirwayClearanceTherapyDocumentPDFTemplate,
  'triage_data': TriageDataTemplate,
  'ed_course': EdCourseTemplate,
  'ed_disposition': EdDispositionTemplate,
  'operative_reports': OperativeReportsTemplate,
  'admission_assessments': AdmissionAssessmentsDocumentPDFTemplate,
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
  'anesthesia_records': AnesthesiaRecordsDocumentPDFTemplate,
  'anesthesiology_assessment': AnesthesiologyAssessmentDocumentPDFTemplate,
  'annual_physical_examination': AnnualPhysicalExaminationDocumentPDFTemplate,
  'antibiogram_reports': AntibiogramReportsDocumentPDFTemplate,
  'antibiotic_stewardship': AntibioticStewardshipDocumentPDFTemplate,
  'anticipatory_guidance': AnticipatoryGuidanceDocumentPDFTemplate,
  'anticoagulation_management': AnticoagulationManagementDocumentPDFTemplate,
  'antimicrobial_susceptibility': AntimicrobialSusceptibilityDocumentPDFTemplate,
  'aortic_aneurysm_surveillance': AorticAneurysmSurveillanceDocumentPDFTemplate,
  'apgar_scores': ApgarScoresDocumentPDFTemplate,
  'appetite_stimulants': AppetiteStimulantsDocumentPDFTemplate,
  'arterial_blood_gases': ArterialBloodGasesDocumentPDFTemplate,
  'arthritis_assessments': ArthritisAssessmentsDocumentPDFTemplate,
  'articular_cartilage': ArticularCartilageDocumentPDFTemplate,
  'recommendations': RecommendationsTemplate,
  'clinical_scores': ClinicalScoresTemplate,
  'administrative_data': AdministrativeDataDocumentPDFTemplate,
  'medical_procedures': MedicalProceduresTemplate,
  'lab_results': LabResultsTemplate,
  'additional_data': AdditionalDataPDFTemplate,
  'intraoperative_monitoring': IntraoperativeMonitoringDocumentPDFTemplate,
  'imaging_reports': ImagingReportsPDFTemplate,
  'airway_management_records': AirwayManagementDocumentPDFTemplate,
  'allergies': AllergiesDocumentPDFTemplate,
  'allergies_assessments': AllergiesAssessmentDocumentPDFTemplate,
  'allergy_assessments': AllergyAssessmentsDocumentPDFTemplate,
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
  'transplant_assessment': TransplantAssessmentDocumentPDFTemplate,
  'transplant_evaluations': TransplantEvaluationsDocumentPDFTemplate,
  'trauma_assessment': TraumaAssessmentDocumentPDFTemplate,
  'trauma_flow_sheets': TraumaFlowSheetsDocumentPDFTemplate,
  'trauma_scoring': TraumaScoringDocumentPDFTemplate,
  'travel_health_certificates': TravelHealthCertificatesDocumentPDFTemplate,
  'travel_medicine_assessment': TravelMedicineAssessmentDocumentPDFTemplate,
  'travel_vaccination_records': TravelVaccinationRecordsDocumentPDFTemplate,
  'tropical_disease_assessment': TropicalDiseaseAssessmentDocumentPDFTemplate,
  'tube_feeding_order': TubeFeedingOrderDocumentPDFTemplate,
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
  'surgical_oncology': SurgicalOncologyDocumentPDFTemplate,
  'surgical_steps': SurgicalStepsDocumentPDFTemplate,
  'surgical_team': SurgicalTeamDocumentPDFTemplate,
  'surrogacy_evaluation': SurrogacyEvaluationDocumentPDFTemplate,
  'survivorship_care_plan': SurvivorshipCarePlanDocumentPDFTemplate,
  'symptom_progression': SymptomProgressionDocumentPDFTemplate,
  'symptom_progression_timeline': SymptomProgressionTimelineDocumentPDFTemplate,
  'syphilis_treatment_follow_up': SyphilisTreatmentFollowUpDocumentPDFTemplate,
  'telemedicine_encounters': TelemedicineEncountersDocumentPDFTemplate,
  'therapy_progress_notes': TherapyProgressNotesDocumentPDFTemplate,
  'therapy_requests': TherapyRequestsDocumentPDFTemplate,
  'therapy_session_notes': TherapySessionNotesDocumentPDFTemplate,
  'thoracic_surgery_assessment': ThoracicSurgeryAssessmentDocumentPDFTemplate,
  'tumor_markers': TumorMarkersDocumentPDFTemplate,
  'ultrasound_ob_reports': UltrasoundObReportsDocumentPDFTemplate,
  'umbilical_artery_doppler': UmbilicalArteryDopplerDocumentPDFTemplate,
  'urodynamic_studies': UrodynamicStudiesDocumentPDFTemplate,
  'urology_assessment': UrologyAssessmentDocumentPDFTemplate,
  'urology_consultations': UrologyConsultationsDocumentPDFTemplate,
  'vaccination_records': VaccinationRecordsDocumentPDFTemplate,
  'variant_interpretation_guidelines': VariantInterpretationGuidelinesDocumentPDFTemplate,
  'vascular_bypass_surgery': VascularBypassSurgeryDocumentPDFTemplate,
  'vascular_surgery_assessment': VascularSurgeryAssessmentDocumentPDFTemplate,
  'vasculitis_assessment': VasculitisAssessmentDocumentPDFTemplate,
  'venous_insufficiency_assessment': VenousInsufficiencyAssessmentDocumentPDFTemplate,
  'venous_thromboembolism_risk': VenousThromboembolismRiskDocumentPDFTemplate,
  'ventilator_settings': VentilatorSettingsDocumentPDFTemplate,
  'ventilator_weaning_protocol': VentilatorWeaningProtocolDocumentPDFTemplate,
  'vision_therapy_assessment': VisionTherapyAssessmentDocumentPDFTemplate,
  'visual_acuity_reports': VisualAcuityReportsDocumentPDFTemplate,
  'vital_signs': VitalSignsDocumentPDFTemplate,
  'vital_signs_monitoring': VitalSignsMonitoringDocumentPDFTemplate,
  'vital_signs_table': VitalSignsTableDocumentPDFTemplate,
  'weekly_virtual_check_ins': WeeklyVirtualCheckInsDocumentPDFTemplate,
  'weight_measurements': WeightMeasurementsDocumentPDFTemplate,
  'weight_monitoring': WeightMonitoringDocumentPDFTemplate,
  'well_child_examinations': WellChildExaminationsDocumentPDFTemplate,
  'well_child_summary': WellChildSummaryDocumentPDFTemplate,
  'wellness_visit_documentation': WellnessVisitDocumentationDocumentPDFTemplate,
  'work_accommodations': WorkAccommodationsDocumentPDFTemplate,
  'work_restrictions': WorkRestrictionsDocumentPDFTemplate,
  'workers_comp_evaluations': WorkersCompEvaluationsDocumentPDFTemplate,
  'workers_compensation_evaluation': WorkersCompensationEvaluationDocumentPDFTemplate,
  'workplace_accommodations': WorkplaceAccommodationsDocumentPDFTemplate,
  'workplace_injury_report': WorkplaceInjuryReportDocumentPDFTemplate,
  'wound_care_assessments': WoundCareAssessmentsDocumentPDFTemplate,
  'wound_care_documentation': WoundCareDocumentationDocumentPDFTemplate,
  'wound_care_notes': WoundCareNotesDocumentPDFTemplate,
  'wound_healing_hyperbaric': WoundHealingHyperbaricDocumentPDFTemplate,
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
