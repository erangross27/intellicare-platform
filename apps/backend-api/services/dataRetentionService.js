/**
 * 🔐 This service requires authentication
 * Service ID: data-retention-service
 * Required permissions: See /config/securityManifests/data-retention-service.manifest.json
 *
 * SECURITY WARNING: This service uses SecureDataAccess for all database operations.
 * Direct database access is PROHIBITED.
 */

// Data Retention and Cleanup Service for IntelliCare
// Handles automated data cleanup, archival, and compliance with retention policies

const cron = require('node-cron');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const immutableAuditService = require('./immutableAuditService');
const secureConfigService = require('../services/secureConfigService');

class DataRetentionService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.serviceId = 'data-retention-service';
    this.serviceToken = null;
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
    
    // Constructor should not call async methods - initialize() must be called manually
  }
  
  async initialize() {
    try {
      // Get service token - REQUIRED
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      if (!this.serviceToken) {
        throw new Error('Service authentication failed - cannot start without valid token');
      }
      
      // Initialize secure data access with token (SecureDataAccess is a singleton)
      this.secureDataAccess = SecureDataAccess;
      
      // Create archive directory if archival is enabled
      if (this.config.enableArchival) {
        await this.ensureDirectoryExists(this.config.archivePath);
      }
      
      // Schedule cleanup jobs
      this.scheduleJobs();
      
      // Data Retention Service initialized with HIPAA-compliant policies
      
      // Log service initialization
      await immutableAuditService.logServiceOperation({
        serviceId: this.serviceId,
        operation: 'service_initialized',
        timestamp: new Date().toISOString()
      });
      
      this.emit('initialized', {
        config: this.config,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Data Retention Service:', error);
      this.emit('error', error);
    }
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
    
    // Scheduled cleanup and archive jobs configured
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
  
  // Run data archival process
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
      
      // Archive old medical records (keep active, archive old versions)
      await this.archiveOldMedicalRecords(results);
      
      // Archive old chat sessions
      await this.archiveOldChatSessions(results);
      
      // Archive old documents
      await this.archiveOldDocuments(results);
      
      // Archive old audit logs
      await this.archiveOldAuditLogs(results);
      
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
  
  // Clean up temporary files
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
  
  // Clean up old chat sessions
  async cleanupChatSessions(results) {
    console.log('🧹 Cleaning old chat sessions...');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionPolicies.chatSessions);
    
    try {
      // This would need to be implemented with actual database models
      // For now, we'll simulate the process
      console.log(`📊 Would delete chat sessions older than ${cutoffDate.toISOString()}`);
      
      // Example implementation:
      // const oldSessions = await SecureDataAccess.query('chatsessions', { createdAt: { $lt: cutoffDate } }, {}, context);
      // for (const session of oldSessions) {
      //   if (!this.config.dryRun) {
      //     await session.deleteOne();
      //   }
      //   results.recordsDeleted++;
      // }
      
    } catch (error) {
      console.error('❌ Error cleaning chat sessions:', error);
      results.errors.push(`Chat cleanup error: ${error.message}`);
    }
  }
  
  // Clean up old logs
  async cleanupLogs(results) {
    console.log('🧹 Cleaning old logs...');
    
    const logTypes = [
      { path: 'logs/application.log', retention: this.config.retentionPolicies.applicationLogs },
      { path: 'logs/error.log', retention: this.config.retentionPolicies.errorLogs },
      { path: 'logs/security.log', retention: this.config.retentionPolicies.securityLogs }
    ];
    
    for (const logType of logTypes) {
      try {
        const logPath = path.join(process.cwd(), logType.path);
        
        if (await this.fileExists(logPath)) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - logType.retention);
          
          // For rotating logs, we would clean old rotated files
          // This is a simplified implementation
          console.log(`📊 Would clean ${logType.path} entries older than ${cutoffDate.toISOString()}`);
        }
        
      } catch (error) {
        console.error(`❌ Error cleaning log ${logType.path}:`, error);
        results.errors.push(`Log cleanup error: ${error.message}`);
      }
    }
  }
  
  // Clean up soft deleted records
  async cleanupSoftDeleted(results) {
    console.log('🧹 Cleaning soft deleted records...');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionPolicies.softDeletedRecords);
    
    try {
      // Example implementation for different models
      console.log(`📊 Would permanently delete soft-deleted records older than ${cutoffDate.toISOString()}`);
      
      // Example:
      // const softDeleted = await SecureDataAccess.query('patients', { deletedAt: { $lt: cutoffDate, $ne: null } }, {}, context);
      // for (const record of softDeleted) {
      //   if (!this.config.dryRun) {
      //     await record.remove(); // Permanent deletion
      //   }
      //   results.recordsDeleted++;
      // }
      
    } catch (error) {
      console.error('❌ Error cleaning soft deleted records:', error);
      results.errors.push(`Soft delete cleanup error: ${error.message}`);
    }
  }
  
  // Clean up old performance metrics
  async cleanupPerformanceMetrics(results) {
    console.log('🧹 Cleaning old performance metrics...');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionPolicies.performanceMetrics);
    
    try {
      // Clean up metrics stored in global.metrics if they have historical data
      if (global.metrics && global.metrics.metrics) {
        console.log(`📊 Would clean performance metrics older than ${cutoffDate.toISOString()}`);
        // Implementation would depend on how metrics are stored
      }
      
    } catch (error) {
      console.error('❌ Error cleaning performance metrics:', error);
      results.errors.push(`Metrics cleanup error: ${error.message}`);
    }
  }
  
  // Clean up old backups
  async cleanupOldBackups(results) {
    console.log('🧹 Cleaning old backups...');
    
    const backupTypes = [
      { path: 'backups/database', retention: this.config.retentionPolicies.databaseBackups },
      { path: 'backups/files', retention: this.config.retentionPolicies.fileBackups }
    ];
    
    for (const backupType of backupTypes) {
      try {
        const backupPath = path.join(process.cwd(), backupType.path);
        
        if (await this.directoryExists(backupPath)) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - backupType.retention);
          
          const files = await fs.readdir(backupPath);
          
          for (const file of files) {
            const filePath = path.join(backupPath, file);
            const stat = await fs.stat(filePath);
            
            if (stat.mtime < cutoffDate) {
              const sizeMB = Math.round(stat.size / 1024 / 1024 * 100) / 100;
              
              if (!this.config.dryRun) {
                await fs.unlink(filePath);
              }
              
              results.filesDeleted++;
              results.spaceSavedMB += sizeMB;
              
              console.log(`🗑️ Deleted old backup: ${file} (${sizeMB} MB)`);
            }
          }
        }
        
      } catch (error) {
        console.error(`❌ Error cleaning backups ${backupType.path}:`, error);
        results.errors.push(`Backup cleanup error: ${error.message}`);
      }
    }
  }
  
  // Archive old medical records
  async archiveOldMedicalRecords(results) {
    console.log('📦 Archiving old medical records...');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (this.config.retentionPolicies.medicalRecords - 365)); // Archive 1 year before deletion
    
    try {
      console.log(`📊 Would archive medical records older than ${cutoffDate.toISOString()}`);
      
      // Example implementation:
      // const oldRecords = await SecureDataAccess.query('medicalhistorys', { updatedAt: { $lt: cutoffDate } }, {}, context);
      // const archiveData = {
      //   type: 'medical_records',
      //   date: new Date(),
      //   records: oldRecords
      // };
      // 
      // const archiveFile = await this.createArchiveFile('medical_records', archiveData);
      // results.filesArchived++;
      // results.recordsArchived += oldRecords.length;
      
    } catch (error) {
      console.error('❌ Error archiving medical records:', error);
      results.errors.push(`Medical records archive error: ${error.message}`);
    }
  }
  
  // Archive old chat sessions
  async archiveOldChatSessions(results) {
    console.log('📦 Archiving old chat sessions...');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (this.config.retentionPolicies.chatSessions - 90)); // Archive 3 months before deletion
    
    try {
      console.log(`📊 Would archive chat sessions older than ${cutoffDate.toISOString()}`);
      // Implementation similar to medical records
    } catch (error) {
      console.error('❌ Error archiving chat sessions:', error);
      results.errors.push(`Chat sessions archive error: ${error.message}`);
    }
  }
  
  // Archive old documents
  async archiveOldDocuments(results) {
    console.log('📦 Archiving old documents...');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (this.config.retentionPolicies.uploadedDocuments - 365));
    
    try {
      console.log(`📊 Would archive documents older than ${cutoffDate.toISOString()}`);
      // Implementation for document archival
    } catch (error) {
      console.error('❌ Error archiving documents:', error);
      results.errors.push(`Documents archive error: ${error.message}`);
    }
  }
  
  // Archive old audit logs
  async archiveOldAuditLogs(results) {
    console.log('📦 Archiving old audit logs...');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (this.config.retentionPolicies.auditLogs - 90));
    
    try {
      console.log(`📊 Would archive audit logs older than ${cutoffDate.toISOString()}`);
      // Implementation for audit log archival
    } catch (error) {
      console.error('❌ Error archiving audit logs:', error);
      results.errors.push(`Audit logs archive error: ${error.message}`);
    }
  }
  
  // Create archive file
  async createArchiveFile(type, data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${type}_${timestamp}.json`;
    
    if (this.config.encryptArchives) {
      // Encrypt the data
      const encrypted = this.encryptData(JSON.stringify(data));
      filename = filename.replace('.json', '.enc');
      data = encrypted;
    } else {
      data = JSON.stringify(data, null, 2);
    }
    
    const archivePath = path.join(this.config.archivePath, filename);
    await fs.writeFile(archivePath, data);
    
    console.log(`📦 Created archive: ${filename}`);
    return archivePath;
  }
  
  // Encrypt data for archives
  encryptData(data) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(secureConfigService.get('ARCHIVE_ENCRYPTION_KEY') || 'intellicare-archive-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    cipher.setAAD(Buffer.from('intellicare-archive'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  // Get retention status for specific data type
  getRetentionStatus(dataType) {
    const retention = this.config.retentionPolicies[dataType];
    if (!retention) {
      return null;
    }
    
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (retention * 24 * 60 * 60 * 1000));
    
    return {
      dataType: dataType,
      retentionDays: retention,
      cutoffDate: cutoffDate,
      deleteAfter: cutoffDate.toISOString()
    };
  }
  
  // Get current statistics
  getStats() {
    return {
      ...this.stats,
      config: this.config,
      isRunning: this.isRunning,
      nextScheduledCleanup: this.getNextScheduledRun(this.config.cleanupSchedule),
      nextScheduledArchive: this.getNextScheduledRun(this.config.archiveSchedule),
      timestamp: new Date()
    };
  }
  
  // Get next scheduled run time
  getNextScheduledRun(cronExpression) {
    // This would need a proper cron parser
    // For now, return a placeholder
    return new Date(Date.now() + 24 * 60 * 60 * 1000); // Next day
  }
  
  // Manual cleanup trigger
  async manualCleanup(options = {}) {
    if (options.dryRun !== undefined) {
      const originalDryRun = this.config.dryRun;
      this.config.dryRun = options.dryRun;
      
      try {
        await this.runDataCleanup();
      } finally {
        this.config.dryRun = originalDryRun;
      }
    } else {
      await this.runDataCleanup();
    }
  }
  
  // Manual archive trigger
  async manualArchive(options = {}) {
    if (options.dryRun !== undefined) {
      const originalDryRun = this.config.dryRun;
      this.config.dryRun = options.dryRun;
      
      try {
        await this.runDataArchival();
      } finally {
        this.config.dryRun = originalDryRun;
      }
    } else {
      await this.runDataArchival();
    }
  }
  
  // Stop scheduled jobs
  stop() {
    this.scheduledJobs.forEach(job => {
      job.stop();
    });
    
    console.log('🛑 Data Retention Service stopped');
    this.emit('stopped');
  }
  
  // Utility methods
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
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
  
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

// Create and export singleton instance
const dataRetentionService = new DataRetentionService({
  // Default configuration - can be overridden via environment variables
  dryRun: secureConfigService.get('DATA_RETENTION_DRY_RUN') === 'true',
  enableArchival: secureConfigService.get('DATA_RETENTION_ENABLE_ARCHIVAL') !== 'false',
  cleanupSchedule: secureConfigService.get('DATA_RETENTION_CLEANUP_SCHEDULE') || '0 2 * * *',
  archiveSchedule: secureConfigService.get('DATA_RETENTION_ARCHIVE_SCHEDULE') || '0 1 * * 0'
});

module.exports = {
  DataRetentionService,
  dataRetentionService
};