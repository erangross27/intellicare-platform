# Task 0.2: Add Security Middleware

## 🚨 **CRITICAL SECURITY TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 25 minutes  
**Risk Level:** HIGH  
**Priority:** URGENT  

Add critical security middleware including rate limiting, proper authentication, and country detection to prevent DoS attacks and unauthorized access.

## 🎯 **Objective**
Implement essential security middleware that:
- Prevents DoS attacks with rate limiting
- Ensures proper authentication on all routes
- Adds country detection for localization
- Protects AI endpoints from abuse

## 🚨 **Security Risks**
- **DoS Vulnerability:** No rate limiting on AI endpoints
- **Unauthorized Access:** Some routes marked as "Public" incorrectly
- **Resource Abuse:** Unlimited AI requests possible

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add middleware and update route protection**

## 🔍 **Current Security Issues**

### **Issue 1: Missing Rate Limiting**
```javascript
// CURRENT - NO PROTECTION
router.post('/chat', async (req, res) => {
  // ❌ No rate limiting - can be abused
});

router.post('/voice-command', async (req, res) => {
  // ❌ No rate limiting - expensive AI calls
});
```

### **Issue 2: Incorrect Route Protection**
```javascript
// CURRENT - WRONG ACCESS LEVELS
// @access  Public  ← ❌ WRONG - should be Private
router.post('/voice-command', ...);
router.post('/analyze-document', ...);
router.post('/process-text', ...);
router.post('/upload-document', ...);
router.post('/process-pending-upload', ...);
```

### **Issue 3: Missing Country Detection**
```javascript
// CURRENT - NO COUNTRY CONTEXT
router.post('/chat', async (req, res) => {
  // ❌ No country detection for localization
  const practiceContext = {
    // Missing country field
  };
});
```

## ✅ **Required Security Middleware**

### **1. Rate Limiting Middleware**
```javascript
// ADD at top of file after imports:
const rateLimit = require('express-rate-limit');

// AI Rate Limiting (strict)
const aiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // 10 AI requests per minute per practice
  keyGenerator: (req) => `ai_${req.practiceSubdomain}_${req.user?._id}`,
  message: {
    success: false,
    message: 'Too many AI requests. Please wait before trying again.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for system health checks
    return req.path === '/health';
  }
});

// General API Rate Limiting (more lenient)
const generalRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per minute per practice
  keyGenerator: (req) => `general_${req.practiceSubdomain}_${req.user?._id}`,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
    retryAfter: 60
  }
});

// Document Upload Rate Limiting (very strict)
const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // 5 uploads per minute per practice
  keyGenerator: (req) => `upload_${req.practiceSubdomain}_${req.user?._id}`,
  message: {
    success: false,
    message: 'Too many upload requests. Please wait before uploading more files.',
    retryAfter: 60
  }
});
```

### **2. Country Detection Middleware**
```javascript
// ADD after rate limiting:
const detectCountry = (req, res, next) => {
  try {
    // Priority order for country detection:
    // 1. Explicit header
    // 2. User profile
    // 3. Practice settings
    // 4. Default to Israel
    
    req.country = req.headers['x-country'] || 
                  req.user?.country || 
                  req.practice?.contact?.address?.country ||
                  req.practice?.settings?.country ||
                  'Israel';
    
    // Validate country
    const supportedCountries = ['Israel', 'United States'];
    if (!supportedCountries.includes(req.country)) {
      req.country = 'Israel'; // Default fallback
    }
    
    console.log(`🌍 Country detected: ${req.country} for practice: ${req.practiceSubdomain}`);
    next();
  } catch (error) {
    console.error('❌ Country detection error:', error);
    req.country = 'Israel'; // Safe fallback
    next();
  }
};
```

### **3. Enhanced Authentication Middleware**
```javascript
// ADD enhanced auth validation:
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  if (!req.practice) {
    return res.status(400).json({
      success: false,
      message: 'Practice context required'
    });
  }
  
  if (!req.practiceSubdomain) {
    return res.status(400).json({
      success: false,
      message: 'Practice subdomain required'
    });
  }
  
  next();
};
```

### **4. Request Validation Middleware**
```javascript
// ADD request validation:
const validateRequest = (req, res, next) => {
  // Validate practice models are available
  if (!req.models || !req.models.Patient) {
    return res.status(500).json({
      success: false,
      message: 'Practice models not initialized'
    });
  }
  
  // Add practice context to all requests
  req.practiceContext = {
    practice: req.practice,
    user: req.user,
    authToken: req.headers['x-auth-token'],
    practiceSubdomain: req.practiceSubdomain,
    country: req.country,
    models: req.models
  };
  
  next();
};
```

