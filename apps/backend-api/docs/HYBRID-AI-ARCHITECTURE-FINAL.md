# IntelliCare Hybrid AI Architecture - Final Strategy

## 🎯 Executive Decision
**Claude**: Platform orchestration, function calling, context management
**Gemini 2.5 Flash**: ALL medical document analysis

## 🏗️ Architecture Overview

```
User Input (Hebrew/English)
         ↓
┌─────────────────────┐
│   CLAUDE (Master)   │
│  - Function Calling │
│  - Context Tracking │
│  - Conversation Flow│
│  - User Intent      │
│  - Platform Logic   │
└─────────┬───────────┘
          ↓
    Route Decision
    ↙            ↘
Platform Ops    Medical Analysis
    ↓                ↓
CLAUDE           GEMINI 2.5
- Login          - Documents
- CRUD           - Lab Results  
- Workflow       - Imaging
- Search         - Prescriptions
- Admin          - Clinical Notes
```

## 📋 Division of Responsibilities

### **CLAUDE - Platform Brain** 🧠
```javascript
// Everything EXCEPT medical document analysis
const claudeResponsibilities = {
  // Core Platform
  "authentication": "All login, MFA, session management",
  "functionCalling": "All 80+ functions orchestration",
  "contextManagement": "Maintain conversation context",
  "userIntent": "Understand what user wants",
  "routing": "Decide which function to call",
  "workflow": "Multi-step operations",
  
  // Business Logic
  "appointments": "Scheduling logic (not medical notes)",
  "insurance": "Claims, authorization logic",
  "billing": "Financial calculations",
  "userManagement": "Roles, permissions",
  "systemAdmin": "Platform configuration",
  
  // Data Operations
  "search": "Finding patients, records",
  "filters": "Query building",
  "sorting": "Result organization",
  "crud": "Create, Read, Update, Delete",
  
  // Conversation
  "naturalLanguage": "Understanding user requests",
  "responseGeneration": "Crafting responses",
  "errorHandling": "User-friendly error messages",
  "multiLanguage": "Interface language (not medical)"
};
```

### **GEMINI 2.5 FLASH - Medical Expert** 🏥
```javascript
// ALL medical document analysis
const geminiResponsibilities = {
  // Document Analysis
  "colonoscopyReports": "Full analysis with citations",
  "labResults": "Blood tests, urine, etc.",
  "imagingReports": "MRI, CT, X-ray analysis",
  "prescriptions": "Medication analysis",
  "clinicalNotes": "Doctor's notes",
  "dischargeSummaries": "Hospital summaries",
  "pathologyReports": "Biopsy results",
  
  // Medical Intelligence
  "icdCoding": "Extract ICD codes",
  "medicationExtraction": "Find all medications",
  "symptomAnalysis": "Identify symptoms",
  "diagnosisExtraction": "Find diagnoses",
  "vitalSigns": "Extract vital measurements",
  "citations": "Medical-legal references",
  
  // Imaging
  "xrayAnalysis": "Chest, bone X-rays",
  "ctAnalysis": "CT scan interpretation",
  "mriAnalysis": "MRI interpretation",
  "ultrasoundAnalysis": "Ultrasound reading"
};
```

## 💻 Implementation Code Structure

### Main Agent Service (Claude-Powered)
```javascript
// agentServiceV5.js - Hybrid Architecture
class IntelliCareHybridAgent {
  constructor() {
    // Claude for orchestration
    this.claude = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
      model: 'claude-3-opus-20240229' // or sonnet for cost
    });
    
    // Gemini for medical analysis
    this.gemini = new GoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-2.5-flash'
    });
    
    // Context maintained by Claude
    this.sessions = new Map();
  }
  
  // Main entry point - ALWAYS Claude first
  async processChatMessage(message, sessionId, practiceContext) {
    // Claude understands intent and manages conversation
    const intent = await this.claude.messages.create({
      messages: [{
        role: 'user',
        content: message
      }],
      system: this.getSystemPrompt(),
      tools: this.getAllFunctionDeclarations()
    });
    
    // If medical document analysis needed, hand off to Gemini
    if (intent.tool_choice?.name.includes('analyze') || 
        intent.tool_choice?.name.includes('document')) {
      return await this.processWithGemini(intent.tool_choice);
    }
    
    // Everything else stays with Claude
    return await this.executeWithClaude(intent);
  }
  
  // Gemini for ALL medical document analysis
  async analyzeDocument(document, documentType) {
    const prompt = this.getMedicalAnalysisPrompt(documentType);
    
    const result = await this.gemini.generateContent({
      contents: [{
        parts: [{
          text: `${prompt}\n\nDocument:\n${document}`
        }]
      }],
      generationConfig: {
        temperature: 0.1, // Low for medical accuracy
        topK: 1,
        topP: 0.95,
        maxOutputTokens: 4096,
      }
    });
    
    return this.formatMedicalAnalysis(result.response.text());
  }
}
```

