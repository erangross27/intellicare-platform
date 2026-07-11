#!/usr/bin/env node

/**
 * Show Medical Collections for a Specific Patient
 *
 * Usage:
 *   node scripts/showPatientMedicalCollections.js --patientId <id>
 *   node scripts/showPatientMedicalCollections.js --name "First Last"
 *   node scripts/showPatientMedicalCollections.js --email <email>
 *   node scripts/showPatientMedicalCollections.js --name "First Last" --analyze-empty
 *
 * Shows all medical collections that contain data for the specified patient
 *
 * Flags:
 *   --analyze-empty : Analyze empty arrays in all collections and show schema gaps
 */

const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const medicalCollectionsService = require('../services/medicalCollectionsService');

// Read MongoDB URI from KMS
const mongoUriPath = path.join(__dirname, '../.kms/MONGODB_ADMIN_URI');
const MONGO_URI = fs.readFileSync(mongoUriPath, 'utf8').trim();

// Database name
const DB_NAME = 'intellicare_practice_yale';

// Collections to skip (non-medical collections that shouldn't require templates)
const SKIP_COLLECTIONS = ['appointments'];

// Get all medical collections from medicalCollectionsService (892 collections)
// Filter out non-medical collections that don't need templates
const MEDICAL_COLLECTIONS = medicalCollectionsService.getAllCollections()
  .filter(name => !SKIP_COLLECTIONS.includes(name));

console.log(`📋 Loaded ${MEDICAL_COLLECTIONS.length} medical collections from medicalCollectionsService`);

async function findPatient(db, args) {
  if (args.patientId) {
    // Find by ID
    const patientId = args.patientId.match(/^[0-9a-fA-F]{24}$/)
      ? new ObjectId(args.patientId)
      : args.patientId;
    return await db.collection('patients').findOne({ _id: patientId });
  }

  if (args.name) {
    // Handle multiple name formats:
    // 1. "FirstName LastName" (e.g., "David Wilson")
    // 2. "LastName, FirstName MiddleName" (e.g., "Wilson, David Michael")
    // 3. "FirstName MiddleName LastName" (e.g., "David Michael Wilson")

    let firstName, lastName;

    // Check if comma-separated (LastName, FirstName MiddleName)
    if (args.name.includes(',')) {
      const parts = args.name.split(',').map(p => p.trim());
      lastName = parts[0];
      const firstMiddle = parts[1].split(' ').filter(Boolean);
      firstName = firstMiddle[0]; // Take first word after comma as firstName
      console.log(`🔍 Detected "LastName, FirstName" format: firstName="${firstName}", lastName="${lastName}"`);
    } else {
      // Regular "FirstName LastName" or "FirstName MiddleName LastName"
      const nameParts = args.name.split(' ').filter(Boolean);
      firstName = nameParts[0];
      // Take LAST part as lastName (ignores middle names)
      lastName = nameParts[nameParts.length - 1];
      console.log(`🔍 Detected regular format: firstName="${firstName}", lastName="${lastName}"`);
    }

    // Escape special regex characters in names (e.g., O'Brien, St. John)
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\'/]/g, '\\$&');

    // Find all matching patients
    const patients = await db.collection('patients').find({
      firstName: new RegExp(`^${escapeRegex(firstName)}$`, 'i'),
      lastName: new RegExp(`^${escapeRegex(lastName)}$`, 'i')
    }).toArray();

    if (patients.length === 0) {
      console.log(`❌ No patients found with firstName="${firstName}", lastName="${lastName}"`);
      return null;
    }

    if (patients.length === 1) {
      console.log(`✅ Found exact match: ${patients[0].firstName} ${patients[0].lastName}`);
      return patients[0];
    }

    // Multiple matches - show all and let user choose
    console.log(`\n⚠️  Found ${patients.length} patients with name "${firstName} ${lastName}":\n`);
    patients.forEach((p, i) => {
      const dob = p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split('T')[0] : 'N/A';
      console.log(`  ${i + 1}. ${p.firstName} ${p.lastName} (ID: ${p._id}, DOB: ${dob})`);
    });
    console.log(`\n❌ Multiple patients found. Please use --patientId instead:`);
    console.log(`   Example: node scripts/showPatientMedicalCollections.js --patientId ${patients[0]._id}\n`);
    process.exit(1);
  }

  if (args.email) {
    // Find by email
    return await db.collection('patients').findOne({ email: args.email });
  }

  return null;
}

