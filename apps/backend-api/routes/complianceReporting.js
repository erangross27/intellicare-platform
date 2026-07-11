// Compliance Reporting Routes
// Provides API endpoints for HIPAA/GDPR compliance operations

const express = require('express');
const router = express.Router();
const complianceReportingService = require('../services/complianceReportingService');
const roleModel = require('../config/roles');

// Middleware to require authentication
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required for compliance operations',
      code: 'AUTH_REQUIRED' 
    });
  }
  
  // In production, verify JWT token properly
  req.user = {
    id: 'demo-user',
    role: 'admin',
    email: 'compliance@developer.com'
  };
  
  next();
};

// Middleware to require compliance officer role
const requireComplianceOfficer = (req, res, next) => {
  if (!req.user || !roleModel.rolesAreAdmin(req.user.role)) {
    return res.status(403).json({ 
      error: 'Compliance officer access required',
      code: 'INSUFFICIENT_PRIVILEGES' 
    });
  }
  next();
};

// Rate limiting for compliance operations
const rateLimit = require('express-rate-limit');
const complianceRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    error: 'Too many compliance requests',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

router.use(complianceRateLimit);

/**
 * Generate HIPAA compliance report
 * POST /api/compliance/reports/hipaa
 */
router.post('/reports/hipaa', requireAuth, requireComplianceOfficer, async (req, res) => {
  try {
    const { startDate, endDate, includeRecommendations = true } = req.body;
    
    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeRecommendations,
      requestedBy: req.user.id
    };
    
    const result = await complianceReportingService.generateHIPAAReport(options);
    
    res.status(201).json({
      success: true,
      message: 'HIPAA compliance report generated successfully',
      reportId: result.reportId,
      report: result.report,
      downloadUrl: `/api/compliance/reports/download/${result.reportId}`
    });
    
  } catch (error) {
    console.error('HIPAA report generation error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'HIPAA_REPORT_FAILED' 
    });
  }
});

/**
 * Generate GDPR compliance report
 * POST /api/compliance/reports/gdpr
 */
router.post('/reports/gdpr', requireAuth, requireComplianceOfficer, async (req, res) => {
  try {
    const { startDate, endDate, includeRecommendations = true } = req.body;
    
    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeRecommendations,
      requestedBy: req.user.id
    };
    
    const result = await complianceReportingService.generateGDPRReport(options);
    
    res.status(201).json({
      success: true,
      message: 'GDPR compliance report generated successfully',
      reportId: result.reportId,
      report: result.report,
      downloadUrl: `/api/compliance/reports/download/${result.reportId}`
    });
    
  } catch (error) {
    console.error('GDPR report generation error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GDPR_REPORT_FAILED' 
    });
  }
});

/**
 * Set data retention policy
 * POST /api/compliance/retention
 */
router.post('/retention', requireAuth, requireComplianceOfficer, async (req, res) => {
  try {
    const { dataType, recordId, retentionDays, legalBasis, autoDelete = true } = req.body;
    
    if (!dataType || !recordId) {
      return res.status(400).json({
        error: 'Data type and record ID are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    const policy = await complianceReportingService.enforceDataRetention(
      dataType,
      recordId,
      {
        retentionDays,
        legalBasis,
        autoDelete,
        enforcedBy: req.user.id
      }
    );
    
    res.status(201).json({
      success: true,
      message: 'Data retention policy enforced',
      policy
    });
    
  } catch (error) {
    console.error('Retention policy error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'RETENTION_POLICY_FAILED' 
    });
  }
});

/**
 * Process erasure request (Right to be forgotten)
 * POST /api/compliance/erasure
 */
router.post('/erasure', requireAuth, async (req, res) => {
  try {
    const { userId, verificationMethod = 'email', scope = 'all_personal_data', exceptions = [] } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        error: 'User ID is required for erasure request',
        code: 'MISSING_USER_ID'
      });
    }
    
    // Check if requester is the user or has permission
    if (req.user.id !== userId && !roleModel.rolesAreAdmin(req.user.role)) {
      return res.status(403).json({
        error: 'You can only request erasure of your own data',
        code: 'UNAUTHORIZED_ERASURE'
      });
    }
    
    const result = await complianceReportingService.processErasureRequest(
      userId,
      {
        verificationMethod,
        scope,
        exceptions,
        processor: req.user.id,
        requestIp: req.ip
      }
    );
    
    res.json({
      success: true,
      message: 'Erasure request processed successfully',
      requestId: result.request.id,
      status: result.request.status,
      confirmation: result.confirmation
    });
    
  } catch (error) {
    console.error('Erasure request error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'ERASURE_REQUEST_FAILED' 
    });
  }
});

/**
 * Generate data export (Data portability)
 * POST /api/compliance/export
 */
