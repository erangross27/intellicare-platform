// Compliance Audit Service
// Migrated to DDD NX architecture - Compliance & Security Context - Audit Feature
// Comprehensive compliance audit and monitoring service

const crypto = require('crypto');

// Use lazy loading to resolve circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    // For libs/compliance-security/feature-audit/:
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

/**
 * Compliance Audit Service
 * Handles compliance auditing, monitoring, and reporting
 */
class ComplianceAuditService {
  constructor() {
    this.serviceId = 'compliance-audit-service';
    this.serviceToken = null;
    this.initialized = false;
    
    // Compliance frameworks
    this.frameworks = {
      HIPAA: 'Health Insurance Portability and Accountability Act',
      GDPR: 'General Data Protection Regulation',
      SOC2: 'Service Organization Control 2',
      HITECH: 'Health Information Technology for Economic and Clinical Health Act',
      FDA: 'Food and Drug Administration Regulations'
    };
    
    // Audit event types
    this.auditEventTypes = {
      ACCESS_GRANTED: 'access_granted',
      ACCESS_DENIED: 'access_denied',
      DATA_ACCESSED: 'data_accessed',
      DATA_MODIFIED: 'data_modified',
      DATA_EXPORTED: 'data_exported',
      BREACH_DETECTED: 'breach_detected',
      POLICY_VIOLATION: 'policy_violation',
      SYSTEM_CHANGE: 'system_change'
    };
  }
  
  // Helper method for lazy service access
  getServices() {
    const proxy = getServiceProxy();
    return {
      secureDataAccess: proxy.getService('secureDataAccess'),
      encryptionService: proxy.getService('encryptionService')
    };
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      
      // Get services via lazy loading
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      };
      
