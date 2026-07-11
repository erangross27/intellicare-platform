#!/usr/bin/env node

/**
 * Initialize MongoDB for IntelliCare Production
 * This script MUST be run before starting the application for the first time
 *
 * It will:
 * 1. Create MongoDB users (admin and app)
 * 2. Create the global database
 * 3. Create all necessary collections
 * 4. Set up security policies
 * 5. Pre-register all service accounts
 */

const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function initializeProduction() {
  console.log('🚀 Initializing IntelliCare MongoDB for Production\n');
  console.log('This script will set up everything needed for first run.\n');

  // Step 1: Connect without auth to create users (first time only)
  let client = new MongoClient('mongodb://localhost:27017');

  try {
    console.log('📝 Step 1: Creating MongoDB users...');
    await client.connect();
    const adminDb = client.db('admin');

    // Create admin user
    try {
      await adminDb.command({
        createUser: 'intellicare_admin',
        pwd: 'CHANGE_ME_PASSWORD',
        roles: [{ role: 'root', db: 'admin' }]
      });
      console.log('  ✅ Created intellicare_admin user');
    } catch (err) {
      if (err.code === 51003) {
        console.log('  → intellicare_admin user already exists');
      } else {
        throw err;
      }
    }

    // Create app user
    try {
      await adminDb.command({
        createUser: 'intellicare_app',
        pwd: 'CHANGE_ME_PASSWORD',
        roles: [
          { role: 'readWriteAnyDatabase', db: 'admin' },
          { role: 'dbAdmin', db: 'admin' },
          { role: 'clusterMonitor', db: 'admin' }
        ]
      });
      console.log('  ✅ Created intellicare_app user');
    } catch (err) {
      if (err.code === 51003) {
        console.log('  → intellicare_app user already exists');
      } else {
        throw err;
      }
    }

    await client.close();

    // Step 2: Reconnect with auth to create database
    console.log('\n📦 Step 2: Creating global database...');
    client = new MongoClient(process.env.MONGODB_ADMIN_URI || 'mongodb://localhost:27017/admin?authSource=admin');
    await client.connect();

    const db = client.db('intellicare_practice_global');

    // Step 3: Create collections
    console.log('\n📚 Step 3: Creating collections...');
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

    for (const collName of collections) {
      try {
        await db.createCollection(collName);
        console.log(`  ✅ Created ${collName}`);
      } catch (err) {
        if (err.code === 48) {
          console.log(`  → ${collName} already exists`);
        } else {
          console.error(`  ❌ Error creating ${collName}:`, err.message);
        }
      }
    }

    // Step 4: Create security policies
    console.log('\n🔒 Step 4: Creating security policies...');
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
      console.log(`  ✅ Policy for ${policy.name}`);
    }

    // Step 5: Pre-register essential service accounts
    console.log('\n🔧 Step 5: Pre-registering essential service accounts...');
    const ServiceAccount = db.collection('ServiceAccounts');

    const essentialServices = [
      'secure-data-access',
      'service-account-manager',
      'medical-data-service',
      'document-storage-service',
      'secure-session-manager',
      'claude-memory-service',
      'patient-matching-service',
      'practice-database-manager',
      'mfa',
      'security-audit-service',
      'threat-detection-service',
      'zero-knowledge-auth-service'
    ];

    const kms = require('./apps/backend-api/services/productionKMS');
    await kms.initialize();

    for (const serviceId of essentialServices) {
      const apiKey = crypto.randomBytes(32).toString('hex');
      const hashedKey = await bcrypt.hash(apiKey, 12);

      await ServiceAccount.updateOne(
        { serviceId },
        {
          $set: {
            serviceId,
            hashedApiKey: hashedKey,
            permissions: ['read', 'write', 'execute'],
            status: 'active',
            createdAt: new Date(),
            lastUsed: new Date()
          }
        },
        { upsert: true }
      );

      // Store the API key in KMS
      const keyName = `SERVICE_${serviceId.toUpperCase().replace(/-/g, '_')}_KEY`;
      await kms.storeInternalKey(keyName, apiKey);

      console.log(`  ✅ Registered ${serviceId}`);
    }

    // Step 6: Create indexes
    console.log('\n📊 Step 6: Creating indexes...');
    await ServiceAccount.createIndex({ serviceId: 1 }, { unique: true });
    console.log('  ✅ Created index on ServiceAccounts.serviceId');

    console.log('\n' + '='.repeat(60));
    console.log('✅ PRODUCTION INITIALIZATION COMPLETE!');
    console.log('='.repeat(60));
    console.log('\nThe IntelliCare platform is now ready to run.');
    console.log('\nYou can now:');
    console.log('1. Start the backend: cd apps/backend-api && npm run dev');
    console.log('2. Start the frontend: cd apps/frontend-vite && npm run dev');
    console.log('\n⚠️  IMPORTANT: Save the MongoDB credentials securely!');
    console.log('Admin user: intellicare_admin');
    console.log('App user: intellicare_app');

  } catch (error) {
    console.error('\n❌ Initialization failed:', error.message);
    console.error('\nIf MongoDB authentication is already enabled, the script');
    console.error('cannot create users. You may need to:');
    console.error('1. Temporarily disable auth in MongoDB');
    console.error('2. Run this script');
    console.error('3. Re-enable auth');
  } finally {
    await client.close();
  }
}

// Run if called directly
if (require.main === module) {
  initializeProduction().catch(console.error);
}

module.exports = { initializeProduction };