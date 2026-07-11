# 🤖 AI Agent Security Instructions

**MANDATORY FOR ALL AI AGENTS (Claude, Gemini, ChatGPT, etc.)**

This document provides step-by-step instructions for AI agents working on the IntelliCare codebase. Following these instructions is NOT optional - violations will be automatically blocked.

## 🚨 CRITICAL: Read This First

Your code will be **AUTOMATICALLY REJECTED** if you:
1. Use direct database access (mongoose, Model.find, etc.)
2. Use direct fetch() or axios calls
3. Skip audit logging
4. Use eval() or Function()
5. Access process.env directly
6. Create services without authentication

## 📋 Pre-Task Checklist

Before writing ANY code, ensure you have:

- [ ] Read `/docs/SECURITY-COOKBOOK.md`
- [ ] Read `CLAUDE.md` security section
- [ ] Located `SecureDataAccess` service
- [ ] Located `secureApiClient` service
- [ ] Located `auditLogger` middleware
- [ ] Understood the service authentication pattern

## 🔨 Step-by-Step Guide for Common Tasks

### Task 1: Query Database

**NEVER write:**
```javascript
const patients = await Patient.find({ practiceId });
```

**ALWAYS write:**
```javascript
// Step 1: Import SecureDataAccess
const SecureDataAccess = require('./services/secureDataAccess');
const auditLogger = require('./middleware/auditLog').auditLogger;

// Step 2: Log the operation
await auditLogger.log({
  action: 'QUERY_PATIENTS',
  userId: req.user.id,
  practiceId: req.practice.id
});

// Step 3: Use SecureDataAccess
const patients = await SecureDataAccess.query('patients',
  { practiceId: req.practice.id },
  { fields: ['name', 'email'] },
  {
    serviceId: 'patient-service',
    apiKey: serviceToken,
    practiceId: req.practice.id,
    userId: req.user.id
  }
);
```

### Task 2: Make API Call

**NEVER write:**
```javascript
const response = await fetch('/api/endpoint');
```

**ALWAYS write:**
```javascript
// Step 1: Import secureApiClient
const secureApiClient = require('./services/secureApiClient');
const auditLogger = require('./middleware/auditLog').auditLogger;

// Step 2: Log the API call
await auditLogger.log({
  action: 'API_CALL',
  endpoint: '/api/endpoint',
  userId: req.user.id
});

// Step 3: Use secureApiClient
const response = await secureApiClient.request('/api/endpoint', {
  method: 'GET',
  headers: {
    'X-User-Id': req.user.id,
    'X-Request-Id': crypto.randomUUID()
  }
});
```

### Task 3: Create New Service

**NEVER write:**
```javascript
class MyService {
  async doWork() {
    // Just start working
  }
}
```

**ALWAYS write:**
```javascript
// Step 1: Add security header comment
/**
 * 🔒 SECURITY NOTICE FOR AI AGENTS
 *
 * This service requires:
 * 1. Service account authentication
 * 2. SecureDataAccess for database operations
 * 3. Audit logging for all operations
 *
 * Direct database access will FAIL
 * Missing authentication will FAIL
 *
 * See: /docs/SECURITY-COOKBOOK.md
 */

// Step 2: Import required security modules
const serviceAccountManager = require('./services/serviceAccountManager');
const SecureDataAccess = require('./services/secureDataAccess');
const auditLogger = require('./middleware/auditLog').auditLogger;

// Step 3: Implement with authentication
class MyService {
  constructor() {
    this.serviceId = 'my-service';
    this.serviceToken = null;
  }

  async initialize() {
    // Authenticate service
    this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
    
    // Log startup
    await auditLogger.log({
      action: 'SERVICE_STARTUP',
      serviceId: this.serviceId
    });
  }

  async doWork(data) {
    // Ensure authenticated
    if (!this.serviceToken) {
      await this.initialize();
    }

    try {
      // Log operation
      await auditLogger.log({
        action: 'SERVICE_OPERATION',
        serviceId: this.serviceId
      });

      // Use SecureDataAccess for any DB operations
      const result = await SecureDataAccess.query('collection', filter, options, {
        serviceId: this.serviceId,
        apiKey: this.serviceToken
      });

      return result;
    } catch (error) {
      await auditLogger.log({
        action: 'SERVICE_ERROR',
        serviceId: this.serviceId,
        error: error.message
      });
      throw new SecureError('Operation failed');
    }
  }
}

// Step 4: Create manifest file at /config/securityManifests/my-service.manifest.json
```

### Task 4: Handle Errors

**NEVER write:**
```javascript
throw new Error(`Failed to process patient ${patient.ssn}: ${error.message}`);
```

**ALWAYS write:**
```javascript
// Step 1: Import audit logger
const auditLogger = require('./middleware/auditLog').auditLogger;

// Step 2: Log error securely
await auditLogger.log({
  action: 'PROCESSING_ERROR',
  patientId: patient.id, // Use ID, not SSN
  errorType: error.constructor.name
  // Never log sensitive data
});

// Step 3: Throw sanitized error
throw new SecureError('Failed to process patient data');
// Never include sensitive data in error messages
```

### Task 5: Handle Sensitive Data

**NEVER write:**
```javascript
console.log('Patient SSN:', patient.ssn);
user.password = req.body.password;
```

