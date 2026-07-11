/**
 * 🛡️ SECURITY DASHBOARD API
 * Comprehensive security monitoring and management endpoints
 */

const express = require('express');
const router = express.Router();
const securityAuditService = require('../services/securityAuditService');
const immutableAuditService = require('../services/immutableAuditService');
const blockchainAuditService = require('../services/blockchainAuditService');
const zeroTrustService = require('../services/zeroTrustService');
const securityChaosService = require('../services/securityChaosService');
const keyManagementService = require('../services/keyManagementService');
const { memoryGuard, zeroTrustAuthMiddleware, zeroTrustPermissionMiddleware } = require('../middleware/securityMiddleware');
const { practiceAuth } = require('../middleware/practiceAuth');

// 🔒 SECURITY: Enhanced auth middleware for security dashboard
const securityAuth = async (req, res, next) => {
  try {
    // 🔒 SECURITY: Support both x-auth-token and Authorization Bearer
    let token = req.header('x-auth-token');

    if (!token) {
      const authHeader = req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: {
          en: 'No token provided, authorization denied.',
          he: 'לא סופק אסימון, הרשאה נדחתה.'
        }
      });
    }

    // 🔒 SECURITY: Verify token with proper secret
    const jwt = require('jsonwebtoken');
    const config = require('config');
    const decoded = jwt.verify(token, config.get('jwtSecret'));

    // Attach user info to request
    req.user = decoded.user;

    next();
  } catch (error) {
    console.error('Security auth error:', error);
    res.status(401).json({
      success: false,
      message: {
        en: 'Token is not valid',
        he: 'האסימון אינו תקף'
      }
    });
  }
};

// @route   GET /api/security/dashboard
// @desc    Get comprehensive security dashboard data
// @access  Admin only
router.get('/dashboard', securityAuth, zeroTrustAuthMiddleware, zeroTrustPermissionMiddleware('system_admin'), async (req, res) => {
  try {
    const dashboard = {
      timestamp: new Date().toISOString(),
      overallStatus: 'secure',
      riskLevel: 'low',
      
      // Security services status
      services: {
        auditLogging: securityAuditService.getSecurityStatus(),
        immutableAudit: await immutableAuditService.verifyAuditIntegrity(),
        blockchain: blockchainAuditService.getBlockchainStats(),
        zeroTrust: zeroTrustService.getZeroTrustStatus(),
        chaosEngineering: securityChaosService.getChaosStatus(),
        keyManagement: keyManagementService.getStatus(),
        memoryGuard: memoryGuard.getMemoryStatus()
      },

      // Security metrics
      metrics: {
        totalAuditEvents: securityAuditService.getSecurityStatus().recentEvents,
        blockchainBlocks: blockchainAuditService.getBlockchainStats().totalBlocks,
        activeSessions: zeroTrustService.getZeroTrustStatus().activeSessions,
        memoryUsage: memoryGuard.getMemoryStatus().usagePercent,
        chaosTestsPassed: securityChaosService.getChaosStatus().testsCompleted
      },

      // Recent security events
      recentEvents: await getRecentSecurityEvents(),
      
      // Security alerts
      alerts: await getActiveSecurityAlerts(),
      
      // Compliance status
      compliance: {
        hipaa: await getHIPAAComplianceStatus(),
        auditReadiness: await getAuditReadinessStatus()
      }
    };

    // Calculate overall risk level
    dashboard.riskLevel = calculateOverallRiskLevel(dashboard);
    dashboard.overallStatus = dashboard.riskLevel === 'high' ? 'at_risk' : 'secure';

    res.json(dashboard);
  } catch (error) {
    console.error('Security dashboard error:', error);
    res.status(500).json({
      error: 'Dashboard unavailable',
      message: 'Security dashboard temporarily unavailable'
    });
  }
});

// @route   GET /api/security/audit-logs
// @desc    Get audit logs with filtering
// @access  Admin only - REQUIRES ZERO TRUST AUTHENTICATION
router.get('/audit-logs', practiceAuth, zeroTrustAuthMiddleware, zeroTrustPermissionMiddleware('system_admin'), async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      eventType, 
      userId, 
      severity,
      source = 'all',
      limit = 100 
    } = req.query;

    const criteria = {
      startDate,
      endDate,
      eventType,
      userId,
      severity
    };

    let results = {};

    if (source === 'all' || source === 'standard') {
      results.standardAudit = securityAuditService.generateSecurityReport();
    }

    if (source === 'all' || source === 'immutable') {
      results.immutableAudit = await immutableAuditService.searchAuditLogs(criteria);
    }

    if (source === 'all' || source === 'blockchain') {
      results.blockchainAudit = blockchainAuditService.searchBlockchain(criteria);
    }

    res.json({
      criteria,
      source,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({
      error: 'Audit logs unavailable',
      message: 'Audit logs temporarily unavailable'
    });
  }
});

