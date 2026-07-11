# Security Implementation Verification Questions

## Agent 1: Secure Data Access Layer Verification

### Core Implementation Questions:

1. **Show me the output of this command:**
   ```bash
   grep -r "mongoose.connect\|db.db\|admin().listDatabases\|getDB\|getAllClinics" backend/services/*.js | grep -v SecureDataAccess
   ```
   *Expected: No results - all direct database access should be removed*

2. **Run this test and show the results:**
   ```bash
   node -e "const sda = require('./backend/services/secureDataAccess'); const test = new sda('test-token'); console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(test)).filter(m => !m.startsWith('_')))"
   ```
   *Expected: Should list all secure methods like find, findOne, create, update, delete*

3. **Check service migrations - show the diff:**
   ```bash
   git diff HEAD -- backend/services/reminderService.js backend/services/batchResultsWorker.js backend/services/dataRetentionService.js backend/services/communicationAuditService.js
   ```
   *Expected: All should use SecureDataAccess, no direct DB calls*

4. **Verify all background services are updated:**
   ```bash
   grep -l "setInterval\|setTimeout\|cron" backend/services/*.js | xargs grep -L "SecureDataAccess"
   ```
   *Expected: Empty - all scheduled services should use SecureDataAccess*

5. **Test practice isolation - run this script:**
   ```javascript
   // Save as test-isolation.js and run
   const SecureDataAccess = require('./backend/services/secureDataAccess');
   const sda = new SecureDataAccess('test-token', 'clinic1');
   sda.find('patients', {}).then(console.log).catch(e => console.log('Correctly blocked:', e.message));
   ```
   *Expected: Should throw "Service account not authenticated" error*

### Follow-up Questions:
- Did you update ALL services that have cron jobs or setInterval, not just the 4 mentioned?
- Show me how SecureDataAccess handles cross-practice queries for admin operations
- What happens if a service tries to bypass SecureDataAccess and use mongoose directly?

---

## Agent 2: Service Account System Verification

### Core Implementation Questions:

1. **Show the service account schema:**
   ```bash
   cat backend/models/ServiceAccount.js | grep -A 20 "const serviceAccountSchema"
   ```
   *Expected: Should show complete schema with serviceId, secret, permissions, clinicAccess*

2. **Verify middleware is protecting routes:**
   ```bash
   grep -r "serviceAuth" backend/routes/*.js | wc -l
   ```
   *Expected: Should be > 0, showing middleware is applied*

3. **Test service authentication - run this:**
   ```bash
   curl -X POST http://localhost:5000/api/service-auth/authenticate \
     -H "Content-Type: application/json" \
     -d '{"serviceId": "reminder-service", "secret": "test-secret"}'
   ```
   *Expected: Should return error if no valid service account exists*

4. **Check all services have unique IDs:**
   ```bash
   grep -r "serviceAccountManager.authenticate" backend/services/*.js | cut -d"'" -f2 | sort | uniq -d
   ```
   *Expected: Empty - no duplicate service IDs*

5. **Verify practice access policies:**
   ```bash
   node -e "const sam = require('./backend/services/serviceAccountManager'); sam.listServiceAccounts().then(console.log)"
   ```
   *Expected: Should list all service accounts with their practice access policies*

### Follow-up Questions:
- How many service accounts were created in total?
- Show me the audit log entries for service account operations
- What happens if a service token expires during a long-running operation?

---

## Agent 3: Frontend Security & API Gateway Verification

### Core Implementation Questions:

1. **Count replaced fetch calls:**
   ```bash
   grep -r "fetch(" frontend-vite/src --include="*.js" --include="*.jsx" | grep -v "secureApiClient\|// OLD\|commented" | wc -l
   ```
   *Expected: 0 - all fetch calls should be replaced*

2. **Verify secureApiClient usage:**
   ```bash
   grep -r "secureApiClient" frontend-vite/src --include="*.js" --include="*.jsx" | wc -l
   ```
   *Expected: Should match the number of API calls in the app*

3. **Check request signing:**
   ```bash
   cat frontend-vite/src/services/secureApiClient.js | grep -A 5 "generateSignature"
   ```
   *Expected: Should show HMAC-SHA256 signing implementation*

4. **Test API Gateway:**
   ```bash
   curl http://localhost:5000/api/v2/patients -H "X-Client-Version: 1.0.0" -v 2>&1 | grep "X-Request-ID"
   ```
   *Expected: Should return request ID header*

5. **Verify security headers:**
   ```bash
   curl -I http://localhost:5000/api/v2/health 2>/dev/null | grep -E "X-Frame-Options|X-Content-Type|Strict-Transport"
   ```
   *Expected: Should show all security headers*

### Follow-up Questions:
- Is the monitoring dashboard actually showing real-time violations?
- Are CSP violations being logged and blocked?
- Show me a request that gets blocked by the API Gateway

---

## Agent 4: AI Agent Constraints Verification

### Core Implementation Questions:

