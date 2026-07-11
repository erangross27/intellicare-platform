# Task 0.3: Add Audit Logging

## 🚨 **CRITICAL COMPLIANCE TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 20 minutes  
**Risk Level:** HIGH  
**Priority:** URGENT  

Add comprehensive audit logging for all patient data access and AI operations to ensure HIPAA compliance and security monitoring.

## 🎯 **Objective**
Implement audit logging that:
- Tracks all patient data access
- Logs document uploads and processing
- Records AI tool usage
- Ensures HIPAA compliance
- Enables security monitoring

## 🚨 **Compliance Risk**
**CRITICAL:** HIPAA requires audit logging of all patient data access. Missing logs = compliance violation.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add audit logging to all sensitive operations**

## 🔍 **Current Compliance Gaps**

### **Gap 1: No Patient Access Logging**
```javascript
// CURRENT - NO AUDIT TRAIL
const patient = await req.models.Patient.findOne({...});
// ❌ No log of who accessed which patient when
```

### **Gap 2: No Document Upload Logging**
```javascript
// CURRENT - NO AUDIT TRAIL
const document = new Document({...});
await document.save();
// ❌ No log of document uploads
```

### **Gap 3: No AI Usage Logging**
```javascript
// CURRENT - NO AUDIT TRAIL
const result = await agent.processChatMessage(...);
// ❌ No log of AI tool usage
```

## ✅ **Required Audit Logging**

### **1. Audit Logging Helper Functions**
```javascript
// ADD at top of file after imports:
const auditLog = async (req, action, details = {}) => {
  try {
    if (req.auditLogger) {
      await req.auditLogger.log({
        timestamp: new Date(),
        action: action,
        userId: req.user?._id,
        userEmail: req.user?.email,
        practiceId: req.practice?._id,
        practiceSubdomain: req.practiceSubdomain,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        sessionId: req.sessionID,
        details: details
      });
    } else {
      // Fallback logging if auditLogger not available
      console.log(`📋 AUDIT: ${action}`, {
        user: req.user?.email,
        practice: req.practiceSubdomain,
        details
      });
    }
  } catch (error) {
    console.error('❌ Audit logging error:', error);
    // Don't fail the request if audit logging fails
  }
};

const auditPatientAccess = async (req, patient, action) => {
  await auditLog(req, `PATIENT_${action}`, {
    patientId: patient._id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    patientIdentifier: patient.nationalId || patient.socialSecurityNumber
  });
};

const auditDocumentOperation = async (req, operation, details) => {
  await auditLog(req, `DOCUMENT_${operation}`, details);
};

const auditAIUsage = async (req, operation, details) => {
  await auditLog(req, `AI_${operation}`, details);
};
```

### **2. Patient Access Audit Logging**
```javascript
// ADD after patient queries:

// In /process-pending-upload route:
const patient = await req.models.Patient.findOne({...});

if (patient) {
  // ✅ ADD: Log patient access
  await auditPatientAccess(req, patient, 'ACCESSED_FOR_UPLOAD');
  
  console.log(`👤 [AGENT] Found patient: ${patient.firstName} ${patient.lastName}`);
} else {
  // ✅ ADD: Log failed patient lookup
  await auditLog(req, 'PATIENT_LOOKUP_FAILED', {
    searchTerm: patientName,
    uploadId: uploadId
  });
}
```

### **3. Document Upload Audit Logging**
```javascript
// ADD in document processing loop:

for (const fileInfo of pendingUpload.files) {
  try {
    // Check for duplicates
    const existingDoc = await req.models.Document.findOne({...});
    
    if (existingDoc) {
      // ✅ ADD: Log duplicate detection
      await auditDocumentOperation(req, 'DUPLICATE_DETECTED', {
        fileName: fileInfo.originalName,
        patientId: patient._id,
        existingDocId: existingDoc._id,
        uploadId: uploadId
      });
    }
    
    // Create document
    const document = new req.models.Document({...});
    await document.save();
    
    // ✅ ADD: Log successful upload
    await auditDocumentOperation(req, 'UPLOADED', {
      documentId: document._id,
      fileName: fileInfo.originalName,
      fileType: fileInfo.fileType,
      fileSize: fileInfo.size,
      patientId: patient._id,
      uploadId: uploadId,
      encryptionUsed: true
    });
    
  } catch (error) {
    // ✅ ADD: Log upload failure
    await auditDocumentOperation(req, 'UPLOAD_FAILED', {
      fileName: fileInfo.originalName,
      patientId: patient._id,
      uploadId: uploadId,
      error: error.message
    });
  }
}

// ✅ ADD: Log upload summary
await auditDocumentOperation(req, 'UPLOAD_COMPLETED', {
  uploadId: uploadId,
  patientId: patient._id,
  totalFiles: pendingUpload.files.length,
  successfulUploads: successCount,
  failedUploads: pendingUpload.files.length - successCount
});
```

### **4. AI Usage Audit Logging**
```javascript
// ADD in /chat route:
router.post('/chat', ..., async (req, res) => {
  const { message, sessionId = 'default', language = 'he' } = req.body;
  
  // ✅ ADD: Log AI chat request
  await auditAIUsage(req, 'CHAT_REQUEST', {
    message: message.substring(0, 100), // Log first 100 chars only
    sessionId: sessionId,
    language: language,
    messageLength: message.length
  });
  
  try {
    const clinicSessionId = `${req.practiceSubdomain}_${sessionId}`;
    const result = await agent.processChatMessage(
      message, 
      clinicSessionId, 
      language, 
      req.practiceContext
    );
    
    // ✅ ADD: Log AI response
    await auditAIUsage(req, 'CHAT_RESPONSE', {
      sessionId: sessionId,
      success: result.success,
      responseType: result.action || 'chat',
      responseLength: result.message?.length || 0
    });
    
    res.json(result);
  } catch (error) {
    // ✅ ADD: Log AI error
    await auditAIUsage(req, 'CHAT_ERROR', {
      sessionId: sessionId,
      error: error.message
    });
    
    res.status(500).json({...});
  }
});
```

