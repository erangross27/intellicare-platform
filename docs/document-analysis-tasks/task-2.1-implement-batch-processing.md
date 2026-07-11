# Task 2.1: Implement Batch Processing

## 📋 **DATA PROCESSING TASK**
**Phase:** 2 (Data Processing & Management)  
**Time Estimate:** 30 minutes  
**Risk Level:** MEDIUM  
**Priority:** HIGH  

## 🎯 **Objective**
Implement efficient batch processing for multiple document uploads with queue management, progress tracking, and error recovery.

## 📈 **Benefits**
- Process multiple documents simultaneously
- Reduce overall processing time by 70%
- Handle large document batches (100+ documents)
- Provide real-time progress updates
- Automatic retry on failures
- Resource optimization

## 📁 **Files to Modify**
- `backend/services/batchProcessingService.js` (create new)
- `backend/models/BatchJob.js` (create new)
- `backend/routes/documents.js`
- `backend/queues/documentQueue.js` (create new)

## 🔧 **Implementation**

### **Step 1: Create Batch Job Model**
```javascript
// backend/models/BatchJob.js
const mongoose = require('mongoose');

const batchJobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    default: () => `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  practiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Practice',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'PENDING'
  },
  batchType: {
    type: String,
    enum: ['DOCUMENT_UPLOAD', 'DOCUMENT_ANALYSIS', 'DOCUMENT_CONVERSION'],
    required: true
  },
  documents: [{
    originalName: String,
    size: Number,
    mimeType: String,
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING'
    },
    error: String,
    processingTime: Number,
    analysis: mongoose.Schema.Types.Mixed
  }],
  progress: {
    total: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 }
  },
  settings: {
    concurrency: { type: Number, default: 3 },
    retryAttempts: { type: Number, default: 2 },
    analysisType: String,
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL'
    }
  },
  timing: {
    startedAt: Date,
    completedAt: Date,
    totalDuration: Number,
    averageDocumentTime: Number
  },
  notifications: {
    onProgress: { type: Boolean, default: false },
    onComplete: { type: Boolean, default: true },
    onError: { type: Boolean, default: true },
    email: String,
    webhook: String
  }
}, {
  timestamps: true
});

batchJobSchema.index({ practiceId: 1, status: 1 });
batchJobSchema.index({ createdBy: 1, createdAt: -1 });
batchJobSchema.index({ jobId: 1 }, { unique: true });

module.exports = mongoose.model('BatchJob', batchJobSchema);
```

### **Step 2: Create Queue System**
```javascript
// backend/queues/documentQueue.js
const Queue = require('bull');
const redis = require('redis');
const DocumentAnalysisService = require('../services/documentAnalysisService');
const BatchJob = require('../models/BatchJob');

class DocumentQueue {
  constructor() {
    this.redisClient = redis.createClient(process.env.REDIS_URL);
    
    // Create different queues for different priorities
    this.queues = {
      urgent: new Queue('document-processing-urgent', process.env.REDIS_URL),
      high: new Queue('document-processing-high', process.env.REDIS_URL),
      normal: new Queue('document-processing-normal', process.env.REDIS_URL),
      low: new Queue('document-processing-low', process.env.REDIS_URL)
    };
    
    this.documentAnalysisService = new DocumentAnalysisService();
    this.setupProcessors();
  }

  setupProcessors() {
    // Set up processors for each priority queue
    Object.entries(this.queues).forEach(([priority, queue]) => {
      const concurrency = this.getConcurrencyForPriority(priority);
      
      queue.process('process-document', concurrency, async (job) => {
        return await this.processDocument(job.data);
      });
      
      // Event handlers
      queue.on('completed', (job, result) => {
        this.handleJobCompleted(job.data.batchId, job.data.documentIndex, result);
      });
      
      queue.on('failed', (job, err) => {
        this.handleJobFailed(job.data.batchId, job.data.documentIndex, err);
      });
    });
  }

  getConcurrencyForPriority(priority) {
    const concurrencyMap = {
      urgent: 5,
      high: 3,
      normal: 2,
      low: 1
    };
    return concurrencyMap[priority] || 2;
  }