function findEmptyArrays(obj, parentKey = '', results = {}) {
  // Skip metadata fields
  const skipFields = ['_id', 'patientId', 'documentId', 'sessionId', 'createdAt', 'updatedAt', '_securityMetadata'];

  for (const key in obj) {
    if (skipFields.includes(key)) continue;

    const fullKey = parentKey ? `${parentKey}.${key}` : key;
    const value = obj[key];

    if (Array.isArray(value)) {
      if (value.length === 0) {
        // Found empty array
        if (!results[fullKey]) {
          results[fullKey] = { empty: 0, filled: 0, sampleValues: [] };
        }
        results[fullKey].empty++;
      } else {
        // Array has data
        if (!results[fullKey]) {
          results[fullKey] = { empty: 0, filled: 0, sampleValues: [] };
        }
        results[fullKey].filled++;
        // Store sample values (first item only, truncated)
        if (results[fullKey].sampleValues.length < 3) {
          const sample = JSON.stringify(value[0]).substring(0, 100);
          if (!results[fullKey].sampleValues.includes(sample)) {
            results[fullKey].sampleValues.push(sample);
          }
        }
      }
    } else if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof ObjectId)) {
      // Recurse into nested objects
      findEmptyArrays(value, fullKey, results);
    }
  }

  return results;
}

async function analyzeEmptyArrays(db, patientId, collectionsWithData) {
  console.log('\n\n🔍 ANALYZING EMPTY ARRAYS (Schema Gaps)\n');
  console.log('━'.repeat(80));

  const allEmptyArrays = {};

  for (const item of collectionsWithData) {
    const collection = db.collection(item.name);

    // Get all documents for this patient
    const documents = await collection.find({ patientId }).toArray();

    const emptyArrays = {};
    for (const doc of documents) {
      findEmptyArrays(doc, '', emptyArrays);
    }

    // Only keep arrays that are ALWAYS empty (never filled)
    const alwaysEmpty = Object.entries(emptyArrays)
      .filter(([key, stats]) => stats.empty > 0 && stats.filled === 0)
      .map(([key, stats]) => ({ field: key, count: stats.empty }));

    if (alwaysEmpty.length > 0) {
      allEmptyArrays[item.name] = alwaysEmpty;
    }
  }

  // Display results grouped by collection
  if (Object.keys(allEmptyArrays).length === 0) {
    console.log('✅ No consistently empty arrays found! All arrays are either filled or not present.');
    return;
  }

  let totalEmptyFields = 0;

  for (const [collectionName, emptyFields] of Object.entries(allEmptyArrays)) {
    console.log(`\n📦 ${collectionName}`);
    console.log('   ' + '─'.repeat(76));

    emptyFields.forEach(({ field, count }) => {
      console.log(`   ❌ ${field.padEnd(50)} (empty in ${count} docs)`);
      totalEmptyFields++;
    });
  }

  console.log('\n' + '━'.repeat(80));
  console.log(`\n📊 SUMMARY: Found ${totalEmptyFields} empty array fields across ${Object.keys(allEmptyArrays).length} collections`);
  console.log('\n💡 These fields need to be added to the extraction schema in claudeBatchProcessor.js');
  console.log('   to ensure Claude extracts data into these arrays during document analysis.\n');
}

