#!/bin/bash

echo "📝 Creating MongoDB users..."

# Create admin user
mongosh --quiet --eval "
try {
    db = db.getSiblingDB('admin');
    
    // Try to create admin user
    db.createUser({
        user: 'intellicare_admin',
        pwd: 'CHANGE_ME_PASSWORD',
        roles: ['root']
    });
    print('✅ Created intellicare_admin user');
} catch(e) {
    if (e.codeName === 'DuplicateKey') {
        print('ℹ️ Admin user already exists');
    } else {
        print('❌ Error creating admin user: ' + e.message);
    }
}

// Try to create app user
try {
    db.createUser({
        user: 'intellicare_app',
        pwd: 'CHANGE_ME_PASSWORD',
        roles: [
            { role: 'readWrite', db: 'intellicare_practice_global' },
            { role: 'readWrite', db: 'admin' },
            { role: 'clusterMonitor', db: 'admin' }
        ]
    });
    print('✅ Created intellicare_app user');
} catch(e) {
    if (e.codeName === 'DuplicateKey') {
        print('ℹ️ App user already exists');
    } else {
        print('❌ Error creating app user: ' + e.message);
    }
}
"

echo ""
echo "Testing authentication..."

# Test admin authentication
mongosh --quiet --eval "
try {
    db = db.getSiblingDB('admin');
    db.auth('intellicare_admin', 'CHANGE_ME_PASSWORD');
    print('✅ Admin authentication successful');
    
    // List databases
    const dbs = db.adminCommand('listDatabases');
    print('✅ Found ' + dbs.databases.length + ' databases');
    
    // Check replica set status
    const status = rs.status();
    print('✅ Replica set: ' + status.set);
    
    db.logout();
    
    // Test app user
    db.auth('intellicare_app', 'CHANGE_ME_PASSWORD');
    print('✅ App user authentication successful');
} catch(e) {
    print('❌ Auth test failed: ' + e.message);
}
"
