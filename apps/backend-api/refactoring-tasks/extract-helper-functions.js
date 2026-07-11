#!/usr/bin/env node
/**
 * Extract helper functions (non-async class methods) from agentServiceV4.js
 */

const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const HELPERS_TO_REMOVE = [
  // Keep constructor
  // 'constructor',
  
  // utilityHelpers
  'normalizePracticeContext', 'createSecureContext', 'cleanUndefinedProperties',
  'detectLanguage', 'detectClinicCountry', 'formatDate', 'convertFieldName',
  'getFieldData', 'calculateAge', 'formatFileSize', 'estimateTokens',
  'calculateCost', 'parseCSVLine', 'suggestUserFieldMappings', 'formatFunctionResult',
  
  // aiHelpers
  'getEssentialFunctions', 'getMinimalFunctionsForClaude', 'simplifyParameters',
  'getShortDescription', 'getAllPlatformFunctions', 'getCompleteSystemInstruction',
  'updateSessionContext', 'getFunctionGroups', 'categorizeFunctionName', 'getSubcategory',
  
  // medicalHelpers
  'detectMedicalIntent', 'parseSearchCriteria', 'detectSearchMode',
  'getConditionCollectionName', 'isSensitiveFunction', 'isCriticalFunction',
  'getCategoryIcon', 'getServiceByName',
  
  // allergyHelpers
  'groupAllergies', 'generateAllergiesAlerts', 'generateAllergiesSummary',
  'generateAllergiesMessage', 'categorizeAllergyType', 'parseReactionTypes',
  'getSeverityScore', 'checkMedicationAllergyConflicts', 'getCrossReactiveAllergens',
  'generateAllergyAlerts', 'generateAllergyCard', 'generateAllergyMessage',
  
  // medicationHelpers
  'formatMedicationDisplay', 'generateMedicationSummary', 'generateMedicationMessage',
  
  // documentHelpers
  'generateDocumentSummary', 'generateDocumentMessage', 'classifyDocumentType',
  'assessMedicalRelevance', 'assessTextQuality', 'assessDataCompleteness',
  'hasStructuredData', 'generateAnalysisRecommendations', 'generateAnalysisSummary',
  'hasVisualization', 'getDisplayType',
  
  // chatHelpers
  'generateSessionTopic', 'determinePriority', 'generateSessionSummary',
  'generateChatSessionMessage', 'calculateSessionDuration', 'determineSessionStatus',
  'highlightSearchTerms', 'categorizeSessionTopic', 'groupSessionsByTime',
  'generateSearchAnalytics', 'generateSearchSummary',
  
  // searchHelpers
  'getSearchTimeRange', 'getMostCommonValue', 'generateSearchMessage',
  
  // userHelpers
  'generateRolePermissions', 'generateWelcomeMessage', 'generateUserSummary',
  'generateUserNextSteps', 'generateCreateUserMessage', 'generateRoleChangeSummary',
  'generateRoleUpdateMessage', 'comparePermissions', 'doesRoleChangeRequireTraining',
  
  // accessHelpers
  'getAccessChanges',
  
  // vaccinationHelpers
  'calculateTimeSinceVaccination', 'checkBoosterNeeded', 'determineVaccinationStatus',
  'groupVaccinations', 'analyzeVaccinationSchedule', 'getRequiredVaccinesForAge',
  'generateVaccinationRecommendations', 'getVaccinePriority', 'generateVaccinationAlerts',
  'generateVaccinationSummary', 'generateVaccinationsMessage', 'validateVaccineForAge',
  'hasHighRiskConditions', 'getVaccineSeriesInfo', 'calculateNextDoseDate',
  'generateVaccinationCard', 'generateVaccinationReminders',
  
  // reportHelpers
  'calculateCorrelation', 'interpretCorrelation', 'generateExecutiveReport',
  'generateDetailedReport', 'getTopPerformingChannel', 'generateNextSteps',
  'generateVerificationCode', 'generateVaccinationMessage'
];

function extractHelpers(inputFile, outputFile) {
  console.log('🔄 Reading file...');
  const code = fs.readFileSync(inputFile, 'utf8');
  const lines = code.split('\n');

  console.log('🔄 Parsing JavaScript with Babel...\n');
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  const helpersToRemove = [];
  const helperNames = new Set(HELPERS_TO_REMOVE);

  // Find all ClassMethod nodes (including non-async)
  traverse(ast, {
    ClassMethod(path) {
      const methodName = path.node.key.name;

      if (helperNames.has(methodName)) {
        const start = path.node.loc.start.line - 1;
        const end = path.node.loc.end.line;

        helpersToRemove.push({
          name: methodName,
          start: start,
          end: end,
          lines: end - start
        });

        console.log(`✓ Found ${methodName} at lines ${start + 1}-${end} (${end - start} lines)`);
      }
    }
  });

  // Create set of lines to remove
  const linesToRemove = new Set();
  for (const helper of helpersToRemove) {
    for (let i = helper.start; i < helper.end; i++) {
      linesToRemove.add(i);
    }
  }

  // Filter out removed lines
  const newLines = lines.filter((_, i) => !linesToRemove.has(i));
  fs.writeFileSync(outputFile, newLines.join('\n'));

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY:');
  console.log('='.repeat(70));
  console.log(`Original file size: ${lines.length} lines`);
  console.log(`Helper functions found: ${helpersToRemove.length} / ${HELPERS_TO_REMOVE.length}`);
  console.log(`Lines removed: ${lines.length - newLines.length}`);
  console.log(`New file size: ${newLines.length} lines`);
  console.log(`Reduction: ${((lines.length - newLines.length) / lines.length * 100).toFixed(1)}%`);

  const foundNames = new Set(helpersToRemove.map(h => h.name));
  const missing = HELPERS_TO_REMOVE.filter(name => !foundNames.has(name));

  if (missing.length > 0) {
    console.log('\n⚠️  Functions not found:');
    missing.forEach(name => console.log(`  - ${name}`));
  }

  return helpersToRemove;
}

// Run
const inputFile = 'services/agentServiceV4-PHASE4-WORKING-COPY.js';
const outputFile = 'services/agentServiceV4-PHASE4-CLEANED.js';

console.log('🚀 Phase 4: Extract Helper Functions\n');

try {
  const removed = extractHelpers(inputFile, outputFile);

  console.log('\n✅ Cleanup complete!');
  console.log(`📄 Output written to: ${outputFile}`);
  console.log('\nNext steps:');
  console.log(`  1. Test syntax: node -c ${outputFile}`);
  console.log(`  2. If valid: cp ${outputFile} services/agentServiceV4.js`);
} catch (err) {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
}
