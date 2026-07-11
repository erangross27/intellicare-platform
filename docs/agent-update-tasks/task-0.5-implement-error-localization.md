# Task 0.5: Implement Error Localization

## 🚨 **CRITICAL USABILITY TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 25 minutes  
**Risk Level:** MEDIUM  
**Priority:** HIGH  

Implement centralized error message localization system to provide proper Hebrew/English error messages based on practice country.

## 🎯 **Objective**
Create a comprehensive error localization system that:
- Provides localized error messages for all operations
- Supports Israeli (Hebrew) and US (English) practices
- Centralizes error message management
- Ensures consistent user experience

## 🚨 **Usability Risk**
**HIGH:** Users receiving error messages in wrong language creates confusion and poor user experience.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add centralized error localization system**

## 🔍 **Current Localization Issues**

### **Issue 1: Hardcoded English Errors**
```javascript
// CURRENT - HARDCODED ENGLISH
return res.status(404).json({
  success: false,
  message: 'Upload not found or has expired' // ❌ Always English
});
```

### **Issue 2: No Consistent Error Format**
```javascript
// CURRENT - INCONSISTENT FORMATS
res.json({ success: false, message: 'Error 1' });
res.json({ success: false, error: 'Error 2' });
res.json({ error: 'Error 3' });
```

### **Issue 3: No Context-Aware Messages**
```javascript
// CURRENT - NO CONTEXT
message: 'Patient not found' // ❌ No practice/country context
```

## ✅ **Centralized Error Localization System**