      await SecureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'complianceAuditService',
        timestamp: new Date()
      }, context);
      
      console.log('✅ ComplianceAuditService initialized');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize ComplianceAuditService:', error);
      throw error;
    }
  }

  /**
   * Record compliance audit event
   */
  async recordAuditEvent(eventData, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const auditEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        practiceId: practiceContext.practiceId || 'global',
        
        // Event classification
        eventType: eventData.eventType,
        category: eventData.category || 'general',
        severity: eventData.severity || 'medium',
        framework: eventData.framework || 'HIPAA',
        
        // User and system information
        userId: eventData.userId,
        userName: eventData.userName,
        userRole: eventData.userRole,
        sessionId: eventData.sessionId,
        ipAddress: this.hashSensitiveData(eventData.ipAddress),
        userAgent: eventData.userAgent,
        
        // Resource information
        resourceType: eventData.resourceType, // patient, user, system, etc.
        resourceId: eventData.resourceId,
        resourceName: this.encryptSensitiveData(eventData.resourceName),
        
        // Action details
        action: eventData.action,
        actionResult: eventData.actionResult || 'success',
        description: eventData.description,
        
        // Compliance specific
        policyViolated: eventData.policyViolated,
        riskLevel: eventData.riskLevel || 'low',
        requiresNotification: eventData.requiresNotification || false,
        
        // Technical details
        systemComponent: eventData.systemComponent,
        requestMethod: eventData.requestMethod,
        requestUrl: this.sanitizeUrl(eventData.requestUrl),
        responseCode: eventData.responseCode,
        
        // Data classification
        dataClassification: eventData.dataClassification || 'internal',
        phiInvolved: eventData.phiInvolved || false,
        piiInvolved: eventData.piiInvolved || false,
        
        // Metadata
        correlationId: eventData.correlationId,
        parentEventId: eventData.parentEventId,
        additionalData: eventData.additionalData || {},
        
        // Audit trail
        createdAt: new Date(),
        processed: false,
        reviewed: false
      };

      const context = {
        serviceId: this.serviceId,
        operation: 'record-audit-event',
        practiceId: practiceContext.practiceId || 'global'
      };

      await SecureDataAccess.create('compliance_audit_events', auditEvent, context);

      // Check if event requires immediate attention
      if (this.requiresImmediateAttention(auditEvent)) {
        await this.triggerImmediateAlert(auditEvent, practiceContext);
      }

      return {
        success: true,
        eventId: auditEvent.id,
        requiresAttention: this.requiresImmediateAttention(auditEvent)
      };
    } catch (error) {
      console.error('Failed to record audit event:', error);
      throw error;
    }
  }

  /**
   * Conduct compliance audit
   */
  async conductComplianceAudit(auditParams, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const {
        framework = 'HIPAA',
        auditType = 'comprehensive', // comprehensive, focused, followup
        scope = 'full', // full, partial, specific
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
        endDate = new Date()
      } = auditParams;

      const auditId = crypto.randomUUID();
      
      const audit = {
        auditId: auditId,
        framework: framework,
        auditType: auditType,
        scope: scope,
        practiceId: practiceContext.practiceId || 'global',
        startDate: startDate,
        endDate: endDate,
        conductedBy: practiceContext.userId,
        startedAt: new Date(),
        status: 'in_progress'
      };

      const context = {
        serviceId: this.serviceId,
        operation: 'conduct-compliance-audit',
        practiceId: practiceContext.practiceId || 'global'
      };

      // Get audit events in scope
      const auditEvents = await SecureDataAccess.query(
        'compliance_audit_events',
        {
          practiceId: practiceContext.practiceId || 'global',
          framework: framework,
          timestamp: { $gte: startDate, $lte: endDate }
        },
        { sort: { timestamp: -1 } },
        context
      );

      // Analyze compliance
      const analysis = await this.analyzeCompliance(auditEvents, framework, auditParams);
      
      // Generate findings
      const findings = await this.generateAuditFindings(analysis, framework);
      
      // Calculate compliance score
      const complianceScore = this.calculateComplianceScore(findings);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(findings, framework);

      audit.completedAt = new Date();
      audit.status = 'completed';
      audit.results = {
        eventsReviewed: auditEvents.length,
        complianceScore: complianceScore,
        findings: findings,
        recommendations: recommendations,
        analysis: analysis
      };

      // Store completed audit
      await SecureDataAccess.create('compliance_audits', audit, context);

      return {
        success: true,
        auditId: auditId,
        complianceScore: complianceScore,
        findings: findings,
        recommendations: recommendations,
        summary: this.generateAuditSummary(audit)
      };
    } catch (error) {
      console.error('Failed to conduct compliance audit:', error);
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(reportParams, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const {
        reportType = 'quarterly',
        framework = 'all',
        includeRecommendations = true,
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate = new Date()
      } = reportParams;

      const context = {
        serviceId: this.serviceId,
        operation: 'generate-compliance-report',
        practiceId: practiceContext.practiceId || 'global'
      };

      // Get completed audits in period
      const audits = await SecureDataAccess.query(
        'compliance_audits',
        {
          practiceId: practiceContext.practiceId || 'global',
          startedAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        },
        { sort: { startedAt: -1 } },
        context
      );

      // Get audit events for additional analysis
      const auditEvents = await SecureDataAccess.query(
        'compliance_audit_events',
        {
          practiceId: practiceContext.practiceId || 'global',
          timestamp: { $gte: startDate, $lte: endDate }
        },
        {},
        context
      );

      const report = {
        reportId: crypto.randomUUID(),
        reportType: reportType,
        framework: framework,
        practiceId: practiceContext.practiceId || 'global',
        periodStart: startDate,
        periodEnd: endDate,
        generatedAt: new Date(),
        generatedBy: practiceContext.userId,
        
        executiveSummary: this.generateExecutiveSummary(audits, auditEvents),
        complianceMetrics: this.calculateComplianceMetrics(audits, auditEvents),
        auditSummaries: audits.map(audit => this.generateAuditSummary(audit)),
        trendAnalysis: this.analyzeTrends(audits),
        riskAssessment: this.assessRisks(auditEvents),
        actionItems: this.generateActionItems(audits),
        
        recommendations: includeRecommendations ? 
          this.consolidateRecommendations(audits) : null
      };

      // Store report
      await SecureDataAccess.create('compliance_reports', report, context);

      return {
        success: true,
        reportId: report.reportId,
        report: report
      };
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  // Analysis methods
  async analyzeCompliance(auditEvents, framework, auditParams) {
    const analysis = {
      framework: framework,
      totalEvents: auditEvents.length,
      eventsByType: this.groupByField(auditEvents, 'eventType'),
      eventsBySeverity: this.groupByField(auditEvents, 'severity'),
      breachEvents: auditEvents.filter(e => e.eventType === 'breach_detected').length,
      accessViolations: auditEvents.filter(e => e.eventType === 'access_denied').length,
      policyViolations: auditEvents.filter(e => e.policyViolated).length,
      phiAccess: auditEvents.filter(e => e.phiInvolved).length,
      criticalEvents: auditEvents.filter(e => e.severity === 'critical').length
    };

    return analysis;
  }

  async generateAuditFindings(analysis, framework) {
    const findings = [];

    if (analysis.criticalEvents > 0) {
      findings.push({
        type: 'critical_events',
        severity: 'high',
        count: analysis.criticalEvents,
        description: `${analysis.criticalEvents} critical security events detected`,
        framework: framework,
        requiresAction: true
      });
    }

    if (analysis.breachEvents > 0) {
      findings.push({
        type: 'security_breaches',
        severity: 'critical',
        count: analysis.breachEvents,
        description: `${analysis.breachEvents} potential security breaches detected`,
        framework: framework,
        requiresAction: true
      });
    }

    if (analysis.policyViolations > analysis.totalEvents * 0.05) {
      findings.push({
        type: 'policy_violations',
        severity: 'medium',
        count: analysis.policyViolations,
        description: 'High rate of policy violations detected',
        framework: framework,
        requiresAction: true
      });
    }

    return findings;
  }

  calculateComplianceScore(findings) {
    let score = 100;

    findings.forEach(finding => {
      switch (finding.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 1;
          break;
      }
    });

    return Math.max(0, score);
  }

  async generateRecommendations(findings, framework) {
    const recommendations = [];

    findings.forEach(finding => {
      if (finding.type === 'security_breaches') {
        recommendations.push({
          priority: 'critical',
          category: 'security',
          title: 'Address Security Breaches',
          description: 'Immediate investigation and remediation of security breaches required',
          framework: framework
        });
      }

      if (finding.type === 'policy_violations') {
        recommendations.push({
          priority: 'high',
          category: 'training',
          title: 'Enhance Staff Training',
          description: 'Additional training on compliance policies and procedures',
          framework: framework
        });
      }
    });

    return recommendations;
  }

  // Utility methods
  encryptSensitiveData(data) {
    if (!data) return data;
    try {
      return encryptionService.encrypt(data, 'audit');
    } catch (error) {
      return '[ENCRYPTED]';
    }
  }

  hashSensitiveData(data) {
    if (!data) return data;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  sanitizeUrl(url) {
    if (!url) return url;
    // Remove sensitive query parameters
    return url.split('?')[0];
  }

  requiresImmediateAttention(auditEvent) {
    return auditEvent.severity === 'critical' || 
           auditEvent.eventType === 'breach_detected' ||
           auditEvent.requiresNotification;
  }

  async triggerImmediateAlert(auditEvent, practiceContext) {
    // Implementation would send immediate alerts to compliance team
    console.log(`🚨 IMMEDIATE ATTENTION REQUIRED: ${auditEvent.eventType} - ${auditEvent.description}`);
  }

  groupByField(data, field) {
    return data.reduce((acc, item) => {
      const key = item[field] || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  generateExecutiveSummary(audits, auditEvents) {
    return {
      totalAudits: audits.length,
      totalEvents: auditEvents.length,
      averageComplianceScore: audits.length > 0 ? 
        audits.reduce((sum, a) => sum + (a.results?.complianceScore || 0), 0) / audits.length : 0,
      criticalFindings: audits.reduce((sum, a) => 
        sum + (a.results?.findings?.filter(f => f.severity === 'critical').length || 0), 0)
    };
  }

  calculateComplianceMetrics(audits, auditEvents) {
    return {
      complianceRate: audits.filter(a => (a.results?.complianceScore || 0) >= 80).length / audits.length * 100,
      averageScore: audits.length > 0 ? 
        audits.reduce((sum, a) => sum + (a.results?.complianceScore || 0), 0) / audits.length : 0,
      incidentRate: auditEvents.filter(e => e.severity === 'critical').length / auditEvents.length * 100
    };
  }

  generateAuditSummary(audit) {
    return {
      auditId: audit.auditId,
      framework: audit.framework,
      startedAt: audit.startedAt,
      completedAt: audit.completedAt,
      complianceScore: audit.results?.complianceScore,
      findingsCount: audit.results?.findings?.length || 0,
      recommendationsCount: audit.results?.recommendations?.length || 0
    };
  }

  analyzeTrends(audits) {
    // Simple trend analysis
    const scoresByMonth = {};
    audits.forEach(audit => {
      const month = new Date(audit.startedAt).toISOString().substr(0, 7);
      if (!scoresByMonth[month]) {
        scoresByMonth[month] = [];
      }
      scoresByMonth[month].push(audit.results?.complianceScore || 0);
    });

    return scoresByMonth;
  }

  assessRisks(auditEvents) {
    const risks = [];
    
    const criticalEvents = auditEvents.filter(e => e.severity === 'critical').length;
    if (criticalEvents > 0) {
      risks.push({
        type: 'security',
        level: 'high',
        description: `${criticalEvents} critical security events require attention`
      });
    }

    return risks;
  }

  generateActionItems(audits) {
    const actionItems = [];
    
    audits.forEach(audit => {
      if (audit.results?.findings) {
        audit.results.findings.forEach(finding => {
          if (finding.requiresAction) {
            actionItems.push({
              priority: finding.severity,
              description: finding.description,
              auditId: audit.auditId,
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            });
          }
        });
      }
    });

    return actionItems;
  }

  consolidateRecommendations(audits) {
    const allRecommendations = [];
    audits.forEach(audit => {
      if (audit.results?.recommendations) {
        allRecommendations.push(...audit.results.recommendations);
      }
    });

    // Group similar recommendations
    const consolidated = {};
    allRecommendations.forEach(rec => {
      const key = `${rec.category}-${rec.title}`;
      if (!consolidated[key]) {
        consolidated[key] = { ...rec, count: 0 };
      }
      consolidated[key].count++;
    });

    return Object.values(consolidated);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.serviceId,
      initialized: this.initialized,
      frameworksSupported: Object.keys(this.frameworks).length,
      auditEventTypes: Object.keys(this.auditEventTypes).length
    };
  }
}

// Create and export singleton
const complianceAuditService = new ComplianceAuditService();

// Register service with ServiceProxyManager for lazy loading
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('complianceAuditService', () => complianceAuditService);
}

module.exports = complianceAuditService;