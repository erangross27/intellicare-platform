const SecureDataAccess = require('../services/secureDataAccess');
// Batch Document Upload Routes
// Processes multiple documents in parallel for massive cost savings

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { practiceAuth } = require('../middleware/practiceAuth');
const { practiceContext } = require('../middleware/practiceContext');
const documentEncryption = require('../utils/documentEncryption');
// const SecureDataAccess = require('../services/secureDataAccess'); // Duplicate removed

// Add error logging wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('❌ Batch upload route error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  });
};
// Test middleware to see if request reaches router
router.use((req, res, next) => {
  console.log('🔍 Batch documents router reached:', req.method, req.path);
  next();
});

// Batch upload endpoint - Process multiple documents at once
router.post('/batch-upload',
  (req, res, next) => {
    console.log('📦 Route /batch-upload matched, before practiceContext');
    next();
  },
  practiceContext,
  (req, res, next) => {
    console.log('📦 After practiceContext, before practiceAuth');
    console.log('   req.practiceDb exists:', !!req.practiceDb);
    console.log('   req.models exists:', !!req.models);
    console.log('   req.practice exists:', !!req.practice);
    next();
  },
  practiceAuth,
  (req, res, next) => {
    console.log('📦 After practiceAuth, before handler');
    next();
  },
  asyncHandler(async (req, res) => {
    try {
      console.log('📦 Batch upload endpoint handler reached!');
      console.log('Request body keys:', Object.keys(req.body));
      console.log('req.models available:', !!req.models);
      console.log('req.models.Document available:', !!req.models?.Document);
      
      const { documents, patientId, sessionId, language = 'he' } = req.body;
      
      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        return res.status(400).json({
          success: false,
          message: language === 'he' ? 'לא נשלחו מסמכים' : 'No documents provided'
        });
      }
      
      // Limit batch size to prevent overload
      const MAX_BATCH_SIZE = 10;
      if (documents.length > MAX_BATCH_SIZE) {
        return res.status(400).json({
          success: false,
          message: language === 'he' 
            ? `ניתן להעלות עד ${MAX_BATCH_SIZE} מסמכים בבת אחת`
            : `Maximum ${MAX_BATCH_SIZE} documents can be uploaded at once`
        });
      }
      
      console.log(`📦 Processing batch upload of ${documents.length} documents`);
      const startTime = Date.now();
      
      // Process all documents in parallel
      const uploadPromises = documents.map(async (doc, index) => {
        try {
          // Validate document
          if (!doc.content || !doc.fileName) {
            throw new Error(`Document ${index + 1}: Missing content or filename`);
          }
          
          // Convert base64 to buffer
          const fileBuffer = Buffer.from(doc.content, 'base64');
          
          // Size check (5MB limit per file)
          if (fileBuffer.length > 5 * 1024 * 1024) {
            throw new Error(`Document ${doc.fileName}: File too large (max 5MB)`);
          }
          
          // Encrypt document
          const encryptionResult = documentEncryption.encryptDocument(fileBuffer);
          
          // Generate MongoDB ObjectId
          const documentId = new mongoose.Types.ObjectId();
          
          // Determine folder based on file type
          const mimeType = doc.mimeType || 'application/octet-stream';
          const organizedFolder = mimeType === 'application/pdf' 
            ? 'medical_documents'
            : mimeType.startsWith('image/') 
              ? 'medical_images' 
              : 'other_documents';
          
          // Prepare document record
          if (!req.models || !req.models.Document) {
            throw new Error('Document model not available in req.models');
          }
          const Document = req.models.Document;
          const documentRecord = new Document({
            _id: documentId,
            fileName: doc.fileName,
            originalName: doc.fileName,  // FIX: Add originalName field (required by schema)
            uploadDate: new Date(),
            fileSize: fileBuffer.length,
            mimeType: mimeType,
            patientId: patientId || null,
            practiceId: req.practiceSubdomain,
            uploadedBy: req.user.id,
            category: doc.category || 'general',
            folder: organizedFolder,
            encrypted: true,
            encryptedData: encryptionResult.encryptedData,
            encryptionIV: encryptionResult.iv,
            encryptionAuthTag: encryptionResult.authTag,
            metadata: {
              originalName: doc.fileName,
              uploadMethod: 'batch',
              batchId: sessionId,
              processed: false
            }
          });
          
          // Define proper context for SecureDataAccess
          const context = {
            serviceId: 'batch-documents-service',
            apiKey: req.headers['x-api-key'],
            practiceId: req.practice.id
          };
          
          // Save to database
          await SecureDataAccess.insert('documents', documentRecord, context);
          
          console.log(`✅ Document ${index + 1}/${documents.length}: ${doc.fileName} uploaded`);
          
          return {
            success: true,
            documentId: documentId.toString(),
            fileName: doc.fileName,
            size: fileBuffer.length,
            category: organizedFolder
          };
          
        } catch (error) {
          console.error(`❌ Document ${index + 1} failed:`, error.message);
          return {
            success: false,
            fileName: doc.fileName || `Document ${index + 1}`,
            error: error.message
          };
        }
      });
      
      // Wait for all uploads to complete
      const results = await Promise.all(uploadPromises);
      
      // Count successes and failures
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      const processingTime = Date.now() - startTime;
      console.log(`📦 Batch upload completed in ${processingTime}ms`);
      console.log(`   ✅ Successful: ${successful.length}`);
      console.log(`   ❌ Failed: ${failed.length}`);
      
      // Calculate cost savings
      const estimatedSequentialTime = documents.length * 10000; // 10s per document
      const timeSaved = estimatedSequentialTime - processingTime;
      const costSavingsPercent = Math.round((timeSaved / estimatedSequentialTime) * 100);
      
      // If patientId is provided and we have successful uploads, trigger analysis
      let analysisTriggered = false;
      if (patientId && successful.length > 0) {
        // Queue documents for AI analysis (non-blocking)
        setImmediate(async () => {
          try {
            const agent = req.app.locals.agent;
            if (agent) {
              const documentIds = successful.map(s => s.documentId).join(',');
              const message = language === 'he' 
                ? `נא לנתח ${successful.length} מסמכים שהועלו: ${documentIds}`
                : `Please analyze ${successful.length} uploaded documents: ${documentIds}`;
              
              // This runs in background, doesn't block response
              await agent.processChatMessage(
                message,
                `${req.practiceSubdomain}_${sessionId}`,
                language,
                req.practiceContext
              );
            }
          } catch (error) {
            console.error('Background analysis failed:', error);
          }
        });
        analysisTriggered = true;
      }
      
      // Return response
      res.json({
        success: true,
        summary: {
          total: documents.length,
          successful: successful.length,
          failed: failed.length,
          processingTimeMs: processingTime,
          costSavingsPercent,
          analysisTriggered
        },
        results: {
          successful,
          failed
        },
        message: language === 'he'
          ? `הועלו ${successful.length} מתוך ${documents.length} מסמכים בהצלחה (חיסכון של ${costSavingsPercent}% בזמן ועלות)`
          : `Successfully uploaded ${successful.length} of ${documents.length} documents (${costSavingsPercent}% time and cost savings)`
      });
      
    } catch (error) {
      console.error('Batch upload error:', error);
      res.status(500).json({
        success: false,
        message: language === 'he' 
          ? 'שגיאה בהעלאת מסמכים' 
          : 'Error uploading documents',
        error: error.message
      });
    }
  }));

