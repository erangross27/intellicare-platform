#!/usr/bin/env node

/**
 * Test script to verify dual-path medical data extraction
 * Tests that both unified document and granular collections are populated
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SecureDataAccess = require('../apps/backend-api/services/secureDataAccess');
const medicalFieldMappingService = require('../apps/backend-api/services/medicalFieldMappingService');
const { ObjectId } = require('mongodb');

async function testDualPathExtraction() {
  console.log('\n========================================');
  console.log('🧪 Testing Dual-Path Medical Data Extraction');
  console.log('========================================\n');

  try {
    const context = {
      serviceId: 'test-dual-path',
      operation: 'test-extraction',
      practiceId: 'yale'
    };

    // 1. Fetch the existing unified document
    console.log('📄 Step 1: Fetching existing unified medical document...');
    const unifiedDocs = await SecureDataAccess.query(
      'unified_medical_documents',
      {},
      { limit: 1 },
      context
    );

    if (!unifiedDocs || unifiedDocs.length === 0) {
      console.error('❌ No unified documents found to test with');
      process.exit(1);
    }

    const unifiedDoc = unifiedDocs[0];
    console.log(`✅ Found unified document: ${unifiedDoc._id}`);
    console.log(`   Category: ${unifiedDoc.category}`);
    console.log(`   Patient ID: ${unifiedDoc.patientId}`);

    // 2. Count granular collections BEFORE re-processing
    console.log('\n📊 Step 2: Counting existing granular collections...');
    const collectionsToCheck = [
      'medications', 'diagnoses', 'labresults', 'vitalsigns',
      'imagingreports', 'medicalprocedures', 'allergies',
      'clinical_decision_support', 'intelligent_recommendations',
      'trending_analysis', 'patient_specific_care_plan'
    ];

    const beforeCounts = {};
    for (const collection of collectionsToCheck) {
      try {
        const count = await SecureDataAccess.query(
          collection,
          { patientId: unifiedDoc.patientId },
          {},
          context
        );
        beforeCounts[collection] = count?.length || 0;
      } catch (err) {
        beforeCounts[collection] = 0;
      }
    }

    console.log('   Current counts:', beforeCounts);

    // 3. Re-process the unified document through saveComprehensiveData
    console.log('\n🔄 Step 3: Re-processing document with dual-path extraction...');

    // Pass the COMPLETE unified doc structure (with documentData if nested)
    const result = await medicalFieldMappingService.saveComprehensiveData(
      unifiedDoc,  // Pass full document structure
      unifiedDoc._id.toString(),
      unifiedDoc.patientId.toString(),
      context
    );

    console.log(`\n✅ Processing complete!`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Collections saved: ${result.savedCollections?.length || 0}`);
    console.log(`   Errors: ${result.errors?.length || 0}`);

    if (result.savedCollections && result.savedCollections.length > 0) {
      console.log(`   Saved to: ${result.savedCollections.join(', ')}`);
    }

    if (result.errors && result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.join(', ')}`);
    }

    // 4. Count granular collections AFTER re-processing
    console.log('\n📊 Step 4: Counting granular collections after processing...');
    const afterCounts = {};
    for (const collection of collectionsToCheck) {
      try {
        const count = await SecureDataAccess.query(
          collection,
          { patientId: unifiedDoc.patientId },
          {},
          context
        );
        afterCounts[collection] = count?.length || 0;
      } catch (err) {
        afterCounts[collection] = 0;
      }
    }

    // 5. Show comparison
    console.log('\n📈 Results Comparison:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Collection                        Before  After  Change');
    console.log('───────────────────────────────────────────────────────');

    for (const collection of collectionsToCheck) {
      const before = beforeCounts[collection];
      const after = afterCounts[collection];
      const change = after - before;
      const changeStr = change > 0 ? `+${change}` : change.toString();
      console.log(`${collection.padEnd(32)} ${before.toString().padStart(6)}  ${after.toString().padStart(5)}  ${changeStr.padStart(6)}`);
    }
    console.log('═══════════════════════════════════════════════════════\n');

    // 6. Summary
    const totalBefore = Object.values(beforeCounts).reduce((a, b) => a + b, 0);
    const totalAfter = Object.values(afterCounts).reduce((a, b) => a + b, 0);
    const totalNew = totalAfter - totalBefore;

    console.log('📊 Summary:');
    console.log(`   Total documents before: ${totalBefore}`);
    console.log(`   Total documents after:  ${totalAfter}`);
    console.log(`   New documents created:  ${totalNew}`);

    if (totalNew > 0) {
      console.log('\n✅ SUCCESS! Dual-path extraction is working!');
      console.log('   Unified document + granular collections both populated.');
    } else {
      console.log('\n⚠️  WARNING: No new granular documents created.');
      console.log('   Check logs for details on why handlers didn\'t trigger.');
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testDualPathExtraction();
