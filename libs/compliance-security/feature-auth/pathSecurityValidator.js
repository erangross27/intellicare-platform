/**
 * 🔒 PATH SECURITY VALIDATOR
 * 
 * Prevents path traversal attacks and validates all file paths.
 * Blocks encoded patterns, absolute paths, and dangerous directories.
 */

class PathSecurityValidator {
  constructor() {
    this.allowedDirectories = ['uploads', 'temp', 'public', 'documents', 'reports'];
    this.blockedPatterns = new Set();
    this.validationCache = new Map();
  }

  async initialize() {
    if (!this.serviceToken) {
      this.serviceToken = await serviceAccountManager.authenticate('path-security-validator');
    }
    return this;
  }

  /**
   * Main validation method - blocks all dangerous paths
   */
  validatePath(path) {
    if (!path || typeof path !== 'string') {
      throw new SecurityError('Invalid path provided');
    }

    // Check cache first
    if (this.validationCache.has(path)) {
      const cached = this.validationCache.get(path);
      if (!cached.valid) {
        throw new SecurityError(cached.reason);
      }
      return true;
    }

    // Decode path multiple times to catch double/triple encoding
    let decodedPath = path;
    for (let i = 0; i < 3; i++) {
      try {
        const decoded = decodeURIComponent(decodedPath);
        if (decoded === decodedPath) break; // No more encoding
        decodedPath = decoded;
      } catch (e) {
        // Invalid encoding - suspicious
        this.cacheResult(path, false, 'Invalid URL encoding detected');
        throw new SecurityError('Invalid URL encoding in path');
      }
    }

    // Also decode HTML entities
    decodedPath = this.decodeHtmlEntities(decodedPath);

    // Normalize path separators
    const normalizedPath = decodedPath.replace(/\\/g, '/');

    // Check for null bytes
    if (normalizedPath.includes('\0') || normalizedPath.includes('%00')) {
      this.cacheResult(path, false, 'Null byte injection attempt');
      throw new SecurityError('Null byte injection blocked');
    }

    // Check for traversal patterns
    const traversalPatterns = [
      /\.\./,                    // Basic traversal
      /\.\.%/,                   // Encoded traversal
      /%2e%2e/i,                 // URL encoded dots
      /\x2e\x2e/,               // Hex encoded dots
      /\.\.\\/,                 // Windows traversal
      /\.\.;/,                  // Semicolon bypass
      /\.\.\//,                 // Unix traversal
      /\.\.[\/\\]/,             // Any separator
      /(?:^|[\/\\])\.{2,}/,    // Multiple dots
      /\.{2,}[\/\\]/,           // Dots followed by separator
      /%252e%252e/i,            // Double encoded
      /\u002e\u002e/,           // Unicode dots
      /＼/,                     // Unicode backslash
      /／/                      // Unicode forward slash
    ];

    for (const pattern of traversalPatterns) {
      if (pattern.test(normalizedPath)) {
        this.cacheResult(path, false, `Path traversal pattern detected: ${pattern}`);
        throw new SecurityError(`Path traversal blocked: ${path}`);
      }
    }

    // Block absolute paths
    if (this.isAbsolutePath(normalizedPath)) {
      this.cacheResult(path, false, 'Absolute path not allowed');
      throw new SecurityError(`Absolute path blocked: ${path}`);
    }

    // Block system paths
    const systemPaths = [
      /^\/etc\//,
      /^\/proc\//,
      /^\/sys\//,
      /^\/dev\//,
      /^\/boot\//,
      /^\/bin\//,
      /^\/sbin\//,
      /^\/usr\//,
      /^\/var\//,
      /^\/root\//,
      /^\/home\//,
      /^c:\\/i,
      /^d:\\/i,
      /^\\\\/, // UNC paths
      /^\/windows\//i,
      /^\/winnt\//i,
      /^\/program files/i,
      /^\/system32\//i
    ];

    for (const pattern of systemPaths) {
      if (pattern.test(normalizedPath)) {
        this.cacheResult(path, false, 'System path access blocked');
        throw new SecurityError(`System path blocked: ${path}`);
      }
    }

    // Check for dangerous file names
    const dangerousFiles = [
      'passwd',
      'shadow',
      'hosts',
      '.env',
      'web.config',
      '.htaccess',
      '.htpasswd',
      'id_rsa',
      'id_dsa',
      '.ssh',
      '.git',
      '.svn',
      'wp-config.php',
      'config.php',
      'database.yml',
      'secrets.yml',
      'private.key',
      'certificate.pem'
    ];

    const fileName = normalizedPath.split('/').pop().toLowerCase();
    if (dangerousFiles.includes(fileName)) {
      this.cacheResult(path, false, `Dangerous file access blocked: ${fileName}`);
      throw new SecurityError(`Access to ${fileName} blocked`);
    }

    // Validate against whitelist
    if (!this.isInAllowedDirectory(normalizedPath)) {
      this.cacheResult(path, false, 'Directory not in whitelist');
      throw new SecurityError(`Directory not allowed: ${normalizedPath}`);
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /[<>"|?*]/,               // Invalid file characters
      /\.\w+\.\w+$/,            // Double extensions
      /\.(exe|dll|bat|cmd|com|pif|scr|vbs|js|jar|zip|rar)$/i, // Executable files
      /[^\x00-\x7F]/            // Non-ASCII characters (excluding valid UTF-8)
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(normalizedPath)) {
        console.warn(`Suspicious path pattern detected: ${normalizedPath}`);
      }
    }

    // Path is valid
    this.cacheResult(path, true, 'Valid path');
    return true;
  }