### Document Analysis Service (Gemini-Powered)
```javascript
// medicalAnalysisService.js
class MedicalAnalysisService {
  constructor() {
    this.gemini = new GoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY
    });
    
    // Check for caching capability
    this.cache = null;
    this.checkCachingSupport();
  }
  
  async checkCachingSupport() {
    // Check if Gemini API supports caching
    try {
      // New Gemini SDK might have caching
      const models = await this.gemini.listModels();
      console.log('Available models:', models);
      
      // Check for context caching feature
      if (this.gemini.caching) {
        this.cache = new Map();
        console.log('✅ Gemini caching enabled');
      }
    } catch (error) {
      console.log('❌ No caching support detected');
    }
  }
  
  async analyzeMedicalDocument(params) {
    const {
      document,
      documentType,
      language = 'auto',
      includeCitations = true,
      extractICD = true,
      extractMedications = true
    } = params;
    
    // Check cache first
    const cacheKey = this.generateCacheKey(document);
    if (this.cache?.has(cacheKey)) {
      console.log('📦 Returning cached analysis');
      return this.cache.get(cacheKey);
    }
    
    // Prepare medical-specific prompt
    const systemPrompt = `You are a medical document analyst. Analyze this ${documentType} and provide:
    1. Patient demographics
    2. Clinical findings
    3. Diagnoses with ICD codes
    4. Medications mentioned
    5. Procedures performed
    6. Recommendations
    7. Follow-up requirements
    ${includeCitations ? '8. Include [cite: X] references for each fact' : ''}
    
    Language: ${language === 'he' ? 'Hebrew' : language === 'en' ? 'English' : 'Auto-detect'}`;
    
    const result = await this.gemini.generateContent({
      contents: [{
        parts: [{
          text: systemPrompt + '\n\n' + document
        }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      }
    });
    
    const analysis = this.structureAnalysis(result.response.text());
    
    // Cache if available
    if (this.cache) {
      this.cache.set(cacheKey, analysis);
    }
    
    return analysis;
  }
  
  // Check for batch processing support
  async checkBatchSupport() {
    // Gemini 2.5 Flash batch processing check
    try {
      // Check if batch API exists
      if (this.gemini.batchGenerateContent) {
        console.log('✅ Batch processing available');
        return true;
      }
      
      // Alternative: Process in parallel
      console.log('⚠️ No native batch, using parallel processing');
      return false;
    } catch (error) {
      return false;
    }
  }
  
  async batchAnalyzeDocuments(documents) {
    const hasBatch = await this.checkBatchSupport();
    
    if (hasBatch && this.gemini.batchGenerateContent) {
      // Native batch processing if available
      return await this.gemini.batchGenerateContent({
        requests: documents.map(doc => ({
          contents: [{
            parts: [{ text: this.getMedicalPrompt() + doc }]
          }]
        }))
      });
    } else {
      // Parallel processing fallback
      const promises = documents.map(doc => 
        this.analyzeMedicalDocument({ document: doc })
      );
      
      // Process in chunks to avoid rate limits
      const chunkSize = 5;
      const results = [];
      for (let i = 0; i < promises.length; i += chunkSize) {
        const chunk = promises.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk);
        results.push(...chunkResults);
        
        // Small delay between chunks
        if (i + chunkSize < promises.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      return results;
    }
  }
}
```

