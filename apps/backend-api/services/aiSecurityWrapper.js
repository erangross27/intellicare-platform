/**
 * 🤖 AI AGENT SECURITY WRAPPER
 *
 * This wrapper ensures AI agents (Claude, Gemini, etc.) cannot bypass security.
 * ALL AI operations MUST go through this wrapper.
 *
 * Even if an AI agent tries to generate insecure code, this wrapper will:
 * 1. Detect security violations
 * 2. Block the operation
 * 3. Log the attempt
 * 4. Provide secure alternative
 *
 * IMPORTANT: AI agents learn from examples. This wrapper provides secure examples.
 */

const SecureDataAccess = require('./secureDataAccess');
const immutableAuditService = require('./immutableAuditService');
const crypto = require('crypto');
const serviceAccountManager = require('./serviceAccountManager');
const BaseService = require('./baseService');

// Define SecurityError class if not available
class SecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SecurityError';
    this.statusCode = 403;
  }
}
const path = require('path');

class AISecurityWrapper extends BaseService {
  constructor() {
    super('ai-security-wrapper');
    this.forbiddenPatterns = [
      /eval\s*\(/gi,
      /new\s+Function\s*\(/gi,
      // COMPREHENSIVE process.env blocking - ALL patterns
      /process\.env/gi,
      /process\["env"\]/gi,
      /process\['env'\]/gi,
      /process\[`env`\]/gi,
      /process\.\s*env/gi,
      /process\s*\.\s*env/gi,
      /process\[.+\]\[.+\]/gi, // Dynamic access like process["e"+"nv"]
      /Object\.keys\s*\(\s*process\.env/gi,
      /JSON\.stringify\s*\(\s*process\.env/gi,
      /\.\.\.process\.env/gi,
      /for\s*\(.+\s+in\s+process\.env/gi,
      /process\.env\?/gi,
      /process\?\.env/gi,
      /globalThis\.process\.env/gi,
      /global\.process\.env/gi,
      /window\.process\.env/gi,
      /this\.process\.env/gi,
      /require\s*\(\s*["']process["']\s*\)\.env/gi,
      /import\.meta\.env/gi,
      /process\[["'`]e["'`]\s*\+\s*["'`]nv["'`]\]/gi, // String concatenation
      /process\[atob\(/gi, // Base64 decode attempts
      /Buffer\.from\(.*process.*env/gi,
      // Child process and execution
      /require\s*\(\s*['"`]child_process['"`]\s*\)/gi,
      /spawn|exec|execFile|fork/gi,
      // File system dangerous operations
      /fs\.(readFileSync|writeFileSync|unlinkSync)/gi,
      /fs\.promises\.(readFile|writeFile|unlink)/gi,
      // Database direct access
      /mongoose\.connection\.db/gi,
      /mongoose\.connect/gi,
      /MongoClient/gi,
      // Dangerous MongoDB operators
      /\$where/gi,
      /\$function/gi,
      /\$accumulator/gi,
      /\$merge/gi,
      /mapReduce/gi,
      // Prototype pollution
      /__proto__/gi,
      /constructor\s*\[/gi,
      /prototype\[/gi,
      // Dynamic code execution
      /require\s*\(\s*[^'"]/gi, // Dynamic require
      /import\s*\(/gi, // Dynamic import
      /setTimeout\s*\(\s*['"`]/gi, // String setTimeout
      /setInterval\s*\(\s*['"`]/gi, // String setInterval
      /setImmediate\s*\(\s*['"`]/gi,
      // VM and sandbox escape
      /vm\.|vm2\.|require\(['"`]vm/gi,
      /this\.constructor\.constructor/gi,
      /arguments\.callee/gi,
      // XSS patterns
      /innerHTML\s*=/gi,
      /outerHTML\s*=/gi,
      /document\.write/gi,
      /document\.writeln/gi,
      /onclick\s*=/gi,
      /onerror\s*=/gi,
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
      // Service manipulation
      /serviceAccountManager\.(accounts|serviceTokens|tokens)/gi,
      /serviceTokenRotation\.(currentTokens|rotateToken)/gi,
      /immutableAuditService\.(enabled|blockchain)/gi,
      /SecureDataAccess\.(skipAudit|disabled)/gi,
      // JWT and crypto manipulation
      /jwt\.(sign|verify)/gi,
      /crypto\.createHmac/gi,
      /bcrypt\.(hash|compare)/gi,
      // Config and secrets access
      /config\.(apiKey|secret|password|token)/gi,
      /\.env$/gi,
      /secrets\.json/gi,
      /private\.key/gi,
      /certificate\.pem/gi
    ];

    this.secureAlternatives = {
      'eval': 'Use JSON.parse() for parsing JSON or specific parsing functions',
      'Function': 'Use predefined functions or switch statements',
      'process.env': 'Use config module: require("../config/default.json")',
      'child_process': 'Use specific safe exec functions with validation',
      'readFileSync': 'Use async fs.promises.readFile with proper error handling',
      'mongoose.connection.db': 'Use SecureDataAccess.query() for database operations',
      '$where': 'Use standard MongoDB query operators',
      '__proto__': 'Use Object.create() or class inheritance',
      'innerHTML': 'Use textContent or createElement/appendChild',
      'document.write': 'Use DOM manipulation methods',
      'setTimeout with string': 'Use setTimeout with function reference'
    };

    this.operationHistory = [];
    this.suspiciousPatterns = new Map();
  }

  async initialize() {
    if (!this.serviceToken) {
      this.serviceToken = await serviceAccountManager.authenticate('ai-security-wrapper');
    }
    return this;
  }

  /**
   * Validate AI-generated code or query
   */
  async validateOperation(operation, context = {}) {
    const validationId = crypto.randomBytes(16).toString('hex');
    const startTime = Date.now();

    try {
      // Check if operation is a string (code/query)
      if (typeof operation === 'string') {
        this.validateCodeString(operation, validationId);
      }

      // Check if operation is an object (structured operation)
      if (typeof operation === 'object' && operation !== null) {
        this.validateStructuredOperation(operation, validationId);
      }

      // Record successful validation
      this.recordOperation({
        id: validationId,
        type: 'validation',
        status: 'success',
        context,
        duration: Date.now() - startTime
      });

      return {
        valid: true,
        validationId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log security violation
      await this.logSecurityViolation(operation, error, context, validationId);

      // Record failed validation
      this.recordOperation({
        id: validationId,
        type: 'validation',
        status: 'failed',
        error: error.message,
        context,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Validate code string for security violations
   */
  validateCodeString(code, validationId) {
    // Check for forbidden patterns
    for (const pattern of this.forbiddenPatterns) {
      if (pattern.test(code)) {
        const patternName = this.getPatternName(pattern);
        const alternative = this.secureAlternatives[patternName] || 'Use secure alternative';
        
        throw new SecurityError(`
          ❌ SECURITY VIOLATION: ${patternName}

          You tried: ${patternName} in your code

          ✅ Do this instead:
          ${alternative}

          📚 Learn more: /docs/SECURITY-COOKBOOK.md#${patternName.toLowerCase().replace(/[^a-z0-9]/g, '-')}
          
          Validation ID: ${validationId}
        `);
      }
    }

    // Check for suspicious activity patterns
    this.detectSuspiciousPatterns(code, validationId);
  }

  /**
   * Validate structured operation
   */
  validateStructuredOperation(operation, validationId) {
    // Validate database operations
    if (operation.type === 'database') {
      this.validateDatabaseOperation(operation, validationId);
    }

    // Validate API operations
    if (operation.type === 'api') {
      this.validateAPIOperation(operation, validationId);
    }

    // Validate file operations
    if (operation.type === 'file') {
      this.validateFileOperation(operation, validationId);
    }

    // Validate function calls
    if (operation.type === 'function') {
      this.validateFunctionCall(operation, validationId);
    }
  }

  /**
   * Validate database operations
   */
  validateDatabaseOperation(operation, validationId) {
    // Check for direct database access
    if (operation.direct === true) {
      throw new SecurityError(`
        ❌ SECURITY VIOLATION: Direct database access

        You tried: /* REMOVED: direct DB access */null or direct Model access

        ✅ Do this instead:
        const SecureDataAccess = require('../services/secureDataAccess');
        const result = await SecureDataAccess.query('${operation.collection || 'collection'}', filter, options, context);

        📚 Learn more: /docs/SECURITY-COOKBOOK.md#database-operations
        
        Validation ID: ${validationId}
      `);
    }

    // Check for dangerous operators
    const dangerousOperators = ['$where', '$function', '$accumulator', '$merge'];
    const query = JSON.stringify(operation.query || {});
    
    for (const operator of dangerousOperators) {
      if (query.includes(operator)) {
        throw new SecurityError(`
          ❌ SECURITY VIOLATION: Dangerous MongoDB operator

          You tried: ${operator} operator in query

          ✅ Do this instead:
          Use standard MongoDB operators like $eq, $gt, $in, $regex
          Example: { field: { $eq: value } } instead of { $where: "this.field == value" }

          📚 Learn more: /docs/SECURITY-COOKBOOK.md#database-operations
          
          Validation ID: ${validationId}
        `);
      }
    }

    // Validate collection access
    if (operation.collection) {
      this.validateCollectionAccess(operation.collection, validationId);
    }
  }

  /**
   * Validate API operations
   */
  validateAPIOperation(operation, validationId) {
    // Check for external API calls without validation
    if (operation.external && !operation.validated) {
      throw new SecurityError(`
        ❌ SECURITY VIOLATION: Unvalidated external API call

        You tried: fetch() or axios without security wrapper

        ✅ Do this instead:
        const secureApiClient = require('../services/secureApiClient');
        const response = await secureApiClient.request(url, { method: 'GET', headers: {...} });

        📚 Learn more: /docs/SECURITY-COOKBOOK.md#api-calls
        
        Validation ID: ${validationId}
      `);
    }

    // Check for sensitive endpoints
    const sensitiveEndpoints = ['/admin', '/config', '/env', '/system'];
    const endpoint = operation.endpoint || '';
    
    for (const sensitive of sensitiveEndpoints) {
      if (endpoint.includes(sensitive) && !operation.authorized) {
        throw new SecurityError(`
          SECURITY VIOLATION: Unauthorized access to sensitive endpoint.
          
          ❌ Endpoint: ${endpoint}
          ✅ Required: Proper authorization and audit logging
          
          Validation ID: ${validationId}
        `);
      }
    }
  }

  /**
   * Validate file operations
   */
  validateFileOperation(operation, validationId) {
    const sensitiveFiles = [
      '.env',
      'config.json',
      'secrets.json',
      'private.key',
      'certificate.pem'
    ];

    const filePath = operation.path || '';
    const fileName = path.basename(filePath);

    // Check for sensitive file access
    if (sensitiveFiles.includes(fileName)) {
      throw new SecurityError(`
        SECURITY VIOLATION: Attempted access to sensitive file.
        
        ❌ File: ${fileName}
        ✅ Use instead: Configuration service or environment variables
        
        Validation ID: ${validationId}
      `);
    }

    // Check for path traversal
    if (filePath.includes('../') || filePath.includes('..\\')) {
      throw new SecurityError(`
        SECURITY VIOLATION: Path traversal attempt detected.
        
        ❌ Path: ${filePath}
        ✅ Use instead: Absolute paths with validation
        
        Validation ID: ${validationId}
      `);
    }
  }

  /**
   * Validate function calls
   */
  validateFunctionCall(operation, validationId) {
    const dangerousFunctions = [
      'eval',
      'Function',
      'setTimeout',
      'setInterval',
      'exec',
      'spawn'
    ];

    const functionName = operation.name || '';

    if (dangerousFunctions.includes(functionName) && !operation.validated) {
      throw new SecurityError(`
        SECURITY VIOLATION: Dangerous function call detected.
        
        ❌ Function: ${functionName}
        ✅ Use instead: ${this.secureAlternatives[functionName] || 'Secure alternative'}
        
        Validation ID: ${validationId}
      `);
    }
  }

  /**
   * Validate collection access
   */
  validateCollectionAccess(collection, validationId) {
    const restrictedCollections = [
      'system',
      'admin',
      'config',
      'users',
      'sessions'
    ];

    if (restrictedCollections.includes(collection) && !this.hasAdminPrivileges()) {
      throw new SecurityError(`
        SECURITY VIOLATION: Unauthorized collection access.
        
        ❌ Collection: ${collection}
        ✅ Required: Admin privileges and audit logging
        
        Validation ID: ${validationId}
      `);
    }
  }

  /**
   * Detect suspicious patterns
   */
  detectSuspiciousPatterns(code, validationId) {
    const suspiciousIndicators = [
      { pattern: /password|secret|key|token/gi, weight: 1 },
      { pattern: /delete|drop|truncate/gi, weight: 2 },
      { pattern: /admin|root|sudo/gi, weight: 2 },
      { pattern: /bypass|override|disable/gi, weight: 3 },
      { pattern: /hack|exploit|vulnerability/gi, weight: 5 }
    ];

    let suspicionScore = 0;
    const detectedIndicators = [];

    for (const indicator of suspiciousIndicators) {
      const matches = code.match(indicator.pattern);
      if (matches) {
        suspicionScore += indicator.weight * matches.length;
        detectedIndicators.push(...matches);
      }
    }

    if (suspicionScore > 5) {
      this.recordSuspiciousActivity(validationId, suspicionScore, detectedIndicators);
      
      if (suspicionScore > 10) {
        throw new SecurityError(`
          SECURITY ALERT: Highly suspicious activity detected.
          
          Suspicion Score: ${suspicionScore}
          Indicators: ${detectedIndicators.join(', ')}
          
          This operation has been blocked and reported.
          Validation ID: ${validationId}
        `);
      }
    }
  }

  /**
   * Log security violation
   */
  async logSecurityViolation(operation, error, context, validationId) {
    const violation = {
      id: validationId,
      timestamp: new Date().toISOString(),
      type: 'ai_security_violation',
      operation: this.sanitizeForLogging(operation),
      error: error.message,
      context,
      stack: error.stack
    };

    // Log to audit system
    await immutableAuditService.addAuditEntry({
      action: 'AI_SECURITY_VIOLATION',
      details: violation,
      severity: 'high',
      requiresReview: true
    });

    // Store for analysis
    this.suspiciousPatterns.set(validationId, violation);

    // Alert if threshold exceeded
    this.checkViolationThreshold();
  }

  /**
   * Sanitize operation for logging
   */
  sanitizeForLogging(operation) {
    const sanitized = JSON.stringify(operation);
    // Remove any potential sensitive data
    return sanitized
      .replace(/password['":\s]*['"][^'"]*['"]/gi, 'password: "[REDACTED]"')
      .replace(/secret['":\s]*['"][^'"]*['"]/gi, 'secret: "[REDACTED]"')
      .replace(/token['":\s]*['"][^'"]*['"]/gi, 'token: "[REDACTED]"')
      .replace(/key['":\s]*['"][^'"]*['"]/gi, 'key: "[REDACTED]"');
  }

  /**
   * Record operation for monitoring
   */
  recordOperation(operation) {
    this.operationHistory.push({
      ...operation,
      timestamp: new Date().toISOString()
    });

    // Keep only last 1000 operations
    if (this.operationHistory.length > 1000) {
      this.operationHistory.shift();
    }
  }

  /**
   * Record suspicious activity
   */
  recordSuspiciousActivity(validationId, score, indicators) {
    const activity = {
      id: validationId,
      timestamp: new Date().toISOString(),
      score,
      indicators,
      action: 'monitored'
    };

    this.suspiciousPatterns.set(validationId, activity);
  }

  /**
   * Check if violation threshold exceeded
   */
  async checkViolationThreshold() {
    const recentViolations = Array.from(this.suspiciousPatterns.values())
      .filter(v => {
        const violationTime = new Date(v.timestamp);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return violationTime > fiveMinutesAgo;
      });

    if (recentViolations.length > 10) {
      // Trigger emergency lockdown
      await this.triggerEmergencyLockdown(recentViolations);
    }
  }

  /**
   * Trigger emergency lockdown
   */
  async triggerEmergencyLockdown(violations) {
    console.error('🚨 EMERGENCY: Multiple AI security violations detected!');
    console.error(`Violations in last 5 minutes: ${violations.length}`);
    
    // Integrate with emergency response system
    const emergencyResponse = require('./emergencyResponse');
    await emergencyResponse.handleRapidViolations('AI-Security-Wrapper', violations.length);
    
    // Notify administrators
    this.notifyAdministrators({
      type: 'emergency_lockdown',
      violations: violations.length,
      timestamp: new Date().toISOString(),
      action: 'AI operations temporarily suspended'
    });
  }

  /**
   * Notify administrators
   */
  notifyAdministrators(alert) {
    // In production, this would send alerts via multiple channels
    console.error('ADMIN ALERT:', alert);
  }

  /**
   * Get pattern name for error messages
   */
  getPatternName(pattern) {
    const patternMap = {
      'eval': 'eval',
      'Function': 'Function',
      'process\\.env': 'process.env',
      'child_process': 'child_process',
      'readFileSync': 'readFileSync',
      'mongoose\\.connection\\.db': 'mongoose.connection.db',
      '\\$where': '$where',
      '__proto__': '__proto__',
      'innerHTML': 'innerHTML',
      'document\\.write': 'document.write'
    };

    for (const [key, name] of Object.entries(patternMap)) {
      if (pattern.source.includes(key)) {
        return name;
      }
    }

    return 'forbidden pattern';
  }

  /**
   * Check if current context has admin privileges
   */
  hasAdminPrivileges() {
    // This would check actual admin status in production
    return false;
  }

  /**
   * Wrap AI function execution with security
   */
  async executeSecure(fn, args, context = {}) {
    const executionId = crypto.randomBytes(16).toString('hex');
    
    try {
      // Validate before execution
      await this.validateOperation(fn.toString(), context);

      // Execute with monitoring
      const result = await this.monitoredExecution(fn, args, executionId);

      // Validate result
      if (result) {
        await this.validateOperation(result, { ...context, phase: 'result' });
      }

      return result;
    } catch (error) {
      await this.logSecurityViolation(
        { function: fn.name, args },
        error,
        context,
        executionId
      );
      throw error;
    }
  }

  /**
   * Monitored execution of function
   */
  async monitoredExecution(fn, args, executionId) {
    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      
      this.recordOperation({
        id: executionId,
        type: 'execution',
        status: 'success',
        function: fn.name,
        duration: Date.now() - startTime
      });

      return result;
    } catch (error) {
      this.recordOperation({
        id: executionId,
        type: 'execution',
        status: 'failed',
        function: fn.name,
        error: error.message,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Get operation statistics
   */
  getStatistics() {
    const total = this.operationHistory.length;
    const successful = this.operationHistory.filter(op => op.status === 'success').length;
    const failed = this.operationHistory.filter(op => op.status === 'failed').length;
    const violations = this.suspiciousPatterns.size;

    return {
      total,
      successful,
      failed,
      violations,
      successRate: total > 0 ? (successful / total * 100).toFixed(2) + '%' : '0%',
      recentOperations: this.operationHistory.slice(-10)
    };
  }
}

module.exports = new AISecurityWrapper();