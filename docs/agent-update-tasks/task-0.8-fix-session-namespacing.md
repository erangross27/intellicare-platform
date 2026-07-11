# Task 0.8: Fix Session Namespacing

## 🚨 **CRITICAL SECURITY TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 15 minutes  
**Risk Level:** CRITICAL  
**Priority:** URGENT  

Fix session namespacing to prevent session collisions between different practices, which could lead to cross-practice data access.

## 🎯 **Objective**
Fix session isolation to:
- Namespace all sessions by practice subdomain
- Prevent session collisions between practices
- Ensure chat sessions are practice-specific
- Maintain session security and isolation

## 🚨 **Security Risk**
**CRITICAL:** Session collisions between practices could allow one practice to access another practice's chat sessions and data.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Fix session handling in all routes that use sessions**

## 🔍 **Current Session Collision Issues**

### **Issue 1: Chat Sessions Not Namespaced**
```javascript
// CURRENT - SESSION COLLISION RISK
router.post('/chat', async (req, res) => {
  const { message, sessionId = 'default', language = 'he' } = req.body;
  
  // ❌ PROBLEM: sessionId could collide between practices
  const result = await agent.processChatMessage(
    message, 
    sessionId,  // ❌ Not namespaced - Practice A and B could use same ID
    language, 
    practiceContext
  );
});
```

### **Issue 2: Voice Command Sessions Not Isolated**
```javascript
// CURRENT - SESSION COLLISION RISK
router.post('/voice-command', async (req, res) => {
  // ❌ PROBLEM: Voice sessions not isolated by practice
  const sessionId = req.headers['x-session-id'] || 'voice-default';
  // Could collide between practices
});
```

### **Issue 3: Document Processing Sessions Not Namespaced**
```javascript
// CURRENT - SESSION COLLISION RISK
router.post('/process-pending-upload', async (req, res) => {
  // ❌ PROBLEM: Upload sessions could collide
  const uploadId = req.body.uploadId; // Not namespaced by practice
});
```

## ✅ **Required Session Namespacing Fixes**

### **Fix 1: Create Session Namespacing Helper**
```javascript
// ADD at top of file after imports:
const createClinicSessionId = (practiceSubdomain, sessionId) => {
  // Ensure practice subdomain is valid
  if (!practiceSubdomain || typeof practiceSubdomain !== 'string') {
    throw new Error('Invalid practice subdomain for session namespacing');
  }
  
  // Sanitize session ID
  const sanitizedSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  // Create namespaced session ID
  return `${practiceSubdomain}__${sanitizedSessionId}`;
};

const extractSessionInfo = (namespacedSessionId) => {
  const parts = namespacedSessionId.split('__');
  if (parts.length !== 2) {
    throw new Error('Invalid namespaced session ID format');
  }
  
  return {
    practiceSubdomain: parts[0],
    sessionId: parts[1]
  };
};

const validateSessionOwnership = (namespacedSessionId, practiceSubdomain) => {
  try {
    const sessionInfo = extractSessionInfo(namespacedSessionId);
    return sessionInfo.practiceSubdomain === practiceSubdomain;
  } catch (error) {
    return false;
  }
};
```

### **Fix 2: Update Chat Route Session Handling**
```javascript
// BEFORE - Session collision risk:
router.post('/chat', ..., async (req, res) => {
  const { message, sessionId = 'default', language = 'he' } = req.body;
  
  const result = await agent.processChatMessage(
    message, 
    sessionId, 
    language, 
    practiceContext
  );
});

// AFTER - Practice-isolated sessions:
router.post('/chat', ..., async (req, res) => {
  try {
    const { message, sessionId = 'default', language = 'he' } = req.body;
    
    // ✅ CREATE: Practice-namespaced session ID
    const clinicSessionId = createClinicSessionId(req.practiceSubdomain, sessionId);
    
    // ✅ LOG: Session creation for audit
    await auditLog(req, 'CHAT_SESSION_CREATED', {
      originalSessionId: sessionId,
      namespacedSessionId: clinicSessionId,
      language: language
    });
    
    const result = await agent.processChatMessage(
      message, 
      clinicSessionId,  // ✅ Use namespaced session
      language, 
      req.practiceContext
    );
    
    // ✅ ADD: Return session info for client
    result.sessionInfo = {
      sessionId: sessionId,        // Original for client
      clinicSessionId: clinicSessionId  // Namespaced for server
    };
    
    res.json(result);
  } catch (error) {
    await handleRouteError(req, res, error, 'CHAT_SESSION');
  }
});
```