**ALWAYS write:**
```javascript
// Step 1: Import encryption service
const encryptionService = require('./services/encryptionService');
const bcrypt = require('bcrypt');

// Step 2: Hash passwords
const hashedPassword = await bcrypt.hash(password, 12);
await SecureDataAccess.update('users',
  { _id: userId },
  { $set: { passwordHash: hashedPassword } }
);

// Step 3: Encrypt sensitive fields
const encryptedSSN = await encryptionService.encrypt(ssn);
await SecureDataAccess.insert('patients',
  { ...patientData, ssn: encryptedSSN }
);

// Step 4: Never log sensitive data
await auditLogger.log({
  action: 'PATIENT_UPDATE',
  patientId: patient.id
  // No SSN, no passwords, no sensitive data
});
```

## 🧪 Testing Your Code

Before submitting, test that your code:

### 1. Passes Security Validation
```bash
npm run security:check
```

### 2. Creates Audit Logs
```javascript
// Add test to verify audit logging
const auditSpy = sinon.spy(auditLogger, 'log');
await yourFunction();
assert(auditSpy.called);
```

### 3. Handles Errors Securely
```javascript
// Test that errors don't expose sensitive data
try {
  await processSSN('123-45-6789');
} catch (error) {
  assert(!error.message.includes('123-45-6789'));
}
```

### 4. Uses Secure Services
```javascript
// Test that direct DB access fails
try {
  await mongoose.connection.db.collection('test').find();
  assert.fail('Direct DB access should be blocked');
} catch (error) {
  assert(error.message.includes('BLOCKED'));
}
```

## 📝 Security Checklist for New Features

Before implementing ANY feature:

### Planning Phase
- [ ] Identify all database operations needed
- [ ] Identify all API calls needed
- [ ] Identify sensitive data that will be handled
- [ ] Plan audit logging strategy
- [ ] Check if service authentication is needed

### Implementation Phase
- [ ] Import SecureDataAccess for DB operations
- [ ] Import secureApiClient for API calls
- [ ] Import auditLogger for logging
- [ ] Add try-catch error handling
- [ ] Sanitize all error messages
- [ ] Encrypt sensitive data
- [ ] Add service authentication if needed

### Testing Phase
- [ ] Write security tests
- [ ] Test audit logging
- [ ] Test error handling
- [ ] Run security validation
- [ ] Check for hardcoded secrets
- [ ] Verify no direct DB access
- [ ] Verify no direct fetch() calls

### Review Phase
- [ ] Run `npm run security:check`
- [ ] Run `npm run security:audit`
- [ ] Review audit logs
- [ ] Check error messages don't expose data
- [ ] Verify all operations are logged

## 🚫 Common Violations That Will Block Your Code

### 1. Direct Database Access
```javascript
// ❌ ALL OF THESE ARE BLOCKED
Patient.findById(id)
mongoose.connection.db.collection('patients')
await model.save()
db.patients.insertOne()
```

### 2. Direct API Calls
```javascript
// ❌ ALL OF THESE ARE BLOCKED
fetch('/api/data')
axios.get('/api/endpoint')
http.request(options)
$.ajax({ url: '/api/data' })
```

### 3. Missing Audit Logs
```javascript
// ❌ THIS IS BLOCKED
async function deletePatient(id) {
  // No audit log = blocked
  return await SecureDataAccess.delete('patients', { _id: id });
}
```

### 4. Hardcoded Secrets
```javascript
// ❌ ALL OF THESE ARE BLOCKED
const apiKey = 'sk_live_1234';
const password = 'admin123';
const connectionString = 'mongodb://user:<DB_PASSWORD>@host';
```

### 5. Dangerous Functions
```javascript
// ❌ ALL OF THESE ARE BLOCKED
eval(userInput)
new Function(code)
setTimeout(stringCode, 1000)
setInterval(stringCode, 1000)
```

## 🎯 Quick Decision Tree

```
Need to query database?
├── ❌ DON'T use mongoose/Model
└── ✅ USE SecureDataAccess.query()

Need to make API call?
├── ❌ DON'T use fetch/axios
└── ✅ USE secureApiClient.request()

Need configuration value?
├── ❌ DON'T use process.env
└── ✅ USE config module

Need to log something?
├── Is it sensitive data?
│   ├── YES → ❌ DON'T log it
│   └── NO → ✅ USE auditLogger
└── Is it an error?
    ├── YES → Sanitize first
    └── NO → Log normally

Creating a service?
├── ❌ DON'T skip authentication
└── ✅ USE serviceAccountManager

Handling an error?
├── ❌ DON'T expose sensitive data
└── ✅ USE generic error messages
```

## 📚 Required Reading

1. `/docs/SECURITY-COOKBOOK.md` - Detailed examples
2. `CLAUDE.md` - Project memory with security rules
3. `/backend/config/aiSecurityTemplates.json` - Approved patterns
4. `.eslintrc.security.json` - Linting rules

## 🆘 Getting Help

If you're unsure about security requirements:

1. Check `/docs/SECURITY-COOKBOOK.md` for examples
2. Look for similar code in existing services
3. Run `npm run security:check` to validate
4. Review error messages - they provide secure alternatives

## ⚠️ Final Warning

**Your code WILL be automatically rejected if you violate these rules.**

The security systems will:
1. Block your commits (pre-commit hooks)
2. Fail your builds (ESLint rules)
3. Prevent execution (runtime validation)
4. Log violations (audit trail)
5. Suspend services (after multiple violations)

There are NO exceptions to these rules. Follow them exactly.

---

Last Updated: December 2024
Version: 1.0
Status: MANDATORY