### **1. Error Message Dictionary**
```javascript
// ADD at top of file after imports:
const ERROR_MESSAGES = {
  'Israel': {
    // Authentication & Authorization
    AUTH_REQUIRED: 'נדרשת הזדהות למערכת',
    CLINIC_CONTEXT_REQUIRED: 'נדרש הקשר מרפאה',
    ACCESS_DENIED: 'הגישה נדחתה',
    INVALID_CLINIC_CONTEXT: 'הקשר מרפאה לא תקין',
    
    // Rate Limiting
    TOO_MANY_REQUESTS: 'יותר מדי בקשות. אנא המתן לפני ניסיון נוסף',
    TOO_MANY_AI_REQUESTS: 'יותר מדי בקשות AI. אנא המתן דקה לפני ניסיון נוסף',
    TOO_MANY_UPLOADS: 'יותר מדי העלאות קבצים. אנא המתן לפני העלאה נוספת',
    
    // Patient Operations
    PATIENT_NOT_FOUND: 'המטופל לא נמצא במערכת',
    PATIENT_ACCESS_DENIED: 'הגישה למטופל נדחתה - שייך למרפאה אחרת',
    PATIENT_LOOKUP_FAILED: 'חיפוש המטופל נכשל',
    INVALID_PATIENT_DATA: 'נתוני המטופל לא תקינים',
    
    // Document Operations
    UPLOAD_NOT_FOUND: 'העלאת הקובץ לא נמצאה או פגה תוקפה',
    UPLOAD_EXPIRED: 'תוקף העלאת הקובץ פג',
    UPLOAD_ACCESS_DENIED: 'הגישה להעלאת הקובץ נדחתה',
    DUPLICATE_FILE: 'קובץ בשם "{filename}" כבר קיים עבור המטופל',
    UPLOAD_FAILED: 'העלאת הקובץ נכשלה',
    FILE_TOO_LARGE: 'הקובץ גדול מדי',
    INVALID_FILE_TYPE: 'סוג קובץ לא נתמך',
    
    // AI Operations
    AI_REQUEST_FAILED: 'בקשת AI נכשלה',
    VOICE_PROCESSING_FAILED: 'עיבוד הקול נכשל',
    DOCUMENT_ANALYSIS_FAILED: 'ניתוח המסמך נכשל',
    CHAT_PROCESSING_FAILED: 'עיבוד הצ\'אט נכשל',
    
    // Validation Errors
    REQUIRED_FIELD_MISSING: 'שדה נדרש חסר: {field}',
    INVALID_FORMAT: 'פורמט לא תקין: {field}',
    INVALID_DATE: 'תאריך לא תקין',
    INVALID_EMAIL: 'כתובת מייל לא תקינה',
    INVALID_PHONE: 'מספר טלפון לא תקין',
    INVALID_ID: 'תעודת זהות לא תקינה',
    
    // System Errors
    SYSTEM_ERROR: 'שגיאת מערכת',
    DATABASE_ERROR: 'שגיאת מסד נתונים',
    NETWORK_ERROR: 'שגיאת רשת',
    TIMEOUT_ERROR: 'תם הזמן הקצוב לפעולה',
    UNKNOWN_ERROR: 'שגיאה לא ידועה'
  },
  
  'United States': {
    // Authentication & Authorization
    AUTH_REQUIRED: 'Authentication required',
    CLINIC_CONTEXT_REQUIRED: 'Practice context required',
    ACCESS_DENIED: 'Access denied',
    INVALID_CLINIC_CONTEXT: 'Invalid practice context',
    
    // Rate Limiting
    TOO_MANY_REQUESTS: 'Too many requests. Please wait before trying again',
    TOO_MANY_AI_REQUESTS: 'Too many AI requests. Please wait a minute before trying again',
    TOO_MANY_UPLOADS: 'Too many file uploads. Please wait before uploading more files',
    
    // Patient Operations
    PATIENT_NOT_FOUND: 'Patient not found in system',
    PATIENT_ACCESS_DENIED: 'Patient access denied - belongs to different practice',
    PATIENT_LOOKUP_FAILED: 'Patient lookup failed',
    INVALID_PATIENT_DATA: 'Invalid patient data',
    
    // Document Operations
    UPLOAD_NOT_FOUND: 'Upload not found or has expired',
    UPLOAD_EXPIRED: 'Upload has expired',
    UPLOAD_ACCESS_DENIED: 'Upload access denied',
    DUPLICATE_FILE: 'File named "{filename}" already exists for this patient',
    UPLOAD_FAILED: 'File upload failed',
    FILE_TOO_LARGE: 'File is too large',
    INVALID_FILE_TYPE: 'File type not supported',
    
    // AI Operations
    AI_REQUEST_FAILED: 'AI request failed',
    VOICE_PROCESSING_FAILED: 'Voice processing failed',
    DOCUMENT_ANALYSIS_FAILED: 'Document analysis failed',
    CHAT_PROCESSING_FAILED: 'Chat processing failed',
    
    // Validation Errors
    REQUIRED_FIELD_MISSING: 'Required field missing: {field}',
    INVALID_FORMAT: 'Invalid format: {field}',
    INVALID_DATE: 'Invalid date',
    INVALID_EMAIL: 'Invalid email address',
    INVALID_PHONE: 'Invalid phone number',
    INVALID_ID: 'Invalid Social Security Number',
    
    // System Errors
    SYSTEM_ERROR: 'System error',
    DATABASE_ERROR: 'Database error',
    NETWORK_ERROR: 'Network error',
    TIMEOUT_ERROR: 'Operation timed out',
    UNKNOWN_ERROR: 'Unknown error'
  }
};
```

