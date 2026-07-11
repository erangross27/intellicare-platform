# HIPAA Compliance Guide for IntelliCare

## Overview
IntelliCare handles Protected Health Information (PHI) and must comply with HIPAA regulations. This guide ensures full compliance during Google Cloud migration.

## HIPAA Requirements for IntelliCare

### Critical Compliance Elements
1. **Business Associate Agreements (BAA)**
2. **Data Encryption** (at rest and in transit)
3. **Access Controls** and audit logging
4. **Data Residency** (US-only)
5. **Backup and Recovery** procedures
6. **Incident Response** planning
7. **Risk Assessment** documentation

## Google Cloud HIPAA Compliance

### Task 7.1: Google Cloud BAA Setup (30 minutes)
**Objective**: Execute Business Associate Agreement with Google

**Steps**:
1. Contact Google Cloud sales for HIPAA BAA
2. Review and sign BAA documentation
3. Configure HIPAA-eligible services only
4. Document BAA execution

**HIPAA-Eligible Google Cloud Services**:
- ✅ **Cloud Run** (HIPAA compliant - our primary deployment platform)
- ✅ Cloud Storage (with encryption)
- ✅ Cloud Load Balancing
- ✅ Cloud CDN
- ✅ Secret Manager
- ✅ Cloud Monitoring/Logging (with data controls)
- ✅ Cloud Scheduler
- ✅ Cloud Source Repositories
- ❌ Cloud Functions (NOT HIPAA eligible)
- ❌ App Engine Standard (NOT HIPAA eligible)

**BAA Requirements**:
```bash
# Ensure project is configured for HIPAA
gcloud config set project intellicare-production

# Verify HIPAA-eligible regions (US only)
# us-central1, us-east1, us-east4, us-west1, us-west2, us-west3, us-west4
```

### Task 7.2: MongoDB Atlas HIPAA Configuration (45 minutes)
**Objective**: Enable HIPAA compliance on MongoDB Atlas

**Atlas HIPAA Requirements**:
- **Cluster Tier**: M10 or higher (M0, M2, M5 not HIPAA eligible)
- **Cloud Provider**: Google Cloud Platform
- **Region**: US regions only
- **Encryption**: Enabled at rest and in transit
- **Network**: Private endpoints or VPC peering
- **Backup**: Encrypted backups with retention policies

**Configuration Steps**:
```bash
# Atlas HIPAA Configuration Checklist:
# 1. Upgrade to M10+ cluster tier
# 2. Enable encryption at rest
# 3. Configure VPC peering or private endpoints
# 4. Set up encrypted backups
# 5. Enable audit logging
# 6. Configure IP whitelisting
# 7. Request HIPAA BAA from MongoDB
```

**Atlas Security Settings**:
```javascript
// Required Atlas configuration
{
  "clusterTier": "M10", // Minimum for HIPAA
  "providerSettings": {
    "providerName": "GCP",
    "regionName": "CENTRAL_US", // US region required
    "instanceSizeName": "M10"
  },
  "encryptionAtRestProvider": "GCP", // Enable encryption
  "backupEnabled": true,
  "pitEnabled": true, // Point-in-time recovery
  "replicationSpecs": [{
    "numShards": 1,
    "regionsConfig": {
      "CENTRAL_US": {
        "electableNodes": 3,
        "priority": 7,
        "readOnlyNodes": 0
      }
    }
  }]
}
```

### Task 7.3: Data Encryption Implementation (40 minutes)
**Objective**: Implement end-to-end encryption for PHI

**Application-Level Encryption**:
```javascript
// backend/utils/encryption.js
const crypto = require('crypto');

class PHIEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
  }

  // Encrypt PHI data before storing
  encrypt(text, key) {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  // Decrypt PHI data when retrieving
  decrypt(encryptedData, key) {
    const decipher = crypto.createDecipher(
      this.algorithm, 
      key, 
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

module.exports = PHIEncryption;
```

