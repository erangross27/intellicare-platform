# Task 0.11: Add CORS Security Headers

## 🚨 **CRITICAL SECURITY TASK**
**Phase:** 0 (Critical Security - DO FIRST)  
**Time Estimate:** 10 minutes  
**Risk Level:** MEDIUM  
**Priority:** HIGH  

Add comprehensive CORS and security headers to protect against cross-origin attacks, clickjacking, and other web-based security vulnerabilities.

## 🎯 **Objective**
Implement security headers that:
- Configure proper CORS policies for agent endpoints
- Prevent clickjacking and XSS attacks
- Add content security policies
- Implement secure header standards

## 🚨 **Security Risk**
**MEDIUM:** Missing security headers allow cross-origin attacks and web-based vulnerabilities.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add comprehensive security headers middleware**

## 🔍 **Current Security Header Gaps**

### **Gap 1: No CORS Configuration**
```javascript
// CURRENT - NO CORS PROTECTION
router.post('/chat', async (req, res) => {
  // ❌ No CORS headers
  // ❌ Any origin can make requests
  // ❌ No preflight handling
});
```

### **Gap 2: Missing Security Headers**
```javascript
// CURRENT - NO SECURITY HEADERS
router.use((req, res, next) => {
  // ❌ No X-Frame-Options
  // ❌ No X-Content-Type-Options
  // ❌ No X-XSS-Protection
  // ❌ No Content-Security-Policy
  next();
});
```

### **Gap 3: No Origin Validation**
```javascript
// CURRENT - NO ORIGIN VALIDATION
// ❌ Any website can embed and call agent endpoints
// ❌ No whitelist of allowed origins
```

## ✅ **Comprehensive Security Headers System**

### **1. CORS Configuration**
```javascript
// ADD at top of file after imports:
const cors = require('cors');

// Define allowed origins based on environment
const getAllowedOrigins = () => {
  const baseOrigins = [
    'https://app.intellicare.co.il',
    'https://intellicare.co.il',
    'https://www.intellicare.co.il'
  ];
  
  // Add development origins in non-production
  if (process.env.NODE_ENV !== 'production') {
    baseOrigins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    );
  }
  
  // Add practice-specific subdomains
  const clinicOrigins = [];
  if (process.env.ALLOWED_CLINIC_DOMAINS) {
    const domains = process.env.ALLOWED_CLINIC_DOMAINS.split(',');
    domains.forEach(domain => {
      clinicOrigins.push(`https://${domain.trim()}`);
      if (process.env.NODE_ENV !== 'production') {
        clinicOrigins.push(`http://${domain.trim()}`);
      }
    });
  }
  
  return [...baseOrigins, ...clinicOrigins];
};

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error(`CORS policy violation: Origin ${origin} not allowed`));
    }
  },
  credentials: true, // Allow cookies and auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-auth-token',
    'x-session-id',
    'x-practice-subdomain',
    'x-country',
    'x-upload-id',
    'x-patient-id'
  ],
  exposedHeaders: [
    'x-total-count',
    'x-rate-limit-remaining',
    'x-rate-limit-reset'
  ],
  maxAge: 86400 // 24 hours for preflight cache
};
```

### **2. Security Headers Middleware**
```javascript
// ADD: Comprehensive security headers
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection (legacy but still useful)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Allow inline scripts for React
    "style-src 'self' 'unsafe-inline'",  // Allow inline styles
    "img-src 'self' data: https:",       // Allow images from self, data URLs, and HTTPS
    "font-src 'self' https:",            // Allow fonts from self and HTTPS
    "connect-src 'self' https:",         // Allow connections to self and HTTPS
    "media-src 'self'",                  // Allow media from self only
    "object-src 'none'",                 // Block objects (Flash, etc.)
    "base-uri 'self'",                   // Restrict base URI
    "form-action 'self'",                // Restrict form actions
    "frame-ancestors 'none'"             // Prevent framing (same as X-Frame-Options)
  ];
  
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  
  // Strict Transport Security (HTTPS only)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Permissions Policy (formerly Feature Policy)
  const permissionsPolicy = [
    'camera=self',
    'microphone=self',
    'geolocation=self',
    'payment=none',
    'usb=none',
    'magnetometer=none',
    'gyroscope=none',
    'accelerometer=none'
  ];
  
  res.setHeader('Permissions-Policy', permissionsPolicy.join(', '));
  
  // Cross-Origin Policies
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  
  next();
};
```

### **3. Origin Validation Middleware**
```javascript
// ADD: Enhanced origin validation
const validateOrigin = (req, res, next) => {
  const origin = req.headers.origin || req.headers.referer;
  const allowedOrigins = getAllowedOrigins();
  
  // Skip validation for non-browser requests
  if (!origin) {
    return next();
  }
  
  // Extract origin from referer if needed
  let requestOrigin = origin;
  if (origin.includes('/')) {
    try {
      const url = new URL(origin);
      requestOrigin = `${url.protocol}//${url.host}`;
    } catch (error) {
      console.error('❌ Invalid origin/referer:', origin);
      return sendLocalizedError(res, req.country, 'INVALID_ORIGIN', {}, 400);
    }
  }
  
  // Check if origin is allowed
  if (!allowedOrigins.includes(requestOrigin)) {
    await auditLog(req, 'ORIGIN_VALIDATION_FAILED', {
      origin: requestOrigin,
      allowedOrigins: allowedOrigins,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    
    return sendLocalizedError(res, req.country, 'ORIGIN_NOT_ALLOWED', {
      origin: requestOrigin
    }, 403);
  }
  
  // Log successful validation for monitoring
  if (process.env.NODE_ENV === 'development') {
    console.log(`✅ Origin validated: ${requestOrigin}`);
  }
  
  next();
};
```

### **4. Rate Limiting by Origin**
```javascript
// ADD: Origin-based rate limiting
const originRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes per origin
  keyGenerator: (req) => {
    const origin = req.headers.origin || req.headers.referer || 'unknown';
    return `origin_${origin}_${req.ip}`;
  },
  message: (req) => createErrorResponse(
    req.country || 'United States',
    'TOO_MANY_REQUESTS_FROM_ORIGIN'
  ).response,
  standardHeaders: true,
  legacyHeaders: false
});
```

### **5. Apply Security Middleware**
```javascript
// BEFORE - No security headers:
router.use('/some-route', (req, res, next) => {
  // No security measures
  next();
});