// Batch analysis endpoint - Analyze multiple documents with single AI call
router.post('/batch-analyze',
  practiceAuth,
  practiceContext,
  async (req, res) => {
    try {
      const { documentIds, patientId, language = 'he' } = req.body;
      
      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: language === 'he' ? 'לא נבחרו מסמכים לניתוח' : 'No documents selected for analysis'
        });
      }
      
      console.log(`🔬 Batch analyzing ${documentIds.length} documents`);
      
      // Fetch all documents in parallel
      const Document = req.models.Document;
      // Define proper context for SecureDataAccess
      const context = {
        serviceId: 'batch-documents-service',
        apiKey: req.headers['x-api-key'],
        practiceId: req.practice.id
      };
      
      const documents = await SecureDataAccess.query('documents', {
        _id: { $in: documentIds },
        practiceId: req.practiceSubdomain
      }, {}, context);
      
      if (documents.length === 0) {
        return res.status(404).json({
          success: false,
          message: language === 'he' ? 'מסמכים לא נמצאו' : 'Documents not found'
        });
      }
      
      // Decrypt all documents in parallel
      const decryptPromises = documents.map(async (doc) => {
        try {
          const decrypted = documentEncryption.decryptDocument(
            doc.encryptedData,
            doc.encryptionIV,
            doc.encryptionAuthTag
          );
          
          return {
            id: doc._id,
            fileName: doc.fileName,
            content: decrypted.toString('base64'),
            mimeType: doc.mimeType,
            category: doc.category
          };
        } catch (error) {
          console.error(`Failed to decrypt ${doc.fileName}:`, error);
          return null;
        }
      });
      
      const decryptedDocs = (await Promise.all(decryptPromises)).filter(d => d !== null);
      
      // Call AI agent once with all documents
      const agent = req.app.locals.agent;
      const batchMessage = language === 'he'
        ? `נא לנתח ${decryptedDocs.length} מסמכים רפואיים ולספק סיכום מקיף`
        : `Please analyze ${decryptedDocs.length} medical documents and provide a comprehensive summary`;
      
      // Include document data in the message
      const enhancedMessage = {
        message: batchMessage,
        documents: decryptedDocs,
        patientId
      };
      
      const result = await agent.processBatchDocuments(
        enhancedMessage,
        `${req.practiceSubdomain}_batch_${Date.now()}`,
        language,
        req.practiceContext
      );
      
      res.json({
        success: true,
        analysis: result.message,
        documentsAnalyzed: decryptedDocs.length,
        costSavings: `${(decryptedDocs.length - 1) * 90}%` // 90% savings per additional document
      });
      
    } catch (error) {
      console.error('Batch analysis error:', error);
      res.status(500).json({
        success: false,
        message: language === 'he' 
          ? 'שגיאה בניתוח מסמכים' 
          : 'Error analyzing documents',
        error: error.message
      });
    }
  });

