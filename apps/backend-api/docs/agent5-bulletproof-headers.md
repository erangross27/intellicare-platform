# 🛡️ AGENT 5: BULLETPROOF HEADER SECURITY IMPLEMENTATION

## ⚡ URGENT PRIORITY: Security Headers Validation

**YOUR MISSION**: Implement comprehensive security header validation to prevent header injection attacks and ensure all security headers are properly validated, not just allowed through CORS.

**DEADLINE**: 2 hours

## 🚨 CRITICAL CONTEXT

We've spent hours closing security gaps. The other 4 agents have implemented:
- Agent 1: Database security layer (SecureDataAccess)
- Agent 2: API security (request signing)
- Agent 3: Monitoring & enforcement
- Agent 4: AI constraints & testing

But we discovered that while we allow security headers through CORS, we're NOT properly validating them! This could be an attack vector.

## 📋 YOUR TASKS

### Task 1: Create Security Header Validation Service (30 min)
Create `backend/services/securityHeaderValidator.js`:

```javascript
class SecurityHeaderValidator {
  constructor() {
    // Header patterns and rules
    this.headerRules = {
      'x-request-id': {
        pattern: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
        maxLength: 36,
        required: true,
        sanitize: (value) => value.toLowerCase().trim()
      },
      'x-timestamp': {
        pattern: /^\d{13}$/,
        maxLength: 13,
        required: true,
        validate: (value) => {
          const timestamp = parseInt(value);
          const now = Date.now();
          const fiveMinutes = 5 * 60 * 1000;
          // Reject if timestamp is more than 5 minutes old or in future
          return Math.abs(now - timestamp) < fiveMinutes;
        }
      },
      'x-signature': {
        pattern: /^[a-f0-9]{64}$/i, // SHA256 hex
        maxLength: 64,
        required: true,
        sanitize: (value) => value.toLowerCase()
      },
      'x-service-id': {
        pattern: /^[a-z0-9-]+$/,
        maxLength: 50,
        allowlist: ['reminder-service', 'batch-worker', 'ai-agent', ...],
        required: false
      },
      'x-correlation-id': {
        pattern: /^[a-f0-9-]+$/i,
        maxLength: 36,
        required: false
      }
    };
    
    // Track header abuse
    this.abuseTracker = new Map(); // IP -> attempts
    this.blacklist = new Set();
  }

  validateHeaders(req) {
    const errors = [];
    const clientIp = req.ip;
    
    // Check if IP is blacklisted
    if (this.blacklist.has(clientIp)) {
      throw new SecurityError('IP blacklisted for header abuse');
    }
    
    // Validate each security header
    for (const [header, rules] of Object.entries(this.headerRules)) {
      const value = req.headers[header];
      
      if (rules.required && !value) {
        errors.push(`Missing required header: ${header}`);
        continue;
      }
      
      if (value) {
        // Length check
        if (value.length > rules.maxLength) {
          errors.push(`Header ${header} exceeds max length`);
          this.recordAbuse(clientIp);
        }
        
        // Pattern validation
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`Invalid format for header: ${header}`);
          this.recordAbuse(clientIp);
        }
        
        // Custom validation
        if (rules.validate && !rules.validate(value)) {
          errors.push(`Validation failed for header: ${header}`);
          this.recordAbuse(clientIp);
        }
        
        // Allowlist check
        if (rules.allowlist && !rules.allowlist.includes(value)) {
          errors.push(`Value not in allowlist for header: ${header}`);
          this.recordAbuse(clientIp);
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  recordAbuse(ip) {
    const attempts = (this.abuseTracker.get(ip) || 0) + 1;
    this.abuseTracker.set(ip, attempts);
    
    // Auto-blacklist after 10 violations
    if (attempts >= 10) {
      this.blacklist.add(ip);
      // Log to security audit
      require('./immutableAuditService').logSecurityEvent({
        type: 'HEADER_ABUSE_BLACKLIST',
        ip,
        attempts
      });
    }
  }
  
  verifySignature(req) {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    const requestId = req.headers['x-request-id'];
    
    if (!signature || !timestamp || !requestId) {
      return false;
    }
    
    // Rebuild the signature
    const payload = `${req.method}:${req.path}:${timestamp}:${requestId}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.REQUEST_SIGNING_KEY || 'default-key')
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

module.exports = new SecurityHeaderValidator();
```

### Task 2: Create Header Validation Middleware (30 min)
Create `backend/middleware/headerValidation.js`:

```javascript
const validator = require('../services/securityHeaderValidator');
const immutableAuditService = require('../services/immutableAuditService');

