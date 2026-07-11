# Task 0.6: Fix Authentication Requirements

## 🚨 **CRITICAL SECURITY TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 15 minutes  
**Risk Level:** CRITICAL  
**Priority:** URGENT  

Fix routes that are incorrectly marked as "Public" but handle sensitive medical data, ensuring proper authentication is required for all sensitive operations.

## 🎯 **Objective**
Fix authentication requirements to:
- Change incorrectly marked "Public" routes to "Private"
- Ensure all medical data routes require authentication
- Add proper authorization checks
- Prevent unauthorized access to patient data

## 🚨 **Security Risk**
**CRITICAL:** Routes handling sensitive medical data are marked as "Public" allowing unauthorized access.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Update route access levels and add authentication**

## 🔍 **Current Authentication Violations**

### **Violation 1: Voice Command Route (Public)**
```javascript
// CURRENT - SECURITY VIOLATION
// @desc    Process voice commands with AI
// @route   POST /api/agent/voice-command
// @access  Public  ← ❌ WRONG - handles medical data

router.post('/voice-command', async (req, res) => {
  // ❌ No authentication required
  // ❌ Can access patient data without login
});
```

### **Violation 2: Document Analysis Route (Public)**
```javascript
// CURRENT - SECURITY VIOLATION
// @desc    Analyze documents with AI
// @route   POST /api/agent/analyze-document
// @access  Public  ← ❌ WRONG - accesses patient documents

router.post('/analyze-document', async (req, res) => {
  // ❌ No authentication required
  // ❌ Can analyze patient documents without login
});
```

### **Violation 3: Text Processing Route (Public)**
```javascript
// CURRENT - SECURITY VIOLATION
// @desc    Process text with AI
// @route   POST /api/agent/process-text
// @access  Public  ← ❌ WRONG - processes medical text

router.post('/process-text', async (req, res) => {
  // ❌ No authentication required
  // ❌ Can process medical text without login
});
```

### **Violation 4: Document Upload Route (Public)**
```javascript
// CURRENT - SECURITY VIOLATION
// @desc    Upload documents for processing
// @route   POST /api/agent/upload-document
// @access  Public  ← ❌ WRONG - uploads patient documents

router.post('/upload-document', async (req, res) => {
  // ❌ No authentication required
  // ❌ Can upload patient documents without login
});
```

### **Violation 5: Process Upload Route (Public)**
```javascript
// CURRENT - SECURITY VIOLATION
// @desc    Process pending uploads
// @route   POST /api/agent/process-pending-upload
// @access  Public  ← ❌ WRONG - processes patient documents

router.post('/process-pending-upload', async (req, res) => {
  // ❌ No authentication required
  // ❌ Can process patient uploads without login
});
```

## ✅ **Required Authentication Fixes**

### **Fix 1: Update Route Comments**
```javascript
// BEFORE - Incorrect access levels:
// @access  Public

// AFTER - Correct access levels:
// @access  Private (requires authentication + practice context)
```

### **Fix 2: Add Authentication Middleware to All Sensitive Routes**
```javascript
// BEFORE - No authentication:
router.post('/voice-command', async (req, res) => {...});

// AFTER - With full authentication stack:
router.post('/voice-command',
  generalRateLimit,           // Rate limiting
  aiRateLimit,               // AI-specific rate limiting
  practiceAuth,                // Practice context middleware
  requireAuth,               // Authentication requirement
  detectCountry,             // Country detection
  validateRequest,           // Request validation
  async (req, res) => {...}
);
```

### **Fix 3: Complete Route Security Updates**
```javascript
// Voice Command Route - FIXED
// @desc    Process voice commands with AI
// @route   POST /api/agent/voice-command
// @access  Private (requires authentication + practice context)
router.post('/voice-command',
  generalRateLimit,
  aiRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  async (req, res) => {
    // ✅ Now requires authentication
    // ✅ Practice context validated
    // ✅ Rate limited
  }
);

// Document Analysis Route - FIXED
// @desc    Analyze documents with AI
// @route   POST /api/agent/analyze-document
// @access  Private (requires authentication + practice context)
router.post('/analyze-document',
  generalRateLimit,
  aiRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  async (req, res) => {
    // ✅ Now requires authentication
    // ✅ Patient document access controlled
  }
);

// Text Processing Route - FIXED
// @desc    Process text with AI
// @route   POST /api/agent/process-text
// @access  Private (requires authentication + practice context)
router.post('/process-text',
  generalRateLimit,
  aiRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  async (req, res) => {
    // ✅ Now requires authentication
    // ✅ Medical text processing secured
  }
);

// Document Upload Route - FIXED
// @desc    Upload documents for processing
// @route   POST /api/agent/upload-document
// @access  Private (requires authentication + practice context)
router.post('/upload-document',
  generalRateLimit,
  uploadRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  async (req, res) => {
    // ✅ Now requires authentication
    // ✅ Document uploads secured
  }
);

// Process Upload Route - FIXED
// @desc    Process pending uploads
// @route   POST /api/agent/process-pending-upload
// @access  Private (requires authentication + practice context)
router.post('/process-pending-upload',
  generalRateLimit,
  uploadRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  validateUploadRequest,
  async (req, res) => {
    // ✅ Now requires authentication
    // ✅ Upload processing secured
  }
);

// Chat Route - ALREADY SECURE (verify)
// @desc    Process chat messages with AI
// @route   POST /api/agent/chat
// @access  Private (requires authentication + practice context)
router.post('/chat',
  generalRateLimit,
  aiRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  async (req, res) => {
    // ✅ Already properly secured
  }
);
```

