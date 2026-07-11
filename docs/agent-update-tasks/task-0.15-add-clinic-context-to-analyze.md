# Task 0.15: Add Practice Context to Document Analysis

## 🚨 **CRITICAL MULTI-TENANCY TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 10 minutes  
**Risk Level:** CRITICAL  
**Priority:** URGENT  

Fix missing practice context in document analysis endpoint to ensure proper multi-tenant isolation and country-specific processing.

## 🎯 **Objective**
Fix document analysis that:
- Passes practice context to AI analysis functions
- Ensures country-specific processing
- Maintains multi-tenant data isolation
- Provides proper audit logging with practice information

## 🚨 **Multi-Tenancy Risk**
**CRITICAL:** Missing practice context in document analysis can lead to incorrect processing and potential data leakage.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Fix /analyze-document endpoint to include practice context**

## 🔍 **Current Multi-Tenancy Issue**

### **Issue: Missing Practice Context in Document Analysis**
```javascript
// CURRENT - MISSING PRACTICE CONTEXT
router.post('/analyze-document', async (req, res) => {
  const { documentText, documentId, patientId, language } = req.body;
  
  // ❌ PROBLEM: No practice context passed to agent.analyzeDocument
  const result = await agent.analyzeDocument({
    documentText,
    documentId,
    patientId,
    language,
    // ❌ MISSING: practiceContext parameter
  });
  
  res.json(result);
});
```

## ✅ **Fix Practice Context Integration**

### **1. Update Document Analysis Route**
```javascript
// BEFORE - Missing practice context:
router.post('/analyze-document', async (req, res) => {
  const { documentText, documentId, patientId, language } = req.body;
  
  const result = await agent.analyzeDocument({
    documentText,
    documentId,
    patientId,
    language,
  });
  
  res.json(result);
});

// AFTER - With proper practice context:
router.post('/analyze-document',
  generalRateLimit,
  aiRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  sanitizeHeaders,
  sanitizeRequestBody,
  trackOperation('document_analysis'),
  asyncHandler(async (req, res) => {
    const logger = createLogger(req);
    
    try {
      const { documentText, documentId, patientId, language = 'he' } = req.body;
      
      logger.info('Starting document analysis', {
        documentId: documentId,
        patientId: patientId,
        language: language,
        textLength: documentText?.length || 0
      });
      
      // ✅ VALIDATE: Document belongs to current practice
      if (documentId) {
        const Document = req.models.Document;
        const document = await correlatedDbOperation(
          () => Document.findOne({
            _id: documentId,
            practiceId: req.practice._id // ✅ Practice filter
          }),
          {
            req: req,
            operationName: 'findDocument',
            collection: 'documents'
          }
        );
        
        if (!document) {
          logger.warn('Document not found or access denied', {
            documentId: documentId,
            practiceId: req.practice._id
          });
          
          return sendLocalizedError(res, req.country, 'DOCUMENT_NOT_FOUND', {}, 404);
        }
      }
      
      // ✅ VALIDATE: Patient belongs to current practice
      if (patientId) {
        const Patient = req.models.Patient;
        const patient = await correlatedDbOperation(
          () => Patient.findOne({
            _id: patientId,
            practiceId: req.practice._id // ✅ Practice filter
          }),
          {
            req: req,
            operationName: 'findPatient',
            collection: 'patients'
          }
        );
        
        if (!patient) {
          logger.warn('Patient not found or access denied', {
            patientId: patientId,
            practiceId: req.practice._id
          });
          
          return sendLocalizedError(res, req.country, 'PATIENT_NOT_FOUND', {}, 404);
        }
      }
      
      // ✅ CREATE: Enhanced practice context for analysis
      const enhancedClinicContext = {
        ...req.practiceContext,
        requestId: req.requestId,
        logger: logger,
        country: req.country,
        language: language,
        practice: {
          id: req.practice._id,
          name: req.practice.name,
          subdomain: req.practiceSubdomain,
          country: req.practice.contact?.address?.country || req.country,
          timezone: req.practice.settings?.timezone || 'Asia/Jerusalem',
          medicalSystem: req.practice.settings?.medicalSystem || 'israeli'
        },
        user: {
          id: req.user._id,
          email: req.user.email,
          role: req.user.role
        }
      };
      
      // ✅ EXECUTE: Document analysis with circuit breaker protection
      const result = await aiCircuitBreakers.documentAnalysis.execute(
        async () => {
          return await agent.analyzeDocument({
            documentText,
            documentId,
            patientId,
            language,
            practiceContext: enhancedClinicContext // ✅ ADD: Practice context
          });
        },
        aiFallbacks.documentAnalysis
      );
      
      // ✅ LOG: Analysis completion
      if (result.fallback) {
        logger.warn('Document analysis fallback used', {
          circuitBreakerState: aiCircuitBreakers.documentAnalysis.state,
          documentId: documentId
        });
        
        await correlatedAuditLog(req, 'AI_FALLBACK_USED', {
          service: 'document_analysis',
          circuitBreakerState: aiCircuitBreakers.documentAnalysis.state,
          documentId: documentId,
          patientId: patientId
        });
      } else {
        logger.info('Document analysis completed successfully', {
          documentId: documentId,
          analysisType: result.analysisType,
          extractedFields: Object.keys(result.extractedData || {}).length
        });
      }
      
      // ✅ AUDIT: Document analysis activity
      await correlatedAuditLog(req, 'DOCUMENT_ANALYZED', {
        documentId: documentId,
        patientId: patientId,
        language: language,
        analysisType: result.analysisType,
        extractedFieldCount: Object.keys(result.extractedData || {}).length,
        fallbackUsed: !!result.fallback
      });
      
      // ✅ ADD: Request correlation to response
      result.requestId = req.requestId;
      
      res.json(result);
      
    } catch (error) {
      const logger = createLogger(req);
      logger.error('Document analysis failed', error, {
        documentId: req.body.documentId,
        patientId: req.body.patientId
      });
      throw error;
    }
  })
);
```

