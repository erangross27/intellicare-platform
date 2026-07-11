// Advanced Threat Detection Service
// Implements behavioral analysis, anomaly detection, and threat intelligence

const geoip = require('geoip-lite');
const axios = require('axios');
const crypto = require('crypto');
const serviceAccountManager = require('./serviceAccountManager');
const { v4: uuidv4 } = require('uuid');

class ThreatDetectionService {
  constructor() {
    // Behavioral analysis storage
    this.userBehaviors = new Map(); // userId -> behavior patterns
    this.ipHistory = new Map(); // IP -> access history
    this.suspiciousPatterns = new Map(); // pattern -> occurrences
    
    // Threat intelligence
    this.blacklistedIPs = new Set();
    this.suspiciousUserAgents = new Set();
    this.knownAttackPatterns = [];
    
    // Configuration
    this.config = {
      maxLoginAttempts: 5,
      maxRequestsPerMinute: 100,
      suspiciousThreshold: 10,
      anomalyWindow: 5 * 60 * 1000, // 5 minutes
      behaviorHistoryLimit: 1000,
      geoAnomalyDistance: 500, // km
      riskScoreThreshold: 70 // 0-100 scale
    };
    
    // Initialize known attack patterns
    this.initializeAttackPatterns();
    
    // Initialize suspicious user agents
    this.initializeSuspiciousAgents();
    
    // Start cleanup interval
    this.startCleanup();
  }

  async initialize() {
    if (!this.serviceToken) {
      this.serviceToken = await serviceAccountManager.authenticate('threat-detection-service');
    }
    return this;
  }

