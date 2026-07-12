#!/bin/bash

echo "🔧 Fixing MongoDB configuration..."

# Create correct MongoDB configuration without journal.enabled
sudo tee /etc/mongod.conf > /dev/null << 'MONGOCONF'
# mongod.conf for IntelliCare with Authentication

# Where and how to store data
storage:
  dbPath: /var/lib/mongodb

# Where to write logging data
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

# Security - Enable authentication with keyfile
security:
  authorization: enabled
  keyFile: /etc/mongodb/mongodb-keyfile

# Replica Set configuration
replication:
  replSetName: rs0

# Disable localhost authentication bypass
setParameter:
  enableLocalhostAuthBypass: 0
MONGOCONF

echo "✅ MongoDB configuration fixed"

# Generate keyfile if it doesn't exist
if [ ! -f /etc/mongodb/mongodb-keyfile ]; then
    echo "📁 Generating MongoDB keyfile..."
    sudo mkdir -p /etc/mongodb
    sudo openssl rand -base64 756 | sudo tee /etc/mongodb/mongodb-keyfile > /dev/null
    sudo chmod 400 /etc/mongodb/mongodb-keyfile
    sudo chown mongodb:mongodb /etc/mongodb/mongodb-keyfile
    echo "✅ Keyfile created"
fi

echo ""
echo "Restarting MongoDB..."
sudo systemctl restart mongod

sleep 3

if sudo systemctl is-active --quiet mongod; then
    echo "✅ MongoDB started successfully!"

    echo ""
    echo "Testing connection..."
    mongosh --quiet --eval "db.adminCommand('ping')" 2>/dev/null && echo "✅ MongoDB is responding" || echo "⚠️ MongoDB running but auth may be needed"
else
    echo "❌ MongoDB failed to start. Checking logs..."
    sudo journalctl -u mongod -n 20 --no-pager | grep -E "(error|Error|ERROR|failed|Failed)"
fi