### **2. Error Localization Functions**
```javascript
// ADD: Error localization helper functions
const getLocalizedError = (country, errorKey, params = {}) => {
  try {
    const countryMessages = ERROR_MESSAGES[country] || ERROR_MESSAGES['United States'];
    let message = countryMessages[errorKey] || countryMessages['UNKNOWN_ERROR'];
    
    // Replace parameters in message
    Object.keys(params).forEach(param => {
      const placeholder = `{${param}}`;
      message = message.replace(new RegExp(placeholder, 'g'), params[param]);
    });
    
    return message;
  } catch (error) {
    console.error('❌ Error localization failed:', error);
    return errorKey; // Fallback to error key
  }
};

const createErrorResponse = (country, errorKey, params = {}, statusCode = 400) => {
  return {
    statusCode: statusCode,
    response: {
      success: false,
      error: getLocalizedError(country, errorKey, params),
      errorCode: errorKey,
      timestamp: new Date().toISOString()
    }
  };
};

const sendLocalizedError = (res, country, errorKey, params = {}, statusCode = 400) => {
  const errorResponse = createErrorResponse(country, errorKey, params, statusCode);
  res.status(errorResponse.statusCode).json(errorResponse.response);
};
```

### **3. Update Authentication Errors**
```javascript
// BEFORE - Hardcoded English:
if (!req.user) {
  return res.status(401).json({
    success: false,
    message: 'Authentication required'
  });
}

// AFTER - Localized:
if (!req.user) {
  return sendLocalizedError(res, req.country, 'AUTH_REQUIRED', {}, 401);
}

if (!req.practice) {
  return sendLocalizedError(res, req.country, 'CLINIC_CONTEXT_REQUIRED', {}, 400);
}

if (!req.practiceSubdomain) {
  return sendLocalizedError(res, req.country, 'INVALID_CLINIC_CONTEXT', {}, 400);
}
```

### **4. Update Rate Limiting Errors**
```javascript
// Update rate limiting middleware:
const aiRateLimit = rateLimit({
  // ... existing config ...
  message: (req) => createErrorResponse(
    req.country || 'United States', 
    'TOO_MANY_AI_REQUESTS'
  ).response,
  onLimitReached: async (req, res, options) => {
    await logRateLimitViolation(req, 'AI_RATE_LIMIT');
  }
});

const uploadRateLimit = rateLimit({
  // ... existing config ...
  message: (req) => createErrorResponse(
    req.country || 'United States', 
    'TOO_MANY_UPLOADS'
  ).response
});
```

### **5. Update Patient Operation Errors**
```javascript
// BEFORE - Hardcoded:
if (!patient) {
  return res.status(404).json({
    success: false,
    message: 'Patient not found'
  });
}

// AFTER - Localized:
if (!patient) {
  await auditLog(req, 'PATIENT_LOOKUP_FAILED', {
    searchTerm: patientName,
    uploadId: uploadId
  });
  
  return sendLocalizedError(res, req.country, 'PATIENT_NOT_FOUND', {}, 404);
}

// Cross-practice access check:
if (patient.practiceId.toString() !== req.practice._id.toString()) {
  await auditLog(req, 'PATIENT_ACCESS_DENIED', {
    patientId: patient._id,
    attemptedClinic: req.practice._id,
    actualClinic: patient.practiceId
  });
  
  return sendLocalizedError(res, req.country, 'PATIENT_ACCESS_DENIED', {}, 403);
}
```

### **6. Update Document Operation Errors**
```javascript
// BEFORE - Hardcoded:
if (!pendingUpload) {
  return res.status(404).json({
    success: false,
    message: 'Upload not found or has expired'
  });
}

// AFTER - Localized:
if (!pendingUpload) {
  await auditLog(req, 'PENDING_UPLOAD_NOT_FOUND', {
    uploadId: uploadId,
    reason: 'Not found or expired'
  });
  
  return sendLocalizedError(res, req.country, 'UPLOAD_NOT_FOUND', {}, 404);
}

// Duplicate file error:
if (existingDoc) {
  const duplicateError = {
    filename: fileInfo.originalName,
    error: 'Duplicate file detected',
    message: getLocalizedError(req.country, 'DUPLICATE_FILE', {
      filename: fileInfo.originalName
    }),
    existingFileId: existingDoc._id,
    existingFileDate: existingDoc.metadata?.uploadDate || existingDoc.createdAt,
    existingFileSize: existingDoc.fileSize
  };
  
  duplicateErrors.push(duplicateError);
}
```