  /**
   * Check if path is absolute
   */
  isAbsolutePath(path) {
    // Unix absolute path
    if (path.startsWith('/')) return true;
    
    // Windows absolute path
    if (/^[a-zA-Z]:/.test(path)) return true;
    
    // UNC path
    if (path.startsWith('\\\\')) return true;
    
    // URL schemes
    if (/^[a-zA-Z]+:\/\//.test(path)) return true;
    
    return false;
  }

  /**
   * Check if path is in allowed directory
   */
  isInAllowedDirectory(path) {
    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    
    // Get first directory
    const firstDir = cleanPath.split('/')[0];
    
    // Check against whitelist
    return this.allowedDirectories.includes(firstDir) || cleanPath === '';
  }

  /**
   * Decode HTML entities
   */
  decodeHtmlEntities(text) {
    const entities = {
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#x5C;': '\\',
      '&#46;': '.',
      '&#47;': '/',
      '&#92;': '\\'
    };

    let decoded = text;
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'gi'), char);
    }
    
    return decoded;
  }

  /**
   * Cache validation result
   */
  cacheResult(path, valid, reason) {
    this.validationCache.set(path, { valid, reason, timestamp: Date.now() });
    
    // Clear old cache entries (keep last 1000)
    if (this.validationCache.size > 1000) {
      const firstKey = this.validationCache.keys().next().value;
      this.validationCache.delete(firstKey);
    }
  }

  /**
   * Validate file upload path
   */
  validateUploadPath(fileName, uploadDir = 'uploads') {
    // Sanitize file name
    const sanitized = fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace invalid chars
      .replace(/\.{2,}/g, '.')            // Remove multiple dots
      .replace(/^\.+/, '')                // Remove leading dots
      .substring(0, 255);                 // Limit length

    // Generate safe path
    const safePath = `${uploadDir}/${sanitized}`;
    
    // Validate the complete path
    this.validatePath(safePath);
    
    return safePath;
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
  }

  /**
   * Add allowed directory
   */
  addAllowedDirectory(dir) {
    if (dir && !dir.includes('..') && !dir.includes('/')) {
      this.allowedDirectories.push(dir);
    }
  }
}

// Security error class
class SecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SecurityError';
    this.statusCode = 403;
  }
}

module.exports = new PathSecurityValidator();