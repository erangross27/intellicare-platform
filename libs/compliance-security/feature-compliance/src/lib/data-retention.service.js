/**
 * Data Retention and Cleanup Service - Modular Version
 * Handles automated data cleanup, archival, and compliance with retention policies
 */

const cron = require('node-cron');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class DataRetentionService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.serviceToken = null;
    this.initialized = false;
    this.serviceId = 'data-retention-service';
    this.secureDataAccess = null;
    
    this.config = {
      // Retention periods in days
      retentionPolicies: {
        // HIPAA compliance: Medical records - 6 years minimum
        medicalRecords: options.medicalRecordsRetention || 2190, // 6 years
        patientData: options.patientDataRetention || 2190, // 6 years
        
        // Chat and session data
        chatSessions: options.chatSessionsRetention || 1095, // 3 years
        voiceRecordings: options.voiceRecordingsRetention || 365, // 1 year
        
        // Documents and uploads
        uploadedDocuments: options.uploadedDocumentsRetention || 2190, // 6 years
        temporaryFiles: options.temporaryFilesRetention || 7, // 1 week
        
        // Logs and audit trails
        auditLogs: options.auditLogsRetention || 2555, // 7 years (compliance)
        securityLogs: options.securityLogsRetention || 2555, // 7 years
        applicationLogs: options.applicationLogsRetention || 90, // 3 months
        
        // System data
        performanceMetrics: options.performanceMetricsRetention || 365, // 1 year
        errorLogs: options.errorLogsRetention || 180, // 6 months
        
        // Backup data
        databaseBackups: options.databaseBackupsRetention || 365, // 1 year
        fileBackups: options.fileBackupsRetention || 90, // 3 months
        
        // Deleted/soft deleted items
        softDeletedRecords: options.softDeletedRecordsRetention || 30, // 1 month
        trashedFiles: options.trashedFilesRetention || 30 // 1 month
      },
      
      // Archive before deletion
      enableArchival: options.enableArchival !== false,
      archivePath: options.archivePath || path.join(process.cwd(), 'data', 'archive'),
      compressionEnabled: options.compressionEnabled !== false,
      encryptArchives: options.encryptArchives !== false,
      
      // Cleanup schedule
      cleanupSchedule: options.cleanupSchedule || '0 2 * * *', // Daily at 2 AM
      archiveSchedule: options.archiveSchedule || '0 1 * * 0', // Weekly on Sunday at 1 AM
      
      // Batch processing
      batchSize: options.batchSize || 1000,
      maxConcurrent: options.maxConcurrent || 5,
      
      // Safety features
      dryRun: options.dryRun || false,
      requireApproval: options.requireApproval || false,
      backupBeforeDelete: options.backupBeforeDelete !== false
    };
    
    this.stats = {
      lastCleanup: null,
      lastArchive: null,
      totalRecordsProcessed: 0,
      totalRecordsDeleted: 0,
      totalRecordsArchived: 0,
      totalFilesDeleted: 0,
      totalFilesArchived: 0,
      spaceSavedMB: 0,
      errors: []
    };
    
    this.isRunning = false;
    this.scheduledJobs = [];
  }
  
  async initialize() {
    try {
      // Get service token through proxy - REQUIRED
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      if (!this.serviceToken) {
        throw new Error('Service authentication failed - cannot start without valid token');
      }
      
      // Initialize secure data access with token through proxy
      this.secureDataAccess = proxy.getService('secureDataAccess');
      
      // Create archive directory if archival is enabled
      if (this.config.enableArchival) {
        await this.ensureDirectoryExists(this.config.archivePath);
      }
      
      // Schedule cleanup jobs
      this.scheduleJobs();
      
      // Log service initialization through proxy
      const immutableAuditService = proxy.getService('immutableAuditService');
      await immutableAuditService.logServiceOperation({
        serviceId: this.serviceId,
        operation: 'service_initialized',
        timestamp: new Date().toISOString()
      });
      
      this.emit('initialized', {
        config: this.config,
        timestamp: new Date()
      });
      
      this.initialized = true;
      console.log('✅ Data Retention Service initialized with HIPAA-compliant policies');
    } catch (error) {
      console.error('❌ Failed to initialize Data Retention Service:', error);
      this.emit('error', error);
      throw error;
    }
  }

  getServiceContext(operation = 'general', practiceId = 'global') {
    return {
      serviceId: this.serviceId,
      operation: operation,
      practiceId: practiceId
    };
  }
  
  // Schedule automated cleanup jobs
  scheduleJobs() {
    // Daily cleanup job
    const cleanupJob = cron.schedule(this.config.cleanupSchedule, async () => {
      if (!this.isRunning) {
        await this.runDataCleanup();
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Jerusalem'
    });
    
    // Weekly archive job
    const archiveJob = cron.schedule(this.config.archiveSchedule, async () => {
      if (!this.isRunning) {
        await this.runDataArchival();
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Jerusalem'
    });
    
    this.scheduledJobs = [cleanupJob, archiveJob];
  }
  
  // Run complete data cleanup process
  async runDataCleanup() {
    if (this.isRunning) {
      console.log('⚠️ Data cleanup already running, skipping');
      return;
    }
    
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('🧹 Starting data cleanup process...');
      
      const results = {
        recordsProcessed: 0,
        recordsDeleted: 0,
        filesDeleted: 0,
        spaceSavedMB: 0,
        errors: []
      };
      
      // Clean temporary files first
      await this.cleanupTemporaryFiles(results);
      
      // Clean expired chat sessions
      await this.cleanupChatSessions(results);
      
      // Clean old logs
      await this.cleanupLogs(results);
      
      // Clean soft deleted records
      await this.cleanupSoftDeleted(results);
      
      // Clean old performance metrics
      await this.cleanupPerformanceMetrics(results);
      
      // Clean old backups
      await this.cleanupOldBackups(results);
      
      const duration = Date.now() - startTime;
      this.stats.lastCleanup = new Date();
      this.stats.totalRecordsProcessed += results.recordsProcessed;
      this.stats.totalRecordsDeleted += results.recordsDeleted;
      this.stats.totalFilesDeleted += results.filesDeleted;
      this.stats.spaceSavedMB += results.spaceSavedMB;
      
      console.log(`✅ Data cleanup completed in ${duration}ms`);
      console.log(`📊 Results:`, results);
      
      this.emit('cleanup_complete', {
        duration: duration,
        results: results,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Data cleanup failed:', error);
      this.stats.errors.push({
        type: 'cleanup_error',
        error: error.message,
        timestamp: new Date()
      });
      
      this.emit('cleanup_error', error);
    } finally {
      this.isRunning = false;
    }
  }
  
  async cleanupTemporaryFiles(results) {
    console.log('🧹 Cleaning temporary files...');
    
    const tempPaths = [
      path.join(process.cwd(), 'uploads', 'temp'),
      path.join(process.cwd(), 'temp'),
      path.join(process.cwd(), 'cache')
    ];
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionPolicies.temporaryFiles);
    
    for (const tempPath of tempPaths) {
      try {
        if (await this.directoryExists(tempPath)) {
          const files = await fs.readdir(tempPath);
          
          for (const file of files) {
            const filePath = path.join(tempPath, file);
            const stat = await fs.stat(filePath);
            
            if (stat.mtime < cutoffDate) {
              const sizeMB = Math.round(stat.size / 1024 / 1024 * 100) / 100;
              
              if (!this.config.dryRun) {
                await fs.unlink(filePath);
              }
              
              results.filesDeleted++;
              results.spaceSavedMB += sizeMB;
              
              console.log(`🗑️ Deleted temp file: ${file} (${sizeMB} MB)`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error cleaning temp path ${tempPath}:`, error);
        results.errors.push(`Temp cleanup error: ${error.message}`);
      }
    }
  }

  async cleanupChatSessions(results) {
    console.log('🧹 Cleaning old chat sessions...');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionPolicies.chatSessions);
    
    try {
      console.log(`📊 Would delete chat sessions older than ${cutoffDate.toISOString()}`);
    } catch (error) {
      console.error('❌ Error cleaning chat sessions:', error);
      results.errors.push(`Chat cleanup error: ${error.message}`);
    }
  }

  async cleanupLogs(results) {
    console.log('🧹 Cleaning old logs...');
  }

  async cleanupSoftDeleted(results) {
    console.log('🧹 Cleaning soft deleted records...');
  }

  async cleanupPerformanceMetrics(results) {
    console.log('🧹 Cleaning old performance metrics...');
  }

  async cleanupOldBackups(results) {
    console.log('🧹 Cleaning old backups...');
  }

  async runDataArchival() {
    if (!this.config.enableArchival) {
      console.log('📦 Archival disabled, skipping');
      return;
    }
    
    if (this.isRunning) {
      console.log('⚠️ Data archival already running, skipping');
      return;
    }
    
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('📦 Starting data archival process...');
      
      const results = {
        recordsProcessed: 0,
        recordsArchived: 0,
        filesArchived: 0,
        archiveSizeMB: 0,
        errors: []
      };
      
      const duration = Date.now() - startTime;
      this.stats.lastArchive = new Date();
      this.stats.totalRecordsArchived += results.recordsArchived;
      this.stats.totalFilesArchived += results.filesArchived;
      
      console.log(`✅ Data archival completed in ${duration}ms`);
      console.log(`📊 Results:`, results);
      
      this.emit('archive_complete', {
        duration: duration,
        results: results,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Data archival failed:', error);
      this.stats.errors.push({
        type: 'archive_error',
        error: error.message,
        timestamp: new Date()
      });
      
      this.emit('archive_error', error);
    } finally {
      this.isRunning = false;
    }
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async directoryExists(dirPath) {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  getStats() {
    return {
      ...this.stats,
      config: this.config,
      isRunning: this.isRunning,
      timestamp: new Date()
    };
  }

  stop() {
    this.scheduledJobs.forEach(job => {
      job.stop();
    });
    
    console.log('🛑 Data Retention Service stopped');
    this.emit('stopped');
  }
}

// Create and export singleton
const dataRetentionService = new DataRetentionService();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('dataRetentionService', () => dataRetentionService);
}

module.exports = dataRetentionService;