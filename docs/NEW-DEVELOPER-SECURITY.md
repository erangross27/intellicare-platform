# 🔐 New Developer Security Onboarding

Welcome to IntelliCare! This checklist ensures you understand and follow our mandatory security requirements.

## 📋 Day 1: Essential Setup

### Required Reading (2 hours)
- [ ] Read `CLAUDE.md` - Project overview and MANDATORY security rules
- [ ] Read `/docs/SECURITY-COOKBOOK.md` - How to implement every common task securely
- [ ] Read `/docs/AI-AGENT-INSTRUCTIONS.md` - Step-by-step secure coding guide
- [ ] Review `.eslintrc.security.json` - Security rules that will block your code

### Environment Setup (30 minutes)
- [ ] Install security linting: `npm install`
- [ ] Enable pre-commit hooks: `npx husky install`
- [ ] Run security check: `npm run security:check`
- [ ] Verify ESLint security rules are active

### Access Security Services (1 hour)
- [ ] Locate `backend/services/secureDataAccess.js`
- [ ] Locate `backend/services/secureApiClient.js`
- [ ] Locate `backend/services/serviceAccountManager.js`
- [ ] Locate `backend/middleware/auditLog.js`
- [ ] Review how these services work

## 🏗️ Security Architecture Overview

### The Four Pillars of Security

#### 1. Database Security
```
Traditional (BLOCKED) → Secure Alternative
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
mongoose.connection    → SecureDataAccess
Model.findById()       → SecureDataAccess.query()
db.collection()        → SecureDataAccess.query()
```

#### 2. API Security
```
Traditional (BLOCKED) → Secure Alternative
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
fetch()               → secureApiClient.request()
axios.get()           → secureApiClient.request()
http.request()        → secureApiClient.request()
```

#### 3. Service Authentication
```
Every service MUST:
1. Have a manifest in /config/securityManifests/
2. Authenticate on startup
3. Use service tokens for all operations
```

#### 4. Audit Trail
```
Every operation MUST:
1. Log before execution
2. Log after completion
3. Log errors with sanitized data
```

## 🛠️ Common Development Tasks

### Task: Query Patient Data
```javascript
// ✅ CORRECT WAY
const SecureDataAccess = require('./services/secureDataAccess');
const patients = await SecureDataAccess.query('patients', 
  { practiceId }, 
  { fields: ['name', 'email'] },
  { serviceId: 'my-service', apiKey: token }
);

// ❌ WRONG WAY (BLOCKED)
const patients = await Patient.find({ practiceId });
```

### Task: Call Internal API
```javascript
// ✅ CORRECT WAY
const secureApiClient = require('./services/secureApiClient');
const data = await secureApiClient.request('/api/endpoint');

// ❌ WRONG WAY (BLOCKED)
const data = await fetch('/api/endpoint');
```

### Task: Create Background Service
```javascript
// ✅ CORRECT WAY
class MyService {
  async initialize() {
    this.token = await serviceAccountManager.authenticate('my-service');
  }
}

// ❌ WRONG WAY (BLOCKED)
class MyService {
  async start() { /* no auth */ }
}
```

### Task: Handle Errors
```javascript
// ✅ CORRECT WAY
try {
  // operation
} catch (error) {
  await auditLogger.log({ action: 'ERROR', type: error.name });
  throw new SecureError('Operation failed'); // Generic message
}

// ❌ WRONG WAY (BLOCKED)
throw new Error(`Failed for patient ${patient.ssn}: ${error}`);
```

## 🔍 Testing Requirements

### Before EVERY Commit
1. Run security validation:
   ```bash
   npm run security:check
   ```

2. Run security audit:
   ```bash
   npm run security:audit
   ```

3. Check for violations:
   ```bash
   npm run security:report
   ```

