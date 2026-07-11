// Cleanup Cron Job
// Runs periodic cleanup of temporary files, orphaned uploads, and old logs

const cron = require('node-cron');
const secureConfigService = require('../services/secureConfigService');
const { fileCleanupService } = require('../services/fileCleanup');

class CleanupCronJob {
  constructor(options = {}) {
    this.schedule = options.schedule || '0 * * * *'; // Default: every hour on the hour
    this.enabled = options.enabled !== false; // Default: enabled
    this.job = null;
    this.isRunning = false;
    this.runHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Start the cleanup cron job
   */
  start() {
    if (!this.enabled) {
      console.log('⏸️ Cleanup cron job is disabled');
      return;
    }

    if (this.job) {
      console.log('⚠️ Cleanup cron job is already running');
      return;
    }

    console.log(`🕐 Starting cleanup cron job with schedule: ${this.schedule}`);
    
    // Validate cron expression
    if (!cron.validate(this.schedule)) {
      console.error(`❌ Invalid cron schedule: ${this.schedule}`);
      throw new Error(`Invalid cron schedule: ${this.schedule}`);
    }

    // Create and start the cron job
    this.job = cron.schedule(this.schedule, async () => {
      await this.runCleanup();
    }, {
      scheduled: true,
      timezone: secureConfigService.get('TZ') || 'UTC'
    });

    console.log('✅ Cleanup cron job started successfully');
    
    // Run initial cleanup after 1 minute
    setTimeout(() => {
      console.log('🚀 Running initial cleanup...');
      this.runCleanup();
    }, 60000);
  }

  /**
   * Stop the cleanup cron job
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      console.log('⏹️ Cleanup cron job stopped');
    }
  }

  /**
   * Run cleanup manually
   */
  async runCleanup() {
    if (this.isRunning) {
      console.log('⏭️ Cleanup already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('🧹 [CRON] Starting scheduled cleanup...');
      
      // Run the cleanup
      const stats = await fileCleanupService.cleanup();
      
      // Record in history
      const duration = Date.now() - startTime;
      this.addToHistory({
        timestamp: new Date(),
        duration: duration,
        stats: stats,
        success: true
      });
      
      console.log(`✅ [CRON] Cleanup completed in ${duration}ms`);
      
      // Log stats if anything was cleaned
      if (stats.tempFilesDeleted > 0 || stats.orphanedFilesDeleted > 0 || stats.logsArchived > 0) {
        console.log(`📊 [CRON] Cleanup stats:`, {
          tempFilesDeleted: stats.tempFilesDeleted,
          orphanedFilesDeleted: stats.orphanedFilesDeleted,
          logsArchived: stats.logsArchived,
          spaceFreed: this.formatBytes(stats.totalSpaceFreed)
        });
      }
      
      return stats;
    } catch (error) {
      console.error('❌ [CRON] Cleanup error:', error);
      
      // Record error in history
      this.addToHistory({
        timestamp: new Date(),
        duration: Date.now() - startTime,
        error: error.message,
        success: false
      });
      
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Add run to history
   */
  addToHistory(run) {
    this.runHistory.unshift(run);
    
    // Limit history size
    if (this.runHistory.length > this.maxHistorySize) {
      this.runHistory = this.runHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      running: this.job !== null,
      schedule: this.schedule,
      isExecuting: this.isRunning,
      lastRun: this.runHistory[0] || null,
      totalRuns: this.runHistory.length,
      successfulRuns: this.runHistory.filter(r => r.success).length,
      failedRuns: this.runHistory.filter(r => !r.success).length
    };
  }

  /**
   * Get run history
   */
  getHistory(limit = 10) {
    return this.runHistory.slice(0, limit);
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Create singleton instance
const cleanupJob = new CleanupCronJob({
  schedule: secureConfigService.get('CLEANUP_SCHEDULE') || '0 * * * *', // Every hour by default
  enabled: secureConfigService.get('CLEANUP_ENABLED') !== 'false' // Enabled by default
});

// Export for use in other modules
module.exports = {
  CleanupCronJob,
  cleanupJob
};

// Auto-start if this is the main module
if (require.main === module) {
  console.log('🚀 Starting cleanup cron job as standalone service...');
  cleanupJob.start();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, stopping cleanup job...');
    cleanupJob.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, stopping cleanup job...');
    cleanupJob.stop();
    process.exit(0);
  });
}