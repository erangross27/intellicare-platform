# Vertex AI HIPAA Migration Guide

## Overview
This guide documents the migration from Gemini API (development) to Vertex AI Search Enterprise (production) for HIPAA-compliant medical document analysis.

## Current vs Production Architecture

### Development (Current)
- **AI Service**: Gemini API (non-HIPAA)
- **Storage**: MongoDB with application-level encryption
- **Analysis**: Temporary decryption → Gemini → Re-encrypt results
- **Cost**: Low (for testing)

### Production (Target)
- **AI Service**: Vertex AI Search Enterprise (HIPAA compliant)
- **Storage**: MongoDB + Google Cloud Storage with CMEK
- **Analysis**: End-to-end encrypted processing
- **Cost**: Higher (enterprise-grade)

## Vertex AI Search Enterprise Features

### HIPAA Compliance
- ✅ **Business Associate Agreement (BAA)** with Google
- ✅ **Customer Managed Encryption Keys (CMEK)**
- ✅ **Data residency** (US-only processing)
- ✅ **Audit logging** and compliance controls
- ✅ **Enterprise security** standards

### Medical AI Capabilities
- **Document Analysis**: Medical document parsing and extraction
- **Medical Entity Recognition**: Medications, conditions, procedures
- **Clinical Decision Support**: Evidence-based recommendations
- **Multi-language Support**: Hebrew and English medical terminology
- **Structured Data Extraction**: Lab results, prescriptions, reports

## Migration Implementation

### Phase 1: Infrastructure Setup

#### 1.1 Google Cloud Project Setup
```bash
# Create HIPAA-compliant project
gcloud projects create intellicare-production \
  --name="IntelliCare Production" \
  --labels=environment=production,compliance=hipaa

# Enable required APIs
gcloud services enable \
  aiplatform.googleapis.com \
  cloudkms.googleapis.com \
  storage.googleapis.com \
  --project=intellicare-production
```

#### 1.2 Customer Managed Encryption Keys (CMEK)
```bash
# Create key ring for medical data
gcloud kms keyrings create medical-data \
  --location=us-central1 \
  --project=intellicare-production

# Create encryption key for documents
gcloud kms keys create document-encryption \
  --location=us-central1 \
  --keyring=medical-data \
  --purpose=encryption \
  --project=intellicare-production

# Create encryption key for AI processing
gcloud kms keys create ai-processing \
  --location=us-central1 \
  --keyring=medical-data \
  --purpose=encryption \
  --project=intellicare-production
```

#### 1.3 Cloud Storage with CMEK
```bash
# Create HIPAA-compliant storage bucket
gsutil mb -p intellicare-production \
  -c STANDARD \
  -l us-central1 \
  gs://intellicare-medical-documents

# Apply CMEK encryption
gsutil kms encryption \
  -k projects/intellicare-production/locations/us-central1/keyRings/medical-data/cryptoKeys/document-encryption \
  gs://intellicare-medical-documents
```

### Phase 2: Vertex AI Search Setup

#### 2.1 Create Search Engine
```javascript
// backend/services/vertexAIService.js
const { SearchServiceClient } = require('@google-cloud/discoveryengine');

class VertexAISearchService {
  constructor() {
    this.client = new SearchServiceClient({
      projectId: 'intellicare-production',
      location: 'us-central1'
    });
    this.searchEngine = 'projects/intellicare-production/locations/us-central1/collections/default_collection/engines/medical-documents';
  }

  async uploadDocument(documentBuffer, metadata) {
    // Upload with CMEK encryption
    const document = {
      content: {
        mimeType: metadata.mimeType,
        rawBytes: documentBuffer
      },
      structData: {
        patientId: metadata.patientId,
        documentType: metadata.documentType,
        uploadDate: new Date().toISOString()
      }
    };

    return await this.client.importDocuments({
      parent: this.searchEngine,
      documents: [document],
      // CMEK encryption applied automatically
    });
  }

  async analyzeDocument(documentId, analysisType) {
    const request = {
      servingConfig: `${this.searchEngine}/servingConfigs/default_config`,
      query: `analyze medical document ${documentId} for ${analysisType}`,
      queryExpansionSpec: {
        condition: 'AUTO'
      }
    };

    return await this.client.search(request);
  }
}
```