**Database Field Encryption**:
```javascript
// backend/models/Patient.js - Updated for PHI encryption
const mongoose = require('mongoose');
const PHIEncryption = require('../utils/encryption');

const patientSchema = new mongoose.Schema({
  // Non-PHI fields (not encrypted)
  patientId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  
  // PHI fields (encrypted)
  fullName: { 
    encrypted: String,
    iv: String,
    tag: String
  },
  email: {
    encrypted: String,
    iv: String, 
    tag: String
  },
  phone: {
    encrypted: String,
    iv: String,
    tag: String
  },
  medicalHistory: [{
    category: String, // Not encrypted (for querying)
    data: {
      encrypted: String,
      iv: String,
      tag: String
    },
    date: Date
  }]
});

// Encryption middleware
patientSchema.pre('save', function(next) {
  const encryption = new PHIEncryption();
  const key = process.env.PHI_ENCRYPTION_KEY;
  
  if (this.isModified('fullName') && typeof this.fullName === 'string') {
    this.fullName = encryption.encrypt(this.fullName, key);
  }
  
  next();
});

module.exports = mongoose.model('Patient', patientSchema);
```

### Task 7.4: Access Controls and Audit Logging (50 minutes)
**Objective**: Implement comprehensive access controls and audit trails

**IAM Configuration**:
```bash
# Create HIPAA-specific service accounts
gcloud iam service-accounts create intellicare-hipaa-service \
  --description="HIPAA-compliant service account for IntelliCare" \
  --display-name="IntelliCare HIPAA Service"

# Minimal permissions principle
gcloud projects add-iam-policy-binding intellicare-production \
  --member="serviceAccount:intellicare-hipaa-service@intellicare-production.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding intellicare-production \
  --member="serviceAccount:intellicare-hipaa-service@intellicare-production.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

# Enable audit logging
gcloud logging sinks create intellicare-audit-sink \
  bigquery.googleapis.com/projects/intellicare-production/datasets/audit_logs \
  --log-filter='protoPayload.serviceName="run.googleapis.com" OR protoPayload.serviceName="storage.googleapis.com"'
```

**Application Audit Logging**:
```javascript
// backend/middleware/auditLogger.js
const winston = require('winston');

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'audit.log',
      maxsize: 5242880, // 5MB
      maxFiles: 10
    })
  ]
});

const auditMiddleware = (req, res, next) => {
  const auditData = {
    timestamp: new Date().toISOString(),
    userId: req.user?.id || 'anonymous',
    action: `${req.method} ${req.path}`,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    sessionId: req.sessionID,
    requestId: req.headers['x-request-id']
  };

  // Log PHI access
  if (req.path.includes('/patients') || req.path.includes('/documents')) {
    auditData.phiAccess = true;
    auditData.resourceId = req.params.id;
  }

  auditLogger.info('API_ACCESS', auditData);
  next();
};

module.exports = auditMiddleware;
```

### Task 7.5: Network Security and Data Residency (35 minutes)
**Objective**: Ensure secure network configuration and US-only data storage

**VPC Configuration**:
```bash
# Create HIPAA-compliant VPC
gcloud compute networks create intellicare-hipaa-vpc \
  --subnet-mode=custom \
  --bgp-routing-mode=regional

# Create private subnet
gcloud compute networks subnets create intellicare-private-subnet \
  --network=intellicare-hipaa-vpc \
  --range=10.0.0.0/24 \
  --region=us-central1 \
  --enable-private-ip-google-access

# Configure firewall rules (restrictive)
gcloud compute firewall-rules create intellicare-allow-internal \
  --network=intellicare-hipaa-vpc \
  --allow=tcp,udp,icmp \
  --source-ranges=10.0.0.0/24

gcloud compute firewall-rules create intellicare-allow-https \
  --network=intellicare-hipaa-vpc \
  --allow=tcp:443 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=https-server
```

**Data Residency Verification**:
```bash
# Verify all resources are in US regions
gcloud compute instances list --format="table(name,zone)"
gcloud run services list --format="table(metadata.name,status.url)"
gcloud storage buckets list --format="table(name,location)"

# All resources must be in US regions:
# us-central1, us-east1, us-east4, us-west1, us-west2, us-west3, us-west4
```

### Task 7.6: Backup and Disaster Recovery (40 minutes)
**Objective**: Implement HIPAA-compliant backup and recovery procedures

