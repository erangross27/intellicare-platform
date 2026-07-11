// Claude Batch Processing Service
// Uses Anthropic's Batch API for 50% cost savings on bulk document analysis
// https://docs.anthropic.com/en/docs/build-with-claude/batch-processing

const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const crypto = require('crypto');
const secureConfigService = require('../services/secureConfigService');
const serviceAccountManager = require('./serviceAccountManager');

class ClaudeBatchProcessor {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.apiKey = null;
    this.anthropic = null;

    // Store pending batches
    this.pendingBatches = new Map();

    // Store active batches (for tracking batch status)
    this.activeBatches = new Map();

    // Claude Batch Processor initialized
  }

  async initialize() {
    console.log('🔧 [ClaudeBatchProcessor] Initializing...');
    if (this.initialized) {
      console.log('✅ [ClaudeBatchProcessor] Already initialized, skipping');
      return;
    }

    // Get API key from multiple sources
    let apiKey = secureConfigService.get('CLAUDE_API_KEY') || secureConfigService.get('ANTHROPIC_API_KEY');

    // If not in secureConfigService, try from KMS
    if (!apiKey) {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      apiKey = await productionKMS.getInternalKey('ANTHROPIC_API_KEY');
    }

    if (!apiKey) {
      throw new Error('No Claude/Anthropic API key found in secureConfigService or KMS');
    }

    this.apiKey = apiKey;
    this.anthropic = new Anthropic({
      apiKey: apiKey,
    });

    this.serviceToken = await serviceAccountManager.authenticate('claudeBatchProcessor');
    this.initialized = true;
    console.log('✅ [ClaudeBatchProcessor] Authentication successful');

    // RECOVERY: Resume all active batches after server restart
    console.log('🔄 [ClaudeBatchProcessor] Starting batch recovery process...');
    await this.recoverActiveBatches();
    console.log('✅ [ClaudeBatchProcessor] Initialization complete');
  }

  /**
   * Recover active batches on server startup
   * Resumes monitoring for any batches that were in progress when server stopped
   */
  async recoverActiveBatches() {
    try {
      console.log('🔄 Checking for active batches to recover...');

      // CRITICAL: Use serviceProxyManager to get batchStateManager (ensures it's initialized)
      const serviceProxyManager = require('./serviceProxyManager');
      const batchStateManager = serviceProxyManager.get('batchStateManager');

      if (!batchStateManager) {
        console.error('❌ batchStateManager not available - batch recovery skipped');
        return;
      }

      const activeBatches = await batchStateManager.getActiveBatches();

      if (activeBatches.length === 0) {
        console.log('✅ No active batches to recover');
        return;
      }

      console.log(`🔄 Recovering ${activeBatches.length} active batch jobs...`);

      for (const batch of activeBatches) {
        try {
          console.log(`🔄 Resuming monitoring for batch ${batch.batchId} (${batch.documentCount} documents)`);

          // CRITICAL: Add recovered batch to activeBatches Map before monitoring
          // This ensures processBatchResults can find the batch info
          this.activeBatches.set(batch.batchId, {
            batchId: batch.batchId,
            practiceContext: {
              subdomain: batch.practiceSubdomain,
              practiceId: batch.practiceId
            },
            patientId: batch.patientId,
            uploadId: batch.uploadId, // May be null for recovered batches
            files: batch.documents || [],
            startedAt: new Date(batch.createdAt),
            status: 'in_progress'
          });

          // Resume monitoring in background
          setImmediate(() => {
            this.monitorBatchInBackground(
              batch.batchId,
              batch.documents || [],
              {
                patientId: batch.patientId,
                practiceContext: {
                  subdomain: batch.practiceSubdomain,
                  practiceId: batch.practiceId
                },
                sessionId: batch.sessionId,
                uploadId: batch.uploadId,
                recovered: true // Flag to indicate this is a recovery
              }
            ).catch(error => {
              console.error(`❌ Error recovering batch ${batch.batchId}:`, error.message);
            });
          });

          console.log(`✅ Resumed monitoring for batch ${batch.batchId}`);
        } catch (error) {
          console.error(`❌ Failed to recover batch ${batch.batchId}:`, error.message);
        }
      }

      console.log(`✅ Batch recovery complete: ${activeBatches.length} batches resumed`);
    } catch (error) {
      console.error('❌ Error during batch recovery:', error.message);
      // Don't throw - server should continue even if recovery fails
    }
  }
  

  /**
   * TWO-PASS BATCH EXTRACTION (ASYNC with Worker Coordination)
   *
   * Phase 1: Submit batch for collection selection (lightweight descriptors, 50K tokens)
   * Worker: Detects Phase 1 completion → Extracts selected collections → Creates Phase 2
   * Phase 2: Submit batch for extraction with only selected N tools (150K tokens)
   * Worker: Detects Phase 2 completion → Saves medical data
   *
   * Benefits: 57% token savings (471K → 200K), better extraction quality
   *
   * @param {Array} documents - Documents to analyze
   * @param {string} practiceId - Practice ID
   * @param {Object} options - Optional context for chat integration
   * @param {String} options.sessionId - Chat session ID for WebSocket notifications
   * @param {String} options.userId - User ID for message attribution
   * @returns {string} Phase 1 batch ID (worker handles rest)
   */
  async createTwoPassBatch(documents, practiceId, options = {}) {
    console.log('🔄 Starting two-pass batch extraction (async)...');

    // PDF COMPLEXITY DETECTION - Process documents before Phase 1
    const pdfComplexityDetector = require('./pdfComplexityDetector');
    console.log(`🔍 Checking ${documents.length} document(s) for PDF complexity...`);

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const isPDF = (doc.contentType || doc.mimeType || '').includes('pdf') ||
                    (doc.fileName || '').toLowerCase().endsWith('.pdf');

      if (isPDF) {
        try {
          const prepared = await pdfComplexityDetector.prepareDocumentForBatch(
            doc.content,
            doc.fileName || `document_${i}.pdf`
          );

          // Update document with processed content
          doc.content = prepared.content;
          doc.contentType = prepared.contentType;

          if (prepared.wasConverted) {
            console.log(`   ✓ Document ${i + 1}: ${doc.fileName} converted to text`);
            console.log(`     Reason: ${prepared.complexity.reason}`);
          } else {
            console.log(`   ✓ Document ${i + 1}: ${doc.fileName} kept as PDF`);
            console.log(`     Reason: ${prepared.complexity.reason}`);
          }
        } catch (error) {
          console.error(`   ⚠️ Document ${i + 1}: Complexity check failed for ${doc.fileName}:`, error.message);
          console.error(`      Keeping original PDF format`);
        }
      } else {
        console.log(`   ✓ Document ${i + 1}: ${doc.fileName} - Not a PDF, skipping complexity check`);
      }
    }

    const Phase1 = require('./claudeBatchProcessorPhase1');
    const phase1 = new Phase1();

    // Phase 1: Submit batch for collection selection
    console.log('📋 Phase 1: Submitting batch for collection selection...');
    const phase1BatchId = await phase1.selectCollections(documents, practiceId);
    console.log(`✅ Phase 1 batch submitted: ${phase1BatchId}`);

    // Save Phase 1 batch metadata to global collection for stateless coordination
    // This allows worker to track Phase 1 → Phase 2 transition without patient records
    try {
      const SecureDataAccess = require('./secureDataAccess');
      const metadata = {
        batchId: phase1BatchId,
        phase: 1,
        status: 'phase1_pending',
        practiceId: practiceId,
        // CRITICAL: Store sessionId and userId for chat message persistence and WebSocket notifications
        sessionId: options.sessionId || null,
        userId: options.userId || null,
        documentCount: documents.length,
        documents: documents.map(doc => {
          // CRITICAL FIX: Normalize documentId with fallback to _id or id
          // Documents might come with _id (MongoDB ObjectId), id, or documentId
          const normalizedDocId = doc.documentId || doc._id?.toString() || doc.id;

          console.log(`📋 Document entry: fileName="${doc.fileName}", documentId="${normalizedDocId}", hasDocumentId=${!!doc.documentId}, has_id=${!!doc._id}, hasId=${!!doc.id}`);

          return {
            fileName: doc.fileName,
            content: doc.content, // Store content for Phase 2
            contentType: doc.contentType || 'application/pdf', // PDF type for proper formatting
            documentId: normalizedDocId, // CRITICAL: Preserve documentId with fallback
            mimeType: doc.mimeType || doc.contentType // Also preserve mimeType
          };
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Use insert instead of create (SecureDataAccess doesn't have create method)
      // Use claude-batch-processor service account (already exists)
      // Use practiceId: 'global' to access intellicare_practice_global database
      await SecureDataAccess.insert(
        'batch_metadata',
        metadata,
        { serviceId: 'claude-batch-processor', practiceId: 'global' }
      );

      console.log(`✅ Saved Phase 1 metadata to global batch_metadata collection`);

      // CRITICAL: Ensure worker is running when batch is created
      // Worker auto-stops when no batches found (saves CPU)
      // ensureRunning() will start it if stopped
      try {
        const batchResultsWorker = require('./batchResultsWorker');
        await batchResultsWorker.ensureRunning();
      } catch (workerError) {
        console.error('⚠️ Failed to ensure worker is running:', workerError.message);
      }
    } catch (error) {
      console.error('⚠️ Failed to save batch metadata (non-fatal):', error.message);
    }

    console.log(`⏳ Worker will handle: Phase 1 completion → Phase 2 creation → Data save`);

    // Return properly formatted result object
    // Worker will:
    // 1. Poll global batch_metadata for Phase 1 completion
    // 2. Extract selected collections from results
    // 3. Create and submit Phase 2 batch automatically
    // 4. Update metadata with Phase 2 info
    // 5. Detect Phase 2 completion
    // 6. Extract patient ID from administrative_data
    // 7. Save medical data to patient record
    return {
      success: true,
      batchId: phase1BatchId,
      message: 'Phase 1 batch submitted - worker will handle Phase 2',
      phase: 1
    };
  }
  async getApiKey() {
    if (this.apiKey) return this.apiKey;
    
    // Try multiple sources
    let apiKey = secureConfigService.get('CLAUDE_API_KEY') || secureConfigService.get('ANTHROPIC_API_KEY');
    
    if (!apiKey) {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      apiKey = await productionKMS.getInternalKey('ANTHROPIC_API_KEY');
    }
    
    this.apiKey = apiKey;
    return apiKey;
  }
  
  /**
   * Create a batch job for multiple document analyses
   * @param {Array} documents - Array of documents to analyze
   * @param {String} practiceId - Practice identifier for tracking
   * @param {Object} options - Optional context for chat integration
   * @param {String} options.sessionId - Chat session ID for WebSocket notifications and message persistence
   * @param {String} options.userId - User ID for message attribution
   * @returns {Object} Batch job details
   */
  async createDocumentAnalysisBatch(documents, practiceId, options = {}) {
    // Declare documents variable at function scope so it's accessible in catch block
    let processedDocuments = documents;

    try {
      console.log(`📦 Creating batch job for ${documents.length} documents`);

      // ========== DEDUPLICATION CHECK ==========
      const crypto = require('crypto');
      const SecureDataAccess = require('./secureDataAccess');
      const processedDocs = [];
      const skippedDocs = [];

      for (const doc of documents) {
        // Calculate document hash
        const contentHash = crypto
          .createHash('sha256')
          .update(doc.content || '')
          .digest('hex');

        // Check if document already processed
        const existingDoc = await SecureDataAccess.query(
          'documents',
          { contentHash: contentHash },
          { limit: 1 },
          { serviceId: 'claude-batch-processor', operation: 'check-duplicate', practiceId }
        );

        if (existingDoc && existingDoc.length > 0) {
          console.log(`⏭️ Skipping duplicate document: ${doc.fileName} (hash: ${contentHash.substring(0, 8)}...)`);
          skippedDocs.push({
            fileName: doc.fileName,
            hash: contentHash,
            existingId: existingDoc[0]._id
          });
        } else {
          // Add hash to document for future reference
          doc.contentHash = contentHash;
          processedDocs.push(doc);
          console.log(`✅ Processing new document: ${doc.fileName} (hash: ${contentHash.substring(0, 8)}...)`);
        }
      }

      if (skippedDocs.length > 0) {
        console.log(`📊 Deduplication: ${skippedDocs.length} duplicates skipped, ${processedDocs.length} new documents to process`);
      }

      // If all documents are duplicates, return early
      if (processedDocs.length === 0) {
        console.log('✅ All documents already processed, skipping batch creation');
        return {
          success: true,
          message: 'All documents already processed',
          skipped: skippedDocs,
          batchId: null
        };
      }

      // Continue with non-duplicate documents
      processedDocuments = processedDocs;
      console.log(`📝 Document details:`);
      processedDocuments.forEach((doc, i) => {
        console.log(`   ${i + 1}. ${doc.fileName} - Content type: ${typeof doc.content}, Length: ${doc.content?.length || 0}`);
      });

      // Validate all documents before creating batch
      const invalidDocs = processedDocuments.filter(doc => !doc.content || typeof doc.content !== 'string');
      if (invalidDocs.length > 0) {
        console.error(`❌ ${invalidDocs.length} documents have invalid content:`);
        invalidDocs.forEach(doc => {
          console.error(`   - ${doc.fileName}: content type = ${typeof doc.content}`);
        });
        throw new Error(`${invalidDocs.length} documents have invalid content`);
      }

      // ========== TWO-PASS EXTRACTION ==========
      // Instead of uploading ALL 752 tools (471K tokens), use two-pass approach:
      // Phase 1: Select relevant collections (50K tokens)
      // Phase 2: Extract with selected tools only (150K tokens)
      // Total: 200K tokens (57% savings)
      console.log('🔄 Using two-pass batch extraction for token optimization');
      return await this.createTwoPassBatch(processedDocuments, practiceId, options);

      // ========== OLD SINGLE-PASS APPROACH (DISABLED) ==========
      // The code below is kept for reference but no longer executed
      // It would upload ALL 752 tools with every document (471K tokens per document)
      /*
      // Prepare batch requests with error handling for each document
      const batchRequests = [];
      for (let index = 0; index < processedDocuments.length; index++) {
        const doc = processedDocuments[index];
        try {
          const prompt = this.createDocumentAnalysisPrompt(doc);
          batchRequests.push({
            custom_id: `${practiceId}_doc_${index}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            params: {
              model: 'claude-opus-4-6',  // Opus 4.6 - 1M context GA
              max_tokens: 20000,
              temperature: 0.0,  // Set to 0 for maximum consistency and deterministic output
              // Note: Extended thinking not yet supported in Batch API, but Sonnet 4.5 has deep medical knowledge
              // top_p: 0.9,  // Cannot use both temperature and top_p
              // top_k: 40,  // Not needed when temperature is 0
              system: `You are a medical data extraction specialist with 750+ specialized extraction tools.

CRITICAL RULES:
✓ Use ONLY field names defined in each tool's schema
✓ Extract ONLY what is EXPLICITLY WRITTEN in the document
✓ Search the ENTIRE document for each field
✓ Leave fields empty if information doesn't exist
✓ DO NOT infer, assume, or fabricate ANY information
✓ Extract exact wording - preserve original phrasing

TOOL USAGE:
• Call tools MULTIPLE TIMES when multiple instances exist
• Aim to populate >80% of fields in each tool you use
• Use 40-60 tools per document for comprehensive extraction

Extract comprehensively using all available tools.`,
              messages: [
                {
                  role: 'user',
                  content: prompt
                }
              ],
              tools: this.buildAllCollectionTools(),
              tool_choice: { type: 'any' }  // Forces tool use - Opus 4.5 handles multiple tools per response
            }
          });

          const toolCount = batchRequests[batchRequests.length - 1].custom_id ?
            batchRequests[batchRequests.length - 1].params.tools.length : 0;
          console.log(`✅ Prepared batch request for ${doc.fileName} with ${toolCount} tools`);
        } catch (promptError) {
          console.error(`❌ Failed to create prompt for ${doc.fileName}:`, promptError.message);
          throw new Error(`Cannot create batch - document ${doc.fileName} failed validation: ${promptError.message}`);
        }
      }
      
      // Check if any documents are PDFs to add beta header
      const hasPDFs = processedDocuments.some(doc => doc.mimeType === 'application/pdf');

      // Use official Anthropic SDK for better compatibility
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: await this.getApiKey(),
        timeout: 60000, // 60 second timeout for batch creation
        maxRetries: 3
      });

      // All features now GA (March 2026): PDFs, 1M context - no beta headers required

      // Note: params not available here, will emit from analyzeBatchDocuments instead

      console.log('📦 Creating batch with Anthropic SDK...');
      // 🛡️ COST CIRCUIT BREAKER: refuses submission above BATCH_MAX_COST_USD (default $10)
      const { assertBatchCostWithinBudget } = require('./batchCostGuard');
      assertBatchCostWithinBudget(batchRequests, 'Batch analysis');
      const batch = await anthropic.messages.batches.create({
        requests: batchRequests
      });

      const batchId = batch.id;

      // Store batch info for tracking (in-memory)
      this.pendingBatches.set(batchId, {
        practiceId: practiceId,
        documentCount: processedDocuments.length,
        createdAt: new Date(),
        status: 'processing',
        documents: processedDocuments.map(d => ({
          fileName: d.fileName,
          customId: batchRequests[processedDocuments.indexOf(d)].custom_id
        }))
      });

      // PERSIST TO DATABASE (survives server restart)
      const serviceProxyManager = require('./serviceProxyManager');
      const batchStateManager = serviceProxyManager.get('batchStateManager');

      if (batchStateManager) {
        await batchStateManager.registerBatch(batchId, {
          practiceId: practiceId,
          patientId: processedDocuments[0]?.patientId || null,
          documentCount: processedDocuments.length,
          documents: processedDocuments.map(d => ({
            id: d.id || d._id,
            fileName: d.fileName,
            status: 'pending'
          })),
          practiceSubdomain: practiceId,
          estimatedSavings: this.calculateSavings(processedDocuments.length)
        });
      }

      console.log(`✅ Batch created successfully: ${batchId}`);
      console.log(`💰 Estimated savings: $${this.calculateSavings(processedDocuments.length)}`);
      console.log(`🕗 Expected completion: ~1 minute for ${processedDocuments.length} documents`);

      return {
        success: true,
        batchId: batchId,
        processingUrl: batch.processing_status_url || `https://api.anthropic.com/v1/messages/batches/${batchId}`,
        estimatedCompletionTime: '1 hour',
        costSavings: '50%',
        documentCount: processedDocuments.length
      };
      */
      // ========== END OF OLD SINGLE-PASS CODE ==========

    } catch (error) {
      // CREDIT BALANCE RETRY: Wait and retry instead of crashing
      const isCreditError = error.message && error.message.includes('credit balance is too low');
      if (isCreditError) {
        const retryAttempt = (options._creditRetryCount || 0) + 1;
        const MAX_CREDIT_RETRIES = 10;
        const RETRY_DELAY_MS = 60000; // 1 minute between retries

        if (retryAttempt <= MAX_CREDIT_RETRIES) {
          console.log(`💳 Credit balance too low — waiting ${RETRY_DELAY_MS / 1000}s before retry ${retryAttempt}/${MAX_CREDIT_RETRIES}...`);
          console.log(`   Add credits at https://console.anthropic.com/settings/billing`);
          if (global.io) {
            global.io.emit('credit_balance_low', {
              type: 'credit_balance_low',
              message: `💳 Credit balance too low. Waiting 1 minute before retry ${retryAttempt}/${MAX_CREDIT_RETRIES}. Add credits at console.anthropic.com/settings/billing`,
              retryAttempt,
              maxRetries: MAX_CREDIT_RETRIES,
              nextRetryIn: RETRY_DELAY_MS,
              timestamp: new Date()
            });
          }
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          return this.createDocumentAnalysisBatch(documents, practiceId, { ...options, _creditRetryCount: retryAttempt });
        } else {
          console.error(`❌ Credit balance still too low after ${MAX_CREDIT_RETRIES} retries (${MAX_CREDIT_RETRIES} minutes). Giving up.`);
          if (global.io) {
            global.io.emit('credit_balance_low', {
              type: 'credit_balance_failed',
              message: `❌ Credit balance still too low after ${MAX_CREDIT_RETRIES} minutes. Please add credits and re-upload.`,
              timestamp: new Date()
            });
          }
        }
      }

      console.error('❌ Batch creation error:');

      // Enhanced error diagnostics
      const errorDetails = {
        type: error.constructor?.name || typeof error,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        code: error.code,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      };

      console.error('   Error details:', JSON.stringify(errorDetails, null, 2));
      
      // Handle different error structures
      let errorMessage = error.message;
      
      if (!errorMessage && error.response?.data) {
        // Axios error with response data
        errorMessage = error.response.data.error?.message || 
                      error.response.data.message ||
                      JSON.stringify(error.response.data);
      }
      
      if (!errorMessage && error.code) {
        // Network errors (ECONNREFUSED, ETIMEDOUT, etc.)
        errorMessage = `Network error: ${error.code}`;
      }
      
      if (!errorMessage) {
        // Unknown error - stringify the whole thing
        try {
          errorMessage = `Unknown error: ${JSON.stringify(error)}`;
        } catch {
          errorMessage = `Unknown error of type ${typeof error}`;
        }
      }
      
      console.error('   Resolved error message:', errorMessage);
      
      // Re-throw with more context
      const enhancedError = new Error(`Batch creation failed: ${errorMessage}`);
      enhancedError.originalError = error;
      enhancedError.status = error.response?.status;
      throw enhancedError;
    }
  }
  
  /**
   * Check the status of a batch job with retry logic for transient errors
   * @param {String} batchId - The batch ID to check
   * @param {Number} retryCount - Current retry attempt (internal use)
   * @returns {Object} Batch status and results if complete
   */
  async checkBatchStatus(batchId, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [2000, 5000, 10000]; // Exponential backoff: 2s, 5s, 10s

    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: await this.getApiKey(),
        timeout: 30000,
        maxRetries: 3
      });

      // Use SDK retrieve method (recommended by Anthropic docs)
      const batch = await anthropic.messages.batches.retrieve(batchId);

      // Update our tracking
      if (this.pendingBatches.has(batchId)) {
        const batchInfo = this.pendingBatches.get(batchId);
        batchInfo.status = batch.processing_status;

        if (batch.processing_status === 'ended') {
          // Fetch results
          const results = await this.getBatchResults(batchId);
          batchInfo.results = results;

          // Calculate actual cost savings
          const regularCost = this.calculateRegularCost(batchInfo.documentCount);
          const batchCost = regularCost * 0.5; // 50% discount
          batchInfo.savedAmount = regularCost - batchCost;
        }
      }

      return {
        batchId: batchId,
        processing_status: batch.processing_status,  // Fixed: worker expects processing_status, not status
        status: batch.processing_status,  // Keep both for backward compatibility
        progress: `${batch.request_counts?.succeeded || 0}/${batch.request_counts?.total || 0}`,
        createdAt: batch.created_at,
        expiresAt: batch.expires_at,
        request_counts: batch.request_counts  // Fixed: use snake_case for consistency
      };

    } catch (error) {
      // SDK errors have .status directly, axios errors have .response?.status
      const statusCode = error.status || error.response?.status;

      // Handle transient server errors (500, 502, 503, 504) with retry
      if (statusCode >= 500 && statusCode < 600) {
        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAYS[retryCount] || 10000;
          console.warn(`⚠️ Batch status check got ${statusCode} error, retrying in ${delay/1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.checkBatchStatus(batchId, retryCount + 1);
        }
        console.error(`❌ Batch status check failed after ${MAX_RETRIES} retries (${statusCode}): ${error.message}`);
        // Don't throw - return a pending status so worker can retry on next cycle
        return {
          batchId: batchId,
          processing_status: 'pending',  // Treat as still pending so worker retries
          status: 'pending',
          progress: 'unknown',
          error: `API temporarily unavailable (${statusCode})`,
          retryable: true
        };
      }

      // Handle network timeouts, connection issues, and AbortSignal cancellation
      // CanceledError is thrown by AbortSignal.timeout() when the request exceeds the timeout
      const isCanceledError = error.name === 'CanceledError' ||
                              error.code === 'ERR_CANCELED' ||
                              error.message?.includes('canceled') ||
                              error.message?.includes('aborted');

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' ||
          error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' ||
          error.code === 'ECONNRESET' || error.code === 'ERR_NETWORK' ||
          error.code === 'EPIPE' || error.code === 'ERR_SOCKET_DISCONNECTED' ||
          error.message?.includes('timeout') ||
          error.message?.includes('socket disconnected') ||
          error.message?.includes('TLS connection') ||
          error.message?.includes('ECONNRESET') ||
          isCanceledError) {
        const errorType = isCanceledError ? 'Request timeout/canceled' : 'Network error';
        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAYS[retryCount] || 10000;
          console.warn(`🌐 ${errorType} checking batch ${batchId}, retrying in ${delay/1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.checkBatchStatus(batchId, retryCount + 1);
        }
        console.warn(`🌐 ${errorType} checking batch ${batchId} after ${MAX_RETRIES} retries - will retry on next worker cycle`);
        // Don't throw - return pending status so worker can retry on next cycle
        // This prevents the worker from crashing when API is slow/unresponsive
        return {
          batchId: batchId,
          processing_status: 'in_progress',  // Changed from 'pending' to 'in_progress' to indicate batch still exists
          status: 'in_progress',
          progress: 'unknown',
          error: `${errorType}: ${error.message}`,
          retryable: true
        };
      }

      console.error('❌ Batch status check error:', error.message);
      // Don't throw - return pending status so worker retries on next cycle instead of crashing
      return {
        batchId: batchId,
        processing_status: 'in_progress',
        status: 'in_progress',
        progress: 'unknown',
        error: `Unexpected error: ${error.message}`,
        retryable: true
      };
    }
  }
  
  /**
   * Resume monitoring a batch that was previously unreachable
   * This can be called manually or automatically when network is restored
   */
  async resumeBatchMonitoring(batchId, practiceContext) {
    try {
      console.log(`🔄 Attempting to resume monitoring for batch ${batchId}`);

      // Check if batch exists and get its status
      const status = await this.checkBatchStatus(batchId);

      if (status.status === 'ended') {
        console.log(`✅ Batch ${batchId} has completed while offline`);

        // Get results and process them
        const batchResults = await this.getBatchResults(batchId);

        if (batchResults && batchResults.length > 0) {
          // Process the completed results
          await this.processBatchResults(batchId, batchResults, [], {
            practiceContext: practiceContext,
            patientId: null // Will need to be retrieved from batch metadata
          });

          return {
            success: true,
            status: 'completed',
            message: `Batch ${batchId} completed successfully while offline`,
            results: batchResults.length
          };
        }
      } else if (status.status === 'in_progress' || status.status === 'processing') {
        console.log(`⏳ Batch ${batchId} is still processing`);

        // Resume monitoring in background
        setImmediate(() => {
          this.monitorBatchInBackground(batchId, [], { practiceContext }).catch(error => {
            console.error(`Error resuming monitoring for ${batchId}:`, error);
          });
        });

        return {
          success: true,
          status: 'monitoring_resumed',
          message: `Resumed monitoring for batch ${batchId}`,
          progress: status.progress
        };
      } else {
        return {
          success: false,
          status: status.status,
          message: `Batch ${batchId} has status: ${status.status}`
        };
      }
    } catch (error) {
      console.error(`❌ Failed to resume batch ${batchId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get results from a completed batch
   * @param {String} batchId - The batch ID
   * @returns {Array} Array of analysis results
   */
  /**
   * Mark a batch as failed in the database and tracking
   */
  async markBatchAsFailed(batchId, errorMessage, params) {
    try {
      // Update internal tracking
      if (this.pendingBatches.has(batchId)) {
        const batchInfo = this.pendingBatches.get(batchId);
        batchInfo.status = 'failed';
        batchInfo.error = errorMessage;
      }

      if (this.activeBatches.has(batchId)) {
        const batchInfo = this.activeBatches.get(batchId);
        batchInfo.status = 'failed';
        batchInfo.error = errorMessage;
      }

      // Update database if we have practice context
      if (params?.practiceContext) {
        const SecureDataAccess = require('./secureDataAccess');
        const updateData = {
          batchId: batchId,
          status: 'failed',
          error: errorMessage,
          progress: 0,
          updatedAt: new Date()
        };

        await SecureDataAccess.update(
          'batch_progress',
          { batchId: batchId },
          { $set: updateData },
          {
            serviceId: 'claudeBatchProcessor',
            operation: 'mark-batch-failed',
            practiceId: params.practiceContext.practiceId
          }
        );
      }

      console.error(`❌ Batch ${batchId} marked as failed: ${errorMessage}`);
    } catch (error) {
      console.error(`Failed to mark batch as failed in database:`, error);
    }
  }

  async getBatchResults(batchId) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: await this.getApiKey(),
        timeout: 60000,
        maxRetries: 3
      });

      // Use SDK streaming results method (recommended by Anthropic docs)
      const results = [];
      for await (const result of await anthropic.messages.batches.results(batchId)) {
        results.push(result);
      }

      // Process and structure the results
      const processedResults = results.map(result => {
        const customId = result.custom_id;
        const success = result.result?.type === 'succeeded';
        const message = result.result?.message;

        console.log(`📊 Result ${customId}: success=${success}, has message=${!!message}`);

        if (success && message) {
          // Extract tool use results
          const toolUses = message.content.filter(c => c.type === 'tool_use');
          console.log(`🔧 Found ${toolUses.length} tool uses in result`);

          // DIAGNOSTIC: Log stop_reason to debug early termination
          const stopReason = message.stop_reason;
          console.log(`🛑 Stop reason: ${stopReason}`);
          if (stopReason === 'max_tokens') {
            console.warn(`⚠️ WARNING: Response hit max_tokens limit! Claude was cut off.`);
            console.log(`   Output tokens used: ${message.usage?.output_tokens || 'unknown'}`);
            // HARD FAIL: a truncated response means incomplete (or zero) tool input.
            // Returning success here would save partial data or a null analysis downstream.
            return {
              customId: customId,
              success: false,
              error: `Response truncated at max_tokens (${message.usage?.output_tokens || 'unknown'} output tokens) - extraction incomplete, not saved`,
              errorObject: { type: 'max_tokens_truncation', stop_reason: stopReason, usage: message.usage },
              result: result
            };
          }
          if (stopReason === 'end_turn' && toolUses.length < 10) {
            console.warn(`⚠️ WARNING: Claude stopped with end_turn after only ${toolUses.length} tools - may need stronger prompting`);
          }

          // CRITICAL: Preserve raw result for Phase 1 worker
          // Phase 1 uses select_collections tool (not extract_*), so analysis will be null
          // Worker needs result.result.message to call extractSelectedCollections()
          return {
            customId: customId,
            success: true,
            analysis: this.extractAnalysisFromToolUse(toolUses),
            usage: message.usage,
            result: result  // ⭐ PRESERVE RAW RESULT for Phase 1 compatibility
          };
        } else {
          // Log the error for debugging
          const errorObj = result.result?.error || result.error || {};
          const errorMsg = typeof errorObj === 'string' ? errorObj :
                          errorObj.message || JSON.stringify(errorObj, null, 2);
          console.log(`❌ Result not successful for ${customId}:`);
          console.log(`   Error details: ${errorMsg}`);
          console.log(`   Full result type path: result.result?.type=${result.result?.type}`);

          return {
            customId: customId,
            success: false,
            error: errorMsg,
            errorObject: errorObj,  // Preserve full error object
            result: result  // Preserve raw result for debugging
          };
        }
      });

      console.log(`✅ Retrieved ${processedResults.length} results from batch ${batchId}`);
      return processedResults;

    } catch (error) {
      console.error('❌ Error fetching batch results:', error.message);
      throw error;
    }
  }
  
  /**
   * Create a batch job for multiple message processing (general purpose)
   * @param {Array} messages - Array of messages to process
   * @param {Object} options - Batch options
   * @returns {Object} Batch job details
   */
  async createMessageBatch(messages, options = {}) {
    try {
      console.log(`📦 Creating batch job for ${messages.length} messages`);
      
      const batchRequests = messages.map((msg, index) => ({
        custom_id: `msg_${index}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        params: {
          model: options.model || 'claude-opus-4-6',  // Default to Opus 4.6 for batch processing
          max_tokens: options.maxTokens || 20000,  // Allow complete responses
          temperature: options.temperature || 0.3,
          messages: msg.messages || [{ role: 'user', content: msg.content }],
          ...(msg.tools && { tools: msg.tools }),
          ...(msg.tool_choice && { tool_choice: msg.tool_choice })
        }
      }));
      
      // 🛡️ COST CIRCUIT BREAKER: refuses submission above BATCH_MAX_COST_USD (default $10)
      const { assertBatchCostWithinBudget } = require('./batchCostGuard');
      assertBatchCostWithinBudget(batchRequests, 'createMessageBatch');

      const response = await axios.post(
        'https://api.anthropic.com/v1/messages/batches',
        {
          requests: batchRequests
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': await this.getApiKey(),
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      console.log(`✅ Batch created: ${response.data.id}`);
      return response.data;
      
    } catch (error) {
      console.error('❌ Batch creation error:', error.message);
      throw error;
    }
  }
  
  // Helper methods
  

  /**
   * Format medical category list for Claude prompt
   * Returns formatted string with all 49 categories, descriptions, and keywords
   */
  getMedicalCategoryList() {
    const { MEDICAL_DOCUMENT_CATEGORIES } = require('../config/medicalDocumentCategories');

    const categoryList = MEDICAL_DOCUMENT_CATEGORIES.map((cat, index) => {
      const keywords = cat.keywords.join(', ');
      return `${index + 1}. ${cat.name} - ${cat.displayName}
   Specialty: ${cat.specialty}
   Description: ${cat.description}
   Keywords: ${keywords}`;
    }).join('\n\n');

    return categoryList;
  }

  /**
   * Build all 758 collection-specific extraction tools from unified schema
   * Uses claudeBatchProcessorToolUse helper to generate tools
   *
   * @returns {Array} Array of 758 Anthropic tool schemas
   */
  buildAllCollectionTools() {
    const ClaudeBatchProcessorToolUse = require('./claudeBatchProcessorToolUse');
    const unifiedSchemas = require('./unifiedMedicalSchemas');

    const toolUseHelper = new ClaudeBatchProcessorToolUse();

    // Get ALL 757 collections from unified schema (the single source of truth)
    const allCollections = unifiedSchemas.getAllCollections();
    const tools = [];

    console.log(`🔧 Building ${allCollections.length} collection-specific extraction tools from unified schema...`);

    for (const collectionName of allCollections) {
      try {
        const tool = toolUseHelper.buildExtractionTool(collectionName);
        tools.push(tool);
      } catch (error) {
        console.warn(`⚠️ Failed to build tool for ${collectionName}:`, error.message);
      }
    }

    console.log(`✅ Built ${tools.length} extraction tools from unified schema`);
    return tools;
  }

  getDocumentAnalysisTools() {
    // Get medical document categories for AI classification
    const { MEDICAL_DOCUMENT_CATEGORIES } = require('../config/medicalDocumentCategories');
    const specialtyNames = MEDICAL_DOCUMENT_CATEGORIES.map(cat => cat.name);

    // Get all 190 medical collections for granular data extraction
    const medicalCollectionsService = require('./medicalCollectionsService');
    const allCollections = medicalCollectionsService.getAllCollections();

    return {
      name: 'extract_medical_data',
      description: 'Extract complete medical information from document',
      input_schema: {
        type: 'object',
        properties: {
          // ========== UNIVERSAL PATIENT IDENTIFICATION ==========
          patientName: {
            type: 'string',
            description: 'Full patient name (Last, First Middle or First Middle Last)'
          },
          documentSpecialty: {
            type: 'string',
            enum: specialtyNames,
            description: 'CRITICAL: Medical document specialty category. You MUST classify this document into ONE of the 49 predefined medical specialty categories based on the PRIMARY medical specialty and document type. Choose the single best matching category from the list. This is for unified document classification and template routing.'
          },
          category: {
            type: 'string',
            enum: allCollections,
            description: 'Medical document category - must be one of the 190 predefined categories for granular data extraction into specific collections (medications, lab_results, allergies, etc.)'
          },
          patientId: {
            type: 'string',
            description: 'MRN, Medical Record Number, Patient ID'
          },
          dateOfBirth: {
            type: 'string',
            description: 'Patient DOB in YYYY-MM-DD format - ONLY if explicitly stated in document. If only age is given, leave this field empty and use age field instead. NEVER fabricate dates like "1957-01-01" when only birth year is known'
          },
          age: {
            type: 'string',
            description: 'Patient age at time of document'
          },
          gender: {
            type: 'string',
            description: 'Male, Female, Other'
          },
          race: {
            type: 'string',
            description: 'Patient race (e.g., "Caucasian", "African American", "Asian", "Hispanic/Latino")'
          },
          ethnicity: {
            type: 'string',
            description: 'Patient ethnicity (e.g., "Hispanic or Latino", "Not Hispanic or Latino")'
          },
          occupation: {
            type: 'string',
            description: 'Patient occupation or employment status (e.g., "Retired postal worker", "Teacher", "Disabled - not working")'
          },

          // ========== DOCUMENT METADATA ==========
          date: {
            type: 'string',
            description: 'Document/encounter/consultation date in YYYY-MM-DD format'
          },
          visitTime: {
            type: 'string',
            description: 'Time of visit/appointment (e.g., "10:30 AM", "14:30")'
          },
          lastVisitDate: {
            type: 'string',
            description: 'Date of last visit if mentioned (e.g., "last seen 3 months ago" → calculate approximate date or note as "3 months ago")'
          },
          handedness: {
            type: 'string',
            description: 'Patient handedness if documented (e.g., "right-handed", "left-handed")'
          },
          documentType: {
            type: 'string',
            description: 'Specific document type within category'
          },
          visitType: {
            type: 'string',
            description: 'Specific visit type designation for outpatient/well-child visits (e.g., "6-year well-child examination (kindergarten physical)", "12-month well-child check", "routine well-child visit", "sick visit", "follow-up", "annual physical")'
          },
          facility: {
            type: 'string',
            description: 'Hospital/clinic/facility name'
          },
          department: {
            type: 'string',
            description: 'Department or unit'
          },

          // ========== PROVIDERS & REFERRALS ==========
          providers: {
            type: 'object',
            properties: {
              primary: { type: 'string', description: 'Primary/attending physician name' },
              primarySpecialty: { type: 'string', description: 'CRITICAL: Primary/attending physician specialty (e.g., "Allergy/Immunology", "Cardiology", "Internal Medicine")' },
              consulting: { type: 'array', items: { type: 'string' }, description: 'All consulting physicians' },
              consultingSpecialties: { type: 'array', items: { type: 'string' }, description: 'Specialties of consulting physicians in same order' },
              referring: { type: 'string', description: 'Referring physician' },
              referringSpecialty: { type: 'string', description: 'IMPORTANT: Referring/ordering physician specialty (e.g., "Neurology", "Cardiology", "Pulmonology")' },
              referringPhysicianFull: { type: 'string', description: 'IMPORTANT: Complete referring physician information (e.g., "Dr. Mark Anderson, Pulmonology"). Full details with specialty.' },
              admitting: { type: 'string', description: 'Admitting physician' },
              discharging: { type: 'string', description: 'Discharging physician' },
              procedural: { type: 'array', items: { type: 'string' }, description: 'Surgeons, interventionalists' },
              fellows: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Fellow name' },
                    fellowshipSpecialty: { type: 'string', description: 'IMPORTANT: Fellowship specialty (e.g., "Neuroradiology Fellow", "Cardiology Fellow")' },
                    role: { type: 'string', description: 'Role in care (e.g., "reviewed images", "participated in consultation")' }
                  }
                },
                description: 'IMPORTANT: Fellows involved in care with their specific fellowship specialty designation.'
              },
              medicalAssistant: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Medical assistant name' },
                  credentials: { type: 'string', description: 'Credentials (e.g., CMA, RMA, CCMA)' }
                },
                description: 'Medical assistant who participated in care for legal documentation'
              }
            }
          },

          oncologyTeam: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Team member full name' },
                role: { type: 'string', description: 'Role/title (e.g., Oncology Nurse Practitioner, Pharmacist)' },
                credentials: { type: 'string', description: 'Professional credentials (e.g., NP, PharmD, RN, OCN)' },
                specialty: { type: 'string', description: 'Specialty area if applicable' }
              }
            },
            description: 'Complete oncology care team members including NPs, pharmacists, nurse navigators'
          },

          // ========== CONTACT & ADMINISTRATIVE INFORMATION ==========
          contactInformation: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Patient street address' },
              city: { type: 'string' },
              state: { type: 'string' },
              zipCode: { type: 'string' },
              phone: { type: 'string', description: 'Primary phone number' },
              alternatePhone: { type: 'string' },
              email: { type: 'string' },
              emergencyContact: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  relationship: { type: 'string' },
                  phone: { type: 'string' }
                }
              },
              parentGuardianNames: {
                type: 'array',
                items: { type: 'string' },
                description: 'Parent/guardian names for pediatric patients (e.g., ["Jennifer Davis", "Mark Davis"])'
              },
              parentGuardianRelationship: { type: 'string', description: 'Relationship to patient for parent/guardian (e.g., "mother", "father", "grandmother", "legal guardian"). Important for legal and consent documentation.' }
            },
            description: 'Complete patient contact and emergency contact information including parent/guardian names for pediatric cases'
          },

          providerLicense: {
            type: 'string',
            description: 'Provider license number (e.g., TX-MD-78234)'
          },

          providerBoardCertification: {
            type: 'string',
            description: 'Provider board certification (e.g., "Board Certified in Pediatrics", "Board Certified in Endocrinology, Diabetes, and Metabolism", "American Board of Internal Medicine")'
          },

          diabetesEducator: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              credentials: { type: 'string', description: 'RN, CDE, etc.' },
              contact: { type: 'string' }
            },
            description: 'Diabetes educator information'
          },

          urgentCallCriteria: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of situations requiring immediate medical contact'
          },

          dataUploadInstructions: {
            type: 'string',
            description: 'Instructions for uploading data (e.g., "Upload data: Weekly to diabetes portal")'
          },

          twentyFourSevenSupport: {
            type: 'string',
            description: '24/7 support availability information'
          },

          immunizationStatus: {
            type: 'object',
            properties: {
              summary: { type: 'string', description: 'Overall immunization status summary (e.g., "Influenza due, COVID-19 current")' },
              influenza: { type: 'string', description: 'Influenza vaccine status (e.g., "Current", "Due", "Given today")' },
              pneumococcal: { type: 'string', description: 'Pneumococcal vaccine status (e.g., "Scheduled", "Up to date", "Due")' },
              covid19Booster: { type: 'string', description: 'IMPORTANT: COVID-19 booster status (e.g., "up to date", "due", "declined"). Extract from vaccination section.' },
              tdap: { type: 'string', description: 'TDAP vaccine status' },
              zoster: { type: 'string', description: 'Zoster vaccine status' },
              other: { type: 'array', items: { type: 'string' }, description: 'Other vaccination statuses' }
            },
            description: 'IMPORTANT: Current vaccination status for all relevant vaccines. Extract status phrases like "up to date", "due", "scheduled", "given today".'
          },

          // ========== DIABETES-SPECIFIC MONITORING ==========
          pumpDownloadAnalysis: {
            type: 'object',
            properties: {
              bolusesPerDay: { type: 'string', description: 'Average boluses per day' },
              correctionBolusesPerDay: { type: 'string' },
              controlIQActivePercent: { type: 'string', description: 'Percentage of time Control-IQ active' },
              autoModeExits: { type: 'string', description: 'Frequency and reasons for auto-mode exits' },
              missedBoluses: { type: 'string' },
              overrideBehavior: { type: 'string' }
            },
            description: 'Insulin pump usage analytics and patterns'
          },

          footExam: {
            type: 'object',
            properties: {
              ulcers: { type: 'string', description: 'Presence/absence of ulcers' },
              calluses: { type: 'string' },
              deformities: { type: 'string' },
              nailCondition: { type: 'string', description: 'Normal, fungal, ingrown, etc.' },
              skinCondition: { type: 'string', description: 'Intact, dry, cracked, etc.' },
              circulation: { type: 'string', description: 'Pulses, temperature, color' },
              sensation: { type: 'string', description: 'Monofilament test results' },
              footwear: { type: 'string', description: 'Appropriate footwear assessment' }
            },
            description: 'Diabetic foot examination findings'
          },

          // ========== PROVIDER & DOCUMENT INFORMATION ==========
          providerName: {
            type: 'string',
            description: 'Full name of the provider (e.g., "Dr. David Chen, MD, PhD")'
          },

          providerSignature: {
            type: 'string',
            description: 'Provider signature (e.g., "Signature: David Chen, MD, PhD")'
          },

          documentDate: {
            type: 'string',
            description: 'Date document was created (e.g., "09/07/2025")'
          },

          // ========== DIABETES MANAGEMENT DETAILS ==========
          ketoneStripsProvided: {
            type: 'boolean',
            description: 'Whether ketone strips were provided to patient'
          },

          ovulationPredictorKits: {
            type: 'boolean',
            description: 'Whether patient is using ovulation predictor kits'
          },

          sleepModeSettings: {
            type: 'string',
            description: 'Pump sleep mode settings (e.g., "11 PM - 6 AM")'
          },

          preBolusInstructions: {
            type: 'string',
            description: 'Pre-bolus timing instructions (e.g., "15-20 minutes when glucose >110")'
          },

          fifteenFifteenRule: {
            type: 'boolean',
            description: 'Whether 15-15 rule for hypoglycemia was reviewed'
          },

          basalRateChanges: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                timeRange: { type: 'string' },
                oldRate: { type: 'string' },
                newRate: { type: 'string' },
                reason: { type: 'string' },
                trialPeriod: { type: 'string' }
              }
            },
            description: 'Basal rate adjustments with old and new values'
          },

          bolusAdjustments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                mealTime: { type: 'string' },
                oldRatio: { type: 'string' },
                newRatio: { type: 'string' },
                reason: { type: 'string' }
              }
            },
            description: 'Insulin-to-carb ratio adjustments'
          },

          // ========== SUPPORT & RESOURCES ==========
          workplaceAccommodationLetter: {
            type: 'boolean',
            description: 'Whether workplace accommodation letter was provided'
          },

          fmlaDiscussion: {
            type: 'boolean',
            description: 'Whether FMLA options were discussed'
          },

          psychologicalSupportAvailability: {
            type: 'string',
            description: 'Available psychological support resources'
          },

          clarityDataUpload: {
            type: 'string',
            description: 'Data upload platform and frequency (e.g., "weekly to Clarity")'
          },

          mindfulnessAppReferral: {
            type: 'boolean',
            description: 'Whether patient was referred to mindfulness app'
          },

          yogaConsideration: {
            type: 'boolean',
            description: 'Whether yoga was recommended for stress management'
          },

          communicationMethod: {
            type: 'string',
            description: 'Preferred communication method (e.g., "portal for pattern issues")'
          },

          insurancePriorAuthorization: {
            type: 'object',
            properties: {
              submitted: { type: 'boolean' },
              items: { type: 'string' },
              reason: { type: 'string' }
            },
            description: 'Insurance prior authorization details'
          },

          // ========== CONSULTATION DETAILS ==========
          consultationDetails: {
            type: 'object',
            properties: {
              consultationType: { type: 'string', description: 'Initial, follow-up, urgent, routine' },
              referringPhysician: { type: 'string' },
              referringSpecialty: { type: 'string' },
              referralDate: { type: 'string', description: 'Date of referral in YYYY-MM-DD format' },
              reasonForConsult: { type: 'string' },
              consultDate: { type: 'string' },
              consultingPhysician: { type: 'string' },
              consultingSpecialty: { type: 'string' },
              endocrineConsultation: { type: 'string', description: 'Endocrine consultation details (e.g., "Blood glucose control - endocrine consulted")' },
              urgency: { type: 'string', description: 'emergent, urgent, routine' },
              location: { type: 'string', description: 'inpatient, outpatient, ED' },
              signatureTime: { type: 'string', description: 'Exact time of signature (e.g., 16:00 EST)' },
              physicianCredentials: { type: 'string', description: 'Board certifications, fellowships' },
              findings: { type: 'string', description: 'Consultant\'s clinical findings and assessment' },
              recommendations: { type: 'string', description: 'Consultant\'s recommendations and treatment plan' },
              assessment: { type: 'string', description: 'Consultant\'s overall assessment' },
              plan: { type: 'string', description: 'Consultant\'s treatment plan' },
              followUpRecommendations: { type: 'string', description: 'Recommended follow-up actions' }
            }
          },

          // ========== COMPREHENSIVE DIAGNOSES ==========
          diagnoses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                diagnosis: { type: 'string' },
                icdCode: { type: 'string' },
                type: { type: 'string', description: 'primary, secondary, admission, discharge, differential' },
                dateIdentified: { type: 'string', description: 'CRITICAL: ONLY extract if date is explicitly stated. DO NOT fabricate or assume diagnosis dates. Leave EMPTY if not stated.' },
                status: { type: 'string', description: 'active, resolved, chronic, ruled out' },
                stage: { type: 'string', description: 'Disease stage (e.g., "Moderate stage based on structural damage")' },
                severity: { type: 'string', description: 'Severity indicators (e.g., "Center-involved OD > OS", "Vision-threatening, requires treatment")' },
                laterality: { type: 'string', description: 'Laterality differences if applicable (e.g., "Worse OD than OS")' },
                prognosis: { type: 'string', description: 'Prognostic information (e.g., "High risk for progression to proliferative disease")' },
                clinicalSignificance: { type: 'string', description: 'Clinical significance (e.g., "Not visually significant currently")' },
                targetIOp: { type: 'string', description: 'Target IOP for glaucoma (e.g., "<18 mmHg")' },
                riskFactors: { type: 'array', items: { type: 'string' }, description: 'Risk factors contributing to diagnosis (e.g., "Thin CCT increases risk")' }
              }
            },
            description: 'ALL diagnoses with complete details including staging, severity, prognosis, and risk factors'
          },

          differentialDiagnoses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                diagnosis: { type: 'string', description: 'Differential diagnosis name (e.g., "ADEM", "Sarcoidosis", "CNS lymphoma")' },
                likelihood: { type: 'string', description: 'Likelihood assessment (e.g., "unlikely", "possible", "probable", "ruled out")' },
                clinicalReasoning: { type: 'string', description: 'IMPORTANT: Clinical reasoning for inclusion/exclusion (e.g., "unlikely given lesion morphology and adult age", "would expect leptomeningeal enhancement")' }
              }
            },
            description: 'IMPORTANT: Differential diagnoses with clinical reasoning. Critical medical information documenting diagnostic thought process.'
          },

          // ========== COMPREHENSIVE MEDICATIONS ==========
          medications: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                genericName: { type: 'string' },
                dosage: { type: 'string' },
                originalDosage: { type: 'string', description: 'Original dosage before modification (e.g., "40mg once daily" before increasing to "80mg BID")' },
                form: { type: 'string', description: 'ointment, cream, tablet, capsule, solution, injection, etc.' },
                frequency: { type: 'string' },
                usage: { type: 'string', description: 'IMPORTANT: Actual usage frequency if different from prescribed frequency (e.g., "using 2-3x/week" when prescribed PRN, "using 4-5x/week"). Critical for assessing medication adherence and dependence risk.' },
                route: { type: 'string', description: 'oral, IV, IM, SC, topical, inhaled' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                duration: { type: 'string' },
                indication: { type: 'string' },
                prescriber: { type: 'string' },
                quantity: { type: 'string', description: 'Quantity dispensed (e.g., "30 tablets", "60 capsules")' },
                maxDailyDose: { type: 'string', description: 'Maximum daily dose warning (e.g., "avoid >3g daily", "do not exceed 4000mg in 24h")' },
                refills: { type: 'number' },
                prn: { type: 'boolean' },
                taperInstructions: { type: 'string' },
                status: { type: 'string', description: 'active, discontinued, completed, held' }
              }
            },
            description: 'ALL medications with complete prescribing details including safety warnings. CRITICAL: If document states "None", "No medications", "No prescribed medications", or similar, return EMPTY ARRAY []. Do NOT create a record with name="None".'
          },

          medicationRecommendations: {
            type: 'object',
            properties: {
              nitroglycerin: { type: 'string', description: 'PRN nitroglycerin instructions' },
              pcsk9InhibitorConsideration: { type: 'string', description: 'PCSK9 inhibitor conditional recommendations' },
              sglt2InhibitorRecommendation: { type: 'string', description: 'SGLT2 inhibitor for diabetes management' },
              futureConsiderations: {
                type: 'array',
                items: { type: 'string' },
                description: 'Other medication recommendations for future consideration'
              }
            },
            description: 'Medication recommendations and conditional treatment plans'
          },

          doctorsMedicationsRecommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Medication name recommended by doctor' },
                genericName: { type: 'string' },
                dosage: { type: 'string', description: 'Recommended dosage' },
                frequency: { type: 'string', description: 'Recommended frequency' },
                route: { type: 'string', description: 'oral, IV, IM, SC, topical, inhaled' },
                indication: { type: 'string', description: 'Reason for prescription' },
                prescriber: { type: 'string', description: 'Doctor recommending this medication' },
                recommendationDate: { type: 'string', description: 'Date of recommendation' },
                status: { type: 'string', enum: ['recommended', 'pending_patient_decision', 'approved', 'declined'], description: 'Status of recommendation' },
                patientEducation: { type: 'string', description: 'Education provided about this medication' },
                monitoring: { type: 'string', description: 'Required monitoring for this medication' }
              }
            },
            description: 'NEW medications recommended by doctor (not yet started) - distinct from current medications'
          },

          // ========== COMPREHENSIVE LAB RESULTS ==========
          labResults: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string', description: 'hematology, chemistry, microbiology, etc' },
                panel: { type: 'string', description: 'CBC, BMP, CMP, etc' },
                testName: { type: 'string' },
                value: { type: 'string' },
                unit: { type: 'string' },
                referenceRange: { type: 'string', description: 'Normal range if shown in document (e.g., "35-45 mmHg"). Leave empty if not explicitly stated.' },
                flag: { type: 'string', description: 'normal, high, low, critical-high, critical-low' },
                interpretation: { type: 'string', description: 'CRITICAL - REQUIRED FOR EVERY LAB RESULT: Medical interpretation explaining what this result means clinically. For normal results: explain what normal means. For abnormal results: explain the clinical significance, potential causes, and implications. Examples: "Elevated glucose indicates hyperglycemia, suggests poorly controlled diabetes"; "Normal WBC indicates no acute infection"; "High BUN may indicate dehydration or kidney dysfunction"; "Elevated HbA1c >7% indicates suboptimal diabetes control over past 3 months"' },
                timing: { type: 'string', description: 'Timing/context of result (e.g., "Current", "Baseline", "Follow-up")' },
                clinicalSignificance: { type: 'string', description: 'Clinical significance of result (e.g., "thin corneas increases risk for glaucoma")' },
                specimenType: { type: 'string' },
                labDate: { type: 'string', description: 'Lab collection date in YYYY-MM-DD format' },
                collectionDate: { type: 'string' },
                resultDate: { type: 'string' },
                methodology: { type: 'string' },
                deltaFromPrevious: { type: 'string' },

                // ========== TASK 14: BIOMARKER TRENDING ==========
                biomarkerTrend: {
                  type: 'object',
                  properties: {
                    trendDirection: {
                      type: 'string',
                      enum: ['Improving', 'Worsening', 'Stable', 'Fluctuating'],
                      description: 'CRITICAL: Trend direction based on serial values (e.g., "Improving" = creatinine 2.1 → 1.8 → 1.5)'
                    },
                    serialValues: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                          value: { type: 'string', description: 'Biomarker value' },
                          context: { type: 'string', description: 'Clinical context (e.g., "Baseline", "Post-diuresis", "After med change", "Discharge")' }
                        }
                      },
                      description: 'CRITICAL: Serial biomarker values for trending (e.g., creatinine during AKI: 1.0 baseline → 2.5 peak → 1.8 improving)'
                    },
                    percentChange: {
                      type: 'string',
                      description: 'Percent change from baseline (e.g., "+150% from baseline", "-25% from peak")'
                    },
                    clinicalResponse: {
                      type: 'string',
                      description: 'CRITICAL: Clinical response to trending (e.g., "Improving renal function with diuresis", "Rising troponin despite therapy - consider cath lab", "Stable HbA1c at goal")'
                    },
                    targetGoal: {
                      type: 'string',
                      description: 'Target goal for biomarker (e.g., "HbA1c <7%", "Creatinine back to baseline 1.0", "LDL <70 mg/dL", "BNP <100 pg/mL")'
                    },
                    goalAchieved: {
                      type: 'boolean',
                      description: 'CRITICAL: Whether target goal has been achieved'
                    },
                    interventionBasedOnTrend: {
                      type: 'string',
                      description: 'CRITICAL: Intervention made based on trend (e.g., "Increased furosemide dose due to rising BNP", "Continued current therapy due to improving LDL", "Insulin titration due to stable elevated HbA1c")'
                    }
                  },
                  description: 'TASK 14: Biomarker trending for disease monitoring (HbA1c for diabetes, creatinine for AKI, troponin for ACS, BNP for HF, PSA for prostate cancer, CA-125 for ovarian cancer, CEA for colorectal cancer, etc.)'
                }
              }
            },
            description: 'ALL lab results with complete details including timing and clinical significance'
          },

          criticalValues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                testName: { type: 'string', description: 'Name of the critical lab value (e.g., "Potassium", "Glucose", "WBC")' },
                value: { type: 'string', description: 'The critical value' },
                unit: { type: 'string', description: 'Unit of measurement' },
                normalRange: { type: 'string', description: 'Normal reference range' },
                severity: { type: 'string', description: 'Critical level: "critical-high", "critical-low", "life-threatening"' },
                actionTaken: { type: 'string', description: 'Immediate action taken (e.g., "Physician notified immediately", "Repeat test ordered", "Patient called back for urgent evaluation")' },
                timeNotified: { type: 'string', description: 'Time when physician/provider was notified' }
              }
            },
            description: 'CRITICAL lab values that require immediate medical attention. Extract values flagged as "critical", "panic values", or results explicitly stated as requiring immediate notification. Examples: K+ <2.5 or >6.5, Glucose <50 or >500, WBC >30,000, Platelets <20,000, INR >5.0'
          },

          allergies: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                allergen: { type: 'string' },
                reaction: { type: 'string' },
                severity: { type: 'string' },
                management: { type: 'string', description: 'Emergency medication details (e.g., "EpiPen prescribed but not carried regularly")' },
                compliance: { type: 'string', description: 'Patient compliance with carrying emergency medications' }
              }
            },
            description: 'Patient allergies with reactions and management (e.g., Atorvastatin - myalgias, Shellfish - anaphylaxis with EpiPen)'
          },
          // ========== COMPREHENSIVE VITAL SIGNS ==========
          vitalSigns: {
            type: 'object',
            properties: {
              bloodPressure: { type: 'string', description: 'Include systolic/diastolic and position' },
              heartRate: { type: 'string', description: 'Include rhythm (regular/irregular)' },
              temperature: { type: 'string', description: 'Include method (oral/rectal/axillary)' },
              respiratoryRate: { type: 'string' },
              oxygenSaturation: { type: 'string', description: 'Include O2 delivery method if on oxygen' },
              weight: { type: 'string', description: 'Include units (kg/lbs)' },
              height: { type: 'string', description: 'Include units (cm/ft-in)' },
              bmi: { type: 'string' },
              painScore: { type: 'string', description: '0-10 scale' },
              bloodGlucose: { type: 'string', description: 'Include fasting/random status' },
              peakFlow: { type: 'string' },
              headCircumference: { type: 'string', description: 'For pediatrics' },
              normalRanges: { type: 'object', description: 'Include normal ranges if shown in tables' },
              previousVisit: { type: 'object', description: 'Vital signs from previous visit for comparison' }
            },
            description: 'ALL vital signs with measurement details and normal ranges'
          },
          // ========== VITAL SIGNS TABLE (Multiple Readings) ==========
          vitalSignsTable: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                dateTime: { type: 'string', description: 'Date and time of measurement' },
                bloodPressure: { type: 'string' },
                heartRate: { type: 'string' },
                temperature: { type: 'string' },
                respiratoryRate: { type: 'string' },
                oxygenSaturation: { type: 'string' },
                painScore: { type: 'string' },
                bloodGlucose: { type: 'string' },
                notes: { type: 'string' }
              }
            },
            description: 'Table of vital signs over time during hospitalization - Extract ALL readings from document, especially complete 24-hour ICU flow sheets (00:00-23:00). Do not truncate at 12 hours.'
          },
          // ========== ICU FLUID BALANCE ==========
          fluidIntake: {
            type: 'object',
            properties: {
              iv: { type: 'string', description: 'IV fluids volume in mL' },
              enteral: { type: 'string', description: 'Enteral/tube feeds volume in mL' },
              oral: { type: 'string', description: 'Oral intake volume in mL' },
              bloodProducts: { type: 'string', description: 'Blood products volume in mL' },
              other: { type: 'string', description: 'Other intake volume in mL' },
              total: { type: 'string', description: 'Total intake in mL' }
            },
            description: 'Fluid intake breakdown for ICU flow sheets'
          },
          fluidOutput: {
            type: 'object',
            properties: {
              urine: { type: 'string', description: 'Urine output in mL' },
              drains: { type: 'string', description: 'Drain output in mL' },
              emesis: { type: 'string', description: 'Emesis/vomiting in mL' },
              stool: { type: 'string', description: 'Stool output in mL' },
              other: { type: 'string', description: 'Other output in mL' },
              insensibleLoss: { type: 'string', description: 'Insensible water loss (IWL) in mL' },
              total: { type: 'string', description: 'Total output in mL' }
            },
            description: 'Fluid output breakdown for ICU flow sheets'
          },
          // ========== ICU ASSESSMENTS ==========
          camICU: {
            type: 'object',
            properties: {
              result: { type: 'string', description: 'Positive or Negative' },
              score: { type: 'string', description: 'CAM-ICU score if applicable' },
              deliriumPresent: { type: 'boolean', description: 'Whether delirium is present' },
              assessmentTime: { type: 'string', description: 'Time of assessment' },
              notes: { type: 'string', description: 'Additional notes about delirium status' }
            },
            description: 'Confusion Assessment Method for ICU - delirium screening'
          },
          pressureInjury: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                location: { type: 'string', description: 'Body location (sacral, heel, etc.)' },
                stage: { type: 'string', description: 'Stage 1, 2, 3, 4, unstageable, or deep tissue injury' },
                size: { type: 'string', description: 'Dimensions if documented' },
                description: { type: 'string', description: 'Appearance and characteristics' },
                treatment: { type: 'string', description: 'Dressing type, turning schedule, etc.' },
                prevention: { type: 'string', description: 'Prevention measures (heel protectors, repositioning)' }
              }
            },
            description: 'Pressure injury/wound documentation'
          },
          bloodProducts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', description: 'PRBC, FFP, platelets, cryoprecipitate' },
                units: { type: 'string', description: 'Number of units' },
                volume: { type: 'string', description: 'Volume in mL' },
                dateTime: { type: 'string', description: 'Date and time of transfusion' },
                indication: { type: 'string', description: 'Reason for transfusion' },
                reaction: { type: 'string', description: 'Any transfusion reactions' },
                preVitals: { type: 'object', description: 'Vital signs before transfusion' },
                postVitals: { type: 'object', description: 'Vital signs after transfusion' }
              }
            },
            description: 'Blood product administration details'
          },
          // ========== ICU VENTILATOR SETTINGS ==========
          ventilatorSettings: {
            type: 'object',
            properties: {
              mode: { type: 'string', description: 'AC, SIMV, PSV, CPAP, etc.' },
              tidalVolume: {
                type: 'object',
                properties: {
                  value: { type: 'string', description: 'Numeric value' },
                  unit: { type: 'string', description: 'mL or mL/kg' }
                }
              },
              respiratoryRate: {
                type: 'object',
                properties: {
                  set: { type: 'string', description: 'Set rate' },
                  total: { type: 'string', description: 'Total rate including patient breaths' }
                }
              },
              peep: {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                  unit: { type: 'string', description: 'cmH2O' }
                }
              },
              fio2: { type: 'string', description: 'Fraction of inspired oxygen (%)' },
              pressureSupport: {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                  unit: { type: 'string', description: 'cmH2O' }
                }
              },
              peakPressure: {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                  unit: { type: 'string', description: 'cmH2O' }
                }
              },
              plateauPressure: {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                  unit: { type: 'string', description: 'cmH2O' }
                }
              },
              minuteVentilation: {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                  unit: { type: 'string', description: 'L/min' }
                }
              }
            },
            description: 'Mechanical ventilation settings for ICU patients'
          },
          // ========== COMPREHENSIVE PROCEDURES ==========
          procedures: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                code: { type: 'string', description: 'CPT/procedure code' },
                date: { type: 'string', description: 'CRITICAL: ONLY extract if date is explicitly stated. DO NOT fabricate or assume dates. Leave EMPTY if not stated.' },
                time: { type: 'string' },
                duration: { type: 'string' },
                provider: { type: 'string' },
                assistants: { type: 'array', items: { type: 'string' } },
                anesthesia: { type: 'string', description: 'general, regional, local, MAC' },
                approach: { type: 'string', description: 'open, laparoscopic, percutaneous' },
                positioning: { type: 'string', description: 'CRITICAL: Patient positioning for surgery (e.g., "supine", "lateral decubitus", "prone"). ONLY extract if explicitly stated. DO NOT assume or fabricate positioning based on surgery type.' },
                indication: { type: 'string', description: 'Clinical indication for procedure (e.g., "Elevated PTH, hypercalcemia")' },
                findings: { type: 'string', description: 'ALL findings including measurements' },
                technique: { type: 'string', description: 'Detailed technique including radiopharmaceutical, imaging parameters' },
                stressProtocol: {
                  type: 'object',
                  properties: {
                    peakHeartRate: { type: 'string', description: 'Peak HR with MPHR percentage (e.g., "118 bpm (75% MPHR)")' },
                    bloodPressure: { type: 'string', description: 'BP response (e.g., "Rest 138/82, Peak 146/88")' },
                    symptoms: { type: 'string', description: 'Symptoms during stress (e.g., "Mild dyspnea, no chest pain")' },
                    ecgChanges: { type: 'string', description: 'ECG findings during stress (e.g., "No significant ST changes")' }
                  },
                  description: 'Stress test protocol details for cardiac procedures'
                },
                injectionLocation: { type: 'string', description: 'Specific injection site with distance (e.g., "3.5mm from limbus")' },
                medication: { type: 'string', description: 'Medication used in procedure (e.g., "Bevacizumab 1.25mg/0.05mL")' },
                postProcedureIOP: { type: 'string', description: 'Post-procedure intraocular pressure (e.g., "18 mmHg post-injection")' },
                specimens: { type: 'array', items: { type: 'string' } },
                implants: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string' },
                      manufacturer: { type: 'string' },
                      model: { type: 'string' },
                      serialNumber: { type: 'string' },
                      size: { type: 'string' }
                    }
                  }
                },
                bloodLoss: { type: 'string' },
                complications: { type: 'string' },
                outcome: { type: 'string' },
                postOpInstructions: { type: 'string' },
                scheduledFuture: { type: 'boolean', description: 'IMPORTANT: Whether procedure is scheduled for future (not performed today)' },
                status: { type: 'string', description: 'Status (e.g., "completed", "scheduled", "planned"). Use "scheduled" for future procedures like "Pneumococcal vaccine scheduled"' }
              }
            },
            description: 'CRITICAL: ALL procedures with complete operative details. Include: 1) Completed procedures performed today (vaccines given, biologic injections like Dupilumab loading dose), 2) Scheduled future procedures (e.g., "Pneumococcal vaccine scheduled"). Extract biologic medications BOTH as medication changes AND as procedures when administered during visit. IMPORTANT: Do NOT include diagnostic imaging studies here (X-rays, CT scans, MRI, Ultrasounds, Echocardiograms, Nuclear Medicine scans, etc.) - those belong in the imaging field below, even if they appear under "Procedures Performed" section in the document. Only include invasive/therapeutic procedures and non-imaging diagnostic tests (e.g., arterial blood gas, sputum cultures, biopsies, endoscopies).'
          },
          // ========== COMPREHENSIVE IMAGING ==========
          imaging: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                modality: { type: 'string', description: 'CRITICAL: Imaging modality - X-ray, CT, MRI, Ultrasound, Echocardiogram, Echo, PET, Nuclear Medicine, Mammography, DEXA scan, Fluoroscopy, Angiography, etc. IMPORTANT: EXTRACT ALL IMAGING/RADIOLOGY STUDIES HERE, even if they appear under "Procedures Performed" section. Echocardiograms and cardiac imaging ARE imaging studies, not procedures.' },
                bodyPart: { type: 'string', description: 'Body part/region imaged (e.g., Chest, Abdomen, Brain, Heart, Spine, Extremity)' },
                indication: { type: 'string', description: 'Clinical indication/reason for imaging (e.g., "shortness of breath", "follow-up pneumonia", "chest pain")' },
                technique: { type: 'string', description: 'AI ANALYSIS: Extract technique if explicitly stated, OR intelligently infer standard technique based on modality and clinical context. Examples:\n- Chest X-ray → "Two-view chest radiograph (PA and lateral)" or "Portable AP chest radiograph" if bedside/ICU\n- Echocardiogram → "Transthoracic echocardiogram (TTE)" unless transesophageal mentioned\n- CT → "Non-contrast CT" unless contrast mentioned, "CT with IV contrast" if contrast used\n- MRI → "MRI without contrast" unless gadolinium mentioned\n- Ultrasound → "Transabdominal ultrasound" or specific approach based on body part\nUse clinical judgment based on imaging modality and clinical setting.' },
                date: { type: 'string', description: 'CRITICAL: ONLY extract if date is explicitly stated in PDF. DO NOT fabricate or assume dates. Leave EMPTY if not stated.' },
                contrast: {
                  type: 'object',
                  properties: {
                    used: { type: 'boolean' },
                    type: { type: 'string', description: 'Contrast type (e.g., "Gadolinium", "Iodinated")' },
                    specificAgent: { type: 'string', description: 'IMPORTANT: Specific contrast agent name (e.g., "Gadavist", "Omnipaque", "Dotarem")' },
                    amount: { type: 'string', description: 'Dose amount (e.g., "7.5 mL", "0.1 mmol/kg")' },
                    reaction: { type: 'string' }
                  },
                  description: 'IMPORTANT: Extract specific contrast agent name (Gadavist, Dotarem, etc.) and dose, not just generic type.'
                },
                studyTime: { type: 'string', description: 'CRITICAL: ONLY extract if study time is explicitly stated in PDF. DO NOT infer or fabricate study time. Leave EMPTY if not explicitly stated.' },
                technicalQuality: { type: 'string', description: 'Quality assessment (e.g., "Good", "Limited")' },
                findings: { type: 'string', description: 'ALL findings with measurements. IMPORTANT: If document mentions imaging at multiple timepoints (e.g., "Initial chest X-ray showed...", "Discharge chest X-ray showed..."), create SEPARATE imaging entries for each timepoint with appropriate dates. For structured breakdown, use findingsByRegion.' },
                findingsByRegion: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      anatomicalRegion: { type: 'string', description: 'Anatomical region (e.g., "Supratentorial", "Infratentorial", "Cervical spine", "Right lobe")' },
                      findings: { type: 'array', items: { type: 'string' }, description: 'Findings in this region with measurements' }
                    }
                  },
                  description: 'IMPORTANT: Structured findings breakdown by anatomical region. Preserves granularity of location-specific findings.'
                },
                measurements: {
                  type: 'object',
                  properties: {
                    ejectionFraction: { type: 'string', description: 'CRITICAL: Ejection fraction for echocardiograms (e.g., "55%", "EF 60%", "45-50%")' },
                    leftVentricleSize: { type: 'string', description: 'LV chamber size (e.g., "normal", "mildly dilated", "5.2 cm")' },
                    leftAtriumSize: { type: 'string', description: 'LA size (e.g., "mildly enlarged")' },
                    rightKidneySize: { type: 'string', description: 'Right kidney size (e.g., "10.2 cm")' },
                    leftKidneySize: { type: 'string', description: 'Left kidney size (e.g., "9.8 cm")' },
                    corticalThickness: { type: 'string', description: 'Renal cortical thickness' },
                    echogenicity: { type: 'string', description: 'Kidney echogenicity' },
                    tumorSize: { type: 'string', description: 'Tumor dimensions (e.g., "3.2 x 2.1 cm")' },
                    lesionSize: { type: 'string', description: 'Lesion size with location' }
                  },
                  description: 'IMPORTANT: Structured measurements from imaging. Extract ALL numeric measurements including ejection fraction, organ sizes, lesion dimensions, vessel diameters, etc.'
                },
                comparison: { type: 'string', description: 'Comparison to prior studies (e.g., "compared to prior study from 2023")' },
                impression: { type: 'string', description: 'Clinical impression/interpretation of imaging findings. For formal radiology reports, extract from explicit "Impression:" or "Conclusion:" section. For discharge summaries or clinical notes where imaging is mentioned narratively, extract the clinical interpretation from the narrative (e.g., "consistent with pneumonia" → "Pneumonia", "showed clearing" → "Resolution of pneumonia"). If findings describe a diagnosis, extract that as impression.' },
                impressionPoints: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      point: { type: 'string', description: 'Impression point text' },
                      category: { type: 'string', description: 'Category (e.g., "Primary Diagnosis", "No Evidence of", "Incidental Findings")' }
                    }
                  },
                  description: 'IMPORTANT: Structured multi-point impression breakdown. Extract ALL numbered or bulleted impression points separately, including "No Evidence of" findings and incidental findings.'
                },
                ruledOutDiagnoses: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'IMPORTANT: Diagnoses explicitly ruled out or with "No Evidence of" in impression section (e.g., "Tumefactive demyelination", "Neuromyelitis optica spectrum disorder", "CNS vasculitis"). Critical negative findings.'
                },
                incidentalFindings: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'IMPORTANT: Incidental findings mentioned in impression or findings sections (e.g., sinus disease, unrelated abnormalities).'
                },
                recommendations: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'CRITICAL - AI ANALYSIS REQUIRED: YOU MUST generate intelligent imaging-specific follow-up recommendations based on the findings, even if not explicitly stated in document. Analyze the imaging findings and provide appropriate clinical recommendations:\n- For acute findings (pneumonia, fractures, etc.): Recommend follow-up imaging timeframe to confirm resolution\n- For abnormal cardiac findings: Recommend repeat echocardiogram timing\n- For concerning findings: Recommend advanced imaging (CT, MRI) if appropriate\n- For resolved conditions: Recommend repeat imaging only if symptoms recur\n- For normal findings: State "No follow-up imaging needed unless clinically indicated"\nExample: Pneumonia on chest X-ray → "Recommend repeat chest X-ray in 4-6 weeks to confirm resolution"\nExample: Preserved EF 55% → "Routine echocardiogram follow-up in 1 year or per cardiology"\nExample: Clearing pneumonic infiltrate → "Repeat chest X-ray only if respiratory symptoms recur"\nDO NOT leave empty - always provide clinical recommendation based on findings.'
                },
                biRads: { type: 'string', description: 'BI-RADS, LI-RADS, PI-RADS scores' },
                radiologist: { type: 'string', description: 'Radiologist name who interpreted the study. Extract from signature or "interpreted by" sections. Leave empty if not explicitly stated.' },
                criticalFindings: { type: 'boolean' },
                communicatedTo: { type: 'string' },
                criticalFindingsCommunication: {
                  type: 'object',
                  properties: {
                    communicatedTo: { type: 'string', description: 'Physician communicated to (e.g., "Dr. Robinson")' },
                    method: { type: 'string', description: 'Communication method (e.g., "phone", "secure message")' },
                    time: { type: 'string', description: 'IMPORTANT: Communication time (e.g., "15:45", "3:45 PM"). Critical for result reporting compliance tracking.' },
                    date: { type: 'string', description: 'Communication date if specified' }
                  },
                  description: 'CRITICAL: Critical findings communication details for compliance tracking and quality metrics.'
                },
                totalScanTime: { type: 'string', description: 'IMPORTANT: Total scan duration in minutes (e.g., "68 minutes"). Important quality and billing metric.' },
                accessionNumber: { type: 'string' },
                stressTest: { type: 'string', description: 'IMPORTANT: Stress test results (e.g., "No inducible ischemia", "Positive for reversible defects"). Cardiac evaluation for surgical clearance.' },
                boneScan: { type: 'string', description: 'IMPORTANT: Bone scan results (e.g., "negative for metastases", "No evidence of osseous metastatic disease"). Oncology staging.' },
                ctAngiography: {
                  type: 'object',
                  properties: {
                    rightPerforators: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          size: { type: 'string', description: 'Perforator diameter (e.g., ">1.5mm", "2.0mm")' },
                          location: { type: 'string', description: 'Anatomic location (e.g., "at umbilical level", "5cm lateral to midline")' },
                          quality: { type: 'string', description: 'Quality assessment (e.g., "large", "good", "suitable")' }
                        }
                      },
                      description: 'CRITICAL: ALL right-sided perforator vessels for flap planning. Extract EVERY perforator mentioned in the report (e.g., if "2 large perforators" are mentioned, extract all 2 with available details). If count is mentioned (e.g., "2 large perforators >1.5mm"), create that many entries.'
                    },
                    leftPerforators: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          size: { type: 'string', description: 'Perforator diameter (e.g., ">1.5mm", "2.0mm")' },
                          location: { type: 'string', description: 'Anatomic location (e.g., "at umbilical level", "5cm lateral to midline")' },
                          quality: { type: 'string', description: 'Quality assessment (e.g., "large", "good", "suitable")' }
                        }
                      },
                      description: 'CRITICAL: ALL left-sided perforator vessels for flap planning. Extract EVERY perforator mentioned in the report (e.g., if "3 good perforators" are mentioned, extract all 3 with available details). If multiple perforators are mentioned but only the largest has size details, still create entries for all mentioned perforators with "good" or "suitable" quality.'
                    },
                    sieaVessels: {
                      type: 'string',
                      description: 'Superficial inferior epigastric artery (SIEA) vessel assessment (e.g., "Not suitable (too small)", "Present and suitable", "Good caliber")'
                    },
                    perforatorMapping: { type: 'string', description: 'Overall perforator mapping summary' }
                  },
                  description: 'CT angiography details for microsurgical flap planning'
                },

                functionalMRI: {
                  type: 'object',
                  properties: {
                    performed: { type: 'boolean', description: 'Was fMRI performed' },
                    indication: { type: 'string', description: 'Indication for fMRI (e.g., "Presurgical language mapping", "Motor mapping for tumor resection", "Eloquent cortex localization")' },
                    paradigms: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          task: { type: 'string', description: 'fMRI task paradigm (e.g., "Language - word generation", "Motor - finger tapping", "Visual - checkerboard")' },
                          hemisphere: { type: 'string', description: 'Hemisphere dominance if applicable (Left, Right, Bilateral)' }
                        }
                      },
                      description: 'fMRI task paradigms administered'
                    },
                    languageDominance: { type: 'string', description: 'Language dominance hemisphere (e.g., "Left hemisphere dominant", "Right hemisphere", "Bilateral")' },
                    motorMapping: {
                      type: 'object',
                      properties: {
                        handMotor: { type: 'string', description: 'Hand motor cortex location relative to lesion (e.g., "2.1 cm anterior to tumor", "Not abutting lesion")' },
                        footMotor: { type: 'string', description: 'Foot motor cortex location' },
                        tongueMotor: { type: 'string', description: 'Tongue/facial motor cortex location' }
                      },
                      description: 'Motor cortex activation mapping'
                    },
                    languageMapping: {
                      type: 'object',
                      properties: {
                        brocasArea: { type: 'string', description: 'Broca\'s area activation and relation to lesion (e.g., "Activated, 1.5 cm from tumor margin", "Directly adjacent to lesion - high surgical risk")' },
                        wernickesArea: { type: 'string', description: 'Wernicke\'s area activation and relation to lesion' },
                        supplementaryMotorArea: { type: 'string', description: 'Supplementary motor area activation' }
                      },
                      description: 'Language area activation mapping'
                    },
                    eloquentCortexProximity: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          cortexRegion: { type: 'string', description: 'Eloquent cortex region (e.g., "Primary motor cortex", "Broca\'s area", "Primary visual cortex")' },
                          distanceToLesion: { type: 'string', description: 'Distance from lesion/tumor (e.g., "1.2 cm", "Directly abutting", "<5 mm - high risk")' },
                          riskAssessment: { type: 'string', enum: ['Low risk', 'Moderate risk', 'High risk', 'Prohibitive risk'], description: 'Surgical risk based on proximity' }
                        }
                      },
                      description: 'CRITICAL: Eloquent cortex proximity analysis for surgical planning'
                    },
                    activationMaps: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          region: { type: 'string', description: 'Activated brain region (e.g., "Left inferior frontal gyrus", "Right primary motor cortex")' },
                          coordinates: { type: 'string', description: 'MNI or Talairach coordinates if provided (e.g., "[-45, 12, 28]")' },
                          zScore: { type: 'string', description: 'Statistical significance (z-score or p-value)' }
                        }
                      },
                      description: 'Detailed activation maps with coordinates'
                    },
                    clinicalInterpretation: { type: 'string', description: 'Overall clinical interpretation and surgical implications (e.g., "Language areas well-separated from tumor - safe for resection", "Motor cortex directly adjacent - awake craniotomy recommended")' }
                  },
                  description: 'Functional MRI (fMRI) for presurgical brain mapping and eloquent cortex localization'
                },

                diffusionTensorImaging: {
                  type: 'object',
                  properties: {
                    performed: { type: 'boolean', description: 'Was DTI/tractography performed' },
                    indication: { type: 'string', description: 'Indication for DTI (e.g., "Presurgical white matter tract mapping", "Tumor-tract relationship", "Stroke pathway assessment")' },
                    whiteMatterTracts: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          tract: { type: 'string', description: 'White matter tract name (e.g., "Corticospinal tract", "Arcuate fasciculus", "Superior longitudinal fasciculus", "Optic radiation")' },
                          hemisphere: { type: 'string', description: 'Left, Right, or Bilateral' },
                          integrity: { type: 'string', description: 'Tract integrity (e.g., "Intact", "Displaced", "Infiltrated", "Disrupted")' },
                          relationToLesion: { type: 'string', description: 'Spatial relationship to tumor/lesion (e.g., "Displaced medially by 8mm", "Passing through tumor - high risk", "Well-separated")' },
                          faValue: { type: 'string', description: 'Fractional anisotropy (FA) value if provided (e.g., "0.45", "Reduced FA 0.32")' },
                          adcValue: { type: 'string', description: 'Apparent diffusion coefficient (ADC) value if provided' }
                        }
                      },
                      description: 'CRITICAL: White matter tract analysis for surgical planning'
                    },
                    corticospinalTract: {
                      type: 'object',
                      properties: {
                        left: { type: 'string', description: 'Left CST relationship to lesion (e.g., "Displaced posteriorly", "Intact and separate")' },
                        right: { type: 'string', description: 'Right CST relationship to lesion' },
                        surgicalImplication: { type: 'string', description: 'Risk of motor deficit (e.g., "Low risk - well separated", "High risk - tract passes through tumor")' }
                      },
                      description: 'Corticospinal tract (CST) analysis - motor pathway'
                    },
                    arcuateFasciculus: {
                      type: 'object',
                      properties: {
                        left: { type: 'string', description: 'Left arcuate fasciculus (language pathway) relationship to lesion' },
                        right: { type: 'string', description: 'Right arcuate fasciculus relationship' },
                        surgicalImplication: { type: 'string', description: 'Risk of language deficit' }
                      },
                      description: 'Arcuate fasciculus analysis - language pathway'
                    },
                    opticRadiation: {
                      type: 'object',
                      properties: {
                        left: { type: 'string', description: 'Left optic radiation relationship to lesion' },
                        right: { type: 'string', description: 'Right optic radiation relationship' },
                        surgicalImplication: { type: 'string', description: 'Risk of visual field deficit (e.g., "Meyer\'s loop at risk - possible superior quadrantanopia")' }
                      },
                      description: 'Optic radiation analysis - visual pathway'
                    },
                    fractionalAnisotropy: {
                      type: 'object',
                      properties: {
                        tumorRegion: { type: 'string', description: 'FA value in tumor region (e.g., "Low FA 0.15 - infiltrative")' },
                        perilesionalRegion: { type: 'string', description: 'FA in surrounding white matter' },
                        normalReference: { type: 'string', description: 'FA in contralateral normal white matter for comparison' }
                      },
                      description: 'Fractional anisotropy quantitative analysis'
                    },
                    tractographyMethod: { type: 'string', description: 'Tractography method (e.g., "Deterministic", "Probabilistic")' },
                    clinicalInterpretation: { type: 'string', description: 'Overall DTI interpretation and surgical implications (e.g., "CST displaced but intact - resection feasible with careful monitoring", "Multiple tracts infiltrated - consider biopsy only")' }
                  },
                  description: 'Diffusion Tensor Imaging (DTI) and white matter tractography for surgical planning'
                },

                advancedImagingProtocols: {
                  type: 'object',
                  properties: {
                    perfusionImaging: {
                      type: 'object',
                      properties: {
                        performed: { type: 'boolean' },
                        technique: { type: 'string', description: 'DSC-MRI, ASL, DCE-MRI' },
                        rCBV: { type: 'string', description: 'Relative cerebral blood volume (rCBV) ratio (e.g., "rCBV 3.2 - high-grade features")' },
                        rCBF: { type: 'string', description: 'Relative cerebral blood flow' },
                        interpretation: { type: 'string', description: 'Perfusion interpretation (e.g., "Elevated rCBV suggests high-grade glioma", "Low perfusion consistent with radiation necrosis")' }
                      },
                      description: 'MR perfusion imaging for tumor grading and radiation necrosis assessment'
                    },
                    mrSpectroscopy: {
                      type: 'object',
                      properties: {
                        performed: { type: 'boolean' },
                        cholineToCreatine: { type: 'string', description: 'Choline/Creatine ratio (e.g., "Elevated 2.8")' },
                        naaLevel: { type: 'string', description: 'N-acetylaspartate (NAA) level (e.g., "Reduced - neuronal loss")' },
                        lactate: { type: 'string', description: 'Lactate peak presence (e.g., "Present - necrosis", "Absent")' },
                        interpretation: { type: 'string', description: 'Spectroscopy interpretation (e.g., "Elevated choline - neoplastic process", "Pattern consistent with tumor recurrence vs radiation necrosis")' }
                      },
                      description: 'MR spectroscopy for metabolic characterization'
                    },
                    susceptibilityWeightedImaging: {
                      type: 'object',
                      properties: {
                        performed: { type: 'boolean' },
                        microhemorrhages: { type: 'string', description: 'Microhemorrhages detected (e.g., "Multiple - suggests high-grade tumor", "None")' },
                        venousAnatomy: { type: 'string', description: 'Venous anatomy mapping for surgical planning' },
                        calcification: { type: 'string', description: 'Calcification patterns' }
                      },
                      description: 'Susceptibility-weighted imaging (SWI) for microhemorrhage and venous mapping'
                    }
                  },
                  description: 'Advanced imaging protocols for comprehensive tumor characterization'
                },

                surgicalPlanningRiskAssessment: {
                  type: 'object',
                  properties: {
                    resectabilityAssessment: { type: 'string', enum: ['Fully resectable', 'Subtotal resection feasible', 'Biopsy only recommended', 'Inoperable'], description: 'Overall resectability based on imaging' },
                    eloquentCortexRisk: { type: 'string', enum: ['Low risk', 'Moderate risk', 'High risk', 'Prohibitive'], description: 'Risk to eloquent cortex' },
                    motorDeficitRisk: { type: 'string', enum: ['Low', 'Moderate', 'High', 'Very high'], description: 'Risk of postoperative motor deficit based on CST proximity' },
                    languageDeficitRisk: { type: 'string', enum: ['Low', 'Moderate', 'High', 'Very high'], description: 'Risk of postoperative language deficit based on language pathway proximity' },
                    visualDeficitRisk: { type: 'string', enum: ['Low', 'Moderate', 'High', 'Very high'], description: 'Risk of visual field deficit based on optic radiation proximity' },
                    recommendedApproach: { type: 'string', description: 'Recommended surgical approach (e.g., "Awake craniotomy with intraoperative mapping", "Standard craniotomy with neuronavigation", "Stereotactic biopsy")' },
                    intraoperativeMonitoring: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Recommended intraoperative monitoring (e.g., "Motor evoked potentials", "Awake language mapping", "Somatosensory evoked potentials", "Cortical stimulation mapping")'
                    },
                    multidisciplinaryRecommendations: { type: 'string', description: 'Recommendations for multidisciplinary discussion (e.g., "Recommend tumor board discussion given proximity to eloquent cortex", "Consider neoadjuvant chemotherapy to reduce tumor size")' }
                  },
                  description: 'CRITICAL: Comprehensive surgical risk assessment based on advanced imaging findings'
                }
              }
            },
            description: 'ALL imaging studies with complete findings and measurements'
          },
          // ========== COMPREHENSIVE MEDICAL HISTORY ==========
          medicalHistory: {
            type: 'object',
            properties: {
              pastMedicalHistory: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    condition: { type: 'string', description: 'Include anatomical details (e.g., L4-L5 disc herniation)' },
                    bmiValue: { type: 'number', description: 'BMI value if obesity is mentioned' },
                    anatomicalDetails: { type: 'string', description: 'Specific anatomical location (e.g., L5 radiculopathy)' },
                    icdCode: { type: 'string' },
                    dateOfOnset: { type: 'string' },
                    status: { type: 'string', description: 'active, resolved, chronic' },
                    treatment: { type: 'string' },
                    managedBy: { type: 'string' }
                  }
                }
              },
              surgicalHistory: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    procedure: { type: 'string' },
                    date: { type: 'string' },
                    indication: { type: 'string' },
                    surgeon: { type: 'string' },
                    facility: { type: 'string' },
                    complications: { type: 'string' }
                  }
                }
              },
              hospitalizations: {
                type: 'string',
                description: 'Past hospitalization history (e.g., "None", "Hospitalized at age 2 for pneumonia", "Multiple admissions for asthma exacerbations"). Important for assessing disease severity and resource utilization.'
              },
              previousInjuries: {
                type: 'string',
                description: 'Previous injury history (e.g., "None", "Minor cuts/bruises typical for age", "Fractured left arm age 4 - healed without complications", "Head injury with LOC age 3"). Important for developmental and safety assessment.'
              },
              familyHistory: {
                type: 'object',
                properties: {
                  conditions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        relationship: { type: 'string' },
                        condition: { type: 'string' },
                        ageAtOnset: { type: 'string' },
                        ageAtDeath: { type: 'string', description: 'IMPORTANT: Family member\'s age at death (e.g., "62", "died at 62")' },
                        causeOfDeath: { type: 'string', description: 'IMPORTANT: Cause of death (e.g., "heart attack", "cancer", "stroke")' },
                        patientAgeAtEvent: { type: 'string', description: 'CRITICAL: Patient\'s age when family member died or was diagnosed (e.g., "age 35 when father died", "witnessed death at age 35"). Important for trauma assessment.' },
                        patientEmotionalResponse: { type: 'string', description: 'Patient\'s emotional response to family member\'s condition (e.g., "Patient tearful discussing mother\'s dialysis experience", "Anxious about family history of cancer")' }
                      }
                    }
                  },
                  siblings: { type: 'string', description: 'Sibling information for pediatric patients (e.g., "None", "2 brothers, both healthy", "1 sister age 4"). Important for family dynamics and genetic risk assessment.' },
                  negativeHistory: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'IMPORTANT: Explicitly documented negative family history (e.g., "No family history of: Sjögren\'s, scleroderma, or myositis", "No family history of heart disease"). Clinically relevant negative information.'
                  }
                },
                description: 'Family medical history including both positive findings and explicitly documented negative history'
              },
              socialHistory: {
                type: 'object',
                properties: {
                  tobacco: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', description: 'current, former, never' },
                      type: { type: 'string' },
                      amount: { type: 'string' },
                      packYears: { type: 'number' },
                      quitDate: { type: 'string' }
                    }
                  },
                  alcohol: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      type: { type: 'string' },
                      amount: { type: 'string' },
                      frequency: { type: 'string' },
                      change: { type: 'string', description: 'IMPORTANT: Change in alcohol consumption pattern (e.g., "increased from previous", "decreased", "stable"). Clinically significant for assessing coping mechanisms and substance use risk.' },
                      cage: { type: 'number' }
                    }
                  },
                  drugs: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      types: { type: 'array', items: { type: 'string' } },
                      lastUse: { type: 'string' },
                      marijuana: { type: 'string' },
                      medicalMarijuana: { type: 'string' }
                    }
                  },
                  occupation: { type: 'string' },
                  employmentDuration: { type: 'string', description: 'IMPORTANT: Duration at current/recent employer (e.g., "worked for 12 years", "3 years at current position"). Provides context for job loss stressor severity.' },
                  adlStatus: { type: 'string', description: 'IMPORTANT: Activities of Daily Living status (e.g., "Independent in ADLs", "Requires assistance with bathing and dressing"). Functional status assessment.' },
                  activities: { type: 'string', description: 'Hobbies and recreational activities (e.g., "Avid golfer, travels frequently")' },
                  exposures: { type: 'array', items: { type: 'string' } },
                  exercise: { type: 'string' },
                  diet: { type: 'string', description: 'CURRENT dietary habits and patterns (e.g., "Good appetite, varied diet, some preference for processed foods", "Vegetarian diet"). DO NOT put recommendations here.' },
                  caffeine: { type: 'string' },
                  waterIntake: { type: 'string', description: 'IMPORTANT: Daily water intake (e.g., "4-5 glasses daily", "2 liters per day", "64 oz daily"). Critical for stone prevention and urologic treatment planning.' },
                  sexualHistory: { type: 'string' },
                  travelHistory: { type: 'array', items: { type: 'string' } },
                  livingSituation: { type: 'string' },
                  livingArrangement: { type: 'string', description: 'Living arrangement details (e.g., "Lives alone", "Lives with family", "Assisted living")' },
                  transportation: { type: 'string', description: 'Transportation access (e.g., "Drives self", "Relies on family", "Public transportation")' },
                  maritalStatus: { type: 'string', description: 'Marital status (e.g., "Married", "Single", "Divorced", "Widowed")' },
                  supportSystem: { type: 'string', description: 'IMPORTANT: Social support network (e.g., "Close friend, mother lives nearby", "Limited support system", "Strong family support")' },
                  stress: { type: 'string' },
                  sleep: { type: 'string', description: 'CURRENT sleep patterns (e.g., "10-11 hours/night, occasional bedtime resistance", "7-8 hours, difficulty falling asleep"). DO NOT put recommendations here - use anticipatoryGuidance.sleep for recommendations.' },
                  school: { type: 'string', description: 'Current school for pediatric patients (e.g., "Kindergarten at Lincoln Elementary", "5th grade at Washington Middle School")' },
                  pets: { type: 'string' },
                  children: { type: 'string', description: 'Number and health status of children (e.g., "Two adult children, both healthy")' },
                  childrenVisitationSchedule: { type: 'string', description: 'IMPORTANT: Custody/visitation schedule for children (e.g., "children every other weekend", "weekly visits", "full custody"). Relevant for protective factors and support assessment.' },
                  education: { type: 'string', description: 'Education level (e.g., "Bachelor\'s degree", "High school diploma")' },
                  insurance: { type: 'string', description: 'Insurance provider and type (e.g., "Blue Cross Blue Shield through employer")' },
                  insuranceStatus: { type: 'string', description: 'IMPORTANT: Insurance coverage quality relevant to treatment (e.g., "good insurance coverage for medications", "limited coverage", "uninsured"). Relevant for treatment planning.' },
                  financialConcerns: { type: 'string', description: 'Financial stress, medication costs, disability/retirement income concerns' },
                  familyPlanning: { type: 'string', description: 'CRITICAL: Family planning status for women of childbearing age (e.g., "No current pregnancy risk (husband with vasectomy)", "Planning pregnancy next year", "Not sexually active"). Important for medication safety counseling.' },
                  screenTime: { type: 'string', description: 'CURRENT screen time usage for pediatric patients (e.g., "1-2 hours/day on weekdays, 3-4 hours weekends"). DO NOT put recommendations here - use anticipatoryGuidance.screenTime for recommendations.' },
                  safety: { type: 'string', description: 'Current safety practices for pediatric patients (e.g., "Car seat appropriate for age/weight, bike helmet use", "No pool fence, discussed water safety")' },
                  development: { type: 'string', description: 'Overall developmental status summary for pediatric patients (e.g., "Meeting age-appropriate milestones", "Speech delay noted")' }
                }
              },
              obGynHistory: {
                type: 'object',
                properties: {
                  g: { type: 'number' },
                  p: { type: 'number' },
                  lmp: { type: 'string' },
                  menstrualHistory: { type: 'string' },
                  contraception: { type: 'string' },
                  pregnancies: { type: 'array', items: { type: 'object' } },
                  lastMammogram: { type: 'string', description: 'IMPORTANT: Last mammogram result and date (e.g., "Normal, 6 months ago", "Negative, 2024-03"). Relevant screening history.' },
                  lastPapSmear: { type: 'string', description: 'Last Pap smear result and date' },
                  lastBoneDensity: { type: 'string', description: 'Last bone density scan if applicable' }
                },
                description: 'OB/GYN history including screening tests'
              },
              psychiatricHistory: {
                type: 'object',
                properties: {
                  diagnoses: { type: 'array', items: { type: 'string' } },
                  hospitalizations: { type: 'array', items: { type: 'string' } },
                  suicideAttempts: { type: 'string' },
                  medications: { type: 'array', items: { type: 'string' } }
                }
              },
              developmentalHistory: {
                type: 'object',
                properties: {
                  milestones: { type: 'array', items: { type: 'string' } },
                  education: { type: 'string' },
                  specialNeeds: { type: 'array', items: { type: 'string' } }
                }
              }
            },
            description: 'COMPLETE medical, surgical, family, social, OB/GYN, psychiatric history'
          },
          pastMedicalHistory: {
            type: 'object',
            properties: {
              conditions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    condition: { type: 'string' },
                    status: { type: 'string' },
                    treatmentCompliance: { type: 'string', description: 'IMPORTANT: Treatment adherence details (e.g., "Uses CPAP nightly", "Poor medication compliance", "Takes metformin as prescribed")' }
                  }
                },
                description: 'Array of past medical conditions (also available in medicalHistory.pastMedicalHistory for backward compatibility)'
              },
              hospitalizations: {
                type: 'string',
                description: 'IMPORTANT: Past hospitalization history (e.g., "None", "Hospitalized at age 2 for pneumonia", "Multiple admissions for asthma exacerbations"). Essential for pediatric and adult medical records.'
              },
              previousInjuries: {
                type: 'string',
                description: 'IMPORTANT: Previous injury history (e.g., "None", "Minor cuts/bruises typical for age", "Fractured left arm age 4 - healed without complications", "Head injury with LOC age 3"). Important for developmental and safety assessment.'
              }
            },
            description: 'Top-level past medical history summary including hospitalizations and injuries'
          },
          riskFactors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                factor: { type: 'string' },
                category: { type: 'string' },
                severity: { type: 'string' }
              }
            },
            description: 'Medical risk factors AND protective factors (e.g., hypertension, "No diabetes", "Never smoker")'
          },
          giRiskAssessment: {
            type: 'object',
            properties: {
              overallRiskLevel: {
                type: 'string',
                enum: ['Low', 'Moderate', 'High', 'Critical'],
                description: 'Overall GI risk level considering ALL risk types (bleeding, aspiration, hepatic, pancreatitis, C.diff, obstruction, malabsorption)'
              },
              bleedingRisk: {
                type: 'object',
                description: 'GI bleeding risk assessment',
                properties: {
                  riskLevel: { type: 'string', enum: ['Low', 'Moderate', 'High', 'Critical'] },
                  riskFactors: { type: 'array', items: { type: 'string' }, description: 'Age >65, anticoagulants, NSAIDs, corticosteroids, SSRIs, history of bleeding/ulcer' },
                  hasHistoryOfGIBleeding: { type: 'boolean' },
                  hasHistoryOfPepticUlcer: { type: 'boolean' },
                  currentMedications: {
                    type: 'object',
                    properties: {
                      anticoagulants: { type: 'array', items: { type: 'string' } },
                      antiplatelets: { type: 'array', items: { type: 'string' } },
                      nsaids: { type: 'array', items: { type: 'string' } },
                      corticosteroids: { type: 'array', items: { type: 'string' } },
                      ssris: { type: 'array', items: { type: 'string' } },
                      ppiUse: { type: 'boolean' }
                    }
                  },
                  recommendations: { type: 'array', items: { type: 'string' } }
                }
              },
              aspirationRisk: {
                type: 'object',
                description: 'Aspiration risk assessment',
                properties: {
                  riskLevel: { type: 'string', enum: ['Low', 'Moderate', 'High', 'Critical'] },
                  riskFactors: { type: 'array', items: { type: 'string' }, description: 'Dysphagia, altered LOC, GERD, vomiting, tube feeding, neurological disorders' },
                  swallowingDifficulty: { type: 'boolean' },
                  alteredMentalStatus: { type: 'boolean' },
                  recommendations: { type: 'array', items: { type: 'string' } }
                }
              },
              hepaticRisk: {
                type: 'object',
                description: 'Liver failure/hepatotoxicity risk',
                properties: {
                  riskLevel: { type: 'string', enum: ['Low', 'Moderate', 'High', 'Critical'] },
                  riskFactors: { type: 'array', items: { type: 'string' }, description: 'Hepatotoxic medications, alcohol use, viral hepatitis, cirrhosis' },
                  hepatotoxicMedications: { type: 'array', items: { type: 'string' }, description: 'Acetaminophen, methotrexate, isoniazid, amiodarone, etc.' },
                  alcoholUse: { type: 'boolean' },
                  liverDisease: { type: 'string' },
                  recommendations: { type: 'array', items: { type: 'string' } }
                }
              },
              pancreatitisRisk: {
                type: 'object',
                description: 'Pancreatitis risk assessment',
                properties: {
                  riskLevel: { type: 'string', enum: ['Low', 'Moderate', 'High', 'Critical'] },
                  riskFactors: { type: 'array', items: { type: 'string' }, description: 'Gallstones, alcohol, medications, hypertriglyceridemia, prior pancreatitis' },
                  gallstones: { type: 'boolean' },
                  highTriglycerides: { type: 'boolean' },
                  pancreatitisHistory: { type: 'boolean' },
                  recommendations: { type: 'array', items: { type: 'string' } }
                }
              },
              cDiffRisk: {
                type: 'object',
                description: 'C. difficile infection risk',
                properties: {
                  riskLevel: { type: 'string', enum: ['Low', 'Moderate', 'High', 'Critical'] },
                  riskFactors: { type: 'array', items: { type: 'string' }, description: 'Recent antibiotics, PPI use, hospitalization, age >65, immunosuppression' },
                  recentAntibiotics: { type: 'array', items: { type: 'string' } },
                  recentHospitalization: { type: 'boolean' },
                  ppiUse: { type: 'boolean' },
                  recommendations: { type: 'array', items: { type: 'string' } }
                }
              },
              obstructionRisk: {
                type: 'object',
                description: 'GI obstruction risk',
                properties: {
                  riskLevel: { type: 'string', enum: ['Low', 'Moderate', 'High', 'Critical'] },
                  riskFactors: { type: 'array', items: { type: 'string' }, description: 'Prior abdominal surgery, adhesions, hernias, tumors, IBD' },
                  priorAbdominalSurgery: { type: 'boolean' },
                  ibdHistory: { type: 'boolean' },
                  recommendations: { type: 'array', items: { type: 'string' } }
                }
              },
              malabsorptionRisk: {
                type: 'object',
                description: 'Malabsorption and malnutrition risk',
                properties: {
                  riskLevel: { type: 'string', enum: ['Low', 'Moderate', 'High', 'Critical'] },
                  riskFactors: { type: 'array', items: { type: 'string' }, description: 'Celiac disease, IBD, short bowel syndrome, pancreatic insufficiency, chronic diarrhea' },
                  recommendations: { type: 'array', items: { type: 'string' } }
                }
              },
              comorbidities: {
                type: 'array',
                items: { type: 'string' },
                description: 'ALL relevant GI-related comorbidities across all risk types'
              },
              protectiveFactors: {
                type: 'array',
                items: { type: 'string' },
                description: 'Protective factors (PPI use, H. pylori eradication, diet modifications, etc.)'
              },
              recommendations: {
                type: 'array',
                items: { type: 'string' },
                description: 'Comprehensive clinical recommendations for ALL identified GI risks'
              },
              assessment: { type: 'string', description: 'Overall clinical assessment and rationale for risk levels across all GI risk categories' }
            },
            description: 'CRITICAL: Comprehensive GI risk assessment covering ALL major GI complications: (1) GI bleeding (anticoagulants, NSAIDs, age, history), (2) Aspiration (dysphagia, altered LOC, GERD), (3) Hepatic failure (hepatotoxic meds, alcohol, liver disease), (4) Pancreatitis (gallstones, alcohol, triglycerides), (5) C. difficile (antibiotics, PPI, hospitalization), (6) GI obstruction (prior surgery, IBD, hernias), (7) Malabsorption (celiac, IBD, pancreatic insufficiency). MUST assess ALL categories even if not explicitly mentioned - infer from medications, history, and diagnoses. Calculate risk level for each category AND overall risk. Provide specific clinical recommendations for EACH identified risk.'
          },
          // ========== APPOINTMENTS & FOLLOW-UP ==========
          followUpAppointments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                specialty: { type: 'string' },
                provider: { type: 'string', description: 'Actual doctor name, NOT "Unknown"' },
                date: { type: 'string' },
                time: { type: 'string' },
                timing: { type: 'string', description: '"4-6 weeks" or specific date' },
                location: { type: 'string' },
                reason: { type: 'string' },
                type: { type: 'string', description: 'routine, urgent, procedure, surgery' },
                instructions: { type: 'string' },
                isScheduled: { type: 'boolean', description: 'true if scheduled, false if recommendation' },
                requiresReferral: { type: 'boolean' },
                requiresPrep: { type: 'string' },
                labsBeforeVisits: { type: 'boolean', description: 'Whether labs are required before this appointment' }
              }
            },
            description: 'Scheduled appointments AND recommendations clearly differentiated'
          },
          chiefComplaint: {
            type: 'object',
            properties: {
              complaint: {
                type: 'string',
                description: 'The patient\'s chief complaint in their own words (direct quote if available)'
              },
              duration: {
                type: 'string',
                description: 'How long the patient has had these symptoms (e.g., "3 weeks", "2 days", "chronic"). Extract from history if not explicitly stated with chief complaint.'
              }
            },
            description: 'Chief complaint with duration - the first things a doctor asks: "What brings you in?" and "How long have you had this?"'
          },
          historyOfPresentIllness: {
            type: 'string',
            description: 'Detailed history of current medical issue'
          },
          // ========== COMPREHENSIVE PHYSICAL EXAMINATION ==========
          physicalExamination: {
            type: 'object',
            properties: {
              general: { type: 'string', description: 'General appearance, distress level, cooperation' },
              cushingoidFeatures: { type: 'boolean', description: 'Presence of cushingoid features (moon facies, central obesity, buffalo hump, thin skin)' },
              constitutional: { type: 'string', description: 'Fever, weight loss, fatigue' },
              heent: {
                type: 'object',
                properties: {
                  head: { type: 'string' },
                  eyes: { type: 'string', description: 'PERRLA, EOM, visual fields' },
                  ears: { type: 'string', description: 'TMs, hearing' },
                  nose: { type: 'string' },
                  throat: { type: 'string', description: 'Pharynx, tonsils' },
                  mouth: { type: 'string', description: 'IMPORTANT: Oral cavity findings (e.g., "Two shallow ulcers on hard palate, non-scarring", "No oral ulcers", "Mucosa normal"). Critical for lupus/autoimmune assessment.' },
                  neck: { type: 'string', description: 'JVD, lymph nodes, thyroid' }
                },
                description: 'Head, Eyes, Ears, Nose, Throat, and Mouth examination'
              },
              cardiovascular: {
                type: 'object',
                properties: {
                  rhythm: { type: 'string' },
                  sounds: { type: 'string', description: 'S1, S2, murmurs, rubs, gallops' },
                  s3Gallop: { type: 'boolean', description: 'Presence of S3 gallop (important heart failure finding)' },
                  s3GallopDescription: { type: 'string', description: 'Clinical context for S3 gallop if mentioned (e.g., "heart failure indicator", "volume overload")' },
                  s4Gallop: { type: 'boolean', description: 'Presence of S4 gallop' },
                  murmurDetails: { type: 'string', description: 'Complete murmur documentation including grade (e.g., "2/6"), timing (systolic/diastolic), location, and radiation' },
                  murmurLocation: { type: 'string', description: 'Anatomic location where murmur is best heard (e.g., "apex", "left sternal border")' },
                  murmurRadiation: { type: 'string', description: 'Where murmur radiates (e.g., "to axilla", "to carotids")' },
                  pulses: { type: 'string' },
                  edema: { type: 'string' },
                  jvp: { type: 'string' },
                  jvd: { type: 'string', description: 'Jugular venous distension assessment (e.g., "no JVD", "JVD present")' },
                  capillaryRefill: { type: 'string', description: 'Capillary refill time (e.g., "<2 seconds", "normal", "brisk")' },
                  killipClass: { type: 'string', description: 'Killip classification for heart failure (I, II, III, IV) - physical exam finding of congestion severity' },
                  findings: { type: 'string', description: 'General cardiovascular findings (e.g., "S4 gallop, PMI laterally displaced")' }
                }
              },
              respiratory: {
                type: 'object',
                properties: {
                  effort: { type: 'string' },
                  sounds: { type: 'string', description: 'Clear, wheezes, rales, rhonchi' },
                  percussion: { type: 'string' },
                  expansion: { type: 'string' }
                }
              },
              gastrointestinal: {
                type: 'object',
                properties: {
                  inspection: { type: 'string' },
                  auscultation: { type: 'string' },
                  percussion: { type: 'string' },
                  palpation: { type: 'string' },
                  liver: { type: 'string' },
                  spleen: { type: 'string' },
                  rectal: { type: 'string' }
                }
              },
              breasts: { type: 'string', description: 'Breast examination findings (e.g., "Enlarged, appropriate for gestation, no masses")' },
              genitourinary: {
                type: 'object',
                properties: {
                  external: { type: 'string' },
                  pelvic: { type: 'string', description: 'Pelvic exam findings or deferral status (e.g., "Deferred (no indication at this visit)")' },
                  prostate: { type: 'string' },
                  testicular: { type: 'string' }
                }
              },
              musculoskeletal: {
                type: 'object',
                properties: {
                  gait: { type: 'string' },
                  strength: { type: 'string' },
                  tone: { type: 'string' },
                  range: { type: 'string' },
                  joints: { type: 'string' },
                  spine: { type: 'string' },
                  back: { type: 'string', description: 'Back exam findings (e.g., surgical scars, tenderness)' },
                  deformities: { type: 'string', description: 'Presence or absence of deformities and asymmetry (e.g., "No deformities or asymmetry", "Scoliosis noted", "Valgus deformity")' }
                }
              },
              neurological: {
                type: 'object',
                properties: {
                  mental: { type: 'string', description: 'Alert, oriented x3' },
                  cranialNerves: { type: 'string', description: 'CN II-XII' },
                  motor: { type: 'string', description: 'Strength 5/5' },
                  sensory: { type: 'string' },
                  reflexes: { type: 'string', description: 'DTRs' },
                  cerebellar: { type: 'string' },
                  gait: { type: 'string' }
                }
              },
              skin: {
                type: 'object',
                properties: {
                  color: { type: 'string' },
                  lesions: { type: 'string' },
                  rashes: { type: 'string' },
                  wounds: { type: 'string' },
                  turgor: { type: 'string' }
                }
              },
              psychiatric: {
                type: 'object',
                properties: {
                  mood: { type: 'string' },
                  affect: { type: 'string' },
                  thought: { type: 'string' },
                  insight: { type: 'string' },
                  judgment: { type: 'string' }
                }
              },
              lymphatic: { type: 'string', description: 'Lymph nodes' },
              extremities: { type: 'string', description: 'Cyanosis, clubbing, edema' },
              functionalCapacity: { type: 'string', description: 'Exercise capacity in METs' }
            },
            description: 'COMPLETE systems-based physical examination'
          },
          reviewOfSystems: {
            type: 'object',
            properties: {
              constitutional: { type: 'string', description: 'Fever, weight loss, fatigue' },
              heent: { type: 'string', description: 'Head, eyes, ears, nose, throat symptoms' },
              eyes: { type: 'string', description: 'Vision changes, eye symptoms - be specific about diabetic retinopathy status or vision stability' },
              ent: { type: 'string', description: 'Ear, nose, throat specific findings including metallic taste, hearing changes, nasal symptoms' },
              cardiovascular: { type: 'string', description: 'Chest pain, palpitations, DOE, orthopnea, PND, leg edema' },
              respiratory: { type: 'string', description: 'SOB, cough, wheeze' },
              gastrointestinal: { type: 'string', description: 'Nausea, vomiting, diarrhea' },
              genitourinary: { type: 'object', properties: {
                symptoms: { type: 'string', description: 'Dysuria, frequency, hematuria' },
                nocturia: { type: 'object', properties: {
                  present: { type: 'boolean' },
                  frequency: { type: 'number', description: 'Number of times per night (e.g., 3, 4)' },
                  description: { type: 'string', description: 'Free text if frequency not numeric (e.g., "3-4x per night")' }
                }}
              }},
              musculoskeletal: { type: 'string', description: 'Joint pain, stiffness' },
              neurological: { type: 'string', description: 'Headache, weakness, numbness' },
              psychiatric: { type: 'object', properties: {
                symptoms: { type: 'string', description: 'Depression, anxiety symptoms' },
                phq9Score: { type: 'number', description: 'PHQ-9 depression screening score (0-27)' },
                gad7Score: { type: 'number', description: 'GAD-7 anxiety screening score (0-21)' }
              }},
              endocrine: { type: 'string', description: 'Heat/cold intolerance' },
              hematologic: { type: 'string', description: 'Easy bruising, bleeding' },
              skin: { type: 'string', description: 'Rashes, lesions' },
              sleepSymptoms: { type: 'string', description: 'Sleep-related symptoms (snoring, apneas, daytime somnolence)' }
            },
            description: 'Complete review of systems'
          },
          assessmentAndPlan: {
            type: 'string',
            description: 'Clinical assessment and treatment plan'
          },
          treatmentPlan: {
            type: 'object',
            properties: {
              conditionalMedications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string', description: 'Medication name (e.g., "hydralazine", "metolazone", "spironolactone", "patiromer")' },
                    dose: { type: 'string', description: 'Dosage (e.g., "25mg TID", "12.5mg daily")' },
                    condition: { type: 'string', description: 'Condition for use (e.g., "if BP remains elevated", "if K+ allows", "if recurrent hyperkalemia")' },
                    indication: { type: 'string', description: 'Reason for medication' }
                  }
                },
                description: 'Conditional medications to consider based on specific criteria'
              },
              deviceMonitoring: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    device: { type: 'string', description: 'Device type (e.g., "CGM", "Blood pressure monitor", "Glucose meter")' },
                    purpose: { type: 'string', description: 'Monitoring purpose' },
                    frequency: { type: 'string', description: 'Monitoring frequency' }
                  }
                },
                description: 'Device monitoring plans (CGM, home BP monitoring, etc)'
              },
              pendingProcedures: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    procedure: { type: 'string', description: 'Procedure name (e.g., "Vein mapping", "Echocardiogram", "Dialysis unit tour")' },
                    indication: { type: 'string', description: 'Reason for procedure (e.g., "to reassess EF", "for dialysis access")' },
                    timing: { type: 'string', description: 'When scheduled or planned (e.g., "ordered", "within 3 months", "urgent")' },
                    urgency: { type: 'string', description: 'Priority level (e.g., "routine", "urgent", "stat")' },
                    status: { type: 'string', description: 'Ordered, scheduled, pending' }
                  }
                },
                description: 'Procedures ordered or scheduled'
              },
              echocardiogramTiming: {
                type: 'string',
                description: 'Specific timing or urgency for echocardiogram if mentioned'
              },
              rehabilitationReferrals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    program: { type: 'string', description: 'Program name (e.g., "Cardiac rehabilitation", "Renal education class")' },
                    purpose: { type: 'string', description: 'Program purpose' },
                    status: { type: 'string', description: 'Referred, enrolled, scheduled' }
                  }
                },
                description: 'Rehabilitation and education program referrals'
              },
              adherenceInterventions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Medication adherence interventions (e.g., "Pill box organization", "Weekly pill organizer")' },
              immediateInterventions: {
                type: 'object',
                properties: {
                  volumeManagement: { type: 'object', properties: {
                    furosemideIncrease: { type: 'string', description: 'Furosemide dose increase details' },
                    dailyWeights: { type: 'boolean', description: 'Daily weight monitoring required' },
                    dailyWeightsInstruction: { type: 'string', description: 'Specific daily weights instruction (e.g., "Daily weights, fluid restriction 2L/day")' },
                    fluidRestriction: { type: 'string', description: 'Fluid restriction amount (e.g., "2L/day")' },
                    sodiumRestriction: { type: 'string', description: 'Sodium restriction amount (e.g., "<2g/day")' },
                    considerMetolazone: { type: 'string', description: 'Metolazone consideration details' }
                  }},
                  bloodPressureOptimization: { type: 'object', properties: {
                    target: { type: 'string', description: 'BP target (e.g., "<130/80 mmHg")' },
                    maximizeACEInhibitor: { type: 'string', description: 'Instructions to maximize ACE inhibitor (e.g., "monitor K+ closely")' },
                    addHydralazine: { type: 'string', description: 'Hydralazine addition with dose if BP remains elevated (e.g., "Add hydralazine 25mg TID if needed")' },
                    homeMonitoring: { type: 'boolean', description: 'Home BP monitoring required' }
                  }},
                  proteinuriaReduction: { type: 'object', properties: {
                    continueEmpagliflozin: { type: 'boolean' },
                    maximizeLisinopril: { type: 'string' },
                    considerSpironolactone: { type: 'string', description: 'Consider if K+ allows' },
                    dietaryProteinRestriction: { type: 'string', description: 'Protein restriction target (e.g., "0.8g/kg/day")' }
                  }}
                },
                description: 'Immediate treatment interventions'
              },
              ckdManagement: {
                type: 'object',
                properties: {
                  anemiaManagement: { type: 'object', properties: {
                    ironSupplementation: { type: 'string' },
                    targetHemoglobin: { type: 'string', description: 'Target Hgb level (e.g., "10-11 g/dL")' },
                    esaTherapy: { type: 'string', description: 'ESA consideration details' },
                    monitoringFrequency: { type: 'string', description: 'Monitoring frequency (e.g., "monthly initially")' }
                  }},
                  mineralBoneDisease: { type: 'object', properties: {
                    targetPTH: { type: 'string', description: 'PTH target (e.g., "150-300 for CKD stage")' },
                    calciumCarbonate: { type: 'string' },
                    vitaminD: { type: 'string' },
                    continueSevelamer: { type: 'string', description: 'Continue sevelamer instructions (e.g., "with meals")' },
                    continueCalcitriol: { type: 'boolean', description: 'Continue calcitriol' },
                    dietaryPhosphorusRestriction: { type: 'boolean' }
                  }},
                  metabolicAcidosis: { type: 'object', properties: {
                    sodiumBicarbonate: { type: 'string' },
                    targetCO2: { type: 'string', description: 'Target CO2 level (e.g., "22-24 mEq/L")' }
                  }},
                  hyperkalemiaManagement: { type: 'object', properties: {
                    avoidKSparingDiuretics: { type: 'boolean', description: 'Avoid K-sparing diuretics' },
                    dietaryPotassiumRestriction: { type: 'string' },
                    patiromerAvailability: { type: 'string', description: 'Patiromer if recurrent hyperkalemia' }
                  }}
                },
                description: 'CKD complication management'
              },
              cardiovascularRiskReduction: {
                type: 'object',
                properties: {
                  continueStatin: { type: 'string', description: 'Statin continuation (e.g., "high intensity")' },
                  continueAspirin: { type: 'boolean' },
                  optimizeHeartFailureManagement: { type: 'boolean' },
                  cardiacRehabilitationProgram: { type: 'string', description: 'Cardiac rehabilitation program referral details' },
                  cardiacClearanceForTransplant: { type: 'string', description: 'Cardiac clearance needed for transplant (e.g., "Need cardiac clearance given CAD")' },
                  exerciseRecommendations: { type: 'object', properties: {
                    type: { type: 'string', description: 'Type of exercise (e.g., "Low impact activities", "Cardiac rehab", "Walking")' },
                    duration: { type: 'string', description: 'Duration goal (e.g., "150 minutes/week", "30 min/day")' },
                    restrictions: { type: 'string', description: 'Any restrictions or modifications' }
                  }},
                  echocardiogramReassessment: { type: 'string', description: 'Echo to reassess EF' },
                  echocardiogramStatus: { type: 'object', properties: {
                    ordered: { type: 'boolean' },
                    indication: { type: 'string', description: 'Reason (e.g., "to reassess EF")' },
                    timing: { type: 'string', description: 'When scheduled (e.g., "ordered", "next month")' }
                  }}
                },
                description: 'Cardiovascular risk reduction strategies'
              },
              glp1AgonistTransition: {
                type: 'string',
                description: 'Plan to transition diabetes management to GLP-1 agonist (e.g., "Transition to GLP-1 agonist for renal benefits")'
              },
              glp1AgonistSpecificAgent: {
                type: 'string',
                description: 'Specific GLP-1 agonist medication if mentioned (e.g., "semaglutide", "liraglutide", "dulaglutide")'
              },
              cgmMonitoring: {
                type: 'string',
                description: 'CGM monitoring plans with specific indication (e.g., "CGM for hypoglycemia monitoring")'
              },
              endocrinologyCoManagement: {
                type: 'string',
                description: 'Co-management plans with endocrinology or other specialists'
              },
              cardiacClearanceForTransplant: {
                type: 'string',
                description: 'Requirements for cardiac clearance before procedures like transplant (e.g., "Need cardiac clearance given CAD")'
              },
              carePlanningDiscussions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    topic: { type: 'string', description: 'Discussion topic (e.g., "Advance directive", "Dialysis modality preferences")' },
                    status: { type: 'string', description: 'Initiated, completed, scheduled' },
                    outcome: { type: 'string', description: 'Discussion outcome or patient preferences' }
                  }
                },
                description: 'Care planning discussions (advance directives, goals of care, etc)'
              },
              treatmentTargets: {
                type: 'object',
                properties: {
                  bloodPressure: { type: 'string', description: 'BP target (e.g., "<130/80 mmHg")' },
                  hemoglobin: { type: 'string', description: 'Hgb target (e.g., "10-11 g/dL")' },
                  pth: { type: 'string', description: 'PTH target (e.g., "150-300 pg/mL for CKD stage")' },
                  co2: { type: 'string', description: 'Serum CO2 target (e.g., "22-24 mEq/L")' },
                  glucose: { type: 'string', description: 'Glucose target range' },
                  hba1c: { type: 'string', description: 'HbA1c target' },
                  ldl: { type: 'string', description: 'LDL cholesterol target' },
                  weight: { type: 'string', description: 'Weight target or goal' },
                  proteinIntake: { type: 'string', description: 'Dietary protein target (e.g., "0.8g/kg/day")' },
                  sodiumIntake: { type: 'string', description: 'Sodium restriction target' },
                  exerciseGoal: { type: 'string', description: 'Exercise target (e.g., "150 minutes/week")' }
                },
                description: 'Specific treatment targets for various parameters'
              },
              barriersToCareCounseling: {
                type: 'object',
                properties: {
                  medicationCost: {
                    type: 'object',
                    properties: {
                      interventions: { type: 'array', items: { type: 'string' }, description: 'Interventions (e.g., "Patient assistance programs enrolled", "Samples provided for 1 month", "Generic alternatives when possible")' },
                      samplesProvided: { type: 'string', description: 'IMPORTANT: Medication samples provided (e.g., "Samples provided for 1 month"). Critical for medication reconciliation and follow-up planning.' }
                    },
                    description: 'Medication cost barrier interventions'
                  },
                  transportation: {
                    type: 'object',
                    properties: {
                      interventions: { type: 'array', items: { type: 'string' }, description: 'Transportation interventions (e.g., "Virtual visits when appropriate", "Coordinated with student health center")' }
                    },
                    description: 'Transportation barrier interventions'
                  },
                  housing: {
                    type: 'object',
                    properties: {
                      interventions: { type: 'array', items: { type: 'string' }, description: 'Housing interventions (e.g., "Documentation for disability accommodation", "Legal aid referral for tenant rights")' },
                      legalAidReferral: { type: 'boolean', description: 'IMPORTANT: Legal aid referral made for tenant rights or housing issues' }
                    },
                    description: 'Housing barrier interventions'
                  }
                },
                description: 'CRITICAL: Barriers to Care Addressed section - social determinants of health interventions. Essential for care coordination and health equity documentation.'
              },
              environmentalModifications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: { type: 'string', description: 'Category (e.g., "Housing intervention", "Allergen avoidance", "Air quality monitoring")' },
                    interventions: { type: 'array', items: { type: 'string' }, description: 'Specific interventions within category' }
                  }
                },
                description: 'IMPORTANT: Environmental modifications structured by category (Housing, Allergen avoidance, Air quality monitoring)'
              },
              documentationProvided: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    documentType: { type: 'string', description: 'Document type (e.g., "Academic accommodation letter", "Letter to landlord", "Medical documentation for housing accommodation", "HEPA filter prescription")' },
                    purpose: { type: 'string', description: 'Purpose (e.g., "missed classes and flexibility during exacerbations", "mold remediation", "disability accommodation")' }
                  }
                },
                description: 'CRITICAL: Medical documentation, letters, and prescriptions provided to patient. Important for care coordination and legal documentation.'
              },
              durableMedicalEquipment: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    equipment: { type: 'string', description: 'Equipment name (e.g., "HEPA filter", "Nebulizer", "Peak flow meter")' },
                    purpose: { type: 'string', description: 'Purpose (e.g., "for bedroom allergen reduction")' },
                    prescriptionProvided: { type: 'boolean', description: 'IMPORTANT: Whether prescription was provided' }
                  }
                },
                description: 'Durable medical equipment prescribed or recommended'
              },
              patientEducationInterventions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    intervention: { type: 'string', description: 'Education intervention (e.g., "Downloaded AQI app", "Inhaler technique training", "Asthma action plan review")' },
                    completedDuringVisit: { type: 'boolean', description: 'Whether intervention was completed during the visit' }
                  }
                },
                description: 'IMPORTANT: Patient education interventions, especially those completed during visit'
              },
              careCoordination: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    entity: { type: 'string', description: 'Coordinating entity (e.g., "Student health services", "Primary care physician", "Home health agency")' },
                    action: { type: 'string', description: 'Coordination action (e.g., "notified with permission", "care plan shared", "follow-up arranged")' },
                    purpose: { type: 'string', description: 'Purpose of coordination' }
                  }
                },
                description: 'IMPORTANT: Care coordination with other providers and services'
              },
              familyParticipation: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    familyMember: { type: 'string', description: 'Family member (e.g., "Mother", "Spouse", "Daughter")' },
                    participationType: { type: 'string', description: 'How they participated (e.g., "joined via phone for education portion", "present for discharge planning")' },
                    topics: { type: 'array', items: { type: 'string' }, description: 'Topics discussed with family' }
                  }
                },
                description: 'IMPORTANT: Family member participation in care and education. Clinically relevant for care planning.'
              },
              informedConsentDocumentation: {
                type: 'object',
                properties: {
                  medicationSideEffects: { type: 'string', description: 'IMPORTANT: Documentation that medication side effects were reviewed (e.g., "Side effects reviewed including retinal toxicity monitoring for hydroxychloroquine"). Important for informed consent.' },
                  medicationBenefits: { type: 'string', description: 'IMPORTANT: Documentation that benefits were discussed (e.g., "Discussed benefits: disease modification, reduced flares"). Part of informed consent process.' },
                  risksDiscussed: { type: 'array', items: { type: 'string' }, description: 'Specific risks discussed' },
                  alternativesDiscussed: { type: 'array', items: { type: 'string' }, description: 'Treatment alternatives discussed' }
                },
                description: 'CRITICAL: Informed consent documentation for treatments. Legal and ethical documentation.'
              },
              workAccommodations: {
                type: 'object',
                properties: {
                  concerns: { type: 'string', description: 'IMPORTANT: Patient concerns about work ability (e.g., "Concerned about ability to continue working", "Difficulty with prolonged standing")' },
                  accommodationsDiscussed: { type: 'array', items: { type: 'string' }, description: 'CRITICAL: Accommodations discussed (e.g., "FMLA if needed", "Modified duties", "Work from home options"). Important functional assessment.' },
                  letterProvided: { type: 'boolean', description: 'Whether work accommodation letter was provided' }
                },
                description: 'IMPORTANT: Work-related functional assessment and accommodation planning'
              },
              careCoordinationPlan: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    provider: { type: 'string', description: 'Provider to coordinate with (e.g., "PCP Dr. Williams", "Cardiologist", "Home health")' },
                    communicationPlan: { type: 'string', description: 'IMPORTANT: How coordination will occur (e.g., "Will communicate via EMR", "Will send summary letter", "Phone call planned")' },
                    informationToShare: { type: 'array', items: { type: 'string' }, description: 'Information to be shared in coordination' }
                  }
                },
                description: 'IMPORTANT: Care coordination documentation for continuity of care'
              }
            },
            description: 'Detailed treatment plan including conditional medications, procedures, interventions, and targets'
          },
          recommendations: {
            type: 'string',
            description: 'Medical recommendations or follow-up instructions'
          },
          // ========== CLINICAL SCORES & ASSESSMENTS ==========
          clinicalScores: {
            type: 'object',
            properties: {
              // Cardiovascular Scores
              CHA2DS2VASc: {
                type: 'object',
                properties: {
                  score: { type: 'number' },
                  components: { type: 'array', items: { type: 'string' } },
                  risk: { type: 'string' },
                  recommendation: { type: 'string' }
                }
              },
              HASBLED: {
                type: 'object',
                properties: {
                  score: { type: 'number' },
                  components: { type: 'array', items: { type: 'string' } },
                  risk: { type: 'string' }
                }
              },
              TIMI: { type: 'number' },
              GRACE: { type: 'number' },
              HEART: { type: 'number' },
              // Respiratory Scores
              CURB65: { type: 'number' },
              PESI: { type: 'number' },
              // Liver Scores
              MELD: { type: 'number' },
              ChildPugh: { type: 'string' },
              // Renal
              eGFR: { type: 'number' },
              CKDStage: { type: 'string' },
              // Mental Health
              PHQ9: { type: 'number' },
              GAD7: { type: 'number' },
              MMSE: { type: 'number' },
              // Pain
              painScale: { type: 'number' },
              // Functional
              ECOG: { type: 'number' },
              Karnofsky: { type: 'number' },
              MOCA: { type: 'number' },
              // Anesthesia Scores
              ASA: {
                type: 'object',
                properties: {
                  score: { type: 'number', description: 'ASA physical status (1-6)' },
                  interpretation: { type: 'string', description: 'e.g., severe systemic disease' }
                }
              },
              STOPBANG: {
                type: 'object',
                properties: {
                  score: { type: 'number' },
                  denominator: { type: 'number', description: 'Total possible score (8)' },
                  interpretation: { type: 'string', description: 'e.g., High Risk OSA' },
                  components: { type: 'array', items: { type: 'string' } }
                }
              },
              Apfel: {
                type: 'object',
                properties: {
                  score: { type: 'number' },
                  denominator: { type: 'number', description: 'Total possible score (4)' },
                  interpretation: { type: 'string', description: 'e.g., moderate risk' },
                  components: { type: 'array', items: { type: 'string' } }
                }
              },
              RCRI: {
                type: 'object',
                properties: {
                  score: { type: 'number' },
                  interpretation: { type: 'string', description: 'e.g., intermediate risk' },
                  riskFactors: { type: 'array', items: { type: 'string' } }
                }
              },
              NSQIP: {
                type: 'object',
                properties: {
                  seriousComplication: { type: 'string', description: 'Percentage (e.g., 4.8%)' },
                  anyComplication: { type: 'string', description: 'Percentage (e.g., 8.2%)' },
                  pneumonia: { type: 'string', description: 'Percentage (e.g., 1.2%)' },
                  cardiac: { type: 'string', description: 'Percentage (e.g., 0.8%)' },
                  vte: { type: 'string', description: 'Percentage (e.g., 2.1%)' },
                  mortality: { type: 'string', description: 'Percentage if provided' },
                  ssi: { type: 'string', description: 'Surgical site infection percentage' },
                  uti: { type: 'string', description: 'UTI percentage' },
                  renalFailure: { type: 'string', description: 'Renal failure percentage' }
                },
                description: 'NSQIP Risk Calculator scores'
              },
              // Other scores
              other: { type: 'object' }
            },
            description: 'ALL clinical scoring systems and assessments with detailed components'
          },

          // ========== HOSPITAL-SPECIFIC FIELDS ==========
          hospitalCourse: {
            type: 'object',
            properties: {
              admissionDate: { type: 'string' },
              dischargeDate: { type: 'string' },
              lengthOfStay: { type: 'number' },
              admittingDiagnosis: { type: 'string' },
              dischargeDiagnosis: { type: 'array', items: { type: 'string' } },
              dietaryInstructions: { type: 'string', description: 'Complete dietary guidance from discharge' },
              electronicSignature: { type: 'string', description: 'Electronic signature details with timestamp' },
              hospitalCourse: { type: 'string' },
              consultations: { type: 'array', items: { type: 'string' } },
              complications: { type: 'array', items: { type: 'string' } },
              condition: { type: 'string', description: 'stable, improved, critical' },
              disposition: { type: 'string', description: 'home, SNF, rehab, hospice' },
              dischargeInstructions: { type: 'string' },
              dietRestrictions: { type: 'string' },
              activityRestrictions: { type: 'string' },
              woundCare: { type: 'string' },
              equipment: { type: 'array', items: { type: 'string' } }
            }
          },

          // ========== TREATMENT COURSE ==========
          treatmentCourse: {
            type: 'object',
            properties: {
              ivMedications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    dose: { type: 'string' },
                    frequency: { type: 'string' },
                    duration: { type: 'string' },
                    route: { type: 'string', description: 'IV, IVPB, IV push' }
                  }
                },
                description: 'IV antibiotics, fluids, etc.'
              },
              oralMedications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    dose: { type: 'string' },
                    frequency: { type: 'string' },
                    duration: { type: 'string' },
                    route: { type: 'string', description: 'PO, sublingual, buccal' }
                  }
                },
                description: 'Oral medications given'
              },
              medications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    dose: { type: 'string' },
                    frequency: { type: 'string' },
                    duration: { type: 'string' },
                    route: { type: 'string' }
                  }
                },
                description: 'All medications regardless of route'
              },
              oxygenTherapy: {
                type: 'object',
                properties: {
                  method: { type: 'string', description: 'nasal cannula, face mask, BiPAP, ventilator' },
                  flowRate: { type: 'string' },
                  fiO2: { type: 'string' },
                  targetSaturation: { type: 'string' },
                  duration: { type: 'string' }
                }
              },
              nebulizers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    frequency: { type: 'string' },
                    prn: { type: 'boolean' }
                  }
                }
              },
              physicalTherapy: { type: 'string' },
              occupationalTherapy: { type: 'string' },
              speechTherapy: { type: 'string' },
              respiratoryTherapy: { type: 'string' },
              dialysis: { type: 'string' },
              transfusions: { type: 'array', items: { type: 'string' } },
              procedures: { type: 'array', items: { type: 'string' } },
              monitoring: {
                type: 'object',
                properties: {
                  telemetry: { type: 'boolean' },
                  icuLevel: { type: 'string' },
                  duration: { type: 'string' },
                  parameters: { type: 'array', items: { type: 'string' } }
                }
              },
              cardiacInterventions: {
                type: 'object',
                properties: {
                  doorToBalloonTime: { type: 'string' },
                  timiFlow: { type: 'string' },
                  stentDetails: { type: 'array', items: { type: 'string' } }
                }
              }
            },
            description: 'Complete in-hospital treatment details'
          },

          // ========== PATIENT EDUCATION ==========
          patientEducation: {
            type: 'object',
            properties: {
              topics: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    topic: { type: 'string', description: 'Education topic with context (e.g., "Nature of atrial fibrillation explained to the patient", "Inhaler technique demonstrated to patient")' },
                    details: { type: 'string', description: 'What was taught' },
                    understanding: { type: 'string', description: 'Patient understanding level' },
                    materials: { type: 'string', description: 'CRITICAL: List the specific handouts/resources provided for THIS SPECIFIC TOPIC (e.g., "Anaphylaxis action plan, EpiPen trainer guide" for anaphylaxis education topic). Match resources to topics - do NOT list all resources for every topic.' },
                    advanceDirectiveStatus: { type: 'string', description: 'Status of advance directive discussion (e.g., "initiated", "completed", "declined")' },
                    advanceDirectiveDetails: { type: 'string', description: 'What was discussed in advance directive conversation (e.g., "Discussed code status preferences", "Patient wants full code")' },
                    importanceOfBPAndGlucoseControl: { type: 'boolean' },
                    medicationComplianceEmphasized: { type: 'boolean' }
                  }
                },
                description: 'Individual education topics provided'
              },
              resourcesProvided: {
                type: 'array',
                items: { type: 'string' },
                description: 'OPTIONAL: Complete list of ALL educational materials/packets/resources provided to patient (e.g., ["ADHD parent information packet", "Behavioral management strategies handout", "School accommodation request forms"]). This is a summary field - prefer using topic-specific materials field instead. Important for continuity of care and documentation.'
              }
            },
            description: 'ALL patient education topics and resources provided with numbered structure if present'
          },

          // ========== FOLLOW-UP PLAN ==========
          followUpPlan: {
            type: 'object',
            properties: {
              labs: { type: 'object', properties: {
                beforeEachVisit: { type: 'boolean', description: 'Whether labs are required before each appointment' },
                frequency: { type: 'string', description: 'Lab monitoring frequency (e.g., "Monthly", "Every 3 months")' },
                nextDue: { type: 'string', description: 'When next labs are due' }
              }},
              urine: { type: 'object', properties: {
                UACREvery3Months: { type: 'boolean', description: 'UACR monitoring every 3 months' },
                frequency: { type: 'string', description: 'Urine test frequency' }
              }},
              dietitian: { type: 'object', properties: {
                nextWeek: { type: 'boolean', description: 'Dietitian appointment scheduled for next week' },
                scheduled: { type: 'boolean', description: 'Whether dietitian appointment is scheduled' },
                timing: { type: 'string', description: 'When dietitian appointment is scheduled (e.g., "Next week", "2 weeks")' }
              }},
              nephrology: { type: 'object', properties: {
                frequency: { type: 'string', description: 'Nephrology follow-up frequency' },
                nextAppointment: { type: 'string', description: 'Next nephrology appointment date/timing' }
              }},
              otherSpecialties: { type: 'array', items: {
                type: 'object',
                properties: {
                  specialty: { type: 'string' },
                  timing: { type: 'string' },
                  reason: { type: 'string' }
                }
              }}
            },
            description: 'Structured follow-up plan with specific timings for labs, appointments, and monitoring'
          },

          // ========== ADMINISTRATIVE DATA ==========
          administrativeData: {
            type: 'object',
            properties: {
              mrn: { type: 'string', description: 'Medical Record Number' },
              accountNumber: { type: 'string' },
              insurance: { type: 'string' },
              primaryCareProvider: { type: 'string', description: 'Primary care provider name with credentials (e.g., "Dr. Sarah Johnson, MD")' },
              emergencyContact: { type: 'string' },
              codeStatus: { type: 'string', description: 'Full code, DNR, DNI' },
              advancedDirectives: { type: 'boolean' },
              powerOfAttorney: { type: 'string' },
              admissionDate: { type: 'string', description: 'YYYY-MM-DD format' },
              dischargeDate: { type: 'string', description: 'YYYY-MM-DD format' },
              lengthOfStay: { type: 'number' },
              disposition: { type: 'string', description: 'Home, SNF, Rehab, etc.' },
              conditionAtDischarge: { type: 'string', description: 'Stable, Improved, Unstable' },
              admittingDiagnosis: { type: 'string', description: 'Initial diagnosis on admission' },
              dietaryInstructions: { type: 'string', description: 'Complete dietary guidance' },
              electronicSignature: { type: 'string', description: 'Electronic signature with timestamp' },
              electronicSignatureFull: { type: 'string', description: 'IMPORTANT: Complete electronic signature line (e.g., "Electronically signed by: Richard Chen, MD, FACS Thoracic Surgery January 26, 2025 15:30"). Full signature with credentials, specialty, date and time.' },
              facilityName: { type: 'string', description: 'IMPORTANT: Facility name as distinct field (e.g., "Boston Respiratory and Allergy Center", "Yale New Haven Hospital"). Extract from "Facility:" header or address block.' },
              facilityAddress: { type: 'string', description: 'Complete facility address' },
              consultingPhysician: { type: 'string', description: 'IMPORTANT FOR CONSULTATIONS: Consulting/attending physician name with full credentials (e.g., "Dr. Robert Chen, MD, PhD"). Extract from signature line or consultation header.' },
              consultingSpecialty: { type: 'string', description: 'IMPORTANT FOR CONSULTATIONS: Consulting physician specialty (e.g., "Allergy & Clinical Immunology", "Cardiology"). Extract from signature line or header.' },
              referringPhysician: { type: 'string', description: 'IMPORTANT FOR CONSULTATIONS: Referring physician name (e.g., "Dr. Sarah Johnson"). Extract from "Referred by:" or consultation request section.' },
              referringSpecialty: { type: 'string', description: 'Referring physician specialty (e.g., "Family Medicine", "Internal Medicine")' },
              consultDate: { type: 'string', description: 'IMPORTANT FOR CONSULTATIONS: Consultation date in YYYY-MM-DD format. Extract from document header or consultation details.' },
              reasonForConsult: { type: 'string', description: 'IMPORTANT FOR CONSULTATIONS: Reason for consultation (e.g., "Severe multiple allergies, recurrent anaphylaxis, and poorly controlled asthma")' }
            }
          },

          // ========== SPECIALTY-SPECIFIC FIELDS ==========
          specialtyFields: {
            type: 'object',
            properties: {
              // Cardiology
              cardiology: {
                type: 'object',
                properties: {
                  ecgFindings: {
                    type: 'object',
                    properties: {
                      rhythm: { type: 'string' },
                      rate: { type: 'number' },
                      pr: { type: 'number' },
                      qrs: { type: 'number' },
                      qt: { type: 'number' },
                      qtc: { type: 'number' },
                      axis: { type: 'string' },
                      stChanges: { type: 'string' },
                      tWaveChanges: { type: 'string' }
                    }
                  },
                  echoFindings: {
                    type: 'object',
                    properties: {
                      ef: { type: 'string' },
                      lvDimensions: { type: 'object' },
                      rwma: { type: 'string' },
                      valves: { type: 'object' },
                      diastolic: { type: 'string' }
                    }
                  },
                  cathFindings: {
                    type: 'object',
                    properties: {
                      vessels: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            vessel: { type: 'string' },
                            stenosis: { type: 'string' },
                            intervention: { type: 'string' },
                            result: { type: 'string' }
                          }
                        }
                      },
                      interventions: { type: 'array', items: { type: 'string' } },
                      hemodynamics: { type: 'object' },
                      doorToBalloonTime: { type: 'string' },
                      timiFlow: { type: 'string' },
                      complications: { type: 'array', items: { type: 'string' } }
                    }
                  },
                  biomarkers: {
                    type: 'object',
                    properties: {
                      troponin: { type: 'array', items: { type: 'object' } },
                      bnp: { type: 'string' },
                      ckmb: { type: 'string' }
                    }
                  },
                  killipClass: { type: 'string' }
                }
              },
              // Oncology
              oncology: {
                type: 'object',
                properties: {
                  staging: { type: 'string', description: 'TNM staging' },
                  grade: { type: 'string' },
                  markers: { type: 'array', items: { type: 'object' } },
                  chemotherapy: { type: 'array', items: { type: 'object' } },
                  radiation: { type: 'object' },
                  performanceStatus: { type: 'string' }
                }
              },
              // Neurology
              neurology: {
                type: 'object',
                properties: {
                  nihss: { type: 'number' },
                  gcs: { type: 'string' },
                  reflexes: { type: 'object' },
                  cranialNerves: { type: 'object' }
                }
              },
              // Psychiatry
              psychiatry: {
                type: 'object',
                properties: {
                  mse: { type: 'object' },
                  suicidalIdeation: { type: 'string' },
                  homicidalIdeation: { type: 'string' },
                  psychosis: { type: 'string' }
                }
              },
              // Pediatrics
              pediatrics: {
                type: 'object',
                properties: {
                  growthPercentiles: { type: 'object' },
                  developmentalMilestones: { type: 'array', items: { type: 'string' } },
                  immunizations: { type: 'array', items: { type: 'object' } },
                  newbornScreening: { type: 'object' }
                }
              },
              // OB/GYN
              obstetrics: {
                type: 'object',
                properties: {
                  gestationalAge: { type: 'string' },
                  edd: { type: 'string' },
                  gravida: { type: 'number' },
                  para: { type: 'number' },
                  prenatalLabs: { type: 'array', items: { type: 'object' } },
                  fetalHeart: { type: 'string' },
                  fundal: { type: 'string' }
                }
              }
            }
          },

          // ========== PSYCHOSOCIAL & FAMILY ==========
          psychosocialAssessment: {
            type: 'object',
            properties: {
              stressFactors: { type: 'array', items: { type: 'string' } },
              copingMechanisms: { type: 'array', items: { type: 'string' } },
              supportSystem: { type: 'string' },
              mentalHealthConcerns: { type: 'array', items: { type: 'string' } },
              substanceUse: { type: 'object' },
              employmentImpact: { type: 'string' },
              financialConcerns: { type: 'string' },
              consultations: { type: 'array', items: { type: 'string' } }
            }
          },

          familyMeetingNotes: {
            type: 'object',
            properties: {
              attendees: { type: 'array', items: { type: 'string' } },
              discussionPoints: { type: 'array', items: { type: 'string' } },
              familyConcerns: { type: 'array', items: { type: 'string' } },
              decisions: { type: 'array', items: { type: 'string' } },
              supportNeeded: { type: 'string' }
            }
          },

          prognosis: {
            type: 'object',
            properties: {
              shortTerm: { type: 'string' },
              longTerm: { type: 'string' },
              riskFactors: { type: 'array', items: { type: 'string' } },
              protectiveFactors: {
                type: 'array',
                items: { type: 'string' },
                description: 'IMPORTANT: Protective factors for prognosis (e.g., "strong motivation for recovery due to children", "good family support", "previous treatment response", "good insight")'
              },
              motivationFactors: { type: 'string', description: 'CRITICAL: Key motivating factors for recovery (e.g., "strong motivation for recovery due to children", "motivated by work responsibilities")' },
              previousTreatmentResponse: { type: 'string', description: 'IMPORTANT: Historical treatment response as prognostic indicator (e.g., "previous positive response to sertraline", "no prior treatment trials")' },
              insightLevel: { type: 'string', description: 'IMPORTANT: Patient insight as prognostic factor (e.g., "good insight", "limited insight", "poor insight")' },
              mortality: { type: 'string' },
              functionalStatus: { type: 'string' }
            }
          },

          // ========== REFERRALS ==========
          referrals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                specialty: { type: 'string', description: 'Specialty referred to (e.g., "Behavioral Health", "Endocrinology", "Cardiology")' },
                reason: { type: 'string', description: 'Reason for referral' },
                urgency: { type: 'string', description: 'Urgent, routine, follow-up' },
                status: { type: 'string', description: 'Status of referral: "planned" (plan to refer mentioned), "referred" (referral actually made/sent), "scheduled" (appointment scheduled), "completed" (patient seen)' },
                provider: { type: 'string', description: 'Specific provider name if mentioned' },
                notes: { type: 'string', description: 'Additional referral notes' }
              }
            },
            description: 'IMPORTANT: All specialty referrals ordered or recommended. Include medical specialties (Cardiology, Endocrinology, etc.) AND non-medical referrals for social determinants of health (Legal aid for tenant rights, Social work, Housing assistance, etc.)'
          },

          qualityAssurance: {
            type: 'object',
            properties: {
              outsideConsultationRecommendation: {
                type: 'object',
                properties: {
                  recommended: { type: 'boolean', description: 'Whether outside consultation is recommended' },
                  institution: { type: 'string', description: 'Institution recommended for consultation (e.g., "National Cancer Institute")' },
                  reason: { type: 'string', description: 'Reason for outside consultation' },
                  specialty: { type: 'string', description: 'Specialty for consultation' }
                },
                description: 'Outside consultation recommendations for quality assurance'
              },
              peerReview: { type: 'string', description: 'Peer review status or notes' },
              qualityMetrics: { type: 'array', items: { type: 'string' }, description: 'Quality metrics or indicators' }
            },
            description: 'Quality assurance and consultation recommendations'
          },

          // ========== MEDICATION CHANGES ==========
          medicationChanges: {
            type: 'object',
            properties: {
              newMedications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string', description: 'Medication name' },
                    dose: { type: 'string', description: 'Dose with units' },
                    frequency: { type: 'string', description: 'Frequency (e.g., "TID", "weekly")' },
                    route: { type: 'string', description: 'Route (e.g., "PO", "SQ", "IV")' },
                    indication: { type: 'string', description: 'Reason for starting' },
                    duration: { type: 'string', description: 'Duration if specified (e.g., "x 8 weeks")' },
                    provider: { type: 'string', description: 'CRITICAL: Provider who prescribed this medication (e.g., "Dr. Robert Chen, MD, PhD")' }
                  }
                },
                description: 'New medications started during this consultation'
              },
              doseChanges: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    previousDose: { type: 'string', description: 'Previous dose' },
                    newDose: { type: 'string', description: 'New dose' },
                    reason: { type: 'string', description: 'Reason for change' },
                    conditional: { type: 'string', description: 'Conditions for change (e.g., "if tolerated")' }
                  }
                },
                description: 'Medication dose adjustments'
              },
              discontinuedMedications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    reason: { type: 'string', description: 'Reason for discontinuation' },
                    date: { type: 'string', description: 'Date discontinued if specified' }
                  }
                },
                description: 'Medications stopped during this consultation'
              }
            },
            description: 'All medication changes made during this consultation'
          },

          // ========== CARE TEAM ==========
          careTeam: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Provider name' },
                specialty: { type: 'string', description: 'Specialty or role (e.g., "Nephrology", "Primary Care", "Social Work")' },
                role: { type: 'string', description: 'Role in care (e.g., "Primary nephrology provider", "Referring PCP", "Care coordinator")' },
                contact: { type: 'string', description: 'Contact information if provided' }
              }
            },
            description: 'Complete care team including all providers involved in patient care'
          },

          // ========== ADVANCE CARE PLANNING ==========
          advanceCarePlanning: {
            type: 'object',
            properties: {
              advanceDirective: {
                type: 'object',
                properties: {
                  status: { type: 'string', description: 'Status (e.g., "Discussion initiated", "Completed", "Not addressed")' },
                  details: { type: 'string', description: 'Details of advance directive discussion' },
                  documentOnFile: { type: 'boolean', description: 'Whether document is on file' },
                  nextSteps: { type: 'string', description: 'Follow-up actions needed' }
                }
              },
              goalsOfCare: {
                type: 'string',
                description: 'Patient goals and preferences for care'
              },
              codeStatus: {
                type: 'string',
                description: 'Code status if discussed (e.g., "Full code", "DNR/DNI")'
              },
              discussionDate: {
                type: 'string',
                description: 'Date of advance care planning discussion'
              }
            },
            description: 'Advance care planning discussions and documentation'
          },

          // ========== ADDITIONAL COMPREHENSIVE FIELDS ==========
          additionalNotes: {
            type: 'string',
            description: 'Patient education, prognosis, provider signatures, referring physician, any other relevant information'
          },

          prognosisDiscussion: {
            type: 'object',
            properties: {
              patientUnderstandingButAnxious: { type: 'string', description: 'Patient emotional response and understanding' },
              providedEmotionalSupportAndResources: { type: 'boolean' },
              brotherVerySupportive: { type: 'string', description: 'Family support details' },
              familySupport: { type: 'string' },
              emphasizedProgressionCanBeSlowed: { type: 'boolean', description: 'Key counseling about disease management' },
              patientTearful: { type: 'boolean', description: 'Emotional state during discussion' },
              financialConcernsSignificant: { type: 'string', description: 'Financial concerns and interventions' },
              willNeedCloseMonitoring: { type: 'string', description: 'Clinical notes about ongoing care needs' }
            },
            description: 'Prognosis discussion and psychosocial notes'
          },

          // ========== HOME MONITORING ==========
          homeMonitoring: {
            type: 'object',
            properties: {
              bloodPressure: {
                type: 'object',
                properties: {
                  morningAverage: { type: 'string', description: 'ONLY if document explicitly separates morning readings. DO NOT split general "home readings" into morning/evening.' },
                  eveningAverage: { type: 'string', description: 'ONLY if document explicitly separates evening readings. DO NOT split general "home readings" into morning/evening.' },
                  overallAverage: { type: 'string', description: 'Use for general home BP readings that are not separated by time of day' },
                  frequency: { type: 'string' },
                  technique: { type: 'string' },
                  readings: { type: 'array', items: { type: 'object' } }
                }
              },
              bloodGlucose: {
                type: 'object',
                properties: {
                  fastingAverage: { type: 'string' },
                  postprandialAverage: { type: 'string' },
                  frequency: { type: 'string' },
                  readings: { type: 'array', items: { type: 'object' } }
                }
              },
              weight: {
                type: 'object',
                properties: {
                  trend: { type: 'string' },
                  changeAmount: { type: 'string' },
                  frequency: { type: 'string' }
                }
              },
              peakFlow: {
                type: 'object',
                properties: {
                  average: { type: 'string' },
                  best: { type: 'string' },
                  frequency: { type: 'string' }
                }
              }
            },
            description: 'Patient-reported home monitoring data'
          },

          // ========== MEDICATION SAFETY ==========
          medicationSafety: {
            type: 'object',
            properties: {
              avoidMedications: { type: 'array', items: {
                type: 'object',
                properties: {
                  medication: { type: 'string', description: 'e.g., "NSAIDs"' },
                  severity: { type: 'string', description: 'e.g., "absolutely", "critical", "warning"' },
                  reason: { type: 'string', description: 'e.g., "Worsens renal function"' }
                }
              }},
              contrastRestrictions: { type: 'object', properties: {
                restricted: { type: 'boolean' },
                requiresApproval: { type: 'boolean' },
                approvalRequired: { type: 'string', description: 'Who must approve (e.g., "nephrology")' },
                reason: { type: 'string' }
              }},
              renalDosingReview: { type: 'object', properties: {
                required: { type: 'boolean' },
                frequency: { type: 'string' },
                monitoring: { type: 'string' }
              }},
              drugInteractionMonitoring: { type: 'object', properties: {
                required: { type: 'boolean' },
                rationale: { type: 'string' },
                monitoringPlan: { type: 'string' }
              }}
            },
            description: 'Critical medication safety instructions and restrictions'
          },

          // ========== MEDICATION RECONCILIATION ==========
          medicationReconciliation: {
            type: 'object',
            properties: {
              medicationsAdded: { type: 'array', items: { type: 'object' } },
              medicationsDiscontinued: { type: 'array', items: { type: 'object' } },
              medicationsContinued: { type: 'array', items: { type: 'object' } },
              medicationsChanged: { type: 'array', items: { type: 'object' } },
              drugInteractions: { type: 'array', items: { type: 'string' } },
              reconciliationDate: { type: 'string' },
              reconciliationBy: { type: 'string' }
            },
            description: 'Medication changes and reconciliation at this visit'
          },

          supplementationPlans: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                supplement: { type: 'string', description: 'Name of supplement (e.g., Iron, Vitamin D)' },
                condition: { type: 'string', description: 'Condition for starting (e.g., pending CBC results)' },
                dosage: { type: 'string', description: 'Planned dosage if started' },
                reasoning: { type: 'string', description: 'Clinical reasoning' }
              }
            },
            description: 'Conditional or planned supplementation pending test results'
          },

          // ========== TREND ANALYSIS ==========
          trendAnalysis: {
            type: 'object',
            properties: {
              labTrends: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    test: { type: 'string' },
                    currentValue: { type: 'string' },
                    previousValue: { type: 'string' },
                    trend: { type: 'string', description: 'improved, worsening, stable' },
                    percentChange: { type: 'string' }
                  }
                }
              },
              vitalTrends: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    parameter: { type: 'string' },
                    currentValue: { type: 'string' },
                    previousValue: { type: 'string' },
                    trend: { type: 'string' }
                  }
                }
              },
              weightTrend: {
                type: 'object',
                properties: {
                  currentWeight: { type: 'string' },
                  previousWeight: { type: 'string' },
                  changeAmount: { type: 'string' },
                  changePercent: { type: 'string' },
                  timeframe: { type: 'string' }
                }
              }
            },
            description: 'Comparison and trend analysis between visits'
          },

          // ========== EMERGENCY INFORMATION ==========
          emergencyInformation: {
            type: 'object',
            properties: {
              emergencyContacts: { type: 'array', items: { type: 'object' } },
              officePhone: { type: 'string' },
              afterHoursPhone: { type: 'string' },
              warningCriteria: { type: 'array', items: { type: 'string' } },
              whenToCall: { type: 'array', items: { type: 'string' } }
            },
            description: 'Emergency contact information and warning signs'
          },

          // ========== EMERGENCY DEPARTMENT SPECIFIC ==========
          triageData: {
            type: 'object',
            properties: {
              arrivalTime: { type: 'string' },
              triageTime: { type: 'string' },
              esiLevel: { type: 'string', description: 'Emergency Severity Index level (1-5)' },
              chiefComplaint: { type: 'string' },
              modeOfArrival: { type: 'string', description: 'Walk-in, ambulance, private vehicle' },
              triageVitals: { type: 'object', properties: {
                bloodPressure: { type: 'string' },
                heartRate: { type: 'string' },
                temperature: { type: 'string' },
                respiratoryRate: { type: 'string' },
                oxygenSaturation: { type: 'string' },
                painScale: { type: 'string' }
              }},
              triageAssessment: { type: 'string' },
              triageNurse: { type: 'string' }
            },
            description: 'Emergency department triage information'
          },

          edCourse: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                time: { type: 'string' },
                event: { type: 'string' },
                provider: { type: 'string' },
                details: { type: 'string' }
              }
            },
            description: 'Timeline of events during ED stay'
          },

          consultationTimeline: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                specialty: { type: 'string' },
                requestedTime: { type: 'string' },
                responseTime: { type: 'string' },
                consultant: { type: 'string' },
                recommendations: { type: 'string' }
              }
            },
            description: 'Consultation requests and response times'
          },

          preOperativePreparation: {
            type: 'object',
            properties: {
              npoStatus: { type: 'string', description: 'NPO since time' },
              ivAccess: { type: 'array', items: { type: 'string' } },
              antibiotics: { type: 'array', items: { type: 'object' } },
              perioperativeMedications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    dose: { type: 'string' },
                    route: { type: 'string' },
                    timing: { type: 'string' }
                  }
                },
                description: 'All perioperative medications (e.g., Metoclopramide 10mg IV, Famotidine 20mg IV)'
              },
              bloodProductsOrdered: { type: 'string', description: 'Type and crossmatch details (e.g., "Type and crossmatch 2 units PRBCs")' },
              consent: { type: 'object', properties: {
                procedure: { type: 'string' },
                obtainedBy: { type: 'string' },
                time: { type: 'string' }
              }},
              anesthesiaConsult: { type: 'object' },
              labsOrdered: { type: 'array', items: { type: 'string' } },
              imagingOrdered: { type: 'array', items: { type: 'string' } }
            },
            description: 'Pre-operative preparation in ED'
          },

          edDisposition: {
            type: 'object',
            properties: {
              decision: { type: 'string', description: 'Admit, discharge, transfer, OR' },
              decisionTime: { type: 'string' },
              admittingService: { type: 'string' },
              admittingAttending: { type: 'string' },
              bedRequest: { type: 'string' },
              bedAssigned: { type: 'string' },
              transferTime: { type: 'string' },
              dischargeInstructions: { type: 'object' },
              followUpRequired: { type: 'array', items: { type: 'string' } }
            },
            description: 'ED disposition and transfer details'
          },

          painManagement: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                time: { type: 'string' },
                painScore: { type: 'string' },
                intervention: { type: 'string' },
                medication: { type: 'string' },
                dose: { type: 'string' },
                route: { type: 'string' },
                response: { type: 'string' }
              }
            },
            description: 'Pain assessment and management timeline'
          },

          // ========== TRAUMA & INJURY SPECIFIC ==========
          injuryDetails: {
            type: 'object',
            properties: {
              mechanism: { type: 'string', description: 'Fall, MVC, assault, etc.' },
              timeOfInjury: { type: 'string' },
              locationOfIncident: { type: 'string' },
              speed: { type: 'string', description: 'For MVCs' },
              height: { type: 'string', description: 'For falls' },
              protectiveEquipment: { type: 'array', items: { type: 'string' } },
              lossOfConsciousness: { type: 'boolean' },
              ambulanceArrival: { type: 'string' },
              fieldTreatment: { type: 'array', items: { type: 'string' } }
            },
            description: 'Trauma mechanism and circumstances'
          },

          orthopedicAssessment: {
            type: 'object',
            properties: {
              fractures: { type: 'array', items: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                  type: { type: 'string', description: 'Comminuted, displaced, etc.' },
                  classification: { type: 'string' },
                  angulation: { type: 'string' },
                  displacement: { type: 'string' }
                }
              }},
              dislocations: { type: 'array', items: { type: 'object' } },
              neurovascularStatus: { type: 'object', properties: {
                pulses: { type: 'string' },
                sensation: { type: 'string' },
                motor: { type: 'string' },
                capillaryRefill: { type: 'string' }
              }},
              compartmentSyndrome: { type: 'object' },
              skinIntegrity: { type: 'string' }
            },
            description: 'Orthopedic injury assessment'
          },

          proceduralSedation: {
            type: 'object',
            properties: {
              indication: { type: 'string' },
              medications: { type: 'array', items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  dose: { type: 'string' },
                  route: { type: 'string' },
                  time: { type: 'string' }
                }
              }},
              monitoring: { type: 'object', properties: {
                preVitals: { type: 'object' },
                intraVitals: { type: 'array', items: { type: 'object' } },
                postVitals: { type: 'object' }
              }},
              provider: { type: 'string' },
              complications: { type: 'array', items: { type: 'string' } },
              recoveryTime: { type: 'string' }
            },
            description: 'Conscious/procedural sedation record'
          },

          orthopedicProcedures: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                procedure: { type: 'string', description: 'Reduction, splinting, etc.' },
                technique: { type: 'string' },
                anesthesia: { type: 'string', description: 'Hematoma block, regional, etc.' },
                provider: { type: 'string' },
                time: { type: 'string' },
                postProcedureImaging: { type: 'object', properties: {
                  study: { type: 'string' },
                  findings: { type: 'string' },
                  adequateReduction: { type: 'boolean' }
                }},
                immobilization: { type: 'string', description: 'Type of splint/cast' },
                complications: { type: 'array', items: { type: 'string' } }
              }
            },
            description: 'Orthopedic procedures performed'
          },

          workRestrictions: {
            type: 'object',
            properties: {
              returnToWork: { type: 'string' },
              restrictions: { type: 'array', items: { type: 'string' } },
              liftingLimit: { type: 'string' },
              duration: { type: 'string' },
              clearanceRequired: { type: 'boolean' },
              modifiedDuty: { type: 'object' }
            },
            description: 'Work and activity restrictions'
          },

          // ========== DIABETES MANAGEMENT SPECIFIC ==========
          diabetesManagement: {
            type: 'object',
            properties: {
              diabetesType: { type: 'string', description: 'Type 1, Type 2, LADA, gestational' },
              dateOfDiagnosis: { type: 'string' },
              duration: { type: 'string' },
              currentHbA1c: { type: 'string' },
              previousHbA1c: { type: 'string' },
              cPeptide: { type: 'string' },
              antibodies: { type: 'array', items: { type: 'string' } },
              medicationAdjustments: { type: 'array', items: {
                type: 'object',
                properties: {
                  medication: { type: 'string', description: 'e.g., "Insulin", "GLP-1 agonist"' },
                  adjustment: { type: 'string', description: 'e.g., "Adjust for renal clearance", "Transition to GLP-1 agonist"' },
                  reason: { type: 'string' }
                }
              }},
              cgmIndication: { type: 'string', description: 'Specific indication for CGM (e.g., "hypoglycemia monitoring")' },
              adjustInsulinForRenalClearance: { type: 'boolean', description: 'Whether insulin dosing needs adjustment for renal impairment' },
              endocrinologyCoManagement: { type: 'boolean', description: 'Whether co-management with endocrinology is planned' },
              coManagement: { type: 'array', items: { type: 'string' }, description: 'Co-management plans (e.g., "Endocrinology co-management")' },
              complications: { type: 'object', properties: {
                retinopathy: { type: 'string', description: 'ONLY if explicitly documented - DO NOT use "none noted" as default' },
                nephropathy: { type: 'string', description: 'ONLY if explicitly documented - DO NOT use "none noted" as default' },
                neuropathy: { type: 'string', description: 'ONLY if explicitly documented - DO NOT use "none noted" as default' },
                cardiovascular: { type: 'string', description: 'ONLY if explicitly documented - DO NOT use "none noted" as default' }
              }}
            },
            description: 'Diabetes diagnosis and complication status'
          },

          insulinPumpSettings: {
            type: 'object',
            properties: {
              pumpModel: { type: 'string' },
              basalRates: { type: 'array', items: {
                type: 'object',
                properties: {
                  timeRange: { type: 'string' },
                  rate: { type: 'string', description: 'units/hour' }
                }
              }},
              totalBasal: { type: 'string' },
              carbRatios: { type: 'array', items: {
                type: 'object',
                properties: {
                  time: { type: 'string' },
                  ratio: { type: 'string', description: '1:X grams' }
                }
              }},
              correctionFactor: { type: 'string', description: '1:X mg/dL' },
              targetGlucose: { type: 'string' },
              activeInsulinTime: { type: 'string' },
              maxBolus: { type: 'string' },
              maxBasalRate: { type: 'string' }
            },
            description: 'Insulin pump configuration and settings'
          },

          cgmData: {
            type: 'object',
            properties: {
              deviceType: { type: 'string' },
              averageGlucose: { type: 'string' },
              gmi: { type: 'string', description: 'Glucose Management Indicator' },
              timeInRange: { type: 'string', description: 'Percentage 70-180 mg/dL' },
              timeBelowRange: { type: 'string', description: 'Percentage <70 mg/dL' },
              timeAboveRange: { type: 'string', description: 'Percentage >180 mg/dL' },
              coefficientOfVariation: { type: 'string' },
              readingsPerDay: { type: 'string' },
              sensorWearTime: { type: 'string' },
              dataPeriod: { type: 'string' }
            },
            description: 'Continuous glucose monitor metrics'
          },

          insulinRegimen: {
            type: 'object',
            properties: {
              regimeType: { type: 'string', description: 'MDI, pump, hybrid' },
              basalInsulin: { type: 'object', properties: {
                type: { type: 'string' },
                dose: { type: 'string' },
                timing: { type: 'string' }
              }},
              bolusInsulin: { type: 'object', properties: {
                type: { type: 'string' },
                mealDoses: { type: 'array', items: { type: 'object' } },
                correctionDoses: { type: 'string' }
              }},
              totalDailyDose: { type: 'string' },
              basalBolusRatio: { type: 'string' },
              bolusesPerDay: { type: 'string' }
            },
            description: 'Complete insulin therapy details'
          },

          diabetesEducation: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topic: { type: 'string' },
                dateProvided: { type: 'string' },
                educator: { type: 'string' },
                patientDemonstration: { type: 'boolean' },
                materials: { type: 'array', items: { type: 'string' } }
              }
            },
            description: 'Diabetes education provided'
          },

          hypoglycemiaManagement: {
            type: 'object',
            properties: {
              frequency: { type: 'string' },
              severity: { type: 'string' },
              typicalRange: { type: 'string' },
              symptoms: { type: 'array', items: { type: 'string' } },
              treatmentMethod: { type: 'string' },
              glucagonPrescribed: { type: 'boolean' },
              glucagonTraining: { type: 'array', items: { type: 'string' } },
              unawareness: { type: 'boolean' }
            },
            description: 'Hypoglycemia patterns and management'
          },

          endocrineLabResults: {
            type: 'object',
            properties: {
              thyroid: { type: 'object', properties: {
                tsh: { type: 'string' },
                freeT4: { type: 'string' },
                freeT3: { type: 'string' },
                antibodies: { type: 'object' }
              }},
              reproductive: { type: 'object', properties: {
                testosterone: { type: 'string' },
                estradiol: { type: 'string' },
                fsh: { type: 'string' },
                lh: { type: 'string' }
              }},
              adrenal: { type: 'object', properties: {
                cortisol: { type: 'string' },
                acth: { type: 'string' }
              }},
              bone: { type: 'object', properties: {
                vitaminD: { type: 'string' },
                calcium: { type: 'string' },
                pth: { type: 'string' }
              }}
            },
            description: 'Endocrine-specific laboratory results'
          },

          preconceptionCounseling: {
            type: 'object',
            properties: {
              planning: { type: 'boolean' },
              targetHbA1c: { type: 'string' },
              contraceptionDiscussed: { type: 'boolean' },
              medicationAdjustments: { type: 'array', items: { type: 'object' } },
              folicAcidDose: { type: 'string' },
              risksDiscussed: { type: 'array', items: { type: 'string' } },
              geneticCounseling: { type: 'boolean' }
            },
            description: 'Preconception planning for diabetes'
          },

          diabetesQualityMetrics: {
            type: 'object',
            properties: {
              eyeExamDate: { type: 'string' },
              footExamDate: { type: 'string' },
              dentalExamDate: { type: 'string' },
              microalbuminResult: { type: 'string' },
              lipidResults: { type: 'object' },
              bloodPressureControl: { type: 'string' },
              vaccinationsUpToDate: { type: 'boolean' },
              depressionScreening: { type: 'string' },
              smokingStatus: { type: 'string' }
            },
            description: 'Diabetes care quality indicators'
          },

          // ========== IBD/GASTROENTEROLOGY SPECIFIC ==========
          ibdAssessment: {
            type: 'object',
            properties: {
              diseaseType: { type: 'string', description: 'Ulcerative colitis, Crohns, indeterminate' },
              diseaseExtent: { type: 'string', description: 'Proctitis, left-sided, extensive, pancolitis' },
              diseaseLocation: { type: 'string', description: 'Ileal, colonic, ileocolonic, upper GI' },
              diseaseBehavior: { type: 'string', description: 'Inflammatory, stricturing, penetrating' },
              dateOfDiagnosis: { type: 'string' },
              currentFlare: { type: 'object', properties: {
                duration: { type: 'string' },
                severity: { type: 'string' },
                trigger: { type: 'string' }
              }},
              previousHospitalizations: { type: 'array', items: { type: 'string' } },
              previousSurgeries: { type: 'array', items: { type: 'string' } }
            },
            description: 'IBD diagnosis and disease characteristics'
          },

          diseaseActivityScores: {
            type: 'object',
            properties: {
              mayoScore: { type: 'object', properties: {
                stoolFrequency: { type: 'string' },
                rectalBleeding: { type: 'string' },
                endoscopicFindings: { type: 'string' },
                physicianAssessment: { type: 'string' },
                totalScore: { type: 'string' }
              }},
              harveyBradshaw: { type: 'object' },
              cdai: { type: 'object' },
              partialMayo: { type: 'object' },
              simpleClinicalColitisActivity: { type: 'object', description: 'Simple Clinical Colitis Activity Index' },
              pucai: { type: 'object', description: 'Pediatric UC Activity Index' }
            },
            description: 'IBD disease activity scoring systems'
          },

          endoscopyFindings: {
            type: 'object',
            properties: {
              procedureType: { type: 'string' },
              extent: { type: 'string' },
              mayoEndoscopicScore: { type: 'string' },
              rutgeerts: { type: 'string', description: 'Post-operative recurrence score' },
              findings: { type: 'array', items: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                  finding: { type: 'string' },
                  severity: { type: 'string' }
                }
              }},
              biopsies: { type: 'object', properties: {
                taken: { type: 'boolean' },
                number: { type: 'string' },
                locations: { type: 'array', items: { type: 'string' } }
              }},
              complications: { type: 'array', items: { type: 'string' } }
            },
            description: 'Endoscopic findings and scoring'
          },

          ibdBiomarkers: {
            type: 'object',
            properties: {
              fecalCalprotectin: { type: 'string' },
              fecalLactoferrin: { type: 'string' },
              crp: { type: 'string' },
              esr: { type: 'string' },
              albumin: { type: 'string' },
              hemoglobin: { type: 'string' },
              platelets: { type: 'string' },
              pANCA: { type: 'string' },
              ASCA: { type: 'string' }
            },
            description: 'IBD-specific laboratory biomarkers'
          },

          biologicTherapy: {
            type: 'object',
            properties: {
              currentBiologic: { type: 'string' },
              dose: { type: 'string' },
              frequency: { type: 'string' },
              lastDose: { type: 'string' },
              drugLevel: { type: 'string' },
              antibodies: { type: 'string' },
              previousBiologics: { type: 'array', items: {
                type: 'object',
                properties: {
                  drug: { type: 'string' },
                  reasonForStopping: { type: 'string' }
                }
              }},
              concomitantImmunosuppression: { type: 'string' },
              optimization: { type: 'object', properties: {
                doseEscalation: { type: 'boolean' },
                intervalShortening: { type: 'boolean' },
                switchPlan: { type: 'string' }
              }}
            },
            description: 'Biologic therapy details and monitoring'
          },

          extraintestinalManifestations: {
            type: 'object',
            properties: {
              articular: { type: 'array', items: { type: 'string' } },
              dermatologic: { type: 'array', items: { type: 'string' } },
              ocular: { type: 'array', items: { type: 'string' } },
              hepatobiliary: { type: 'array', items: { type: 'string' } },
              renal: { type: 'array', items: { type: 'string' } },
              pulmonary: { type: 'array', items: { type: 'string' } },
              hematologic: { type: 'array', items: { type: 'string' } }
            },
            description: 'Extraintestinal manifestations of IBD'
          },

          nutritionalAssessment: {
            type: 'object',
            properties: {
              bmi: { type: 'string' },
              weightChange: { type: 'string' },
              albumin: { type: 'string' },
              prealbumin: { type: 'string' },
              vitaminDeficiencies: { type: 'array', items: { type: 'object' } },
              mineralDeficiencies: { type: 'array', items: { type: 'object' } },
              nutritionalSupport: { type: 'string', description: 'Oral, enteral, parenteral' },
              dietaryRestrictions: { type: 'array', items: { type: 'string' } },
              malabsorption: { type: 'boolean' }
            },
            description: 'Nutritional status and support needs'
          },

          ibdSurgicalPlanning: {
            type: 'object',
            properties: {
              surgeryDiscussed: { type: 'boolean' },
              surgeryType: { type: 'string', description: 'Colectomy, resection, stricturoplasty' },
              urgency: { type: 'string', description: 'Elective, urgent, emergent' },
              indications: { type: 'array', items: { type: 'string' } },
              risks: { type: 'array', items: { type: 'string' } },
              pouchOption: { type: 'string', description: 'IPAA, end ileostomy' },
              patientPreference: { type: 'string' },
              consultationScheduled: { type: 'boolean' }
            },
            description: 'Surgical planning and discussions'
          },

          flareManagement: {
            type: 'object',
            properties: {
              currentFlareWeek: { type: 'string' },
              steroidResponse: { type: 'string', description: 'Responsive, dependent, refractory' },
              rescueTherapy: { type: 'array', items: { type: 'string' } },
              admissionCriteria: { type: 'array', items: { type: 'string' } },
              outpatientMonitoring: { type: 'object' },
              escalationPlan: { type: 'array', items: { type: 'string' } }
            },
            description: 'Acute flare management plan'
          },

          cancerSurveillance: {
            type: 'object',
            properties: {
              riskFactors: { type: 'array', items: { type: 'string' } },
              surveillanceInterval: { type: 'string' },
              lastColonoscopy: { type: 'string' },
              nextDue: { type: 'string' },
              chromoendoscopy: { type: 'boolean' },
              randomBiopsies: { type: 'boolean' },
              dysplasiaHistory: { type: 'array', items: { type: 'object' } }
            },
            description: 'Cancer surveillance protocol for IBD'
          },

          // ========== GERIATRIC ASSESSMENT SPECIFIC ==========
          functionalStatus: {
            type: 'object',
            properties: {
              adlScore: { type: 'string', description: 'Katz ADL score' },
              adlItems: { type: 'object', properties: {
                bathing: { type: 'string' },
                dressing: { type: 'string' },
                toileting: { type: 'string' },
                transferring: { type: 'string' },
                continence: { type: 'string' },
                feeding: { type: 'string' }
              }},
              iadlScore: { type: 'string', description: 'Lawton IADL score' },
              iadlItems: { type: 'object', properties: {
                telephone: { type: 'string' },
                shopping: { type: 'string' },
                foodPreparation: { type: 'string' },
                housekeeping: { type: 'string' },
                laundry: { type: 'string' },
                transportation: { type: 'string' },
                medications: { type: 'string' },
                finances: { type: 'string' }
              }},
              mobilityAids: { type: 'array', items: { type: 'string' } }
            },
            description: 'Activities of daily living and functional assessments'
          },

          geriatricCognitiveAssessment: {
            type: 'object',
            properties: {
              mmseScore: { type: 'string', description: 'Mini-Mental State Exam score' },
              mmseBreakdown: { type: 'object' },
              clockDrawing: { type: 'string' },
              cdrScore: { type: 'string', description: 'Clinical Dementia Rating' },
              mocaScore: { type: 'string', description: 'Montreal Cognitive Assessment' },
              behavioralSymptoms: { type: 'array', items: { type: 'string' } },
              sundowning: { type: 'boolean' },
              wandering: { type: 'boolean' },
              cognitivePattern: { type: 'string' }
            },
            description: 'Cognitive and memory assessments'
          },

          fallsRiskAssessment: {
            type: 'object',
            properties: {
              fallsHistory: { type: 'array', items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  location: { type: 'string' },
                  injury: { type: 'string' },
                  circumstances: { type: 'string' }
                }
              }},
              tugTest: { type: 'string', description: 'Timed Up and Go test result' },
              bergBalance: { type: 'string', description: 'Berg Balance Scale score' },
              chairStand: { type: 'string', description: '30-second chair stand test' },
              gaitSpeed: { type: 'string' },
              gaitPattern: { type: 'string' },
              fallRiskFactors: { type: 'array', items: { type: 'string' } },
              interventions: { type: 'array', items: { type: 'string' } }
            },
            description: 'Falls history and risk assessment'
          },

          polypharmacyReview: {
            type: 'object',
            properties: {
              totalMedications: { type: 'string' },
              beersCriteria: { type: 'array', items: { type: 'string' } },
              medicationsDiscontinued: { type: 'array', items: { type: 'object' } },
              medicationsModified: { type: 'array', items: { type: 'object' } },
              drugInteractions: { type: 'array', items: { type: 'string' } },
              adverseEffects: { type: 'array', items: { type: 'string' } },
              adherenceIssues: { type: 'array', items: { type: 'string' } },
              pillBurden: { type: 'string' }
            },
            description: 'Medication review and polypharmacy assessment'
          },

          geriatricNutritionalAssessment: {
            type: 'object',
            properties: {
              mnaScore: { type: 'string', description: 'Mini Nutritional Assessment' },
              bmi: { type: 'string' },
              weightChange: { type: 'string' },
              albumin: { type: 'string' },
              prealbumin: { type: 'string' },
              appetiteChanges: { type: 'string' },
              dysphagia: { type: 'boolean' },
              dietaryRestrictions: { type: 'array', items: { type: 'string' } },
              supplementation: { type: 'array', items: { type: 'string' } }
            },
            description: 'Nutritional status and malnutrition risk'
          },

          moodPsychologicalAssessment: {
            type: 'object',
            properties: {
              gdsScore: { type: 'string', description: 'Geriatric Depression Scale' },
              gadScore: { type: 'string', description: 'GAD-7 anxiety score' },
              phq9Score: { type: 'string' },
              sleepPattern: { type: 'object', properties: {
                hoursPerNight: { type: 'string' },
                nighttimeAwakenings: { type: 'string' },
                daytimeNapping: { type: 'string' },
                sleepQuality: { type: 'string' }
              }},
              socialIsolation: { type: 'string' },
              griefLoss: { type: 'array', items: { type: 'string' } }
            },
            description: 'Mood, anxiety, and psychological assessments'
          },

          socialFunctionalAssessment: {
            type: 'object',
            properties: {
              livingSituation: { type: 'string' },
              supportSystem: { type: 'object', properties: {
                primaryCaregiver: { type: 'string' },
                familyInvolvement: { type: 'string' },
                socialContacts: { type: 'string' }
              }},
              financialStatus: { type: 'string' },
              transportation: { type: 'string' },
              drivingStatus: { type: 'string' },
              socialActivities: { type: 'array', items: { type: 'string' } },
              communityResources: { type: 'array', items: { type: 'string' } }
            },
            description: 'Social support and living situation'
          },

          frailtyAssessment: {
            type: 'object',
            properties: {
              frailtyIndex: { type: 'string' },
              gripStrength: { type: 'string' },
              walkingSpeed: { type: 'string' },
              exhaustion: { type: 'string' },
              physicalActivity: { type: 'string' },
              unintentionalWeightLoss: { type: 'string' },
              clinicalFrailtyScale: { type: 'string' },
              sarcopenia: { type: 'boolean' }
            },
            description: 'Frailty syndrome assessment'
          },

          geriatricCarePlanning: {
            type: 'object',
            properties: {
              codeStatus: { type: 'string', description: 'DNR/DNI status' },
              advancedDirectives: { type: 'object', properties: {
                livingWill: { type: 'boolean' },
                healthcareProxy: { type: 'string' },
                powerOfAttorney: { type: 'string' }
              }},
              goalsOfCare: { type: 'array', items: { type: 'string' } },
              prognosisDiscussion: { type: 'string' },
              palliativeCareInvolvement: { type: 'boolean' },
              hospiceDiscussion: { type: 'boolean' },
              transitionPlanning: { type: 'string' }
            },
            description: 'Advanced directives and care planning'
          },

          caregiverAssessment: {
            type: 'object',
            properties: {
              primaryCaregiver: { type: 'string' },
              caregiverBurden: { type: 'string' },
              caregiverHealth: { type: 'string' },
              respiteNeeds: { type: 'boolean' },
              supportServices: { type: 'array', items: { type: 'string' } },
              educationProvided: { type: 'array', items: { type: 'string' } },
              financialStrain: { type: 'string' }
            },
            description: 'Caregiver burden and support needs'
          },

          // ========== ONCOLOGY/HEMATOLOGY SPECIFIC ==========
          cancerDiagnosis: {
            type: 'object',
            properties: {
              primarySite: { type: 'string' },
              histology: { type: 'string' },
              grade: { type: 'string' },
              tumorSize: { type: 'string', description: 'Tumor size in cm (e.g., "2.8 cm")' },
              lymphNodeStatus: { type: 'string', description: 'Lymph node status (e.g., "Sentinel lymph node biopsy (0/3 nodes positive)")' },
              dateOfDiagnosis: { type: 'string' },
              methodOfDiagnosis: { type: 'string' },
              biomarkers: { type: 'array', items: { type: 'object' } },
              geneticMutations: { type: 'array', items: { type: 'string' } },
              immunohistochemistry: { type: 'object' },
              surgicalClipsPlaced: { type: 'boolean', description: 'Whether surgical clips were placed for future imaging' },
              chemotherapyDecision: { type: 'string', description: 'Chemotherapy decision and rationale (e.g., "Not indicated based on Oncotype score")' }
            },
            description: 'Cancer diagnosis details and pathology'
          },

          cancerStaging: {
            type: 'object',
            properties: {
              tnmStaging: { type: 'object', properties: {
                t: { type: 'string' },
                n: { type: 'string' },
                m: { type: 'string' },
                overallStage: { type: 'string' }
              }},
              issStaging: { type: 'string', description: 'International Staging System for myeloma' },
              rissStaging: { type: 'string', description: 'Revised ISS' },
              durieSalmon: { type: 'string' },
              annArbor: { type: 'string', description: 'For lymphomas' },
              figo: { type: 'string', description: 'For gynecologic cancers' },
              otherStaging: {
                type: 'object',
                properties: {
                  IPIScore: {
                    type: 'object',
                    properties: {
                      summary: { type: 'string', description: 'IPI score summary (e.g., "Age <60, Stage IV, Elevated LDH presumed")' },
                      components: {
                        type: 'object',
                        properties: {
                          age: { type: 'string', description: 'Age component (e.g., "<60" or ">60")' },
                          stage: { type: 'string', description: 'Stage component (e.g., "Stage IV")' },
                          ldh: { type: 'string', description: 'LDH status (e.g., "Elevated", "Normal")' },
                          performanceStatus: { type: 'string', description: 'ECOG performance status if documented' },
                          extranodal: { type: 'string', description: 'Number of extranodal sites if documented' }
                        },
                        description: 'Individual IPI score components for risk stratification'
                      },
                      calculatedScore: { type: 'string', description: 'Calculated IPI score if available' },
                      riskCategory: { type: 'string', description: 'Risk category (e.g., "High", "Intermediate", "Low")' }
                    },
                    description: 'International Prognostic Index for lymphoma'
                  },
                  cnsRiskAssessment: { type: 'string', description: 'CNS risk assessment and prophylaxis recommendations (e.g., "Requires CNS prophylaxis consideration")' }
                }
              }
            },
            description: 'Cancer staging systems with detailed IPI and CNS risk'
          },

          stagingSummary: {
            type: 'object',
            properties: {
              overallStage: { type: 'string', description: 'Overall cancer stage' },
              ipiScoreValue: { type: 'string', description: 'IPI score numerical value or note (e.g., "3", "High-risk", "IPI Score factors identified but not calculated")' },
              prognosticImplications: { type: 'string', description: 'Summary of prognostic implications from staging' },
              treatmentApproach: { type: 'string', description: 'Treatment approach based on staging' }
            },
            description: 'Staging summary and prognostic overview'
          },

          myelomaSpecificData: {
            type: 'object',
            properties: {
              crabCriteria: { type: 'object', properties: {
                calcium: { type: 'string' },
                renalInsufficiency: { type: 'string' },
                anemia: { type: 'string' },
                boneLesions: { type: 'string' }
              }},
              mSpike: { type: 'string' },
              lightChains: { type: 'object', properties: {
                kappa: { type: 'string' },
                lambda: { type: 'string' },
                ratio: { type: 'string' }
              }},
              beta2Microglobulin: { type: 'string' },
              plasmaCellPercentage: { type: 'string' },
              benceJonesProtein: { type: 'string' },
              immunofixation: { type: 'string' }
            },
            description: 'Multiple myeloma specific data'
          },

          chemotherapyRegimen: {
            type: 'object',
            properties: {
              regimenName: { type: 'string' },
              intent: { type: 'string', description: 'Curative, palliative, neoadjuvant, adjuvant' },
              drugs: { type: 'array', items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  dose: { type: 'string' },
                  route: { type: 'string' },
                  schedule: { type: 'string' },
                  daysGiven: { type: 'array', items: { type: 'string' } }
                }
              }},
              cycleLength: { type: 'string' },
              totalCycles: { type: 'string' },
              premedications: { type: 'array', items: { type: 'object' } },
              growthFactorSupport: { type: 'boolean' }
            },
            description: 'Chemotherapy treatment details'
          },

          radiationTherapy: {
            type: 'object',
            properties: {
              intent: { type: 'string' },
              site: { type: 'string' },
              dose: { type: 'string' },
              fractions: { type: 'string' },
              technique: { type: 'string', description: '3D-CRT, IMRT, SBRT, etc.' },
              startDate: { type: 'string' },
              endDate: { type: 'string' },
              concurrentChemo: { type: 'boolean' }
            },
            description: 'Radiation therapy details'
          },

          transplantAssessment: {
            type: 'object',
            properties: {
              eligibility: { type: 'string' },
              transplantType: { type: 'string', description: 'Autologous, allogeneic' },
              timing: { type: 'string' },
              conditioning: { type: 'string' },
              stemCellSource: { type: 'string' },
              hlaTyping: { type: 'object' },
              donorSearch: { type: 'string' },
              comorbidityIndex: { type: 'string' }
            },
            description: 'Transplant evaluation and planning'
          },

          performanceStatus: {
            type: 'object',
            properties: {
              ecog: { type: 'string', description: 'ECOG performance score' },
              karnofsky: { type: 'string', description: 'Karnofsky performance score' },
              lansky: { type: 'string', description: 'For pediatric patients' },
              functionalCapacity: { type: 'string' }
            },
            description: 'Oncology performance status scores'
          },

          tumorMarkers: {
            type: 'object',
            properties: {
              cea: { type: 'string' },
              ca199: { type: 'string' },
              ca125: { type: 'string' },
              afp: { type: 'string' },
              psa: { type: 'string' },
              ldh: { type: 'string' },
              alkalinePhosphatase: { type: 'string' },
              otherMarkers: { type: 'array', items: { type: 'object' } }
            },
            description: 'Tumor markers and monitoring'
          },

          clinicalTrials: {
            type: 'object',
            properties: {
              eligible: { type: 'boolean' },
              trialsOffered: { type: 'array', items: {
                type: 'object',
                properties: {
                  trialName: { type: 'string' },
                  nctNumber: { type: 'string' },
                  phase: { type: 'string' },
                  eligibilityCriteria: { type: 'array', items: { type: 'string' } }
                }
              }},
              enrolled: { type: 'boolean' },
              enrolledTrial: { type: 'string' },
              screeningStatus: { type: 'string' }
            },
            description: 'Clinical trial information'
          },

          responseAssessment: {
            type: 'object',
            properties: {
              criteria: { type: 'string', description: 'RECIST, IMWG, iRECIST' },
              bestResponse: { type: 'string', description: 'CR, PR, SD, PD' },
              dateOfResponse: { type: 'string' },
              depthOfResponse: { type: 'string' },
              durabilityOfResponse: { type: 'string' },
              measurableDisease: { type: 'array', items: { type: 'object' } },
              progressionFreesSurvival: { type: 'string' }
            },
            description: 'Treatment response evaluation'
          },

          toxicityAssessment: {
            type: 'object',
            properties: {
              ctcaeGrade: { type: 'object' },
              adverseEvents: { type: 'array', items: {
                type: 'object',
                properties: {
                  event: { type: 'string' },
                  grade: { type: 'string' },
                  attribution: { type: 'string' },
                  management: { type: 'string' }
                }
              }},
              doseModifications: { type: 'array', items: { type: 'object' } },
              treatmentDelays: { type: 'array', items: { type: 'object' } },
              supportiveCare: { type: 'array', items: { type: 'string' } }
            },
            description: 'Chemotherapy toxicity monitoring'
          },

          palliativeCareNeeds: {
            type: 'object',
            properties: {
              symptomsAddressed: { type: 'array', items: { type: 'string' } },
              painAssessment: { type: 'object' },
              psychosocialSupport: { type: 'array', items: { type: 'string' } },
              spiritualCare: { type: 'boolean' },
              hospiceDiscussion: { type: 'boolean' },
              qualityOfLifeScore: { type: 'string' }
            },
            description: 'Palliative and supportive care needs'
          },

          // Additional Oncology Treatment Fields
          prophylacticMedications: {
            type: 'object',
            properties: {
              antimicrobials: { type: 'array', items: { type: 'string' }, description: 'Acyclovir, PJP prophylaxis, etc.' },
              boneSupportive: { type: 'array', items: { type: 'string' }, description: 'Zoledronic acid, calcium, vitamin D' },
              gastricProtection: { type: 'array', items: { type: 'string' }, description: 'PPI with steroids' },
              dvtProphylaxis: { type: 'string', description: 'Aspirin, LMWH, etc.' }
            },
            description: 'Prophylactic medications to prevent treatment complications'
          },

          preChemotherapyWorkup: {
            type: 'object',
            properties: {
              infectiousScreening: { type: 'object', properties: {
                hepatitisB: { type: 'string' },
                hepatitisC: { type: 'string' },
                hiv: { type: 'string' },
                varicellaZoster: { type: 'string' }
              }},
              cardiacAssessment: { type: 'object', properties: {
                ekg: { type: 'string' },
                echo: { type: 'string' },
                indication: { type: 'string' }
              }},
              fertilityConsultation: { type: 'string' },
              dentalClearance: { type: 'string' }
            },
            description: 'Pre-treatment screening and assessments'
          },

          renalProtectionPlan: {
            type: 'object',
            properties: {
              hydration: { type: 'string', description: 'Aggressive hydration protocol' },
              nephrotoxinAvoidance: { type: 'array', items: { type: 'string' } },
              monitoring: { type: 'array', items: { type: 'string' }, description: 'Uric acid, tumor lysis labs' },
              consultations: { type: 'string', description: 'Nephrology consultation if needed' }
            },
            description: 'Renal protection strategy for AKI management'
          },

          painManagementPlan: {
            type: 'object',
            properties: {
              currentAnalgesics: { type: 'array', items: { type: 'string' } },
              interventionalProcedures: { type: 'array', items: { type: 'string' } },
              radiationTherapy: { type: 'string', description: 'For pain control' },
              consultations: { type: 'array', items: { type: 'string' }, description: 'Pain, ortho, radiation' },
              supportiveDevices: { type: 'array', items: { type: 'string' }, description: 'Back brace, etc.' }
            },
            description: 'Comprehensive pain management approach'
          },

          insuranceAuthorization: {
            type: 'object',
            properties: {
              status: { type: 'string', description: 'Initiated, pending, approved, denied' },
              medications: { type: 'array', items: { type: 'string' } },
              procedures: { type: 'array', items: { type: 'string' } },
              dateInitiated: { type: 'string' },
              notes: { type: 'string' }
            },
            description: 'Insurance authorization details for treatment'
          },

          // ========== OBSTETRIC/PREGNANCY SPECIFIC ==========
          // ========== ADDITIONAL COMPREHENSIVE ONCOLOGY FIELDS ==========
          treatmentSummary: {
            type: 'object',
            properties: {
              primaryDiagnosis: { type: 'object', properties: {
                site: { type: 'string' },
                histology: { type: 'string' },
                dateOfDiagnosis: { type: 'string' },
                stageAtDiagnosis: { type: 'string' },
                tnmStaging: { type: 'object' }
              }},
              treatmentTimeline: { type: 'array', items: {
                type: 'object',
                properties: {
                  treatment: { type: 'string' },
                  startDate: { type: 'string' },
                  endDate: { type: 'string' },
                  response: { type: 'string' },
                  complications: { type: 'array', items: { type: 'string' } }
                }
              }},
              currentTreatmentStatus: { type: 'string' },
              diseaseStatus: { type: 'string', description: 'NED, stable, progression' }
            },
            description: 'Comprehensive cancer treatment summary'
          },

          surgicalOncology: {
            type: 'object',
            properties: {
              procedureType: { type: 'string' },
              dateOfSurgery: { type: 'string' },
              surgeon: { type: 'string' },
              pathologyFindings: { type: 'object', properties: {
                tumorSize: { type: 'string' },
                margins: { type: 'string' },
                lymphNodesExamined: { type: 'string' },
                lymphNodesPositive: { type: 'string' },
                extrandalExtension: { type: 'boolean' },
                lymphovascularInvasion: { type: 'boolean' },
                perineuralInvasion: { type: 'boolean' }
              }},
              reconstruction: { type: 'object' },
              complications: { type: 'array', items: { type: 'string' } }
            },
            description: 'Surgical oncology details'
          },

          radiationOncology: {
            type: 'object',
            properties: {
              indication: { type: 'string' },
              technique: { type: 'string', description: '3D-CRT, IMRT, SBRT, proton' },
              site: { type: 'string' },
              totalDose: { type: 'string' },
              fractions: { type: 'string' },
              startDate: { type: 'string' },
              endDate: { type: 'string' },
              completionStatus: { type: 'string', description: 'Treatment completion status (e.g., "Completed without interruption")' },
              boostDose: { type: 'string' },
              concurrentChemotherapy: { type: 'boolean' },
              acuteToxicities: { type: 'array', items: { type: 'object' } },
              lateToxicities: { type: 'array', items: { type: 'object' } },
              complications: { type: 'array', items: { type: 'string' }, description: 'Radiation complications (e.g., "mild radiation fibrosis", "peripheral neuropathy")' }
            },
            description: 'Radiation therapy details'
          },

          endocrineTherapy: {
            type: 'object',
            properties: {
              medication: { type: 'string' },
              startDate: { type: 'string' },
              plannedDuration: { type: 'string' },
              compliance: { type: 'string' },
              sideEffects: { type: 'array', items: { type: 'string' } },
              sideEffectManagement: {
                type: 'object',
                properties: {
                  arthralgias: {
                    type: 'object',
                    properties: {
                      currentManagement: { type: 'string', description: 'Current interventions (e.g., "occasional NSAIDs", "yoga")' },
                      alternativeOptions: { type: 'array', items: { type: 'string' }, description: 'Alternative medications (e.g., "Consider duloxetine if worsens")' }
                    }
                  },
                  hotFlashes: {
                    type: 'object',
                    properties: {
                      frequency: { type: 'string', description: 'Hot flash frequency (e.g., "2-3 per day", "decreased in frequency")' },
                      currentManagement: { type: 'string', description: 'Current interventions' },
                      alternativeOptions: { type: 'array', items: { type: 'string' }, description: 'Alternative medications (e.g., "Consider venlafaxine if worsens")' }
                    }
                  },
                  vaginalDryness: {
                    type: 'object',
                    properties: {
                      currentManagement: { type: 'string', description: 'Current interventions (e.g., "Non-hormonal moisturizers twice weekly")' },
                      treatments: { type: 'array', items: { type: 'string' }, description: 'Specific treatments (e.g., "Hyaluronic acid suppositories as needed")' }
                    }
                  }
                },
                description: 'Structured side effect management plan with specific interventions'
              },
              hormoneReceptorStatus: { type: 'object', properties: {
                er: { type: 'string' },
                pr: { type: 'string' },
                her2: { type: 'string' }
              }},
              ovarianSuppression: { type: 'boolean' },
              boneProtection: { type: 'string' },
              extendedTherapyDiscussion: { type: 'string', description: 'Plans for extended therapy discussion (e.g., "discuss extended therapy at year 5")' },
              menopauseStatus: {
                type: 'object',
                properties: {
                  status: { type: 'string', description: 'Menopause status (natural, surgical, induced)' },
                  surgicalHistory: { type: 'string', description: 'Surgical menopause history (e.g., "Hysterectomy for fibroids - 2010")' },
                  symptoms: { type: 'array', items: { type: 'string' }, description: 'Menopausal symptoms (hot flashes, etc.)' },
                  hormoneLevels: { type: 'object', properties: {
                    estradiol: { type: 'string', description: 'Estradiol level (e.g., "<5 pg/mL")' }
                  }}
                },
                description: 'Menopause status relevant to hormone therapy'
              }
            },
            description: 'Hormone therapy for cancer'
          },

          boneHealth: {
            type: 'object',
            properties: {
              dexaScan: {
                type: 'object',
                properties: {
                  tScore: { type: 'string' },
                  result: { type: 'string', description: 'e.g., "Osteopenia", "Osteoporosis"' },
                  date: { type: 'string' },
                  scheduledDate: { type: 'string', description: 'Next scheduled DEXA (e.g., "DEXA scan in 1 year")' }
                }
              },
              boneProtectionTherapy: { type: 'string' },
              fractures: { type: 'array', items: { type: 'string' } },
              riskFactors: { type: 'array', items: { type: 'string' } }
            },
            description: 'Bone health monitoring for cancer survivors'
          },

          survivorshipCarePlan: {
            type: 'object',
            properties: {
              followUpSchedule: { type: 'object', properties: {
                clinicalExams: { type: 'string' },
                imaging: { type: 'string' },
                labWork: { type: 'string' }
              }},
              surveillanceTests: { type: 'array', items: {
                type: 'object',
                properties: {
                  test: { type: 'string' },
                  frequency: { type: 'string' },
                  lastPerformed: { type: 'string' },
                  nextDue: { type: 'string' }
                }
              }},
              lateEffectsMonitoring: { type: 'array', items: { type: 'string' } },
              healthMaintenance: { type: 'object', properties: {
                vaccinations: { type: 'array', items: { type: 'string' } },
                screenings: { type: 'array', items: {
                  type: 'object',
                  properties: {
                    screening: { type: 'string' },
                    lastDate: { type: 'string', description: 'Last screening date (e.g., "Colonoscopy last 2020")' },
                    dueDate: { type: 'string' },
                    specialInstructions: { type: 'string', description: 'Special instructions (e.g., "no cervix" for gynecologic exam)' }
                  }
                }},
                lifestyle: { type: 'array', items: { type: 'string' } },
                lifestyleDetails: {
                  type: 'object',
                  properties: {
                    exerciseMinutes: { type: 'string', description: 'Exercise prescription (e.g., "150 minutes/week")' },
                    dietRecommendations: { type: 'string', description: 'Diet recommendations (e.g., "Mediterranean diet encouraged")' },
                    alcoholLimit: { type: 'string', description: 'Alcohol limitation (e.g., "Limit to <1 drink/day")' },
                    weightManagement: { type: 'string', description: 'Weight maintenance guidance' }
                  },
                  description: 'Structured lifestyle counseling details'
                }
              }},
              recurrenceSigns: { type: 'array', items: { type: 'string' } },
              surveillanceStrategy: { type: 'string', description: 'Surveillance approach and rationale (e.g., "No routine CT/PET/bone scans in absence of symptoms")' },
              psychosocialSupport: {
                type: 'object',
                properties: {
                  supportSystems: { type: 'array', items: { type: 'string' }, description: 'Support systems (e.g., "son", "church community")' },
                  peerMentorInterest: { type: 'string', description: 'Interest in peer mentoring (e.g., "considering becoming peer mentor")' },
                  workStatus: { type: 'string', description: 'Current work/occupation status' },
                  patientMotivation: { type: 'string', description: 'Patient motivation and engagement' }
                },
                description: 'Psychosocial support and survivorship engagement'
              }
            },
            description: 'Cancer survivorship care planning'
          },

          cancerRelatedSideEffects: {
            type: 'object',
            properties: {
              lymphedema: { type: 'object', properties: {
                present: { type: 'boolean' },
                location: { type: 'string' },
                severity: { type: 'string' },
                onset: { type: 'string', description: 'Timeline of onset or worsening (e.g., "Progressive left arm swelling over past 3 weeks")' },
                symptoms: { type: 'array', items: { type: 'string' }, description: 'Patient-reported symptoms (e.g., "Arm feels heavy", "rings are tight", "worse at end of day")' },
                edemaGrade: { type: 'string', description: 'Pitting edema grade (e.g., "2+ pitting edema to mid-forearm")' },
                armCircumferenceDifference: { type: 'string', description: 'Circumference difference measurement (e.g., "2cm greater than right")' },
                compressionTherapy: {
                  type: 'object',
                  properties: {
                    compliance: { type: 'string', description: 'Compression sleeve compliance (e.g., "Wearing inconsistently due to discomfort")' },
                    compressionLevel: { type: 'string', description: 'Compression level prescription (e.g., "upgrade to 20-30 mmHg")' }
                  }
                },
                management: { type: 'array', items: { type: 'string' } },
                completeDecongestiveTherapy: { type: 'string', description: 'CDT status (e.g., "may be needed")' },
                manualLymphDrainage: { type: 'string', description: 'Manual lymph drainage instructions (e.g., "Daily manual lymph drainage")' },
                patientEducation: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Lymphedema education topics (skin care, weight maintenance, infection prevention, blood pressure precautions)'
                },
                qualityOfLifeImpact: { type: 'string', description: 'Patient-reported QOL impact (e.g., "main quality of life concern currently")' }
              }},
              neuropathy: { type: 'object', properties: {
                type: { type: 'string' },
                distribution: { type: 'string' },
                severity: { type: 'string' },
                treatment: { type: 'array', items: { type: 'string' } }
              }},
              fatigue: { type: 'object', properties: {
                severity: { type: 'string' },
                impact: { type: 'string' },
                interventions: { type: 'array', items: { type: 'string' } }
              }},
              cognitiveChanges: { type: 'string' },
              sexualDysfunction: { type: 'object' },
              fertilityImpact: { type: 'object' },
              secondaryMalignancyRisk: { type: 'string' }
            },
            description: 'Cancer treatment side effects'
          },

          oncologicEmergencies: {
            type: 'object',
            properties: {
              neutropenicFever: { type: 'object' },
              tumorLysisSyndrome: { type: 'object' },
              hypercalcemia: { type: 'object' },
              spinalCordCompression: { type: 'object' },
              superiorVenaCavaSyndrome: { type: 'object' },
              brainMetastases: { type: 'object' }
            },
            description: 'Oncologic emergency assessments'
          },

          palliativeCare: {
            type: 'object',
            properties: {
              goalsOfCare: { type: 'array', items: { type: 'string' } },
              symptomManagement: { type: 'object', properties: {
                pain: { type: 'object' },
                nausea: { type: 'object' },
                dyspnea: { type: 'object' },
                anxiety: { type: 'object' }
              }},
              advanceDirectives: { type: 'object' },
              hospiceDiscussion: { type: 'boolean' },
              qualityOfLife: { type: 'string' },
              spiritualSupport: { type: 'boolean' }
            },
            description: 'Palliative care assessment'
          },

          psychosocialOncology: {
            type: 'object',
            properties: {
              distressScreening: { type: 'string' },
              anxietyLevel: { type: 'string' },
              depressionScreening: { type: 'string' },
              copingStrategies: { type: 'array', items: { type: 'string' } },
              supportSystems: { type: 'array', items: { type: 'string' } },
              financialToxicity: { type: 'object' },
              returnToWork: { type: 'object' },
              supportGroupParticipation: { type: 'boolean' }
            },
            description: 'Psychosocial oncology assessment'
          },

          geneticOncology: {
            type: 'object',
            properties: {
              familyHistory: { type: 'array', items: {
                type: 'object',
                properties: {
                  relative: { type: 'string' },
                  cancerType: { type: 'string' },
                  ageAtDiagnosis: { type: 'string' }
                }
              }},
              geneticCounseling: { type: 'object', properties: {
                indicated: { type: 'boolean' },
                completed: { type: 'boolean' },
                date: { type: 'string' }
              }},
              geneticTesting: { type: 'object', properties: {
                performed: { type: 'boolean' },
                genes: { type: 'array', items: { type: 'string' } },
                results: { type: 'string' },
                implications: { type: 'string' }
              }},
              riskAssessmentTools: { type: 'array', items: { type: 'object' } },
              preventiveRecommendations: { type: 'array', items: { type: 'string' } }
            },
            description: 'Genetic oncology evaluation'
          },

          prognosticFactors: {
            type: 'object',
            properties: {
              favorableFactors: { type: 'array', items: { type: 'string' } },
              adverseFactors: { type: 'array', items: { type: 'string' } },
              survivalEstimates: { type: 'object', properties: {
                fiveYear: { type: 'string' },
                tenYear: { type: 'string' },
                medianSurvival: { type: 'string' }
              }},
              recurrenceRisk: { type: 'string' },
              prognosticScores: { type: 'array', items: { type: 'object' } },
              molecularSubtype: { type: 'string' },
              molecularSubtypeMethodology: { type: 'string', description: 'Methodology used to determine molecular subtype (e.g., "by Hans Algorithm")' }
            },
            description: 'Prognostic assessment with methodology'
          },

          integrativeOncology: {
            type: 'object',
            properties: {
              complementaryTherapies: { type: 'array', items: { type: 'string' } },
              nutritionalSupport: { type: 'object' },
              exerciseProgram: { type: 'object' },
              mindBodyPractices: { type: 'array', items: { type: 'string' } },
              acupuncture: { type: 'boolean' },
              supplements: { type: 'array', items: { type: 'object' } }
            },
            description: 'Integrative oncology interventions'
          },

          obstetricHistory: {
            type: 'object',
            properties: {
              gravida: { type: 'string' },
              para: { type: 'string' },
              gpNotation: { type: 'string', description: 'G_P___ format' },
              previousPregnancies: { type: 'array', items: {
                type: 'object',
                properties: {
                  year: { type: 'string' },
                  outcome: { type: 'string' },
                  gestationalAge: { type: 'string' },
                  complications: { type: 'array', items: { type: 'string' } },
                  deliveryMode: { type: 'string' }
                }
              }},
              livingChildren: { type: 'string' },
              pregnancyLosses: { type: 'array', items: { type: 'object' } }
            },
            description: 'Complete obstetric history'
          },

          currentPregnancy: {
            type: 'object',
            properties: {
              gestationalAge: { type: 'string', description: 'Weeks and days' },
              edd: { type: 'string', description: 'Estimated due date' },
              eddConfirmationMethod: { type: 'string', description: 'EDD confirmation method (e.g., "by LMP, confirmed by 8-week ultrasound")' },
              lmp: { type: 'string', description: 'Last menstrual period' },
              conceptionMethod: { type: 'string', description: 'Spontaneous, IVF, IUI' },
              singleton: { type: 'boolean' },
              multipleGestation: { type: 'object', properties: {
                number: { type: 'string' },
                chorionicity: { type: 'string' },
                amnionicity: { type: 'string' }
              }},
              pregnancyComplications: { type: 'array', items: { type: 'string' } },
              highRiskFactors: { type: 'array', items: { type: 'string' } },
              currentSymptoms: { type: 'array', items: { type: 'string' }, description: 'Current pregnancy symptoms and complaints' },
              fetalEcho: { type: 'object', properties: {
                performed: { type: 'boolean' },
                result: { type: 'string' },
                indication: { type: 'string' }
              }, description: 'Fetal echocardiogram details' },
              insulinAdjustmentProtocol: { type: 'object', properties: {
                fastingInsulin: { type: 'string' },
                mealInsulin: { type: 'string' },
                adjustmentInstructions: { type: 'array', items: { type: 'string' } }
              }, description: 'Insulin adjustment protocol for GDM' },
              ketoneMonitoringInstructions: { type: 'string', description: 'Instructions for ketone monitoring' },
              culturalConsiderations: { type: 'array', items: { type: 'string' }, description: 'Cultural factors affecting care' },
              riskCounseling: { type: 'array', items: { type: 'string' }, description: 'Risk counseling provided' },
              virtualCheckIns: { type: 'string', description: 'Virtual follow-up schedule' }
            },
            description: 'Current pregnancy details'
          },

          reproductiveHistory: {
            type: 'object',
            properties: {
              infertilityDiagnosis: { type: 'string' },
              infertilityDuration: { type: 'string' },
              artCycles: { type: 'array', items: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: 'IVF, IUI, FET' },
                  cycleNumber: { type: 'string' },
                  outcome: { type: 'string' },
                  complications: { type: 'array', items: { type: 'string' } }
                }
              }},
              pgtTesting: { type: 'object', properties: {
                performed: { type: 'boolean' },
                result: { type: 'string' },
                embryoAge: { type: 'string' }
              }},
              contraceptiveHistory: { type: 'array', items: { type: 'string' } },
              menstrualHistory: { type: 'object' }
            },
            description: 'Reproductive and fertility history'
          },

          prenatalScreening: {
            type: 'object',
            properties: {
              firstTrimesterScreen: { type: 'object', properties: {
                ntMeasurement: { type: 'string' },
                bhcg: { type: 'string' },
                pappa: { type: 'string' },
                risk: { type: 'string' }
              }},
              cellFreeDna: { type: 'object', properties: {
                result: { type: 'string' },
                fetalFraction: { type: 'string' },
                sexChromosomes: { type: 'string' }
              }},
              quadScreen: { type: 'object', properties: {
                afp: { type: 'string' },
                hcg: { type: 'string' },
                estriol: { type: 'string' },
                inhibinA: { type: 'string' },
                interpretation: { type: 'string' }
              }},
              amniocentesis: { type: 'object' },
              cvs: { type: 'object' },
              ntScanResult: { type: 'string', description: 'NT scan measurement and result (e.g., 1.2mm normal)' },
              cellFreeDNAResult: { type: 'string', description: 'Cell-free DNA test result (e.g., Low risk all chromosomes)' },
              firstTrimesterScreenResult: { type: 'string', description: 'First trimester screen result (e.g., Low risk)' },
              anatomyScanResult: { type: 'string', description: 'Anatomy scan findings at 20 weeks' },
              cervicalLengthMeasurement: { type: 'string', description: 'Cervical length measurement for preterm risk' },
              fetalEchoResult: { type: 'string', description: 'Fetal echocardiogram result' },
              perinatalMentalHealthReferral: { type: 'string', description: 'Mental health referral details' }
            },
            description: 'Prenatal genetic screening and testing'
          },

          fetalUltrasound: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'Ultrasound date (e.g., "07/15/2025")' },
              fetalGender: { type: 'string', description: 'Fetal gender if determined (e.g., "Female (patient aware)")' },
              anatomyScan: { type: 'object', properties: {
                gestationalAge: { type: 'string' },
                findings: { type: 'array', items: { type: 'string' } },
                placentaLocation: { type: 'string' },
                cervicalLength: { type: 'string' }
              }},
              growthScans: { type: 'array', items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  gestationalAge: { type: 'string' },
                  efw: { type: 'string', description: 'Estimated fetal weight' },
                  percentile: { type: 'string' },
                  biometry: { type: 'object', properties: {
                    bpd: { type: 'string' },
                    hc: { type: 'string' },
                    ac: { type: 'string' },
                    fl: { type: 'string' }
                  }}
                }
              }},
              amnioticFluid: { type: 'string', description: 'AFI or DVP' },
              dopplerStudies: { type: 'object', properties: {
                umbilicalArtery: { type: 'string' },
                middleCerebralArtery: { type: 'string' },
                uterineArtery: { type: 'string' },
                ductusVenosus: { type: 'string' }
              }},
              fetalEcho: { type: 'object' },
              presentation: { type: 'string' }
            },
            description: 'Fetal ultrasound findings'
          },

          gestationalDiabetes: {
            type: 'object',
            properties: {
              screeningMethod: { type: 'string', description: 'One-step vs two-step' },
              glucoseChallengeTest: { type: 'string' },
              ogttResults: { type: 'object', properties: {
                fasting: { type: 'string' },
                oneHour: { type: 'string' },
                twoHour: { type: 'string' },
                threeHour: { type: 'string' }
              }},
              gdmClass: { type: 'string', description: 'A1 or A2' },
              managementType: { type: 'string', description: 'Diet, metformin, insulin' },
              glucoseMonitoring: { type: 'object', properties: {
                fastingGoal: { type: 'string' },
                postprandialGoal: { type: 'string' },
                averageValues: { type: 'object' }
              }},
              glucoseLogReview: { type: 'object', properties: {
                fasting: { type: 'string', description: 'Fasting glucose range and goal' },
                postBreakfast: { type: 'string', description: '1-hr post-breakfast values' },
                postLunch: { type: 'string', description: '1-hr post-lunch values' },
                postDinner: { type: 'string', description: '1-hr post-dinner values' },
                daysCovered: { type: 'string', description: 'Number of days reviewed' }
              }, description: 'Detailed glucose log review with meal-specific readings' },
              hba1c: { type: 'string' },
              glucoseMonitoringGoals: {
                type: 'object',
                properties: {
                  fasting: { type: 'string', description: 'Fasting glucose goal (e.g., <95)' },
                  oneHourPostprandial: { type: 'string', description: '1-hour post-meal goal (e.g., <140)' },
                  twoHourPostprandial: { type: 'string', description: '2-hour post-meal goal (e.g., <120)' }
                },
                description: 'Complete glucose monitoring targets'
              },
              insulinStorageInstructions: { type: 'string', description: 'Instructions for insulin administration and storage' },
              macrosomiaThreshold: { type: 'string', description: 'EFW threshold for early delivery (e.g., >90th percentile)' },
              cesareanThreshold: { type: 'string', description: 'EFW threshold for cesarean consideration (e.g., >4500g)' },
              postpartumDiabetesRisk: { type: 'string', description: 'Risk of type 2 diabetes postpartum (e.g., 50% in 10 years)' },
              gdmRecurrenceRisk: { type: 'string', description: 'Risk of GDM in future pregnancies (e.g., 70%)' }
            },
            description: 'Gestational diabetes screening and management'
          },

          fetalSurveillance: {
            type: 'object',
            properties: {
              kickCounts: { type: 'string' },
              nst: { type: 'array', items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  result: { type: 'string', description: 'Reactive, non-reactive' },
                  variability: { type: 'string' },
                  accelerations: { type: 'string' },
                  decelerations: { type: 'string' }
                }
              }},
              bpp: { type: 'array', items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  score: { type: 'string' },
                  components: { type: 'object' }
                }
              }},
              cst: { type: 'object', description: 'Contraction stress test' }
            },
            description: 'Antepartum fetal surveillance'
          },

          pregnancyComplications: {
            type: 'object',
            properties: {
              hypertensiveDisorders: { type: 'object', properties: {
                type: { type: 'string', description: 'Chronic HTN, gestational HTN, preeclampsia' },
                severity: { type: 'string' },
                proteinuria: { type: 'string' },
                management: { type: 'array', items: { type: 'string' } }
              }},
              placentalComplications: { type: 'object', properties: {
                previaType: { type: 'string' },
                accreta: { type: 'string' },
                abruption: { type: 'boolean' },
                insufficiency: { type: 'boolean' }
              }},
              pretermLabor: { type: 'object', properties: {
                episodes: { type: 'array', items: { type: 'object' } },
                cervicalLength: { type: 'string' },
                ffnResult: { type: 'string' },
                tocolytics: { type: 'array', items: { type: 'string' } }
              }},
              infections: { type: 'array', items: { type: 'object' } },
              iugr: { type: 'boolean' },
              polyhydramnios: { type: 'boolean' },
              oligohydramnios: { type: 'boolean' }
            },
            description: 'Pregnancy complications'
          },

          deliveryPlanning: {
            type: 'object',
            properties: {
              targetGestationalAge: { type: 'string' },
              plannedDeliveryMode: { type: 'string' },
              indicationsForDelivery: { type: 'array', items: { type: 'string' } },
              anesthesiaConsiderations: { type: 'array', items: { type: 'string' } },
              neonatologyConsult: { type: 'boolean' },
              specialPreparations: { type: 'array', items: { type: 'string' } },
              postpartumContraception: { type: 'string' },
              earlyDeliveryConditions: { type: 'string', description: 'Conditions requiring earlier delivery (37-38 weeks)' },
              trialOfLaborCriteria: { type: 'string', description: 'Criteria for trial of labor vs cesarean' }
            },
            description: 'Delivery planning and considerations'
          },

          maternalLabs: {
            type: 'object',
            properties: {
              bloodType: { type: 'string' },
              antibodyScreen: { type: 'string' },
              rubellaTiter: { type: 'string' },
              syphilis: { type: 'string' },
              hiv: { type: 'string' },
              hepatitisB: { type: 'string' },
              hepatitisC: { type: 'string' },
              gbsStatus: { type: 'string' },
              urineProtein: { type: 'string' },
              glucoseScreening: { type: 'object' }
            },
            description: 'Maternal laboratory results'
          },

          // ========== ADDITIONAL OBSTETRIC/PRENATAL FIELDS ==========
          prenatalVisit: {
            type: 'object',
            properties: {
              visitType: { type: 'string', description: 'Routine, problem, urgent' },
              gestationalAgeAtVisit: { type: 'string' },
              visitNumber: { type: 'string' },
              nextVisitScheduled: { type: 'string' },
              provider: { type: 'string' },
              visitCompliance: { type: 'string' }
            },
            description: 'Prenatal visit tracking'
          },

          maternalWeightMonitoring: {
            type: 'object',
            properties: {
              prePregnancyWeight: { type: 'string' },
              currentWeight: { type: 'string' },
              totalWeightGain: { type: 'string' },
              weeklyGainRate: { type: 'string' },
              bmi: { type: 'string' },
              weightGainAppropriate: { type: 'boolean' },
              nutritionalCounseling: { type: 'boolean' }
            },
            description: 'Maternal weight and nutrition tracking'
          },

          fetalAssessment: {
            type: 'object',
            properties: {
              fetalHeartRate: { type: 'string' },
              fetalMovement: { type: 'object', properties: {
                kickCounts: { type: 'string' },
                pattern: { type: 'string' },
                concernsReported: { type: 'boolean' }
              }},
              fundalHeight: { type: 'string' },
              fundalHeightPercentile: { type: 'string' },
              fetalPosition: { type: 'string', description: 'Vertex, breech, transverse' },
              fetalPresentation: { type: 'string' },
              estimatedFetalWeight: { type: 'string' },
              leopoldManeuvers: { type: 'object' }
            },
            description: 'Fetal assessment at prenatal visits'
          },

          contractionMonitoring: {
            type: 'object',
            properties: {
              braxtonHicks: { type: 'object', properties: {
                present: { type: 'boolean' },
                frequency: { type: 'string' },
                characteristics: { type: 'string' },
                management: { type: 'string' }
              }},
              trueLabor: { type: 'object', properties: {
                contractionFrequency: { type: 'string' },
                duration: { type: 'string' },
                intensity: { type: 'string' },
                cervicalChange: { type: 'boolean' }
              }},
              pretermLaborRisk: { type: 'string' },
              tocolytics: { type: 'array', items: { type: 'string' } }
            },
            description: 'Contraction and labor monitoring'
          },

          pregnancySymptoms: {
            type: 'object',
            properties: {
              nausea: { type: 'string' },
              vomiting: { type: 'string' },
              heartburn: { type: 'string' },
              constipation: { type: 'string' },
              hemorrhoids: { type: 'string' },
              backPain: { type: 'string' },
              roundLigamentPain: { type: 'string' },
              edema: { type: 'string' },
              varicoseVeins: { type: 'string' },
              sleepDisturbance: { type: 'string' },
              urinaryFrequency: { type: 'string' },
              vaginalDischarge: { type: 'string' },
              skinChanges: { type: 'array', items: { type: 'string' } }
            },
            description: 'Common pregnancy symptoms tracking'
          },

          prenatalEducation: {
            type: 'object',
            properties: {
              topicsDiscussed: { type: 'array', items: { type: 'string' } },
              childbirtClassesEnrolled: { type: 'boolean' },
              classesAttended: { type: 'array', items: { type: 'string' } },
              breastfeedingEducation: { type: 'boolean' },
              pretermLaborPrecautions: { type: 'boolean' },
              nutritionCounseling: { type: 'boolean' },
              exerciseGuidance: { type: 'boolean' },
              travelRestrictions: { type: 'string' },
              workModifications: { type: 'array', items: { type: 'string' } },
              warningSignsReviewed: { type: 'array', items: { type: 'string' } }
            },
            description: 'Prenatal education and counseling'
          },

          birthPlan: {
            type: 'object',
            properties: {
              deliveryPreference: { type: 'string', description: 'Vaginal, cesarean, VBAC' },
              painManagement: { type: 'array', items: { type: 'string' } },
              laborSupport: { type: 'array', items: { type: 'string' } },
              immediatePostpartum: { type: 'object', properties: {
                skinToSkin: { type: 'boolean' },
                delayedCordClamping: { type: 'boolean' },
                cordBloodBanking: { type: 'boolean' },
                placentaPreference: { type: 'string' }
              }},
              feedingPlan: { type: 'string' },
              circumcisionPreference: { type: 'string' },
              visitorsPolicy: { type: 'string' },
              religiousCulturalPreferences: { type: 'array', items: { type: 'string' } }
            },
            description: 'Birth preferences and planning'
          },

          postpartumPlanning: {
            type: 'object',
            properties: {
              pediatricianSelected: { type: 'string' },
              contraceptionPlan: { type: 'string' },
              maternityLeave: { type: 'object', properties: {
                startDate: { type: 'string' },
                duration: { type: 'string' },
                returnToWork: { type: 'string' }
              }},
              postpartumSupport: { type: 'array', items: { type: 'string' } },
              lactationSupport: { type: 'boolean' },
              mentalHealthScreening: { type: 'boolean' },
              homePreparations: { type: 'array', items: { type: 'string' } },
              glucoseTestingSchedule: { type: 'string', description: '6-week GTT and annual screening' },
              insulinDiscontinuation: { type: 'string', description: 'Stop insulin after delivery instructions' },
              breastfeedingRecommendations: { type: 'array', items: { type: 'string' } },
              weightManagementPlan: { type: 'string', description: 'Postpartum weight management' },
              exerciseProgram: { type: 'string', description: 'Postpartum exercise recommendations' },
              metforminConsideration: { type: 'string', description: 'Consider metformin if prediabetes' },
              futurePregnancyCounseling: { type: 'string', description: 'Preconception counseling for future' }
            },
            description: 'Postpartum planning and preparations'
          },

          pregnancyRiskAssessment: {
            type: 'object',
            properties: {
              riskFactors: { type: 'array', items: { type: 'string' } },
              riskLevel: { type: 'string', description: 'Low, moderate, high' },
              consultationsNeeded: { type: 'array', items: { type: 'string' } },
              surveillancePlan: { type: 'string' },
              hospitalOfDelivery: { type: 'string' },
              antenatalTesting: { type: 'array', items: { type: 'object' } }
            },
            description: 'Pregnancy risk stratification'
          },

          psychosocialAssessment: {
            type: 'object',
            properties: {
              edinburghScore: { type: 'string', description: 'Edinburgh Postnatal Depression Scale score (0-30, >10 suggests depression)' },
              anxietyScreening: { type: 'string', description: 'Anxiety screening results (GAD-7 or other tool)' },
              domesticViolenceScreen: { type: 'string', description: 'Domestic violence screening result (positive/negative/not assessed)' },
              socialSupport: { type: 'string', description: 'Description of social support system (family, friends, community)' },
              substanceUseScreen: {
                type: 'object',
                properties: {
                  tobacco: { type: 'string', description: 'Tobacco use status' },
                  alcohol: { type: 'string', description: 'Alcohol use status' },
                  drugs: { type: 'string', description: 'Drug use status' }
                },
                description: 'Substance use screening results'
              },
              housingStability: { type: 'string', description: 'Housing stability assessment (stable/unstable/homeless risk)' },
              financialConcerns: { type: 'string', description: 'Financial concerns and stressors described by patient' },
              relationshipStress: { type: 'string', description: 'Relationship stress and partner support assessment' },
              previousPostpartumDepression: { type: 'boolean', description: 'History of postpartum depression in previous pregnancies' }
            },
            description: 'Psychosocial screening and support - CRITICAL for pregnancy: screens for depression risk, domestic violence, social determinants of health (housing, finances), substance use, and relationship dynamics that impact maternal/fetal outcomes'
          },

          cervicalAssessment: {
            type: 'object',
            properties: {
              cervicalLength: { type: 'string' },
              cervicalDilation: { type: 'string' },
              cervicalEffacement: { type: 'string' },
              cervicalConsistency: { type: 'string' },
              cervicalPosition: { type: 'string' },
              bishopScore: { type: 'string' },
              cervicalCerclage: { type: 'object' }
            },
            description: 'Cervical examination findings'
          },

          pregnancyCourse: {
            type: 'object',
            properties: {
              firstTrimester: { type: 'object', properties: {
                earlyBleeding: { type: 'string', description: 'Details of any early bleeding episodes' },
                complications: { type: 'array', items: { type: 'string' } },
                screening: { type: 'array', items: { type: 'string' } }
              }},
              secondTrimester: { type: 'object', properties: {
                anatomyScanFindings: { type: 'string' },
                glucoseTesting: { type: 'string' },
                complications: { type: 'array', items: { type: 'string' } }
              }},
              thirdTrimester: { type: 'object', properties: {
                growthAssessment: { type: 'string' },
                surveillance: { type: 'string' },
                complications: { type: 'array', items: { type: 'string' } }
              }}
            },
            description: 'Detailed pregnancy course by trimester'
          },

          managementPlan: {
            type: 'object',
            properties: {
              medicationInitiation: { type: 'array', items: { type: 'string' }, description: 'New medications started with instructions' },
              insulinTeaching: { type: 'string', description: 'Insulin administration and storage education' },
              monitoringSchedule: { type: 'object', properties: {
                glucometerDownload: { type: 'string' },
                surveillanceSchedule: { type: 'array', items: { type: 'string' } },
                followUpVisits: { type: 'array', items: { type: 'string' } }
              }},
              dietaryManagement: { type: 'string' },
              activityRecommendations: { type: 'string' },
              warningSignsEducation: { type: 'array', items: { type: 'string' } }
            },
            description: 'Comprehensive management plan'
          },

          // Additional top-level fields for better extraction
          fetalEcho: {
            type: 'object',
            properties: {
              performed: { type: 'boolean' },
              result: { type: 'string' },
              indication: { type: 'string' },
              findings: { type: 'string' }
            },
            description: 'Fetal echocardiogram assessment'
          },

          umbilicalArteryDoppler: {
            type: 'object',
            properties: {
              result: { type: 'string' },
              pi: { type: 'string', description: 'Pulsatility index' },
              ri: { type: 'string', description: 'Resistance index' },
              interpretation: { type: 'string' }
            },
            description: 'Umbilical artery Doppler assessment'
          },

          insulinAdjustmentProtocol: {
            type: 'object',
            properties: {
              fastingAdjustment: { type: 'string' },
              mealTimeAdjustment: { type: 'string' },
              thresholds: { type: 'array', items: { type: 'string' } },
              contactInstructions: { type: 'string' }
            },
            description: 'Insulin adjustment protocol for gestational diabetes'
          },

          ketoneMonitoringInstructions: {
            type: 'object',
            properties: {
              whenToCheck: { type: 'string' },
              interpretation: { type: 'string' },
              actionRequired: { type: 'string' }
            },
            description: 'Ketone monitoring instructions'
          },

          postpartumGlucoseMonitoring: {
            type: 'object',
            properties: {
              immediatePostpartum: { type: 'string', description: 'First 24-48 hours' },
              sixWeekTest: { type: 'string', description: '6-week glucose tolerance test' },
              longTermScreening: { type: 'string', description: 'Annual diabetes screening' }
            },
            description: 'Postpartum glucose monitoring plan'
          },

          amnioticFluidAssessment: {
            type: 'object',
            properties: {
              frequency: { type: 'string' },
              startingWeek: { type: 'string' },
              method: { type: 'string', description: 'AFI or DVP' },
              thresholds: { type: 'object' }
            },
            description: 'Amniotic fluid surveillance schedule'
          },

          continuousGlucoseMonitor: {
            type: 'object',
            properties: {
              offered: { type: 'boolean' },
              accepted: { type: 'boolean' },
              deviceInfo: { type: 'string' },
              instructions: { type: 'string' }
            },
            description: 'Continuous glucose monitoring information for diabetes management'
          },

          weeklyVirtualCheckIns: {
            type: 'object',
            properties: {
              scheduled: { type: 'boolean' },
              frequency: { type: 'string' },
              purpose: { type: 'string' },
              platform: { type: 'string' }
            },
            description: 'Virtual check-in schedule for glucose review and support'
          },

          southAsianNutritionist: {
            type: 'object',
            properties: {
              referred: { type: 'boolean' },
              name: { type: 'string' },
              contact: { type: 'string' },
              appointmentScheduled: { type: 'boolean' }
            },
            description: 'Culturally-specific nutritionist referral'
          },

          indianDietExchangeLists: {
            type: 'object',
            properties: {
              provided: { type: 'boolean' },
              categories: { type: 'array', items: { type: 'string' } },
              instructions: { type: 'string' }
            },
            description: 'Culturally-appropriate dietary management tools'
          },

          culturalConsiderations: {
            type: 'object',
            properties: {
              dietaryPreferences: { type: 'array', items: { type: 'string' } },
              familyDynamics: { type: 'string' },
              supportStrategies: { type: 'array', items: { type: 'string' } },
              culturalResources: { type: 'array', items: { type: 'string' } }
            },
            description: 'Cultural factors affecting care and management'
          },

          diabetesManagementPlan: {
            type: 'object',
            properties: {
              insulinAdministration: { type: 'string' },
              glucometerDownloadSchedule: { type: 'string' },
              carbohydrateCounting: { type: 'boolean' },
              mealPlan: { type: 'string' },
              monitoringFrequency: { type: 'string' },
              targetRanges: { type: 'object' }
            },
            description: 'Comprehensive diabetes management plan'
          },

          thyroidManagement: {
            type: 'object',
            properties: {
              medication: { type: 'string' },
              dosage: { type: 'string' },
              frequency: { type: 'string' },
              monitoringSchedule: { type: 'string' },
              targetLevels: { type: 'string' }
            },
            description: 'Thyroid management protocol'
          },

          totalWeightGain: {
            type: 'object',
            properties: {
              amount: { type: 'string' },
              unit: { type: 'string' },
              timeframe: { type: 'string' },
              assessment: { type: 'string' }
            },
            description: 'Total weight gain during pregnancy'
          },

          exerciseProgram: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              frequency: { type: 'string' },
              duration: { type: 'string' },
              intensity: { type: 'string' },
              purpose: { type: 'string' }
            },
            description: 'Exercise program details'
          },

          earlyMaternityLeave: {
            type: 'object',
            properties: {
              considering: { type: 'boolean' },
              reason: { type: 'string' },
              timing: { type: 'string' },
              status: { type: 'string' }
            },
            description: 'Early maternity leave considerations'
          },

          downloadGlucometer: {
            type: 'object',
            properties: {
              frequency: { type: 'string' },
              instructions: { type: 'string' },
              purpose: { type: 'string' }
            },
            description: 'Glucometer download instructions'
          },

          estimatedDeliveryDate: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              gestationalAge: { type: 'string' },
              method: { type: 'string' },
              reliability: { type: 'string' }
            },
            description: 'Estimated delivery date information'
          },

          firstTrimesterBleeding: {
            type: 'object',
            properties: {
              occurred: { type: 'boolean' },
              weeks: { type: 'string' },
              severity: { type: 'string' },
              resolved: { type: 'boolean' },
              followUp: { type: 'string' }
            },
            description: 'First trimester bleeding history'
          },

          supportGroupReferral: {
            type: 'object',
            properties: {
              referred: { type: 'boolean' },
              groupType: { type: 'string' },
              location: { type: 'string' },
              frequency: { type: 'string' },
              contact: { type: 'string' }
            },
            description: 'Support group referral information'
          },

          continuousGlucoseMonitorDiscussion: {
            type: 'object',
            properties: {
              discussed: { type: 'boolean' },
              informationProvided: { type: 'boolean' },
              patientResponse: { type: 'string' },
              decisionMade: { type: 'string' }
            },
            description: 'Continuous glucose monitor discussion details'
          },

          glucoseTestingWeeks: {
            type: 'object',
            properties: {
              oneHourTest: { type: 'object', properties: {
                week: { type: 'string' },
                dose: { type: 'string' },
                result: { type: 'string' }
              }},
              threeHourTest: { type: 'object', properties: {
                week: { type: 'string' },
                dose: { type: 'string' },
                result: { type: 'string' }
              }}
            },
            description: 'Specific timing of glucose screening tests'
          },

          pointOfCareUltrasoundHeartRate: {
            type: 'object',
            properties: {
              heartRate: { type: 'string' },
              unit: { type: 'string' },
              method: { type: 'string' }
            },
            description: 'Point of care ultrasound heart rate measurement'
          },

          labSchedule: {
            type: 'object',
            properties: {
              hbA1c: { type: 'string' },
              tsh: { type: 'string' },
              routinePrenatal: { type: 'string' },
              other: { type: 'array', items: { type: 'string' } }
            },
            description: 'Scheduled laboratory tests and timing'
          },

          growthUltrasoundSchedule: {
            type: 'object',
            properties: {
              frequency: { type: 'string' },
              startingWeek: { type: 'string' },
              specificWeeks: { type: 'array', items: { type: 'string' } },
              purpose: { type: 'string' }
            },
            description: 'Fetal growth ultrasound surveillance schedule'
          },

          amnioticFluidIndexCurrent: {
            type: 'object',
            properties: {
              value: { type: 'string' },
              unit: { type: 'string' },
              interpretation: { type: 'string' },
              date: { type: 'string' }
            },
            description: 'Current amniotic fluid index measurement'
          },

          interPregnancyWeightManagement: {
            type: 'object',
            properties: {
              counselingProvided: { type: 'boolean' },
              targetWeight: { type: 'string' },
              strategies: { type: 'array', items: { type: 'string' } },
              followUpPlan: { type: 'string' }
            },
            description: 'Inter-pregnancy weight management counseling'
          },

          glucoseMonitoringFrequency: {
            type: 'object',
            properties: {
              recommended: { type: 'string' },
              current: { type: 'string' },
              adjustments: { type: 'string' },
              concerns: { type: 'string' }
            },
            description: 'Glucose monitoring frequency and patterns'
          },

          sleepDisturbances: {
            type: 'object',
            properties: {
              present: { type: 'boolean' },
              description: { type: 'string' },
              causes: { type: 'array', items: { type: 'string' } },
              interventions: { type: 'array', items: { type: 'string' } }
            },
            description: 'Sleep disturbances and management'
          },

          workAccommodations: {
            type: 'object',
            properties: {
              needed: { type: 'boolean' },
              currentStressors: { type: 'array', items: { type: 'string' } },
              recommendedAccommodations: { type: 'array', items: { type: 'string' } },
              leaveStatus: { type: 'string' }
            },
            description: 'Work accommodations and stress management'
          },

          patientEmotionalResponse: {
            type: 'object',
            properties: {
              emotionalState: { type: 'string' },
              concerns: { type: 'array', items: { type: 'string' } },
              supportNeeded: { type: 'string' },
              response: { type: 'string' }
            },
            description: 'Patient emotional response and support needs'
          },

          immunizationRecord: {
            type: 'object',
            properties: {
              influenza: { type: 'object', properties: {
                given: { type: 'boolean' },
                date: { type: 'string' }
              }},
              tdap: { type: 'object', properties: {
                given: { type: 'boolean' },
                date: { type: 'string' },
                gestationalAgeGiven: { type: 'string' }
              }},
              covid19: { type: 'object' },
              rhogam: { type: 'object', properties: {
                indicated: { type: 'boolean' },
                doses: { type: 'array', items: { type: 'object' } }
              }}
            },
            description: 'Pregnancy immunization tracking'
          },

          // ========== NEPHROLOGY/RENAL FIELDS ==========
          ckdAssessment: {
            type: 'object',
            properties: {
              stage: { type: 'string', description: 'CKD stage 1-5 or 5D' },
              egfr: { type: 'string', description: 'Current eGFR value' },
              egfrTrend: { type: 'array', items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  value: { type: 'string' },
                  method: { type: 'string', description: 'MDRD, CKD-EPI, etc.' }
                }
              }},
              creatinine: { type: 'string' },
              creatinineTrend: { type: 'array', items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  value: { type: 'string' }
                }
              }},
              bun: { type: 'string' },
              bunCreatinineRatio: { type: 'string' },
              progressionRate: { type: 'string', description: 'Stable, slow, rapid' },
              progressionRiskFactors: { type: 'array', items: { type: 'string' }, description: 'Individual risk factors for CKD progression (e.g., "Declining eGFR >5 mL/min/year", "Nephrotic proteinuria", "Uncontrolled hypertension", "Poor glycemic control")' },
              etiology: { type: 'string', description: 'Diabetes, HTN, GN, PKD, etc.' },
              chronicity: { type: 'object', properties: {
                kidneySize: { type: 'string' },
                corticalThickness: { type: 'string' },
                echogenicity: { type: 'string' }
              }}
            },
            description: 'Chronic kidney disease staging and progression'
          },

          proteinuriaAssessment: {
            type: 'object',
            properties: {
              uacr: { type: 'string', description: 'Urine albumin-creatinine ratio' },
              uacrCategory: { type: 'string', description: 'ONLY if explicitly stated: A1, A2, or A3. DO NOT calculate or infer from UACR value - extract only if document explicitly states category.' },
              twentyFourHourProtein: { type: 'string' },
              upcr: { type: 'string', description: 'Urine protein-creatinine ratio' },
              proteinTrend: { type: 'array', items: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'CRITICAL: Must match corresponding egfrTrend date EXACTLY if from same timeline (e.g., if eGFR is "2018-01-01", UACR must also be "2018-01-01")' },
                  value: { type: 'string', description: 'Numeric value only (e.g., "125" not "125 mg/g")' },
                  unit: { type: 'string', description: 'mg/g, mg/24hr, g/24hr' },
                  type: { type: 'string', description: 'UACR, UPCR, 24hr protein' }
                },
                description: 'CRITICAL: If from progression timeline with eGFR, dates MUST match egfrTrend dates exactly'
              }},
              hematuria: { type: 'boolean' },
              hematuriaType: { type: 'string', description: 'Microscopic, gross' },
              rbcCasts: { type: 'boolean' },
              urineElectrophoresis: { type: 'object' }
            },
            description: 'Proteinuria and urinalysis assessment'
          },

          dialysisPlanning: {
            type: 'object',
            properties: {
              modalityPreference: { type: 'string', description: 'HD, PD, home HD' },
              modalityOptions: { type: 'string', description: 'Specific dialysis modalities discussed (e.g., "HD vs PD", "Home HD vs in-center HD")' },
              accessStatus: { type: 'object', properties: {
                type: { type: 'string', description: 'AVF, AVG, PD catheter, CVC' },
                location: { type: 'string' },
                creationDate: { type: 'string' },
                maturationStatus: { type: 'string' },
                complications: { type: 'array', items: { type: 'string' } },
                vascularPreservation: { type: 'array', items: { type: 'string' }, description: 'Instructions like "Avoid PICC lines/subclavian access"' }
              }},
              accessPlanning: { type: 'object', properties: {
                veinMappingStatus: { type: 'string', description: 'Status of vein mapping (e.g., "ordered", "completed", "scheduled")' },
                veinMappingTiming: { type: 'string', description: 'Timing or urgency of vein mapping (e.g., "ordered", "urgent", "scheduled for next week")' },
                vascularSurgeryReferralTiming: { type: 'string', description: 'When to refer to vascular surgery (e.g., "when eGFR <20", "within 3 months")' },
                protectLeftArm: { type: 'boolean', description: 'Protect left arm (non-dominant) for future AVF' },
                protectNonDominantArm: { type: 'string', description: 'Instructions to protect specific arm' },
                avoidPICCLines: { type: 'boolean', description: 'Avoid PICC lines' },
                avoidSubclavianAccess: { type: 'boolean', description: 'Avoid subclavian access' },
                referralToVascularSurgery: { type: 'string', description: 'Referral criteria (e.g., "when eGFR <20")' }
              }},
              socialWorkReferral: { type: 'string', description: 'Social work referral specifically for dialysis planning' },
              urgentStartCriteria: { type: 'array', items: { type: 'string' } },
              educationStatus: { type: 'string', description: 'initiated, ongoing, completed' },
              educationCompleted: { type: 'boolean' },
              educationInitiated: { type: 'object', properties: {
                modalityOptionsDiscussed: { type: 'boolean', description: 'HD vs PD options discussed' },
                referredToRenalEducationClass: { type: 'boolean' },
                tourOfDialysisUnitScheduled: { type: 'boolean' }
              }},
              renalEducationClassDate: { type: 'string', description: 'Scheduled date for renal education class in YYYY-MM-DD format' },
              dialysisUnitTour: { type: 'object', properties: {
                scheduled: { type: 'boolean' },
                date: { type: 'string' },
                status: { type: 'string', description: 'scheduled, completed, pending' }
              }},
              estimatedStartDate: { type: 'string' },
              estimatedTimeToDialysis: { type: 'string', description: 'Estimated time until dialysis needed (e.g., "2-3 years", "6-12 months", "within 1 year")' },
              contraindications: { type: 'array', items: { type: 'string' } },
              homeAssessment: { type: 'object' }
            },
            description: 'Dialysis preparation and access planning'
          },

          currentDialysis: {
            type: 'object',
            properties: {
              modality: { type: 'string', description: 'HD, PD, CRRT' },
              schedule: { type: 'string', description: 'Days and hours' },
              prescription: { type: 'object', properties: {
                bloodFlow: { type: 'string' },
                dialysateFlow: { type: 'string' },
                duration: { type: 'string' },
                membrane: { type: 'string' },
                ultrafiltrationGoal: { type: 'string' }
              }},
              adequacy: { type: 'object', properties: {
                ktv: { type: 'string' },
                urr: { type: 'string' },
                residualFunction: { type: 'string' }
              }},
              complications: { type: 'array', items: { type: 'string' } },
              pdDetails: { type: 'object', properties: {
                dwellTimes: { type: 'array', items: { type: 'string' } },
                exchanges: { type: 'string' },
                solution: { type: 'string' },
                peritonitis: { type: 'array', items: { type: 'object' } }
              }}
            },
            description: 'Current dialysis treatment details'
          },

          transplantEvaluation: {
            type: 'object',
            properties: {
              status: { type: 'string', description: 'Listed, evaluation, not candidate' },
              listingDate: { type: 'string' },
              bloodType: { type: 'string' },
              pra: { type: 'string', description: 'Panel reactive antibodies' },
              hlaTyping: { type: 'object' },
              crossmatchHistory: { type: 'array', items: { type: 'object' } },
              discussedTransplantAsOptimalRRT: { type: 'boolean', description: 'Discussed transplant as optimal renal replacement therapy' },
              willReferWhenEGFRLessThan20: { type: 'boolean', description: 'Will refer when eGFR <20' },
              livingDonorEducation: { type: 'string', description: 'Living donor education provided (e.g., "brother interested")' },
              livingDonors: { type: 'array', items: {
                type: 'object',
                properties: {
                  relationship: { type: 'string' },
                  compatibility: { type: 'string' },
                  evaluationStatus: { type: 'string' }
                }
              }},
              medicalClearance: { type: 'object' },
              cardiacClearanceRequired: { type: 'string', description: 'Cardiac clearance requirements (e.g., "Need cardiac clearance given CAD")' },
              psychosocialEvaluation: { type: 'object' },
              contraindications: { type: 'array', items: { type: 'string' } }
            },
            description: 'Kidney transplant evaluation and listing'
          },

          mineralBoneDisease: {
            type: 'object',
            properties: {
              pth: { type: 'string' },
              pthTrend: { type: 'array', items: { type: 'object' } },
              calcium: { type: 'string' },
              phosphorus: { type: 'string' },
              vitaminD25: { type: 'string' },
              vitaminD125: { type: 'string' },
              alkalinePhosphatase: { type: 'string' },
              medications: { type: 'array', items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  dose: { type: 'string' },
                  indication: { type: 'string' }
                }
              }},
              boneDensity: { type: 'object' },
              vascularCalcification: { type: 'boolean' }
            },
            description: 'CKD-MBD assessment and management'
          },

          renalAnemia: {
            type: 'object',
            properties: {
              hemoglobin: { type: 'string' },
              hemoglobinTarget: { type: 'string' },
              ironStudies: { type: 'object', properties: {
                ferritin: { type: 'string' },
                tsat: { type: 'string' },
                tibc: { type: 'string' }
              }},
              esaTherapy: { type: 'object', properties: {
                agent: { type: 'string' },
                dose: { type: 'string' },
                frequency: { type: 'string' },
                response: { type: 'string' }
              }},
              ironTherapy: { type: 'object', properties: {
                route: { type: 'string', description: 'Oral, IV' },
                agent: { type: 'string' },
                dose: { type: 'string' }
              }},
              transfusionHistory: { type: 'array', items: { type: 'object' } }
            },
            description: 'Anemia of CKD management'
          },

          fluidElectrolyteManagement: {
            type: 'object',
            properties: {
              volumeStatus: { type: 'string', description: 'ONLY if explicitly stated: Euvolemic, hypervolemic, hypovolemic. DO NOT infer from clinical terms like "volume overload" - use exact terminology from document.' },
              dryWeight: { type: 'string' },
              edema: { type: 'string' },
              bloodPressure: { type: 'object', properties: {
                current: { type: 'string' },
                target: { type: 'string' },
                medications: { type: 'array', items: { type: 'string' } }
              }},
              sodium: { type: 'string' },
              potassium: { type: 'string' },
              bicarbonate: { type: 'string' },
              chloride: { type: 'string' },
              acidosisManagement: { type: 'object' },
              hyperkalemiaManagement: { type: 'object' },
              diureticRegimen: { type: 'array', items: { type: 'object' } }
            },
            description: 'Fluid and electrolyte management'
          },

          renalNutrition: {
            type: 'object',
            properties: {
              proteinRestriction: { type: 'string', description: 'g/kg/day' },
              sodiumRestriction: { type: 'string', description: 'mg/day' },
              potassiumRestriction: { type: 'string', description: 'mg/day' },
              phosphorusRestriction: { type: 'string', description: 'mg/day' },
              fluidRestriction: { type: 'string', description: 'mL/day' },
              albumin: { type: 'string' },
              prealbumin: { type: 'string' },
              nutritionalStatus: { type: 'string' },
              lifestyleModifications: { type: 'object', properties: {
                diet: { type: 'object', properties: {
                  referralToRenalDietitian: { type: 'boolean' },
                  proteinRestriction: { type: 'string' },
                  sodiumRestriction: { type: 'string' },
                  potassiumRestriction: { type: 'string' },
                  phosphorusRestriction: { type: 'string' },
                  fluidRestriction: { type: 'string' }
                }},
                exercise: { type: 'object', properties: {
                  cardiacRehabilitationProgram: { type: 'boolean' },
                  lowImpactActivities: { type: 'boolean' },
                  exerciseDetails: { type: 'string', description: 'Specific exercise recommendations including type and duration goal (e.g., "150 minutes/week")' },
                  durationGoal: { type: 'string' }
                }},
                medications: { type: 'object', properties: {
                  avoidNSAIDsAbsolutely: { type: 'boolean', description: 'Avoid NSAIDs absolutely' },
                  noContrastStudiesWithoutNephrologyApproval: { type: 'boolean' },
                  medicationReview: { type: 'string' },
                  pillBoxOrganization: { type: 'boolean' },
                  avoidPICCLines: { type: 'string', description: 'Instructions to avoid PICC lines/subclavian access for vascular preservation' }
                }},
                smokingCessation: { type: 'string' },
                alcoholModeration: { type: 'string' }
              }},
              supplementation: { type: 'array', items: { type: 'string' } },
              dietitianConsult: { type: 'boolean' }
            },
            description: 'Renal diet and nutritional assessment'
          },

          medicationRenalDosing: {
            type: 'object',
            properties: {
              adjustedMedications: { type: 'array', items: {
                type: 'object',
                properties: {
                  medication: { type: 'string' },
                  standardDose: { type: 'string' },
                  renalDose: { type: 'string' },
                  frequency: { type: 'string' },
                  indication: { type: 'string' }
                }
              }},
              contraindicatedMedications: { type: 'array', items: { type: 'string' } },
              nephrotoxicExposures: { type: 'array', items: { type: 'string' } },
              contrastProtocol: { type: 'object' }
            },
            description: 'Medication renal dosing adjustments'
          },

          glomerularDisease: {
            type: 'object',
            properties: {
              diagnosis: { type: 'string' },
              biopsyFindings: { type: 'object', properties: {
                date: { type: 'string' },
                glomeruli: { type: 'string' },
                interstitium: { type: 'string' },
                vessels: { type: 'string' },
                immunofluorescence: { type: 'string' },
                electronMicroscopy: { type: 'string' }
              }},
              immunosuppression: { type: 'array', items: {
                type: 'object',
                properties: {
                  agent: { type: 'string' },
                  dose: { type: 'string' },
                  duration: { type: 'string' },
                  response: { type: 'string' }
                }
              }},
              serologies: { type: 'object', properties: {
                ana: { type: 'string' },
                antiDsDna: { type: 'string' },
                anca: { type: 'string' },
                antiGbm: { type: 'string' },
                complement: { type: 'object' }
              }}
            },
            description: 'Glomerular disease diagnosis and management'
          },

          acuteKidneyInjury: {
            type: 'object',
            properties: {
              stage: { type: 'string', description: 'KDIGO stage 1-3' },
              baselineCreatinine: { type: 'string' },
              peakCreatinine: { type: 'string' },
              urineOutput: { type: 'string' },
              etiology: { type: 'string', description: 'Prerenal, intrinsic, postrenal' },
              precipitants: { type: 'array', items: { type: 'string' } },
              fenA: { type: 'string' },
              feUrea: { type: 'string' },
              urinaryIndices: { type: 'object' },
              recovery: { type: 'string', description: 'Complete, partial, none' },
              dialysisRequired: { type: 'boolean' }
            },
            description: 'Acute kidney injury assessment'
          },

          polycysticKidneyDisease: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'ADPKD, ARPKD' },
              totalKidneyVolume: { type: 'string' },
              mayoClass: { type: 'string' },
              cystComplications: { type: 'array', items: { type: 'string' } },
              extrarenalManifestations: { type: 'object', properties: {
                hepaticCysts: { type: 'boolean' },
                intracranialAneurysm: { type: 'boolean' },
                cardiacValves: { type: 'string' }
              }},
              tolvaptanCandidate: { type: 'boolean' },
              geneticTesting: { type: 'object' }
            },
            description: 'PKD assessment and monitoring'
          },

          diabeticNephropathy: {
            type: 'object',
            properties: {
              albuminuriaStage: { type: 'string' },
              retinopathy: { type: 'boolean' },
              neuropathy: { type: 'boolean' },
              glycemicControl: { type: 'object', properties: {
                hba1c: { type: 'string' },
                target: { type: 'string' }
              }},
              raasBlockade: { type: 'object', properties: {
                agent: { type: 'string' },
                dose: { type: 'string' },
                potassiumMonitoring: { type: 'string' }
              }},
              sglt2Inhibitor: { type: 'object' }
            },
            description: 'Diabetic kidney disease management'
          },

          hypertensiveNephropathy: {
            type: 'object',
            properties: {
              targetOrganDamage: { type: 'array', items: { type: 'string' } },
              bloodPressureControl: { type: 'object', properties: {
                current: { type: 'string' },
                target: { type: 'string' },
                homeReadings: { type: 'array', items: { type: 'object' } },
                ambulatoryMonitoring: { type: 'object' }
              }},
              medications: { type: 'array', items: {
                type: 'object',
                properties: {
                  class: { type: 'string' },
                  agent: { type: 'string' },
                  dose: { type: 'string' }
                }
              }}
            },
            description: 'Hypertensive kidney disease assessment'
          },

          // ========== NEUROLOGY/MOVEMENT DISORDERS FIELDS ==========
          movementDisorderAssessment: {
            type: 'object',
            properties: {
              diagnosis: { type: 'string', description: 'Primary movement disorder diagnosis' },
              hoehnYahrStage: { type: 'string', description: 'Hoehn & Yahr staging for PD' },
              updrsScores: { type: 'object', properties: {
                partI: { type: 'string', description: 'Mentation, behavior, mood' },
                partII: { type: 'string', description: 'Activities of daily living' },
                partIII: { type: 'string', description: 'Motor examination' },
                partIV: { type: 'string', description: 'Complications' },
                total: { type: 'string' }
              }},
              diseaseOnset: { type: 'string' },
              diseaseDuration: { type: 'string' },
              motorSubtype: { type: 'string', description: 'Tremor-dominant, PIGD, mixed' },
              laterality: { type: 'string', description: 'Right, left, bilateral' },
              progressionRate: { type: 'string' }
            },
            description: 'Movement disorder clinical assessment'
          },

          parkinsonianFeatures: {
            type: 'object',
            properties: {
              tremor: { type: 'object', properties: {
                restingTremor: { type: 'string' },
                actionTremor: { type: 'string' },
                location: { type: 'array', items: { type: 'string' } },
                severity: { type: 'string' },
                frequency: { type: 'string' }
              }},
              bradykinesia: { type: 'object', properties: {
                severity: { type: 'string' },
                fingerTapping: { type: 'string' },
                handMovements: { type: 'string' },
                legAgility: { type: 'string' },
                facialExpression: { type: 'string' }
              }},
              rigidity: { type: 'object', properties: {
                severity: { type: 'string' },
                distribution: { type: 'string' },
                cogwheeling: { type: 'boolean' }
              }},
              posturalInstability: { type: 'object', properties: {
                pullTest: { type: 'string' },
                falls: { type: 'string' },
                nearFalls: { type: 'string' },
                balance: { type: 'string' }
              }}
            },
            description: 'Core parkinsonian motor features'
          },

          gaitAnalysis: {
            type: 'object',
            properties: {
              gaitPattern: { type: 'string' },
              strideLength: { type: 'string' },
              armSwing: { type: 'string' },
              turningSteps: { type: 'string' },
              freezingOfGait: { type: 'object', properties: {
                present: { type: 'boolean' },
                frequency: { type: 'string' },
                triggers: { type: 'array', items: { type: 'string' } },
                duration: { type: 'string' }
              }},
              festination: { type: 'boolean' },
              pullTest: { type: 'string', description: 'Pull test results for postural reflexes (e.g., "2-3 steps to recover", "normal", "abnormal postural reflexes")' },
              posture: { type: 'string' },
              assistiveDevice: { type: 'string' },
              walkingSpeed: { type: 'string' },
              dualTasking: { type: 'string' }
            },
            description: 'Detailed gait assessment including fall risk'
          },

          motorComplications: {
            type: 'object',
            properties: {
              motorFluctuations: { type: 'object', properties: {
                wearingOff: { type: 'string' },
                onOffPhenomena: { type: 'string' },
                delayedOn: { type: 'string' },
                noOn: { type: 'string' },
                unpredictableOff: { type: 'string' },
                morningAkinesia: { type: 'string' }
              }},
              dyskinesias: { type: 'object', properties: {
                peakDose: { type: 'string' },
                biphasic: { type: 'string' },
                offPeriod: { type: 'string' },
                severity: { type: 'string' },
                duration: { type: 'string' },
                impact: { type: 'string' }
              }},
              offTime: { type: 'string', description: 'Hours per day' },
              onTimeWithDyskinesia: { type: 'string' },
              onTimeWithoutDyskinesia: { type: 'string' }
            },
            description: 'Motor complications and fluctuations'
          },

          nonMotorSymptoms: {
            type: 'object',
            properties: {
              cognitive: { type: 'object', properties: {
                mocaScore: { type: 'string' },
                mmseScore: { type: 'string' },
                executiveFunction: { type: 'string' },
                memory: { type: 'string' },
                visuospatial: { type: 'string' },
                language: { type: 'string' },
                attention: { type: 'string' }
              }},
              neuropsychiatric: { type: 'object', properties: {
                depression: { type: 'string' },
                anxiety: { type: 'string' },
                apathy: { type: 'string' },
                psychosis: { type: 'string' },
                hallucinations: { type: 'object', properties: {
                  visual: { type: 'string' },
                  auditory: { type: 'string' },
                  other: { type: 'string' },
                  insight: { type: 'string' }
                }},
                impulseControl: { type: 'array', items: { type: 'string' } },
                impulseControlDisorders: { type: 'string', description: 'Monitoring or presence of impulse control disorders (e.g., "monitor for impulse control disorders", "gambling behavior present")' }
              }},
              sleep: { type: 'object', properties: {
                remSleepBehavior: { type: 'string' },
                insomnia: { type: 'string' },
                daytimeSomnolence: { type: 'string' },
                restlessLegs: { type: 'string' },
                sleepAttacks: { type: 'string' },
                sleepDuration: { type: 'string', description: 'Hours of sleep per night (e.g., "6-7 hours nightly")' }
              }},
              autonomic: { type: 'object', properties: {
                orthostaticHypotension: { type: 'string' },
                constipation: { type: 'string' },
                urinaryDysfunction: { type: 'string' },
                sexualDysfunction: { type: 'string' },
                hyperhidrosis: { type: 'string' }
              }},
              sensory: { type: 'object', properties: {
                pain: { type: 'string' },
                hyposmia: { type: 'string' },
                paresthesias: { type: 'string' }
              }}
            },
            description: 'Non-motor symptoms assessment'
          },

          intervalHistory: {
            type: 'object',
            properties: {
              physicalTherapy: { type: 'string', description: 'Physical therapy regimen, frequency, programs (e.g., "LSVT BIG twice weekly")' },
              speechTherapy: { type: 'string', description: 'Speech therapy status, programs, outcomes (e.g., "Completed LSVT LOUD, voice stronger")' },
              exercise: { type: 'string', description: 'Exercise regimen and functional changes (e.g., "Daily walking 20-30 minutes, difficulty maintaining pace")' },
              sleep: { type: 'string', description: 'Sleep quality and duration (e.g., "6-7 hours nightly, acting out dreams 1-2 times weekly")' },
              mood: { type: 'string', description: 'Mood and anxiety assessment (e.g., "Mild anxiety about disease progression, no depression")' }
            },
            description: 'Interval history between visits for longitudinal tracking'
          },

          neurologicalExam: {
            type: 'object',
            properties: {
              mentalStatus: { type: 'object', properties: {
                orientation: { type: 'string' },
                attention: { type: 'string' },
                language: { type: 'string' },
                memory: { type: 'string' },
                calculation: { type: 'string' },
                glasgowComaScale: { type: 'string', description: 'GCS score (E+V+M)' },
                rassScore: { type: 'string', description: 'Richmond Agitation-Sedation Scale (-5 to +4)' }
              }},
              pupils: { type: 'object', properties: {
                size: { type: 'string', description: 'Size in mm (e.g., "3mm bilaterally")' },
                reactivity: { type: 'string', description: 'Reaction to light (e.g., "PERRL")' },
                shape: { type: 'string', description: 'Shape (round, irregular, etc.)' },
                symmetry: { type: 'string', description: 'Equal or unequal' }
              }},
              cranialNerves: { type: 'object', properties: {
                findings: { type: 'array', items: { type: 'string' } },
                eyeMovements: { type: 'string' },
                verticalGazeLimitation: { type: 'string', description: 'Vertical gaze limitation if present (e.g., "mildly limited", "restricted upward gaze")' },
                facialSymmetry: { type: 'string' },
                facialExpression: { type: 'string', description: 'Facial expression quality (e.g., "masked facies", "hypomimia", "reduced expressivity")' },
                blinkRate: { type: 'string', description: 'Blink rate assessment (e.g., "decreased", "normal", "reduced")' },
                hearing: { type: 'string' },
                swallowing: { type: 'string' }
              }},
              speech: { type: 'object', properties: {
                quality: { type: 'string', description: 'Speech quality (e.g., "hypophonic but intelligible", "slurred", "dysarthric")' },
                volume: { type: 'string', description: 'Speech volume (e.g., "hypophonic", "soft", "normal")' },
                clarity: { type: 'string', description: 'Speech clarity (e.g., "intelligible", "unclear")' }
              }},
              motor: { type: 'object', properties: {
                strength: { type: 'string' },
                tone: { type: 'string' },
                bulkSymmetry: { type: 'string' }
              }},
              sensory: { type: 'object', properties: {
                lightTouch: { type: 'string' },
                pinprick: { type: 'string' },
                vibration: { type: 'string' },
                proprioception: { type: 'string' }
              }},
              reflexes: { type: 'object', properties: {
                deepTendon: { type: 'string' },
                plantar: { type: 'string' },
                primitiveReflexes: { type: 'array', items: { type: 'string' } }
              }},
              coordination: { type: 'object', properties: {
                fingerNoseFinger: { type: 'string' },
                heelKneeShin: { type: 'string' },
                rapidAlternating: { type: 'string' }
              }},
              gait: { type: 'string', description: 'Gait assessment (e.g., "Steady", "Steady with mild left arm swing reduction", "Ataxic")' }
            },
            description: 'Complete neurological examination'
          },

          neuropsychologicalTestingResults: {
            type: 'object',
            properties: {
              executiveFunction: { type: 'string', description: 'Executive function assessment (e.g., "Mild executive dysfunction")' },
              verbalFluency: { type: 'string', description: 'Verbal fluency results (e.g., "Reduced", "Normal")' },
              processingSpeed: { type: 'string', description: 'Processing speed assessment (e.g., "Decreased", "Normal")' },
              memory: { type: 'string', description: 'Memory assessment (e.g., "Relatively preserved", "Impaired")' },
              overallFindings: { type: 'string', description: 'Overall neuropsychological testing summary' },

              comprehensiveTestBattery: {
                type: 'object',
                properties: {
                  batteryName: { type: 'string', description: 'Test battery administered (e.g., "Halstead-Reitan", "Wechsler Adult Intelligence Scale", "Comprehensive Trail Making Test")' },
                  testDate: { type: 'string', description: 'Date of testing' },
                  testDuration: { type: 'string', description: 'Duration of testing session (e.g., "4 hours")' },
                  examinee: { type: 'string', description: 'Neuropsychologist who administered tests' },
                  testingConditions: { type: 'string', description: 'Conditions (Optimal, Suboptimal due to fatigue/pain/anxiety)' },
                  effortTesting: { type: 'string', description: 'Effort validity testing results (Adequate effort, Insufficient effort)' }
                },
                description: 'Test battery administration details'
              },

              cognitiveDomainsDetailed: {
                type: 'object',
                properties: {
                  memory: {
                    type: 'object',
                    properties: {
                      verbalMemory: {
                        type: 'object',
                        properties: {
                          testUsed: { type: 'string', description: 'Test name (e.g., "CVLT-II", "WMS-IV Logical Memory")' },
                          immediateRecall: { type: 'object', properties: {
                            rawScore: { type: 'string' },
                            scaledScore: { type: 'string' },
                            percentile: { type: 'string', description: 'Percentile compared to age-matched norms' },
                            classification: { type: 'string', enum: ['Superior', 'High average', 'Average', 'Low average', 'Borderline', 'Impaired'] }
                          }},
                          delayedRecall: { type: 'object', properties: {
                            rawScore: { type: 'string' },
                            scaledScore: { type: 'string' },
                            percentile: { type: 'string' },
                            classification: { type: 'string', enum: ['Superior', 'High average', 'Average', 'Low average', 'Borderline', 'Impaired'] }
                          }},
                          recognition: { type: 'object', properties: {
                            rawScore: { type: 'string' },
                            scaledScore: { type: 'string' },
                            percentile: { type: 'string' },
                            classification: { type: 'string', enum: ['Superior', 'High average', 'Average', 'Low average', 'Borderline', 'Impaired'] }
                          }}
                        }
                      },
                      visualMemory: {
                        type: 'object',
                        properties: {
                          testUsed: { type: 'string', description: 'Test name (e.g., "BVMT-R", "WMS-IV Visual Reproduction")' },
                          immediateRecall: { type: 'object', properties: { rawScore: { type: 'string' }, percentile: { type: 'string' }, classification: { type: 'string' } }},
                          delayedRecall: { type: 'object', properties: { rawScore: { type: 'string' }, percentile: { type: 'string' }, classification: { type: 'string' } }}
                        }
                      },
                      workingMemory: {
                        type: 'object',
                        properties: {
                          testUsed: { type: 'string', description: 'Test name (e.g., "WAIS-IV Digit Span", "Letter-Number Sequencing")' },
                          digitSpanForward: { type: 'object', properties: { rawScore: { type: 'string' }, percentile: { type: 'string' } }},
                          digitSpanBackward: { type: 'object', properties: { rawScore: { type: 'string' }, percentile: { type: 'string' } }},
                          overallWorkingMemory: { type: 'object', properties: { percentile: { type: 'string' }, classification: { type: 'string' } }}
                        }
                      }
                    },
                    description: 'Memory domain - verbal, visual, and working memory'
                  },

                  attention: {
                    type: 'object',
                    properties: {
                      sustainedAttention: {
                        type: 'object',
                        properties: {
                          testUsed: { type: 'string', description: 'Test (e.g., "CPT-3", "TOVA")' },
                          omissionErrors: { type: 'string', description: 'Missed targets (higher = inattention)' },
                          commissionErrors: { type: 'string', description: 'False positives (higher = impulsivity)' },
                          percentile: { type: 'string' },
                          classification: { type: 'string' }
                        }
                      },
                      selectiveAttention: {
                        type: 'object',
                        properties: {
                          testUsed: { type: 'string', description: 'Test (e.g., "Stroop Color-Word Test")' },
                          score: { type: 'string' },
                          percentile: { type: 'string' },
                          classification: { type: 'string' }
                        }
                      },
                      processingSpeed: {
                        type: 'object',
                        properties: {
                          testUsed: { type: 'string', description: 'Test (e.g., "WAIS-IV Coding", "Symbol Search", "Trail Making Test A")' },
                          score: { type: 'string' },
                          percentile: { type: 'string' },
                          classification: { type: 'string' }
                        }
                      }
                    },
                    description: 'Attention domain - sustained, selective, processing speed'
                  },

                  executiveFunction: {
                    type: 'object',
                    properties: {
                      cognitiveFlexibility: {
                        type: 'object',
                        properties: {
                          testUsed: { type: 'string', description: 'Test (e.g., "Trail Making Test B", "Wisconsin Card Sorting Test")' },
                          score: { type: 'string' },
                          perseverativeErrors: { type: 'string', description: 'For WCST - inability to shift sets' },
                          percentile: { type: 'string' },
                          classification: { type: 'string' }
                        }
                      },
                      planning: {
                        type: 'object',
                        properties: {
                          testUsed: { type: 'string', description: 'Test (e.g., "Tower of London", "DKEFS Tower Test")' },
                          score: { type: 'string' },
                          percentile: { type: 'string' },
                          classification: { type: 'string' }
                        }
                      },
                      inhibition: {
                        type: 'object',
                        properties: {
                          testUsed: { type: 'string', description: 'Test (e.g., "Stroop Interference", "Go/No-Go")' },
                          score: { type: 'string' },
                          percentile: { type: 'string' },
                          classification: { type: 'string' }
                        }
                      },
                      verbalFluency: {
                        type: 'object',
                        properties: {
                          phoneticFluency: { type: 'object', properties: { testUsed: { type: 'string', description: 'FAS test' }, score: { type: 'string' }, percentile: { type: 'string' } }},
                          semanticFluency: { type: 'object', properties: { testUsed: { type: 'string', description: 'Category fluency (animals, etc.)' }, score: { type: 'string' }, percentile: { type: 'string' } }}
                        }
                      }
                    },
                    description: 'Executive function - flexibility, planning, inhibition, fluency'
                  },

                  language: {
                    type: 'object',
                    properties: {
                      confrontationNaming: {
                        type: 'object',
                        properties: {
                          testUsed: { type: 'string', description: 'Test (e.g., "Boston Naming Test")' },
                          score: { type: 'string' },
                          percentile: { type: 'string' },
                          classification: { type: 'string' }
                        }
                      },
                      comprehension: {
                        type: 'object',
                        properties: {
                          testUsed: { type: 'string', description: 'Test (e.g., "Token Test", "WAIS-IV Comprehension")' },
                          score: { type: 'string' },
                          percentile: { type: 'string' },
                          classification: { type: 'string' }
                        }
                      },
                      repetition: {
                        type: 'object',
                        properties: {
                          score: { type: 'string' },
                          classification: { type: 'string' }
                        }
                      }
                    },
                    description: 'Language domain - naming, comprehension, repetition'
                  },

                  visuospatial: {
                    type: 'object',
                    properties: {
                      visualConstruction: {
                        type: 'object',
                        properties: {
                          testUsed: { type: 'string', description: 'Test (e.g., "Rey-Osterrieth Complex Figure Copy", "Block Design")' },
                          score: { type: 'string' },
                          percentile: { type: 'string' },
                          classification: { type: 'string' }
                        }
                      },
                      visualPerception: {
                        type: 'object',
                        properties: {
                          testUsed: { type: 'string', description: 'Test (e.g., "Visual Object and Space Perception Battery")' },
                          score: { type: 'string' },
                          percentile: { type: 'string' },
                          classification: { type: 'string' }
                        }
                      }
                    },
                    description: 'Visuospatial domain - construction, perception'
                  }
                },
                description: 'Detailed cognitive domain testing with percentiles and classifications'
              },

              prePostComparison: {
                type: 'object',
                properties: {
                  preOperativeBaseline: { type: 'string', description: 'Date of pre-operative testing' },
                  postOperativeFollowUp: { type: 'string', description: 'Date of post-operative testing' },
                  intervalBetweenTests: { type: 'string', description: 'Time between tests (e.g., "6 months post-op")' },
                  domainChanges: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        domain: { type: 'string', description: 'Cognitive domain (Memory, Attention, Executive, Language, Visuospatial)' },
                        preOperativePercentile: { type: 'string' },
                        postOperativePercentile: { type: 'string' },
                        changeDirection: { type: 'string', enum: ['Improved', 'Stable', 'Declined'], description: 'Direction of change' },
                        clinicalSignificance: { type: 'string', description: 'Is change clinically significant (>1 SD = significant)' }
                      }
                    },
                    description: 'Domain-by-domain pre/post comparison'
                  },
                  overallOutcome: { type: 'string', description: 'Overall cognitive outcome (Improved, No change, Mild decline, Moderate decline, Severe decline)' }
                },
                description: 'Pre/post-operative comparison - for surgical outcome assessment'
              },

              functionalImplications: {
                type: 'object',
                properties: {
                  workCapacity: { type: 'string', description: 'Ability to work (Full capacity, Reduced capacity, Unable to work, Modified duties needed)' },
                  drivingSafety: { type: 'string', description: 'Driving safety assessment (Safe to drive, Needs driving evaluation, Should not drive)' },
                  independentLiving: { type: 'string', description: 'Can live independently (Fully independent, Needs supervision, Needs assistance with IADLs/ADLs)' },
                  medicationManagement: { type: 'string', description: 'Ability to manage medications independently' },
                  financialManagement: { type: 'string', description: 'Ability to handle finances' },
                  socialFunctioning: { type: 'string', description: 'Impact on social relationships and activities' }
                },
                description: 'Functional implications of cognitive deficits for daily living'
              },

              cognitiveRehabilitationPlan: {
                type: 'object',
                properties: {
                  indicated: { type: 'boolean', description: 'Is cognitive rehabilitation recommended' },
                  targetDomains: { type: 'array', items: { type: 'string' }, description: 'Cognitive domains to target (Memory, Attention, Executive function, etc.)' },
                  recommendedFrequency: { type: 'string', description: 'Recommended frequency (e.g., "2x per week for 12 weeks")' },
                  compensatoryStrategies: { type: 'array', items: { type: 'string' }, description: 'Strategies taught (Memory aids, Calendar/organizer, Environmental modifications, etc.)' },
                  referralMade: { type: 'boolean', description: 'Referral made to cognitive rehabilitation specialist' }
                },
                description: 'Cognitive rehabilitation recommendations'
              },

              diagnosisImplications: {
                type: 'object',
                properties: {
                  cognitiveDisorders: { type: 'array', items: { type: 'string' }, description: 'Cognitive diagnoses supported (Mild Cognitive Impairment, Dementia, Post-surgical cognitive dysfunction, Traumatic brain injury sequelae)' },
                  severity: { type: 'string', enum: ['Normal cognition', 'Mild impairment', 'Moderate impairment', 'Severe impairment'], description: 'Overall severity' },
                  prognosis: { type: 'string', description: 'Prognosis for recovery or progression' }
                },
                description: 'Diagnostic and prognostic implications'
              }
            },
            description: 'Baseline cognitive assessment for surgical planning'
          },

          parkinsonMedications: {
            type: 'object',
            properties: {
              levodopa: { type: 'object', properties: {
                formulation: { type: 'string' },
                totalDailyDose: { type: 'string' },
                frequency: { type: 'string' },
                timingWithMeals: { type: 'string' }
              }},
              dopamineAgonists: { type: 'array', items: {
                type: 'object',
                properties: {
                  medication: { type: 'string' },
                  dose: { type: 'string' },
                  frequency: { type: 'string' }
                }
              }},
              maoInhibitors: { type: 'array', items: { type: 'object' } },
              comtInhibitors: { type: 'array', items: { type: 'object' } },
              anticholinergics: { type: 'array', items: { type: 'object' } },
              amantadine: { type: 'object' },
              symptomatic: { type: 'array', items: { type: 'object' } },
              ledEquivalent: { type: 'string', description: 'Levodopa equivalent daily dose' }
            },
            description: 'Parkinson disease medications'
          },

          deepBrainStimulation: {
            type: 'object',
            properties: {
              status: { type: 'string', description: 'Candidate, implanted, not candidate' },
              target: { type: 'string', description: 'STN, GPi, VIM' },
              laterality: { type: 'string' },
              implantDate: { type: 'string' },
              programmingSettings: { type: 'object', properties: {
                rightSide: { type: 'object' },
                leftSide: { type: 'object' },
                lastAdjustment: { type: 'string' }
              }},
              response: { type: 'string' },
              complications: { type: 'array', items: { type: 'string' } }
            },
            description: 'Deep brain stimulation therapy'
          },

          epilepsyAssessment: {
            type: 'object',
            properties: {
              seizureTypes: { type: 'array', items: { type: 'string' } },
              seizureFrequency: { type: 'string' },
              lastSeizure: { type: 'string' },
              triggers: { type: 'array', items: { type: 'string' } },
              auraSymptoms: { type: 'array', items: { type: 'string' } },
              postictalSymptoms: { type: 'array', items: { type: 'string' } },
              antiEpilepticDrugs: { type: 'array', items: {
                type: 'object',
                properties: {
                  medication: { type: 'string' },
                  dose: { type: 'string' },
                  level: { type: 'string' },
                  sideEffects: { type: 'array', items: { type: 'string' } }
                }
              }},
              eegFindings: { type: 'string' },
              seizureDiary: { type: 'array', items: { type: 'object' } },
              vagusNerveStimulator: { type: 'object' }
            },
            description: 'Epilepsy evaluation and management'
          },

          diagnosticStudies: {
            type: 'object',
            properties: {
              vitaminB12: { type: 'string', description: 'Vitamin B12 testing plan or results (e.g., "Check if not done recently")' },
              thyroidFunction: { type: 'string', description: 'Thyroid function testing plan or results' },
              brainMRI: { type: 'string', description: 'Brain MRI plan, indication, or conditional orders (e.g., "If cognitive symptoms rapidly progress")' },
              orthostaticVitals: { type: 'string', description: 'Orthostatic vital signs testing plan (e.g., "At next visit")' },
              daTscan: { type: 'string', description: 'DaTscan indication, plan, or reason not ordered (e.g., "Not indicated - clinical diagnosis clear")' }
            },
            description: 'Planned or completed diagnostic studies'
          },

          clinicalTrialInterest: {
            type: 'string',
            description: 'Patient interest in clinical trial participation and actions taken (e.g., "Interested - provided research coordinator contact")'
          },

          researchCoordinatorContact: {
            type: 'string',
            description: 'Research coordinator contact information provided to patient (e.g., "Provided research coordinator contact information")'
          },

          drivingSafetyStatus: {
            type: 'string',
            description: 'Driving safety assessment and recommendations (e.g., "Currently safe but will need ongoing assessment", "Recommend driving evaluation")'
          },

          careCoordination: {
            type: 'object',
            properties: {
              primaryCareProvider: { type: 'object', properties: {
                name: { type: 'string' },
                lastCommunication: { type: 'string' },
                communicationDate: { type: 'string', description: 'Date of communication' }
              }},
              specialists: { type: 'array', items: { type: 'string' } },
              physicalTherapyNotesReviewed: { type: 'boolean', description: 'Whether PT notes were reviewed for care coordination' },
              nurseSpecialistConsult: { type: 'string' }
            },
            description: 'Care coordination and team communication'
          },

          caregiverSupport: {
            type: 'object',
            properties: {
              resourcesProvided: { type: 'string', description: 'Caregiver support resources provided (e.g., "Caregiver stress manageable, provided support resources")' },
              caregiverBurden: { type: 'string', description: 'Assessment of caregiver burden or stress level' }
            },
            description: 'Caregiver support and resources'
          },

          supportGroup: {
            type: 'object',
            properties: {
              information: { type: 'string', description: 'Support group information provided (e.g., "Provided information for local PD support group")' },
              attendance: { type: 'string', description: 'Patient attendance or interest in support groups' }
            },
            description: 'Patient education and support group information'
          },

          headacheAssessment: {
            type: 'object',
            properties: {
              headacheType: { type: 'string', description: 'Migraine, tension, cluster' },
              frequency: { type: 'string' },
              severity: { type: 'string' },
              duration: { type: 'string' },
              location: { type: 'string' },
              quality: { type: 'string' },
              triggers: { type: 'array', items: { type: 'string' } },
              associatedSymptoms: { type: 'object', properties: {
                nausea: { type: 'boolean' },
                photophobia: { type: 'boolean' },
                phonophobia: { type: 'boolean' },
                aura: { type: 'string' }
              }},
              abortiveTherapy: { type: 'array', items: { type: 'object' } },
              preventiveTherapy: { type: 'array', items: { type: 'object' } },
              headacheDiary: { type: 'array', items: { type: 'object' } },
              midasScore: { type: 'string' }
            },
            description: 'Headache evaluation'
          },

          multipleSclerosisAssessment: {
            type: 'object',
            properties: {
              msType: { type: 'string', description: 'RRMS, SPMS, PPMS, CIS' },
              edssScore: { type: 'string', description: 'Expanded Disability Status Scale' },
              relapseHistory: { type: 'array', items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  symptoms: { type: 'array', items: { type: 'string' } },
                  treatment: { type: 'string' },
                  recovery: { type: 'string' }
                }
              }},
              currentDmt: { type: 'object', properties: {
                medication: { type: 'string' },
                startDate: { type: 'string' },
                efficacy: { type: 'string' },
                sideEffects: { type: 'array', items: { type: 'string' } }
              }},
              mriFindings: { type: 'object', properties: {
                newLesions: { type: 'string', description: 'Number of new lesions (e.g., "17", "2 new T2 lesions")' },
                enhancingLesions: { type: 'string', description: 'Number of gadolinium-enhancing lesions (e.g., "3", "No enhancing lesions")' },
                gadoliniumEnhancingLesionCount: { type: 'number', description: 'IMPORTANT: Numeric count of gadolinium-enhancing lesions from Quantitative Metrics section. Critical for disease activity monitoring.' },
                t2Burden: { type: 'string', description: 'T2 lesion burden/volume (e.g., "4.8 mL")' },
                t1BlackHoleVolume: { type: 'string', description: 'IMPORTANT: T1 black hole volume in mL (e.g., "0.9 mL"). Critical quantitative metric for MS disease burden.' },
                atrophy: { type: 'string', description: 'Brain atrophy assessment (e.g., "Brain Parenchymal Fraction: 0.82", "mild", "moderate")' },
                mcDonaldCriteria: {
                  type: 'object',
                  properties: {
                    assessment: { type: 'string', description: 'McDonald Criteria version (e.g., "2017")' },
                    disseminationInSpace: {
                      type: 'object',
                      properties: {
                        met: { type: 'boolean', description: 'DIS criteria met (YES/NO)' },
                        periventricular: { type: 'string', description: 'Periventricular lesions (e.g., ">3 lesions")' },
                        juxtacortical: { type: 'string', description: 'Juxtacortical lesions (e.g., ">1 lesion")' },
                        infratentorial: { type: 'string', description: 'Infratentorial lesions (e.g., "brainstem + cerebellum")' },
                        spinalCord: { type: 'string', description: 'Spinal cord lesions (e.g., "multiple lesions")' }
                      },
                      description: 'CRITICAL: Dissemination in Space criteria breakdown. Essential for MS diagnosis documentation.'
                    },
                    disseminationInTime: {
                      type: 'object',
                      properties: {
                        met: { type: 'boolean', description: 'DIT criteria met (YES/NO)' },
                        details: { type: 'string', description: 'Details of how DIT criteria met' }
                      },
                      description: 'CRITICAL: Dissemination in Time criteria. Essential for MS diagnosis documentation.'
                    }
                  },
                  description: 'CRITICAL: McDonald Criteria Assessment for MS diagnosis. Must extract structured DIS/DIT breakdown.'
                }
              }},
              symptomManagement: { type: 'object', properties: {
                spasticity: { type: 'string' },
                fatigue: { type: 'string' },
                bladderDysfunction: { type: 'string' },
                neuropathicPain: { type: 'string' }
              }}
            },
            description: 'Multiple sclerosis assessment'
          },

          strokeAssessment: {
            type: 'object',
            properties: {
              strokeType: { type: 'string', description: 'Ischemic, hemorrhagic, TIA' },
              nihssScore: { type: 'string', description: 'NIH Stroke Scale' },
              mrsScore: { type: 'string', description: 'Modified Rankin Scale' },
              territory: { type: 'string' },
              mechanism: { type: 'string' },
              thrombolysis: { type: 'object' },
              thrombectomy: { type: 'object' },
              deficits: { type: 'array', items: { type: 'string' } },
              secondaryPrevention: { type: 'object', properties: {
                antiplatelets: { type: 'array', items: { type: 'string' } },
                anticoagulation: { type: 'string' },
                statins: { type: 'string' },
                bloodPressureControl: { type: 'string' }
              }}
            },
            description: 'Stroke evaluation and management'
          },

          dementiaAssessment: {
            type: 'object',
            properties: {
              dementiaType: { type: 'string', description: 'Alzheimer, vascular, Lewy body, FTD' },
              cdrsScore: { type: 'string', description: 'Clinical Dementia Rating' },
              functionalStatus: { type: 'object', properties: {
                adls: { type: 'string' },
                iadls: { type: 'string' }
              }},
              behavioralSymptoms: { type: 'array', items: { type: 'string' } },
              cognitiveEnhancers: { type: 'array', items: { type: 'object' } },
              caregiverBurden: { type: 'string' },
              safetyAssessment: { type: 'object', properties: {
                driving: { type: 'string' },
                homeAlone: { type: 'string' },
                medication: { type: 'string' },
                wandering: { type: 'string' }
              }},
              advanceDirectives: { type: 'object' }
            },
            description: 'Dementia evaluation'
          },

          peripheralNeuropathy: {
            type: 'object',
            properties: {
              pattern: { type: 'string', description: 'Length-dependent, non-length dependent' },
              distribution: { type: 'string' },
              sensorySymptoms: { type: 'array', items: { type: 'string' } },
              motorSymptoms: { type: 'array', items: { type: 'string' } },
              autonomicSymptoms: { type: 'array', items: { type: 'string' } },
              ncvEmgFindings: { type: 'object' },
              etiology: { type: 'string' },
              neuropathicPainScale: { type: 'string' },
              treatment: { type: 'array', items: { type: 'object' } }
            },
            description: 'Peripheral neuropathy assessment'
          },

          neuromuscularDisorder: {
            type: 'object',
            properties: {
              diagnosis: { type: 'string' },
              muscleWeakness: { type: 'object', properties: {
                distribution: { type: 'string' },
                mrcScale: { type: 'object' }
              }},
              muscleAtrophy: { type: 'array', items: { type: 'string' } },
              fasciculations: { type: 'array', items: { type: 'string' } },
              reflexChanges: { type: 'string' },
              respiratoryFunction: { type: 'object', properties: {
                fvc: { type: 'string' },
                mip: { type: 'string' },
                mep: { type: 'string' }
              }},
              bulbarFunction: { type: 'string' },
              alsfrScore: { type: 'string', description: 'ALS Functional Rating Scale' }
            },
            description: 'Neuromuscular disorder assessment'
          },

          // ========== COMPREHENSIVE SURGICAL FIELDS ==========
          surgicalTeam: {
            type: 'object',
            properties: {
              primarySurgeon: { type: 'string' },
              assistantSurgeons: { type: 'array', items: { type: 'string' } },
              anesthesiologist: { type: 'string' },
              scrubNurse: { type: 'string' },
              circulatingNurse: { type: 'string' },
              residents: { type: 'array', items: { type: 'string' } },
              students: { type: 'array', items: { type: 'string' } }
            },
            description: 'Complete surgical team documentation'
          },

          operativeDetails: {
            type: 'object',
            properties: {
              startTime: { type: 'string' },
              endTime: { type: 'string' },
              totalDuration: { type: 'string' },
              estimatedDuration: { type: 'string', description: 'Estimated surgery duration for planning (e.g., "4-6 hours", "2-3 hours")' },
              surgeryDate: { type: 'string' },
              scheduledTiming: { type: 'string', description: 'IMPORTANT: Planned surgery scheduling timeframe (e.g., "Schedule in 6-8 weeks", "Surgery planned for 3 months from now")' },
              surgeonName: { type: 'string', description: 'Primary surgeon full name and specialty (e.g., "Dr. Mark Anderson, Orthopedic Surgery")' },
              assistantSurgeons: { type: 'array', items: { type: 'string' } },
              anesthesiologist: { type: 'string' },
              preoperativeDiagnosis: { type: 'array', items: { type: 'string' } },
              postoperativeDiagnosis: { type: 'array', items: { type: 'string' } },
              proceduresPerformed: {
                type: 'array',
                items: { type: 'string' },
                description: 'COMPLETE procedure names with laterality (e.g., "left total knee arthroplasty" not "Total Knee Replacement")'
              },
              laterality: { type: 'string', description: 'left, right, bilateral' },
              indication: { type: 'string' },
              urgency: { type: 'string', description: 'elective, urgent, emergent' },
              hospitalStay: { type: 'string', description: 'Expected or actual hospital length of stay (e.g., "4-5 days", "3 days")' },
              microsurgicalTeam: {
                type: 'array',
                items: { type: 'string' },
                description: 'Complete microsurgical team for complex reconstructive procedures (e.g., ["Dr. Thompson", "Dr. Chen"])'
              },
              perioperativeProtocol: {
                type: 'object',
                properties: {
                  preoperativeOptimization: { type: 'string', description: 'IMPORTANT: Preoperative optimization measures (e.g., "Protein supplementation", "Smoking cessation", "Weight optimization")' },
                  dvtProphylaxis: { type: 'string', description: 'CRITICAL: DVT prophylaxis protocol including medications and mechanical devices (e.g., "Sequential compression devices", "Enoxaparin postoperatively", "Early mobilization")' },
                  icuMonitoring: { type: 'string', description: 'ICU monitoring plan (e.g., "ICU monitoring first 24 hours", "No ICU needed")' },
                  enhancedRecoveryPathway: { type: 'boolean', description: 'Whether enhanced recovery pathway is being used' },
                  flapMonitoringProtocol: { type: 'string', description: 'Flap monitoring frequency and method for reconstructive surgery' }
                },
                description: 'Perioperative care protocols and monitoring plans'
              }
            },
            description: 'Comprehensive operative timing and diagnosis data'
          },

          anesthesiaRecord: {
            type: 'object',
            properties: {
              anesthesiaType: { type: 'string', description: 'General, regional, MAC, local with sedation' },
              intubationType: { type: 'string', description: 'ETT, LMA, nasal, etc.' },
              induction: { type: 'object', properties: {
                agents: { type: 'array', items: { type: 'string' } },
                complications: { type: 'string' }
              }},
              maintenance: { type: 'object', properties: {
                agents: { type: 'array', items: { type: 'string' } },
                fluids: { type: 'string' },
                bloodProducts: { type: 'array', items: { type: 'string' } }
              }},
              emergence: { type: 'string' },
              monitoring: { type: 'array', items: { type: 'string' } },
              complications: { type: 'array', items: { type: 'string' } }
            },
            description: 'Detailed anesthesia documentation'
          },

          surgicalApproach: {
            type: 'object',
            properties: {
              technique: { type: 'string', description: 'Open, laparoscopic, robotic, percutaneous' },
              positioning: { type: 'string', description: 'Supine, prone, lateral, etc.' },
              prepAndDraping: { type: 'string' },
              pneumoperitoneum: {
                type: 'object',
                properties: {
                  pressure: { type: 'string', description: 'Insufflation pressure (e.g., "15mmHg")' },
                  method: { type: 'string', description: 'Veress needle, Hasson technique, optical trocar' },
                  location: { type: 'string', description: 'Entry site (e.g., "at umbilicus")' }
                },
                description: 'Pneumoperitoneum establishment details for laparoscopic surgery'
              },
              portPlacement: { type: 'array', items: { type: 'object', properties: {
                size: { type: 'string' },
                location: { type: 'string' },
                purpose: { type: 'string' }
              }}},
              incisions: { type: 'array', items: { type: 'object', properties: {
                type: { type: 'string' },
                location: { type: 'string' },
                length: { type: 'string' }
              }}}
            },
            description: 'Surgical approach and access details'
          },

          operativeTechnique: {
            type: 'object',
            properties: {
              dissectionMethod: { type: 'string', description: 'Dissection technique (e.g., "electrocautery", "ultrasonic scalpel", "sharp dissection")' },
              specimenRemoval: {
                type: 'object',
                properties: {
                  method: { type: 'string', description: 'Removal method (e.g., "via umbilical port", "through pfannenstiel incision")' },
                  extractionBagUsed: { type: 'boolean', description: 'Whether extraction/specimen bag was used' }
                },
                description: 'Specimen removal technique'
              },
              hemostasis: { type: 'string', description: 'Hemostasis technique and confirmation' },
              irrigation: { type: 'string', description: 'Irrigation fluids and volumes used' },
              perforatorsPerFlap: { type: 'string', description: 'Number of perforators harvested per flap for microsurgical reconstruction (e.g., "2-3 perforators each", "2 perforators on right, 3 on left")' },
              closureTechnique: { type: 'string', description: 'Specific closure technique details (e.g., "Abdominal closure with progressive tension sutures", "Layered closure with vicryl and monocryl")' },
              recipientVessels: { type: 'string', description: 'CRITICAL: Specific recipient vessels for microsurgical anastomosis (e.g., "Internal mammary arteries and veins")' },
              drainPlacement: { type: 'string', description: 'IMPORTANT: Drain placement details including number and location (e.g., "Drain placement (4 drains total)", "2 drains per flap")' }
            },
            description: 'Detailed operative technique documentation'
          },

          intraoperativeFindings: {
            type: 'object',
            properties: {
              normalAnatomy: { type: 'boolean' },
              anatomicalVariants: { type: 'array', items: { type: 'string' } },
              pathologicalFindings: { type: 'array', items: { type: 'string' } },
              remnantTissue: { type: 'string', description: 'Remnant tissue assessment (e.g., "good remnant tissue for proprioception preservation")' },
              adhesions: { type: 'object', properties: {
                severity: { type: 'string', description: 'None, mild, moderate, severe' },
                location: { type: 'array', items: { type: 'string' } }
              }},
              contamination: { type: 'string' },
              additionalProcedures: { type: 'array', items: { type: 'string' } },
              perforationStatus: { type: 'string', description: 'Perforation status (e.g., "No perforation or empyema")' },
              liverAppearance: { type: 'string', description: 'Liver appearance (e.g., "Normal liver appearance")' }
            },
            description: 'Detailed operative findings'
          },

          operativeTechnique: {
            type: 'object',
            properties: {
              stepByStep: { type: 'array', items: { type: 'string' } },
              criticalSteps: { type: 'array', items: { type: 'object', properties: {
                step: { type: 'string' },
                technique: { type: 'string' },
                complications: { type: 'string' }
              }}},
              hemostasis: { type: 'string' },
              irrigation: { type: 'string' },
              drains: { type: 'array', items: { type: 'object', properties: {
                type: { type: 'string' },
                location: { type: 'string' },
                output: { type: 'string' }
              }}},
              closure: { type: 'object', properties: {
                layers: { type: 'array', items: { type: 'string' } },
                sutures: { type: 'array', items: { type: 'string' } },
                dressing: { type: 'string' }
              }}
            },
            description: 'Detailed surgical technique documentation'
          },

          intraoperativeImaging: {
            type: 'object',
            properties: {
              cholangiography: { type: 'object', properties: {
                performed: { type: 'boolean' },
                findings: { type: 'string' },
                normal: { type: 'boolean' },
                contrastInjectionSite: { type: 'string', description: 'Contrast injection site (e.g., "cystic duct", "common bile duct")' }
              }},
              fluoroscopy: { type: 'object', properties: {
                used: { type: 'boolean' },
                purpose: { type: 'string' },
                findings: { type: 'string' }
              }},
              ultrasound: { type: 'object', properties: {
                used: { type: 'boolean' },
                findings: { type: 'string' }
              }}
            },
            description: 'Intraoperative imaging studies'
          },

          specimens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                handling: { type: 'string', description: 'Fresh, formalin, frozen' },
                pathologyNumber: { type: 'string' },
                preliminaryResults: { type: 'string' },
                finalResults: { type: 'string' }
              }
            },
            description: 'Surgical specimens and pathology'
          },

          estimatedBloodLoss: {
            type: 'object',
            properties: {
              amount: { type: 'string' },
              transfusionRequired: { type: 'boolean' },
              bloodProductsGiven: { type: 'array', items: { type: 'string' } }
            },
            description: 'Blood loss and replacement'
          },

          complications: {
            type: 'object',
            properties: {
              intraoperative: { type: 'array', items: { type: 'string' } },
              immediate: { type: 'array', items: { type: 'string' } },
              management: { type: 'array', items: { type: 'string' } }
            },
            description: 'Surgical complications'
          },

          postoperativeOrders: {
            type: 'object',
            properties: {
              diet: { type: 'string' },
              activity: { type: 'string' },
              painManagement: { type: 'array', items: { type: 'string' } },
              antibiotics: { type: 'array', items: { type: 'string' } },
              prophylaxis: { type: 'array', items: { type: 'string' } },
              monitoring: { type: 'array', items: { type: 'string' } },
              specialInstructions: { type: 'array', items: { type: 'string' } },
              dischargeHome: { type: 'string', description: 'Discharge disposition and criteria (e.g., "Discharge home when tolerating regular diet and adequate pain control")' }
            },
            description: 'Postoperative care orders'
          },

          postoperativeCondition: {
            type: 'object',
            properties: {
              status: { type: 'string', description: 'Overall patient condition (e.g., "stable condition")' },
              extubationLocation: { type: 'string', description: 'Location of extubation (e.g., "Extubated in OR")' },
              transferDestination: { type: 'string', description: 'Transfer destination (e.g., "PACU", "ICU")' },
              vitalSigns: { type: 'object', properties: {
                bloodPressure: { type: 'string' },
                heartRate: { type: 'string' },
                oxygenSaturation: { type: 'string' }
              }}
            },
            description: 'Postoperative patient condition and disposition'
          },

          postoperativeMonitoring: {
            type: 'object',
            properties: {
              dailyClinicVisits: { type: 'string', description: 'IMPORTANT: Daily clinic visit schedule for early postoperative period (e.g., "Daily clinic visits week 1")' },
              weeklyVisits: { type: 'string', description: 'IMPORTANT: Weekly visit schedule after initial period (e.g., "Weekly visits month 1")' }
            },
            description: 'Postoperative monitoring and follow-up schedule'
          },

          dischargePlanning: {
            type: 'object',
            properties: {
              expectedLOS: { type: 'string', description: 'Expected length of stay' },
              dischargeDestination: { type: 'string' },
              followUpInstructions: { type: 'array', items: { type: 'string' } },
              activityRestrictions: { type: 'array', items: { type: 'string' } },
              returnToWork: { type: 'string' },
              warningSignsToWatch: { type: 'array', items: { type: 'string' } },

              // ========== TASK 12: ENHANCED DISCHARGE PLANNING ==========
              comprehensiveDischargeReadiness: {
                type: 'object',
                properties: {
                  medicalStability: {
                    type: 'object',
                    properties: {
                      vitalSignsStable: { type: 'boolean', description: 'CRITICAL: Vital signs stable for 24 hours' },
                      painControlled: { type: 'boolean', description: 'Pain controlled on oral medications' },
                      toleratingOralIntake: { type: 'boolean', description: 'Tolerating oral diet and fluids' },
                      mobilizing: { type: 'boolean', description: 'Ambulating independently or with assistance' },
                      urinaryFunction: { type: 'string', description: 'Urinary function status (e.g., "Foley removed, voiding spontaneously")' }
                    },
                    description: 'CRITICAL: Medical stability criteria for safe discharge'
                  },
                  dischargeMedications: {
                    type: 'object',
                    properties: {
                      reconciliationCompleted: { type: 'boolean', description: 'CRITICAL: Medication reconciliation completed' },
                      newMedications: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            medication: { type: 'string' },
                            indication: { type: 'string', description: 'Why medication was started' },
                            duration: { type: 'string', description: 'How long to take (e.g., "7 days", "Indefinitely")' }
                          }
                        },
                        description: 'New medications started during hospitalization'
                      },
                      discontinuedMedications: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            medication: { type: 'string' },
                            reason: { type: 'string', description: 'Why medication was stopped' }
                          }
                        },
                        description: 'CRITICAL: Medications that were stopped (patient must know NOT to resume)'
                      },
                      prescriptionsSent: { type: 'boolean', description: 'CRITICAL: Prescriptions sent to pharmacy' },
                      pharmacyLocation: { type: 'string', description: 'Preferred pharmacy location' }
                    },
                    description: 'CRITICAL: Discharge medication planning to prevent medication errors'
                  },
                  homeServices: {
                    type: 'object',
                    properties: {
                      homeHealth: {
                        type: 'object',
                        properties: {
                          ordered: { type: 'boolean' },
                          services: { type: 'array', items: { type: 'string' }, description: 'Services (e.g., "Nursing visits", "PT", "OT", "Wound care")' },
                          frequency: { type: 'string', description: 'Frequency (e.g., "3x/week for 2 weeks")' }
                        }
                      },
                      dme: {
                        type: 'object',
                        properties: {
                          ordered: { type: 'boolean' },
                          equipment: { type: 'array', items: { type: 'string' }, description: 'DME ordered (e.g., "Walker", "Commode", "Hospital bed", "Oxygen 2L continuous")' },
                          delivered: { type: 'boolean', description: 'DME delivered before discharge' }
                        },
                        description: 'Durable medical equipment'
                      },
                      caregiverAvailability: {
                        type: 'object',
                        properties: {
                          available: { type: 'boolean', description: 'CRITICAL: Caregiver available at home' },
                          caregiverName: { type: 'string' },
                          caregiverTrained: { type: 'boolean', description: 'CRITICAL: Caregiver trained on wound care, medication administration, etc.' }
                        }
                      }
                    },
                    description: 'Home services and support planning'
                  },
                  postAcuteCarePlacement: {
                    type: 'object',
                    properties: {
                      required: { type: 'boolean', description: 'CRITICAL: Patient requires skilled nursing facility or inpatient rehab' },
                      facility: { type: 'string', description: 'Facility name (e.g., "Skilled nursing facility", "Acute inpatient rehab")' },
                      estimatedDuration: { type: 'string', description: 'Estimated length of stay at facility' },
                      accepted: { type: 'boolean', description: 'CRITICAL: Bed accepted at facility' },
                      barriers: { type: 'array', items: { type: 'string' }, description: 'Barriers to placement (e.g., "Insurance authorization pending", "No beds available")' }
                    },
                    description: 'CRITICAL: Post-acute care placement for patients who cannot go home'
                  },
                  patientEducation: {
                    type: 'object',
                    properties: {
                      teachBackCompleted: { type: 'boolean', description: 'CRITICAL: Teach-back method used to verify understanding' },
                      writtenInstructions: { type: 'boolean', description: 'Written discharge instructions provided' },
                      interpreterUsed: { type: 'boolean', description: 'Interpreter used for non-English speaking patient' },
                      topicsReviewed: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Education topics reviewed (e.g., "Wound care", "Medication reconciliation", "Activity restrictions", "Warning signs")'
                      }
                    },
                    description: 'CRITICAL: Patient education and health literacy assessment'
                  },
                  followUpScheduling: {
                    type: 'object',
                    properties: {
                      appointments: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            provider: { type: 'string', description: 'Provider name and specialty' },
                            timing: { type: 'string', description: 'When to follow up (e.g., "1-2 weeks", "3 days")' },
                            scheduled: { type: 'boolean', description: 'CRITICAL: Appointment already scheduled (not just "call for appointment")' },
                            appointmentDate: { type: 'string', description: 'Specific appointment date and time if scheduled' }
                          }
                        },
                        description: 'CRITICAL: Follow-up appointments (scheduled appointments reduce readmissions)'
                      },
                      urgentFollowUp: {
                        type: 'object',
                        properties: {
                          required: { type: 'boolean' },
                          reason: { type: 'string', description: 'Why urgent follow-up needed (e.g., "INR check in 3 days", "Staple removal in 10 days")' },
                          scheduled: { type: 'boolean', description: 'CRITICAL: Urgent appointment already scheduled' }
                        }
                      }
                    },
                    description: 'CRITICAL: Follow-up appointment scheduling (reduces 30-day readmissions)'
                  },
                  dischargeBarriersIdentified: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'CRITICAL: Barriers to safe discharge (e.g., "Medication cost - social work consult", "No caregiver at home - home health ordered", "Stairs at home - PT evaluation")'
                  },
                  readmissionRisk: {
                    type: 'object',
                    properties: {
                      riskLevel: { type: 'string', enum: ['Low', 'Moderate', 'High', 'Very high'], description: 'CRITICAL: 30-day readmission risk' },
                      riskFactors: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Risk factors (e.g., "Multiple comorbidities", "Lives alone", "Limited health literacy", "Medication nonadherence", "Prior readmission")'
                      },
                      mitigationStrategies: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Strategies to reduce readmission risk (e.g., "Home health visits", "Transitional care clinic in 72 hours", "Medication reconciliation", "Caregiver education")'
                      }
                    },
                    description: 'CRITICAL: Readmission risk stratification and mitigation'
                  }
                },
                description: 'TASK 12: Comprehensive discharge planning to reduce readmissions and improve transitions of care'
              }
            },
            description: 'Discharge and recovery planning'
          },

          preoperativeRequirements: {
            type: 'object',
            properties: {
              medicalClearance: {
                type: 'array',
                items: { type: 'string' },
                description: 'Required preoperative laboratory tests and diagnostic studies (e.g., "CBC", "CMP", "PT/INR", "EKG (baseline)", "Chest X-ray", "Type and screen")'
              },
              consultations: { type: 'array', items: { type: 'string' }, description: 'Required preoperative consultations' },
              documentationNeeded: { type: 'array', items: { type: 'string' }, description: 'Documentation requirements' }
            },
            description: 'Preoperative requirements and clearances needed before surgery'
          },

          preoperativeOptimization: {
            type: 'object',
            properties: {
              proteinSupplementation: { type: 'boolean', description: 'Whether protein supplementation is recommended' },
              noNSAIDs: { type: 'string', description: 'NSAID restriction period (e.g., "No NSAIDs 2 weeks before surgery", "Avoid NSAIDs")' },
              weightManagement: { type: 'string', description: 'Weight management instructions (e.g., "Maintain current weight", "Weight loss recommended")' },
              medicationContinuation: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    instruction: { type: 'string' },
                    coordination: { type: 'string', description: 'Which specialist to coordinate with' }
                  }
                },
                description: 'Medications to continue/adjust (e.g., "Continue tamoxifen (coordinate with oncology)")'
              },
              smokingCessation: { type: 'string' },
              exerciseProgram: { type: 'string' },
              nutritionalOptimization: { type: 'string' }
            },
            description: 'Preoperative optimization instructions and requirements'
          },

          stagedProcedures: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                stageNumber: { type: 'number', description: 'Stage number (1, 2, 3, etc.)' },
                timing: { type: 'string', description: 'When this stage occurs (e.g., "3-6 months later", "6 months post-op")' },
                procedures: { type: 'array', items: { type: 'string' }, description: 'Procedures planned for this stage' },
                optional: { type: 'boolean', description: 'Whether this stage is optional' }
              }
            },
            description: 'Multi-stage surgical plan with timing and procedures for each stage'
          },

          futureConsiderations: {
            type: 'object',
            properties: {
              prophylacticSalpingoOophorectomy: {
                type: 'object',
                properties: {
                  recommended: { type: 'boolean' },
                  reason: { type: 'string', description: 'Reason (e.g., "given BRCA1 mutation")' },
                  timing: { type: 'string', description: 'Timing discussion (e.g., "Timing with reconstruction discussed")' }
                },
                description: 'Prophylactic salpingo-oophorectomy planning for high-risk patients'
              },
              contralateralProcedures: { type: 'string', description: 'Future procedures on opposite side' },
              additionalScreening: { type: 'array', items: { type: 'string' }, description: 'Additional screening recommendations' }
            },
            description: 'Future surgical and medical considerations'
          },

          recoveryTimeline: {
            type: 'object',
            properties: {
              week1: { type: 'string', description: 'Week 1 recovery milestones (e.g., "Hospital stay, drain management, pain control")' },
              week2: { type: 'string', description: 'Week 2 recovery milestones (e.g., "Drain removal, return to light activities")' },
              week3_4: { type: 'string', description: 'IMPORTANT: Weeks 3-4 recovery milestones (e.g., "Gradual increase in activity, lifting restrictions continue")' },
              month1: { type: 'string', description: 'Month 1 overall summary (e.g., "Most swelling resolved, return to desk work")' },
              week6: { type: 'string', description: 'IMPORTANT: Week 6 recovery milestones (e.g., "Resume exercise, lifting restrictions lifted")' },
              week8_12: { type: 'string', description: 'IMPORTANT: Weeks 8-12 recovery milestones (e.g., "Full physical activity, final shaping begins")' },
              month3: { type: 'string', description: 'Month 3 recovery milestones (e.g., "Significant settling, consider revision if needed")' },
              month6: { type: 'string', description: 'Six month recovery milestone (e.g., "Final shaping procedures", "Return to full activity")' },
              finalRecovery: { type: 'string', description: 'Expected time to full recovery (e.g., "12-18 months for complete healing")' }
            },
            description: 'Complete recovery timeline with granular weekly and monthly milestones'
          },

          riskStratification: {
            type: 'object',
            properties: {
              positiveFactors: {
                type: 'array',
                items: { type: 'string' },
                description: 'Factors favoring good surgical outcome (e.g., "Young age", "Non-smoker", "Normal BMI", "Good perforators")'
              },
              negativeFactors: {
                type: 'array',
                items: { type: 'string' },
                description: 'Risk factors that may complicate surgery or recovery'
              },
              overallRisk: { type: 'string', description: 'Overall surgical risk assessment (e.g., "Low risk", "Moderate risk")' }
            },
            description: 'Comprehensive surgical risk stratification'
          },

          complicationRisks: {
            type: 'object',
            properties: {
              totalFlapLoss: { type: 'string', description: 'Risk percentage for total flap loss (e.g., "<1%", "1-2%")' },
              partialFlapLoss: { type: 'string', description: 'Risk percentage for partial flap loss (e.g., "2-3%")' },
              fatNecrosis: { type: 'string', description: 'Risk percentage for fat necrosis (e.g., "10-15%")' },
              donorSiteComplications: { type: 'string', description: 'Risk percentage for donor site complications (e.g., "20%")' },
              needForRevision: { type: 'string', description: 'Risk percentage for needing revision surgery (e.g., "30% within first year")' },
              infection: { type: 'string' },
              bleeding: { type: 'string' },
              seroma: { type: 'string' },
              other: { type: 'array', items: { type: 'string' } }
            },
            description: 'Specific complication risks with percentages discussed for informed consent'
          },

          insurance: {
            type: 'object',
            properties: {
              cptCodes: {
                type: 'array',
                items: { type: 'string' },
                description: 'CPT procedure codes for billing (e.g., "19364 (bilateral DIEP flap)", "15777 (implant insertion)")'
              },
              preAuthorizationStatus: {
                type: 'string',
                description: 'Pre-authorization status (e.g., "Pre-authorization initiated", "Approved", "Pending")'
              },
              medicalNecessityDocumentation: {
                type: 'string',
                description: 'Medical necessity documentation status (e.g., "Medical necessity documentation prepared", "Letter of medical necessity submitted")'
              },
              estimatedOutOfPocketCosts: {
                type: 'string',
                description: 'Out-of-pocket cost discussion (e.g., "Estimated out-of-pocket costs discussed", "$5000 estimated deductible")'
              },
              priorAuthorization: { type: 'string' },
              insuranceProvider: { type: 'string' },
              policyNumber: { type: 'string' }
            },
            description: 'Insurance authorization and billing information'
          },

          // ========== COMPREHENSIVE ORTHOPEDIC FIELDS ==========
          mechanismOfInjury: {
            type: 'object',
            properties: {
              dateOfInjury: { type: 'string' },
              mechanism: { type: 'string', description: 'Contact vs non-contact, twisting, fall, etc.' },
              activity: { type: 'string', description: 'Sport, work, ADL, MVA' },
              immediateSymptoms: { type: 'array', items: { type: 'string' } },
              initialTreatment: { type: 'string' },
              timeToSurgery: { type: 'string' }
            },
            description: 'Detailed injury mechanism and timeline'
          },

          orthopedicImaging: {
            type: 'object',
            properties: {
              xray: { type: 'object', properties: {
                date: { type: 'string' },
                findings: { type: 'array', items: { type: 'string' } }
              }},
              mri: { type: 'object', properties: {
                date: { type: 'string' },
                findings: { type: 'array', items: { type: 'string' } },
                measurements: { type: 'object' }
              }},
              ct: { type: 'object', properties: {
                date: { type: 'string' },
                findings: { type: 'array', items: { type: 'string' } }
              }},
              boneContusions: { type: 'array', items: { type: 'string' } },
              effusion: { type: 'string' }
            },
            description: 'Preoperative imaging findings'
          },

          ligamentReconstruction: {
            type: 'object',
            properties: {
              ligament: { type: 'string', description: 'ACL, PCL, MCL, LCL, etc.' },
              graftType: { type: 'string', description: 'Autograft, allograft, synthetic' },
              graftSource: { type: 'string', description: 'BTB, hamstring, quad, etc.' },
              graftSize: { type: 'object', properties: {
                length: { type: 'string' },
                diameter: { type: 'string' }
              }},
              tunnelPlacement: { type: 'object', properties: {
                femoral: { type: 'string' },
                tibial: { type: 'string' },
                technique: { type: 'string', description: 'Transtibial, transportal, outside-in' }
              }},
              fixation: { type: 'object', properties: {
                femoral: { type: 'string' },
                tibial: { type: 'string' },
                supplemental: { type: 'string' }
              }}
            },
            description: 'Ligament reconstruction details'
          },

          meniscusRepair: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'Medial, lateral' },
              tearType: { type: 'string', description: 'Bucket handle, radial, complex, etc.' },
              zone: { type: 'string', description: 'Red, red-white, white zone' },
              treatment: { type: 'string', description: 'Repair, partial meniscectomy, total' },
              repairTechnique: { type: 'string', description: 'All-inside, inside-out, outside-in' },
              percentRemoved: { type: 'string' }
            },
            description: 'Meniscus injury and treatment details'
          },

          articularCartilage: {
            type: 'object',
            properties: {
              location: { type: 'array', items: { type: 'string' } },
              grade: { type: 'string', description: 'Outerbridge classification' },
              size: { type: 'string' },
              treatment: { type: 'string', description: 'Debridement, microfracture, OATS, etc.' }
            },
            description: 'Cartilage damage assessment and treatment'
          },

          tourniquetData: {
            type: 'object',
            properties: {
              used: { type: 'boolean' },
              pressure: { type: 'string' },
              duration: { type: 'string' },
              location: { type: 'string' }
            },
            description: 'Tourniquet use details'
          },

          postOpTesting: {
            type: 'object',
            properties: {
              lachmanTest: { type: 'string' },
              pivotShift: { type: 'string' },
              anteriorDrawer: { type: 'string' },
              posteriorDrawer: { type: 'string' },
              varusValgusStress: { type: 'object' },
              rangeOfMotion: { type: 'object', properties: {
                flexion: { type: 'string' },
                extension: { type: 'string' },
                achieved: { type: 'string' }
              }},
              impingement: { type: 'boolean' },
              postOperativeDay1Assessment: {
                type: 'object',
                properties: {
                  rangeOfMotion: { type: 'string', description: 'Post-op day 1 ROM (e.g., "Passive: 0-60 degrees (limited by pain/swelling), Active: Not tested day 1")' },
                  painLevel: { type: 'string' },
                  swelling: { type: 'string' },
                  neurovascularStatus: { type: 'string' }
                },
                description: 'Post-operative day 1 assessment findings'
              }
            },
            description: 'Immediate post-operative stability testing and day 1 assessment'
          },

          rehabilitationProtocol: {
            type: 'object',
            properties: {
              phases: { type: 'array', items: { type: 'object', properties: {
                phaseName: { type: 'string' },
                duration: { type: 'string' },
                weightBearing: { type: 'string' },
                romGoals: { type: 'string' },
                exercises: { type: 'array', items: { type: 'string' } },
                restrictions: { type: 'array', items: { type: 'string' } },
                milestones: { type: 'array', items: { type: 'string' } }
              }}},
              braceProtocol: { type: 'object', properties: {
                type: { type: 'string' },
                settings: { type: 'string' },
                duration: { type: 'string' }
              }},
              cpmProtocol: { type: 'object', properties: {
                prescribed: { type: 'boolean' },
                settings: { type: 'string' }
              }}
            },
            description: 'Detailed rehabilitation protocol'
          },

          returnToSport: {
            type: 'object',
            properties: {
              sport: { type: 'string' },
              level: { type: 'string', description: 'Recreational, competitive, professional' },
              timelineToRunning: { type: 'string' },
              timelineToPractice: { type: 'string' },
              timelineToCompetition: { type: 'string' },
              criteria: { type: 'array', items: { type: 'object', properties: {
                test: { type: 'string' },
                targetValue: { type: 'string' }
              }}},
              functionalTests: { type: 'array', items: { type: 'string' } }
            },
            description: 'Return to sport timeline and criteria'
          },

          dvtProphylaxis: {
            type: 'object',
            properties: {
              medication: { type: 'string' },
              dose: { type: 'string' },
              duration: { type: 'string' },
              mechanicalProphylaxis: { type: 'array', items: { type: 'string' } }
            },
            description: 'DVT prophylaxis protocol'
          },

          neurovascularExam: {
            type: 'object',
            properties: {
              sensoryExam: { type: 'object', properties: {
                distributions: { type: 'array', items: { type: 'string' } },
                intact: { type: 'boolean' }
              }},
              motorExam: { type: 'object', properties: {
                movements: { type: 'array', items: { type: 'object', properties: {
                  muscle: { type: 'string' },
                  strength: { type: 'string' }
                }}}
              }},
              pulses: { type: 'object', properties: {
                dorsalisPedis: { type: 'string' },
                posteriorTibial: { type: 'string' }
              }},
              capillaryRefill: { type: 'string' }
            },
            description: 'Post-operative neurovascular assessment'
          },

          athleteSpecificData: {
            type: 'object',
            properties: {
              sport: { type: 'string' },
              position: { type: 'string' },
              professionalLevel: { type: 'boolean' },
              teamSupport: { type: 'boolean' },
              previousInjuries: { type: 'array', items: { type: 'object', properties: {
                injury: { type: 'string' },
                date: { type: 'string' },
                recovery: { type: 'string' }
              }}},
              psychologicalSupport: { type: 'boolean' },
              antiDopingNotification: { type: 'boolean' }
            },
            description: 'Athlete-specific information and considerations'
          },

          // ========== COMPREHENSIVE PEDIATRIC FIELDS ==========
          birthHistory: {
            type: 'object',
            properties: {
              gestationalAge: { type: 'string' },
              deliveryType: { type: 'string', description: 'Vaginal, C-section' },
              birthWeight: { type: 'string' },
              birthLength: { type: 'string' },
              headCircumference: { type: 'string' },
              apgarScores: { type: 'object', properties: {
                oneMinute: { type: 'string' },
                fiveMinutes: { type: 'string' }
              }},
              complications: { type: 'array', items: { type: 'string' } },
              nicuStay: { type: 'boolean' },
              nicuDuration: { type: 'string' }
            },
            description: 'Birth and perinatal history'
          },

          growthParameters: {
            type: 'object',
            properties: {
              height: { type: 'object', properties: {
                value: { type: 'string' },
                unit: { type: 'string' },
                percentile: { type: 'string' },
                zScore: { type: 'string' }
              }},
              weight: { type: 'object', properties: {
                value: { type: 'string' },
                unit: { type: 'string' },
                percentile: { type: 'string' },
                zScore: { type: 'string' }
              }},
              headCircumference: { type: 'object', properties: {
                value: { type: 'string' },
                percentile: { type: 'string' }
              }},
              bmi: { type: 'object', properties: {
                value: { type: 'string' },
                percentile: { type: 'string' },
                category: { type: 'string' }
              }},
              growthVelocity: { type: 'string' },
              pubertalStage: { type: 'string', description: 'Tanner stage' }
            },
            description: 'Growth measurements and percentiles'
          },

          developmentalMilestones: {
            type: 'object',
            properties: {
              grossMotor: { type: 'array', items: { type: 'object', properties: {
                milestone: { type: 'string' },
                achieved: { type: 'boolean' },
                ageAchieved: { type: 'string' }
              }}},
              fineMotor: { type: 'array', items: { type: 'object', properties: {
                milestone: { type: 'string' },
                achieved: { type: 'boolean' },
                ageAchieved: { type: 'string' }
              }}},
              language: { type: 'array', items: { type: 'object', properties: {
                milestone: { type: 'string' },
                achieved: { type: 'boolean' },
                ageAchieved: { type: 'string' }
              }}},
              socialEmotional: { type: 'array', items: { type: 'object', properties: {
                milestone: { type: 'string' },
                achieved: { type: 'boolean' },
                ageAchieved: { type: 'string' }
              }}},
              cognitive: { type: 'array', items: { type: 'object', properties: {
                milestone: { type: 'string' },
                achieved: { type: 'boolean' },
                ageAchieved: { type: 'string' }
              }}},
              concerns: { type: 'array', items: { type: 'string' } },
              referrals: { type: 'array', items: { type: 'string' } }
            },
            description: 'Developmental milestone assessment'
          },

          pediatricScreening: {
            type: 'object',
            properties: {
              visionScreening: { type: 'object', properties: {
                result: { type: 'string' },
                acuity: { type: 'string' },
                method: { type: 'string' }
              }},
              hearingScreening: { type: 'object', properties: {
                result: { type: 'string' },
                method: { type: 'string' }
              }},
              leadLevel: { type: 'object', properties: {
                value: { type: 'string' },
                date: { type: 'string' },
                riskAssessment: { type: 'string' }
              }},
              tuberculosisRisk: { type: 'string' },
              developmentalScreening: { type: 'object', properties: {
                tool: { type: 'string', description: 'ASQ, M-CHAT, etc.' },
                score: { type: 'string' },
                result: { type: 'string' }
              }},
              behavioralScreening: { type: 'object', properties: {
                tool: { type: 'string', description: 'PSC, PHQ-9, etc.' },
                score: { type: 'string' },
                result: { type: 'string' },
                teacherRating: { type: 'string', description: 'Teacher rating or feedback from behavioral screening (e.g., "Similar concerns reported", "No concerns", "Teacher reports inattention in class")' }
              }},
              dentalScreening: { type: 'string' },
              cholesterolScreening: { type: 'object' }
            },
            description: 'Age-specific pediatric screenings'
          },

          immunizationRecord: {
            type: 'object',
            properties: {
              upToDate: { type: 'boolean' },
              givenToday: { type: 'array', items: { type: 'object', properties: {
                vaccine: { type: 'string' },
                dose: { type: 'string' },
                site: { type: 'string' },
                lot: { type: 'string' }
              }}},
              previousVaccines: { type: 'array', items: { type: 'object', properties: {
                vaccine: { type: 'string' },
                date: { type: 'string' }
              }}},
              nextDue: { type: 'array', items: { type: 'object', properties: {
                vaccine: { type: 'string' },
                dueDate: { type: 'string' }
              }}},
              contraindications: { type: 'array', items: { type: 'string' } },
              catchUpNeeded: { type: 'boolean' },
              administeredToday: { type: 'string', description: 'Documentation when NO vaccines were given at this visit (e.g., "None due - up to date", "None - patient declined", "Deferred due to illness"). Important for medical record completeness.' }
            },
            description: 'Immunization history and schedule'
          },

          schoolPerformance: {
            type: 'object',
            properties: {
              grade: { type: 'string' },
              school: { type: 'string' },
              academicPerformance: { type: 'string' },
              behaviorInClass: { type: 'string' },
              peerInteractions: { type: 'string' },
              specialEducation: { type: 'boolean' },
              iepOr504Plan: { type: 'string' },
              concerns: { type: 'array', items: { type: 'string' } },
              strengths: { type: 'array', items: { type: 'string' } },
              schoolFormsCompleted: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    formType: { type: 'string', description: 'Type of school form (e.g., "Physical examination form", "Asthma action plan", "School accommodation request forms")' },
                    completedDate: { type: 'string', description: 'Date form was completed or provided to parent/patient. Use visit date if form was provided but completion date not specified.' },
                    status: { type: 'string', description: 'Status of form (e.g., "completed", "provided to parent", "pending")' },
                    recipient: { type: 'string', description: 'Who receives the form (e.g., "school nurse", "school office", "parent to deliver to school")' }
                  }
                },
                description: 'Documentation of school forms completed for administrative tracking'
              }
            },
            description: 'School and academic performance with administrative documentation'
          },

          nutritionalAssessment: {
            type: 'object',
            properties: {
              dietType: { type: 'string' },
              breastfeedingHistory: { type: 'object', properties: {
                duration: { type: 'string' },
                exclusive: { type: 'string' }
              }},
              formulaFeeding: { type: 'object', properties: {
                type: { type: 'string' },
                amount: { type: 'string' }
              }},
              solidFoods: { type: 'object', properties: {
                ageStarted: { type: 'string' },
                current: { type: 'array', items: { type: 'string' } }
              }},
              dietaryRestrictions: { type: 'array', items: { type: 'string' } },
              supplements: { type: 'array', items: { type: 'string' } },
              feedingDifficulties: { type: 'array', items: { type: 'string' } },
              weightStatus: { type: 'string' }
            },
            description: 'Nutritional status and feeding history'
          },

          anticipatoryGuidance: {
            type: 'object',
            properties: {
              nutrition: { type: 'array', items: { type: 'string' }, description: 'RECOMMENDATIONS for nutrition (e.g., "Encourage fruits and vegetables", "Limit sugary drinks")' },
              physicalActivity: { type: 'array', items: { type: 'string' }, description: 'RECOMMENDATIONS for physical activity (e.g., "60+ minutes daily active play", "Limit sedentary time")' },
              screenTime: { type: 'string', description: 'RECOMMENDATIONS for screen time (e.g., "Limit screen time to 1 hour weekdays, 2 hours weekends"). DO NOT put current usage here - use socialHistory.screenTime for current usage.' },
              sleep: { type: 'object', properties: {
                hoursRecommended: { type: 'string', description: 'RECOMMENDED hours of sleep (e.g., "10-11 hours nightly")' },
                currentPattern: { type: 'string', description: 'CURRENT sleep pattern (e.g., "10-11 hours/night, occasional bedtime resistance")' },
                concerns: { type: 'array', items: { type: 'string' }, description: 'Sleep concerns and recommendations' }
              }},
              safety: { type: 'array', items: { type: 'string' }, description: 'RECOMMENDATIONS for safety (e.g., "Continue bike helmet use", "Supervise near water")' },
              dental: { type: 'array', items: { type: 'string' }, description: 'RECOMMENDATIONS for dental care' },
              socialDevelopment: { type: 'array', items: { type: 'string' }, description: 'RECOMMENDATIONS for social development' },
              toileting: { type: 'string', description: 'RECOMMENDATIONS for toileting' },
              discipline: { type: 'array', items: { type: 'string' }, description: 'RECOMMENDATIONS for discipline and behavior management' }
            },
            description: 'Age-appropriate anticipatory guidance RECOMMENDATIONS provided. IMPORTANT: This is for recommendations only, NOT current practices - current practices go in socialHistory.'
          },

          behavioralAssessment: {
            type: 'object',
            properties: {
              temperament: { type: 'string' },
              attentionSpan: { type: 'string' },
              activityLevel: { type: 'string' },
              socialSkills: { type: 'string' },
              emotionalRegulation: { type: 'string' },
              tantrums: { type: 'object', properties: {
                frequency: { type: 'string' },
                triggers: { type: 'array', items: { type: 'string' } }
              }},
              anxietySymptoms: { type: 'array', items: { type: 'string' } },
              panicAttackFrequency: { type: 'string', description: 'CRITICAL: Panic attack frequency for monitoring (e.g., "2-3 times weekly", "daily", "several per month"). Important for treatment response tracking.' },
              weightChange: { type: 'string', description: 'IMPORTANT: Weight change with timeline (e.g., "15-pound weight gain over 2 months, craving carbohydrates", "20-pound weight loss"). Specific symptom tracking.' },
              adhdSymptoms: { type: 'array', items: { type: 'string' } },
              autismRedFlags: { type: 'array', items: { type: 'string' } }
            },
            description: 'Behavioral and psychological assessment'
          },

          adhdAssessment: {
            type: 'object',
            properties: {
              screeningTool: { type: 'string', description: 'Vanderbilt, Conners, ADHD-RS, etc.' },
              parentForm: { type: 'object', properties: {
                inattentionScore: { type: 'string' },
                hyperactivityScore: { type: 'string' },
                oppositionalDefiantScore: { type: 'string' },
                conductDisorderScore: { type: 'string' },
                anxietyDepressionScore: { type: 'string' },
                performanceImpairment: { type: 'string' }
              }},
              teacherForm: { type: 'object', properties: {
                inattentionScore: { type: 'string' },
                hyperactivityScore: { type: 'string' },
                oppositionalDefiantScore: { type: 'string' },
                conductDisorderScore: { type: 'string' },
                academicPerformance: { type: 'string' },
                classroomBehavior: { type: 'string' }
              }},
              symptoms: { type: 'object', properties: {
                duration: { type: 'string' },
                settings: { type: 'array', items: { type: 'string' } },
                onsetAge: { type: 'string' },
                functionalImpairment: { type: 'array', items: { type: 'string' } }
              }},
              dsmCriteriaMet: { type: 'string' },
              differentialDiagnosis: { type: 'array', items: { type: 'string' } },
              comorbidities: { type: 'array', items: { type: 'string' } },
              familyHistory: { type: 'array', items: { type: 'string' } },
              recommendations: { type: 'array', items: { type: 'string' } }
            },
            description: 'Comprehensive ADHD assessment and screening'
          },

          parentalConcerns: {
            type: 'object',
            properties: {
              concerns: { type: 'array', items: { type: 'object', properties: {
                topic: { type: 'string' },
                description: { type: 'string' },
                addressed: { type: 'string' }
              }}},
              parentingStress: { type: 'string' },
              familySupport: { type: 'string' },
              homeEnvironment: { type: 'string' },
              siblingRelationships: { type: 'string' }
            },
            description: 'Parental concerns and family dynamics'
          },

          wellChildSummary: {
            type: 'object',
            properties: {
              ageInMonths: { type: 'number' },
              ageInYears: { type: 'string' },
              visitType: { type: 'string', description: 'Specific visit type designation (e.g., "6-year well-child examination (kindergarten physical)", "12-month well-child check", "routine well-child visit", "sick visit", "follow-up")' },
              overallHealth: { type: 'string' },
              chronicConditions: { type: 'array', items: { type: 'object', properties: {
                condition: { type: 'string' },
                status: { type: 'string' },
                management: { type: 'string' }
              }}},
              nextVisit: { type: 'string' },
              callReasons: { type: 'array', items: { type: 'string' } },
              healthMaintenanceSummary: {
                type: 'object',
                properties: {
                  growthParametersStatus: { type: 'string', description: 'Growth parameters status (e.g., "normal", "concerning")' },
                  developmentStatus: { type: 'string', description: 'Development status (e.g., "age-appropriate", "delayed")' },
                  immunizationStatus: { type: 'string', description: 'Immunization status (e.g., "up to date", "catch-up needed")' },
                  visionStatus: { type: 'string', description: 'Vision screening status (e.g., "normal", "needs follow-up")' },
                  hearingStatus: { type: 'string', description: 'Hearing screening status (e.g., "normal", "needs follow-up")' },
                  chronicConditionsStatus: { type: 'string', description: 'Chronic conditions control (e.g., "well controlled", "needs adjustment")' },
                  schoolAdjustmentStatus: { type: 'string', description: 'School adjustment status (e.g., "positive", "concerns identified")' },
                  overallSummary: { type: 'string', description: 'Overall health maintenance checklist summary' }
                },
                description: 'Comprehensive health maintenance checklist for quick reference'
              },
              futureLaboratoryPlanning: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    test: { type: 'string', description: 'Laboratory test to be performed (e.g., "cholesterol", "lead level")' },
                    plannedAge: { type: 'string', description: 'Age when test should be performed (e.g., "age 9", "12 months")' },
                    reason: { type: 'string', description: 'Reason for future testing' }
                  }
                },
                description: 'Future preventive care and laboratory testing plans'
              }
            },
            description: 'Well-child visit summary with health maintenance tracking'
          },

          earlyChildhoodDevelopment: {
            type: 'object',
            properties: {
              playSkills: { type: 'string' },
              separationAnxiety: { type: 'string' },
              toiletTraining: { type: 'object', properties: {
                daytime: { type: 'string' },
                nighttime: { type: 'string' },
                age: { type: 'string' }
              }},
              speechDevelopment: { type: 'object', properties: {
                firstWords: { type: 'string' },
                currentVocabulary: { type: 'string' },
                sentenceLength: { type: 'string' },
                articulation: { type: 'string' }
              }},
              selfCareSkills: { type: 'array', items: { type: 'string' } }
            },
            description: 'Early childhood developmental specifics'
          },

          // ========== COMPREHENSIVE PSYCHIATRIC FIELDS ==========
          psychiatricHistory: {
            type: 'object',
            properties: {
              previousEpisodes: { type: 'array', items: { type: 'object', properties: {
                diagnosis: { type: 'string' },
                date: { type: 'string' },
                treatment: { type: 'string' },
                outcome: { type: 'string' }
              }}},
              hospitalizations: { type: 'array', items: { type: 'object', properties: {
                date: { type: 'string' },
                facility: { type: 'string' },
                duration: { type: 'string' },
                reason: { type: 'string' }
              }}},
              suicideAttempts: { type: 'array', items: { type: 'object', properties: {
                date: { type: 'string' },
                method: { type: 'string' },
                hospitalization: { type: 'boolean' }
              }}},
              substanceAbuse: { type: 'object', properties: {
                history: { type: 'boolean', description: 'IMPORTANT: True if substance abuse history present, false if explicitly documented as "None". Explicit documentation of no history is important for differential diagnosis.' },
                status: { type: 'string', description: 'Status summary (e.g., "None", "Current", "Past history in remission")' },
                substances: { type: 'array', items: { type: 'string' } },
                sobrietyDate: { type: 'string' },
                treatment: { type: 'array', items: { type: 'string' } },
                withdrawalSymptoms: { type: 'string', description: 'IMPORTANT: Withdrawal symptoms status (e.g., "denies withdrawal symptoms", "reports morning tremors"). Critical for substance use severity assessment.' }
              }},
              previousPsychotherapy: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', description: 'Therapy type (e.g., "CBT", "DBT", "Psychodynamic")' },
                    duration: { type: 'string', description: 'IMPORTANT: Duration of therapy (e.g., "6 months", "2 years")' },
                    date: { type: 'string', description: 'Year or date of therapy (e.g., "2020")' },
                    outcome: { type: 'string', description: 'CRITICAL: Treatment response (e.g., "beneficial but stopped due to cost", "no benefit", "significant improvement")' },
                    reasonForDiscontinuation: { type: 'string', description: 'Reason therapy ended (e.g., "cost", "moved", "symptoms resolved")' }
                  }
                },
                description: 'CRITICAL: Previous psychotherapy history showing treatment response and barriers to care'
              },
              familyPsychHistory: { type: 'array', items: { type: 'object', properties: {
                relative: { type: 'string' },
                condition: { type: 'string' },
                treatment: { type: 'string' }
              }}}
            },
            description: 'Past psychiatric history'
          },

          mentalStatusExam: {
            type: 'object',
            properties: {
              appearance: { type: 'object', properties: {
                dress: { type: 'string' },
                grooming: { type: 'string' },
                posture: { type: 'string' },
                eyeContact: { type: 'string' }
              }},
              behavior: { type: 'object', properties: {
                cooperation: { type: 'string' },
                psychomotor: { type: 'string' },
                agitation: { type: 'string' },
                tics: { type: 'string' }
              }},
              speech: { type: 'object', properties: {
                rate: { type: 'string' },
                volume: { type: 'string' },
                tone: { type: 'string' },
                articulation: { type: 'string' }
              }},
              mood: { type: 'string' },
              affect: { type: 'object', properties: {
                quality: { type: 'string' },
                range: { type: 'string' },
                stability: { type: 'string' },
                congruence: { type: 'string' },
                tearfulness: { type: 'string', description: 'IMPORTANT: Observable tearfulness during interview (e.g., "Present during interview", "Absent", "Present when discussing family")' }
              }},
              thoughtProcess: { type: 'object', properties: {
                organization: { type: 'string' },
                coherence: { type: 'string' },
                goalDirected: { type: 'boolean' },
                tangentiality: { type: 'boolean' },
                circumstantiality: { type: 'boolean' }
              }},
              thoughtContent: { type: 'object', properties: {
                delusions: { type: 'array', items: { type: 'string' }, description: 'IMPORTANT: Delusions present, or explicit "None" if documented' },
                obsessions: { type: 'array', items: { type: 'string' }, description: 'IMPORTANT: Obsessions present, or explicit "None" if documented' },
                compulsions: { type: 'array', items: { type: 'string' }, description: 'IMPORTANT: Compulsions present, or explicit "None" if documented' },
                phobias: { type: 'array', items: { type: 'string' } },
                preoccupations: { type: 'array', items: { type: 'string' } },
                negativeFindings: { type: 'string', description: 'IMPORTANT: Explicit negative findings documented in thought content (e.g., "Delusions: None, Obsessions/Compulsions: None")' }
              }},
              perceptualDisturbances: { type: 'object', properties: {
                hallucinations: { type: 'array', items: { type: 'object', properties: {
                  type: { type: 'string', description: 'Auditory, visual, tactile, etc.' },
                  description: { type: 'string' }
                }}},
                illusions: { type: 'array', items: { type: 'string' }, description: 'IMPORTANT: Illusions present, or explicit "None" if documented' },
                negativeFindings: { type: 'string', description: 'IMPORTANT: Explicit negative findings (e.g., "Illusions: None", "No perceptual disturbances")' }
              }},
              cognition: { type: 'object', properties: {
                orientation: { type: 'string' },
                attention: { type: 'string' },
                concentration: { type: 'string' },
                intelligence: { type: 'string', description: 'IMPORTANT: Intelligence assessment (e.g., "Average based on vocabulary and fund of knowledge", "Above average", "Below average")' },
                memory: { type: 'object', properties: {
                  immediate: { type: 'string' },
                  recent: { type: 'string' },
                  remote: { type: 'string' }
                }},
                abstractThinking: { type: 'string' },
                fundOfKnowledge: { type: 'string' }
              }},
              insight: { type: 'string' },
              judgment: { type: 'string' }
            },
            description: 'Mental status examination'
          },

          suicideRiskAssessment: {
            type: 'object',
            properties: {
              ideation: { type: 'object', properties: {
                current: { type: 'string' },
                passive: { type: 'boolean' },
                active: { type: 'boolean' },
                frequency: { type: 'string' },
                duration: { type: 'string' }
              }},
              plan: { type: 'object', properties: {
                hasPlan: { type: 'boolean' },
                method: { type: 'string' },
                means: { type: 'string' },
                timeline: { type: 'string' }
              }},
              intent: { type: 'string' },
              previousAttempts: { type: 'boolean' },
              psychiatricHospitalizations: { type: 'string', description: 'IMPORTANT: Psychiatric hospitalization history in suicide risk context (e.g., "None", "1 previous hospitalization in 2018"). Absence of hospitalizations is a protective factor.' },
              riskFactors: { type: 'array', items: { type: 'string' } },
              protectiveFactors: { type: 'array', items: { type: 'string' } },
              riskLevel: { type: 'string', description: 'Low, moderate, high, acute' },
              columbiaScale: { type: 'string' },
              interventions: { type: 'array', items: { type: 'string' } }
            },
            description: 'Suicide risk assessment'
          },

          psychiatricAssessmentScales: {
            type: 'object',
            properties: {
              phq9: { type: 'object', properties: {
                score: { type: 'number' },
                severity: { type: 'string' }
              }},
              gad7: { type: 'object', properties: {
                score: { type: 'number' },
                severity: { type: 'string' }
              }},
              phq15: { type: 'object', properties: {
                score: { type: 'number' },
                severity: { type: 'string' }
              }},
              mdq: { type: 'object', properties: {
                score: { type: 'number' },
                positive: { type: 'boolean' }
              }},
              pcl5: { type: 'object', properties: {
                score: { type: 'number' },
                severity: { type: 'string' }
              }},
              audit: { type: 'object', properties: {
                score: { type: 'number' },
                riskLevel: { type: 'string' }
              }},
              mmse: { type: 'object', properties: {
                score: { type: 'number' },
                interpretation: { type: 'string' }
              }},
              moca: { type: 'object', properties: {
                score: { type: 'number' },
                interpretation: { type: 'string' }
              }},
              customScales: { type: 'array', items: { type: 'object', properties: {
                name: { type: 'string' },
                score: { type: 'string' },
                interpretation: { type: 'string' }
              }}}
            },
            description: 'Standardized psychiatric assessment scales'
          },

          substanceUseAssessment: {
            type: 'object',
            properties: {
              currentUse: { type: 'array', items: { type: 'object', properties: {
                substance: { type: 'string' },
                frequency: { type: 'string' },
                amount: { type: 'string' },
                lastUse: { type: 'string' },
                route: { type: 'string' }
              }}},
              pastUse: { type: 'array', items: { type: 'object', properties: {
                substance: { type: 'string' },
                ageStarted: { type: 'string' },
                duration: { type: 'string' },
                sobrietyDate: { type: 'string' }
              }}},
              withdrawalSymptoms: { type: 'array', items: { type: 'string' } },
              treatmentHistory: { type: 'array', items: { type: 'object', properties: {
                type: { type: 'string' },
                facility: { type: 'string' },
                dates: { type: 'string' },
                outcome: { type: 'string' }
              }}},
              duidHistory: { type: 'boolean' },
              cageScore: { type: 'number' }
            },
            description: 'Substance use assessment'
          },

          psychotropicMedications: {
            type: 'object',
            properties: {
              current: { type: 'array', items: { type: 'object', properties: {
                medication: { type: 'string' },
                dose: { type: 'string' },
                frequency: { type: 'string' },
                startDate: { type: 'string' },
                response: { type: 'string' },
                sideEffects: { type: 'array', items: { type: 'string' } }
              }}},
              past: { type: 'array', items: { type: 'object', properties: {
                medication: { type: 'string' },
                maxDose: { type: 'string' },
                duration: { type: 'string' },
                reasonStopped: { type: 'string' },
                efficacy: { type: 'string' }
              }}},
              allergiesAdverse: { type: 'array', items: { type: 'object', properties: {
                medication: { type: 'string' },
                reaction: { type: 'string' }
              }}},
              medicationChanges: { type: 'array', items: { type: 'object', properties: {
                action: { type: 'string', description: 'Start, stop, increase, decrease' },
                medication: { type: 'string' },
                dose: { type: 'string' },
                reason: { type: 'string' }
              }}}
            },
            description: 'Psychotropic medication management'
          },

          psychiatricTreatmentPlan: {
            type: 'object',
            properties: {
              diagnoses: { type: 'array', items: { type: 'object', properties: {
                diagnosis: { type: 'string' },
                icdCode: { type: 'string' },
                specifiers: { type: 'array', items: { type: 'string' } }
              }}},
              pharmacological: { type: 'array', items: { type: 'object', properties: {
                intervention: { type: 'string' },
                rationale: { type: 'string' },
                monitoring: { type: 'string' }
              }}},
              psychotherapy: { type: 'object', properties: {
                type: { type: 'string', description: 'CBT, DBT, psychodynamic, etc.' },
                frequency: { type: 'string', description: 'IMPORTANT: Therapy frequency schedule (e.g., "Weekly", "Biweekly", "Weekly for first month, then biweekly")' },
                provider: { type: 'string' },
                goals: { type: 'array', items: { type: 'string' } }
              }},
              supportGroups: { type: 'array', items: { type: 'string' } },
              lifestyleModifications: { type: 'array', items: { type: 'string' } },
              safetyPlan: { type: 'object', properties: {
                warningSignsidentified: { type: 'array', items: { type: 'string' } },
                copingStrategies: { type: 'array', items: { type: 'string' } },
                supportsContacts: { type: 'array', items: { type: 'string' } },
                crisisNumbers: { type: 'array', items: { type: 'string' } },
                meansRestriction: { type: 'array', items: { type: 'string' } },
                childcarePlan: { type: 'string', description: 'IMPORTANT: Childcare safety planning for patients with children (e.g., "Plan for childcare during acute episodes", "Emergency contacts for child supervision")' }
              }},
              followUpPlan: { type: 'object', properties: {
                nextAppointment: { type: 'string' },
                frequency: { type: 'string', description: 'IMPORTANT: Psychiatric follow-up frequency (e.g., "Monthly psychiatrist visits until stable", "2 weeks, then monthly", "Every 3 months once stable")' },
                monitoring: { type: 'array', items: { type: 'string' }, description: 'CRITICAL: Specific monitoring parameters (e.g., "Weight monitoring: Weekly given recent gain", "Blood pressure checks", "Mood logs", "Side effect assessment")' }
              }}
            },
            description: 'Comprehensive psychiatric treatment plan'
          },

          psychosocialFactors: {
            type: 'object',
            properties: {
              stressors: { type: 'array', items: { type: 'string' } },
              supportSystem: { type: 'object', properties: {
                family: { type: 'string' },
                friends: { type: 'string' },
                community: { type: 'string' }
              }},
              livingEnvironment: { type: 'string' },
              financialStatus: { type: 'string' },
              traumaHistory: { type: 'string', description: 'CRITICAL: Significant trauma history (e.g., "Witnessed father\'s death from heart attack at age 35", "Combat exposure", "Childhood abuse"). Important for treatment planning.' },
              legalHistory: { type: 'string', description: 'IMPORTANT: Legal history status (e.g., "No history", "DUI in 2018", "Custody dispute ongoing")' },
              legalIssues: { type: 'array', items: { type: 'string' } },
              culturalFactors: { type: 'array', items: { type: 'string' } },
              spiritualBeliefs: { type: 'string' },
              copingMechanisms: { type: 'array', items: { type: 'string' } }
            },
            description: 'Psychosocial assessment factors'
          },

          homicideRiskAssessment: {
            type: 'object',
            properties: {
              ideation: { type: 'boolean' },
              target: { type: 'string' },
              plan: { type: 'string' },
              means: { type: 'string' },
              intent: { type: 'string' },
              riskFactors: { type: 'array', items: { type: 'string' } },
              interventions: { type: 'array', items: { type: 'string' } }
            },
            description: 'Homicide risk assessment'
          },

          // ========== BIOPSYCHOSOCIAL FORMULATION ==========
          biopsychosocialFormulation: {
            type: 'object',
            properties: {
              biologicalFactors: {
                type: 'object',
                properties: {
                  genetics: { type: 'string' },
                  neurotransmitters: { type: 'string' },
                  medicalConditions: { type: 'array', items: { type: 'string' } },
                  substanceEffects: { type: 'string' },
                  neuroanatomy: { type: 'string' },
                  endocrine: { type: 'string' },
                  medications: { type: 'array', items: { type: 'string' } }
                }
              },
              psychologicalFactors: {
                type: 'object',
                properties: {
                  personality: { type: 'string' },
                  copingMechanisms: { type: 'array', items: { type: 'string' } },
                  cognitiveBiases: { type: 'array', items: { type: 'string' } },
                  attachmentStyle: { type: 'string' },
                  trauma: { type: 'array', items: { type: 'string' } },
                  defenses: { type: 'array', items: { type: 'string' } },
                  beliefs: { type: 'string' },
                  selfEsteem: { type: 'string' }
                }
              },
              socialFactors: {
                type: 'object',
                properties: {
                  familyDynamics: { type: 'string' },
                  socialSupport: { type: 'string' },
                  occupationalStress: { type: 'string' },
                  financialStressors: { type: 'string' },
                  culturalFactors: { type: 'string' },
                  discrimination: { type: 'string' },
                  relationships: { type: 'string' },
                  housingStability: { type: 'string' }
                }
              },
              strengths: { type: 'array', items: { type: 'string' } },
              vulnerabilities: { type: 'array', items: { type: 'string' } },
              perpetuatingFactors: { type: 'array', items: { type: 'string' } },
              protectiveFactors: { type: 'array', items: { type: 'string' } },
              integratedFormulation: { type: 'string' }
            },
            description: 'Comprehensive biopsychosocial formulation'
          },

          diagnosticImpression: {
            type: 'object',
            properties: {
              primaryDiagnosis: {
                type: 'object',
                properties: {
                  diagnosis: { type: 'string' },
                  icd10Code: { type: 'string' },
                  dsm5Code: { type: 'string' },
                  specifiers: { type: 'array', items: { type: 'string' } },
                  severity: { type: 'string' }
                }
              },
              differentialDiagnoses: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    diagnosis: { type: 'string' },
                    icd10Code: { type: 'string' },
                    dsm5Code: { type: 'string' },
                    rationale: { type: 'string' }
                  }
                }
              },
              comorbidities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    diagnosis: { type: 'string' },
                    icd10Code: { type: 'string' },
                    dsm5Code: { type: 'string' }
                  }
                }
              },
              provisionalDiagnoses: { type: 'array', items: { type: 'string' } },
              ruleOutDiagnoses: { type: 'array', items: { type: 'string' } }
            },
            description: 'Diagnostic impressions with codes'
          },

          treatmentGoals: {
            type: 'object',
            properties: {
              immediateGoals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    goal: { type: 'string' },
                    timeframe: { type: 'string' },
                    measurable: { type: 'string' }
                  }
                }
              },
              shortTermGoals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    goal: { type: 'string' },
                    timeframe: { type: 'string' },
                    measurable: { type: 'string' }
                  }
                }
              },
              longTermGoals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    goal: { type: 'string' },
                    timeframe: { type: 'string' },
                    measurable: { type: 'string' }
                  }
                }
              },
              patientGoals: { type: 'array', items: { type: 'string' } },
              familyGoals: { type: 'array', items: { type: 'string' } }
            },
            description: 'Treatment goals and objectives'
          },

          careCoordination: {
            type: 'object',
            properties: {
              primaryCareProvider: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  practice: { type: 'string' },
                  lastCommunication: { type: 'string' },
                  nextUpdate: { type: 'string' }
                }
              },
              specialists: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    specialty: { type: 'string' },
                    name: { type: 'string' },
                    practice: { type: 'string' },
                    role: { type: 'string' }
                  }
                }
              },
              therapist: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  frequency: { type: 'string' },
                  nextAppointment: { type: 'string' }
                }
              },
              caseManager: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  agency: { type: 'string' },
                  contact: { type: 'string' }
                }
              },
              familyInvolvement: {
                type: 'object',
                properties: {
                  familyMembers: { type: 'array', items: { type: 'string' } },
                  familyTherapy: { type: 'boolean' },
                  familyEducation: { type: 'array', items: { type: 'string' } }
                }
              },
              communityResources: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    resource: { type: 'string' },
                    type: { type: 'string' },
                    contact: { type: 'string' },
                    referralStatus: { type: 'string' }
                  }
                }
              }
            },
            description: 'Care coordination and collaborative treatment'
          },

          psychiatricReview: {
            type: 'object',
            properties: {
              lastPsychiatristVisit: { type: 'string' },
              medicationCompliance: { type: 'string' },
              medicationSideEffects: { type: 'array', items: { type: 'string' } },
              therapeuticResponse: { type: 'string' },
              bloodLevels: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    level: { type: 'string' },
                    date: { type: 'string' },
                    therapeutic: { type: 'boolean' }
                  }
                }
              },
              metabolicMonitoring: {
                type: 'object',
                properties: {
                  weight: { type: 'string' },
                  glucose: { type: 'string' },
                  lipids: { type: 'string' },
                  prolactin: { type: 'string' },
                  thyroid: { type: 'string' }
                }
              },
              ekg: { type: 'string' },
              geneticTesting: { type: 'string' }
            },
            description: 'Psychiatric medication review and monitoring'
          },

          functionalAssessment: {
            type: 'object',
            properties: {
              globalAssessment: { type: 'string' },
              occupationalFunctioning: { type: 'string' },
              socialFunctioning: { type: 'string' },
              academicFunctioning: { type: 'string' },
              selfCare: { type: 'string' },
              independentLiving: { type: 'string' },
              financialManagement: { type: 'string' },
              medicationManagement: { type: 'string' },
              transportationAccess: { type: 'string' },
              legalIssues: { type: 'string' }
            },
            description: 'Functional status assessment'
          },

          // ========== PULMONOLOGY & RESPIRATORY ==========
          pulmonaryFunctionTests: {
            type: 'object',
            properties: {
              testDate: { type: 'string', description: 'CRITICAL: ONLY extract if date is explicitly stated. DO NOT fabricate dates. Leave EMPTY if not stated.' },
              preBronchodilator: {
                type: 'object',
                properties: {
                  fev1: { type: 'object', properties: {
                    value: { type: 'string' },
                    percentPredicted: { type: 'string' }
                  }},
                  fvc: { type: 'object', properties: {
                    value: { type: 'string' },
                    percentPredicted: { type: 'string' }
                  }},
                  fev1FvcRatio: { type: 'string' },
                  pef: { type: 'object', properties: {
                    value: { type: 'string' },
                    percentPredicted: { type: 'string' }
                  }},
                  fef2575: { type: 'string' }
                }
              },
              postBronchodilator: {
                type: 'object',
                properties: {
                  fev1: { type: 'object', properties: {
                    value: { type: 'string' },
                    percentPredicted: { type: 'string' },
                    percentChange: { type: 'string' }
                  }},
                  fvc: { type: 'object', properties: {
                    value: { type: 'string' },
                    percentPredicted: { type: 'string' }
                  }},
                  fev1FvcRatio: { type: 'string' },
                  pef: { type: 'object', properties: {
                    value: { type: 'string' },
                    percentPredicted: { type: 'string' }
                  }}
                }
              },
              reversibility: { type: 'string' },
              interpretation: { type: 'string' },
              dlco: { type: 'string' },
              lungVolumes: { type: 'object' },
              predictedPostoperativeFev1: {
                type: 'object',
                properties: {
                  value: { type: 'string', description: 'Predicted post-op FEV1 value (e.g., "48%", "1.2 L")' },
                  adequacy: { type: 'string', description: 'CRITICAL: Clinical interpretation of adequacy (e.g., "adequate for lobectomy", "adequate for pneumonectomy", "insufficient"). Essential for surgical decision-making.' }
                },
                description: 'IMPORTANT: Predicted postoperative FEV1 with clinical adequacy assessment for surgical planning'
              },

              comprehensiveLungVolumes: {
                type: 'object',
                properties: {
                  totalLungCapacity: {
                    type: 'object',
                    properties: {
                      value: { type: 'string', description: 'TLC value (e.g., "6.2 L")' },
                      percentPredicted: { type: 'string', description: 'TLC % predicted (e.g., "95%")' }
                    }
                  },
                  residualVolume: {
                    type: 'object',
                    properties: {
                      value: { type: 'string', description: 'RV value (e.g., "2.8 L")' },
                      percentPredicted: { type: 'string', description: 'RV % predicted (e.g., "145%" - elevated in air trapping)' }
                    }
                  },
                  functionalResidualCapacity: {
                    type: 'object',
                    properties: {
                      value: { type: 'string', description: 'FRC value (e.g., "3.5 L")' },
                      percentPredicted: { type: 'string' }
                    }
                  },
                  rvTlcRatio: { type: 'string', description: 'RV/TLC ratio (e.g., "45%" - elevated >40% indicates air trapping)' },
                  inspiratoryCapacity: { type: 'string', description: 'IC value (e.g., "2.7 L")' },
                  vitalCapacity: { type: 'string', description: 'VC value (e.g., "3.4 L")' },
                  method: { type: 'string', description: 'Method used (Body plethysmography, Helium dilution, Nitrogen washout)' }
                },
                description: 'Complete lung volume measurements for restrictive/obstructive pattern differentiation'
              },

              dlcoComprehensive: {
                type: 'object',
                properties: {
                  dlcoUncorrected: {
                    type: 'object',
                    properties: {
                      value: { type: 'string', description: 'DLCO value (e.g., "18.5 mL/min/mmHg")' },
                      percentPredicted: { type: 'string', description: 'DLCO % predicted (e.g., "65%")' }
                    }
                  },
                  dlcoCorrectedForHgb: {
                    type: 'object',
                    properties: {
                      value: { type: 'string' },
                      percentPredicted: { type: 'string', description: 'Hemoglobin-corrected DLCO %predicted' }
                    }
                  },
                  kco: {
                    type: 'object',
                    properties: {
                      value: { type: 'string', description: 'KCO (DLCO/VA) value (e.g., "4.2 mL/min/mmHg/L")' },
                      percentPredicted: { type: 'string' }
                    },
                    description: 'DLCO corrected for alveolar volume'
                  },
                  alveolarVolume: {
                    type: 'object',
                    properties: {
                      value: { type: 'string', description: 'VA value (e.g., "4.4 L")' },
                      percentPredicted: { type: 'string' }
                    }
                  },
                  hemoglobin: { type: 'string', description: 'Hemoglobin value used for correction (e.g., "12.5 g/dL")' },
                  interpretation: { type: 'string', description: 'Clinical interpretation (e.g., "Mild diffusion impairment", "Moderate restriction with preserved DLCO", "Severe diffusion defect suggesting ILD or emphysema")' }
                },
                description: 'Comprehensive DLCO (diffusing capacity) with hemoglobin correction for ILD, emphysema, pulmonary vascular disease assessment'
              },

              flowVolumeLoop: {
                type: 'object',
                properties: {
                  shape: { type: 'string', description: 'Flow-volume loop morphology (e.g., "Normal", "Flattened expiratory limb - obstruction", "Scooped expiratory limb - COPD", "Flattened inspiratory AND expiratory - fixed upper airway obstruction", "Plateau on inspiratory limb - variable extrathoracic obstruction")' },
                  peakExpiratoryFlow: {
                    type: 'object',
                    properties: {
                      value: { type: 'string' },
                      percentPredicted: { type: 'string' }
                    }
                  },
                  peakInspiratoryFlow: {
                    type: 'object',
                    properties: {
                      value: { type: 'string' },
                      percentPredicted: { type: 'string' }
                    }
                  },
                  fef50: { type: 'string', description: 'Forced expiratory flow at 50% of FVC (e.g., "3.2 L/s")' },
                  fif50: { type: 'string', description: 'Forced inspiratory flow at 50% of FVC' },
                  fef50Fif50Ratio: { type: 'string', description: 'FEF50/FIF50 ratio - <1 suggests upper airway obstruction' },
                  upperAirwayObstruction: { type: 'boolean', description: 'Evidence of upper airway obstruction on loop morphology' }
                },
                description: 'Flow-volume loop analysis for upper airway obstruction and obstruction pattern characterization'
              },

              bronchodilatorResponse: {
                type: 'object',
                properties: {
                  fev1Improvement: { type: 'string', description: 'FEV1 improvement in mL (e.g., "250 mL")' },
                  fev1PercentImprovement: { type: 'string', description: 'FEV1 % improvement (e.g., "15%")' },
                  fvcImprovement: { type: 'string', description: 'FVC improvement in mL' },
                  fvcPercentImprovement: { type: 'string', description: 'FVC % improvement' },
                  significantResponse: { type: 'boolean', description: 'Significant bronchodilator response (≥12% AND ≥200mL improvement in FEV1 or FVC)' },
                  clinicalInterpretation: { type: 'string', description: 'Clinical significance (e.g., "Significant response - asthma component likely", "No significant response - COPD without reversibility", "Paradoxical response")' }
                },
                description: 'CRITICAL: Bronchodilator response assessment for asthma vs COPD differentiation'
              },

              sixMinuteWalkTest: {
                type: 'object',
                properties: {
                  distance: { type: 'string', description: '6MWT distance (e.g., "380 meters")' },
                  percentPredicted: { type: 'string', description: 'Distance % of predicted' },
                  preOxygenSaturation: { type: 'string', description: 'SpO2 pre-test (e.g., "96%")' },
                  lowestOxygenSaturation: { type: 'string', description: 'Lowest SpO2 during test (e.g., "88%")' },
                  postOxygenSaturation: { type: 'string', description: 'SpO2 post-test (e.g., "92%")' },
                  oxygenDesaturation: { type: 'boolean', description: 'Significant desaturation (drop ≥4% or SpO2 <90%)' },
                  supplementalOxygen: { type: 'string', description: 'Oxygen used during test (e.g., "2 L/min NC", "None")' },
                  preHeartRate: { type: 'string' },
                  maxHeartRate: { type: 'string' },
                  postHeartRate: { type: 'string' },
                  borgDyspneaScore: { type: 'string', description: 'Borg dyspnea score post-test (0-10 scale)' },
                  borgFatigueScore: { type: 'string', description: 'Borg leg fatigue score' },
                  stopsRequired: { type: 'boolean', description: 'Did patient need to stop during test' },
                  limitingFactor: { type: 'string', description: 'Limiting factor (e.g., "Dyspnea", "Leg fatigue", "Oxygen desaturation")' }
                },
                description: 'Six-minute walk test for exercise capacity and oxygen needs assessment'
              },

              cardiopulmonaryExerciseTest: {
                type: 'object',
                properties: {
                  performed: { type: 'boolean' },
                  protocol: { type: 'string', description: 'Protocol (e.g., "Bruce protocol", "Ramp protocol", "Cycle ergometry")' },
                  peakVO2: {
                    type: 'object',
                    properties: {
                      value: { type: 'string', description: 'Peak VO2 (e.g., "18.5 mL/kg/min")' },
                      percentPredicted: { type: 'string' }
                    }
                  },
                  anaerobicThreshold: { type: 'string', description: 'AT (e.g., "12.3 mL/kg/min", "55% of predicted VO2max")' },
                  ventilatoryEquivalents: {
                    type: 'object',
                    properties: {
                      veCO2Slope: { type: 'string', description: 'VE/VCO2 slope (e.g., "32" - elevated >34 suggests pulmonary vascular disease or heart failure)' },
                      veCO2AtAT: { type: 'string', description: 'VE/VCO2 at anaerobic threshold' }
                    }
                  },
                  oxygenPulse: { type: 'string', description: 'O2 pulse (mL/beat) - reflects stroke volume' },
                  respiratoryExchangeRatio: { type: 'string', description: 'RER peak (e.g., "1.15" - >1.1 indicates good effort)' },
                  breathingReserve: { type: 'string', description: 'Breathing reserve % (e.g., "25%" - <15% suggests ventilatory limitation)' },
                  heartRateReserve: { type: 'string', description: 'Heart rate reserve % (e.g., "10%" - <15% suggests cardiac limitation)' },
                  limitingFactor: { type: 'string', description: 'Primary limitation (Cardiovascular, Ventilatory, Deconditioning, Pulmonary vascular)' },
                  interpretation: { type: 'string', description: 'Clinical interpretation and surgical risk assessment' }
                },
                description: 'Cardiopulmonary exercise testing (CPET) for preoperative risk assessment and dyspnea evaluation'
              },

              qualityAssessment: {
                type: 'object',
                properties: {
                  acceptability: { type: 'string', description: 'Acceptability criteria met (e.g., "3 acceptable maneuvers obtained")' },
                  reproducibility: { type: 'string', description: 'Reproducibility (e.g., "FEV1 and FVC within 150mL")' },
                  effort: { type: 'string', description: 'Patient effort (Good, Fair, Poor)' },
                  technicalIssues: { type: 'string', description: 'Technical issues affecting interpretation (e.g., "Coughing during maneuver", "Inadequate seal", "Variable effort")' }
                },
                description: 'Test quality metrics - essential for result reliability'
              }
            },
            description: 'Comprehensive pulmonary function testing results'
          },

          asthmaAssessment: {
            type: 'object',
            properties: {
              severity: { type: 'string' },
              control: { type: 'string' },
              actScore: { type: 'string' },
              ginaStep: { type: 'string' },
              exacerbationHistory: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string' },
                    patientAge: { type: 'string', description: 'IMPORTANT: Patient\'s age at time of hospitalization (e.g., "Age 8", "Age 12", "Age 17"). Critical for pediatric asthma history tracking.' },
                    severity: { type: 'string' },
                    treatment: { type: 'string' },
                    hospitalization: { type: 'boolean' },
                    icuAdmission: { type: 'boolean' },
                    intubation: { type: 'boolean' },
                    durationDays: { type: 'string', description: 'IMPORTANT: Duration of hospitalization (e.g., "2 days", "3 days"). Critical for severity assessment.' },
                    edVisit: { type: 'boolean', description: 'IMPORTANT: Emergency department visit without admission' },
                    dischargedHome: { type: 'boolean', description: 'If ED visit, whether patient was discharged home' }
                  }
                },
                description: 'CRITICAL: Extract ALL hospitalization events mentioned in dedicated "Past Hospitalizations for Asthma" section. Include ICU admissions, hospital admissions, AND recent ED visits (even if from past month). Each event should be a separate entry.'
              },
              triggers: { type: 'array', items: { type: 'string' } },
              nocturnal: { type: 'string' },
              exerciseLimitation: { type: 'string' },
              rescueUseFrequency: { type: 'string' },
              peakFlowPersonalBest: {
                type: 'object',
                properties: {
                  personalBest: { type: 'string', description: 'CRITICAL: Personal best peak flow value (e.g., "480 L/min"). Essential for asthma action plan zone calculations.' },
                  current: { type: 'string', description: 'Current peak flow measurement (e.g., "280 L/min")' },
                  percentOfBest: { type: 'string', description: 'Current as percentage of personal best (e.g., "58%")' }
                },
                description: 'CRITICAL: Extract BOTH personal best and current peak flow values. Personal best is essential for asthma action plan calculations.'
              },
              fenoLevel: { type: 'string' },
              sputumEosinophils: { type: 'string' }
            },
            description: 'Comprehensive asthma assessment and control metrics'
          },

          asthmaActionPlan: {
            type: 'object',
            properties: {
              greenZone: {
                type: 'object',
                properties: {
                  peakFlowRange: { type: 'string' },
                  symptoms: { type: 'array', items: { type: 'string' }, description: 'CRITICAL: ONLY extract symptoms explicitly listed in Green Zone section of PDF. DO NOT infer or add standard asthma symptoms. Leave EMPTY if no symptoms explicitly listed.' },
                  medications: { type: 'array', items: { type: 'string' } },
                  actions: { type: 'array', items: { type: 'string' } }
                },
                description: 'Green Zone - Well controlled. Extract ONLY explicitly stated information.'
              },
              yellowZone: {
                type: 'object',
                properties: {
                  peakFlowRange: { type: 'string' },
                  symptoms: { type: 'array', items: { type: 'string' }, description: 'CRITICAL: ONLY extract symptoms explicitly listed in Yellow Zone section of PDF. DO NOT infer or add standard asthma symptoms. Leave EMPTY if no symptoms explicitly listed.' },
                  medications: { type: 'array', items: { type: 'string' } },
                  actions: { type: 'array', items: { type: 'string' } },
                  contactInstructions: { type: 'string' }
                },
                description: 'Yellow Zone - Caution. Extract ONLY explicitly stated information.'
              },
              redZone: {
                type: 'object',
                properties: {
                  peakFlowRange: { type: 'string' },
                  symptoms: { type: 'array', items: { type: 'string' }, description: 'CRITICAL: ONLY extract symptoms explicitly listed in Red Zone section of PDF. DO NOT infer or add standard asthma symptoms. Leave EMPTY if no symptoms explicitly listed.' },
                  emergencyMedications: { type: 'array', items: { type: 'string' } },
                  emergencyContact: { type: 'string' },
                  when911: { type: 'array', items: { type: 'string' } }
                },
                description: 'Red Zone - Medical Alert. Extract ONLY explicitly stated information.'
              }
            },
            description: 'Personalized asthma action plan'
          },

          respiratoryMedications: {
            type: 'object',
            properties: {
              controllers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    class: { type: 'string' },
                    dose: { type: 'string' },
                    frequency: { type: 'string' },
                    device: { type: 'string' },
                    technique: { type: 'string' },
                    adherence: { type: 'string' }
                  }
                }
              },
              relievers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    dose: { type: 'string' },
                    frequency: { type: 'string' },
                    maxDailyUse: { type: 'string' }
                  }
                }
              },
              biologics: {
                type: 'object',
                properties: {
                  medication: { type: 'string' },
                  dose: { type: 'string' },
                  frequency: { type: 'string' },
                  route: { type: 'string' },
                  startDate: { type: 'string' },
                  response: { type: 'string' }
                }
              },
              nebulizers: { type: 'array', items: { type: 'string' } },
              oralCorticosteroids: {
                type: 'object',
                properties: {
                  current: { type: 'boolean' },
                  dose: { type: 'string' },
                  duration: { type: 'string' },
                  taperSchedule: { type: 'string' },
                  yearlyBursts: { type: 'number' }
                }
              }
            },
            description: 'Comprehensive respiratory medication management'
          },

          allergyAssessment: {
            type: 'object',
            properties: {
              environmentalAllergens: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    allergen: { type: 'string' },
                    severity: { type: 'string' },
                    igeLevel: { type: 'string' },
                    skinTestResult: { type: 'string' }
                  }
                }
              },
              totalIge: { type: 'string' },
              specificIge: { type: 'array', items: { type: 'object' } },
              eosinophilCount: { type: 'string' },
              aspergillusSpecific: {
                type: 'object',
                properties: {
                  igeLevel: { type: 'string' },
                  iggLevel: { type: 'string' },
                  abpaRisk: { type: 'string' }
                }
              }
            },
            description: 'Allergy testing and immunological assessment'
          },

          environmentalExposures: {
            type: 'object',
            properties: {
              housing: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  age: { type: 'string' },
                  mold: { type: 'boolean' },
                  pets: { type: 'array', items: { type: 'string' } },
                  carpeting: { type: 'boolean' },
                  ventilation: { type: 'string' },
                  heating: { type: 'string' }
                }
              },
              occupational: {
                type: 'array',
                items: { type: 'string' }
              },
              smoking: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  packYears: { type: 'string' },
                  secondhandExposure: { type: 'boolean' },
                  quitDate: { type: 'string' }
                }
              },
              airQuality: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                  aqiAverage: { type: 'string' },
                  pollutants: { type: 'array', items: { type: 'string' } }
                }
              }
            },
            description: 'Environmental and occupational exposures'
          },

          copdAssessment: {
            type: 'object',
            properties: {
              goldStage: { type: 'string' },
              goldGroup: { type: 'string' },
              catScore: { type: 'string' },
              mmrcDyspneaScale: { type: 'string' },
              exacerbationsPerYear: { type: 'number', description: 'ONLY if explicitly stated - DO NOT default to 0 or 1' },
              bodePlexIndex: { type: 'string' },
              sixMinuteWalkDistance: { type: 'string' },
              oxygenRequirement: {
                type: 'object',
                properties: {
                  continuous: { type: 'boolean', description: 'ONLY if explicitly stated - DO NOT default to false' },
                  nocturnal: { type: 'boolean', description: 'ONLY if explicitly stated - DO NOT default to false' },
                  exertional: { type: 'boolean', description: 'ONLY if explicitly stated - DO NOT default to false' },
                  litersPerMinute: { type: 'string' }
                }
              },
              emphysemaDistribution: { type: 'string' },
              chronicBronchitisFeatures: { type: 'boolean' }
            },
            description: 'COPD assessment and staging'
          },

          sleepStudy: {
            type: 'object',
            properties: {
              studyType: { type: 'string' },
              studyDate: { type: 'string', description: 'Date of sleep study (e.g., "6 months ago", "2024-03-15")' },
              ahi: { type: 'string' },
              rdi: { type: 'string' },
              lowestO2: { type: 'string' },
              time88Below: { type: 'string' },
              arousalIndex: { type: 'string' },
              sleepEfficiency: { type: 'string' },
              remPercentage: { type: 'string' },
              cpapTitration: {
                type: 'object',
                properties: {
                  optimalPressure: { type: 'string' },
                  mask: { type: 'string' },
                  compliance: { type: 'string' }
                }
              },
              diagnosis: { type: 'string' }
            },
            description: 'Sleep study and apnea assessment'
          },

          pulmonaryImaging: {
            type: 'object',
            properties: {
              chestXray: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  findings: { type: 'array', items: { type: 'string' } },
                  hyperinflation: { type: 'boolean' },
                  infiltrates: { type: 'boolean' }
                }
              },
              ctChest: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  findings: { type: 'array', items: { type: 'string' } },
                  emphysema: { type: 'string' },
                  bronchiectasis: { type: 'boolean' },
                  fibrosis: { type: 'string' },
                  nodules: { type: 'array', items: { type: 'object' } }
                }
              },
              ventilationPerfusion: { type: 'object' },
              pulmonaryAngiography: { type: 'object' }
            },
            description: 'Pulmonary imaging studies'
          },

          respiratoryInfections: {
            type: 'object',
            properties: {
              currentInfection: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  pathogen: { type: 'string' },
                  sputumCulture: { type: 'string' },
                  antibioticSensitivity: { type: 'array', items: { type: 'string' } },
                  treatment: { type: 'string' }
                }
              },
              recurrentInfections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string' },
                    type: { type: 'string' },
                    pathogen: { type: 'string' },
                    treatment: { type: 'string' }
                  }
                }
              },
              pneumoniaHistory: { type: 'array', items: { type: 'string' } },
              tuberculosisRisk: { type: 'string' },
              immunizations: {
                type: 'object',
                properties: {
                  influenza: { type: 'string' },
                  pneumococcal: { type: 'string' },
                  covid19: { type: 'string' },
                  tdap: { type: 'string' }
                }
              }
            },
            description: 'Respiratory infections and immunization status'
          },

          pulmonaryRehabilitation: {
            type: 'object',
            properties: {
              enrolled: { type: 'boolean' },
              program: { type: 'string' },
              components: { type: 'array', items: { type: 'string' } },
              exerciseCapacity: { type: 'string' },
              breathingTechniques: { type: 'array', items: { type: 'string' } },
              nutritionalCounseling: { type: 'boolean' },
              psychosocialSupport: { type: 'boolean' },
              outcomes: { type: 'string' }
            },
            description: 'Pulmonary rehabilitation program'
          },

          respiratoryDevices: {
            type: 'object',
            properties: {
              homeNebulizer: { type: 'boolean' },
              peakFlowMeter: { type: 'boolean' },
              spacerDevice: { type: 'string' },
              cpapBipap: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  settings: { type: 'string' },
                  compliance: { type: 'string' },
                  dataDownload: { type: 'object' }
                }
              },
              oxygenConcentrator: { type: 'boolean' },
              hepaFilter: { type: 'boolean' },
              airPurifier: { type: 'boolean' }
            },
            description: 'Respiratory equipment and devices'
          },

          // ========== RHEUMATOLOGY & AUTOIMMUNE ==========
          rheumatologicAssessment: {
            type: 'object',
            properties: {
              chiefComplaint: { type: 'string' },
              symptomDuration: { type: 'string' },
              morningStiffness: {
                type: 'object',
                properties: {
                  present: { type: 'boolean' },
                  duration: { type: 'string' },
                  improvesWithActivity: { type: 'boolean' }
                }
              },
              jointInvolvement: {
                type: 'object',
                properties: {
                  pattern: { type: 'string' },
                  distribution: { type: 'string' },
                  affectedJoints: { type: 'array', items: { type: 'string' } },
                  synovitis: { type: 'array', items: { type: 'string' } },
                  deformities: { type: 'array', items: { type: 'string' } }
                }
              },
              systemicSymptoms: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            description: 'Comprehensive rheumatologic assessment'
          },

          autoantibodyProfile: {
            type: 'object',
            properties: {
              ana: {
                type: 'object',
                properties: {
                  titer: { type: 'string' },
                  pattern: { type: 'string' },
                  positive: { type: 'boolean' }
                }
              },
              antiDsDna: { type: 'string', description: 'Result or status (e.g., "positive", "negative", "pending", "ordered")' },
              antiSmith: { type: 'string', description: 'Result or status (e.g., "positive", "negative", "pending", "ordered")' },
              antiSsaRo: { type: 'string', description: 'Anti-SSA/Ro result or status' },
              antiSsbLa: { type: 'string', description: 'Anti-SSB/La result or status' },
              antiRnp: { type: 'string', description: 'Anti-RNP result or status' },
              antiScl70: { type: 'string', description: 'Anti-Scl-70 result or status' },
              antiCentromere: { type: 'string', description: 'Anti-centromere result or status' },
              antiJo1: { type: 'string', description: 'Anti-Jo-1 result or status' },
              antiCcp: { type: 'string', description: 'Anti-CCP result or status' },
              rheumatoidFactor: { type: 'string', description: 'RF result or status' },
              antiphospholipidAntibodies: {
                type: 'object',
                properties: {
                  anticardiolipin: { type: 'object' },
                  beta2Glycoprotein: { type: 'object' },
                  lupusAnticoagulant: { type: 'string' }
                }
              },
              anca: {
                type: 'object',
                properties: {
                  cAnca: { type: 'string' },
                  pAnca: { type: 'string' },
                  antiPr3: { type: 'string' },
                  antiMpo: { type: 'string' }
                }
              }
            },
            description: 'IMPORTANT: Comprehensive autoantibody testing results. For each antibody, capture result if available OR status ("pending", "ordered") if test was ordered but results not yet available.'
          },

          orderedLabs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                testName: { type: 'string', description: 'Lab test name (e.g., "Anti-dsDNA antibody", "24-hour urine for protein and creatinine clearance")' },
                category: { type: 'string', description: 'Category (e.g., "Autoantibody", "Chemistry", "Hematology", "Infectious disease screening")' },
                indication: { type: 'string', description: 'Why test was ordered (e.g., "for diagnosis confirmation", "before immunosuppression")' }
              }
            },
            description: 'CRITICAL: ALL laboratory tests ordered during visit but results not yet available. Distinct from completed labs in labResults. Important for tracking pending workup.'
          },

          inflammatoryMarkers: {
            type: 'object',
            properties: {
              esr: { type: 'string' },
              crp: { type: 'string' },
              ferritin: { type: 'string' },
              complement: {
                type: 'object',
                properties: {
                  c3: { type: 'string' },
                  c4: { type: 'string' },
                  ch50: { type: 'string' }
                }
              },
              immunoglobulins: {
                type: 'object',
                properties: {
                  igG: { type: 'string' },
                  igA: { type: 'string' },
                  igM: { type: 'string' }
                }
              }
            },
            description: 'Inflammatory and immune markers'
          },

          connectiveTissueDiseaseAssessment: {
            type: 'object',
            properties: {
              diagnosis: { type: 'string' },
              classificationCriteria: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    criterion: { type: 'string' },
                    met: { type: 'boolean' },
                    details: { type: 'string' }
                  }
                }
              },
              diseaseActivity: {
                type: 'object',
                properties: {
                  score: { type: 'string' },
                  scale: { type: 'string' },
                  severity: { type: 'string' }
                }
              },
              organInvolvement: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    organ: { type: 'string' },
                    manifestation: { type: 'string' },
                    severity: { type: 'string' }
                  }
                }
              }
            },
            description: 'Connective tissue disease evaluation'
          },

          lupusAssessment: {
            type: 'object',
            properties: {
              sledaiScore: { type: 'string' },
              acr1997Criteria: { type: 'array', items: { type: 'string' } },
              eularCriteria: { type: 'array', items: { type: 'string' } },
              cutaneousManifestations: {
                type: 'object',
                properties: {
                  malarRash: { type: 'boolean' },
                  discoidRash: { type: 'boolean' },
                  photosensitivity: { type: 'boolean' },
                  oralUlcers: { type: 'boolean' },
                  alopecia: { type: 'string' }
                }
              },
              renalInvolvement: {
                type: 'object',
                properties: {
                  proteinuria: { type: 'string', description: 'Proteinuria level (e.g., "Trace protein", "1+ protein", "300 mg/day")' },
                  hematuria: { type: 'boolean' },
                  casts: { type: 'string', description: 'IMPORTANT: Urine casts presence (e.g., "no casts", "RBC casts present", "cellular casts"). Critical for lupus nephritis assessment.' },
                  biopsyClass: { type: 'string' },
                  twentyFourHourUrineOrdered: { type: 'boolean', description: 'IMPORTANT: Whether 24-hour urine collection was ordered for quantification' }
                },
                description: 'Renal involvement assessment including both current findings and pending workup'
              },
              neurologicalInvolvement: { type: 'array', items: { type: 'string' } },
              hematologicalInvolvement: {
                type: 'object',
                properties: {
                  anemia: { type: 'string' },
                  leukopenia: { type: 'string' },
                  thrombocytopenia: { type: 'string' },
                  lymphopenia: { type: 'string' }
                }
              },
              serositis: { type: 'array', items: { type: 'string' } }
            },
            description: 'Systemic lupus erythematosus assessment'
          },

          rheumatoidArthritisAssessment: {
            type: 'object',
            properties: {
              das28Score: { type: 'string' },
              cdaiScore: { type: 'string' },
              sdaiScore: { type: 'string' },
              acr20Response: { type: 'string' },
              jointCounts: {
                type: 'object',
                properties: {
                  tender28: { type: 'number' },
                  swollen28: { type: 'number' },
                  tender68: { type: 'number' },
                  swollen66: { type: 'number' }
                }
              },
              functionalStatus: { type: 'string' },
              radiographicProgression: { type: 'string' },
              extraarticularManifestations: { type: 'array', items: { type: 'string' } }
            },
            description: 'Rheumatoid arthritis disease assessment'
          },

          vasculitisAssessment: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              bvasScore: { type: 'string' },
              vdiScore: { type: 'string' },
              organSystems: { type: 'array', items: { type: 'string' } },
              biopsyResults: { type: 'string' },
              angiographicFindings: { type: 'string' }
            },
            description: 'Vasculitis evaluation'
          },

          spondyloarthritisAssessment: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              basdaiScore: { type: 'string' },
              basfiScore: { type: 'string' },
              asdas: { type: 'string' },
              hlab27: { type: 'string' },
              sacroiliitis: { type: 'string' },
              spinalMobility: {
                type: 'object',
                properties: {
                  schober: { type: 'string' },
                  occiputToWall: { type: 'string' },
                  chestExpansion: { type: 'string' },
                  cervicalRotation: { type: 'string' }
                }
              },
              enthesitis: { type: 'array', items: { type: 'string' } },
              dactylitis: { type: 'array', items: { type: 'string' } }
            },
            description: 'Spondyloarthritis assessment'
          },

          myositisAssessment: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              muscleWeakness: {
                type: 'object',
                properties: {
                  distribution: { type: 'string' },
                  mrcScale: { type: 'object' },
                  functionalImpact: { type: 'string' }
                }
              },
              skinManifestations: {
                type: 'object',
                properties: {
                  gottronPapules: { type: 'boolean' },
                  heliotropeRash: { type: 'boolean' },
                  mechanicsHands: { type: 'boolean' },
                  shawlSign: { type: 'boolean' }
                }
              },
              muscleEnzymes: {
                type: 'object',
                properties: {
                  ck: { type: 'string' },
                  aldolase: { type: 'string' },
                  ldh: { type: 'string' },
                  ast: { type: 'string' },
                  alt: { type: 'string' }
                }
              },
              emgFindings: { type: 'string' },
              muscleBiopsy: { type: 'string' },
              myositisAntibodies: { type: 'array', items: { type: 'string' } }
            },
            description: 'Inflammatory myopathy assessment'
          },

          sjogrensSyndromeAssessment: {
            type: 'object',
            properties: {
              sicca: {
                type: 'object',
                properties: {
                  dryEyes: { type: 'string' },
                  dryMouth: { type: 'string' },
                  schirmerTest: { type: 'string' },
                  saxonTest: { type: 'string' }
                }
              },
              salivarGlandBiopsy: { type: 'string' },
              sialography: { type: 'string' },
              systemicManifestations: { type: 'array', items: { type: 'string' } },
              essdaiScore: { type: 'string' },
              esspriScore: { type: 'string' }
            },
            description: 'Sjögren syndrome evaluation'
          },

          sclerodermaAssessment: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              skinThickness: {
                type: 'object',
                properties: {
                  mrodnanScore: { type: 'string' },
                  distribution: { type: 'string' }
                }
              },
              raynaudsPhenomenon: {
                type: 'object',
                properties: {
                  severity: { type: 'string' },
                  digitalUlcers: { type: 'boolean' },
                  nailfoldCapillaroscopy: { type: 'string' }
                }
              },
              internalOrganInvolvement: {
                type: 'object',
                properties: {
                  pulmonary: { type: 'string' },
                  cardiac: { type: 'string' },
                  renal: { type: 'string' },
                  gastrointestinal: { type: 'string' }
                }
              }
            },
            description: 'Systemic sclerosis assessment'
          },

          goutAssessment: {
            type: 'object',
            properties: {
              uricAcidLevel: { type: 'string' },
              jointAspirate: {
                type: 'object',
                properties: {
                  crystals: { type: 'string' },
                  birefringence: { type: 'string' },
                  wbc: { type: 'string' }
                }
              },
              tophiPresent: { type: 'boolean' },
              tophiLocations: { type: 'array', items: { type: 'string' } },
              flareFrequency: { type: 'string' },
              renalInvolvement: { type: 'string' },
              dualEnergyCtFindings: { type: 'string' }
            },
            description: 'Gout and crystal arthropathy assessment'
          },

          rheumatologicTreatment: {
            type: 'object',
            properties: {
              dmards: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    dose: { type: 'string' },
                    frequency: { type: 'string' },
                    startDate: { type: 'string' },
                    response: { type: 'string' },
                    sideEffects: { type: 'array', items: { type: 'string' } }
                  }
                }
              },
              biologics: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    mechanism: { type: 'string' },
                    dose: { type: 'string' },
                    frequency: { type: 'string' },
                    route: { type: 'string' },
                    response: { type: 'string' }
                  }
                }
              },
              corticosteroids: {
                type: 'object',
                properties: {
                  current: { type: 'string' },
                  cumulative: { type: 'string' },
                  complications: { type: 'array', items: { type: 'string' } }
                }
              },
              nsaids: { type: 'array', items: { type: 'string' } },
              adjunctTherapies: { type: 'array', items: { type: 'string' } }
            },
            description: 'Rheumatologic treatment regimen'
          },

          rheumatologicMonitoring: {
            type: 'object',
            properties: {
              diseaseActivityMonitoring: {
                type: 'object',
                properties: {
                  frequency: { type: 'string' },
                  parameters: { type: 'array', items: { type: 'string' } },
                  lastAssessment: { type: 'string' }
                }
              },
              medicationMonitoring: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    monitoring: { type: 'array', items: { type: 'string' } },
                    frequency: { type: 'string' }
                  }
                }
              },
              immunizationStatus: {
                type: 'object',
                properties: {
                  liveVaccinesContraindicated: { type: 'boolean' },
                  pneumococcal: { type: 'string' },
                  influenza: { type: 'string' },
                  hepatitisB: { type: 'string' },
                  shingles: { type: 'string' }
                }
              },
              screeningProtocols: {
                type: 'object',
                properties: {
                  tuberculosis: { type: 'string' },
                  hepatitis: { type: 'string' },
                  malignancy: { type: 'string' },
                  osteoporosis: { type: 'string' },
                  cardiovascular: { type: 'string' }
                }
              }
            },
            description: 'Disease and treatment monitoring protocols'
          },

          // ========== CARDIOLOGY SPECIFIC ==========
          cardiologyAssessment: {
            type: 'object',
            properties: {
              echocardiogram: {
                type: 'object',
                properties: {
                  ejectionFraction: { type: 'string' },
                  lvedd: { type: 'string', description: 'LV end-diastolic diameter' },
                  lvesd: { type: 'string', description: 'LV end-systolic diameter' },
                  wallMotion: { type: 'string' },
                  valvularFunction: { type: 'object' },
                  diastolicFunction: { type: 'string' },
                  rvsp: { type: 'string', description: 'Right ventricular systolic pressure' },
                  pericardialEffusion: { type: 'string' }
                }
              },
              electrocardiogram: {
                type: 'object',
                properties: {
                  rhythm: { type: 'string' },
                  rate: { type: 'number' },
                  prInterval: { type: 'string' },
                  qrsDuration: { type: 'string' },
                  qtInterval: { type: 'string' },
                  qtcInterval: { type: 'string' },
                  axis: { type: 'string' },
                  stChanges: { type: 'string' },
                  tWaveChanges: { type: 'string' },
                  interpretation: { type: 'string' }
                }
              },
              cardiacCatheterization: {
                type: 'object',
                properties: {
                  coronaryAngiography: { type: 'array', items: { type: 'object' } },
                  hemodynamics: { type: 'object' },
                  interventions: { type: 'array', items: { type: 'object' } },
                  timiFlow: { type: 'string' },
                  ffr: { type: 'string', description: 'Fractional flow reserve' },

                  // ========== TASK 15: STEMI-SPECIFIC QUALITY METRICS ==========
                  stemiMetrics: {
                    type: 'object',
                    properties: {
                      doorToBalloonTime: {
                        type: 'object',
                        properties: {
                          minutes: { type: 'number', description: 'CRITICAL: Door-to-balloon time in minutes (target <90 min, optimal <60 min)' },
                          arrivalTime: { type: 'string', description: 'ED arrival time (e.g., "14:32")' },
                          balloonInflationTime: { type: 'string', description: 'Balloon inflation time (e.g., "15:18")' },
                          targetMet: { type: 'boolean', description: 'CRITICAL: Whether <90 min target was met' },
                          delays: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                delayType: { type: 'string', description: 'Type of delay (e.g., "ECG interpretation", "Patient decision", "Cath lab activation", "Anticoagulation reversal")' },
                                duration: { type: 'string', description: 'Duration of delay (e.g., "15 minutes")' },
                                reason: { type: 'string', description: 'Explanation for delay' }
                              }
                            },
                            description: 'Documented delays contributing to door-to-balloon time'
                          }
                        },
                        description: 'CRITICAL: Door-to-balloon time quality metric for STEMI (Class I recommendation: <90 min, optimal <60 min)'
                      },
                      firstMedicalContactToBalloon: {
                        type: 'object',
                        properties: {
                          minutes: { type: 'number', description: 'CRITICAL: FMC-to-balloon time for EMS STEMI activations (target <90 min)' },
                          fmcTime: { type: 'string', description: 'First medical contact time (EMS arrival)' },
                          targetMet: { type: 'boolean' }
                        },
                        description: 'First medical contact to balloon time for EMS-transported STEMI patients'
                      },
                      culpritVessel: {
                        type: 'object',
                        properties: {
                          vessel: { type: 'string', description: 'CRITICAL: Culprit artery (e.g., "LAD", "RCA", "LCx", "Diagonal")' },
                          stenosis: { type: 'string', description: 'Percent stenosis (e.g., "100% occlusion", "95% stenosis")' },
                          lesionCharacteristics: { type: 'string', description: 'Lesion description (e.g., "Thrombotic occlusion", "Ulcerated plaque", "Dissection")' },
                          preTimiFlow: {
                            type: 'string',
                            enum: ['TIMI 0 (complete occlusion)', 'TIMI 1 (minimal flow)', 'TIMI 2 (partial flow)', 'TIMI 3 (normal flow)'],
                            description: 'CRITICAL: Pre-PCI TIMI flow (most STEMIs are TIMI 0-1)'
                          },
                          postTimiFlow: {
                            type: 'string',
                            enum: ['TIMI 0', 'TIMI 1', 'TIMI 2', 'TIMI 3'],
                            description: 'CRITICAL: Post-PCI TIMI flow (goal: TIMI 3 restoration)'
                          },
                          timiFlowRestored: { type: 'boolean', description: 'CRITICAL: Whether TIMI 3 flow was restored' }
                        },
                        description: 'CRITICAL: Culprit vessel identification and pre/post TIMI flow'
                      },
                      stentDetails: {
                        type: 'object',
                        properties: {
                          stentsPlaced: { type: 'number', description: 'Number of stents placed' },
                          stentLocations: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                vessel: { type: 'string', description: 'Vessel stented (e.g., "Proximal LAD")' },
                                stentType: { type: 'string', description: 'Stent type (e.g., "Drug-eluting stent - Everolimus", "Bare metal stent")' },
                                stentSize: { type: 'string', description: 'Stent dimensions (e.g., "3.0 x 23 mm")' },
                                expansion: { type: 'string', description: 'Stent expansion assessment (e.g., "Well-apposed", "Suboptimal expansion")' }
                              }
                            }
                          },
                          residualStenosis: { type: 'string', description: 'Residual stenosis after PCI (goal: <10%)' },
                          complications: { type: 'array', items: { type: 'string' }, description: 'Complications (e.g., "No-reflow", "Dissection", "Perforation", "None")' }
                        },
                        description: 'Stent placement details for STEMI PCI'
                      },
                      cardiacBiomarkers: {
                        type: 'object',
                        properties: {
                          peakTroponin: {
                            type: 'object',
                            properties: {
                              value: { type: 'string', description: 'CRITICAL: Peak troponin value' },
                              unit: { type: 'string', description: 'ng/mL or ng/L' },
                              timingPostPCI: { type: 'string', description: 'When peak occurred (e.g., "6 hours post-PCI", "24 hours post-PCI")' }
                            },
                            description: 'CRITICAL: Peak troponin reflects infarct size'
                          },
                          peakCKMB: {
                            type: 'object',
                            properties: {
                              value: { type: 'string' },
                              timingPostPCI: { type: 'string' }
                            }
                          }
                        },
                        description: 'Peak cardiac biomarkers post-STEMI (correlate with infarct size and prognosis)'
                      },
                      lvEjectionFraction: {
                        type: 'object',
                        properties: {
                          prePCIEstimate: { type: 'string', description: 'Pre-PCI EF estimate (if available)' },
                          postPCIEcho: { type: 'string', description: 'CRITICAL: Post-PCI echo EF (e.g., "35-40% (moderately reduced)", "50-55% (mildly reduced)")' },
                          timing: { type: 'string', description: 'When echo was performed (e.g., "Day 2 post-MI")' },
                          wallMotionAbnormalities: { type: 'string', description: 'Wall motion abnormalities (e.g., "Anteroapical akinesis", "Inferior hypokinesis")' }
                        },
                        description: 'CRITICAL: LV function assessment post-STEMI (determines ICD eligibility if EF <35% at 40 days)'
                      },
                      dischargeMedications: {
                        type: 'object',
                        properties: {
                          dapt: {
                            type: 'object',
                            properties: {
                              aspirin: { type: 'string', description: 'Aspirin dose (e.g., "81 mg daily")' },
                              p2y12Inhibitor: { type: 'string', description: 'CRITICAL: P2Y12 inhibitor (e.g., "Ticagrelor 90 mg BID", "Prasugrel 10 mg daily", "Clopidogrel 75 mg daily")' },
                              daptDuration: { type: 'string', description: 'CRITICAL: DAPT duration (minimum 12 months for DES)' }
                            },
                            description: 'CRITICAL: Dual antiplatelet therapy (DAPT) - Class I recommendation post-STEMI'
                          },
                          statin: {
                            type: 'object',
                            properties: {
                              medication: { type: 'string', description: 'CRITICAL: High-intensity statin (e.g., "Atorvastatin 80 mg daily", "Rosuvastatin 40 mg daily")' },
                              ldlGoal: { type: 'string', description: 'LDL goal <70 mg/dL (Class I recommendation)' }
                            },
                            description: 'CRITICAL: High-intensity statin therapy (Class I recommendation)'
                          },
                          betaBlocker: {
                            type: 'object',
                            properties: {
                              medication: { type: 'string', description: 'CRITICAL: Beta-blocker (e.g., "Metoprolol succinate 50 mg daily")' },
                              indication: { type: 'string', description: 'Indication (e.g., "Post-MI, reduced EF")' }
                            },
                            description: 'CRITICAL: Beta-blocker therapy (Class I for reduced EF)'
                          },
                          aceInhibitorOrArb: {
                            type: 'object',
                            properties: {
                              medication: { type: 'string', description: 'CRITICAL: ACE-I or ARB (e.g., "Lisinopril 10 mg daily", "Losartan 50 mg daily")' },
                              indication: { type: 'string', description: 'Indication (e.g., "Anterior MI with reduced EF")' }
                            },
                            description: 'CRITICAL: ACE-I/ARB therapy (Class I for anterior MI, HF, EF <40%, DM, CKD)'
                          },
                          mineralocorticoidReceptorAntagonist: {
                            type: 'object',
                            properties: {
                              medication: { type: 'string', description: 'MRA (e.g., "Spironolactone 25 mg daily", "Eplerenone 25 mg daily")' },
                              indication: { type: 'string', description: 'CRITICAL: Indicated if EF <40% and HF or DM (Class I recommendation)' }
                            },
                            description: 'Mineralocorticoid receptor antagonist for post-MI reduced EF'
                          }
                        },
                        description: 'CRITICAL: Guideline-directed medical therapy (GDMT) post-STEMI'
                      },
                      cardiacRehab: {
                        type: 'object',
                        properties: {
                          referred: { type: 'boolean', description: 'CRITICAL: Cardiac rehab referral (Class I recommendation - improves mortality)' },
                          enrollmentScheduled: { type: 'boolean', description: 'Whether patient has scheduled first session' },
                          barriers: { type: 'array', items: { type: 'string' }, description: 'Barriers to enrollment (e.g., "Transportation", "Insurance", "Patient declined")' }
                        },
                        description: 'CRITICAL: Cardiac rehabilitation referral (Class I recommendation, reduces mortality by 26%)'
                      }
                    },
                    description: 'TASK 15: STEMI-specific quality metrics for door-to-balloon time, PCI outcomes, and guideline-directed medical therapy'
                  }
                }
              },
              stressTest: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: 'Exercise, pharmacologic' },
                  protocol: { type: 'string' },
                  duration: { type: 'string' },
                  maxHeartRate: { type: 'string' },
                  peakHeartRate: { type: 'string', description: 'Peak heart rate with MPHR percentage (e.g., "118 bpm (75% MPHR)")' },
                  targetAchieved: { type: 'boolean' },
                  symptoms: { type: 'string' },
                  ecgChanges: { type: 'string' },
                  dukeTreadmillScore: { type: 'number' },
                  bloodPressure: {
                    type: 'object',
                    properties: {
                      rest: { type: 'string', description: 'Resting BP (e.g., "138/82")' },
                      peak: { type: 'string', description: 'Peak exercise BP (e.g., "146/88")' }
                    },
                    description: 'Blood pressure during stress test'
                  }
                }
              },
              scheduledProcedures: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    procedureName: { type: 'string' },
                    timeframe: { type: 'string' },
                    urgency: { type: 'string' },
                    indication: { type: 'string' }
                  }
                },
                description: 'Procedures scheduled or recommended (e.g., cardiac catheterization)'
              },
              additionalTestingOrdered: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    testName: { type: 'string' },
                    indication: { type: 'string' },
                    urgency: { type: 'string' }
                  }
                },
                description: 'Additional tests ordered (e.g., echo, carotid ultrasound, Holter)'
              },
              coronaryArteryDiseaseRiskFactors: {
                type: 'object',
                properties: {
                  smoking: { type: 'string', description: 'Smoking status and pack-years' },
                  hypertension: { type: 'string', description: 'HTN duration and control' },
                  diabetes: { type: 'string', description: 'DM duration and control' },
                  hyperlipidemia: { type: 'string', description: 'Lipid levels and treatment' },
                  familyHistory: { type: 'string', description: 'Family history of premature CAD' },
                  obesity: { type: 'string', description: 'BMI and weight status' },
                  sedentaryLifestyle: { type: 'string', description: 'Physical activity level' },
                  otherRiskFactors: { type: 'array', items: { type: 'string' }, description: 'Additional risk factors (CKD, inflammatory conditions, etc.)' }
                },
                description: 'CAD risk factors for cardiac risk stratification'
              }
            }
          },

          // ========== ENDOCRINOLOGY SPECIFIC ==========
          endocrinologyAssessment: {
            type: 'object',
            properties: {
              thyroidFunction: {
                type: 'object',
                properties: {
                  tsh: { type: 'string' },
                  freeT4: { type: 'string' },
                  freeT3: { type: 'string' },
                  thyroidAntibodies: { type: 'object' },
                  thyroidUltrasound: { type: 'object' }
                }
              },
              adrenalFunction: {
                type: 'object',
                properties: {
                  cortisol: { type: 'string' },
                  acth: { type: 'string' },
                  dexamethasoneSuppression: { type: 'string' },
                  aldosterone: { type: 'string' },
                  renin: { type: 'string' }
                }
              },
              pituitaryFunction: {
                type: 'object',
                properties: {
                  prolactin: { type: 'string' },
                  igf1: { type: 'string' },
                  growthHormone: { type: 'string' },
                  lh: { type: 'string' },
                  fsh: { type: 'string' }
                }
              },
              parathyroidFunction: {
                type: 'object',
                properties: {
                  pth: { type: 'string', description: 'Parathyroid hormone level (e.g., "elevated")' },
                  calcium: { type: 'string', description: 'Serum calcium level (e.g., "hypercalcemia", "10.8 mg/dL")' },
                  phosphorus: { type: 'string', description: 'Serum phosphorus level' },
                  vitaminD: { type: 'string', description: 'Vitamin D level (25-OH)' },
                  alkalinePhosphatase: { type: 'string', description: 'Alkaline phosphatase level (e.g., "elevated")' }
                },
                description: 'Parathyroid and bone metabolism lab values'
              },
              metabolicPanel: {
                type: 'object',
                properties: {
                  fastingGlucose: { type: 'string' },
                  ogtt: { type: 'object' },
                  lipidPanel: { type: 'object' },
                  uricAcid: { type: 'string' }
                }
              }
            }
          },

          // ========== DERMATOLOGY SPECIFIC ==========
          dermatologyAssessment: {
            type: 'object',
            properties: {
              skinLesions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    location: { type: 'string' },
                    morphology: { type: 'string' },
                    size: { type: 'string' },
                    color: { type: 'string' },
                    distribution: { type: 'string' },
                    dermoscopyFindings: { type: 'string' }
                  }
                }
              },
              biopsyResults: {
                type: 'object',
                properties: {
                  histopathology: { type: 'string' },
                  immunofluorescence: { type: 'string' },
                  specialStains: { type: 'array', items: { type: 'string' } }
                }
              },
              pasiScore: { type: 'number', description: 'Psoriasis Area Severity Index' },
              scoradIndex: { type: 'number', description: 'Atopic dermatitis severity' },
              dlqi: { type: 'number', description: 'Dermatology Life Quality Index' },
              phototherapy: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  dose: { type: 'string' },
                  frequency: { type: 'string' },
                  totalSessions: { type: 'number' }
                }
              },
              dermoscopicPhotography: {
                type: 'object',
                description: 'Digital dermoscopic imaging documentation',
                properties: {
                  imagesObtained: { type: 'array', items: { type: 'string' } },
                  lesionsPhotographed: { type: 'array', items: { type: 'string' } },
                  purpose: { type: 'string', description: 'monitoring, documentation, etc.' }
                }
              },
              melanomaSurveillancePlan: {
                type: 'object',
                description: 'Contingency planning for melanoma diagnosis',
                properties: {
                  ifMelanoma: { type: 'string' },
                  ifDysplasticNevus: { type: 'string' },
                  wideExcisionPlan: { type: 'string' },
                  sentinelNodePlan: { type: 'string' },
                  followUpSchedule: { type: 'string' }
                }
              },
              systemicTherapyInitiation: {
                type: 'object',
                description: 'Timing and requirements for systemic therapy',
                properties: {
                  timing: { type: 'string' },
                  prerequisites: { type: 'array', items: { type: 'string' } },
                  baselineRequirements: { type: 'string' }
                }
              }
            }
          },

          // ========== EMERGENCY MEDICINE SPECIFIC ==========
          emergencyAssessment: {
            type: 'object',
            properties: {
              triageLevel: { type: 'string', description: 'ESI 1-5' },
              arrivalMode: { type: 'string' },
              chiefComplaintDuration: { type: 'string' },
              primarySurvey: {
                type: 'object',
                properties: {
                  airway: { type: 'string' },
                  breathing: { type: 'string' },
                  circulation: { type: 'string' },
                  disability: { type: 'string' },
                  exposure: { type: 'string' }
                }
              },
              traumaAssessment: {
                type: 'object',
                properties: {
                  mechanism: { type: 'string' },
                  injuryPattern: { type: 'array', items: { type: 'string' } },
                  gcs: { type: 'number' },
                  rts: { type: 'number', description: 'Revised Trauma Score' }
                }
              },
              resuscitation: {
                type: 'object',
                properties: {
                  ivAccess: { type: 'string' },
                  fluids: { type: 'array', items: { type: 'object' } },
                  bloodProducts: { type: 'array', items: { type: 'object' } },
                  medications: { type: 'array', items: { type: 'object' } },
                  procedures: { type: 'array', items: { type: 'string' } }
                }
              },
              disposition: {
                type: 'object',
                properties: {
                  outcome: { type: 'string' },
                  admitTo: { type: 'string' },
                  transferTo: { type: 'string' },
                  ama: { type: 'boolean' }
                }
              }
            }
          },

          // ========== ANESTHESIOLOGY SPECIFIC ==========
          anesthesiologyAssessment: {
            type: 'object',
            properties: {
              asaClassification: { type: 'string' },
              airwayAssessment: {
                type: 'object',
                properties: {
                  mallampati: { type: 'string' },
                  thyromental: { type: 'string' },
                  neckMobility: { type: 'string' },
                  mouthOpening: { type: 'string' },
                  dentition: { type: 'string' },
                  beard: { type: 'string' },
                  previousIntubation: { type: 'string' },
                  previousIntubationGrade: { type: 'string' }
                }
              },
              anesthesiaPlan: {
                type: 'object',
                properties: {
                  technique: { type: 'string' },
                  rationale: { type: 'string', description: 'Clinical reasoning for anesthesia choice' },
                  riskAssessment: { type: 'string', description: 'Risk stratification details (e.g., HIGH RISK for difficult intubation)' },
                  induction: { type: 'string' },
                  maintenance: { type: 'string' },
                  emergence: { type: 'string' },
                  postopAnalgesia: { type: 'string' },
                  backupPlan: { type: 'string', description: 'Alternative plan if primary fails' },
                  specialConsiderations: { type: 'string', description: 'Special equipment or precautions needed' }
                }
              },
              painManagement: {
                type: 'object',
                properties: {
                  currentPainScore: { type: 'number' },
                  painCharacteristics: { type: 'string' },
                  currentAnalgesics: { type: 'array', items: { type: 'object' } },
                  regionalBlocks: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          },

          // ========== RADIOLOGY SPECIFIC ==========
          radiologyFindings: {
            type: 'object',
            properties: {
              modalityUsed: { type: 'string' },
              technique: { type: 'string' },
              contrast: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  amount: { type: 'string' },
                  reaction: { type: 'string' }
                }
              },
              findings: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    anatomicLocation: { type: 'string' },
                    finding: { type: 'string' },
                    size: { type: 'string' },
                    characteristics: { type: 'string' },
                    significance: { type: 'string' }
                  }
                }
              },
              comparison: { type: 'string' },
              impression: { type: 'string' },
              biRads: { type: 'string' },
              tirads: { type: 'string' },
              pirads: { type: 'string' }
            }
          },

          // ========== PATHOLOGY SPECIFIC ==========
          pathologyReport: {
            type: 'object',
            properties: {
              reportDate: { type: 'string', description: 'Date of pathology report (YYYY-MM-DD)' },
              status: { type: 'string', description: 'Report status (e.g., "Preliminary", "Final")' },
              specimenCollectionDate: { type: 'string', description: 'Date specimen was collected (YYYY-MM-DD)' },
              orderingPhysician: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Physician name' },
                  specialty: { type: 'string', description: 'Specialty (e.g., "Hematology/Oncology")' }
                },
                description: 'Physician who ordered the pathology study'
              },
              pathologist: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  credentials: { type: 'string', description: 'Credentials (e.g., "MD, PhD")' },
                  boardCertifications: { type: 'string', description: 'Board certifications' }
                },
                description: 'Primary pathologist'
              },
              consultingPathologist: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  specialty: { type: 'string', description: 'Consultation specialty' },
                  credentials: { type: 'string' },
                  consultationNote: { type: 'string', description: 'Full consultation note content with pathologist opinion and recommendations' }
                },
                description: 'Consulting pathologist with complete consultation note'
              },
              specimens: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string', description: 'Specimen label (e.g., "A", "B", "C")' },
                    type: { type: 'string', description: 'Type of specimen (e.g., "Lymph Node", "Bone Marrow", "Peripheral Blood")' },
                    site: { type: 'string', description: 'Anatomic site (e.g., "Left Cervical")' },
                    procedure: { type: 'string', description: 'Procedure type (e.g., "Excisional Biopsy")' },
                    handling: { type: 'string', description: 'Detailed specimen handling (fresh, frozen, fixation, portions submitted)' },
                    boneMarrowCoreDetails: { type: 'string', description: 'Bone marrow core biopsy details with measurements (e.g., "Two intact cores, 1.8 cm and 2.1 cm")' },
                    boneMarrowAspirateVolume: { type: 'string', description: 'Aspirate volume submitted (e.g., "3 mL submitted for smears and flow cytometry")' },
                    cassettesSubmitted: { type: 'string', description: 'Number of cassettes for permanent sections (e.g., "10 cassettes")' },
                    electronMicroscopyFixative: { type: 'string', description: 'Fixative used for electron microscopy (e.g., "glutaraldehyde fixed")' },
                    cytogeneticsMedia: { type: 'string', description: 'Transport media for cytogenetics (e.g., "received in RPMI")' },
                    grossDescription: { type: 'string', description: 'Gross pathology description including cut surface appearance' },
                    cutSurface: { type: 'string', description: 'Cut surface description (e.g., "tan-pink, homogeneous, with loss of normal nodal architecture. No necrosis identified")' }
                  }
                },
                description: 'Array of specimens submitted, each labeled (A, B, C, etc.) with separate details'
              },
              specimen: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  site: { type: 'string' },
                  procedure: { type: 'string' },
                  clinicalHistory: { type: 'string' },
                  handling: { type: 'string', description: 'Detailed specimen handling (fresh, frozen, fixation, portions submitted)' },
                  boneMarrowCoreDetails: { type: 'string', description: 'Bone marrow core biopsy details with measurements (e.g., "Two intact cores, 1.8 cm and 2.1 cm")' },
                  boneMarrowAspirateVolume: { type: 'string', description: 'Aspirate volume submitted (e.g., "3 mL submitted for smears and flow cytometry")' },
                  cassettesSubmitted: { type: 'string', description: 'Number of cassettes for permanent sections (e.g., "10 cassettes")' },
                  electronMicroscopyFixative: { type: 'string', description: 'Fixative used for electron microscopy (e.g., "glutaraldehyde fixed")' },
                  cytogeneticsMedia: { type: 'string', description: 'Transport media for cytogenetics (e.g., "received in RPMI")' }
                },
                description: 'DEPRECATED: Use specimens array instead. Kept for backward compatibility.'
              },
              grossDescription: { type: 'string' },
              microscopicDescription: { type: 'string' },
              microscopicFindings: {
                type: 'object',
                properties: {
                  mitoticRate: { type: 'string', description: 'Mitotic rate with count per HPF (e.g., "High mitotic rate: 28 mitoses/10 HPF")' },
                  necrosisPercentage: { type: 'string', description: 'Percentage of necrosis (e.g., "Focal areas of necrosis (<5%)")' }
                },
                description: 'Structured microscopic findings for prognostic factors'
              },
              lymphNodeCytomorphology: {
                type: 'object',
                properties: {
                  cellSize: { type: 'string', description: 'Cell size comparison (e.g., "Large cells (2-3x size of small lymphocyte)")' },
                  centroblasticPercentage: { type: 'string', description: 'Percentage of centroblastic morphology (e.g., "80%", "predominant")' },
                  nucleoli: { type: 'string', description: 'Nucleoli count and description (e.g., "2-4 prominent nucleoli")' },
                  starrySkyPattern: { type: 'string', description: 'Presence of starry sky pattern (e.g., "Scattered tingible body macrophages creating starry sky pattern")' },
                  architecture: { type: 'string', description: 'Architectural pattern (e.g., "Complete effacement of normal lymph node architecture")' }
                },
                description: 'Detailed cytomorphology of lymph node for lymphoma classification'
              },
              stoneComposition: { type: 'string', description: 'Stone composition (e.g., "cholesterol", "calcium oxalate")' },
              stoneSize: { type: 'string', description: 'Stone size range (e.g., "0.5-1.2 cm")' },
              wallThickness: { type: 'string', description: 'Wall thickness measurement (e.g., "4-6mm")' },
              dimensions: {
                type: 'object',
                properties: {
                  length: { type: 'string', description: 'Length in cm' },
                  width: { type: 'string', description: 'Width in cm' },
                  height: { type: 'string', description: 'Height in cm' },
                  unit: { type: 'string', description: 'Unit of measurement (e.g., "cm", "mm")' },
                  specimenLabel: { type: 'string', description: 'Which specimen these dimensions refer to (e.g., "Specimen A - Lymph Node")' }
                },
                description: 'Structured specimen dimensions with unit and specimen identification'
              },
              imagingStudies: { type: 'string', description: 'Prior imaging findings relevant to pathology' },
              specialStains: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    stain: { type: 'string', description: 'Stain name (e.g., "PAS", "Reticulin", "Congo Red")' },
                    result: { type: 'string', description: 'Result (e.g., "Negative", "Positive")' },
                    details: { type: 'string', description: 'Additional details' }
                  }
                },
                description: 'Special stains performed'
              },
              immunohistochemistry: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    marker: { type: 'string' },
                    result: { type: 'string' },
                    pattern: { type: 'string' },
                    percentage: { type: 'string', description: 'Percentage of positive cells if applicable' },
                    blockNumber: { type: 'string', description: 'Specific block used for staining (e.g., "Block A3", "Block B2")' },
                    specimenSource: { type: 'string', description: 'Which specimen this IHC is from (e.g., "Lymph Node", "Bone Marrow")' }
                  }
                },
                description: 'Include all markers including CD4/CD8 ratio with block tracking'
              },
              molecularStudies: {
                type: 'object',
                properties: {
                  fishAnalysis: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        gene: { type: 'string' },
                        result: { type: 'string' },
                        details: { type: 'string', description: 'Include translocation and percentage of positive cells with full context (e.g., "BCL2 detected in 92% of cells")' },
                        cellPercentage: { type: 'string', description: 'NUMERIC ONLY percentage of cells (e.g., "92%") - extract just the number, not the full sentence' }
                      }
                    },
                    description: 'FISH analysis with detailed cell percentages. IMPORTANT: cellPercentage should be numeric only (e.g., "92%"), while details contains full description'
                  },
                  ngsPanel: {
                    type: 'object',
                    properties: {
                      mutations: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            gene: { type: 'string' },
                            mutationType: { type: 'string', description: 'Type of mutation (e.g., "Frameshift", "Missense", "Nonsense")' },
                            vaf: { type: 'string' },
                            details: { type: 'string' }
                          }
                        }
                      }
                    }
                  },
                  pcrResults: { type: 'array', items: { type: 'object' } },
                  clonalityStudies: { type: 'string', description: 'IGH/TCR gene rearrangement studies' }
                }
              },
              flowCytometry: {
                type: 'object',
                properties: {
                  lymphNode: {
                    type: 'object',
                    properties: {
                      percentageOfCells: { type: 'string', description: 'Percentage of abnormal cells' },
                      findings: { type: 'string' },
                      lightChainRatio: { type: 'string', description: 'Kappa:Lambda ratio (e.g., "Kappa:Lambda ratio 15:1")' },
                      markers: {
                        type: 'object',
                        properties: {
                          CD38: { type: 'string', description: 'CD38 expression (e.g., "positive (partial)", "negative")' },
                          FMC7: { type: 'string', description: 'FMC7 expression (e.g., "positive", "negative")' }
                        },
                        description: 'Additional flow cytometry markers for B-cell lymphoma subtyping'
                      },
                      cellSize: { type: 'string', description: 'Flow cytometry scatter characteristics (e.g., "FSC/SSC: Large cell gate")' }
                    }
                  },
                  boneMarrow: {
                    type: 'object',
                    properties: {
                      percentageOfCells: { type: 'string', description: 'Percentage of abnormal cells' },
                      findings: { type: 'string' },
                      immunophenotype: { type: 'string', description: 'Bone marrow immunophenotype comparison (e.g., "Similar immunophenotype to lymph node")' }
                    }
                  }
                },
                description: 'Flow cytometry results from different specimens with detailed marker analysis'
              },
              margins: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  distance: { type: 'string' }
                }
              },
              stagingInfo: {
                type: 'object',
                properties: {
                  tnm: { type: 'object' },
                  grade: { type: 'string' },
                  lymphNodes: { type: 'object' }
                }
              },
              tumorBoardReview: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'Date of tumor board review (YYYY-MM-DD)' },
                  consensus: { type: 'string', description: 'Consensus diagnosis or recommendation' }
                },
                description: 'Tumor board review if performed'
              },
              electronicSignature: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'Date of signature (YYYY-MM-DD)' },
                  timestamp: { type: 'string', description: 'Complete timestamp including time' }
                },
                description: 'Electronic signature details'
              },
              amendmentNote: { type: 'string', description: 'Pending results, addenda, or amendments with expected dates' },
              amendmentExpectedDate: { type: 'string', description: 'Expected date for pending results (YYYY-MM-DD format, e.g., "2025-01-30")' },
              finalDiagnosis: {
                type: 'object',
                properties: {
                  specimens: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        label: { type: 'string', description: 'Specimen label (e.g., "A", "B", "C")' },
                        specimenType: { type: 'string', description: 'Type (e.g., "LEFT CERVICAL LYMPH NODE", "BONE MARROW", "PERIPHERAL BLOOD")' },
                        diagnosis: { type: 'string', description: 'Final diagnosis for this specimen' },
                        details: { type: 'array', items: { type: 'string' }, description: 'Additional diagnostic details (e.g., "Approximately 30% marrow involvement", "Paratrabecular and interstitial pattern")' }
                      }
                    },
                    description: 'Per-specimen final diagnoses as formatted in the pathology report (A, B, C, etc.)'
                  },
                  peripheralBlood: { type: 'string', description: 'Peripheral blood findings (e.g., "NO CIRCULATING LYMPHOMA CELLS DETECTED")' },
                  doubleExpressor: { type: 'string', description: 'Double expressor status (e.g., "MYC and BCL2 protein co-expression (Double Expressor)")' },
                  germinalCenterPhenotype: { type: 'string', description: 'Complete immunophenotype formula (e.g., "Germinal center B-cell phenotype (CD10+/BCL6+/MUM1-)")' },
                  whoClassification: { type: 'string', description: 'WHO classification version used (e.g., "WHO 2017 Classification", "WHO 2022 Classification")' },
                  previousTerminology: { type: 'string', description: 'Historical terminology and classification changes (e.g., "Previously Double-Hit Lymphoma, WHO 2017 Classification")' }
                },
                description: 'Final diagnosis details for lymphoma/hematologic malignancies with per-specimen breakdown'
              }
            }
          },

          // ========== OPHTHALMOLOGY SPECIFIC ==========
          pastOcularHistory: {
            type: 'object',
            properties: {
              lastDilatedExam: { type: 'string', description: 'Last dilated exam date and findings (e.g., "2 years ago (mild NPDR noted)")' },
              glassesContactLensWear: { type: 'string', description: 'Corrective lens history (e.g., "Glasses/contact lens wear")' },
              refractiveError: { type: 'string', description: 'Historical refractive error (e.g., "Myopia since age 12")' },
              priorEyeSurgery: { type: 'string', description: 'History of eye surgery or "No prior eye surgery"' },
              eyeTrauma: { type: 'string', description: 'History of eye trauma or "No eye trauma"' }
            },
            description: 'Past ocular history and baseline information'
          },

          ophthalmologyExam: {
            type: 'object',
            properties: {
              technician: { type: 'string', description: 'Technician(s) who performed exam (e.g., "Maria Rodriguez, COA")' },
              dilationMedications: { type: 'string', description: 'Medications used for dilation (e.g., "Tropicamide 1% and Phenylephrine 2.5%")' },
              visualAcuity: {
                type: 'object',
                properties: {
                  od: { type: 'string' },
                  os: { type: 'string' },
                  ou: { type: 'string' },
                  corrected: { type: 'boolean' },
                  near: { type: 'string', description: 'Near vision measurement (e.g., "J1+ at 14 inches near (with correction)")' },
                  manifestRefractionResults: { type: 'string', description: 'Complete manifest refraction with visual acuity outcomes (e.g., "OD: -5.00 -1.25 x 085 → 20/25; OS: -4.75 -1.00 x 095 → 20/20-2")' }
                }
              },
              refraction: {
                type: 'object',
                properties: {
                  odSphere: { type: 'string' },
                  odCylinder: { type: 'string' },
                  odAxis: { type: 'string' },
                  osSphere: { type: 'string' },
                  osCylinder: { type: 'string' },
                  osAxis: { type: 'string' },
                  cycloplegic: { type: 'string', description: 'Cycloplegic refraction results (e.g., "OD: -4.75 -1.25 x 085; OS: -4.50 -1.00 x 095")' },
                  cycloplegicRefractionResults: { type: 'string', description: 'Cycloplegic refraction with visual acuity outcomes if documented' }
                }
              },
              pupils: {
                type: 'object',
                properties: {
                  od: { type: 'string', description: 'Right pupil size and reactivity' },
                  os: { type: 'string', description: 'Left pupil size and reactivity' },
                  rapd: { type: 'string', description: 'Relative afferent pupillary defect status' },
                  nearResponse: { type: 'string', description: 'Near response (e.g., "Normal near response")' },
                  details: { type: 'string', description: 'Complete pupil examination (e.g., "OD: 4mm in dark, 2mm in light, brisk response; OS: 4mm in dark, 2mm in light, brisk response; No RAPD; Normal near response")' }
                },
                description: 'Pupillary examination'
              },
              motilityAlignment: {
                type: 'object',
                properties: {
                  orthophoria: { type: 'string', description: 'Alignment status (e.g., "Orthophoric at distance and near")' },
                  extraocularMovements: { type: 'string', description: 'EOM findings (e.g., "Full extraocular movements OU")' },
                  convergence: { type: 'string', description: 'Convergence assessment (e.g., "Normal convergence")' },
                  nystagmus: { type: 'string', description: 'Nystagmus presence/absence (e.g., "No nystagmus")' },
                  combined: { type: 'string', description: 'Combined motility findings for backward compatibility' }
                },
                description: 'Structured extraocular motility and alignment assessment'
              },
              slitLampExamination: {
                type: 'object',
                properties: {
                  lids: { type: 'string', description: 'Lids/lashes findings (e.g., "Normal OU")' },
                  conjunctiva: { type: 'string', description: 'Conjunctiva/sclera findings (e.g., "White and quiet OU")' },
                  cornea: { type: 'string', description: 'Cornea findings including endothelium (e.g., "Clear OU, No guttata, No epithelial defects")' },
                  anteriorChamber: { type: 'string', description: 'AC findings (e.g., "Deep and quiet OU, No cells or flare, No neovascularization")' },
                  iris: { type: 'string', description: 'Iris findings (e.g., "Normal architecture, no neovascularization OU")' },
                  lens: { type: 'string', description: 'Lens findings for cataract assessment (e.g., "Trace nuclear sclerosis OU")' },
                  combined: { type: 'string', description: 'Combined slit lamp findings for backward compatibility' }
                },
                description: 'Structured slit lamp examination findings'
              },
              gonioscopy: {
                type: 'object',
                properties: {
                  method: { type: 'string', description: 'Lens type used (e.g., "Goldmann 3-mirror", "Zeiss 4-mirror")' },
                  findings: { type: 'string', description: 'Angle findings (e.g., "Open angles 360° OU; Shaffer Grade 4")' },
                  grade: { type: 'string', description: 'Shaffer grading system (0-4)' },
                  trabecularMeshwork: { type: 'string', description: 'TM visualization quality (e.g., "well-visualized")' },
                  pigmentation: { type: 'string', description: 'Trabecular pigmentation level (e.g., "Moderate trabecular pigmentation")' },
                  pas: { type: 'string', description: 'Peripheral anterior synechiae status (e.g., "No PAS")' },
                  neovascularization: { type: 'string', description: 'Angle neovascularization (e.g., "no neovascularization")' }
                },
                description: 'Comprehensive angle examination with clinical details'
              },
              intraocularPressure: {
                type: 'object',
                properties: {
                  od: { type: 'string' },
                  os: { type: 'string' },
                  method: { type: 'string' }
                }
              },
              fundoscopy: {
                type: 'object',
                properties: {
                  opticDisc: { type: 'object' },
                  macula: { type: 'object' },
                  vessels: { type: 'object' },
                  periphery: { type: 'object' }
                }
              },
              oct: {
                type: 'object',
                properties: {
                  rnfl: { type: 'object' },
                  maculaThickness: { type: 'object' },
                  maculaLayerDetails: { type: 'string', description: 'Specific retinal layer findings (e.g., "OD: Cystoid spaces in INL and ONL; OS: Intact ELM and ellipsoid zone")' },
                  maculaOD: {
                    type: 'object',
                    properties: {
                      subretinalFluid: { type: 'string', description: 'Subretinal fluid status (e.g., "absent", "present")' },
                      erm: { type: 'string', description: 'Epiretinal membrane status (e.g., "absent", "present")' },
                      cystoidSpaces: { type: 'string', description: 'Cystoid spaces location (e.g., "in INL and ONL")' }
                    },
                    description: 'Right eye macula OCT findings'
                  },
                  maculaOS: {
                    type: 'object',
                    properties: {
                      elmStatus: { type: 'string', description: 'External limiting membrane status (e.g., "Intact ELM and ellipsoid zone")' },
                      subretinalFluid: { type: 'string', description: 'Subretinal fluid status' },
                      erm: { type: 'string', description: 'Epiretinal membrane status' }
                    },
                    description: 'Left eye macula OCT findings'
                  },
                  ganglionCells: { type: 'object' }
                }
              }
            }
          },

          glaucomaManagement: {
            type: 'object',
            properties: {
              medicalTherapy: {
                type: 'object',
                properties: {
                  firstLine: { type: 'string', description: 'First-line medication (e.g., "latanoprost 0.005%")' },
                  secondLine: { type: 'string', description: 'Second-line or conditional medication with dosing (e.g., "timolol 0.5% BID if inadequate IOP control")' },
                  precautions: { type: 'array', items: { type: 'string' }, description: 'Critical precautions (e.g., "Avoid during pregnancy planning")' },
                  iopTarget: { type: 'string', description: 'Target IOP range' }
                },
                description: 'Glaucoma medication management with precautions'
              },
              laserTherapy: { type: 'string', description: 'Laser treatment options (e.g., "Consider SLT if medication intolerant. Especially important given pregnancy plans")' },
              surgicalConsideration: { type: 'string', description: 'Surgical options if medical therapy inadequate' },
              monitoringPlan: { type: 'string', description: 'Follow-up schedule for IOP and visual field monitoring' }
            },
            description: 'Comprehensive glaucoma management plan'
          },

          // ========== ENT SPECIFIC ==========
          entAssessment: {
            type: 'object',
            properties: {
              audiometry: {
                type: 'object',
                properties: {
                  rightEar: { type: 'object' },
                  leftEar: { type: 'object' },
                  speechDiscrimination: { type: 'string' },
                  tympanometry: { type: 'object' },
                  acousticReflexes: {
                    type: 'object',
                    properties: {
                      rightEar: { type: 'string', description: 'Right ear acoustic reflex results' },
                      leftEar: { type: 'string', description: 'Left ear acoustic reflex results' },
                      findings: { type: 'string', description: 'Acoustic reflex findings' }
                    },
                    description: 'Acoustic reflex testing results'
                  },
                  otoacousticEmissions: {
                    type: 'object',
                    properties: {
                      rightEar: { type: 'string', description: 'Right ear OAE results' },
                      leftEar: { type: 'string', description: 'Left ear OAE results' },
                      type: { type: 'string', description: 'Type of OAE test (DPOAE, TEOAE)' },
                      findings: { type: 'string', description: 'OAE test findings' }
                    },
                    description: 'Otoacoustic emissions testing results'
                  }
                }
              },
              nasopharyngolaryngoscopy: {
                type: 'object',
                properties: {
                  nasalCavity: { type: 'string' },
                  nasopharynx: { type: 'string' },
                  oropharynx: { type: 'string' },
                  hypopharynx: { type: 'string' },
                  larynx: { type: 'string' },
                  vocalCords: { type: 'string' }
                }
              },
              vestibularTesting: {
                type: 'object',
                properties: {
                  dixHallpikeTest: { type: 'string' },
                  caloricTesting: { type: 'string' },
                  vng: { type: 'string' }
                }
              },
              sinusAssessment: {
                type: 'object',
                properties: {
                  ctFindings: { type: 'string' },
                  endoscopy: { type: 'string' },
                  culture: { type: 'string' }
                }
              }
            }
          },

          // ========== INFECTIOUS DISEASE SPECIFIC ==========
          infectiousDiseaseAssessment: {
            type: 'object',
            properties: {
              hivStatus: {
                type: 'object',
                properties: {
                  cd4Count: { type: 'string' },
                  cd4Percentage: { type: 'string' },
                  viralLoad: { type: 'string' },
                  resistance: { type: 'array', items: { type: 'string' } },
                  artRegimen: { type: 'array', items: { type: 'object' } }
                }
              },
              opportunisticInfections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    infection: { type: 'string' },
                    treatment: { type: 'string' },
                    prophylaxis: { type: 'string' }
                  }
                }
              },
              hepatitisPanel: {
                type: 'object',
                properties: {
                  hbsAg: { type: 'string' },
                  hbcAb: { type: 'string' },
                  hcvRna: { type: 'string' },
                  hcvGenotype: { type: 'string' }
                }
              },
              antimicrobialTherapy: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    antibiotic: { type: 'string' },
                    indication: { type: 'string' },
                    duration: { type: 'string' },
                    monitoring: { type: 'string' }
                  }
                }
              },
              cultures: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    source: { type: 'string' },
                    organism: { type: 'string' },
                    sensitivity: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          },

          // Additional Infectious Disease Fields
          vaccinations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                vaccine: { type: 'string', description: 'Vaccine name (e.g., Influenza, PCV13, PPSV23, Tdap, MMR, Hepatitis B)' },
                status: { type: 'string', description: 'Given, Due, Contraindicated' },
                date: { type: 'string', description: 'Date given or due (YYYY-MM-DD format)' },
                manufacturer: { type: 'string', description: 'Vaccine manufacturer (e.g., Pfizer, Moderna, Sanofi) - extract if mentioned in document' },
                lotNumber: { type: 'string', description: 'Vaccine lot number - CRITICAL for tracking recalls and adverse events' },
                site: { type: 'string', description: 'Administration site (e.g., Left deltoid, Right deltoid, Left thigh, Right thigh)' },
                dose: { type: 'string', description: 'Dose administered (e.g., 0.5 mL, 1.0 mL) or dose number in series (e.g., Dose 1 of 2, Dose 2 of 3)' },
                series: { type: 'string', description: 'Series information (e.g., 1 of 2, 2 of 3, Booster, Single dose)' },
                administeredBy: { type: 'string', description: 'Name of healthcare provider who administered the vaccine' },
                facility: { type: 'string', description: 'Facility where vaccine was administered (clinic name, pharmacy, hospital)' },
                reactions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Any adverse reactions or side effects observed (e.g., Soreness at injection site, Mild fever, No adverse reactions noted)'
                },
                notes: { type: 'string', description: 'Special considerations (e.g., wait for CD4 >200, Patient declined, Contraindicated due to allergy)' }
              }
            },
            description: 'Comprehensive immunization records including administered vaccines and vaccination schedule. Extract ALL available details from vaccination records, immunization cards, or clinical notes.'
          },

          caseManagement: {
            type: 'object',
            properties: {
              referralStatus: { type: 'string', description: 'Referred, Active, Pending' },
              services: { type: 'array', items: { type: 'string' }, description: 'Services needed (adherence support, housing, etc.)' },
              barriers: { type: 'array', items: { type: 'string' }, description: 'Barriers to care' },
              coordinator: { type: 'string', description: 'Case manager name/contact' }
            },
            description: 'Case management and care coordination for complex patients'
          },

          proposedARTSwitch: {
            type: 'object',
            properties: {
              currentRegimen: { type: 'array', items: { type: 'string' } },
              proposedRegimen: { type: 'string', description: 'New ART regimen (e.g., Symtuza)' },
              reason: { type: 'string', description: 'Reason for switch (resistance, side effects, simplification)' },
              timing: { type: 'string', description: 'When to initiate switch' },
              monitoring: { type: 'array', items: { type: 'string' }, description: 'Labs to monitor after switch' }
            },
            description: 'Antiretroviral therapy modification plan'
          },

          // New infectious disease fields for comprehensive HIV management
          hivHistory: {
            type: 'object',
            properties: {
              diagnosisDate: { type: 'string', description: 'Year of HIV diagnosis' },
              diagnosisContext: { type: 'string', description: 'Circumstances of diagnosis (e.g., during herpes zoster hospitalization)' },
              transmissionRoute: { type: 'string', description: 'Mode of transmission (e.g., MSM, IVDU)' },
              nadirCD4: { type: 'string', description: 'Lowest CD4 count recorded with percentage' },
              bestCD4: { type: 'string', description: 'Highest CD4 count achieved' },
              genotype: { type: 'array', items: { type: 'string' }, description: 'Resistance mutations (e.g., M184V, K103N)' },
              priorOIs: { type: 'array', items: { type: 'string' }, description: 'Previous opportunistic infections' },
              artHistory: { type: 'array', items: { type: 'string' }, description: 'Failed or intolerant regimens' }
            },
            description: 'Comprehensive HIV history including nadir/peak CD4, transmission, and treatment history'
          },

          currentOpportunisticInfections: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of active OIs and complications (PCP, MAC, HAND, wasting syndrome, etc.)'
          },

          foodInsecurityIssues: {
            type: 'boolean',
            description: 'Whether patient has food insecurity affecting treatment adherence'
          },

          // Additional HIV/Infectious Disease Management Recommendations
          smokingCessationProgram: {
            type: 'boolean',
            description: 'Whether smoking cessation program is recommended'
          },

          harmReductionCounseling: {
            type: 'boolean',
            description: 'Whether harm reduction counseling is recommended for substance use'
          },

          cognitiveBehavioralTherapy: {
            type: 'boolean',
            description: 'Whether cognitive behavioral therapy (CBT) is recommended'
          },

          supportGroups: {
            type: 'array',
            items: { type: 'string' },
            description: 'Recommended support groups (HIV support, substance use, etc.)'
          },

          foodAssistancePrograms: {
            type: 'array',
            items: { type: 'string' },
            description: 'Recommended food assistance programs (food banks, SNAP, etc.)'
          },

          appetiteStimulants: {
            type: 'object',
            properties: {
              considered: { type: 'boolean' },
              medications: { type: 'array', items: { type: 'string' } },
              reason: { type: 'string' }
            },
            description: 'Appetite stimulants for wasting syndrome or cachexia'
          },

          // Additional HIV/ID management fields for comprehensive care
          socialServicesPrograms: {
            type: 'array',
            items: { type: 'string' },
            description: 'Social support programs (Ryan White, ADAP, housing assistance, disability benefits)'
          },

          immuneReconstitutionPlanning: {
            type: 'object',
            properties: {
              irisMonitoring: { type: 'boolean', description: 'Monitor for IRIS with ART restart' },
              cd4Monitoring: { type: 'string', description: 'Serial CD4/VL monitoring schedule' },
              prophylaxisDiscontinuation: { type: 'string', description: 'Plan for gradual OI prophylaxis discontinuation' }
            },
            description: 'Immune reconstitution inflammatory syndrome (IRIS) monitoring plan'
          },

          primaryProphylaxis: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                infection: { type: 'string', description: 'Infection being prevented (e.g., Toxoplasma)' },
                medication: { type: 'string', description: 'Prophylactic medication' },
                threshold: { type: 'string', description: 'CD4 threshold for prophylaxis' }
              }
            },
            description: 'Primary prophylaxis protocols based on CD4 count'
          },

          secondaryProphylaxis: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                infection: { type: 'string', description: 'Infection being prevented (PCP, MAC, etc.)' },
                medication: { type: 'string', description: 'Prophylactic medication and dose' },
                discontinuationCriteria: { type: 'string', description: 'When to stop (e.g., CD4 >200 x 3 months)' },
                threshold: { type: 'string', description: 'CD4 threshold for continuation' }
              }
            },
            description: 'Secondary prophylaxis to prevent recurrence after treatment'
          },

          cmvMonitoringPlan: {
            type: 'object',
            properties: {
              pcrSchedule: { type: 'string', description: 'CMV PCR monitoring schedule' },
              ophthalmologyExam: { type: 'string', description: 'Ophthalmology exam timing' },
              threshold: { type: 'string', description: 'Treatment threshold for CMV viremia' }
            },
            description: 'Cytomegalovirus monitoring and treatment plan'
          },

          // ========== UROLOGY ASSESSMENT ==========
          urologyAssessment: {
            type: 'object',
            properties: {
              urodynamicStudies: {
                type: 'object',
                properties: {
                  bladderCapacity: { type: 'string' },
                  peakFlowRate: { type: 'string' },
                  postVoidResidual: { type: 'string' },
                  detrusorPressure: { type: 'string' },
                  complianceScore: { type: 'string' }
                }
              },
              cystoscopy: {
                type: 'object',
                properties: {
                  bladderMucosa: { type: 'string' },
                  urethralPatency: { type: 'string' },
                  prostateSize: { type: 'string' },
                  lesions: { type: 'array', items: { type: 'object' } }
                }
              },
              psaLevels: {
                type: 'object',
                properties: {
                  totalPSA: { type: 'string' },
                  freePSA: { type: 'string' },
                  psaDensity: { type: 'string' },
                  psaVelocity: { type: 'string' }
                }
              },
              renalFunction: {
                type: 'object',
                properties: {
                  gfr: { type: 'string' },
                  creatinine: { type: 'string' },
                  bun: { type: 'string' },
                  proteinuria: { type: 'string' }
                }
              },
              stoneAnalysis: {
                type: 'object',
                properties: {
                  composition: { type: 'string' },
                  size: { type: 'string' },
                  location: { type: 'string' },
                  hydronephrosis: { type: 'string' }
                }
              }
            }
          },

          // ========== FAMILY MEDICINE ASSESSMENT ==========
          familyMedicineAssessment: {
            type: 'object',
            properties: {
              preventiveScreening: {
                type: 'object',
                properties: {
                  colonoscopy: { type: 'object' },
                  mammogram: { type: 'object' },
                  cervicalScreening: { type: 'object' },
                  lipidPanel: { type: 'object' },
                  diabetesScreening: { type: 'object' }
                }
              },
              immunizationStatus: {
                type: 'object',
                properties: {
                  vaccines: { type: 'array', items: { type: 'object' } },
                  titers: { type: 'object' },
                  boosters: { type: 'array', items: { type: 'string' } }
                }
              },
              chronicDiseaseManagement: {
                type: 'object',
                properties: {
                  diabetes: { type: 'object' },
                  hypertension: { type: 'object' },
                  hyperlipidemia: { type: 'object' },
                  asthma: { type: 'object' }
                }
              },
              mentalHealthScreening: {
                type: 'object',
                properties: {
                  phq9Score: { type: 'number' },
                  gad7Score: { type: 'number' },
                  auditScore: { type: 'number' },
                  mmseScore: { type: 'number' }
                }
              },
              socialDeterminants: {
                type: 'object',
                properties: {
                  housing: { type: 'string' },
                  foodSecurity: { type: 'string' },
                  transportation: { type: 'string' },
                  socialSupport: { type: 'string' }
                }
              }
            }
          },

          // ========== PHYSICAL MEDICINE & REHABILITATION ASSESSMENT ==========
          pmrAssessment: {
            type: 'object',
            properties: {
              functionalHistory: {
                type: 'object',
                properties: {
                  priorLevelOfFunction: { type: 'string', description: 'IMPORTANT: Baseline functional status before injury/illness (e.g., "Independent in all ADLs and IADLs, Active lifestyle, tennis 2x/week, Working full-time")' },
                  currentFunctionalStatus: {
                    type: 'object',
                    properties: {
                      mobilityDetails: { type: 'string', description: 'CRITICAL: Current mobility including assistive devices and supervision needs (e.g., "Ambulates with quad cane, supervision for stairs", "Wheelchair dependent for distances >50 feet")' },
                      adls: { type: 'string' },
                      iadls: { type: 'string' }
                    }
                  }
                },
                description: 'Functional history comparing prior and current status'
              },
              functionalAssessment: {
                type: 'object',
                properties: {
                  fimScore: { type: 'number', description: 'Total FIM score (Functional Independence Measure)' },
                  fimSubscales: {
                    type: 'object',
                    properties: {
                      selfCare: { type: 'string', description: 'IMPORTANT: Self-care subscore (e.g., "5/6 (supervision)")' },
                      transfers: { type: 'string', description: 'Transfers subscore (e.g., "5/6")' },
                      locomotion: { type: 'string', description: 'Locomotion subscore (e.g., "5/6")' },
                      communication: { type: 'string', description: 'Communication subscore (e.g., "6/7")' },
                      cognition: { type: 'string', description: 'Cognition subscore (e.g., "7/7")' }
                    },
                    description: 'CRITICAL: Detailed FIM subscores provide granular functional data'
                  },
                  barthel: { type: 'number' },
                  bergBalance: { type: 'number' },
                  timedUpAndGo: { type: 'string' },
                  sixMinuteWalk: { type: 'string' },
                  tenMeterWalkTest: { type: 'string', description: 'CRITICAL: 10-Meter Walk Test result with speed (e.g., "0.4 m/s (household ambulator)")' },
                  fuglMeyerUpperExtremity: { type: 'string', description: 'IMPORTANT: Fugl-Meyer Upper Extremity score for post-stroke motor recovery (e.g., "38/66")' },
                  actionResearchArmTest: { type: 'string', description: 'IMPORTANT: Action Research Arm Test (ARAT) score for upper limb function (e.g., "25/57")' }
                }
              },
              balanceAssessment: {
                type: 'object',
                properties: {
                  sittingBalance: { type: 'string', description: 'IMPORTANT: Sitting balance assessment (e.g., "Good", "Fair", "Poor", "Requires assistance")' },
                  standingBalanceEyesOpen: { type: 'string', description: 'CRITICAL: Standing balance with eyes open (e.g., "Good", "Fair", "Poor")' },
                  standingBalanceEyesClosed: { type: 'string', description: 'CRITICAL: Standing balance with eyes closed (e.g., "Good", "Fair", "Poor")' },
                  bergBalanceScore: { type: 'number', description: 'Berg Balance Scale score if performed' }
                },
                description: 'Detailed balance assessment critical for fall risk'
              },
              gaitAnalysis: {
                type: 'object',
                properties: {
                  cadence: { type: 'string' },
                  strideLength: { type: 'string' },
                  velocity: { type: 'string' },
                  assistiveDevice: { type: 'string' }
                }
              },
              spasticityAssessment: {
                type: 'object',
                properties: {
                  ashworthScale: { type: 'object' },
                  tardieu: { type: 'object' },
                  pendelumTest: { type: 'string' }
                }
              },
              emgStudies: {
                type: 'object',
                properties: {
                  nerveConduction: { type: 'object' },
                  needleEmg: { type: 'object' },
                  repetitiveStimulation: { type: 'object' }
                }
              },
              orthotic: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  prescription: { type: 'string' },
                  modifications: { type: 'array', items: { type: 'string' } }
                }
              },
              copm: {
                type: 'object',
                properties: {
                  priorityAreas: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        activity: { type: 'string', description: 'Activity name (e.g., "Returning to work", "Driving", "Cooking meals")' },
                        performanceScore: { type: 'number', description: 'Performance score 0-10' },
                        satisfactionScore: { type: 'number', description: 'Satisfaction score 0-10' }
                      }
                    },
                    description: 'IMPORTANT: Canadian Occupational Performance Measure - patient-identified priority activities with performance and satisfaction scores'
                  }
                },
                description: 'Canadian Occupational Performance Measure (COPM) - standardized OT outcome measure'
              },
              swallowStudy: {
                type: 'object',
                properties: {
                  findings: { type: 'string', description: 'Swallow study findings (e.g., "Mild pharyngeal weakness", "No aspiration")' },
                  dietRecommendation: { type: 'string', description: 'CRITICAL: Diet recommendation for safety (e.g., "Regular diet with thin liquids", "Nectar-thick liquids")' },
                  aspirationRisk: { type: 'string', description: 'Aspiration risk level' }
                },
                description: 'Swallow study results important for diet orders and aspiration risk'
              },
              neuropsychologicalTesting: {
                type: 'object',
                properties: {
                  executiveFunction: { type: 'string', description: 'Executive function assessment (e.g., "Mild executive dysfunction")' },
                  processingSpeed: { type: 'string', description: 'Processing speed assessment (e.g., "Decreased", "Normal")' },
                  memory: { type: 'string', description: 'Memory assessment (e.g., "Intact", "Mild impairment")' },
                  recommendations: { type: 'string', description: 'IMPORTANT: Neuropsych recommendations (e.g., "Recommend cognitive rehabilitation")' }
                },
                description: 'Formal neuropsychological testing results for cognitive assessment'
              },
              botulinumToxinInjections: {
                type: 'object',
                properties: {
                  indication: { type: 'string', description: 'Indication for botox (e.g., "Focal spasticity")' },
                  targetedMuscles: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'CRITICAL: Specific muscles for injection (e.g., "Left biceps", "Left wrist flexors", "Left gastrocnemius")'
                  },
                  plan: { type: 'string', description: 'Treatment plan and timing' }
                },
                description: 'Botulinum toxin injection plan for spasticity management'
              },
              equipment: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    item: { type: 'string', description: 'IMPORTANT: Equipment name (e.g., "Left shoulder sling", "Adaptive equipment for kitchen", "Quad cane")' },
                    indication: { type: 'string', description: 'Reason for equipment (e.g., "for subluxation", "for IADL independence")' },
                    status: { type: 'string', description: 'Status (e.g., "prescribed", "continue current", "to be fitted")' }
                  }
                },
                description: 'Durable medical equipment and adaptive devices prescribed or recommended'
              },
              therapyInterventions: {
                type: 'object',
                properties: {
                  physicalTherapy: {
                    type: 'object',
                    properties: {
                      interventions: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'CRITICAL: Specific PT interventions (e.g., "Constraint-induced movement therapy trial", "FES for foot drop during gait training", "Treadmill training with body weight support")'
                      },
                      frequency: { type: 'string', description: 'IMPORTANT: PT frequency (e.g., "3x/week")' },
                      duration: { type: 'string', description: 'IMPORTANT: PT duration (e.g., "12 weeks")' }
                    }
                  },
                  occupationalTherapy: {
                    type: 'object',
                    properties: {
                      interventions: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'CRITICAL: Specific OT interventions (e.g., "Home safety assessment", "ADL retraining", "Cognitive strategies training")'
                      },
                      frequency: { type: 'string', description: 'IMPORTANT: OT frequency (e.g., "3x/week")' },
                      duration: { type: 'string', description: 'IMPORTANT: OT duration (e.g., "12 weeks")' }
                    }
                  },
                  speechTherapy: {
                    type: 'object',
                    properties: {
                      interventions: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Specific speech therapy interventions'
                      },
                      frequency: { type: 'string', description: 'IMPORTANT: ST frequency (e.g., "2x/week")' },
                      duration: { type: 'string', description: 'IMPORTANT: ST duration (e.g., "8 weeks")' }
                    }
                  },
                  psychology: {
                    type: 'object',
                    properties: {
                      interventions: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'IMPORTANT: Specific psychological interventions (e.g., "Adjustment counseling", "Cognitive behavioral therapy")'
                      },
                      frequency: { type: 'string' },
                      duration: { type: 'string' }
                    },
                    description: 'Psychology intervention details'
                  }
                },
                description: 'Detailed therapy interventions with frequency and duration'
              },
              medicalManagement: {
                type: 'object',
                properties: {
                  pharmacologicPlan: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'IMPORTANT: Medication management plan (e.g., "Optimize antispastic medications", "Monitor for post-stroke pain syndrome", "Continue antidepressant")'
                  },
                  spasticityMedications: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        medication: { type: 'string', description: 'CRITICAL: Medication name and dose (e.g., "Baclofen 10mg TID")' },
                        action: { type: 'string', description: 'Action (e.g., "Continue", "Increase", "Initiate", "Taper")' }
                      }
                    },
                    description: 'CRITICAL: Specific spasticity management medications with explicit continuation or modification orders'
                  },
                  monitoringPlan: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Medical monitoring plan'
                  }
                },
                description: 'Medical management plan for rehabilitation'
              },
              supportGroups: {
                type: 'array',
                items: { type: 'string' },
                description: 'IMPORTANT: Support groups recommended (e.g., "Stroke survivor group", "Spinal cord injury peer mentoring")'
              },
              dischargePlanningPMR: {
                type: 'object',
                properties: {
                  shortTermGoal: { type: 'string' },
                  longTermGoal: { type: 'string', description: 'CRITICAL: Overall rehabilitation discharge goal (e.g., "Discharge to home at modified independence level with return to part-time work and community participation")' },
                  anticipatedDisposition: { type: 'string' }
                },
                description: 'PMR-specific discharge planning with rehabilitation goals'
              }
            }
          },

          // ========== NUCLEAR MEDICINE ASSESSMENT ==========
          nuclearMedicineAssessment: {
            type: 'object',
            properties: {
              petScan: {
                type: 'object',
                properties: {
                  suvMax: { type: 'string' },
                  metabolicVolume: { type: 'string' },
                  lesions: { type: 'array', items: { type: 'object' } },
                  interpretation: { type: 'string' }
                }
              },
              boneScan: {
                type: 'object',
                properties: {
                  uptakePattern: { type: 'string' },
                  metastases: { type: 'array', items: { type: 'object' } },
                  fractures: { type: 'array', items: { type: 'string' } }
                }
              },
              thyroidScan: {
                type: 'object',
                properties: {
                  uptakePercentage: { type: 'string' },
                  nodules: { type: 'array', items: { type: 'object' } },
                  pattern: { type: 'string' },
                  pyramidalLobe: { type: 'string', description: 'Pyramidal lobe visualization and significance (e.g., "Visualized, suggestive of Graves disease")' },
                  lobeDimensions: {
                    type: 'object',
                    properties: {
                      rightLobe: { type: 'string', description: 'Right lobe dimensions (e.g., "5.2 x 2.1 x 2.3 cm")' },
                      leftLobe: { type: 'string', description: 'Left lobe dimensions (e.g., "4.8 x 1.9 x 2.0 cm")' },
                      isthmus: { type: 'string', description: 'Isthmus thickness if measured' }
                    },
                    description: 'Thyroid lobe dimensions from nuclear medicine scan'
                  }
                }
              },
              parathyroidSPECT: {
                type: 'object',
                properties: {
                  technique: { type: 'string', description: 'SPECT/CT technique and tracer (e.g., "Tc-99m sestamibi")' },
                  findings: { type: 'string', description: 'Parathyroid adenoma or hyperplasia findings' },
                  location: { type: 'string', description: 'Anatomic location (e.g., "Left inferior parathyroid")' },
                  size: { type: 'string', description: 'Adenoma size if measured' },
                  uptake: { type: 'string', description: 'Radiotracer uptake characteristics' }
                },
                description: 'Parathyroid SPECT/CT imaging results'
              },
              cardiacPerfusion: {
                type: 'object',
                properties: {
                  restImages: { type: 'object' },
                  stressImages: { type: 'object' },
                  reversibility: { type: 'string' },
                  summedScores: { type: 'object' },
                  gatedSPECT: {
                    type: 'object',
                    properties: {
                      restLVEF: { type: 'string', description: 'Left ventricular ejection fraction at rest (e.g., "58%")' },
                      stressLVEF: { type: 'string', description: 'LVEF post-stress (e.g., "62%")' },
                      wallMotion: { type: 'string', description: 'Wall motion analysis (e.g., "Normal", "Hypokinesis in inferior wall")' },
                      wallThickening: { type: 'string', description: 'Wall thickening analysis' }
                    },
                    description: 'Gated SPECT functional analysis'
                  },
                  coronaryTerritoryAnalysis: {
                    type: 'object',
                    properties: {
                      lad: { type: 'string', description: 'LAD territory perfusion (e.g., "Normal perfusion")' },
                      rca: { type: 'string', description: 'RCA territory perfusion (e.g., "Mild reversible defect (inferior wall)")' },
                      lcx: { type: 'string', description: 'LCX territory perfusion (e.g., "Minimal involvement")' }
                    },
                    description: 'Structured coronary territory perfusion analysis'
                  },
                  transientIschemicDilationRatio: { type: 'string', description: 'TID ratio for ischemic burden (e.g., "1.05 (normal <1.2)")' },
                  ischemiaPercentage: { type: 'string', description: 'Quantified ischemia as percentage of LV (e.g., "8% of LV myocardium")' },
                  riskStratification: { type: 'string', description: 'Cardiac event risk assessment (e.g., "Low-intermediate risk for cardiac events")' }
                }
              },
              radiationDosimetry: {
                type: 'object',
                properties: {
                  totalEffectiveDose: { type: 'string', description: 'Total effective radiation dose (e.g., "12.5 mSv")' },
                  criticalOrganDoses: { type: 'string', description: 'Critical organ radiation doses' },
                  thyroidDose: { type: 'string', description: 'Thyroid-specific dose if applicable (e.g., "20 mGy from I-123")' },
                  patientCounseling: { type: 'boolean', description: 'Whether radiation exposure counseling was provided' }
                },
                description: 'Radiation dosimetry for patient safety and regulatory compliance'
              },
              spectTechnicalParameters: {
                type: 'object',
                properties: {
                  camera: { type: 'string', description: 'Gamma camera type (e.g., "Dual-head gamma camera")' },
                  projections: { type: 'string', description: 'Number of projections (e.g., "64 projections")' },
                  acquisition: { type: 'string', description: 'Acquisition arc (e.g., "180-degree acquisition")' },
                  attenuationCorrection: { type: 'boolean', description: 'Whether attenuation correction was applied' },
                  gating: { type: 'string', description: 'Gating technique if used (e.g., "ECG-gated")' }
                },
                description: 'Technical SPECT imaging parameters for QA and reproducibility'
              },
              ventilationPerfusion: {
                type: 'object',
                properties: {
                  vqMatch: { type: 'string' },
                  probability: { type: 'string' },
                  defects: { type: 'array', items: { type: 'object' } }
                }
              }
            }
          },

          // ========== PLASTIC SURGERY ASSESSMENT ==========
          plasticSurgeryAssessment: {
            type: 'object',
            properties: {
              reconstructionOptionsDiscussed: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    option: { type: 'string', description: 'Option name (e.g., "Implant-Based Reconstruction", "DIEP Flap", "PAP Flap")' },
                    advantages: { type: 'array', items: { type: 'string' }, description: 'List of advantages' },
                    disadvantages: { type: 'array', items: { type: 'string' }, description: 'List of disadvantages' },
                    recommended: { type: 'boolean', description: 'Whether this option is recommended by surgeon' }
                  }
                },
                description: 'CRITICAL: Complete list of all reconstruction options discussed with patient including advantages and disadvantages'
              },
              patientPreference: {
                type: 'object',
                properties: {
                  chosenOption: { type: 'string', description: 'Option patient chose' },
                  reasonForChoice: { type: 'string', description: 'Patient\'s reasoning for their choice' }
                },
                description: 'Patient\'s informed choice among options'
              },
              patientConcerns: {
                type: 'array',
                items: { type: 'string' },
                description: 'Patient concerns expressed about different options'
              },
              donorSiteAssessment: {
                type: 'object',
                properties: {
                  abdomen: {
                    type: 'object',
                    properties: {
                      tissueVolume: { type: 'string' },
                      skinQuality: { type: 'string' },
                      previousPregnancies: { type: 'number', description: 'IMPORTANT: Number of previous pregnancies affects tissue quality' },
                      striae: { type: 'string', description: 'Presence/absence of stretch marks (e.g., "No striae", "Mild striae")' },
                      previousAbdominalSurgery: { type: 'string', description: 'CRITICAL: Previous abdominal surgery history affects vascular anatomy' },
                      perforatorQuality: { type: 'string' }
                    }
                  },
                  innerThighs: {
                    type: 'object',
                    properties: {
                      tissueVolume: { type: 'string' },
                      skinQuality: { type: 'string' },
                      suitabilityForPAPFlap: { type: 'string' }
                    },
                    description: 'Inner thigh assessment for PAP flap option'
                  },
                  glutealRegion: {
                    type: 'object',
                    properties: {
                      tissueVolume: { type: 'string' },
                      previousSurgery: { type: 'string' },
                      suitabilityForGAPFlap: { type: 'string' }
                    },
                    description: 'Gluteal region assessment for GAP flap option'
                  }
                },
                description: 'Complete donor site evaluation for all reconstruction options'
              },
              measurements: {
                type: 'object',
                properties: {
                  sternalNotchToNipple: {
                    type: 'object',
                    properties: {
                      right: { type: 'string', description: 'Right breast measurement (e.g., "19 cm")' },
                      left: { type: 'string', description: 'Left breast measurement (e.g., "19 cm")' }
                    },
                    description: 'CRITICAL: Sternal notch to nipple distance, essential for surgical planning and symmetry'
                  },
                  nippleToInframammaryFold: {
                    type: 'object',
                    properties: {
                      right: { type: 'string', description: 'Right breast measurement (e.g., "7 cm")' },
                      left: { type: 'string', description: 'Left breast measurement (e.g., "7 cm")' }
                    },
                    description: 'CRITICAL: Nipple to inframammary fold distance, essential for reconstruction planning'
                  },
                  chestWidth: { type: 'string', description: 'IMPORTANT: Chest width measurement (e.g., "28 cm")' },
                  desiredCupSize: { type: 'string', description: 'IMPORTANT: Patient\'s desired cup size for reconstruction (e.g., "C (previously B cup)")' }
                },
                description: 'Breast and body measurements for reconstruction planning'
              },
              preoperativePhotography: {
                type: 'object',
                properties: {
                  views: { type: 'array', items: { type: 'string' } },
                  measurements: { type: 'object' },
                  asymmetries: { type: 'array', items: { type: 'string' } }
                }
              },
              skinAnalysis: {
                type: 'object',
                properties: {
                  fitzpatrickType: { type: 'string' },
                  laxity: { type: 'string' },
                  thickness: { type: 'string' },
                  scarring: { type: 'array', items: { type: 'object' } }
                }
              },
              flapAssessment: {
                type: 'object',
                properties: {
                  donorSite: { type: 'string' },
                  recipientSite: { type: 'string' },
                  vascularStatus: { type: 'string' },
                  dimensions: { type: 'object' }
                }
              },
              implantData: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  size: { type: 'string' },
                  manufacturer: { type: 'string' },
                  serialNumber: { type: 'string' }
                }
              },
              vascularExamination: {
                type: 'object',
                properties: {
                  allenTest: { type: 'string', description: 'IMPORTANT: Allen\'s test results for hand perfusion assessment (e.g., "Allen\'s test normal bilaterally")' },
                  venousInsufficiency: { type: 'string', description: 'IMPORTANT: Venous insufficiency assessment (e.g., "No venous insufficiency")' },
                  dopplerSignals: { type: 'string', description: 'CRITICAL: Doppler ultrasound assessment of perforator signals (e.g., "Doppler signals strong at all perforators")' }
                },
                description: 'Preoperative vascular assessment for flap viability'
              },
              aestheticGoals: {
                type: 'object',
                properties: {
                  patientExpectations: { type: 'string' },
                  achievableOutcome: { type: 'string' },
                  limitations: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          },

          // ========== THORACIC SURGERY ASSESSMENT ==========
          thoracicSurgeryAssessment: {
            type: 'object',
            properties: {
              consultationReason: { type: 'string', description: 'IMPORTANT: Specific reason for thoracic surgery consultation (e.g., "Lung resection for non-small cell lung cancer", "Mediastinal mass evaluation")' },
              surgeonCredentials: { type: 'string', description: 'IMPORTANT: Complete surgeon credentials (e.g., "Dr. Richard Chen, MD, FACS")' },
              performanceStatus: {
                type: 'object',
                properties: {
                  ecog: { type: 'number', description: 'IMPORTANT: ECOG performance status value 0-4 (e.g., 0, 1, 2)' },
                  description: { type: 'string', description: 'Performance status description' }
                },
                description: 'ECOG and other performance status assessments'
              },
              adlStatus: { type: 'string', description: 'IMPORTANT: Activities of daily living status (e.g., "Independent in ADLs", "Requires assistance", "Dependent"). Relevant for surgical candidacy.' },
              pulmonaryFunction: {
                type: 'object',
                properties: {
                  fev1: { type: 'string' },
                  fvc: { type: 'string' },
                  dlco: { type: 'string' },
                  predictedPostop: { type: 'object' }
                }
              },
              tumorStaging: {
                type: 'object',
                properties: {
                  tnmStage: { type: 'string' },
                  histology: { type: 'string' },
                  grade: { type: 'string' },
                  molecularMarkers: { type: 'object' }
                }
              },
              mediastinoscopy: {
                type: 'object',
                properties: {
                  lymphNodes: { type: 'array', items: { type: 'object' } },
                  frozen: { type: 'string' },
                  complications: { type: 'array', items: { type: 'string' } }
                }
              },
              bronchoscopy: {
                type: 'object',
                properties: {
                  airwayPatency: { type: 'string' },
                  endobronchialLesions: { type: 'array', items: { type: 'object' } },
                  lavage: { type: 'object' }
                }
              },
              vatsAssessment: {
                type: 'object',
                properties: {
                  feasibility: { type: 'string' },
                  portPlacement: { type: 'object' },
                  adhesions: { type: 'string' },
                  approach: { type: 'string', description: 'VATS approach details (e.g., "Three-port VATS approach")' },
                  conversionRisk: { type: 'string', description: 'IMPORTANT: Contingency for conversion to thoracotomy (e.g., "Consider conversion to thoracotomy if needed"). Surgical planning documentation.' }
                },
                description: 'VATS (Video-Assisted Thoracoscopic Surgery) assessment and approach'
              },
              preoperativePreparation: {
                type: 'object',
                properties: {
                  medicalClearance: { type: 'array', items: { type: 'string' }, description: 'Required clearances and tests' },
                  bowelPrep: { type: 'string', description: 'IMPORTANT: Bowel preparation instructions (e.g., "Bowel prep evening before", "Clear liquids day before"). Preoperative order.' },
                  admissionTiming: { type: 'string', description: 'IMPORTANT: Admission timing (e.g., "Same day", "Night before"). Surgical scheduling detail.' },
                  pulmonaryRehabilitation: { type: 'string', description: 'IMPORTANT: Pulmonary rehabilitation requirements (e.g., "Pulmonary rehabilitation x 2 weeks", "Respiratory therapy daily"). Critical preoperative optimization.' },
                  incentiveSpirometry: { type: 'string', description: 'IMPORTANT: Incentive spirometry training (e.g., "Incentive spirometry training", "Demonstrated spirometer use"). Respiratory preparation.' },
                  vaccinations: { type: 'string', description: 'IMPORTANT: Vaccination requirements (e.g., "Update vaccinations (flu, pneumococcus)", "Flu shot if not current"). Infection prevention.' },
                  otherPreparation: { type: 'array', items: { type: 'string' }, description: 'Other preoperative instructions' }
                },
                description: 'Preoperative preparation requirements and orders'
              },
              operativeDetails: {
                type: 'object',
                properties: {
                  expectedDuration: { type: 'string', description: 'Expected surgical duration' },
                  hospitalStay: { type: 'string', description: 'Expected hospital length of stay (e.g., "4-5 days")' },
                  anticipatedComplications: { type: 'array', items: { type: 'string' } },
                  postoperativeManagement: { type: 'string' }
                },
                description: 'Operative details and expectations'
              },
              adjuvantTherapy: {
                type: 'object',
                properties: {
                  recommended: { type: 'boolean' },
                  regimen: { type: 'string' },
                  timing: { type: 'string', description: 'IMPORTANT: Timing to start adjuvant therapy (e.g., "Start 4-6 weeks postoperatively", "Begin 2-4 weeks after surgery")' },
                  medicalOncologyConsulted: { type: 'boolean', description: 'IMPORTANT: Whether medical oncology was consulted' },
                  radiationOncologyBackup: { type: 'string', description: 'IMPORTANT: Conditional radiation oncology involvement (e.g., "Radiation oncology backup if positive margins", "RT if R1 resection", "Consider RT for close margins")' },
                  surveillancePlan: { type: 'string', description: 'IMPORTANT: Long-term surveillance protocol (e.g., "Then surveillance per NCCN guidelines", "Follow ASCO guidelines for monitoring")' }
                },
                description: 'Adjuvant chemotherapy/radiation therapy planning'
              },
              petCtFindings: {
                type: 'object',
                properties: {
                  primaryLesion: {
                    type: 'object',
                    properties: {
                      location: { type: 'string', description: 'Anatomic location (e.g., "RUL mass", "LLL nodule")' },
                      suvMax: { type: 'number', description: 'IMPORTANT: SUV max value for primary lesion (e.g., 12.3)' },
                      size: { type: 'string' }
                    }
                  },
                  lymphNodes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        station: { type: 'string', description: 'IMPORTANT: Lymph node station (e.g., "Right hilar", "Station 10R", "Subcarinal", "Station 7")' },
                        size: { type: 'string', description: 'Node size (e.g., "1.2 cm", "0.8 cm")' },
                        suvMax: { type: 'number', description: 'IMPORTANT: SUV max value (e.g., 6.8, 3.2)' }
                      }
                    },
                    description: 'CRITICAL: Structured lymph node data with specific SUV values by anatomic location/station'
                  },
                  metastases: { type: 'array', items: { type: 'object' } }
                },
                description: 'IMPORTANT: PET-CT findings with structured SUV values by location for staging'
              },
              informedConsent: {
                type: 'object',
                properties: {
                  benefits: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'CRITICAL: Benefits discussed (e.g., "Potential cure (5-year survival ~50% for stage IIB)", "Accurate pathological staging", "Local control"). Legal documentation.'
                  },
                  alternatives: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        treatment: { type: 'string', description: 'Alternative treatment (e.g., "Radiation therapy", "Chemotherapy alone", "Observation")' },
                        outcome: { type: 'string', description: 'Expected outcome (e.g., "lower cure rate", "palliative", "disease progression")' }
                      }
                    },
                    description: 'CRITICAL: Treatment alternatives discussed with patient. Essential informed consent documentation.'
                  },
                  patientDecision: { type: 'string', description: 'CRITICAL: Formal documentation of patient decision (e.g., "Patient understands risks and benefits, wishes to proceed with surgery. Wife present and supportive."). Medical-legal documentation.' }
                },
                description: 'CRITICAL: Comprehensive informed consent documentation for surgery'
              },
              tumorBoard: {
                type: 'object',
                properties: {
                  recommendations: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'IMPORTANT: Tumor board recommendations (e.g., "Proceed with surgical resection", "Adjuvant chemotherapy given N1 disease", "Consider adjuvant radiation if close margins")'
                  },
                  date: { type: 'string', description: 'Tumor board meeting date' },
                  attendees: { type: 'array', items: { type: 'string' }, description: 'Tumor board attendees' }
                },
                description: 'IMPORTANT: Multidisciplinary tumor board discussion and recommendations'
              },
              backupSurgicalPlan: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    scenario: { type: 'string', description: 'Scenario (e.g., "If unresectable", "If N2 disease found", "If unable to achieve margins")' },
                    plan: { type: 'string', description: 'Backup plan (e.g., "Wedge resection for diagnosis", "Abort, refer for chemoradiation", "Convert to open thoracotomy")' }
                  }
                },
                description: 'IMPORTANT: Contingency surgical plans for intraoperative findings. Critical surgical planning.'
              },
              alternativeTreatments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    treatment: { type: 'string', description: 'Alternative treatment (e.g., "SBRT", "Chemoradiation", "Neoadjuvant therapy")' },
                    indication: { type: 'string', description: 'When considered (e.g., "if medically inoperable", "if upstaged to N2", "not recommended")' }
                  }
                },
                description: 'Alternative treatments considered and clinical context'
              },
              anesthesiaPlanning: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: 'Anesthesia type (e.g., "General with epidural", "General with paravertebral block")' },
                  regionalAnesthesia: { type: 'string', description: 'IMPORTANT: Regional anesthesia details (e.g., "epidural vs paravertebral block"). Enhanced recovery protocol.' }
                },
                description: 'Anesthesia planning for surgery'
              },
              enhancedRecoveryProtocol: {
                type: 'object',
                properties: {
                  regionalAnesthesia: { type: 'string', description: 'Regional anesthesia component (e.g., "epidural vs paravertebral block")' },
                  minimallyInvasiveApproach: { type: 'string', description: 'Minimally invasive surgical approach' },
                  earlyMobilization: { type: 'string', description: 'Early mobilization protocol' },
                  multimodalAnalgesia: { type: 'string', description: 'IMPORTANT: Multimodal pain management (e.g., "Multimodal analgesia", "NSAIDs + regional + opioid-sparing"). Critical for ERAS.' },
                  chestTubeManagement: { type: 'string', description: 'Chest tube management protocol' }
                },
                description: 'IMPORTANT: Enhanced Recovery After Surgery (ERAS) protocol components'
              },
              postoperativeOrders: {
                type: 'object',
                properties: {
                  imaging: { type: 'array', items: { type: 'string' }, description: 'IMPORTANT: Postoperative imaging orders (e.g., "Chest X-ray daily until chest tube removal", "CT chest POD 1")' },
                  monitoring: { type: 'array', items: { type: 'string' }, description: 'IMPORTANT: Monitoring orders (e.g., "ICU monitoring x 24 hours", "Daily rounds while hospitalized", "Cardiac monitoring")' },
                  mobilization: { type: 'string' },
                  respiratory: { type: 'string' },
                  pain: { type: 'string' },
                  dischargeSupport: { type: 'string', description: 'IMPORTANT: Discharge planning and support (e.g., "Discharge planning with home health", "VNA arranged", "PT/OT consult for discharge")' }
                },
                description: 'Specific postoperative orders and protocols'
              }
            }
          },

          // ========== COLORECTAL SURGERY ASSESSMENT ==========
          colorectalSurgeryAssessment: {
            type: 'object',
            properties: {
              colonoscopy: {
                type: 'object',
                properties: {
                  polyps: { type: 'array', items: { type: 'object' } },
                  lesions: { type: 'array', items: { type: 'object' } },
                  preparation: { type: 'string' },
                  completeness: { type: 'string' }
                }
              },
              anorectalManometry: {
                type: 'object',
                properties: {
                  restingPressure: { type: 'string' },
                  squeezePressure: { type: 'string' },
                  sensoryThreshold: { type: 'string' },
                  compliance: { type: 'string' }
                }
              },
              defecography: {
                type: 'object',
                properties: {
                  pelvicFloorDescent: { type: 'string' },
                  rectocele: { type: 'string' },
                  intussusception: { type: 'string' },
                  evacuation: { type: 'string' }
                }
              },
              stomaAssessment: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  site: { type: 'string' },
                  viability: { type: 'string' },
                  complications: { type: 'array', items: { type: 'string' } }
                }
              },
              oncologicMarkers: {
                type: 'object',
                properties: {
                  cea: { type: 'string' },
                  ca199: { type: 'string' },
                  microsatelliteStatus: { type: 'string' },
                  kras: { type: 'string' }
                }
              }
            }
          },

          // ========== NEUROSURGERY ASSESSMENT ==========
          neurosurgeryAssessment: {
            type: 'object',
            properties: {
              functionalMri: {
                type: 'object',
                properties: {
                  eloquentAreas: { type: 'array', items: { type: 'object' } },
                  languageLateralization: { type: 'string' },
                  motorMapping: { type: 'object' },
                  technique: { type: 'string', description: 'fMRI technique (e.g., "Blood Oxygen Level Dependent (BOLD)")' },
                  acquisitionParameters: { type: 'object', description: 'TR/TE, voxel size, analysis method' },
                  tasks: { type: 'array', items: { type: 'string' }, description: 'fMRI tasks performed (e.g., motor mapping, language tasks)' }
                }
              },
              tractography: {
                type: 'object',
                properties: {
                  corticospinalTract: { type: 'object' },
                  arcuateFasciculus: { type: 'object' },
                  opticRadiation: { type: 'object' },
                  sequences: { type: 'object', description: 'DTI sequences (gradient directions, b-value, voxel size)' },
                  fiberTractsReconstructed: { type: 'array', items: { type: 'string' }, description: 'List of fiber tracts reconstructed' },
                  software: { type: 'string', description: 'Tractography software used (e.g., "DSI Studio")' }
                }
              },
              intraoperativeMonitoring: {
                type: 'object',
                properties: {
                  ssep: { type: 'object' },
                  mep: { type: 'object' },
                  directStimulation: { type: 'object' }
                }
              },
              tumorCharacteristics: {
                type: 'object',
                properties: {
                  whoGrade: { type: 'string' },
                  idh1Status: { type: 'string' },
                  mgmtMethylation: { type: 'string' },
                  ki67Index: { type: 'string' },
                  location: { type: 'string', description: 'Tumor location (e.g., "Left superior frontal gyrus")' },
                  size: { type: 'string', description: 'Tumor size' },
                  edema: { type: 'string', description: 'Peritumoral edema' },
                  massEffect: { type: 'string', description: 'Mass effect on surrounding structures' },
                  enhancement: { type: 'string', description: 'Enhancement pattern' },
                  pathology: { type: 'string', description: 'Pathology findings' }
                }
              },
              ventriculostomy: {
                type: 'object',
                properties: {
                  icp: { type: 'string' },
                  cppGoal: { type: 'string' },
                  csfDrainage: { type: 'string' }
                }
              },
              consultation: {
                type: 'object',
                properties: {
                  surgeryPlanned: { type: 'string', description: 'Planned surgery (e.g., "Awake craniotomy with functional mapping")' },
                  neuronavigationSystem: { type: 'string', description: 'Navigation system used (e.g., "BrainLab navigation system")' },
                  safeResectionBoundaries: { type: 'object', description: 'Safe resection boundaries (anteriorMargin, posteriorMargin, lateralMargin, medialMargin)' },
                  intraoperativeMappingProtocol: { type: 'object', description: 'Intraoperative mapping protocol (motorMapping, languageMapping, goal)' },
                  colorCoding: { type: 'object', description: 'Color coding for eloquent areas and tracts' },
                  imagingLimitations: { type: 'object', description: 'Limitations of fMRI and DTI' },
                  comparisonToStandardMRI: { type: 'object', description: 'Comparison to standard MRI capabilities' },
                  oncologicImpact: { type: 'object', description: 'Oncologic impact of resection extent' },
                  structuralMriSequences: { type: 'array', items: { type: 'string' }, description: 'Structural MRI sequences used' }
                }
              },
              expectedExtentOfResection: {
                type: 'object',
                properties: {
                  goal: { type: 'string', description: 'Resection goal (e.g., ">90% resection", "Gross total resection")' },
                  limitations: { type: 'string', description: 'Limitations (e.g., "Limited by eloquent area involvement")' },
                  expectedResidual: { type: 'string', description: 'Expected residual disease (e.g., "Residual likely in SMA region")' }
                },
                description: 'Planned extent of surgical resection'
              },
              smaManagementProtocol: {
                type: 'object',
                properties: {
                  rehabilitation: { type: 'string', description: 'Rehabilitation protocol if SMA syndrome occurs' },
                  expectedResolution: { type: 'string', description: 'Expected resolution timeframe (e.g., "Usually resolves 4-12 weeks")' },
                  symptoms: { type: 'string', description: 'Potential symptoms (e.g., "May have temporary mutism, hemiplegia")' }
                },
                description: 'SMA (Supplementary Motor Area) syndrome management protocol'
              },
              preoperativeMedicalOptimization: {
                type: 'object',
                properties: {
                  continueAntiepileptics: { type: 'boolean', description: 'Continue antiepileptic medications' },
                  steroidManagement: { type: 'string', description: 'Steroid adjustments (e.g., "Increase dexamethasone if edema worsens")' },
                  holdMedications: { type: 'array', items: { type: 'string' }, description: 'Medications to hold (e.g., "Hold aspirin if taking")' },
                  otherInstructions: { type: 'string' }
                },
                description: 'Preoperative medical optimization plan'
              },
              tumorTreatingFields: {
                type: 'object',
                properties: {
                  deviceConsidered: { type: 'string', description: 'Device consideration (e.g., "Optune device consideration", "TTFields recommended")' },
                  timing: { type: 'string', description: 'When to start (e.g., "Start with adjuvant chemotherapy", "Post-radiation")' },
                  patientEducation: { type: 'string', description: 'Patient education provided about TTFields' }
                },
                description: 'Tumor Treating Fields (TTFields) therapy consideration'
              }
            }
          },

          // ========== PREVENTIVE MEDICINE ASSESSMENT ==========
          preventiveMedicineAssessment: {
            type: 'object',
            properties: {
              riskCalculators: {
                type: 'object',
                properties: {
                  ascvd: { type: 'string' },
                  framingham: { type: 'string' },
                  gail: { type: 'string' },
                  frax: { type: 'string' }
                }
              },
              screeningCompliance: {
                type: 'object',
                properties: {
                  mammography: { type: 'object' },
                  colonoscopy: { type: 'object' },
                  cervicalCancer: { type: 'object' },
                  lungCancer: { type: 'object' },
                  aaa: { type: 'object' }
                }
              },
              lifestyleAssessment: {
                type: 'object',
                properties: {
                  dietPattern: { type: 'string' },
                  exerciseMinutes: { type: 'number' },
                  sleepQuality: { type: 'string' },
                  stressLevel: { type: 'string' },
                  substanceUse: { type: 'object' }
                }
              },
              biomarkers: {
                type: 'object',
                properties: {
                  hscrp: { type: 'string' },
                  homocysteine: { type: 'string' },
                  vitaminD: { type: 'string' },
                  omega3Index: { type: 'string' }
                }
              },
              genomicRisk: {
                type: 'object',
                properties: {
                  brca: { type: 'string' },
                  lynch: { type: 'string' },
                  pharmacogenomics: { type: 'object' }
                }
              }
            }
          },

          // ========== MEDICAL GENETICS ASSESSMENT ==========
          medicalGeneticsAssessment: {
            type: 'object',
            properties: {
              pedigreeAnalysis: {
                type: 'object',
                properties: {
                  pattern: { type: 'string' },
                  penetrance: { type: 'string' },
                  expressivity: { type: 'string' },
                  anticipation: { type: 'string' }
                }
              },
              chromosomalAnalysis: {
                type: 'object',
                properties: {
                  karyotype: { type: 'string' },
                  microarray: { type: 'object' },
                  fish: { type: 'object' }
                }
              },
              molecularTesting: {
                type: 'object',
                properties: {
                  singleGene: { type: 'object' },
                  panel: { type: 'object' },
                  exome: { type: 'object' },
                  genome: { type: 'object' }
                }
              },
              variantClassification: {
                type: 'object',
                properties: {
                  pathogenic: { type: 'array', items: { type: 'object' } },
                  likelyPathogenic: { type: 'array', items: { type: 'object' } },
                  vus: { type: 'array', items: { type: 'object' } }
                }
              },
              counselingNotes: {
                type: 'object',
                properties: {
                  recurrenceRisk: { type: 'string' },
                  reproductiveOptions: { type: 'array', items: { type: 'string' } },
                  familyTesting: { type: 'object' }
                }
              },
              geneticCounselor: { type: 'string', description: 'Name and credentials of genetic counselor' },
              dysmorphologyAssessment: {
                type: 'object',
                properties: {
                  facialFeatures: { type: 'string' },
                  skeletalAbnormalities: { type: 'string' },
                  cutaneousManifestations: { type: 'string' },
                  syndromicFeatures: { type: 'string' }
                },
                description: 'Physical examination for dysmorphic features'
              },
              deletionDuplicationAnalysis: { type: 'string', description: 'Deletion/duplication testing results or orders' },
              mitochondrialGenomeSequencing: { type: 'string', description: 'Mitochondrial DNA sequencing results or orders' },
              expectedResultsDate: { type: 'string', description: 'When genetic test results are expected' },
              cptCode: { type: 'string', description: 'CPT billing codes for genetic testing' },
              estimatedCost: { type: 'string', description: 'Estimated out-of-pocket costs for testing' },
              biobanking: { type: 'string', description: 'Biobanking consent status and details' },
              primaryGenesOfInterest: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    gene: { type: 'string', description: 'Gene name (e.g., TTN, LMNA)' },
                    significance: { type: 'string', description: 'Clinical significance' }
                  }
                },
                description: 'Primary genes being tested with their significance'
              },
              wholeExomeSequencing: { type: 'string', description: 'WES strategy if panel negative' },
              detailedRiskAssessment: {
                type: 'object',
                properties: {
                  personalRisk: { type: 'string' },
                  arrhythmiaRisk: { type: 'string' },
                  heartFailureRisk: { type: 'string' },
                  suddenCardiacDeathRisk: { type: 'string' }
                },
                description: 'Detailed risk stratification'
              },
              managementRecommendations: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific clinical management recommendations'
              },
              surveillanceProtocol: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    test: { type: 'string' },
                    frequency: { type: 'string' }
                  }
                },
                description: 'Surveillance schedule for monitoring'
              },
              reproductiveOptions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Family planning and reproductive options'
              },
              researchOpportunities: {
                type: 'array',
                items: { type: 'string' },
                description: 'Research studies and clinical trials'
              },
              geneticDiscriminationProtections: {
                type: 'object',
                properties: {
                  ginaProtections: { type: 'string' },
                  lifeInsurance: { type: 'string' },
                  disabilityInsurance: { type: 'string' },
                  longTermCare: { type: 'string' }
                },
                description: 'Legal protections and insurance implications'
              },
              comprehensiveCardiomyopathyPanel: {
                type: 'object',
                properties: {
                  panelName: { type: 'string', description: 'Name of genetic panel (e.g., Comprehensive Cardiomyopathy Panel)' },
                  geneCount: { type: 'number', description: 'Number of genes included (e.g., 110)' },
                  genesIncluded: { type: 'array', items: { type: 'string' }, description: 'List of genes tested' },
                  turnaroundTime: { type: 'string', description: 'Expected time for results' }
                },
                description: 'Specific genetic test panel ordered with details'
              },
              detailedFamilyPedigree: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    relationship: { type: 'string', description: 'Relationship to patient' },
                    age: { type: 'string', description: 'Current age or age at death' },
                    healthStatus: { type: 'string', description: 'Health status (healthy, affected, deceased)' },
                    conditions: { type: 'array', items: { type: 'string' }, description: 'Medical conditions' },
                    causeOfDeath: { type: 'string', description: 'Cause of death if deceased' },
                    screeningStatus: { type: 'string', description: 'Screening status (completed, pending, not screened)' }
                  }
                },
                description: 'Complete three-generation family pedigree with all members'
              },
              acmgGuidelinesReference: {
                type: 'object',
                properties: {
                  guideline: { type: 'string', description: 'ACMG guideline reference' },
                  interpretation: { type: 'string', description: 'How guidelines apply to this case' },
                  version: { type: 'string', description: 'Guideline version or year' }
                },
                description: 'ACMG guidelines reference for variant interpretation'
              },
              inheritancePatternDetails: {
                type: 'object',
                properties: {
                  pattern: { type: 'string', description: 'Inheritance pattern (autosomal dominant, recessive, etc.)' },
                  penetrance: { type: 'string', description: 'Age-related penetrance information' },
                  expressivity: { type: 'string', description: 'Variable expressivity details' },
                  deNovoRisk: { type: 'string', description: 'Risk of de novo mutations' },
                  anticipation: { type: 'string', description: 'Genetic anticipation if applicable' }
                },
                description: 'Detailed inheritance pattern characteristics'
              },
              childrenSpecificRisk: {
                type: 'object',
                properties: {
                  inheritanceRisk: { type: 'string', description: 'Percentage risk for each child' },
                  screeningAge: { type: 'string', description: 'Recommended age to begin screening' },
                  screeningProtocol: { type: 'array', items: { type: 'string' }, description: 'Specific screening tests and frequency' },
                  earlyWarningSignsings: { type: 'array', items: { type: 'string' }, description: 'Symptoms to watch for' },
                  activityRestrictions: { type: 'string', description: 'Any recommended activity restrictions' }
                },
                description: 'Specific risk assessment and recommendations for children'
              },
              cascadeTestingProtocol: {
                type: 'object',
                properties: {
                  firstDegreeRelatives: { type: 'array', items: { type: 'string' }, description: 'Testing recommendations for first-degree relatives' },
                  secondDegreeRelatives: { type: 'array', items: { type: 'string' }, description: 'Testing recommendations for second-degree relatives' },
                  testingOrder: { type: 'string', description: 'Recommended order for family testing' },
                  timingRecommendations: { type: 'string', description: 'When to test relatives' }
                },
                description: 'Family cascade testing protocol if variant identified'
              },
              potentialTestingOutcomes: {
                type: 'object',
                properties: {
                  positiveResult: { type: 'object', properties: {
                    interpretation: { type: 'string' },
                    management: { type: 'array', items: { type: 'string' } }
                  }},
                  negativeResult: { type: 'object', properties: {
                    interpretation: { type: 'string' },
                    nextSteps: { type: 'array', items: { type: 'string' } }
                  }},
                  vusResult: { type: 'object', properties: {
                    interpretation: { type: 'string' },
                    followUp: { type: 'array', items: { type: 'string' } },
                    reclassificationPlan: { type: 'string' }
                  }}
                },
                description: 'Management plans for different testing outcomes'
              },
              psychosocialSupportServices: {
                type: 'object',
                properties: {
                  counselingServices: { type: 'array', items: { type: 'string' }, description: 'Genetic counseling and therapy services' },
                  supportGroups: { type: 'array', items: { type: 'string' }, description: 'Support groups and foundations' },
                  familyTherapy: { type: 'string', description: 'Family therapy availability' },
                  pediatricSupport: { type: 'string', description: 'Support resources for children' },
                  copingResources: { type: 'array', items: { type: 'string' }, description: 'Educational and coping resources' }
                },
                description: 'Comprehensive psychosocial support services offered'
              },
              reasonForReferral: {
                type: 'string',
                description: 'Specific reason for genetic counseling referral (distinct from chief complaint)'
              },
              medicalGeneticist: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Name of medical geneticist' },
                  credentials: { type: 'string', description: 'Professional credentials (MD, PhD, etc.)' },
                  institution: { type: 'string', description: 'Institution or practice' }
                },
                description: 'Medical geneticist information (distinct from consulting physician)'
              },
              extendedFamilyHistory: {
                type: 'object',
                properties: {
                  paternalSide: { type: 'array', items: { type: 'string' }, description: 'Extended paternal family history' },
                  maternalSide: { type: 'array', items: { type: 'string' }, description: 'Extended maternal family history' },
                  inheritancePattern: { type: 'string', description: 'Observed inheritance pattern in extended family' },
                  additionalCases: { type: 'array', items: { type: 'string' }, description: 'Additional family cases beyond immediate family' }
                },
                description: 'Extended family history beyond immediate relatives'
              },
              psychosocialAssessment: {
                type: 'object',
                properties: {
                  anxietyLevel: { type: 'string', description: 'Anxiety level about genetic risk' },
                  copingMechanisms: { type: 'array', items: { type: 'string' }, description: 'Current coping mechanisms' },
                  emotionalConcerns: { type: 'array', items: { type: 'string' }, description: 'Specific emotional concerns (guilt, fear, etc.)' },
                  supportNeeds: { type: 'array', items: { type: 'string' }, description: 'Identified support needs' },
                  resourcesProvided: { type: 'array', items: { type: 'string' }, description: 'Support resources provided' }
                },
                description: 'Comprehensive psychosocial assessment for genetic conditions'
              },
              immediateRecommendations: {
                type: 'object',
                properties: {
                  forPatient: { type: 'array', items: { type: 'string' }, description: 'Immediate actions for patient' },
                  forSiblings: { type: 'array', items: { type: 'string' }, description: 'Urgent screening for siblings' },
                  forChildren: { type: 'array', items: { type: 'string' }, description: 'Baseline testing for children' },
                  forExtendedFamily: { type: 'array', items: { type: 'string' }, description: 'Risk notification for extended family' }
                },
                description: 'Critical immediate action items for family safety'
              },
              variantInterpretationGuidelines: {
                type: 'object',
                properties: {
                  guidelines: { type: 'string', description: 'Guidelines used (e.g., ACMG)' },
                  version: { type: 'string', description: 'Guidelines version or year' },
                  interpretationCriteria: { type: 'array', items: { type: 'string' }, description: 'Specific interpretation criteria applied' }
                },
                description: 'Guidelines used for variant interpretation'
              },
              priorAuthorizationStatus: {
                type: 'object',
                properties: {
                  status: { type: 'string', description: 'Authorization status (obtained, pending, denied)' },
                  authorizationNumber: { type: 'string', description: 'Authorization reference number' },
                  dateObtained: { type: 'string', description: 'Date authorization was obtained' },
                  expirationDate: { type: 'string', description: 'Authorization expiration date' }
                },
                description: 'Prior authorization status for genetic testing coverage'
              },
              bloodSampleCollectionStatus: {
                type: 'object',
                properties: {
                  collected: { type: 'boolean', description: 'Whether sample was collected' },
                  collectionDate: { type: 'string', description: 'Date of collection' },
                  sampleType: { type: 'string', description: 'Type of sample (blood, saliva, etc.)' },
                  numberOfTubes: { type: 'number', description: 'Number of tubes collected' },
                  sentToLab: { type: 'string', description: 'Lab where sample was sent' }
                },
                description: 'Blood sample collection status and details'
              },
              fmlaDocumentationNote: {
                type: 'object',
                properties: {
                  documented: { type: 'boolean', description: 'Whether FMLA documentation was provided' },
                  reason: { type: 'string', description: 'Reason for FMLA documentation' },
                  dateProvided: { type: 'string', description: 'Date documentation was provided' },
                  additionalNotes: { type: 'string', description: 'Additional FMLA-related notes' }
                },
                description: 'FMLA (Family Medical Leave Act) documentation information'
              }
            }
          },

          // ========== ALLERGY & IMMUNOLOGY ASSESSMENT ==========
          allergyImmunologyAssessment: {
            type: 'object',
            properties: {
              skinTesting: {
                type: 'object',
                properties: {
                  prickTest: { type: 'array', items: { type: 'object' } },
                  intradermal: { type: 'array', items: { type: 'object' } },
                  patch: { type: 'array', items: { type: 'object' } }
                }
              },
              specificIge: {
                type: 'object',
                properties: {
                  foods: { type: 'object' },
                  inhalants: { type: 'object' },
                  venoms: { type: 'object' },
                  drugs: { type: 'object' }
                }
              },
              componentTesting: {
                type: 'object',
                properties: {
                  allergens: { type: 'array', items: { type: 'object' } },
                  crossReactivity: { type: 'object' }
                }
              },
              immuneFunction: {
                type: 'object',
                properties: {
                  immunoglobulins: { type: 'object' },
                  lymphocyteSubsets: { type: 'object' },
                  complement: { type: 'object' },
                  vaccination: { type: 'object' }
                }
              },
              challengeTests: {
                type: 'object',
                properties: {
                  testDate: { type: 'string', description: 'Date of challenge test (ISO format)' },
                  food: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', description: 'Status: planned, ordered, in_progress, completed, cancelled' },
                      indication: { type: 'string', description: 'Indication for food challenge test (e.g., "WDEIA", "oral food challenges for specific allergens")' }
                    },
                    description: 'Food challenge test details (if applicable)'
                  },
                  drug: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', description: 'Status: planned, ordered, in_progress, completed, cancelled' },
                      indication: { type: 'string', description: 'Indication for drug challenge test (e.g., "amoxicillin", "penicillin allergy verification")' }
                    },
                    description: 'Drug challenge test details (if applicable)'
                  },
                  aspirin: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', description: 'Status: planned, ordered, in_progress, completed, cancelled' },
                      indication: { type: 'string', description: 'Indication for aspirin challenge test (e.g., "AERD - Aspirin Exacerbated Respiratory Disease")' }
                    },
                    description: 'Aspirin challenge test details (if applicable, commonly for AERD)'
                  },
                  exercise: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', description: 'Status: planned, ordered, in_progress, completed, cancelled' },
                      indication: { type: 'string', description: 'Indication for exercise challenge test (e.g., "Exercise-induced anaphylaxis", "EIA")' }
                    },
                    description: 'Exercise challenge test details (if applicable)'
                  },
                  protocol: { type: 'string', description: 'Test protocol and procedure details' },
                  reactions: { type: 'array', items: { type: 'string' }, description: 'Recorded reactions or adverse events during testing' },
                  outcome: { type: 'string', description: 'Test outcome and conclusion' },
                  threshold: { type: 'string', description: 'Reaction threshold (dose/concentration at which reaction occurred)' },
                  supervisedBy: { type: 'string', description: 'Name/title of healthcare provider supervising the test' }
                },
                description: 'Challenge tests: food, drug, aspirin (for AERD), or exercise challenges - includes test type, status, protocol, reactions, and outcomes'
              }
            }
          },

          // ========== CYTOGENETICS (Standalone for Critical Importance) ==========
          cytogenetics: {
            type: 'object',
            properties: {
              karyotype: { type: 'string', description: 'CRITICAL: Complete karyotype with cell count notation (e.g., "46,XY,t(8;14)(q24;q32),t(14;18)(q32;q21)[18]/46,XY[2]")' },
              interpretation: { type: 'string', description: 'Clinical interpretation (e.g., "Complex karyotype with dual translocations")' },
              abnormalCells: { type: 'string', description: 'Number of abnormal cells counted (e.g., "18" from [18])' },
              normalCells: { type: 'string', description: 'Number of normal cells counted (e.g., "2" from [2])' },
              translocations: { type: 'array', items: { type: 'string' }, description: 'List of translocations (e.g., "t(8;14)(q24;q32)", "t(14;18)(q32;q21)")' }
            },
            description: 'CRITICAL FIELD: Cytogenetics results are essential for lymphoma/leukemia diagnosis and prognosis. Always extract complete karyotype notation.'
          },

          // ========== HEMATOLOGY ASSESSMENT ==========
          hematologyAssessment: {
            type: 'object',
            properties: {
              bloodSmear: {
                type: 'object',
                description: 'Blood smear (peripheral blood smear) analysis - manual microscopic examination of blood cells',
                properties: {
                  rbcMorphology: {
                    type: 'string',
                    description: 'RBC morphology findings (comma-separated): sickle cells, target cells, spherocytes, schistocytes, etc.'
                  },
                  wbcDifferential: {
                    type: 'object',
                    description: 'WBC differential counts if available (neutrophils, lymphocytes, monocytes, eosinophils, basophils)'
                  },
                  plateletEstimate: {
                    type: 'string',
                    description: 'Platelet estimate (adequate, increased, decreased) or count estimate'
                  },
                  inclusions: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'CRITICAL: Extract RBC inclusions as separate array items. If report mentions "Howell-Jolly bodies" or "basophilic stippling" or "Pappenheimer bodies", extract each as individual strings in this array. Do NOT leave in rbcMorphology string only - MUST extract to this dedicated array.'
                  },
                  anisocytosis: {
                    type: 'string',
                    description: 'RBC size variation: none, mild, moderate, marked (related to RDW)'
                  },
                  poikilocytosis: {
                    type: 'string',
                    description: 'RBC shape variation: none, mild, moderate, marked'
                  },
                  polychromasia: {
                    type: 'string',
                    description: 'Young RBCs (reticulocytes) with blue-purple color: present, absent, mild, moderate, marked'
                  },
                  rouleaux: {
                    type: 'string',
                    description: 'RBCs stacked like coins (seen in multiple myeloma, inflammation): present, absent, mild, moderate, marked'
                  },
                  interpretation: {
                    type: 'string',
                    description: 'Pathologist interpretation and clinical significance of blood smear findings'
                  }
                }
              },
              hemoglobinopathy: {
                type: 'object',
                properties: {
                  electrophoresis: { type: 'object' },
                  hplc: { type: 'object' },
                  sickling: { type: 'string' }
                }
              },
              coagulation: {
                type: 'object',
                properties: {
                  pt: { type: 'string' },
                  ptt: { type: 'string' },
                  factorLevels: { type: 'object' },
                  mixing: { type: 'object' },
                  thrombophilia: { type: 'object' }
                }
              },
              boneMarrow: {
                type: 'object',
                properties: {
                  cellularity: { type: 'string', description: 'Cellularity percentage with age comparison (e.g., "70% (hypercellular for age)")' },
                  myeloidErythroid: { type: 'string' },
                  blasts: { type: 'string', description: 'Blast percentage for leukemia/myelodysplasia (e.g., "5% blasts"). DO NOT use for lymphoma - use lymphomaInvolvement instead' },
                  lymphomaInvolvement: { type: 'string', description: 'Percentage of lymphoma involvement (e.g., "Approximately 30% marrow involvement by large atypical lymphoid cells"). Use this for lymphoma, NOT blasts field' },
                  reticulinStain: { type: 'string', description: 'Reticulin stain grading (e.g., "MF-0", "MF-1", "MF-2", "MF-3") indicating myelofibrosis status' },
                  megakaryocytes: { type: 'string', description: 'Megakaryocyte assessment (e.g., "Adequate with normal morphology")' },
                  hematopoiesis: { type: 'string', description: 'Status of background trilineage hematopoiesis (e.g., "Present but decreased", "Normal")' },
                  involvementPattern: { type: 'string', description: 'Pattern of lymphoid involvement (e.g., "Paratrabecular lymphoid aggregates", "Interstitial pattern")' },
                  cytogenetics: {
                    type: 'object',
                    properties: {
                      karyotype: { type: 'string', description: 'Complete karyotype (e.g., "46,XY,t(8;14)(q24;q32),t(14;18)(q32;q21)[18]/46,XY[2]")' },
                      interpretation: { type: 'string', description: 'Clinical interpretation (e.g., "Complex karyotype with dual translocations")' },
                      cellsCounted: {
                        type: 'object',
                        properties: {
                          abnormalCells: { type: 'string', description: 'Number of abnormal cells counted (e.g., "18" from [18])' },
                          normalCells: { type: 'string', description: 'Number of normal cells counted (e.g., "2" from [2])' },
                          details: { type: 'string', description: 'Full cell count notation (e.g., "[18]/46,XY[2]")' }
                        },
                        description: 'Cell count breakdown from karyotype notation'
                      }
                    }
                  },
                  flowCytometry: { type: 'object' }
                }
              },
              transfusion: {
                type: 'object',
                properties: {
                  bloodType: { type: 'string' },
                  antibodyScreen: { type: 'object' },
                  crossmatch: { type: 'object' },
                  reactions: { type: 'array', items: { type: 'object' } }
                }
              },

              // ========== HEMATOLOGY CONSULTATION FIELDS ==========
              bloodDisorder: {
                type: 'string',
                description: 'Primary blood disorder diagnosis (e.g., "Sickle Cell Disease", "Aplastic Anemia", "Hemophilia A", "Acute Myeloid Leukemia")'
              },
              stagingClassification: {
                type: 'string',
                description: 'Disease staging or classification (e.g., "Ann Arbor Stage III", "Rai Stage II", "HbSS genotype", "Severe phenotype")'
              },
              treatmentPlan: {
                type: 'object',
                description: 'Hematology treatment plan with immediate interventions',
                properties: {
                  immediateInterventions: {
                    type: 'object',
                    description: 'Acute crisis management or immediate treatment actions',
                    properties: {
                      painControl: {
                        type: 'string',
                        description: 'Pain management strategy (e.g., "IV morphine PCA", "Hydromorphone", dose, frequency, duration)'
                      },
                      hydration: {
                        type: 'string',
                        description: 'IV fluid management (e.g., "IV fluids 125 mL/hr", "Monitor I&Os")'
                      },
                      oxygenation: {
                        type: 'string',
                        description: 'Oxygen support requirements (e.g., "Keep SpO2 >95%", "Incentive spirometry Q2H")'
                      },
                      monitoring: {
                        type: 'string',
                        description: 'Clinical monitoring plan (e.g., "Daily CBC", "Watch for acute chest syndrome")'
                      }
                    }
                  }
                }
              },
              chemotherapy: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    regimen: { type: 'string', description: 'Chemotherapy regimen name (e.g., "R-CHOP", "ABVD", "Hydroxyurea")' },
                    drugs: { type: 'array', items: { type: 'string' }, description: 'Individual drugs in regimen' },
                    schedule: { type: 'string', description: 'Cycle frequency and duration' },
                    intent: { type: 'string', description: 'Curative, palliative, maintenance' }
                  }
                },
                description: 'Chemotherapy regimens for blood cancers or disease-modifying agents'
              },
              supportiveCare: {
                type: 'array',
                items: { type: 'string' },
                description: 'Supportive care measures (e.g., "Folic acid supplementation", "Penicillin prophylaxis", "Pain management protocol")'
              },
              transfusionSupport: {
                type: 'string',
                description: 'Blood transfusion protocol (e.g., "PRBCs for Hgb <7", "Exchange transfusion protocol", "Chronic transfusion program")'
              },
              growthFactors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    agent: { type: 'string', description: 'Growth factor name (e.g., "Filgrastim", "Epoetin alfa", "Eltrombopag")' },
                    indication: { type: 'string' },
                    dosing: { type: 'string' }
                  }
                },
                description: 'Hematopoietic growth factors (G-CSF, erythropoietin, thrombopoietin agonists)'
              },
              transplantEligibility: {
                type: 'string',
                description: 'Bone marrow/stem cell transplant candidacy status and evaluation plan (e.g., "Transplant candidate - HLA typing ordered", "Not eligible due to age/comorbidities")'
              },
              clinicalTrials: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    trialName: { type: 'string' },
                    phase: { type: 'string' },
                    intervention: { type: 'string', description: 'Trial drug or therapy (e.g., "Gene therapy", "CAR-T cell therapy")' },
                    eligibility: { type: 'string', description: 'Eligible, under screening, not eligible' }
                  }
                },
                description: 'Clinical trial opportunities and eligibility'
              },
              prognosis: {
                type: 'object',
                description: 'Hematology disease prognosis with risk stratification',
                properties: {
                  shortTerm: {
                    type: 'string',
                    description: 'Immediate prognosis (e.g., "Acute crisis expected to resolve with treatment", "High risk for complications during induction")'
                  },
                  longTerm: {
                    type: 'string',
                    description: 'Long-term prognosis and life expectancy with current therapy options'
                  },
                  riskFactors: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Adverse prognostic factors (e.g., "Frequent crises", "End-organ damage", "Poor cytogenetics", "High-risk mutations")'
                  },
                  protectiveFactors: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Favorable prognostic factors (e.g., "Newer disease-modifying agents available", "Transplant candidate", "Good performance status")'
                  }
                }
              },
              followUp: {
                type: 'string',
                description: 'Hematology follow-up plan (e.g., "Return to clinic in 2 weeks", "Monthly CBC monitoring", "Transplant evaluation appointment")'
              }
            }
          },

          // ========== SICKLE CELL/HEMATOLOGY DISEASE SEVERITY ==========
          diseaseSeverity: {
            type: 'object',
            description: 'Disease severity assessment with precise crisis tracking',
            properties: {
              overallSeverity: { type: 'string', description: 'High, Moderate, Low' },
              crisisFrequency: {
                type: 'object',
                properties: {
                  currentYearCount: { type: 'number', description: 'EXACT number this year (e.g., if PDF says "6th this year", use 6)' },
                  annualAverage: { type: 'number', description: 'Average per year if different from current' },
                  lastCrisisDate: { type: 'string' }
                }
              },
              complications: {
                type: 'array',
                items: { type: 'string' },
                description: 'List all complications: acute chest syndrome, end-organ damage, etc.'
              },
              qualityOfLife: { type: 'string' },
              prognosticFactors: { type: 'array', items: { type: 'string' } }
            }
          },

          // ========== ENHANCED FOLLOW-UP APPOINTMENTS ==========
          followUpAppointmentsEnhanced: {
            type: 'object',
            description: 'Comprehensive follow-up including immediate admissions and daily rounds',
            properties: {
              immediateActions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Immediate plans like "Admit for crisis management", "Daily rounds during admission"'
              },
              scheduledAppointments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    specialty: { type: 'string' },
                    timing: { type: 'string' },
                    isScheduled: { type: 'boolean' },
                    reason: { type: 'string' }
                  }
                }
              },
              admissionPlan: {
                type: 'object',
                properties: {
                  admitted: { type: 'boolean' },
                  reason: { type: 'string' },
                  expectedDuration: { type: 'string' },
                  dailyRounds: { type: 'boolean' }
                }
              }
            }
          },

          // ========== HOME MONITORING DATA ==========
          homeMonitoring: {
            type: 'object',
            properties: {
              bloodPressure: {
                type: 'object',
                properties: {
                  morning: {
                    type: 'object',
                    properties: {
                      average: { type: 'string' },
                      range: { type: 'string', description: 'Variability range (e.g., "128-148/82-92")' },
                      readings: { type: 'array', items: { type: 'string' } }
                    }
                  },
                  evening: {
                    type: 'object',
                    properties: {
                      average: { type: 'string' },
                      range: { type: 'string', description: 'Variability range (e.g., "135-150/85-95")' },
                      readings: { type: 'array', items: { type: 'string' } }
                    }
                  },
                  frequency: { type: 'string' },
                  device: { type: 'string' }
                }
              },
              glucose: {
                type: 'object',
                properties: {
                  fasting: { type: 'array', items: { type: 'string' } },
                  postPrandial: { type: 'array', items: { type: 'string' } },
                  bedtime: { type: 'array', items: { type: 'string' } },
                  frequency: { type: 'string' },
                  device: { type: 'string' }
                }
              },
              weight: {
                type: 'object',
                properties: {
                  readings: { type: 'array', items: { type: 'string' } },
                  trend: { type: 'string' },
                  frequency: { type: 'string' }
                }
              },
              oxygenSaturation: {
                type: 'object',
                properties: {
                  readings: { type: 'array', items: { type: 'string' } },
                  lowest: { type: 'string' },
                  average: { type: 'string' },
                  device: { type: 'string' }
                }
              },
              peakFlow: {
                type: 'object',
                properties: {
                  readings: { type: 'array', items: { type: 'string' } },
                  personalBest: { type: 'string' },
                  zones: { type: 'object', properties: {
                    green: { type: 'string' },
                    yellow: { type: 'string' },
                    red: { type: 'string' }
                  }}
                }
              },
              symptoms: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string' },
                    symptom: { type: 'string' },
                    severity: { type: 'string' }
                  }
                }
              }
            },
            description: 'Home monitoring data including BP ranges, glucose logs, weight tracking'
          },

          // ========== TREND ANALYSIS DATA ==========
          trendAnalysis: {
            type: 'object',
            properties: {
              laboratoryTrends: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    test: { type: 'string' },
                    currentValue: { type: 'string' },
                    previousValue: { type: 'string' },
                    trend: { type: 'string', description: 'Trend indicator (↑ Improved, ↓ Improved, → Stable, → Normal)' },
                    dateRange: { type: 'string' }
                  }
                }
              },
              vitalSignTrends: {
                type: 'object',
                properties: {
                  bloodPressure: { type: 'string' },
                  heartRate: { type: 'string' },
                  weight: { type: 'string' },
                  temperature: { type: 'string' }
                }
              },
              clinicalTrends: {
                type: 'object',
                properties: {
                  symptomProgression: { type: 'string' },
                  functionalStatus: { type: 'string' },
                  medicationResponse: { type: 'string' },
                  diseaseControl: { type: 'string' }
                }
              },
              renalTrends: {
                type: 'object',
                properties: {
                  creatinine: {
                    type: 'object',
                    properties: {
                      current: { type: 'string' },
                      previous: { type: 'string' },
                      trend: { type: 'string' }
                    }
                  },
                  egfr: {
                    type: 'object',
                    properties: {
                      current: { type: 'string' },
                      previous: { type: 'string' },
                      trend: { type: 'string' }
                    }
                  }
                }
              }
            },
            description: 'Trending data for labs, vitals, clinical status over time'
          },

          // ========== LIFESTYLE COUNSELING ==========
          lifestyleCounseling: {
            type: 'object',
            properties: {
              diet: { type: 'string', description: 'Specific dietary recommendations' },
              exercise: { type: 'string', description: 'Exercise plan and recommendations' },
              weight: { type: 'string', description: 'Weight management goals and strategies' },
              stress: { type: 'string', description: 'Stress management techniques' },
              sleep: { type: 'string', description: 'Sleep hygiene recommendations' },
              smoking: { type: 'string', description: 'Smoking cessation counseling' },
              alcohol: { type: 'string', description: 'Alcohol reduction strategies' }
            },
            description: 'Detailed lifestyle counseling recommendations distinct from patient education'
          },

          // ========== HEALTH MAINTENANCE ==========
          healthMaintenance: {
            type: 'object',
            properties: {
              dentalCleaning: { type: 'string', description: 'Dental cleaning schedule (e.g., "every 6 months")' },
              eyeExam: { type: 'string', description: 'Eye exam frequency (e.g., "annual")' },
              footExam: { type: 'string', description: 'Foot exam schedule' },
              skinCancerScreening: { type: 'string', description: 'Skin cancer screening recommendations' },
              selfExamEducation: { type: 'string', description: 'Self-exam education (e.g., testicular, breast)' },
              hearingTest: { type: 'string', description: 'Hearing test schedule' },
              boneHealthScreening: { type: 'string', description: 'Bone density screening schedule' }
            },
            description: 'Ongoing preventive care and maintenance schedule distinct from follow-up appointments'
          },

          // ========== PATIENT INSTRUCTIONS ==========
          patientInstructions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                instruction: { type: 'string', description: 'Specific action item for patient' },
                priority: { type: 'string', description: 'urgent, routine, as needed' },
                timeframe: { type: 'string', description: 'When to complete (e.g., "before next visit")' }
              }
            },
            description: 'Specific action items for patient compliance'
          },

          // ========== REFERRALS PLACED ==========
          referralsPlaced: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                specialty: { type: 'string', description: 'Specialty referred to' },
                reason: { type: 'string', description: 'Reason for referral' },
                urgency: { type: 'string', description: 'urgent, routine, elective' },
                provider: { type: 'string', description: 'Specific provider if mentioned' }
              }
            },
            description: 'List of referrals placed, distinct from follow-up appointments'
          },

          // ========== PREVENTIVE CARE ==========
          preventiveCare: {
            type: 'object',
            properties: {
              colonoscopyDueAge: { type: 'string', description: 'Age when colonoscopy is due (e.g., "Due (age 45 screening)")' },
              mammographyStatus: { type: 'string', description: 'ONLY for female patients - leave empty for males' },
              cervicalScreeningStatus: { type: 'string', description: 'ONLY for female patients - leave empty for males' },
              lungCancerScreening: { type: 'string' },
              prostateCancerScreening: { type: 'string', description: 'ONLY for male patients - leave empty for females' },
              aaaScreening: { type: 'string', description: 'Abdominal aortic aneurysm screening' },
              depressionScreening: { type: 'string', description: 'Depression screening results (e.g., "PHQ-9 score: 4 (minimal)")' },
              alcoholScreening: { type: 'string', description: 'Alcohol screening results (e.g., "AUDIT-C score: 2 (low risk)")' },
              immunizations: {
                type: 'object',
                properties: {
                  influenza: { type: 'string' },
                  pneumococcal: { type: 'string' },
                  covid19: { type: 'string' },
                  zoster: { type: 'string' },
                  other: { type: 'array', items: { type: 'string' } }
                }
              }
            },
            description: 'Preventive care status and milestones - ONLY include gender-appropriate screenings'
          },

          // ========== GASTROENTEROLOGY SPECIFIC FIELDS ==========
          symptomProgression: {
            type: 'object',
            properties: {
              timeline: { type: 'string', description: 'Timeline of symptom progression' },
              week1: { type: 'string', description: 'Week 1 symptoms' },
              week2: { type: 'string', description: 'Week 2 symptoms' },
              week3: { type: 'string', description: 'Week 3 symptoms' },
              current: { type: 'string', description: 'Current status' }
            },
            description: 'Tracking disease progression and treatment response'
          },

          monitoringPlan: {
            type: 'object',
            properties: {
              laboratory: { type: 'string', description: 'Lab monitoring schedule' },
              labTiming: { type: 'string', description: 'When labs should be done (e.g., "Before each visit", "Weekly", "Monthly")' },
              labsBeforeEachVisit: { type: 'boolean', description: 'Whether labs are required before each appointment' },
              clinicalAssessment: { type: 'string', description: 'Clinical monitoring plan' },
              drugMonitoring: { type: 'string', description: 'Drug level monitoring' },
              frequency: { type: 'string', description: 'Monitoring frequency' },
              labFrequency: {
                type: 'object',
                properties: {
                  BMP: { type: 'string', description: 'Basic metabolic panel frequency (e.g., "Monthly")' },
                  CBC: { type: 'string', description: 'Complete blood count frequency' },
                  comprehensivePanel: { type: 'string', description: 'Comprehensive metabolic panel frequency (e.g., "Every 3 months")' },
                  lipidPanel: { type: 'string', description: 'Lipid panel frequency' },
                  UACR: { type: 'string', description: 'Urine albumin-creatinine ratio frequency' },
                  HbA1c: { type: 'string', description: 'Hemoglobin A1c frequency' }
                },
                description: 'Specific test frequencies for each panel'
              },
              urineFrequency: { type: 'string', description: 'Urine test frequency (e.g., "UACR every 3 months")' },
              bloodPressure: { type: 'object', properties: {
                homeMonitoringLog: { type: 'boolean', description: 'Home BP monitoring with log' },
                frequency: { type: 'string' }
              }},
              weight: { type: 'object', properties: {
                dailyWithLog: { type: 'boolean', description: 'Daily weight monitoring with log' },
                frequency: { type: 'string' }
              }},
              symptoms: { type: 'object', properties: {
                diaryForEdemaSOBAppetite: { type: 'boolean', description: 'Symptom diary for edema, SOB, appetite' },
                specificSymptoms: { type: 'array', items: { type: 'string' } }
              }},
              patientSelfMonitoring: { type: 'object', properties: {
                symptomDiary: { type: 'object', properties: {
                  required: { type: 'boolean' },
                  symptoms: { type: 'array', items: { type: 'string' }, description: 'Symptoms to track (e.g., "edema", "SOB", "appetite")' },
                  frequency: { type: 'string' }
                }},
                emotionalSupport: { type: 'object', properties: {
                  provided: { type: 'boolean' },
                  resources: { type: 'array', items: { type: 'string' } }
                }}
              }},
              callCriteria: { type: 'object', properties: {
                potassiumThreshold: { type: 'string', description: 'Specific K+ threshold for calling provider (e.g., "K+ >5.5")' },
                symptoms: { type: 'array', items: { type: 'string' }, description: 'Symptoms warranting call (e.g., "worsening edema", "SOB", "chest pain")' }
              }}
            },
            description: 'Comprehensive monitoring plan for ongoing care'
          },

          considerTPN: {
            type: 'string',
            description: 'Total parenteral nutrition consideration if oral nutrition fails'
          },

          ursodeoxycholicAcid: {
            type: 'string',
            description: 'Ursodeoxycholic acid dosing for PSC management'
          },

          infusionCenterVisits: {
            type: 'string',
            description: 'Daily infusion center visits for monitoring'
          },

          admissionRecommendation: {
            type: 'string',
            description: 'Hospital admission recommendation and patient preference'
          },

          socialWork: {
            type: 'object',
            properties: {
              referralMade: { type: 'boolean' },
              interventions: { type: 'array', items: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: 'e.g., "Medication assistance programs", "Disability benefits optimization", "FMLA paperwork"' },
                  status: { type: 'string', description: 'Initiated, ongoing, completed' },
                  details: { type: 'string' }
                }
              }},
              medicationAssistance: { type: 'boolean', description: 'Medication assistance program referral' },
              disabilityBenefits: { type: 'boolean', description: 'Disability benefits optimization' },
              fmla: { type: 'boolean', description: 'FMLA paperwork assistance' }
            },
            description: 'Social work involvement and interventions'
          },

          peerSupport: {
            type: 'string',
            description: 'Peer support connections and patient volunteer programs'
          },

          flareManagement: {
            type: 'object',
            properties: {
              rescueTherapy: { type: 'string', description: 'Rescue therapy options and timing' },
              escalationCriteria: { type: 'string', description: 'Criteria for treatment escalation' },
              admissionCriteria: { type: 'string', description: 'Criteria for hospital admission' }
            },
            description: 'IBD flare management protocols'
          },

          cancerSurveillance: {
            type: 'object',
            properties: {
              frequency: { type: 'string', description: 'Surveillance frequency' },
              method: { type: 'string', description: 'Surveillance method (colonoscopy, etc.)' },
              biopsyProtocol: { type: 'string', description: 'Biopsy protocol (e.g., random every 10cm)' },
              nextDue: { type: 'string', description: 'Next surveillance due date' }
            },
            description: 'Cancer surveillance protocol for IBD patients'
          },

          psychosocialFactors: {
            type: 'object',
            properties: {
              stressors: { type: 'string', description: 'Current life stressors' },
              support: { type: 'string', description: 'Support systems' },
              copingStrategies: { type: 'string', description: 'Coping mechanisms' },
              mentalHealth: { type: 'string', description: 'Mental health status' }
            },
            description: 'Psychosocial assessment and support'
          },

          ibdCareTeam: {
            type: 'string',
            description: 'Multidisciplinary IBD care team members and roles'
          },

          insuranceBarriers: {
            type: 'string',
            description: 'Insurance denials, prior authorizations, and treatment access issues'
          },

          incontinenceEpisodes: {
            type: 'string',
            description: 'Frequency and impact of incontinence episodes'
          },

          bodyImageConcerns: {
            type: 'string',
            description: 'Body image concerns related to disease or potential surgery'
          },

          geneticCounseling: {
            type: 'string',
            description: 'Genetic counseling offered or completed'
          },

          familyCounseling: {
            type: 'string',
            description: 'Family counseling recommendations or services'
          },

          caregiverBurden: {
            type: 'string',
            description: 'Assessment of caregiver stress and support needs'
          },

          pscManagement: {
            type: 'object',
            properties: {
              ursodeoxycholicAcid: { type: 'string', description: 'UDCA dosing' },
              mrcp: { type: 'string', description: 'MRCP monitoring schedule' },
              dominantStrictures: { type: 'string', description: 'Monitoring for dominant strictures' },
              hepatologyManagement: { type: 'string', description: 'Hepatology co-management plan' }
            },
            description: 'Primary Sclerosing Cholangitis management plan'
          },

          admissionDecisions: {
            type: 'object',
            properties: {
              recommendation: { type: 'string', description: 'Admission recommendation' },
              patientPreference: { type: 'string', description: 'Patient decision' },
              alternativePlan: { type: 'string', description: 'Outpatient management if admission declined' }
            },
            description: 'Hospital admission decisions and alternatives'
          },

          // Additional incontinence field (alternative name)
          incontinenceTracking: {
            type: 'string',
            description: 'Incontinence episodes tracking - alternative field name for incontinenceEpisodes'
          },

          // Specific symptom severity fields
          ursodeoxycholicAcidDosage: {
            type: 'string',
            description: 'Specific UDCA dosage for PSC (e.g., 15mg/kg/day)'
          },

          infliximabLastDoseTime: {
            type: 'string',
            description: 'Time since last infliximab dose'
          },

          abdominalPainScore: {
            type: 'string',
            description: 'Pain severity score (0-10 scale)'
          },

          nighttimeAwakenings: {
            type: 'string',
            description: 'Number of nighttime awakenings due to symptoms'
          },

          tenesmus: {
            type: 'string',
            description: 'Presence and severity of tenesmus'
          },

          mesalamineRetentionTime: {
            type: 'string',
            description: 'Ability to retain mesalamine enemas/suppositories'
          },

          insuranceDenialDetails: {
            type: 'string',
            description: 'Specific insurance denials and treatment barriers'
          },

          // ========== GERIATRIC ASSESSMENT SPECIFIC FIELDS ==========
          livingSituation: {
            type: 'string',
            description: 'Current living arrangement (independent, assisted living, with family, etc.) including spouse information'
          },
          adultDayProgramInformation: {
            type: 'string',
            description: 'Information about adult day programs, enrollment status, or referrals'
          },
          assistiveDevice: {
            type: 'string',
            description: 'Assistive devices used (cane, walker, wheelchair, etc.)'
          },

          palliativeCareReferral: {
            type: 'string',
            description: 'Palliative care referral status and patient response'
          },

          compressionStockings: {
            type: 'string',
            description: 'Compression stockings prescription for orthostatic management'
          },

          omeprazoleDeprescribing: {
            type: 'string',
            description: 'PPI deprescribing consideration'
          },

          echocardiogram: {
            type: 'string',
            description: 'Echocardiogram scheduling and frequency'
          },

          dailyWeights: {
            type: 'string',
            description: 'Daily weight monitoring for heart failure'
          },

          sodiumRestriction: {
            type: 'string',
            description: 'Sodium restriction counseling'
          },

          respiteCareInformation: {
            type: 'string',
            description: 'Respite care resources provided'
          },

          adultDayProgram: {
            type: 'string',
            description: 'Adult day program information and referral'
          },

          daughterSupportGroup: {
            type: 'string',
            description: 'Family caregiver support group participation'
          },

          neuropsychologicalTesting: {
            type: 'string',
            description: 'Neuropsychological testing orders and scheduling'
          },

          familyEducationDementia: {
            type: 'string',
            description: 'Family education about dementia progression'
          },

          safetyDiscussions: {
            type: 'string',
            description: 'Safety planning discussions (medications, finances, driving)'
          },

          riseSlowlyEducation: {
            type: 'string',
            description: 'Orthostatic hypotension education'
          },

          increaseFluidIntake: {
            type: 'string',
            description: 'Fluid intake recommendations for orthostasis'
          },

          monthlyWeightMonitoring: {
            type: 'string',
            description: 'Monthly weight monitoring for nutrition'
          },

          considerDOAC: {
            type: 'string',
            description: 'DOAC consideration for anticoagulation'
          },

          noTremor: {
            type: 'string',
            description: 'Negative neurological findings'
          },

          medicationTotalPostVisit: {
            type: 'string',
            description: 'Total medication count after deprescribing'
          },

          // ========== ENHANCED VITAL SIGNS CAPTURE ==========
          bloodPressure: {
            type: 'object',
            description: 'Detailed blood pressure measurements including orthostatic readings',
            properties: {
              sitting: {
                type: 'object',
                properties: {
                  systolic: { type: 'number' },
                  diastolic: { type: 'number' },
                  unit: { type: 'string', default: 'mmHg' }
                }
              },
              standing: {
                type: 'object',
                properties: {
                  systolic: { type: 'number' },
                  diastolic: { type: 'number' },
                  unit: { type: 'string', default: 'mmHg' }
                }
              },
              orthostaticChange: {
                type: 'boolean',
                description: 'Whether orthostatic changes were noted'
              },
              raw: {
                type: 'string',
                description: 'Original text if structured extraction fails'
              }
            }
          },

          weight: {
            type: 'object',
            description: 'Weight measurements including historical comparisons',
            properties: {
              current: {
                type: 'object',
                properties: {
                  value: { type: 'number' },
                  unit: { type: 'string' },
                  kg: { type: 'number' }
                }
              },
              previous: {
                type: 'object',
                properties: {
                  value: { type: 'number' },
                  unit: { type: 'string' },
                  timeframe: { type: 'string', description: 'e.g., "one year ago"' }
                }
              },
              change: {
                type: 'string',
                description: 'Description of weight change'
              },
              raw: {
                type: 'string',
                description: 'Original text if structured extraction fails'
              }
            }
          },

          height: {
            type: 'object',
            description: 'Height measurement for BMI calculation and medication dosing. IMPORTANT: For feet and inches, store feet and inches separately (e.g., 5\'10" = feet: 5, inches: 10)',
            properties: {
              feet: { type: 'number', description: 'Feet component of height (e.g., 5 for 5\'10")' },
              inches: { type: 'number', description: 'Inches component of height (e.g., 10 for 5\'10")' },
              totalInches: { type: 'number', description: 'Total height in inches' },
              cm: { type: 'number', description: 'Height in centimeters' },
              raw: { type: 'string', description: 'Original text exactly as written e.g., "5\'10\\" (177.8 cm)"' }
            }
          },

          ensurePlusSupplementation: {
            type: 'string',
            description: 'Nutritional supplementation with Ensure Plus or similar products'
          },

          psaScreening: {
            type: 'string',
            description: 'PSA (Prostate-Specific Antigen) screening status and decisions'
          },

          // ========== ENHANCED CAREGIVER & FAMILY SUPPORT ==========
          familyMeetingDecisions: {
            type: 'object',
            description: 'Detailed family meeting outcomes and decisions',
            properties: {
              decisions: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of decisions made'
              },
              caregiverCommitments: {
                type: 'string',
                description: 'What caregivers have committed to do'
              },
              familyUnderstanding: {
                type: 'string',
                description: 'Family understanding and agreement with plan'
              },
              raw: {
                type: 'string',
                description: 'Original text if structured extraction fails'
              }
            }
          },

          caregiverSupport: {
            type: 'object',
            description: 'Detailed caregiver support information including current and planned changes',
            properties: {
              current: {
                type: 'object',
                properties: {
                  frequency: { type: 'string' },
                  provider: { type: 'string' },
                  activities: { type: 'array', items: { type: 'string' } }
                }
              },
              planned: {
                type: 'object',
                properties: {
                  frequency: { type: 'string' },
                  provider: { type: 'string' },
                  activities: { type: 'array', items: { type: 'string' } }
                }
              },
              changes: {
                type: 'string',
                description: 'Planned changes to support'
              },
              raw: {
                type: 'string',
                description: 'Original text if structured extraction fails'
              }
            }
          },

          // ========== ICU FLOW SHEET & CRITICAL CARE MONITORING ==========
          icuFlowSheet: {
            type: 'object',
            properties: {
              icuDay: { type: 'number', description: 'ICU day number (e.g., "ICU Day 2")' },
              hourlyVitalSigns: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    time: { type: 'string', description: 'Time of measurement (e.g., "00:00", "01:00")' },
                    bloodPressure: { type: 'string', description: 'BP in mmHg (e.g., "95/52")' },
                    heartRate: { type: 'number', description: 'HR in bpm' },
                    respiratoryRate: { type: 'number', description: 'RR in breaths/min' },
                    temperature: { type: 'number', description: 'Temp in Celsius' },
                    spO2: { type: 'string', description: 'Oxygen saturation percentage' },
                    fiO2: { type: 'string', description: 'Fraction of inspired oxygen percentage' },
                    peep: { type: 'number', description: 'PEEP in cmH2O' },
                    cvp: { type: 'number', description: 'Central venous pressure in mmHg' }
                  }
                },
                description: 'CRITICAL: Complete hourly vital signs table with all parameters'
              },
              ventilatorSettings: {
                type: 'object',
                properties: {
                  mode: { type: 'string', description: 'Ventilator mode (e.g., "PRVC → PSV")' },
                  tidalVolume: { type: 'string', description: 'Tidal volume (e.g., "450 mL")' },
                  minuteVentilation: { type: 'string', description: 'Minute ventilation (e.g., "8.2 L/min")' },
                  peakPressure: { type: 'string', description: 'Peak pressure (e.g., "28 cmH2O")' },
                  plateauPressure: { type: 'string', description: 'Plateau pressure (e.g., "24 cmH2O")' },
                  compliance: { type: 'string', description: 'Lung compliance (e.g., "38 mL/cmH2O")' },
                  transitions: { type: 'array', items: { type: 'object', properties: {
                    time: { type: 'string' },
                    from: { type: 'string' },
                    to: { type: 'string' }
                  }}, description: 'Mode transitions with timestamps' }
                },
                description: 'CRITICAL: Complete ventilator settings with mode transitions'
              },
              arterialBloodGases: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    time: { type: 'string' },
                    pH: { type: 'number' },
                    pCO2: { type: 'number' },
                    pO2: { type: 'number' },
                    hCO3: { type: 'number' },
                    saO2: { type: 'string' }
                  }
                },
                description: 'ABG results with timestamps'
              },
              continuousInfusions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string', description: 'Drug name (e.g., "Norepinephrine", "Propofol", "Fentanyl")' },
                    startRate: { type: 'string', description: 'Starting rate (e.g., "15 mcg/min")' },
                    endRate: { type: 'string', description: 'Current/final rate (e.g., "5 mcg/min")' },
                    titration: { type: 'string', description: 'Titration notes (e.g., "weaned from 15 to 5 mcg/min")' },
                    indication: { type: 'string' }
                  }
                },
                description: 'CRITICAL: All continuous infusions with titration details'
              },
              neurologicalAssessment: {
                type: 'object',
                properties: {
                  glasgowComaScale: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        time: { type: 'string' },
                        eyeOpening: { type: 'number', description: 'E1-E4' },
                        verbalResponse: { type: 'number', description: 'V1-V5' },
                        motorResponse: { type: 'number', description: 'M1-M6' },
                        total: { type: 'number', description: 'Total GCS score' },
                        intubated: { type: 'boolean', description: 'Whether intubated (affects verbal score)' }
                      }
                    },
                    description: 'CRITICAL: GCS scores over time with component breakdown'
                  },
                  camICU: { type: 'string', description: 'CAM-ICU delirium assessment (Positive/Negative)' },
                  sedationLevel: { type: 'string' },
                  pupils: { type: 'string', description: 'Pupil assessment' }
                },
                description: 'Complete neurological assessments including GCS tracking and CAM-ICU'
              },
              proceduresInterventions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    time: { type: 'string' },
                    procedure: { type: 'string', description: '(e.g., "Vasopressor uptitrated for MAP <65", "Bronchoscopy performed", "Spontaneous breathing trial initiated")' },
                    indication: { type: 'string' }
                  }
                },
                description: 'All procedures and interventions with timestamps'
              },
              nursingNotes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Nursing observations (e.g., "Patient increasingly alert", "Weaning from ventilation progressing well", "Family at bedside")'
              }
            },
            description: 'CRITICAL: ICU Flow Sheet - Complete 24-hour critical care monitoring data. Extract ALL vital signs tables, ventilator settings, procedures, and assessments.'
          },

          // ========== MEDICATION ADMINISTRATION RECORD (MAR) ==========
          medicationAdministrationRecord: {
            type: 'object',
            properties: {
              scheduledMedications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    dose: { type: 'string' },
                    route: { type: 'string' },
                    frequency: { type: 'string', description: 'Dosing frequency (e.g., "Daily", "BID", "HS")' },
                    administrationTimes: {
                      type: 'object',
                      description: 'Administration times with checkmarks (e.g., {06:00: "✓RN-JD", 18:00: "✓RN-MS"})'
                    }
                  }
                },
                description: 'CRITICAL: All scheduled medications with administration time grid and nurse initials'
              },
              prnMedications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    dose: { type: 'string' },
                    route: { type: 'string' },
                    indication: { type: 'string', description: 'PRN indication (e.g., "Pain >7/10", "Nausea", "Anxiety", "BG >200")' },
                    timeGiven: { type: 'string' },
                    nurseInitials: { type: 'string' },
                    patientResponse: { type: 'string', description: 'Response after administration (e.g., "Pain 8→4", "Nausea resolved", "BG 245→180")' }
                  }
                },
                description: 'CRITICAL: PRN medications with indication, time given, nurse, and patient response'
              },
              ivInfusions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    solution: { type: 'string', description: 'IV solution (e.g., "NS 0.9%", "D5 0.45% NS + 20 KCl")' },
                    rate: { type: 'string' },
                    startTime: { type: 'string' },
                    stopTime: { type: 'string' },
                    volumeInfused: { type: 'string' },
                    nurseInitials: { type: 'string' }
                  }
                },
                description: 'IV infusions with rates, start/stop times, volumes'
              },
              bloodGlucoseMonitoring: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    time: { type: 'string' },
                    bloodGlucose: { type: 'string', description: 'BG value (e.g., "142 mg/dL", "189 mg/dL")' },
                    insulinCoverage: { type: 'string', description: 'Insulin given (e.g., "4u Aspart", "6u Aspart", "None")' },
                    nurseInitials: { type: 'string' }
                  }
                },
                description: 'Blood glucose monitoring with insulin coverage scale'
              },
              omissionsRefusals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    time: { type: 'string', description: 'Scheduled time that was missed' },
                    reason: { type: 'string', description: 'Reason for omission (e.g., "INR 3.8", "Patient refused", "NPO for procedure")' },
                    nurseInitials: { type: 'string' },
                    mdNotified: { type: 'string', description: 'MD notification (e.g., "Dr. Chen 18:15")' }
                  }
                },
                description: 'CRITICAL: Medication omissions and refusals with reasons and MD notification'
              },
              nurseSignatures: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    initials: { type: 'string', description: 'Nurse initials (e.g., "RN-NT", "RN-JD")' },
                    fullName: { type: 'string', description: 'Full name (e.g., "Nancy Thompson, RN")' },
                    shift: { type: 'string', description: 'Shift (e.g., "Night shift", "Day shift")' }
                  }
                },
                description: 'Nurse signature legend matching initials to full names'
              },
              pharmacyReview: {
                type: 'object',
                properties: {
                  reviewer: { type: 'string' },
                  reviewDate: { type: 'string' },
                  reviewTime: { type: 'string' }
                },
                description: 'Pharmacy review signature and timestamp'
              }
            },
            description: 'CRITICAL: Medication Administration Record - Complete MAR with scheduled/PRN medications, administration times, nurse initials, patient responses, and omissions/refusals'
          },

          // ========== DIALYSIS RUN SHEET ==========
          dialysisRunSheet: {
            type: 'object',
            properties: {
              preDialysisAssessment: {
                type: 'object',
                properties: {
                  arrivalTime: { type: 'string' },
                  preWeight: { type: 'string', description: 'Pre-dialysis weight (e.g., "78.5 kg")' },
                  postWeightPrevious: { type: 'string', description: 'Post-weight from previous session' },
                  interdialyticWeightGain: { type: 'string', description: 'Weight gained between sessions (e.g., "3.3 kg")' },
                  bloodPressureSitting: { type: 'string' },
                  bloodPressureStanding: { type: 'string', description: 'Standing BP for orthostasis check' },
                  heartRate: { type: 'string' },
                  temperature: { type: 'string' },
                  accessAssessment: { type: 'string', description: 'Vascular access assessment (e.g., "Thrill present, no signs of infection")' },
                  patientComplaints: { type: 'array', items: { type: 'string' }, description: 'Pre-dialysis symptoms (e.g., "Shortness of breath with exertion", "Mild lower extremity edema", "No chest pain")' }
                },
                description: 'CRITICAL: Complete pre-dialysis assessment with weights, vitals, access check, and symptoms'
              },
              dialysisPrescription: {
                type: 'object',
                properties: {
                  dryWeight: { type: 'string', description: 'Target dry weight (e.g., "75.0 kg")' },
                  fluidRemovalGoal: { type: 'string', description: 'Ultrafiltration goal (e.g., "3.5 L")' },
                  treatmentTime: { type: 'string', description: 'Prescribed treatment duration (e.g., "4 hours")' },
                  bloodFlowRate: { type: 'string', description: 'Blood flow rate (e.g., "400 mL/min")' },
                  dialysateFlow: { type: 'string', description: 'Dialysate flow rate (e.g., "600 mL/min")' },
                  dialysateTemperature: { type: 'string', description: 'Dialysate temperature (e.g., "36.0°C")' }
                },
                description: 'CRITICAL: Dialysis prescription parameters - all treatment settings'
              },
              dialyzer: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: 'Dialyzer model (e.g., "F180NR")' },
                  surfaceArea: { type: 'string', description: 'Membrane surface area (e.g., "1.8 m²")' },
                  reuseNumber: { type: 'string', description: 'Reuse count (e.g., "First use", "Reuse #3")' }
                },
                description: 'Dialyzer specifications'
              },
              dialysateComposition: {
                type: 'object',
                properties: {
                  sodium: { type: 'string', description: 'Na concentration (e.g., "138 mEq/L")' },
                  potassium: { type: 'string', description: 'K concentration (e.g., "2.0 mEq/L")' },
                  calcium: { type: 'string', description: 'Ca concentration (e.g., "2.5 mEq/L")' },
                  bicarbonate: { type: 'string', description: 'HCO3 concentration (e.g., "35 mEq/L")' }
                },
                description: 'CRITICAL: Dialysate electrolyte composition'
              },
              intradialyticMonitoring: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    time: { type: 'string', description: 'Time point (e.g., "11:00", "11:15", "11:30")' },
                    bloodPressure: { type: 'string' },
                    heartRate: { type: 'number' },
                    ufRate: { type: 'number', description: 'Ultrafiltration rate in mL/h' },
                    ufTotal: { type: 'number', description: 'Cumulative UF volume removed in mL' },
                    symptoms: { type: 'string', description: 'Patient symptoms (e.g., "None", "Mild cramp", "Light-headed")' },
                    interventions: { type: 'string', description: 'Nursing interventions (e.g., "Treatment initiated", "UF rate ↓ to 700", "NS 100mL bolus")' }
                  }
                },
                description: 'CRITICAL: Intradialytic monitoring - 15-minute interval vital signs, UF tracking, symptoms, and interventions'
              },
              medicationsAdministered: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string', description: '(e.g., "Heparin", "Iron Sucrose", "Epogen", "Zemplar")' },
                    dose: { type: 'string' },
                    route: { type: 'string' },
                    timing: { type: 'string', description: 'When given during treatment (e.g., "Loading dose 2000 units", "given last 30 min")' }
                  }
                },
                description: 'Medications administered during dialysis session'
              },
              postDialysisAssessment: {
                type: 'object',
                properties: {
                  postWeight: { type: 'string', description: 'Post-dialysis weight' },
                  actualFluidRemoved: { type: 'string', description: 'Actual UF volume removed (e.g., "3.15 L")' },
                  bloodPressureSitting: { type: 'string' },
                  bloodPressureStanding: { type: 'string', description: 'Standing BP post-treatment' },
                  orthostasis: { type: 'boolean', description: 'Whether orthostasis present' },
                  accessSite: { type: 'string', description: 'Access site condition (e.g., "Hemostasis achieved, no bleeding")' },
                  patientCondition: { type: 'string', description: 'Overall condition (e.g., "Tolerated treatment well", "No complaints")' }
                },
                description: 'CRITICAL: Post-dialysis assessment with final weight, fluid removed, vitals, and access site check'
              },
              laboratoryResults: {
                type: 'object',
                properties: {
                  preDialysisBUN: { type: 'string' },
                  preDialysisCreatinine: { type: 'string' },
                  adequacyKtV: { type: 'string', description: 'Kt/V dialysis adequacy measure' }
                },
                description: 'Pre-dialysis labs and adequacy measures'
              }
            },
            description: 'CRITICAL: Hemodialysis Run Sheet - Complete treatment record from pre-assessment through post-assessment with intradialytic monitoring'
          },

          // ========== ENHANCED OPERATIVE REPORT FIELDS ==========
          operativeReportDetails: {
            type: 'object',
            properties: {
              patientPositioning: { type: 'string', description: 'Surgical positioning (e.g., "Supine with left rotation", "Lithotomy", "Prone", "Lateral decubitus"). CRITICAL: ONLY extract if explicitly stated - DO NOT fabricate.' },
              prepAndDrape: { type: 'string', description: 'Prep and drape technique (e.g., "Abdomen prepped and draped in sterile fashion")' },
              pneumoperitoneum: {
                type: 'object',
                properties: {
                  method: { type: 'string', description: 'Establishment method (e.g., "Veress needle at umbilicus", "Hasson technique")' },
                  pressure: { type: 'string', description: 'Insufflation pressure (e.g., "15mmHg")' },
                  gas: { type: 'string', description: 'Gas used (e.g., "CO2")' }
                },
                description: 'Pneumoperitoneum establishment for laparoscopic procedures'
              },
              portPlacement: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    size: { type: 'string', description: 'Port size (e.g., "12mm", "5mm")' },
                    location: { type: 'string', description: 'Anatomical location (e.g., "umbilical", "epigastric", "midclavicular line", "anterior axillary line")' },
                    purpose: { type: 'string', description: 'Purpose (e.g., "camera", "working port", "extraction")' }
                  }
                },
                description: 'CRITICAL: Port placement details with sizes and precise anatomical locations for laparoscopic surgery'
              },
              criticalViewOfSafety: {
                type: 'object',
                properties: {
                  achieved: { type: 'boolean', description: 'Whether critical view of safety was achieved' },
                  structures: { type: 'array', items: { type: 'string' }, description: 'Structures identified (e.g., "Cystic artery identified", "Cystic duct identified and cleared")' }
                },
                description: 'CRITICAL: Critical view of safety documentation (specific to cholecystectomy)'
              },
              intraoperativeCholangiography: {
                type: 'object',
                properties: {
                  performed: { type: 'boolean' },
                  contrastInjection: { type: 'string', description: 'How contrast was injected (e.g., "via cystic artery", "via cystic duct")' },
                  biliarySytem: { type: 'string', description: 'Biliary anatomy visualization (e.g., "Normal intrahepatic and extrahepatic biliary anatomy")' },
                  flowIntoDuodenum: { type: 'string', description: 'Contrast flow (e.g., "Good flow into duodenum")' },
                  fillingDefects: { type: 'string', description: 'Presence of filling defects or stones (e.g., "No filling defects or strictures identified")' }
                },
                description: 'CRITICAL: Intraoperative cholangiography results with complete biliary system assessment'
              },
              surgicalSteps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    stepNumber: { type: 'number' },
                    description: { type: 'string', description: 'Detailed step description (e.g., "Calot\'s triangle dissected carefully", "Cystic artery identified and clipped", "Gallbladder dissected from liver bed using electrocautery")' }
                  }
                },
                description: 'CRITICAL: Numbered procedural sequence - complete surgical steps in chronological order'
              },
              specimens: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    specimen: { type: 'string', description: 'Specimen description (e.g., "Gallbladder with multiple gallstones")' },
                    pathologyGrossDescription: {
                      type: 'object',
                      properties: {
                        measurements: { type: 'string', description: 'Specimen dimensions (e.g., "9 x 4 x 3 cm")' },
                        wallThickness: { type: 'string', description: 'Wall thickness (e.g., "4-6mm")' },
                        contents: { type: 'string', description: 'Contents (e.g., "Contains multiple cholesterol stones ranging from 0.5-1.2 cm")' },
                        stoneCount: { type: 'number', description: 'Number of stones if countable' },
                        stoneSizes: { type: 'string', description: 'Stone size range (e.g., "0.5-1.2 cm")' }
                      },
                      description: 'CRITICAL: Pathology gross description with measurements, stone counts, and sizes'
                    },
                    microscopic: { type: 'string', description: 'Microscopic findings (e.g., "Chronic cholecystitis with transmural inflammation. No malignancy identified.")' }
                  }
                },
                description: 'CRITICAL: Specimens sent to pathology with detailed gross and microscopic descriptions'
              },
              closureTechnique: {
                type: 'object',
                properties: {
                  layers: { type: 'array', items: { type: 'string' }, description: 'Closure by layer (e.g., "Fascia closed with 0 Vicryl", "Skin with 4-0 Monocryl subcuticular")' },
                  sutureTypes: { type: 'array', items: { type: 'string' } }
                },
                description: 'Closure technique with layers and suture types'
              },
              spongeInstrumentCounts: { type: 'string', description: 'Final counts (e.g., "All sponge and instrument counts correct x2")' },
              operativeTime: {
                type: 'object',
                properties: {
                  startTime: { type: 'string', description: 'Surgery start time (e.g., "08:30 AM")' },
                  endTime: { type: 'string', description: 'Surgery end time (e.g., "10:15 AM")' },
                  totalDuration: { type: 'string', description: 'Total operative time (e.g., "1 hour 45 minutes")' }
                },
                description: 'CRITICAL: Operative time breakdown with start, end, and duration'
              }
            },
            description: 'CRITICAL: Enhanced operative report details - port placement, critical view of safety, cholangiography, numbered surgical steps, specimen descriptions with pathology gross findings'
          },

          // ========== ENHANCED NEPHROLOGY CKD CONSULTATION FIELDS ==========
          nephrologyConsultationDetails: {
            type: 'object',
            properties: {
              kidneyDiseaseProgressionTimeline: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    year: { type: 'string', description: 'Year (e.g., "2018", "2020", "2022")' },
                    eGFR: { type: 'number', description: 'eGFR value' },
                    uacr: { type: 'string', description: 'UACR value (e.g., "125 mg/g", "280 mg/g")' },
                    stage: { type: 'string', description: 'CKD stage if noted (e.g., "Stage 3a", "Stage 3b")' }
                  }
                },
                description: 'CRITICAL: Kidney disease progression timeline - eGFR trajectory over years with UACR values'
              },
              estimatedTimeToDialysis: { type: 'string', description: 'CRITICAL: Estimated time until ESRD/dialysis needed (e.g., "2-3 years at current rate of decline")' },
              dialysisPlanning: {
                type: 'object',
                properties: {
                  educationInitiated: {
                    type: 'object',
                    properties: {
                      modalityOptionsDiscussed: { type: 'boolean', description: 'Whether HD vs PD options were discussed' },
                      modalityOptions: { type: 'array', items: { type: 'string' }, description: '(e.g., ["Hemodialysis (HD)", "Peritoneal dialysis (PD)"])' },
                      renalEducationClass: { type: 'string', description: 'Education class status (e.g., "Referred to renal education class", "Scheduled 09/21/2025")' },
                      dialysisUnitTour: { type: 'string', description: 'Tour status (e.g., "Tour of dialysis unit scheduled")' },
                      socialWorkReferral: { type: 'boolean' }
                    },
                    description: 'Dialysis education initiatives'
                  },
                  accessPlanning: {
                    type: 'object',
                    properties: {
                      veinMapping: { type: 'string', description: 'Vein mapping status (e.g., "Vein mapping ordered")' },
                      armPreservation: { type: 'array', items: { type: 'string' }, description: 'Arm preservation instructions (e.g., ["Avoid PICC lines/subclavian access", "Protect left arm (non-dominant) for future AVF"])' },
                      vascularSurgeryReferral: { type: 'string', description: 'Referral timing (e.g., "Referral to vascular surgery when eGFR <20")' }
                    },
                    description: 'CRITICAL: Access planning for dialysis - vein mapping, arm preservation, surgery referral timing'
                  },
                  transplantEvaluation: {
                    type: 'object',
                    properties: {
                      discussed: { type: 'boolean' },
                      optimalRRT: { type: 'string', description: '(e.g., "Transplant discussed as optimal RRT")' },
                      referralTiming: { type: 'string', description: '(e.g., "Will refer when eGFR <20")' },
                      livingDonorEducation: { type: 'string', description: '(e.g., "Brother interested in living donation")' },
                      cardiacClearance: { type: 'string', description: 'Cardiac clearance needs (e.g., "Need cardiac clearance given CAD")' }
                    },
                    description: 'CRITICAL: Transplant evaluation planning and living donor discussions'
                  }
                },
                description: 'CRITICAL: Comprehensive dialysis planning - education, access, and transplant evaluation'
              },
              depressionScreening: {
                type: 'object',
                properties: {
                  screeningTool: { type: 'string', description: 'Tool used (e.g., "PHQ-9")' },
                  score: { type: 'number', description: 'Numeric score (e.g., 14)' },
                  interpretation: { type: 'string', description: 'Score interpretation (e.g., "Moderate depression")' },
                  referral: { type: 'string', description: 'Mental health referral (e.g., "Referred to behavioral health integrated with nephrology clinic")' }
                },
                description: 'CRITICAL: Depression screening for CKD patients (common comorbidity)'
              },
              advanceDirectiveDiscussion: { type: 'string', description: 'CRITICAL: Advance directive discussion status (e.g., "Advance directive discussion initiated", "Patient tearful discussing mother\'s dialysis experience")' },
              prognosisDiscussion: { type: 'string', description: 'Complete prognosis discussion notes including patient/family emotional response' }
            },
            description: 'CRITICAL: Enhanced nephrology CKD consultation fields - progression timeline, estimated time to dialysis, dialysis planning (education/access/transplant), depression screening, advance directives'
          },

          // ========== ENHANCED GASTROENTEROLOGY IBD CONSULTATION FIELDS ==========
          ibdConsultationDetails: {
            type: 'object',
            properties: {
              mayoScore: {
                type: 'object',
                properties: {
                  stoolFrequency: { type: 'number', description: 'Score 0-3 (3 = >4 stools/day above normal)' },
                  rectalBleeding: { type: 'number', description: 'Score 0-3 (3 = mostly blood)' },
                  endoscopicFindings: { type: 'number', description: 'Score 0-3 (3 = severe with ulcerations, spontaneous bleeding)' },
                  physicianGlobalAssessment: { type: 'number', description: 'Score 0-3 (3 = severe)' },
                  totalScore: { type: 'number', description: 'Total Mayo score (sum of all components, e.g., 9-12 = severe)' },
                  interpretation: { type: 'string', description: 'Severity interpretation (e.g., "Severe", "Moderate", "Remission")' }
                },
                description: 'CRITICAL: Mayo Score for ulcerative colitis - complete breakdown with all 4 components and total'
              },
              symptomProgressionTimeline: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    week: { type: 'string', description: 'Time point (e.g., "Week 1", "Week 2", "Week 3", "Current")' },
                    bowelMovementsPerDay: { type: 'string', description: 'BM frequency (e.g., "5-6 BM/day", "12-15 BM/day")' },
                    bloodAmount: { type: 'string', description: 'Bleeding severity (e.g., "minimal blood", "moderate blood", "significant blood", "mostly blood")' }
                  }
                },
                description: 'CRITICAL: Symptom progression timeline - week-by-week deterioration pattern'
              },
              infliximabDrugMonitoring: {
                type: 'object',
                properties: {
                  troughLevel: { type: 'string', description: 'Drug level (e.g., "3.2 μg/mL")' },
                  therapeuticRange: { type: 'string', description: 'Target range (e.g., "5-10 μg/mL")' },
                  interpretation: { type: 'string', description: '(e.g., "subtherapeutic", "therapeutic", "supratherapeutic")' },
                  antibodies: { type: 'string', description: 'Antibody status (e.g., "negative", "positive", "low-level positive")' },
                  dateChecked: { type: 'string' }
                },
                description: 'CRITICAL: Infliximab drug level monitoring and antibody testing'
              },
              fecalCalprotectin: { type: 'string', description: 'CRITICAL: Fecal calprotectin value (e.g., "1850 μg/g") - marker of intestinal inflammation' },
              rescueTherapyOptions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    therapy: { type: 'string', description: 'Rescue option (e.g., "Cyclosporine 2-4mg/kg IV", "Tofacitinib 10mg TID induction", "Vedolizumab loading")' },
                    indication: { type: 'string', description: 'When to use (e.g., "if no improvement in 5-7 days", "if steroid-refractory")' }
                  }
                },
                description: 'CRITICAL: Second-line rescue therapy options with specific dosing for acute severe colitis'
              },
              ibdCareTeam: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    role: { type: 'string', description: '(e.g., "IBD Nurse Practitioner", "IBD Clinical Pharmacist", "IBD Nutritionist", "Renal Social Worker")' },
                    credentials: { type: 'string' }
                  }
                },
                description: 'CRITICAL: IBD care team members (NP, pharmacist, dietitian, social worker)'
              },
              barriersAndPsychosocialIssues: {
                type: 'object',
                properties: {
                  workStress: { type: 'string', description: '(e.g., "Major trial next month, considering medical leave")' },
                  insurance: { type: 'string', description: 'Insurance barriers (e.g., "Prior auth for dose optimization submitted")' },
                  caregiverBurden: { type: 'string', description: '(e.g., "Husband supportive but stressed")' },
                  familyDiagnosis: { type: 'string', description: '(e.g., "Daughter recently diagnosed with IBD - family counseling recommended")' },
                  bodyImageConcerns: { type: 'string', description: '(e.g., "Related to potential ostomy", "Fear of surgery")' }
                },
                description: 'CRITICAL: Psychosocial barriers affecting treatment adherence and quality of life'
              }
            },
            description: 'CRITICAL: Enhanced IBD consultation fields - Mayo score breakdown, symptom progression timeline, drug monitoring, fecal calprotectin, rescue therapy options, IBD team, psychosocial barriers'
          },

          // ========== FLEXIBLE DATA CAPTURE ==========
          flexibleData: {
            type: 'object',
            description: 'ANY additional fields not covered above - preserves ALL document data without loss. Include any novel fields, measurements, scores, notes, or data specific to this document type',
            additionalProperties: true
          },

          // ========== RAW EXTRACTED TEXT ==========
          rawText: {
            type: 'string',
            description: 'Complete raw text of the document for future reference'
          },

          // ========== AI-GENERATED CLINICAL INSIGHTS ==========
          // These fields provide intelligent value beyond simple text extraction

          clinicalDecisionSupport: {
            type: 'object',
            properties: {
              riskAssessment: {
                type: 'object',
                properties: {
                  overallRisk: { type: 'string', description: 'Overall patient risk level (Low/Moderate/High/Critical)' },
                  riskFactors: { type: 'array', items: { type: 'object', properties: {
                    factor: { type: 'string' },
                    severity: { type: 'string' },
                    evidence: { type: 'string' }
                  }}},
                  mitigatingFactors: { type: 'array', items: { type: 'string' } }
                }
              },
              redFlags: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    finding: { type: 'string' },
                    urgency: { type: 'string', enum: ['Immediate', 'Urgent', 'Monitor'] },
                    action: { type: 'string' },
                    timeframe: { type: 'string' }
                  }
                }
              },
              drugInteractions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medications: { type: 'array', items: { type: 'string' } },
                    severity: { type: 'string', enum: ['Major', 'Moderate', 'Minor'] },
                    mechanism: { type: 'string' },
                    clinicalEffect: { type: 'string' },
                    recommendation: { type: 'string' }
                  }
                }
              },
              contraindications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    condition: { type: 'string' },
                    severity: { type: 'string' },
                    alternative: { type: 'string' }
                  }
                }
              }
            },
            description: 'AI-generated clinical decision support including risk assessment, red flags, drug interactions, and contraindications'
          },

          intelligentRecommendations: {
            type: 'object',
            properties: {
              immediate: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    action: { type: 'string' },
                    rationale: { type: 'string' },
                    priority: { type: 'string', enum: ['Critical', 'High', 'Medium'] },
                    evidence: { type: 'string' },
                    successMetrics: {
                      type: 'object',
                      description: 'CRITICAL: Define clear metrics for treatment success (e.g., "ACT score ≥20", "FeNO <25 ppb", "FEV1 >80%")',
                      properties: {
                        primaryMetric: { type: 'string', description: 'Main outcome measure (e.g., "ACT score ≥20 within 3 months")' },
                        secondaryMetrics: { type: 'array', items: { type: 'string' }, description: 'Additional success indicators (e.g., "FeNO <25 ppb", "No rescue inhaler use", "No exacerbations")' },
                        assessmentMethod: { type: 'string', description: 'How success will be measured (e.g., "Monthly ACT questionnaire", "Spirometry at 3-month follow-up")' },
                        targetDate: { type: 'string', description: 'When to assess success (e.g., "Month 3", "2025-04-26")' }
                      }
                    },
                    backupOptions: {
                      type: 'array',
                      description: 'CRITICAL: Specify backup treatment options if primary recommendation fails (e.g., alternative biologics: Mepolizumab, Benralizumab, Tezepelumab)',
                      items: {
                        type: 'object',
                        properties: {
                          option: { type: 'string', description: 'Alternative treatment (e.g., "Mepolizumab if Dupilumab ineffective")' },
                          indication: { type: 'string', description: 'When to consider this option (e.g., "If ACT <20 after 3 months on Dupilumab", "If eosinophils remain >300")' },
                          mechanism: { type: 'string', description: 'Why this alternative works (e.g., "Anti-IL-5, targets eosinophils directly")' }
                        }
                      }
                    }
                  }
                }
              },
              shortTerm: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    action: { type: 'string' },
                    timeframe: { type: 'string' },
                    rationale: { type: 'string' },
                    expectedOutcome: { type: 'string' },
                    successMetrics: {
                      type: 'object',
                      properties: {
                        metrics: { type: 'array', items: { type: 'string' }, description: 'Measurable outcomes (e.g., "Venom-specific IgE >0.35 confirms allergy", "Safe aspirin challenge = no respiratory reaction")' },
                        assessmentTiming: { type: 'string' }
                      }
                    }
                  }
                }
              },
              longTerm: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    goal: { type: 'string' },
                    interventions: { type: 'array', items: { type: 'string' } },
                    timeline: { type: 'string' },
                    successMetrics: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'CRITICAL: Quantitative success criteria (e.g., "FEV1 >80% predicted", "ACT ≥20", "FeNO <25 ppb", "Zero exacerbations per year")'
                    },
                    backupPlan: {
                      type: 'string',
                      description: 'What to do if long-term goal not achieved (e.g., "Consider alternative biologic or add-on therapy")'
                    }
                  }
                }
              },
              preventive: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    screening: { type: 'string' },
                    dueDate: { type: 'string' },
                    indication: { type: 'string' },
                    guidelines: { type: 'string' }
                  }
                }
              },
              psychoBehavioralSupport: {
                type: 'array',
                description: 'CRITICAL: Include psycho-behavioral support - chronic allergy/asthma strongly correlate with anxiety, which worsens symptoms',
                items: {
                  type: 'object',
                  properties: {
                    concern: { type: 'string', description: 'Mental health concern identified (e.g., "Anxiety about anaphylaxis affecting quality of life", "Asthma-related anxiety worsening symptoms")' },
                    recommendation: { type: 'string', description: 'Specific intervention (e.g., "Psychology referral for CBT", "Anxiety management techniques", "Support group for food allergy families")' },
                    rationale: { type: 'string', description: 'Why this matters (e.g., "Anxiety increases perceived dyspnea and asthma symptoms", "Fear of anaphylaxis causes social isolation")' },
                    priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
                    expectedOutcome: { type: 'string', description: 'What success looks like (e.g., "Reduced anxiety scores", "Improved medication adherence", "Better quality of life")' }
                  }
                }
              }
            },
            description: 'RESEARCH-GRADE AI recommendations with quantitative success metrics, backup treatment options, and psycho-behavioral support integration'
          },

          trendingAnalysis: {
            type: 'object',
            properties: {
              vitalSignsTrends: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    parameter: { type: 'string' },
                    trend: { type: 'string', enum: ['Improving', 'Stable', 'Worsening', 'Declining', 'Elevated', 'Fluctuating'] },
                    values: { type: 'array', items: { type: 'object', properties: {
                      date: { type: 'string' },
                      value: { type: 'string' }
                    }}},
                    latestValue: { type: 'string', description: 'Most recent value with context (e.g., "95% RA", "20/min")' },
                    interpretation: { type: 'string' },
                    clinicalSignificance: { type: 'string' },
                    monitoringThreshold: { type: 'string', description: 'CRITICAL: Quantified threshold for intervention (e.g., "O2 sat <92% on exertion", "RR >24/min at rest", "BP >140/90")' },
                    actionNeeded: { type: 'string', description: 'Specific intervention required' },
                    priority: { type: 'string', enum: ['Immediate', 'Urgent', 'Routine'], description: 'Action priority level' },
                    reassessmentTimeline: { type: 'string', description: 'When to recheck (e.g., "Daily", "Weekly", "At 3-month follow-up")' }
                  }
                }
              },
              labTrends: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    test: { type: 'string' },
                    trend: { type: 'string', enum: ['Improving', 'Stable', 'Declining', 'Elevated', 'Markedly elevated'] },
                    values: { type: 'array', items: { type: 'object', properties: {
                      date: { type: 'string' },
                      value: { type: 'string' },
                      flag: { type: 'string', enum: ['Low', 'Normal', 'High', 'Critical'] }
                    }}},
                    latestValue: { type: 'string', description: 'Most recent value with flag (e.g., "68 ppb (High)", "985 cells/μL (High)")' },
                    interpretation: { type: 'string' },
                    actionNeeded: { type: 'string' },
                    priority: { type: 'string', enum: ['Immediate', 'Urgent', 'Routine'], description: 'Action priority level' },
                    targetValue: { type: 'string', description: 'CRITICAL: Goal value with timeline (e.g., "FeNO <25 ppb at 3 months", "Eosinophils <500 at 6 months")' },
                    reassessmentTimeline: { type: 'string', description: 'When to recheck (e.g., "Monthly", "At 3 months", "With each biologic injection")' }
                  }
                }
              },
              diseaseProgression: {
                type: 'object',
                properties: {
                  trajectory: { type: 'string', enum: ['Improved', 'Stable', 'Progressive', 'Acute exacerbation'] },
                  timeline: { type: 'string' },
                  keyEvents: { type: 'array', items: { type: 'object', properties: {
                    date: { type: 'string' },
                    event: { type: 'string' },
                    impact: { type: 'string' }
                  }}},
                  prognosis: { type: 'string' }
                }
              }
            },
            description: 'AI-generated trending and pattern analysis of vital signs, labs, and disease progression over time'
          },

          patientSpecificCarePlan: {
            type: 'object',
            properties: {
              tailoredInterventions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    intervention: { type: 'string' },
                    personalizationFactors: { type: 'array', items: { type: 'string' } },
                    barriers: { type: 'array', items: { type: 'string' } },
                    enablers: { type: 'array', items: { type: 'string' } },
                    adherenceStrategy: { type: 'string' },
                    outcomeMetrics: {
                      type: 'object',
                      description: 'CRITICAL: Define quantifiable success metrics for this intervention (research-grade precision)',
                      properties: {
                        primaryOutcome: { type: 'string', description: 'Main measurable outcome (e.g., "Reduce exacerbations by 50% within 3 months", "ACT score ≥20", "Zero anaphylaxis episodes")' },
                        secondaryOutcomes: { type: 'array', items: { type: 'string' }, description: 'Additional measurable outcomes (e.g., "Improve FEV1 to ≥80%", "Reduce work absences by 75%", "PHQ-9 score <10")' },
                        assessmentMethod: { type: 'string', description: 'How to measure success (e.g., "Monthly ACT score", "Spirometry at 3 months", "Anxiety scale at follow-up")' },
                        targetDate: { type: 'string', description: 'When to achieve this outcome (e.g., "3 months", "2025-04-26")' }
                      }
                    }
                  }
                }
              },
              lifestyleModifications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    domain: { type: 'string', description: 'Diet, Exercise, Stress, Sleep, etc.' },
                    currentStatus: { type: 'string' },
                    recommendation: { type: 'string' },
                    patientContext: { type: 'string', description: 'Why this recommendation fits this patient' },
                    feasibility: { type: 'string' },
                    expectedBenefit: { type: 'string' },
                    outcomeMetrics: {
                      type: 'object',
                      description: 'CRITICAL: Quantifiable metrics for lifestyle change success',
                      properties: {
                        primaryOutcome: { type: 'string', description: 'Main measurable outcome (e.g., "Improve sleep efficiency to ≥85%", "Exercise 3x/week without symptoms")' },
                        assessmentMethod: { type: 'string', description: 'How to measure (e.g., "Sleep diary", "Exercise log with symptom tracking")' },
                        targetDate: { type: 'string' }
                      }
                    }
                  }
                }
              },
              comorbidityManagement: {
                type: 'object',
                properties: {
                  interactions: { type: 'array', items: { type: 'string' } },
                  prioritization: { type: 'string' },
                  integratedApproach: { type: 'string' }
                }
              }
            },
            description: 'AI-generated patient-specific care plan tailored to occupation, lifestyle, and personal barriers with quantifiable outcome metrics'
          },

          medicationsOptimizations: {
            type: 'object',
            description: 'AI-generated optimization for CURRENT medications - comprehensive analysis including cost, interactions, dosing, adherence, and monitoring',
            properties: {
              costAnalysis: {
                type: 'array',
                description: 'Cost-benefit analysis for each CURRENT medication',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string', description: 'Current medication patient is taking' },
                    estimatedCost: { type: 'string' },
                    alternatives: { type: 'array', items: { type: 'object', properties: {
                      name: { type: 'string' },
                      cost: { type: 'string' },
                      safetyCheck: { type: 'string', description: 'Safety verification: allergies, interactions, contraindications' },
                      efficacyComparison: { type: 'string' },
                      clinicalBenefitScore: {
                        type: 'object',
                        description: 'Clinical benefit score for this alternative (0-10 scale)',
                        properties: {
                          score: { type: 'number', description: 'Overall score 0-10' },
                          efficacy: { type: 'number', description: 'Efficacy score 0-10' },
                          safety: { type: 'number', description: 'Safety score 0-10' },
                          rationale: { type: 'string', description: 'Explanation of score' }
                        }
                      }
                    }}},
                    insuranceCoverage: { type: 'string' }
                  }
                }
              },
              adherenceRisk: {
                type: 'object',
                properties: {
                  riskLevel: { type: 'string', enum: ['Low', 'Moderate', 'High'] },
                  riskFactors: { type: 'array', items: { type: 'string' } },
                  mitigationStrategies: { type: 'array', items: { type: 'string' } }
                }
              },
              simplificationOpportunities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    current: { type: 'string' },
                    proposed: { type: 'string' },
                    benefit: { type: 'string' },
                    considerations: { type: 'string' }
                  }
                }
              },
              optimizationOpportunities: {
                type: 'array',
                description: 'General medication optimization opportunities not captured in other categories',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string', description: 'Medication being optimized' },
                    opportunity: { type: 'string', description: 'Description of optimization opportunity' },
                    rationale: { type: 'string', description: 'Why this optimization is recommended' },
                    expectedBenefit: { type: 'string', description: 'Expected benefit from optimization' }
                  }
                }
              },
              drugInteractions: {
                type: 'array',
                description: 'Clinically significant drug-drug interactions among current medications',
                items: {
                  type: 'object',
                  properties: {
                    medications: { type: 'array', items: { type: 'string' }, description: 'Medications involved in interaction' },
                    interaction: { type: 'string', description: 'Description of interaction' },
                    severity: { type: 'string', enum: ['Minor', 'Moderate', 'Major', 'Severe'], description: 'Severity of interaction' },
                    clinicalEffect: { type: 'string', description: 'Clinical effect of interaction (e.g., increased bleeding risk, reduced efficacy)' },
                    recommendation: { type: 'string', description: 'Recommendation to manage interaction' }
                  }
                }
              },
              dosingRecommendations: {
                type: 'array',
                description: 'Dosing adjustments or recommendations based on patient factors',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string', description: 'Medication requiring dosing adjustment' },
                    currentDose: { type: 'string', description: 'Current dose if specified' },
                    recommendedDose: { type: 'string', description: 'Recommended dose adjustment' },
                    reason: { type: 'string', description: 'Reason for adjustment (e.g., renal impairment, drug interaction, therapeutic range)' },
                    monitoring: { type: 'string', description: 'Required monitoring for dose adjustment' }
                  }
                }
              },
              costOptimization: {
                type: 'array',
                description: 'Specific cost-saving opportunities without compromising efficacy',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string', description: 'Expensive medication' },
                    alternative: { type: 'string', description: 'Cost-effective alternative' },
                    potentialSavings: { type: 'string', description: 'Estimated cost savings' },
                    efficacyEquivalence: { type: 'string', description: 'Evidence that alternative has equivalent efficacy' },
                    considerations: { type: 'string', description: 'Important considerations for switching' }
                  }
                }
              },
              therapeuticAlternatives: {
                type: 'array',
                description: 'Alternative medications or therapeutic approaches',
                items: {
                  type: 'object',
                  properties: {
                    currentMedication: { type: 'string', description: 'Current medication' },
                    alternative: { type: 'string', description: 'Therapeutic alternative' },
                    advantage: { type: 'string', description: 'Advantage of alternative (e.g., fewer side effects, better efficacy)' },
                    considerations: { type: 'string', description: 'Considerations for switching' }
                  }
                }
              },
              duplicateTherapies: {
                type: 'array',
                description: 'Medications with overlapping or duplicate therapeutic effects',
                items: {
                  type: 'object',
                  properties: {
                    medications: { type: 'array', items: { type: 'string' }, description: 'Medications with duplicate therapy' },
                    overlap: { type: 'string', description: 'Description of therapeutic overlap' },
                    recommendation: { type: 'string', description: 'Recommendation to resolve duplication' },
                    rationale: { type: 'string', description: 'Why this recommendation is appropriate' }
                  }
                }
              },
              adherenceIssues: {
                type: 'array',
                description: 'Specific adherence challenges identified in current medication regimen',
                items: {
                  type: 'object',
                  properties: {
                    issue: { type: 'string', description: 'Adherence issue identified (e.g., complex dosing schedule, multiple daily doses)' },
                    affectedMedications: { type: 'array', items: { type: 'string' }, description: 'Medications affected by this issue' },
                    impact: { type: 'string', description: 'Impact on patient adherence' },
                    solution: { type: 'string', description: 'Proposed solution to improve adherence' }
                  }
                }
              },
              monitoringRecommendations: {
                type: 'array',
                description: 'Laboratory or clinical monitoring recommendations for current medications',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string', description: 'Medication requiring monitoring' },
                    parameter: { type: 'string', description: 'Parameter to monitor (e.g., INR, renal function, liver function)' },
                    frequency: { type: 'string', description: 'Recommended monitoring frequency' },
                    rationale: { type: 'string', description: 'Reason for monitoring' },
                    targetRange: { type: 'string', description: 'Target range or goal if applicable' }
                  }
                }
              }
            },
            description: 'AI-generated optimization for CURRENT medications - comprehensive analysis including cost, interactions, dosing, adherence, and monitoring'
          },

          doctorsMedicationsRecommendationsOptimizations: {
            type: 'object',
            description: 'AI-generated optimization for DOCTOR-RECOMMENDED medications - cost analysis, adherence risk, and simplification',
            properties: {
              costAnalysis: {
                type: 'array',
                description: 'Enhanced cost-benefit analysis with value metrics for each DOCTOR-RECOMMENDED medication',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string', description: 'Doctor-recommended medication (not yet started)' },
                    estimatedCost: { type: 'string' },
                    conditionsTreated: { type: 'array', items: { type: 'string' }, description: 'List of conditions this medication treats (e.g., ["asthma", "rhinosinusitis", "eczema"])' },
                    costPerCondition: { type: 'string', description: 'Calculated cost per condition treated (total cost / number of conditions)' },
                    qualityOfLifeMetrics: {
                      type: 'object',
                      description: 'Expected quality-of-life improvements with this medication',
                      properties: {
                        exacerbationReduction: { type: 'string', description: 'Expected reduction in disease exacerbations (e.g., "50-70% reduction")' },
                        symptomControl: { type: 'string', description: 'Expected symptom control improvement (e.g., "Daily symptoms reduced to minimal")' },
                        workProductivity: { type: 'string', description: 'Impact on work/school attendance (e.g., "Fewer absences, improved performance")' },
                        sleepQuality: { type: 'string', description: 'Impact on sleep (e.g., "No more nighttime awakenings")' },
                        exerciseTolerance: { type: 'string', description: 'Impact on physical activity' }
                      }
                    },
                    guidelineSupport: {
                      type: 'array',
                      description: 'Clinical guidelines that support this medication choice',
                      items: {
                        type: 'object',
                        properties: {
                          guideline: { type: 'string', description: 'Guideline name (e.g., "GINA 2024 Guidelines")' },
                          criteria: { type: 'array', items: { type: 'string' }, description: 'Specific criteria patient meets (e.g., "Eosinophils >300", "FeNO >25 ppb")' },
                          recommendation: { type: 'string', description: 'Guideline recommendation (e.g., "Dupilumab STRONGLY INDICATED per GINA 2024 Step 5")' }
                        }
                      }
                    },
                    clinicalBenefitScore: {
                      type: 'object',
                      description: 'Overall clinical benefit score (0-10 scale)',
                      properties: {
                        score: { type: 'number', description: 'Overall score 0-10' },
                        efficacy: { type: 'number', description: 'Efficacy score 0-10' },
                        safety: { type: 'number', description: 'Safety score 0-10' },
                        convenience: { type: 'number', description: 'Convenience score 0-10' },
                        patientFit: { type: 'number', description: 'Patient-specific fit score 0-10' },
                        rationale: { type: 'string', description: 'Explanation of score' }
                      }
                    },
                    alternatives: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          cost: { type: 'string' },
                          conditionsTreated: { type: 'array', items: { type: 'string' } },
                          costPerCondition: { type: 'string' },
                          qualityOfLifeMetrics: {
                            type: 'object',
                            properties: {
                              exacerbationReduction: { type: 'string' },
                              symptomControl: { type: 'string' },
                              workProductivity: { type: 'string' }
                            }
                          },
                          clinicalBenefitScore: {
                            type: 'object',
                            properties: {
                              score: { type: 'number' },
                              efficacy: { type: 'number' },
                              safety: { type: 'number' },
                              rationale: { type: 'string' }
                            }
                          },
                          safetyCheck: { type: 'string', description: 'Safety verification: allergies, interactions, contraindications' },
                          efficacyComparison: { type: 'string' }
                        }
                      }
                    },
                    insuranceCoverage: { type: 'string' },
                    valueAssessment: {
                      type: 'string',
                      description: 'Overall value assessment comparing cost, efficacy, safety, and patient fit'
                    }
                  }
                }
              },
              adherenceRisk: {
                type: 'object',
                properties: {
                  riskLevel: { type: 'string', enum: ['Low', 'Moderate', 'High'] },
                  riskFactors: { type: 'array', items: { type: 'string' } },
                  mitigationStrategies: { type: 'array', items: { type: 'string' } }
                }
              },
              simplificationOpportunities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    current: { type: 'string' },
                    proposed: { type: 'string' },
                    benefit: { type: 'string' },
                    considerations: { type: 'string' }
                  }
                }
              }
            },
            description: 'AI-generated optimization for DOCTOR-RECOMMENDED medications (not current meds) - cost analysis and alternatives'
          },

          followUpIntelligence: {
            type: 'object',
            properties: {
              deadlines: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    item: { type: 'string' },
                    dueDate: { type: 'string' },
                    criticality: { type: 'string', enum: ['Critical', 'Important', 'Routine'] },
                    consequences: { type: 'string', description: 'What happens if missed' },
                    autoSchedule: { type: 'boolean' },
                    successMetrics: {
                      type: 'object',
                      description: 'CRITICAL: Define quantitative success metrics for this deadline/task',
                      properties: {
                        primaryMetric: { type: 'string', description: 'Main outcome to measure (e.g., "ACT score", "FeNO level", "exacerbation frequency")' },
                        baselineValue: { type: 'string', description: 'Current/baseline value (e.g., "ACT score 12", "FeNO 75 ppb")' },
                        targetValue: { type: 'string', description: 'Target value to achieve (e.g., "ACT score ≥20", "FeNO <25 ppb", "reduce FeNO by ≥30%")' },
                        targetDate: { type: 'string', description: 'When target should be achieved (e.g., "Month 3", "2025-04-26")' },
                        secondaryMetrics: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              metric: { type: 'string', description: 'Secondary outcome (e.g., "rescue inhaler use", "nighttime awakenings", "FEV1")' },
                              baseline: { type: 'string' },
                              target: { type: 'string' }
                            }
                          }
                        },
                        outcomeAssessment: { type: 'string', description: 'How success will be evaluated (e.g., "Repeat spirometry and FeNO at 3-month visit", "Weekly ACT questionnaire")' }
                      }
                    }
                  }
                }
              },
              prioritization: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    priority: { type: 'number' },
                    task: { type: 'string' },
                    urgency: { type: 'string' },
                    importance: { type: 'string' },
                    dependencies: { type: 'array', items: { type: 'string' } },
                    successMetrics: {
                      type: 'object',
                      description: 'Define measurable success criteria for this priority task',
                      properties: {
                        expectedOutcome: { type: 'string', description: 'What success looks like (e.g., "Prior authorization approved", "Patient demonstrates correct EpiPen technique")' },
                        measurableIndicator: { type: 'string', description: 'How to verify success (e.g., "Insurance approval letter received", "Return demonstration with 100% accuracy")' },
                        completionCriteria: { type: 'string', description: 'Specific criteria that indicate task completion' }
                      }
                    }
                  }
                }
              },
              coordinationNeeds: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    specialist: { type: 'string' },
                    reason: { type: 'string' },
                    urgency: { type: 'string' },
                    informationNeeded: { type: 'array', items: { type: 'string' } },
                    expectedOutcome: { type: 'string', description: 'What the specialist consultation should achieve (e.g., "Optimize GERD management to improve asthma control", "Rule out vocal cord dysfunction")' }
                  }
                }
              },
              overallTreatmentGoals: {
                type: 'object',
                description: 'CRITICAL: Define comprehensive quantitative treatment goals across all aspects of care',
                properties: {
                  primaryGoal: { type: 'string', description: 'Main treatment objective (e.g., "Achieve asthma control with biologic therapy")' },
                  quantitativeTargets: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        parameter: { type: 'string', description: 'What to measure (e.g., "ACT score", "exacerbation rate", "FEV1", "FeNO", "rescue inhaler use")' },
                        currentValue: { type: 'string', description: 'Baseline measurement' },
                        targetValue: { type: 'string', description: 'Goal measurement with specific threshold' },
                        timeframe: { type: 'string', description: 'When to achieve target (e.g., "Month 3", "Month 6", "Month 12")' },
                        assessmentMethod: { type: 'string', description: 'How to measure (e.g., "Monthly ACT questionnaire", "Spirometry at follow-up visits")' }
                      },
                      required: ['parameter', 'targetValue', 'timeframe']
                    }
                  },
                  adaptationCriteria: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        trigger: { type: 'string', description: 'What change triggers plan adaptation (e.g., "If ACT score does not improve to ≥20 by Month 3", "If FeNO reduction <20%")' },
                        response: { type: 'string', description: 'What to do if trigger occurs (e.g., "Consider dose increase or alternative biologic", "Add leukotriene modifier")' }
                      }
                    },
                    description: 'Self-correcting logic: what to do if targets are not met'
                  }
                }
              }
            },
            description: 'AI-generated follow-up tracking with intelligent deadline management, auto-scheduling, prioritization, and QUANTITATIVE SUCCESS METRICS for true decision-support intelligence'
          },

          patientEducationContext: {
            type: 'object',
            properties: {
              conditionExplanation: {
                type: 'object',
                properties: {
                  simplifiedSummary: { type: 'string' },
                  keyPoints: { type: 'array', items: { type: 'string' } },
                  whatToExpect: { type: 'string' },
                  warningSignsToWatch: { type: 'array', items: { type: 'string' } }
                }
              },
              medicationInstructions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    purpose: { type: 'string' },
                    howToTake: { type: 'string' },
                    commonSideEffects: { type: 'array', items: { type: 'string' } },
                    whenToCallDoctor: { type: 'array', items: { type: 'string' } }
                  }
                }
              },
              lifestyleGuidance: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    topic: { type: 'string' },
                    recommendation: { type: 'string' },
                    reasoning: { type: 'string' },
                    practicalTips: { type: 'array', items: { type: 'string' } }
                  }
                }
              },
              resources: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', description: 'Educational material, support group, app, etc.' },
                    name: { type: 'string' },
                    purpose: { type: 'string' },
                    relevance: { type: 'string' }
                  }
                }
              }
            },
            description: 'AI-generated patient education materials with context-aware explanations, medication instructions, and personalized guidance'
          },

          guidelineCompliance: {
            type: 'object',
            properties: {
              guidelines: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    guidelineName: { type: 'string', description: 'Full name of the medical guideline (e.g., "GINA 2024 Guidelines for Severe Asthma Management", "2019 AHA/ACC/HRS Guideline for Management of Atrial Fibrillation")' },
                    compliance: { type: 'string', enum: ['Compliant', 'Partial', 'Non-compliant'], description: 'Level of adherence to this guideline' },
                    gaps: { type: 'array', items: { type: 'string' }, description: 'Specific gaps or deviations from guideline recommendations' },
                    recommendations: { type: 'array', items: { type: 'string' }, description: 'Specific actions that were or should be taken per guideline' },
                    priority: {
                      type: 'string',
                      enum: ['Low', 'Medium', 'High'],
                      description: 'CRITICAL PRIORITY LOGIC: Low = Fully compliant with no gaps; Medium = Partial compliance (deferred actions with valid clinical reasoning); High = Non-compliant or urgent gaps requiring immediate action. IMPORTANT: Partial compliance should be "Medium" priority if there is future risk, NOT "Low".'
                    },
                    quantitativeMonitoring: {
                      type: 'object',
                      description: 'CRITICAL: Add quantitative markers for monitoring guideline adherence (e.g., "FEV1 baseline 72%, goal ≥80% after 3 months")',
                      properties: {
                        parameter: { type: 'string', description: 'What to measure (e.g., "FEV1", "ACT score", "Blood pressure", "HbA1c")' },
                        baselineValue: { type: 'string', description: 'Current/baseline measurement' },
                        targetValue: { type: 'string', description: 'Guideline-recommended target' },
                        currentStatus: { type: 'string', description: 'Whether currently meeting guideline target (e.g., "Above target", "Below target", "At target")' },
                        nextAssessment: { type: 'string', description: 'When next measurement is due (e.g., "3 months", "2025-04-26")' }
                      }
                    },
                    patientReportedOutcomes: {
                      type: 'object',
                      description: 'CRITICAL: Include patient-reported outcome measures per guideline (e.g., ACT score, quality-of-life index, symptom diary)',
                      properties: {
                        outcomeMeasure: { type: 'string', description: 'Name of PRO tool (e.g., "Asthma Control Test (ACT)", "SF-36 Quality of Life", "PHQ-9 Depression Scale")' },
                        currentScore: { type: 'string', description: 'Current score/rating' },
                        guidelineTarget: { type: 'string', description: 'Guideline-recommended target score' },
                        interpretation: { type: 'string', description: 'What the current score means (e.g., "ACT 12 indicates poorly controlled asthma")' },
                        frequency: { type: 'string', description: 'How often to assess (e.g., "Monthly", "Every visit", "Quarterly")' }
                      }
                    },
                    clinicalRationale: {
                      type: 'string',
                      description: 'IMPORTANT: For partial compliance, explain the clinical reasoning for deferring actions (e.g., "Oral immunotherapy deferred until asthma control achieved - appropriate per safety guidelines")'
                    }
                  },
                  required: ['guidelineName', 'compliance', 'recommendations', 'priority']
                }
              }
            },
            description: 'AI-generated guideline compliance analysis with QUANTITATIVE MONITORING MARKERS and PATIENT-REPORTED OUTCOMES for complete quality assurance'
          },

          addictionMedicineData: {
            type: 'object',
            properties: {
              substanceUseHistory: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    substance: { type: 'string', description: 'Substance name' },
                    ageOfFirstUse: { type: 'string' },
                    duration: { type: 'string' },
                    route: { type: 'string' },
                    frequency: { type: 'string' },
                    amount: { type: 'string' },
                    lastUse: { type: 'string' },
                    attemptsToQuit: { type: 'number' },
                    longestSobriety: { type: 'string' }
                  }
                }
              },
              withdrawalAssessment: {
                type: 'object',
                properties: {
                  symptoms: { type: 'array', items: { type: 'string' } },
                  severity: { type: 'string', enum: ['Mild', 'Moderate', 'Severe'] },
                  cowsScore: { type: 'number' },
                  ciwaScore: { type: 'number' },
                  timeSinceLastUse: { type: 'string' },
                  managementPlan: { type: 'string' }
                }
              },
              medicationAssistedTreatment: {
                type: 'object',
                properties: {
                  medication: { type: 'string' },
                  inductionDate: { type: 'string' },
                  inductionDose: { type: 'string' },
                  currentDose: { type: 'string' },
                  dosingSchedule: { type: 'string' },
                  responseToTreatment: { type: 'string' },
                  sideEffects: { type: 'array', items: { type: 'string' } },
                  titrationPlan: { type: 'string' },
                  prescribingProvider: { type: 'string' },
                  pharmacyDispensing: { type: 'string' }
                }
              },
              urineDrugScreening: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string' },
                    results: {
                      type: 'object',
                      properties: {
                        buprenorphine: { type: 'string' },
                        opiates: { type: 'string' },
                        fentanyl: { type: 'string' },
                        cocaine: { type: 'string' },
                        amphetamines: { type: 'string' },
                        benzodiazepines: { type: 'string' },
                        thc: { type: 'string' },
                        alcohol: { type: 'string' }
                      }
                    },
                    interpretation: { type: 'string' }
                  }
                }
              },
              relapsePrevention: {
                type: 'object',
                properties: {
                  triggers: { type: 'array', items: { type: 'string' } },
                  copingStrategies: { type: 'array', items: { type: 'string' } },
                  supportSystem: { type: 'array', items: { type: 'string' } },
                  relapsePlan: { type: 'string' },
                  emergencyContacts: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, relationship: { type: 'string' } } } }
                }
              },
              recoveryPrograms: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    programType: { type: 'string' },
                    frequency: { type: 'string' },
                    startDate: { type: 'string' },
                    attendance: { type: 'string' },
                    counselor: { type: 'string' }
                  }
                }
              },
              harmReductionCounseling: {
                type: 'object',
                properties: {
                  naloxoneProvided: { type: 'boolean' },
                  naloxoneTraining: { type: 'boolean' },
                  safeInjectionPractices: { type: 'boolean' },
                  fentanylTestStrips: { type: 'boolean' },
                  needleExchange: { type: 'boolean' }
                }
              },
              psychiatricComorbidities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    diagnosis: { type: 'string' },
                    treatment: { type: 'string' },
                    impactOnRecovery: { type: 'string' }
                  }
                }
              },
              socialDeterminants: {
                type: 'object',
                properties: {
                  housingStatus: { type: 'string' },
                  employment: { type: 'string' },
                  legalIssues: { type: 'string' },
                  insurance: { type: 'string' },
                  transportation: { type: 'string' },
                  childCustody: { type: 'string' }
                }
              },
              treatmentPlan: {
                type: 'object',
                properties: {
                  goals: { type: 'array', items: { type: 'string' } },
                  frequencyOfVisits: { type: 'string' },
                  udsTesting: { type: 'string' },
                  counseling: { type: 'string' },
                  referrals: { type: 'array', items: { type: 'string' } }
                }
              },
              prognosis: {
                type: 'object',
                properties: {
                  shortTerm: { type: 'string' },
                  longTerm: { type: 'string' },
                  prognosticFactors: {
                    type: 'object',
                    properties: {
                      positive: { type: 'array', items: { type: 'string' } },
                      negative: { type: 'array', items: { type: 'string' } }
                    }
                  }
                }
              }
            },
            description: 'Addiction medicine consultation data'
          },

          brainTumorMolecularMarkers: {
            type: 'object',
            properties: {
              tumorType: {
                type: 'string',
                description: 'Tumor histology (e.g., "Glioblastoma", "Astrocytoma", "Oligodendroglioma", "Ependymoma")'
              },
              whoGrade: {
                type: 'string',
                description: 'WHO grade (Grade 1, 2, 3, 4) - now integrated with molecular features'
              },
              molecularClassification: {
                type: 'string',
                description: 'WHO 2021 integrated diagnosis combining histology + molecular features (e.g., "Astrocytoma, IDH-mutant, Grade 2", "Glioblastoma, IDH-wildtype")'
              },
              idhStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether IDH testing was performed' },
                  result: { type: 'string', enum: ['IDH1-mutant', 'IDH2-mutant', 'IDH-wildtype', 'Not tested'], description: 'IDH mutation status' },
                  specificMutation: { type: 'string', description: 'Specific mutation if known (e.g., "IDH1 R132H" - most common)' },
                  method: { type: 'string', description: 'Testing method (IHC, sequencing, PCR)' },
                  prognosticImplication: { type: 'string', description: 'Clinical significance (IDH-mutant = better prognosis, younger patients, better chemo response)' }
                },
                description: 'IDH1/IDH2 mutation status - CRITICAL prognostic marker'
              },
              mgmtStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether MGMT testing was performed' },
                  result: { type: 'string', enum: ['Methylated', 'Unmethylated', 'Indeterminate', 'Not tested'], description: 'MGMT promoter methylation status' },
                  methylationPercentage: { type: 'string', description: 'Percentage methylation if quantitative assay used' },
                  method: { type: 'string', description: 'Testing method (Pyrosequencing, MS-PCR, IHC)' },
                  therapeuticImplication: { type: 'string', description: 'Treatment impact (Methylated = better response to temozolomide chemotherapy)' }
                },
                description: 'MGMT promoter methylation - predicts temozolomide response'
              },
              codeletionStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether 1p/19q testing was performed' },
                  result: { type: 'string', enum: ['Codeleted', 'Intact', 'Not tested'], description: '1p/19q codeletion status' },
                  method: { type: 'string', description: 'Testing method (FISH, array CGH, NGS)' },
                  diagnosticImplication: { type: 'string', description: 'Clinical significance (Codeletion = oligodendroglioma, better prognosis, chemo/RT sensitive)' }
                },
                description: '1p/19q codeletion - diagnostic for oligodendroglioma'
              },
              tertPromoterStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether TERT promoter mutation tested' },
                  result: { type: 'string', enum: ['Mutant', 'Wildtype', 'Not tested'], description: 'TERT promoter mutation status' },
                  specificMutation: { type: 'string', description: 'Specific mutation (C228T or C250T)' },
                  prognosticImplication: { type: 'string', description: 'Clinical significance (mutation in IDH-wildtype GBM = poor prognosis)' }
                },
                description: 'TERT promoter mutation status'
              },
              atrxStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether ATRX loss tested' },
                  result: { type: 'string', enum: ['Loss', 'Retained', 'Not tested'], description: 'ATRX expression status' },
                  method: { type: 'string', description: 'Testing method (IHC)' },
                  diagnosticImplication: { type: 'string', description: 'Clinical significance (Loss associated with IDH-mutant astrocytoma, exclusive with 1p/19q codeletion)' }
                },
                description: 'ATRX expression - helps distinguish astrocytoma from oligodendroglioma'
              },
              tp53Status: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether TP53 mutation tested' },
                  result: { type: 'string', enum: ['Mutant', 'Wildtype', 'Not tested'], description: 'TP53 mutation status' },
                  specificMutation: { type: 'string', description: 'Specific mutation if sequenced' },
                  diagnosticImplication: { type: 'string', description: 'Clinical significance (mutation associated with IDH-mutant astrocytoma)' }
                },
                description: 'TP53 mutation status'
              },
              ki67ProliferationIndex: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether Ki-67 tested' },
                  percentage: { type: 'string', description: 'Ki-67 percentage (e.g., "15%", "30-40%")' },
                  interpretation: { type: 'string', description: 'Proliferation index interpretation (Low <10%, Intermediate 10-25%, High >25%)' },
                  prognosticImplication: { type: 'string', description: 'Higher Ki-67 = more aggressive tumor' }
                },
                description: 'Ki-67 proliferation index'
              },
              egfrStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether EGFR amplification tested' },
                  result: { type: 'string', enum: ['Amplified', 'Not amplified', 'Not tested'], description: 'EGFR amplification status' },
                  egfrvIIIMutation: { type: 'string', enum: ['Present', 'Absent', 'Not tested'], description: 'EGFRvIII mutation (constitutively active variant)' },
                  therapeuticImplication: { type: 'string', description: 'Treatment implications (common in IDH-wildtype GBM, potential targeted therapy target)' }
                },
                description: 'EGFR amplification and EGFRvIII mutation'
              },
              cdkn2aStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether CDKN2A/B homozygous deletion tested' },
                  result: { type: 'string', enum: ['Homozygous deletion', 'Intact', 'Not tested'], description: 'CDKN2A/B status' },
                  prognosticImplication: { type: 'string', description: 'Homozygous deletion in IDH-mutant astrocytoma = Grade 4 per WHO 2021' }
                },
                description: 'CDKN2A/B homozygous deletion - upgrades IDH-mutant astrocytoma to Grade 4'
              },
              brafStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether BRAF mutation/fusion tested' },
                  result: { type: 'string', description: 'BRAF status (V600E mutation, KIAA1549-BRAF fusion, wildtype)' },
                  tumorType: { type: 'string', description: 'Associated tumor type (BRAF V600E in pleomorphic xanthoastrocytoma, ganglioglioma; BRAF fusion in pilocytic astrocytoma)' },
                  therapeuticImplication: { type: 'string', description: 'Treatment options (BRAF V600E responsive to BRAF inhibitors like dabrafenib, MEK inhibitors)' }
                },
                description: 'BRAF mutation/fusion status - important in pediatric and low-grade tumors'
              },
              h3Status: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether histone H3 mutation tested' },
                  result: { type: 'string', description: 'H3 mutation status (H3 K27M, H3 G34R/V, wildtype)' },
                  location: { type: 'string', description: 'Tumor location (H3 K27M in midline/thalamus/brainstem, H3 G34 in cerebral hemispheres)' },
                  prognosticImplication: { type: 'string', description: 'H3 K27M = diffuse midline glioma, very poor prognosis, Grade 4' }
                },
                description: 'Histone H3 mutations - diagnostic for diffuse midline glioma'
              },
              ngsPanel: {
                type: 'object',
                properties: {
                  performed: { type: 'boolean', description: 'Whether NGS panel performed' },
                  panelName: { type: 'string', description: 'NGS panel used (e.g., "FoundationOne", "Tempus", "Institutional brain tumor panel")' },
                  genesAnalyzed: { type: 'number', description: 'Number of genes in panel' },
                  additionalMutations: { type: 'array', items: { type: 'string' }, description: 'Other mutations identified (PIK3CA, PTEN, NF1, etc.)' },
                  tumorMutationBurden: { type: 'string', description: 'TMB if reported (mutations/Mb)' },
                  microsatelliteStatus: { type: 'string', enum: ['MSI-H', 'MSS', 'Not tested'], description: 'Microsatellite instability status' }
                },
                description: 'Comprehensive NGS panel results'
              },
              clinicalTrialEligibility: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    molecularTarget: { type: 'string', description: 'Molecular target (e.g., "IDH1 R132H mutation", "BRAF V600E")' },
                    drugClass: { type: 'string', description: 'Drug class (IDH inhibitor, BRAF inhibitor, immunotherapy, etc.)' },
                    trialExample: { type: 'string', description: 'Example trial or drug (e.g., "Ivosidenib for IDH1-mutant glioma", "Dabrafenib for BRAF V600E")' },
                    eligibility: { type: 'string', description: 'Patient eligibility based on molecular profile' }
                  }
                },
                description: 'Clinical trial opportunities based on molecular markers'
              },
              treatmentRecommendations: {
                type: 'object',
                properties: {
                  chemotherapyGuidance: { type: 'string', description: 'Chemotherapy selection based on MGMT/IDH (e.g., "MGMT methylated - good candidate for TMZ")' },
                  radiationGuidance: { type: 'string', description: 'Radiation therapy guidance' },
                  targetedTherapy: { type: 'array', items: { type: 'string' }, description: 'Potential targeted therapies based on molecular profile' },
                  immunotherapy: { type: 'string', description: 'Immunotherapy considerations (TMB, MSI status)' },
                  prognosticCounseling: { type: 'string', description: 'Prognosis based on molecular subtype' }
                },
                description: 'Treatment recommendations based on molecular profiling'
              },
              specimen: {
                type: 'object',
                properties: {
                  specimenType: { type: 'string', description: 'Specimen type (Surgical resection, stereotactic biopsy)' },
                  specimenDate: { type: 'string', description: 'Date of tissue collection' },
                  pathologyReportDate: { type: 'string', description: 'Date molecular results reported' },
                  laboratory: { type: 'string', description: 'Laboratory performing molecular testing' },
                  tumorCellularity: { type: 'string', description: 'Tumor cellularity percentage (affects molecular testing sensitivity)' }
                },
                description: 'Specimen and testing details'
              }
            },
            description: 'EXTRACT brain tumor molecular markers for precision neuro-oncology - IDH, MGMT, 1p/19q, and comprehensive genomic profiling'
          },

          biologicTherapyRecords: {
            type: 'object',
            properties: {
              biologicAgent: {
                type: 'string',
                description: 'Biologic medication name and brand (e.g., "Dupilumab (Dupixent)", "Adalimumab (Humira)", "Infliximab (Remicade)", "Ustekinumab (Stelara)")'
              },
              indication: {
                type: 'string',
                description: 'FDA-approved indication (Atopic dermatitis, Rheumatoid arthritis, Crohn disease, Ulcerative colitis, Psoriasis, Asthma, etc.)'
              },
              mechanismOfAction: {
                type: 'string',
                description: 'Mechanism (IL-4/IL-13 inhibitor, TNF-alpha inhibitor, IL-17 inhibitor, IL-23 inhibitor, etc.)'
              },
              priorTherapies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    therapy: { type: 'string', description: 'Prior therapy name (e.g., "Topical corticosteroids", "Methotrexate", "Cyclosporine")' },
                    duration: { type: 'string', description: 'How long used' },
                    maxDose: { type: 'string', description: 'Maximum dose achieved' },
                    response: { type: 'string', enum: ['No response', 'Partial response', 'Initial response then failure', 'Intolerance'], description: 'Treatment response' },
                    reasonForDiscontinuation: { type: 'string', description: 'Why stopped (ineffective, side effects, contraindication)' }
                  }
                },
                description: 'CRITICAL: Prior failed therapies (required for insurance approval) - document inadequate response to conventional treatments'
              },
              baselineDiseaseAssessment: {
                type: 'object',
                properties: {
                  assessmentDate: { type: 'string', description: 'Date of baseline assessment (before starting biologic)' },
                  easiScore: { type: 'string', description: 'Eczema Area and Severity Index (0-72, severe ≥24)' },
                  igaScore: { type: 'string', description: 'Investigator Global Assessment (0-4, moderate-severe 3-4)' },
                  pasiScore: { type: 'string', description: 'Psoriasis Area and Severity Index (0-72, severe ≥10)' },
                  bsaPercentage: { type: 'string', description: 'Body Surface Area affected (%)' },
                  dlqiScore: { type: 'string', description: 'Dermatology Life Quality Index (0-30, severe >10)' },
                  pruritusNrsScore: { type: 'string', description: 'Pruritus Numerical Rating Scale (0-10)' },
                  das28Score: { type: 'string', description: 'Disease Activity Score 28 for RA (>5.1 = high activity)' },
                  cdaiScore: { type: 'string', description: 'Clinical Disease Activity Index' },
                  tenderJointCount: { type: 'number', description: 'Number of tender joints' },
                  swollenJointCount: { type: 'number', description: 'Number of swollen joints' },
                  harveyBradshawIndex: { type: 'string', description: 'Harvey-Bradshaw Index for Crohn disease' },
                  mayoScore: { type: 'string', description: 'Mayo score for ulcerative colitis' },
                  fecalCalprotectin: { type: 'string', description: 'Fecal calprotectin level (µg/g)' },
                  photography: { type: 'string', description: 'Baseline clinical photography obtained (Yes/No)' },
                  biomarkers: { type: 'array', items: { type: 'object', properties: { biomarker: { type: 'string' }, value: { type: 'string' } } }, description: 'Baseline inflammatory markers (CRP, ESR, IgE, eosinophils)' }
                },
                description: 'Baseline disease severity assessment with validated scoring systems'
              },
              biologicAdministrationPlan: {
                type: 'object',
                properties: {
                  loadingDose: { type: 'string', description: 'Loading dose regimen (e.g., "600mg SC on day 1", "5mg/kg IV weeks 0, 2, 6")' },
                  maintenanceDose: { type: 'string', description: 'Maintenance dose (e.g., "300mg SC every 2 weeks", "40mg SC every 2 weeks")' },
                  route: { type: 'string', enum: ['Subcutaneous', 'Intravenous', 'Intramuscular'], description: 'Route of administration' },
                  frequency: { type: 'string', description: 'Dosing frequency (weekly, every 2 weeks, every 4 weeks, every 8 weeks)' },
                  administrationSetting: { type: 'string', description: 'Where administered (Self-injection at home, Infusion center, Office injection)' },
                  durationOfTherapy: { type: 'string', description: 'Expected duration or indefinite' }
                },
                description: 'Biologic dosing and administration plan'
              },
              firstDoseAdministration: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'Date of first dose' },
                  location: { type: 'string', description: 'Where administered (clinic, home, infusion center)' },
                  dose: { type: 'string', description: 'Dose given' },
                  tolerability: { type: 'string', description: 'How patient tolerated (no reaction, mild injection site reaction, etc.)' },
                  injectionSiteReaction: { type: 'string', description: 'Injection site reaction if SC (erythema, swelling, pain)' },
                  infusionReaction: { type: 'string', description: 'Infusion reaction if IV (none, mild, moderate)' },
                  premedications: { type: 'array', items: { type: 'string' }, description: 'Premedications given (acetaminophen, diphenhydramine, hydrocortisone)' },
                  patientEducation: { type: 'boolean', description: 'Patient educated on self-injection technique if applicable' }
                },
                description: 'First dose administration details and tolerability'
              },
              responseAssessment: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    assessmentDate: { type: 'string', description: 'Date of follow-up assessment' },
                    weeksOnTherapy: { type: 'number', description: 'Weeks since starting biologic' },
                    currentEasiScore: { type: 'string', description: 'Current EASI if dermatology' },
                    currentIgaScore: { type: 'string', description: 'Current IGA if dermatology' },
                    currentPasiScore: { type: 'string', description: 'Current PASI if dermatology' },
                    currentDas28Score: { type: 'string', description: 'Current DAS28 if rheumatology' },
                    percentImprovement: { type: 'string', description: 'CRITICAL: Quantitative improvement from baseline (e.g., "50% improvement in EASI", "PASI75 achieved")' },
                    responseCategory: { type: 'string', enum: ['Complete response', 'Excellent response (≥75% improvement)', 'Good response (50-74% improvement)', 'Partial response (25-49% improvement)', 'Minimal response (<25% improvement)', 'No response', 'Worsening'], description: 'Response category' },
                    patientReportedOutcome: { type: 'string', description: 'Patient-reported improvement in symptoms and quality of life' },
                    photographicDocumentation: { type: 'boolean', description: 'Follow-up photos obtained for comparison' }
                  }
                },
                description: 'Serial response assessments with quantitative improvement tracking'
              },
              adverseEvents: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    event: { type: 'string', description: 'Adverse event (Injection site reaction, Conjunctivitis, Upper respiratory infection, Headache, etc.)' },
                    severity: { type: 'string', enum: ['Mild', 'Moderate', 'Severe'], description: 'Severity grade' },
                    onset: { type: 'string', description: 'When occurred relative to dose' },
                    management: { type: 'string', description: 'How managed (observation, symptomatic treatment, dose modification, discontinuation)' },
                    resolved: { type: 'boolean', description: 'Whether event resolved' }
                  }
                },
                description: 'Adverse events and safety monitoring'
              },
              safetyMonitoring: {
                type: 'object',
                properties: {
                  baselineScreening: {
                    type: 'object',
                    properties: {
                      tbTesting: { type: 'string', description: 'TB screening (IGRA, PPD) for TNF inhibitors' },
                      hepatitisPanel: { type: 'string', description: 'Hepatitis B/C screening' },
                      cbcBaseline: { type: 'string', description: 'Baseline CBC' },
                      lftsBaseline: { type: 'string', description: 'Baseline liver function tests' },
                      pregnancyTest: { type: 'string', description: 'Pregnancy test if applicable' }
                    }
                  },
                  ongoingMonitoring: {
                    type: 'object',
                    properties: {
                      labFrequency: { type: 'string', description: 'How often labs checked (e.g., "CBC and CMP every 3 months")' },
                      infectionScreening: { type: 'string', description: 'Infection surveillance (TB, hepatitis reactivation)' },
                      immunizationStatus: { type: 'string', description: 'Live vaccine contraindications, ensure up-to-date on inactivated vaccines' }
                    }
                  }
                },
                description: 'Safety screening and ongoing monitoring protocols'
              },
              insuranceAuthorization: {
                type: 'object',
                properties: {
                  priorAuthorizationStatus: { type: 'string', enum: ['Approved', 'Denied', 'Pending', 'Appeal in progress'], description: 'Prior authorization status' },
                  approvalDate: { type: 'string', description: 'Date approved' },
                  authorizationPeriod: { type: 'string', description: 'How long approved (e.g., "6 months", "1 year")' },
                  reauthorizationDue: { type: 'string', description: 'When reauthorization needed' },
                  denialReasons: { type: 'array', items: { type: 'string' }, description: 'Reasons for denial if applicable' },
                  appealStatus: { type: 'string', description: 'Appeal status and outcome' },
                  outOfPocketCost: { type: 'string', description: 'Patient out-of-pocket cost per dose' },
                  copayAssistance: {
                    type: 'object',
                    properties: {
                      program: { type: 'string', description: 'Manufacturer copay card or patient assistance program' },
                      enrolled: { type: 'boolean', description: 'Patient enrolled in assistance program' },
                      coverageAmount: { type: 'string', description: 'Amount covered by assistance (e.g., "Up to $13,000/year")' }
                    }
                  }
                },
                description: 'CRITICAL: Insurance authorization tracking (biologics are expensive, PA almost always required)'
              },
              treatmentPlan: {
                type: 'object',
                properties: {
                  shortTermGoals: { type: 'array', items: { type: 'string' }, description: 'Goals for first 3-6 months (e.g., "Achieve 50% reduction in EASI", "Clear face and hands", "Reduce pruritus to <3/10")' },
                  longTermGoals: { type: 'array', items: { type: 'string' }, description: 'Long-term goals (sustained remission, minimal disease activity, off systemic steroids)' },
                  responseThreshold: { type: 'string', description: 'Minimum response to continue therapy (e.g., "If <25% improvement by week 16, consider alternative biologic")' },
                  durationOfTrial: { type: 'string', description: 'How long to trial before assessing efficacy (typically 12-16 weeks)' },
                  concomitantTherapies: { type: 'array', items: { type: 'string' }, description: 'Therapies used alongside biologic (topical steroids, moisturizers, phototherapy)' }
                },
                description: 'Treatment plan with goals and discontinuation criteria'
              },
              switchingBiologics: {
                type: 'object',
                properties: {
                  priorBiologics: { type: 'array', items: { type: 'object', properties: {
                    biologic: { type: 'string' },
                    duration: { type: 'string' },
                    reasonForSwitch: { type: 'string', description: 'Primary failure, secondary loss of response, adverse event, insurance' }
                  }}},
                  washoutPeriod: { type: 'string', description: 'Washout period between biologics if applicable' },
                  rationaleForCurrentChoice: { type: 'string', description: 'Why this biologic chosen (different mechanism, better safety profile, insurance coverage)' }
                },
                description: 'Biologic switching history and rationale'
              }
            },
            description: 'EXTRACT biologic therapy records including prior failures, baseline severity, administration plan, quantitative response assessment, adverse events, and insurance authorization'
          },

          woundCareAssessments: {
            type: 'object',
            properties: {
              woundIdentification: {
                type: 'object',
                properties: {
                  woundNumber: { type: 'string', description: 'Wound identifier if multiple wounds (e.g., "Wound 1", "Right plantar ulcer")' },
                  anatomicLocation: { type: 'string', description: 'Precise anatomic location (e.g., "Right plantar first metatarsal head", "Left lateral malleolus", "Sacrum")' },
                  laterality: { type: 'string', enum: ['Right', 'Left', 'Bilateral', 'Midline'], description: 'Laterality' },
                  woundEtiology: { type: 'string', description: 'Wound cause (Diabetic neuropathic ulcer, Arterial ulcer, Venous stasis ulcer, Pressure injury, Surgical wound, Traumatic wound)' },
                  dateOfOnset: { type: 'string', description: 'When wound first appeared' },
                  durationOfWound: { type: 'string', description: 'How long wound present (e.g., "6 weeks", "3 months", "Chronic - 2 years")' }
                },
                description: 'Wound identification and etiology'
              },
              woundClassification: {
                type: 'object',
                properties: {
                  wagnerGrade: { type: 'string', enum: ['Grade 0 (intact skin, high risk)', 'Grade 1 (superficial ulcer)', 'Grade 2 (deep ulcer to tendon/bone)', 'Grade 3 (deep ulcer with abscess/osteomyelitis)', 'Grade 4 (forefoot gangrene)', 'Grade 5 (whole foot gangrene)'], description: 'Wagner classification for diabetic foot ulcers' },
                  universityOfTexasClass: { type: 'string', description: 'University of Texas Diabetic Wound Classification (Grade 0-3, Stage A-D, e.g., "2B - deep ulcer with infection")' },
                  pressureInjuryStage: { type: 'string', enum: ['Stage 1 (non-blanchable erythema)', 'Stage 2 (partial thickness)', 'Stage 3 (full thickness)', 'Stage 4 (full thickness with exposed bone/muscle)', 'Unstageable (obscured by slough/eschar)', 'Deep tissue injury'], description: 'NPUAP/EPUAP pressure injury staging if applicable' }
                },
                description: 'Wound classification systems'
              },
              woundMeasurements: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    measurementDate: { type: 'string', description: 'Date of measurement' },
                    length: { type: 'string', description: 'Longest dimension in cm' },
                    width: { type: 'string', description: 'Width perpendicular to length in cm' },
                    depth: { type: 'string', description: 'Depth in cm (if probing performed)' },
                    area: { type: 'string', description: 'Surface area (length × width in cm²)' },
                    volume: { type: 'string', description: 'Wound volume if calculable (cm³)' },
                    undermining: { type: 'object', properties: {
                      present: { type: 'boolean' },
                      clockPositions: { type: 'string', description: 'Clock positions where undermining present (e.g., "9-12 o\'clock")' },
                      depth: { type: 'string', description: 'Depth of undermining in cm' }
                    }},
                    tunneling: { type: 'object', properties: {
                      present: { type: 'boolean' },
                      clockPosition: { type: 'string', description: 'Clock position of tunnel opening' },
                      depth: { type: 'string', description: 'Tunnel depth in cm' }
                    }},
                    photographicDocumentation: { type: 'boolean', description: 'Wound photograph obtained with ruler for scale' }
                  }
                },
                description: 'Serial wound measurements to track healing progress'
              },
              woundBedCharacteristics: {
                type: 'object',
                properties: {
                  granulationTissue: { type: 'string', description: 'Percentage of wound bed covered by healthy red granulation tissue (e.g., "60%")' },
                  sloughTissue: { type: 'string', description: 'Percentage yellow/tan slough (devitalized tissue)' },
                  necroticTissue: { type: 'string', description: 'Percentage black eschar (necrotic tissue)' },
                  epithelialization: { type: 'string', description: 'Epithelial tissue at wound edges (Pink tissue advancing from edges, indicating healing)' },
                  woundBedColor: { type: 'string', description: 'Overall wound bed appearance (Red - healthy granulation, Yellow - slough, Black - necrotic)' },
                  bioburden: { type: 'string', description: 'Assessment of bacterial load (Clean, Colonized, Infected)' }
                },
                description: 'Wound bed tissue composition - critical for healing assessment'
              },
              exudate: {
                type: 'object',
                properties: {
                  amount: { type: 'string', enum: ['None', 'Scant', 'Small', 'Moderate', 'Large', 'Copious'], description: 'Exudate amount' },
                  type: { type: 'string', enum: ['Serous (clear)', 'Serosanguineous (pink)', 'Sanguineous (bloody)', 'Purulent (thick, cloudy)', 'Seropurulent'], description: 'Exudate type and color' },
                  odor: { type: 'string', enum: ['None', 'Foul', 'Musty'], description: 'Odor (foul odor suggests anaerobic infection)' }
                },
                description: 'Wound drainage characteristics'
              },
              periwoundSkin: {
                type: 'object',
                properties: {
                  color: { type: 'string', description: 'Periwound skin color (Pink, Red/erythema, Dusky, Cyanotic)' },
                  temperature: { type: 'string', description: 'Periwound temperature (Warm suggests infection, Cool suggests ischemia)' },
                  edema: { type: 'string', enum: ['None', 'Mild', 'Moderate', 'Severe'], description: 'Periwound edema' },
                  induration: { type: 'string', description: 'Firmness/hardness around wound (suggests infection or inflammation)' },
                  maceration: { type: 'boolean', description: 'White/wrinkled skin from excessive moisture' },
                  callus: { type: 'string', description: 'Callus formation (thick hyperkeratotic tissue - impedes healing, requires debridement)' },
                  erythema: { type: 'object', properties: {
                    present: { type: 'boolean' },
                    distance: { type: 'string', description: 'How far erythema extends from wound edge (e.g., "2cm circumferentially")' }
                  }}
                },
                description: 'Periwound skin condition - important for infection detection and moisture management'
              },
              infectionAssessment: {
                type: 'object',
                properties: {
                  signsOfInfection: { type: 'array', items: { type: 'string' }, description: 'Clinical signs (Erythema >2cm, Warmth, Purulent drainage, Foul odor, Increased pain, Friable granulation tissue, Delayed healing)' },
                  infectionSeverity: { type: 'string', enum: ['No infection', 'Local infection', 'Spreading infection (cellulitis)', 'Systemic infection (SIRS)'], description: 'Infection severity classification' },
                  cultures: { type: 'array', items: { type: 'object', properties: {
                    cultureDate: { type: 'string' },
                    cultureType: { type: 'string', description: 'Culture method (Swab culture, Tissue biopsy culture - gold standard)' },
                    organisms: { type: 'array', items: { type: 'string' }, description: 'Organisms identified' },
                    sensitivities: { type: 'string', description: 'Antibiotic sensitivities' },
                    mrsaStatus: { type: 'string', enum: ['Positive', 'Negative', 'Not tested'], description: 'MRSA present' }
                  }}},
                  probeToBone: { type: 'boolean', description: 'Probe-to-bone test positive (suggests osteomyelitis)' },
                  osteomyelitis: { type: 'string', description: 'Osteomyelitis assessment (Clinical suspicion, MRI findings, bone biopsy results)' }
                },
                description: 'Infection assessment - critical for treatment decisions'
              },
              vascularAssessment: {
                type: 'object',
                properties: {
                  dorsalisPedisPulse: { type: 'string', enum: ['0 (absent)', '1+ (diminished)', '2+ (normal)', '3+ (bounding)'], description: 'DP pulse' },
                  posteriorTibialPulse: { type: 'string', enum: ['0 (absent)', '1+ (diminished)', '2+ (normal)', '3+ (bounding)'], description: 'PT pulse' },
                  poplitealPulse: { type: 'string', description: 'Popliteal pulse if checked' },
                  capillaryRefillTime: { type: 'string', description: 'Capillary refill time (normal <2 seconds, >3 seconds = poor perfusion)' },
                  anklebrachialIndex: { type: 'string', description: 'ABI (>0.9 normal, 0.5-0.9 moderate PAD, <0.5 severe PAD, >1.3 calcified vessels)' },
                  toePressure: { type: 'string', description: 'Toe pressure in mmHg (>30mmHg adequate for healing)' },
                  tcpo2: { type: 'string', description: 'Transcutaneous oxygen pressure (>40mmHg adequate for healing)' },
                  skinTemperature: { type: 'string', description: 'Foot temperature (Cool = ischemia, Warm = infection or neuropathy)' },
                  dependentRubor: { type: 'boolean', description: 'Foot becomes red when dependent (sign of severe ischemia)' },
                  vascularReferral: { type: 'string', description: 'Vascular surgery referral if significant PAD (for revascularization)' }
                },
                description: 'Vascular assessment - CRITICAL for healing potential in arterial/diabetic wounds'
              },
              neuropathyAssessment: {
                type: 'object',
                properties: {
                  monofilamentTest: { type: 'string', description: '10g monofilament test result (Normal, Loss of protective sensation)' },
                  vibrationSense: { type: 'string', description: '128 Hz tuning fork (Present, Diminished, Absent)' },
                  ankleReflexes: { type: 'string', description: 'Achilles reflex (Present, Diminished, Absent)' },
                  neuropathySeverity: { type: 'string', description: 'Overall neuropathy assessment' }
                },
                description: 'Neuropathy assessment for diabetic foot ulcers'
              },
              debridement: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    debridementDate: { type: 'string', description: 'Date of debridement' },
                    method: { type: 'string', description: 'Debridement method (Sharp/surgical, Enzymatic, Autolytic, Mechanical, Biological/maggots)' },
                    tissueRemoved: { type: 'string', description: 'Type and amount of tissue debrided (Callus, Slough, Necrotic tissue, Bone)' },
                    bleedingAfter: { type: 'string', description: 'Bleeding after debridement (None, Minimal, Moderate - good sign of viable tissue)' },
                    tolerability: { type: 'string', description: 'Patient tolerance of procedure' }
                  }
                },
                description: 'Debridement procedures - remove nonviable tissue to promote healing'
              },
              dressingRegimen: {
                type: 'object',
                properties: {
                  primaryDressing: { type: 'string', description: 'Dressing in direct contact with wound (Hydrogel, Hydrocolloid, Foam, Alginate, Antimicrobial silver, Collagen, Negative pressure, etc.)' },
                  secondaryDressing: { type: 'string', description: 'Cover dressing (Gauze, Foam, Transparent film, Compression wrap)' },
                  dressingFrequency: { type: 'string', description: 'How often changed (Daily, Every 2 days, Weekly, etc.)' },
                  moistureManagement: { type: 'string', description: 'Strategy (Absorb excess exudate with foam/alginate, Add moisture with hydrogel for dry wounds)' },
                  antimicrobialDressing: { type: 'boolean', description: 'Using antimicrobial dressing (silver, cadexomer iodine, PHMB)' }
                },
                description: 'Dressing selection - matched to wound characteristics'
              },
              offloading: {
                type: 'object',
                properties: {
                  device: { type: 'string', description: 'Off-loading device (Total contact cast - gold standard, Removable cast walker [CAM boot], Felted foam, Wheelchair, Crutches/walker, Surgical shoe)' },
                  compliance: { type: 'string', description: 'Patient compliance with off-loading (Excellent, Good, Poor)' },
                  weightBearingStatus: { type: 'string', description: 'Weight-bearing status (Non-weight bearing, Partial weight bearing, Weight bearing as tolerated)' }
                },
                description: 'Off-loading for plantar foot ulcers - CRITICAL for healing'
              },
              adjunctiveTherapies: {
                type: 'array',
                items: { type: 'string' },
                description: 'Adjunctive therapies used (Hyperbaric oxygen, Negative pressure wound therapy [VAC], Platelet-rich plasma, Skin substitutes, Growth factors, Electrical stimulation)'
              },
              healingProgress: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    assessmentDate: { type: 'string' },
                    currentArea: { type: 'string', description: 'Current wound area in cm²' },
                    percentReduction: { type: 'string', description: 'CRITICAL: Percentage reduction from baseline (e.g., "40% smaller than baseline", "Increased 20% - not healing")' },
                    healingRate: { type: 'string', description: 'Healing trajectory (Healing well, Stalled/plateau, Deteriorating)' },
                    expectedTimeToHealing: { type: 'string', description: 'Estimated time to complete closure based on current rate' }
                  }
                },
                description: 'Healing progress tracking with quantitative measurements'
              },
              amputationRisk: {
                type: 'object',
                properties: {
                  riskLevel: { type: 'string', enum: ['Low', 'Moderate', 'High'], description: 'Amputation risk level' },
                  riskFactors: { type: 'array', items: { type: 'string' }, description: 'Risk factors present (Non-healing ulcer >12 weeks, Severe PAD, Osteomyelitis, Gangrene, Non-compliance with off-loading)' },
                  limbSalvagePlan: { type: 'string', description: 'Aggressive limb salvage plan if high risk (Vascular intervention, IV antibiotics, Advanced wound therapies)' }
                },
                description: 'Amputation risk assessment'
              },
              patientEducation: {
                type: 'object',
                properties: {
                  diabeticFootCare: { type: 'boolean', description: 'Educated on daily foot inspection, proper footwear, glucose control' },
                  dressingChangeTechnique: { type: 'boolean', description: 'Taught dressing change if applicable' },
                  offloadingCompliance: { type: 'boolean', description: 'Reinforced importance of off-loading' },
                  signsOfInfection: { type: 'boolean', description: 'Taught to recognize infection signs (increased pain, redness, drainage, fever)' }
                },
                description: 'Patient education provided'
              }
            },
            description: 'EXTRACT comprehensive wound care assessments including staging, measurements, wound bed composition, vascular status, debridement, dressing regimen, off-loading, and healing progress'
          },

          podiatryExaminations: {
            type: 'object',
            properties: {
              indicationForExam: {
                type: 'string',
                description: 'Reason for podiatry evaluation (Annual diabetic foot exam, Foot pain, Wound/ulcer, Nail problem, Routine foot care, Orthotic fitting)'
              },
              neuropathyAssessment: {
                type: 'object',
                properties: {
                  monofilamentTest: {
                    type: 'object',
                    properties: {
                      performed: { type: 'boolean' },
                      rightFoot: { type: 'array', items: { type: 'object', properties: {
                        location: { type: 'string', description: 'Test site (1st toe, 3rd toe, 5th toe, 1st MTH, 3rd MTH, 5th MTH, Plantar midfoot, Heel)' },
                        sensation: { type: 'string', enum: ['Intact', 'Diminished', 'Absent'], description: 'Can patient feel 10g monofilament' }
                      }}},
                      leftFoot: { type: 'array', items: { type: 'object', properties: {
                        location: { type: 'string' },
                        sensation: { type: 'string', enum: ['Intact', 'Diminished', 'Absent'] }
                      }}},
                      interpretation: { type: 'string', description: 'Overall result (Normal protective sensation, Loss of protective sensation - HIGH RISK)' }
                    },
                    description: '10g Semmes-Weinstein monofilament test - GOLD STANDARD for neuropathy screening'
                  },
                  vibrationSense: {
                    type: 'object',
                    properties: {
                      performed: { type: 'boolean' },
                      tuningForkFrequency: { type: 'string', description: '128 Hz tuning fork standard' },
                      rightGreatToe: { type: 'string', enum: ['Present', 'Diminished', 'Absent'], description: 'Vibration at right 1st toe dorsum' },
                      leftGreatToe: { type: 'string', enum: ['Present', 'Diminished', 'Absent'], description: 'Vibration at left 1st toe dorsum' },
                      rightMedialMalleolus: { type: 'string', enum: ['Present', 'Diminished', 'Absent'] },
                      leftMedialMalleolus: { type: 'string', enum: ['Present', 'Diminished', 'Absent'] }
                    },
                    description: 'Vibration perception test with 128 Hz tuning fork'
                  },
                  ankleReflexes: {
                    type: 'object',
                    properties: {
                      rightAchilles: { type: 'string', enum: ['Normal (2+)', 'Diminished (1+)', 'Absent (0)'], description: 'Right Achilles reflex' },
                      leftAchilles: { type: 'string', enum: ['Normal (2+)', 'Diminished (1+)', 'Absent (0)'], description: 'Left Achilles reflex' }
                    },
                    description: 'Ankle reflexes'
                  },
                  pinprickTest: {
                    type: 'object',
                    properties: {
                      performed: { type: 'boolean' },
                      rightFoot: { type: 'string', description: 'Pinprick sensation right foot' },
                      leftFoot: { type: 'string', description: 'Pinprick sensation left foot' }
                    },
                    description: 'Pinprick/sharp-dull discrimination'
                  },
                  neuropathySeverity: {
                    type: 'string',
                    enum: ['No neuropathy', 'Mild neuropathy', 'Moderate neuropathy', 'Severe neuropathy - loss of protective sensation'],
                    description: 'Overall neuropathy severity classification'
                  }
                },
                description: 'Comprehensive neuropathy assessment - CRITICAL for ulcer risk'
              },
              vascularAssessment: {
                type: 'object',
                properties: {
                  dorsalisPedisPulse: {
                    type: 'object',
                    properties: {
                      right: { type: 'string', enum: ['0 (absent)', '1+ (diminished)', '2+ (normal)', '3+ (bounding)'], description: 'Right DP pulse' },
                      left: { type: 'string', enum: ['0 (absent)', '1+ (diminished)', '2+ (normal)', '3+ (bounding)'], description: 'Left DP pulse' }
                    }
                  },
                  posteriorTibialPulse: {
                    type: 'object',
                    properties: {
                      right: { type: 'string', enum: ['0 (absent)', '1+ (diminished)', '2+ (normal)', '3+ (bounding)'], description: 'Right PT pulse' },
                      left: { type: 'string', enum: ['0 (absent)', '1+ (diminished)', '2+ (normal)', '3+ (bounding)'], description: 'Left PT pulse' }
                    }
                  },
                  capillaryRefillTime: {
                    type: 'object',
                    properties: {
                      rightFoot: { type: 'string', description: 'CRT right (normal <2 seconds, delayed >3 seconds)' },
                      leftFoot: { type: 'string', description: 'CRT left' }
                    }
                  },
                  skinColor: {
                    type: 'object',
                    properties: {
                      rightFoot: { type: 'string', description: 'Skin color/perfusion (Pink, Pale, Dusky, Rubor)' },
                      leftFoot: { type: 'string', description: 'Skin color/perfusion' }
                    }
                  },
                  skinTemperature: {
                    type: 'object',
                    properties: {
                      rightFoot: { type: 'string', enum: ['Warm', 'Normal', 'Cool', 'Cold'], description: 'Skin temperature right' },
                      leftFoot: { type: 'string', enum: ['Warm', 'Normal', 'Cool', 'Cold'], description: 'Skin temperature left' }
                    }
                  },
                  edema: {
                    type: 'object',
                    properties: {
                      rightFoot: { type: 'string', enum: ['None', 'Mild (1+)', 'Moderate (2+)', 'Severe (3+)', 'Very severe (4+)'], description: 'Pedal edema right' },
                      leftFoot: { type: 'string', enum: ['None', 'Mild (1+)', 'Moderate (2+)', 'Severe (3+)', 'Very severe (4+)'], description: 'Pedal edema left' }
                    }
                  },
                  anklebrachialIndex: {
                    type: 'object',
                    properties: {
                      performed: { type: 'boolean' },
                      rightABI: { type: 'string', description: 'Right ABI value (>0.9 normal, 0.5-0.9 moderate PAD, <0.5 severe PAD, >1.3 calcified)' },
                      leftABI: { type: 'string', description: 'Left ABI value' },
                      interpretation: { type: 'string', description: 'ABI interpretation and clinical significance' }
                    }
                  },
                  vascularReferralNeeded: {
                    type: 'boolean',
                    description: 'Vascular surgery referral indicated (absent pulses, low ABI, nonhealing wounds)'
                  }
                },
                description: 'Vascular assessment - CRITICAL for wound healing potential'
              },
              footStructureDeformities: {
                type: 'object',
                properties: {
                  rightFoot: {
                    type: 'object',
                    properties: {
                      hammerToes: { type: 'array', items: { type: 'string' }, description: 'Which toes (e.g., ["2nd toe", "3rd toe"])' },
                      clawToes: { type: 'array', items: { type: 'string' } },
                      bunion: { type: 'boolean', description: 'Hallux valgus/bunion present' },
                      bunionSeverity: { type: 'string', enum: ['Mild', 'Moderate', 'Severe'] },
                      tailorsBunion: { type: 'boolean', description: '5th metatarsal bunionette' },
                      charcotFoot: { type: 'boolean', description: 'Charcot neuroarthropathy present' },
                      charcotStage: { type: 'string', description: 'Eichenholtz stage if Charcot (Acute, Subacute, Chronic/reconstructive)' },
                      flatFoot: { type: 'boolean', description: 'Pes planus (flat foot deformity)' },
                      highArch: { type: 'boolean', description: 'Pes cavus (high arch)' },
                      prominentMTHeads: { type: 'boolean', description: 'Prominent metatarsal heads (pressure points for ulcers)' },
                      otherDeformities: { type: 'array', items: { type: 'string' } }
                    }
                  },
                  leftFoot: {
                    type: 'object',
                    properties: {
                      hammerToes: { type: 'array', items: { type: 'string' } },
                      clawToes: { type: 'array', items: { type: 'string' } },
                      bunion: { type: 'boolean' },
                      bunionSeverity: { type: 'string', enum: ['Mild', 'Moderate', 'Severe'] },
                      tailorsBunion: { type: 'boolean' },
                      charcotFoot: { type: 'boolean' },
                      charcotStage: { type: 'string' },
                      flatFoot: { type: 'boolean' },
                      highArch: { type: 'boolean' },
                      prominentMTHeads: { type: 'boolean' },
                      otherDeformities: { type: 'array', items: { type: 'string' } }
                    }
                  }
                },
                description: 'Foot structural deformities - increase ulcer risk'
              },
              skinCondition: {
                type: 'object',
                properties: {
                  rightFoot: {
                    type: 'object',
                    properties: {
                      dryness: { type: 'string', enum: ['Normal', 'Mild dryness', 'Severe dryness/fissures'], description: 'Skin dryness (xerosis)' },
                      calluses: { type: 'array', items: { type: 'object', properties: {
                        location: { type: 'string', description: 'Callus location (e.g., "Plantar 1st MTH", "Heel")' },
                        severity: { type: 'string', enum: ['Thin', 'Thick', 'Very thick - requires debridement'] }
                      }}},
                      fissures: { type: 'array', items: { type: 'string' }, description: 'Heel or toe fissures (cracks)' },
                      maceration: { type: 'string', description: 'Maceration between toes or plantar' },
                      tinea: { type: 'boolean', description: 'Fungal infection (athlete\'s foot)' },
                      ulcers: { type: 'array', items: { type: 'object', properties: {
                        location: { type: 'string' },
                        size: { type: 'string' },
                        wagnerGrade: { type: 'string' }
                      }}}
                    }
                  },
                  leftFoot: {
                    type: 'object',
                    properties: {
                      dryness: { type: 'string', enum: ['Normal', 'Mild dryness', 'Severe dryness/fissures'] },
                      calluses: { type: 'array', items: { type: 'object', properties: {
                        location: { type: 'string' },
                        severity: { type: 'string', enum: ['Thin', 'Thick', 'Very thick - requires debridement'] }
                      }}},
                      fissures: { type: 'array', items: { type: 'string' } },
                      maceration: { type: 'string' },
                      tinea: { type: 'boolean' },
                      ulcers: { type: 'array', items: { type: 'object', properties: {
                        location: { type: 'string' },
                        size: { type: 'string' },
                        wagnerGrade: { type: 'string' }
                      }}}
                    }
                  }
                },
                description: 'Skin condition - dry skin, fissures, calluses, fungal infections'
              },
              nailCondition: {
                type: 'object',
                properties: {
                  rightFoot: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        toe: { type: 'string', description: 'Which toe (1st, 2nd, 3rd, 4th, 5th)' },
                        condition: { type: 'string', description: 'Condition (Normal, Onychomycosis/fungal, Ingrown, Thickened, Dystrophic, Absent)' },
                        ingrownSeverity: { type: 'string', enum: ['Mild', 'Moderate', 'Severe - infected'] },
                        onychauxis: { type: 'boolean', description: 'Ram\'s horn nail (severely thickened)' }
                      }
                    }
                  },
                  leftFoot: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        toe: { type: 'string' },
                        condition: { type: 'string' },
                        ingrownSeverity: { type: 'string', enum: ['Mild', 'Moderate', 'Severe - infected'] },
                        onychauxis: { type: 'boolean' }
                      }
                    }
                  }
                },
                description: 'Toenail conditions'
              },
              footwearAssessment: {
                type: 'object',
                properties: {
                  currentFootwear: { type: 'string', description: 'Type of shoes patient wears (Sneakers, Dress shoes, Sandals, Walking barefoot)' },
                  footwearAppropriate: { type: 'boolean', description: 'Is current footwear appropriate for risk level' },
                  footwearProblems: { type: 'array', items: { type: 'string' }, description: 'Problems identified (Too tight, Worn out, No arch support, Pressure points, Walking barefoot)' },
                  insoleCondition: { type: 'string', description: 'Condition of insoles/orthotics if present' },
                  recommendedFootwear: { type: 'string', description: 'Footwear recommendations (Extra-depth shoes, Custom molded shoes, Diabetic shoes with custom orthotics, Rocker-bottom shoes for Charcot)' }
                },
                description: 'Footwear evaluation - CRITICAL for ulcer prevention'
              },
              riskStratification: {
                type: 'object',
                properties: {
                  iwgdfRiskCategory: {
                    type: 'string',
                    enum: [
                      'Category 0 (Very low risk - no LOPS, no PAD)',
                      'Category 1 (Low risk - LOPS or PAD)',
                      'Category 2 (Moderate risk - LOPS + PAD, or LOPS + deformity, or PAD + deformity)',
                      'Category 3 (High risk - LOPS or PAD + prior ulcer or amputation, or ESRD)'
                    ],
                    description: 'International Working Group on Diabetic Foot (IWGDF) risk classification'
                  },
                  recommendedScreeningFrequency: { type: 'string', description: 'How often to screen (Category 0: Annual, Category 1: 6-12 months, Category 2: 3-6 months, Category 3: 1-3 months)' },
                  ulcerRisk: { type: 'string', enum: ['Low', 'Moderate', 'High', 'Very high'], description: 'Overall ulcer risk' },
                  amputationRisk: { type: 'string', enum: ['Low', 'Moderate', 'High'], description: 'Amputation risk' }
                },
                description: 'Risk stratification using IWGDF system - guides screening interval and interventions'
              },
              treatmentPlan: {
                type: 'object',
                properties: {
                  callusDebridement: { type: 'boolean', description: 'Callus debridement performed today' },
                  nailTrimming: { type: 'boolean', description: 'Nail trimming performed' },
                  ingrownNailTreatment: { type: 'string', description: 'Ingrown nail treatment (Conservative, Partial nail avulsion, Phenolization)' },
                  moisturizerRecommended: { type: 'boolean', description: 'Moisturizer for dry skin prescribed/recommended' },
                  antifungalTreatment: { type: 'string', description: 'Antifungal therapy if onychomycosis (Topical, Oral terbinafine/itraconazole)' },
                  diabeticShoesPrescribed: { type: 'boolean', description: 'Prescription for diabetic shoes + custom orthotics' },
                  referrals: { type: 'array', items: { type: 'string' }, description: 'Referrals (Vascular surgery, Endocrinology for glucose control, Wound care, Orthopedic surgery, Orthotist)' },
                  followUpInterval: { type: 'string', description: 'When to return for follow-up (based on risk category)' }
                },
                description: 'Treatment plan'
              },
              patientEducation: {
                type: 'object',
                properties: {
                  dailyFootInspection: { type: 'boolean', description: 'Taught to inspect feet daily (use mirror for plantar surface)' },
                  properFootwear: { type: 'boolean', description: 'Educated on proper footwear (no walking barefoot, check inside shoes for foreign objects)' },
                  moisturizing: { type: 'boolean', description: 'Taught to moisturize feet (but NOT between toes)' },
                  nailCare: { type: 'boolean', description: 'Nail care instructions (trim straight across, file edges)' },
                  glycemicControl: { type: 'boolean', description: 'Emphasized importance of glucose control for neuropathy prevention' },
                  whenToSeekCare: { type: 'boolean', description: 'Taught to seek immediate care for wounds, infections, color changes' }
                },
                description: 'Patient education provided'
              }
            },
            description: 'EXTRACT comprehensive podiatry diabetic foot examination including neuropathy testing, vascular assessment, deformities, risk stratification, and prevention strategies'
          },

          nuclearMedicineStudies: {
            type: 'object',
            properties: {
              studyType: { type: 'string', description: 'Type of nuclear medicine study (PET/CT, SPECT, Bone scan, Thyroid scan, Cardiac stress test, Renal scan, GI bleeding scan, Lymphoscintigraphy)' },
              indication: { type: 'string', description: 'Clinical indication (e.g., "Oncologic staging", "Infection localization", "Thyroid nodule evaluation")' },
              radiopharmaceutical: {
                type: 'object',
                properties: {
                  agent: { type: 'string', description: 'Radiotracer used (e.g., "F-18 FDG", "Tc-99m MDP", "I-123", "Tc-99m sestamibi", "In-111 WBC")' },
                  dose: { type: 'string', description: 'Administered dose (e.g., "15 mCi", "370 MBq")' },
                  route: { type: 'string', description: 'Route (IV, PO, Inhalation)' },
                  injectionTime: { type: 'string', description: 'Time of radiotracer injection' },
                  uptakePeriod: { type: 'string', description: 'Uptake period before scanning (e.g., "60 minutes post-injection")' }
                },
                description: 'Radiotracer details'
              },
              petCtFindings: {
                type: 'object',
                properties: {
                  areasOfUptake: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        location: { type: 'string', description: 'Anatomic location (e.g., "Right upper lobe lung mass", "Left axillary lymph nodes", "L3 vertebral body")' },
                        suvMax: { type: 'string', description: 'CRITICAL: Maximum standardized uptake value (SUVmax) (e.g., "8.5", "12.3") - key quantitative metric for lesion characterization' },
                        suvPeak: { type: 'string', description: 'Peak SUV value' },
                        suvMean: { type: 'string', description: 'Mean SUV value' },
                        size: { type: 'string', description: 'Lesion size (e.g., "2.3 x 1.8 cm")' },
                        ctCorrelate: { type: 'string', description: 'CT imaging correlate (e.g., "Corresponds to soft tissue mass", "No CT correlate - PET-positive only")' },
                        interpretation: { type: 'string', description: 'Interpretation (e.g., "Hypermetabolic - suspicious for malignancy", "Physiologic uptake", "Inflammatory")' }
                      }
                    },
                    description: 'CRITICAL: ALL areas of FDG uptake with SUV values'
                  },
                  primaryTumor: {
                    type: 'object',
                    properties: {
                      location: { type: 'string' },
                      suvMax: { type: 'string' },
                      size: { type: 'string' },
                      metabolicActivity: { type: 'string', description: 'Metabolic activity level (e.g., "Intensely hypermetabolic", "Mildly hypermetabolic", "Photopenic")' }
                    }
                  },
                  lymphNodes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        station: { type: 'string', description: 'Lymph node station (e.g., "Right hilar", "Mediastinal 4R", "Left axillary level II")' },
                        suvMax: { type: 'string' },
                        size: { type: 'string' },
                        suspicious: { type: 'boolean', description: 'Suspicious for metastasis based on SUV and size' }
                      }
                    }
                  },
                  distantMetastases: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        organ: { type: 'string', description: 'Affected organ (Bone, Liver, Lung, Brain, Adrenal)' },
                        location: { type: 'string' },
                        suvMax: { type: 'string' },
                        numberOfLesions: { type: 'string', description: 'Number of lesions (e.g., "Solitary", "Multiple - at least 5")' }
                      }
                    }
                  },
                  metabolicTumorVolume: { type: 'string', description: 'MTV (e.g., "45 cm³") - total volume of metabolically active tumor' },
                  totalLesionGlycolysis: { type: 'string', description: 'TLG (e.g., "325") - MTV × SUVmean, prognostic marker' }
                },
                description: 'PET/CT findings with quantitative SUV analysis for oncologic staging'
              },
              boneScan: {
                type: 'object',
                properties: {
                  areasOfUptake: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        location: { type: 'string', description: 'Bone location (e.g., "L3 vertebral body", "Right 8th rib", "Left femoral head")' },
                        intensity: { type: 'string', description: 'Uptake intensity (Mild, Moderate, Intense)' },
                        pattern: { type: 'string', description: 'Pattern (Focal, Diffuse, Linear)' },
                        suspiciousForMetastasis: { type: 'boolean' }
                      }
                    }
                  },
                  overallImpression: { type: 'string', description: '(e.g., "No evidence of osseous metastatic disease", "Multiple bone metastases", "Degenerative changes only")' }
                },
                description: 'Bone scan findings for metastatic workup'
              },
              spect: {
                type: 'object',
                properties: {
                  studyType: { type: 'string', description: 'SPECT study type (Myocardial perfusion, Brain, Bone, Parathyroid, DaTscan)' },
                  findings: { type: 'string', description: 'SPECT findings' },
                  defects: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        location: { type: 'string' },
                        severity: { type: 'string', description: 'Mild, Moderate, Severe' },
                        reversibility: { type: 'string', description: 'Fixed, Partially reversible, Completely reversible' }
                      }
                    }
                  }
                },
                description: 'SPECT imaging findings'
              },
              thyroidScan: {
                type: 'object',
                properties: {
                  noduleUptake: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        location: { type: 'string', description: 'Thyroid lobe and position (e.g., "Right lobe upper pole", "Left lobe lower pole", "Isthmus")' },
                        uptakePattern: { type: 'string', enum: ['Hot nodule (increased uptake)', 'Warm nodule (normal uptake)', 'Cold nodule (decreased uptake)'], description: 'CRITICAL: Uptake pattern - cold nodules have higher malignancy risk' },
                        size: { type: 'string' },
                        functionality: { type: 'string', description: 'Functional status (e.g., "Hyperfunctioning autonomous nodule", "Nonfunctioning nodule")' }
                      }
                    }
                  },
                  overallThyroidUptake: { type: 'string', description: 'Overall thyroid uptake pattern (e.g., "Diffusely increased - consistent with Graves disease", "Heterogeneous", "Normal")' },
                  percentUptake24Hour: { type: 'string', description: '24-hour radioiodine uptake % (e.g., "35%" - elevated in hyperthyroidism)' }
                },
                description: 'Thyroid scan for nodule evaluation and hyperthyroidism assessment'
              },
              renalScan: {
                type: 'object',
                properties: {
                  splitRenalFunction: {
                    type: 'object',
                    properties: {
                      rightKidney: { type: 'string', description: 'Right kidney % function (e.g., "55%")' },
                      leftKidney: { type: 'string', description: 'Left kidney % function (e.g., "45%")' }
                    }
                  },
                  gfr: { type: 'string', description: 'GFR from renal scan (e.g., "72 mL/min")' },
                  obstruction: { type: 'string', description: 'Evidence of obstruction (e.g., "No obstruction", "Right-sided obstruction with delayed washout")' },
                  captoprilChallenge: { type: 'string', description: 'Captopril renogram results for renovascular hypertension' }
                },
                description: 'Renal scan for split function and obstruction assessment'
              },
              incidentalFindings: {
                type: 'array',
                items: { type: 'string' },
                description: 'Incidental findings on nuclear medicine study (e.g., "Thyroid nodule", "Adrenal mass")'
              },
              comparison: { type: 'string', description: 'Comparison to prior studies (e.g., "New metastases in liver", "Decreased SUVmax in primary tumor - partial metabolic response")' },
              impression: { type: 'string', description: 'Overall impression and clinical interpretation' },
              tnmStaging: {
                type: 'object',
                properties: {
                  tStage: { type: 'string', description: 'Primary tumor stage (e.g., "T2", "T3")' },
                  nStage: { type: 'string', description: 'Lymph node stage (e.g., "N1", "N2")' },
                  mStage: { type: 'string', description: 'Metastasis stage (e.g., "M0", "M1")' },
                  overallStage: { type: 'string', description: 'Overall cancer stage (e.g., "Stage IIIA", "Stage IV")' }
                },
                description: 'CRITICAL: TNM staging based on PET/CT findings for oncologic management'
              },
              therapeuticResponse: { type: 'string', description: 'Response to therapy assessment (Complete metabolic response, Partial metabolic response, Stable disease, Progressive disease) based on PERCIST criteria' },
              radiationSafety: {
                type: 'object',
                properties: {
                  breastfeeding: { type: 'boolean', description: 'Breastfeeding precautions advised' },
                  closeContactPrecautions: { type: 'string', description: 'Duration of close contact precautions (e.g., "Avoid close contact with children for 24 hours")' },
                  pregnancyTesting: { type: 'boolean', description: 'Pregnancy test performed before radiotracer administration' }
                }
              }
            },
            description: 'EXTRACT comprehensive nuclear medicine study data including PET/CT with SUV values, bone scans, SPECT, thyroid scans, and quantitative metrics for oncologic staging and treatment response'
          },

          cardiacDeviceInterrogations: {
            type: 'object',
            properties: {
              deviceType: { type: 'string', enum: ['Pacemaker', 'ICD (Implantable Cardioverter Defibrillator)', 'CRT-P (Cardiac Resynchronization Therapy - Pacemaker)', 'CRT-D (Cardiac Resynchronization Therapy - Defibrillator)', 'Loop recorder'], description: 'Type of cardiac device' },
              manufacturer: { type: 'string', description: 'Device manufacturer (e.g., "Medtronic", "Boston Scientific", "Abbott", "Biotronik")' },
              model: { type: 'string', description: 'Device model number' },
              serialNumber: { type: 'string', description: 'Device serial number' },
              implantDate: { type: 'string', description: 'Date of device implantation' },
              interrogationDate: { type: 'string', description: 'Date of current interrogation' },
              interrogationReason: { type: 'string', description: 'Reason for interrogation (Routine follow-up, Shock delivery, Symptoms, Pre-procedure check)' },
              batteryStatus: {
                type: 'object',
                properties: {
                  voltage: { type: 'string', description: 'Battery voltage (e.g., "2.8 V")' },
                  status: { type: 'string', enum: ['Normal (BOL)', 'Normal (mid-life)', 'ERI (Elective Replacement Indicator)', 'EOL (End of Life)'], description: 'CRITICAL: Battery status - ERI/EOL requires device replacement' },
                  estimatedLongevity: { type: 'string', description: 'Estimated remaining battery life (e.g., "3-5 years", "6-12 months")' },
                  replacementRecommended: { type: 'boolean', description: 'Is device replacement recommended' }
                },
                description: 'CRITICAL: Battery status - determines need for device replacement'
              },
              leads: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    location: { type: 'string', description: 'Lead location (Right atrial, Right ventricular, Left ventricular, CS (coronary sinus))' },
                    leadType: { type: 'string', description: 'Lead type (e.g., "Bipolar active fixation", "Quadripolar LV lead")' },
                    impedance: { type: 'string', description: 'Lead impedance in ohms (e.g., "450 ohms") - normal 200-1500 ohms' },
                    impedanceStatus: { type: 'string', enum: ['Normal', 'High (possible lead fracture)', 'Low (possible insulation breach)'], description: 'CRITICAL: Impedance interpretation' },
                    threshold: { type: 'string', description: 'Pacing threshold (e.g., "0.5 V at 0.4 ms")' },
                    sensingAmplitude: { type: 'string', description: 'Sensing amplitude (e.g., "8.5 mV" for atrial, "12 mV" for ventricular)' },
                    leadIntegrity: { type: 'string', description: 'Lead integrity assessment (Intact, Concerning for fracture, Insulation breach)' }
                  }
                },
                description: 'CRITICAL: Lead parameters - abnormal impedance indicates lead malfunction'
              },
              pacingParameters: {
                type: 'object',
                properties: {
                  pacingMode: { type: 'string', description: 'Pacing mode (e.g., "DDD", "VVI", "AAI", "BiV" for CRT)' },
                  lowerRateLimit: { type: 'string', description: 'Lower rate limit in bpm (e.g., "60 bpm")' },
                  upperRateLimit: { type: 'string', description: 'Upper rate limit (e.g., "130 bpm")' },
                  atrialOutput: { type: 'string', description: 'Atrial pacing output (e.g., "2.5 V at 0.4 ms")' },
                  ventricularOutput: { type: 'string', description: 'Ventricular pacing output (e.g., "2.0 V at 0.4 ms")' },
                  avDelay: { type: 'string', description: 'AV delay (e.g., "150 ms")' },
                  vvDelay: { type: 'string', description: 'VV delay for CRT devices (e.g., "LV first by 20 ms")' }
                },
                description: 'Current pacing parameters'
              },
              pacingPercentages: {
                type: 'object',
                properties: {
                  atrialPacing: { type: 'string', description: 'Atrial pacing % (e.g., "15%")' },
                  ventricularPacing: { type: 'string', description: 'Ventricular pacing % (e.g., "95%") - high % may worsen heart failure if not CRT' },
                  biventricularPacing: { type: 'string', description: 'Biventricular pacing % for CRT (e.g., "98%") - goal >95% for CRT efficacy' }
                },
                description: 'CRITICAL: Pacing percentages - high RV pacing without CRT can worsen HF, CRT needs >95% BiV pacing'
              },
              arrhythmiaEpisodes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    arrhythmiaType: { type: 'string', description: 'Type (Atrial fibrillation, Atrial flutter, VT (Ventricular tachycardia), VF (Ventricular fibrillation), SVT)' },
                    episodeDate: { type: 'string', description: 'Date/time of episode' },
                    duration: { type: 'string', description: 'Episode duration (e.g., "3 hours 15 minutes", "Sustained")' },
                    rate: { type: 'string', description: 'Heart rate during episode (e.g., "180 bpm")' },
                    therapyDelivered: { type: 'string', description: 'Therapy delivered by device (None, ATP (Anti-tachycardia pacing), Shock)' },
                    shockEnergy: { type: 'string', description: 'Shock energy if delivered (e.g., "20 J", "35 J")' },
                    successful: { type: 'boolean', description: 'Was therapy successful in terminating arrhythmia' },
                    egm: { type: 'string', description: 'Electrogram findings if available' }
                  }
                },
                description: 'CRITICAL: All arrhythmia episodes detected - determines anticoagulation need, ICD therapy assessment'
              },
              icdTherapy: {
                type: 'object',
                properties: {
                  totalShocks: { type: 'number', description: 'Total number of shocks delivered since implant' },
                  appropriateShocks: { type: 'number', description: 'Number of appropriate shocks (for true VT/VF)' },
                  inappropriateShocks: { type: 'number', description: 'CRITICAL: Inappropriate shocks (for non-VT/VF rhythms like AF) - may need reprogramming' },
                  atpTherapies: { type: 'number', description: 'ATP therapies delivered' },
                  lastTherapyDate: { type: 'string', description: 'Date of most recent shock or ATP' },
                  vtVfZones: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        zone: { type: 'string', description: 'Zone name (VF, Fast VT, Slow VT, Monitor)' },
                        detectionRate: { type: 'string', description: 'Detection rate cutoff (e.g., "188 bpm for VT1")' },
                        therapy: { type: 'string', description: 'Programmed therapy (ATP, Shock, Monitor only)' }
                      }
                    }
                  }
                },
                description: 'ICD therapy history and programming'
              },
              atrialFibrillationBurden: {
                type: 'object',
                properties: {
                  dailyBurden: { type: 'string', description: 'AF burden % per day' },
                  longestEpisode: { type: 'string', description: 'Longest AF episode duration' },
                  totalEpisodes: { type: 'number', description: 'Total AF episodes since last interrogation' },
                  anticoagulationIndicated: { type: 'boolean', description: 'CRITICAL: Is anticoagulation indicated based on AF burden' }
                },
                description: 'CRITICAL: AF burden monitoring - high burden may require anticoagulation'
              },
              alerts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    alertType: { type: 'string', description: 'Alert type (High impedance, Low impedance, Low battery, High ventricular rate, AF burden, Shock)' },
                    status: { type: 'string', enum: ['Active', 'Resolved'], description: 'Alert status' },
                    actionRequired: { type: 'string', description: 'Required action (e.g., "Lead revision needed", "Reprogram VT detection", "Device replacement within 3 months")' }
                  }
                },
                description: 'Device-generated alerts requiring clinical action'
              },
              remoteMonitoring: {
                type: 'object',
                properties: {
                  enrolled: { type: 'boolean', description: 'Patient enrolled in remote monitoring' },
                  lastTransmission: { type: 'string', description: 'Date of last remote transmission' },
                  transmissionCompliance: { type: 'string', description: 'Transmission compliance (Excellent, Good, Poor)' }
                }
              },
              programmingChanges: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    parameter: { type: 'string', description: 'Parameter changed (e.g., "Lower rate limit", "VT detection", "AV delay")' },
                    oldValue: { type: 'string' },
                    newValue: { type: 'string' },
                    reason: { type: 'string', description: 'Reason for change' }
                  }
                },
                description: 'Programming changes made during this interrogation'
              },
              clinicalAssessment: { type: 'string', description: 'Overall clinical assessment and plan' },
              followUpPlan: { type: 'string', description: 'Follow-up plan (e.g., "Routine 6-month follow-up", "Urgent lead revision", "Device replacement scheduled")' }
            },
            description: 'EXTRACT comprehensive cardiac device interrogation data including battery, leads, pacing, arrhythmias, and ICD therapies for pacemaker/ICD/CRT management'
          },

          socialDeterminantsOfHealth: {
            type: 'object',
            properties: {
              housingStatus: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['Stable housing', 'Temporary housing', 'Homeless', 'Shelter', 'Unstable housing'], description: 'Current housing status' },
                  housingType: { type: 'string', description: 'Housing type (Own home, Rent, Family/friend, Assisted living, Nursing home)' },
                  adequacy: { type: 'string', description: 'Housing adequacy (Adequate, Crowded, Unsafe, Lacks heat/AC, Lacks running water, Mold/pest issues)' },
                  housingInsecurity: { type: 'boolean', description: 'CRITICAL: At risk of losing housing' },
                  barriers: { type: 'array', items: { type: 'string' }, description: 'Barriers (e.g., "Cannot afford rent", "Eviction pending", "Recent discharge with nowhere to go")' }
                },
                description: 'CRITICAL: Housing status affects discharge planning and medication adherence'
              },
              foodSecurity: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['Food secure', 'Food insecure', 'Very low food security'], description: 'Food security status' },
                  hungerScreening: { type: 'string', description: 'Hunger screening result (e.g., "Positive - skips meals due to cost", "Negative")' },
                  diabeticDiet: { type: 'boolean', description: 'Can afford diabetic-appropriate foods' },
                  renalDiet: { type: 'boolean', description: 'Can afford renal diet foods' },
                  foodPantryUse: { type: 'boolean', description: 'Uses food pantry' },
                  snapBenefits: { type: 'boolean', description: 'Receives SNAP/food stamps' },
                  referrals: { type: 'array', items: { type: 'string' }, description: 'Referrals made (e.g., "Food pantry", "SNAP enrollment", "Meals on Wheels")' }
                },
                description: 'CRITICAL: Food insecurity affects nutrition-dependent conditions (diabetes, CKD, heart failure)'
              },
              financialBarriers: {
                type: 'object',
                properties: {
                  medicationAffordability: { type: 'boolean', description: 'CRITICAL: Can afford medications' },
                  medicationCostRationing: { type: 'boolean', description: 'CRITICAL: Skips/rations medications due to cost - high-risk behavior' },
                  copayBurden: { type: 'string', description: 'Copay burden (e.g., "$400/month for medications", "Multiple ED visits due to inability to afford outpatient care")' },
                  utilityInsecurity: { type: 'boolean', description: 'Difficulty paying utilities (heat/AC/electric)' },
                  medicalDebt: { type: 'string', description: 'Medical debt burden' },
                  employmentStatus: { type: 'string', description: 'Employment (Employed full-time, Part-time, Unemployed, Disabled, Retired)' },
                  income: { type: 'string', description: 'Income level or financial assistance eligibility' },
                  financialAssistance: { type: 'array', items: { type: 'string' }, description: 'Financial assistance enrolled (e.g., "Medicaid", "Patient assistance programs", "Charity care", "340B")' }
                },
                description: 'CRITICAL: Financial barriers are #1 cause of medication nonadherence and missed appointments'
              },
              transportation: {
                type: 'object',
                properties: {
                  hasReliableTransportation: { type: 'boolean', description: 'Has reliable transportation to appointments' },
                  barriers: { type: 'array', items: { type: 'string' }, description: 'Transportation barriers (e.g., "No car", "Cannot afford gas", "No public transit available", "Too sick to drive")' },
                  missedAppointments: { type: 'boolean', description: 'Has missed appointments due to transportation' },
                  transportationAssistance: { type: 'array', items: { type: 'string' }, description: 'Assistance arranged (e.g., "Medicaid transport", "Family member drives", "Telemedicine visits")' }
                },
                description: 'Transportation barriers to care access'
              },
              insurance: {
                type: 'object',
                properties: {
                  status: { type: 'string', description: 'Insurance status (Insured, Uninsured, Underinsured)' },
                  type: { type: 'string', description: 'Insurance type (Medicare, Medicaid, Commercial, Uninsured, Charity care)' },
                  gaps: { type: 'string', description: 'Coverage gaps (e.g., "Medicare Part D donut hole", "High deductible not met", "Prior authorizations delayed")' },
                  insuranceNavigator: { type: 'boolean', description: 'Insurance navigator/social worker involved' }
                },
                description: 'Insurance coverage and gaps'
              },
              socialSupport: {
                type: 'object',
                properties: {
                  livingSituation: { type: 'string', description: 'Lives alone, With spouse, With family, With caregiver' },
                  caregiver: { type: 'string', description: 'Primary caregiver name and relationship' },
                  caregiverBurden: { type: 'string', description: 'Caregiver burden assessment (e.g., "Spouse overwhelmed with care tasks", "Daughter lives 2 hours away - limited support")' },
                  socialIsolation: { type: 'boolean', description: 'Socially isolated - risk factor for poor outcomes' },
                  communitySupport: { type: 'array', items: { type: 'string' }, description: 'Community support (e.g., "Church community", "Senior center", "None identified")' }
                },
                description: 'Social support network'
              },
              healthLiteracy: {
                type: 'object',
                properties: {
                  level: { type: 'string', enum: ['Adequate', 'Marginal', 'Low'], description: 'Health literacy level' },
                  languageBarrier: { type: 'boolean', description: 'Language barrier to care' },
                  primaryLanguage: { type: 'string', description: 'Primary language' },
                  interpreterNeeded: { type: 'boolean', description: 'Interpreter services needed' },
                  educationLevel: { type: 'string', description: 'Highest education level' },
                  digitalLiteracy: { type: 'string', description: 'Ability to use patient portal, telemedicine (Comfortable, Limited, Unable)' }
                },
                description: 'Health literacy and communication barriers'
              },
              substanceUseBarriers: {
                type: 'object',
                properties: {
                  activeSubstanceUse: { type: 'boolean', description: 'Active substance use affecting care' },
                  barriers: { type: 'array', items: { type: 'string' }, description: 'Barriers from substance use (e.g., "Medication diversion concern", "Missed appointments", "Housing instability")' },
                  treatmentEngagement: { type: 'string', description: 'Substance use treatment engagement status' }
                }
              },
              legalBarriers: {
                type: 'object',
                properties: {
                  incarceration: { type: 'string', description: 'Recent/upcoming incarceration affecting care continuity' },
                  immigration: { type: 'string', description: 'Immigration status affecting care access' },
                  childCustody: { type: 'string', description: 'Child custody issues affecting housing/stability' }
                }
              },
              referralsMade: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    service: { type: 'string', description: 'Service referred to (e.g., "Social work", "Patient assistance programs", "Food pantry", "Housing assistance", "Medicaid enrollment", "Home health")' },
                    priority: { type: 'string', enum: ['Urgent', 'High', 'Routine'], description: 'Referral priority' },
                    status: { type: 'string', description: 'Referral status (Placed, Patient declined, Waitlist)' }
                  }
                },
                description: 'CRITICAL: Referrals to address social determinants - essential for care plan success'
              },
              dischargeBarriers: {
                type: 'array',
                items: { type: 'string' },
                description: 'CRITICAL: Barriers to safe discharge (e.g., "No housing", "Cannot afford medications", "No caregiver for wound care", "No transportation to follow-up")'
              },
              overallRiskAssessment: { type: 'string', enum: ['Low risk', 'Moderate risk', 'High risk', 'Very high risk'], description: 'CRITICAL: Overall social determinants risk level - high risk patients need intensive care coordination' }
            },
            description: 'EXTRACT social determinants of health barriers to care - CRITICAL for discharge planning, medication adherence, and preventing readmissions'
          },

          medicationAccessPrograms: {
            type: 'object',
            properties: {
              programsEnrolled: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    programName: { type: 'string', description: 'Program name (e.g., "Manufacturer patient assistance program", "340B", "State pharmaceutical assistance", "Charity care pharmacy")' },
                    medications: { type: 'array', items: { type: 'string' }, description: 'Medications covered' },
                    applicationStatus: { type: 'string', enum: ['Enrolled/Active', 'Application pending', 'Denied', 'Renewal due'], description: 'Program enrollment status' },
                    enrollmentDate: { type: 'string' },
                    renewalDate: { type: 'string', description: 'CRITICAL: Program renewal date - prevents coverage gaps' },
                    coverageAmount: { type: 'string', description: 'Coverage provided (e.g., "100% coverage - free medication", "$0 copay", "Copay reduced to $10/month")' },
                    annualSavings: { type: 'string', description: 'Estimated annual savings (e.g., "$12,000/year")' }
                  }
                },
                description: 'Medication assistance programs enrolled'
              },
              applicationsPending: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    medication: { type: 'string' },
                    program: { type: 'string' },
                    applicationDate: { type: 'string' },
                    statusCheck: { type: 'string', description: 'Expected decision date or follow-up needed' }
                  }
                }
              },
              alternativeAccessStrategies: {
                type: 'array',
                items: { type: 'string' },
                description: 'Alternative strategies (e.g., "Generic substitution approved", "Therapeutic interchange to formulary alternative", "Split higher dose tablets", "90-day supply at lower cost")'
              }
            },
            description: 'Medication patient assistance programs and access strategies'
          },

          clinicalRiskScores: {
            type: 'object',
            properties: {
              cha2ds2vasc: {
                type: 'object',
                properties: {
                  score: { type: 'number', description: 'CHA2DS2-VASc score (0-9)' },
                  components: {
                    type: 'object',
                    properties: {
                      chf: { type: 'number', description: '1 point' },
                      hypertension: { type: 'number' },
                      age75orOlder: { type: 'number', description: '2 points' },
                      diabetes: { type: 'number' },
                      stroke: { type: 'number', description: '2 points' },
                      vascularDisease: { type: 'number' },
                      age65to74: { type: 'number' },
                      female: { type: 'number' }
                    }
                  },
                  strokeRisk: { type: 'string', description: 'Annual stroke risk % (e.g., "2.2%")' },
                  recommendation: { type: 'string', description: 'CRITICAL: Anticoagulation recommendation based on score (Score 0 male/1 female: No AC, Score 1 male: Consider AC, Score ≥2: AC recommended)' }
                },
                description: 'CHA2DS2-VASc score for AF stroke risk and anticoagulation decisions'
              },
              hasbled: {
                type: 'object',
                properties: {
                  score: { type: 'number', description: 'HAS-BLED score (0-9)' },
                  components: {
                    type: 'object',
                    properties: {
                      hypertension: { type: 'number' },
                      abnormalRenalLiverFunction: { type: 'number', description: '1 point each (max 2)' },
                      stroke: { type: 'number' },
                      bleeding: { type: 'number' },
                      labileInr: { type: 'number' },
                      elderly: { type: 'number', description: 'Age >65' },
                      drugAlcohol: { type: 'number', description: '1 point each (max 2)' }
                    }
                  },
                  bleedingRisk: { type: 'string', description: 'Annual major bleeding risk % (e.g., "3.7%")' },
                  interpretation: { type: 'string', description: 'Score ≥3 indicates high bleeding risk - does NOT mean avoid anticoagulation, means closer monitoring' }
                },
                description: 'HAS-BLED score for bleeding risk on anticoagulation'
              },
              heartScore: {
                type: 'object',
                properties: {
                  score: { type: 'number', description: 'HEART score (0-10)' },
                  majorCardiacEventRisk: { type: 'string', description: '6-week MACE risk % (e.g., "1.7%" for score 3, "12-65%" for score 7-10)' },
                  recommendation: { type: 'string', description: 'Score 0-3: Safe for discharge, 4-6: Observation/stress test, 7-10: Urgent cath' }
                },
                description: 'HEART score for chest pain ED risk stratification'
              },
              graceScore: {
                type: 'object',
                properties: {
                  score: { type: 'number', description: 'GRACE score' },
                  inHospitalMortality: { type: 'string', description: 'In-hospital mortality risk %' },
                  sixMonthMortality: { type: 'string', description: '6-month mortality risk %' },
                  riskCategory: { type: 'string', enum: ['Low risk (<109)', 'Intermediate risk (109-140)', 'High risk (>140)'] },
                  recommendation: { type: 'string', description: 'High risk: Early invasive strategy recommended' }
                },
                description: 'GRACE score for ACS mortality risk and treatment strategy'
              },
              stopbangScore: {
                type: 'object',
                properties: {
                  score: { type: 'number', description: 'STOP-BANG score (0-8)' },
                  osaRisk: { type: 'string', enum: ['Low risk (0-2)', 'Intermediate risk (3-4)', 'High risk (5-8)'] },
                  recommendation: { type: 'string', description: 'Score ≥3: Sleep study recommended' }
                },
                description: 'STOP-BANG score for obstructive sleep apnea screening'
              },
              wellsScore: {
                type: 'object',
                properties: {
                  dvtScore: { type: 'number', description: 'Wells DVT score' },
                  peScore: { type: 'number', description: 'Wells PE score' },
                  probability: { type: 'string', enum: ['Low probability', 'Moderate probability', 'High probability'] },
                  recommendation: { type: 'string', description: 'Testing recommendation based on score and D-dimer' }
                },
                description: 'Wells score for DVT/PE probability'
              }
            },
            description: 'Clinical risk scoring systems for evidence-based decision making'
          },

          qualityMetrics: {
            type: 'object',
            properties: {
              metricName: { type: 'string', description: 'Quality metric name (e.g., "Door-to-balloon time", "Time to antibiotics in sepsis", "Stroke thrombolysis time", "CABG surgical site infection rate")' },
              targetValue: { type: 'string', description: 'Target/benchmark value (e.g., "<90 minutes", "<1 hour", "<3%")' },
              actualValue: { type: 'string', description: 'Actual measured value for this case (e.g., "78 minutes", "45 minutes", "2.1%")' },
              metricMet: { type: 'boolean', description: 'CRITICAL: Was quality metric target achieved' },
              barriers: { type: 'array', items: { type: 'string' }, description: 'Barriers if metric not met (e.g., "Delayed EMS transport", "Radiology delay", "Late recognition of sepsis")' },
              improvementPlan: { type: 'string', description: 'QI plan if metric not met' }
            },
            description: 'Quality metrics tracking for process improvement and regulatory reporting'
          },

          sportsMedicineEvaluations: {
            type: 'object',
            properties: {
              sport: { type: 'string', description: 'Sport/activity (e.g., "Football", "Basketball", "Track", "Swimming", "Recreational running")' },
              level: { type: 'string', description: 'Competition level (Professional, College, High school, Recreational)' },
              position: { type: 'string', description: 'Position played if applicable' },
              cardiacScreening: {
                type: 'object',
                properties: {
                  personalHistory: { type: 'array', items: { type: 'string' }, description: 'Personal cardiac history red flags' },
                  familyHistory: { type: 'array', items: { type: 'string' }, description: 'Family history of sudden cardiac death <50 years old, cardiomyopathy, channelopathies' },
                  physicalExam: {
                    type: 'object',
                    properties: {
                      heartMurmur: { type: 'boolean', description: 'Heart murmur detected' },
                      marfanoidFeatures: { type: 'boolean' },
                      abnormalPulses: { type: 'boolean' }
                    }
                  },
                  ecgPerformed: { type: 'boolean', description: 'ECG performed per AHA recommendations' },
                  ecgFindings: { type: 'string' },
                  echoRecommended: { type: 'boolean', description: 'Echo recommended for further evaluation' },
                  clearanceDecision: { type: 'string', enum: ['Cleared without restrictions', 'Cleared with restrictions', 'Not cleared - further evaluation needed', 'Not cleared - contraindication to sports'], description: 'CRITICAL: Cardiac clearance decision' }
                },
                description: 'CRITICAL: Cardiac screening to prevent sudden cardiac death in athletes'
              },
              musculoskeletalExam: {
                type: 'object',
                properties: {
                  rom: { type: 'string', description: 'Range of motion assessment' },
                  strength: { type: 'string', description: 'Strength testing' },
                  instability: { type: 'array', items: { type: 'string' }, description: 'Joint instability findings (e.g., "Positive Lachman test", "Shoulder apprehension")' },
                  previousInjuries: { type: 'array', items: { type: 'string' } },
                  concerns: { type: 'array', items: { type: 'string' }, description: 'MSK concerns for sport participation' }
                }
              },
              restrictions: { type: 'array', items: { type: 'string' }, description: 'Sport restrictions (e.g., "No contact sports", "Swimming only", "Brace required")' },
              clearanceStatus: { type: 'string', enum: ['Cleared', 'Cleared with restrictions', 'Not cleared'], description: 'CRITICAL: Overall sports clearance status' },
              returnToPlayPlan: { type: 'string', description: 'Return to play plan after injury' }
            },
            description: 'Sports medicine pre-participation evaluation and clearance'
          },

          occupationalMedicineEvaluations: {
            type: 'object',
            properties: {
              occupation: { type: 'string', description: 'Job title/occupation (e.g., "Construction worker", "Nurse", "Office worker", "Truck driver")' },
              employer: { type: 'string' },
              workInjury: {
                type: 'object',
                properties: {
                  dateOfInjury: { type: 'string' },
                  mechanismOfInjury: { type: 'string', description: 'How injury occurred (e.g., "Lifted 50 lb box - felt pop in back", "Slipped on wet floor")' },
                  bodyPartInjured: { type: 'string', description: 'Injured body part (e.g., "Lumbar spine", "Right shoulder", "Left knee")' },
                  witnessesPresent: { type: 'boolean' },
                  supervisorNotified: { type: 'boolean' },
                  incidentReportFiled: { type: 'boolean' }
                }
              },
              occupationalExposure: {
                type: 'object',
                properties: {
                  exposureType: { type: 'string', description: 'Exposure type (Chemical, Biological, Radiation, Noise, Repetitive motion)' },
                  agent: { type: 'string', description: 'Specific agent (e.g., "Asbestos", "Lead", "Bloodborne pathogen - needlestick", "Organic solvents")' },
                  ppeUsed: { type: 'boolean', description: 'Personal protective equipment in use' },
                  reportingRequired: { type: 'boolean', description: 'OSHA reporting required' }
                }
              },
              functionalCapacityEvaluation: {
                type: 'object',
                properties: {
                  liftingCapacity: { type: 'string', description: 'Maximum safe lifting weight (e.g., "20 lbs occasional, 10 lbs frequent")' },
                  standing: { type: 'string', description: 'Standing tolerance (e.g., "2 hours max")' },
                  sitting: { type: 'string' },
                  walking: { type: 'string' }
                }
              },
              workRestrictions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    restriction: { type: 'string', description: 'Restriction (e.g., "No lifting >10 lbs", "No overhead reaching", "No prolonged standing", "No driving")' },
                    duration: { type: 'string', description: 'Duration (Temporary 2 weeks, Permanent)' }
                  }
                },
                description: 'CRITICAL: Work restrictions for employer'
              },
              returnToWorkStatus: { type: 'string', enum: ['Full duty', 'Light duty', 'Modified duty with restrictions', 'Off work'], description: 'CRITICAL: Return to work status' },
              workersCompClaim: { type: 'boolean', description: 'Workers compensation claim filed' },
              impairmRating: { type: 'string', description: 'Permanent impairment rating if applicable (e.g., "5% whole person impairment")' }
            },
            description: 'Occupational medicine evaluation for work injury/exposure and fitness for duty'
          },

          careGaps: {
            type: 'object',
            properties: {
              screenings: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    screeningType: { type: 'string', description: 'Name of the screening or preventive care (e.g., "Sleep apnea screening", "Lipid panel")' },
                    category: { type: 'string', description: 'Category of care gap: Screening, Vaccination, Monitoring, Preventive Care, etc.' },
                    status: { type: 'string', enum: ['Missing', 'Overdue', 'Due Soon', 'Completed'], description: 'Current status of this care item' },
                    dueDate: { type: 'string', description: 'CRITICAL: Calculate actual date in YYYY-MM-DD format based on the DOCUMENT DATE you extracted above. Examples: If document date is 2024-11-29 and screening is "due in 2-3 weeks", calculate: 2024-11-29 + 3 weeks = 2024-12-20. If "annually", add 1 year: 2024-11-29 + 1 year = 2025-11-29. If "at cardiology visit in 1 month", calculate: 2024-11-29 + 1 month = 2024-12-29. ALWAYS provide calculated YYYY-MM-DD dates relative to document date, NEVER use relative text like "in 2 weeks" or "annually".' },
                    actionRequired: { type: 'string', description: 'Specific action to address this gap (e.g., "Consider lipid panel and diabetes screening at next visit")' },
                    priority: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Urgency of addressing this gap' }
                  },
                  required: ['screeningType', 'category', 'status', 'actionRequired', 'priority']
                }
              }
            },
            description: 'AI-generated care gaps analysis - identify missing screenings, preventive care, and follow-up needs'
          },

          outcomesPrediction: {
            type: 'object',
            properties: {
              prognosis: { type: 'string', description: 'Overall predicted trajectory and prognosis for the patient - focus on general outlook, risk factors, and protective factors. DO NOT include specific expected outcomes here (those go in expectedOutcomes field). CRITICAL: When mentioning patient name with title, keep them on same line with space (e.g., "Mr. Wilson" not "Mr.\\nWilson"). No line breaks after titles.' },
              modifiableFactors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    factor: { type: 'string', description: 'Modifiable risk factor (e.g., "Caffeine intake (high - 3-4 cups daily)", "Work stress (high - new position)")' },
                    impact: { type: 'string', description: 'CRITICAL: Only the quantitative BENEFIT/IMPACT (e.g., "May decrease AF episode frequency by 30-50%"). Do NOT include recommendations here.' },
                    recommendation: { type: 'string', description: 'CRITICAL: Specific actionable RECOMMENDATION to address this factor (e.g., "Reduce caffeine to <100mg daily (1 cup), consider gradual taper over 2 weeks"). REQUIRED - must be separate from impact.' }
                  },
                  required: ['factor', 'impact', 'recommendation']
                }
              },
              expectedOutcomes: { type: 'string', description: 'DETAILED expected outcomes with current treatment plan and recommended interventions. List specific measurable outcomes in numbered format (1, 2, 3, etc.) covering all relevant clinical parameters, quality of life improvements, and long-term goals.' },
              priority: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Overall priority for outcome optimization' }
            },
            required: ['prognosis', 'modifiableFactors', 'expectedOutcomes'],
            description: 'AI-generated outcomes prediction - predict patient trajectory, identify modifiable factors, and estimate intervention impact'
          }
        },
        // Required fields - patient data + AI insights
        required: [
          'patientName',
          'category',
          'clinicalDecisionSupport',
          'intelligentRecommendations',
          'trendingAnalysis',
          'patientSpecificCarePlan',
          'medicationsOptimizations',
          'doctorsMedicationsRecommendationsOptimizations',
          'followUpIntelligence',
          'patientEducationContext',
          'guidelineCompliance',
          'careGaps',
          'outcomesPrediction',
          'giRiskAssessment'
        ]
      }
    };
  }
  
  extractAnalysisFromToolUse(toolUses) {
    if (!toolUses || toolUses.length === 0) {
      return null;
    }

    // Detect format: NEW multi-tool format vs OLD single-tool format
    const isMultiToolFormat = toolUses.length > 1 || (toolUses[0] && toolUses[0].name.startsWith('extract_'));
    const isOldFormat = toolUses.length === 1 && toolUses[0].name === 'extract_medical_data';

    let extractedData = {};

    if (isMultiToolFormat && !isOldFormat) {
      // NEW FORMAT: Multiple collection-specific tools (extract_diagnoses, extract_medications, etc.)
      console.log(`🔧 Processing NEW multi-tool format: ${toolUses.length} tool uses`);

      // Group tool uses by collection name
      for (const toolUse of toolUses) {
        // Extract collection name from tool name: "extract_diagnoses" → "diagnoses"
        const collectionName = toolUse.name.replace(/^extract_/, '');

        // Initialize array for this collection if not exists
        if (!extractedData[collectionName]) {
          extractedData[collectionName] = [];
        }

        // Add tool input to collection array
        extractedData[collectionName].push(toolUse.input);
      }

      console.log(`✅ Grouped into ${Object.keys(extractedData).length} collections`);

    } else if (isOldFormat) {
      // SINGLE-TOOL FORMAT: one extract_medical_data call carrying all collections
      // (one-shot composite tool from Phase 2 - also covers the legacy single-tool format)
      console.log(`🔧 Processing single-tool extract_medical_data format`);
      const toolUse = toolUses[0];
      extractedData = toolUse.input;

      // Seatbelt: the save path requires every collection value to be an ARRAY of
      // records (a bare object under medications throws in saveComprehensiveData,
      // bare objects elsewhere are silently dropped, and a STRING would be spread
      // char-by-char into garbage records). Normalize values - but only for keys
      // that are real collections in the unified schemas.
      const unifiedSchemasForGuard = require('./unifiedMedicalSchemas');
      for (const [key, value] of Object.entries(extractedData)) {
        // top-level scalars of the composite tool - never collection data
        if (key === 'patient_name' || key === 'patientName' || key === 'category') continue;
        if (Array.isArray(value) || value === null || value === undefined) continue;

        const collectionSchema = unifiedSchemasForGuard.getExtractionSchema(key);
        if (!collectionSchema || Object.keys(collectionSchema).length === 0) continue; // not a collection key

        if (typeof value === 'object') {
          console.warn(`⚠️ Wrapping single ${key} object in array for save-path compatibility`);
          extractedData[key] = [value];
        } else {
          console.warn(`⚠️ Dropping non-record ${typeof value} value for collection ${key} - not saveable`);
          delete extractedData[key];
        }
      }

      // The composite tool emits snake_case patient_name; legacy consumers
      // (updatePatientCore, background patient-name lookup) read camelCase patientName.
      if (extractedData.patient_name && !extractedData.patientName) {
        extractedData.patientName = extractedData.patient_name;
      }
    } else {
      console.warn(`⚠️ Unknown tool format, returning null`);
      return null;
    }

    // Shared validation and logging for BOTH formats
    // Function to count all fields including nested arrays and objects
    const countAllFields = (obj, path = '') => {
      let count = 0;
      let fields = [];

      for (const [key, value] of Object.entries(obj || {})) {
        const currentPath = path ? `${path}.${key}` : key;

        if (value === null || value === undefined) {
          continue;
        }

        if (Array.isArray(value)) {
          // For arrays, count each item as a separate field
          if (value.length > 0) {
            count += value.length;
            fields.push(`${currentPath}[${value.length} items]`);

            // If array contains objects, count their subfields too
            value.forEach((item, index) => {
              if (typeof item === 'object' && item !== null) {
                const subResult = countAllFields(item, `${currentPath}[${index}]`);
                count += subResult.count - 1; // -1 because we already counted the item
              }
            });
          }
        } else if (typeof value === 'object') {
          // For nested objects, count all subfields
          const subResult = countAllFields(value, currentPath);
          count += subResult.count;
          fields.push(...subResult.fields);
        } else {
          // For primitive values, count as 1
          count++;
          fields.push(currentPath);
        }
      }

      return { count, fields };
    };

    const fieldCount = countAllFields(extractedData);

    // DEBUG: Log the FULL AI response to see exactly what fields AI returned
    console.log('🔍 RAW AI RESPONSE - Fields extracted by AI:');
    console.log('   Top-level fields:', Object.keys(extractedData || {}).length);
    console.log('   Total fields (including nested):', fieldCount.count);
    console.log('   Top-level field names:', Object.keys(extractedData || {}).join(', '));

    // Log extraction validation
    const fileLogger = require('../utils/fileLogger');

    // With 758 medical collections, we use dynamic schema validation
    // For multi-tool format, category might be in administrative_data[0]

    // Extract category from administrative_data array (multi-tool format) or top-level (old format)
    let category = extractedData.category;
    if (!category && extractedData.administrative_data?.length > 0) {
      // Check both direct category and nested documentData.category
      category = extractedData.administrative_data[0].category ||
                 extractedData.administrative_data[0].documentData?.category;

      // CRITICAL: Set extracted category on top-level extractedData so it's available downstream
      if (category) {
        extractedData.category = category;
      }
    }

    const criticalFields = ['category'];
    const extractedFields = Object.keys(extractedData || {});

    // Check for critical missing fields (check extracted category, not just top-level)
    const criticalMissing = criticalFields.filter(field => {
      if (field === 'category') {
        return !category || category === '';
      }
      return !extractedData[field] || extractedData[field] === '';
    });

    // Check for empty fields (but don't enforce specific fields)
    const emptyFields = extractedFields.filter(field => {
      const value = extractedData[field];
      return value === '' ||
             (Array.isArray(value) && value.length === 0) ||
             (typeof value === 'object' && value !== null && Object.keys(value).length === 0);
    });

    // Log extraction statistics with proper counts
    fileLogger.documentProcessing(`📊 Field Extraction Statistics:`);
    fileLogger.documentProcessing(`   - Document category: ${category || 'unknown'}`);
    fileLogger.documentProcessing(`   - Top-level fields: ${extractedFields.length}`);
    fileLogger.documentProcessing(`   - Total data points extracted: ${fieldCount.count}`);

    // Only show detailed field info if there are issues
    if (criticalMissing.length > 0) {
      fileLogger.error(`   ❌ Critical fields missing: ${criticalMissing.join(', ')}`);
    }

    if (emptyFields.length > 0 && emptyFields.length <= 10) {
      fileLogger.documentProcessing(`   📝 Empty fields (${emptyFields.length}): ${emptyFields.join(', ')}`);
    } else if (emptyFields.length > 10) {
      fileLogger.documentProcessing(`   📝 ${emptyFields.length} fields are empty (normal for category: ${category})`);
    }

    // Log what fields were actually extracted with detailed breakdown
    const nonEmptyFields = extractedFields.filter(field => !emptyFields.includes(field));
    if (nonEmptyFields.length > 0 && nonEmptyFields.length <= 15) {
      fileLogger.documentProcessing(`   ✅ Populated fields: ${nonEmptyFields.join(', ')}`);
    } else if (nonEmptyFields.length > 15) {
      fileLogger.documentProcessing(`   ✅ ${nonEmptyFields.length} top-level fields populated`);
    }

    // Add detailed breakdown of nested data
    fileLogger.documentProcessing(`   📈 Data breakdown:`);

    // Count specific data types
    const medications = extractedData.medications?.length || 0;
    const diagnoses = extractedData.diagnoses?.length || 0;
    const labResults = extractedData.lab_results?.length || extractedData.labResults?.length || 0;
    const procedures = extractedData.procedures?.length || 0;
    const appointments = extractedData.follow_up_appointments?.length || extractedData.followUpAppointments?.length || 0;
    const education = extractedData.patient_education_context?.length || extractedData.patientEducation?.length || 0;

    if (medications > 0) fileLogger.documentProcessing(`      - ${medications} medications`);
    if (diagnoses > 0) fileLogger.documentProcessing(`      - ${diagnoses} diagnoses`);
    if (labResults > 0) fileLogger.documentProcessing(`      - ${labResults} lab results`);
    if (procedures > 0) fileLogger.documentProcessing(`      - ${procedures} procedures`);
    if (appointments > 0) fileLogger.documentProcessing(`      - ${appointments} follow-up appointments`);
    if (education > 0) fileLogger.documentProcessing(`      - ${education} education topics`);

    // Show total data points
    fileLogger.documentProcessing(`   💡 Total unique data points: ${fieldCount.count}`);

    // NO LONGER force-adding missing fields since schema is dynamic per category
    // Each document type has its own relevant fields

    return extractedData;
  }
  
  /**
   * Process a single document synchronously with batch API (50% cost savings)
   * Waits for the result instead of returning a batch ID
   */
  async processSingleDocumentSync(fileBuffer, fileName, mimeType, sessionId, documentId = null) {
    try {
      console.log('🚀 Processing single document with Claude batch API (50% cost savings)');
      console.log(`📄 Document: ${fileName}, Type: ${mimeType}`);
      
      // Handle different input types
      let base64Content;
      if (Buffer.isBuffer(fileBuffer)) {
        base64Content = fileBuffer.toString('base64');
        console.log(`✅ Converted Buffer to base64, length: ${base64Content.length}`);
      } else if (typeof fileBuffer === 'string') {
        // Already base64
        base64Content = fileBuffer;
        console.log(`ℹ️ Content already base64, length: ${base64Content.length}`);
      } else {
        throw new Error(`Invalid fileBuffer type: ${typeof fileBuffer}`);
      }
      
      // Create document object for batch processing
      const document = {
        content: base64Content,  // Standardized field name
        mimeType: mimeType || 'application/pdf',
        fileName: fileName,
        documentId: documentId  // CRITICAL: Include documentId for data linkage
      };
      
      // Create batch with single document
      const batchResult = await this.createDocumentAnalysisBatch(
        [document],
        sessionId || 'single-doc-analysis'
      );
      
      if (!batchResult.success) {
        throw new Error('Failed to create batch: ' + batchResult.error);
      }
      
      const batchId = batchResult.batchId;
      console.log(`📦 Batch created: ${batchId}`);
      
      // Poll for results (usually completes in < 1 minute for single document)
      let attempts = 0;
      const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max
      let results = null;
      let lastStatus = '';
      let lastProgress = '';
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const status = await this.checkBatchStatus(batchId);
        
        // Only log if status or progress changed significantly
        if (status.status !== lastStatus || status.progress !== lastProgress) {
          // Only show meaningful updates
          if (status.status === 'in_progress' && lastStatus === 'in_progress') {
            // Don't log repeated in_progress with same 0/0 progress
            if (status.progress === '0/0' && lastProgress === '0/0') {
              // Skip this log
            } else {
              console.log(`⏳ Batch processing: ${status.progress}`);
            }
          } else {
            // Status changed - always log this
            console.log(`📦 Batch ${status.status}: ${status.progress}`);
          }
          lastStatus = status.status;
          lastProgress = status.progress;
        }
        
        if (status.status === 'ended' || status.status === 'completed') {
          // Get the results
          results = await this.getBatchResults(batchId);
          break;
        } else if (status.status === 'failed' || status.status === 'cancelled') {
          throw new Error(`Batch processing failed: ${status.status}`);
        }
        
        attempts++;
        
        // Log every 10 attempts (20 seconds) to show we're still working
        if (attempts % 10 === 0 && status.status === 'in_progress') {
          console.log(`⏳ Still processing... (${attempts * 2}s elapsed)`);
        }
      }
      
      if (!results) {
        throw new Error('Batch processing timeout - no results after 2 minutes');
      }
      
      // Extract the first (and only) result
      if (results && results.length > 0) {
        const result = results[0];
        
        // Check if we got successful analysis
        if (result.success && result.analysis) {
          console.log('✅ Document analysis complete');
          console.log(`📋 Patient name: ${result.analysis.patientName || 'NOT FOUND'}`);
          console.log(`📂 Category: ${result.analysis.category || 'NOT DETERMINED'}`);
          
          // Return in format compatible with documentAnalysisService
          return {
            success: true,
            data: result.analysis,
            category: result.analysis.category,
            patientName: result.analysis.patientName,
            extractedData: result.analysis
          };
        } else if (result.error) {
          console.error('❌ Batch result error:', result.error);
          throw new Error(result.error);
        }
      }
      
      throw new Error('No valid extraction data in batch results');
      
    } catch (error) {
      console.error('❌ Batch processing error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  calculateSavings(documentCount) {
    // Rough estimate: 2000 tokens per document analysis
    const tokensPerDoc = 2000;
    const totalTokens = documentCount * tokensPerDoc;
    
    // Claude Sonnet pricing: $3 per 1M input tokens, $15 per 1M output tokens
    // Assuming 80% input, 20% output
    const inputCost = (totalTokens * 0.8 / 1000000) * 3;
    const outputCost = (totalTokens * 0.2 / 1000000) * 15;
    const regularCost = inputCost + outputCost;
    
    // Batch saves 50%
    const savings = regularCost * 0.5;
    
    return savings.toFixed(2);
  }
  
  calculateRegularCost(documentCount) {
    const tokensPerDoc = 2000;
    const totalTokens = documentCount * tokensPerDoc;
    const inputCost = (totalTokens * 0.8 / 1000000) * 3;
    const outputCost = (totalTokens * 0.2 / 1000000) * 15;
    return inputCost + outputCost;
  }
  
  /**
   * Cancel a batch job
   * @param {String} batchId - The batch ID to cancel
   */
  async cancelBatch(batchId) {
    try {
      const response = await axios.post(
        `https://api.anthropic.com/v1/messages/batches/${batchId}/cancel`,
        {},
        {
          headers: {
            'x-api-key': await this.getApiKey(),
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      console.log(`⚠️ Batch ${batchId} cancelled`);
      return response.data;
      
    } catch (error) {
      console.error('❌ Batch cancellation error:', error.message);
      throw error;
    }
  }
  
  /**
   * List all batches for the account
   * @param {Object} options - Filter options
   */
  async listBatches(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.before_id) params.append('before_id', options.before_id);
      if (options.after_id) params.append('after_id', options.after_id);
      
      const response = await axios.get(
        `https://api.anthropic.com/v1/messages/batches?${params.toString()}`,
        {
          headers: {
            'x-api-key': await this.getApiKey(),
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      return response.data;
      
    } catch (error) {
      console.error('❌ Error listing batches:', error.message);
      throw error;
    }
  }

  /**
   * Process multiple documents in ONE batch for maximum cost savings
   * @param {Object} params - Batch processing parameters
   * @param {Array} params.files - Array of files to process
   * @param {string} params.patientId - Patient ID to associate documents with
   * @param {Object} params.practiceContext - Practice context
   * @param {string} params.uploadId - Upload batch ID
   */
  async analyzeBatchDocuments(params) {
    // Declare batchResult at function scope so it's accessible in catch block
    let batchResult;
    
    try {
      const { files, patientId, practiceContext, uploadId, sessionId, userId } = params;

      // ALWAYS use background processing - never wait
      const options = { backgroundProcessing: true };
      
      if (!files || files.length === 0) {
        return {
          success: false,
          error: 'No files provided for batch processing'
        };
      }

      console.log(`📦 Creating SINGLE batch job for ${files.length} documents`);
      console.log(`📦 Files to batch: ${files.map(f => f.fileName).join(', ')}`);
      if (sessionId) {
        console.log(`📦 Session ID for tracking: ${sessionId}`);
      }

      // Emit notification that we're preparing the batch
      if (global.io) {
        const preparingNotification = {
          type: 'document_processing',
          batchId: `pending_${Date.now()}`,
          patientId: patientId,
          patientName: params.patientName || 'Patient',
          documentsProcessed: 0,
          totalDocuments: files.length,
          progress: 0,
          status: 'preparing',
          message: `Preparing ${files.length} document(s) for analysis...`,
          timestamp: new Date()
        };

        // Store progress in database for frontend polling (non-blocking)
        // Get batchProgressCache from service proxy manager
        const serviceProxyManager = require('./serviceProxyManager');
        let batchProgressCache = null;
        try {
          // Check if service is loaded before trying to use it
          if (serviceProxyManager.isLoaded('batchProgressCache')) {
            batchProgressCache = serviceProxyManager.get('batchProgressCache');
          } else {
            console.log('⚠️ BatchProgressCache service not loaded yet');
          }
        } catch (e) {
          console.log('⚠️ BatchProgressCache service not available:', e.message);
        }
        const tempBatchId = `preparing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        if (practiceContext && practiceContext.practiceId) {
          console.log(`📊 Storing batch progress - patientId: ${patientId || 'none'}, practiceId: ${practiceContext.practiceId}`);

          const progressUpdate = {
            batchId: tempBatchId,
            patientId: patientId || null,
            practiceId: practiceContext.practiceId,
            progress: 0,
            status: 'preparing',
            documentsProcessed: 0,
            totalDocuments: files.length,
            message: `Preparing ${files.length} document(s) for analysis...`,
            updatedAt: new Date()
          };

          // Update cache immediately for real-time updates
          if (batchProgressCache) {
            batchProgressCache.updateProgress(tempBatchId, progressUpdate, true); // Force initial DB write
          }

          // Store the temporary batch ID for later updates
          practiceContext.tempBatchId = tempBatchId;
        } else {
          console.log(`⚠️ Cannot store batch progress - missing practiceContext or practiceId`);
          console.log(`   practiceContext:`, practiceContext);
        }
      }
      
      // Validate file content before processing
      for (const file of files) {
        console.log(`🔍 Validating file: ${file.fileName}`);
        console.log(`   fileContent type: ${typeof file.fileContent}`);
        if (typeof file.fileContent === 'string') {
          console.log(`   fileContent length: ${file.fileContent.length}`);
          console.log(`   First 50 chars: ${file.fileContent.substring(0, 50)}`);
        } else {
          console.error(`   ❌ fileContent is not a string!`);
          console.error(`   Value:`, file.fileContent);
        }
      }
      
      // Prepare all documents for batch processing with validated content
      // NOTE: PDF complexity detection is handled in createTwoPassBatch() (lines 159-193)
      // to avoid duplicate detection
      const documents = [];

      for (let index = 0; index < files.length; index++) {
        const file = files[index];

        // Validate and normalize content field
        let content = file.fileContent || file.content;

        if (!content) {
          console.error(`❌ No content in file ${file.fileName}`);
          continue; // Skip this file
        }

        // If content is a Buffer, convert to base64
        if (Buffer.isBuffer(content)) {
          content = content.toString('base64');
          console.log(`✅ Converted Buffer to base64 for ${file.fileName}`);
        }

        // If content is a MongoDB Binary object, extract the buffer
        if (typeof content === 'object' && content._bsontype === 'Binary') {
          content = Buffer.from(content.buffer).toString('base64');
          console.log(`✅ Extracted base64 from MongoDB Binary for ${file.fileName}`);
        }

        // Validate it's a string now
        if (typeof content !== 'string') {
          console.error(`❌ Content is not a string after conversion for ${file.fileName}:`, typeof content);
          continue;
        }

        documents.push({
          customId: `doc_${index}_${uploadId}`,
          fileName: file.fileName,
          content: content, // Base64 PDF or text content
          contentType: file.mimeType || 'application/pdf',
          mimeType: file.mimeType || 'application/pdf',
          patientId: patientId,
          // CRITICAL FIX: Include documentId with fallback to _id or id
          documentId: file.documentId || file._id?.toString() || file.id
        });
      }
      
      if (documents.length === 0) {
        console.error('❌ No valid documents after validation');
        return {
          success: false,
          error: 'No valid documents to process'
        };
      }

      console.log(`📦 Sending ${documents.length} documents to createDocumentAnalysisBatch`);
      if (sessionId) {
        console.log(`📦 Including sessionId for chat notifications: ${sessionId}`);
      }
      if (userId) {
        console.log(`📦 Including userId for message attribution: ${userId}`);
      }

      // Try to create batch with all documents
      try {
        // CRITICAL: Pass sessionId and userId in options for Phase 1 reasoning to appear in chat
        batchResult = await this.createDocumentAnalysisBatch(documents, practiceContext?.practiceId || 'default', { sessionId, userId });
      } catch (batchError) {
        const errorMsg = batchError.message || batchError.toString() || 'Unknown batch error';
        console.error('❌ Batch creation failed:', errorMsg);
        console.log('🔄 Falling back to individual document processing...');
        
        // Failover: Process each document individually
        const individualResults = [];
        for (const doc of documents) {
          try {
            console.log(`📄 Processing ${doc.fileName} individually...`);

            // Convert base64 back to Buffer for single processing
            const fileBuffer = Buffer.from(doc.content, 'base64');

            const result = await this.processSingleDocumentSync(
              fileBuffer,
              doc.fileName,
              doc.mimeType,
              practiceContext?.practiceId || 'single-doc-fallback',
              doc.documentId  // CRITICAL: Pass documentId for data linkage
            );

            individualResults.push({
              success: result.success,
              fileName: doc.fileName,
              data: result.data || result.extractedData,
              error: result.error
            });

            console.log(`✅ ${doc.fileName}: ${result.success ? 'Success' : 'Failed'}`);
          } catch (docError) {
            console.error(`❌ Failed to process ${doc.fileName}:`, docError.message);
            individualResults.push({
              success: false,
              fileName: doc.fileName,
              error: docError.message
            });
          }
        }
        
        // Return failover results
        const successCount = individualResults.filter(r => r.success).length;
        return {
          success: successCount > 0,
          batchId: 'failover-individual-processing',
          results: individualResults,
          message: `Processed ${successCount}/${documents.length} documents individually (failover mode)`,
          savings: 0 // No batch savings in failover mode
        };
      }
      
      if (!batchResult.success) {
        console.error('❌ Batch result not successful');
        // Try failover to individual processing
        console.log('🔄 Attempting failover to individual processing...');
        
        const individualResults = [];
        for (const doc of documents) {
          try {
            const fileBuffer = Buffer.from(doc.content, 'base64');
            const result = await this.processSingleDocumentSync(
              fileBuffer,
              doc.fileName,
              doc.mimeType,
              practiceContext?.practiceId || 'single-doc-fallback',
              doc.documentId  // CRITICAL: Pass documentId for data linkage
            );

            individualResults.push({
              success: result.success,
              fileName: doc.fileName,
              data: result.data || result.extractedData,
              error: result.error
            });
          } catch (docError) {
            individualResults.push({
              success: false,
              fileName: doc.fileName,
              error: docError.message
            });
          }
        }
        
        const successCount = individualResults.filter(r => r.success).length;
        return {
          success: successCount > 0,
          batchId: 'failover-individual-processing',
          results: individualResults,
          message: `Processed ${successCount}/${documents.length} documents individually (failover)`,
          savings: 0
        };
      }

      console.log(`✅ Created SINGLE batch ${batchResult.batchId} with ${files.length} documents`);
      console.log(`💰 Total estimated savings: $${batchResult.estimatedSavings}`);

      // Store batch progress in database for frontend polling
      if (practiceContext && practiceContext.practiceId) {
        console.log(`📊 Storing batch processing progress - batchId: ${batchResult.batchId}`);
        const SecureDataAccess = require('./secureDataAccess');
        const progressUpdate = {
          batchId: batchResult.batchId,
          patientId: patientId || null,
          progress: 0,
          status: 'processing',
          documentsProcessed: 0,
          totalDocuments: files.length,
          message: `Processing ${files.length} document(s)...`,
          updatedAt: new Date()
        };

        // Get batchProgressCache from service proxy manager
        const serviceProxyManager = require('./serviceProxyManager');
        let batchProgressCache = null;
        try {
          if (serviceProxyManager.isLoaded('batchProgressCache')) {
            batchProgressCache = serviceProxyManager.get('batchProgressCache');
            batchProgressCache.updateProgress(batchResult.batchId, progressUpdate);
          }
        } catch (e) {
          // Service not available, skip progress update
        }
      }

      // Store batch ID to prevent duplicate processing
      if (!this.activeBatches) {
        this.activeBatches = new Map(); // Use Map to store batch info
      }
      
      // Check if this batch is already being processed
      if (this.activeBatches.has(batchResult.batchId)) {
        console.log(`⚠️ Batch ${batchResult.batchId} is already being processed, skipping duplicate`);
        return {
          success: false,
          error: 'Batch already in progress',
          isDuplicate: true,
          batchId: batchResult.batchId
        };
      }
      
      // ALWAYS process in background - return IMMEDIATELY
      console.log(`🚀 Batch ${batchResult.batchId} submitted for background processing`);
      
      // Store batch info for status checking
      this.activeBatches.set(batchResult.batchId, {
        startTime: Date.now(),
        fileCount: files.length,
        status: 'processing',
        uploadId: params.uploadId || null,
        patientId: params.patientId || null,
        practiceContext: practiceContext,
        sessionId: params.sessionId || null // Store sessionId for WebSocket notifications
      });
      
      // Start monitoring in background (non-blocking)
      // This runs completely asynchronously - doesn't block ANYTHING
      setImmediate(() => {
        // Ensure we pass complete params with practiceContext
        const backgroundParams = {
          ...params,
          practiceContext: practiceContext || params.practiceContext,
          uploadId: params.uploadId,
          patientId: params.patientId,
          sessionId: params.sessionId // Include sessionId for WebSocket routing
        };
        
        // Emit initial progress notification immediately
        if (global.io) {
          const initialProgress = {
            type: 'document_processing',
            batchId: batchResult.batchId,
            patientId: params.patientId,
            patientName: params.patientName || 'Patient',
            documentsProcessed: 0,
            totalDocuments: files.length,
            successCount: 0,
            failedCount: 0,
            progress: 0,
            status: 'processing',
            message: 'Starting document analysis...',
            timestamp: new Date()
          };

          // Store initial progress in database
          if (params.patientId && params.practiceContext && params.practiceContext.practiceId) {
            const SecureDataAccess = require('./secureDataAccess');
            const progressRecord = {
              batchId: batchResult.batchId,
              patientId: params.patientId,
              progress: 0,
              status: 'processing',
              documentsProcessed: 0,
              totalDocuments: files.length,
              successCount: 0,
              failedCount: 0,
              message: 'Starting document analysis...',
              createdAt: new Date(),
              updatedAt: new Date()
            };

            // Get batchProgressCache from service proxy manager
            const serviceProxyManager = require('./serviceProxyManager');
            try {
              if (serviceProxyManager.isLoaded('batchProgressCache')) {
                const batchProgressCache = serviceProxyManager.get('batchProgressCache');
                batchProgressCache.updateProgress(batchId, progressRecord, true); // Force initial write
              }
            } catch (e) {
              // Service not available, skip progress update
            }
          }

          // WebSocket progress emissions removed - using database polling instead
        }

        this.monitorBatchInBackground(batchResult.batchId, files, backgroundParams).catch(error => {
          console.error(`❌ Background monitoring error for ${batchResult.batchId}:`, error);
          const batchInfo = this.activeBatches.get(batchResult.batchId);
          if (batchInfo) {
            batchInfo.status = 'failed';
            batchInfo.error = error.message;
          }
        });
      });
      
      // Return IMMEDIATELY - user's screen is cleared and they can continue
      return {
        success: true,
        batchId: batchResult.batchId,
        status: 'submitted',
        message: `✅ ${files.length} document(s) submitted! Analysis may take up to 24 hours. You'll be notified when complete. Feel free to continue with other tasks.`,
        immediateReturn: true,
        clearScreen: true,
        estimatedSavings: batchResult.estimatedSavings,
        fileCount: files.length,
        backgroundProcessing: true
      };
      
      // NO WAITING - batch processes entirely in background

    } catch (error) {
      console.error('❌ Error in analyzeBatchDocuments:', error);
      
      // Clean up active batch on error (safely check if batchResult exists)
      if (typeof batchResult !== 'undefined' && batchResult && batchResult.batchId && this.activeBatches) {
        this.activeBatches.delete(batchResult.batchId);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Monitor batch processing in background without blocking
   * This runs asynchronously and updates the batch status
   */
  async monitorBatchInBackground(batchId, files, params) {
    try {
      let completed = false;
      let attempts = 0;
      let consecutiveNetworkErrors = 0;
      const maxAttempts = 17280; // 24 hours (17280 * 5 seconds)
      const maxConsecutiveNetworkErrors = 100; // Allow many network errors (about 8-10 minutes offline)
      const logInterval = 120; // Log every 10 minutes (120 * 5 seconds)
      let lastKnownStatus = null;

      console.log(`🚀 [Background] Starting resilient monitoring for batch ${batchId}`);

      // Use shorter intervals initially for better progress feedback
      const getWaitTime = (attempt) => {
        if (attempt < 10) return 2000;  // First 10 checks: every 2 seconds
        if (attempt < 30) return 3000;  // Next 20 checks: every 3 seconds
        return 5000;  // After that: every 5 seconds
      };

      while (attempts < maxAttempts && !completed) {
        await new Promise(resolve => setTimeout(resolve, getWaitTime(attempts)));

        let status;
        try {
          status = await this.checkBatchStatus(batchId);

          // Successfully connected - reset network error counter
          if (consecutiveNetworkErrors > 0) {
            console.log(`✅ Network restored for batch ${batchId} after ${consecutiveNetworkErrors} failed attempts`);
            consecutiveNetworkErrors = 0;
          }

          lastKnownStatus = status; // Store last known good status
        } catch (error) {
          // Handle network errors gracefully - DON'T FAIL THE BATCH
          // Check for any network-related error (DNS, connection, timeout, etc.)
          const isNetworkError = error.message?.includes('Network error') ||
              error.message?.includes('canceled') ||
              error.message?.includes('getaddrinfo') ||  // DNS lookup errors
              error.code === 'ERR_CANCELED' ||
              error.code === 'ECONNABORTED' ||
              error.code === 'ETIMEDOUT' ||
              error.code === 'ENOTFOUND' ||
              error.code === 'EAI_AGAIN' ||  // DNS temporary failure
              error.code === 'ECONNREFUSED' ||
              error.code === 'ENETUNREACH' ||
              error.code === 'EHOSTUNREACH' ||
              error.code === 'EPIPE' ||
              error.code === 'ECONNRESET' ||
              error.syscall === 'getaddrinfo' ||  // Any DNS-related syscall
              error.errno === -3001 ||  // EAI_AGAIN errno
              (error.cause && (error.cause.code === 'EAI_AGAIN' || error.cause.syscall === 'getaddrinfo'));

          if (isNetworkError) {

            consecutiveNetworkErrors++;

            // Only log every 10th network error to avoid spam
            if (consecutiveNetworkErrors % 10 === 1 || consecutiveNetworkErrors === 1) {
              if (process.env.QUIET_LOGS !== 'true') console.log(`🔌 Network temporarily unavailable for batch ${batchId} (attempt ${consecutiveNetworkErrors}/${maxConsecutiveNetworkErrors})`);
              console.log(`   Will continue monitoring when connection is restored...`);
            }

            // Store status in database that we're offline but still monitoring
            if (params.practiceContext && params.practiceContext.practiceId && consecutiveNetworkErrors === 1) {
              try {
                const serviceProxyManager = require('./serviceProxyManager');
                if (serviceProxyManager.isLoaded('batchProgressCache')) {
                  const batchProgressCache = serviceProxyManager.get('batchProgressCache');
                  batchProgressCache.updateProgress(batchId, {
                    batchId: batchId,
                    patientId: params.patientId,
                    status: 'monitoring_offline',
                    message: 'Temporarily offline - monitoring will resume when connection is restored',
                    updatedAt: new Date()
                  });
                }
              } catch (dbErr) {
                // Database might also be unreachable if we're offline
              }
            }

            // Only give up if we've been offline for too long
            if (consecutiveNetworkErrors >= maxConsecutiveNetworkErrors) {
              console.warn(`⚠️ Batch ${batchId} has been unreachable for ${maxConsecutiveNetworkErrors} attempts (~10 minutes).`);
              console.log(`   The batch will continue processing on Claude's servers.`);
              console.log(`   You can check the results later when connection is restored.`);

              // Don't mark as failed - just note it's unreachable
              if (params.practiceContext) {
                try {
                  const serviceProxyManager = require('./serviceProxyManager');
                  if (serviceProxyManager.isLoaded('batchProgressCache')) {
                    const batchProgressCache = serviceProxyManager.get('batchProgressCache');
                    batchProgressCache.updateProgress(batchId, {
                      batchId: batchId,
                      patientId: params.patientId,
                      status: 'unreachable',
                      message: 'Batch is processing on Claude servers but currently unreachable. Check back when online.',
                      updatedAt: new Date()
                    });
                  }
                } catch (dbErr) {
                  // Database might be unreachable
                }
              }

              // Exit monitoring but don't fail the batch
              return {
                success: true,
                status: 'unreachable',
                message: 'Batch processing continues on Claude servers. Check back when online.',
                batchId: batchId
              };
            }

            // Continue trying - batch is still processing on Claude's servers
            attempts++;
            continue;
          }

          // Re-throw non-network errors
          console.error(`❌ Non-network error for batch ${batchId}:`, error.message);
          throw error;
        }

        // Emit progress notification every status check if we have progress
        if (status.request_counts && global.io) {
          const counts = status.request_counts;
          const successCount = counts.succeeded || 0;
          const errorCount = counts.errored || 0;
          const canceledCount = counts.canceled || 0;
          const processingCount = counts.processing || 0;
          const totalCount = counts.total || files.length;

          // Calculate actual progress (succeeded + errored + canceled = completed)
          const completedCount = successCount + errorCount + canceledCount;
          const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

          // Create detailed status message
          let statusMessage = `Processing: ${processingCount}/${totalCount}`;
          if (completedCount > 0) {
            statusMessage = `Completed: ${completedCount}/${totalCount} (${successCount} succeeded)`;
          }
          if (processingCount > 0) {
            statusMessage += ` - ${processingCount} in progress`;
          }

          // Update progress in database for frontend polling
          if (params.patientId && params.practiceContext && params.practiceContext.practiceId) {
            const progressUpdate = {
              batchId: batchId,
              patientId: params.patientId,
              progress: progressPercent,
              status: status.status,
              documentsProcessed: completedCount,
              totalDocuments: totalCount,
              processingCount: processingCount,
              successCount: successCount,
              errorCount: errorCount,
              message: statusMessage,
              updatedAt: new Date()
            };

            try {
              // Update batchProgressCache (real-time updates)
              const serviceProxyManager = require('./serviceProxyManager');
              if (serviceProxyManager.isLoaded('batchProgressCache')) {
                const batchProgressCache = serviceProxyManager.get('batchProgressCache');
                batchProgressCache.updateProgress(batchId, progressUpdate);
              }

              // PERSIST to batchStateManager (survives restart)
              const batchStateManager = serviceProxyManager.get('batchStateManager');
              if (batchStateManager) {
                await batchStateManager.updateBatchProgress(batchId, {
                  requestCounts: status.request_counts,
                  progress: progressPercent,
                  status: status.status
                }, params.practiceContext.practiceId);
              }

              console.log(`📊 Updated batch progress: ${progressPercent}%`);
            } catch (err) {
              console.warn(`Failed to update batch progress in DB:`, err);
            }
          }

          // WebSocket progress emissions removed - using database polling instead

          // Log progress for debugging
          console.log(`📊 Batch ${batchId} progress: ${statusMessage} (${progressPercent}%)`);
        }

        // Only log periodically to avoid spam
        if (attempts % logInterval === 0 || status.status === 'ended' || status.status === 'failed') {
          const elapsed = Math.round(attempts * 5 / 60); // minutes
          console.log(`📦 [Background] Batch ${batchId}: ${status.status} (${elapsed} min elapsed, ${status.request_counts?.succeeded || 0}/${files.length} completed)`);
        }

        if (status.status === 'ended') {
          completed = true;

          // Get results and process them
          const batchResults = await this.getBatchResults(batchId);

          if (batchResults && batchResults.length > 0) {
            console.log(`✅ [Background] Batch ${batchId} completed successfully`);

            // Check if this is Phase 1 batch BEFORE marking as complete
            // Phase 1 batches should remain 'phase1_pending' for worker processing
            const SecureDataAccess = require('./secureDataAccess');
            const batchMetadataResults = await SecureDataAccess.query(
              'batch_metadata',
              { batchId: batchId },
              { limit: 1 },
              { serviceId: 'claude-batch-processor', practiceId: 'global' }
            );
            const batchMetadata = batchMetadataResults && batchMetadataResults.length > 0 ? batchMetadataResults[0] : null;
            const isPhase1 = batchMetadata && batchMetadata.phase === 1;

            if (isPhase1) {
              // Phase 1: Keep status as 'phase1_pending', just log completion
              console.log(`📋 Phase 1 batch complete: ${batchId} - Leaving status as 'phase1_pending' for worker`);
              // Don't call processBatchResults or completeBatch - worker will handle Phase 1 → Phase 2
            } else {
              // Phase 2 or legacy: Process results and mark complete
              await this.processBatchResults(batchId, batchResults, files, params);

              // Update batch status in memory
              const batchInfo = this.activeBatches.get(batchId);
              if (batchInfo) {
                batchInfo.status = 'completed';
                batchInfo.completedAt = Date.now();
              }

              // PERSIST completion to database
              const serviceProxyManager = require('./serviceProxyManager');
              const batchStateManager = serviceProxyManager.get('batchStateManager');
              if (batchStateManager) {
                await batchStateManager.completeBatch(
                  batchId,
                  { successCount: batchResults.length, results: batchResults },
                  params.practiceContext?.practiceId
                );
              }
            }
          }
        } else if (status.status === 'failed' || status.status === 'canceled') {
          console.error(`❌ [Background] Batch ${batchId} ${status.status}`);

          const batchInfo = this.activeBatches.get(batchId);
          if (batchInfo) {
            batchInfo.status = 'failed';
            batchInfo.error = `Batch ${status.status}`;
          }

          // PERSIST failure to database
          const serviceProxyManager = require('./serviceProxyManager');
          const batchStateManager = serviceProxyManager.get('batchStateManager');
          if (batchStateManager) {
            await batchStateManager.failBatch(
              batchId,
              `Batch ${status.status}`,
              params.practiceContext?.practiceId
            );
          }

          break;
        }
        
        attempts++;
      }
      
      if (!completed && attempts >= maxAttempts) {
        console.error(`⏱️ [Background] Batch ${batchId} exceeded 24-hour limit`);
        const batchInfo = this.activeBatches.get(batchId);
        if (batchInfo) {
          batchInfo.status = 'timeout';
        }
      }
      
      // Clean up after 30 minutes post-completion
      setTimeout(() => {
        this.activeBatches.delete(batchId);
      }, 30 * 60 * 1000);
      
    } catch (error) {
      console.error(`❌ [Background] Error monitoring batch ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * Process batch results when completed
   */
  async processBatchResults(batchId, batchResults, files, params) {
    try {
      console.log(`📊 [Background] Processing ${batchResults.length} results for batch ${batchId}`);

      // ═════════════════════════════════════════════════════
      // PHASE 1 DETECTION: Check if this is Phase 1 batch
      // ═════════════════════════════════════════════════════
      const SecureDataAccess = require('./secureDataAccess');

      // Query batch_metadata to check if this is Phase 1
      const batchMetadataResults = await SecureDataAccess.query(
        'batch_metadata',
        { batchId: batchId },
        { limit: 1 },
        { serviceId: 'claude-batch-processor', practiceId: 'global' }
      );
      const batchMetadata = batchMetadataResults && batchMetadataResults.length > 0 ? batchMetadataResults[0] : null;

      // OLD Phase 1 handler - DISABLED (November 10, 2025)
      // Phase 1 → Phase 2 transition now handled by batchResultsWorker.js
      // Worker extracts patient name, looks up patient ID, and creates Phase 2 with patientId
      // This OLD handler doesn't have patient lookup logic, so it's been replaced
      if (batchMetadata && batchMetadata.phase === 1) {
        console.log(`📋 Phase 1 batch detected: ${batchId} - Will be processed by batchResultsWorker`);
        return; // Let worker handle Phase 1 → Phase 2 transition with patient lookup
      }

      // ═════════════════════════════════════════════════════
      // PHASE 2 OR LEGACY: Regular medical data processing
      // ═════════════════════════════════════════════════════

      const batchInfo = this.activeBatches.get(batchId);
      if (!batchInfo) {
        console.warn(`⚠️ No batch info found for ${batchId}`);
        return;
      }

      const { practiceContext, patientId, uploadId } = params;
      
      // Validate we have required context
      if (!practiceContext || !practiceContext.practiceId) {
        console.error(`❌ [Background] Missing practiceContext or practiceId for batch ${batchId}`);
        console.error('   practiceContext:', practiceContext);
        throw new Error('Missing practice context for secure database access');
      }
      
      // CRITICAL: Get medicalFieldMappingService to save extracted data
      // This service routes to 35 specialty-specific field mapping services
      const serviceProxyManager = require('./serviceProxyManager');
      const medicalFieldMappingService = serviceProxyManager.get('medicalFieldMappingService');

      if (!medicalFieldMappingService) {
        console.error('❌ [Background] medicalFieldMappingService not available');
        throw new Error('medicalFieldMappingService not initialized');
      }

      // Process each result
      const processedResults = [];
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const file = files[i];

        //  PHASE 1 DETECTION: Check if this is Phase 1 (collection selection)
        // Phase 1 has result.analysis = null because select_collections tool doesn't match extract_*
        // Need to detect Phase 1 and handle it separately BEFORE the result.analysis check
        console.log(`🔍 [DEBUG] Result ${i}: success=${result.success}, has analysis=${!!result.analysis}, has result=${!!result.result}`);

        if (result.result) {
          console.log(`🔍 [DEBUG] result.result keys: ${Object.keys(result.result).join(', ')}`);
        }

        // TODO: Add Phase 1 handling here if detected

        if (result.success && result.analysis) {
          console.log(`📄 [Background] Processing result for ${file.fileName}`);

          // The result contains the extracted data from Claude
          const extractedData = result.analysis.extractedData || result.analysis;

          try {
            // First, save the document record to get documentId
            const documentRecord = {
              patientId: extractedData.patientId || patientId,
              fileName: file.fileName,
              uploadDate: new Date(),
              category: extractedData.category || 'general',
              extractedData: extractedData,
              processed: true,
              batchId: batchId,
              source: 'batch_extraction'
            };

            const insertResult = await SecureDataAccess.insert(
              'documents',
              documentRecord,
              {
                serviceId: 'claudeBatchProcessor',
                operation: 'save-batch-document',
                practiceId: practiceContext.practiceId,
                apiKey: this.serviceToken?.apiKey || this.serviceToken
              }
            );

            const documentId = insertResult.insertedId || insertResult._id;
            console.log(`📝 [Background] Document record saved with ID: ${documentId}`);

            // CRITICAL: Match patient from extracted data before saving medical data
            let finalPatientId = patientId; // Start with patientId from params

            // Extract patient name from extracted data
            // Try multiple locations: top-level, administrative_data collection, or other sources
            let patientName = null;

            // Priority 1: Check top-level patientName field (most common in new unified schema)
            if (extractedData.patientName) {
              patientName = extractedData.patientName;
            }
            // Priority 2: Check administrative_data collection
            else if (extractedData.administrative_data && extractedData.administrative_data.length > 0) {
              // Check for documentData wrapper (Claude sometimes wraps data in documentData object)
              const adminData = extractedData.administrative_data[0];
              if (adminData.documentData && adminData.documentData.patientName) {
                patientName = adminData.documentData.patientName;
              } else if (adminData.patientName) {
                patientName = adminData.patientName;
              }
            }
            // Priority 3: Check old format administrativeData
            else if (extractedData.administrativeData && extractedData.administrativeData.patientName) {
              patientName = extractedData.administrativeData.patientName;
            }

            if (patientName) {
              console.log(`🔍 [Background] Matching patient: ${patientName}`);

              const patientContext = {
                serviceId: 'claudeBatchProcessor',
                operation: 'find-patient',
                practiceId: practiceContext.practiceId,
                apiKey: this.serviceToken?.apiKey || this.serviceToken
              };

              // Parse patient name (handle "LastName, FirstName" or "FirstName LastName" formats)
              let firstName = '';
              let lastName = '';

              if (patientName.includes(',')) {
                // Format: "LastName, FirstName MiddleName"
                const parts = patientName.split(',');
                lastName = parts[0].trim();
                const remainingName = parts[1] ? parts[1].trim() : '';
                const firstNameParts = remainingName.split(' ');
                firstName = firstNameParts[0] || '';
              } else {
                // Format: "FirstName MiddleName LastName"
                const nameParts = patientName.split(' ');
                firstName = nameParts[0] || '';
                lastName = nameParts.slice(1).join(' ') || '';
              }

              console.log(`🔍 [Background] Searching: firstName="${firstName}", lastName="${lastName}"`);

              // Try to find patient by name
              const patients = await SecureDataAccess.query('patients',
                {
                  $or: [
                    { firstName: firstName, lastName: lastName },
                    {
                      $and: [
                        { firstName: { $regex: firstName, $options: 'i' } },
                        { lastName: { $regex: lastName, $options: 'i' } }
                      ]
                    }
                  ]
                },
                { limit: 1 },
                patientContext
              );

              if (patients && patients.length > 0) {
                finalPatientId = patients[0]._id.toString();
                console.log(`✅ [Background] Patient matched: ${patients[0].firstName} ${patients[0].lastName} (ID: ${finalPatientId})`);
              } else {
                console.warn(`⚠️ [Background] Patient NOT FOUND: ${patientName}`);
                console.warn(`   Medical data will not be saved without patient match`);
                finalPatientId = null;
              }
            }

            // Only save medical data if we have a valid patient ID
            if (!finalPatientId) {
              console.error(`❌ [Background] Cannot save medical data - no valid patient ID for ${file.fileName}`);
              processedResults.push({
                fileName: file.fileName,
                success: false,
                error: 'Patient not found - medical data not saved',
                patientName: patientName
              });
              continue; // Skip to next file
            }

            // Normalize field names: NEW format returns snake_case, handlers expect camelCase
            // Create BOTH versions so handlers work: administrative_data → administrativeData
            const normalizedData = { ...extractedData };
            for (const key of Object.keys(extractedData)) {
              if (key.includes('_')) {
                normalizedData[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = extractedData[key];
              }
            }

            // Now save all the medical data using medicalFieldMappingService
            const saveResult = await medicalFieldMappingService.saveComprehensiveData(
              normalizedData,
              documentId,
              finalPatientId, // Use the matched patient ObjectId
              {
                serviceId: 'claudeBatchProcessor',
                operation: 'save-batch-medical-data',
                practiceId: practiceContext.practiceId,
                practiceSubdomain: practiceContext.practiceId, // CRITICAL: For specialty services
                apiKey: this.serviceToken?.apiKey || this.serviceToken
              }
            );

            console.log(`✅ [Background] Medical data saved for ${file.fileName}: ${saveResult.savedCollections?.length || 0} collections`);

            processedResults.push({
              fileName: file.fileName,
              success: true,
              patientName: patientName,
              category: extractedData.category,
              collectionsCount: saveResult.savedCollections?.length || 0,
              documentId: documentId
            });

            console.log(`✅ [Background] Complete save for ${file.fileName}: ${patientName}`);
          } catch (saveError) {
            console.error(`❌ [Background] Error saving ${file.fileName}:`, saveError);
            processedResults.push({
              fileName: file.fileName,
              success: false,
              error: saveError.message,
              patientName: patientName
            });
          }
        } else {
          console.error(`❌ [Background] Failed to process ${file.fileName}`);
          processedResults.push({
            fileName: file.fileName,
            success: false,
            error: result.error || 'Processing failed'
          });
        }
      }
      
      // Mark the upload as processed and update status
      if (uploadId) {
        await SecureDataAccess.update('pendinguploads',
          { uploadId: uploadId },
          {
            processed: true,
            processedAt: new Date(),
            batchId: batchId,
            status: 'completed',  // Update status from batch_processing to completed
            results: processedResults
          },
          {
            serviceId: 'claude-batch-processor',
            operation: 'mark-batch-complete',
            practiceId: practiceContext.practiceId
          }
        );
      } else if (batchId) {
        // If no uploadId, try to update by batchId
        await SecureDataAccess.update('pendinguploads',
          { batchId: batchId },
          {
            processed: true,
            processedAt: new Date(),
            status: 'completed',  // Update status from batch_processing to completed
            results: processedResults
          },
          {
            serviceId: 'claude-batch-processor',
            operation: 'mark-batch-complete',
            practiceId: practiceContext.practiceId
          }
        );
      }
      
      // Create completion notification — target the user who initiated the batch
      const notification = {
        type: 'batch_complete',
        batchId: batchId,
        fileCount: files.length,
        createdAt: new Date(),
        completedAt: new Date(),
        message: `✅ Document analysis complete! ${processedResults.filter(r => r.success).length}/${files.length} document(s) successfully processed.`,
        uploadId: uploadId,
        patientId: patientId,
        results: processedResults,
        targetUserIds: userId ? [String(userId)] : [],
        status: 'unread'
      };
      
      // Store notification IN THE PRACTICE DATABASE
      if (practiceContext && practiceContext.practiceId) {
        await SecureDataAccess.insert('notifications', notification, {
          serviceId: 'claude-batch-processor',
          operation: 'create-notification',
          practiceId: practiceContext.practiceId,
          database: `intellicare_practice_${practiceContext.practiceId}`  // CRITICAL: Store in practice DB!
        });
      }
      
      // Emit WebSocket event for real-time notification
      if (global.io) {
        // Create notification data — target the user who initiated the batch
        const notificationData = {
          batchId: batchId,
          practiceId: practiceContext.practiceId,
          timestamp: new Date().toISOString(),
          fileCount: files.length,
          successCount: processedResults.filter(r => r.success).length,
          targetUserIds: userId ? [String(userId)] : [],
          message: `✅ Document analysis complete! ${processedResults.filter(r => r.success).length}/${files.length} document(s) successfully processed.`
        };

        // Emit to practice-specific room if practiceId exists
        if (practiceContext.practiceId) {
          global.io.to(`practice_${practiceContext.practiceId}`).emit('batch_complete', notificationData);
          console.log(`📢 [WebSocket] Emitted batch_complete to practice_${practiceContext.practiceId}:`, notificationData);
        }

        // Always emit globally for notification center
        global.io.emit('batch_complete', notificationData);
        console.log(`📢 [WebSocket] Emitted batch_complete notification globally:`, notificationData);

        // If we have a sessionId, also emit session-specific summary
        if (params.sessionId) {
          const summary = {
            batchId: batchId,
            sessionId: params.sessionId,
            fileCount: files.length,
            successCount: processedResults.filter(r => r.success).length,
            failedCount: processedResults.filter(r => !r.success).length,
            patientId: patientId,
            timestamp: new Date().toISOString(),
            // Include file names for summary display
            files: processedResults.map(r => ({
              fileName: r.fileName,
              success: r.success,
              // Extract key data points for summary
              extractedCategories: r.extractedData ? Object.keys(r.extractedData).filter(k => r.extractedData[k] && r.extractedData[k].length > 0).length : 0
            }))
          };

          // Emit to session-specific room (keep original sessionId)
          const roomName = params.sessionId.startsWith('session_') ? params.sessionId : `session_${params.sessionId}`;
          global.io.to(roomName).emit('batch_summary', summary);
          console.log(`📢 [WebSocket] Emitted batch_summary to ${roomName}`);

          // Also store completion in database
          if (params.patientId && params.practiceContext && params.practiceContext.practiceId) {
            const SecureDataAccess = require('./secureDataAccess');
            try {
              // Mark batch as completed in cache (forces DB write)
              const serviceProxyManager = require('./serviceProxyManager');
              if (serviceProxyManager.isLoaded('batchProgressCache')) {
                const batchProgressCache = serviceProxyManager.get('batchProgressCache');
                batchProgressCache.updateProgress(batchId, {
                  status: 'completed',
                  progress: 100,
                  practiceId: params.practiceContext.practiceId,
                  documentsProcessed: summary.fileCount,
                  successCount: summary.successCount,
                  failedCount: summary.failedCount,
                  completedAt: new Date(),
                  updatedAt: new Date()
                }, true); // Force DB write on completion
                console.log(`💾 Marked batch as completed in database`);
              }
            } catch (err) {
              console.warn(`Failed to mark batch complete in DB:`, err);
            }
          }
        }
      } else {
        console.warn('⚠️ [WebSocket] global.io not available for batch_complete notification');
      }
      
      console.log(`✅ [Background] Batch ${batchId} fully processed: ${processedResults.filter(r => r.success).length}/${files.length} successful`);
      
    } catch (error) {
      console.error(`❌ [Background] Error processing batch results:`, error);
      throw error;
    }
  }

  /**
   * Check batch status (for frontend polling)
   */
  async getBatchStatus(batchId) {
    const batchInfo = this.activeBatches.get(batchId);
    
    if (!batchInfo) {
      // Check if batch exists in Claude's system
      try {
        const status = await this.checkBatchStatus(batchId);
        return {
          batchId,
          status: status.status,
          exists: true,
          tracked: false
        };
      } catch (error) {
        return {
          batchId,
          status: 'unknown',
          exists: false,
          error: 'Batch not found'
        };
      }
    }
    
    return {
      batchId,
      status: batchInfo.status,
      startTime: batchInfo.startTime,
      fileCount: batchInfo.fileCount,
      completedAt: batchInfo.completedAt || null,
      error: batchInfo.error || null
    };
  }
}

// Export singleton instance
module.exports = new ClaudeBatchProcessor();