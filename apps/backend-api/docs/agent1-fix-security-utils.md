# AGENT 1: Create Proper Security Utils Module

## URGENT: Server is down due to missing securityUtils module

The server cannot start because `secureDataAccess.js` requires `../utils/securityUtils` which doesn't exist. You must create a PROPER security utilities module immediately.

## Your Task: Create backend/utils/securityUtils.js

This module must contain comprehensive security functions, NOT simple regex patterns. After all our security work, we need enterprise-grade security utilities.

## Create this file NOW:

```javascript
// backend/utils/securityUtils.js

/**
 * 🛡️ SECURITY UTILITIES MODULE
 * Enterprise-grade security functions for the IntelliCare platform
 * HIPAA-compliant security validation and threat detection
 */

const crypto = require('crypto');
const validator = require('validator');

class SecurityUtils {
  constructor() {
    // SQL injection patterns - comprehensive list
    this.sqlInjectionPatterns = [
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
      /(;\s*(SELECT|INSERT|UPDATE|DELETE|DROP))/gi
    ];

    // NoSQL injection patterns for MongoDB
    this.noSqlInjectionPatterns = [
      /(\$where|\$regex|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$exists)/gi,
      /({[\s]*\$[\w]+[\s]*:)/gi,
      /(function\s*\(|eval\s*\(|new\s+Function)/gi,
      /(\$\w+\[|\]\.\$)/gi
    ];

    // XSS patterns
    this.xssPatterns = [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]*onerror=/gi,
      /<svg[^>]*onload=/gi,
      /data:text\/html/gi
    ];

    // Path traversal patterns
    this.pathTraversalPatterns = [
      /\.\.\//g,
      /\.\.\\\/g,
      /%2e%2e%2f/gi,
      /%252e%252e%252f/gi,
      /\.\./g
    ];

    // Command injection patterns
    this.commandInjectionPatterns = [
      /(\||;|`|\$\(|<|>|&|\${)/g,
      /(whoami|ls|dir|cat|type|pwd|id|uname|ifconfig|netstat)/gi,
      /(nc|netcat|bash|sh|cmd|powershell|python|perl|ruby|php)/gi
    ];

    // LDAP injection patterns
    this.ldapInjectionPatterns = [
      /(\*|\(|\)|\\|\/|\x00)/g,
      /(\|\||&&)/g
    ];

    // XML injection patterns
    this.xmlInjectionPatterns = [
      /<!DOCTYPE[^>]*>/gi,
      /<!ENTITY[^>]*>/gi,
      /<!\[CDATA\[/gi,
      /SYSTEM/gi
    ];
  }

  /**
   * Comprehensive SQL injection detection
   */
  detectSqlInjection(input) {
    if (!input) return false;
    
    const stringInput = typeof input === 'object' ? JSON.stringify(input) : String(input);
    
    // Check against all SQL injection patterns
    for (const pattern of this.sqlInjectionPatterns) {
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
    
    for (const pattern of this.noSqlInjectionPatterns) {
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
    
    for (const pattern of this.xssPatterns) {
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
    
    for (const pattern of this.pathTraversalPatterns) {
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
    
    for (const pattern of this.commandInjectionPatterns) {
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
   * Get all keys from nested object
   */
  getAllKeys(obj) {
    const keys = [];
    
    const traverse = (current) => {
      if (typeof current === 'object' && current !== null) {
        Object.keys(current).forEach(key => {
          keys.push(key);
          traverse(current[key]);
        });
      }
    };
    
    traverse(obj);
    return keys;
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
}

// Export singleton instance
module.exports = new SecurityUtils();

// Also export individual functions for backward compatibility
module.exports.detectSqlInjection = (input) => module.exports.detectSqlInjection(input);
module.exports.detectNoSqlInjection = (input) => module.exports.detectNoSqlInjection(input);
module.exports.detectXss = (input) => module.exports.detectXss(input);
module.exports.sanitizeInput = (input, type) => module.exports.sanitizeInput(input, type);
module.exports.validateInput = (input, type) => module.exports.validateInput(input, type);
module.exports.generateSecureToken = (length) => module.exports.generateSecureToken(length);
```

## Installation Requirements

You need to install the validator package:
```bash
cd backend
npm install validator
```

## After Creating the File

1. Test that the server starts:
```bash
cd backend
npm run dev
```

2. Verify the security functions work:
```bash
node -e "const sec = require('./utils/securityUtils'); console.log(sec.detectSqlInjection('SELECT * FROM users'))"
# Should output: true
```

3. Update secureDataAccess.js if needed to use the proper import:
```javascript
const securityUtils = require('../utils/securityUtils');
// or
const { detectSqlInjection } = require('../utils/securityUtils');
```

## Verification

Run these commands to confirm everything works:
```bash
# Check server starts
curl http://localhost:5000/health

# Check no errors in logs
tail -20 backend/logs/error.log
```

## DO THIS NOW!

The server is DOWN. Create this file immediately so the system can start. This is CRITICAL for security - we cannot use simple regex patterns after all our security work!

Time limit: 15 minutes