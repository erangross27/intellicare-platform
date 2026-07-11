/**
 * Batch Progress Cache Service
 *
 * Provides in-memory caching for batch processing progress with:
 * - Real-time SSE streaming
 * - Throttled database writes
 * - Automatic cleanup of stale entries
 */

class BatchProgressCache {
  constructor() {
    this.progressMap = new Map();
    this.sseClients = new Map(); // Map of batchId -> Set of SSE response objects
    this.lastDbWrite = new Map(); // Track last DB write time per batch
    this.dbWriteInterval = 10000; // Write to DB every 10 seconds
    this.staleTimeout = 30 * 60 * 1000; // 30 minutes
    this.serviceAuth = null; // Will store authentication info

    // Start cleanup interval (synchronous setup only)
    this.startCleanupInterval();

    console.log('📊 BatchProgressCache constructed');
  }

  /**
   * Initialize service with authentication
   * Called by masterServiceLoader after construction
   */
  async initialize() {
    if (this.serviceAuth) {
      console.log('⏭️ BatchProgressCache already initialized');
      return;
    }

    try {
      const serviceAccountManager = require('./serviceAccountManager');
      this.serviceAuth = await serviceAccountManager.authenticate('batch-progress-cache');
      console.log('✅ Batch progress cache service authenticated successfully');
    } catch (error) {
      console.error('❌ Failed to authenticate batch progress cache service:', error.message);
      throw error; // Propagate error so masterServiceLoader knows initialization failed
    }
  }

  /**
   * Update progress for a batch
   * @param {string} batchId - Batch identifier
   * @param {Object} progressData - Progress information
   * @param {boolean} forceDbWrite - Force immediate DB write
   */
  updateProgress(batchId, progressData, forceDbWrite = false) {
    // Update in-memory cache
    const currentTime = Date.now();
    const progress = {
      ...progressData,
      batchId,
      updatedAt: new Date(),
      timestamp: currentTime
    };

    this.progressMap.set(batchId, progress);

    // Stream to SSE clients
    this.streamToClients(batchId, progress);

    // Check if we should write to DB
    const lastWrite = this.lastDbWrite.get(batchId) || 0;
    const timeSinceLastWrite = currentTime - lastWrite;

    // Write to DB if forced, or if enough time has passed, or on completion
    const shouldWriteToDb = forceDbWrite ||
                           timeSinceLastWrite > this.dbWriteInterval ||
                           progressData.status === 'completed' ||
                           progressData.status === 'failed';

    if (shouldWriteToDb) {
      this.lastDbWrite.set(batchId, currentTime);
      this.writeToDatabase(batchId, progress);
    }

    // Log progress
    if (progressData.progress !== undefined) {
      console.log(`📊 Batch ${batchId}: ${progressData.progress}% (${progressData.message || 'Processing...'})`);
    }
  }

  /**
   * Get progress for a batch
   * @param {string} batchId - Batch identifier
   * @returns {Object|null} Progress data or null if not found
   */
  getProgress(batchId) {
    return this.progressMap.get(batchId) || null;
  }

  /**
   * Get all active batch progress
   * @returns {Array} Array of active batch progress
   */
  getAllActiveProgress() {
    const activeProgress = [];
    const currentTime = Date.now();

    for (const [batchId, progress] of this.progressMap) {
      // Only include recent and non-completed batches
      const age = currentTime - progress.timestamp;
      if (age < this.staleTimeout &&
          progress.status !== 'completed' &&
          progress.status !== 'failed') {
        activeProgress.push(progress);
      }
    }

    return activeProgress;
  }

  /**
   * Register SSE client for a batch
   * @param {string} batchId - Batch identifier (or '*' for all)
   * @param {Object} res - Express response object configured for SSE
   */
  registerSSEClient(batchId, res) {
    if (!this.sseClients.has(batchId)) {
      this.sseClients.set(batchId, new Set());
    }
    this.sseClients.get(batchId).add(res);

    // Send initial progress if available
    if (batchId !== '*') {
      const progress = this.getProgress(batchId);
      if (progress) {
        this.sendSSEMessage(res, progress);
      }
    } else {
      // Send all active progress for wildcard subscriptions
      const allProgress = this.getAllActiveProgress();
      allProgress.forEach(progress => {
        this.sendSSEMessage(res, progress);
      });
    }

    console.log(`📡 SSE client registered for batch: ${batchId}`);
  }

