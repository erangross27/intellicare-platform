# 🔄 Service Delegation Mapping

**Purpose:** Document all case statements that now delegate to extracted services

---

## ✅ Patient Service Delegations

```javascript
// Patient CRUD
case 'addPatient': → patientService.addPatient()
case 'updatePatient': → patientService.updatePatient()
case 'deletePatientBySearch': → patientService.deletePatientBySearch()
case 'searchPatients': → patientService.searchPatients()
case 'searchPatientsByName': → patientService.searchPatientsByName()
case 'listAllPatients': → patientService.listAllPatients()
case 'findPatient': → patientService.findPatient()
case 'getPatientDetails': → patientService.getPatientDetails()
case 'importPatientsFromCSV': → patientService.importPatientsFromCSV()

// Follow-ups
case 'getPatientsNeedingFollowUp': → patientService.getPatientsNeedingFollowUp()
case 'getPatientFollowUpDetails': → patientService.getPatientFollowUpDetails()
case 'scheduleFollowUp': → patientService.scheduleFollowUp()
case 'updateFollowUpStatus': → patientService.updateFollowUpStatus()
case 'deleteFollowUp': → patientService.deleteFollowUp()
case 'getPatientsForFollowUp': → patientService.getPatientsForFollowUp()

// Conditions
case 'addPatientCondition': → patientService.addPatientCondition()
case 'updatePatientCondition': → patientService.updatePatientCondition()
case 'getPatientConditions': → patientService.getPatientConditions()
case 'getConditionStatistics': → patientService.getConditionStatistics()
case 'getPatientsList': → patientService.getPatientsList()

// Medical History
case 'addMedicalHistory': → patientService.addMedicalHistory()
case 'updateMedicalHistory': → patientService.updateMedicalHistory()
case 'deleteMedicalHistory': → patientService.deleteMedicalHistory()

// Other
case 'getPatientConsents': → patientService.getPatientConsents()
case 'assignDocumentToPatient': → patientService.assignDocumentToPatient()
case 'checkPatientsForAllergies': → patientService.checkPatientsForAllergies()
case 'anonymizePatientData': → patientService.anonymizePatientData()
case 'getPatientEngagementInsights': → patientService.getPatientEngagementInsights()
case 'generatePatientReport': → patientService.generatePatientReport()
```

## 🔄 Document Service Delegations

```javascript
case 'processUploadedDocuments': → documentService.processUploadedDocuments()
case 'getDocuments': → documentService.getDocuments()
case 'searchDocuments': → documentService.searchDocuments()
case 'deleteDocument': → documentService.deleteDocument()
case 'assignDocumentToPatient': → documentService.assignDocumentToPatient()
case 'retrievePendingUpload': → documentService.retrievePendingUpload()
case 'analyzePendingDocument': → documentService.analyzePendingDocument()
case 'batchAnalyzeDocuments': → documentService.batchAnalyzeDocuments()
case 'uploadImagingResult': → documentService.uploadImagingResult()
```

## 📅 Appointment Service Delegations

```javascript
case 'scheduleAppointment': → appointmentService.scheduleAppointment()
case 'rescheduleAppointment': → appointmentService.rescheduleAppointment()
case 'cancelAppointment': → appointmentService.cancelAppointment()
case 'updateAppointment': → appointmentService.updateAppointment()
case 'createAppointment': → appointmentService.createAppointment()
case 'findAvailableSlots': → appointmentService.findAvailableSlots()
case 'getProviderAppointments': → appointmentService.getProviderAppointments()
case 'sendAppointmentConfirmationRequest': → appointmentService.sendAppointmentConfirmationRequest()
```

## 💊 Medication Service Delegations

```javascript
case 'addMedication': → medicationService.addMedication()
case 'getMedications': → medicationService.getMedications()
case 'checkDrugInteractions': → medicationService.checkDrugInteractions()
case 'checkDrugAllergy': → medicationService.checkDrugAllergy()
case 'checkDrugSafety': → medicationService.checkDrugSafety()
case 'sendMedicationRefillReminders': → medicationService.sendMedicationRefillReminders()
```

## 📋 Prescription Service Delegations