async function showPatientMedicalCollections() {
  const args = parseArgs();

  if (!args.patientId && !args.name && !args.email) {
    console.error('Error: Please provide --patientId, --name, or --email');
    console.log('\nUsage:');
    console.log('  node scripts/showPatientMedicalCollections.js --patientId <id>');
    console.log('  node scripts/showPatientMedicalCollections.js --name "First Last"');
    console.log('  node scripts/showPatientMedicalCollections.js --email <email>');
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Find patient
    const patient = await findPatient(db, args);

    if (!patient) {
      console.error('\n❌ Patient not found');
      process.exit(1);
    }

    console.log(`\n👤 Patient: ${patient.firstName} ${patient.lastName}`);
    console.log(`   ID: ${patient._id}`);
    if (patient.dateOfBirth) {
      console.log(`   DOB: ${new Date(patient.dateOfBirth).toISOString().split('T')[0]}`);
    }
    console.log('');

    // Get all collections from database
    const allCollections = await db.listCollections().toArray();
    const allCollectionNames = allCollections.map(c => c.name);

    // Filter to only include registered medical collections that exist in database
    const medicalCollectionsInDb = MEDICAL_COLLECTIONS.filter(name =>
      allCollectionNames.includes(name)
    );

    console.log(`📊 Checking ${medicalCollectionsInDb.length} medical collections (${MEDICAL_COLLECTIONS.length} registered, ${medicalCollectionsInDb.length} exist in DB)...\n`);

    // Check each collection for patient data
    const collectionsWithData = [];
    let totalDocuments = 0;

    for (const collectionName of medicalCollectionsInDb) {
      const collection = db.collection(collectionName);

      // Try to find documents with patientId field
      // Try both ObjectId and string formats (batch processor may use either)
      const count = await collection.countDocuments({
        $or: [
          { patientId: patient._id },           // ObjectId format
          { patientId: patient._id.toString() } // String format
        ]
      });


      if (count > 0) {
        collectionsWithData.push({
          name: collectionName,
          count: count
        });
        totalDocuments += count;
      }
    }

    // Sort by document count (descending)
    collectionsWithData.sort((a, b) => b.count - a.count);

    // Display results
    if (collectionsWithData.length === 0) {
      console.log('❌ No medical data found for this patient');
    } else {
      console.log(`✅ Found data in ${collectionsWithData.length} collections (${totalDocuments} total documents):\n`);

      // Calculate max width for alignment
      const maxNameLength = Math.max(...collectionsWithData.map(c => c.name.length));

      collectionsWithData.forEach((item, index) => {
        const padding = ' '.repeat(maxNameLength - item.name.length);
        const countStr = item.count.toString().padStart(3);
        console.log(`  ${(index + 1).toString().padStart(2)}. ${item.name}${padding} : ${countStr} document${item.count === 1 ? ' ' : 's'}`);
      });

      console.log(`\n📈 Total: ${totalDocuments} medical documents across ${collectionsWithData.length} collections`);

      // Note: medicalData.collections cache was removed Feb 2026
      // All collection queries now go directly to DB - no more cache discrepancies

      // If --analyze-empty flag is present, analyze empty arrays
      if (args.analyzeEmpty) {
        await analyzeEmptyArrays(db, patient._id, collectionsWithData);
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--patientId' && i + 1 < process.argv.length) {
      args.patientId = process.argv[i + 1];
      i++;
    } else if (process.argv[i] === '--name') {
      // Collect all remaining arguments as the name (allows unquoted names with spaces)
      const nameParts = [];
      i++;
      while (i < process.argv.length && !process.argv[i].startsWith('--')) {
        nameParts.push(process.argv[i]);
        i++;
      }
      args.name = nameParts.join(' ');
      i--; // Back up one since the loop will increment
    } else if (process.argv[i] === '--email' && i + 1 < process.argv.length) {
      args.email = process.argv[i + 1];
      i++;
    } else if (process.argv[i] === '--analyze-empty') {
      args.analyzeEmpty = true;
    }
  }
  return args;
}

// Run the script
showPatientMedicalCollections();
