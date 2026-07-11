/**
 * 🛡️ SECURITY UTILITIES MODULE
 * Enterprise-grade security functions for the IntelliCare platform
 * HIPAA-compliant security validation and threat detection
 * Enhanced with comprehensive validation, sanitization, and cryptographic functions
 */

const crypto = require('crypto');
const validator = require('validator');

// SQL injection patterns - comprehensive list (module-level constant)
const SQL_INJECTION_PATTERNS = [
  // SQL Commands
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|MERGE)\b)/gi,
  // SQL Functions and procedures
  /(\b(UNION|JOIN|WHERE|HAVING|GROUP BY|ORDER BY|EXEC|EXECUTE|CAST|CONVERT|DECLARE)\b)/gi,
  // Database-specific commands
  /(xp_cmdshell|sp_executesql|sp_addlogin|sp_password|xp_regread|xp_regwrite)/gi,
  // Common injection techniques
  /(\bOR\b[\s]*[\d\w][\s]*=[\s]*[\d\w])/gi,
  /(\bAND\b[\s]*[\d\w][\s]*=[\s]*[\d\w])/gi,
  /(--|\||;|\/\*|\*\/|@@|@|0x)/gi,
  // Hex encoding attempts
  /(0x[0-9a-f]+)/gi,
  // Time-based blind SQL injection
  /(WAITFOR|DELAY|BENCHMARK|SLEEP|pg_sleep)/gi,
  // Boolean-based blind SQL injection
  /(\b(IF|CASE|WHEN|THEN|ELSE|END)\b)/gi,
  // Stacked queries
  /(;\s*(SELECT|INSERT|UPDATE|DELETE|DROP))/gi,
  // Additional patterns
  /(\bINTO\s+OUTFILE\b)/gi,
  /(\bINTO\s+DUMPFILE\b)/gi,
  /(\bLOAD_FILE\s*\()/gi,
  /(@@version|@@datadir)/gi,
  /(\bUSE\s+\w+)/gi,
  /(\bGRANT\s+\w+)/gi,
  /(\bREVOKE\s+\w+)/gi,
  /(\bSHOW\s+\w+)/gi,
  /(\bDESCRIBE\s+\w+)/gi,
  /(\bEXPLAIN\s+\w+)/gi
];

