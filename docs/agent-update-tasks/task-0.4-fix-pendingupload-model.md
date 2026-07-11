# Task 0.4: Fix PendingUpload Model

## 🚨 **CRITICAL SECURITY TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 20 minutes  
**Risk Level:** HIGH  
**Priority:** URGENT  

Fix the PendingUpload model to ensure proper practice isolation and prevent cross-practice access to upload data.

## 🎯 **Objective**
Fix PendingUpload model usage to:
- Store practice context in pending uploads
- Filter queries by practice to prevent cross-practice access
- Add proper expiration and cleanup
- Ensure upload isolation between practices

## 🚨 **Security Risk**
**HIGH:** Current PendingUpload model allows one practice to potentially access another practice's pending uploads.

## 📁 **Files to Modify**
**Primary:** `backend/routes/agent.js`  
**Secondary:** `backend/models/PendingUpload.js` (if schema changes needed)

## 🔍 **Current Security Issues**

### **Issue 1: Missing Practice Context in Upload Creation**
```javascript
// CURRENT - NO PRACTICE ISOLATION
const pendingUpload = new PendingUpload({
  uploadId,
  userId,
  files: encryptedFiles,
  status: 'pending'
  // ❌ Missing: practiceId, practiceSubdomain
});
```

### **Issue 2: No Practice Filtering in Queries**
```javascript
// CURRENT - CROSS-PRACTICE ACCESS POSSIBLE
const pendingUpload = await PendingUpload.findOne({
  uploadId,
  status: 'pending'
  // ❌ Missing: practice filter
});
```

### **Issue 3: No Expiration Cleanup**
```javascript
// CURRENT - NO CLEANUP
// ❌ Old pending uploads never cleaned up
// ❌ Could accumulate indefinitely
```

## ✅ **Required Fixes**

### **1. Update Upload Creation (in /upload-document route)**
```javascript
// BEFORE - Missing practice context:
const pendingUpload = new PendingUpload({
  uploadId,
  userId,
  files: encryptedFiles,
  status: 'pending'
});

// AFTER - With practice isolation:
const PendingUpload = req.models.PendingUpload; // ✅ Use practice-specific model

const pendingUpload = new PendingUpload({
  uploadId,
  userId,
  practiceId: req.practice._id,                    // ✅ ADD: Practice ID
  practiceSubdomain: req.practiceSubdomain,        // ✅ ADD: Practice subdomain
  files: encryptedFiles,
  status: 'pending',
  createdAt: new Date(),                       // ✅ ADD: Creation timestamp
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // ✅ ADD: 24h expiration
});
```

### **2. Update Upload Query (in /process-pending-upload route)**
```javascript
// BEFORE - No practice filtering:
const pendingUpload = await PendingUpload.findOne({
  uploadId,
  status: 'pending'
});

// AFTER - With practice isolation:
const PendingUpload = req.models.PendingUpload; // ✅ Use practice-specific model

const pendingUpload = await PendingUpload.findOne({
  uploadId,
  practiceId: req.practice._id,                    // ✅ ADD: Practice filter
  practiceSubdomain: req.practiceSubdomain,        // ✅ ADD: Subdomain filter
  status: 'pending',
  expiresAt: { $gt: new Date() }               // ✅ ADD: Not expired
});

if (!pendingUpload) {
  // ✅ ADD: Better error handling
  await auditLog(req, 'PENDING_UPLOAD_NOT_FOUND', {
    uploadId: uploadId,
    reason: 'Not found or expired'
  });
  
  return res.status(404).json({
    success: false,
    message: 'Upload not found or has expired'
  });
}

// ✅ ADD: Verify practice ownership (extra security)
if (pendingUpload.practiceId.toString() !== req.practice._id.toString()) {
  await auditLog(req, 'PENDING_UPLOAD_ACCESS_DENIED', {
    uploadId: uploadId,
    attemptedClinic: req.practice._id,
    actualClinic: pendingUpload.practiceId
  });
  
  return res.status(403).json({
    success: false,
    message: 'Access denied: Upload belongs to different practice'
  });
}
```

### **3. Add Cleanup Function**
```javascript
// ADD: Cleanup expired uploads function
const cleanupExpiredUploads = async (req) => {
  try {
    const PendingUpload = req.models.PendingUpload;
    
    const expiredUploads = await PendingUpload.find({
      practiceId: req.practice._id,
      expiresAt: { $lt: new Date() },
      status: 'pending'
    });
    
    if (expiredUploads.length > 0) {
      // Log cleanup
      await auditLog(req, 'PENDING_UPLOADS_CLEANUP', {
        expiredCount: expiredUploads.length,
        uploadIds: expiredUploads.map(u => u.uploadId)
      });
      
      // Delete expired uploads
      await PendingUpload.deleteMany({
        practiceId: req.practice._id,
        expiresAt: { $lt: new Date() },
        status: 'pending'
      });
      
      console.log(`🧹 Cleaned up ${expiredUploads.length} expired uploads for practice ${req.practiceSubdomain}`);
    }
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    // Don't fail the request if cleanup fails
  }
};
```

