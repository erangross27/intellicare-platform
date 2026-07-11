const twilio = require('twilio');

// Use lazy loading to resolve circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    // For libs/communication/feature-sms/src/:
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class SMSService {
  constructor() {
    this.serviceId = 'sms-service';
    this.serviceToken = null;
    this.initialized = false;
    this.disabled = false; // Master control flag
    this.testMode = false; // Test mode flag
    this.hasLoggedDisabled = false; // Track if we've logged the disabled message
    this.client = null;
    this.fromNumber = null;
    this.messageQueue = [];
    this.processingQueue = false;
    this.rateLimits = {
      perMinute: 10,
      perHour: 100,
      perDay: 500
    };
    this.sentMessages = new Map();
    this.testNumbers = [ // Numbers to block in production
      '+1234567890', '+0000000000', '+1111111111',
      '+9999999999', '+5555555555', '+12345678901'
    ];
  }
  
  // Helper method for lazy service access
  getServices() {
    const proxy = getServiceProxy();
    return {
      secureDataAccess: proxy.getService('secureDataAccess'),
      communicationAuditService: proxy.getService('communicationAuditService')
    };
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const proxy = getServiceProxy();
      
      // Get services via lazy loading
      const secureConfigService = proxy.getService('secureConfigService');
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      const productionKMS = proxy.getService('productionKMS');
      
      // Initialize secure config first
      await secureConfigService.initialize();
      
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);

      // Initialize KMS and retrieve Twilio credentials
      await productionKMS.initialize();
      
      // Check master SMS control flag
      const smsEnabled = await productionKMS.getInternalKey('SMS_ENABLED');
      if (smsEnabled !== 'true') {
        // Only log once during initial service startup
        if (!this.hasLoggedDisabled) {
          console.log('⛔ SMS SERVICE DISABLED (Development mode)');
          this.hasLoggedDisabled = true;
        }
        this.initialized = false;
        this.disabled = true;
        return;
      }
      
      // Check test mode
      const testMode = await productionKMS.getInternalKey('SMS_TEST_MODE');
      const isProduction = secureConfigService.get('NODE_ENV') === 'production';
      
      if (testMode === 'true' && !isProduction) {
        console.log('🧪 SMS Test Mode Active - Messages will be logged but not sent');
        this.testMode = true;
      }
      
      const accountSid = await productionKMS.getInternalKey('TWILIO_ACCOUNT_SID');
      const authToken = await productionKMS.getInternalKey('TWILIO_AUTH_TOKEN');
      this.fromNumber = await productionKMS.getInternalKey('TWILIO_PHONE_NUMBER');
      this.messagingServiceSid = await productionKMS.getInternalKey('TWILIO_MESSAGING_SERVICE_SID');

      if (!accountSid || !authToken || (!this.fromNumber && !this.messagingServiceSid)) {
        console.log('⚠️ Twilio credentials not found in KMS - SMS service disabled');
        console.log('ℹ️ To enable SMS, run: node scripts/setup-twilio-kms.js');
        this.initialized = false;
        return;
      }

      this.client = twilio(accountSid, authToken);

      await this.verifyPhoneNumber();
      
      this.initialized = true;
      console.log('✅ SMS Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SMS Service:', error);
      this.initialized = false;
    }
  }

  // Helper method to get the service context for SecureDataAccess
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'sms-service',
      operation: 'database-access',
      practiceId: practiceId
    };
  }

  async verifyPhoneNumber() {
    try {
      if (this.messagingServiceSid) {
        // Verify messaging service exists
        const service = await this.client.messaging.v1
          .services(this.messagingServiceSid)
          .fetch();
        
        console.log(`✅ Verified Twilio Messaging Service: ${service.friendlyName || this.messagingServiceSid}`);
      } else if (this.fromNumber) {
        // Verify phone number exists
        const phoneNumber = await this.client.incomingPhoneNumbers
          .list({ phoneNumber: this.fromNumber, limit: 1 });
        
        if (phoneNumber.length === 0) {
          throw new Error(`Phone number ${this.fromNumber} not found in Twilio account`);
        }

        console.log(`✅ Verified Twilio phone number: ${this.fromNumber}`);
      }
    } catch (error) {
      console.error('Failed to verify Twilio configuration:', error);
      throw error;
    }
  }

  async sendSMS(data, context) {
    // Check if service is disabled
    if (this.disabled) {
      console.log('⛔ SMS BLOCKED: Service is disabled (SMS_ENABLED=false)');
      return {
        success: false,
        error: 'SMS service is disabled'
      };
    }
    
    if (!this.initialized) {
      console.log('⚠️ SMS Service not initialized - message not sent');
      return {
        success: false,
        error: 'SMS service not configured'
      };
    }

    try {
      const { to, message, patientId, appointmentId, type = 'general' } = data;

      if (!to || !message) {
        throw new Error('Phone number and message are required');
      }

      const phoneNumber = this.normalizePhoneNumber(to, context.country || 'US');
      
      if (!this.validatePhoneNumber(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }
      
      // Block test numbers in production
      if (this.testNumbers.includes(phoneNumber)) {
        console.log(`🚫 Blocked test number: ${phoneNumber}`);
        return {
          success: false,
          error: 'Test number blocked for safety'
        };
      }

      if (!this.checkRateLimits(phoneNumber)) {
        throw new Error('Rate limit exceeded for this phone number');
      }

      const hipaaCompliantMessage = this.sanitizeMessageForHIPAA(message, type);
      
      // If in test mode, just log and return success
      if (this.testMode) {
        console.log('🧪 TEST MODE - SMS not actually sent:');
        console.log(`   To: ${phoneNumber}`);
        console.log(`   Type: ${type}`);
        console.log(`   Message: ${hipaaCompliantMessage.substring(0, 50)}...`);
        return {
          success: true,
          testMode: true,
          messageId: 'TEST_' + Date.now()
        };
      }

      const messageData = {
        body: hipaaCompliantMessage,
        to: phoneNumber
      };

      // Use messaging service if available, otherwise use phone number
      if (this.messagingServiceSid) {
        messageData.messagingServiceSid = this.messagingServiceSid;
      } else {
        messageData.from = this.fromNumber;
      }

      if (type === 'appointment_reminder') {
        // Get base URL from KMS or use default
        const baseUrl = await productionKMS.getInternalKey('BASE_URL') || 'https://intellicare.health';
        messageData.statusCallback = baseUrl + '/api/sms/status';
      }

      const result = await this.client.messages.create(messageData);

      this.updateRateLimitTracking(phoneNumber);

      const encryptedPhone = await encryptionService.encrypt(phoneNumber, 'pii');

      const smsRecord = {
        messageId: result.sid,
        patientId,
        appointmentId,
        practiceId: context.practiceId,
        type,
        phoneNumber: encryptedPhone,
        message: hipaaCompliantMessage,
        status: result.status,
        direction: 'outbound',
        sentAt: new Date(),
        deliveredAt: null,
        errorCode: null,
        errorMessage: null
      };

      await SecureDataAccess.create(
        'sms_messages',
        smsRecord,
        this.getServiceContext(context.practiceId)
      );

      await this.auditSMSSent(smsRecord, context);

      return {
        success: true,
        messageId: result.sid,
        status: result.status
      };
    } catch (error) {
      console.error('Failed to send SMS:', error);
      
      await this.auditSMSFailed(data, error, context);

      return {
        success: false,
        error: error.message
      };
    }
  }

  normalizePhoneNumber(phone, country) {
    let normalized = phone.replace(/[^\d+]/g, '');

    if (country === 'IL') {
      if (normalized.startsWith('0')) {
        normalized = '+972' + normalized.substring(1);
      } else if (!normalized.startsWith('+972')) {
        normalized = '+972' + normalized;
      }
    } else if (country === 'US') {
      if (!normalized.startsWith('+')) {
        if (normalized.length === 10) {
          normalized = '+1' + normalized;
        } else if (!normalized.startsWith('+1')) {
          normalized = '+1' + normalized;
        }
      }
    }

    return normalized;
  }

  validatePhoneNumber(phone) {
    const phoneRegex = /^\+[1-9]\d{10,14}$/;
    return phoneRegex.test(phone);
  }

  sanitizeMessageForHIPAA(message, type) {
    if (type === 'appointment_reminder') {
      const sanitized = message
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN REMOVED]')
        .replace(/\b(?:MRN|Medical Record Number)[\s:#]*\S+/gi, '[MRN REMOVED]')
        .replace(/\b(?:diagnosis|condition|treatment|medication)[\s:]*[^.]+/gi, '[PHI REMOVED]');
      
      return sanitized.substring(0, 160);
    }

    return message.substring(0, 160);
  }

  checkRateLimits(phoneNumber) {
    const now = Date.now();
    const history = this.sentMessages.get(phoneNumber) || [];
    
    const lastMinute = history.filter(t => now - t < 60000).length;
    if (lastMinute >= this.rateLimits.perMinute) return false;
    
    const lastHour = history.filter(t => now - t < 3600000).length;
    if (lastHour >= this.rateLimits.perHour) return false;
    
    const lastDay = history.filter(t => now - t < 86400000).length;
    if (lastDay >= this.rateLimits.perDay) return false;
    
    return true;
  }

  updateRateLimitTracking(phoneNumber) {
    const now = Date.now();
    const history = this.sentMessages.get(phoneNumber) || [];
    
    history.push(now);
    
    const cutoff = now - 86400000;
    const recentHistory = history.filter(t => t > cutoff);
    
    this.sentMessages.set(phoneNumber, recentHistory);
  }

  async sendAppointmentReminder(appointment, hoursBeforeAppointment, context) {
    if (!this.initialized) {
      console.log('⚠️ SMS Service not initialized - reminder not sent');
      return null;
    }

    try {
      const patient = appointment.patientId;
      if (!patient || !patient.phone) {
        console.log(`⚠️ No phone number for patient ${appointment.patientName}`);
        return null;
      }

      const appointmentDate = new Date(appointment.scheduledDate);
      const country = appointment.timezone === 'America/New_York' ? 'US' : 'IL';
      const isHebrew = country === 'IL';

      const message = this.generateReminderMessage(
        appointment,
        hoursBeforeAppointment,
        isHebrew
      );

      const result = await this.sendSMS({
        to: patient.phone,
        message,
        patientId: patient._id,
        appointmentId: appointment._id,
        type: 'appointment_reminder'
      }, {
        practiceId: appointment.practiceId,
        country
      });

      if (result.success) {
        const remindersSent = appointment.remindersSent || [];
        remindersSent.push({
          type: 'sms',
          sentDate: new Date(),
          sentBy: 'system',
          delivered: false,
          messageId: result.messageId
        });

        await SecureDataAccess.update(
          'appointments',
          { _id: appointment._id },
          { remindersSent },
          this.getServiceContext(appointment.practiceId)
        );

        console.log(`✅ SMS reminder sent for appointment ${appointment.appointmentNumber}`);
      }

      return result;
    } catch (error) {
      console.error('Failed to send appointment reminder SMS:', error);
      return null;
    }
  }

  generateReminderMessage(appointment, hoursBeforeAppointment, isHebrew) {
    const time = appointment.scheduledTime;
    const provider = appointment.providerName;
    const clinicPhone = appointment.clinicPhone || '';

    if (isHebrew) {
      if (hoursBeforeAppointment === 24) {
        return `תזכורת: יש לך תור מחר בשעה ${time} עם ${provider}. לביטול/שינוי: ${clinicPhone}`;
      } else if (hoursBeforeAppointment === 2) {
        return `תזכורת: התור שלך היום בשעה ${time} עם ${provider}. אנא הגיעו 10 דקות מוקדם.`;
      } else {
        return `התור שלך מתחיל בעוד 30 דקות בשעה ${time} עם ${provider}.`;
      }
    } else {
      if (hoursBeforeAppointment === 24) {
        return `Reminder: You have an appointment tomorrow at ${time} with ${provider}. To cancel/reschedule: ${clinicPhone}`;
      } else if (hoursBeforeAppointment === 2) {
        return `Reminder: Your appointment today at ${time} with ${provider}. Please arrive 10 minutes early.`;
      } else {
        return `Your appointment starts in 30 minutes at ${time} with ${provider}.`;
      }
    }
  }

  async handleStatusCallback(data) {
    try {
      const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = data;

      const smsRecord = await SecureDataAccess.query(
        'sms_messages',
        { messageId: MessageSid },
        {},
        this.getServiceContext()
      );

      if (smsRecord && smsRecord.length > 0) {
        const record = smsRecord[0];
        const updates = {
          status: MessageStatus,
          errorCode: ErrorCode || null,
          errorMessage: ErrorMessage || null
        };

        if (MessageStatus === 'delivered') {
          updates.deliveredAt = new Date();
        }

        await SecureDataAccess.update(
          'sms_messages',
          { messageId: MessageSid },
          updates,
          this.getServiceContext(record.practiceId)
        );

        if (MessageStatus === 'delivered' && record.appointmentId) {
          await this.updateAppointmentReminderStatus(
            record.appointmentId,
            MessageSid,
            record.practiceId
          );
        }
      }
    } catch (error) {
      console.error('Failed to handle SMS status callback:', error);
    }
  }

  async updateAppointmentReminderStatus(appointmentId, messageId, practiceId) {
    try {
      const appointments = await SecureDataAccess.query(
        'appointments',
        { _id: appointmentId },
        {},
        this.getServiceContext(practiceId)
      );

      const appointment = appointments[0];
      if (appointment && appointment.remindersSent) {
        const reminderIndex = appointment.remindersSent.findIndex(
          r => r.messageId === messageId
        );

        if (reminderIndex !== -1) {
          appointment.remindersSent[reminderIndex].delivered = true;
          appointment.remindersSent[reminderIndex].deliveredAt = new Date();

          await SecureDataAccess.update(
            'appointments',
            { _id: appointmentId },
            { remindersSent: appointment.remindersSent },
            this.getServiceContext(practiceId)
          );
        }
      }
    } catch (error) {
      console.error('Failed to update appointment reminder status:', error);
    }
  }

  async sendBulkSMS(recipients, message, context) {
    if (!this.initialized) {
      return {
        success: false,
        error: 'SMS service not configured'
      };
    }

    const results = {
      total: recipients.length,
      sent: 0,
      failed: 0,
      errors: []
    };

    for (const recipient of recipients) {
      try {
        const result = await this.sendSMS({
          to: recipient.phone,
          message,
          patientId: recipient.patientId,
          type: 'bulk_notification'
        }, context);

        if (result.success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push({
            phone: recipient.phone,
            error: result.error
          });
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.failed++;
        results.errors.push({
          phone: recipient.phone,
          error: error.message
        });
      }
    }

    return results;
  }

  async auditSMSSent(smsRecord, context) {
    await SecureDataAccess.create('audit_logs', {
      action: 'SMS_SENT',
      category: 'communication',
      patientId: smsRecord.patientId,
      userId: context.userId || 'system',
      practiceId: context.practiceId,
      metadata: {
        messageId: smsRecord.messageId,
        type: smsRecord.type,
        status: smsRecord.status
      },
      timestamp: new Date()
    }, this.getServiceContext(context.practiceId));

    await communicationAuditService.recordCommunication(context.practiceId, {
      type: 'sms_notification',
      category: 'patient_communication',
      patientId: smsRecord.patientId,
      method: 'sms',
      message: smsRecord.message,
      deliveryStatus: smsRecord.status,
      sentAt: smsRecord.sentAt,
      messageId: smsRecord.messageId
    });
  }

  async auditSMSFailed(data, error, context) {
    await SecureDataAccess.create('audit_logs', {
      action: 'SMS_FAILED',
      category: 'communication',
      patientId: data.patientId,
      userId: context.userId || 'system',
      practiceId: context.practiceId,
      metadata: {
        error: error.message,
        type: data.type
      },
      timestamp: new Date()
    }, this.getServiceContext(context.practiceId));
  }

  async getMessageStatus(messageId, context) {
    if (!this.initialized) {
      throw new Error('SMS service not configured');
    }

    try {
      const message = await this.client.messages(messageId).fetch();
      
      return {
        messageId: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      };
    } catch (error) {
      console.error('Failed to get message status:', error);
      throw error;
    }
  }

  async getMessageHistory(filters, context) {
    try {
      const query = { practiceId: context.practiceId };

      if (filters.patientId) {
        query.patientId = filters.patientId;
      }

      if (filters.startDate || filters.endDate) {
        query.sentAt = {};
        if (filters.startDate) {
          query.sentAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.sentAt.$lte = new Date(filters.endDate);
        }
      }

      if (filters.status) {
        query.status = filters.status;
      }

      const messages = await SecureDataAccess.query(
        'sms_messages',
        query,
        { sort: { sentAt: -1 }, limit: filters.limit || 100 },
        this.getServiceContext(context.practiceId)
      );

      for (const message of messages) {
        if (message.phoneNumber) {
          try {
            message.phoneNumber = await encryptionService.decrypt(message.phoneNumber);
            message.phoneNumber = this.maskPhoneNumber(message.phoneNumber);
          } catch (error) {
            message.phoneNumber = '[ENCRYPTED]';
          }
        }
      }

      return messages;
    } catch (error) {
      console.error('Failed to get message history:', error);
      throw error;
    }
  }

  maskPhoneNumber(phone) {
    if (!phone || phone.length < 7) return phone;
    
    const visibleDigits = 4;
    const masked = phone.substring(0, phone.length - visibleDigits).replace(/\d/g, '*');
    const visible = phone.substring(phone.length - visibleDigits);
    
    return masked + visible;
  }

  async updatePatientSMSPreference(patientId, preference, context) {
    try {
      await SecureDataAccess.update(
        'patients',
        { _id: patientId },
        { 
          communicationPreferences: {
            sms: preference.enabled,
            smsReminders: preference.reminders,
            smsMarketing: preference.marketing
          }
        },
        this.getServiceContext(context.practiceId)
      );

      await SecureDataAccess.create('audit_logs', {
        action: 'SMS_PREFERENCE_UPDATED',
        category: 'patient_preferences',
        patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: preference,
        timestamp: new Date()
      }, this.getServiceContext(context.practiceId));

      return { success: true };
    } catch (error) {
      console.error('Failed to update SMS preference:', error);
      throw error;
    }
  }

  async handleOptOut(phoneNumber, context) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber, context.country);
      
      await SecureDataAccess.create(
        'sms_optouts',
        {
          phoneNumber: await encryptionService.encrypt(normalizedPhone, 'pii'),
          optOutDate: new Date(),
          source: 'sms_reply'
        },
        this.getServiceContext(context.practiceId)
      );

      console.log(`✅ Phone number opted out: ${this.maskPhoneNumber(normalizedPhone)}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to handle opt-out:', error);
      throw error;
    }
  }

  async isOptedOut(phoneNumber, context) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber, context.country);
      const encryptedPhone = await encryptionService.encrypt(normalizedPhone, 'pii');

      const optOuts = await SecureDataAccess.query(
        'sms_optouts',
        { phoneNumber: encryptedPhone },
        {},
        this.getServiceContext(context.practiceId)
      );

      return optOuts.length > 0;
    } catch (error) {
      console.error('Failed to check opt-out status:', error);
      return false;
    }
  }
}

// Create singleton instance
const smsService = new SMSService();

// Register service with ServiceProxyManager for lazy loading
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('smsService', () => smsService);
}

module.exports = smsService;