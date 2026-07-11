# Task 0.4: Secure Temp File Handling

## 🗓️ **SECURITY TASK**
**Phase:** 0 (Critical Security)  
**Time Estimate:** 25 minutes  
**Risk Level:** HIGH  
**Priority:** URGENT  

## 🎯 **Objective**
Secure temporary file handling during document upload, processing, and OCR operations to prevent data leakage.

## 🚨 **Security Risk**
**HIGH:** Current temporary file handling exposes:
- Unencrypted temp files on disk
- Files not properly cleaned up
- Predictable temp file names
- World-readable permissions
- Files persist after process crashes

## 📁 **Files to Modify**
- `backend/routes/documents.js`
- `backend/services/documentAnalysisService.js`
- `backend/utils/secureFileHandler.js` (create new)
- `backend/middleware/fileCleanup.js` (create new)

## 🔧 **Implementation**

### **Step 1: Create Secure File Handler**
```javascript
// backend/utils/secureFileHandler.js
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');

class SecureFileHandler {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'intellicare-secure');
    this.activeFiles = new Map();
    this.init();
  }

  async init() {
    // Create secure temp directory
    try {
      await fs.mkdir(this.tempDir, { mode: 0o700, recursive: true });
    } catch (error) {
      console.error('Failed to create secure temp directory:', error);
    }
  }

  generateSecureFileName(practiceId, originalName) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256')
      .update(`${practiceId}_${timestamp}_${random}`)
      .digest('hex');
    
    const extension = path.extname(originalName);
    return `secure_${hash}${extension}`;
  }

  async createSecureTemp(buffer, practiceId, originalName, userId) {
    const fileName = this.generateSecureFileName(practiceId, originalName);
    const filePath = path.join(this.tempDir, fileName);
    
    // Write with restricted permissions
    await fs.writeFile(filePath, buffer, { mode: 0o600 });
    
    // Track active file
    const fileInfo = {
      path: filePath,
      practiceId,
      userId,
      originalName,
      created: new Date(),
      accessed: new Date(),
      size: buffer.length
    };
    
    this.activeFiles.set(filePath, fileInfo);
    
    // Auto-cleanup after 1 hour
    setTimeout(() => {
      this.secureDelete(filePath);
    }, 60 * 60 * 1000);
    
    return filePath;
  }

  async readSecureTemp(filePath, practiceId, userId) {
    const fileInfo = this.activeFiles.get(filePath);
    
    if (!fileInfo) {
      throw new Error('File not found or expired');
    }
    
    // Verify access permissions
    if (fileInfo.practiceId !== practiceId || fileInfo.userId !== userId) {
      throw new Error('Unauthorized access to temp file');
    }
    
    // Update access time
    fileInfo.accessed = new Date();
    
    try {
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      // Clean up if file is corrupted
      await this.secureDelete(filePath);
      throw error;
    }
  }

  async secureDelete(filePath) {
    try {
      // Get file info
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      
      // Overwrite with random data (3 passes)
      for (let i = 0; i < 3; i++) {
        const randomData = crypto.randomBytes(fileSize);
        await fs.writeFile(filePath, randomData);
        await fs.fsync(await fs.open(filePath, 'r+'));
      }
      
      // Final overwrite with zeros
      const zeroData = Buffer.alloc(fileSize, 0);
      await fs.writeFile(filePath, zeroData);
      await fs.fsync(await fs.open(filePath, 'r+'));
      
      // Delete file
      await fs.unlink(filePath);
      
      // Remove from tracking
      this.activeFiles.delete(filePath);
      
      console.log(`✅ Securely deleted temp file: ${path.basename(filePath)}`);
    } catch (error) {
      console.error(`Failed to securely delete ${filePath}:`, error);
    }
  }

  async cleanupExpired() {
    const now = new Date();
    const expiredFiles = [];
    
    for (const [filePath, fileInfo] of this.activeFiles) {
      const ageMinutes = (now - fileInfo.created) / (1000 * 60);
      const lastAccessMinutes = (now - fileInfo.accessed) / (1000 * 60);
      
      // Clean up files older than 1 hour or not accessed in 30 minutes
      if (ageMinutes > 60 || lastAccessMinutes > 30) {
        expiredFiles.push(filePath);
      }
    }
    
    for (const filePath of expiredFiles) {
      await this.secureDelete(filePath);
    }
    
    return expiredFiles.length;
  }

  getStats() {
    return {
      activeFiles: this.activeFiles.size,
      tempDir: this.tempDir,
      files: Array.from(this.activeFiles.values()).map(info => ({
        originalName: info.originalName,
        size: info.size,
        age: Date.now() - info.created.getTime(),
        practiceId: info.practiceId
      }))
    };
  }
}

module.exports = new SecureFileHandler();
```