### **4. Update Upload Status Tracking**
```javascript
// ADD: Better status tracking in /process-pending-upload

// Mark as processing
await PendingUpload.updateOne(
  { 
    uploadId,
    practiceId: req.practice._id 
  },
  { 
    status: 'processing',
    processingStartedAt: new Date(),
    processingBy: req.user._id
  }
);

// ... process files ...

// Mark as completed or failed
const finalStatus = successCount === pendingUpload.files.length ? 'completed' : 'partial';

await PendingUpload.updateOne(
  { 
    uploadId,
    practiceId: req.practice._id 
  },
  { 
    status: finalStatus,
    completedAt: new Date(),
    processedFileCount: successCount,
    totalFileCount: pendingUpload.files.length,
    results: results
  }
);

// ✅ ADD: Audit log completion
await auditLog(req, 'PENDING_UPLOAD_PROCESSED', {
  uploadId: uploadId,
  status: finalStatus,
  processedFiles: successCount,
  totalFiles: pendingUpload.files.length
});
```

### **5. Add Upload Validation**
```javascript
// ADD: Upload validation function
const validateUploadRequest = async (req, res, next) => {
  try {
    const { uploadId } = req.body;
    
    if (!uploadId) {
      return res.status(400).json({
        success: false,
        message: 'Upload ID is required'
      });
    }
    
    // Check if upload ID format is valid
    if (!/^[a-zA-Z0-9_-]+$/.test(uploadId)) {
      await auditLog(req, 'INVALID_UPLOAD_ID', {
        uploadId: uploadId,
        reason: 'Invalid format'
      });
      
      return res.status(400).json({
        success: false,
        message: 'Invalid upload ID format'
      });
    }
    
    // Run cleanup before processing
    await cleanupExpiredUploads(req);
    
    next();
  } catch (error) {
    console.error('❌ Upload validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload validation failed'
    });
  }
};
```

### **6. Update Route with Validation**
```javascript
// BEFORE:
router.post('/process-pending-upload', 
  practiceAuth, 
  async (req, res) => {...}
);

// AFTER:
router.post('/process-pending-upload',
  generalRateLimit,
  uploadRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  validateUploadRequest,  // ✅ ADD: Upload validation
  async (req, res) => {...}
);
```

### **7. Add Upload Monitoring**
```javascript
// ADD: Upload monitoring function
const getUploadStatus = async (req, res) => {
  try {
    const { uploadId } = req.params;
    const PendingUpload = req.models.PendingUpload;
    
    const upload = await PendingUpload.findOne({
      uploadId,
      practiceId: req.practice._id,
      practiceSubdomain: req.practiceSubdomain
    });
    
    if (!upload) {
      return res.status(404).json({
        success: false,
        message: 'Upload not found'
      });
    }
    
    // ✅ ADD: Log status check
    await auditLog(req, 'UPLOAD_STATUS_CHECKED', {
      uploadId: uploadId,
      status: upload.status
    });
    
    res.json({
      success: true,
      data: {
        uploadId: upload.uploadId,
        status: upload.status,
        fileCount: upload.files?.length || 0,
        processedCount: upload.processedFileCount || 0,
        createdAt: upload.createdAt,
        expiresAt: upload.expiresAt,
        isExpired: upload.expiresAt < new Date()
      }
    });
  } catch (error) {
    console.error('❌ Get upload status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upload status'
    });
  }
};

// ADD route for upload status
router.get('/upload-status/:uploadId',
  generalRateLimit,
  practiceAuth,
  requireAuth,
  getUploadStatus
);
```

## ⚠️ **Security Notes**
- **🚨 CRITICAL:** Practice isolation prevents cross-practice access
- **🚨 CRITICAL:** Expiration prevents indefinite data accumulation
- **🚨 CRITICAL:** Status tracking enables monitoring
- **❌ DON'T SKIP:** This prevents data leakage between practices

## 🧪 **Security Testing After Implementation**
1. **Test practice isolation:**
   - Create upload in Practice A
   - Try to access from Practice B → should fail

2. **Test expiration:**
   - Create upload with past expiration
   - Try to process → should fail as expired

3. **Test cleanup:**
   - Create expired uploads
   - Run cleanup → should remove expired uploads

## ✅ **Success Criteria**
- [ ] Practice context stored in all uploads
- [ ] Queries filtered by practice
- [ ] Expiration and cleanup working
- [ ] Status tracking implemented
- [ ] Cross-practice access blocked
- [ ] Audit logging for all operations

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 0.5:** Implement Error Localization

## 📝 **CRITICAL NOTES**
- **PREVENTS DATA LEAKAGE** - practice isolation essential
- **PREVENTS ACCUMULATION** - expiration cleanup required
- **ENABLES MONITORING** - status tracking important
- **TEST THOROUGHLY** - verify practice isolation works
