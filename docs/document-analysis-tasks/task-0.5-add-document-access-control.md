# Task 0.5: Add Document Access Control

## 🔐 **ACCESS CONTROL TASK**
**Phase:** 0 (Critical Security)  
**Time Estimate:** 30 minutes  
**Risk Level:** CRITICAL  
**Priority:** URGENT  

## 🎯 **Objective**
Implement role-based access control (RBAC) for documents with granular permissions and patient consent management.

## 🚨 **Security Risk**
**CRITICAL:** Current access control gaps:
- No role-based document permissions
- Missing patient consent verification
- All users can access all documents in practice
- No audit trail for permission changes
- Emergency access not properly controlled

## 📁 **Files to Modify**
- `backend/middleware/documentAccessControl.js` (create new)
- `backend/models/DocumentPermission.js` (create new)
- `backend/models/PatientConsent.js` (create new)
- `backend/routes/documents.js`

## 🔧 **Implementation**

### **Step 1: Create Permission Models**
```javascript
// backend/models/DocumentPermission.js
const mongoose = require('mongoose');

const documentPermissionSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  practiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Practice',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  permissions: {
    canView: { type: Boolean, default: false },
    canDownload: { type: Boolean, default: false },
    canModify: { type: Boolean, default: false },
    canDelete: { type: Boolean, default: false },
    canShare: { type: Boolean, default: false },
    canAnalyze: { type: Boolean, default: false }
  },
  accessReasons: [{
    reason: {
      type: String,
      enum: ['DIRECT_CARE', 'CONSULTATION', 'EMERGENCY', 'QUALITY_ASSURANCE', 'RESEARCH', 'ADMINISTRATIVE'],
      required: true
    },
    timestamp: { type: Date, default: Date.now },
    justification: String
  }],
  constraints: {
    timeLimit: {
      startDate: Date,
      endDate: Date
    },
    purposeLimitation: [String],
    locationRestriction: [String],
    downloadLimit: { type: Number, default: -1 } // -1 = unlimited
  },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  grantedAt: { type: Date, default: Date.now },
  lastAccessed: Date,
  accessCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
documentPermissionSchema.index({ documentId: 1, userId: 1 }, { unique: true });
documentPermissionSchema.index({ practiceId: 1, userId: 1 });
documentPermissionSchema.index({ patientId: 1, userId: 1 });

module.exports = mongoose.model('DocumentPermission', documentPermissionSchema);
```

```javascript
// backend/models/PatientConsent.js
const mongoose = require('mongoose');

const patientConsentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  practiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Practice',
    required: true
  },
  consentType: {
    type: String,
    enum: ['DOCUMENT_ACCESS', 'DATA_SHARING', 'RESEARCH', 'QUALITY_IMPROVEMENT'],
    required: true
  },
  permissions: {
    allowAccess: { type: Boolean, default: true },
    allowSharing: { type: Boolean, default: false },
    allowResearch: { type: Boolean, default: false },
    allowQualityReview: { type: Boolean, default: true }
  },
  restrictions: {
    sensitiveCategories: [String], // Document categories requiring special consent
    prohibitedUsers: [mongoose.Schema.Types.ObjectId],
    timeRestrictions: {
      validFrom: Date,
      validUntil: Date
    }
  },
  consentGivenBy: {
    type: String,
    enum: ['PATIENT', 'LEGAL_GUARDIAN', 'HEALTHCARE_PROXY'],
    required: true
  },
  consentMethod: {
    type: String,
    enum: ['WRITTEN', 'ELECTRONIC', 'VERBAL_DOCUMENTED', 'IMPLIED'],
    required: true
  },
  documentedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  consentDate: { type: Date, required: true },
  expirationDate: Date,
  isActive: { type: Boolean, default: true },
  withdrawnAt: Date,
  withdrawnBy: mongoose.Schema.Types.ObjectId
}, {
  timestamps: true
});

patientConsentSchema.index({ patientId: 1, practiceId: 1, consentType: 1 });

module.exports = mongoose.model('PatientConsent', patientConsentSchema);
```

