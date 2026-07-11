/**
 * Bulk Communication Service
 * Handles mass patient communications including SMS, email campaigns,
 * health screening invitations, and vaccination reminders.
 * SECURITY: All database access through SecureDataAccess
 */

// Use lazy loading to resolve circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    // For libs/communication/feature-bulk/src/lib/:
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class BulkCommunicationService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.serviceId = 'bulk-communication-service';
    
    // Rate limiting for bulk operations
    this.rateLimits = {
      sms: {
        perMinute: 50,
        perHour: 500,
        perDay: 2000
      },
      email: {
        perMinute: 100,
        perHour: 1000,
        perDay: 5000
      }
    };
    
    // Campaign tracking
    this.activeCampaigns = new Map();
    this.campaignMetrics = new Map();
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      const proxy = getServiceProxy();
      
      // Get services via lazy loading
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      this.initialized = true;
      console.log('✅ Bulk Communication Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Bulk Communication Service:', error);
      throw error;
    }
  }

  getServiceContext(practiceId = 'global', operation = 'bulk-communication') {
    return {
      serviceId: this.serviceId,
      operation,
      practiceId
    };
  }

  /**
   * Send bulk SMS to patient groups
   */
  async sendBulkPatientSMS(params, practiceContext) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { 
        patientFilter = {}, 
        message, 
        campaignName, 
        sendDateTime,
        dryRun = false 
      } = params;
      
      if (!message) {
        throw new Error('Message content is required');
      }
      
      // Get patients matching the filter
      const patients = await this.getFilteredPatients(patientFilter, practiceContext);
      
      if (patients.length === 0) {
        return {
          success: false,
          message: 'No patients match the specified criteria',
          totalPatients: 0,
          sent: 0,
          failed: 0
        };
      }
      
      // Check rate limits
      const rateLimitCheck = this.checkBulkRateLimit('sms', patients.length);
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded: ${rateLimitCheck.message}`);
      }
      
      // If dry run, just return the count
      if (dryRun) {
        return {
          success: true,
          dryRun: true,
          message: `Would send SMS to ${patients.length} patients`,
          totalPatients: patients.length,
          estimatedCost: this.estimateSMSCost(patients.length),
          patients: patients.map(p => ({
            id: p._id,
            name: p.name,
            phone: p.phone ? this.maskPhoneNumber(p.phone) : null
          }))
        };
      }
      
      // Create campaign record
      const campaign = await this.createCampaign({
        name: campaignName || `SMS Campaign ${new Date().toISOString()}`,
        type: 'bulk_sms',
        totalRecipients: patients.length,
        message: message,
        scheduledFor: sendDateTime ? new Date(sendDateTime) : new Date(),
        practiceId: practiceContext.practiceId,
        createdBy: practiceContext.userId || 'system'
      }, practiceContext);
      
      // Send messages
      const results = {
        campaignId: campaign._id,
        totalPatients: patients.length,
        sent: 0,
        failed: 0,
        errors: [],
        sentMessages: []
      };
      
      for (const patient of patients) {
        try {
          if (!patient.phone) {
            results.failed++;
            results.errors.push({
              patientId: patient._id,
              error: 'No phone number available'
            });
            continue;
          }
          
          // Send SMS (mock implementation)
          const smsResult = await this.sendSMSToPatient(patient, message, practiceContext);
          
          if (smsResult.success) {
            results.sent++;
            results.sentMessages.push({
              patientId: patient._id,
              messageId: smsResult.messageId,
              timestamp: new Date()
            });
          } else {
            results.failed++;
            results.errors.push({
              patientId: patient._id,
              error: smsResult.error
            });
          }
          
        } catch (error) {
          results.failed++;
          results.errors.push({
            patientId: patient._id,
            error: error.message
          });
        }
      }
      
      // Update campaign with results
      await this.updateCampaignResults(campaign._id, results, practiceContext);
      
      return {
        success: true,
        ...results
      };
      
    } catch (error) {
      console.error('Failed to send bulk SMS:', error);
      throw error;
    }
  }

  /**
   * Send bulk email to patient groups
   */
  async sendBulkPatientEmail(params, practiceContext) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { 
        patientFilter = {}, 
        subject,
        htmlContent,
        textContent,
        campaignName, 
        sendDateTime,
        dryRun = false 
      } = params;
      
      if (!subject || (!htmlContent && !textContent)) {
        throw new Error('Subject and content are required');
      }
      
      // Get patients matching the filter
      const patients = await this.getFilteredPatients(patientFilter, practiceContext);
      
      if (patients.length === 0) {
        return {
          success: false,
          message: 'No patients match the specified criteria',
          totalPatients: 0,
          sent: 0,
          failed: 0
        };
      }
      
      // Check rate limits
      const rateLimitCheck = this.checkBulkRateLimit('email', patients.length);
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded: ${rateLimitCheck.message}`);
      }
      
      // If dry run, just return the count
      if (dryRun) {
        return {
          success: true,
          dryRun: true,
          message: `Would send email to ${patients.length} patients`,
          totalPatients: patients.length,
          patients: patients.map(p => ({
            id: p._id,
            name: p.name,
            email: p.email ? this.maskEmail(p.email) : null
          }))
        };
      }
      
      // Create campaign record
      const campaign = await this.createCampaign({
        name: campaignName || `Email Campaign ${new Date().toISOString()}`,
        type: 'bulk_email',
        totalRecipients: patients.length,
        subject: subject,
        content: htmlContent || textContent,
        scheduledFor: sendDateTime ? new Date(sendDateTime) : new Date(),
        practiceId: practiceContext.practiceId,
        createdBy: practiceContext.userId || 'system'
      }, practiceContext);
      
      // Send emails
      const results = {
        campaignId: campaign._id,
        totalPatients: patients.length,
        sent: 0,
        failed: 0,
        errors: [],
        sentMessages: []
      };
      
      for (const patient of patients) {
        try {
          if (!patient.email) {
            results.failed++;
            results.errors.push({
              patientId: patient._id,
              error: 'No email address available'
            });
            continue;
          }
          
          // Send email (mock implementation)
          const emailResult = await this.sendEmailToPatient(patient, { subject, htmlContent, textContent }, practiceContext);
          
          if (emailResult.success) {
            results.sent++;
            results.sentMessages.push({
              patientId: patient._id,
              messageId: emailResult.messageId,
              timestamp: new Date()
            });
          } else {
            results.failed++;
            results.errors.push({
              patientId: patient._id,
              error: emailResult.error
            });
          }
          
        } catch (error) {
          results.failed++;
          results.errors.push({
            patientId: patient._id,
            error: error.message
          });
        }
      }
      
      // Update campaign with results
      await this.updateCampaignResults(campaign._id, results, practiceContext);
      
      return {
        success: true,
        ...results
      };
      
    } catch (error) {
      console.error('Failed to send bulk email:', error);
      throw error;
    }
  }

  /**
   * Get filtered patients based on criteria
   */
  async getFilteredPatients(filter, context) {
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    
    const patients = await secureDataAccess.query('patients', filter, { limit: 5000 }, 
      this.getServiceContext(context.practiceId, 'get-filtered-patients'));
    
    return patients.filter(p => p.active !== false); // Only active patients
  }

  /**
   * Check rate limits for bulk operations
   */
  checkBulkRateLimit(type, count) {
    // Simplified rate limit check - in production this would check against actual usage
    const limits = this.rateLimits[type];
    if (count > limits.perHour) {
      return {
        allowed: false,
        message: `Exceeds hourly limit of ${limits.perHour} messages`
      };
    }
    
    return { allowed: true };
  }

  /**
   * Estimate SMS cost
   */
  estimateSMSCost(count) {
    const costPerSMS = 0.05; // $0.05 per SMS
    return count * costPerSMS;
  }

  /**
   * Create campaign record
   */
  async createCampaign(campaignData, context) {
    const campaign = {
      ...campaignData,
      _id: require('crypto').randomBytes(16).toString('hex'),
      status: 'active',
      createdAt: new Date(),
      results: {
        sent: 0,
        failed: 0,
        delivered: 0,
        opened: 0,
        clicked: 0
      }
    };
    
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    
    await secureDataAccess.create('communication_campaigns', campaign, 
      this.getServiceContext(context.practiceId, 'create-campaign'));
    
    return campaign;
  }

  /**
   * Update campaign results
   */
  async updateCampaignResults(campaignId, results, context) {
    await secureDataAccess.update('communication_campaigns', 
      { _id: campaignId }, 
      { 
        $set: {
          'results.sent': results.sent,
          'results.failed': results.failed,
          completedAt: new Date(),
          status: 'completed'
        }
      },
      {},
      this.getServiceContext(context.practiceId, 'update-campaign-results'));
  }

  /**
   * Send SMS to individual patient (mock implementation)
   */
  async sendSMSToPatient(patient, message, context) {
    // Mock SMS sending - in production would use real SMS service
    return {
      success: true,
      messageId: require('crypto').randomBytes(8).toString('hex'),
      timestamp: new Date()
    };
  }

  /**
   * Send email to individual patient (mock implementation)
   */
  async sendEmailToPatient(patient, emailData, context) {
    // Mock email sending - in production would use real email service
    return {
      success: true,
      messageId: require('crypto').randomBytes(8).toString('hex'),
      timestamp: new Date()
    };
  }

  /**
   * Mask phone number for privacy
   */
  maskPhoneNumber(phone) {
    if (phone.length <= 4) return phone;
    return phone.substring(0, 3) + '***' + phone.substring(phone.length - 4);
  }

  /**
   * Mask email for privacy
   */
  maskEmail(email) {
    const [local, domain] = email.split('@');
    if (local.length <= 3) return email;
    return local.substring(0, 2) + '***' + local.substring(local.length - 1) + '@' + domain;
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId, context) {
    const campaigns = await secureDataAccess.query('communication_campaigns', 
      { _id: campaignId }, 
      { limit: 1 }, 
      this.getServiceContext(context.practiceId, 'get-campaign-analytics'));
    
    return campaigns[0] || null;
  }

  /**
   * List all campaigns
   */
  async listCampaigns(filter = {}, context) {
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    
    return secureDataAccess.query('communication_campaigns', 
      { ...filter, practiceId: context.practiceId }, 
      { limit: 100, sort: { createdAt: -1 } }, 
      this.getServiceContext(context.practiceId, 'list-campaigns'));
  }
}

// Register service with ServiceProxyManager for lazy loading
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('bulkCommunicationService', () => new BulkCommunicationService());
}

module.exports = BulkCommunicationService;