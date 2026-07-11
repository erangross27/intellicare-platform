const mongoose = require('mongoose');

async function extractServiceAccounts() {
    console.log('📊 Extracting existing service accounts from database...\n');

    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/intellicare_practice_global?replicaSet=rs0', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const db = mongoose.connection.db;

    // Get all existing service accounts
    const ServiceAccount = db.collection('ServiceAccounts');
    const existingServices = await ServiceAccount.find({}).toArray();

    console.log(`Found ${existingServices.length} service accounts in database`);

    if (existingServices.length > 0) {
        console.log('\nExisting services:');
        existingServices.forEach(service => {
            console.log(`  - ${service.serviceId} (status: ${service.status})`);
        });
    }

    // Count documents in important collections
    console.log('\n📈 Collection statistics:');
    const collections = [
        'ServiceAccounts',
        'Practices',
        'users',
        'patients',
        'appointments',
        'documents',
        'chat_sessions',
        'chat_messages',
        'audit_logs',
        'agent_memories'
    ];

    for (const collName of collections) {
        try {
            const count = await db.collection(collName).countDocuments();
            console.log(`  ${collName}: ${count} documents`);
        } catch (err) {
            console.log(`  ${collName}: collection not found`);
        }
    }

    await mongoose.connection.close();

    console.log('\n✅ Database analysis complete!');
    console.log('\nNote: The Windows MongoDB data files contain the encrypted data.');
    console.log('Since we have the KMS keys, the application should be able to decrypt the data.');
}

extractServiceAccounts().catch(console.error);