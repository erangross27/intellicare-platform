// Threat Detection Routes
// Endpoints for threat monitoring and management

const express = require('express');
const router = express.Router();
const { fullClinicAuth } = require('../middleware/practiceAuth');
const asyncHandler = require('../utils/asyncHandler');
const {
  getThreatStatistics,
  updateBlacklist
} = require('../middleware/threatDetection');
const threatDetectionService = require('../services/threatDetectionService');

// All threat detection routes require admin authentication
router.use(fullClinicAuth);

// Admin permission check middleware
const requireAdmin = (req, res, next) => {
  if (!req.user.roles?.includes('admin') && !req.user.permissions?.includes('manage_security')) {
    return res.status(403).json({
      success: false,
      message: {
        en: 'Access denied. Admin privileges required.',
        he: 'גישה נדחתה. נדרשות הרשאות מנהל.'
      }
    }, auditContext);
  }
  next();
};

// @route   GET /api/threat-detection/statistics
// @desc    Get threat detection statistics
// @access  Admin only
router.get('/statistics', requireAdmin, getThreatStatistics);

// @route   GET /api/threat-detection/threats
// @desc    Get current threats and anomalies
// @access  Admin only
router.get('/threats', requireAdmin, asyncHandler(async (req, res) => {
  const { timeWindow = 3600000 } = req.query; // Default 1 hour
  
  const threats = [];
  const now = Date.now();
  
  // Collect recent suspicious patterns
  for (const [pattern, occurrences] of threatDetectionService.suspiciousPatterns) {
    const recent = occurrences.filter(o => now - o.timestamp < parseInt(timeWindow));
    if (recent.length > 0) {
      threats.push({
        pattern,
        occurrences: recent.length,
        lastSeen: new Date(Math.max(...recent.map(r => r.timestamp))),
        threats: recent.map(r => r.threat)
      }, auditContext);
    }
  }
  
  res.json({
    success: true,
    threats: threats.sort((a, b) => b.occurrences - a.occurrences),
    blacklistedIPs: Array.from(threatDetectionService.blacklistedIPs),
    threatLevel: threatDetectionService.getThreatLevel(),
    timeWindow: parseInt(timeWindow),
    timestamp: new Date()
  });
}));

// @route   GET /api/threat-detection/ip/:ip
// @desc    Get threat analysis for specific IP
// @access  Admin only
router.get('/ip/:ip', requireAdmin, asyncHandler(async (req, res) => {
  const { ip } = req.params;
  
  // Get IP history
  const history = threatDetectionService.ipHistory.get(ip);
  
  // Check if blacklisted
  const isBlacklisted = threatDetectionService.blacklistedIPs.has(ip);
  
  // Get geolocation
  const geoip = require('geoip-lite');
  const geo = geoip.lookup(ip);
  
  // Perform reputation check
  const reputation = await threatDetectionService.checkIPReputation(ip);
  
  res.json({
    success: true,
    ip,
    analysis: {
      blacklisted: isBlacklisted,
      reputation: reputation,
      geolocation: geo,
      history: history || { requests: [], failedLogins: 0, suspiciousActivities: 0 },
      requestCount: history?.requests.length || 0,
      failedLogins: history?.failedLogins || 0
    },
    timestamp: new Date()
  });
}));

// @route   GET /api/threat-detection/user/:userId
// @desc    Get behavioral analysis for specific user
// @access  Admin only
router.get('/user/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // Get user behavior profile
  const behavior = threatDetectionService.userBehaviors.get(userId);
  
  if (!behavior) {
    return res.json({
      success: true,
      userId,
      message: 'No behavioral data available for this user',
      timestamp: new Date()
    }, auditContext);
  }
  
  res.json({
    success: true,
    userId,
    behavior: {
      normalHours: Array.from(behavior.normalHours),
      normalIPs: Array.from(behavior.normalIPs),
      normalUserAgents: Array.from(behavior.normalUserAgents),
      geolocations: behavior.normalGeolocations.slice(-10), // Last 10 locations
      lastActivity: behavior.lastActivity,
      accessPatterns: behavior.accessPatterns.slice(-20) // Last 20 patterns
    },
    timestamp: new Date()
  });
}));

// @route   POST /api/threat-detection/blacklist
// @desc    Add or remove IP from blacklist
// @access  Admin only
router.post('/blacklist', requireAdmin, updateBlacklist);

// @route   POST /api/threat-detection/analyze
// @desc    Manually analyze a request pattern
// @access  Admin only
router.post('/analyze', requireAdmin, asyncHandler(async (req, res) => {
  const { url, method, body, headers, ip } = req.body;
  
  // Create mock request for analysis
  const mockReq = {
    originalUrl: url || '/test',
    path: url || '/test',
    method: method || 'GET',
    body: body || {},
    query: {},
    headers: headers || {},
    ip: ip || '127.0.0.1',
    user: req.user
  };
  
  // Perform analysis
  const analysis = await threatDetectionService.analyzeRequest(mockReq);
  
  res.json({
    success: true,
    analysis,
    timestamp: new Date()
  });
}));

