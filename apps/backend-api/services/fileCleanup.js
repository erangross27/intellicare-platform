/**
 * 🔐 This service requires authentication
 * Service ID: file-cleanup-service
 * Required permissions: See /config/securityManifests/file-cleanup-service.manifest.json
 *
 * SECURITY WARNING: This service uses SecureDataAccess for all database operations.
 * Direct database access is PROHIBITED.
 */

// File Cleanup Service
// Handles automatic cleanup of temporary files, orphaned uploads, and old logs

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const immutableAuditService = require('./immutableAuditService');

class FileCleanupService {
  constructor(options = {}) {
    this.serviceId = 'file-cleanup-service';
    this.serviceToken = null;
    this.secureDataAccess = null;
    this.tempDir = options.tempDir || path.join(process.cwd(), 'uploads', 'temp');
    this.uploadsDir = options.uploadsDir || path.join(process.cwd(), 'uploads');
    this.logsDir = options.logsDir || path.join(process.cwd(), 'logs');
    this.maxTempFileAge = options.maxTempFileAge || 60 * 60 * 1000; // 1 hour default
    this.maxLogFileAge = options.maxLogFileAge || 30 * 24 * 60 * 60 * 1000; // 30 days default
    this.maxOrphanAge = options.maxOrphanAge || 24 * 60 * 60 * 1000; // 24 hours default
    this.isRunning = false;
    this.stats = {
      tempFilesDeleted: 0,
      orphanedFilesDeleted: 0,
      logsArchived: 0,
      totalSpaceFreed: 0,
      lastRunTime: null,
      errors: []
    };
  }

  /**
   * Initialize the service with authentication
   */
  async initialize() {
    // Get service token - REQUIRED
    this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
    if (!this.serviceToken) {
      throw new Error('Service authentication failed - cannot start without valid token');
    }
    
    // Initialize secure data access with token
    this.secureDataAccess = new SecureDataAccess(this.serviceToken);
    
    console.log('🔐 File Cleanup Service authenticated successfully');
    
    // Log service initialization
    await immutableAuditService.logServiceOperation({
      serviceId: this.serviceId,
      operation: 'service_initialized',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Main cleanup function - runs all cleanup tasks
   */
  async cleanup() {
    if (!this.serviceToken) {
      await this.initialize();
    }
    
    if (this.isRunning) {
      console.log('🔄 Cleanup already in progress, skipping...');
      return this.stats;
    }

    this.isRunning = true;
    const startTime = Date.now();
    console.log('🧹 Starting file cleanup process...');

    try {
      // Reset stats for this run
      this.resetStats();
      
      // Run cleanup tasks
      await this.cleanupTempFiles();
      await this.cleanupOrphanedUploads();
      await this.archiveOldLogs();
      
      // Update last run time
      this.stats.lastRunTime = new Date();
      const duration = Date.now() - startTime;
      
      console.log(`✅ Cleanup completed in ${duration}ms`);
      console.log(`📊 Stats: ${this.stats.tempFilesDeleted} temp files, ${this.stats.orphanedFilesDeleted} orphans, ${this.stats.logsArchived} logs archived`);
      console.log(`💾 Total space freed: ${this.formatBytes(this.stats.totalSpaceFreed)}`);
      
      return this.stats;
    } catch (error) {
      console.error('❌ Cleanup error:', error);
      this.stats.errors.push(error.message);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Clean up temporary files older than maxTempFileAge
   */
  async cleanupTempFiles() {
    try {
      console.log(`🗑️ Cleaning temp files older than ${this.maxTempFileAge / 1000}s...`);
      
      // Ensure temp directory exists
      await this.ensureDirectoryExists(this.tempDir);
      
      // Get all files in temp directory
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        
        try {
          const stats = await fs.stat(filePath);
          
          // Skip directories
          if (stats.isDirectory()) continue;
          
          // Check file age
          const fileAge = now - stats.mtimeMs;
          
          if (fileAge > this.maxTempFileAge) {
            // Delete old temp file
            await fs.unlink(filePath);
            this.stats.tempFilesDeleted++;
            this.stats.totalSpaceFreed += stats.size;
            console.log(`  🗑️ Deleted temp file: ${file} (age: ${Math.round(fileAge / 1000)}s, size: ${this.formatBytes(stats.size)})`);
          }
        } catch (error) {
          console.error(`  ⚠️ Error processing temp file ${file}:`, error.message);
          this.stats.errors.push(`Temp file ${file}: ${error.message}`);
        }
      }
      
      console.log(`  ✅ Deleted ${this.stats.tempFilesDeleted} temp files`);
    } catch (error) {
      console.error('❌ Error cleaning temp files:', error);
      this.stats.errors.push(`Temp cleanup: ${error.message}`);
    }
  }

  /**
   * Clean up orphaned upload files (files not linked to any document)
   */
  async cleanupOrphanedUploads() {
    try {
      console.log(`🗑️ Cleaning orphaned uploads older than ${this.maxOrphanAge / 1000}s...`);
      
      // This would normally check against database
      // For now, we'll clean up files with specific patterns
      const uploadsDir = path.join(this.uploadsDir, 'documents');
      
      // Ensure uploads directory exists
      if (!await this.directoryExists(uploadsDir)) {
        console.log('  ℹ️ No uploads directory found, skipping...');
        return;
      }
      
      const files = await this.getFilesRecursively(uploadsDir);
      const now = Date.now();
      
      for (const filePath of files) {
        try {
          const stats = await fs.stat(filePath);
          const fileAge = now - stats.mtimeMs;
          
          // Check if file matches orphan patterns
          const fileName = path.basename(filePath);
          const isOrphan = this.isLikelyOrphan(fileName, fileAge);
          
          if (isOrphan && fileAge > this.maxOrphanAge) {
            await fs.unlink(filePath);
            this.stats.orphanedFilesDeleted++;
            this.stats.totalSpaceFreed += stats.size;
            console.log(`  🗑️ Deleted orphan: ${fileName} (age: ${Math.round(fileAge / 1000)}s)`);
          }
        } catch (error) {
          console.error(`  ⚠️ Error processing upload ${filePath}:`, error.message);
          this.stats.errors.push(`Upload ${filePath}: ${error.message}`);
        }
      }
      
      console.log(`  ✅ Deleted ${this.stats.orphanedFilesDeleted} orphaned files`);
    } catch (error) {
      console.error('❌ Error cleaning orphaned uploads:', error);
      this.stats.errors.push(`Orphan cleanup: ${error.message}`);
    }
  }

  /**
   * Archive old audit logs
   */
  async archiveOldLogs() {
    try {
      console.log(`📦 Archiving logs older than ${this.maxLogFileAge / (24 * 60 * 60 * 1000)} days...`);
      
      // Ensure logs directory exists
      if (!await this.directoryExists(this.logsDir)) {
        console.log('  ℹ️ No logs directory found, skipping...');
        return;
      }
      
      const archiveDir = path.join(this.logsDir, 'archive');
      await this.ensureDirectoryExists(archiveDir);
      
      const files = await fs.readdir(this.logsDir);
      const now = Date.now();
      
      for (const file of files) {
        // Skip archive directory
        if (file === 'archive') continue;
        
        const filePath = path.join(this.logsDir, file);
        
        try {
          const stats = await fs.stat(filePath);
          
          // Skip directories
          if (stats.isDirectory()) continue;
          
          // Check if it's a log file
          if (!file.endsWith('.log') && !file.endsWith('.txt')) continue;
          
          const fileAge = now - stats.mtimeMs;
          
          if (fileAge > this.maxLogFileAge) {
            // Create archive filename with date
            const archiveDate = new Date(stats.mtimeMs).toISOString().split('T')[0];
            const archiveName = `${archiveDate}_${file}`;
            const archivePath = path.join(archiveDir, archiveName);
            
            // Move to archive
            await fs.rename(filePath, archivePath);
            this.stats.logsArchived++;
            console.log(`  📦 Archived log: ${file} -> ${archiveName}`);
          }
        } catch (error) {
          console.error(`  ⚠️ Error processing log ${file}:`, error.message);
          this.stats.errors.push(`Log ${file}: ${error.message}`);
        }
      }
      
      console.log(`  ✅ Archived ${this.stats.logsArchived} log files`);
    } catch (error) {
      console.error('❌ Error archiving logs:', error);
      this.stats.errors.push(`Log archive: ${error.message}`);
    }
  }

  /**
   * Clean specific file by path
   */
  async cleanFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      await fs.unlink(filePath);
      console.log(`🗑️ Deleted file: ${filePath} (${this.formatBytes(stats.size)})`);
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`❌ Error deleting file ${filePath}:`, error);
      }
      return false;
    }
  }

