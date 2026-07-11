# AI Service HIPAA Migration - CRITICAL

## 🚨 **URGENT: Current Gemini API is NOT HIPAA Compliant**

### **Current Problem**:
IntelliCare is using **Gemini API** (ai.google.dev) which is **NOT HIPAA compliant** and violates medical data regulations.

### **Immediate Action Required**:
Must migrate to HIPAA-compliant AI service before production deployment.

---

## 🔄 **Migration Options**

### **Option 1: Vertex AI Gemini API** (RECOMMENDED - CORRECTED)
- ✅ **Pay-per-request** pricing (NOT dedicated compute)
- ✅ **HIPAA compliant** with Google Cloud BAA
- ✅ **Same Gemini models** you're using now
- ✅ **Excellent multilingual** support (Hebrew, English, etc.)
- ✅ **Best medical document** analysis
- ✅ **Regional deployment** (US-only for HIPAA)
- 💰 **Cost**: $20-100/month (similar to current Gemini API)

### **❌ Vertex AI Endpoints** (EXPENSIVE - AVOID)
- ❌ **Requires dedicated compute** (VMs/GPUs)
- ❌ **Always-on billing** ($500-2000+/month)
- ❌ **Complex setup** with resource allocation

### **Option 2: MedLM via Vertex AI API**
- ✅ **Purpose-built for healthcare**
- ✅ **HIPAA compliant**
- ✅ **Pay-per-request** pricing
- ✅ **Medical domain expertise**
- ✅ **Multilingual support**
- 💰 **Cost**: $40-200/month (higher accuracy)

---

## 📋 **Migration Tasks**

### **Task 8.1: Vertex AI Setup** (45 minutes)
**Objective**: Configure HIPAA-compliant Vertex AI Gemini

**Enable Vertex AI API**:
```bash
# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Set up authentication
gcloud auth application-default login

# Verify HIPAA-eligible region
gcloud config set ai/region us-central1
```

**Update Backend Code**:
```javascript
// backend/services/vertexAiService.js
const { VertexAI } = require('@google-cloud/vertexai');

class VertexAiService {
  constructor() {
    this.vertexAI = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: 'us-central1', // HIPAA-eligible region
    });
    
    this.model = this.vertexAI.preview.getGenerativeModel({
      model: 'gemini-1.5-pro-preview-0409',
    });
  }

  async analyzeDocument(documentText, category) {
    try {
      const prompt = await this.getPromptForCategory(category);
      
      const request = {
        contents: [{
          role: 'user',
          parts: [{
            text: `${prompt}\n\nDocument content:\n${documentText}`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.1,
        },
      };

      const response = await this.model.generateContent(request);
      return response.response.candidates[0].content.parts[0].text;
      
    } catch (error) {
      console.error('Vertex AI analysis error:', error);
      throw new Error('Document analysis failed');
    }
  }

  async getPromptForCategory(category) {
    // Use existing prompt logic from geminiService.js
    // but with Vertex AI instead of Gemini API
  }
}

module.exports = VertexAiService;
```

### **Task 8.2: Replace Gemini API Calls** (30 minutes)
**Objective**: Update all AI service calls to use Vertex AI

**Update geminiService.js**:
```javascript
// backend/services/geminiService.js
const VertexAiService = require('./vertexAiService');

class GeminiService {
  constructor() {
    // Replace Gemini API with Vertex AI
    this.aiService = new VertexAiService();
  }

  async analyzeDocument(documentText, category) {
    // Use Vertex AI instead of Gemini API
    return await this.aiService.analyzeDocument(documentText, category);
  }

  async categorizeDocument(documentText) {
    // Use Vertex AI for categorization
    return await this.aiService.analyzeDocument(documentText, 'categorization');
  }

  async checkMedicalRelevance(documentText) {
    // Use Vertex AI for relevance check
    return await this.aiService.analyzeDocument(documentText, 'medical_relevance');
  }
}

module.exports = GeminiService;
```

### **Task 8.3: Environment Variables Update** (15 minutes)
**Objective**: Update configuration for Vertex AI

**Remove Gemini API Key**:
```bash
# backend/.env.production
# Remove this line:
# GEMINI_API_KEY=your_gemini_api_key_here

# Add Vertex AI configuration:
GOOGLE_CLOUD_PROJECT=intellicare-production
VERTEX_AI_LOCATION=us-central1
```

