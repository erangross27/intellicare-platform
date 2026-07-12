#!/bin/bash

# IntelliCare Ubuntu Setup Script
# Complete installation guide for migrating from Windows to Ubuntu
# Tested on Ubuntu 22.04 LTS and 24.04 LTS

set -e

echo "================================================"
echo "IntelliCare Ubuntu Migration Setup"
echo "================================================"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "This script should not be run as root!"
   exit 1
fi

# Configuration variables
INTELLICARE_USER=$USER
INTELLICARE_HOME="/home/$INTELLICARE_USER/IntelliCare"
MONGODB_VERSION="6.0"
NODE_VERSION="18"
REDIS_VERSION="7"

echo "Installing for user: $INTELLICARE_USER"
echo "Installation directory: $INTELLICARE_HOME"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# 1. System Update
echo -e "\n[1/10] Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Essential Tools
echo -e "\n[2/10] Installing essential tools..."
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    unzip \
    p7zip-full \
    net-tools \
    ufw

# 3. Install Node.js 18 LTS
echo -e "\n[3/10] Installing Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version

# 4. Install MongoDB 6.0 with Replica Set Support
echo -e "\n[4/10] Installing MongoDB $MONGODB_VERSION..."
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-${MONGODB_VERSION}.asc | sudo apt-key add -

# Create list file for MongoDB
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/${MONGODB_VERSION} multiverse" | \
    sudo tee /etc/apt/sources.list.d/mongodb-org-${MONGODB_VERSION}.list

# Update and install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Enable and start MongoDB
sudo systemctl daemon-reload
sudo systemctl enable mongod
sudo systemctl start mongod

# 5. Install Redis (Replacement for Memurai)
echo -e "\n[5/10] Installing Redis $REDIS_VERSION..."
sudo apt install -y redis-server

# Configure Redis for persistence (like Memurai)
sudo tee /etc/redis/redis.conf.d/intellicare.conf > /dev/null <<EOF
# IntelliCare Redis Configuration
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
maxmemory 2gb
maxmemory-policy allkeys-lru
EOF

sudo systemctl restart redis-server
sudo systemctl enable redis-server

# 6. Install PM2 for Process Management
echo -e "\n[6/10] Installing PM2..."
sudo npm install -g pm2
pm2 startup systemd -u $INTELLICARE_USER --hp /home/$INTELLICARE_USER

# 7. Create IntelliCare Directory Structure
echo -e "\n[7/10] Creating directory structure..."
mkdir -p $INTELLICARE_HOME
mkdir -p $INTELLICARE_HOME/apps/backend-api
mkdir -p $INTELLICARE_HOME/apps/frontend-vite
mkdir -p $INTELLICARE_HOME/data
mkdir -p $INTELLICARE_HOME/logs
mkdir -p $INTELLICARE_HOME/backups

# 8. Configure Firewall
echo -e "\n[8/10] Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 5000/tcp  # Backend API
sudo ufw allow 27017/tcp # MongoDB (only if needed externally)
echo "y" | sudo ufw enable

# 9. Create systemd services
echo -e "\n[9/10] Creating systemd services..."

# MongoDB Replica Set Configuration
sudo tee /etc/mongod.conf > /dev/null <<EOF
# MongoDB configuration for IntelliCare
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 127.0.0.1

processManagement:
  timeZoneInfo: /usr/share/zoneinfo

security:
  authorization: enabled

setParameter:
  enableLocalhostAuthBypass: 0

replication:
  replSetName: rs0
EOF

# IntelliCare Backend Service
sudo tee /etc/systemd/system/intellicare-backend.service > /dev/null <<EOF
[Unit]
Description=IntelliCare Backend API
After=network.target mongod.service redis.service

[Service]
Type=simple
User=$INTELLICARE_USER
WorkingDirectory=$INTELLICARE_HOME/apps/backend-api
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment="NODE_ENV=production"
StandardOutput=append:$INTELLICARE_HOME/logs/backend.log
StandardError=append:$INTELLICARE_HOME/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

# IntelliCare Frontend Service (Production Build)
sudo tee /etc/systemd/system/intellicare-frontend.service > /dev/null <<EOF
[Unit]
Description=IntelliCare Frontend
After=network.target

