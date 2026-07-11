/**
 * 🛡️ VENDOR RISK SERVICE
 * 
 * Comprehensive vendor risk assessment and management system providing
 * security evaluation, compliance monitoring, incident tracking, and
 * continuous risk monitoring for healthcare vendor relationships.
 * 
 * FEATURES: Risk assessment, security incident tracking, compliance monitoring
 * SECURITY: Service authentication and secure data access for all operations
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class VendorRiskService extends EventEmitter {
  constructor() {
    super();
    this.serviceId = 'vendor-risk-service';
    this.serviceToken = null;
    this.initialized = false;
    this.riskThresholds = {
      critical: 40,
      high: 60,
      medium: 80,
      low: 100
    };
    this.assessmentSchedule = {
      CRITICAL: 30,  // days
      HIGH: 90,
      MEDIUM: 180,
      LOW: 365
    };
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      this.initialized = true;
      console.log('✅ Vendor Risk Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Vendor Risk Service:', error);
      throw error;
    }
  }

  async logAuditEvent(action, practiceId, details = {}) {
    try {
      const auditEntry = {
        action,
        service: this.serviceId,
        timestamp: new Date(),
        details
      };

      const context = {
        serviceId: this.serviceId,
        operation: 'audit-logging',
        practiceId
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      await SecureDataAccess.create('audit_logs', auditEntry, context);
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  calculateRiskScore(assessmentData) {
    const scores = {
      security: 0,
      compliance: 0,
      operational: 0,
      dataProtection: 0
    };

    // Security scoring
    if (assessmentData.securityControls) {
      scores.security = assessmentData.securityControls.encryptionInTransit ? 25 : 0;
      scores.security += assessmentData.securityControls.encryptionAtRest ? 25 : 0;
      scores.security += assessmentData.securityControls.accessControls ? 25 : 0;
      scores.security += assessmentData.securityControls.securityCertifications ? 25 : 0;
    }

    // Compliance scoring
    if (assessmentData.compliance) {
      scores.compliance = assessmentData.compliance.hipaaCompliant ? 50 : 0;
      scores.compliance += assessmentData.compliance.gdprCompliant ? 25 : 0;
      scores.compliance += assessmentData.compliance.soc2Certified ? 25 : 0;
    }

    // Operational scoring
    if (assessmentData.operational) {
      scores.operational = assessmentData.operational.serviceUptime ? 30 : 0;
      scores.operational += assessmentData.operational.incidentResponseTime ? 30 : 0;
      scores.operational += assessmentData.operational.businessContinuity ? 40 : 0;
    }

    // Data protection scoring
    if (assessmentData.dataProtection) {
      scores.dataProtection = assessmentData.dataProtection.dataBackup ? 25 : 0;
      scores.dataProtection += assessmentData.dataProtection.dataRetention ? 25 : 0;
      scores.dataProtection += assessmentData.dataProtection.dataDisposal ? 25 : 0;
      scores.dataProtection += assessmentData.dataProtection.dataMinimization ? 25 : 0;
    }

    // Calculate overall score
    const overall = (scores.security + scores.compliance + scores.operational + scores.dataProtection) / 4;

    return {
      ...scores,
      overall: Math.round(overall)
    };
  }

  determineRiskLevel(score) {
    if (score < this.riskThresholds.critical) return 'CRITICAL';
    if (score < this.riskThresholds.high) return 'HIGH';
    if (score < this.riskThresholds.medium) return 'MEDIUM';
    return 'LOW';
  }

  generateAssessmentId(practiceId) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${practiceId}_${timestamp}_${random}`;
  }

  async createAssessment(practiceId, assessmentData, userId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Generate assessment ID
      assessmentData.assessmentId = this.generateAssessmentId(practiceId);
      assessmentData.practiceId = practiceId;
      assessmentData.metadata = {
        createdBy: userId,
        createdAt: new Date(),
        lastModifiedBy: userId,
        lastModifiedAt: new Date(),
        version: 1
      };

      // Calculate risk scores
      const riskScore = this.calculateRiskScore(assessmentData);
      assessmentData.riskScore = riskScore;
      assessmentData.riskLevel = this.determineRiskLevel(riskScore.overall);

      // Set next assessment date based on risk level
      const daysUntilNext = this.assessmentSchedule[assessmentData.riskLevel];
      assessmentData.nextAssessmentDate = new Date(Date.now() + daysUntilNext * 24 * 60 * 60 * 1000);
      assessmentData.status = 'ACTIVE';
      assessmentData.incidents = [];

      const context = {
        serviceId: this.serviceId,
        operation: 'create-risk-assessment',
        practiceId
      };

      // Create assessment in database
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const assessment = await SecureDataAccess.create('vendor_risk_assessments', assessmentData, context);

      // Log audit event
      await this.logAuditEvent('VENDOR_RISK_ASSESSMENT_CREATED', practiceId, {
        vendorId: assessment.vendorId,
        vendorName: assessment.vendorName,
        riskLevel: assessment.riskLevel,
        riskScore: assessment.riskScore.overall,
        performedBy: userId
      });

      // Emit event for high-risk vendors
      if (assessment.riskLevel === 'CRITICAL' || assessment.riskLevel === 'HIGH') {
        this.emit('highRiskVendor', {
          practiceId,
          vendorId: assessment.vendorId,
          vendorName: assessment.vendorName,
          riskLevel: assessment.riskLevel,
          riskScore: assessment.riskScore.overall
        });
      }

      return {
        success: true,
        assessmentId: assessment._id,
        riskLevel: assessment.riskLevel,
        riskScore: assessment.riskScore,
        nextAssessmentDate: assessment.nextAssessmentDate,
        message: {
          en: 'Risk assessment created successfully',
          he: 'הערכת סיכונים נוצרה בהצלחה'
        }
      };
    } catch (error) {
      console.error('Error creating risk assessment:', error);
      return {
        success: false,
        error: {
          en: `Failed to create risk assessment: ${error.message}`,
          he: `נכשל ביצירת הערכת סיכונים: ${error.message}`
        }
      };
    }
  }

  async updateAssessment(practiceId, assessmentId, updates, userId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'update-risk-assessment',
        practiceId
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const assessments = await SecureDataAccess.query('vendor_risk_assessments', 
        { _id: assessmentId, practiceId }, 
        { limit: 1 }, 
        context
      );
      
      const assessment = assessments[0];
      
      if (!assessment) {
        return {
          success: false,
          error: {
            en: 'Risk assessment not found',
            he: 'הערכת סיכונים לא נמצאה'
          }
        };
      }

      // Track changes
      const previousRiskLevel = assessment.riskLevel;
      const previousScore = assessment.riskScore.overall;

      // Apply updates
      Object.assign(assessment, updates);
      
      // Recalculate risk score
      const newScore = this.calculateRiskScore(assessment);
      assessment.riskScore = newScore;
      assessment.riskLevel = this.determineRiskLevel(newScore.overall);

      // Update metadata
      assessment.metadata.lastModifiedBy = userId;
      assessment.metadata.lastModifiedAt = new Date();
      assessment.metadata.version += 1;

      await SecureDataAccess.update('vendor_risk_assessments', 
        { _id: assessment._id }, 
        assessment, 
        context
      );

      // Log significant changes
      if (previousRiskLevel !== assessment.riskLevel) {
        await this.logAuditEvent('VENDOR_RISK_LEVEL_CHANGED', practiceId, {
          vendorId: assessment.vendorId,
          vendorName: assessment.vendorName,
          previousLevel: previousRiskLevel,
          newLevel: assessment.riskLevel,
          previousScore,
          newScore: assessment.riskScore.overall,
          performedBy: userId
        });
      }

      return {
        success: true,
        riskLevel: assessment.riskLevel,
        riskScore: assessment.riskScore,
        message: {
          en: 'Risk assessment updated successfully',
          he: 'הערכת סיכונים עודכנה בהצלחה'
        }
      };
    } catch (error) {
      console.error('Error updating risk assessment:', error);
      return {
        success: false,
        error: {
          en: `Failed to update risk assessment: ${error.message}`,
          he: `נכשל בעדכון הערכת סיכונים: ${error.message}`
        }
      };
    }
  }

  async recordSecurityIncident(practiceId, vendorId, incidentData, userId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'record-security-incident',
        practiceId
      };

      // Get latest assessment
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const assessments = await SecureDataAccess.query('vendor_risk_assessments', { 
        practiceId, 
        vendorId 
      }, { sort: { assessmentDate: -1 }, limit: 1 }, context);
      
      const assessment = assessments[0];

      if (!assessment) {
        return {
          success: false,
          error: {
            en: 'No risk assessment found for vendor',
            he: 'לא נמצאה הערכת סיכונים עבור הספק'
          }
        };
      }

      // Add incident
      const incident = {
        incidentId: crypto.randomUUID(),
        date: new Date(),
        type: incidentData.type,
        severity: incidentData.severity,
        recordsAffected: incidentData.recordsAffected,
        resolutionTime: incidentData.resolutionTime,
        rootCause: incidentData.rootCause,
        preventiveMeasures: incidentData.preventiveMeasures,
        reportedBy: userId
      };

      if (!assessment.incidents) {
        assessment.incidents = [];
      }
      assessment.incidents.push(incident);

      // Recalculate risk score (incidents affect score)
      const previousScore = assessment.riskScore.overall;
      assessment.riskScore.overall = Math.max(0, previousScore - (incidentData.severity === 'CRITICAL' ? 20 : 10));
      
      // Update risk level if needed
      if (incidentData.severity === 'CRITICAL') {
        assessment.riskLevel = 'CRITICAL';
      } else if (incidentData.severity === 'HIGH' && assessment.riskLevel !== 'CRITICAL') {
        assessment.riskLevel = 'HIGH';
      }

      // Update in database
      await SecureDataAccess.update('vendor_risk_assessments', 
        { _id: assessment._id }, 
        assessment, 
        context
      );

      // Log audit event
      await this.logAuditEvent('VENDOR_SECURITY_INCIDENT_RECORDED', practiceId, {
        vendorId,
        vendorName: assessment.vendorName,
        incidentType: incidentData.type,
        severity: incidentData.severity,
        recordsAffected: incidentData.recordsAffected,
        reportedBy: userId
      });

      // Emit event
      this.emit('vendorSecurityIncident', {
        practiceId,
        vendorId,
        vendorName: assessment.vendorName,
        incident: incidentData
      });

      return {
        success: true,
        incidentId: incident.incidentId,
        newRiskLevel: assessment.riskLevel,
        newRiskScore: assessment.riskScore.overall,
        message: {
          en: 'Security incident recorded successfully',
          he: 'אירוע אבטחה תועד בהצלחה'
        }
      };
    } catch (error) {
      console.error('Error recording security incident:', error);
      return {
        success: false,
        error: {
          en: `Failed to record security incident: ${error.message}`,
          he: `נכשל בתיעוד אירוע אבטחה: ${error.message}`
        }
      };
    }
  }

  async getVendorList(params) {
    const { practice: practiceId, filters = {} } = params;
    
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'get-vendor-list',
        practiceId
      };

      // Get all risk assessments
      const assessments = await SecureDataAccess.query('vendor_risk_assessments', { 
        practiceId,
        status: 'ACTIVE'
      }, {}, context);

      // Create assessment map for quick lookup
      const assessmentMap = {};
      assessments.forEach(a => {
        assessmentMap[a.vendorId] = {
          riskScore: a.riskScore?.overall || 0,
          riskLevel: a.riskLevel,
          lastAssessmentDate: a.assessmentDate,
          complianceStatus: a.complianceStatus,
          incidents: a.incidents?.length || 0
        };
      });

      // Get vendor basic information (would normally come from a vendors collection)
      const vendorList = assessments.map(assessment => ({
        id: assessment.vendorId,
        name: assessment.vendorName,
        type: assessment.vendorType || 'Unknown',
        status: assessment.status,
        riskScore: assessmentMap[assessment.vendorId]?.riskScore || 'Not Assessed',
        riskLevel: assessmentMap[assessment.vendorId]?.riskLevel || 'Not Assessed',
        lastAssessmentDate: assessmentMap[assessment.vendorId]?.lastAssessmentDate || null,
        complianceStatus: assessmentMap[assessment.vendorId]?.complianceStatus || 'Unknown',
        incidentCount: assessmentMap[assessment.vendorId]?.incidents || 0,
        services: assessment.services || [],
        contactInfo: assessment.contactInfo
      }));
      
      // Apply filters if provided
      let filteredList = vendorList;
      if (filters.status) {
        filteredList = filteredList.filter(v => v.status === filters.status);
      }
      if (filters.riskLevel) {
        filteredList = filteredList.filter(v => v.riskLevel === filters.riskLevel);
      }
      
      return {
        success: true,
        vendors: filteredList,
        totalCount: filteredList.length,
        message: {
          he: `נמצאו ${filteredList.length} שותפים עסקיים`,
          en: `Found ${filteredList.length} business associates`
        }
      };
    } catch (error) {
      console.error('Error getting vendor list:', error);
      return {
        success: false,
        error: {
          en: `Failed to get vendor list: ${error.message}`,
          he: `נכשל בקבלת רשימת ספקים: ${error.message}`
        }
      };
    }
  }

  async getVendorRiskProfile(practiceId, vendorId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'get-vendor-risk-profile',
        practiceId
      };

      // Get latest assessment
      const assessments = await SecureDataAccess.query('vendor_risk_assessments', { 
        practiceId, 
        vendorId,
        status: 'ACTIVE'
      }, { sort: { assessmentDate: -1 }, limit: 1 }, context);

      const assessment = assessments[0];

      if (!assessment) {
        return {
          success: false,
          error: {
            en: 'Vendor risk assessment not found',
            he: 'הערכת סיכוני ספק לא נמצאה'
          }
        };
      }

      // Get assessment history
      const history = await SecureDataAccess.query('vendor_risk_assessments', { 
        practiceId, 
        vendorId
      }, { sort: { assessmentDate: -1 } }, context);

      return {
        success: true,
        profile: {
          vendorId: assessment.vendorId,
          vendorName: assessment.vendorName,
          currentRiskLevel: assessment.riskLevel,
          currentRiskScore: assessment.riskScore,
          lastAssessmentDate: assessment.assessmentDate,
          nextAssessmentDate: assessment.nextAssessmentDate,
          incidents: assessment.incidents || [],
          assessmentHistory: history.map(h => ({
            date: h.assessmentDate,
            riskLevel: h.riskLevel,
            riskScore: h.riskScore.overall,
            version: h.metadata.version
          })),
          complianceStatus: assessment.complianceStatus
        }
      };
    } catch (error) {
      console.error('Error getting vendor risk profile:', error);
      return {
        success: false,
        error: {
          en: `Failed to get vendor risk profile: ${error.message}`,
          he: `נכשל בקבלת פרופיל סיכוני ספק: ${error.message}`
        }
      };
    }
  }

  async getDashboardData(practiceId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'get-dashboard-data',
        practiceId
      };

      const assessments = await SecureDataAccess.query('vendor_risk_assessments', { 
        practiceId,
        status: 'ACTIVE'
      }, {}, context);

      const riskDistribution = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0
      };

      let totalIncidents = 0;
      const recentIncidents = [];

      assessments.forEach(assessment => {
        riskDistribution[assessment.riskLevel]++;
        
        if (assessment.incidents) {
          totalIncidents += assessment.incidents.length;
          assessment.incidents.forEach(incident => {
            if (incident.date > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
              recentIncidents.push({
                vendorName: assessment.vendorName,
                ...incident
              });
            }
          });
        }
      });

      return {
        success: true,
        dashboard: {
          totalVendors: assessments.length,
          riskDistribution,
          totalIncidents,
          recentIncidents: recentIncidents.slice(0, 10),
          averageRiskScore: assessments.length > 0 
            ? Math.round(assessments.reduce((sum, a) => sum + a.riskScore.overall, 0) / assessments.length)
            : 0
        }
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      return {
        success: false,
        error: {
          en: `Failed to get dashboard data: ${error.message}`,
          he: `נכשל בקבלת נתוני לוח מחוונים: ${error.message}`
        }
      };
    }
  }

  getServiceStatus() {
    return {
      initialized: this.initialized,
      riskThresholds: this.riskThresholds,
      assessmentSchedule: this.assessmentSchedule,
      serviceId: this.serviceId
    };
  }
}

// Create and export singleton
const vendorRiskService = new VendorRiskService();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('vendorRiskService', () => vendorRiskService);
}

module.exports = vendorRiskService;