#### 2.2 Medical Document Analysis
```javascript
// Enhanced medical analysis with Vertex AI
async analyzeWithVertexAI(documentId, category) {
  const prompts = {
    lab_results: 'Extract lab values, reference ranges, and clinical significance',
    prescriptions: 'Extract medications, dosages, frequencies, and instructions',
    discharge_summary: 'Extract diagnoses, treatments, and follow-up care',
    imaging_reports: 'Extract findings, impressions, and recommendations'
  };

  const analysis = await this.vertexAI.analyzeDocument(documentId, {
    prompt: prompts[category],
    extractionFields: ['DATE', 'DIAGNOSIS', 'SYMPTOMS', 'TREATMENT', 'NOTES'],
    language: 'he', // Hebrew support
    medicalTerminology: true
  });

  return analysis;
}
```

### Phase 3: Migration Steps

#### 3.1 Environment Configuration
```javascript
// backend/config/production.json
{
  "aiService": {
    "provider": "vertex-ai",
    "projectId": "intellicare-production",
    "location": "us-central1",
    "searchEngine": "medical-documents",
    "cmekKeyName": "projects/intellicare-production/locations/us-central1/keyRings/medical-data/cryptoKeys/ai-processing"
  },
  "storage": {
    "type": "cloud-storage",
    "bucket": "intellicare-medical-documents",
    "cmekKeyName": "projects/intellicare-production/locations/us-central1/keyRings/medical-data/cryptoKeys/document-encryption"
  }
}
```

#### 3.2 Service Abstraction Layer
```javascript
// backend/services/aiServiceFactory.js
class AIServiceFactory {
  static createService() {
    const environment = process.env.NODE_ENV;
    
    if (environment === 'production') {
      return new VertexAISearchService();
    } else {
      return new GeminiService(); // Current development service
    }
  }
}

// Usage in documentAnalysisService.js
const aiService = AIServiceFactory.createService();
const analysis = await aiService.analyzeDocument(documentId, category);
```

## Cost Comparison

### Development (Gemini API)
- **Document Analysis**: ~$0.01 per document
- **Monthly Testing**: ~$50-100
- **Storage**: MongoDB only

### Production (Vertex AI Enterprise)
- **Document Analysis**: ~$0.05-0.10 per document
- **Monthly Production**: ~$500-1000
- **Storage**: MongoDB + Cloud Storage + CMEK
- **Additional**: Enterprise support, SLA guarantees

## Security Benefits

### Vertex AI Enterprise Advantages
1. **Native HIPAA Compliance**: Built for healthcare
2. **End-to-end Encryption**: Documents never decrypted
3. **Audit Trails**: Complete compliance logging
4. **Data Residency**: Guaranteed US-only processing
5. **Enterprise SLA**: 99.9% uptime guarantee

## Migration Checklist

### Pre-Migration
- [ ] Execute Google Cloud BAA
- [ ] Set up CMEK keys
- [ ] Configure Cloud Storage
- [ ] Test Vertex AI Search in staging

### Migration
- [ ] Deploy service abstraction layer
- [ ] Migrate existing documents to Cloud Storage
- [ ] Update AI analysis endpoints
- [ ] Configure production monitoring

### Post-Migration
- [ ] Verify HIPAA compliance
- [ ] Performance testing
- [ ] Cost monitoring
- [ ] Staff training on new system

## Timeline
- **Phase 1**: Infrastructure (2 weeks)
- **Phase 2**: Vertex AI Setup (1 week)  
- **Phase 3**: Migration (1 week)
- **Testing & Validation**: 1 week

**Total**: ~5 weeks for complete migration

## Next Steps
1. Continue development with current Gemini API
2. Plan production migration timeline
3. Budget for Vertex AI Enterprise costs
4. Prepare HIPAA compliance documentation