## 🔧 **Apply Middleware to Routes**

### **Update Route Definitions**
```javascript
// BEFORE - Insecure routes:
router.post('/chat', async (req, res) => {...});
router.post('/voice-command', async (req, res) => {...});
router.post('/upload-document', async (req, res) => {...});

// AFTER - Secure routes:
router.post('/chat', 
  generalRateLimit,
  aiRateLimit, 
  practiceAuth, 
  requireAuth,
  detectCountry,
  validateRequest,
  async (req, res) => {...}
);

router.post('/voice-command', 
  generalRateLimit,
  aiRateLimit,
  practiceAuth,
  requireAuth, 
  detectCountry,
  validateRequest,
  async (req, res) => {...}
);

router.post('/upload-document',
  generalRateLimit,
  uploadRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry, 
  validateRequest,
  async (req, res) => {...}
);

router.post('/process-pending-upload',
  generalRateLimit,
  uploadRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  async (req, res) => {...}
);

router.post('/analyze-document',
  generalRateLimit,
  aiRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  async (req, res) => {...}
);

router.post('/process-text',
  generalRateLimit,
  aiRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  async (req, res) => {...}
);
```

### **Update Route Comments**
```javascript
// BEFORE:
// @access  Public  ← ❌ WRONG

// AFTER:
// @access  Private (requires authentication + practice context)
```

## 🔧 **Enhanced Practice Context**

### **Update Practice Context Creation**
```javascript
// BEFORE - Missing fields:
const practiceContext = {
  practice: req.practice,
  user: req.user,
  authToken: req.headers['x-auth-token'],
  practiceSubdomain: req.practiceSubdomain
};

// AFTER - Complete context:
const practiceContext = req.practiceContext; // ✅ Already built by middleware
// OR if building manually:
const practiceContext = {
  practice: req.practice,
  user: req.user,
  authToken: req.headers['x-auth-token'],
  practiceSubdomain: req.practiceSubdomain,
  country: req.country,           // ✅ ADD
  models: req.models,             // ✅ ADD
  auditLogger: req.auditLogger    // ✅ ADD (for next task)
};
```

## 🔧 **Session Namespacing**

### **Update Session Handling**
```javascript
// BEFORE - Session collision risk:
const { message, sessionId = 'default', language = 'he' } = req.body;

const result = await agent.processChatMessage(
  message, 
  sessionId, 
  language, 
  practiceContext
);

// AFTER - Practice-isolated sessions:
const { message, sessionId = 'default', language = 'he' } = req.body;

// Namespace session by practice to prevent collisions
const clinicSessionId = `${req.practiceSubdomain}_${sessionId}`;

const result = await agent.processChatMessage(
  message, 
  clinicSessionId, // ✅ Namespaced
  language, 
  practiceContext
);
```

## ⚠️ **Security Notes**
- **🚨 CRITICAL:** Rate limiting prevents DoS attacks
- **🚨 CRITICAL:** Proper auth prevents unauthorized access
- **🚨 CRITICAL:** Session namespacing prevents cross-practice pollution
- **❌ DON'T SKIP:** These are essential security measures

## 🧪 **Security Testing After Implementation**
1. **Test rate limiting:**
   - Make 11 AI requests in 1 minute → should be blocked
   - Make 6 uploads in 1 minute → should be blocked

2. **Test authentication:**
   - Try accessing routes without auth → should get 401
   - Try accessing without practice context → should get 400

3. **Test session isolation:**
   - Create session in Practice A
   - Verify Practice B can't access it

## ✅ **Success Criteria**
- [ ] Rate limiting implemented and working
- [ ] All routes properly authenticated
- [ ] Country detection working
- [ ] Session namespacing implemented
- [ ] Request validation working
- [ ] Security testing passes

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 0.3:** Add Audit Logging

## 📝 **CRITICAL NOTES**
- **PREVENTS DoS ATTACKS** - rate limiting is essential
- **BLOCKS UNAUTHORIZED ACCESS** - proper auth required
- **ISOLATES PRACTICES** - session namespacing critical
- **TEST THOROUGHLY** - verify all security measures work
