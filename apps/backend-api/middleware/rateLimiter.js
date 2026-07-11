/**
 * 🔒 ENHANCED RATE LIMITER WITH BULK EXTRACTION PROTECTION
 * 
 * Protects API from abuse, bulk data extraction, and sequential scanning.
 * Integrates with emergency response system for automatic lockdown.
 */

const emergencyResponse = require('../services/emergencyResponse');

class EnhancedRateLimiter {
  constructor() {
    this.requestTracking = new Map();
    this.bulkExtractionProtection = new Map();
    this.ipBlacklist = new Set();
    this.sequentialScanDetection = new Map();
    
    // Rate limit configurations
    this.limits = {
      global: { requests: 100, window: 60000 },        // 100 req/min
      perEndpoint: { requests: 30, window: 60000 },    // 30 req/min per endpoint
      perIP: { requests: 50, window: 60000 },          // 50 req/min per IP
      bulkExtraction: { requests: 100, window: 60000 }, // 100 req/min for data endpoints
      authentication: { requests: 5, window: 300000 }   // 5 login attempts per 5 min
    };
    
    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Main rate limiting middleware
   */
  middleware() {
    return async (req, res, next) => {
      try {
        // Check if IP is blacklisted
        if (this.ipBlacklist.has(req.ip)) {
          return res.status(403).json({ error: 'IP blocked due to suspicious activity' });
        }

        // Check various rate limits
        const checks = [
          this.checkGlobalLimit(req),
          this.checkIPLimit(req),
          this.checkEndpointLimit(req),
          this.detectBulkExtraction(req),
          this.detectSequentialScanning(req)
        ];

        const results = await Promise.all(checks);
        
        // If any check fails, block the request
        if (results.some(r => r.blocked)) {
          const blockedCheck = results.find(r => r.blocked);
          
          // Report to emergency response
          if (blockedCheck.severity === 'critical') {
            await emergencyResponse.handleRapidViolations(req.ip, blockedCheck.count);
          }
          
          return res.status(429).json({ 
            error: blockedCheck.message || 'Rate limit exceeded',
            retryAfter: blockedCheck.retryAfter || 60
          });
        }

        next();
      } catch (error) {
        console.error('Rate limiter error:', error);
        next(); // Don't block on error
      }
    };
  }

  /**
   * Check global rate limit
   */
  checkGlobalLimit(req) {
    const key = 'global';
    const now = Date.now();
    
    if (!this.requestTracking.has(key)) {
      this.requestTracking.set(key, []);
    }
    
    const requests = this.requestTracking.get(key);
    const windowStart = now - this.limits.global.window;
    const recentRequests = requests.filter(t => t > windowStart);
    
    recentRequests.push(now);
    this.requestTracking.set(key, recentRequests);
    
    if (recentRequests.length > this.limits.global.requests) {
      return {
        blocked: true,
        message: 'Global rate limit exceeded',
        retryAfter: Math.ceil((recentRequests[0] + this.limits.global.window - now) / 1000)
      };
    }
    
    return { blocked: false };
  }

  /**
   * Check per-IP rate limit
   */
  checkIPLimit(req) {
    const key = `ip:${req.ip}`;
    const now = Date.now();
    
    if (!this.requestTracking.has(key)) {
      this.requestTracking.set(key, []);
    }
    
    const requests = this.requestTracking.get(key);
    const windowStart = now - this.limits.perIP.window;
    const recentRequests = requests.filter(t => t > windowStart);
    
    recentRequests.push(now);
    this.requestTracking.set(key, recentRequests);
    
    if (recentRequests.length > this.limits.perIP.requests) {
      // Blacklist IP after repeated violations
      const violations = this.getViolationCount(req.ip);
      if (violations > 3) {
        this.ipBlacklist.add(req.ip);
        return {
          blocked: true,
          message: 'IP blocked due to repeated rate limit violations',
          severity: 'critical',
          count: violations
        };
      }
      
      return {
        blocked: true,
        message: 'IP rate limit exceeded',
        retryAfter: Math.ceil((recentRequests[0] + this.limits.perIP.window - now) / 1000)
      };
    }
    
    return { blocked: false };
  }

  /**
   * Check per-endpoint rate limit
   */
  checkEndpointLimit(req) {
    const key = `endpoint:${req.method}:${req.path}`;
    const now = Date.now();
    
    if (!this.requestTracking.has(key)) {
      this.requestTracking.set(key, []);
    }
    
    const requests = this.requestTracking.get(key);
    const windowStart = now - this.limits.perEndpoint.window;
    const recentRequests = requests.filter(t => t > windowStart);
    
    recentRequests.push(now);
    this.requestTracking.set(key, recentRequests);
    
    // Special limits for sensitive endpoints
    const sensitiveEndpoints = ['/api/auth/login', '/api/auth/reset-password'];
    if (sensitiveEndpoints.includes(req.path)) {
      if (recentRequests.length > this.limits.authentication.requests) {
        return {
          blocked: true,
          message: 'Authentication rate limit exceeded',
          retryAfter: 300 // 5 minutes
        };
      }
    }
    
    if (recentRequests.length > this.limits.perEndpoint.requests) {
      return {
        blocked: true,
        message: 'Endpoint rate limit exceeded',
        retryAfter: Math.ceil((recentRequests[0] + this.limits.perEndpoint.window - now) / 1000)
      };
    }
    
    return { blocked: false };
  }

  /**
   * Detect bulk data extraction attempts
   */
  async detectBulkExtraction(req) {
    const key = `${req.ip}-${req.path}`;
    const now = Date.now();
    
    if (!this.bulkExtractionProtection.has(key)) {
      this.bulkExtractionProtection.set(key, {
        count: 0,
        firstRequest: now,
        resources: new Set()
      });
    }
    
    const tracking = this.bulkExtractionProtection.get(key);
    tracking.count++;
    
    // Track unique resources accessed
    if (req.params.id) {
      tracking.resources.add(req.params.id);
    }
    
    // Check for bulk extraction patterns
    const timeElapsed = now - tracking.firstRequest;
    
    // More than 100 requests in 1 minute to same endpoint
    if (tracking.count > 100 && timeElapsed < 60000) {
      await emergencyResponse.activateKillSwitch('api-gateway', 'Bulk extraction detected');
      return {
        blocked: true,
        message: 'Bulk extraction detected - API locked',
        severity: 'critical',
        count: tracking.count
      };
    }
    
    // Accessing too many unique resources
    if (tracking.resources.size > 50 && timeElapsed < 60000) {
      return {
        blocked: true,
        message: 'Excessive resource access detected',
        severity: 'high'
      };
    }
    
    // High request rate to data endpoints
    const dataEndpoints = ['/api/patients', '/api/documents', '/api/export'];
    if (dataEndpoints.some(e => req.path.includes(e))) {
      if (tracking.count > 50 && timeElapsed < 30000) {
        return {
          blocked: true,
          message: 'Data extraction rate limit exceeded',
          retryAfter: 60
        };
      }
    }
    
    return { blocked: false };
  }

  /**
   * Detect sequential ID scanning
   */
  detectSequentialScanning(req) {
    if (!req.params.id || !/^\d+$/.test(req.params.id)) {
      return { blocked: false };
    }
    
    const key = `${req.ip}-${req.baseUrl}`;
    const id = parseInt(req.params.id);
    const now = Date.now();
    
    if (!this.sequentialScanDetection.has(key)) {
      this.sequentialScanDetection.set(key, {
        lastId: id,
        sequentialCount: 0,
        timestamp: now
      });
      return { blocked: false };
    }
    
    const tracking = this.sequentialScanDetection.get(key);
    
    // Reset if too much time has passed
    if (now - tracking.timestamp > 30000) {
      tracking.sequentialCount = 0;
      tracking.lastId = id;
      tracking.timestamp = now;
      return { blocked: false };
    }
    
    // Check if IDs are sequential
    if (id === tracking.lastId + 1 || id === tracking.lastId - 1) {
      tracking.sequentialCount++;
      
      if (tracking.sequentialCount > 10) {
        return {
          blocked: true,
          message: 'Sequential ID scanning detected',
          severity: 'high'
        };
      }
      
      if (tracking.sequentialCount > 5) {
        console.warn(`Sequential scanning detected from ${req.ip}`);
      }
    } else {
      // Reset count if not sequential
      tracking.sequentialCount = 0;
    }
    
    tracking.lastId = id;
    tracking.timestamp = now;
    
    return { blocked: false };
  }

  /**
   * Get violation count for an IP
   */
  getViolationCount(ip) {
    // In production, this would query a persistent store
    const key = `violations:${ip}`;
    if (!this.requestTracking.has(key)) {
      this.requestTracking.set(key, 0);
    }
    
    const count = this.requestTracking.get(key) + 1;
    this.requestTracking.set(key, count);
    return count;
  }

  /**
   * Clean up old tracking data
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    
    // Clean request tracking
    for (const [key, requests] of this.requestTracking.entries()) {
      if (Array.isArray(requests)) {
        const filtered = requests.filter(t => now - t < maxAge);
        if (filtered.length === 0) {
          this.requestTracking.delete(key);
        } else {
          this.requestTracking.set(key, filtered);
        }
      }
    }
    
    // Clean bulk extraction tracking
    for (const [key, tracking] of this.bulkExtractionProtection.entries()) {
      if (now - tracking.firstRequest > maxAge) {
        this.bulkExtractionProtection.delete(key);
      }
    }
    
    // Clean sequential scan detection
    for (const [key, tracking] of this.sequentialScanDetection.entries()) {
      if (now - tracking.timestamp > maxAge) {
        this.sequentialScanDetection.delete(key);
      }
    }
  }

  /**
   * Reset rate limits for an IP (admin only)
   */
  resetIP(ip, adminToken) {
    // Verify admin token
    if (!adminToken || !adminToken.startsWith('admin_')) {
      throw new Error('Unauthorized');
    }
    
    // Remove from blacklist
    this.ipBlacklist.delete(ip);
    
    // Clear tracking
    const keysToDelete = [];
    for (const key of this.requestTracking.keys()) {
      if (key.includes(ip)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.requestTracking.delete(key));
    
    console.log(`Rate limits reset for IP: ${ip}`);
    return true;
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      blacklistedIPs: Array.from(this.ipBlacklist),
      trackingSize: this.requestTracking.size,
      bulkProtectionSize: this.bulkExtractionProtection.size,
      sequentialScanSize: this.sequentialScanDetection.size
    };
  }
}

module.exports = new EnhancedRateLimiter();