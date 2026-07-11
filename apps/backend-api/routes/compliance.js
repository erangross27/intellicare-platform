/**
 * 🏥 COMPLIANCE ANALYTICS API ROUTES
 * HIPAA compliance monitoring, violation detection, and dashboard endpoints
 */

const express = require('express');
const router = express.Router();
const complianceAnalyticsService = require('../services/complianceAnalyticsService');
const { auth, checkRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateRequest } = require('../middleware/validation');
const { body, query } = require('express-validator');

/**
 * @route   GET /api/compliance/dashboard
 * @desc    Generate HIPAA compliance dashboard
 * @access  Private (Admin, Compliance Officer)
 */
router.get('/dashboard', 
  auth,
  checkRole(['admin']),
  query('period').optional().isIn(['24h', '7d', '30d', '90d', '1y']),
  query('includeDetails').optional().isBoolean(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const { period = '30d', includeDetails = 'true' } = req.query;

    const dashboard = await complianceAnalyticsService.generateComplianceDashboard(
      practiceId,
      {
        period,
        includeDetails: includeDetails === 'true'
      }
    );

    res.json({
      success: true,
      message: {
        he: 'לוח בקרת ציות נוצר בהצלחה',
        en: 'Compliance dashboard generated successfully'
      },
      data: dashboard
    });
  })
);

/**
 * @route   POST /api/compliance/analyze
 * @desc    Analyze audit logs for compliance violations
 * @access  Private (Admin, Compliance Officer)
 */
router.post('/analyze',
  auth,
  checkRole(['admin']),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('includePatterns').optional().isBoolean(),
  body('includeRiskScore').optional().isBoolean(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate = new Date(),
      includePatterns = true,
      includeRiskScore = true
    } = req.body;

    const analysis = await complianceAnalyticsService.analyzeComplianceViolations(
      practiceId,
      {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        includePatterns,
        includeRiskScore
      }
    );

    res.json({
      success: true,
      message: {
        he: `נמצאו ${analysis.violations.length} הפרות ציות`,
        en: `Found ${analysis.violations.length} compliance violations`
      },
      data: analysis
    });
  })
);

/**
 * @route   GET /api/compliance/phi-access
 * @desc    Detect unauthorized PHI access patterns
 * @access  Private (Admin, Compliance Officer)
 */
router.get('/phi-access',
  auth,
  checkRole(['admin']),
  query('lookbackDays').optional().isInt({ min: 1, max: 90 }),
  query('sensitivityThreshold').optional().isFloat({ min: 0, max: 1 }),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const {
      lookbackDays = 7,
      sensitivityThreshold = 0.7
    } = req.query;

    const analysis = await complianceAnalyticsService.detectUnauthorizedPHIAccess(
      practiceId,
      {
        lookbackDays: parseInt(lookbackDays),
        sensitivityThreshold: parseFloat(sensitivityThreshold)
      }
    );

    res.json({
      success: true,
      message: {
        he: `נותחו ${analysis.totalPHIAccesses} גישות למידע רפואי`,
        en: `Analyzed ${analysis.totalPHIAccesses} PHI accesses`
      },
      data: analysis
    });
  })
);

/**
 * @route   GET /api/compliance/violations/:type
 * @desc    Get specific type of violations
 * @access  Private (Admin, Compliance Officer)
 */
router.get('/violations/:type',
  auth,
  checkRole(['admin']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const { type } = req.params;
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      limit = 100
    } = req.query;

    const analysis = await complianceAnalyticsService.analyzeComplianceViolations(
      practiceId,
      {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      }
    );

    const filteredViolations = analysis.violations
      .filter(v => v.type === type)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      message: {
        he: `נמצאו ${filteredViolations.length} הפרות מסוג ${type}`,
        en: `Found ${filteredViolations.length} violations of type ${type}`
      },
      data: {
        type,
        violations: filteredViolations,
        totalCount: filteredViolations.length,
        dateRange: { startDate, endDate }
      }
    });
  })
);

/**
 * @route   GET /api/compliance/trends
 * @desc    Get compliance trends over time
 * @access  Private (Admin, Compliance Officer)
 */
