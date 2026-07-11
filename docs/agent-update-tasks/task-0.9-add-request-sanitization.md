# Task 0.9: Add Request Sanitization

## 🚨 **CRITICAL SECURITY TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 20 minutes  
**Risk Level:** HIGH  
**Priority:** URGENT  

Add comprehensive request sanitization to prevent path traversal attacks, filename injection, and other security vulnerabilities from malicious user inputs.

## 🎯 **Objective**
Implement request sanitization that:
- Sanitizes filenames to prevent path traversal
- Cleans user inputs to prevent injection attacks
- Validates and sanitizes file uploads
- Protects against malicious payloads

## 🚨 **Security Risk**
**HIGH:** Unsanitized inputs allow path traversal, filename injection, and other attack vectors.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add comprehensive sanitization functions and middleware**

## 🔍 **Current Sanitization Gaps**

### **Gap 1: Filename Path Traversal**
```javascript
// CURRENT - PATH TRAVERSAL VULNERABILITY
const { files, patientName } = req.body;
files.forEach(file => {
  // ❌ DANGEROUS: filename could contain "../../../etc/passwd"
  const filename = file.originalName;
  // ❌ No sanitization before use
});
```

### **Gap 2: Patient Name Injection**
```javascript
// CURRENT - INJECTION VULNERABILITY
const { patientName } = req.body;
// ❌ DANGEROUS: patientName could contain malicious scripts
const patient = await Patient.findOne({
  name: new RegExp(patientName, 'i') // ❌ Direct use in regex
});
```

### **Gap 3: Upload ID Injection**
```javascript
// CURRENT - INJECTION VULNERABILITY
const { uploadId } = req.body;
// ❌ DANGEROUS: uploadId could contain malicious characters
const pendingUpload = await PendingUpload.findOne({ uploadId });
```

## ✅ **Comprehensive Sanitization System**

### **1. Filename Sanitization Functions**
```javascript
// ADD at top of file after imports:
const path = require('path');

const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed_file';
  }
  
  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\./g, '');
  
  // Remove path separators
  sanitized = sanitized.replace(/[\/\\]/g, '_');
  
  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, '');
  
  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '_');
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext);
    sanitized = name.substring(0, 255 - ext.length) + ext;
  }
  
  // Ensure not empty
  if (!sanitized || sanitized.trim() === '') {
    sanitized = 'unnamed_file';
  }
  
  return sanitized;
};

const validateFileExtension = (filename, allowedExtensions = []) => {
  const ext = path.extname(filename).toLowerCase();
  
  const defaultAllowed = [
    '.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif',
    '.txt', '.doc', '.docx', '.rtf'
  ];
  
  const allowed = allowedExtensions.length > 0 ? allowedExtensions : defaultAllowed;
  
  return allowed.includes(ext);
};

const sanitizeAndValidateFilename = (filename, allowedExtensions = []) => {
  const sanitized = sanitizeFilename(filename);
  const isValidExtension = validateFileExtension(sanitized, allowedExtensions);
  
  return {
    sanitized: sanitized,
    isValid: isValidExtension,
    originalExtension: path.extname(filename).toLowerCase(),
    sanitizedExtension: path.extname(sanitized).toLowerCase()
  };
};
```

### **2. Text Input Sanitization**
```javascript
// ADD: Text sanitization functions
const sanitizeTextInput = (input, options = {}) => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  let sanitized = input;
  
  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Remove potential script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove potential SQL injection patterns
  sanitized = sanitized.replace(/['";\\]/g, '');
  
  // Remove potential NoSQL injection patterns
  sanitized = sanitized.replace(/[\$\{\}]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length if specified
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }
  
  // Validate against pattern if specified
  if (options.pattern && !options.pattern.test(sanitized)) {
    throw new Error(`Input does not match required pattern: ${options.pattern}`);
  }
  
  return sanitized;
};

const sanitizePatientName = (name) => {
  return sanitizeTextInput(name, {
    maxLength: 200,
    pattern: /^[a-zA-Zא-ת\s\-'\.]+$/
  });
};

const sanitizeUploadId = (uploadId) => {
  return sanitizeTextInput(uploadId, {
    maxLength: 100,
    pattern: /^[a-zA-Z0-9_-]+$/
  });
};

const sanitizeSessionId = (sessionId) => {
  return sanitizeTextInput(sessionId, {
    maxLength: 100,
    pattern: /^[a-zA-Z0-9_-]+$/
  });
};
```