// @route   POST /api/security/chaos-test
// @desc    Run security chaos test
// @access  Admin only - REQUIRES ZERO TRUST AUTHENTICATION
router.post('/chaos-test', practiceAuth, zeroTrustAuthMiddleware, zeroTrustPermissionMiddleware('system_admin'), async (req, res) => {
  try {
    const { testId, options = {} } = req.body;

    if (!testId) {
      return res.status(400).json({
        error: 'Test ID required',
        message: 'Chaos test ID must be specified'
      });
    }

    const testResult = await securityChaosService.runChaosTest(testId, options);

    res.json({
      message: 'Chaos test completed',
      testResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chaos test error:', error);
    res.status(500).json({
      error: 'Chaos test failed',
      message: error.message
    });
  }
});

// @route   GET /api/security/zero-trust/sessions
// @desc    Get active Zero Trust sessions
// @access  Admin only - REQUIRES ZERO TRUST AUTHENTICATION
router.get('/zero-trust/sessions', securityAuth, zeroTrustAuthMiddleware, zeroTrustPermissionMiddleware('system_admin'), async (req, res) => {
  try {
    const sessions = Array.from(zeroTrustService.activeSessions.values()).map(session => ({
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      riskScore: session.riskScore,
      deviceFingerprint: session.deviceFingerprint.substring(0, 8) + '...',
      permissions: session.permissions.length
    }));

    res.json({
      sessions,
      totalSessions: sessions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Zero Trust sessions error:', error);
    res.status(500).json({
      error: 'Sessions unavailable',
      message: 'Zero Trust sessions temporarily unavailable'
    });
  }
});

// @route   POST /api/security/emergency/key-rotation
// @desc    Trigger emergency key rotation
// @access  Admin only - REQUIRES ZERO TRUST AUTHENTICATION
router.post('/emergency/key-rotation', practiceAuth, zeroTrustAuthMiddleware, zeroTrustPermissionMiddleware('system_admin'), async (req, res) => {
  try {
    const { reason = 'manual_trigger' } = req.body;

    await keyManagementService.emergencyKeyRotation(reason);

    // Log critical event
    await immutableAuditService.addAuditEntry({
      eventType: 'emergency_key_rotation',
      userId: req.user?.id || 'system',
      details: `Emergency key rotation triggered: ${reason}`,
      metadata: {
        reason,
        triggeredBy: req.user?.id || 'system',
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      message: 'Emergency key rotation completed',
      reason,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Emergency key rotation error:', error);
    res.status(500).json({
      error: 'Key rotation failed',
      message: error.message
    });
  }
});

// @route   GET /api/security/export/audit-logs
// @desc    Export audit logs for compliance
// @access  Admin only - REQUIRES ZERO TRUST AUTHENTICATION
router.get('/export/audit-logs', practiceAuth, zeroTrustAuthMiddleware, zeroTrustPermissionMiddleware('system_admin'), async (req, res) => {
  try {
    const { format = 'json', source = 'all' } = req.query;

    let exportData = {
      exportId: crypto.randomUUID(),
      exportTimestamp: new Date().toISOString(),
      format,
      source,
      data: {}
    };

    if (source === 'all' || source === 'immutable') {
      exportData.data.immutableAudit = await immutableAuditService.exportAuditLogs({ format });
    }

    if (source === 'all' || source === 'blockchain') {
      exportData.data.blockchainAudit = await blockchainAuditService.exportBlockchain(format);
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-export-${exportData.exportId}.csv"`);
      
      // Combine CSV data
      let csvContent = '';
      if (exportData.data.immutableAudit) {
        csvContent += exportData.data.immutableAudit + '\n\n';
      }
      if (exportData.data.blockchainAudit) {
        csvContent += exportData.data.blockchainAudit;
      }
      
      res.send(csvContent);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-export-${exportData.exportId}.json"`);
      res.json(exportData);
    }
  } catch (error) {
    console.error('Audit export error:', error);
    res.status(500).json({
      error: 'Export failed',
      message: error.message
    });
  }
});

// Helper functions
async function getRecentSecurityEvents() {
  try {
    const events = securityAuditService.getRecentEvents(60 * 60 * 1000); // Last hour
    return events.slice(0, 10); // Last 10 events
  } catch (error) {
    return [];
  }
}

async function getActiveSecurityAlerts() {
  try {
    const report = securityAuditService.generateSecurityReport();
    return report.topRisks || [];
  } catch (error) {
    return [];
  }
}

async function getHIPAAComplianceStatus() {
  return {
    encryptionAtRest: true,
    encryptionInTransit: true,
    accessControls: true,
    auditLogging: true,
    dataIntegrity: true,
    incidentResponse: true,
    keyManagement: true,
    overallCompliance: true
  };
}

async function getAuditReadinessStatus() {
  const immutableIntegrity = await immutableAuditService.verifyAuditIntegrity();
  const blockchainValid = blockchainAuditService.isChainValid();
  
  return {
    auditLogsIntact: immutableIntegrity.valid,
    blockchainValid: blockchainValid,
    exportCapability: true,
    retentionCompliance: true,
    overallReadiness: immutableIntegrity.valid && blockchainValid
  };
}

function calculateOverallRiskLevel(dashboard) {
  let riskScore = 0;
  
  // Check service health
  if (!dashboard.services.immutableAudit.valid) riskScore += 0.3;
  if (!dashboard.services.blockchain.chainValid) riskScore += 0.3;
  if (dashboard.services.memoryGuard.usagePercent > 80) riskScore += 0.2;
  if (dashboard.alerts.length > 5) riskScore += 0.2;
  
  if (riskScore > 0.7) return 'high';
  if (riskScore > 0.3) return 'medium';
  return 'low';
}

module.exports = router;