router.get('/trends',
  auth,
  checkRole(['admin']),
  query('period').optional().isIn(['24h', '7d', '30d', '90d', '1y']),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const { period = '30d' } = req.query;

    const dashboard = await complianceAnalyticsService.generateComplianceDashboard(
      practiceId,
      { period, includeDetails: false }
    );

    res.json({
      success: true,
      message: {
        he: 'מגמות ציות נוצרו בהצלחה',
        en: 'Compliance trends generated successfully'
      },
      data: {
        period,
        trends: dashboard.trends,
        currentScore: dashboard.complianceScore,
        currentStatus: dashboard.complianceStatus
      }
    });
  })
);

/**
 * @route   POST /api/compliance/export
 * @desc    Export compliance report
 * @access  Private (Admin, Compliance Officer)
 */
router.post('/export',
  auth,
  checkRole(['admin']),
  body('format').optional().isIn(['pdf', 'csv', 'json']),
  body('period').optional().isIn(['24h', '7d', '30d', '90d', '1y']),
  body('includeViolations').optional().isBoolean(),
  body('includeRecommendations').optional().isBoolean(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const {
      format = 'json',
      period = '30d',
      includeViolations = true,
      includeRecommendations = true
    } = req.body;

    const dashboard = await complianceAnalyticsService.generateComplianceDashboard(
      practiceId,
      { period, includeDetails: true }
    );

    // Prepare export data
    const exportData = {
      exportDate: new Date(),
      practiceId,
      period,
      complianceScore: dashboard.complianceScore,
      complianceStatus: dashboard.complianceStatus,
      summary: dashboard.summary,
      metrics: dashboard.metrics
    };

    if (includeViolations) {
      exportData.violations = dashboard.violationDetails;
      exportData.riskAreas = dashboard.riskAreas;
    }

    if (includeRecommendations) {
      exportData.recommendations = dashboard.recommendations;
    }

    // Set appropriate headers based on format
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=compliance-report-${Date.now()}.csv`);
      // Convert to CSV (simplified for example)
      const csv = Object.entries(exportData)
        .map(([key, value]) => `${key},${JSON.stringify(value)}`)
        .join('\n');
      res.send(csv);
    } else {
      res.json({
        success: true,
        message: {
          he: 'דוח ציות יוצא בהצלחה',
          en: 'Compliance report exported successfully'
        },
        data: exportData
      });
    }
  })
);

/**
 * @route   GET /api/compliance/risk-score
 * @desc    Get current risk score
 * @access  Private (Any authenticated user)
 */
router.get('/risk-score',
  auth,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;

    const analysis = await complianceAnalyticsService.analyzeComplianceViolations(
      practiceId,
      {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(),
        includeRiskScore: true
      }
    );

    res.json({
      success: true,
      message: {
        he: 'ציון סיכון חושב בהצלחה',
        en: 'Risk score calculated successfully'
      },
      data: {
        riskScore: analysis.riskScore,
        riskLevel: complianceAnalyticsService.getComplianceStatus(analysis.riskScore),
        violationCount: analysis.violations.length,
        lastUpdated: new Date()
      }
    });
  })
);

/**
 * @route   GET /api/compliance/alerts
 * @desc    Get active compliance alerts
 * @access  Private (Admin, Compliance Officer)
 */
router.get('/alerts',
  auth,
  checkRole(['admin']),
  query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const { severity, limit = 50 } = req.query;

    const analysis = await complianceAnalyticsService.analyzeComplianceViolations(
      practiceId,
      {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date()
      }
    );

    let alerts = analysis.violations;
    
    if (severity) {
      alerts = alerts.filter(v => v.severity === severity);
    }

    alerts = alerts.slice(0, parseInt(limit));

    res.json({
      success: true,
      message: {
        he: `נמצאו ${alerts.length} התראות פעילות`,
        en: `Found ${alerts.length} active alerts`
      },
      data: {
        alerts,
        totalCount: alerts.length,
        severityCounts: {
          critical: alerts.filter(a => a.severity === 'critical').length,
          high: alerts.filter(a => a.severity === 'high').length,
          medium: alerts.filter(a => a.severity === 'medium').length,
          low: alerts.filter(a => a.severity === 'low').length
        }
      }
    });
  })
);

module.exports = router;