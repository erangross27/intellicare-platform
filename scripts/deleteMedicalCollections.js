#!/usr/bin/env node

/**
 * Delete All Medical Collections
 *
 * This script removes all medical data collections from intellicare_practice_yale database
 * while preserving essential non-medical collections.
 *
 * PRESERVED COLLECTIONS (DO NOT DELETE):
 * - users
 * - patients
 * - appointments
 * - chats, messages, chat_messages, chat_sessions
 * - sessions
 * - serviceaccounts
 * - practices
 * - documents (uploaded PDFs)
 * - audit_logs
 * - agent_memories
 * - notifications
 * - active_batch_jobs
 *
 * Usage: node scripts/deleteMedicalCollections.js
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Read MongoDB URI from KMS
const kmsPath = path.join(__dirname, '../apps/backend-api/.kms/MONGODB_ADMIN_URI');
const MONGO_URI = fs.readFileSync(kmsPath, 'utf8').trim();

// Collections to KEEP (do NOT delete)
const PRESERVE_COLLECTIONS = [
  'users',
  'patients',
  'appointments',
  'chats',
  'messages',
  'chat_messages',
  'chat_sessions',
  'sessions',
  'serviceaccounts',
  'practices',
  'documents',
  'audit_logs',
  'agent_memories',
  'notifications',
  'active_batch_jobs'
];

// Ask for confirmation
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function deleteMedicalCollections() {
  let client;

  try {
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(MONGO_URI);
    await client.connect();

    const db = client.db('intellicare_practice_yale');
    console.log('✅ Connected to intellicare_practice_yale database\n');

    // Get all collections
    const collections = await db.listCollections().toArray();
    const allCollectionNames = collections.map(c => c.name);

    console.log(`📊 Total collections in database: ${allCollectionNames.length}\n`);

    // Filter medical collections (collections NOT in preserve list and NOT system collections)
    const medicalCollections = allCollectionNames.filter(name =>
      !PRESERVE_COLLECTIONS.includes(name) && !name.startsWith('system.')
    );

    console.log('🛡️  PRESERVED Collections (will NOT be deleted):');
    PRESERVE_COLLECTIONS.forEach(name => {
      if (allCollectionNames.includes(name)) {
        console.log(`   ✓ ${name}`);
      }
    });

    console.log(`\n🗑️  MEDICAL Collections to DELETE (${medicalCollections.length}):`);
    medicalCollections.slice(0, 20).forEach(name => console.log(`   • ${name}`));
    if (medicalCollections.length > 20) {
      console.log(`   ... and ${medicalCollections.length - 20} more`);
    }

    console.log('\n⚠️  WARNING: This will permanently delete all medical data collections!');
    console.log('⚠️  This action CANNOT be undone!\n');

    const confirmed = await askConfirmation('Are you sure you want to proceed? (yes/no): ');

    if (!confirmed) {
      console.log('\n❌ Operation cancelled by user');
      return;
    }

    console.log('\n🗑️  Starting deletion...\n');

    let deleted = 0;
    let errors = 0;

    for (const collectionName of medicalCollections) {
      try {
        await db.collection(collectionName).drop();
        console.log(`✅ Deleted: ${collectionName}`);
        deleted++;
      } catch (error) {
        console.error(`❌ Error deleting ${collectionName}: ${error.message}`);
        errors++;
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   🗑️  Deleted: ${deleted} collections`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   ✅ Preserved: ${PRESERVE_COLLECTIONS.filter(n => allCollectionNames.includes(n)).length} collections`);

    // Verify preserved collections still exist
    const remainingCollections = await db.listCollections().toArray();
    const remainingNames = remainingCollections.map(c => c.name);

    console.log(`\n✅ Remaining collections: ${remainingNames.length}`);
    remainingNames.forEach(name => console.log(`   • ${name}`));

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
deleteMedicalCollections().catch(console.error);
