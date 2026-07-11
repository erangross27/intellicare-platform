# Task 3.1: Add Document Summarization

## 🧠 **AI FEATURES TASK**
**Phase:** 3 (Advanced AI Features)  
**Time Estimate:** 35 minutes  
**Risk Level:** LOW  
**Priority:** MEDIUM  

## 🎯 **Objective**
Implement AI-powered document summarization with medical focus, multi-language support, and customizable summary types.

## 📈 **Benefits**
- Reduce document review time by 80%
- Generate structured medical summaries
- Support Hebrew and English summarization
- Create patient-friendly explanations
- Extract key medical insights automatically
- Enable quick document triage

## 📁 **Files to Modify**
- `backend/services/documentSummarizationService.js` (create new)
- `backend/services/documentAnalysisService.js`
- `backend/models/DocumentSummary.js` (create new)
- `backend/routes/documents.js`

## 🔧 **Implementation**

### **Step 1: Create Document Summary Model**
```javascript
// backend/models/DocumentSummary.js
const mongoose = require('mongoose');

const documentSummarySchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    unique: true
  },
  practiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Practice',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  documentType: {
    type: String,
    enum: ['lab_results', 'prescription', 'consultation_notes', 'imaging_report', 'discharge_summary', 'general'],
    required: true
  },
  summaries: {
    // Executive summary for healthcare providers
    clinical: {
      content: String,
      keyFindings: [String],
      recommendations: [String],
      urgentFlags: [String],
      confidence: { type: Number, min: 0, max: 1 },
      language: { type: String, default: 'en' }
    },
    
    // Patient-friendly summary
    patient: {
      content: String,
      keyPoints: [String],
      nextSteps: [String],
      questionsToAsk: [String],
      confidence: { type: Number, min: 0, max: 1 },
      language: { type: String, default: 'en' }
    },
    
    // Brief summary for quick review
    brief: {
      content: String,
      category: String,
      priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      tags: [String],
      confidence: { type: Number, min: 0, max: 1 }
    },
    
    // Structured data extraction
    structured: {
      labValues: [{
        test: String,
        value: String,
        unit: String,
        referenceRange: String,
        status: { type: String, enum: ['NORMAL', 'HIGH', 'LOW', 'CRITICAL'] },
        flagged: Boolean
      }],
      medications: [{
        name: String,
        dosage: String,
        frequency: String,
        duration: String,
        instructions: String
      }],
      diagnoses: [{
        condition: String,
        icd10Code: String,
        confidence: Number,
        category: String
      }],
      procedures: [{
        name: String,
        cptCode: String,
        date: Date,
        provider: String
      }],
      vitalSigns: {
        bloodPressure: String,
        heartRate: String,
        temperature: String,
        weight: String,
        height: String
      },
      dates: [{
        type: String, // 'test_date', 'appointment', 'next_visit'
        date: Date,
        description: String
      }]
    }
  },
  
  qualityMetrics: {
    originalLength: Number,
    summaryLength: Number,
    compressionRatio: Number,
    processingTime: Number,
    modelUsed: String,
    confidenceScore: Number,
    medicalTermsDetected: Number,
    structuredDataPoints: Number
  },
  
  generatedBy: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    aiModel: String,
    modelVersion: String,
    generatedAt: { type: Date, default: Date.now }
  },
  
  reviewStatus: {
    reviewed: { type: Boolean, default: false },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    reviewComments: String,
    approved: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

documentSummarySchema.index({ documentId: 1 }, { unique: true });
documentSummarySchema.index({ practiceId: 1, patientId: 1 });
documentSummarySchema.index({ documentType: 1, 'summaries.brief.priority': 1 });

module.exports = mongoose.model('DocumentSummary', documentSummarySchema);
```

