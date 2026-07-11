// Content Security Policy (CSP) Management Service - Modular Version
// Handles CSP violation reporting, nonce generation, and policy management

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class CSPService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.violations = [];
    this.maxViolations = 1000; // Keep last 1000 violations in memory
    this.alertThreshold = 10; // Alert after 10 violations in 5 minutes
    this.alertWindow = 5 * 60 * 1000; // 5 minutes
    this.nonces = new Map(); // Store active nonces
    this.nonceLifetime = 60 * 60 * 1000; // 1 hour nonce lifetime
    
    // Base CSP policies for different environments
    this.policies = {
      production: {
        'default-src': ["'self'"],
        'script-src': ["'self'", (req) => `'nonce-${req.cspNonce}'`],
        'style-src': ["'self'", (req) => `'nonce-${req.cspNonce}'`, 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'connect-src': ["'self'", 'https://api.intellicare.com', 'wss://ws.intellicare.com'],
        'media-src': ["'self'", 'blob:'],
        'object-src': ["'none'"],
        'frame-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'base-uri': ["'self'"],
        'manifest-src': ["'self'"],
        'worker-src': ["'self'", 'blob:'],
        'report-uri': ['/api/security/csp-report'],
        'report-to': ['csp-endpoint']
      },
      development: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:', 'http://localhost:*'],
        'connect-src': ["'self'", 'http://localhost:*', 'ws://localhost:*', 'https:'],
        'media-src': ["'self'", 'blob:'],
        'object-src': ["'none'"],
        'frame-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'base-uri': ["'self'"],
        'report-uri': ['/api/security/csp-report']
      }
    };
  }

  async initialize() {
    if (this.initialized) return this;

    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('csp-service');
      
      // Initialize cleanup interval
      this.startCleanup();
      
      this.initialized = true;
      console.log('✅ CSP Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize CSP Service:', error);
      throw error;
    }

    return this;
  }

  /**
   * Generate a unique nonce for inline scripts
   */
  generateNonce(req) {
    if (req.cspNonce) return req.cspNonce;
    
    const nonce = crypto.randomBytes(16).toString('base64');
    req.cspNonce = nonce;
    
    // Store nonce with expiration
    this.nonces.set(nonce, {
      created: Date.now(),
      requestId: req.id || uuidv4(),
      ip: req.ip
    });
    
    return nonce;
  }

  /**
   * Build CSP header string from policy object
   */
  buildCSPHeader(req, environment = 'production') {
    // Ensure nonce is generated
    if (!req.cspNonce) {
      this.generateNonce(req);
    }
    
    const policy = this.policies[environment] || this.policies.production;
    const directives = [];
    
    for (const [directive, sources] of Object.entries(policy)) {
      const resolvedSources = sources.map(source => {
        // If source is a function, call it with the request
        return typeof source === 'function' ? source(req) : source;
      });
      directives.push(`${directive} ${resolvedSources.join(' ')}`);
    }
    
    return directives.join('; ');
  }

  /**
   * Process CSP violation report
   */
  async processViolation(report, req) {
    const violation = {
      id: uuidv4(),
      timestamp: new Date(),
      requestId: req.id || 'unknown',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      practiceId: req.practice?._id || req.session?.practiceId,
      userId: req.user?._id,
      
      // CSP violation details
      documentUri: report['document-uri'],
      referrer: report.referrer,
      blockedUri: report['blocked-uri'],
      violatedDirective: report['violated-directive'],
      effectiveDirective: report['effective-directive'],
      originalPolicy: report['original-policy'],
      disposition: report.disposition,
      statusCode: report['status-code'],
      
      // Additional context
      scriptSample: report['script-sample'],
      lineNumber: report['line-number'],
      columnNumber: report['column-number'],
      sourceFile: report['source-file']
    };
    
    // Store violation
    this.violations.push(violation);
    
    // Trim violations array if too large
    if (this.violations.length > this.maxViolations) {
      this.violations = this.violations.slice(-this.maxViolations);
    }
    
    // Check for alert threshold
    await this.checkAlertThreshold(violation);
    
    // Log to audit system
    if (req.auditLogger) {
      await req.auditLogger.log({
        event: 'CSP_VIOLATION',
        severity: this.getSeverity(violation),
        ...violation
      });
    }
    
    return violation;
  }

  /**
   * Check if we should alert on violations
   */
  async checkAlertThreshold(violation) {
    const recentViolations = this.getRecentViolations(this.alertWindow);
    
    if (recentViolations.length >= this.alertThreshold) {
      await this.sendAlert({
        type: 'CSP_VIOLATION_THRESHOLD',
        message: `CSP violations threshold exceeded: ${recentViolations.length} violations in ${this.alertWindow / 1000}s`,
        violations: recentViolations,
        timestamp: new Date()
      });
    }
    
    // Check for specific high-risk violations
    if (this.isHighRiskViolation(violation)) {
      await this.sendAlert({
        type: 'HIGH_RISK_CSP_VIOLATION',
        message: 'High-risk CSP violation detected',
        violation: violation,
        timestamp: new Date()
      });
    }
  }

  /**
   * Determine severity of CSP violation
   */
  getSeverity(violation) {
    // High severity for script-src violations
    if (violation.violatedDirective?.includes('script-src')) {
      return 'HIGH';
    }
    
    // Medium severity for connect-src violations
    if (violation.violatedDirective?.includes('connect-src')) {
      return 'MEDIUM';
    }
    
    // Check for known malicious patterns
    if (this.isMaliciousPattern(violation.blockedUri)) {
      return 'CRITICAL';
    }
    
    return 'LOW';
  }

  /**
   * Check if violation is high risk
   */
  isHighRiskViolation(violation) {
    // Script injections are high risk
    if (violation.violatedDirective?.includes('script-src')) {
      return true;
    }
    
    // External connections to unknown domains
    if (violation.blockedUri && !this.isTrustedDomain(violation.blockedUri)) {
      return true;
    }
    
    // Inline script attempts
    if (violation.blockedUri === 'inline') {
      return true;
    }
    
    return false;
  }

  /**
   * Check for malicious patterns in blocked URIs
   */
  isMaliciousPattern(uri) {
    if (!uri) return false;
    
    const maliciousPatterns = [
      /eval\(/i,
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /<script/i,
      /base64/i
    ];
    
    return maliciousPatterns.some(pattern => pattern.test(uri));
  }

  /**
   * Check if domain is trusted
   */
  isTrustedDomain(uri) {
    const trustedDomains = [
      'intellicare.com',
      'googleapis.com',
      'gstatic.com',
      'cloudflare.com',
      'jsdelivr.net',
      'unpkg.com'
    ];
    
    try {
      const url = new URL(uri);
      return trustedDomains.some(domain => url.hostname.includes(domain));
    } catch {
      return false;
    }
  }

  /**
   * Send security alert
   */
  async sendAlert(alert) {
    console.error('🚨 CSP SECURITY ALERT:', alert);
    
    // In production, this would send to:
    // - Security monitoring dashboard
    // - Email/SMS to security team
    // - SIEM system
    // - Slack/Discord webhook
    
    // Store alert for dashboard
    if (global.securityAlerts) {
      global.securityAlerts.push(alert);
    }
  }

  /**
   * Get recent violations
   */
  getRecentViolations(timeWindow = this.alertWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.violations.filter(v => 
      new Date(v.timestamp).getTime() > cutoff
    );
  }

  /**
   * Get violation statistics
   */
  getStatistics() {
    const stats = {
      total: this.violations.length,
      last24Hours: this.getRecentViolations(24 * 60 * 60 * 1000).length,
      lastHour: this.getRecentViolations(60 * 60 * 1000).length,
      last5Minutes: this.getRecentViolations(5 * 60 * 1000).length,
      byDirective: {},
      bySeverity: {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0
      },
      topViolators: []
    };
    
    // Analyze violations
    const ipCounts = {};
    
    for (const violation of this.violations) {
      // Count by directive
      const directive = violation.violatedDirective || 'unknown';
      stats.byDirective[directive] = (stats.byDirective[directive] || 0) + 1;
      
      // Count by severity
      const severity = this.getSeverity(violation);
      stats.bySeverity[severity]++;
      
      // Count by IP
      if (violation.ip) {
        ipCounts[violation.ip] = (ipCounts[violation.ip] || 0) + 1;
      }
    }
    
    // Get top violators
    stats.topViolators = Object.entries(ipCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));
    
    return stats;
  }

  /**
   * Update CSP policy dynamically
   */
  updatePolicy(environment, directive, sources) {
    if (!this.policies[environment]) {
      this.policies[environment] = {};
    }
    
    this.policies[environment][directive] = sources;
    
    console.log(`✅ CSP policy updated for ${environment}: ${directive}`);
  }

  /**
   * Add trusted source to policy
   */
  addTrustedSource(environment, directive, source) {
    if (!this.policies[environment]) {
      this.policies[environment] = {};
    }
    
    if (!this.policies[environment][directive]) {
      this.policies[environment][directive] = [];
    }
    
    if (!this.policies[environment][directive].includes(source)) {
      this.policies[environment][directive].push(source);
      console.log(`✅ Added trusted source to ${environment} ${directive}: ${source}`);
    }
  }

  /**
   * Clean up old nonces
   */
  cleanupNonces() {
    const now = Date.now();
    for (const [nonce, data] of this.nonces.entries()) {
      if (now - data.created > this.nonceLifetime) {
        this.nonces.delete(nonce);
      }
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanup() {
    // Clean up nonces every hour
    setInterval(() => {
      this.cleanupNonces();
    }, 60 * 60 * 1000);
  }

  /**
   * Get CSP report endpoint configuration
   */
  getReportToHeader() {
    return JSON.stringify({
      group: 'csp-endpoint',
      max_age: 86400,
      endpoints: [{
        url: '/api/security/csp-report'
      }]
    });
  }
}

// Create singleton instance
const cspService = new CSPService();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('cspService', () => cspService);
}

module.exports = cspService;