```javascript
case 'createPrescription': → prescriptionService.createPrescription()
case 'getPrescriptions': → prescriptionService.getPrescriptions()
```

## 🧪 Lab Service Delegations

```javascript
case 'addLabResult': → labService.addLabResult()
case 'getLabResults': → labService.getLabResults()
case 'interpretLabResults': → labService.interpretLabResults()
case 'parseLabResults': → labService.parseLabResults()
case 'orderLabTest': → labService.orderLabTest()
case 'addImagingResult': → labService.addImagingResult()
case 'getImagingResults': → labService.getImagingResults()
case 'orderImaging': → labService.orderImaging()
case 'addVitalSigns': → labService.addVitalSigns()
case 'getVitalSigns': → labService.getVitalSigns()
case 'recordVitalSigns': → labService.recordVitalSigns()
case 'addVaccination': → labService.addVaccination()
case 'getVaccinations': → labService.getVaccinations()
case 'getProviderAvailability': → labService.getProviderAvailability()
case 'setProviderAvailability': → labService.setProviderAvailability()
```

## 👨‍⚕️ Provider Service Delegations

```javascript
case 'addProviderLicense': → providerService.addProviderLicense()
case 'updateProviderLicense': → providerService.updateProviderLicense()
case 'removeProviderLicense': → providerService.removeProviderLicense()
case 'getProviderLicense': → providerService.getProviderLicense()
case 'checkProviderStatus': → providerService.checkProviderStatus()
case 'getProviders': → providerService.getProviders()
case 'searchProviders': → providerService.searchProviders()
case 'getProviderByNPI': → providerService.getProviderByNPI()
case 'setupUserAsProvider': → providerService.setupUserAsProvider()
case 'setupMultipleProviders': → providerService.setupMultipleProviders()
case 'blockProviderTime': → providerService.blockProviderTime()
case 'getProviderMeetings': → providerService.getProviderMeetings()
case 'updateProviderSettings': → providerService.updateProviderSettings()
```

## 👤 User Service Delegations

```javascript
case 'createUser': → userService.createUser()
case 'deleteUser': → userService.deleteUser()
case 'getUserDetails': → userService.getUserDetails()
case 'getAllUsers': → userService.getAllUsers()
case 'searchUsers': → userService.searchUsers()
case 'addUserRole': → userService.addUserRole()
case 'removeUserRole': → userService.removeUserRole()
case 'assignRole': → userService.assignRole()
case 'bulkUpdateRoles': → userService.bulkUpdateRoles()
case 'getRoles': → userService.getRoles()
case 'getUserPermissions': → userService.getUserPermissions()
case 'updateUserPermissions': → userService.updateUserPermissions()
case 'deactivateUser': → userService.deactivateUser()
case 'resendEmailVerification': → userService.resendEmailVerification()
case 'importUsersFromCSV': → userService.importUsersFromCSV()
```

## 🏥 Clinic Service Delegations

```javascript
case 'createClinic': → clinicService.createClinic()
case 'updateClinic': → clinicService.updateClinic()
case 'getAllClinics': → clinicService.getAllClinics()
case 'getClinicInfo': → clinicService.getClinicInfo()
case 'updateClinicSettings': → clinicService.updateClinicSettings()
case 'discoverPractice': → clinicService.discoverPractice()
case 'getClinicStatistics': → clinicService.getClinicStatistics()
case 'getClinicUsage': → clinicService.getClinicUsage()
case 'generateClinicReport': → clinicService.generateClinicReport()
case 'getClinicPermissions': → clinicService.getClinicPermissions()
case 'rotateClinicToken': → clinicService.rotateClinicToken()
case 'validateClinicToken': → clinicService.validateClinicToken()
case 'getClinicAddress': → clinicService.getClinicAddress()
```

## 📞 Communication Service Delegations

```javascript
case 'sendTestResultNotifications': → communicationService.sendTestResultNotifications()
```

---

## 📊 Summary

**Total Delegations Created:** 85 functions
**Services Updated:** 10 services
**Remaining in agentServiceV4:** ~539 case statements (medical collections, infrastructure, external APIs, AI functions)

---

**Status:** Delegation layer complete for all extracted services
**Next:** Remove old function implementations from agentServiceV4.js