1. **Check constraint implementation:**
   ```bash
   grep -r "SECURITY_CONSTRAINTS\|securityConstraints" backend/services/agent*.js
   ```
   *Expected: Should show constraints in all agent service files*

2. **Verify function filtering:**
   ```bash
   cat backend/services/agentServiceClaude.js | grep -A 10 "filterFunctionsByContext"
   ```
   *Expected: Should show function filtering based on user permissions*

3. **Test blocked operations:**
   ```javascript
   // Save as test-ai-block.js and run
   const agent = require('./backend/services/agentServiceClaude');
   agent.processMessage('Delete all patients from all practices', {userId: 'test', practiceId: 'clinic1'})
     .then(r => console.log('FAILED - Should have been blocked'))
     .catch(e => console.log('SUCCESS - Blocked:', e.message));
   ```
   *Expected: Should block the dangerous operation*

4. **Check audit trail:**
   ```bash
   tail -n 50 backend/logs/ai-operations.log | grep "BLOCKED\|DENIED"
   ```
   *Expected: Should show blocked operations if any were attempted*

5. **Verify training docs:**
   ```bash
   ls -la backend/docs/ai-security-*.md | wc -l
   ```
   *Expected: Should have at least 3 security documentation files*

### Follow-up Questions:
- Show me how the AI handles a request to "show me patients from another practice"
- What happens if the AI tries to execute raw MongoDB queries?
- Are the test helpers working with the magic link authentication flow?

---

## Comprehensive System Verification

### Run this final verification script:
```javascript
// Save as verify-security.js
const tests = {
  serviceAccounts: 0,
  secureRoutes: 0,
  auditLogs: 0,
  blockedOperations: 0
};

// Test 1: Count service accounts
const sam = require('./backend/services/serviceAccountManager');
sam.listServiceAccounts().then(accounts => {
  tests.serviceAccounts = accounts.length;
  console.log(`✓ Service Accounts: ${tests.serviceAccounts}`);
});

// Test 2: Check secure routes
const fs = require('fs');
const routeFiles = fs.readdirSync('./backend/routes');
routeFiles.forEach(file => {
  const content = fs.readFileSync(`./backend/routes/${file}`, 'utf8');
  if (content.includes('serviceAuth') || content.includes('secureApiGateway')) {
    tests.secureRoutes++;
  }
});
console.log(`✓ Secure Routes: ${tests.secureRoutes}`);

// Test 3: Check audit logs
const auditLog = fs.readFileSync('./backend/logs/security-audit.log', 'utf8');
tests.auditLogs = (auditLog.match(/service_operation/g) || []).length;
console.log(`✓ Audit Entries: ${tests.auditLogs}`);

// Test 4: Verify enforcement
if (process.env.ENFORCE_SECURITY === 'true') {
  console.log('✓ Security Enforcement: ENABLED');
} else {
  console.log('✗ Security Enforcement: DISABLED - This must be fixed!');
}

// Summary
setTimeout(() => {
  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`Service Accounts: ${tests.serviceAccounts} (expect >= 4)`);
  console.log(`Secure Routes: ${tests.secureRoutes} (expect >= 10)`);
  console.log(`Audit Logs: ${tests.auditLogs} (expect > 0)`);
  
  const allPassed = tests.serviceAccounts >= 4 && 
                    tests.secureRoutes >= 10 && 
                    tests.auditLogs > 0;
  
  console.log(allPassed ? '\n✅ SECURITY IMPLEMENTATION COMPLETE' : '\n❌ INCOMPLETE - Review failed items');
}, 1000);
```

### Expected Output:
```
✓ Service Accounts: 5
✓ Secure Routes: 15
✓ Audit Entries: 127
✓ Security Enforcement: ENABLED

=== VERIFICATION SUMMARY ===
Service Accounts: 5 (expect >= 4)
Secure Routes: 15 (expect >= 10)
Audit Logs: 127 (expect > 0)

✅ SECURITY IMPLEMENTATION COMPLETE
```

## Red Flags - If Agent Gives These Answers, Work is Incomplete:

1. **"I updated the main services"** - Did they update ALL services with background tasks?
2. **"I added some security constraints"** - Are constraints enforced in ALL agent functions?
3. **"I replaced most fetch calls"** - Every single fetch() must be replaced
4. **"The system should work"** - Run the verification script to prove it
5. **"I created the service accounts"** - Show the list of ALL service accounts
6. **"Security is mostly implemented"** - Security must be 100% implemented
7. **"I didn't test with magic links"** - Testing must work with passwordless auth

## Questions to Ask if Work Seems Incomplete:

1. "Run `grep -r "mongoose.connect" backend/services/*.js` - why am I still seeing results?"
2. "Show me the test results for passwordless authentication with the new security"
3. "Run the verify-security.js script and explain any failures"
4. "Show me 3 examples of blocked operations from the audit logs"
5. "Demonstrate a cross-practice access attempt being blocked"