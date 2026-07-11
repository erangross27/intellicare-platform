#!/usr/bin/env node

/**
 * Create the global database and initial collections
 */

const { MongoClient } = require('mongodb');

async function createGlobalDatabase() {
  console.log('🚀 Creating IntelliCare global database...\n');

  // Connect using the admin credentials
  const uri = process.env.MONGODB_ADMIN_URI || 'mongodb://localhost:27017/admin?authSource=admin';

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB as admin\n');

    // Create/switch to the global database
    const db = client.db('intellicare_practice_global');

    // Create essential collections
    const collections = [
      'ServiceAccounts',
      'Practices',
      'SecurityPolicies',
      'audit_logs',
      'chat_sessions',
      'chat_messages',
      'users',
      'patients',
      'appointments',
      'documents',
      'agent_memories',
      'function_analytics',
      'cache_metadata'
    ];

    console.log('📦 Creating collections...');
    for (const collName of collections) {
      try {
        await db.createCollection(collName);
        console.log(`  ✓ Created ${collName}`);
      } catch (err) {
        if (err.code === 48) { // Collection already exists
          console.log(`  → ${collName} already exists`);
        } else {
          console.error(`  ✗ Error creating ${collName}:`, err.message);
        }
      }
    }

    // Create default security policies
    console.log('\n🔒 Creating security policies...');
    const SecurityPolicy = db.collection('SecurityPolicies');

    const defaultPolicies = [
      { name: 'ServiceAccounts', allowedOperations: ['query', 'insert', 'update', 'delete'], requiresEncryption: false },
      { name: 'patients', allowedOperations: ['query', 'insert', 'update', 'delete'], requiresEncryption: true },
      { name: 'documents', allowedOperations: ['query', 'insert', 'update', 'delete'], requiresEncryption: true },
      { name: 'appointments', allowedOperations: ['query', 'insert', 'update', 'delete'], requiresEncryption: false },
      { name: 'users', allowedOperations: ['query', 'insert', 'update', 'delete'], requiresEncryption: true },
      { name: 'audit_logs', allowedOperations: ['insert', 'query'], requiresEncryption: false },
      { name: 'chat_sessions', allowedOperations: ['query', 'insert', 'update'], requiresEncryption: false },
      { name: 'chat_messages', allowedOperations: ['query', 'insert', 'update'], requiresEncryption: false },
      { name: 'agent_memories', allowedOperations: ['query', 'insert', 'update'], requiresEncryption: false }
    ];

    for (const policy of defaultPolicies) {
      await SecurityPolicy.updateOne(
        { name: policy.name },
        { $set: policy },
        { upsert: true }
      );
      console.log(`  ✓ Policy for ${policy.name}`);
    }

    // Grant permissions to intellicare_app user for the global database
    console.log('\n🔐 Granting database permissions to intellicare_app user...');
    const adminDb = client.db('admin');
    await adminDb.command({
      grantRolesToUser: 'intellicare_app',
      roles: [
        { role: 'dbOwner', db: 'intellicare_practice_global' },
        { role: 'readWrite', db: 'intellicare_practice_global' }
      ]
    });
    console.log('  ✓ Permissions granted to intellicare_app user');

    console.log('\n✅ Global database created successfully!');
    console.log('You can now restart the backend server.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

createGlobalDatabase().catch(console.error);