## 🔧 Updated Function Implementations

### Example: Analyze Lab Results
```javascript
// In agentServiceV5.js
async analyzeLabResults(params, practiceContext, session) {
  // Claude understands the request
  const userIntent = await this.claude.messages.create({
    messages: [{
      role: 'user',
      content: `User wants to analyze lab results: ${params.query}`
    }],
    system: 'Extract what specific analysis is needed'
  });
  
  // Get the document
  const document = await this.getDocument(params.documentId);
  
  // Gemini analyzes the medical content
  const medicalAnalysis = await this.medicalAnalysisService.analyzeMedicalDocument({
    document: document.content,
    documentType: 'lab_results',
    language: session.language,
    includeCitations: true,
    extractICD: true
  });
  
  // Claude formats the response for the user
  const response = await this.claude.messages.create({
    messages: [{
      role: 'user',
      content: `Format this medical analysis for the user in a friendly way: ${JSON.stringify(medicalAnalysis)}`
    }],
    system: `You are a helpful medical assistant. Language: ${session.language}`
  });
  
  return {
    success: true,
    analysis: medicalAnalysis,
    response: response.content[0].text
  };
}
```

## 💰 Cost Analysis

### Per 1000 Operations/Day

| Operation Type | Model | Count | Cost |
|---------------|-------|-------|------|
| Function Orchestration | Claude Sonnet | 1000 | $3.00 |
| Medical Analysis | Gemini 2.5 Flash | 300 | $0.09 |
| Context Management | Claude | 1000 | $3.00 |
| Image Analysis | Gemini | 50 | $0.02 |
| **Total Daily Cost** | **Hybrid** | **2350** | **$6.11** |

### Compared to Single Model:
- **All Claude**: $15-30/day
- **All Gemini**: $0.70/day (but poor function calling)
- **Hybrid**: $6.11/day with BEST of both

## 📦 Gemini SDK Features to Investigate

```javascript
// Check these Gemini features
async investigateGeminiFeatures() {
  const gemini = new GoogleGenerativeAI(apiKey);
  
  // 1. Check for caching
  console.log('Caching available?', !!gemini.caching);
  
  // 2. Check for batch processing
  console.log('Batch API?', !!gemini.batchGenerateContent);
  
  // 3. Check for streaming
  console.log('Streaming?', !!gemini.generateContentStream);
  
  // 4. Check model capabilities
  const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
  console.log('Model info:', await model.getInfo());
  
  // 5. Check for context window
  console.log('Context window:', model.contextWindow || 'Unknown');
}
```

## 🚀 Implementation Steps

### Phase 1: Core Setup (Week 1)
1. **Day 1**: Set up dual AI configuration
2. **Day 2**: Implement Claude orchestration layer
3. **Day 3**: Implement Gemini medical analysis service
4. **Day 4**: Create routing logic
5. **Day 5**: Test hybrid flow

### Phase 2: Medical Functions (Week 2)
1. Migrate all document analysis to Gemini
2. Keep all function calling with Claude
3. Test Hebrew and English documents
4. Implement caching if available
5. Set up batch processing

### Phase 3: Optimization
1. Cache frequent medical analyses
2. Batch process when possible
3. Monitor costs
4. Fine-tune routing logic

## ✅ Success Criteria

1. **Claude handles 100%** of function calling
2. **Gemini handles 100%** of medical document analysis
3. **Response time** < 3s for standard operations
4. **Cost** < $10/day for 1000+ operations
5. **Accuracy** > 95% for medical extraction
6. **Citations** included for all medical facts

## 🎯 Key Benefits

1. **Best-in-class function calling** (Claude)
2. **Superior medical analysis** (Gemini)
3. **Cost-effective** (Gemini for heavy lifting)
4. **Legally compliant** (Citations from Gemini)
5. **Scalable** (Can handle 10,000+ ops/day)

---

*Architecture Date: August 18, 2025*
*Primary: Claude for platform*
*Medical: Gemini 2.5 Flash*
*Estimated Savings: 60% vs all-Claude*