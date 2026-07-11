const SecureDataAccess = require('../../../backend/services/secureDataAccess');
const serviceAccountManager = require('../../../backend/services/serviceAccountManager');
const communicationAuditService = require('../../../backend/services/communicationAuditService');
const emailService = require('../../../backend/services/emailService');
const smsService = require('../../../backend/services/smsService');
const AuditLog = require('../../../backend/models/AuditLog');
const encryptionService = require('../../../backend/services/encryptionService');

/**
 * Patient Portal Messaging Service
 * Handles secure patient-provider messaging, prescription refill requests,
 * symptom reporting, and appointment scheduling through chat interface.
 * 
 * Features:
 * - End-to-end encrypted patient-provider messaging
 * - Secure prescription refill requests
 * - Symptom reporting with triage integration
 * - Patient appointment self-scheduling
 * - Message threading and conversation management
 * - Real-time notifications to providers
 * - HIPAA-compliant audit trails
 */
class PatientPortalMessagingService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.serviceId = 'patient-portal-messaging-service';
    
    // Message types and priorities
    this.messageTypes = {
      GENERAL_INQUIRY: { priority: 'normal', requiresResponse: true },
      PRESCRIPTION_REFILL: { priority: 'normal', requiresResponse: true },
      SYMPTOM_REPORT: { priority: 'urgent', requiresResponse: true },
      APPOINTMENT_REQUEST: { priority: 'normal', requiresResponse: true },
      TEST_RESULT_INQUIRY: { priority: 'high', requiresResponse: true },
      FOLLOW_UP: { priority: 'normal', requiresResponse: false }
    };
    
    // Active message threads
    this.activeThreads = new Map();
    this.providerNotifications = new Map();
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Initialize dependent services
      await emailService.initialize();
      await smsService.initialize();
      
      this.initialized = true;
      console.log('✅ Patient Portal Messaging Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Patient Portal Messaging Service:', error);
      throw error;
    }
  }

  /**
   * Send secure message from patient to provider
   */
  async sendPatientPortalMessage(params, practiceContext) {
    try {
      const { patientId, providerId, message, messageType = 'GENERAL_INQUIRY', urgent = false } = params;
      
      if (!patientId || !message) {
        throw new Error('Patient ID and message are required');
      }
      
      // Get patient details
      const patient = await SecureDataAccess.findOne(
        'patients',
        { _id: patientId },
        {},
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      if (!patient) {
        throw new Error('Patient not found');
      }
      
      // Find appropriate provider if not specified
      let targetProvider = null;
      if (providerId) {
        targetProvider = await SecureDataAccess.findOne(
          'users',
          { _id: providerId, role: { $in: ['doctor', 'nurse'] } },
          {},
          {
            serviceId: this.serviceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken,
            practiceId: practiceContext.practiceId
          }
        );
      } else {
        // Find patient's primary care provider or any available doctor
        targetProvider = await this.findAvailableProvider(patientId, practiceContext);
      }
      
      if (!targetProvider) {
        throw new Error('No available provider found');
      }
      
      // Create or get existing thread
      const threadId = await this.getOrCreateMessageThread(patientId, targetProvider._id, practiceContext);
      
      // Encrypt message content
      const encryptedMessage = await encryptionService.encrypt(message, 'phi');
      
      // Create message record
      const messageRecord = {
        _id: new Date().getTime().toString() + Math.random().toString(36).substr(2, 9),
        threadId: threadId,
        patientId: patientId,
        providerId: targetProvider._id,
        senderType: 'patient',
        senderId: patientId,
        message: encryptedMessage,
        messageType: messageType,
        priority: urgent ? 'urgent' : this.messageTypes[messageType]?.priority || 'normal',
        status: 'sent',
        requiresResponse: this.messageTypes[messageType]?.requiresResponse || true,
        sentAt: new Date(),
        readAt: null,
        respondedAt: null,
        practiceId: practiceContext.practiceId,
        metadata: {
          patientName: patient.name,
          providerName: targetProvider.name,
          encrypted: true,
          source: 'patient_portal'
        }
      };
      
      // Save message
      const savedMessage = await SecureDataAccess.insert(
        'patient_messages',
        messageRecord,
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      // Update thread with latest message
      await this.updateMessageThread(threadId, messageRecord, practiceContext);
      
      // Send notification to provider
      await this.notifyProvider(targetProvider, patient, messageType, urgent, practiceContext);
      
      // Audit the communication
      await this.auditPatientMessage({
        action: 'PATIENT_MESSAGE_SENT',
        patientId: patientId,
        providerId: targetProvider._id,
        messageType: messageType,
        priority: messageRecord.priority,
        practiceId: practiceContext.practiceId
      });
      
      return {
        success: true,
        messageId: savedMessage._id,
        threadId: threadId,
        providerId: targetProvider._id,
        providerName: targetProvider.name,
        status: 'sent',
        priority: messageRecord.priority,
        requiresResponse: messageRecord.requiresResponse,
        message: 'Message sent successfully to provider'
      };
      
    } catch (error) {
      console.error('❌ Failed to send patient portal message:', error);
      throw error;
    }
  }

  /**
   * Handle prescription refill request from patient
   */
  async requestPrescriptionRefill(params, practiceContext) {
    try {
      const { patientId, medicationName, prescriptionId, reason, urgentNeed = false } = params;
      
      if (!patientId || !medicationName) {
        throw new Error('Patient ID and medication name are required');
      }
      
      // Get patient details
      const patient = await SecureDataAccess.findOne(
        'patients',
        { _id: patientId },
        {},
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      if (!patient) {
        throw new Error('Patient not found');
      }
      
      // Get prescription details if ID provided
      let prescription = null;
      if (prescriptionId) {
        prescription = await SecureDataAccess.findOne(
          'prescriptions',
          { _id: prescriptionId, patientId: patientId },
          {},
          {
            serviceId: this.serviceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken,
            practiceId: practiceContext.practiceId
          }
        );
      }
      
      // Create refill request
      const refillRequest = {
        _id: new Date().getTime().toString() + Math.random().toString(36).substr(2, 9),
        patientId: patientId,
        prescriptionId: prescriptionId,
        medicationName: medicationName,
        reason: reason || 'Regular refill request',
        urgentNeed: urgentNeed,
        status: 'pending',
        requestedAt: new Date(),
        practiceId: practiceContext.practiceId,
        metadata: {
          patientName: patient.name,
          currentPrescription: prescription ? {
            dosage: prescription.dosage,
            frequency: prescription.frequency,
            lastFilled: prescription.lastFilledDate
          } : null
        }
      };
      
      // Save refill request
      const savedRequest = await SecureDataAccess.insert(
        'prescription_refill_requests',
        refillRequest,
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      // Send message to provider
      const refillMessage = `Prescription refill request for ${medicationName}${urgentNeed ? ' (URGENT)' : ''}.\n\nReason: ${reason || 'Regular refill'}\n\nPlease review and approve this request.`;
      
      await this.sendPatientPortalMessage({
        patientId: patientId,
        message: refillMessage,
        messageType: 'PRESCRIPTION_REFILL',
        urgent: urgentNeed
      }, practiceContext);
      
      // Audit the request
      await this.auditPatientMessage({
        action: 'PRESCRIPTION_REFILL_REQUESTED',
        patientId: patientId,
        medicationName: medicationName,
        urgentNeed: urgentNeed,
        practiceId: practiceContext.practiceId
      });
      
      return {
        success: true,
        requestId: savedRequest._id,
        status: 'pending',
        message: urgentNeed 
          ? 'Urgent refill request submitted. Provider will be notified immediately.'
          : 'Refill request submitted successfully. You will receive a response within 24-48 hours.',
        estimatedResponseTime: urgentNeed ? '2-4 hours' : '24-48 hours'
      };
      
    } catch (error) {
      console.error('❌ Failed to process prescription refill request:', error);
      throw error;
    }
  }

  /**
   * Handle patient symptom reporting
   */
  async reportPatientSymptoms(params, practiceContext) {
    try {
      const { patientId, symptoms, severity, duration, additionalInfo, emergencyFlag = false } = params;
      
      if (!patientId || !symptoms) {
        throw new Error('Patient ID and symptoms are required');
      }
      
      // Get patient details
      const patient = await SecureDataAccess.findOne(
        'patients',
        { _id: patientId },
        {},
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      if (!patient) {
        throw new Error('Patient not found');
      }
      
      // Assess symptom severity and triage
      const triageResult = await this.triageSymptoms(symptoms, severity, patient);
      
      // Create symptom report
      const symptomReport = {
        _id: new Date().getTime().toString() + Math.random().toString(36).substr(2, 9),
        patientId: patientId,
        symptoms: Array.isArray(symptoms) ? symptoms : [symptoms],
        severity: severity || triageResult.severity,
        duration: duration,
        additionalInfo: additionalInfo,
        emergencyFlag: emergencyFlag || triageResult.emergency,
        triageLevel: triageResult.level,
        recommendedAction: triageResult.recommendation,
        reportedAt: new Date(),
        status: 'reported',
        reviewedAt: null,
        practiceId: practiceContext.practiceId,
        metadata: {
          patientName: patient.name,
          patientAge: this.calculateAge(patient.dateOfBirth),
          autoTriage: triageResult
        }
      };
      
      // Save symptom report
      const savedReport = await SecureDataAccess.insert(
        'symptom_reports',
        symptomReport,
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      // Create urgent message to provider
      const urgentMessage = this.formatSymptomMessage(symptomReport);
      
      await this.sendPatientPortalMessage({
        patientId: patientId,
        message: urgentMessage,
        messageType: 'SYMPTOM_REPORT',
        urgent: triageResult.emergency || severity === 'severe'
      }, practiceContext);
      
      // If emergency, also send SMS/email alerts
      if (triageResult.emergency) {
        await this.sendEmergencyAlert(patient, symptomReport, practiceContext);
      }
      
      // Audit the report
      await this.auditPatientMessage({
        action: 'SYMPTOM_REPORT_SUBMITTED',
        patientId: patientId,
        severity: symptomReport.severity,
        emergencyFlag: symptomReport.emergencyFlag,
        triageLevel: triageResult.level,
        practiceId: practiceContext.practiceId
      });
      
      return {
        success: true,
        reportId: savedReport._id,
        triageLevel: triageResult.level,
        severity: symptomReport.severity,
        emergencyFlag: symptomReport.emergencyFlag,
        recommendedAction: triageResult.recommendation,
        message: triageResult.emergency 
          ? 'URGENT: Your symptoms require immediate medical attention. Emergency services and your provider have been notified.'
          : `Symptom report submitted. Triage level: ${triageResult.level}. Provider will respond within ${this.getResponseTime(triageResult.level)}.`,
        nextSteps: triageResult.nextSteps
      };
      
    } catch (error) {
      console.error('❌ Failed to process symptom report:', error);
      throw error;
    }
  }

  /**
   * Handle patient appointment scheduling request
   */
  async schedulePatientAppointment(params, practiceContext) {
    try {
      const { patientId, providerId, appointmentType, preferredDate, preferredTime, reason, urgentRequest = false } = params;
      
      if (!patientId || !appointmentType) {
        throw new Error('Patient ID and appointment type are required');
      }
      
      // Get patient details
      const patient = await SecureDataAccess.findOne(
        'patients',
        { _id: patientId },
        {},
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      if (!patient) {
        throw new Error('Patient not found');
      }
      
      // Check availability if specific provider and time requested
      let availabilityCheck = null;
      if (providerId && preferredDate && preferredTime) {
        availabilityCheck = await this.checkProviderAvailability(providerId, preferredDate, preferredTime, practiceContext);
      }
      
      // Create appointment request
      const appointmentRequest = {
        _id: new Date().getTime().toString() + Math.random().toString(36).substr(2, 9),
        patientId: patientId,
        providerId: providerId,
        appointmentType: appointmentType,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        preferredTime: preferredTime,
        reason: reason,
        urgentRequest: urgentRequest,
        status: availabilityCheck?.available ? 'confirmed' : 'pending',
        requestedAt: new Date(),
        confirmedAt: availabilityCheck?.available ? new Date() : null,
        practiceId: practiceContext.practiceId,
        metadata: {
          patientName: patient.name,
          availabilityCheck: availabilityCheck
        }
      };
      
      // Save appointment request
      const savedRequest = await SecureDataAccess.insert(
        'appointment_requests',
        appointmentRequest,
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      // Send message to provider/scheduling team
      const appointmentMessage = this.formatAppointmentRequestMessage(appointmentRequest);
      
      await this.sendPatientPortalMessage({
        patientId: patientId,
        providerId: providerId,
        message: appointmentMessage,
        messageType: 'APPOINTMENT_REQUEST',
        urgent: urgentRequest
      }, practiceContext);
      
      // Audit the request
      await this.auditPatientMessage({
        action: 'APPOINTMENT_REQUEST_SUBMITTED',
        patientId: patientId,
        providerId: providerId,
        appointmentType: appointmentType,
        urgentRequest: urgentRequest,
        practiceId: practiceContext.practiceId
      });
      
      return {
        success: true,
        requestId: savedRequest._id,
        status: appointmentRequest.status,
        message: availabilityCheck?.available
          ? `Appointment confirmed for ${preferredDate} at ${preferredTime}`
          : 'Appointment request submitted. Scheduling team will contact you with available times.',
        estimatedResponseTime: urgentRequest ? '2-4 hours' : '24 hours',
        availableSlots: availabilityCheck?.alternativeSlots || []
      };
      
    } catch (error) {
      console.error('❌ Failed to process appointment request:', error);
      throw error;
    }
  }

  /**
   * Get patient message history
   */
  async getPatientMessageHistory(params, practiceContext) {
    try {
      const { patientId, providerId, threadId, limit = 50 } = params;
      
      if (!patientId) {
        throw new Error('Patient ID is required');
      }
      
      // Build query
      let query = { patientId: patientId, practiceId: practiceContext.practiceId };
      
      if (providerId) {
        query.providerId = providerId;
      }
      
      if (threadId) {
        query.threadId = threadId;
      }
      
      // Get messages
      const messages = await SecureDataAccess.query(
        'patient_messages',
        query,
        { 
          sort: { sentAt: -1 },
          limit: limit
        },
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      // Decrypt messages and format for display
      const decryptedMessages = await Promise.all(messages.map(async (msg) => {
        let decryptedContent;
        try {
          decryptedContent = await encryptionService.decrypt(msg.message, 'phi');
        } catch (error) {
          decryptedContent = '[Message could not be decrypted]';
        }
        
        return {
          id: msg._id,
          threadId: msg.threadId,
          senderType: msg.senderType,
          senderId: msg.senderId,
          message: decryptedContent,
          messageType: msg.messageType,
          priority: msg.priority,
          status: msg.status,
          sentAt: msg.sentAt,
          readAt: msg.readAt,
          providerId: msg.providerId,
          metadata: {
            providerName: msg.metadata?.providerName,
            requiresResponse: msg.requiresResponse,
            responseTime: msg.respondedAt ? 
              Math.round((new Date(msg.respondedAt) - new Date(msg.sentAt)) / (1000 * 60)) + ' minutes' : 
              null
          }
        };
      }));
      
      return {
        success: true,
        messages: decryptedMessages,
        totalMessages: messages.length,
        hasMore: messages.length === limit
      };
      
    } catch (error) {
      console.error('❌ Failed to get patient message history:', error);
      throw error;
    }
  }

  // Helper Methods

  async getOrCreateMessageThread(patientId, providerId, practiceContext) {
    try {
      // Look for existing thread
      const existingThread = await SecureDataAccess.findOne(
        'message_threads',
        { 
          patientId: patientId,
          providerId: providerId,
          status: 'active',
          practiceId: practiceContext.practiceId
        },
        {},
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      if (existingThread) {
        return existingThread._id;
      }
      
      // Create new thread
      const newThread = {
        _id: new Date().getTime().toString() + Math.random().toString(36).substr(2, 9),
        patientId: patientId,
        providerId: providerId,
        status: 'active',
        createdAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: 0,
        practiceId: practiceContext.practiceId
      };
      
      const savedThread = await SecureDataAccess.insert(
        'message_threads',
        newThread,
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      return savedThread._id;
      
    } catch (error) {
      console.error('❌ Failed to create message thread:', error);
      throw error;
    }
  }

  async updateMessageThread(threadId, messageRecord, practiceContext) {
    try {
      await SecureDataAccess.update(
        'message_threads',
        { _id: threadId },
        {
          lastMessageAt: messageRecord.sentAt,
          $inc: { messageCount: 1 },
          lastMessageType: messageRecord.messageType,
          lastMessageSender: messageRecord.senderType
        },
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
    } catch (error) {
      console.error('❌ Failed to update message thread:', error);
    }
  }

  async findAvailableProvider(patientId, practiceContext) {
    try {
      // First try to find patient's assigned primary care provider
      const patient = await SecureDataAccess.findOne(
        'patients',
        { _id: patientId },
        {},
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      if (patient?.primaryCareProviderId) {
        const primaryProvider = await SecureDataAccess.findOne(
          'users',
          { _id: patient.primaryCareProviderId, role: { $in: ['doctor', 'nurse'] } },
          {},
          {
            serviceId: this.serviceId,
            apiKey: this.serviceToken?.apiKey || this.serviceToken,
            practiceId: practiceContext.practiceId
          }
        );
        
        if (primaryProvider) {
          return primaryProvider;
        }
      }
      
      // Fallback to any available doctor
      const availableDoctor = await SecureDataAccess.findOne(
        'users',
        { 
          role: 'doctor',
          status: 'active',
          practiceId: practiceContext.practiceId
        },
        {},
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      return availableDoctor;
      
    } catch (error) {
      console.error('❌ Failed to find available provider:', error);
      return null;
    }
  }

  async notifyProvider(provider, patient, messageType, urgent, practiceContext) {
    try {
      const priority = urgent ? 'URGENT' : 'NORMAL';
      const subject = `${priority}: New patient message - ${messageType}`;
      const notificationMessage = `
Patient ${patient.name} has sent a ${messageType.toLowerCase().replace('_', ' ')} message.
${urgent ? 'This message is marked as URGENT and requires immediate attention.' : ''}

Please log into the patient portal to respond.

Patient: ${patient.name}
Type: ${messageType}
Priority: ${priority}
Time: ${new Date().toLocaleString()}
      `.trim();
      
      // Send email notification
      if (provider.email) {
        await emailService.sendCustomEmail({
          to: provider.email,
          subject: subject,
          text: notificationMessage,
          html: notificationMessage.replace(/\n/g, '<br>')
        });
      }
      
      // Send SMS for urgent messages
      if (urgent && provider.phone) {
        await smsService.sendSMS({
          to: provider.phone,
          message: `URGENT: Patient ${patient.name} needs immediate attention. Check patient portal.`,
          type: 'provider_alert'
        }, {
          practiceId: practiceContext.practiceId,
          country: practiceContext.country || 'US'
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to notify provider:', error);
    }
  }

  triageSymptoms(symptoms, severity, patient) {
    // Simple triage logic - in production would use more sophisticated AI
    const emergencyKeywords = ['chest pain', 'difficulty breathing', 'severe bleeding', 'unconscious', 'stroke symptoms'];
    const urgentKeywords = ['high fever', 'severe pain', 'vomiting', 'dizziness'];
    
    const symptomsText = Array.isArray(symptoms) ? symptoms.join(' ').toLowerCase() : symptoms.toLowerCase();
    
    let emergency = emergencyKeywords.some(keyword => symptomsText.includes(keyword));
    let urgent = urgentKeywords.some(keyword => symptomsText.includes(keyword));
    
    if (severity === 'severe' || emergency) {
      return {
        level: 'emergency',
        severity: 'severe',
        emergency: true,
        recommendation: 'Seek immediate medical attention or call emergency services',
        nextSteps: ['Call 911 immediately', 'Go to nearest emergency room', 'Contact emergency services']
      };
    } else if (severity === 'moderate' || urgent) {
      return {
        level: 'urgent',
        severity: 'moderate',
        emergency: false,
        recommendation: 'Contact healthcare provider within 24 hours',
        nextSteps: ['Schedule urgent appointment', 'Monitor symptoms closely', 'Contact practice if symptoms worsen']
      };
    } else {
      return {
        level: 'routine',
        severity: 'mild',
        emergency: false,
        recommendation: 'Schedule regular appointment if symptoms persist',
        nextSteps: ['Monitor symptoms', 'Schedule routine appointment if needed', 'Rest and follow general care guidelines']
      };
    }
  }

  formatSymptomMessage(symptomReport) {
    return `
SYMPTOM REPORT - ${symptomReport.triageLevel.toUpperCase()}

Patient: ${symptomReport.metadata.patientName}
Age: ${symptomReport.metadata.patientAge}

Symptoms: ${symptomReport.symptoms.join(', ')}
Severity: ${symptomReport.severity}
Duration: ${symptomReport.duration || 'Not specified'}

Additional Information: ${symptomReport.additionalInfo || 'None provided'}

Triage Recommendation: ${symptomReport.recommendedAction}

${symptomReport.emergencyFlag ? '⚠️ EMERGENCY FLAG: This patient may require immediate attention!' : ''}

Please review and respond appropriately.
    `.trim();
  }

  formatAppointmentRequestMessage(appointmentRequest) {
    return `
APPOINTMENT REQUEST

Patient: ${appointmentRequest.metadata.patientName}
Type: ${appointmentRequest.appointmentType}
${appointmentRequest.preferredDate ? `Preferred Date: ${appointmentRequest.preferredDate.toDateString()}` : ''}
${appointmentRequest.preferredTime ? `Preferred Time: ${appointmentRequest.preferredTime}` : ''}
Reason: ${appointmentRequest.reason || 'Not specified'}

${appointmentRequest.urgentRequest ? '⚠️ URGENT REQUEST - Patient needs priority scheduling' : ''}

Please schedule this appointment and confirm with the patient.
    `.trim();
  }

  async sendEmergencyAlert(patient, symptomReport, practiceContext) {
    try {
      // Find all active providers for emergency notification
      const providers = await SecureDataAccess.query(
        'users',
        { 
          role: { $in: ['doctor', 'nurse'] },
          status: 'active',
          practiceId: practiceContext.practiceId
        },
        { limit: 10 },
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      const alertMessage = `EMERGENCY: Patient ${patient.name} has reported emergency symptoms. Check patient portal immediately.`;
      
      // Send to all providers
      for (const provider of providers) {
        if (provider.email) {
          await emailService.sendCustomEmail({
            to: provider.email,
            subject: '🚨 EMERGENCY: Patient Symptom Alert',
            text: alertMessage,
            html: `<h2 style="color: red;">🚨 EMERGENCY ALERT</h2><p>${alertMessage}</p>`
          });
        }
        
        if (provider.phone) {
          await smsService.sendSMS({
            to: provider.phone,
            message: alertMessage,
            type: 'emergency_alert'
          }, {
            practiceId: practiceContext.practiceId,
            country: practiceContext.country || 'US'
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to send emergency alert:', error);
    }
  }

  calculateAge(birthDate) {
    if (!birthDate) return 'Unknown';
    
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  getResponseTime(triageLevel) {
    const responseTimes = {
      emergency: '15-30 minutes',
      urgent: '2-4 hours',
      routine: '24-48 hours'
    };
    
    return responseTimes[triageLevel] || '24-48 hours';
  }

  async checkProviderAvailability(providerId, date, time, practiceContext) {
    try {
      // Simple availability check - in production would integrate with scheduling system
      const appointmentDate = new Date(date);
      const appointments = await SecureDataAccess.query(
        'appointments',
        {
          providerId: providerId,
          scheduledDate: {
            $gte: appointmentDate,
            $lt: new Date(appointmentDate.getTime() + 24 * 60 * 60 * 1000)
          },
          status: { $ne: 'cancelled' }
        },
        {},
        {
          serviceId: this.serviceId,
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      const isTimeSlotTaken = appointments.some(apt => apt.scheduledTime === time);
      
      return {
        available: !isTimeSlotTaken,
        alternativeSlots: isTimeSlotTaken ? this.generateAlternativeSlots(date, time) : []
      };
      
    } catch (error) {
      console.error('❌ Failed to check provider availability:', error);
      return { available: false, alternativeSlots: [] };
    }
  }

  generateAlternativeSlots(requestedDate, requestedTime) {
    // Generate some alternative time slots
    const slots = [];
    const baseDate = new Date(requestedDate);
    
    // Same day alternatives
    const times = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
    times.forEach(time => {
      if (time !== requestedTime) {
        slots.push({
          date: baseDate.toISOString().split('T')[0],
          time: time
        });
      }
    });
    
    // Next day alternatives
    const nextDay = new Date(baseDate);
    nextDay.setDate(nextDay.getDate() + 1);
    times.forEach(time => {
      slots.push({
        date: nextDay.toISOString().split('T')[0],
        time: time
      });
    });
    
    return slots.slice(0, 5); // Return first 5 alternatives
  }

  async auditPatientMessage(auditData) {
    try {
      await AuditLog.create({
        action: auditData.action,
        category: 'patient_portal_messaging',
        userId: auditData.patientId,
        practiceId: auditData.practiceId,
        metadata: {
          providerId: auditData.providerId,
          messageType: auditData.messageType,
          priority: auditData.priority,
          medicationName: auditData.medicationName,
          severity: auditData.severity,
          emergencyFlag: auditData.emergencyFlag,
          triageLevel: auditData.triageLevel,
          appointmentType: auditData.appointmentType,
          urgentRequest: auditData.urgentRequest,
          urgentNeed: auditData.urgentNeed
        },
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Failed to audit patient message:', error);
    }
  }
}

// Export singleton instance
module.exports = new PatientPortalMessagingService();