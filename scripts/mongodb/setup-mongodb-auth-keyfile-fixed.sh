#!/bin/bash

echo "🔐 Setting up MongoDB with Replica Set Authentication and Keyfile"
echo "================================================================="
echo ""

# Step 1: Generate keyfile for replica set authentication
echo "1️⃣ Generating keyfile for replica set authentication..."
sudo mkdir -p /etc/mongodb
sudo openssl rand -base64 756 | sudo tee /etc/mongodb/mongodb-keyfile > /dev/null
sudo chmod 400 /etc/mongodb/mongodb-keyfile
sudo chown mongodb:mongodb /etc/mongodb/mongodb-keyfile
echo "✅ Keyfile created at /etc/mongodb/mongodb-keyfile"

# Step 2: Update MongoDB configuration with keyfile
echo ""
echo "2️⃣ Updating MongoDB configuration..."
sudo tee /etc/mongod.conf > /dev/null << 'MONGOCONF'
# mongod.conf for IntelliCare with Authentication

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

# Security - Enable authentication with keyfile
security:
  authorization: enabled
  keyFile: /etc/mongodb/mongodb-keyfile

# Replica Set configuration
replication:
  replSetName: rs0
MONGOCONF

echo "✅ MongoDB configuration updated with keyfile authentication"

# Step 3: Restart MongoDB
echo ""
echo "3️⃣ Restarting MongoDB service..."
sudo systemctl restart mongod

# Wait for MongoDB to start
echo "Waiting for MongoDB to start..."
sleep 5

# Step 4: Check if MongoDB started successfully
if sudo systemctl is-active --quiet mongod; then
    echo "✅ MongoDB started successfully!"
    echo ""
    echo "4️⃣ Testing authentication..."
    mongosh --quiet --eval "
    try {
        db = db.getSiblingDB('admin');
        db.auth('intellicare_admin', 'CHANGE_ME_PASSWORD');
        print('✅ Admin authentication successful!');
        const dbs = db.adminCommand('listDatabases');
        print('✅ Found ' + dbs.databases.length + ' databases');
    } catch(e) {
        print('⚠️ Auth test: ' + e.message);
    }
    " 2>/dev/null || true
else
    echo "❌ MongoDB failed to start"
    echo "Check logs: sudo journalctl -u mongod -n 50"
fi

echo ""
echo "================================================================="
echo "✅ Setup Complete! Backend should now connect with auth enabled."
echo "================================================================="
