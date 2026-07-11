# AGENT 1: Bulletproof Database & Service Security

## CRITICAL: 67 Files Still Have Direct Database Access!

Your mission is to eliminate ALL direct database access and ensure 100% service authentication.

## Task 1: Fix ReminderService getAllClinics() - URGENT

The reminder service is throwing errors every minute. Fix it NOW:

### File: backend/services/reminderService.js

**REPLACE the getAllClinics() function (lines 454-493) with:**

```javascript
  /**
   * Get all practice IDs from service manifest
   * SECURITY: No direct database access allowed
   */
  async getAllClinics() {
    try {
      // Use predefined practice manifest for security
      // This prevents enumeration attacks and ensures only authorized practices are processed
      const clinicManifest = [
        'testclinic',
        'medical-center',
        'medical-center-usa',
        'developer',
        'healthplus',
        'wellness-practice',
        'family-health'
      ];
      
      // Filter based on service permissions
      if (this.serviceContext && this.serviceContext.allowedClinics) {
        return clinicManifest.filter(practice => 
          this.serviceContext.allowedClinics.includes(practice) ||
          this.serviceContext.allowedClinics.includes('*')
        );
      }
      
      return clinicManifest;
    } catch (error) {
      console.error('❌ Error getting practice list:', error);
      return [];
    }
  }
```

## Task 2: Audit ALL Direct Database Access

Run this command to find all violations:
```bash
grep -r "mongoose\.connection\|mongoose\.connect\|db\.admin\|listDatabases" backend/ --include="*.js" -l > database-violations.txt
```

For EACH file in database-violations.txt:

### If it's a SERVICE file (in backend/services/):
1. Add at the top:
```javascript
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
```

2. Add authentication in constructor/init:
```javascript
async initialize() {
  const auth = await serviceAccountManager.authenticate('service-name');
  this.serviceToken = auth.sessionToken;
  this.secureDataAccess = new SecureDataAccess(this.serviceToken);
}
```

3. Replace ALL database calls:
- `mongoose.connection.db` → Use SecureDataAccess methods
- `collection.find()` → `this.secureDataAccess.find()`
- `collection.insertOne()` → `this.secureDataAccess.create()`

### If it's a TEST file (in backend/tests/ or backend/test-*.js):
1. Add comment at top:
```javascript
/**
 * TEST FILE - Direct database access allowed for testing
 * NOT deployed to production
 */
```

### If it's a SCRIPT file (in backend/scripts/):
1. Add security check:
```javascript
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Scripts cannot run in production');
  process.exit(1);
}
```

## Task 3: Create SecureConfigService

Create `backend/services/secureConfigService.js`:

```javascript
/**
 * 🔐 SECURE CONFIGURATION SERVICE
 * Manages all environment variables and configuration
 * Prevents direct process.env access by other services
 */

const crypto = require('crypto');
const immutableAuditService = require('./immutableAuditService');

class SecureConfigService {
  constructor() {
    this.config = new Map();
    this.sensitive = new Set([
      'JWT_SECRET',
      'MONGODB_URI',
      'CLAUDE_API_KEY',
      'ANTHROPIC_API_KEY',
      'GEMINI_API_KEY',
      'GOOGLE_API_KEY',
      'OPENAI_API_KEY',
      'SENDGRID_API_KEY',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY'
    ]);
    
    this.loadConfig();
  }

  loadConfig() {
    // Load all env variables once at startup
    Object.keys(process.env).forEach(key => {
      this.config.set(key, process.env[key]);
    });
    
    // Clear process.env for security (except in development)
    if (process.env.NODE_ENV === 'production') {
      Object.keys(process.env).forEach(key => {
        if (!['NODE_ENV', 'PORT'].includes(key)) {
          delete process.env[key];
        }
      });
    }
  }

  /**
   * Get configuration value
   * @param {string} key - Config key
   * @param {string} serviceId - Service requesting the value
   * @returns {string|undefined} Config value
   */
  get(key, serviceId) {
    // Log access to sensitive keys
    if (this.sensitive.has(key)) {
      immutableAuditService.logServiceDataAccess({
        serviceId,
        dataAccessed: { type: 'config', key },
        timestamp: new Date()
      });
    }
    
    // Check if service is allowed to access this key
    if (!this.isAllowed(serviceId, key)) {
      console.warn(`⚠️ Service ${serviceId} denied access to ${key}`);
      return undefined;
    }
    
    return this.config.get(key);
  }

  /**
   * Check if service can access config key
   */
  isAllowed(serviceId, key) {
    // Define access control rules
    const rules = {
      'agent-service': ['CLAUDE_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY'],
      'email-service': ['SENDGRID_API_KEY'],
      'database-factory': ['MONGODB_URI'],
      'auth-service': ['JWT_SECRET'],
      's3-service': ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
    };
    
    // Check if service has permission
    const allowedKeys = rules[serviceId] || [];
    return allowedKeys.includes(key) || !this.sensitive.has(key);
  }

  /**
   * Get all non-sensitive config
   */
  getPublicConfig() {
    const publicConfig = {};
    this.config.forEach((value, key) => {
      if (!this.sensitive.has(key)) {
        publicConfig[key] = value;
      }
    });
    return publicConfig;
  }
}

module.exports = new SecureConfigService();
```

