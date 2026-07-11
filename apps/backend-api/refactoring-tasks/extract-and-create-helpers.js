#!/usr/bin/env node
/**
 * Extract helper functions from agentServiceV4-PHASE4-WORKING-COPY.js
 * and create new service files for them
 */

const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

// Helper function categorization
const HELPER_CATEGORIES = {
  utilityHelpers: [
    'normalizePracticeContext', 'createSecureContext', 'cleanUndefinedProperties',
    'detectLanguage', 'detectClinicCountry', 'formatDate', 'convertFieldName',
    'getFieldData', 'calculateAge', 'formatFileSize', 'estimateTokens',
    'calculateCost', 'parseCSVLine', 'suggestUserFieldMappings', 'formatFunctionResult'
  ],
  aiHelpers: [
    'getEssentialFunctions', 'getMinimalFunctionsForClaude', 'simplifyParameters',
    'getShortDescription', 'getAllPlatformFunctions', 'getCompleteSystemInstruction',
    'updateSessionContext', 'getFunctionGroups', 'categorizeFunctionName', 'getSubcategory'
  ],
  medicalHelpers: [
    'detectMedicalIntent', 'parseSearchCriteria', 'detectSearchMode',
    'getConditionCollectionName', 'isSensitiveFunction', 'isCriticalFunction',
    'getCategoryIcon', 'getServiceByName'
  ],
  allergyHelpers: [
    'groupAllergies', 'generateAllergiesAlerts', 'generateAllergiesSummary',
    'generateAllergiesMessage', 'categorizeAllergyType', 'parseReactionTypes',
    'getSeverityScore', 'checkMedicationAllergyConflicts', 'getCrossReactiveAllergens',
    'generateAllergyAlerts', 'generateAllergyCard', 'generateAllergyMessage'
  ],
  medicationHelpers: [
    'formatMedicationDisplay', 'generateMedicationSummary', 'generateMedicationMessage'
  ],
  documentHelpers: [
    'generateDocumentSummary', 'generateDocumentMessage', 'classifyDocumentType',
    'assessMedicalRelevance', 'assessTextQuality', 'assessDataCompleteness',
    'hasStructuredData', 'generateAnalysisRecommendations', 'generateAnalysisSummary',
    'hasVisualization', 'getDisplayType'
  ],
  chatHelpers: [
    'generateSessionTopic', 'determinePriority', 'generateSessionSummary',
    'generateChatSessionMessage', 'calculateSessionDuration', 'determineSessionStatus',
    'highlightSearchTerms', 'categorizeSessionTopic', 'groupSessionsByTime',
    'generateSearchAnalytics', 'generateSearchSummary'
  ],
  searchHelpers: [
    'getSearchTimeRange', 'getMostCommonValue', 'generateSearchMessage'
  ],
  userHelpers: [
    'generateRolePermissions', 'generateWelcomeMessage', 'generateUserSummary',
    'generateUserNextSteps', 'generateCreateUserMessage', 'generateRoleChangeSummary',
    'generateRoleUpdateMessage', 'comparePermissions', 'doesRoleChangeRequireTraining'
  ],
  accessHelpers: [
    'getAccessChanges'
  ],
  vaccinationHelpers: [
    'calculateTimeSinceVaccination', 'checkBoosterNeeded', 'determineVaccinationStatus',
    'groupVaccinations', 'analyzeVaccinationSchedule', 'getRequiredVaccinesForAge',
    'generateVaccinationRecommendations', 'getVaccinePriority', 'generateVaccinationAlerts',
    'generateVaccinationSummary', 'generateVaccinationsMessage', 'validateVaccineForAge',
    'hasHighRiskConditions', 'getVaccineSeriesInfo', 'calculateNextDoseDate',
    'generateVaccinationCard', 'generateVaccinationReminders', 'generateVaccinationMessage'
  ],
  reportHelpers: [
    'calculateCorrelation', 'interpretCorrelation', 'generateExecutiveReport',
    'generateDetailedReport', 'getTopPerformingChannel', 'generateNextSteps',
    'generateVerificationCode'
  ]
};

function extractHelpers(inputFile) {
  console.log('🔄 Reading working copy...');
  const code = fs.readFileSync(inputFile, 'utf8');
  const lines = code.split('\n');

  console.log('🔄 Parsing JavaScript with Babel...\n');
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  // Organize extracted functions by category
  const extractedByCategory = {};
  Object.keys(HELPER_CATEGORIES).forEach(category => {
    extractedByCategory[category] = [];
  });

  // Find all helper methods
  traverse(ast, {
    ClassMethod(path) {
      const methodName = path.node.key.name;

      // Find which category this method belongs to
      for (const [category, methods] of Object.entries(HELPER_CATEGORIES)) {
        if (methods.includes(methodName)) {
          const start = path.node.loc.start.line - 1;
          const end = path.node.loc.end.line;

          // Extract the actual code
          const methodCode = lines.slice(start, end).join('\n');

          extractedByCategory[category].push({
            name: methodName,
            code: methodCode,
            start: start + 1,
            end: end
          });

          console.log(`✓ Found ${methodName} for ${category} (lines ${start + 1}-${end})`);
          break;
        }
      }
    }
  });

  return extractedByCategory;
}

function createServiceFile(category, functions) {
  const className = category.charAt(0).toUpperCase() + category.slice(1);

  let serviceCode = `/**
 * ${className} - Extracted helper functions from agentServiceV4
 * Auto-generated on ${new Date().toISOString()}
 */

class ${className} {
`;

  // Add all extracted functions
  functions.forEach(func => {
    serviceCode += '\n  ' + func.code.split('\n').join('\n  ') + '\n';
  });

  serviceCode += `}

module.exports = ${className};
`;

  return serviceCode;
}

// Run extraction
const inputFile = 'services/agentServiceV4-PHASE4-WORKING-COPY.js';
const outputDir = 'services/helpers';

console.log('🚀 Phase 4: Extract Helper Functions and Create Service Files\n');

try {
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`✓ Created directory: ${outputDir}\n`);
  }

  // Extract all helpers
  const extractedByCategory = extractHelpers(inputFile);

  // Create service files
  console.log('\n' + '='.repeat(70));
  console.log('CREATING SERVICE FILES:');
  console.log('='.repeat(70));

  let totalFunctions = 0;
  for (const [category, functions] of Object.entries(extractedByCategory)) {
    if (functions.length > 0) {
      const serviceCode = createServiceFile(category, functions);
      const outputFile = `${outputDir}/${category}.js`;
      fs.writeFileSync(outputFile, serviceCode);

      totalFunctions += functions.length;
      console.log(`✓ Created ${outputFile} with ${functions.length} functions`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY:');
  console.log('='.repeat(70));
  console.log(`Total helper functions extracted: ${totalFunctions}`);
  console.log(`Service files created: ${Object.values(extractedByCategory).filter(f => f.length > 0).length}`);
  console.log(`Output directory: ${outputDir}`);

  console.log('\n✅ Helper service files created!');
  console.log('\nNext steps:');
  console.log('  1. Test syntax: for f in services/helpers/*.js; do node -c "$f"; done');
  console.log('  2. Run remove script to clean WORKING-COPY');
  console.log('  3. Verify cleaned file syntax');
  console.log('  4. Copy to original if all tests pass');

} catch (err) {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
}