### **5. Voice Command Audit Logging**
```javascript
// ADD in /voice-command route:
router.post('/voice-command', ..., async (req, res) => {
  const { audioData, language = 'he' } = req.body;
  
  // ✅ ADD: Log voice command request
  await auditAIUsage(req, 'VOICE_COMMAND_REQUEST', {
    language: language,
    audioDataSize: audioData?.length || 0,
    hasAudioData: !!audioData
  });
  
  try {
    // Process voice command...
    const result = await processVoiceCommand(audioData, language, req.practiceContext);
    
    // ✅ ADD: Log voice command response
    await auditAIUsage(req, 'VOICE_COMMAND_RESPONSE', {
      success: result.success,
      transcription: result.transcription?.substring(0, 100),
      action: result.action
    });
    
    res.json(result);
  } catch (error) {
    // ✅ ADD: Log voice command error
    await auditAIUsage(req, 'VOICE_COMMAND_ERROR', {
      error: error.message
    });
    
    res.status(500).json({...});
  }
});
```

### **6. Document Analysis Audit Logging**
```javascript
// ADD in /analyze-document route:
router.post('/analyze-document', ..., async (req, res) => {
  const { patientName, documentIds } = req.body;
  
  // ✅ ADD: Log analysis request
  await auditAIUsage(req, 'DOCUMENT_ANALYSIS_REQUEST', {
    patientName: patientName,
    documentCount: documentIds?.length || 0,
    documentIds: documentIds
  });
  
  try {
    // Find patient
    const patient = await req.models.Patient.findOne({...});
    
    if (patient) {
      // ✅ ADD: Log patient access for analysis
      await auditPatientAccess(req, patient, 'ACCESSED_FOR_ANALYSIS');
    }
    
    // Process analysis...
    const result = await analyzeDocuments(patient, documentIds, req.practiceContext);
    
    // ✅ ADD: Log analysis completion
    await auditAIUsage(req, 'DOCUMENT_ANALYSIS_COMPLETED', {
      patientId: patient?._id,
      documentCount: documentIds?.length || 0,
      success: result.success,
      analysisType: result.analysisType
    });
    
    res.json(result);
  } catch (error) {
    // ✅ ADD: Log analysis error
    await auditAIUsage(req, 'DOCUMENT_ANALYSIS_ERROR', {
      patientName: patientName,
      error: error.message
    });
    
    res.status(500).json({...});
  }
});
```

### **7. Security Event Logging**
```javascript
// ADD security event logging:

// Log authentication failures
const logAuthFailure = async (req, reason) => {
  await auditLog(req, 'AUTH_FAILURE', {
    reason: reason,
    attemptedPath: req.path,
    method: req.method
  });
};

// Log rate limit violations
const logRateLimitViolation = async (req, limitType) => {
  await auditLog(req, 'RATE_LIMIT_VIOLATION', {
    limitType: limitType,
    path: req.path,
    method: req.method
  });
};

// Log suspicious activity
const logSuspiciousActivity = async (req, activity, details) => {
  await auditLog(req, 'SUSPICIOUS_ACTIVITY', {
    activity: activity,
    details: details,
    path: req.path
  });
};
```

## 🔧 **Integration with Middleware**

### **Update Security Middleware to Include Audit Logging**
```javascript
// Update rate limiting middleware to log violations:
const aiRateLimit = rateLimit({
  // ... existing config ...
  onLimitReached: async (req, res, options) => {
    await logRateLimitViolation(req, 'AI_RATE_LIMIT');
  }
});

// Update auth middleware to log failures:
const requireAuth = (req, res, next) => {
  if (!req.user) {
    logAuthFailure(req, 'NO_USER');
    return res.status(401).json({...});
  }
  
  if (!req.practice) {
    logAuthFailure(req, 'NO_CLINIC');
    return res.status(400).json({...});
  }
  
  next();
};
```

## ⚠️ **Compliance Notes**
- **🚨 HIPAA REQUIRED:** All patient data access must be logged
- **🚨 SECURITY REQUIRED:** All AI usage must be tracked
- **🚨 AUDIT REQUIRED:** All document operations must be logged
- **❌ DON'T SKIP:** This is legally required for healthcare

## 🧪 **Audit Testing After Implementation**
1. **Test patient access logging:**
   - Access patient data → verify audit log created
   - Check log contains user, patient, timestamp

2. **Test document upload logging:**
   - Upload document → verify upload logged
   - Check duplicate detection logged

3. **Test AI usage logging:**
   - Use chat feature → verify request/response logged
   - Use voice commands → verify usage logged

## ✅ **Success Criteria**
- [ ] All patient access logged
- [ ] All document operations logged
- [ ] All AI usage logged
- [ ] Security events logged
- [ ] Audit logs contain required fields
- [ ] Logging doesn't break functionality

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 0.4:** Fix PendingUpload Model

## 📝 **CRITICAL NOTES**
- **HIPAA COMPLIANCE** - legally required for healthcare
- **SECURITY MONITORING** - enables threat detection
- **AUDIT TRAIL** - required for investigations
- **DON'T FAIL REQUESTS** - log errors but continue processing
