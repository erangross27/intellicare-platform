# Wiring Fix Map - 89 Broken Routes

**Problem:** Switch statement has 89 cases calling `this.functionName()` but functions were moved to services.

---

## Mapping: Function → Service

### Patient Service (0 broken - already fixed!)
All patient functions already route to `patientService.*`

### Appointment Service (7 broken)
- `scheduleAppointment` → `appointmentService.scheduleAppointment`
- `updateAppointment` → `appointmentService.updateAppointment`
- `rescheduleAppointment` → `appointmentService.rescheduleAppointment`
- `cancelAppointment` → `appointmentService.cancelAppointment`
- `findAvailableSlots` → `appointmentService.findAvailableSlots`
- `scheduleProviderMeeting` → `appointmentService.scheduleProviderMeeting`
- `getProviderMeetings` → `appointmentService.getProviderMeetings`

### Document Service (10 broken)
- `getDocuments` → `documentService.getDocuments`
- `batchAnalyzeDocuments` → `documentService.batchAnalyzeDocuments`
- `processUploadedDocuments` → `documentService.processUploadedDocuments`
- `assignDocumentToPatient` → `documentService.assignDocumentToPatient`
- `deleteDocument` → `documentService.deleteDocument`
- `searchDocuments` → `documentService.searchDocuments`
- `retrievePendingUpload` → `documentService.retrievePendingUpload`
- `analyzePendingDocument` → `documentService.analyzePendingDocument`
- `listPatientMedicalCategories` → `documentService.listPatientMedicalCategories`
- `openArtifactPanelWithCategory` → `documentService.openArtifactPanelWithCategory`

### Medication Service (5 broken)
- `addMedication` → `medicationService.addMedication`
- `getMedications` → `medicationService.getMedications`
- `sendMedicationRefillReminders` → `medicationService.sendMedicationRefillReminders`
- `checkDrugAllergy` → `medicationService.checkDrugAllergy`
- `checkDrugInteractions` → `medicationService.checkDrugInteractions`

### Prescription Service (2 broken)
- `createPrescription` → `prescriptionService.createPrescription`
- `getPrescriptions` → `prescriptionService.getPrescriptions`

### Lab Service (5 broken)
- `addLabResult` → `labService.addLabResult`
- `getLabResults` → `labService.getLabResults`
- `addImagingResult` → `labService.addImagingResult`
- `getImagingResults` → `labService.getImagingResults`
- `sendTestResultNotifications` → `labService.sendTestResultNotifications`

### Provider Service (13 broken)
- `getProviders` → `providerService.getProviders`
- `checkProviderStatus` → `providerService.checkProviderStatus`
- `updateProviderLicense` → `providerService.updateProviderLicense`
- `removeProviderLicense` → `providerService.removeProviderLicense`
- `getProviderLicense` → `providerService.getProviderLicense`
- `addProviderLicense` → `providerService.addProviderLicense`
- `setupUserAsProvider` → `providerService.setupUserAsProvider`
- `setupMultipleProviders` → `providerService.setupMultipleProviders`
- `getProviderAvailability` → `providerService.getProviderAvailability`
- `setProviderBusyTime` → `providerService.setProviderBusyTime`
- `cancelProviderBusyTime` → `providerService.cancelProviderBusyTime`
- `showProviderBusyTimes` → `providerService.showProviderBusyTimes`
- `discoverPractice` → `providerService.discoverPractice`

### User Service (7 broken)
- `createUser` → `userService.createUser`
- `searchUsers` → `userService.searchUsers`
- `addUserRole` → `userService.addUserRole`
- `removeUserRole` → `userService.removeUserRole`
- `bulkUpdateRoles` → `userService.bulkUpdateRoles`
- `resendEmailVerification` → `userService.resendEmailVerification`
- `getPatientEngagementInsights` → `userService.getPatientEngagementInsights`

### Clinic Service (6 broken)
- `getClinicInfo` → `clinicService.getClinicInfo`
- `getClinicAddress` → `clinicService.getClinicAddress`
- `updateClinicSettings` → `clinicService.updateClinicSettings`
- `getClinicStatistics` → `clinicService.getClinicStatistics`
- `generateClinicReport` → `clinicService.generateClinicReport`
- `generatePatientReport` → `clinicService.generatePatientReport`

### Communication Service (10 broken)
- `createChatSession` → `communicationService.createChatSession`
- `searchChatHistory` → `communicationService.searchChatHistory`
- `sendAppointmentConfirmationRequest` → `communicationService.sendAppointmentConfirmationRequest`
- `createHealthCampaign` → `communicationService.createHealthCampaign`
- `startHealthCampaign` → `communicationService.startHealthCampaign`
- `pauseHealthCampaign` → `communicationService.pauseHealthCampaign`
- `resumeHealthCampaign` → `communicationService.resumeHealthCampaign`
- `getCampaignAnalytics` → `communicationService.getCampaignAnalytics`
- `getCommunicationAnalytics` → `communicationService.getCommunicationAnalytics`
- `getChannelPerformance` → `communicationService.getChannelPerformance`
- `generateCommunicationReport` → `communicationService.generateCommunicationReport`

### AI Medical Functions (7 broken) - NEW SERVICE NEEDED
These don't exist in any service yet! Need to check where they are:
- `analyzeSymptoms`
- `getDifferentialDiagnosis`
- `recommendTreatment`
- `recommendTests`
- `getAIClinicalInsights`
- `checkPatientsForAllergies`

### Allergy/Vital/Vaccination (8 broken) - Check which service
- `addAllergy` → Need to find
- `getAllergies` → Need to find
- `addVitalSigns` → Need to find
- `getVitalSigns` → Need to find
- `addVaccination` → Need to find
- `getVaccinations` → Need to find

### Referral/Insurance (4 broken) - Check which service
- `createReferral` → Need to find
- `getReferrals` → Need to find
- `verifyInsurance` → Need to find
- `submitInsuranceClaim` → Need to find

### System Admin (3 broken) - NEW SERVICE NEEDED
- `generateComplianceReport`
- `runBackup`
- `exportAuditLogs`
- `getSystemHealth`

---

## Action Plan

1. **Create script to auto-fix known mappings** (65 functions)
2. **Find where the other 24 functions live** (AI medical, allergy, vital, referral, etc.)
3. **Run the fix script**
4. **Test all 506 cases**

---

## Script Pattern

```javascript
// Replace:
return await this.scheduleAppointment(args, practiceContext, session);

// With:
return await appointmentService.scheduleAppointment(args, practiceContext, session);
```
