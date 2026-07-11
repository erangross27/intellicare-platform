/**
 * Static System Prompt for IntelliCare Agent
 *
 * TOOL DISCOVERY ARCHITECTURE (June 2026): the agent runs with Anthropic's
 * native server-side Tool Search (tool_search_tool_bm25) and defer_loading on
 * all ~3,600 registry tools (functionRegistry.js USE_TOOL_SEARCH). The prompt
 * therefore does NOT list CRUD tool names — every medical collection follows
 * the getX/createX/updateX/deleteX naming convention and is found by search.
 * Listing names here was ~6K tokens per request AND dangerously incomplete
 * (1,126 of 3,645 tools): the model treated the list as exhaustive and
 * substituted similar-sounding tools for unlisted ones (MCP memory
 * 698d5d1702ee2910ed222842). Only non-CRUD platform utilities are listed.
 * ALL_FUNCTION_NAMES is kept for compatibility (exports, tooling) but only
 * its non-CRUD subset is interpolated into the prompt.
 */

const ALL_FUNCTION_NAMES = [
  "addPatient", "updatePatient", "deletePatientBySearch", "countPatients", "listAllPatients", "findPatient", "getPatientDetails", "getPatientsNeedingFollowUp",
  "getPatientFollowUpDetails", "scheduleFollowUp", "updateFollowUpStatus", "deleteFollowUp", "getPatientsForFollowUp", "addPatientCondition", "updatePatientCondition", "getPatientConditions", "getConditionStatistics",
  "getCollectionsWithData", "analyzeSymptoms", "analyzeUploadedDocuments", "importPatientsFromCSV", "importUsersFromCSV", "recommendTreatment", "checkDrugInteractions",
  "checkPatientsForAllergies", "checkDrugAllergy", "analyzeVitalSigns", "interpretLabResults", "getDifferentialDiagnosis", "recommendTests", "scheduleAppointment", "findAvailableSlots",
  "updateAppointment", "rescheduleAppointment", "createChatSession", "createUser", "removeDoctorInfo", "addDoctorLicense", "updateDoctorLicense", "removeDoctorLicense", "getDoctorLicense", "checkDoctorStatus",
  "runBackup", "getSystemHealth", "addLabResult", "getLabResults", "getMedications", "createMedication", "updateMedication", "deleteMedication", "getExpiredMedications", "deleteExpiredMedication",
  "updateExpiredMedication", "addDiagnosis", "updateDiagnosis", "deleteDiagnosis", "addVitalSigns", "getVitalSigns", "addAllergy", "getAllergiesAssessments", "createAllergiesAssessment", "updateAllergiesAssessment",
  "deleteAllergiesAssessment",
  "getPsychosocialAssessments", "createReferral", "getReferrals",
  "addImagingResult",
  "getClinicInfo", "getClinicAddress", "updateClinicSettings", "getClinicStatistics", "verifyInsurance",
  "submitInsuranceClaim", "createAppointment", "getAppointments", "cancelAppointment", "deleteAppointment", "reinstateAppointment", "getCancelledAppointments", "getTodayAppointments", "getOverdueAppointments", "getInsuranceDetails",
  "updateInsurance", "orderImaging", "uploadImagingResult", "updateReferralStatus", "checkDrugSafety", "getDoctorByNPI", "verifyInsuranceNetwork", "getDoctorSpecialties",
  "searchDrug", "getDrugAlternatives", "getDrugClass", "normalizeDrugName",
  "getDrugPrescribingInfo", "getDrugBlackBoxWarning", "getDrugDosageInfo", "getDrugContraindications", "getDrugPregnancyInfo", "getDrugImage",
  "captureCharge", "getPatientCharges", "generateInvoice", "processPayment", "getOutstandingBalances", "createPaymentPlan", "getRevenueReport", "getPaymentHistory", "updateCharge", "voidCharge", "voidInvoice", "refundPayment", "updatePaymentPlan", "cancelPaymentPlan",
  "searchDiagnosisCode", "validateDiagnosisCode", "suggestDiagnosisCodes", "getRelatedDiagnosisCodes",
  "checkMedicationEntitlement", "findCoveredAlternatives", "getFormularyInfo",
  "testExternalAPIConnection", "getExternalAPIHealth", "clearExternalAPICache", "checkDrugAdverseEvents", "getCDCHealthGuidelines", "findSubstanceAbuseTreatment", "getHealthProfessionalShortageAreas", "getNutritionData",
  "calculateNutritionNeeds", "getEnvironmentalHealthData", "createBackup", "listBackups", "restoreBackup", "getSystemMetrics", "optimizeDatabase", "getDatabaseStats", "clearCache", "deactivateUser",
  "deleteUser", "resetUserPassword", "sendBulkPatientSMS", "sendBulkPatientEmail", "sendAppointmentConfirmationRequest", "sendTestResultNotifications", "sendMedicationRefillReminders", "sendPatientPortalMessage", "reportPatientSymptoms", "schedulePatientAppointment",
  "getPatientMessageHistory", "parseTreatment", "parseSymptoms", "parseLabResults", "getMFAStatus", "setupMFA", "disableMFA", "getTranslations", "updateTranslations", "getDeletedPatients",
  "restorePatient", "permanentlyDeletePatient", "getGraphQLStats", "getGraphQLHealth", "configureGraphQL", "testGraphQLQuery", "createSecret", "getSecret", "rotateSecret", "deleteSecret",
  "listSecrets", "getTraces", "getMetrics", "getLoadBalancerStatus", "updateLoadBalancerConfig", "getChatSessions", "updateChatSessionTitle", "deleteChatSession", "getDiagnosisModels",
  "stopDiagnosis", "getDiagnosisStatus", "getAPIVersions", "getAPIChangelog", "deprecateAPI", "batchUpdatePatients", "batchDeleteSessions", "assignDocumentToPatient", "createWebhook", "listWebhooks",
  "deleteWebhook", "testWebhook", "getAllUsers", "setupUserAsDoctor", "assignAllPatientsToDoctor", "getUserDetails", "updateUserProfile", "getUserActivity", "suspendUser", "reactivateUser",
  "getAllClinics", "createClinic", "updateClinic", "getClinicUsage", "analyzeDatabase", "rebuildIndexes", "getCacheStatistics", "warmupCache", "performFailover", "scheduleBackup",
  "restoreFromBackup", "addServer", "removeServer", "drainServer", "getServerHealth", "getSystemHealthDetailed", "updateVitalSigns", "validateClinicToken", "rotateClinicToken", "getAPIUsageStats",
  "testAPIEndpoint", "getPerformanceTrace", "scheduleDoctorMeeting", "getDoctorMeetings", "getAvailableMeetingTimes", "createRecurringMeeting", "getRecurringMeetingSeries", "updateRecurringMeeting", "deleteRecurringMeetingSeries", "getPatientProvider", "getDoctorAvailability", "setDoctorAvailability", "getDoctorAppointments", "updateDoctorSettings", "getDoctorSchedule",
  "analyzePatientFlow", "compareMetrics", "prescribeMedication", "orderLabTest", "analyzeVitalTrends", "setVitalAlerts", "createAssessment", "conductAssessment", "createSkillsTest",
  "takeSkillsTest", "submitSkillsTest", "createEducationProgram", "createHealthCampaign", "startHealthCampaign", "pauseHealthCampaign", "resumeHealthCampaign", "getChannelPerformance", "getPatientEngagementInsights", "getConsultationNotes",
  "createConsultationNotes", "updateConsultationNotes", "deleteConsultationNotes", "getPrescriptions", "createPrescriptions", "updatePrescriptions", "deletePrescriptions", "createLabResults",
  "updateLabResults", "deleteLabResults", "getImagingReports", "createImagingReports", "updateImagingReports", "deleteImagingReports", "getDischargeSummaries", "createDischargeSummaries",
  "updateDischargeSummarie", "deleteDischargeSummarie", "getVaccinationRecords", "createVaccinationRecord", "updateVaccinationRecord", "deleteVaccinationRecord", "getAllergies", "createAllergie",
  "updateAllergie", "deleteAllergie", "updateReferral", "deleteReferral", "getMedicalCertificates", "createMedicalCertificate",
  "updateMedicalCertificate", "deleteMedicalCertificate", "getMedicalProcedures", "createMedicalProcedure", "updateMedicalProcedure", "deleteMedicalProcedure", "getEmergencyReports", "createEmergencyReport",
  "updateEmergencyReport", "deleteEmergencyReport", "getEmergencyDischargeSummaries", "createEmergencyDischargeSummarie", "updateEmergencyDischargeSummarie", "deleteEmergencyDischargeSummarie", "getHospitalAdmissionNotes", "createHospitalAdmissionNote",
  "updateHospitalAdmissionNote", "deleteHospitalAdmissionNote", "getHospitalDischargeSummaries", "createHospitalDischargeSummarie", "updateHospitalDischargeSummarie", "deleteHospitalDischargeSummarie", "getHospitalTransferNotes", "createHospitalTransferNote",
  "updateHospitalTransferNote", "deleteHospitalTransferNote", "getOperativeReports", "createOperativeReport", "updateOperativeReport", "deleteOperativeReport", "getPreOperativeAssessments", "createPreOperativeAssessment",
  "updatePreOperativeAssessment", "deletePreOperativeAssessment", "getPostOperativeReports", "createPostOperativeReport", "updatePostOperativeReport", "deletePostOperativeReport", "getAnesthesiaRecords", "createAnesthesiaRecord",
  "updateAnesthesiaRecord", "deleteAnesthesiaRecord", "getSurgicalConsentForms", "createSurgicalConsentForm", "updateSurgicalConsentForm", "deleteSurgicalConsentForm", "getCardiologyConsultations", "createCardiologyConsultation",
  "updateCardiologyConsultation", "deleteCardiologyConsultation", "getCardiologyFollowupReports", "createCardiologyFollowupReport", "updateCardiologyFollowupReport", "deleteCardiologyFollowupReport", "getCardiologyAdmissionNotes", "createCardiologyAdmissionNote",
  "updateCardiologyAdmissionNote", "deleteCardiologyAdmissionNote", "getEcgReports", "createEcgReport", "updateEcgReport", "deleteEcgReport", "getEchoReports", "createEchoReport",
  "updateEchoReport", "deleteEchoReport", "getCardiacCatheterizationReports", "createCardiacCatheterizationReport", "updateCardiacCatheterizationReport", "deleteCardiacCatheterizationReport", "getStressTestReports", "createStressTestReport",
  "updateStressTestReport", "deleteStressTestReport", "getNeurologyConsultations", "createNeurologyConsultation", "updateNeurologyConsultation", "deleteNeurologyConsultation", "getNeurologyProgressNotes", "createNeurologyProgressNote",
  "updateNeurologyProgressNote", "deleteNeurologyProgressNote", "getEegReports", "createEegReport", "updateEegReport", "deleteEegReport", "getEmgReports", "createEmgReport",
  "updateEmgReport", "deleteEmgReport", "getNeuropsychologicalAssessments", "createNeuropsychologicalAssessment", "updateNeuropsychologicalAssessment", "deleteNeuropsychologicalAssessment", "getPsychiatricEvaluations", "createPsychiatricEvaluation",
  "updatePsychiatricEvaluation", "deletePsychiatricEvaluation", "getPsychiatricProgressNotes", "createPsychiatricProgressNote", "updatePsychiatricProgressNote", "deletePsychiatricProgressNote", "getPsychiatricDischargeSummaries", "createPsychiatricDischargeSummarie",
  "updatePsychiatricDischargeSummarie", "deletePsychiatricDischargeSummarie", "getTherapySessionNotes", "createTherapySessionNote", "updateTherapySessionNote", "deleteTherapySessionNote", "getMentalHealthAssessments", "createMentalHealthAssessment",
  "updateMentalHealthAssessment", "deleteMentalHealthAssessment", "getPediatricVisits", "createPediatricVisit", "updatePediatricVisit", "deletePediatricVisit", "getWellChildExaminations", "createWellChildExamination",
  "updateWellChildExamination", "deleteWellChildExamination", "getPediatricGrowthCharts", "createPediatricGrowthChart", "updatePediatricGrowthChart", "deletePediatricGrowthChart", "getDevelopmentalAssessments", "createDevelopmentalAssessment",
  "updateDevelopmentalAssessment", "deleteDevelopmentalAssessment", "getPediatricVaccinationRecords", "createPediatricVaccinationRecord", "updatePediatricVaccinationRecord", "deletePediatricVaccinationRecord", "getPrenatalVisits", "createPrenatalVisit",
  "updatePrenatalVisit", "deletePrenatalVisit", "getLaborDeliveryRecords", "createLaborDeliveryRecord", "updateLaborDeliveryRecord", "deleteLaborDeliveryRecord", "getPostpartumNotes", "createPostpartumNote",
  "updatePostpartumNote", "deletePostpartumNote", "getGynecologyConsultations", "createGynecologyConsultation", "updateGynecologyConsultation", "deleteGynecologyConsultation", "getMaternalFetalReports", "createMaternalFetalReport",
  "updateMaternalFetalReport", "deleteMaternalFetalReport", "getUltrasoundObReports", "createUltrasoundObReport", "updateUltrasoundObReport", "deleteUltrasoundObReport", "getOncologyConsultations", "createOncologyConsultation",
  "updateOncologyConsultation", "deleteOncologyConsultation", "getOncologyTreatmentPlans", "createOncologyTreatmentPlan", "updateOncologyTreatmentPlan", "deleteOncologyTreatmentPlan", "getChemotherapyRecords", "createChemotherapyRecord",
  "updateChemotherapyRecord", "deleteChemotherapyRecord", "getRadiationTherapyRecords", "createRadiationTherapyRecord", "updateRadiationTherapyRecord", "deleteRadiationTherapyRecord", "getTumorBoardNotes", "createTumorBoardNote",
  "updateTumorBoardNote", "deleteTumorBoardNote", "getOncologyFollowupReports", "createOncologyFollowupReport", "updateOncologyFollowupReport", "deleteOncologyFollowupReport", "getEndocrinologyConsultations", "createEndocrinologyConsultation",
  "updateEndocrinologyConsultation", "deleteEndocrinologyConsultation", "getDiabetesManagementNotes", "createDiabetesManagementNote", "updateDiabetesManagementNote", "deleteDiabetesManagementNote", "getThyroidEvaluations", "createThyroidEvaluation",
  "updateThyroidEvaluation", "deleteThyroidEvaluation", "getHormoneTherapyRecords", "createHormoneTherapyRecord", "updateHormoneTherapyRecord", "deleteHormoneTherapyRecord", "getGastroenterologyConsultations", "createGastroenterologyConsultation",
  "updateGastroenterologyConsultation", "deleteGastroenterologyConsultation", "getEndoscopyReports", "createEndoscopyReport", "updateEndoscopyReport", "deleteEndoscopyReport", "getColonoscopyReports", "createColonoscopyReport",
  "updateColonoscopyReport", "deleteColonoscopyReport", "getLiverFunctionAssessments", "createLiverFunctionAssessment", "updateLiverFunctionAssessment", "deleteLiverFunctionAssessment", "getInflammatoryBowelReports", "createInflammatoryBowelReport",
  "updateInflammatoryBowelReport", "deleteInflammatoryBowelReport", "getPulmonologyConsultations", "createPulmonologyConsultation", "updatePulmonologyConsultation", "deletePulmonologyConsultation", "getPulmonaryFunctionTests", "createPulmonaryFunctionTest",
  "updatePulmonaryFunctionTest", "deletePulmonaryFunctionTest", "getSleepStudyReports", "createSleepStudyReport", "updateSleepStudyReport", "deleteSleepStudyReport", "getAsthmaManagementNotes", "createAsthmaManagementNote",
  "updateAsthmaManagementNote", "deleteAsthmaManagementNote", "getCopdAssessments", "createCopdAssessment", "updateCopdAssessment", "deleteCopdAssessment", "getAsthmaAssessments", "createAsthmaAssessment",
  "updateAsthmaAssessment", "deleteAsthmaAssessment", "getNephrologyConsultations", "createNephrologyConsultation", "updateNephrologyConsultation", "deleteNephrologyConsultation", "getDialysisRecords", "createDialysisRecord",
  "updateDialysisRecord", "deleteDialysisRecord", "getKidneyFunctionReports", "createKidneyFunctionReport", "updateKidneyFunctionReport", "deleteKidneyFunctionReport", "getTransplantEvaluations", "createTransplantEvaluation",
  "updateTransplantEvaluation", "deleteTransplantEvaluation", "getRheumatologyConsultations", "createRheumatologyConsultation", "updateRheumatologyConsultation", "deleteRheumatologyConsultation", "getArthritisAssessments", "createArthritisAssessment",
  "updateArthritisAssessment", "deleteArthritisAssessment", "getAutoimmuneEvaluations", "createAutoimmuneEvaluation", "updateAutoimmuneEvaluation", "deleteAutoimmuneEvaluation", "getHematologyConsultations", "createHematologyConsultation",
  "updateHematologyConsultation", "deleteHematologyConsultation", "getBloodDisorderReports", "createBloodDisorderReport", "updateBloodDisorderReport", "deleteBloodDisorderReport", "getCoagulationStudies", "createCoagulationStudie",
  "updateCoagulationStudie", "deleteCoagulationStudie", "getBoneMarrowReports", "createBoneMarrowReport", "updateBoneMarrowReport", "deleteBoneMarrowReport", "getOrthopedicConsultations", "createOrthopedicConsultation",
  "updateOrthopedicConsultation", "deleteOrthopedicConsultation", "getOrthopedicOperativeReports", "createOrthopedicOperativeReport", "updateOrthopedicOperativeReport", "deleteOrthopedicOperativeReport", "getOrthopedicFollowupNotes", "createOrthopedicFollowupNote",
  "updateOrthopedicFollowupNote", "deleteOrthopedicFollowupNote", "getPhysicalTherapyNotes", "createPhysicalTherapyNote", "updatePhysicalTherapyNote", "deletePhysicalTherapyNote", "getRehabilitationProgressNotes", "createRehabilitationProgressNote",
  "updateRehabilitationProgressNote", "deleteRehabilitationProgressNote", "getOphthalmologyExaminations", "createOphthalmologyExamination", "updateOphthalmologyExamination", "deleteOphthalmologyExamination", "getVisualAcuityReports", "createVisualAcuityReport",
  "updateVisualAcuityReport", "deleteVisualAcuityReport", "getRetinalExaminations", "createRetinalExamination", "updateRetinalExamination", "deleteRetinalExamination", "getGlaucomaAssessments", "createGlaucomaAssessment",
  "updateGlaucomaAssessment", "deleteGlaucomaAssessment", "getEntConsultations", "createEntConsultation", "updateEntConsultation", "deleteEntConsultation", "getAudiometryReports", "createAudiometryReport",
  "updateAudiometryReport", "deleteAudiometryReport", "getLaryngoscopyReports", "createLaryngoscopyReport", "updateLaryngoscopyReport", "deleteLaryngoscopyReport", "getDermatologyConsultations", "createDermatologyConsultation",
  "updateDermatologyConsultation", "deleteDermatologyConsultation", "getSkinBiopsyReports", "createSkinBiopsyReport", "updateSkinBiopsyReport", "deleteSkinBiopsyReport", "getDermatologyProcedureNotes", "createDermatologyProcedureNote",
  "updateDermatologyProcedureNote", "deleteDermatologyProcedureNote", "getUrologyConsultations", "createUrologyConsultation", "updateUrologyConsultation", "deleteUrologyConsultation", "getUrodynamicStudies", "createUrodynamicStudie",
  "updateUrodynamicStudie", "deleteUrodynamicStudie", "getCystoscopyReports", "createCystoscopyReport", "updateCystoscopyReport", "deleteCystoscopyReport", "getGeriatricAssessments", "createGeriatricAssessment",
  "updateGeriatricAssessment", "deleteGeriatricAssessment", "getCognitiveEvaluations", "createCognitiveEvaluation", "updateCognitiveEvaluation", "deleteCognitiveEvaluation", "getFallRiskAssessments", "createFallRiskAssessment",
  "updateFallRiskAssessment", "deleteFallRiskAssessment", "getFallPreventionEducation", "createFallPreventionEducation", "updateFallPreventionEducation", "deleteFallPreventionEducation", "getCognitiveScreening", "createCognitiveScreening", "updateCognitiveScreening", "deleteCognitiveScreening", "getPolypharmacyReviews", "createPolypharmacyReview", "updatePolypharmacyReview", "deletePolypharmacyReview", "getPathologyReports", "createPathologyReport",
  "updatePathologyReport", "deletePathologyReport", "getBiopsyReports", "createBiopsyReport", "updateBiopsyReport", "deleteBiopsyReport", "getCytologyReports", "createCytologyReport",
  "updateCytologyReport", "deleteCytologyReport", "getAutopsyReports", "createAutopsyReport", "updateAutopsyReport", "deleteAutopsyReport", "getRadiologyReports", "createRadiologyReport",
  "updateRadiologyReport", "deleteRadiologyReport", "getInterventionalRadiologyNotes", "createInterventionalRadiologyNote", "updateInterventionalRadiologyNote", "deleteInterventionalRadiologyNote", "getMriReports", "createMriReport",
  "updateMriReport", "deleteMriReport", "getMammographyReports", "createMammographyReport", "updateMammographyReport", "deleteMammographyReport", "getPetScanReports", "createPetScanReport",
  "updatePetScanReport", "deletePetScanReport", "getBoneScanReports", "createBoneScanReport", "updateBoneScanReport", "deleteBoneScanReport", "getDexaScanReports", "createDexaScanReport",
  "updateDexaScanReport", "deleteDexaScanReport", "getProgressNotes", "createProgressNote", "updateProgressNote", "deleteProgressNote", "getNursingNotes", "createNursingNote",
  "updateNursingNote", "deleteNursingNote", "getTherapyProgressNotes", "createTherapyProgressNote", "updateTherapyProgressNote", "deleteTherapyProgressNote", "getMonitoringReports", "createMonitoringReport",
  "updateMonitoringReport", "deleteMonitoringReport", "getVitalSignsLogs", "createVitalSignsLog", "updateVitalSignsLog", "deleteVitalSignsLog", "getVitalSignsTable", "createVitalSignsTable", "updateVitalSignsTable", "deleteVitalSignsTable", "getIcuFlowSheets", "createIcuFlowSheet",
  "updateIcuFlowSheet", "deleteIcuFlowSheet", "getSepsisManagement", "createSepsisManagement", "updateSepsisManagement", "deleteSepsisManagement", "getConcussionAssessment", "createConcussionAssessment", "updateConcussionAssessment", "deleteConcussionAssessment", "getMedicationAdministrationRecords", "createMedicationAdministrationRecord", "updateMedicationAdministrationRecord", "deleteMedicationAdministrationRecord", "getMedicationsAdministered", "createMedicationsAdministered", "updateMedicationsAdministered", "deleteMedicationsAdministered", "getPostDialysisAssessment", "createPostDialysisAssessment", "updatePostDialysisAssessment", "deletePostDialysisAssessment", "getRenalProtectionPlan", "createRenalProtectionPlan", "updateRenalProtectionPlan", "deleteRenalProtectionPlan", "getCurrentDialysis", "createCurrentDialysis", "updateCurrentDialysis", "deleteCurrentDialysis", "getDialysisRunSheets", "createDialysisRunSheet",
  "updateDialysisRunSheet", "deleteDialysisRunSheet", "getBloodGlucoseLogs", "createBloodGlucoseLog", "updateBloodGlucoseLog", "deleteBloodGlucoseLog", "getBloodGlucoseMonitoring", "createBloodGlucoseMonitoring", "updateBloodGlucoseMonitoring", "deleteBloodGlucoseMonitoring", "getIntakeOutputRecords", "createIntakeOutputRecord",
  "updateIntakeOutputRecord", "deleteIntakeOutputRecord", "getWoundCareDocumentation", "createWoundCareDocumentation", "updateWoundCareDocumentation", "deleteWoundCareDocumentation", "getPainAssessmentForms", "createPainAssessmentForm",
  "updatePainAssessmentForm", "deletePainAssessmentForm", "getInsuranceForms", "createInsuranceForm", "updateInsuranceForm", "deleteInsuranceForm", "getDisabilityEvaluations", "createDisabilityEvaluation",
  "updateDisabilityEvaluation", "deleteDisabilityEvaluation", "getWorkersCompEvaluations", "createWorkersCompEvaluation", "updateWorkersCompEvaluation", "deleteWorkersCompEvaluation", "getFitnessForDutyEvaluations", "createFitnessForDutyEvaluation",
  "updateFitnessForDutyEvaluation", "deleteFitnessForDutyEvaluation", "getFlareManagement", "createFlareManagement", "updateFlareManagement", "deleteFlareManagement", "getSchoolHealthForms", "createSchoolHealthForm", "updateSchoolHealthForm", "deleteSchoolHealthForm", "getTravelHealthCertificates", "createTravelHealthCertificate",
  "updateTravelHealthCertificate", "deleteTravelHealthCertificate", "getPriorAuthorizationForms", "createPriorAuthorizationForm", "updatePriorAuthorizationForm", "deletePriorAuthorizationForm", "getMedicalPowerOfAttorney", "createMedicalPowerOfAttorney",
  "updateMedicalPowerOfAttorney", "deleteMedicalPowerOfAttorney", "getDnrOrders", "createDnrOrder", "updateDnrOrder", "deleteDnrOrder", "getGoalsOfCareDiscussions", "createAdvancedDirective",
  "updateAdvancedDirective", "deleteAdvancedDirective", "getTransferSummaries", "createTransferSummarie", "updateTransferSummarie", "deleteTransferSummarie", "getGeneticTestingReports", "createGeneticTestingReport",
  "updateGeneticTestingReport", "deleteGeneticTestingReport", "getTumorMarkerPanels", "createTumorMarkerPanel", "updateTumorMarkerPanel", "deleteTumorMarkerPanel", "getHormonePanels", "createHormonePanel",
  "updateHormonePanel", "deleteHormonePanel", "getAutoimmunePanels", "createAutoimmunePanel", "updateAutoimmunePanel", "deleteAutoimmunePanel", "getToxicologyReports", "createToxicologyReport",
  "updateToxicologyReport", "deleteToxicologyReport", "getMicrobiologyCultureReports", "createMicrobiologyCultureReport", "updateMicrobiologyCultureReport", "deleteMicrobiologyCultureReport", "getAntibiogramReports", "createAntibiogramReport",
  "updateAntibiogramReport", "deleteAntibiogramReport", "getFlowCytometryReports", "createFlowCytometryReport", "updateFlowCytometryReport", "deleteFlowCytometryReport", "getDentalExaminationReports", "createDentalExaminationReport",
  "updateDentalExaminationReport", "deleteDentalExaminationReport", "getPeriodontalCharts", "createPeriodontalChart", "updatePeriodontalChart", "deletePeriodontalChart", "getOrthodonticTreatmentPlans", "createOrthodonticTreatmentPlan",
  "updateOrthodonticTreatmentPlan", "deleteOrthodonticTreatmentPlan", "getOralSurgeryReports", "createOralSurgeryReport", "updateOralSurgeryReport", "deleteOralSurgeryReport", "getPhysicalTherapyEvaluations", "createPhysicalTherapyEvaluation",
  "updatePhysicalTherapyEvaluation", "deletePhysicalTherapyEvaluation", "getOccupationalTherapyReports", "createOccupationalTherapyReport", "updateOccupationalTherapyReport", "deleteOccupationalTherapyReport", "getSpeechTherapyAssessments", "createSpeechTherapyAssessment",
  "updateSpeechTherapyAssessment", "deleteSpeechTherapyAssessment", "getCardiacRehabilitationReports", "createCardiacRehabilitationReport", "updateCardiacRehabilitationReport", "deleteCardiacRehabilitationReport", "getPulmonaryRehabilitationNotes", "createPulmonaryRehabilitationNote",
  "updatePulmonaryRehabilitationNote", "deletePulmonaryRehabilitationNote", "getCognitiveRehabilitationReports", "createCognitiveRehabilitationReport", "updateCognitiveRehabilitationReport", "deleteCognitiveRehabilitationReport", "getSoapNotes", "createSoapNote",
  "updateSoapNote", "deleteSoapNote", "getNursingAssessments", "createNursingAssessment", "updateNursingAssessment", "deleteNursingAssessment", "getAdmissionAssessments", "createAdmissionAssessment",
  "updateAdmissionAssessment", "deleteAdmissionAssessment", "getShiftHandoffNotes", "createShiftHandoffNote", "updateShiftHandoffNote", "deleteShiftHandoffNote", "getEmsRunReports", "createEmsRunReport",
  "updateEmsRunReport", "deleteEmsRunReport", "getTraumaFlowSheets", "createTraumaFlowSheet", "updateTraumaFlowSheet", "deleteTraumaFlowSheet", "getCodeBlueSummaries", "createCodeBlueSummarie",
  "updateCodeBlueSummarie", "deleteCodeBlueSummarie", "getPoisonControlReports", "createPoisonControlReport", "updatePoisonControlReport", "deletePoisonControlReport", "getRapidResponseSummaries", "createRapidResponseSummarie",
  "updateRapidResponseSummarie", "deleteRapidResponseSummarie", "getObstetricUltrasoundReports", "createObstetricUltrasoundReport", "updateObstetricUltrasoundReport", "deleteObstetricUltrasoundReport", "getPrenatalTestingReports", "createPrenatalTestingReport",
  "updatePrenatalTestingReport", "deletePrenatalTestingReport", "getAmniocentesisReports", "createAmniocentesisReport", "updateAmniocentesisReport", "deleteAmniocentesisReport", "getNewbornScreeningResults", "createNewbornScreeningResult",
  "updateNewbornScreeningResult", "deleteNewbornScreeningResult", "getApgarScores", "createApgarScore", "updateApgarScore", "deleteApgarScore", "getNicuProgressNotes", "createNicuProgressNote",
  "updateNicuProgressNote", "deleteNicuProgressNote", "getCaseSummaries", "createCaseSummarie", "updateCaseSummarie", "deleteCaseSummarie", "getSecondOpinionReports", "createSecondOpinionReport",
  "updateSecondOpinionReport", "deleteSecondOpinionReport", "getTelemedicineEncounters", "createTelemedicineEncounter", "updateTelemedicineEncounter", "deleteTelemedicineEncounter", "getHomeHealthNotes", "createHomeHealthNote",
  "updateHomeHealthNote", "deleteHomeHealthNote", "getHospiceNotes", "createHospiceNote", "updateHospiceNote", "deleteHospiceNote", "getWoundCareNotes", "createWoundCareNote",
  "updateWoundCareNote", "deleteWoundCareNote", "getPainManagementNotes", "createPainManagementNote", "updatePainManagementNote", "deletePainManagementNote", "getSocialWorkNotes", "createSocialWorkNote", "updateSocialWorkNote", "deleteSocialWorkNote", "getCareCoordinationNotes", "createCareCoordinationNote",
  "updateCareCoordinationNote", "deleteCareCoordinationNote", "getMedicalReconciliationForms", "createMedicalReconciliationForm", "updateMedicalReconciliationForm", "deleteMedicalReconciliationForm", "getPatientEducationRecords", "createPatientEducationRecord",
  "updatePatientEducationRecord", "deletePatientEducationRecord", "getClinicalTrialDocuments", "createClinicalTrialDocument", "updateClinicalTrialDocument", "deleteClinicalTrialDocument", "getResearchConsentForms", "createResearchConsentForm",
  "updateResearchConsentForm", "deleteResearchConsentForm",
  "getFollowUpAppointments", "createFollowUpAppointment", "updateFollowUpAppointment", "deleteFollowUpAppointment",
  "getCgmData", "createCgmDatum", "updateCgmDatum", "deleteCgmDatum",
  "getGiRiskAssessment", "createGiRiskAssessment", "updateGiRiskAssessment", "deleteGiRiskAssessment", "getAllergyImmunologyAssessment", "createAllergyImmunologyAssessment", "updateAllergyImmunologyAssessment",
  "deleteAllergyImmunologyAssessment", "getChallengeTests", "createChallengeTest", "updateChallengeTest", "deleteChallengeTest", "getOptimizationStats",
  "getImmuneFunctionTests", "createImmuneFunctionTest", "updateImmuneFunctionTest", "deleteImmuneFunctionTest",
  "getAutoantibodyProfile", "createAutoantibodyProfile", "updateAutoantibodyProfile", "deleteAutoantibodyProfile",
  "getSclerodermaAssessment", "createSclerodermaAssessment", "updateSclerodermaAssessment", "deleteSclerodermaAssessment",
  "getSjogrensSyndromeAssessment", "createSjogrensSyndromeAssessment", "updateSjogrensSyndromeAssessment", "deleteSjogrensSyndromeAssessment",
  "getVasculitisAssessment", "createVasculitisAssessment", "updateVasculitisAssessment", "deleteVasculitisAssessment",
  "getGlomerularDisease", "createGlomerularDisease", "updateGlomerularDisease", "deleteGlomerularDisease",
  "getEmergencyAirwayManagement", "createEmergencyAirwayManagement", "updateEmergencyAirwayManagement", "deleteEmergencyAirwayManagement",
  "getImmunizationRecord", "createImmunizationRecord", "updateImmunizationRecord", "deleteImmunizationRecord",
  "getImmunizationSchedule", "createImmunizationSchedule", "updateImmunizationSchedule", "deleteImmunizationSchedule",
  "getTravelVaccinationRecords", "createTravelVaccinationRecord", "updateTravelVaccinationRecord", "deleteTravelVaccinationRecord",
  "getIvInfusions", "createIvInfusion", "updateIvInfusion", "deleteIvInfusion",
  "getImmediateInterventions", "createImmediateIntervention", "updateImmediateIntervention", "deleteImmediateIntervention",
  "getImmediateRecommendations", "createImmediateRecommendation", "updateImmediateRecommendation", "deleteImmediateRecommendation",
  "getPatientEducationContext", "createPatientEducationContext", "updatePatientEducationContext", "deletePatientEducationContext",
  "getMedicalHistory", "createMedicalHistory", "updateMedicalHistory", "deleteMedicalHistory",
  "getFacialTraumaAssessment", "createFacialTraumaAssessment", "updateFacialTraumaAssessment", "deleteFacialTraumaAssessment",
  "getTraumaScoring", "createTraumaScoring", "updateTraumaScoring", "deleteTraumaScoring",
  "getTraumaAssessment", "createTraumaAssessment", "updateTraumaAssessment", "deleteTraumaAssessment",
  "getEmergencyProcedures", "createEmergencyProcedure", "updateEmergencyProcedure", "deleteEmergencyProcedure",
  "getJobHazardAnalysis", "createJobHazardAnalysis", "updateJobHazardAnalysis", "deleteJobHazardAnalysis",
  "startNewPatientVisit", "startVisitRecording", "endVisitRecording", "getPatientVisits",
];

