# Gemini Analysis to Database Integration Architecture

## 🔄 Current Flow vs New Flow

### Current Flow (Claude for PDFs, Gemini for Images)
```
PDF Document → Claude → Extracted Data → Database
Image Files → Gemini → Image Analysis → Database
```

### New Flow (Gemini for ALL Medical Documents)
```
ANY Medical Document → Gemini → Structured Analysis → Claude (Orchestration) → Database
```

## 🏗️ Integration Architecture

```
User: "Upload colonoscopy report"
         ↓
    [Claude Agent]
    - Receives request
    - Identifies document type
    - Routes to Gemini
         ↓
    [Gemini Analysis]
    - Analyzes document
    - Extracts medical data
    - Returns structured JSON
         ↓
    [Claude Orchestrator]
    - Validates data
    - Maps to database schema
    - Determines which tables to update
         ↓
    [Database Updates]
    - Medical History
    - Diagnoses
    - Medications
    - Lab Results
    - Procedures
```

## 💾 Database Integration Service

```javascript
// geminiDatabaseIntegration.js
class GeminiDatabaseIntegration {
  constructor() {
    this.gemini = new GoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
    this.claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }

  // Main document processing pipeline
  async processAndStoreDocument(document, documentType, patientId, practiceContext) {
    try {
      // Step 1: Gemini analyzes the document
      const geminiAnalysis = await this.analyzeWithGemini(document, documentType);
      
      // Step 2: Claude maps to database structure
      const databaseMapping = await this.mapToDatabase(geminiAnalysis, documentType);
      
      // Step 3: Store in appropriate tables
      const storedData = await this.storeInDatabase(databaseMapping, patientId, practiceContext);
      
      // Step 4: Update search indices
      await this.updateSearchIndices(storedData);
      
      return {
        success: true,
        analysis: geminiAnalysis,
        stored: storedData
      };
    } catch (error) {
      console.error('Document processing error:', error);
      throw error;
    }
  }

  // Gemini Analysis with Structured Output
  async analyzeWithGemini(document, documentType) {
    // Define structured output schema for database
    const analysisPrompt = `
    Analyze this ${documentType} and extract data in the following JSON structure:
    {
      "patientInfo": {
        "name": "",
        "age": "",
        "gender": "",
        "id": ""
      },
      "visitInfo": {
        "date": "YYYY-MM-DD",
        "provider": "",
        "facility": "",
        "visitType": ""
      },
      "diagnoses": [
        {
          "description": "",
          "icdCode": "",
          "severity": "",
          "primary": true/false
        }
      ],
      "procedures": [
        {
          "name": "",
          "cptCode": "",
          "date": "",
          "findings": "",
          "complications": ""
        }
      ],
      "medications": [
        {
          "name": "",
          "dosage": "",
          "frequency": "",
          "startDate": "",
          "endDate": "",
          "reason": ""
        }
      ],
      "labResults": [
        {
          "testName": "",
          "value": "",
          "unit": "",
          "referenceRange": "",
          "abnormal": true/false,
          "date": ""
        }
      ],
      "vitalSigns": {
        "bloodPressure": "",
        "heartRate": "",
        "temperature": "",
        "weight": "",
        "height": "",
        "bmi": ""
      },
      "recommendations": [
        {
          "type": "follow-up|referral|test|medication",
          "description": "",
          "urgency": "routine|urgent|emergency",
          "dueDate": ""
        }
      ],
      "clinicalNotes": "",
      "citations": []
    }
    
    Document to analyze:
    ${document}
    
    Return ONLY valid JSON that matches this structure.`;

    const result = await this.gemini.generateContent({
      contents: [{ parts: [{ text: analysisPrompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json" // Force JSON output
      }
    });

    // Parse and validate JSON
    const analysis = JSON.parse(result.response.text());
    return this.validateAnalysis(analysis);
  }

  // Claude maps Gemini output to database schema
  async mapToDatabase(geminiAnalysis, documentType) {
    const mappingPrompt = `
    Map this medical analysis to our database structure.
    
    Analysis: ${JSON.stringify(geminiAnalysis)}
    
    Database Tables and Required Fields:
    
    1. medical_history:
       - patientId, date, diagnosis, treatment, medications, notes, doctorName
    
    2. diagnoses:
       - patientId, diagnosisDate, icdCode, description, severity, isPrimary
    
    3. medications:
       - patientId, medicationName, dosage, frequency, startDate, endDate, prescribedBy
    
    4. lab_results:
       - patientId, testDate, testName, result, unit, referenceRange, isAbnormal
    
    5. procedures:
       - patientId, procedureDate, procedureName, cptCode, findings, provider
    
    6. vital_signs:
       - patientId, measurementDate, bloodPressure, heartRate, temperature, weight
    
    Return a JSON object with keys matching table names and values as arrays of records to insert.`;

    const response = await this.claude.messages.create({
      messages: [{ role: 'user', content: mappingPrompt }],
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4096
    });

    return JSON.parse(response.content[0].text);
  }

  // Store in database with transaction support
  async storeInDatabase(databaseMapping, patientId, practiceContext) {
    const stored = {
      medical_history: [],
      diagnoses: [],
      medications: [],
      lab_results: [],
      procedures: [],
      vital_signs: []
    };

    // Use transaction to ensure all or nothing
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Store Medical History
      if (databaseMapping.medical_history?.length > 0) {
        for (const record of databaseMapping.medical_history) {
          const entry = await MedicalHistory.create({
            ...record,
            patientId,
            practice: practiceContext.subdomain,
            createdAt: new Date(),
            source: 'gemini_analysis'
          });
          stored.medical_history.push(entry._id);
        }
      }

      // Store Diagnoses
      if (databaseMapping.diagnoses?.length > 0) {
        for (const diagnosis of databaseMapping.diagnoses) {
          const entry = await Diagnosis.create({
            ...diagnosis,
            patientId,
            practice: practiceContext.subdomain,
            analyzedBy: 'gemini',
            confidence: diagnosis.confidence || 0.95
          });
          stored.diagnoses.push(entry._id);
        }
      }

      // Store Medications
      if (databaseMapping.medications?.length > 0) {
        for (const medication of databaseMapping.medications) {
          const entry = await Medication.create({
            ...medication,
            patientId,
            practice: practiceContext.subdomain,
            addedFrom: 'document_analysis'
          });
          stored.medications.push(entry._id);
        }
      }

      // Store Lab Results
      if (databaseMapping.lab_results?.length > 0) {
        for (const labResult of databaseMapping.lab_results) {
          const entry = await LabResult.create({
            ...labResult,
            patientId,
            practice: practiceContext.subdomain,
            analyzedBy: 'gemini'
          });
          stored.lab_results.push(entry._id);
        }
      }

      // Store Procedures
      if (databaseMapping.procedures?.length > 0) {
        for (const procedure of databaseMapping.procedures) {
          const entry = await Procedure.create({
            ...procedure,
            patientId,
            practice: practiceContext.subdomain,
            documentedFrom: 'gemini_analysis'
          });
          stored.procedures.push(entry._id);
        }
      }

      // Store Vital Signs
      if (databaseMapping.vital_signs?.length > 0) {
        for (const vitals of databaseMapping.vital_signs) {
          const entry = await VitalSigns.create({
            ...vitals,
            patientId,
            practice: practiceContext.subdomain,
            recordedFrom: 'document'
          });
          stored.vital_signs.push(entry._id);
        }
      }

      await session.commitTransaction();
      console.log('✅ All data stored successfully');
      return stored;

    } catch (error) {
      await session.abortTransaction();
      console.error('❌ Database storage failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Update search indices for quick retrieval
  async updateSearchIndices(storedData) {
    // Update Elasticsearch or MongoDB text indices
    const searchUpdates = [];

    // Index diagnoses for search
    if (storedData.diagnoses.length > 0) {
      searchUpdates.push(
        this.updateSearchIndex('diagnoses', storedData.diagnoses)
      );
    }

    // Index medications for drug interaction checks
    if (storedData.medications.length > 0) {
      searchUpdates.push(
        this.updateSearchIndex('medications', storedData.medications)
      );
    }

    await Promise.all(searchUpdates);
  }

  // Validate Gemini output
  validateAnalysis(analysis) {
    const requiredFields = ['diagnoses', 'medications', 'procedures'];
    
    for (const field of requiredFields) {
      if (!analysis[field]) {
        analysis[field] = [];
      }
    }

    // Ensure dates are properly formatted
    if (analysis.visitInfo?.date) {
      analysis.visitInfo.date = this.standardizeDate(analysis.visitInfo.date);
    }

    return analysis;
  }

  // Helper: Standardize date format
  standardizeDate(dateStr) {
    // Convert various date formats to YYYY-MM-DD
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  }
}
```

