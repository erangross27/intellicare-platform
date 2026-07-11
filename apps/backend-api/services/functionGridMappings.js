// Function Grid Mappings - Defines which grid template each function should use
// Scalable system for thousands of IntelliCare functions

// Import comprehensive medical grid mappings for 184 GET functions
const medicalGridMappings = require('./medicalGridMappingsComplete');

// Merge medical grid mappings with custom mappings
const gridMappings = {
  // ========== PATIENT MANAGEMENT FUNCTIONS ==========

  // Patient List Functions
  'listAllPatients': {
    gridType: 'patient-list',
    title: 'All Patients'
  },

  'searchPatients': {
    gridType: 'patient-list',
    title: 'Search Results'
  },

  'searchPatientsByName': {
    gridType: 'patient-list',
    title: 'Patient Search Results'
  },

  'findPatient': {
    gridType: 'patient-list',
    title: 'Patient Found'
  },

  'getPatientsWithMedicalDataSummary': {
    gridType: 'patient-list',
    title: 'Patients with Medical Data'
  },

  // ========== FOLLOW-UP & TASK MANAGEMENT ==========

  'getPatientsNeedingFollowUp': {
    gridType: 'followup-list',
    title: 'Patients Needing Follow-up',
    columns: ['patientId', 'patientName', 'patientAge', 'followUpDate', 'followUpTime', 'department', 'doctor', 'reason', 'priority'],
    headers: ['Patient ID', 'Patient Name', 'Age', 'Follow-up Date', 'Time', 'Department', 'Doctor', 'Reason', 'Priority'],
    hiddenColumns: ['patientId']  // This tells frontend to hide patientId column but keep it in data
  },

  'getPatientsForFollowUp': {
    gridType: 'followup-list',
    title: 'Follow-up Patients'
  },

  'getOverdueFollowUps': {
    gridType: 'followup-list',
    title: 'Overdue Follow-ups',
    columns: ['patientName', 'originalDate', 'daysPastDue', 'doctor', 'reason', 'urgency'],
    headers: ['Patient Name', 'Original Date', 'Days Overdue', 'Doctor', 'Reason', 'Urgency']
  },

  // ========== APPOINTMENT MANAGEMENT ==========

  'getTodayAppointments': {
    gridType: 'appointment-list',
    title: 'Today\'s Appointments'
  },

  'getAppointments': {
    gridType: 'appointment-list',
    title: 'Appointments'
  },

  'getUpcomingAppointments': {
    gridType: 'appointment-list',
    title: 'Upcoming Appointments'
  },

  'getCancelledAppointments': {
    gridType: 'appointment-list',
    title: 'Cancelled Appointments',
    columns: ['patientName', 'originalDate', 'cancelledDate', 'reason', 'provider'],
    headers: ['Patient Name', 'Original Date', 'Cancelled Date', 'Reason', 'Provider']
  },

  // ========== MEDICAL RECORDS & DOCUMENTS ==========

  'getPatientDocuments': {
    gridType: 'documents',
    title: 'Patient Documents'
  },

  'getRecentDocuments': {
    gridType: 'documents',
    title: 'Recent Documents'
  },

  'getPendingDocuments': {
    gridType: 'documents',
    title: 'Pending Documents',
    columns: ['patientName', 'documentType', 'submittedDate', 'status', 'priority'],
    headers: ['Patient Name', 'Document Type', 'Submitted', 'Status', 'Priority']
  },

  'getFullMedicalReport': {
    gridType: 'medical-records',
    title: 'Medical History',
    columns: ['date', 'diagnosis', 'treatment', 'provider', 'notes', 'status'],
    headers: ['Date', 'Diagnosis', 'Treatment', 'Provider', 'Notes', 'Status']
  },

  'getLabResults': {
    gridType: 'medical-records',
    title: 'Lab Results',
    columns: ['patientName', 'testType', 'date', 'result', 'referenceRange', 'status'],
    headers: ['Patient Name', 'Test Type', 'Date', 'Result', 'Reference Range', 'Status']
  },

  // ========== FINANCIAL & BILLING ==========

  'getPendingPayments': {
    gridType: 'financial',
    title: 'Pending Payments'
  },

  'getInsuranceClaims': {
    gridType: 'financial',
    title: 'Insurance Claims',
    columns: ['patientName', 'claimNumber', 'amount', 'status', 'submittedDate', 'insurance'],
    headers: ['Patient Name', 'Claim #', 'Amount', 'Status', 'Submitted', 'Insurance']
  },

  'getOutstandingBalances': {
    gridType: 'financial',
    title: 'Outstanding Balances',
    columns: ['patientName', 'balance', 'lastPayment', 'daysPastDue', 'status'],
    headers: ['Patient Name', 'Balance', 'Last Payment', 'Days Past Due', 'Status']
  },

  // ========== DOCTOR MANAGEMENT ==========

  'getDoctorSchedule': {
    gridType: 'appointment-list',
    title: 'Doctor Schedule',
    columns: ['time', 'patientName', 'appointmentType', 'duration', 'status'],
    headers: ['Time', 'Patient', 'Type', 'Duration', 'Status']
  },

  'getStaffList': {
    gridType: 'patient-list', // Reuse patient-list template for staff
    title: 'Staff Members',
    columns: ['firstName', 'lastName', 'role', 'department', 'phone', 'email'],
    headers: ['First Name', 'Last Name', 'Role', 'Department', 'Phone', 'Email']
  },

  // ========== ANALYTICS & REPORTS ==========

  'getPatientsByCondition': {
    gridType: 'patient-list',
    title: 'Patients by Medical Condition',
    columns: ['patientName', 'condition', 'diagnosisDate', 'provider', 'status'],
    headers: ['Patient Name', 'Condition', 'Diagnosis Date', 'Provider', 'Status']
  },

  'getMedicationList': {
    gridType: 'medical-records',
    title: 'Current Medications',
    columns: ['patientName', 'medication', 'dosage', 'frequency', 'prescribedBy', 'startDate'],
    headers: ['Patient Name', 'Medication', 'Dosage', 'Frequency', 'Prescribed By', 'Start Date']
  },

  'getMedications': {
    gridType: 'medical-records',
    title: 'Patient Medications',
    columns: ['medication', 'dosage', 'frequency', 'startDate', 'prescribedBy', 'status'],
    headers: ['Medication', 'Dosage', 'Frequency', 'Start Date', 'Prescribed By', 'Status']
  },

  'getAllergiesList': {
    gridType: 'medical-records',
    title: 'Patient Allergies',
    columns: ['patientName', 'allergen', 'severity', 'reaction', 'discoveredDate'],
    headers: ['Patient Name', 'Allergen', 'Severity', 'Reaction', 'Discovered']
  },

  'getAllergies': {
    gridType: 'medical-records',
    title: 'Patient Allergies',
    columns: ['allergen', 'severity', 'reaction', 'discoveredDate', 'notes'],
    headers: ['Allergen', 'Severity', 'Reaction', 'Discovered Date', 'Notes']
  },

  // ========== EMERGENCY & URGENT CARE ==========

  'getEmergencyContacts': {
    gridType: 'patient-list',
    title: 'Emergency Contacts',
    columns: ['patientName', 'contactName', 'relationship', 'phone', 'priority'],
    headers: ['Patient', 'Contact Name', 'Relationship', 'Phone', 'Priority']
  },

  'getHighRiskPatients': {
    gridType: 'patient-list',
    title: 'High Risk Patients',
    columns: ['patientName', 'riskFactors', 'lastVisit', 'nextAppointment', 'assignedProvider'],
    headers: ['Patient Name', 'Risk Factors', 'Last Visit', 'Next Appointment', 'Provider']
  },

  // ========== VACCINATION & PREVENTIVE CARE ==========

  'getVaccinationRecords': {
    gridType: 'medical-records',
    title: 'Vaccination Records',
    columns: ['patientName', 'vaccine', 'dateAdministered', 'provider', 'nextDue'],
    headers: ['Patient Name', 'Vaccine', 'Date Given', 'Provider', 'Next Due']
  },

  'getDueVaccinations': {
    gridType: 'medical-records',
    title: 'Due Vaccinations',
    columns: ['patientName', 'vaccine', 'dueDate', 'priority', 'contactStatus'],
    headers: ['Patient Name', 'Vaccine', 'Due Date', 'Priority', 'Contact Status']
  },

  // ========== IMAGING & DIAGNOSTICS ==========

  'getImagingResults': {
    gridType: 'medical-records',
    title: 'Imaging Results',
    columns: ['patientName', 'studyType', 'studyDate', 'findings', 'radiologist', 'status'],
    headers: ['Patient Name', 'Study Type', 'Date', 'Findings', 'Radiologist', 'Status']
  },

  'getPendingResults': {
    gridType: 'medical-records',
    title: 'Pending Results',
    columns: ['patientName', 'testType', 'orderedDate', 'expectedDate', 'priority'],
    headers: ['Patient Name', 'Test Type', 'Ordered', 'Expected', 'Priority']
  },

  // NOTE: This is a foundation for thousands of functions.
  // Additional mappings can be added as needed for specific practice requirements.
  // The system is designed to be infinitely extensible.

  // ========== MEDICAL CATEGORY CRUD OPERATIONS (33 Categories × 4 Operations = 132 Functions) ==========

  // 1. Appointments Category
  'getAppointmentsData': {
    gridType: 'medical-category',
    title: 'Appointments Data',
    category: 'appointments'
  },
  'addAppointmentRecord': {
    gridType: 'form-input',
    title: 'Add Appointment',
    category: 'appointments'
  },
  'updateAppointmentRecord': {
    gridType: 'form-input',
    title: 'Update Appointment',
    category: 'appointments'
  },
  'deleteAppointmentRecord': {
    gridType: 'confirmation',
    title: 'Delete Appointment',
    category: 'appointments'
  },

  // 2. Medications Category
  'getMedicationsData': {
    gridType: 'medical-category',
    title: 'Medications Data',
    category: 'medications'
  },
  'addMedicationRecord': {
    gridType: 'form-input',
    title: 'Add Medication',
    category: 'medications'
  },
  'updateMedicationRecord': {
    gridType: 'form-input',
    title: 'Update Medication',
    category: 'medications'
  },
  'deleteMedicationRecord': {
    gridType: 'confirmation',
    title: 'Delete Medication',
    category: 'medications'
  },

  // 3. Allergies Category
  'getAllergiesData': {
    gridType: 'medical-category',
    title: 'Allergies Data',
    category: 'allergies'
  },
  'addAllergyRecord': {
    gridType: 'form-input',
    title: 'Add Allergy',
    category: 'allergies'
  },
  'updateAllergyRecord': {
    gridType: 'form-input',
    title: 'Update Allergy',
    category: 'allergies'
  },
  'deleteAllergyRecord': {
    gridType: 'confirmation',
    title: 'Delete Allergy',
    category: 'allergies'
  },

  // 4. Vitals Category
  'getVitalsData': {
    gridType: 'medical-category',
    title: 'Vital Signs Data',
    category: 'vitals'
  },
  'addVitalsRecord': {
    gridType: 'form-input',
    title: 'Add Vital Signs',
    category: 'vitals'
  },
  'updateVitalsRecord': {
    gridType: 'form-input',
    title: 'Update Vital Signs',
    category: 'vitals'
  },
  'deleteVitalsRecord': {
    gridType: 'confirmation',
    title: 'Delete Vital Signs',
    category: 'vitals'
  },

  // 5. Laboratory Category
  'getLaboratoryData': {
    gridType: 'medical-category',
    title: 'Laboratory Data',
    category: 'laboratory'
  },
  'addLaboratoryRecord': {
    gridType: 'form-input',
    title: 'Add Lab Result',
    category: 'laboratory'
  },
  'updateLaboratoryRecord': {
    gridType: 'form-input',
    title: 'Update Lab Result',
    category: 'laboratory'
  },
  'deleteLaboratoryRecord': {
    gridType: 'confirmation',
    title: 'Delete Lab Result',
    category: 'laboratory'
  },

  // 6. Imaging Category
  'getImagingData': {
    gridType: 'medical-category',
    title: 'Imaging Studies Data',
    category: 'imaging'
  },
  'addImagingRecord': {
    gridType: 'form-input',
    title: 'Add Imaging Study',
    category: 'imaging'
  },
  'updateImagingRecord': {
    gridType: 'form-input',
    title: 'Update Imaging Study',
    category: 'imaging'
  },
  'deleteImagingRecord': {
    gridType: 'confirmation',
    title: 'Delete Imaging Study',
    category: 'imaging'
  },

  // 7. Procedures Category
  'getProceduresData': {
    gridType: 'medical-category',
    title: 'Procedures Data',
    category: 'procedures'
  },
  'addProcedureRecord': {
    gridType: 'form-input',
    title: 'Add Procedure',
    category: 'procedures'
  },
  'updateProcedureRecord': {
    gridType: 'form-input',
    title: 'Update Procedure',
    category: 'procedures'
  },
  'deleteProcedureRecord': {
    gridType: 'confirmation',
    title: 'Delete Procedure',
    category: 'procedures'
  },

  // 8. Diagnoses Category
  'getDiagnosesData': {
    gridType: 'medical-category',
    title: 'Diagnoses Data',
    category: 'diagnoses'
  },
  'addDiagnosisRecord': {
    gridType: 'form-input',
    title: 'Add Diagnosis',
    category: 'diagnoses'
  },
  'updateDiagnosisRecord': {
    gridType: 'form-input',
    title: 'Update Diagnosis',
    category: 'diagnoses'
  },
  'deleteDiagnosisRecord': {
    gridType: 'confirmation',
    title: 'Delete Diagnosis',
    category: 'diagnoses'
  },

  // 9. Immunizations Category
  'getImmunizationsData': {
    gridType: 'medical-category',
    title: 'Immunizations Data',
    category: 'immunizations'
  },
  'addImmunizationRecord': {
    gridType: 'form-input',
    title: 'Add Immunization',
    category: 'immunizations'
  },
  'updateImmunizationRecord': {
    gridType: 'form-input',
    title: 'Update Immunization',
    category: 'immunizations'
  },
  'deleteImmunizationRecord': {
    gridType: 'confirmation',
    title: 'Delete Immunization',
    category: 'immunizations'
  },

  // 10. Documents Category
  'getDocumentsData': {
    gridType: 'medical-category',
    title: 'Medical Documents Data',
    category: 'documents'
  },
  'addDocumentRecord': {
    gridType: 'form-input',
    title: 'Add Document',
    category: 'documents'
  },
  'updateDocumentRecord': {
    gridType: 'form-input',
    title: 'Update Document',
    category: 'documents'
  },
  'deleteDocumentRecord': {
    gridType: 'confirmation',
    title: 'Delete Document',
    category: 'documents'
  },

  // 11. Cardiology Category
  'getCardiologyData': {
    gridType: 'medical-category',
    title: 'Cardiology Data',
    category: 'cardiology'
  },
  'addCardiologyRecord': {
    gridType: 'form-input',
    title: 'Add Cardiology Record',
    category: 'cardiology'
  },
  'updateCardiologyRecord': {
    gridType: 'form-input',
    title: 'Update Cardiology Record',
    category: 'cardiology'
  },
  'deleteCardiologyRecord': {
    gridType: 'confirmation',
    title: 'Delete Cardiology Record',
    category: 'cardiology'
  },

  // 12. Neurology Category
  'getNeurologyData': {
    gridType: 'medical-category',
    title: 'Neurology Data',
    category: 'neurology'
  },
  'addNeurologyRecord': {
    gridType: 'form-input',
    title: 'Add Neurology Record',
    category: 'neurology'
  },
  'updateNeurologyRecord': {
    gridType: 'form-input',
    title: 'Update Neurology Record',
    category: 'neurology'
  },
  'deleteNeurologyRecord': {
    gridType: 'confirmation',
    title: 'Delete Neurology Record',
    category: 'neurology'
  },

  // 13. Psychiatry Category
  'getPsychiatryData': {
    gridType: 'medical-category',
    title: 'Psychiatry Data',
    category: 'psychiatry'
  },
  'addPsychiatryRecord': {
    gridType: 'form-input',
    title: 'Add Psychiatry Record',
    category: 'psychiatry'
  },
  'updatePsychiatryRecord': {
    gridType: 'form-input',
    title: 'Update Psychiatry Record',
    category: 'psychiatry'
  },
  'deletePsychiatryRecord': {
    gridType: 'confirmation',
    title: 'Delete Psychiatry Record',
    category: 'psychiatry'
  },

  // 14. Oncology Category
  'getOncologyData': {
    gridType: 'medical-category',
    title: 'Oncology Data',
    category: 'oncology'
  },
  'addOncologyRecord': {
    gridType: 'form-input',
    title: 'Add Oncology Record',
    category: 'oncology'
  },
  'updateOncologyRecord': {
    gridType: 'form-input',
    title: 'Update Oncology Record',
    category: 'oncology'
  },
  'deleteOncologyRecord': {
    gridType: 'confirmation',
    title: 'Delete Oncology Record',
    category: 'oncology'
  },

  // 15. Pediatrics Category
  'getPediatricsData': {
    gridType: 'medical-category',
    title: 'Pediatrics Data',
    category: 'pediatrics'
  },
  'addPediatricsRecord': {
    gridType: 'form-input',
    title: 'Add Pediatrics Record',
    category: 'pediatrics'
  },
  'updatePediatricsRecord': {
    gridType: 'form-input',
    title: 'Update Pediatrics Record',
    category: 'pediatrics'
  },
  'deletePediatricsRecord': {
    gridType: 'confirmation',
    title: 'Delete Pediatrics Record',
    category: 'pediatrics'
  },

  // 16. Orthopedics Category
  'getOrthopedicsData': {
    gridType: 'medical-category',
    title: 'Orthopedics Data',
    category: 'orthopedics'
  },
  'addOrthopedicsRecord': {
    gridType: 'form-input',
    title: 'Add Orthopedics Record',
    category: 'orthopedics'
  },
  'updateOrthopedicsRecord': {
    gridType: 'form-input',
    title: 'Update Orthopedics Record',
    category: 'orthopedics'
  },
  'deleteOrthopedicsRecord': {
    gridType: 'confirmation',
    title: 'Delete Orthopedics Record',
    category: 'orthopedics'
  },

  // 17. Pulmonary Category
  'getPulmonaryData': {
    gridType: 'medical-category',
    title: 'Pulmonary Data',
    category: 'pulmonary'
  },
  'addPulmonaryRecord': {
    gridType: 'form-input',
    title: 'Add Pulmonary Record',
    category: 'pulmonary'
  },
  'updatePulmonaryRecord': {
    gridType: 'form-input',
    title: 'Update Pulmonary Record',
    category: 'pulmonary'
  },
  'deletePulmonaryRecord': {
    gridType: 'confirmation',
    title: 'Delete Pulmonary Record',
    category: 'pulmonary'
  },

  // 18. Endocrinology Category
  'getEndocrinologyData': {
    gridType: 'medical-category',
    title: 'Endocrinology Data',
    category: 'endocrinology'
  },
  'addEndocrinologyRecord': {
    gridType: 'form-input',
    title: 'Add Endocrinology Record',
    category: 'endocrinology'
  },
  'updateEndocrinologyRecord': {
    gridType: 'form-input',
    title: 'Update Endocrinology Record',
    category: 'endocrinology'
  },
  'deleteEndocrinologyRecord': {
    gridType: 'confirmation',
    title: 'Delete Endocrinology Record',
    category: 'endocrinology'
  },

  // 19. Nephrology Category
  'getNephrologyData': {
    gridType: 'medical-category',
    title: 'Nephrology Data',
    category: 'nephrology'
  },
  'addNephrologyRecord': {
    gridType: 'form-input',
    title: 'Add Nephrology Record',
    category: 'nephrology'
  },
  'updateNephrologyRecord': {
    gridType: 'form-input',
    title: 'Update Nephrology Record',
    category: 'nephrology'
  },
  'deleteNephrologyRecord': {
    gridType: 'confirmation',
    title: 'Delete Nephrology Record',
    category: 'nephrology'
  },

  // 20. Gastroenterology Category
  'getGastroenterologyData': {
    gridType: 'medical-category',
    title: 'Gastroenterology Data',
    category: 'gastroenterology'
  },
  'addGastroenterologyRecord': {
    gridType: 'form-input',
    title: 'Add Gastroenterology Record',
    category: 'gastroenterology'
  },
  'updateGastroenterologyRecord': {
    gridType: 'form-input',
    title: 'Update Gastroenterology Record',
    category: 'gastroenterology'
  },
  'deleteGastroenterologyRecord': {
    gridType: 'confirmation',
    title: 'Delete Gastroenterology Record',
    category: 'gastroenterology'
  },

  // 21. Rheumatology Category
  'getRheumatologyData': {
    gridType: 'medical-category',
    title: 'Rheumatology Data',
    category: 'rheumatology'
  },
  'addRheumatologyRecord': {
    gridType: 'form-input',
    title: 'Add Rheumatology Record',
    category: 'rheumatology'
  },
  'updateRheumatologyRecord': {
    gridType: 'form-input',
    title: 'Update Rheumatology Record',
    category: 'rheumatology'
  },
  'deleteRheumatologyRecord': {
    gridType: 'confirmation',
    title: 'Delete Rheumatology Record',
    category: 'rheumatology'
  },

  // 22. Hematology Category
  'getHematologyData': {
    gridType: 'medical-category',
    title: 'Hematology Data',
    category: 'hematology'
  },
  'addHematologyRecord': {
    gridType: 'form-input',
    title: 'Add Hematology Record',
    category: 'hematology'
  },
  'updateHematologyRecord': {
    gridType: 'form-input',
    title: 'Update Hematology Record',
    category: 'hematology'
  },
  'deleteHematologyRecord': {
    gridType: 'confirmation',
    title: 'Delete Hematology Record',
    category: 'hematology'
  },

  // 23. Dermatology Category
  'getDermatologyData': {
    gridType: 'medical-category',
    title: 'Dermatology Data',
    category: 'dermatology'
  },
  'addDermatologyRecord': {
    gridType: 'form-input',
    title: 'Add Dermatology Record',
    category: 'dermatology'
  },
  'updateDermatologyRecord': {
    gridType: 'form-input',
    title: 'Update Dermatology Record',
    category: 'dermatology'
  },
  'deleteDermatologyRecord': {
    gridType: 'confirmation',
    title: 'Delete Dermatology Record',
    category: 'dermatology'
  },

  // 24. Ophthalmology Category
  'getOphthalmologyData': {
    gridType: 'medical-category',
    title: 'Ophthalmology Data',
    category: 'ophthalmology'
  },
  'addOphthalmologyRecord': {
    gridType: 'form-input',
    title: 'Add Ophthalmology Record',
    category: 'ophthalmology'
  },
  'updateOphthalmologyRecord': {
    gridType: 'form-input',
    title: 'Update Ophthalmology Record',
    category: 'ophthalmology'
  },
  'deleteOphthalmologyRecord': {
    gridType: 'confirmation',
    title: 'Delete Ophthalmology Record',
    category: 'ophthalmology'
  },

  // 25. ENT Category
  'getEntData': {
    gridType: 'medical-category',
    title: 'ENT Data',
    category: 'ent'
  },
  'addEntRecord': {
    gridType: 'form-input',
    title: 'Add ENT Record',
    category: 'ent'
  },
  'updateEntRecord': {
    gridType: 'form-input',
    title: 'Update ENT Record',
    category: 'ent'
  },
  'deleteEntRecord': {
    gridType: 'confirmation',
    title: 'Delete ENT Record',
    category: 'ent'
  },

  // 26. Urology Category
  'getUrologyData': {
    gridType: 'medical-category',
    title: 'Urology Data',
    category: 'urology'
  },
  'addUrologyRecord': {
    gridType: 'form-input',
    title: 'Add Urology Record',
    category: 'urology'
  },
  'updateUrologyRecord': {
    gridType: 'form-input',
    title: 'Update Urology Record',
    category: 'urology'
  },
  'deleteUrologyRecord': {
    gridType: 'confirmation',
    title: 'Delete Urology Record',
    category: 'urology'
  },

  // 27. OB/GYN Category
  'getObgynData': {
    gridType: 'medical-category',
    title: 'OB/GYN Data',
    category: 'obgyn'
  },
  'addObgynRecord': {
    gridType: 'form-input',
    title: 'Add OB/GYN Record',
    category: 'obgyn'
  },
  'updateObgynRecord': {
    gridType: 'form-input',
    title: 'Update OB/GYN Record',
    category: 'obgyn'
  },
  'deleteObgynRecord': {
    gridType: 'confirmation',
    title: 'Delete OB/GYN Record',
    category: 'obgyn'
  },

  // 28. Emergency Medicine Category
  'getEmergencyData': {
    gridType: 'medical-category',
    title: 'Emergency Medicine Data',
    category: 'emergency'
  },
  'addEmergencyRecord': {
    gridType: 'form-input',
    title: 'Add Emergency Record',
    category: 'emergency'
  },
  'updateEmergencyRecord': {
    gridType: 'form-input',
    title: 'Update Emergency Record',
    category: 'emergency'
  },
  'deleteEmergencyRecord': {
    gridType: 'confirmation',
    title: 'Delete Emergency Record',
    category: 'emergency'
  },

  // 29. Rehabilitation Category
  'getRehabilitationData': {
    gridType: 'medical-category',
    title: 'Rehabilitation Data',
    category: 'rehabilitation'
  },
  'addRehabilitationRecord': {
    gridType: 'form-input',
    title: 'Add Rehabilitation Record',
    category: 'rehabilitation'
  },
  'updateRehabilitationRecord': {
    gridType: 'form-input',
    title: 'Update Rehabilitation Record',
    category: 'rehabilitation'
  },
  'deleteRehabilitationRecord': {
    gridType: 'confirmation',
    title: 'Delete Rehabilitation Record',
    category: 'rehabilitation'
  },

  // 30. Medical Genetics Category
  'getGeneticsData': {
    gridType: 'medical-category',
    title: 'Medical Genetics Data',
    category: 'genetics'
  },
  'addGeneticsRecord': {
    gridType: 'form-input',
    title: 'Add Genetics Record',
    category: 'genetics'
  },
  'updateGeneticsRecord': {
    gridType: 'form-input',
    title: 'Update Genetics Record',
    category: 'genetics'
  },
  'deleteGeneticsRecord': {
    gridType: 'confirmation',
    title: 'Delete Genetics Record',
    category: 'genetics'
  },

  // 31. Infectious Disease Category
  'getInfectiousData': {
    gridType: 'medical-category',
    title: 'Infectious Disease Data',
    category: 'infectious'
  },
  'addInfectiousRecord': {
    gridType: 'form-input',
    title: 'Add Infectious Disease Record',
    category: 'infectious'
  },
  'updateInfectiousRecord': {
    gridType: 'form-input',
    title: 'Update Infectious Disease Record',
    category: 'infectious'
  },
  'deleteInfectiousRecord': {
    gridType: 'confirmation',
    title: 'Delete Infectious Disease Record',
    category: 'infectious'
  },

  // 32. Anesthesiology Category
  'getAnesthesiologyData': {
    gridType: 'medical-category',
    title: 'Anesthesiology Data',
    category: 'anesthesiology'
  },
  'addAnesthesiologyRecord': {
    gridType: 'form-input',
    title: 'Add Anesthesiology Record',
    category: 'anesthesiology'
  },
  'updateAnesthesiologyRecord': {
    gridType: 'form-input',
    title: 'Update Anesthesiology Record',
    category: 'anesthesiology'
  },
  'deleteAnesthesiologyRecord': {
    gridType: 'confirmation',
    title: 'Delete Anesthesiology Record',
    category: 'anesthesiology'
  },

  // 33. Preventive Medicine Category
  'getPreventiveData': {
    gridType: 'medical-category',
    title: 'Preventive Medicine Data',
    category: 'preventive'
  },
  'addPreventiveRecord': {
    gridType: 'form-input',
    title: 'Add Preventive Medicine Record',
    category: 'preventive'
  },
  'updatePreventiveRecord': {
    gridType: 'form-input',
    title: 'Update Preventive Medicine Record',
    category: 'preventive'
  },
  'deletePreventiveRecord': {
    gridType: 'confirmation',
    title: 'Delete Preventive Medicine Record',
    category: 'preventive'
  }
};

// Merge medical grid mappings with custom mappings (medical mappings take priority)
module.exports = {
  ...gridMappings,
  ...medicalGridMappings
};