**Update Secret Manager**:
```bash
# Remove Gemini API key secret
gcloud secrets delete gemini-api-key

# Vertex AI uses service account authentication (no API key needed)
# Ensure service account has Vertex AI permissions
gcloud projects add-iam-policy-binding intellicare-production \
  --member="serviceAccount:intellicare-service@intellicare-production.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### **Task 8.4: MedLM Alternative Setup** (Optional)
**Objective**: Set up medical-specific AI model

**MedLM Configuration**:
```javascript
// backend/services/medlmService.js
const { VertexAI } = require('@google-cloud/vertexai');

class MedLMService {
  constructor() {
    this.vertexAI = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: 'us-central1',
    });
    
    // Use MedLM model for medical documents
    this.model = this.vertexAI.preview.getGenerativeModel({
      model: 'medlm-medium', // Medical-specific model
    });
  }

  async analyzeMedicalDocument(documentText, category) {
    // Medical-specific analysis with better accuracy
    const medicalPrompt = this.getMedicalPrompt(category);
    
    const request = {
      contents: [{
        role: 'user',
        parts: [{
          text: `${medicalPrompt}\n\nMedical document:\n${documentText}`
        }]
      }],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.05, // Lower temperature for medical accuracy
      },
    };

    const response = await this.model.generateContent(request);
    return response.response.candidates[0].content.parts[0].text;
  }
}

module.exports = MedLMService;
```

---

## 💰 **Cost Implications**

### **CORRECTED Cost Analysis**:

| Service | Setup | Monthly Cost | HIPAA Compliant | Complexity |
|---------|-------|--------------|-----------------|------------|
| **Gemini API** | Easy | $10-50 | ❌ NO | Low |
| **Vertex AI Gemini** | Complex | $500-2000+ | ✅ YES | High |
| **Azure OpenAI** | Medium | $20-100 | ✅ YES | Medium |
| **AWS Bedrock** | Medium | $30-150 | ✅ YES | Medium |
| **Self-Hosted** | Complex | $200-500 | ✅ YES | High |

### **Recommended: Azure OpenAI**:
- **Input tokens**: $0.0015 per 1K tokens (GPT-4)
- **Output tokens**: $0.002 per 1K tokens
- **Estimated monthly cost**: $20-100/month
- **HIPAA BAA**: Available and required
- **Setup time**: 2-3 hours vs weeks for Vertex AI

---

## 🔒 **HIPAA Compliance Benefits**

### **Vertex AI HIPAA Features**:
- ✅ **Data residency** in US regions
- ✅ **Encryption** at rest and in transit
- ✅ **Audit logging** for all API calls
- ✅ **No data retention** by Google
- ✅ **BAA coverage** included
- ✅ **VPC-native** deployment options

### **Security Enhancements**:
```javascript
// Enhanced security configuration
const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: 'us-central1', // US region only
  apiEndpoint: 'us-central1-aiplatform.googleapis.com', // Regional endpoint
});
```

---

## ⚠️ **Migration Checklist**

### **Pre-Migration**:
- [ ] Enable Vertex AI API
- [ ] Configure service account permissions
- [ ] Test Vertex AI connectivity
- [ ] Backup current AI prompts

### **Migration**:
- [ ] Update geminiService.js to use Vertex AI
- [ ] Remove Gemini API key references
- [ ] Update environment variables
- [ ] Test document analysis functionality

### **Post-Migration**:
- [ ] Verify HIPAA compliance
- [ ] Test all document categories
- [ ] Monitor costs and usage
- [ ] Update documentation

### **Validation**:
- [ ] All AI calls use Vertex AI
- [ ] No Gemini API references remain
- [ ] Document analysis works correctly
- [ ] Audit logging enabled
- [ ] Regional deployment confirmed

---

## 🚨 **CRITICAL TIMELINE**

### **Immediate (This Week)**:
1. **Stop using Gemini API** with PHI data
2. **Set up Vertex AI** development environment
3. **Test migration** with sample documents

### **Short-term (Next Week)**:
1. **Complete migration** to Vertex AI
2. **Deploy to staging** environment
3. **Validate HIPAA compliance**

### **Before Production**:
1. **Confirm BAA coverage**
2. **Complete security audit**
3. **Document compliance measures**

---

## 📞 **Support Resources**

### **Google Cloud Support**:
- **Vertex AI Documentation**: https://cloud.google.com/vertex-ai/docs
- **HIPAA Compliance**: https://cloud.google.com/security/compliance/hipaa
- **MedLM Information**: Contact Google Cloud healthcare team

### **Migration Assistance**:
- **Google Cloud Professional Services**: Available for healthcare migrations
- **Partner Support**: Certified Google Cloud healthcare partners
- **Community**: Google Cloud healthcare community forums

**⚠️ URGENT**: This migration must be completed before any production deployment with patient data!
