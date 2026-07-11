# Phase 3: Database Migration

## Overview
Migrate local MongoDB database to MongoDB Atlas on Google Cloud Platform.

## Prerequisites
- MongoDB Atlas account created
- Local MongoDB running with IntelliCare data
- Atlas cluster configured on Google Cloud
- Network access configured

## Tasks Breakdown

### Task 3.1: Atlas Cluster Configuration (45 minutes)
**Objective**: Set up production-ready MongoDB Atlas cluster

**Cluster Specifications** (HIPAA COMPLIANT):
- **Tier**: M10 (2GB RAM, 10GB Storage) - MINIMUM for HIPAA compliance
- **Region**: us-central1 (Iowa) - US region required for HIPAA
- **Cloud Provider**: Google Cloud Platform
- **MongoDB Version**: 6.0 (latest stable)
- **Backup**: Enabled with continuous backup and encryption
- **Encryption**: At rest and in transit (REQUIRED for HIPAA)
- **Network**: VPC peering or private endpoints (HIPAA requirement)

**Configuration Steps**:
1. Create cluster in MongoDB Atlas
2. Configure network access
3. Create database users
4. Set up connection strings
5. Configure backup policies

**Network Security**:
```bash
# Atlas Network Access Configuration
# Add IP addresses that will access the cluster:
# - Your development machine IP
# - Cloud Run IP ranges (0.0.0.0/0 for Cloud Run, secured by authentication)
# - VPC CIDR if using private networking
```

**Database Users**:
```javascript
// Create application user with appropriate permissions
{
  "username": "intellicare-app",
  "password": "secure-generated-password",
  "roles": [
    {
      "role": "readWrite",
      "db": "intellicare"
    }
  ]
}

// Create backup user (read-only)
{
  "username": "intellicare-backup",
  "password": "secure-backup-password", 
  "roles": [
    {
      "role": "read",
      "db": "intellicare"
    }
  ]
}
```

### Task 3.2: Data Export from Local MongoDB (30 minutes)
**Objective**: Export all data from local MongoDB instance

**Export Commands**:
```bash
# Create backup directory
mkdir -p mongodb-backup/$(date +%Y%m%d_%H%M%S)
cd mongodb-backup/$(date +%Y%m%d_%H%M%S)

# Export all collections
mongodump --host localhost:27017 --db intellicare --out ./

# Verify export
ls -la intellicare/

# Expected collections:
# - patients.bson
# - documents.bson  
# - translations.bson
# - ai_prompts.bson
# - users.bson (if exists)
```

**Data Validation**:
```bash
# Check collection counts
mongo intellicare --eval "
  print('Patients: ' + db.patients.count());
  print('Documents: ' + db.documents.count());
  print('Translations: ' + db.translations.count());
  print('AI Prompts: ' + db.ai_prompts.count());
"

# Export to JSON for verification
mongoexport --host localhost:27017 --db intellicare --collection patients --out patients.json
mongoexport --host localhost:27017 --db intellicare --collection translations --out translations.json
```

### Task 3.3: Data Import to Atlas (40 minutes)
**Objective**: Import data to MongoDB Atlas cluster

**Connection String**:
```bash
# Atlas connection string format
ATLAS_URI="mongodb+srv://intellicare-app:<DB_PASSWORD>@cluster0.xxxxx.mongodb.net/intellicare?retryWrites=true&w=majority"
```

**Import Commands**:
```bash
# Import using mongorestore
mongorestore --uri="$ATLAS_URI" --drop ./intellicare/

# Verify import
mongo "$ATLAS_URI" --eval "
  print('Patients: ' + db.patients.count());
  print('Documents: ' + db.documents.count());
  print('Translations: ' + db.translations.count());
  print('AI Prompts: ' + db.ai_prompts.count());
"
```

**Index Creation**:
```javascript
// Connect to Atlas and create indexes
use intellicare;

// Patient indexes
db.patients.createIndex({ "email": 1 }, { unique: true });
db.patients.createIndex({ "fullName": 1 });
db.patients.createIndex({ "createdAt": -1 });

// Document indexes
db.documents.createIndex({ "patientId": 1 });
db.documents.createIndex({ "category": 1 });
db.documents.createIndex({ "uploadDate": -1 });
db.documents.createIndex({ "patientId": 1, "category": 1 });

// Translation indexes
db.translations.createIndex({ "key": 1, "language": 1 }, { unique: true });
db.translations.createIndex({ "language": 1 });

// AI Prompts indexes
db.ai_prompts.createIndex({ "type": 1 });
db.ai_prompts.createIndex({ "category": 1 });
```

### Task 3.4: Connection String Updates (20 minutes)
**Objective**: Update application configuration for Atlas

**Backend Configuration**:
```javascript
// backend/config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferMaxEntries: 0, // Disable mongoose buffering
      bufferCommands: false, // Disable mongoose buffering
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
```

**Environment Variables**:
```bash
# Update backend/.env.production
MONGODB_URI=mongodb+srv://intellicare-app:<DB_PASSWORD>@cluster0.xxxxx.mongodb.net/intellicare?retryWrites=true&w=majority

# For Google Secret Manager
gcloud secrets create mongodb-uri --data-file=- <<< "mongodb+srv://intellicare-app:<DB_PASSWORD>@cluster0.xxxxx.mongodb.net/intellicare?retryWrites=true&w=majority"
```

