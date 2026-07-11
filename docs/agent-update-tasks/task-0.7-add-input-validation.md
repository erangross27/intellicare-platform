# Task 0.7: Add Input Validation

## 🚨 **CRITICAL SECURITY TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 25 minutes  
**Risk Level:** HIGH  
**Priority:** URGENT  

Add comprehensive input validation and sanitization to prevent injection attacks, data corruption, and security vulnerabilities.

## 🎯 **Objective**
Implement robust input validation that:
- Prevents injection attacks (SQL, NoSQL, XSS)
- Validates all user inputs before processing
- Sanitizes data to prevent corruption
- Provides clear validation error messages

## 🚨 **Security Risk**
**HIGH:** Missing input validation allows injection attacks and data corruption.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add comprehensive input validation middleware and functions**

## 🔍 **Current Validation Gaps**

### **Gap 1: No Input Sanitization**
```javascript
// CURRENT - NO SANITIZATION
const { message, sessionId, language } = req.body;
// ❌ Direct use without validation/sanitization
const result = await agent.processChatMessage(message, sessionId, language, practiceContext);
```

### **Gap 2: No File Upload Validation**
```javascript
// CURRENT - NO FILE VALIDATION
const { files, patientName } = req.body;
// ❌ No validation of file types, sizes, names
// ❌ No sanitization of patient names
```

### **Gap 3: No Parameter Validation**
```javascript
// CURRENT - NO PARAMETER VALIDATION
const { patientName, documentIds } = req.body;
// ❌ No validation of array contents
// ❌ No sanitization of names
```

## ✅ **Comprehensive Input Validation System**

### **1. Input Validation Middleware**
```javascript
// ADD at top of file after imports:
const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');

// Input validation schemas
const VALIDATION_SCHEMAS = {
  chat: {
    message: {
      required: true,
      type: 'string',
      maxLength: 5000,
      minLength: 1,
      sanitize: true
    },
    sessionId: {
      required: false,
      type: 'string',
      maxLength: 100,
      pattern: /^[a-zA-Z0-9_-]+$/,
      default: 'default'
    },
    language: {
      required: false,
      type: 'string',
      enum: ['he', 'en'],
      default: 'he'
    }
  },
  
  voiceCommand: {
    audioData: {
      required: true,
      type: 'string',
      maxLength: 10000000, // 10MB base64
      minLength: 100
    },
    language: {
      required: false,
      type: 'string',
      enum: ['he', 'en'],
      default: 'he'
    }
  },
  
  uploadDocument: {
    files: {
      required: true,
      type: 'array',
      maxItems: 10,
      minItems: 1
    },
    patientName: {
      required: true,
      type: 'string',
      maxLength: 200,
      minLength: 2,
      sanitize: true,
      pattern: /^[a-zA-Zא-ת\s\-'\.]+$/
    }
  },
  
  analyzeDocument: {
    patientName: {
      required: true,
      type: 'string',
      maxLength: 200,
      minLength: 2,
      sanitize: true,
      pattern: /^[a-zA-Zא-ת\s\-'\.]+$/
    },
    documentIds: {
      required: true,
      type: 'array',
      maxItems: 20,
      minItems: 1,
      itemType: 'mongoId'
    }
  },
  
  processUpload: {
    uploadId: {
      required: true,
      type: 'string',
      maxLength: 100,
      pattern: /^[a-zA-Z0-9_-]+$/
    },
    patientName: {
      required: true,
      type: 'string',
      maxLength: 200,
      minLength: 2,
      sanitize: true,
      pattern: /^[a-zA-Zא-ת\s\-'\.]+$/
    }
  }
};
```

