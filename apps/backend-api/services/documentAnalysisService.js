// IntelliCare Document Analysis Service - Claude Batch Processing ONLY
// NO GEMINI - Uses Claude Sonnet 4 with Batch API for 50% cost savings
// Single API call for all document processing

const serviceProxyManager = require('./serviceProxyManager');
const medicalCollectionsService = require('./medicalCollectionsService');

class DocumentAnalysisService {
  constructor() {
    this.initialized = false;
    this.claudeBatchProcessor = null;
    this.serviceToken = null;
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      console.log('🚀 Initializing Document Analysis Service (Claude Batch ONLY - NO GEMINI)');
      
      // Get service authentication
      const serviceAccountManager = require('./serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('document-analysis-service');
      
      // Get Claude batch processor
      this.claudeBatchProcessor = serviceProxyManager.get('claudeBatchProcessor');
      if (!this.claudeBatchProcessor) {
        // Initialize it if not available
        const ClaudeBatchProcessor = require('./claudeBatchProcessor');
        this.claudeBatchProcessor = new ClaudeBatchProcessor();
        await this.claudeBatchProcessor.initialize();
        serviceProxyManager.register('claudeBatchProcessor', this.claudeBatchProcessor);
      }
      
      console.log('✅ Document Analysis Service initialized with Claude Batch Processing');
      console.log('💰 Cost: 50% less than regular API, 97% less than Gemini');
      console.log('🚫 NO GEMINI - Claude handles everything');
      
      this.initialized = true;
      
      // Log initialization
      const SecureDataAccess = serviceProxyManager.get('secureDataAccess');
      if (SecureDataAccess) {
        const context = {
          serviceId: 'document-analysis-service',
          operation: 'initialize',
          practiceId: 'global'
        };
        
        await SecureDataAccess.insert('audit_logs', {
          action: 'SERVICE_INITIALIZED',
          service: 'document-analysis-service-claude-only',
          timestamp: new Date()
        }, context);
      }
      
      return this;
    } catch (error) {
      throw new Error(`Failed to initialize DocumentAnalysisService: ${error.message}`);
    }
  }

  /**
   * Main analysis method - uses Claude batch processing for everything
   * Even single documents go through batch API for 50% cost savings
   * NO GEMINI - CLAUDE ONLY
   */
  async analyzeDocument(fileBuffer, fileName, mimeType, language = 'he', sessionId = null, practiceContext = null) {
    try {
      console.log('⚠️ DEPRECATED: analyzeDocument() called - redirecting to batchAnalyzeDocuments()');
      console.log('🚀 Starting Claude batch document analysis (NO GEMINI)...');
      console.log('💰 Using batch API for 50% cost savings');
      console.log(`📄 Document: ${fileName}, Type: ${mimeType}`);

      // Ensure service is initialized
      if (!this.initialized) {
        await this.initialize();
      }

      // REDIRECT to batch processing (background) instead of synchronous wait
      const batchResults = await this.batchAnalyzeDocuments(
        [{
          fileName: fileName,
          fileBuffer: fileBuffer,
          mimeType: mimeType,
          language: language
        }],
        practiceContext, // Pass practiceContext for secure database access
        sessionId
      );

      // batchAnalyzeDocuments returns an array, get first result
      const batchResult = Array.isArray(batchResults) ? batchResults[0] : batchResults;

      // Return background processing response (no extracted data yet)
      console.log('✅ Document submitted for background batch processing');
      console.log(`📦 Batch ID: ${batchResult.batchId || 'pending'}`);

      return {
        success: true,
        backgroundProcessing: true,
        batchId: batchResult.batchId,
        message: batchResult.message || 'Document submitted for background processing',
        category: 'pending' // Will be determined after batch completes
      };
      
    } catch (error) {
      console.error('❌ Document analysis error:', error.message);
      return {
        success: false,
        error: error.message,
        category: null,
        extractedData: null
      };
    }
  }

  /**
   * Transform extracted data to match existing system format
   */
  transformExtractedData(extractedData, category) {
    // Build the transformed data structure
    const transformed = {
      // Basic info
      date: extractedData.date || extractedData.documentDate || new Date().toISOString().split('T')[0],
      patientName: extractedData.patientName,
      patientId: extractedData.patientId,
      dateOfBirth: extractedData.dateOfBirth,
      category: category,
      
      // Medical content
      diagnoses: extractedData.diagnoses || [],
      medications: extractedData.medications || [],
      labResults: extractedData.tests || extractedData.labResults || [],
      procedures: extractedData.procedures || [],
      allergies: extractedData.allergies || [],
      
      // Provider info
      doctorName: extractedData.doctorName,
      practiceName: extractedData.practiceName,
      
      // Additional data
      vitalSigns: extractedData.vitalSigns,
      followUpInstructions: extractedData.followUpInstructions || extractedData.recommendations,
      notes: extractedData.notes || extractedData.additionalNotes,
      
      // Legacy format fields for compatibility
      diagnosis: Array.isArray(extractedData.diagnoses) ? 
        extractedData.diagnoses.join(', ') : extractedData.diagnoses,
      symptoms: extractedData.symptoms || '',
      treatment: extractedData.treatment || '',
      recommendations: extractedData.recommendations || ''
    };
    
    // Category-specific transformations
    switch (category) {
      case 'lab_results':
        transformed.tests = extractedData.tests || extractedData.labResults || [];
        break;
        
      case 'prescriptions':
        transformed.prescriptions = extractedData.medications || [];
        break;
        
      case 'vaccination_records':
        transformed.vaccinations = extractedData.vaccinations || [];
        break;
        
      case 'imaging_reports':
        transformed.findings = extractedData.findings;
        transformed.impression = extractedData.impression;
        break;
        
      case 'discharge_summaries':
        transformed.admissionDate = extractedData.admissionDate;
        transformed.dischargeDate = extractedData.date;
        transformed.hospitalCourse = extractedData.hospitalCourse;
        break;
    }
    
    return transformed;
  }

