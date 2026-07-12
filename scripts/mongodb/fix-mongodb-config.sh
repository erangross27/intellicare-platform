#!/bin/bash

echo "🔧 Fixing MongoDB configuration..."
echo ""

# Create a working MongoDB config without the setParameter section that might be causing issues
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
EOF

echo "✅ Configuration updated (removed setParameter section)"
echo ""

# Restart MongoDB
echo "Restarting MongoDB..."
sudo systemctl restart mongod

sleep 3

# Check status
if sudo systemctl is-active --quiet mongod; then
    echo "✅ MongoDB started successfully!"
    echo ""
    echo "Testing authentication..."

    # Test with the admin user
    mongosh --quiet --eval "
    try {
        db = db.getSiblingDB('admin');
        db.auth('intellicare_admin', 'CHANGE_ME_PASSWORD');
        print('✅ Authentication successful!');
        const dbs = db.adminCommand('listDatabases');
        print('✅ Found ' + dbs.databases.length + ' databases');
        dbs.databases.forEach(d => print('  - ' + d.name));
    } catch(e) {
        print('⚠️  Auth test failed: ' + e);
        print('This is normal if replica set is not initialized yet.');
    }
    "
else
    echo "❌ MongoDB failed to start"
    echo ""
    echo "Checking logs..."
    sudo journalctl -u mongod -n 20 --no-pager
fi

echo ""
echo "=================================================="