const headerValidationMiddleware = (options = {}) => {
  const { 
    enforceSignature = true,
    blockOnFailure = true,
    logViolations = true 
  } = options;
  
  return async (req, res, next) => {
    try {
      // Skip validation for health checks and public routes
      if (req.path === '/health' || req.path.startsWith('/public')) {
        return next();
      }
      
      // Validate headers
      const validation = validator.validateHeaders(req);
      
      if (!validation.valid) {
        if (logViolations) {
          await immutableAuditService.logSecurityEvent({
            type: 'INVALID_SECURITY_HEADERS',
            path: req.path,
            method: req.method,
            ip: req.ip,
            errors: validation.errors,
            headers: Object.keys(req.headers)
          });
        }
        
        if (blockOnFailure) {
          return res.status(400).json({
            error: 'Invalid security headers',
            code: 'SECURITY_HEADER_VALIDATION_FAILED',
            details: process.env.NODE_ENV === 'development' ? validation.errors : undefined
          });
        }
      }
      
      // Verify signature if required
      if (enforceSignature && req.headers['x-signature']) {
        const signatureValid = validator.verifySignature(req);
        
        if (!signatureValid) {
          await immutableAuditService.logSecurityEvent({
            type: 'INVALID_REQUEST_SIGNATURE',
            path: req.path,
            method: req.method,
            ip: req.ip
          });
          
          if (blockOnFailure) {
            return res.status(401).json({
              error: 'Invalid request signature',
              code: 'SIGNATURE_VERIFICATION_FAILED'
            });
          }
        }
      }
      
      // Add validated headers to request
      req.securityHeaders = {
        requestId: req.headers['x-request-id'],
        timestamp: req.headers['x-timestamp'],
        signature: req.headers['x-signature'],
        serviceId: req.headers['x-service-id'],
        correlationId: req.headers['x-correlation-id'],
        validated: true
      };
      
      next();
    } catch (error) {
      console.error('Header validation error:', error);
      
      if (error.name === 'SecurityError') {
        return res.status(403).json({
          error: error.message,
          code: 'SECURITY_BLOCKED'
        });
      }
      
      // Don't expose internal errors
      res.status(500).json({
        error: 'Internal server error',
        code: 'HEADER_VALIDATION_ERROR'
      });
    }
  };
};

// Export different enforcement levels
module.exports = {
  strict: headerValidationMiddleware({ 
    enforceSignature: true, 
    blockOnFailure: true 
  }),
  
  moderate: headerValidationMiddleware({ 
    enforceSignature: false, 
    blockOnFailure: true 
  }),
  
  monitoring: headerValidationMiddleware({ 
    enforceSignature: false, 
    blockOnFailure: false,
    logViolations: true 
  }),
  
  custom: headerValidationMiddleware
};
```

### Task 3: Integrate Header Validation (30 min)

1. **Update server.js** to use header validation:
```javascript
// Add after other security middleware
const headerValidation = require('./middleware/headerValidation');

// Apply BEFORE routes but AFTER CORS
app.use(headerValidation.strict); // Use strict mode for production
```

2. **Update all route files** to check for validated headers:
```javascript
// In each protected route
router.use((req, res, next) => {
  if (!req.securityHeaders?.validated) {
    return res.status(400).json({ 
      error: 'Security headers not validated' 
    });
  }
  next();
});
```

### Task 4: Create Header Security Tests (30 min)
Create `backend/tests/test-header-security.js`:

```javascript
const test = require('tape');
const request = require('supertest');