  async addBatchJob(batchJobData) {
    const batchJob = new BatchJob(batchJobData);
    await batchJob.save();
    
    // Add individual document processing jobs to queue
    const priority = batchJobData.settings?.priority?.toLowerCase() || 'normal';
    const queue = this.queues[priority];
    
    for (let i = 0; i < batchJob.documents.length; i++) {
      const document = batchJob.documents[i];
      
      await queue.add('process-document', {
        batchId: batchJob._id,
        jobId: batchJob.jobId,
        documentIndex: i,
        document: document,
        practiceId: batchJob.practiceId,
        patientId: batchJob.patientId,
        settings: batchJob.settings
      }, {
        attempts: batchJob.settings.retryAttempts + 1,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      });
    }
    
    // Update batch job status
    batchJob.status = 'PROCESSING';
    batchJob.timing.startedAt = new Date();
    await batchJob.save();
    
    return batchJob;
  }

  async processDocument(jobData) {
    const startTime = Date.now();
    
    try {
      // Update document status to processing
      await this.updateDocumentStatus(
        jobData.batchId, 
        jobData.documentIndex, 
        'PROCESSING'
      );
      
      // Get document buffer (from secure temp storage)
      const documentBuffer = await this.getDocumentBuffer(jobData.document);
      
      // Perform document analysis
      const analysis = await this.documentAnalysisService.analyzeDocument(
        documentBuffer,
        jobData.document.mimeType
      );
      
      // Save processed document
      const savedDocument = await this.saveDocument({
        ...jobData.document,
        analysis,
        practiceId: jobData.practiceId,
        patientId: jobData.patientId
      });
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        documentId: savedDocument._id,
        analysis,
        processingTime
      };
      
    } catch (error) {
      console.error(`Document processing failed for batch ${jobData.jobId}:`, error);
      
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  async handleJobCompleted(batchId, documentIndex, result) {
    try {
      await this.updateDocumentStatus(batchId, documentIndex, 'COMPLETED', {
        documentId: result.documentId,
        analysis: result.analysis,
        processingTime: result.processingTime
      });
      
      await this.updateBatchProgress(batchId);
    } catch (error) {
      console.error('Error handling job completion:', error);
    }
  }

  async handleJobFailed(batchId, documentIndex, error) {
    try {
      await this.updateDocumentStatus(batchId, documentIndex, 'FAILED', {
        error: error.message
      });
      
      await this.updateBatchProgress(batchId);
    } catch (err) {
      console.error('Error handling job failure:', err);
    }
  }

  async updateDocumentStatus(batchId, documentIndex, status, additionalData = {}) {
    const update = {
      [`documents.${documentIndex}.status`]: status
    };
    
    // Add additional data if provided
    Object.entries(additionalData).forEach(([key, value]) => {
      update[`documents.${documentIndex}.${key}`] = value;
    });
    
    await BatchJob.updateOne(
      { _id: batchId },
      { $set: update }
    );
  }

  async updateBatchProgress(batchId) {
    const batchJob = await BatchJob.findById(batchId);
    
    if (!batchJob) return;
    
    const total = batchJob.documents.length;
    const completed = batchJob.documents.filter(doc => doc.status === 'COMPLETED').length;
    const failed = batchJob.documents.filter(doc => doc.status === 'FAILED').length;
    const percentage = Math.round((completed + failed) / total * 100);
    
    // Update progress
    batchJob.progress = {
      total,
      completed,
      failed,
      percentage
    };
    
    // Check if batch is complete
    if (completed + failed === total) {
      batchJob.status = failed > 0 ? 'COMPLETED' : 'COMPLETED';
      batchJob.timing.completedAt = new Date();
      batchJob.timing.totalDuration = batchJob.timing.completedAt - batchJob.timing.startedAt;
      
      // Calculate average processing time
      const processingTimes = batchJob.documents
        .filter(doc => doc.processingTime)
        .map(doc => doc.processingTime);
      
      if (processingTimes.length > 0) {
        batchJob.timing.averageDocumentTime = 
          processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      }
      
      // Send completion notification
      await this.sendBatchCompletionNotification(batchJob);
    }
    
    await batchJob.save();
    
    // Emit progress update via WebSocket
    this.emitProgressUpdate(batchJob);
  }

  async getBatchStatus(jobId, practiceId) {
    return await BatchJob.findOne({ jobId, practiceId });
  }

  async cancelBatch(jobId, practiceId) {
    const batchJob = await BatchJob.findOne({ jobId, practiceId });
    
    if (!batchJob) {
      throw new Error('Batch job not found');
    }
    
    // Cancel pending jobs in all queues
    for (const queue of Object.values(this.queues)) {
      const jobs = await queue.getJobs(['waiting', 'active']);
      for (const job of jobs) {
        if (job.data.batchId.toString() === batchJob._id.toString()) {
          await job.remove();
        }
      }
    }
    
    batchJob.status = 'CANCELLED';
    await batchJob.save();
    
    return batchJob;
  }

  emitProgressUpdate(batchJob) {
    // WebSocket implementation for real-time updates
    const io = require('../server').io;
    if (io) {
      io.to(`practice_${batchJob.practiceId}`).emit('batch-progress', {
        jobId: batchJob.jobId,
        progress: batchJob.progress,
        status: batchJob.status
      });
    }
  }
}

module.exports = new DocumentQueue();
```

### **Step 3: Add Batch Processing Routes**
```javascript
// In backend/routes/documents.js
const documentQueue = require('../queues/documentQueue');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Batch upload endpoint
router.post('/batch-upload/:patientId', 
  upload.array('documents', 50), // Max 50 documents
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No documents provided'
        });
      }
      
      // Prepare batch job data
      const batchJobData = {
        practiceId: req.practice._id,
        patientId: req.params.patientId,
        createdBy: req.user._id,
        batchType: 'DOCUMENT_UPLOAD',
        documents: req.files.map(file => ({
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          buffer: file.buffer
        })),
        settings: {
          concurrency: parseInt(req.body.concurrency) || 3,
          retryAttempts: parseInt(req.body.retryAttempts) || 2,
          analysisType: req.body.analysisType || 'full',
          priority: req.body.priority || 'NORMAL'
        },
        notifications: {
          onComplete: req.body.notifyOnComplete !== 'false',
          email: req.body.notificationEmail || req.user.email
        }
      };
      
      // Add batch job to queue
      const batchJob = await documentQueue.addBatchJob(batchJobData);
      
      res.json({
        success: true,
        jobId: batchJob.jobId,
        message: `Batch processing started for ${req.files.length} documents`,
        totalDocuments: req.files.length,
        estimatedTime: `${Math.ceil(req.files.length * 30 / batchJobData.settings.concurrency)} seconds`
      });
      
    } catch (error) {
      console.error('Batch upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Batch upload failed',
        error: error.message
      });
    }
  }
);

