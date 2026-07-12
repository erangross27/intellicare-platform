#!/bin/bash

echo "🔧 Fixing all service authentication and permission errors..."
echo "=================================================="

cd /home/erangross/Development/IntelliCare/apps/backend-api

# Script to delete all ServiceAccount records so they can re-register with correct API keys
node -e "
const mongoose = require('mongoose');

(async () => {
    try {
        console.log('📝 Connecting to MongoDB...');
        await mongoose.connect('mongodb://intellicare_app:<DB_PASSWORD>@localhost:27017/intellicare_practice_global?authSource=admin&replicaSet=rs0');
        
        console.log('🗑️ Deleting all ServiceAccount records...');
        
        // Try all possible collection names
        const db = mongoose.connection.db;
        
        // Delete from all ServiceAccount collections
        const collections = ['ServiceAccount', 'ServiceAccounts', 'serviceaccounts'];
        
        for (const collName of collections) {
            try {
                const result = await db.collection(collName).deleteMany({});
                if (result.deletedCount > 0) {
                    console.log(\`  ✅ Deleted \${result.deletedCount} records from \${collName}\`);
                }
            } catch(e) {
                // Collection might not exist
            }
        }
        
        console.log('✅ All ServiceAccount records deleted');
        console.log('ℹ️ Services will auto-register on restart with new API keys');
        
        await mongoose.connection.close();
    } catch(e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
})();
"

echo ""
echo "📝 Ensuring all collections exist with proper permissions..."

# Create all required collections and set permissions
mongosh --quiet --eval "
try {
    db = db.getSiblingDB('admin');
    db.auth('intellicare_admin', 'CHANGE_ME_PASSWORD');
    
    // Switch to global database
    db = db.getSiblingDB('intellicare_practice_global');
    
    // List of required collections
    const collections = [
        'ServiceAccount', 'ServiceAccounts', 'serviceaccounts',
        'users', 'practices', 'Practices', 'patients',
        'appointments', 'documents', 'chat_sessions', 'chat_messages',
        'audit_logs', 'agent_memories', 'function_analytics',
        'SecurityPolicies', 'dataAccessPolicies', 'cache_metadata',
        'billing_codes', 'payer_configurations', 'drug_information',
        'workflow_templates', 'learning_data', 'procedures'
    ];
    
    print('📁 Creating missing collections...');
    for (const coll of collections) {
        if (!db.getCollectionNames().includes(coll)) {
            db.createCollection(coll);
            print('  ✅ Created collection: ' + coll);
        }
    }
    
    // Grant permissions to app user for all collections
    db.getSiblingDB('admin').grantRolesToUser('intellicare_app', [
        { role: 'readWrite', db: 'intellicare_practice_global' },
        { role: 'dbAdmin', db: 'intellicare_practice_global' }
    ]);
    
    print('✅ All collections created and permissions set');
    
} catch(e) {
    print('❌ Error: ' + e.message);
}
"

echo ""
echo "🔄 Restarting backend to trigger service re-registration..."
pkill -f "node.*server.js"
sleep 2

echo "✅ All fixes applied!"
echo ""
echo "The backend will restart automatically via nodemon."
echo "Services will re-register with new API keys from KMS."
echo "=================================================="
