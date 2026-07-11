# Task 0.3: Add Document Audit Trail

## 📋 **COMPLIANCE TASK**
**Phase:** 0 (Critical Security)  
**Time Estimate:** 20 minutes  
**Risk Level:** CRITICAL  
**Priority:** URGENT  

## 🎯 **Objective**
Implement comprehensive audit logging for all document operations to ensure HIPAA compliance and security monitoring.

## 🚨 **Compliance Risk**
**CRITICAL:** Missing audit trails for:
- Document access/viewing
- Document uploads/modifications
- Document deletions
- Permission changes
- Failed access attempts

## 📁 **Files to Modify**
- `backend/routes/documents.js`
- `backend/middleware/documentAudit.js` (create new)
- `backend/models/DocumentAuditLog.js` (create new)
- `backend/services/documentAnalysisService.js`

## 🔧 **Implementation**

### **Step 1: Create Document Audit Model**
```javascript
// backend/models/DocumentAuditLog.js
const mongoose = require('mongoose');

const documentAuditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'DOCUMENT_UPLOADED', 'DOCUMENT_VIEWED', 'DOCUMENT_DOWNLOADED',
      'DOCUMENT_MODIFIED', 'DOCUMENT_DELETED', 'DOCUMENT_SHARED',
      'DOCUMENT_ACCESS_DENIED', 'DOCUMENT_ANALYSIS_STARTED',
      'DOCUMENT_ANALYSIS_COMPLETED', 'DOCUMENT_ENCRYPTED',
      'DOCUMENT_DECRYPTED', 'DOCUMENT_METADATA_UPDATED'
    ]
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  practiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Practice',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient'
  },
  details: {
    fileName: String,
    fileSize: Number,
    mimeType: String,
    analysisType: String,
    userRole: String,
    userPermissions: [String],
    ipAddress: String,
    userAgent: String,
    sessionId: String,
    errorMessage: String,
    processingTime: Number
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  severity: {
    type: String,
    enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'],
    default: 'INFO'
  },
  complianceFlags: {
    hipaaRelevant: { type: Boolean, default: true },
    requiresNotification: { type: Boolean, default: false },
    retentionYears: { type: Number, default: 7 }
  }
}, {
  timestamps: true,
  collection: 'document_audit_logs'
});

// Indexes for compliance queries
documentAuditLogSchema.index({ practiceId: 1, timestamp: -1 });
documentAuditLogSchema.index({ documentId: 1, action: 1 });
documentAuditLogSchema.index({ userId: 1, timestamp: -1 });
documentAuditLogSchema.index({ 'complianceFlags.hipaaRelevant': 1 });

module.exports = mongoose.model('DocumentAuditLog', documentAuditLogSchema);
```

### **Step 2: Create Audit Middleware**
```javascript
// backend/middleware/documentAudit.js
const DocumentAuditLog = require('../models/DocumentAuditLog');

const createAuditLog = async (auditData) => {
  try {
    const auditEntry = new DocumentAuditLog({
      ...auditData,
      timestamp: new Date(),
      details: {
        ...auditData.details,
        ipAddress: auditData.req?.ip || auditData.req?.connection?.remoteAddress,
        userAgent: auditData.req?.get('User-Agent'),
        sessionId: auditData.req?.sessionID
      }
    });
    
    await auditEntry.save();
    
    // Trigger alerts for critical events
    if (auditData.severity === 'CRITICAL' || auditData.action === 'DOCUMENT_ACCESS_DENIED') {
      // Send real-time alert to security team
      console.warn('🚨 CRITICAL DOCUMENT EVENT:', auditData);
    }
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't fail the main operation if audit logging fails
  }
};

const auditDocumentAction = (action, options = {}) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // Capture original json method to log response
    const originalJson = res.json;
    res.json = function(body) {
      const processingTime = Date.now() - startTime;
      
      // Determine severity based on action and response
      let severity = 'INFO';
      if (res.statusCode >= 400) severity = 'ERROR';
      if (action === 'DOCUMENT_ACCESS_DENIED') severity = 'WARNING';
      if (res.statusCode >= 500) severity = 'CRITICAL';
      
      // Create audit log
      const auditData = {
        action,
        documentId: req.params.documentId || req.body.documentId,
        userId: req.user?._id,
        practiceId: req.practice?._id,
        patientId: req.params.patientId || req.body.patientId,
        severity,
        req,
        details: {
          fileName: req.file?.originalname || req.body?.fileName,
          fileSize: req.file?.size || req.body?.fileSize,
          mimeType: req.file?.mimetype || req.body?.mimeType,
          userRole: req.user?.role,
          userPermissions: req.user?.permissions,
          processingTime,
          errorMessage: body?.message,
          ...options.extraDetails
        },
        complianceFlags: {
          hipaaRelevant: true,
          requiresNotification: severity === 'CRITICAL' || action === 'DOCUMENT_ACCESS_DENIED',
          retentionYears: 7
        }
      };
      
      createAuditLog(auditData);
      
      return originalJson.call(this, body);
    };
    
    next();
  };
};

module.exports = {
  auditDocumentAction,
  createAuditLog
};
```