router.post('/export', requireAuth, async (req, res) => {
  try {
    const { userId, format = 'json', anonymize = false, categories } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        error: 'User ID is required for data export',
        code: 'MISSING_USER_ID'
      });
    }
    
    // Check if requester is the user or has permission
    if (req.user.id !== userId && !roleModel.rolesAreAdmin(req.user.role)) {
      return res.status(403).json({
        error: 'You can only export your own data',
        code: 'UNAUTHORIZED_EXPORT'
      });
    }
    
    // Validate format
    const allowedFormats = ['json', 'csv', 'xml', 'pdf'];
    if (!allowedFormats.includes(format)) {
      return res.status(400).json({
        error: `Invalid format. Allowed: ${allowedFormats.join(', ')}`,
        code: 'INVALID_FORMAT'
      });
    }
    
    const exportPackage = await complianceReportingService.generateDataExport(
      userId,
      format,
      {
        anonymize,
        categories,
        requestedBy: req.user.id
      }
    );
    
    res.json({
      success: true,
      message: 'Data export generated successfully',
      exportId: exportPackage.id,
      format: exportPackage.format,
      size: exportPackage.size,
      checksum: exportPackage.checksum,
      expiresAt: exportPackage.expiresAt,
      downloadUrl: `/api/compliance/export/download/${exportPackage.id}`
    });
    
  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'DATA_EXPORT_FAILED' 
    });
  }
});

/**
 * Record consent
 * POST /api/compliance/consent
 */
router.post('/consent', requireAuth, async (req, res) => {
  try {
    const { 
      userId, 
      purpose, 
      method = 'explicit',
      scope = 'standard',
      duration = 365,
      specialCategories = [],
      thirdParties = []
    } = req.body;
    
    if (!userId || !purpose) {
      return res.status(400).json({
        error: 'User ID and purpose are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    const consent = await complianceReportingService.recordConsent(
      userId,
      purpose,
      {
        method,
        scope,
        duration,
        specialCategories,
        thirdParties,
        recordedBy: req.user.id,
        recordedAt: new Date()
      }
    );
    
    res.status(201).json({
      success: true,
      message: 'Consent recorded successfully',
      consentId: consent.id,
      consent
    });
    
  } catch (error) {
    console.error('Consent recording error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'CONSENT_RECORD_FAILED' 
    });
  }
});

/**
 * Withdraw consent
 * DELETE /api/compliance/consent/:userId/:purpose
 */
router.delete('/consent/:userId/:purpose', requireAuth, async (req, res) => {
  try {
    const { userId, purpose } = req.params;
    const { reason, method = 'explicit' } = req.body;
    
    // Check if requester is the user or has permission
    if (req.user.id !== userId && !roleModel.rolesAreAdmin(req.user.role)) {
      return res.status(403).json({
        error: 'You can only withdraw your own consent',
        code: 'UNAUTHORIZED_WITHDRAWAL'
      });
    }
    
    const result = await complianceReportingService.withdrawConsent(
      userId,
      purpose,
      {
        reason,
        method,
        withdrawnBy: req.user.id
      }
    );
    
    res.json({
      success: true,
      message: 'Consent withdrawn successfully',
      consentId: result.id,
      withdrawnAt: result.withdrawnAt
    });
    
  } catch (error) {
    console.error('Consent withdrawal error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'CONSENT_WITHDRAWAL_FAILED' 
    });
  }
});

/**
 * Register data processing activity
 * POST /api/compliance/processing-activity
 */
