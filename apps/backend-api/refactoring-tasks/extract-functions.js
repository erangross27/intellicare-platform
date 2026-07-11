/**
 * Function Extractor for AgentServiceV4 Refactoring
 *
 * Purpose: Automatically extract function implementations from agentServiceV4.js
 * and generate new service files.
 *
 * Usage:
 *   node extract-functions.js patientService
 *   node extract-functions.js appointmentService
 *   etc.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SOURCE_FILE = path.join(__dirname, '../services/agentServiceV4.js');
const OUTPUT_DIR = path.join(__dirname, '../services');

// Service configurations
const SERVICES = {
  patientService: {
    className: 'PatientService',
    functions: [
      'searchPatients', 'searchPatientsByName', 'findPatient',
      'listAllPatients', 'getPatientDetails', 'updatePatient', 'addPatient',
      'deletePatientBySearch', 'importPatientsFromCSV', 'batchUpdatePatients',
      'getPatientsNeedingFollowUp', 'getPatientFollowUpDetails',
      'scheduleFollowUp', 'updateFollowUpStatus', 'deleteFollowUp',
      'getPatientsForFollowUp', 'addPatientCondition', 'updatePatientCondition',
      'getPatientConditions', 'getConditionStatistics', 'getPatientsList',
      'addMedicalHistory', 'getFullMedicalReport', 'updateMedicalHistory',
      'deleteMedicalHistory', 'getMedicalDataByCategory', 'getAIInsights',
      'generatePatientReport', 'generatePatientFlowChart',
      'analyzePatientFlow', 'analyzePatientOutcomes',
      'forecastPatientVolume', 'identifyHighRiskPatients',
      'predictPatientOutcome', 'getPatientEngagementInsights',
      'monitorPatientDeteriorationRisk', 'anonymizePatientData',
      'getDeletedPatients', 'permanentlyDeletePatient', 'restorePatient',
      'checkMedicareCoverage', 'checkMedicareImportStatus',
      'getMedicareQualityRatings', 'lookupPatientBySSN',
      'searchMedicareProviders', 'startMedicareImport',
      'sendBulkPatientEmail', 'sendBulkPatientSMS',
      'sendPatientPortalMessage', 'getPatientMessageHistory',
      'reportPatientSymptoms', 'matchPatientToSpecialist',
      'matchPatientToTrials', 'getPatientConsents',
      'assignDocumentToPatient', 'generatePatientEducation',
      'schedulePatientAppointment', 'checkPatientsForAllergies'
    ],
    description: 'Handle all patient-related operations including CRUD, medical history, follow-ups, and analytics'
  },

  appointmentService: {
    className: 'AppointmentService',
    functions: [
      'scheduleAppointment', 'rescheduleAppointment', 'cancelAppointment',
      'updateAppointment', 'createAppointment', 'findAvailableSlots',
      'getAppointments', 'getTodayAppointments', 'getOverdueAppointments',
      'getProviderAppointments', 'predictAppointmentNoShows',
      'sendAppointmentConfirmationRequest', 'generateVaccinationSchedule'
    ],
    description: 'Handle all appointment-related operations including scheduling and reminders'
  },

  documentService: {
    className: 'DocumentService',
    functions: [
      'processUploadedDocuments', 'uploadImagingResult', 'retrievePendingUpload',
      'analyzePendingDocument', 'batchAnalyzeDocuments', 'getDocuments',
      'searchDocuments', 'categorizeDocument', 'deleteDocument',
      'shareEncryptedDocument', 'generateDocumentation', 'validateDocumentation',
      'assignDocumentToPatient'
    ],
    description: 'Handle all document-related operations including upload, analysis, and categorization'
  },

  prescriptionService: {
    className: 'PrescriptionService',
    functions: [
      'createPrescription', 'getPrescriptions', 'refillPrescription',
      'cancelPrescription', 'generatePrescription', 'prescribeMedication',
      'requestPrescriptionRefill', 'validatePrescription'
    ],
    description: 'Handle all prescription-related operations including creation, refills, and validation'
  },

  medicationService: {
    className: 'MedicationService',
    functions: [
      'addMedication', 'getMedications', 'checkDrugInteractions',
      'checkDrugAllergy', 'checkDrugSafety', 'checkDrugAdverseEvents',
      'calculateMedicationDosing', 'searchDrugInformation', 'searchFDADrugs',
      'sendMedicationRefillReminders', 'identifyMedicationEffectivenessTrends'
    ],
    description: 'Handle all medication-related operations including safety checks and drug interactions'
  },

  labService: {
    className: 'LabService',
    functions: [
      'addLabResult', 'getLabResults', 'interpretLabResults', 'parseLabResults',
      'orderLabTest', 'addImagingResult', 'getImagingResults', 'orderImaging',
      'addVitalSigns', 'getVitalSigns', 'recordVitalSigns', 'updateVitalSigns',
      'addVaccination', 'getVaccinations', 'setVitalAlerts', 'analyzeVitalTrends',
      'getProviderAvailability', 'setProviderAvailability', 'findResearchCollaborators'
    ],
    description: 'Handle all lab, imaging, vital signs, and vaccination operations'
  },

  providerService: {
    className: 'ProviderService',
    functions: [
      'addProviderLicense', 'updateProviderLicense', 'removeProviderLicense',
      'getProviderLicense', 'checkProviderStatus', 'getProviders',
      'searchProviders', 'getProviderByNPI', 'getProviderSpecialties',
      'setupUserAsProvider', 'setupMultipleProviders', 'blockProviderTime',
      'sendProviderMessage', 'getProviderMeetings', 'updateProviderSettings',
      'addSpecialistToNetwork'
    ],
    description: 'Handle all provider-related operations including licensing and directory management'
  },

  userService: {
    className: 'UserService',
    functions: [
      'createUser', 'deleteUser', 'getUserDetails', 'getAllUsers',
      'searchUsers', 'addUserRole', 'removeUserRole', 'assignRole',
      'bulkUpdateRoles', 'getRoles', 'getUserPermissions', 'updateUserPermissions',
      'deactivateUser', 'reactivateUser', 'suspendUser', 'updateUserProfile',
      'resetUserPassword', 'getUserActivity', 'resendEmailVerification',
      'importUsersFromCSV'
    ],
    description: 'Handle all user-related operations including authentication, roles, and permissions'
  },

  clinicService: {
    className: 'ClinicService',
    functions: [
      'createClinic', 'updateClinic', 'getAllClinics', 'getClinicInfo',
      'updateClinicSettings', 'discoverPractice', 'getClinicStatistics',
      'getClinicUsage', 'generateClinicReport', 'getClinicPermissions',
      'rotateClinicToken', 'validateClinicToken', 'lookupClinicalGuidelines',
      'searchClinicalTrials', 'generateClinicalInsights', 'createClinicalTrendChart',
      'predictClinicalDeterioration', 'getClinicAddress'
    ],
    description: 'Handle all clinic-related operations including settings, statistics, and clinical guidelines'
  },

  communicationService: {
    className: 'CommunicationService',
    functions: [
      'sendEmail', 'sendSMS', 'sendChatMessage', 'sendTestResultNotifications'
    ],
    description: 'Orchestrate communication operations (delegates to external APIs)'
  }
};

/**
 * Extract a function's implementation from source file
 * @param {string} functionName - Name of the function to extract
 * @param {string} sourceCode - Full source code
 * @returns {string} Function implementation
 */
