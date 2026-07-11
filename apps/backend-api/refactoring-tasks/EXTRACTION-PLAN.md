# 🔄 AgentServiceV4 Extraction Plan

**Generated:** October 2025
**Total Functions:** 580 unique (624 case statements including duplicates)

---

## 📊 Function Categorization Summary

Based on automated analysis of agentServiceV4.js:

### ✅ High Priority Services (Core Business Logic)

#### 1. **patientService.js** - 61 functions
**Priority:** HIGH - Most commonly used
**Estimated Lines:** ~3,355 (61 × 55 avg)

**Functions:**
- Patient CRUD: `addPatient`, `updatePatient`, `deletePatientBySearch`, `findPatient`, `listAllPatients`, `getPatientDetails`, `searchPatients`, `searchPatientsByName`, `getPatientsList`
- Medical History: `addMedicalHistory`, `getMedicalHistory`, `updateMedicalHistory`, `deleteMedicalHistory`
- Conditions: `addPatientCondition`, `updatePatientCondition`, `getPatientConditions`, `getConditionStatistics`
- Follow-up: `getPatientsNeedingFollowUp`, `getPatientFollowUpDetails`, `scheduleFollowUp`, `updateFollowUpStatus`, `deleteFollowUp`, `getPatientsForFollowUp`
- Reports: `generatePatientReport`, `generatePatientFlowChart`, `cardiology_followup_reports`, `oncology_followup_reports`
- Analytics: `analyzePatientFlow`, `analyzePatientOutcomes`, `forecastPatientVolume`, `identifyHighRiskPatients`, `predictPatientOutcome`, `getPatientEngagementInsights`, `monitorPatientDeteriorationRisk`
- Data Management: `importPatientsFromCSV`, `batchUpdatePatients`, `anonymizePatientData`, `getDeletedPatients`, `permanentlyDeletePatient`, `restorePatient`
- Medicare: `checkMedicareCoverage`, `checkMedicareImportStatus`, `getMedicareQualityRatings`, `lookupPatientBySSN`, `searchMedicareProviders`, `startMedicareImport`
- Communication: `sendBulkPatientEmail`, `sendBulkPatientSMS`, `sendPatientPortalMessage`, `getPatientMessageHistory`, `reportPatientSymptoms`
- Clinical Matching: `matchPatientToSpecialist`, `matchPatientToTrials`
- Consent: `getPatientConsents`
- Document Assignment: `assignDocumentToPatient`
- Education: `generatePatientEducation`
- Scheduling: `schedulePatientAppointment`
- Allergy Check: `checkPatientsForAllergies`
- Medical Data: `getMedicalDataByCategory`, `getAIInsights`

**Collections Used:**
- `patients`, `deleted_patients`
- Medical data collections (via medicalDataService)
- `patient_consents`, `patient_messages`
- Medicare-related collections

---

#### 2. **appointmentService.js** - 23 functions
**Priority:** HIGH - Critical for scheduling
**Estimated Lines:** ~1,265 (23 × 55 avg)

**Functions:**
- Core Scheduling: `scheduleAppointment`, `rescheduleAppointment`, `cancelAppointment`, `updateAppointment`, `createAppointment`
- Slot Management: `findAvailableSlots`
- Retrieval: `getAppointments`, `getTodayAppointments`, `getOverdueAppointments`, `getProviderAppointments`
- Follow-up: `follow_up_appointments`
- Vaccination: `generateVaccinationSchedule`
- Predictive: `predictAppointmentNoShows`
- Confirmations: `sendAppointmentConfirmationRequest`
- System Scheduling: `scheduleBackup`, `scheduleComplianceAudit`, `scheduleComplianceReports`, `scheduleDataRetention`, `scheduleProviderMeeting`, `scheduleReminder`, `scheduleTraining`

**Collections Used:**
- `appointments`, `follow_up_appointments`
- Provider schedules
- Backup/compliance schedules

---

#### 3. **documentService.js** - 15 functions
**Priority:** HIGH - Core document workflow
**Estimated Lines:** ~825 (15 × 55 avg)

**Functions:**
- Upload & Processing: `processUploadedDocuments`, `uploadImagingResult`, `retrievePendingUpload`, `analyzePendingDocument`
- Batch Processing: `batchAnalyzeDocuments`
- Retrieval: `getDocuments`, `searchDocuments`
- Categorization: `categorizeDocument`
- Deletion: `deleteDocument`
- Security: `shareEncryptedDocument`
- Documentation: `generateDocumentation`, `validateDocumentation`

**Collections Used:**
- `documents`, `pending_uploads`
- Medical data collections (via documentAnalysisService)

---

#### 4. **medicationService.js** - 12 functions
**Priority:** HIGH - Patient safety critical
**Estimated Lines:** ~660 (12 × 55 avg)

