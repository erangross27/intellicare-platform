# Task 0.2: Implement Document Encryption

## 🔐 **SECURITY TASK**
**Phase:** 0 (Critical Security)  
**Time Estimate:** 25 minutes  
**Risk Level:** CRITICAL  
**Priority:** URGENT  

## 🎯 **Objective**
Implement encryption at rest for all medical documents to protect sensitive patient data.

## 🚨 **Security Risk**
**CRITICAL:** Documents stored in plain text including:
- Lab results with patient data
- Medical reports
- Prescription information
- Diagnostic images

## 📁 **Files to Modify**
- `backend/services/documentAnalysisService.js`
- `backend/models/Document.js`
- `backend/routes/documents.js`
- `backend/config/encryption.js` (create new)

## 🔧 **Implementation**

### **Step 1: Create Encryption Service**
```javascript
// backend/config/encryption.js
const crypto = require('crypto');
const algorithm = 'aes-256-gcm';

class DocumentEncryption {
  constructor() {
    this.key = Buffer.from(process.env.DOCUMENT_ENCRYPTION_KEY, 'hex');
  }

  encrypt(buffer) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, this.key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData, iv, authTag) {
    const decipher = crypto.createDecipheriv(
      algorithm,
      this.key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
    
    return decrypted;
  }
}

module.exports = new DocumentEncryption();
```

### **Step 2: Update Document Model**
```javascript
// Add to Document schema
const documentSchema = new Schema({
  // ... existing fields
  encryption: {
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    algorithm: { type: String, default: 'aes-256-gcm' },
    version: { type: Number, default: 1 }
  },
  isEncrypted: { type: Boolean, default: true }
});
```

### **Step 3: Encrypt on Upload**
```javascript
// In document upload route
const documentEncryption = require('../config/encryption');

router.post('/upload/:patientId', upload.single('document'), async (req, res) => {
  try {
    const fileBuffer = req.file.buffer;
    
    // Encrypt the document
    const { encrypted, iv, authTag } = documentEncryption.encrypt(fileBuffer);
    
    // Save encrypted document
    const document = new Document({
      patientId: req.params.patientId,
      practiceId: req.practice._id,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      data: encrypted, // Store encrypted data
      encryption: { iv, authTag },
      isEncrypted: true,
      uploadedBy: req.user._id
    });
    
    await document.save();
    
    // Clear sensitive data from memory
    fileBuffer.fill(0);
    
    res.json({ success: true, documentId: document._id });
  } catch (error) {
    console.error('Encryption error:', error);
    res.status(500).json({ success: false, message: 'Encryption failed' });
  }
});
```

### **Step 4: Decrypt on Retrieval**
```javascript
// In document retrieval route
router.get('/download/:documentId', async (req, res) => {
  try {
    const Document = req.models.Document;
    const document = await Document.findOne({
      _id: req.params.documentId,
      practiceId: req.practice._id
    });
    
    if (!document) {
      return res.status(404).json({ success: false });
    }
    
    // Decrypt document
    const decrypted = documentEncryption.decrypt(
      document.data,
      document.encryption.iv,
      document.encryption.authTag
    );
    
    // Set proper headers
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    
    // Send decrypted data
    res.send(decrypted);
    
    // Audit log
    await AuditLog.create({
      action: 'DOCUMENT_ACCESSED',
      userId: req.user._id,
      documentId: document._id,
      practiceId: req.practice._id
    });
  } catch (error) {
    console.error('Decryption error:', error);
    res.status(500).json({ success: false, message: 'Decryption failed' });
  }
});
```

### **Step 5: Key Management**
```javascript
// Generate encryption key (one-time setup)
const generateEncryptionKey = () => {
  const key = crypto.randomBytes(32);
  console.log('DOCUMENT_ENCRYPTION_KEY=' + key.toString('hex'));
  // Store this in .env file
};

// Key rotation support
const rotateEncryptionKey = async () => {
  // Re-encrypt all documents with new key
  // This should be done during maintenance window
};
```

## ⚠️ **Security Considerations**
- Store encryption keys in secure key management service
- Never log encryption keys
- Implement key rotation policy
- Use different keys per practice for additional security
- Clear sensitive data from memory after use

## 🧪 **Testing**
1. **Encryption verification:**
   - Upload document
   - Check database - data should be encrypted
   - Download document - should decrypt properly

2. **Key security:**
   - Ensure keys not exposed in logs
   - Verify key rotation works

3. **Performance:**
   - Test with large documents (>10MB)
   - Measure encryption/decryption time

## ✅ **Success Criteria**
- [ ] All documents encrypted at rest
- [ ] Encryption keys properly managed
- [ ] Decryption works seamlessly
- [ ] No performance degradation >10%
- [ ] Audit logging for access
- [ ] Memory cleared after operations

## 🔄 **Next Task**
Proceed to: **Task 0.3:** Add Document Audit Trail

## 📝 **Notes**
- Consider using AWS KMS or Azure Key Vault for production
- Implement automatic key rotation every 90 days
- Monitor for encryption/decryption failures