#!/usr/bin/env node

/**
 * Patient-Specific Medical Data Cleanup Script
 *
 * Removes all medical data, documents, and patient linkages for ONE specific patient
 *
 * Usage:
 *   node scripts/cleanPatientMedicalData.js --name "FirstName LastName"
 *   node scripts/cleanPatientMedicalData.js --name "Emily Wilson"
 *
 * Example:
 *   node scripts/cleanPatientMedicalData.js --name "Brian Richardson"
 */

const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
let patientName = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--name' && i + 1 < args.length) {
    patientName = args[i + 1];
    break;
  }
}

if (!patientName) {
  console.error('❌ Error: Patient name is required');
  console.log('\nUsage: node scripts/cleanPatientMedicalData.js --name "FirstName LastName"');
  console.log('Example: node scripts/cleanPatientMedicalData.js --name "Brian Richardson"');
  process.exit(1);
}

// Parse patient name
const nameParts = patientName.trim().split(/\s+/);
if (nameParts.length < 2) {
  console.error('❌ Error: Please provide both first and last name');
  console.log('Example: node scripts/cleanPatientMedicalData.js --name "Brian Richardson"');
  process.exit(1);
}

const firstName = nameParts[0];
const lastName = nameParts.slice(1).join(' ');

// Database configuration
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/intellicare_practice_global?authSource=admin';
const PRACTICE_DB = 'intellicare_practice_yale';

// Get all medical collections from the service
const medicalCollectionsService = require('../services/medicalCollectionsService');
let allCollections = medicalCollectionsService.getAllCollections();

// Add neurosurgery/radiology-specific collections that might not be in the registry yet
const additionalCollections = [
  'additional_data',
  'intraoperative_monitoring',
  'tractography_studies',
  'functional_mri_studies',
  'brain_tumor_characteristics',
  'neurosurgery_consultations'
];

// Merge and deduplicate
allCollections = [...new Set([...allCollections, ...additionalCollections])];

async function cleanPatientData() {
  const client = new MongoClient(MONGO_URI);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();

    const db = client.db(PRACTICE_DB);
    console.log(`✅ Connected to database: ${PRACTICE_DB}\n`);

    // Step 1: Find the patient
    console.log(`🔍 Searching for patient: ${firstName} ${lastName}...`);
    const patientsCollection = db.collection('patients');

    const patient = await patientsCollection.findOne({
      firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
      lastName: { $regex: new RegExp(`^${lastName}$`, 'i') }
    });

    if (!patient) {
      console.error(`❌ Patient not found: ${firstName} ${lastName}`);
      console.log('\nAvailable patients:');
      const allPatients = await patientsCollection.find({}, { firstName: 1, lastName: 1 }).sort({ lastName: 1, firstName: 1 }).toArray();
      allPatients.forEach(p => console.log(`   - ${p.firstName} ${p.lastName}`));
      process.exit(1);
    }

    const patientId = patient._id;
    console.log(`✅ Found patient: ${patient.firstName} ${patient.lastName}`);
    console.log(`   Patient ID: ${patientId}`);
    console.log(`   DOB: ${patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : 'N/A'}\n`);

    // Step 2: Clean all medical data collections for this patient
    console.log(`📊 Cleaning medical data collections for ${patient.firstName} ${patient.lastName}...`);
    let totalDeleted = 0;

    // Process collections in parallel batches for speed
    const batchSize = 10;
    for (let i = 0; i < allCollections.length; i += batchSize) {
      const batch = allCollections.slice(i, i + batchSize);

      const deletePromises = batch.map(async (collectionName) => {
        try {
          const collection = db.collection(collectionName);
          const result = await collection.deleteMany({ patientId });

          if (result.deletedCount > 0) {
            console.log(`   ✓ ${collectionName}: Deleted ${result.deletedCount} documents`);
            return result.deletedCount;
          }
          return 0;
        } catch (error) {
          // Collection might not exist yet, which is fine
          return 0;
        }
      });

      const results = await Promise.all(deletePromises);
      totalDeleted += results.reduce((sum, count) => sum + count, 0);
    }

    console.log(`   📊 Total medical data deleted: ${totalDeleted} documents\n`);

    // Step 3: Clean documents collection for this patient
    console.log(`📄 Cleaning documents for ${patient.firstName} ${patient.lastName}...`);
    const documentsCollection = db.collection('documents');
    const docResult = await documentsCollection.deleteMany({ patientId });
    console.log(`   ✓ Deleted ${docResult.deletedCount} documents\n`);

    // Step 4: Clean patient medical data linkage arrays and medical counts
    console.log(`🔗 Cleaning patient medical data linkages for ${patient.firstName} ${patient.lastName}...`);

    // Find ALL count fields for this patient
    const countsToUnset = new Set();

    // Scan this patient to find every count field
    Object.keys(patient).forEach(key => {
      if (key.endsWith('Count')) {
        countsToUnset.add(key);
      }
    });

    // Build list of all count fields from medical collections (just in case)
    allCollections.forEach(collection => {
      // Convert collection name to count field name
      // e.g., 'medications' -> 'medicationsCount'
      const countField = `${collection.replace(/_/g, '')}Count`;
      countsToUnset.add(countField);
    });

    // Convert Set to object for MongoDB $unset
    const unsetFields = {};
    countsToUnset.forEach(field => {
      unsetFields[field] = '';
    });

    if (countsToUnset.size > 0) {
      console.log(`   📊 Removing ${countsToUnset.size} medical count fields`);
    }

    const updateResult = await patientsCollection.updateOne(
      { _id: patientId },
      {
        $set: {
          medicalData: {},
          medicalHistory: [],
          documents: [],
          doctorSummary: ''  // Clear doctor summary
        },
        $unset: unsetFields
      }
    );
    console.log(`   ✓ Cleared medical data linkages for ${patient.firstName} ${patient.lastName}`);
    console.log(`   ✓ Cleared doctorSummary field\n`);

    // Summary
    console.log(`✨ Cleanup complete for ${patient.firstName} ${patient.lastName}!`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Patient: ${patient.firstName} ${patient.lastName} (${patientId})`);
    console.log(`   Medical data deleted: ${totalDeleted} documents`);
    console.log(`   Documents deleted: ${docResult.deletedCount}`);
    console.log(`   Patient record cleaned: Yes`);
    console.log(`   Count fields removed: ${countsToUnset.size}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ ${patient.firstName} ${patient.lastName}'s medical data has been completely removed`);
    console.log(`   Ready for fresh document analysis\n`);

  } catch (error) {
    console.error('❌ Error cleaning patient data:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Database connection closed');
  }
}

// Run the cleanup
cleanPatientData().catch(console.error);