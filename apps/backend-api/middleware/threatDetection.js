// Threat Detection Middleware
// Analyzes incoming requests for security threats and anomalies

const threatDetectionService = require('../services/threatDetectionService');
const secureConfigService = require('../services/secureConfigService');
const SecureDataAccess = require('../services/secureDataAccess');
const { simpleAuditLog } = require('./auditLog');

/**
 * Main threat detection middleware
 */
const threatDetectionMiddleware = async (req, res, next) => {
  try {
    // Skip threat detection for health checks and public endpoints
    if (req.path === '/health' || req.path === '/tools') {
      return next();
    }

    // Perform threat analysis
    const analysis = await threatDetectionService.analyzeRequest(req);
    
    // Attach analysis to request for logging
    req.threatAnalysis = analysis;
    
    // Log analysis in development
    if (secureConfigService.get('NODE_ENV') === 'development' && analysis.riskScore > 0) {
      console.log(`🔍 Threat Analysis for ${req.path}:`, {
        riskScore: analysis.riskScore,
        threats: analysis.threats.length,
        anomalies: analysis.anomalies.length
      });
    }
    
    // Check recommendations
    const criticalAction = analysis.recommendations.find(r => r.priority === 'CRITICAL');
    
    if (criticalAction && criticalAction.action === 'BLOCK_REQUEST') {
      // Block the request
      console.error(`🚫 BLOCKED HIGH-RISK REQUEST from ${req.ip}:`, {
        path: req.path,
        riskScore: analysis.riskScore,
        threats: analysis.threats
      });
      
      // Log to audit
      await simpleAuditLog(req, 'THREAT_BLOCKED', {
        riskScore: analysis.riskScore,
        threats: analysis.threats,
        anomalies: analysis.anomalies,
        ip: req.ip,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        message: {
          en: 'Access denied due to security threat',
          he: 'הגישה נדחתה עקב איום אבטחה'
        },
        requestId: req.id
      });
    }
    
    // Check for high-risk actions
    const highRiskAction = analysis.recommendations.find(r => r.priority === 'HIGH');
    
    if (highRiskAction) {
      // Add security headers for high-risk requests
      res.setHeader('X-Security-Alert', 'HIGH_RISK');
      res.setHeader('X-Risk-Score', analysis.riskScore.toString());
      
      // Log high-risk activity
      console.warn(`⚠️ HIGH-RISK REQUEST from ${req.ip}:`, {
        path: req.path,
        riskScore: analysis.riskScore,
        recommendation: highRiskAction.action
      });
      
      // If MFA is required, set header
      if (highRiskAction.action === 'REQUIRE_MFA') {
        res.setHeader('X-Require-MFA', 'true');
      }
    }
    
    // Track failed login attempts
    if (req.path.includes('login') || req.path.includes('auth')) {
      res.on('finish', () => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          const ipHistory = threatDetectionService.ipHistory.get(req.ip) || {
            requests: [],
            failedLogins: 0,
            suspiciousActivities: 0
          };
          ipHistory.failedLogins++;
          threatDetectionService.ipHistory.set(req.ip, ipHistory);
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('❌ Threat detection error:', error);
    // Don't block request on error, just log and continue
    next();
  }
};

/**
 * IP Blacklist middleware - must run before main threat detection
 */
const ipBlacklistMiddleware = (req, res, next) => {
  if (threatDetectionService.blacklistedIPs.has(req.ip)) {
    console.error(`🚫 BLOCKED BLACKLISTED IP: ${req.ip}`);
    
    return res.status(403).json({
      success: false,
      message: {
        en: 'Access denied',
        he: 'הגישה נדחתה'
      }
    });
  }
  
  next();
};

/**
 * Geographic restriction middleware
 */
const geographicRestrictionMiddleware = (allowedCountries = ['IL', 'US']) => {
  return (req, res, next) => {
    const geoip = require('geoip-lite');

    // Debug logging for IP investigation
    if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 Geographic check - req.ip: ${req.ip}, type: ${typeof req.ip}`);

    // Skip geo check for localhost/private IPs (but log for security)
    const localIPs = ['::1', '127.0.0.1', '::ffff:127.0.0.1'];
    if (localIPs.includes(req.ip) || req.ip?.startsWith('192.168.') || req.ip?.startsWith('10.')) {
      if (process.env.QUIET_LOGS !== 'true') console.log(`✅ Local/Private IP detected: ${req.ip} - skipping geo check`);
      return next();
    }

    // Validate IP format before lookup
    if (!req.ip || typeof req.ip !== 'string') {
      console.error(`⚠️ Invalid IP format: ${req.ip} (type: ${typeof req.ip})`);
      // Log this as a security concern but don't crash
      req.geoRestricted = true;
      res.setHeader('X-Geo-Invalid-IP', 'true');
      return next();
    }

    const geo = geoip.lookup(req.ip);

    if (geo && !allowedCountries.includes(geo.country)) {
      console.warn(`⚠️ Access attempt from restricted country: ${geo.country} (IP: ${req.ip})`);

      // Don't block, but flag for monitoring
      req.geoRestricted = true;
      res.setHeader('X-Geo-Restricted', 'true');
    }

    next();
  };
};

/**
 * Attack pattern detection middleware
 */
const attackPatternMiddleware = (req, res, next) => {
  // Whitelist legitimate endpoints that may contain "export" or other flagged terms
  const whitelistedPaths = [
    '/pdf/allergy-immunology-assessment', // Puppeteer PDF generation
  ];

  // Skip attack pattern detection for whitelisted paths
  if (whitelistedPaths.some(path => req.path.includes(path))) {
    return next();
  }

  const patterns = threatDetectionService.detectAttackPatterns(req);

  if (patterns.threats.length > 0) {
    console.warn(`⚠️ Attack patterns detected:`, patterns.threats);

    // Add to suspicious patterns tracking
    for (const threat of patterns.threats) {
      const patternKey = `${threat.type}_${req.ip}`;
      const occurrences = threatDetectionService.suspiciousPatterns.get(patternKey) || [];
      occurrences.push({
        timestamp: Date.now(),
        path: req.path,
        threat: threat
      });
      threatDetectionService.suspiciousPatterns.set(patternKey, occurrences);
    }

    // Block if high severity
    const highSeverity = patterns.threats.find(t => t.severity === 'HIGH');
    if (highSeverity) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Invalid request detected',
          he: 'זוהתה בקשה לא תקינה'
        },
        requestId: req.id
      });
    }
  }

  next();
};

/**
 * Anomaly detection middleware
 */
const anomalyDetectionMiddleware = async (req, res, next) => {
  if (!req.user) {
    return next();
  }
  
  const behaviorAnalysis = threatDetectionService.analyzeBehavior(req.user._id, req);
  
  if (behaviorAnalysis.anomaly) {
    console.warn(`⚠️ Behavioral anomaly detected for user ${req.user._id}:`, behaviorAnalysis.anomaly);
    
    // Add anomaly to response headers for monitoring
    res.setHeader('X-Anomaly-Detected', behaviorAnalysis.anomaly.type);
    
    // For impossible travel, require additional verification
    if (behaviorAnalysis.anomaly.type === 'IMPOSSIBLE_TRAVEL') {
      req.requireAdditionalVerification = true;
    }
  }
  
  next();
};

/**
 * Get threat detection statistics endpoint handler
 */
const getThreatStatistics = (req, res) => {
  const stats = threatDetectionService.getStatistics();
  
  res.json({
    success: true,
    statistics: stats,
    timestamp: new Date()
  });
};

/**
 * Update blacklist endpoint handler
 */
const updateBlacklist = (req, res) => {
  const { action, ip } = req.body;
  
  if (!action || !ip) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: action, ip'
    });
  }
  
  if (action === 'add') {
    threatDetectionService.blacklistedIPs.add(ip);
    console.log(`➕ Added ${ip} to blacklist`);
  } else if (action === 'remove') {
    threatDetectionService.blacklistedIPs.delete(ip);
    console.log(`➖ Removed ${ip} from blacklist`);
  } else {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Use "add" or "remove"'
    });
  }
  
  res.json({
    success: true,
    message: `IP ${ip} ${action === 'add' ? 'added to' : 'removed from'} blacklist`,
    blacklistSize: threatDetectionService.blacklistedIPs.size
  });
};

module.exports = {
  threatDetectionMiddleware,
  ipBlacklistMiddleware,
  geographicRestrictionMiddleware,
  attackPatternMiddleware,
  anomalyDetectionMiddleware,
  getThreatStatistics,
  updateBlacklist
};