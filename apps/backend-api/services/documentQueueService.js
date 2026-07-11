/**
 * Document Queue Service
 * 
 * Manages document processing queues for multiple concurrent users.
 * Ensures fair processing and prevents system overload in hospital/practice environments.
 */

const crypto = require('crypto');
const EventEmitter = require('events');
const serviceAccountManager = require('./serviceAccountManager');
const serviceProxyManager = require('./serviceProxyManager');

class DocumentQueueService extends EventEmitter {
  constructor() {
    super();
    this.serviceId = 'document-queue-service';
    this.serviceToken = null;
    this.initialized = false;
    
    // Queue management
    this.queues = new Map(); // practiceId -> queue array
    this.processing = new Map(); // jobId -> job details
    this.userJobs = new Map(); // userId -> current job IDs
    
    // Configuration
    this.maxConcurrentPerClinic = 3; // Max concurrent jobs per practice
    this.maxConcurrentPerUser = 1; // Max concurrent jobs per user
    this.microBatchSize = 3; // Files per micro-batch (confirmed working by user)
    
    // Statistics
    this.stats = {
      totalQueued: 0,
      totalProcessed: 0,
      totalFailed: 0,
      averageProcessingTime: 0
    };
  }
  
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      this.initialized = true;
      console.log('✅ DocumentQueueService initialized');
      
