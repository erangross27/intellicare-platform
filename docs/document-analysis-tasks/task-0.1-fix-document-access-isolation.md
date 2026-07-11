# Task 0.1: Fix Document Access Isolation

## 🚨 **CRITICAL SECURITY TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 30 minutes  
**Risk Level:** CRITICAL  
**Priority:** URGENT  

## 🎯 **Objective**
Fix severe multi-tenancy violations in document access that allow one practice to access another practice's documents.

## 🚨 **Security Risk**
**CRITICAL:** Current code allows cross-practice document access through:
- Global Document model usage
- Missing practice validation in queries
- Unscoped document searches
- Public document URLs without practice verification

## 📁 **Files to Modify**
- `backend/routes/documents.js`
- `backend/services/documentAnalysisService.js`
- `backend/models/Document.js`

## 🔍 **Current Violations Found**

### **Violation 1: Global Document Model Usage**
```javascript
// CURRENT - SECURITY VIOLATION
const Document = require('../models/Document');
const docs = await Document.find({ patientId }); // ❌ No practice isolation
```

### **Violation 2: Missing Practice Validation in Queries**
```javascript
// CURRENT - SECURITY VIOLATION
router.get('/:documentId', async (req, res) => {
  const doc = await Document.findById(req.params.documentId);
  // ❌ No check if document belongs to requesting practice
});
```

## ✅ **Required Fixes**

### **Fix 1: Use Practice-Specific Models**
```javascript
// AFTER - SECURE
router.get('/:documentId', async (req, res) => {
  const Document = req.models.Document; // ✅ Practice-specific model
  
  const doc = await Document.findOne({
    _id: req.params.documentId,
    practiceId: req.practice._id // ✅ Enforce practice scope
  });
  
  if (!doc) {
    return res.status(404).json({
      success: false,
      message: 'Document not found or access denied'
    });
  }
});
```

### **Fix 2: Add Practice Validation to All Routes**
```javascript
// Add to all document routes
const validateClinicAccess = async (req, res, next) => {
  if (!req.practiceSubdomain || !req.practice) {
    return res.status(400).json({
      success: false,
      message: 'Practice context required'
    });
  }
  next();
};

router.use(validateClinicAccess);
```

### **Fix 3: Scope All Document Queries**
```javascript
// BEFORE
const documents = await Document.find({ patientId });

// AFTER
const Document = req.models.Document;
const documents = await Document.find({
  patientId,
  practiceId: req.practice._id // ✅ Always include practice scope
});
```

### **Fix 4: Secure Document URLs**
```javascript
// Add signed URLs with practice validation
const generateSecureDocumentUrl = (documentId, practiceId) => {
  const token = jwt.sign(
    { documentId, practiceId, exp: Date.now() + 3600000 },
    process.env.JWT_SECRET
  );
  return `/api/documents/secure/${documentId}?token=${token}`;
};
```

## 🧪 **Security Testing After Fix**
1. **Test practice isolation:**
   - Upload document in Practice A
   - Try to access from Practice B context
   - Should return 404/403 error

2. **Test document queries:**
   - Verify all queries include practiceId
   - Check that global Document model is not used

3. **Test URL security:**
   - Ensure document URLs include authentication
   - Verify tokens expire appropriately

## ✅ **Success Criteria**
- [ ] All Document model usage changed to req.models.Document
- [ ] All queries include practiceId validation
- [ ] Cross-practice document access blocked
- [ ] Secure URLs implemented for document access
- [ ] Audit logging added for document access attempts
- [ ] Security tests pass

## 🔄 **Next Task**
Proceed to: **Task 0.2:** Implement Document Encryption

## 📝 **Critical Notes**
- **URGENT:** This prevents document leakage between practices
- **COMPLIANCE:** Required for HIPAA compliance
- **TEST:** Thoroughly verify isolation works