### **2. Update Agent Service to Handle Practice Context**
```javascript
// UPDATE: Agent service analyzeDocument method
// In agentService.js, update the analyzeDocument method:

// BEFORE:
async analyzeDocument({ documentText, documentId, patientId, language }) {
  // Process without practice context
}

// AFTER:
async analyzeDocument({ documentText, documentId, patientId, language, practiceContext }) {
  try {
    const logger = practiceContext?.logger || console;
    
    logger.debug('Agent analyzing document', {
      documentId: documentId,
      patientId: patientId,
      language: language,
      practiceId: practiceContext?.practice?.id
    });
    
    // ✅ USE: Practice-specific processing
    const analysisPrompt = this.buildAnalysisPrompt({
      documentText,
      language,
      country: practiceContext?.country || 'Israel',
      medicalSystem: practiceContext?.practice?.medicalSystem || 'israeli',
      practiceName: practiceContext?.practice?.name
    });
    
    // ✅ INCLUDE: Practice context in AI request
    const aiResponse = await this.callAIService({
      prompt: analysisPrompt,
      language: language,
      practiceContext: practiceContext
    });
    
    // ✅ PROCESS: Response with practice-specific logic
    const processedResult = this.processAnalysisResult(aiResponse, {
      country: practiceContext?.country,
      medicalSystem: practiceContext?.practice?.medicalSystem,
      language: language
    });
    
    return {
      ...processedResult,
      practiceId: practiceContext?.practice?.id,
      processedBy: practiceContext?.user?.id,
      timestamp: new Date()
    };
    
  } catch (error) {
    if (practiceContext?.logger) {
      practiceContext.logger.error('Agent document analysis failed', error);
    }
    throw error;
  }
}
```

### **3. Add Country-Specific Analysis Logic**
```javascript
// ADD: Country-specific analysis prompt building
buildAnalysisPrompt({ documentText, language, country, medicalSystem, practiceName }) {
  const basePrompt = `Analyze the following medical document and extract relevant information.`;
  
  // ✅ COUNTRY-SPECIFIC: Analysis instructions
  let countrySpecificInstructions = '';
  
  if (country === 'Israel' || medicalSystem === 'israeli') {
    countrySpecificInstructions = `
    - Use Israeli medical terminology and standards
    - Extract information relevant to Israeli healthcare system
    - Consider Israeli medical regulations and practices
    - Format dates in DD/MM/YYYY format
    - Use Hebrew medical terms when appropriate
    `;
  } else if (country === 'United States' || medicalSystem === 'us') {
    countrySpecificInstructions = `
    - Use US medical terminology and standards
    - Extract information relevant to US healthcare system
    - Consider US medical regulations and practices
    - Format dates in MM/DD/YYYY format
    - Use standard US medical abbreviations
    `;
  }
  
  const clinicSpecificInstructions = practiceName ? 
    `\n- This document is from ${practiceName} practice` : '';
  
  return `${basePrompt}
  
  ${countrySpecificInstructions}
  ${clinicSpecificInstructions}
  
  Document Language: ${language}
  Medical System: ${medicalSystem}
  
  Document Text:
  ${documentText}
  
  Please provide a structured analysis with extracted medical information.`;
}
```

