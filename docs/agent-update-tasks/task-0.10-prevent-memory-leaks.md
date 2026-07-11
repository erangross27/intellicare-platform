# Task 0.10: Prevent Memory Leaks

## 🚨 **CRITICAL PERFORMANCE TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 25 minutes  
**Risk Level:** HIGH  
**Priority:** URGENT  

Fix memory leaks from large file uploads and processing that can cause server crashes and out-of-memory errors.

## 🎯 **Objective**
Implement memory leak prevention that:
- Prevents out-of-memory errors from large uploads
- Implements streaming for large file processing
- Adds memory usage monitoring and limits
- Ensures proper cleanup of temporary resources

## 🚨 **Performance Risk**
**HIGH:** Large file uploads stored in memory can cause server crashes and denial of service.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add memory management and streaming capabilities**

## 🔍 **Current Memory Leak Issues**

### **Issue 1: Large Files in Memory**
```javascript
// CURRENT - MEMORY LEAK RISK
const audioUpload = multer({
  storage: multer.memoryStorage(), // ❌ DANGEROUS: Stores entire file in RAM
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB can crash server with multiple uploads
});

// ❌ PROBLEM: Multiple 10MB uploads = server crash
```

### **Issue 2: No Memory Monitoring**
```javascript
// CURRENT - NO MEMORY TRACKING
router.post('/upload-document', async (req, res) => {
  // ❌ No memory usage monitoring
  // ❌ No cleanup of large buffers
  // ❌ No limits on concurrent uploads
});
```

### **Issue 3: Buffer Accumulation**
```javascript
// CURRENT - BUFFER ACCUMULATION
const { files } = req.body;
files.forEach(file => {
  // ❌ PROBLEM: All file buffers kept in memory simultaneously
  const buffer = file.buffer; // Large buffer stays in memory
  // No cleanup until garbage collection
});
```

## ✅ **Memory Leak Prevention System**

### **1. Memory Monitoring Functions**
```javascript
// ADD at top of file after imports:
const fs = require('fs');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);

// Memory monitoring
const getMemoryUsage = () => {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
    arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024) // MB
  };
};

const logMemoryUsage = (operation, req) => {
  const usage = getMemoryUsage();
  console.log(`💾 Memory usage for ${operation}:`, usage);
  
  // Log to audit if memory usage is high
  if (usage.heapUsed > 500) { // > 500MB
    auditLog(req, 'HIGH_MEMORY_USAGE', {
      operation: operation,
      memoryUsage: usage,
      warning: 'High memory usage detected'
    });
  }
  
  return usage;
};

const checkMemoryLimit = (req, res, next) => {
  const usage = getMemoryUsage();
  const memoryLimitMB = 1000; // 1GB limit
  
  if (usage.heapUsed > memoryLimitMB) {
    auditLog(req, 'MEMORY_LIMIT_EXCEEDED', {
      currentUsage: usage,
      limit: memoryLimitMB
    });
    
    return sendLocalizedError(res, req.country, 'SERVER_OVERLOADED', {
      details: 'Server memory limit exceeded. Please try again later.'
    }, 503);
  }
  
  next();
};
```

### **2. Streaming File Upload Configuration**
```javascript
// ADD: Streaming file upload with disk storage
const multer = require('multer');
const crypto = require('crypto');

// Create temporary directory for uploads
const tempDir = path.join(__dirname, '../temp/uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer for disk storage (not memory)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create practice-specific temp directory
    const clinicTempDir = path.join(tempDir, req.practiceSubdomain);
    if (!fs.existsSync(clinicTempDir)) {
      fs.mkdirSync(clinicTempDir, { recursive: true });
    }
    cb(null, clinicTempDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const sanitizedName = sanitizeFilename(file.originalname);
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  }
});

// Configure upload limits and file filtering
const uploadLimits = {
  fileSize: 50 * 1024 * 1024, // 50MB per file
  files: 10, // Max 10 files per request
  fieldSize: 1024 * 1024, // 1MB for text fields
  headerPairs: 2000
};

const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}`), false);
  }
};

