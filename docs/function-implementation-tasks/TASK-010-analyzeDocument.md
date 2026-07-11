# TASK-010: Implement analyzeDocument Function

## Function Details
- **Name**: analyzeDocument
- **Category**: Document Analysis
- **Priority**: Critical
- **Backend Route**: POST `/documents/:id/analyze` ✅ (Exists)

## Current Implementation
```javascript
async analyzeDocument(params, practiceContext) {
  const response = await this.callAPI(`/documents/${params.documentId}/analyze`, 'POST', {}, practiceContext);
  return {
    success: true,
    data: response.data
  };
}
```

## Required Implementation

### 1. Document Processing
- Extract text using OCR (Tesseract)
- Identify document structure
- Parse medical information
- Extract key-value pairs

### 2. Medical Data Extraction
- Patient information
- Dates and appointments
- Medications and dosages
- Diagnoses and ICD codes
- Lab values and results
- Vital signs

### 3. AI Analysis
- Medical relevance scoring
- Risk assessment
- Treatment recommendations
- Follow-up suggestions

## Implementation Code
```javascript
async analyzeDocument(params, practiceContext) {
  try {
    // Validate parameters
    if (!params.documentId) {
      throw new Error(practiceContext.language === 'he' 
        ? 'מזהה מסמך נדרש'
        : 'Document ID is required');
    }
    
    // Get document information first
    const docResponse = await this.callAPI(
      `/documents/${params.documentId}`, 
      'GET', 
      {}, 
      practiceContext
    );
    
    const document = docResponse.data;
    if (!document) {
      throw new Error(practiceContext.language === 'he' 
        ? 'מסמך לא נמצא'
        : 'Document not found');
    }
    
    // Check if document can be analyzed
    if (!this.canAnalyzeDocument(document)) {
      throw new Error(practiceContext.language === 'he' 
        ? 'לא ניתן לנתח מסמך זה'
        : 'This document cannot be analyzed');
    }
    
    // Start analysis process
    const analysisParams = {
      documentId: params.documentId,
      analysisType: params.analysisType || 'comprehensive',
      extractMedicalData: params.extractMedicalData !== false,
      generateSummary: params.generateSummary !== false,
      detectRisks: params.detectRisks !== false,
      language: practiceContext.language
    };
    
    // Perform OCR if needed
    let ocrResult = null;
    if (this.needsOCR(document.mimeType)) {
      ocrResult = await this.performOCR(document, practiceContext);
    }
    
    // Analyze document content
    const response = await this.callAPI(
      `/documents/${params.documentId}/analyze`, 
      'POST', 
      analysisParams, 
      practiceContext,
      { timeout: 120000 } // 2 minutes for complex analysis
    );
    
    const analysisResult = response.data;
    
    // Process and enhance analysis results
    const processedResult = await this.processAnalysisResult(
      analysisResult, 
      document, 
      ocrResult, 
      practiceContext
    );
    
    // Generate insights and recommendations
    const insights = await this.generateMedicalInsights(
      processedResult, 
      document, 
      practiceContext
    );
    
    // Create comprehensive result
    const result = {
      success: true,
      documentId: params.documentId,
      analysisId: analysisResult.analysisId || Date.now().toString(),
      document: {
        id: document.id,
        title: document.title || document.fileName,
        type: document.documentType,
        date: document.documentDate
      },
      analysis: processedResult,
      insights: insights,
      confidence: this.calculateConfidenceScore(processedResult),
      processingTime: analysisResult.processingTime,
      message: practiceContext.language === 'he' 
        ? `ניתוח מסמך הושלם בהצלחה`
        : `Document analysis completed successfully`,
      summary: this.generateAnalysisSummary(processedResult, practiceContext)
    };
    
    // Add warnings if any
    const warnings = this.checkAnalysisWarnings(processedResult, practiceContext);
    if (warnings.length > 0) {
      result.warnings = warnings;
    }
    
    return result;
    
  } catch (error) {
    console.error('Error analyzing document:', error);
    return {
      success: false,
      error: error.message,
      message: practiceContext.language === 'he' 
        ? `שגיאה בניתוח מסמך: ${error.message}`
        : `Error analyzing document: ${error.message}`
    };
  }
}

// Helper function to check if document can be analyzed
canAnalyzeDocument(document) {
  const analyzableTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  return analyzableTypes.includes(document.mimeType);
}

// Helper function to perform OCR
async performOCR(document, practiceContext) {
  try {
    // This would integrate with Tesseract or similar OCR service
    const ocrResponse = await this.callAPI(
      `/documents/${document.id}/ocr`, 
      'POST', 
      { language: practiceContext.language === 'he' ? 'heb+eng' : 'eng' },
      practiceContext
    );
    
    return {
      text: ocrResponse.data.text,
      confidence: ocrResponse.data.confidence,
      blocks: ocrResponse.data.blocks || [],
      language: ocrResponse.data.detectedLanguage
    };
  } catch (error) {
    console.warn('OCR failed:', error.message);
    return null;
  }
}

// Helper function to process analysis results
async processAnalysisResult(analysisResult, document, ocrResult, practiceContext) {
  const processed = {
    documentType: analysisResult.documentType || document.documentType,
    extractedText: analysisResult.text || ocrResult?.text || '',
    medicalData: this.extractMedicalData(analysisResult),
    structuredData: this.structureData(analysisResult),
    keyFindings: this.extractKeyFindings(analysisResult),
    riskFactors: this.identifyRiskFactors(analysisResult),
    recommendations: this.generateRecommendations(analysisResult, practiceContext)
  };
  
  return processed;
}

// Helper function to extract medical data
extractMedicalData(analysisResult) {
  return {
    patientInfo: this.extractPatientInfo(analysisResult),
    dates: this.extractDates(analysisResult),
    medications: this.extractMedications(analysisResult),
    diagnoses: this.extractDiagnoses(analysisResult),
    labResults: this.extractLabResults(analysisResult),
    vitalSigns: this.extractVitalSigns(analysisResult),
    procedures: this.extractProcedures(analysisResult),
    allergies: this.extractAllergies(analysisResult),
    symptoms: this.extractSymptoms(analysisResult)
  };
}

// Helper function to extract patient information
extractPatientInfo(analysisResult) {
  const text = analysisResult.text || '';
  const patientInfo = {};
  
  // Extract name patterns
  const namePatterns = [
    /Patient:?\s*([A-Za-z\s]+)/i,
    /Name:?\s*([A-Za-z\s]+)/i,
    /שם:?\s*([א-ת\s]+)/,
    /מטופל:?\s*([א-ת\s]+)/
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      patientInfo.name = match[1].trim();
      break;
    }
  }
  
  // Extract ID patterns
  const idPatterns = [
    /ID:?\s*(\d{9})/,
    /ת\.ז\.?:?\s*(\d{9})/,
    /זהות:?\s*(\d{9})/
  ];
  
  for (const pattern of idPatterns) {
    const match = text.match(pattern);
    if (match) {
      patientInfo.id = match[1];
      break;
    }
  }
  
  // Extract birth date patterns
  const birthPatterns = [
    /Born:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /DOB:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /נולד:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/,
    /תאריך לידה:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/
  ];
  
  for (const pattern of birthPatterns) {
    const match = text.match(pattern);
    if (match) {
      patientInfo.birthDate = this.parseDate(match[1]);
      break;
    }
  }
  
  return patientInfo;
}

// Helper function to extract medications
extractMedications(analysisResult) {
  const text = analysisResult.text || '';
  const medications = [];
  
  // Common medication patterns
  const medPatterns = [
    /(\w+)\s+(\d+(?:\.\d+)?)\s*(mg|g|ml|mcg|units?)\s+([^\n]+)/gi,
    /Medication:?\s*([^\n]+)/gi,
    /תרופה:?\s*([^\n]+)/g,
    /Rx:?\s*([^\n]+)/gi
  ];
  
  for (const pattern of medPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && match[2] && match[3]) {
        medications.push({
          name: match[1],
          dosage: match[2],
          unit: match[3],
          instructions: match[4]?.trim()
        });
      } else if (match[1]) {
        medications.push({
          name: match[1].trim(),
          instructions: 'as prescribed'
        });
      }
    }
  }
  
  return medications;
}

// Helper function to calculate confidence score
calculateConfidenceScore(processedResult) {
  let score = 0;
  let factors = 0;
  
  // Text extraction confidence
  if (processedResult.extractedText && processedResult.extractedText.length > 100) {
    score += 25;
  }
  factors++;
  
  // Medical data extraction
  const medicalData = processedResult.medicalData;
  if (medicalData.patientInfo.name) score += 15;
  if (medicalData.medications.length > 0) score += 15;
  if (medicalData.diagnoses.length > 0) score += 15;
  if (medicalData.dates.length > 0) score += 10;
  factors += 4;
  
  // Key findings
  if (processedResult.keyFindings.length > 0) {
    score += 20;
  }
  factors++;
  
  return Math.min(100, Math.round(score / factors * 100 / 20));
}

// Helper function to generate analysis summary
generateAnalysisSummary(processedResult, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  const summary = [];
  
  // Document type
  if (processedResult.documentType) {
    summary.push(isHebrew 
      ? `סוג: ${this.translateDocumentType(processedResult.documentType, true)}`
      : `Type: ${this.translateDocumentType(processedResult.documentType, false)}`);
  }
  
  // Key findings count
  if (processedResult.keyFindings.length > 0) {
    summary.push(isHebrew 
      ? `${processedResult.keyFindings.length} ממצאים עיקריים`
      : `${processedResult.keyFindings.length} key findings`);
  }
  
  // Medical data extracted
  const medicalData = processedResult.medicalData;
  let dataPoints = 0;
  if (medicalData.medications.length > 0) dataPoints++;
  if (medicalData.diagnoses.length > 0) dataPoints++;
  if (medicalData.labResults.length > 0) dataPoints++;
  if (medicalData.vitalSigns.length > 0) dataPoints++;
  
  if (dataPoints > 0) {
    summary.push(isHebrew 
      ? `${dataPoints} סוגי נתונים רפואיים`
      : `${dataPoints} medical data types`);
  }
  
  return summary.join(' | ');
}

// Additional helper functions for data extraction
extractDates(analysisResult) {
  const text = analysisResult.text || '';
  const dates = [];
  const datePattern = /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g;
  let match;
  
  while ((match = datePattern.exec(text)) !== null) {
    dates.push(this.parseDate(match[0]));
  }
  
  return [...new Set(dates)].filter(Boolean);
}

extractDiagnoses(analysisResult) {
  const text = analysisResult.text || '';
  const diagnoses = [];
  
  const diagnosisPatterns = [
    /Diagnosis:?\s*([^\n]+)/gi,
    /אבחנה:?\s*([^\n]+)/g,
    /ICD[^:]*:?\s*([^\n]+)/gi
  ];
  
  for (const pattern of diagnosisPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      diagnoses.push(match[1].trim());
    }
  }
  
  return [...new Set(diagnoses)];
}

parseDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}
```

## Testing Checklist
- [ ] Test PDF document analysis
- [ ] Test image document analysis
- [ ] Test text extraction accuracy
- [ ] Test medical data extraction
- [ ] Test patient information extraction
- [ ] Test medication extraction
- [ ] Test diagnosis extraction
- [ ] Test confidence scoring
- [ ] Test Hebrew document analysis
- [ ] Test English document analysis
- [ ] Test error handling for invalid documents

## Notes
- Integrate with advanced OCR services (Google Vision, AWS Textract)
- Add support for DICOM medical images
- Implement machine learning models for better medical data extraction
- Add support for handwritten text recognition
- Consider implementing document templates for structured extraction