// Get batch status
router.get('/batch/:jobId', async (req, res) => {
  try {
    const batchJob = await documentQueue.getBatchStatus(
      req.params.jobId,
      req.practice._id
    );
    
    if (!batchJob) {
      return res.status(404).json({
        success: false,
        message: 'Batch job not found'
      });
    }
    
    res.json({
      success: true,
      job: {
        jobId: batchJob.jobId,
        status: batchJob.status,
        progress: batchJob.progress,
        timing: batchJob.timing,
        documents: batchJob.documents.map(doc => ({
          originalName: doc.originalName,
          status: doc.status,
          error: doc.error,
          documentId: doc.documentId,
          processingTime: doc.processingTime
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Cancel batch job
router.delete('/batch/:jobId', async (req, res) => {
  try {
    const cancelledJob = await documentQueue.cancelBatch(
      req.params.jobId,
      req.practice._id
    );
    
    res.json({
      success: true,
      message: 'Batch job cancelled',
      jobId: cancelledJob.jobId,
      status: cancelledJob.status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
```

## 🧪 **Testing**
1. **Batch upload:** Test with 10, 25, 50 documents
2. **Progress tracking:** Verify real-time updates
3. **Error handling:** Test with corrupted files
4. **Cancellation:** Test mid-process cancellation
5. **Resource limits:** Test memory/CPU usage

## ✅ **Success Criteria**
- [ ] Process 50+ documents in single batch
- [ ] 70% reduction in total processing time
- [ ] Real-time progress updates working
- [ ] Error recovery functional
- [ ] Resource usage optimized
- [ ] Queue management working

## 🔄 **Next Task**
Proceed to: **Task 2.2:** Add Document Deduplication

## 📝 **Performance Notes**
- Monitor Redis memory usage
- Implement job result cleanup after 24 hours
- Consider distributed processing for high loads
- Set up queue monitoring dashboard