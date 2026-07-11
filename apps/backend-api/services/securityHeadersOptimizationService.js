// Security Headers Optimization Service
// Provides enhanced security headers for maximum protection

const crypto = require('crypto');
const serviceAccountManager = require('./serviceAccountManager');

class SecurityHeadersOptimizationService {
  constructor() {
    // Configuration for security headers
    this.config = {
      // Expect-CT configuration
      expectCT: {
        enabled: true,
        maxAge: 86400, // 24 hours
        enforce: true,
        reportUri: '/api/security/ct-report'
      },
      
      // Feature-Policy / Permissions-Policy configuration
      permissionsPolicy: {
        camera: ['none'],
        microphone: ['self'],
        geolocation: ['self'],
        payment: ['none'],
        usb: ['none'],
        magnetometer: ['none'],
        gyroscope: ['none'],
        accelerometer: ['none'],
        ambientLightSensor: ['none'],
        autoplay: ['self'],
        encryptedMedia: ['self'],
        fullscreen: ['self'],
        pictureInPicture: ['self'],
        syncXhr: ['none'],
        documentDomain: ['none'],
        interestCohort: ['none'] // FLoC opt-out
      },
      
      // Clear-Site-Data configuration
      clearSiteData: {
        enabled: true,
        triggers: ['logout', 'account-deletion', 'security-breach'],
        types: ['cache', 'cookies', 'storage', 'executionContexts']
      },
      
      // Cross-Origin policies
      crossOrigin: {
        embedderPolicy: 'require-corp',
        openerPolicy: 'same-origin-allow-popups',
        resourcePolicy: 'same-origin'
      },
      
      // Reporting-Endpoints configuration
      reportingEndpoints: {
        default: '/api/security/report',
        csp: '/api/security/csp-report',
        expectCT: '/api/security/ct-report',
        nel: '/api/security/nel-report',
        reportTo: '/api/security/report-to'
      },
      
      // Network Error Logging (NEL)
      nel: {
        enabled: true,
        maxAge: 86400,
        includeSubdomains: true,
        failureFraction: 0.1,
        successFraction: 0.01
      },
      
      // Additional security headers
      additionalHeaders: {
        'X-Permitted-Cross-Domain-Policies': 'none',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'X-DNS-Prefetch-Control': 'off',
        'X-Download-Options': 'noopen',
        'Origin-Agent-Cluster': '?1',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex'
      },
      
      // Strict-Transport-Security enhancement
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      
      // Content-Security-Policy enhancement
      cspEnhancements: {
        upgradeInsecureRequests: true,
        blockAllMixedContent: true,
        requireTrustedTypesFor: ['script'],
        trustedTypes: 'default',
        reportSample: true
      }
    };
    
    // Statistics
    this.stats = {
      headersApplied: 0,
      reportsReceived: 0,
      clearSiteDataTriggered: 0,
      policyViolations: 0,
      securityEvents: []
    };
    
    // Report storage
    this.reports = {
      csp: [],
      expectCT: [],
      nel: [],
      general: []
    };
  }

  async initialize() {
    if (!this.serviceToken) {
      this.serviceToken = await serviceAccountManager.authenticate('security-headers-optimization-service');
    }
    return this;
  }