### **Step 2: Create Summarization Service**
```javascript
// backend/services/documentSummarizationService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const DocumentSummary = require('../models/DocumentSummary');
const medicalTerminology = require('../utils/medicalTerminology');

class DocumentSummarizationService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    this.maxTokens = 4000;
  }

  async summarizeDocument(documentText, documentType, options = {}) {
    const startTime = Date.now();
    
    try {
      // Detect document language
      const language = this.detectLanguage(documentText);
      
      // Generate different types of summaries
      const summaries = await Promise.all([
        this.generateClinicalSummary(documentText, documentType, language),
        this.generatePatientSummary(documentText, documentType, language),
        this.generateBriefSummary(documentText, documentType),
        this.extractStructuredData(documentText, documentType)
      ]);

      const [clinical, patient, brief, structured] = summaries;
      
      // Calculate quality metrics
      const qualityMetrics = {
        originalLength: documentText.length,
        summaryLength: clinical.content.length + patient.content.length + brief.content.length,
        compressionRatio: (clinical.content.length + patient.content.length) / documentText.length,
        processingTime: Date.now() - startTime,
        modelUsed: 'gemini-1.5-pro',
        confidenceScore: (clinical.confidence + patient.confidence + brief.confidence) / 3,
        medicalTermsDetected: this.countMedicalTerms(documentText),
        structuredDataPoints: this.countStructuredDataPoints(structured)
      };

      return {
        summaries: {
          clinical,
          patient, 
          brief,
          structured
        },
        qualityMetrics,
        language
      };
      
    } catch (error) {
      console.error('Document summarization failed:', error);
      throw new Error(`Summarization failed: ${error.message}`);
    }
  }

  async generateClinicalSummary(text, documentType, language) {
    const prompt = this.buildClinicalPrompt(text, documentType, language);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      // Parse the structured response
      const parsed = this.parseClinicalResponse(response);
      
      return {
        content: parsed.summary,
        keyFindings: parsed.keyFindings || [],
        recommendations: parsed.recommendations || [],
        urgentFlags: parsed.urgentFlags || [],
        confidence: this.calculateConfidence(response, text),
        language
      };
    } catch (error) {
      console.error('Clinical summary generation failed:', error);
      return {
        content: 'Clinical summary generation failed',
        keyFindings: [],
        recommendations: [],
        urgentFlags: [],
        confidence: 0,
        language
      };
    }
  }

  buildClinicalPrompt(text, documentType, language) {
    const languageInstruction = language === 'he' ? 
      'Please respond in Hebrew (עברית).' : 'Please respond in English.';
    
    return `
You are a medical AI assistant helping healthcare providers. Analyze this ${documentType} document and provide a clinical summary.

${languageInstruction}

Document text:
${text}

Please provide a structured response in this JSON format:
{
  "summary": "Comprehensive clinical summary (2-3 paragraphs)",
  "keyFindings": ["Most important finding 1", "Most important finding 2"],
  "recommendations": ["Clinical recommendation 1", "Clinical recommendation 2"],
  "urgentFlags": ["Any urgent issues requiring immediate attention"]
}

Focus on:
- Medical significance and clinical interpretation
- Abnormal values and their implications
- Treatment recommendations or next steps
- Any urgent or concerning findings
- Relevant medical history or context

Use appropriate medical terminology for healthcare professionals.
`;
  }

  async generatePatientSummary(text, documentType, language) {
    const prompt = this.buildPatientPrompt(text, documentType, language);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      const parsed = this.parsePatientResponse(response);
      
      return {
        content: parsed.summary,
        keyPoints: parsed.keyPoints || [],
        nextSteps: parsed.nextSteps || [],
        questionsToAsk: parsed.questionsToAsk || [],
        confidence: this.calculateConfidence(response, text),
        language
      };
    } catch (error) {
      console.error('Patient summary generation failed:', error);
      return {
        content: 'Patient summary generation failed',
        keyPoints: [],
        nextSteps: [],
        questionsToAsk: [],
        confidence: 0,
        language
      };
    }
  }

  buildPatientPrompt(text, documentType, language) {
    const languageInstruction = language === 'he' ? 
      'אנא השב בעברית בשפה פשוטה ומובנת למטופל.' : 
      'Please respond in simple, patient-friendly English.';
    
    return `
