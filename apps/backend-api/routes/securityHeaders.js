// Security Headers Routes
// Provides endpoints for security header reporting and management

const express = require('express');
const router = express.Router();
const securityHeadersOptimizationService = require('../services/securityHeadersOptimizationService');

// Middleware to parse JSON reports
router.use(express.json({ type: ['application/json', 'application/csp-report', 'application/reports+json'] }));

/**
 * CSP Report endpoint
 * POST /api/security/csp-report
 */
router.post('/csp-report', (req, res) => {
  try {
    const report = req.body['csp-report'] || req.body;
    const result = securityHeadersOptimizationService.handleSecurityReport('csp', report);
    
    console.log('CSP Violation reported:', {
      'blocked-uri': report['blocked-uri'],
      'violated-directive': report['violated-directive'],
      'document-uri': report['document-uri']
    });
    
    res.status(204).send(); // No content response expected for CSP reports
  } catch (error) {
    console.error('CSP report error:', error);
    res.status(204).send(); // Still send 204 to prevent retries
  }
});

/**
 * Expect-CT Report endpoint
 * POST /api/security/ct-report
 */
router.post('/ct-report', (req, res) => {
  try {
    const report = req.body;
    const result = securityHeadersOptimizationService.handleSecurityReport('expect-ct', report);
    
    console.log('Certificate Transparency violation reported:', {
      hostname: report.hostname,
      port: report.port,
      failure: report.failure
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Expect-CT report error:', error);
    res.status(204).send();
  }
});

/**
 * Network Error Logging (NEL) Report endpoint
 * POST /api/security/nel-report
 */
router.post('/nel-report', (req, res) => {
  try {
    const reports = req.body;
    
    // NEL sends an array of reports
    if (Array.isArray(reports)) {
      reports.forEach(report => {
        securityHeadersOptimizationService.handleSecurityReport('nel', report);
      });
    } else {
      securityHeadersOptimizationService.handleSecurityReport('nel', reports);
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('NEL report error:', error);
    res.status(204).send();
  }
});

/**
 * Generic Report-To endpoint
 * POST /api/security/report-to
 */
router.post('/report-to', (req, res) => {
  try {
    const reports = req.body;
    
    if (Array.isArray(reports)) {
      reports.forEach(report => {
        const type = report.type || 'general';
        securityHeadersOptimizationService.handleSecurityReport(type, report);
      });
    } else {
      const type = reports.type || 'general';
      securityHeadersOptimizationService.handleSecurityReport(type, reports);
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Report-To error:', error);
    res.status(204).send();
  }
});

/**
 * Default reporting endpoint
 * POST /api/security/report
 */
router.post('/report', (req, res) => {
  try {
    const report = req.body;
    const type = report.type || 'general';
    
    const result = securityHeadersOptimizationService.handleSecurityReport(type, report);
    
    res.status(204).send();
  } catch (error) {
    console.error('Security report error:', error);
    res.status(204).send();
  }
});

/**
 * Get security header statistics
 * GET /api/security/headers/stats
 */
router.get('/headers/stats', (req, res) => {
  try {
    const stats = securityHeadersOptimizationService.getStats();
    
    res.json({
      success: true,
      statistics: stats,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: error.message,
      code: 'GET_STATS_FAILED'
    });
  }
});

/**
 * Get security reports
 * GET /api/security/headers/reports
 */
router.get('/headers/reports', (req, res) => {
  try {
    const { type, limit = 100 } = req.query;
    const reportStats = securityHeadersOptimizationService.getReportStats();
    
    let reports = [];
    
    if (type) {
      reports = securityHeadersOptimizationService.reports[type] || [];
    } else {
      reports = reportStats.recentReports;
    }
    
    res.json({
      success: true,
      reports: reports.slice(0, parseInt(limit)),
      statistics: reportStats,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      error: error.message,
      code: 'GET_REPORTS_FAILED'
    });
  }
});

/**
 * Get security header configuration
 * GET /api/security/headers/config
 */
router.get('/headers/config', (req, res) => {
  try {
    const config = securityHeadersOptimizationService.getConfig();
    
    res.json({
      success: true,
      configuration: config,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({
      error: error.message,
      code: 'GET_CONFIG_FAILED'
    });
  }
});

/**
 * Update security header configuration
 * PUT /api/security/headers/config
 */
router.put('/headers/config', (req, res) => {
  try {
    const updates = req.body;
    
    // Validate updates
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        error: 'Invalid configuration updates',
        code: 'INVALID_CONFIG'
      });
    }
    
    securityHeadersOptimizationService.updateConfig(updates);
    
    res.json({
      success: true,
      message: 'Security header configuration updated',
      configuration: securityHeadersOptimizationService.getConfig()
    });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({
      error: error.message,
      code: 'UPDATE_CONFIG_FAILED'
    });
  }
});

/**
 * Trigger Clear-Site-Data
 * POST /api/security/headers/clear-site-data
 */
router.post('/headers/clear-site-data', (req, res) => {
  try {
    const { reason, types } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        error: 'Reason is required for Clear-Site-Data',
        code: 'MISSING_REASON'
      });
    }
    
    const header = securityHeadersOptimizationService.triggerClearSiteData(reason, types);
    
    // Set the header on the response
    res.setHeader('Clear-Site-Data', header);
    
    res.json({
      success: true,
      message: 'Clear-Site-Data triggered',
      header,
      reason,
      types: types || securityHeadersOptimizationService.config.clearSiteData.types
    });
  } catch (error) {
    console.error('Clear-Site-Data error:', error);
    res.status(500).json({
      error: error.message,
      code: 'CLEAR_SITE_DATA_FAILED'
    });
  }
});

/**
 * Test security headers
 * GET /api/security/headers/test
 */
router.get('/headers/test', (req, res) => {
  try {
    // Generate test headers
    const { headers, nonce } = securityHeadersOptimizationService.generateSecurityHeaders(req, res);
    
    // Apply all headers to this response
    for (const [header, value] of Object.entries(headers)) {
      res.setHeader(header, value);
    }
    
    res.json({
      success: true,
      message: 'Security headers applied to this response',
      headers: Object.keys(headers),
      nonce,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Test headers error:', error);
    res.status(500).json({
      error: error.message,
      code: 'TEST_HEADERS_FAILED'
    });
  }
});

/**
 * Health check endpoint
 * GET /api/security/headers/health
 */
router.get('/headers/health', (req, res) => {
  try {
    const health = securityHeadersOptimizationService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date()
    });
  }
});

module.exports = router;