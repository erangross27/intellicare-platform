#!/bin/bash

# IntelliCare Restoration Script for Ubuntu
# Restores data from Windows backup to Ubuntu system

set -e

echo "================================================"
echo "IntelliCare Windows to Ubuntu Restoration"
echo "================================================"

# Check if backup directory is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_directory>"
    echo "Example: $0 ~/IntelliCare_Backup_2024-01-20_10-30-00"
    exit 1
fi

BACKUP_DIR="$1"
INTELLICARE_HOME="/home/$USER/IntelliCare"

# Verify backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "Error: Backup directory not found: $BACKUP_DIR"
    exit 1
fi

echo "Restoring from: $BACKUP_DIR"
echo "Target directory: $INTELLICARE_HOME"
echo ""
read -p "This will overwrite existing data. Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# 1. Stop services if running
echo -e "\n[1/8] Stopping services..."
sudo systemctl stop intellicare-frontend intellicare-backend redis-server mongod 2>/dev/null || true

# 2. Restore application code
echo -e "\n[2/8] Restoring application code..."
if [ -d "$BACKUP_DIR/code" ]; then
    # Backend
    if [ -d "$BACKUP_DIR/code/backend-api" ]; then
        rm -rf $INTELLICARE_HOME/apps/backend-api/*
        cp -r $BACKUP_DIR/code/backend-api/* $INTELLICARE_HOME/apps/backend-api/
        echo "Backend code restored"
    fi

    # Frontend
    if [ -d "$BACKUP_DIR/code/frontend-vite" ]; then
        rm -rf $INTELLICARE_HOME/apps/frontend-vite/*
        cp -r $BACKUP_DIR/code/frontend-vite/* $INTELLICARE_HOME/apps/frontend-vite/
        echo "Frontend code restored"
    fi

    # Data files
    if [ -d "$BACKUP_DIR/code/data" ]; then
        cp -r $BACKUP_DIR/code/data $INTELLICARE_HOME/
        echo "Data files restored"
    fi

    # Root files
    cp $BACKUP_DIR/code/*.md $INTELLICARE_HOME/ 2>/dev/null || true
    cp $BACKUP_DIR/code/*.json $INTELLICARE_HOME/ 2>/dev/null || true
fi

# 3. Restore security keys and environment files
echo -e "\n[3/8] Restoring security keys..."
if [ -d "$BACKUP_DIR/security" ]; then
    # KMS keys
    if [ -d "$BACKUP_DIR/security/kms" ]; then
        mkdir -p $INTELLICARE_HOME/apps/backend-api/.kms
        cp -r $BACKUP_DIR/security/kms/* $INTELLICARE_HOME/apps/backend-api/.kms/
        chmod -R 600 $INTELLICARE_HOME/apps/backend-api/.kms
        echo "KMS keys restored"
    fi

    # KMS storage
    if [ -d "$BACKUP_DIR/security/kms-storage" ]; then
        mkdir -p $INTELLICARE_HOME/apps/backend-api/kms-storage
        cp -r $BACKUP_DIR/security/kms-storage/* $INTELLICARE_HOME/apps/backend-api/kms-storage/
        chmod -R 600 $INTELLICARE_HOME/apps/backend-api/kms-storage
        echo "KMS storage restored"
    fi

    # Environment files
    if [ -f "$BACKUP_DIR/security/backend.env" ]; then
        cp $BACKUP_DIR/security/backend.env $INTELLICARE_HOME/apps/backend-api/.env
        echo "Backend environment file restored"
    fi

    cp $BACKUP_DIR/security/.env* $INTELLICARE_HOME/apps/frontend-vite/ 2>/dev/null || true
fi

# 4. Update configuration for Ubuntu
echo -e "\n[4/8] Updating configurations for Ubuntu..."

# Update MongoDB connection strings
if [ -f "$INTELLICARE_HOME/apps/backend-api/.env" ]; then
    # Update file paths from Windows to Linux format
    sed -i 's|C:\\Users\\[^\\]*\\IntelliCare|'"$INTELLICARE_HOME"'|g' $INTELLICARE_HOME/apps/backend-api/.env
    sed -i 's|\\|/|g' $INTELLICARE_HOME/apps/backend-api/.env

    # Update Memurai references to Redis
    sed -i 's|MEMURAI_|REDIS_|g' $INTELLICARE_HOME/apps/backend-api/.env
    sed -i 's|memurai|redis|g' $INTELLICARE_HOME/apps/backend-api/.env
fi

# Create Linux-specific configuration updates script
cat > $INTELLICARE_HOME/update-configs.js <<'EOF'
const fs = require('fs');
const path = require('path');

// Update backend configuration files
const backendPath = path.join(__dirname, 'apps/backend-api');

// Update all service files that reference Memurai
const servicesPath = path.join(backendPath, 'services');
if (fs.existsSync(servicesPath)) {
    const files = fs.readdirSync(servicesPath);
    files.forEach(file => {
        if (file.endsWith('.js')) {
            const filePath = path.join(servicesPath, file);
            let content = fs.readFileSync(filePath, 'utf8');

            // Replace Memurai with Redis
            content = content.replace(/memurai/gi, 'redis');
            content = content.replace(/Memurai/g, 'Redis');

            // Update Windows paths
            content = content.replace(/C:\\Users\\[^\\]+\\IntelliCare/g, process.env.HOME + '/IntelliCare');
            content = content.replace(/\\/g, '/');

            fs.writeFileSync(filePath, content);
        }
    });
    console.log('Service files updated');
}

console.log('Configuration update complete');
EOF

node $INTELLICARE_HOME/update-configs.js

# 5. Install NPM dependencies
echo -e "\n[5/8] Installing NPM dependencies..."

# Backend dependencies
echo "Installing backend dependencies..."
cd $INTELLICARE_HOME/apps/backend-api
npm install

# Frontend dependencies
echo "Installing frontend dependencies..."
cd $INTELLICARE_HOME/apps/frontend-vite
npm install

# Build frontend for production
npm run build

cd $INTELLICARE_HOME

# 6. Restore MongoDB data
echo -e "\n[6/8] Restoring MongoDB data..."

# Start MongoDB without auth first
sudo systemctl stop mongod
sudo sed -i 's/authorization: enabled/authorization: disabled/g' /etc/mongod.conf
sudo systemctl start mongod
sleep 5

# Initialize replica set if not already done
mongosh --eval "rs.status()" 2>/dev/null || mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})"
sleep 5

# Restore all databases
if [ -d "$BACKUP_DIR/mongodb/dump" ]; then
    mongorestore --drop $BACKUP_DIR/mongodb/dump
    echo "MongoDB data restored"
fi

# Restore users and roles
if [ -f "$BACKUP_DIR/mongodb/users.json" ]; then
    mongoimport --db admin --collection system.users --file $BACKUP_DIR/mongodb/users.json --drop
    echo "MongoDB users restored"
fi

if [ -f "$BACKUP_DIR/mongodb/roles.json" ]; then
    mongoimport --db admin --collection system.roles --file $BACKUP_DIR/mongodb/roles.json --drop 2>/dev/null || true
    echo "MongoDB roles restored"
fi

# Re-enable authentication
sudo sed -i 's/authorization: disabled/authorization: enabled/g' /etc/mongod.conf
sudo systemctl restart mongod

# 7. Restore Redis data
echo -e "\n[7/8] Restoring Redis data..."
if [ -f "$BACKUP_DIR/redis/dump.rdb" ]; then
    sudo systemctl stop redis-server
    sudo cp $BACKUP_DIR/redis/dump.rdb /var/lib/redis/dump.rdb
    sudo chown redis:redis /var/lib/redis/dump.rdb
    sudo systemctl start redis-server
    echo "Redis data restored"
fi

# 8. Restore logs and backups
echo -e "\n[8/8] Restoring logs and backups..."
if [ -d "$BACKUP_DIR/logs" ]; then
    cp -r $BACKUP_DIR/logs/* $INTELLICARE_HOME/logs/ 2>/dev/null || true
    echo "Logs restored"
fi

# Set proper permissions
chown -R $USER:$USER $INTELLICARE_HOME
chmod -R 755 $INTELLICARE_HOME
chmod -R 600 $INTELLICARE_HOME/apps/backend-api/.kms
chmod -R 600 $INTELLICARE_HOME/apps/backend-api/kms-storage

# Create post-restoration verification script
cat > $INTELLICARE_HOME/verify-migration.sh <<'EOF'
#!/bin/bash

echo "Verifying IntelliCare migration..."
echo ""

# Check MongoDB
echo -n "MongoDB Status: "
if mongosh --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "✓ Running"
    mongosh --quiet --eval "db.adminCommand('listDatabases')" | grep intellicare_practice
else
    echo "✗ Not accessible"
fi

# Check Redis
echo -n "Redis Status: "
if redis-cli ping > /dev/null 2>&1; then
    echo "✓ Running"
    echo "Keys in Redis: $(redis-cli dbsize | cut -d' ' -f2)"
else
    echo "✗ Not running"
fi

# Check Node.js
echo -n "Node.js: "
node --version

# Check NPM
echo -n "NPM: "
npm --version

# Check services
echo ""
echo "Service Status:"
systemctl status intellicare-backend --no-pager | head -3
systemctl status intellicare-frontend --no-pager | head -3

# Check API endpoints
echo ""
echo "Testing API endpoints..."
curl -s http://localhost:5000/api/health > /dev/null 2>&1 && echo "✓ Backend API responding" || echo "✗ Backend API not responding"
curl -s http://localhost:3000 > /dev/null 2>&1 && echo "✓ Frontend responding" || echo "✗ Frontend not responding"

echo ""
echo "Verification complete!"
EOF

chmod +x $INTELLICARE_HOME/verify-migration.sh

echo ""
echo "================================================"
echo "✅ Restoration Complete!"
echo "================================================"
echo ""
echo "Next Steps:"
echo "1. Verify MongoDB authentication:"
echo "   mongosh -u intellicare_app -p YOUR_PASSWORD --authenticationDatabase admin"
echo ""
echo "2. Start services:"
echo "   sudo systemctl start intellicare-backend intellicare-frontend"
echo ""
echo "3. Verify migration:"
echo "   ./verify-migration.sh"
echo ""
echo "4. Update DNS to point to new Ubuntu server"
echo ""
echo "5. Configure SSL certificates for production"
echo ""
echo "Important Notes:"
echo "- Update MongoDB passwords if needed"
echo "- Check application logs: tail -f $INTELLICARE_HOME/logs/*.log"
echo "- Redis is now used instead of Memurai"
echo "- All paths have been updated from Windows to Linux format"
echo ""