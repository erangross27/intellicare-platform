/**
 * 🛡️ SECURITY HEADERS MIDDLEWARE
 * Comprehensive security headers for frontend protection
 */

const helmet = require('helmet');
const securityHeadersOptimizationService = require('../services/securityHeadersOptimizationService');
const secureConfigService = require('../services/secureConfigService');

// Content Security Policy configuration
const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'", // Required for React development
      "'unsafe-eval'", // Required for React development
      "https://cdn.jsdelivr.net", // For external libraries
      "https://unpkg.com" // For external libraries
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Required for styled-components and inline styles
      "https://fonts.googleapis.com",
      "https://cdn.jsdelivr.net"
    ],
    fontSrc: [
      "'self'",
      "https://fonts.gstatic.com",
      "https://cdn.jsdelivr.net",
      "data:" // For base64 encoded fonts
    ],
    imgSrc: [
      "'self'",
      "data:", // For base64 images and QR codes
      "blob:", // For generated images
      "https:", // Allow HTTPS images
      "http://localhost:*" // For development
    ],
    connectSrc: [
      "'self'",
      "http://localhost:*", // For development API calls
      "http://*.localhost:*", // For subdomain development
      "https://api.openai.com", // For AI services
      "https://generativelanguage.googleapis.com", // For Gemini API
      "wss://localhost:*", // For WebSocket connections
      "ws://localhost:*", // For development WebSocket
      "wss://*.localhost:*", // For subdomain WebSocket connections
      "ws://*.localhost:*" // For subdomain development WebSocket
    ],
    mediaSrc: ["'self'", "data:", "blob:"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: secureConfigService.get('NODE_ENV') === 'production' ? [] : null
  },
  reportOnly: false
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Apply Helmet with comprehensive security headers
  helmet({
    // Content Security Policy
    contentSecurityPolicy: cspConfig,
    
    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: false, // Disabled for compatibility
    
    // Cross-Origin Opener Policy
    crossOriginOpenerPolicy: { policy: "same-origin" },
    
    // Cross-Origin Resource Policy
    crossOriginResourcePolicy: { policy: "cross-origin" },
    
    // DNS Prefetch Control
    dnsPrefetchControl: { allow: false },
    
    // Expect-CT
    expectCt: {
      maxAge: 86400,
      enforce: secureConfigService.get('NODE_ENV') === 'production'
    },
    
    // Feature Policy / Permissions Policy
    permissionsPolicy: {
      features: {
        camera: ["'self'"],
        microphone: ["'self'"],
        geolocation: ["'none'"],
        payment: ["'none'"],
        usb: ["'none'"],
        magnetometer: ["'none'"],
        gyroscope: ["'none'"],
        accelerometer: ["'none'"]
      }
    },
    
    // Frameguard (X-Frame-Options)
    frameguard: { action: 'deny' },
    
    // Hide Powered-By
    hidePoweredBy: true,
    
    // HSTS (HTTP Strict Transport Security)
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    
    // IE No Open
    ieNoOpen: true,
    
    // No Sniff
    noSniff: true,
    
    // Origin Agent Cluster
    originAgentCluster: true,
    
    // Referrer Policy
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    
    // X-XSS-Protection
    xssFilter: true
  })(req, res, (err) => {
    if (err) {
      console.error('Security headers error:', err);
    }
    
    // Additional custom security headers
    
    // Apply enhanced security headers from optimization service
    const { headers, nonce } = securityHeadersOptimizationService.generateSecurityHeaders(req, res);
    for (const [header, value] of Object.entries(headers)) {
      res.setHeader(header, value);
    }
    res.locals.nonce = nonce; // Store nonce for CSP
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // XSS Protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Cache Control for sensitive data
    if (req.path.includes('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    // CORS headers for medical data
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Custom security headers for medical compliance
    res.setHeader('X-Medical-App', 'IntelliCare');
    res.setHeader('X-Security-Level', 'HIPAA-Compliant');
    
    // Rate limiting headers
    if (req.rateLimit) {
      res.setHeader('X-RateLimit-Limit', req.rateLimit.limit);
      res.setHeader('X-RateLimit-Remaining', req.rateLimit.remaining);
      res.setHeader('X-RateLimit-Reset', req.rateLimit.reset);
    }
    
    next();
  });
};

// CORS configuration for medical app
const corsConfig = {
  origin: function (origin, callback) {
    // Only log CORS checks for actual cross-origin requests
    if (origin) {
      console.log(`🔍 CORS Check: Origin="${origin}"`);
    }
    
    // Allow requests with no origin (same-origin requests, mobile apps, Postman, etc.)
    if (!origin) {
      // Same-origin request or internal call - always allowed
      return callback(null, true);
    }

    // Base allowed origins
    let allowedOrigins = [];
    
    // Development-only origins (NEVER in production)
    if (secureConfigService.get('NODE_ENV') !== 'production') {
      allowedOrigins.push(
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://developer.localhost:3000',
        // lvh.me for automatic subdomain support (NO HOSTS FILE!)
        'http://lvh.me:3000',
        'http://*.lvh.me:3000'
      );
    }
    
    // Always allowed origins (both dev and production)
    allowedOrigins.push(
      // IntelliCare.health domain origins (HTTP for dev)
      'http://intellicare.health:3000',
      'http://developer.intellicare.health:3000'
    );

    // Production origins (HTTPS only in production)
    if (secureConfigService.get('NODE_ENV') === 'production') {
      // Remove HTTP origins and add HTTPS versions
      allowedOrigins = allowedOrigins.filter(origin => !origin.startsWith('http://'));
      allowedOrigins.push(
        'https://intellicare.health',
        'https://app.intellicare.health'
        // Add more production domains as needed
      );
    }

    // Trim any whitespace from origin to avoid issues
    const trimmedOrigin = origin.trim();
    
    // Check if origin is in explicit allowed list
    if (allowedOrigins.indexOf(trimmedOrigin) !== -1) {
      console.log(`✅ CORS: Allowing origin: ${trimmedOrigin}`);
      return callback(null, true);
    } 
    
    // Check subdomain patterns - allow ANY subdomain of our domains
    else if (trimmedOrigin && /^http:\/\/[a-z0-9-]+\.localhost(:\d+)?$/.test(trimmedOrigin)) {
      // Allow any subdomain for multi-tenant architecture (English alphanumeric + hyphens)
      console.log(`✅ CORS: Allowing localhost subdomain: ${trimmedOrigin}`);
      return callback(null, true);
    } else if (trimmedOrigin && /^http:\/\/[א-ת0-9-]+\.localhost(:\d+)?$/.test(trimmedOrigin)) {
      // Allow Hebrew subdomains for multi-tenant architecture
      console.log(`✅ CORS: Allowing Hebrew localhost subdomain: ${trimmedOrigin}`);
      return callback(null, true);
    } else if (trimmedOrigin && /^http:\/\/[a-zA-Z0-9\u0590-\u05FF-]+\.localhost(:\d+)?$/.test(trimmedOrigin)) {
      // Allow mixed English/Hebrew subdomains for multi-tenant architecture
      console.log(`✅ CORS: Allowing mixed localhost subdomain: ${trimmedOrigin}`);
      return callback(null, true);
    } else if (trimmedOrigin && /^http:\/\/[a-zA-Z0-9-]+\.intellicare\.health(:\d+)?$/i.test(trimmedOrigin)) {
      // Allow ANY IntelliCare.health subdomain with any port (HTTP) - case insensitive
      console.log(`✅ CORS: Allowing IntelliCare.health subdomain origin (HTTP): ${trimmedOrigin}`);
      return callback(null, true);
    } else if (trimmedOrigin && /^https:\/\/[a-zA-Z0-9-]+\.intellicare\.health(:\d+)?$/i.test(trimmedOrigin)) {
      // Allow ANY IntelliCare.health subdomain with any port (HTTPS) - case insensitive
      console.log(`✅ CORS: Allowing IntelliCare.health subdomain origin (HTTPS): ${trimmedOrigin}`);
      return callback(null, true);
    } else if (trimmedOrigin && /^http:\/\/[a-z0-9-]+\.lvh\.me(:\d+)?$/.test(trimmedOrigin)) {
      // Allow lvh.me subdomains with any port - NO HOSTS FILE NEEDED!
      console.log(`✅ CORS: Allowing lvh.me subdomain (automatic DNS): ${trimmedOrigin}`);
      return callback(null, true);
    } else {
      // Enhanced debugging for CORS issues
      console.warn(`❌ CORS blocked origin: ${trimmedOrigin}`);
      console.warn(`❌ CORS origin details:`, {
        original: origin,
        trimmed: trimmedOrigin,
        type: typeof trimmedOrigin,
        length: trimmedOrigin?.length,
        // Test each regex pattern for debugging
        matchesLocalhost: /^http:\/\/[a-z0-9-]+\.localhost(:\d+)?$/.test(trimmedOrigin),
        matchesIntellicare: /^http:\/\/[a-z0-9-]+\.intellicare\.health(:\d+)?$/.test(trimmedOrigin),
        matchesLvhMe: /^http:\/\/[a-z0-9-]+\.lvh\.me(:\d+)?$/.test(trimmedOrigin)
      });
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    // ✅ LEGITIMATE HEADERS - Standard HTTP headers
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',        // Bearer tokens from server
    
    // ✅ REAL SECURITY HEADERS - Server-controlled
    'X-CSRF-Token',        // Server-generated CSRF protection
    'X-Request-ID',        // Request tracking (not security, just logging)
    'X-Client-Version',    // Client compatibility (not security)
    'X-Practice-Subdomain',  // Multi-tenant routing
    
    // ✅ STANDARD HTTP CACHE HEADERS
    'Cache-Control',
    'Pragma',
    'Expires',
    
    // ❌ REMOVED: X-Timestamp (client can spoof)
    // ❌ REMOVED: X-Signature (meaningless if key is client-side)
    // ❌ REMOVED: X-Service-ID/Key (fake authentication)
    // ❌ REMOVED: X-Session-ID (use httpOnly cookies instead)
    // ❌ REMOVED: X-API-Key (should be server-managed)
    // ❌ REMOVED: X-Auth-Token (use Authorization header)
    // ❌ REMOVED: X-Correlation-ID (server should generate)
    // ❌ REMOVED: user-id (should come from server session)
  ],
  exposedHeaders: [
    // ✅ LEGITIMATE EXPOSED HEADERS
    'X-RateLimit-Limit',      // Rate limiting info
    'X-RateLimit-Remaining',  // Rate limiting info
    'X-RateLimit-Reset',      // Rate limiting info
    'X-Security-Level',       // Security compliance indicator
    'X-Request-ID',           // Request tracking for debugging
    'X-CSRF-Token',           // New CSRF token from server
    
    // ❌ REMOVED: X-Correlation-ID (server-generated, don't expose)
    // ❌ REMOVED: X-Security-Status (internal security info)
    // ❌ REMOVED: X-Audit-ID (internal audit info)
  ],
  maxAge: 86400 // 24 hours
};

// Security monitoring middleware
const securityMonitoring = (req, res, next) => {
  // Log security-relevant requests
  if (req.path.includes('/auth') || req.path.includes('/mfa') || req.path.includes('/security')) {
    console.log(`🔒 Security request: ${req.method} ${req.path} from ${req.ip}`);
  }
  
  // Monitor for suspicious patterns
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /javascript:/i,  // JavaScript injection
    /vbscript:/i,  // VBScript injection
    /onload=/i,  // Event handler injection
    /onerror=/i  // Error handler injection
  ];
  
  const userAgent = req.get('User-Agent') || '';
  const referer = req.get('Referer') || '';
  const requestData = JSON.stringify(req.body || {});
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(req.url) || pattern.test(userAgent) || pattern.test(referer) || pattern.test(requestData)) {
      console.warn(`🚨 Suspicious request detected: ${req.method} ${req.url} from ${req.ip}`);
      console.warn(`   Pattern: ${pattern}`);
      console.warn(`   User-Agent: ${userAgent}`);
      
      // Log to security audit service if available
      if (global.securityAuditService) {
        global.securityAuditService.logSecurityEvent({
          type: 'suspicious_request',
          severity: 'warning',
          clientIp: req.ip,
          userAgent: userAgent,
          details: `Suspicious pattern detected in request`,
          metadata: {
            url: req.url,
            method: req.method,
            pattern: pattern.toString()
          }
        });
      }
      
      // Block obviously malicious requests
      if (pattern.test(req.url)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Request blocked by security filter'
        });
      }
    }
  }
  
  next();
};

// Request sanitization middleware
const requestSanitization = (req, res, next) => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters (Express 5: req.query is read-only, sanitize values in-place)
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      req.query[key] = typeof req.query[key] === 'string' ? sanitizeString(req.query[key]) : sanitizeObject(req.query[key]);
    }
  }
  
  next();
};

// Sanitize object recursively
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeString(key);
    sanitized[sanitizedKey] = sanitizeObject(value);
  }
  
  return sanitized;
}

// Sanitize string values
function sanitizeString(value) {
  if (typeof value !== 'string') {
    return value;
  }
  
  // Remove potentially dangerous characters
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

module.exports = {
  securityHeaders,
  corsConfig,
  securityMonitoring,
  requestSanitization
};
