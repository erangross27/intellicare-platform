// Communication Audit Service
// Migrated to DDD NX architecture - Communication Context - Audit Feature
// HIPAA compliant audit trail for all patient communications

const crypto = require('crypto');

// Use lazy loading to resolve circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    // For libs/communication/feature-audit/:
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

/**
 * Communication Audit Service for HIPAA Compliance
 * Tracks all patient communication including reminders, SMS, emails
 */
class CommunicationAuditService {
  constructor() {
    this.serviceId = 'communication-audit-service';
    this.serviceToken = null;
    this.initialized = false;
    this.auditCache = new Map();
    this.encryptionKey = null;
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      
      // Get services via lazy loading
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      const secureConfigService = proxy.getService('secureConfigService');
      
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Get encryption key
      this.encryptionKey = secureConfigService.get('AUDIT_ENCRYPTION_KEY') || 
                          secureConfigService.get('ENCRYPTION_KEY');
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      };
      
      const secureDataAccess = proxy.getService('secureDataAccess');
      
      await secureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'communicationAuditService',
        timestamp: new Date()
      }, context);
      
      console.log('✅ CommunicationAuditService initialized');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize CommunicationAuditService:', error);
      throw error;
    }
  }

  /**
   * Record a communication event for audit
   */
  async recordCommunication(practiceId, communicationData) {
    if (!this.initialized) await this.initialize();

    try {
      const auditEntry = {
        _id: crypto.randomBytes(12).toString('hex'),
        timestamp: new Date(),
        practiceId: practiceId,
        type: communicationData.type, // 'email', 'sms', 'reminder', 'appointment_reminder'
        category: communicationData.category || 'patient_communication',
        
        // Patient Information (encrypted)
        patientId: communicationData.patientId,
        patientName: this.encryptPHI(communicationData.patientName),
        patientEmail: this.encryptPHI(communicationData.patientEmail),
        patientPhone: this.encryptPHI(communicationData.patientPhone),
        
        // Communication Details
        communicationMethod: communicationData.method, // 'email', 'sms', 'push', 'phone'
        subject: communicationData.subject,
        messageContent: this.encryptPHI(communicationData.message),
        messageHash: this.hashMessage(communicationData.message),
        
        // Delivery Information
        deliveryStatus: communicationData.deliveryStatus || 'pending',
        deliveredAt: communicationData.deliveredAt,
        readAt: communicationData.readAt,
        responseAt: communicationData.responseAt,
        
        // Sender Information
        senderId: communicationData.senderId,
        senderName: communicationData.senderName,
        senderRole: communicationData.senderRole,
        
        // System Information
        ipAddress: this.encryptPHI(communicationData.ipAddress),
        userAgent: communicationData.userAgent,
        platform: communicationData.platform,
        
        // Compliance Information
        consentStatus: communicationData.consentStatus || 'verified',
        retentionPolicy: communicationData.retentionPolicy || 'standard',
        dataClassification: this.classifyDataSensitivity(communicationData.message),
        
        // Metadata
        messageSize: communicationData.message ? communicationData.message.length : 0,
        attachmentCount: communicationData.attachments ? communicationData.attachments.length : 0,
        priority: communicationData.priority || 'normal',
        
        // Audit Trail
        auditVersion: '1.0',
        created: new Date(),
        lastModified: new Date()
      };

      const context = {
        serviceId: this.serviceId,
        operation: 'record-communication',
        practiceId: practiceId
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      
      await secureDataAccess.create('communication_audit', auditEntry, context);
      
      // Cache recent audit entries for quick lookup
      this.auditCache.set(auditEntry._id, auditEntry);
      
      return auditEntry._id;
    } catch (error) {
      console.error('Failed to record communication:', error);
      throw error;
    }
  }

  /**
   * Update communication delivery status
   */
  async updateDeliveryStatus(auditId, deliveryData) {
    if (!this.initialized) await this.initialize();

    try {
      const updateData = {
        deliveryStatus: deliveryData.status,
        deliveredAt: deliveryData.deliveredAt || new Date(),
        deliveryAttempts: deliveryData.attempts || 1,
        deliveryError: deliveryData.error,
        lastModified: new Date()
      };

      if (deliveryData.readAt) {
        updateData.readAt = deliveryData.readAt;
      }

      if (deliveryData.responseAt) {
        updateData.responseAt = deliveryData.responseAt;
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'update-delivery-status',
        practiceId: deliveryData.practiceId
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      
      await secureDataAccess.update(
        'communication_audit',
        { _id: auditId },
        updateData,
        context
      );

      // Update cache
      if (this.auditCache.has(auditId)) {
        const cached = this.auditCache.get(auditId);
        this.auditCache.set(auditId, { ...cached, ...updateData });
      }

      return true;
    } catch (error) {
      console.error('Failed to update delivery status:', error);
      throw error;
    }
  }

  /**
   * Get audit trail for a patient
   */
  async getPatientCommunicationHistory(patientId, practiceId, options = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const {
        startDate,
        endDate,
        communicationType,
        limit = 100,
        includeContent = false
      } = options;

      const filter = {
        patientId: patientId,
        practiceId: practiceId
      };

      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate) filter.timestamp.$lte = new Date(endDate);
      }

      if (communicationType) {
        filter.type = communicationType;
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'get-patient-history',
        practiceId: practiceId
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      
      const auditRecords = await secureDataAccess.query(
        'communication_audit',
        filter,
        { 
          sort: { timestamp: -1 },
          limit: limit 
        },
        context
      );

      // Decrypt sensitive information for authorized viewing
      const processedRecords = auditRecords.map(record => ({
        id: record._id,
        timestamp: record.timestamp,
        type: record.type,
        category: record.category,
        method: record.communicationMethod,
        subject: record.subject,
        deliveryStatus: record.deliveryStatus,
        deliveredAt: record.deliveredAt,
        readAt: record.readAt,
        responseAt: record.responseAt,
        senderName: record.senderName,
        senderRole: record.senderRole,
        priority: record.priority,
        messageSize: record.messageSize,
        attachmentCount: record.attachmentCount,
        consentStatus: record.consentStatus,
        dataClassification: record.dataClassification,
        
        // Only include decrypted content if explicitly requested and authorized
        patientName: includeContent ? this.decryptPHI(record.patientName) : '[ENCRYPTED]',
        patientEmail: includeContent ? this.decryptPHI(record.patientEmail) : '[ENCRYPTED]',
        patientPhone: includeContent ? this.decryptPHI(record.patientPhone) : '[ENCRYPTED]',
        messageContent: includeContent ? this.decryptPHI(record.messageContent) : '[ENCRYPTED]',
      }));

      return {
        success: true,
        records: processedRecords,
        total: processedRecords.length,
        patientId: patientId,
        practiceId: practiceId,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Failed to get patient communication history:', error);
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(practiceId, reportParams = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate = new Date(),
        reportType = 'summary'
      } = reportParams;

      const context = {
        serviceId: this.serviceId,
        operation: 'generate-compliance-report',
        practiceId: practiceId
      };

      // Get all communications in date range
      const communications = await secureDataAccess.query(
        'communication_audit',
        {
          practiceId: practiceId,
          timestamp: { $gte: startDate, $lte: endDate }
        },
        {},
        context
      );

      // Calculate metrics
      const metrics = {
        totalCommunications: communications.length,
        communicationsByType: this.groupByField(communications, 'type'),
        communicationsByMethod: this.groupByField(communications, 'communicationMethod'),
        deliveryStatusBreakdown: this.groupByField(communications, 'deliveryStatus'),
        dataClassificationBreakdown: this.groupByField(communications, 'dataClassification'),
        consentStatusBreakdown: this.groupByField(communications, 'consentStatus'),
        
        // Delivery metrics
        successfulDeliveries: communications.filter(c => c.deliveryStatus === 'delivered').length,
        failedDeliveries: communications.filter(c => c.deliveryStatus === 'failed').length,
        pendingDeliveries: communications.filter(c => c.deliveryStatus === 'pending').length,
        
        // Response metrics
        communicationsWithResponse: communications.filter(c => c.responseAt).length,
        averageResponseTime: this.calculateAverageResponseTime(communications),
        
        // Compliance metrics
        highSensitivityCommunications: communications.filter(c => c.dataClassification === 'high').length,
        communicationsWithoutConsent: communications.filter(c => c.consentStatus !== 'verified').length,
        
        // Temporal analysis
        communicationsByDay: this.groupByDay(communications, startDate, endDate),
        peakCommunicationHours: this.analyzeTimePatterns(communications)
      };

      const report = {
        practiceId: practiceId,
        reportType: reportType,
        dateRange: { startDate, endDate },
        generatedAt: new Date(),
        metrics: metrics,
        
        // Compliance summary
        complianceScore: this.calculateComplianceScore(metrics),
        recommendations: this.generateComplianceRecommendations(metrics),
        
        // Risk assessment
        riskFactors: this.identifyRiskFactors(metrics),
        
        // Action items
        actionItems: this.generateActionItems(metrics)
      };

      // Store report for future reference
      await secureDataAccess.create('compliance_reports', {
        ...report,
        reportId: crypto.randomBytes(16).toString('hex')
      }, context);

      return report;
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  /**
   * Search audit logs
   */
  async searchAuditLogs(practiceId, searchCriteria = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const {
        patientId,
        communicationType,
        deliveryStatus,
        startDate,
        endDate,
        searchText,
        limit = 50,
        offset = 0
      } = searchCriteria;

      const filter = { practiceId: practiceId };

      if (patientId) filter.patientId = patientId;
      if (communicationType) filter.type = communicationType;
      if (deliveryStatus) filter.deliveryStatus = deliveryStatus;
      
      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate) filter.timestamp.$lte = new Date(endDate);
      }

      if (searchText) {
        filter.$text = { $search: searchText };
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'search-audit-logs',
        practiceId: practiceId
      };

      const results = await secureDataAccess.query(
        'communication_audit',
        filter,
        {
          sort: { timestamp: -1 },
          limit: limit,
          skip: offset
        },
        context
      );

      return {
        success: true,
        results: results.map(r => this.sanitizeAuditRecord(r)),
        total: results.length,
        searchCriteria: searchCriteria,
        searchedAt: new Date()
      };
    } catch (error) {
      console.error('Failed to search audit logs:', error);
      throw error;
    }
  }

  // Utility methods
  encryptPHI(data) {
    if (!data || !this.encryptionKey) return data;
    
    try {
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      let encrypted = cipher.update(data.toString(), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      console.error('Encryption failed:', error);
      return '[ENCRYPTION_FAILED]';
    }
  }

  decryptPHI(encryptedData) {
    if (!encryptedData || !this.encryptionKey || encryptedData === '[ENCRYPTION_FAILED]') {
      return encryptedData;
    }
    
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[DECRYPTION_FAILED]';
    }
  }

  hashMessage(message) {
    if (!message) return null;
    return crypto.createHash('sha256').update(message).digest('hex');
  }

  classifyDataSensitivity(message) {
    if (!message) return 'low';
    
    const sensitiveTerms = [
      'diagnosis', 'medication', 'prescription', 'treatment', 'condition',
      'symptoms', 'medical', 'health', 'insurance', 'social security',
      'ssn', 'dob', 'birth', 'address'
    ];
    
    const messageLower = message.toLowerCase();
    const sensitiveCount = sensitiveTerms.filter(term => messageLower.includes(term)).length;
    
    if (sensitiveCount >= 3) return 'high';
    if (sensitiveCount >= 1) return 'medium';
    return 'low';
  }

  groupByField(data, field) {
    return data.reduce((acc, item) => {
      const key = item[field] || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  calculateAverageResponseTime(communications) {
    const responseTimes = communications
      .filter(c => c.responseAt && c.timestamp)
      .map(c => new Date(c.responseAt) - new Date(c.timestamp));
    
    if (responseTimes.length === 0) return 0;
    
    const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    return Math.round(average / (1000 * 60 * 60)); // hours
  }

  groupByDay(communications, startDate, endDate) {
    const dailyStats = {};
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyStats[dateKey] = communications.filter(c => 
        new Date(c.timestamp).toISOString().split('T')[0] === dateKey
      ).length;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dailyStats;
  }

  analyzeTimePatterns(communications) {
    const hourlyStats = {};
    
    communications.forEach(c => {
      const hour = new Date(c.timestamp).getHours();
      hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
    });
    
    return Object.entries(hourlyStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }));
  }

  calculateComplianceScore(metrics) {
    let score = 100;
    
    // Deduct points for compliance issues
    if (metrics.communicationsWithoutConsent > 0) {
      score -= (metrics.communicationsWithoutConsent / metrics.totalCommunications) * 30;
    }
    
    if (metrics.failedDeliveries > metrics.totalCommunications * 0.1) {
      score -= 10; // High failure rate
    }
    
    return Math.max(0, Math.round(score));
  }

  generateComplianceRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.communicationsWithoutConsent > 0) {
      recommendations.push({
        type: 'consent_management',
        priority: 'high',
        description: `${metrics.communicationsWithoutConsent} communications sent without verified consent`
      });
    }
    
    if (metrics.failedDeliveries > metrics.totalCommunications * 0.05) {
      recommendations.push({
        type: 'delivery_optimization',
        priority: 'medium',
        description: `High failure rate: ${(metrics.failedDeliveries / metrics.totalCommunications * 100).toFixed(1)}%`
      });
    }
    
    return recommendations;
  }

  identifyRiskFactors(metrics) {
    const risks = [];
    
    if (metrics.highSensitivityCommunications > metrics.totalCommunications * 0.5) {
      risks.push({
        type: 'data_sensitivity',
        level: 'medium',
        description: 'High volume of sensitive communications requires enhanced monitoring'
      });
    }
    
    return risks;
  }

  generateActionItems(metrics) {
    const actions = [];
    
    if (metrics.communicationsWithoutConsent > 0) {
      actions.push({
        action: 'Review consent management process',
        priority: 'high',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week
      });
    }
    
    return actions;
  }

  sanitizeAuditRecord(record) {
    return {
      id: record._id,
      timestamp: record.timestamp,
      type: record.type,
      category: record.category,
      method: record.communicationMethod,
      subject: record.subject,
      deliveryStatus: record.deliveryStatus,
      senderName: record.senderName,
      senderRole: record.senderRole,
      priority: record.priority,
      dataClassification: record.dataClassification,
      consentStatus: record.consentStatus,
      // PHI fields are excluded from sanitized records
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.serviceId,
      initialized: this.initialized,
      auditCacheSize: this.auditCache.size,
      encryptionEnabled: !!this.encryptionKey
    };
  }
}

// Create and export singleton
const communicationAuditService = new CommunicationAuditService();

// Register service with ServiceProxyManager for lazy loading
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('communicationAuditService', () => communicationAuditService);
}

module.exports = communicationAuditService;