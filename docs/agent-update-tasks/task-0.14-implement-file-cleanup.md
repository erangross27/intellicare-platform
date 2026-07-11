# Task 0.14: Implement File Cleanup

## 🚨 **CRITICAL STORAGE TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 20 minutes  
**Risk Level:** MEDIUM  
**Priority:** HIGH  

Implement comprehensive file cleanup mechanisms to prevent storage bloat and handle failed/abandoned uploads properly.

## 🎯 **Objective**
Implement file cleanup that:
- Cleans up failed and abandoned uploads
- Removes orphaned encrypted files
- Clears memory buffers properly
- Prevents storage accumulation over time

## 🚨 **Storage Risk**
**MEDIUM:** Without proper cleanup, failed uploads and temporary files can accumulate and exhaust storage space.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add comprehensive file cleanup mechanisms**

## 🔍 **Current File Cleanup Issues**

### **Issue 1: No Cleanup for Failed Uploads**
```javascript
// CURRENT - NO FAILED UPLOAD CLEANUP
try {
  const document = new Document({...});
  await document.save();
} catch (error) {
  // ❌ File remains on disk if document save fails
  // ❌ No cleanup of encrypted data
  // ❌ Memory buffers not cleared
}
```

### **Issue 2: Orphaned Encrypted Files**
```javascript
// CURRENT - ORPHANED FILES
const encryptedPath = `${file.path}.encrypted`;
await encryptFileStream(file.path, encryptedPath, key);
// ❌ If process fails after encryption, encrypted file remains
```

### **Issue 3: No Scheduled Cleanup**
```javascript
// CURRENT - NO SCHEDULED CLEANUP
// ❌ No cron job for expired files
// ❌ No automatic cleanup of old temporary files
// ❌ No monitoring of storage usage
```

## ✅ **Comprehensive File Cleanup System**