// Create multer instance with disk storage
const uploadHandler = multer({
  storage: diskStorage,
  limits: uploadLimits,
  fileFilter: fileFilter
});
```

### **3. File Processing with Streaming**
```javascript
// ADD: Streaming file processing functions
const processFileStream = async (filePath, outputPath) => {
  try {
    const readStream = fs.createReadStream(filePath);
    const writeStream = fs.createWriteStream(outputPath);
    
    // Use pipeline for proper error handling and cleanup
    await pipeline(readStream, writeStream);
    
    return true;
  } catch (error) {
    console.error('❌ File streaming error:', error);
    throw error;
  }
};

const encryptFileStream = async (inputPath, outputPath, encryptionKey) => {
  try {
    const readStream = fs.createReadStream(inputPath);
    const writeStream = fs.createWriteStream(outputPath);
    
    // Create encryption transform stream
    const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
    
    // Pipeline: read -> encrypt -> write
    await pipeline(readStream, cipher, writeStream);
    
    return true;
  } catch (error) {
    console.error('❌ File encryption streaming error:', error);
    throw error;
  }
};

const getFileSize = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
};
```

### **4. Temporary File Cleanup**
```javascript
// ADD: Temporary file cleanup functions
const cleanupTempFile = async (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`🗑️ Cleaned up temp file: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Failed to cleanup temp file ${filePath}:`, error);
  }
};

const cleanupTempFiles = async (filePaths) => {
  const cleanupPromises = filePaths.map(filePath => cleanupTempFile(filePath));
  await Promise.allSettled(cleanupPromises);
};

const scheduleFileCleanup = (filePath, delayMs = 60000) => {
  // Schedule cleanup after delay (default 1 minute)
  setTimeout(async () => {
    await cleanupTempFile(filePath);
  }, delayMs);
};

const cleanupExpiredTempFiles = async () => {
  try {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    
    const cleanupDirectory = async (dirPath) => {
      if (!fs.existsSync(dirPath)) return;
      
      const files = await fs.promises.readdir(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.promises.stat(filePath);
        
        if (stats.isFile() && (now - stats.mtime.getTime()) > maxAge) {
          await cleanupTempFile(filePath);
        }
      }
    };
    
    // Cleanup main temp directory and subdirectories
    await cleanupDirectory(tempDir);
    
    const subdirs = await fs.promises.readdir(tempDir);
    for (const subdir of subdirs) {
      const subdirPath = path.join(tempDir, subdir);
      const stats = await fs.promises.stat(subdirPath);
      if (stats.isDirectory()) {
        await cleanupDirectory(subdirPath);
      }
    }
    
    console.log('🧹 Completed expired temp file cleanup');
  } catch (error) {
    console.error('❌ Temp file cleanup error:', error);
  }
};

// Schedule periodic cleanup
setInterval(cleanupExpiredTempFiles, 60 * 60 * 1000); // Every hour
```

### **5. Memory-Safe Upload Route**
```javascript
// BEFORE - Memory unsafe:
router.post('/upload-document', async (req, res) => {
  // Files stored in memory
});