### **Fix 3: Update Voice Command Session Handling**
```javascript
// BEFORE - No session isolation:
router.post('/voice-command', ..., async (req, res) => {
  const sessionId = req.headers['x-session-id'] || 'voice-default';
  // Process voice command...
});

// AFTER - Practice-isolated sessions:
router.post('/voice-command', ..., async (req, res) => {
  try {
    const originalSessionId = req.headers['x-session-id'] || 'voice-default';
    
    // ✅ CREATE: Practice-namespaced session ID
    const clinicSessionId = createClinicSessionId(req.practiceSubdomain, originalSessionId);
    
    // ✅ LOG: Voice session creation
    await auditLog(req, 'VOICE_SESSION_CREATED', {
      originalSessionId: originalSessionId,
      namespacedSessionId: clinicSessionId
    });
    
    // ✅ PROCESS: Voice command with namespaced session
    const result = await processVoiceCommand(
      req.body.audioData, 
      req.body.language || 'he',
      clinicSessionId,  // ✅ Use namespaced session
      req.practiceContext
    );
    
    res.json(result);
  } catch (error) {
    await handleRouteError(req, res, error, 'VOICE_COMMAND_SESSION');
  }
});
```

### **Fix 4: Update Upload Session Handling**
```javascript
// BEFORE - Upload ID not namespaced:
router.post('/process-pending-upload', ..., async (req, res) => {
  const { uploadId, patientName } = req.body;
  
  const pendingUpload = await PendingUpload.findOne({
    uploadId,
    status: 'pending'
  });
});

// AFTER - Practice-namespaced upload IDs:
router.post('/process-pending-upload', ..., async (req, res) => {
  try {
    const { uploadId, patientName } = req.body;
    
    // ✅ VALIDATE: Upload ID belongs to current practice
    const PendingUpload = req.models.PendingUpload;
    const pendingUpload = await PendingUpload.findOne({
      uploadId,
      practiceId: req.practice._id,           // ✅ Practice filter
      practiceSubdomain: req.practiceSubdomain, // ✅ Subdomain filter
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });
    
    if (!pendingUpload) {
      await auditLog(req, 'UPLOAD_SESSION_NOT_FOUND', {
        uploadId: uploadId,
        practiceSubdomain: req.practiceSubdomain
      });
      
      return sendLocalizedError(res, req.country, 'UPLOAD_NOT_FOUND', {}, 404);
    }
    
    // ✅ VERIFY: Upload belongs to current practice (extra security)
    if (pendingUpload.practiceSubdomain !== req.practiceSubdomain) {
      await auditLog(req, 'UPLOAD_SESSION_ACCESS_DENIED', {
        uploadId: uploadId,
        attemptedClinic: req.practiceSubdomain,
        actualClinic: pendingUpload.practiceSubdomain
      });
      
      return sendLocalizedError(res, req.country, 'ACCESS_DENIED', {}, 403);
    }
    
    // ✅ PROCESS: Upload with verified practice context
    // ... rest of upload processing ...
    
  } catch (error) {
    await handleRouteError(req, res, error, 'UPLOAD_SESSION');
  }
});
```

