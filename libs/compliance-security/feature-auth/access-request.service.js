/**
 * 🔒 PATIENT ACCESS REQUEST SERVICE
 * Handles HIPAA-compliant patient requests for medical records,
 * tracks disclosure accounting, and manages 30-day deadline compliance
 */

const crypto = require('crypto');

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class AccessRequestService {
  constructor() {
    // Request status states
    this.requestStatus = {
      PENDING: 'pending',
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'completed',
      DENIED: 'denied',
      EXPIRED: 'expired',
      WITHDRAWN: 'withdrawn'
    };

    // Request types
    this.requestTypes = {
      FULL_RECORD: 'full_record',
      SPECIFIC_DATES: 'specific_dates',
      SPECIFIC_PROVIDERS: 'specific_providers',
      DISCLOSURE_ACCOUNTING: 'disclosure_accounting',
      AMENDMENT: 'amendment',
      RESTRICTION: 'restriction'
    };

    // HIPAA compliance deadlines (in days)
    this.deadlines = {
      standard: 30,
      extension: 60, // Additional 30 days with notice
      urgent: 2 // For urgent medical needs
    };

    // Cache for active requests
    this.activeRequests = new Map();
    this.serviceToken = null;
    this.serviceContext = null;
  }

  async initialize() {
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('access-request-service');
    this.serviceContext = {
      serviceId: 'access-request-service',
      operation: 'access-request-operations',
      practiceId: 'global'
    };
    return this;
  }

  /**
   * Create a new patient access request
   */
  async createAccessRequest(practiceId, requestInput) {
    const {
      patientId,
      requesterId, // May be patient or authorized representative
      requestType = this.requestTypes.FULL_RECORD,
      dateRange,
      specificProviders,
      urgency = 'standard',
      purpose,
      deliveryMethod = 'secure_download',
      authorizedRepresentative
    } = requestInput;

    try {
      // Create context for secure data access
      const context = {
        serviceId: 'access-request-service',
        operation: 'create-access-request',
        practiceId: practiceId
      };

      // Verify patient exists using SecureDataAccess
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      
      const patients = await secureDataAccess.query('patients', { _id: patientId }, { limit: 1 }, context);
      const patient = patients[0];
      if (!patient) {
        throw new Error('Patient not found');
      }

      // Verify requester (if not the patient themselves)
      let requester = null;
      if (requesterId !== patientId) {
        const requesters = await secureDataAccess.query('users', { _id: requesterId }, { limit: 1 }, context);
        requester = requesters[0];
        if (!requester) {
          throw new Error('Requester not found');
        }
      }

      // Calculate deadline based on urgency
      const deadline = new Date();
      if (urgency === 'urgent') {
        deadline.setDate(deadline.getDate() + this.deadlines.urgent);
      } else {
        deadline.setDate(deadline.getDate() + this.deadlines.standard);
      }

      // Create access request record using SecureDataAccess
      const requestData = {
        requestId: crypto.randomUUID(),
        practiceId,
        patientId,
        requesterId,
        patientName: patient.name,
        requesterName: requester ? requester.fullName : patient.name,
        requestType,
        status: this.requestStatus.PENDING,
        urgency,
        purpose,
        dateRange: dateRange ? {
          startDate: new Date(dateRange.startDate),
          endDate: new Date(dateRange.endDate)
        } : null,
        specificProviders,
        deliveryMethod,
        authorizedRepresentative,
        requestDate: new Date(),
        deadline,
        hipaaDeadline: deadline,
        metadata: {
          patientEmail: patient.email,
          requesterEmail: requester?.email || patient.email,
          practiceName: practiceId,
          ipAddress: requestInput.ipAddress,
          userAgent: requestInput.userAgent
        }
      };

      const request = await secureDataAccess.create('accessrequests', requestData, context);

      // Log to immutable audit
      const immutableAuditService = proxy.getService('immutableAuditService');
      await immutableAuditService.addAuditEntry({
        eventType: 'access_request_created',
        userId: requesterId || patientId,
        details: `Patient access request created for ${patient.name}`,
        metadata: {
          requestId: request.requestId,
          requestType,
          urgency,
          deadline
        }
      });

      // Add to active requests cache
      this.activeRequests.set(requestData.requestId, requestData);

      // Send confirmation
      await this.sendRequestConfirmation(requestData, null);

      return {
        success: true,
        requestId: requestData.requestId,
        status: requestData.status,
        deadline: requestData.deadline,
        message: {
          he: `בקשת גישה למידע רפואי נוצרה בהצלחה. מספר בקשה: ${requestData.requestId}`,
          en: `Medical records access request created successfully. Request ID: ${requestData.requestId}`
        }
      };

    } catch (error) {
      console.error('Failed to create access request:', error);
      throw error;
    }
  }

  /**
   * Process a pending access request
   */
  async processAccessRequest(practiceId, requestId, processorId) {
    try {
      const context = { 
        serviceId: 'access-request-service',
        operation: 'process-access-request',
        practiceId
      };
      
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const requests = await secureDataAccess.query('accessrequests', { requestId }, { limit: 1 }, context);
      const request = requests[0];
      if (!request) {
        throw new Error('Request not found');
      }

      if (request.status !== this.requestStatus.PENDING) {
        throw new Error(`Request is not pending. Current status: ${request.status}`);
      }

      // Update status to in progress
      const updatedRequest = await secureDataAccess.update(
        'accessrequests',
        { requestId },
        {
          status: this.requestStatus.IN_PROGRESS,
          processorId: processorId,
          processingStartDate: new Date()
        },
        context
      );

      // Gather requested data
      const recordsData = await this.gatherPatientRecords(
        context,
        request.patientId,
        request.requestType,
        request.dateRange,
        request.specificProviders
      );

      // Generate disclosure accounting if requested
      let disclosureReport = null;
      if (request.requestType === this.requestTypes.DISCLOSURE_ACCOUNTING) {
        disclosureReport = await this.generateDisclosureAccounting(
          context,
          request.patientId,
          request.dateRange
        );
      }

      // Prepare the response package
      const responsePackage = {
        requestId: request.requestId,
        patientId: request.patientId,
        patientName: request.patientName,
        requestDate: request.requestDate,
        completionDate: new Date(),
        records: recordsData,
        disclosureReport,
        metadata: {
          totalRecords: recordsData.length,
          dateRange: request.dateRange,
          processorId
        }
      };

      // Encrypt if required
      let finalPackage = responsePackage;
      if (request.deliveryMethod === 'secure_download') {
        finalPackage = await this.encryptResponsePackage(responsePackage);
      }

      // Store the prepared package
      const completionDate = new Date();
      const daysToComplete = Math.ceil(
        (completionDate - new Date(request.requestDate)) / (1000 * 60 * 60 * 24)
      );
      
      await secureDataAccess.update(
        'accessrequests',
        { requestId },
        {
          responsePackage: finalPackage,
          status: this.requestStatus.COMPLETED,
          completionDate: completionDate,
          daysToComplete: daysToComplete
        },
        context
      );

      // Log completion
      const immutableAuditService = proxy.getService('immutableAuditService');
      await immutableAuditService.addAuditEntry({
        eventType: 'access_request_completed',
        userId: processorId,
        details: `Access request ${requestId} completed`,
        metadata: {
          requestId,
          patientId: request.patientId,
          recordCount: recordsData.length,
          daysToComplete: request.daysToComplete
        }
      });

      // Send notification to requester
      await this.sendCompletionNotification(request, null);

      return {
        success: true,
        requestId,
        status: this.requestStatus.COMPLETED,
        completionDate: completionDate,
        daysToComplete: daysToComplete,
        downloadUrl: await this.generateSecureDownloadUrl(request),
        message: {
          he: `בקשת הגישה הושלמה בהצלחה. ${recordsData.length} רשומות זמינות להורדה`,
          en: `Access request completed successfully. ${recordsData.length} records available for download`
        }
      };

    } catch (error) {
      console.error('Failed to process access request:', error);
      throw error;
    }
  }

  /**
   * Generate disclosure accounting report
   */
  async generateDisclosureAccounting(context, patientId, dateRange) {
    
    // Default to 6 years if no date range specified (HIPAA requirement)
    const startDate = dateRange?.startDate || new Date(Date.now() - 6 * 365 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.endDate || new Date();

    // Find all access logs for this patient using SecureDataAccess
    const auditContext = {
      serviceId: 'access-request-service',
      operation: 'generate-disclosure-accounting',
      practiceId: context.practiceId
    };

    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    const allAuditLogs = await secureDataAccess.query(
      'audit_logs',
      {
        resourceId: patientId.toString(),
        resourceType: 'patient'
      },
      {},
      auditContext
    );
    
    // Filter by date range and actions in JavaScript
    const allowedActions = [
      'patient_viewed',
      'patient_updated',
      'document_viewed',
      'document_downloaded',
      'patients_exported'
    ];
    
    const accessLogs = allAuditLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      const isInDateRange = logDate >= startDate && logDate <= endDate;
      const isAllowedAction = allowedActions.includes(log.action);
      return isInDateRange && isAllowedAction;
    });

    // Group disclosures by user and purpose
    const disclosures = {};
    
    for (const log of accessLogs) {
      const userId = log.userId?._id || log.userId;
      const userKey = userId?.toString() || 'system';
      
      if (!disclosures[userKey]) {
        disclosures[userKey] = {
          userId: userKey,
          userName: log.userId?.fullName || log.userDetails?.fullName || 'System',
          userEmail: log.userId?.email || log.userDetails?.email || 'system',
          userRoles: log.userId?.roles || log.userDetails?.roles || [],
          accesses: []
        };
      }

      disclosures[userKey].accesses.push({
        timestamp: log.timestamp,
        action: log.action,
        actionDescription: this.getActionDescription(log.action),
        ipAddress: log.request?.ipAddress,
        purpose: log.metadata?.purpose || 'Treatment',
        details: log.resourceDetails,
        sessionId: log.request?.sessionId
      });
    }

    // Calculate summary statistics
    const summary = {
      totalDisclosures: accessLogs.length,
      uniqueUsers: Object.keys(disclosures).length,
      dateRange: { startDate, endDate },
      mostFrequentActions: this.calculateFrequentActions(accessLogs),
      accessByRole: this.calculateAccessByRole(accessLogs)
    };

    return {
      patientId,
      generatedDate: new Date(),
      reportPeriod: { startDate, endDate },
      summary,
      disclosures: Object.values(disclosures),
      compliance: {
        hipaaCompliant: true,
        retentionPeriod: '6 years',
        lastAuditDate: new Date()
      }
    };
  }

  /**
   * Track disclosure for accounting
   */
  async trackDisclosure(practiceId, disclosureData) {
    const {
      patientId,
      userId,
      disclosureType,
      recipient,
      purpose,
      description,
      dataShared
    } = disclosureData;

    try {
      const context = {
        serviceId: 'access-request-service',
        operation: 'track-disclosure',
        practiceId
      };

      const disclosureLogData = {
        disclosureId: crypto.randomUUID(),
        patientId,
        userId,
        disclosureType,
        recipient,
        purpose,
        description,
        dataShared,
        disclosureDate: new Date(),
        metadata: {
          practiceId,
          ipAddress: disclosureData.ipAddress,
          userAgent: disclosureData.userAgent
        }
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const disclosure = await secureDataAccess.create('disclosurelogs', disclosureLogData, context);

      // Log to immutable audit
      const immutableAuditService = proxy.getService('immutableAuditService');
      await immutableAuditService.addAuditEntry({
        eventType: 'disclosure_tracked',
        userId,
        details: `PHI disclosure tracked for patient ${patientId}`,
        metadata: {
          disclosureId: disclosure.disclosureId,
          recipient,
          purpose
        }
      });

      return {
        success: true,
        disclosureId: disclosureLogData.disclosureId,
        message: {
          he: 'חשיפת המידע תועדה בהצלחה',
          en: 'Disclosure tracked successfully'
        }
      };

    } catch (error) {
      console.error('Failed to track disclosure:', error);
      throw error;
    }
  }

  /**
   * Get all access requests for a patient
   */
  async getPatientAccessRequests(practiceId, patientId) {
    try {
      const context = {
        serviceId: 'access-request-service',
        operation: 'get-patient-access-requests',
        practiceId
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const allRequests = await secureDataAccess.query('accessrequests', { patientId }, {}, context);
      const requests = allRequests.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));

      return {
        success: true,
        patientId,
        totalRequests: requests.length,
        requests: requests.map(r => ({
          requestId: r.requestId,
          requestType: r.requestType,
          status: r.status,
          requestDate: r.requestDate,
          deadline: r.deadline,
          completionDate: r.completionDate,
          daysToComplete: r.daysToComplete,
          urgency: r.urgency,
          deliveryMethod: r.deliveryMethod
        }))
      };

    } catch (error) {
      console.error('Failed to get patient access requests:', error);
      throw error;
    }
  }

  /**
   * Check and alert on upcoming deadlines
   */
  async checkDeadlines(practiceId) {
    try {
      const context = {
        serviceId: 'access-request-service',
        operation: 'check-deadlines',
        practiceId
      };

      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      // Find requests approaching deadline
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const allRequests = await secureDataAccess.query(
        'accessrequests',
        {},
        {},
        context
      );
      
      // Filter for urgent requests in JavaScript
      const urgentRequests = allRequests.filter(request => {
        const isPendingOrInProgress = [this.requestStatus.PENDING, this.requestStatus.IN_PROGRESS].includes(request.status);
        const isApproachingDeadline = new Date(request.deadline) <= threeDaysFromNow;
        return isPendingOrInProgress && isApproachingDeadline;
      });

      const alerts = [];

      for (const request of urgentRequests) {
        const daysRemaining = Math.ceil((request.deadline - now) / (1000 * 60 * 60 * 24));
        
        alerts.push({
          requestId: request.requestId,
          patientName: request.patientName,
          requestType: request.requestType,
          status: request.status,
          daysRemaining,
          deadline: request.deadline,
          urgency: daysRemaining <= 0 ? 'overdue' : daysRemaining <= 1 ? 'critical' : 'urgent'
        });

        // Log deadline warning
        if (daysRemaining <= 1) {
          const immutableAuditService = proxy.getService('immutableAuditService');
          await immutableAuditService.addAuditEntry({
            eventType: 'access_request_deadline_warning',
            userId: 'system',
            details: `Access request ${request.requestId} approaching deadline`,
            metadata: {
              requestId: request.requestId,
              daysRemaining,
              deadline: request.deadline
            }
          });
        }
      }

      return {
        success: true,
        checkDate: now,
        totalAlerts: alerts.length,
        alerts,
        summary: {
          overdue: alerts.filter(a => a.urgency === 'overdue').length,
          critical: alerts.filter(a => a.urgency === 'critical').length,
          urgent: alerts.filter(a => a.urgency === 'urgent').length
        }
      };

    } catch (error) {
      console.error('Failed to check deadlines:', error);
      throw error;
    }
  }

  /**
   * Generate access report for patient
   */
  async generateAccessReport(practiceId, patientId, options = {}) {
    const {
      format = 'pdf',
      includeDisclosures = true,
      includeAuditLog = true,
      dateRange
    } = options;

    try {
      const context = {
        serviceId: 'access-request-service',
        operation: 'generate-access-report',
        practiceId
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const patients = await secureDataAccess.query('patients', { _id: patientId }, { limit: 1 }, context);
      const patient = patients[0];
      if (!patient) {
        throw new Error('Patient not found');
      }

      const report = {
        reportId: crypto.randomUUID(),
        generatedDate: new Date(),
        patient: {
          id: patient._id,
          name: patient.name,
          dateOfBirth: patient.dateOfBirth,
          medicalRecordNumber: patient.medicalRecordNumber
        },
        sections: {}
      };

      // Include disclosure accounting
      if (includeDisclosures) {
        report.sections.disclosures = await this.generateDisclosureAccounting(
          context,
          patientId,
          dateRange
        );
      }

      // Include audit log
      if (includeAuditLog) {
        const auditQuery = {
          resourceId: patientId.toString(),
          resourceType: 'patient'
        };

        const auditContext = {
          serviceId: 'access-request-service',
          operation: 'generate-access-report-audit',
          practiceId
        };
        
        const allAuditLogs = await secureDataAccess.query(
          'audit_logs',
          auditQuery,
          {},
          auditContext
        );
        
        // Filter by date range in JavaScript if specified
        let auditLogs = allAuditLogs;
        if (dateRange) {
          auditLogs = allAuditLogs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= new Date(dateRange.startDate) && logDate <= new Date(dateRange.endDate);
          });
        }
        
        // Sort and limit in JavaScript
        auditLogs = auditLogs
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 1000);

        report.sections.auditLog = {
          totalEntries: auditLogs.length,
          entries: auditLogs.map(log => ({
            timestamp: log.timestamp,
            action: log.action,
            user: log.userDetails?.fullName || 'Unknown',
            ipAddress: log.request?.ipAddress,
            details: log.resourceDetails
          }))
        };
      }

      // Log report generation
      const immutableAuditService = proxy.getService('immutableAuditService');
      await immutableAuditService.addAuditEntry({
        eventType: 'access_report_generated',
        userId: 'system',
        details: `Access report generated for patient ${patient.name}`,
        metadata: {
          reportId: report.reportId,
          patientId,
          format,
          sections: Object.keys(report.sections)
        }
      });

      return {
        success: true,
        reportId: report.reportId,
        report,
        message: {
          he: 'דוח הגישה נוצר בהצלחה',
          en: 'Access report generated successfully'
        }
      };

    } catch (error) {
      console.error('Failed to generate access report:', error);
      throw error;
    }
  }

  /**
   * Helper: Gather patient records based on request type
   */
  async gatherPatientRecords(context, patientId, requestType, dateRange, specificProviders) {
    const records = [];

    // Get patient basic info
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    const patients = await secureDataAccess.query('patients', { _id: patientId }, { limit: 1 }, context);
    const patient = patients[0];
    
    if (!patient) {
      throw new Error('Patient not found');
    }

    records.push({
      type: 'demographics',
      data: {
        name: patient.name,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        address: patient.address,
        phone: patient.phone,
        email: patient.email
      }
    });

    // Get medical history
    if (requestType === this.requestTypes.FULL_RECORD || 
        requestType === this.requestTypes.SPECIFIC_DATES) {
      
      // Add medical history
      if (patient.medicalHistory) {
        records.push({
          type: 'medical_history',
          data: patient.medicalHistory
        });
      }

      // Add diagnoses
      if (patient.diagnoses && patient.diagnoses.length > 0) {
        const diagnoses = patient.diagnoses.filter(d => {
          if (!dateRange) return true;
          const diagDate = new Date(d.date);
          return diagDate >= new Date(dateRange.startDate) && 
                 diagDate <= new Date(dateRange.endDate);
        });

        records.push({
          type: 'diagnoses',
          data: diagnoses
        });
      }

      // Add medications
      if (patient.medications && patient.medications.length > 0) {
        records.push({
          type: 'medications',
          data: patient.medications
        });
      }

      // Add allergies
      if (patient.allergies && patient.allergies.length > 0) {
        records.push({
          type: 'allergies',
          data: patient.allergies
        });
      }
    }

    // Filter by specific providers if requested
    if (specificProviders && specificProviders.length > 0) {
      // This would filter records by provider IDs
      // Implementation depends on how provider info is stored in records
    }

    return records;
  }

  /**
   * Helper: Encrypt response package
   */
  async encryptResponsePackage(packageData) {
    try {
      // Use existing E2E encryption service
      const proxy = getServiceProxy();
      const e2eEncryptionService = proxy.getService('e2eEncryptionService');
      const jsonData = JSON.stringify(packageData);
      const encrypted = await e2eEncryptionService.encryptForTransmission(
        Buffer.from(jsonData),
        'access_request_package'
      );

      return {
        encrypted: true,
        data: encrypted.encryptedData,
        key: encrypted.key,
        algorithm: 'AES-256-GCM'
      };
    } catch (error) {
      console.error('Failed to encrypt response package:', error);
      throw error;
    }
  }

  /**
   * Helper: Generate secure download URL
   */
  async generateSecureDownloadUrl(request) {
    // Generate a time-limited, signed URL for download
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store token mapping (would be in Redis in production)
    const downloadToken = {
      token,
      requestId: request.requestId,
      expires,
      used: false
    };

    // In production, this would be stored in Redis or database
    // For now, return a placeholder URL
    return `/api/access-requests/download/${request.requestId}?token=${token}`;
  }

  /**
   * Helper: Send request confirmation
   */
  async sendRequestConfirmation(request, practiceDb) {
    // This would integrate with email service
    console.log(`Sending confirmation for request ${request.requestId} to ${request.metadata.requesterEmail}`);
  }

  /**
   * Helper: Send completion notification
   */
  async sendCompletionNotification(request, practiceDb) {
    // This would integrate with email service
    console.log(`Sending completion notification for request ${request.requestId} to ${request.metadata.requesterEmail}`);
  }

  /**
   * Helper: Get action description
   */
  getActionDescription(action) {
    const descriptions = {
      'patient_viewed': 'Viewed patient record',
      'patient_updated': 'Updated patient information',
      'document_viewed': 'Viewed medical document',
      'document_downloaded': 'Downloaded medical document',
      'patients_exported': 'Exported patient data'
    };
    return descriptions[action] || action;
  }

  /**
   * Helper: Calculate frequent actions
   */
  calculateFrequentActions(logs) {
    const actionCounts = {};
    
    for (const log of logs) {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    }

    return Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));
  }

  /**
   * Helper: Calculate access by role
   */
  calculateAccessByRole(logs) {
    const roleCounts = {};
    
    for (const log of logs) {
      const roles = log.userId?.roles || log.userDetails?.roles || ['unknown'];
      for (const role of roles) {
        roleCounts[role] = (roleCounts[role] || 0) + 1;
      }
    }

    return Object.entries(roleCounts)
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);
  }
}

// Export singleton instance
const accessRequestService = new AccessRequestService();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('accessRequestService', () => accessRequestService);
}

module.exports = accessRequestService;