// AFTER - Memory safe with streaming:
router.post('/upload-document',
  generalRateLimit,
  uploadRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  checkMemoryLimit,                    // ✅ ADD: Memory limit check
  uploadHandler.array('files', 10),    // ✅ ADD: Disk-based upload
  async (req, res) => {
    const tempFilePaths = [];
    
    try {
      logMemoryUsage('upload-start', req);
      
      const { patientName } = req.body;
      const uploadedFiles = req.files; // Files are on disk, not in memory
      
      if (!uploadedFiles || uploadedFiles.length === 0) {
        return sendLocalizedError(res, req.country, 'NO_FILES_UPLOADED', {}, 400);
      }
      
      // Track temp files for cleanup
      tempFilePaths.push(...uploadedFiles.map(f => f.path));
      
      // Generate upload ID
      const uploadId = crypto.randomBytes(16).toString('hex');
      
      // Process files with streaming (not loading into memory)
      const processedFiles = [];
      
      for (const file of uploadedFiles) {
        try {
          // Get file info without loading into memory
          const fileInfo = {
            originalName: sanitizeFilename(file.originalname),
            size: file.size,
            type: file.mimetype,
            tempPath: file.path,
            uploadDate: new Date()
          };
          
          // Encrypt file using streaming
          const encryptedPath = `${file.path}.encrypted`;
          await encryptFileStream(file.path, encryptedPath, process.env.FILE_ENCRYPTION_KEY);
          
          // Read encrypted file as buffer for storage
          const encryptedBuffer = await fs.promises.readFile(encryptedPath);
          
          fileInfo.encryptedData = encryptedBuffer;
          processedFiles.push(fileInfo);
          
          // Cleanup temp encrypted file
          await cleanupTempFile(encryptedPath);
          
          logMemoryUsage(`file-processed-${file.originalname}`, req);
          
        } catch (error) {
          console.error(`❌ Error processing file ${file.originalname}:`, error);
          // Continue with other files
        }
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
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h expiration
      });
      
      await pendingUpload.save();
      
      // Schedule cleanup of temp files
      scheduleFileCleanup(tempFilePaths);
      
      logMemoryUsage('upload-complete', req);
      
      // Log successful upload
      await auditLog(req, 'DOCUMENT_UPLOAD_INITIATED', {
        uploadId: uploadId,
        fileCount: processedFiles.length,
        totalSize: processedFiles.reduce((sum, f) => sum + f.size, 0),
        patientName: patientName
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
      // Cleanup temp files on error
      await cleanupTempFiles(tempFilePaths);
      await handleRouteError(req, res, error, 'UPLOAD_DOCUMENT');
    }
  }
);
```

### **6. Memory Monitoring Middleware**
```javascript
// ADD: Memory monitoring middleware
const memoryMonitoringMiddleware = (req, res, next) => {
  const startUsage = getMemoryUsage();
  const startTime = Date.now();
  
  // Override res.end to log memory usage after request
  const originalEnd = res.end;
  res.end = function(...args) {
    const endUsage = getMemoryUsage();
    const duration = Date.now() - startTime;
    
    const memoryDelta = {
      rss: endUsage.rss - startUsage.rss,
      heapUsed: endUsage.heapUsed - startUsage.heapUsed,
      heapTotal: endUsage.heapTotal - startUsage.heapTotal
    };
    
    // Log if significant memory increase
    if (memoryDelta.heapUsed > 50) { // > 50MB increase
      console.log(`⚠️ High memory delta for ${req.method} ${req.path}:`, {
        delta: memoryDelta,
        duration: duration,
        finalUsage: endUsage
      });
      
      auditLog(req, 'HIGH_MEMORY_DELTA', {
        path: req.path,
        method: req.method,
        memoryDelta: memoryDelta,
        duration: duration
      });
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// Apply to all routes
router.use(memoryMonitoringMiddleware);
```

### **7. Garbage Collection Optimization**
```javascript
// ADD: Garbage collection helpers
const forceGarbageCollection = () => {
  if (global.gc) {
    global.gc();
    console.log('🗑️ Forced garbage collection');
  } else {
    console.log('⚠️ Garbage collection not available (run with --expose-gc)');
  }
};

const scheduleGarbageCollection = () => {
  // Force GC every 10 minutes if memory usage is high
  setInterval(() => {
    const usage = getMemoryUsage();
    if (usage.heapUsed > 500) { // > 500MB
      forceGarbageCollection();
    }
  }, 10 * 60 * 1000); // 10 minutes
};

// Start GC scheduling
scheduleGarbageCollection();
```

## ⚠️ **Performance Notes**
- **🚨 CRITICAL:** Streaming prevents memory exhaustion
- **🚨 CRITICAL:** Temp file cleanup prevents disk bloat
- **🚨 CRITICAL:** Memory monitoring prevents crashes
- **❌ DON'T SKIP:** This prevents server crashes from large uploads

## 🧪 **Performance Testing After Implementation**
1. **Test memory usage:**
   - Upload multiple large files simultaneously
   - Monitor memory usage stays reasonable
   - Verify no memory leaks

2. **Test file cleanup:**
   - Upload files and verify temp files are cleaned
   - Check expired file cleanup works

3. **Test streaming:**
   - Upload very large files
   - Verify they don't cause memory spikes

## ✅ **Success Criteria**
- [ ] File uploads use disk storage, not memory
- [ ] Streaming implemented for large file processing
- [ ] Memory monitoring and limits working
- [ ] Temporary file cleanup functioning
- [ ] Garbage collection optimization active
- [ ] No memory leaks from file operations

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 0.11:** Add CORS Security Headers

## 📝 **CRITICAL NOTES**
- **PREVENTS SERVER CRASHES** - memory management essential
- **ENABLES LARGE UPLOADS** - streaming allows bigger files
- **MAINTAINS PERFORMANCE** - cleanup prevents resource bloat
- **TEST THOROUGHLY** - verify memory usage stays reasonable
