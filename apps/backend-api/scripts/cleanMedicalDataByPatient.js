#!/usr/bin/env node

/**
 * Clean Medical Data for Specific Patient
 *
 * Deletes ALL medical data for a specific patient (keeps patient record)
 *
 * Usage:
 *   node scripts/cleanMedicalDataByPatient.js --patientId <id>
 *   node scripts/cleanMedicalDataByPatient.js --name "First Last"
 */

const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Read MongoDB URI from KMS
const mongoUriPath = path.join(__dirname, '../.kms/MONGODB_ADMIN_URI');
const MONGO_URI = fs.readFileSync(mongoUriPath, 'utf8').trim();

// Database name
const DB_NAME = 'intellicare_practice_yale';

// Collections to exclude (non-medical collections)
const EXCLUDE_COLLECTIONS = [
  'users',
  'patients',
  'sessions',
  'serviceaccounts',
  'practices',
  'appointments',
  'documents',
  'chats',
  'messages',
  'chat_messages',
  'chat_sessions',
  'audit_logs',
  'auditlogs',
  'agent_memories',
  'notifications',
  'active_batch_jobs',
  'free_vector_search_test',
  'emailverifications',
  'logintokens',
  'pendinguploads',
  'zerotrustsessions',
  'deletedpatients',
  'provideravailabilities',
  'clinicrbacpolicies',
  'costtrackings'
];

async function findPatient(db, args) {
  if (args.patientId) {
    // Find by ID
    const patientId = args.patientId.match(/^[0-9a-fA-F]{24}$/)
      ? new ObjectId(args.patientId)
      : args.patientId;
    return await db.collection('patients').findOne({ _id: patientId });
  }

  if (args.name) {
    // Handle multiple name formats
    let firstName, lastName;

    // Check if comma-separated (LastName, FirstName MiddleName)
    if (args.name.includes(',')) {
      const parts = args.name.split(',').map(p => p.trim());
      lastName = parts[0];
      const firstMiddle = parts[1].split(' ').filter(Boolean);
      firstName = firstMiddle[0];
    } else {
      // Regular "FirstName LastName" or "FirstName MiddleName LastName"
      const nameParts = args.name.split(' ').filter(Boolean);
      firstName = nameParts[0];
      lastName = nameParts[nameParts.length - 1];
    }

    // Find all matching patients
    const patients = await db.collection('patients').find({
      firstName: new RegExp(`^${firstName}$`, 'i'),
      lastName: new RegExp(`^${lastName}$`, 'i')
    }).toArray();

    if (patients.length === 0) {
      return null;
    }

    if (patients.length === 1) {
      return patients[0];
    }

    // Multiple matches - show all and let user choose
    console.log(`\n⚠️  Found ${patients.length} patients with name "${firstName} ${lastName}":\n`);
    patients.forEach((p, i) => {
      const dob = p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split('T')[0] : 'N/A';
      console.log(`  ${i + 1}. ${p.firstName} ${p.lastName} (ID: ${p._id}, DOB: ${dob})`);
    });
    console.log(`\n❌ Multiple patients found. Please specify --patientId instead:\n`);
    patients.forEach(p => {
      console.log(`   node scripts/cleanMedicalDataByPatient.js --patientId ${p._id}`);
    });
    console.log('');
    process.exit(1);
  }

  return null;
}

async function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function cleanMedicalDataByPatient() {
  const args = parseArgs();

  if (!args.patientId && !args.name) {
    console.error('Error: Please provide --patientId or --name');
    console.log('\nUsage:');
    console.log('  node scripts/cleanMedicalDataByPatient.js --patientId <id>');
    console.log('  node scripts/cleanMedicalDataByPatient.js --name "First Last"');
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

    // Get all collections
    const allCollections = await db.listCollections().toArray();
    const medicalCollections = allCollections
      .map(c => c.name)
      .filter(name => !EXCLUDE_COLLECTIONS.includes(name) && !name.startsWith('system.'));

    console.log(`📊 Scanning ${medicalCollections.length} medical collections...\n`);

    // Find collections with data
    const collectionsWithData = [];
    let totalDocuments = 0;

    for (const collectionName of medicalCollections) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments({ patientId: patient._id });

      if (count > 0) {
        collectionsWithData.push({
          name: collectionName,
          count: count
        });
        totalDocuments += count;
      }
    }

    if (collectionsWithData.length === 0) {
      console.log('✅ No medical data found for this patient (already clean)');
      return;
    }

    // Display what will be deleted
    console.log(`⚠️  Found medical data in ${collectionsWithData.length} collections:\n`);
    collectionsWithData.forEach(item => {
      console.log(`   ${item.name.padEnd(40)} : ${item.count} document(s)`);
    });
    console.log(`\n📊 Total: ${totalDocuments} medical documents will be deleted\n`);

    // Ask for confirmation
    if (!args.force) {
      console.log('⚠️  WARNING: This will DELETE all medical data for this patient!');
      console.log('   (Patient record will be kept, only medical data deleted)\n');

      const confirmed = await askConfirmation('Are you sure you want to delete this data? (yes/no): ');

      if (!confirmed) {
        console.log('\n❌ Operation cancelled');
        return;
      }
    }

    // Delete medical data
    console.log('\n🗑️  Deleting medical data...\n');

    let deletedCollections = 0;
    let deletedDocuments = 0;

    for (const item of collectionsWithData) {
      const collection = db.collection(item.name);
      const result = await collection.deleteMany({ patientId: patient._id });

      if (result.deletedCount > 0) {
        console.log(`   ✅ ${item.name}: Deleted ${result.deletedCount} document(s)`);
        deletedCollections++;
        deletedDocuments += result.deletedCount;
      }
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Collections cleaned: ${deletedCollections}`);
    console.log(`   Documents deleted: ${deletedDocuments}`);
    console.log(`   Patient record: KEPT (${patient.firstName} ${patient.lastName})`);
    console.log(`\n💡 You can now upload new documents for this patient for fresh analysis.\n`);

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
      const nameParts = [];
      i++;
      while (i < process.argv.length && !process.argv[i].startsWith('--')) {
        nameParts.push(process.argv[i]);
        i++;
      }
      args.name = nameParts.join(' ');
      i--;
    } else if (process.argv[i] === '--force') {
      args.force = true;
    }
  }
  return args;
}

// Run the script
cleanMedicalDataByPatient();
