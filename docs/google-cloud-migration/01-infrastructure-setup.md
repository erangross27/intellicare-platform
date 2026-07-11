# Phase 1: Infrastructure Setup

## Overview
Set up the foundational Google Cloud infrastructure required for IntelliCare deployment.

## Prerequisites
- Google Cloud account with billing enabled
- gcloud CLI installed and configured
- Project owner or editor permissions

## Tasks Breakdown

### Task 1.1: Google Cloud Project Setup (30 minutes)
**Objective**: Create and configure the GCP project

**Steps**:
1. Create new GCP project: `intellicare-production`
2. Set up billing account
3. Configure project quotas and limits
4. Set up IAM roles and permissions

**Commands**:
```bash
# Create project
gcloud projects create intellicare-production --name="IntelliCare Production"

# Set as default project
gcloud config set project intellicare-production

# Enable billing (requires billing account ID)
gcloud billing projects link intellicare-production --billing-account=BILLING_ACCOUNT_ID
```

**Deliverables**:
- Project ID: `intellicare-production`
- Billing configured
- Basic IAM setup complete

### Task 1.2: Enable Required APIs (20 minutes)
**Objective**: Enable all necessary Google Cloud APIs

**APIs to Enable**:
- Cloud Run API
- Cloud Build API
- Artifact Registry API
- Cloud Storage API
- Cloud Monitoring API
- Cloud Logging API
- Cloud Load Balancing API
- Cloud CDN API
- IAM API
- Resource Manager API

**Commands**:
```bash
# Enable all required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com
```

**Verification**:
```bash
# List enabled services
gcloud services list --enabled
```

### Task 1.3: Set Up Artifact Registry (25 minutes)
**Objective**: Create container registry for Docker images

**Steps**:
1. Create Artifact Registry repository
2. Configure Docker authentication
3. Test image push/pull

**Commands**:
```bash
# Create repository
gcloud artifacts repositories create intellicare-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="IntelliCare container images"

# Configure Docker auth
gcloud auth configure-docker us-central1-docker.pkg.dev
```

**Deliverables**:
- Repository: `us-central1-docker.pkg.dev/intellicare-production/intellicare-repo`
- Docker authentication configured

### Task 1.4: Network and Security Setup (45 minutes)
**Objective**: Configure VPC, firewall rules, and security policies

**Steps**:
1. Create VPC network (if needed for advanced setup)
2. Configure firewall rules
3. Set up Cloud NAT (if required)
4. Configure SSL certificates

**Commands**:
```bash
# For basic Cloud Run setup, default network is sufficient
# Advanced VPC setup (optional):
gcloud compute networks create intellicare-vpc --subnet-mode=custom

# Create subnet
gcloud compute networks subnets create intellicare-subnet \
  --network=intellicare-vpc \
  --range=10.0.0.0/24 \
  --region=us-central1
```

**Security Considerations**:
- Enable Cloud Armor for DDoS protection
- Configure IAM policies for least privilege
- Set up audit logging
- Enable VPC Flow Logs

### Task 1.5: MongoDB Atlas Setup (60 minutes)
**Objective**: Set up managed MongoDB cluster on Google Cloud

**Steps**:
1. Create MongoDB Atlas account
2. Create new cluster on Google Cloud
3. Configure network access
4. Set up database users
5. Configure backup policies

**Atlas Configuration**:
- **Cluster Tier**: M10 (minimum for production)
- **Region**: us-central1 (same as Cloud Run)
- **Cloud Provider**: Google Cloud Platform
- **Backup**: Enabled with point-in-time recovery

**Network Security**:
```bash
# Get Cloud Run IP ranges (will be configured in Atlas)
# Cloud Run uses dynamic IPs, so we'll use VPC peering or private endpoints
```

**Database Setup**:
- Database name: `intellicare`
- Collections: `patients`, `documents`, `translations`, `ai_prompts`
- Indexes: Create appropriate indexes for performance

### Task 1.6: Cloud Storage Setup (30 minutes)
**Objective**: Configure storage buckets for file uploads

**Steps**:
1. Create storage buckets
2. Configure bucket policies
3. Set up lifecycle management
4. Configure CORS for web access

**Buckets to Create**:
```bash
# Documents bucket
gsutil mb -p intellicare-production -c STANDARD -l us-central1 gs://intellicare-documents

# Static assets bucket
gsutil mb -p intellicare-production -c STANDARD -l us-central1 gs://intellicare-static

# Backup bucket
gsutil mb -p intellicare-production -c NEARLINE -l us-central1 gs://intellicare-backups
```

**Bucket Configuration**:
```bash
# Set CORS for documents bucket
cat > cors.json << EOF
[
  {
    "origin": ["https://intellicare-production.com"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://intellicare-documents
```

### Task 1.7: Environment Configuration (20 minutes)
**Objective**: Set up environment variables and secrets

**Steps**:
1. Create Secret Manager secrets
2. Configure environment variables
3. Set up service accounts

**Secrets to Create**:
```bash
# JWT Secret
echo -n "your-super-secure-jwt-secret" | gcloud secrets create jwt-secret --data-file=-

# MongoDB URI
echo -n "mongodb+srv://username:<DB_PASSWORD>@cluster.mongodb.net/intellicare" | gcloud secrets create mongodb-uri --data-file=-

# Gemini API Key
echo -n "your-gemini-api-key" | gcloud secrets create gemini-api-key --data-file=-
```

**Service Account**:
```bash
# Create service account for Cloud Run
gcloud iam service-accounts create intellicare-service \
  --description="Service account for IntelliCare application" \
  --display-name="IntelliCare Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding intellicare-production \
  --member="serviceAccount:intellicare-service@intellicare-production.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding intellicare-production \
  --member="serviceAccount:intellicare-service@intellicare-production.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

## Validation Checklist

- [ ] GCP project created and configured
- [ ] All required APIs enabled
- [ ] Artifact Registry repository created
- [ ] Network and security configured
- [ ] MongoDB Atlas cluster running
- [ ] Cloud Storage buckets created
- [ ] Secrets and service accounts configured
- [ ] Basic monitoring and logging enabled

## Next Steps
Proceed to Phase 2: Containerization Guide

## Troubleshooting

### Common Issues
1. **Billing not enabled**: Ensure billing account is linked
2. **API quota exceeded**: Request quota increases if needed
3. **Permission denied**: Verify IAM roles and permissions
4. **Network connectivity**: Check firewall rules and VPC configuration

### Support Resources
- Google Cloud Console: https://console.cloud.google.com
- MongoDB Atlas: https://cloud.mongodb.com
- Documentation: https://cloud.google.com/docs