You are a medical AI assistant helping patients understand their medical documents. 
Explain this ${documentType} in simple, reassuring terms that a patient can understand.

${languageInstruction}

Document text:
${text}

Please provide a structured response in this JSON format:
{
  "summary": "Patient-friendly explanation of the document (avoid medical jargon)",
  "keyPoints": ["Important point 1 in simple terms", "Important point 2 in simple terms"],
  "nextSteps": ["What the patient should do next", "Follow-up actions"],
  "questionsToAsk": ["Helpful question to ask the doctor", "Another relevant question"]
}

Focus on:
- Simple, non-technical language
- Reassuring tone when appropriate
- Practical next steps for the patient
- Important information they should know
- Questions they might want to ask their doctor

Avoid:
- Medical jargon or technical terms
- Alarming language
- Definitive diagnoses (suggest discussing with doctor)
`;
  }

  async generateBriefSummary(text, documentType) {
    const prompt = `
Provide a very brief summary of this ${documentType} document for quick triage.

Document text:
${text}

Provide a JSON response:
{
  "content": "One sentence summary",
  "category": "Document category",
  "priority": "LOW|MEDIUM|HIGH|URGENT",
  "tags": ["tag1", "tag2", "tag3"]
}

The summary should be one sentence that captures the most important aspect.
Priority should be based on medical urgency.
Tags should be relevant medical keywords.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      const parsed = JSON.parse(this.extractJSON(response));
      
      return {
        content: parsed.content,
        category: parsed.category,
        priority: parsed.priority || 'MEDIUM',
        tags: parsed.tags || [],
        confidence: this.calculateConfidence(response, text)
      };
    } catch (error) {
      console.error('Brief summary generation failed:', error);
      return {
        content: `${documentType} document requiring review`,
        category: documentType,
        priority: 'MEDIUM',
        tags: [documentType],
        confidence: 0
      };
    }
  }

  async extractStructuredData(text, documentType) {
    // Extract specific structured data based on document type
    switch (documentType) {
      case 'lab_results':
        return await this.extractLabResults(text);
      case 'prescription':
        return await this.extractPrescriptionData(text);
      case 'consultation_notes':
        return await this.extractConsultationData(text);
      default:
        return await this.extractGeneralData(text);
    }
  }

  async extractLabResults(text) {
    const prompt = `
Extract lab values from this lab report:

${text}

Provide JSON response:
{
  "labValues": [
    {
      "test": "Test name",
      "value": "Numeric value",
      "unit": "Unit of measurement",
      "referenceRange": "Normal range",
      "status": "NORMAL|HIGH|LOW|CRITICAL",
      "flagged": true/false
    }
  ],
  "dates": [
    {
      "type": "test_date",
      "date": "YYYY-MM-DD",
      "description": "Description"
    }
  ]
}

Extract all numeric lab values with their reference ranges and flag abnormal values.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      return JSON.parse(this.extractJSON(response));
    } catch (error) {
      console.error('Lab results extraction failed:', error);
      return { labValues: [], dates: [] };
    }
  }

  detectLanguage(text) {
    // Simple Hebrew detection
    const hebrewRegex = /[א-ת]/;
    return hebrewRegex.test(text) ? 'he' : 'en';
  }

  calculateConfidence(response, originalText) {
    // Calculate confidence based on response quality
    const responseLength = response.length;
    const originalLength = originalText.length;
    
    // Basic confidence calculation
    let confidence = 0.5;
    
    // Boost confidence if response is appropriately sized
    if (responseLength > 50 && responseLength < originalLength * 0.8) {
      confidence += 0.2;
    }
    
    // Boost confidence if medical terms are present
    const medicalTermsCount = this.countMedicalTerms(response);
    confidence += Math.min(0.3, medicalTermsCount * 0.05);
    
    return Math.min(1, confidence);
  }

  countMedicalTerms(text) {
    const medicalTerms = medicalTerminology.getCommonTerms();
    const words = text.toLowerCase().split(/\s+/);
    
    return words.filter(word => 
      medicalTerms.some(term => 
        term.toLowerCase().includes(word) || word.includes(term.toLowerCase())
      )
    ).length;
  }

  countStructuredDataPoints(structured) {
    let count = 0;
    if (structured.labValues) count += structured.labValues.length;
    if (structured.medications) count += structured.medications.length;
    if (structured.diagnoses) count += structured.diagnoses.length;
    if (structured.procedures) count += structured.procedures.length;
    return count;
  }

  extractJSON(text) {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
    return jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
  }

  parseClinicalResponse(response) {
    try {
      return JSON.parse(this.extractJSON(response));
    } catch (error) {
      // Fallback parsing if JSON parsing fails
      return {
        summary: response,
        keyFindings: [],
        recommendations: [],
        urgentFlags: []
      };
    }
  }

  parsePatientResponse(response) {
    try {
      return JSON.parse(this.extractJSON(response));
    } catch (error) {
      return {
        summary: response,
        keyPoints: [],
        nextSteps: [],
        questionsToAsk: []
      };
    }
  }
}

module.exports = DocumentSummarizationService;
```

### **Step 3: Add Summary Route**
```javascript
// In backend/routes/documents.js
const DocumentSummarizationService = require('../services/documentSummarizationService');
const DocumentSummary = require('../models/DocumentSummary');

// Generate document summary
router.post('/:documentId/summarize', async (req, res) => {
  try {
    const Document = req.models.Document;
    const document = await Document.findOne({
      _id: req.params.documentId,
      practiceId: req.practice._id
    });
    
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    
    // Check if summary already exists
    const existingSummary = await DocumentSummary.findOne({
      documentId: document._id,
      practiceId: req.practice._id
    });
    
    if (existingSummary && !req.body.regenerate) {
      return res.json({
        success: true,
        summary: existingSummary,
        cached: true
      });
    }
    
    // Get document text (from OCR or direct text)
    const documentText = document.ocrText || document.content || '';
    
    if (!documentText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Document contains no text to summarize'
      });
    }
    
    // Generate summary
    const summarizationService = new DocumentSummarizationService();
    const summaryData = await summarizationService.summarizeDocument(
      documentText,
      document.category || 'general',
      req.body.options || {}
    );
    
    // Save summary
    const summary = existingSummary || new DocumentSummary({
      documentId: document._id,
      practiceId: req.practice._id,
      patientId: document.patientId,
      documentType: document.category || 'general'
    });
    
    summary.summaries = summaryData.summaries;
    summary.qualityMetrics = summaryData.qualityMetrics;
    summary.generatedBy = {
      userId: req.user._id,
      aiModel: 'gemini-1.5-pro',
      modelVersion: '1.0',
      generatedAt: new Date()
    };
    
    await summary.save();
    
    res.json({
      success: true,
      summary,
      language: summaryData.language
    });
    
  } catch (error) {
    console.error('Summary generation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Summary generation failed',
      error: error.message
    });
  }
});

// Get existing summary
router.get('/:documentId/summary', async (req, res) => {
  try {
    const summary = await DocumentSummary.findOne({
      documentId: req.params.documentId,
      practiceId: req.practice._id
    }).populate('generatedBy.userId', 'name email');
    
    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'Summary not found'
      });
    }
    
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
```

## 🧪 **Testing**
1. **Clinical summaries:** Test with lab reports, prescriptions
2. **Patient summaries:** Verify simple language used
3. **Multi-language:** Test Hebrew document summarization
4. **Structured extraction:** Verify lab values extracted correctly
5. **Confidence scoring:** Check accuracy correlation

## ✅ **Success Criteria**
- [ ] Clinical summaries generated accurately
- [ ] Patient-friendly summaries in simple language
- [ ] Hebrew language support working
- [ ] Structured data extraction functional
- [ ] Confidence scoring implemented
- [ ] Processing time <15 seconds per document

## 🔄 **Next Task**
Proceed to: **Task 3.2:** Implement Anomaly Detection

## 📝 **AI Notes**
- Monitor token usage and costs
- Implement summary caching
- Regular accuracy evaluation with medical professionals
- Consider multiple AI models for comparison