### **Fix 5: Add Session Cleanup Function**
```javascript
// ADD: Session cleanup for expired sessions
const cleanupExpiredSessions = async (practiceSubdomain) => {
  try {
    // This would integrate with your session store (Redis, MongoDB, etc.)
    // Example for in-memory sessions:
    
    const sessionPrefix = `${practiceSubdomain}__`;
    const expiredSessions = [];
    
    // Find expired sessions for this practice
    // Implementation depends on your session storage
    
    console.log(`🧹 Cleaned up ${expiredSessions.length} expired sessions for practice ${practiceSubdomain}`);
    
    return expiredSessions.length;
  } catch (error) {
    console.error('❌ Session cleanup error:', error);
    return 0;
  }
};

// ADD: Periodic cleanup (call this from a scheduled job)
const scheduleSessionCleanup = () => {
  setInterval(async () => {
    try {
      // Get all active practice subdomains
      const activeClinicSubdomains = await getActiveClinicSubdomains();
      
      for (const subdomain of activeClinicSubdomains) {
        await cleanupExpiredSessions(subdomain);
      }
    } catch (error) {
      console.error('❌ Scheduled session cleanup error:', error);
    }
  }, 60 * 60 * 1000); // Run every hour
};
```

### **Fix 6: Add Session Validation Middleware**
```javascript
// ADD: Session validation middleware
const validateSessionNamespace = (req, res, next) => {
  try {
    // Check if request has session-related data
    const sessionId = req.body.sessionId || req.headers['x-session-id'];
    
    if (sessionId) {
      // If session ID looks like it's already namespaced, validate ownership
      if (sessionId.includes('__')) {
        if (!validateSessionOwnership(sessionId, req.practiceSubdomain)) {
          auditLog(req, 'SESSION_OWNERSHIP_VIOLATION', {
            sessionId: sessionId,
            practiceSubdomain: req.practiceSubdomain
          });
          
          return sendLocalizedError(res, req.country, 'ACCESS_DENIED', {
            details: 'Session does not belong to current practice'
          }, 403);
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('❌ Session validation error:', error);
    return sendLocalizedError(res, req.country, 'SESSION_VALIDATION_ERROR', {}, 500);
  }
};

// Apply to routes that use sessions:
router.post('/chat',
  // ... other middleware ...
  validateSessionNamespace,  // ✅ ADD: Session validation
  async (req, res) => {...}
);
```

### **Fix 7: Update Agent Service Session Handling**
```javascript
// UPDATE: Agent service to handle namespaced sessions
// In agentService.js, update session-related methods:

// BEFORE:
async processChatMessage(message, sessionId, language, practiceContext) {
  // Uses sessionId directly
}

// AFTER:
async processChatMessage(message, namespacedSessionId, language, practiceContext) {
  try {
    // Extract practice info from session ID for validation
    const sessionInfo = this.extractSessionInfo(namespacedSessionId);
    
    // Validate session belongs to practice
    if (sessionInfo.practiceSubdomain !== practiceContext.practiceSubdomain) {
      throw new Error('Session practice mismatch');
    }
    
    // Use namespaced session ID for all internal operations
    // ... rest of processing ...
    
  } catch (error) {
    console.error('❌ Session processing error:', error);
    throw error;
  }
}
```

## ⚠️ **Security Notes**
- **🚨 CRITICAL:** Session namespacing prevents cross-practice access
- **🚨 CRITICAL:** All session IDs must be practice-prefixed
- **🚨 CRITICAL:** Session validation must be enforced
- **❌ DON'T SKIP:** This prevents serious data leakage

## 🧪 **Security Testing After Implementation**
1. **Test session isolation:**
   - Create session in Practice A with ID "test123"
   - Create session in Practice B with same ID "test123"
   - Verify they are completely separate

2. **Test session ownership:**
   - Try to access Practice A session from Practice B context
   - Should be blocked with 403 error

3. **Test session cleanup:**
   - Create expired sessions
   - Run cleanup function
   - Verify only expired sessions removed

## ✅ **Success Criteria**
- [ ] All sessions namespaced by practice
- [ ] Session collision prevention working
- [ ] Session ownership validation implemented
- [ ] Session cleanup function working
- [ ] Cross-practice session access blocked
- [ ] Audit logging for session operations

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 0.9:** Add Request Sanitization

## 📝 **CRITICAL NOTES**
- **PREVENTS SESSION COLLISIONS** - critical for multi-tenant security
- **BLOCKS CROSS-PRACTICE ACCESS** - essential for data isolation
- **ENABLES SESSION TRACKING** - important for audit compliance
- **TEST THOROUGHLY** - verify complete session isolation
