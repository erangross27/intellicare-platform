#!/usr/bin/env node

/**
 * Rename Collections with Underscores
 *
 * This script renames medical collections to use underscores consistently.
 * Example: dischargesummaries → discharge_summaries
 *
 * Usage: node scripts/renameCollectionsWithUnderscores.js
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Read MongoDB URI from KMS
const kmsPath = path.join(__dirname, '../apps/backend-api/.kms/MONGODB_ADMIN_URI');
const MONGO_URI = fs.readFileSync(kmsPath, 'utf8').trim();

// Collections to rename: [oldName, newName]
const RENAMES = [
  ['dischargesummaries', 'discharge_summaries'],
  ['vitalsigns', 'vital_signs'],
  ['labresults', 'lab_results'],
  ['imagingreports', 'imaging_reports'],
  ['vaccinationrecords', 'vaccination_records'],
  ['consultationnotes', 'consultation_notes'],
  ['medicalhistory', 'medical_history'],
  ['riskfactors', 'risk_factors'],
  ['clinicalscores', 'clinical_scores'],
  ['pathologyreports', 'pathology_reports'],
  ['medicaldevices', 'medical_devices'],
  ['additionaldata', 'additional_data'],
  ['ecgreadings', 'ecg_readings'],
  ['echocardiograms', 'echo_reports'],
  ['cardiacriskscores', 'cardiac_risk_scores'],
  ['obstetricrecords', 'obstetric_records'],
  ['pediatricrecords', 'pediatric_records'],
  ['mentalstatusexams', 'mental_status_exams'],
  ['functionalassessments', 'functional_assessments']
];

async function renameCollections() {
  let client;

  try {
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(MONGO_URI);
    await client.connect();

    const db = client.db('intellicare_practice_yale');
    console.log('✅ Connected to intellicare_practice_yale database\n');

    // Get list of existing collections
    const collections = await db.listCollections().toArray();
    const existingNames = collections.map(c => c.name);

    console.log(`📊 Found ${existingNames.length} collections in database\n`);

    let renamed = 0;
    let skipped = 0;
    let errors = 0;

    for (const [oldName, newName] of RENAMES) {
      try {
        // Check if old collection exists
        if (!existingNames.includes(oldName)) {
          console.log(`⏭️  Skipping ${oldName} → ${newName} (source doesn't exist)`);
          skipped++;
          continue;
        }

        // Check if new collection already exists
        if (existingNames.includes(newName)) {
          console.log(`⚠️  Skipping ${oldName} → ${newName} (target already exists)`);
          skipped++;
          continue;
        }

        // Rename the collection
        await db.collection(oldName).rename(newName);
        console.log(`✅ Renamed: ${oldName} → ${newName}`);
        renamed++;

      } catch (error) {
        console.error(`❌ Error renaming ${oldName}: ${error.message}`);
        errors++;
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Renamed: ${renamed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔒 Connection closed');
    }
  }
}

// Run the script
renameCollections().catch(console.error);
