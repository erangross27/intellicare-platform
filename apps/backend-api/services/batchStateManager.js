/**
 * Batch State Manager Service
 *
 * Manages persistent state for Claude Batch API processing jobs.
 * Ensures batch jobs survive server restarts and can be recovered.
 *
 * CRITICAL: All batch state stored in database, not just memory.
 */

const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');

class BatchStateManager {
  constructor() {
    this.serviceName = 'batchStateManager';
    this.serviceAuth = null;
    this.initialized = false;

    console.log('📊 BatchStateManager initialized');
  }

  /**
   * Initialize service authentication
   */
  async initialize() {
    if (this.initialized) return;

    this.serviceAuth = await serviceAccountManager.authenticate(this.serviceName);

    if (!this.serviceAuth) {
      throw new Error('Failed to authenticate batchStateManager service');
    }

    this.initialized = true;
    console.log('✅ BatchStateManager authenticated');
  }

  /**
   * Create secure context for database operations
   */
  createSecureContext(practiceId, operation) {
    return {
      serviceId: this.serviceName,
      operation: operation,
      practiceId: practiceId || 'global',
      apiKey: this.serviceAuth?.apiKey
    };
  }

  /**
   * Register a new batch job in the database
   * Called when batch is first created
   *
   * DUAL STORAGE:
   * 1. Metadata (NO PHI) in global database for recovery
   * 2. Full details (with PHI) in practice database
   *
   * @param {string} batchId - Anthropic batch ID
   * @param {Object} metadata - Batch metadata
   * @returns {Promise<Object>} Created batch record
   */
  async registerBatch(batchId, metadata) {
    console.log(`📝 [BatchStateManager] Registering batch ${batchId} (${metadata.documentCount} documents)`);
    if (!this.initialized) {
      await this.initialize();
    }

    // 1. Store metadata in GLOBAL database (NO PHI)
    const globalMetadata = {
      batchId,
      practiceId: metadata.practiceId,
      status: 'in_progress',
      documentCount: metadata.documentCount || 0,
      monitoringActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      // NO patient data, NO filenames, NO PHI

      _securityMetadata: {
        createdAt: new Date(),
        createdBy: this.serviceName,
        lastModifiedAt: new Date(),
        lastModifiedBy: this.serviceName,
        practiceId: 'global'
      }
    };

    const globalContext = this.createSecureContext('global', 'registerBatch');
    await SecureDataAccess.insert('batch_metadata', globalMetadata, globalContext);
    console.log(`✅ [BatchStateManager] Registered batch metadata in global database`);

    // 2. Store full details in PRACTICE database (with PHI)
    const batchRecord = {
      batchId,
      practiceId: metadata.practiceId,
      patientId: metadata.patientId,
      status: 'in_progress',

      // Batch metadata
      documentCount: metadata.documentCount || 0,
      documents: metadata.documents || [], // May contain filenames with patient names

      // Progress tracking
      requestCounts: {
        total: metadata.documentCount || 0,
        processing: 0,
        succeeded: 0,
        errored: 0,
        expired: 0,
        canceled: 0
      },

      // Monitoring state
      monitoringActive: true,
      lastPolled: new Date(),
      pollInterval: 2000, // 2 seconds

      // Session info for notifications
      sessionId: metadata.sessionId || null,
      practiceSubdomain: metadata.practiceSubdomain || metadata.practiceId,

      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,

      // Cost tracking
      estimatedSavings: metadata.estimatedSavings || 0,

      // Error handling
      errorCount: 0,
      lastError: null,
      retryCount: 0,

      // Cleanup (auto-cleanup after 6 hours)
      cleanupAfter: new Date(Date.now() + 6 * 60 * 60 * 1000),

      // Security metadata
      _securityMetadata: {
        createdAt: new Date(),
        createdBy: this.serviceName,
        lastModifiedAt: new Date(),
        lastModifiedBy: this.serviceName,
        practiceId: metadata.practiceId || 'global'
      }
    };

    const practiceContext = this.createSecureContext(metadata.practiceId, 'registerBatch');
    await SecureDataAccess.insert('active_batch_jobs', batchRecord, practiceContext);
    console.log(`✅ [BatchStateManager] Registered batch details in practice database`);

    return batchRecord;
  }