router.post('/processing-activity', requireAuth, requireComplianceOfficer, async (req, res) => {
  try {
    const activity = req.body;
    
    if (!activity.name || !activity.purpose || !activity.lawfulBasis) {
      return res.status(400).json({
        error: 'Name, purpose, and lawful basis are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    const record = await complianceReportingService.registerProcessingActivity(activity);
    
    res.status(201).json({
      success: true,
      message: 'Processing activity registered successfully',
      activityId: record.id,
      record
    });
    
  } catch (error) {
    console.error('Processing activity registration error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'PROCESSING_ACTIVITY_FAILED' 
    });
  }
});

/**
 * Report data breach
 * POST /api/compliance/breach
 */
router.post('/breach', requireAuth, requireComplianceOfficer, async (req, res) => {
  try {
    const breach = req.body;
    
    if (!breach.description) {
      return res.status(400).json({
        error: 'Breach description is required',
        code: 'MISSING_DESCRIPTION'
      });
    }
    
    const notification = await complianceReportingService.reportDataBreach({
      ...breach,
      reportedBy: req.user.id,
      reportedFrom: req.ip
    });
    
    res.status(201).json({
      success: true,
      message: 'Data breach reported successfully',
      breachId: notification.id,
      notification,
      urgent: notification.notificationRequired,
      deadline: notification.notificationDeadline
    });
    
  } catch (error) {
    console.error('Data breach report error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'BREACH_REPORT_FAILED' 
    });
  }
});

/**
 * Get compliance statistics
 * GET /api/compliance/stats
 */
router.get('/stats', requireAuth, requireComplianceOfficer, (req, res) => {
  try {
    const stats = complianceReportingService.getStats();
    
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
 * Get compliance audit log
 * GET /api/compliance/audit
 */
router.get('/audit', requireAuth, requireComplianceOfficer, (req, res) => {
  try {
    const { 
      limit = 100, 
      offset = 0, 
      action, 
      userId,
      startDate,
      endDate 
    } = req.query;
    
    let auditLog = [...complianceReportingService.complianceAudit];
    
    // Apply filters
    if (action) {
      auditLog = auditLog.filter(entry => entry.action === action);
    }
    
    if (userId) {
      auditLog = auditLog.filter(entry => entry.userId === userId);
    }
    
    if (startDate) {
      const start = new Date(startDate);
      auditLog = auditLog.filter(entry => entry.timestamp >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      auditLog = auditLog.filter(entry => entry.timestamp <= end);
    }
    
    // Sort by timestamp (newest first)
    auditLog.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply pagination
    const startIndex = parseInt(offset);
    const limitNum = Math.min(parseInt(limit), 1000);
    const paginatedLog = auditLog.slice(startIndex, startIndex + limitNum);
    
    res.json({
      success: true,
      auditLog: paginatedLog,
      pagination: {
        total: auditLog.length,
        limit: limitNum,
        offset: startIndex,
        hasMore: startIndex + limitNum < auditLog.length
      }
    });
    
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GET_AUDIT_LOG_FAILED' 
    });
  }
});

/**
 * Get consent records
 * GET /api/compliance/consent/:userId
 */
router.get('/consent/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if requester is the user or has permission
    if (req.user.id !== userId && !roleModel.rolesAreAdmin(req.user.role)) {
      return res.status(403).json({
        error: 'You can only view your own consent records',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }
    
    const consents = [];
    for (const [key, consent] of complianceReportingService.consentRecords) {
      if (consent.userId === userId) {
        consents.push(consent);
      }
    }
    
    res.json({
      success: true,
      userId,
      consents,
      totalConsents: consents.length,
      activeConsents: consents.filter(c => c.granted && !c.withdrawnAt).length
    });
    
  } catch (error) {
    console.error('Get consent records error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GET_CONSENTS_FAILED' 
    });
  }
});

/**
 * Get deletion requests
 * GET /api/compliance/erasure/requests
 */
router.get('/erasure/requests', requireAuth, requireComplianceOfficer, (req, res) => {
  try {
    const { status } = req.query;
    
    let requests = Array.from(complianceReportingService.deletionRequests.values());
    
    if (status) {
      requests = requests.filter(r => r.status === status);
    }
    
    requests.sort((a, b) => b.requestedAt - a.requestedAt);
    
    res.json({
      success: true,
      requests,
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      completed: requests.filter(r => r.status === 'completed').length
    });
    
  } catch (error) {
    console.error('Get deletion requests error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GET_DELETION_REQUESTS_FAILED' 
    });
  }
});

/**
 * Get processing activities
 * GET /api/compliance/processing-activities
 */
router.get('/processing-activities', requireAuth, requireComplianceOfficer, (req, res) => {
  try {
    const activities = Array.from(complianceReportingService.dataProcessingActivities.values());
    
    res.json({
      success: true,
      activities,
      total: activities.length,
      active: activities.filter(a => a.active).length
    });
    
  } catch (error) {
    console.error('Get processing activities error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GET_PROCESSING_ACTIVITIES_FAILED' 
    });
  }
});

/**
 * Get breach notifications
 * GET /api/compliance/breaches
 */
router.get('/breaches', requireAuth, requireComplianceOfficer, (req, res) => {
  try {
    const { severity, notified } = req.query;
    
    let breaches = [...complianceReportingService.breachNotifications];
    
    if (severity) {
      breaches = breaches.filter(b => b.severity === severity);
    }
    
    if (notified !== undefined) {
      const isNotified = notified === 'true';
      breaches = breaches.filter(b => b.supervisoryAuthorityNotified === isNotified);
    }
    
    breaches.sort((a, b) => b.reportedAt - a.reportedAt);
    
    res.json({
      success: true,
      breaches,
      total: breaches.length,
      highSeverity: breaches.filter(b => b.severity === 'high').length,
      pendingNotification: breaches.filter(b => 
        b.notificationRequired && !b.supervisoryAuthorityNotified
      ).length
    });
    
  } catch (error) {
    console.error('Get breaches error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GET_BREACHES_FAILED' 
    });
  }
});

/**
 * Health check endpoint
 * GET /api/compliance/health
 */
router.get('/health', (req, res) => {
  try {
    const health = complianceReportingService.healthCheck();
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