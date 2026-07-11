#!/usr/bin/env node
/**
 * AST-based function removal using Babel parser
 * This properly handles all JavaScript syntax including template literals
 */

const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const FUNCTIONS_TO_REMOVE = [
  // Phase 1 - Already extracted
  'searchPatients', 'searchPatientsByName', 'findPatient', 'listAllPatients',
  'getPatientDetails', 'updatePatient', 'addPatient', 'deletePatientBySearch',
  'importPatientsFromCSV', 'getPatientsNeedingFollowUp', 'getPatientFollowUpDetails',
  'scheduleFollowUp', 'updateFollowUpStatus', 'deleteFollowUp', 'getPatientsForFollowUp',
  'addPatientCondition', 'updatePatientCondition', 'getPatientConditions',
  'getConditionStatistics', 'getPatientsList', 'addMedicalHistory',
  'updateMedicalHistory', 'deleteMedicalHistory', 'getPatientEngagementInsights',
  'anonymizePatientData', 'getPatientConsents', 'assignDocumentToPatient',
  'checkPatientsForAllergies', 'generatePatientReport',
  'scheduleAppointment', 'rescheduleAppointment', 'cancelAppointment',
  'updateAppointment', 'createAppointment', 'findAvailableSlots',
  'getProviderAppointments', 'sendAppointmentConfirmationRequest',
  'processUploadedDocuments', 'getDocuments', 'searchDocuments',
  'deleteDocument', 'retrievePendingUpload', 'analyzePendingDocument',
  'batchAnalyzeDocuments', 'uploadImagingResult',
  'addMedication', 'getMedications', 'checkDrugInteractions',
  'checkDrugAllergy', 'checkDrugSafety', 'sendMedicationRefillReminders',
  'createPrescription', 'getPrescriptions',
  'addLabResult', 'getLabResults', 'interpretLabResults', 'parseLabResults',
  'orderLabTest', 'addImagingResult', 'getImagingResults', 'orderImaging',
  'addVitalSigns', 'getVitalSigns', 'recordVitalSigns', 'addVaccination',
  'getVaccinations', 'getProviderAvailability', 'setProviderAvailability',
  'addProviderLicense', 'updateProviderLicense', 'removeProviderLicense',
  'getProviderLicense', 'checkProviderStatus', 'getProviders',
  'searchProviders', 'getProviderByNPI', 'setupUserAsProvider',
  'setupMultipleProviders', 'blockProviderTime', 'getProviderMeetings',
  'updateProviderSettings',
  'createUser', 'deleteUser', 'getUserDetails', 'getAllUsers',
  'searchUsers', 'addUserRole', 'removeUserRole', 'assignRole',
  'bulkUpdateRoles', 'getRoles', 'getUserPermissions',
  'updateUserPermissions', 'deactivateUser', 'resendEmailVerification',
  'importUsersFromCSV',
  'createClinic', 'updateClinic', 'getAllClinics', 'getClinicInfo',
  'updateClinicSettings', 'discoverPractice', 'getClinicStatistics',
  'getClinicUsage', 'generateClinicReport', 'getClinicPermissions',
  'rotateClinicToken', 'validateClinicToken', 'getClinicAddress',
  'sendTestResultNotifications',

  // Phase 2 - AI/ML, Calendar, Campaign, Healthcare Ops
  'analyzeSymptoms', 'getDifferentialDiagnosis', 'recommendTreatment',
  'recommendTests', 'analyzeVitalSigns', 'getAIClinicalInsights', 'setupAIContext',
  'scheduleProviderMeeting', 'enableCalendarSync', 'disableCalendarSync',
  'getCalendarSyncStatus', 'syncWithGoogleCalendar', 'checkCalendarConflicts',
  'getProviderSchedule', 'sendCalendarSyncEmail', 'setProviderBusyTime',
  'cancelProviderBusyTime', 'showProviderBusyTimes',
  'createHealthCampaign', 'startHealthCampaign', 'pauseHealthCampaign',
  'resumeHealthCampaign', 'getCampaignAnalytics', 'getCommunicationAnalytics',
  'getChannelPerformance', 'generateCommunicationReport',
  'createReferral', 'getReferrals', 'verifyInsurance', 'submitInsuranceClaim',
  'updatePatientCriticalAlerts', 'getPatientAllergies', 'getAllergies', 'addAllergy',

  // Phase 3 - Move to existing services + new services
  // To patientService:
  'deletePatientInternal', 'countPatients', 'getPatientMedications',
  // To appointmentService:
  'getAppointmentDetails', 'suggestAlternativeSlots',
  // To providerService:
  'lookupProvider', 'removeProviderInfo',
  // To documentService:
  'uploadDocument', 'analyzeDocument', 'saveExtractedDocumentData',
  // To communicationService:
  'createChatSession', 'searchChatHistory', 'processMessage',
  // To NEW consentPrivacyService:
  'recordConsent', 'updateConsent', 'revokeConsent', 'checkConsentStatus',
  'exportAnonymizedData', 'reIdentifyData', 'getVendorList', 'assessVendorRisk',
  'addBusinessAssociate',
  // To NEW systemAdminService:
  'generateComplianceReport', 'runBackup', 'getSystemHealth', 'exportAuditLogs',
  // To NEW displayService:
  'listPatientMedicalCategories', 'openArtifactPanelWithCategory',
];

