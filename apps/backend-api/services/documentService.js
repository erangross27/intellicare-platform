/**
 * DocumentService
 *
 * Domain: document
 * Extracted from: agentServiceV4.js
 * Functions: 13
 *
 * Purpose: Handle all document-related operations including upload, analysis, and categorization
 *
 * Architecture:
 * - Uses SecureDataAccess for all database operations (no HTTP calls)
 * - Practice-aware multi-tenant isolation
 * - Proper error handling and logging
 * - Service authentication via ServiceAccountManager
 */

const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const { ObjectId } = require('mongodb');

class DocumentService {
  constructor() {
    this.serviceName = 'documentService';
    this.serviceAuth = null;
  }

  /**
   * Initialize service with authentication
   */
  async initialize() {
    if (!this.serviceAuth) {
      this.serviceAuth = await serviceAccountManager.authenticate(this.serviceName);
      console.log(`✅ ${this.serviceName} authenticated successfully`);
    }
    return this.serviceAuth;
  }

  /**
   * Create secure context for database operations
   * @param {Object} practiceContext - Practice context from request
   * @param {string} operation - Operation name
   * @returns {Object} Security context
   */
  createSecureContext(practiceContext, operation) {
    return {
      serviceId: this.serviceName,
      operation: operation,
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId || practiceContext?.id || 'global',
      apiKey: this.serviceAuth?.apiKey || this.serviceAuth
    };
  }

  /**
   * Normalize practice context to ensure consistent format
   * @param {Object} practiceContext - Raw practice context
   * @returns {Object} Normalized practice context
   */
  normalizePracticeContext(practiceContext) {
    if (!practiceContext) {
      return { id: 'global', subdomain: 'global' };
    }

    return {
      id: practiceContext.practiceId || practiceContext.id || 'global',
      subdomain: practiceContext.subdomain || practiceContext.practiceSubdomain || 'global',
      name: practiceContext.name || practiceContext.practiceName,
      language: practiceContext.language || 'en'
    };
  }