### Required Tests for Your Code
```javascript
describe('Your Feature', () => {
  it('should use SecureDataAccess', async () => {
    // Verify no direct DB access
  });

  it('should create audit logs', async () => {
    // Verify logging happens
  });

  it('should not expose sensitive data', async () => {
    // Verify errors are sanitized
  });

  it('should require authentication', async () => {
    // Verify auth is enforced
  });
});
```

## 🚨 Security Violations & Consequences

### Automatic Blocking
Your code will be **automatically blocked** if you:
- Use `mongoose.connection` or any Model directly
- Use `fetch()`, `axios`, or `http` directly
- Skip audit logging
- Use `eval()` or `new Function()`
- Access `process.env` directly
- Create services without authentication

### Violation Tracking
```
1st violation  → Warning logged
3rd violation  → Service degraded
5th violation  → Service suspended
10th violation → Service blocked permanently
Critical (eval, admin) → IMMEDIATE LOCKDOWN
```

## 📚 Security Review Process

### Before Code Review
- [ ] No direct database access (search for `mongoose`, `Model.`)
- [ ] No direct API calls (search for `fetch`, `axios`)
- [ ] All operations have audit logs
- [ ] All errors are sanitized
- [ ] Service has authentication
- [ ] No hardcoded secrets
- [ ] Tests pass security checks

### During Code Review
Reviewers will check:
1. **SecureDataAccess** usage for all DB operations
2. **secureApiClient** usage for all API calls
3. **Audit logs** for all operations
4. **Error handling** doesn't expose data
5. **Service authentication** is implemented
6. **No forbidden patterns** (eval, Function, etc.)

## 🎯 Quick Reference Card

Print this and keep it handy:

```
DATABASE OPERATIONS
❌ Model.find()           ✅ SecureDataAccess.query()
❌ mongoose.connection    ✅ SecureDataAccess
❌ db.collection()        ✅ SecureDataAccess

API CALLS
❌ fetch()                ✅ secureApiClient.request()
❌ axios.get()            ✅ secureApiClient.request()

CONFIGURATION
❌ process.env.KEY        ✅ config.key
❌ "hardcoded-secret"     ✅ config file

DANGEROUS FUNCTIONS
❌ eval()                 ✅ JSON.parse()
❌ new Function()         ✅ Predefined functions

ALWAYS INCLUDE
✅ Audit logging
✅ Try-catch blocks
✅ Service authentication
✅ Input validation
```

## 🆘 Getting Help

### Documentation
- Security Cookbook: `/docs/SECURITY-COOKBOOK.md`
- AI Instructions: `/docs/AI-AGENT-INSTRUCTIONS.md`
- Project Memory: `CLAUDE.md`

### Tools & Commands
```bash
# Check your code for violations
npm run security:check

# Auto-fix some issues
npm run security:fix

# Generate compliance report
npm run security:report

# View recent violations
npm run security:audit
```

### Security Team Contacts
- Security Issues: Report immediately to security team
- Questions: Post in #security Slack channel
- Emergency: Page on-call security engineer

## ✅ Onboarding Completion Checklist

### Week 1
- [ ] Completed all Day 1 setup
- [ ] Successfully queried data using SecureDataAccess
- [ ] Made API call using secureApiClient
- [ ] Created service with authentication
- [ ] Passed first security check

### Week 2
- [ ] Implemented feature with full security
- [ ] All tests include security validation
- [ ] Zero security violations in commits
- [ ] Completed security training module

### Sign-off
- [ ] Manager approval
- [ ] Security team approval
- [ ] First PR merged with no violations

## ⚠️ Final Reminder

**Security is NOT optional at IntelliCare.**

Every violation is tracked. Multiple violations will result in:
1. Blocked commits
2. Failed builds
3. Suspended access
4. Required retraining

Follow the security cookbook exactly. When in doubt, check the cookbook or ask.

---

Welcome aboard! We're glad you're here to help build secure healthcare software.

Last Updated: December 2024
Version: 1.0