  /**
   * Initialize known attack patterns
   */
  initializeAttackPatterns() {
    this.knownAttackPatterns = [
      // SQL Injection patterns
      { pattern: /(\bUNION\b.*\bSELECT\b|\bOR\b.*=.*\bOR\b)/i, type: 'SQL_INJECTION', score: 30 },
      { pattern: /(\bDROP\s+TABLE\b|\bDELETE\s+FROM\b|\bINSERT\s+INTO\b)/i, type: 'SQL_INJECTION', score: 40 },
      
      // XSS patterns
      { pattern: /<script[^>]*>.*?<\/script>/gi, type: 'XSS', score: 35 },
      { pattern: /javascript:/i, type: 'XSS', score: 25 },
      { pattern: /on\w+\s*=\s*["'][^"']+["']/i, type: 'XSS', score: 20 },
      
      // Path traversal
      { pattern: /(\.\.[\/\\]){2,}/g, type: 'PATH_TRAVERSAL', score: 30 },
      { pattern: /\/etc\/passwd|\/windows\/system32/i, type: 'PATH_TRAVERSAL', score: 40 },
      
      // Command injection
      { pattern: /;\s*(ls|cat|rm|wget|curl|bash|sh)\s/i, type: 'COMMAND_INJECTION', score: 35 },
      { pattern: /\$\(.*\)|\`.*\`/g, type: 'COMMAND_INJECTION', score: 25 },
      
      // LDAP injection
      { pattern: /\*\|.*\|/g, type: 'LDAP_INJECTION', score: 20 },
      
      // NoSQL injection
      { pattern: /\$gt|\$lt|\$ne|\$regex/g, type: 'NOSQL_INJECTION', score: 25 },
      
      // Medical data exfiltration attempts
      { pattern: /SELECT.*patient.*FROM/i, type: 'DATA_EXFILTRATION', score: 45 },
      { pattern: /bulk.*download|export.*all/i, type: 'DATA_EXFILTRATION', score: 35 }
    ];
  }

  /**
   * Initialize suspicious user agents
   */
  initializeSuspiciousAgents() {
    this.suspiciousUserAgents = new Set([
      'sqlmap', // SQL injection tool
      'nikto', // Web vulnerability scanner
      'nmap', // Network scanner
      'masscan', // Port scanner
      'metasploit', // Penetration testing
      'burpsuite', // Security testing
      'nessus', // Vulnerability scanner
      'acunetix', // Web vulnerability scanner
      'openvas', // Vulnerability scanner
      'zaproxy', // OWASP ZAP
      'havij', // SQL injection tool
      'wget', // Command line tool (suspicious in web context)
      'curl', // Command line tool (suspicious in web context)
      'python-requests', // Automated scripts
    ]);
  }

  /**
   * Analyze request for threats
   */
  async analyzeRequest(req) {
    const analysis = {
      timestamp: new Date(),
      requestId: req.id || uuidv4(),
      riskScore: 0,
      threats: [],
      anomalies: [],
      recommendations: []
    };

    // 1. Check IP reputation
    const ipAnalysis = await this.checkIPReputation(req.ip);
    analysis.riskScore += ipAnalysis.score;
    if (ipAnalysis.threat) analysis.threats.push(ipAnalysis.threat);

    // 2. Analyze user behavior
    if (req.user) {
      const behaviorAnalysis = this.analyzeBehavior(req.user._id, req);
      analysis.riskScore += behaviorAnalysis.score;
      if (behaviorAnalysis.anomaly) analysis.anomalies.push(behaviorAnalysis.anomaly);
    }

    // 3. Check for attack patterns
    const patternAnalysis = this.detectAttackPatterns(req);
    analysis.riskScore += patternAnalysis.score;
    analysis.threats.push(...patternAnalysis.threats);

    // 4. Geographic anomaly detection
    const geoAnalysis = await this.detectGeographicAnomaly(req);
    analysis.riskScore += geoAnalysis.score;
    if (geoAnalysis.anomaly) analysis.anomalies.push(geoAnalysis.anomaly);

    // 5. User agent analysis
    const agentAnalysis = this.analyzeUserAgent(req.headers['user-agent']);
    analysis.riskScore += agentAnalysis.score;
    if (agentAnalysis.threat) analysis.threats.push(agentAnalysis.threat);

    // 6. Rate and volume analysis
    const volumeAnalysis = this.analyzeRequestVolume(req);
    analysis.riskScore += volumeAnalysis.score;
    if (volumeAnalysis.anomaly) analysis.anomalies.push(volumeAnalysis.anomaly);

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis);

    // Log high-risk requests
    if (analysis.riskScore >= this.config.riskScoreThreshold) {
      await this.logHighRiskRequest(req, analysis);
    }

    return analysis;
  }

  /**
   * Check IP reputation
   */
  async checkIPReputation(ip) {
    const result = { score: 0, threat: null };

    // Check blacklist
    if (this.blacklistedIPs.has(ip)) {
      result.score = 50;
      result.threat = {
        type: 'BLACKLISTED_IP',
        severity: 'HIGH',
        details: `IP ${ip} is blacklisted`
      };
      return result;
    }

    // Check IP history for suspicious activity
    const history = this.ipHistory.get(ip);
    if (history) {
      // Check for rapid requests
      const recentRequests = history.requests.filter(r => 
        Date.now() - r.timestamp < this.config.anomalyWindow
      );
      
      if (recentRequests.length > this.config.maxRequestsPerMinute) {
        result.score = 20;
        result.threat = {
          type: 'EXCESSIVE_REQUESTS',
          severity: 'MEDIUM',
          details: `${recentRequests.length} requests in ${this.config.anomalyWindow / 1000}s`
        };
      }

      // Check for failed authentication attempts
      if (history.failedLogins > this.config.maxLoginAttempts) {
        result.score = 30;
        result.threat = {
          type: 'BRUTE_FORCE_ATTEMPT',
          severity: 'HIGH',
          details: `${history.failedLogins} failed login attempts`
        };
      }
    }

    // Check if IP is from known VPN/Proxy/Tor
    // Skip geoip lookup for private/local IP addresses
    const isPrivateIP = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|169\.254\.|::1|localhost)/.test(ip);
    if (!isPrivateIP) {
      try {
        const geoData = geoip.lookup(ip);
        if (geoData && this.isAnonymousIP(geoData)) {
          result.score += 15;
          result.threat = {
            type: 'ANONYMOUS_IP',
            severity: 'LOW',
            details: 'Request from VPN/Proxy/Tor network'
          };
        }
      } catch (geoError) {
        // Silently skip geoip lookup errors
        if (process.env.QUIET_LOGS !== 'true') console.log(`Geoip lookup skipped for IP ${ip}: ${geoError.message}`);
      }
    }

    return result;
  }

  /**
   * Analyze user behavior for anomalies
   */
  analyzeBehavior(userId, req) {
    const result = { score: 0, anomaly: null };
    
    // Get or create user behavior profile
    let behavior = this.userBehaviors.get(userId);
    if (!behavior) {
      behavior = {
        normalHours: new Set(),
        normalIPs: new Set(),
        normalUserAgents: new Set(),
        normalGeolocations: [],
        accessPatterns: [],
        lastActivity: null
      };
      this.userBehaviors.set(userId, behavior);
    }

    const currentHour = new Date().getHours();
    const currentIP = req.ip;
    const currentAgent = req.headers['user-agent'];

    // Safe geoip lookup with private IP check
    let currentGeo = null;
    const isPrivateIP = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|169\.254\.|::1|localhost)/.test(currentIP);
    if (!isPrivateIP) {
      try {
        currentGeo = geoip.lookup(currentIP);
      } catch (geoError) {
        // Silently skip geoip lookup errors for invalid IPs
        currentGeo = null;
      }
    }

    // Check for unusual access time
    if (behavior.normalHours.size > 10 && !behavior.normalHours.has(currentHour)) {
      result.score += 10;
      result.anomaly = {
        type: 'UNUSUAL_ACCESS_TIME',
        details: `Access at unusual hour: ${currentHour}:00`
      };
    }

    // Check for new IP
    if (behavior.normalIPs.size > 5 && !behavior.normalIPs.has(currentIP)) {
      result.score += 15;
      result.anomaly = {
        type: 'NEW_IP_ADDRESS',
        details: `New IP address: ${currentIP}`
      };
    }

    // Check for new user agent
    if (behavior.normalUserAgents.size > 3 && !behavior.normalUserAgents.has(currentAgent)) {
      result.score += 10;
      result.anomaly = {
        type: 'NEW_USER_AGENT',
        details: 'Different browser or device detected'
      };
    }

    // Check for impossible travel (geographic anomaly)
    if (behavior.lastActivity && currentGeo) {
      const timeDiff = Date.now() - behavior.lastActivity.timestamp;
      const distance = this.calculateDistance(
        behavior.lastActivity.geo,
        currentGeo
      );
      
      // If traveled too far too quickly (>500km/hour)
      const maxPossibleDistance = (timeDiff / 3600000) * 500; // km
      if (distance > maxPossibleDistance) {
        result.score += 25;
        result.anomaly = {
          type: 'IMPOSSIBLE_TRAVEL',
          details: `Traveled ${Math.round(distance)}km in ${Math.round(timeDiff / 60000)} minutes`
        };
      }
    }

    // Update behavior profile
    behavior.normalHours.add(currentHour);
    behavior.normalIPs.add(currentIP);
    behavior.normalUserAgents.add(currentAgent);
    if (currentGeo) {
      behavior.normalGeolocations.push(currentGeo);
      behavior.lastActivity = {
        timestamp: Date.now(),
        geo: currentGeo
      };
    }

    // Limit stored data
    if (behavior.normalIPs.size > 100) {
      behavior.normalIPs.clear();
    }

    return result;
  }

  /**
   * Detect attack patterns in request
   */
  detectAttackPatterns(req) {
    const result = { score: 0, threats: [] };
    
    // Build request string for analysis
    const requestString = JSON.stringify({
      url: req.originalUrl,
      body: req.body,
      query: req.query,
      headers: req.headers
    });

    // Check against known attack patterns
    for (const attackPattern of this.knownAttackPatterns) {
      if (attackPattern.pattern.test(requestString)) {
        result.score += attackPattern.score;
        result.threats.push({
          type: attackPattern.type,
          severity: attackPattern.score > 30 ? 'HIGH' : 'MEDIUM',
          pattern: attackPattern.pattern.source
        });
      }
    }

    // Check for suspicious parameter names
    const suspiciousParams = ['__proto__', 'constructor', 'prototype', '$where'];
    const allParams = { ...req.query, ...req.body };
    
    for (const param of Object.keys(allParams)) {
      if (suspiciousParams.includes(param)) {
        result.score += 20;
        result.threats.push({
          type: 'SUSPICIOUS_PARAMETER',
          severity: 'MEDIUM',
          parameter: param
        });
      }
    }

    return result;
  }

  /**
   * Detect geographic anomalies
   */
  async detectGeographicAnomaly(req) {
    const result = { score: 0, anomaly: null };

    // Wrap geoip lookup in try-catch to handle invalid IP addresses
    let currentGeo;
    try {
      currentGeo = geoip.lookup(req.ip);
    } catch (error) {
      if (process.env.QUIET_LOGS !== 'true') console.log(`Geoip lookup skipped for IP ${req.ip}: ${error.message}`);
      return result;
    }

    if (!currentGeo) return result;

    // Check if country is on high-risk list
    const highRiskCountries = ['KP', 'IR', 'SY', 'CU', 'SD']; // Sanctioned countries
    if (highRiskCountries.includes(currentGeo.country)) {
      result.score = 30;
      result.anomaly = {
        type: 'HIGH_RISK_COUNTRY',
        country: currentGeo.country,
        details: 'Access from high-risk country'
      };
    }

    // For medical system, check if accessing from expected region (Israel)
    const expectedCountries = ['IL', 'US']; // Israel and US for development
    if (!expectedCountries.includes(currentGeo.country)) {
      result.score += 15;
      result.anomaly = {
        type: 'UNEXPECTED_COUNTRY',
        country: currentGeo.country,
        details: `Access from unexpected country: ${currentGeo.country}`
      };
    }

    return result;
  }

  /**
   * Analyze user agent for threats
   */
  analyzeUserAgent(userAgent) {
    const result = { score: 0, threat: null };
    
    if (!userAgent) {
      result.score = 10;
      result.threat = {
        type: 'MISSING_USER_AGENT',
        severity: 'LOW',
        details: 'No user agent provided'
      };
      return result;
    }

    const lowerAgent = userAgent.toLowerCase();
    
    // Check for suspicious agents
    for (const suspicious of this.suspiciousUserAgents) {
      if (lowerAgent.includes(suspicious)) {
        result.score = 25;
        result.threat = {
          type: 'SUSPICIOUS_USER_AGENT',
          severity: 'MEDIUM',
          agent: suspicious,
          details: `Suspicious tool detected: ${suspicious}`
        };
        break;
      }
    }

    // Check for bot patterns
    const botPatterns = /bot|crawler|spider|scraper|scan/i;
    if (botPatterns.test(userAgent) && result.score === 0) {
      result.score = 15;
      result.threat = {
        type: 'BOT_DETECTED',
        severity: 'LOW',
        details: 'Automated bot or crawler detected'
      };
    }

    return result;
  }

  /**
   * Analyze request volume and patterns
   */
  analyzeRequestVolume(req) {
    const result = { score: 0, anomaly: null };
    
    const ip = req.ip;
    let history = this.ipHistory.get(ip);
    
    if (!history) {
      history = {
        requests: [],
        failedLogins: 0,
        suspiciousActivities: 0
      };
      this.ipHistory.set(ip, history);
    }

    // Add current request
    history.requests.push({
      timestamp: Date.now(),
      path: req.path,
      method: req.method
    });

    // Keep only recent requests
    history.requests = history.requests.filter(r => 
      Date.now() - r.timestamp < 3600000 // 1 hour
    );

    // Check for request patterns
    const recentRequests = history.requests.filter(r => 
      Date.now() - r.timestamp < 60000 // 1 minute
    );

    // Detect automated scanning
    const uniquePaths = new Set(recentRequests.map(r => r.path));
    if (uniquePaths.size > 20) {
      result.score = 20;
      result.anomaly = {
        type: 'AUTOMATED_SCANNING',
        details: `${uniquePaths.size} different endpoints accessed in 1 minute`
      };
    }

    // Detect rapid-fire requests
    if (recentRequests.length > 100) {
      result.score = 25;
      result.anomaly = {
        type: 'RAPID_FIRE_REQUESTS',
        details: `${recentRequests.length} requests in 1 minute`
      };
    }

    return result;
  }

  /**
   * Generate security recommendations based on analysis
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.riskScore >= 80) {
      recommendations.push({
        action: 'BLOCK_REQUEST',
        reason: 'Very high risk score',
        priority: 'CRITICAL'
      });
    } else if (analysis.riskScore >= 60) {
      recommendations.push({
        action: 'REQUIRE_MFA',
        reason: 'High risk score',
        priority: 'HIGH'
      });
      recommendations.push({
        action: 'LOG_DETAILED',
        reason: 'Suspicious activity detected',
        priority: 'HIGH'
      });
    } else if (analysis.riskScore >= 40) {
      recommendations.push({
        action: 'INCREASE_MONITORING',
        reason: 'Medium risk score',
        priority: 'MEDIUM'
      });
    }

    // Specific recommendations based on threats
    for (const threat of analysis.threats) {
      if (threat.type === 'BLACKLISTED_IP') {
        recommendations.push({
          action: 'BLOCK_IP',
          reason: threat.details,
          priority: 'CRITICAL'
        });
      } else if (threat.type === 'BRUTE_FORCE_ATTEMPT') {
        recommendations.push({
          action: 'LOCK_ACCOUNT',
          reason: threat.details,
          priority: 'HIGH'
        });
      } else if (threat.type.includes('INJECTION')) {
        recommendations.push({
          action: 'SANITIZE_INPUT',
          reason: `${threat.type} detected`,
          priority: 'HIGH'
        });
      }
    }

    // Specific recommendations based on anomalies
    for (const anomaly of analysis.anomalies) {
      if (anomaly.type === 'IMPOSSIBLE_TRAVEL') {
        recommendations.push({
          action: 'VERIFY_IDENTITY',
          reason: anomaly.details,
          priority: 'HIGH'
        });
      } else if (anomaly.type === 'HIGH_RISK_COUNTRY') {
        recommendations.push({
          action: 'ADDITIONAL_VERIFICATION',
          reason: anomaly.details,
          priority: 'MEDIUM'
        });
      }
    }

    return recommendations;
  }

  /**
   * Log high-risk request for audit
   */
  async logHighRiskRequest(req, analysis) {
    const logEntry = {
      timestamp: new Date(),
      requestId: analysis.requestId,
      userId: req.user?._id,
      ip: req.ip,
      path: req.path,
      method: req.method,
      riskScore: analysis.riskScore,
      threats: analysis.threats,
      anomalies: analysis.anomalies,
      recommendations: analysis.recommendations
    };

    console.error('🚨 HIGH RISK REQUEST DETECTED:', logEntry);

    // In production, this would:
    // - Send to SIEM system
    // - Trigger alerts
    // - Store in security database
    // - Notify security team

    // Add IP to temporary blacklist if score is very high
    if (analysis.riskScore >= 90) {
      this.blacklistedIPs.add(req.ip);
      
      // Auto-remove from blacklist after 1 hour
      setTimeout(() => {
        this.blacklistedIPs.delete(req.ip);
      }, 3600000);
    }

    return logEntry;
  }

  /**
   * Calculate distance between two geographic points
   */
  calculateDistance(geo1, geo2) {
    if (!geo1 || !geo2) return 0;
    
    const R = 6371; // Earth's radius in km
    const lat1 = geo1.ll[0] * Math.PI / 180;
    const lat2 = geo2.ll[0] * Math.PI / 180;
    const deltaLat = (geo2.ll[0] - geo1.ll[0]) * Math.PI / 180;
    const deltaLon = (geo2.ll[1] - geo1.ll[1]) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in km
  }

  /**
   * Check if IP is from anonymous network
   */
  isAnonymousIP(geoData) {
    // This would integrate with IP reputation services
    // For now, basic check based on known VPN/proxy ranges
    const anonymousRanges = [
      '10.', // Private network
      '172.16.', // Private network
      '192.168.', // Private network
    ];

    // Check if it's a known VPN provider (simplified)
    // In production, use IP reputation API
    return false;
  }

  /**
   * Update threat intelligence
   */
  async updateThreatIntelligence() {
    try {
      // In production, this would fetch from:
      // - Threat intelligence feeds
      // - IP reputation services
      // - Known attacker databases
      // - Security community feeds
      
      console.log('📡 Threat intelligence updated');
    } catch (error) {
      console.error('❌ Failed to update threat intelligence:', error);
    }
  }

  /**
   * Get current threat level
   */
  getThreatLevel() {
    const totalSuspicious = this.suspiciousPatterns.size;
    const blacklistedCount = this.blacklistedIPs.size;
    
    if (totalSuspicious > 100 || blacklistedCount > 50) {
      return { level: 'CRITICAL', color: 'red' };
    } else if (totalSuspicious > 50 || blacklistedCount > 20) {
      return { level: 'HIGH', color: 'orange' };
    } else if (totalSuspicious > 20 || blacklistedCount > 10) {
      return { level: 'MEDIUM', color: 'yellow' };
    } else {
      return { level: 'LOW', color: 'green' };
    }
  }

  /**
   * Get threat statistics
   */
  getStatistics() {
    const stats = {
      threatLevel: this.getThreatLevel(),
      blacklistedIPs: this.blacklistedIPs.size,
      monitoredUsers: this.userBehaviors.size,
      trackedIPs: this.ipHistory.size,
      suspiciousPatterns: this.suspiciousPatterns.size,
      knownAttackPatterns: this.knownAttackPatterns.length,
      timestamp: new Date()
    };

    // Calculate threat distribution
    const threatTypes = {};
    for (const [, patterns] of this.suspiciousPatterns) {
      for (const pattern of patterns) {
        threatTypes[pattern.type] = (threatTypes[pattern.type] || 0) + 1;
      }
    }
    stats.threatDistribution = threatTypes;

    return stats;
  }

  /**
   * Clean up old data
   */
  cleanup() {
    const now = Date.now();
    const oneHour = 3600000;

    // Clean IP history
    for (const [ip, history] of this.ipHistory) {
      history.requests = history.requests.filter(r => 
        now - r.timestamp < oneHour
      );
      
      if (history.requests.length === 0 && history.failedLogins === 0) {
        this.ipHistory.delete(ip);
      }
    }

    // Clean suspicious patterns
    for (const [pattern, occurrences] of this.suspiciousPatterns) {
      const recent = occurrences.filter(o => now - o.timestamp < oneHour);
      if (recent.length === 0) {
        this.suspiciousPatterns.delete(pattern);
      } else {
        this.suspiciousPatterns.set(pattern, recent);
      }
    }

    // Limit behavior profiles
    if (this.userBehaviors.size > this.config.behaviorHistoryLimit) {
      const sortedBehaviors = Array.from(this.userBehaviors.entries())
        .sort((a, b) => (b[1].lastActivity?.timestamp || 0) - (a[1].lastActivity?.timestamp || 0));
      
      this.userBehaviors.clear();
      for (let i = 0; i < this.config.behaviorHistoryLimit; i++) {
        if (sortedBehaviors[i]) {
          this.userBehaviors.set(sortedBehaviors[i][0], sortedBehaviors[i][1]);
        }
      }
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanup() {
    // Clean up every 30 minutes
    setInterval(() => {
      this.cleanup();
    }, 30 * 60 * 1000);

    // Update threat intelligence every hour
    setInterval(() => {
      this.updateThreatIntelligence();
    }, 60 * 60 * 1000);
  }
}

// Create singleton instance
const threatDetectionService = new ThreatDetectionService();

module.exports = threatDetectionService;