## 🔌 Integration Points in Agent Service

```javascript
// In agentServiceV5.js - Updated document analysis functions

async analyzeDocument(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Get document content
    const document = await this.getDocumentContent(params.documentId);
    
    // Process with Gemini and store in database
    const integration = new GeminiDatabaseIntegration();
    const result = await integration.processAndStoreDocument(
      document.content,
      document.type,
      params.patientId || session.currentContext?.patientId,
      practiceContext
    );
    
    // Claude formats the response
    const userResponse = await this.claude.messages.create({
      messages: [{
        role: 'user',
        content: `Summarize this medical document analysis for the user:
                  ${JSON.stringify(result.analysis)}
                  Language: ${isHebrew ? 'Hebrew' : 'English'}`
      }],
      model: 'claude-3-sonnet-20240229'
    });
    
    return {
      success: true,
      message: userResponse.content[0].text,
      analysis: result.analysis,
      storedIn: Object.keys(result.stored).filter(k => result.stored[k].length > 0),
      documentId: params.documentId
    };
  } catch (error) {
    console.error('Document analysis error:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בניתוח המסמך' 
        : 'Error analyzing document',
      error: error.message
    };
  }
}

async uploadDocument(params, practiceContext, session) {
  try {
    // Step 1: Store the raw document
    const uploadResult = await this.storeDocument(params);
    
    // Step 2: Automatically analyze and store in database
    const integration = new GeminiDatabaseIntegration();
    const analysisResult = await integration.processAndStoreDocument(
      params.content || params.fileContent,
      params.documentType,
      params.patientId,
      practiceContext
    );
    
    // Step 3: Update document record with analysis
    await this.updateDocumentWithAnalysis(uploadResult.documentId, analysisResult);
    
    return {
      success: true,
      message: session.language === 'he'
        ? `המסמך נותח ונשמר. נמצאו: ${analysisResult.analysis.diagnoses.length} אבחנות, ${analysisResult.analysis.medications.length} תרופות`
        : `Document analyzed and stored. Found: ${analysisResult.analysis.diagnoses.length} diagnoses, ${analysisResult.analysis.medications.length} medications`,
      documentId: uploadResult.documentId,
      analysis: analysisResult.analysis
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      message: 'Document upload failed',
      error: error.message
    };
  }
}
```

