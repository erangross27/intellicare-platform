# AGENT 1: FIX ALL AUDITLOG REFERENCES - SERVER IS DOWN!

## URGENT: Replace ALL auditLog references in these 6 files

The server cannot start because `auditLog` module doesn't exist. You must replace ALL references with `immutableAuditService`.

## EXACT REPLACEMENTS NEEDED:

### File 1: backend/services/agentServiceWrapper.js
**FIND:**
```javascript
const auditLogger = require('../middleware/auditLog').auditLogger;
```
**REPLACE WITH:**
```javascript
const immutableAuditService = require('./immutableAuditService');
```

**THEN FIND ALL:**
```javascript
auditLogger.log(
```
**REPLACE WITH:**
```javascript
immutableAuditService.addAuditEntry(
```

### File 2: backend/services/batchResultsWorker.js
**FIND:**
```javascript
const auditLog = require('../middleware/auditLog');
```
**REPLACE WITH:**
```javascript
const immutableAuditService = require('./immutableAuditService');
```

**THEN FIND ALL:**
```javascript
auditLog.logBatchOperation(
```
**REPLACE WITH:**
```javascript
immutableAuditService.logServiceOperation(
```

**AND FIND ALL:**
```javascript
auditLog.log(
```
**REPLACE WITH:**
```javascript
immutableAuditService.addAuditEntry(
```

### File 3: backend/services/reminderService.js
**FIND:**
```javascript
const auditLog = require('../middleware/auditLog');
```
**REPLACE WITH:**
```javascript
const immutableAuditService = require('./immutableAuditService');
```

**THEN FIND ALL:**
```javascript
auditLog.logReminderOperation(
```
**REPLACE WITH:**
```javascript
immutableAuditService.logServiceOperation(
```

**AND FIND ALL:**
```javascript
auditLog.log(
```
**REPLACE WITH:**
```javascript
immutableAuditService.addAuditEntry(
```

### File 4: backend/monitoring/aiOperationsMonitor.js
**FIND:**
```javascript
const { auditLogger } = require('../middleware/auditLog');
```
OR
```javascript
const auditLogger = require('../middleware/auditLog');
```
**REPLACE WITH:**
```javascript
const immutableAuditService = require('../services/immutableAuditService');
```

**THEN FIND ALL:**
```javascript
auditLogger.log(
```
**REPLACE WITH:**
```javascript
immutableAuditService.addAuditEntry(
```

### File 5: backend/services/incidentResponseService.js
**FIND:**
```javascript
const auditLog = require('../middleware/auditLog');
```
**REPLACE WITH:**
```javascript
const immutableAuditService = require('./immutableAuditService');
```

**THEN FIND ALL:**
```javascript
auditLog.logIncident(
```
**REPLACE WITH:**
```javascript
immutableAuditService.logSecurityIncident(
```

**AND FIND ALL:**
```javascript
auditLog.log(
```
**REPLACE WITH:**
```javascript
immutableAuditService.addAuditEntry(
```

### File 6: backend/config/aiSecurityTemplates.json
This is a JSON file - check if it has any auditLog references in strings and update them to immutableAuditService.

## IMPORTANT NOTES:

1. **immutableAuditService methods to use:**
   - `addAuditEntry(data)` - For general audit logging
   - `logServiceOperation(data)` - For service operations
   - `logSecurityIncident(data)` - For security incidents
   - `logServiceDataAccess(data)` - For data access logging

2. **The data format stays mostly the same**, but you might need to adjust field names:
   - `action` → `eventType`
   - `details` → `details` (stays same)
   - `userId` → `userId` (stays same)
   - Add `sessionId` if available

3. **Example transformation:**
```javascript
// OLD:
auditLogger.log({
  action: 'USER_LOGIN',
  userId: user.id,
  details: 'User logged in'
});

// NEW:
immutableAuditService.addAuditEntry({
  eventType: 'USER_LOGIN',
  userId: user.id,
  details: 'User logged in'
});
```

## VERIFICATION STEPS:

After making ALL changes, verify:

1. **Check no auditLog references remain:**
```bash
grep -r "auditLog" backend/services/ backend/monitoring/ --include="*.js"
```
Should return NOTHING (except maybe comments)

2. **Start the server:**
```bash
cd backend
npm run dev
```

3. **Check health endpoint:**
```bash
curl http://localhost:5000/health
```
Should return status: "healthy"

## DO THIS NOW!

The server is completely DOWN. Fix ALL 6 files immediately. Don't do them one by one - fix ALL of them in one go.

Time limit: 10 minutes