  /**
   * Clean all files in a directory
   */
  async cleanDirectory(dirPath, maxAge = 0) {
    try {
      const files = await fs.readdir(dirPath);
      const now = Date.now();
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          const fileAge = now - stats.mtimeMs;
          
          if (fileAge > maxAge) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        }
      }
      
      console.log(`🗑️ Cleaned ${deletedCount} files from ${dirPath}`);
      return deletedCount;
    } catch (error) {
      console.error(`❌ Error cleaning directory ${dirPath}:`, error);
      throw error;
    }
  }

  // Helper methods
  
  resetStats() {
    this.stats = {
      tempFilesDeleted: 0,
      orphanedFilesDeleted: 0,
      logsArchived: 0,
      totalSpaceFreed: 0,
      lastRunTime: this.stats.lastRunTime,
      errors: []
    };
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  async directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async getFilesRecursively(dirPath, files = []) {
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        await this.getFilesRecursively(itemPath, files);
      } else {
        files.push(itemPath);
      }
    }
    
    return files;
  }

  isLikelyOrphan(fileName, fileAge) {
    // Patterns that indicate orphaned files
    const orphanPatterns = [
      /^tmp_/i,
      /^temp_/i,
      /^upload_\d+_/i,
      /^pending_/i,
      /\.(tmp|temp)$/i
    ];
    
    // Check if file matches orphan patterns
    const matchesPattern = orphanPatterns.some(pattern => pattern.test(fileName));
    
    // Consider files older than 1 day with certain patterns as orphans
    const isOldTemp = fileAge > 24 * 60 * 60 * 1000 && matchesPattern;
    
    return isOldTemp;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get cleanup statistics
   */
  getStats() {
    return this.stats;
  }
}

// Create singleton instance
const fileCleanupService = new FileCleanupService();

module.exports = {
  FileCleanupService,
  fileCleanupService
};