  /**
   * Generate comprehensive security headers
   */
  generateSecurityHeaders(req, res, options = {}) {
    const headers = {};
    
    // Generate nonce for CSP
    const nonce = this.generateNonce();
    
    // Expect-CT header
    if (this.config.expectCT.enabled) {
      headers['Expect-CT'] = this.buildExpectCTHeader();
    }
    
    // Permissions-Policy (formerly Feature-Policy)
    headers['Permissions-Policy'] = this.buildPermissionsPolicyHeader();
    
    // Cross-Origin headers
    headers['Cross-Origin-Embedder-Policy'] = this.config.crossOrigin.embedderPolicy;
    headers['Cross-Origin-Opener-Policy'] = this.config.crossOrigin.openerPolicy;
    headers['Cross-Origin-Resource-Policy'] = this.config.crossOrigin.resourcePolicy;
    
    // Reporting-Endpoints
    headers['Reporting-Endpoints'] = this.buildReportingEndpointsHeader();
    
    // Report-To header for reporting API v1
    headers['Report-To'] = this.buildReportToHeader();
    
    // Network Error Logging
    if (this.config.nel.enabled) {
      headers['NEL'] = this.buildNELHeader();
    }
    
    // Enhanced HSTS
    headers['Strict-Transport-Security'] = this.buildHSTSHeader();
    
    // Enhanced CSP with nonce
    headers['Content-Security-Policy'] = this.buildEnhancedCSP(nonce);
    
    // Additional security headers
    Object.assign(headers, this.config.additionalHeaders);
    
    // Context-specific headers
    if (options.clearSiteData) {
      headers['Clear-Site-Data'] = this.buildClearSiteDataHeader(options.clearTypes);
    }
    
    // Add security event timing
    headers['Server-Timing'] = this.buildServerTimingHeader();
    
    // Critical-CH for client hints
    headers['Critical-CH'] = 'Sec-CH-UA-Platform-Version, Sec-CH-UA-Mobile';
    headers['Accept-CH'] = 'Sec-CH-UA-Platform-Version, Sec-CH-UA-Mobile, Sec-CH-UA-Model';
    
    this.stats.headersApplied++;
    
    return { headers, nonce };
  }

  /**
   * Build Expect-CT header
   */
  buildExpectCTHeader() {
    const parts = [`max-age=${this.config.expectCT.maxAge}`];
    
    if (this.config.expectCT.enforce) {
      parts.push('enforce');
    }
    
    if (this.config.expectCT.reportUri) {
      parts.push(`report-uri="${this.config.expectCT.reportUri}"`);
    }
    
    return parts.join(', ');
  }

  /**
   * Build Permissions-Policy header
   */
  buildPermissionsPolicyHeader() {
    const policies = [];
    
    for (const [feature, allowList] of Object.entries(this.config.permissionsPolicy)) {
      const kebabFeature = feature.replace(/([A-Z])/g, '-$1').toLowerCase();
      const value = allowList.map(v => v === 'none' ? '' : v).join(' ');
      
      if (allowList.includes('none')) {
        policies.push(`${kebabFeature}=()`);
      } else {
        policies.push(`${kebabFeature}=(${value})`);
      }
    }
    
    return policies.join(', ');
  }

  /**
   * Build Reporting-Endpoints header
   */
  buildReportingEndpointsHeader() {
    const endpoints = [];
    
    for (const [name, url] of Object.entries(this.config.reportingEndpoints)) {
      endpoints.push(`${name}="${url}"`);
    }
    
    return endpoints.join(', ');
  }

  /**
   * Build Report-To header
   */
  buildReportToHeader() {
    const groups = [
      {
        group: 'default',
        max_age: 86400,
        endpoints: [
          { url: this.config.reportingEndpoints.default }
        ],
        include_subdomains: true
      },
      {
        group: 'csp-endpoint',
        max_age: 86400,
        endpoints: [
          { url: this.config.reportingEndpoints.csp }
        ]
      },
      {
        group: 'expect-ct',
        max_age: 86400,
        endpoints: [
          { url: this.config.reportingEndpoints.expectCT }
        ]
      },
      {
        group: 'network-errors',
        max_age: 86400,
        endpoints: [
          { url: this.config.reportingEndpoints.nel }
        ]
      }
    ];
    
    return JSON.stringify(groups);
  }

  /**
   * Build NEL (Network Error Logging) header
   */
  buildNELHeader() {
    return JSON.stringify({
      report_to: 'network-errors',
      max_age: this.config.nel.maxAge,
      include_subdomains: this.config.nel.includeSubdomains,
      failure_fraction: this.config.nel.failureFraction,
      success_fraction: this.config.nel.successFraction
    });
  }

  /**
   * Build enhanced HSTS header
   */
  buildHSTSHeader() {
    const parts = [`max-age=${this.config.hsts.maxAge}`];
    
    if (this.config.hsts.includeSubDomains) {
      parts.push('includeSubDomains');
    }
    
    if (this.config.hsts.preload) {
      parts.push('preload');
    }
    
    return parts.join('; ');
  }