**Encrypted Backup Strategy**:
```bash
# Create encrypted backup bucket
gsutil mb -p intellicare-production \
  -c STANDARD \
  -l us-central1 \
  --retention 2555d \
  gs://intellicare-hipaa-backups

# Enable bucket encryption
gsutil kms encryption \
  -k projects/intellicare-production/locations/us-central1/keyRings/intellicare-ring/cryptoKeys/backup-key \
  gs://intellicare-hipaa-backups

# Set lifecycle policy for retention
cat > backup-lifecycle.json << EOF
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 2555}
    }
  ]
}
EOF

gsutil lifecycle set backup-lifecycle.json gs://intellicare-hipaa-backups
```

**Automated Backup Script**:
```bash
#!/bin/bash
# scripts/hipaa-backup.sh

set -e

BACKUP_BUCKET="gs://intellicare-hipaa-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backup_${TIMESTAMP}"

# Create encrypted backup
mongodump --uri="$MONGODB_URI" --out $BACKUP_DIR

# Encrypt backup locally before upload
tar -czf "${BACKUP_DIR}.tar.gz" $BACKUP_DIR
gpg --cipher-algo AES256 --compress-algo 1 --symmetric --output "${BACKUP_DIR}.tar.gz.gpg" "${BACKUP_DIR}.tar.gz"

# Upload encrypted backup
gsutil cp "${BACKUP_DIR}.tar.gz.gpg" "${BACKUP_BUCKET}/"

# Clean up local files
rm -rf $BACKUP_DIR "${BACKUP_DIR}.tar.gz" "${BACKUP_DIR}.tar.gz.gpg"

# Log backup completion
echo "HIPAA backup completed: ${BACKUP_DIR}.tar.gz.gpg" | logger -t intellicare-backup
```

## HIPAA Compliance Checklist

### Technical Safeguards
- [ ] Access controls implemented with unique user identification
- [ ] Automatic logoff configured
- [ ] Encryption and decryption of PHI
- [ ] Audit controls for PHI access
- [ ] Data integrity controls
- [ ] Transmission security measures

### Administrative Safeguards  
- [ ] Security officer designated
- [ ] Workforce training completed
- [ ] Access management procedures documented
- [ ] Incident response procedures established
- [ ] Risk assessment conducted
- [ ] Business Associate Agreements executed

### Physical Safeguards
- [ ] Cloud provider physical security verified
- [ ] Workstation access controls implemented
- [ ] Media controls for PHI storage

### Documentation Requirements
- [ ] HIPAA policies and procedures documented
- [ ] Risk assessment documentation
- [ ] Audit logs maintained
- [ ] Incident response documentation
- [ ] Employee training records

## Ongoing Compliance Monitoring

### Monthly Tasks
- Review audit logs for unauthorized access
- Verify backup integrity and encryption
- Update access controls and permissions
- Monitor security alerts and incidents

### Quarterly Tasks
- Conduct risk assessment updates
- Review and update policies
- Test disaster recovery procedures
- Security awareness training

### Annual Tasks
- Comprehensive HIPAA compliance audit
- Update Business Associate Agreements
- Review and update incident response plan
- Penetration testing and vulnerability assessment

## Incident Response Plan

### PHI Breach Response
1. **Immediate containment** (within 1 hour)
2. **Assessment and investigation** (within 24 hours)
3. **Notification procedures** (within 72 hours)
4. **Documentation and reporting**
5. **Remediation and prevention**

### Contact Information
- **HIPAA Security Officer**: [Contact Info]
- **Google Cloud Support**: [BAA Support Channel]
- **MongoDB Atlas Support**: [HIPAA Support]
- **Legal Counsel**: [Contact Info]

## Cost Implications

### HIPAA Compliance Costs
- MongoDB Atlas M10+: $57+/month (vs M0 free tier)
- Google Cloud BAA: No additional cost
- Enhanced monitoring: $50+/month
- Backup storage: $20+/month
- **Total Additional Cost**: ~$127+/month for HIPAA compliance

This investment is essential for legal compliance and patient data protection.
