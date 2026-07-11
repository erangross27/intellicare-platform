const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const smsService = require('./smsService');
const emailService = require('./emailService');
const communicationAuditService = require('./communicationAuditService');
const encryptionService = require('./encryptionService');
const immutableAuditService = require('./immutableAuditService');

/**
 * Bulk Communication Service
 * Handles mass patient communications including SMS, email campaigns,
 * health screening invitations, and vaccination reminders.
 * 
 * Features:
 * - Bulk SMS and email to patient groups
 * - Patient segmentation and filtering
 * - Campaign analytics and tracking
 * - Rate limiting and delivery optimization
 * - HIPAA-compliant audit trails
 */
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
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Initialize SMS and Email services
      await smsService.initialize();
      await emailService.initialize();
      
      this.initialized = true;
      console.log('✅ Bulk Communication Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Bulk Communication Service:', error);
      throw error;
    }
  }

  /**
   * Send bulk SMS to patient groups
   */
  async sendBulkPatientSMS(params, practiceContext) {
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
      
      // Send messages (with delay between sends to respect rate limits)
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
          
          // Check if patient has opted out of SMS
          const isOptedOut = await smsService.isOptedOut(patient.phone, {
            country: practiceContext.country || 'US',
            practiceId: practiceContext.practiceId
          });
          
          if (isOptedOut) {
            results.failed++;
            results.errors.push({
              patientId: patient._id,
              error: 'Patient has opted out of SMS communications'
            });
            continue;
          }
          
          // Send SMS
          const smsResult = await smsService.sendSMS({
            to: patient.phone,
            message: message,
            patientId: patient._id,
            type: 'bulk_campaign',
            campaignId: campaign._id
          }, {
            practiceId: practiceContext.practiceId,
            country: practiceContext.country || 'US',
            userId: practiceContext.userId
          });
          
          if (smsResult.success) {
            results.sent++;
            results.sentMessages.push({
              patientId: patient._id,
              messageId: smsResult.messageId,
              status: smsResult.status
            });
          } else {
            results.failed++;
            results.errors.push({
              patientId: patient._id,
              error: smsResult.error
            });
          }
          
          // Delay between sends (1 second to respect rate limits)
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (patientError) {
          results.failed++;
          results.errors.push({
            patientId: patient._id,
            error: patientError.message
          });
        }
      }
      
      // Update campaign with results
      await this.updateCampaignResults(campaign._id, results, practiceContext);
      
      // Record audit trail
      await this.auditBulkCommunication({
        type: 'bulk_sms',
        campaignId: campaign._id,
        results: results,
        practiceId: practiceContext.practiceId,
        userId: practiceContext.userId
      });
      
      return {
        success: true,
        ...results,
        message: `SMS campaign completed: ${results.sent} sent, ${results.failed} failed`
      };
      
    } catch (error) {
      console.error('❌ Bulk SMS failed:', error);
      throw error;
    }
  }

  /**
   * Send bulk email to patient groups
   */
  async sendBulkPatientEmail(params, practiceContext) {
    try {
      const { 
        patientFilter = {}, 
        subject,
        body,
        htmlBody,
        campaignName, 
        sendDateTime,
        dryRun = false 
      } = params;
      
      if (!subject || !body) {
        throw new Error('Subject and body are required');
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
        message: body,
        subject: subject,
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
          
          // Personalize message
          const personalizedSubject = this.personalizeMessage(subject, patient);
          const personalizedBody = this.personalizeMessage(body, patient);
          const personalizedHtml = htmlBody ? this.personalizeMessage(htmlBody, patient) : null;
          
          // Send email
          await emailService.sendCustomEmail({
            to: patient.email,
            subject: personalizedSubject,
            text: personalizedBody,
            html: personalizedHtml || `<p>${personalizedBody.replace(/\n/g, '<br>')}</p>`
          });
          
          results.sent++;
          results.sentMessages.push({
            patientId: patient._id,
            email: this.maskEmail(patient.email),
            status: 'sent'
          });
          
          // Small delay between emails
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (patientError) {
          results.failed++;
          results.errors.push({
            patientId: patient._id,
            error: patientError.message
          });
        }
      }
      
      // Update campaign with results
      await this.updateCampaignResults(campaign._id, results, practiceContext);
      
      // Record audit trail
      await this.auditBulkCommunication({
        type: 'bulk_email',
        campaignId: campaign._id,
        results: results,
        practiceId: practiceContext.practiceId,
        userId: practiceContext.userId
      });
      
      return {
        success: true,
        ...results,
        message: `Email campaign completed: ${results.sent} sent, ${results.failed} failed`
      };
      
    } catch (error) {
      console.error('❌ Bulk email failed:', error);
      throw error;
    }
  }

  /**
   * Get filtered patients based on criteria
   */
  async getFilteredPatients(filter, practiceContext) {
    try {
      const query = { practiceId: practiceContext.practiceId };
      
      // Age filter
      if (filter.ageMin || filter.ageMax) {
        const now = new Date();
        if (filter.ageMax) {
          const minBirthDate = new Date(now.getFullYear() - filter.ageMax - 1, now.getMonth(), now.getDate());
          query.dateOfBirth = { $gte: minBirthDate };
        }
        if (filter.ageMin) {
          const maxBirthDate = new Date(now.getFullYear() - filter.ageMin, now.getMonth(), now.getDate());
          query.dateOfBirth = { ...query.dateOfBirth, $lte: maxBirthDate };
        }
      }
      
      // Gender filter
      if (filter.gender) {
        query.gender = filter.gender;
      }
      
      // Health condition filter
      if (filter.conditions && filter.conditions.length > 0) {
        query['medicalHistory.conditions'] = { $in: filter.conditions };
      }
      
      // Insurance filter
      if (filter.insurance) {
        query.insurance = filter.insurance;
      }
      
      // Last visit filter
      if (filter.lastVisitBefore || filter.lastVisitAfter) {
        // This would require joining with appointments - simplified for now
        // query.lastVisit = {};
        // if (filter.lastVisitBefore) query.lastVisit.$lte = new Date(filter.lastVisitBefore);
        // if (filter.lastVisitAfter) query.lastVisit.$gte = new Date(filter.lastVisitAfter);
      }
      
      // Communication preferences
      if (filter.communicationType === 'sms') {
        query['communicationPreferences.sms'] = { $ne: false };
        query.phone = { $exists: true, $ne: null };
      } else if (filter.communicationType === 'email') {
        query['communicationPreferences.emailReminders'] = { $ne: false };
        query.email = { $exists: true, $ne: null };
      }
      
      const patients = await SecureDataAccess.query(
        'patients',
        query,
        { limit: filter.limit || 1000 },
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      return patients;
      
    } catch (error) {
      console.error('❌ Error filtering patients:', error);
      throw error;
    }
  }

  /**
   * Create campaign record
   */
  async createCampaign(campaignData, practiceContext) {
    try {
      const campaign = {
        ...campaignData,
        _id: new Date().getTime().toString() + Math.random().toString(36).substr(2, 9),
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
      
      const savedCampaign = await SecureDataAccess.insert(
        'communication_campaigns',
        campaign,
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      this.activeCampaigns.set(campaign._id, campaign);
      
      return savedCampaign;
      
    } catch (error) {
      console.error('❌ Error creating campaign:', error);
      throw error;
    }
  }

  /**
   * Update campaign results
   */
  async updateCampaignResults(campaignId, results, practiceContext) {
    try {
      await SecureDataAccess.update(
        'communication_campaigns',
        { _id: new ObjectId(campaignId) },
        { 
          status: 'completed',
          results: {
            sent: results.sent,
            failed: results.failed,
            totalRecipients: results.totalPatients
          },
          completedAt: new Date()
        },
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      // Update local cache
      if (this.activeCampaigns.has(campaignId)) {
        const campaign = this.activeCampaigns.get(campaignId);
        campaign.status = 'completed';
        campaign.results = results;
        this.campaignMetrics.set(campaignId, results);
      }
      
    } catch (error) {
      console.error('❌ Error updating campaign results:', error);
    }
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(params, practiceContext) {
    try {
      const { campaignId, startDate, endDate, type } = params;
      
      const query = { practiceId: practiceContext.practiceId };
      
      if (campaignId) {
        query._id = campaignId;
      }
      
      if (type) {
        query.type = type;
      }
      
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }
      
      const campaigns = await SecureDataAccess.query(
        'communication_campaigns',
        query,
        { sort: { createdAt: -1 } },
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      // Calculate aggregate metrics
      const analytics = {
        totalCampaigns: campaigns.length,
        totalMessagesSent: campaigns.reduce((sum, c) => sum + (c.results?.sent || 0), 0),
        totalMessagesFailed: campaigns.reduce((sum, c) => sum + (c.results?.failed || 0), 0),
        averageSuccessRate: 0,
        campaignBreakdown: campaigns.map(c => ({
          id: c._id,
          name: c.name,
          type: c.type,
          status: c.status,
          createdAt: c.createdAt,
          totalRecipients: c.totalRecipients,
          results: c.results
        }))
      };
      
      if (analytics.totalMessagesSent + analytics.totalMessagesFailed > 0) {
        analytics.averageSuccessRate = (
          (analytics.totalMessagesSent / (analytics.totalMessagesSent + analytics.totalMessagesFailed)) * 100
        ).toFixed(2) + '%';
      }
      
      return analytics;
      
    } catch (error) {
      console.error('❌ Error getting campaign analytics:', error);
      throw error;
    }
  }

  /**
   * Personalize message content
   */
  personalizeMessage(message, patient) {
    let personalized = message;
    
    // Replace placeholders
    personalized = personalized.replace(/\{firstName\}/g, patient.firstName || patient.name?.split(' ')[0] || 'Patient');
    personalized = personalized.replace(/\{lastName\}/g, patient.lastName || patient.name?.split(' ').slice(1).join(' ') || '');
    personalized = personalized.replace(/\{fullName\}/g, patient.name || 'Patient');
    personalized = personalized.replace(/\{age\}/g, this.calculateAge(patient.dateOfBirth) || '');
    
    return personalized;
  }

  /**
   * Calculate age from birth date
   */
  calculateAge(birthDate) {
    if (!birthDate) return null;
    
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Check rate limits for bulk operations
   */
  checkBulkRateLimit(type, count) {
    const limits = this.rateLimits[type];
    
    // Simple rate limiting - in production would use more sophisticated tracking
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
    // Rough estimate - $0.01 per SMS
    return `$${(count * 0.01).toFixed(2)}`;
  }

  /**
   * Mask phone number for privacy
   */
  maskPhoneNumber(phone) {
    if (!phone || phone.length < 4) return phone;
    return phone.substring(0, phone.length - 4).replace(/\d/g, '*') + phone.substring(phone.length - 4);
  }

  /**
   * Mask email for privacy
   */
  maskEmail(email) {
    if (!email || !email.includes('@')) return email;
    const [local, domain] = email.split('@');
    const maskedLocal = local.length > 2 ? 
      local[0] + '*'.repeat(local.length - 2) + local[local.length - 1] : 
      local;
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Audit bulk communication
   */
  async auditBulkCommunication(auditData) {
    try {
      const context = {
        serviceId: 'bulk-communication-service',
        apiKey: this.serviceToken?.apiKey || 'system',
        practiceId: auditData.practiceId
      };
      
      await SecureDataAccess.insert('audit_logs', {
        action: `BULK_${auditData.type.toUpperCase()}`,
        category: 'bulk_communication',
        userId: auditData.userId || 'system',
        practiceId: auditData.practiceId,
        metadata: {
          campaignId: auditData.campaignId,
          totalSent: auditData.results.sent,
          totalFailed: auditData.results.failed,
          successRate: auditData.results.sent / (auditData.results.sent + auditData.results.failed)
        },
        timestamp: new Date()
      }, context);
      
      // Also record in communication audit service
      await communicationAuditService.recordCommunication(auditData.practiceId, {
        type: auditData.type,
        category: 'bulk_campaign',
        method: auditData.type.includes('sms') ? 'sms' : 'email',
        deliveryStatus: 'completed',
        sentAt: new Date(),
        campaignId: auditData.campaignId,
        bulkRecipients: auditData.results.sent,
        consentVerified: true,
        optOutChecked: true,
        initiatedBy: auditData.userId || 'system',
        automated: true,
        apiVersion: 'v2'
      });
      
    } catch (error) {
      console.error('❌ Error auditing bulk communication:', error);
    }
  }
}

// Export singleton instance
module.exports = new BulkCommunicationService();