// NoSQL injection patterns for MongoDB - Module-level constant
const NOSQL_INJECTION_PATTERNS = [
  /(\$where|\$regex|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$exists)/gi,
  /({[\s]*\$[\w]+[\s]*:)/gi,
  /(function\s*\(|eval\s*\(|new\s+Function)/gi,
  /(\$\w+\[|\]\.\$)/gi,
  // Additional NoSQL patterns
  /(\$type|\$mod|\$text|\$expr)/gi,
  /(\$jsonSchema|\$geoWithin|\$geoIntersects|\$near)/gi,
  /(\$nearSphere|\$all|\$elemMatch|\$size|\$comment)/gi,
  /\.constructor\s*\(/gi,
  /process\s*\.\s*env/gi
];

// XSS patterns (module-level constant)
const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<img[^>]*onerror=/gi,
  /<svg[^>]*onload=/gi,
  /data:text\/html/gi,
  // Additional XSS patterns
  /eval\s*\(/gi,
  /document\.(cookie|write|domain|location)/gi,
  /window\.(location|open)/gi,
  /\.innerHTML\s*=/gi,
  /\.outerHTML\s*=/gi,
  /<embed[^>]*>/gi,
  /<object[^>]*>/gi,
  /<applet[^>]*>/gi,
  /<meta[^>]*http-equiv/gi,
  /<link[^>]*href.*javascript:/gi,
  /vbscript:/gi,
  /onmouse\w+\s*=/gi,
  /onkey\w+\s*=/gi,
  /onload\s*=/gi,
  /onclick\s*=/gi,
  /onerror\s*=/gi
];

// Path traversal patterns (module-level constant)
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.\\/g,
  /%2e%2e%2f/gi,
  /%252e%252e%252f/gi,
  /\.\./g,
  // Additional path traversal patterns
  /\.\.%2f/gi,
  /\.\.%5c/gi,
  /\.\.%252f/gi,
  /\.\.%255c/gi,
  /\.\/%2e%2e/gi,
  /\.\.%00\//gi,
  /\.\.%0d%0a\//gi,
  /\.\.\/\.\.\//gi,
  /\.\.\\\.\.\\/, 
  /\/etc\/passwd/gi,
  /\/windows\/system32/gi,
  /\/proc\/self/gi
];

// Command injection patterns (module-level constant)
const COMMAND_INJECTION_PATTERNS = [
  /(\||;|`|\$\(|<|>|&|\${)/g,
  /(whoami|ls|dir|cat|type|pwd|id|uname|ifconfig|netstat)/gi,
  /(nc|netcat|bash|sh|cmd|powershell|python|perl|ruby|php)/gi,
  // Additional command injection patterns
  /\|\|/g,
  /&&/g,
  /\b(rm|cp|mv|wget|curl|telnet|ssh)\b/gi,
  /\b(chmod|chown|sudo|su)\b/gi,
  /\b(ping|traceroute|nslookup|dig)\b/gi,
  /\b(kill|pkill|killall)\b/gi,
  />\s*\/dev\/null/gi,
  /2>&1/g,
  /<\(/g,
  /\$\{.*\}/g
];

// LDAP injection patterns (module-level constant)
const LDAP_INJECTION_PATTERNS = [
  /(\*|\(|\)|\\|\/|\x00)/g,
  /(\|\||&&)/g,
  // Additional LDAP patterns
  /(\(|\))(objectClass=\*)/gi,
  /\(\w+=\*\)/gi
];

// XML injection patterns (module-level constant)
const XML_INJECTION_PATTERNS = [
  /<!DOCTYPE[^>]*>/gi,
  /<!ENTITY[^>]*>/gi,
  /<!\[CDATA\[/gi,
  /SYSTEM/gi,
  // Additional XML patterns
  /<!ELEMENT/gi,
  /SYSTEM\s+"file:/gi,
  /SYSTEM\s+"http:/gi,
  /xmlns:/gi,
  /<soap:/gi,
  /<\?xml/gi
];

class SecurityUtils {
  constructor() {
    // Initialize rate limiters map
    this.rateLimiters = new Map();
  }

  /**
   * Comprehensive SQL injection detection
   */
  detectSqlInjection(input) {
    if (!input) return false;
    
    const stringInput = typeof input === 'object' ? JSON.stringify(input) : String(input);
    
    // Check against all SQL injection patterns
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(stringInput)) {
        console.warn(`🚨 SQL Injection detected: Pattern ${pattern} matched in input`);
        return true;
      }
    }
    
    // Check for encoded attempts
    const decodedInput = this.decodeInput(stringInput);
    if (decodedInput !== stringInput) {
      return this.detectSqlInjection(decodedInput);
    }
    
    return false;
  }

  /**
   * NoSQL injection detection for MongoDB
   */
  detectNoSqlInjection(input) {
    if (!input) return false;
    
    const stringInput = typeof input === 'object' ? JSON.stringify(input) : String(input);
    
    for (const pattern of NOSQL_INJECTION_PATTERNS) {
      if (pattern.test(stringInput)) {
        console.warn(`🚨 NoSQL Injection detected: Pattern ${pattern} matched`);
        return true;
      }
    }
    
    // Check for dangerous object keys
    if (typeof input === 'object') {
      const dangerousKeys = ['$where', '$regex', '__proto__', 'constructor', 'prototype'];
      const keys = this.getAllKeys(input);
      
      for (const key of keys) {
        if (dangerousKeys.includes(key)) {
          console.warn(`🚨 NoSQL Injection detected: Dangerous key "${key}" found`);
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * XSS detection
   */
  detectXss(input) {
    if (!input) return false;
    
    const stringInput = String(input);
    
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(stringInput)) {
        console.warn(`🚨 XSS detected: Pattern ${pattern} matched`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Path traversal detection
   */
  detectPathTraversal(input) {
    if (!input) return false;
    
    const stringInput = String(input);
    
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(stringInput)) {
        console.warn(`🚨 Path traversal detected: Pattern ${pattern} matched`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Command injection detection
   */
  detectCommandInjection(input) {
    if (!input) return false;
    
    const stringInput = String(input);
    
    for (const pattern of COMMAND_INJECTION_PATTERNS) {
      if (pattern.test(stringInput)) {
        console.warn(`🚨 Command injection detected: Pattern ${pattern} matched`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Comprehensive input validation
   */
  validateInput(input, type = 'general') {
    const threats = [];
    
    if (this.detectSqlInjection(input)) {
      threats.push('SQL_INJECTION');
    }
    
    if (this.detectNoSqlInjection(input)) {
      threats.push('NOSQL_INJECTION');
    }
    
    if (this.detectXss(input)) {
      threats.push('XSS');
    }
    
    if (this.detectPathTraversal(input)) {
      threats.push('PATH_TRAVERSAL');
    }
    
    if (this.detectCommandInjection(input)) {
      threats.push('COMMAND_INJECTION');
    }
    
    return {
      isValid: threats.length === 0,
      threats: threats,
      sanitized: threats.length > 0 ? this.sanitizeInput(input, type) : input
    };
  }

  /**
   * Input sanitization
   */
  sanitizeInput(input, type = 'general') {
    if (!input) return input;
    
    let sanitized = String(input);
    
    switch (type) {
      case 'html':
        // Remove all HTML tags
        sanitized = sanitized.replace(/<[^>]*>/g, '');
        break;
        
      case 'sql':
        // Escape SQL special characters
        sanitized = sanitized.replace(/['";\\]/g, '\\$&');
        break;
        
      case 'mongodb':
        // Remove MongoDB operators
        sanitized = sanitized.replace(/\$\w+/g, '');
        break;
        
      case 'filename':
        // Sanitize for file operations
        sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '');
        break;
        
      case 'email':
        // Validate and sanitize email
        sanitized = validator.normalizeEmail(sanitized) || '';
        break;
        
      default:
        // General sanitization
        sanitized = validator.escape(sanitized);
    }
    
    return sanitized;
  }

  /**
   * Decode various encoding attempts
   */
  decodeInput(input) {
    let decoded = input;
    
    try {
      // URL decode
      decoded = decodeURIComponent(decoded);
      
      // Base64 decode attempt
      if (/^[A-Za-z0-9+/]+=*$/.test(decoded)) {
        const base64Decoded = Buffer.from(decoded, 'base64').toString('utf-8');
        if (base64Decoded && !base64Decoded.includes('�')) {
          decoded = base64Decoded;
        }
      }
      
      // Hex decode
      if (/^[0-9a-fA-F]+$/.test(decoded) && decoded.length % 2 === 0) {
        const hexDecoded = Buffer.from(decoded, 'hex').toString('utf-8');
        if (hexDecoded && !hexDecoded.includes('�')) {
          decoded = hexDecoded;
        }
      }
    } catch (e) {
      // If decoding fails, return original
    }
    
    return decoded;
  }

  /**
   * Get all keys from nested object - MEDICAL PLATFORM SECURITY
   * Detects and logs Mongoose objects but continues processing for security validation
   */
  getAllKeys(obj) {
    const keys = [];
    
    // First, check for Mongoose object patterns
    this.detectMongooseObject(obj);
    
    const traverse = (current) => {
      if (typeof current === 'object' && current !== null) {
        Object.keys(current).forEach(key => {
          // Skip Mongoose internal properties during key collection
          // These should not be in queries, but if they are, they'll be caught elsewhere
          if (!key.startsWith('$__') && key !== '_doc' && key !== '$locals') {
            keys.push(key);
          }
          traverse(current[key]);
        });
      }
    };
    
    traverse(obj);
    return keys;
  }

  /**
   * Detect if object contains Mongoose properties (for logging)
   */
  detectMongooseObject(obj) {
    if (!obj || typeof obj !== 'object') return false;

    const mongooseProps = ['$__', '$isNew', '_doc', '$locals', '$__parent'];
    
    for (const prop of mongooseProps) {
      if (prop in obj) {
        console.warn(`🚨 SECURITY WARNING: Mongoose object detected in security validation`);
        console.warn(`   Found property: ${prop}`);
        console.warn(`   This should be handled by SecureDataAccess validation layer`);
        return true;
      }
    }
    
    // Check nested objects
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (this.detectMongooseObject(obj[key])) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data
   */
  hashData(data, salt = '') {
    return crypto
      .createHash('sha256')
      .update(data + salt)
      .digest('hex');
  }

  /**
   * Verify data integrity
   */
  verifyIntegrity(data, hash, salt = '') {
    const computedHash = this.hashData(data, salt);
    return crypto.timingSafeEqual(
      Buffer.from(computedHash),
      Buffer.from(hash)
    );
  }

  /**
   * Rate limiting check
   */
  checkRateLimit(identifier, maxAttempts = 5, windowMs = 60000) {
    // This would typically use Redis or similar
    // Simplified in-memory implementation
    if (!this.rateLimitMap) {
      this.rateLimitMap = new Map();
    }
    
    const now = Date.now();
    const userAttempts = this.rateLimitMap.get(identifier) || [];
    
    // Remove old attempts outside the window
    const validAttempts = userAttempts.filter(timestamp => 
      now - timestamp < windowMs
    );
    
    if (validAttempts.length >= maxAttempts) {
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: new Date(validAttempts[0] + windowMs)
      };
    }
    
    validAttempts.push(now);
    this.rateLimitMap.set(identifier, validAttempts);
    
    return {
      allowed: true,
      remainingAttempts: maxAttempts - validAttempts.length,
      resetTime: null
    };
  }

  /**
   * Validate healthcare-specific inputs
   */
  validateHealthcareData(data, type) {
    switch (type) {
      case 'patient_id':
        // Validate patient ID format
        return /^[A-Z0-9]{6,12}$/.test(data);
        
      case 'medication':
        // Check for dangerous medication names that might be injection attempts
        return !this.detectSqlInjection(data) && /^[a-zA-Z0-9\s\-()]+$/.test(data);
        
      case 'diagnosis_code':
        // ICD-10 format validation
        return /^[A-Z][0-9]{2}(\.[0-9]{1,4})?$/.test(data);
        
      case 'phone':
        // Phone number validation
        return validator.isMobilePhone(data, 'any');
        
      case 'date':
        // Date validation
        return validator.isDate(data);
        
      default:
        return this.validateInput(data).isValid;
    }
  }
  
  /**
   * Enhanced LDAP injection detection
   */
  detectLDAPInjection(input) {
    if (typeof input !== 'string') return false;
    
    for (const pattern of LDAP_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        console.warn(`🚨 LDAP Injection detected: Pattern ${pattern} matched`);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * XML injection detection
   */
  detectXMLInjection(input) {
    if (typeof input !== 'string') return false;
    
    for (const pattern of XML_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        console.warn(`🚨 XML Injection detected: Pattern ${pattern} matched`);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Alias for detectXss for naming consistency
   */
  detectXSS(input) {
    return this.detectXss(input);
  }
  
  /**
   * Enhanced sanitize method (alias)
   */
  sanitize(input, type = 'general') {
    return this.sanitizeInput(input, type);
  }
  
  /**
   * Hash passwords securely with PBKDF2
   */
  async hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }
  
  /**
   * Verify password hash with timing-safe comparison
   */
  async verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(':')) {
      return false;
    }
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
  }
  
  /**
   * Generate HMAC signature
   */
  generateHMAC(data, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }
  
  /**
   * Verify HMAC signature with timing-safe comparison
   */
  verifyHMAC(data, signature, secret) {
    const expectedSignature = this.generateHMAC(data, secret);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }
  
  /**
   * Generate UUID v4
   */
  generateUUID() {
    return crypto.randomUUID();
  }
  
  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(text, key) {
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(64);
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
    
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encryptedData, key) {
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const encrypted = encryptedData.encrypted;
    
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * Generate secure session ID
   */
  generateSessionId() {
    return crypto.randomBytes(32).toString('base64url');
  }
  
  /**
   * Advanced rate limiting with cleanup
   */
  createRateLimiter(identifier, maxAttempts = 10, windowMs = 60000) {
    const key = `${identifier}-${maxAttempts}-${windowMs}`;
    
    if (!this.rateLimiters.has(key)) {
      const attempts = new Map();
      
      this.rateLimiters.set(key, {
        check: (id) => {
          const now = Date.now();
          const userAttempts = attempts.get(id) || [];
          
          // Clean old attempts
          const recentAttempts = userAttempts.filter(
            timestamp => now - timestamp < windowMs
          );
          
          if (recentAttempts.length >= maxAttempts) {
            return { 
              allowed: false, 
              remainingAttempts: 0,
              resetTime: Math.min(...recentAttempts) + windowMs
            };
          }
          
          recentAttempts.push(now);
          attempts.set(id, recentAttempts);
          
          return { 
            allowed: true, 
            remainingAttempts: maxAttempts - recentAttempts.length,
            resetTime: now + windowMs
          };
        },
        
        reset: (id) => {
          attempts.delete(id);
        },
        
        cleanup: () => {
          const now = Date.now();
          for (const [id, timestamps] of attempts.entries()) {
            const recent = timestamps.filter(t => now - t < windowMs);
            if (recent.length === 0) {
              attempts.delete(id);
            } else {
              attempts.set(id, recent);
            }
          }
        }
      });
    }
    
    return this.rateLimiters.get(key);
  }
  
  /**
   * Check password strength
   */
  checkPasswordStrength(password) {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      noCommon: !this.isCommonPassword(password)
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    
    return {
      score,
      strength: score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong',
      checks
    };
  }
  
  /**
   * Check if password is common
   */
  isCommonPassword(password) {
    const commonPasswords = [
      'password', '123456', '12345678', 'qwerty', 'abc123',
      'monkey', '1234567', 'letmein', 'trustno1', 'dragon',
      'baseball', 'iloveyou', 'master', 'sunshine', 'ashley',
      'bailey', 'passw0rd', 'shadow', '123123', '654321'
    ];
    
    const lowerPassword = password.toLowerCase();
    return commonPasswords.some(common => 
      lowerPassword === common || 
      lowerPassword.includes(common)
    );
  }
  
  /**
   * Validate JWT token structure (not verification)
   */
  isValidJWTStructure(token) {
    if (typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    try {
      // Check if parts are valid base64
      parts.forEach(part => {
        Buffer.from(part, 'base64url');
      });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Generate CSRF token
   */
  generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Mask sensitive data for logging
   */
  maskSensitiveData(data, fieldsToMask = ['password', 'token', 'secret', 'key', 'ssn', 'creditCard']) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    const masked = Array.isArray(data) ? [...data] : { ...data };
    
    const maskValue = (value) => {
      if (typeof value === 'string' && value.length > 0) {
        if (value.length <= 4) return '****';
        return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
      }
      return value;
    };
    
    const processObject = (obj) => {
      for (const key in obj) {
        const lowerKey = key.toLowerCase();
        if (fieldsToMask.some(field => lowerKey.includes(field.toLowerCase()))) {
          obj[key] = maskValue(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          obj[key] = processObject(Array.isArray(obj[key]) ? [...obj[key]] : { ...obj[key] });
        }
      }
      return obj;
    };
    
    return processObject(masked);
  }
}

// Create singleton instance
const securityUtilsInstance = new SecurityUtils();

// Export singleton instance and all its methods
module.exports = securityUtilsInstance;

// Individual method exports for destructuring
module.exports.detectSqlInjection = securityUtilsInstance.detectSqlInjection.bind(securityUtilsInstance);
module.exports.detectNoSqlInjection = securityUtilsInstance.detectNoSqlInjection.bind(securityUtilsInstance);
module.exports.validateInput = securityUtilsInstance.validateInput.bind(securityUtilsInstance);