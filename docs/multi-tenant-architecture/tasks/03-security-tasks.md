# Security Tasks - Phase 1

## Overview
Implement encryption, security middleware, and HIPAA-compliant security measures.

## Task 3.1: Implement Field-Level Encryption
**Estimated Time**: 45 minutes
**Priority**: HIGH

### Checklist:
- [ ] Create encryption utility functions
- [ ] Encrypt sensitive patient fields
- [ ] Implement practice-specific encryption keys
- [ ] Add decryption for data retrieval
- [ ] Test encryption/decryption flow

### Implementation:
```javascript
// utils/encryption.js
const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
  }

  encrypt(text, clinicKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, clinicKey);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData, clinicKey) {
    const decipher = crypto.createDecipher(this.algorithm, clinicKey);
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Encrypt sensitive fields in Patient model
patientSchema.pre('save', function(next) {
  if (this.isModified('personalInfo.ssn')) {
    const encrypted = encryptionService.encrypt(this.personalInfo.ssn, this.clinicKey);
    this.personalInfo.ssnEncrypted = encrypted;
    this.personalInfo.ssn = undefined;
  }
  next();
});
```

### Success Criteria:
- [ ] Encryption service created
- [ ] Sensitive fields encrypted
- [ ] Decryption works correctly
- [ ] Performance acceptable

---

## Task 3.2: Create Security Middleware
**Estimated Time**: 35 minutes
**Priority**: HIGH

### Checklist:
- [ ] Implement rate limiting
- [ ] Add request validation
- [ ] Create security headers middleware
- [ ] Add IP whitelisting support
- [ ] Test security measures

### Implementation:
```javascript
// middleware/security.js
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Rate limiting
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// IP whitelist validation
function ipWhitelist(req, res, next) {
  const clientIp = req.ip;
  const practice = req.practice;
  
  if (practice.security.ipWhitelist && practice.security.ipWhitelist.length > 0) {
    if (!practice.security.ipWhitelist.includes(clientIp)) {
      return res.status(403).json({ error: 'IP address not whitelisted' });
    }
  }
  
  next();
}
```

### Success Criteria:
- [ ] Rate limiting active
- [ ] Security headers set
- [ ] IP whitelisting works
- [ ] Request validation implemented

---

## Task 3.3: Implement Audit Logging
**Estimated Time**: 40 minutes
**Priority**: HIGH

### Checklist:
- [ ] Create audit log model
- [ ] Add logging middleware
- [ ] Log all PHI access
- [ ] Include user and practice context
- [ ] Test audit trail

### Implementation:
```javascript
// models/AuditLog.js
const auditLogSchema = new mongoose.Schema({
  practiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Practice', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // 'create', 'read', 'update', 'delete'
  resource: { type: String, required: true }, // 'patient', 'document', 'user'
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  details: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    fields: [String],
    reason: String
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    sessionId: String,
    timestamp: { type: Date, default: Date.now }
  },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' }
});

// Audit logging middleware
async function auditLog(action, resource, resourceId, details = {}) {
  try {
    await AuditLog.create({
      practiceId: req.practiceId,
      userId: req.user._id,
      action,
      resource,
      resourceId,
      details,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionID
      }
    });
  } catch (error) {
    console.error('Audit logging failed:', error);
  }
}
```

### Success Criteria:
- [ ] Audit log model created
- [ ] All actions logged
- [ ] PHI access tracked
- [ ] Metadata captured

---

## Task 3.4: Add Input Validation and Sanitization
**Estimated Time**: 30 minutes
**Priority**: HIGH

### Checklist:
- [ ] Install validation libraries
- [ ] Create validation schemas
- [ ] Add input sanitization
- [ ] Validate all API inputs
- [ ] Test with malicious inputs

### Implementation:
```javascript
// validation/schemas.js
const Joi = require('joi');

const patientSchema = Joi.object({
  personalInfo: Joi.object({
    firstName: Joi.string().trim().min(1).max(50).required(),
    lastName: Joi.string().trim().min(1).max(50).required(),
    dateOfBirth: Joi.date().max('now').required(),
    ssn: Joi.string().pattern(/^\d{3}-\d{2}-\d{4}$/).optional()
  }).required(),
  contact: Joi.object({
    email: Joi.string().email().optional(),
    phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional()
  })
});

// Validation middleware
function validateInput(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }
    
    req.body = value;
    next();
  };
}
```

### Success Criteria:
- [ ] Validation schemas created
- [ ] Input sanitization works
- [ ] Malicious inputs blocked
- [ ] Error messages helpful

---

## Task 3.5: Implement Document Encryption
**Estimated Time**: 35 minutes
**Priority**: HIGH

### Checklist:
- [ ] Encrypt uploaded documents
- [ ] Generate document-specific keys
- [ ] Store encrypted content in database
- [ ] Implement secure document retrieval
- [ ] Test document encryption flow