// Get batch upload status
router.get('/batch-status/:batchId',
  practiceAuth,
  practiceContext,
  async (req, res) => {
    try {
      const { batchId } = req.params;
      
      const Document = req.models.Document;
      // Define proper context for SecureDataAccess
      const context = {
        serviceId: 'batch-documents-service',
        apiKey: req.headers['x-api-key'],
        practiceId: req.practice.id
      };
      
      const documents = await SecureDataAccess.query('documents', {
        'metadata.batchId': batchId,
        practiceId: req.practiceSubdomain
      }, {}, context);
      
      res.json({
        success: true,
        batchId,
        documents: documents.map(doc => ({
          fileName: doc.fileName,
          uploadDate: doc.uploadDate,
          size: doc.fileSize,
          processed: doc.metadata?.processed || false
        })),
        total: documents.length,
        processed: documents.filter(d => d.metadata?.processed).length
      });
      
    } catch (error) {
      console.error('Error fetching batch status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

// Get Claude batch processing status
router.get('/batch-processing-status/:batchId',
  practiceAuth,
  practiceContext,
  async (req, res) => {
    try {
      const { batchId } = req.params;
      
      // Get status from Claude batch processor
      const claudeBatchProcessor = require('../services/claudeBatchProcessor');
      const status = await claudeBatchProcessor.getBatchStatus(batchId);
      
      res.json({
        success: true,
        ...status
      });
      
    } catch (error) {
      console.error('Error fetching batch processing status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

module.exports = router;