### **3. File Upload Sanitization Middleware**
```javascript
// ADD: File upload sanitization middleware
const sanitizeFileUploads = (req, res, next) => {
  try {
    if (!req.body.files || !Array.isArray(req.body.files)) {
      return next();
    }
    
    const sanitizedFiles = [];
    const errors = [];
    
    req.body.files.forEach((file, index) => {
      try {
        // Sanitize filename
        const filenameResult = sanitizeAndValidateFilename(file.originalName);
        
        if (!filenameResult.isValid) {
          errors.push(`File ${index + 1}: Invalid file type (${filenameResult.originalExtension})`);
          return;
        }
        
        // Validate file size (max 50MB)
        if (file.size > 50 * 1024 * 1024) {
          errors.push(`File ${index + 1}: File too large (max 50MB)`);
          return;
        }
        
        // Validate MIME type
        const allowedMimeTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/tiff',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (!allowedMimeTypes.includes(file.type)) {
          errors.push(`File ${index + 1}: Invalid MIME type (${file.type})`);
          return;
        }
        
        // Create sanitized file object
        const sanitizedFile = {
          ...file,
          originalName: filenameResult.sanitized,
          sanitizedName: filenameResult.sanitized,
          isNameSanitized: file.originalName !== filenameResult.sanitized
        };
        
        sanitizedFiles.push(sanitizedFile);
        
        // Log sanitization if filename was changed
        if (sanitizedFile.isNameSanitized) {
          auditLog(req, 'FILENAME_SANITIZED', {
            originalName: file.originalName,
            sanitizedName: filenameResult.sanitized,
            fileIndex: index
          });
        }
        
      } catch (error) {
        errors.push(`File ${index + 1}: Sanitization error - ${error.message}`);
      }
    });
    
    if (errors.length > 0) {
      return sendLocalizedError(res, req.country, 'INVALID_FILE', {
        details: errors.join(', ')
      }, 400);
    }
    
    // Replace files with sanitized versions
    req.body.files = sanitizedFiles;
    
    // Log successful sanitization
    auditLog(req, 'FILES_SANITIZED', {
      fileCount: sanitizedFiles.length,
      sanitizedCount: sanitizedFiles.filter(f => f.isNameSanitized).length
    });
    
    next();
  } catch (error) {
    console.error('❌ File sanitization error:', error);
    return sendLocalizedError(res, req.country, 'FILE_SANITIZATION_ERROR', {}, 500);
  }
};
```

### **4. Request Body Sanitization Middleware**
```javascript
// ADD: Request body sanitization middleware
const sanitizeRequestBody = (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }
    
    const sanitizedBody = { ...req.body };
    const sanitizationLog = [];
    
    // Sanitize common fields
    if (sanitizedBody.patientName) {
      const original = sanitizedBody.patientName;
      sanitizedBody.patientName = sanitizePatientName(original);
      
      if (original !== sanitizedBody.patientName) {
        sanitizationLog.push({
          field: 'patientName',
          original: original,
          sanitized: sanitizedBody.patientName
        });
      }
    }
    
    if (sanitizedBody.uploadId) {
      const original = sanitizedBody.uploadId;
      sanitizedBody.uploadId = sanitizeUploadId(original);
      
      if (original !== sanitizedBody.uploadId) {
        sanitizationLog.push({
          field: 'uploadId',
          original: original,
          sanitized: sanitizedBody.uploadId
        });
      }
    }
    
    if (sanitizedBody.sessionId) {
      const original = sanitizedBody.sessionId;
      sanitizedBody.sessionId = sanitizeSessionId(original);
      
      if (original !== sanitizedBody.sessionId) {
        sanitizationLog.push({
          field: 'sessionId',
          original: original,
          sanitized: sanitizedBody.sessionId
        });
      }
    }
    
    if (sanitizedBody.message) {
      const original = sanitizedBody.message;
      sanitizedBody.message = sanitizeTextInput(original, { maxLength: 5000 });
      
      if (original !== sanitizedBody.message) {
        sanitizationLog.push({
          field: 'message',
          original: original.substring(0, 100) + '...',
          sanitized: sanitizedBody.message.substring(0, 100) + '...'
        });
      }
    }
    
    // Log sanitization if any occurred
    if (sanitizationLog.length > 0) {
      auditLog(req, 'REQUEST_BODY_SANITIZED', {
        sanitizedFields: sanitizationLog.map(s => s.field),
        sanitizationCount: sanitizationLog.length
      });
    }
    
    // Replace request body with sanitized version
    req.body = sanitizedBody;
    req.sanitizationLog = sanitizationLog;
    
    next();
  } catch (error) {
    console.error('❌ Request body sanitization error:', error);
    return sendLocalizedError(res, req.country, 'REQUEST_SANITIZATION_ERROR', {}, 500);
  }
};
```