### **Step 3: Apply Audit Middleware to Routes**
```javascript
// backend/routes/documents.js
const { auditDocumentAction } = require('../middleware/documentAudit');

// Apply audit middleware to all document routes
router.post('/upload/:patientId', 
  auditDocumentAction('DOCUMENT_UPLOADED'),
  upload.single('document'),
  async (req, res) => {
    // ... existing upload logic
  }
);

router.get('/download/:documentId',
  auditDocumentAction('DOCUMENT_DOWNLOADED'),
  async (req, res) => {
    // ... existing download logic
  }
);

router.get('/:documentId',
  auditDocumentAction('DOCUMENT_VIEWED'),
  async (req, res) => {
    // ... existing view logic
  }
);

router.delete('/:documentId',
  auditDocumentAction('DOCUMENT_DELETED'),
  async (req, res) => {
    // ... existing delete logic
  }
);

// Add access denied logging
router.use((req, res, next) => {
  const originalStatus = res.status;
  res.status = function(code) {
    if (code === 403 || code === 401) {
      auditDocumentAction('DOCUMENT_ACCESS_DENIED')(req, res, () => {});
    }
    return originalStatus.call(this, code);
  };
  next();
});
```

### **Step 4: Add Analysis Audit Points**
```javascript
// In documentAnalysisService.js
const { createAuditLog } = require('../middleware/documentAudit');

class DocumentAnalysisService {
  async analyzeDocument(documentId, analysisType, req) {
    // Audit analysis start
    await createAuditLog({
      action: 'DOCUMENT_ANALYSIS_STARTED',
      documentId,
      userId: req.user._id,
      practiceId: req.practice._id,
      severity: 'INFO',
      details: {
        analysisType,
        userRole: req.user.role
      }
    });
    
    try {
      // ... existing analysis logic
      
      // Audit successful completion
      await createAuditLog({
        action: 'DOCUMENT_ANALYSIS_COMPLETED',
        documentId,
        userId: req.user._id,
        practiceId: req.practice._id,
        severity: 'INFO',
        details: {
          analysisType,
          processingTime: Date.now() - startTime
        }
      });
      
    } catch (error) {
      // Audit analysis failure
      await createAuditLog({
        action: 'DOCUMENT_ANALYSIS_COMPLETED',
        documentId,
        userId: req.user._id,
        practiceId: req.practice._id,
        severity: 'ERROR',
        details: {
          analysisType,
          errorMessage: error.message
        }
      });
      throw error;
    }
  }
}
```

### **Step 5: Compliance Reporting**
```javascript
// Add route for compliance reports
router.get('/audit/compliance-report', async (req, res) => {
  try {
    const { startDate, endDate, userId, documentId } = req.query;
    
    const filter = {
      practiceId: req.practice._id,
      'complianceFlags.hipaaRelevant': true,
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    
    if (userId) filter.userId = userId;
    if (documentId) filter.documentId = documentId;
    
    const auditLogs = await DocumentAuditLog.find(filter)
      .populate('userId', 'name email role')
      .populate('documentId', 'fileName mimeType')
      .sort({ timestamp: -1 });
    
    res.json({
      success: true,
      logs: auditLogs,
      summary: {
        totalEvents: auditLogs.length,
        criticalEvents: auditLogs.filter(log => log.severity === 'CRITICAL').length,
        accessDenialEvents: auditLogs.filter(log => log.action === 'DOCUMENT_ACCESS_DENIED').length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

## 🧪 **Testing**
1. **Upload document:** Check audit log created
2. **View document:** Verify access logged
3. **Failed access:** Confirm denied access logged
4. **Generate compliance report:** Test filtering works

## ✅ **Success Criteria**
- [ ] All document operations audited
- [ ] HIPAA-compliant audit logs
- [ ] Failed access attempts logged
- [ ] Compliance reporting functional
- [ ] Real-time alerts for critical events
- [ ] 7-year retention policy implemented

## 🔄 **Next Task**
Proceed to: **Task 0.4:** Secure Temp File Handling

## 📝 **Compliance Notes**
- Audit logs must be tamper-proof
- Consider blockchain-based audit trail for high-security environments
- Implement log rotation and archival