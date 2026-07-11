/**
 * 🔍 SESSION FINGERPRINTING MIDDLEWARE
 * 
 * Validates device fingerprints to detect session hijacking attempts.
 * Creates and verifies unique device signatures for each session.
 * 
 * SECURITY: If fingerprint changes mid-session = possible hijack!
 * 
 * Future developers: Never disable fingerprinting in production.
 * This is a critical defense against session theft.
 */

const crypto = require('crypto');
const UAParser = require('ua-parser-js');
const { simpleAuditLog } = require('./auditLog');

class SessionFingerprintService {
  constructor() {
    // Store session fingerprints with expiration
    this.sessionFingerprints = new Map();
    
    // Store suspicious activity
    this.suspiciousAttempts = new Map();
    
    // Clean up expired sessions every 10 minutes
    setInterval(() => this.cleanupSessions(), 10 * 60 * 1000);
  }

  /**
   * Generate fingerprint from request
   */
  generateFingerprint(req) {
    const parser = new UAParser(req.headers['user-agent']);
    const ua = parser.getResult();
    
    // Collect fingerprint components
    const components = {
      // Browser info
      browser: `${ua.browser.name}-${ua.browser.version}`,
      os: `${ua.os.name}-${ua.os.version}`,
      device: ua.device.type || 'desktop',
      
      // Network info
      ip: this.getClientIP(req),
      ipFamily: req.connection.remoteFamily,
      
      // Headers that rarely change during session
      acceptLanguage: req.headers['accept-language'],
      acceptEncoding: req.headers['accept-encoding'],
      
      // Custom fingerprint from client
      clientFingerprint: req.headers['x-session-fingerprint'],
      
      // Security headers
      dnt: req.headers['dnt'],
      
      // Connection info
      protocol: req.protocol,
      secure: req.secure
    };

    // Create hash of components
    const fingerprintString = JSON.stringify(components);
    const hash = crypto.createHash('sha256').update(fingerprintString).digest('hex');
    
    return {
      hash,
      components,
      timestamp: Date.now()
    };
  }

