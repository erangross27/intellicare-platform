# Security Cookbook - Copy These Examples

## Query Database
```javascript
// ✅ CORRECT:
const SecureDataAccess = require('./services/secureDataAccess');
const patients = await SecureDataAccess.query('patients',
  { practiceId: 'medical-center' },
  { token: serviceToken, fields: ['name', 'email'] }
);
```

## Make API Call
```javascript
// ✅ CORRECT:
import secureApi from './services/secureApiClient';
const data = await secureApi.post('/api/patients', patientData);
```

## Create Background Service
```javascript
// ✅ CORRECT:
class MyService {
  async initialize() {
    const auth = await serviceAccountManager.authenticate('my-service');
    this.serviceToken = auth.sessionToken;
  }
}
```

## Handle Errors Securely
```javascript
// ✅ CORRECT:
try {
  // operation
} catch (error) {
  await auditLogger.log({ action: 'ERROR', details: error.message });
  throw new SecureError('Operation failed'); // Generic message
}
```

## Authenticate User
```javascript
// ✅ CORRECT:
// Request magic link
await passwordlessAuth.requestLogin(email, practice);

// Validate magic link token
const session = await passwordlessAuth.validateMagicLink(token);
```

## Insert Data
```javascript
// ✅ CORRECT:
const SecureDataAccess = require('./services/secureDataAccess');
await SecureDataAccess.insert('patients', 
  { name, email, practiceId },
  { token: serviceToken }
);
```

## Update Data
```javascript
// ✅ CORRECT:
const SecureDataAccess = require('./services/secureDataAccess');
await SecureDataAccess.update('patients',
  { _id: patientId },
  { $set: { status: 'active' } },
  { token: serviceToken }
);
```

## Delete Data (Soft Delete)
```javascript
// ✅ CORRECT:
const SecureDataAccess = require('./services/secureDataAccess');
await SecureDataAccess.update('patients',
  { _id: patientId },
  { $set: { deleted: true, deletedAt: new Date() } },
  { token: serviceToken }
);
```

## Access Configuration
```javascript
// ✅ CORRECT:
const config = require('../config/default.json');
const apiKey = config.apiKey;
```

## Audit Logging
```javascript
// ✅ CORRECT:
const auditLogger = require('./middleware/auditLog').auditLogger;
await auditLogger.log({
  action: 'PATIENT_UPDATE',
  patientId,
  userId,
  timestamp: new Date()
});
```

## File Operations
```javascript
// ✅ CORRECT:
const secureFileSystem = require('./services/secureFileSystem');
const content = await secureFileSystem.readFile('allowed-file.txt');
```

## External API Call
```javascript
// ✅ CORRECT:
import secureApi from './services/secureApiClient';
const response = await secureApi.external('https://api.medicare.gov/data', {
  validateSSL: true,
  timeout: 10000
});
```

## WebSocket Connection
```javascript
// ✅ CORRECT:
const secureSocket = require('./services/secureWebSocket');
const socket = await secureSocket.connect('/realtime', {
  token: sessionToken
});
```

## Encrypt Sensitive Data
```javascript
// ✅ CORRECT:
const encryptionService = require('./services/encryptionService');
const encrypted = await encryptionService.encrypt(sensitiveData);
```

## Hash Passwords
```javascript
// ✅ CORRECT:
const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash(password, 12);
```

## Validate Input
```javascript
// ✅ CORRECT:
const validator = require('./utils/validator');
const sanitized = validator.sanitize(userInput, {
  type: 'string',
  maxLength: 100,
  pattern: /^[a-zA-Z0-9]+$/
});
```

## Service Manifest
```json
// ✅ CORRECT: /config/securityManifests/my-service.manifest.json
{
  "serviceId": "my-service",
  "permissions": ["read:patients", "write:patients"],
  "allowedCollections": ["patients"],
  "allowedClinics": ["*"],
  "rateLimit": { "requests": 1000, "per": "hour" }
}
```

## Test with Authentication
```javascript
// ✅ CORRECT:
const testAuth = require('./test/helpers/authHelper');
const token = await testAuth.getServiceToken('test-service');
const response = await secureApi.get('/api/patients', { token });
```

## Handle Rate Limiting
```javascript
// ✅ CORRECT:
try {
  await secureApi.get('/api/data');
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    await delay(error.retryAfter);
    // Retry
  }
}
```

## Multi-Tenant Query
```javascript
// ✅ CORRECT:
const SecureDataAccess = require('./services/secureDataAccess');
const data = await SecureDataAccess.query('patients',
  { practiceId: req.practice.id }, // Automatic practice isolation
  { token: serviceToken }
);
```