      // Start queue processor
      this.startQueueProcessor();
      
    } catch (error) {
      console.error('Failed to initialize DocumentQueueService:', error);
      throw error;
    }
  }
  
  /**
   * Add documents to processing queue
   * @param {Array} documents - Documents to process
   * @param {String} userId - User ID
   * @param {String} practiceId - Practice ID
   * @param {Object} options - Processing options
   * @returns {String} Job ID
   */
  async addToQueue(documents, userId, practiceId, options = {}) {
    await this.initialize();
    
    const jobId = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date();
    
    // Create job object
    const job = {
      jobId,
      userId,
      practiceId,
      documents,
      documentCount: documents.length,
      microBatchCount: Math.ceil(documents.length / this.microBatchSize),
      status: 'queued',
      progress: 0,
      createdAt: timestamp,
      startedAt: null,
      completedAt: null,
      results: null,
      error: null,
      options
    };
    
    // Get or create practice queue
    if (!this.queues.has(practiceId)) {
      this.queues.set(practiceId, []);
    }
    
    // Add to practice queue
    const queue = this.queues.get(practiceId);
    queue.push(job);
    
    // Track user job
    if (!this.userJobs.has(userId)) {
      this.userJobs.set(userId, new Set());
    }
    this.userJobs.get(userId).add(jobId);
    
    // Update stats
    this.stats.totalQueued++;
    
    console.log(`📥 Added job ${jobId} to queue: ${documents.length} documents for user ${userId} at practice ${practiceId}`);
    
    // Emit event
    this.emit('job-queued', {
      jobId,
      userId,
      practiceId,
      documentCount: documents.length,
      queuePosition: queue.length
    });
    
    // Trigger processing
    this.processNextInQueue(practiceId);
    
    return jobId;
  }
  
  /**
   * Process next job in practice queue
   * @private
   */
  async processNextInQueue(practiceId) {
    // Check if we can process more jobs for this practice
    const clinicProcessing = Array.from(this.processing.values())
      .filter(job => job.practiceId === practiceId && job.status === 'processing');
    
    if (clinicProcessing.length >= this.maxConcurrentPerClinic) {
      console.log(`⏸️ Practice ${practiceId} at max capacity (${clinicProcessing.length}/${this.maxConcurrentPerClinic})`);
      return;
    }
    
    // Get practice queue
    const queue = this.queues.get(practiceId);
    if (!queue || queue.length === 0) {
      return;
    }
    
    // Find next eligible job (user not already processing)
    let nextJob = null;
    for (const job of queue) {
      if (job.status === 'queued') {
        // Check if user already has a processing job
        const userProcessing = Array.from(this.processing.values())
          .filter(j => j.userId === job.userId && j.status === 'processing');
        
        if (userProcessing.length < this.maxConcurrentPerUser) {
          nextJob = job;
          break;
        }
      }
    }
    
    if (!nextJob) {
      console.log(`⏸️ No eligible jobs in queue for practice ${practiceId}`);
      return;
    }
    
    // Start processing
    await this.processJob(nextJob);
  }
  
  /**
   * Process a single job
   * @private
   */
  async processJob(job) {
    try {
      // Update job status
      job.status = 'processing';
      job.startedAt = new Date();
      this.processing.set(job.jobId, job);
      
      console.log(`🚀 Starting job ${job.jobId}: ${job.documentCount} documents`);
      
      // Emit start event
      this.emit('job-started', {
        jobId: job.jobId,
        userId: job.userId,
        practiceId: job.practiceId,
        documentCount: job.documentCount
      });
      
      // Get document analysis service for inline processing
      const documentAnalysisService = serviceProxyManager.get('documentAnalysisService');
      
      // Process documents inline in batches of 3
      const BATCH_SIZE = 3;
      const allResults = [];
      let successfulCount = 0;
      let failedCount = 0;
      let processedCount = 0;
      
      // Process in batches
      for (let i = 0; i < job.documents.length; i += BATCH_SIZE) {
        const batch = job.documents.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (doc) => {
          try {
            const analysis = await documentAnalysisService.analyzeDocument(
              doc.content,
              doc.originalName,
              doc.mimeType || 'application/pdf',
              'en'
            );
            
            processedCount++;
            const progress = Math.round((processedCount / job.documents.length) * 100);
            job.progress = progress;
            
            // Emit progress event
            this.emit('job-progress', {
              jobId: job.jobId,
              userId: job.userId,
              practiceId: job.practiceId,
              progress: progress,
              message: `Processing document ${processedCount} of ${job.documents.length}`,
              processed: processedCount,
              total: job.documents.length
            });
            
            if (analysis.success) {
              successfulCount++;
              return {
                success: true,
                originalName: doc.originalName,
                analysis: analysis
              };
            } else {
              failedCount++;
              return {
                success: false,
                originalName: doc.originalName,
                error: analysis.error
              };
            }
          } catch (error) {
            failedCount++;
            processedCount++;
            return {
              success: false,
              originalName: doc.originalName,
              error: error.message
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);
        
        // Add delay between batches
        if (i + BATCH_SIZE < job.documents.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Format results to match expected structure
      const results = {
        successful: successfulCount,
        failed: failedCount,
        documents: allResults,
        totalDocuments: job.documents.length
      };
      
      // Update job with results
      job.status = 'completed';
      job.completedAt = new Date();
      job.results = results;
      job.progress = 100;
      
      // Calculate processing time
      const processingTime = job.completedAt - job.startedAt;
      this.updateStats(processingTime, true);
      
      console.log(`✅ Completed job ${job.jobId}: ${results.successful}/${job.documentCount} successful in ${processingTime}ms`);
      
      // Emit completion event
      this.emit('job-completed', {
        jobId: job.jobId,
        userId: job.userId,
        practiceId: job.practiceId,
        results: {
          successful: results.successful,
          failed: results.failed,
          duration: processingTime
        }
      });
      
      // Clean up
      this.cleanupJob(job);
      
    } catch (error) {
      console.error(`❌ Job ${job.jobId} failed:`, error);
      
      // Update job status
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = error.message;
      
      // Update stats
      this.updateStats(0, false);
      
      // Emit failure event
      this.emit('job-failed', {
        jobId: job.jobId,
        userId: job.userId,
        practiceId: job.practiceId,
        error: error.message
      });
      
      // Clean up
      this.cleanupJob(job);
    }
    
    // Process next job in queue
    this.processNextInQueue(job.practiceId);
  }
  
  /**
   * Clean up completed/failed job
   * @private
   */
  cleanupJob(job) {
    // Remove from processing map
    this.processing.delete(job.jobId);
    
    // Remove from user jobs
    const userJobs = this.userJobs.get(job.userId);
    if (userJobs) {
      userJobs.delete(job.jobId);
      if (userJobs.size === 0) {
        this.userJobs.delete(job.userId);
      }
    }
    
    // Remove from queue
    const queue = this.queues.get(job.practiceId);
    if (queue) {
      const index = queue.findIndex(j => j.jobId === job.jobId);
      if (index >= 0) {
        queue.splice(index, 1);
      }
      
      // Clean up empty queue
      if (queue.length === 0) {
        this.queues.delete(job.practiceId);
      }
    }
  }
  
  /**
   * Update statistics
   * @private
   */
  updateStats(processingTime, success) {
    if (success) {
      this.stats.totalProcessed++;
      
      // Update average processing time
      const total = this.stats.totalProcessed;
      const currentAvg = this.stats.averageProcessingTime;
      this.stats.averageProcessingTime = ((currentAvg * (total - 1)) + processingTime) / total;
    } else {
      this.stats.totalFailed++;
    }
  }
  
  /**
   * Start queue processor
   * @private
   */
  startQueueProcessor() {
    // Process queues every 2 seconds
    setInterval(() => {
      for (const practiceId of this.queues.keys()) {
        this.processNextInQueue(practiceId);
      }
    }, 2000);
  }
  
  /**
   * Get job status
   * @param {String} jobId - Job ID
   * @returns {Object} Job status
   */
  getJobStatus(jobId) {
    // Check processing jobs
    const processingJob = this.processing.get(jobId);
    if (processingJob) {
      return {
        status: processingJob.status,
        progress: processingJob.progress,
        documentCount: processingJob.documentCount,
        startedAt: processingJob.startedAt,
        error: processingJob.error
      };
    }
    
    // Check queued jobs
    for (const queue of this.queues.values()) {
      const queuedJob = queue.find(j => j.jobId === jobId);
      if (queuedJob) {
        const position = queue.indexOf(queuedJob) + 1;
        return {
          status: 'queued',
          queuePosition: position,
          documentCount: queuedJob.documentCount,
          createdAt: queuedJob.createdAt
        };
      }
    }
    
    return null;
  }
  
  /**
   * Get queue statistics
   * @returns {Object} Queue statistics
   */
  getStatistics() {
    const practiceStats = {};
    
    // Calculate per-practice stats
    for (const [practiceId, queue] of this.queues.entries()) {
      const processing = Array.from(this.processing.values())
        .filter(job => job.practiceId === practiceId && job.status === 'processing');
      
      practiceStats[practiceId] = {
        queued: queue.filter(j => j.status === 'queued').length,
        processing: processing.length,
        totalDocuments: queue.reduce((sum, job) => sum + job.documentCount, 0)
      };
    }
    
    return {
      global: this.stats,
      practices: practiceStats,
      activeUsers: this.userJobs.size,
      totalQueued: Array.from(this.queues.values()).reduce((sum, queue) => sum + queue.length, 0),
      totalProcessing: this.processing.size
    };
  }
}

// Create singleton instance
const documentQueueService = new DocumentQueueService();

// Register with service proxy manager
serviceProxyManager.register('documentQueueService', () => documentQueueService);

// Export singleton instance
module.exports = documentQueueService;