[Service]
Type=simple
User=$INTELLICARE_USER
WorkingDirectory=$INTELLICARE_HOME/apps/frontend-vite
ExecStart=/usr/bin/npm run preview
Restart=on-failure
RestartSec=10
Environment="NODE_ENV=production"
StandardOutput=append:$INTELLICARE_HOME/logs/frontend.log
StandardError=append:$INTELLICARE_HOME/logs/frontend-error.log

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload

# 10. Create helper scripts
echo -e "\n[10/10] Creating helper scripts..."

# MongoDB initialization script
cat > $INTELLICARE_HOME/init-mongodb.sh <<'EOF'
#!/bin/bash
# Initialize MongoDB Replica Set and Users

echo "Initializing MongoDB replica set..."
mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})"

sleep 5

echo "Creating MongoDB users..."
mongosh admin --eval "
db.createUser({
  user: 'intellicare_admin',
  pwd: 'CHANGE_THIS_PASSWORD',
  roles: ['root']
});

db.createUser({
  user: 'intellicare_app',
  pwd: 'CHANGE_THIS_PASSWORD',
  roles: [
    {role: 'readWrite', db: 'intellicare_practice_global'},
    {role: 'dbAdmin', db: 'intellicare_practice_global'}
  ]
});"

echo "MongoDB initialization complete!"
EOF

chmod +x $INTELLICARE_HOME/init-mongodb.sh

# Backup script
cat > $INTELLICARE_HOME/backup.sh <<'EOF'
#!/bin/bash
# IntelliCare Backup Script

BACKUP_DIR="/home/$USER/IntelliCare/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"

mkdir -p $BACKUP_PATH

echo "Starting backup..."

# MongoDB backup
mongodump --uri="mongodb://intellicare_app:<DB_PASSWORD>@localhost:27017/?authSource=admin&replicaSet=rs0" \
    --out="$BACKUP_PATH/mongodb"

# Redis backup
redis-cli BGSAVE
sleep 5
cp /var/lib/redis/dump.rdb $BACKUP_PATH/redis-dump.rdb

# Application files
tar czf $BACKUP_PATH/code.tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    /home/$USER/IntelliCare/apps

echo "Backup complete: $BACKUP_PATH"
EOF

chmod +x $INTELLICARE_HOME/backup.sh

# Service management script
cat > $INTELLICARE_HOME/manage-services.sh <<'EOF'
#!/bin/bash

case "$1" in
  start)
    echo "Starting IntelliCare services..."
    sudo systemctl start mongod redis-server intellicare-backend intellicare-frontend
    ;;
  stop)
    echo "Stopping IntelliCare services..."
    sudo systemctl stop intellicare-frontend intellicare-backend redis-server mongod
    ;;
  restart)
    echo "Restarting IntelliCare services..."
    sudo systemctl restart mongod redis-server intellicare-backend intellicare-frontend
    ;;
  status)
    echo "Service Status:"
    sudo systemctl status mongod redis-server intellicare-backend intellicare-frontend
    ;;
  logs)
    echo "Recent logs:"
    sudo journalctl -u intellicare-backend -n 50
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
EOF

chmod +x $INTELLICARE_HOME/manage-services.sh

echo ""
echo "================================================"
echo "✅ Ubuntu Setup Complete!"
echo "================================================"
echo ""
echo "Next Steps:"
echo "1. Transfer your backup files to: $INTELLICARE_HOME"
echo "2. Run the restoration script: ./RESTORE-FROM-WINDOWS.sh"
echo "3. Initialize MongoDB: ./init-mongodb.sh"
echo "4. Start services: ./manage-services.sh start"
echo ""
echo "Important Files:"
echo "- MongoDB Config: /etc/mongod.conf"
echo "- Redis Config: /etc/redis/redis.conf"
echo "- Services: /etc/systemd/system/intellicare-*.service"
echo "- Logs: $INTELLICARE_HOME/logs/"
echo ""
echo "Security Notes:"
echo "- Remember to change MongoDB passwords in init-mongodb.sh"
echo "- Update firewall rules as needed with 'sudo ufw'"
echo "- Configure SSL certificates for production"
echo ""