function extractFunctionImplementation(functionName, sourceCode) {
  // Find the function declaration
  const funcPattern = new RegExp(`async\\s+${functionName}\\s*\\([^)]*\\)\\s*{`, 'g');
  const match = funcPattern.exec(sourceCode);

  if (!match) {
    console.warn(`⚠️  Function ${functionName} not found`);
    return null;
  }

  const startIndex = match.index;

  // Find matching closing brace
  let braceCount = 0;
  let inFunction = false;
  let endIndex = startIndex;

  for (let i = startIndex; i < sourceCode.length; i++) {
    if (sourceCode[i] === '{') {
      braceCount++;
      inFunction = true;
    } else if (sourceCode[i] === '}') {
      braceCount--;
      if (inFunction && braceCount === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }

  return sourceCode.substring(startIndex, endIndex);
}

/**
 * Generate service file from template
 * @param {string} serviceName - Name of the service
 * @param {Object} config - Service configuration
 * @param {Array<string>} implementations - Function implementations
 */
function generateServiceFile(serviceName, config, implementations) {
  const template = `/**
 * ${config.className}
 *
 * Domain: ${serviceName.replace('Service', '')}
 * Extracted from: agentServiceV4.js
 * Functions: ${config.functions.length}
 *
 * Purpose: ${config.description}
 *
 * Architecture:
 * - Uses SecureDataAccess for all database operations (no HTTP calls)
 * - Practice-aware multi-tenant isolation
 * - Proper error handling and logging
 * - Service authentication via ServiceAccountManager
 */

const SecureDataAccess = require('../middleware/SecureDataAccess');
const ServiceAccountManager = require('./serviceAccountManager');
const { ObjectId } = require('mongodb');

class ${config.className} {
  constructor() {
    this.serviceName = '${serviceName}';
    this.serviceAuth = null;
  }

  /**
   * Initialize service with authentication
   */
  async initialize() {
    if (!this.serviceAuth) {
      const serviceAccountManager = new ServiceAccountManager();
      this.serviceAuth = await serviceAccountManager.authenticate(this.serviceName);
      console.log(\`✅ \${this.serviceName} authenticated successfully\`);
    }
    return this.serviceAuth;
  }

  /**
   * Create secure context for database operations
   * @param {Object} practiceContext - Practice context from request
   * @param {string} operation - Operation name
   * @returns {Object} Security context
   */
  createSecureContext(practiceContext, operation) {
    return {
      serviceId: this.serviceName,
      operation: operation,
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId || practiceContext?.id || 'global',
      apiKey: this.serviceAuth?.apiKey || this.serviceAuth
    };
  }

  /**
   * Normalize practice context to ensure consistent format
   * @param {Object} practiceContext - Raw practice context
   * @returns {Object} Normalized practice context
   */
  normalizePracticeContext(practiceContext) {
    if (!practiceContext) {
      return { id: 'global', subdomain: 'global' };
    }

    return {
      id: practiceContext.practiceId || practiceContext.id || 'global',
      subdomain: practiceContext.subdomain || practiceContext.practiceSubdomain || 'global',
      name: practiceContext.name || practiceContext.practiceName,
      language: practiceContext.language || 'en'
    };
  }

  // ============================================================================
  // SERVICE FUNCTIONS - EXTRACTED FROM agentServiceV4.js
  // ============================================================================

${implementations.join('\n\n')}

}

module.exports = new ${config.className}();
`;

  return template;
}

/**
 * Main extraction function
 * @param {string} serviceName - Name of the service to extract
 */
async function extractService(serviceName) {
  console.log(`\n🔄 Extracting ${serviceName}...\n`);

  const config = SERVICES[serviceName];
  if (!config) {
    console.error(`❌ Unknown service: ${serviceName}`);
    console.log(`Available services: ${Object.keys(SERVICES).join(', ')}`);
    process.exit(1);
  }

  // Read source file
  const sourceCode = fs.readFileSync(SOURCE_FILE, 'utf8');

  // Extract all function implementations
  const implementations = [];
  let found = 0;
  let missing = 0;

  for (const funcName of config.functions) {
    console.log(`  📝 Extracting ${funcName}...`);
    const impl = extractFunctionImplementation(funcName, sourceCode);

    if (impl) {
      implementations.push(impl);
      found++;
    } else {
      missing++;
    }
  }

  console.log(`\n✅ Extracted ${found} functions`);
  if (missing > 0) {
    console.log(`⚠️  ${missing} functions not found (may already be delegating to other services)`);
  }

  // Generate service file
  const serviceContent = generateServiceFile(serviceName, config, implementations);

  // Write to output file
  const outputPath = path.join(OUTPUT_DIR, `${serviceName}.js`);
  fs.writeFileSync(outputPath, serviceContent);

  console.log(`\n💾 Created: ${outputPath}`);
  console.log(`📊 Size: ${(serviceContent.length / 1024).toFixed(1)} KB`);
  console.log(`\n✨ Extraction complete!\n`);
}

// Run extraction
const serviceName = process.argv[2];
if (!serviceName) {
  console.log('Usage: node extract-functions.js <serviceName>');
  console.log('\nAvailable services:');
  Object.keys(SERVICES).forEach(name => {
    console.log(`  - ${name} (${SERVICES[name].functions.length} functions)`);
  });
  process.exit(1);
}

extractService(serviceName);