### **1. File Cleanup Manager**
```javascript
// ADD at top of file after imports:
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

class FileCleanupManager {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.uploadDir = path.join(this.tempDir, 'uploads');
    this.encryptedDir = path.join(this.tempDir, 'encrypted');
    this.isRunning = false;
    this.cleanupStats = {
      totalCleaned: 0,
      lastRun: null,
      errors: 0
    };
    
    this.ensureDirectories();
    this.startScheduledCleanup();
    
    console.log('🧹 File cleanup manager initialized');
  }
  
  async ensureDirectories() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.encryptedDir, { recursive: true });
    } catch (error) {
      console.error('❌ Failed to create cleanup directories:', error);
    }
  }
  
  async cleanupFile(filePath, reason = 'cleanup') {
    try {
      const exists = await this.fileExists(filePath);
      if (exists) {
        await fs.unlink(filePath);
        console.log(`🗑️ Cleaned up file: ${path.basename(filePath)} (${reason})`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Failed to cleanup file ${filePath}:`, error);
      this.cleanupStats.errors++;
      return false;
    }
  }
  
  async cleanupFiles(filePaths, reason = 'cleanup') {
    const results = [];
    
    for (const filePath of filePaths) {
      const cleaned = await this.cleanupFile(filePath, reason);
      results.push({ filePath, cleaned });
    }
    
    const cleanedCount = results.filter(r => r.cleaned).length;
    this.cleanupStats.totalCleaned += cleanedCount;
    
    return {
      total: filePaths.length,
      cleaned: cleanedCount,
      results: results
    };
  }
  
  async cleanupExpiredFiles(directory, maxAgeMs = 24 * 60 * 60 * 1000) {
    try {
      const exists = await this.fileExists(directory);
      if (!exists) {
        return { cleaned: 0, errors: 0 };
      }
      
      const files = await fs.readdir(directory);
      const cutoffTime = Date.now() - maxAgeMs;
      
      let cleaned = 0;
      let errors = 0;
      
      for (const file of files) {
        try {
          const filePath = path.join(directory, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            const success = await this.cleanupFile(filePath, 'expired');
            if (success) {
              cleaned++;
            } else {
              errors++;
            }
          }
        } catch (error) {
          console.error(`❌ Error checking file ${file}:`, error);
          errors++;
        }
      }
      
      return { cleaned, errors };
      
    } catch (error) {
      console.error(`❌ Failed to cleanup directory ${directory}:`, error);
      return { cleaned: 0, errors: 1 };
    }
  }
  
  async cleanupOrphanedFiles() {
    try {
      console.log('🔍 Checking for orphaned files...');
      
      // Clean up temp upload files older than 1 hour
      const uploadCleanup = await this.cleanupExpiredFiles(
        this.uploadDir, 
        60 * 60 * 1000 // 1 hour
      );
      
      // Clean up encrypted files older than 1 hour
      const encryptedCleanup = await this.cleanupExpiredFiles(
        this.encryptedDir, 
        60 * 60 * 1000 // 1 hour
      );
      
      // Clean up any .tmp files older than 30 minutes
      const tmpCleanup = await this.cleanupTempFiles(30 * 60 * 1000);
      
      const totalCleaned = uploadCleanup.cleaned + encryptedCleanup.cleaned + tmpCleanup.cleaned;
      const totalErrors = uploadCleanup.errors + encryptedCleanup.errors + tmpCleanup.errors;
      
      console.log(`✅ Orphaned file cleanup: ${totalCleaned} files cleaned, ${totalErrors} errors`);
      
      return {
        uploadFiles: uploadCleanup,
        encryptedFiles: encryptedCleanup,
        tempFiles: tmpCleanup,
        totalCleaned: totalCleaned,
        totalErrors: totalErrors
      };
      
    } catch (error) {
      console.error('❌ Orphaned file cleanup failed:', error);
      return { totalCleaned: 0, totalErrors: 1 };
    }
  }
  
  async cleanupTempFiles(maxAgeMs = 30 * 60 * 1000) {
    try {
      // Find all .tmp files in temp directory and subdirectories
      const tmpFiles = await this.findTempFiles(this.tempDir);
      const cutoffTime = Date.now() - maxAgeMs;
      
      let cleaned = 0;
      let errors = 0;
      
      for (const tmpFile of tmpFiles) {
        try {
          const stats = await fs.stat(tmpFile);
          
          if (stats.mtime.getTime() < cutoffTime) {
            const success = await this.cleanupFile(tmpFile, 'temp file expired');
            if (success) {
              cleaned++;
            } else {
              errors++;
            }
          }
        } catch (error) {
          console.error(`❌ Error processing temp file ${tmpFile}:`, error);
          errors++;
        }
      }
      
      return { cleaned, errors };
      
    } catch (error) {
      console.error('❌ Temp file cleanup failed:', error);
      return { cleaned: 0, errors: 1 };
    }
  }
  
  async findTempFiles(directory) {
    const tempFiles = [];
    
    try {
      const items = await fs.readdir(directory);
      
      for (const item of items) {
        const itemPath = path.join(directory, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          // Recursively search subdirectories
          const subFiles = await this.findTempFiles(itemPath);
          tempFiles.push(...subFiles);
        } else if (item.endsWith('.tmp') || item.includes('.tmp.')) {
          tempFiles.push(itemPath);
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning directory ${directory}:`, error);
    }
    
    return tempFiles;
  }
  
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  startScheduledCleanup() {
    // Run cleanup every hour
    cron.schedule('0 * * * *', async () => {
      if (this.isRunning) {
        console.log('⚠️ Cleanup already running, skipping...');
        return;
      }
      
      this.isRunning = true;
      this.cleanupStats.lastRun = new Date();
      
      try {
        console.log('🕐 Starting scheduled file cleanup...');
        const result = await this.cleanupOrphanedFiles();
        
        console.log(`✅ Scheduled cleanup completed: ${result.totalCleaned} files cleaned`);
        
        // Emit metrics
        if (global.metrics) {
          global.metrics.emit('file_cleanup', {
            ...result,
            timestamp: new Date()
          });
        }
        
      } catch (error) {
        console.error('❌ Scheduled cleanup error:', error);
        this.cleanupStats.errors++;
      } finally {
        this.isRunning = false;
      }
    });
    
    console.log('⏰ Scheduled file cleanup started (hourly)');
  }
  
  getStats() {
    return {
      ...this.cleanupStats,
      isRunning: this.isRunning,
      directories: {
        temp: this.tempDir,
        uploads: this.uploadDir,
        encrypted: this.encryptedDir
      }
    };
  }
}

// Create global file cleanup manager
const fileCleanup = new FileCleanupManager();
global.fileCleanup = fileCleanup;
```

### **2. Enhanced Upload Error Handling with Cleanup**
```javascript
// UPDATE: Upload processing with proper cleanup
router.post('/upload-document',
  // ... middleware ...
  asyncHandler(async (req, res) => {
    const tempFilePaths = [];
    const encryptedFilePaths = [];
    const logger = createLogger(req);
    
    try {
      logger.info('Starting document upload processing');
      
      const { patientName } = req.body;
      const uploadedFiles = req.files;
      
      if (!uploadedFiles || uploadedFiles.length === 0) {
        return sendLocalizedError(res, req.country, 'NO_FILES_UPLOADED', {}, 400);
      }
      
      // Track all file paths for cleanup
      tempFilePaths.push(...uploadedFiles.map(f => f.path));
      
      const uploadId = crypto.randomBytes(16).toString('hex');
      const processedFiles = [];
      
      for (const file of uploadedFiles) {
        let encryptedPath = null;
        
        try {
          logger.debug('Processing file', {
            filename: file.originalname,
            size: file.size,
            tempPath: file.path
          });
          
          const fileInfo = {
            originalName: sanitizeFilename(file.originalname),
            size: file.size,
            type: file.mimetype,
            tempPath: file.path,
            uploadDate: new Date()
          };
          
          // Encrypt file using streaming
          encryptedPath = `${file.path}.encrypted`;
          encryptedFilePaths.push(encryptedPath);
          
          await encryptFileStream(file.path, encryptedPath, process.env.FILE_ENCRYPTION_KEY);
          
          // Read encrypted file
          const encryptedBuffer = await fs.readFile(encryptedPath);
          fileInfo.encryptedData = encryptedBuffer;
          
          processedFiles.push(fileInfo);
          
          logger.debug('File processed successfully', {
            filename: fileInfo.originalName,
            encryptedSize: encryptedBuffer.length
          });
          
        } catch (error) {
          logger.error('File processing failed', error, {
            filename: file.originalname,
            tempPath: file.path,
            encryptedPath: encryptedPath
          });
          
          // Clean up this file's artifacts immediately
          if (encryptedPath) {
            await fileCleanup.cleanupFile(encryptedPath, 'processing failed');
          }
          
          // Continue with other files
        }
      }
      
      if (processedFiles.length === 0) {
        throw new Error('No files were processed successfully');
      }
      
      // Create pending upload record
      const PendingUpload = req.models.PendingUpload;
      const pendingUpload = new PendingUpload({
        uploadId,
        userId: req.user._id,
        practiceId: req.practice._id,
        practiceSubdomain: req.practiceSubdomain,
        files: processedFiles,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        tempFilePaths: tempFilePaths, // Store for cleanup
        encryptedFilePaths: encryptedFilePaths
      });
      
      await pendingUpload.save();
      
      // Schedule cleanup of temp files (keep encrypted files until processing)
      setTimeout(async () => {
        await fileCleanup.cleanupFiles(tempFilePaths, 'upload completed');
      }, 5000); // 5 second delay
      
      // Schedule cleanup of encrypted files after 1 hour
      setTimeout(async () => {
        await fileCleanup.cleanupFiles(encryptedFilePaths, 'upload expired');
      }, 60 * 60 * 1000); // 1 hour
      
      logger.info('Upload processing completed', {
        uploadId: uploadId,
        processedFiles: processedFiles.length,
        totalFiles: uploadedFiles.length
      });
      
      await correlatedAuditLog(req, 'DOCUMENT_UPLOAD_INITIATED', {
        uploadId: uploadId,
        fileCount: processedFiles.length,
        totalSize: processedFiles.reduce((sum, f) => sum + f.size, 0)
      });
      
      res.json({
        success: true,
        message: getLocalizedSuccess(req.country, 'UPLOAD_INITIATED'),
        data: {
          uploadId: uploadId,
          fileCount: processedFiles.length,
          totalSize: processedFiles.reduce((sum, f) => sum + f.size, 0)
        }
      });
      
    } catch (error) {
      const logger = createLogger(req);
      logger.error('Upload processing failed completely', error);
      
      // Clean up all temp and encrypted files on complete failure
      await fileCleanup.cleanupFiles(tempFilePaths, 'upload failed');
      await fileCleanup.cleanupFiles(encryptedFilePaths, 'upload failed');
      
      throw error;
    }
  })
);
```

### **3. Memory Buffer Cleanup**
```javascript
// ADD: Memory buffer cleanup utilities
const clearMemoryBuffers = () => {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    console.log('🗑️ Forced garbage collection');
  }
  
  // Clear any large buffers from memory
  if (global.largeBuffers) {
    global.largeBuffers.clear();
  }
};

// Memory pressure monitoring
const monitorMemoryPressure = () => {
  setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    
    // If memory usage is high, trigger cleanup
    if (heapUsedMB > 800) { // > 800MB
      console.log(`⚠️ High memory usage detected: ${heapUsedMB}MB`);
      
      // Trigger file cleanup
      fileCleanup.cleanupOrphanedFiles();
      
      // Clear memory buffers
      clearMemoryBuffers();
      
      // Alert if available
      if (global.alertSystem) {
        global.alertSystem.triggerAlert('HIGH_MEMORY_USAGE', {
          heapUsedMB: heapUsedMB,
          severity: 'warning'
        });
      }
    }
  }, 30000); // Check every 30 seconds
};

// Start memory monitoring
monitorMemoryPressure();
```

### **4. File Cleanup Endpoints**
```javascript
// ADD: File cleanup management endpoints
router.get('/file-cleanup/status',
  practiceAuth,
  requireAuth,
  (req, res) => {
    try {
      const stats = fileCleanup.getStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get cleanup status'
      });
    }
  }
);

router.post('/file-cleanup/run',
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const logger = createLogger(req);
      
      logger.info('Manual file cleanup requested');
      
      const result = await fileCleanup.cleanupOrphanedFiles();
      
      await correlatedAuditLog(req, 'MANUAL_FILE_CLEANUP', {
        ...result,
        requestedBy: req.user._id
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  })
);
```

### **5. Graceful Shutdown Integration**
```javascript
// UPDATE: Graceful shutdown with file cleanup
const gracefulShutdownWithCleanup = async (signal) => {
  console.log(`🛑 Received ${signal}, starting graceful shutdown with cleanup...`);
  
  try {
    // Stop accepting new requests
    if (global.server) {
      global.server.close();
    }
    
    // Run final cleanup
    console.log('🧹 Running final file cleanup...');
    if (global.fileCleanup) {
      await global.fileCleanup.cleanupOrphanedFiles();
    }
    
    // Clear memory buffers
    clearMemoryBuffers();
    
    // Close database connections
    if (global.mongoose) {
      await global.mongoose.connection.close();
    }
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Update shutdown handlers
process.removeAllListeners('SIGTERM');
process.removeAllListeners('SIGINT');
process.on('SIGTERM', () => gracefulShutdownWithCleanup('SIGTERM'));
process.on('SIGINT', () => gracefulShutdownWithCleanup('SIGINT'));
```

## ⚠️ **File Cleanup Notes**
- **🚨 IMPORTANT:** File cleanup prevents storage exhaustion
- **🚨 IMPORTANT:** Memory cleanup prevents server crashes
- **🚨 IMPORTANT:** Scheduled cleanup maintains system health
- **❌ DON'T SKIP:** This is essential for long-term stability

## 🧪 **Testing After Implementation**
1. **Test file cleanup:**
   - Create temporary files and verify cleanup
   - Test failed upload cleanup

2. **Test memory management:**
   - Monitor memory usage during large uploads
   - Verify garbage collection triggers

3. **Test scheduled cleanup:**
   - Verify hourly cleanup runs
   - Check cleanup statistics

## ✅ **Success Criteria**
- [ ] File cleanup manager operational
- [ ] Failed upload cleanup working
- [ ] Orphaned file cleanup functional
- [ ] Memory pressure monitoring active
- [ ] Scheduled cleanup running
- [ ] Graceful shutdown with cleanup working

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 1.1:** Update addPatientFunction Schema (Phase 1)

## 📝 **CRITICAL NOTES**
- **PREVENTS STORAGE EXHAUSTION** - cleanup essential for disk space
- **MAINTAINS SYSTEM PERFORMANCE** - memory management critical
- **ENABLES LONG-TERM STABILITY** - scheduled cleanup important
- **TEST THOROUGHLY** - verify all cleanup mechanisms work