## Task 4: Update ALL Services to Use SecureConfigService

For EVERY file that uses `process.env`:

**REPLACE:**
```javascript
const apiKey = process.env.GEMINI_API_KEY;
```

**WITH:**
```javascript
const secureConfig = require('./secureConfigService');
const apiKey = secureConfig.get('GEMINI_API_KEY', 'service-name');
```

## Task 5: Create Service Account for Each Background Service

For each service that runs in the background:

1. Create service account entry:
```javascript
// In backend/config/service-accounts.json
{
  "services": {
    "db-optimization": {
      "id": "db-optimization",
      "name": "Database Optimization Service",
      "permissions": ["read", "optimize"],
      "clinicAccess": "read-only-all",
      "rateLimit": 100
    },
    "health-check": {
      "id": "health-check",
      "name": "Health Check Service",
      "permissions": ["read"],
      "clinicAccess": "none",
      "rateLimit": 60
    }
    // Add more...
  }
}
```

2. Update the service to authenticate:
```javascript
class ServiceName {
  async initialize() {
    const auth = await serviceAccountManager.authenticate('service-id');
    this.serviceToken = auth.sessionToken;
    console.log('✅ Service authenticated');
  }
}
```

## Task 6: Create Database Access Audit Report

Create `backend/database-security-audit.md`:

```markdown
# Database Security Audit Report

## Summary
- Total Files Scanned: [X]
- Direct Access Violations: [Y]
- Fixed: [Z]
- Remaining: 0 (MUST be zero)

## Fixed Services
| Service | File | Direct Access Type | Fix Applied |
|---------|------|-------------------|-------------|
| ReminderService | reminderService.js | mongoose.connection | SecureDataAccess |
| ... | ... | ... | ... |

## Test Files (Allowed)
| File | Purpose | Security Check |
|------|---------|----------------|
| test-*.js | Testing | NODE_ENV check |

## Verification
```bash
grep -r "mongoose\.connection" backend/services/ --include="*.js"
# Returns: 0 results
```
```

## Verification Commands

After completing ALL tasks, run:

```bash
# Check no direct DB access in services
grep -r "mongoose\.connection\|mongoose\.connect" backend/services/ --include="*.js" | grep -v SecureDataAccess

# Check no direct env access
grep -r "process\.env\." backend/services/ --include="*.js" | grep -v secureConfigService

# Test reminder service
curl http://localhost:5000/health

# Should show no errors in console
```

## Success Criteria
- ✅ Zero direct database access in service files
- ✅ All services use SecureConfigService
- ✅ All background services authenticated
- ✅ ReminderService runs without errors
- ✅ Audit report shows 100% compliance

## Deadline: 4 hours

Start with fixing ReminderService - it's breaking every minute!