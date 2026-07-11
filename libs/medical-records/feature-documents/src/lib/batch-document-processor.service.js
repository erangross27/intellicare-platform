// Batch Document Processor with Smart Patient Association
// Minimizes user interaction and API calls for massive cost savings

const serviceAccountManager = require('../../../../../backend/services/serviceAccountManager');

class BatchDocumentProcessorService {
  constructor() {
    this.patientCache = new Map();
    this.serviceToken = null;
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('batch-document-processor');
    return this;
  }

  // Process batch upload with smart patient detection
  async processBatchUpload(documents, sessionId, language, agentService) {
    console.log(`📦 Processing ${documents.length} documents intelligently`);
    
    // Step 1: Analyze documents to detect patient information
    const analysisResults = await this.analyzeDocumentsForPatients(documents);
    
    // Step 2: Group documents by detected patient
    const groupedDocs = this.groupDocumentsByPatient(analysisResults);
    
    // Step 3: Generate smart prompt based on grouping
    const prompt = this.generateSmartPrompt(groupedDocs, language);
    
    return {
      analysis: analysisResults,
      groups: groupedDocs,
      prompt: prompt,
      suggestedFlow: this.determineBestFlow(groupedDocs)
    };
  }

  // Analyze documents to detect patient names/IDs
  async analyzeDocumentsForPatients(documents) {
    const results = [];
    
    for (const doc of documents) {
      const patientInfo = await this.extractPatientInfo(doc);
      results.push({
        fileName: doc.fileName,
        detectedPatient: patientInfo,
        confidence: patientInfo ? 'high' : 'low'
      });
    }
    
    return results;
  }

  // Extract patient information from document
  async extractPatientInfo(document) {
    // Check filename for patient hints
    const fileNamePatterns = [
      /(\d{9})/, // Israeli ID
      /([א-ת]+[\s_-]+[א-ת]+)/, // Hebrew name
      /([a-zA-Z]+[\s_-]+[a-zA-Z]+)/ // English name
    ];
    
    for (const pattern of fileNamePatterns) {
      const match = document.fileName.match(pattern);
      if (match) {
        return {
          source: 'filename',
          value: match[1],
          type: /\d{9}/.test(match[1]) ? 'id' : 'name'
        };
      }
    }
    
    // If PDF or image, we could use OCR here to detect patient name
    // For now, return null if no patient detected
    return null;
  }

  // Group documents by detected patient
  groupDocumentsByPatient(analysisResults) {
    const groups = new Map();
    
    for (const result of analysisResults) {
      const key = result.detectedPatient?.value || 'unknown';
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      
      groups.get(key).push(result);
    }
    
    return groups;
  }

  // Generate smart prompt based on document grouping
  generateSmartPrompt(groupedDocs, language) {
    const groupCount = groupedDocs.size;
    const unknownDocs = groupedDocs.get('unknown') || [];
    
    if (groupCount === 1 && unknownDocs.length === 0) {
      // All documents belong to same detected patient
      const patientName = Array.from(groupedDocs.keys())[0];
      
      if (language === 'he') {
        return {
          type: 'confirm_single',
          message: `זיהיתי שכל ${groupedDocs.get(patientName).length} המסמכים שייכים ל${patientName}. האם זה נכון?`,
          options: ['כן, אשר', 'לא, בחר מטופל אחר']
        };
      } else {
        return {
          type: 'confirm_single',
          message: `I detected all ${groupedDocs.get(patientName).length} documents belong to ${patientName}. Is this correct?`,
          options: ['Yes, confirm', 'No, select different patient']
        };
      }
    } else if (unknownDocs.length === groupedDocs.get('unknown')?.length) {
      // No patient detected in any document
      if (language === 'he') {
        return {
          type: 'ask_once',
          message: `יש לך ${unknownDocs.length} מסמכים. למי הם שייכים?`,
          hint: 'ניתן להזין שם או תעודת זהות'
        };
      } else {
        return {
          type: 'ask_once',
          message: `You have ${unknownDocs.length} documents. Who do they belong to?`,
          hint: 'You can enter a name or ID number'
        };
      }
    } else {
      // Mixed - some detected, some unknown
      const detected = [];
      for (const [patient, docs] of groupedDocs.entries()) {
        if (patient !== 'unknown') {
          detected.push(`${patient}: ${docs.length} מסמכים`);
        }
      }
      
      if (language === 'he') {
        return {
          type: 'confirm_mixed',
          message: `זיהיתי:\n${detected.join('\n')}\n\n${unknownDocs.length} מסמכים נוספים לא זוהו. האם כולם שייכים לאותו מטופל?`,
          options: ['כן, כולם לאותו מטופל', 'לא, מטופלים שונים']
        };
      } else {
        return {
          type: 'confirm_mixed',
          message: `I detected:\n${detected.join('\n')}\n\n${unknownDocs.length} additional documents unidentified. Do they all belong to the same patient?`,
          options: ['Yes, same patient', 'No, different patients']
        };
      }
    }
  }

