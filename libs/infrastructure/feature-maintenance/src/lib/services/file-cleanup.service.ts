/**
 * File Cleanup Service - Infrastructure Domain
 * Handles automatic cleanup of temporary files, orphaned uploads, and old logs
 * 
 * Features:
 * - Automatic cleanup of temporary files older than threshold
 * - Detection and removal of orphaned upload files
 * - Log file archiving and rotation
 * - Configurable age thresholds and cleanup policies
 * - Comprehensive cleanup statistics and reporting
 * - Secure file operations with audit logging
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface FileCleanupOptions {
  tempDir?: string;
  uploadsDir?: string;
  logsDir?: string;
  maxTempFileAge?: number;
  maxLogFileAge?: number;
  maxOrphanAge?: number;
}

export interface CleanupStats {
  tempFilesDeleted: number;
  orphanedFilesDeleted: number;
  logsArchived: number;
  totalSpaceFreed: number;
  lastRunTime: Date | null;
  errors: string[];
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  age: number;
  isOrphan: boolean;
}

export interface DirectoryCleanupResult {
  deletedCount: number;
  totalSize: number;
  errors: string[];
}

@Injectable()
export class FileCleanupService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;

  private tempDir: string;
  private uploadsDir: string;
  private logsDir: string;
  private maxTempFileAge: number;
  private maxLogFileAge: number;
  private maxOrphanAge: number;
  private isRunning = false;

  private stats: CleanupStats = {
    tempFilesDeleted: 0,
    orphanedFilesDeleted: 0,
    logsArchived: 0,
    totalSpaceFreed: 0,
    lastRunTime: null,
    errors: []
  };

  constructor(
    private configService: ConfigService,
    options: FileCleanupOptions = {}
  ) {
    this.tempDir = options.tempDir || path.join(process.cwd(), 'uploads', 'temp');
    this.uploadsDir = options.uploadsDir || path.join(process.cwd(), 'uploads');
    this.logsDir = options.logsDir || path.join(process.cwd(), 'logs');
    this.maxTempFileAge = options.maxTempFileAge || 60 * 60 * 1000; // 1 hour default
    this.maxLogFileAge = options.maxLogFileAge || 30 * 24 * 60 * 60 * 1000; // 30 days default
    this.maxOrphanAge = options.maxOrphanAge || 24 * 60 * 60 * 1000; // 24 hours default
  }

  async onModuleInit() {
    if (this.initialized) return;

    try {
      this.serviceToken = await serviceAccountManager.authenticate('file-cleanup-service');
      this.initialized = true;
      console.log('✅ File Cleanup Service initialized');

      await this.logServiceOperation('service_initialized', {
        tempDir: this.tempDir,
        uploadsDir: this.uploadsDir,
        logsDir: this.logsDir
      });
    } catch (error) {
      console.error('❌ Failed to initialize File Cleanup Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'file-cleanup-service',
      operation: 'file_cleanup_operations',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  /**
   * Main cleanup function - runs all cleanup tasks
   */
  async cleanup(clinicId?: string): Promise<CleanupStats> {
    if (this.isRunning) {
      console.log('🔄 Cleanup already in progress, skipping...');
      return this.stats;
    }

    this.isRunning = true;
    const startTime = Date.now();
    console.log('🧹 Starting file cleanup process...');

    try {
      this.resetStats();

      await this.cleanupTempFiles(clinicId);
      await this.cleanupOrphanedUploads(clinicId);
      await this.archiveOldLogs(clinicId);

      this.stats.lastRunTime = new Date();
      const duration = Date.now() - startTime;

      console.log(`✅ Cleanup completed in ${duration}ms`);
      console.log(`📊 Stats: ${this.stats.tempFilesDeleted} temp files, ${this.stats.orphanedFilesDeleted} orphans, ${this.stats.logsArchived} logs archived`);
      console.log(`💾 Total space freed: ${this.formatBytes(this.stats.totalSpaceFreed)}`);

      await this.logCleanupResults(this.stats, clinicId);

      return this.stats;
    } catch (error) {
      console.error('❌ Cleanup error:', error);
      this.stats.errors.push(error.message);
      await this.logCleanupError(error, clinicId);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Clean up temporary files older than maxTempFileAge
   */
  async cleanupTempFiles(clinicId?: string): Promise<number> {
    try {
      console.log(`🗑️ Cleaning temp files older than ${this.maxTempFileAge / 1000}s...`);

      await this.ensureDirectoryExists(this.tempDir);

      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);

        try {
          const stats = await fs.stat(filePath);

          if (stats.isDirectory()) continue;

          const fileAge = now - stats.mtimeMs;

          if (fileAge > this.maxTempFileAge) {
            await fs.unlink(filePath);
            deletedCount++;
            this.stats.tempFilesDeleted++;
            this.stats.totalSpaceFreed += stats.size;
            console.log(`  🗑️ Deleted temp file: ${file} (age: ${Math.round(fileAge / 1000)}s, size: ${this.formatBytes(stats.size)})`);
          }
        } catch (error) {
          console.error(`  ⚠️ Error processing temp file ${file}:`, error.message);
          this.stats.errors.push(`Temp file ${file}: ${error.message}`);
        }
      }

      console.log(`  ✅ Deleted ${deletedCount} temp files`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Error cleaning temp files:', error);
      this.stats.errors.push(`Temp cleanup: ${error.message}`);
      return 0;
    }
  }

  /**
   * Clean up orphaned upload files (files not linked to any document)
   */
  async cleanupOrphanedUploads(clinicId?: string): Promise<number> {
    try {
      console.log(`🗑️ Cleaning orphaned uploads older than ${this.maxOrphanAge / 1000}s...`);

      const uploadsDir = path.join(this.uploadsDir, 'documents');

      if (!await this.directoryExists(uploadsDir)) {
        console.log('  ℹ️ No uploads directory found, skipping...');
        return 0;
      }

      const files = await this.getFilesRecursively(uploadsDir);
      const now = Date.now();
      let deletedCount = 0;

      for (const filePath of files) {
        try {
          const stats = await fs.stat(filePath);
          const fileAge = now - stats.mtimeMs;

          const fileName = path.basename(filePath);
          const isOrphan = this.isLikelyOrphan(fileName, fileAge);

          if (isOrphan && fileAge > this.maxOrphanAge) {
            await fs.unlink(filePath);
            deletedCount++;
            this.stats.orphanedFilesDeleted++;
            this.stats.totalSpaceFreed += stats.size;
            console.log(`  🗑️ Deleted orphan: ${fileName} (age: ${Math.round(fileAge / 1000)}s)`);
          }
        } catch (error) {
          console.error(`  ⚠️ Error processing upload ${filePath}:`, error.message);
          this.stats.errors.push(`Upload ${filePath}: ${error.message}`);
        }
      }

      console.log(`  ✅ Deleted ${deletedCount} orphaned files`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Error cleaning orphaned uploads:', error);
      this.stats.errors.push(`Orphan cleanup: ${error.message}`);
      return 0;
    }
  }

  /**
   * Archive old audit logs
   */
  async archiveOldLogs(clinicId?: string): Promise<number> {
    try {
      console.log(`📦 Archiving logs older than ${this.maxLogFileAge / (24 * 60 * 60 * 1000)} days...`);

      if (!await this.directoryExists(this.logsDir)) {
        console.log('  ℹ️ No logs directory found, skipping...');
        return 0;
      }

      const archiveDir = path.join(this.logsDir, 'archive');
      await this.ensureDirectoryExists(archiveDir);

      const files = await fs.readdir(this.logsDir);
      const now = Date.now();
      let archivedCount = 0;

      for (const file of files) {
        if (file === 'archive') continue;

        const filePath = path.join(this.logsDir, file);

        try {
          const stats = await fs.stat(filePath);

          if (stats.isDirectory()) continue;

          if (!file.endsWith('.log') && !file.endsWith('.txt')) continue;

          const fileAge = now - stats.mtimeMs;

          if (fileAge > this.maxLogFileAge) {
            const archiveDate = new Date(stats.mtimeMs).toISOString().split('T')[0];
            const archiveName = `${archiveDate}_${file}`;
            const archivePath = path.join(archiveDir, archiveName);

            await fs.rename(filePath, archivePath);
            archivedCount++;
            this.stats.logsArchived++;
            console.log(`  📦 Archived log: ${file} -> ${archiveName}`);
          }
        } catch (error) {
          console.error(`  ⚠️ Error processing log ${file}:`, error.message);
          this.stats.errors.push(`Log ${file}: ${error.message}`);
        }
      }

      console.log(`  ✅ Archived ${archivedCount} log files`);
      return archivedCount;
    } catch (error) {
      console.error('❌ Error archiving logs:', error);
      this.stats.errors.push(`Log archive: ${error.message}`);
      return 0;
    }
  }

  /**
   * Clean specific file by path
   */
  async cleanFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      await fs.unlink(filePath);
      console.log(`🗑️ Deleted file: ${filePath} (${this.formatBytes(stats.size)})`);
      return true;
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`❌ Error deleting file ${filePath}:`, error);
      }
      return false;
    }
  }

  /**
   * Clean all files in a directory
   */
  async cleanDirectory(dirPath: string, maxAge = 0): Promise<DirectoryCleanupResult> {
    try {
      const files = await fs.readdir(dirPath);
      const now = Date.now();
      let deletedCount = 0;
      let totalSize = 0;
      const errors: string[] = [];

      for (const file of files) {
        const filePath = path.join(dirPath, file);

        try {
          const stats = await fs.stat(filePath);

          if (stats.isFile()) {
            const fileAge = now - stats.mtimeMs;

            if (fileAge > maxAge) {
              await fs.unlink(filePath);
              deletedCount++;
              totalSize += stats.size;
            }
          }
        } catch (error: any) {
          errors.push(`Error processing ${file}: ${error.message}`);
        }
      }

      console.log(`🗑️ Cleaned ${deletedCount} files from ${dirPath}`);
      return { deletedCount, totalSize, errors };
    } catch (error) {
      console.error(`❌ Error cleaning directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Get file information for analysis
   */
  async analyzeDirectory(dirPath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const now = Date.now();

    try {
      const fileList = await this.getFilesRecursively(dirPath);

      for (const filePath of fileList) {
        try {
          const stats = await fs.stat(filePath);
          const fileName = path.basename(filePath);
          const fileAge = now - stats.mtimeMs;

          files.push({
            path: filePath,
            name: fileName,
            size: stats.size,
            age: fileAge,
            isOrphan: this.isLikelyOrphan(fileName, fileAge)
          });
        } catch (error) {
          console.warn(`Could not analyze file ${filePath}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error analyzing directory ${dirPath}:`, error);
    }

    return files;
  }

  /**
   * Get cleanup statistics
   */
  getStats(): CleanupStats {
    return { ...this.stats };
  }

  /**
   * Schedule automatic cleanup
   */
  async scheduleCleanup(intervalMs: number, clinicId?: string): Promise<NodeJS.Timeout> {
    console.log(`⏰ Scheduling cleanup every ${intervalMs / 1000}s`);

    return setInterval(async () => {
      try {
        await this.cleanup(clinicId);
      } catch (error) {
        console.error('Scheduled cleanup failed:', error);
      }
    }, intervalMs);
  }

  // ========== HELPER METHODS ==========

  private resetStats(): void {
    this.stats = {
      tempFilesDeleted: 0,
      orphanedFilesDeleted: 0,
      logsArchived: 0,
      totalSpaceFreed: 0,
      lastRunTime: this.stats.lastRunTime,
      errors: []
    };
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private async getFilesRecursively(dirPath: string, files: string[] = []): Promise<string[]> {
    try {
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
    } catch (error) {
      console.warn(`Could not read directory ${dirPath}:`, error);
    }

    return files;
  }

  private isLikelyOrphan(fileName: string, fileAge: number): boolean {
    const orphanPatterns = [
      /^tmp_/i,
      /^temp_/i,
      /^upload_\d+_/i,
      /^pending_/i,
      /\.(tmp|temp)$/i
    ];

    const matchesPattern = orphanPatterns.some(pattern => pattern.test(fileName));
    const isOldTemp = fileAge > 24 * 60 * 60 * 1000 && matchesPattern;

    return isOldTemp;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ========== AUDIT LOGGING ==========

  private async logServiceOperation(operation: string, details: any, clinicId?: string) {
    const context = this.getServiceContext(clinicId);

    try {
      await SecureDataAccess.insert('audit_logs', {
        action: 'FILE_CLEANUP_OPERATION',
        resourceType: 'file_system',
        userId: 'system',
        details: { operation, ...details },
        timestamp: new Date()
      }, context);
    } catch (error) {
      console.error('Failed to log service operation:', error);
    }
  }

  private async logCleanupResults(stats: CleanupStats, clinicId?: string) {
    const context = this.getServiceContext(clinicId);

    try {
      await SecureDataAccess.insert('audit_logs', {
        action: 'CLEANUP_COMPLETED',
        resourceType: 'file_system',
        userId: 'system',
        details: {
          tempFilesDeleted: stats.tempFilesDeleted,
          orphanedFilesDeleted: stats.orphanedFilesDeleted,
          logsArchived: stats.logsArchived,
          totalSpaceFreed: stats.totalSpaceFreed,
          errorCount: stats.errors.length
        },
        timestamp: new Date()
      }, context);
    } catch (error) {
      console.error('Failed to log cleanup results:', error);
    }
  }

  private async logCleanupError(error: any, clinicId?: string) {
    const context = this.getServiceContext(clinicId);

    try {
      await SecureDataAccess.insert('audit_logs', {
        action: 'CLEANUP_ERROR',
        resourceType: 'file_system',
        userId: 'system',
        details: {
          error: error.message,
          stack: error.stack
        },
        timestamp: new Date()
      }, context);
    } catch (logError) {
      console.error('Failed to log cleanup error:', logError);
    }
  }
}