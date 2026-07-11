const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

async function initializeIntelliCare() {
    console.log('🚀 Initializing IntelliCare Database and Services...\n');

    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/intellicare_practice_global', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // 1. Create all necessary collections
    console.log('📦 Creating collections...');
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
            console.log(`  ✓ Created ${collName}`);
        } catch (err) {
            if (err.code === 48) { // Collection already exists
                console.log(`  → ${collName} already exists`);
            } else {
                console.error(`  ✗ Error creating ${collName}:`, err.message);
            }
        }
    }

    // 2. Create default security policies
    console.log('\n🔒 Creating security policies...');
    const SecurityPolicy = db.collection('SecurityPolicies');

    const defaultPolicies = [
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

    // 3. Register essential services
    console.log('\n🔧 Registering services...');
    const ServiceAccount = db.collection('ServiceAccounts');

    const services = [
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

    for (const serviceId of services) {
        const apiKey = crypto.randomBytes(32).toString('hex');
        const bcrypt = require('bcryptjs');
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

        // Store the plain key in KMS
        const kmsPath = path.join(__dirname, 'apps', 'backend-api', 'kms-storage');
        await fs.mkdir(kmsPath, { recursive: true });

        const keyFile = path.join(kmsPath, `SERVICE_${serviceId.toUpperCase().replace(/-/g, '_')}_KEY`);
        await fs.writeFile(keyFile, apiKey);

        console.log(`  ✓ ${serviceId}`);
    }

    // 4. Create master encryption key
    console.log('\n🔐 Creating master encryption key...');
    const masterKey = crypto.randomBytes(32).toString('base64');
    const masterKeyPath = path.join(__dirname, 'apps', 'backend-api', 'kms-storage', 'master.key');
    await fs.writeFile(masterKeyPath, masterKey);
    console.log('  ✓ Master key created');

    // 5. Check replica set status
    console.log('\n📊 Checking MongoDB replica set...');
    try {
        const admin = db.admin();
        const status = await admin.replSetGetStatus();
        console.log('  ✓ Replica set is configured:', status.set);
    } catch (err) {
        console.log('  ⚠️  MongoDB is not running as replica set');
        console.log('      Run: sudo bash /home/erangross/setup_replica_set.sh');
    }

    console.log('\n✅ IntelliCare database initialization complete!');
    console.log('\nNext steps:');
    console.log('1. Make sure Redis is running: sudo systemctl status redis-server');
    console.log('2. Start the backend: cd apps/backend-api && npm run dev');
    console.log('3. Start the frontend: cd apps/frontend-vite && npm run dev');

    await mongoose.connection.close();
}

initializeIntelliCare().catch(console.error);