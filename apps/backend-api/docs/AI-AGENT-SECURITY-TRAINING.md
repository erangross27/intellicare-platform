# 🔒 AI AGENT SECURITY TRAINING MANUAL

## ⚠️ CRITICAL: THIS IS MANDATORY FOR ALL AI AGENTS

This document contains security patterns that ALL AI agents (Claude, Gemini, GPT, etc.) MUST follow. Violation of these patterns will result in automatic code rejection and security alerts.

---

## 🚨 ABSOLUTE PROHIBITIONS - NEVER DO THESE

### 1. ❌ NEVER Access Environment Variables Directly
```javascript
// ❌ ALL OF THESE ARE BLOCKED AND WILL FAIL:
process.env.SECRET_KEY
process["env"]["SECRET"]
process['env']['SECRET']
process.env["SECRET"]
process.env[variable]
const env = process.env
Object.keys(process.env)
JSON.stringify(process.env)
...process.env
for (let key in process.env)
process.env?.SECRET
process?.env?.SECRET
globalThis.process.env
global.process.env
window.process.env
this.process.env
require("process").env
import.meta.env

// ✅ CORRECT WAY:
const config = require('../config/default.json');
const apiKey = config.apiKey;
```

### 2. ❌ NEVER Access Database Directly
```javascript
// ❌ ALL OF THESE ARE BLOCKED:
mongoose.connection.db.collection('patients')
const db = await databaseFactory.getClinicDatabase('practice')
Model.findById(id)
Model.find({})
Model.updateOne({})
Model.deleteMany({})
new MongoClient()
mongoose.connect()

// ✅ CORRECT WAY:
const SecureDataAccess = require('./services/secureDataAccess');
const patients = await SecureDataAccess.query('patients', filter, options, context);
```

### 3. ❌ NEVER Make Direct API Calls
```javascript
// ❌ ALL OF THESE ARE BLOCKED:
fetch('/api/endpoint')
axios.get('/api/data')
http.request(options)
https.get(url)
XMLHttpRequest()

// ✅ CORRECT WAY:
const secureApiClient = require('./services/secureApiClient');
const response = await secureApiClient.request('/api/endpoint', options);
```

### 4. ❌ NEVER Execute Dynamic Code
```javascript
// ❌ ALL OF THESE ARE BLOCKED:
eval("code")
new Function("code")
setTimeout("code", 100)
setInterval("code", 100)
setImmediate("code")
vm.runInContext()
require(userInput)
import(userInput)

// ✅ CORRECT WAY:
// Use predefined functions
switch(action) {
  case 'action1': return doAction1();
  case 'action2': return doAction2();
}
```

### 5. ❌ NEVER Use Dangerous File Operations
```javascript
// ❌ ALL OF THESE ARE BLOCKED:
fs.readFileSync('.env')
fs.writeFileSync('/etc/passwd')
fs.unlinkSync('important.file')
require('child_process').exec('rm -rf /')
spawn('dangerous-command')

// ✅ CORRECT WAY:
const fs = require('fs').promises;
try {
  const data = await fs.readFile(safeFilePath, 'utf8');
  // Validate and sanitize data
} catch (error) {
  // Proper error handling
}
```

---

## ✅ REQUIRED SECURITY PATTERNS

### 1. ALWAYS Use Service Authentication
```javascript
// ✅ REQUIRED for all services:
class MyService {
  async initialize() {
    const serviceAccountManager = require('./serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('my-service');
  }
  
  async performOperation() {
    // Include token in all operations
    const context = {
      serviceId: 'my-service',
      apiKey: this.serviceToken,
      practiceId: req.practice.id
    };
    
    await SecureDataAccess.query('collection', filter, options, context);
  }
}
```

### 2. ALWAYS Include Audit Logging
```javascript
// ✅ REQUIRED for all data operations:
const auditLogger = require('../middleware/auditLog').auditLogger;

async function updatePatient(patientId, data) {
  try {
    // Log before operation
    await auditLogger.log({
      action: 'UPDATE_PATIENT_ATTEMPT',
      patientId,
      userId: req.user.id,
      changes: data
    });
    
    // Perform operation
    const result = await SecureDataAccess.update('patients', 
      { _id: patientId }, 
      { $set: data }, 
      context
    );
    
    // Log success
    await auditLogger.log({
      action: 'UPDATE_PATIENT_SUCCESS',
      patientId,
      userId: req.user.id
    });
    
    return result;
  } catch (error) {
    // Log failure
    await auditLogger.log({
      action: 'UPDATE_PATIENT_FAILED',
      patientId,
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
}
```