### **7. Update AI Operation Errors**
```javascript
// BEFORE - Hardcoded:
res.status(500).json({
  success: false,
  message: 'Chat processing failed'
});

// AFTER - Localized:
await auditAIUsage(req, 'CHAT_ERROR', {
  sessionId: sessionId,
  error: error.message
});

return sendLocalizedError(res, req.country, 'CHAT_PROCESSING_FAILED', {
  details: error.message
}, 500);
```

### **8. Update System Error Handling**
```javascript
// ADD: Global error handler for routes
const handleRouteError = async (req, res, error, operation) => {
  console.error(`❌ ${operation} error:`, error);
  
  // Log error for monitoring
  await auditLog(req, 'SYSTEM_ERROR', {
    operation: operation,
    error: error.message,
    stack: error.stack
  });
  
  // Determine error type and send appropriate response
  let errorKey = 'SYSTEM_ERROR';
  let statusCode = 500;
  
  if (error.name === 'ValidationError') {
    errorKey = 'INVALID_PATIENT_DATA';
    statusCode = 400;
  } else if (error.name === 'MongoError' || error.name === 'MongooseError') {
    errorKey = 'DATABASE_ERROR';
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    errorKey = 'NETWORK_ERROR';
  }
  
  return sendLocalizedError(res, req.country, errorKey, {
    details: error.message
  }, statusCode);
};

// Use in try-catch blocks:
try {
  // ... route logic ...
} catch (error) {
  return await handleRouteError(req, res, error, 'PROCESS_PENDING_UPLOAD');
}
```

### **9. Update Success Messages**
```javascript
// ADD: Success message localization
const SUCCESS_MESSAGES = {
  'Israel': {
    UPLOAD_COMPLETED: 'העלאת הקבצים הושלמה בהצלחה',
    PATIENT_FOUND: 'המטופל נמצא',
    ANALYSIS_COMPLETED: 'הניתוח הושלם בהצלחה'
  },
  'United States': {
    UPLOAD_COMPLETED: 'File upload completed successfully',
    PATIENT_FOUND: 'Patient found',
    ANALYSIS_COMPLETED: 'Analysis completed successfully'
  }
};

const getLocalizedSuccess = (country, messageKey, params = {}) => {
  const countryMessages = SUCCESS_MESSAGES[country] || SUCCESS_MESSAGES['United States'];
  let message = countryMessages[messageKey] || messageKey;
  
  Object.keys(params).forEach(param => {
    const placeholder = `{${param}}`;
    message = message.replace(new RegExp(placeholder, 'g'), params[param]);
  });
  
  return message;
};
```

## ⚠️ **Localization Notes**
- **🚨 CRITICAL:** All user-facing errors must be localized
- **🚨 CRITICAL:** Error codes help with debugging
- **🚨 CRITICAL:** Consistent error format improves UX
- **❌ DON'T SKIP:** Poor localization creates user confusion

## 🧪 **Localization Testing After Implementation**
1. **Test Israeli practice errors:**
   - Trigger various errors → verify Hebrew messages
   - Check error codes are included

2. **Test US practice errors:**
   - Trigger various errors → verify English messages
   - Check error codes are included

3. **Test parameter substitution:**
   - Trigger errors with parameters → verify substitution works

## ✅ **Success Criteria**
- [ ] All errors localized for both countries
- [ ] Consistent error response format
- [ ] Parameter substitution working
- [ ] Error codes included for debugging
- [ ] Success messages localized
- [ ] No hardcoded error messages remain

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 1.1:** Update addPatientFunction Schema (Phase 1)

## 📝 **CRITICAL NOTES**
- **USER EXPERIENCE** - proper localization essential
- **CONSISTENCY** - standardized error format important
- **DEBUGGING** - error codes help troubleshooting
- **TEST THOROUGHLY** - verify all error scenarios work
