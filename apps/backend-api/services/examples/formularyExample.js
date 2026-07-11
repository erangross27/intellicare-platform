/**
 * Example: Using CMS Formulary API for Medication Coverage Lookup
 *
 * This example demonstrates how to use the new formulary service
 * to check medication coverage using the CMS QHP Formulary API standard.
 *
 * IMPORTANT: This will be available starting January 1, 2027 when
 * insurance companies are mandated to provide formulary data.
 *
 * Until then, use the existing hardcoded coverage rules in insuranceService.checkCoverage()
 */

const formularyService = require('../formularyService');
const insuranceService = require('../insuranceService');

// ============================================================================
// EXAMPLE 1: Configure Formulary URLs for an Insurance Company
// ============================================================================

async function configureFormularyURLs() {
  console.log('=== Example 1: Configure Formulary URLs ===\n');

  // Practice administrators would configure these URLs in the database
  // For now, we set them directly (in production, these would be in Practice settings)

  formularyService.setFormularyUrls('aetna', {
    index: 'https://aetna.com/formulary/index.json',
    drugs: 'https://aetna.com/formulary/drugs.json',
    plans: 'https://aetna.com/formulary/plans.json'
  });

  formularyService.setFormularyUrls('bluecross', {
    index: 'https://bcbs.com/formulary/index.json',
    drugs: 'https://bcbs.com/formulary/drugs.json',
    plans: 'https://bcbs.com/formulary/plans.json'
  });

  console.log('Configured insurers:', formularyService.getConfiguredInsurers());
  console.log('');
}

// ============================================================================
// EXAMPLE 2: Lookup Medication by RxCUI (Preferred Method - Exact Match)
// ============================================================================