function removeFunctions(inputFile, outputFile) {
  console.log('🔄 Reading file...');
  const code = fs.readFileSync(inputFile, 'utf8');
  const lines = code.split('\n');

  console.log('🔄 Parsing JavaScript with Babel...');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
  } catch (err) {
    console.error('❌ Failed to parse JavaScript:', err.message);
    process.exit(1);
  }

  const functionsToRemove = [];
  const functionLocations = new Set(FUNCTIONS_TO_REMOVE);

  console.log('🔄 Finding functions to remove...\n');

  // Traverse AST and find ClassMethod nodes (methods in a class)
  traverse(ast, {
    ClassMethod(path) {
      const methodName = path.node.key.name;

      if (functionLocations.has(methodName) && path.node.async) {
        const start = path.node.loc.start.line - 1; // 0-indexed
        const end = path.node.loc.end.line; // Exclusive

        functionsToRemove.push({
          name: methodName,
          start: start,
          end: end,
          lines: end - start
        });

        console.log(`✓ Found ${methodName} at lines ${start + 1}-${end} (${end - start} lines)`);
      }
    }
  });

  // Create set of line numbers to remove
  const linesToRemove = new Set();
  for (const func of functionsToRemove) {
    for (let i = func.start; i < func.end; i++) {
      linesToRemove.add(i);
    }
  }

  // Filter out removed lines
  const newLines = lines.filter((_, i) => !linesToRemove.has(i));

  // Write output
  fs.writeFileSync(outputFile, newLines.join('\n'));

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY:');
  console.log('='.repeat(70));
  console.log(`Original file size: ${lines.length} lines`);
  console.log(`Functions found: ${functionsToRemove.length} / ${FUNCTIONS_TO_REMOVE.length}`);
  console.log(`Lines removed: ${lines.length - newLines.length}`);
  console.log(`New file size: ${newLines.length} lines`);
  console.log(`Reduction: ${((lines.length - newLines.length) / lines.length * 100).toFixed(1)}%`);

  const foundNames = new Set(functionsToRemove.map(f => f.name));
  const missing = FUNCTIONS_TO_REMOVE.filter(name => !foundNames.has(name));

  if (missing.length > 0) {
    console.log('\n⚠️  Functions not found (may already be removed or delegate):');
    missing.forEach(name => console.log(`  - ${name}`));
  }

  return functionsToRemove;
}

// Run
const inputFile = 'services/agentServiceV4-WORKING-COPY.js';
const outputFile = 'services/agentServiceV4-CLEANED.js';

console.log('🚀 AST-based Function Removal\n');
console.log('Using Babel parser for accurate JavaScript parsing');
console.log('This properly handles template literals and all JS syntax\n');

try {
  const removed = removeFunctions(inputFile, outputFile);

  console.log('\n✅ Cleanup complete!');
  console.log(`📄 Output written to: ${outputFile}`);
  console.log('\nNext steps:');
  console.log(`  1. Test syntax: node -c ${outputFile}`);
  console.log(`  2. If valid: cp ${outputFile} services/agentServiceV4.js`);
  console.log(`  3. Commit and push changes`);
} catch (err) {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
}
