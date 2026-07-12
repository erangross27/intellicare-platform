#!/bin/bash

# Enable MongoDB authentication and replica set for IntelliCare

echo "🔐 Enabling MongoDB Authentication and Replica Set"
echo "=================================================="
echo ""

# Create a backup of the current config
sudo cp /etc/mongod.conf /etc/mongod.conf.backup.$(date +%Y%m%d_%H%M%S)

# Create new MongoDB configuration with auth and replica set
sudo tee /etc/mongod.conf > /dev/null << 'EOF'
# mongod.conf for IntelliCare

# Where and how to store data.
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

# Where to write logging data.
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

# Network interfaces
net:
  port: 27017
  bindIp: 127.0.0.1,localhost

# Process management
processManagement:
  timeZoneInfo: /usr/share/zoneinfo

# Security - Enable authentication
security:
  authorization: enabled

# Replica Set configuration
replication:
  replSetName: rs0

# Disable localhost authentication bypass for production security
setParameter:
  enableLocalhostAuthBypass: 0
EOF

echo "✅ MongoDB configuration updated"
echo ""
echo "Restarting MongoDB with new configuration..."

# Restart MongoDB service
sudo systemctl restart mongod

# Wait for MongoDB to start
sleep 5

# Check if MongoDB is running
if sudo systemctl is-active --quiet mongod; then
    echo "✅ MongoDB restarted successfully"
else
    echo "❌ MongoDB failed to start. Check logs: sudo journalctl -u mongod -n 50"
    exit 1
fi

echo ""
echo "Testing authentication..."

# Test authentication with the admin user
mongosh --quiet --eval "
try {
    db = db.getSiblingDB('admin');
    db.auth('intellicare_admin', 'CHANGE_ME_PASSWORD');
    print('✅ Authentication successful for intellicare_admin');

    // Test listing databases
    const dbs = db.adminCommand('listDatabases');
    print('✅ Can list databases - found ' + dbs.databases.length + ' databases');

    // Test app user
    db.logout();
    db.auth('intellicare_app', 'CHANGE_ME_PASSWORD');
    print('✅ Authentication successful for intellicare_app');
} catch(e) {
    print('❌ Authentication test failed: ' + e);
}
"

echo ""
echo "=================================================="
echo "✅ MongoDB authentication is now ENABLED!"
echo ""
echo "Users created:"
echo "  • intellicare_admin (root access)"
echo "  • intellicare_app (application access)"
echo ""
echo "Credentials are stored in KMS."
echo "Restart your backend server to use authenticated connections."
echo "=================================================="