**Functions:**
- CRUD: `addMedication`, `getMedications`
- Safety: `checkDrugInteractions`, `checkDrugAllergy`, `checkDrugSafety`, `checkDrugAdverseEvents`
- Dosing: `calculateMedicationDosing`
- Research: `searchDrugInformation`, `searchFDADrugs`
- Reminders: `sendMedicationRefillReminders`
- Analytics: `identifyMedicationEffectivenessTrends`

**Collections Used:**
- `medications`
- Drug interaction databases
- FDA API integration

---

#### 5. **labService.js** - 23 functions
**Priority:** MEDIUM
**Estimated Lines:** ~1,265 (23 × 55 avg)

**Functions:**
- Lab Results: `addLabResult`, `getLabResults`, `interpretLabResults`, `parseLabResults`, `orderLabTest`
- Imaging: `addImagingResult`, `getImagingResults`, `orderImaging`, `uploadImagingResult`
- Vital Signs: `addVitalSigns`, `getVitalSigns`, `recordVitalSigns`, `updateVitalSigns`, `setVitalAlerts`, `analyzeVitalTrends`
- Vaccinations: `addVaccination`, `getVaccinations`
- Provider Availability: `getProviderAvailability`, `setProviderAvailability`
- Reports: `imaging_reports`, `lab_results`, `vaccination_records`, `vital_signs`, `vital_signs_table`
- Research: `findResearchCollaborators`
- Management: `lab_manager`

**Collections Used:**
- `lab_results`, `imaging_reports`, `vital_signs`, `vaccination_records`

---

#### 6. **prescriptionService.js** - 9 functions
**Priority:** HIGH - Legal/clinical critical
**Estimated Lines:** ~495 (9 × 55 avg)

**Functions:**
- Create: `createPrescription`, `generatePrescription`, `prescribeMedication`
- Retrieve: `getPrescriptions`
- Refill: `refillPrescription`, `requestPrescriptionRefill`
- Cancel: `cancelPrescription`
- Validation: `validatePrescription`

**Collections Used:**
- `prescriptions`

---

#### 7. **providerService.js** - 17 functions
**Priority:** MEDIUM
**Estimated Lines:** ~935 (17 × 55 avg)

**Functions:**
- Licensing: `addProviderLicense`, `updateProviderLicense`, `removeProviderLicense`, `getProviderLicense`, `checkProviderStatus`
- Directory: `getProviders`, `searchProviders`, `getProviderByNPI`, `getProviderSpecialties`
- Setup: `setupUserAsProvider`, `setupMultipleProviders`
- Scheduling: `blockProviderTime`
- Communication: `sendProviderMessage`, `getProviderMeetings`
- Settings: `updateProviderSettings`
- Network: `addSpecialistToNetwork`

**Collections Used:**
- `providers`, `provider_licenses`, `provider_specialties`

---

#### 8. **userService.js** - 20 functions
**Priority:** HIGH - Auth/permissions critical
**Estimated Lines:** ~1,100 (20 × 55 avg)

**Functions:**
- User CRUD: `createUser`, `deleteUser`, `getUserDetails`, `getAllUsers`, `searchUsers`
- Role Management: `addUserRole`, `removeUserRole`, `assignRole`, `bulkUpdateRoles`, `getRoles`
- Permissions: `getUserPermissions`, `updateUserPermissions`
- Status: `deactivateUser`, `reactivateUser`, `suspendUser`
- Profile: `updateUserProfile`
- Password: `resetUserPassword`
- Activity: `getUserActivity`
- Email: `resendEmailVerification`
- Import: `importUsersFromCSV`

**Collections Used:**
- `users`, `roles`, `permissions`

---

#### 9. **insuranceService.js** - 8 functions (ENHANCE EXISTING)
**Priority:** MEDIUM
**Estimated Lines:** ~440 (8 × 55 avg)

**Functions to ADD to existing insuranceService.js:**
- Verification: `verifyInsurance`, `checkCoverage`, `verifyInsuranceNetwork`
- Claims: `submitInsuranceClaim`
- Formulary: `checkFormularyCoverage`
- Plans: `searchHealthInsurancePlans`
- Details: `getInsuranceDetails`, `updateInsurance`

---

#### 10. **clinicService.js** - 18 functions
**Priority:** MEDIUM
**Estimated Lines:** ~990 (18 × 55 avg)

**Functions:**
- Clinic CRUD: `createClinic`, `updateClinic`, `getAllClinics`, `getClinicInfo`, `updateClinicSettings`
- Discovery: `discoverPractice`
- Statistics: `getClinicStatistics`, `getClinicUsage`
- Reports: `generateClinicReport`
- Permissions: `getClinicPermissions`
- Security: `rotateClinicToken`, `validateClinicToken`
- Clinical: `lookupClinicalGuidelines`, `searchClinicalTrials`, `generateClinicalInsights`, `createClinicalTrendChart`, `predictClinicalDeterioration`
- Address: `getClinicAddress`