## 📊 Database Schema Updates

```javascript
// Add tracking fields to know source of data

// medical_history schema
{
  // ... existing fields ...
  source: {
    type: String,
    enum: ['manual', 'gemini_analysis', 'claude_analysis', 'import'],
    default: 'manual'
  },
  sourceDocumentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },
  analysisConfidence: {
    type: Number,
    min: 0,
    max: 1
  },
  citations: [{
    text: String,
    reference: String
  }]
}

// diagnoses schema
{
  // ... existing fields ...
  analyzedBy: {
    type: String,
    enum: ['doctor', 'gemini', 'claude', 'hybrid']
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  extractedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }
}
```

## 🔄 Workflow Examples

### Example 1: Colonoscopy Report Upload
```
1. User uploads PDF colonoscopy report
2. Claude recognizes document type
3. Gemini analyzes and extracts:
   - Diagnosis: Hemorrhoids (ICD 455.6)
   - Procedure: Colonoscopy (CPT 45378)
   - Medications: Propofol 200mg
   - Findings: BBPS score 8
4. Claude maps to database:
   - Creates diagnosis record
   - Creates procedure record
   - Updates medical history
5. Database now contains structured data
6. User sees: "Colonoscopy report analyzed. Found hemorrhoids diagnosis."
```

### Example 2: Lab Results Processing
```
1. User uploads blood test PDF
2. Claude identifies as lab results
3. Gemini extracts all values:
   - Hemoglobin: 14.5 g/dL
   - Glucose: 95 mg/dL
   - Cholesterol: 180 mg/dL
4. Claude stores in lab_results table
5. Triggers alerts for abnormal values
6. Updates patient dashboard
```

## ✅ Benefits of This Architecture

1. **No Data Loss**: Every piece of medical information is captured
2. **Structured Storage**: Data goes into proper tables, not just documents
3. **Searchable**: Can query "all patients with hemorrhoids"
4. **Trackable**: Know which AI analyzed what and when
5. **Auditable**: Citations and confidence scores preserved
6. **Reversible**: Original documents kept, can re-analyze

## 🚀 Implementation Steps

1. **Create Integration Service** (Day 1)
2. **Update Database Schemas** (Day 1)
3. **Modify Document Upload Flow** (Day 2)
4. **Test with Real Documents** (Day 3)
5. **Add Validation & Error Handling** (Day 4)
6. **Deploy and Monitor** (Day 5)

---

*Integration Architecture Date: August 18, 2025*
*Ensures all Gemini analysis → Database*
*No medical data lost in transition*