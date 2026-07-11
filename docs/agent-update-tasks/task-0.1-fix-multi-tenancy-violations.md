# Task 0.1: Fix Multi-Tenancy Violations

## 🚨 **CRITICAL SECURITY TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 30 minutes  
**Risk Level:** CRITICAL  
**Priority:** URGENT  

Fix severe multi-tenancy violations that could cause data leakage between practices. This is a **CRITICAL SECURITY ISSUE** that must be fixed before any other changes.

## 🎯 **Objective**
Fix all instances where global models are used instead of practice-specific models, preventing data leakage between different practice tenants.

## 🚨 **Security Risk**
**CRITICAL:** Current code allows one practice to access another practice's patient data due to improper model usage.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Multiple locations** throughout the file

## 🔍 **Current Violations Found**

### **Violation 1: Global Patient Model Usage (Line 11)**
```javascript
// CURRENT - SECURITY VIOLATION
const Patient = require('../models/Patient');

// Lines 669, 691, 684, 816, 817, 822 use global Patient model
const patient = await Patient.findOne({...}); // ❌ WRONG - Global model
```

### **Violation 2: Global Document Model Usage (Line 10)**
```javascript
// CURRENT - SECURITY VIOLATION  
const Document = require('../models/Document');

// Line 690 uses global Document model
const existingDoc = await Document.findOne({...}); // ❌ WRONG - Global model
```

### **Violation 3: Global PendingUpload Model Usage (Line 12)**
```javascript
// CURRENT - SECURITY VIOLATION
const PendingUpload = require('../models/PendingUpload');

// Multiple lines use global PendingUpload model
const pendingUpload = await PendingUpload.findOne({...}); // ❌ WRONG - Global model
```

## ✅ **Required Fixes**

### **Fix 1: Remove Global Model Imports**
```javascript
// REMOVE these lines from top of file:
const Document = require('../models/Document');        // ❌ DELETE
const Patient = require('../models/Patient');          // ❌ DELETE  
const PendingUpload = require('../models/PendingUpload'); // ❌ DELETE
```

### **Fix 2: Use Practice-Specific Models Throughout**

#### **Fix Patient Model Usage (Lines 669, 684, 691, 816, 817, 822)**
```javascript
// BEFORE (SECURITY VIOLATION):
const patient = await Patient.findOne({
  $or: [
    { fullName: new RegExp(patientName, 'i') },
    { 'personalInfo.fullName': new RegExp(patientName, 'i') },
    { name: new RegExp(patientName, 'i') }
  ]
});

// AFTER (SECURE):
const Patient = req.models.Patient; // ✅ Practice-specific model
const patient = await Patient.findOne({
  $or: [
    { firstName: new RegExp(patientName.split(' ')[0], 'i') },
    { lastName: new RegExp(patientName.split(' ').slice(1).join(' '), 'i') }
  ]
});
```

#### **Fix Document Model Usage (Line 690)**
```javascript
// BEFORE (SECURITY VIOLATION):
const existingDoc = await Document.findOne({
  patientId: patient._id,
  originalName: fileInfo.originalName
});

// AFTER (SECURE):
const Document = req.models.Document; // ✅ Practice-specific model
const existingDoc = await Document.findOne({
  patientId: patient._id,
  originalName: fileInfo.originalName
});
```

#### **Fix PendingUpload Model Usage (Multiple lines)**
```javascript
// BEFORE (SECURITY VIOLATION):
const pendingUpload = await PendingUpload.findOne({
  uploadId,
  status: 'pending'
});

// AFTER (SECURE):
const PendingUpload = req.models.PendingUpload; // ✅ Practice-specific model
const pendingUpload = await PendingUpload.findOne({
  uploadId,
  practiceSubdomain: req.practiceSubdomain, // ✅ Add practice filter
  status: 'pending'
});
```

### **Fix 3: Add Practice Validation to All Queries**

#### **Add Practice Context Validation**
```javascript
// ADD at the beginning of routes that access patient data:
if (!req.practiceSubdomain) {
  return res.status(400).json({
    success: false,
    message: 'Practice context required'
  });
}

// Verify practice models are available
if (!req.models || !req.models.Patient) {
  return res.status(500).json({
    success: false,
    message: 'Practice models not initialized'
  });
}
```

#### **Add Practice Ownership Verification**
```javascript
// ADD after finding patient:
if (patient && patient.practiceId && patient.practiceId.toString() !== req.practice._id.toString()) {
  console.error(`🚨 SECURITY: Attempted cross-practice access - Patient ${patient._id} belongs to different practice`);
  return res.status(403).json({
    success: false,
    message: 'Access denied: Patient belongs to different practice'
  });
}
```

### **Fix 4: Namespace Sessions by Practice**

#### **Update Chat Session Handling**
```javascript
// BEFORE (SESSION COLLISION RISK):
const result = await agent.processChatMessage(
  message, 
  sessionId, 
  language, 
  practiceContext
);

// AFTER (PRACTICE-ISOLATED SESSIONS):
const clinicSessionId = `${req.practiceSubdomain}_${sessionId}`;
const result = await agent.processChatMessage(
  message, 
  clinicSessionId, // ✅ Namespaced by practice
  language, 
  practiceContext
);
```

## 🔧 **Complete Implementation**

### **Step 1: Remove Global Imports**
Remove lines 10-12:
```javascript
// DELETE THESE LINES:
// const Document = require('../models/Document');
// const Patient = require('../models/Patient'); 
// const PendingUpload = require('../models/PendingUpload');
```

### **Step 2: Update All Model Usage**
Replace every instance of global model usage with practice-specific models:

```javascript
// Pattern to find and replace:
// FIND: Patient.findOne
// REPLACE: req.models.Patient.findOne

// FIND: Document.findOne  
// REPLACE: req.models.Document.findOne

// FIND: PendingUpload.findOne
// REPLACE: req.models.PendingUpload.findOne
```

### **Step 3: Add Security Checks**
Add practice validation to all routes that access patient data:

```javascript
// ADD to routes: /process-pending-upload, /chat, /voice-command, etc.
// Practice context validation
if (!req.practiceSubdomain || !req.models) {
  return res.status(400).json({
    success: false,
    message: 'Invalid practice context'
  });
}
```

## ⚠️ **Critical Security Notes**
- **🚨 URGENT:** This fixes data leakage between practices
- **🚨 URGENT:** Must be done before any other changes
- **🚨 URGENT:** Test thoroughly to ensure no cross-practice access
- **❌ DON'T SKIP:** This is not optional - it's a security requirement

## 🧪 **Security Testing After Fix**
1. **Test practice isolation:**
   - Create patient in Practice A
   - Try to access from Practice B context
   - Should fail with 403 error

2. **Test session isolation:**
   - Start chat session in Practice A
   - Try to access same session ID from Practice B
   - Should be separate sessions

3. **Test model isolation:**
   - Verify all queries use req.models.*
   - Verify no global model usage remains

## ✅ **Success Criteria**
- [ ] All global model imports removed
- [ ] All model usage changed to req.models.*
- [ ] Practice validation added to all routes
- [ ] Sessions namespaced by practice
- [ ] Cross-practice access blocked
- [ ] Security testing passes

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 0.2:** Add Security Middleware

## 📝 **CRITICAL NOTES**
- **THIS MUST BE DONE FIRST** - before any other changes
- **DATA LEAKAGE RISK** - current code allows cross-practice access
- **COMPLIANCE VIOLATION** - HIPAA requires proper tenant isolation
- **TEST THOROUGHLY** - verify no cross-practice access possible