### Task 3.5: Data Validation and Testing (35 minutes)
**Objective**: Verify data integrity and application functionality

**Data Integrity Checks**:
```javascript
// scripts/validate-migration.js
const mongoose = require('mongoose');

async function validateMigration() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Check collection counts
    const patients = await mongoose.connection.db.collection('patients').countDocuments();
    const documents = await mongoose.connection.db.collection('documents').countDocuments();
    const translations = await mongoose.connection.db.collection('translations').countDocuments();
    const aiPrompts = await mongoose.connection.db.collection('ai_prompts').countDocuments();
    
    console.log('Migration Validation Results:');
    console.log(`Patients: ${patients}`);
    console.log(`Documents: ${documents}`);
    console.log(`Translations: ${translations}`);
    console.log(`AI Prompts: ${aiPrompts}`);
    
    // Test sample queries
    const samplePatient = await mongoose.connection.db.collection('patients').findOne();
    console.log('Sample patient:', samplePatient ? 'Found' : 'Not found');
    
    const sampleTranslation = await mongoose.connection.db.collection('translations').findOne({ language: 'en' });
    console.log('Sample translation:', sampleTranslation ? 'Found' : 'Not found');
    
    console.log('Migration validation completed successfully!');
  } catch (error) {
    console.error('Migration validation failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

validateMigration();
```

**Application Testing**:
```bash
# Test backend with Atlas connection
cd backend
MONGODB_URI="mongodb+srv://..." npm start

# Test API endpoints
curl http://localhost:5000/api/patients
curl http://localhost:5000/api/translations
```

### Task 3.6: Performance Optimization (25 minutes)
**Objective**: Optimize database performance for production

**Connection Pool Configuration**:
```javascript
// Optimized connection settings
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10, // Maximum number of connections
  minPoolSize: 2,  // Minimum number of connections
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  serverSelectionTimeoutMS: 5000, // How long to try selecting a server
  socketTimeoutMS: 45000, // How long a send or receive on a socket can take
  heartbeatFrequencyMS: 10000, // How often to check server status
  retryWrites: true,
  w: 'majority'
};
```

**Query Optimization**:
```javascript
// Add compound indexes for common queries
db.documents.createIndex({ 
  "patientId": 1, 
  "category": 1, 
  "uploadDate": -1 
});

// Add text index for search functionality
db.patients.createIndex({
  "fullName": "text",
  "email": "text"
});

// Add sparse index for optional fields
db.patients.createIndex({ "phone": 1 }, { sparse: true });
```

### Task 3.7: Backup and Recovery Setup (30 minutes)
**Objective**: Configure automated backups and recovery procedures

**Atlas Backup Configuration**:
1. Enable continuous backup (already enabled in M10+)
2. Configure backup retention (default: 2 days)
3. Set up point-in-time recovery
4. Configure backup alerts

**Manual Backup Script**:
```bash
#!/bin/bash
# scripts/backup-database.sh

BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
ATLAS_URI="mongodb+srv://intellicare-backup:<DB_PASSWORD>@cluster0.xxxxx.mongodb.net/intellicare"

mkdir -p $BACKUP_DIR

echo "Starting database backup..."
mongodump --uri="$ATLAS_URI" --out $BACKUP_DIR

# Compress backup
tar -czf "${BACKUP_DIR}.tar.gz" $BACKUP_DIR
rm -rf $BACKUP_DIR

# Upload to Cloud Storage
gsutil cp "${BACKUP_DIR}.tar.gz" gs://intellicare-backups/

echo "Backup completed: ${BACKUP_DIR}.tar.gz"
```

**Recovery Testing**:
```bash
# Test recovery procedure
mongorestore --uri="$ATLAS_URI" --drop ./test-backup/intellicare/
```

## Validation Checklist

- [ ] Atlas cluster configured and running
- [ ] Local data exported successfully
- [ ] Data imported to Atlas without errors
- [ ] All collections and documents migrated
- [ ] Indexes created and optimized
- [ ] Connection strings updated
- [ ] Application connects to Atlas
- [ ] Data integrity validated
- [ ] Performance optimized
- [ ] Backup and recovery tested

## Performance Targets

### Database Metrics
- **Connection time**: < 2 seconds
- **Query response time**: < 100ms for simple queries
- **Concurrent connections**: Support 50+ connections
- **Uptime**: 99.9% availability
- **Backup frequency**: Continuous with point-in-time recovery

### Monitoring Setup
```javascript
// Add database monitoring
const mongoose = require('mongoose');

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});
```

## Next Steps
Proceed to Phase 4: Cloud Deployment

## Troubleshooting

### Common Issues
1. **Connection timeouts**: Check network access and firewall rules
2. **Authentication failures**: Verify username/password and database permissions
3. **Import errors**: Check data format and collection names
4. **Performance issues**: Review indexes and connection pool settings

### Monitoring Commands
```bash
# Check Atlas cluster status
# Use Atlas UI or MongoDB Compass

# Monitor connection pool
db.runCommand({ "serverStatus": 1 }).connections

# Check index usage
db.collection.getIndexes()
db.collection.aggregate([{ $indexStats: {} }])
```