### **Fix 4: Add Authorization Checks Within Routes**
```javascript
// ADD: Enhanced authorization checks within route handlers

// Example for document analysis route:
router.post('/analyze-document', ..., async (req, res) => {
  try {
    const { patientName, documentIds } = req.body;
    
    // ✅ ADD: Verify user has permission for this operation
    if (!req.user.permissions?.includes('analyze_documents')) {
      await auditLog(req, 'UNAUTHORIZED_DOCUMENT_ANALYSIS', {
        patientName: patientName,
        reason: 'Missing analyze_documents permission'
      });
      
      return sendLocalizedError(res, req.country, 'ACCESS_DENIED', {}, 403);
    }
    
    // ✅ ADD: Find and verify patient belongs to practice
    const Patient = req.models.Patient;
    const patient = await Patient.findOne({
      $or: [
        { firstName: new RegExp(patientName.split(' ')[0], 'i') },
        { lastName: new RegExp(patientName.split(' ').slice(1).join(' '), 'i') }
      ]
    });
    
    if (!patient) {
      return sendLocalizedError(res, req.country, 'PATIENT_NOT_FOUND', {}, 404);
    }
    
    // ✅ ADD: Verify patient belongs to current practice
    if (patient.practiceId.toString() !== req.practice._id.toString()) {
      await auditLog(req, 'CROSS_CLINIC_ACCESS_ATTEMPT', {
        patientId: patient._id,
        attemptedClinic: req.practice._id,
        actualClinic: patient.practiceId
      });
      
      return sendLocalizedError(res, req.country, 'PATIENT_ACCESS_DENIED', {}, 403);
    }
    
    // ✅ ADD: Verify documents belong to patient and practice
    const Document = req.models.Document;
    const documents = await Document.find({
      _id: { $in: documentIds },
      patientId: patient._id
    });
    
    if (documents.length !== documentIds.length) {
      await auditLog(req, 'INVALID_DOCUMENT_ACCESS', {
        patientId: patient._id,
        requestedDocs: documentIds.length,
        foundDocs: documents.length
      });
      
      return sendLocalizedError(res, req.country, 'ACCESS_DENIED', {
        details: 'Some documents not found or access denied'
      }, 403);
    }
    
    // ✅ Proceed with analysis - all security checks passed
    // ... analysis logic ...
    
  } catch (error) {
    return await handleRouteError(req, res, error, 'ANALYZE_DOCUMENT');
  }
});
```

### **Fix 5: Add Permission-Based Access Control**
```javascript
// ADD: Permission checking middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user.permissions?.includes(permission)) {
      auditLog(req, 'PERMISSION_DENIED', {
        requiredPermission: permission,
        userPermissions: req.user.permissions
      });
      
      return sendLocalizedError(res, req.country, 'ACCESS_DENIED', {
        details: `Missing permission: ${permission}`
      }, 403);
    }
    next();
  };
};

// Apply to routes:
router.post('/analyze-document',
  // ... other middleware ...
  requirePermission('analyze_documents'),
  async (req, res) => {...}
);

router.post('/voice-command',
  // ... other middleware ...
  requirePermission('use_voice_commands'),
  async (req, res) => {...}
);
```

### **Fix 6: Add Session Validation**
```javascript
// ADD: Session validation middleware
const validateSession = (req, res, next) => {
  // Check if session is valid and not expired
  if (!req.session || !req.sessionID) {
    return sendLocalizedError(res, req.country, 'AUTH_REQUIRED', {}, 401);
  }
  
  // Check session expiration
  if (req.session.expiresAt && req.session.expiresAt < new Date()) {
    return sendLocalizedError(res, req.country, 'SESSION_EXPIRED', {}, 401);
  }
  
  // Check if session belongs to current practice
  if (req.session.practiceId !== req.practice._id.toString()) {
    auditLog(req, 'SESSION_CLINIC_MISMATCH', {
      sessionClinic: req.session.practiceId,
      requestClinic: req.practice._id
    });
    
    return sendLocalizedError(res, req.country, 'ACCESS_DENIED', {}, 403);
  }
  
  next();
};
```

## ⚠️ **Security Notes**
- **🚨 CRITICAL:** All medical data routes must require authentication
- **🚨 CRITICAL:** Patient data access must be practice-isolated
- **🚨 CRITICAL:** Document access must be verified
- **❌ DON'T SKIP:** This prevents unauthorized medical data access

## 🧪 **Security Testing After Implementation**
1. **Test unauthenticated access:**
   - Try accessing routes without auth → should get 401
   - Try accessing with invalid session → should get 401

2. **Test cross-practice access:**
   - Try accessing patient from different practice → should get 403
   - Try accessing documents from different practice → should get 403

3. **Test permission-based access:**
   - Try operations without required permissions → should get 403

## ✅ **Success Criteria**
- [ ] All sensitive routes require authentication
- [ ] Route comments updated to "Private"
- [ ] Authorization checks added within routes
- [ ] Permission-based access control implemented
- [ ] Session validation working
- [ ] Cross-practice access blocked

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 0.7:** Add Input Validation

## 📝 **CRITICAL NOTES**
- **PREVENTS UNAUTHORIZED ACCESS** - authentication essential for medical data
- **BLOCKS CROSS-PRACTICE ACCESS** - practice isolation critical
- **ENABLES AUDIT TRAIL** - all access must be logged
- **TEST THOROUGHLY** - verify all security checks work