### Implementation:
```javascript
// Document encryption service
class DocumentEncryption {
  async encryptDocument(fileBuffer, practiceId) {
    // Generate document-specific key
    const documentKey = crypto.randomBytes(32);
    
    // Encrypt document content
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', documentKey);
    
    const encryptedContent = Buffer.concat([
      cipher.update(fileBuffer),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Encrypt document key with practice master key
    const clinicMasterKey = await this.getClinicMasterKey(practiceId);
    const encryptedKey = this.encryptKey(documentKey, clinicMasterKey);
    
    return {
      encryptedContent,
      encryptedKey,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  async decryptDocument(encryptedData, practiceId) {
    // Decrypt document key
    const clinicMasterKey = await this.getClinicMasterKey(practiceId);
    const documentKey = this.decryptKey(encryptedData.encryptedKey, clinicMasterKey);
    
    // Decrypt document content
    const decipher = crypto.createDecipher('aes-256-gcm', documentKey);
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    const decryptedContent = Buffer.concat([
      decipher.update(encryptedData.encryptedContent),
      decipher.final()
    ]);
    
    return decryptedContent;
  }
}
```

### Success Criteria:
- [ ] Documents encrypted
- [ ] Keys managed securely
- [ ] Retrieval works
- [ ] Performance acceptable

---

## Task 3.6: Add HTTPS and SSL Configuration
**Estimated Time**: 25 minutes
**Priority**: HIGH

### Checklist:
- [ ] Generate SSL certificates for local development
- [ ] Configure HTTPS server
- [ ] Add SSL redirect middleware
- [ ] Test secure connections
- [ ] Prepare for cloud SSL

### Implementation:
```javascript
// server.js - HTTPS configuration
const https = require('https');
const fs = require('fs');

// For local development
const sslOptions = {
  key: fs.readFileSync('./ssl/private-key.pem'),
  cert: fs.readFileSync('./ssl/certificate.pem')
};

// Create HTTPS server
const httpsServer = https.createServer(sslOptions, app);

// Redirect HTTP to HTTPS
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});

// Start server
httpsServer.listen(443, () => {
  console.log('HTTPS Server running on port 443');
});

// Generate self-signed certificate for development
// openssl req -x509 -newkey rsa:4096 -keyout private-key.pem -out certificate.pem -days 365 -nodes
```

### Success Criteria:
- [ ] HTTPS configured
- [ ] SSL certificates working
- [ ] HTTP redirects to HTTPS
- [ ] Secure connections verified

---

## Task 3.7: Implement Security Monitoring
**Estimated Time**: 30 minutes
**Priority**: MEDIUM

### Checklist:
- [ ] Create security event logging
- [ ] Monitor failed login attempts
- [ ] Detect unusual access patterns
- [ ] Add alerting for security events
- [ ] Test monitoring system

### Implementation:
```javascript
// Security monitoring service
class SecurityMonitor {
  async logSecurityEvent(type, details, severity = 'medium') {
    await SecurityEvent.create({
      type, // 'failed_login', 'suspicious_access', 'permission_violation'
      details,
      severity,
      timestamp: new Date(),
      practiceId: details.practiceId,
      userId: details.userId,
      ipAddress: details.ipAddress
    });
    
    // Alert on high severity events
    if (severity === 'high' || severity === 'critical') {
      await this.sendSecurityAlert(type, details);
    }
  }

  async detectSuspiciousActivity(userId, action) {
    // Check for rapid successive actions
    const recentActions = await AuditLog.find({
      userId,
      action,
      'metadata.timestamp': { $gte: new Date(Date.now() - 60000) } // Last minute
    });
    
    if (recentActions.length > 10) {
      await this.logSecurityEvent('suspicious_activity', {
        userId,
        action,
        count: recentActions.length
      }, 'high');
    }
  }
}
```

### Success Criteria:
- [ ] Security events logged
- [ ] Suspicious activity detected
- [ ] Alerts configured
- [ ] Monitoring dashboard ready

---

## Completion Checklist

### Before Moving to Next Phase:
- [ ] Field-level encryption implemented
- [ ] Security middleware active
- [ ] Audit logging comprehensive
- [ ] Input validation working
- [ ] Document encryption functional
- [ ] HTTPS configured
- [ ] Security monitoring active
- [ ] All security tests passing

### Validation Steps:
1. **Test encryption/decryption of sensitive data**
2. **Verify audit logs capture all actions**
3. **Test rate limiting and security headers**
4. **Validate input sanitization**
5. **Test document encryption flow**
6. **Verify HTTPS connections**
7. **Test security monitoring alerts**

### Next Phase:
Once all security tasks are complete, proceed to **[04-rbac-tasks.md](./04-rbac-tasks.md)**