  /**
   * Build enhanced CSP with additional directives
   */
  buildEnhancedCSP(nonce) {
    const directives = [
      `default-src 'self'`,
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      `style-src 'self' 'nonce-${nonce}'`,
      `img-src 'self' data: https:`,
      `font-src 'self' data:`,
      `connect-src 'self' https://api.intellicare.com`,
      `media-src 'self'`,
      `object-src 'none'`,
      `frame-src 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `frame-ancestors 'none'`,
      `manifest-src 'self'`,
      `worker-src 'self'`,
      `navigate-to 'self'`
    ];
    
    // Add CSP enhancements
    if (this.config.cspEnhancements.upgradeInsecureRequests) {
      directives.push('upgrade-insecure-requests');
    }
    
    if (this.config.cspEnhancements.blockAllMixedContent) {
      directives.push('block-all-mixed-content');
    }
    
    if (this.config.cspEnhancements.requireTrustedTypesFor) {
      directives.push(`require-trusted-types-for '${this.config.cspEnhancements.requireTrustedTypesFor.join(" ")}'`);
    }
    
    if (this.config.cspEnhancements.trustedTypes) {
      directives.push(`trusted-types ${this.config.cspEnhancements.trustedTypes}`);
    }
    
    // Add reporting
    directives.push(`report-uri ${this.config.reportingEndpoints.csp}`);
    directives.push(`report-to csp-endpoint`);
    
    return directives.join('; ');
  }

  /**
   * Build Clear-Site-Data header
   */
  buildClearSiteDataHeader(types = null) {
    const clearTypes = types || this.config.clearSiteData.types;
    return clearTypes.map(type => `"${type}"`).join(', ');
  }

  /**
   * Build Server-Timing header
   */
  buildServerTimingHeader() {
    const timings = [
      `sec;desc="Security Headers";dur=${Math.random() * 5}`,
      `cache;desc="Cache Check";dur=${Math.random() * 2}`,
      `db;desc="Database";dur=${Math.random() * 10}`
    ];
    
    return timings.join(', ');
  }

  /**
   * Generate CSP nonce
   */
  generateNonce() {
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * Handle security report
   */
  handleSecurityReport(type, report) {
    this.stats.reportsReceived++;
    
    const reportEntry = {
      type,
      timestamp: new Date(),
      report,
      processed: false
    };
    
    // Store report by type
    switch (type) {
      case 'csp':
        this.reports.csp.push(reportEntry);
        this.stats.policyViolations++;
        break;
      case 'expect-ct':
        this.reports.expectCT.push(reportEntry);
        break;
      case 'nel':
        this.reports.nel.push(reportEntry);
        break;
      default:
        this.reports.general.push(reportEntry);
    }
    
    // Limit report storage
    for (const reportType of Object.values(this.reports)) {
      if (reportType.length > 1000) {
        reportType.splice(0, reportType.length - 1000);
      }
    }
    
    // Log security event
    this.logSecurityEvent(type, report);
    
    // Process report for immediate action if needed
    this.processSecurityReport(type, report);
    
    return { received: true, type, timestamp: new Date() };
  }

  /**
   * Process security report for immediate action
   */
  processSecurityReport(type, report) {
    // Check for critical violations
    if (type === 'csp' && report['violated-directive']) {
      if (report['violated-directive'].startsWith('script-src')) {
        console.warn('⚠️ CSP Script violation detected:', report['blocked-uri']);
      }
    }
    
    if (type === 'expect-ct' && report.failure) {
      console.error('🔴 Certificate Transparency failure detected');
    }
    
    if (type === 'nel' && report.type === 'network-error') {
      console.error('🔴 Network error reported:', report.url);
    }
  }

  /**
   * Trigger Clear-Site-Data
   */
  triggerClearSiteData(reason, types = null) {
    this.stats.clearSiteDataTriggered++;
    
    const event = {
      reason,
      types: types || this.config.clearSiteData.types,
      timestamp: new Date()
    };
    
    this.logSecurityEvent('clear-site-data', event);
    
    return this.buildClearSiteDataHeader(types);
  }

  /**
   * Log security event
   */
  logSecurityEvent(type, details) {
    const event = {
      type,
      details,
      timestamp: new Date()
    };
    
    this.stats.securityEvents.push(event);
    
    // Limit event storage
    if (this.stats.securityEvents.length > 1000) {
      this.stats.securityEvents = this.stats.securityEvents.slice(-500);
    }
    
    console.log(`[Security Event] ${type}:`, details);
  }

  /**
   * Get security headers middleware
   */
  middleware() {
    return (req, res, next) => {
      // Check if headers should be applied
      if (this.shouldApplyHeaders(req)) {
        const options = this.getHeaderOptions(req);
        const { headers, nonce } = this.generateSecurityHeaders(req, res, options);
        
        // Apply headers
        for (const [header, value] of Object.entries(headers)) {
          res.setHeader(header, value);
        }
        
        // Store nonce for use in templates
        res.locals.nonce = nonce;
      }
      
      next();
    };
  }

  /**
   * Check if security headers should be applied
   */
  shouldApplyHeaders(req) {
    // Skip for static assets
    const staticExtensions = ['.css', '.js', '.jpg', '.png', '.gif', '.svg', '.ico'];
    if (staticExtensions.some(ext => req.path.endsWith(ext))) {
      return false;
    }
    
    // Skip for health checks
    if (req.path.includes('/health') || req.path.includes('/ready') || req.path.includes('/live')) {
      return false;
    }
    
    return true;
  }

  /**
   * Get header options based on request context
   */
  getHeaderOptions(req) {
    const options = {};
    
    // Check for logout
    if (req.path.includes('/logout') || req.path.includes('/signout')) {
      options.clearSiteData = true;
      options.clearTypes = ['cookies', 'storage'];
    }
    
    // Check for account deletion
    if (req.path.includes('/delete-account')) {
      options.clearSiteData = true;
      options.clearTypes = this.config.clearSiteData.types;
    }
    
    return options;
  }

  /**
   * Get security report statistics
   */
  getReportStats() {
    return {
      total: this.stats.reportsReceived,
      byType: {
        csp: this.reports.csp.length,
        expectCT: this.reports.expectCT.length,
        nel: this.reports.nel.length,
        general: this.reports.general.length
      },
      policyViolations: this.stats.policyViolations,
      clearSiteDataTriggered: this.stats.clearSiteDataTriggered,
      recentReports: [
        ...this.reports.csp.slice(-5),
        ...this.reports.expectCT.slice(-5),
        ...this.reports.nel.slice(-5)
      ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
    };
  }

  /**
   * Get configuration
   */
  getConfig() {
    return {
      expectCT: this.config.expectCT,
      permissionsPolicy: this.config.permissionsPolicy,
      clearSiteData: this.config.clearSiteData,
      crossOrigin: this.config.crossOrigin,
      reportingEndpoints: this.config.reportingEndpoints,
      nel: this.config.nel,
      hsts: this.config.hsts,
      cspEnhancements: this.config.cspEnhancements
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates) {
    Object.assign(this.config, updates);
    console.log('Security headers configuration updated');
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      reportStats: this.getReportStats(),
      configuration: {
        expectCTEnabled: this.config.expectCT.enabled,
        nelEnabled: this.config.nel.enabled,
        clearSiteDataEnabled: this.config.clearSiteData.enabled,
        totalPolicies: Object.keys(this.config.permissionsPolicy).length
      }
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      features: {
        expectCT: this.config.expectCT.enabled,
        permissionsPolicy: true,
        clearSiteData: this.config.clearSiteData.enabled,
        crossOriginPolicies: true,
        reportingEndpoints: true,
        nel: this.config.nel.enabled
      },
      statistics: {
        headersApplied: this.stats.headersApplied,
        reportsReceived: this.stats.reportsReceived,
        policyViolations: this.stats.policyViolations
      },
      timestamp: new Date()
    };
  }
}

// Export singleton instance
module.exports = new SecurityHeadersOptimizationService();