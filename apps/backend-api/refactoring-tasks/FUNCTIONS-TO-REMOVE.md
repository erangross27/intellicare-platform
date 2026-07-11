# Functions to Remove from agentServiceV4.js

**Purpose:** List of all function implementations that have been extracted to services and should be removed

---

## Patient Service Functions (29 total):

```javascript
async searchPatients(params, practiceContext)
async searchPatientsByName(params, practiceContext)
async findPatient(params, practiceContext, session)
async listAllPatients(params, practiceContext)
async getPatientDetails(params, practiceContext, session)
async updatePatient(params, practiceContext, session)
async addPatient(params, practiceContext, session)
async deletePatientBySearch(params, practiceContext, session)
async importPatientsFromCSV(params, practiceContext, session)
async getPatientsNeedingFollowUp(params, practiceContext, session)
async getPatientFollowUpDetails(params, practiceContext, session)
async scheduleFollowUp(params, practiceContext, session)
async updateFollowUpStatus(params, practiceContext, session)
async deleteFollowUp(params, practiceContext, session)
async getPatientsForFollowUp(params, practiceContext, session)
async addPatientCondition(params, practiceContext, session)
async updatePatientCondition(params, practiceContext, session)
async getPatientConditions(params, practiceContext, session)
async getConditionStatistics(params, practiceContext, session)
async getPatientsList(params, practiceContext, session)
async addMedicalHistory(params, practiceContext, session)
async updateMedicalHistory(params, practiceContext, session)
async deleteMedicalHistory(params, practiceContext, session)
async getPatientEngagementInsights(params, practiceContext, session)
async anonymizePatientData(args, practiceContext, session)
async getPatientConsents(args, practiceContext, session)
async assignDocumentToPatient(params, practiceContext, session)
async checkPatientsForAllergies(params, practiceContext, session)
async generatePatientReport(params, practiceContext, session)
```

## Appointment Service Functions (7 total):

```javascript
async scheduleAppointment(params, practiceContext, session)
async rescheduleAppointment(params, practiceContext, session)
async cancelAppointment(params, practiceContext, session)
async updateAppointment(params, practiceContext, session)
async createAppointment(params, practiceContext, session)
async findAvailableSlots(params, practiceContext, session)
async getProviderAppointments(params, practiceContext, session)
async sendAppointmentConfirmationRequest(params, practiceContext, session)
```

## Document Service Functions (7 total):

```javascript
async processUploadedDocuments(params, practiceContext, session)
async getDocuments(params, practiceContext, session)
async searchDocuments(params, practiceContext, session)
async deleteDocument(params, practiceContext, session)
async retrievePendingUpload(params, practiceContext, session)
async analyzePendingDocument(params, practiceContext, session)
async batchAnalyzeDocuments(params, practiceContext, session)
async uploadImagingResult(params, practiceContext, session)
```

## Medication Service Functions (5 total):

```javascript
async addMedication(params, practiceContext, session)
async getMedications(params, practiceContext, session)
async checkDrugInteractions(params, practiceContext, session)
async checkDrugAllergy(params, practiceContext, session)
async checkDrugSafety(params, practiceContext, session)
async sendMedicationRefillReminders(params, practiceContext, session)
```

## Prescription Service Functions (2 total):

```javascript
async createPrescription(params, practiceContext, session)
async getPrescriptions(params, practiceContext, session)
```

## Lab Service Functions (11 total):

```javascript
async addLabResult(params, practiceContext, session)
async getLabResults(params, practiceContext, session)
async interpretLabResults(params, practiceContext, session)
async parseLabResults(params, practiceContext, session)
async orderLabTest(params, practiceContext, session)
async addImagingResult(params, practiceContext, session)
async getImagingResults(params, practiceContext, session)
async orderImaging(params, practiceContext, session)
async addVitalSigns(params, practiceContext, session)
async getVitalSigns(params, practiceContext, session)
async recordVitalSigns(params, practiceContext, session)
async addVaccination(params, practiceContext, session)
async getVaccinations(params, practiceContext, session)
async getProviderAvailability(params, practiceContext, session)
async setProviderAvailability(params, practiceContext, session)
```

## Provider Service Functions (11 total):

```javascript
async addProviderLicense(params, practiceContext, session)
async updateProviderLicense(params, practiceContext, session)
async removeProviderLicense(params, practiceContext, session)
async getProviderLicense(params, practiceContext, session)
async checkProviderStatus(params, practiceContext, session)
async getProviders(params, practiceContext, session)
async searchProviders(params, practiceContext, session)
async getProviderByNPI(params, practiceContext, session)
async setupUserAsProvider(params, practiceContext, session)
async setupMultipleProviders(params, practiceContext, session)
async blockProviderTime(params, practiceContext, session)
async getProviderMeetings(params, practiceContext, session)
async updateProviderSettings(params, practiceContext, session)
```

## User Service Functions (7 total):

```javascript
async createUser(params, practiceContext, session)
async deleteUser(params, practiceContext, session)
async getUserDetails(params, practiceContext, session)
async getAllUsers(params, practiceContext, session)
async searchUsers(params, practiceContext, session)
async addUserRole(params, practiceContext, session)
async removeUserRole(params, practiceContext, session)
async assignRole(params, practiceContext, session)
async bulkUpdateRoles(params, practiceContext, session)
async getRoles(params, practiceContext, session)
async getUserPermissions(params, practiceContext, session)
async updateUserPermissions(params, practiceContext, session)
async deactivateUser(params, practiceContext, session)
async resendEmailVerification(params, practiceContext, session)
async importUsersFromCSV(params, practiceContext, session)
```

## Clinic Service Functions (6 total):

```javascript
async createClinic(params, practiceContext, session)
async updateClinic(params, practiceContext, session)
async getAllClinics(params, practiceContext, session)
async getClinicInfo(params, practiceContext, session)
async updateClinicSettings(params, practiceContext, session)
async discoverPractice(params, practiceContext, session)
async getClinicStatistics(params, practiceContext, session)
async getClinicUsage(params, practiceContext, session)
async generateClinicReport(params, practiceContext, session)
async getClinicPermissions(params, practiceContext, session)
async rotateClinicToken(params, practiceContext, session)
async validateClinicToken(params, practiceContext, session)
async getClinicAddress(params, practiceContext, session)
```

## Communication Service Functions (1 total):

```javascript
async sendTestResultNotifications(params, practiceContext, session)
```

---

## Total Functions to Remove: 85

**Note:** DO NOT remove:
- Functions that delegate to other existing services
- Infrastructure functions (cache, database, health)
- AI/ML functions (diagnosis, treatment recommendations)
- Medical collection CRUD functions (auto-generated)
- External API wrapper functions

**Strategy:**
1. Search for each function by name
2. Find the complete function implementation (matching braces)
3. Remove the entire function
4. Keep the case statements that now delegate to services
5. Verify syntax after each removal or batch