// AFTER - Comprehensive security:
// Apply CORS first
router.use(cors(corsOptions));

// Apply security headers to all routes
router.use(securityHeaders);

// Apply origin validation to sensitive routes
router.use(validateOrigin);

// Apply origin-based rate limiting
router.use(originRateLimit);

// Apply to specific routes
router.post('/chat',
  generalRateLimit,
  aiRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  // Security headers already applied globally
  async (req, res) => {...}
);
```

### **6. CORS Error Handling**
```javascript
// ADD: CORS error handling middleware
const handleCorsError = (err, req, res, next) => {
  if (err.message && err.message.includes('CORS policy violation')) {
    // Log CORS violation
    auditLog(req, 'CORS_VIOLATION', {
      origin: req.headers.origin,
      referer: req.headers.referer,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      error: err.message
    });
    
    return sendLocalizedError(res, req.country, 'CORS_VIOLATION', {
      origin: req.headers.origin
    }, 403);
  }
  
  next(err);
};

// Apply CORS error handling
router.use(handleCorsError);
```

### **7. Security Headers Monitoring**
```javascript
// ADD: Security headers monitoring
const monitorSecurityHeaders = (req, res, next) => {
  const originalSetHeader = res.setHeader;
  const securityHeadersSet = new Set();
  
  res.setHeader = function(name, value) {
    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'content-security-policy',
      'strict-transport-security',
      'referrer-policy'
    ];
    
    if (securityHeaders.includes(name.toLowerCase())) {
      securityHeadersSet.add(name.toLowerCase());
    }
    
    return originalSetHeader.call(this, name, value);
  };
  
  const originalEnd = res.end;
  res.end = function(...args) {
    // Log missing security headers
    const expectedHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'content-security-policy'
    ];
    
    const missingHeaders = expectedHeaders.filter(header => 
      !securityHeadersSet.has(header)
    );
    
    if (missingHeaders.length > 0) {
      console.log(`⚠️ Missing security headers for ${req.path}:`, missingHeaders);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// Apply security monitoring in development
if (process.env.NODE_ENV === 'development') {
  router.use(monitorSecurityHeaders);
}
```

### **8. Environment-Specific Configuration**
```javascript
// ADD: Environment-specific security configuration
const getSecurityConfig = () => {
  const config = {
    production: {
      strictCSP: true,
      allowInsecureOrigins: false,
      logSecurityViolations: true,
      enforceHTTPS: true
    },
    development: {
      strictCSP: false,
      allowInsecureOrigins: true,
      logSecurityViolations: true,
      enforceHTTPS: false
    },
    test: {
      strictCSP: false,
      allowInsecureOrigins: true,
      logSecurityViolations: false,
      enforceHTTPS: false
    }
  };
  
  return config[process.env.NODE_ENV] || config.production;
};

// Use environment-specific configuration
const securityConfig = getSecurityConfig();

// Adjust CORS options based on environment
if (securityConfig.allowInsecureOrigins) {
  corsOptions.origin = true; // Allow all origins in development
}
```

## ⚠️ **Security Notes**
- **🚨 CRITICAL:** CORS prevents unauthorized cross-origin requests
- **🚨 CRITICAL:** Security headers prevent common web attacks
- **🚨 CRITICAL:** Origin validation blocks malicious websites
- **❌ DON'T SKIP:** These headers are essential for web security

## 🧪 **Security Testing After Implementation**
1. **Test CORS policies:**
   - Try requests from allowed origins → should work
   - Try requests from blocked origins → should be rejected

2. **Test security headers:**
   - Verify all security headers are present
   - Test CSP policies work correctly

3. **Test origin validation:**
   - Try requests with invalid origins → should be blocked
   - Verify audit logging works

## ✅ **Success Criteria**
- [ ] CORS properly configured for allowed origins
- [ ] All security headers implemented
- [ ] Origin validation working
- [ ] CSP policies preventing XSS
- [ ] Clickjacking protection active
- [ ] Security monitoring functional

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 0.12:** Fix Async Error Handling

## 📝 **CRITICAL NOTES**
- **PREVENTS CROSS-ORIGIN ATTACKS** - CORS essential for web security
- **BLOCKS WEB VULNERABILITIES** - security headers critical
- **ENABLES ORIGIN TRACKING** - important for audit compliance
- **TEST THOROUGHLY** - verify all security measures work