  /**
   * Unregister SSE client
   * @param {string} batchId - Batch identifier
   * @param {Object} res - Express response object
   */
  unregisterSSEClient(batchId, res) {
    const clients = this.sseClients.get(batchId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        this.sseClients.delete(batchId);
      }
    }
  }

  /**
   * Stream progress to connected SSE clients
   * @param {string} batchId - Batch identifier
   * @param {Object} progress - Progress data
   */
  streamToClients(batchId, progress) {
    // Send to specific batch subscribers
    const batchClients = this.sseClients.get(batchId) || new Set();
    for (const client of batchClients) {
      this.sendSSEMessage(client, progress);
    }

    // Send to wildcard subscribers
    const wildcardClients = this.sseClients.get('*') || new Set();
    for (const client of wildcardClients) {
      this.sendSSEMessage(client, progress);
    }
  }

  /**
   * Send SSE message to client
   * @param {Object} res - Express response object
   * @param {Object} data - Data to send
   */
  sendSSEMessage(res, data) {
    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      res.write(message);
    } catch (error) {
      // Client disconnected, will be cleaned up
      console.log('📡 SSE client disconnected');
    }
  }

  /**
   * Write progress to database (throttled)
   * @param {string} batchId - Batch identifier
   * @param {Object} progress - Progress data
   */
  async writeToDatabase(batchId, progress) {
    try {
      const SecureDataAccess = require('./secureDataAccess');

      // Prepare update data
      const updateData = {
        batchId,
        ...progress,
        lastDbWrite: new Date()
      };

      // Use upsert to create or update
      await SecureDataAccess.update(
        'batch_progress',
        { batchId },
        { $set: updateData },
        {
          serviceId: 'batch-progress-cache',
          operation: 'updateProgress',
          practiceId: progress.practiceId || 'global'
        },
        { upsert: true }
      );

      console.log(`💾 Batch progress written to DB: ${batchId} (${progress.progress}%)`);
    } catch (error) {
      console.error(`❌ Error writing batch progress to DB:`, error);
    }
  }

  /**
   * Clean up completed batches from database
   * @param {string} batchId - Batch identifier
   */
  async cleanupBatch(batchId) {
    try {
      const SecureDataAccess = require('./secureDataAccess');

      // Remove from memory
      this.progressMap.delete(batchId);
      this.lastDbWrite.delete(batchId);

      // Mark as cleaned in DB (don't delete, just mark)
      await SecureDataAccess.update(
        'batch_progress',
        { batchId },
        {
          $set: {
            cleanedAt: new Date(),
            status: 'cleaned'
          }
        },
        {
          serviceId: 'batch-progress-cache',
          operation: 'cleanupBatch',
          practiceId: 'global'
        }
      );

      console.log(`🧹 Cleaned up batch: ${batchId}`);
    } catch (error) {
      console.error(`❌ Error cleaning up batch:`, error);
    }
  }

  /**
   * Start interval to clean up stale entries
   */
  startCleanupInterval() {
    setInterval(() => {
      const currentTime = Date.now();
      const toDelete = [];

      for (const [batchId, progress] of this.progressMap) {
        const age = currentTime - progress.timestamp;

        // Clean up completed or stale entries
        if (age > this.staleTimeout ||
            (progress.status === 'completed' && age > 60000) ||
            (progress.status === 'failed' && age > 60000)) {
          toDelete.push(batchId);
        }
      }

      // Clean up
      toDelete.forEach(batchId => {
        this.cleanupBatch(batchId);
      });

      if (toDelete.length > 0) {
        console.log(`🧹 Cleaned up ${toDelete.length} stale batch progress entries`);
      }
    }, 60000); // Run every minute
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      totalBatches: this.progressMap.size,
      activeBatches: this.getAllActiveProgress().length,
      sseClients: Array.from(this.sseClients.entries()).map(([batchId, clients]) => ({
        batchId,
        clientCount: clients.size
      })),
      cacheSize: this.progressMap.size * 1000 // Approximate bytes
    };
  }
}

// Export singleton instance for immediate use
// The masterServiceLoader will call initialize() on this instance
const batchProgressCache = new BatchProgressCache();
module.exports = batchProgressCache;