  // ============================================================================
  // SERVICE FUNCTIONS - EXTRACTED FROM agentServiceV4.js
  // ============================================================================

/**
 * Process documents in background with real-time WebSocket notifications
 * DEPRECATED: Now using claudeBatchProcessor.analyzeBatchDocuments directly (1M context)
 * Keeping this method for reference only - it uses Skills API with 200K limit
 */
async processDocumentsInBackground(preparedDocuments, patientId, sessionId, practiceId, userId) {
  console.log(`📋 Background processing ${preparedDocuments.length} document(s)`);

  for (const doc of preparedDocuments) {
    try {
      const pdfBuffer = Buffer.from(doc.fileContent, 'base64');

      // Emit start notification
      this.emitWebSocketNotification(practiceId, userId, sessionId, {
        type: 'document_analysis_progress',
        status: 'analyzing',
        fileName: doc.fileName,
        message: `Analyzing ${doc.fileName}...`,
        timestamp: new Date()
      });

      // DEPRECATED: This method uses Skills API (removed)
      // Now using claudeBatchProcessor.analyzeBatchDocuments directly in analyzeUploadedDocuments
      throw new Error('processDocumentsInBackground is deprecated - use Batch API instead');

      // Send completion notification with SUMMARY
      const summaryText = result.extractedData?._extractionSummary;

      console.log('📤 Sending WebSocket notification with summary:', {
        hasSummary: !!summaryText,
        summaryLength: summaryText?.length || 0,
        summaryPreview: summaryText?.substring(0, 100)
      });

      // Sanitize filename for display (remove problematic characters)
      const safeFileName = (doc.fileName || 'document').replace(/['"\\]/g, '');

      this.emitWebSocketNotification(practiceId, userId, sessionId, {
        type: 'document_analysis_complete',
        status: 'completed',
        sessionId: sessionId, // CRITICAL: Include sessionId for frontend matching
        fileName: safeFileName,
        patientName: result.extractedData?.patientName,
        documentSpecialty: result.extractedData?.documentSpecialty,
        summary: summaryText, // SUMMARY HERE!
        cost: result.metadata?.cost,
        elapsedTime: result.metadata?.elapsedTime,
        message: `✅ Analysis complete for ${safeFileName}`,
        timestamp: new Date()
      });

      console.log(`✅ Background analysis complete: ${doc.fileName}`);

    } catch (error) {
      console.error(`❌ Background analysis failed for ${doc.fileName}:`, error.message);

      // Determine user-friendly error message
      let userMessage = `❌ Analysis failed for ${doc.fileName}`;
      let errorDetails = error.message;
      let retryable = false;

      // Check for specific error types
      if (error.message.includes('500') || error.message.includes('Internal server error')) {
        userMessage = `⚠️ Anthropic API is temporarily unavailable. Please try again in a few minutes.`;
        errorDetails = 'API returned 500 Internal Server Error after 3 retry attempts';
        retryable = true;
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        userMessage = `⚠️ Rate limit reached. Please wait a moment and try again.`;
        errorDetails = 'API rate limit exceeded';
        retryable = true;
      } else if (error.message.includes('timeout')) {
        userMessage = `⚠️ Analysis timed out. Document may be too large or complex.`;
        errorDetails = error.message;
        retryable = true;
      }

      // Send error notification
      this.emitWebSocketNotification(practiceId, userId, sessionId, {
        type: 'document_analysis_error',
        status: 'failed',
        fileName: doc.fileName,
        error: errorDetails,
        message: userMessage,
        retryable: retryable,
        timestamp: new Date()
      });

      console.log(`📤 Sent error notification to frontend: ${userMessage}`);
    }
  }
}

/**
 * Emit WebSocket notification
 */
emitWebSocketNotification(practiceId, userId, sessionId, data) {
  if (global.io) {
    // Use data.type as the event name (e.g., 'document_analysis_complete')
    const eventType = data.type || 'notification';

    if (practiceId) {
      global.io.to(`practice_${practiceId}`).emit(eventType, data);
    }
    if (userId) {
      global.io.to(`user_${userId}`).emit(eventType, data);
    }
    if (sessionId) {
      global.io.to(`session_${sessionId}`).emit(eventType, data);
    }
  }
}

async analyzeUploadedDocuments(params, practiceContext, session) {
    try {
      const isHebrew = practiceContext.language === 'he';

      // Warn if models not available (may indicate context issue) but continue with SecureDataAccess
      if (!practiceContext.models?.PendingUpload) {
        console.warn('⚠️ [DocumentService] PendingUpload model not in context - using SecureDataAccess directly');
      }

      let pendingUploads;
      
      // If specific uploadId is provided, process only that upload
      if (params.uploadId) {
        console.log(`📎 Processing specific upload: ${params.uploadId}`);
        pendingUploads = await SecureDataAccess.query('pendinguploads', 
          { 
            uploadId: params.uploadId,
            processed: { $ne: true }
          }, 
          { limit: 1 }, 
          {
            serviceId: this.serviceName,
            operation: 'get-specific-upload',
            practiceId: practiceContext.practiceId,
            apiKey: this.serviceAuth?.apiKey || this.serviceAuth
          }
        );
      } else {
        // Get all pending uploads for this session
        console.log(`📎 Processing all pending uploads for session: ${session?.sessionId}`);
        pendingUploads = await SecureDataAccess.query('pendinguploads', 
          { 
            sessionId: session?.sessionId || session?.id,
            processed: { $ne: true }
          }, 
          { limit: 100 }, 
          {
            serviceId: this.serviceName,
            operation: 'get-pending-uploads',
            practiceId: practiceContext.practiceId,
            apiKey: this.serviceAuth?.apiKey || this.serviceAuth
          }
        );
      }
      
      if (!pendingUploads || pendingUploads.length === 0) {
        return {
          success: false,
          message: isHebrew 
            ? 'לא נמצאו קבצים ממתינים לעיבוד'
            : 'No pending files found for processing'
        };
      }
      
      console.log(`📎 Found ${pendingUploads.length} pending uploads to process`);

      // CRITICAL: Frontend does NOT know patientId (only has PDF with patient name)
      // PatientId will be determined by backend after extracting patient name from PDF
      // The extraction process will:
      //   1. Extract patient name from PDF using Skills API
      //   2. Search database for patient using that name
      //   3. Use found patientId or create new patient
      let patientId = null;
      console.log('ℹ️ PatientId will be determined from PDF content (not provided by frontend)');

      const results = {
        processed: [],
        needsPatient: [],
        failed: []
      };
      
      // Separate CSV files (for imports) from all other files (for analysis)
      const csvImportFiles = pendingUploads.filter(u => 
        u.mimeType?.includes('csv') || 
        u.fileName?.toLowerCase().endsWith('.csv')
      );
      
      const analysisFiles = pendingUploads.filter(u => 
        !csvImportFiles.includes(u)
      );
      
      // Process ALL non-CSV files via Skills for real-time analysis (83% cheaper than batch, 90s vs <24h)
      if (analysisFiles.length > 0) {
        console.log(`🚀 Processing ${analysisFiles.length} file(s) via IntelliCare Medical Extractor Skill (real-time, 83% cheaper)`);
        console.log(`📄 Files: ${analysisFiles.map(f => f.fileName).join(', ')}`);

        // First, decrypt all files and prepare them for Skills analysis
        const preparedDocuments = [];
        for (const upload of analysisFiles) {
          try {
            // Get the pending upload with files
            const pendingUploads = await SecureDataAccess.query('pendinguploads', 
              { uploadId: upload.uploadId }, 
              { limit: 1 }, 
              {
                serviceId: this.serviceName,
                operation: 'get-upload-for-batch',
                practiceId: practiceContext.practiceId,
                apiKey: this.serviceAuth?.apiKey || this.serviceAuth
              }
            );
            
            if (pendingUploads && pendingUploads[0] && pendingUploads[0].files) {
              for (const file of pendingUploads[0].files) {
                // Decrypt file content
                const e2eEncryptionService = require('./e2eEncryptionService');
                let decryptedContent;
                
                try {
                  let encryptedData;
                  if (file.encryptedPackage) {
                    encryptedData = file.encryptedPackage;
                  } else {
                    let dataBuffer;
                    if (Buffer.isBuffer(file.encryptedContent)) {
                      dataBuffer = file.encryptedContent;
                    } else if (file.encryptedContent && file.encryptedContent.type === 'Buffer' && Array.isArray(file.encryptedContent.data)) {
                      dataBuffer = Buffer.from(file.encryptedContent.data);
                    } else if (typeof file.encryptedContent === 'string') {
                      dataBuffer = Buffer.from(file.encryptedContent, 'base64');
                    } else {
                      throw new Error(`Invalid encryptedContent type`);
                    }
                    
                    encryptedData = {
                      data: dataBuffer.toString('base64'),
                      iv: file.contentIv,
                      tag: file.contentTag,
                      algorithm: 'aes-256-gcm'
                    };
                  }
                  
                  // Use service-level decryption (PendingUploads use service key, not user key)
                  const decryptedResult = await e2eEncryptionService.decryptWithServiceKey(
                    encryptedData
                  );
                  
                  decryptedContent = Buffer.isBuffer(decryptedResult.data) 
                    ? decryptedResult.data.toString('base64')
                    : decryptedResult.data;
                  
                  // Add to prepared documents
                  preparedDocuments.push({
                    fileName: file.originalName,
                    fileContent: decryptedContent,  // Already base64
                    mimeType: file.mimetype || 'application/pdf',
                    uploadId: upload.uploadId
                  });
                } catch (decryptError) {
                  console.error(`Failed to decrypt file ${file.originalName}:`, decryptError);
                  results.failed.push({
                    uploadId: upload.uploadId,
                    fileName: file.originalName,
                    error: 'Decryption failed'
                  });
                }
              }
            }
          } catch (error) {
            console.error(`Failed to prepare upload ${upload.uploadId}:`, error);
            results.failed.push({
              uploadId: upload.uploadId,
              fileName: upload.fileName,
              error: error.message
            });
          }
        }
        
        // Separate medical images from documents for specialized analysis
        const imageFiles = preparedDocuments.filter(doc => {
          const mime = (doc.mimeType || '').toLowerCase();
          const name = (doc.fileName || '').toLowerCase();
          return mime.startsWith('image/') || mime === 'application/dicom' || name.endsWith('.dcm');
        });
        const documentFiles = preparedDocuments.filter(doc => !imageFiles.includes(doc));

        // Route medical images to Claude Vision for radiology-specific analysis
        if (imageFiles.length > 0) {
          console.log(`🏥 Detected ${imageFiles.length} medical image(s) - routing to Claude Vision for radiology analysis`);
          const claudeMedicalImageService = require('./claudeMedicalImageService');

          for (const imgDoc of imageFiles) {
            try {
              const imageBuffer = Buffer.from(imgDoc.fileContent, 'base64');
              let analysisMimeType = imgDoc.mimeType;
              let dicomMetadata = null;

              // Convert DICOM to JPEG if needed
              if (analysisMimeType === 'application/dicom' || imgDoc.fileName?.toLowerCase().endsWith('.dcm')) {
                try {
                  const dicomConverterService = require('./dicomConverterService');
                  const dicomResult = await dicomConverterService.processForAnalysis(imageBuffer);
                  const convertedBuffer = dicomResult.imageBuffer;
                  analysisMimeType = dicomResult.mimeType;
                  dicomMetadata = dicomResult.metadata;
                  console.log(`📋 DICOM converted: ${dicomMetadata.modality || 'unknown'} modality`);

                  // Analyze the converted JPEG
                  const analysisResult = await claudeMedicalImageService.analyzeImage(
                    convertedBuffer, analysisMimeType, {
                      patientId: patientId,
                      practiceId: practiceContext.practiceId,
                      dicomMetadata,
                      documentId: imgDoc.uploadId
                    }
                  );

                  // Save encrypted image to medical_images collection
                  try {
                    const e2eEncryptionService = require('./e2eEncryptionService');
                    const encPkg = await e2eEncryptionService.encryptWithServiceKey(imageBuffer, { originalName: imgDoc.fileName });
                    await SecureDataAccess.insert('medical_images', {
                      patientId: patientId,
                      encryptedContent: Buffer.from(encPkg.data, 'base64'),
                      contentIv: encPkg.iv,
                      contentTag: encPkg.tag,
                      originalName: imgDoc.fileName,
                      mimeType: analysisMimeType,
                      fileSize: imageBuffer.length,
                      modality: analysisResult.modality || 'general',
                      bodyPart: dicomMetadata?.bodyPartExamined || '',
                      studyDate: dicomMetadata?.studyDate ? new Date(dicomMetadata.studyDate) : new Date(),
                      dicomMetadata: dicomMetadata || undefined,
                      analysisSource: 'claude',
                      aiModelVersion: 'claude-sonnet-5',
                      analysisSummary: { impression: analysisResult.impression || '', urgency: analysisResult.urgency || 'routine', findings: analysisResult.findings || '' },
                      practiceId: practiceContext.practiceId,
                      uploadSource: 'document_upload',
                      status: 'completed'
                    }, { serviceId: this.serviceName, operation: 'save_medical_image', practiceId: practiceContext.practiceId, apiKey: this.serviceAuth?.apiKey || this.serviceAuth });
                  } catch (imgSaveErr) {
                    console.warn(`⚠️ Failed to save encrypted image to medical_images:`, imgSaveErr.message);
                  }

                  results.processed.push({
                    uploadId: imgDoc.uploadId,
                    fileName: imgDoc.fileName,
                    status: 'completed',
                    type: 'medical_image',
                    collection: 'imaging_reports',
                    analysis: {
                      modality: analysisResult.modality,
                      impression: analysisResult.impression,
                      urgency: analysisResult.urgency
                    }
                  });
                  console.log(`✅ Image analyzed: ${imgDoc.fileName} (${analysisResult.modality}, urgency: ${analysisResult.urgency})`);
                } catch (dicomErr) {
                  console.error(`❌ DICOM processing failed for ${imgDoc.fileName}:`, dicomErr.message);
                  results.failed.push({ uploadId: imgDoc.uploadId, fileName: imgDoc.fileName, error: dicomErr.message });
                }
              } else {
                // Standard image (JPEG/PNG) - analyze directly
                const analysisResult = await claudeMedicalImageService.analyzeImage(
                  imageBuffer, analysisMimeType, {
                    patientId: patientId,
                    practiceId: practiceContext.practiceId,
                    documentId: imgDoc.uploadId
                  }
                );

                // Save encrypted image to medical_images collection
                try {
                  const e2eEncryptionService = require('./e2eEncryptionService');
                  const encPkg = await e2eEncryptionService.encryptWithServiceKey(imageBuffer, { originalName: imgDoc.fileName });
                  await SecureDataAccess.insert('medical_images', {
                    patientId: patientId,
                    encryptedContent: Buffer.from(encPkg.data, 'base64'),
                    contentIv: encPkg.iv,
                    contentTag: encPkg.tag,
                    originalName: imgDoc.fileName,
                    mimeType: analysisMimeType,
                    fileSize: imageBuffer.length,
                    modality: analysisResult.modality || 'general',
                    bodyPart: '',
                    studyDate: new Date(),
                    analysisSource: 'claude',
                    aiModelVersion: 'claude-sonnet-5',
                    analysisSummary: { impression: analysisResult.impression || '', urgency: analysisResult.urgency || 'routine', findings: analysisResult.findings || '' },
                    practiceId: practiceContext.practiceId,
                    uploadSource: 'document_upload',
                    status: 'completed'
                  }, { serviceId: this.serviceName, operation: 'save_medical_image', practiceId: practiceContext.practiceId, apiKey: this.serviceAuth?.apiKey || this.serviceAuth });
                } catch (imgSaveErr) {
                  console.warn(`⚠️ Failed to save encrypted image to medical_images:`, imgSaveErr.message);
                }

                results.processed.push({
                  uploadId: imgDoc.uploadId,
                  fileName: imgDoc.fileName,
                  status: 'completed',
                  type: 'medical_image',
                  collection: 'imaging_reports',
                  analysis: {
                    modality: analysisResult.modality,
                    impression: analysisResult.impression,
                    urgency: analysisResult.urgency
                  }
                });
                console.log(`✅ Image analyzed: ${imgDoc.fileName} (${analysisResult.modality}, urgency: ${analysisResult.urgency})`);
              }
            } catch (imgError) {
              console.error(`❌ Image analysis failed for ${imgDoc.fileName}:`, imgError.message);
              results.failed.push({ uploadId: imgDoc.uploadId, fileName: imgDoc.fileName, error: imgError.message });
            }
          }
        }

        // Send remaining document files (PDFs, Word, etc.) to Batch API
        if (documentFiles.length > 0) {
          console.log(`🚀 Analyzing ${documentFiles.length} document(s) with Claude Batch API (1M context, 50% cheaper)`);

          // Use claudeBatchProcessor for batch processing (1M context, 50% cheaper, proven to work)
          const claudeBatchProcessor = require('./claudeBatchProcessor');

          // Get sessionId from either session object or parameters
          // Debug logging to understand session structure
          console.log('🔍 Session object structure:', {
            hasSession: !!session,
            sessionId: session?.sessionId,
            id: session?.id,
            sessionKeys: session ? Object.keys(session) : [],
            paramsSessionId: params?.sessionId
          });

          // Try to extract session ID from various possible locations
          let sessionIdToUse = session?.sessionId || session?.id || session?.session?.sessionId || params?.sessionId;

          // If session object is a string itself, use it
          if (typeof session === 'string' && session.includes('session')) {
            sessionIdToUse = session;
          }

          // Fallback to generating one if nothing found
          if (!sessionIdToUse) {
            console.warn('⚠️ No sessionId found in session object or params, generating new one');
            sessionIdToUse = `session_${Date.now()}`;
          }

          console.log(`📋 Using sessionId for Batch API analysis: ${sessionIdToUse}`);

          // Run batch analysis in BACKGROUND - don't wait
          console.log('🚀 Starting BACKGROUND batch analysis - releasing frontend immediately');

          // Start batch analysis async without waiting
          claudeBatchProcessor.analyzeBatchDocuments({
            files: documentFiles,
            patientId: patientId,
            practiceContext: {
              practiceId: practiceContext.practiceId,
              subdomain: practiceContext.subdomain || practiceContext.practiceId,
              language: practiceContext.language
            },
            uploadId: documentFiles[0]?.uploadId,
            sessionId: sessionIdToUse,
            userId: session?.userId || practiceContext.userId || 'unknown'
          }).catch(error => {
            console.error('❌ Background batch analysis failed:', error);
          });

          // Mark documents as processing
          for (const doc of documentFiles) {
            results.processed.push({
              uploadId: doc.uploadId,
              fileName: doc.fileName,
              status: 'processing',
              message: 'Analysis started - you will receive notifications when complete'
            });
          }

          console.log(`✅ ${documentFiles.length} document(s) started in background`);
        }
      }
      
      // Process CSV imports individually for proper validation and data import
      for (const upload of csvImportFiles) {
        try {
          console.log(`📊 Processing CSV import file: ${upload.fileName} (${upload.uploadId})`);
          console.log(`   Type: Data import (patients/users/lists)`);
          
          // This handles CSV imports with proper validation
          const analysisParams = {
            documentId: upload.uploadId,
            patientId: patientId,
            analysisType: 'comprehensive'
          };
          
          const result = await this.analyzeDocument(analysisParams, practiceContext, session);
          
          if (result.success) {
            // If we got patient info from the analysis, try to find/create patient
            if (!patientId && result.data?.extractedData?.patientInfo) {
              const patientInfo = result.data.extractedData.patientInfo;
              
              // Try to find patient by national ID or name
              if (patientInfo.nationalId) {
                const patients = await SecureDataAccess.query('patients',
                  { nationalId: patientInfo.nationalId },
                  {
                    limit: 1,
                    projection: {
                      _id: 1
                    }
                  },
                  {
                    serviceId: this.serviceName,
                    operation: 'find-patient-by-nationalid',
                    practiceId: practiceContext.practiceId,
                    apiKey: this.serviceAuth?.apiKey || this.serviceAuth
                  }
                );
                
                if (patients && patients.length > 0) {
                  patientId = patients[0]._id.toString();
                  console.log(`✅ Found patient by national ID: ${patientInfo.nationalId}`);
                }
              }
              
              // If still no patient, try by name
              if (!patientId && patientInfo.firstName && patientInfo.lastName) {
                const patients = await SecureDataAccess.query('patients',
                  {
                    firstName: patientInfo.firstName,
                    lastName: patientInfo.lastName
                  },
                  {
                    limit: 1,
                    projection: {
                      _id: 1
                    }
                  },
                  {
                    serviceId: this.serviceName,
                    operation: 'find-patient-by-name',
                    practiceId: practiceContext.practiceId,
                    apiKey: this.serviceAuth?.apiKey || this.serviceAuth
                  }
                );
                
                if (patients && patients.length > 0) {
                  patientId = patients[0]._id.toString();
                  console.log(`✅ Found patient by name: ${patientInfo.firstName} ${patientInfo.lastName}`);
                }
              }
            }
            
            // Mark upload as processed
            await SecureDataAccess.update('pendinguploads', 
              { _id: upload._id }, 
              { 
                processed: true, 
                processedDate: new Date(), 
                patientId: patientId || null,
                analysisResult: result.data?.extractedData || {}
              },
              {
                serviceId: this.serviceName,
                operation: 'mark-upload-processed',
                practiceId: practiceContext.practiceId,
                apiKey: this.serviceAuth?.apiKey || this.serviceAuth
              }
            );
            
            // The extracted data could be in different places depending on the response structure
            const extractedData = result.data?.extractedData || 
                                 result.data?.analysis?.medicalData || 
                                 result.data?.analysis ||
                                 result.data || 
                                 {};
            
            // Log what we got for debugging
            console.log(`📊 [${upload.uploadId}] Analysis result structure:`, {
              hasData: !!result.data,
              hasExtractedData: !!result.data?.extractedData,
              hasAnalysis: !!result.data?.analysis,
              hasMedicalData: !!result.data?.analysis?.medicalData,
              topLevelKeys: result.data ? Object.keys(result.data) : [],
              extractedKeys: Object.keys(extractedData),
              patientNameFound: !!extractedData.patientName,
              patientName: extractedData.patientName || 'NOT FOUND'
            });
            
            results.processed.push({
              uploadId: upload.uploadId,
              fileName: upload.fileName,
              documentId: result.data?.documentId,
              patientId: patientId || result.data?.patientId,
              extractedData: extractedData,
              patientName: result.data?.patientName || extractedData.patientName || 
                (extractedData.firstName && extractedData.lastName ? 
                  `${extractedData.firstName} ${extractedData.lastName}`.trim() : null)
            });
          } else {
            results.failed.push({
              uploadId: upload.uploadId,
              fileName: upload.fileName,
              error: result.error || result.message
            });
          }
        } catch (error) {
          console.error(`Error processing upload ${upload.uploadId}:`, error);
          results.failed.push({
            uploadId: upload.uploadId,
            fileName: upload.fileName,
            error: error.message
          });
        }
      }
      
      // Build response message - analysis runs in background
      const summaryParts = [];
      if (results.processed.length > 0) {
        summaryParts.push(isHebrew
          ? `✅ ${results.processed.length} מסמכים נשלחו לניתוח ברקע. תקבל התראות בזמן אמת עם סיום הניתוח.`
          : `✅ ${results.processed.length} document(s) sent for background analysis. You'll receive real-time notifications when complete.`);
      }
      if (results.needsPatient.length > 0) {
        summaryParts.push(isHebrew 
          ? `${results.needsPatient.length} קבצים דורשים בחירת מטופל`
          : `${results.needsPatient.length} files need patient selection`);
      }
      if (results.failed.length > 0) {
        summaryParts.push(isHebrew 
          ? `${results.failed.length} קבצים נכשלו`
          : `${results.failed.length} files failed`);
      }
      
      // If files need patient selection, provide guidance
      if (results.needsPatient.length > 0) {
        const fileList = results.needsPatient.map(f => f.fileName).join(', ');
        return {
          success: true,
          needsPatientSelection: true,
          message: isHebrew 
            ? `נמצאו ${results.needsPatient.length} קבצים: ${fileList}. אנא ציין את מספר תעודת הזהות של המטופל לשיוך המסמכים.`
            : `Found ${results.needsPatient.length} files: ${fileList}. Please provide the patient's national ID to associate these documents.`,
          data: {
            pendingFiles: results.needsPatient,
            processed: results.processed,
            failed: results.failed
          }
        };
      }
      
      let finalMessage = summaryParts.join('\n\n');

      return {
        success: true,
        message: finalMessage,
        data: {
          total: pendingUploads.length,
          processed: results.processed.length,
          needsPatient: results.needsPatient.length,
          failed: results.failed.length,
          status: 'processing',
          message: 'Analysis started in background - listen for WebSocket notifications',
          results: results
        }
      };
      
    } catch (error) {
      console.error('Error in analyzeUploadedDocuments:', error);
      return {
        success: false,
        message: practiceContext.language === 'he' 
          ? `שגיאה בעיבוד מסמכים שהועלו: ${error.message}`
          : `Error processing uploaded documents: ${error.message}`,
        error: error.message
      };
    }
  }

async retrievePendingUpload(params, practiceContext, session) {
    try {
      const { uploadId } = params;
      
      if (!uploadId) {
        throw new Error(practiceContext.language === 'he' 
          ? 'מזהה העלאה נדרש' 
          : 'Upload ID is required');
      }
      
      console.log(`📥 Retrieving pending upload: ${uploadId}`);
      console.log(`📥 Practice context:`, { practiceId: practiceContext.practiceId, practiceSubdomain: practiceContext.practiceSubdomain });
      
      // CRITICAL: Only look in practice-specific database, NEVER global (security requirement)
      if (!practiceContext.practiceSubdomain && !practiceContext.practiceId) {
        return {
          success: false,
          error: 'NO_CLINIC_CONTEXT',
          message: practiceContext.language === 'he' 
            ? 'לא ניתן לאחזר העלאות ללא הקשר מרפאה'
            : 'Cannot retrieve uploads without practice context'
        };
      }
      
      // Use subdomain for proper database routing
      const clinicIdentifier = practiceContext.practiceSubdomain || practiceContext.practiceId;
      const clinicContextForQuery = {
        serviceId: this.serviceName,
        operation: 'retrievePendingUpload',
        practiceId: clinicIdentifier,  // Use subdomain/identifier for database routing
        apiKey: this.serviceAuth?.apiKey || this.serviceAuth
      };
      
      console.log(`📥 Querying pendinguploads with:`, { 
        uploadId, 
        practiceId: clinicIdentifier,
        collection: 'pendinguploads',
        fullContext: clinicContextForQuery
      });
      
      // Query only the practice-specific database
      const pendingUploads = await SecureDataAccess.query(
        'pendinguploads', 
        { uploadId }, 
        { limit: 1 }, 
        clinicContextForQuery
      );
      
      console.log(`📥 Query result: Found ${pendingUploads?.length || 0} uploads`);
      if (pendingUploads && pendingUploads.length > 0) {
        console.log(`📥 Found upload:`, { 
          uploadId: pendingUploads[0].uploadId,
          status: pendingUploads[0].status,
          files: pendingUploads[0].files?.length 
        });
      }
      
      if (!pendingUploads || pendingUploads.length === 0) {
        return {
          success: false,
          error: 'UPLOAD_NOT_FOUND',
          message: practiceContext.language === 'he' 
            ? `לא נמצאה העלאה עם מזהה ${uploadId}`
            : `No upload found with ID ${uploadId}`
        };
      }
      
      const pendingUpload = pendingUploads[0];
      
      // Check if upload has expired
      if (pendingUpload.status === 'expired' || 
          (pendingUpload.expiresAt && new Date(pendingUpload.expiresAt) < new Date())) {
        return {
          success: false,
          error: 'UPLOAD_EXPIRED',
          message: practiceContext.language === 'he' 
            ? 'ההעלאה פגה תוקף. אנא העלה את הקבצים שוב'
            : 'Upload has expired. Please upload the files again'
        };
      }
      
      // Return file information without decrypting yet
      return {
        success: true,
        data: {
          uploadId: pendingUpload.uploadId,
          userId: pendingUpload.userId,
          fileCount: pendingUpload.files.length,
          files: pendingUpload.files.map((file, index) => ({
            index,
            originalName: file.originalName,
            mimetype: file.mimetype,
            size: file.size,
            fileType: file.fileType
          })),
          createdAt: pendingUpload.createdAt,
          expiresAt: pendingUpload.expiresAt,
          status: pendingUpload.status
        },
        message: practiceContext.language === 'he' 
          ? `נמצאו ${pendingUpload.files.length} קבצים ממתינים`
          : `Found ${pendingUpload.files.length} pending files`
      };
      
    } catch (error) {
      console.error('Error retrieving pending upload:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בקבלת העלאה ממתינה: ${error.message}`
          : `Error retrieving pending upload: ${error.message}`
      };
    }
  }

async previewPendingDocument(params, practiceContext, session) {
    try {
      const { uploadId, fileIndex = 0 } = params;

      if (!uploadId) {
        throw new Error(practiceContext.language === 'he'
          ? 'מזהה העלאה נדרש'
          : 'Upload ID is required');
      }

      console.log(`🔍 Previewing pending document: ${uploadId}, file index: ${fileIndex}`);

      // CRITICAL: Only use practice-specific database, NEVER global (security requirement)
      if (!practiceContext.practiceSubdomain && !practiceContext.practiceId) {
        return {
          success: false,
          error: 'NO_CLINIC_CONTEXT',
          message: practiceContext.language === 'he'
            ? 'לא ניתן לצפות במסמכים ללא הקשר מרפאה'
            : 'Cannot preview documents without practice context'
        };
      }

      // Use subdomain for proper database routing
      const clinicIdentifier = practiceContext.practiceSubdomain || practiceContext.practiceId;
      const context = {
        serviceId: this.serviceName,
        operation: 'previewPendingDocument',
        practiceId: clinicIdentifier,  // Use subdomain for database routing
        apiKey: this.serviceAuth?.apiKey || this.serviceAuth
      };
      
      const pendingUploads = await SecureDataAccess.query(
        'pendinguploads', 
        { uploadId }, 
        { limit: 1 }, 
        context
      );
      
      if (!pendingUploads || pendingUploads.length === 0) {
        return {
          success: false,
          error: 'UPLOAD_NOT_FOUND',
          message: practiceContext.language === 'he' 
            ? `לא נמצאה העלאה עם מזהה ${uploadId}`
            : `No upload found with ID ${uploadId}`
        };
      }
      
      const pendingUpload = pendingUploads[0];
      
      // Debug: Check what we got from SecureDataAccess
      console.log('📋 Retrieved pendingUpload structure:', {
        hasFiles: !!pendingUpload.files,
        filesLength: pendingUpload.files?.length,
        fileKeys: pendingUpload.files?.[0] ? Object.keys(pendingUpload.files[0]) : 'no files',
        uploadId: pendingUpload.uploadId,
        status: pendingUpload.status
      });
      
      if (!pendingUpload.files || !pendingUpload.files[fileIndex]) {
        return {
          success: false,
          error: 'FILE_NOT_FOUND',
          message: practiceContext.language === 'he' 
            ? `לא נמצא קובץ באינדקס ${fileIndex}`
            : `No file found at index ${fileIndex}`
        };
      }
      
      const file = pendingUpload.files[fileIndex];
      
      // Debug: Check file structure
      console.log('📄 File structure check:', {
        hasEncryptedContent: !!file.encryptedContent,
        encryptedContentType: typeof file.encryptedContent,
        encryptedContentLength: file.encryptedContent?.length,
        hasIv: !!file.contentIv,
        ivLength: file.contentIv?.length,
        hasTag: !!file.contentTag,
        tagLength: file.contentTag?.length,
        fileKeys: Object.keys(file)
      });
      
      // Decrypt the file content using E2E encryption service
      let decryptedContent;
      try {
        // Initialize E2E encryption service if needed
        const e2eEncryptionService = require('./e2eEncryptionService');
        
        // Prepare encrypted package for E2E service
        let encryptedData;
        
        if (file.encryptedPackage) {
          // Already has the package structure
          encryptedData = file.encryptedPackage;
        } else {
          // Convert to package structure
          let dataBuffer;
          
          if (Buffer.isBuffer(file.encryptedContent)) {
            dataBuffer = file.encryptedContent;
          } else if (file.encryptedContent && file.encryptedContent.type === 'Buffer' && Array.isArray(file.encryptedContent.data)) {
            // MongoDB Buffer representation
            dataBuffer = Buffer.from(file.encryptedContent.data);
          } else if (typeof file.encryptedContent === 'string') {
            // Base64 string
            dataBuffer = Buffer.from(file.encryptedContent, 'base64');
          } else {
            throw new Error(`Invalid encryptedContent type: ${typeof file.encryptedContent}`);
          }
          
          encryptedData = {
            data: dataBuffer.toString('base64'),
            iv: file.contentIv,
            tag: file.contentTag,
            algorithm: 'aes-256-gcm'
          };
        }
        
        console.log('🔐 Decrypting with service-level key');

        // Decrypt using SERVICE key (PendingUploads use service key, not user key)
        const decryptedResult = await e2eEncryptionService.decryptWithServiceKey(
          encryptedData
        );
        
        decryptedContent = Buffer.isBuffer(decryptedResult.data) 
          ? decryptedResult.data 
          : Buffer.from(decryptedResult.data, 'base64');
      } catch (decryptError) {
        console.error('Error decrypting file:', decryptError);
        return {
          success: false,
          error: 'DECRYPTION_ERROR',
          message: practiceContext.language === 'he' 
            ? 'שגיאה בפענוח הקובץ'
            : 'Error decrypting file'
        };
      }
      
      // Analyze based on file type
      let analysisResult = {
        fileName: file.originalName,
        fileType: file.fileType,
        mimetype: file.mimetype,
        size: file.size
      };
      
      // Special handling for CSV files
      if (file.mimetype.includes('csv') || file.originalName.toLowerCase().endsWith('.csv')) {
        try {
          const csvContent = decryptedContent.toString('utf-8');
          const lines = csvContent.split('\n').filter(line => line.trim());
          
          if (lines.length > 0) {
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            
            // Check if this looks like a patient list
            const patientListIndicators = ['name', 'firstname', 'lastname', 'id', 'nationalid', 
                                          'email', 'phone', 'שם', 'תעודת זהות', 'טלפון'];
            const isPatientList = patientListIndicators.some(indicator => 
              headers.some(h => h.includes(indicator))
            );
            
            if (isPatientList) {
              analysisResult.documentType = 'patient_list';
              analysisResult.rowCount = lines.length - 1; // Exclude header
              analysisResult.columns = headers;
              analysisResult.analysis = {
                type: 'CSV Patient List',
                confidence: 0.9,
                suggestedAction: 'import_patients',
                message: practiceContext.language === 'he' 
                  ? `זוהתה רשימת מטופלים עם ${lines.length - 1} רשומות. האם לייבא את המטופלים?`
                  : `Detected patient list with ${lines.length - 1} records. Would you like to import the patients?`
              };
            } else {
              // Could be medical data or other CSV
              analysisResult.documentType = 'csv_data';
              analysisResult.rowCount = lines.length - 1;
              analysisResult.columns = headers;
              analysisResult.analysis = {
                type: 'CSV Data',
                confidence: 0.7,
                suggestedAction: 'review_data',
                message: practiceContext.language === 'he' 
                  ? `קובץ CSV עם ${lines.length - 1} רשומות. מה תרצה לעשות עם הנתונים?`
                  : `CSV file with ${lines.length - 1} records. What would you like to do with this data?`
              };
            }
            
            // Include ALL CSV data - no limits for medical data
            // Medical practices can have millions of patients, we need all data
            analysisResult.sampleData = lines.join('\n');
            analysisResult.fullDataIncluded = true;
            
            console.log(`✅ Including all ${lines.length} rows of CSV data (no limits)`);
            
            // For very large files, warn about potential memory usage
            if (lines.length > 10000) {
              console.log(`📊 Large CSV file: ${lines.length} rows (${(csvContent.length / 1024 / 1024).toFixed(2)} MB)`);
            }
          }
        } catch (csvError) {
          console.error('Error analyzing CSV:', csvError);
          analysisResult.analysis = {
            type: 'CSV',
            error: csvError.message
          };
        }
      } else if (file.mimetype.includes('pdf') || file.mimetype.includes('image')) {
        // For PDFs and images - DO NOT analyze here, just return preview
        // The actual batch processing will happen in analyzeUploadedDocuments()
        console.log(`📄 PDF/Image file detected: ${file.originalName} - Will be analyzed in batch processing`);

        analysisResult.documentType = 'medical_document';
        analysisResult.analysis = {
          type: 'Medical Document',
          confidence: 0.95,
          suggestedAction: 'process_documents',
          message: practiceContext.language === 'he'
            ? `מסמך רפואי זוהה. לחץ על "עבד מסמכים" כדי להתחיל בניתוח.`
            : `Medical document detected. Click "Process Documents" to start analysis.`,
          fileInfo: {
            fileName: file.originalName,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadDate: new Date()
          }
        };
      } else {
        // Other file types
        analysisResult.documentType = 'other';
        analysisResult.analysis = {
          type: 'Unknown',
          confidence: 0.5,
          suggestedAction: 'manual_review',
          message: practiceContext.language === 'he' 
            ? 'סוג קובץ לא מזוהה. נדרשת בדיקה ידנית'
            : 'Unknown file type. Manual review required'
        };
      }
      
      // Save the document and medical history if we have medical data
      let extractedData = {};
      let newDoc = null;
      let insertedDoc = null;  // Store the inserted document with ID
      let patientId = params.patientId;  // Declare here so it's always available
      
      if (analysisResult.analysis?.medicalData || analysisResult.analysis?.extractedText) {
        try {
          // Create document record
          const Document = practiceContext.models?.Document;
          if (Document) {
            extractedData = analysisResult.analysis.medicalData || {};
            
            // AI MUST provide the category - no fallbacks
            if (!extractedData.category) {
              console.error(`❌ AI failed to provide document category for ${file.originalName}`);
              throw new Error('Document analysis failed: No category determined by AI. This is a bug in the extraction function.');
            }
            
            let category = extractedData.category;
            
            // Normalize category - handle singular/plural forms
            const categoryNormalization = {
              'discharge_summary': 'discharge_summaries',
              'consultation_note': 'consultation_notes',
              'prescription': 'prescriptions',
              'lab_result': 'lab_results',
              'imaging_report': 'imaging_reports',
              'vaccination_record': 'vaccination_records',
              'allergy': 'allergies',
              'medication': 'medications',
              'appointment': 'appointments',
              'referral': 'referrals',
              'medical_certificate': 'medical_certificates',
              'medical_procedure': 'medical_procedures',
              'emergency_report': 'emergency_reports',
              'emergency_discharge_summary': 'emergency_discharge_summaries',
              'hospital_admission_note': 'hospital_admission_notes',
              'hospital_discharge_summary': 'hospital_discharge_summaries',
              'hospital_transfer_note': 'hospital_transfer_notes',
              'operative_report': 'operative_reports',
              'pre_operative_assessment': 'pre_operative_assessments',
              'post_operative_report': 'post_operative_reports',
              'anesthesia_records': 'anesthesia_records',
              'surgical_consent_form': 'surgical_consent_forms'
            };
            
            // Apply normalization if needed
            if (categoryNormalization[category]) {
              console.log(`📝 Normalizing category: ${category} → ${categoryNormalization[category]}`);
              category = categoryNormalization[category];
            }
            
            // Validate category is one we support
            // Each maps to a specific MongoDB collection for scalability
            // With millions of patients, specific collections = faster queries & better sharding
            const validCategories = [
              // Core medical records (existing)
              'consultation_notes',
              'prescriptions',
              'lab_results',
              'imaging_reports',
              'discharge_summaries',
              'vaccination_records',
              'allergies',
              'medications',
              'appointments',
              'referrals',
              'medical_certificates',
              'medical_procedures',
              
              // Emergency & Hospital
              'emergency_reports',
              'emergency_discharge_summaries',
              'hospital_admission_notes',
              'hospital_discharge_summaries',
              'hospital_transfer_notes',
              
              // Surgical/Operative
              'operative_reports',
              'pre_operative_assessments',
              'post_operative_reports',
              'anesthesia_records',
              'surgical_consent_forms',
              
              // Cardiology
              'cardiology_consultations',
              'cardiology_followup_reports',
              'cardiology_admission_notes',
              'ecg_reports',
              'echo_reports',
              'cardiac_catheterization_reports',
              'stress_test_reports',
              
              // Neurology
              'neurology_consultations',
              'neurology_progress_notes',
              'eeg_reports',
              'emg_reports',
              'neuropsychological_assessments',
              
              // Psychiatry
              'psychiatric_evaluations',
              'psychiatric_progress_notes',
              'psychiatric_discharge_summaries',
              'therapy_session_notes',
              'mental_health_assessments',
              
              // Pediatrics
              'pediatric_visits',
              'well_child_examinations',
              'pediatric_growth_charts',
              'developmental_assessments',
              'pediatric_vaccination_records',
              
              // Obstetrics/Gynecology
              'prenatal_visits',
              'labor_delivery_records',
              'postpartum_notes',
              'gynecology_consultations',
              'maternal_fetal_reports',
              'ultrasound_ob_reports',
              
              // Oncology
              'oncology_consultations',
              'oncology_treatment_plans',
              'chemotherapy_records',
              'radiation_therapy_records',
              'tumor_board_notes',
              'oncology_followup_reports',
              
              // Endocrinology
              'endocrinology_consultations',
              'diabetes_management_notes',
              'thyroid_evaluations',
              'hormone_therapy_records',
              
              // Gastroenterology
              'gastroenterology_consultations',
              'endoscopy_reports',
              'colonoscopy_reports',
              'liver_function_assessments',
              'inflammatory_bowel_reports',
              
              // Pulmonology
              'pulmonology_consultations',
              'pulmonary_function_tests',
              'sleep_study_reports',
              'asthma_management_notes',
              'copd_assessments',
              
              // Nephrology
              'nephrology_consultations',
              'dialysis_records',
              'kidney_function_reports',
              'transplant_evaluations',
              
              // Rheumatology
              'rheumatology_consultations',
              'arthritis_assessments',
              'autoimmune_evaluations',
              
              // Hematology
              'hematology_consultations',
              'blood_disorder_reports',
              'coagulation_studies',
              'bone_marrow_reports',
              
              // Orthopedics
              'orthopedic_consultations',
              'orthopedic_operative_reports',
              'orthopedic_followup_notes',
              'physical_therapy_notes',
              'rehabilitation_progress_notes',
              
              // Ophthalmology
              'ophthalmology_examinations',
              'visual_acuity_reports',
              'retinal_examinations',
              'glaucoma_assessments',
              
              // ENT (Otolaryngology)
              'ent_consultations',
              'audiometry_reports',
              'laryngoscopy_reports',
              
              // Dermatology
              'dermatology_consultations',
              'skin_biopsy_reports',
              'dermatology_procedure_notes',
              
              // Urology
              'urology_consultations',
              'urodynamic_studies',
              'cystoscopy_reports',
              
              // Geriatrics
              'geriatric_assessments',
              'cognitive_evaluations',
              'fall_risk_assessments',
              'polypharmacy_reviews',
              
              // Pathology
              'pathology_reports',
              'biopsy_reports',
              'cytology_reports',
              'autopsy_reports',
              
              // Radiology (text reports, not images)
              'radiology_reports',
              'interventional_radiology_notes',
              'mri_reports',
              'mammography_reports',
              'pet_scan_reports',
              'bone_scan_reports',
              'dexa_scan_reports',
              
              // Progress & Monitoring
              'progress_notes',
              'nursing_notes',
              'therapy_progress_notes',
              'monitoring_reports',
              'vital_signs_logs',
              'icu_flow_sheets',
              'medication_administration_records',
              'dialysis_run_sheets',
              'blood_glucose_logs',
              'intake_output_records',
              'wound_care_documentation',
              'pain_assessment_forms',
              
              // Administrative
              'insurance_forms',
              'disability_evaluations',
              'workers_comp_evaluations',
              'fitness_for_duty_evaluations',
              'school_health_forms',
              'travel_health_certificates',
              'prior_authorization_forms',
              'medical_power_of_attorney',
              'dnr_orders',
              'goals_of_care_discussions',
              'transfer_summaries',
              
              // Specialized Lab Reports
              'genetic_testing_reports',
              'tumor_marker_panels',
              'hormone_panels',
              'autoimmune_panels',
              'toxicology_reports',
              'microbiology_culture_reports',
              'antibiogram_reports',
              'flow_cytometry_reports',
              
              // Dental Records
              'dental_examination_reports',
              'periodontal_charts',
              'orthodontic_treatment_plans',
              'oral_surgery_reports',
              
              // Rehabilitation & Therapy
              'physical_therapy_evaluations',
              'occupational_therapy_reports',
              'speech_therapy_assessments',
              'cardiac_rehabilitation_reports',
              'pulmonary_rehabilitation_notes',
              'cognitive_rehabilitation_reports',
              
              // Clinical Note Formats
              'soap_notes',
              'nursing_assessments',
              'admission_assessments',
              'shift_handoff_notes',
              
              // Emergency Documents
              'ems_run_reports',
              'trauma_flow_sheets',
              'code_blue_summaries',
              'poison_control_reports',
              'rapid_response_summaries',
              
              // Pregnancy & Neonatal
              'obstetric_ultrasound_reports',
              'prenatal_testing_reports',
              'amniocentesis_reports',
              'newborn_screening_results',
              'apgar_scores',
              'nicu_progress_notes',
              
              // Miscellaneous
              'case_summaries',
              'second_opinion_reports',
              'telemedicine_encounters',
              'home_health_notes',
              'hospice_notes',
              'wound_care_notes',
              'pain_management_notes',
              'malnutrition_risk_assessment',
              'social_work_notes',
              'care_coordination_notes',
              'medical_reconciliation_forms',
              'patient_education_records',
              'clinical_trial_documents',
              'research_consent_forms'
            ];
            
            if (!validCategories.includes(category)) {
              console.error(`❌ AI provided invalid category: ${category}`);
              throw new Error(`Invalid document category: ${category}. Valid categories are: ${validCategories.join(', ')}`);
            }
            
            console.log(`📋 Document categorized as: ${category} by AI`)
            
            // Create document in database
            newDoc = {
              fileName: file.originalName,
              originalName: file.originalName,
              fileSize: file.size,
              mimeType: file.mimetype,
              fileType: analysisResult.documentType || category,
              category: category,
              summary: extractedData.summary || extractedData.notes || 'Document analyzed',
              practiceSubdomain: practiceContext.subdomain || practiceContext.practiceSubdomain || (() => {
              console.error('❌ Practice subdomain missing in appointment save! practiceContext:', practiceContext);
              throw new Error('Practice subdomain is required for saving appointments');
            })(),
              uploadDate: new Date(),
              uploadedBy: pendingUpload.userId,
              aiProcessed: true,
              processingStatus: 'completed',
              processedAt: new Date(),
              extractedText: extractedData.summary || analysisResult.analysis.extractedText || '',
              metadata: {
                uploadedThrough: 'batch_analysis',
                uploadId: uploadId,
                fileIndex: fileIndex,
                // Only store essential identifiers
                patientName: extractedData.patientName,
                documentDate: extractedData.documentDate,
                documentType: extractedData.documentType,
                // Store counts for quick reference
                diagnosesCount: extractedData.diagnoses?.length || 0,
                medicationsCount: extractedData.medications?.length || 0,
                analyzedAt: new Date()
              },
              // Store encrypted content if available
              encryptedContent: file.encryptedContent ? 
                (Buffer.isBuffer(file.encryptedContent) ? file.encryptedContent : 
                 file.encryptedContent.type === 'Buffer' && Array.isArray(file.encryptedContent.data) ?
                   Buffer.from(file.encryptedContent.data) :
                 typeof file.encryptedContent === 'string' ?
                   Buffer.from(file.encryptedContent, 'base64') : null) : null,
              contentIv: file.contentIv || file.encryptedPackage?.iv,
              contentTag: file.contentTag || file.encryptedPackage?.tag
            };
            
            // Try to automatically match patient from extracted data if no patientId provided
            // patientId already declared at function level
            
            if (!patientId && extractedData) {
              // Try to find patient from extracted data
              console.log('🔍 Attempting automatic patient matching from document content...');
              
              // Check for patient name in extracted data
              let searchCriteria = null;
              
              // Log extracted data for debugging
              console.log(`📋 [${uploadId}] Extracted patient data:`, {
                patientName: extractedData.patientName,
                patient: extractedData.patient,
                firstName: extractedData.firstName,
                lastName: extractedData.lastName,
                nationalId: extractedData.nationalId,
                patientId: extractedData.patientId
              });
              
              // Try different fields where patient info might be
              if (extractedData.patientName) {
                // Direct patient name field - clean and normalize the name
                const cleanName = extractedData.patientName.trim().replace(/\s+/g, ' ');
                let nameParts;
                let firstNameEscaped, lastNameEscaped;

                // Check if name is in "Last, First Middle" format
                if (cleanName.includes(',')) {
                  const parts = cleanName.split(',').map(p => p.trim());
                  if (parts.length >= 2) {
                    // parts[0] = Last name, parts[1] = "First Middle"
                    const firstAndMiddle = parts[1].split(' ').filter(p => p.length > 0);
                    lastNameEscaped = parts[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    firstNameEscaped = firstAndMiddle[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                    searchCriteria = {
                      firstName: { $regex: new RegExp(`^${firstNameEscaped}`, 'i') },
                      lastName: { $regex: new RegExp(`^${lastNameEscaped}`, 'i') }
                    };
                    console.log(`🔍 [${uploadId}] Searching by name (Last, First format): "${cleanName}" -> First: "${firstAndMiddle[0]}", Last: "${parts[0]}"`);
                  }
                } else {
                  // Normal "First Middle Last" format
                  nameParts = cleanName.split(' ').filter(p => p && p.length > 1);

                  if (nameParts.length >= 2) {
                    // Use case-insensitive regex for better matching
                    // Escape special regex characters
                    firstNameEscaped = nameParts[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    lastNameEscaped = nameParts[nameParts.length - 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                    searchCriteria = {
                      firstName: { $regex: new RegExp(`^${firstNameEscaped}`, 'i') },
                      lastName: { $regex: new RegExp(`^${lastNameEscaped}`, 'i') }
                    };
                    console.log(`🔍 [${uploadId}] Searching by name: "${cleanName}" -> First: "${nameParts[0]}", Last: "${nameParts[nameParts.length - 1]}"`);
                  } else if (nameParts.length === 1) {
                    // Single name - search in both fields
                    const nameEscaped = nameParts[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    searchCriteria = {
                      $or: [
                        { firstName: { $regex: new RegExp(`^${nameEscaped}`, 'i') } },
                        { lastName: { $regex: new RegExp(`^${nameEscaped}`, 'i') } }
                      ]
                    };
                    console.log(`🔍 [${uploadId}] Searching by single name part: "${nameParts[0]}"`);
                  }
                }
              } else if (extractedData.patient) {
                // Patient object with name
                if (typeof extractedData.patient === 'string') {
                  const nameParts = extractedData.patient.split(' ').filter(p => p);
                  if (nameParts.length >= 2) {
                    searchCriteria = {
                      firstName: { $regex: new RegExp(`^${nameParts[0]}`, 'i') },
                      lastName: { $regex: new RegExp(`^${nameParts[nameParts.length - 1]}`, 'i') }
                    };
                    console.log(`🔍 Searching by patient field: ${extractedData.patient}`);
                  }
                } else if (extractedData.patient.name) {
                  const nameParts = extractedData.patient.name.split(' ').filter(p => p);
                  if (nameParts.length >= 2) {
                    searchCriteria = {
                      firstName: nameParts[0],
                      lastName: nameParts[nameParts.length - 1]
                    };
                    console.log(`🔍 Searching by patient.name: ${extractedData.patient.name}`);
                  }
                }
              } else if (extractedData.firstName && extractedData.lastName) {
                // Separate first and last name fields
                searchCriteria = {
                  firstName: extractedData.firstName,
                  lastName: extractedData.lastName
                };
                console.log(`🔍 Searching by firstName/lastName: ${extractedData.firstName} ${extractedData.lastName}`);
              }
              
              // Also check for national ID or MRN
              if (!searchCriteria && extractedData.nationalId) {
                searchCriteria = { nationalId: extractedData.nationalId };
                console.log(`🔍 Searching by nationalId: ${extractedData.nationalId}`);
              } else if (!searchCriteria && extractedData.mrn) {
                searchCriteria = { mrn: extractedData.mrn };
                console.log(`🔍 Searching by MRN: ${extractedData.mrn}`);
              } else if (!searchCriteria && extractedData.patientId) {
                searchCriteria = { nationalId: extractedData.patientId };
                console.log(`🔍 Searching by patientId as nationalId: ${extractedData.patientId}`);
              }
              
              // Search for patient if we have criteria
              if (searchCriteria) {
                try {
                  const matchedPatients = await SecureDataAccess.query('patients',
                    searchCriteria,
                    {
                      limit: 5,
                      projection: {
                        _id: 1,
                        firstName: 1,
                        lastName: 1,
                        nationalId: 1
                      }
                    },
                    context
                  );
                  
                  if (matchedPatients && matchedPatients.length === 1) {
                    // Exact match found
                    patientId = matchedPatients[0]._id;
                    console.log(`✅ [${uploadId}] Automatically matched to patient: ${matchedPatients[0].firstName} ${matchedPatients[0].lastName} (DB ID: ${patientId})`);
                  } else if (matchedPatients && matchedPatients.length > 1) {
                    // Multiple matches - use the first one but warn
                    console.log(`⚠️ [${uploadId}] Found ${matchedPatients.length} potential patient matches:`);
                    matchedPatients.forEach(p => {
                      console.log(`  - ${p.firstName} ${p.lastName} (National ID: ${p.nationalId || 'No ID'}, DB ID: ${p._id})`);
                    });
                    // Use the first match as default
                    patientId = matchedPatients[0]._id;
                    console.log(`📌 [${uploadId}] Multiple matches found - using first match: ${matchedPatients[0].firstName} ${matchedPatients[0].lastName} (DB ID: ${patientId})`);
                    console.log(`⚠️ [${uploadId}] Consider merging duplicate patient records`);
                  } else {
                    console.log(`❌ [${uploadId}] No matching patient found in database for criteria:`, searchCriteria);
                  }
                } catch (searchError) {
                  console.error('Error searching for patient:', searchError);
                }
              } else {
                console.log(`⚠️ [${uploadId}] No patient identifying information found in extracted data`);
                console.log(`📄 [${uploadId}] Document will be saved without patient association - manual assignment needed`);
              }
            }
            
            // If we have a patientId (provided or matched), assign to patient
            if (patientId) {
              newDoc.patientId = patientId;
            }
            
            // Insert document metadata first (without the large content)
            const documentStorageService = require('./documentStorageService');
            
            // Store the encrypted content in chunks
            if (newDoc.encryptedContent) {
              const contentBuffer = newDoc.encryptedContent;
              const iv = newDoc.contentIv;
              const tag = newDoc.contentTag;
              
              // Clear the content from document before saving
              newDoc.encryptedContent = undefined;
              newDoc.contentStored = 'chunked';
              
              // Save document metadata
              insertedDoc = await SecureDataAccess.insert('documents', newDoc, context);
              console.log(`📄 Document metadata saved: ${file.originalName} with ID: ${insertedDoc._id}`);
              
              // Store content in chunks
              await documentStorageService.storeDocumentContent({
                documentId: insertedDoc._id,
                content: contentBuffer,
                iv: iv,
                tag: tag
              }, context);
              console.log(`📦 Document content stored in chunks for: ${file.originalName}`);
            } else {
              // No content to store
              insertedDoc = await SecureDataAccess.insert('documents', newDoc, context);
              console.log(`📄 Document saved: ${file.originalName} with ID: ${insertedDoc._id}`);
            }
            
            // Update analysis result to include saved document ID
            analysisResult.documentId = insertedDoc._id;
            analysisResult.saved = true;
            
            // Now that document is saved with ID, update patient medical history
            if (patientId && insertedDoc && insertedDoc._id) {
              
              // Save medical history to patient
              const patients = await SecureDataAccess.query('patients', 
                { _id: typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/) ? new ObjectId(patientId) : patientId }, 
                { limit: 1 }, 
                context
              );
              
              if (patients && patients.length > 0) {
                const patient = patients[0];
                
                // Initialize medical history if needed
                if (!patient.medicalHistory) {
                  patient.medicalHistory = [];
                }
                
                // Create medical history entry
                const historyEntry = {
                  date: new Date(),
                  category: category,
                  documentId: insertedDoc._id,  // Now this is safe to access
                  documentName: file.originalName,
                  aiGenerated: true,
                  aiProcessed: true,
                  source: 'document_analysis',
                  extractedData: extractedData,
                  notes: extractedData.summary || extractedData.notes || 'Document analyzed',
                  diagnosis: Array.isArray(extractedData.diagnoses) ? extractedData.diagnoses.join(', ') : (extractedData.diagnosis || ''),
                  treatment: typeof extractedData.recommendations === 'string' ? extractedData.recommendations : (extractedData.treatment || '')
                };
                
                // Add category-specific fields
                if (category === 'prescriptions' && extractedData.medications) {
                  historyEntry.medications = extractedData.medications;
                }
                if (category === 'lab_results' && extractedData.testResults) {
                  historyEntry.testType = 'Laboratory Tests';
                  historyEntry.results = extractedData.testResults;
                }
                if (category === 'imaging_reports') {
                  historyEntry.imagingType = extractedData.imagingType;
                  historyEntry.findings = extractedData.findings;
                  historyEntry.impression = Array.isArray(extractedData.diagnoses) ? extractedData.diagnoses.join('; ') : (extractedData.impression || '');
                }
                
                // Use medical data service to store in appropriate collection
                const serviceProxyManager = require('./serviceProxyManager');
                          historyEntry.patientId = patientId;
                historyEntry.documentId = insertedDoc?._id;
                
                await this.medicalDataService.storeMedicalData(
                  historyEntry.category,
                  historyEntry,
                  context
                );
                
                console.log(`📝 Medical history added to ${historyEntry.category} collection for patient ${patientId}`);
                
                // Store medications in medications collection
                if (extractedData.medications && extractedData.medications.length > 0) {
                  for (const med of extractedData.medications) {
                    const medicationData = {
                      patientId: patientId,
                      documentId: insertedDoc?._id,
                      name: typeof med === 'string' ? med : med.name,
                      dosage: med.dosage || '',
                      frequency: med.frequency || '',
                      route: med.route || 'Oral',
                      startDate: extractedData.documentDate || new Date(),
                      prescribedBy: extractedData.provider || 'Unknown',
                      active: true,
                      source: 'document_extraction'
                    };
                    
                    await this.medicalDataService.storeMedicalData(
                      'medications',
                      medicationData,
                      context
                    );
                  }
                  
                  console.log(`💊 Stored ${extractedData.medications.length} medications for patient ${patientId}`);
                }
                
                // Store diagnoses in diagnoses collection
                if (extractedData.diagnoses && extractedData.diagnoses.length > 0) {
                  for (const diagnosis of extractedData.diagnoses) {
                    const diagnosisData = {
                      patientId: patientId,
                      documentId: insertedDoc?._id,
                      diagnosis: typeof diagnosis === 'string' ? diagnosis : diagnosis.name,
                      date: extractedData.date || new Date(),
                      provider: extractedData.doctorName || extractedData.provider || 'Unknown',
                      icdCode: diagnosis.icdCode || null,
                      severity: diagnosis.severity || 'moderate',
                      status: 'active',
                      source: 'document_extraction'
                    };
                    
                    await this.medicalDataService.storeMedicalData(
                      'diagnoses',
                      diagnosisData,
                      context
                    );
                  }
                  console.log(`🏥 Stored ${extractedData.diagnoses.length} diagnoses for patient ${patientId}`);
                }
                
                // Store test results in lab_results collection
                if (extractedData.testResults && extractedData.testResults.length > 0) {
                  for (const test of extractedData.testResults) {
                    const testData = {
                      patientId: patientId,
                      documentId: insertedDoc?._id,
                      testName: typeof test === 'string' ? test : test.name,
                      result: typeof test === 'string' ? test : test.value,
                      date: extractedData.date || new Date(),
                      provider: extractedData.doctorName || 'Unknown',
                      category: 'laboratory',
                      source: 'document_extraction'
                    };
                    
                    await this.medicalDataService.storeMedicalData(
                      'lab_results',
                      testData,
                      context
                    );
                  }
                  console.log(`🧪 Stored ${extractedData.testResults.length} lab results for patient ${patientId}`);
                }
                
                // Store vital signs
                if (extractedData.vitalSigns) {
                  const vitalSignsData = {
                    patientId: patientId,
                    documentId: insertedDoc?._id,
                    date: extractedData.date || new Date(),
                    bloodPressure: extractedData.vitalSigns.bloodPressure,
                    heartRate: extractedData.vitalSigns.heartRate,
                    temperature: extractedData.vitalSigns.temperature,
                    respiratoryRate: extractedData.vitalSigns.respiratoryRate,
                    oxygenSaturation: extractedData.vitalSigns.oxygenSaturation,
                    weight: extractedData.vitalSigns.weight,
                    height: extractedData.vitalSigns.height,
                    bmi: extractedData.vitalSigns.bmi,
                    source: 'document_extraction'
                  };
                  
                  await this.medicalDataService.storeMedicalData(
                    'vital_signs',
                    vitalSignsData,
                    context
                  );
                  console.log(`📊 Stored vital signs for patient ${patientId}`);
                }
                
                // Store abnormal results
                if (extractedData.abnormalResults && extractedData.abnormalResults.length > 0) {
                  for (const abnormal of extractedData.abnormalResults) {
                    const abnormalData = {
                      patientId: patientId,
                      documentId: insertedDoc?._id,
                      finding: typeof abnormal === 'string' ? abnormal : abnormal.finding,
                      date: extractedData.date || new Date(),
                      severity: 'high', // Abnormal results are typically high severity
                      requiresAction: true,
                      source: 'document_extraction'
                    };
                    
                    await this.medicalDataService.storeMedicalData(
                      'abnormal_results',
                      abnormalData,
                      context
                    );
                  }
                  console.log(`⚠️ Stored ${extractedData.abnormalResults.length} abnormal results for patient ${patientId}`);
                }
                
                // Store recommendations
                if (extractedData.recommendations && extractedData.recommendations.length > 0) {
                  for (const recommendation of extractedData.recommendations) {
                    const recommendationData = {
                      patientId: patientId,
                      documentId: insertedDoc?._id,
                      recommendation: typeof recommendation === 'string' ? recommendation : recommendation.text,
                      date: extractedData.date || new Date(),
                      provider: extractedData.doctorName || 'Unknown',
                      priority: recommendation.priority || 'medium',
                      status: 'pending',
                      source: 'document_extraction'
                    };
                    
                    await this.medicalDataService.storeMedicalData(
                      'recommendations',
                      recommendationData,
                      context
                    );
                  }
                  console.log(`📋 Stored ${extractedData.recommendations.length} recommendations for patient ${patientId}`);
                }
                
                // Store follow-up appointments
                if (extractedData.followUp) {
                  const followUpData = {
                    patientId: patientId,
                    documentId: insertedDoc?._id,
                    followUpInstructions: extractedData.followUp,
                    date: extractedData.date || new Date(),
                    provider: extractedData.doctorName || 'Unknown',
                    source: 'document_extraction'
                  };
                  
                  await this.medicalDataService.storeMedicalData(
                    'follow_up_appointments',
                    followUpData,
                    context
                  );
                  console.log(`📅 Stored follow-up instructions for patient ${patientId}`);
                }
                
                // Store treatment plan if present
                if (extractedData.treatmentPlan) {
                  await this.medicalDataService.storeMedicalData('treatment_plans', {
                    patientId: documentPatientId,
                    documentId: insertedDoc._id,
                    date: extractedData.date || new Date(),
                    ...extractedData.treatmentPlan,
                    source: 'batch_document_extraction'
                  }, context);
                  console.log(`📋 Stored treatment plan`);
                }

                // Store medication safety if present
                if (extractedData.medicationSafety) {
                  await this.medicalDataService.storeMedicalData('medication_safety', {
                    patientId: documentPatientId,
                    documentId: insertedDoc._id,
                    date: extractedData.date || new Date(),
                    ...extractedData.medicationSafety,
                    source: 'batch_document_extraction'
                  }, context);
                  console.log(`⚠️ Stored medication safety warnings`);
                }

                // Store social work if present
                if (extractedData.socialWork) {
                  await this.medicalDataService.storeMedicalData('social_work', {
                    patientId: documentPatientId,
                    documentId: insertedDoc._id,
                    date: extractedData.date || new Date(),
                    ...extractedData.socialWork,
                    source: 'batch_document_extraction'
                  }, context);
                  console.log(`🤝 Stored social work interventions`);
                }

                // Store red flags / warnings
                if (extractedData.redFlags && extractedData.redFlags.length > 0) {
                  for (const redFlag of extractedData.redFlags) {
                    const redFlagData = {
                      patientId: patientId,
                      documentId: insertedDoc?._id,
                      warning: typeof redFlag === 'string' ? redFlag : redFlag.warning,
                      date: extractedData.date || new Date(),
                      severity: 'critical',
                      active: true,
                      source: 'document_extraction'
                    };
                    
                    await this.medicalDataService.storeMedicalData(
                      'medical_alerts',
                      redFlagData,
                      context
                    );
                  }
                  console.log(`🚨 Stored ${extractedData.redFlags.length} medical alerts for patient ${patientId}`);
                }
              }
            }  // End of patientId check
          }  // End of try block
        } catch (saveError) {
          console.error('Error saving document:', saveError);
          // Continue - analysis was successful even if save failed
          analysisResult.saveError = saveError.message;
        }
      }
      
      // Mark pending upload file as processed
      if (pendingUpload.files[fileIndex]) {
        pendingUpload.files[fileIndex].processed = true;
        pendingUpload.files[fileIndex].processedAt = new Date();
        
        // Check if all files are processed
        const allProcessed = pendingUpload.files.every(f => f.processed);
        if (allProcessed) {
          pendingUpload.status = 'completed';
          pendingUpload.completedAt = new Date();
        }
        
        // Update pending upload
        await SecureDataAccess.update('pendinguploads', 
          { _id: pendingUpload._id }, 
          pendingUpload, 
          context
        );
      }
      
      return {
        success: true,
        data: {
          ...analysisResult,
          // Make extractedData easily accessible at the top level
          extractedData: analysisResult.analysis?.medicalData || extractedData || {},
          documentId: insertedDoc?._id,
          documentName: file.originalName,
          patientId: patientId || null,
          patientName: extractedData?.patientName
        },
        message: practiceContext.language === 'he' 
          ? `הקובץ "${file.originalName}" נותח ונשמר בהצלחה`
          : `File "${file.originalName}" analyzed and saved successfully`
      };
      
    } catch (error) {
      console.error('Error analyzing pending document:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בניתוח המסמך: ${error.message}`
          : `Error analyzing document: ${error.message}`
      };
    }
  }

async getDocuments(params, practiceContext, session) {
    try {
      // Extract patientId separately to check context
      let { patientId, ...queryOptions } = params;
      
      // Check context if no patientId provided
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
      }
      
      // Validate patient ID
      if (!patientId) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה' 
          : 'Patient ID required. Please search for a patient first');
      }
      
      // Build query parameters
      const queryParams = { 
        limit: params.limit || 20,
        sort: params.sort || 'desc'
      };
      
      // Add filters
      if (params.documentType) queryParams.type = params.documentType;
      if (params.dateFrom) queryParams.dateFrom = params.dateFrom;
      if (params.dateTo) queryParams.dateTo = params.dateTo;
      if (params.category) queryParams.category = params.category;
      if (params.status) queryParams.status = params.status;
      
      const response = await this.callAPI(
        `/documents/patient/${patientId}`,
        'GET',
        queryParams,
        practiceContext
      );
      
      if (!response.data || response.data.length === 0) {
        return {
          success: true,
          data: [],
          count: 0,
          message: practiceContext.language === 'he' 
            ? 'לא נמצאו מסמכים'
            : 'No documents found'
        };
      }
      
      // Enhanced document processing
      const documents = response.data.map(doc => ({
        id: doc._id || doc.id,
        name: doc.originalName || doc.name || doc.fileName,
        originalName: doc.originalName || doc.name || doc.fileName,
        type: doc.fileType || doc.type || 'unknown',
        category: doc.organizedFolder || doc.category || 'general',
        date: doc.uploadDate || doc.date || doc.metadata?.uploadDate || doc.createdAt,
        uploadedAt: doc.uploadDate || doc.uploadedAt || doc.metadata?.uploadDate,
        size: doc.fileSize || doc.size || doc.metadata?.size || 0,
        sizeFormatted: this.formatFileSize(doc.fileSize || doc.size || 0),
        status: doc.status || 'active',
        uploadedBy: doc.uploadedBy || doc.metadata?.uploadedBy,
        description: doc.description,
        tags: doc.tags || [],
        isConfidential: doc.isConfidential || false,
        mimeType: doc.mimeType || doc.fileType,
        version: doc.version || 1,
        formattedDate: new Date(doc.uploadDate || doc.date || doc.uploadedAt || Date.now()).toLocaleDateString(
          practiceContext.language === 'he' ? 'he-IL' : 'en-US'
        ),
        analysisResults: doc.analysisResults,
        aiClassification: doc.aiClassification,
        organizedFolder: doc.organizedFolder,
        fileType: doc.fileType
      }));
      
      // Generate summary
      const summary = this.generateDocumentSummary(documents, practiceContext);
      
      return {
        success: true,
        data: documents,
        summary: summary,
        count: documents.length,
        message: this.generateDocumentMessage(documents, practiceContext),
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error getting documents:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בטעינת המסמכים: ${error.message}`
          : `Error loading documents: ${error.message}`
      };
    }
  }

async searchDocuments(params, practiceContext, session) {
    try {
      // Extract patientId and check context
      let { patientId, ...searchOptions } = params;
      
      // Check context if no patientId provided
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
      }
      
      // Validate search query
      if (!params.query || params.query.trim().length === 0) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרשת מילת חיפוש' 
          : 'Search query is required');
      }
      
      // DATABASE OPERATION: Refactored from callAPI to SecureDataAccess
      const searchDocumentsContext = {
        serviceId: this.serviceName,
        operation: 'search_documents',
        practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
        apiKey: this.serviceAuth?.apiKey || this.serviceAuth
      };

      // Build MongoDB search filter
      const filter = {
        $or: [
          { name: { $regex: params.query.trim(), $options: 'i' } },
          { type: { $regex: params.query.trim(), $options: 'i' } },
          { category: { $regex: params.query.trim(), $options: 'i' } },
          { 'metadata.description': { $regex: params.query.trim(), $options: 'i' } }
        ]
      };

      if (patientId) {
        filter.patientId = patientId;
      }
      if (params.documentType) {
        filter.type = params.documentType;
      }
      if (params.category) {
        filter.category = params.category;
      }
      if (params.dateFrom || params.dateTo) {
        filter.uploadedAt = {};
        if (params.dateFrom) filter.uploadedAt.$gte = new Date(params.dateFrom);
        if (params.dateTo) filter.uploadedAt.$lte = new Date(params.dateTo);
      }

      const options = {
        limit: params.limit || 20,
        skip: params.offset || 0,
        sort: params.sortBy === 'date' ? { uploadedAt: -1 } : { uploadedAt: -1 }
      };

      const documents = await SecureDataAccess.query(
        'documents',
        filter,
        options,
        searchDocumentsContext
      );

      if (!documents || documents.length === 0) {
        return {
          success: true,
          data: {
            query: params.query,
            results: [],
            totalMatches: 0,
            searchTime: 0
          },
          message: practiceContext.language === 'he'
            ? 'לא נמצאו תוצאות חיפוש'
            : 'No search results found'
        };
      }

      // Process search results
      const results = documents.map(result => ({
        documentId: result.documentId,
        name: result.name,
        type: result.type,
        category: result.category,
        patientId: result.patientId,
        date: result.date,
        uploadedAt: result.uploadedAt,
        relevanceScore: result.relevanceScore || 0,
        highlights: result.highlights || [],
        excerpt: result.excerpt || '',
        matchedFields: result.matchedFields || [],
        formattedDate: new Date(result.date || result.uploadedAt).toLocaleDateString(
          practiceContext.language === 'he' ? 'he-IL' : 'en-US'
        ),
        summary: this.generateSearchResultSummary(result, params.query, practiceContext)
      }));
      
      // Sort by relevance or date
      if (searchParams.sortBy === 'date') {
        results.sort((a, b) => new Date(b.date || b.uploadedAt) - new Date(a.date || a.uploadedAt));
      } else {
        results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      }
      
      // Generate search insights
      const insights = this.generateSearchInsights(results, params.query, practiceContext);
      
      // Prepare final search results
      const searchResults = {
        query: params.query,
        patientId: patientId,
        searchParams: searchParams,
        results: results,
        totalMatches: response.data.totalMatches || results.length,
        searchTime: response.data.searchTime || 0,
        facets: response.data.facets || this.generateSearchFacets(results),
        insights: insights,
        suggestions: this.generateSearchSuggestions(params.query, results, practiceContext)
      };
      
      return {
        success: true,
        data: searchResults,
        results: results,
        totalMatches: searchResults.totalMatches,
        insights: insights,
        message: this.generateSearchMessage(searchResults, practiceContext),
        summary: {
          query: params.query,
          totalResults: searchResults.totalMatches,
          searchTime: searchResults.searchTime,
          topResultType: results.length > 0 ? results[0].type : null
        }
      };
      
    } catch (error) {
      console.error('Error searching documents:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בחיפוש מסמכים: ${error.message}`
          : `Error searching documents: ${error.message}`
      };
    }
  }

async deleteDocument(params, practiceContext, session) {
    try {
      // Validate required fields
      if (!params.documentId) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש מזהה מסמך' 
          : 'Document ID is required');
      }
      
      // Get document details first to verify ownership and get info
      const documentResponse = await this.callAPI(
        `/documents/${params.documentId}`,
        'GET',
        null,
        practiceContext
      );
      
      if (!documentResponse.data) {
        throw new Error(practiceContext.language === 'he' 
          ? 'מסמך לא נמצא' 
          : 'Document not found');
      }
      
      const document = documentResponse.data;
      
      // Check if document belongs to context patient (optional validation)
      if (session?.currentContext?.patientId && 
          document.patientId && 
          document.patientId !== session.currentContext.patientId) {
        console.log(`⚠️ Document belongs to different patient: ${document.patientId} vs context ${session.currentContext.patientId}`);
      }
      
      // Prepare deletion data
      const deletionData = {
        reason: params.reason || 'Deleted by user request',
        deletedBy: params.deletedBy || practiceContext.userId || 'agent',
        deletedAt: new Date().toISOString(),
        softDelete: params.softDelete !== false, // Default to soft delete
        documentInfo: {
          name: document.name,
          type: document.type,
          patientId: document.patientId
        }
      };
      
      // Perform deletion
      const response = await this.callAPI(
        `/documents/${params.documentId}`,
        'DELETE',
        deletionData,
        practiceContext
      );
      
      return {
        success: true,
        data: response.data,
        documentId: params.documentId,
        documentName: document.name,
        deletionType: deletionData.softDelete ? 'soft' : 'permanent',
        message: practiceContext.language === 'he' 
          ? `המסמך "${document.name}" נמחק בהצלחה`
          : `Document "${document.name}" deleted successfully`,
        summary: {
          documentId: params.documentId,
          documentName: document.name,
          documentType: document.type,
          reason: deletionData.reason,
          deletedAt: deletionData.deletedAt
        }
      };
      
    } catch (error) {
      console.error('Error deleting document:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה במחיקת המסמך: ${error.message}`
          : `Error deleting document: ${error.message}`
      };
    }
  }

async assignDocumentToPatient(params, practiceContext, session) {
    try {
      const isHebrew = practiceContext.language === 'he';
      
      // Validate parameters
      if (!params.documentId && !params.uploadId) {
        return {
          success: false,
          message: isHebrew 
            ? 'נדרש מזהה מסמך או מזהה העלאה'
            : 'Document ID or upload ID is required'
        };
      }
      
      if (!params.patientId && !params.nationalId) {
        return {
          success: false,
          message: isHebrew 
            ? 'נדרש מזהה מטופל או תעודת זהות'
            : 'Patient ID or national ID is required'
        };
      }
      
      // Use analyzeDocument with the patient info
      const analysisParams = {
        documentId: params.documentId || params.uploadId,
        patientId: params.patientId,
        nationalId: params.nationalId,
        analysisType: params.analysisType || 'comprehensive'
      };
      
      const result = await this.analyzeDocument(analysisParams, practiceContext, session);
      
      if (result.success) {
        return {
          success: true,
          message: isHebrew 
            ? `המסמך שויך בהצלחה למטופל ונותח`
            : `Document successfully assigned to patient and analyzed`,
          data: result.data
        };
      }
      
      return result;
      
    } catch (error) {
      console.error('Error in assignDocumentToPatient:', error);
      return {
        success: false,
        message: practiceContext.language === 'he' 
          ? `שגיאה בשיוך מסמך למטופל: ${error.message}`
          : `Error assigning document to patient: ${error.message}`,
        error: error.message
      };
    }
  }

}

module.exports = new DocumentService();
