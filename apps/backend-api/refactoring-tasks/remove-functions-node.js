#!/usr/bin/env node
/**
 * Use Node.js to properly parse JavaScript and find function boundaries
 */

const fs = require('fs');

const FUNCTIONS_TO_REMOVE = [
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
];

function findFunctionEnd(lines, startLine) {
  let braceCount = 0;
  let inString = false;
  let stringChar = null;
  let inRegex = false;
  let inTemplate = false;
  let templateDepth = 0;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const prevChar = j > 0 ? line[j-1] : '';
      const nextChar = j < line.length - 1 ? line[j+1] : '';

      // Handle template literals
      if (char === '`' && prevChar !== '\\') {
        if (!inString) {
          inTemplate = !inTemplate;
        }
      }

      // Handle template expression ${}
      if (inTemplate && char === '{' && prevChar === '$') {
        templateDepth++;
        continue;
      }
      if (inTemplate && char === '}' && templateDepth > 0) {
        templateDepth--;
        continue;
      }

      // Handle string literals
      if ((char === '"' || char === "'") && prevChar !== '\\' && !inTemplate) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = null;
        }
      }

      // Count braces only outside strings and template expressions
      if (!inString && templateDepth === 0) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            return i + 1; // Return line after closing brace
          }
        }
      }
    }
  }

  return null;
}

function removeFunction(inputFile, outputFile) {
  const content = fs.readFileSync(inputFile, 'utf8');
  const lines = content.split('\n');

  const linesToRemove = new Set();
  const removed = [];

  for (const funcName of FUNCTIONS_TO_REMOVE) {
    const pattern = new RegExp(`^  async ${funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(`);

    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        const endLine = findFunctionEnd(lines, i);

        if (endLine) {
          const lineCount = endLine - i;

          // SAFETY: Only remove functions that are reasonable size (<1000 lines)
          // Large functions likely indicate a bug in brace counting
          if (lineCount < 1000) {
            for (let j = i; j < endLine; j++) {
              linesToRemove.add(j);
            }

            removed.push({
              name: funcName,
              start: i + 1,
              end: endLine,
              lines: lineCount
            });

            console.log(`✓ Found ${funcName} at lines ${i + 1}-${endLine} (${lineCount} lines)`);
          } else {
            console.log(`⚠️  Found ${funcName} at lines ${i + 1}-${endLine} (${lineCount} lines) - TOO LARGE, SKIPPING`);
          }
        } else {
          console.log(`⚠️  Found ${funcName} at line ${i + 1} but couldn't find end`);
        }

        break;
      }
    }
  }

  // Create new content
  const newLines = lines.filter((_, i) => !linesToRemove.has(i));
  fs.writeFileSync(outputFile, newLines.join('\n'));

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY:');
  console.log('='.repeat(70));
  console.log(`Original file size: ${lines.length} lines`);
  console.log(`Functions found: ${removed.length} / ${FUNCTIONS_TO_REMOVE.length}`);
  console.log(`Lines removed: ${lines.length - newLines.length}`);
  console.log(`New file size: ${newLines.length} lines`);
  console.log(`Reduction: ${((lines.length - newLines.length) / lines.length * 100).toFixed(1)}%`);

  const foundNames = new Set(removed.map(r => r.name));
  const missing = FUNCTIONS_TO_REMOVE.filter(name => !foundNames.has(name));

  if (missing.length > 0) {
    console.log('\n⚠️  Functions not found (may already be removed or delegate):');
    missing.forEach(name => console.log(`  - ${name}`));
  }
}

// Run
const inputFile = 'services/agentServiceV4-WORKING-COPY.js';
const outputFile = 'services/agentServiceV4-CLEANED.js';

console.log('🔄 Removing extracted function implementations from agentServiceV4-WORKING-COPY.js\n');

try {
  removeFunction(inputFile, outputFile);
  console.log('\n✅ Cleanup complete!');
  console.log(`📄 Output written to: ${outputFile}`);
  console.log('\nNext steps:');
  console.log(`  1. Test syntax: node -c ${outputFile}`);
  console.log(`  2. If valid: cp ${outputFile} services/agentServiceV4.js`);
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