### **2. Validation Helper Functions**
```javascript
// ADD: Validation helper functions
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  
  // Remove potential XSS
  let sanitized = DOMPurify.sanitize(str);
  
  // Remove potential NoSQL injection patterns
  sanitized = sanitized.replace(/[\$\{\}]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
};

const validateMongoId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

const validateInput = (data, schema) => {
  const errors = [];
  const sanitized = {};
  
  // Check required fields
  Object.keys(schema).forEach(field => {
    const rules = schema[field];
    const value = data[field];
    
    // Check required
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: field,
        message: `${field} is required`,
        code: 'REQUIRED_FIELD_MISSING'
      });
      return;
    }
    
    // Use default if not provided
    if (value === undefined && rules.default !== undefined) {
      sanitized[field] = rules.default;
      return;
    }
    
    // Skip validation if not provided and not required
    if (value === undefined || value === null) {
      return;
    }
    
    // Type validation
    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push({
        field: field,
        message: `${field} must be a string`,
        code: 'INVALID_TYPE'
      });
      return;
    }
    
    if (rules.type === 'array' && !Array.isArray(value)) {
      errors.push({
        field: field,
        message: `${field} must be an array`,
        code: 'INVALID_TYPE'
      });
      return;
    }
    
    // String validations
    if (rules.type === 'string') {
      // Length validation
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({
          field: field,
          message: `${field} must be at most ${rules.maxLength} characters`,
          code: 'TOO_LONG'
        });
        return;
      }
      
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({
          field: field,
          message: `${field} must be at least ${rules.minLength} characters`,
          code: 'TOO_SHORT'
        });
        return;
      }
      
      // Pattern validation
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push({
          field: field,
          message: `${field} has invalid format`,
          code: 'INVALID_FORMAT'
        });
        return;
      }
      
      // Enum validation
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({
          field: field,
          message: `${field} must be one of: ${rules.enum.join(', ')}`,
          code: 'INVALID_VALUE'
        });
        return;
      }
      
      // Sanitize if required
      sanitized[field] = rules.sanitize ? sanitizeString(value) : value;
    }
    
    // Array validations
    if (rules.type === 'array') {
      if (rules.maxItems && value.length > rules.maxItems) {
        errors.push({
          field: field,
          message: `${field} must have at most ${rules.maxItems} items`,
          code: 'TOO_MANY_ITEMS'
        });
        return;
      }
      
      if (rules.minItems && value.length < rules.minItems) {
        errors.push({
          field: field,
          message: `${field} must have at least ${rules.minItems} items`,
          code: 'TOO_FEW_ITEMS'
        });
        return;
      }
      
      // Validate array items
      if (rules.itemType === 'mongoId') {
        const invalidIds = value.filter(id => !validateMongoId(id));
        if (invalidIds.length > 0) {
          errors.push({
            field: field,
            message: `${field} contains invalid IDs`,
            code: 'INVALID_ID_FORMAT',
            invalidIds: invalidIds
          });
          return;
        }
      }
      
      sanitized[field] = value;
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    sanitized: sanitized
  };
};
```

### **3. Route-Specific Validation Middleware**
```javascript
// ADD: Route-specific validation middleware
const validateChatInput = (req, res, next) => {
  const validation = validateInput(req.body, VALIDATION_SCHEMAS.chat);
  
  if (!validation.isValid) {
    const errorMessages = validation.errors.map(err => err.message);
    return sendLocalizedError(res, req.country, 'INVALID_INPUT', {
      details: errorMessages.join(', ')
    }, 400);
  }
  
  // Replace body with sanitized data
  req.body = { ...req.body, ...validation.sanitized };
  next();
};

const validateVoiceInput = (req, res, next) => {
  const validation = validateInput(req.body, VALIDATION_SCHEMAS.voiceCommand);
  
  if (!validation.isValid) {
    const errorMessages = validation.errors.map(err => err.message);
    return sendLocalizedError(res, req.country, 'INVALID_INPUT', {
      details: errorMessages.join(', ')
    }, 400);
  }
  
  req.body = { ...req.body, ...validation.sanitized };
  next();
};

const validateUploadInput = (req, res, next) => {
  const validation = validateInput(req.body, VALIDATION_SCHEMAS.uploadDocument);
  
  if (!validation.isValid) {
    const errorMessages = validation.errors.map(err => err.message);
    return sendLocalizedError(res, req.country, 'INVALID_INPUT', {
      details: errorMessages.join(', ')
    }, 400);
  }
  
  // Additional file validation
  const { files } = req.body;
  const fileErrors = [];
  
  files.forEach((file, index) => {
    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      fileErrors.push(`File ${index + 1} is too large (max 50MB)`);
    }
    
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      fileErrors.push(`File ${index + 1} has unsupported type: ${file.type}`);
    }
    
    // Validate filename
    if (!/^[a-zA-Z0-9\s\-_\.()]+$/.test(file.originalName)) {
      fileErrors.push(`File ${index + 1} has invalid filename`);
    }
  });
  
  if (fileErrors.length > 0) {
    return sendLocalizedError(res, req.country, 'INVALID_FILE', {
      details: fileErrors.join(', ')
    }, 400);
  }
  
  req.body = { ...req.body, ...validation.sanitized };
  next();
};

const validateAnalysisInput = (req, res, next) => {
  const validation = validateInput(req.body, VALIDATION_SCHEMAS.analyzeDocument);
  
  if (!validation.isValid) {
    const errorMessages = validation.errors.map(err => err.message);
    return sendLocalizedError(res, req.country, 'INVALID_INPUT', {
      details: errorMessages.join(', ')
    }, 400);
  }
  
  req.body = { ...req.body, ...validation.sanitized };
  next();
};

const validateProcessUploadInput = (req, res, next) => {
  const validation = validateInput(req.body, VALIDATION_SCHEMAS.processUpload);
  
  if (!validation.isValid) {
    const errorMessages = validation.errors.map(err => err.message);
    return sendLocalizedError(res, req.country, 'INVALID_INPUT', {
      details: errorMessages.join(', ')
    }, 400);
  }
  
  req.body = { ...req.body, ...validation.sanitized };
  next();
};
```