### **Step 2: Create Access Control Middleware**
```javascript
// backend/middleware/documentAccessControl.js
const DocumentPermission = require('../models/DocumentPermission');
const PatientConsent = require('../models/PatientConsent');
const { createAuditLog } = require('./documentAudit');

class DocumentAccessControl {
  static async checkDocumentAccess(req, res, next) {
    try {
      const { documentId } = req.params;
      const userId = req.user._id;
      const practiceId = req.practice._id;
      const action = req.method.toLowerCase();
      
      // Get document to find patient
      const Document = req.models.Document;
      const document = await Document.findById(documentId);
      
      if (!document) {
        return res.status(404).json({ success: false, message: 'Document not found' });
      }
      
      // Check patient consent first
      const hasConsent = await this.checkPatientConsent(
        document.patientId,
        practiceId,
        userId,
        action
      );
      
      if (!hasConsent) {
        await createAuditLog({
          action: 'DOCUMENT_ACCESS_DENIED',
          documentId,
          userId,
          practiceId,
          severity: 'WARNING',
          details: {
            reason: 'PATIENT_CONSENT_DENIED',
            fileName: document.fileName
          }
        });
        
        return res.status(403).json({
          success: false,
          message: 'Patient consent required for document access'
        });
      }
      
      // Check role-based permissions
      const hasPermission = await this.checkRolePermissions(
        documentId,
        userId,
        practiceId,
        action,
        req.user.role
      );
      
      if (!hasPermission) {
        await createAuditLog({
          action: 'DOCUMENT_ACCESS_DENIED',
          documentId,
          userId,
          practiceId,
          severity: 'WARNING',
          details: {
            reason: 'INSUFFICIENT_PERMISSIONS',
            userRole: req.user.role,
            requestedAction: action
          }
        });
        
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions for this action'
        });
      }
      
      // Log successful access
      await this.logDocumentAccess(documentId, userId, practiceId, action);
      
      // Store document info in request for further processing
      req.documentInfo = {
        document,
        patientId: document.patientId,
        hasEmergencyAccess: false
      };
      
      next();
      
    } catch (error) {
      console.error('Access control error:', error);
      res.status(500).json({ success: false, message: 'Access control check failed' });
    }
  }
  
  static async checkPatientConsent(patientId, practiceId, userId, action) {
    const consent = await PatientConsent.findOne({
      patientId,
      practiceId,
      consentType: 'DOCUMENT_ACCESS',
      isActive: true,
      $or: [
        { expirationDate: { $exists: false } },
        { expirationDate: { $gt: new Date() } }
      ]
    });
    
    if (!consent) {
      return false; // No consent found
    }
    
    // Check specific permissions based on action
    switch (action) {
      case 'get':
        return consent.permissions.allowAccess;
      case 'post':
      case 'put':
        return consent.permissions.allowAccess;
      case 'delete':
        return consent.permissions.allowAccess && req.user?.role === 'admin';
      default:
        return consent.permissions.allowAccess;
    }
  }
  
  static async checkRolePermissions(documentId, userId, practiceId, action, userRole) {
    // Check explicit document permissions
    const permission = await DocumentPermission.findOne({
      documentId,
      userId,
      practiceId,
      isActive: true
    });
    
    if (permission) {
      // Check time constraints
      if (permission.constraints?.timeLimit) {
        const now = new Date();
        if (now < permission.constraints.timeLimit.startDate ||
            now > permission.constraints.timeLimit.endDate) {
          return false;
        }
      }
      
      // Check action permissions
      switch (action) {
        case 'get':
          return permission.permissions.canView;
        case 'post':
          return permission.permissions.canModify;
        case 'put':
          return permission.permissions.canModify;
        case 'delete':
          return permission.permissions.canDelete;
        default:
          return false;
      }
    }
    
    // Fallback to role-based permissions
    return this.checkDefaultRolePermissions(userRole, action);
  }
  
  static checkDefaultRolePermissions(role, action) {
    const rolePermissions = {
      'doctor': {
        get: true,
        post: true,
        put: true,
        delete: false
      },
      'nurse': {
        get: true,
        post: true,
        put: false,
        delete: false
      },
      'admin': {
        get: true,
        post: true,
        put: true,
        delete: true
      },
      'receptionist': {
        get: false,
        post: true,
        put: false,
        delete: false
      }
    };
    
    return rolePermissions[role]?.[action] || false;
  }
  
  static async logDocumentAccess(documentId, userId, practiceId, action) {
    // Update access statistics
    await DocumentPermission.updateOne(
      { documentId, userId, practiceId },
      {
        $set: { lastAccessed: new Date() },
        $inc: { accessCount: 1 }
      },
      { upsert: true }
    );
  }
  
  static async grantEmergencyAccess(documentId, userId, practiceId, justification) {
    // Create emergency permission
    const emergencyPermission = new DocumentPermission({
      documentId,
      userId,
      practiceId,
      patientId: req.documentInfo?.patientId,
      permissions: {
        canView: true,
        canDownload: true,
        canModify: false,
        canDelete: false,
        canShare: false,
        canAnalyze: true
      },
      accessReasons: [{
        reason: 'EMERGENCY',
        justification
      }],
      constraints: {
        timeLimit: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      },
      grantedBy: userId
    });
    
    await emergencyPermission.save();
    
    // Log emergency access
    await createAuditLog({
      action: 'EMERGENCY_ACCESS_GRANTED',
      documentId,
      userId,
      practiceId,
      severity: 'CRITICAL',
      details: {
        justification,
        emergencyDuration: '24h'
      }
    });
    
    return emergencyPermission;
  }
}

module.exports = DocumentAccessControl;
```

### **Step 3: Apply Access Control to Routes**
```javascript
// In backend/routes/documents.js
const DocumentAccessControl = require('../middleware/documentAccessControl');

// Apply to all document access routes
router.get('/:documentId', 
  DocumentAccessControl.checkDocumentAccess,
  async (req, res) => {
    // Document access logic here
    // req.documentInfo contains pre-validated document
  }
);

router.delete('/:documentId',
  DocumentAccessControl.checkDocumentAccess,
  async (req, res) => {
    // Delete logic with validated access
  }
);

// Emergency access endpoint
router.post('/:documentId/emergency-access', async (req, res) => {
  try {
    const { justification } = req.body;
    
    if (!justification || justification.length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Detailed justification required for emergency access'
      });
    }
    
    const permission = await DocumentAccessControl.grantEmergencyAccess(
      req.params.documentId,
      req.user._id,
      req.practice._id,
      justification
    );
    
    res.json({
      success: true,
      message: 'Emergency access granted for 24 hours',
      permission
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

## 🧪 **Testing**
1. **Role permissions:** Test different user roles
2. **Patient consent:** Verify consent requirements
3. **Time constraints:** Test expired permissions
4. **Emergency access:** Verify emergency override works
5. **Audit logging:** Check all access is logged

## ✅ **Success Criteria**
- [ ] Role-based permissions enforced
- [ ] Patient consent verified
- [ ] Emergency access functional
- [ ] All access audited
- [ ] Time-based constraints work
- [ ] Cross-practice access blocked

## 🔄 **Next Task**
Proceed to: **Task 0.6:** Fix File Upload Validation

## 📝 **Access Control Notes**
- Implement principle of least privilege
- Regular permission audits required
- Emergency access limited to 24 hours
- All access decisions logged