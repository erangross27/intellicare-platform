/**
 * Advanced Security Middleware for Medical Document Upload
 * Addresses memory exposure, DoS attacks, and upload route protection
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');
const os = require('os');
const securityAuditService = require('../services/securityAuditService');
const immutableAuditService = require('../services/immutableAuditService');
const blockchainAuditService = require('../services/blockchainAuditService');
const zeroTrustService = require('../services/zeroTrustService');

// 🛡️ MEMORY PROTECTION: Monitor and limit memory usage
class MemoryGuard {
  constructor() {
    this.activeUploads = new Map();
    this.maxConcurrentUploads = 5;
    this.maxMemoryUsage = 0.8; // 80% of available memory
    this.uploadTimeouts = new Map();
  }

  // Check if system can handle new upload
  canAcceptUpload(uploadId, estimatedSize) {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const currentUsage = memUsage.heapUsed / totalMem;
    
    // Check memory threshold
    if (currentUsage > this.maxMemoryUsage) {
      console.warn(`🚨 Memory usage high: ${(currentUsage * 100).toFixed(1)}%`);
      return false;
    }

    // Check concurrent uploads
    if (this.activeUploads.size >= this.maxConcurrentUploads) {
      console.warn(`🚨 Too many concurrent uploads: ${this.activeUploads.size}`);
      return false;
    }

    return true;
  }

  // Register new upload
  registerUpload(uploadId, fileSize, userId) {
    const uploadInfo = {
      id: uploadId,
      size: fileSize,
      userId,
      startTime: Date.now(),
      memoryBefore: process.memoryUsage().heapUsed
    };

    this.activeUploads.set(uploadId, uploadInfo);
    
    // Set timeout for upload
    const timeout = setTimeout(() => {
      this.forceCleanup(uploadId, 'timeout');
    }, 300000); // 5 minutes max
    
    this.uploadTimeouts.set(uploadId, timeout);
    
    console.log(`🔒 Upload registered: ${uploadId} (${fileSize} bytes) for user ${userId}`);
    return uploadInfo;
  }

  // Clean up upload
  cleanupUpload(uploadId) {
    const uploadInfo = this.activeUploads.get(uploadId);
    if (uploadInfo) {
      const duration = Date.now() - uploadInfo.startTime;
      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryDiff = memoryAfter - uploadInfo.memoryBefore;
      
      console.log(`✅ Upload completed: ${uploadId} (${duration}ms, memory: ${memoryDiff > 0 ? '+' : ''}${memoryDiff} bytes)`);
      
      this.activeUploads.delete(uploadId);
      
      // Clear timeout
      const timeout = this.uploadTimeouts.get(uploadId);
      if (timeout) {
        clearTimeout(timeout);
        this.uploadTimeouts.delete(uploadId);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  }

  // Force cleanup on timeout or error
  forceCleanup(uploadId, reason) {
    console.error(`🚨 Force cleanup: ${uploadId} (reason: ${reason})`);
    this.cleanupUpload(uploadId);
  }

  // Get current memory status
  getMemoryStatus() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      totalMemory: totalMem,
      usagePercent: (memUsage.heapUsed / totalMem) * 100,
      activeUploads: this.activeUploads.size,
      maxConcurrent: this.maxConcurrentUploads
    };
  }
}

const memoryGuard = new MemoryGuard();

// 🚨 DOS PROTECTION: Rate limiting for upload endpoints
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 uploads per windowMs
  message: {
    error: 'Too many upload attempts',
    message: {
      en: 'Too many upload attempts. Please try again later.',
      he: 'יותר מדי ניסיונות העלאה. אנא נסה שוב מאוחר יותר.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for authenticated admin users
  skip: (req) => {
    return req.user && req.user.role === 'admin';
  }
});

// 🔐 AUTHENTICATION PROTECTION: Verify upload permissions
const uploadAuthMiddleware = async (req, res, next) => {
  console.log('🔐 uploadAuthMiddleware: Checking user');
  console.log('   - req.user exists?', !!req.user);
  console.log('   - req.user._id?', req.user?._id);
  
  // Check authentication
  if (!req.user) {
    securityAuditService.logSecurityEvent({
      type: 'auth_failure',
      severity: 'warning',
      userId: null,
      clientIp: req.ip,
      userAgent: req.get('User-Agent'),
      details: 'Upload attempt without authentication'
    });

    return res.status(401).json({
      error: 'Authentication required',
      message: {
        en: 'Authentication required for file upload',
        he: 'נדרשת אימות להעלאת קבצים'
      }
    });
  }

  // DEBUG: Log user permissions for troubleshooting
  console.log('🔍 UPLOAD AUTH DEBUG:', {
    userId: req.user.id,
    email: req.user.email,
    roles: req.user.roles,
    permissions: req.user.permissions,
    hasUploadPermission: req.user.permissions?.includes('write_documents'),
    permissionsType: typeof req.user.permissions,
    permissionsLength: req.user.permissions?.length
  });

  // Check user permissions for upload (use write_documents permission)
  if (!req.user.permissions || !req.user.permissions.includes('write_documents')) {
    console.log('❌ UPLOAD AUTH FAILED: Missing write_documents permission');

    securityAuditService.logSecurityEvent({
      type: 'auth_failure',
      severity: 'warning',
      userId: req.user.id,
      clientIp: req.ip,
      userAgent: req.get('User-Agent'),
      details: 'Upload attempt with insufficient permissions'
    });

    return res.status(403).json({
      error: 'Insufficient permissions',
      message: {
        en: 'Insufficient permissions for file upload',
        he: 'אין הרשאות מספיקות להעלאת קבצים'
      }
    });
  }

  // Generate upload session ID for tracking
  req.uploadId = crypto.randomBytes(16).toString('hex');
  req.uploadStartTime = Date.now();

  // Log successful auth in multiple audit systems
  const auditData = {
    type: 'upload_attempt',
    severity: 'info',
    userId: req.user.id,
    uploadId: req.uploadId,
    clientIp: req.ip,
    userAgent: req.get('User-Agent'),
    details: 'Authenticated upload attempt initiated'
  };

  // Standard audit logging
  securityAuditService.logSecurityEvent(auditData);

  // Immutable audit logging for critical events
  await immutableAuditService.addAuditEntry({
    eventType: 'document_upload_attempt',
    userId: req.user.id,
    sessionId: req.uploadId,
    clientIp: req.ip,
    userAgent: req.get('User-Agent'),
    details: 'User initiated document upload',
    metadata: {
      uploadId: req.uploadId,
      timestamp: new Date().toISOString()
    }
  });

  // Blockchain logging for critical events
  await blockchainAuditService.addCriticalEvent({
    type: 'document_uploaded',
    userId: req.user.id,
    sessionId: req.uploadId,
    clientIp: req.ip,
    details: 'Document upload initiated',
    metadata: {
      uploadId: req.uploadId,
      userRole: req.user.role
    }
  });

  next();
};

// 🛡️ MEMORY PROTECTION: Pre-upload validation
const memoryProtectionMiddleware = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  
  // Check if system can handle upload
  if (!memoryGuard.canAcceptUpload(req.uploadId, contentLength)) {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      message: {
        en: 'Server is currently processing other uploads. Please try again in a few minutes.',
        he: 'השרת מעבד כרגע העלאות אחרות. אנא נסה שוב בעוד כמה דקות.'
      },
      retryAfter: 300 // 5 minutes
    });
  }

  // Register upload
  memoryGuard.registerUpload(req.uploadId, contentLength, req.user.id);
  
  // Add cleanup on response finish
  res.on('finish', () => {
    memoryGuard.cleanupUpload(req.uploadId);
  });

  // Add cleanup on error
  res.on('error', () => {
    memoryGuard.forceCleanup(req.uploadId, 'response_error');
  });

  next();
};

// 🔍 MALICIOUS PAYLOAD DETECTION: Advanced file validation
const maliciousPayloadDetection = (req, res, next) => {
  // Hook into multer processing to validate files
  const originalEnd = res.end;
  res.end = function(...args) {
    // Validate files after multer processing
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          // Check for malicious patterns in buffer
          if (file.buffer) {
            validateFileBuffer(file.buffer, file.originalname, file.mimetype);
          }
        } catch (validationError) {
          console.error(`🚨 Malicious payload detected: ${file.originalname}`, validationError);

          // Log security incident
          securityAuditService.logSecurityEvent({
            type: 'malicious_file',
            severity: 'critical',
            userId: req.user?.id,
            uploadId: req.uploadId,
            clientIp: req.ip,
            userAgent: req.get('User-Agent'),
            details: `Malicious file detected: ${file.originalname}`,
            metadata: {
              filename: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              error: validationError.message
            }
          });

          return res.status(400).json({
            error: 'Malicious file detected',
            message: {
              en: 'File contains potentially malicious content',
              he: 'הקובץ מכיל תוכן שעלול להיות זדוני'
            }
          });
        }
      }
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// File buffer validation function
function validateFileBuffer(buffer, filename, mimetype) {
  // Check for executable signatures
  const executableSignatures = [
    Buffer.from([0x4D, 0x5A]), // PE executable
    Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
    Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Mach-O executable
  ];

  for (const signature of executableSignatures) {
    if (buffer.subarray(0, signature.length).equals(signature)) {
      throw new Error(`Executable file detected: ${filename}`);
    }
  }

  // Check for script injections in text files
  if (mimetype.startsWith('text/') || filename.endsWith('.txt')) {
    const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length));
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(content)) {
        throw new Error(`Script injection detected in: ${filename}`);
      }
    }
  }

  // Check file size consistency
  if (buffer.length === 0) {
    throw new Error(`Empty file: ${filename}`);
  }

  // Additional MIME type validation
  validateMimeType(buffer, mimetype, filename);
}

// MIME type validation
function validateMimeType(buffer, declaredMime, filename) {
  const fileSignatures = {
    'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B, 0x03, 0x04] // DOCX
  };

  const signature = fileSignatures[declaredMime];
  if (signature) {
    const fileHeader = Array.from(buffer.subarray(0, signature.length));
    if (!signature.every((byte, index) => byte === fileHeader[index])) {
      throw new Error(`MIME type mismatch: ${filename} (declared: ${declaredMime})`);
    }
  }
}

// 📊 MONITORING: Real-time upload monitoring
const monitoringMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const memoryStatus = memoryGuard.getMemoryStatus();
    
    // Log upload metrics
    console.log(`📊 Upload metrics:`, {
      uploadId: req.uploadId,
      userId: req.user?.id,
      duration: `${duration}ms`,
      statusCode: res.statusCode,
      memoryUsage: `${memoryStatus.usagePercent.toFixed(1)}%`,
      activeUploads: memoryStatus.activeUploads,
      timestamp: new Date().toISOString()
    });

    // Alert on anomalies
    if (duration > 30000) { // > 30 seconds
      console.warn(`🚨 Slow upload detected: ${req.uploadId} (${duration}ms)`);
    }
    
    if (memoryStatus.usagePercent > 70) {
      console.warn(`🚨 High memory usage: ${memoryStatus.usagePercent.toFixed(1)}%`);
    }

    originalSend.call(this, data);
  };
  
  next();
};

// 🛡️ ZERO TRUST: Continuous authentication middleware
const zeroTrustAuthMiddleware = async (req, res, next) => {
  try {
    // 🔒 SECURITY: Support both x-session-id and X-Session-ID headers
    const sessionId = req.headers['x-session-id'] || req.headers['X-Session-ID'];
    const clientInfo = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      acceptLanguage: req.get('Accept-Language'),
      acceptEncoding: req.get('Accept-Encoding')
    };

    if (!sessionId) {
      return res.status(401).json({
        error: 'Session required',
        message: {
          en: 'Zero Trust authentication requires valid session',
          he: 'אימות Zero Trust דורש סשן תקף'
        }
      });
    }

    // Validate and refresh session
    const sessionResult = await zeroTrustService.validateAndRefreshSession(sessionId, clientInfo, req.practiceDb);

    if (!sessionResult.valid) {
      return res.status(401).json({
        error: 'Session invalid',
        message: {
          en: `Session validation failed: ${sessionResult.reason}`,
          he: 'אימות הסשן נכשל'
        }
      });
    }

    // Check risk score
    if (sessionResult.session.riskScore > 0.8) {
      return res.status(403).json({
        error: 'High risk session',
        message: {
          en: 'Session risk score too high - additional verification required',
          he: 'ציון הסיכון של הסשן גבוה מדי - נדרש אימות נוסף'
        },
        riskScore: sessionResult.session.riskScore
      });
    }

    // Attach session to request
    req.zeroTrustSession = sessionResult.session;
    req.user = sessionResult.session.userInfo;

    next();
  } catch (error) {
    console.error('Zero Trust authentication error:', error);
    res.status(500).json({
      error: 'Authentication service error',
      message: {
        en: 'Zero Trust authentication service temporarily unavailable',
        he: 'שירות האימות Zero Trust אינו זמין זמנית'
      }
    });
  }
};

// 🛡️ ZERO TRUST: Permission validation middleware
const zeroTrustPermissionMiddleware = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.zeroTrustSession) {
      return res.status(401).json({
        error: 'No valid session',
        message: {
          en: 'Zero Trust session required for permission check',
          he: 'נדרש סשן Zero Trust לבדיקת הרשאות'
        }
      });
    }

    // Check if user has required permission or is system admin
    const hasPermission = zeroTrustService.hasPermission(req.zeroTrustSession, requiredPermission);
    const isSystemAdmin = req.user && (
      req.user.roles?.includes('admin') ||
      req.user.permissions?.includes('system_admin')
    );

    if (!hasPermission && !isSystemAdmin) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: {
          en: `Permission required: ${requiredPermission}`,
          he: 'אין הרשאות מספיקות'
        },
        requiredPermission,
        userRoles: req.user?.roles,
        userPermissions: req.user?.permissions
      });
    }

    next();
  };
};

module.exports = {
  memoryGuard,
  uploadRateLimit,
  uploadAuthMiddleware,
  memoryProtectionMiddleware,
  maliciousPayloadDetection,
  monitoringMiddleware,
  zeroTrustAuthMiddleware,
  zeroTrustPermissionMiddleware
};