// @route   GET /api/threat-detection/patterns
// @desc    Get known attack patterns
// @access  Admin only
router.get('/patterns', requireAdmin, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    patterns: threatDetectionService.knownAttackPatterns.map(p => ({
      type: p.type,
      score: p.score,
      pattern: p.pattern.source
    })),
    suspiciousAgents: Array.from(threatDetectionService.suspiciousUserAgents),
    timestamp: new Date()
  });
}));

// @route   POST /api/threat-detection/patterns
// @desc    Add new attack pattern
// @access  Admin only
router.post('/patterns', requireAdmin, asyncHandler(async (req, res) => {
  const { pattern, type, score } = req.body;
  
  if (!pattern || !type || !score) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: pattern, type, score'
    }, auditContext);
  }
  
  try {
    // Create regex from pattern
    const regex = new RegExp(pattern, 'gi');
    
    // Add to patterns
    threatDetectionService.knownAttackPatterns.push({
      pattern: regex,
      type,
      score: parseInt(score)
    }, auditContext);
    
    // Log pattern addition using SecureDataAccess
    const auditContext = {
      serviceId: 'threat-detection-service',
      apiKey: req.headers['x-api-key'],
      practiceId: req.practice.id
    };
    
    await SecureDataAccess.insert('audit_logs', {
      userId: req.user._id,
      userDetails: {
        email: req.user.email,
        fullName: req.user.profile?.fullName,
        roles: req.user.roles
      },
      action: 'THREAT_PATTERN_ADDED',
      resourceType: 'SECURITY',
      resourceId: 'THREAT_PATTERNS',
      resourceDetails: {
        pattern,
        type,
        score,
        addedBy: req.user.email
      },
      request: {
        method: req.method,
        url: req.originalUrl,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        sessionId: req.sessionID
      },
      response: {
        statusCode: 200,
        success: true
      },
      timestamp: new Date(),
      severity: 'medium'
    }, auditContext);
    
    res.json({
      success: true,
      message: 'Attack pattern added successfully',
      totalPatterns: threatDetectionService.knownAttackPatterns.length
    }, auditContext);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid regex pattern',
      error: error.message
    }, auditContext);
  }
}));

// @route   DELETE /api/threat-detection/cleanup
// @desc    Manually trigger cleanup of old data
// @access  Admin only
router.delete('/cleanup', requireAdmin, asyncHandler(async (req, res) => {
  const beforeStats = {
    ipHistory: threatDetectionService.ipHistory.size,
    userBehaviors: threatDetectionService.userBehaviors.size,
    suspiciousPatterns: threatDetectionService.suspiciousPatterns.size
  };
  
  // Run cleanup
  threatDetectionService.cleanup();
  
  const afterStats = {
    ipHistory: threatDetectionService.ipHistory.size,
    userBehaviors: threatDetectionService.userBehaviors.size,
    suspiciousPatterns: threatDetectionService.suspiciousPatterns.size
  };
  
  res.json({
    success: true,
    message: 'Cleanup completed',
    before: beforeStats,
    after: afterStats,
    cleaned: {
      ipHistory: beforeStats.ipHistory - afterStats.ipHistory,
      userBehaviors: beforeStats.userBehaviors - afterStats.userBehaviors,
      suspiciousPatterns: beforeStats.suspiciousPatterns - afterStats.suspiciousPatterns
    },
    timestamp: new Date()
  });
}));

// @route   GET /api/threat-detection/config
// @desc    Get threat detection configuration
// @access  Admin only
router.get('/config', requireAdmin, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    config: threatDetectionService.config,
    timestamp: new Date()
  });
}));

// @route   PUT /api/threat-detection/config
// @desc    Update threat detection configuration
// @access  Admin only
router.put('/config', requireAdmin, asyncHandler(async (req, res) => {
  const updates = req.body;
  
  // Update configuration
  Object.assign(threatDetectionService.config, updates);
  
  // Log configuration change using SecureDataAccess
  const auditContext = {
    serviceId: 'threat-detection-service',
    apiKey: req.headers['x-api-key'],
    practiceId: req.practice.id
  };
  
  await SecureDataAccess.insert('audit_logs', {
    userId: req.user._id,
    userDetails: {
      email: req.user.email,
      fullName: req.user.profile?.fullName,
      roles: req.user.roles
    },
    action: 'THREAT_CONFIG_UPDATED',
    resourceType: 'SECURITY',
    resourceId: 'THREAT_CONFIG',
    resourceDetails: {
      updates,
      updatedBy: req.user.email
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID
    },
    response: {
      statusCode: 200,
      success: true
    },
    timestamp: new Date(),
    severity: 'high'
  });
  
  res.json({
    success: true,
    message: 'Configuration updated successfully',
    config: threatDetectionService.config,
    timestamp: new Date()
  });
}));

module.exports = router;