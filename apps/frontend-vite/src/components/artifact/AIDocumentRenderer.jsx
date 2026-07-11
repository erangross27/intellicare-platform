import React, { Suspense, lazy } from 'react';
import './AIDocumentRenderer.css';

/**
 * PERFORMANCE OPTIMIZATION: React.lazy() Dynamic Imports (December 2025)
 *
 * Previously, this file had 370+ static imports loading ~21MB of templates on initial render.
 * Now templates are loaded on-demand when actually needed, reducing initial load time significantly.
 *
 * Each template is now a lazy-loaded component that only loads when the category is matched.
 */

// ========== LAZY-LOADED TEMPLATE IMPORTS ==========
const AnesthesiaDocument = lazy(() => import('./templates/AnesthesiaDocument'));
const AnesthesiaComplicationsDocument = lazy(() => import('./templates/AnesthesiaComplicationsDocument'));
const AnesthesiaConsentDocument = lazy(() => import('./templates/AnesthesiaConsentDocument'));
const AnesthesiaRecordsDocument = lazy(() => import('./templates/AnesthesiaRecordsDocument'));
const AnesthesiologyAssessmentDocument = lazy(() => import('./templates/AnesthesiologyAssessmentDocument'));
const AirwayManagementDocument = lazy(() => import('./templates/AirwayManagementDocument'));
const AirwayClearanceTherapyDocument = lazy(() => import('./templates/AirwayClearanceTherapyDocument'));
const RegionalAnesthesiaDocument = lazy(() => import('./templates/RegionalAnesthesiaDocument'));
const ProceduralSedationDocument = lazy(() => import('./templates/ProceduralSedationDocument'));
const SedationRecordsDocument = lazy(() => import('./templates/SedationRecordsDocument'));
const SpongeInstrumentCountsDocument = lazy(() => import('./templates/SpongeInstrumentCountsDocument'));
const ChronicPainAssessmentDocument = lazy(() => import('./templates/ChronicPainAssessmentDocument'));
const CardiologyAdmissionDocument = lazy(() => import('./templates/CardiologyAdmissionDocument'));
const CardiologyAdmissionNotesDocument = lazy(() => import('./templates/CardiologyAdmissionNotesDocument'));
const RehabilitationGoalsDocument = lazy(() => import('./templates/RehabilitationGoalsDocument'));
const CardiologyConsultationsDocument = lazy(() => import('./templates/CardiologyConsultationsDocument'));
const CardiologyFollowupReportsDocument = lazy(() => import('./templates/CardiologyFollowupReportsDocument'));
const CardiovascularRiskReductionDocument = lazy(() => import('./templates/CardiovascularRiskReductionDocument'));
const CardiovascularRiskScreeningDocument = lazy(() => import('./templates/CardiovascularRiskScreeningDocument'));
const StressTestReportsDocument = lazy(() => import('./templates/StressTestReportsDocument'));
const EchoReportsDocument = lazy(() => import('./templates/EchoReportsDocument'));
const EcgReportsDocument = lazy(() => import('./templates/EcgReportsDocument'));
const ChallengeTestsDocument = lazy(() => import('./templates/ChallengeTestsDocument'));
const PatientDetailsDocument = lazy(() => import('./templates/PatientDetailsDocument'));
const HospitalDischargeDocument = lazy(() => import('./templates/HospitalDischargeDocument'));
const HospitalDischargeSummariesDocument = lazy(() => import('./templates/HospitalDischargeSummariesDocument'));
const HospitalCourseDocument = lazy(() => import('./templates/HospitalCourseDocument'));
const DischargeSummaryDocument = lazy(() => import('./templates/DischargeSummaryDocument'));
const AllergyImmunologyAssessmentDocument = lazy(() => import('./templates/AllergyImmunologyAssessmentDocument'));
const AllergiesDocument = lazy(() => import('./templates/AllergiesDocument'));
const AllergiesAssessmentDocument = lazy(() => import('./templates/AllergiesAssessmentDocument'));
const AllergySkinTestingDocument = lazy(() => import('./templates/AllergySkinTestingDocument'));
const SpecificIgeTestingDocument = lazy(() => import('./templates/SpecificIgeTestingDocument'));
const SpecificIgeTestsDocument = lazy(() => import('./templates/SpecificIgeTestsDocument'));
const ComponentAllergenTestingDocument = lazy(() => import('./templates/ComponentAllergenTestingDocument'));
const AsthmaAssessmentsDocument = lazy(() => import('./templates/AsthmaAssessmentsDocument'));
const AsthmaActionPlanDocument = lazy(() => import('./templates/AsthmaActionPlanDocument'));
const PastMedicalHistoryDocument = lazy(() => import('./templates/PastMedicalHistoryDocument'));
const BehavioralAssessmentDocument = lazy(() => import('./templates/BehavioralAssessmentDocument'));
const AthleteSpecificDataDocument = lazy(() => import('./templates/AthleteSpecificDataDocument'));
const MedicationsDocument = lazy(() => import('./templates/MedicationsDocument'));
const MedicationOptimizationDocument = lazy(() => import('./templates/MedicationOptimizationDocument'));
const MedicationRecommendationsDocument = lazy(() => import('./templates/MedicationRecommendationsDocument'));
const AddictionMedicineConsultationsDocument = lazy(() => import('./templates/AddictionMedicineConsultationsDocument'));
const AdvanceDirectivesDocument = lazy(() => import('./templates/AdvanceDirectivesDocument'));
const MedicalPowerOfAttorneyDocument = lazy(() => import('./templates/MedicalPowerOfAttorneyDocument'));
const MedicalReconciliationFormsDocument = lazy(() => import('./templates/MedicalReconciliationFormsDocument'));
const NeuromuscularDisorderDocument = lazy(() => import('./templates/NeuromuscularDisorderDocument'));
const HomeHealthOrdersDocument = lazy(() => import('./templates/HomeHealthOrdersDocument'));
const GoalsOfCareDiscussionsDocument = lazy(() => import('./templates/GoalsOfCareDiscussionsDocument'));
const ResearchConsentFormsDocument = lazy(() => import('./templates/ResearchConsentFormsDocument'));
const PerformanceStatusDocument = lazy(() => import('./templates/PerformanceStatusDocument'));
const ResponseAssessmentDocument = lazy(() => import('./templates/ResponseAssessmentDocument'));
const QualityAssuranceDocument = lazy(() => import('./templates/QualityAssuranceDocument'));
const LymphNodeCytomorphologyDocument = lazy(() => import('./templates/LymphNodeCytomorphologyDocument'));
const StagingSummaryDocument = lazy(() => import('./templates/StagingSummaryDocument'));
const QualityMetricsDocument = lazy(() => import('./templates/QualityMetricsDocument'));
const CaseManagementDocument = lazy(() => import('./templates/CaseManagementDocument'));
const PainManagementPlanDocument = lazy(() => import('./templates/PainManagementPlanDocument'));
const MedicationSafetyDocument = lazy(() => import('./templates/MedicationSafetyDocument'));
const MedicationSafetyAlertsDocument = lazy(() => import('./templates/MedicationSafetyAlertsDocument'));
const AntibioticStewardshipDocument = lazy(() => import('./templates/AntibioticStewardshipDocument'));
const AntibiogramReportsDocument = lazy(() => import('./templates/AntibiogramReportsDocument'));
const AnticoagulationManagementDocument = lazy(() => import('./templates/AnticoagulationManagementDocument'));
const PrescriptionsDocument = lazy(() => import('./templates/PrescriptionsDocument'));
const ProgressNotesDocument = lazy(() => import('./templates/ProgressNotesDocument'));
const DiagnosesDocument = lazy(() => import('./templates/DiagnosesDocument'));
const DementiaAssessmentDocument = lazy(() => import('./templates/DementiaAssessmentDocument'));
const DementiaEducationDocument = lazy(() => import('./templates/DementiaEducationDocument'));
const DayProgramsDocument = lazy(() => import('./templates/DayProgramsDocument'));
const ElderAbuseScreeningDocument = lazy(() => import('./templates/ElderAbuseScreeningDocument'));
const BloodGlucoseLogsDocument = lazy(() => import('./templates/BloodGlucoseLogsDocument'));
const DiagnosticImpressionDocument = lazy(() => import('./templates/DiagnosticImpressionDocument'));
const LabResultsDocument = lazy(() => import('./templates/LabResultsDocument'));
const LabOrdersDocument = lazy(() => import('./templates/LabOrdersDocument'));
const LigamentReconstructionDocument = lazy(() => import('./templates/LigamentReconstructionDocument'));
const ImagingReportsDocument = lazy(() => import('./templates/ImagingReportsDocument'));
const PulmonaryImagingDocument = lazy(() => import('./templates/PulmonaryImagingDocument'));
const ImagingOrdersDocument = lazy(() => import('./templates/ImagingOrdersDocument'));
const ConsultationNotesDocument = lazy(() => import('./templates/ConsultationNotesDocument'));
const AdditionalDataDocument = lazy(() => import('./templates/AdditionalDataDocument'));
const IntraoperativeMonitoringDocument = lazy(() => import('./templates/IntraoperativeMonitoringDocument'));
const MedicalProceduresDocument = lazy(() => import('./templates/MedicalProceduresDocument'));
const TreatmentCoursesDocument = lazy(() => import('./templates/TreatmentCoursesDocument'));
const SmokingCessationProgramDocument = lazy(() => import('./templates/SmokingCessationProgramDocument'));
const DiabetesManagementNotesDocument = lazy(() => import('./templates/DiabetesManagementNotesDocument'));
const DiabetesManagementDocument = lazy(() => import('./templates/DiabetesManagementDocument'));
const DiabeticNephropathyDocument = lazy(() => import('./templates/DiabeticNephropathyDocument'));
const HypertensiveNephropathyDocument = lazy(() => import('./templates/HypertensiveNephropathyDocument'));
const NeurologyProgressNotesDocument = lazy(() => import('./templates/NeurologyProgressNotesDocument'));
const GeriatricCarePlanningDocument = lazy(() => import('./templates/GeriatricCarePlanningDocument'));
const EndocrinologyConsultationsDocument = lazy(() => import('./templates/EndocrinologyConsultationsDocument'));
const EndocrinologyAssessmentDocument = lazy(() => import('./templates/EndocrinologyAssessmentDocument'));
const ErgonomicAssessmentDocument = lazy(() => import('./templates/ErgonomicAssessmentDocument'));
const FacilityDocument = lazy(() => import('./templates/FacilityDocument'));
const GastroenterologyConsultationsDocument = lazy(() => import('./templates/GastroenterologyConsultationsDocument'));
const IbdConsultationDetailsDocument = lazy(() => import('./templates/IbdConsultationDetailsDocument'));
const MayoScoreDocument = lazy(() => import('./templates/MayoScoreDocument'));
const SymptomProgressionTimelineDocument = lazy(() => import('./templates/SymptomProgressionTimelineDocument'));
const FlareManagementDocument = lazy(() => import('./templates/FlareManagementDocument'));
const InfliximabDrugMonitoringDocument = lazy(() => import('./templates/InfliximabDrugMonitoringDocument'));
const FecalCalprotectinDocument = lazy(() => import('./templates/FecalCalprotectinDocument'));
const RescueTherapyOptionsDocument = lazy(() => import('./templates/RescueTherapyOptionsDocument'));
// Environmental Exposures
const EnvironmentalExposuresDocument = lazy(() => import('./templates/EnvironmentalExposuresDocument'));
const EntConsultationsDocument = lazy(() => import('./templates/EntConsultationsDocument'));
const EntAssessmentDocument = lazy(() => import('./templates/EntAssessmentDocument'));
const AudiometryReportsDocument = lazy(() => import('./templates/AudiometryReportsDocument'));
const LaryngoscopyReportsDocument = lazy(() => import('./templates/LaryngoscopyReportsDocument'));
const SleepDisorderAssessmentDocument = lazy(() => import('./templates/SleepDisorderAssessmentDocument'));
const InsomniaAssessmentDocument = lazy(() => import('./templates/InsomniaAssessmentDocument'));
const NarcolepsyAssessmentDocument = lazy(() => import('./templates/NarcolepsyAssessmentDocument'));
const SleepApneaManagementDocument = lazy(() => import('./templates/SleepApneaManagementDocument'));
const SleepHygieneEducationDocument = lazy(() => import('./templates/SleepHygieneEducationDocument'));
const DaytimeSleepinessAssessmentDocument = lazy(() => import('./templates/DaytimeSleepinessAssessmentDocument'));
const WorkplaceAccommodationsDocument = lazy(() => import('./templates/WorkplaceAccommodationsDocument'));
const AbnormalResultsDocument = lazy(() => import('./templates/AbnormalResultsDocument'));
const CpapManagementDocument = lazy(() => import('./templates/CpapManagementDocument'));
const WeightMonitoringDocument = lazy(() => import('./templates/WeightMonitoringDocument'));
const SouthAsianNutritionistDocument = lazy(() => import('./templates/SouthAsianNutritionistDocument'));
const IndianDietExchangeListsDocument = lazy(() => import('./templates/IndianDietExchangeListsDocument'));
const ExerciseProgramDocument = lazy(() => import('./templates/ExerciseProgramDocument'));
const HydrationManagementDocument = lazy(() => import('./templates/HydrationManagementDocument'));
const RehabilitationProgressNotesDocument = lazy(() => import('./templates/RehabilitationProgressNotesDocument'));
const GoutAssessmentDocument = lazy(() => import('./templates/GoutAssessmentDocument'));
const RheumatologicAssessmentDocument = lazy(() => import('./templates/RheumatologicAssessmentDocument'));
const RheumatologicMonitoringDocument = lazy(() => import('./templates/RheumatologicMonitoringDocument'));
const SpondyloarthritisAssessmentDocument = lazy(() => import('./templates/SpondyloarthritisAssessmentDocument'));
const OrthopedicFollowupNotesDocument = lazy(() => import('./templates/OrthopedicFollowupNotesDocument'));
const ArticularCartilageDocument = lazy(() => import('./templates/ArticularCartilageDocument'));
const ReturnToPlayProtocolDocument = lazy(() => import('./templates/ReturnToPlayProtocolDocument'));
const AthleticInjuryAssessmentDocument = lazy(() => import('./templates/AthleticInjuryAssessmentDocument'));
const SportsNutritionPlanDocument = lazy(() => import('./templates/SportsNutritionPlanDocument'));
const OvertrainingAssessmentDocument = lazy(() => import('./templates/OvertrainingAssessmentDocument'));
const ThyroidEvaluationsDocument = lazy(() => import('./templates/ThyroidEvaluationsDocument'));
const InsulinPumpSettingsDocument = lazy(() => import('./templates/InsulinPumpSettingsDocument'));
const CgmDataDocument = lazy(() => import('./templates/CgmDataDocument'));
const InsulinRegimenDocument = lazy(() => import('./templates/InsulinRegimenDocument'));
const InsulinAdjustmentProtocolDocument = lazy(() => import('./templates/InsulinAdjustmentProtocolDocument'));
const InsulinTimingInstructionsDocument = lazy(() => import('./templates/InsulinTimingInstructionsDocument'));
const InsulinStorageInstructionsDocument = lazy(() => import('./templates/InsulinStorageInstructionsDocument'));
const GlucoseMonitoringFrequencyDocument = lazy(() => import('./templates/GlucoseMonitoringFrequencyDocument'));
const KetoneMonitoringInstructionsDocument = lazy(() => import('./templates/KetoneMonitoringInstructionsDocument'));
const CarbohydrateCountingEducationDocument = lazy(() => import('./templates/CarbohydrateCountingEducationDocument'));
const PartnerInvolvementDiabetesManagementDocument = lazy(() => import('./templates/PartnerInvolvementDiabetesManagementDocument'));
const ExcessiveGlucoseMonitoringDocument = lazy(() => import('./templates/ExcessiveGlucoseMonitoringDocument'));
const DiabetesEducationDocument = lazy(() => import('./templates/DiabetesEducationDocument'));
const DevelopmentalAssessmentsDocument = lazy(() => import('./templates/DevelopmentalAssessmentsDocument'));
const EarlyChildhoodDevelopmentDocument = lazy(() => import('./templates/EarlyChildhoodDevelopmentDocument'));
const DevelopmentalMilestonesDocument = lazy(() => import('./templates/DevelopmentalMilestonesDocument'));
const PediatricGrowthChartsDocument = lazy(() => import('./templates/PediatricGrowthChartsDocument'));
const PediatricScreeningDocument = lazy(() => import('./templates/PediatricScreeningDocument'));
const GrowthParametersDocument = lazy(() => import('./templates/GrowthParametersDocument'));
const GrowthUltrasoundScheduleDocument = lazy(() => import('./templates/GrowthUltrasoundScheduleDocument'));
const PediatricVisitsDocument = lazy(() => import('./templates/PediatricVisitsDocument'));
const PediatricVaccinationRecordsDocument = lazy(() => import('./templates/PediatricVaccinationRecordsDocument'));
const WellChildExaminationsDocument = lazy(() => import('./templates/WellChildExaminationsDocument'));
const WellChildSummaryDocument = lazy(() => import('./templates/WellChildSummaryDocument'));
const HypoglycemiaManagementDocument = lazy(() => import('./templates/HypoglycemiaManagementDocument'));
const PreconceptionCounselingDocument = lazy(() => import('./templates/PreconceptionCounselingDocument'));
const DiabetesQualityMetricsDocument = lazy(() => import('./templates/DiabetesQualityMetricsDocument'));
const PumpDownloadAnalysisDocument = lazy(() => import('./templates/PumpDownloadAnalysisDocument'));
const FootExamDocument = lazy(() => import('./templates/FootExamDocument'));
const WoundHealingHyperbaricDocument = lazy(() => import('./templates/WoundHealingHyperbaricDocument'));
const HyperbaricOxygenTherapyDocument = lazy(() => import('./templates/HyperbaricOxygenTherapyDocument'));
const DecompressionSicknessTreatmentDocument = lazy(() => import('./templates/DecompressionSicknessTreatmentDocument'));
const DiabeticFootAssessmentDocument = lazy(() => import('./templates/DiabeticFootAssessmentDocument'));
const PodiatryConsultationsDocument = lazy(() => import('./templates/PodiatryConsultationsDocument'));
const PodiatryExaminationsDocument = lazy(() => import('./templates/PodiatryExaminationsDocument'));
const BunionSurgeryEvaluationDocument = lazy(() => import('./templates/BunionSurgeryEvaluationDocument'));
const HeelPainAssessmentDocument = lazy(() => import('./templates/HeelPainAssessmentDocument'));
const IngrownToenailTreatmentDocument = lazy(() => import('./templates/IngrownToenailTreatmentDocument'));
const PlantarFasciitisManagementDocument = lazy(() => import('./templates/PlantarFasciitisManagementDocument'));
const FootOrthoticsAssessmentDocument = lazy(() => import('./templates/FootOrthoticsAssessmentDocument'));
const BreastfeedingRecommendationDocument = lazy(() => import('./templates/BreastfeedingRecommendationDocument'));
const PostpartumDiabetesRiskDocument = lazy(() => import('./templates/PostpartumDiabetesRiskDocument'));
const GdmRecurrenceRiskDocument = lazy(() => import('./templates/GdmRecurrenceRiskDocument'));
const PostpartumGlucoseMonitoringDocument = lazy(() => import('./templates/PostpartumGlucoseMonitoringDocument'));
const TotalWeightGainDocument = lazy(() => import('./templates/TotalWeightGainDocument'));
const PrePregnancyWeightDocument = lazy(() => import('./templates/PrePregnancyWeightDocument'));
const EarlyMaternityLeaveDocument = lazy(() => import('./templates/EarlyMaternityLeaveDocument'));
const InterPregnancyWeightManagementDocument = lazy(() => import('./templates/InterPregnancyWeightManagementDocument'));
const ToxicityAssessmentDocument = lazy(() => import('./templates/ToxicityAssessmentDocument'));
const OncologicEmergenciesDocument = lazy(() => import('./templates/OncologicEmergenciesDocument'));
const PreChemotherapyWorkupDocument = lazy(() => import('./templates/PreChemotherapyWorkupDocument'));
const FitnessForDutyEvaluationsDocument = lazy(() => import('./templates/FitnessForDutyEvaluationsDocument'));
const EmploymentCounselingDocument = lazy(() => import('./templates/EmploymentCounselingDocument'));
const PreEmploymentPhysicalDocument = lazy(() => import('./templates/PreEmploymentPhysicalDocument'));
const PrenatalTestingReportsDocument = lazy(() => import('./templates/PrenatalTestingReportsDocument'));
const MaternalFetalReportsDocument = lazy(() => import('./templates/MaternalFetalReportsDocument'));
const UltrasoundObReportsDocument = lazy(() => import('./templates/UltrasoundObReportsDocument'));
const MacrosomiaThresholdDocument = lazy(() => import('./templates/MacrosomiaThresholdDocument'));
const PsychiatricDischargeSummariesDocument = lazy(() => import('./templates/PsychiatricDischargeSummariesDocument'));
const PsychiatricProgressNotesDocument = lazy(() => import('./templates/PsychiatricProgressNotesDocument'));
const HomicideRiskAssessmentDocument = lazy(() => import('./templates/HomicideRiskAssessmentDocument'));
const PsychiatricReviewDocument = lazy(() => import('./templates/PsychiatricReviewDocument'));
const BehavioralHealthGoalsDocument = lazy(() => import('./templates/BehavioralHealthGoalsDocument'));
const HourlyVitalSignsDocument = lazy(() => import('./templates/HourlyVitalSignsDocument'));
const PeripheralArteryDiseaseDocument = lazy(() => import('./templates/PeripheralArteryDiseaseDocument'));
const IntegrativeOncologyDocument = lazy(() => import('./templates/IntegrativeOncologyDocument'));
const SkinGraftingEvaluationDocument = lazy(() => import('./templates/SkinGraftingEvaluationDocument'));
const PressureInjuryDocument = lazy(() => import('./templates/PressureInjuryDocument'));
const WorkAccommodationsDocument = lazy(() => import('./templates/WorkAccommodationsDocument'));
const ChronicDiseaseManagementDocument = lazy(() => import('./templates/ChronicDiseaseManagementDocument'));
const CopdAssessmentsDocument = lazy(() => import('./templates/CopdAssessmentsDocument'));
const BronchialHygieneTherapyDocument = lazy(() => import('./templates/BronchialHygieneTherapyDocument'));
const RespiratoryTherapyAssessmentDocument = lazy(() => import('./templates/RespiratoryTherapyAssessmentDocument'));
const OxygenTitrationProtocolDocument = lazy(() => import('./templates/OxygenTitrationProtocolDocument'));
// AI Clinical Insights Templates (Tier 1)
const ClinicalDecisionSupportDocument = lazy(() => import('./templates/ClinicalDecisionSupportDocument'));
const IntelligentRecommendationsDocument = lazy(() => import('./templates/IntelligentRecommendationsDocument'));
const TrendingAnalysisDocument = lazy(() => import('./templates/TrendingAnalysisDocument'));
const PatientCarePlanDocument = lazy(() => import('./templates/PatientCarePlanDocument'));
const PatientSpecificCarePlanDocument = lazy(() => import('./templates/PatientSpecificCarePlanDocument'));
const FollowUpIntelligenceDocument = lazy(() => import('./templates/FollowUpIntelligenceDocument'));
const FollowUpAppointmentsDocument = lazy(() => import('./templates/FollowUpAppointmentsDocument'));
const FollowUpsDocument = lazy(() => import('./templates/FollowUpsDocument'));
const OutcomesPredictionsDocument = lazy(() => import('./templates/OutcomesPredictionsDocument'));
const OutcomesPredictionsSmartDocument = lazy(() => import('./templates/OutcomesPredictionsSmartDocument'));
const GuidelineComplianceDocument = lazy(() => import('./templates/GuidelineComplianceDocument'));
const HistoryPresentIllnessDocument = lazy(() => import('./templates/HistoryPresentIllnessDocument'));
const PatientEducationContextDocument = lazy(() => import('./templates/PatientEducationContextDocument'));
const PatientEducationRecordsDocument = lazy(() => import('./templates/PatientEducationRecordsDocument'));
// Surgical & Mental Health Templates (Tier 2)
const IntraoperativeRecordsDocument = lazy(() => import('./templates/IntraoperativeRecordsDocument'));
const OperativeReportsDocument = lazy(() => import('./templates/OperativeReportsDocument'));
const OperativeReportDetailsDocument = lazy(() => import('./templates/OperativeReportDetailsDocument'));
const PatientPositioningDocument = lazy(() => import('./templates/PatientPositioningDocument'));
const PrepAndDrapeDocument = lazy(() => import('./templates/PrepAndDrapeDocument'));
const PneumoperitoneumDocument = lazy(() => import('./templates/PneumoperitoneumDocument'));
const CriticalViewOfSafetyDocument = lazy(() => import('./templates/CriticalViewOfSafetyDocument'));
const IntraoperativeCholangiographyDocument = lazy(() => import('./templates/IntraoperativeCholangiographyDocument'));
const PreOperativeAssessmentsDocument = lazy(() => import('./templates/PreOperativeAssessmentsDocument'));
const DiagnosticStudiesDocument = lazy(() => import('./templates/DiagnosticStudiesDocument'));
const DocumentMetadataDocument = lazy(() => import('./templates/DocumentMetadataDocument'));
const SurgicalConsentFormsDocument = lazy(() => import('./templates/SurgicalConsentFormsDocument'));
const SurgicalApproachDocument = lazy(() => import('./templates/SurgicalApproachDocument'));
const IntraoperativeFindingsDocument = lazy(() => import('./templates/IntraoperativeFindingsDocument'));
const IntraoperativeImagingDocument = lazy(() => import('./templates/IntraoperativeImagingDocument'));
const NeuroImagingDocument = lazy(() => import('./templates/NeuroImagingDocument'));
const PostoperativeOrdersDocument = lazy(() => import('./templates/PostoperativeOrdersDocument'));
const OperativeTechniqueDocument = lazy(() => import('./templates/OperativeTechniqueDocument'));
const SpecimensDocument = lazy(() => import('./templates/SpecimensDocument'));
const ConsultationDetailsDocument = lazy(() => import('./templates/ConsultationDetailsDocument'));
const PsychosocialAssessmentsDocument = lazy(() => import('./templates/PsychosocialAssessmentsDocument'));
const DepressionScreeningDocument = lazy(() => import('./templates/DepressionScreeningDocument'));
const ExerciseRecommendationsDocument = lazy(() => import('./templates/ExerciseRecommendationsDocument'));
const ExercisePrescriptionDocument = lazy(() => import('./templates/ExercisePrescriptionDocument'));
const MedicalCertificatesDocument = lazy(() => import('./templates/MedicalCertificatesDocument'));
const TreatmentGoalsDocument = lazy(() => import('./templates/TreatmentGoalsDocument'));
const SubstanceUseAssessmentDocument = lazy(() => import('./templates/SubstanceUseAssessmentDocument'));
const TherapySessionNotesDocument = lazy(() => import('./templates/TherapySessionNotesDocument'));
const TherapyProgressNotesDocument = lazy(() => import('./templates/TherapyProgressNotesDocument'));
const StressManagementReferralsDocument = lazy(() => import('./templates/StressManagementReferralsDocument'));
const SupplementationPlansDocument = lazy(() => import('./templates/SupplementationPlansDocument'));
const NeurosurgeryConsultationsDocument = lazy(() => import('./templates/NeurosurgeryConsultationsDocument'));
const OrthopedicConsultationsDocument = lazy(() => import('./templates/OrthopedicConsultationsDocument'));
const PainManagementNotesDocument = lazy(() => import('./templates/PainManagementNotesDocument'));
const PharmacogenomicTestingDocument = lazy(() => import('./templates/PharmacogenomicTestingDocument'));
const ParenteralNutritionMonitoringDocument = lazy(() => import('./templates/ParenteralNutritionMonitoringDocument'));
const NutritionLabMonitoringDocument = lazy(() => import('./templates/NutritionLabMonitoringDocument'));
const AppetiteStimulantsDocument = lazy(() => import('./templates/AppetiteStimulantsDocument'));
const PrnMedicationsDocument = lazy(() => import('./templates/PrnMedicationsDocument'));
const NurseSignaturesDocument = lazy(() => import('./templates/NurseSignaturesDocument'));
const NursingNotesDocument = lazy(() => import('./templates/NursingNotesDocument'));
const PhysicalExaminationsDocument = lazy(() => import('./templates/PhysicalExaminationsDocument'));
const BloodProductsOrderedDocument = lazy(() => import('./templates/BloodProductsOrderedDocument'));
const EstimatedBloodLossDocument = lazy(() => import('./templates/EstimatedBloodLossDocument'));
const PostoperativeConditionDocument = lazy(() => import('./templates/PostoperativeConditionDocument'));
const GlaucomaAssessmentsDocument = lazy(() => import('./templates/GlaucomaAssessmentsDocument'));
const OphthalmologyExaminationsDocument = lazy(() => import('./templates/OphthalmologyExaminationsDocument'));
const VisionTherapyAssessmentDocument = lazy(() => import('./templates/VisionTherapyAssessmentDocument'));
const LowVisionEvaluationDocument = lazy(() => import('./templates/LowVisionEvaluationDocument'));
const OptometryExaminationDocument = lazy(() => import('./templates/OptometryExaminationDocument'));
const ContactLensFittingDocument = lazy(() => import('./templates/ContactLensFittingDocument'));
const RetinalExaminationsDocument = lazy(() => import('./templates/RetinalExaminationsDocument'));
const VisualAcuityReportsDocument = lazy(() => import('./templates/VisualAcuityReportsDocument'));
const PastOcularHistoryDocument = lazy(() => import('./templates/PastOcularHistoryDocument'));
const OphthalmologyExamDocument = lazy(() => import('./templates/OphthalmologyExamDocument'));
const GlaucomaManagementDocument = lazy(() => import('./templates/GlaucomaManagementDocument'));
const DvtProphylaxisDocument = lazy(() => import('./templates/DvtProphylaxisDocument'));
const ClinicalRiskScoresDocument = lazy(() => import('./templates/ClinicalRiskScoresDocument'));
const NeurologicalAssessmentDocument = lazy(() => import('./templates/NeurologicalAssessmentDocument'));
const NeurovascularExamDocument = lazy(() => import('./templates/NeurovascularExamDocument'));
const MovementDisorderAssessmentDocument = lazy(() => import('./templates/MovementDisorderAssessmentDocument'));
const NeurosurgeryAssessmentDocument = lazy(() => import('./templates/NeurosurgeryAssessmentDocument'));
const RadiologyFindingsDocument = lazy(() => import('./templates/RadiologyFindingsDocument'));
const NeurologicalFindingsDocument = lazy(() => import('./templates/NeurologicalFindingsDocument'));
const SurgicalHistoryDocument = lazy(() => import('./templates/SurgicalHistoryDocument'));
const PostOperativeReportsDocument = lazy(() => import('./templates/PostOperativeReportsDocument'));
const NeurologyConsultationsDocument = lazy(() => import('./templates/NeurologyConsultationsDocument'));
const EmgReportsDocument = lazy(() => import('./templates/EmgReportsDocument'));
const ComplicationsDocument = lazy(() => import('./templates/ComplicationsDocument'));
const ConsultationRequestsDocument = lazy(() => import('./templates/ConsultationRequestsDocument'));
const DiseaseSeverityDocument = lazy(() => import('./templates/DiseaseSeverityDocument'));
const HematologyAssessmentDocument = lazy(() => import('./templates/HematologyAssessmentDocument'));
const MyelomaSpecificDataDocument = lazy(() => import('./templates/MyelomaSpecificDataDocument'));
const TransplantAssessmentDocument = lazy(() => import('./templates/TransplantAssessmentDocument'));
const ProphylacticMedicationsDocument = lazy(() => import('./templates/ProphylacticMedicationsDocument'));
const BrainTumorCharacteristicsDocument = lazy(() => import('./templates/BrainTumorCharacteristicsDocument'));
const BrainTumorMolecularMarkersDocument = lazy(() => import('./templates/BrainTumorMolecularMarkersDocument'));
const TractographyStudiesDocument = lazy(() => import('./templates/TractographyStudiesDocument'));
const TourniquetDataDocument = lazy(() => import('./templates/TourniquetDataDocument'));
const TpnManagementDocument = lazy(() => import('./templates/TpnManagementDocument'));
const FunctionalMriStudiesDocument = lazy(() => import('./templates/FunctionalMriStudiesDocument'));
const BoneMarrowStudiesDocument = lazy(() => import('./templates/BoneMarrowStudiesDocument'));
const PlasticSurgeryConsultationsDocument = lazy(() => import('./templates/PlasticSurgeryConsultationsDocument'));
const PlasticSurgeryAssessmentDocument = lazy(() => import('./templates/PlasticSurgeryAssessmentDocument'));
// Risk Assessment Templates
const GIRiskAssessmentDocument = lazy(() => import('./templates/GIRiskAssessmentDocument'));
const MalnutritionRiskAssessmentDocument = lazy(() => import('./templates/MalnutritionRiskAssessmentDocument'));
const RiskFactorsDocument = lazy(() => import('./templates/RiskFactorsDocument'));
const MedicationReconciliationDocument = lazy(() => import('./templates/MedicationReconciliationDocument'));
const RecommendationsDocument = lazy(() => import('./templates/RecommendationsDocument'));
const ReferralsDocument = lazy(() => import('./templates/ReferralsDocument'));
const MedicalHistoryDocument = lazy(() => import('./templates/MedicalHistoryDocument'));
const VitalSignsDocument = lazy(() => import('./templates/VitalSignsDocument'));
const VitalSignsTableDocument = lazy(() => import('./templates/VitalSignsTableDocument'));
const VitalSignsLogsDocument = lazy(() => import('./templates/VitalSignsLogsDocument'));
const VariantInterpretationGuidelinesDocument = lazy(() => import('./templates/VariantInterpretationGuidelinesDocument'));
const WeightMeasurementsDocument = lazy(() => import('./templates/WeightMeasurementsDocument'));
const BloodPressureReadingsDocument = lazy(() => import('./templates/BloodPressureReadingsDocument'));
const KidneyFunctionReportsDocument = lazy(() => import('./templates/KidneyFunctionReportsDocument'));
const AcuteKidneyInjuryDocument = lazy(() => import('./templates/AcuteKidneyInjuryDocument'));
const NutritionalSupportDocument = lazy(() => import('./templates/NutritionalSupportDocument'));
const NutritionSupportConsultationDocument = lazy(() => import('./templates/NutritionSupportConsultationDocument'));
const ArthritisAssessmentsDocument = lazy(() => import('./templates/ArthritisAssessmentsDocument'));
const AutoimmunePanelsDocument = lazy(() => import('./templates/AutoimmunePanelsDocument'));
const AutoimmuneEvaluationsDocument = lazy(() => import('./templates/AutoimmuneEvaluationsDocument'));
const ConnectiveTissueDiseaseAssessmentDocument = lazy(() => import('./templates/ConnectiveTissueDiseaseAssessmentDocument'));
const LupusAssessmentDocument = lazy(() => import('./templates/LupusAssessmentDocument'));
const ProviderInfoDocument = lazy(() => import('./templates/ProviderInfoDocument'));
const RheumatologyConsultationsDocument = lazy(() => import('./templates/RheumatologyConsultationsDocument'));
const DetailedFamilyPedigreeDocument = lazy(() => import('./templates/DetailedFamilyPedigreeDocument'));
const DermatologyConsultationsDocument = lazy(() => import('./templates/DermatologyConsultationsDocument'));
const DermatologyProcedureNotesDocument = lazy(() => import('./templates/DermatologyProcedureNotesDocument'));
const DermatologyAssessmentDocument = lazy(() => import('./templates/DermatologyAssessmentDocument'));
const DentalExaminationReportsDocument = lazy(() => import('./templates/DentalExaminationReportsDocument'));
const OralSurgeryReportsDocument = lazy(() => import('./templates/OralSurgeryReportsDocument'));
const TmjAssessmentDocument = lazy(() => import('./templates/TmjAssessmentDocument'));
const JawReconstructionDocument = lazy(() => import('./templates/JawReconstructionDocument'));
const DentalImplantSurgeryDocument = lazy(() => import('./templates/DentalImplantSurgeryDocument'));
const OrthopedicOperativeReportsDocument = lazy(() => import('./templates/OrthopedicOperativeReportsDocument'));
const OrthopedicImagingDocument = lazy(() => import('./templates/OrthopedicImagingDocument'));
const OrthopedicAssessmentDocument = lazy(() => import('./templates/OrthopedicAssessmentDocument'));
const OrthopedicProceduresDocument = lazy(() => import('./templates/OrthopedicProceduresDocument'));
const SkinBiopsyReportsDocument = lazy(() => import('./templates/SkinBiopsyReportsDocument'));
const DexaScanReportsDocument = lazy(() => import('./templates/DexaScanReportsDocument'));
const NephrologyConsultationDetailsDocument = lazy(() => import('./templates/NephrologyConsultationDetailsDocument'));
const CkdAssessmentDocument = lazy(() => import('./templates/CkdAssessmentDocument'));
const ProteinuriaAssessmentDocument = lazy(() => import('./templates/ProteinuriaAssessmentDocument'));
const DietaryInterventionsDocument = lazy(() => import('./templates/DietaryInterventionsDocument'));
const CKDManagementDocument = lazy(() => import('./templates/CKDManagementDocument'));
const TreatmentPlansDocument = lazy(() => import('./templates/TreatmentPlansDocument'));
const PrognosisRecordsDocument = lazy(() => import('./templates/PrognosisRecordsDocument'));
const PrognosisDocument = lazy(() => import('./templates/PrognosisDocument'));
const PrognosisDiscussionDocument = lazy(() => import('./templates/PrognosisDiscussionDocument'));
const CancerSurveillanceDocument = lazy(() => import('./templates/CancerSurveillanceDocument'));
const IbdAssessmentDocument = lazy(() => import('./templates/IbdAssessmentDocument'));
const DiseaseActivityScoresDocument = lazy(() => import('./templates/DiseaseActivityScoresDocument'));
const InflammatoryBowelReportsDocument = lazy(() => import('./templates/InflammatoryBowelReportsDocument'));
const InsuranceFormsDocument = lazy(() => import('./templates/InsuranceFormsDocument'));
const CareCoordinationNotesDocument = lazy(() => import('./templates/CareCoordinationNotesDocument'));
const RheumatologicTreatmentDocument = lazy(() => import('./templates/RheumatologicTreatmentDocument'));
const EndoscopyFindingsDocument = lazy(() => import('./templates/EndoscopyFindingsDocument'));
const InfusionTherapyDocument = lazy(() => import('./templates/InfusionTherapyDocument'));
const MedicationChangesDoseDocument = lazy(() => import('./templates/MedicationChangesDoseDocument'));
const MedicationChangesDiscontinuedDocument = lazy(() => import('./templates/MedicationChangesDiscontinuedDocument'));
const MedicationDeprescribingDocument = lazy(() => import('./templates/MedicationDeprescribingDocument'));
const NutritionalSupplementationDocument = lazy(() => import('./templates/NutritionalSupplementationDocument'));
const RespiteCareDocument = lazy(() => import('./templates/RespiteCareDocument'));
const PostoperativePainManagementDocument = lazy(() => import('./templates/PostoperativePainManagementDocument'));
const MedicationChangesNewDocument = lazy(() => import('./templates/MedicationChangesNewDocument'));
const BloodDisorderReportsDocument = lazy(() => import('./templates/BloodDisorderReportsDocument'));
const SocialSupportDocument = lazy(() => import('./templates/SocialSupportDocument'));
const MeniscusRepairDocument = lazy(() => import('./templates/MeniscusRepairDocument'));
const ReturnToSportDocument = lazy(() => import('./templates/ReturnToSportDocument'));
const MentalHealthResourcesDocument = lazy(() => import('./templates/MentalHealthResourcesDocument'));
const MoodPsychologicalAssessmentDocument = lazy(() => import('./templates/MoodPsychologicalAssessmentDocument'));
const GynecologyConsultationsDocument = lazy(() => import('./templates/GynecologyConsultationsDocument'));
const CytologyReportsDocument = lazy(() => import('./templates/CytologyReportsDocument'));
const ObstetricHistoryDocument = lazy(() => import('./templates/ObstetricHistoryDocument'));
const CurrentPregnancyDocument = lazy(() => import('./templates/CurrentPregnancyDocument'));
const PrenatalScreeningDocument = lazy(() => import('./templates/PrenatalScreeningDocument'));
const CellFreeDnaResultDocument = lazy(() => import('./templates/CellFreeDnaResultDocument'));
const AmniocentesisReportsDocument = lazy(() => import('./templates/AmniocentesisReportsDocument'));
const AmnioticFluidAssessmentDocument = lazy(() => import('./templates/AmnioticFluidAssessmentDocument'));
const FirstTrimesterBleedingDocument = lazy(() => import('./templates/FirstTrimesterBleedingDocument'));
const FirstTrimesterScreenResultDocument = lazy(() => import('./templates/FirstTrimesterScreenResultDocument'));
const NtScanResultDocument = lazy(() => import('./templates/NtScanResultDocument'));
const AnatomyScanResultDocument = lazy(() => import('./templates/AnatomyScanResultDocument'));
const PregnancyCourseDocument = lazy(() => import('./templates/PregnancyCourseDocument'));
const EstimatedDeliveryDateDocument = lazy(() => import('./templates/EstimatedDeliveryDateDocument'));
const FetalUltrasoundDocument = lazy(() => import('./templates/FetalUltrasoundDocument'));
const CervicalAssessmentDocument = lazy(() => import('./templates/CervicalAssessmentDocument'));
const CervicalLengthMeasurementDocument = lazy(() => import('./templates/CervicalLengthMeasurementDocument'));
const PerinatalMentalHealthReferralDocument = lazy(() => import('./templates/PerinatalMentalHealthReferralDocument'));
const ReproductiveHistoryDocument = lazy(() => import('./templates/ReproductiveHistoryDocument'));
const DonorEggCycleDocument = lazy(() => import('./templates/DonorEggCycleDocument'));
const FertilityTrackingDocument = lazy(() => import('./templates/FertilityTrackingDocument'));
const SingleEmbryoTransferDocument = lazy(() => import('./templates/SingleEmbryoTransferDocument'));
const CancerScreeningRecordsDocument = lazy(() => import('./templates/CancerScreeningRecordsDocument'));
const CaregiverAssessmentDocument = lazy(() => import('./templates/CaregiverAssessmentDocument'));
const SymptomProgressionDocument = lazy(() => import('./templates/SymptomProgressionDocument'));
const PainAssessmentFormsDocument = lazy(() => import('./templates/PainAssessmentFormsDocument'));
const InterventionalPainProceduresDocument = lazy(() => import('./templates/InterventionalPainProceduresDocument'));
const PainMedicationAgreementsDocument = lazy(() => import('./templates/PainMedicationAgreementsDocument'));
const PainFunctionalAssessmentDocument = lazy(() => import('./templates/PainFunctionalAssessmentDocument'));
const MultimodalPainTherapyDocument = lazy(() => import('./templates/MultimodalPainTherapyDocument'));
const OpioidRiskAssessmentDocument = lazy(() => import('./templates/OpioidRiskAssessmentDocument'));
const SocialWorkDocument = lazy(() => import('./templates/SocialWorkDocument'));
const GoalsOfCareDiscussionDocument = lazy(() => import('./templates/GoalsOfCareDiscussionDocument'));
const PatientCareGoalsDocument = lazy(() => import('./templates/PatientCareGoalsDocument'));
const MonitoringPlansDocument = lazy(() => import('./templates/MonitoringPlansDocument'));
const ClinicalScoresDocument = lazy(() => import('./templates/ClinicalScoresDocument'));
const FamilyMeetingNotesDocument = lazy(() => import('./templates/FamilyMeetingNotesDocument'));
const FamilyMedicineAssessmentDocument = lazy(() => import('./templates/FamilyMedicineAssessmentDocument'));
const FamilyMedicineVisitsDocument = lazy(() => import('./templates/FamilyMedicineVisitsDocument'));
const FunctionalAssessmentsDocument = lazy(() => import('./templates/FunctionalAssessmentsDocument'));
const LifestyleRiskAssessmentDocument = lazy(() => import('./templates/LifestyleRiskAssessmentDocument'));
const BiopsychosocialFormulationDocument = lazy(() => import('./templates/BiopsychosocialFormulationDocument'));
const PsychiatricAssessmentScalesDocument = lazy(() => import('./templates/PsychiatricAssessmentScalesDocument'));
const SafetyPlanningDocument = lazy(() => import('./templates/SafetyPlanningDocument'));
const LifestyleAssessmentsDocument = lazy(() => import('./templates/LifestyleAssessmentsDocument'));
const LifestyleCounselingDocument = lazy(() => import('./templates/LifestyleCounselingDocument'));
const RiskCalculatorsDocument = lazy(() => import('./templates/RiskCalculatorsDocument'));
const PreventiveBiomarkersDocument = lazy(() => import('./templates/PreventiveBiomarkersDocument'));
const PreventiveMedicineAssessmentsDocument = lazy(() => import('./templates/PreventiveMedicineAssessmentsDocument'));
const SchoolHealthFormsDocument = lazy(() => import('./templates/SchoolHealthFormsDocument'));
const SchoolPerformanceDocument = lazy(() => import('./templates/SchoolPerformanceDocument'));
const ScreeningComplianceDocument = lazy(() => import('./templates/ScreeningComplianceDocument'));
const MentalStatusExamsDocument = lazy(() => import('./templates/MentalStatusExamsDocument'));
const MentalStatusExamDocument = lazy(() => import('./templates/MentalStatusExamDocument'));
const PsychiatricEvaluationDocument = lazy(() => import('./templates/PsychiatricEvaluationDocument'));
const PsychiatricEvaluationsDocument = lazy(() => import('./templates/PsychiatricEvaluationsDocument'));
const PsychiatricTreatmentPlanDocument = lazy(() => import('./templates/PsychiatricTreatmentPlanDocument'));
const PsychotropicMedicationsDocument = lazy(() => import('./templates/PsychotropicMedicationsDocument'));
const VaccinationRecordsDocument = lazy(() => import('./templates/VaccinationRecordsDocument'));
const HomeMonitoringDocument = lazy(() => import('./templates/HomeMonitoringDocument'));
const DoctorsMedicationRecommendationsDocument = lazy(() => import('./templates/DoctorsMedicationRecommendationsDocument'));
const ColorectalColonoscopiesDocument = lazy(() => import('./templates/ColorectalColonoscopiesDocument'));
const ColorectalSurgeryConsultationsDocument = lazy(() => import('./templates/ColorectalSurgeryConsultationsDocument'));
const HematologyConsultationsDocument = lazy(() => import('./templates/HematologyConsultationsDocument'));
const FlowCytometryReportsDocument = lazy(() => import('./templates/FlowCytometryReportsDocument'));
const OncologyConsultationsDocument = lazy(() => import('./templates/OncologyConsultationsDocument'));
const OncologyTreatmentPlansDocument = lazy(() => import('./templates/OncologyTreatmentPlansDocument'));
const OncologyFollowupReportsDocument = lazy(() => import('./templates/OncologyFollowupReportsDocument'));
const CancerDiagnosisDocument = lazy(() => import('./templates/CancerDiagnosisDocument'));
const CancerStagingDocument = lazy(() => import('./templates/CancerStagingDocument'));
const CancerRelatedSideEffectsDocument = lazy(() => import('./templates/CancerRelatedSideEffectsDocument'));
const TumorMarkersDocument = lazy(() => import('./templates/TumorMarkersDocument'));
const TumorMarkerPanelsDocument = lazy(() => import('./templates/TumorMarkerPanelsDocument'));
const GeneticOncologyDocument = lazy(() => import('./templates/GeneticOncologyDocument'));
const SurgicalOncologyDocument = lazy(() => import('./templates/SurgicalOncologyDocument'));
const EndocrineTherapyDocument = lazy(() => import('./templates/EndocrineTherapyDocument'));
const SurvivorshipCarePlanDocument = lazy(() => import('./templates/SurvivorshipCarePlanDocument'));
const CognitiveEvaluationsDocument = lazy(() => import('./templates/CognitiveEvaluationsDocument'));
const FallRiskAssessmentsDocument = lazy(() => import('./templates/FallRiskAssessmentsDocument'));
const GeriatricAssessmentsDocument = lazy(() => import('./templates/GeriatricAssessmentsDocument'));
const GeriatricCognitiveAssessmentDocument = lazy(() => import('./templates/GeriatricCognitiveAssessmentDocument'));
const GeriatricMedicationsDocument = lazy(() => import('./templates/GeriatricMedicationsDocument'));
const PolypharmacyReviewsDocument = lazy(() => import('./templates/PolypharmacyReviewsDocument'));
const TreatmentSummaryDocument = lazy(() => import('./templates/TreatmentSummaryDocument'));
const NeurologicalExamDocument = lazy(() => import('./templates/NeurologicalExamDocument'));
const PulmonologyConsultationsDocument = lazy(() => import('./templates/PulmonologyConsultationsDocument'));
const PulmonaryRehabilitationNotesDocument = lazy(() => import('./templates/PulmonaryRehabilitationNotesDocument'));
const RadiologyReportsDocument = lazy(() => import('./templates/RadiologyReportsDocument'));
const MammographyReportsDocument = lazy(() => import('./templates/MammographyReportsDocument'));
const InterventionalRadiologyNotesDocument = lazy(() => import('./templates/InterventionalRadiologyNotesDocument'));
const MriReportsDocument = lazy(() => import('./templates/MriReportsDocument'));
const MultipleSclerosisAssessmentDocument = lazy(() => import('./templates/MultipleSclerosisAssessmentDocument'));
const PreoperativePreparationDocument = lazy(() => import('./templates/PreoperativePreparationDocument'));
const BloodSmearsDocument = lazy(() => import('./templates/BloodSmearsDocument'));
const PulmonaryFunctionTestsDocument = lazy(() => import('./templates/PulmonaryFunctionTestsDocument'));
const SocialWorkNotesDocument = lazy(() => import('./templates/SocialWorkNotesDocument'));
const SocialHistoryDocument = lazy(() => import('./templates/SocialHistoryDocument'));
// Administrative Data
const AdministrativeDataDocument = lazy(() => import('./templates/AdministrativeDataDocument'));
// Prior Authorization Forms
const PriorAuthorizationFormsDocument = lazy(() => import('./templates/PriorAuthorizationFormsDocument'));
// Prior Authorization Status
const PriorAuthorizationStatusDocument = lazy(() => import('./templates/PriorAuthorizationStatusDocument'));
// Insurance Authorizations
const InsuranceAuthorizationsDocument = lazy(() => import('./templates/InsuranceAuthorizationsDocument'));
// Family History
const FamilyHistoryDocument = lazy(() => import('./templates/FamilyHistoryDocument'));
// Assessment Plans
const AssessmentPlansDocument = lazy(() => import('./templates/AssessmentPlansDocument'));
// Care Gaps
const CareGapsDocument = lazy(() => import('./templates/CareGapsDocument'));
// Care Coordination
const CareCoordinationDocument = lazy(() => import('./templates/CareCoordinationDocument'));
// Health Maintenance
const HealthMaintenanceDocument = lazy(() => import('./templates/HealthMaintenanceDocument'));
// Home Health Notes
const HomeHealthNotesDocument = lazy(() => import('./templates/HomeHealthNotesDocument'));
// Patient Instructions
const PatientInstructionsDocument = lazy(() => import('./templates/PatientInstructionsDocument'));
// Preventive Care
const PreventiveCareDocument = lazy(() => import('./templates/PreventiveCareDocument'));
// Reminders (System/Operational - NOT medical)
const RemindersDocument = lazy(() => import('./templates/RemindersDocument'));
// Patient Provider
const PatientProviderDocument = lazy(() => import('./templates/PatientProviderDocument'));
// Arterial Blood Gases
const ArterialBloodGasesDocument = lazy(() => import('./templates/ArterialBloodGasesDocument'));
// Microbiology Culture Reports
const MicrobiologyCultureReportsDocument = lazy(() => import('./templates/MicrobiologyCultureReportsDocument'));
const RespiratoryMedicationsDocument = lazy(() => import('./templates/RespiratoryMedicationsDocument'));
const HepatitisCManagementDocument = lazy(() => import('./templates/HepatitisCManagementDocument'));
const HepatitisCHistoryDocument = lazy(() => import('./templates/HepatitisCHistoryDocument'));
const HarmReductionCounselingDocument = lazy(() => import('./templates/HarmReductionCounselingDocument'));
const ChiefComplaintsDocument = lazy(() => import('./templates/ChiefComplaintsDocument'));
const MentalHealthAssessmentsDocument = lazy(() => import('./templates/MentalHealthAssessmentsDocument'));
const InfectionControlRecordsDocument = lazy(() => import('./templates/InfectionControlRecordsDocument'));
const InfectiousDiseaseAssessmentDocument = lazy(() => import('./templates/InfectiousDiseaseAssessmentDocument'));
const InfectionRiskMonitoringDocument = lazy(() => import('./templates/InfectionRiskMonitoringDocument'));
const InfectionSurveillanceDocument = lazy(() => import('./templates/InfectionSurveillanceDocument'));
const IsolationPrecautionsDocument = lazy(() => import('./templates/IsolationPrecautionsDocument'));
const AntimicrobialSusceptibilityDocument = lazy(() => import('./templates/AntimicrobialSusceptibilityDocument'));
const PsychiatricHistoryDocument = lazy(() => import('./templates/PsychiatricHistoryDocument'));
const ReviewOfSystemsDocument = lazy(() => import('./templates/ReviewOfSystemsDocument'));
const SuicideRiskAssessmentDocument = lazy(() => import('./templates/SuicideRiskAssessmentDocument'));
const FollowUpPlanDocument = lazy(() => import('./templates/FollowUpPlanDocument'));
const FollowUpEnhancedDocument = lazy(() => import('./templates/FollowUpEnhancedDocument'));
const ReferralsPlacedDocument = lazy(() => import('./templates/ReferralsPlacedDocument'));
const MedicalAlertsDocument = lazy(() => import('./templates/MedicalAlertsDocument'));
const SleepStudyReportsDocument = lazy(() => import('./templates/SleepStudyReportsDocument'));
const CoagulationStudiesDocument = lazy(() => import('./templates/CoagulationStudiesDocument'));
const LiverFunctionAssessmentsDocument = lazy(() => import('./templates/LiverFunctionAssessmentsDocument'));
const NutritionAssessmentsDocument = lazy(() => import('./templates/NutritionAssessmentsDocument'));
const EnteralFeedingAssessmentDocument = lazy(() => import('./templates/EnteralFeedingAssessmentDocument'));
const FoodInsecurityDocument = lazy(() => import('./templates/FoodInsecurityDocument'));
const BarriersPsychosocialIssuesDocument = lazy(() => import('./templates/BarriersPsychosocialIssuesDocument'));
const SocialDeterminantsOfHealthDocument = lazy(() => import('./templates/SocialDeterminantsOfHealthDocument'));
const MedicationAccessProgramsDocument = lazy(() => import('./templates/MedicationAccessProgramsDocument'));
const BiologicTherapyRecordsDocument = lazy(() => import('./templates/BiologicTherapyRecordsDocument'));
const BiologicTherapyDocument = lazy(() => import('./templates/BiologicTherapyDocument'));
const AsthmaManagementNotesDocument = lazy(() => import('./templates/AsthmaManagementNotesDocument'));
const BiopsyReportsDocument = lazy(() => import('./templates/BiopsyReportsDocument'));
const OralPathologyBiopsyDocument = lazy(() => import('./templates/OralPathologyBiopsyDocument'));
const PathologyReportsDocument = lazy(() => import('./templates/PathologyReportsDocument'));
const PathologyGrossDescriptionDocument = lazy(() => import('./templates/PathologyGrossDescriptionDocument'));
const GeneticTestingReportsDocument = lazy(() => import('./templates/GeneticTestingReportsDocument'));
const ComprehensiveCardiomyopathyPanelDocument = lazy(() => import('./templates/ComprehensiveCardiomyopathyPanelDocument'));
const DrugGeneInteractionReportDocument = lazy(() => import('./templates/DrugGeneInteractionReportDocument'));
const Cyp450PanelResultsDocument = lazy(() => import('./templates/Cyp450PanelResultsDocument'));
const ChemotherapyRegimenDocument = lazy(() => import('./templates/ChemotherapyRegimenDocument'));
const ChemotherapyRecordsDocument = lazy(() => import('./templates/ChemotherapyRecordsDocument'));
const RadiationTherapyDocument = lazy(() => import('./templates/RadiationTherapyDocument'));
const RadiationTherapyRecordsDocument = lazy(() => import('./templates/RadiationTherapyRecordsDocument'));
const ClinicalTrialsDocument = lazy(() => import('./templates/ClinicalTrialsDocument'));
const ClinicalTrialDocumentsDocument = lazy(() => import('./templates/ClinicalTrialDocumentsDocument'));
const PalliativeCareNeedsDocument = lazy(() => import('./templates/PalliativeCareNeedsDocument'));
const PsychosocialOncologyDocument = lazy(() => import('./templates/PsychosocialOncologyDocument'));
const PrognosticFactorsDocument = lazy(() => import('./templates/PrognosticFactorsDocument'));
const SupportiveCareDocument = lazy(() => import('./templates/SupportiveCareDocument'));
const IcuFlowSheetsDocument = lazy(() => import('./templates/IcuFlowSheetsDocument'));
const ProceduresInterventionsDocument = lazy(() => import('./templates/ProceduresInterventionsDocument'));
const WoundCareAssessmentsDocument = lazy(() => import('./templates/WoundCareAssessmentsDocument'));
const PhysicalTherapyEvaluationsDocument = lazy(() => import('./templates/PhysicalTherapyEvaluationsDocument'));
const OccupationalTherapyReportsDocument = lazy(() => import('./templates/OccupationalTherapyReportsDocument'));
const SpeechTherapyAssessmentsDocument = lazy(() => import('./templates/SpeechTherapyAssessmentsDocument'));
const FunctionalStatusDocument = lazy(() => import('./templates/FunctionalStatusDocument'));
const StrokeAssessmentDocument = lazy(() => import('./templates/StrokeAssessmentDocument'));
const PmrAssessmentDocument = lazy(() => import('./templates/PmrAssessmentDocument'));
const AssistiveDevicesDocument = lazy(() => import('./templates/AssistiveDevicesDocument'));
const DurableMedicalEquipmentOrdersDocument = lazy(() => import('./templates/DurableMedicalEquipmentOrdersDocument'));
const InflammatoryMarkersDocument = lazy(() => import('./templates/InflammatoryMarkersDocument'));
const PhysicalTherapyNotesDocument = lazy(() => import('./templates/PhysicalTherapyNotesDocument'));
const FallsPreventionProgramAssessmentDocument = lazy(() => import('./templates/FallsPreventionProgramAssessmentDocument'));
const PharmacyReviewDocument = lazy(() => import('./templates/PharmacyReviewDocument'));
const IntakeOutputRecordsDocument = lazy(() => import('./templates/IntakeOutputRecordsDocument'));
const MedicationAdministrationRecordsDocument = lazy(() => import('./templates/MedicationAdministrationRecordsDocument'));
const ScheduledMedicationsDocument = lazy(() => import('./templates/ScheduledMedicationsDocument'));
const NursingAssessmentsDocument = lazy(() => import('./templates/NursingAssessmentsDocument'));
const WoundCareDocumentationDocument = lazy(() => import('./templates/WoundCareDocumentationDocument'));
const WoundCareNotesDocument = lazy(() => import('./templates/WoundCareNotesDocument'));
const EmergencyInformationDocument = lazy(() => import('./templates/EmergencyInformationDocument'));
const EmergencyDischargeSummariesDocument = lazy(() => import('./templates/EmergencyDischargeSummariesDocument'));
const EmergencyReportsDocument = lazy(() => import('./templates/EmergencyReportsDocument'));
const EmergencyAssessmentDocument = lazy(() => import('./templates/EmergencyAssessmentDocument'));
const EmergencyAirwayManagementDocument = lazy(() => import('./templates/EmergencyAirwayManagementDocument'));
const OrthodonticTreatmentPlansDocument = lazy(() => import('./templates/OrthodonticTreatmentPlansDocument'));
const OrthognathicSurgeryEvaluationDocument = lazy(() => import('./templates/OrthognathicSurgeryEvaluationDocument'));
const PeriodontalChartsDocument = lazy(() => import('./templates/PeriodontalChartsDocument'));
const AdmissionRecommendationsDocument = lazy(() => import('./templates/AdmissionRecommendationsDocument'));
const TriageDataDocument = lazy(() => import('./templates/TriageDataDocument'));
const EdTriageAssessmentDocument = lazy(() => import('./templates/EdTriageAssessmentDocument'));
const EmergencyObservationUnitDocument = lazy(() => import('./templates/EmergencyObservationUnitDocument'));
const EegReportsDocument = lazy(() => import('./templates/EegReportsDocument'));
const EdCourseDocument = lazy(() => import('./templates/EdCourseDocument'));
const EdDispositionDocument = lazy(() => import('./templates/EdDispositionDocument'));
const DischargePlanningDocument = lazy(() => import('./templates/DischargePlanningDocument'));
const RehabilitationProtocolDocument = lazy(() => import('./templates/RehabilitationProtocolDocument'));
const RespiratoryDevicesDocument = lazy(() => import('./templates/RespiratoryDevicesDocument'));
const CpapBipapManagementDocument = lazy(() => import('./templates/CpapBipapManagementDocument'));
const VentilatorSettingsDocument = lazy(() => import('./templates/VentilatorSettingsDocument'));
const HospitalAdmissionNotesDocument = lazy(() => import('./templates/HospitalAdmissionNotesDocument'));
const HospitalTransferNotesDocument = lazy(() => import('./templates/HospitalTransferNotesDocument'));
const AdmissionAssessmentsDocument = lazy(() => import('./templates/AdmissionAssessmentsDocument'));
const SecondOpinionReportsDocument = lazy(() => import('./templates/SecondOpinionReportsDocument'));
const ReadmissionRiskAssessmentDocument = lazy(() => import('./templates/ReadmissionRiskAssessmentDocument'));
const MyositisAssessmentDocument = lazy(() => import('./templates/MyositisAssessmentDocument'));
const IbdBiomarkersDocument = lazy(() => import('./templates/IbdBiomarkersDocument'));
const RespiratoryInfectionsDocument = lazy(() => import('./templates/RespiratoryInfectionsDocument'));
const TransferSummariesDocument = lazy(() => import('./templates/TransferSummariesDocument'));
const HospiceNotesDocument = lazy(() => import('./templates/HospiceNotesDocument'));
const MortalityRiskAssessmentDocument = lazy(() => import('./templates/MortalityRiskAssessmentDocument'));
const PressureUlcerRiskDocument = lazy(() => import('./templates/PressureUlcerRiskDocument'));
const PalliativeCareDocument = lazy(() => import('./templates/PalliativeCareDocument'));
const TumorBoardNotesDocument = lazy(() => import('./templates/TumorBoardNotesDocument'));
const CardiacCatheterizationReportsDocument = lazy(() => import('./templates/CardiacCatheterizationReportsDocument'));
const CardiologyAssessmentDocument = lazy(() => import('./templates/CardiologyAssessmentDocument'));
const CardiacMonitoringDocument = lazy(() => import('./templates/CardiacMonitoringDocument'));
const CardiacDeviceInterrogationsDocument = lazy(() => import('./templates/CardiacDeviceInterrogationsDocument'));
const ProposedArtSwitchDocument = lazy(() => import('./templates/ProposedArtSwitchDocument'));
const SpermAnalysisDocument = lazy(() => import('./templates/SpermAnalysisDocument'));
const IntrauterineInseminationDocument = lazy(() => import('./templates/IntrauterineInseminationDocument'));
const SurrogacyEvaluationDocument = lazy(() => import('./templates/SurrogacyEvaluationDocument'));
const HivHistoryDocument = lazy(() => import('./templates/HivHistoryDocument'));
const ImmuneReconstitutionPlanningDocument = lazy(() => import('./templates/ImmuneReconstitutionPlanningDocument'));
const ImmuneFunctionTestsDocument = lazy(() => import("./templates/ImmuneFunctionTestsDocument"));
const PrimaryProphylaxisDocument = lazy(() => import('./templates/PrimaryProphylaxisDocument'));
const SecondaryProphylaxisDocument = lazy(() => import('./templates/SecondaryProphylaxisDocument'));
const OpportunisticInfectionsDocument = lazy(() => import('./templates/OpportunisticInfectionsDocument'));
const CmvMonitoringPlanDocument = lazy(() => import('./templates/CmvMonitoringPlanDocument'));
const CardiacRehabilitationReportsDocument = lazy(() => import('./templates/CardiacRehabilitationReportsDocument'));
const ImmediateInterventionsDocument = lazy(() => import('./templates/ImmediateInterventionsDocument'));
const ImmunizationStatusDocument = lazy(() => import('./templates/ImmunizationStatusDocument'));
const ColonoscopyReportsDocument = lazy(() => import('./templates/ColonoscopyReportsDocument'));
const ExtraintestinalManifestationsDocument = lazy(() => import('./templates/ExtraintestinalManifestationsDocument'));
const IbdSurgicalPlanningDocument = lazy(() => import('./templates/IbdSurgicalPlanningDocument'));
const BoneHealthDocument = lazy(() => import('./templates/BoneHealthDocument'));
const CompressionTherapyDocument = lazy(() => import('./templates/CompressionTherapyDocument'));
const ClosureTechniqueDocument = lazy(() => import('./templates/ClosureTechniqueDocument'));
const BoneScanReportsDocument = lazy(() => import('./templates/BoneScanReportsDocument'));
const PetScanReportsDocument = lazy(() => import('./templates/PetScanReportsDocument'));
const ThoracicSurgeryAssessmentDocument = lazy(() => import('./templates/ThoracicSurgeryAssessmentDocument'));
const NuclearMedicineAssessmentDocument = lazy(() => import('./templates/NuclearMedicineAssessmentDocument'));
const NuclearMedicineStudiesDocument = lazy(() => import('./templates/NuclearMedicineStudiesDocument'));
const ColorectalSurgeryAssessmentDocument = lazy(() => import('./templates/ColorectalSurgeryAssessmentDocument'));
const NutritionalAssessmentDocument = lazy(() => import('./templates/NutritionalAssessmentDocument'));
const PSCManagementDocument = lazy(() => import('./templates/PSCManagementDocument'));
const ContinuousInfusionsDocument = lazy(() => import('./templates/ContinuousInfusionsDocument'));
const GlasgowComaScaleDocument = lazy(() => import('./templates/GlasgowComaScaleDocument'));
const CystoscopyReportsDocument = lazy(() => import('./templates/CystoscopyReportsDocument'));
const UrodynamicStudiesDocument = lazy(() => import('./templates/UrodynamicStudiesDocument'));
const UrologyConsultationsDocument = lazy(() => import('./templates/UrologyConsultationsDocument'));
const ConsultationTimelineDocument = lazy(() => import('./templates/ConsultationTimelineDocument'));
const InjuryDetailsDocument = lazy(() => import('./templates/InjuryDetailsDocument'));
const WorkRestrictionsDocument = lazy(() => import('./templates/WorkRestrictionsDocument'));
const PainManagementDocument = lazy(() => import('./templates/PainManagementDocument'));
const AdvanceCarePlanningDocument = lazy(() => import('./templates/AdvanceCarePlanningDocument'));
const PeripheralNeuropathyDocument = lazy(() => import('./templates/PeripheralNeuropathyDocument'));
const GestationalDiabetesDocument = lazy(() => import('./templates/GestationalDiabetesDocument'));
const GlucoseMonitoringGoalsDocument = lazy(() => import('./templates/GlucoseMonitoringGoalsDocument'));
const PsychosocialFactorsDocument = lazy(() => import('./templates/PsychosocialFactorsDocument'));
const FetalSurveillanceDocument = lazy(() => import('./templates/FetalSurveillanceDocument'));
const UmbilicalArteryDopplerDocument = lazy(() => import('./templates/UmbilicalArteryDopplerDocument'));
const DeliveryPlanningDocument = lazy(() => import('./templates/DeliveryPlanningDocument'));
const FetalAssessmentDocument = lazy(() => import('./templates/FetalAssessmentDocument'));
const FetalEchoDocument = lazy(() => import('./templates/FetalEchoDocument'));
const PrenatalEducationDocument = lazy(() => import('./templates/PrenatalEducationDocument'));
const PrenatalVisitsDocument = lazy(() => import('./templates/PrenatalVisitsDocument'));
const ContractionMonitoringDocument = lazy(() => import('./templates/ContractionMonitoringDocument'));
const LaborDeliveryRecordsDocument = lazy(() => import('./templates/LaborDeliveryRecordsDocument'));
const ApgarScoresDocument = lazy(() => import('./templates/ApgarScoresDocument'));
const NewbornScreeningResultsDocument = lazy(() => import('./templates/NewbornScreeningResultsDocument'));
const NicuProgressNotesDocument = lazy(() => import('./templates/NicuProgressNotesDocument'));
const MaternalLabsDocument = lazy(() => import('./templates/MaternalLabsDocument'));
const MaternalWeightMonitoringDocument = lazy(() => import('./templates/MaternalWeightMonitoringDocument'));
const PregnancySymptomsDocument = lazy(() => import('./templates/PregnancySymptomsDocument'));
const BirthPlanDocument = lazy(() => import('./templates/BirthPlanDocument'));
const BirthHistoryDocument = lazy(() => import('./templates/BirthHistoryDocument'));
const FertilityPreservationDocument = lazy(() => import('./templates/FertilityPreservationDocument'));
const SingleEmbryoTransferDetailsDocument = lazy(() => import('./templates/SingleEmbryoTransferDetailsDocument'));
const IvfCycleMonitoringDocument = lazy(() => import('./templates/IvfCycleMonitoringDocument'));
const EggRetrievalProcedureDocument = lazy(() => import('./templates/EggRetrievalProcedureDocument'));
const EmbryoTransferProcedureDocument = lazy(() => import('./templates/EmbryoTransferProcedureDocument'));
const OvarianStimulationProtocolDocument = lazy(() => import('./templates/OvarianStimulationProtocolDocument'));
const FertilityMedicationManagementDocument = lazy(() => import('./templates/FertilityMedicationManagementDocument'));
const AnticipatoryGuidanceDocument = lazy(() => import('./templates/AnticipatoryGuidanceDocument'));
const ADHDAssessmentDocument = lazy(() => import('./templates/ADHDAssessmentDocument'));
const ParentalConcernsDocument = lazy(() => import('./templates/ParentalConcernsDocument'));
const DisabilityEvaluationsDocument = lazy(() => import('./templates/DisabilityEvaluationsDocument'));
const MechanismOfInjuryDocument = lazy(() => import('./templates/MechanismOfInjuryDocument'));
const OccupationalMedicineEvaluationsDocument = lazy(() => import('./templates/OccupationalMedicineEvaluationsDocument'));
const OccupationalHealthAssessmentDocument = lazy(() => import('./templates/OccupationalHealthAssessmentDocument'));
const WorkersCompensationEvaluationDocument = lazy(() => import('./templates/WorkersCompensationEvaluationDocument'));
const WorkplaceInjuryReportDocument = lazy(() => import('./templates/WorkplaceInjuryReportDocument'));
const ReturnToWorkPlanDocument = lazy(() => import('./templates/ReturnToWorkPlanDocument'));
const PostpartumNotesDocument = lazy(() => import('./templates/PostpartumNotesDocument'));
const PostpartumPlanningDocument = lazy(() => import('./templates/PostpartumPlanningDocument'));
const PregnancyRiskAssessmentDocument = lazy(() => import('./templates/PregnancyRiskAssessmentDocument'));
const PreeclampsiaMonitoringDocument = lazy(() => import('./templates/PreeclampsiaMonitoringDocument'));
const RiskCounselingDocument = lazy(() => import('./templates/RiskCounselingDocument'));
const CulturalConsiderationsDocument = lazy(() => import('./templates/CulturalConsiderationsDocument'));
const ThyroidManagementDocument = lazy(() => import('./templates/ThyroidManagementDocument'));
const HormonePanelsDocument = lazy(() => import('./templates/HormonePanelsDocument'));
const CascadeTestingProtocolDocument = lazy(() => import('./templates/CascadeTestingProtocolDocument'));
const PotentialTestingOutcomesDocument = lazy(() => import('./templates/PotentialTestingOutcomesDocument'));
const ReasonForReferralDocument = lazy(() => import('./templates/ReasonForReferralDocument'));
const MedicalGeneticistDocument = lazy(() => import('./templates/MedicalGeneticistDocument'));
const TransplantEvaluationsDocument = lazy(() => import('./templates/TransplantEvaluationsDocument'));
const HeartTransplantEvaluationDocument = lazy(() => import('./templates/HeartTransplantEvaluationDocument'));
const LiverTransplantEvaluationDocument = lazy(() => import('./templates/LiverTransplantEvaluationDocument'));
const LungTransplantEvaluationDocument = lazy(() => import('./templates/LungTransplantEvaluationDocument'));
const StemCellTransplantAssessmentDocument = lazy(() => import('./templates/StemCellTransplantAssessmentDocument'));
const BleedingRiskAssessmentDocument = lazy(() => import('./templates/BleedingRiskAssessmentDocument'));
const DiabetesManagementPlanDocument = lazy(() => import('./templates/DiabetesManagementPlanDocument'));
const PumpAdvancedSettingsDocument = lazy(() => import('./templates/PumpAdvancedSettingsDocument'));
const PancreasTransplantEvaluationDocument = lazy(() => import('./templates/PancreasTransplantEvaluationDocument'));
const LiverTransplantFollowUpDocument = lazy(() => import('./templates/LiverTransplantFollowUpDocument'));
const LungTransplantFollowUpDocument = lazy(() => import('./templates/LungTransplantFollowUpDocument'));
const DialysisRecordsDocument = lazy(() => import('./templates/DialysisRecordsDocument'));
const DialysisRunSheetsDocument = lazy(() => import('./templates/DialysisRunSheetsDocument'));
const PreDialysisAssessmentDocument = lazy(() => import('./templates/PreDialysisAssessmentDocument'));
const DialysisPrescriptionDocument = lazy(() => import('./templates/DialysisPrescriptionDocument'));
const DialyzerDocument = lazy(() => import('./templates/DialyzerDocument'));
const DialysateCompositionDocument = lazy(() => import('./templates/DialysateCompositionDocument'));
const IntradialyticMonitoringDocument = lazy(() => import('./templates/IntradialyticMonitoringDocument'));
const MedicationsAdministeredDocument = lazy(() => import('./templates/MedicationsAdministeredDocument'));
const PostDialysisAssessmentDocument = lazy(() => import('./templates/PostDialysisAssessmentDocument'));
const RenalProtectionPlanDocument = lazy(() => import('./templates/RenalProtectionPlanDocument'));
const CurrentDialysisDocument = lazy(() => import('./templates/CurrentDialysisDocument'));
const EndoscopyReportsDocument = lazy(() => import('./templates/EndoscopyReportsDocument'));
const CognitiveRehabilitationReportsDocument = lazy(() => import('./templates/CognitiveRehabilitationReportsDocument'));
const CognitiveScreeningDocument = lazy(() => import('./templates/CognitiveScreeningDocument'));
const TherapyRequestsDocument = lazy(() => import('./templates/TherapyRequestsDocument'));
const SurgicalStepsDocument = lazy(() => import('./templates/SurgicalStepsDocument'));
const SurgicalTeamDocument = lazy(() => import('./templates/SurgicalTeamDocument'));
const OncologyTeamDocument = lazy(() => import('./templates/OncologyTeamDocument'));
const PreoperativeEvaluationDocument = lazy(() => import('./templates/PreoperativeEvaluationDocument'));
const OperativeDetailsDocument = lazy(() => import('./templates/OperativeDetailsDocument'));
const NeurologicalExaminationDocument = lazy(() => import('./templates/NeurologicalExaminationDocument'));
const SportsMedicineEvaluationsDocument = lazy(() => import('./templates/SportsMedicineEvaluationsDocument'));
const SportsPhysicalExaminationDocument = lazy(() => import('./templates/SportsPhysicalExaminationDocument'));
const NephrologyConsultationsDocument = lazy(() => import('./templates/NephrologyConsultationsDocument'));
const KidneyDiseaseProgressionTimelineDocument = lazy(() => import('./templates/KidneyDiseaseProgressionTimelineDocument'));
const EstimatedTimeToDialysisDocument = lazy(() => import('./templates/EstimatedTimeToDialysisDocument'));
const EducationInitiatedDocument = lazy(() => import('./templates/EducationInitiatedDocument'));
const AccessPlanningDocument = lazy(() => import('./templates/AccessPlanningDocument'));
const DialysisPlanningDocument = lazy(() => import('./templates/DialysisPlanningDocument'));
const MineralBoneDiseaseDocument = lazy(() => import('./templates/MineralBoneDiseaseDocument'));
const RenalAnemiaDocument = lazy(() => import('./templates/RenalAnemiaDocument'));
const FluidElectrolyteManagementDocument = lazy(() => import('./templates/FluidElectrolyteManagementDocument'));
const FluidIntakeDocument = lazy(() => import('./templates/FluidIntakeDocument'));
const FluidOutputDocument = lazy(() => import('./templates/FluidOutputDocument'));
const VentilatorWeaningProtocolDocument = lazy(() => import('./templates/VentilatorWeaningProtocolDocument'));
const BloodGlucoseMonitoringDocument = lazy(() => import('./templates/BloodGlucoseMonitoringDocument'));
const CareTeamDocument = lazy(() => import('./templates/CareTeamDocument'));
const BurnAssessmentDocument = lazy(() => import('./templates/BurnAssessmentDocument'));
const BurnFluidResuscitationDocument = lazy(() => import('./templates/BurnFluidResuscitationDocument'));
const SyphilisTreatmentFollowUpDocument = lazy(() => import('./templates/SyphilisTreatmentFollowUpDocument'));
const VaricoseVeinTreatmentDocument = lazy(() => import('./templates/VaricoseVeinTreatmentDocument'));
const HeartTransplantFollowUpDocument = lazy(() => import('./templates/HeartTransplantFollowUpDocument'));
const KidneyTransplantFollowUpDocument = lazy(() => import('./templates/KidneyTransplantFollowUpDocument'));
const FootReconstructionDocument = lazy(() => import('./templates/FootReconstructionDocument'));
const PulmonaryRehabilitationDocument = lazy(() => import('./templates/PulmonaryRehabilitationDocument'));
const MedicationActionPlanDocument = lazy(() => import('./templates/MedicationActionPlanDocument'));
const PolypharmacyDocument = lazy(() => import('./templates/PolypharmacyDocument'));
const CesareanThresholdDocument = lazy(() => import('./templates/CesareanThresholdDocument'));
const DiabetesEducatorTrainingDocument = lazy(() => import('./templates/DiabetesEducatorTrainingDocument'));
const HeightMeasurementsDocument = lazy(() => import('./templates/HeightMeasurementsDocument'));
const PointOfCareUltrasoundHeartRateDocument = lazy(() => import('./templates/PointOfCareUltrasoundHeartRateDocument'));
const GlucoseTestingWeeksDocument = lazy(() => import('./templates/GlucoseTestingWeeksDocument'));
const SocialFunctionalAssessmentDocument = lazy(() => import('./templates/SocialFunctionalAssessmentDocument'));
const PatientEmotionalResponseDocument = lazy(() => import('./templates/PatientEmotionalResponseDocument'));
const SupportGroupReferralDocument = lazy(() => import('./templates/SupportGroupReferralDocument'));
const PartnerInvolvementDocument = lazy(() => import('./templates/PartnerInvolvementDocument'));
const AdmissionDecisionsDocument = lazy(() => import('./templates/AdmissionDecisionsDocument'));
const PostOpTestingDocument = lazy(() => import('./templates/PostOpTestingDocument'));
const PostopTestingDocument = lazy(() => import('./templates/PostopTestingDocument'));
const BoneMarrowTransplantEvaluationDocument = lazy(() => import('./templates/BoneMarrowTransplantEvaluationDocument'));
const BoneMarrowTransplantFollowUpDocument = lazy(() => import('./templates/BoneMarrowTransplantFollowUpDocument'));
const PancreasTransplantFollowUpDocument = lazy(() => import('./templates/PancreasTransplantFollowUpDocument'));
const BoneMarrowReportsDocument = lazy(() => import('./templates/BoneMarrowReportsDocument'));
const CytogeneticsDocument = lazy(() => import('./templates/CytogeneticsDocument'));
const BloodProductsDocument = lazy(() => import('./templates/BloodProductsDocument'));
const PreOperativePreparationDocument = lazy(() => import('./templates/PreOperativePreparationDocument'));
const AmnioticFluidIndexCurrentDocument = lazy(() => import('./templates/AmnioticFluidIndexCurrentDocument'));
const FetalEchoResultsDocument = lazy(() => import('./templates/FetalEchoResultsDocument'));
const AnnualPhysicalExaminationDocument = lazy(() => import('./templates/AnnualPhysicalExaminationDocument'));
const CaregiverSupportGroupsDocument = lazy(() => import('./templates/CaregiverSupportGroupsDocument'));
const FamilyMeetingDecisionsDocument = lazy(() => import('./templates/FamilyMeetingDecisionsDocument'));
const FrailtyAssessmentDocument = lazy(() => import('./templates/FrailtyAssessmentDocument'));
const GeriatricNutritionalAssessmentDocument = lazy(() => import('./templates/GeriatricNutritionalAssessmentDocument'));
const ChronicDiseaseGoalsDocument = lazy(() => import('./templates/ChronicDiseaseGoalsDocument'));
const ContinuousGlucoseMonitorDiscussionDocument = lazy(() => import('./templates/ContinuousGlucoseMonitorDiscussionDocument'));
const HypoglycemiaProtocolDocument = lazy(() => import('./templates/HypoglycemiaProtocolDocument'));
const HormoneTherapyRecordsDocument = lazy(() => import('./templates/HormoneTherapyRecordsDocument'));
const UrologyAssessmentDocument = lazy(() => import('./templates/UrologyAssessmentDocument'));
const NeuropsychTestingDocument = lazy(() => import('./templates/NeuropsychTestingDocument'));
const WellnessVisitDocumentationDocument = lazy(() => import('./templates/WellnessVisitDocumentationDocument'));
const DoctorsMedicationsRecommendationsOptimizationsDocument = lazy(() => import('./templates/DoctorsMedicationsRecommendationsOptimizationsDocument'));
const GiRiskAssessmentDocument = lazy(() => import('./templates/GiRiskAssessmentDocument'));
const TrendAnalysisDocument = lazy(() => import('./templates/TrendAnalysisDocument'));
const AllergyAssessmentsDocument = lazy(() => import('./templates/AllergyAssessmentsDocument'));
const ContinuousGlucoseMonitorDocument = lazy(() => import('./templates/ContinuousGlucoseMonitorDocument'));
const VitalSignsMonitoringDocument = lazy(() => import('./templates/VitalSignsMonitoringDocument'));
const OccupationalExposureRecordsDocument = lazy(() => import('./templates/OccupationalExposureRecordsDocument'));
const FmlaDocumentationNoteDocument = lazy(() => import('./templates/FmlaDocumentationNoteDocument'));
const WorkersCompEvaluationsDocument = lazy(() => import('./templates/WorkersCompEvaluationsDocument'));
const EmergencyDispositionDocument = lazy(() => import('./templates/EmergencyDispositionDocument'));
const ProcedureRequestsDocument = lazy(() => import('./templates/ProcedureRequestsDocument'));
const PortPlacementDocument = lazy(() => import('./templates/PortPlacementDocument'));
const BurnWoundCareDocument = lazy(() => import('./templates/BurnWoundCareDocument'));
const BurnRehabilitationDocument = lazy(() => import('./templates/BurnRehabilitationDocument'));
const CamIcuDocument = lazy(() => import('./templates/CamIcuDocument'));
const ChiropracticConsultationDocument = lazy(() => import('./templates/ChiropracticConsultationDocument'));
const SpinalManipulationRecordDocument = lazy(() => import('./templates/SpinalManipulationRecordDocument'));
const ChiropracticXRayReviewDocument = lazy(() => import('./templates/ChiropracticXRayReviewDocument'));
const ChiropracticTreatmentPlanDocument = lazy(() => import('./templates/ChiropracticTreatmentPlanDocument'));
const RenalNutritionDocument = lazy(() => import('./templates/RenalNutritionDocument'));
const MedicationRenalDosingDocument = lazy(() => import('./templates/MedicationRenalDosingDocument'));
const ExtendedFamilyHistoryDocument = lazy(() => import('./templates/ExtendedFamilyHistoryDocument'));
const GeneticsPsychosocialAssessmentDocument = lazy(() => import('./templates/GeneticsPsychosocialAssessmentDocument'));
const InheritancePatternDetailsDocument = lazy(() => import('./templates/InheritancePatternDetailsDocument'));
const ChildrenSpecificRiskDocument = lazy(() => import('./templates/ChildrenSpecificRiskDocument'));
const AcmgGuidelinesReferenceDocument = lazy(() => import('./templates/AcmgGuidelinesReferenceDocument'));
const PsychosocialSupportServicesDocument = lazy(() => import('./templates/PsychosocialSupportServicesDocument'));
const MedicationTherapyManagementDocument = lazy(() => import('./templates/MedicationTherapyManagementDocument'));
const ComprehensiveMedicationReviewDocument = lazy(() => import('./templates/ComprehensiveMedicationReviewDocument'));
const PharmacistConsultationDocument = lazy(() => import('./templates/PharmacistConsultationDocument'));
const ParkinsonianFeaturesDocument = lazy(() => import('./templates/ParkinsonianFeaturesDocument'));
const GaitAnalysisDocument = lazy(() => import('./templates/GaitAnalysisDocument'));
const MotorComplicationsDocument = lazy(() => import('./templates/MotorComplicationsDocument'));
const NonMotorSymptomsDocument = lazy(() => import('./templates/NonMotorSymptomsDocument'));
const ParkinsonMedicationsDocument = lazy(() => import('./templates/ParkinsonMedicationsDocument'));
const CaregiverSupportDocument = lazy(() => import('./templates/CaregiverSupportDocument'));
const DeepBrainStimulationDocument = lazy(() => import('./templates/DeepBrainStimulationDocument'));
const SleepDisturbancesDocument = lazy(() => import('./templates/SleepDisturbancesDocument'));
const NeuropsychologicalAssessmentsDocument = lazy(() => import('./templates/NeuropsychologicalAssessmentsDocument'));
const EndocrineLabResultsDocument = lazy(() => import('./templates/EndocrineLabResultsDocument'));
const DiabetesSuppliesDocument = lazy(() => import('./templates/DiabetesSuppliesDocument'));
const BasalRateAdjustmentsDocument = lazy(() => import('./templates/BasalRateAdjustmentsDocument'));
const BolusAdjustmentsDocument = lazy(() => import('./templates/BolusAdjustmentsDocument'));
const SepsisManagementDocument = lazy(() => import('./templates/SepsisManagementDocument'));
const ConcussionAssessmentDocument = lazy(() => import('./templates/ConcussionAssessmentDocument'));
const EmsRunReportsDocument = lazy(() => import('./templates/EmsRunReportsDocument'));
const AutoantibodyProfileDocument = lazy(() => import('./templates/AutoantibodyProfileDocument'));
const SclerodermaAssessmentDocument = lazy(() => import('./templates/SclerodermaAssessmentDocument'));
const SjogrensSyndromeAssessmentDocument = lazy(() => import('./templates/SjogrensSyndromeAssessmentDocument'));
const VasculitisAssessmentDocument = lazy(() => import('./templates/VasculitisAssessmentDocument'));
const HomeSafetyDocument = lazy(() => import('./templates/HomeSafetyDocument'));
const FallPreventionEducationDocument = lazy(() => import('./templates/FallPreventionEducationDocument'));
const DiabetesEducatorDocument = lazy(() => import('./templates/DiabetesEducatorDocument'));
const AutopsyReportsDocument = lazy(() => import('./templates/AutopsyReportsDocument'));
const ToxicologyReportsDocument = lazy(() => import('./templates/ToxicologyReportsDocument'));
const DnrOrdersDocument = lazy(() => import('./templates/DnrOrdersDocument'));
const CaseSummariesDocument = lazy(() => import('./templates/CaseSummariesDocument'));
const ResuscitationRecordsDocument = lazy(() => import('./templates/ResuscitationRecordsDocument'));
const GlomerularDiseaseDocument = lazy(() => import('./templates/GlomerularDiseaseDocument'));
const CodeBlueSummariesDocument = lazy(() => import('./templates/CodeBlueSummariesDocument'));
const RapidResponseSummariesDocument = lazy(() => import('./templates/RapidResponseSummariesDocument'));
const EpilepsyAssessmentDocument = lazy(() => import('./templates/EpilepsyAssessmentDocument'));
const HeadacheAssessmentDocument = lazy(() => import('./templates/HeadacheAssessmentDocument'));
const PatientVisitDocument = lazy(() => import('./templates/PatientVisitDocument'));
const PregnancyComplicationsDocument = lazy(() => import('./templates/PregnancyComplicationsDocument'));
const HivPrepManagementDocument = lazy(() => import('./templates/HivPrepManagementDocument'));
const PartnerNotificationDocument = lazy(() => import('./templates/PartnerNotificationDocument'));
const StiScreeningPanelDocument = lazy(() => import('./templates/StiScreeningPanelDocument'));
const SexualHealthCounselingDocument = lazy(() => import('./templates/SexualHealthCounselingDocument'));
const HivPepProphylaxisDocument = lazy(() => import('./templates/HivPepProphylaxisDocument'));
const ShiftHandoffNotesDocument = lazy(() => import('./templates/ShiftHandoffNotesDocument'));
const TropicalDiseaseAssessmentDocument = lazy(() => import('./templates/TropicalDiseaseAssessmentDocument'));
const PolycysticKidneyDiseaseDocument = lazy(() => import('./templates/PolycysticKidneyDiseaseDocument'));
const TravelMedicineAssessmentDocument = lazy(() => import('./templates/TravelMedicineAssessmentDocument'));
const TravelHealthCertificatesDocument = lazy(() => import('./templates/TravelHealthCertificatesDocument'));
const HealthCoachingNotesDocument = lazy(() => import('./templates/HealthCoachingNotesDocument'));
const TubeFeedingOrderDocument = lazy(() => import('./templates/TubeFeedingOrderDocument'));
const OmissionsRefusalsDocument = lazy(() => import('./templates/OmissionsRefusalsDocument'));
const MedicationDosingRecommendationDocument = lazy(() => import('./templates/MedicationDosingRecommendationDocument'));
const IntervalHistoryDocument = lazy(() => import('./templates/IntervalHistoryDocument'));
const SoapNotesDocument = lazy(() => import('./templates/SoapNotesDocument'));
const TelemedicineEncountersDocument = lazy(() => import('./templates/TelemedicineEncountersDocument'));
const WeeklyVirtualCheckInsDocument = lazy(() => import('./templates/WeeklyVirtualCheckInsDocument'));
const PoisonControlReportsDocument = lazy(() => import('./templates/PoisonControlReportsDocument'));
const BloodSampleCollectionStatusDocument = lazy(() => import('./templates/BloodSampleCollectionStatusDocument'));
const RheumatoidArthritisAssessmentDocument = lazy(() => import('./templates/RheumatoidArthritisAssessmentDocument'));
const AdvanceDirectiveDiscussionDocument = lazy(() => import('./templates/AdvanceDirectiveDiscussionDocument'));
const AdultDayProgramInfoDocument = lazy(() => import('./templates/AdultDayProgramInfoDocument'));
const NutritionalStatusDocument = lazy(() => import('./templates/NutritionalStatusDocument'));
const OperativeTimeDocument = lazy(() => import('./templates/OperativeTimeDocument'));
const VascularSurgeryAssessmentDocument = lazy(() => import('./templates/VascularSurgeryAssessmentDocument'));
const JobHazardAnalysisDocument = lazy(() => import('./templates/JobHazardAnalysisDocument'));
const VascularBypassSurgeryDocument = lazy(() => import('./templates/VascularBypassSurgeryDocument'));
const VenousInsufficiencyAssessmentDocument = lazy(() => import('./templates/VenousInsufficiencyAssessmentDocument'));
const AorticAneurysmSurveillanceDocument = lazy(() => import('./templates/AorticAneurysmSurveillanceDocument'));
const TraumaFlowSheetsDocument = lazy(() => import('./templates/TraumaFlowSheetsDocument'));
const TraumaAssessmentDocument = lazy(() => import('./templates/TraumaAssessmentDocument'));
const TraumaScoringDocument = lazy(() => import('./templates/TraumaScoringDocument'));
const EmergencyProceduresDocument = lazy(() => import('./templates/EmergencyProceduresDocument'));
const ImmunizationScheduleDocument = lazy(() => import('./templates/ImmunizationScheduleDocument'));
const TravelVaccinationRecordsDocument = lazy(() => import('./templates/TravelVaccinationRecordsDocument'));
const FacialTraumaAssessmentDocument = lazy(() => import('./templates/FacialTraumaAssessmentDocument'));
const ImmediateRecommendationsDocument = lazy(() => import('./templates/ImmediateRecommendationsDocument'));
const ImmunizationRecordDocument = lazy(() => import('./templates/ImmunizationRecordDocument'));
const IvInfusionsDocument = lazy(() => import('./templates/IvInfusionsDocument'));
const VenousThromboembolismRiskDocument = lazy(() => import('./templates/VenousThromboembolismRiskDocument'));
const PerformanceAssessmentDocument = lazy(() => import('./templates/PerformanceAssessmentDocument'));
const DocumentTypeDocument = lazy(() => import('./templates/DocumentTypeDocument'));

/**
 * Loading fallback component for Suspense
 */
const TemplateLoadingFallback = () => (
  <div className="template-loading-fallback" style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: '#9ca3af',
    minHeight: '200px'
  }}>
    <div className="loading-spinner" style={{
      width: '40px',
      height: '40px',
      border: '3px solid rgba(96, 165, 250, 0.2)',
      borderTop: '3px solid #60a5fa',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      marginBottom: '16px'
    }} />
    <p style={{ margin: 0, fontSize: '14px' }}>Loading template...</p>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

/**
 * AIDocumentRenderer - Smart Template Router for Unified Medical Documents
 *
 * PURPOSE:
 * Routes unified_medical_documents to the correct template based on category.
 * Uses PATTERN MATCHING to handle category variations (singular/plural, synonyms, etc.)
 *
 * TWO-PATH ARCHITECTURE:
 * - Path 1 (THIS FILE): unified_medical_documents → Complete docs for doctor review
 * - Path 2 (BACKEND): Granular collections (medications, labs, vitals) → Fast searches & Claude functions
 *
 * ROUTING STRATEGY:
 * 1. Exact match (fast path)
 * 2. Pattern match (handles variations)
 * 3. Generic fallback (unknown categories)
 *
 * Props:
 * @param {object} document - Document from unified_medical_documents (contains documentData)
 * @param {string} category - Category name from backend
 * @param {function} onSave - Callback when save is clicked (future: editing)
 */
const AIDocumentRenderer = ({ document, category, onSave }) => {

  /**
   * Template Registry - Maps patterns to template components
   *
   * PATTERNS:
   * - Use regex for flexible matching
   * - Match singular/plural variations
   * - Match synonyms and common variations
   * - Order matters: specific patterns first, generic patterns last
   */
  const TEMPLATE_PATTERNS = [
    // ========== MISSING-TEMPLATES BUILD (schema-only, anchored exact patterns — June 2026) ==========
    { name: 'Syphilis Treatment Follow-Up', patterns: [/^syphilis_treatment_follow_up$/i], component: SyphilisTreatmentFollowUpDocument },
    { name: 'Varicose Vein Treatment', patterns: [/^varicose_vein_treatment$/i], component: VaricoseVeinTreatmentDocument },
    { name: 'Heart Transplant Follow-Up', patterns: [/^heart_transplant_follow_up$/i], component: HeartTransplantFollowUpDocument },
    { name: 'Kidney Transplant Follow-Up', patterns: [/^kidney_transplant_follow_up$/i], component: KidneyTransplantFollowUpDocument },
    { name: 'Foot Reconstruction', patterns: [/^foot_reconstruction$/i], component: FootReconstructionDocument },
    { name: 'Pulmonary Rehabilitation', patterns: [/^pulmonary_rehabilitation$/i], component: PulmonaryRehabilitationDocument },
    { name: 'Medication Action Plan', patterns: [/^medication_action_plan$/i], component: MedicationActionPlanDocument },
    { name: 'Polypharmacy', patterns: [/^polypharmacy$/i], component: PolypharmacyDocument },
    { name: 'Cesarean Threshold Assessment', patterns: [/^cesarean_threshold$/i], component: CesareanThresholdDocument },
    { name: 'Diabetes Education & Self-Management', patterns: [/^diabetes_educator_training$/i], component: DiabetesEducatorTrainingDocument },
    { name: 'Height Measurements', patterns: [/^height_measurements$/i], component: HeightMeasurementsDocument },
    { name: 'Point-of-Care Ultrasound Heart Rate', patterns: [/^point_of_care_ultrasound_heart_rate$/i], component: PointOfCareUltrasoundHeartRateDocument },
    { name: 'Glucose Tolerance Test', patterns: [/^glucose_testing_weeks$/i], component: GlucoseTestingWeeksDocument },
    { name: 'Social & Functional Assessment', patterns: [/^social_functional_assessment$/i], component: SocialFunctionalAssessmentDocument },
    { name: 'Patient Emotional Response', patterns: [/^patient_emotional_response$/i], component: PatientEmotionalResponseDocument },
    { name: 'Support Group Referral', patterns: [/^support_group_referral$/i], component: SupportGroupReferralDocument },
    { name: 'Partner Involvement Assessment', patterns: [/^partner_involvement$/i], component: PartnerInvolvementDocument },
    { name: 'Admission Decision', patterns: [/^admission_decisions$/i], component: AdmissionDecisionsDocument },
    { name: 'Post-Operative Testing (Orthopedic)', patterns: [/^post_op_testing$/i], component: PostOpTestingDocument },
    { name: 'Post-Operative Testing', patterns: [/^postop_testing$/i], component: PostopTestingDocument },
    // Phase 2 — anchored dedicated entries placed BEFORE the broad thieves (Transplant Assessment /^bone.*marrow.*transplant/i ; Pancreas Transplant Evaluation /^pancreas.*transplant/i)
    { name: 'Bone Marrow Transplant Evaluation', patterns: [/^bone_marrow_transplant_evaluation$/i], component: BoneMarrowTransplantEvaluationDocument },
    { name: 'Bone Marrow Transplant Follow-Up', patterns: [/^bone_marrow_transplant_follow_up$/i], component: BoneMarrowTransplantFollowUpDocument },
    { name: 'Pancreas Transplant Follow-Up', patterns: [/^pancreas_transplant_follow_up$/i], component: PancreasTransplantFollowUpDocument },
    { name: 'Bone Marrow Report', patterns: [/^bone_marrow_reports$/i], component: BoneMarrowReportsDocument },
    { name: 'Cytogenetics', patterns: [/^cytogenetics$/i], component: CytogeneticsDocument },
    { name: 'Mayo Score', patterns: [/^mayo_score$/i], component: MayoScoreDocument },
    { name: 'Blood Products / Transfusion', patterns: [/^blood_products$/i], component: BloodProductsDocument },
    { name: 'Pre-Operative Preparation', patterns: [/^pre_operative_preparation$/i], component: PreOperativePreparationDocument },
    { name: 'Amniotic Fluid Index', patterns: [/^amniotic_fluid_index_current$/i], component: AmnioticFluidIndexCurrentDocument },
    { name: 'Fetal Echocardiography Results', patterns: [/^fetal_echo_results$/i], component: FetalEchoResultsDocument },
    { name: 'Annual Physical Examination', patterns: [/^annual_physical_examination$/i], component: AnnualPhysicalExaminationDocument },
    { name: 'Caregiver Support Groups', patterns: [/^caregiver_support_groups$/i], component: CaregiverSupportGroupsDocument },
    { name: 'Family Meeting Decisions', patterns: [/^family_meeting_decisions$/i], component: FamilyMeetingDecisionsDocument },
    { name: 'Goals of Care Discussions', patterns: [/^goals_of_care_discussions$/i], component: GoalsOfCareDiscussionsDocument },
    { name: 'Frailty Assessment', patterns: [/^frailty_assessment$/i], component: FrailtyAssessmentDocument },
    { name: 'Geriatric Nutritional Assessment', patterns: [/^geriatric_nutritional_assessment$/i], component: GeriatricNutritionalAssessmentDocument },
    { name: 'Chronic Disease Goals', patterns: [/^chronic_disease_goals$/i], component: ChronicDiseaseGoalsDocument },
    { name: 'Continuous Glucose Monitor Discussion', patterns: [/^continuous_glucose_monitor_discussion$/i], component: ContinuousGlucoseMonitorDiscussionDocument },
    { name: 'Hypoglycemia Protocol', patterns: [/^hypoglycemia_protocol$/i], component: HypoglycemiaProtocolDocument },
    { name: 'Hormone Therapy Records', patterns: [/^hormone_therapy_records$/i], component: HormoneTherapyRecordsDocument },
    { name: 'Fluid Electrolyte Management (exact)', patterns: [/^fluid_electrolyte_management$/i], component: FluidElectrolyteManagementDocument },
    { name: 'Urology Assessment', patterns: [/^urology_assessment$/i], component: UrologyAssessmentDocument },
    { name: 'Neuropsych Testing', patterns: [/^neuropsych_testing$/i], component: NeuropsychTestingDocument },
    { name: 'Occupational Exposure Records', patterns: [/^occupational_exposure_records$/i], component: OccupationalExposureRecordsDocument },
    { name: 'FMLA Documentation Note', patterns: [/^fmla_documentation_note$/i], component: FmlaDocumentationNoteDocument },
    { name: 'Workers Comp Evaluations', patterns: [/^workers_comp_evaluations$/i], component: WorkersCompEvaluationsDocument },
    { name: 'Tractography Studies (exact)', patterns: [/^tractography_studies$/i], component: TractographyStudiesDocument },
    { name: 'Wellness Visit Documentation', patterns: [/^wellness_visit_documentation$/i], component: WellnessVisitDocumentationDocument },
    { name: 'Doctors Medications Recommendations Optimizations', patterns: [/^doctors_medications_recommendations_optimizations$/i], component: DoctorsMedicationsRecommendationsOptimizationsDocument },
    { name: 'GI Risk Assessment (exact)', patterns: [/^gi_risk_assessment$/i], component: GiRiskAssessmentDocument },
    { name: 'Trend Analysis (exact)', patterns: [/^trend_analysis$/i], component: TrendAnalysisDocument },
    { name: 'Allergy Assessments (exact)', patterns: [/^allergy_assessments$/i], component: AllergyAssessmentsDocument },
    { name: 'Continuous Glucose Monitor (exact)', patterns: [/^continuous_glucose_monitor$/i], component: ContinuousGlucoseMonitorDocument },
    { name: 'Vital Signs Monitoring (exact)', patterns: [/^vital_signs_monitoring$/i], component: VitalSignsMonitoringDocument },
    { name: 'Emergency Disposition', patterns: [/^emergency_disposition$/i], component: EmergencyDispositionDocument },
    { name: 'Procedure Requests', patterns: [/^procedure_requests$/i], component: ProcedureRequestsDocument },
    { name: 'Port Placement', patterns: [/^port_placement$/i], component: PortPlacementDocument },

    // ========== DISCHARGE SUMMARIES (Granular Collection - MUST BE FIRST) ==========
    {
      name: 'Discharge Summary',
      patterns: [
        /^discharge_summaries$/i,          // EXACT match for discharge_summaries collection (granular, flat structure)
      ],
      component: DischargeSummaryDocument  // Dedicated template for flat structure
    },

    // ========== HOSPITAL DISCHARGE SUMMARIES (New Dedicated Template - November 2025) ==========
    {
      name: 'Hospital Discharge Summaries',
      patterns: [
        /^hospital_discharge_summaries$/i,  // EXACT match for hospital_discharge_summaries collection
      ],
      component: HospitalDischargeSummariesDocument  // Dedicated template with 23 unique fields
    },

    // ========== HOSPITAL DISCHARGE (Unified Collection) ==========
    {
      name: 'Hospital Discharge',
      patterns: [
        /^hospital.*discharge/i,           // hospital_discharge (but NOT hospital_discharge_summaries - caught above)
        /^discharge.*summar/i,             // discharge_summary
        /^inpatient.*discharge/i,          // inpatient_discharge_summary
        /^discharge.*note/i,               // discharge_notes
      ],
      component: HospitalDischargeDocument // Expects nested structure from unified_medical_documents
    },

    // ========== HOSPITAL COURSE ==========
    {
      name: 'Hospital Course',
      patterns: [
        /^hospital_course$/i,              // EXACT match: hospital_course collection
        /^hospital.*course/i,              // hospital_course, hospital_course_notes
        /^inpatient.*course/i,             // inpatient_course
        /^hospitalization.*course/i,       // hospitalization_course
      ],
      component: HospitalCourseDocument   // Hospital course timeline from admission to discharge
    },

    // ========== CARDIOLOGY ==========
    {
      name: 'Cardiology Admission Notes',
      patterns: [
        /^cardiology_admission_notes$/i,   // EXACT match: cardiology_admission_notes collection
        /^cardiology.*admission.*note/i,   // cardiology_admission_notes variations
      ],
      component: CardiologyAdmissionNotesDocument
    },
    {
      name: 'Rehabilitation Goals',
      patterns: [
        /^rehabilitation_goals$/i,         // EXACT match: rehabilitation_goals collection
        /^rehab.*goal/i,                   // rehab_goals, rehabilitation_goal
        /^therapy.*goal/i,                 // therapy_goals
        /^pt.*goal/i,                      // pt_goals (physical therapy)
        /^ot.*goal/i,                      // ot_goals (occupational therapy)
      ],
      component: RehabilitationGoalsDocument
    },

    // ========== REHABILITATION PROGRESS NOTES ==========
    {
      name: 'Rehabilitation Progress Notes',
      patterns: [
        /^rehabilitation_progress_notes$/i,   // EXACT match
        /^rehabilitation.*progress/i,         // rehabilitation progress
        /^rehab.*progress.*note/i,           // rehab progress notes
        /^rehab.*progress/i,                 // rehab progress
      ],
      component: RehabilitationProgressNotesDocument
    },
    {
      name: 'Cardiology Admission',
      patterns: [
        /^cardiology.*admission/i,         // cardiology_admission (general)
        /^cardiac.*admission/i,            // cardiac_admission
        /^cardiology.*inpatient/i,         // cardiology_inpatient_note
        /^acs.*admission/i,                // acs_admission (Acute Coronary Syndrome)
      ],
      component: CardiologyAdmissionDocument
    },

    // ========== ECHO REPORTS ==========
    {
      name: 'Echocardiogram Reports',
      patterns: [
        /^echo_reports$/i,                 // EXACT match: echo_reports collection
        /^echo.*report/i,                  // echo_report, echocardiogram_report
        /^echocardiogram/i,                // echocardiogram, echocardiogram_reports
        /^cardiac.*echo/i,                 // cardiac_echo, cardiac_echocardiogram
      ],
      component: EchoReportsDocument
    },

    // ========== ECG/EKG REPORTS ==========
    {
      name: 'ECG Reports',
      patterns: [
        /^ecg_reports$/i,                  // EXACT match: ecg_reports collection
        /^ecg.*report/i,                   // ecg_report, ecg_reports
        /^ekg.*report/i,                   // ekg_report, ekg_reports
        /^ekg$/i,                          // ekg
        /^ecg$/i,                          // ecg
        /^electrocardiogram/i,             // electrocardiogram, electrocardiography
        /^12.*lead.*ecg/i,                 // 12_lead_ecg, 12-lead-ecg
        /^cardiac.*rhythm/i,               // cardiac_rhythm
        /^heart.*rhythm/i,                 // heart_rhythm
      ],
      component: EcgReportsDocument
    },

    // ========== CARDIOLOGY CONSULTATIONS ==========
    {
      name: 'Cardiology Consultations',
      patterns: [
        /^cardiology_consultations$/i,     // EXACT match: cardiology_consultations collection
        /^cardiology.*consult/i,           // cardiology_consultation, cardiology_consultations
        /^cardiac.*consult/i,              // cardiac_consultation
        /^cardio.*consult/i,               // cardio_consultation
      ],
      component: CardiologyConsultationsDocument
    },

    // ========== CARDIOLOGY FOLLOWUP REPORTS ==========
    {
      name: 'Cardiology Follow-Up Reports',
      patterns: [
        /^cardiology_followup_reports$/i,  // EXACT match: cardiology_followup_reports collection
        /^cardiology.*followup/i,          // cardiology_followup, cardiology_followup_report
        /^cardiology.*follow.*up/i,        // cardiology_follow_up, cardiology follow-up
        /^cardiac.*followup/i,             // cardiac_followup, cardiac_followup_report
        /^cardiac.*follow.*up/i,           // cardiac_follow_up
        /^heart.*followup/i,               // heart_followup
        /^cv.*followup/i,                  // cv_followup (cardiovascular)
      ],
      component: CardiologyFollowupReportsDocument
    },
    {
      // MUST be BEFORE CardiovascularRiskReduction - /^cardiovascular.*risk/i would match cardiovascular_risk_screening
      name: 'Cardiovascular Risk Screening',
      patterns: [
        /^cardiovascular_risk_screening$/i,     // EXACT match
        /^cv.*risk.*screening/i,                // cv_risk_screening
        /^cardiac.*risk.*screening/i,           // cardiac_risk_screening
        /^heart.*risk.*screening/i,             // heart_risk_screening
      ],
      component: CardiovascularRiskScreeningDocument
    },
    {
      name: 'Cardiovascular Risk Reduction',
      patterns: [
        /^cardiovascular_risk_reduction$/i,    // EXACT match: cardiovascular_risk_reduction collection
        /^cardiovascular.*risk.*reduction/i,   // cardiovascular_risk_reduction
        /^cv.*risk.*reduction/i,               // cv_risk_reduction
        /^cardiac.*risk.*reduction/i,          // cardiac_risk_reduction
        /^heart.*risk.*reduction/i,            // heart_risk_reduction
        // NOTE: Removed /^cardiovascular.*risk/i - too generic, matches cardiovascular_risk_screening
      ],
      component: CardiovascularRiskReductionDocument
    },
    {
      name: 'Stress Test Reports',
      patterns: [
        /^stress_test_reports$/i,            // EXACT match: stress_test_reports collection
        /^stress.*test.*report/i,            // stress_test_reports, stress_test_report
        /^stress.*test/i,                    // stress_test, stress_tests
        /^cardiac.*stress/i,                 // cardiac_stress_test
        /^exercise.*stress/i,                // exercise_stress_test
        /^6.*minute.*walk/i,                 // 6_minute_walk_test
      ],
      component: StressTestReportsDocument
    },

    // ========== ABNORMAL RESULTS ==========
    {
      name: 'Abnormal Results',
      patterns: [
        /^abnormal_results$/i,                // EXACT match
        /^abnormal.*result/i,                 // abnormal results
        /^abnormal.*finding/i,               // abnormal findings
        /^abnormal.*lab/i,                   // abnormal labs
        /^critical.*result/i,               // critical results
      ],
      component: AbnormalResultsDocument
    },

    // ========== ANESTHESIA ==========
    {
      name: 'Anesthesia Complications',
      patterns: [
        /^anesthesia_complications$/i,     // EXACT match: anesthesia_complications
        /^anesthesia.*complication/i,       // anesthesia_complication variations
      ],
      component: AnesthesiaComplicationsDocument
    },
    {
      name: 'Anesthesia Consent',
      patterns: [
        /^anesthesia_consent$/i,           // EXACT match: anesthesia_consent
        /^anesthesia.*consent/i,           // anesthesia_consent variations
      ],
      component: AnesthesiaConsentDocument
    },
    {
      name: 'Anesthesia Records',
      patterns: [
        /^anesthesia_records$/i,           // EXACT match: anesthesia_records
        /^anesthesia.*record/i,            // anesthesia_records, anesthesia_record
      ],
      component: AnesthesiaRecordsDocument
    },
    {
      name: 'Anesthesiology Assessment',
      patterns: [
        /^anesthesiology_assessment$/i,    // EXACT match: anesthesiology_assessment
        /^anesthesiology.*assessment/i,    // anesthesiology_preop_assessment
      ],
      component: AnesthesiologyAssessmentDocument
    },
    {
      name: 'Anesthesia Preoperative',
      patterns: [
        /^anesthesia/i,                    // anesthesia_preop
        /^anesthesiology/i,                // anesthesiology (other collections)
        /^preop.*anesthesia/i,             // preop_anesthesia_evaluation
        /^preanesthesia/i,                 // preanesthesia_assessment
      ],
      component: AnesthesiaDocument
    },

    // ========== EMERGENCY AIRWAY MANAGEMENT ==========
    {
      name: 'Emergency Airway Management',
      patterns: [
        /^emergency[_\s]?airway[_\s]?management$/i,  // emergency_airway_management
      ],
      component: EmergencyAirwayManagementDocument
    },

    // ========== AIRWAY MANAGEMENT ==========
    {
      name: 'Airway Management',
      patterns: [
        /^airway_management_records?$/i,   // airway_management_records
        /^airway.*management/i,            // airway_management, airway management
        /^airway.*record/i,                // airway_records
        /^endotracheal.*intubation/i,      // endotracheal_intubation
        /^laryngeal.*mask/i,               // laryngeal_mask_airway
        /^extubation/i,                    // extubation_records
        /^intubation/i,                    // intubation_records
      ],
      component: AirwayManagementDocument
    },
    // ========== AIRWAY CLEARANCE THERAPY (EXACT - before generic airway) ==========
    {
      name: 'Airway Clearance Therapy',
      patterns: [
        /^airway_clearance_therapy$/i,         // EXACT: airway_clearance_therapy
        /^airway.*clearance.*therapy/i,        // airway_clearance_therapy variations
        /^airway.*clearance/i,                 // airway_clearance
        /^clearance.*therapy/i,                // clearance_therapy
      ],
      component: AirwayClearanceTherapyDocument
    },

    // ========== REGIONAL ANESTHESIA ==========
    {
      name: 'Regional Anesthesia',
      patterns: [
        /^regional_anesthesia_records?$/i,  // regional_anesthesia_records
        /^regional.*anesthesia/i,           // regional_anesthesia, regional anesthesia
        /^nerve.*block/i,                   // nerve_blocks, nerve_block
        /^epidural/i,                       // epidural, epidural_anesthesia
        /^spinal.*anesthesia/i,             // spinal_anesthesia
        /^peripheral.*block/i,              // peripheral_nerve_block
        /^regional.*block/i,                // regional_block
      ],
      component: RegionalAnesthesiaDocument
    },

    // ========== PROCEDURAL SEDATION ==========
    {
      name: 'Procedural Sedation',
      patterns: [
        /^procedural_sedation$/i,            // EXACT match: procedural_sedation
        /^procedural.*sedation/i,            // procedural_sedation variations
      ],
      component: ProceduralSedationDocument
    },

    // ========== SEDATION RECORDS ==========
    {
      name: 'Sedation Records',
      patterns: [
        /^sedation_records$/i,               // EXACT match: sedation_records
        /^sedation.*record/i,                // sedation_records, sedation_record
        /^sedation.*management/i,            // sedation_management
        /^conscious.*sedation/i,             // conscious_sedation
        /^moderate.*sedation/i,              // moderate_sedation
      ],
      component: SedationRecordsDocument
    },

    // ========== CHRONIC PAIN ASSESSMENT ==========
    {
      name: 'Chronic Pain Assessment',
      patterns: [
        /^chronic_pain_assessment$/i,       // EXACT match: chronic_pain_assessment
        /^chronic.*pain.*assessment/i,      // chronic_pain_assessment, chronic pain assessment
        /^pain[_\s]?assessment$/i,          // pain_assessment, pain assessment (anchored so it does NOT steal pain_assessment_forms)
        /^chronic.*pain.*scale/i,           // chronic_pain_scale
        /^pain.*scale/i,                    // pain_scale
        /^pain.*evaluation/i,               // pain_evaluation
        /^disability.*index/i,              // disability_index
      ],
      component: ChronicPainAssessmentDocument
    },

    // ========== CHALLENGE TESTS ==========
    {
      name: 'Challenge Tests',
      patterns: [
        /^challenge_tests?$/i,             // EXACT match: challenge_tests, challenge_test
        /^challenge.*test/i,               // challenge_test, challenge_tests
        /^food.*challenge/i,               // food_challenge_test
        /^drug.*challenge/i,               // drug_challenge_test
        /^aspirin.*challenge/i,            // aspirin_challenge_test
        /^exercise.*challenge/i,           // exercise_challenge_test
        /^wdeia/i,                         // wdeia (water/food-dependent exercise-induced anaphylaxis)
        /^aerd/i,                          // aerd (aspirin-exacerbated respiratory disease)
      ],
      component: ChallengeTestsDocument
    },

    // ========== ASTHMA ASSESSMENTS ==========
    {
      name: 'Asthma Assessments',
      patterns: [
        /^asthma_assessments?$/i,          // EXACT match: asthma_assessments, asthma_assessment
        /^asthma.*assessment/i,            // asthma_assessment, asthma_assessments
        /^pulmonary.*asthma/i,             // pulmonary_asthma_assessment
      ],
      component: AsthmaAssessmentsDocument
    },

    // ========== ASTHMA ACTION PLAN ==========
    {
      name: 'Asthma Action Plan',
      patterns: [
        /^asthma_action_plan$/i,           // EXACT match: asthma_action_plan
        /^asthma_action_plans$/i,          // asthma_action_plans
        /^asthma.*action.*plan/i,          // asthma_action_plan variations
      ],
      component: AsthmaActionPlanDocument
    },

    // ========== ALLERGY SKIN TESTING ==========
    {
      name: 'Allergy Skin Testing',
      patterns: [
        /^allergy_skin_testing$/i,         // EXACT match: allergy_skin_testing
        /^skin.*allergy.*test/i,           // skin_allergy_testing
        /^allergy.*skin.*test/i,           // allergy_skin_test
      ],
      component: AllergySkinTestingDocument
    },

    // ========== SPECIFIC IGE TESTS (Bar Chart - December 2025) ==========
    {
      name: 'Specific IgE Tests',
      patterns: [
        /^specific_ige_tests$/i,         // EXACT match: specific_ige_tests
        /^specific.*ige/i,                 // specific_ige, specific_ige_test
        /^ige.*test/i,                     // ige_testing, ige_test
        /^allergen.*blood.*test/i,         // allergen_blood_test
        /^blood.*allergen/i,               // blood_allergen_testing
      ],
      component: SpecificIgeTestsDocument
    },

    // ========== COMPONENT ALLERGEN TESTING ==========
    {
      name: 'Component Allergen Testing',
      patterns: [
        /^component_allergen_testing$/i,   // EXACT match: component_allergen_testing
        /^component.*allergen/i,           // component_allergen_test, component_allergen
        /^allergen.*component/i,           // allergen_component_testing
        /^component.*resolved/i,           // component_resolved_diagnostics
        /^crd/i,                           // CRD (Component-Resolved Diagnostics)
      ],
      component: ComponentAllergenTestingDocument
    },

    // ========== ALLERGIES ASSESSMENTS (MUST COME BEFORE ALLERGY & IMMUNOLOGY) ==========
    {
      name: 'Allergies Assessments',
      patterns: [
        /^allergy_assessments$/i,          // EXACT match: allergy_assessments (granular collection)
        /^allergies_assessments$/i,        // allergies_assessments (legacy)
        /^allergies.*assessment/i,         // allergies_assessments, allergies_assessment
        /^allergy.*test/i,                 // allergy_testing, allergy_tests
        /^allergen.*assessment/i,          // allergen_assessment
      ],
      component: AllergiesAssessmentDocument
    },

    // ========== ALLERGY & IMMUNOLOGY ==========
    {
      name: 'Allergy & Immunology Assessment',
      patterns: [
        /^allergy.*immunology/i,           // allergy_immunology_assessment
        /^immunology.*allergy/i,           // immunology_allergy_assessment
        /^allergist.*consult/i,            // allergist_consultation
        /^immunology.*assessment/i,        // immunology_assessment
      ],
      component: AllergyImmunologyAssessmentDocument
    },

    // ========== PATIENT DETAILS ==========
    {
      name: 'Patient Details',
      patterns: [
        /^patient.*detail/i,               // patient_details
        /^patient.*profile/i,              // patient_profile
        /^patient.*information/i,          // patient_information
      ],
      component: PatientDetailsDocument
    },

    // ========== ALLERGIES ==========
    {
      name: 'Allergies',
      patterns: [
        /^allergies$/i,                    // allergies
        /^allergy$/i,                      // allergy
        /^allergy.*list/i,                 // allergy_list
        /^patient.*allergies/i,            // patient_allergies
        /^known.*allergies/i,              // known_allergies
      ],
      component: AllergiesDocument
    },

    // ========== MEDICATIONS ==========
    {
      name: 'Medications',
      patterns: [
        /^medications?$/i,                 // medications, medication
        /^medication.*list/i,              // medication_list
        /^medication(?!.*admin).*record/i, // medication_records but NOT medication_administration_records
        /^med.*list/i,                     // med_list
        /^prescription.*medication/i,      // prescription_medications
        /^current.*medication/i,           // current_medications
      ],
      component: MedicationsDocument
    },

    // ========== MEDICATION OPTIMIZATION ==========
    {
      name: 'Medication Optimization',
      patterns: [
        /^medication.*optimization/i,      // medication_optimization
        /^med.*optimization/i,             // med_optimization
        /^medication.*review/i,            // medication_review
        /^drug.*optimization/i,            // drug_optimization
      ],
      component: MedicationOptimizationDocument
    },

    // ========== PRESCRIPTIONS ==========
    {
      name: 'Prescriptions',
      patterns: [
        /^prescriptions?$/i,               // prescriptions, prescription
        /^prescription.*list/i,            // prescription_list
        /^prescription.*record/i,          // prescription_records
        /^rx.*list/i,                      // rx_list
        /^active.*prescription/i,          // active_prescriptions
        /^current.*prescription/i,         // current_prescriptions
      ],
      component: PrescriptionsDocument
    },

    // ========== DIAGNOSES ==========
    {
      name: 'Diagnoses',
      patterns: [
        /^diagnoses$/i,                    // diagnoses
        /^diagnosis$/i,                    // diagnosis
        /^diagnosis.*list/i,               // diagnosis_list
        /^diagnosis.*record/i,             // diagnosis_records
        /^active.*diagnos/i,               // active_diagnoses
        /^patient.*diagnos/i,              // patient_diagnoses
      ],
      component: DiagnosesDocument
    },

    // ========== DIAGNOSTIC IMPRESSION ==========
    {
      name: 'Diagnostic Impression',
      patterns: [
        /^diagnostic_impression$/i,
        /^diagnostic.*impression/i,
      ],
      component: DiagnosticImpressionDocument
    },

    // ========== LAB RESULTS ==========
    {
      name: 'Laboratory Results',
      patterns: [
        /^lab.*results?$/i,                // lab_results, lab_result
        /^laboratory.*results?/i,          // laboratory_results
        /^labs?$/i,                        // labs, lab
        /^lab.*test/i,                     // lab_tests
        /^test.*results?$/i,               // test_results (exact match only)
      ],
      component: LabResultsDocument
    },

    // ========== ENDOCRINE LAB RESULTS ==========
    {
      name: 'Endocrine Lab Results',
      patterns: [
        /^endocrine_lab_results$/i,        // EXACT match: endocrine_lab_results
        /^endocrine.*lab.*results?/i,      // endocrine_lab_results variations
        /^endocrine.*labs?$/i,             // endocrine_labs
        /^endocrine.*panel/i,              // endocrine_panel
        /^thyroid.*labs?$/i,               // thyroid_labs
        /^hormone.*labs?$/i,               // hormone_labs
        /^pituitary.*labs?$/i,             // pituitary_labs
        /^adrenal.*labs?$/i,               // adrenal_labs
      ],
      component: EndocrineLabResultsDocument
    },

    // ========== DIABETES SUPPLIES ==========
    {
      name: 'Diabetes Supplies',
      patterns: [
        /^diabetes_supplies$/i,            // EXACT match: diabetes_supplies
        /^diabetes.*supplies?/i,           // diabetes_supplies variations
        /^diabetic.*supplies?/i,           // diabetic_supplies
        /^glucose.*supplies?/i,            // glucose_supplies
        /^cgm.*supplies?/i,                // cgm_supplies
        /^insulin.*pump.*supplies?/i,      // insulin_pump_supplies
        /^dme.*diabetes/i,                 // dme_diabetes
        /^diabetes.*equipment/i,            // diabetes_equipment
      ],
      component: DiabetesSuppliesDocument
    },

    // ========== BASAL RATE ADJUSTMENTS ==========
    {
      name: 'Basal Rate Adjustments',
      patterns: [
        /^basal_rate_adjustments$/i,       // EXACT match: basal_rate_adjustments
        /^basal.*rate.*adjustments?/i,     // basal_rate_adjustments variations
        /^basal.*adjustments?/i,           // basal_adjustments
        /^insulin.*basal/i,                // insulin_basal
        /^pump.*basal/i,                   // pump_basal
        /^basal.*insulin.*rate/i,          // basal_insulin_rate
      ],
      component: BasalRateAdjustmentsDocument
    },

    // ========== BOLUS ADJUSTMENTS ==========
    {
      name: 'Bolus Adjustments',
      patterns: [
        /^bolus_adjustments$/i,            // EXACT match: bolus_adjustments
        /^bolus.*adjustments?/i,           // bolus_adjustments variations
        /^insulin.*bolus/i,                // insulin_bolus
        /^bolus.*ratio/i,                  // bolus_ratio
        /^ic.*ratio/i,                     // ic_ratio (insulin:carb)
        /^insulin.*carb.*ratio/i,          // insulin_carb_ratio
      ],
      component: BolusAdjustmentsDocument
    },

    // ========== LAB ORDERS ==========
    {
      name: 'Laboratory Orders',
      patterns: [
        /^lab_orders$/i,                   // EXACT match: lab_orders
        /^lab.*order/i,                    // lab_orders, lab_order
        /^laboratory.*order/i,             // laboratory_orders
        /^order.*lab/i,                    // ordered_labs
        /^pending.*lab/i,                  // pending_labs
      ],
      component: LabOrdersDocument
    },

    // ========== RADIOLOGY REPORTS ==========
    {
      name: 'Radiology Reports',
      patterns: [
        /^radiology_reports$/i,            // EXACT match: radiology_reports
        /^radiology.*report/i,             // radiology_report, radiological_reports
        /^radiologic.*report/i,            // radiologic_reports, radiological_reports
        /^rad.*report/i,                   // rad_reports (common abbreviation)
      ],
      component: RadiologyReportsDocument
    },

    // ========== MAMMOGRAPHY REPORTS ==========
    {
      name: 'Mammography Reports',
      patterns: [
        /^mammography_reports$/i,            // EXACT match: mammography_reports
        /^mammography.*report/i,             // mammography_report, mammography_reports
        /^mammo.*report/i,                   // mammo_report (abbreviation)
        /^breast.*mammogra/i,                // breast mammography
        /^bilateral.*mammogra/i,             // bilateral mammography
      ],
      component: MammographyReportsDocument
    },

    // ========== INTERVENTIONAL RADIOLOGY NOTES ==========
    {
      name: 'Interventional Radiology Notes',
      patterns: [
        /^interventional_radiology_notes$/i,   // EXACT match: interventional_radiology_notes
        /^interventional.*radiology/i,         // interventional_radiology, interventional_radiology_notes
        /^ir_notes$/i,                         // ir_notes (common abbreviation)
        /^ir_procedures$/i,                    // ir_procedures
      ],
      component: InterventionalRadiologyNotesDocument
    },

    // ========== MRI REPORTS ==========
    {
      name: 'MRI Reports',
      patterns: [
        /^mri_reports$/i,                  // EXACT match: mri_reports
        /^mri.*report/i,                   // mri_report, mri_reports
        /^magnetic.*resonance/i,           // magnetic_resonance_imaging
        /^mr.*imaging/i,                   // mr_imaging
      ],
      component: MriReportsDocument
    },

    // ========== MULTIPLE SCLEROSIS ASSESSMENT ==========
    {
      name: 'Multiple Sclerosis Assessment',
      patterns: [
        /^multiple[_\s]?sclerosis[_\s]?assessment/i,  // multiple_sclerosis_assessment
        /^ms[_\s]assessment/i,                          // ms_assessment
        /^multiple[_\s]?sclerosis/i,                    // multiple_sclerosis
      ],
      component: MultipleSclerosisAssessmentDocument
    },

    // ========== PREOPERATIVE PREPARATION ==========
    {
      name: 'Preoperative Preparation',
      patterns: [
        /^preoperative_preparation$/i,     // EXACT match: preoperative_preparation
        /^preoperative.*prep/i,            // preoperative_prep, preoperative_preparation
        /^pre.*operative.*prep/i,          // pre_operative_preparation
        /^surgery.*prep/i,                 // surgery_preparation
        /^surgical.*prep/i,                // surgical_preparation
      ],
      component: PreoperativePreparationDocument
    },

    // ========== IMAGING REPORTS ==========
    {
      name: 'Imaging Reports',
      patterns: [
        /^imaging.*report/i,               // imaging_reports, imaging_report
        /^imaging.*stud/i,                 // imaging_studies
        /^diagnostic.*imaging/i,           // diagnostic_imaging
      ],
      component: ImagingReportsDocument
    },

    // ========== PULMONARY IMAGING ==========
    {
      name: 'Pulmonary Imaging',
      patterns: [
        /^pulmonary_imaging$/i,            // EXACT match
        /^pulmonary.*imaging/i,            // pulmonary_imaging
        /^lung.*imaging/i,                 // lung_imaging
      ],
      component: PulmonaryImagingDocument
    },

    // ========== IMAGING ORDERS (Pending) ==========
    {
      name: 'Imaging Orders',
      patterns: [
        /^imaging.*order/i,                // imaging_orders, imaging_order
        /^radiology.*order/i,              // radiology_orders
        /^pending.*imaging/i,              // pending_imaging
        /^ordered.*imaging/i,              // ordered_imaging
      ],
      component: ImagingOrdersDocument
    },

    // ========== IMMUNIZATION STATUS ==========
    {
      name: 'Immunization Status',
      patterns: [
        /^immunization_status$/i,          // EXACT match
        /^immunization.*status/i,          // immunization_status, immunization_report_status
        /^vaccination.*status/i,           // vaccination_status
        /^vaccine.*status/i,               // vaccine_status
      ],
      component: ImmunizationStatusDocument
    },

    // ========== IMMUNIZATION RECORD (June 2026 — own schema: vaccine history, contraindications, catch-up; was misrouted to Immunization Status) ==========
    {
      name: 'Immunization Record',
      patterns: [
        /^immunization[_\s]?records?$/i,   // immunization_record, immunization_records
      ],
      component: ImmunizationRecordDocument
    },

    // ========== ADDITIONAL DATA ==========
    {
      name: 'Additional Data',
      patterns: [
        /^additional.*data/i,              // additional_data
        /^supplemental.*data/i,            // supplemental_data
        /^other.*data/i,                   // other_data
        /^misc.*data/i,                    // miscellaneous_data
      ],
      component: AdditionalDataDocument
    },

    // ========== INTRAOPERATIVE MONITORING ==========
    {
      name: 'Intraoperative Monitoring',
      patterns: [
        /^intraoperative.*monitor/i,       // intraoperative_monitoring
        /^intraop.*monitor/i,              // intraop_monitoring
        /^neuromonitor/i,                  // neuromonitoring
        /^surgical.*monitor/i,             // surgical_monitoring
        /^iom$/i,                          // IOM (intraoperative monitoring)
      ],
      component: IntraoperativeMonitoringDocument
    },

    // ========== PROGRESS NOTES ==========
    {
      name: 'Progress Notes',
      patterns: [
        /^progress_notes$/i,               // EXACT match: progress_notes
        /^progress.*note/i,                // progress_notes, progress_note
        /^clinical.*progress/i,            // clinical_progress_notes
        /^patient.*progress/i,             // patient_progress_notes
        /^nursing.*progress/i,             // nursing_progress_notes
        /^daily.*progress/i,               // daily_progress_notes
      ],
      component: ProgressNotesDocument
    },

    // ========== CONSULTATION NOTES ==========
    {
      name: 'Consultation Notes',
      patterns: [
        /^consultation.*note/i,            // consultation_notes, consultation_note
        /^consult.*note/i,                 // consult_notes, consult_note
        /^clinic.*note/i,                  // clinical_notes, clinic_note
        /^visit.*note/i,                   // visit_notes
      ],
      component: ConsultationNotesDocument
    },

    // ========== SOAP NOTES ==========
    {
      name: 'SOAP Notes',
      patterns: [
        /^soap_notes$/i,                   // EXACT match: soap_notes
        /^soap.*note/i,                    // soap_notes, soap_note
      ],
      component: SoapNotesDocument
    },

    // ========== INTERVAL HISTORY ==========
    {
      name: 'Interval History',
      patterns: [
        /^interval_history$/i,             // EXACT match: interval_history
        /^interval.*history/i,             // interval_history variations
      ],
      component: IntervalHistoryDocument
    },

    // ========== TELEMEDICINE ENCOUNTERS ==========
    {
      name: 'Telemedicine Encounters',
      patterns: [
        /^telemedicine_encounters$/i,      // EXACT match: telemedicine_encounters
        /^telemedicine.*encounter/i,       // telemedicine_encounter variations
        /^telehealth.*encounter/i,         // telehealth_encounter
        /^virtual.*visit/i,               // virtual_visit
        /^telemedicine.*visit/i,           // telemedicine_visit
      ],
      component: TelemedicineEncountersDocument
    },

    // ========== WEEKLY VIRTUAL CHECK-INS ==========
    {
      name: 'Weekly Virtual Check-Ins',
      patterns: [
        /^weekly_virtual_check_ins$/i,     // EXACT match: weekly_virtual_check_ins
        /^weekly.*virtual.*check/i,        // weekly_virtual_check variations
        /^virtual.*check.*in/i,            // virtual_check_in
      ],
      component: WeeklyVirtualCheckInsDocument
    },

    // ========== CONSULTATION TIMELINE ==========
    {
      name: 'Consultation Timeline',
      patterns: [
        /^consultation[_\s]?timeline$/i,   // consultation_timeline
        /^consult[_\s]?timeline$/i,        // consult_timeline
        /^consultation[_\s]?history$/i,    // consultation_history
      ],
      component: ConsultationTimelineDocument
    },

    // ========== INJURY DETAILS ==========
    {
      name: 'Injury Details',
      patterns: [
        /^injury[_\s]?details?$/i,          // injury_details, injury_detail
        /^injury[_\s]?info/i,              // injury_info
        /^injury[_\s]?report/i,            // injury_report
        /^trauma[_\s]?details/i,           // trauma_details
        /^accident[_\s]?details/i,         // accident_details
        // Note: mechanism_of_injury has its own template (MechanismOfInjuryDocument)
      ],
      component: InjuryDetailsDocument
    },

    // ========== WORK RESTRICTIONS ==========
    {
      name: 'Work Restrictions',
      patterns: [
        /^work[_\s]?restrictions?$/i,      // work_restrictions, work_restriction
        /^work[_\s]?status$/i,             // work_status
        /^return[_\s]?to[_\s]?work$/i,     // return_to_work
        /^disability[_\s]?status$/i,       // disability_status
        /^light[_\s]?duty$/i,              // light_duty
        /^modified[_\s]?duty$/i,           // modified_duty
        /^occupational[_\s]?restrictions/i, // occupational_restrictions
      ],
      component: WorkRestrictionsDocument
    },

    // ========== DISABILITY EVALUATIONS ==========
    {
      name: 'Disability Evaluations',
      patterns: [
        /^disability[_\s]?evaluations?$/i,        // disability_evaluations, disability_evaluation
        /^disability[_\s]?assessment/i,           // disability_assessment
        /^impairment[_\s]?rating/i,               // impairment_rating
        /^impairment[_\s]?evaluation/i,           // impairment_evaluation
        /^ama[_\s]?guides/i,                      // ama_guides (AMA Guides to Impairment)
        /^ttd[_\s]?evaluation/i,                  // ttd_evaluation (Temporary Total Disability)
        /^ptd[_\s]?evaluation/i,                  // ptd_evaluation (Permanent Total Disability)
        /^workers[_\s]?comp.*disability/i,        // workers_comp_disability
        /^whole[_\s]?person[_\s]?impairment/i,    // whole_person_impairment
        /^wpi[_\s]?rating/i,                      // wpi_rating
      ],
      component: DisabilityEvaluationsDocument
    },

    // ========== OCCUPATIONAL MEDICINE EVALUATIONS ==========
    {
      name: 'Occupational Medicine Evaluations',
      patterns: [
        /^occupational[_\s]?medicine[_\s]?evaluations?$/i,  // occupational_medicine_evaluations
        /^occupational[_\s]?medicine[_\s]?assessment/i,    // occupational_medicine_assessment
        /^occ[_\s]?med[_\s]?eval/i,                        // occ_med_eval
        /^work[_\s]?injury[_\s]?evaluation/i,              // work_injury_evaluation
        /^work[_\s]?injury[_\s]?assessment/i,              // work_injury_assessment
        /^functional[_\s]?capacity[_\s]?evaluation/i,      // functional_capacity_evaluation
        /^fce[_\s]?report/i,                               // fce_report
        /^workers[_\s]?comp[_\s]?evaluation/i,             // workers_comp_evaluation
        /^return[_\s]?to[_\s]?work[_\s]?evaluation/i,      // return_to_work_evaluation
      ],
      component: OccupationalMedicineEvaluationsDocument
    },

    // ========== OCCUPATIONAL HEALTH ASSESSMENT ==========
    {
      name: 'Occupational Health Assessment',
      patterns: [
        /^occupational[_\s]?health[_\s]?assessment$/i,     // occupational_health_assessment
        /^oha$/i,                                           // oha (abbreviation)
        /^workplace[_\s]?health[_\s]?assessment/i,         // workplace_health_assessment
        /^employee[_\s]?health[_\s]?assessment/i,          // employee_health_assessment
        /^fit[_\s]?for[_\s]?duty[_\s]?assessment/i,        // fit_for_duty_assessment
        /^fitness[_\s]?for[_\s]?work/i,                    // fitness_for_work
        /^pre[_\s]?employment[_\s]?medical/i,              // pre_employment_medical
        /^return[_\s]?to[_\s]?work[_\s]?assessment/i,      // return_to_work_assessment
      ],
      component: OccupationalHealthAssessmentDocument
    },

    // ========== WORKERS' COMPENSATION EVALUATION ==========
    {
      name: 'Workers\' Compensation Evaluation',
      patterns: [
        /^workers[_\s]?compensation[_\s]?evaluation$/i,   // workers_compensation_evaluation
        /^workers[_\s]?comp[_\s]?eval$/i,                 // workers_comp_eval
        /^wc[_\s]?evaluation$/i,                          // wc_evaluation
        /^work[_\s]?comp$/i,                              // work_comp
        /^workers[_\s]?comp$/i,                           // workers_comp
        /^compensation[_\s]?evaluation$/i,                // compensation_evaluation
        /^injury[_\s]?compensation[_\s]?evaluation$/i,    // injury_compensation_evaluation
        /^occupational[_\s]?injury[_\s]?evaluation$/i,    // occupational_injury_evaluation
        /^work[_\s]?injury[_\s]?claim$/i,                 // work_injury_claim
      ],
      component: WorkersCompensationEvaluationDocument
    },

    // ========== MECHANISM OF INJURY ==========
    {
      name: 'Mechanism of Injury',
      patterns: [
        /^mechanism[_\s]?of[_\s]?injury$/i,     // mechanism_of_injury
        /^injury[_\s]?mechanism$/i,             // injury_mechanism
        /^moi$/i,                               // moi (abbreviation)
        /^mechanism[_\s]?description$/i,        // mechanism_description
        /^injury[_\s]?etiology$/i,              // injury_etiology
        /^how[_\s]?injury[_\s]?occurred$/i,     // how_injury_occurred
        /^occupational[_\s]?injury[_\s]?mechanism/i, // occupational_injury_mechanism
      ],
      component: MechanismOfInjuryDocument
    },

    // ========== WORKPLACE INJURY REPORT ==========
    {
      name: 'Workplace Injury Report',
      patterns: [
        /^workplace[_\s]?injury[_\s]?report$/i,  // workplace_injury_report
        /^work[_\s]?injury[_\s]?report$/i,       // work_injury_report
        /^injury[_\s]?report$/i,                  // injury_report
        /^osha[_\s]?injury[_\s]?report$/i,       // osha_injury_report
        /^osha[_\s]?recordable$/i,               // osha_recordable
        /^workplace[_\s]?accident$/i,            // workplace_accident
        /^work[_\s]?accident[_\s]?report$/i,     // work_accident_report
        /^occupational[_\s]?injury$/i,           // occupational_injury
      ],
      component: WorkplaceInjuryReportDocument
    },

    // ========== RETURN TO WORK PLAN ==========
    {
      name: 'Return to Work Plan',
      patterns: [
        /^return[_\s]?to[_\s]?work[_\s]?plan$/i,    // return_to_work_plan
        /^rtw[_\s]?plan$/i,                          // rtw_plan
        /^return[_\s]?to[_\s]?work$/i,               // return_to_work
        /^work[_\s]?return[_\s]?plan$/i,             // work_return_plan
        /^modified[_\s]?duty[_\s]?plan$/i,           // modified_duty_plan
        /^transitional[_\s]?work[_\s]?plan$/i,       // transitional_work_plan
        /^work[_\s]?reintegration$/i,                // work_reintegration
      ],
      component: ReturnToWorkPlanDocument
    },

    // ========== PAIN MANAGEMENT ==========
    {
      name: 'Pain Management',
      patterns: [
        /^pain[_\s]?management$/i,         // pain_management
        /^pain[_\s]?assessment$/i,         // pain_assessment
        /^pain[_\s]?evaluation$/i,         // pain_evaluation
        /^pain[_\s]?control$/i,            // pain_control
        /^chronic[_\s]?pain/i,             // chronic_pain
        /^acute[_\s]?pain/i,               // acute_pain
        /^pain[_\s]?clinic/i,              // pain_clinic
        /^analgesia/i,                     // analgesia
      ],
      component: PainManagementDocument
    },

    // ========== SOCIAL WORK ==========
    // MUST be BEFORE Social Work Notes - /^social_work/i would match both
    {
      name: 'Social Work',
      patterns: [
        /^social_work$/i,                  // EXACT match: social_work
      ],
      component: SocialWorkDocument
    },

    // ========== GOALS OF CARE DISCUSSION ==========
    {
      name: 'Goals of Care Discussion',
      patterns: [
        /^goals_of_care_discussion$/i,     // EXACT match: goals_of_care_discussion
        /^goals.*care.*discussion/i,       // goals_of_care_discussion variations
        /^goc.*discussion/i,               // goc_discussion (common abbreviation)
      ],
      component: GoalsOfCareDiscussionDocument
    },

    // ========== TREATMENT GOALS (early exact entry, June 2026) ==========
    // The dedicated TreatmentGoalsDocument existed since June 11 but was dead code:
    // a broad treatment-goal pattern in Patient Care Goals (removed) and another in
    // Behavioral Health Goals both fire before the original entry far below. This
    // early EXACT entry wins over all downstream broad patterns.
    {
      name: 'Treatment Goals',
      patterns: [
        /^treatment_goals$/i,                // EXACT match for the treatment_goals collection
      ],
      component: TreatmentGoalsDocument
    },

    // ========== PATIENT CARE GOALS ==========
    // NOTE (June 2026): the broad treatment-goal pattern was removed from this entry —
    // it was stealing treatment_goals from its dedicated Treatment Goals entry further
    // down (that template existed since June 11 but was unreachable dead code).
    {
      name: 'Patient Care Goals',
      patterns: [
        /^patient_care_goals?$/i,            // EXACT match: patient_care_goals
        /^patient.*care.*goal/i,             // patient_care_goals variations
        /^care.*goal/i,                      // care_goals
        /^patient.*goal/i,                   // patient_goals
      ],
      component: PatientCareGoalsDocument
    },

    // ========== SOCIAL WORK NOTES ==========
    {
      name: 'Social Work Notes',
      patterns: [
        /^social_work_notes?$/i,           // EXACT match: social_work_notes, social_work_note
        /^social.*work.*note/i,            // social_work_notes, social_work_note
        /^social.*work.*assessment/i,      // social_work_assessment
        /^case.*management.*note/i,        // case_management_notes
        /^psychosocial.*note/i,            // psychosocial_notes
        /^sw.*note/i,                      // sw_notes (common abbreviation)
      ],
      component: SocialWorkNotesDocument
    },

    // ========== SOCIAL HISTORY ==========
    {
      name: 'Social History',
      patterns: [
        /^social_history$/i,               // EXACT match: social_history
        /^social.*history/i,               // social_history, social_hx
        /^social.*hx/i,                    // social_hx (common abbreviation)
        // NOTE: social_determinants and sdoh moved to Social Determinants of Health template
      ],
      component: SocialHistoryDocument
    },

    // ========== PROCEDURES INTERVENTIONS ==========
    // MUST be BEFORE Medical Procedures - /^procedure/i would match procedures_interventions
    {
      name: 'Procedures Interventions',
      patterns: [
        /^procedures[_\s]?interventions$/i,  // procedures_interventions (exact match)
        /^procedure[_\s]?intervention$/i,    // procedure_intervention
        /^clinical[_\s]?interventions$/i,    // clinical_interventions
        /^intervention[_\s]?records?$/i,     // intervention_records
      ],
      component: ProceduresInterventionsDocument
    },

    // ========== PRESSURE ULCER RISK ==========
    {
      name: 'Pressure Ulcer Risk',
      patterns: [
        /^pressure_ulcer_risk$/i,                // EXACT: pressure_ulcer_risk (Braden assessment; before broad pressure_ulcer)
      ],
      component: PressureUlcerRiskDocument
    },
    // ========== WOUND CARE ASSESSMENTS ==========
    {
      name: 'Wound Care Assessments',
      patterns: [
        /^wound[_\s]?care[_\s]?assessments?$/i,  // wound_care_assessments (exact match)
        /^wound[_\s]?assessments?$/i,            // wound_assessments
        /^wound[_\s]?care$/i,                    // wound_care
        /^wound[_\s]?management$/i,              // wound_management
        /^diabetic[_\s]?foot[_\s]?ulcer/i,       // diabetic_foot_ulcer
        /^pressure[_\s]?ulcer/i,                 // pressure_ulcer
      ],
      component: WoundCareAssessmentsDocument
    },

    // ========== PHYSICAL THERAPY EVALUATIONS ==========
    {
      name: 'Physical Therapy Evaluations',
      patterns: [
        /^physical[_\s]?therapy[_\s]?evaluations?$/i,  // physical_therapy_evaluations (exact match)
        /^pt[_\s]?evaluations?$/i,                     // pt_evaluations
        /^physical[_\s]?therapy[_\s]?assessments?$/i,  // physical_therapy_assessments
        /^pt[_\s]?assessments?$/i,                     // pt_assessments
        /^physiotherapy[_\s]?evaluations?$/i,          // physiotherapy_evaluations
        /^rehabilitation[_\s]?evaluations?$/i,         // rehabilitation_evaluations
        /^rehab[_\s]?evaluations?$/i,                  // rehab_evaluations
      ],
      component: PhysicalTherapyEvaluationsDocument
    },

    // ========== PHYSICAL THERAPY NOTES ==========
    {
      name: 'Physical Therapy Notes',
      patterns: [
        /^physical[_\s]?therapy[_\s]?notes?$/i,       // physical_therapy_notes (exact match)
        /^pt[_\s]?notes?$/i,                          // pt_notes
        /^physical[_\s]?therapy[_\s]?progress$/i,    // physical_therapy_progress
        /^pt[_\s]?progress[_\s]?notes?$/i,           // pt_progress_notes
        /^physiotherapy[_\s]?notes?$/i,              // physiotherapy_notes
        /^rehab[_\s]?notes?$/i,                      // rehab_notes
      ],
      component: PhysicalTherapyNotesDocument
    },
    {
      name: 'Intake/Output Records',
      patterns: [
        /^intake[_\s]?output[_\s]?records?$/i,       // intake_output_records (exact match)
        /^i[_\s]?o[_\s]?records?$/i,                 // i_o_records, io_records
        /^intake[_\s]?output$/i,                     // intake_output
        /^fluid[_\s]?balance[_\s]?records?$/i,       // fluid_balance_records
        /^fluid[_\s]?balance[_\s]?monitoring$/i,     // fluid_balance_monitoring
        /^i\&o$/i,                                   // I&O
        /^i\/o$/i,                                   // I/O
      ],
      component: IntakeOutputRecordsDocument
    },

    // ========== MEDICATION ADMINISTRATION RECORDS ==========
    {
      name: 'Medication Administration Records',
      patterns: [
        /^medication[_\s]?administration[_\s]?records?$/i,  // medication_administration_records (exact match)
        /^med[_\s]?admin[_\s]?records?$/i,                  // med_admin_records
        /^MAR$/i,                                           // MAR (common abbreviation)
        /^medication[_\s]?administration$/i,                // medication_administration
        /^med[_\s]?administration$/i,                       // med_administration
      ],
      component: MedicationAdministrationRecordsDocument
    },

    // ========== SCHEDULED MEDICATIONS ==========
    {
      name: 'Scheduled Medications',
      patterns: [
        /^scheduled_medications$/i,            // scheduled_medications (exact match)
        /^scheduled.*medication/i,             // scheduled_medication, scheduled_medications_list
      ],
      component: ScheduledMedicationsDocument
    },

    // ========== NURSING ASSESSMENTS ==========
    {
      name: 'Nursing Assessments',
      patterns: [
        /^nursing[_\s]?assessments?$/i,          // nursing_assessments, nursing_assessment
        /^nursing[_\s]?eval(?:uation)?s?$/i,     // nursing_evaluations, nursing_evals
        /^nurse[_\s]?assessments?$/i,            // nurse_assessment
        /^RN[_\s]?assessments?$/i,               // RN_assessments
      ],
      component: NursingAssessmentsDocument
    },

    // ========== WOUND CARE DOCUMENTATION ==========
    {
      name: 'Wound Care Documentation',
      patterns: [
        /^wound[_\s]?care[_\s]?documentation$/i,  // wound_care_documentation
        /^wound[_\s]?care[_\s]?doc(?:ument)?s?$/i, // wound_care_docs
        /^wound[_\s]?documentation$/i,            // wound_documentation
      ],
      component: WoundCareDocumentationDocument
    },

    // ========== WOUND CARE NOTES ==========
    {
      name: 'Wound Care Notes',
      patterns: [
        /^wound[_\s]?care[_\s]?notes?$/i,         // wound_care_notes
        /^wound[_\s]?notes?$/i,                   // wound_notes
        /^wound[_\s]?care[_\s]?records?$/i,       // wound_care_records
      ],
      component: WoundCareNotesDocument
    },

    // ========== EMERGENCY INFORMATION ==========
    {
      name: 'Emergency Information',
      patterns: [
        /^emergency[_\s]?information$/i,          // emergency_information
        /^emergency[_\s]?info$/i,                 // emergency_info
        /^emergency[_\s]?data$/i,                 // emergency_data
      ],
      component: EmergencyInformationDocument
    },

    // ========== EMERGENCY DISCHARGE SUMMARIES ==========
    {
      name: 'Emergency Discharge Summaries',
      patterns: [
        /^emergency[_\s]?discharge[_\s]?summar/i,  // emergency_discharge_summaries, emergency_discharge_summary
        /^ed[_\s]?discharge[_\s]?summar/i,         // ed_discharge_summaries, ed_discharge_summary
      ],
      component: EmergencyDischargeSummariesDocument
    },
    {
      name: 'Emergency Reports',
      patterns: [
        /^emergency[_\s]?report/i,  // emergency_reports, emergency_report
        /^er[_\s]?report/i,         // er_reports, er_report
      ],
      component: EmergencyReportsDocument
    },
    {
      name: 'Emergency Assessment',
      patterns: [
        /^emergency[_\s]?assessment/i,  // emergency_assessment, emergency assessment
        /^er[_\s]?assessment/i,         // er_assessment, er assessment
        /^ed[_\s]?assessment/i,         // ed_assessment, ed assessment
      ],
      component: EmergencyAssessmentDocument
    },

    // ========== ADMISSION RECOMMENDATIONS ==========
    {
      name: 'Admission Recommendations',
      patterns: [
        /^admission[_\s]?recommendation/i,  // admission_recommendations, admission_recommendation
        /^admit[_\s]?recommendation/i,      // admit_recommendations
      ],
      component: AdmissionRecommendationsDocument
    },

    // ========== ED TRIAGE ASSESSMENT ==========
    {
      name: 'ED Triage Assessment',
      patterns: [
        /^ed[_\s]?triage[_\s]?assessment/i,  // ed_triage_assessment
      ],
      component: EdTriageAssessmentDocument
    },

    // ========== EMERGENCY OBSERVATION UNIT ==========
    {
      name: 'Emergency Observation Unit',
      patterns: [
        /^emergency[_\s]?observation[_\s]?unit$/i,  // emergency_observation_unit
      ],
      component: EmergencyObservationUnitDocument
    },

    // ========== TRIAGE DATA ==========
    {
      name: 'Triage Data',
      patterns: [
        /^triage[_\s]?data$/i,       // triage_data
        /^triage[_\s]?record/i,      // triage_records
        /^ed[_\s]?triage$/i,         // ed_triage (exact match, not ed_triage_assessment)
      ],
      component: TriageDataDocument
    },

    // ========== TRAVEL MEDICINE ASSESSMENT (anchored BEFORE Tropical Disease — was stolen by its travel_medicine pattern) ==========
    {
      name: 'Travel Medicine Assessment',
      patterns: [
        /^travel_medicine_assessment$/i,                   // EXACT: travel_medicine_assessment
      ],
      component: TravelMedicineAssessmentDocument
    },

    // ========== TRAVEL HEALTH CERTIFICATES ==========
    {
      name: 'Travel Health Certificates',
      patterns: [
        /^travel_health_certificates$/i,                   // EXACT: travel_health_certificates
      ],
      component: TravelHealthCertificatesDocument
    },

    // ========== POLYCYSTIC KIDNEY DISEASE ==========
    {
      name: 'Polycystic Kidney Disease',
      patterns: [
        /^polycystic_kidney_disease$/i,                    // EXACT: polycystic_kidney_disease
      ],
      component: PolycysticKidneyDiseaseDocument
    },

    // ========== HEALTH COACHING NOTES ==========
    {
      name: 'Health Coaching Notes',
      patterns: [
        /^health_coaching_notes$/i,                        // EXACT: health_coaching_notes
      ],
      component: HealthCoachingNotesDocument
    },

    // ========== TROPICAL DISEASE ASSESSMENT ==========
    {
      name: 'Tropical Disease Assessment',
      patterns: [
        /^tropical[_\s]?disease[_\s]?assessment$/i,       // EXACT: tropical_disease_assessment
        /^tropical[_\s]?disease/i,                         // tropical_disease
        /^tropical[_\s]?medicine/i,                        // tropical_medicine
        /^imported[_\s]?disease/i,                         // imported_disease
      ],
      component: TropicalDiseaseAssessmentDocument
    },

    // ========== TUBE FEEDING ORDER ==========
    {
      name: 'Tube Feeding Order',
      patterns: [
        /^tube[_\s]?feeding[_\s]?order$/i,                 // EXACT: tube_feeding_order
        /^tube[_\s]?feeding/i,                             // tube_feeding, tube_feeding_orders
        /^enteral[_\s]?feeding[_\s]?order/i,               // enteral_feeding_order
        /^enteral[_\s]?nutrition[_\s]?order/i,             // enteral_nutrition_order
        /^feeding[_\s]?tube[_\s]?order/i,                  // feeding_tube_order
        /^nasogastric[_\s]?feeding/i,                      // nasogastric_feeding
        /^nasojejunal[_\s]?feeding/i,                      // nasojejunal_feeding
        /^peg[_\s]?feeding/i,                              // peg_feeding
        /^gastrostomy[_\s]?feeding/i,                      // gastrostomy_feeding
      ],
      component: TubeFeedingOrderDocument
    },

    // ========== ED COURSE ==========
    {
      name: 'ED Course',
      patterns: [
        /^ed[_\s]?course$/i,              // ed_course
        /^emergency[_\s]?department[_\s]?course$/i,  // emergency_department_course
        /^ed[_\s]?timeline$/i,            // ed_timeline
        /^emergency[_\s]?course$/i,       // emergency_course
      ],
      component: EdCourseDocument
    },

    // ========== ED DISPOSITION ==========
    {
      name: 'ED Disposition',
      patterns: [
        /^ed[_\s]?disposition$/i,              // ed_disposition
        /^emergency[_\s]?department[_\s]?disposition$/i,  // emergency_department_disposition
        /^ed[_\s]?discharge$/i,                // ed_discharge
        /^emergency[_\s]?disposition$/i,       // emergency_disposition
      ],
      component: EdDispositionDocument
    },

    // ========== DISCHARGE PLANNING ==========
    {
      name: 'Discharge Planning',
      patterns: [
        /^discharge[_\s]?planning$/i,      // discharge_planning
        /^discharge[_\s]?plan$/i,          // discharge_plan
        /^discharge[_\s]?plans$/i,         // discharge_plans
      ],
      component: DischargePlanningDocument
    },

    // ========== REHABILITATION PROTOCOL ==========
    {
      name: 'Rehabilitation Protocol',
      patterns: [
        /^rehabilitation[_\s]?protocol$/i,      // rehabilitation_protocol
        /^rehab[_\s]?protocol$/i,               // rehab_protocol
        /^rehabilitation[_\s]?protocols$/i,     // rehabilitation_protocols
        /^pt[_\s]?protocol$/i,                  // pt_protocol (physical therapy)
        /^ot[_\s]?protocol$/i,                  // ot_protocol (occupational therapy)
      ],
      component: RehabilitationProtocolDocument
    },

    // ========== RETURN TO SPORT ==========
    {
      name: 'Return to Sport',
      patterns: [
        /^return_to_sport$/i,                     // EXACT: return_to_sport
        /^return[_\s]?to[_\s]?sport$/i,           // return_to_sport, return to sport
        /^sports?[_\s]?clearance$/i,              // sport_clearance, sports_clearance
        /^rts$/i,                                 // RTS (Return to Sport acronym)
        /^return[_\s]?to[_\s]?play$/i,            // return_to_play
        /^athletic[_\s]?clearance$/i,             // athletic_clearance
      ],
      component: ReturnToSportDocument
    },

    // ========== ATHLETE SPECIFIC DATA ==========
    {
      name: 'Athlete Specific Data',
      patterns: [
        /^athlete_specific_data$/i,               // EXACT: athlete_specific_data
        /^athlete[_\s]?specific[_\s]?data$/i,     // athlete_specific_data, athlete specific data
        /^athlete[_\s]?data$/i,                   // athlete_data
        /^sports?[_\s]?athlete[_\s]?data$/i,      // sports_athlete_data
        /^professional[_\s]?athlete[_\s]?data$/i, // professional_athlete_data
      ],
      component: AthleteSpecificDataDocument
    },
    {
      name: 'Respiratory Devices',
      patterns: [
        /^respiratory[_\s]?devices?$/i,         // respiratory_devices, respiratory_device
        /^respiratory[_\s]?equipment$/i,        // respiratory_equipment
        /^ventilator[_\s]?records?$/i,          // ventilator_records
        /^cpap[_\s]?bipap$/i,                   // cpap_bipap
      ],
      component: RespiratoryDevicesDocument
    },
    // ========== CPAP MANAGEMENT ==========
    {
      name: 'CPAP Management',
      patterns: [
        /^cpap_management$/i,                   // EXACT match
        /^cpap[_\s]?management$/i,              // cpap management (exact end)
      ],
      component: CpapManagementDocument
    },
    {
      name: 'CPAP/BiPAP Management',
      patterns: [
        /^cpap_bipap_management$/i,             // EXACT match
        /^cpap[_\s]?bipap[_\s]?management/i,   // cpap_bipap_management
        /^cpap[_\s]?bipap[_\s]?therapy/i,       // cpap_bipap_therapy
        /^bipap[_\s]?management/i,              // bipap_management
        /^pap[_\s]?therapy/i,                   // pap_therapy
      ],
      component: CpapBipapManagementDocument
    },
    {
      name: 'Ventilator Settings',
      patterns: [
        /^ventilator[_\s]?settings?$/i,         // ventilator_settings
        /^vent[_\s]?settings?$/i,               // vent_settings
        /^mechanical[_\s]?ventilation$/i,       // mechanical_ventilation
      ],
      component: VentilatorSettingsDocument
    },
    {
      name: 'Ventilator Weaning Protocol',
      patterns: [
        /^ventilator_weaning_protocol$/i,       // EXACT: ventilator_weaning_protocol
      ],
      component: VentilatorWeaningProtocolDocument
    },

    // ========== HOSPITAL ADMISSION NOTES ==========
    {
      name: 'Hospital Admission Notes',
      patterns: [
        /^hospital[_\s]?admission[_\s]?notes?$/i,  // hospital_admission_notes
        /^admission[_\s]?notes?$/i,               // admission_notes
        /^hospital[_\s]?admissions?$/i,           // hospital_admissions
      ],
      component: HospitalAdmissionNotesDocument
    },
    // ========== HOSPITAL TRANSFER NOTES ==========
    {
      name: 'Hospital Transfer Notes',
      patterns: [
        /^hospital_transfer_notes$/i,             // EXACT: hospital_transfer_notes
      ],
      component: HospitalTransferNotesDocument
    },
    // ========== TRANSFER SUMMARIES ==========
    {
      name: 'Transfer Summaries',
      patterns: [
        /^transfer_summaries$/i,                  // EXACT: transfer_summaries
      ],
      component: TransferSummariesDocument
    },
    // ========== ADMISSION ASSESSMENTS ==========
    {
      name: 'Admission Assessments',
      patterns: [
        /^admission_assessments$/i,               // EXACT: admission_assessments
      ],
      component: AdmissionAssessmentsDocument
    },
    // ========== SECOND OPINION REPORTS ==========
    {
      name: 'Second Opinion Reports',
      patterns: [
        /^second_opinion_reports$/i,              // EXACT: second_opinion_reports
      ],
      component: SecondOpinionReportsDocument
    },
    // ========== READMISSION RISK ASSESSMENT ==========
    {
      name: 'Readmission Risk Assessment',
      patterns: [
        /^readmission_risk_assessment$/i,         // EXACT: readmission_risk_assessment
      ],
      component: ReadmissionRiskAssessmentDocument
    },
    // ========== MYOSITIS ASSESSMENT ==========
    {
      name: 'Myositis Assessment',
      patterns: [
        /^myositis_assessment$/i,                 // EXACT: myositis_assessment
      ],
      component: MyositisAssessmentDocument
    },
    // ========== IBD BIOMARKERS ==========
    {
      name: 'IBD Biomarkers',
      patterns: [
        /^ibd_biomarkers$/i,                      // EXACT: ibd_biomarkers
      ],
      component: IbdBiomarkersDocument
    },
    // ========== RESPIRATORY INFECTIONS ==========
    {
      name: 'Respiratory Infections',
      patterns: [
        /^respiratory_infections$/i,              // EXACT: respiratory_infections
      ],
      component: RespiratoryInfectionsDocument
    },

    // ========== CARDIAC CATHETERIZATION REPORTS ==========
    {
      name: 'Cardiac Catheterization Reports',
      patterns: [
        /^cardiac[_\s]?catheterization[_\s]?reports?$/i,  // cardiac_catheterization_reports
        /^cath[_\s]?lab[_\s]?reports?$/i,                 // cath_lab_reports
        /^catheterization[_\s]?reports?$/i,               // catheterization_reports
        /^cardiac[_\s]?cath$/i,                           // cardiac_cath
        /^heart[_\s]?cath/i,                              // heart_cath
      ],
      component: CardiacCatheterizationReportsDocument
    },

    // ========== CARDIAC MONITORING ==========
    {
      name: 'Cardiac Monitoring',
      patterns: [
        /^cardiac[_\s]?monitoring$/i,                     // cardiac_monitoring
        /^cardiac[_\s]?monitor$/i,                        // cardiac_monitor
        /^heart[_\s]?monitoring$/i,                       // heart_monitoring
        /^telemetry[_\s]?monitoring$/i,                   // telemetry_monitoring
        /^troponin[_\s]?trending$/i,                      // troponin_trending
        /^ecg[_\s]?monitoring$/i,                         // ecg_monitoring
        /^rhythm[_\s]?monitoring$/i,                      // rhythm_monitoring
      ],
      component: CardiacMonitoringDocument
    },

    // ========== CARDIAC DEVICE INTERROGATIONS ==========
    {
      name: 'Cardiac Device Interrogations',
      patterns: [
        /^cardiac[_\s]?device[_\s]?interrogations?$/i,      // cardiac_device_interrogations
        /^device[_\s]?interrogations?$/i,                   // device_interrogations
        /^pacemaker[_\s]?interrogations?$/i,                // pacemaker_interrogations
        /^pacemaker[_\s]?check$/i,                          // pacemaker_check
        /^icd[_\s]?interrogations?$/i,                      // icd_interrogations
        /^icd[_\s]?check$/i,                                // icd_check
        /^crt[_\s]?interrogations?$/i,                      // crt_interrogations
        /^defibrillator[_\s]?interrogations?$/i,            // defibrillator_interrogations
        /^implantable[_\s]?device[_\s]?interrogations?$/i,  // implantable_device_interrogations
        /^loop[_\s]?recorder[_\s]?interrogations?$/i,       // loop_recorder_interrogations
      ],
      component: CardiacDeviceInterrogationsDocument
    },

    // ========== SPERM ANALYSIS ==========
    {
      name: 'Sperm Analysis',
      patterns: [
        /^sperm_analysis$/i,
      ],
      component: SpermAnalysisDocument
    },

    // ========== INTRAUTERINE INSEMINATION ==========
    {
      name: 'Intrauterine Insemination',
      patterns: [
        /^intrauterine_insemination$/i,
      ],
      component: IntrauterineInseminationDocument
    },

    // ========== SURROGACY EVALUATION ==========
    {
      name: 'Surrogacy Evaluation',
      patterns: [
        /^surrogacy_evaluation$/i,
      ],
      component: SurrogacyEvaluationDocument
    },

    // ========== PROPOSED ART SWITCH ==========
    {
      name: 'Proposed ART Switch',
      patterns: [
        /^proposed[_\s]?art[_\s]?switch$/i,                 // proposed_art_switch
        /^art[_\s]?switch$/i,                               // art_switch
        /^antiretroviral[_\s]?switch$/i,                    // antiretroviral_switch
        /^proposed[_\s]?antiretroviral[_\s]?switch$/i,      // proposed_antiretroviral_switch
        /^art[_\s]?regimen[_\s]?change$/i,                  // art_regimen_change
        /^hiv[_\s]?medication[_\s]?switch$/i,               // hiv_medication_switch
        /^antiretroviral[_\s]?therapy[_\s]?switch$/i,       // antiretroviral_therapy_switch
      ],
      component: ProposedArtSwitchDocument
    },

    // ========== HIV HISTORY ==========
    {
      name: 'HIV History',
      patterns: [
        /^hiv[_\s]?history$/i,                          // hiv_history
        /^hiv[_\s]?medical[_\s]?history$/i,             // hiv_medical_history
        /^hiv[_\s]?patient[_\s]?history$/i,             // hiv_patient_history
        /^hiv[_\s]?diagnosis[_\s]?history$/i,           // hiv_diagnosis_history
        /^hiv[_\s]?treatment[_\s]?history$/i,           // hiv_treatment_history
        /^hiv[_\s]?cd4[_\s]?history$/i,                 // hiv_cd4_history
        /^hiv[_\s]?opportunistic[_\s]?infections$/i,    // hiv_opportunistic_infections
      ],
      component: HivHistoryDocument
    },

    // ========== HIV PREP MANAGEMENT ==========
    {
      name: 'HIV PrEP Management',
      patterns: [
        /^hiv[_\s]?prep[_\s]?management$/i,                  // hiv_prep_management (exact)
        /^prep[_\s]?management$/i,                            // prep_management
        /^hiv[_\s]?prep$/i,                                   // hiv_prep
        /^pre[_\s]?exposure[_\s]?prophylaxis$/i,              // pre_exposure_prophylaxis
        /^prep[_\s]?monitoring$/i,                            // prep_monitoring
        /^prep[_\s]?adherence$/i,                             // prep_adherence
      ],
      component: HivPrepManagementDocument
    },

    // ========== IMMUNE RECONSTITUTION PLANNING ==========
    {
      name: 'Immune Reconstitution Planning',
      patterns: [
        /^immune[_\s]?reconstitution[_\s]?planning$/i,        // immune_reconstitution_planning
        /^immune[_\s]?reconstitution$/i,                      // immune_reconstitution
        /^iris[_\s]?planning$/i,                              // iris_planning
        /^iris[_\s]?monitoring$/i,                            // iris_monitoring
        /^immune[_\s]?recovery[_\s]?planning$/i,              // immune_recovery_planning
        /^hiv[_\s]?immune[_\s]?reconstitution$/i,             // hiv_immune_reconstitution
        /^art[_\s]?immune[_\s]?reconstitution$/i,             // art_immune_reconstitution
      ],
      component: ImmuneReconstitutionPlanningDocument
    },

    // ========== IMMUNE FUNCTION TESTS ==========
    {
      name: 'Immune Function Tests',
      patterns: [
        /^immune_function_tests$/i,                         // EXACT: immune_function_tests
        /^immune[_\s]?function[_\s]?test(s|ing)?$/i,   // immune_function_test, immune_function_testing
        /^immunological[_\s]?function[_\s]?test(s)?$/i, // immunological_function_tests
      ],
      component: ImmuneFunctionTestsDocument
    },

    // ========== PRIMARY PROPHYLAXIS ==========
    {
      name: 'Primary Prophylaxis',
      patterns: [
        /^primary[_\s]?prophylaxis$/i,                    // primary_prophylaxis
        /^primary[_\s]?prevention$/i,                    // primary_prevention
        /^prophylaxis[_\s]?primary$/i,                   // prophylaxis_primary
        /^oi[_\s]?prophylaxis$/i,                        // oi_prophylaxis
        /^opportunistic[_\s]?infection[_\s]?prophylaxis$/i, // opportunistic_infection_prophylaxis
        /^hiv[_\s]?prophylaxis$/i,                       // hiv_prophylaxis
        /^infection[_\s]?prophylaxis$/i,                 // infection_prophylaxis
      ],
      component: PrimaryProphylaxisDocument
    },

    // ========== SECONDARY PROPHYLAXIS ==========
    {
      name: 'Secondary Prophylaxis',
      patterns: [
        /^secondary[_\s]?prophylaxis$/i,                  // secondary_prophylaxis
        /^secondary[_\s]?oi[_\s]?prophylaxis$/i,          // secondary_oi_prophylaxis
        /^maintenance[_\s]?prophylaxis$/i,               // maintenance_prophylaxis
        /^post[_\s]?infection[_\s]?prophylaxis$/i,       // post_infection_prophylaxis
      ],
      component: SecondaryProphylaxisDocument
    },

    // ========== OPPORTUNISTIC INFECTIONS ==========
    {
      name: 'Opportunistic Infections',
      patterns: [
        /^opportunistic[_\s]?infections?$/i,              // opportunistic_infections, opportunistic_infection
        /^oi[_\s]?assessment$/i,                          // oi_assessment
        /^oi[_\s]?documentation$/i,                       // oi_documentation
        /^opportunistic[_\s]?infection[_\s]?assessment$/i, // opportunistic_infection_assessment
        /^hiv[_\s]?opportunistic[_\s]?infections?$/i,     // hiv_opportunistic_infections
        /^aids[_\s]?defining[_\s]?illness/i,              // aids_defining_illness
        /^oi[_\s]?management$/i,                          // oi_management
        /^opportunistic[_\s]?infection[_\s]?treatment$/i, // opportunistic_infection_treatment
      ],
      component: OpportunisticInfectionsDocument
    },

    // ========== CMV MONITORING PLAN ==========
    {
      name: 'CMV Monitoring Plan',
      patterns: [
        /^cmv[_\s]?monitoring[_\s]?plan$/i,              // cmv_monitoring_plan
        /^cmv[_\s]?monitoring$/i,                        // cmv_monitoring
        /^cytomegalovirus[_\s]?monitoring/i,             // cytomegalovirus_monitoring
        /^cmv[_\s]?surveillance$/i,                      // cmv_surveillance
        /^cmv[_\s]?viral[_\s]?load[_\s]?monitoring$/i,   // cmv_viral_load_monitoring
      ],
      component: CmvMonitoringPlanDocument
    },

    // ========== CARDIAC REHABILITATION REPORTS ==========
    {
      name: 'Cardiac Rehabilitation Reports',
      patterns: [
        /^cardiac[_\s]?rehabilitation[_\s]?reports?$/i,  // cardiac_rehabilitation_reports
        /^cardiac[_\s]?rehab[_\s]?reports?$/i,          // cardiac_rehab_reports
        /^rehabilitation[_\s]?reports?$/i,              // rehabilitation_reports
        /^rehab[_\s]?reports?$/i,                       // rehab_reports
        /^cardiac[_\s]?rehabilitation$/i,               // cardiac_rehabilitation
        /^cardiac[_\s]?rehab$/i,                        // cardiac_rehab
        /^phase[_\s]?(?:ii?|2)[_\s]?cardiac[_\s]?rehab/i, // phase_ii_cardiac_rehab
        /^exercise[_\s]?rehabilitation$/i,              // exercise_rehabilitation
      ],
      component: CardiacRehabilitationReportsDocument
    },

    // ========== IMMEDIATE INTERVENTIONS ==========
    {
      name: 'Immediate Interventions',
      patterns: [
        /^immediate[_\s]?interventions?$/i,               // immediate_interventions, immediate_intervention
        /^immediate[_\s]?management$/i,                   // immediate_management
        /^emergency[_\s]?interventions?$/i,               // emergency_intervention(s)
        /^acute[_\s]?management$/i,                       // acute_management
        /^critical[_\s]?interventions?$/i,                // critical_intervention(s)
        /^urgent[_\s]?interventions?$/i,                  // urgent_intervention(s)
        /^acs[_\s]?management$/i,                         // acs_management
        /^nstemi[_\s]?management$/i,                      // nstemi_management
        /^stemi[_\s]?management$/i,                       // stemi_management
      ],
      component: ImmediateInterventionsDocument
    },

    // ========== IMMEDIATE RECOMMENDATIONS ==========
    {
      name: 'Immediate Recommendations',
      patterns: [
        /^immediate_recommendations$/i,                   // EXACT match (no theft: Immediate Interventions above only matches interventions and management; generic Recommendations entry requires a medical, clinical, treatment, or therapy prefix)
      ],
      component: ImmediateRecommendationsDocument
    },

    // ========== CARDIOLOGY ASSESSMENT ==========
    {
      name: 'Cardiology Assessment',
      patterns: [
        /^cardiology[_\s]?assessment$/i,                  // cardiology_assessment
        /^cardiac[_\s]?assessment$/i,                     // cardiac_assessment
        /^cardiology[_\s]?evaluation$/i,                  // cardiology_evaluation
        /^cardiac[_\s]?evaluation$/i,                     // cardiac_evaluation
        /^cardiology[_\s]?workup$/i,                      // cardiology_workup
      ],
      component: CardiologyAssessmentDocument
    },

    // ========== MEDICAL PROCEDURES ==========
    {
      name: 'Medical Procedures',
      patterns: [
        /^medical.*procedure/i,            // medical_procedures
        /^procedure/i,                     // procedures, procedure
        /^surgical.*procedure/i,           // surgical_procedures
        /^treatment.*procedure/i,          // treatment_procedures
      ],
      component: MedicalProceduresDocument
    },

    // ========== TREATMENT COURSES ==========
    {
      name: 'Treatment Courses',
      patterns: [
        /^treatment.*course/i,             // treatment_courses, treatment_course
        /^therapy.*course/i,               // therapy_courses
        /^treatment.*regimen/i,            // treatment_regimen
        /^therapeutic.*regimen/i,          // therapeutic_regimen
      ],
      component: TreatmentCoursesDocument
    },

    // ========== SMOKING CESSATION PROGRAM ==========
    {
      name: 'Smoking Cessation Program',
      patterns: [
        /^smoking.*cessation.*program/i,   // smoking_cessation_program
        /^smoking.*cessation/i,            // smoking_cessation
        /^quit.*smoking.*program/i,        // quit_smoking_program
        /^tobacco.*cessation/i,            // tobacco_cessation
        /^nicotine.*cessation/i,           // nicotine_cessation
      ],
      component: SmokingCessationProgramDocument
    },

    // ========== DIABETES MANAGEMENT ==========
    {
      name: 'Diabetes Management',
      patterns: [
        /^diabetes_management$/i,           // EXACT match - diabetes_management
        /^diabetes.*management$/i,          // diabetes management (no notes)
      ],
      component: DiabetesManagementDocument
    },

    // ========== ENDOCRINOLOGY ASSESSMENT ==========
    {
      name: 'Endocrinology Assessment',
      patterns: [
        /^endocrinology_assessment$/i,      // EXACT match
        /^endocrin.*assessment/i,           // endocrine/endocrinology assessment
      ],
      component: EndocrinologyAssessmentDocument
    },

    // ========== ENDOCRINOLOGY CONSULTATIONS ==========
    {
      name: 'Endocrinology Consultations',
      patterns: [
        /^endocrinology_consultations$/i,   // EXACT match
        /^endocrinology.*consultation/i,    // endocrinology consultations
        /^endocrine.*consultation/i,        // endocrine consultations
      ],
      component: EndocrinologyConsultationsDocument
    },

    // ========== ERGONOMIC ASSESSMENT ==========
    {
      name: 'Ergonomic Assessment',
      patterns: [
        /^ergonomic_assessment$/i,           // EXACT match
        /^ergonomic.*assessment/i,           // ergonomic assessment
        /^workplace.*ergonomic/i,            // workplace ergonomic
      ],
      component: ErgonomicAssessmentDocument
    },

    // ========== ENT CONSULTATIONS ==========
    {
      name: 'ENT Consultations',
      patterns: [
        /^ent_consultations$/i,             // EXACT match
        /^ent.*consultation/i,              // ent consultations
        /^otolaryngology.*consultation/i,   // otolaryngology consultations
        /^ear.*nose.*throat/i,              // ear nose throat
      ],
      component: EntConsultationsDocument
    },

    // ========== ENT ASSESSMENT ==========
    {
      name: 'ENT Assessment',
      patterns: [
        /^ent_assessment$/i,                // EXACT match: ent_assessment
        /^ent[_\s].*assessment/i,           // ent assessment, ent assessments (separator required so it does NOT steal enteral_feeding_assessment)
        /^otolaryngology.*assessment/i,     // otolaryngology assessment
        /^ear.*nose.*throat.*assessment/i,  // ear nose throat assessment
      ],
      component: EntAssessmentDocument
    },

    // ========== AUDIOMETRY REPORTS ==========
    {
      name: 'Audiometry Reports',
      patterns: [
        /^audiometry_reports$/i,              // EXACT match
        /^audiometry.*report/i,               // audiometry reports
        /^hearing.*test/i,                    // hearing tests
        /^hearing.*assessment/i,              // hearing assessments
        /^audiological.*evaluation/i,         // audiological evaluations
      ],
      component: AudiometryReportsDocument
    },

    // ========== LARYNGOSCOPY REPORTS ==========
    {
      name: 'Laryngoscopy Reports',
      patterns: [
        /^laryngoscopy_reports$/i,            // EXACT match
        /^laryngoscopy.*report/i,             // laryngoscopy reports
        /^laryngoscopy.*exam/i,               // laryngoscopy exams
        /^nasopharyngolaryngoscopy/i,         // nasopharyngolaryngoscopy
        /^flexible.*laryngoscopy/i,           // flexible laryngoscopy
        /^direct.*laryngoscopy/i,             // direct laryngoscopy
        /^indirect.*laryngoscopy/i,           // indirect laryngoscopy
        /^video.*laryngoscopy/i,              // video laryngoscopy
        /^scope.*report/i,                    // scope reports
      ],
      component: LaryngoscopyReportsDocument
    },

    // ========== INSOMNIA ASSESSMENT ==========
    {
      name: 'Insomnia Assessment',
      patterns: [
        /^insomnia_assessment$/i,             // EXACT match
      ],
      component: InsomniaAssessmentDocument
    },

    // ========== NARCOLEPSY ASSESSMENT ==========
    {
      name: 'Narcolepsy Assessment',
      patterns: [
        /^narcolepsy_assessment$/i,           // EXACT match
      ],
      component: NarcolepsyAssessmentDocument
    },

    // ========== SLEEP DISORDER ASSESSMENT ==========
    {
      name: 'Sleep Disorder Assessment',
      patterns: [
        /^sleep_disorder_assessment$/i,       // EXACT match
        /^sleep.*disorder/i,                  // sleep disorder
        // NOTE: Removed /^sleep.*study/i - was incorrectly matching sleep_study_reports
        // NOTE: Removed /^sleep.*assessment/i - too generic, matches sleep_study_reports
      ],
      component: SleepDisorderAssessmentDocument
    },

    // ========== SLEEP APNEA MANAGEMENT ==========
    {
      name: 'Sleep Apnea Management',
      patterns: [
        /^sleep_apnea_management$/i,          // EXACT match
        /^sleep.*apnea.*management/i,         // sleep apnea management
        /^apnea.*management/i,                // apnea management
        /^cpap.*management/i,                 // CPAP management
        /^cpap.*therapy/i,                    // CPAP therapy
        /^osa.*management/i,                  // OSA management
        /^obstructive.*sleep.*apnea/i,        // obstructive sleep apnea
      ],
      component: SleepApneaManagementDocument
    },

    // ========== SLEEP HYGIENE EDUCATION ==========
    {
      name: 'Sleep Hygiene Education',
      patterns: [
        /^sleep_hygiene_education$/i,         // EXACT match
        /^sleep.*hygiene.*education/i,        // sleep hygiene education
        /^sleep.*hygiene/i,                   // sleep hygiene
      ],
      component: SleepHygieneEducationDocument
    },

    // ========== DAYTIME SLEEPINESS ASSESSMENT ==========
    {
      name: 'Daytime Sleepiness Assessment',
      patterns: [
        /^daytime_sleepiness_assessment$/i,   // EXACT match
        /^daytime.*sleepiness/i,              // daytime sleepiness
        /^excessive.*sleepiness/i,            // excessive sleepiness
        /^epworth.*sleepiness/i,              // epworth sleepiness
      ],
      component: DaytimeSleepinessAssessmentDocument
    },

    // ========== THYROID EVALUATIONS ==========
    {
      name: 'Thyroid Evaluations',
      patterns: [
        /^thyroid_evaluations$/i,           // EXACT match
        /^thyroid.*evaluation/i,            // thyroid evaluations
        /^thyroid.*assessment/i,            // thyroid assessments
        /^thyroid.*function/i,              // thyroid function
      ],
      component: ThyroidEvaluationsDocument
    },

    // ========== PUMP ADVANCED SETTINGS (must precede the Insulin Pump Settings broad pump-settings pattern) ==========
    {
      name: 'Pump Advanced Settings',
      patterns: [
        /^pump_advanced_settings$/i,
      ],
      component: PumpAdvancedSettingsDocument
    },

    // ========== DIABETES MANAGEMENT PLAN ==========
    {
      name: 'Diabetes Management Plan',
      patterns: [
        /^diabetes_management_plan$/i,
      ],
      component: DiabetesManagementPlanDocument
    },

    // ========== INSULIN PUMP SETTINGS ==========
    {
      name: 'Insulin Pump Settings',
      patterns: [
        /^insulin_pump_settings$/i,         // EXACT match
        /^insulin.*pump/i,                  // insulin pump
        /^pump.*settings/i,                 // pump settings
        /^insulin.*settings/i,              // insulin settings
      ],
      component: InsulinPumpSettingsDocument
    },

    // ========== CGM DATA ==========
    {
      name: 'CGM Data',
      patterns: [
        /^cgm_data$/i,                      // EXACT match
        /^cgm.*data/i,                      // cgm data
        /^continuous.*glucose.*monitor/i,   // continuous glucose monitoring
        /^continuous.*glucose.*data/i,      // continuous glucose data
        /^glucose.*monitor.*data/i,         // glucose monitor data
      ],
      component: CgmDataDocument
    },

    // ========== INSULIN REGIMEN ==========
    {
      name: 'Insulin Regimen',
      patterns: [
        /^insulin_regimen$/i,                // EXACT match
        /^insulin.*regimen/i,                // insulin regimen
        /^insulin.*therapy/i,                // insulin therapy
        /^insulin.*dosing/i,                 // insulin dosing
        /^basal.*bolus/i,                    // basal bolus
        /^insulin.*pump.*regimen/i,          // insulin pump regimen
        /^mdi.*regimen/i,                    // mdi regimen
      ],
      component: InsulinRegimenDocument
    },

    // ========== INSULIN ADJUSTMENT PROTOCOL ==========
    {
      name: 'Insulin Adjustment Protocol',
      patterns: [
        /^insulin_adjustment_protocol$/i,    // EXACT match
        /^insulin.*adjustment.*protocol/i,   // insulin adjustment protocol
        /^insulin.*adjustment/i,             // insulin adjustment
      ],
      component: InsulinAdjustmentProtocolDocument
    },

    // ========== INSULIN TIMING INSTRUCTIONS ==========
    {
      name: 'Insulin Timing Instructions',
      patterns: [
        /^insulin_timing_instructions$/i,    // EXACT match
        /^insulin.*timing.*instructions/i,   // insulin timing instructions
        /^insulin.*timing/i,                 // insulin timing
      ],
      component: InsulinTimingInstructionsDocument
    },

    // ========== INSULIN STORAGE INSTRUCTIONS ==========
    {
      name: 'Insulin Storage Instructions',
      patterns: [
        /^insulin_storage_instructions$/i,    // EXACT match
        /^insulin.*storage.*instructions/i,   // insulin storage instructions
        /^insulin.*storage/i,                 // insulin storage
      ],
      component: InsulinStorageInstructionsDocument
    },

    // ========== GLUCOSE MONITORING FREQUENCY ==========
    {
      name: 'Glucose Monitoring Frequency',
      patterns: [
        /^glucose_monitoring_frequency$/i,    // EXACT match
        /^glucose.*monitoring.*frequency/i,   // glucose monitoring frequency
      ],
      component: GlucoseMonitoringFrequencyDocument
    },

    // ========== KETONE MONITORING INSTRUCTIONS ==========
    {
      name: 'Ketone Monitoring Instructions',
      patterns: [
        /^ketone_monitoring_instructions$/i,    // EXACT match
        /^ketone.*monitoring.*instructions/i,   // ketone monitoring instructions
        /^ketone.*monitoring/i,                 // ketone monitoring
      ],
      component: KetoneMonitoringInstructionsDocument
    },

    // ========== CARBOHYDRATE COUNTING EDUCATION ==========
    {
      name: 'Carbohydrate Counting Education',
      patterns: [
        /^carbohydrate_counting_education$/i,
        /^carbohydrate.*counting.*education/i,
        /^carb.*counting/i,
      ],
      component: CarbohydrateCountingEducationDocument
    },

    // ========== PARTNER INVOLVEMENT DIABETES MANAGEMENT ==========
    {
      name: 'Partner Involvement Diabetes Management',
      patterns: [
        /^partner_involvement_diabetes_management$/i,
        /^partner.*involvement.*diabetes/i,
        /^partner.*diabetes.*management/i,
      ],
      component: PartnerInvolvementDiabetesManagementDocument
    },

    // ========== EXCESSIVE GLUCOSE MONITORING ==========
    {
      name: 'Excessive Glucose Monitoring',
      patterns: [
        /^excessive_glucose_monitoring$/i,
        /^excessive.*glucose.*monitoring/i,
        /^excessive.*monitoring/i,
      ],
      component: ExcessiveGlucoseMonitoringDocument
    },

    // ========== DIABETES EDUCATION ==========
    {
      name: 'Diabetes Education',
      patterns: [
        /^diabetes_education$/i,             // EXACT match
        /^diabetes.*education/i,             // diabetes_education
        /^diabetic.*education/i,             // diabetic_education
        /^diabetes.*self.*management/i,      // diabetes self management
        /^dsme/i,                            // dsme (diabetes self-management education)
        /^diabetes.*teaching/i,              // diabetes teaching
      ],
      component: DiabetesEducationDocument
    },

    // ========== DIABETES EDUCATOR ==========
    {
      name: 'Diabetes Educator',
      patterns: [
        /^diabetes[_\s]?educator$/i,           // EXACT match: diabetes_educator
      ],
      component: DiabetesEducatorDocument
    },

    // ========== DEVELOPMENTAL MILESTONES ==========
    {
      name: 'Developmental Milestones',
      patterns: [
        /^developmental_milestones$/i,            // EXACT match - takes precedence
        /^milestones$/i,                          // milestones
      ],
      component: DevelopmentalMilestonesDocument
    },

    // ========== DEVELOPMENTAL ASSESSMENTS ==========
    {
      name: 'Developmental Assessments',
      patterns: [
        /^developmental_assessments$/i,           // EXACT match
        /^developmental.*assessment/i,            // developmental_assessment, developmental_assessments
        /^developmental.*screening/i,             // developmental_screening
        /^child.*development.*assessment/i,       // child_development_assessment
        /^pediatric.*development/i,               // pediatric_development
        /^milestone.*assessment/i,                // milestone_assessment
      ],
      component: DevelopmentalAssessmentsDocument
    },

    // ========== EARLY CHILDHOOD DEVELOPMENT ==========
    {
      name: 'Early Childhood Development',
      patterns: [
        /^early_childhood_development$/i,           // EXACT match
        /^early.*childhood.*development/i,           // early_childhood_development variants
        /^childhood.*development/i,                  // childhood_development
        /^early.*child.*dev/i,                       // early_child_dev
      ],
      component: EarlyChildhoodDevelopmentDocument
    },

    // ========== PEDIATRIC GROWTH CHARTS ==========
    {
      name: 'Pediatric Growth Charts',
      patterns: [
        /^pediatric_growth_charts$/i,              // EXACT match
        /^pediatric.*growth/i,                     // pediatric_growth
        /^growth.*chart/i,                         // growth_charts
        /^child.*growth/i,                         // child_growth
        /^growth.*measurement/i,                   // growth_measurements
      ],
      component: PediatricGrowthChartsDocument
    },

    // ========== GROWTH PARAMETERS (December 2025) ==========
    {
      name: 'Growth Parameters',
      patterns: [
        /^growth_parameters$/i,                    // EXACT match
        /^growth.*parameter/i,                     // growth_parameter
      ],
      component: GrowthParametersDocument
    },

    // ========== GROWTH ULTRASOUND SCHEDULE (March 2026) ==========
    {
      name: 'Growth Ultrasound Schedule',
      patterns: [
        /^growth_ultrasound_schedule$/i,           // EXACT match
        /^growth.*ultrasound/i,                    // growth ultrasound
        /^fetal.*growth.*scan/i,                   // fetal growth scan
        /^ultrasound.*schedule/i,                  // ultrasound schedule
      ],
      component: GrowthUltrasoundScheduleDocument
    },

    // ========== PEDIATRIC SCREENING (December 2025) ==========
    {
      name: 'Pediatric Screening',
      patterns: [
        /^pediatric_screening$/i,                  // EXACT match
        /^pediatric.*screen/i,                     // pediatric_screenings
        /^child.*screen/i,                         // child_screening
        /^well.*child.*screen/i,                   // well_child_screening
      ],
      component: PediatricScreeningDocument
    },

    // ========== PEDIATRIC VACCINATION RECORDS ==========
    {
      name: 'Pediatric Vaccination Records',
      patterns: [
        /^pediatric_vaccination_records$/i,          // EXACT match
        /^pediatric.*vaccination/i,                  // pediatric_vaccination
        /^vaccination.*record/i,                     // vaccination_records
        /^child.*vaccination/i,                      // child_vaccination
        /^immunization.*record/i,                    // immunization_records
      ],
      component: PediatricVaccinationRecordsDocument
    },

    // ========== WELL CHILD EXAMINATIONS ==========
    // NOTE: Must come BEFORE pediatric_visits which has /^well.*child/i pattern
    {
      name: 'Well Child Examinations',
      patterns: [
        /^well_child_examinations$/i,              // EXACT match - highest priority
        /^well_child_exam/i,                       // well_child_exam
        /^well.*child.*examination/i,              // well child examination
      ],
      component: WellChildExaminationsDocument
    },

    // ========== WELL CHILD SUMMARY ==========
    {
      name: 'Well Child Summary',
      patterns: [
        /^well_child_summary$/i,                   // EXACT match
        /^well.*child.*summary/i,                  // well child summary
      ],
      component: WellChildSummaryDocument
    },

    // ========== PEDIATRIC VISITS ==========
    {
      name: 'Pediatric Visits',
      patterns: [
        /^pediatric_visits$/i,                     // EXACT match
        /^pediatric.*visit/i,                      // pediatric_visit
        /^well.*child.*visit/i,                    // well_child_visit (more specific than well.*child)
        /^child.*visit/i,                          // child_visit
        /^pediatric.*checkup/i,                    // pediatric_checkup
        /^wellness.*visit/i,                       // wellness_visit
      ],
      component: PediatricVisitsDocument
    },

    // ========== HYPOGLYCEMIA MANAGEMENT ==========
    {
      name: 'Hypoglycemia Management',
      patterns: [
        /^hypoglycemia_management$/i,        // EXACT match
        /^hypoglycemia.*management/i,        // hypoglycemia management
        /^hypo.*management/i,                // hypo management
        /^low.*blood.*sugar.*management/i,   // low blood sugar management
        /^hypoglycemia.*protocol/i,          // hypoglycemia protocol
        /^hypoglycemic.*episode/i,           // hypoglycemic episode
      ],
      component: HypoglycemiaManagementDocument
    },

    // ========== PRECONCEPTION COUNSELING ==========
    {
      name: 'Preconception Counseling',
      patterns: [
        /^preconception_counseling$/i,        // EXACT match
        /^preconception.*counseling/i,        // preconception counseling
        /^pre.*conception.*counseling/i,      // pre-conception counseling
        /^pregnancy.*planning/i,              // pregnancy planning
        /^fertility.*counseling/i,            // fertility counseling
        /^prepregnancy.*care/i,               // prepregnancy care
      ],
      component: PreconceptionCounselingDocument
    },

    // ========== DIABETES QUALITY METRICS ==========
    {
      name: 'Diabetes Quality Metrics',
      patterns: [
        /^diabetes_quality_metrics$/i,        // EXACT match
        /^diabetes.*quality.*metric/i,        // diabetes quality metrics
        /^diabetic.*quality/i,                // diabetic quality
        /^dm.*quality/i,                      // dm quality
        /^quality.*metric.*diabetes/i,        // quality metrics diabetes
        /^a1c.*quality/i,                     // a1c quality
        /^hba1c.*metric/i,                    // hba1c metrics
      ],
      component: DiabetesQualityMetricsDocument
    },

    // ========== PUMP DOWNLOAD ANALYSIS ==========
    {
      name: 'Pump Download Analysis',
      patterns: [
        /^pump_download_analysis$/i,          // EXACT match
        /^pump.*download.*analysis/i,         // pump download analysis
        /^pump.*download/i,                   // pump download
        /^insulin.*pump.*analysis/i,          // insulin pump analysis
        /^pump.*data.*analysis/i,             // pump data analysis
        /^tandem.*download/i,                 // tandem download
        /^control.*iq.*analysis/i,            // control-iq analysis
      ],
      component: PumpDownloadAnalysisDocument
    },

    // ========== PODIATRY EXAMINATIONS ==========  (distinct deep-nested podiatry exam; placed before Foot Exam)
    {
      name: 'Podiatry Examinations',
      patterns: [
        /^podiatry_examinations$/i,           // EXACT match
        /^podiatry.*examination/i,            // podiatry examination(s)
      ],
      component: PodiatryExaminationsDocument
    },

    // ========== FOOT EXAM ==========
    {
      name: 'Foot Exam',
      patterns: [
        /^foot_exam$/i,                       // EXACT match
        /^foot.*exam/i,                       // foot exam
        /^diabetic.*foot.*exam/i,             // diabetic foot exam
        /^foot.*screening/i,                  // foot screening
        /^pedal.*exam/i,                      // pedal exam
        /^monofilament.*test/i,               // monofilament test
        /^foot.*inspection/i,                 // foot inspection
        // NOTE: removed /^foot.*assessment/i (stole foot_orthotics_assessment -> has its own template)
        //       and /^podiatry.*exam/i (stole podiatry_examinations -> has its own template)
      ],
      component: FootExamDocument
    },

    // ========== WOUND HEALING HYPERBARIC ==========
    {
      name: 'Wound Healing Hyperbaric',
      patterns: [
        /^wound_healing_hyperbaric$/i,        // EXACT match
        /^wound.*healing.*hyperbaric/i,       // wound healing hyperbaric
        /^hyperbaric.*wound.*healing/i,       // hyperbaric wound healing
        /^wound.*hyperbaric.*therapy/i,       // wound hyperbaric therapy
        /^hbot.*wound/i,                      // HBOT wound
        /^wound.*hbot/i,                      // wound HBOT
      ],
      component: WoundHealingHyperbaricDocument
    },

    // ========== HYPERBARIC OXYGEN THERAPY ==========
    {
      name: 'Hyperbaric Oxygen Therapy',
      patterns: [
        /^hyperbaric_oxygen_therapy$/i,           // EXACT match
        /^hyperbaric.*oxygen.*therapy/i,          // hyperbaric oxygen therapy
        /^hbo2.*therapy/i,                        // HBO2 therapy
        /^hyperbaric.*treatment/i,                // hyperbaric treatment
        /^hyperbaric.*chamber/i,                  // hyperbaric chamber
        /^oxygen.*therapy.*hyperbaric/i,          // oxygen therapy hyperbaric
        /^wound.*hyperbaric/i,                    // wound hyperbaric
        /^hbot$/i,                                // HBOT abbreviation
      ],
      component: HyperbaricOxygenTherapyDocument
    },

    // ========== DECOMPRESSION SICKNESS TREATMENT ==========
    {
      name: 'Decompression Sickness Treatment',
      patterns: [
        /^decompression_sickness_treatment$/i,   // EXACT match
        /^decompression.*sickness.*treatment/i,  // decompression sickness treatment
        /^dcs.*treatment/i,                      // DCS treatment
        /^decompression.*illness/i,              // decompression illness
        /^recompression.*therapy/i,              // recompression therapy
        /^dive.*decompression/i,                 // dive decompression
        /^hyperbaric.*decompression/i,           // hyperbaric decompression
      ],
      component: DecompressionSicknessTreatmentDocument
    },

    // ========== DIABETIC FOOT ASSESSMENT ==========
    {
      name: 'Diabetic Foot Assessment',
      patterns: [
        /^diabetic_foot_assessment$/i,        // EXACT match
        /^diabetic.*foot.*assessment/i,       // diabetic foot assessment
        /^diabetic.*foot.*ulcer/i,            // diabetic foot ulcer
        /^wagner.*ulcer/i,                    // Wagner ulcer grading
        /^charcot.*foot/i,                    // Charcot foot
        /^neuropathic.*foot/i,               // neuropathic foot
      ],
      component: DiabeticFootAssessmentDocument
    },

    // ========== PODIATRY CONSULTATIONS ==========
    {
      name: 'Podiatry Consultations',
      patterns: [
        /^podiatry_consultations$/i,         // EXACT match
        /^podiatry.*consult/i,               // podiatry_consultation
        /^podiatric.*consult/i,              // podiatric_consultation
      ],
      component: PodiatryConsultationsDocument
    },

    // ========== BUNION SURGERY EVALUATION ==========
    {
      name: 'Bunion Surgery Evaluation',
      patterns: [
        /^bunion_surgery_evaluation$/i,      // EXACT match
        /^bunion.*surgery/i,                 // bunion_surgery
        /^bunion.*eval/i,                    // bunion_evaluation
        /^hallux.*valgus.*surg/i,            // hallux_valgus_surgery
      ],
      component: BunionSurgeryEvaluationDocument
    },

    // ========== HEEL PAIN ASSESSMENT ==========
    {
      name: 'Heel Pain Assessment',
      patterns: [
        /^heel_pain_assessment$/i,           // EXACT match
        /^heel.*pain/i,                      // heel_pain
        /^plantar.*heel/i,                   // plantar_heel_pain
        /^calcaneal.*pain/i,                 // calcaneal_pain
      ],
      component: HeelPainAssessmentDocument
    },

    // ========== INGROWN TOENAIL TREATMENT ==========
    {
      name: 'Ingrown Toenail Treatment',
      patterns: [
        /^ingrown_toenail_treatment$/i,      // EXACT match
        /^ingrown.*toenail/i,                // ingrown_toenail
        /^ingrown.*nail/i,                   // ingrown_nail
        /^onychocryptosis/i,                 // onychocryptosis
      ],
      component: IngrownToenailTreatmentDocument
    },

    // ========== PLANTAR FASCIITIS MANAGEMENT ==========
    {
      name: 'Plantar Fasciitis Management',
      patterns: [
        /^plantar_fasciitis_management$/i,   // EXACT match
        /^plantar.*fasciitis/i,              // plantar_fasciitis
        /^plantar.*fascio/i,                 // plantar_fasciopathy
      ],
      component: PlantarFasciitisManagementDocument
    },

    // ========== FOOT ORTHOTICS ASSESSMENT ==========
    {
      name: 'Foot Orthotics Assessment',
      patterns: [
        /^foot_orthotics_assessment$/i,      // EXACT match
        /^foot.*orthotics/i,                 // foot_orthotics
        /^orthotic.*assessment/i,            // orthotic_assessment
        /^custom.*orthot/i,                  // custom_orthotics
      ],
      component: FootOrthoticsAssessmentDocument
    },

    // ========== BREASTFEEDING RECOMMENDATION ==========
    {
      name: 'Breastfeeding Recommendation',
      patterns: [
        /^breastfeeding_recommendation$/i,
        /^breastfeeding.*recommend/i,
        /^lactation.*recommend/i,
      ],
      component: BreastfeedingRecommendationDocument
    },

    // ========== POSTPARTUM DIABETES RISK ==========
    {
      name: 'Postpartum Diabetes Risk',
      patterns: [
        /^postpartum_diabetes_risk$/i,
        /^postpartum.*diabetes.*risk/i,
        /^post.*partum.*diabetes/i,
      ],
      component: PostpartumDiabetesRiskDocument
    },

    // ========== GDM RECURRENCE RISK ==========
    {
      name: 'GDM Recurrence Risk',
      patterns: [
        /^gdm_recurrence_risk$/i,
        /^gdm.*recurrence/i,
        /^gestational.*diabetes.*recurrence/i,
      ],
      component: GdmRecurrenceRiskDocument
    },

    // ========== POSTPARTUM GLUCOSE MONITORING ==========
    {
      name: 'Postpartum Glucose Monitoring',
      patterns: [
        /^postpartum_glucose_monitoring$/i,
        /^postpartum.*glucose/i,
        /^post.*partum.*glucose/i,
      ],
      component: PostpartumGlucoseMonitoringDocument
    },

    // ========== TOTAL WEIGHT GAIN ==========
    {
      name: 'Total Weight Gain',
      patterns: [
        /^total_weight_gain$/i,
        /^total.*weight.*gain/i,
        /^gestational.*weight.*gain/i,
      ],
      component: TotalWeightGainDocument
    },

    // ========== PRE-PREGNANCY WEIGHT ==========
    {
      name: 'Pre-Pregnancy Weight',
      patterns: [
        /^pre_pregnancy_weight$/i,
        /^pre.*pregnancy.*weight/i,
        /^preconception.*weight/i,
      ],
      component: PrePregnancyWeightDocument
    },

    // ========== EARLY MATERNITY LEAVE ==========
    {
      name: 'Early Maternity Leave',
      patterns: [
        /^early_maternity_leave$/i,
        /^early.*maternity/i,
        /^maternity.*leave/i,
      ],
      component: EarlyMaternityLeaveDocument
    },

    // ========== INTER-PREGNANCY WEIGHT MANAGEMENT ==========
    {
      name: 'Inter-Pregnancy Weight Management',
      patterns: [
        /^inter_pregnancy_weight_management$/i,
        /^inter.*pregnancy.*weight/i,
        /^interpregnancy.*weight/i,
      ],
      component: InterPregnancyWeightManagementDocument
    },

    // ========== TOXICITY ASSESSMENT ==========
    {
      name: 'Toxicity Assessment',
      patterns: [
        /^toxicity_assessment$/i,
        /^toxicity.*assessment/i,
        /^ctcae.*assessment/i,
        /^adverse.*event.*assess/i,
      ],
      component: ToxicityAssessmentDocument
    },

    // ========== ONCOLOGIC EMERGENCIES ==========
    {
      name: 'Oncologic Emergencies',
      patterns: [
        /^oncologic_emergencies$/i,
        /^oncologic.*emergenc/i,
        /^oncology.*emergenc/i,
        /^cancer.*emergenc/i,
      ],
      component: OncologicEmergenciesDocument
    },

    // ========== PRE-CHEMOTHERAPY WORKUP ==========
    {
      name: 'Pre-Chemotherapy Workup',
      patterns: [
        /^pre_chemotherapy_workup$/i,
        /^pre.*chemo.*workup/i,
        /^pre.*chemotherapy/i,
        /^chemo.*clearance/i,
      ],
      component: PreChemotherapyWorkupDocument
    },

    // ========== FITNESS FOR DUTY EVALUATIONS ==========
    {
      name: 'Fitness for Duty Evaluations',
      patterns: [
        /^fitness_for_duty_evaluations$/i,
        /^fitness.*duty/i,
        /^fit.*duty.*eval/i,
        /^duty.*fitness/i,
      ],
      component: FitnessForDutyEvaluationsDocument
    },

    // ========== EMPLOYMENT COUNSELING ==========
    {
      name: 'Employment Counseling',
      patterns: [
        /^employment_counseling$/i,
        /^employment.*counsel/i,
        /^vocational.*counsel/i,
        /^return.*work.*counsel/i,
      ],
      component: EmploymentCounselingDocument
    },

    // ========== PRE-EMPLOYMENT PHYSICAL ==========
    {
      name: 'Pre-Employment Physical',
      patterns: [
        /^pre_employment_physical$/i,
        /^pre.*employment.*physical/i,
        /^pre.*employ.*exam/i,
        /^employment.*physical/i,
      ],
      component: PreEmploymentPhysicalDocument
    },

    // ========== PRENATAL TESTING REPORTS ==========
    {
      name: 'Prenatal Testing Reports',
      patterns: [
        /^prenatal_testing_reports$/i,
        /^prenatal.*testing/i,
        /^prenatal.*screen.*report/i,
        /^nipt.*report/i,
      ],
      component: PrenatalTestingReportsDocument
    },

    // ========== MATERNAL FETAL REPORTS ==========
    {
      name: 'Maternal Fetal Reports',
      patterns: [
        /^maternal_fetal_reports$/i,
        /^maternal.*fetal/i,
        /^mfm.*report/i,
        /^fetal.*growth/i,
      ],
      component: MaternalFetalReportsDocument
    },

    // ========== ULTRASOUND OB REPORTS ==========
    {
      name: 'Ultrasound OB Reports',
      patterns: [
        /^ultrasound_ob_reports$/i,
        /^ultrasound.*ob/i,
        /^ob.*ultrasound/i,
        /^obstetric.*ultrasound/i,
      ],
      component: UltrasoundObReportsDocument
    },

    // ========== MACROSOMIA THRESHOLD ==========
    {
      name: 'Macrosomia Threshold',
      patterns: [
        /^macrosomia_threshold$/i,
        /^macrosomia/i,
        /^large.*gestational/i,
        /^lga.*threshold/i,
      ],
      component: MacrosomiaThresholdDocument
    },

    // ========== PSYCHIATRIC DISCHARGE SUMMARIES ==========
    {
      name: 'Psychiatric Discharge Summaries',
      patterns: [
        /^psychiatric_discharge_summaries$/i,
        /^psychiatric.*discharge/i,
        /^psych.*discharge.*summar/i,
      ],
      component: PsychiatricDischargeSummariesDocument
    },

    // ========== PSYCHIATRIC PROGRESS NOTES ==========
    {
      name: 'Psychiatric Progress Notes',
      patterns: [
        /^psychiatric_progress_notes$/i,
        /^psychiatric.*progress/i,
        /^psych.*progress.*note/i,
      ],
      component: PsychiatricProgressNotesDocument
    },

    // ========== HOMICIDE RISK ASSESSMENT ==========
    {
      name: 'Homicide Risk Assessment',
      patterns: [
        /^homicide_risk_assessment$/i,
        /^homicide.*risk/i,
        /^violence.*risk.*assess/i,
      ],
      component: HomicideRiskAssessmentDocument
    },

    // ========== PSYCHIATRIC REVIEW ==========
    {
      name: 'Psychiatric Review',
      patterns: [
        /^psychiatric_review$/i,
        /^psychiatric.*review/i,
        /^psych.*medication.*review/i,
      ],
      component: PsychiatricReviewDocument
    },

    // ========== BEHAVIORAL HEALTH GOALS ==========
    {
      name: 'Behavioral Health Goals',
      patterns: [
        /^behavioral_health_goals$/i,
        /^behavioral.*health.*goal/i,
        /^mental.*health.*goal/i,
        /^treatment.*goal/i,
      ],
      component: BehavioralHealthGoalsDocument
    },

    // ========== HOURLY VITAL SIGNS ==========
    {
      name: 'Hourly Vital Signs',
      patterns: [
        /^hourly_vital_signs$/i,              // EXACT match
        /^hourly.*vital.*sign/i,              // hourly vital signs
        /^vital.*signs.*hourly/i,             // vital signs hourly
        /^hourly.*vitals/i,                   // hourly vitals
        /^vital.*sign.*monitoring/i,          // vital sign monitoring
      ],
      component: HourlyVitalSignsDocument
    },

    // ========== PERIPHERAL ARTERY DISEASE ==========
    {
      name: 'Peripheral Artery Disease',
      patterns: [
        /^peripheral_artery_disease$/i,       // EXACT match
        /^peripheral.*artery.*disease/i,      // peripheral artery disease
        /^pad.*assessment/i,                  // PAD assessment
        /^peripheral.*vascular.*disease/i,    // peripheral vascular disease
        /^arterial.*disease/i,                // arterial disease
        /^limb.*ischemia/i,                   // limb ischemia
        /^claudication.*assessment/i,         // claudication assessment
      ],
      component: PeripheralArteryDiseaseDocument
    },

    // ========== INTEGRATIVE ONCOLOGY ==========
    {
      name: 'Integrative Oncology',
      patterns: [
        /^integrative_oncology$/i,            // EXACT match
        /^integrative.*oncology/i,            // integrative oncology
        /^oncology.*integrative/i,            // oncology integrative
        /^complementary.*oncology/i,          // complementary oncology
        /^cancer.*integrative/i,              // cancer integrative
        /^holistic.*oncology/i,               // holistic oncology
      ],
      component: IntegrativeOncologyDocument
    },

    // ========== SKIN GRAFTING EVALUATION ==========
    {
      name: 'Skin Grafting Evaluation',
      patterns: [
        /^skin_grafting_evaluation$/i,         // EXACT match
        /^skin.*grafting.*evaluation/i,        // skin grafting evaluation
        /^skin.*graft.*assessment/i,           // skin graft assessment
        /^graft.*evaluation/i,                 // graft evaluation
        /^skin.*graft$/i,                      // skin graft
        /^split.*thickness.*graft/i,           // split thickness graft
        /^stsg.*evaluation/i,                  // STSG evaluation
      ],
      component: SkinGraftingEvaluationDocument
    },

    // ========== PRESSURE INJURY ==========
    {
      name: 'Pressure Injury',
      patterns: [
        /^pressure_injury$/i,                 // EXACT match
        /^pressure.*injury/i,                 // pressure injury
        /^pressure.*ulcer/i,                  // pressure ulcer
        /^decubitus.*ulcer/i,                 // decubitus ulcer
        /^bedsore/i,                          // bedsore
        /^wound.*staging/i,                   // wound staging
      ],
      component: PressureInjuryDocument
    },

    // ========== WORKPLACE ACCOMMODATIONS ==========
    {
      name: 'Workplace Accommodations',
      patterns: [
        /^workplace_accommodations$/i,        // EXACT match
        /^workplace.*accommodation/i,         // workplace accommodation
      ],
      component: WorkplaceAccommodationsDocument
    },

    // ========== WORK ACCOMMODATIONS ==========
    {
      name: 'Work Accommodations',
      patterns: [
        /^work_accommodations$/i,             // EXACT match
        /^work.*accommodation/i,              // work accommodation
        /^occupational.*accommodation/i,      // occupational accommodation
        /^job.*accommodation/i,               // job accommodation
        /^ada.*accommodation/i,               // ADA accommodation
        /^fmla.*documentation/i,              // FMLA documentation
        /^disability.*accommodation/i,        // disability accommodation
        /^return.*work.*accommodation/i,      // return to work accommodation
      ],
      component: WorkAccommodationsDocument
    },

    // ========== DIABETES MANAGEMENT NOTES ==========
    {
      name: 'Diabetes Management Notes',
      patterns: [
        /^diabetes.*management.*note/i,    // diabetes_management_notes
        /^diabetes.*note/i,                // diabetes_notes
        /^diabetic.*management/i,          // diabetic_management
        /^dm.*management/i,                // dm_management
        /^diabetes.*care/i,                // diabetes_care
      ],
      component: DiabetesManagementNotesDocument
    },
    // ========== DIABETIC NEPHROPATHY ==========
    {
      name: 'Diabetic Nephropathy',
      patterns: [
        /^diabetic_nephropathy$/i,              // EXACT match
        /^diabetic.*nephropathy/i,              // diabetic_nephropathy
        /^nephropathy.*diabetic/i,              // nephropathy_diabetic
        /^diabetes.*nephropathy/i,              // diabetes_nephropathy
        /^diabetes.*kidney/i,                   // diabetes_kidney_disease
        /^diabetic.*kidney/i,                   // diabetic_kidney_disease
        /^dkd$/i,                               // DKD (diabetic kidney disease)
      ],
      component: DiabeticNephropathyDocument
    },
    // ========== HYPERTENSIVE NEPHROPATHY ==========
    {
      name: 'Hypertensive Nephropathy',
      patterns: [
        /^hypertensive_nephropathy$/i,              // EXACT match
        /^hypertensive.*nephropathy/i,              // hypertensive_nephropathy
        /^nephropathy.*hypertensive/i,              // nephropathy_hypertensive
        /^hypertension.*nephropathy/i,              // hypertension_nephropathy
        /^hypertension.*kidney/i,                   // hypertension_kidney_disease
        /^hypertensive.*kidney/i,                   // hypertensive_kidney_disease
        /^htn.*nephropathy/i,                       // htn_nephropathy
      ],
      component: HypertensiveNephropathyDocument
    },
    // ========== NEUROLOGY PROGRESS NOTES ==========
    {
      name: 'Neurology Progress Notes',
      patterns: [
        /^neurology_progress_notes$/i,              // EXACT match
        /^neurology.*progress.*notes/i,             // neurology_progress_notes
        /^neuro.*progress.*notes/i,                 // neuro_progress_notes
        /^neurology.*progress/i,                    // neurology_progress
        /^neurological.*progress.*notes/i,          // neurological_progress_notes
      ],
      component: NeurologyProgressNotesDocument
    },
    // ========== GERIATRIC CARE PLANNING ==========
    {
      name: 'Geriatric Care Planning',
      patterns: [
        /^geriatric_care_planning$/i,               // EXACT match
        /^geriatric.*care.*planning/i,              // geriatric_care_planning
      ],
      component: GeriatricCarePlanningDocument
    },
    {
      name: 'Chronic Disease Management',
      patterns: [
        /^chronic_disease_management$/i,    // EXACT match
        /^chronic.*disease.*management/i,   // chronic_disease_management
        /^chronic.*disease/i,                // chronic_disease
        /^disease.*management/i,             // disease_management
        /^chronic.*care/i,                   // chronic_care
      ],
      component: ChronicDiseaseManagementDocument
    },
    {
      name: 'COPD Assessments',
      patterns: [
        /^copd_assessments$/i,               // EXACT match
        /^copd.*assessment/i,                // copd_assessments, copd_assessment
        /^copd.*eval/i,                      // copd_evaluation
        /^copd/i,                            // copd (alone)
      ],
      component: CopdAssessmentsDocument
    },
    {
      name: 'Bronchial Hygiene Therapy',
      patterns: [
        /^bronchial_hygiene_therapy$/i,       // EXACT match
        /^bronchial.*hygiene/i,               // bronchial_hygiene, bronchial_hygiene_therapy
        /^bronchial.*therapy/i,               // bronchial_therapy
        /^airway.*clearance/i,                // airway_clearance
        /^chest.*physiotherapy/i,             // chest_physiotherapy
      ],
      component: BronchialHygieneTherapyDocument
    },
    {
      name: 'Respiratory Therapy Assessment',
      patterns: [
        /^respiratory_therapy_assessment$/i,    // EXACT match
        /^respiratory.*therapy.*assessment/i,   // respiratory_therapy_assessment
        /^respiratory.*therapy.*eval/i,         // respiratory_therapy_evaluation
        /^resp.*therapy.*assess/i,              // resp_therapy_assessment
        /^rt.*assessment/i,                     // rt_assessment
      ],
      component: RespiratoryTherapyAssessmentDocument
    },
    {
      name: 'Oxygen Titration Protocol',
      patterns: [
        /^oxygen_titration_protocol$/i,         // EXACT match
        /^oxygen.*titration.*protocol/i,        // oxygen_titration_protocol
        /^oxygen.*titration/i,                  // oxygen_titration
        /^o2.*titration/i,                      // o2_titration
        /^oxygen.*protocol/i,                   // oxygen_protocol
        /^titration.*protocol/i,                // titration_protocol
      ],
      component: OxygenTitrationProtocolDocument
    },

    // ========== AI CLINICAL INSIGHTS (Tier 1) ==========

    // Clinical Decision Support
    {
      name: 'Clinical Decision Support',
      patterns: [
        /^clinical.*decision.*support/i,   // clinical_decision_support
        /^decision.*support/i,             // decision_support
        /^cds/i,                           // cds (acronym)
      ],
      component: ClinicalDecisionSupportDocument
    },

    // Intelligent Recommendations
    {
      name: 'Intelligent Recommendations',
      patterns: [
        /^intelligent.*recommendation/i,   // intelligent_recommendations
        /^ai.*recommendation/i,            // ai_recommendations
        /^smart.*recommendation/i,         // smart_recommendations
      ],
      component: IntelligentRecommendationsDocument
    },

    // Trending Analysis
    {
      name: 'Trending Analysis',
      patterns: [
        /^trending.*analysis/i,            // trending_analysis
        /^trend.*analysis/i,               // trend_analysis
        /^trends/i,                        // trends
      ],
      component: TrendingAnalysisDocument
    },

    // Patient-Specific Care Plan (Tailored interventions & lifestyle)
    {
      name: 'Patient-Specific Care Plan',
      patterns: [
        /^patient.*specific.*care.*plan/i, // patient_specific_care_plan
      ],
      component: PatientSpecificCarePlanDocument
    },

    // Patient Care Plan (Generic)
    {
      name: 'Patient Care Plan',
      patterns: [
        /^patient.*care.*plan/i,           // patient_care_plan
        /^care.*plan/i,                    // care_plan
      ],
      component: PatientCarePlanDocument
    },

    // Follow-Up Intelligence
    {
      name: 'Follow-Up Intelligence',
      patterns: [
        /^follow.*up.*intelligence/i,      // follow_up_intelligence
        /^followup.*intelligence/i,        // followup_intelligence
        /^follow.*up.*tracker/i,           // follow_up_tracker
      ],
      component: FollowUpIntelligenceDocument
    },

    // Follow-Up Appointments
    {
      name: 'Follow-Up Appointments',
      patterns: [
        /^follow.*up.*appointment/i,       // follow_up_appointments
        /^followup.*appointment/i,         // followup_appointments
        /^follow.*up.*visit/i,             // follow_up_visits
      ],
      component: FollowUpAppointmentsDocument
    },

    // Follow-Ups (collection: follow_ups)
    {
      name: 'Follow-Ups',
      patterns: [
        /^follow_ups$/i,                   // EXACT: follow_ups collection
        /^followups$/i,                    // followups
        /^follow.*up.*recommendation/i,    // follow_up_recommendations
        /^followup.*recommendation/i,      // followup_recommendations
      ],
      component: FollowUpsDocument
    },

    // ========== PROGNOSIS (Primary assessment) ==========
    {
      name: 'Prognosis',
      patterns: [
        /^prognosis$/i,                    // EXACT: prognosis collection
        /^patient.*prognosis$/i,           // patient_prognosis (without "record")
        /^clinical.*prognosis$/i,          // clinical_prognosis (without "record")
        /^outcome.*prognosis$/i,           // outcome_prognosis (without "record")
        /^short.*term.*prognosis/i,        // short_term_prognosis
        /^long.*term.*prognosis/i,         // long_term_prognosis
      ],
      component: PrognosisDocument
    },

    // ========== PROGNOSIS RECORDS (Historical/detailed records) ==========
    {
      name: 'Prognosis Records',
      patterns: [
        /^prognosis.*records?$/i,          // EXACT: prognosis_records, prognosis_record
        /^patient.*prognosis.*record/i,    // patient_prognosis_records
        /^clinical.*prognosis.*record/i,   // clinical_prognosis_records
        /^outcome.*prognosis.*record/i,    // outcome_prognosis_records
      ],
      component: PrognosisRecordsDocument
    },

    // ========== PROGNOSIS DISCUSSION ==========
    {
      name: 'Prognosis Discussion',
      patterns: [
        /^prognosis.*discussion$/i,          // EXACT: prognosis_discussion
        /^prognosis.*conversations?$/i,      // prognosis_conversation
        /^disease.*prognosis.*discussion$/i, // disease_prognosis_discussion
        /^patient.*prognosis.*discussion$/i, // patient_prognosis_discussion
      ],
      component: PrognosisDiscussionDocument
    },

    // ========== CANCER SURVEILLANCE ==========
    {
      name: 'Cancer Surveillance',
      patterns: [
        /^cancer_surveillance$/i,            // EXACT: cancer_surveillance collection
        /^cancer.*surveillance/i,            // cancer_surveillance, hcc_surveillance
        /^hcc.*surveillance/i,               // hcc_surveillance (Hepatocellular Carcinoma)
        /^tumor.*surveillance/i,             // tumor_surveillance
        /^oncology.*surveillance/i,          // oncology_surveillance
      ],
      component: CancerSurveillanceDocument
    },

    // ========== SYMPTOM PROGRESSION ==========
    // NOTE: symptom_progression_timeline is handled by SymptomProgressionTimelineDocument (see below)
    {
      name: 'Symptom Progression',
      patterns: [
        /^symptom_progression$/i,           // EXACT: symptom_progression collection (NOT timeline)
        /^symptoms_progression$/i,          // EXACT: symptoms_progression (NOT timeline)
        /^disease_progression$/i,           // EXACT: disease_progression (NOT timeline)
        /^clinical_progression$/i,          // EXACT: clinical_progression (NOT timeline)
      ],
      component: SymptomProgressionDocument
    },

    // Symptom Progression Timeline - MUST come right after to catch timeline patterns
    {
      name: 'Symptom Progression Timeline',
      patterns: [
        /^symptom_progression_timeline$/i,     // EXACT: symptom_progression_timeline
        /^symptom.*progression.*timeline/i,    // symptom_progression_timeline variations
        /^symptom.*timeline/i,                 // symptom_timeline
        /^disease.*progression.*timeline/i,   // disease_progression_timeline
        /^flare.*progression/i,                // flare_progression
      ],
      component: SymptomProgressionTimelineDocument
    },

    // Flare Management
    {
      name: 'Flare Management',
      patterns: [
        /^flare[_\s]?management$/i,
      ],
      component: FlareManagementDocument
    },

    // Outcomes Predictions
    {
      name: 'Outcomes Predictions',
      patterns: [
        /^outcomes.*prediction/i,          // outcomes_prediction, outcomes_predictions
        /^outcome.*prediction/i,           // outcome_prediction
      ],
      component: OutcomesPredictionsDocument
    },

    // Guideline Compliance
    {
      name: 'Guideline Compliance',
      patterns: [
        /^guideline.*compliance/i,         // guideline_compliance
        /^guidelines.*compliance/i,        // guidelines_compliance
        /^compliance.*check/i,             // compliance_check
      ],
      component: GuidelineComplianceDocument
    },

    // History of Present Illness
    {
      name: 'History of Present Illness',
      patterns: [
        /^history.*present.*illness/i,     // history_present_illness
        /^hpi/i,                           // hpi (acronym)
        /^present.*illness/i,              // present_illness
      ],
      component: HistoryPresentIllnessDocument
    },

    // Patient Education Context
    {
      name: 'Patient Education Records',
      patterns: [
        /^patient.*education.*record/i,    // patient_education_records (MORE SPECIFIC - must be before general pattern)
      ],
      component: PatientEducationRecordsDocument
    },
    {
      name: 'Patient Education Context',
      patterns: [
        /^patient.*education.*context/i,   // patient_education_context
        /^patient.*education/i,            // patient_education (general - catches remaining)
        /^education.*material/i,           // education_materials
        /^patient.*information/i,          // patient_information
      ],
      component: PatientEducationContextDocument
    },

    // ========== SURGICAL & MENTAL HEALTH (Tier 2) ==========

    // Intraoperative Findings - MUST come before IntraoperativeRecords to avoid /^intra.*operative/i matching
    {
      name: 'Intraoperative Findings',
      patterns: [
        /^intraoperative_findings$/i,          // EXACT: intraoperative_findings
        /^intraoperative.*finding/i,           // intraoperative_findings variations
        /^operative.*finding/i,                // operative_findings
        /^surgical.*finding/i,                 // surgical_findings
        /^adhesion/i,                          // adhesions
        /^pathological.*finding/i,             // pathological_findings
      ],
      component: IntraoperativeFindingsDocument
    },

    // Intraoperative Imaging - MUST come before IntraoperativeRecords to avoid /^intra.*operative/i matching
    {
      name: 'Intraoperative Imaging',
      patterns: [
        /^intraoperative_imaging$/i,           // EXACT: intraoperative_imaging
        /^intraoperative.*imaging/i,           // intraoperative_imaging variations
        /^intraop.*imaging/i,                  // intraop_imaging
        /^operative.*imaging/i,                // operative_imaging
        /^surgical.*imaging/i,                 // surgical_imaging
        /^cholangiography/i,                   // cholangiography
        /^cholangiogram/i,                     // cholangiogram
        /^ioc$/i,                              // IOC (intraoperative cholangiography)
        /^fluoroscopy/i,                       // fluoroscopy
        /^intraoperative.*ultrasound/i,        // intraoperative_ultrasound
        /^ious$/i,                             // IOUS (intraoperative ultrasound)
      ],
      component: IntraoperativeImagingDocument
    },

    // Neuro Imaging (Advanced Functional Neuroimaging - DTI, Tractography)
    // NOTE: functional_mri_studies routes to FunctionalMriStudiesDocument (line ~6130)
    {
      name: 'Neuro Imaging',
      patterns: [
        /^neuro_imaging$/i,                        // EXACT match (collection name)
        /^neuro.*imaging/i,                        // neuro imaging
        /^neuroimaging/i,                          // neuroimaging
        /^functional.*neuroimaging/i,              // functional neuroimaging
        // functional_mri/fmri/brain_mapping moved to FunctionalMriStudiesDocument
        /^dti/i,                                   // DTI
        /^diffusion.*tensor/i,                     // diffusion tensor imaging
        /^tractography/i,                          // tractography
        /^motor.*mapping/i,                        // motor mapping
        /^language.*mapping/i,                     // language mapping
        /^eloquent.*cortex/i,                      // eloquent cortex mapping
        /^pre.*surgical.*imaging/i,                // pre-surgical imaging
        /^presurgical.*imaging/i,                  // presurgical imaging
        /^surgical.*navigation.*imaging/i,         // surgical navigation imaging
        /^neuronavigation.*imaging/i,              // neuronavigation imaging
      ],
      component: NeuroImagingDocument
    },

    // Neurosurgery Assessment
    {
      name: 'Neurosurgery Assessment',
      patterns: [
        /^neurosurgery_assessment$/i,              // EXACT match
        /^neurosurgery.*assessment/i,              // neurosurgery assessment
        /^neurosurgical.*assessment/i,             // neurosurgical assessment
        /^neurosurgery.*evaluation/i,              // neurosurgery evaluation
        /^brain.*tumor.*assessment/i,              // brain tumor assessment
        /^tumor.*resection.*planning/i,            // tumor resection planning
        /^pre.*surgical.*brain.*mapping/i,         // pre-surgical brain mapping
        /^presurgical.*brain.*mapping/i,           // presurgical brain mapping
        /^functional.*mri.*assessment/i,           // functional MRI assessment
        /^fmri.*assessment/i,                      // fMRI assessment
        /^tractography.*assessment/i,              // tractography assessment
        /^dti.*assessment/i,                       // DTI assessment
        /^intraoperative.*monitoring.*plan/i,      // intraoperative monitoring plan
        /^tumor.*characteristics.*assessment/i,    // tumor characteristics assessment
        /^sma.*syndrome/i,                         // SMA syndrome
        /^extent.*of.*resection/i,                 // extent of resection
        /^resection.*planning/i,                   // resection planning
        /^awake.*craniotomy.*planning/i,           // awake craniotomy planning
      ],
      component: NeurosurgeryAssessmentDocument
    },

    // Radiology Findings
    {
      name: 'Radiology Findings',
      patterns: [
        /^radiology_findings$/i,               // EXACT match
        /^radiology.*finding/i,                // radiology findings
        /^imaging.*finding/i,                  // imaging findings
        /^radiological.*finding/i,             // radiological findings
        /^bi.*rads/i,                          // BI-RADS, bi-rads, birads
        /^birads/i,                            // birads
        /^ti.*rads/i,                          // TI-RADS, ti-rads, tirads
        /^tirads/i,                            // tirads
        /^pi.*rads/i,                          // PI-RADS, pi-rads, pirads
        /^pirads/i,                            // pirads
        /^rads.*score/i,                       // rads score, rads scoring
        /^breast.*imaging.*finding/i,          // breast imaging findings
        /^mammography.*finding/i,              // mammography findings
        /^thyroid.*imaging.*finding/i,         // thyroid imaging findings
        /^prostate.*imaging.*finding/i,        // prostate imaging findings
        /^ct.*finding/i,                       // CT findings
        /^mri.*finding/i,                      // MRI findings
        /^ultrasound.*finding/i,               // ultrasound findings
      ],
      component: RadiologyFindingsDocument
    },

    // Neurological Findings
    {
      name: 'Neurological Findings',
      patterns: [
        /^neurological_findings$/i,            // EXACT match
        /^neurological.*finding/i,             // neurological findings
        /^neuro.*finding/i,                    // neuro findings
        /^neurologic.*finding/i,               // neurologic findings
        /^brain.*finding/i,                    // brain findings
        /^spinal.*cord.*finding/i,             // spinal cord findings
        /^peripheral.*nerve.*finding/i,        // peripheral nerve findings
        /^cranial.*nerve.*finding/i,           // cranial nerve findings
        /^motor.*finding/i,                    // motor findings
        /^sensory.*finding/i,                  // sensory findings
        /^reflex.*finding/i,                   // reflex findings
        /^cerebellar.*finding/i,               // cerebellar findings
        /^cns.*finding/i,                      // CNS findings
        /^pns.*finding/i,                      // PNS findings
      ],
      component: NeurologicalFindingsDocument
    },

    // Surgical History
    {
      name: 'Surgical History',
      patterns: [
        /^surgical_history$/i,                  // EXACT match
        /^surgical.*history/i,                  // surgical_history variations
        /^past.*surg/i,                         // past surgeries
        /^previous.*surg/i,                     // previous surgeries
        /^prior.*surg/i,                        // prior surgeries
        /^surgery.*history/i,                   // surgery history
        /^past.*operation/i,                    // past operations
        /^previous.*operation/i,                // previous operations
        /^operation.*history/i,                 // operation history
        /^history.*surg/i,                      // history of surgery
      ],
      component: SurgicalHistoryDocument
    },

    // Post-Operative Reports
    // NOTE: Do NOT add /^operative.*report/i here - it would incorrectly match "operative_reports"
    // That pattern belongs ONLY in the Operative Reports template below
    {
      name: 'Post-Operative Reports',
      patterns: [
        /^post_operative_reports$/i,            // EXACT match
        /^post.*operative.*report/i,            // post-operative reports variations
        /^postoperative.*report/i,              // postoperative reports
        /^postop.*report/i,                     // postop reports
        /^post.*op.*report/i,                   // post op reports
      ],
      component: PostOperativeReportsDocument
    },

    // Postoperative Orders
    {
      name: 'Postoperative Orders',
      patterns: [
        /^postoperative_orders$/i,             // EXACT match
        /^postoperative.*order/i,              // postoperative_orders variations
        /^post.*operative.*order/i,            // post-operative orders
        /^postop.*order/i,                     // postop orders
        /^post.*op.*order/i,                   // post op orders
        /^recovery.*order/i,                   // recovery orders
        /^pacu.*order/i,                       // PACU orders
        /^post.*anesthesia.*order/i,           // post anesthesia orders
        /^post.*surgical.*order/i,             // post surgical orders
        /^discharge.*order/i,                  // discharge orders
      ],
      component: PostoperativeOrdersDocument
    },

    // Operative Technique
    {
      name: 'Operative Technique',
      patterns: [
        /^operative_technique$/i,              // EXACT match
        /^operative.*technique/i,              // operative_technique variations
        /^surgical.*technique/i,               // surgical technique
        /^procedure.*technique/i,              // procedure technique
        /^operation.*technique/i,              // operation technique
        /^technique.*operative/i,              // technique variations
      ],
      component: OperativeTechniqueDocument
    },

    // Specimens
    {
      name: 'Specimens',
      patterns: [
        /^specimens$/i,                         // EXACT match
        /^specimen$/i,                          // singular
        /^surgical.*specimen/i,                 // surgical specimen
        /^tissue.*specimen/i,                   // tissue specimen
        /^pathology.*specimen/i,                // pathology specimen
        /^biopsy.*specimen/i,                   // biopsy specimen
        /^specimen.*collection/i,               // specimen collection
      ],
      component: SpecimensDocument
    },

    // Consultation Details
    {
      name: 'Consultation Details',
      patterns: [
        /^consultation_details$/i,              // EXACT match
        /^consultation.*detail/i,               // consultation_details variations
        /^specialist.*consultation/i,           // specialist consultations
        /^specialist.*consult$/i,               // specialist consult
        /^referral.*consultation/i,             // referral consultations
        /^consulting.*provider/i,               // consulting provider search
        /^consultation.*opinion/i,              // consultation opinion
        /^diagnostic.*impression/i,             // diagnostic impression
        /^consultation.*reason/i,               // consultation reason
        /^therapeutic.*recommendation/i,        // therapeutic recommendations
        /^recommended.*diagnostic/i,            // recommended diagnostics
      ],
      component: ConsultationDetailsDocument
    },

    // Intraoperative Cholangiography (EXACT - must be before Intraoperative Records)
    {
      name: 'Intraoperative Cholangiography',
      patterns: [
        /^intraoperative_cholangiography$/i,      // EXACT: intraoperative_cholangiography
        /^intraop.*cholangio/i,                   // intraop cholangiography variations
        /^ioc$/i,                                 // IOC abbreviation
        /^cholangio.*gram/i,                      // cholangiogram
        /^bile.*duct.*imaging/i,                  // bile duct imaging
      ],
      component: IntraoperativeCholangiographyDocument
    },

    // Intraoperative Records
    {
      name: 'Intraoperative Records',
      patterns: [
        /^intraoperative_records$/i,       // EXACT: intraoperative_records
        /^intraoperative.*record/i,        // intraoperative_records
        /^intra.*operative/i,              // intra_operative_notes (catches remaining intra*operative patterns)
        /^operative.*record/i,             // operative_records
        /^surgical.*record/i,              // surgical_records
      ],
      component: IntraoperativeRecordsDocument
    },

    // Operative Report Details (EXACT - must be before Operative Reports)
    {
      name: 'Operative Report Details',
      patterns: [
        /^operative_report_details$/i,     // EXACT match only
      ],
      component: OperativeReportDetailsDocument
    },

    // Operative Reports
    {
      name: 'Operative Reports',
      patterns: [
        /^operative_reports$/i,            // operative_reports (exact match)
        /^operative.*report/i,             // operative_report, operative_notes
        /^surgical.*report/i,              // surgical_reports
        /^operation.*note/i,               // operation_notes
        /^surgery.*report/i,               // surgery_reports
        /^op.*report/i,                    // op_reports
      ],
      component: OperativeReportsDocument
    },

    // Patient Positioning
    {
      name: 'Patient Positioning',
      patterns: [
        /^patient_positioning$/i,           // EXACT: patient_positioning
        /^patient.*position/i,              // patient_positioning variations
        /^positioning.*record/i,            // positioning_records
        /^surgical.*position/i,             // surgical_positioning
      ],
      component: PatientPositioningDocument
    },

    // Prep and Drape
    {
      name: 'Prep and Drape',
      patterns: [
        /^prep_and_drape$/i,                 // EXACT: prep_and_drape
        /^prep.*drape/i,                     // prep_and_drape variations
        /^surgical.*prep/i,                  // surgical_prep
        /^draping.*record/i,                 // draping_records
      ],
      component: PrepAndDrapeDocument
    },

    // Pneumoperitoneum
    {
      name: 'Pneumoperitoneum',
      patterns: [
        /^pneumoperitoneum$/i,                // EXACT: pneumoperitoneum
        /^pneumo.*peritoneum/i,               // variations
        /^insufflation.*record/i,             // insufflation_records
        /^co2.*insufflation/i,                // CO2 insufflation
      ],
      component: PneumoperitoneumDocument
    },

    // Critical View of Safety
    {
      name: 'Critical View of Safety',
      patterns: [
        /^critical_view_of_safety$/i,         // EXACT: critical_view_of_safety
        /^critical.*view.*safety/i,           // critical_view_safety variations
        /^cvs$/i,                             // CVS abbreviation
        /^calot.*triangle/i,                  // Calot's triangle related
      ],
      component: CriticalViewOfSafetyDocument
    },

    // Pre-Operative Assessments
    {
      name: 'Pre-Operative Assessment',
      patterns: [
        /^pre_operative_assessments$/i,
        /^pre.*operative.*assessment/i,
        /^preop.*assessment/i,
      ],
      component: PreOperativeAssessmentsDocument
    },

    // Diagnostic Studies
    {
      name: 'Diagnostic Studies',
      patterns: [
        /^diagnostic_studies$/i,
        /^diagnostic.*stud/i,
      ],
      component: DiagnosticStudiesDocument
    },

    // Document Metadata
    {
      name: 'Document Metadata',
      patterns: [
        /^document_metadata$/i,
        /^document.*metadata/i,
      ],
      component: DocumentMetadataDocument
    },

    // Surgical Consent Forms
    {
      name: 'Surgical Consent Form',
      patterns: [
        /^surgical_consent_forms$/i,           // EXACT: surgical_consent_forms
        /^surgical.*consent.*form/i,           // surgical_consent_form
        /^consent.*form/i,                     // consent_forms
        /^informed.*consent/i,                 // informed_consent
      ],
      component: SurgicalConsentFormsDocument
    },

    // ========== SPONGE/INSTRUMENT COUNTS ==========
    {
      name: 'Sponge/Instrument Counts',
      patterns: [
        /^sponge_instrument_counts$/i,         // EXACT match: sponge_instrument_counts
        /^sponge.*instrument/i,                // sponge_instrument variations
        /^instrument.*count/i,                 // instrument_counts
        /^sponge.*count/i,                     // sponge_counts
      ],
      component: SpongeInstrumentCountsDocument
    },

    // Surgical Approach
    {
      name: 'Surgical Approach',
      patterns: [
        /^surgical_approach$/i,                // EXACT: surgical_approach
        /^surgical.*approach/i,                // surgical_approach variations
        /^operative.*approach/i,               // operative_approach
        /^laparoscopic.*approach/i,            // laparoscopic_approach
        /^robotic.*approach/i,                 // robotic_approach
        /^port.*placement/i,                   // port_placement
        /^trocar.*placement/i,                 // trocar_placement
      ],
      component: SurgicalApproachDocument
    },

    // Psychosocial Oncology (MUST be BEFORE PsychosocialAssessments - /^psych.*social/i would match psychosocial_oncology)
    {
      name: 'Psychosocial Oncology',
      patterns: [
        /^psychosocial[_\s]?oncology$/i,               // psychosocial_oncology
        /^psycho[_\s]?oncology$/i,                     // psycho_oncology
        /^psycho-oncology$/i,                          // psycho-oncology
        /^oncology[_\s]?psychosocial$/i,               // oncology_psychosocial
        /^cancer[_\s]?psychosocial$/i,                 // cancer_psychosocial
        /^distress[_\s]?screening$/i,                  // distress_screening
        /^cancer[_\s]?distress$/i,                     // cancer_distress
        /^cancer[_\s]?coping$/i,                       // cancer_coping
      ],
      component: PsychosocialOncologyDocument
    },

    // Prognostic Factors
    {
      name: 'Prognostic Factors',
      patterns: [
        /^prognostic[_\s]?factors$/i,                  // prognostic_factors
        /^prognosis$/i,                               // prognosis
        /^prognostic$/i,                              // prognostic
        /^survival[_\s]?estimates$/i,                 // survival_estimates
        /^prognostic[_\s]?scores$/i,                  // prognostic_scores
        /^recurrence[_\s]?risk$/i,                    // recurrence_risk
      ],
      component: PrognosticFactorsDocument
    },

    // Supportive Care
    {
      name: 'Supportive Care',
      patterns: [
        /^supportive[_\s]?care$/i,                      // supportive_care
        /^supportive[_\s]?therapy$/i,                   // supportive_therapy
        /^supportive[_\s]?treatment$/i,                 // supportive_treatment
        /^anti[_\s\-]?seizure/i,                        // anti_seizure, anti-seizure
        /^seizure[_\s]?prophylaxis$/i,                  // seizure_prophylaxis
        /^steroid[_\s]?management$/i,                   // steroid_management
        /^pcp[_\s]?prophylaxis$/i,                      // pcp_prophylaxis
        /^anti[_\s\-]?emetic/i,                         // anti_emetic, anti-emetic
      ],
      component: SupportiveCareDocument
    },

    // ICU Flow Sheets
    {
      name: 'ICU Flow Sheets',
      patterns: [
        /^icu[_\s]?flow[_\s]?sheets?$/i,               // icu_flow_sheets, icu_flow_sheet
        /^icu[_\s]?flowsheets?$/i,                     // icu_flowsheets, icu_flowsheet
        /^flow[_\s]?sheets?$/i,                        // flow_sheets, flow_sheet
        /^icu[_\s]?documentation$/i,                   // icu_documentation
        /^icu[_\s]?records?$/i,                        // icu_records, icu_record
        /^intensive[_\s]?care[_\s]?flow/i,             // intensive_care_flow_sheets
        /^critical[_\s]?care[_\s]?flow/i,              // critical_care_flow_sheets
      ],
      component: IcuFlowSheetsDocument
    },

    // Psychosocial Factors (MUST be BEFORE PsychosocialAssessments - /^psych.*social/i would match psychosocial_factors)
    {
      name: 'Psychosocial Factors',
      patterns: [
        /^psychosocial_factors$/i,             // EXACT: psychosocial_factors
        /^psychosocial.*factor/i,              // psychosocial_factors_assessment
      ],
      component: PsychosocialFactorsDocument
    },

    // Psychosocial Support Services (MUST be BEFORE PsychosocialAssessments - exact match first)
    {
      name: 'Psychosocial Support Services',
      patterns: [
        /^psychosocial_support_services$/i,              // EXACT: psychosocial_support_services
        /^psychosocial.*support.*services/i,             // psychosocial_support_services variations
        /^psychosocial.*support/i,                       // psychosocial support
        /^psychosocial.*services/i,                      // psychosocial services
        /^support.*services.*psychosocial/i,             // support services psychosocial
      ],
      component: PsychosocialSupportServicesDocument
    },

    // Medication Therapy Management
    {
      name: 'Medication Therapy Management',
      patterns: [
        /^medication_therapy_management$/i,              // EXACT: medication_therapy_management
        /^medication.*therapy.*management/i,             // medication_therapy_management variations
        /^mtm$/i,                                        // MTM abbreviation
      ],
      component: MedicationTherapyManagementDocument
    },

    // Comprehensive Medication Review
    {
      name: 'Comprehensive Medication Review',
      patterns: [
        /^comprehensive_medication_review$/i,              // EXACT: comprehensive_medication_review
        /^comprehensive.*medication.*review/i,             // comprehensive_medication_review variations
        /^cmr$/i,                                          // CMR abbreviation
      ],
      component: ComprehensiveMedicationReviewDocument
    },

    // Pharmacist Consultation
    {
      name: 'Pharmacist Consultation',
      patterns: [
        /^pharmacist_consultation$/i,                      // EXACT: pharmacist_consultation
        /^pharmacist.*consultation/i,                      // pharmacist_consultation variations
        /^pharmacy.*consultation/i,                        // pharmacy_consultation
      ],
      component: PharmacistConsultationDocument
    },

    // Biopsychosocial Formulation (MUST be BEFORE PsychosocialAssessments - starts with "bio" not "psycho")
    {
      name: 'Biopsychosocial Formulation',
      patterns: [
        /^biopsychosocial_formulation$/i,  // EXACT: biopsychosocial_formulation
        /^biopsychosocial.*formulation/i,  // biopsychosocial_formulation variations
        /^biopsychosocial$/i,              // biopsychosocial (standalone)
      ],
      component: BiopsychosocialFormulationDocument
    },

    // Psychiatric Assessment Scales (MUST be BEFORE PsychosocialAssessments - exact match prevents /^psychiatric.*assessment/i conflict)
    {
      name: 'Psychiatric Assessment Scales',
      patterns: [
        /^psychiatric_assessment_scales$/i,  // EXACT match only
      ],
      component: PsychiatricAssessmentScalesDocument
    },

    // Safety Planning (EXACT match)
    {
      name: 'Safety Planning',
      patterns: [
        /^safety_planning$/i,  // EXACT match only
      ],
      component: SafetyPlanningDocument
    },

    // Psychosocial Assessments
    {
      name: 'Psychosocial Assessment',
      patterns: [
        /^psychosocial_assessments?$/i,    // EXACT: psychosocial_assessments
        /^psychosocial.*assessment/i,      // psychosocial_assessments variations
        /^psych_social/i,                  // psych_social_evaluation (narrowed from /^psych.*social/i)
        /^psychiatric.*assessment/i,       // psychiatric_assessment
      ],
      component: PsychosocialAssessmentsDocument
    },

    // Depression Screening
    {
      name: 'Depression Screening',
      patterns: [
        /^depression_screening$/i,         // EXACT match: depression_screening collection
        /^depression.*screen/i,            // depression_screening, depression_screens
        /^phq.*9/i,                        // phq_9, phq9_screening
        /^mental.*health.*screen/i,        // mental_health_screening
        /^mood.*screen/i,                  // mood_screening
      ],
      component: DepressionScreeningDocument
    },

    // Exercise Prescription
    {
      name: 'Exercise Prescription',
      patterns: [
        /^exercise_prescription$/i,         // EXACT match: exercise_prescription collection
        /^exercise.*prescript/i,            // exercise_prescription
      ],
      component: ExercisePrescriptionDocument
    },

    // Medical Certificates
    {
      name: 'Medical Certificates',
      patterns: [
        /^medical_certificates$/i,           // EXACT match: medical_certificates collection
        /^medical.*certific/i,               // medical_certificates
        /^certific.*medical/i,               // certificate_medical
      ],
      component: MedicalCertificatesDocument
    },

    // Exercise Recommendations
    {
      name: 'Exercise Recommendations',
      patterns: [
        /^exercise_recommendations$/i,      // EXACT match: exercise_recommendations collection
        /^exercise.*recommend/i,            // exercise_recommendations
        /^fitness.*recommend/i,             // fitness_recommendations
        /^cardiac.*rehab.*exercise/i,       // cardiac_rehab_exercise
        /^physical.*activity.*plan/i,       // physical_activity_plan
      ],
      component: ExerciseRecommendationsDocument
    },

    // ========== EXERCISE PROGRAM ==========
    {
      name: 'Exercise Program',
      patterns: [
        /^exercise_program$/i,              // EXACT match
        /^exercise.*program/i,              // exercise program
        /^workout.*program/i,              // workout program
        /^fitness.*program/i,              // fitness program
      ],
      component: ExerciseProgramDocument
    },

    // Treatment Goals
    {
      name: 'Treatment Goals',
      patterns: [
        /^treatment_goals$/i,              // EXACT match: treatment_goals collection
        /^treatment.*goals?$/i,            // treatment_goals, treatment_goal
        /^rehab.*goals?$/i,                // rehab_goals, rehabilitation_goals
        /^therapy.*goals?$/i,              // therapy_goals
        /^patient.*goals?$/i,              // patient_goals
        /^care.*goals?$/i,                 // care_goals
      ],
      component: TreatmentGoalsDocument
    },

    // Substance Use Assessment
    {
      name: 'Substance Use Assessment',
      patterns: [
        /^substance.*use.*assessment/i,    // substance_use_assessment
        /^substance.*abuse.*assessment/i,  // substance_abuse_assessment
        /^addiction.*assessment/i,         // addiction_assessment
      ],
      component: SubstanceUseAssessmentDocument
    },

    // Therapy Progress Notes (MUST be BEFORE Therapy Session Notes to avoid /^therapy.*note/i conflict)
    {
      name: 'Therapy Progress Notes',
      patterns: [
        /^therapy_progress_notes$/i,            // EXACT match: therapy_progress_notes
        /^therapy.*progress.*note/i,            // therapy_progress_notes variants
        /^therapy.*progress/i,                  // therapy_progress
      ],
      component: TherapyProgressNotesDocument
    },

    // Therapy Session Notes
    {
      name: 'Therapy Session Notes',
      patterns: [
        /^therapy.*session.*note/i,          // therapy_session_notes
        /^therapy.*note/i,                   // therapy_notes
        /^session.*note/i,                   // session_notes
        /^counseling.*session.*note/i,       // counseling_session_notes
      ],
      component: TherapySessionNotesDocument
    },

    // Stress Management Referrals
    {
      name: 'Stress Management Referrals',
      patterns: [
        /^stress_management_referrals$/i,        // EXACT match: stress_management_referrals
        /^stress.*management.*referral/i,        // stress_management_referral variants
        /^stress.*referral/i,                    // stress_referrals
      ],
      component: StressManagementReferralsDocument
    },

    // Supplementation Plans
    {
      name: 'Supplementation Plans',
      patterns: [
        /^supplementation_plans$/i,
        /^supplementation.*plan/i,
        /^supplement.*plan/i,
      ],
      component: SupplementationPlansDocument
    },

    // Neurosurgery Consultations
    {
      name: 'Neurosurgery Consultations',
      patterns: [
        /^neurosurgery.*consult/i,
        /^neurosurg/i,
        /^brain.*surgery.*consult/i,
        /^neurosurgical.*consultation/i,
      ],
      component: NeurosurgeryConsultationsDocument
    },

    // Neuropsychological Assessments - MUST be before Neurological Assessment to prevent pattern collision
    {
      name: 'Neuropsychological Assessments',
      patterns: [
        /^neuropsychological_assessments$/i,    // EXACT match: neuropsychological_assessments collection
        /^neuropsychological.*assessment/i,     // neuropsychological_assessment, neuropsychological_assessments
        /^neuropsych.*assessment/i,             // neuropsych_assessment
        /^neuropsychological.*evaluation/i,     // neuropsychological_evaluation
        /^neuropsych.*evaluation/i,             // neuropsych_evaluation
        /^cognitive.*neuropsych/i,              // cognitive_neuropsych
        /^neuropsych.*testing/i,                // neuropsych_testing
      ],
      component: NeuropsychologicalAssessmentsDocument
    },

    // Neurological Assessment (NOTE: /^neuro.*exam/i removed - was incorrectly matching neurological_examination)
    {
      name: 'Neurological Assessment',
      patterns: [
        /^neurological_assessment$/i,
        /^neurological.*assessment/i,
        /^neuro_assessment$/i,                  // More specific - exact match only
      ],
      component: NeurologicalAssessmentDocument
    },
    // Movement Disorder Assessment
    {
      name: 'Movement Disorder Assessment',
      patterns: [
        /^movement_disorder_assessment$/i,
        /^movement.*disorder.*assessment/i,
        /^movement.*disorder/i,
        /^parkinson.*assessment/i,
        /^parkinsons.*assessment/i,
        /^tremor.*assessment/i,
        /^dystonia.*assessment/i,
      ],
      component: MovementDisorderAssessmentDocument
    },

    // Parkinsonian Features
    {
      name: 'Parkinsonian Features',
      patterns: [
        /^parkinsonian_features$/i,          // EXACT match: parkinsonian_features collection
        /^parkinsonian.*features/i,          // parkinsonian_features, parkinsonian_features_assessment
        /^parkinsonism.*features/i,          // parkinsonism_features
        /^cardinal.*parkinsonian/i,          // cardinal_parkinsonian_features
        /^tremor.*bradykinesia.*rigidity/i,  // tremor_bradykinesia_rigidity
      ],
      component: ParkinsonianFeaturesDocument
    },

    // Gait Analysis
    {
      name: 'Gait Analysis',
      patterns: [
        /^gait_analysis$/i,              // EXACT match: gait_analysis collection
        /^gait.*analysis/i,              // gait_analysis, gait_movement_analysis
        /^gait.*assessment/i,            // gait_assessment
        /^walking.*analysis/i,           // walking_analysis
        /^ambulation.*assessment/i,      // ambulation_assessment
      ],
      component: GaitAnalysisDocument
    },

    // Motor Complications
    {
      name: 'Motor Complications',
      patterns: [
        /^motor_complications$/i,        // EXACT match: motor_complications collection
        /^motor.*complications/i,        // motor_complications_assessment
        /^motor.*fluctuations/i,         // motor_fluctuations
        /^dyskinesia/i,                  // dyskinesia, dyskinesias
        /^levodopa.*complications/i,     // levodopa_complications
      ],
      component: MotorComplicationsDocument
    },

    // Non-Motor Symptoms
    {
      name: 'Non-Motor Symptoms',
      patterns: [
        /^non_motor_symptoms$/i,         // EXACT match: non_motor_symptoms collection
        /^non.*motor.*symptoms/i,        // non_motor_symptoms_assessment
        /^nms$/i,                        // NMS abbreviation
        /^parkinson.*non.*motor/i,       // parkinson_non_motor_symptoms
      ],
      component: NonMotorSymptomsDocument
    },

    // Parkinson Medications
    {
      name: 'Parkinson Medications',
      patterns: [
        /^parkinson_medications$/i,       // EXACT match: parkinson_medications collection
        /^parkinson.*medications/i,       // parkinson_medications, parkinson medications
        /^pd_medications$/i,              // PD abbreviation
        /^parkinsons.*meds/i,             // parkinsons_meds
        /^dopaminergic.*therapy/i,        // dopaminergic_therapy
      ],
      component: ParkinsonMedicationsDocument
    },

    // Caregiver Support
    {
      name: 'Caregiver Support',
      patterns: [
        /^caregiver_support$/i,           // EXACT match: caregiver_support collection
        /^caregiver.*support/i,           // caregiver_support, caregiver support
        /^caregiver.*burden/i,            // caregiver_burden
        /^family.*caregiver/i,            // family_caregiver
        /^caregiver.*resources/i,         // caregiver_resources
      ],
      component: CaregiverSupportDocument
    },

    // Deep Brain Stimulation
    {
      name: 'Deep Brain Stimulation',
      patterns: [
        /^deep_brain_stimulation$/i,       // EXACT match: deep_brain_stimulation collection
        /^deep.*brain.*stimulation/i,     // deep_brain_stimulation, deep brain stimulation
        /^dbs$/i,                          // DBS abbreviation
        /^dbs.*therapy/i,                  // dbs_therapy
        /^neurostimulation/i,             // neurostimulation
      ],
      component: DeepBrainStimulationDocument
    },

    // Sleep Disturbances
    {
      name: 'Sleep Disturbances',
      patterns: [
        /^sleep_disturbances$/i,           // EXACT match: sleep_disturbances collection
        /^sleep.*disturbance/i,           // sleep_disturbances, sleep disturbance
        /^sleep.*disorder/i,              // sleep_disorders
        /^rem.*sleep/i,                   // rem_sleep_behavior
        /^sleep.*behavior/i,             // sleep_behavior_disorder
      ],
      component: SleepDisturbancesDocument
    },

    // Neurology Consultations
    {
      name: 'Neurology Consultations',
      patterns: [
        /^neurology_consultations$/i,
        /^neurology.*consultation/i,
        /^neuro.*consult/i,
      ],
      component: NeurologyConsultationsDocument
    },

    // ========== NEUROVASCULAR EXAM ==========
    {
      name: 'Neurovascular Exam',
      patterns: [
        /^neurovascular_exam$/i,           // EXACT match: neurovascular_exam collection
        /^neurovascular.*exam/i,           // neurovascular_exam, neurovascular_examination
        /^neuro.*vascular/i,               // neurovascular_status, neurovascular_assessment
        /^vascular.*exam.*neuro/i,         // vascular_exam_neuro
      ],
      component: NeurovascularExamDocument
    },

    // EMG Reports
    {
      name: 'EMG Reports',
      patterns: [
        /^emg_reports$/i,                    // EXACT match: emg_reports collection
        /^emg.*report/i,                     // emg_report, emg_reports
        /^electromyography/i,                // electromyography, electromyography_report
        /^nerve.*conduction/i,               // nerve_conduction_study
        /^ncs.*report/i,                     // ncs_report, ncs_reports
        /^needle.*emg/i,                     // needle_emg
      ],
      component: EmgReportsDocument
    },

    // Peripheral Neuropathy
    {
      name: 'Peripheral Neuropathy',
      patterns: [
        /^peripheral_neuropathy$/i,          // EXACT match: peripheral_neuropathy collection
        /^peripheral.*neuropathy/i,          // peripheral_neuropathy, peripheral_neuropathy_assessment
        /^neuropathy.*peripheral/i,          // neuropathy_peripheral
        /^neuropathy$/i,                     // neuropathy
        /^nerve.*damage/i,                   // nerve_damage
        /^polyneuropathy/i,                  // polyneuropathy
      ],
      component: PeripheralNeuropathyDocument
    },

    // Complications
    {
      name: 'Complications',
      patterns: [
        /^complications$/i,                  // EXACT match: complications collection
        /^complication/i,                    // complication, complications
        /^surgical.*complication/i,          // surgical_complications
        /^post.*operative.*complication/i,   // post_operative_complications
        /^intraoperative.*complication/i,    // intraoperative_complications
        /^adverse.*event/i,                  // adverse_events
      ],
      component: ComplicationsDocument
    },

    // Consultation Requests
    {
      name: 'Consultation Requests',
      patterns: [
        /^consultation_requests$/i,          // EXACT match
        /^consultation.*request/i,           // consultation_requests, consultation request
        /^consult.*request/i,                // consult_requests
        /^referral.*request/i,               // referral_requests
        /^specialist.*request/i,             // specialist_requests
      ],
      component: ConsultationRequestsDocument
    },

    // Disease Severity
    {
      name: 'Disease Severity',
      patterns: [
        /^disease_severity$/i,               // EXACT match
        /^disease.*severity/i,               // disease_severity
        /^severity.*assessment/i,            // severity_assessment
        /^disease.*grade/i,                  // disease_grade
        /^severity.*score/i,                 // severity_score
        /^illness.*severity/i,               // illness_severity
      ],
      component: DiseaseSeverityDocument
    },

    // Hematology Assessment
    {
      name: 'Hematology Assessment',
      patterns: [
        /^hematology_assessment$/i,           // EXACT match
        /^hematology.*assessment/i,           // hematology_assessment
        /^hematology.*evaluation/i,           // hematology_evaluation
        /^blood.*disorder.*assessment/i,      // blood_disorder_assessment
        /^hematologic.*assessment/i,          // hematologic_assessment
        /^heme.*assessment/i,                 // heme_assessment
      ],
      component: HematologyAssessmentDocument
    },

    // Myeloma Specific Data
    {
      name: 'Myeloma Specific Data',
      patterns: [
        /^myeloma_specific_data$/i,           // EXACT match
        /^myeloma.*specific/i,                // myeloma_specific
        /^myeloma.*data/i,                    // myeloma_data
        /^multiple.*myeloma/i,                // multiple_myeloma
        /^plasma.*cell.*myeloma/i,            // plasma_cell_myeloma
      ],
      component: MyelomaSpecificDataDocument
    },

    // Bleeding Risk Assessment
    {
      name: 'Bleeding Risk Assessment',
      patterns: [
        /^bleeding_risk_assessment$/i,
      ],
      component: BleedingRiskAssessmentDocument
    },

    // Stem Cell Transplant Assessment (dedicated — must precede generic Transplant Assessment)
    {
      name: 'Stem Cell Transplant Assessment',
      patterns: [
        /^stem_cell_transplant_assessment$/i,  // EXACT match
        /^stem[_\s]?cell[_\s]?transplant[_\s]?assessment/i,
      ],
      component: StemCellTransplantAssessmentDocument
    },

    // Transplant Assessment
    {
      name: 'Transplant Assessment',
      patterns: [
        /^transplant_assessment$/i,           // EXACT match
        /^transplant.*assessment/i,           // transplant_assessment
        /^stem.*cell.*transplant/i,           // stem_cell_transplant (other variants; exact stem_cell_transplant_assessment handled above)
        /^hematopoietic.*transplant/i,        // hematopoietic_transplant
        /^bone.*marrow.*transplant/i,         // bone_marrow_transplant
        /^autologous.*transplant/i,           // autologous_transplant
        /^allogeneic.*transplant/i,           // allogeneic_transplant
      ],
      component: TransplantAssessmentDocument
    },

    // Prophylactic Medications
    {
      name: 'Prophylactic Medications',
      patterns: [
        /^prophylactic_medications$/i,         // EXACT match
        /^prophylactic.*medication/i,          // prophylactic_medications
        /^preventive.*medication/i,            // preventive_medications
        /^prophylaxis.*medication/i,           // prophylaxis_medications
        /^antimicrobial.*prophylaxis/i,        // antimicrobial_prophylaxis
      ],
      component: ProphylacticMedicationsDocument
    },

    // Neurosurgery Consultations
    {
      name: 'Neurosurgery Consultations',
      patterns: [
        /^neurosurgery_consultations$/i,
        /^neurosurgery.*consultation/i,
        /^neurosurg.*consult/i,
      ],
      component: NeurosurgeryConsultationsDocument
    },

    // Sports Medicine Evaluations (MUST be BEFORE Orthopedic Consultations to avoid /^sports.*medicine/i catch)
    {
      name: 'Sports Medicine Evaluations',
      patterns: [
        /^sports_medicine_evaluations$/i,     // EXACT: sports_medicine_evaluations
        /^sports.*medicine.*evaluation/i,     // sports_medicine_evaluation
      ],
      component: SportsMedicineEvaluationsDocument
    },

    // ========== ORTHOPEDIC FOLLOW-UP NOTES ==========
    {
      name: 'Orthopedic Follow-Up Notes',
      patterns: [
        /^orthopedic_followup_notes$/i,       // EXACT match
        /^orthopedic.*follow.*up.*note/i,     // orthopedic follow-up notes
        /^ortho.*followup/i,                  // ortho followup
      ],
      component: OrthopedicFollowupNotesDocument
    },

    // ========== ARTICULAR CARTILAGE ==========
    {
      name: 'Articular Cartilage',
      patterns: [
        /^articular_cartilage$/i,             // EXACT match
        /^articular.*cartilage/i,             // articular cartilage
        /^cartilage.*assessment/i,            // cartilage assessment
        /^chondral/i,                         // chondral
      ],
      component: ArticularCartilageDocument
    },

    // ========== RETURN TO PLAY PROTOCOL ==========
    {
      name: 'Return To Play Protocol',
      patterns: [
        /^return_to_play_protocol$/i,         // EXACT match
        /^return.*play.*protocol/i,           // return to play protocol
        /^return.*play/i,                     // return to play
        /^return.*sport/i,                    // return to sport
      ],
      component: ReturnToPlayProtocolDocument
    },

    // ========== ATHLETIC INJURY ASSESSMENT ==========
    {
      name: 'Athletic Injury Assessment',
      patterns: [
        /^athletic_injury_assessment$/i,      // EXACT match
        /^athletic.*injury/i,                 // athletic injury
        /^sports.*injury.*assessment/i,       // sports injury assessment
      ],
      component: AthleticInjuryAssessmentDocument
    },

    // ========== SPORTS NUTRITION PLAN ==========
    {
      name: 'Sports Nutrition Plan',
      patterns: [
        /^sports_nutrition_plan$/i,           // EXACT match
        /^sports.*nutrition/i,                // sports nutrition
        /^athlete.*nutrition/i,               // athlete nutrition
      ],
      component: SportsNutritionPlanDocument
    },

    // ========== OVERTRAINING ASSESSMENT ==========
    {
      name: 'Overtraining Assessment',
      patterns: [
        /^overtraining_assessment$/i,         // EXACT match
        /^overtraining/i,                     // overtraining
        /^overreaching/i,                     // overreaching
        /^training.*fatigue.*assessment/i,    // training fatigue
      ],
      component: OvertrainingAssessmentDocument
    },

    // Sports Physical Examination
    {
      name: 'Sports Physical Examination',
      patterns: [
        /^sports_physical_examination$/i,     // EXACT: sports_physical_examination
        /^sports.*physical.*exam/i,           // sports_physical_exam
        /^sports.*physic/i,                   // sports_physical
        /^pre.*participation.*exam/i,         // pre_participation_exam
        /^pre.*participation.*physical/i,     // pre_participation_physical
      ],
      component: SportsPhysicalExaminationDocument
    },

    // Orthopedic Consultations
    {
      name: 'Orthopedic Consultations',
      patterns: [
        /^orthopedic_consultations$/i,
        /^orthopedic.*consultation/i,
        /^orthopaedic.*consultation/i,
        /^orthopedic$/i,
        /^musculoskeletal.*consultation/i,
        /^joint.*consultation/i,
        /^fracture.*consultation/i,
        /^bone.*consultation/i,
        /^sports.*injury/i,
        /^sports.*medicine/i,
      ],
      component: OrthopedicConsultationsDocument
    },

    // Pain Management Notes
    {
      name: 'Pain Management Notes',
      patterns: [
        /^pain_management_notes$/i,          // Exact match
        /^pain.*management.*note/i,           // pain_management_notes
        /^pain.*note/i,                       // pain_notes
        /^pain.*clinic.*note/i,               // pain_clinic_notes
        /^chronic.*pain.*note/i,              // chronic_pain_notes
        /^acute.*pain.*note/i,                // acute_pain_notes
        /^pain.*assessment.*note/i,           // pain_assessment_notes
        /^pain.*evaluation/i,                 // pain_evaluation
        /^interventional.*pain.*note/i,       // interventional_pain_notes
        /^pain.*procedure.*note/i,            // pain_procedure_notes
        /^nerve.*block.*note/i,               // nerve_block_notes
        /^epidural.*note/i,                   // epidural_notes
        /^pain.*medicine.*note/i,             // pain_medicine_notes
      ],
      component: PainManagementNotesDocument
    },

    // Appetite Stimulants
    {
      name: 'Appetite Stimulants',
      patterns: [
        /^appetite_stimulants$/i,              // Exact match
        /^appetite.*stimulant/i,               // appetite_stimulants
        /^appetite.*enhancement/i,             // appetite_enhancement
        /^appetite.*support/i,                 // appetite_support
        /^orexigenic/i,                        // orexigenic agents
        /^appetite.*medication/i,              // appetite_medications
        /^appetite.*therapy/i,                 // appetite_therapy
      ],
      component: AppetiteStimulantsDocument
    },

    // PRN Medications
    {
      name: 'PRN Medications',
      patterns: [
        /^prn_medications$/i,                 // Exact match
        /^prn.*medication/i,                  // prn_medications
        /^as.*needed.*medication/i,           // as_needed_medications
        /^pro.*re.*nata.*medication/i,        // pro_re_nata_medications
      ],
      component: PrnMedicationsDocument
    },

    // Nursing Notes
    {
      name: 'Nursing Notes',
      patterns: [
        /^nursing_notes$/i,                   // Exact match
        /^nursing.*note/i,                    // nursing_notes, nursing_note
        /^nurse.*note/i,                      // nurse_notes
        /^RN.*note/i,                         // RN_notes
        /^nursing.*documentation/i,           // nursing_documentation
        /^nursing.*record/i,                  // nursing_record
        /^nursing.*report/i,                  // nursing_report
        /^shift.*nursing/i,                   // shift_nursing_notes
      ],
      component: NursingNotesDocument
    },

    // Nurse Signatures
    {
      name: 'Nurse Signatures',
      patterns: [
        /^nurse_signatures$/i,                // Exact match
        /^nurse.*signature/i,                 // nurse_signatures, nurse_signature
        /^nursing.*signature/i,               // nursing_signatures
        /^RN.*signature/i,                    // RN_signatures
        /^nurse.*sign.*off/i,                 // nurse_sign_off
        /^shift.*signature/i,                 // shift_signatures
        /^nursing.*sign.*off/i,               // nursing_sign_off
      ],
      component: NurseSignaturesDocument
    },

    // Physical Examinations
    {
      name: 'Physical Examinations',
      patterns: [
        /^physical_examinations$/i,           // Exact match
        /^physical.*examination/i,            // physical_examination, physical_examinations
        /^physical.*exam/i,                   // physical_exam, physical_exams
        /^physical$/i,                        // physical
        /^general.*physical/i,                // general_physical
        /^general.*exam/i,                    // general_exam, general_examination
        /^annual.*physical/i,                 // annual_physical
        /^annual.*exam/i,                     // annual_exam
        /^wellness.*exam/i,                   // wellness_exam
        /^wellness.*visit/i,                  // wellness_visit
        /^routine.*exam/i,                    // routine_exam
        /^routine.*physical/i,                // routine_physical
        /^complete.*physical/i,               // complete_physical
        /^comprehensive.*physical/i,          // comprehensive_physical
      ],
      component: PhysicalExaminationsDocument
    },

    // Blood Products Ordered
    {
      name: 'Blood Products Ordered',
      patterns: [
        /^blood_products_ordered$/i,           // Exact match
        /^blood.*products.*ordered/i,          // blood_products_ordered
        /^blood.*products/i,                   // blood_products
        /^blood.*transfusion/i,                // blood_transfusion
        /^transfusion.*order/i,                // transfusion_order
        /^prbc/i,                              // packed red blood cells
        /^packed.*red.*blood/i,                // packed red blood cells
        /^fresh.*frozen.*plasma/i,             // FFP
        /^ffp$/i,                              // FFP
        /^platelet.*order/i,                   // platelet order
        /^platelet.*transfusion/i,             // platelet transfusion
        /^cryoprecipitate/i,                   // cryoprecipitate
        /^blood.*bank.*order/i,                // blood bank order
        /^crossmatch/i,                        // crossmatch
        /^type.*and.*screen/i,                 // type and screen
        /^massive.*transfusion/i,              // massive transfusion protocol
      ],
      component: BloodProductsOrderedDocument
    },

    // Estimated Blood Loss
    {
      name: 'Estimated Blood Loss',
      patterns: [
        /^estimated_blood_loss$/i,             // EXACT match
        /^estimated.*blood.*loss/i,            // estimated_blood_loss variations
        /^ebl$/i,                              // EBL abbreviation
        /^blood.*loss$/i,                      // blood loss
        /^surgical.*blood.*loss/i,             // surgical blood loss
        /^intraoperative.*blood.*loss/i,       // intraoperative blood loss
        /^operative.*blood.*loss/i,            // operative blood loss
      ],
      component: EstimatedBloodLossDocument
    },

    // Postoperative Condition
    {
      name: 'Postoperative Condition',
      patterns: [
        /^postoperative_condition$/i,          // EXACT match
        /^postoperative.*condition/i,          // postoperative_condition variations
        /^postop.*condition/i,                 // postop condition
        /^post.*op.*condition/i,               // post_op_condition
        /^condition.*postoperative/i,          // condition_postoperative
        /^recovery.*status/i,                  // recovery status
        /^pacu.*status/i,                      // PACU status
      ],
      component: PostoperativeConditionDocument
    },

    // Glaucoma Assessments
    {
      name: 'Glaucoma Assessments',
      patterns: [
        /^glaucoma_assessments$/i,              // EXACT match
        /^glaucoma.*assessment/i,               // glaucoma assessment
        /^glaucoma.*eval/i,                     // glaucoma evaluation
        /^iop.*assessment/i,                    // IOP assessment
        /^intraocular.*pressure/i,              // intraocular pressure
        /^optic.*nerve.*assessment/i,           // optic nerve assessment
        /^visual.*field.*test/i,                // visual field test
        /^gonioscopy/i,                         // gonioscopy
        /^cup.*disc.*ratio/i,                   // cup to disc ratio
      ],
      component: GlaucomaAssessmentsDocument
    },

    // Ophthalmology Examinations
    {
      name: 'Ophthalmology Examinations',
      patterns: [
        /^ophthalmology_examinations$/i,        // Exact match
        /^ophthalmology.*examination/i,         // ophthalmology examination
        /^eye.*examination/i,                   // eye examination
        /^comprehensive.*eye/i,                 // comprehensive eye
        /^ophthalmic.*exam/i,                   // ophthalmic exam
      ],
      component: OphthalmologyExaminationsDocument
    },
    // Optometry Examination
    {
      name: 'Optometry Examination',
      patterns: [
        /^optometry_examination$/i,             // Exact match
        /^optometry.*exam/i,                    // optometry exam
        /^optometric.*exam/i,                   // optometric exam
        /^optometry.*assessment/i,              // optometry assessment
        /^comprehensive.*optometry/i,           // comprehensive optometry
      ],
      component: OptometryExaminationDocument
    },


    // Vision Therapy Assessment
    {
      name: 'Vision Therapy Assessment',
      patterns: [
        /^vision_therapy_assessment$/i,         // Exact match
        /^vision.*therapy.*assessment/i,        // vision therapy assessment
        /^vision.*therapy/i,                    // vision therapy
      ],
      component: VisionTherapyAssessmentDocument
    },

    // Low Vision Evaluation
    {
      name: 'Low Vision Evaluation',
      patterns: [
        /^low_vision_evaluation$/i,
        /^low.*vision.*evaluation/i,
        /^low.*vision/i,
      ],
      component: LowVisionEvaluationDocument
    },

    // Contact Lens Fitting
    {
      name: 'Contact Lens Fitting',
      patterns: [
        /^contact_lens_fitting$/i,
        /^contact.*lens.*fitting/i,
        /^contact.*lens/i,
      ],
      component: ContactLensFittingDocument
    },

    // Retinal Examinations
    {
      name: 'Retinal Examinations',
      patterns: [
        /^retinal_examinations$/i,              // Exact match
        /^retinal.*examination/i,               // retinal examination
        /^fundus.*examination/i,                // fundus examination
        /^dilated.*fundus/i,                    // dilated fundus exam
        /^retina.*exam/i,                       // retina exam
        /^diabetic.*retinopathy/i,              // diabetic retinopathy
        /^macular.*edema/i,                     // macular edema
        /^oct.*angiography/i,                   // OCT angiography
        /^fluorescein.*angiography/i,           // fluorescein angiography
      ],
      component: RetinalExaminationsDocument
    },

    // Visual Acuity Reports
    {
      name: 'Visual Acuity Reports',
      patterns: [
        /^visual_acuity_reports$/i,             // Exact match
        /^visual.*acuity/i,                     // visual acuity
        /^snellen.*test/i,                      // snellen test
        /^snellen.*chart/i,                     // snellen chart
        /^vision.*test/i,                       // vision test
        /^acuity.*test/i,                       // acuity test
        /^distance.*vision/i,                   // distance vision
        /^near.*vision/i,                       // near vision
        /^corrected.*vision/i,                  // corrected vision
        /^uncorrected.*vision/i,                // uncorrected vision
      ],
      component: VisualAcuityReportsDocument
    },

    // Past Ocular History
    {
      name: 'Past Ocular History',
      patterns: [
        /^past_ocular_history$/i,              // Exact match
        /^past.*ocular.*history/i,             // past ocular history
        /^ocular.*history/i,                   // ocular history
        /^eye.*history/i,                      // eye history
        /^ophthalmic.*history/i,               // ophthalmic history
        /^prior.*eye.*condition/i,             // prior eye conditions
        /^previous.*eye/i,                     // previous eye
        /^dilated.*exam/i,                     // dilated exam
        /^glasses.*contact.*lens/i,            // glasses contact lens wear
        /^refractive.*error/i,                 // refractive error
        /^prior.*eye.*surgery/i,               // prior eye surgery
        /^eye.*trauma/i,                       // eye trauma
      ],
      component: PastOcularHistoryDocument
    },

    // Ophthalmology Exam - Comprehensive eye examination data
    {
      name: 'Ophthalmology Exam',
      patterns: [
        /^ophthalmology_exam$/i,                // Exact match
        /^ophthalmology.*exam$/i,               // ophthalmology exam
        /^comprehensive.*eye.*exam/i,           // comprehensive eye exam
        /^eye.*exam.*comprehensive/i,           // eye exam comprehensive
        /^visual.*acuity.*refraction/i,         // visual acuity refraction
        /^slit.*lamp.*fundoscopy/i,             // slit lamp fundoscopy
        /^oct.*rnfl/i,                          // OCT RNFL
        /^pupil.*motility/i,                    // pupil motility
        /^gonioscopy.*iop/i,                    // gonioscopy IOP
      ],
      component: OphthalmologyExamDocument
    },

    // Glaucoma Management - Treatment and monitoring plans
    {
      name: 'Glaucoma Management',
      patterns: [
        /^glaucoma_management$/i,               // Exact match
        /^glaucoma.*management/i,               // glaucoma management
        /^glaucoma.*treatment/i,                // glaucoma treatment
        /^glaucoma.*plan/i,                     // glaucoma plan
        /^glaucoma.*therapy/i,                  // glaucoma therapy
        /^iop.*management/i,                    // IOP management
        /^iop.*treatment/i,                     // IOP treatment
        /^iop.*target/i,                        // IOP target
      ],
      component: GlaucomaManagementDocument
    },

    // Venous Thromboembolism Risk (June 2026 — risk-scoring schema: Caprini, Wells, Padua;
    // MUST precede DVT Prophylaxis whose venous-thromboembolism pattern would otherwise catch it)
    {
      name: 'Venous Thromboembolism Risk',
      patterns: [
        /^venous_thromboembolism_risk$/i,      // EXACT match for the venous_thromboembolism_risk collection
      ],
      component: VenousThromboembolismRiskDocument
    },

    // Performance Assessment (June 2026 — sports performance testing: VO2 max, isokinetic strength, return-to-play)
    {
      name: 'Performance Assessment',
      patterns: [
        /^performance_assessment$/i,           // EXACT match (Performance Status is the separate oncology ECOG collection)
      ],
      component: PerformanceAssessmentDocument
    },

    // Document Type (June 2026 — document_type collection: document subtype, ICD-10 and CPT coding, quality compliance)
    {
      name: 'Document Type',
      patterns: [
        /^document_type$/i,                    // EXACT match for the document_type collection
      ],
      component: DocumentTypeDocument
    },
    // DVT Prophylaxis
    {
      name: 'DVT Prophylaxis',
      patterns: [
        /^dvt_prophylaxis$/i,                  // Exact match
        /^dvt.*prophylaxis/i,                  // dvt prophylaxis
        /^dvt.*prevention/i,                   // dvt prevention
        /^vte.*prophylaxis/i,                  // vte prophylaxis
        /^vte.*prevention/i,                   // vte prevention
        /^venous.*thromboembolism/i,           // venous thromboembolism
        /^thromboprophylaxis/i,                // thromboprophylaxis
        /^anticoagulation.*prophylaxis/i,      // anticoagulation prophylaxis
        /^mechanical.*prophylaxis/i,           // mechanical prophylaxis
        /^sequential.*compression/i,           // sequential compression devices
        /^scd.*order/i,                        // SCD orders
      ],
      component: DvtProphylaxisDocument
    },

    // ========== MORTALITY RISK ASSESSMENT ==========
    {
      name: 'Mortality Risk Assessment',
      patterns: [
        /^mortality_risk_assessment$/i,          // EXACT: mortality_risk_assessment
      ],
      component: MortalityRiskAssessmentDocument
    },
    // Clinical Risk Scores - DISTINCT from clinical_scores
    // Detailed risk assessments with predicted mortality/morbidity, component scores, clinical context
    {
      name: 'Clinical Risk Scores',
      patterns: [
        /^clinical_risk_scores$/i,              // Exact match
        /^clinical.*risk.*score/i,              // clinical risk scores
        /^risk.*score.*assessment/i,            // risk score assessment
        /^apache.*ii/i,                         // APACHE II score
        /^apache.*score/i,                      // APACHE score
        /^sofa.*score/i,                        // SOFA score
        /^sequential.*organ.*failure/i,         // Sequential organ failure
        /^meld.*score/i,                        // MELD score
        /^child.*pugh/i,                        // Child-Pugh score
        /^predicted.*mortality/i,               // Predicted mortality
        /^predicted.*morbidity/i,               // Predicted morbidity
        /^mortality.*prediction/i,              // Mortality prediction
        /^organ.*failure.*assessment/i,         // Organ failure assessment
        /^icu.*risk.*assessment/i,              // ICU risk assessment
      ],
      component: ClinicalRiskScoresDocument
    },

    // Brain Tumor Characteristics
    {
      name: 'Brain Tumor Characteristics',
      patterns: [
        /^brain.*tumor.*character/i,
        /^tumor.*character/i,
        /^glioma.*character/i,
        /^brain.*lesion/i,
      ],
      component: BrainTumorCharacteristicsDocument
    },

    // Brain Tumor Molecular Markers
    {
      name: 'Brain Tumor Molecular Markers',
      patterns: [
        /^brain_tumor_molecular_markers$/i,  // Exact match
        /^brain.*tumor.*molecular/i,          // brain_tumor_molecular_markers
        /^molecular.*markers/i,               // molecular_markers
        /^idh.*mgmt/i,                        // IDH_MGMT (molecular profiling)
        /^mgmt.*methylation/i,                // MGMT methylation test
        /^1p.*19q/i,                          // 1p/19q codeletion
        /^tumor.*profil/i,                    // Tumor profiling
      ],
      component: BrainTumorMolecularMarkersDocument
    },

    // ========== GASTROENTEROLOGY ==========

    // Gastroenterology Consultations
    {
      name: 'Gastroenterology Consultations',
      patterns: [
        /^gastroenterology_consultations$/i,       // EXACT: gastroenterology_consultations
        /^gastroenterology.*consult/i,             // gastroenterology_consultation variations
        /^gastro.*consult/i,                       // gastro_consultation
        /^gi.*consult/i,                           // gi_consultation
        /^gastrointestinal.*consult/i,             // gastrointestinal_consultation
      ],
      component: GastroenterologyConsultationsDocument
    },

    // IBD Assessment (December 2025)
    {
      name: 'IBD Assessment',
      patterns: [
        /^ibd_assessment$/i,                   // EXACT: ibd_assessment
        /^ibd.*assessment$/i,                  // ibd_assessment_results
        /^inflammatory.*bowel.*assessment$/i,  // inflammatory_bowel_assessment
      ],
      component: IbdAssessmentDocument
    },
    // Inflammatory Bowel Reports (December 2025)
    {
      name: 'Inflammatory Bowel Reports',
      patterns: [
        /^inflammatory_bowel_reports$/i,       // EXACT: inflammatory_bowel_reports
        /^inflammatory.*bowel.*report/i,       // inflammatory_bowel_reports_summary
        /^ibd.*report/i,                       // ibd_reports
        /^crohn.*report/i,                     // crohns_disease_report
        /^ulcerative.*colitis.*report/i,       // ulcerative_colitis_report
      ],
      component: InflammatoryBowelReportsDocument
    },
    // Disease Activity Scores (February 2026)
    {
      name: 'Disease Activity Scores',
      patterns: [
        /^disease_activity_scores$/i,            // EXACT: disease_activity_scores
        /^disease.*activity.*score/i,            // disease_activity_score
        /^activity.*score/i,                     // activity_scores
        /^mayo.*score/i,                         // mayo_score, mayo_scores
        /^harvey.*bradshaw/i,                    // harvey_bradshaw, harvey_bshaw_index
        /^cdai$/i,                               // CDAI (Crohn's Disease Activity Index)
        /^sccai$/i,                              // SCCAI (Simple Clinical Colitis Activity Index)
        /^pucai$/i,                              // PUCAI (Pediatric Ulcerative Colitis Activity Index)
        /^clinical.*activity.*index/i,           // clinical_activity_indices
      ],
      component: DiseaseActivityScoresDocument
    },
    // Insurance Forms (December 2025)
    {
      name: 'Insurance Forms',
      patterns: [
        /^insurance_forms$/i,                    // EXACT: insurance_forms
        /^insurance.*form/i,                     // insurance_forms, insurance_form
        /^insurance.*analysis/i,                 // insurance_analysis
        /^insurance.*optimization/i,             // insurance_optimization
        /^coverage.*analysis/i,                  // coverage_analysis
      ],
      component: InsuranceFormsDocument
    },
    // Care Coordination Notes (December 2025)
    {
      name: 'Care Coordination Notes',
      patterns: [
        /^care_coordination_notes$/i,            // EXACT: care_coordination_notes
        /^care.*coordination.*note/i,            // care_coordination_notes, care_coordination_note
        /^coordination.*note/i,                  // coordination_notes
        /^social.*work.*coordination/i,          // social_work_coordination
      ],
      component: CareCoordinationNotesDocument
    },
    // Rheumatologic Treatment (December 2025)
    {
      name: 'Rheumatologic Treatment',
      patterns: [
        /^rheumatologic_treatment$/i,             // EXACT: rheumatologic_treatment
        /^rheumatologic.*treatment/i,             // rheumatologic_treatment, rheumatologic_treatments
        /^rheumat.*treatment/i,                   // rheumat_treatment
        /^dmard.*treatment/i,                     // dmard_treatment
        /^biologic.*treatment/i,                  // biologic_treatment
        /^rheumatology.*medication/i,             // rheumatology_medications
      ],
      component: RheumatologicTreatmentDocument
    },
    // Endoscopy Findings (December 2025)
    {
      name: 'Endoscopy Findings',
      patterns: [
        /^endoscopy_findings$/i,               // EXACT: endoscopy_findings
        /^endoscopy.*finding/i,                // endoscopy_findings_report
        /^colonoscopy.*finding/i,              // colonoscopy_findings
        /^sigmoidoscopy.*finding/i,            // sigmoidoscopy_findings
        /^upper.*endoscopy.*finding/i,         // upper_endoscopy_findings
        /^egd.*finding/i,                      // egd_findings
      ],
      component: EndoscopyFindingsDocument
    },
    // IV Infusions (June 2026 — own schema; MUST precede Infusion Therapy whose iv-infusion pattern would otherwise catch it)
    {
      name: 'IV Infusions',
      patterns: [
        /^iv_infusions$/i,                 // EXACT match for the iv_infusions collection
      ],
      component: IvInfusionsDocument
    },
    // Infusion Therapy (December 2025)
    {
      name: 'Infusion Therapy',
      patterns: [
        /^infusion_therapy$/i,                 // EXACT: infusion_therapy
        /^infusion.*therapy/i,                 // infusion_therapy_records
        /^iv.*infusion/i,                      // iv_infusion_records
        /^biologic.*infusion/i,                // biologic_infusion
        /^chemotherapy.*infusion/i,            // chemotherapy_infusion
      ],
      component: InfusionTherapyDocument
    },
    // Medication Changes Discontinued (February 2026) - MUST be BEFORE Medication Changes Dose
    {
      name: 'Medication Changes Discontinued',
      patterns: [
        /^medication_changes_discontinued$/i,  // EXACT: medication_changes_discontinued
        /^medication.*discontinued/i,          // medication_discontinued variations
        /^discontinued.*medication/i,          // discontinued_medications
        /^medication.*discontinuation/i,       // medication_discontinuation
      ],
      component: MedicationChangesDiscontinuedDocument
    },

    // Medication Changes - New (February 2026)
    {
      name: 'Medication Changes New',
      patterns: [
        /^medication_changes_new$/i,            // EXACT: medication_changes_new
        /^medication.*changes.*new/i,           // medication_changes_new variations
        /^new.*medication.*change/i,            // new_medication_changes
      ],
      component: MedicationChangesNewDocument
    },

    // Blood Disorder Reports (February 2026)
    {
      name: 'Blood Disorder Reports',
      patterns: [
        /^blood_disorder_reports$/i,           // EXACT: blood_disorder_reports
        /^blood.*disorder/i,                   // blood_disorder variations
        /^hematology.*disorder/i,              // hematology_disorders
        /^blood.*disorders/i,                  // blood_disorders
      ],
      component: BloodDisorderReportsDocument
    },

    // Social Support (February 2026)
    {
      name: 'Social Support',
      patterns: [
        /^social_support$/i,                   // EXACT: social_support
        /^social.*support/i,                   // social_support variations
        /^support.*system/i,                   // support_system
      ],
      component: SocialSupportDocument
    },

    // Medication Changes & Dose (December 2025)
    {
      name: 'Medication Changes & Dose',
      patterns: [
        /^medication_changes_dose$/i,          // EXACT: medication_changes_dose
        /^medication.*changes.*dose/i,         // medication_changes_dose_records
        /^dose.*change/i,                      // dose_changes
        /^medication.*adjustment/i,            // medication_adjustments
        /^dosage.*modification/i,              // dosage_modifications
        /^drug.*dose.*change/i,                // drug_dose_changes
      ],
      component: MedicationChangesDoseDocument
    },

    // Mental Health Resources
    {
      name: 'Mental Health Resources',
      patterns: [
        /^mental_health_resources$/i,          // mental_health_resources (exact match)
        /^mental.*health.*resource/i,          // mental_health_resources
        /^mental.*resource/i,                  // mental_resources
        /^psych.*resource/i,                   // psychiatric_resources
        /^behavioral.*health.*resource/i,      // behavioral_health_resources
        /^counseling.*resource/i,              // counseling_resources
      ],
      component: MentalHealthResourcesDocument
    },

    // IBD Consultation Details
    {
      name: 'IBD Consultation Details',
      patterns: [
        /^ibd.*consult.*detail/i,              // ibd_consultation_details (primary)
        /^ibd.*detail/i,                       // ibd_details
        /^inflammatory.*bowel.*consult/i,      // inflammatory_bowel_consultation
        /^crohn.*consult/i,                    // crohns_consultation
        /^ulcerative.*colitis.*consult/i,      // ulcerative_colitis_consultation
      ],
      component: IbdConsultationDetailsDocument
    },
    // Mayo Score (IBD Disease Activity)
    {
      name: 'Mayo Score',
      patterns: [
        /^mayo_score$/i,                       // mayo_score (exact)
        /^mayo.*score/i,                       // mayo_score, mayo_scores
        /^ulcerative.*colitis.*score/i,        // ulcerative_colitis_score
        /^uc.*score/i,                         // uc_score
        /^disease.*activity.*score/i,          // disease_activity_score
        /^ibd.*score/i,                        // ibd_score
      ],
      component: MayoScoreDocument
    },
    // Infliximab Drug Monitoring (IBD Biologic Therapy)
    {
      name: 'Infliximab Drug Monitoring',
      patterns: [
        /^infliximab_drug_monitoring$/i,       // EXACT: infliximab_drug_monitoring
        /^infliximab.*monitoring/i,            // infliximab_monitoring, infliximab_level_monitoring
        /^infliximab.*level/i,                 // infliximab_levels, infliximab_level_test
        /^remicade.*monitoring/i,              // remicade_monitoring (brand name)
        /^remicade.*level/i,                   // remicade_levels
        /^biologic.*drug.*monitoring/i,        // biologic_drug_monitoring
        /^anti.*tnf.*monitoring/i,             // anti_tnf_monitoring
        /^trough.*level.*monitoring/i,         // trough_level_monitoring
      ],
      component: InfliximabDrugMonitoringDocument
    },
    // Fecal Calprotectin (IBD Inflammation Biomarker)
    {
      name: 'Fecal Calprotectin',
      patterns: [
        /^fecal_calprotectin$/i,               // EXACT: fecal_calprotectin
        /^fecal.*calprotectin/i,               // fecal_calprotectin_results
        /^calprotectin.*test/i,                // calprotectin_test
        /^stool.*calprotectin/i,               // stool_calprotectin
        /^faecal.*calprotectin/i,              // faecal_calprotectin (UK spelling)
        /^fc.*test/i,                          // fc_test (abbreviation)
        /^inflammation.*marker.*stool/i,       // inflammation_marker_stool
      ],
      component: FecalCalprotectinDocument
    },

    // Rescue Therapy Options
    {
      name: 'Rescue Therapy Options',
      patterns: [
        /^rescue_therapy_options$/i,           // EXACT: rescue_therapy_options
        /^rescue.*therapy/i,                   // rescue_therapy, rescue_therapy_plan
        /^therapy.*rescue/i,                   // therapy_rescue_options
        /^alternative.*therapy.*options/i,     // alternative_therapy_options
        /^salvage.*therapy/i,                  // salvage_therapy_options
        /^second.*line.*therapy/i,             // second_line_therapy
        /^backup.*treatment/i,                 // backup_treatment_options
      ],
      component: RescueTherapyOptionsDocument
    },

    // ========== RISK ASSESSMENTS ==========

    // GI Risk Assessment (Comprehensive 7-Category)
    {
      name: 'GI Risk Assessment',
      patterns: [
        /^gi.*risk.*assessment/i,          // gi_risk_assessment (NEW - comprehensive 7 categories)
        /^gastrointestinal.*risk/i,        // gastrointestinal_risk_assessment
        /^gi.*bleeding.*risk/i,            // gi_bleeding_risk_assessment (LEGACY - backwards compat)
        /^gastrointestinal.*bleeding.*risk/i, // gastrointestinal_bleeding_risk
        /^gi.*bleed.*risk/i,               // gi_bleed_risk_assessment
        /^upper.*gi.*bleed/i,              // upper_gi_bleeding_risk
        /^lower.*gi.*bleed/i,              // lower_gi_bleeding_risk
      ],
      component: GIRiskAssessmentDocument
    },

    // Malnutrition Risk Assessment
    {
      name: 'Malnutrition Risk Assessment',
      patterns: [
        /^malnutrition_risk_assessment$/i,  // Exact match
        /^malnutrition.*risk/i,             // malnutrition_risk
        /^malnutrition.*assess/i,           // malnutrition_assessment
        /^nutrition.*risk.*assess/i,        // nutrition_risk_assessment
        /^malnutrition.*screen/i,           // malnutrition_screening
      ],
      component: MalnutritionRiskAssessmentDocument
    },

    // Risk Factors (General)
    {
      name: 'Risk Factors',
      patterns: [
        /^risk_factors?$/i,                // EXACT: risk_factors, risk_factor
        /^riskfactors?$/i,                 // riskfactors, riskfactor
        /^patient.*risk/i,                 // patient_risk_factors
        /^health.*risk/i,                  // health_risk_factors
        /^clinical.*risk/i,                // clinical_risk_factors
      ],
      component: RiskFactorsDocument
    },
    {
      name: 'Medication Reconciliation',
      patterns: [
        /^medication_reconciliation$/i,     // EXACT: medication_reconciliation
        /^medicationreconciliation$/i,      // medicationreconciliation
        /^med_rec$/i,                       // med_rec
        /^medrec$/i,                        // medrec
        /^medication.*reconcil/i,           // medication_reconciliation_records
        /^med(?:ication)?[_\s]?reconcil/i,  // med_reconciliation (NOT medical_reconciliation)
      ],
      component: MedicationReconciliationDocument
    },

    // Recommendations
    {
      name: 'Recommendations',
      patterns: [
        /^recommendations?$/i,             // EXACT: recommendations, recommendation
        /^medical.*recommendation/i,       // medical_recommendations
        /^clinical.*recommendation/i,      // clinical_recommendations
        /^treatment.*recommendation/i,     // treatment_recommendations
        /^therapy.*recommendation/i,       // therapy_recommendations
      ],
      component: RecommendationsDocument
    },

    // Referrals
    {
      name: 'Referrals',
      patterns: [
        /^referrals?$/i,                   // EXACT: referrals, referral
        /^specialist.*referral/i,          // specialist_referrals
        /^provider.*referral/i,            // provider_referrals
        /^consultation.*referral/i,        // consultation_referrals
      ],
      component: ReferralsDocument
    },

    // Referrals Placed
    {
      name: 'Referrals Placed',
      patterns: [
        /^referrals?[_-]?placed$/i,        // referrals_placed, referral_placed
        /^placed.*referral/i,              // placed_referrals
      ],
      component: ReferralsPlacedDocument
    },

    // Past Medical History (Exact name match for collection)
    {
      name: 'Past Medical History',
      patterns: [
        /^past_medical_history$/i,         // EXACT: past_medical_history
      ],
      component: PastMedicalHistoryDocument
    },

    // Medical History
    {
      name: 'Medical History',
      patterns: [
        /^medical.*history$/i,             // EXACT: medical_history
        /^patient.*history/i,              // patient_history
        /^health.*history/i,               // health_history
      ],
      component: MedicalHistoryDocument
    },

    // Vital Signs
    {
      name: 'Vital Signs',
      patterns: [
        /^vital.*signs?$/i,                // EXACT: vital_signs, vital_sign
        /^vitals?$/i,                      // vitals, vital
        /^patient.*vitals/i,               // patient_vitals
      ],
      component: VitalSignsDocument
    },

    // Vital Signs Table
    {
      name: 'Vital Signs Table',
      patterns: [
        /^vital[_\s]?signs?[_\s]?table$/i,  // EXACT: vital_signs_table
      ],
      component: VitalSignsTableDocument
    },

    // Vital Signs Logs
    {
      name: 'Vital Signs Logs',
      patterns: [
        /^vital_signs_logs$/i,
        /^vital.*signs.*log/i,
        /^vital.*log/i,
      ],
      component: VitalSignsLogsDocument
    },
    // Variant Interpretation Guidelines
    {
      name: 'Variant Interpretation Guidelines',
      patterns: [
        /^variant_interpretation_guidelines$/i,       // Exact match
        /^variant.*interpretation.*guideline/i,       // variant_interpretation_guidelines
        /^variant.*interpretation/i,                  // variant_interpretation
        /^variant.*guideline/i,                       // variant_guidelines
        /^variant.*classification.*guideline/i,       // variant_classification_guidelines
        /^acmg.*variant/i,                            // acmg_variant
        /^genetic.*variant.*interpretation/i,         // genetic_variant_interpretation
      ],
      component: VariantInterpretationGuidelinesDocument
    },


    // Weight Measurements
    {
      name: 'Weight Measurements',
      patterns: [
        /^weight.*measurements?$/i,          // EXACT: weight_measurements, weight_measurement
        /^weight.*tracking$/i,               // weight_tracking
        /^body.*weight$/i,                   // body_weight
        /^bmi.*measurements?$/i,             // bmi_measurements
      ],
      component: WeightMeasurementsDocument
    },

    // Blood Pressure Readings
    {
      name: 'Blood Pressure Readings',
      patterns: [
        /^blood.*pressure.*readings?$/i,       // EXACT: blood_pressure_readings
        /^bp.*readings?$/i,                    // bp_readings
        /^blood.*pressure.*logs?$/i,           // blood_pressure_logs
        /^bp.*logs?$/i,                        // bp_logs
        /^blood.*pressure.*monitoring$/i,      // blood_pressure_monitoring
        /^hypertension.*readings?$/i,          // hypertension_readings
      ],
      component: BloodPressureReadingsDocument
    },

    // Kidney Function Reports
    {
      name: 'Kidney Function Reports',
      patterns: [
        /^kidney.*function.*reports?$/i,       // EXACT: kidney_function_reports
        /^renal.*function.*reports?$/i,        // renal_function_reports
        /^kidney.*function.*tests?$/i,         // kidney_function_tests
        /^renal.*function.*tests?$/i,          // renal_function_tests
        /^kidney.*assessment$/i,               // kidney_assessment
        /^renal.*assessment$/i,                // renal_assessment
        /^egfr.*reports?$/i,                   // egfr_reports
        /^ckd.*reports?$/i,                    // ckd_reports
        /^chronic.*kidney.*disease/i,          // chronic_kidney_disease
      ],
      component: KidneyFunctionReportsDocument
    },

    // Acute Kidney Injury
    {
      name: 'Acute Kidney Injury',
      patterns: [
        /^acute_kidney_injury$/i,               // EXACT: acute_kidney_injury
        /^acute.*kidney.*injury$/i,             // acute_kidney_injury, acute-kidney-injury
        /^aki$/i,                               // AKI abbreviation
        /^aki.*assessment$/i,                   // aki_assessment
        /^aki.*records?$/i,                     // aki_records
        /^acute.*renal.*failure$/i,             // acute_renal_failure
        /^arf$/i,                               // ARF abbreviation
      ],
      component: AcuteKidneyInjuryDocument
    },

    // Nutrition Lab Monitoring (nutritional lab panel: visceral proteins, trace elements, vitamins, iron studies, indices)
    {
      name: 'Nutrition Lab Monitoring',
      patterns: [
        /^nutrition_lab_monitoring$/i,          // EXACT: nutrition_lab_monitoring
        /^nutrition.*lab.*monitor/i,            // nutrition_lab_monitoring
      ],
      component: NutritionLabMonitoringDocument
    },

    // Parenteral Nutrition Monitoring
    {
      name: 'Parenteral Nutrition Monitoring',
      patterns: [
        /^parenteral_nutrition_monitoring$/i,   // EXACT: parenteral_nutrition_monitoring
        /^parenteral.*nutrition.*monitor/i,     // parenteral_nutrition_monitoring
        /^pn.*monitor/i,                        // pn_monitoring
        /^tpn.*monitor/i,                       // tpn_monitoring
        /^parenteral.*monitor/i,               // parenteral_monitoring
      ],
      component: ParenteralNutritionMonitoringDocument
    },

    // Nutritional Support
    {
      name: 'Nutritional Support',
      patterns: [
        /^nutritional_support$/i,               // EXACT: nutritional_support
        /^nutritional.*support$/i,              // nutritional_support, nutritional-support
        /^nutrition.*support$/i,                // nutrition_support
        /^nutritional.*plan$/i,                 // nutritional_plan
        /^nutrition.*plan$/i,                   // nutrition_plan
        /^enteral.*nutrition$/i,                // enteral_nutrition
        /^feeding.*plan$/i,                     // feeding_plan
        /^dietary.*support$/i,                  // dietary_support
      ],
      component: NutritionalSupportDocument
    },

    // Nutrition Support Consultation
    {
      name: 'Nutrition Support Consultation',
      patterns: [
        /^nutrition_support_consultation$/i,    // EXACT: nutrition_support_consultation
        /^nutrition.*support.*consult/i,        // nutrition_support_consultation
        /^nutritional.*support.*consult/i,      // nutritional_support_consultation
        /^nutrition.*consult/i,                 // nutrition_consultation
        /^dietary.*consult/i,                   // dietary_consultation
        /^enteral.*consult/i,                   // enteral_consultation
        /^parenteral.*consult/i,                // parenteral_consultation
        /^tpn.*consult/i,                       // tpn_consultation
      ],
      component: NutritionSupportConsultationDocument
    },

    // Arthritis Assessments
    {
      name: 'Arthritis Assessments',
      patterns: [
        /^arthritis_assessments?$/i,            // EXACT: arthritis_assessments
        /^arthritis.*assessment$/i,             // arthritis_assessment
        /^rheumatoid.*arthritis$/i,             // rheumatoid_arthritis
        /^psoriatic.*arthritis$/i,              // psoriatic_arthritis
        /^osteoarthritis.*assessment$/i,        // osteoarthritis_assessment
        /^joint.*assessment$/i,                 // joint_assessment
        /^inflammatory.*arthritis$/i,           // inflammatory_arthritis
        /^arthritis.*evaluation$/i,             // arthritis_evaluation
        /^rheumatology.*assessment$/i,          // rheumatology_assessment
      ],
      component: ArthritisAssessmentsDocument
    },

    // Autoimmune Panels
    {
      name: 'Autoimmune Panels',
      patterns: [
        /^autoimmune_panels?$/i,                 // EXACT: autoimmune_panels
        /^autoimmune.*panel$/i,                  // autoimmune_panel
        /^autoimmune.*testing$/i,               // autoimmune_testing
        /^autoimmune.*screen(ing)?$/i,          // autoimmune_screening
        /^connective.*tissue.*panel$/i,         // connective_tissue_panel
        /^lupus.*panel$/i,                      // lupus_panel
        /^ana.*panel$/i,                        // ana_panel
        /^vasculitis.*panel$/i,                 // vasculitis_panel
      ],
      component: AutoimmunePanelsDocument
    },

    // Autoimmune Evaluations
    {
      name: 'Autoimmune Evaluations',
      patterns: [
        /^autoimmune_evaluations?$/i,              // EXACT: autoimmune_evaluations
        /^autoimmune.*evaluation/i,                // autoimmune_evaluation
        /^autoimmune.*assess(ment)?/i,             // autoimmune_assessment
        /^autoimmune.*workup/i,                    // autoimmune_workup
        /^autoimmune.*diagnostic/i,                // autoimmune_diagnostic
      ],
      component: AutoimmuneEvaluationsDocument
    },

    // Connective Tissue Disease Assessment
    {
      name: 'Connective Tissue Disease Assessment',
      patterns: [
        /^connective_tissue_disease_assessment$/i,    // EXACT
        /^connective.*tissue.*disease/i,              // connective_tissue_disease
        /^ctd_assessment$/i,                          // ctd_assessment
        /^connective.*tissue.*assess(ment)?/i,        // connective_tissue_assessment
        /^mixed_connective_tissue/i,                  // mixed_connective_tissue
      ],
      component: ConnectiveTissueDiseaseAssessmentDocument
    },

    // Lupus Assessment
    {
      name: 'Lupus Assessment',
      patterns: [
        /^lupus_assessment$/i,                       // EXACT
        /^lupus.*assess(ment)?/i,                    // lupus_assessment variations
        /^sle_assessment$/i,                         // sle_assessment
        /^systemic.*lupus.*assess(ment)?/i,          // systemic_lupus_assessment
      ],
      component: LupusAssessmentDocument
    },

    // Rheumatology Consultations
    {
      name: 'Rheumatology Consultations',
      patterns: [
        /^rheumatology_consultations?$/i,        // EXACT: rheumatology_consultations
        /^rheumatology.*consult(ation)?s?$/i,    // rheumatology_consultation
        /^rheumatology.*referral$/i,             // rheumatology_referral
        /^rheumatology.*eval(uation)?$/i,        // rheumatology_evaluation
        /^arthritis.*consult(ation)?$/i,         // arthritis_consultation
        /^joint.*specialist.*consult/i,          // joint_specialist_consult
        /^autoimmune.*consult(ation)?$/i,        // autoimmune_consultation
      ],
      component: RheumatologyConsultationsDocument
    },

    // ========== GOUT ASSESSMENT ==========
    {
      name: 'Gout Assessment',
      patterns: [
        /^gout_assessment$/i,                 // EXACT match
        /^gout.*assessment/i,                 // gout assessment
        /^gout.*evaluation/i,                // gout evaluation
        /^uric.*acid.*assessment/i,          // uric acid assessment
        /^tophaceous.*gout/i,                // tophaceous gout
      ],
      component: GoutAssessmentDocument
    },

    // ========== RHEUMATOLOGIC ASSESSMENT ==========
    {
      name: 'Rheumatologic Assessment',
      patterns: [
        /^rheumatologic_assessment$/i,        // EXACT match
        /^rheumatologic.*assessment/i,        // rheumatologic assessment
        /^rheumatological.*assessment/i,     // rheumatological assessment
      ],
      component: RheumatologicAssessmentDocument
    },

    // ========== RHEUMATOLOGIC MONITORING ==========
    {
      name: 'Rheumatologic Monitoring',
      patterns: [
        /^rheumatologic_monitoring$/i,        // EXACT match
        /^rheumatologic.*monitoring/i,        // rheumatologic monitoring
        /^rheumatological.*monitoring/i,     // rheumatological monitoring
      ],
      component: RheumatologicMonitoringDocument
    },

    // ========== SPONDYLOARTHRITIS ASSESSMENT ==========
    {
      name: 'Spondyloarthritis Assessment',
      patterns: [
        /^spondyloarthritis_assessment$/i,    // EXACT match
        /^spondyloarthritis/i,                // spondyloarthritis
        /^ankylosing.*spondylitis/i,         // ankylosing spondylitis
        /^axial.*spondyloarthritis/i,        // axial spondyloarthritis
        /^axial.*spa/i,                      // axial SpA
      ],
      component: SpondyloarthritisAssessmentDocument
    },

    // Dermatology Consultations
    {
      name: 'Dermatology Consultations',
      patterns: [
        /^dermatology_consultations?$/i,        // EXACT: dermatology_consultations
        /^dermatology.*consult(ation)?s?$/i,    // dermatology_consultation
        /^dermatology.*referral$/i,             // dermatology_referral
        /^dermatology.*eval(uation)?$/i,        // dermatology_evaluation
        /^skin.*consult(ation)?$/i,             // skin_consultation
        /^skin.*specialist.*consult/i,          // skin_specialist_consult
        /^derm.*consult(ation)?$/i,             // derm_consultation
      ],
      component: DermatologyConsultationsDocument
    },

    // Dermatology Procedure Notes
    {
      name: 'Dermatology Procedure Notes',
      patterns: [
        /^dermatology_procedure_notes?$/i,      // EXACT: dermatology_procedure_notes
        /^dermatology.*procedure.*notes?$/i,    // dermatology_procedure_note
        /^derm.*procedure.*notes?$/i,           // derm_procedure_notes
        /^skin.*procedure.*notes?$/i,           // skin_procedure_notes
        /^skin.*biopsy.*notes?$/i,              // skin_biopsy_notes
        /^dermatology.*biopsy$/i,               // dermatology_biopsy
        /^excisional.*biopsy$/i,                // excisional_biopsy
        /^punch.*biopsy$/i,                     // punch_biopsy
        /^skin.*surgery.*notes?$/i,             // skin_surgery_notes
      ],
      component: DermatologyProcedureNotesDocument
    },

    // Dermatology Assessment
    {
      name: 'Dermatology Assessment',
      patterns: [
        /^dermatology_assessment$/i,              // EXACT: dermatology_assessment
        /^dermatology.*assessment$/i,             // dermatology_assessment, dermatology-assessment
        /^derm.*assessment$/i,                    // derm_assessment
        /^skin.*assessment$/i,                    // skin_assessment
        /^dermatological.*assessment$/i,          // dermatological_assessment
        /^skin.*lesion.*assessment$/i,            // skin_lesion_assessment
        /^skin.*exam(ination)?$/i,                // skin_examination, skin_exam
      ],
      component: DermatologyAssessmentDocument
    },

    // ========== DENTAL EXAMINATION REPORTS ==========
    {
      name: 'Dental Examination Reports',
      patterns: [
        /^dental_examination_reports$/i,        // EXACT: dental_examination_reports
        /^dental.*examination.*reports?$/i,     // dental_examination_report
        /^dental.*exam.*reports?$/i,            // dental_exam_reports
        /^oral.*examination.*reports?$/i,       // oral_examination_reports
        /^dental.*checkup$/i,                   // dental_checkup
        /^dental.*evaluation$/i,                // dental_evaluation
        /^oral.*maxillofacial.*exam/i,          // oral_maxillofacial_examination
      ],
      component: DentalExaminationReportsDocument
    },

    // ========== ORAL SURGERY REPORTS ==========
    {
      name: 'Oral Surgery Reports',
      patterns: [
        /^oral_surgery_reports$/i,                // EXACT: oral_surgery_reports
        /^oral.*surgery.*reports?$/i,             // oral_surgery_report
        /^oral.*maxillofacial.*surgery$/i,        // oral_maxillofacial_surgery
        /^wisdom.*tooth.*extraction$/i,           // wisdom_tooth_extraction
        /^third.*molar.*extraction$/i,            // third_molar_extraction
        /^impacted.*tooth.*surgery$/i,            // impacted_tooth_surgery
        /^dental.*surgery.*reports?$/i,           // dental_surgery_reports
        /^maxillofacial.*surgery$/i,              // maxillofacial_surgery
      ],
      component: OralSurgeryReportsDocument
    },

    // ========== TMJ ASSESSMENT ==========
    {
      name: 'TMJ Assessment',
      patterns: [
        /^tmj_assessment$/i,                      // EXACT: tmj_assessment
        /^tmj.*assessment$/i,                     // tmj_assessment, tmj-assessment
        /^temporomandibular.*assessment$/i,        // temporomandibular_joint_assessment
        /^temporomandibular.*joint.*assessment$/i, // temporomandibular_joint_assessment
        /^tmj.*evaluation$/i,                     // tmj_evaluation
        /^tmj.*disorder$/i,                       // tmj_disorder
        /^tmj.*exam(?:ination)?$/i,               // tmj_exam, tmj_examination
      ],
      component: TmjAssessmentDocument
    },

    // ========== JAW RECONSTRUCTION ==========
    {
      name: 'Jaw Reconstruction',
      patterns: [
        /^jaw_reconstruction$/i,                   // EXACT: jaw_reconstruction
        /^jaw.*reconstruction$/i,                  // jaw_reconstruction, jaw-reconstruction
        /^mandibular.*reconstruction$/i,           // mandibular_reconstruction
        /^maxillary.*reconstruction$/i,            // maxillary_reconstruction
        /^mandible.*reconstruction$/i,             // mandible_reconstruction
        /^jaw.*surgery$/i,                         // jaw_surgery
      ],
      component: JawReconstructionDocument
    },

    // ========== DENTAL IMPLANT SURGERY ==========
    {
      name: 'Dental Implant Surgery',
      patterns: [
        /^dental_implant_surgery$/i,              // EXACT: dental_implant_surgery
        /^dental.*implant.*surgery$/i,            // dental_implant_surgery, dental-implant-surgery
        /^implant.*surgery$/i,                    // implant_surgery
        /^dental.*implant$/i,                     // dental_implant
        /^implant.*placement$/i,                  // implant_placement
      ],
      component: DentalImplantSurgeryDocument
    },

    // ========== LIGAMENT RECONSTRUCTION ==========
    {
      name: 'Ligament Reconstruction',
      patterns: [
        /^ligament_reconstruction$/i,             // EXACT: ligament_reconstruction
        /^ligament.*reconstruction$/i,            // ligament_reconstruction, ligament-reconstruction
        /^acl_reconstruction$/i,                  // acl_reconstruction
        /^pcl_reconstruction$/i,                  // pcl_reconstruction
        /^mcl_reconstruction$/i,                  // mcl_reconstruction
        /^lcl_reconstruction$/i,                  // lcl_reconstruction
      ],
      component: LigamentReconstructionDocument
    },

    // ========== MENISCUS REPAIR ==========
    {
      name: 'Meniscus Repair',
      patterns: [
        /^meniscus_repair$/i,                      // EXACT: meniscus_repair
        /^meniscus.*repair$/i,                     // meniscus_repair, meniscus-repair
        /^meniscal.*repair$/i,                     // meniscal_repair
        /^meniscectomy$/i,                         // meniscectomy
        /^partial.*meniscectomy$/i,                // partial_meniscectomy
        /^meniscus.*surgery$/i,                    // meniscus_surgery
      ],
      component: MeniscusRepairDocument
    },

    // ========== ORTHOPEDIC OPERATIVE REPORTS ==========
    {
      name: 'Orthopedic Operative Reports',
      patterns: [
        /^orthopedic_operative_reports$/i,        // EXACT: orthopedic_operative_reports
        /^orthopedic.*operative.*reports?$/i,     // orthopedic_operative_report
        /^orthopedic.*surgery.*reports?$/i,       // orthopedic_surgery_reports
        /^sports.*medicine.*surgery$/i,           // sports_medicine_surgery
        /^acl.*reconstruction.*reports?$/i,       // acl_reconstruction_reports
        /^knee.*surgery.*reports?$/i,             // knee_surgery_reports
        /^arthroscopic.*surgery.*reports?$/i,     // arthroscopic_surgery_reports
        /^meniscus.*repair.*reports?$/i,          // meniscus_repair_reports
      ],
      component: OrthopedicOperativeReportsDocument
    },

    // ========== ORTHOPEDIC IMAGING ==========
    {
      name: 'Orthopedic Imaging',
      patterns: [
        /^orthopedic_imaging$/i,                   // EXACT: orthopedic_imaging
        /^orthopedic.*imaging$/i,                  // orthopedic_imaging, orthopedic-imaging
        /^orthopaedic.*imaging$/i,                 // orthopaedic_imaging (UK spelling)
        /^musculoskeletal.*imaging$/i,             // musculoskeletal_imaging
        /^msk.*imaging$/i,                         // msk_imaging
        /^bone.*imaging$/i,                        // bone_imaging
        /^joint.*imaging$/i,                       // joint_imaging
      ],
      component: OrthopedicImagingDocument
    },

    // ========== ORTHOPEDIC ASSESSMENT ==========
    {
      name: 'Orthopedic Assessment',
      patterns: [
        /^orthopedic_assessments?$/i,                // EXACT: orthopedic_assessment, orthopedic_assessments
        /^orthopedic.*assessments?$/i,               // orthopedic_assessment(s), orthopedic-assessment(s)
        /^orthopaedic.*assessments?$/i,              // orthopaedic_assessment(s) (UK spelling)
        /^musculoskeletal.*assessments?$/i,          // musculoskeletal_assessment(s)
        /^msk.*assessments?$/i,                      // msk_assessment(s)
        /^bone.*assessments?$/i,                     // bone_assessment(s)
        /^fracture.*assessments?$/i,                 // fracture_assessment(s)
        /^orthopedic.*eval$/i,                       // orthopedic_eval
        /^ortho.*assessments?$/i,                    // ortho_assessment(s)
      ],
      component: OrthopedicAssessmentDocument
    },

    // ========== ORTHOPEDIC PROCEDURES ==========
    {
      name: 'Orthopedic Procedures',
      patterns: [
        /^orthopedic_procedures$/i,                  // EXACT: orthopedic_procedures
        /^orthopedic.*procedures?$/i,                // orthopedic_procedures, orthopedic-procedures
        /^orthopaedic.*procedures?$/i,               // orthopaedic_procedures (UK spelling)
        /^musculoskeletal.*procedures?$/i,           // musculoskeletal_procedures
        /^msk.*procedures?$/i,                       // msk_procedures
        /^bone.*procedures?$/i,                      // bone_procedures
        /^fracture.*procedures?$/i,                  // fracture_procedures
        /^ortho.*procedures?$/i,                     // ortho_procedures
      ],
      component: OrthopedicProceduresDocument
    },

    // ========== SKIN BIOPSY REPORTS ==========
    {
      name: 'Skin Biopsy Reports',
      patterns: [
        /^skin_biopsy_reports$/i,                 // EXACT: skin_biopsy_reports
        /^skin.*biopsy.*reports?$/i,              // skin_biopsy_reports, skin-biopsy-reports
        /^skin.*pathology$/i,                     // skin_pathology
        /^dermatopathology$/i,                    // dermatopathology
        /^melanoma.*biopsy$/i,                    // melanoma_biopsy
      ],
      component: SkinBiopsyReportsDocument
    },

    // ========== BONE SCAN REPORTS (Nuclear Medicine) ==========
    // NOTE: Must come BEFORE DEXA Scan Reports - nuclear medicine bone scan, NOT bone density scan
    {
      name: 'Bone Scan Reports',
      patterns: [
        /^bone_scan_reports$/i,                   // EXACT: bone_scan_reports
        /^bone_scan_report$/i,                    // bone_scan_report
        /^nuclear.*bone.*scan/i,                  // nuclear_bone_scan
        /^skeletal.*scintigraphy/i,               // skeletal_scintigraphy
        /^bone.*scintigraphy/i,                   // bone_scintigraphy
      ],
      component: BoneScanReportsDocument
    },

    // ========== PET SCAN REPORTS ==========
    // PET/CT imaging with SUV values, staging, lymph node stations, metastatic sites
    {
      name: 'PET Scan Reports',
      patterns: [
        /^pet_scan_reports$/i,                   // EXACT: pet_scan_reports
        /^pet_scan_report$/i,                    // pet_scan_report
        /^pet.*scan.*report/i,                   // pet_scan_report variations
        /^pet.*ct.*report/i,                     // pet_ct_report
        /^pet.*ct.*scan/i,                       // pet_ct_scan
      ],
      component: PetScanReportsDocument
    },

    // ========== THORACIC SURGERY ASSESSMENT ==========
    // Lung resection, lobectomy, VATS, PFTs, tumor staging, adjuvant therapy
    {
      name: 'Thoracic Surgery Assessment',
      patterns: [
        /^thoracic_surgery_assessment$/i,        // EXACT: thoracic_surgery_assessment
        /^thoracic.*surgery.*assess/i,           // thoracic_surgery_assessment variations
        /^thoracic.*assess/i,                    // thoracic_assessment
        /^thoracic.*surgical/i,                  // thoracic_surgical
      ],
      component: ThoracicSurgeryAssessmentDocument
    },

    // ========== NUCLEAR MEDICINE ASSESSMENT ==========
    // PET scan, bone scan, thyroid scan, parathyroid SPECT, cardiac perfusion with bar charts
    {
      name: 'Nuclear Medicine Assessment',
      patterns: [
        /^nuclear_medicine_assessment$/i,         // EXACT: nuclear_medicine_assessment
        /^nuclear.*medicine.*assessment/i,        // nuclear_medicine_assessment variations
        /^nuclear.*assessment/i,                  // nuclear_assessment
      ],
      component: NuclearMedicineAssessmentDocument
    },

    // ========== NUCLEAR MEDICINE STUDIES ==========
    {
      name: 'Nuclear Medicine Studies',
      patterns: [
        /^nuclear_medicine_studies$/i,           // EXACT: nuclear_medicine_studies
        /^nuclear.*medicine.*stud/i,             // nuclear_medicine_study variations
        /^nuclear.*stud/i,                       // nuclear_study
        /^thyroid.*scan/i,                       // thyroid_scan
      ],
      component: NuclearMedicineStudiesDocument
    },

    // ========== DEXA SCAN REPORTS ==========
    {
      name: 'DEXA Scan Reports',
      patterns: [
        /^dexa_scan_reports$/i,                   // EXACT: dexa_scan_reports
        /^dexa.*scan/i,                           // dexa_scan, dexa_scans
        /^dxa.*scan/i,                            // dxa_scan
        /^bone.*density.*scan/i,                  // bone_density_scan
        /^bone.*density.*report/i,                // bone_density_report
        /^bone.*scan(?!_report)/i,                // bone_scan but NOT bone_scan_report (use negative lookahead)
        /^osteoporosis.*scan/i,                   // osteoporosis_scan
        /^osteoporosis.*assessment/i,             // osteoporosis_assessment
      ],
      component: DexaScanReportsDocument
    },

    // Nephrology Consultation Details (CKD-specific detailed tracking)
    // NOTE: Generic /^nephrology.*consult/ patterns moved to NephrologyConsultationsDocument
    {
      name: 'Nephrology Consultation Details',
      patterns: [
        /^nephrology_consultation_details$/i,       // EXACT: nephrology_consultation_details
        /^nephrology.*consultation.*details/i,      // nephrology_consultation_details
        /^renal.*consultation.*details/i,           // renal_consultation_details
        /^nephrology.*details$/i,                   // nephrology_details
        /^ckd.*detailed/i,                          // ckd_detailed_tracking
        /^dialysis.*planning.*details/i,            // dialysis_planning_details
        /^eskd.*risk.*details/i,                    // eskd_risk_details
      ],
      component: NephrologyConsultationDetailsDocument
    },

    // CKD Assessment
    {
      name: 'CKD Assessment',
      patterns: [
        /^ckd_assessment$/i,                    // EXACT: ckd_assessment
        /^ckd.*assessment$/i,                   // ckd_assessment, ckd-assessment
        /^chronic.*kidney.*assessment$/i,       // chronic_kidney_assessment
        /^renal.*assessment$/i,                 // renal_assessment
      ],
      component: CkdAssessmentDocument
    },

    // Proteinuria Assessment
    {
      name: 'Proteinuria Assessment',
      patterns: [
        /^proteinuria_assessment$/i,            // EXACT: proteinuria_assessment
        /^proteinuria.*assessment$/i,           // proteinuria_assessment, proteinuria-assessment
        /^albuminuria.*assessment$/i,           // albuminuria_assessment
        /^uacr.*assessment$/i,                  // uacr_assessment
      ],
      component: ProteinuriaAssessmentDocument
    },

    // Dietary Interventions
    {
      name: 'Dietary Interventions',
      patterns: [
        /^dietary_interventions$/i,             // EXACT: dietary_interventions
        /^dietary.*interventions?$/i,           // dietary_intervention, dietary-interventions
        /^diet.*interventions?$/i,              // diet_interventions
        /^nutrition.*interventions?$/i,         // nutrition_interventions
      ],
      component: DietaryInterventionsDocument
    },

    // ========== SOUTH ASIAN NUTRITIONIST ==========
    {
      name: 'South Asian Nutritionist',
      patterns: [
        /^south_asian_nutritionist$/i,        // EXACT match
        /^south.*asian.*nutri/i,              // south asian nutrition
        /^cultural.*nutri/i,                  // cultural nutrition
      ],
      component: SouthAsianNutritionistDocument
    },

    // ========== INDIAN DIET EXCHANGE LISTS ==========
    {
      name: 'Indian Diet Exchange Lists',
      patterns: [
        /^indian_diet_exchange_lists$/i,      // EXACT match
        /^indian.*diet.*exchange/i,           // indian diet exchange
        /^indian.*diet/i,                     // indian diet
        /^south.*asian.*diet/i,              // south asian diet
      ],
      component: IndianDietExchangeListsDocument
    },

    // ========== HYDRATION MANAGEMENT ==========
    {
      name: 'Hydration Management',
      patterns: [
        /^hydration_management$/i,            // EXACT match
        /^hydration.*management/i,            // hydration management
        /^fluid.*management/i,               // fluid management
        /^hydration.*status/i,               // hydration status
      ],
      component: HydrationManagementDocument
    },

    // CKD Management
    {
      name: 'CKD Management',
      patterns: [
        /^ckd_management$/i,                    // EXACT: ckd_management
        /^ckd.*management$/i,                   // ckd-management
        /^chronic.*kidney.*management$/i,       // chronic_kidney_disease_management
        /^kidney.*disease.*management$/i,       // kidney_disease_management
      ],
      component: CKDManagementDocument
    },

    // ========== ORTHODONTIC TREATMENT PLANS ==========
    {
      name: 'Orthodontic Treatment Plans',
      patterns: [
        /^orthodontic[_\s]?treatment[_\s]?plans?$/i,  // orthodontic_treatment_plans
      ],
      component: OrthodonticTreatmentPlansDocument
    },

    // ========== ORTHOGNATHIC SURGERY EVALUATION ==========
    {
      name: 'Orthognathic Surgery Evaluation',
      patterns: [
        /^orthognathic[_\s]?surgery[_\s]?evaluation$/i,  // orthognathic_surgery_evaluation
        /^orthognathic.*evaluation$/i,                     // orthognathic_evaluation
        /^orthognathic.*surgery$/i,                        // orthognathic_surgery
        /^jaw[_\s]?surgery[_\s]?evaluation$/i,            // jaw_surgery_evaluation
        /^maxillofacial[_\s]?surgery[_\s]?evaluation$/i,  // maxillofacial_surgery_evaluation
        /^le[_\s]?fort.*evaluation$/i,                     // le_fort_evaluation
        /^bsso.*evaluation$/i,                             // bsso_evaluation
        /^cephalometric.*evaluation$/i,                    // cephalometric_evaluation
      ],
      component: OrthognathicSurgeryEvaluationDocument
    },

    // ========== PERIODONTAL CHARTS ==========
    {
      name: 'Periodontal Charts',
      patterns: [
        /^periodontal[_\s]?charts?$/i,  // periodontal_charts
      ],
      component: PeriodontalChartsDocument
    },

    // Treatment Plans
    {
      name: 'Treatment Plans',
      patterns: [
        /^treatment.*plans?$/i,            // EXACT: treatment_plans, treatment_plan
        /^care.*plans?$/i,                 // care_plans, care_plan
        /^therapy.*plans?$/i,              // therapy_plans
      ],
      component: TreatmentPlansDocument
    },

    // Monitoring Plans
    {
      name: 'Monitoring Plans',
      patterns: [
        /^monitoring.*plans?$/i,           // EXACT: monitoring_plans, monitoring_plan
        /^patient.*monitoring/i,           // patient_monitoring
        /^clinical.*monitoring/i,          // clinical_monitoring
        /^follow.*up.*monitoring/i,        // follow_up_monitoring
      ],
      component: MonitoringPlansDocument
    },

    // Clinical Scores
    {
      name: 'Clinical Scores',
      patterns: [
        /^clinical.*scores?$/i,            // EXACT: clinical_scores, clinical_score
        /^assessment.*scores?/i,           // assessment_scores
        /^scoring.*system/i,               // scoring_systems
        /^risk.*scores?/i,                 // risk_scores
      ],
      component: ClinicalScoresDocument
    },

    // Family Meeting Notes
    {
      name: 'Family Meeting Notes',
      patterns: [
        /^family.*meeting.*notes?$/i,      // EXACT: family_meeting_notes, family_meeting_note
        /^family.*meeting/i,               // family_meetings
        /^family.*conference/i,            // family_conferences
        /^care.*conference/i,              // care_conferences
      ],
      component: FamilyMeetingNotesDocument
    },

    // Family Medicine Assessment
    {
      name: 'Family Medicine Assessment',
      patterns: [
        /^family.*medicine.*assessment/i,  // EXACT: family_medicine_assessment
        /^family.*practice.*assessment/i,  // family_practice_assessment
        /^primary.*care.*assessment/i,     // primary_care_assessment
      ],
      component: FamilyMedicineAssessmentDocument
    },

    // Family Medicine Visits
    {
      name: 'Family Medicine Visits',
      patterns: [
        /^family_medicine_visits$/i,       // EXACT: family_medicine_visits
        /^family.*medicine.*visit/i,       // family_medicine_visit, family_medicine_visits
        /^family.*practice.*visit/i,       // family_practice_visit
        /^primary.*care.*visit/i,          // primary_care_visit
        /^fm.*visit/i,                     // fm_visit, fm_visits
      ],
      component: FamilyMedicineVisitsDocument
    },

    // Functional Assessments
    {
      name: 'Functional Assessments',
      patterns: [
        /^functional.*assessments?$/i,     // EXACT: functional_assessments, functional_assessment
        /^adl.*assessment/i,               // adl_assessments
        /^iadl.*assessment/i,              // iadl_assessments
      ],
      component: FunctionalAssessmentsDocument
    },

    // Lifestyle Risk Assessment (MUST be before Lifestyle Assessments to avoid conflict)
    {
      name: 'Lifestyle Risk Assessment',
      patterns: [
        /^lifestyle_risk_assessment$/i,    // lifestyle_risk_assessment
        /^lifestyle_risk/i,                // lifestyle_risk_*
      ],
      component: LifestyleRiskAssessmentDocument
    },

    // Lifestyle Assessments
    {
      name: 'Lifestyle Assessments',
      patterns: [
        /^lifestyle.*assessments?$/i,      // lifestyle_assessments, lifestyle_assessment
        /^lifestyle.*evaluation/i,         // lifestyle_evaluation
        /^health.*behavior.*assessment/i,  // health_behavior_assessment
        /^wellness.*assessment/i,          // wellness_assessment
      ],
      component: LifestyleAssessmentsDocument
    },

    // Lifestyle Counseling
    {
      name: 'Lifestyle Counseling',
      patterns: [
        /^lifestyle.*counseling$/i,        // lifestyle_counseling
        /^lifestyle.*counsel$/i,           // lifestyle_counsel
        /^lifestyle.*modification/i,       // lifestyle_modification
        /^diet.*exercise.*counseling/i,    // diet_exercise_counseling
        /^behavior.*counseling/i,          // behavior_counseling
      ],
      component: LifestyleCounselingDocument
    },

    // Risk Calculators
    {
      name: 'Risk Calculators',
      patterns: [
        /^risk.*calculators?$/i,           // risk_calculators, risk_calculator
        /^risk.*scores?$/i,                // risk_scores
        /^clinical.*calculator/i,          // clinical_calculators
        /^risk.*assessment.*tool/i,        // risk_assessment_tools
      ],
      component: RiskCalculatorsDocument
    },

    // Preventive Biomarkers
    {
      name: 'Preventive Biomarkers',
      patterns: [
        /^preventive.*biomarkers?$/i,      // preventive_biomarkers, preventive_biomarker
        /^advanced.*biomarkers?$/i,        // advanced_biomarkers
        /^biomarker.*panel/i,              // biomarker_panel
        /^preventive.*lab/i,               // preventive_labs
      ],
      component: PreventiveBiomarkersDocument
    },

    // Preventive Medicine Assessments
    {
      name: 'Preventive Medicine Assessments',
      patterns: [
        /^preventive.*medicine.*assessments?$/i,  // preventive_medicine_assessments
        /^preventive.*assessment/i,               // preventive_assessments
        /^prevention.*plan/i,                     // prevention_plans
        /^wellness.*assessment/i,                 // wellness_assessments
      ],
      component: PreventiveMedicineAssessmentsDocument
    },

    // Cancer Screening Records - MUST be BEFORE Screening Compliance (pattern /^cancer.*screening/i would match cancer_screening_records)
    {
      name: 'Cancer Screening Records',
      patterns: [
        /^cancer_screening_records$/i,            // EXACT: cancer_screening_records
        /^cancer.*screening.*records/i,           // cancer_screening_records variants
      ],
      component: CancerScreeningRecordsDocument
    },

    // ========== SCHOOL HEALTH FORMS ==========
    {
      name: 'School Health Forms',
      patterns: [
        /^school_health_forms$/i,                  // EXACT match
        /^school.*health.*form/i,                  // school_health_forms variations
        /^student.*health.*form/i,                 // student_health_forms
        /^school.*medical.*form/i,                 // school_medical_forms
      ],
      component: SchoolHealthFormsDocument
    },

    // ========== SCHOOL PERFORMANCE ==========
    {
      name: 'School Performance',
      patterns: [
        /^school_performance$/i,                  // EXACT match: school_performance
        /^school.*performance/i,                  // school_performance variations
        /^academic.*performance/i,                // academic_performance
        /^school.*report/i,                       // school_report, school_reports
        /^educational.*performance/i,             // educational_performance
      ],
      component: SchoolPerformanceDocument
    },

    // Screening Compliance
    {
      name: 'Screening Compliance',
      patterns: [
        /^screening.*compliance$/i,               // screening_compliance
        /^cancer.*screening/i,                    // cancer_screenings (after cancer_screening_records)
        /^preventive.*screening/i,                // preventive_screenings
        /^screening.*tracker/i,                   // screening_tracker
      ],
      component: ScreeningComplianceDocument
    },

    // Mental Status Exams
    {
      name: 'Mental Status Exam',
      patterns: [
        /^mental.*status.*exam/i,                 // mental_status_exams, mental_status_exam
        /^mse$/i,                                 // MSE (abbreviation)
        /^psychiatric.*exam/i,                    // psychiatric_exams
        /^mental.*state.*exam/i,                  // mental_state_examination
      ],
      component: MentalStatusExamDocument
    },

    // Mood & Psychological Assessment
    {
      name: 'Mood & Psychological Assessment',
      patterns: [
        /^mood_psychological_assessment$/i,       // EXACT: mood_psychological_assessment
        /^mood.*psychological.*assessment/i,      // mood_psychological_assessments
        /^mood.*assessment/i,                     // mood_assessment
        /^psychological.*assessment/i,            // psychological_assessment
        /^mood.*evaluation/i,                     // mood_evaluation
        /^psych.*mood.*assessment/i,              // psych_mood_assessment
      ],
      component: MoodPsychologicalAssessmentDocument
    },

    // Gynecology Consultations
    {
      name: 'Gynecology Consultations',
      patterns: [
        /^gynecology_consultations$/i,            // EXACT: gynecology_consultations
        /^gynecology.*consultation/i,             // gynecology_consultation
        /^gyn.*consultation/i,                    // gyn_consultation
        /^gynecological.*consultation/i,          // gynecological_consultation
        /^ob.*gyn.*consultation/i,                // ob_gyn_consultation
        /^women.*health.*consultation/i,          // women_health_consultation
      ],
      component: GynecologyConsultationsDocument
    },

    // Cytology Reports
    {
      name: 'Cytology Reports',
      patterns: [
        /^cytology_reports$/i,            // EXACT: cytology_reports
        /^cytology.*report/i,             // cytology_report, cytology_reports
        /^pap.*smear/i,                   // pap_smear, pap_smear_results
        /^pap.*test/i,                    // pap_test, pap_test_results
        /^cervical.*cytology/i,           // cervical_cytology
        /^bethesda/i,                     // bethesda_classification
        /^thinprep/i,                     // thinprep_results
      ],
      component: CytologyReportsDocument
    },

    // Flow Cytometry Reports
    {
      name: 'Flow Cytometry Reports',
      patterns: [
        /^flow_cytometry_reports$/i,           // EXACT: flow_cytometry_reports
        /^flow.*cytometry/i,                   // flow_cytometry, flow_cytometry_analysis
        /^cytometry.*flow/i,                   // cytometry_flow
        /^facs.*analysis/i,                    // facs_analysis (fluorescence-activated cell sorting)
        /^immunophenotyping/i,                 // immunophenotyping
        /^cell.*marker.*analysis/i,            // cell_marker_analysis
        /^lymphocyte.*subset/i,                // lymphocyte_subset_analysis
      ],
      component: FlowCytometryReportsDocument
    },

    // Current Pregnancy
    {
      name: 'Current Pregnancy',
      patterns: [
        /^current_pregnancy$/i,              // EXACT: current_pregnancy
        /^current.*pregnancy/i,              // current_pregnancy_status
        /^pregnancy.*current/i,              // pregnancy_current
        /^active.*pregnancy/i,               // active_pregnancy
        /^ongoing.*pregnancy/i,              // ongoing_pregnancy
      ],
      component: CurrentPregnancyDocument
    },

    // Prenatal Screening
    {
      name: 'Prenatal Screening',
      patterns: [
        /^prenatal_screening$/i,              // EXACT: prenatal_screening
        /^prenatal.*screening/i,              // prenatal_screenings
        /^pregnancy.*screening/i,             // pregnancy_screening
        /^antenatal.*screening/i,             // antenatal_screening
        /^genetic.*screening/i,               // genetic_screening_prenatal
      ],
      component: PrenatalScreeningDocument
    },

    // Cell-Free DNA Result
    {
      name: 'Cell-Free DNA Result',
      patterns: [
        /^cell_free_dna_result$/i,              // EXACT: cell_free_dna_result
        /^cell.*free.*dna/i,                    // cell_free_dna, cell_free_dna_results
        /^cffdna/i,                             // cffdna_result
        /^nipt/i,                               // nipt (non-invasive prenatal testing)
        /^non.*invasive.*prenatal.*test/i,       // non_invasive_prenatal_testing
      ],
      component: CellFreeDnaResultDocument
    },

    // Amniocentesis Reports
    {
      name: 'Amniocentesis Reports',
      patterns: [
        /^amniocentesis_reports$/i,           // EXACT: amniocentesis_reports
        /^amniocentesis.*report/i,            // amniocentesis_report, amniocentesis_reports
        /^amnio.*report/i,                    // amnio_report
        /^diagnostic.*amniocentesis/i,        // diagnostic_amniocentesis
        /^amniocentesis.*result/i,            // amniocentesis_results
      ],
      component: AmniocentesisReportsDocument
    },

    // Amniotic Fluid Assessment
    {
      name: 'Amniotic Fluid Assessment',
      patterns: [
        /^amniotic_fluid_assessment$/i,          // EXACT: amniotic_fluid_assessment
        /^amniotic.*fluid.*assess/i,              // amniotic_fluid_assessment variations
        /^fluid.*assessment/i,                    // fluid_assessment
        /^afi.*assessment/i,                      // afi_assessment (amniotic fluid index)
        /^amniotic.*index/i,                      // amniotic_fluid_index
      ],
      component: AmnioticFluidAssessmentDocument
    },

    // First Trimester Bleeding
    {
      name: 'First Trimester Bleeding',
      patterns: [
        /^first_trimester_bleeding$/i,           // EXACT: first_trimester_bleeding
        /^first.*trimester.*bleed/i,             // first_trimester_bleeding, first trimester bleed
        /^trimester.*bleed/i,                    // trimester_bleeding
      ],
      component: FirstTrimesterBleedingDocument
    },

    // First Trimester Screen Result
    {
      name: 'First Trimester Screen Result',
      patterns: [
        /^first_trimester_screen_result$/i,      // EXACT: first_trimester_screen_result
        /^first.*trimester.*screen/i,            // first_trimester_screen, first trimester screen
        /^first.*trimester.*result/i,            // first_trimester_result
        /^combined.*first.*trimester/i,          // combined_first_trimester_screening
        /^fts_result/i,                          // fts_result (abbreviation)
      ],
      component: FirstTrimesterScreenResultDocument
    },

    // NT Scan Result
    {
      name: 'NT Scan Result',
      patterns: [
        /^nt_scan_result$/i,                     // EXACT: nt_scan_result
        /^nt.*scan.*result/i,                    // nt_scan_results
        /^nuchal.*translucency.*scan/i,          // nuchal_translucency_scan
        /^nuchal.*translucency.*result/i,        // nuchal_translucency_result
        /^nt.*measurement/i,                     // nt_measurement
      ],
      component: NtScanResultDocument
    },

    // Anatomy Scan Result
    {
      name: 'Anatomy Scan Result',
      patterns: [
        /^anatomy_scan_result$/i,                // EXACT: anatomy_scan_result
        /^anatomy.*scan.*result/i,               // anatomy_scan_results
        /^anatomy.*scan/i,                       // anatomy_scan
        /^fetal.*anatomy.*scan/i,                // fetal_anatomy_scan
        /^mid.*trimester.*scan/i,                // mid_trimester_scan
      ],
      component: AnatomyScanResultDocument
    },

    // Pregnancy Course
    {
      name: 'Pregnancy Course',
      patterns: [
        /^pregnancy_course$/i,                   // EXACT: pregnancy_course
        /^pregnancy.*course/i,                   // pregnancy_courses
        /^course.*pregnancy/i,                   // course_of_pregnancy
        /^prenatal.*course/i,                    // prenatal_course
        /^obstetric.*course/i,                   // obstetric_course
      ],
      component: PregnancyCourseDocument
    },

    // Estimated Delivery Date
    {
      name: 'Estimated Delivery Date',
      patterns: [
        /^estimated_delivery_date$/i,            // EXACT: estimated_delivery_date
        /^estimated.*delivery.*date/i,           // estimated_delivery_date variations
        /^edd$/i,                                // edd abbreviation
        /^due.*date/i,                           // due_date
        /^expected.*delivery/i,                  // expected_delivery_date
      ],
      component: EstimatedDeliveryDateDocument
    },

    // Fetal Ultrasound
    {
      name: 'Fetal Ultrasound',
      patterns: [
        /^fetal_ultrasound$/i,                // EXACT: fetal_ultrasound
        /^fetal.*ultrasound/i,                // fetal_ultrasounds
        /^obstetric.*ultrasound/i,            // obstetric_ultrasound
        /^pregnancy.*ultrasound/i,            // pregnancy_ultrasound
        /^fetal.*sonogram/i,                  // fetal_sonogram
        /^growth.*scan/i,                     // growth_scan
        /^fetal.*biometry/i,                  // fetal_biometry
      ],
      component: FetalUltrasoundDocument
    },

    // Gestational Diabetes
    {
      name: 'Gestational Diabetes',
      patterns: [
        /^gestational_diabetes$/i,            // EXACT: gestational_diabetes
        /^gestational.*diabetes/i,            // gestational_diabetes_management
        /^gdm$/i,                             // GDM abbreviation
        /^gdm.*management/i,                  // gdm_management
        /^pregnancy.*diabetes/i,              // pregnancy_diabetes
        /^diabetes.*pregnancy/i,              // diabetes_in_pregnancy
        /^glucose.*intolerance.*pregnancy/i,  // glucose_intolerance_pregnancy
      ],
      component: GestationalDiabetesDocument
    },

    // Glucose Monitoring Goals
    {
      name: 'Glucose Monitoring Goals',
      patterns: [
        /^glucose_monitoring_goals$/i,        // EXACT: glucose_monitoring_goals
        /^glucose.*monitoring.*goal/i,        // glucose_monitoring_goals
        /^blood.*sugar.*goal/i,               // blood_sugar_goals
        /^glycemic.*target/i,                 // glycemic_targets
        /^glucose.*target/i,                  // glucose_targets
      ],
      component: GlucoseMonitoringGoalsDocument
    },

    // Fetal Surveillance
    {
      name: 'Fetal Surveillance',
      patterns: [
        /^fetal_surveillance$/i,              // EXACT: fetal_surveillance
        /^fetal.*surveillance/i,              // fetal_surveillance_report
        /^nst$/i,                             // NST (Non-Stress Test)
        /^bpp$/i,                             // BPP (Biophysical Profile)
        /^non.*stress.*test/i,                // non_stress_test
        /^biophysical.*profile/i,             // biophysical_profile
        /^contraction.*stress/i,              // contraction_stress_test
        /^kick.*count/i,                      // kick_counts
        /^fetal.*well.*being/i,               // fetal_well_being
      ],
      component: FetalSurveillanceDocument
    },

    // Umbilical Artery Doppler
    {
      name: 'Umbilical Artery Doppler',
      patterns: [
        /^umbilical_artery_doppler$/i,        // EXACT: umbilical_artery_doppler
        /^umbilical.*artery.*doppler/i,       // umbilical_artery_doppler_study
        /^umbilical.*doppler/i,               // umbilical_doppler
        /^doppler.*umbilical/i,               // doppler_umbilical
        /^uterine.*doppler/i,                 // uterine_doppler
        /^placental.*doppler/i,               // placental_doppler_flow
        /^doppler.*flow.*study/i,             // doppler_flow_study
      ],
      component: UmbilicalArteryDopplerDocument
    },

    // Delivery Planning
    {
      name: 'Delivery Planning',
      patterns: [
        /^delivery_planning$/i,               // EXACT: delivery_planning
        /^delivery.*planning/i,               // delivery_planning_notes
        /^birth.*planning/i,                  // birth_planning
        /^labor.*delivery.*plan/i,            // labor_and_delivery_plan
        /^delivery.*mode/i,                   // delivery_mode_planning
        /^cesarean.*planning/i,               // cesarean_planning
        /^vaginal.*delivery.*plan/i,          // vaginal_delivery_plan
        /^planned.*delivery/i,                // planned_delivery
      ],
      component: DeliveryPlanningDocument
    },

    // Fetal Echocardiography
    {
      name: 'Fetal Echocardiography',
      patterns: [
        /^fetal_echo$/i,                      // EXACT: fetal_echo
        /^fetal.*echo/i,                      // fetal_echocardiography, fetal_echo_report
        /^fetal.*echocard/i,                  // fetal_echocardiogram
        /^fetal.*cardiac.*study/i,            // fetal_cardiac_study
        /^fetal.*heart.*study/i,              // fetal_heart_study
        /^echo.*fetal/i,                      // echo_fetal
      ],
      component: FetalEchoDocument
    },

    // Fetal Assessment
    {
      name: 'Fetal Assessment',
      patterns: [
        /^fetal_assessment$/i,                // EXACT: fetal_assessment
        /^fetal.*assessment/i,                // fetal_assessments
        /^fetal.*status/i,                    // fetal_status
        /^fetal.*evaluation/i,                // fetal_evaluation
        /^fetal.*wellbeing/i,                 // fetal_wellbeing
        /^antenatal.*assessment/i,            // antenatal_assessment
        /^fetal.*monitoring/i,                // fetal_monitoring (but not surveillance)
      ],
      component: FetalAssessmentDocument
    },

    // Perinatal Mental Health Referral (postpartum/peripartum mental-health screening + referral: EPDS, PHQ-9, GAD-7, risk, referral)
    {
      name: 'Perinatal Mental Health Referral',
      patterns: [
        /^perinatal_mental_health_referral$/i,   // EXACT: perinatal_mental_health_referral
        /^perinatal.*mental.*health/i,           // perinatal mental health referral variants
      ],
      component: PerinatalMentalHealthReferralDocument
    },

    // Cervical Length Measurement (preterm-birth-risk cervical length; distinct from cervical_assessment labor exam)
    {
      name: 'Cervical Length Measurement',
      patterns: [
        /^cervical_length_measurement$/i,        // EXACT: cervical_length_measurement
        /^cervical.*length.*measurement/i,       // cervical_length_measurements
        /^cervical.*length/i,                    // cervical_length, cervical_length_scan
      ],
      component: CervicalLengthMeasurementDocument
    },

    // Cervical Assessment
    {
      name: 'Cervical Assessment',
      patterns: [
        /^cervical_assessment$/i,             // EXACT: cervical_assessment
        /^cervical.*assessment/i,             // cervical_assessment_records
        /^cervical.*exam/i,                   // cervical_exam, cervical_examination
        /^cervical.*evaluation/i,             // cervical_evaluation
        /^bishop.*score/i,                    // bishop_score
        /^cervical.*dilation/i,               // cervical_dilation_assessment
        /^cervical.*effacement/i,             // cervical_effacement
      ],
      component: CervicalAssessmentDocument
    },

    // Prenatal Visits
    {
      name: 'Prenatal Visits',
      patterns: [
        /^prenatal_visits$/i,                 // EXACT: prenatal_visits
        /^prenatal.*visit/i,                  // prenatal_visit, prenatal_visits
        /^antenatal.*visit/i,                 // antenatal_visit, antenatal_visits
        /^ob.*visit/i,                        // ob_visit, obstetric_visit
        /^obstetric.*visit/i,                 // obstetric_visits
        /^pregnancy.*visit/i,                 // pregnancy_visit
      ],
      component: PrenatalVisitsDocument
    },

    // Contraction Monitoring
    {
      name: 'Contraction Monitoring',
      patterns: [
        /^contraction_monitoring$/i,          // EXACT: contraction_monitoring
        /^contraction.*monitor/i,             // contraction_monitoring, contraction_monitors
        /^uterine.*contraction/i,             // uterine_contraction_monitoring
        /^labor.*contraction/i,               // labor_contraction_monitoring
      ],
      component: ContractionMonitoringDocument
    },

    // Labor & Delivery Records
    {
      name: 'Labor & Delivery Records',
      patterns: [
        /^labor_delivery_records$/i,           // EXACT: labor_delivery_records
        /^labor.*delivery/i,                   // labor_delivery, labor_and_delivery
        /^delivery.*record/i,                  // delivery_records, delivery_record
        /^l.*d.*record/i,                      // l_d_records
        /^birth.*record/i,                     // birth_records
      ],
      component: LaborDeliveryRecordsDocument
    },

    // APGAR Scores
    {
      name: 'APGAR Scores',
      patterns: [
        /^apgar_scores$/i,                    // EXACT: apgar_scores
        /^apgar.*score/i,                     // apgar_score, apgar_scores
        /^apgar$/i,                           // apgar
        /^newborn.*apgar/i,                   // newborn_apgar
        /^neonatal.*apgar/i,                  // neonatal_apgar
      ],
      component: ApgarScoresDocument
    },

    // Newborn Screening Results
    {
      name: 'Newborn Screening Results',
      patterns: [
        /^newborn_screening_results$/i,        // EXACT: newborn_screening_results
        /^newborn.*screening/i,                // newborn_screening, newborn_screening_results
        /^neonatal.*screening/i,               // neonatal_screening, neonatal_screening_results
      ],
      component: NewbornScreeningResultsDocument
    },

    // NICU Progress Notes
    {
      name: 'NICU Progress Notes',
      patterns: [
        /^nicu_progress_notes$/i,              // EXACT: nicu_progress_notes
        /^nicu.*progress/i,                    // nicu_progress, nicu_progress_notes
        /^nicu.*note/i,                        // nicu_notes
      ],
      component: NicuProgressNotesDocument
    },

    // Maternal Labs
    {
      name: 'Maternal Labs',
      patterns: [
        /^maternal_labs$/i,                   // EXACT: maternal_labs
        /^maternal.*lab/i,                    // maternal_lab, maternal_labs
        /^prenatal.*lab/i,                    // prenatal_lab, prenatal_labs
        /^pregnancy.*lab/i,                   // pregnancy_lab, pregnancy_labs
        /^ob.*lab/i,                          // ob_lab, ob_labs
        /^obstetric.*lab/i,                   // obstetric_lab, obstetric_labs
        /^antenatal.*lab/i,                   // antenatal_lab, antenatal_labs
      ],
      component: MaternalLabsDocument
    },

    // ========== WEIGHT MONITORING ==========
    {
      name: 'Weight Monitoring',
      patterns: [
        /^weight_monitoring$/i,               // EXACT match
        /^weight.*monitoring$/i,              // weight monitoring
        /^weight.*tracking$/i,               // weight tracking
        /^weight.*management$/i,             // weight management
      ],
      component: WeightMonitoringDocument
    },

    // Maternal Weight Monitoring
    {
      name: 'Maternal Weight Monitoring',
      patterns: [
        /^maternal_weight_monitoring$/i,       // EXACT: maternal_weight_monitoring
        /^maternal.*weight/i,                  // maternal_weight, maternal_weight_tracking
        /^pregnancy.*weight/i,                 // pregnancy_weight, pregnancy_weight_tracking
        /^weight.*monitoring.*pregnancy/i,     // weight_monitoring_pregnancy
        /^gestational.*weight/i,               // gestational_weight, gestational_weight_gain
        /^prenatal.*weight/i,                  // prenatal_weight
      ],
      component: MaternalWeightMonitoringDocument
    },

    // Pregnancy Symptoms
    {
      name: 'Pregnancy Symptoms',
      patterns: [
        /^pregnancy_symptoms$/i,              // EXACT: pregnancy_symptoms
        /^pregnancy.*symptom/i,               // pregnancy_symptom, pregnancy_symptoms
        /^prenatal.*symptom/i,                // prenatal_symptom, prenatal_symptoms
        /^maternal.*symptom/i,                // maternal_symptom, maternal_symptoms
        /^symptom.*pregnancy/i,               // symptom_of_pregnancy
        /^gestational.*symptom/i,             // gestational_symptom
      ],
      component: PregnancySymptomsDocument
    },

    // Birth Plan
    {
      name: 'Birth Plan',
      patterns: [
        /^birth_plan$/i,                      // EXACT: birth_plan
        /^birth.*plan/i,                      // birth_plan, birth_planning
        /^delivery.*plan/i,                   // delivery_plan
        /^labor.*preference/i,                // labor_preferences
        /^birth.*preference/i,                // birth_preferences
        /^delivery.*preference/i,             // delivery_preferences
        /^birthing.*plan/i,                   // birthing_plan
      ],
      component: BirthPlanDocument
    },

    // Birth History
    {
      name: 'Birth History',
      patterns: [
        /^birth_history$/i,                    // EXACT: birth_history
        /^birth.*history/i,                    // birth_history, birth_medical_history
        /^neonatal.*history/i,                 // neonatal_history
        /^delivery.*history/i,                 // delivery_history
      ],
      component: BirthHistoryDocument
    },

    // Anticipatory Guidance
    {
      name: 'Anticipatory Guidance',
      patterns: [
        /^anticipatory_guidance$/i,           // EXACT: anticipatory_guidance
        /^anticipatory.*guidance/i,           // anticipatory_guidance_records
        /^pediatric.*guidance/i,              // pediatric_guidance
        /^parent.*education/i,                // parent_education
        /^child.*guidance/i,                  // child_guidance
        /^developmental.*guidance/i,          // developmental_guidance
        /^well.*child.*guidance/i,            // well_child_guidance
      ],
      component: AnticipatoryGuidanceDocument
    },

    // ADHD Assessment
    {
      name: 'ADHD Assessment',
      patterns: [
        /^adhd_assessment$/i,                 // EXACT: adhd_assessment
        /^adhd.*assessment/i,                 // adhd_assessment_records
        /^attention.*deficit/i,               // attention_deficit_disorder
        /^adhd.*screening/i,                  // adhd_screening
        /^adhd.*evaluation/i,                 // adhd_evaluation
        /^behavioral.*assessment.*adhd/i,     // behavioral_assessment_adhd
      ],
      component: ADHDAssessmentDocument
    },

    // Parental Concerns
    {
      name: 'Parental Concerns',
      patterns: [
        /^parental_concerns$/i,               // EXACT: parental_concerns
        /^parental.*concerns/i,               // parental_concerns_records
        /^parent.*concerns/i,                 // parent_concerns
        /^caregiver.*concerns/i,              // caregiver_concerns
        /^family.*concerns/i,                 // family_concerns
        /^guardian.*concerns/i,               // guardian_concerns
      ],
      component: ParentalConcernsDocument
    },

    // Prenatal Education
    {
      name: 'Prenatal Education',
      patterns: [
        /^prenatal_education$/i,              // EXACT: prenatal_education
        /^prenatal.*education/i,              // prenatal_education_records
        /^patient.*education.*prenatal/i,     // patient_education_prenatal
        /^pregnancy.*education/i,             // pregnancy_education
        /^childbirth.*education/i,            // childbirth_education
        /^maternal.*education/i,              // maternal_education
        /^antenatal.*education/i,             // antenatal_education
      ],
      component: PrenatalEducationDocument
    },

    // Postpartum Planning
    {
      name: 'Postpartum Planning',
      patterns: [
        /^postpartum_planning$/i,             // EXACT: postpartum_planning
        /^postpartum.*planning/i,             // postpartum_planning_notes
        /^postpartum.*care.*plan/i,           // postpartum_care_plan
        /^after.*delivery.*plan/i,            // after_delivery_plan
        /^postnatal.*planning/i,              // postnatal_planning
        /^postpartum.*follow.*up/i,           // postpartum_follow_up
        /^postpartum.*management/i,           // postpartum_management
        /^maternal.*postpartum/i,             // maternal_postpartum
      ],
      component: PostpartumPlanningDocument
    },

    // Postpartum Notes
    {
      name: 'Postpartum Notes',
      patterns: [
        /^postpartum_notes$/i,               // EXACT: postpartum_notes
        /^postpartum.*note/i,                // postpartum_note, postpartum_notes
        /^postpartum/i,                      // postpartum (generic)
      ],
      component: PostpartumNotesDocument
    },

    // Pregnancy Risk Assessment
    {
      name: 'Pregnancy Risk Assessment',
      patterns: [
        /^pregnancy_risk_assessment$/i,       // EXACT: pregnancy_risk_assessment
        /^pregnancy.*risk.*assessment/i,      // pregnancy_risk_assessments
        /^prenatal.*risk.*assessment/i,       // prenatal_risk_assessment
        /^high.*risk.*pregnancy/i,            // high_risk_pregnancy
        /^maternal.*risk.*assessment/i,       // maternal_risk_assessment
        /^obstetric.*risk.*assessment/i,      // obstetric_risk_assessment
        /^antepartum.*risk/i,                 // antepartum_risk
        /^pregnancy.*risk.*stratification/i,  // pregnancy_risk_stratification
      ],
      component: PregnancyRiskAssessmentDocument
    },

    // Preeclampsia Monitoring
    {
      name: 'Preeclampsia Monitoring',
      patterns: [
        /^preeclampsia_monitoring$/i,          // EXACT: preeclampsia_monitoring
        /^preeclampsia.*monitor/i,             // preeclampsia_monitoring_records
        /^preeclamp.*track/i,                  // preeclampsia_tracking
        /^preeclampsia.*assessment/i,          // preeclampsia_assessment
        /^hypertensive.*disorder.*pregnancy/i, // hypertensive_disorders_of_pregnancy
        /^hellp.*syndrome/i,                   // hellp_syndrome
        /^gestational.*hypertension/i,         // gestational_hypertension
        /^maternal.*hypertension.*monitor/i,   // maternal_hypertension_monitoring
      ],
      component: PreeclampsiaMonitoringDocument
    },

    // Risk Counseling
    {
      name: 'Risk Counseling',
      patterns: [
        /^risk_counseling$/i,                  // EXACT: risk_counseling
        /^risk.*counseling/i,                  // risk_counseling_notes
        /^counseling.*risk/i,                  // counseling_risk
        /^patient.*risk.*counseling/i,         // patient_risk_counseling
        /^prognosis.*counseling/i,             // prognosis_counseling
        /^risk.*discussion/i,                  // risk_discussion
      ],
      component: RiskCounselingDocument
    },

    // Cultural Considerations
    {
      name: 'Cultural Considerations',
      patterns: [
        /^cultural_considerations$/i,          // EXACT: cultural_considerations
        /^cultural.*considerations/i,          // cultural_considerations_notes
        /^cultural.*factors/i,                 // cultural_factors
        /^cultural.*assessment/i,              // cultural_assessment
        /^culturally.*sensitive/i,             // culturally_sensitive_care
        /^dietary.*cultural/i,                 // dietary_cultural_preferences
        /^ethnic.*considerations/i,            // ethnic_considerations
      ],
      component: CulturalConsiderationsDocument
    },

    // Thyroid Management
    {
      name: 'Thyroid Management',
      patterns: [
        /^thyroid_management$/i,               // EXACT: thyroid_management
        /^thyroid.*management/i,               // thyroid_management_notes
        /^thyroid.*disorder/i,                 // thyroid_disorder_management
        /^hypothyroidism/i,                    // hypothyroidism
        /^hyperthyroidism/i,                   // hyperthyroidism
        /^thyroid.*function/i,                 // thyroid_function_monitoring
        /^tsh.*management/i,                   // tsh_management
        /^levothyroxine/i,                     // levothyroxine_therapy
      ],
      component: ThyroidManagementDocument
    },

    // Hormone Panels
    {
      name: 'Hormone Panels',
      patterns: [
        /^hormone_panels$/i,                   // EXACT: hormone_panels
        /^hormone.*panel/i,                    // hormone_panel, hormone_panels
        /^endocrine.*panel/i,                  // endocrine_panel
        /^hormone.*test/i,                     // hormone_tests
        /^hormonal.*assessment/i,              // hormonal_assessment
      ],
      component: HormonePanelsDocument
    },

    // Obstetric History
    {
      name: 'Obstetric History',
      patterns: [
        /^obstetric_history$/i,              // EXACT: obstetric_history
        /^obstetric.*history/i,              // obstetric_histories
        /^pregnancy.*history/i,              // pregnancy_history
        /^gravida.*para/i,                   // gravida_para
        /^ob.*history/i,                     // ob_history
        /^previous.*pregnancies/i,           // previous_pregnancies
        /^past.*obstetric/i,                 // past_obstetric_history
      ],
      component: ObstetricHistoryDocument
    },

    // Reproductive History
    {
      name: 'Reproductive History',
      patterns: [
        /^reproductive_history$/i,              // EXACT: reproductive_history
        /^reproductive.*history/i,              // reproductive_histories
        /^gynecologic.*history/i,               // gynecologic_history
        /^menstrual.*history/i,                 // menstrual_history
        /^contraceptive.*history/i,             // contraceptive_history
        /^sexual.*history/i,                    // sexual_history
        /^fertility.*history/i,                 // fertility_history
      ],
      component: ReproductiveHistoryDocument
    },

    // Donor Egg Cycle
    {
      name: 'Donor Egg Cycle',
      patterns: [
        /^donor_egg_cycle$/i,                   // EXACT: donor_egg_cycle
        /^donor.*egg.*cycle/i,                  // donor_egg_cycles
        /^donor.*egg/i,                         // donor_egg
        /^egg.*donor/i,                         // egg_donor
      ],
      component: DonorEggCycleDocument
    },

    // Fertility Tracking
    {
      name: 'Fertility Tracking',
      patterns: [
        /^fertility_tracking$/i,                // EXACT: fertility_tracking
        /^fertility.*tracking/i,                // fertility_tracking_records
        /^ovulation.*tracking/i,                // ovulation_tracking
        /^cycle.*tracking/i,                    // cycle_tracking
        /^fertility.*monitor/i,                 // fertility_monitoring
        /^reproductive.*tracking/i,             // reproductive_tracking
      ],
      component: FertilityTrackingDocument
    },

    // Single Embryo Transfer
    {
      name: 'Single Embryo Transfer Details',
      patterns: [
        /^single_embryo_transfer_details$/i,      // EXACT: single_embryo_transfer_details
      ],
      component: SingleEmbryoTransferDetailsDocument
    },
    {
      name: 'Embryo Transfer Procedure',
      patterns: [
        /^embryo_transfer_procedure$/i,           // EXACT: embryo_transfer_procedure
      ],
      component: EmbryoTransferProcedureDocument
    },
    {
      name: 'Single Embryo Transfer',
      patterns: [
        /^single_embryo_transfer$/i,              // EXACT: single_embryo_transfer
        /^single.*embryo.*transfer/i,             // single_embryo_transfer_records
        /^embryo.*transfer/i,                     // embryo_transfer
        /^set$/i,                                 // SET abbreviation
      ],
      component: SingleEmbryoTransferDocument
    },
    {
      name: 'IVF Cycle Monitoring',
      patterns: [
        /^ivf_cycle_monitoring$/i,                // EXACT: ivf_cycle_monitoring
        /^ivf.*cycle.*monitor/i,                  // ivf_cycle_monitoring variations
        /^ivf.*monitor/i,                         // ivf_monitoring
      ],
      component: IvfCycleMonitoringDocument
    },
    {
      name: 'Egg Retrieval Procedure',
      patterns: [
        /^egg_retrieval_procedure$/i,             // EXACT: egg_retrieval_procedure
        /^egg.*retrieval/i,                       // egg_retrieval variations
        /^oocyte.*retrieval/i,                    // oocyte_retrieval
      ],
      component: EggRetrievalProcedureDocument
    },
    {
      name: 'Ovarian Stimulation Protocol',
      patterns: [
        /^ovarian_stimulation_protocol$/i,        // EXACT: ovarian_stimulation_protocol
        /^ovarian.*stimulation/i,                 // ovarian_stimulation variations
        /^controlled.*ovarian/i,                  // controlled_ovarian_stimulation
      ],
      component: OvarianStimulationProtocolDocument
    },
    {
      name: 'Fertility Medication Management',
      patterns: [
        /^fertility_medication_management$/i,     // EXACT: fertility_medication_management
        /^fertility.*medication/i,                // fertility_medication variations
      ],
      component: FertilityMedicationManagementDocument
    },

    // Caregiver Assessment
    {
      name: 'Caregiver Assessment',
      patterns: [
        /^caregiver_assessment$/i,                // EXACT: caregiver_assessment
        /^caregiver.*assessment/i,                // caregiver_assessments
        /^caregiver.*evaluation/i,                // caregiver_evaluation
        /^family.*caregiver.*assessment/i,        // family_caregiver_assessment
        /^caregiver.*support.*assessment/i,       // caregiver_support_assessment
      ],
      component: CaregiverAssessmentDocument
    },

    // Psychiatric Evaluations (December 2025)
    {
      name: 'Psychiatric Evaluations',
      patterns: [
        /^psychiatric_evaluations$/i,                  // EXACT: psychiatric_evaluations
        /^psychiatric.*evaluation/i,                   // psychiatric_evaluation, psychiatric_evaluations
        /^psych.*eval/i,                               // psych_eval
      ],
      component: PsychiatricEvaluationsDocument
    },

    // Psychiatric Treatment Plan (Dedicated)
    {
      name: 'Psychiatric Treatment Plan',
      patterns: [
        /^psychiatric_treatment_plan$/i,               // EXACT match: psychiatric_treatment_plan
        /^psychiatric.*treatment.*plan/i,              // psychiatric_treatment_plan
        /^psych.*treatment.*plan/i,                    // psych_treatment_plan
        /^mental.*health.*treatment.*plan/i,           // mental_health_treatment_plan
      ],
      component: PsychiatricTreatmentPlanDocument
    },

    // Suicide Risk Assessment
    {
      name: 'Suicide Risk Assessment',
      patterns: [
        /^suicide_risk_assessment$/i,                  // EXACT match: suicide_risk_assessment
        /^suicide.*risk.*assessment/i,                 // suicide_risk_assessment
        /^suicide.*assessment/i,                       // suicide_assessment
        /^suicidal.*risk.*assessment/i,                // suicidal_risk_assessment
      ],
      component: SuicideRiskAssessmentDocument
    },

    // Follow-Up Plan
    {
      name: 'Follow-Up Plan',
      patterns: [
        /^follow_up_plan$/i,                           // EXACT match: follow_up_plan
        /^follow.*up.*plan/i,                          // follow_up_plan, followup_plan, follow up plan
        /^followup.*plan/i,                            // followup_plan, followupplan
      ],
      component: FollowUpPlanDocument
    },

    // Follow-Up Enhanced
    {
      name: 'Follow-Up Enhanced',
      patterns: [
        /^follow_up_enhanced$/i,            // EXACT: follow_up_enhanced
        /^follow.*up.*enhanced/i,           // follow_up_enhanced, followup_enhanced
        /^enhanced.*follow.*up/i,           // enhanced_follow_up
      ],
      component: FollowUpEnhancedDocument
    },

    // Psychotropic Medications
    {
      name: 'Psychotropic Medications',
      patterns: [
        /^psychotropic_medications$/i,
        /^psychotropic.*med/i,
        /^psych.*meds/i
      ],
      component: PsychotropicMedicationsDocument
    },

    // Vaccination Records
    {
      name: 'Vaccination Records',
      patterns: [
        /^vaccination.*record/i,                  // vaccination_records
        /^immunization.*record/i,                 // immunization_records
        /^vaccine.*history/i,                     // vaccine_history
        /^immunization.*history/i,                // immunization_history
      ],
      component: VaccinationRecordsDocument
    },

    // Home Safety
    {
      name: 'Home Safety',
      patterns: [
        /^home[_\s]?safety$/i,                    // home_safety (exact match)
      ],
      component: HomeSafetyDocument
    },

    // Fall Prevention Education
    {
      name: 'Fall Prevention Education',
      patterns: [
        /^fall_prevention_education$/i,           // EXACT: fall_prevention_education
        /^fall[_\s]?prevention[_\s]?education$/i, // fall prevention education variations
      ],
      component: FallPreventionEducationDocument
    },

    // Cognitive Screening
    {
      name: 'Cognitive Screening',
      patterns: [
        /^cognitive_screening$/i,                  // EXACT: cognitive_screening
        /^cognitive[_\s]?screening$/i,             // cognitive screening variations
      ],
      component: CognitiveScreeningDocument
    },

    // Home Monitoring
    {
      name: 'Home Monitoring',
      patterns: [
        /^home.*monitoring/i,                     // home_monitoring
        /^remote.*monitoring/i,                   // remote_monitoring
        /^patient.*monitoring/i,                  // patient_monitoring
        /^rpm$/i,                                 // RPM (Remote Patient Monitoring)
      ],
      component: HomeMonitoringDocument
    },

    // Medication Recommendations (clinical recommendations)
    {
      name: 'Medication Recommendations',
      patterns: [
        /^medication_recommendations$/i,          // medication_recommendations (exact match)
      ],
      component: MedicationRecommendationsDocument
    },

    // Addiction Medicine Consultations
    {
      name: 'Addiction Medicine Consultations',
      patterns: [
        /^addiction_medicine_consultations$/i,    // addiction_medicine_consultations (exact match)
        /^addiction.*medicine/i,
        /^addiction.*consult/i,
        /^substance.*use.*disorder/i,
        /^sud.*consult/i
      ],
      component: AddictionMedicineConsultationsDocument
    },

    // Advance Directives (without "d" - different from Advanced Directives)
    {
      name: 'Advance Directives',
      patterns: [
        /^advance_directives$/i,                   // EXACT: advance_directives
        /^advance_directive$/i,                    // EXACT: advance_directive (singular)
      ],
      component: AdvanceDirectivesDocument
    },

    // ========== MEDICAL POWER OF ATTORNEY ==========
    {
      name: 'Medical Power of Attorney',
      patterns: [
        /^medical_power_of_attorney$/i,            // EXACT match
        /^medical.*power.*of.*attorney/i,          // medical power of attorney
      ],
      component: MedicalPowerOfAttorneyDocument
    },

    // ========== MEDICAL RECONCILIATION FORMS ==========
    {
      name: 'Medical Reconciliation Forms',
      patterns: [
        /^medical_reconciliation_forms$/i,            // EXACT match
        /^medical.*reconciliation.*form/i,            // medical reconciliation forms
      ],
      component: MedicalReconciliationFormsDocument
    },

    // ========== NEUROMUSCULAR DISORDER ==========
    {
      name: 'Neuromuscular Disorder',
      patterns: [
        /^neuromuscular_disorder$/i,            // EXACT match
        /^neuromuscular.*disorder/i,            // neuromuscular disorder
        /^neuromuscular/i,                      // neuromuscular (any)
      ],
      component: NeuromuscularDisorderDocument
    },

    // ========== HOME HEALTH ORDERS ==========
    {
      name: 'Home Health Orders',
      patterns: [
        /^home_health_orders$/i,               // EXACT match: home_health_orders
        /^home.*health.*order/i,               // home_health_orders, home_health_order
      ],
      component: HomeHealthOrdersDocument
    },

    {
      name: 'Goals of Care Discussions',
      patterns: [
        /^goals_of_care_discussions$/i,            // EXACT: goals_of_care_discussions
        /^goals.*of.*care.*discussions?$/i,        // goals_of_care_discussion
        /^goals.*of.*care$/i,                      // goals_of_care
        /^code.*status.*discussion/i,              // code_status_discussion
        /^family.*meeting/i,                       // family_meeting
        /^icu.*discussion/i,                       // icu_discussion
        /^care.*conference/i,                      // care_conference
      ],
      component: GoalsOfCareDiscussionsDocument
    },

    // Advance Care Planning (separate from Advanced Directives)
    {
      name: 'Advance Care Planning',
      patterns: [
        /^advance_care_planning$/i,                // EXACT: advance_care_planning
        /^advance.*care.*planning/i,               // advance_care_planning
        /^care.*planning/i,                        // care_planning
        /^acp/i,                                   // acp (abbreviation)
      ],
      component: AdvanceCarePlanningDocument
    },

    // Research Consent Forms
    {
      name: 'Research Consent Forms',
      patterns: [
        /^research_consent_forms$/i,               // EXACT: research_consent_forms
        /^research.*consent/i,                     // research_consent
        /^informed.*consent/i,                     // informed_consent
        /^clinical.*trial.*consent/i,              // clinical_trial_consent
        /^study.*consent/i,                        // study_consent
        /^consent.*form/i,                         // consent_form
        /^trial.*enrollment/i,                     // trial_enrollment
      ],
      component: ResearchConsentFormsDocument
    },

    // Performance Status
    {
      name: 'Performance Status',
      patterns: [
        /^performance_status$/i,                   // EXACT: performance_status
        /^performance.*status/i,                   // performance_status
        /^karnofsky/i,                             // karnofsky
        /^kps/i,                                   // KPS
        /^ecog/i,                                  // ECOG
        /^lansky/i,                                // lansky
        /^functional.*capacity/i,                  // functional_capacity
      ],
      component: PerformanceStatusDocument
    },

    // Response Assessment
    {
      name: 'Response Assessment',
      patterns: [
        /^response_assessment$/i,                  // EXACT: response_assessment
        /^response.*assessment/i,                  // response_assessment
        /^treatment.*response/i,                   // treatment_response
        /^recist/i,                                // RECIST criteria
        /^rano/i,                                  // RANO criteria
        /^tumor.*response/i,                       // tumor_response
        /^disease.*response/i,                     // disease_response
        /^progression.*free/i,                     // progression_free_survival
        /^pfs/i,                                   // PFS
        /^measurable.*disease/i,                   // measurable_disease
      ],
      component: ResponseAssessmentDocument
    },

    // Quality Assurance
    {
      name: 'Quality Assurance',
      patterns: [
        /^quality_assurance$/i,                    // EXACT: quality_assurance
        /^quality.*assurance/i,                    // quality_assurance_report
        /^qa.*report/i,                            // qa_report
        /^peer.*review/i,                          // peer_review
        /^case.*review/i,                          // case_review
        /^outside.*consultation/i,                 // outside_consultation
        /^tumor.*board.*qa/i,                      // tumor_board_qa
      ],
      component: QualityAssuranceDocument
    },

    // Lymph Node Cytomorphology
    {
      name: 'Lymph Node Cytomorphology',
      patterns: [
        /^lymph_node_cytomorphology$/i,           // EXACT: lymph_node_cytomorphology
        /^lymph.*node.*cytomorphology/i,          // lymph_node_cytomorphology
        /^lymph.*node.*cyto/i,                    // lymph_node_cyto
        /^cytomorphology.*lymph/i,                // cytomorphology_lymph_node
        /^node.*cytomorphology/i,                 // node_cytomorphology
        /^lymph.*cyto.*report/i,                  // lymph_cyto_report
      ],
      component: LymphNodeCytomorphologyDocument
    },

    // Staging Summary
    {
      name: 'Staging Summary',
      patterns: [
        /^staging_summary$/i,                      // EXACT: staging_summary
        /^staging.*summary/i,                      // staging_summary
        /^summary.*staging/i,                      // summary_staging
        /^oncology.*staging/i,                     // oncology_staging
        /^lymphoma.*staging/i,                     // lymphoma_staging
        /^stage.*summary/i,                        // stage_summary
      ],
      component: StagingSummaryDocument
    },

    // Quality Metrics
    {
      name: 'Quality Metrics',
      patterns: [
        /^quality_metrics$/i,                      // EXACT: quality_metrics
        /^quality.*metrics/i,                      // quality_metrics, quality_performance_metrics
        /^performance.*metrics/i,                  // performance_metrics
        /^quality.*indicators/i,                   // quality_indicators
        /^clinical.*quality/i,                     // clinical_quality
        /^quality.*measures/i,                     // quality_measures
        /^metric.*tracking/i,                      // metric_tracking
        /^benchmark.*data/i,                       // benchmark_data
        /^quality.*improvement/i,                  // quality_improvement
      ],
      component: QualityMetricsDocument
    },

    // Case Management
    {
      name: 'Case Management',
      patterns: [
        /^case_management$/i,                      // case_management (exact match)
        /^case.*management/i,                      // case_management, case_manager
        /^care.*management/i,                      // care_management
        /^social.*services/i,                      // social_services
        /^case.*coordination/i                     // case_coordination
      ],
      component: CaseManagementDocument
    },

    // Pain Management Plan
    {
      name: 'Pain Management Plan',
      patterns: [
        /^pain_management_plan$/i,                 // pain_management_plan (exact match)
        /^pain.*management/i,                      // pain_management, pain_management_plan
        /^chronic.*pain/i,                         // chronic_pain, chronic_pain_management
        /^pain.*plan/i,                            // pain_plan, pain_management_plan
        /^pain.*control/i                          // pain_control
      ],
      component: PainManagementPlanDocument
    },

    // ========== PAIN ASSESSMENT FORMS ==========
    {
      name: 'Pain Assessment Forms',
      patterns: [
        /^pain_assessment_forms$/i,                  // pain_assessment_forms (exact match)
        /^pain.*assessment.*form/i,                  // pain_assessment_form, pain_assessment_forms
        /^pain.*scale/i,                             // pain_scale, pain_scales
        /^pain.*questionnaire/i,                     // pain_questionnaire
        /^pain.*rating/i,                            // pain_rating, pain_rating_scale
      ],
      component: PainAssessmentFormsDocument
    },

    // ========== INTERVENTIONAL PAIN PROCEDURES ==========
    {
      name: 'Interventional Pain Procedures',
      patterns: [
        /^interventional_pain_procedures$/i,         // interventional_pain_procedures (exact match)
        /^interventional.*pain/i,                    // interventional_pain, interventional_pain_procedures
        /^pain.*intervention/i,                      // pain_intervention, pain_interventions
        /^nerve.*block/i,                            // nerve_block, nerve_blocks
        /^epidural.*injection/i,                     // epidural_injection, epidural_injections
        /^spinal.*injection/i,                       // spinal_injection, spinal_injections
      ],
      component: InterventionalPainProceduresDocument
    },

    // ========== PAIN MEDICATION AGREEMENTS ==========
    {
      name: 'Pain Medication Agreements',
      patterns: [
        /^pain_medication_agreements$/i,             // pain_medication_agreements (exact match)
        /^pain.*medication.*agreement/i,             // pain_medication_agreement, pain_medication_agreements
        /^medication.*agreement/i,                   // medication_agreement, medication_agreements
        /^opioid.*agreement/i,                       // opioid_agreement, opioid_agreements
        /^pain.*contract/i,                          // pain_contract, pain_contracts
      ],
      component: PainMedicationAgreementsDocument
    },

    // ========== PAIN FUNCTIONAL ASSESSMENT ==========
    {
      name: 'Pain Functional Assessment',
      patterns: [
        /^pain_functional_assessment$/i,             // pain_functional_assessment (exact match)
        /^pain.*functional.*assessment/i,            // pain_functional_assessment
        /^functional.*pain.*assessment/i,            // functional_pain_assessment
        /^pain.*functional/i,                        // pain_functional
      ],
      component: PainFunctionalAssessmentDocument
    },

    // ========== MULTIMODAL PAIN THERAPY ==========
    {
      name: 'Multimodal Pain Therapy',
      patterns: [
        /^multimodal_pain_therapy$/i,                // multimodal_pain_therapy (exact match)
        /^multimodal.*pain/i,                        // multimodal_pain, multimodal_pain_therapy
        /^combined.*pain.*therapy/i,                 // combined_pain_therapy
        /^integrative.*pain/i,                       // integrative_pain, integrative_pain_management
        /^comprehensive.*pain.*treatment/i,          // comprehensive_pain_treatment
      ],
      component: MultimodalPainTherapyDocument
    },

    // ========== OPIOID RISK ASSESSMENT ==========
    {
      name: 'Opioid Risk Assessment',
      patterns: [
        /^opioid_risk_assessment$/i,                 // opioid_risk_assessment (exact match)
        /^opioid.*risk/i,                            // opioid_risk, opioid_risk_assessment
        /^opioid.*assessment/i,                      // opioid_assessment
        /^opioid.*screening/i,                       // opioid_screening
        /^opioid.*evaluation/i,                      // opioid_evaluation
        /^opioid.*risk.*tool/i,                      // opioid_risk_tool
      ],
      component: OpioidRiskAssessmentDocument
    },

    // Harm Reduction Counseling
    {
      name: 'Harm Reduction Counseling',
      patterns: [
        /^harm_reduction_counseling$/i,            // harm_reduction_counseling (exact match)
        /^harm.*reduction/i,                       // harm_reduction, harm_reduction_counseling
        /^needle.*exchange/i,                      // needle_exchange_counseling
        /^overdose.*prevention/i,                  // overdose_prevention_counseling
        /^safer.*use.*counseling/i,                // safer_use_counseling
        /^substance.*harm.*reduction/i             // substance_harm_reduction
      ],
      component: HarmReductionCounselingDocument
    },

    // Chief Complaints
    {
      name: 'Chief Complaints',
      patterns: [
        /^chief_complaints$/i,                     // chief_complaints (exact match)
        /^chief.*complaint/i,                      // chief_complaint, chief_complaints
        /^presenting.*complaint/i,                 // presenting_complaint, presenting_complaints
        /^primary.*complaint/i,                    // primary_complaint
        /^reason.*for.*visit/i,                    // reason_for_visit
        /^presenting.*problem/i                    // presenting_problem
      ],
      component: ChiefComplaintsDocument
    },

    // Mental Health Assessments
    {
      name: 'Mental Health Assessments',
      patterns: [
        /^mental_health_assessments$/i,            // mental_health_assessments (exact match)
        /^mental.*health.*assessment/i,            // mental_health_assessment, mental_health_assessments
        /^psychiatric.*assessment/i,               // psychiatric_assessment, psychiatric_assessments
        /^psych.*eval/i,                          // psych_eval, psychiatric_evaluation
        /^mental.*status.*assessment/i,            // mental_status_assessment
        /^behavioral.*health.*assessment/i         // behavioral_health_assessment
      ],
      component: MentalHealthAssessmentsDocument
    },

    // Behavioral Assessment (Pediatric)
    {
      name: 'Behavioral Assessment',
      patterns: [
        /^behavioral_assessment$/i,               // behavioral_assessment (exact match)
        /^behavioral_assessments$/i,              // behavioral_assessments
        /^behavioral.*assess/i,                   // behavioral_assessment, behavioral_assessments
        /^child.*behavior.*assess/i,              // child_behavior_assessment
        /^pediatric.*behavior.*assess/i,          // pediatric_behavior_assessment
      ],
      component: BehavioralAssessmentDocument
    },

    // Medication Safety Alerts (MUST come before Medication Safety — more specific)
    {
      name: 'Medication Safety Alerts',
      patterns: [
        /^medication_safety_alerts$/i,             // EXACT: medication_safety_alerts
        /^medication.*safety.*alert/i,             // medication_safety_alerts
        /^med.*safety.*alert/i,                   // med_safety_alerts
        /^drug.*safety.*alert/i,                  // drug_safety_alerts
      ],
      component: MedicationSafetyAlertsDocument
    },

    // Medication Safety
    {
      name: 'Medication Safety',
      patterns: [
        /^medication_safety$/i,                    // medication_safety (exact match)
        /^med.*safety/i,                          // med_safety, medication_safety
        /^drug.*safety/i,                         // drug_safety
      ],
      component: MedicationSafetyDocument
    },

    // Antibiotic Stewardship
    {
      name: 'Antibiotic Stewardship',
      patterns: [
        /^antibiotic_stewardship$/i,              // EXACT match
        /^antibiotic.*stewardship/i,              // antibiotic stewardship
        /^antimicrobial.*stewardship/i,           // antimicrobial stewardship
        /^stewardship.*antibiotic/i,              // stewardship antibiotic
      ],
      component: AntibioticStewardshipDocument
    },

    // Antibiogram Reports
    {
      name: 'Antibiogram Reports',
      patterns: [
        /^antibiogram_reports$/i,                 // EXACT match
        /^antibiogram.*report/i,                  // antibiogram reports
        /^antibiogram/i,                          // antibiogram
        /^susceptibility.*report/i,               // susceptibility report
        /^antibiotic.*susceptibility/i,           // antibiotic susceptibility
      ],
      component: AntibiogramReportsDocument
    },

    // Anticoagulation Management
    {
      name: 'Anticoagulation Management',
      patterns: [
        /^anticoagulation_management$/i,          // anticoagulation_management (exact match)
        /^anticoagul.*manage/i,                   // anticoagulation_management
        /^anticoag.*therapy/i,                    // anticoag_therapy
        /^warfarin.*manage/i,                     // warfarin_management
        /^inr.*manage/i,                          // inr_management
        /^blood.*thinner.*manage/i,               // blood_thinner_management
      ],
      component: AnticoagulationManagementDocument
    },

    // Medical Alerts
    {
      name: 'Medical Alerts',
      patterns: [
        /^medical_alerts$/i,                       // EXACT match for medical_alerts collection
        /^medical.*alert/i,                        // medical_alert, medical_alerts
        /^clinical.*alert/i,                       // clinical_alert, clinical_alerts
        /^patient.*alert/i,                        // patient_alert, patient_alerts
        /^safety.*alert/i,                         // safety_alert, safety_alerts
        /^allergy.*alert/i,                        // allergy_alert
        /^drug.*interaction.*alert/i,              // drug_interaction_alert
        /^critical.*lab.*value/i,                  // critical_lab_value
        /^panic.*value/i,                          // panic_value
        /^fall.*risk$/i,                           // fall_risk (EXACT END - NOT fall_risk_assessments)
      ],
      component: MedicalAlertsDocument
    },

    // Sleep Study Reports (June 2026: the duplicate sleep_study collection was merged
    // into sleep_study_reports — same polysomnography artifact, renamed fields; the
    // broad sleep-study pattern below also catches any legacy sleep_study references)
    {
      name: 'Sleep Study Reports',
      patterns: [
        /^sleep_study_reports$/i,                  // EXACT match: sleep_study_reports collection
        /^sleep.*study/i,                          // sleep_study, sleep_studies
        /^sleep.*report/i,                         // sleep_report, sleep_reports
        /^polysomnography/i,                       // polysomnography
        /^psg$/i,                                  // PSG abbreviation
        /^sleep.*lab/i,                            // sleep_lab
        /^overnight.*sleep/i,                      // overnight_sleep_study
        /^sleep.*apnea.*test/i,                    // sleep_apnea_test
      ],
      component: SleepStudyReportsDocument
    },

    // Coagulation Studies (PT, INR, PTT, fibrinogen, D-dimer)
    {
      name: 'Coagulation Studies',
      patterns: [
        /^coagulation_studies$/i,                  // EXACT match: coagulation_studies collection
        /^coagulation.*stud/i,                     // coagulation_study, coagulation_studies
        /^coag.*stud/i,                            // coag_study, coag_studies
        /^clotting.*stud/i,                        // clotting_study, clotting_studies
        /^bleeding.*stud/i,                        // bleeding_study
        /^pt.*inr/i,                               // pt_inr
        /^coagulation.*panel/i,                    // coagulation_panel
        /^coag.*panel/i,                           // coag_panel
      ],
      component: CoagulationStudiesDocument
    },

    // Liver Function Assessments (hepatic panel, LFTs, AST/ALT, bilirubin, albumin)
    {
      name: 'Liver Function Assessments',
      patterns: [
        /^liver_function_assessments$/i,           // EXACT match: liver_function_assessments collection
        /^liver.*function.*assessment/i,           // liver_function_assessment, liver_function_assessments
        /^liver.*assessment/i,                     // liver_assessment
        /^hepatic.*assessment/i,                   // hepatic_assessment
        /^lft.*assessment/i,                       // lft_assessment
        /^liver.*function.*test/i,                 // liver_function_test, liver_function_tests
        /^hepatic.*panel/i,                        // hepatic_panel
        /^liver.*panel/i,                          // liver_panel
        /^hepatic.*function/i,                     // hepatic_function
      ],
      component: LiverFunctionAssessmentsDocument
    },

    // Nutrition Assessments (dietary evaluation, calorie intake, protein goals, pre-op diet)
    // NOTE: Do NOT add /^nutritional.*/ patterns here - those go to NutritionalAssessmentDocument
    {
      name: 'Nutrition Assessments',
      patterns: [
        /^nutrition_assessments$/i,                // EXACT match: nutrition_assessments collection
        /^nutrition_assessment$/i,                 // EXACT match: nutrition_assessment (singular, no "al")
        /^dietary.*assessment/i,                   // dietary_assessment, dietary_assessments
        /^diet.*assessment/i,                      // diet_assessment
        /^calorie.*assessment/i,                   // calorie_assessment
        /^protein.*assessment/i,                   // protein_assessment (protein goals)
        /^dietary.*evaluation/i,                   // dietary_evaluation
      ],
      component: NutritionAssessmentsDocument
    },

    // Enteral Feeding Assessment (tube feeding, enteral nutrition, formula, feeding tolerance)
    {
      name: 'Enteral Feeding Assessment',
      patterns: [
        /^enteral_feeding_assessment$/i,          // Exact match
        /^enteral.*feeding.*assessment/i,         // enteral_feeding_assessment
        /^enteral.*feeding/i,                     // enteral_feeding
        /^tube.*feeding.*assessment/i,            // tube_feeding_assessment
        /^enteral.*nutrition.*assessment/i,       // enteral_nutrition_assessment
        /^feeding.*tube.*assessment/i,            // feeding_tube_assessment
      ],
      component: EnteralFeedingAssessmentDocument
    },

    // Food Insecurity (food access, nutrition programs, SNAP, food bank, meal delivery)
    {
      name: 'Food Insecurity',
      patterns: [
        /^food_insecurity$/i,                      // EXACT match: food_insecurity collection
        /^food.*insecurity/i,                      // food_insecurity
        /^food.*security/i,                        // food_security
        /^food.*access/i,                          // food_access
        /^nutrition.*program/i,                    // nutrition_programs
        /^food.*assistance/i,                      // food_assistance
        /^food.*bank/i,                            // food_bank
        /^meal.*delivery/i,                        // meal_delivery
        /^snap.*benefit/i,                         // snap_benefits
      ],
      component: FoodInsecurityDocument
    },

    // Barriers and Psychosocial Issues
    {
      name: 'Social Determinants of Health',
      patterns: [
        /^social_determinants_of_health$/i,          // exact match
        /^social.*determinants.*health/i,            // social_determinants_of_health variations
        /^sdoh$/i,                                   // SDOH acronym exact
      ],
      component: SocialDeterminantsOfHealthDocument
    },

    // Medication Access Programs (patient assistance, 340B, copay assistance)
    {
      name: 'Medication Access Programs',
      patterns: [
        /^medication_access_programs$/i,             // exact match
        /^medication.*access.*program/i,             // medication_access_programs variations
        /^patient.*assistance.*program/i,            // patient_assistance_program
        /^pap$/i,                                    // PAP acronym
        /^340b.*program/i,                           // 340B program
        /^copay.*assistance/i,                       // copay_assistance
        /^pharmaceutical.*assistance/i,              // pharmaceutical_assistance
        /^drug.*assistance/i,                        // drug_assistance
      ],
      component: MedicationAccessProgramsDocument
    },

    {
      name: 'Barriers Psychosocial Issues',
      patterns: [
        /^barriers_psychosocial_issues$/i,           // exact match
        /^barriers.*psychosocial/i,                  // barriers_psychosocial*
        /^psychosocial.*issues/i,                    // psychosocial_issues
        /^psychosocial.*barriers/i,                  // psychosocial_barriers
        /^social.*barriers/i,                        // social_barriers
        /^barriers.*to.*care/i,                      // barriers_to_care
      ],
      component: BarriersPsychosocialIssuesDocument
    },

    // Doctor's Medication Recommendations (doctor's notes)
    {
      name: 'Doctors Medication Recommendations',
      patterns: [
        /^doctors.*medication.*recommend/i,       // doctors_medication_recommendations
        /^physician.*medication.*recommend/i,     // physician_medication_recommendations
        /^provider.*medication.*recommend/i,      // provider_medication_recommendations
      ],
      component: DoctorsMedicationRecommendationsDocument
    },

    // Colonoscopy Reports (MUST be before Colorectal Colonoscopies for specificity)
    {
      name: 'Colonoscopy Reports',
      patterns: [
        /^colonoscopy_reports$/i,                 // EXACT: colonoscopy_reports
        /^colonoscopy.*report/i,                  // colonoscopy_reports, colonoscopy_report
        /^endoscopy.*report.*colon/i,             // endoscopy_report_colon
        /^gi.*endoscopy.*report/i,                // gi_endoscopy_reports
      ],
      component: ColonoscopyReportsDocument
    },

    // Extraintestinal Manifestations
    {
      name: 'Extraintestinal Manifestations',
      patterns: [
        /^extraintestinal_manifestations$/i,      // EXACT: extraintestinal_manifestations
        /^extraintestinal.*manifest/i,            // extraintestinal_manifestations
        /^eim$/i,                                 // EIM abbreviation
        /^ibd.*extraintestinal/i,                 // ibd_extraintestinal
        /^extra.*intestinal/i,                    // extra_intestinal
      ],
      component: ExtraintestinalManifestationsDocument
    },

    // Facility
    {
      name: 'Facility',
      patterns: [
        /^facility$/i,                            // EXACT: facility
        /^facility.*profile/i,                    // facility_profile
        /^facility.*information/i,                // facility_information
        /^facility.*details/i,                    // facility_details
        /^hospital.*profile/i,                    // hospital_profile
        /^medical.*center.*profile/i,             // medical_center_profile
      ],
      component: FacilityDocument
    },

    // IBD Surgical Planning
    {
      name: 'IBD Surgical Planning',
      patterns: [
        /^ibd_surgical_planning$/i,               // EXACT: ibd_surgical_planning
        /^ibd.*surgical.*plan/i,                  // ibd_surgical_planning
        /^surgical.*planning.*ibd/i,              // surgical_planning_ibd
        /^ibd.*surgery.*plan/i,                   // ibd_surgery_planning
        /^colitis.*surgical.*plan/i,              // colitis_surgical_planning
        /^uc.*surgical.*plan/i,                   // uc_surgical_planning
        /^crohn.*surgical.*plan/i,                // crohn_surgical_planning
      ],
      component: IbdSurgicalPlanningDocument
    },

    // Bone Health
    {
      name: 'Bone Health',
      patterns: [
        /^bone_health$/i,                         // EXACT: bone_health
        /^bone.*health/i,                         // bone_health
        /^osteo/i,                                // osteoporosis, osteopenia
        /^dexa/i,                                 // dexa_scan, dexa
        /^bone.*density/i,                        // bone_density
        /^fracture.*risk/i,                       // fracture_risk_assessment
        /^skeletal.*health/i,                     // skeletal_health
      ],
      component: BoneHealthDocument
    },

    // Compression Therapy
    {
      name: 'Compression Therapy',
      patterns: [
        /^compression_therapy$/i,                  // EXACT: compression_therapy
        /^compression.*therapy/i,                  // compression_therapy
        /^compression.*garment/i,                  // compression_garment
        /^lymphedema.*compression/i,               // lymphedema_compression
        /^venous.*compression/i,                   // venous_compression
      ],
      component: CompressionTherapyDocument
    },

    // Closure Technique
    {
      name: 'Closure Technique',
      patterns: [
        /^closure_technique$/i,                    // EXACT: closure_technique
        /^closure.*technique/i,                    // closure_technique variants
        /^surgical.*closure/i,                     // surgical_closure
        /^wound.*closure/i,                        // wound_closure
      ],
      component: ClosureTechniqueDocument
    },

    // Colorectal Colonoscopies
    {
      name: 'Colorectal Colonoscopies',
      patterns: [
        /^colorectal.*colonoscop/i,               // colorectal_colonoscopies
        /^colonoscop/i,                           // colonoscopies, colonoscopy
        /^colon.*endoscop/i,                      // colon_endoscopies
      ],
      component: ColorectalColonoscopiesDocument
    },

    // Colorectal Surgery Consultations
    {
      name: 'Colorectal Surgery Consultations',
      patterns: [
        /^colorectal.*surgery.*consult/i,         // colorectal_surgery_consultations
        /^colon.*surgery.*consult/i,              // colon_surgery_consultations
        /^rectal.*surgery.*consult/i,             // rectal_surgery_consultations
      ],
      component: ColorectalSurgeryConsultationsDocument
    },

    // Colorectal Surgery Assessment
    {
      name: 'Colorectal Surgery Assessment',
      patterns: [
        /^colorectal_surgery_assessment$/i,       // EXACT: colorectal_surgery_assessment
        /^colorectal.*surgery.*assess/i,          // colorectal_surgery_assessment variations
        /^colon.*surgery.*assess/i,               // colon_surgery_assessment
        /^rectal.*surgery.*assess/i,              // rectal_surgery_assessment
      ],
      component: ColorectalSurgeryAssessmentDocument
    },

    // Nutritional Assessment (with "al" - different from nutrition_assessments)
    // NOTE: Only patterns with "nutritional" (with "al") go here
    {
      name: 'Nutritional Assessment',
      patterns: [
        /^nutritional_assessment$/i,              // EXACT: nutritional_assessment
        /^nutritional.*assess/i,                  // nutritional_assessment variations
        /^nutritional.*evaluat/i,                 // nutritional_evaluation
      ],
      component: NutritionalAssessmentDocument
    },

    // PSC Management (Primary Sclerosing Cholangitis)
    {
      name: 'PSC Management',
      patterns: [
        /^psc_management$/i,                      // EXACT: psc_management
        /^psc.*manage/i,                          // psc_management variations
        /^primary.*sclerosing.*cholangitis/i,     // primary_sclerosing_cholangitis
        /^sclerosing.*cholangitis/i,              // sclerosing_cholangitis
        /^cholangitis.*manage/i,                  // cholangitis_management
      ],
      component: PSCManagementDocument
    },

    // Continuous Infusions (ICU/Critical Care)
    {
      name: 'Continuous Infusions',
      patterns: [
        /^continuous_infusions$/i,                // EXACT: continuous_infusions
        /^continuous.*infusion/i,                 // continuous_infusions variations
        /^iv.*infusion/i,                         // iv_infusions
        /^icu.*infusion/i,                        // icu_infusions
        /^vasopressor.*infusion/i,                // vasopressor_infusions
        /^sedation.*infusion/i,                   // sedation_infusions
      ],
      component: ContinuousInfusionsDocument
    },

    // Glasgow Coma Scale (Neurological Assessment)
    {
      name: 'Glasgow Coma Scale',
      patterns: [
        /^glasgow_coma_scale$/i,                  // EXACT: glasgow_coma_scale
        /^glasgow.*coma/i,                        // glasgow_coma variations
        /^gcs.*assessment/i,                      // gcs_assessment
        /^gcs.*score/i,                           // gcs_score
        /^coma.*scale/i,                          // coma_scale
        /^neurological.*coma/i,                   // neurological_coma_assessment
      ],
      component: GlasgowComaScaleDocument
    },

    // Hematology Consultations
    {
      name: 'Hematology Consultations',
      patterns: [
        /^hematology.*consult/i,                  // hematology_consultations
        /^hematology.*evaluation/i,               // hematology_evaluations
        /^blood.*disorder.*consult/i,             // blood_disorder_consultations
      ],
      component: HematologyConsultationsDocument
    },

    // Oncology Treatment Plans (must be before Oncology Consultations for specificity)
    {
      name: 'Oncology Treatment Plans',
      patterns: [
        /^oncology_treatment_plan/i,              // oncology_treatment_plans (exact)
        /^oncology.*treatment.*plan/i,            // oncology treatment plans
        /^cancer.*treatment.*plan/i,              // cancer treatment plans
        /^tumor.*treatment.*plan/i,               // tumor treatment plans
      ],
      component: OncologyTreatmentPlansDocument
    },

    // Oncology Follow-up Reports (must be before Oncology Consultations for specificity)
    {
      name: 'Oncology Follow-up Reports',
      patterns: [
        /^oncology_followup_report/i,             // oncology_followup_reports (exact)
        /^oncology.*followup.*report/i,           // oncology followup reports
        /^oncology.*follow.*up.*report/i,         // oncology follow up reports
        /^cancer.*followup.*report/i,             // cancer followup reports
        /^cancer.*follow.*up.*report/i,           // cancer follow up reports
        /^tumor.*followup.*report/i,              // tumor followup reports
      ],
      component: OncologyFollowupReportsDocument
    },

    // Cancer Diagnosis (must be before Oncology Consultations for specificity)
    {
      name: 'Cancer Diagnosis',
      patterns: [
        /^cancer_diagnosis$/i,                    // cancer_diagnosis (exact)
        /^cancer.*diagnosis/i,                    // cancer diagnosis variations
        /^tumor.*diagnosis/i,                     // tumor diagnosis
        /^malignancy.*diagnosis/i,                // malignancy diagnosis
        /^histology.*report/i,                    // histology report
        /^pathology.*diagnosis/i,                 // pathology diagnosis
      ],
      component: CancerDiagnosisDocument
    },

    // Cancer Staging (TNM, ISS, R-ISS, Durie-Salmon, Ann Arbor, FIGO, WHO grading, IPI)
    {
      name: 'Cancer Staging',
      patterns: [
        /^cancer_staging$/i,                      // cancer_staging (exact)
        /^cancer.*staging/i,                      // cancer staging variations
        /^tumor.*staging/i,                       // tumor staging
        /^tnm.*staging/i,                         // TNM staging
        /^staging.*report/i,                      // staging report
        /^oncology.*staging/i,                    // oncology staging
      ],
      component: CancerStagingDocument
    },

    // Cancer Related Side Effects (lymphedema, neuropathy, fatigue, cognitive, sexual dysfunction)
    {
      name: 'Cancer Related Side Effects',
      patterns: [
        /^cancer_related_side_effects$/i,              // cancer_related_side_effects (exact)
        /^cancer.*related.*side.*effect/i,             // cancer related side effects
        /^cancer.*side.*effect/i,                      // cancer side effects
        /^treatment.*side.*effect/i,                   // treatment side effects
      ],
      component: CancerRelatedSideEffectsDocument
    },

    // Tumor Markers (CEA, CA 19-9, CA 125, AFP, PSA, LDH, alkaline phosphatase)
    // Tumor Marker Panels (MUST come before Tumor Markers - more specific)
    {
      name: 'Tumor Marker Panels',
      patterns: [
        /^tumor_marker_panels$/i,                 // EXACT: tumor_marker_panels
      ],
      component: TumorMarkerPanelsDocument
    },

    {
      name: 'Tumor Markers',
      patterns: [
        /^tumor_markers$/i,                       // tumor_markers (exact)
        /^tumor.*marker/i,                        // tumor markers variations
        /^cancer.*marker/i,                       // cancer markers
        /^oncology.*marker/i,                     // oncology markers
        /^biomarker.*panel/i,                     // biomarker panel
      ],
      component: TumorMarkersDocument
    },

    // Genetic Oncology
    {
      name: 'Genetic Oncology',
      patterns: [
        /^genetic_oncology$/i,                    // EXACT: genetic_oncology
        /^genetic.*oncology/i,                    // genetic oncology variations
        /^oncology.*genetic/i,                    // oncology genetic
        /^hereditary.*cancer/i,                   // hereditary cancer
        /^cancer.*genetic/i,                      // cancer genetics
        /^genetic.*cancer/i,                      // genetic cancer
        /^familial.*cancer/i,                     // familial cancer syndrome
      ],
      component: GeneticOncologyDocument
    },

    // Surgical Oncology
    {
      name: 'Surgical Oncology',
      patterns: [
        /^surgical_oncology$/i,                   // EXACT: surgical_oncology
        /^surgical.*oncology/i,                   // surgical oncology variations
        /^oncology.*surg/i,                       // oncology surgery
        /^cancer.*surgery/i,                      // cancer surgery
        /^tumor.*resection/i,                     // tumor resection
        /^oncologic.*surgery/i,                   // oncologic surgery
        /^surgical.*tumor/i,                      // surgical tumor
      ],
      component: SurgicalOncologyDocument
    },

    // Endocrine Therapy
    {
      name: 'Endocrine Therapy',
      patterns: [
        /^endocrine_therapy$/i,                   // EXACT: endocrine_therapy
        /^endocrine.*therapy/i,                   // endocrine therapy variations
        /^hormone.*therapy/i,                     // hormone therapy
        /^hormonal.*treatment/i,                  // hormonal treatment
        /^aromatase.*inhibitor/i,                 // aromatase inhibitor
        /^letrozole/i,                            // letrozole
        /^tamoxifen/i,                            // tamoxifen
        /^anastrozole/i,                          // anastrozole
        /^breast.*hormone/i,                      // breast hormone therapy
      ],
      component: EndocrineTherapyDocument
    },

    // Survivorship Care Plan
    {
      name: 'Survivorship Care Plan',
      patterns: [
        /^survivorship_care_plan$/i,              // EXACT: survivorship_care_plan
        /^survivorship.*care.*plan/i,             // survivorship care plan variations
        /^survivorship.*plan/i,                   // survivorship plan
        /^cancer.*survivorship/i,                 // cancer survivorship
        /^survivor.*care/i,                       // survivor care
        /^post.*treatment.*plan/i,                // post-treatment plan
        /^follow.*up.*care.*plan/i,               // follow-up care plan
        /^long.*term.*follow.*up/i,               // long-term follow-up
      ],
      component: SurvivorshipCarePlanDocument
    },

    // Cognitive Evaluations
    {
      name: 'Cognitive Evaluations',
      patterns: [
        /^cognitive_evaluations$/i,               // EXACT: cognitive_evaluations
        /^cognitive.*evaluation/i,                // cognitive evaluation variations
        /^cognitive.*assessment/i,                // cognitive assessment
        /^mental.*status.*exam/i,                 // mental status exam
        /^mmse/i,                                 // Mini-Mental State Examination
        /^moca/i,                                 // Montreal Cognitive Assessment
        /^neuropsych.*test/i,                     // neuropsychological testing
      ],
      component: CognitiveEvaluationsDocument
    },

    // Falls Prevention Program Assessment (falls prevention and rehab program: fallsHistory, programType, goals, progress). Placed before Fall Risk Assessments so the broad fall-prevention-assessment pattern there does not steal it.
    {
      name: 'Falls Prevention Program Assessment',
      patterns: [
        /^falls_prevention_program_assessment$/i,   // EXACT
        /^falls[_\s]?prevention[_\s]?program/i,     // falls prevention program variations
      ],
      component: FallsPreventionProgramAssessmentDocument
    },

    // Pharmacy Review (medication review: drug interactions, therapeutic class, DUR)
    {
      name: 'Pharmacy Review',
      patterns: [
        /^pharmacy_review$/i,                        // EXACT
        /^pharmacy[_\s]?review/i,                    // pharmacy review variations
      ],
      component: PharmacyReviewDocument
    },

    // Fall Risk Assessments
    {
      name: 'Fall Risk Assessments',
      patterns: [
        /^fall_risk_assessments$/i,               // EXACT: fall_risk_assessments
        /^fall.*risk.*assessment/i,               // fall risk assessment variations
        /^fall.*risk.*eval/i,                     // fall risk evaluation
        /^fall.*prevention.*assessment/i,         // fall prevention assessment
        /^balance.*assessment/i,                  // balance assessment
        /^gait.*assessment/i,                     // gait assessment
        /^mobility.*assessment/i,                 // mobility assessment
        /^timed.*up.*go/i,                        // timed up and go test
        /^berg.*balance/i,                        // berg balance scale
      ],
      component: FallRiskAssessmentsDocument
    },

    // Dementia Assessment
    {
      name: 'Dementia Assessment',
      patterns: [
        /^dementia[_\s]?assessment$/i,                   // EXACT: dementia_assessment
      ],
      component: DementiaAssessmentDocument
    },

    // Dementia Education
    {
      name: 'Dementia Education',
      patterns: [
        /^dementia[_\s]?education$/i,                    // EXACT: dementia_education
      ],
      component: DementiaEducationDocument
    },

    // Elder Abuse Screening
    {
      name: 'Elder Abuse Screening',
      patterns: [
        /^elder[_\s]?abuse[_\s]?screening$/i,               // EXACT: elder_abuse_screening
      ],
      component: ElderAbuseScreeningDocument
    },

    // Blood Glucose Logs
    {
      name: 'Blood Glucose Logs',
      patterns: [
        /^blood[_\s]?glucose[_\s]?logs$/i,                   // EXACT: blood_glucose_logs
      ],
      component: BloodGlucoseLogsDocument
    },

    // Geriatric Cognitive Assessment
    {
      name: 'Geriatric Cognitive Assessment',
      patterns: [
        /^geriatric[_\s]?cognitive[_\s]?assessment$/i,  // EXACT: geriatric_cognitive_assessment
      ],
      component: GeriatricCognitiveAssessmentDocument
    },

    // Geriatric Medications
    {
      name: 'Geriatric Medications',
      patterns: [
        /^geriatric[_\s]?medications$/i,  // EXACT: geriatric_medications
      ],
      component: GeriatricMedicationsDocument
    },

    // Geriatric Assessments
    {
      name: 'Geriatric Assessments',
      patterns: [
        /^geriatric_assessments$/i,               // geriatric_assessments (exact)
        /^geriatric.*assessment/i,                // geriatric assessment variations
        /^comprehensive.*geriatric/i,             // comprehensive geriatric assessment
        /^cga$/i,                                 // CGA abbreviation
        /^elderly.*assessment/i,                  // elderly assessment
        /^senior.*assessment/i,                   // senior assessment
        /^frailty.*assessment/i,                  // frailty assessment
        /^functional.*geriatric/i,                // functional geriatric assessment
      ],
      component: GeriatricAssessmentsDocument
    },

    // Medication Deprescribing (MUST be BEFORE Polypharmacy Reviews)
    {
      name: 'Medication Deprescribing',
      patterns: [
        /^medication[_\s]?deprescribing$/i,       // medication_deprescribing (exact)
      ],
      component: MedicationDeprescribingDocument
    },

    // Nutritional Supplementation
    {
      name: 'Nutritional Supplementation',
      patterns: [
        /^nutritional[_\s]?supplementation$/i,
      ],
      component: NutritionalSupplementationDocument
    },

    // Respite Care
    {
      name: 'Respite Care',
      patterns: [
        /^respite[_\s]?care$/i,
      ],
      component: RespiteCareDocument
    },

    // Postoperative Pain Management
    {
      name: 'Postoperative Pain Management',
      patterns: [
        /^postoperative[_\s]?pain[_\s]?management$/i,
      ],
      component: PostoperativePainManagementDocument
    },

    // Polypharmacy Reviews
    {
      name: 'Polypharmacy Reviews',
      patterns: [
        /^polypharmacy_reviews$/i,                // polypharmacy_reviews (exact)
        /^polypharmacy.*review/i,                 // polypharmacy review variations
        /^medication.*review/i,                   // medication review
        /^drug.*review/i,                         // drug review
        /^deprescribing/i,                        // deprescribing assessment
        /^medication.*optimization/i,             // medication optimization
      ],
      component: PolypharmacyReviewsDocument
    },

    // Treatment Summary
    {
      name: 'Treatment Summary',
      patterns: [
        /^treatment_summary$/i,                   // treatment_summary (exact)
        /^treatment.*summary/i,                   // treatment summary variations
        /^oncology.*treatment.*summary/i,         // oncology treatment summary
        /^cancer.*treatment.*summary/i,           // cancer treatment summary
        /^treatment.*history/i,                   // treatment history
        /^treatment.*overview/i,                  // treatment overview
      ],
      component: TreatmentSummaryDocument
    },

    // ========== NEUROLOGICAL EXAMINATION ========== (MUST be BEFORE Neurological Exam)
    {
      name: 'Neurological Examination',
      patterns: [
        /^neurological_examination$/i,            // EXACT: neurological_examination
      ],
      component: NeurologicalExaminationDocument
    },
    // Neurological Exam (generic patterns - AFTER specific neurological_examination)
    {
      name: 'Neurological Exam',
      patterns: [
        /^neurological_exam$/i,                   // neurological_exam (exact)
        /^neurological.*exam(?!ination)/i,        // neurological exam variations (NOT examination)
        /^neuro.*exam/i,                          // neuro exam
        /^neuro.*physical/i,                      // neuro physical
        /^neurological.*physical/i,               // neurological physical exam
        /^cranial.*nerve.*exam/i,                 // cranial nerve exam
        /^motor.*sensory.*exam/i,                 // motor sensory exam
      ],
      component: NeurologicalExamDocument
    },

    // Oncology Team (must be BEFORE Oncology Consultations to avoid being caught by /^oncology/i pattern)
    {
      name: 'Oncology Team',
      patterns: [
        /^oncology_team$/i,                          // EXACT: oncology_team
        /^oncology.*team/i,                          // oncology_teams
        /^cancer.*team/i,                            // cancer_team
        /^tumor.*board.*team/i,                      // tumor_board_team
        /^oncology.*care.*team/i,                    // oncology_care_team
        /^multidisciplinary.*oncology/i,             // multidisciplinary_oncology
      ],
      component: OncologyTeamDocument
    },

    // Oncology Consultations
    {
      name: 'Oncology Consultations',
      patterns: [
        /^oncology.*consult/i,                    // oncology_consultations
        /^oncology.*evaluation/i,                 // oncology_evaluations
        /^cancer.*consult/i,                      // cancer_consultations
        /^tumor.*consult/i,                       // tumor_consultations
        /^malignancy.*consult/i,                  // malignancy_consultations
        /^oncology/i,                             // oncology (generic) - KEEP LAST
      ],
      component: OncologyConsultationsDocument
    },

    // Blood Smears
    {
      name: 'Blood Smears',
      patterns: [
        /^blood.*smear/i,                         // blood_smears
        /^peripheral.*smear/i,                    // peripheral_smears
        /^manual.*differential/i,                 // manual_differential
      ],
      component: BloodSmearsDocument
    },

    // ========== BLOOD SAMPLE COLLECTION STATUS ==========
    {
      name: 'Blood Sample Collection Status',
      patterns: [
        /^blood_sample_collection_status$/i,   // EXACT match
        /^blood.*sample.*collection/i,         // blood_sample_collection variations
        /^blood.*collection.*status/i,         // blood_collection_status
        /^specimen.*collection/i,              // specimen_collection
        /^phlebotomy/i,                        // phlebotomy_records
      ],
      component: BloodSampleCollectionStatusDocument
    },

    // ========== RHEUMATOID ARTHRITIS ASSESSMENT ==========
    {
      name: 'Rheumatoid Arthritis Assessment',
      patterns: [
        /^rheumatoid_arthritis_assessment$/i,  // EXACT match
        /^rheumatoid.*arthritis/i,             // rheumatoid_arthritis variations
      ],
      component: RheumatoidArthritisAssessmentDocument
    },

    // ========== ADVANCE DIRECTIVE DISCUSSION ==========
    {
      name: 'Advance Directive Discussion',
      patterns: [
        /^advance_directive_discussion$/i,     // EXACT match only - advance_directives and advance_care_planning have their own templates
      ],
      component: AdvanceDirectiveDiscussionDocument
    },

    // ========== ADULT DAY PROGRAM INFO ==========
    {
      name: 'Adult Day Program Info',
      patterns: [
        /^adult_day_program_info$/i,           // EXACT match
        /^adult_day_program/i,                 // adult_day_programs variations
      ],
      component: AdultDayProgramInfoDocument
    },

    // ========== NUTRITIONAL STATUS ==========
    {
      name: 'Nutritional Status',
      patterns: [
        /^nutritional_status$/i,               // EXACT match only - nutritional_assessment and nutritional_support have their own templates
      ],
      component: NutritionalStatusDocument
    },

    // ========== OPERATIVE TIME ==========
    {
      name: 'Operative Time',
      patterns: [
        /^operative_time$/i,                   // EXACT match only - operative_reports and operative_report_details have their own templates
      ],
      component: OperativeTimeDocument
    },

    // ========== VASCULAR SURGERY ASSESSMENT ==========
    {
      name: 'Vascular Surgery Assessment',
      patterns: [
        /^vascular_surgery_assessment$/i,      // EXACT match
        /^vascular.*surgery.*assess/i,         // vascular_surgery_assessment variations (no theft: vascular_bypass_surgery / vascular_access_planning contain no "assess")
      ],
      component: VascularSurgeryAssessmentDocument
    },

    // ========== JOB HAZARD ANALYSIS ==========
    {
      name: 'Job Hazard Analysis',
      patterns: [
        /^job_hazard_analysis$/i,              // EXACT match
        /^job.*hazard.*analys/i,               // job_hazard_analysis variations (no theft: no other collection starts with "job")
      ],
      component: JobHazardAnalysisDocument
    },

    // ========== VASCULAR BYPASS SURGERY ==========
    {
      name: 'Vascular Bypass Surgery',
      patterns: [
        /^vascular_bypass_surgery$/i,          // EXACT match (no theft: vascular_surgery_assessment caught by its own exact pattern; "bypass" unique here)
      ],
      component: VascularBypassSurgeryDocument
    },

    // ========== VENOUS INSUFFICIENCY ASSESSMENT ==========
    {
      name: 'Venous Insufficiency Assessment',
      patterns: [
        /^venous_insufficiency_assessment$/i,  // EXACT match (no theft: venous_thromboembolism_risk routes to DVT Prophylaxis via its own pattern)
      ],
      component: VenousInsufficiencyAssessmentDocument
    },

    // ========== AORTIC ANEURYSM SURVEILLANCE ==========
    {
      name: 'Aortic Aneurysm Surveillance',
      patterns: [
        /^aortic_aneurysm_surveillance$/i,     // EXACT match (no theft: no other collection starts with "aortic_aneurysm")
      ],
      component: AorticAneurysmSurveillanceDocument
    },

    // ========== TRAUMA FLOW SHEETS ==========
    {
      name: 'Trauma Flow Sheets',
      patterns: [
        /^trauma_flow_sheets$/i,               // EXACT match
      ],
      component: TraumaFlowSheetsDocument
    },

    // ========== TRAUMA ASSESSMENT ==========
    {
      name: 'Trauma Assessment',
      patterns: [
        /^trauma_assessment$/i,                // EXACT match (no theft: trauma_flow_sheets/trauma_scoring have their own exact patterns)
      ],
      component: TraumaAssessmentDocument
    },

    // ========== TRAUMA SCORING ==========
    {
      name: 'Trauma Scoring',
      patterns: [
        /^trauma_scoring$/i,                   // EXACT match
      ],
      component: TraumaScoringDocument
    },

    // ========== EMERGENCY PROCEDURES ==========
    {
      name: 'Emergency Procedures',
      patterns: [
        /^emergency_procedures$/i,             // EXACT match (no theft: emergency_airway_management etc. have their own patterns)
      ],
      component: EmergencyProceduresDocument
    },

    // ========== IMMUNIZATION SCHEDULE ==========
    {
      name: 'Immunization Schedule',
      patterns: [
        /^immunization_schedule$/i,            // EXACT match (no theft: immunization_record/_status caught by their own earlier patterns)
      ],
      component: ImmunizationScheduleDocument
    },

    // ========== TRAVEL VACCINATION RECORDS ==========
    {
      name: 'Travel Vaccination Records',
      patterns: [
        /^travel_vaccination_records$/i,       // EXACT match (no theft: /^vaccination.*record/i is anchored at ^vaccination so the travel_ prefix escapes it)
      ],
      component: TravelVaccinationRecordsDocument
    },

    // ========== FACIAL TRAUMA ASSESSMENT ==========
    {
      name: 'Facial Trauma Assessment',
      patterns: [
        /^facial_trauma_assessment$/i,         // EXACT match (no theft: trauma_assessment has its own exact pattern; "facial" prefix unique)
      ],
      component: FacialTraumaAssessmentDocument
    },

    // Pulmonary Function Tests
    {
      name: 'Pulmonary Function Tests',
      patterns: [
        /^pulmonary.*function.*test/i,            // pulmonary_function_tests
        /^pft/i,                                  // PFT (abbreviation)
        /^spirometry/i,                           // spirometry
        /^lung.*function.*test/i,                 // lung_function_tests
      ],
      component: PulmonaryFunctionTestsDocument
    },

    // ========== ADMINISTRATIVE DATA ==========
    {
      name: 'Administrative Data',
      patterns: [
        /^administrative.*data/i,          // administrative_data
        /^admin.*data/i,                   // admin_data
        /^administrative.*information/i,   // administrative_information
        /^patient.*administrative/i,       // patient_administrative_data
      ],
      component: AdministrativeDataDocument
    },

    // ========== PRIOR AUTHORIZATION STATUS ==========
    {
      name: 'Prior Authorization Status',
      patterns: [
        /^prior_authorization_status$/i,   // EXACT match: prior_authorization_status
        /^prior.*auth.*status/i,           // prior_authorization_status, prior_auth_status
        /^authorization.*status/i,         // authorization_status
        /^pa.*status/i,                    // pa_status (PA = Prior Authorization)
      ],
      component: PriorAuthorizationStatusDocument
    },

    // ========== PRIOR AUTHORIZATION FORMS ==========
    {
      name: 'Prior Authorization Forms',
      patterns: [
        /^prior_authorization_forms$/i,    // EXACT match: prior_authorization_forms
        /^prior.*authorization/i,          // prior_authorization, prior_authorizations
        /^authorization.*form/i,           // authorization_forms, authorization_form
        /^preauthorization/i,              // preauthorization, preauth
        /^pa.*form/i,                      // pa_forms, pa_form (PA = Prior Authorization)
      ],
      component: PriorAuthorizationFormsDocument
    },

    // ========== INSURANCE AUTHORIZATIONS ==========
    {
      name: 'Insurance Authorizations',
      patterns: [
        /^insurance_authorizations$/i,     // EXACT match: insurance_authorizations
        /^insurance.*auth/i,               // insurance_auth, insurance_authorization
        /^coverage.*verification/i,        // coverage_verification, coverage_verifications
        /^medication.*coverage/i,          // medication_coverage, medication_coverages
        /^copay.*assistance/i,             // copay_assistance, copay_assist
        /^patient.*assistance/i,           // patient_assistance, patient_assist
      ],
      component: InsuranceAuthorizationsDocument
    },

    // ========== FAMILY HISTORY ==========
    {
      name: 'Family History',
      patterns: [
        /^family_history$/i,               // EXACT match: family_history
        /^family.*medical.*history/i,      // family_medical_history, family_medical_histories
        /^hereditary.*condition/i,         // hereditary_conditions, hereditary_condition
        /^genetic.*history/i,              // genetic_history, genetic_histories
        /^familial.*disease/i,             // familial_diseases, familial_disease
        /^family.*disease/i,               // family_diseases, family_disease
      ],
      component: FamilyHistoryDocument
    },

    // ========== ASSESSMENT PLANS ==========
    {
      name: 'Assessment Plans',
      patterns: [
        /^assessment_plans$/i,             // EXACT match: assessment_plans
        /^assessment.*plan/i,              // assessment_plan, assessment_plans
        /^treatment.*plan/i,               // treatment_plans, treatment_plan
        /^care.*plan/i,                    // care_plans, care_plan
        /^plan.*of.*care/i,                // plan_of_care
        /^clinical.*plan/i,                // clinical_plans, clinical_plan
      ],
      component: AssessmentPlansDocument
    },

    // ========== PATIENT PROVIDER ==========
    {
      name: 'Patient Provider',
      patterns: [
        /^providers?$/i,                   // providers, provider
        /^patient_provider$/i,             // patient_provider (patient's assigned provider)
        /^healthcare.*provider/i,          // healthcare_providers
        /^medical.*provider/i,             // medical_providers
        /^provider.*list/i,                // provider_list
      ],
      component: PatientProviderDocument
    },

    // ========== PROVIDER INFO ==========
    {
      name: 'Provider Info',
      patterns: [
        /^provider_info$/i,                  // EXACT: provider_info
        /^provider.*info/i,                  // provider_information variations
        /^provider.*credential/i,            // provider_credentials
        /^provider.*certification/i,         // provider_certifications
      ],
      component: ProviderInfoDocument
    },

    // ========== CARE GAPS ==========
    {
      name: 'Care Gaps',
      patterns: [
        /^care.*gap/i,                     // care_gaps, care_gap
        /^quality.*gap/i,                  // quality_gaps
        /^screening.*recommendation/i,     // screening_recommendations
        /^preventive.*care.*gap/i,         // preventive_care_gaps
      ],
      component: CareGapsDocument
    },

    // ========== CARE COORDINATION ==========
    {
      name: 'Care Coordination',
      patterns: [
        /^care_coordination$/i,            // EXACT match: care_coordination
        /^care.*coordinat/i,               // care_coordination, care_coordinator
        /^care.*management/i,              // care_management
        /^care.*transition/i,              // care_transitions, transitional_care
        /^multidisciplinary.*care/i,       // multidisciplinary_care
        /^team.*care/i,                    // team_care
      ],
      component: CareCoordinationDocument
    },

    // ========== HEALTH MAINTENANCE ==========
    {
      name: 'Health Maintenance',
      patterns: [
        /^health.*maintenance$/i,          // health_maintenance
        /^preventive.*health/i,            // preventive_health
        /^wellness.*care/i,                // wellness_care
        /^screening.*schedule/i,           // screening_schedules
        // REMOVED: /^preventive.*care/i  - conflicts with preventive_care collection below
        /^preventive.*medicine/i,          // preventive_medicine
        /^health.*screening/i,             // health_screenings
        /^routine.*screening/i,            // routine_screenings
      ],
      component: HealthMaintenanceDocument
    },

    // ========== PATIENT INSTRUCTIONS ==========
    {
      name: 'Patient Instructions',
      patterns: [
        /^patient.*instructions?$/i,       // patient_instructions, patient_instruction
        /^discharge.*instructions?$/i,     // discharge_instructions
        /^action.*items?$/i,                // action_items
        /^patient.*action.*items?$/i,      // patient_action_items
        /^follow.*up.*instructions?$/i,    // follow_up_instructions
        /^home.*care.*instructions?$/i,    // home_care_instructions
        /^medication.*instructions?$/i,     // medication_instructions
        /^lifestyle.*instructions?$/i,      // lifestyle_instructions
        /^care.*instructions?$/i,           // care_instructions
      ],
      component: PatientInstructionsDocument
    },

    // ========== PREVENTIVE CARE ==========
    {
      name: 'Preventive Care',
      patterns: [
        /^preventive.*care$/i,              // preventive_care
        /^preventative.*care$/i,            // preventative_care
        /^prevention$/i,                    // prevention
        /^screening.*records?$/i,           // screening_records, screening_record
        /^health.*maintenance$/i,           // health_maintenance
        /^wellness.*exam$/i,                // wellness_exam
        /^annual.*physical$/i,              // annual_physical
        /^preventive.*medicine$/i,          // preventive_medicine
      ],
      component: PreventiveCareDocument
    },

    // ========== HOME HEALTH NOTES ==========
    {
      name: 'Home Health Notes',
      patterns: [
        /^home_health_notes$/i,            // EXACT match: home_health_notes
        /^home.*health.*note/i,            // home_health_notes, home_health_note
        /^home.*care.*note/i,              // home_care_notes
        /^home.*visit.*note/i,             // home_visit_notes
        /^home.*nursing/i,                 // home_nursing
      ],
      component: HomeHealthNotesDocument
    },

    // ========== ENVIRONMENTAL EXPOSURES ==========
    {
      name: 'Environmental Exposures',
      patterns: [
        /^environmental_exposures$/i,       // EXACT match: environmental_exposures
        /^environmental.*exposure/i,        // environmental_exposure, environmental_exposures
        /^environment.*health/i,            // environmental_health
        /^exposure.*assessment/i,           // exposure_assessment
        /^occupational.*exposure/i,         // occupational_exposure
        /^toxic.*exposure/i,                // toxic_exposure
        /^chemical.*exposure/i,             // chemical_exposure
      ],
      component: EnvironmentalExposuresDocument
    },

    // ========== REMINDERS (SYSTEM/OPERATIONAL) ==========
    {
      name: 'Reminders',
      patterns: [
        /^reminders?$/i,                   // reminders, reminder
        /^patient.*reminder/i,             // patient_reminders
        /^appointment.*reminder/i,         // appointment_reminders
        /^scheduled.*reminder/i,           // scheduled_reminders
        /^notification/i,                  // notifications (synonyms)
      ],
      component: RemindersDocument
    },

    // ========== TRACTOGRAPHY STUDIES ==========
    {
      name: 'Tractography Studies',
      patterns: [
        /^tractography/i,                  // tractography_studies, tractography
        /^dti.*tract/i,                    // dti_tractography
        /^diffusion.*tensor/i,             // diffusion_tensor_imaging
        /^fiber.*track/i,                  // fiber_tracking
        /^white.*matter.*tract/i,          // white_matter_tractography
      ],
      component: TractographyStudiesDocument
    },

    // ========== TOURNIQUET DATA ==========
    {
      name: 'Tourniquet Data',
      patterns: [
        /^tourniquet_data$/i,              // EXACT: tourniquet_data
        /^tourniquet.*data$/i,             // tourniquet_data, tourniquet-data
        /^tourniquet$/i,                   // tourniquet
        /^tourniquet.*record/i,            // tourniquet_records
        /^surgical.*tourniquet/i,          // surgical_tourniquet
      ],
      component: TourniquetDataDocument
    },

    // ========== FUNCTIONAL MRI STUDIES ==========
    {
      name: 'Functional MRI Studies',
      patterns: [
        /^functional_mri_studies$/i,       // EXACT match (collection name)
        /^functional.*mri/i,               // functional_mri_studies, functional_mri
        /^fmri/i,                          // fmri
        /^eloquent.*area/i,                // eloquent_areas
        /^brain.*mapping/i,                // brain_mapping
        /^functional.*brain/i,             // functional_brain_imaging
      ],
      component: FunctionalMriStudiesDocument
    },

    // ========== BONE MARROW STUDIES ==========
    {
      name: 'Bone Marrow Studies',
      patterns: [
        /^bone.*marrow/i,                  // bone_marrow_studies, bone_marrow
        /^marrow.*biopsy/i,                // marrow_biopsy
        /^bone.*marrow.*biopsy/i,          // bone_marrow_biopsy
        /^cytogenetics/i,                  // cytogenetics
        /^hematopathology/i,               // hematopathology
      ],
      component: BoneMarrowStudiesDocument
    },

    // ========== PLASTIC SURGERY CONSULTATIONS ==========
    {
      name: 'Plastic Surgery Consultations',
      patterns: [
        /^plastic_surgery_consultations$/i,  // EXACT: plastic_surgery_consultations
        /^plastic.*surgery.*consult/i,       // plastic_surgery_consultations variations
        /^reconstructive.*surgery/i,         // reconstructive_surgery
        /^cosmetic.*surgery/i,              // cosmetic_surgery
        /^plastic.*consult/i,              // plastic_consultation
      ],
      component: PlasticSurgeryConsultationsDocument
    },

    // ========== PLASTIC SURGERY ASSESSMENT ==========
    {
      name: 'Plastic Surgery Assessment',
      patterns: [
        /^plastic_surgery_assessment$/i,     // EXACT: plastic_surgery_assessment
        /^plastic.*surgery.*assess/i,        // plastic_surgery_assessment variations
      ],
      component: PlasticSurgeryAssessmentDocument
    },

    // ========== FERTILITY PRESERVATION ==========
    {
      name: 'Fertility Preservation',
      patterns: [
        /^fertility_preservation$/i,           // EXACT: fertility_preservation
        /^fertility.*preservation/i,           // fertility preservation
      ],
      component: FertilityPreservationDocument
    },

    // ========== FUTURE TEMPLATES (Add here as you create them) ==========

    // Emergency Department
    // {
    //   name: 'Emergency Department',
    //   patterns: [
    //     /^emergency.*department/i,       // emergency_department_notes
    //     /^ed.*note/i,                    // ed_notes, ed_discharge
    //     /^emergency.*room/i,             // emergency_room_report
    //     /^er.*note/i,                    // er_notes
    //   ],
    //   component: EmergencyDepartmentDocument
    // },

    // Operative Reports
    // {
    //   name: 'Operative Report',
    //   patterns: [
    //     /^operative.*report/i,           // operative_reports, operative_note
    //     /^surgical.*report/i,            // surgical_reports
    //     /^operation.*note/i,             // operation_notes
    //     /^surgery.*report/i,             // surgery_reports
    //     /^op.*report/i,                  // op_reports
    //   ],
    //   component: OperativeReportDocument
    // },

    // Cardiology Consultation
    // {
    //   name: 'Cardiology Consultation',
    //   patterns: [
    //     /^cardiology.*consult/i,         // cardiology_consultation, cardiology_consult
    //     /^cardiac.*consult/i,            // cardiac_consultation
    //     /^cardio.*consult/i,             // cardio_consultation
    //   ],
    //   component: CardiologyConsultationDocument
    // },

    // ========== PULMONOLOGY CONSULTATIONS ==========
    {
      name: 'Pulmonology Consultations',
      patterns: [
        /^pulmonology.*consult/i,        // pulmonology_consultations
        /^pulm.*consult/i,               // pulm_consultations
        /^respiratory.*consult/i,        // respiratory_consultations
        /^lung.*consult/i,               // lung_consultations
      ],
      component: PulmonologyConsultationsDocument
    },

    // ========== PULMONARY REHABILITATION NOTES ==========
    {
      name: 'Pulmonary Rehabilitation Notes',
      patterns: [
        /^pulmonary_rehabilitation_notes$/i,       // EXACT: pulmonary_rehabilitation_notes
        /^pulmonary.*rehabilitation.*note/i,       // pulmonary_rehabilitation_notes variations
        /^pulm.*rehab.*note/i,                     // pulm_rehab_notes
      ],
      component: PulmonaryRehabilitationNotesDocument
    },

    // ========== ARTERIAL BLOOD GASES ==========
    {
      name: 'Arterial Blood Gases',
      patterns: [
        /^arterial_blood_gases$/i,       // EXACT match: arterial_blood_gases collection
        /^arterial.*blood.*gas/i,        // arterial_blood_gas, arterial_blood_gases
        /^abg/i,                         // abg, abgs (common abbreviation)
        /^blood.*gas/i,                  // blood_gas, blood_gases
      ],
      component: ArterialBloodGasesDocument
    },

    // ========== MICROBIOLOGY CULTURE REPORTS ==========
    {
      name: 'Microbiology Culture Reports',
      patterns: [
        /^microbiology_culture_reports$/i,  // EXACT match: microbiology_culture_reports collection
        /^microbiology.*culture/i,          // microbiology_culture, microbiology_cultures
        /^culture.*report/i,                // culture_report, culture_reports
        /^micro.*culture/i,                 // micro_culture, microbiology_culture
        /^bacterial.*culture/i,             // bacterial_culture, bacterial_cultures
      ],
      component: MicrobiologyCultureReportsDocument
    },

    // ========== RESPIRATORY MEDICATIONS ==========
    {
      name: 'Respiratory Medications',
      patterns: [
        /^respiratory_medications$/i,       // EXACT match: respiratory_medications collection
        /^respiratory.*med/i,               // respiratory_medication, respiratory_meds
        /^respir.*med/i,                    // respir_meds, respir_medication
        /^asthma.*med/i,                    // asthma_medications, asthma_meds
        /^copd.*med/i,                      // copd_medications, copd_meds
        /^inhaler/i,                        // inhalers, inhaler_medications
        /^bronchodilator/i,                 // bronchodilators, bronchodilator_meds
      ],
      component: RespiratoryMedicationsDocument
    },

    // ========== PSYCHIATRIC HISTORY ==========
    {
      name: 'Psychiatric History',
      patterns: [
        /^psychiatric_history$/i,
        /^psych.*history/i,
        /^psych.*hx/i
      ],
      component: PsychiatricHistoryDocument
    },

    // ========== REVIEW OF SYSTEMS ==========
    {
      name: 'Review of Systems',
      patterns: [
        /^review_of_systems$/i,             // EXACT match: review_of_systems collection
        /^review.*systems/i,                // review_of_systems, review_systems
        /^ROS$/i,                           // ROS abbreviation
        /^systems.*review/i,                // systems_review
        /^organ.*systems/i,                 // organ_systems_review
      ],
      component: ReviewOfSystemsDocument
    },

    // ========== HEPATITIS C HISTORY ==========
    {
      name: 'Hepatitis C History',
      patterns: [
        /^hepatitis_c_history$/i,           // EXACT match: hepatitis_c_history collection
        /^hepatitis.*c.*history/i,          // hepatitis_c_history, hepatitis_c_hist
        /^hcv.*history/i,                   // hcv_history, hcv_hist
        /^hep.*c.*history/i,                // hep_c_history, hepc_hist
      ],
      component: HepatitisCHistoryDocument
    },

    // ========== HEPATITIS C MANAGEMENT ==========
    {
      name: 'Hepatitis C Management',
      patterns: [
        /^hepatitis_c_management$/i,        // EXACT match: hepatitis_c_management collection
        /^hepatitis.*c/i,                   // hepatitis_c, hepatitis_c_records
        /^hcv/i,                            // hcv, hcv_management, hcv_records
        /^hep.*c/i,                         // hep_c, hepc_management
      ],
      component: HepatitisCManagementDocument
    },

    {
      name: 'Infectious Disease Assessment',
      patterns: [
        /^infectious_disease_assessment$/i,
        /^infectious.*disease/i,
        /^id.*assessment/i
      ],
      component: InfectiousDiseaseAssessmentDocument
    },

    // ========== INFECTION CONTROL RECORDS ==========
    {
      name: 'Infection Control Records',
      patterns: [
        /^infection_control_records$/i,          // EXACT match
        /^infection.*control.*record/i,          // infection control records
        /^infection.*control$/i,                 // infection control
        /^infection.*prevention/i,               // infection prevention
        /^hai.*surveillance/i,                   // HAI surveillance
        /^healthcare.*associated.*infection/i,   // healthcare-associated infection
        /^outbreak.*investigation/i,             // outbreak investigation
      ],
      component: InfectionControlRecordsDocument
    },

    // ========== INFECTION RISK MONITORING ==========
    {
      name: 'Infection Risk Monitoring',
      patterns: [
        /^infection_risk_monitoring$/i,         // EXACT match
        /^infection.*risk.*monitoring/i,        // infection risk monitoring
        /^infection.*risk/i,                    // infection risk
        /^sepsis.*monitoring/i,                 // sepsis monitoring
        /^sepsis.*risk/i,                       // sepsis risk
        /^infection.*marker/i,                  // infection markers
        /^culture.*result/i,                    // culture results
      ],
      component: InfectionRiskMonitoringDocument
    },

    // ========== INFECTION SURVEILLANCE ==========
    {
      name: 'Infection Surveillance',
      patterns: [
        /^infection_surveillance$/i,           // EXACT match
        /^infection.*surveillance/i,           // infection surveillance
        /^surveillance.*infection/i,           // surveillance infection
        /^hai.*surveillance/i,                 // HAI surveillance
        /^healthcare.*associated.*infection/i, // healthcare associated infection
        /^nosocomial.*infection/i,             // nosocomial infection
        /^infection.*control.*surveillance/i,  // infection control surveillance
      ],
      component: InfectionSurveillanceDocument
    },

    // ========== ISOLATION PRECAUTIONS ==========
    {
      name: 'Isolation Precautions',
      patterns: [
        /^isolation_precautions$/i,            // EXACT match
        /^isolation.*precaution/i,             // isolation precautions
        /^isolation.*protocol/i,               // isolation protocol
        /^contact.*precaution/i,               // contact precautions
        /^droplet.*precaution/i,               // droplet precautions
        /^airborne.*precaution/i,              // airborne precautions
        /^infection.*control.*precaution/i,    // infection control precautions
      ],
      component: IsolationPrecautionsDocument
    },

    // ========== ANTIMICROBIAL SUSCEPTIBILITY ==========
    {
      name: 'Antimicrobial Susceptibility',
      patterns: [
        /^antimicrobial_susceptibility$/i,        // EXACT match
        /^antimicrobial.*susceptibility/i,        // antimicrobial susceptibility
        /^antibiotic.*susceptibility/i,           // antibiotic susceptibility
        /^susceptibility.*testing/i,              // susceptibility testing
        /^culture.*sensitivity/i,                 // culture sensitivity
        /^mic.*testing/i,                         // MIC testing
      ],
      component: AntimicrobialSusceptibilityDocument
    },

    // Biologic Therapy (FLAT collection: medication, indication, dose, route, frequency, response, monitoring).
    // Anchored exact match placed BEFORE the broad Biologic Therapy Records entry (first-match-wins) so the
    // flat biologic_therapy collection is NOT stolen by /^biologic.*therapy/i.
    {
      name: 'Biologic Therapy',
      patterns: [
        /^biologic_therapy$/i,                     // exact match — flat collection (NOT _records)
      ],
      component: BiologicTherapyDocument
    },

    // Biologic Therapy Records (biologics, immunotherapy, monoclonal antibodies)
    {
      name: 'Biologic Therapy Records',
      patterns: [
        /^biologic_therapy_records$/i,             // exact match
        /^biologic.*therapy/i,                     // biologic_therapy variations
        /^biologic.*treatment/i,                   // biologic_treatment
        /^biologics$/i,                            // biologics
        /^immunotherapy.*record/i,                 // immunotherapy_records
        /^monoclonal.*antibody/i,                  // monoclonal_antibody
      ],
      component: BiologicTherapyRecordsDocument
    },

    // Asthma Management Notes (asthma type, severity, control level, symptoms, triggers, medications)
    {
      name: 'Asthma Management Notes',
      patterns: [
        /^asthma_management_notes$/i,              // exact match
        /^asthma.*management/i,                    // asthma_management variations
        /^asthma.*notes$/i,                        // asthma_notes
        /^asthma.*record/i,                        // asthma_records
        /^asthma.*assessment/i,                    // asthma_assessment
      ],
      component: AsthmaManagementNotesDocument
    },

    // ========== ORAL PATHOLOGY BIOPSY (EXACT - before Biopsy Reports) ==========
    {
      name: 'Oral Pathology Biopsy',
      patterns: [
        /^oral_pathology_biopsy$/i,                // EXACT: oral_pathology_biopsy
        /^oral.*pathology.*biopsy/i,               // oral_pathology_biopsy variations
        /^oral.*biopsy.*pathology/i,               // oral_biopsy_pathology
        /^oral.*cavity.*biopsy/i,                  // oral_cavity_biopsy
        /^oral.*lesion.*biopsy/i,                  // oral_lesion_biopsy
        /^oral.*mucosal.*biopsy/i,                 // oral_mucosal_biopsy
      ],
      component: OralPathologyBiopsyDocument
    },

    // ========== BIOPSY REPORTS ==========
    {
      name: 'Biopsy Reports',
      patterns: [
        /^biopsy_reports$/i,                       // exact match
        /^biopsy.*report/i,                        // biopsy_report variations
        /^pathology.*biopsy/i,                     // pathology_biopsy
        /^tissue.*biopsy/i,                        // tissue_biopsy
      ],
      component: BiopsyReportsDocument
    },

    // ========== PATHOLOGY GROSS DESCRIPTION (EXACT - before Pathology Reports) ==========
    {
      name: 'Pathology Gross Description',
      patterns: [
        /^pathology_gross_description$/i,           // EXACT match
        /^pathology.*gross/i,                       // pathology gross
        /^gross.*description/i,                     // gross description
        /^gross.*exam/i,                            // gross examination
        /^specimen.*gross/i,                        // specimen gross
      ],
      component: PathologyGrossDescriptionDocument
    },
    {
      name: 'Pathology Reports',
      patterns: [
        /^pathology_reports$/i,                     // exact match
        /^pathology.*report/i,                      // pathology_reports, pathology report
        /^pathologic.*report/i,                     // pathologic_reports
        /^surgical.*pathology/i,                    // surgical_pathology
        /^histopathology/i,                         // histopathology
      ],
      component: PathologyReportsDocument
    },
    {
      name: 'Genetic Testing Reports',
      patterns: [
        /^genetic_testing_reports$/i,               // exact match
        /^genetic.*testing/i,                       // genetic_testing, genetic testing
        /^genetic.*report/i,                        // genetic_reports
        /^molecular.*profiling/i,                   // molecular_profiling
        /^molecular.*testing/i,                     // molecular_testing
        /^tumor.*molecular/i,                       // tumor_molecular_markers
      ],
      component: GeneticTestingReportsDocument
    },

    // ========== COMPREHENSIVE CARDIOMYOPATHY PANEL ==========
    {
      name: 'Comprehensive Cardiomyopathy Panel',
      patterns: [
        /^comprehensive_cardiomyopathy_panel$/i,    // exact match
        /^cardiomyopathy.*panel/i,                  // cardiomyopathy panel variations
        /^comprehensive.*cardiomyopathy/i,          // comprehensive cardiomyopathy
        /^cardiomyopathy.*genetic/i,                // cardiomyopathy genetic testing
        /^inherited.*cardiomyopathy/i,              // inherited cardiomyopathy panel
      ],
      component: ComprehensiveCardiomyopathyPanelDocument
    },

    // ========== PHARMACOGENOMIC TESTING ==========
    {
      name: 'Pharmacogenomic Testing',
      patterns: [
        /^pharmacogenomic[_\s]?testing$/i,          // pharmacogenomic_testing (exact)
        /^pharmacogenomic[_\s]?test/i,              // pharmacogenomic_test, pharmacogenomic_tests
        /^pgx[_\s]?testing/i,                       // pgx_testing
        /^pharmacogenomic[_\s]?panel/i,             // pharmacogenomic_panel
        /^cyp[_\s]?genotyp/i,                       // cyp_genotyping
      ],
      component: PharmacogenomicTestingDocument
    },

    // ========== CYP450 PANEL RESULTS ==========
    {
      name: 'CYP450 Panel Results',
      patterns: [
        /^cyp450[_\s]?panel[_\s]?results?$/i,       // EXACT: cyp450_panel_results
        /^cyp[_\s]?450[_\s]?panel/i,                 // cyp_450_panel, cyp450_panel
        /^cyp450[_\s]?results/i,                     // cyp450_results
        /^cyp[_\s]?450[_\s]?genotyp/i,               // cyp_450_genotyping
        /^cytochrome[_\s]?p450[_\s]?panel/i,         // cytochrome_p450_panel
      ],
      component: Cyp450PanelResultsDocument
    },

    // ========== DRUG GENE INTERACTION REPORT ==========
    {
      name: 'Drug Gene Interaction Report',
      patterns: [
        /^drug[_\s]?gene[_\s]?interaction/i,        // drug_gene_interaction_report
        /^drug[_\s]?gene[_\s]?report/i,             // drug_gene_report
        /^pharmacogenomic/i,                        // pharmacogenomics, pharmacogenomic_report
        /^pgx/i,                                    // pgx, pgx_report
        /^drug[_\s]?metabolism/i,                   // drug_metabolism, drug_metabolism_report
        /^cyp[_\s]?450/i,                           // cyp450, cyp450_report
        /^drug[_\s]?genetics/i,                     // drug_genetics
      ],
      component: DrugGeneInteractionReportDocument
    },

    // Cascade Testing Protocol (genetics family testing)
    {
      name: 'Cascade Testing Protocol',
      patterns: [
        /^cascade_testing_protocol$/i,              // EXACT: cascade_testing_protocol
        /^cascade.*testing/i,                       // cascade_testing, cascade_testing_plan
        /^family.*cascade/i,                        // family_cascade_testing
        /^cascade.*genetic/i,                       // cascade_genetic_testing
        /^predictive.*testing/i,                    // predictive_testing
        /^at.*risk.*relative/i,                     // at_risk_relative_testing
      ],
      component: CascadeTestingProtocolDocument
    },
    {
      name: 'Potential Testing Outcomes',
      patterns: [
        /^potential_testing_outcomes$/i,              // EXACT: potential_testing_outcomes
        /^potential.*testing.*outcome/i,              // potential_testing_outcomes_assessment
        /^testing.*outcome/i,                         // testing_outcomes
        /^outcome.*testing/i,                         // outcome_testing
        /^test.*result.*potential/i,                  // test_results_potential
      ],
      component: PotentialTestingOutcomesDocument
    },
    {
      name: 'Reason for Referral',
      patterns: [
        /^reason_for_referral$/i,                     // EXACT: reason_for_referral
        /^reason.*referral/i,                         // reason_for_referral, reason_referral
        /^referral.*reason/i,                         // referral_reason
        /^referral.*indication/i,                     // referral_indication
        /^indication.*referral/i,                     // indication_for_referral
      ],
      component: ReasonForReferralDocument
    },
    {
      name: 'Medical Geneticist',
      patterns: [
        /^medical_geneticist$/i,                      // EXACT: medical_geneticist
        /^medical.*geneticist/i,                      // medical_geneticist, medical geneticist
        /^geneticist/i,                               // geneticist
        /^genetics.*consult/i,                        // genetics_consult, genetics_consultation
        /^genetic.*counsel/i,                         // genetic_counseling, genetic_counselor
      ],
      component: MedicalGeneticistDocument
    },
    {
      name: 'Heart Transplant Evaluation',
      patterns: [
        /^heart[_\s]?transplant[_\s]?evaluation$/i,    // EXACT: heart_transplant_evaluation
      ],
      component: HeartTransplantEvaluationDocument
    },
    {
      name: 'Liver Transplant Evaluation',
      patterns: [
        /^liver[_\s]?transplant[_\s]?evaluation$/i,    // EXACT: liver_transplant_evaluation
      ],
      component: LiverTransplantEvaluationDocument
    },
    {
      name: 'Lung Transplant Evaluation',
      patterns: [
        /^lung_transplant_evaluation$/i,                // EXACT: lung_transplant_evaluation
        /^lung.*transplant.*evaluation/i,               // lung_transplant_evaluation variants
      ],
      component: LungTransplantEvaluationDocument
    },
    {
      name: 'Pancreas Transplant Evaluation',
      patterns: [
        /^pancreas_transplant_evaluation$/i,
        /^pancreas.*transplant.*evaluation/i,
        /^pancreas.*transplant/i,
      ],
      component: PancreasTransplantEvaluationDocument
    },
    {
      name: 'Liver Transplant Follow-Up',
      patterns: [
        /^liver[_\s]?transplant[_\s]?follow[_\s]?up$/i,    // EXACT: liver_transplant_follow_up
      ],
      component: LiverTransplantFollowUpDocument
    },
    {
      name: 'Lung Transplant Follow-Up',
      patterns: [
        /^lung_transplant_follow_up$/i,                     // EXACT: lung_transplant_follow_up
        /^lung.*transplant.*follow/i,                       // lung_transplant_follow_up variants
      ],
      component: LungTransplantFollowUpDocument
    },
    {
      name: 'Dialysis Records',
      patterns: [
        /^dialysis[_\s]?records?$/i,                     // EXACT: dialysis_records
      ],
      component: DialysisRecordsDocument
    },
    {
      name: 'Dialysis Run Sheets',
      patterns: [
        /^dialysis[_\s]?run[_\s]?sheets?$/i,            // EXACT: dialysis_run_sheets
      ],
      component: DialysisRunSheetsDocument
    },
    {
      name: 'Pre-Dialysis Assessment',
      patterns: [
        /^pre[_\s]?dialysis[_\s]?assessment$/i,           // EXACT: pre_dialysis_assessment
      ],
      component: PreDialysisAssessmentDocument
    },
    {
      name: 'Dialysis Prescription',
      patterns: [
        /^dialysis[_\s]?prescription$/i,                 // EXACT: dialysis_prescription
      ],
      component: DialysisPrescriptionDocument
    },
    {
      name: 'Dialyzer',
      patterns: [
        /^dialyzer$/i,                                     // EXACT: dialyzer
      ],
      component: DialyzerDocument
    },
    {
      name: 'Dialysate Composition',
      patterns: [
        /^dialysate[_\s]?composition$/i,                   // EXACT: dialysate_composition
      ],
      component: DialysateCompositionDocument
    },
    {
      name: 'Intradialytic Monitoring',
      patterns: [
        /^intradialytic[_\s]?monitoring$/i,                 // EXACT: intradialytic_monitoring
      ],
      component: IntradialyticMonitoringDocument
    },
    {
      name: 'Medications Administered',
      patterns: [
        /^medications?[_\s]?administered$/i,                  // EXACT: medications_administered
      ],
      component: MedicationsAdministeredDocument
    },
    {
      name: 'Post Dialysis Assessment',
      patterns: [
        /^post[_\s]?dialysis[_\s]?assessment$/i,              // EXACT: post_dialysis_assessment
      ],
      component: PostDialysisAssessmentDocument
    },
    {
      name: 'Renal Protection Plan',
      patterns: [
        /^renal[_\s]?protection[_\s]?plan$/i,              // EXACT: renal_protection_plan
      ],
      component: RenalProtectionPlanDocument
    },
    {
      name: 'Current Dialysis',
      patterns: [
        /^current[_\s]?dialysis$/i,                        // EXACT: current_dialysis
      ],
      component: CurrentDialysisDocument
    },
    {
      name: 'Endoscopy Reports',
      patterns: [
        /^endoscopy[_\s]?reports$/i,                       // EXACT: endoscopy_reports
      ],
      component: EndoscopyReportsDocument
    },
    {
      name: 'Transplant Evaluations',
      patterns: [
        /^transplant_evaluations$/i,                    // EXACT: transplant_evaluations
        /^transplant.*evaluation/i,                     // transplant_evaluation, transplant_evaluations
        /^transplant.*assessment/i,                     // transplant_assessment
        /^organ.*transplant/i,                          // organ_transplant_evaluation
        /^kidney.*transplant.*eval/i,                   // kidney_transplant_eval
        // liver_transplant_evaluation now has its own dedicated template above
      ],
      component: TransplantEvaluationsDocument
    },
    {
      name: 'Cognitive Rehabilitation Reports',
      patterns: [
        /^cognitive_rehabilitation_reports$/i,      // EXACT: cognitive_rehabilitation_reports
        /^cognitive.*rehabilitation/i,              // cognitive_rehabilitation
        /^cognitive.*rehab/i,                       // cognitive_rehab
        /^neuropsych.*rehab/i,                      // neuropsych_rehabilitation
        /^cognitive.*therapy.*report/i,             // cognitive_therapy_report
      ],
      component: CognitiveRehabilitationReportsDocument
    },
    // ========== OCCUPATIONAL THERAPY REPORTS ==========
    {
      name: 'Occupational Therapy Reports',
      patterns: [
        /^occupational_therapy_reports?$/i,          // EXACT: occupational_therapy_reports
        /^occupational_therapy_report/i,             // occupational_therapy_report_*
        /^ot_report/i,                               // ot_report, ot_reports
        /^ot_evaluation/i,                           // ot_evaluation
        /^occupational_therapy_evaluation/i,         // occupational_therapy_evaluation
        /^occupational_therapy_assessment/i,         // occupational_therapy_assessment
      ],
      component: OccupationalTherapyReportsDocument
    },
    {
      name: 'Speech Therapy Assessments',
      patterns: [
        /^speech_therapy_assessments?$/i,            // EXACT: speech_therapy_assessments
        /^speech_therapy_assessment/i,               // speech_therapy_assessment_*
        /^speech_language_assessment/i,              // speech_language_assessment
        /^speech_assessment/i,                       // speech_assessment
        /^speech_evaluation/i,                       // speech_evaluation
        /^speech_therapy_evaluation/i,               // speech_therapy_evaluation
      ],
      component: SpeechTherapyAssessmentsDocument
    },
    {
      name: 'Functional Status',
      patterns: [
        /^functional_status$/i,                     // EXACT: functional_status
        /^functional_status_/i,                     // functional_status_*
        /^functional.*independence/i,               // functional_independence_measure
        /^barthel.*index/i,                         // barthel_index
      ],
      component: FunctionalStatusDocument
    },
    {
      name: 'Stroke Assessment',
      patterns: [
        /^stroke_assessment$/i,                     // EXACT: stroke_assessment
        /^stroke_assessment_/i,                     // stroke_assessment_*
        /^stroke.*evaluation/i,                     // stroke_evaluation
        /^cerebrovascular.*assessment/i,            // cerebrovascular_assessment
      ],
      component: StrokeAssessmentDocument
    },
    {
      name: 'PMR Assessment',
      patterns: [
        /^pmr_assessment$/i,                      // EXACT: pmr_assessment
        /^pmr_assessment_/i,                      // pmr_assessment_*
        /^physical.*medicine.*rehab/i,            // physical_medicine_rehabilitation
      ],
      component: PmrAssessmentDocument
    },
    {
      name: 'Assistive Devices',
      patterns: [
        /^assistive_devices$/i,                   // EXACT: assistive_devices
        /^assistive_devices_/i,                   // assistive_devices_*
        /^assistive.*device/i,                    // assistive_device
        /^adaptive.*device/i,                     // adaptive_devices
        /^mobility.*aid/i,                        // mobility_aids
      ],
      component: AssistiveDevicesDocument
    },
    {
      name: 'Durable Medical Equipment Orders',
      patterns: [
        /^durable_medical_equipment_orders$/i,    // EXACT: durable_medical_equipment_orders
        /^durable_medical_equipment/i,            // durable_medical_equipment*
        /^dme_order/i,                            // dme_orders
        /^dme_equipment/i,                        // dme_equipment
        /^equipment_order/i,                      // equipment_orders
      ],
      component: DurableMedicalEquipmentOrdersDocument
    },
    {
      name: 'Inflammatory Markers',
      patterns: [
        /^inflammatory_markers$/i,                // EXACT: inflammatory_markers
        /^inflammatory_marker/i,                  // inflammatory_marker*
      ],
      component: InflammatoryMarkersDocument
    },
    {
      name: 'Therapy Requests',
      patterns: [
        /^therapy_requests$/i,                      // EXACT: therapy_requests
        /^therapy.*request/i,                       // therapy_request
        /^service.*request/i,                       // service_request
        /^rehab.*request/i,                         // rehab_request, rehabilitation_request
        /^physical.*therapy.*order/i,              // physical_therapy_order
        /^occupational.*therapy.*order/i,          // occupational_therapy_order
        /^speech.*therapy.*order/i,                // speech_therapy_order
      ],
      component: TherapyRequestsDocument
    },
    // ========== SURGICAL STEPS ==========
    {
      name: 'Surgical Steps',
      patterns: [
        /^surgical_steps$/i,                        // EXACT: surgical_steps
        /^surgical.*step/i,                         // surgical_step, surgical_steps
        /^surgery.*step/i,                          // surgery_steps
        /^operative.*step/i,                        // operative_steps
        /^procedure.*step/i,                        // procedure_steps
        /^intraoperative.*step/i,                   // intraoperative_steps
      ],
      component: SurgicalStepsDocument
    },
    // ========== SURGICAL TEAM ==========
    {
      name: 'Surgical Team',
      patterns: [
        /^surgical_team$/i,                          // EXACT: surgical_team
        /^surgical.*team/i,                          // surgical_teams
        /^surgery.*team/i,                           // surgery_team
        /^operative.*team/i,                         // operative_team
        /^or.*team/i,                                // or_team
      ],
      component: SurgicalTeamDocument
    },
    // ========== PREOPERATIVE EVALUATION ==========
    {
      name: 'Preoperative Evaluation',
      patterns: [
        /^preoperative_evaluation$/i,                 // EXACT: preoperative_evaluation
        /^preoperative.*evaluation/i,                 // preoperative_evaluations
        /^pre.*op.*eval/i,                            // pre_op_eval, preop_evaluation
        /^anesthesia.*evaluation/i,                   // anesthesia_evaluation
        /^surgical.*risk.*assessment/i,               // surgical_risk_assessment
        /^asa.*classification/i,                      // asa_classification
      ],
      component: PreoperativeEvaluationDocument
    },
    // ========== OPERATIVE DETAILS ==========
    {
      name: 'Operative Details',
      patterns: [
        /^operative_details$/i,                     // EXACT: operative_details
        /^operative.*detail/i,                      // operative_details, operative_detail
        /^operation.*detail/i,                      // operation_details
        /^surgery.*detail/i,                        // surgery_details
        /^surgical.*detail/i,                       // surgical_details
      ],
      component: OperativeDetailsDocument
    },
    {
      name: 'Nephrology Consultations',
      patterns: [
        /^nephrology_consultations$/i,              // EXACT: nephrology_consultations
        /^nephrology.*consult/i,                    // nephrology_consultation, nephrology_consult
        /^renal.*consult/i,                         // renal_consultation
        /^kidney.*consult/i,                        // kidney_consultation
      ],
      component: NephrologyConsultationsDocument
    },
    // Kidney Disease Progression Timeline
    {
      name: 'Kidney Disease Progression Timeline',
      patterns: [
        /^kidney_disease_progression_timeline$/i,     // EXACT: kidney_disease_progression_timeline
        /^kidney.*disease.*progression/i,             // kidney_disease_progression
        /^kidney.*progression.*timeline/i,            // kidney_progression_timeline
        /^ckd.*progression.*timeline/i,               // ckd_progression_timeline
        /^renal.*disease.*progression/i,              // renal_disease_progression
        /^egfr.*decline.*timeline/i,                  // egfr_decline_timeline
      ],
      component: KidneyDiseaseProgressionTimelineDocument
    },
    // Dialysis Planning (MUST be BEFORE Estimated Time to Dialysis - /^dialysis.*planning/i would match dialysis_planning)
    {
      name: 'Dialysis Planning',
      patterns: [
        /^dialysis_planning$/i,                       // EXACT: dialysis_planning
        /^dialysis.*planning$/i,                      // dialysis_planning (no suffix)
        /^planning.*dialysis/i,                       // planning_for_dialysis
        /^modality.*planning/i,                       // modality_planning
        /^hd.*pd.*planning/i,                         // hd_pd_planning
        /^renal.*replacement.*planning/i,             // renal_replacement_planning
      ],
      component: DialysisPlanningDocument
    },
    // Mineral Bone Disease (CKD-MBD)
    {
      name: 'Mineral Bone Disease',
      patterns: [
        /^mineral_bone_disease$/i,                    // EXACT: mineral_bone_disease
        /^mineral.*bone.*disease/i,                   // mineral_bone_disease
        /^ckd.*mbd$/i,                                // ckd_mbd (abbreviation)
        /^ckd.*mineral.*bone/i,                       // ckd_mineral_bone_disease
        /^renal.*osteodystrophy/i,                    // renal_osteodystrophy
        /^secondary.*hyperparathyroidism/i,           // secondary_hyperparathyroidism
        /^bone.*mineral.*disease/i,                   // bone_mineral_disease
      ],
      component: MineralBoneDiseaseDocument
    },
    // Renal Anemia
    {
      name: 'Renal Anemia',
      patterns: [
        /^renal_anemia$/i,                            // EXACT: renal_anemia
        /^renal.*anemia/i,                            // renal_anemia
        /^anemia.*ckd/i,                              // anemia_of_ckd
        /^anemia.*chronic.*kidney/i,                  // anemia_chronic_kidney_disease
        /^ckd.*anemia/i,                              // ckd_anemia
        /^kidney.*anemia/i,                           // kidney_disease_anemia
        /^esa.*therapy/i,                             // esa_therapy
        /^erythropoietin/i,                           // erythropoietin
      ],
      component: RenalAnemiaDocument
    },
    // Fluid Electrolyte Management
    {
      name: 'Fluid Electrolyte Management',
      patterns: [
        /^fluid_electrolyte_management$/i,            // EXACT: fluid_electrolyte_management
        /^fluid.*electrolyte/i,                       // fluid_electrolyte_management
        /^electrolyte.*management/i,                  // electrolyte_management
        /^fluid.*management/i,                        // fluid_management
        /^volume.*status/i,                           // volume_status
        /^diuretic.*management/i,                     // diuretic_management
      ],
      component: FluidElectrolyteManagementDocument
    },
    // Fluid Intake
    {
      name: 'Fluid Intake',
      patterns: [
        /^fluid_intake$/i,                             // EXACT: fluid_intake
      ],
      component: FluidIntakeDocument
    },
    // Fluid Output
    {
      name: 'Fluid Output',
      patterns: [
        /^fluid_output$/i,                             // EXACT: fluid_output
      ],
      component: FluidOutputDocument
    },
    // Blood Glucose Monitoring
    {
      name: 'Blood Glucose Monitoring',
      patterns: [
        /^blood[_\s]?glucose[_\s]?monitoring$/i,       // EXACT: blood_glucose_monitoring
      ],
      component: BloodGlucoseMonitoringDocument
    },
    // Autoantibody Profile
    {
      name: 'Autoantibody Profile',
      patterns: [
        /^autoantibody[_\s]?profile$/i,       // EXACT: autoantibody_profile
      ],
      component: AutoantibodyProfileDocument
    },
    // Scleroderma Assessment
    {
      name: 'Scleroderma Assessment',
      patterns: [
        /^scleroderma[_\s]?assessment$/i,       // EXACT: scleroderma_assessment
      ],
      component: SclerodermaAssessmentDocument
    },
    // Sjogrens Syndrome Assessment
    {
      name: 'Sjogrens Syndrome Assessment',
      patterns: [
        /^sjogrens[_\s]?syndrome[_\s]?assessment$/i,       // EXACT: sjogrens_syndrome_assessment
      ],
      component: SjogrensSyndromeAssessmentDocument
    },
    // Vasculitis Assessment
    {
      name: 'Vasculitis Assessment',
      patterns: [
        /^vasculitis[_\s]?assessment$/i,       // EXACT: vasculitis_assessment
      ],
      component: VasculitisAssessmentDocument
    },
    // Care Team
    {
      name: 'Care Team',
      patterns: [
        /^care_team$/i,                                // EXACT: care_team (avoid ibd_care_team, care_team_info, oncology_care_team)
      ],
      component: CareTeamDocument
    },
    // Burn Assessment
    {
      name: 'Burn Assessment',
      patterns: [
        /^burn_assessment$/i,                            // EXACT: burn_assessment (avoid burn_wound_care)
      ],
      component: BurnAssessmentDocument
    },
    // Burn Fluid Resuscitation
    {
      name: 'Burn Fluid Resuscitation',
      patterns: [
        /^burn_fluid_resuscitation$/i,                   // EXACT: burn_fluid_resuscitation
      ],
      component: BurnFluidResuscitationDocument
    },
    // Burn Wound Care
    {
      name: 'Burn Wound Care',
      patterns: [
        /^burn_wound_care$/i,                            // EXACT: burn_wound_care (avoid burn_assessment)
      ],
      component: BurnWoundCareDocument
    },
    // Burn Rehabilitation
    {
      name: 'Burn Rehabilitation',
      patterns: [
        /^burn_rehabilitation$/i,                        // EXACT: burn_rehabilitation (avoid burn_assessment, burn_wound_care)
      ],
      component: BurnRehabilitationDocument
    },
    // CAM-ICU Assessment
    {
      name: 'CAM-ICU Assessment',
      patterns: [
        /^cam_icu$/i,                                    // EXACT: cam_icu
        /^cam.*icu/i,                                    // cam icu
        /^icu.*delirium.*assessment/i,                   // ICU delirium assessment
        /^delirium.*screening/i,                         // delirium screening
      ],
      component: CamIcuDocument
    },
    // Chiropractic Consultation
    {
      name: 'Chiropractic Consultation',
      patterns: [
        /^chiropractic_consultation$/i,
      ],
      component: ChiropracticConsultationDocument
    },
    // Spinal Manipulation Record
    {
      name: 'Spinal Manipulation Record',
      patterns: [
        /^spinal_manipulation_record$/i,
      ],
      component: SpinalManipulationRecordDocument
    },
    // Chiropractic X-Ray Review
    {
      name: 'Chiropractic X-Ray Review',
      patterns: [
        /^chiropractic_x_ray_review$/i,
      ],
      component: ChiropracticXRayReviewDocument
    },
    // Chiropractic Treatment Plan
    {
      name: 'Chiropractic Treatment Plan',
      patterns: [
        /^chiropractic_treatment_plan$/i,
      ],
      component: ChiropracticTreatmentPlanDocument
    },
    // Renal Nutrition
    {
      name: 'Renal Nutrition',
      patterns: [
        /^renal_nutrition$/i,                         // EXACT: renal_nutrition
        /^renal.*nutrition/i,                         // renal_nutrition
        /^kidney.*nutrition/i,                        // kidney_nutrition
        /^ckd.*nutrition/i,                           // ckd_nutrition
        /^dialysis.*nutrition/i,                      // dialysis_nutrition
        /^nephrology.*diet/i,                         // nephrology_diet
        /^renal.*diet/i,                              // renal_diet
      ],
      component: RenalNutritionDocument
    },
    // Medication Renal Dosing
    {
      name: 'Medication Renal Dosing',
      patterns: [
        /^medication_renal_dosing$/i,                 // EXACT: medication_renal_dosing
        /^medication.*renal.*dos/i,                   // medication_renal_dosing
        /^renal.*dos.*medication/i,                   // renal_dosing_medication
        /^kidney.*dos.*medication/i,                  // kidney_dosing_medication
        /^ckd.*medication.*dos/i,                     // ckd_medication_dosing
        /^nephrotoxic.*medication/i,                  // nephrotoxic_medications
        /^renal.*adjusted.*medication/i,              // renal_adjusted_medications
      ],
      component: MedicationRenalDosingDocument
    },
    // Estimated Time to Dialysis
    {
      name: 'Estimated Time to Dialysis',
      patterns: [
        /^estimated_time_to_dialysis$/i,              // EXACT: estimated_time_to_dialysis
        /^estimated.*time.*dialysis/i,                // estimated_time_to_dialysis
        /^time.*to.*dialysis/i,                       // time_to_dialysis
        /^dialysis.*time.*estimate/i,                 // dialysis_time_estimate
        /^esrd.*progression/i,                        // esrd_progression
      ],
      component: EstimatedTimeToDialysisDocument
    },
    // Education Initiated
    {
      name: 'Education Initiated',
      patterns: [
        /^education_initiated$/i,                     // EXACT: education_initiated
        /^education.*initiated/i,                     // education_initiated
        /^initiated.*education/i,                     // initiated_education
        /^patient.*education.*init/i,                 // patient_education_initiated
        /^dialysis.*education.*init/i,                // dialysis_education_initiated
      ],
      component: EducationInitiatedDocument
    },
    // Access Planning
    {
      name: 'Access Planning',
      patterns: [
        /^access_planning$/i,                         // EXACT: access_planning
        /^access.*planning/i,                         // access_planning
        /^vascular.*access.*plan/i,                   // vascular_access_planning
        /^dialysis.*access.*plan/i,                   // dialysis_access_planning
        /^av.*fistula.*plan/i,                        // av_fistula_planning
        /^hd.*catheter.*plan/i,                       // hd_catheter_planning
      ],
      component: AccessPlanningDocument
    },
    // Genetics Psychosocial Assessment (MUST be BEFORE generic psychosocial patterns)
    {
      name: 'Genetics Psychosocial Assessment',
      patterns: [
        /^genetics_psychosocial_assessment$/i,        // EXACT: genetics_psychosocial_assessment
        /^genetics.*psychosocial.*assessment/i,       // genetics_psychosocial_assessment
        /^genetic.*psychosocial/i,                    // genetic_psychosocial
        /^psychosocial.*genetics/i,                   // psychosocial_genetics
        /^genetics.*psych.*assess/i,                  // genetics_psych_assessment
      ],
      component: GeneticsPsychosocialAssessmentDocument
    },
    // Inheritance Pattern Details
    {
      name: 'Inheritance Pattern Details',
      patterns: [
        /^inheritance_pattern_details$/i,             // EXACT: inheritance_pattern_details
        /^inheritance.*pattern.*details/i,            // inheritance_pattern_details variations
        /^inheritance.*pattern/i,                     // inheritance pattern
        /^pattern.*inheritance/i,                     // pattern inheritance
        /^genetic.*inheritance/i,                     // genetic inheritance
        /^inheritance.*genetics/i,                    // inheritance genetics
      ],
      component: InheritancePatternDetailsDocument
    },
    // Children Specific Risk
    {
      name: 'Children Specific Risk',
      patterns: [
        /^children_specific_risk$/i,                   // EXACT: children_specific_risk
        /^children.*specific.*risk/i,                  // children_specific_risk variations
        /^specific.*risk.*children/i,                  // specific risk children
        /^pediatric.*risk/i,                           // pediatric risk
        /^children.*risk/i,                            // children risk
      ],
      component: ChildrenSpecificRiskDocument
    },

    // ACMG Guidelines Reference
    {
      name: 'ACMG Guidelines Reference',
      patterns: [
        /^acmg_guidelines_reference$/i,              // EXACT: acmg_guidelines_reference
        /^acmg.*guideline/i,                         // acmg_guidelines, acmg_guideline_reference
        /^acmg.*reference/i,                         // acmg_reference
        /^acmg.*amp/i,                               // acmg_amp, acmg_amp_standards
        /^variant.*classification.*guideline/i,      // variant_classification_guidelines
        /^pharmacogenomic.*variant/i,                 // pharmacogenomic_variant_classification
      ],
      component: AcmgGuidelinesReferenceDocument
    },

    {
      name: 'Extended Family History',
      patterns: [
        /^extended_family_history$/i,                 // EXACT: extended_family_history
        /^extended.*family.*history/i,                // extended_family_history, extended family history
        /^family.*history.*extended/i,                // family_history_extended
        /^detailed.*family.*history/i,                // detailed_family_history
        /^comprehensive.*family.*history/i,           // comprehensive_family_history
      ],
      component: ExtendedFamilyHistoryDocument
    },
    {
      name: 'Detailed Family Pedigree',
      patterns: [
        /^detailed_family_pedigree$/i,               // EXACT: detailed_family_pedigree
        /^detailed.*family.*pedigree/i,              // detailed_family_pedigree variations
        /^family.*pedigree.*detailed/i,              // family_pedigree_detailed
        /^pedigree.*chart/i,                         // pedigree_chart
        /^genetic.*pedigree/i,                       // genetic_pedigree
        /^family.*pedigree$/i,                       // family_pedigree
      ],
      component: DetailedFamilyPedigreeDocument
    },
    {
      name: 'Chemotherapy Records',
      patterns: [
        /^chemotherapy_records$/i,                   // exact match - chemotherapy_records collection
        /^chemo.*records$/i,                         // chemo records
        /^chemotherapy.*treatment.*records$/i,       // chemotherapy treatment records
      ],
      component: ChemotherapyRecordsDocument
    },
    {
      name: 'Chemotherapy Regimen',
      patterns: [
        /^chemotherapy_regimen$/i,                   // exact match
        /^chemotherapy.*regimen/i,                   // chemotherapy_regimen, chemotherapy regimen
        /^chemotherapy_record$/i,                    // chemotherapy_record (singular) - EXACT match
        /^chemo.*regimen/i,                          // chemo_regimen
        /^chemo.*protocol/i,                         // chemo_protocol
        /^chemo_record$/i,                           // chemo_record (singular) - EXACT match
        /^treatment.*regimen/i,                      // treatment_regimen
        /^cancer.*treatment/i,                       // cancer_treatment
      ],
      component: ChemotherapyRegimenDocument
    },
    {
      name: 'Radiation Therapy Records',
      patterns: [
        /^radiation[_\s]?therapy[_\s]?records$/i,     // radiation_therapy_records
        /^radiation[_\s]?therapy[_\s]?record$/i,      // radiation_therapy_record
      ],
      component: RadiationTherapyRecordsDocument
    },
    {
      name: 'Radiation Therapy',
      patterns: [
        /^radiation[_\s]?therapy$/i,                  // radiation_therapy, radiation therapy
        /^radiation[_\s]?treatment$/i,                // radiation_treatment
        /^radiotherapy$/i,                            // radiotherapy
        /^rt[_\s]?records$/i,                         // rt_records
        /^xrt$/i,                                     // xrt
        /^external[_\s]?beam/i,                       // external_beam, external beam radiation
        /^ebrt$/i,                                    // ebrt
        /^imrt$/i,                                    // imrt
        /^sbrt$/i,                                    // sbrt
        /^radiation[_\s]?oncology/i,                  // radiation_oncology
      ],
      component: RadiationTherapyDocument
    },
    {
      name: 'Clinical Trials',
      patterns: [
        /^clinical[_\s]?trials$/i,                    // clinical_trials
        /^clinical[_\s]?trial$/i,                     // clinical_trial
        /^trials?[_\s]?offered$/i,                    // trials_offered
        /^trial[_\s]?eligibility$/i,                  // trial_eligibility
        /^trial[_\s]?enrollment$/i,                   // trial_enrollment
        /^research[_\s]?trial/i,                      // research_trial
        /^drug[_\s]?trial/i,                          // drug_trial
        /^phase[_\s]?(1|2|3|i|ii|iii)[_\s]?trial/i,   // phase 1/2/3/I/II/III trial
        /^oncology[_\s]?trial/i,                      // oncology_trial
      ],
      component: ClinicalTrialsDocument
    },
    {
      name: 'Clinical Trial Documents',
      patterns: [
        /^clinical[_\s]?trial[_\s]?documents?$/i,      // clinical_trial_documents, clinical_trial_document
        /^trial[_\s]?documents?$/i,                   // trial_documents, trial_document
        /^study[_\s]?documents?$/i,                   // study_documents
        /^protocol[_\s]?documents?$/i,                // protocol_documents
      ],
      component: ClinicalTrialDocumentsDocument
    },
    {
      name: 'Palliative Care',
      patterns: [
        /^palliative_care$/i,                    // EXACT: palliative_care (distinct from palliative_care_needs)
      ],
      component: PalliativeCareDocument
    },
    {
      name: 'Palliative Care Needs',
      patterns: [
        /^palliative[_\s]?care[_\s]?needs$/i,           // palliative_care_needs
        /^palliative[_\s]?care$/i,                     // palliative_care
        /^comfort[_\s]?care$/i,                        // comfort_care
        /^hospice[_\s]?care$/i,                        // hospice_care
        /^end[_\s]?of[_\s]?life[_\s]?care$/i,          // end_of_life_care
        /^symptom[_\s]?management$/i,                  // symptom_management
        /^quality[_\s]?of[_\s]?life$/i,                // quality_of_life
        /^goals[_\s]?of[_\s]?care$/i,                  // goals_of_care
      ],
      component: PalliativeCareNeedsDocument
    },
    {
      name: 'Hospice Notes',
      patterns: [
        /^hospice[_\s]?notes$/i,                          // hospice_notes
        /^hospice[_\s]?evaluation$/i,                     // hospice_evaluation
        /^hospice[_\s]?transition[_\s]?plan$/i,           // hospice_transition_plan
      ],
      component: HospiceNotesDocument
    },
    // ========== TUMOR BOARD NOTES ==========
    {
      name: 'Tumor Board Notes',
      patterns: [
        /^tumor[_\s]?board[_\s]?notes$/i,                 // tumor_board_notes
        /^tumor[_\s]?board$/i,                            // tumor_board
        /^multidisciplinary[_\s]?tumor[_\s]?board$/i,     // multidisciplinary_tumor_board
        /^cancer[_\s]?conference$/i,                      // cancer_conference
      ],
      component: TumorBoardNotesDocument
    },

    // ========== CYSTOSCOPY REPORTS ==========
    // Cystoscopy procedure findings, bladder assessment, biopsy, ureteric orifices
    {
      name: 'Cystoscopy Reports',
      patterns: [
        /^cystoscopy_reports$/i,                  // EXACT: cystoscopy_reports
        /^cystoscopy.*report/i,                   // cystoscopy_report variations
        /^cystoscopy.*finding/i,                  // cystoscopy_findings
        /^bladder.*scope/i,                       // bladder_scope
        /^cystourethroscopy/i,                    // cystourethroscopy
      ],
      component: CystoscopyReportsDocument
    },

    // ========== URODYNAMIC STUDIES ==========
    // Urodynamic testing - filling/voiding cystometry, flow rates, detrusor assessment
    {
      name: 'Urodynamic Studies',
      patterns: [
        /^urodynamic_studies$/i,                   // EXACT: urodynamic_studies
        /^urodynamic.*stud/i,                      // urodynamic_study variations
        /^urodynamic.*test/i,                      // urodynamic_testing
        /^cystometr/i,                             // cystometry, cystometrogram
        /^pressure.*flow.*stud/i,                  // pressure_flow_study
      ],
      component: UrodynamicStudiesDocument
    },

    // ========== UROLOGY CONSULTATIONS ==========
    // Urology consultations - chief complaint, prostate, renal, stones, urodynamics, cystoscopy
    {
      name: 'Urology Consultations',
      patterns: [
        /^urology_consultations$/i,                // EXACT: urology_consultations
        /^urology.*consult/i,                       // urology_consultation variations
        /^urolog.*eval/i,                            // urology_evaluation
        /^urolog.*assess/i,                          // urology_assessment
      ],
      component: UrologyConsultationsDocument
    },

    // ========== SEPSIS MANAGEMENT ==========
    // Sepsis management - severity, qSOFA/SOFA scores, cultures, antibiotics, vasopressors, organ dysfunction, bundle compliance
    {
      name: 'Sepsis Management',
      patterns: [
        /^sepsis_management$/i,                    // EXACT: sepsis_management
        /^sepsis.*management/i,                    // sepsis_management variations
        /^sepsis.*protocol/i,                      // sepsis_protocol
        /^sepsis.*bundle/i,                        // sepsis_bundle
      ],
      component: SepsisManagementDocument
    },

    // ========== EEG REPORTS ==========
    {
      name: 'EEG Reports',
      patterns: [
        /^eeg[_\s]?reports?$/i,                   // eeg_reports, eeg_report
        /^electroencephalog(?:ram|raphy)[_\s]?reports?$/i,  // electroencephalogram_reports
      ],
      component: EegReportsDocument
    },

    // ========== CONCUSSION ASSESSMENT ==========
    {
      name: 'Concussion Assessment',
      patterns: [
        /^concussion[_\s]?assessment$/i,
      ],
      component: ConcussionAssessmentDocument
    },

    // ========== EMS RUN REPORTS ==========
    {
      name: 'EMS Run Reports',
      patterns: [
        /^ems[_\s]?run[_\s]?reports?$/i,
      ],
      component: EmsRunReportsDocument
    },

    // ========== AUTOPSY REPORTS ==========
    {
      name: 'Autopsy Reports',
      patterns: [
        /^autopsy[_\s]?reports?$/i,
      ],
      component: AutopsyReportsDocument
    },

    // ========== TOXICOLOGY REPORTS ==========
    {
      name: 'Toxicology Reports',
      patterns: [
        /^toxicology[_\s]?reports?$/i,
      ],
      component: ToxicologyReportsDocument
    },

    // ========== POISON CONTROL REPORTS ==========
    {
      name: 'Poison Control Reports',
      patterns: [
        /^poison_control_reports$/i,       // EXACT match: poison_control_reports
        /^poison.*control/i,               // poison_control variations
        /^poison.*report/i,                // poison_report
        /^toxicology.*control/i,           // toxicology_control
      ],
      component: PoisonControlReportsDocument
    },

    // ========== DNR ORDERS ==========
    {
      name: 'DNR Orders',
      patterns: [
        /^dnr[_\s]?orders?$/i,
      ],
      component: DnrOrdersDocument
    },

    // ========== CASE SUMMARIES ==========
    {
      name: 'Case Summaries',
      patterns: [
        /^case[_\s]?summaries?$/i,
      ],
      component: CaseSummariesDocument
    },
    {
      patterns: [
        /^resuscitation[_\s]?records?$/i,
      ],
      component: ResuscitationRecordsDocument
    },
    // ========== GLOMERULAR DISEASE ==========
    {
      patterns: [
        /^glomerular[_\s]?disease$/i,
      ],
      component: GlomerularDiseaseDocument
    },
    // ========== CODE BLUE SUMMARIES ==========
    {
      patterns: [
        /^code[_\s]?blue[_\s]?summar/i,
      ],
      component: CodeBlueSummariesDocument
    },
    // ========== RAPID RESPONSE SUMMARIES ==========
    {
      patterns: [
        /^rapid[_\s]?response[_\s]?summar/i,
      ],
      component: RapidResponseSummariesDocument
    },

    // ========== EPILEPSY ASSESSMENT ==========
    {
      patterns: [
        /^epilepsy[_\s]?assessment$/i,
      ],
      component: EpilepsyAssessmentDocument
    },

    // ========== HEADACHE ASSESSMENT ==========
    {
      patterns: [
        /^headache[_\s]?assessment$/i,
      ],
      component: HeadacheAssessmentDocument
    },

    // ========== DAY PROGRAMS ==========
    {
      patterns: [
        /^day[_\s]?programs$/i,
      ],
      component: DayProgramsDocument
    },

    // ========== PATIENT VISITS ==========
    {
      name: 'Patient Visits',
      patterns: [
        /^patient[_\s]?visits?$/i,
      ],
      component: PatientVisitDocument
    },

    // ========== PREGNANCY COMPLICATIONS ==========
    {
      name: 'Pregnancy Complications',
      patterns: [
        /^pregnancy_complications$/i,              // EXACT: pregnancy_complications
        /^pregnancy.*complication/i,               // pregnancy complications variations
        /^obstetric.*complication/i,               // obstetric complications
        /^maternal.*complication/i,                // maternal complications
        /^hypertensive.*disorder.*pregnancy/i,     // hypertensive disorders of pregnancy
        /^preterm.*labor/i,                        // preterm labor
      ],
      component: PregnancyComplicationsDocument
    },

    // ========== PARTNER NOTIFICATION ==========
    {
      name: 'Partner Notification',
      patterns: [
        /^partner_notification$/i,                 // EXACT: partner_notification
        /^partner.*notification/i,                 // partner notification variations
        /^contact.*notification/i,                 // contact notification
        /^disease.*intervention.*specialist/i,     // disease intervention specialist
        /^std.*partner.*notification/i,            // STD partner notification
        /^sti.*partner.*notification/i,            // STI partner notification
        /^hiv.*partner.*notification/i,            // HIV partner notification
      ],
      component: PartnerNotificationDocument
    },

    // ========== STI SCREENING PANEL ==========
    {
      name: 'STI Screening Panel',
      patterns: [
        /^sti_screening_panel$/i,              // EXACT: sti_screening_panel
        /^sti.*screening.*panel/i,             // STI screening panel variations
        /^std.*screening.*panel/i,             // STD screening panel
        /^sexual.*transmitted.*screen/i,       // sexually transmitted infection screening
        /^sti.*panel/i,                        // STI panel
        /^std.*panel/i,                        // STD panel
      ],
      component: StiScreeningPanelDocument
    },

    // ========== SEXUAL HEALTH COUNSELING ==========
    {
      name: 'Sexual Health Counseling',
      patterns: [
        /^sexual_health_counseling$/i,             // EXACT: sexual_health_counseling
        /^sexual.*health.*counsel/i,               // sexual health counseling variations
        /^sexual.*counsel/i,                       // sexual counseling
        /^sex.*counsel/i,                          // sex counseling
        /^sexual.*health.*session/i,               // sexual health session
        /^sexual.*dysfunction.*counsel/i,          // sexual dysfunction counseling
      ],
      component: SexualHealthCounselingDocument
    },

    // ========== HIV PEP PROPHYLAXIS ==========
    {
      name: 'HIV PEP Prophylaxis',
      patterns: [
        /^hiv_pep_prophylaxis$/i,                  // EXACT: hiv_pep_prophylaxis
        /^hiv[_\s]?pep[_\s]?prophylaxis$/i,        // hiv_pep_prophylaxis variations
        /^pep[_\s]?prophylaxis$/i,                  // pep_prophylaxis
        /^post[_\s]?exposure[_\s]?prophylaxis$/i,   // post_exposure_prophylaxis
        /^hiv[_\s]?pep$/i,                          // hiv_pep
        /^pep[_\s]?regimen$/i,                      // pep_regimen
        /^occupational[_\s]?pep$/i,                 // occupational_pep
        /^non[_\s]?occupational[_\s]?pep$/i,        // non_occupational_pep
      ],
      component: HivPepProphylaxisDocument
    },

    // Shift Handoff Notes
    {
      name: 'Shift Handoff Notes',
      patterns: [
        /^shift_handoff_notes$/i,                   // EXACT: shift_handoff_notes
        /^shift[_\s]?handoff[_\s]?note/i,           // shift handoff notes variations
        /^handoff[_\s]?note/i,                      // handoff notes
        /^shift[_\s]?report/i,                      // shift report
        /^nursing[_\s]?handoff/i,                   // nursing handoff
        /^bedside[_\s]?handoff/i,                   // bedside handoff
        /^sbar[_\s]?handoff/i,                      // SBAR handoff
      ],
      component: ShiftHandoffNotesDocument
    },

    // ========== OMISSIONS & REFUSALS ==========
    {
      name: 'Omissions & Refusals',
      patterns: [
        /^omissions_refusals$/i,                  // Exact match
        /^omission.*refusal/i,                    // omission_refusals, omissions_refusal
        /^treatment.*refusal/i,                   // treatment_refusals
        /^patient.*refusal/i,                     // patient_refusals
        /^medication.*refusal/i,                  // medication_refusals
        /^refusal.*document/i,                    // refusal_documentation
        /^care.*refusal/i,                        // care_refusals
      ],
      component: OmissionsRefusalsDocument
    },

    // TPN Management
    {
      name: 'TPN Management',
      patterns: [
        /^tpn_management$/i,                      // EXACT: tpn_management
        /^tpn.*management$/i,                     // tpn_management variations
        /^tpn$/i,                                 // TPN abbreviation
        /^total.*parenteral.*nutrition$/i,         // total_parenteral_nutrition
        /^parenteral.*nutrition.*management$/i,    // parenteral_nutrition_management
        /^tpn.*order/i,                           // tpn_orders
        /^tpn.*monitoring/i,                      // tpn_monitoring
        /^tpn.*assessment/i,                      // tpn_assessment
      ],
      component: TpnManagementDocument
    },

    // Medication Dosing Recommendation
    {
      name: 'Medication Dosing Recommendation',
      patterns: [
        /^medication_dosing_recommendation$/i,       // EXACT: medication_dosing_recommendation
        /^medication.*dosing.*recommend/i,            // medication_dosing_recommendation
        /^dosing.*recommend.*medication/i,            // dosing_recommendation_medication
        /^drug.*dosing.*recommend/i,                  // drug_dosing_recommendation
        /^medication.*dose.*recommend/i,              // medication_dose_recommendation
        /^pharmacological.*dosing/i,                  // pharmacological_dosing
        /^dosing.*guideline/i,                        // dosing_guidelines
      ],
      component: MedicationDosingRecommendationDocument
    },

    // Add more templates here as you create them...
  ];

  /**
   * Format category name for display
   */
  const formatCategoryName = (name) => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  /**
   * Find matching template for category using pattern matching
   *
   * @param {string} category - Category from backend
   * @returns {object|null} - Matching template config or null
   */
  const findMatchingTemplate = (category) => {
    if (!category) return null;

    // Normalize category for matching
    const normalizedCategory = category.toLowerCase().trim();

    // Try exact match first (fastest)
    for (const template of TEMPLATE_PATTERNS) {
      if (template.patterns.some(pattern => {
        // Convert pattern to string for exact match check
        const patternStr = pattern.source.toLowerCase();
        if (normalizedCategory === patternStr) return true;
        return false;
      })) {
        console.log(`[AIDocumentRenderer] Exact match: "${category}" → ${template.name}`);
        return template;
      }
    }

    // Try pattern match
    for (const template of TEMPLATE_PATTERNS) {
      for (const pattern of template.patterns) {
        if (pattern.test(normalizedCategory)) {
          console.log(`[AIDocumentRenderer] Pattern match: "${category}" → ${template.name} (pattern: ${pattern})`);
          return template;
        }
      }
    }

    console.log(`[AIDocumentRenderer] No match found for category: "${category}"`);
    return null;
  };

  /**
   * Route to correct template based on category
   */
  const renderContent = () => {
    console.log('[AIDocumentRenderer] ===== DATA EXTRACTION START =====');
    console.log('[AIDocumentRenderer] Category:', category);
    console.log('[AIDocumentRenderer] Document:', document);
    console.log('[AIDocumentRenderer] Document keys:', Object.keys(document || {}));
    console.log('[AIDocumentRenderer] document.documentData:', document?.documentData);
    console.log('[AIDocumentRenderer] document.data:', document?.data);
    console.log('[AIDocumentRenderer] document[category]:', document?.[category]);

    // Unwrap documentData from unified document structure
    // Backend returns: { _id, patientId, category, documentDate, documentData: {...} }
    // Templates expect: documentData directly

    // CRITICAL: For collection-specific wrapped responses from agent
    // Backend wraps single collection responses: { _id: "..._all", collection_name: [{...}] }
    // Extract the actual data array from collection-specific field
    let dataToPass = document.documentData || document.data || document;

    // Check if document has a collection-specific array field (e.g., patient_education_records)
    // This handles wrapped responses from WRAP_ALL_RECORDS_COLLECTIONS
    if (document[category]) {
      console.log(`[AIDocumentRenderer] ✅ Found collection-specific field: ${category}`);
      console.log(`[AIDocumentRenderer] Extracting data from document["${category}"]`);
      dataToPass = document[category];
    } else if (document.records && Array.isArray(document.records)) {
      // Backend wrapRecordsIntoSingleDocument uses 'records' field
      console.log(`[AIDocumentRenderer] ✅ Found backend wrapped records field`);
      dataToPass = document.records;
    } else {
      console.log(`[AIDocumentRenderer] ⚠️ No collection-specific field found for category: ${category}`);
      console.log('[AIDocumentRenderer] Using fallback: document.documentData || document.data || document');
    }

    // CRITICAL: Multi-level unwrapping for nested document structures
    // Data can be double-wrapped: document.medications = [{ medications: [wrappedDoc], ... }]
    // This happens when ArtifactPanel collection selector re-wraps already-wrapped data
    // Keep unwrapping until we reach the actual records
    let unwrapAttempts = 0;
    const MAX_UNWRAP = 5;
    while (unwrapAttempts < MAX_UNWRAP) {
      unwrapAttempts++;
      let didUnwrap = false;

      // Case A: Array with single element that has the SAME category field inside
      // e.g., dataToPass = [{ medications: [...], _id: '..._all', ... }]
      if (Array.isArray(dataToPass) && dataToPass.length === 1 && dataToPass[0] && typeof dataToPass[0] === 'object') {
        const candidate = dataToPass[0];
        console.log(`[AIDocumentRenderer] 🔍 Unwrap attempt ${unwrapAttempts} - candidate keys:`, Object.keys(candidate));

        // Sub-case A1: Candidate has same category field (double-wrapped by ArtifactPanel)
        if (candidate[category] && candidate[category] !== dataToPass) {
          console.log(`[AIDocumentRenderer] 📦 Unwrapping nested category field: ${category}`);
          dataToPass = candidate[category];
          didUnwrap = true;
        }
        // Sub-case A2: Candidate is a wrapRecordsIntoSingleDocument wrapper (has records/_records)
        else {
          const recordsArr = candidate.records || candidate._records;
          const hasRecordArray = recordsArr && Array.isArray(recordsArr) && recordsArr.length > 0;
          const isWrapped = String(candidate._id || '').startsWith('wrapped_');
          const hasWrapperMarkers = isWrapped || candidate._recordCount || candidate._collectionName || candidate._documentTitle;
          if (hasRecordArray && hasWrapperMarkers) {
            console.log(`[AIDocumentRenderer] 📦 Unwrapping wrapRecordsIntoSingleDocument: ${recordsArr.length} records`);
            dataToPass = recordsArr;
            didUnwrap = true;
          }
        }
      }

      // Case B: dataToPass IS a wrapper object itself (not in an array)
      if (!didUnwrap && !Array.isArray(dataToPass) && dataToPass && typeof dataToPass === 'object') {
        // Sub-case B1: Object has same category field
        if (dataToPass[category] && typeof dataToPass[category] !== 'string') {
          console.log(`[AIDocumentRenderer] 📦 Unwrapping direct object category field: ${category}`);
          dataToPass = dataToPass[category];
          didUnwrap = true;
        }
        // Sub-case B2: Object is a wrapRecordsIntoSingleDocument wrapper
        else {
          const recordsArr = dataToPass.records || dataToPass._records;
          const hasRecordArray = recordsArr && Array.isArray(recordsArr) && recordsArr.length > 0;
          const isWrapped = String(dataToPass._id || '').startsWith('wrapped_');
          const hasWrapperMarkers = isWrapped || dataToPass._recordCount || dataToPass._collectionName;
          if (hasRecordArray && hasWrapperMarkers) {
            console.log(`[AIDocumentRenderer] 📦 Unwrapping direct wrapper object: ${recordsArr.length} records`);
            dataToPass = recordsArr;
            didUnwrap = true;
          }
        }
      }

      if (!didUnwrap) break;
    }
    if (unwrapAttempts > 1) {
      console.log(`[AIDocumentRenderer] 📦 Total unwrap iterations: ${unwrapAttempts - 1}`);
    }

    console.log('[AIDocumentRenderer] ===== FINAL DATA TO PASS =====');
    console.log('[AIDocumentRenderer] dataToPass:', dataToPass);
    console.log('[AIDocumentRenderer] dataToPass type:', typeof dataToPass);
    console.log('[AIDocumentRenderer] dataToPass is array?:', Array.isArray(dataToPass));

    console.log('[AIDocumentRenderer] ===== ROUTING START =====');

    // Find matching template
    const templateConfig = findMatchingTemplate(category);

    if (templateConfig) {
      const TemplateComponent = templateConfig.component;
      console.log(`[AIDocumentRenderer] ✅ Rendering with: ${templateConfig.name} template`);
      return <TemplateComponent document={dataToPass} data={dataToPass} templateData={dataToPass} />;
    }

    // No match - use generic fallback
    console.log('[AIDocumentRenderer] ⚠️ No template match - using generic fallback');
    return renderGenericDocument(dataToPass, category);
  };

  /**
   * Generic document renderer for unknown categories
   *
   * TODO: Make this SMART - auto-detect sections and render beautifully
   * For now: Simple formatted JSON display
   */
  const renderGenericDocument = (doc, category) => {
    return (
      <div className="ai-document-content">
        {/* Header */}
        <div style={{
          padding: '24px',
          background: '#0d1929',
          borderRadius: '8px',
          marginBottom: '24px',
          borderLeft: '4px solid #f59e0b'
        }}>
          <h1 style={{ margin: '0 0 8px 0', color: '#f59e0b' }}>
            {formatCategoryName(category)}
          </h1>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '14px' }}>
            ⚠️ No dedicated template available - showing generic view
          </p>
        </div>

        {/* Patient Demographics (if available) */}
        {(doc.patientName || doc.dateOfBirth) && (
          <section className="ai-section">
            <h2 className="section-title">Patient Information</h2>
            <div className="ai-card">
              {doc.patientName && (
                <p style={{ marginBottom: '8px' }}>
                  <strong>Name:</strong> {doc.patientName}
                </p>
              )}
              {doc.dateOfBirth && (
                <p style={{ marginBottom: '8px' }}>
                  <strong>Date of Birth:</strong> {new Date(doc.dateOfBirth).toLocaleDateString()}
                </p>
              )}
              {doc.age && (
                <p style={{ marginBottom: '8px' }}>
                  <strong>Age:</strong> {doc.age}
                </p>
              )}
              {doc.gender && (
                <p style={{ marginBottom: '8px' }}>
                  <strong>Gender:</strong> {doc.gender}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Document Content (Raw JSON for now) */}
        <section className="ai-section">
          <h2 className="section-title">Document Data</h2>
          <div className="ai-card">
            <pre style={{
              whiteSpace: 'pre-wrap',
              color: '#ececf1',
              fontSize: '13px',
              lineHeight: '1.6',
              maxHeight: '600px',
              overflow: 'auto'
            }}>
              {JSON.stringify(doc, null, 2)}
            </pre>
          </div>
        </section>

        {/* Help Message */}
        <div style={{
          padding: '16px',
          background: '#1e3a5f',
          borderRadius: '8px',
          marginTop: '24px',
          borderLeft: '4px solid #3b82f6'
        }}>
          <p style={{ margin: '0 0 12px 0', color: '#93c5fd', fontSize: '14px' }}>
            💡 <strong>Developer Note:</strong> This category needs a dedicated template.
          </p>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '13px' }}>
            To add template:
          </p>
          <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: '#9ca3af', fontSize: '13px' }}>
            <li>Create <code>templates/{category}Document.jsx</code></li>
            <li>Add pattern to TEMPLATE_PATTERNS array above</li>
            <li>Import component at top of this file</li>
          </ol>
        </div>
      </div>
    );
  };

  // ========== MAIN RENDER ==========

  return (
    <Suspense fallback={<TemplateLoadingFallback />}>
      <div className="ai-document-renderer">
        {renderContent()}
      </div>
    </Suspense>
  );
};

export default AIDocumentRenderer;