  /**
   * Get real client IP considering proxies
   */
  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.ip;
  }

  /**
   * Validate session fingerprint
   */
  validateFingerprint(sessionId, currentFingerprint, storedFingerprint) {
    if (!storedFingerprint) {
      // First request in session
      return { valid: true, reason: 'new_session' };
    }

    // Check if fingerprint hash matches
    if (currentFingerprint.hash === storedFingerprint.hash) {
      return { valid: true, reason: 'exact_match' };
    }

    // Calculate similarity score for components
    const similarity = this.calculateSimilarity(
      currentFingerprint.components,
      storedFingerprint.components
    );

    // Allow minor changes (like browser version updates)
    if (similarity >= 0.85) {
      return { valid: true, reason: 'minor_change', similarity };
    }

    // Check for suspicious patterns
    const suspiciousReasons = this.detectSuspiciousChanges(
      currentFingerprint.components,
      storedFingerprint.components
    );

    if (suspiciousReasons.length > 0) {
      return {
        valid: false,
        reason: 'suspicious_change',
        details: suspiciousReasons,
        similarity
      };
    }

    // Major change but not necessarily suspicious
    if (similarity >= 0.70) {
      return {
        valid: true,
        reason: 'major_change',
        warning: true,
        similarity
      };
    }

    // Too different - likely hijack attempt
    return {
      valid: false,
      reason: 'fingerprint_mismatch',
      similarity
    };
  }

  /**
   * Calculate similarity between two fingerprint components
   */
  calculateSimilarity(current, stored) {
    const keys = new Set([...Object.keys(current), ...Object.keys(stored)]);
    let matches = 0;
    let total = 0;

    for (const key of keys) {
      // Skip timestamp and other metadata
      if (['timestamp'].includes(key)) continue;
      
      total++;
      
      if (current[key] === stored[key]) {
        matches++;
      } else if (this.isSimilarValue(key, current[key], stored[key])) {
        matches += 0.5; // Partial match
      }
    }

    return total > 0 ? matches / total : 0;
  }

  /**
   * Check if values are similar (for minor version changes etc)
   */
  isSimilarValue(key, val1, val2) {
    if (!val1 || !val2) return false;

    // Browser/OS version changes are often minor
    if (['browser', 'os'].includes(key)) {
      const base1 = val1.split('-')[0];
      const base2 = val2.split('-')[0];
      return base1 === base2;
    }

    return false;
  }

  /**
   * Detect suspicious fingerprint changes
   */
  detectSuspiciousChanges(current, stored) {
    const suspicious = [];

    // IP change from different country/region
    if (current.ip !== stored.ip) {
      const ipDistance = this.estimateIPDistance(current.ip, stored.ip);
      if (ipDistance > 1000) { // Over 1000km
        suspicious.push('Large geographic IP change');
      }
    }

    // OS change (very suspicious mid-session)
    if (current.os !== stored.os) {
      suspicious.push('Operating system changed');
    }

    // Device type change
    if (current.device !== stored.device) {
      suspicious.push('Device type changed');
    }

    // Client fingerprint mismatch (canvas, etc)
    if (current.clientFingerprint !== stored.clientFingerprint) {
      suspicious.push('Client fingerprint mismatch');
    }

    // Multiple browser changes
    if (current.browser !== stored.browser && 
        current.acceptLanguage !== stored.acceptLanguage) {
      suspicious.push('Multiple browser characteristics changed');
    }

    return suspicious;
  }

  /**
   * Estimate distance between IPs (simplified)
   */
  estimateIPDistance(ip1, ip2) {
    // In production, use GeoIP database
    // For now, return 0 if same subnet, 2000 if different
    const subnet1 = ip1.split('.').slice(0, 3).join('.');
    const subnet2 = ip2.split('.').slice(0, 3).join('.');
    return subnet1 === subnet2 ? 0 : 2000;
  }

  /**
   * Record suspicious attempt
   */
  recordSuspiciousAttempt(sessionId, fingerprint, reason) {
    const key = `${sessionId}_${fingerprint.components.ip}`;
    const attempts = this.suspiciousAttempts.get(key) || [];
    
    attempts.push({
      timestamp: Date.now(),
      reason,
      fingerprint: fingerprint.hash
    });

    this.suspiciousAttempts.set(key, attempts);

    // Block if too many attempts
    return attempts.length >= 3;
  }

  /**
   * Clean up expired sessions
   */
  cleanupSessions() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [sessionId, data] of this.sessionFingerprints.entries()) {
      if (now - data.timestamp > maxAge) {
        this.sessionFingerprints.delete(sessionId);
      }
    }

    // Clean up old suspicious attempts
    for (const [key, attempts] of this.suspiciousAttempts.entries()) {
      const recent = attempts.filter(a => now - a.timestamp < maxAge);
      if (recent.length === 0) {
        this.suspiciousAttempts.delete(key);
      } else {
        this.suspiciousAttempts.set(key, recent);
      }
    }
  }

  /**
   * Middleware function
   */
  middleware() {
    return async (req, res, next) => {
      try {
        // Skip for public endpoints
        const publicPaths = ['/health', '/api/health', '/api/auth/login', '/api/auth/signup'];
        if (publicPaths.includes(req.path)) {
          return next();
        }

        // Get session ID
        const sessionId = req.session?.id || req.headers['x-session-id'];
        if (!sessionId) {
          return next(); // Let auth middleware handle missing session
        }

        // Generate current fingerprint
        const currentFingerprint = this.generateFingerprint(req);
        
        // Get stored fingerprint
        const storedFingerprint = this.sessionFingerprints.get(sessionId);
        
        // Validate fingerprint
        const validation = this.validateFingerprint(
          sessionId,
          currentFingerprint,
          storedFingerprint
        );

        if (!validation.valid) {
          // Record suspicious attempt
          const shouldBlock = this.recordSuspiciousAttempt(
            sessionId,
            currentFingerprint,
            validation.reason
          );

          // Log security event
          console.error('Session fingerprint validation failed:', {
            sessionId,
            reason: validation.reason,
            details: validation.details,
            similarity: validation.similarity,
            ip: currentFingerprint.components.ip,
            userAgent: req.headers['user-agent']
          });

          // Audit log
          await simpleAuditLog(req, 'SESSION_HIJACK_ATTEMPT', {
            sessionId,
            validation,
            fingerprint: currentFingerprint.hash,
            ip: currentFingerprint.components.ip,
            severity: 'CRITICAL'
          });

          if (shouldBlock) {
            return res.status(403).json({
              error: {
                he: 'זוהתה פעילות חשודה. החשבון נחסם זמנית',
                en: 'Suspicious activity detected. Account temporarily blocked'
              }
            });
          }

          // Invalidate session
          if (req.session) {
            req.session.destroy();
          }

          return res.status(401).json({
            error: {
              he: 'השיחה אינה תקפה. נא להתחבר מחדש',
              en: 'Invalid session. Please login again'
            }
          });
        }

        // Update stored fingerprint
        this.sessionFingerprints.set(sessionId, currentFingerprint);

        // Add warning header if there was a major change
        if (validation.warning) {
          res.setHeader('X-Fingerprint-Warning', 'major-change-detected');
        }

        // Add fingerprint to request for logging
        req.fingerprint = {
          hash: currentFingerprint.hash,
          valid: validation.valid,
          reason: validation.reason
        };

        next();
      } catch (error) {
        console.error('Session fingerprint middleware error:', error);
        // Don't block request on error, but log it
        next();
      }
    };
  }
}

// Create singleton instance
const sessionFingerprintService = new SessionFingerprintService();

module.exports = sessionFingerprintService;