  /**
   * Update batch progress
   * Called during monitoring loop
   *
   * DUAL UPDATE: Updates both global metadata and practice details
   *
   * @param {string} batchId - Batch ID
   * @param {Object} progressData - Progress update
   * @param {string} practiceId - Practice ID for context
   */
  async updateBatchProgress(batchId, progressData, practiceId = 'global') {
    if (!this.initialized) {
      await this.initialize();
    }

    // 1. Update GLOBAL metadata (status only, no PHI)
    const globalContext = this.createSecureContext('global', 'updateBatchProgress');
    const globalUpdate = {
      status: progressData.status,
      updatedAt: new Date(),
      '_securityMetadata.lastModifiedAt': new Date(),
      '_securityMetadata.lastModifiedBy': this.serviceName
    };

    await SecureDataAccess.update(
      'batch_metadata',
      { batchId },
      { $set: globalUpdate },
      globalContext,
      { upsert: false }
    );

    // 2. Update PRACTICE database (full details)
    const practiceContext = this.createSecureContext(practiceId, 'updateBatchProgress');
    const practiceUpdate = {
      ...progressData,
      updatedAt: new Date(),
      lastPolled: new Date(),
      '_securityMetadata.lastModifiedAt': new Date(),
      '_securityMetadata.lastModifiedBy': this.serviceName
    };

    await SecureDataAccess.update(
      'active_batch_jobs',
      { batchId },
      { $set: practiceUpdate },
      practiceContext,
      { upsert: false }
    );

    // Log only significant updates (not every poll)
    if (progressData.status === 'ended' || progressData.status === 'failed' ||
        (progressData.progress && progressData.progress % 10 === 0)) {
      console.log(`📊 Batch ${batchId} progress: ${progressData.progress || 0}% (${progressData.status || 'processing'})`);
    }
  }