### **Step 2: Create File Cleanup Middleware**
```javascript
// backend/middleware/fileCleanup.js
const secureFileHandler = require('../utils/secureFileHandler');

const fileCleanupMiddleware = (req, res, next) => {
  const tempFiles = [];
  
  // Track temp files created during request
  const originalCreateTemp = secureFileHandler.createSecureTemp;
  secureFileHandler.createSecureTemp = async function(...args) {
    const filePath = await originalCreateTemp.apply(this, args);
    tempFiles.push(filePath);
    return filePath;
  };
  
  // Cleanup on response end
  res.on('finish', async () => {
    // Restore original method
    secureFileHandler.createSecureTemp = originalCreateTemp;
    
    // Clean up temp files created during this request
    for (const filePath of tempFiles) {
      await secureFileHandler.secureDelete(filePath);
    }
  });
  
  // Cleanup on error
  res.on('error', async () => {
    secureFileHandler.createSecureTemp = originalCreateTemp;
    for (const filePath of tempFiles) {
      await secureFileHandler.secureDelete(filePath);
    }
  });
  
  next();
};

// Background cleanup job
const startCleanupJob = () => {
  setInterval(async () => {
    const cleaned = await secureFileHandler.cleanupExpired();
    if (cleaned > 0) {
      console.log(`🗑️ Cleaned up ${cleaned} expired temp files`);
    }
  }, 10 * 60 * 1000); // Every 10 minutes
};

module.exports = {
  fileCleanupMiddleware,
  startCleanupJob
};
```

### **Step 3: Update Document Upload Route**
```javascript
// In backend/routes/documents.js
const secureFileHandler = require('../utils/secureFileHandler');
const { fileCleanupMiddleware } = require('../middleware/fileCleanup');

// Apply cleanup middleware to all routes
router.use(fileCleanupMiddleware);

router.post('/upload/:patientId', upload.single('document'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    // Create secure temporary file
    tempFilePath = await secureFileHandler.createSecureTemp(
      req.file.buffer,
      req.practice._id.toString(),
      req.file.originalname,
      req.user._id.toString()
    );
    
    // Process document with secure temp file
    const analysis = await documentAnalysisService.analyzeDocument(
      tempFilePath,
      req.practice._id,
      req.user._id
    );
    
    // Save final document (encrypted)
    const document = await saveEncryptedDocument({
      patientId: req.params.patientId,
      practiceId: req.practice._id,
      userId: req.user._id,
      originalFile: req.file,
      analysis
    });
    
    res.json({
      success: true,
      documentId: document._id,
      analysis
    });
    
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  } finally {
    // Ensure temp file is cleaned up
    if (tempFilePath) {
      await secureFileHandler.secureDelete(tempFilePath);
    }
  }
});
```

### **Step 4: Update Document Analysis Service**
```javascript
// In backend/services/documentAnalysisService.js
const secureFileHandler = require('../utils/secureFileHandler');

class DocumentAnalysisService {
  async analyzeDocument(tempFilePath, practiceId, userId) {
    let ocrTempFile = null;
    
    try {
      // Read secure temp file
      const buffer = await secureFileHandler.readSecureTemp(
        tempFilePath, 
        practiceId.toString(), 
        userId.toString()
      );
      
      // Create OCR temp file if needed
      if (this.requiresOCR(buffer)) {
        ocrTempFile = await secureFileHandler.createSecureTemp(
          buffer,
          practiceId.toString(),
          'ocr_temp.pdf',
          userId.toString()
        );
        
        // Perform OCR with secure temp file
        const ocrResult = await this.performSecureOCR(ocrTempFile, practiceId, userId);
        
        // Analyze OCR results
        const analysis = await this.analyzeOCRResults(ocrResult);
        
        return analysis;
      } else {
        // Direct analysis without OCR
        return await this.analyzeBuffer(buffer);
      }
      
    } finally {
      // Always cleanup OCR temp file
      if (ocrTempFile) {
        await secureFileHandler.secureDelete(ocrTempFile);
      }
    }
  }

  async performSecureOCR(tempFilePath, practiceId, userId) {
    // Verify access before OCR
    const buffer = await secureFileHandler.readSecureTemp(tempFilePath, practiceId, userId);
    
    // Perform OCR operations with security checks
    // ... OCR logic
  }
}
```

### **Step 5: Process Monitoring**
```javascript
// Add to server.js
const { startCleanupJob } = require('./middleware/fileCleanup');
const secureFileHandler = require('./utils/secureFileHandler');

// Start cleanup job
startCleanupJob();

// Graceful shutdown cleanup
process.on('SIGINT', async () => {
  console.log('Performing secure cleanup before shutdown...');
  const stats = secureFileHandler.getStats();
  console.log(`Cleaning up ${stats.activeFiles} active temp files`);
  
  await secureFileHandler.cleanupExpired();
  process.exit(0);
});

// Health check endpoint
app.get('/health/temp-files', (req, res) => {
  const stats = secureFileHandler.getStats();
  res.json({
    status: 'ok',
    tempFiles: stats
  });
});
```

## 🧪 **Testing**
1. **Upload document:** Check temp files created/cleaned
2. **Process crash:** Verify files cleaned on restart
3. **Unauthorized access:** Confirm access denied
4. **Cleanup job:** Test expired file removal

## ✅ **Success Criteria**
- [ ] All temp files encrypted/secure
- [ ] Automatic cleanup working
- [ ] Unauthorized access blocked
- [ ] Secure deletion implemented
- [ ] Process crash recovery
- [ ] Memory usage stable

## 🔄 **Next Task**
Proceed to: **Task 0.5:** Add Document Access Control

## 📝 **Security Notes**
- Use secure deletion (multiple overwrites)
- Monitor disk usage
- Set strict file permissions (600)
- Clean up on process signals