### **4. Add Validation Middleware**
```javascript
// ADD: Document analysis input validation
const validateDocumentAnalysisInput = (req, res, next) => {
  const { documentText, documentId, patientId, language } = req.body;
  const errors = [];
  
  // Validate required fields
  if (!documentText && !documentId) {
    errors.push('Either documentText or documentId is required');
  }
  
  if (documentText && typeof documentText !== 'string') {
    errors.push('documentText must be a string');
  }
  
  if (documentText && documentText.length > 50000) {
    errors.push('documentText is too long (max 50,000 characters)');
  }
  
  if (documentId && !mongoose.Types.ObjectId.isValid(documentId)) {
    errors.push('Invalid documentId format');
  }
  
  if (patientId && !mongoose.Types.ObjectId.isValid(patientId)) {
    errors.push('Invalid patientId format');
  }
  
  if (language && !['he', 'en'].includes(language)) {
    errors.push('Language must be "he" or "en"');
  }
  
  if (errors.length > 0) {
    return sendLocalizedError(res, req.country, 'VALIDATION_ERROR', {
      details: errors.join(', ')
    }, 400);
  }
  
  next();
};

// Apply validation to the route
router.post('/analyze-document',
  // ... other middleware ...
  validateDocumentAnalysisInput,
  asyncHandler(async (req, res) => {
    // ... route logic ...
  })
);
```

### **5. Add Document Analysis Metrics**
```javascript
// ADD: Document analysis metrics tracking
const trackDocumentAnalysisMetrics = (req, result, duration) => {
  if (global.metrics) {
    global.metrics.recordAIOperation('document_analysis', 
      result.estimatedTokens || 1000, 
      result.estimatedCost || 0.02
    );
    
    global.metrics.emit('document_analysis', {
      practiceId: req.practice._id,
      country: req.country,
      language: req.body.language,
      duration: duration,
      success: !result.fallback,
      analysisType: result.analysisType,
      extractedFieldCount: Object.keys(result.extractedData || {}).length
    });
  }
};

// Use in the route after analysis completion
const analysisStartTime = Date.now();
const result = await aiCircuitBreakers.documentAnalysis.execute(/* ... */);
const analysisDuration = Date.now() - analysisStartTime;

trackDocumentAnalysisMetrics(req, result, analysisDuration);
```

## ⚠️ **Multi-Tenancy Notes**
- **🚨 CRITICAL:** Practice context ensures proper tenant isolation
- **🚨 CRITICAL:** Document/patient validation prevents cross-practice access
- **🚨 CRITICAL:** Country-specific processing ensures compliance
- **❌ DON'T SKIP:** This fixes a critical multi-tenancy gap

## 🧪 **Testing After Implementation**
1. **Test practice isolation:**
   - Try to analyze documents from different practices
   - Verify access is properly restricted

2. **Test country-specific processing:**
   - Analyze documents with Israeli practice context
   - Analyze documents with US practice context
   - Verify different processing logic

3. **Test validation:**
   - Test with invalid document/patient IDs
   - Verify proper error responses

## ✅ **Success Criteria**
- [ ] Practice context passed to document analysis
- [ ] Document/patient validation working
- [ ] Country-specific processing implemented
- [ ] Audit logging includes practice information
- [ ] Multi-tenant isolation maintained
- [ ] Error handling with proper context

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 1.1:** Update addPatientFunction Schema (Phase 1)

## 📝 **CRITICAL NOTES**
- **FIXES MULTI-TENANCY GAP** - practice context essential for isolation
- **ENABLES COUNTRY-SPECIFIC PROCESSING** - proper medical system handling
- **MAINTAINS DATA SECURITY** - prevents cross-practice document access
- **TEST THOROUGHLY** - verify practice isolation works correctly