  /**
   * Mark batch as complete
   * Called when batch processing finishes
   *
   * DUAL UPDATE: Updates both global metadata and practice details
   * Global metadata is soft-deleted to remove from recovery list
   *
   * @param {string} batchId - Batch ID
   * @param {Object} results - Final results
   * @param {string} practiceId - Practice ID
   */
  async completeBatch(batchId, results, practiceId = 'global') {
    if (!this.initialized) {
      await this.initialize();
    }

    // 1. Soft delete GLOBAL metadata (remove from recovery)
    const globalContext = this.createSecureContext('global', 'completeBatch');
    await SecureDataAccess.update(
      'batch_metadata',
      { batchId },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          monitoringActive: false,
          updatedAt: new Date(),
          _deleted: true,
          _deletedAt: new Date(),
          '_securityMetadata.lastModifiedAt': new Date(),
          '_securityMetadata.lastModifiedBy': this.serviceName
        }
      },
      globalContext
    );

    // 2. Update PRACTICE database with full results
    const practiceContext = this.createSecureContext(practiceId, 'completeBatch');
    await SecureDataAccess.update(
      'active_batch_jobs',
      { batchId },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          monitoringActive: false,
          results: results,
          updatedAt: new Date(),
          '_securityMetadata.lastModifiedAt': new Date(),
          '_securityMetadata.lastModifiedBy': this.serviceName
        }
      },
      practiceContext
    );

    console.log(`✅ Batch ${batchId} marked as completed`);
  }

  /**
   * Mark batch as failed
   * Called when batch processing fails
   *
   * DUAL UPDATE: Updates both global metadata and practice details
   * Global metadata is soft-deleted to remove from recovery list
   *
   * @param {string} batchId - Batch ID
   * @param {string} errorMessage - Error description
   * @param {string} practiceId - Practice ID
   */
  async failBatch(batchId, errorMessage, practiceId = 'global') {
    if (!this.initialized) {
      await this.initialize();
    }

    // 1. Soft delete GLOBAL metadata (remove from recovery)
    const globalContext = this.createSecureContext('global', 'failBatch');
    await SecureDataAccess.update(
      'batch_metadata',
      { batchId },
      {
        $set: {
          status: 'failed',
          completedAt: new Date(),
          monitoringActive: false,
          updatedAt: new Date(),
          _deleted: true,
          _deletedAt: new Date(),
          '_securityMetadata.lastModifiedAt': new Date(),
          '_securityMetadata.lastModifiedBy': this.serviceName
        }
      },
      globalContext
    );

    // 2. Update PRACTICE database with error details
    const practiceContext = this.createSecureContext(practiceId, 'failBatch');
    await SecureDataAccess.update(
      'active_batch_jobs',
      { batchId },
      {
        $set: {
          status: 'failed',
          completedAt: new Date(),
          monitoringActive: false,
          lastError: errorMessage,
          updatedAt: new Date(),
          '_securityMetadata.lastModifiedAt': new Date(),
          '_securityMetadata.lastModifiedBy': this.serviceName
        },
        $inc: { errorCount: 1 }
      },
      practiceContext
    );

    console.error(`❌ Batch ${batchId} marked as failed: ${errorMessage}`);
  }

  /**
   * Get all active batches for recovery
   * Called on server startup
   *
   * NEW ARCHITECTURE:
   * 1. Query GLOBAL database for batch_metadata (NO PHI)
   * 2. For each batch, query its SPECIFIC practice database for full details
   * 3. No cross-practice data access - only query practices that have active batches
   *
   * @param {string} practiceId - Practice ID to query (optional, queries all if not provided)
   * @returns {Promise<Array>} Active batch jobs with full details
   */
  async getActiveBatches(practiceId = null) {
    console.log('🔍 [BatchStateManager] Querying global batch metadata...');
    if (!this.initialized) {
      await this.initialize();
    }

    const allBatches = [];

    try {
      // 1. Query GLOBAL database for batch metadata (NO PHI)
      const globalContext = this.createSecureContext('global', 'getActiveBatches');

      const filter = {
        status: { $in: ['in_progress', 'processing'] },
        monitoringActive: true
      };

      // If practiceId specified, only get batches for that practice
      if (practiceId) {
        filter.practiceId = practiceId;
      }

      const batchMetadata = await SecureDataAccess.query(
        'batch_metadata',
        filter,
        {},
        globalContext
      );

      console.log(`📊 [BatchStateManager] Found ${batchMetadata.length} active batch(es) in global metadata`);

      if (batchMetadata.length === 0) {
        return [];
      }

      // 2. For each batch, query its SPECIFIC practice database for full details
      for (const metadata of batchMetadata) {
        try {
          const batchPracticeId = metadata.practiceId;

          console.log(`   🔍 Fetching details for batch ${metadata.batchId} from practice ${batchPracticeId}`);

          const practiceContext = this.createSecureContext(batchPracticeId, 'getActiveBatches');

          const batchDetails = await SecureDataAccess.query(
            'active_batch_jobs',
            { batchId: metadata.batchId },
            { limit: 1 },
            practiceContext
          );

          if (batchDetails && batchDetails.length > 0) {
            console.log(`   ✅ Found batch details for ${metadata.batchId}`);
            allBatches.push(batchDetails[0]);
          } else {
            console.warn(`   ⚠️ No details found for batch ${metadata.batchId} in practice ${batchPracticeId}`);
          }
        } catch (err) {
          console.warn(`   ⚠️ Could not fetch batch ${metadata.batchId}:`, err.message);
        }
      }
    } catch (error) {
      console.error('❌ Error querying for active batches:', error.message);
      console.error('   Stack:', error.stack);
    }

    console.log(`📊 [BatchStateManager] Returning ${allBatches.length} batch(es) with full details`);
    return allBatches;
  }

  /**
   * Get batch by ID
   *
   * @param {string} batchId - Batch ID
   * @param {string} practiceId - Practice ID
   * @returns {Promise<Object|null>} Batch record or null
   */
  async getBatch(batchId, practiceId = 'global') {
    if (!this.initialized) {
      await this.initialize();
    }

    const context = this.createSecureContext(practiceId, 'getBatch');

    const batches = await SecureDataAccess.query(
      'active_batch_jobs',
      { batchId },
      { limit: 1 },
      context
    );

    return batches && batches.length > 0 ? batches[0] : null;
  }

  /**
   * Increment retry count for a batch
   *
   * @param {string} batchId - Batch ID
   * @param {string} practiceId - Practice ID
   */
  async incrementRetryCount(batchId, practiceId = 'global') {
    if (!this.initialized) {
      await this.initialize();
    }

    const context = this.createSecureContext(practiceId, 'incrementRetryCount');

    await SecureDataAccess.update(
      'active_batch_jobs',
      { batchId },
      {
        $inc: { retryCount: 1 },
        $set: { updatedAt: new Date() }
      },
      context
    );
  }

  /**
   * Clean up old completed batches
   * Should be called periodically (e.g., daily cron job)
   *
   * @param {number} olderThanHours - Clean batches older than X hours
   */
  async cleanupOldBatches(olderThanHours = 6) {
    if (!this.initialized) {
      await this.initialize();
    }

    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const context = this.createSecureContext('global', 'cleanupOldBatches');

    const result = await SecureDataAccess.delete(
      'active_batch_jobs',
      {
        status: { $in: ['completed', 'failed'] },
        completedAt: { $lt: cutoffDate }
      },
      context
    );

    console.log(`🧹 Cleaned up ${result.deletedCount || 0} old batch records`);

    return result.deletedCount || 0;
  }

  /**
   * Get statistics about active batches
   *
   * @returns {Promise<Object>} Batch statistics
   */
  async getStats() {
    if (!this.initialized) {
      await this.initialize();
    }

    const context = this.createSecureContext('global', 'getStats');

    const allBatches = await SecureDataAccess.query(
      'active_batch_jobs',
      {},
      {},
      context
    );

    const stats = {
      total: allBatches.length,
      inProgress: allBatches.filter(b => b.status === 'in_progress').length,
      completed: allBatches.filter(b => b.status === 'completed').length,
      failed: allBatches.filter(b => b.status === 'failed').length,
      monitoring: allBatches.filter(b => b.monitoringActive).length,
      totalDocuments: allBatches.reduce((sum, b) => sum + (b.documentCount || 0), 0),
      totalSavings: allBatches.reduce((sum, b) => sum + (b.estimatedSavings || 0), 0)
    };

    return stats;
  }
}

// Export singleton instance
module.exports = new BatchStateManager();