// Non-CRUD platform utilities (payments, scheduling, drug lookups, visits...)
// — the only names worth listing: they don't follow the collection naming
// convention. Everything CRUD is derivable + searchable.
const UTILITY_FUNCTION_NAMES = ALL_FUNCTION_NAMES.filter(n => !/^(get|create|update|delete)[A-Z]/.test(n));

const SYSTEM_PROMPT = `You are an advanced autonomous medical AI assistant with comprehensive access to patient medical records and the ability to take proactive actions.

═══════════════════════════════════════════════════════════════════════════════
🔧 TOOLBOX - 3,600+ TOOLS, ALL DISCOVERABLE VIA TOOL SEARCH
═══════════════════════════════════════════════════════════════════════════════

Pre-loaded: searchPatientsByName. EVERY other tool exists but must be discovered
with tool_search_tool_bm25 before calling it. The searchable registry is the
COMPLETE toolbox — if a capability or medical collection exists, its tool is
findable by search. Never conclude a tool is missing without searching first.

📐 MEDICAL COLLECTION NAMING CONVENTION — every medical collection has exactly
4 CRUD tools named after it (camelCase of the snake_case collection name):
   collection some_collection_name → getSomeCollectionName, createSomeCollectionName (singular),
   updateSomeCollectionName (singular), deleteSomeCollectionName (singular)
   Examples: immunization_record → getImmunizationRecord; iv_infusions → getIvInfusions;
   lab_results → getLabResults; immediate_recommendations → getImmediateRecommendations.

⚠️ EXACT COLLECTION MATCHING: similar-sounding collections are DIFFERENT
(immunization_record ≠ immunization_status ≠ vaccination_records;
blood_glucose_monitoring ≠ blood_glucose_logs). When the user names a record
type, search tool_search_tool_bm25 for THAT exact name and use the exactly
matching tool — never substitute a similar one because it appeared first.

🛠️ Common platform utilities (also searchable): ${UTILITY_FUNCTION_NAMES.join(', ')}

═══════════════════════════════════════════════════════════════════════════════
🔍 TOOL DISCOVERY - USE tool_search_tool_bm25 TO FIND FUNCTIONS
═══════════════════════════════════════════════════════════════════════════════

⚠️ CRITICAL: Most functions are deferred and need to be DISCOVERED before use!

Only searchPatientsByName is immediately available. For ALL other functions:
1. Use tool_search_tool_bm25 to search for the function you need
2. Search with natural language queries:
   - "refund payment" → finds refundPayment
   - "get work restrictions" → finds getWorkRestrictions
   - "get medications" → finds getMedications, getCurrentMedications
   - "process payment" → finds processPayment
   - "capture charge" → finds captureCharge
3. The search will return matching function names
4. THEN call the discovered function

⚠️ IMPORTANT: Use SPECIFIC search queries to get the RIGHT function!
   - User asks "work restrictions" → search "get work restrictions"
   - User asks "medications" → search "get medications"
   - User asks "refund payment" → search "refund payment"
   - AVOID overly broad queries that match too many functions

Example workflow for "show me work restrictions":
1. searchPatientsByName("Patient Name") → get patientId
2. tool_search_tool_bm25("get work restrictions") → discovers getWorkRestrictions
3. getWorkRestrictions(patientId) → get the actual data

Example workflow for "show me medications":
1. searchPatientsByName("Patient Name") → get patientId
2. tool_search_tool_bm25("get medications") → discovers getMedications
3. getMedications(patientId) → get the actual data

DO NOT skip step 2! You MUST discover functions before calling them.

Example workflow for "what are the generic alternatives for Lipitor?":
1. tool_search_tool_bm25("search drug") → discovers searchDrug
2. searchDrug("Lipitor") → get RxCUI code and drug info
3. tool_search_tool_bm25("drug alternatives") → discovers getDrugAlternatives
4. getDrugAlternatives(rxcui, "brand-to-generic") → get generic alternatives from RxNorm

Example workflow for "refund all payments":
1. tool_search_tool_bm25("get payment history") → discovers getPaymentHistory
2. getPaymentHistory(patientId) → get all payments
3. tool_search_tool_bm25("refund payment") → discovers refundPayment
4. refundPayment(paymentId, reason) → ACTUALLY refund each payment via tool call

⚠️ DRUG QUERIES - ALWAYS USE TOOLS: For ANY question about drug names, generics, brand names, drug classes, or drug spelling, you MUST use the searchDrug, getDrugAlternatives, getDrugClass, or normalizeDrugName tools. Do NOT answer drug questions from your own knowledge - always use the RxNorm tools to get authoritative, up-to-date data from the National Library of Medicine. For drug-drug interactions, use the DailyMed label tool getDrugContraindications (the NLM RxNorm interaction API was retired in Jan 2024 and is no longer available).
⚠️ DRUG LABELING / PRESCRIBING INFO - USE DAILYMED TOOLS: For questions about official prescribing information, black box warnings, dosage instructions, contraindications, drug interactions from the label, pregnancy/lactation safety, or pill images, use the DailyMed tools: getDrugPrescribingInfo, getDrugBlackBoxWarning, getDrugDosageInfo, getDrugContraindications, getDrugPregnancyInfo, getDrugImage. These provide official FDA label data from NLM DailyMed.
⚠️ ICD-10 DIAGNOSIS CODES - USE LOCAL DATABASE: For ANY question about ICD-10 codes, diagnosis codes, medical coding, or code validation, use the ICD-10 tools: searchDiagnosisCode, validateDiagnosisCode, suggestDiagnosisCodes, getRelatedDiagnosisCodes. These search 74,706 official 2026 ICD-10-CM codes from CDC/CMS stored locally. Do NOT guess ICD-10 codes from memory - ALWAYS use these tools for authoritative results.
💊 MEDICATION ENTITLEMENT / COVERAGE - USE TOOLS: For ANY question about medication coverage, formulary status, drug tiers, prior authorization, covered alternatives, generic alternatives, or insurance drug coverage, use the medication entitlement tools: checkMedicationEntitlement (comprehensive check combining formulary, insurance, and safety data), findCoveredAlternatives (find lower-cost covered alternatives), getFormularyInfo (direct Medicare Part D formulary lookup). These combine data from local Medicare formulary, RxNorm, DailyMed, and insurance rules. Do NOT guess coverage status - ALWAYS use these tools.

⚠️ BILLING QUERIES - ALWAYS USE TOOLS: For ANY question about charges, invoices, payments, balances, revenue, payment plans, refunds, voids, credits, or billing, you MUST use the billing tools: captureCharge, getPatientCharges, generateInvoice, processPayment, getOutstandingBalances, createPaymentPlan, getRevenueReport, getPaymentHistory, updateCharge, voidCharge, voidInvoice, refundPayment, updatePaymentPlan, cancelPaymentPlan, getPatientCreditBalance, or applyCreditToInvoice. To VOID a charge use voidCharge (not delete). To REFUND a payment use refundPayment. To CANCEL a plan use cancelPaymentPlan. To CHECK credit balance use getPatientCreditBalance.
⚠️ BILLING IDs - NEVER TRUNCATE: When displaying chargeId, invoiceId, paymentId, planId, or refundId values, ALWAYS show the COMPLETE ID string. NEVER truncate or abbreviate IDs with "..." (e.g. NEVER show "2fbf...117306"). When calling voidCharge, updateCharge, refundPayment, or any billing tool that requires an ID, you MUST pass the FULL COMPLETE ID string exactly as returned by getPatientCharges or other billing queries. Truncated IDs will cause "not found" errors.
💰 CREDIT BALANCE: Overpayments are automatically stored as credit. Credits are automatically applied when generateInvoice is called (check the creditApplied field in the response). If a patient asks about credit and has no outstanding invoices, tell them: "Your credit is on file and will be automatically applied to your next invoice." The backend enforces all billing rules — duplicate charges, duplicate invoices, duplicate payments, and duplicate credit applications are all rejected automatically.

🚫 ANTI-HALLUCINATION - NEVER FABRICATE RESULTS: You MUST actually call tools to perform actions. NEVER generate fake tool results, fabricated IDs, or simulated responses. If the user asks to process a payment, refund, void, or any write operation, you MUST call the actual tool function - do NOT respond with fabricated results based on conversation context. If you cannot find or call the required tool, tell the user you could not execute the action. Every action (payment, refund, void, charge, invoice) MUST go through an actual tool call.

═══════════════════════════════════════════════════════════════════════════════
👥 USER ROLES & PERMISSIONS
═══════════════════════════════════════════════════════════════════════════════

The practice has EXACTLY 4 roles:
- Admin — manages the practice, users and all data.
- Doctor — full clinical access; schedulable (can have a calendar/appointments).
- Nurse — clinical documentation; schedulable (can have a calendar/appointments).
- User — basic: view patients and book appointments.

New people join as 'User' by default with read-only access. To upgrade someone,
an ADMIN assigns a role (assignRole), or the user requests one from an admin
(requestPermission with a requestedRole). "Schedulable provider" is NOT a role —
it just means a Doctor or Nurse with scheduling enabled (setupUserAsDoctor).

NEVER offer or mention the legacy roles 'provider' or 'staff' (or medical_director,
doctor_specialist, nurse_rn, nurse_lpn, billing, lab_tech, receptionist, technician)
— they do not exist. Only admin, doctor, nurse and user are valid.

When a tool is denied for lack of permission, don't just refuse — offer to send a
permission/role request to the admin on the user's behalf (requestPermission).

🏥 PATIENT VISIT CREATION WORKFLOW:
When the doctor says "start new visit", "new patient visit", "create visit", "manual visit", "document visit", or "start visit":
1. searchPatientsByName("Patient Name") → get patientId
2. startNewPatientVisit(patientId, visitType) → creates empty visit + opens artifact panel in compose mode
   - The artifact panel will open automatically with a text area for the doctor to type visit notes
   - After typing, doctor clicks "Save & Process with AI" and the notes are structured into SOAP fields
   - Do NOT call getVitalSigns, getMedications, getDiagnoses — just create the visit!
   - visitType: "in-person" (default), "telehealth", or "phone"

When the doctor says "record visit", "start recording", or "voice recording":
1. searchPatientsByName("Patient Name") → get patientId
2. startVisitRecording(patientId, visitType, consentMethod) → starts audio recording
   - This activates the microphone button for voice recording

⚠️ SINGLE FUNCTION RULE: When user asks for ONE specific data type, call ONLY ONE function!
   - "show work restrictions" → call ONLY getWorkRestrictions (not 4 related functions)
   - "show medications" → call ONLY getMedications (not prescriptions + drugs + etc)

═══════════════════════════════════════════════════════════════════════════════
📋 CRITICAL WORKFLOW - READ THIS CAREFULLY
═══════════════════════════════════════════════════════════════════════════════

STEP 1: FIND THE PATIENT
   ⚠️ ALWAYS start with: searchPatientsByName(name)
   - This returns the patientId (MongoDB ObjectId)
   - NEVER use hardcoded IDs or guess IDs
   - Example: searchPatientsByName("Helen Cox") → returns patientId

STEP 2: IMMEDIATELY CALL THE REQUESTED DATA FUNCTION
   ⚠️ CRITICAL: After finding the patient, you MUST IMMEDIATELY call the function to retrieve what the user asked for!

   DO NOT STOP after searchPatientsByName - you must ALWAYS make a second call!

   User says "show me Russell Hall's medications" → You must call:
     1. searchPatientsByName("Russell Hall") → get patientId
     2. getMedications(patientId) → get the actual medications ← DON'T SKIP THIS!

   User says "get Helen Cox lab results" → You must call:
     1. searchPatientsByName("Helen Cox") → get patientId
     2. getLabResults(patientId) → get the actual lab results ← DON'T SKIP THIS!

   AVAILABLE DATA FUNCTIONS (use the correct one based on user's request):
     * getMedications(patientId) - for medications, prescriptions, drugs
     * getLabResults(patientId) - for labs, blood tests, lab results
     * getVitalSigns(patientId) - for vitals, blood pressure, heart rate
     * getAllergies(patientId) - for allergies, reactions
     * getDiagnoses(patientId) - for diagnoses, conditions
     * getAppointments(patientId) - for appointments, visits
     * getPulmonaryFunctionTests(patientId) - for lung function, spirometry
     * getAsthmaAssessments(patientId) - for asthma evaluations

   ❌ WRONG: Only calling searchPatientsByName and stopping
   ✅ RIGHT: Calling searchPatientsByName THEN calling the data function

STEP 3: DOCUMENT UPLOAD & ANALYSIS
   ⚠️ When user uploads a document and says "analyze", "process", or "extract data":

   CRITICAL: The uploadId is available in the conversation context!
   - Look in the previous messages for uploadId (format: upload_TIMESTAMP_ID)
   - Call: analyzeUploadedDocuments(uploadId, patientId)
   - This will extract ALL medical data from the document using Claude Batch API
   - DO NOT ask the user for uploadId - it's already in the context!

   Example:
   User uploads file → System stores as upload_1760882228743_nl4ohin9i
   User says "Analyze this document"
   You call: analyzeUploadedDocuments("upload_1760882228743_nl4ohin9i")

   🔄 CSV IMPORT DETECTION - AUTOMATIC ROUTING:
   When uploadContext contains csvType field, IMMEDIATELY call the appropriate import function:

   - If csvType === 'patients': Call importPatientsFromCSV(uploadId)
   - If csvType === 'users': Call importUsersFromCSV(uploadId)
   - If csvType === 'error': Show the csvError message to user

   CRITICAL: Do NOT wait for user to say "import" or "process"
   - CSV import should happen AUTOMATICALLY when CSV file is detected
   - The uploadId is in uploadContext.uploadId
   - Just acknowledge the upload and call the import function immediately

   Example:
   User uploads patients.csv → System detects csvType: 'patients'
   You IMMEDIATELY call: importPatientsFromCSV(uploadId)
   Then inform user: "Importing 50 patients from CSV file..."

STEP 4: BE PROACTIVE
   - After answering user's question, explore related data
   - Cross-reference between collections
   - Identify gaps in care
   - Suggest actions

═══════════════════════════════════════════════════════════════════════════════
🎯 MOST USEFUL FUNCTIONS (use these frequently)
═══════════════════════════════════════════════════════════════════════════════

PATIENT SEARCH:
- searchPatientsByName(name) ← START HERE!
- getPatientDetails(patientId)

DISCOVER WHAT DATA EXISTS:
- getCollectionsWithData(patientId) ← Shows ALL available data categories — when asked to "show medical data", LIST EVERY collection it returns (see EXCEPTION under ULTRA-CONCISE below)

MEDICATIONS & PRESCRIPTIONS:
- getMedications(patientId)
- getPrescriptions(patientId)
- createPrescriptions(patientId, ...)
- checkDrugInteractions(medications)

CLINICAL DATA:
- getLabResults(patientId)
- getVitalSigns(patientId)
- getImagingReports(patientId)
- getPulmonaryFunctionTests(patientId)
- getImmuneFunctionTests(patientId)

ASSESSMENTS:
- getAsthmaAssessments(patientId)
- getAllergiesAssessments(patientId)
- getAllergyImmunologyAssessment(patientId)

APPOINTMENTS & FOLLOW-UP:
- getAppointments(patientId)
- createAppointment(patientId, ...)
- getReferrals(patientId)

═══════════════════════════════════════════════════════════════════════════════
⚡ CRITICAL: ULTRA-CONCISE RESPONSES + SMART OFFERINGS
═══════════════════════════════════════════════════════════════════════════════

NOBODY READS LONG RESPONSES. KEEP IT SHORT.

**REQUIRED FORMAT:**

[Brief clinical context: 1-2 sentences highlighting KEY FINDINGS with clinical significance]

**I CAN:** 2-4 contextual actions (one line each)

⚠️ EXCEPTION — "Show me [patient] medical data" / "what data do we have" / "what data exists":
When you call getCollectionsWithData, you MUST display the FULL list of EVERY
collection it returns (the entire collections array it gives back — every single
one, e.g. all 42). This is the ONE case where a longer response is required and
expected: do NOT curate, sample, truncate, summarize-away, or drop any
collection. Grouping the collections under clinical-area headings for readability
is encouraged, but EVERY collection MUST appear, shown as a readable Title Case
label (wound_care_assessments -> "Wound Care Assessments"). State the total count
("42 data categories"). Then put your **I CAN:** offerings BELOW the complete list.

═══════════════════════════════════════════════════════════════════════════════
🧠 SMART OFFERING INTELLIGENCE - ANALYZE DATA, OFFER RELEVANT ACTIONS
═══════════════════════════════════════════════════════════════════════════════

Your "I CAN" offerings MUST be driven by what you FOUND in the data. Analyze the data and offer actions that directly address the findings:

🔴 CRITICAL/URGENT FINDINGS → Offer urgent interventions:
   • Suicidal ideation present → "🚨 Review safety plan", "Schedule urgent psych consult"
   • Critical lab values (K+ <3.0, Na+ <125, glucose <50) → "Order stat labs", "Alert doctor"
   • Uncontrolled vitals (BP >180/120, HR >150) → "Initiate urgent protocol", "Adjust medications now"
   • Severe pain scores (>8/10) → "Escalate pain management", "Review current analgesics"

💊 TREATMENT GAPS (diagnosis without treatment) → Offer prescriptions:
   • Depression screening positive + no antidepressants → "Prescribe SSRI (consider comorbidities)"
   • Diabetes diagnosis + elevated A1C + no meds → "Start metformin", "Refer to endocrine"
   • Hypertension + no BP meds → "Prescribe antihypertensive"
   • Infection confirmed + no antibiotics → "Prescribe appropriate antibiotic"

📊 ABNORMAL RESULTS → Offer follow-up actions:
   • Lab values out of range → "Order follow-up labs in X weeks"
   • Imaging showing abnormality → "Schedule specialist consult", "Order additional imaging"
   • Screening scores elevated → "Schedule comprehensive evaluation"

📅 CARE COORDINATION → Offer scheduling/referrals:
   • New or complex diagnosis → "Refer to [appropriate specialist]"
   • Chronic condition unstable → "Schedule follow-up in 1-2 weeks"
   • Multiple issues identified → "Create comprehensive care plan"
   • Preventive care gaps → "Schedule screening", "Order preventive labs"

🔍 DATA NOTED BUT ACTION NEEDED → Offer documentation/updates:
   • Comorbidities mentioned but not in problem list → "Update diagnoses"
   • Medications mentioned but not in current meds → "Reconcile medications"
   • New symptoms reported → "Document in progress notes", "Add to problem list"

═══════════════════════════════════════════════════════════════════════════════
📋 EXAMPLES BY MEDICAL DATA TYPE
═══════════════════════════════════════════════════════════════════════════════

DEPRESSION SCREENING (PHQ-9 high + suicidal ideation + no meds):
"🚨 PHQ-9: 16 (moderately severe), suicidal ideation PRESENT, no antidepressants prescribed.

**I CAN:** 🚨 Create safety plan, Prescribe SSRI, Schedule urgent psych follow-up, Document risk assessment"

LAB RESULTS (A1C elevated, renal function declining):
"A1C 9.2% (uncontrolled diabetes), eGFR dropped to 45 (stage 3b CKD).

**I CAN:** Adjust diabetes medications, Refer to nephrology, Order urine albumin, Schedule 4-week recheck"

VITAL SIGNS (critically elevated BP):
"BP 185/110 (hypertensive urgency), HR 98, current on lisinopril 10mg only.

**I CAN:** Increase lisinopril to 20mg, Add amlodipine 5mg, Order renal function panel, Schedule 1-week BP check"

MEDICATION REVIEW (polypharmacy with interactions):
"On 12 medications, 2 drug interactions detected (warfarin + aspirin, metformin + contrast).

**I CAN:** Review drug interactions, Optimize medication list, Create medication safety alert, Schedule pharmacist consult"

ALLERGIES (new severe reaction documented):
"New anaphylaxis to penicillin documented, currently on amoxicillin prescription.

**I CAN:** 🚨 Discontinue amoxicillin IMMEDIATELY, Update allergy list, Prescribe alternative antibiotic, Add allergy alert"

═══════════════════════════════════════════════════════════════════════════════
⚠️ OFFERING RULES
═══════════════════════════════════════════════════════════════════════════════

1. PRIORITIZE by urgency: 🚨 Critical findings first, then treatment gaps, then routine
2. BE SPECIFIC: "Prescribe lisinopril 10mg" not just "Prescribe medication"
3. MATCH the data: If no treatment gap exists, don't offer prescriptions
4. USE EMOJIS for urgency: 🚨 for critical, 💊 for medications, 📅 for scheduling
5. LIMIT to 2-4 actions: Quality over quantity
6. NEVER offer generic actions that don't relate to the data you found

═══════════════════════════════════════════════════════════════════════════════

ALWAYS use searchPatientsByName first!`;

module.exports = {
  SYSTEM_PROMPT,
  ALL_FUNCTION_NAMES
};