### **5. Header Sanitization Middleware**
```javascript
// ADD: Header sanitization middleware
const sanitizeHeaders = (req, res, next) => {
  try {
    // Sanitize session ID from headers
    if (req.headers['x-session-id']) {
      const original = req.headers['x-session-id'];
      const sanitized = sanitizeSessionId(original);
      
      if (original !== sanitized) {
        auditLog(req, 'HEADER_SANITIZED', {
          header: 'x-session-id',
          original: original,
          sanitized: sanitized
        });
        
        req.headers['x-session-id'] = sanitized;
      }
    }
    
    // Sanitize other custom headers if needed
    const customHeaders = ['x-upload-id', 'x-patient-id'];
    
    customHeaders.forEach(headerName => {
      if (req.headers[headerName]) {
        const original = req.headers[headerName];
        const sanitized = sanitizeTextInput(original, { maxLength: 100 });
        
        if (original !== sanitized) {
          auditLog(req, 'HEADER_SANITIZED', {
            header: headerName,
            original: original,
            sanitized: sanitized
          });
          
          req.headers[headerName] = sanitized;
        }
      }
    });
    
    next();
  } catch (error) {
    console.error('❌ Header sanitization error:', error);
    return sendLocalizedError(res, req.country, 'HEADER_SANITIZATION_ERROR', {}, 500);
  }
};
```

### **6. Apply Sanitization to Routes**
```javascript
// BEFORE - No sanitization:
router.post('/upload-document', ..., async (req, res) => {...});

// AFTER - With comprehensive sanitization:
router.post('/upload-document',
  generalRateLimit,
  uploadRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  sanitizeHeaders,          // ✅ ADD: Header sanitization
  sanitizeRequestBody,      // ✅ ADD: Body sanitization
  sanitizeFileUploads,      // ✅ ADD: File sanitization
  validateUploadInput,      // Existing validation
  async (req, res) => {...}
);

router.post('/process-pending-upload',
  generalRateLimit,
  uploadRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  sanitizeHeaders,          // ✅ ADD: Header sanitization
  sanitizeRequestBody,      // ✅ ADD: Body sanitization
  validateProcessUploadInput, // Existing validation
  async (req, res) => {...}
);

router.post('/chat',
  generalRateLimit,
  aiRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  sanitizeHeaders,          // ✅ ADD: Header sanitization
  sanitizeRequestBody,      // ✅ ADD: Body sanitization
  validateChatInput,        // Existing validation
  async (req, res) => {...}
);
```

### **7. Add Sanitization Monitoring**
```javascript
// ADD: Sanitization monitoring function
const logSanitizationStats = (req, res, next) => {
  const originalEnd = res.end;
  
  res.end = function(...args) {
    // Log sanitization statistics
    if (req.sanitizationLog && req.sanitizationLog.length > 0) {
      console.log(`🧹 Sanitization applied to ${req.sanitizationLog.length} fields for ${req.path}`);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// Apply to all routes
router.use(logSanitizationStats);
```

## ⚠️ **Security Notes**
- **🚨 CRITICAL:** Sanitization prevents path traversal attacks
- **🚨 CRITICAL:** Filename sanitization prevents file system attacks
- **🚨 CRITICAL:** Input sanitization prevents injection attacks
- **❌ DON'T SKIP:** This is essential for file upload security

## 🧪 **Security Testing After Implementation**
1. **Test filename sanitization:**
   - Upload file with "../../../etc/passwd" name → should be sanitized
   - Upload file with script tags in name → should be cleaned

2. **Test input sanitization:**
   - Send patient name with SQL injection → should be sanitized
   - Send message with XSS payload → should be cleaned

3. **Test path traversal prevention:**
   - Try various path traversal patterns → should be blocked

## ✅ **Success Criteria**
- [ ] All filenames sanitized before use
- [ ] All text inputs cleaned and validated
- [ ] Path traversal attempts blocked
- [ ] File uploads properly sanitized
- [ ] Headers sanitized for security
- [ ] Sanitization logging working

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 0.10:** Prevent Memory Leaks

## 📝 **CRITICAL NOTES**
- **PREVENTS PATH TRAVERSAL** - critical for file system security
- **BLOCKS INJECTION ATTACKS** - essential for data integrity
- **PROTECTS FILE UPLOADS** - important for system security
- **TEST THOROUGHLY** - verify all sanitization works correctly