async function lookupByRxCUI() {
  console.log('=== Example 2: Lookup by RxCUI (Exact Match) ===\n');

  try {
    const result = await insuranceService.checkMedicationCoverageAPI({
      insuranceCompany: 'aetna',
      rxcui: '209459', // Acetaminophen 500 MG
      planId: 'AETNA-GOLD-2027' // Optional: specific plan
    });

    console.log('Coverage Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    if (result.covered) {
      console.log(`✅ ${result.medication} is covered!`);
      console.log(`   Tier: ${result.plans[0].tier}`);
      console.log(`   Prior Auth Required: ${result.plans[0].priorAuthorization ? 'Yes' : 'No'}`);
      console.log(`   Step Therapy: ${result.plans[0].stepTherapy ? 'Yes' : 'No'}`);
      console.log(`   Quantity Limit: ${result.plans[0].quantityLimit ? 'Yes' : 'No'}`);
      if (result.plans[0].costSharing) {
        console.log(`   Copay: $${result.plans[0].costSharing.copay}`);
      }
    } else if (result.error === 'FORMULARY_NOT_CONFIGURED') {
      console.log(`⏳ ${result.message}`);
      console.log(`   Fallback: ${result.fallback}`);
    } else {
      console.log(`❌ ${result.medication} is not covered`);
      console.log(`   Reason: ${result.reason}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('');
}

// ============================================================================
// EXAMPLE 3: Lookup Medication by Name (Fuzzy Match - May Return Multiple)
// ============================================================================

async function lookupByName() {
  console.log('=== Example 3: Lookup by Name (Fuzzy Match) ===\n');

  try {
    const result = await insuranceService.checkMedicationCoverageAPI({
      insuranceCompany: 'bluecross',
      medication: 'metformin' // Search by name
    });

    console.log('Coverage Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    if (result.multipleMatches) {
      console.log(`🔍 Multiple matches found for "${result.searchTerm}":`);
      result.results.forEach((drug, idx) => {
        console.log(`   ${idx + 1}. ${drug.drugName} (RxCUI: ${drug.rxcui})`);
        console.log(`      Covered: ${drug.covered ? 'Yes' : 'No'}`);
        if (drug.covered) {
          console.log(`      Tier: ${drug.plans[0].tier}`);
        }
      });
      console.log('   Tip: Use RxCUI for exact match!');
    } else if (result.covered) {
      console.log(`✅ ${result.medication} is covered!`);
    } else {
      console.log(`❌ Not covered: ${result.reason}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('');
}

// ============================================================================
// EXAMPLE 4: Compare Old (Hardcoded) vs New (API) Methods
// ============================================================================

async function compareOldAndNew() {
  console.log('=== Example 4: Compare Hardcoded vs API Methods ===\n');

  const medication = 'Lipitor';
  const insuranceInfo = {
    provider: 'UHC', // United Healthcare
    plan: 'Gold Plus'
  };

  // Old method: Hardcoded rules (works now)
  console.log('Old Method (Hardcoded Rules - Available Now):');
  const oldResult = await insuranceService.checkCoverage(insuranceInfo, null, medication, 'en');
  console.log(JSON.stringify(oldResult, null, 2));
  console.log('');

  // New method: CMS Formulary API (available 2027)
  console.log('New Method (CMS Formulary API - Available 2027):');
  try {
    const newResult = await insuranceService.checkMedicationCoverageAPI({
      insuranceCompany: 'uhc',
      medication: medication
    });
    console.log(JSON.stringify(newResult, null, 2));
  } catch (error) {
    console.log('API Result:', error.message);
  }

  console.log('');
  console.log('Key Differences:');
  console.log('1. Old method uses hardcoded rules → works now but limited accuracy');
  console.log('2. New method uses real insurance formulary data → accurate but available 2027');
  console.log('3. New method provides RxCUI, tier, prior auth, step therapy, quantity limits');
  console.log('4. New method is FREE (no API fees for contracted providers)');
  console.log('');
}

// ============================================================================
// EXAMPLE 5: Error Handling
// ============================================================================

async function errorHandlingExample() {
  console.log('=== Example 5: Error Handling ===\n');

  // Case 1: Insurance company not configured
  console.log('Case 1: Insurance company not configured yet');
  const result1 = await insuranceService.checkMedicationCoverageAPI({
    insuranceCompany: 'cigna', // Not configured yet
    medication: 'aspirin'
  });
  console.log(JSON.stringify(result1, null, 2));
  console.log('');

  // Case 2: Missing required parameters
  console.log('Case 2: Missing medication and RxCUI');
  try {
    const result2 = await insuranceService.checkMedicationCoverageAPI({
      insuranceCompany: 'aetna'
      // Missing both medication and rxcui
    });
    console.log(JSON.stringify(result2, null, 2));
  } catch (error) {
    console.log('Error caught:', error.message);
  }
  console.log('');

  // Case 3: Medication not in formulary
  console.log('Case 3: Medication not in formulary');
  const result3 = await insuranceService.checkMedicationCoverageAPI({
    insuranceCompany: 'aetna',
    medication: 'experimental-drug-xyz-123'
  });
  console.log(JSON.stringify(result3, null, 2));
  console.log('');
}

// ============================================================================
// EXAMPLE 6: How to Integrate with Claude Agent
// ============================================================================

async function agentIntegrationExample() {
  console.log('=== Example 6: Claude Agent Integration ===\n');

  console.log('To add this to Claude agent functions, update aiHelpers.js:');
  console.log('');
  console.log('1. Add function definition:');
  console.log(`
{
  name: "checkMedicationCoverageAPI",
  description: "Check medication coverage using insurance company's formulary API (CMS mandate, available 2027). Returns tier, copay, prior auth requirements. Prefer using RxCUI for exact match.",
  parameters: {
    type: "object",
    properties: {
      insuranceCompany: {
        type: "string",
        description: "Insurance company name (e.g., 'aetna', 'bluecross', 'uhc')"
      },
      medication: {
        type: "string",
        description: "Medication name (fuzzy match, may return multiple results)"
      },
      rxcui: {
        type: "string",
        description: "RxCUI (RXNORM identifier) for exact medication match. Preferred over medication name."
      },
      planId: {
        type: "string",
        description: "Optional specific plan ID to check"
      }
    },
    required: ["insuranceCompany"]
  }
}
  `);
  console.log('');

  console.log('2. Add routing in agentServiceV4.js:');
  console.log(`
case 'checkMedicationCoverageAPI':
  return await insuranceService.checkMedicationCoverageAPI({
    insuranceCompany: args.insuranceCompany,
    medication: args.medication,
    rxcui: args.rxcui,
    planId: args.planId
  });
  `);
  console.log('');

  console.log('3. Example Claude agent usage:');
  console.log('   User: "Is metformin covered by Aetna?"');
  console.log('   Claude: checkMedicationCoverageAPI({ insuranceCompany: "aetna", medication: "metformin" })');
  console.log('');
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

async function runAllExamples() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  CMS Formulary API Examples - IntelliCare Implementation  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');

  await configureFormularyURLs();
  await lookupByRxCUI();
  await lookupByName();
  await compareOldAndNew();
  await errorHandlingExample();
  await agentIntegrationExample();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Next Steps for Production Deployment                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('1. 📅 Monitor CMS implementation guidance (starting 2026)');
  console.log('2. 🔗 Collect formulary URLs from insurance partners');
  console.log('3. 💾 Store formulary URLs in Practice.settings.formularyUrls');
  console.log('4. 🤖 Register function in aiHelpers.js for Claude agent');
  console.log('5. 🧪 Test with sample formulary data from GitHub repo');
  console.log('6. 📊 Build admin UI for configuring formulary URLs');
  console.log('7. 🚀 Deploy when insurers comply with mandate (Jan 2027)');
  console.log('');
}

// Run examples if called directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

module.exports = {
  configureFormularyURLs,
  lookupByRxCUI,
  lookupByName,
  compareOldAndNew,
  errorHandlingExample,
  agentIntegrationExample
};