test('Header Security Tests', async (t) => {
  const app = require('../server');
  
  // Test 1: Missing required headers
  const res1 = await request(app)
    .get('/api/patients')
    .expect(400);
  t.equal(res1.body.code, 'SECURITY_HEADER_VALIDATION_FAILED');
  
  // Test 2: Invalid request ID format
  const res2 = await request(app)
    .get('/api/patients')
    .set('X-Request-ID', 'invalid-format')
    .set('X-Timestamp', Date.now().toString())
    .expect(400);
  
  // Test 3: Expired timestamp
  const oldTimestamp = Date.now() - (10 * 60 * 1000); // 10 minutes old
  const res3 = await request(app)
    .get('/api/patients')
    .set('X-Request-ID', 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
    .set('X-Timestamp', oldTimestamp.toString())
    .expect(400);
  
  // Test 4: Invalid signature
  const res4 = await request(app)
    .get('/api/patients')
    .set('X-Request-ID', 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
    .set('X-Timestamp', Date.now().toString())
    .set('X-Signature', 'invalid-signature')
    .expect(401);
  
  // Test 5: Header injection attempt
  const res5 = await request(app)
    .get('/api/patients')
    .set('X-Request-ID', '<script>alert(1)</script>')
    .expect(400);
  
  // Test 6: Oversized header
  const res6 = await request(app)
    .get('/api/patients')
    .set('X-Request-ID', 'a'.repeat(1000))
    .expect(400);
  
  // Test 7: Service not in allowlist
  const res7 = await request(app)
    .get('/api/patients')
    .set('X-Service-ID', 'malicious-service')
    .expect(400);
  
  t.end();
});
```

### Task 5: Create Comprehensive Security Utils (30 min)
Create `backend/utils/securityUtils.js` (as requested by the user):

```javascript
const crypto = require('crypto');
const validator = require('validator');

class SecurityUtils {
  // SQL Injection Detection
  detectSqlInjection(input) {
    if (typeof input !== 'string') return false;
    
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE|SCRIPT|TRUNCATE)\b)/gi,
      /(--|#|\/\*|\*\/)/g,
      /(\bOR\b.*=.*)/gi,
      /('\s*;\s*--)/gi,
      /(xp_cmdshell|sp_executesql)/gi,
      /(\bWAITFOR\s+DELAY\b)/gi
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  }
  
  // NoSQL Injection Detection
  detectNoSqlInjection(input) {
    if (typeof input === 'object') {
      const dangerous = ['$where', '$regex', '$ne', '$gt', '$lt', '$gte', '$lte', '$in', '$nin', '$exists'];
      const keys = Object.keys(input);
      return keys.some(key => dangerous.includes(key));
    }
    
    if (typeof input === 'string') {
      const patterns = [
        /\$where/gi,
        /db\..*\(/gi,
        /function\s*\(/gi,
        /\{.*\$.*:/gi
      ];
      return patterns.some(pattern => pattern.test(input));
    }
    
    return false;
  }
  
  // XSS Detection
  detectXSS(input) {
    if (typeof input !== 'string') return false;
    
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]*onerror=/gi,
      /<svg[^>]*onload=/gi,
      /eval\s*\(/gi,
      /document\.(cookie|write|domain)/gi
    ];
    
    return xssPatterns.some(pattern => pattern.test(input));
  }
  
  // Path Traversal Detection
  detectPathTraversal(input) {
    if (typeof input !== 'string') return false;
    
    const patterns = [
      /\.\.\//g,
      /\.\.\\/, 
      /%2e%2e%2f/gi,
      /%252e%252e%252f/gi,
      /\.\.%2f/gi,
      /\.\.%5c/gi
    ];
    
    return patterns.some(pattern => pattern.test(input));
  }
  
  // Command Injection Detection
  detectCommandInjection(input) {
    if (typeof input !== 'string') return false;
    
    const patterns = [
      /[;&|`$()]/g,
      /\|\|/g,
      /&&/g,
      /\$\(/g,
      /`.*`/g,
      /\b(cat|ls|rm|cp|mv|wget|curl|bash|sh|powershell|cmd)\b/gi
    ];
    
    return patterns.some(pattern => pattern.test(input));
  }
  
  // LDAP Injection Detection
  detectLDAPInjection(input) {
    if (typeof input !== 'string') return false;
    
    const patterns = [
      /[()&|*]/g,
      /\*/g,
      /\|/g,
      /&/g,
      /\(/g,
      /\)/g
    ];
    
    return patterns.some(pattern => pattern.test(input));
  }
  
  // Comprehensive Input Validation
  validateInput(input, type = 'general') {
    const validations = {
      general: () => {
        return !this.detectSqlInjection(input) &&
               !this.detectNoSqlInjection(input) &&
               !this.detectXSS(input) &&
               !this.detectPathTraversal(input) &&
               !this.detectCommandInjection(input);
      },
      
      email: () => {
        return validator.isEmail(input) && !this.detectXSS(input);
      },
      
      url: () => {
        return validator.isURL(input, { 
          protocols: ['http', 'https'],
          require_protocol: true 
        });
      },
      
      alphanumeric: () => {
        return /^[a-zA-Z0-9]+$/.test(input);
      },
      
      numeric: () => {
        return /^\d+$/.test(input);
      },
      
      uuid: () => {
        return validator.isUUID(input);
      },
      
      json: () => {
        try {
          JSON.parse(input);
          return !this.detectNoSqlInjection(JSON.parse(input));
        } catch {
          return false;
        }
      },
      
      mongoId: () => {
        return /^[a-f\d]{24}$/i.test(input);
      },
      
      filename: () => {
        return /^[a-zA-Z0-9-_\.]+$/.test(input) && 
               !this.detectPathTraversal(input);
      }
    };
    
    const validator = validations[type] || validations.general;
    return validator();
  }
  
  // Sanitize input
  sanitize(input, type = 'general') {
    if (typeof input !== 'string') return input;
    
    const sanitizers = {
      general: (str) => {
        return str
          .replace(/[<>]/g, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '')
          .trim();
      },
      
      html: (str) => {
        return validator.escape(str);
      },
      
      sql: (str) => {
        return str.replace(/['";\\]/g, '');
      },
      
      filename: (str) => {
        return str.replace(/[^a-zA-Z0-9-_\.]/g, '');
      },
      
      mongoField: (str) => {
        return str.replace(/[$]/g, '');
      }
    };
    
    const sanitizer = sanitizers[type] || sanitizers.general;
    return sanitizer(input);
  }
  
  // Generate secure random tokens
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
  
  // Hash passwords securely
  async hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }
  
  // Verify password hash
  async verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
  }
  
  // Generate HMAC signature
  generateHMAC(data, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }
  
  // Verify HMAC signature
  verifyHMAC(data, signature, secret) {
    const expectedSignature = this.generateHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
  
  // Rate limiting helper
  createRateLimiter(maxAttempts = 10, windowMs = 60000) {
    const attempts = new Map();
    
    return {
      check: (identifier) => {
        const now = Date.now();
        const userAttempts = attempts.get(identifier) || [];
        
        // Clean old attempts
        const recentAttempts = userAttempts.filter(
          timestamp => now - timestamp < windowMs
        );
        
        if (recentAttempts.length >= maxAttempts) {
          return { allowed: false, remainingAttempts: 0 };
        }
        
        recentAttempts.push(now);
        attempts.set(identifier, recentAttempts);
        
        return { 
          allowed: true, 
          remainingAttempts: maxAttempts - recentAttempts.length 
        };
      },
      
      reset: (identifier) => {
        attempts.delete(identifier);
      }
    };
  }
}

module.exports = new SecurityUtils();
```

## 📊 Success Metrics

Your implementation is successful when:

1. ✅ All security headers are validated before processing
2. ✅ Invalid headers trigger security alerts
3. ✅ Signature verification works correctly
4. ✅ Abuse tracking auto-blacklists malicious IPs
5. ✅ All tests pass
6. ✅ No header injection attacks possible
7. ✅ SecurityUtils provides comprehensive validation

## 🚨 COORDINATION WITH OTHER AGENTS

- **DO NOT** modify files being worked on by:
  - Agent 1: Database services
  - Agent 2: Frontend files
  - Agent 3: Monitoring routes
  - Agent 4: Test files (except test-header-security.js)

- **YOU CAN** safely modify:
  - server.js (after line 100, before routes)
  - Create new files in services/ and middleware/
  - Create new test files
  - Update securityHeaders.js (already updated CORS)

## 🎯 VERIFICATION CHECKLIST

Run these commands to verify your work:

```bash
# Test header validation
curl -X GET http://localhost:5000/api/patients \
  -H "X-Request-ID: invalid" \
  -v

# Should return 400 Bad Request

# Test with valid headers
curl -X GET http://localhost:5000/api/patients \
  -H "X-Request-ID: f47ac10b-58cc-4372-a567-0e02b2c3d479" \
  -H "X-Timestamp: $(date +%s)000" \
  -v

# Run your tests
node backend/tests/test-header-security.js

# Check audit logs for violations
tail -f backend/logs/security-audit.log | grep HEADER
```

## ⏰ TIMELINE

1. **0-30 min**: Create SecurityHeaderValidator service
2. **30-60 min**: Create middleware and integrate
3. **60-90 min**: Create tests and SecurityUtils
4. **90-120 min**: Test everything and fix issues

## 🔴 CRITICAL REMINDERS

1. **This is PRODUCTION security** - No shortcuts!
2. **Validate EVERYTHING** - Trust nothing from client
3. **Log ALL violations** - We need audit trails
4. **Block malicious requests** - Don't just log them
5. **Use crypto.timingSafeEqual** - Prevent timing attacks
6. **Don't expose details** - Generic errors in production

## 💡 FINAL NOTES

The other agents have done great work securing the database, API, monitoring, and AI layers. Your header validation layer is the FINAL PIECE that ensures no malicious requests can even reach our secured systems.

Remember: Headers are the FIRST line of defense. If we can stop attacks at the header level, they never reach our business logic.

**YOU ARE THE GATEKEEPER!**

---
*Created for Agent 5 by Development Manager*
*Mission: Bulletproof Header Security*
*Deadline: 2 hours*
*Priority: CRITICAL*