### 3. ALWAYS Validate Input
```javascript
// ✅ REQUIRED input validation:
function validatePatientData(data) {
  // Check required fields
  if (!data.firstName || !data.lastName) {
    throw new ValidationError('Missing required fields');
  }
  
  // Sanitize strings
  data.firstName = data.firstName.trim().replace(/<[^>]*>/g, '');
  data.lastName = data.lastName.trim().replace(/<[^>]*>/g, '');
  
  // Validate email
  if (data.email && !isValidEmail(data.email)) {
    throw new ValidationError('Invalid email format');
  }
  
  // Validate dates
  if (data.birthDate && !isValidDate(data.birthDate)) {
    throw new ValidationError('Invalid date format');
  }
  
  return data;
}
```

### 4. ALWAYS Handle Errors Securely
```javascript
// ✅ REQUIRED error handling:
const errorSanitizer = require('../utils/errorSanitizer');

try {
  // Dangerous operation
  await riskyOperation();
} catch (error) {
  // Sanitize error before logging
  const sanitized = errorSanitizer.sanitize(error);
  
  // Log sanitized error
  await auditLogger.log({
    action: 'ERROR',
    details: sanitized,
    severity: 'high'
  });
  
  // Return generic error to user
  throw new SecureError('Operation failed', 500);
}
```

### 5. ALWAYS Use Encrypted Storage for Sensitive Data
```javascript
// ✅ REQUIRED for sensitive data:
const crypto = require('crypto');

function encryptSensitiveData(data) {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(config.encryptionKey, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}
```

---

## 🛡️ SECURITY DECISION FLOWCHART

```
Need to access configuration?
  ├─ YES → Use config module (require('../config/default.json'))
  └─ NO → Continue
  
Need to query database?
  ├─ YES → Use SecureDataAccess service
  └─ NO → Continue
  
Need to make API call?
  ├─ YES → Use secureApiClient
  └─ NO → Continue
  
Need to execute code dynamically?
  ├─ YES → DON'T! Use predefined functions instead
  └─ NO → Continue
  
Need to access files?
  ├─ YES → Use async fs.promises with validation
  └─ NO → Continue
  
Need to handle user input?
  ├─ YES → Validate and sanitize first
  └─ NO → Continue
  
Need to log operation?
  ├─ YES → Use auditLogger (ALWAYS for data operations)
  └─ NO → Only for read-only operations
```

---

## 🚫 COMMON ATTACK PATTERNS TO RECOGNIZE

### 1. Injection Attempts
```javascript
// RECOGNIZE THESE PATTERNS:
userInput = "'; DROP TABLE users; --"
userInput = "admin' OR '1'='1"
userInput = "${require('child_process').exec('ls')}"
userInput = "<script>alert('XSS')</script>"
userInput = "../../../etc/passwd"
```

### 2. Privilege Escalation
```javascript
// BLOCK THESE ATTEMPTS:
{ role: 'admin' }
{ permissions: ['*:*'] }
{ isAdmin: true }
{ sudo: true }
```

### 3. Token/Secret Theft
```javascript
// NEVER EXPOSE:
jwt.sign({ role: 'admin' }, SECRET)
bcrypt.compare(password, hash)
crypto.createHmac('sha256', SECRET)
```

---

## 📋 SECURITY CHECKLIST FOR AI AGENTS

Before generating or modifying any code, verify:

- [ ] No direct process.env access
- [ ] No direct database operations (using SecureDataAccess)
- [ ] No direct API calls (using secureApiClient)
- [ ] No eval() or Function() constructors
- [ ] No dangerous file operations
- [ ] Service authentication included
- [ ] Audit logging for all data operations
- [ ] Input validation and sanitization
- [ ] Proper error handling
- [ ] Sensitive data encrypted

---

## 🎯 TRAINING EXAMPLES