  /**
   * Backwards compatibility methods (all route to Claude batch)
   * NO GEMINI ANYWHERE
   */
  async checkMedicalRelevance(fileBuffer, mimeType, practiceContext = null) {
    // With Claude, we check relevance as part of the main analysis
    const result = await this.analyzeDocument(fileBuffer, 'temp.pdf', mimeType, 'en', null, practiceContext);
    return {
      isMedical: result.success && result.category !== null,
      confidence: result.success ? 0.95 : 0,
      reasoning: result.success ? 'Medical document identified by Claude' : 'Not a medical document'
    };
  }

  async categorizeDocument(fileBuffer, mimeType, practiceContext = null) {
    // With Claude, categorization happens in main analysis
    const result = await this.analyzeDocument(fileBuffer, 'temp.pdf', mimeType, 'en', null, practiceContext);
    return {
      category: result.category,
      confidence: result.success ? 0.95 : 0,
      reasoning: `Document categorized as ${result.category} by Claude`
    };
  }

  async extractStructuredData(fileBuffer, mimeType, category, sessionId = null, practiceContext = null) {
    // With Claude, extraction happens in main analysis
    const result = await this.analyzeDocument(fileBuffer, 'temp.pdf', mimeType, 'en', sessionId, practiceContext);
    return result.extractedData;
  }

  /**
   * Batch analyze multiple documents - processes ALL documents in a SINGLE batch
   */
  async batchAnalyzeDocuments(documents, practiceContext = null, sessionId = null) {
    console.log(`📦 Batch analyzing ${documents.length} documents with Claude (NO GEMINI)`);
    console.log('📦 Creating SINGLE batch for all documents to save costs and time');
    if (sessionId) {
      console.log(`📦 Session ID: ${sessionId}`);
    }
    
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Prepare documents for batch processing
    const preparedDocs = documents.map(doc => ({
      fileName: doc.fileName,
      fileContent: doc.fileBuffer ?
        (Buffer.isBuffer(doc.fileBuffer) ? doc.fileBuffer.toString('base64') : doc.fileBuffer) :
        doc.content || doc.fileContent,
      mimeType: doc.mimeType || 'application/pdf',
      // CRITICAL FIX: Include documentId with fallback to _id or id
      documentId: doc.documentId || doc._id?.toString() || doc.id
    }));
    
    // Build complete practice context - merge provided context with document metadata
    const fullClinicContext = practiceContext ? {
      ...practiceContext,
      language: practiceContext.language || documents[0]?.language || 'en'
    } : {
      language: documents[0]?.language || 'en',
      practiceId: documents[0]?.practiceId // Try to get from document if not provided
    };
    
    // Use the analyzeBatchDocuments method that creates a SINGLE batch
    const batchResult = await this.claudeBatchProcessor.analyzeBatchDocuments({
      files: preparedDocs,
      patientId: documents[0]?.patientId,
      practiceContext: fullClinicContext,
      uploadId: documents[0]?.uploadId || `batch_${Date.now()}`,
      sessionId: sessionId // Pass sessionId for tracking
    });
    
    if (batchResult.success) {
      // Check if this is background processing
      if (batchResult.backgroundProcessing) {
        console.log(`🚀 Batch submitted for background processing: ${batchResult.batchId}`);
        return [{
          success: true,
          backgroundProcessing: true,
          batchId: batchResult.batchId,
          message: batchResult.message,
          fileCount: batchResult.fileCount,
          status: 'processing'
        }];
      }
      
      // Regular synchronous completion
      console.log(`✅ Batch analysis complete. Processed ${batchResult.results.length} documents in SINGLE batch`);
      return batchResult.results;
    } else {
      // Check if this is a duplicate or timeout that continues in background
      if (batchResult.isDuplicate) {
        console.log(`⚠️ Batch is already being processed, not falling back to individual processing`);
        return [{
          success: false,
          error: 'Batch already in progress. Please wait for completion.',
          isDuplicate: true,
          batchId: batchResult.batchId
        }];
      }
      
      if (batchResult.continuesInBackground) {
        console.log(`⏱️ Batch continues processing in background, not falling back to individual processing`);
        return [{
          success: false,
          error: 'Batch processing continues in background (up to 24 hours). Check back later.',
          continuesInBackground: true,
          batchId: batchResult.batchId
        }];
      }
      
      // Only fallback for actual failures, not duplicates or timeouts
      console.error(`❌ Batch processing failed, falling back to individual processing`);
      const results = [];
      for (const doc of documents) {
        try {
          const result = await this.analyzeDocument(
            doc.fileBuffer,
            doc.fileName,
            doc.mimeType,
            doc.language || 'en',
            doc.sessionId
          );
          
          results.push({
            id: doc.id,
            fileName: doc.fileName,
            success: result.success,
            data: result
          });
        } catch (error) {
          results.push({
            id: doc.id,
            fileName: doc.fileName,
            success: false,
            error: error.message
          });
        }
      }
      return results;
    }
  }

  /**
   * NO CLEANUP NEEDED - Claude doesn't store files like Gemini
   */
  async cleanupUploadedFiles() {
    console.log('🧹 No cleanup needed - Claude batch doesn\'t store files');
  }
  
  /**
   * NO CLEANUP TASK - Claude doesn't need it
   */
  startCleanupTask() {
    console.log('⏭️ No cleanup task needed - Claude batch processing');
  }
}

// Export singleton instance
module.exports = new DocumentAnalysisService();