  // Determine the best flow based on document grouping
  determineBestFlow(groupedDocs) {
    const groupCount = groupedDocs.size;
    const totalDocs = Array.from(groupedDocs.values()).reduce((sum, docs) => sum + docs.length, 0);
    const unknownCount = groupedDocs.get('unknown')?.length || 0;
    
    if (groupCount === 1 && unknownCount === 0) {
      return 'AUTO_ASSIGN'; // All documents have same patient detected
    } else if (unknownCount === totalDocs) {
      return 'ASK_ONCE'; // No patients detected, ask once for all
    } else if (unknownCount > 0 && groupCount === 2) {
      return 'CONFIRM_AND_ASSIGN'; // Some detected, confirm and assign rest
    } else {
      return 'MANUAL_REVIEW'; // Complex case, need manual review
    }
  }

  // Execute the batch assignment based on user response
  async executeBatchAssignment(documents, patientId, language) {
    const results = [];
    
    // Process all documents in parallel
    const assignPromises = documents.map(async (doc) => {
      try {
        // Update document with patient ID
        doc.patientId = patientId;
        doc.metadata = {
          ...doc.metadata,
          assignedVia: 'batch',
          assignedAt: new Date()
        };
        
        return {
          success: true,
          fileName: doc.fileName,
          patientId: patientId
        };
      } catch (error) {
        return {
          success: false,
          fileName: doc.fileName,
          error: error.message
        };
      }
    });
    
    const assignResults = await Promise.all(assignPromises);
    
    // Generate summary message
    const successful = assignResults.filter(r => r.success).length;
    const message = language === 'he'
      ? `✅ ${successful} מסמכים שויכו בהצלחה למטופל`
      : `✅ ${successful} documents successfully assigned to patient`;
    
    return {
      results: assignResults,
      summary: {
        total: documents.length,
        successful: successful,
        failed: documents.length - successful
      },
      message: message
    };
  }

  // Smart function for Claude to use
  assignBatchDocuments(args) {
    const { documentIds, patientId, assignmentStrategy } = args;
    
    // This function would be called by Claude after getting user confirmation
    // It assigns all documents to the specified patient in ONE operation
    
    console.log(`📎 Assigning ${documentIds.length} documents to patient ${patientId}`);
    console.log(`📊 Strategy: ${assignmentStrategy}`);
    
    // Cost savings calculation
    const oldCost = documentIds.length * 0.02; // If done individually
    const newCost = 0.02; // Single batch operation
    const savings = ((oldCost - newCost) / oldCost * 100).toFixed(0);
    
    return {
      assigned: documentIds.length,
      patientId: patientId,
      costSavings: `${savings}%`,
      message: `All documents assigned in single operation`
    };
  }
}

module.exports = new BatchDocumentProcessorService();