### **4. Apply Validation to Routes**
```javascript
// BEFORE - No validation:
router.post('/chat', ..., async (req, res) => {...});

// AFTER - With validation:
router.post('/chat',
  generalRateLimit,
  aiRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  validateChatInput,        // ✅ ADD: Input validation
  async (req, res) => {...}
);

router.post('/voice-command',
  generalRateLimit,
  aiRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  validateVoiceInput,       // ✅ ADD: Input validation
  async (req, res) => {...}
);

router.post('/upload-document',
  generalRateLimit,
  uploadRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  validateUploadInput,      // ✅ ADD: Input validation
  async (req, res) => {...}
);

router.post('/analyze-document',
  generalRateLimit,
  aiRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  validateAnalysisInput,    // ✅ ADD: Input validation
  async (req, res) => {...}
);

router.post('/process-pending-upload',
  generalRateLimit,
  uploadRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  validateProcessUploadInput, // ✅ ADD: Input validation
  async (req, res) => {...}
);
```

### **5. Add Security Headers Middleware**
```javascript
// ADD: Security headers middleware
const addSecurityHeaders = (req, res, next) => {
  // Prevent XSS
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};

// Apply to all routes
router.use(addSecurityHeaders);
```

### **6. Add Request Size Limiting**
```javascript
// ADD: Request size limiting
const express = require('express');

// Limit request size to prevent DoS
router.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Log large requests
    if (buf.length > 1024 * 1024) { // > 1MB
      console.log(`⚠️ Large request: ${buf.length} bytes from ${req.ip}`);
    }
  }
}));

router.use(express.urlencoded({ 
  limit: '10mb', 
  extended: true 
}));
```

## ⚠️ **Security Notes**
- **🚨 CRITICAL:** Input validation prevents injection attacks
- **🚨 CRITICAL:** Sanitization prevents XSS and data corruption
- **🚨 CRITICAL:** File validation prevents malicious uploads
- **❌ DON'T SKIP:** This is essential for data integrity

## 🧪 **Security Testing After Implementation**
1. **Test injection prevention:**
   - Try SQL injection patterns → should be blocked
   - Try NoSQL injection patterns → should be blocked
   - Try XSS patterns → should be sanitized

2. **Test file validation:**
   - Upload oversized files → should be rejected
   - Upload invalid file types → should be rejected
   - Upload files with malicious names → should be rejected

3. **Test input validation:**
   - Send invalid data types → should get validation errors
   - Send oversized strings → should be rejected
   - Send invalid patterns → should be rejected

## ✅ **Success Criteria**
- [ ] All inputs validated before processing
- [ ] XSS and injection patterns blocked
- [ ] File uploads properly validated
- [ ] Security headers added
- [ ] Request size limits enforced
- [ ] Clear validation error messages

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 1.1:** Update addPatientFunction Schema (Phase 1)

## 📝 **CRITICAL NOTES**
- **PREVENTS INJECTION ATTACKS** - validation essential for security
- **BLOCKS MALICIOUS UPLOADS** - file validation critical
- **PROTECTS DATA INTEGRITY** - sanitization prevents corruption
- **TEST THOROUGHLY** - verify all validation rules work
