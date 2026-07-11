// Batch Results Worker
// Automatically checks and processes completed batch jobs
// Runs in the background to update documents with analysis results
// SECURITY: All database access through SecureDataAccess

const { ObjectId } = require('mongodb');
const batchProcessor = require('./claudeBatchProcessor');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const globalModelLoader = require('./globalModelLoader');
const immutableAuditService = require('./immutableAuditService');
const secureConfigService = require('../services/secureConfigService');
const medicalFieldMappingService = require('./medicalFieldMappingService');

class BatchResultsWorker {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 10000; // Check every 10 seconds for more responsive updates
    this.cleanupInterval = 3600000; // Clean up old batches every 1 hour
    this.minRunTime = 180000; // Minimum runtime of 3 minutes after start (prevents premature auto-stop)
    this.intervalId = null;
    this.cleanupIntervalId = null;
    this.serviceToken = null;
    this.serviceContext = null;
    this.lastProgressUpdate = {}; // Track last progress for each batch to avoid duplicate notifications
    this.activeBatchCount = 0; // Track active batches to know when to stop
    this.lastActivityTime = null; // Track when we last found work to do
    this.startTime = null; // Track when worker was started (for grace period)

    // Batch Results Worker initialized
  }

  async initialize() {
    const serviceAccountManager = require('./serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('batch-results-worker');
    if (!this.serviceToken) {
      throw new Error('Failed to authenticate batch-results-worker service');
    }
    
    this.serviceContext = {
      serviceId: this.serviceToken.serviceId,
      token: this.serviceToken.sessionToken,
      permissions: this.serviceToken.permissions,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
    
    // Batch Results Worker authenticated
    return this;
  }
  
  /**
   * Start the worker
   * SECURITY: Service must authenticate before accessing any data
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Batch worker already running');
      return;
    }
    
    // SECURITY: Authenticate service account
    try {
      this.serviceToken = await serviceAccountManager.authenticate('batch-results-worker');
      if (!this.serviceToken) {
        throw new Error('Service authentication failed - cannot access data');
      }
      
      this.serviceContext = {
        serviceId: this.serviceToken.serviceId,
        token: this.serviceToken.sessionToken,
        permissions: this.serviceToken.permissions,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };
      
      // Service authenticated
      
      // Log service startup
      await immutableAuditService.logSecurityEvent({
        type: 'SERVICE_STARTED',
        service: 'batch-results-worker',
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Service authentication failed:', error.message);
      throw new Error('Cannot start service without authentication');
    }
    
    this.isRunning = true;
    this.startTime = Date.now(); // Track start time for grace period
    console.log('🚀 Batch worker started - will run for at least 3 minutes before auto-stop');

    // Initial check
    this.checkPendingBatches();

    // Set up interval for checking pending batches
    this.intervalId = setInterval(() => {
      this.checkPendingBatches();
    }, this.checkInterval);

    // Set up interval for cleanup (runs every hour)
    this.cleanupIntervalId = setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);

    // Initial cleanup run
    this.performCleanup();
  }
  
  /**
   * Stop the worker
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    console.log('⏹️ Batch results worker stopped');
  }

  /**
   * Ensure worker is running (call this when a new batch is submitted)
   * This implements on-demand startup - only run when there's work to do
   */
  async ensureRunning() {
    if (this.isRunning) {
      console.log('✅ Batch worker already running');
      return;
    }

    console.log('🚀 Starting batch worker on-demand...');
    await this.start();
  }

  /**
   * Get worker status for monitoring
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeBatchCount: this.activeBatchCount,
      lastActivityTime: this.lastActivityTime,
      checkInterval: this.checkInterval,
      intervalId: this.intervalId ? 'active' : 'stopped'
    };
  }
  
  /**
   * Check all pending batches across all practices
   */
  async checkPendingBatches() {
    try {
      // Log batch job check (suppressed in quiet mode)
      if (secureConfigService.get('QUIET_LOGS') !== 'true' && secureConfigService.get('NODE_ENV') !== 'test') {
        console.log('🔍 Checking for completed batch jobs...');
      }

      // CHECK 1: Global batch_metadata for two-pass batches (stateless)
      const globalPendingCount = await this.checkGlobalBatchMetadata();

      // CHECK 2: Practice-specific patient records (legacy batches)
      // SECURITY: Get allowed practices from service permissions
      const allowedPractices = this.serviceContext?.permissions?.practices || [];

      let practicesToCheck = [];
      if (allowedPractices.includes('*')) {
        // Service has access to all practices - get them dynamically from database
        const Practice = globalModelLoader.getModel('Practice');
        const allPractices = await Practice.find({ status: 'active' }, 'subdomain').lean();
        practicesToCheck = allPractices.map(p => p.subdomain);
        console.log(`📦 Checking ${practicesToCheck.length} active practices for pending batches`);
      } else {
        // Only check specific allowed practices
        practicesToCheck = allowedPractices;
      }

      let totalPendingBatches = globalPendingCount || 0;

      for (const practiceId of practicesToCheck) {
        const pendingCount = await this.checkClinicBatches(practiceId);
        totalPendingBatches += pendingCount || 0;
      }

      // Track activity and auto-stop when idle
      if (totalPendingBatches > 0) {
        this.activeBatchCount = totalPendingBatches;
        this.lastActivityTime = Date.now();
      } else {
        this.activeBatchCount = 0;

        // Check if we're still in the grace period (minimum runtime after start)
        const runTime = Date.now() - this.startTime;
        const withinGracePeriod = runTime < this.minRunTime;

        if (withinGracePeriod) {
          // Still in grace period - don't stop yet, batch may still be processing at Anthropic
          const remainingSeconds = Math.ceil((this.minRunTime - runTime) / 1000);
          if (secureConfigService.get('QUIET_LOGS') !== 'true' && secureConfigService.get('NODE_ENV') !== 'test') {
            console.log(`⏳ No pending batches, but within grace period (${remainingSeconds}s remaining). Continuing to poll...`);
          }
        } else {
          // Grace period elapsed - safe to stop
          if (secureConfigService.get('QUIET_LOGS') !== 'true' && secureConfigService.get('NODE_ENV') !== 'test') {
            console.log('💤 No pending batches found after grace period. Stopping worker to save CPU.');
          }
          this.stop();
        }
      }

    } catch (error) {
      console.error('❌ Batch worker error:', error.message);
    }
  }

  /**
   * Check global batch_metadata collection for pending two-pass batches
   * These are batches submitted without a patient ID that need stateless coordination
   */
  async checkGlobalBatchMetadata() {
    try {
      // Query global batch_metadata for Phase 1 and Phase 2 pending batches
      const pendingBatches = await SecureDataAccess.query(
        'batch_metadata',
        {
          status: { $in: ['phase1_pending', 'phase2_pending'] },
          _deleted: { $ne: true }
        },
        {},
        { serviceId: 'batch-results-worker', practiceId: 'global' }
      );

      if (!pendingBatches || pendingBatches.length === 0) {
        return 0;
      }

      console.log(`🌐 Found ${pendingBatches.length} pending global batches`);

      for (const batch of pendingBatches) {
        try {
          if (batch.status === 'phase1_pending') {
            await this.processGlobalPhase1Batch(batch);
          } else if (batch.status === 'phase2_pending') {
            await this.processGlobalPhase2Batch(batch);
          }
        } catch (error) {
          console.error(`❌ Error processing global batch ${batch.batchId}:`, error.message);
          console.error(`❌ Error stack:`, error.stack);
        }
      }

      return pendingBatches.length;

    } catch (error) {
      console.error('❌ Error checking global batch metadata:', error.message);
      return 0;
    }
  }

  /**
   * Process Phase 1 completion → Create Phase 2
   */
  async processGlobalPhase1Batch(batch) {
    try {
      console.log(`📋 Processing Phase 1 batch: ${batch.batchId}`);

      // CRITICAL SAFETY CHECK: Prevent infinite loop - if Phase 2 already created, skip
      if (batch.phase2BatchId) {
        console.log(`⏭️ SAFETY CHECK: Phase 2 already created (${batch.phase2BatchId}), skipping Phase 1 batch ${batch.batchId}`);
        return;
      }

      // Check if Phase 1 is complete via Anthropic API
      const batchStatus = await batchProcessor.checkBatchStatus(batch.batchId);

      if (batchStatus.processing_status !== 'ended') {
        console.log(`⏳ Phase 1 batch ${batch.batchId} still processing (${batchStatus.processing_status})`);
        return;
      }

      console.log(`✅ Phase 1 batch ${batch.batchId} completed - extracting selected collections...`);

      // Get Phase 1 results
      const results = await batchProcessor.getBatchResults(batch.batchId);

      // Extract selected collections AND patient name
      const Phase1 = require('./claudeBatchProcessorPhase1');
      const phase1 = new Phase1();

      // Check if ALL results are API errors (transient Anthropic issue)
      const allErrored = results.every(r => !r.success);
      if (allErrored) {
        const errorDetails = results.map(r => r.error || 'unknown').join('; ');
        const retryCount = batch.retryCount || 0;
        const MAX_RETRIES = 3;

        if (retryCount < MAX_RETRIES) {
          console.log(`⚠️ Phase 1 batch ${batch.batchId} - all ${results.length} results errored (Anthropic API error). Retry ${retryCount + 1}/${MAX_RETRIES}...`);
          console.log(`   Error: ${errorDetails}`);

          // Resubmit Phase 1 batch using stored documents
          const docs = (batch.documents || []).map(d => ({
            content: d.content,
            contentType: d.contentType || 'application/pdf'
          }));

          if (docs.length === 0 || !docs[0].content) {
            console.error(`❌ Cannot retry Phase 1 batch ${batch.batchId} - no document content stored in metadata`);
            await SecureDataAccess.update(
              'batch_metadata',
              { _id: batch._id },
              {
                $set: {
                  status: 'failed',
                  failedAt: new Date(),
                  failureReason: `Anthropic API error and no document content available for retry: ${errorDetails}`
                }
              },
              { serviceId: 'batch-results-worker', practiceId: 'global' }
            );
            return;
          }

          const newPhase1 = new Phase1();
          const newBatchId = await newPhase1.selectCollections(docs, batch.practiceId);

          // Update batch_metadata with new batch ID and retry count
          await SecureDataAccess.update(
            'batch_metadata',
            { _id: batch._id },
            {
              $set: {
                batchId: newBatchId,
                retryCount: retryCount + 1,
                lastRetryAt: new Date(),
                lastError: errorDetails
              }
            },
            { serviceId: 'batch-results-worker', practiceId: 'global' }
          );

          console.log(`🔄 Phase 1 resubmitted as ${newBatchId} (retry ${retryCount + 1}/${MAX_RETRIES})`);
          return;
        } else {
          // Max retries exceeded - mark as failed
          console.error(`❌ Phase 1 batch ${batch.batchId} failed after ${MAX_RETRIES} retries. Marking as failed.`);
          await SecureDataAccess.update(
            'batch_metadata',
            { _id: batch._id },
            {
              $set: {
                status: 'failed',
                failedAt: new Date(),
                failureReason: `Anthropic API error after ${MAX_RETRIES} retries: ${errorDetails}`
              }
            },
            { serviceId: 'batch-results-worker', practiceId: 'global' }
          );
          return;
        }
      }

      let selectedCollections = [];
      let patientName = null;
      let extracted = null;  // Declare outside loop so it's accessible later for reasoning
      for (const result of results) {
        // Check nested path: result.result.result.message (getBatchResults preserves raw Anthropic response)
        // result.result = raw Anthropic batch response
        // result.result.result = nested result object with type/message
        // result.result.result.message = actual Claude message with tool uses
        if (result.result && result.result.result && result.result.result.message) {
          extracted = phase1.extractSelectedCollections(result.result);
          selectedCollections = extracted.collections;
          patientName = extracted.patientName;
          console.log(`✅ Phase 1 selected ${selectedCollections.length} collections`);
          console.log(`👤 Patient Name: ${patientName || 'NOT FOUND'}`);
          console.log(`📝 Reasoning: ${extracted.reasoning}`);
          break;
        }
      }

      if (selectedCollections.length === 0) {
        throw new Error('Phase 1 did not return any selected collections');
      }

      // CRITICAL: Look up patient by name to get patient ID
      // Use patientService.searchPatientsByName (same as old single-pass batch processor)
      let patientId = null;
      if (patientName) {
        try {
          console.log(`🔍 Looking up patient by name: "${patientName}"`);

          // Call patientService.searchPatientsByName (replaces direct database query)
          const patientService = require('./patientService');

          // Build practice context for service call
          // batch.practiceId contains the practice subdomain (e.g., 'yale')
          const practiceContext = {
            subdomain: batch.practiceId,
            practiceId: batch.practiceId
          };

          // Call searchPatientsByName service function
          const searchResult = await patientService.searchPatientsByName(
            { name: patientName },
            practiceContext,
            null,  // session - not available in worker context
            null   // externalContext
          );

          if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
            patientId = searchResult.data[0].patientId;
            console.log(`✅ Found patient in database - ID: ${patientId}`);
            console.log(`   Name: ${searchResult.data[0].name}`);
          } else {
            console.warn(`⚠️ Patient not found in database: "${patientName}"`);
          }
        } catch (lookupError) {
          console.error(`❌ Error looking up patient:`, lookupError.message);
        }
      } else {
        console.warn(`⚠️ No patient name extracted from Phase 1`);
      }

      // STOP if no patient ID - cannot proceed without knowing where to save data
      if (!patientId) {
        console.error(`❌ CRITICAL: No patient ID found - cannot create Phase 2`);
        console.error(`❌ Patient name from document: "${patientName || 'NONE'}"`);
        console.error(`❌ Phase 2 requires patient ID to save data to database`);

        // Mark Phase 1 as failed due to missing patient ID
        await SecureDataAccess.update(
          'batch_metadata',
          { batchId: batch.batchId },
          {
            $set: {
              status: 'phase1_failed_no_patient',
              error: `Cannot proceed to Phase 2: Patient "${patientName || 'UNKNOWN'}" not found in database`,
              updatedAt: new Date()
            }
          },
          { serviceId: 'batch-results-worker', practiceId: 'global' }
        );

        throw new Error(`Cannot proceed to Phase 2: Patient "${patientName || 'UNKNOWN'}" not found in database`);
      }

      // Create single Phase 2 batch with ALL selected tools (no chunking)
      const Phase2 = require('./claudeBatchProcessorPhase2');
      const phase2 = new Phase2();

      console.log(`🎯 Creating Phase 2 batch with ${selectedCollections.length} selected tools...`);

      const phase2BatchId = await phase2.extractWithSelectedTools(
        batch.documents,
        selectedCollections,  // ALL selected collections in one batch
        batch.practiceId
      );

      console.log(`✅ Phase 2 batch created: ${phase2BatchId}`);

      // Create Phase 2 metadata entry WITH patient ID
      await SecureDataAccess.insert(
        'batch_metadata',
        {
          batchId: phase2BatchId,
          phase: 2,
          status: 'phase2_pending',
          practiceId: batch.practiceId,
          // CRITICAL: Carry forward sessionId and userId for WebSocket notifications and chat messages
          sessionId: batch.sessionId,
          userId: batch.userId,
          patientId: patientId,  // CRITICAL: Patient ID for saving data
          patientName: patientName,  // CRITICAL: Patient name
          phase1BatchId: batch.batchId,
          selectedCollections: selectedCollections,
          reasoning: extracted?.reasoning || '',  // Carry forward reasoning from Phase 1
          documentCount: batch.documentCount,
          documents: batch.documents,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        { serviceId: 'batch-results-worker', practiceId: 'global' }
      );

      // Update Phase 1 metadata with Phase 2 batch ID
      await SecureDataAccess.update(
        'batch_metadata',
        { batchId: batch.batchId },
        {
          $set: {
            status: 'phase1_complete',
            phase2BatchId: phase2BatchId,  // Single Phase 2 batch ID
            patientId: patientId,  // Store for reference
            patientName: patientName,
            selectedCollections: selectedCollections,
            reasoning: extracted?.reasoning || '',  // Store Claude's reasoning for frontend display
            phase2CreatedAt: new Date(),
            updatedAt: new Date()
          }
        },
        { serviceId: 'batch-results-worker', practiceId: 'global' }
      );

      console.log(`✅ Phase 1 → Phase 2 transition complete: Created single Phase 2 batch with ${selectedCollections.length} tools`);

      // Emit WebSocket notification with Phase 1 reasoning
      if (global.io) {
        const phase1CompleteData = {
          type: 'phase1_complete',
          batchId: batch.batchId,
          phase2BatchId: phase2BatchId,  // Single Phase 2 batch ID
          patientId: patientId,
          patientName: patientName,
          selectedCollections: selectedCollections,
          reasoning: extracted?.reasoning || '',  // Claude's reasoning for why these collections were selected
          message: `📝 Phase 1 Complete: Selected ${selectedCollections.length} relevant collections for Phase 2 extraction`,
          targetUserIds: batch.userId ? [String(batch.userId)] : [],
          timestamp: new Date()
        };

        // Emit to practice room
        global.io.to(`practice_${batch.practiceId}`).emit('phase1_complete', phase1CompleteData);
        console.log(`📢 Emitted phase1_complete with Phase 2 batch to practice_${batch.practiceId}`);

        // Also emit to session room if sessionId is available
        if (batch.sessionId) {
          global.io.to(`session_${batch.sessionId}`).emit('phase1_complete', phase1CompleteData);
          console.log(`📢 Emitted phase1_complete with reasoning to session_${batch.sessionId}`);
        }
      }

      // Save Phase 1 reasoning as chat message so user sees it in chat interface
      if (batch.sessionId && extracted?.reasoning) {
        try {
          const encryptionService = require('./encryptionService');

          // Just the reasoning text - no extra formatting per user preference
          const reasoningContent = extracted.reasoning;

          // Get next sequence number for proper message ordering
          const practiceContext = { serviceId: 'batch-results-worker', practiceId: batch.practiceId };
          const existingMessages = await SecureDataAccess.query(
            'chat_messages',
            { sessionId: batch.sessionId },
            { sort: { sequenceNumber: -1 }, limit: 1 },
            practiceContext
          );
          const sequenceNumber = (existingMessages && existingMessages.length > 0 && existingMessages[0].sequenceNumber)
            ? existingMessages[0].sequenceNumber + 1
            : 1;

          const messageData = {
            sessionId: batch.sessionId,
            userId: batch.userId,
            messageId: `msg_phase1_${batch.batchId}_${Date.now()}`,
            type: 'agent',
            content: await encryptionService.encrypt(reasoningContent, 'phi'),
            language: 'en',  // Default language for batch messages
            backgroundProcessing: true,
            batchId: batch.batchId,
            sequenceNumber: sequenceNumber,
            metadata: {
              type: 'phase1_complete',
              batchId: batch.batchId,
              patientName: patientName
            },
            createdAt: new Date()
          };

          await SecureDataAccess.insert('chat_messages', messageData, practiceContext);

          console.log(`💬 Saved Phase 1 reasoning to chat for session ${batch.sessionId} (seq: ${sequenceNumber}, practice: ${batch.practiceId})`);
        } catch (msgError) {
          console.error(`⚠️ Failed to save Phase 1 reasoning to chat:`, msgError.message);
          // Non-blocking - don't fail the batch process
        }
      }

    } catch (error) {
      console.error(`❌ Error processing Phase 1 batch ${batch.batchId}:`, error.message);
      console.error(`❌ Error stack:`, error.stack);

      // Check if this is a transient error (network, server, or timeout/canceled) - don't mark as permanent failure
      // CanceledError is thrown by AbortSignal.timeout() when API request times out
      const errorMsg = error.message?.toLowerCase() || '';
      const isTransientError = errorMsg.includes('network error') ||
                               errorMsg.includes('etimedout') ||
                               errorMsg.includes('econnreset') ||
                               errorMsg.includes('econnaborted') ||
                               errorMsg.includes('socket hang up') ||
                               errorMsg.includes('503') ||
                               errorMsg.includes('502') ||
                               errorMsg.includes('500') ||
                               errorMsg.includes('temporarily unavailable') ||
                               errorMsg.includes('service unavailable') ||
                               errorMsg.includes('canceled') ||  // AbortSignal.timeout() throws CanceledError
                               errorMsg.includes('aborted') ||
                               errorMsg.includes('timeout') ||
                               error.name === 'CanceledError' ||
                               error.code === 'ERR_CANCELED';

      if (isTransientError) {
        // Transient error - increment retry count but keep status as pending
        const retryCount = (batch.retryCount || 0) + 1;
        const maxRetries = 5;

        if (retryCount >= maxRetries) {
          console.error(`❌ Phase 1 batch ${batch.batchId} failed after ${retryCount} retries - marking as failed`);
          await SecureDataAccess.update(
            'batch_metadata',
            { batchId: batch.batchId },
            {
              $set: {
                status: 'phase1_failed',
                error: `Failed after ${retryCount} retries: ${error.message}`,
                retryCount: retryCount,
                updatedAt: new Date()
              }
            },
            { serviceId: 'batch-results-worker', practiceId: 'global' }
          );
        } else {
          console.warn(`⚠️ Transient error on Phase 1 batch ${batch.batchId} (retry ${retryCount}/${maxRetries}) - will retry on next worker cycle`);
          await SecureDataAccess.update(
            'batch_metadata',
            { batchId: batch.batchId },
            {
              $set: {
                lastError: error.message,
                retryCount: retryCount,
                updatedAt: new Date()
              }
            },
            { serviceId: 'batch-results-worker', practiceId: 'global' }
          );
        }
      } else {
        // Permanent error - mark as failed
        await SecureDataAccess.update(
          'batch_metadata',
          { batchId: batch.batchId },
          {
            $set: {
              status: 'phase1_failed',
              error: error.message,
              updatedAt: new Date()
            }
          },
          { serviceId: 'batch-results-worker', practiceId: 'global' }
        );
      }
    }
  }

  /**
   * Process Phase 2 completion → Extract patient ID and save data
   */
  async processGlobalPhase2Batch(batch) {
    try {
      console.log(`💾 Processing Phase 2 batch: ${batch.batchId}`);

      // Check if Phase 2 is complete via Anthropic API
      const batchStatus = await batchProcessor.checkBatchStatus(batch.batchId);

      if (batchStatus.processing_status !== 'ended') {
        console.log(`⏳ Phase 2 batch ${batch.batchId} still processing (${batchStatus.processing_status})`);
        return;
      }

      console.log(`✅ Phase 2 batch ${batch.batchId} completed - extracting medical data...`);

      // Get Phase 2 results
      const results = await batchProcessor.getBatchResults(batch.batchId);

      // FIXED: getBatchResults() already processes tool uses into .analysis field
      // results is an array of processed result objects: [{ customId, success, analysis, usage, result }]
      // We need results[0].analysis, NOT batchProcessor.extractAnalysisFromToolUse(results)
      if (!results || results.length === 0) {
        throw new Error('No results returned from Phase 2 batch');
      }

      const result = results[0];
      if (!result.success) {
        console.log(`❌ Phase 2 batch failed for ${result.customId}`);
        console.log(`   Error message: ${result.error}`);
        if (result.errorObject) {
          console.log(`   Error object:`, JSON.stringify(result.errorObject, null, 2));
        }
        throw new Error(`Phase 2 batch failed: ${result.error}`);
      }

      const extractedData = result.analysis;

      if (!extractedData) {
        throw new Error('Failed to extract medical data from Phase 2 results - analysis field is empty');
      }

      // CRITICAL: Use patient ID from metadata (stored during Phase 1 → Phase 2 transition)
      const patientId = batch.patientId;
      const patientName = batch.patientName;

      console.log(`👤 Patient from metadata: ${patientName} (ID: ${patientId})`);

      if (!patientId) {
        throw new Error(`Cannot save medical data: No patient ID in batch metadata for batch ${batch.batchId}`);
      }

      // Patient ID is ready - no need to look up
      // The Phase 1 handler already validated patient exists and stored the ID
      console.log(`✅ Using patient ID from metadata: ${patientId}`);

      // Get document ID from batch metadata
      // batch.documents is an array with: [{ fileName, content, contentType, documentId }]
      // CRITICAL FIX: Also check for 'id' field since agentServiceClaude.js stores it as 'id'
      const documentId = batch.documents && batch.documents[0]
        ? (batch.documents[0].documentId || batch.documents[0].id || batch.documents[0]._id?.toString())
        : null;

      // DIAGNOSTIC: Log document structure to trace documentId flow
      console.log(`📄 Document ID from Phase 2 metadata: ${documentId || 'NULL/NOT FOUND'}`);
      if (batch.documents && batch.documents[0]) {
        console.log(`📋 First document structure:`, JSON.stringify({
          fileName: batch.documents[0].fileName,
          documentId: batch.documents[0].documentId,
          hasContent: !!batch.documents[0].content
        }, null, 2));
      } else {
        console.log(`⚠️ WARNING: batch.documents is empty or undefined`);
      }

      // Save medical data to patient record
      console.log(`💾 Saving medical data for patient: ${patientId} with documentId: ${documentId}`);

      // CRITICAL: Add practiceId to context for database access
      const contextWithPractice = {
        ...this.serviceContext,
        practiceId: batch.practiceId
      };

      await medicalFieldMappingService.saveComprehensiveData(
        extractedData,
        documentId,
        patientId,
        contextWithPractice
      );

      // Mark Phase 2 as complete
      await SecureDataAccess.update(
        'batch_metadata',
        { batchId: batch.batchId },
        {
          $set: {
            status: 'phase2_complete',
            patientId: patientId,
            completedAt: new Date(),
            updatedAt: new Date()
          }
        },
        { serviceId: 'batch-results-worker', practiceId: 'global' }
      );

      console.log(`✅ Phase 2 complete - medical data saved for patient ${patientId}`);

      // Collections that actually produced saved records (non-empty arrays).
      // Phase 1's selections can include collections the document turned out not to
      // contain (extraction returns [] and nothing is saved) - report reality, not
      // the prediction, so the GUI count matches what exists in MongoDB.
      const savedCollections = Object.keys(extractedData)
        .filter(k => Array.isArray(extractedData[k]) && extractedData[k].length > 0);

      // CRITICAL FIX: Emit WebSocket notification for Phase 2 completion
      // This was missing - frontend never knew when processing finished!
      if (global.io) {
        const phase2CompleteData = {
          type: 'phase2_complete',
          batchId: batch.batchId,
          phase1BatchId: batch.phase1BatchId,
          patientId: patientId,
          patientName: patientName,
          selectedCollections: savedCollections,
          message: `✅ Document analysis complete! Medical data extracted and saved for ${patientName}.`,
          targetUserIds: batch.userId ? [String(batch.userId)] : [],
          timestamp: new Date()
        };

        // Emit to practice room
        global.io.to(`practice_${batch.practiceId}`).emit('phase2_complete', phase2CompleteData);
        console.log(`📢 Emitted phase2_complete to practice_${batch.practiceId}`);

        // Also emit to session room if sessionId is available
        if (batch.sessionId) {
          global.io.to(`session_${batch.sessionId}`).emit('phase2_complete', phase2CompleteData);
          console.log(`📢 Emitted phase2_complete to session_${batch.sessionId}`);
        }
      }

      // CRITICAL FIX: Save Phase 2 completion as chat message so user sees it in chat interface
      if (batch.sessionId) {
        try {
          const encryptionService = require('./encryptionService');

          // Build summary of what was actually extracted AND saved (non-empty collections)
          const collectionsExtracted = savedCollections;
          const summaryContent = `✅ **Document Analysis Complete**\n\nPatient: ${patientName}\nCollections extracted: ${collectionsExtracted.length}\n\nThe following medical data categories were extracted and saved:\n${collectionsExtracted.map(c => `• ${c}`).join('\n')}\n\nYou can now view the extracted data in the patient's medical records.`;

          // Get next sequence number for proper message ordering
          const practiceContext = { serviceId: 'batch-results-worker', practiceId: batch.practiceId };
          const existingMessages = await SecureDataAccess.query(
            'chat_messages',
            { sessionId: batch.sessionId },
            { sort: { sequenceNumber: -1 }, limit: 1 },
            practiceContext
          );
          const sequenceNumber = (existingMessages && existingMessages.length > 0 && existingMessages[0].sequenceNumber)
            ? existingMessages[0].sequenceNumber + 1
            : 1;

          const messageData = {
            sessionId: batch.sessionId,
            userId: batch.userId,
            messageId: `msg_phase2_${batch.batchId}_${Date.now()}`,
            type: 'agent',
            content: await encryptionService.encrypt(summaryContent, 'phi'),
            language: 'en',  // Default language for batch messages
            backgroundProcessing: true,
            batchId: batch.batchId,
            sequenceNumber: sequenceNumber,
            metadata: {
              type: 'phase2_complete',
              batchId: batch.batchId,
              patientId: patientId,
              patientName: patientName,
              selectedCollections: collectionsExtracted
            },
            createdAt: new Date()
          };

          await SecureDataAccess.insert('chat_messages', messageData, practiceContext);

          console.log(`💬 Saved Phase 2 completion message to chat for session ${batch.sessionId} (seq: ${sequenceNumber}, practice: ${batch.practiceId})`);

          // Also emit the new message via WebSocket so frontend updates immediately
          if (global.io && batch.sessionId) {
            global.io.to(`session_${batch.sessionId}`).emit('new_message', {
              messageId: messageData.messageId,
              type: 'agent',
              content: summaryContent, // Send unencrypted for display
              timestamp: new Date()
            });
            console.log(`📢 Emitted new_message to session_${batch.sessionId}`);
          }
        } catch (msgError) {
          console.error(`⚠️ Failed to save Phase 2 completion to chat:`, msgError.message);
          // Non-blocking - don't fail the batch process
        }
      }

    } catch (error) {
      console.error(`❌ Error processing Phase 2 batch ${batch.batchId}:`, error.message);
      console.error(`❌ Error stack:`, error.stack);

      // Check if this is a transient error (network, server, or timeout/canceled) - don't mark as permanent failure
      // CanceledError is thrown by AbortSignal.timeout() when API request times out
      const errorMsg = error.message?.toLowerCase() || '';
      const isTransientError = errorMsg.includes('network error') ||
                               errorMsg.includes('etimedout') ||
                               errorMsg.includes('econnreset') ||
                               errorMsg.includes('econnaborted') ||
                               errorMsg.includes('socket hang up') ||
                               errorMsg.includes('503') ||
                               errorMsg.includes('502') ||
                               errorMsg.includes('500') ||
                               errorMsg.includes('temporarily unavailable') ||
                               errorMsg.includes('service unavailable') ||
                               errorMsg.includes('canceled') ||  // AbortSignal.timeout() throws CanceledError
                               errorMsg.includes('aborted') ||
                               errorMsg.includes('timeout') ||
                               error.name === 'CanceledError' ||
                               error.code === 'ERR_CANCELED';

      if (isTransientError) {
        // Transient error - increment retry count but keep status as pending
        const retryCount = (batch.retryCount || 0) + 1;
        const maxRetries = 5;

        if (retryCount >= maxRetries) {
          console.error(`❌ Phase 2 batch ${batch.batchId} failed after ${retryCount} retries - marking as failed`);
          await SecureDataAccess.update(
            'batch_metadata',
            { batchId: batch.batchId },
            {
              $set: {
                status: 'phase2_failed',
                error: `Failed after ${retryCount} retries: ${error.message}`,
                retryCount: retryCount,
                updatedAt: new Date()
              }
            },
            { serviceId: 'batch-results-worker', practiceId: 'global' }
          );
        } else {
          console.warn(`⚠️ Transient error on Phase 2 batch ${batch.batchId} (retry ${retryCount}/${maxRetries}) - will retry on next worker cycle`);
          await SecureDataAccess.update(
            'batch_metadata',
            { batchId: batch.batchId },
            {
              $set: {
                lastError: error.message,
                retryCount: retryCount,
                updatedAt: new Date()
              }
            },
            { serviceId: 'batch-results-worker', practiceId: 'global' }
          );
        }
      } else {
        // Permanent error - mark as failed
        await SecureDataAccess.update(
          'batch_metadata',
          { batchId: batch.batchId },
          {
            $set: {
              status: 'phase2_failed',
              error: error.message,
              updatedAt: new Date()
            }
          },
          { serviceId: 'batch-results-worker', practiceId: 'global' }
        );
      }
    }
  }

  /**
   * Check batches for a specific practice
   */
  async checkClinicBatches(practiceId) {
    try {
      // Check if Patient model is registered for this connection
      let Patient, Document;
      try {
        Patient = connection.model('Patient');
        Document = connection.model('Document');
      } catch (modelError) {
        // Model not registered for this connection - skip this practice
        // Log skipped practice (suppressed in quiet mode)
        if (secureConfigService.get('QUIET_LOGS') !== 'true' && secureConfigService.get('NODE_ENV') !== 'test') {
          console.log(`⚠️ Skipping practice ${practiceId} - models not registered`);
        }
        return 0;
      }
      
      // Find all patients with pending batches - fetch all and filter in JavaScript
      const allPatients = await SecureDataAccess.query('patients', {}, {}, this.serviceContext);
      const patientsWithBatches = allPatients.filter(patient => 
        patient.pendingBatchAnalysis && 
        Array.isArray(patient.pendingBatchAnalysis) && 
        patient.pendingBatchAnalysis.length > 0
      );
      
      if (patientsWithBatches.length === 0) {
        return 0;
      }
      
      console.log(`📦 Found ${patientsWithBatches.length} patients with pending batches in practice ${practiceId}`);
      
      for (const patient of patientsWithBatches) {
        for (const batch of patient.pendingBatchAnalysis) {
          try {
            // CRITICAL: Check if batch is already being processed by another worker cycle
            // This prevents race condition where 10-second worker interval causes duplicate processing
            if (batch.isProcessing) {
              console.log(`⏭️ Skipping batch ${batch.batchId} - already being processed by another worker cycle`);
              continue;
            }

            // Check if batch is old enough to check (at least 1 minute old)
            const batchAge = Date.now() - batch.createdAt.getTime();
            if (batchAge < 60000) {
              continue; // Skip very recent batches
            }
            
            // Check batch status
            const status = await batchProcessor.checkBatchStatus(batch.batchId);

            // Send progress notification if batch is still processing
            if (status.status === 'in_progress' && status.requestCounts) {
              const progress = {
                batchId: batch.batchId,
                patientId: patient._id,
                patientName: `${patient.firstName} ${patient.lastName}`,
                documentsProcessed: status.requestCounts.succeeded || 0,
                totalDocuments: status.requestCounts.total || batch.documents.length,
                percentComplete: Math.round(((status.requestCounts.succeeded || 0) / (status.requestCounts.total || 1)) * 100)
              };

              // Check if progress changed since last update
              const lastProgress = this.lastProgressUpdate[batch.batchId];
              const progressChanged = !lastProgress ||
                                    lastProgress.documentsProcessed !== progress.documentsProcessed ||
                                    lastProgress.percentComplete !== progress.percentComplete;

              if (progressChanged) {
                console.log(`⏳ Batch ${batch.batchId}: ${progress.documentsProcessed}/${progress.totalDocuments} documents (${progress.percentComplete}%)`);

                // Update last progress
                this.lastProgressUpdate[batch.batchId] = progress;

                // Emit WebSocket notification for real-time progress update
                if (global.io) {
                  const progressData = {
                    type: 'document_processing',
                    batchId: batch.batchId,
                    patientId: patient._id,
                    patientName: `${patient.firstName} ${patient.lastName}`,
                    message: `Processing ${progress.documentsProcessed} of ${progress.totalDocuments} documents (${progress.percentComplete}% complete)`,
                    progress: progress.percentComplete,
                    documentsProcessed: progress.documentsProcessed,
                    totalDocuments: progress.totalDocuments,
                    timestamp: new Date()
                  };

                  // Emit to practice room
                  global.io.to(`practice_${batch.practiceId}`).emit('batch_progress', progressData);
                  console.log(`📢 Emitted batch_progress to practice_${batch.practiceId}`);

                  // Also emit to session room if sessionId is available
                  if (batch.sessionId) {
                    global.io.to(`session_${batch.sessionId}`).emit('batch_progress', progressData);
                    console.log(`📢 Emitted batch_progress to session_${batch.sessionId}`);
                  }
                }

                // Also store in database for persistence
                const Notification = practiceModelLoader.getModel('Notification', batch.practiceId);
                if (Notification) {
                  await Notification.create({
                    type: 'batch_progress',
                    batchId: batch.batchId,
                    patientId: patient._id,
                    message: `Processing ${progress.documentsProcessed} of ${progress.totalDocuments} documents (${progress.percentComplete}% complete)`,
                    progress: progress.percentComplete,
                    createdAt: new Date(),
                    status: 'unread'
                  });
                }
              }
            }

            if (status.status === 'ended') {
              // CRITICAL: Set processing lock FIRST to prevent concurrent worker cycles from processing same batch
              // This fixes race condition where 10-second interval + long save operation = duplicate processing
              console.log(`🔒 Setting processing lock for batch ${batch.batchId}`);
              await SecureDataAccess.update(
                'patients',
                {
                  _id: patient._id,
                  'pendingBatchAnalysis.batchId': batch.batchId
                },
                {
                  $set: { 'pendingBatchAnalysis.$.isProcessing': true }
                },
                {},
                this.serviceContext
              );

              console.log(`✅ Batch ${batch.batchId} completed for patient ${patient.firstName} ${patient.lastName}`);

              // Clean up progress tracking for completed batch
              delete this.lastProgressUpdate[batch.batchId];

              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              // TWO-PASS BATCH EXTRACTION: Route based on phase
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              if (batch.phase === 1) {
                // ═════════════════════════════════════════════════════
                // PHASE 1 COMPLETION: Collection Selection → Create Phase 2
                // ═════════════════════════════════════════════════════
                console.log(`📋 Phase 1 complete: Extracting selected collections...`);

                try {
                  // Get Phase 1 results
                  const results = await batchProcessor.getBatchResults(batch.batchId);

                  // Extract selected collections from Phase 1 response
                  const Phase1 = require('./claudeBatchProcessorPhase1');
                  const phase1 = new Phase1();

                  let selectedCollections = [];
                  for (const result of results) {
                    // Try to extract collections with the preserved raw result
                    if (result.result && result.result.result && result.result.result.message) {
                      console.log(`✅ Found Phase 1 message, calling extractSelectedCollections...`);
                      const extracted = phase1.extractSelectedCollections(result.result);
                      selectedCollections = extracted.collections;
                      console.log(`✅ Phase 1 selected ${selectedCollections.length} collections`);
                      console.log(`📝 Reasoning: ${extracted.reasoning}`);
                      break; // Only need first result for collection selection
                    } else {
                      console.log(`❌ Phase 1 result missing expected structure`);
                    }
                  }

                  if (selectedCollections.length === 0) {
                    throw new Error('Phase 1 did not return any selected collections');
                  }

                  // Create Phase 2 batch with selected collections
                  const Phase2 = require('./claudeBatchProcessorPhase2');
                  const phase2 = new Phase2();

                  console.log(`🎯 Creating Phase 2 batch with ${selectedCollections.length} selected tools...`);
                  const phase2BatchId = await phase2.extractWithSelectedTools(
                    batch.documents.map(d => ({ content: '', documentId: d.documentId, fileName: d.fileName })), // Documents will be loaded by Phase 2
                    selectedCollections,
                    batch.practiceId
                  );

                  console.log(`✅ Phase 2 batch created: ${phase2BatchId}`);

                  // Add Phase 2 batch to patient's pendingBatchAnalysis
                  patient.pendingBatchAnalysis.push({
                    batchId: phase2BatchId,
                    phase: 2,  // Phase 2 = targeted extraction
                    phase1BatchId: batch.batchId,  // Link back to Phase 1
                    sessionId: batch.sessionId,
                    createdAt: new Date(),
                    documentCount: batch.documentCount,
                    documents: batch.documents,
                    selectedCollections: selectedCollections  // Store for reference
                  });

                  // Remove Phase 1 batch (it's complete)
                  patient.pendingBatchAnalysis = patient.pendingBatchAnalysis.filter(
                    b => b.batchId !== batch.batchId
                  );

                  await SecureDataAccess.update(
                    'patients',
                    { _id: patient._id },
                    { $set: { pendingBatchAnalysis: patient.pendingBatchAnalysis } },
                    {},
                    this.serviceContext
                  );

                  console.log(`✅ Phase 1 → Phase 2 transition complete`);
                  console.log(`⏳ Phase 2 batch ${phase2BatchId} will be processed when it completes`);

                  // Skip to next batch (Phase 2 will be processed in a future worker cycle)
                  continue;

                } catch (error) {
                  console.error(`❌ Phase 1 → Phase 2 transition failed:`, error);
                  // Remove failed batch
                  patient.pendingBatchAnalysis = patient.pendingBatchAnalysis.filter(
                    b => b.batchId !== batch.batchId
                  );
                  await SecureDataAccess.update(
                    'patients',
                    { _id: patient._id },
                    { $set: { pendingBatchAnalysis: patient.pendingBatchAnalysis } },
                    {},
                    this.serviceContext
                  );
                  continue;
                }
              }

              // ═════════════════════════════════════════════════════
              // PHASE 2 COMPLETION (or legacy single-pass): Save Data
              // ═════════════════════════════════════════════════════
              console.log(`💾 Phase ${batch.phase || 'legacy'} complete: Saving medical data...`);

              // Get results
              const results = await batchProcessor.getBatchResults(batch.batchId);
              
              // Process each result
              let successCount = 0;
              let failCount = 0;
              const keyFindings = [];
              
              for (const result of results) {
                if (result.success && result.analysis) {
                  successCount++;
                  
                  // Find the corresponding document
                  const docInfo = batch.documents.find(d => 
                    result.customId && result.customId.includes(d.id)
                  );
                  
                  if (docInfo) {
                    console.log(`📄 Updating document ${docInfo.id} (${docInfo.fileName})`);
                    const documents = await SecureDataAccess.query('documents', { _id: docInfo.id }, { limit: 1 }, this.serviceContext);
                    const document = documents[0];
                    if (document) {
                      console.log(`✅ Found document, current status: ${document.processingStatus}`);
                      // Update document with analysis results
                      document.aiClassification = {
                        documentType: result.analysis.documentType || 'medical_document',
                        confidence: 0.95,
                        extractedText: result.analysis.diagnosis || result.analysis.additionalNotes || '',
                        analyzedAt: new Date(),
                        medicalEntities: []
                      };
                      
                      if (result.analysis.medications) {
                        result.analysis.medications.forEach(med => {
                          document.aiClassification.medicalEntities.push({
                            entity: med.name,
                            type: 'medication',
                            confidence: 0.9
                          });
                        });
                      }
                      
                      if (result.analysis.tests) {
                        result.analysis.tests.forEach(test => {
                          document.aiClassification.medicalEntities.push({
                            entity: test.name,
                            type: 'test_result',
                            confidence: 0.9
                          });
                        });
                      }
                      
                      document.analysisResults = {
                        extractedText: JSON.stringify(result.analysis),
                        confidence: 0.95,
                        medicalData: result.analysis,
                        analyzedAt: new Date()
                      };
                      
                      document.processingStatus = 'completed';
                      document.processingResults = {
                        ...document.processingResults,
                        progress: 100,
                        progressStatus: 'Analysis complete (50% cost saved)',
                        stage: 'completed',
                        aiConfidence: 95,
                        aiConfidencePercentage: 95
                      };
                      
                      await SecureDataAccess.update('documents', { _id: document._id }, { $set: document }, {}, this.serviceContext);
                      console.log(`💾 Document ${docInfo.fileName} saved with status: ${document.processingStatus}`);
                      
                      // Collect key findings
                      if (result.analysis.diagnosis) {
                        keyFindings.push(`${docInfo.fileName}: ${result.analysis.diagnosis}`);
                      }
                      if (result.analysis.recommendations) {
                        keyFindings.push(`המלצות: ${result.analysis.recommendations}`);
                      }
                    }
                  }
                } else {
                  failCount++;
                }
              }

              // Save extracted medical data to individual collections using unified schema
              for (const result of results) {
                if (result.success && result.analysis) {
                  const docInfo = batch.documents.find(d =>
                    result.customId && result.customId.includes(d.id)
                  );

                  console.log(`💾 Saving medical data from document: ${docInfo?.fileName}`);

                  // Loop through all collection arrays in result.analysis
                  // Each collection (medications, diagnoses, lab_results, etc.) gets saved to its own MongoDB collection
                  for (const [collectionName, items] of Object.entries(result.analysis)) {
                    // Skip non-collection fields (patientName, documentDate, etc.)
                    if (!Array.isArray(items) || items.length === 0) {
                      continue;
                    }

                    try {
                      console.log(`  📂 Saving ${items.length} items to collection: ${collectionName}`);

                      // ============================================================================
                      // NOTE: Medication safety checks (drug interactions, allergies, etc.) are NOT
                      // performed here in batchResultsWorker.js anymore!
                      //
                      // ACTUAL LOCATION: medicalFieldMappingService.js
                      //   - Line 161: saveComprehensiveData() calls saveMedications()
                      //   - Lines 661-869: saveMedications() method performs ALL safety checks:
                      //     * Drug interaction checking (lines 716-848)
                      //     * Severity-based clinical messages (lines 798-816)
                      //     * Medication-specific safetyWarning (lines 850-868)
                      //     * Deduplication (lines 668-695)
                      //
                      // This code path is used by BOTH:
                      //   - Batch processing (Phase 2 → saveComprehensiveData)
                      //   - Agent operations (getMedications, createMedication, etc.)
                      //
                      // The old medication safety code that was here (lines 922-1053) has been
                      // removed as DEAD CODE - it was never executed after Phase 2 architecture
                      // introduced saveComprehensiveData() as the central entry point.
                      // ============================================================================

                      // Use saveToCollectionDynamic which reads unified schema and saves with correct field names
                      const saveResult = await medicalFieldMappingService.saveToCollectionDynamic(
                        collectionName,
                        items,
                        patient._id,
                        docInfo?.id,
                        result.analysis,
                        this.serviceContext
                      );

                      if (saveResult.success) {
                        console.log(`  ✅ Successfully saved ${collectionName}`);
                      } else {
                        console.error(`  ❌ Failed to save ${collectionName}:`, saveResult.error);
                      }
                    } catch (saveError) {
                      console.error(`  ❌ Error saving ${collectionName}:`, saveError.message);
                      // Continue with other collections even if one fails
                    }
                  }

                  // DEPRECATED OLD CODE BELOW (Lines 389-618) - Replaced with saveToCollectionDynamic above
                  // The old code saved everything to patient.medicalHistory array with hardcoded field mappings
                  // Now data goes to individual collections (medications, diagnoses, lab_results, etc.) using unified schema

                  /*
                  // Build medical history entry based on category
                  const historyEntry = {
                    date: result.analysis.date ? new Date(result.analysis.date) : new Date(),
                    category: category,
                    documentId: docInfo?.id,
                    fileName: docInfo?.fileName
                  };

                  // OLD HARDCODED SWITCH STATEMENT - REMOVED (Was 265 lines of hardcoded field mappings)
                  // This code saved everything to patient.medicalHistory with generic fields
                  // Replaced with saveToCollectionDynamic above which uses unified schema
                  */

                  // Create follow-up appointments from extracted data
                  if (result.analysis.followUpAppointments && result.analysis.followUpAppointments.length > 0) {
                    console.log(`📅 Creating ${result.analysis.followUpAppointments.length} follow-up appointments from document`);

                    for (const followUp of result.analysis.followUpAppointments) {
                      try {
                        // Parse timing to extract date and time
                        let appointmentDate = null;
                        let appointmentTime = 'Not specified';

                        if (followUp.timing) {
                          // Parse common timing patterns like "in 2 weeks", "next month", "3 months", etc.
                          const timing = followUp.timing.toLowerCase();
                          const now = new Date();

                          if (timing.includes('week')) {
                            const weeks = parseInt(timing.match(/(\d+)\s*week/)?.[1] || '1');
                            appointmentDate = new Date(now);
                            appointmentDate.setDate(appointmentDate.getDate() + (weeks * 7));
                          } else if (timing.includes('month')) {
                            const months = parseInt(timing.match(/(\d+)\s*month/)?.[1] || '1');
                            appointmentDate = new Date(now);
                            appointmentDate.setMonth(appointmentDate.getMonth() + months);
                          } else if (timing.includes('day')) {
                            const days = parseInt(timing.match(/(\d+)\s*day/)?.[1] || '1');
                            appointmentDate = new Date(now);
                            appointmentDate.setDate(appointmentDate.getDate() + days);
                          } else if (timing.includes('year')) {
                            const years = parseInt(timing.match(/(\d+)\s*year/)?.[1] || '1');
                            appointmentDate = new Date(now);
                            appointmentDate.setFullYear(appointmentDate.getFullYear() + years);
                          }

                          // Extract time if specified (e.g., "at 2:00 PM", "10:00 AM")
                          const timeMatch = timing.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
                          if (timeMatch) {
                            appointmentTime = timeMatch[0];
                          }
                        }

                        // Create the follow-up appointment record
                        // Map provider to department (since specialty field doesn't exist in extracted data)
                        let department = 'General';
                        if (followUp.provider) {
                          const providerLower = followUp.provider.toLowerCase();
                          if (providerLower.includes('cardiology')) {
                            department = 'Cardiology';
                          } else if (providerLower.includes('pulmonology')) {
                            department = 'Pulmonology';
                          } else if (providerLower.includes('primary')) {
                            department = 'Primary Care';
                          } else if (providerLower.includes('neurology')) {
                            department = 'Neurology';
                          } else if (providerLower.includes('orthopedic')) {
                            department = 'Orthopedics';
                          } else if (followUp.specialty) {
                            // Fallback to specialty if it exists
                            department = followUp.specialty;
                          } else {
                            // Use provider as department if no mapping found
                            department = followUp.provider;
                          }
                        }

                        const followUpRecord = {
                          patientId: patient._id,
                          documentId: docInfo?.id,
                          date: appointmentDate ? appointmentDate.toISOString().split('T')[0] : '',
                          time: appointmentTime,
                          provider: followUp.provider || 'Not assigned',
                          department: department,
                          reason: followUp.reason || 'Follow-up from document analysis',
                          notes: `Extracted from: ${docInfo?.fileName || 'document'}`,
                          status: 'pending',
                          createdAt: new Date(),
                          createdBy: 'batch-processor',
                          _securityMetadata: {
                            createdAt: new Date(),
                            createdBy: 'batch-processor',
                            lastModifiedAt: new Date(),
                            lastModifiedBy: 'batch-processor',
                            practiceId: practiceId
                          }
                        };

                        // Insert the follow-up appointment
                        await SecureDataAccess.insert('follow_up_appointments', followUpRecord, this.serviceContext);
                        console.log(`✅ Created follow-up appointment for ${followUp.specialty || 'General'} - ${followUp.provider || 'provider'}`);

                      } catch (followUpError) {
                        console.error(`❌ Failed to create follow-up appointment:`, followUpError.message);
                        // Continue with other follow-ups even if one fails
                      }
                    }
                  }
                }
              }

              // Add summary entry
              let summaryText = `📊 ניתוח אצווה הושלם\n`;
              summaryText += `✅ ${successCount}/${results.length} מסמכים נותחו בהצלחה\n`;
              summaryText += `💰 חסכנו 50% בעלויות עיבוד!\n`;
              
              if (keyFindings.length > 0) {
                summaryText += `\nממצאים עיקריים:\n${keyFindings.join('\n')}`;
              }
              
              // Store batch summary in a note field or custom field
              patient.batchAnalysisHistory = patient.batchAnalysisHistory || [];
              patient.batchAnalysisHistory.push({
                date: new Date(),
                batchId: batch.batchId,
                description: summaryText,
                documents: batch.documents.map(d => d.id),
                analysisResults: {
                  successful: successCount,
                  failed: failCount,
                  total: results.length
                }
              });
              
              // Remove this batch from pending
              patient.pendingBatchAnalysis = patient.pendingBatchAnalysis.filter(
                b => b.batchId !== batch.batchId
              );
              
              await SecureDataAccess.update('patients', { _id: patient._id }, { $set: patient }, {}, this.serviceContext);

              // Update patient document references
              const documentIds = batch.documents.map(d => d.id || d._id).filter(id => id);
              if (documentIds.length > 0) {
                console.log(`🔗 Updating patient document references with ${documentIds.length} document IDs`);
                await SecureDataAccess.update(
                  'patients',
                  { _id: patient._id },
                  {
                    $addToSet: { documents: { $each: documentIds } },
                    $inc: { documentCount: documentIds.length },
                    $set: { lastDocumentUpload: new Date() }
                  },
                  this.serviceContext
                );
                console.log(`✅ Updated patient.documents array with ${documentIds.length} document references`);
              }

              console.log(`📊 Processed batch ${batch.batchId}: ${successCount} successful, ${failCount} failed`);
              
              // Track cost savings
              const costSaved = batchProcessor.calculateSavings(batch.documentCount);
              console.log(`💰 Saved approximately $${costSaved} with batch processing`);

              // Emit WebSocket notification for batch completion
              if (global.io) {
                const completeData = {
                  type: 'batch_complete',
                  batchId: batch.batchId,
                  patientId: patient._id,
                  patientName: `${patient.firstName} ${patient.lastName}`,
                  message: `✅ Document analysis complete! ${successCount}/${batch.documents.length} document(s) successfully processed.`,
                  documentsProcessed: successCount,
                  totalDocuments: batch.documents.length,
                  keyFindings: keyFindings.slice(0, 3), // Send first 3 key findings
                  timestamp: new Date()
                };

                // Emit to practice room
                global.io.to(`practice_${batch.practiceId}`).emit('batch_complete', completeData);

                // Also emit to session room if sessionId is available
                if (batch.sessionId) {
                  global.io.to(`session_${batch.sessionId}`).emit('batch_complete', completeData);
                  console.log(`📢 Emitted batch_complete to session_${batch.sessionId}`);
                }
                console.log(`📢 Emitted batch_complete to practice_${batch.practiceId}`);
              }

              // Store completion notification in database
              const Notification = practiceModelLoader.getModel('Notification', batch.practiceId);
              if (Notification) {
                await Notification.create({
                  type: 'batch_complete',
                  batchId: batch.batchId,
                  patientId: patient._id,
                  message: `✅ Document analysis complete! ${successCount}/${batch.documents.length} document(s) successfully processed.`,
                  fileCount: batch.documents.length,
                  createdAt: new Date(),
                  completedAt: new Date(),
                  uploadId: batch.uploadId,
                  results: batch.documents.map(d => ({
                    fileName: d.fileName,
                    success: true,
                    patientName: `${patient.firstName} ${patient.lastName}`,
                    category: d.category
                  })),
                  status: 'unread'
                });
                console.log(`💾 Stored batch completion notification in database`);
              }

            } else if (status.status === 'failed' || status.status === 'expired') {
              console.error(`❌ Batch ${batch.batchId} failed or expired`);
              
              // Update patient record
              patient.medicalHistory = patient.medicalHistory || [];
              patient.medicalHistory.push({
                date: new Date(),
                type: 'batch_analysis_failed',
                description: `❌ ניתוח אצווה נכשל עבור ${batch.documentCount} מסמכים`,
                documents: batch.documents.map(d => d.id),
                batchId: batch.batchId
              });
              
              // Mark documents as failed
              for (const docInfo of batch.documents) {
                const documents = await SecureDataAccess.query('documents', { _id: docInfo.id }, { limit: 1 }, this.serviceContext);
                const document = documents[0];
                if (document) {
                  document.processingStatus = 'failed';
                  document.processingResults = {
                    ...document.processingResults,
                    progressStatus: 'Batch analysis failed',
                    stage: 'failed'
                  };
                  await SecureDataAccess.update('documents', { _id: document._id }, { $set: document }, {}, this.serviceContext);
                }
              }
              
              // Remove from pending
              patient.pendingBatchAnalysis = patient.pendingBatchAnalysis.filter(
                b => b.batchId !== batch.batchId
              );
              
              await SecureDataAccess.update('patients', { _id: patient._id }, { $set: patient }, {}, this.serviceContext);
            } else {
              // Still processing
              console.log(`⏳ Batch ${batch.batchId} still processing: ${status.progress}`);
            }
            
          } catch (batchError) {
            console.error(`❌ Error processing batch ${batch.batchId}:`, batchError.message);

            // CRITICAL: Clear processing lock on error to prevent batch from being stuck
            try {
              await SecureDataAccess.update(
                'patients',
                {
                  _id: patient._id,
                  'pendingBatchAnalysis.batchId': batch.batchId
                },
                {
                  $set: { 'pendingBatchAnalysis.$.isProcessing': false }
                },
                {},
                this.serviceContext
              );
              console.log(`🔓 Cleared processing lock for batch ${batch.batchId} after error`);
            } catch (lockError) {
              console.error(`❌ Failed to clear processing lock:`, lockError.message);
            }
          }
        }
      }
      
      return patientsWithBatches.length;
      
    } catch (error) {
      console.error(`❌ Error checking practice ${practiceId} batches:`, error.message);
      return 0;
    }
  }
  
  /**
   * Manually trigger batch check for a specific batch ID
   */
  async processBatch(batchId, clinicConnection) {
    try {
      const status = await batchProcessor.checkBatchStatus(batchId);
      
      if (status.status !== 'ended') {
        return {
          success: false,
          message: `Batch still ${status.status}`,
          progress: status.progress
        };
      }
      
      const results = await batchProcessor.getBatchResults(batchId);
      
      return {
        success: true,
        results: results,
        count: results.length
      };
      
    } catch (error) {
      console.error('❌ Manual batch processing error:', error.message);
      throw error;
    }
  }

  /**
   * Perform automatic cleanup of old batch records
   * Called every hour by cleanup interval
   */
  async performCleanup() {
    try {
      console.log('🧹 Running automatic batch cleanup...');

      const batchStateManager = require('./batchStateManager');
      const PendingUpload = require('../models/PendingUpload');

      // Clean up old completed/failed batches (older than 6 hours)
      const cleanedBatches = await batchStateManager.cleanupOldBatches(6);
      console.log(`🧹 Cleaned ${cleanedBatches} old batch records`);

      // Clean up expired pending uploads
      const cleanedUploads = await PendingUpload.cleanupExpired();
      console.log(`🧹 Cleaned ${cleanedUploads} expired pending uploads`);

      // Clean up old batch_metadata (completed/failed batches older than 24 hours)
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const metadataResult = await SecureDataAccess.delete(
        'batch_metadata',
        {
          status: { $in: ['phase1_complete', 'phase1_failed', 'phase2_complete', 'phase2_failed'] },
          createdAt: { $lt: cutoffDate }
        },
        { serviceId: 'batch-results-worker', practiceId: 'global' }
      );
      console.log(`🧹 Cleaned ${metadataResult.deletedCount || 0} old batch_metadata records`);

      const totalCleaned = cleanedBatches + cleanedUploads + (metadataResult.deletedCount || 0);
      if (totalCleaned > 0) {
        console.log(`✅ Automatic cleanup completed: ${totalCleaned} total records removed`);
      }

    } catch (error) {
      console.error('❌ Automatic cleanup error:', error.message);
      // Don't throw - cleanup failures shouldn't stop the worker
    }
  }
}

// Create singleton instance
const worker = new BatchResultsWorker();

// DO NOT auto-start here - server.js will initialize and start the worker
// This prevents starting worker before initialization completes
// Old auto-start code removed to fix race condition where worker started without serviceContext

module.exports = worker;