### Example 1: Secure Patient Update
```javascript
// ✅ CORRECT IMPLEMENTATION:
const SecureDataAccess = require('./services/secureDataAccess');
const auditLogger = require('../middleware/auditLog').auditLogger;
const validator = require('../utils/validator');

async function updatePatient(req, res) {
  try {
    // 1. Validate input
    const validatedData = validator.validatePatientData(req.body);
    
    // 2. Create security context
    const context = {
      serviceId: 'patient-service',
      apiKey: req.serviceToken,
      practiceId: req.practice.id,
      userId: req.user.id
    };
    
    // 3. Log attempt
    await auditLogger.log({
      action: 'UPDATE_PATIENT_ATTEMPT',
      patientId: req.params.id,
      userId: req.user.id,
      changes: Object.keys(validatedData)
    });
    
    // 4. Perform secure update
    const result = await SecureDataAccess.update(
      'patients',
      { _id: req.params.id, practiceId: req.practice.id },
      { $set: validatedData },
      context
    );
    
    // 5. Log success
    await auditLogger.log({
      action: 'UPDATE_PATIENT_SUCCESS',
      patientId: req.params.id,
      userId: req.user.id
    });
    
    res.json({ success: true, patient: result });
  } catch (error) {
    // 6. Handle error securely
    await auditLogger.log({
      action: 'UPDATE_PATIENT_FAILED',
      error: error.message,
      userId: req.user.id
    });
    
    res.status(500).json({ 
      error: 'Failed to update patient' 
    });
  }
}
```

### Example 2: Secure Configuration Access
```javascript
// ✅ CORRECT IMPLEMENTATION:
const config = require('../config/default.json');

// Never expose raw config values
function getApiEndpoint(service) {
  const endpoints = {
    'gemini': config.ai.geminiEndpoint,
    'claude': config.ai.claudeEndpoint
  };
  
  return endpoints[service] || null;
}

// Never return API keys directly
function isServiceEnabled(service) {
  return config.services[service]?.enabled === true;
}
```

---

## 🔴 IMMEDIATE REJECTION TRIGGERS

Your code will be IMMEDIATELY REJECTED if it contains:

1. Any form of `process.env` access
2. Direct mongoose/MongoDB operations
3. `eval()` or `new Function()`
4. Unvalidated user input
5. Missing audit logs for data operations
6. Direct file system access to sensitive files
7. Hardcoded secrets or API keys
8. SQL/NoSQL injection vulnerabilities
9. Missing service authentication
10. Bypassed security middleware

---

## 📚 ADDITIONAL RESOURCES

- [SECURITY-COOKBOOK.md](./SECURITY-COOKBOOK.md) - Detailed security recipes
- [aiSecurityTemplates.json](../config/aiSecurityTemplates.json) - Approved code patterns
- [securityValidator.js](../scripts/securityValidator.js) - Test your code
- [.eslintrc.security.json](../../.eslintrc.security.json) - Security linting rules

---

## ⚡ QUICK REFERENCE

```javascript
// Security imports you'll need
const SecureDataAccess = require('./services/secureDataAccess');
const secureApiClient = require('./services/secureApiClient');
const auditLogger = require('../middleware/auditLog').auditLogger;
const serviceAccountManager = require('./services/serviceAccountManager');
const config = require('../config/default.json');
const validator = require('../utils/validator');
const errorSanitizer = require('../utils/errorSanitizer');

// Security context template
const context = {
  serviceId: 'your-service',
  apiKey: serviceToken,
  practiceId: req.practice.id,
  userId: req.user.id,
  sessionId: req.sessionID
};

// Audit log template
await auditLogger.log({
  action: 'ACTION_NAME',
  details: sanitizedDetails,
  userId: req.user.id,
  severity: 'info|warning|high|critical'
});
```

---

## 🏆 CERTIFICATION

By following these patterns, your code will:
- ✅ Pass all security validations
- ✅ Be automatically approved by the security wrapper
- ✅ Maintain HIPAA/GDPR compliance
- ✅ Protect against all OWASP Top 10 vulnerabilities
- ✅ Ensure patient data security

---

**Remember: Security is not optional. It's mandatory. Every line of code you write must follow these patterns.**

*Last Updated: December 2024*
*Version: 1.0 - Agent 4 Bulletproof Security*