**Collections Used:**
- `practices`, `clinics`, `clinic_settings`

---

### 📊 Medium Priority Services (Reporting & Analytics)

#### 11. **reportService.js** - 32 functions (ENHANCE EXISTING)
**Priority:** MEDIUM
**Estimated Lines:** ~1,760 (32 × 55 avg)

**Functions to ADD to existing reportGenerator.js:**
- Medical Reports: `emergency_reports`, `mri_reports`, `operative_reports`, `orthopedic_operative_reports`, `pathology_reports`, `radiology_reports`, `cardiology_followup_reports`, `oncology_followup_reports`
- Compliance: `generateComplianceReport`, `generateComplianceReportDetailed`, `generateAuditReport`, `exportAuditReport`, `exportAuditLogs`, `exportAuditData`
- Security: `generateBreachReport`, `generateIncidentReport`, `generateRiskReport`, `getThreatReport`
- Communication: `generateCommunicationReport`, `getCommunicationAnalytics`, `getCampaignAnalytics`
- Analytics: `exportAnalytics`, `processAnalyticsQuery`, `rememberAnalyticsPreference`, `resolveAnalyticsReference`, `storeAnalyticsContext`, `exportChart`, `getChatAnalytics`
- Training: `generateTrainingReport`
- Referral: `generateReferralAnalytics`
- Export: `exportAnonymizedData`, `exportChatHistory`
- Incident: `reportBreach`, `reportIncident`

---

#### 12. **predictiveService.js** - 18 functions (ENHANCE EXISTING)
**Priority:** MEDIUM
**Estimated Lines:** ~990 (18 × 55 avg)

**Functions to ADD to existing predictiveAnalyticsAIService.js:**
- Clinical: `predictDiseaseProgression`, `predictTreatmentResponse`, `predictTreatmentSideEffects`, `predictReadmissionRisk`, `predictClinicalDeterioration`
- Operations: `forecastDemand`, `forecastResourceUtilization`, `forecastEquipmentFailure`, `predictStaffNeeds`, `predictStaffTurnover`
- Risk: `performRiskAssessment`, `assessBreachRisk`, `assessVendorRisk`
- Financial: `forecastCosts`, `forecastRevenue`, `predictROI`
- Population: `forecastOutbreakRisk`
- Patient: `predictAppointmentNoShows`, `identifyHighRiskPatients`, `monitorPatientDeteriorationRisk`
- Models: `buildPredictiveModel`
- Risk Factors: `risk_factors`

---

### 🔒 Low Priority Services (Security & Compliance)

#### 13. **complianceService.js** - 7 functions (ENHANCE EXISTING)
**Priority:** LOW - Already have good services
**Estimated Lines:** ~385 (7 × 55 avg)

**Functions to ADD to existing complianceReportingService.js:**
- Audit: `getAuditLogs`, `auditVendor`
- Compliance: `checkRegulatoryCompliance`, `getComplianceStatus`, `getPolicyCompliance`, `calculateComplianceScore`
- Vendor: `getVendorCompliance`

---

#### 14. **securityService.js** - 16 functions (ENHANCE EXISTING)
**Priority:** LOW - Already have robust security
**Estimated Lines:** ~880 (16 × 55 avg)

**Functions to ADD to existing securityAuditService.js:**
- Events: `getSecurityEvents`, `getRecentSecurityEvents`, `getSecurityEventTypes`, `emitSecurityEvent`
- Alerts: `getSecurityAlerts`, `acknowledgeSecurityAlert`
- Metrics: `getSecurityMetrics`, `getDetailedSecurityMetrics`, `getSecurityDashboard`, `getThreatLevel`
- Encryption: `encryptData`, `getEncryptionKeys`, `rotateEncryptionKeys`
- Headers: `getSecurityHeaders`, `updateSecurityHeader`, `updateSecurityThresholds`

---

#### 15. **communicationService.js** - 4 functions
**Priority:** LOW - Use existing services
**Estimated Lines:** ~220 (4 × 55 avg)

**Functions (Orchestration only - delegate to existing services):**
- Email: `sendEmail` → emailService (EXTERNAL: SendGrid)
- SMS: `sendSMS` → smsService (EXTERNAL: Twilio)
- Chat: `sendChatMessage` → webSocketService
- Notifications: `sendTestResultNotifications` → bulkCommunicationService

**Note:** Keep external API calls! This service is just orchestration.

---

## 🗂️ "OTHER" Category Analysis (297 functions)

These are **medical data collections and specialized functions** that should NOT be extracted:

### Medical Data Collections (Auto-generated by medicalCollectionsService):
- Already handled by `medicalDataService` + `medicalCollectionsService`
- 245+ collections: `allergies`, `medications`, `lab_results`, `vital_signs`, `diagnoses`, `procedures`, etc.
- Generated via `createMedicalDataRoute()` in routeFactory
- **Action:** Keep in agentServiceV4 or delegate to medicalDataService

### Specialty Medical Records (35+ specialties):
- `cardiology_consultations`, `neurology_consultations`, `oncology_consultations`, etc.
- Already managed by specialty field mapping services
- **Action:** Delegate to respective specialty services

### Infrastructure Functions:
- Cache: `clearCache`, `warmupCache`, `getCacheStatistics`
- Database: `analyzeDatabase`, `optimizeDatabase`, `rebuildIndexes`
- Backup: `createBackup`, `restoreBackup`, `listBackups`
- Health: `getSystemHealth`, `getServerHealth`, `getServiceMap`
- **Action:** Keep in agentServiceV4 or move to infrastructure services

### Clinical Intelligence Functions:
- Diagnosis: `analyzeSymptoms`, `getDifferentialDiagnosis`, `recommendTests`, `recommendTreatment`
- Already have `medicalIntelligence.js` service
- **Action:** Move to medicalIntelligence service

### External API Functions:
- FDA: `searchFDADrugs`, `getFDARecalls`, `getFDASafetyAlerts`, `getFDAEstablishments`
- NIH: `searchNIHGrants`, `searchNIHProjects`, `searchNCBIDatasets`
- CDC: `getCDCDiseaseData`, `getCDCHealthGuidelines`
- Genomics: `getCancerGenomics`, `getPharmacogenomics`, `getGeneticVariantInfo`
- **Action:** Create new `externalAPIService.js` or keep in agentServiceV4

---

## ✅ Implementation Priority

### **Phase 1: Core Business Logic (Weeks 1-2)**
1. ✅ patientService.js (61 functions) - **START HERE**
2. ✅ appointmentService.js (23 functions)
3. ✅ documentService.js (15 functions)
4. ✅ prescriptionService.js (9 functions)

**Impact:** 108 functions extracted, ~50% of core operations

### **Phase 2: Clinical Operations (Weeks 3-4)**
5. ✅ medicationService.js (12 functions)
6. ✅ labService.js (23 functions)
7. ✅ userService.js (20 functions)
8. ✅ providerService.js (17 functions)

**Impact:** 72 functions extracted, most clinical workflows covered

### **Phase 3: Business Operations (Week 5)**
9. ✅ insuranceService.js (8 functions - enhance existing)
10. ✅ clinicService.js (18 functions)

**Impact:** 26 functions extracted, business operations complete

### **Phase 4: Reporting & Analytics (Week 6)**
11. ✅ reportService.js (32 functions - enhance existing)
12. ✅ predictiveService.js (18 functions - enhance existing)

**Impact:** 50 functions extracted, analytics complete

### **Phase 5: Security & Compliance (Week 7)**
13. ✅ complianceService.js (7 functions - enhance existing)
14. ✅ securityService.js (16 functions - enhance existing)
15. ✅ communicationService.js (4 functions - orchestration)

**Impact:** 27 functions extracted, infrastructure complete

### **Phase 6: Cleanup (Week 8)**
- Handle "OTHER" category (297 functions):
  - Medical collections → medicalDataService
  - Clinical intelligence → medicalIntelligence
  - External APIs → externalAPIService or keep in agent
  - Infrastructure → respective services or keep in agent

---

## 📈 Expected Transformation

### Before:
```
agentServiceV4.js: 43,811 lines
  - 624 case statements
  - Everything mixed together
  - Hard to maintain
```

### After:
```
agentServiceV4.js: ~12,000 lines (orchestrator)
  - AI coordination
  - Session management
  - Function registry
  - Medical collections delegation

services/
  - patientService.js: ~3,355 lines (61 functions)
  - appointmentService.js: ~1,265 lines (23 functions)
  - documentService.js: ~825 lines (15 functions)
  - prescriptionService.js: ~495 lines (9 functions)
  - medicationService.js: ~660 lines (12 functions)
  - labService.js: ~1,265 lines (23 functions)
  - userService.js: ~1,100 lines (20 functions)
  - providerService.js: ~935 lines (17 functions)
  - clinicService.js: ~990 lines (18 functions)
  - communicationService.js: ~220 lines (4 functions)

Enhanced existing services:
  - insuranceService.js: +440 lines (8 functions)
  - reportService.js: +1,760 lines (32 functions)
  - predictiveService.js: +990 lines (18 functions)
  - complianceService.js: +385 lines (7 functions)
  - securityService.js: +880 lines (16 functions)

Total: ~14,525 lines extracted into services
Remaining in agent: ~12,000 lines orchestration
```

---

## 🚀 Next Step: Start with patientService.js

This is the largest and most commonly used service. Successful extraction here will serve as the template for all other services.
